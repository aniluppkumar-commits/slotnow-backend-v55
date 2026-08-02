import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { Loader2, BarChart3, TrendingUp, CheckCircle2, XCircle, UserX, Activity } from "lucide-react";
import { toast } from "sonner";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const WEEKDAY_LABEL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // Python weekday order
const RANGE_OPTS = [
  { key: 7, label: "7d" },
  { key: 30, label: "30d" },
  { key: 90, label: "90d" },
];

export default function ProviderAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [staffId, setStaffId] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const params = { days };
    if (staffId) params.staff_id = staffId;
    api.get("/providers/me/analytics", { params })
      .then((res) => alive && setData(res.data))
      .catch((e) => toast.error(e?.response?.data?.detail || "Failed to load analytics"))
      .finally(() => alive && setLoading(false));
    return () => (alive = false);
  }, [days, staffId]);

  const activeHeatmap = useMemo(() => {
    if (!data) return null;
    if (staffId) {
      const ps = data.per_staff?.find((s) => s.staff_id === staffId);
      return ps?.heatmap || data.heatmap;
    }
    return data.heatmap;
  }, [data, staffId]);

  const heatMax = useMemo(() => {
    if (!activeHeatmap) return 0;
    let m = 0;
    for (const row of activeHeatmap) for (const v of row) if (v > m) m = v;
    return m;
  }, [activeHeatmap]);

  return (
    <AppShell title="Analytics" showBack>
      <div className="px-4 sm:px-6 pt-4 space-y-5 pb-24">
        {/* Range picker */}
        <div className="flex items-center justify-between">
          <div className="inline-flex bg-white border border-cream-300 rounded-xl p-1" role="tablist">
            {RANGE_OPTS.map((r) => (
              <button
                key={r.key}
                data-testid={`analytics-range-${r.key}`}
                onClick={() => setDays(r.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  days === r.key ? "bg-forest text-cream-100" : "text-ink-soft"
                }`}
              >
                Last {r.label}
              </button>
            ))}
          </div>
          {data?.hospital_staff?.length > 0 && (
            <select
              data-testid="analytics-staff-select"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="bg-white border border-cream-300 rounded-lg text-xs font-bold px-2 py-1.5 text-ink"
            >
              <option value="">All doctors / services</option>
              {data.hospital_staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>

        {loading || !data ? (
          <div className="flex justify-center py-14"><Loader2 className="animate-spin text-forest" /></div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard testid="kpi-total" icon={BarChart3} label="Total bookings" value={data.totals.total} color="text-forest" />
              <KpiCard testid="kpi-completed" icon={CheckCircle2} label="Completed" value={data.totals.completed} color="text-emerald-600" />
              <KpiCard testid="kpi-cancelled" icon={XCircle} label="Cancelled" value={data.totals.cancelled} color="text-rose-500" />
              <KpiCard testid="kpi-noshow" icon={UserX} label="No-show" value={data.totals.no_show} color="text-amber-500" />
            </div>

            {/* Utilisation */}
            <div className="bg-white border border-cream-300 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">Utilisation</p>
                  <p className="text-3xl font-heading font-black text-ink mt-1" data-testid="analytics-util-pct">
                    {(staffId ? data.per_staff.find((s) => s.staff_id === staffId)?.utilisation_pct : data.utilisation_pct) ?? 0}%
                  </p>
                  <p className="text-[11px] text-ink-muted mt-0.5">
                    {data.totals.total} bookings /{" "}
                    {staffId ? data.per_staff.find((s) => s.staff_id === staffId)?.capacity : data.capacity} slots capacity
                  </p>
                </div>
                <TrendingUp className="text-forest opacity-70" size={40} />
              </div>
              <div className="h-2 rounded-full bg-cream-300 mt-4 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-forest to-forest-dark"
                  style={{
                    width: `${Math.min(100, (staffId ? data.per_staff.find((s) => s.staff_id === staffId)?.utilisation_pct : data.utilisation_pct) || 0)}%`,
                  }}
                />
              </div>
            </div>

            {/* Heatmap */}
            <div className="bg-white border border-cream-300 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">Weekly heatmap</p>
                <span className="text-[10px] font-bold text-ink-muted">Bookings per hour</span>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[720px]">
                  <div className="grid" style={{ gridTemplateColumns: "42px repeat(24, 1fr)" }}>
                    <div />
                    {HOURS.map((h) => (
                      <div key={h} className="text-[9px] text-center text-ink-muted font-bold">{h}</div>
                    ))}
                    {WEEKDAY_LABEL.map((wd, wi) => (
                      <React.Fragment key={wd}>
                        <div className="text-[10px] font-bold text-ink pr-1 flex items-center">{wd}</div>
                        {HOURS.map((h) => {
                          const v = activeHeatmap?.[wi]?.[h] || 0;
                          const alpha = heatMax ? v / heatMax : 0;
                          const bg = v === 0 ? "rgba(0,0,0,0.04)" : `rgba(15, 76, 71, ${0.15 + alpha * 0.75})`;
                          return (
                            <div
                              key={h}
                              data-testid={`heat-${wi}-${h}`}
                              title={`${wd} ${h}:00 — ${v} bookings`}
                              className="aspect-square rounded-[3px] m-[1px] flex items-center justify-center text-[9px] font-bold"
                              style={{ backgroundColor: bg, color: alpha > 0.4 ? "white" : "rgba(0,0,0,0.55)" }}
                            >{v || ""}</div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Per-doctor breakdown */}
            {!staffId && data.per_staff.length > 1 && (
              <div className="bg-white border border-cream-300 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">By doctor / service</p>
                </div>
                <div className="space-y-2">
                  {data.per_staff
                    .slice()
                    .sort((a, b) => b.total - a.total)
                    .map((s) => (
                      <div key={s.staff_id || "__prov__"} data-testid={`analytics-row-${s.staff_id || "prov"}`} className="p-3 rounded-xl bg-cream border border-cream-300">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="font-bold text-ink truncate">{s.staff_name || "Provider default"}</p>
                            <p className="text-[11px] text-ink-muted">
                              {s.total} bookings · {s.utilisation_pct}% utilisation · {s.walkin} walk-ins
                            </p>
                          </div>
                          <button
                            data-testid={`analytics-drill-${s.staff_id}`}
                            onClick={() => s.staff_id && setStaffId(s.staff_id)}
                            className="text-[11px] font-bold text-forest hover:underline"
                          >
                            <Activity size={14} className="inline -mt-0.5" /> Drill in
                          </button>
                        </div>
                        <div className="h-1.5 rounded-full bg-cream-300 mt-2 overflow-hidden">
                          <div className="h-full bg-forest" style={{ width: `${Math.min(100, s.utilisation_pct)}%` }} />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function KpiCard({ icon: Icon, label, value, color, testid }) {
  return (
    <div data-testid={testid} className="bg-white border border-cream-300 rounded-2xl p-4">
      <Icon className={color} size={20} />
      <p className="text-2xl font-heading font-black text-ink mt-2">{value ?? 0}</p>
      <p className="text-[10px] uppercase tracking-wider font-bold text-ink-muted mt-0.5">{label}</p>
    </div>
  );
}
