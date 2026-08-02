import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { useI18n } from "@/i18n";
import {
  Loader2,
  Users,
  Store,
  CalendarCheck,
  IndianRupee,
  ChevronRight,
  ShieldCheck,
  MessageSquareText,
  Wallet,
  CheckCircle2,
  XCircle,
  Search,
} from "lucide-react";
import { toast } from "sonner";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [stats, setStats] = useState(null);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [subs, setSubs] = useState(null);

  const load = useCallback(async () => {
    try {
      const [sRes, pRes, subRes] = await Promise.all([
        api.get("/admin/stats").catch(() => ({ data: null })),
        api.get("/admin/providers").catch(() => ({ data: [] })),
        api.get("/admin/subscription-analytics").catch(() => ({ data: null })),
      ]);
      setStats(sRes.data);
      const list = Array.isArray(pRes.data) ? pRes.data : (pRes.data?.items || []);
      setProviders(list);
      setSubs(subRes.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (pid) => {
    setBusyId(pid);
    try {
      await api.put(`/admin/providers/${pid}/approve`);
      toast.success("Approved");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (pid) => {
    if (!window.confirm("Reject this provider?")) return;
    setBusyId(pid);
    try {
      await api.put(`/admin/providers/${pid}/reject`);
      toast.success("Rejected");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const suspend = async (pid) => {
    if (!window.confirm("Suspend this provider? They will not receive new bookings until you re-approve.")) return;
    setBusyId(pid);
    try {
      // Backend uses /reject to mark as unavailable (no dedicated /suspend endpoint)
      await api.put(`/admin/providers/${pid}/reject`);
      toast.success("Suspended");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const unsuspend = async (pid) => {
    setBusyId(pid);
    try {
      await api.put(`/admin/providers/${pid}/approve`);
      toast.success("Re-approved");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const bulkApprove = async () => {
    const pendingIds = providers.filter((p) => p.approved === false || p.status === "pending").map((p) => p.id);
    if (pendingIds.length === 0) return;
    if (!window.confirm(`Approve all ${pendingIds.length} pending providers?`)) return;
    setBulkBusy(true);
    try {
      let ok = 0;
      for (const pid of pendingIds) {
        try {
          await api.put(`/admin/providers/${pid}/approve`);
          ok += 1;
        } catch (err) {
          console.error(`Bulk approve failed for provider ${pid}:`, err);
        }
      }
      toast.success(`Approved ${ok}/${pendingIds.length}`);
      await load();
    } finally {
      setBulkBusy(false);
    }
  };

  const filtered = providers.filter(
    (p) =>
      !q.trim() ||
      p.business_name?.toLowerCase().includes(q.toLowerCase()) ||
      p.city?.toLowerCase().includes(q.toLowerCase())
  );

  const isPending = (p) => p.approved === false || p.status === "pending";
  const pending = filtered.filter(isPending);
  const others = filtered.filter((p) => !isPending(p));

  return (
    <AppShell title="Admin Dashboard">
      <div className="px-4 sm:px-6 pt-4 space-y-5">
        {/* Hero */}
        <div className="bg-gradient-to-br from-forest to-forest-dark rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-80 mb-1">
            <ShieldCheck size={14} strokeWidth={2.5} />
            System Overview
          </div>
          <p className="text-lg font-heading font-bold">Welcome, Admin</p>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-forest" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-2">
            <Stat testid="admin-stat-users" icon={<Users size={16} />} label="Users" value={stats.total_users ?? stats.users ?? "—"} />
            <Stat testid="admin-stat-providers" icon={<Store size={16} />} label="Providers" value={stats.total_providers ?? stats.providers ?? "—"} />
            <Stat testid="admin-stat-bookings" icon={<CalendarCheck size={16} />} label="Bookings" value={stats.total_bookings ?? stats.bookings ?? "—"} />
            <Stat testid="admin-stat-revenue" icon={<IndianRupee size={16} />} label="Revenue" value={`₹${stats.total_revenue ?? stats.revenue ?? 0}`} />
          </div>
        ) : (
          <p className="text-xs text-ink-soft italic">Stats endpoint returned no data</p>
        )}

        {subs && (
          <div className="bg-white border border-cream-300 rounded-2xl p-4" data-testid="admin-subs-card">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Subscriptions</p>
                <h3 className="font-heading font-black text-ink">Provider Pro plans</h3>
              </div>
              <div className="text-right">
                <p className="font-heading text-2xl font-black text-forest">
                  ₹{(subs.mrr_paise / 100).toLocaleString("en-IN")}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">MRR</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3 text-center">
              <div className="bg-emerald-50 rounded-lg py-2">
                <p className="text-xl font-black text-emerald-800">{subs.active_count}</p>
                <p className="text-[10px] font-bold text-emerald-700 uppercase">Active</p>
              </div>
              <div className="bg-amber-50 rounded-lg py-2">
                <p className="text-xl font-black text-amber-800">{subs.expired_count}</p>
                <p className="text-[10px] font-bold text-amber-700 uppercase">Expired</p>
              </div>
              <div className="bg-cream rounded-lg py-2">
                <p className="text-xl font-black text-ink">{subs.total_subscriptions}</p>
                <p className="text-[10px] font-bold text-ink-muted uppercase">Total</p>
              </div>
            </div>
            {subs.by_plan?.length > 0 && (
              <div className="space-y-1.5">
                {subs.by_plan.map((row) => (
                  <div key={row.plan_id} className="flex items-center justify-between text-xs bg-cream rounded-lg px-3 py-1.5">
                    <span className="font-bold text-ink">{row.plan_name}</span>
                    <span className="text-ink-soft">
                      {row.active} active · ₹{(row.monthly_paise / 100).toLocaleString("en-IN")}/mo
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick actions */}
        <div className="bg-white border border-cream-300 rounded-2xl divide-y divide-cream-300">
          <QuickRow testid="admin-open-referrals" icon={<Users size={16} />} title="Referrals" onClick={() => navigate("/admin/referrals")} />
          <QuickRow testid="admin-open-users" icon={<Users size={16} />} title="All users" onClick={() => navigate("/admin/users")} />
          <QuickRow testid="admin-open-bookings" icon={<CalendarCheck size={16} />} title="All bookings" onClick={() => navigate("/admin/bookings")} />
          <QuickRow testid="admin-open-revenue" icon={<Wallet size={16} />} title="Subscription revenue" onClick={() => navigate("/admin/revenue")} />
          <QuickRow testid="admin-open-settings-sms" icon={<MessageSquareText size={16} />} title="SMS settings" onClick={() => navigate("/admin/settings/sms")} />
          <QuickRow testid="admin-open-settings-payment" icon={<Wallet size={16} />} title="Payment settings" onClick={() => navigate("/admin/settings/payment")} />
        </div>

        {/* Search + providers */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-ink-soft">Providers</h3>
            <span className="text-[10px] font-bold text-ink-muted">{filtered.length}</span>
          </div>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              data-testid="admin-provider-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search providers…"
              className="w-full bg-white border border-cream-300 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-forest/20"
            />
          </div>

          {pending.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 rounded-lg px-2 py-1 inline-block">
                  Pending approval · {pending.length}
                </p>
                <button
                  data-testid="admin-bulk-approve-btn"
                  onClick={bulkApprove}
                  disabled={bulkBusy}
                  className="text-[11px] font-bold bg-forest text-white hover:bg-forest-dark px-3 py-1.5 rounded-full disabled:opacity-50"
                >
                  {bulkBusy ? "Approving…" : `Approve all (${pending.length})`}
                </button>
              </div>
              <div className="space-y-2 mb-4">
                {pending.map((p) => (
                  <ProviderRow key={p.id} p={p} busy={busyId === p.id} onApprove={() => approve(p.id)} onReject={() => reject(p.id)} />
                ))}
              </div>
            </>
          )}

          <div className="space-y-2">
            {others.map((p) => (
              <ProviderRow
                key={p.id}
                p={p}
                onApprove={() => approve(p.id)}
                onReject={() => reject(p.id)}
                onSuspend={() => suspend(p.id)}
                onUnsuspend={() => unsuspend(p.id)}
                busy={busyId === p.id}
              />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ icon, label, value, testid }) {
  return (
    <div data-testid={testid} className="bg-white border border-cream-300 rounded-2xl p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-ink-muted">
        {icon} {label}
      </div>
      <div className="font-heading text-2xl font-extrabold text-ink mt-1">{value}</div>
    </div>
  );
}

function QuickRow({ icon, title, onClick, testid }) {
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

function ProviderRow({ p, onApprove, onReject, onSuspend, onUnsuspend, busy, readOnly }) {
  const isPending = p.approved === false || p.status === "pending";
  const isApproved = p.approved === true || p.status === "approved";
  const isRejected = p.status === "rejected" || p.status === "suspended";
  const statusPill = isApproved
    ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
    : isRejected
    ? "bg-rose-50 text-rose-800 ring-rose-100"
    : "bg-amber-50 text-amber-800 ring-amber-100";
  const statusLabel = isApproved ? "approved" : isRejected ? "suspended" : "pending";
  return (
    <div data-testid={`admin-provider-${p.id}`} className="bg-white border border-cream-300 rounded-xl p-3 flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl bg-cream-200 overflow-hidden shrink-0">
        {p.image && <img src={p.image} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink truncate">{p.business_name}</p>
        <p className="text-[11px] text-ink-soft truncate">{p.city || "—"}</p>
        <span className={`inline-block mt-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ring-1 ${statusPill}`}>
          {statusLabel}
        </span>
      </div>
      {!readOnly && (
        <div className="flex gap-1 shrink-0">
          {isPending && (
            <>
              <button
                data-testid={`admin-approve-${p.id}`}
                onClick={onApprove}
                disabled={busy}
                className="p-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                title="Approve"
              >
                <CheckCircle2 size={16} />
              </button>
              <button
                data-testid={`admin-reject-${p.id}`}
                onClick={onReject}
                disabled={busy}
                className="p-2 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                title="Reject"
              >
                <XCircle size={16} />
              </button>
            </>
          )}
          {isApproved && (
            <button
              data-testid={`admin-suspend-${p.id}`}
              onClick={onSuspend}
              disabled={busy}
              className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50 text-[11px] font-bold"
              title="Suspend"
            >
              Suspend
            </button>
          )}
          {isRejected && (
            <button
              data-testid={`admin-unsuspend-${p.id}`}
              onClick={onUnsuspend}
              disabled={busy}
              className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 text-[11px] font-bold"
              title="Re-approve"
            >
              Re-approve
            </button>
          )}
        </div>
      )}
    </div>
  );
}
