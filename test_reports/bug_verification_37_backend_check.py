import json
import os
import time
from pathlib import Path

import requests


ROOT = Path("/app")
OUT = ROOT / "test_reports" / "bug_verification_37_backend_results.json"


def read_frontend_base_url():
    env_path = ROOT / "frontend" / ".env"
    for line in env_path.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            return line.split("=", 1)[1].strip().strip('"')
    return os.environ.get("REACT_APP_BACKEND_URL", "https://slotnow-web.preview.emergentagent.com")


BASE = read_frontend_base_url().rstrip("/") + "/api"


class CheckFailure(Exception):
    pass


results = {"base": BASE, "checks": [], "created_seed_data": []}


def record(name, ok, detail=None, status=None, body=None):
    item = {"name": name, "ok": bool(ok)}
    if detail is not None:
        item["detail"] = detail
    if status is not None:
        item["status"] = status
    if body is not None:
        item["body"] = body
    results["checks"].append(item)
    print(("PASS" if ok else "FAIL") + f" {name}: {detail or ''}")


def api(method, path, token=None, **kwargs):
    headers = kwargs.pop("headers", {})
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.request(method, BASE + path, headers=headers, timeout=20, **kwargs)


def require(condition, message):
    if not condition:
        raise CheckFailure(message)


try:
    login = api("POST", "/auth/pin-login", json={"phone": "919000000007", "role": "provider", "pin": "1234"})
    record("hospital provider PIN login", login.ok, status=login.status_code, body=login.text[:300])
    require(login.ok, "hospital provider login failed")
    token = login.json()["token"]

    prof = api("GET", "/providers/me/profile", token=token)
    record("GET /providers/me/profile returns hospital profile", prof.ok and prof.json().get("provider_type") == "hospital", status=prof.status_code, body=prof.text[:500])
    require(prof.ok, "profile unavailable")

    wrong_prof = api("GET", "/providers/me", token=token)
    record("GET /providers/me endpoint used by ProviderAvailability", wrong_prof.ok, status=wrong_prof.status_code, body=wrong_prof.text[:500])

    staff_resp = api("GET", "/providers/me/staff", token=token)
    require(staff_resp.ok, "staff list failed")
    staff = staff_resp.json()
    record("GET /providers/me/staff returns hospital staff", len(staff) >= 2, detail=f"count={len(staff)}")

    # Ensure four staff rows so UI/API can prove the 4th assignment is blocked.
    while len(staff) < 4:
        idx = len(staff) + 1
        created = api("POST", "/providers/me/staff", token=token, json={
            "kind": "doctor",
            "name": f"QA Extra Doctor {int(time.time())}-{idx}",
            "specialization": "General Medicine",
            "service_tags": [],
            "bio": "Seeded for assistant assignment max-3 verification",
            "address": "QA Seed Address",
            "active": True,
        })
        record("seed additional hospital staff for max-3 coverage", created.ok, status=created.status_code, body=created.text[:300])
        require(created.ok, "could not seed staff")
        results["created_seed_data"].append({"type": "hospital_staff", "id": created.json().get("id"), "name": created.json().get("name")})
        staff = api("GET", "/providers/me/staff", token=token).json()

    assistants_resp = api("GET", "/providers/me/assistants", token=token)
    record("GET /providers/me/assistants succeeds", assistants_resp.ok, status=assistants_resp.status_code)
    require(assistants_resp.ok, "assistants list failed")
    assistants = assistants_resp.json()
    nia = next((a for a in assistants if str(a.get("phone", "")).endswith("9000009911") or a.get("name") == "Nurse Nia"), None)
    record("Nurse Nia is present in assistants list", bool(nia), body=json.dumps(assistants[:3], default=str)[:800])
    require(nia, "Nurse Nia missing")
    nia_ids = nia.get("assigned_staff_ids")
    record("Nurse Nia response includes assigned_staff_ids", isinstance(nia_ids, list), detail=f"assigned_staff_ids={nia_ids}")
    record("Nurse Nia currently has Cardio+Neuro two assignments", isinstance(nia_ids, list) and len(nia_ids) == 2, detail=f"count={len(nia_ids or [])}, ids={nia_ids}")

    qa_phone = "9000007737"
    qa = api("POST", "/providers/me/assistants", token=token, json={"name": "QA Assign Tester", "phone": qa_phone, "designation": "QA"})
    record("seed QA assistant", qa.ok, status=qa.status_code, body=qa.text[:300])
    require(qa.ok, "could not seed QA assistant")
    qa_assistant = qa.json()
    results["created_seed_data"].append({"type": "assistant", "id": qa_assistant.get("id"), "phone": qa_phone})
    reset = api("PUT", f"/providers/me/assistants/{qa_assistant['id']}/staff", token=token, json={"staff_ids": []})
    record("reset QA assistant to zero assignments", reset.ok, status=reset.status_code, body=reset.text[:300])

    four_ids = [s["id"] for s in staff[:4]]
    too_many = api("PUT", f"/providers/me/assistants/{qa_assistant['id']}/staff", token=token, json={"staff_ids": four_ids})
    record("PUT assistant staff with 4 ids returns 400 max-3", too_many.status_code == 400 and "at most 3" in too_many.text, status=too_many.status_code, body=too_many.text[:500])

    three_ids = [s["id"] for s in staff[:3]]
    ok3 = api("PUT", f"/providers/me/assistants/{qa_assistant['id']}/staff", token=token, json={"staff_ids": three_ids})
    record("PUT assistant staff with 3 valid ids returns 200", ok3.ok and ok3.json().get("assigned_staff_ids") == three_ids, status=ok3.status_code, body=ok3.text[:500])
    after = api("GET", "/providers/me/assistants", token=token).json()
    qa_after = next((a for a in after if a.get("id") == qa_assistant["id"]), {})
    record("assigned_staff_ids persist on next assistants GET", qa_after.get("assigned_staff_ids") == three_ids, detail=f"persisted={qa_after.get('assigned_staff_ids')}")

    # Verify per-doctor schedule API still works end-to-end and can be deleted.
    first_staff = staff[0]
    new_rule = api("POST", f"/providers/me/staff/{first_staff['id']}/availability", token=token, json={
        "weekday": 3,
        "start_time": "06:15",
        "end_time": "06:45",
        "slot_duration": 15,
        "max_bookings": 1,
    })
    record("POST per-staff availability creates a private shift", new_rule.ok, status=new_rule.status_code, body=new_rule.text[:500])
    require(new_rule.ok, "per-staff schedule create failed")
    rule = new_rule.json()
    got_rules = api("GET", f"/providers/me/staff/{first_staff['id']}/availability", token=token)
    record("GET per-staff availability includes created private shift", got_rules.ok and any(r.get("id") == rule.get("id") and r.get("staff_id") == first_staff["id"] for r in got_rules.json()), status=got_rules.status_code)
    deleted = api("DELETE", f"/providers/me/staff/{first_staff['id']}/availability/{rule['id']}", token=token)
    record("DELETE per-staff availability removes private shift", deleted.ok and deleted.json().get("ok") is True, status=deleted.status_code, body=deleted.text[:300])

except Exception as exc:
    results["exception"] = repr(exc)
    print("EXCEPTION", repr(exc))
finally:
    results["overall_ok"] = all(c["ok"] for c in results["checks"] if c["name"] != "GET /providers/me endpoint used by ProviderAvailability")
    OUT.write_text(json.dumps(results, indent=2))
    print(f"Wrote {OUT}")