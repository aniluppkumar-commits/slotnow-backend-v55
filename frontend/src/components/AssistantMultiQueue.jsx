import React, { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import useLivePolling from "@/hooks/useLivePolling";
import { Loader2, ChevronRight, Stethoscope, Building2, User } from "lucide-react";
import { toast } from "sonner";

// Live multi-staff queue tiles for hospital assistants. Shows up to 3
// assigned doctors/services on a single screen with per-staff "Next" buttons
// that call POST /assistant/queue/next?staff_id=…. Auto-refreshes every 4s.
// `date` prop lets the parent scope the whole snapshot to any date. `onOpenStaff`
// is called when the assistant taps a tile (opens per-staff drill-in modal).
export default function AssistantMultiQueue({ date, onOpenStaff, refreshKey = 0 }) {
  const [snap, setSnap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyStaff, setBusyStaff] = useState(null);

  const fetchSnap = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (date) params.set("date", date);
      const url = `/assistant/queue/multi${params.toString() ? "?" + params.toString() : ""}`;
      const { data } = await api.get(url);
      setSnap(data);
    } catch {
      // silent — the wider dashboard already surfaces errors
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchSnap(); }, [fetchSnap, refreshKey]);
  useLivePolling(fetchSnap, 4000);

  const callNext = async (staffId, e) => {
    e?.stopPropagation();
    setBusyStaff(staffId);
    try {
      const { data } = await api.post(`/assistant/queue/next?staff_id=${encodeURIComponent(staffId)}`);
      if (data.ok) {
        toast.success(`Completed token #${data.completed_token}`);
      } else {
        toast.message("Queue is empty for this doctor / service.");
      }
      await fetchSnap();
    } catch (e2) {
      toast.error(e2?.response?.data?.detail || "Could not advance");
    } finally {
      setBusyStaff(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-cream-300 rounded-2xl p-6 flex justify-center">
        <Loader2 className="animate-spin text-forest" />
      </div>
    );
  }
  const staff = snap?.staff || [];
  const hospitalTotal = snap?.hospital_total ?? 0;
  const hospitalActive = snap?.hospital_active ?? 0;
  if (staff.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">
            Assigned live queues ({staff.length})
          </p>
          <span
            data-testid="hospital-total-badge"
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-forest text-cream-100"
          >
            Total today: <span className="text-base font-heading normal-case">{hospitalTotal}</span>
            {hospitalActive > 0 && (
              <span className="text-cream-200/80 normal-case tracking-normal">
                · {hospitalActive} active
              </span>
            )}
          </span>
        </div>
        <span className="text-[10px] text-ink-muted">Tap any card to open its queue · Auto-refreshing every 4s</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="assistant-multi-queue">
        {staff.map((s) => {
          const Icon = s.staff_kind === "doctor" ? Stethoscope : Building2;
          return (
            <button
              key={s.staff_id}
              type="button"
              data-testid={`aq-tile-${s.staff_id}`}
              onClick={() => onOpenStaff?.(s)}
              className="text-left bg-gradient-to-br from-forest to-forest-dark text-white rounded-2xl p-4 shadow-lg flex flex-col hover:brightness-110 transition-all focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <div className="flex items-center gap-2">
                {s.staff_photo ? (
                  <img src={s.staff_photo} alt="" className="w-9 h-9 rounded-lg object-cover ring-2 ring-white/40" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
                    <Icon size={16} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-heading font-bold text-cream-100 truncate text-sm">{s.staff_name}</p>
                  <p className="text-[10px] text-cream-200/70 capitalize">{s.staff_kind || "staff"}</p>
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-[10px] uppercase tracking-widest text-cream-200/70">Now serving</span>
                <span data-testid={`aq-current-${s.staff_id}`} className="text-3xl font-heading font-black text-cream-100">
                  #{s.current_token || "—"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-cream-100/80">
                <span>
                  Next: <b className="text-cream-100">{s.next_token ? `#${s.next_token}` : "—"}</b>
                </span>
                <span data-testid={`aq-count-${s.staff_id}`} className="bg-white/15 px-2 py-0.5 rounded-full font-bold">
                  {s.active_count} in queue
                </span>
              </div>
              {s.next_name && s.next_token && (
                <div className="mt-2 flex items-center gap-1 text-[11px] text-cream-100/80">
                  <User size={11} /> {s.next_name}
                </div>
              )}
              <span
                role="button"
                data-testid={`aq-next-${s.staff_id}`}
                onClick={(e) => callNext(s.staff_id, e)}
                aria-disabled={busyStaff === s.staff_id || s.active_count === 0}
                className={`mt-3 flex items-center justify-center gap-2 py-2 rounded-xl font-bold text-sm ${
                  busyStaff === s.staff_id || s.active_count === 0
                    ? "bg-accent/40 text-white/70 cursor-not-allowed"
                    : "bg-accent text-white hover:bg-accent-dark"
                }`}
              >
                {busyStaff === s.staff_id
                  ? <Loader2 size={14} className="animate-spin" />
                  : <><ChevronRight size={14} /> Call next</>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
