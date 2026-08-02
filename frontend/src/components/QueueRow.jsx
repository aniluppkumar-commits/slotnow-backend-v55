import React, { useState } from "react";
import { MessageCircle, ChevronUp, ChevronDown } from "lucide-react";
import { StatusBadge, formatTime, formatDate } from "@/lib/utils-app";
import WhatsAppModal from "@/components/WhatsAppModal";
import PatientHistoryModal from "@/components/PatientHistoryModal";

/**
 * Queue row with Call + WhatsApp actions. Used in Provider Queue and Receptionist Dashboard.
 * - `dragHandleProps` renders the ⋮⋮ drag handle (dnd-kit).
 * - `onMoveUp` / `onMoveDown` render explicit ↑ / ↓ arrow buttons for touch reorder.
 *   Pass `canMoveUp` / `canMoveDown` to disable when at ends.
 * - Clicking the row body opens the patient history modal.
 */
export default function QueueRow({
  booking: b,
  providerName,
  dragHandleProps,
  dragRef,
  style,
  className = "",
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
}) {
  const [waOpen, setWaOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
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
          {/* Row body — clickable → opens patient history */}
          <button
            type="button"
            data-testid={`queue-open-history-${b.id}`}
            onClick={() => phone && setHistoryOpen(true)}
            disabled={!phone}
            className="min-w-0 flex-1 text-left disabled:cursor-default"
            title={phone ? "View patient history" : "No phone on record"}
          >
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-ink truncate underline-offset-2 hover:underline decoration-forest/40">
                {name}
              </p>
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
          </button>
          {/* Reorder arrow buttons (receptionist only) */}
          {(onMoveUp || onMoveDown) && (
            <div className="flex flex-col gap-0.5 shrink-0">
              <button
                type="button"
                data-testid={`queue-move-up-${b.id}`}
                onClick={onMoveUp}
                disabled={!canMoveUp}
                className="p-1 rounded-md text-ink-soft hover:bg-cream-200 hover:text-forest disabled:opacity-30 disabled:hover:bg-transparent"
                title="Move up"
              >
                <ChevronUp size={14} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                data-testid={`queue-move-down-${b.id}`}
                onClick={onMoveDown}
                disabled={!canMoveDown}
                className="p-1 rounded-md text-ink-soft hover:bg-cream-200 hover:text-forest disabled:opacity-30 disabled:hover:bg-transparent"
                title="Move down"
              >
                <ChevronDown size={14} strokeWidth={2.5} />
              </button>
            </div>
          )}
          <StatusBadge status={b.status} />
        </div>
        {phone && (
          <div className="flex gap-2 mt-2 pt-2 border-t border-cream-300">
            <button
              data-testid={`queue-wa-${b.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setWaOpen(true);
              }}
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

      <PatientHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        phone={phone}
        name={name}
      />
    </>
  );
}
