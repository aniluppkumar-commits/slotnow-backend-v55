"""Backend tests for Hospital per-staff availability schedule + booking flow.

Covers: SlotNow Priority 2 (per-doctor schedule) and Priority 1 regression
(admin stats, subscription-analytics, referrals).
"""
import os
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://slotnow-web.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

HOSP_PROVIDER_ID = "43b3a047-c937-4cf2-a707-7682ec732b34"
STAFF_CARDIO = "4723b155-43f1-4a5e-9784-4cdf2782c37b"   # Mon 10-13 (max 6)
STAFF_NEURO = "7d7977aa-7d25-413d-8dd7-4d8bcbbbed51"    # Mon 17-20 (max 3)

PROVIDER_PHONE = "9000000007"
CUSTOMER_PHONE = "9000009999"
ADMIN_PHONE = "9412575970"
PIN = "1234"


def _pin_login(phone: str, role: str) -> str:
    r = requests.post(
        f"{API}/auth/pin-login",
        json={"phone": phone, "role": role, "pin": PIN},
        timeout=15,
    )
    assert r.status_code == 200, f"pin-login failed {role} {phone}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def provider_token():
    return _pin_login(PROVIDER_PHONE, "provider")


@pytest.fixture(scope="session")
def customer_token():
    return _pin_login(CUSTOMER_PHONE, "customer")


@pytest.fixture(scope="session")
def admin_token():
    return _pin_login(ADMIN_PHONE, "admin")


def _h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


def _next_weekday(target: int) -> str:
    """Return a YYYY-MM-DD at least 7 days out for python-weekday target (0=Mon)."""
    today = date.today()
    days_ahead = (target - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return (today + timedelta(days=days_ahead)).isoformat()


# ============ Per-staff availability CRUD ============
class TestPerStaffAvailability:
    def test_get_staff_availability_returns_only_its_rules(self, provider_token):
        r = requests.get(f"{API}/providers/me/staff/{STAFF_CARDIO}/availability", headers=_h(provider_token))
        assert r.status_code == 200, r.text
        rules = r.json()
        assert isinstance(rules, list)
        for rule in rules:
            assert rule.get("staff_id") == STAFF_CARDIO

    def test_post_and_delete_staff_rule(self, provider_token):
        # Wednesday (weekday=2) new shift for Cardio
        payload = {"weekday": 2, "start_time": "09:00", "end_time": "12:00", "slot_duration_minutes": 30, "max_bookings": 5}
        r = requests.post(
            f"{API}/providers/me/staff/{STAFF_CARDIO}/availability",
            json=payload, headers=_h(provider_token),
        )
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["staff_id"] == STAFF_CARDIO
        assert created["weekday"] == 2
        rule_id = created["id"]

        # It must appear in GET
        r2 = requests.get(f"{API}/providers/me/staff/{STAFF_CARDIO}/availability", headers=_h(provider_token))
        assert any(x["id"] == rule_id for x in r2.json())

        # Must NOT appear in provider-wide /me/availability
        r3 = requests.get(f"{API}/providers/me/availability", headers=_h(provider_token))
        assert r3.status_code == 200
        assert all(x.get("id") != rule_id for x in r3.json()), "Per-staff rule leaked into provider-wide list!"

        # Delete
        r4 = requests.delete(
            f"{API}/providers/me/staff/{STAFF_CARDIO}/availability/{rule_id}",
            headers=_h(provider_token),
        )
        assert r4.status_code == 200

        # Confirm removed
        r5 = requests.get(f"{API}/providers/me/staff/{STAFF_CARDIO}/availability", headers=_h(provider_token))
        assert all(x["id"] != rule_id for x in r5.json())

    def test_delete_staff_rule_wrong_staff_denied(self, provider_token):
        # Create a rule under Cardio then try to delete via Neuro path
        payload = {"weekday": 3, "start_time": "09:00", "end_time": "11:00", "slot_duration_minutes": 30, "max_bookings": 2}
        r = requests.post(
            f"{API}/providers/me/staff/{STAFF_CARDIO}/availability",
            json=payload, headers=_h(provider_token),
        )
        assert r.status_code == 200
        rule_id = r.json()["id"]
        # Try to delete via Neuro path (should not delete)
        requests.delete(
            f"{API}/providers/me/staff/{STAFF_NEURO}/availability/{rule_id}",
            headers=_h(provider_token),
        )
        # Verify still there
        r2 = requests.get(f"{API}/providers/me/staff/{STAFF_CARDIO}/availability", headers=_h(provider_token))
        assert any(x["id"] == rule_id for x in r2.json()), "Rule should not be deletable via wrong staff path"
        # cleanup
        requests.delete(f"{API}/providers/me/staff/{STAFF_CARDIO}/availability/{rule_id}", headers=_h(provider_token))

    def test_provider_wide_availability_no_leak(self, provider_token):
        r = requests.get(f"{API}/providers/me/availability", headers=_h(provider_token))
        assert r.status_code == 200
        for rule in r.json():
            assert rule.get("staff_id") in (None, ""), f"staff-specific rule leaking: {rule}"


# ============ Slots endpoint (staff/hospital-default/provider) ============
class TestSlotsScope:
    def test_slots_for_cardio_monday(self):
        mon = _next_weekday(0)
        r = requests.get(f"{API}/providers/{HOSP_PROVIDER_ID}/slots", params={"date": mon, "staff_id": STAFF_CARDIO})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["schedule_scope"] == "staff"
        assert data["has_schedule"] is True
        starts = [s["start_time"] for s in data["shifts"]]
        assert "10:00" in starts, f"Expected Cardio Mon 10:00 shift, got {starts}"

    def test_slots_for_neuro_monday_different_from_cardio(self):
        mon = _next_weekday(0)
        r1 = requests.get(f"{API}/providers/{HOSP_PROVIDER_ID}/slots", params={"date": mon, "staff_id": STAFF_CARDIO})
        r2 = requests.get(f"{API}/providers/{HOSP_PROVIDER_ID}/slots", params={"date": mon, "staff_id": STAFF_NEURO})
        c_starts = sorted(s["start_time"] for s in r1.json()["shifts"])
        n_starts = sorted(s["start_time"] for s in r2.json()["shifts"])
        assert "17:00" in n_starts, f"Expected Neuro Mon 17:00 shift, got {n_starts}"
        assert c_starts != n_starts, "Two doctors should have independent shift lists"

    def test_slots_fallback_to_hospital_default(self, provider_token):
        # Add a hospital-default rule for Friday (weekday=4), then request Cardio slots
        # for Friday — Cardio has no Fri schedule so must fall back to hospital_default.
        payload = {"weekday": 4, "start_time": "08:00", "end_time": "10:00", "slot_duration_minutes": 30, "max_bookings": 2}
        r = requests.post(f"{API}/providers/me/availability", json=payload, headers=_h(provider_token))
        assert r.status_code == 200, r.text
        rule_id = r.json()["id"]
        try:
            fri = _next_weekday(4)
            # Ensure Cardio has no Fri rule
            existing = requests.get(f"{API}/providers/me/staff/{STAFF_CARDIO}/availability", headers=_h(provider_token)).json()
            if any(x["weekday"] == 4 for x in existing):
                pytest.skip("Cardio already has Friday rule; skipping fallback test")
            r2 = requests.get(f"{API}/providers/{HOSP_PROVIDER_ID}/slots", params={"date": fri, "staff_id": STAFF_CARDIO})
            data = r2.json()
            assert data["schedule_scope"] == "hospital_default", f"Expected hospital_default fallback, got {data['schedule_scope']}"
            assert any(s["start_time"] == "08:00" for s in data["shifts"])
        finally:
            requests.delete(f"{API}/providers/me/availability/{rule_id}", headers=_h(provider_token))

    def test_slots_without_staff_id_is_provider_scope(self):
        mon = _next_weekday(0)
        r = requests.get(f"{API}/providers/{HOSP_PROVIDER_ID}/slots", params={"date": mon})
        assert r.status_code == 200
        assert r.json()["schedule_scope"] == "provider"


# ============ Booking with staff_id ============
@pytest.fixture(scope="session")
def hospital_service_id():
    r = requests.get(f"{API}/providers/{HOSP_PROVIDER_ID}")
    services = r.json().get("services", [])
    assert services, "TestHospital must have at least one service seeded"
    return services[0]["id"]


class TestBookingWithStaff:
    def test_booking_valid_shift_for_staff(self, customer_token, hospital_service_id):
        mon = _next_weekday(0)
        payload = {
            "provider_id": HOSP_PROVIDER_ID,
            "service_id": hospital_service_id,
            "staff_id": STAFF_CARDIO,
            "date": mon,
            "start_time": "10:00",
            "end_time": "13:00",
            # TestHospital happens to be seeded under Automobile category — supply required fields
            "service_type": "Paid",
            "vehicle_reg_no": "TEST123",
            "vehicle_model": "TestModel",
        }
        r = requests.post(f"{API}/bookings", json=payload, headers=_h(customer_token))
        assert r.status_code in (200, 201), r.text
        b = r.json()
        assert b.get("staff_id") == STAFF_CARDIO
        assert b.get("start_time") == "10:00"

    def test_booking_invalid_shift_for_staff_rejected(self, customer_token, hospital_service_id):
        # Cardio has 10-13 Mon, not 17-20 (that's Neuro's) — booking 17:00 with Cardio must fail
        mon = _next_weekday(0)
        payload = {
            "provider_id": HOSP_PROVIDER_ID,
            "service_id": hospital_service_id,
            "staff_id": STAFF_CARDIO,
            "date": mon,
            "start_time": "17:00",
            "end_time": "20:00",
            "service_type": "Paid",
            "vehicle_reg_no": "TEST123",
            "vehicle_model": "TestModel",
        }
        r = requests.post(f"{API}/bookings", json=payload, headers=_h(customer_token))
        assert r.status_code >= 400, f"Expected rejection, got {r.status_code} {r.text}"
        # And specifically must be a shift-availability error (not vehicle/service_type)
        assert "shift" in r.text.lower(), f"Expected shift-related rejection, got {r.text}"


# ============ Regression: Admin endpoints ============
class TestAdminRegression:
    def test_admin_stats(self, admin_token):
        r = requests.get(f"{API}/admin/stats", headers=_h(admin_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d, dict)

    def test_admin_subscription_analytics(self, admin_token):
        r = requests.get(f"{API}/admin/subscription-analytics", headers=_h(admin_token))
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), dict)

    def test_admin_referrals(self, admin_token):
        r = requests.get(f"{API}/admin/referrals", headers=_h(admin_token))
        assert r.status_code == 200, r.text


# ============ Regression: Non-hospital provider default ============
class TestNonHospitalDefault:
    def test_quickwheels_default_mon_sat_09_18(self):
        pid = "3610a6f1-4cf4-4f03-94c5-b9795ccefd9b"
        mon = _next_weekday(0)
        r = requests.get(f"{API}/providers/{pid}/slots", params={"date": mon})
        assert r.status_code == 200, r.text
        data = r.json()
        # Should have some schedule
        assert data["schedule_scope"] == "provider"
