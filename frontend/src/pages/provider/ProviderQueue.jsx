import React, { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { useI18n } from "@/i18n";
import useLivePolling from "@/hooks/useLivePolling";
import QueueRow from "@/components/QueueRow";
import { Loader2, ChevronRight, UserPlus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { isAutomobileProvider } from "@/lib/providerType";

export default function ProviderQueue() {
  const { t } = useI18n();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [walkOpen, setWalkOpen] = useState(false);
  const [walk, setWalk] = useState({ name: "", phone: "", vehicle_reg_no: "", vehicle_model: "", service_type: "Paid" });
  const [services, setServices] = useState([]);
  const [profile, setProfile] = useState(null);
  const isAutomobile = isAutomobileProvider(profile);

  const load = useCallback(async () => {
    try {
      const [qRes, sRes, pRes] = await Promise.all([
        api.get("/queue/today").catch(() => ({ data: [] })),
        api.get("/providers/me/services").catch(() => ({ data: [] })),
        api.get("/providers/me").catch(() => ({ data: null })),
      ]);
      const arr = Array.isArray(qRes.data)
        ? qRes.data
        : (qRes.data?.queue || qRes.data?.items || qRes.data?.bookings || []);
      setQueue(arr);
      setServices(Array.isArray(sRes.data) ? sRes.data : []);
      // /providers/me returns { provider, services, reviews, category, has_availability }
      const prov = pRes.data?.provider || pRes.data;
      const catName = pRes.data?.category?.name || prov?.category_name;
      setProfile(prov ? { ...prov, category_name: catName } : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates every 4s
  useLivePolling(load, 4000, true);

  const callNext = async () => {
    setActionLoading(true);
    try {
      await api.post("/queue/next");
      await load();
      toast.success("Next customer called");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setActionLoading(false);
    }
  };

  const resetQueue = async () => {
    if (!window.confirm("Reset today's queue? This affects statuses.")) return;
    setActionLoading(true);
    try {
      await api.post("/queue/reset");
      await load();
      toast.success("Queue reset");
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
      const payload = {
        name: walk.name,
        phone: walk.phone || null,
        vehicle_reg_no: walk.vehicle_reg_no || null,
        vehicle_model: walk.vehicle_model || null,
        service_type: walk.service_type || "Paid",
      };
      const { data } = await api.post("/queue/walkin", payload);
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

  return (
    <AppShell
      title={t("today_queue")}
      headerRight={
        <div className="flex items-center gap-1.5 text-[11px] text-forest font-bold uppercase tracking-wider">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse-dot" />
          Live
        </div>
      }
    >
      <div className="px-4 sm:px-6 pt-4 space-y-4">
        {/* Actions */}
        <div className="grid grid-cols-3 gap-2">
          <button
            data-testid="queue-call-next-btn"
            onClick={callNext}
            disabled={actionLoading || active.length === 0}
            className="flex flex-col items-center gap-1 bg-forest text-cream-100 py-3 rounded-xl font-bold text-xs disabled:opacity-40 hover:bg-forest-dark"
          >
            <ChevronRight size={18} />
            {t("call_next")}
          </button>
          <button
            data-testid="queue-walkin-btn"
            onClick={() => setWalkOpen(true)}
            className="flex flex-col items-center gap-1 bg-white border border-cream-300 text-ink py-3 rounded-xl font-bold text-xs hover:border-forest/40"
          >
            <UserPlus size={18} />
            {t("walk_in")}
          </button>
          <button
            data-testid="queue-reset-btn"
            onClick={resetQueue}
            disabled={actionLoading}
            className="flex flex-col items-center gap-1 bg-white border border-rose-200 text-rose-700 py-3 rounded-xl font-bold text-xs disabled:opacity-40 hover:bg-rose-50"
          >
            <RotateCcw size={18} />
            {t("reset_queue")}
          </button>
        </div>

        {/* Queue list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-forest" />
          </div>
        ) : queue.length === 0 ? (
          <p className="text-sm text-ink-soft italic text-center py-12">{t("no_bookings_today")}</p>
        ) : (
          <div className="space-y-2">
            {queue.map((b) => (
              <QueueRow key={b.id} booking={b} />
            ))}
          </div>
        )}
      </div>

      {/* Walk-in modal */}
      {walkOpen && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center px-4 pb-24 sm:pb-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-bold text-lg text-ink">{t("walk_in_customer")}</h3>
              <button
                data-testid="walkin-close-btn"
                onClick={() => setWalkOpen(false)}
                className="p-1 rounded-lg hover:bg-cream-200"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2">
              <input
                data-testid="walkin-name"
                value={walk.name}
                onChange={(e) => setWalk({ ...walk, name: e.target.value })}
                placeholder="Customer name *"
                className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
              />
              <input
                data-testid="walkin-phone"
                value={walk.phone}
                onChange={(e) => setWalk({ ...walk, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                placeholder="Phone (optional)"
                className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
              />
              {isAutomobile && (
                <>
                  <input
                    data-testid="walkin-vehicle-reg"
                    value={walk.vehicle_reg_no}
                    onChange={(e) => setWalk({ ...walk, vehicle_reg_no: e.target.value })}
                    placeholder="Vehicle reg no (optional)"
                    className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
                  />
                  <input
                    data-testid="walkin-vehicle-model"
                    value={walk.vehicle_model}
                    onChange={(e) => setWalk({ ...walk, vehicle_model: e.target.value })}
                    placeholder="Vehicle model (optional)"
                    className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
                  />
                </>
              )}
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-ink-muted mb-1 block">
                  Service type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["Paid", "Free"].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      data-testid={`walkin-service-type-${mode.toLowerCase()}`}
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
                data-testid="walkin-add-btn"
                onClick={addWalkin}
                disabled={actionLoading}
                className="w-full bg-forest text-cream-100 py-3 rounded-xl font-bold hover:bg-forest-dark disabled:opacity-60"
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> : t("add")}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
