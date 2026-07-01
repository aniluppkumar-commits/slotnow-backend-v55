import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export default function AdminSettings() {
  const { kind } = useParams(); // 'sms' or 'payment'
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const endpoint = kind === "payment" ? "/admin/settings/payment" : "/admin/settings/sms";
  const title = kind === "payment" ? "Payment settings" : "SMS settings";

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(endpoint);
        setForm(data || {});
      } catch (e) {
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, [endpoint]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(endpoint, form);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell title={title} showBack>
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-forest" />
        </div>
      </AppShell>
    );
  }

  const keys = Object.keys(form || {});

  return (
    <AppShell title={title} showBack>
      <div className="px-4 sm:px-6 pt-4 space-y-4">
        <div className="bg-white border border-cream-300 rounded-2xl p-4 space-y-3">
          {keys.length === 0 && (
            <p className="text-sm text-ink-soft italic text-center py-4">No settings configured</p>
          )}
          {keys.map((k) => {
            const val = form[k];
            const isBool = typeof val === "boolean";
            const isNumber = typeof val === "number";
            return (
              <label key={k} className="block py-2 border-b border-cream-300 last:border-0">
                <div className="text-[10px] uppercase tracking-wider font-bold text-ink-muted mb-1">
                  {k.replace(/_/g, " ")}
                </div>
                {isBool ? (
                  <button
                    data-testid={`admin-setting-${k}`}
                    onClick={() => setForm({ ...form, [k]: !val })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      val ? "bg-emerald-100 text-emerald-800" : "bg-cream-200 text-ink-soft"
                    }`}
                  >
                    {val ? "ON" : "OFF"}
                  </button>
                ) : (
                  <input
                    data-testid={`admin-setting-${k}`}
                    type={isNumber ? "number" : "text"}
                    value={val ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [k]: isNumber ? Number(e.target.value) : e.target.value,
                      })
                    }
                    className="w-full bg-transparent outline-none text-ink font-medium"
                  />
                )}
              </label>
            );
          })}
        </div>

        {keys.length > 0 && (
          <button
            data-testid="admin-settings-save-btn"
            onClick={save}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-accent text-white py-3 rounded-xl font-bold hover:bg-accent-dark transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> Save</>}
          </button>
        )}
      </div>
    </AppShell>
  );
}
