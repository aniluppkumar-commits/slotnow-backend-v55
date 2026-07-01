import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { useI18n } from "@/i18n";
import { Loader2, Plus, Trash2, ShieldOff, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";

export default function ProviderAssistants() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", phone: "", designation: "" });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/providers/me/assistants");
      setItems(Array.isArray(data) ? data : data?.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    if (!/^\d{10}$/.test(form.phone)) return toast.error("Valid 10-digit phone required");
    setSaving(true);
    try {
      await api.post("/providers/me/assistants", {
        name: form.name,
        phone: form.phone,
        designation: form.designation || "",
      });
      toast.success("Assistant added");
      setForm({ name: "", phone: "", designation: "" });
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleBlock = async (a) => {
    setBusyId(a.id);
    try {
      await api.put(`/providers/me/assistants/${a.id}/block`, { blocked: !a.blocked });
      toast.success(a.blocked ? "Unblocked" : "Blocked");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (a) => {
    if (!window.confirm(`Remove ${a.name}?`)) return;
    setBusyId(a.id);
    try {
      await api.delete(`/providers/me/assistants/${a.id}`);
      toast.success("Removed");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppShell title="Service Assistants" showBack>
      <div className="px-4 sm:px-6 pt-4 space-y-5">
        {/* Add form */}
        <div className="bg-white border border-cream-300 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-soft flex items-center gap-1.5">
            <UserCog size={13} strokeWidth={2.5} />
            Add assistant
          </p>
          <input
            data-testid="assistant-name-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Full name *"
            className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
          />
          <input
            data-testid="assistant-phone-input"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
            placeholder="Phone (10-digit) *"
            inputMode="numeric"
            className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
          />
          <input
            data-testid="assistant-designation-input"
            value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
            placeholder="Designation (optional)"
            className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
          />
          <button
            data-testid="assistant-add-btn"
            onClick={add}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-accent text-white py-2.5 rounded-xl font-bold hover:bg-accent-dark disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> Add</>}
          </button>
          <p className="text-[11px] text-ink-soft">
            Your assistant will log in at slotnow with the role <strong>Service Assistant</strong> and this same phone number.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-forest" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-ink-soft italic text-center py-6">No assistants yet</p>
        ) : (
          <div className="space-y-2">
            {items.map((a) => (
              <div
                key={a.id}
                data-testid={`assistant-item-${a.id}`}
                className={`bg-white border border-cream-300 rounded-xl p-3 flex items-center gap-3 ${
                  a.blocked ? "opacity-60" : ""
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-forest-faint text-forest flex items-center justify-center font-bold">
                  {a.name?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink truncate">{a.name}</p>
                  <p className="text-[11px] text-ink-soft truncate">
                    +91 {a.phone} {a.designation && `· ${a.designation}`}
                  </p>
                  {a.blocked && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded inline-block mt-0.5">
                      Blocked
                    </span>
                  )}
                </div>
                <button
                  data-testid={`assistant-block-${a.id}`}
                  onClick={() => toggleBlock(a)}
                  disabled={busyId === a.id}
                  className={`p-2 rounded-lg ${a.blocked ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                >
                  {a.blocked ? <ShieldCheck size={16} /> : <ShieldOff size={16} />}
                </button>
                <button
                  data-testid={`assistant-remove-${a.id}`}
                  onClick={() => remove(a)}
                  disabled={busyId === a.id}
                  className="p-2 rounded-lg bg-rose-50 text-rose-700"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
