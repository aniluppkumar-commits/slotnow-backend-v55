// Category-based UX gating helpers. Use the human-readable category NAME
// (case-insensitive) rather than a hardcoded UUID because seeded category ids
// differ between environments (dev/prod).
const norm = (s) => String(s || "").trim().toLowerCase();

export function isAutomobileProvider(provider) {
  if (!provider) return false;
  const name = provider.category_name || provider.category?.name || "";
  return norm(name) === "automobile";
}

export function isHealthcareProvider(provider) {
  if (!provider) return false;
  const name = provider.category_name || provider.category?.name || "";
  return norm(name) === "healthcare";
}

// Whether the provider is a Hospital (a Healthcare provider whose
// provider_type is 'hospital'). Hospitals structure their offerings as
// Doctors + Other Services.
export function isHospitalProvider(provider) {
  if (!provider) return false;
  return isHealthcareProvider(provider) && provider.provider_type === "hospital";
}
