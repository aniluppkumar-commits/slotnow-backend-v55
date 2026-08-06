"""Iter48 — Hospital detail page + walk-in staff selection + phone visibility.

Fixes verified here:
1. `GET /providers/{id}` now returns `staff` (hospital sub-doctors + sub-services)
   and `has_availability` is TRUE when the hospital has any per-staff rules
   (previously false-negative for hospitals since only provider-wide rules were counted).
2. `WalkinCreate.staff_id` is honoured: hospital walk-ins attach `staff_name`,
   `staff_kind` and get an independent per-staff token counter.
3. `HospitalStaff.phone` is round-tripped so customers can call the doctor / lab
   directly from the public page.
"""
import os
import sys
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://slotnow-web.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

PROVIDER_PHONE = "9000000007"  # seed hospital provider
HOSPITAL_ID = "43b3a047-c937-4cf2-a707-7682ec732b34"


def _disable_sms():
    async def _run():
        c = AsyncIOMotorClient(MONGO_URL)
        db = c[DB_NAME]
        prev = await db.settings.find_one({"key": "sms"})
        prev_enabled = bool(prev and prev.get("enabled"))
        if prev_enabled:
            await db.settings.update_one({"key": "sms"}, {"$set": {"enabled": False}})
        c.close()
        return prev_enabled
    return asyncio.run(_run())


def _restore_sms(prev):
    if not prev:
        return
    async def _run():
        c = AsyncIOMotorClient(MONGO_URL)
        db = c[DB_NAME]
        await db.settings.update_one({"key": "sms"}, {"$set": {"enabled": True}})
        c.close()
    asyncio.run(_run())


@pytest.fixture(scope="module", autouse=True)
def _sms_env():
    prev = _disable_sms()
    yield
    _restore_sms(prev)


@pytest.fixture(scope="module")
def s():
    return requests.Session()


def _provider_token(session):
    r = session.post(f"{API}/auth/verify-otp",
                     json={"phone": PROVIDER_PHONE, "otp": "123456", "role": "provider"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


def test_provider_detail_response_shape_for_hospital(s):
    r = s.get(f"{API}/providers/{HOSPITAL_ID}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["provider"]["provider_type"] == "hospital"
    # `staff` must be present and non-empty for a hospital that has doctors
    assert isinstance(body.get("staff"), list)
    assert len(body["staff"]) > 0, "Hospital detail must include sub-doctors/services"
    # `has_availability` must count per-staff rules — hospitals rarely have
    # provider-wide schedules, so counting only those would falsely mark them "unavailable"
    assert body.get("has_availability") is True


def test_provider_detail_non_hospital_still_works(s):
    # A non-hospital provider (e.g. seed salon Priya Beauty)
    # Just pick the first non-hospital provider from the public /providers list.
    r = s.get(f"{API}/providers")
    assert r.status_code == 200
    non_hosp = next(
        (p for p in r.json() if (p.get("provider_type") or "") != "hospital"),
        None,
    )
    assert non_hosp is not None
    detail = s.get(f"{API}/providers/{non_hosp['id']}").json()
    # `staff` must exist but be empty for non-hospitals
    assert detail.get("staff") == []


def test_hospital_staff_phone_round_trip(s):
    """Provider adds a doctor with a phone → GET /providers/{id} returns it."""
    pt = _provider_token(s)
    payload = {
        "kind": "doctor",
        "name": "Dr. Phone Test",
        "specialization": "Dermatologist",
        "phone": "+91 98765 43210",
        "photo": None,
    }
    r = s.post(f"{API}/providers/me/staff", headers=h(pt), json=payload)
    assert r.status_code == 200, r.text
    created = r.json()
    try:
        assert created["phone"] == "+91 98765 43210"
        # Also visible via public detail endpoint
        detail = s.get(f"{API}/providers/{HOSPITAL_ID}").json()
        target = next((s2 for s2 in detail["staff"] if s2["id"] == created["id"]), None)
        assert target is not None
        assert target["phone"] == "+91 98765 43210"
    finally:
        s.delete(f"{API}/providers/me/staff/{created['id']}", headers=h(pt))


def test_hospital_walkin_attaches_staff_name(s):
    """Assistant creates a hospital walk-in with staff_id →
    booking is stored with staff_name + staff_kind + independent token."""
    pt = _provider_token(s)
    # Grab a doctor from the hospital
    detail = s.get(f"{API}/providers/{HOSPITAL_ID}").json()
    doctor = next((x for x in detail["staff"] if x["kind"] == "doctor"), None)
    assert doctor is not None

    # Seed a receptionist linked to this hospital
    async def _seed_assistant():
        c = AsyncIOMotorClient(MONGO_URL)
        db = c[DB_NAME]
        import uuid
        from datetime import datetime, timezone
        uid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": uid,
            "phone": "919000019917",
            "role": "receptionist",
            "linked_provider_id": HOSPITAL_ID,
            "is_blocked": False,
            "language": "en",
            "assigned_staff_ids": [],
            "has_pin": False,
            "created_at": datetime.now(timezone.utc),
        })
        c.close()
        return uid
    uid = asyncio.run(_seed_assistant())

    try:
        # Assistant login (10-digit variant)
        r = s.post(f"{API}/auth/verify-otp",
                   json={"phone": "9000019917", "otp": "123456", "role": "receptionist"})
        assert r.status_code == 200, r.text
        atok = r.json()["token"]

        # Create walk-in without staff_id → allowed (staff_name empty, uses provider-wide token)
        r = s.post(f"{API}/queue/walkin", headers=h(atok),
                   json={"name": "Walkin NoStaff", "phone": ""})
        assert r.status_code == 200, r.text
        assert not r.json().get("staff_name")

        # Create walk-in WITH staff_id → staff_name populated, per-staff token counter
        r = s.post(f"{API}/queue/walkin", headers=h(atok),
                   json={"name": "Walkin WithDoctor", "phone": "", "staff_id": doctor["id"]})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("staff_id") == doctor["id"]
        assert body.get("staff_name") == doctor["name"]
        assert body.get("staff_kind") == "doctor"
        assert body.get("token_number", 0) >= 1

        # Second walk-in for same doctor increments the per-doctor token
        r2 = s.post(f"{API}/queue/walkin", headers=h(atok),
                    json={"name": "Walkin WithDoctor2", "phone": "", "staff_id": doctor["id"]})
        assert r2.status_code == 200
        assert r2.json()["token_number"] == body["token_number"] + 1

        # Invalid staff_id → 400
        r3 = s.post(f"{API}/queue/walkin", headers=h(atok),
                    json={"name": "Walkin Bad", "phone": "", "staff_id": "does-not-exist"})
        assert r3.status_code == 400
    finally:
        # Cleanup
        async def _rm():
            c = AsyncIOMotorClient(MONGO_URL)
            db = c[DB_NAME]
            await db.users.delete_one({"id": uid})
            # Also purge test walk-ins by name
            await db.bookings.delete_many({
                "customer_name": {"$in": ["Walkin NoStaff", "Walkin WithDoctor", "Walkin WithDoctor2", "Walkin Bad"]},
                "is_walkin": True,
            })
            c.close()
        asyncio.run(_rm())
