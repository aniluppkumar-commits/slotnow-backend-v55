import React, { useEffect, useState, useMemo, useCallback } from "react";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { useI18n } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import { StatusBadge, formatDate, formatTime } from "@/lib/utils-app";
import WhatsAppModal from "@/components/WhatsAppModal";
import PatientHistoryModal from "@/components/PatientHistoryModal";
import {
  Loader2,
  Calendar,
  MessageCircle,
  Printer,
  Trash2,
  History as HistoryIcon,
} from "lucide-react";
import { toast } from "sonner";

function toISO(d) {
  // Local date, not UTC — otherwise IST users get yesterday after 5:30am UTC.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISO(d);
}

export default function HistoryPage() {
  const { t } = useI18n();
  const { isProvider } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState(daysAgoISO(30));
  const [end, setEnd] = useState(toISO(new Date()));
  const [deletingId, setDeletingId] = useState(null);
  const [waTarget, setWaTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/queue/history", { params: { start, end } });
      const arr = Array.isArray(data) ? data : data?.items || data?.history || data?.bookings || [];
      setItems(arr);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to load history");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    load();
  }, [load]);

  const applyPreset = (days) => {
    setStart(daysAgoISO(days));
    setEnd(toISO(new Date()));
  };

  const remove = async (b) => {
    if (!window.confirm(`Delete booking token #${b.token_number}? This cannot be undone.`)) return;
    setDeletingId(b.id);
    try {
      await api.delete(`/bookings/${b.id}`);
      toast.success("Deleted");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const doPrint = () => {
    window.print();
  };

  const stats = useMemo(() => {
    const total = items.length;
    const completed = items.filter((b) => b.status === "completed").length;
    const cancelled = items.filter((b) => b.status === "cancelled").length;
    const revenue = items
      .filter((b) => b.status === "completed")
      .reduce((s, b) => s + (b.price || 0), 0);
    return { total, completed, cancelled, revenue };
  }, [items]);

  return (
    <AppShell title="History" showBack>
      <div className="px-4 sm:px-6 pt-4 space-y-4 print:pt-0">
        {/* Range picker */}
        <div className="bg-white border border-cream-300 rounded-2xl p-4 space-y-3 print:hidden">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-soft flex items-center gap-1.5">
            <Calendar size={13} strokeWidth={2.5} />
            Date range
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">From</span>
              <input
                data-testid="history-start-date"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                max={end}
                className="w-full mt-1 bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">To</span>
              <input
                data-testid="history-end-date"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                min={start}
                className="w-full mt-1 bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
              />
            </label>
          </div>
          <div className="flex gap-1 flex-wrap">
            {[
              { label: "Today", d: 0 },
              { label: "7d", d: 7 },
              { label: "30d", d: 30 },
              { label: "90d", d: 90 },
            ].map(({ label, d }) => (
              <button
                key={label}
                data-testid={`history-preset-${d}`}
                onClick={() => applyPreset(d)}
                className="text-xs font-bold bg-cream-200 hover:bg-cream-300 text-ink-soft px-3 py-1.5 rounded-full transition-colors"
              >
                {label}
              </button>
            ))}
            <button
              data-testid="history-print-btn"
              onClick={doPrint}
              className="ml-auto flex items-center gap-1 text-xs font-bold bg-forest text-white hover:bg-forest-dark px-3 py-1.5 rounded-full"
            >
              <Printer size={12} strokeWidth={2.5} />
              Print
            </button>
          </div>
        </div>

        {/* Print header */}
        <div className="hidden print:block mb-4">
          <h2 className="text-xl font-bold text-ink">SlotNow — Booking History</h2>
          <p className="text-sm text-ink-soft">
            From {formatDate(start)} to {formatDate(end)}
          </p>
          <p className="text-xs text-ink-muted">Generated {new Date().toLocaleString()}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <MiniStat testid="history-stat-total" label="Total" value={stats.total} />
          <MiniStat testid="history-stat-completed" label="Done" value={stats.completed} accent="text-emerald-700" />
          <MiniStat testid="history-stat-cancelled" label="Cancel" value={stats.cancelled} accent="text-rose-700" />
          <MiniStat testid="history-stat-revenue" label="₹ Rev" value={stats.revenue} accent="text-forest" />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-forest" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-ink-soft">
            <HistoryIcon size={28} strokeWidth={1.5} className="mx-auto mb-2 text-ink-muted" />
            <p className="text-sm italic">No bookings in this range</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((b) => (
              <HistoryRow
                key={b.id}
                b={b}
                canDelete={isProvider}
                busy={deletingId === b.id}
                onDelete={() => remove(b)}
                onWhatsApp={() => setWaTarget(b)}
                onOpenHistory={() => setHistoryTarget(b)}
              />
            ))}
          </div>
        )}
      </div>

      {/* WhatsApp modal */}
      <WhatsAppModal
        open={!!waTarget}
        onClose={() => setWaTarget(null)}
        phone={waTarget?.customer_phone}
        name={waTarget?.customer_name || waTarget?.customer?.name || "Customer"}
        token={waTarget?.token_number}
        provider={waTarget?.provider?.business_name}
        service={waTarget?.service_name}
        date={waTarget?.date ? formatDate(waTarget.date) : ""}
        time={waTarget?.start_time ? formatTime(waTarget.start_time) : ""}
      />

      {/* Patient history modal (shows all past visits for the tapped customer) */}
      <PatientHistoryModal
        open={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
        phone={historyTarget?.customer_phone}
        name={historyTarget?.customer_name || historyTarget?.customer?.name || "Customer"}
      />

      {/* Print CSS scope */}
      <style>{`
        @media print {
          nav, header button, .print\\:hidden { display: none !important; }
          .fixed { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </AppShell>
  );
}

function MiniStat({ label, value, accent = "text-ink", testid }) {
  return (
    <div data-testid={testid} className="bg-white border border-cream-300 rounded-xl p-2 text-center">
      <div className="text-[9px] uppercase tracking-wider font-bold text-ink-muted">{label}</div>
      <div className={`font-heading text-lg font-extrabold ${accent} mt-0.5`}>{value}</div>
    </div>
  );
}

function HistoryRow({ b, canDelete, busy, onDelete, onWhatsApp, onOpenHistory }) {
  const phone = b.customer_phone;
  const name = b.customer_name || b.customer?.name || "Customer";

  return (
    <div
      data-testid={`history-item-${b.id}`}
      className="bg-white border border-cream-300 rounded-xl p-3 print:border-ink/20"
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-forest-faint text-forest flex items-center justify-center font-black text-sm shrink-0">
          #{b.token_number}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              data-testid={`history-open-history-${b.id}`}
              onClick={onOpenHistory}
              disabled={!phone}
              className="text-sm font-bold text-ink truncate hover:underline decoration-forest/40 underline-offset-2 disabled:no-underline disabled:cursor-default text-left"
              title={phone ? "View patient history" : "No phone on record"}
            >
              {name}
            </button>
            <StatusBadge status={b.status} />
          </div>
          <p className="text-xs text-ink-soft truncate mt-0.5">
            {b.service_name} · {formatDate(b.date)} · {formatTime(b.start_time)}
          </p>
          {phone && (
            <p className="text-[11px] text-ink-muted mt-0.5">+91 {phone}</p>
          )}
          {b.vehicle_reg_no && (
            <p className="text-[11px] text-ink-muted uppercase tracking-wider mt-0.5">
              {b.vehicle_reg_no}{b.vehicle_model ? ` · ${b.vehicle_model}` : ""}
            </p>
          )}
          <div className="flex items-center justify-between gap-2 mt-2 print:hidden">
            <div className="flex gap-1.5">
              {phone && (
                <button
                  data-testid={`history-whatsapp-${b.id}`}
                  onClick={onWhatsApp}
                  className="flex items-center gap-1 text-[11px] font-bold bg-[#E7F8EC] text-[#128C7E] px-2.5 py-1.5 rounded-lg hover:bg-[#D0F0DA]"
                >
                  <MessageCircle size={12} strokeWidth={2.5} /> WhatsApp
                </button>
              )}
            </div>
            {canDelete && (
              <button
                data-testid={`history-delete-${b.id}`}
                onClick={onDelete}
                disabled={busy}
                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                title="Delete booking (Provider only)"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </button>
            )}
          </div>
          <div className="hidden print:flex items-center gap-2 mt-1 text-[10px] text-ink-soft">
            ₹{b.price || 0} · {b.status}
          </div>
        </div>
      </div>
    </div>
  );
}
