import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { Loader2, User as UserIcon, Phone as PhoneIcon, Search } from "lucide-react";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/admin/users");
        setUsers(Array.isArray(data) ? data : data?.items || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = users.filter(
    (u) =>
      !q.trim() ||
      u.name?.toLowerCase().includes(q.toLowerCase()) ||
      u.phone?.includes(q) ||
      u.email?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <AppShell title="All Users" showBack>
      <div className="px-4 sm:px-6 pt-4">
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            data-testid="admin-users-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, phone, email…"
            className="w-full bg-white border border-cream-300 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-forest/20"
          />
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-forest" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-ink-soft italic text-center py-8">No users</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((u) => (
              <div key={u.id} data-testid={`admin-user-${u.id}`} className="bg-white border border-cream-300 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-forest text-white flex items-center justify-center font-bold">
                  {u.name?.[0]?.toUpperCase() || <UserIcon size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink truncate">{u.name || "—"}</p>
                  <p className="text-[11px] text-ink-soft flex items-center gap-1"><PhoneIcon size={10} /> +91 {u.phone}</p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  u.role === "admin" ? "bg-rose-50 text-rose-800" :
                  u.role === "provider" ? "bg-indigo-50 text-indigo-800" :
                  u.role === "receptionist" ? "bg-amber-50 text-amber-800" :
                  "bg-emerald-50 text-emerald-800"
                }`}>
                  {u.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
