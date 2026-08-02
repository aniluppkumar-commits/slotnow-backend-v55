"""Iteration 43 tests — Service photo upload + Customer wait-time history."""
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://slotnow-web.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CUSTOMER_PHONE = "9000009999"
PROVIDER_PHONE = "9000000007"
PROVIDER_ID = "43b3a047-c937-4cf2-a707-7682ec732b34"
ADMIN_PHONE = "9412575970"


def _pin_login(phone: str, role: str) -> str:
    r = requests.post(f"{API}/auth/pin-login", json={"phone": phone, "pin": "1234", "role": role}, timeout=15)
    assert r.status_code == 200, f"pin-login failed for {phone}/{role}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def customer_token():
    return _pin_login(CUSTOMER_PHONE, "customer")


@pytest.fixture(scope="module")
def provider_token():
    return _pin_login(PROVIDER_PHONE, "provider")


@pytest.fixture(scope="module")
def customer_headers(customer_token):
    return {"Authorization": f"Bearer {customer_token}"}


@pytest.fixture(scope="module")
def provider_headers(provider_token):
    return {"Authorization": f"Bearer {provider_token}"}


# ---------- Feature 1: Service photo ----------
TINY_PNG_DATA_URL = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


class TestServicePhoto:
    created_service_id = None

    def test_add_service_with_photo(self, provider_headers):
        name = f"TEST_iter43_svc_{uuid.uuid4().hex[:6]}"
        payload = {
            "name": name,
            "duration_min": 30,
            "price": 199,
            "photo": TINY_PNG_DATA_URL,
        }
        r = requests.post(f"{API}/providers/me/services", json=payload, headers=provider_headers, timeout=15)
        assert r.status_code == 200, r.text
        svc = r.json()
        assert svc["name"] == name
        assert svc["photo"] == TINY_PNG_DATA_URL
        assert svc.get("id")
        TestServicePhoto.created_service_id = svc["id"]

    def test_get_my_services_returns_photo(self, provider_headers):
        r = requests.get(f"{API}/providers/me/services", headers=provider_headers, timeout=15)
        assert r.status_code == 200
        rows = r.json()
        match = next((s for s in rows if s["id"] == TestServicePhoto.created_service_id), None)
        assert match is not None, "created service not returned in /providers/me/services"
        assert match["photo"] == TINY_PNG_DATA_URL

    def test_public_provider_detail_includes_photo(self):
        r = requests.get(f"{API}/providers/{PROVIDER_ID}", timeout=15)
        assert r.status_code == 200
        data = r.json()
        services = data.get("services") or []
        match = next((s for s in services if s["id"] == TestServicePhoto.created_service_id), None)
        assert match is not None, "created service not returned by public GET /providers/{id}"
        assert match["photo"] == TINY_PNG_DATA_URL

    def test_legacy_service_without_photo_returns_none(self, provider_headers):
        # add a service without photo
        payload = {"name": f"TEST_iter43_nophoto_{uuid.uuid4().hex[:6]}", "duration_min": 15, "price": 99}
        r = requests.post(f"{API}/providers/me/services", json=payload, headers=provider_headers, timeout=15)
        assert r.status_code == 200
        svc = r.json()
        # photo may be missing OR None — both acceptable representations
        assert svc.get("photo") in (None, "")

    def test_cleanup(self, provider_headers):
        if TestServicePhoto.created_service_id:
            requests.delete(
                f"{API}/providers/me/services/{TestServicePhoto.created_service_id}",
                headers=provider_headers, timeout=15,
            )


# ---------- Feature 2: Customer Wait-Time History ----------
class TestWaitHistory:
    def test_endpoint_returns_expected_shape(self, customer_headers):
        r = requests.get(f"{API}/customers/me/wait-history", headers=customer_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("count", "counted_for_avg", "avg_wait_min", "history", "by_weekday", "by_hour", "hint"):
            assert k in data, f"missing key: {k}"
        assert isinstance(data["history"], list)
        assert isinstance(data["by_weekday"], dict)
        assert isinstance(data["by_hour"], dict)

    def test_seeded_customer_avg_and_hint(self, customer_headers):
        r = requests.get(f"{API}/customers/me/wait-history", headers=customer_headers, timeout=15)
        data = r.json()
        assert data["counted_for_avg"] >= 3, f"expected >=3 seeded completed bookings, got {data['counted_for_avg']}"
        # spec expects avg ~18 (10+8+30+25 = 73 /4 = 18.25 → 18)
        assert data["avg_wait_min"] is not None
        assert 15 <= data["avg_wait_min"] <= 22, f"unexpected avg_wait_min={data['avg_wait_min']}"
        # hint is populated only when best hour ≠ worst hour
        # with seeded data of 10/8/30/25 at varying hours, hint should be present
        assert data["hint"] is not None
        assert "Try booking around" in data["hint"]

    def test_history_items_have_waited_min(self, customer_headers):
        r = requests.get(f"{API}/customers/me/wait-history", headers=customer_headers, timeout=15)
        history = r.json()["history"]
        assert len(history) >= 3
        for item in history:
            assert "waited_min" in item
            wm = item["waited_min"]
            assert wm is None or isinstance(wm, int)
            for k in ("id", "provider_id", "date", "start_time"):
                assert k in item

    def test_zero_completed_returns_null_avg(self, provider_headers):
        # Wait-history is restricted to role=customer, but bootstrap admin can create a fresh customer via PIN?
        # Simplest: use admin's own account which likely has no completed bookings won't work (admin role).
        # Instead, register a new customer via pin-login pattern is not possible. We'll create a fresh customer.
        phone = f"93{uuid.uuid4().int % 10**8:08d}"
        # send-otp then verify-otp with MOCK_OTP=123456
        r = requests.post(f"{API}/auth/send-otp", json={"phone": phone, "role": "customer"}, timeout=15)
        if r.status_code != 200:
            pytest.skip(f"cannot create fresh customer: send-otp {r.status_code}")
        v = requests.post(
            f"{API}/auth/verify-otp",
            json={"phone": phone, "otp": "123456", "role": "customer", "via_referral": False},
            timeout=15,
        )
        if v.status_code != 200:
            pytest.skip(f"verify-otp failed for fresh customer: {v.status_code} {v.text}")
        tok = v.json()["token"]
        r = requests.get(f"{API}/customers/me/wait-history", headers={"Authorization": f"Bearer {tok}"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["count"] == 0
        assert data["counted_for_avg"] == 0
        assert data["avg_wait_min"] is None
        assert data["hint"] is None
        assert data["history"] == []


# ---------- Feature 3: Booking status → completed_at + waited_min enrichment ----------
class TestBookingCompletedAt:
    def test_get_bookings_completed_has_waited_min(self, customer_headers):
        r = requests.get(f"{API}/bookings?status=completed", headers=customer_headers, timeout=15)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) >= 3, f"expected seeded completed bookings, got {len(rows)}"
        has_int_waited = False
        for b in rows:
            assert "waited_min" in b, "waited_min missing from enriched booking"
            wm = b["waited_min"]
            assert wm is None or isinstance(wm, int)
            if isinstance(wm, int):
                has_int_waited = True
        assert has_int_waited, "no completed booking had waited_min as int"

    def test_put_booking_completed_stamps_completed_at(self, customer_headers, provider_headers):
        # Create a booking as customer, then complete it as provider, verify completed_at + waited_min appears.
        # 1) find an available slot
        today = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
        # get provider services (as provider), pick one
        r = requests.get(f"{API}/providers/me/services", headers=provider_headers, timeout=15)
        assert r.status_code == 200
        svcs = r.json()
        if not svcs:
            pytest.skip("provider has no services")
        svc = svcs[0]
        # Get slots for provider today+1
        r = requests.get(f"{API}/providers/{PROVIDER_ID}/slots?date={today}&service_id={svc['id']}", timeout=15)
        if r.status_code != 200:
            pytest.skip(f"slots endpoint returned {r.status_code}")
        slots_data = r.json()
        slots = slots_data.get("slots") or slots_data if isinstance(slots_data, list) else []
        if isinstance(slots_data, dict):
            slots = slots_data.get("slots", [])
        avail = [s for s in slots if s.get("available")]
        if not avail:
            pytest.skip("no available slot to create test booking")
        slot = avail[0]
        # create booking
        body = {
            "provider_id": PROVIDER_ID,
            "service_id": svc["id"],
            "date": today,
            "start_time": slot["start_time"],
        }
        r = requests.post(f"{API}/bookings", json=body, headers=customer_headers, timeout=15)
        if r.status_code != 200:
            pytest.skip(f"booking create failed {r.status_code} {r.text}")
        booking_id = r.json()["id"]
        # PUT status=completed
        r = requests.put(
            f"{API}/bookings/{booking_id}",
            json={"status": "completed"},
            headers=provider_headers,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        updated = r.json()
        # Fetch again via wait-history and confirm completed_at was stamped (waited_min becomes int)
        r = requests.get(f"{API}/customers/me/wait-history", headers=customer_headers, timeout=15)
        history = r.json()["history"]
        match = next((h for h in history if h["id"] == booking_id), None)
        assert match is not None, "booking not in wait-history after completion"
        assert isinstance(match["waited_min"], int), "waited_min should be int after completed_at stamped"

        # cleanup: cancel it? completed can't be cancelled. Leave it.
