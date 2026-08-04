"""Iter47 — Assistant login (phone format) + Assistant photo upload regression.

Root cause fixed:
- `create_assistant` used to store the phone raw and match by exact string on
  upsert. Frontend sometimes sent 10-digit and sometimes 12-digit variants,
  which created duplicate rows and left `linked_provider_id` unset on the
  wrong row → assistant login raised "Unauthorized. Ask your service
  provider to add you as an assistant." even though the mapping existed.
- Fix: normalize any input phone to 91XXXXXXXXXX before store; look up any
  existing receptionist record across all format variants.
- `verify_otp` lookup now also includes the 10-digit variant for the same reason.
- New optional `photo` on User + CreateAssistantRequest so the provider can
  upload an assistant profile photo shown on the assistant desk header.
"""
import os
import sys
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from server import normalize_indian_phone  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://slotnow-web.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

PROVIDER_PHONE = "9000000007"  # existing seed hospital provider (has profile)
ASSIST_A = "9000099101"
ASSIST_B = "9000099102"
ORPHAN_PHONE = "9000099099"


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


def _cleanup_assistants():
    async def _run():
        c = AsyncIOMotorClient(MONGO_URL)
        db = c[DB_NAME]
        await db.users.delete_many({
            "phone": {"$in": [ASSIST_A, "91" + ASSIST_A, ASSIST_B, "91" + ASSIST_B, ORPHAN_PHONE, "91" + ORPHAN_PHONE]},
            "role": "receptionist",
        })
        c.close()
    asyncio.run(_run())


@pytest.fixture(scope="module", autouse=True)
def _sms_env():
    prev = _disable_sms()
    _cleanup_assistants()
    yield
    _cleanup_assistants()
    _restore_sms(prev)


@pytest.fixture(scope="module")
def s():
    return requests.Session()


def _provider_token(session):
    r = session.post(f"{API}/auth/verify-otp", json={"phone": PROVIDER_PHONE, "otp": "123456", "role": "provider"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


def test_normalize_indian_phone_variants():
    assert normalize_indian_phone("9000009922") == "919000009922"
    assert normalize_indian_phone("919000009922") == "919000009922"
    assert normalize_indian_phone("09000009922") == "919000009922"
    assert normalize_indian_phone("+91 90000 09922") == "919000009922"


def test_create_assistant_10_digit_login_via_10_and_12_digit(s):
    pt = _provider_token(s)

    # A) Create with 10-digit + photo
    r = s.post(
        f"{API}/providers/me/assistants",
        headers=h(pt),
        json={"name": "Ravi Kumar", "phone": ASSIST_A, "designation": "Front Desk",
              "photo": "data:image/png;base64,iVBORw0KGgo="},
    )
    assert r.status_code == 200, r.text
    created = r.json()
    assert created["phone"] == "91" + ASSIST_A
    assert created["linked_provider_id"]
    assert created["photo"] == "data:image/png;base64,iVBORw0KGgo="
    assert created["designation"] == "Front Desk"

    # B) Login via 10-digit
    r = s.post(f"{API}/auth/verify-otp",
               json={"phone": ASSIST_A, "otp": "123456", "role": "receptionist"})
    assert r.status_code == 200, r.text
    u = r.json()["user"]
    assert u["linked_provider_id"] == created["linked_provider_id"]
    assert u["photo"] == created["photo"]

    # C) Login via 12-digit (frontend's toIndianE164 output)
    r = s.post(f"{API}/auth/verify-otp",
               json={"phone": "91" + ASSIST_A, "otp": "123456", "role": "receptionist"})
    assert r.status_code == 200, r.text
    u = r.json()["user"]
    assert u["linked_provider_id"] == created["linked_provider_id"]


def test_upsert_updates_photo_and_normalises_phone(s):
    pt = _provider_token(s)

    r = s.post(f"{API}/providers/me/assistants", headers=h(pt),
               json={"name": "Anita", "phone": ASSIST_B, "photo": "data:image/png;base64,OLD=="})
    assert r.status_code == 200, r.text
    original_id = r.json()["id"]

    # Re-POST with 12-digit phone + new photo (upsert path)
    r = s.post(f"{API}/providers/me/assistants", headers=h(pt),
               json={"name": "Anita", "phone": "91" + ASSIST_B,
                     "designation": "Reception", "photo": "data:image/png;base64,NEW=="})
    assert r.status_code == 200, r.text
    updated = r.json()
    assert updated["id"] == original_id  # no duplicate row created
    assert updated["photo"] == "data:image/png;base64,NEW=="
    assert updated["designation"] == "Reception"
    assert updated["phone"] == "91" + ASSIST_B


def test_assistant_without_linked_provider_still_rejected(s):
    """Login sanity: a receptionist role without a linked_provider_id still
    gets 403 (this is the intended block, not the bug we fixed)."""
    async def _seed():
        import uuid
        from datetime import datetime, timezone
        c = AsyncIOMotorClient(MONGO_URL)
        db = c[DB_NAME]
        oid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": oid,
            "phone": "91" + ORPHAN_PHONE,
            "role": "receptionist",
            "linked_provider_id": None,
            "is_blocked": False,
            "language": "en",
            "assigned_staff_ids": [],
            "has_pin": False,
            "created_at": datetime.now(timezone.utc),
        })
        c.close()
        return oid
    orphan_id = asyncio.run(_seed())
    try:
        r = s.post(f"{API}/auth/verify-otp",
                   json={"phone": ORPHAN_PHONE, "otp": "123456", "role": "receptionist"})
        assert r.status_code == 403, r.text
        assert "assistant" in r.json()["detail"].lower()
    finally:
        async def _rm():
            c = AsyncIOMotorClient(MONGO_URL)
            db = c[DB_NAME]
            await db.users.delete_one({"id": orphan_id})
            c.close()
        asyncio.run(_rm())
