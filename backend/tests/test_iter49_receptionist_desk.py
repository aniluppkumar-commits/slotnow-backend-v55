"""Iter49 — Receptionist desk enhancements: hospital totals + per-staff drill-in + date navigation.

Verifies:
1. `/assistant/queue/multi` returns hospital_total, hospital_active, hospital_completed,
   and per-staff active_count now INCLUDES walk-ins tagged with that staff_id.
2. New `/assistant/staff/{staff_id}/queue?date=` endpoint returns the full booking
   list (booked + walk-ins) for a single staff on any date, enriched.
3. `POST /queue/walkin?date=YYYY-MM-DD` accepts an arbitrary date so the assistant
   can create walk-ins for past/future days from the date-picker.
"""
import os
import sys
import pytest
import requests
import uuid
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://slotnow-web.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

PROVIDER_PHONE = "9000000007"  # seed hospital provider
HOSPITAL_ID = "43b3a047-c937-4cf2-a707-7682ec732b34"
ASSISTANT_PHONE_10 = "9000029917"  # fresh test assistant


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
            "phone": {"$in": [ASSISTANT_PHONE_10, "91" + ASSISTANT_PHONE_10]},
            "role": "receptionist",
        })
        await db.bookings.delete_many({
            "customer_name": {"$regex": "^iter49-"}, "is_walkin": True,
        })
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


def _provider_token(session):
    r = session.post(f"{API}/auth/verify-otp",
                     json={"phone": PROVIDER_PHONE, "otp": "123456", "role": "provider"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _assistant_token(session):
    """Seed a receptionist linked to HOSPITAL_ID, then log in."""
    async def _seed():
        c = AsyncIOMotorClient(MONGO_URL); db = c[DB_NAME]
        # Attach to first 3 hospital staff so /queue/multi returns them
        staff = await db.hospital_staff.find(
            {"hospital_id": HOSPITAL_ID, "active": True}, {"_id": 0, "id": 1},
        ).sort("created_at", 1).to_list(50)
        ids = [s["id"] for s in staff][:3]
        uid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": uid, "phone": "91" + ASSISTANT_PHONE_10, "role": "receptionist",
            "linked_provider_id": HOSPITAL_ID, "is_blocked": False, "language": "en",
            "assigned_staff_ids": ids, "has_pin": False,
            "created_at": datetime.now(timezone.utc),
        })
        c.close(); return uid, ids
    uid, ids = asyncio.run(_seed())
    r = session.post(f"{API}/auth/verify-otp",
                     json={"phone": ASSISTANT_PHONE_10, "otp": "123456", "role": "receptionist"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"], ids


def test_multi_queue_includes_hospital_totals(s):
    tok, staff_ids = _assistant_token(s)
    # Create a walk-in tagged with the first staff so we know active_count updates
    r = s.post(f"{API}/queue/walkin", headers=h(tok),
               json={"name": "iter49-multi-a", "phone": "", "staff_id": staff_ids[0]})
    assert r.status_code == 200, r.text

    r = s.get(f"{API}/assistant/queue/multi", headers=h(tok))
    assert r.status_code == 200, r.text
    data = r.json()
    assert "hospital_total" in data
    assert "hospital_active" in data
    assert "hospital_completed" in data
    assert data["hospital_total"] >= 1
    assert data["hospital_active"] >= 1
    # The staff's own tile should have active_count >= 1 (includes the walk-in)
    tile = next((t for t in data["staff"] if t["staff_id"] == staff_ids[0]), None)
    assert tile is not None
    assert tile["active_count"] >= 1


def test_per_staff_queue_endpoint(s):
    tok, staff_ids = _assistant_token(s)
    # Create two walk-ins tagged with staff_ids[0] and one with staff_ids[1] to keep them separate
    for i in range(2):
        r = s.post(f"{API}/queue/walkin", headers=h(tok),
                   json={"name": f"iter49-a-{i}", "phone": "", "staff_id": staff_ids[0]})
        assert r.status_code == 200
    r = s.post(f"{API}/queue/walkin", headers=h(tok),
               json={"name": "iter49-b-0", "phone": "", "staff_id": staff_ids[1]})
    assert r.status_code == 200

    # Drill-in endpoint
    r = s.get(f"{API}/assistant/staff/{staff_ids[0]}/queue", headers=h(tok))
    assert r.status_code == 200, r.text
    body = r.json()
    names = [b.get("customer_name") for b in body["items"]]
    assert any(n.startswith("iter49-a-") for n in names)
    assert not any(n == "iter49-b-0" for n in names), "cross-staff leak"
    assert body["active_count"] >= 2

    # Unauthorized staff id (belongs to hospital but not in assigned_staff_ids)
    async def _extra():
        c = AsyncIOMotorClient(MONGO_URL); db = c[DB_NAME]
        row = await db.hospital_staff.find_one(
            {"hospital_id": HOSPITAL_ID, "id": {"$nin": staff_ids}}, {"_id": 0}
        )
        c.close(); return row
    extra = asyncio.run(_extra())
    if extra:
        r = s.get(f"{API}/assistant/staff/{extra['id']}/queue", headers=h(tok))
        assert r.status_code == 403, r.text


def test_walkin_accepts_date_param(s):
    tok, staff_ids = _assistant_token(s)
    tomorrow = (datetime.now().date() + timedelta(days=1)).isoformat()
    r = s.post(
        f"{API}/queue/walkin?date={tomorrow}",
        headers=h(tok),
        json={"name": "iter49-future", "phone": "", "staff_id": staff_ids[0]},
    )
    assert r.status_code == 200, r.text
    assert r.json()["date"] == tomorrow

    # Multi-queue scoped to tomorrow should include this booking, but today's shouldn't
    r_today = s.get(f"{API}/assistant/queue/multi", headers=h(tok))
    r_tmr = s.get(f"{API}/assistant/queue/multi?date={tomorrow}", headers=h(tok))
    assert r_tmr.status_code == 200 and r_today.status_code == 200
    tmr_tile = next((t for t in r_tmr.json()["staff"] if t["staff_id"] == staff_ids[0]), None)
    assert tmr_tile and tmr_tile["active_count"] >= 1


def test_per_staff_queue_date_scoping(s):
    tok, staff_ids = _assistant_token(s)
    yesterday = (datetime.now().date() - timedelta(days=1)).isoformat()
    r = s.get(f"{API}/assistant/staff/{staff_ids[0]}/queue?date={yesterday}", headers=h(tok))
    assert r.status_code == 200
    # Yesterday shouldn't have any iter49-a-* rows created today
    assert not any((it.get("customer_name") or "").startswith("iter49-a-") for it in r.json()["items"])
