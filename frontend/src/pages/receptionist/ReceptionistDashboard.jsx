import React, { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { useI18n } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import useLivePolling from "@/hooks/useLivePolling";
import { StatusBadge, formatTime } from "@/lib/utils-app";
import {
  Loader2,
  Clock,
  ChevronRight,
  UserPlus,
  Phone as PhoneIcon,
  X,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";

export default function ReceptionistDashboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [providerInfo, setProviderInfo] = useState(null);
  const [queue, setQueue] = useState([]);
  const [currentToken, setCurrentToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [walkOpen, setWalkOpen] = useState(false);
  const [walk, setWalk] = useState({ name: "", phone: "", vehicle_reg_no: "", vehicle_model: "" });

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
      });
      toast.success(`Added • Token #${data.token_number}`);
      setWalk({ name: "", phone: "", vehicle_reg_no: "", vehicle_model: "" });
      setWalkOpen(false);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setActionLoading(false);
    }
  };

  const active = queue.filter((b) => !["completed", "cancelled"].includes(b.status));

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
        <div className="grid grid-cols-2 gap-2">
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
        </div>

        {/* Queue */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-forest" />
          </div>
        ) : queue.length === 0 ? (
          <p className="text-sm text-ink-soft italic text-center py-12">{t("no_bookings_today")}</p>
        ) : (
          <div className="space-y-2">
            {queue.map((b) => (
              <div
                key={b.id}
                data-testid={`receptionist-queue-${b.id}`}
                className={`bg-white border border-cream-300 rounded-xl p-3 flex items-center gap-3 ${
                  b.status === "in_progress" ? "ring-2 ring-forest bg-forest-faint" : ""
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                    b.status === "in_progress"
                      ? "bg-forest text-white"
                      : b.status === "completed"
                      ? "bg-cream-200 text-ink-muted line-through"
                      : "bg-forest-faint text-forest"
                  }`}
                >
                  #{b.token_number}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-ink truncate">
                      {b.customer_name || b.customer?.name || "Customer"}
                    </p>
                    {b.is_walkin && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded uppercase tracking-wider">
                        Walk-in
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ink-soft mt-0.5">
                    <span className="flex items-center gap-0.5">
                      <Clock size={11} /> {formatTime(b.start_time)}
                    </span>
                    <span>·</span>
                    <span className="truncate">{b.service_name}</span>
                  </div>
                  {b.customer_phone && (
                    <a
                      href={`tel:${b.customer_phone}`}
                      className="text-[11px] text-forest font-semibold flex items-center gap-1 mt-0.5"
                    >
                      <PhoneIcon size={10} /> {b.customer_phone}
                    </a>
                  )}
                </div>
                <StatusBadge status={b.status} />
              </div>
            ))}
          </div>
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
