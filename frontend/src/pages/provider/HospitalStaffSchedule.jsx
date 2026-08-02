import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { Loader2, Plus, Trash2, Clock, Stethoscope, Building2, CalendarX, CalendarPlus2 } from "lucide-react";
import { toast } from "sonner";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Backend uses Python's weekday() (0=Mon..6=Sun). UI uses JS getDay() (0=Sun..6=Sat).
const jsToPyWeekday = (js) => (js === 0 ? 6 : js - 1);
const pyToJsWeekday = (py) => (py + 1) % 7;
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function HospitalStaffSchedule() {
  const { staffId } = useParams();
  const navigate = useNavigate();
  const [staff, setStaff] = useState(null);
  const [rules, setRules] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    weekday: 1,
    start_time: "09:00",
    end_time: "13:00",
    slot_duration: 30,
    max_bookings: "",
  });
  const [ovForm, setOvForm] = useState({
    date: todayISO(),
    kind: "closed",
    start_time: "10:00",
    end_time: "13:00",
    max_bookings: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const [savingOv, setSavingOv] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRes, avRes, ovRes] = await Promise.all([
        api.get("/providers/me/staff"),
        api.get(`/providers/me/staff/${staffId}/availability`).catch(() => ({ data: [] })),
        api.get(`/providers/me/overrides`, { params: { staff_id: staffId } }).catch(() => ({ data: [] })),
      ]);
      const list = Array.isArray(staffRes.data) ? staffRes.data : [];
      const me = list.find((s) => s.id === staffId);
      if (!me) {
        toast.error("Staff not found");
        navigate("/provider/staff", { replace: true });
        return;
      }
      setStaff(me);
      setRules(Array.isArray(avRes.data) ? avRes.data : []);
      setOverrides(Array.isArray(ovRes.data) ? ovRes.data : []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, [staffId, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (form.start_time >= form.end_time) {
      return toast.error("End time must be after start time");
    }
    setSaving(true);
    try {
      await api.post(`/providers/me/staff/${staffId}/availability`, {
        weekday: jsToPyWeekday(Number(form.weekday)),
        start_time: form.start_time,
        end_time: form.end_time,
        slot_duration: Number(form.slot_duration) || 30,
        max_bookings: form.max_bookings === "" ? null : Number(form.max_bookings),
      });
      toast.success("Shift added");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this shift?")) return;
    try {
      await api.delete(`/providers/me/staff/${staffId}/availability/${id}`);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  const grouped = useMemo(() => {
    const map = {};
    rules.forEach((r) => {
      const jsDay = pyToJsWeekday(r.weekday);
      if (!map[jsDay]) map[jsDay] = [];
      map[jsDay].push(r);
    });
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => (a.start_time > b.start_time ? 1 : -1));
    });
    return map;
  }, [rules]);

  const addOverride = async () => {
    if (!ovForm.date) return toast.error("Pick a date");
    if (ovForm.kind === "shift" && ovForm.start_time >= ovForm.end_time) {
      return toast.error("End time must be after start time");
    }
    setSavingOv(true);
    try {
      const body = {
        staff_id: staffId,
        date: ovForm.date,
        kind: ovForm.kind,
        note: ovForm.note?.trim() || null,
      };
      if (ovForm.kind === "shift") {
        body.start_time = ovForm.start_time;
        body.end_time = ovForm.end_time;
        body.slot_duration = 30;
        body.max_bookings = ovForm.max_bookings === "" ? null : Number(ovForm.max_bookings);
      }
      await api.post("/providers/me/overrides", body);
      toast.success(ovForm.kind === "closed" ? "Day marked unavailable" : "Extra shift added");
      setOvForm({ ...ovForm, note: "", max_bookings: "" });
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    } finally {
      setSavingOv(false);
    }
  };

  const removeOverride = async (id) => {
    if (!window.confirm("Remove this override?")) return;
    try {
      await api.delete(`/providers/me/overrides/${id}`);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  const kindLabel = staff?.kind === "doctor" ? "Doctor" : "Service";
  const KindIcon = staff?.kind === "doctor" ? Stethoscope : Building2;

  return (
    <AppShell title={`${kindLabel} schedule`} showBack>
      <div className="px-4 sm:px-6 pt-4 space-y-5">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-forest" /></div>
        ) : staff && (
          <>
            {/* Staff header */}
            <div className="bg-gradient-to-br from-forest to-forest-dark rounded-2xl p-5 text-white shadow-lg">
              <div className="flex items-center gap-3">
                {staff.photo ? (
                  <img src={staff.photo} alt="" className="w-14 h-14 rounded-xl object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-white/15 flex items-center justify-center">
                    <KindIcon size={22} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest opacity-80">{kindLabel} schedule</p>
                  <p className="font-heading font-black text-lg truncate">{staff.name}</p>
                  {staff.specialization && (
                    <p className="text-xs opacity-90">{staff.specialization}</p>
                  )}
                </div>
              </div>
              <p className="text-[11px] opacity-80 mt-3">
                Each {staff.kind === "doctor" ? "doctor" : "service"} maintains an independent weekly schedule.
                Customers only see and book the shifts you define here.
              </p>
            </div>

            {/* Add form */}
            <div className="bg-white border border-cream-300 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">Add shift</p>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">Day</label>
                <div className="grid grid-cols-7 gap-1 mt-1">
                  {WEEKDAYS.map((d, idx) => (
                    <button
                      key={d}
                      data-testid={`sched-day-${idx}`}
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
                <TimeInput testid="sched-start" label="Start time" value={form.start_time} onChange={(v) => setForm({ ...form, start_time: v })} />
                <TimeInput testid="sched-end" label="End time" value={form.end_time} onChange={(v) => setForm({ ...form, end_time: v })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">Slot (min)</label>
                  <input
                    data-testid="sched-slot-duration"
                    type="number" min="5" step="5"
                    value={form.slot_duration}
                    onChange={(e) => setForm({ ...form, slot_duration: e.target.value })}
                    className="w-full mt-1 bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">Max bookings</label>
                  <input
                    data-testid="sched-max"
                    type="number" min="0"
                    value={form.max_bookings}
                    onChange={(e) => setForm({ ...form, max_bookings: e.target.value })}
                    placeholder="Blank = unlimited"
                    className="w-full mt-1 bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
                  />
                </div>
              </div>
              <button
                data-testid="sched-add-btn"
                onClick={add}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-forest text-cream-100 py-2.5 rounded-xl font-bold hover:bg-forest-dark disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> Add shift</>}
              </button>
            </div>

            {/* Per-date overrides (leave / one-off extra shift) */}
            <div className="bg-white border border-cream-300 rounded-2xl p-4 space-y-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">Per-date override</p>
                <p className="text-[11px] text-ink-muted mt-0.5">Mark a specific date as on-leave or add a one-off extra shift without touching the weekly template.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  data-testid="ov-kind-closed"
                  onClick={() => setOvForm({ ...ovForm, kind: "closed" })}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border ${
                    ovForm.kind === "closed" ? "bg-rose-500 text-white border-rose-500" : "bg-cream border-cream-300 text-ink"
                  }`}
                ><CalendarX size={14} /> On leave</button>
                <button
                  data-testid="ov-kind-shift"
                  onClick={() => setOvForm({ ...ovForm, kind: "shift" })}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border ${
                    ovForm.kind === "shift" ? "bg-forest text-cream-100 border-forest" : "bg-cream border-cream-300 text-ink"
                  }`}
                ><CalendarPlus2 size={14} /> Extra shift</button>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">Date</label>
                <input
                  data-testid="ov-date"
                  type="date"
                  value={ovForm.date}
                  min={todayISO()}
                  onChange={(e) => setOvForm({ ...ovForm, date: e.target.value })}
                  className="w-full mt-1 bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
                />
              </div>
              {ovForm.kind === "shift" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <TimeInput testid="ov-start" label="Start" value={ovForm.start_time} onChange={(v) => setOvForm({ ...ovForm, start_time: v })} />
                    <TimeInput testid="ov-end" label="End" value={ovForm.end_time} onChange={(v) => setOvForm({ ...ovForm, end_time: v })} />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">Max bookings</label>
                    <input
                      data-testid="ov-max"
                      type="number" min="0"
                      value={ovForm.max_bookings}
                      onChange={(e) => setOvForm({ ...ovForm, max_bookings: e.target.value })}
                      placeholder="Blank = unlimited"
                      className="w-full mt-1 bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">Note (optional)</label>
                <input
                  data-testid="ov-note"
                  type="text"
                  value={ovForm.note}
                  onChange={(e) => setOvForm({ ...ovForm, note: e.target.value })}
                  placeholder="e.g. On vacation / Emergency shift"
                  className="w-full mt-1 bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
                />
              </div>
              <button
                data-testid="ov-add-btn"
                onClick={addOverride}
                disabled={savingOv}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold disabled:opacity-60 ${
                  ovForm.kind === "closed" ? "bg-rose-500 text-white hover:bg-rose-600" : "bg-forest text-cream-100 hover:bg-forest-dark"
                }`}
              >
                {savingOv ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> {ovForm.kind === "closed" ? "Mark unavailable" : "Add extra shift"}</>}
              </button>
              {overrides.length > 0 && (
                <div className="pt-2 border-t border-cream-300">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-ink-muted mb-2">Upcoming overrides</p>
                  <div className="space-y-2">
                    {overrides.map((o) => (
                      <div key={o.id} data-testid={`ov-row-${o.id}`} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${o.kind === "closed" ? "bg-rose-50 text-rose-900" : "bg-forest/5 text-ink"}`}>
                        <div>
                          <span className="font-bold">{o.date}</span>
                          <span className="mx-1.5 opacity-50">·</span>
                          <span>{o.kind === "closed" ? "On leave" : `${o.start_time}–${o.end_time}`}</span>
                          {o.note && <div className="text-[11px] opacity-80">{o.note}</div>}
                        </div>
                        <button data-testid={`ov-remove-${o.id}`} onClick={() => removeOverride(o.id)} className="p-2 rounded-lg text-rose-500 hover:bg-white">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Current schedule */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">Weekly schedule</p>
                <span className="text-[10px] font-bold text-ink-muted">{rules.length} shift{rules.length === 1 ? "" : "s"}</span>
              </div>
              {rules.length === 0 ? (
                <p className="text-sm text-ink-soft italic text-center py-6 bg-white rounded-2xl border border-cream-300" data-testid="sched-empty">
                  No shifts set yet. This {staff.kind} will fall back to the hospital's default schedule until you add one.
                </p>
              ) : (
                <div className="space-y-3">
                  {WEEKDAYS.map((d, idx) => {
                    const items = grouped[idx];
                    if (!items || items.length === 0) return null;
                    return (
                      <div key={d} className="bg-white border border-cream-300 rounded-xl overflow-hidden">
                        <div className="px-3 py-2 bg-cream-100 border-b border-cream-300">
                          <p className="text-xs font-bold uppercase tracking-wider text-forest">{d}</p>
                        </div>
                        <div className="divide-y divide-cream-300">
                          {items.map((r) => (
                            <div key={r.id} data-testid={`sched-rule-${r.id}`} className="p-3 flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm">
                                <Clock size={14} className="text-ink-muted" />
                                <span className="font-bold text-ink">{r.start_time} – {r.end_time}</span>
                                <span className="text-ink-soft">· {r.slot_duration} min</span>
                                {r.max_bookings != null && (
                                  <span className="text-ink-soft">· max {r.max_bookings}</span>
                                )}
                              </div>
                              <button
                                data-testid={`sched-remove-${r.id}`}
                                onClick={() => remove(r.id)}
                                className="p-2 rounded-lg text-rose-500 hover:bg-rose-50"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
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
