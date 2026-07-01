import React, { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { useI18n } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import useLivePolling from "@/hooks/useLivePolling";
import QueueRow from "@/components/QueueRow";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Loader2,
  ChevronRight,
  UserPlus,
  X,
  UserCog,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";

function SortableItem({ booking, providerName }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: booking.id });
  return (
    <QueueRow
      booking={booking}
      providerName={providerName}
      dragRef={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : 1,
        zIndex: isDragging ? 20 : "auto",
      }}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}

export default function ReceptionistDashboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [providerInfo, setProviderInfo] = useState(null);
  const [queue, setQueue] = useState([]);
  const [currentToken, setCurrentToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [walkOpen, setWalkOpen] = useState(false);
  const [walk, setWalk] = useState({ name: "", phone: "", vehicle_reg_no: "", vehicle_model: "", service_type: "Paid" });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/queue/today");
      // Backend returns { date, provider, current_token, last_assigned, items }
      const arr = Array.isArray(data)
        ? data
        : data?.items || data?.queue || data?.bookings || [];
      setQueue(arr);
      if (data?.provider) setProviderInfo(data.provider);
      if (data?.current_token != null) setCurrentToken(data.current_token);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useLivePolling(load, 4000, true);

  const callNext = async () => {
    setActionLoading(true);
    try {
      await api.post("/queue/next");
      toast.success("Next customer called");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setActionLoading(false);
    }
  };

  const addWalkin = async () => {
    if (!walk.name.trim()) return toast.error("Name required");
    setActionLoading(true);
    try {
      const { data } = await api.post("/queue/walkin", {
        name: walk.name,
        phone: walk.phone || null,
        vehicle_reg_no: walk.vehicle_reg_no || null,
        vehicle_model: walk.vehicle_model || null,
        service_type: walk.service_type || "Paid",
      });
      toast.success(`Added • Token #${data.token_number}`);
      setWalk({ name: "", phone: "", vehicle_reg_no: "", vehicle_model: "", service_type: "Paid" });
      setWalkOpen(false);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setActionLoading(false);
    }
  };

  const active = queue.filter((b) => !["completed", "cancelled"].includes(b.status));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = async (event) => {
    const { active: dragged, over } = event;
    if (!dragged || !over || dragged.id === over.id) return;
    const oldIdx = queue.findIndex((b) => b.id === dragged.id);
    const newIdx = queue.findIndex((b) => b.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(queue, oldIdx, newIdx);
    setQueue(reordered);
    try {
      const activeIds = reordered
        .filter((b) => !["completed", "cancelled"].includes(b.status))
        .map((b) => b.id);
      const today = new Date().toISOString().slice(0, 10);
      await api.post("/queue/reorder", { date: today, ordered_ids: activeIds });
      toast.success("Queue reordered");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to reorder");
      await load();
    }
  };

  const businessName = providerInfo?.business_name || user?.designation || "your provider";
  const city = providerInfo?.city;

  return (
    <AppShell
      title="Assistant Desk"
      headerRight={
        <div className="flex items-center gap-1.5 text-[11px] text-forest font-bold uppercase tracking-wider">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse-dot" />
          Live
        </div>
      }
    >
      <div className="px-4 sm:px-6 pt-4 space-y-4">
        {/* Linked provider */}
        <div className="bg-gradient-to-br from-forest to-forest-dark rounded-2xl p-4 text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <UserCog size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest opacity-70">Assisting</p>
            <p data-testid="receptionist-provider-name" className="font-heading font-bold truncate">{businessName}</p>
            {city && <p className="text-[11px] opacity-70 truncate">{city}</p>}
          </div>
          {currentToken != null && (
            <div className="ml-auto text-right">
              <p className="text-[10px] uppercase tracking-widest opacity-70">Now serving</p>
              <p className="font-heading font-black text-2xl">#{currentToken}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2">
          <button
            data-testid="receptionist-call-next-btn"
            onClick={callNext}
            disabled={actionLoading || active.length === 0}
            className="flex items-center justify-center gap-2 bg-accent text-white py-3 rounded-xl font-bold text-sm disabled:opacity-40 hover:bg-accent-dark"
          >
            <ChevronRight size={16} /> Call next
          </button>
          <button
            data-testid="receptionist-walkin-btn"
            onClick={() => setWalkOpen(true)}
            className="flex items-center justify-center gap-2 bg-white border border-cream-300 text-ink py-3 rounded-xl font-bold text-sm hover:border-forest/40"
          >
            <UserPlus size={16} /> Walk-in
          </button>
          <button
            data-testid="receptionist-history-btn"
            onClick={() => (window.location.href = "/receptionist/history")}
            className="flex items-center justify-center gap-2 bg-white border border-cream-300 text-ink py-3 rounded-xl font-bold text-sm hover:border-forest/40"
          >
            History
          </button>
        </div>

        {/* Queue with drag-drop */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-forest" />
          </div>
        ) : queue.length === 0 ? (
          <p className="text-sm text-ink-soft italic text-center py-12">{t("no_bookings_today")}</p>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-widest font-bold text-ink-muted flex items-center gap-1">
              <GripVertical size={11} /> Drag to reorder
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={queue.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {queue.map((b) => (
                    <SortableItem key={b.id} booking={b} providerName={providerInfo?.business_name} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        )}
      </div>

      {walkOpen && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center px-4 pb-24 sm:pb-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-bold text-lg text-ink">Walk-in customer</h3>
              <button
                data-testid="rec-walkin-close-btn"
                onClick={() => setWalkOpen(false)}
                className="p-1 rounded-lg hover:bg-cream-200"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2">
              <input
                data-testid="rec-walkin-name"
                value={walk.name}
                onChange={(e) => setWalk({ ...walk, name: e.target.value })}
                placeholder="Customer name *"
                className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
              />
              <input
                data-testid="rec-walkin-phone"
                value={walk.phone}
                onChange={(e) => setWalk({ ...walk, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                placeholder="Phone (optional)"
                className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
              />
              <input
                data-testid="rec-walkin-reg"
                value={walk.vehicle_reg_no}
                onChange={(e) => setWalk({ ...walk, vehicle_reg_no: e.target.value.toUpperCase() })}
                placeholder="Vehicle reg no (optional)"
                className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20 uppercase"
              />
              <input
                data-testid="rec-walkin-model"
                value={walk.vehicle_model}
                onChange={(e) => setWalk({ ...walk, vehicle_model: e.target.value })}
                placeholder="Vehicle model (optional)"
                className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
              />
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-ink-muted mb-1 block">
                  Service type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["Paid", "Free"].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      data-testid={`rec-walkin-service-type-${mode.toLowerCase()}`}
                      onClick={() => setWalk({ ...walk, service_type: mode })}
                      className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                        walk.service_type === mode
                          ? "bg-forest-faint border-forest text-forest ring-2 ring-forest/10"
                          : "bg-white border-cream-300 text-ink-soft hover:border-forest/40"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
              <button
                data-testid="rec-walkin-add-btn"
                onClick={addWalkin}
                disabled={actionLoading}
                className="w-full bg-accent text-white py-3 rounded-xl font-bold hover:bg-accent-dark disabled:opacity-60"
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
