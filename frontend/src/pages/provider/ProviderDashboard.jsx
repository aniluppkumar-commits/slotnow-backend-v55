import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { useI18n } from "@/i18n";
import {
  Store,
  Loader2,
  Power,
  ChevronRight,
  Clock,
  IndianRupee,
  Users2,
  Plus,
  Trash2,
  X,
  Calendar,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";

export default function ProviderDashboard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dutyLoading, setDutyLoading] = useState(false);
  const [queue, setQueue] = useState([]);
  const [capOpen, setCapOpen] = useState(false);
  const [cap, setCap] = useState("");
  const [capLoading, setCapLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [meRes, qRes] = await Promise.all([
        api.get("/providers/me/profile"),
        api.get("/queue/today").catch(() => ({ data: [] })),
      ]);
      setProfile(meRes.data);
      setQueue(qRes.data || []);
      setCap(meRes.data?.daily_slot_limit || "");
    } catch (e) {
      if (e.response?.status === 404) {
        navigate("/provider/onboarding", { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDuty = async () => {
    setDutyLoading(true);
    try {
      await api.put("/providers/me/duty", { on_duty: !profile.on_duty });
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setDutyLoading(false);
    }
  };

  const saveCap = async () => {
    setCapLoading(true);
    try {
      await api.put("/providers/me/capacity", {
        daily_slot_limit: cap === "" ? null : Number(cap),
      });
      toast.success("Capacity updated");
      setCapOpen(false);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setCapLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell title={t("provider_dashboard")}>
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-forest" />
        </div>
      </AppShell>
    );
  }

  const active = queue.filter((b) => !["completed", "cancelled"].includes(b.status));
  const completed = queue.filter((b) => b.status === "completed");
  const revenue = completed.reduce((sum, b) => sum + (b.price || 0), 0);

  return (
    <AppShell title={t("provider_dashboard")}>
      <div className="px-4 sm:px-6 pt-4 space-y-5">
        {/* Profile card */}
        <div className="bg-white border border-cream-300 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-cream-200 shrink-0">
            {profile?.image ? (
              <img src={profile.image} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-ink-soft">
                <Store size={22} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-heading font-bold text-ink truncate">{profile?.business_name}</p>
            <p className="text-xs text-ink-soft truncate">{profile?.city}</p>
          </div>
          <button
            data-testid="provider-duty-toggle"
            onClick={toggleDuty}
            disabled={dutyLoading}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              profile?.on_duty
                ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
                : "bg-cream-200 text-ink-soft"
            }`}
          >
            {dutyLoading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Power size={13} strokeWidth={2.5} />
            )}
            {profile?.on_duty ? t("on_duty") : t("off_duty")}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Today" value={active.length} testid="stat-today" />
          <Stat label="Done" value={completed.length} testid="stat-done" />
          <Stat label={<span className="flex items-center justify-center gap-0.5"><IndianRupee size={11} /> Rev</span>} value={revenue} testid="stat-revenue" />
        </div>

        {/* Manage */}
        <div className="bg-white border border-cream-300 rounded-2xl divide-y divide-cream-300">
          <Row
            testid="provider-manage-services"
            icon={<Settings2 size={16} />}
            title={t("services")}
            onClick={() => navigate("/provider/services")}
          />
          <Row
            testid="provider-manage-availability"
            icon={<Calendar size={16} />}
            title={t("availability")}
            onClick={() => navigate("/provider/availability")}
          />
          <Row
            testid="provider-manage-capacity"
            icon={<Users2 size={16} />}
            title={`${t("daily_capacity")}${profile?.daily_slot_limit ? ` • ${profile.daily_slot_limit}` : ""}`}
            onClick={() => setCapOpen(true)}
          />
          <Row
            testid="provider-edit-profile"
            icon={<Store size={16} />}
            title="Edit profile"
            onClick={() => navigate("/provider/onboarding")}
          />
        </div>

        {/* Queue preview */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-ink-soft">
              {t("today_queue")}
            </h3>
            <button
              data-testid="provider-open-queue"
              onClick={() => navigate("/provider/queue")}
              className="text-xs font-bold text-forest flex items-center gap-1"
            >
              Open <ChevronRight size={14} />
            </button>
          </div>
          {queue.length === 0 ? (
            <p className="text-sm text-ink-soft italic text-center py-6 bg-white border border-cream-300 rounded-2xl">
              {t("no_bookings_today")}
            </p>
          ) : (
            <div className="space-y-2">
              {queue.slice(0, 3).map((b) => (
                <div key={b.id} className="bg-white border border-cream-300 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-forest-faint text-forest flex items-center justify-center font-black text-sm">
                    #{b.token_number}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink truncate">
                      {b.customer_name || b.customer?.name || "Customer"}
                    </p>
                    <p className="text-xs text-ink-soft truncate flex items-center gap-1">
                      <Clock size={11} /> {b.start_time} · {b.service_name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Capacity modal */}
      {capOpen && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-bold text-lg text-ink">{t("daily_capacity")}</h3>
              <button
                data-testid="cap-close"
                onClick={() => setCapOpen(false)}
                className="p-1 rounded-lg hover:bg-cream-200"
              >
                <X size={18} />
              </button>
            </div>
            <input
              data-testid="cap-input"
              type="number"
              min="0"
              placeholder="e.g., 30 (blank = unlimited)"
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              className="w-full bg-white border border-cream-300 rounded-xl px-3 py-3 text-ink font-medium outline-none focus:ring-2 focus:ring-forest/20"
            />
            <button
              data-testid="cap-save-btn"
              onClick={saveCap}
              disabled={capLoading}
              className="w-full mt-3 bg-forest text-cream-100 py-3 rounded-xl font-bold hover:bg-forest-dark disabled:opacity-60"
            >
              {capLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Save"}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Stat({ label, value, testid }) {
  return (
    <div data-testid={testid} className="bg-white border border-cream-300 rounded-2xl p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">{label}</div>
      <div className="font-heading text-2xl font-extrabold text-ink mt-1">{value}</div>
    </div>
  );
}

function Row({ icon, title, onClick, testid }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-cream-200/40 transition-colors"
    >
      <div className="w-8 h-8 bg-cream-200 rounded-lg flex items-center justify-center text-ink-soft">
        {icon}
      </div>
      <p className="flex-1 font-semibold text-ink text-sm">{title}</p>
      <ChevronRight size={16} className="text-ink-muted" />
    </button>
  );
}
