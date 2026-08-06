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
  Calendar as CalendarIcon,
} from "lucide-react";
import AssistantMultiQueue from "@/components/AssistantMultiQueue";
import StaffQueueModal from "@/components/StaffQueueModal";
import { toast } from "sonner";
import { todayISO } from "@/lib/utils-app";

// Build a 7-day date strip: -3, -2, -1, TODAY, +1, +2, +3 (all local ISO YYYY-MM-DD).
function buildDateStrip(centerIsoLocal) {
  const [y, m, d] = centerIsoLocal.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  const dates = [];
  for (let i = -3; i <= 3; i++) {
    const dt = new Date(base);
    dt.setDate(base.getDate() + i);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    dates.push({
      iso,
      label: dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      weekday: dt.toLocaleDateString("en-IN", { weekday: "short" }),
      offset: i,
    });
  }
  return dates;
}

function SortableItem({ booking, providerName, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) {
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
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
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
  const [walk, setWalk] = useState({ name: "", phone: "", address: "", vehicle_reg_no: "", vehicle_model: "", service_ref: "", service_type: "Paid", staff_id: "" });
  const [hospitalStaff, setHospitalStaff] = useState([]);
  // Date navigation: default to today (local IST) — assistant can view ±3 days.
  const today = todayISO();
  const [selectedDate, setSelectedDate] = useState(today);
  const dateStrip = buildDateStrip(today);
  const isToday = selectedDate === today;
  // Per-staff drill-in modal — when set, renders StaffQueueModal.
  const [openStaff, setOpenStaff] = useState(null);
  // Bump on walk-in success so AssistantMultiQueue also refreshes immediately.
  const [multiRefreshKey, setMultiRefreshKey] = useState(0);

  const isAutomobile =
    // The /queue/today response returns provider.category as a STRING (e.g. "Automobile"),
    // not a category_id — so match by name (case-insensitive) and also fall back to
    // category_id if the backend response is ever extended to include it.
    (providerInfo?.category || "").toLowerCase() === "automobile" ||
    providerInfo?.category_id === "333a2602-2d4a-4e16-a9da-3e004b0e14fd";
  const isHospital = (providerInfo?.provider_type || "").toLowerCase() === "hospital";

  // For hospital walk-ins we need to know which sub-doctor/service to attach the token to.
  useEffect(() => {
    if (!isHospital || !providerInfo?.id) {
      setHospitalStaff([]);
      return;
    }
    let alive = true;
    api
      .get(`/providers/${providerInfo.id}/staff`)
      .then((r) => alive && setHospitalStaff(Array.isArray(r.data) ? r.data.filter((s) => s.active !== false) : []))
      .catch(() => alive && setHospitalStaff([]));
    return () => { alive = false; };
  }, [isHospital, providerInfo?.id]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.set("date", selectedDate);
      const { data } = await api.get(`/queue/today${params.toString() ? "?" + params.toString() : ""}`);
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
  }, [selectedDate]);

  useEffect(() => {
    load();
  }, [load]);

  // Only live-poll for today's date; historical/future views are static.
  useLivePolling(load, 4000, isToday);

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

  const openWalkinFor = (opts = {}) => {
    // Allow opening the walk-in modal pre-scoped to a specific hospital staff.
    setWalk((w) => ({
      ...w,
      staff_id: opts.staff_id || "",
    }));
    setWalkOpen(true);
  };

  const addWalkin = async () => {
    if (!walk.name.trim()) return toast.error("Name required");
    if (isHospital && hospitalStaff.length > 0 && !walk.staff_id) {
      return toast.error("Select a doctor or service for this walk-in");
    }
    setActionLoading(true);
    try {
      const payload = {
        name: walk.name,
        phone: walk.phone || null,
      };
      if (walk.staff_id) payload.staff_id = walk.staff_id;
      if (isAutomobile) {
        payload.vehicle_reg_no = walk.vehicle_reg_no || null;
        payload.vehicle_model = walk.vehicle_model || null;
        payload.service_type = walk.service_type || "Paid";
        if (walk.service_ref) payload.notes = `Ref: ${walk.service_ref}`;
      } else if (walk.address) {
        payload.notes = walk.address;
      }
      // Support back-dating / forward-dating via ?date=YYYY-MM-DD
      const qs = !isToday ? `?date=${encodeURIComponent(selectedDate)}` : "";
      const { data } = await api.post(`/queue/walkin${qs}`, payload);
      toast.success(`Added • Token #${data.token_number}`);
      setWalk({ name: "", phone: "", address: "", vehicle_reg_no: "", vehicle_model: "", service_ref: "", service_type: "Paid", staff_id: "" });
      setWalkOpen(false);
      await load();
      setMultiRefreshKey((k) => k + 1);
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

  // Persist a reordered queue to the backend. Optimistically updates local state;
  // reloads on failure. Used by both drag-and-drop and ↑/↓ button reordering.
  const persistReorder = useCallback(
    async (reordered) => {
      setQueue(reordered);
      try {
        const activeIds = reordered
          .filter((b) => !["completed", "cancelled"].includes(b.status))
          .map((b) => b.id);
        await api.post("/queue/reorder", { date: todayISO(), ordered_ids: activeIds });
        toast.success("Queue reordered");
      } catch (e) {
        toast.error(e.response?.data?.detail || "Failed to reorder");
        await load();
      }
    },
    [load]
  );

  const handleDragEnd = async (event) => {
    const { active: dragged, over } = event;
    if (!dragged || !over || dragged.id === over.id) return;
    const oldIdx = queue.findIndex((b) => b.id === dragged.id);
    const newIdx = queue.findIndex((b) => b.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    await persistReorder(arrayMove(queue, oldIdx, newIdx));
  };

  const moveByOne = async (bookingId, direction) => {
    const idx = queue.findIndex((b) => b.id === bookingId);
    if (idx < 0) return;
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= queue.length) return;
    await persistReorder(arrayMove(queue, idx, target));
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
          {user?.photo ? (
            <img
              data-testid="receptionist-self-photo"
              src={user.photo}
              alt={user.name || "Assistant"}
              className="w-12 h-12 rounded-xl object-cover ring-2 ring-white/40"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <UserCog size={20} />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest opacity-70">Assisting</p>
            <p data-testid="receptionist-provider-name" className="font-heading font-bold truncate">{businessName}</p>
            {user?.name && (
              <p data-testid="receptionist-self-name" className="text-[11px] opacity-80 truncate">
                {user.name}{user.designation ? ` · ${user.designation}` : ""}
              </p>
            )}
            {city && <p className="text-[11px] opacity-70 truncate">{city}</p>}
          </div>
          {currentToken != null && (
            <div className="ml-auto text-right">
              <p className="text-[10px] uppercase tracking-widest opacity-70">Now serving</p>
              <p className="font-heading font-black text-2xl">#{currentToken}</p>
              <p data-testid="receptionist-selected-date" className="text-[10px] uppercase tracking-widest opacity-70 mt-1">
                {isToday ? "Today" : selectedDate}
              </p>
            </div>
          )}
        </div>

        {/* Date navigation strip (−3 … today … +3) */}
        <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-1" data-testid="receptionist-date-strip">
          {dateStrip.map((d) => {
            const on = d.iso === selectedDate;
            const isTodayCell = d.iso === today;
            return (
              <button
                key={d.iso}
                data-testid={`date-cell-${d.iso}`}
                onClick={() => setSelectedDate(d.iso)}
                className={`shrink-0 min-w-[64px] rounded-xl px-2.5 py-2 text-center border-2 transition-all ${
                  on
                    ? "bg-forest border-forest text-cream-100 shadow-md"
                    : "bg-white border-cream-300 text-ink hover:border-forest/40"
                }`}
              >
                <p className={`text-[10px] font-bold uppercase tracking-wider ${on ? "text-cream-200" : "text-ink-muted"}`}>
                  {isTodayCell ? "Today" : d.weekday}
                </p>
                <p className={`text-sm font-black ${on ? "text-cream-100" : "text-ink"}`}>
                  {d.label}
                </p>
              </button>
            );
          })}
        </div>

        {/* Multi-staff live queue (hospitals) — up to 3 assigned doctors/services */}
        <AssistantMultiQueue
          date={selectedDate}
          refreshKey={multiRefreshKey}
          onOpenStaff={(s) => setOpenStaff({
            staff_id: s.staff_id, staff_name: s.staff_name, staff_kind: s.staff_kind,
          })}
        />

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2">
          <button
            data-testid="receptionist-call-next-btn"
            onClick={callNext}
            disabled={actionLoading || active.length === 0 || !isToday}
            className="flex items-center justify-center gap-2 bg-accent text-white py-3 rounded-xl font-bold text-sm disabled:opacity-40 hover:bg-accent-dark"
          >
            <ChevronRight size={16} /> Call next
          </button>
          <button
            data-testid="receptionist-walkin-btn"
            onClick={() => openWalkinFor()}
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
              <GripVertical size={11} /> Drag or use ↑ ↓ to reorder
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={queue.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {queue.map((b, idx) => (
                    <SortableItem
                      key={b.id}
                      booking={b}
                      providerName={providerInfo?.business_name}
                      onMoveUp={() => moveByOne(b.id, "up")}
                      onMoveDown={() => moveByOne(b.id, "down")}
                      canMoveUp={idx > 0}
                      canMoveDown={idx < queue.length - 1}
                    />
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

              {isHospital && hospitalStaff.length > 0 && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-ink-muted mb-1 block">
                    Doctor / Service *
                  </label>
                  <select
                    data-testid="rec-walkin-staff"
                    value={walk.staff_id}
                    onChange={(e) => setWalk({ ...walk, staff_id: e.target.value })}
                    className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
                  >
                    <option value="">Select doctor or service…</option>
                    {hospitalStaff.filter((s) => s.kind === "doctor").length > 0 && (
                      <optgroup label="Doctors">
                        {hospitalStaff.filter((s) => s.kind === "doctor").map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}{d.specialization ? ` — ${d.specialization}` : ""}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {hospitalStaff.filter((s) => s.kind === "service").length > 0 && (
                      <optgroup label="Other Services">
                        {hospitalStaff.filter((s) => s.kind === "service").map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              )}
              {isAutomobile ? (
                <>
                  <input
                    data-testid="rec-walkin-reg"
                    value={walk.vehicle_reg_no}
                    onChange={(e) => setWalk({ ...walk, vehicle_reg_no: e.target.value.toUpperCase() })}
                    placeholder="Vehicle registration no *"
                    className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20 uppercase"
                  />
                  <input
                    data-testid="rec-walkin-model"
                    value={walk.vehicle_model}
                    onChange={(e) => setWalk({ ...walk, vehicle_model: e.target.value })}
                    placeholder="Vehicle model *"
                    className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
                  />
                  <input
                    data-testid="rec-walkin-service-ref"
                    value={walk.service_ref}
                    onChange={(e) => setWalk({ ...walk, service_ref: e.target.value })}
                    placeholder="Service / Ref no (optional)"
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
                </>
              ) : (
                <input
                  data-testid="rec-walkin-address"
                  value={walk.address}
                  onChange={(e) => setWalk({ ...walk, address: e.target.value })}
                  placeholder="Address (optional)"
                  className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
                />
              )}
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

      {openStaff && (
        <StaffQueueModal
          staffId={openStaff.staff_id}
          staffName={openStaff.staff_name}
          staffKind={openStaff.staff_kind}
          date={selectedDate}
          onClose={() => setOpenStaff(null)}
          onWalkinRequested={({ staff_id }) => {
            setOpenStaff(null);
            openWalkinFor({ staff_id });
          }}
        />
      )}
    </AppShell>
  );
}
