"""Iter51 — `/assistant/queue/next` must advance walk-ins tagged to the doctor.

Bug reported by user: When focused on Dr. Rahul Sharma with visible patients in
the queue (which were walk-ins), clicking "Call next" returned
`{ok:false,reason:"queue empty"}` because the query filtered `is_walkin:False`.
Since hospital walk-ins are a normal part of a doctor's live queue, that filter
was wrong. Fix removed it. This test locks the behaviour.
"""
import os
import sys
import uuid
import pytest
import requests
import asyncio
from datetime import datetime, timezone, date
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://slotnow-web.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

HOSPITAL_ID = "43b3a047-c937-4cf2-a707-7682ec732b34"
ASSISTANT_10 = "9000039917"


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


def _cleanup():
    async def _run():
        c = AsyncIOMotorClient(MONGO_URL); db = c[DB_NAME]
        await db.users.delete_many({
            "phone": {"$in": [ASSISTANT_10, "91" + ASSISTANT_10]},
            "role": "receptionist",
        })
        await db.bookings.delete_many({"customer_name": {"$regex": "^iter51-"}})
        c.close()
    asyncio.run(_run())


@pytest.fixture(scope="module", autouse=True)
def _env():
    prev = _disable_sms(); _cleanup()
    yield
    _cleanup(); _restore_sms(prev)


@pytest.fixture(scope="module")
def s():
    return requests.Session()


def h(t): return {"Authorization": f"Bearer {t}"}


def _login_assistant(session):
    async def _seed():
        c = AsyncIOMotorClient(MONGO_URL); db = c[DB_NAME]
        staff = await db.staff.find(
            {"provider_id": HOSPITAL_ID, "active": True}, {"_id": 0},
        ).sort("created_at", 1).to_list(50)
        ids = [x["id"] for x in staff][:3]
        uid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": uid, "phone": "91" + ASSISTANT_10, "role": "receptionist",
            "linked_provider_id": HOSPITAL_ID, "is_blocked": False, "language": "en",
            "assigned_staff_ids": ids, "has_pin": False,
            "created_at": datetime.now(timezone.utc),
        })
        c.close(); return uid, ids
    uid, ids = asyncio.run(_seed())
    r = session.post(f"{API}/auth/verify-otp",
                     json={"phone": ASSISTANT_10, "otp": "123456", "role": "receptionist"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"], ids


def test_assistant_queue_next_advances_walkins(s):
    tok, staff_ids = _login_assistant(s)
    staff_id = staff_ids[0]

    # Create two walk-ins tagged with this staff → should be advanceable
    r1 = s.post(f"{API}/queue/walkin", headers=h(tok),
                json={"name": "iter51-walkin-A", "phone": "", "staff_id": staff_id})
    assert r1.status_code == 200, r1.text
    tok_a = r1.json()["token_number"]

    r2 = s.post(f"{API}/queue/walkin", headers=h(tok),
                json={"name": "iter51-walkin-B", "phone": "", "staff_id": staff_id})
    assert r2.status_code == 200

    # 1) Call next — should complete the earliest (token A), not return empty
    r = s.post(f"{API}/assistant/queue/next?staff_id={staff_id}", headers=h(tok))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True, f"expected ok:True, got {body}"
    assert body.get("completed_token") == tok_a

    # 2) Second call → completes walk-in B
    r = s.post(f"{API}/assistant/queue/next?staff_id={staff_id}", headers=h(tok))
    assert r.status_code == 200
    assert r.json().get("ok") is True

    # 3) Now the queue is genuinely empty → ok:False
    r = s.post(f"{API}/assistant/queue/next?staff_id={staff_id}", headers=h(tok))
    assert r.status_code == 200
    assert r.json().get("ok") is False


def test_assistant_queue_next_still_403_for_unassigned_staff(s):
    """Sanity: authorisation check on staff_id is unchanged."""
    tok, staff_ids = _login_assistant(s)
    async def _extra():
        c = AsyncIOMotorClient(MONGO_URL); db = c[DB_NAME]
        row = await db.staff.find_one(
            {"provider_id": HOSPITAL_ID, "id": {"$nin": staff_ids}}, {"_id": 0}
        )
        c.close(); return row
    extra = asyncio.run(_extra())
    if extra:
        r = s.post(f"{API}/assistant/queue/next?staff_id={extra['id']}", headers=h(tok))
        assert r.status_code == 403
