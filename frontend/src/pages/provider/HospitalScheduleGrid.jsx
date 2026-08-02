import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { Loader2, Plus, Trash2, Copy, Stethoscope, Building2 } from "lucide-react";
import { toast } from "sonner";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const jsToPyWeekday = (js) => (js === 0 ? 6 : js - 1);
const pyToJsWeekday = (py) => (py + 1) % 7;

// Weekly grid editor for ALL hospital doctors/services at once. Each row = staff,
// each cell = a weekday. Provider can add/remove shifts inline and copy one
// weekday's schedule to another day in one click.
export default function HospitalScheduleGrid() {
  const navigate = useNavigate();
  const [staff, setStaff] = useState([]);
  const [rulesByStaff, setRulesByStaff] = useState({}); // { staff_id: [rule, rule, ...] }
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(null); // { staff_id, jsDay }
  const [form, setForm] = useState({ start_time: "09:00", end_time: "13:00", slot_duration: 30, max_bookings: "" });
  const [copyOpen, setCopyOpen] = useState(null); // { staff_id, fromDay }
  const [copyTargets, setCopyTargets] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows } = await api.get("/providers/me/staff");
      const list = Array.isArray(rows) ? rows : [];
      setStaff(list);
      // fetch all schedules in parallel
      const pairs = await Promise.all(
        list.map(async (s) => {
          try {
            const { data } = await api.get(`/providers/me/staff/${s.id}/availability`);
            return [s.id, Array.isArray(data) ? data : []];
          } catch {
            return [s.id, []];
          }
        }),
      );
      const map = {};
      pairs.forEach(([sid, arr]) => { map[sid] = arr; });
      setRulesByStaff(map);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rulesFor = (staffId, jsDay) => {
    const py = jsToPyWeekday(jsDay);
    return (rulesByStaff[staffId] || []).filter((r) => r.weekday === py)
      .sort((a, b) => (a.start_time > b.start_time ? 1 : -1));
  };

  const addShift = async () => {
    if (!addOpen) return;
    if (form.start_time >= form.end_time) return toast.error("End must be after start");
    setBusy(true);
    try {
      await api.post(`/providers/me/staff/${addOpen.staff_id}/availability`, {
        weekday: jsToPyWeekday(addOpen.jsDay),
        start_time: form.start_time,
        end_time: form.end_time,
        slot_duration: Number(form.slot_duration) || 30,
        max_bookings: form.max_bookings === "" ? null : Number(form.max_bookings),
      });
      toast.success("Shift added");
      setAddOpen(null);
      setForm({ start_time: "09:00", end_time: "13:00", slot_duration: 30, max_bookings: "" });
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (staffId, ruleId) => {
    try {
      await api.delete(`/providers/me/staff/${staffId}/availability/${ruleId}`);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  const runCopy = async () => {
    if (!copyOpen || copyTargets.length === 0) return;
    setBusy(true);
    try {
      const sourceRules = rulesFor(copyOpen.staff_id, copyOpen.fromDay);
      for (const targetJsDay of copyTargets) {
        for (const r of sourceRules) {
          await api.post(`/providers/me/staff/${copyOpen.staff_id}/availability`, {
            weekday: jsToPyWeekday(targetJsDay),
            start_time: r.start_time,
            end_time: r.end_time,
            slot_duration: r.slot_duration || 30,
            max_bookings: r.max_bookings ?? null,
          });
        }
      }
      toast.success(`Copied to ${copyTargets.length} day${copyTargets.length === 1 ? "" : "s"}`);
      setCopyOpen(null);
      setCopyTargets([]);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Copy failed");
    } finally {
      setBusy(false);
    }
  };

  const noStaff = !loading && staff.length === 0;

  return (
    <AppShell title="Bulk schedule" showBack>
      <div className="px-4 sm:px-6 pt-4 pb-24 space-y-4">
        <div className="bg-white border border-cream-300 rounded-2xl p-4">
          <p className="text-sm font-bold text-ink">Weekly schedule grid</p>
          <p className="text-[11px] text-ink-muted mt-0.5">
            Fill each doctor/service's weekly shifts in one place. Tap <span className="font-bold">+</span> in any cell to add a shift, or the <Copy size={11} className="inline -mt-0.5" /> icon to copy one day's schedule to other days.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-forest" /></div>
        ) : noStaff ? (
          <div className="bg-white rounded-2xl border border-cream-300 p-6 text-center">
            <p className="text-sm font-bold text-ink">No sub-doctors yet</p>
            <p className="text-xs text-ink-muted mt-1">Add doctors and services first, then come back to fill their schedule.</p>
            <button
              data-testid="grid-add-staff"
              onClick={() => navigate("/provider/staff")}
              className="mt-3 inline-flex items-center gap-2 bg-forest text-cream-100 px-4 py-2 rounded-xl text-sm font-bold"
            >
              <Plus size={14} /> Manage doctors / services
            </button>
          </div>
        ) : (
          <div className="bg-white border border-cream-300 rounded-2xl overflow-x-auto">
            <table className="min-w-[820px] w-full text-xs" data-testid="schedule-grid">
              <thead>
                <tr className="bg-cream-100 border-b border-cream-300">
                  <th className="px-3 py-2 text-left font-bold uppercase text-[10px] tracking-wider text-ink-soft sticky left-0 bg-cream-100 z-10 min-w-[160px]">Doctor / Service</th>
                  {WEEKDAYS.map((d) => (
                    <th key={d} className="px-2 py-2 text-center font-bold uppercase text-[10px] tracking-wider text-ink-soft min-w-[92px]">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => {
                  const KindIcon = s.kind === "doctor" ? Stethoscope : Building2;
                  return (
                    <tr key={s.id} className="border-b border-cream-300 last:border-b-0" data-testid={`grid-row-${s.id}`}>
                      <td className="px-3 py-2 sticky left-0 bg-white z-10 border-r border-cream-300">
                        <div className="flex items-center gap-2">
                          <KindIcon size={14} className="text-forest shrink-0" />
                          <div className="min-w-0">
                            <p className="font-bold text-ink truncate">{s.name}</p>
                            {s.specialization && <p className="text-[10px] text-ink-muted truncate">{s.specialization}</p>}
                          </div>
                        </div>
                      </td>
                      {WEEKDAYS.map((_, jsDay) => {
                        const cellRules = rulesFor(s.id, jsDay);
                        return (
                          <td key={jsDay} className="px-1.5 py-1.5 align-top border-r border-cream-300 last:border-r-0" data-testid={`grid-cell-${s.id}-${jsDay}`}>
                            <div className="flex flex-col gap-1">
                              {cellRules.map((r) => (
                                <div key={r.id} className="group bg-forest/5 rounded-md px-1.5 py-1 flex items-center justify-between gap-1">
                                  <span className="text-[10px] font-bold text-forest whitespace-nowrap">
                                    {r.start_time}–{r.end_time}
                                    {r.max_bookings != null && <span className="text-ink-muted ml-1">·{r.max_bookings}</span>}
                                  </span>
                                  <button
                                    data-testid={`grid-remove-${r.id}`}
                                    onClick={() => remove(s.id, r.id)}
                                    className="opacity-0 group-hover:opacity-100 transition text-rose-500 hover:text-rose-700"
                                    aria-label="Remove"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              ))}
                              <div className="flex gap-1">
                                <button
                                  data-testid={`grid-add-${s.id}-${jsDay}`}
                                  onClick={() => setAddOpen({ staff_id: s.id, jsDay })}
                                  className="flex-1 bg-cream-100 hover:bg-forest/10 border border-dashed border-cream-300 rounded-md py-1 text-[10px] font-bold text-ink-soft hover:text-forest"
                                >
                                  <Plus size={10} className="inline -mt-0.5" /> Add
                                </button>
                                {cellRules.length > 0 && (
                                  <button
                                    data-testid={`grid-copy-${s.id}-${jsDay}`}
                                    onClick={() => { setCopyOpen({ staff_id: s.id, fromDay: jsDay }); setCopyTargets([]); }}
                                    title="Copy this day to other days"
                                    className="bg-cream-100 hover:bg-forest/10 border border-cream-300 rounded-md px-1.5 py-1 text-[10px] font-bold text-ink-soft hover:text-forest"
                                  >
                                    <Copy size={11} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add-shift modal */}
      {addOpen && (
        <Modal onClose={() => setAddOpen(null)} testid="grid-add-modal">
          <p className="text-sm font-bold text-ink">
            Add shift · {staff.find((s) => s.id === addOpen.staff_id)?.name} · {WEEKDAYS[addOpen.jsDay]}
          </p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <LabeledInput label="Start" testid="grid-form-start" type="time" value={form.start_time} onChange={(v) => setForm({ ...form, start_time: v })} />
            <LabeledInput label="End" testid="grid-form-end" type="time" value={form.end_time} onChange={(v) => setForm({ ...form, end_time: v })} />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <LabeledInput label="Slot (min)" testid="grid-form-slot" type="number" value={form.slot_duration} onChange={(v) => setForm({ ...form, slot_duration: v })} />
            <LabeledInput label="Max bookings" testid="grid-form-max" type="number" value={form.max_bookings} onChange={(v) => setForm({ ...form, max_bookings: v })} placeholder="unlimited" />
          </div>
          <button
            data-testid="grid-form-save"
            onClick={addShift}
            disabled={busy}
            className="w-full mt-3 bg-forest text-cream-100 py-2.5 rounded-xl font-bold hover:bg-forest-dark disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin inline" /> : "Save shift"}
          </button>
        </Modal>
      )}

      {/* Copy-to modal */}
      {copyOpen && (
        <Modal onClose={() => setCopyOpen(null)} testid="grid-copy-modal">
          <p className="text-sm font-bold text-ink">
            Copy {WEEKDAYS[copyOpen.fromDay]}'s schedule for {staff.find((s) => s.id === copyOpen.staff_id)?.name} to...
          </p>
          <div className="grid grid-cols-7 gap-1 mt-3">
            {WEEKDAYS.map((d, idx) => {
              const disabled = idx === copyOpen.fromDay;
              const selected = copyTargets.includes(idx);
              return (
                <button
                  key={d}
                  data-testid={`grid-copy-target-${idx}`}
                  disabled={disabled}
                  onClick={() =>
                    setCopyTargets((prev) => (prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx]))
                  }
                  className={`py-2 rounded-lg text-xs font-bold ${
                    disabled
                      ? "bg-cream-200 text-ink-muted opacity-50 cursor-not-allowed"
                      : selected
                        ? "bg-forest text-cream-100"
                        : "bg-cream border border-cream-300 text-ink"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <button
            data-testid="grid-copy-confirm"
            onClick={runCopy}
            disabled={busy || copyTargets.length === 0}
            className="w-full mt-3 bg-forest text-cream-100 py-2.5 rounded-xl font-bold hover:bg-forest-dark disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin inline" /> : `Copy to ${copyTargets.length || 0} day${copyTargets.length === 1 ? "" : "s"}`}
          </button>
        </Modal>
      )}
    </AppShell>
  );
}

function Modal({ children, onClose, testid }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose} data-testid={testid}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange, type = "text", placeholder, testid }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">{label}</label>
      <input
        data-testid={testid}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 bg-cream border border-cream-300 rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-forest/20 text-sm"
      />
    </div>
  );
}
