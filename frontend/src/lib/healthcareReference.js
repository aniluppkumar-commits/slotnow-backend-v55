// Shared healthcare reference data.
//
// The backend exposes `/api/reference/healthcare` with `provider_types`,
// `specializations`, and `services`. Older backends (e.g. the mobile-app-shared
// deployment) may not have this endpoint yet — in that case the frontend falls
// back to this hardcoded list so onboarding + search still work.
//
// The lists here MUST stay in sync with `DOCTOR_SPECIALIZATIONS` and
// `DIAGNOSTIC_SERVICES` in `/app/backend/server.py`.

import api from "@/lib/api";

export const HEALTHCARE_REFERENCE_FALLBACK = {
  provider_types: [
    { key: "hospital", label: "Hospital" },
    { key: "clinic", label: "Doctor / Clinic" },
    { key: "service", label: "Any Service" },
  ],
  specializations: [
    "Physician", "Neurologist", "Cardiologist", "Orthopedic", "Gynecologist",
    "Pediatrician", "ENT Specialist", "Dermatologist", "Dentist",
    "Psychiatrist", "General Surgeon", "Ophthalmologist", "Urologist",
    "Gastroenterologist", "Endocrinologist", "Oncologist",
  ],
  services: [
    "X-ray", "MRI", "CT scan", "Ultrasound / USG", "ECG",
    "Blood test / Pathology", "Sonography", "Endoscopy",
    "Mammography", "PET scan", "Dialysis", "Vaccination",
  ],
};

// Fetches healthcare reference lists and merges each sub-list with the
// hardcoded fallback (so a partial response still gets full dropdown options).
// Never throws — returns the fallback if the endpoint is missing or errors.
export async function fetchHealthcareReference() {
  try {
    const res = await api.get("/reference/healthcare");
    const data = res.data || {};
    return {
      provider_types: data.provider_types?.length
        ? data.provider_types
        : HEALTHCARE_REFERENCE_FALLBACK.provider_types,
      specializations: data.specializations?.length
        ? data.specializations
        : HEALTHCARE_REFERENCE_FALLBACK.specializations,
      services: data.services?.length
        ? data.services
        : HEALTHCARE_REFERENCE_FALLBACK.services,
    };
  } catch {
    return HEALTHCARE_REFERENCE_FALLBACK;
  }
}
