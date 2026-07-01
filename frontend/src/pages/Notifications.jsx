import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { useI18n } from "@/i18n";
import { Bell, BellOff, Loader2 } from "lucide-react";

export default function Notifications() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/notifications");
      setItems(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (nid) => {
    try {
      await api.put(`/notifications/${nid}/read`);
      setItems((prev) => prev.map((n) => (n.id === nid ? { ...n, read: true } : n)));
    } catch {}
  };

  return (
    <AppShell title={t("notifications")}>
      <div className="px-4 sm:px-6 pt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-forest" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-20 h-20 bg-cream-200 rounded-full flex items-center justify-center text-ink-soft">
              <BellOff size={32} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-lg font-bold text-ink">{t("all_caught_up")}</p>
              <p className="text-sm text-ink-soft mt-1">{t("no_notifications")}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((n) => (
              <button
                key={n.id}
                data-testid={`notif-item-${n.id}`}
                onClick={() => !n.read && markRead(n.id)}
                className={`w-full text-left rounded-2xl p-4 border transition-colors flex gap-3 ${
                  n.read
                    ? "bg-white border-cream-300"
                    : "bg-forest-faint border-forest/15"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    n.read ? "bg-cream-200 text-ink-soft" : "bg-forest text-cream-100"
                  }`}
                >
                  <Bell size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-bold text-ink truncate ${!n.read && "text-forest"}`}>
                      {n.title}
                    </p>
                    {!n.read && (
                      <span className="w-2 h-2 bg-forest rounded-full shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-xs text-ink-soft mt-0.5">{n.body}</p>
                  <p className="text-[10px] text-ink-muted uppercase tracking-wider font-bold mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
