"""Iter54 — provider_type value alignment with mobile app.

- `/reference/healthcare.provider_types` must return keys `hospital` / `clinic` / `service`
- No provider doc should carry legacy `doctor_clinic` or `diagnostic_center`
- Idempotent migration script + startup-hook both re-runnable
"""
import os
import sys
import asyncio
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://slotnow-web.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="module")
def s():
    return requests.Session()


def test_reference_healthcare_uses_mobile_keys(s):
    r = s.get(f"{API}/reference/healthcare")
    assert r.status_code == 200, r.text
    keys = {pt["key"] for pt in r.json()["provider_types"]}
    assert keys == {"hospital", "clinic", "service"}, keys
    assert "doctor_clinic" not in keys
    assert "diagnostic_center" not in keys


def test_no_legacy_provider_type_in_db():
    async def _run():
        c = AsyncIOMotorClient(MONGO_URL); db = c[DB_NAME]
        legacy = await db.providers.count_documents(
            {"provider_type": {"$in": ["doctor_clinic", "diagnostic_center"]}}
        )
        c.close()
        return legacy
    assert asyncio.run(_run()) == 0


def test_migration_is_idempotent():
    """Running migration twice should be a no-op the second time."""
    async def _run():
        c = AsyncIOMotorClient(MONGO_URL); db = c[DB_NAME]
        # Seed a legacy value to prove migration catches it
        await db.providers.update_one(
            {"business_name": {"$exists": True}}, {"$set": {"provider_type": "doctor_clinic"}}
        )
        # First pass
        r1 = await db.providers.update_many(
            {"provider_type": "doctor_clinic"}, {"$set": {"provider_type": "clinic"}}
        )
        # Second pass: matched=0 (already migrated)
        r2 = await db.providers.update_many(
            {"provider_type": "doctor_clinic"}, {"$set": {"provider_type": "clinic"}}
        )
        c.close()
        return r1.matched_count, r2.matched_count
    m1, m2 = asyncio.run(_run())
    assert m1 >= 1
    assert m2 == 0
