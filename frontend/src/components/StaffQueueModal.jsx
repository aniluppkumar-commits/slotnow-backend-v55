import React, { useCallback, useEffect, useState } from "react";
import { X, ChevronRight, Loader2, Plus, Stethoscope, Building2, Phone } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { StatusBadge, formatTime } from "@/lib/utils-app";
import useLivePolling from "@/hooks/useLivePolling";

// Per-staff queue drill-in modal for the assistant desk.
// - Fetches /assistant/staff/{staff_id}/queue?date=YYYY-MM-DD
// - Renders the full patient list (booked + walk-ins) for that doctor/service
// - Has a prominent "+ Walk-in for this doctor" button which calls the parent
//   to open the shared walk-in modal with staff_id pre-filled.
export default function StaffQueueModal({ staffId, staffName, staffKind, date, onClose, onWalkinRequested }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);

  const fetchQueue = useCallback(async () => {
    if (!staffId) return;
    try {
      const params = new URLSearchParams();
      if (date) params.set("date", date);
      const url = `/assistant/staff/${staffId}/queue${params.toString() ? "?" + params.toString() : ""}`;
      const { data: res } = await api.get(url);
      setData(res);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not load queue");
    } finally {
      setLoading(false);
    }
  }, [staffId, date]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);
  useLivePolling(fetchQueue, 4000);

  const callNext = async () => {
    setAdvancing(true);
    try {
      const { data: res } = await api.post(`/assistant/queue/next?staff_id=${encodeURIComponent(staffId)}`);
      if (res.ok) toast.success(`Completed token #${res.completed_token}`);
      else toast.message("Queue is empty for this doctor / service.");
      await fetchQueue();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not advance");
    } finally {
      setAdvancing(false);
    }
  };

  const Icon = staffKind === "doctor" ? Stethoscope : Building2;
  const items = data?.items || [];
  const active = items.filter((b) => ["pending", "confirmed"].includes(b.status));
  const done = items.filter((b) => ["completed", "no_show", "rejected", "cancelled"].includes(b.status));

  return (
    <div className="fixed inset-0 z-[80] bg-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        data-testid="staff-queue-modal"
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-cream-300 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-forest-faint text-forest flex items-center justify-center shrink-0">
            <Icon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-heading font-black text-lg text-ink truncate">{staffName || data?.staff?.name}</p>
            <p className="text-[11px] text-ink-muted capitalize">
              {(data?.staff?.kind || staffKind || "staff")}
              {data?.staff?.specialization ? ` · ${data.staff.specialization}` : ""}
              {date ? ` · ${date}` : ""}
            </p>
            {data?.staff?.phone && (
              <a
                href={`tel:${data.staff.phone}`}
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
              >
                <Phone size={10} strokeWidth={2.5} /> {data.staff.phone}
              </a>
            )}
          </div>
          <button
            data-testid="staff-queue-close"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-cream-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stats + primary actions */}
        <div className="px-4 py-3 grid grid-cols-3 gap-2 border-b border-cream-300 bg-cream/50">
          <Stat label="Now serving" value={data?.current_token ? `#${data.current_token}` : "—"} testid="staff-queue-current" />
          <Stat label="In queue" value={data?.active_count ?? 0} testid="staff-queue-active" />
          <Stat label="Completed" value={data?.completed_count ?? 0} testid="staff-queue-completed" />
        </div>
        <div className="px-4 py-3 flex gap-2 border-b border-cream-300">
          <button
            data-testid="staff-queue-call-next"
            onClick={callNext}
            disabled={advancing || (data?.active_count ?? 0) === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark disabled:opacity-40 text-white py-2.5 rounded-xl font-bold text-sm"
          >
            {advancing ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
            Call next
          </button>
          <button
            data-testid="staff-queue-add-walkin"
            onClick={() => onWalkinRequested?.({ staff_id: staffId, staff_name: staffName || data?.staff?.name })}
            className="flex-1 flex items-center justify-center gap-2 bg-white border border-cream-300 hover:border-forest text-ink py-2.5 rounded-xl font-bold text-sm"
          >
            <Plus size={14} /> Walk-in for this {staffKind === "service" ? "service" : "doctor"}
          </button>
        </div>

        {/* Patient list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-forest" /></div>
          ) : items.length === 0 ? (
            <p data-testid="staff-queue-empty" className="text-center text-sm text-ink-muted italic py-10">
              No patients yet for this {staffKind === "service" ? "service" : "doctor"} on {date}.
            </p>
          ) : (
            <div className="space-y-2">
              {active.length > 0 && (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">In queue ({active.length})</p>
                  {active.map((b) => <PatientRow key={b.id} b={b} testid={`staff-queue-item-${b.id}`} />)}
                </>
              )}
              {done.length > 0 && (
                <>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-ink-muted">Completed ({done.length})</p>
                  {done.map((b) => <PatientRow key={b.id} b={b} testid={`staff-queue-item-${b.id}`} muted />)}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, testid }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{label}</p>
      <p data-testid={testid} className="font-heading font-black text-2xl text-ink">{value}</p>
    </div>
  );
}

function PatientRow({ b, testid, muted = false }) {
  return (
    <div
      data-testid={testid}
      className={`bg-white border border-cream-300 rounded-xl p-3 flex items-center gap-3 ${muted ? "opacity-60" : ""}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
        muted ? "bg-cream-200 text-ink-muted" : "bg-forest-faint text-forest"
      }`}>
        #{b.token_number}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-ink truncate">{b.customer_name || b.customer?.name || "Guest"}</p>
          {b.is_walkin && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded uppercase tracking-wider">
              Walk-in
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-ink-soft mt-0.5">
          {b.start_time && <span>{formatTime(b.start_time)}</span>}
          {b.service_name && <><span>·</span><span className="truncate">{b.service_name}</span></>}
        </div>
      </div>
      <StatusBadge status={b.status} />
    </div>
  );
}
