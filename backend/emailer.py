import os
import re
import ipaddress
import logging
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

logger = logging.getLogger("studio01.email")

EMAIL_BASE_URL = "https://integrations.emergentagent.com"

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> str | None:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html,
               "from_name": os.environ["EMAIL_FROM_NAME"]}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                 headers={"X-Email-Key": os.environ["EMERGENT_EMAIL_KEY"]},
                                 json=payload)
    resp.raise_for_status()
    return resp.json().get("id")


def reminder_html(apt: dict, site_url: str) -> str:
    brand = escape(os.environ["EMAIL_FROM_NAME"])
    services = escape(", ".join(s["name"] for s in apt["services"]))
    d = apt["date"].split("-")
    date_br = f"{d[2]}/{d[1]}/{d[0]}"
    return (
        '<table role="presentation" width="100%" style="background:#09090b;padding:24px 0">'
        '<tr><td align="center"><table role="presentation" width="520" style="background:#18181b;'
        'border:1px solid #27272a;border-radius:8px;font-family:Arial,sans-serif;color:#e4e4e7">'
        f'<tr><td style="padding:28px 28px 8px"><div style="font-size:12px;letter-spacing:3px;color:#fbbf24">{brand.upper()}</div>'
        f'<h1 style="margin:8px 0 0;font-size:24px;color:#ffffff">Lembrete: seu horário é amanhã</h1></td></tr>'
        f'<tr><td style="padding:16px 28px"><p style="margin:0 0 16px">Olá, {escape(apt["client_name"])}! '
        'Passando para lembrar do seu agendamento:</p>'
        '<table role="presentation" width="100%" style="font-size:14px">'
        f'<tr><td style="color:#a1a1aa;padding:4px 0">Data</td><td align="right" style="color:#fff">{date_br}</td></tr>'
        f'<tr><td style="color:#a1a1aa;padding:4px 0">Horário</td><td align="right" style="color:#fff">{escape(apt["time"])}</td></tr>'
        f'<tr><td style="color:#a1a1aa;padding:4px 0">Barbeiro</td><td align="right" style="color:#fff">{escape(apt["barber_name"])}</td></tr>'
        f'<tr><td style="color:#a1a1aa;padding:4px 0">Serviços</td><td align="right" style="color:#fff">{services}</td></tr>'
        f'<tr><td style="color:#a1a1aa;padding:4px 0">Protocolo</td><td align="right" style="color:#fbbf24">{escape(apt["protocol"])}</td></tr>'
        '</table>'
        f'<p style="margin:20px 0 0">Não vai conseguir vir? Cancele pelo site para liberar o horário:</p>'
        f'<p style="margin:16px 0"><a href="{escape(site_url)}" style="background:#ffffff;color:#09090b;'
        'padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Ver meus agendamentos</a></p>'
        '</td></tr>'
        f'<tr><td style="padding:16px 28px;font-size:11px;color:#71717a;border-top:1px solid #27272a">'
        f'Enviado por {brand} • CNPJ 62.773.547/0001-87. Nunca pedimos sua senha por email.</td></tr>'
        '</table></td></tr></table>'
    )
