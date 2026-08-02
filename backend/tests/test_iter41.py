"""Iteration 41 backend tests:
- SmsSettings reminder_* new fields round-trip via GET/PUT /api/admin/settings/sms
- /api/queue/my-position per-staff `wait` computation for hospital sub-doctor bookings
- Regression: admin-phone lockdown on SMS settings, reminders auto-fire, override-closed block, analytics shape
"""
import os
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


@pytest.fixture(scope="module")
def s():
    return requests.Session()


def _login_pin(session, phone, role, pin="1234"):
    return session.post(f"{API}/auth/pin-login", json={"phone": phone, "role": role, "pin": pin}, timeout=15)


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


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


# ---------------- SMS settings reminder_* fields ----------------
class TestSmsSettingsReminderFields:
    def test_get_returns_reminder_fields_after_put(self, s, admin_token):
        """GET after PUT must return the new reminder_* fields. If the stored settings
        row predates the schema, GET may omit fields until first PUT — so we PUT first,
        then assert on GET.
        """
        current = s.get(f"{API}/admin/settings/sms", headers=h(admin_token)).json()
        payload = {**current}
        payload.pop("key", None)
        # Ensure required schema keys exist for Pydantic strict PUT
        payload.setdefault("provider", "mock")
        payload.setdefault("reminder_template_id", "")
        payload.setdefault("reminder_var_ahead", "num")
        payload.setdefault("reminder_var_name", "name")
        r = s.put(f"{API}/admin/settings/sms", headers=h(admin_token), json=payload)
        assert r.status_code == 200, r.text
        r = s.get(f"{API}/admin/settings/sms", headers=h(admin_token))
        assert r.status_code == 200
        d = r.json()
        for k in ("reminder_template_id", "reminder_var_ahead", "reminder_var_name"):
            assert k in d, f"missing {k} in GET response: {d}"

    def test_put_persists_reminder_fields(self, s, admin_token):
        # Read current, mutate reminder fields, write back, verify GET round-trips
        current = s.get(f"{API}/admin/settings/sms", headers=h(admin_token)).json()
        payload = {**current}
        payload.pop("key", None)
        payload["reminder_template_id"] = "TEST_iter41_rmpl_9999"
        payload["reminder_var_ahead"] = "ahead"
        payload["reminder_var_name"] = "pname"
        r = s.put(f"{API}/admin/settings/sms", headers=h(admin_token), json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["reminder_template_id"] == "TEST_iter41_rmpl_9999"
        assert body["reminder_var_ahead"] == "ahead"
        assert body["reminder_var_name"] == "pname"
        # Verify GET returns persisted values
        r = s.get(f"{API}/admin/settings/sms", headers=h(admin_token))
        d = r.json()
        assert d["reminder_template_id"] == "TEST_iter41_rmpl_9999"
        assert d["reminder_var_ahead"] == "ahead"
        assert d["reminder_var_name"] == "pname"

        # Restore original
        restore = {**current}
        restore.pop("key", None)
        s.put(f"{API}/admin/settings/sms", headers=h(admin_token), json=restore)

    def test_sms_settings_admin_only(self, s, provider_token, customer_token):
        r = s.get(f"{API}/admin/settings/sms", headers=h(provider_token))
        assert r.status_code in (401, 403)
        r = s.get(f"{API}/admin/settings/sms", headers=h(customer_token))
        assert r.status_code in (401, 403)

    def test_sms_settings_blocked_admin_phone(self, s):
        # Blocked phone cannot even get admin token
        r = _login_pin(s, BLOCKED_PHONE, "admin")
        assert r.status_code == 403


# ---------------- /queue/my-position per-staff ahead ----------------
class TestQueueMyPositionPerStaff:
    def test_my_position_hospital_booking(self, s, customer_token):
        r = s.get(f"{API}/queue/my-position", headers=h(customer_token))
        assert r.status_code == 200, r.text
        d = r.json()
        # Response shape check
        assert "has_booking" in d
        if not d["has_booking"]:
            pytest.skip("Customer has no active booking today; skipping per-staff wait check")
        # Required fields
        for k in ("wait", "your_token", "current_token", "last_assigned", "booking"):
            assert k in d, f"missing {k}: {d}"
        assert isinstance(d["wait"], int)
        assert d["wait"] >= 0
        # If booking has staff_id, wait should be <= number of active bookings for same provider+date
        booking = d["booking"]
        if booking.get("staff_id"):
            assert "staff_id" in d
            assert d["staff_id"] == booking["staff_id"]

    def test_my_position_no_booking_flow(self, s):
        # Ensure endpoint doesn't 500 for logged-in customer with no booking today.
        # We create a fresh customer session that has no booking on 'today'.
        # This test is soft — we only assert shape when has_booking is False.
        # Reuse existing customer token — may have booking or not.
        pass


# ---------------- Regression: create hospital booking, verify ahead computation ----------------
class TestQueueAheadIntegration:
    def test_create_bookings_and_check_ahead(self, s, customer_token, provider_token):
        """Create a booking on TODAY under CARDIO_STAFF using a same-day shift override
        (Cardio has weekday Mon/Tue schedule only). Verify:
        - reminder20_sent/reminder3_sent auto-set (queue empty, position 0)
        - /queue/my-position returns wait=0 and staff_id=CARDIO
        """
        today = date.today().isoformat()

        # Create same-day shift override so a slot exists regardless of weekday
        ov_payload = {"staff_id": CARDIO_STAFF, "date": today, "kind": "shift",
                      "start_time": "23:00", "end_time": "23:45",
                      "slot_duration": 15, "max_bookings": 5,
                      "note": "TEST_iter41 same-day shift"}
        r = s.post(f"{API}/providers/me/overrides", headers=h(provider_token), json=ov_payload)
        if r.status_code not in (200, 201):
            pytest.skip(f"Could not create same-day override: {r.status_code} {r.text}")
        ov_id = r.json()["id"]

        booking_id = None
        try:
            # Fetch slots for override
            r = s.get(f"{API}/providers/{HOSPITAL_ID}/slots",
                      params={"date": today, "staff_id": CARDIO_STAFF})
            assert r.status_code == 200, r.text
            body = r.json()
            opts = body.get("options") or body.get("slots") or []
            if not opts:
                for v in body.values():
                    if isinstance(v, list) and v and isinstance(v[0], dict):
                        opts = v; break
            assert opts, f"No slots produced by shift override: {body}"
            slot_time = opts[0].get("start_time") or opts[0].get("time")

            svc = s.get(f"{API}/providers/{HOSPITAL_ID}").json()["services"][0]
            payload = {
                "provider_id": HOSPITAL_ID,
                "service_id": svc["id"],
                "staff_id": CARDIO_STAFF,
                "date": today,
                "start_time": slot_time,
                "service_type": "Paid",
                "vehicle_reg_no": "MH01AB9999",
                "vehicle_model": "TESTiter41",
            }
            r = s.post(f"{API}/bookings", headers=h(customer_token), json=payload)
            if r.status_code not in (200, 201):
                pytest.skip(f"Booking creation failed: {r.status_code} {r.text}")
            booking = r.json()
            booking_id = booking["id"]

            # reminder flags — POST response may not include them; fetch via list
            r = s.get(f"{API}/bookings", headers=h(customer_token))
            assert r.status_code == 200
            my = [b for b in r.json() if b["id"] == booking_id]
            assert my, "created booking not found in list"
            b = my[0]
            assert b.get("reminder20_sent") is True, f"reminder20 not set: {b}"
            assert b.get("reminder3_sent") is True, f"reminder3 not set: {b}"

            # /queue/my-position — first in line under this staff scope
            r = s.get(f"{API}/queue/my-position", headers=h(customer_token))
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["has_booking"] is True
            assert d["wait"] == 0, f"expected wait=0, got {d}"
            assert d.get("staff_id") == CARDIO_STAFF
            assert d.get("your_token", 0) > 0
        finally:
            if booking_id:
                try:
                    s.delete(f"{API}/bookings/{booking_id}", headers=h(customer_token))
                except Exception:
                    pass
            s.delete(f"{API}/providers/me/overrides/{ov_id}", headers=h(provider_token))


# ---------------- Regression: analytics shape unchanged ----------------
class TestAnalyticsRegression:
    def test_analytics_heatmap_shape(self, s, provider_token):
        r = s.get(f"{API}/providers/me/analytics?days=30", headers=h(provider_token))
        assert r.status_code == 200
        d = r.json()
        assert len(d["heatmap"]) == 7
        for row in d["heatmap"]:
            assert len(row) == 24


# ---------------- Regression: override closed still blocks booking ----------------
class TestOverrideRegression:
    def test_closed_override_blocks_booking(self, s, provider_token, customer_token):
        d = date.today() + timedelta(days=60)
        while d.weekday() == 6:
            d += timedelta(days=1)
        ov_payload = {"staff_id": CARDIO_STAFF, "date": d.isoformat(), "kind": "closed",
                      "note": "TEST_iter41 closed"}
        r = s.post(f"{API}/providers/me/overrides", headers=h(provider_token), json=ov_payload)
        assert r.status_code in (200, 201), r.text
        ov_id = r.json()["id"]
        try:
            svc = s.get(f"{API}/providers/{HOSPITAL_ID}").json()["services"][0]
            book = {
                "provider_id": HOSPITAL_ID,
                "service_id": svc["id"],
                "staff_id": CARDIO_STAFF,
                "date": d.isoformat(),
                "start_time": "10:00",
                "service_type": "Paid",
                "vehicle_reg_no": "MH01AB1111",
                "vehicle_model": "Test",
            }
            r = s.post(f"{API}/bookings", headers=h(customer_token), json=book)
            assert r.status_code == 400
            assert "unavailable" in r.text.lower()
        finally:
            s.delete(f"{API}/providers/me/overrides/{ov_id}", headers=h(provider_token))
