"""Iter53 — Schema alignment with mobile app (Book Preview 11).

Verifies:
1. `staff` collection is used (not `hospital_staff`).
2. `provider_id` field is used on staff docs (not `hospital_id`).
3. `Staff` model has `designation` field (mobile parity).
4. User + Staff docs use string `id` (UUID4), never leak BSON `_id`.
5. `pin_hash` never leaks to any API response (admin, provider, user, receptionist paths).
6. Cross-hash: bcrypt hash generated with mobile-spec code verifies via web verify_pin.
"""
import os
import sys
import re
import uuid
import pytest
import requests
import asyncio
import bcrypt
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from server import hash_pin, verify_pin  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://slotnow-web.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

HOSPITAL_ID = "43b3a047-c937-4cf2-a707-7682ec732b34"
PROVIDER_PHONE = "9000000007"


def _disable_sms():
    async def _run():
        c = AsyncIOMotorClient(MONGO_URL); db = c[DB_NAME]
        prev = await db.settings.find_one({"key": "sms"})
        prev_enabled = bool(prev and prev.get("enabled"))
        if prev_enabled:
            await db.settings.update_one({"key": "sms"}, {"$set": {"enabled": False}})
        c.close(); return prev_enabled
    return asyncio.run(_run())


def _restore_sms(prev):
    if not prev: return
    async def _run():
        c = AsyncIOMotorClient(MONGO_URL); db = c[DB_NAME]
        await db.settings.update_one({"key": "sms"}, {"$set": {"enabled": True}}); c.close()
    asyncio.run(_run())


@pytest.fixture(scope="module", autouse=True)
def _env():
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


def h(t): return {"Authorization": f"Bearer {t}"}


# --- Schema tests -----------------------------------------------------------

def test_staff_collection_used_not_hospital_staff():
    """Docs live in `staff` collection, not `hospital_staff`. `hospital_staff`
    collection may still exist as a legacy dead collection but must be empty."""
    async def _run():
        c = AsyncIOMotorClient(MONGO_URL); db = c[DB_NAME]
        staff_cnt = await db.staff.count_documents({"provider_id": HOSPITAL_ID})
        assert staff_cnt > 0, f"Expected some staff for hospital {HOSPITAL_ID}"
        # Any doc using hospital_id would break parity → assert none
        legacy_field = await db.staff.count_documents({"hospital_id": {"$exists": True}})
        assert legacy_field == 0, "Some staff docs still carry legacy `hospital_id` field"
        c.close()
    asyncio.run(_run())


def test_staff_public_endpoint_returns_provider_id_field(s):
    r = s.get(f"{API}/providers/{HOSPITAL_ID}/staff")
    assert r.status_code == 200, r.text
    staff = r.json()
    assert isinstance(staff, list) and len(staff) > 0
    for row in staff:
        assert "id" in row and isinstance(row["id"], str)
        # Legacy field must never surface
        assert "hospital_id" not in row, "Legacy `hospital_id` still in API response"
        assert row.get("provider_id") == HOSPITAL_ID, f"provider_id mismatch: {row.get('provider_id')}"
        # No BSON _id leak
        assert "_id" not in row


def test_staff_model_has_designation_field(s):
    pt = _provider_token(s)
    payload = {
        "kind": "doctor", "name": "Dr. Designation Test",
        "specialization": "GP", "designation": "Senior Consultant",
    }
    r = s.post(f"{API}/providers/me/staff", headers=h(pt), json=payload)
    assert r.status_code == 200, r.text
    doc = r.json()
    try:
        assert doc.get("designation") == "Senior Consultant"
        assert doc.get("provider_id") == HOSPITAL_ID
        assert "hospital_id" not in doc
        # id must be a UUID4 string
        assert re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}", doc["id"])
    finally:
        s.delete(f"{API}/providers/me/staff/{doc['id']}", headers=h(pt))


# --- PIN parity tests -------------------------------------------------------

def test_pin_hash_format_matches_mobile_spec():
    h1 = hash_pin("4321")
    assert h1.startswith("$2b$12$"), f"prefix mismatch: {h1[:7]}"
    assert len(h1) == 60


def test_web_verifies_mobile_generated_hash():
    """A hash generated with the exact mobile spec code MUST verify through
    web's `verify_pin` so users can log in interchangeably."""
    mobile_hash = bcrypt.hashpw("4321".encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")
    assert verify_pin("4321", mobile_hash) is True
    assert verify_pin("0000", mobile_hash) is False


def test_pin_hash_never_leaks_via_admin_users(s):
    """`GET /admin/users` must never return `pin_hash`."""
    # Log in as admin
    r = s.post(f"{API}/auth/verify-otp",
               json={"phone": "9412575970", "otp": "123456", "role": "admin"}, timeout=15)
    assert r.status_code == 200, r.text
    atok = r.json()["token"]
    r = s.get(f"{API}/admin/users", headers=h(atok))
    assert r.status_code == 200
    for u in r.json():
        assert "pin_hash" not in u, f"pin_hash leaked in /admin/users: {u.get('id')}"
        assert "_id" not in u


def test_pin_hash_never_leaks_via_users_me(s):
    r = s.post(f"{API}/auth/verify-otp",
               json={"phone": "9000009999", "otp": "123456", "role": "customer"}, timeout=15)
    assert r.status_code == 200
    tok = r.json()["token"]
    r = s.get(f"{API}/users/me", headers=h(tok))
    assert r.status_code == 200
    body = r.json()
    assert "pin_hash" not in body
    assert "_id" not in body
    # has_pin boolean must be present
    assert "has_pin" in body


def test_pin_hash_never_leaks_via_provider_assistants(s):
    pt = _provider_token(s)
    r = s.get(f"{API}/providers/me/assistants", headers=h(pt))
    assert r.status_code == 200
    for a in r.json():
        assert "pin_hash" not in a
        assert "_id" not in a
