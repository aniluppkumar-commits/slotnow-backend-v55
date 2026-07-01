import React, { useState } from "react";
import { PhoneCall, MessageCircle } from "lucide-react";
import { StatusBadge, formatTime, formatDate } from "@/lib/utils-app";
import WhatsAppModal from "@/components/WhatsAppModal";

/**
 * Queue row with Call + WhatsApp actions. Used in Provider Queue and Receptionist Dashboard.
 * Supports drag handle via `dragHandleProps` from a dnd library. If `draggable=false`, no handle.
 */
export default function QueueRow({ booking: b, providerName, dragHandleProps, dragRef, style, className = "" }) {
  const [waOpen, setWaOpen] = useState(false);
  const phone = b.customer_phone;
  const name = b.customer_name || b.customer?.name || "Customer";
  const inProgress = b.status === "in_progress";
  const completed = b.status === "completed";

  return (
    <>
      <div
        ref={dragRef}
        style={style}
        data-testid={`queue-item-${b.id}`}
        className={`bg-white border border-cream-300 rounded-xl p-3 ${
          inProgress ? "ring-2 ring-forest bg-forest-faint" : ""
        } ${className}`}
      >
        <div className="flex items-center gap-3">
          {dragHandleProps && (
            <div
              {...dragHandleProps}
              data-testid={`queue-drag-${b.id}`}
              className="cursor-grab active:cursor-grabbing text-ink-muted select-none px-1"
              title="Drag to reorder"
            >
              ⋮⋮
            </div>
          )}
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
              inProgress
                ? "bg-forest text-white"
                : completed
                ? "bg-cream-200 text-ink-muted line-through"
                : "bg-forest-faint text-forest"
            }`}
          >
            #{b.token_number}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-ink truncate">{name}</p>
              {b.is_walkin && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded uppercase tracking-wider">
                  Walk-in
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-ink-soft mt-0.5">
              <span>{formatTime(b.start_time)}</span>
              <span>·</span>
              <span className="truncate">{b.service_name}</span>
            </div>
            {b.vehicle_reg_no && (
              <p className="text-[10px] font-mono text-ink-muted mt-0.5 uppercase">
                {b.vehicle_reg_no}
                {b.vehicle_model ? ` · ${b.vehicle_model}` : ""}
              </p>
            )}
          </div>
          <StatusBadge status={b.status} />
        </div>
        {phone && (
          <div className="flex gap-2 mt-2 pt-2 border-t border-cream-300">
            <a
              data-testid={`queue-call-${b.id}`}
              href={`tel:+91${phone}`}
              className="flex-1 flex items-center justify-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-800 py-1.5 rounded-lg hover:bg-emerald-100"
            >
              <PhoneCall size={12} strokeWidth={2.5} /> Call
            </a>
            <button
              data-testid={`queue-wa-${b.id}`}
              onClick={() => setWaOpen(true)}
              className="flex-1 flex items-center justify-center gap-1 text-[11px] font-bold bg-[#E7F8EC] text-[#128C7E] py-1.5 rounded-lg hover:bg-[#D0F0DA]"
            >
              <MessageCircle size={12} strokeWidth={2.5} /> WhatsApp
            </button>
          </div>
        )}
      </div>

      <WhatsAppModal
        open={waOpen}
        onClose={() => setWaOpen(false)}
        phone={phone}
        name={name}
        token={b.token_number}
        provider={providerName || b.provider?.business_name}
        service={b.service_name}
        date={b.date ? formatDate(b.date) : ""}
        time={b.start_time ? formatTime(b.start_time) : ""}
      />
    </>
  );
}
