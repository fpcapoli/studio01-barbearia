"""Tests for Gallery endpoints (admin upload, public read, admin delete)."""
import os
import io
import struct
import zlib
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://corte-agendamento-17.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "filipe.capoli@gmail.com"
ADMIN_PASSWORD = "Studio01Admin"


def _png_bytes():
    """Minimal valid 1x1 PNG."""
    sig = b"\x89PNG\r\n\x1a\n"
    def chunk(ctype, data):
        return struct.pack(">I", len(data)) + ctype + data + struct.pack(">I", zlib.crc32(ctype + data) & 0xffffffff)
    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    raw = b"\x00\xff\x00\x00"  # filter + RGB
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def client_session():
    s = requests.Session()
    email = "TEST_gallery_client@teste.com"
    s.post(f"{BASE_URL}/api/auth/register", json={
        "name": "Teste Gallery", "email": email, "phone": "11999990001", "password": "cliente123"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "cliente123"})
    assert r.status_code == 200
    return s


class TestGallery:
    created_ids = []

    def test_gallery_public_get(self):
        r = requests.get(f"{BASE_URL}/api/gallery")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_upload_anon_401(self):
        files = {"file": ("x.png", _png_bytes(), "image/png")}
        r = requests.post(f"{BASE_URL}/api/admin/gallery", files=files, data={"caption": "x"})
        assert r.status_code == 401

    def test_admin_upload_client_403(self, client_session):
        files = {"file": ("x.png", _png_bytes(), "image/png")}
        r = client_session.post(f"{BASE_URL}/api/admin/gallery", files=files, data={"caption": "x"})
        assert r.status_code == 403

    def test_admin_upload_non_image_400(self, admin_session):
        files = {"file": ("x.txt", b"hello world not an image", "text/plain")}
        r = admin_session.post(f"{BASE_URL}/api/admin/gallery", files=files, data={"caption": "x"})
        assert r.status_code == 400

    def test_admin_upload_success(self, admin_session):
        files = {"file": ("c.png", _png_bytes(), "image/png")}
        r = admin_session.post(f"{BASE_URL}/api/admin/gallery", files=files,
                               data={"caption": "TEST_corte1"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data and "url" in data
        assert data["caption"] == "TEST_corte1"
        assert data["url"].startswith("/api/files/")
        TestGallery.created_ids.append(data["id"])

        # Verify visible in public gallery
        pub = requests.get(f"{BASE_URL}/api/gallery").json()
        assert any(it["id"] == data["id"] for it in pub)

    def test_admin_delete_unknown_404(self, admin_session):
        r = admin_session.delete(f"{BASE_URL}/api/admin/gallery/nonexistent_xyz_123")
        assert r.status_code == 404

    def test_admin_delete_anon_401(self):
        r = requests.delete(f"{BASE_URL}/api/admin/gallery/anything")
        assert r.status_code == 401

    def test_admin_delete_success(self, admin_session):
        # Ensure at least one item exists
        if not TestGallery.created_ids:
            files = {"file": ("c.png", _png_bytes(), "image/png")}
            r = admin_session.post(f"{BASE_URL}/api/admin/gallery", files=files, data={"caption": "TEST_del"})
            TestGallery.created_ids.append(r.json()["id"])
        item_id = TestGallery.created_ids.pop(0)
        r = admin_session.delete(f"{BASE_URL}/api/admin/gallery/{item_id}")
        assert r.status_code == 200
        pub = requests.get(f"{BASE_URL}/api/gallery").json()
        assert not any(it["id"] == item_id for it in pub)


def teardown_module(module):
    """Cleanup any remaining TEST_ gallery items."""
    s = requests.Session()
    s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    items = requests.get(f"{BASE_URL}/api/gallery").json()
    for it in items:
        if (it.get("caption") or "").startswith("TEST_") or it["id"] in TestGallery.created_ids:
            s.delete(f"{BASE_URL}/api/admin/gallery/{it['id']}")
