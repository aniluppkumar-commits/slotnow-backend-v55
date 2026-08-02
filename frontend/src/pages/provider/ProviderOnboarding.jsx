import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { useI18n } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import { compressImageToDataURL } from "@/lib/image";
import { packAddress, unpackAddress } from "@/lib/address";
import LocationPickerModal from "@/components/LocationPickerModal";
import { Store, Loader2, Save, Upload, ImageIcon, X as XIcon, MapPin } from "lucide-react";
import { toast } from "sonner";

export default function ProviderOnboarding() {
  const { t } = useI18n();
  const { refreshMe } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [existing, setExisting] = useState(null);
  const [form, setForm] = useState({
    business_name: "",
    category_id: "",
    provider_type: "",
    specialization: "",
    service_tags: [],
    bio: "",
    city: "",
    address: "",
    contact_phone: "",
    image: "",
    location_link: "",
  });
  const [reference, setReference] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await compressImageToDataURL(file, { maxDim: 800, quality: 0.75 });
      const kb = Math.round((dataUrl.length * 3) / 4 / 1024);
      setForm((f) => ({ ...f, image: dataUrl }));
      toast.success(`Image uploaded (~${kb} KB)`);
    } catch (err) {
      toast.error(err.message || "Failed to load image");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [catRes, meRes] = await Promise.all([
          api.get("/categories"),
          api.get("/providers/me/profile").catch(() => ({ data: null })),
        ]);
        setCategories(catRes.data || []);
        try {
          const refRes = await api.get("/reference/healthcare");
          setReference(refRes.data);
        } catch {
          setReference({ provider_types: [], specializations: [], services: [] });
        }
        if (meRes.data) {
          setExisting(meRes.data);
          // Backend stores map link piggy-backed inside address — split before showing.
          const { text, mapLink } = unpackAddress(meRes.data.address);
          setForm((f) => ({
            ...f,
            ...meRes.data,
            address: text,
            location_link: mapLink,
          }));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    if (!form.business_name || !form.category_id || !form.city || !form.address) {
      return toast.error("Please fill business name, category, city, address");
    }
    setSaving(true);
    try {
      // Pack the map link back into the address field before sending — backend has
      // no dedicated location_link column, so we co-store them and split on read.
      const payload = {
        ...form,
        address: packAddress(form.address, form.location_link),
      };
      delete payload.location_link;
      await api.post("/providers/me/profile", payload);
      await refreshMe();
      toast.success(t("provider_profile_updated"));
      // Guide hospital-type providers to add doctors/services as the next natural step
      if (form.provider_type === "hospital") {
        navigate("/provider/staff", { replace: true });
      } else {
        navigate("/provider", { replace: true });
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell title={t("become_provider")}>
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-forest" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("become_provider")}>
      <div className="px-4 sm:px-6 pt-4 space-y-5">
        {(() => {
          // Simple progress indicator — counts required fields complete.
          const req = [
            !!form.business_name,
            !!form.category_id,
            !!form.city,
            !!form.address,
          ];
          const done = req.filter(Boolean).length;
          const pct = Math.round((done / req.length) * 100);
          return (
            <div className="bg-white border border-cream-300 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                  Setup progress
                </p>
                <p className="text-xs font-bold text-forest">{done}/{req.length} complete</p>
              </div>
              <div className="h-2 bg-cream-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-forest transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <div className={`px-2 py-1.5 rounded-lg font-bold text-center ${form.business_name && form.category_id ? "bg-forest/10 text-forest" : "bg-cream-200 text-ink-muted"}`}>
                  1. Basics
                </div>
                <div className={`px-2 py-1.5 rounded-lg font-bold text-center ${form.city && form.address ? "bg-forest/10 text-forest" : "bg-cream-200 text-ink-muted"}`}>
                  2. Location
                </div>
                <div className={`px-2 py-1.5 rounded-lg font-bold text-center ${form.image ? "bg-forest/10 text-forest" : "bg-cream-200 text-ink-muted"}`}>
                  3. Photo
                </div>
              </div>
            </div>
          );
        })()}
        <div className="bg-forest-faint rounded-2xl p-4 flex items-start gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-forest shrink-0">
            <Store size={20} />
          </div>
          <div>
            <p className="font-heading font-bold text-ink">{t("become_provider")}</p>
            <p className="text-xs text-ink-soft mt-0.5">{t("onboarding_intro")}</p>
          </div>
        </div>

        <div className="bg-white border border-cream-300 rounded-2xl p-4 space-y-3">
          <Field label={t("business_name")} required>
            <input
              data-testid="onboarding-business-name"
              value={form.business_name}
              onChange={(e) => setForm({ ...form, business_name: e.target.value })}
              placeholder="Sharma Clinic"
              className="w-full bg-transparent outline-none text-ink font-medium placeholder:text-ink-muted"
            />
          </Field>
          <Field label={t("category")} required>
            <select
              data-testid="onboarding-category"
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full bg-transparent outline-none text-ink font-medium"
            >
              <option value="">— Select category —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{`${c.name} / ${c.name_hi}`}</option>
              ))}            </select>
          </Field>
          {(() => {
            const selCat = categories.find((c) => c.id === form.category_id);
            const isHealthcare = selCat?.name?.toLowerCase() === "healthcare";
            if (!isHealthcare) return null;
            const isClinic = form.provider_type === "doctor_clinic";
            const showServices =
              form.provider_type === "hospital" ||
              form.provider_type === "diagnostic_center";
            return (
              <>
                <Field label="Provider type" required>
                  <select
                    data-testid="onboarding-provider-type"
                    value={form.provider_type}
                    onChange={(e) => setForm({ ...form, provider_type: e.target.value })}
                    className="w-full bg-transparent outline-none text-ink font-medium"
                  >
                    <option value="">— Select type —</option>
                    {(reference?.provider_types || []).map((pt) => (
                      <option key={pt.key} value={pt.key}>{pt.label}</option>
                    ))}
                  </select>
                </Field>
                {isClinic && (
                  <Field label="Doctor specialization">
                    <select
                      data-testid="onboarding-specialization"
                      value={form.specialization_choice ?? (
                        form.specialization && !(reference?.specializations || []).includes(form.specialization)
                          ? "__other__"
                          : (form.specialization || "")
                      )}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "__other__") {
                          setForm({ ...form, specialization_choice: "__other__", specialization: form.specialization && !(reference?.specializations || []).includes(form.specialization) ? form.specialization : "" });
                        } else {
                          setForm({ ...form, specialization_choice: v, specialization: v });
                        }
                      }}
                      className="w-full bg-transparent outline-none text-ink font-medium"
                    >
                      <option value="">— Select specialization —</option>
                      {(reference?.specializations || []).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                      <option value="__other__">Other (specify below)</option>
                    </select>
                  </Field>
                )}
                {isClinic && form.specialization_choice === "__other__" && (
                  <Field label="Custom specialization">
                    <input
                      data-testid="onboarding-specialization-other"
                      value={form.specialization || ""}
                      onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                      placeholder="Type doctor type / specialization"
                      className="w-full bg-transparent outline-none text-ink font-medium"
                    />
                  </Field>
                )}
                {showServices && (
                  <Field label="Services offered">
                    <div
                      data-testid="onboarding-services"
                      className="flex flex-wrap gap-2 py-1"
                    >
                      {(reference?.services || []).map((s) => {
                        const on = form.service_tags?.includes(s);
                        return (
                          <button
                            type="button"
                            key={s}
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                service_tags: on
                                  ? (f.service_tags || []).filter((x) => x !== s)
                                  : [...(f.service_tags || []), s],
                              }))
                            }
                            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                              on
                                ? "bg-forest text-white border-forest"
                                : "bg-white text-ink border-cream-300 hover:border-forest"
                            }`}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                )}
              </>
            );
          })()}
          <Field label={t("bio")}>
            <textarea
              data-testid="onboarding-bio"
              value={form.bio || ""}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              rows={3}
              placeholder={t("bio_placeholder")}
              className="w-full bg-transparent outline-none text-ink font-medium placeholder:text-ink-muted resize-none"
            />
          </Field>
          <Field label={t("city")} required>
            <input
              data-testid="onboarding-city"
              value={form.city || ""}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Mumbai"
              className="w-full bg-transparent outline-none text-ink font-medium placeholder:text-ink-muted"
            />
          </Field>
          <Field label={t("address")} required>
            <input
              data-testid="onboarding-address"
              value={form.address || ""}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Full address"
              className="w-full bg-transparent outline-none text-ink font-medium placeholder:text-ink-muted"
            />
          </Field>
          <Field label="Clinic location (Google Maps link)">
            <div className="w-full">
              <button
                type="button"
                data-testid="onboarding-location-btn"
                onClick={() => setLocOpen(true)}
                className="w-full flex items-center gap-2 text-left"
              >
                <span
                  className={`flex-1 truncate text-sm ${
                    form.location_link ? "text-ink font-medium" : "text-ink-muted italic"
                  }`}
                  data-testid="onboarding-location-display"
                >
                  {form.location_link || "Tap to pin your clinic on the map"}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-forest-faint text-forest px-2 py-1 rounded-lg shrink-0">
                  <MapPin size={11} strokeWidth={2.5} />
                  {form.location_link ? "Change" : "Pin"}
                </span>
              </button>
              {/* Hidden input to keep the previous testid working for tests that read the value */}
              <input
                type="hidden"
                data-testid="onboarding-location-link"
                value={form.location_link || ""}
                readOnly
              />
              <p className="text-[10px] text-ink-muted mt-1">
                Customers will see a &quot;Get Directions&quot; button that opens this link.
              </p>
            </div>
          </Field>
          <Field label="Business image">
            <div className="space-y-2">
              {form.image && (
                <div className="relative w-24 h-24">
                  <img
                    src={form.image}
                    alt="Preview"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                    className="w-24 h-24 rounded-xl object-cover border border-cream-300"
                    data-testid="onboarding-image-preview"
                  />
                  <button
                    type="button"
                    data-testid="onboarding-image-clear"
                    onClick={() => setForm({ ...form, image: "" })}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md"
                    title="Remove"
                  >
                    <XIcon size={12} strokeWidth={3} />
                  </button>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFile}
                data-testid="onboarding-image-file"
                className="hidden"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="onboarding-image-upload-btn"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex-1 flex items-center justify-center gap-2 bg-forest text-white text-sm font-bold py-2.5 rounded-xl hover:bg-forest-dark disabled:opacity-60"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <><Upload size={14} strokeWidth={2.5} /> Upload image</>}
                </button>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-ink-muted flex items-center gap-1">
                  <ImageIcon size={10} /> Or paste an image URL
                </label>
                <input
                  data-testid="onboarding-image"
                  value={form.image && form.image.startsWith("data:") ? "" : (form.image || "")}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  placeholder="https://images.unsplash.com/…"
                  className="w-full mt-1 bg-cream border border-cream-300 rounded-xl px-3 py-2 text-ink text-sm outline-none focus:ring-2 focus:ring-forest/20"
                />
              </div>
            </div>
          </Field>
        </div>

        <button
          data-testid="onboarding-save-btn"
          onClick={save}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-forest text-cream-100 py-3.5 rounded-xl font-bold hover:bg-forest-dark transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> {t("save_profile")}</>}
        </button>
      </div>

      <LocationPickerModal
        open={locOpen}
        onClose={() => setLocOpen(false)}
        initial={form.location_link}
        onSave={(url) => setForm((f) => ({ ...f, location_link: url }))}
      />
    </AppShell>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block py-2 border-b border-cream-300 last:border-0">
      <div className="text-[10px] uppercase tracking-wider font-bold text-ink-muted mb-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </div>
      {children}
    </label>
  );
}
