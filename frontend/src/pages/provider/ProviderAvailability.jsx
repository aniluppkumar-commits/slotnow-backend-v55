import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { useI18n } from "@/i18n";
import { Loader2, Plus, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";

const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ProviderAvailability() {
  const { t } = useI18n();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    weekday: 1,
    start_time: "09:00",
    end_time: "18:00",
    slot_duration: 30,
    max_bookings: "",
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/providers/me/availability");
      setRules(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    setSaving(true);
    try {
      await api.post("/providers/me/availability", {
        weekday: Number(form.weekday),
        start_time: form.start_time,
        end_time: form.end_time,
        slot_duration: Number(form.slot_duration) || 30,
        max_bookings: form.max_bookings === "" ? null : Number(form.max_bookings),
      });
      await load();
      toast.success("Availability added");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this window?")) return;
    try {
      await api.delete(`/providers/me/availability/${id}`);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    }
  };

  const weekdays = t("weekdays") || WEEKDAYS_EN;

  return (
    <AppShell title={t("availability")} showBack>
      <div className="px-4 sm:px-6 pt-4 space-y-5">
        <div className="bg-white border border-cream-300 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">{t("add_availability")}</p>
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">{t("weekday")}</label>
            <div className="grid grid-cols-7 gap-1 mt-1">
              {weekdays.map((d, idx) => (
                <button
                  key={idx}
                  data-testid={`avail-day-${idx}`}
                  onClick={() => setForm({ ...form, weekday: idx })}
                  className={`py-2 rounded-lg text-xs font-bold ${
                    Number(form.weekday) === idx
                      ? "bg-forest text-cream-100"
                      : "bg-cream border border-cream-300 text-ink"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <TimeInput
              testid="avail-start"
              label={t("start_time")}
              value={form.start_time}
              onChange={(v) => setForm({ ...form, start_time: v })}
            />
            <TimeInput
              testid="avail-end"
              label={t("end_time")}
              value={form.end_time}
              onChange={(v) => setForm({ ...form, end_time: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">{t("slot_duration_min")}</label>
              <input
                data-testid="avail-slot-duration"
                type="number"
                min="5"
                step="5"
                value={form.slot_duration}
                onChange={(e) => setForm({ ...form, slot_duration: e.target.value })}
                className="w-full mt-1 bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">{t("max_bookings")}</label>
              <input
                data-testid="avail-max"
                type="number"
                min="0"
                value={form.max_bookings}
                onChange={(e) => setForm({ ...form, max_bookings: e.target.value })}
                placeholder="Blank = auto"
                className="w-full mt-1 bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
              />
            </div>
          </div>
          <button
            data-testid="avail-add-btn"
            onClick={add}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-forest text-cream-100 py-2.5 rounded-xl font-bold hover:bg-forest-dark disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> {t("add")}</>}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-forest" />
          </div>
        ) : rules.length === 0 ? (
          <p className="text-sm text-ink-soft italic text-center py-6">No availability windows set</p>
        ) : (
          <div className="space-y-2">
            {rules.map((r) => (
              <div key={r.id} data-testid={`avail-rule-${r.id}`} className="bg-white border border-cream-300 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="font-bold text-ink text-sm">{weekdays[r.weekday]}</p>
                  <div className="flex items-center gap-1 text-xs text-ink-soft mt-0.5">
                    <Clock size={11} />
                    {r.start_time} – {r.end_time} · {r.slot_duration} min slots
                    {r.max_bookings != null && ` · max ${r.max_bookings}`}
                  </div>
                </div>
                <button
                  data-testid={`avail-remove-${r.id}`}
                  onClick={() => remove(r.id)}
                  className="p-2 rounded-lg text-rose-500 hover:bg-rose-50"
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

function TimeInput({ label, value, onChange, testid }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">{label}</label>
      <input
        data-testid={testid}
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
      />
    </div>
  );
}
