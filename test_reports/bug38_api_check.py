#!/usr/bin/env python3
"""Focused API/backend checks for bug 38 service-assistant mapping + hospital availability callout fix."""

import json
import os
from pathlib import Path
from datetime import datetime, timezone

import bcrypt
import requests
from pymongo import MongoClient


ROOT = Path("/app")
OUT = ROOT / "test_reports" / "bug38_api_results.json"
FRONT_ENV = ROOT / "frontend" / ".env"
BACK_ENV = ROOT / "backend" / ".env"


def parse_env(path: Path):
    data = {}
    if path.exists():
        for line in path.read_text().splitlines():
            if not line.strip() or line.strip().startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            data[k.strip()] = v.strip().strip('"').strip("'")
    return data


front_env = parse_env(FRONT_ENV)
back_env = parse_env(BACK_ENV)
BASE = os.environ.get("BASE_URL") or front_env.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
API = BASE.rstrip("/") + "/api"

results = {
    "base_url": BASE,
    "checks": [],
    "created_seed_data": [],
}


def check(name, ok, detail=None):
    results["checks"].append({"name": name, "ok": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'}: {name} :: {detail or ''}")
    return ok


def req(method, path, token=None, **kwargs):
    headers = kwargs.pop("headers", {})
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.request(method, API + path, headers=headers, timeout=25, **kwargs)


def seed_non_auto_provider():
    mongo_url = back_env.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = back_env.get("DB_NAME", "test_database")
    db = MongoClient(mongo_url)[db_name]
    non_auto_cat = db.categories.find_one({"name": {"$ne": "Automobile"}}, {"_id": 0})
    if not non_auto_cat:
        non_auto_cat = {
            "id": "bug38-healthcare-cat",
            "name": "Healthcare",
            "name_hi": "Healthcare",
            "icon": "heart-pulse",
            "color": "#10b981",
            "active": True,
        }
        db.categories.update_one({"id": non_auto_cat["id"]}, {"$set": non_auto_cat}, upsert=True)
        results["created_seed_data"].append("category:bug38-healthcare-cat")
    user_id = "bug38-nonauto-user"
    provider_id = "bug38-nonauto-provider"
    phone = "9000000101"
    pin_hash = bcrypt.hashpw(b"1234", bcrypt.gensalt(rounds=12)).decode()
    user_doc = {
        "id": user_id,
        "phone": phone,
        "role": "provider",
        "name": "Bug38 NonAuto Provider",
        "email": None,
        "avatar": None,
        "city": "Mumbai",
        "address": None,
        "language": "en",
        "linked_provider_id": None,
        "via_referral": False,
        "referred_by": None,
        "designation": None,
        "assigned_staff_ids": [],
        "is_blocked": False,
        "has_pin": True,
        "pin_hash": pin_hash,
        "created_at": datetime.now(timezone.utc),
    }
    provider_doc = {
        "id": provider_id,
        "user_id": user_id,
        "business_name": "Bug38 NonAuto Clinic",
        "category_id": non_auto_cat["id"],
        "provider_type": "doctor_clinic" if non_auto_cat.get("name") == "Healthcare" else "",
        "specialization": "Physician",
        "service_tags": [],
        "bio": "Seeded for bug38 UI gating regression test",
        "city": "Mumbai",
        "address": "Bug38 Test Address",
        "contact_phone": phone,
        "latitude": None,
        "longitude": None,
        "image": None,
        "rating": 0.0,
        "reviews_count": 0,
        "starting_price": 0,
        "approved": True,
        "on_duty": True,
        "daily_slot_limit": None,
        "created_at": datetime.now(timezone.utc),
    }
    db.users.update_one({"id": user_id}, {"$set": user_doc}, upsert=True)
    db.providers.update_one({"id": provider_id}, {"$set": provider_doc}, upsert=True)
    results["created_seed_data"].append("provider_user:9000000101/1234")
    results["created_seed_data"].append(f"provider:{provider_id} category={non_auto_cat.get('name')}")
    return {"phone": phone, "pin": "1234", "category": non_auto_cat.get("name"), "provider_id": provider_id}


def main():
    # Seed a non-Automobile provider for the UI regression checks that require category gating.
    non_auto = seed_non_auto_provider()
    results["non_auto_seed"] = non_auto

    login = req("POST", "/auth/pin-login", json={"phone": "9000000007", "role": "provider", "pin": "1234"})
    check("hospital provider PIN login succeeds", login.status_code == 200, f"status={login.status_code}")
    login.raise_for_status()
    token = login.json()["token"]

    profile_res = req("GET", "/providers/me/profile", token=token)
    profile = profile_res.json() if profile_res.ok else {}
    check("GET /providers/me/profile returns 200", profile_res.status_code == 200, f"status={profile_res.status_code}")
    check("profile.provider_type is hospital", profile.get("provider_type") == "hospital", profile.get("provider_type"))
    check("profile.category_name is Automobile", profile.get("category_name") == "Automobile", profile.get("category_name"))
    check("profile.category object is enriched", (profile.get("category") or {}).get("name") == "Automobile", profile.get("category"))

    staff_res = req("GET", "/providers/me/staff", token=token)
    staff = staff_res.json() if staff_res.ok else []
    check("hospital staff list loads", staff_res.status_code == 200 and isinstance(staff, list), f"status={staff_res.status_code}, count={len(staff) if isinstance(staff, list) else 'n/a'}")
    # UI cap testing needs at least 4 checkboxes; add uniquely named test staff if needed.
    while isinstance(staff, list) and len(staff) < 4:
        idx = len(staff) + 1
        add_res = req("POST", "/providers/me/staff", token=token, json={
            "kind": "doctor",
            "name": f"Bug38 Temp Doctor {idx}",
            "specialization": "QA",
            "service_tags": [],
            "bio": "Seeded for assignment cap UI test",
            "address": "QA",
            "active": True,
        })
        check(f"seed hospital staff #{idx} for UI cap", add_res.status_code == 200, f"status={add_res.status_code}")
        if not add_res.ok:
            break
        results["created_seed_data"].append(f"hospital_staff:{add_res.json().get('id')}")
        staff = req("GET", "/providers/me/staff", token=token).json()

    assistants_res = req("GET", "/providers/me/assistants", token=token)
    assistants = assistants_res.json() if assistants_res.ok else []
    check("assistant list loads", assistants_res.status_code == 200 and isinstance(assistants, list), f"status={assistants_res.status_code}, count={len(assistants) if isinstance(assistants, list) else 'n/a'}")
    nia = next((a for a in assistants if str(a.get("phone", "")).endswith("9000009911") or (a.get("name") or "").lower() == "nurse nia"), None)
    if not nia:
        create_nia = req("POST", "/providers/me/assistants", token=token, json={"name": "Nurse Nia", "phone": "9000009911", "designation": "receptionist"})
        check("seed Nurse Nia assistant if absent", create_nia.status_code == 200, f"status={create_nia.status_code}")
        results["created_seed_data"].append("assistant:9000009911")
        assistants = req("GET", "/providers/me/assistants", token=token).json()
        nia = next((a for a in assistants if str(a.get("phone", "")).endswith("9000009911") or (a.get("name") or "").lower() == "nurse nia"), None)
    check("Nurse Nia assistant available for assignment regression", bool(nia), nia and {"id": nia.get("id"), "assigned_count": len(nia.get("assigned_staff_ids") or [])})

    if nia and len(staff) >= 4:
        over_cap_ids = [s["id"] for s in staff[:4]]
        cap_res = req("PUT", f"/providers/me/assistants/{nia['id']}/staff", token=token, json={"staff_ids": over_cap_ids})
        detail = None
        try:
            detail = cap_res.json()
        except Exception:
            detail = cap_res.text
        check("backend rejects >3 assigned doctors/services", cap_res.status_code == 400 and "at most 3" in str(detail), f"status={cap_res.status_code}, detail={detail}")
    else:
        check("backend rejects >3 assigned doctors/services", False, "insufficient assistant/staff data")

    # Confirm seeded non-auto provider profile also receives enriched category_name for frontend gating.
    nlogin = req("POST", "/auth/pin-login", json={"phone": non_auto["phone"], "role": "provider", "pin": "1234"})
    check("non-Automobile seeded provider PIN login succeeds", nlogin.status_code == 200, f"status={nlogin.status_code}")
    if nlogin.ok:
        nprof_res = req("GET", "/providers/me/profile", token=nlogin.json()["token"])
        nprof = nprof_res.json() if nprof_res.ok else {}
        check("non-Automobile provider profile has non-Automobile category_name", nprof_res.status_code == 200 and nprof.get("category_name") != "Automobile", nprof.get("category_name"))

    OUT.write_text(json.dumps(results, indent=2, default=str))
    print(f"Wrote {OUT}")
    if not all(c["ok"] for c in results["checks"]):
        raise SystemExit(1)


if __name__ == "__main__":
    main()