import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { useI18n } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import { Store, Loader2, Save } from "lucide-react";
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
    bio: "",
    city: "",
    address: "",
    contact_phone: "",
    image: "",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [catRes, meRes] = await Promise.all([
          api.get("/categories"),
          api.get("/providers/me/profile").catch(() => ({ data: null })),
        ]);
        setCategories(catRes.data || []);
        if (meRes.data) {
          setExisting(meRes.data);
          setForm((f) => ({ ...f, ...meRes.data }));
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
      await api.post("/providers/me/profile", form);
      await refreshMe();
      toast.success(t("provider_profile_updated"));
      navigate("/provider", { replace: true });
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
          <Field label="Business image URL (optional)">
            <input
              data-testid="onboarding-image"
              value={form.image || ""}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
              placeholder="https://images.unsplash.com/…"
              className="w-full bg-transparent outline-none text-ink font-medium placeholder:text-ink-muted"
            />
            {form.image && (
              <div className="mt-2 flex items-center gap-2">
                <img
                  src={form.image}
                  alt="Preview"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                  className="w-20 h-20 rounded-xl object-cover border border-cream-300"
                  data-testid="onboarding-image-preview"
                />
                <p className="text-[11px] text-ink-soft">
                  Preview — if the image doesn't load, paste a direct image URL (ends in .jpg / .png).
                </p>
              </div>
            )}
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
