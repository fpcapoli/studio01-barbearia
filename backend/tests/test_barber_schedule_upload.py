"""Tests for per-barber schedule, admin photo upload, and public file serving."""
import io
import os
import time
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://corte-agendamento-17.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "filipe.capoli@gmail.com"
ADMIN_PASSWORD = "Studio01Admin"

SLOTS = ["09:00","09:40","10:20","11:00","11:40","13:00","13:40",
         "14:20","15:00","15:40","16:20","17:00","17:40","18:20"]

# Minimal valid 1x1 PNG
PNG_BYTES = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
             b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0"
             b"\x00\x00\x00\x03\x00\x01\xa6\xe4\x8c\x1f\x00\x00\x00\x00IEND\xaeB`\x82")


def _next_weekday(target_wd: int) -> str:
    """target_wd uses python Monday=0; we want Mon=0..Sun=6. Return next date with that weekday (not today)."""
    today = date.today()
    for i in range(1, 15):
        d = today + timedelta(days=i)
        if d.weekday() == target_wd:
            return d.strftime("%Y-%m-%d")
    raise RuntimeError("no date")


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def client_session():
    s = requests.Session()
    import uuid
    email = f"TEST_sched_{int(time.time())}_{uuid.uuid4().hex[:6]}@test.com"
    r = s.post(f"{API}/auth/register", json={"name": "Sched Tester", "email": email,
                                             "phone": "11999999999", "password": "test1234"})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def barbers(admin_session):
    r = admin_session.get(f"{API}/barbers")
    assert r.status_code == 200
    return r.json()


# ---------------- Barber schedule validation ----------------

class TestBarberCRUDValidation:
    def test_create_barber_zero_days_returns_400(self, admin_session):
        r = admin_session.post(f"{API}/admin/barbers", json={
            "name": "TEST_nodays", "specialty": "x", "avatar": "",
            "days": [], "start": "09:00", "end": "19:00"})
        assert r.status_code == 400
        assert "dia" in r.json()["detail"].lower()

    def test_create_barber_invalid_hours_returns_400(self, admin_session):
        r = admin_session.post(f"{API}/admin/barbers", json={
            "name": "TEST_badhrs", "specialty": "x", "avatar": "",
            "days": [1, 2], "start": "19:00", "end": "09:00"})
        assert r.status_code == 400


# ---------------- Per-barber schedule in availability ----------------

class TestAvailabilityRespectsSchedule:
    def test_update_barber_schedule_then_availability(self, admin_session, barbers):
        # Restrict first barber to Tue (weekday=1) only, 09:00-11:00
        b = barbers[0]
        upd = admin_session.put(f"{API}/admin/barbers/{b['id']}", json={
            "name": b["name"], "specialty": b.get("specialty", ""), "avatar": b.get("avatar", ""),
            "days": [1], "start": "09:00", "end": "11:00"})
        assert upd.status_code == 200
        try:
            # Query a Wednesday (weekday=2) with this barber -> open:false
            wed = _next_weekday(2)
            r = admin_session.get(f"{API}/availability", params={"date": wed, "barber_id": b["id"]})
            assert r.status_code == 200
            data = r.json()
            assert data["open"] is False
            assert "barbeiro" in data["message"].lower()

            # Query a Tuesday (weekday=1) -> open:true, slots after 11:00 should be status=off
            tue = _next_weekday(1)
            r = admin_session.get(f"{API}/availability", params={"date": tue, "barber_id": b["id"]})
            assert r.status_code == 200
            data = r.json()
            assert data["open"] is True
            by_slot = {s["time"]: s["status"] for s in data["slots"]}
            # 11:00 slot: 11:00+40=11:40 > 11:00 end -> off
            assert by_slot["11:00"] == "off"
            assert by_slot["13:00"] == "off"
            # 09:00 slot: 09:00+40=09:40 <= 11:00 -> available (or past/booked)
            assert by_slot["09:00"] in ("available", "past", "booked")
        finally:
            # restore
            admin_session.put(f"{API}/admin/barbers/{b['id']}", json={
                "name": b["name"], "specialty": b.get("specialty", ""), "avatar": b.get("avatar", ""),
                "days": [1, 2, 3, 4, 5], "start": "09:00", "end": "19:00"})

    def test_any_barber_counts_only_on_duty(self, admin_session, barbers):
        # Make barber[0] off on Thursday (weekday=3) with limited hours
        b0 = barbers[0]
        admin_session.put(f"{API}/admin/barbers/{b0['id']}", json={
            "name": b0["name"], "specialty": b0.get("specialty", ""), "avatar": b0.get("avatar", ""),
            "days": [1], "start": "09:00", "end": "19:00"})
        try:
            thu = _next_weekday(3)
            r = admin_session.get(f"{API}/availability", params={"date": thu, "barber_id": "any"})
            assert r.status_code == 200
            data = r.json()
            # Only other barber(s) on duty; if only one left, should still be open
            if len(barbers) > 1:
                assert data["open"] is True
            else:
                assert data["open"] is False
        finally:
            admin_session.put(f"{API}/admin/barbers/{b0['id']}", json={
                "name": b0["name"], "specialty": b0.get("specialty", ""), "avatar": b0.get("avatar", ""),
                "days": [1, 2, 3, 4, 5], "start": "09:00", "end": "19:00"})


# ---------------- Appointment creation respects schedule ----------------

class TestAppointmentRespectsSchedule:
    def test_create_at_off_hour_returns_400(self, admin_session, client_session, barbers):
        b = barbers[0]
        # Limit to 09:00-11:00 on Tuesday
        admin_session.put(f"{API}/admin/barbers/{b['id']}", json={
            "name": b["name"], "specialty": b.get("specialty", ""), "avatar": b.get("avatar", ""),
            "days": [1, 2, 3, 4, 5], "start": "09:00", "end": "11:00"})
        try:
            tue = _next_weekday(1)
            r = client_session.post(f"{API}/appointments", json={
                "barber_id": b["id"], "date": tue, "time": "15:00",
                "service_ids": ["barba"]})
            assert r.status_code == 400
            assert "horário" in r.json()["detail"].lower() or "atende" in r.json()["detail"].lower()
        finally:
            admin_session.put(f"{API}/admin/barbers/{b['id']}", json={
                "name": b["name"], "specialty": b.get("specialty", ""), "avatar": b.get("avatar", ""),
                "days": [1, 2, 3, 4, 5], "start": "09:00", "end": "19:00"})

    def test_any_barber_assigns_only_on_duty(self, admin_session, client_session, barbers):
        if len(barbers) < 2:
            pytest.skip("need >=2 barbers")
        b0, b1 = barbers[0], barbers[1]
        # Make b0 unavailable in afternoon
        admin_session.put(f"{API}/admin/barbers/{b0['id']}", json={
            "name": b0["name"], "specialty": b0.get("specialty", ""), "avatar": b0.get("avatar", ""),
            "days": [1, 2, 3, 4, 5], "start": "09:00", "end": "11:00"})
        try:
            tue = _next_weekday(1)
            r = client_session.post(f"{API}/appointments", json={
                "barber_id": "any", "date": tue, "time": "15:00",
                "service_ids": ["barba"]})
            # Should succeed and assign b1 (not b0 since b0 is off at 15:00)
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["barber_id"] == b1["id"]
            # cleanup
            client_session.patch(f"{API}/appointments/{data['id']}/cancel")
        finally:
            admin_session.put(f"{API}/admin/barbers/{b0['id']}", json={
                "name": b0["name"], "specialty": b0.get("specialty", ""), "avatar": b0.get("avatar", ""),
                "days": [1, 2, 3, 4, 5], "start": "09:00", "end": "19:00"})

    def test_reschedule_to_off_hour_returns_400(self, admin_session, client_session, barbers):
        b = barbers[0]
        tue = _next_weekday(1)
        # Create normal appointment at 09:00
        r = client_session.post(f"{API}/appointments", json={
            "barber_id": b["id"], "date": tue, "time": "09:00",
            "service_ids": ["barba"]})
        if r.status_code == 409:
            # slot taken, try 09:40
            r = client_session.post(f"{API}/appointments", json={
                "barber_id": b["id"], "date": tue, "time": "09:40",
                "service_ids": ["barba"]})
        assert r.status_code == 200, r.text
        apt_id = r.json()["id"]

        # Now restrict barber hours
        admin_session.put(f"{API}/admin/barbers/{b['id']}", json={
            "name": b["name"], "specialty": b.get("specialty", ""), "avatar": b.get("avatar", ""),
            "days": [1, 2, 3, 4, 5], "start": "09:00", "end": "11:00"})
        try:
            thu = _next_weekday(3)
            rr = client_session.patch(f"{API}/appointments/{apt_id}/reschedule",
                                      json={"date": thu, "time": "15:00"})
            assert rr.status_code == 400
        finally:
            admin_session.put(f"{API}/admin/barbers/{b['id']}", json={
                "name": b["name"], "specialty": b.get("specialty", ""), "avatar": b.get("avatar", ""),
                "days": [1, 2, 3, 4, 5], "start": "09:00", "end": "19:00"})
            client_session.patch(f"{API}/appointments/{apt_id}/cancel")


# ---------------- Admin photo upload + file serving ----------------

class TestUploadPhoto:
    def test_upload_requires_admin(self, client_session):
        files = {"file": ("x.png", io.BytesIO(PNG_BYTES), "image/png")}
        r = client_session.post(f"{API}/admin/upload-photo", files=files)
        assert r.status_code == 403

    def test_upload_rejects_non_image(self, admin_session):
        files = {"file": ("x.txt", io.BytesIO(b"hello"), "text/plain")}
        r = admin_session.post(f"{API}/admin/upload-photo", files=files)
        assert r.status_code == 400

    def test_upload_success_and_serve(self, admin_session):
        files = {"file": ("x.png", io.BytesIO(PNG_BYTES), "image/png")}
        r = admin_session.post(f"{API}/admin/upload-photo", files=files)
        assert r.status_code == 200, r.text
        url = r.json()["url"]
        assert url.startswith("/api/files/")
        # Public GET (no auth)
        r2 = requests.get(f"{BASE_URL}{url}")
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("image/")
        assert len(r2.content) == len(PNG_BYTES)


# ---------------- Cleanup fixture to restore defaults ----------------

@pytest.fixture(scope="module", autouse=True)
def restore_defaults(admin_session, barbers):
    yield
    # Restore barbers to defaults
    for b in barbers:
        name_default = "Capoli" if b["id"] == "capoli" else ("Novaes" if b["id"] == "novaes" else b["name"])
        admin_session.put(f"{API}/admin/barbers/{b['id']}", json={
            "name": name_default, "specialty": "Barbeiro", "avatar": "",
            "days": [1, 2, 3, 4, 5], "start": "09:00", "end": "19:00"})
    # Cancel TEST appointments by this test client user
    # Appointments created in tests already cancelled individually.
