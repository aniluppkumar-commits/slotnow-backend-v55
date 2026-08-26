"""Iter54 migration — align `provider_type` value convention with mobile app.

Old (web-legacy) → New (mobile-parity):
  "doctor_clinic"      → "clinic"
  "diagnostic_center"  → "service"
  "hospital"           → unchanged
  ""                   → unchanged (non-healthcare providers)

Idempotent: running the script twice is a no-op.

Usage (against any Mongo the backend can reach):
    cd /app/backend
    python scripts/migrate_iter54_provider_type.py
"""
import asyncio
import os
import sys

from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get("MONGO_URL") or "mongodb://localhost:27017"
DB_NAME = os.environ.get("DB_NAME") or "test_database"

RENAME_MAP = {
    "doctor_clinic": "clinic",
    "diagnostic_center": "service",
}


async def run():
    print(f"Connecting to {DB_NAME} @ {MONGO_URL.split('@')[-1][:40]}…")
    c = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=15000)
    db = c[DB_NAME]
    total = 0
    for old, new in RENAME_MAP.items():
        r = await db.providers.update_many({"provider_type": old}, {"$set": {"provider_type": new}})
        print(f"  {old!r} → {new!r}: matched={r.matched_count} modified={r.modified_count}")
        total += r.modified_count
    remaining_legacy = await db.providers.count_documents({"provider_type": {"$in": list(RENAME_MAP.keys())}})
    types_distribution = await db.providers.aggregate([
        {"$group": {"_id": "$provider_type", "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
    ]).to_list(50)
    print(f"\nTotal migrated rows: {total}")
    print(f"Remaining legacy values (should be 0): {remaining_legacy}")
    print("Final provider_type distribution:")
    for row in types_distribution:
        print(f"  {row['_id']!r:24} → {row['n']}")
    c.close()


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except Exception as e:
        print(f"Migration failed: {type(e).__name__}: {e}")
        sys.exit(1)
