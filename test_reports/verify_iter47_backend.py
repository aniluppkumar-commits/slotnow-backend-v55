import json
import os
import random
import time
import uuid
from datetime import datetime, timezone

import requests
from pymongo import MongoClient


BASE_URL = os.environ.get("VERIFY_BASE_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

PROVIDER_PHONE = "9000000007"
PROVIDER_PIN = "1234"


def normalize(phone: str) -> str:
    digits = "".join(ch for ch in (phone or "") if ch.isdigit())
    if len(digits) == 10:
        return "91" + digits
    if len(digits) == 12 and digits.startswith("91"):
        return digits
    if len(digits) == 11 and digits.startswith("0"):
        return "91" + digits[1:]
    return digits


def api_post(path, **kwargs):
    r = requests.post(f"{API}{path}", timeout=20, **kwargs)
    try:
        body = r.json()
    except Exception:
        body = r.text
    return r.status_code, body, r


def api_get(path, token):
    r = requests.get(f"{API}{path}", headers={"Authorization": f"Bearer {token}"}, timeout=20)
    try:
        body = r.json()
    except Exception:
        body = r.text
    return r.status_code, body


def seed_otp(db, phone, otp="123456"):
    db.otps.update_one(
        {"phone": normalize(phone)},
        {"$set": {"phone": normalize(phone), "otp": otp, "created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )


def fail(step, detail):
    raise AssertionError(json.dumps({"step": step, "detail": detail}, default=str))


def main():
    random.seed(time.time())
    suffix = random.randint(20000, 89999)
    assistant_10 = f"90008{suffix}"  # 10 digits, unlikely to collide with fixtures
    assistant_12 = normalize(assistant_10)
    orphan_10 = f"90007{suffix}"
    orphan_12 = normalize(orphan_10)
    photo_1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
    photo_2 = "data:image/png;base64,UPDATED_ITER47_PHOTO=="

    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    phone_variants = [assistant_10, assistant_12, orphan_10, orphan_12]
    db.users.delete_many({"role": "receptionist", "phone": {"$in": phone_variants}})
    db.otps.delete_many({"phone": {"$in": [assistant_12, orphan_12]}})

    results = {
        "base_url": BASE_URL,
        "assistant_10": assistant_10,
        "assistant_12": assistant_12,
        "checks": [],
    }

    status, body, _ = api_post(
        "/auth/pin-login",
        json={"phone": PROVIDER_PHONE, "role": "provider", "pin": PROVIDER_PIN},
    )
    if status != 200 or not body.get("token"):
        fail("provider_pin_login", {"status": status, "body": body})
    provider_token = body["token"]
    results["checks"].append("provider PIN login succeeded")

    status, provider_profile = api_get("/providers/me/profile", provider_token)
    if status != 200 or not provider_profile.get("id"):
        fail("provider_profile", {"status": status, "body": provider_profile})
    provider_id = provider_profile["id"]
    results["provider_id"] = provider_id
    results["checks"].append("provider profile loaded")

    status, created, _ = api_post(
        "/providers/me/assistants",
        headers={"Authorization": f"Bearer {provider_token}"},
        json={
            "name": f"Iter47 Backend {suffix}",
            "phone": assistant_10,
            "designation": "Front Desk QA",
            "photo": photo_1,
        },
    )
    if status != 200:
        fail("create_assistant", {"status": status, "body": created})
    if created.get("phone") != assistant_12:
        fail("create_assistant_phone_normalized", created)
    if created.get("linked_provider_id") != provider_id:
        fail("create_assistant_link", created)
    if created.get("photo") != photo_1:
        fail("create_assistant_photo", created)
    assistant_id = created["id"]
    results["assistant_id"] = assistant_id
    results["checks"].append("assistant created with normalized 12-digit phone, link, and photo")

    for login_phone, label in [(assistant_10, "10_digit"), (assistant_12, "12_digit_frontend_variant")]:
        seed_otp(db, login_phone)
        status, login_body, _ = api_post(
            "/auth/verify-otp",
            json={"phone": login_phone, "otp": "123456", "role": "receptionist"},
        )
        if status != 200 or not login_body.get("token"):
            fail(f"assistant_login_{label}", {"status": status, "body": login_body})
        user = login_body.get("user", {})
        if user.get("linked_provider_id") != provider_id:
            fail(f"assistant_login_{label}_link", user)
        if user.get("photo") != photo_1:
            fail(f"assistant_login_{label}_photo", user)
        if user.get("id") != assistant_id:
            fail(f"assistant_login_{label}_same_id", user)
        results["checks"].append(f"assistant verify-otp login succeeded with {label}")

    status, assistant_list = api_get("/providers/me/assistants", provider_token)
    if status != 200 or not isinstance(assistant_list, list):
        fail("list_assistants", {"status": status, "body": assistant_list})
    listed = [a for a in assistant_list if a.get("id") == assistant_id]
    if len(listed) != 1 or listed[0].get("photo") != photo_1 or listed[0].get("linked_provider_id") != provider_id:
        fail("list_assistants_contains_photo_and_link", listed)
    results["checks"].append("assistant list returns photo and linked_provider_id")

    status, updated, _ = api_post(
        "/providers/me/assistants",
        headers={"Authorization": f"Bearer {provider_token}"},
        json={
            "name": f"Iter47 Backend {suffix}",
            "phone": assistant_12,
            "designation": "Reception QA",
            "photo": photo_2,
        },
    )
    if status != 200:
        fail("upsert_assistant", {"status": status, "body": updated})
    if updated.get("id") != assistant_id or updated.get("photo") != photo_2 or updated.get("phone") != assistant_12:
        fail("upsert_same_id_photo_updated", updated)
    duplicate_count = db.users.count_documents({"role": "receptionist", "phone": {"$in": [assistant_10, assistant_12]}})
    if duplicate_count != 1:
        fail("upsert_duplicate_count", {"duplicate_count": duplicate_count, "phone_variants": [assistant_10, assistant_12]})
    results["checks"].append("upsert with 12-digit phone reused same id, updated photo, and did not duplicate")

    orphan_id = str(uuid.uuid4())
    db.users.insert_one(
        {
            "id": orphan_id,
            "phone": orphan_12,
            "role": "receptionist",
            "name": "Iter47 Orphan",
            "language": "en",
            "linked_provider_id": None,
            "designation": "Orphan",
            "photo": photo_1,
            "assigned_staff_ids": [],
            "is_blocked": False,
            "has_pin": False,
            "via_referral": False,
            "created_at": datetime.now(timezone.utc),
        }
    )
    seed_otp(db, orphan_10)
    status, orphan_body, _ = api_post(
        "/auth/verify-otp",
        json={"phone": orphan_10, "otp": "123456", "role": "receptionist"},
    )
    if status != 403 or "assistant" not in str(orphan_body).lower():
        fail("orphan_receptionist_must_still_403", {"status": status, "body": orphan_body})
    results["checks"].append("orphan receptionist without linked_provider_id still gets 403")

    db.users.delete_one({"id": orphan_id})
    db.otps.delete_many({"phone": {"$in": [assistant_12, orphan_12]}})
    client.close()

    out = "/app/test_reports/iter47_backend_results.json"
    with open(out, "w") as f:
        json.dump(results, f, indent=2)
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()