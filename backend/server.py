from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, BackgroundTasks, UploadFile, File
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError
from emailer import send_email, reminder_html
from storage import put_object, get_object, init_storage, APP_NAME
import asyncio
import hmac
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import bcrypt
import jwt
import uuid
import logging
import random

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("studio01")

# ---------------- Static business data ----------------
SERVICES = [
    {"id": "barba", "name": "Barba", "price": 15, "starting_at": True, "duration": 30, "category": "Barba"},
    {"id": "cavanhaque", "name": "Cavanhaque", "price": 15, "starting_at": True, "duration": 20, "category": "Barba"},
    {"id": "coloracao", "name": "Coloração", "price": 60, "starting_at": True, "duration": 50, "category": "Química"},
    {"id": "corte_simples", "name": "Corte Simples", "price": 20, "starting_at": False, "duration": 40, "category": "Cabelo"},
    {"id": "corte_degrade", "name": "Corte Degradê", "price": 40, "starting_at": False, "duration": 40, "category": "Cabelo"},
    {"id": "corte_tesoura", "name": "Corte Todo na Tesoura", "price": 25, "starting_at": True, "duration": 40, "category": "Cabelo"},
    {"id": "corte_degrade_tesoura", "name": "Corte Degradê + Tesoura", "price": 45, "starting_at": True, "duration": 50, "category": "Cabelo"},
    {"id": "pezinho", "name": "Pézinho / Acabamento", "price": 10, "starting_at": True, "duration": 15, "category": "Acabamento"},
    {"id": "pigmentacao", "name": "Pigmentação", "price": 20, "starting_at": False, "duration": 30, "category": "Química"},
    {"id": "platinado_nevou", "name": "Platinado / Nevou", "price": 60, "starting_at": False, "duration": 60, "category": "Química"},
    {"id": "reflexo_luzes", "name": "Reflexo / Luzes", "price": 60, "starting_at": True, "duration": 60, "category": "Química"},
    {"id": "sobrancelha", "name": "Sobrancelha", "price": 10, "starting_at": False, "duration": 15, "category": "Acabamento"},
]
SERVICE_MAP = {s["id"]: s for s in SERVICES}

SLOTS = ["09:00", "09:40", "10:20", "11:00", "11:40", "13:00", "13:40",
         "14:20", "15:00", "15:40", "16:20", "17:00", "17:40", "18:20"]
OPEN_WEEKDAYS = {1, 2, 3, 4, 5}  # Tue..Sat (Mon=0)

DEFAULT_BARBERS = [
    {"id": "capoli", "name": "Capoli", "specialty": "Barbeiro", "avatar": ""},
    {"id": "novaes", "name": "Novaes", "specialty": "Barbeiro", "avatar": ""},
]

# ---------------- Auth helpers ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)

def set_auth_cookie(response: Response, token: str):
    response.set_cookie(key="access_token", value=token, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")
        user["id"] = str(user["_id"])
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador")
    return user

# ---------------- Models ----------------
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str = Field(min_length=6)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class AppointmentIn(BaseModel):
    barber_id: str
    date: str
    time: str
    service_ids: List[str]

class StatusIn(BaseModel):
    status: str

class RescheduleIn(BaseModel):
    date: str
    time: str

class BlockIn(BaseModel):
    barber_id: str
    date: str
    time: str

class BarberIn(BaseModel):
    name: str = Field(min_length=1)
    specialty: str = ""
    avatar: str = ""
    days: List[int] = Field(default_factory=lambda: sorted(OPEN_WEEKDAYS))
    start: str = "09:00"
    end: str = "19:00"

def _mins(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)

def works(barber: dict, weekday: int, slot: Optional[str] = None) -> bool:
    if weekday not in barber.get("days", OPEN_WEEKDAYS):
        return False
    if slot is None:
        return True
    return _mins(barber.get("start", "09:00")) <= _mins(slot) and _mins(slot) + 40 <= _mins(barber.get("end", "19:00"))

def _barber_doc(body: "BarberIn") -> dict:
    days = sorted({d for d in body.days if d in OPEN_WEEKDAYS})
    if not days:
        raise HTTPException(status_code=400, detail="Selecione ao menos um dia de atendimento")
    if _mins(body.start) >= _mins(body.end):
        raise HTTPException(status_code=400, detail="Horário de início deve ser antes do fim")
    return {"name": body.name.strip(), "specialty": body.specialty.strip(),
            "avatar": body.avatar.strip(), "days": days, "start": body.start, "end": body.end}

# ---------------- Auth endpoints ----------------
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Este email já está cadastrado")
    doc = {"name": body.name, "email": email, "phone": body.phone,
           "password_hash": hash_password(body.password), "role": "client",
           "created_at": datetime.now(timezone.utc).isoformat()}
    res = await db.users.insert_one(doc)
    token = create_access_token(str(res.inserted_id), email)
    set_auth_cookie(response, token)
    return {"id": str(res.inserted_id), "name": body.name, "email": email,
            "phone": body.phone, "role": "client"}

@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")
    token = create_access_token(str(user["_id"]), email)
    set_auth_cookie(response, token)
    return {"id": str(user["_id"]), "name": user["name"], "email": email,
            "phone": user.get("phone", ""), "role": user.get("role", "client")}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

# ---------------- Catalog ----------------
@api.get("/services")
async def get_services():
    return SERVICES

@api.get("/barbers")
async def get_barbers():
    barbers = await db.barbers.find({}, {"_id": 0}).to_list(100)
    return barbers

@api.get("/config")
async def get_config():
    return {"slots": SLOTS, "open_weekdays": sorted(OPEN_WEEKDAYS),
            "cnpj": "62.773.547/0001-87",
            "after_hours": "Dias de pico após 19:00: atendimento por ordem de chegada (fila no balcão).",
            "days_label": "Terça a Sábado"}

# ---------------- Availability ----------------
async def _taken_map(date_str: str):
    """Returns {time: set(barber_ids booked), ...} and blocks {time:set(...)}"""
    booked = {}
    blocked = {}
    async for a in db.appointments.find({"date": date_str, "status": {"$ne": "cancelado"}}):
        booked.setdefault(a["time"], set()).add(a["barber_id"])
    async for b in db.blocks.find({"date": date_str}):
        blocked.setdefault(b["time"], set()).add(b["barber_id"])
    return booked, blocked

@api.get("/availability")
async def availability(date: str, barber_id: str = "any"):
    try:
        d = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida")
    if d.weekday() not in OPEN_WEEKDAYS:
        return {"open": False, "slots": [],
                "message": "Fechado neste dia. Atendemos de terça a sábado, 09:00–19:00."}
    barbers = await db.barbers.find({}, {"_id": 0}).to_list(100)
    wd = d.weekday()
    if barber_id == "any":
        working = [b for b in barbers if works(b, wd)]
    else:
        working = [b for b in barbers if b["id"] == barber_id and works(b, wd)]
    if not working:
        return {"open": False, "slots": [],
                "message": "Este barbeiro não atende neste dia. Escolha outra data." if barber_id != "any"
                else "Nenhum barbeiro atende neste dia."}
    booked, blocked = await _taken_map(date)
    now = datetime.now(timezone.utc) - timedelta(hours=3)  # BRT
    result = []
    for slot in SLOTS:
        slot_dt = datetime.combine(d, datetime.strptime(slot, "%H:%M").time())
        is_past = d == now.date() and slot_dt.time() <= now.time()
        on_duty = [b["id"] for b in working if works(b, wd, slot)]
        if barber_id == "any":
            busy = booked.get(slot, set()) | blocked.get(slot, set())
            free = [bid for bid in on_duty if bid not in busy]
            status = "past" if is_past else ("off" if not on_duty else ("available" if free else "booked"))
        else:
            taken = barber_id in booked.get(slot, set())
            isblocked = barber_id in blocked.get(slot, set())
            if is_past:
                status = "past"
            elif not on_duty:
                status = "off"
            elif isblocked:
                status = "blocked"
            elif taken:
                status = "booked"
            else:
                status = "available"
        result.append({"time": slot, "status": status})
    return {"open": True, "slots": result}

# ---------------- Appointments ----------------
def _gen_protocol():
    return "ST01-" + "".join(random.choices("0123456789", k=6))

@api.post("/appointments")
async def create_appointment(body: AppointmentIn, user: dict = Depends(get_current_user)):
    try:
        d = datetime.strptime(body.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida")
    if d.weekday() not in OPEN_WEEKDAYS:
        raise HTTPException(status_code=400, detail="Dia indisponível para agendamento")
    if body.time not in SLOTS:
        raise HTTPException(status_code=400, detail="Horário inválido")
    services = [SERVICE_MAP[s] for s in body.service_ids if s in SERVICE_MAP]
    if not services:
        raise HTTPException(status_code=400, detail="Selecione ao menos um serviço")
    barber = await db.barbers.find_one({"id": body.barber_id}, {"_id": 0})

    # resolve "any" to a free barber
    booked, blocked = await _taken_map(body.date)
    busy = booked.get(body.time, set()) | blocked.get(body.time, set())
    if body.barber_id == "any" or not barber:
        barbers = await db.barbers.find({}, {"_id": 0}).to_list(100)
        free = [b for b in barbers if b["id"] not in busy and works(b, d.weekday(), body.time)]
        if not free:
            raise HTTPException(status_code=409, detail="Horário esgotado, escolha outro")
        barber = free[0]
    else:
        if not works(barber, d.weekday(), body.time):
            raise HTTPException(status_code=400, detail="Este barbeiro não atende neste horário")
        if body.barber_id in busy:
            raise HTTPException(status_code=409, detail="Este horário acabou de ser ocupado")

    total = sum(s["price"] for s in services)
    duration = sum(s["duration"] for s in services)
    doc = {
        "protocol": _gen_protocol(),
        "user_id": user["id"], "client_name": user["name"],
        "client_phone": user.get("phone", ""), "client_email": user["email"],
        "barber_id": barber["id"], "barber_name": barber["name"],
        "date": body.date, "time": body.time,
        "services": [{"id": s["id"], "name": s["name"], "price": s["price"]} for s in services],
        "total_price": total, "duration": duration,
        "status": "confirmado", "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.appointments.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return doc

@api.get("/appointments/me")
async def my_appointments(user: dict = Depends(get_current_user)):
    out = []
    async for a in db.appointments.find({"user_id": user["id"]}).sort([("date", -1), ("time", -1)]):
        a["id"] = str(a["_id"]); a.pop("_id", None)
        out.append(a)
    return out

@api.patch("/appointments/{apt_id}/reschedule")
async def reschedule_appointment(apt_id: str, body: RescheduleIn, user: dict = Depends(get_current_user)):
    apt = await db.appointments.find_one({"_id": ObjectId(apt_id)}) if ObjectId.is_valid(apt_id) else None
    if not apt or apt["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    if apt["status"] != "confirmado":
        raise HTTPException(status_code=400, detail="Só é possível reagendar horários confirmados")
    try:
        d = datetime.strptime(body.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida")
    if d.weekday() not in OPEN_WEEKDAYS or body.time not in SLOTS:
        raise HTTPException(status_code=400, detail="Dia ou horário indisponível")
    now = datetime.now(timezone.utc) - timedelta(hours=3)
    if datetime.combine(d, datetime.strptime(body.time, "%H:%M").time()) <= now.replace(tzinfo=None):
        raise HTTPException(status_code=400, detail="Escolha um horário futuro")
    barber = await db.barbers.find_one({"id": apt["barber_id"]}, {"_id": 0})
    if barber and not works(barber, d.weekday(), body.time):
        raise HTTPException(status_code=400, detail="Este barbeiro não atende neste horário")
    clash = await db.appointments.find_one({"_id": {"$ne": apt["_id"]}, "barber_id": apt["barber_id"],
                                            "date": body.date, "time": body.time, "status": {"$ne": "cancelado"}})
    blocked = await db.blocks.find_one({"barber_id": apt["barber_id"], "date": body.date, "time": body.time})
    if clash or blocked:
        raise HTTPException(status_code=409, detail="Este horário não está disponível")
    await db.appointments.update_one({"_id": apt["_id"]}, {"$set": {
        "date": body.date, "time": body.time, "reminder_sent": False,
        "rescheduled_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True, "date": body.date, "time": body.time}

@api.patch("/appointments/{apt_id}/cancel")
async def cancel_appointment(apt_id: str, user: dict = Depends(get_current_user)):
    apt = await db.appointments.find_one({"_id": ObjectId(apt_id)})
    if not apt or apt["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    await db.appointments.update_one({"_id": ObjectId(apt_id)}, {"$set": {"status": "cancelado"}})
    return {"ok": True}

# ---------------- Admin ----------------
@api.get("/admin/appointments")
async def admin_appointments(date: Optional[str] = None, admin: dict = Depends(require_admin)):
    query = {"date": date} if date else {}
    out = []
    async for a in db.appointments.find(query).sort([("date", 1), ("time", 1)]):
        a["id"] = str(a["_id"]); a.pop("_id", None)
        out.append(a)
    return out

@api.patch("/admin/appointments/{apt_id}/status")
async def admin_set_status(apt_id: str, body: StatusIn, admin: dict = Depends(require_admin)):
    if body.status not in {"confirmado", "concluido", "cancelado", "pendente"}:
        raise HTTPException(status_code=400, detail="Status inválido")
    r = await db.appointments.update_one({"_id": ObjectId(apt_id)}, {"$set": {"status": body.status}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    return {"ok": True}

@api.get("/admin/blocks")
async def admin_get_blocks(date: str, admin: dict = Depends(require_admin)):
    return await db.blocks.find({"date": date}, {"_id": 0}).to_list(500)

@api.post("/admin/blocks")
async def admin_block(body: BlockIn, admin: dict = Depends(require_admin)):
    existing = await db.blocks.find_one({"barber_id": body.barber_id, "date": body.date, "time": body.time})
    if existing:
        await db.blocks.delete_one({"_id": existing["_id"]})
        return {"blocked": False}
    await db.blocks.insert_one(body.model_dump())
    return {"blocked": True}

@api.get("/admin/metrics")
async def admin_metrics(date: str, admin: dict = Depends(require_admin)):
    total = 0; revenue = 0; active = 0
    async for a in db.appointments.find({"date": date}):
        total += 1
        if a["status"] != "cancelado":
            active += 1
            revenue += a.get("total_price", 0)
    barbers = await db.barbers.count_documents({})
    capacity = barbers * len(SLOTS)
    occupancy = round((active / capacity) * 100) if capacity else 0
    return {"total": total, "revenue": revenue, "active": active, "occupancy": occupancy}

DEFAULT_AVATAR = ""
ALLOWED_IMG = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif"}

@api.post("/admin/upload-photo")
async def admin_upload_photo(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    ext = ALLOWED_IMG.get(file.content_type or "")
    if not ext:
        raise HTTPException(status_code=400, detail="Envie uma imagem JPG, PNG ou WEBP")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Imagem muito grande (máx. 8MB)")
    path = f"{APP_NAME}/barbers/{uuid.uuid4()}.{ext}"
    try:
        result = await asyncio.to_thread(put_object, path, data, file.content_type)
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=502, detail="Falha ao enviar a imagem")
    await db.files.insert_one({"storage_path": result["path"], "content_type": file.content_type,
                               "size": len(data), "is_deleted": False,
                               "created_at": datetime.now(timezone.utc).isoformat()})
    return {"url": f"/api/files/{result['path']}"}

@api.get("/files/{path:path}")
async def serve_file(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    data, ctype = await asyncio.to_thread(get_object, path)
    return Response(content=data, media_type=record.get("content_type") or ctype,
                    headers={"Cache-Control": "public, max-age=86400"})

@api.post("/admin/barbers")
async def admin_create_barber(body: BarberIn, admin: dict = Depends(require_admin)):
    doc = {"id": "b" + uuid.uuid4().hex[:8], **_barber_doc(body)}
    await db.barbers.insert_one(dict(doc))
    return doc

@api.put("/admin/barbers/{barber_id}")
async def admin_update_barber(barber_id: str, body: BarberIn, admin: dict = Depends(require_admin)):
    upd = _barber_doc(body)
    r = await db.barbers.update_one({"id": barber_id}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Barbeiro não encontrado")
    await db.appointments.update_many({"barber_id": barber_id}, {"$set": {"barber_name": upd["name"]}})
    return {"id": barber_id, **upd}

@api.delete("/admin/barbers/{barber_id}")
async def admin_delete_barber(barber_id: str, admin: dict = Depends(require_admin)):
    r = await db.barbers.delete_one({"id": barber_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Barbeiro não encontrado")
    await db.blocks.delete_many({"barber_id": barber_id})
    return {"ok": True}

# ---------------- Cron: day-before reminders ----------------
async def send_reminders():
    tomorrow = ((datetime.now(timezone.utc) - timedelta(hours=3)) + timedelta(days=1)).strftime("%Y-%m-%d")
    site = os.environ["FRONTEND_URL"] + "/#meus-agendamentos"
    sent = 0
    async for a in db.appointments.find({"date": tomorrow, "status": "confirmado", "reminder_sent": {"$ne": True}}):
        try:
            await send_email(to=a["client_email"], subject="Lembrete: seu horário na Studio01 é amanhã",
                             html=reminder_html(a, site))
            await db.appointments.update_one({"_id": a["_id"]}, {"$set": {"reminder_sent": True}})
            sent += 1
        except Exception as e:
            logger.error(f"Reminder failed for {a.get('protocol')}: {e}")
    logger.info(f"Reminders sent for {tomorrow}: {sent}")

@api.post("/cron/reminders")
async def cron_reminders(request: Request, background: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer ") or not hmac.compare_digest(auth[7:], os.environ["WEBHOOK_CRON_SECRET"]):
        raise HTTPException(status_code=401, detail="Unauthorized")
    run_id = request.headers.get("X-Webhook-Id")
    if not run_id:
        try:
            run_id = (await request.json()).get("run_id")
        except Exception:
            run_id = None
    run_id = run_id or uuid.uuid4().hex
    try:
        await db.cron_runs.insert_one({"_id": run_id, "at": datetime.now(timezone.utc).isoformat()})
    except DuplicateKeyError:
        return {"status": "duplicate"}
    background.add_task(send_reminders)
    return {"status": "accepted"}

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"),
                   "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    try:
        await asyncio.to_thread(init_storage)
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    await db.barbers.update_many({"days": {"$exists": False}},
                                 {"$set": {"days": sorted(OPEN_WEEKDAYS), "start": "09:00", "end": "19:00"}})
    # seed barbers
    if await db.barbers.count_documents({}) == 0:
        await db.barbers.insert_many([dict(b) for b in DEFAULT_BARBERS])
    # seed admin
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_pw = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({"name": "Studio01 Admin", "email": admin_email,
                                   "phone": "", "password_hash": hash_password(admin_pw),
                                   "role": "admin", "created_at": datetime.now(timezone.utc).isoformat()})
    elif not verify_password(admin_pw, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_pw), "role": "admin"}})

@app.on_event("shutdown")
async def shutdown():
    client.close()
