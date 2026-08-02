import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { Loader2, Users, Share2, Search, Trophy } from "lucide-react";

export default function AdminReferrals() {
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [uRes, bRes] = await Promise.all([
          api.get("/admin/users").catch(() => ({ data: [] })),
          api.get("/admin/bookings").catch(() => ({ data: [] })),
        ]);
        setUsers(Array.isArray(uRes.data) ? uRes.data : uRes.data?.items || []);
        setBookings(Array.isArray(bRes.data) ? bRes.data : bRes.data?.items || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const referralAgg = useMemo(() => {
    // Group users by referred_by (the referrer's phone). Referred users have via_referral=true.
    const referrerMap = new Map();
    const byPhone = new Map();
    users.forEach((u) => {
      if (u.phone) byPhone.set(u.phone, u);
    });
    users.forEach((u) => {
      if (!u.via_referral || !u.referred_by) return;
      const key = u.referred_by;
      if (!referrerMap.has(key)) {
        const src = byPhone.get(key);
        referrerMap.set(key, {
          referrer_phone: key,
          referrer_name: src?.name || "Unknown",
          referrer_role: src?.role || "—",
          referred: [],
        });
      }
      referrerMap.get(key).referred.push(u);
    });

    // Compute conversion — a referred user is "converted" if they have any booking
    const bookedUserIds = new Set();
    bookings.forEach((b) => {
      const uid = b.customer_id || b.customer?.id;
      if (uid) bookedUserIds.add(uid);
    });

    const rows = Array.from(referrerMap.values())
      .map((r) => ({
        ...r,
        total: r.referred.length,
        converted: r.referred.filter((u) => bookedUserIds.has(u.id)).length,
      }))
      .sort((a, b) => b.total - a.total);

    return rows;
  }, [users, bookings]);

  const filtered = useMemo(() => {
    if (!q.trim()) return referralAgg;
    const s = q.toLowerCase();
    return referralAgg.filter(
      (r) =>
        r.referrer_phone.includes(q) ||
        r.referrer_name.toLowerCase().includes(s)
    );
  }, [q, referralAgg]);

  const totalRefs = referralAgg.reduce((s, r) => s + r.total, 0);
  const totalConv = referralAgg.reduce((s, r) => s + r.converted, 0);
  const uniqueRefs = referralAgg.length;

  return (
    <AppShell title="Referrals" showBack>
      <div className="px-4 sm:px-6 pt-4 space-y-4">
        <div className="bg-gradient-to-br from-accent to-accent-dark rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-80 mb-1">
            <Share2 size={14} strokeWidth={2.5} />
            Referral tracking
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <MiniStat testid="ref-stat-referrers" label="Referrers" value={uniqueRefs} />
            <MiniStat testid="ref-stat-total" label="Total refs" value={totalRefs} />
            <MiniStat testid="ref-stat-conv" label="Converted" value={totalConv} />
          </div>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            data-testid="ref-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or phone…"
            className="w-full bg-white border border-cream-300 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-forest/20"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-forest" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-ink-soft italic text-center py-12">No referrals recorded yet</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((r, idx) => {
              const rate = r.total ? Math.round((r.converted / r.total) * 100) : 0;
              return (
                <div key={r.referrer_phone} data-testid={`ref-row-${r.referrer_phone}`} className="bg-white border border-cream-300 rounded-xl p-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 ${idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-slate-400" : idx === 2 ? "bg-amber-800" : "bg-forest"}`}>
                      {idx < 3 ? <Trophy size={16} /> : (r.referrer_name?.[0]?.toUpperCase() || "?")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-ink truncate">{r.referrer_name}</p>
                        <span className="text-[10px] font-bold uppercase text-forest bg-forest-faint px-2 py-0.5 rounded">
                          {r.referrer_role}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-soft flex items-center gap-1 mt-0.5">
                        +91 {r.referrer_phone}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] mt-2">
                        <span className="text-ink-soft">
                          <strong className="text-ink">{r.total}</strong> referred
                        </span>
                        <span className="text-emerald-700">
                          <strong>{r.converted}</strong> booked
                        </span>
                        <span className="ml-auto font-bold text-ink">{rate}%</span>
                      </div>
                      {/* Referred list preview */}
                      {r.referred.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {r.referred.slice(0, 6).map((u) => (
                            <span key={u.id} className="text-[10px] bg-cream-200 text-ink-soft px-1.5 py-0.5 rounded">
                              +91 {u.phone}
                            </span>
                          ))}
                          {r.referred.length > 6 && (
                            <span className="text-[10px] text-ink-muted">+{r.referred.length - 6} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function MiniStat({ label, value, testid }) {
  return (
    <div data-testid={testid} className="bg-white/15 rounded-xl px-2 py-1.5 text-center">
      <div className="text-[9px] uppercase tracking-wider font-bold opacity-70">{label}</div>
      <div className="font-heading text-xl font-extrabold">{value}</div>
    </div>
  );
}
