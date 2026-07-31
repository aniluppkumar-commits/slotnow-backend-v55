#!/usr/bin/env python3
"""Focused backend verification for iteration 27 MSG91 SMS/OTP fixes.

This script intentionally exercises only the reported SMS OTP backend flow:
- SMS settings persistence/defaults
- admin dry-run/test-send endpoints
- MSG91 live send path and phone normalization
- live OTP verification vs demo/mock fallback

It uses the local backend at http://localhost:8001 and MongoDB from
/app/backend/.env. It restores the original SMS settings row at the end.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from pymongo import MongoClient


BASE = os.environ.get("BACKEND_BASE", "http://localhost:8001/api")
ENV_PATH = Path("/app/backend/.env")
MSG91_KEY = "548721AMkxpXNo6T6a4e834dP1"
LIVE_SMS_SETTINGS = {
    "provider": "msg91",
    "api_key": MSG91_KEY,
    "sender_id": "SLOTNW",
    "dlt_template_id": "1207178359126464853",
    "dlt_entity_id": "",
    "dlt_variable_name": "num",
    "enabled": True,
}
DEFAULT_SMS_SETTINGS = {
    "provider": "mock",
    "api_key": "",
    "sender_id": "",
    "dlt_template_id": "",
    "dlt_entity_id": "",
    "dlt_variable_name": "num",
    "enabled": False,
}


def redact(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: ("***REDACTED***" if k in {"api_key", "authkey", "token"} and v else redact(v)) for k, v in obj.items()}
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
        item = {"name": name, "passed": bool(passed), "detail": detail}
        if evidence is not None:
            item["evidence"] = redact(evidence)
        self.results.append(item)
        status = "PASS" if passed else "FAIL"
        print(f"[{status}] {name}: {detail}")
        if evidence is not None:
            print(json.dumps(redact(evidence), indent=2, default=str)[:3000])


def set_sms_settings(db, settings: dict[str, Any]) -> None:
    payload = {"key": "sms", **settings}
    db.settings.update_one({"key": "sms"}, {"$set": payload}, upsert=True)


def clear_sms_settings(db) -> None:
    db.settings.delete_many({"key": "sms"})


def post(path: str, payload: dict[str, Any], token: str | None = None) -> requests.Response:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.post(f"{BASE}{path}", headers=headers, json=payload, timeout=30)


def put(path: str, payload: dict[str, Any], token: str | None = None) -> requests.Response:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.put(f"{BASE}{path}", headers=headers, json=payload, timeout=30)


def get(path: str, token: str | None = None) -> requests.Response:
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.get(f"{BASE}{path}", headers=headers, timeout=30)


def assert_subset(actual: dict[str, Any], expected: dict[str, Any]) -> tuple[bool, list[str]]:
    missing = []
    for key, value in expected.items():
        if actual.get(key) != value:
            missing.append(f"{key}: expected {value!r}, got {actual.get(key)!r}")
    return not missing, missing


def main() -> int:
    rec = Recorder()
    load_dotenv(ENV_PATH)
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = MongoClient(mongo_url)
    db = client[db_name]
    original_sms = db.settings.find_one({"key": "sms"})
    if original_sms:
        original_sms.pop("_id", None)

    test_phone_raw = "9876543210"
    test_phone_norm = "919876543210"
    admin_phone = "9999999999"
    admin_token = None

    try:
        # Ensure demo mode for acquiring admin token and default/no-row checks.
        clear_sms_settings(db)

        r = post("/auth/send-otp", {"phone": admin_phone, "role": "admin"})
        rec.add(
            "admin mock send-otp for token setup",
            r.status_code == 200 and response_json(r).get("demo_otp") == "123456",
            f"status={r.status_code}",
            response_json(r),
        )
        r = post("/auth/verify-otp", {"phone": admin_phone, "role": "admin", "otp": "123456"})
        body = response_json(r)
        admin_token = body.get("token")
        rec.add(
            "admin mock verify-otp returns token",
            r.status_code == 200 and bool(admin_token) and body.get("user", {}).get("role") == "admin",
            f"status={r.status_code}",
            body,
        )
        if not admin_token:
            rec.add("blocked: no admin token", False, "Cannot continue admin endpoint checks without token")
            return 2

        r = get("/admin/settings/sms", admin_token)
        body = response_json(r)
        ok, diffs = assert_subset(body if isinstance(body, dict) else {}, DEFAULT_SMS_SETTINGS)
        rec.add(
            "SmsSettings default when no row exists",
            r.status_code == 200 and ok,
            f"status={r.status_code}; {'; '.join(diffs) if diffs else 'defaults matched'}",
            body,
        )

        persistence_payload = {
            "provider": "msg91",
            "api_key": "X",
            "sender_id": "S",
            "dlt_template_id": "T",
            "dlt_entity_id": "E",
            "dlt_variable_name": "otp",
            "enabled": True,
        }
        r_put = put("/admin/settings/sms", persistence_payload, admin_token)
        r_get = get("/admin/settings/sms", admin_token)
        got = response_json(r_get)
        ok, diffs = assert_subset(got if isinstance(got, dict) else {}, persistence_payload)
        rec.add(
            "SmsSettings persistence includes dlt_entity_id and dlt_variable_name",
            r_put.status_code == 200 and r_get.status_code == 200 and ok,
            f"PUT status={r_put.status_code}, GET status={r_get.status_code}; {'; '.join(diffs) if diffs else 'all fields matched'}",
            {"put": response_json(r_put), "get": got},
        )

        disabled_payload = {**LIVE_SMS_SETTINGS, "enabled": False}
        put("/admin/settings/sms", disabled_payload, admin_token)
        r = post("/admin/settings/sms/test-send", {"phone": test_phone_raw}, admin_token)
        body = response_json(r)
        rec.add(
            "test-send guard when MSG91 disabled",
            r.status_code == 503 and "MSG91 is not enabled" in str(body),
            f"status={r.status_code}",
            body,
        )

        # Enable real MSG91 settings for dry-run, live send, test-send, and live verify checks.
        r = put("/admin/settings/sms", LIVE_SMS_SETTINGS, admin_token)
        rec.add(
            "seed live MSG91 settings via admin API",
            r.status_code == 200,
            f"status={r.status_code}",
            response_json(r),
        )

        r = post("/admin/settings/sms/dry-run", {"phone": test_phone_raw}, admin_token)
        body = response_json(r)
        dry_ok = (
            r.status_code == 200
            and body.get("would_send_to") == test_phone_norm
            and body.get("endpoint") == "https://control.msg91.com/api/v5/flow/"
            and body.get("headers", {}).get("authkey") == "***REDACTED***"
            and body.get("body", {}).get("recipients", [{}])[0].get("mobiles") == test_phone_norm
            and MSG91_KEY not in json.dumps(body)
        )
        rec.add("dry-run payload normalizes phone and redacts authkey", dry_ok, f"status={r.status_code}", body)

        # Real MSG91 admin test-send: should dispatch exactly once from this script.
        r = post("/admin/settings/sms/test-send", {"phone": test_phone_raw}, admin_token)
        body = response_json(r)
        rec.add(
            "test-send dispatches real MSG91 successfully",
            r.status_code == 200 and body.get("ok") is True and body.get("msg91_response", {}).get("type") == "success",
            f"status={r.status_code}",
            body,
        )

        # Real send-otp path and normalization variants. These calls may send real SMS.
        for label, phone in [
            ("10-digit", "9876543210"),
            ("11-digit leading zero", "09876543210"),
            ("formatted +91", "+91 98765 43210"),
        ]:
            db.otps.delete_many({"phone": test_phone_norm})
            r = post("/auth/send-otp", {"phone": phone, "role": "customer"})
            body = response_json(r)
            otp_doc = db.otps.find_one({"phone": test_phone_norm}, {"_id": 0})
            passed = (
                r.status_code == 200
                and body.get("ok") is True
                and body.get("provider_used") == "msg91"
                and body.get("channel") == "sms"
                and "+919876543210" in str(body.get("message", ""))
                and "demo_otp" not in body
                and bool(otp_doc)
                and isinstance(otp_doc.get("otp"), str)
                and len(otp_doc.get("otp", "")) == 4
                and otp_doc.get("otp", "").isdigit()
            )
            rec.add(
                f"live send-otp {label} uses MSG91, no demo_otp, stores 4-digit normalized OTP",
                passed,
                f"status={r.status_code}; otp_doc_found={bool(otp_doc)}",
                {"response": body, "otp_doc": otp_doc},
            )
            time.sleep(0.5)

        # Directly seed a known live OTP, then prove demo/mock fallback is not accepted in live mode.
        db.otps.update_one(
            {"phone": test_phone_norm},
            {"$set": {"phone": test_phone_norm, "otp": "5678", "created_at": time.time()}},
            upsert=True,
        )
        r = post("/auth/verify-otp", {"phone": test_phone_raw, "role": "customer", "otp": "123456"})
        body = response_json(r)
        rec.add(
            "live verify rejects demo MOCK_OTP fallback 123456",
            r.status_code == 400 and "Invalid OTP" in str(body),
            f"status={r.status_code}; expected HTTP 400 Invalid OTP in live mode",
            body,
        )

        db.otps.update_one(
            {"phone": test_phone_norm},
            {"$set": {"phone": test_phone_norm, "otp": "5678", "created_at": time.time()}},
            upsert=True,
        )
        r = post("/auth/verify-otp", {"phone": test_phone_raw, "role": "customer", "otp": "5678"})
        body = response_json(r)
        otp_after_success = db.otps.find_one({"phone": test_phone_norm}, {"_id": 0})
        exact_pass = r.status_code == 200 and bool(body.get("token")) and otp_after_success is None
        rec.add(
            "live verify accepts exact stored 4-digit OTP and consumes it",
            exact_pass,
            f"status={r.status_code}; otp_after_success={otp_after_success}",
            body,
        )

        r = post("/auth/verify-otp", {"phone": test_phone_raw, "role": "customer", "otp": "1111"})
        body = response_json(r)
        rec.add(
            "live verify rejects wrong 4-digit OTP after consumption",
            r.status_code == 400 and "Invalid OTP" in str(body),
            f"status={r.status_code}",
            body,
        )

        # Demo mode regression.
        put("/admin/settings/sms", disabled_payload, admin_token)
        r_send = post("/auth/send-otp", {"phone": "7777700010", "role": "customer"})
        send_body = response_json(r_send)
        r_verify = post("/auth/verify-otp", {"phone": "7777700010", "role": "customer", "otp": "123456"})
        verify_body = response_json(r_verify)
        rec.add(
            "demo mode still returns demo_otp and verifies 123456 when disabled",
            r_send.status_code == 200
            and send_body.get("demo_otp") == "123456"
            and r_verify.status_code == 200
            and bool(verify_body.get("token")),
            f"send_status={r_send.status_code}, verify_status={r_verify.status_code}",
            {"send": send_body, "verify": verify_body},
        )

    finally:
        if original_sms:
            db.settings.replace_one({"key": "sms"}, original_sms, upsert=True)
        else:
            clear_sms_settings(db)
        client.close()

    out_path = Path("/app/test_reports/bug_verification_iter27_raw_results.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps({"base": BASE, "results": rec.results}, indent=2, default=str))
    failed = [r for r in rec.results if not r["passed"]]
    print(f"\nRaw focused result file: {out_path}")
    print(f"Passed {len(rec.results) - len(failed)}/{len(rec.results)} checks")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())