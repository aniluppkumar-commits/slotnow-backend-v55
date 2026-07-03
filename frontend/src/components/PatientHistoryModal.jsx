import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { X, Loader2, History as HistoryIcon } from "lucide-react";
import { StatusBadge, formatDate, formatTime } from "@/lib/utils-app";

/**
 * Patient history modal — fetches all bookings for a given customer_phone
 * from /queue/history and shows them in reverse chronological order.
 * Called from queue rows (Receptionist + Provider live queue).
 */
export default function PatientHistoryModal({ open, onClose, phone, name }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!open || !phone) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // Wide range so we capture the customer's full history with this provider
        const end = new Date();
        const start = new Date();
        start.setFullYear(start.getFullYear() - 2);
        const iso = (d) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const { data } = await api.get("/queue/history", {
          params: { start: iso(start), end: iso(end) },
        });
        const all = Array.isArray(data) ? data : data?.items || data?.history || data?.bookings || [];
        // Client-side filter on customer_phone (backend endpoint doesn't take a phone filter)
        const filtered = all
          .filter((b) => (b.customer_phone || "").replace(/\D/g, "") === (phone || "").replace(/\D/g, ""))
          .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        if (mounted) setItems(filtered);
      } catch (err) {
        console.error("Patient history load failed:", err);
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open, phone]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center px-4 pb-24 sm:pb-4">
      <div
        data-testid="patient-history-modal"
        className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-cream-300">
          <div className="min-w-0">
            <h3 className="font-heading font-bold text-ink flex items-center gap-2">
              <HistoryIcon size={16} />
              Patient History
            </h3>
            <p className="text-[11px] text-ink-soft truncate">
              {name || "Customer"} · +91 {phone}
            </p>
          </div>
          <button
            data-testid="patient-history-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-cream-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-forest" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-ink-soft italic text-center py-10">
              No previous visits found for this patient.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest font-bold text-ink-muted">
                {items.length} visit{items.length !== 1 ? "s" : ""}
              </p>
              {items.map((b) => (
                <div
                  key={b.id}
                  data-testid={`patient-history-item-${b.id}`}
                  className="bg-cream border border-cream-300 rounded-xl p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-forest-faint text-forest flex items-center justify-center font-black text-xs shrink-0">
                      #{b.token_number}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-ink truncate">{b.service_name}</p>
                        <StatusBadge status={b.status} />
                      </div>
                      <p className="text-[11px] text-ink-soft mt-0.5">
                        {formatDate(b.date)} · {formatTime(b.start_time)}
                      </p>
                      {b.vehicle_reg_no && (
                        <p className="text-[10px] font-mono text-ink-muted uppercase mt-0.5">
                          {b.vehicle_reg_no}
                          {b.vehicle_model ? ` · ${b.vehicle_model}` : ""}
                        </p>
                      )}
                      {b.notes && (
                        <p className="text-[11px] text-ink-soft italic mt-1 line-clamp-2">
                          "{b.notes}"
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
