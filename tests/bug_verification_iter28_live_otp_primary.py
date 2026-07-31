#!/usr/bin/env python3
"""Iteration 28 focused verification for live MSG91 verify_otp gating.

This script exercises only the security regression reported for POST
/api/auth/verify-otp: when SMS is live-enabled with MSG91, demo/mock OTP
fallbacks must not be accepted. It avoids live SMS dispatch by directly
seeding SMS settings and db.otps, then restores the previous SMS settings and
OTP rows for the test phone.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from pymongo import MongoClient


BASE = os.environ.get("BACKEND_BASE", "http://localhost:8001/api")
ENV_PATH = Path("/app/backend/.env")
OUT_PATH = Path("/app/test_reports/bug_verification_iter28_primary_raw_results.json")

MSG91_KEY = "548721AMkxpXNo6T6a4e834dP1"
LIVE_SMS_SETTINGS = {
    "key": "sms",
    "provider": "msg91",
    "enabled": True,
    "api_key": MSG91_KEY,
    "sender_id": "SLOTNW",
    "dlt_template_id": "1207178359126464853",
    "dlt_entity_id": "",
    "dlt_variable_name": "num",
}
DISABLED_SMS_SETTINGS = {**LIVE_SMS_SETTINGS, "enabled": False}


def redact(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {
            k: ("***REDACTED***" if k in {"api_key", "authkey", "token"} and v else redact(v))
            for k, v in obj.items()
        }
    if isinstance(obj, list):
        return [redact(x) for x in obj]
    return obj


def response_json(resp: requests.Response) -> Any:
    try:
        return resp.json()
    except Exception:
        return {"text": resp.text[:1000]}


class Recorder:
    def __init__(self) -> None:
        self.results: list[dict[str, Any]] = []

    def add(self, name: str, passed: bool, detail: str, evidence: Any = None) -> None:
        item: dict[str, Any] = {"name": name, "passed": bool(passed), "detail": detail}
        if evidence is not None:
            item["evidence"] = redact(evidence)
        self.results.append(item)
        print(f"[{'PASS' if passed else 'FAIL'}] {name}: {detail}")
        if evidence is not None:
            print(json.dumps(redact(evidence), indent=2, default=str)[:2500])


def post(path: str, payload: dict[str, Any]) -> requests.Response:
    return requests.post(f"{BASE}{path}", json=payload, timeout=30)


def set_sms_settings(db, settings: dict[str, Any]) -> None:
    db.settings.update_one({"key": "sms"}, {"$set": settings}, upsert=True)


def seed_known_otp(db, phone_norm: str, otp: str = "5678") -> None:
    db.otps.update_one(
        {"phone": phone_norm},
        {"$set": {"phone": phone_norm, "otp": otp, "created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )


def is_invalid_otp(resp: requests.Response) -> bool:
    return resp.status_code == 400 and "Invalid OTP" in str(response_json(resp))


def main() -> int:
    rec = Recorder()
    load_dotenv(ENV_PATH)
    client = MongoClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    phone_raw = "9876543210"
    phone_norm = "919876543210"
    verify_payload = {"phone": phone_raw, "role": "customer", "via_referral": False}

    original_sms = db.settings.find_one({"key": "sms"})
    if original_sms:
        original_sms.pop("_id", None)
    original_otps = list(db.otps.find({"phone": phone_norm}, {"_id": 0}))

    try:
        set_sms_settings(db, LIVE_SMS_SETTINGS)
        db.otps.delete_many({"phone": phone_norm})
        seed_known_otp(db, phone_norm, "5678")

        r = post("/auth/verify-otp", {**verify_payload, "otp": "123456"})
        still_stored = db.otps.find_one({"phone": phone_norm}, {"_id": 0})
        rec.add(
            "PRIMARY live mode rejects demo MOCK_OTP 123456",
            is_invalid_otp(r) and still_stored and still_stored.get("otp") == "5678",
            f"status={r.status_code}; stored_after_reject={bool(still_stored)}",
            {"response": response_json(r), "stored_after_reject": still_stored},
        )

        seed_known_otp(db, phone_norm, "5678")
        r = post("/auth/verify-otp", {**verify_payload, "otp": "999999"})
        still_stored = db.otps.find_one({"phone": phone_norm}, {"_id": 0})
        rec.add(
            "PRIMARY live mode rejects arbitrary 6-digit OTP 999999",
            is_invalid_otp(r) and still_stored and still_stored.get("otp") == "5678",
            f"status={r.status_code}; stored_after_reject={bool(still_stored)}",
            {"response": response_json(r), "stored_after_reject": still_stored},
        )

        seed_known_otp(db, phone_norm, "5678")
        r = post("/auth/verify-otp", {**verify_payload, "otp": "5678"})
        body = response_json(r)
        otp_after_success = db.otps.find_one({"phone": phone_norm}, {"_id": 0})
        rec.add(
            "PRIMARY live mode accepts stored OTP 5678 and consumes it",
            r.status_code == 200 and bool(body.get("token")) and otp_after_success is None,
            f"status={r.status_code}; otp_after_success={otp_after_success}",
            {"response": body, "otp_after_success": otp_after_success},
        )

        r = post("/auth/verify-otp", {**verify_payload, "otp": "5678"})
        rec.add(
            "PRIMARY live mode rejects consumed stored OTP 5678",
            is_invalid_otp(r),
            f"status={r.status_code}; expected 400 after prior success consumed OTP",
            response_json(r),
        )

        set_sms_settings(db, DISABLED_SMS_SETTINGS)
        db.otps.delete_many({"phone": phone_norm})
        r_send = post("/auth/send-otp", {"phone": phone_raw, "role": "customer"})
        send_body = response_json(r_send)
        r_verify = post("/auth/verify-otp", {**verify_payload, "otp": "123456"})
        verify_body = response_json(r_verify)
        rec.add(
            "REGRESSION demo mode still returns demo_otp and verifies 123456 when SMS disabled",
            r_send.status_code == 200
            and send_body.get("demo_otp") == "123456"
            and r_verify.status_code == 200
            and bool(verify_body.get("token")),
            f"send_status={r_send.status_code}; verify_status={r_verify.status_code}",
            {"send": send_body, "verify": verify_body},
        )

    finally:
        db.otps.delete_many({"phone": phone_norm})
        if original_otps:
            db.otps.insert_many(original_otps)
        if original_sms:
            db.settings.replace_one({"key": "sms"}, original_sms, upsert=True)
        else:
            db.settings.delete_many({"key": "sms"})
        client.close()

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps({"base": BASE, "results": rec.results}, indent=2, default=str))
    failed = [r for r in rec.results if not r["passed"]]
    print(f"\nRaw focused result file: {OUT_PATH}")
    print(f"Passed {len(rec.results) - len(failed)}/{len(rec.results)} checks")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())