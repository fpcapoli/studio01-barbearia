"""Tests for PATCH /api/appointments/{id}/reschedule"""
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to frontend env file
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"

ADMIN_EMAIL = "filipe.capoli@gmail.com"
ADMIN_PW = "Studio01Admin"


def _next_weekday(target_weekday: int, offset_days: int = 7) -> str:
    """Returns YYYY-MM-DD for the next date with weekday==target (Mon=0) at least offset_days ahead."""
    d = date.today() + timedelta(days=offset_days)
    while d.weekday() != target_weekday:
        d += timedelta(days=1)
    return d.strftime("%Y-%m-%d")


def _next_open_date(offset_days: int = 7) -> str:
    d = date.today() + timedelta(days=offset_days)
    while d.weekday() not in {1, 2, 3, 4, 5}:
        d += timedelta(days=1)
    return d.strftime("%Y-%m-%d")


def _next_sunday() -> str:
    return _next_weekday(6, 1)


@pytest.fixture(scope="module")
def session_a():
    s = requests.Session()
    email = f"test_reschedule_a_{uuid.uuid4().hex[:8]}@test.com"
    r = s.post(f"{API}/auth/register", json={
        "name": "RescheduleA", "email": email, "phone": "11999990001", "password": "pass1234"
    })
    assert r.status_code == 200, r.text
    s.email = email
    return s


@pytest.fixture(scope="module")
def session_b():
    s = requests.Session()
    email = f"test_reschedule_b_{uuid.uuid4().hex[:8]}@test.com"
    r = s.post(f"{API}/auth/register", json={
        "name": "RescheduleB", "email": email, "phone": "11999990002", "password": "pass1234"
    })
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def barbers(admin_session):
    r = admin_session.get(f"{API}/barbers")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    return data


def _create_apt(session, barber_id, date_str, time_str, service_ids=None):
    r = session.post(f"{API}/appointments", json={
        "barber_id": barber_id, "date": date_str, "time": time_str,
        "service_ids": service_ids or ["corte_simples"],
    })
    return r


class TestReschedule:
    def test_happy_path_updates_date_time_and_availability(self, session_a, barbers):
        barber_id = barbers[0]["id"]
        d1 = _next_open_date(7)
        d2 = _next_open_date(14)
        # Create appointment
        r = _create_apt(session_a, barber_id, d1, "10:20")
        assert r.status_code == 200, r.text
        apt = r.json()
        apt_id = apt["id"]

        # Verify slot is booked
        av = session_a.get(f"{API}/availability", params={"date": d1, "barber_id": barber_id}).json()
        s_old = next(s for s in av["slots"] if s["time"] == "10:20")
        assert s_old["status"] == "booked"

        # Reschedule
        r = session_a.patch(f"{API}/appointments/{apt_id}/reschedule",
                            json={"date": d2, "time": "11:00"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["date"] == d2 and body["time"] == "11:00"

        # Verify GET /appointments/me reflects new date/time, same barber
        me = session_a.get(f"{API}/appointments/me").json()
        updated = next(a for a in me if a["id"] == apt_id)
        assert updated["date"] == d2
        assert updated["time"] == "11:00"
        assert updated["barber_id"] == barber_id
        assert updated["reminder_sent"] is False

        # Old slot becomes available again
        av_old = session_a.get(f"{API}/availability", params={"date": d1, "barber_id": barber_id}).json()
        s_old2 = next(s for s in av_old["slots"] if s["time"] == "10:20")
        assert s_old2["status"] == "available"

        # New slot is booked
        av_new = session_a.get(f"{API}/availability", params={"date": d2, "barber_id": barber_id}).json()
        s_new = next(s for s in av_new["slots"] if s["time"] == "11:00")
        assert s_new["status"] == "booked"

        # cleanup
        session_a.patch(f"{API}/appointments/{apt_id}/cancel")

    def test_reject_other_users_apt_404(self, session_a, session_b, barbers):
        barber_id = barbers[0]["id"]
        d1 = _next_open_date(21)
        r = _create_apt(session_a, barber_id, d1, "13:00")
        assert r.status_code == 200
        apt_id = r.json()["id"]
        # Session B tries to reschedule A's apt
        r2 = session_b.patch(f"{API}/appointments/{apt_id}/reschedule",
                             json={"date": _next_open_date(28), "time": "13:40"})
        assert r2.status_code == 404
        session_a.patch(f"{API}/appointments/{apt_id}/cancel")

    def test_reject_cancelled_apt_400(self, session_a, barbers):
        barber_id = barbers[0]["id"]
        d1 = _next_open_date(21)
        r = _create_apt(session_a, barber_id, d1, "14:20")
        apt_id = r.json()["id"]
        session_a.patch(f"{API}/appointments/{apt_id}/cancel")
        r2 = session_a.patch(f"{API}/appointments/{apt_id}/reschedule",
                             json={"date": _next_open_date(28), "time": "15:00"})
        assert r2.status_code == 400

    def test_reject_closed_day_sunday_400(self, session_a, barbers):
        barber_id = barbers[0]["id"]
        d1 = _next_open_date(21)
        r = _create_apt(session_a, barber_id, d1, "15:40")
        apt_id = r.json()["id"]
        sunday = _next_weekday(6, 1)
        r2 = session_a.patch(f"{API}/appointments/{apt_id}/reschedule",
                             json={"date": sunday, "time": "10:20"})
        assert r2.status_code == 400
        # Monday
        monday = _next_weekday(0, 1)
        r3 = session_a.patch(f"{API}/appointments/{apt_id}/reschedule",
                             json={"date": monday, "time": "10:20"})
        assert r3.status_code == 400
        session_a.patch(f"{API}/appointments/{apt_id}/cancel")

    def test_reject_invalid_time_400(self, session_a, barbers):
        barber_id = barbers[0]["id"]
        d1 = _next_open_date(21)
        r = _create_apt(session_a, barber_id, d1, "16:20")
        apt_id = r.json()["id"]
        r2 = session_a.patch(f"{API}/appointments/{apt_id}/reschedule",
                             json={"date": _next_open_date(28), "time": "12:00"})
        assert r2.status_code == 400
        session_a.patch(f"{API}/appointments/{apt_id}/cancel")

    def test_reject_past_date_400(self, session_a, barbers):
        barber_id = barbers[0]["id"]
        d1 = _next_open_date(21)
        r = _create_apt(session_a, barber_id, d1, "17:00")
        apt_id = r.json()["id"]
        # Pick a past open date
        past = date.today() - timedelta(days=7)
        while past.weekday() not in {1, 2, 3, 4, 5}:
            past -= timedelta(days=1)
        r2 = session_a.patch(f"{API}/appointments/{apt_id}/reschedule",
                             json={"date": past.strftime("%Y-%m-%d"), "time": "10:20"})
        assert r2.status_code == 400
        session_a.patch(f"{API}/appointments/{apt_id}/cancel")

    def test_reject_slot_taken_by_another_apt_409(self, session_a, session_b, barbers):
        barber_id = barbers[0]["id"]
        d_future = _next_open_date(35)
        # B takes the slot first
        rb = _create_apt(session_b, barber_id, d_future, "09:40")
        assert rb.status_code == 200
        b_id = rb.json()["id"]
        # A has an appointment to reschedule
        ra = _create_apt(session_a, barber_id, d_future, "10:20")
        assert ra.status_code == 200
        a_id = ra.json()["id"]
        # A tries to move to B's slot
        r2 = session_a.patch(f"{API}/appointments/{a_id}/reschedule",
                             json={"date": d_future, "time": "09:40"})
        assert r2.status_code == 409
        session_a.patch(f"{API}/appointments/{a_id}/cancel")
        session_b.patch(f"{API}/appointments/{b_id}/cancel")

    def test_reject_admin_blocked_slot_409(self, session_a, admin_session, barbers):
        barber_id = barbers[0]["id"]
        d_future = _next_open_date(42)
        ra = _create_apt(session_a, barber_id, d_future, "11:40")
        assert ra.status_code == 200
        a_id = ra.json()["id"]
        # Admin blocks another slot
        block_time = "13:40"
        bk = admin_session.post(f"{API}/admin/blocks",
                                json={"barber_id": barber_id, "date": d_future, "time": block_time})
        assert bk.status_code == 200
        r2 = session_a.patch(f"{API}/appointments/{a_id}/reschedule",
                             json={"date": d_future, "time": block_time})
        assert r2.status_code == 409
        # cleanup block (toggle)
        admin_session.post(f"{API}/admin/blocks",
                           json={"barber_id": barber_id, "date": d_future, "time": block_time})
        session_a.patch(f"{API}/appointments/{a_id}/cancel")

    def test_barber_unchanged_after_reschedule(self, session_a, barbers):
        if len(barbers) < 2:
            pytest.skip("Need >=2 barbers")
        barber_id = barbers[1]["id"]
        d1 = _next_open_date(49)
        r = _create_apt(session_a, barber_id, d1, "15:00")
        apt_id = r.json()["id"]
        r2 = session_a.patch(f"{API}/appointments/{apt_id}/reschedule",
                             json={"date": _next_open_date(56), "time": "15:40"})
        assert r2.status_code == 200
        me = session_a.get(f"{API}/appointments/me").json()
        updated = next(a for a in me if a["id"] == apt_id)
        assert updated["barber_id"] == barber_id
        session_a.patch(f"{API}/appointments/{apt_id}/cancel")
