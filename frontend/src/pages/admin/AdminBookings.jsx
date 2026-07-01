import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { StatusBadge, formatDate, formatTime } from "@/lib/utils-app";
import { Loader2, Search } from "lucide-react";

export default function AdminBookings() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/admin/bookings");
        setItems(Array.isArray(data) ? data : data?.items || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = items.filter(
    (b) =>
      !q.trim() ||
      b.service_name?.toLowerCase().includes(q.toLowerCase()) ||
      b.customer_phone?.includes(q) ||
      b.provider?.business_name?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <AppShell title="All Bookings" showBack>
      <div className="px-4 sm:px-6 pt-4">
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            data-testid="admin-bookings-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search bookings…"
            className="w-full bg-white border border-cream-300 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-forest/20"
          />
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-forest" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-ink-soft italic text-center py-8">No bookings</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((b) => (
              <div key={b.id} data-testid={`admin-booking-${b.id}`} className="bg-white border border-cream-300 rounded-xl p-3">
                <div className="flex justify-between items-start gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink truncate">{b.provider?.business_name || "Provider"}</p>
                    <p className="text-xs text-ink-soft truncate">{b.service_name}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-ink-soft pt-2 border-t border-cream-300">
                  <span>{formatDate(b.date)} · {formatTime(b.start_time)}</span>
                  <span className="font-bold text-ink">₹{b.price}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
