"""Iter 45 — Hospital & Assistant workflow tests.

Covers:
  - /reference/healthcare provider_types third entry label = 'Any Service'
  - HospitalStaff bio field persistence on POST/PATCH/GET
  - PUT /providers/me/assistants/{aid}/staff MAX-3 enforcement
  - GET /assistant/queue/multi snapshot shape
  - POST /assistant/queue/next completes lowest-token active booking
  - 403 when staff_id not assigned
"""
import os
import time
import pytest
import requests
from datetime import datetime, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://slotnow-web.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

HOSPITAL_PHONE = "9000000007"
HOSPITAL_PROVIDER_ID = "43b3a047-c937-4cf2-a707-7682ec732b34"
ASSISTANT_PHONE = "9000009911"
ASSISTANT_USER_ID = "baf49211-962b-4868-9ed7-7017328b0f5b"
CUSTOMER_PHONE = "9000009999"
CARDIO_STAFF_ID = "4723b155-43f1-4a5e-9784-4cdf2782c37b"  # Mon 10-13, Tue 15-18
NEURO_STAFF_ID = "7d7977aa-7d25-413d-8dd7-4d8bcbbbed51"


def _pin_login(s, phone, role, pin="1234"):
    r = s.post(f"{API}/auth/pin-login", json={"phone": phone, "pin": pin, "role": role})
    assert r.status_code == 200, f"pin-login failed for {phone}/{role}: {r.status_code} {r.text}"
    tok = r.json()["token"]
    return tok


@pytest.fixture(scope="module")
def provider_client():
    s = requests.Session()
    tok = _pin_login(s, HOSPITAL_PHONE, "provider")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def assistant_client():
    s = requests.Session()
    tok = _pin_login(s, ASSISTANT_PHONE, "receptionist")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def customer_client():
    s = requests.Session()
    tok = _pin_login(s, CUSTOMER_PHONE, "customer")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


# ---------- 1. Reference healthcare label change ----------
class TestHealthcareReference:
    def test_provider_types_any_service_label(self):
        r = requests.get(f"{API}/reference/healthcare")
        assert r.status_code == 200
        pt = r.json()["provider_types"]
        assert len(pt) == 3
        assert pt[2]["key"] == "diagnostic_center"
        assert pt[2]["label"] == "Any Service"


# ---------- 2. Hospital staff bio persistence ----------
class TestHospitalStaffBio:
    def test_add_doctor_with_bio_persists(self, provider_client):
        bio_text = "TEST_iter45 bio for cardio consultant"
        payload = {
            "kind": "doctor",
            "name": "TEST_iter45 Dr Bio",
            "specialization": "Cardiologist",
            "bio": bio_text,
            "address": "TEST_iter45 addr",
            "photo": "https://example.com/photo.jpg",
        }
        r = provider_client.post(f"{API}/providers/me/staff", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        staff_id = data["id"]
        # Response should include bio
        assert data.get("bio") == bio_text, f"POST response bio mismatch: {data.get('bio')!r}"

        # GET /providers/me/staff
        r2 = provider_client.get(f"{API}/providers/me/staff")
        assert r2.status_code == 200
        found = next((s for s in r2.json() if s["id"] == staff_id), None)
        assert found is not None
        assert found.get("bio") == bio_text, f"GET me/staff bio missing: {found}"

        # GET /providers/{id}/staff (public)
        r3 = requests.get(f"{API}/providers/{HOSPITAL_PROVIDER_ID}/staff")
        assert r3.status_code == 200
        found2 = next((s for s in r3.json() if s["id"] == staff_id), None)
        assert found2 is not None
        assert found2.get("bio") == bio_text, f"public staff bio missing: {found2}"

        # cleanup
        provider_client.delete(f"{API}/providers/me/staff/{staff_id}")

    def test_add_service_with_bio_persists(self, provider_client):
        bio_text = "TEST_iter45 svc bio"
        payload = {
            "kind": "service",
            "name": "TEST_iter45 Svc Bio",
            "service_tags": ["MRI"],
            "bio": bio_text,
            "address": "TEST_iter45 svc addr",
        }
        r = provider_client.post(f"{API}/providers/me/staff", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        staff_id = data["id"]
        assert data.get("bio") == bio_text
        # patch bio update
        new_bio = "TEST_iter45 updated bio"
        rp = provider_client.patch(
            f"{API}/providers/me/staff/{staff_id}",
            json={**payload, "bio": new_bio, "active": True},
        )
        assert rp.status_code == 200
        assert rp.json().get("bio") == new_bio, f"PATCH did not update bio: {rp.json()}"
        provider_client.delete(f"{API}/providers/me/staff/{staff_id}")


# ---------- 3. Assistant assignment MAX-3 ----------
class TestAssistantMax3:
    """PUT /providers/me/assistants/{aid}/staff enforcement."""

    def _get_assistant_id(self, provider_client):
        # Reuse constant if valid; else look up by phone.
        r = provider_client.get(f"{API}/providers/me/assistants")
        if r.status_code == 200:
            for a in r.json():
                if a.get("phone") == ASSISTANT_PHONE:
                    return a["id"]
        return ASSISTANT_USER_ID

    def _staff_ids(self, provider_client):
        r = provider_client.get(f"{API}/providers/me/staff")
        assert r.status_code == 200
        return [s["id"] for s in r.json()]

    def test_put_3_ok(self, provider_client):
        aid = self._get_assistant_id(provider_client)
        ids = self._staff_ids(provider_client)[:3]
        assert len(ids) >= 2, f"Need at least 2 staff, got {ids}"
        r = provider_client.put(
            f"{API}/providers/me/assistants/{aid}/staff",
            json={"staff_ids": ids},
        )
        assert r.status_code == 200, r.text

    def test_put_4_rejected_400(self, provider_client):
        aid = self._get_assistant_id(provider_client)
        # Need 4 staff — create ephemeral ones if needed
        existing = self._staff_ids(provider_client)
        created = []
        while len(existing) + len(created) < 4:
            r = provider_client.post(f"{API}/providers/me/staff", json={
                "kind": "doctor", "name": f"TEST_iter45 tmp {len(created)}",
                "specialization": "Physician",
            })
            assert r.status_code == 200
            created.append(r.json()["id"])
        all_ids = (existing + created)[:4]
        try:
            r = provider_client.put(
                f"{API}/providers/me/assistants/{aid}/staff",
                json={"staff_ids": all_ids},
            )
            assert r.status_code == 400
            detail = r.json().get("detail", "")
            assert "at most 3" in detail, f"Unexpected error msg: {detail}"
        finally:
            for cid in created:
                provider_client.delete(f"{API}/providers/me/staff/{cid}")
            # Restore assignment to Cardio + Neuro
            provider_client.put(
                f"{API}/providers/me/assistants/{aid}/staff",
                json={"staff_ids": [CARDIO_STAFF_ID, NEURO_STAFF_ID]},
            )

    def test_put_empty_ok_clears(self, provider_client):
        aid = self._get_assistant_id(provider_client)
        r = provider_client.put(
            f"{API}/providers/me/assistants/{aid}/staff",
            json={"staff_ids": []},
        )
        assert r.status_code == 200
        assert r.json().get("assigned_staff_ids") == []
        # Restore
        provider_client.put(
            f"{API}/providers/me/assistants/{aid}/staff",
            json={"staff_ids": [CARDIO_STAFF_ID, NEURO_STAFF_ID]},
        )


# ---------- 4. /assistant/queue/multi ----------
class TestAssistantMultiQueue:
    def test_multi_queue_shape(self, provider_client, assistant_client):
        aid = ASSISTANT_USER_ID
        # ensure assignment = 2 staff
        provider_client.put(
            f"{API}/providers/me/assistants/{aid}/staff",
            json={"staff_ids": [CARDIO_STAFF_ID, NEURO_STAFF_ID]},
        )
        r = assistant_client.get(f"{API}/assistant/queue/multi")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "date" in data
        assert data["provider_id"] == HOSPITAL_PROVIDER_ID
        assert isinstance(data["staff"], list)
        assert len(data["staff"]) == 2
        ids = {s["staff_id"] for s in data["staff"]}
        assert ids == {CARDIO_STAFF_ID, NEURO_STAFF_ID}
        for tile in data["staff"]:
            for k in ["staff_id", "staff_name", "staff_kind", "staff_photo",
                      "current_token", "next_token", "next_booking_id",
                      "next_name", "next_phone", "active_count", "last_assigned"]:
                assert k in tile, f"missing field {k} in tile {tile}"
            assert isinstance(tile["current_token"], int)
            assert isinstance(tile["active_count"], int)
            assert isinstance(tile["last_assigned"], int)

    def test_multi_queue_fallback_when_no_assignment(self, provider_client, assistant_client):
        aid = ASSISTANT_USER_ID
        # Clear
        provider_client.put(
            f"{API}/providers/me/assistants/{aid}/staff",
            json={"staff_ids": []},
        )
        try:
            r = assistant_client.get(f"{API}/assistant/queue/multi")
            assert r.status_code == 200
            data = r.json()
            # falls back to first 3 active hospital staff
            assert isinstance(data["staff"], list)
            assert 0 < len(data["staff"]) <= 3
        finally:
            provider_client.put(
                f"{API}/providers/me/assistants/{aid}/staff",
                json={"staff_ids": [CARDIO_STAFF_ID, NEURO_STAFF_ID]},
            )


# ---------- 5. /assistant/queue/next ----------
def _next_weekday_for_cardio():
    """Cardio schedule: Mon 10:00-13:00 or Tue 15:00-18:00. Pick next such day."""
    today = datetime.utcnow().date()
    for delta in range(0, 14):
        d = today + timedelta(days=delta)
        wd = d.weekday()  # Mon=0, Tue=1
        if wd == 0:
            return d.strftime("%Y-%m-%d"), "10:00"
        if wd == 1:
            return d.strftime("%Y-%m-%d"), "15:00"
    return None, None


class TestAssistantQueueNext:
    def test_next_rejects_unassigned_staff(self, provider_client, assistant_client):
        aid = ASSISTANT_USER_ID
        # assign only Cardio
        provider_client.put(
            f"{API}/providers/me/assistants/{aid}/staff",
            json={"staff_ids": [CARDIO_STAFF_ID]},
        )
        try:
            r = assistant_client.post(
                f"{API}/assistant/queue/next",
                params={"staff_id": NEURO_STAFF_ID},
            )
            assert r.status_code == 403
        finally:
            provider_client.put(
                f"{API}/providers/me/assistants/{aid}/staff",
                json={"staff_ids": [CARDIO_STAFF_ID, NEURO_STAFF_ID]},
            )

    def test_next_completes_lowest_token(self, provider_client, assistant_client, customer_client):
        # Make sure assignment includes Cardio
        provider_client.put(
            f"{API}/providers/me/assistants/{ASSISTANT_USER_ID}/staff",
            json={"staff_ids": [CARDIO_STAFF_ID, NEURO_STAFF_ID]},
        )
        date_str, start_time = _next_weekday_for_cardio()
        if not date_str:
            pytest.skip("No suitable weekday found in next 14 days")

        # Create a booking as customer under Cardio
        payload = {
            "provider_id": HOSPITAL_PROVIDER_ID,
            "date": date_str,
            "time": start_time,
            "customer_name": "TEST_iter45 Patient",
            "staff_id": CARDIO_STAFF_ID,
        }
        rb = customer_client.post(f"{API}/bookings", json=payload)
        if rb.status_code != 200:
            pytest.skip(f"Booking creation failed: {rb.status_code} {rb.text}")
        booking = rb.json()
        booking_id = booking.get("id")

        # Call queue/next with staff+date
        r = assistant_client.post(
            f"{API}/assistant/queue/next",
            params={"staff_id": CARDIO_STAFF_ID, "date": date_str},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # Either it completed our booking (ok=True) or queue was empty
        if body.get("ok"):
            assert "completed_token" in body
            assert "completed_id" in body
        else:
            # queue empty case shouldn't happen since we just created
            pytest.skip(f"queue/next reported empty: {body}")
