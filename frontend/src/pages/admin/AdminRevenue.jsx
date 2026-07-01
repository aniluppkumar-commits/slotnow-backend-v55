import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { Loader2, IndianRupee } from "lucide-react";

export default function AdminRevenue() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/admin/subscription-revenue");
        setData(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <AppShell title="Subscription revenue" showBack>
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-forest" />
        </div>
      </AppShell>
    );
  }

  const items = Array.isArray(data) ? data : (data?.items || data?.records || []);
  const total = items.reduce((s, r) => s + (r.amount || 0), 0);

  return (
    <AppShell title="Subscription revenue" showBack>
      <div className="px-4 sm:px-6 pt-4 space-y-4">
        <div className="bg-gradient-to-br from-accent to-accent-dark rounded-2xl p-5 text-white shadow-lg">
          <div className="text-xs uppercase tracking-widest opacity-80 mb-1">Total revenue</div>
          <div className="flex items-baseline gap-1 font-heading font-black">
            <IndianRupee size={22} strokeWidth={3} />
            <span className="text-4xl">{total.toLocaleString("en-IN")}</span>
          </div>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-ink-soft italic text-center py-8">No records</p>
        ) : (
          <div className="space-y-2">
            {items.map((r, i) => (
              <div key={r.id || i} data-testid={`revenue-item-${i}`} className="bg-white border border-cream-300 rounded-xl p-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-ink">{r.provider_name || r.name || `Record ${i + 1}`}</p>
                  <p className="text-[11px] text-ink-soft">{r.date || r.created_at || ""}</p>
                </div>
                <div className="text-forest font-bold flex items-center gap-0.5">
                  <IndianRupee size={12} strokeWidth={2.5} />{r.amount || 0}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
