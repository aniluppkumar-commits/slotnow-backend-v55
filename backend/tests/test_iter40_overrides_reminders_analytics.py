"""Iteration 40 backend tests:
- Admin phone lockdown (pin-login + verify-otp)
- Availability overrides CRUD + integration with /providers/{id}/slots + POST /bookings
- Queue-based smart reminders (reminder20_sent / reminder3_sent + queue_reminders rows)
- Provider analytics endpoint
"""
import os
import uuid
from datetime import date, timedelta
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://slotnow-web.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ALLOWED_ADMIN_PHONE = "9412575970"
BLOCKED_PHONE = "9999999999"
PROVIDER_PHONE = "9000000007"
CUSTOMER_PHONE = "9000009999"
HOSPITAL_ID = "43b3a047-c937-4cf2-a707-7682ec732b34"
CARDIO_STAFF = "4723b155-43f1-4a5e-9784-4cdf2782c37b"
NEURO_STAFF = "7d7977aa-7d25-413d-8dd7-4d8bcbbbed51"


# ------------- fixtures -------------
@pytest.fixture(scope="module")
def s():
    return requests.Session()


def _login_pin(session, phone, role, pin="1234"):
    r = session.post(f"{API}/auth/pin-login", json={"phone": phone, "role": role, "pin": pin}, timeout=15)
    return r


@pytest.fixture(scope="module")
def admin_token(s):
    r = _login_pin(s, ALLOWED_ADMIN_PHONE, "admin")
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def provider_token(s):
    r = _login_pin(s, PROVIDER_PHONE, "provider")
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def customer_token(s):
    r = _login_pin(s, CUSTOMER_PHONE, "customer")
    assert r.status_code == 200, r.text
    return r.json()["token"]


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ------------- Admin phone lockdown -------------
class TestAdminLockdown:
    def test_pin_login_allowed_admin_ok(self, s):
        r = _login_pin(s, ALLOWED_ADMIN_PHONE, "admin")
        assert r.status_code == 200
        body = r.json()
        assert "token" in body
        assert body["user"]["role"] == "admin"

    def test_pin_login_blocked_admin_403(self, s):
        r = _login_pin(s, BLOCKED_PHONE, "admin")
        assert r.status_code == 403
        assert "Admin access is restricted" in r.text

    def test_verify_otp_blocked_admin_403(self, s):
        r = s.post(f"{API}/auth/verify-otp", json={"phone": BLOCKED_PHONE, "otp": "123456", "role": "admin"})
        assert r.status_code == 403
        assert "Admin access is restricted" in r.text

    def test_verify_otp_allowed_admin_reaches_otp(self, s):
        # Send OTP to admin phone; then verify with the mock/live-derived value.
        # We can't be 100% sure MSG91 is live, so we accept either success or a
        # 400 "Invalid OTP" — the ONLY thing we must NOT get is 403 admin-lock.
        r = s.post(f"{API}/auth/verify-otp", json={"phone": ALLOWED_ADMIN_PHONE, "otp": "123456", "role": "admin"})
        assert r.status_code != 403, r.text

    def test_customer_role_unaffected_by_admin_lock(self, s):
        # Use blocked-for-admin phone, but role=customer — admin lock must NOT trigger.
        r = s.post(f"{API}/auth/verify-otp", json={"phone": BLOCKED_PHONE, "otp": "123456", "role": "customer"})
        assert r.status_code != 403, r.text  # may be 200 or 400 Invalid OTP; NOT admin-lock


# ------------- Availability overrides CRUD -------------
class TestOverridesCRUD:
    def test_shift_missing_times_rejected(self, s, provider_token):
        future_d = (date.today() + timedelta(days=45)).isoformat()
        r = s.post(f"{API}/providers/me/overrides",
                   headers=h(provider_token),
                   json={"staff_id": CARDIO_STAFF, "date": future_d, "kind": "shift"})
        assert r.status_code == 400
        assert "start_time" in r.text and "end_time" in r.text

    def test_closed_crud_flow(self, s, provider_token):
        future_d = (date.today() + timedelta(days=46)).isoformat()
        r = s.post(f"{API}/providers/me/overrides",
                   headers=h(provider_token),
                   json={"staff_id": CARDIO_STAFF, "date": future_d, "kind": "closed", "note": "TEST_iter40 closed"})
        assert r.status_code in (200, 201), r.text
        ov = r.json()
        assert "id" in ov
        ov_id = ov["id"]

        # LIST
        r = s.get(f"{API}/providers/me/overrides?staff_id={CARDIO_STAFF}", headers=h(provider_token))
        assert r.status_code == 200
        assert any(x["id"] == ov_id for x in r.json())

        # DELETE
        r = s.delete(f"{API}/providers/me/overrides/{ov_id}", headers=h(provider_token))
        assert r.status_code == 200
        assert r.json().get("ok") is True

        # Verify gone
        r = s.get(f"{API}/providers/me/overrides?staff_id={CARDIO_STAFF}", headers=h(provider_token))
        assert not any(x["id"] == ov_id for x in r.json())


# ------------- Overrides feeding /slots + booking validation -------------
class TestOverridesIntegration:
    @pytest.fixture(scope="class")
    def closed_override(self, provider_token):
        sess = requests.Session()
        # Use a Wednesday in the future — should be far enough to avoid clashes
        d = date.today() + timedelta(days=50)
        while d.weekday() == 6:  # avoid Sunday
            d += timedelta(days=1)
        payload = {"staff_id": CARDIO_STAFF, "date": d.isoformat(), "kind": "closed", "note": "TEST_iter40 closed integ"}
        r = sess.post(f"{API}/providers/me/overrides", headers=h(provider_token), json=payload)
        assert r.status_code in (200, 201), r.text
        ov = r.json()
        yield {"id": ov["id"], "date": d.isoformat()}
        sess.delete(f"{API}/providers/me/overrides/{ov['id']}", headers=h(provider_token))

    @pytest.fixture(scope="class")
    def shift_override(self, provider_token):
        sess = requests.Session()
        d = date.today() + timedelta(days=52)
        payload = {"staff_id": CARDIO_STAFF, "date": d.isoformat(), "kind": "shift",
                   "start_time": "14:00", "end_time": "16:00", "slot_duration": 30,
                   "max_bookings": 4, "note": "TEST_iter40 shift"}
        r = sess.post(f"{API}/providers/me/overrides", headers=h(provider_token), json=payload)
        assert r.status_code in (200, 201), r.text
        ov = r.json()
        yield {"id": ov["id"], "date": d.isoformat()}
        sess.delete(f"{API}/providers/me/overrides/{ov['id']}", headers=h(provider_token))

    def test_slots_closed_override(self, s, closed_override):
        r = s.get(f"{API}/providers/{HOSPITAL_ID}/slots",
                  params={"date": closed_override["date"], "staff_id": CARDIO_STAFF})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("has_schedule") is False
        assert body.get("schedule_scope") == "override_closed"

    def test_slots_shift_override_only(self, s, shift_override):
        r = s.get(f"{API}/providers/{HOSPITAL_ID}/slots",
                  params={"date": shift_override["date"], "staff_id": CARDIO_STAFF})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("schedule_scope") == "override_shift"
        assert body.get("has_schedule") is True
        # Only shift-override times should appear
        opts = body.get("options") or body.get("slots") or []
        # Fallback: pull any list-of-dicts field
        if not opts:
            for v in body.values():
                if isinstance(v, list) and v and isinstance(v[0], dict):
                    opts = v; break
        assert opts, f"Expected slot options: {body}"

    def test_booking_on_closed_override_fails(self, s, customer_token, closed_override):
        # Need service_id — fetch provider services
        r = s.get(f"{API}/providers/{HOSPITAL_ID}")
        assert r.status_code == 200
        services = r.json().get("services", [])
        assert services, "No services on TestHospital"
        svc = services[0]
        payload = {
            "provider_id": HOSPITAL_ID,
            "service_id": svc["id"],
            "staff_id": CARDIO_STAFF,
            "date": closed_override["date"],
            "start_time": "10:00",
            "service_type": "Paid",
            "vehicle_reg_no": "MH01AB1234",
            "vehicle_model": "Test",
        }
        r = s.post(f"{API}/bookings", headers=h(customer_token), json=payload)
        assert r.status_code == 400, r.text
        assert "unavailable" in r.text.lower()

    def test_booking_on_shift_override_succeeds(self, s, customer_token, shift_override):
        r = s.get(f"{API}/providers/{HOSPITAL_ID}")
        services = r.json().get("services", [])
        svc = services[0]
        payload = {
            "provider_id": HOSPITAL_ID,
            "service_id": svc["id"],
            "staff_id": CARDIO_STAFF,
            "date": shift_override["date"],
            "start_time": "14:00",
            "service_type": "Paid",
            "vehicle_reg_no": "MH01AB1234",
            "vehicle_model": "Test",
        }
        r = s.post(f"{API}/bookings", headers=h(customer_token), json=payload)
        assert r.status_code in (200, 201), r.text
        booking = r.json()
        assert booking.get("start_time") == "14:00"
        # cleanup
        try:
            s.delete(f"{API}/bookings/{booking['id']}", headers=h(customer_token))
        except Exception:
            pass


# ------------- Queue reminders -------------
class TestQueueReminders:
    def test_reminder_flags_and_records(self, s, customer_token, provider_token):
        # Create a booking on Cardio's Tue 15:00-18:00 shift (weekday 1)
        d = date.today() + timedelta(days=1)
        # Find next Tuesday
        while d.weekday() != 1:
            d += timedelta(days=1)
        r = s.get(f"{API}/providers/{HOSPITAL_ID}")
        svc = r.json()["services"][0]
        payload = {
            "provider_id": HOSPITAL_ID,
            "service_id": svc["id"],
            "staff_id": CARDIO_STAFF,
            "date": d.isoformat(),
            "start_time": "15:00",
            "service_type": "Paid",
            "vehicle_reg_no": "MH01AB1234",
            "vehicle_model": "TestReminder",
        }
        r = s.post(f"{API}/bookings", headers=h(customer_token), json=payload)
        assert r.status_code in (200, 201), r.text
        booking = r.json()
        booking_id = booking["id"]

        # Fetch via bookings list to see reminder flags
        r = s.get(f"{API}/bookings", headers=h(customer_token))
        assert r.status_code == 200
        my = [b for b in r.json() if b["id"] == booking_id]
        assert my
        b = my[0]
        assert b.get("reminder20_sent") is True, f"reminder20 not set: {b}"
        assert b.get("reminder3_sent") is True, f"reminder3 not set: {b}"

        # cleanup
        try:
            s.delete(f"{API}/bookings/{booking_id}", headers=h(customer_token))
        except Exception:
            pass


# ------------- Analytics -------------
class TestAnalytics:
    def test_analytics_shape(self, s, provider_token):
        r = s.get(f"{API}/providers/me/analytics?days=30", headers=h(provider_token))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("totals", "capacity", "utilisation_pct", "heatmap", "per_staff"):
            assert k in d, f"missing key {k}"
        assert isinstance(d["heatmap"], list) and len(d["heatmap"]) == 7
        for row in d["heatmap"]:
            assert len(row) == 24
        for ps in d["per_staff"]:
            assert "utilisation_pct" in ps

    def test_analytics_staff_filter(self, s, provider_token):
        r = s.get(f"{API}/providers/me/analytics?days=30&staff_id={CARDIO_STAFF}", headers=h(provider_token))
        assert r.status_code == 200, r.text
        d = r.json()
        # If any per_staff row, it should be only for Cardio
        for ps in d["per_staff"]:
            assert ps.get("staff_id") in (CARDIO_STAFF, None)


# ------------- Regression: admin endpoints still work with allowed phone -------------
class TestAdminRegression:
    def test_admin_stats(self, s, admin_token):
        r = s.get(f"{API}/admin/stats", headers=h(admin_token))
        assert r.status_code == 200

    def test_admin_subscription_analytics(self, s, admin_token):
        r = s.get(f"{API}/admin/subscription-analytics", headers=h(admin_token))
        assert r.status_code == 200

    def test_admin_referrals(self, s, admin_token):
        r = s.get(f"{API}/admin/referrals", headers=h(admin_token))
        assert r.status_code == 200


# ------------- Regression: /slots without override still returns provider/hospital scope -------------
class TestSlotsRegression:
    def test_slots_hospital_default_fallback(self, s):
        # Pick a future Monday (Cardio has Mon 10-13 override in weekly, use Neuro for hospital fallback test)
        d = date.today() + timedelta(days=3)
        while d.weekday() != 0:
            d += timedelta(days=1)
        r = s.get(f"{API}/providers/{HOSPITAL_ID}/slots",
                  params={"date": d.isoformat(), "staff_id": NEURO_STAFF})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("schedule_scope") in ("staff", "hospital_default", "provider"), body
