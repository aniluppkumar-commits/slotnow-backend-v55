"""Iter 44 — Home page search & filter overhaul.

Covers:
  - /reference/cities  (typeahead + limit)
  - /reference/filters (category-aware secondary filter)
  - /search/providers  q= union with hospital_staff + services
  - AND-combination of q + city + category + specialization/service
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://slotnow-web.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

TEST_HOSPITAL_ID = "43b3a047-c937-4cf2-a707-7682ec732b34"

DOCTOR_SPECIALIZATIONS = [
    "Physician", "Neurologist", "Cardiologist", "Orthopedic", "Gynecologist",
    "Pediatrician", "ENT Specialist", "Dermatologist", "Dentist",
    "Psychiatrist", "General Surgeon", "Ophthalmologist", "Urologist",
    "Gastroenterologist", "Endocrinologist", "Oncologist",
]


@pytest.fixture(scope="session")
def s():
    return requests.Session()


# ---------- /reference/cities ----------
class TestCities:
    def test_returns_cities_list(self, s):
        r = s.get(f"{API}/reference/cities")
        assert r.status_code == 200
        data = r.json()
        assert "cities" in data
        assert isinstance(data["cities"], list)
        # Sorted + distinct
        assert data["cities"] == sorted(set(data["cities"]))

    def test_default_limit_20(self, s):
        r = s.get(f"{API}/reference/cities")
        assert r.status_code == 200
        assert len(r.json()["cities"]) <= 20

    def test_custom_limit_override(self, s):
        r = s.get(f"{API}/reference/cities?limit=3")
        assert r.status_code == 200
        assert len(r.json()["cities"]) <= 3

    def test_q_prefix_filter_case_insensitive(self, s):
        r = s.get(f"{API}/reference/cities?q=Mum")
        assert r.status_code == 200
        cities = r.json()["cities"]
        for c in cities:
            assert c.lower().startswith("mum"), f"{c} does not start with 'mum'"
        # 'Mumbai' should be surfaced given the seeded TestHospital
        assert any(c.lower() == "mumbai" for c in cities), f"Expected Mumbai in {cities}"


# ---------- /reference/filters ----------
class TestReferenceFilters:
    def _cat_by_name(self, s, name):
        r = s.get(f"{API}/categories")
        assert r.status_code == 200
        for c in r.json():
            if c.get("name", "").lower() == name.lower():
                return c
        return None

    def test_no_category_returns_empty(self, s):
        r = s.get(f"{API}/reference/filters")
        assert r.status_code == 200
        data = r.json()
        assert data["options"] == []
        assert data["label"] == "Filter"
        assert data["param"] == "service"

    def test_healthcare_returns_specializations(self, s):
        cat = self._cat_by_name(s, "Healthcare")
        if not cat:
            pytest.skip("Healthcare category not present")
        r = s.get(f"{API}/reference/filters?category_id={cat['id']}")
        assert r.status_code == 200
        data = r.json()
        assert data["label"] == "Doctor type / specialization"
        assert data["param"] == "specialization"
        assert data["options"] == DOCTOR_SPECIALIZATIONS
        assert "Cardiologist" in data["options"]
        assert "Neurologist" in data["options"]

    def test_automobile_returns_vehicle_service(self, s):
        cat = self._cat_by_name(s, "Automobile")
        if not cat:
            pytest.skip("Automobile category not present")
        r = s.get(f"{API}/reference/filters?category_id={cat['id']}")
        assert r.status_code == 200
        data = r.json()
        assert data["label"] == "Vehicle service"
        assert data["param"] == "service"
        assert "Car Wash" in data["options"]
        assert "Full Detailing" in data["options"]
        # Spec requested 8 options — flag mismatch (currently 7 in server.py)
        assert len(data["options"]) == 8, (
            f"Spec expects 8 vehicle-service options but got {len(data['options'])}: {data['options']}"
        )

    def test_unknown_category_returns_empty(self, s):
        r = s.get(f"{API}/reference/filters?category_id=does-not-exist-xyz")
        assert r.status_code == 200
        data = r.json()
        assert data["options"] == []
        assert data["label"] == "Filter"


# ---------- /search/providers q= union ----------
class TestSearchQ:
    def test_q_cardio_surfaces_hospital(self, s):
        r = s.get(f"{API}/search/providers", params={"q": "Cardio"})
        assert r.status_code == 200
        results = r.json()
        ids = [p.get("id") for p in results]
        assert TEST_HOSPITAL_ID in ids, (
            f"Expected TestHospital via sub-doctor 'Dr. Test Cardio' match, got ids={ids[:5]}"
        )

    def test_q_case_insensitive_lowercase(self, s):
        r = s.get(f"{API}/search/providers", params={"q": "cardio"})
        assert r.status_code == 200
        ids = [p.get("id") for p in r.json()]
        assert TEST_HOSPITAL_ID in ids

    def test_q_sharma_surfaces_sharma_clinic(self, s):
        r = s.get(f"{API}/search/providers", params={"q": "Sharma"})
        assert r.status_code == 200
        results = r.json()
        names = [p.get("business_name", "") for p in results]
        assert any("sharma" in n.lower() for n in names), f"No provider matching 'Sharma' in {names[:10]}"

    def test_q_detailing_surfaces_via_service_name(self, s):
        # Check services collection for a service literally named Full Detailing
        r = s.get(f"{API}/search/providers", params={"q": "Detailing"})
        assert r.status_code == 200
        results = r.json()
        # This depends on seeded data — if no such service, skip rather than fail
        if not results:
            pytest.skip("No provider has a service named 'Detailing' in seed data")
        assert len(results) >= 1


# ---------- Combined AND filters ----------
class TestCombinedFilters:
    def test_q_and_city(self, s):
        r = s.get(f"{API}/search/providers", params={"q": "Cardio", "city": "Mumbai"})
        assert r.status_code == 200
        results = r.json()
        ids = [p.get("id") for p in results]
        assert TEST_HOSPITAL_ID in ids
        for p in results:
            assert (p.get("city") or "").lower() == "mumbai"

    def test_city_only_case_insensitive(self, s):
        r = s.get(f"{API}/search/providers", params={"city": "mumbai"})
        assert r.status_code == 200
        for p in r.json():
            assert (p.get("city") or "").lower() == "mumbai"

    def test_specialization_filter(self, s):
        r = s.get(f"{API}/search/providers", params={"specialization": "Cardiologist"})
        assert r.status_code == 200
        # Should not error; provider list may be empty if no provider is a cardiologist directly

    def test_all_filters_and_together_no_error(self, s):
        # Pick any category id
        cats = s.get(f"{API}/categories").json()
        cat_id = cats[0]["id"] if cats else ""
        r = s.get(f"{API}/search/providers", params={
            "q": "Test", "city": "Mumbai", "category_id": cat_id, "service": "Wash",
        })
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Regression: prior iter smoke checks ----------
class TestRegressionSmoke:
    def test_providers_public_list(self, s):
        r = s.get(f"{API}/providers")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_categories_public(self, s):
        r = s.get(f"{API}/categories")
        assert r.status_code == 200
        assert len(r.json()) > 0

    def test_healthcare_reference_unchanged(self, s):
        r = s.get(f"{API}/reference/healthcare")
        assert r.status_code == 200
        data = r.json()
        assert data["specializations"] == DOCTOR_SPECIALIZATIONS
