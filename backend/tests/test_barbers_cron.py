"""Tests for admin barber CRUD, cron reminder auth, and public barber list."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # fallback for backend-side tests
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip().rstrip('/')

ADMIN_EMAIL = "filipe.capoli@gmail.com"
ADMIN_PASSWORD = "Studio01Admin"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def client_session():
    s = requests.Session()
    email = "TEST_barber_client@teste.com"
    s.post(f"{BASE_URL}/api/auth/register",
           json={"name": "Test Client", "email": email, "phone": "11988887777",
                 "password": "cliente123"}, timeout=15)
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": email, "password": "cliente123"}, timeout=15)
    assert r.status_code == 200
    return s


# ---------- Public barbers ----------
def test_public_barbers_list():
    r = requests.get(f"{BASE_URL}/api/barbers", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 3
    for b in data:
        assert "id" in b and "name" in b
        assert "_id" not in b


# ---------- Admin CRUD ----------
def test_barber_crud_full_cycle(admin_session):
    # CREATE
    payload = {"name": "TEST_Barbeiro QA", "specialty": "QA Fade", "avatar": ""}
    r = admin_session.post(f"{BASE_URL}/api/admin/barbers", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    created = r.json()
    bid = created["id"]
    assert created["name"] == payload["name"]
    assert created["specialty"] == payload["specialty"]
    assert created["avatar"]  # default avatar applied

    # Verify in public listing
    r = requests.get(f"{BASE_URL}/api/barbers", timeout=15)
    assert any(b["id"] == bid for b in r.json())

    # UPDATE
    r = admin_session.put(f"{BASE_URL}/api/admin/barbers/{bid}",
                          json={"name": "TEST_Barbeiro QA2", "specialty": "QA2", "avatar": ""},
                          timeout=15)
    assert r.status_code == 200
    assert r.json()["name"] == "TEST_Barbeiro QA2"

    # Verify update persisted
    r = requests.get(f"{BASE_URL}/api/barbers", timeout=15)
    found = next((b for b in r.json() if b["id"] == bid), None)
    assert found and found["name"] == "TEST_Barbeiro QA2"

    # DELETE
    r = admin_session.delete(f"{BASE_URL}/api/admin/barbers/{bid}", timeout=15)
    assert r.status_code == 200
    assert r.json().get("ok") is True

    # verify removed
    r = requests.get(f"{BASE_URL}/api/barbers", timeout=15)
    assert not any(b["id"] == bid for b in r.json())


# ---------- Authorization: 403 for non-admin ----------
def test_admin_barbers_forbidden_for_client(client_session):
    r = client_session.post(f"{BASE_URL}/api/admin/barbers",
                            json={"name": "x", "specialty": "", "avatar": ""}, timeout=15)
    assert r.status_code == 403

    r = client_session.put(f"{BASE_URL}/api/admin/barbers/b1",
                           json={"name": "x", "specialty": "", "avatar": ""}, timeout=15)
    assert r.status_code == 403

    r = client_session.delete(f"{BASE_URL}/api/admin/barbers/b1", timeout=15)
    assert r.status_code == 403


def test_admin_barbers_unauth():
    r = requests.post(f"{BASE_URL}/api/admin/barbers",
                      json={"name": "x", "specialty": "", "avatar": ""}, timeout=15)
    assert r.status_code == 401


# ---------- Cron reminders auth ----------
def test_cron_reminders_no_auth():
    r = requests.post(f"{BASE_URL}/api/cron/reminders", timeout=15)
    assert r.status_code == 401


def test_cron_reminders_wrong_token():
    r = requests.post(f"{BASE_URL}/api/cron/reminders",
                      headers={"Authorization": "Bearer wrong-secret-xyz"}, timeout=15)
    assert r.status_code == 401


# ---------- Config open days ----------
def test_config_open_days():
    r = requests.get(f"{BASE_URL}/api/config", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["open_weekdays"] == [1, 2, 3, 4, 5]
    assert "Terça" in data["days_label"]
