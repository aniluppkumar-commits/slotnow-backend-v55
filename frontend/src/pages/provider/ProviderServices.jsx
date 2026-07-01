import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { useI18n } from "@/i18n";
import { Loader2, Plus, Trash2, IndianRupee, Clock } from "lucide-react";
import { toast } from "sonner";

export default function ProviderServices() {
  const { t } = useI18n();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", duration_min: 30, price: 500, description: "", service_type: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/providers/me/services");
      setServices(data || []);
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
      });
      setForm({ name: "", duration_min: 30, price: 500, description: "", service_type: "" });
      await load();
      toast.success("Service added");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setSaving(false);
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
            placeholder="Service type (optional, e.g., 'Two Wheeler')"
            className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
          />
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
                <div className="min-w-0">
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
