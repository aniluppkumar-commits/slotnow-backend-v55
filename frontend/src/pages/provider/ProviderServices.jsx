import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { useI18n } from "@/i18n";
import { Loader2, Plus, Trash2, IndianRupee, Clock, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { isAutomobileProvider } from "@/lib/providerType";
import { compressImageToDataURL } from "@/lib/image";

export default function ProviderServices() {
  const { t } = useI18n();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", duration_min: 30, price: 500, description: "", service_type: "", photo: "" });
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [profile, setProfile] = useState(null);
  const isAutomobile = isAutomobileProvider(profile);

  const load = async () => {
    try {
      const [svcRes, profRes] = await Promise.all([
        api.get("/providers/me/services"),
        api.get("/providers/me/profile").catch(() => ({ data: null })),
      ]);
      setServices(svcRes.data || []);
      setProfile(profRes.data || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!form.name.trim()) return toast.error("Service name required");
    setSaving(true);
    try {
      await api.post("/providers/me/services", {
        name: form.name,
        duration_min: Number(form.duration_min) || 30,
        price: Number(form.price) || 0,
        description: form.description || null,
        service_type: form.service_type || null,
        photo: form.photo || null,
      });
      setForm({ name: "", duration_min: 30, price: 500, description: "", service_type: "", photo: "" });
      await load();
      toast.success("Service added");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const onPhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoUploading(true);
    try {
      const data = await compressImageToDataURL(f, { maxDim: 800, quality: 0.72 });
      setForm((prev) => ({ ...prev, photo: data }));
    } catch {
      toast.error("Could not upload photo");
    } finally {
      setPhotoUploading(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this service?")) return;
    try {
      await api.delete(`/providers/me/services/${id}`);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    }
  };

  return (
    <AppShell title={t("services")} showBack>
      <div className="px-4 sm:px-6 pt-4 space-y-5">
        {/* Add new */}
        <div className="bg-white border border-cream-300 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">{t("add_service")}</p>
          <input
            data-testid="service-name-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t("service_name")}
            className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
          />
          <input
            data-testid="service-description-input"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description (optional)"
            className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              data-testid="service-duration-input"
              type="number"
              min="5"
              step="5"
              value={form.duration_min}
              onChange={(e) => setForm({ ...form, duration_min: e.target.value })}
              placeholder={t("duration_min_label")}
              className="bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
            />
            <input
              data-testid="service-price-input"
              type="number"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder={t("price")}
              className="bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
            />
          </div>
          <input
            data-testid="service-type-input"
            value={form.service_type}
            onChange={(e) => setForm({ ...form, service_type: e.target.value })}
            placeholder="Vehicle type (optional, e.g., 'Two Wheeler')"
            className={`w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20 ${isAutomobile ? "" : "hidden"}`}
          />
          {/* Service photo (optional) */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-ink-muted mb-1">
              Service photo (optional)
            </label>
            <div className="flex items-center gap-3">
              {form.photo ? (
                <div className="relative">
                  <img src={form.photo} alt="preview" className="w-16 h-16 rounded-xl object-cover border border-cream-300" />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, photo: "" })}
                    className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-0.5"
                    aria-label="Remove photo"
                  ><X size={12} /></button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl bg-cream border border-dashed border-cream-300 flex items-center justify-center text-ink-muted">
                  <ImageIcon size={20} />
                </div>
              )}
              <label className="flex-1 cursor-pointer bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-sm text-ink-soft hover:bg-cream-200 text-center">
                {photoUploading ? "Uploading…" : (form.photo ? "Replace photo" : "Choose photo")}
                <input
                  type="file"
                  accept="image/*"
                  onChange={onPhoto}
                  className="hidden"
                  data-testid="service-photo-input"
                />
              </label>
            </div>
          </div>
          <button
            data-testid="service-add-btn"
            onClick={add}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-forest text-cream-100 py-2.5 rounded-xl font-bold hover:bg-forest-dark disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> {t("add")}</>}
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-forest" />
          </div>
        ) : services.length === 0 ? (
          <p className="text-sm text-ink-soft italic text-center py-6">{t("no_services_available")}</p>
        ) : (
          <div className="space-y-2">
            {services.map((s) => (
              <div key={s.id} data-testid={`svc-item-${s.id}`} className="bg-white border border-cream-300 rounded-xl p-4 flex justify-between items-start gap-3">
                {s.photo && (
                  <img
                    src={s.photo}
                    alt={s.name}
                    className="w-14 h-14 rounded-xl object-cover border border-cream-300 shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink text-sm">{s.name}</p>
                  {s.description && <p className="text-xs text-ink-soft mt-0.5">{s.description}</p>}
                  <div className="flex items-center gap-3 text-[11px] text-ink-muted mt-1.5">
                    <span className="flex items-center gap-0.5"><Clock size={11} strokeWidth={2} /> {s.duration_min} min</span>
                    <span className="flex items-center gap-0.5 text-forest font-bold"><IndianRupee size={11} strokeWidth={2.5} />{s.price}</span>
                    {s.service_type && <span className="text-ink-soft">· {s.service_type}</span>}
                  </div>
                </div>
                <button
                  data-testid={`svc-remove-${s.id}`}
                  onClick={() => remove(s.id)}
                  className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
