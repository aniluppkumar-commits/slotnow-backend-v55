import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n";
import AppShell from "@/components/AppShell";
import CategoryIcon from "@/components/CategoryIcon";
import { catStyle } from "@/lib/utils-app";
import { Search, Star, MapPin, Bell, TrendingUp, Loader2 } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [categories, setCategories] = useState([]);
  const [providers, setProviders] = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [catRes, provRes, notifRes] = await Promise.all([
          api.get("/categories"),
          api.get("/providers"),
          api.get("/notifications").catch(() => ({ data: [] })),
        ]);
        if (!mounted) return;
        setCategories(catRes.data || []);
        setProviders(provRes.data || []);
        setNotifCount((notifRes.data || []).filter((n) => !n.read).length);
      } catch (e) {
        // silent
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return providers;
    const q = query.toLowerCase();
    return providers.filter(
      (p) =>
        p.business_name?.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.bio?.toLowerCase().includes(q)
    );
  }, [providers, query]);

  const top = filtered.slice(0, 3);
  const rest = filtered.slice(3);

  return (
    <AppShell
      title={`${t("hello")}${user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋`}
      headerRight={
        <button
          data-testid="header-notif-btn"
          onClick={() => navigate("/notifications")}
          className="relative p-2 rounded-lg hover:bg-cream-200 transition-colors"
        >
          <Bell size={20} className="text-ink" />
          {notifCount > 0 && (
            <span
              data-testid="header-notif-count"
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
            >
              {notifCount}
            </span>
          )}
        </button>
      }
    >
      <div className="px-4 sm:px-6 pt-4">
        {/* Hero */}
        <div className="mb-6">
          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tighter text-ink leading-tight">
            {t("skip_wait")}<br />
            <span className="text-forest">{t("book_slot")}</span>
          </h2>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft"
          />
          <input
            data-testid="home-search-input"
            type="text"
            placeholder={t("search_placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white border border-cream-300 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-ink placeholder:text-ink-muted focus:ring-2 focus:ring-forest/15 focus:border-forest outline-none transition-all"
          />
        </div>

        {/* Categories */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-ink-soft">
              {t("explore_categories")}
            </h3>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-forest" />
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {categories.map((c) => {
                const style = catStyle(c.color);
                return (
                  <button
                    key={c.id}
                    data-testid={`home-category-btn-${c.name.toLowerCase().replace(/\s+/g, "-")}`}
                    onClick={() => navigate(`/category/${c.id}`)}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div
                      className={`w-16 h-16 sm:w-[68px] sm:h-[68px] rounded-2xl flex items-center justify-center transition-all group-hover:-translate-y-0.5 group-hover:shadow-md ring-1 ${style.bg} ${style.text} ${style.ring}`}
                    >
                      <CategoryIcon name={c.icon} size={28} strokeWidth={1.75} />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold text-ink leading-tight">
                        {lang === "hi" ? c.name_hi : c.name}
                      </p>
                      <p className="text-[10px] text-ink-muted font-deva">
                        {lang === "hi" ? c.name : c.name_hi}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Top rated */}
        {!loading && top.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-ink-soft flex items-center gap-1.5">
                <TrendingUp size={13} strokeWidth={2.5} />
                {t("top_rated")}
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {top.map((p) => (
                <ProviderCard key={p.id} provider={p} category={categories.find(c => c.id === p.category_id)} />
              ))}
            </div>
          </section>
        )}

        {/* Rest */}
        {!loading && rest.length > 0 && (
          <section>
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-ink-soft mb-3">
              {t("all_providers")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rest.map((p) => (
                <ProviderCard key={p.id} provider={p} category={categories.find(c => c.id === p.category_id)} />
              ))}
            </div>
          </section>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 px-4">
            <p className="text-ink-soft">{t("no_providers_matching")} "{query}"</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export function ProviderCard({ provider, category }) {
  const navigate = useNavigate();
  const style = catStyle(category?.color);

  return (
    <button
      data-testid={`provider-card-${provider.id}`}
      onClick={() => navigate(`/provider/${provider.id}`)}
      className="bg-white border border-cream-300 rounded-2xl p-3 flex gap-3 text-left transition-all duration-200 hover:shadow-[0_8px_24px_rgba(26,26,26,0.06)] hover:-translate-y-0.5 hover:border-forest/20"
    >
      <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-cream-200">
        {provider.image ? (
          <img src={provider.image} alt={provider.business_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-muted">
            <CategoryIcon name={category?.icon} size={24} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="font-heading font-bold text-ink truncate text-[15px]">
              {provider.business_name}
            </p>
          </div>
          {category && (
            <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
              {category.name}
            </span>
          )}
          <div className="flex items-center gap-1 text-[11px] text-ink-soft mt-1.5">
            <MapPin size={11} strokeWidth={2} />
            <span className="truncate">{provider.city || "—"}</span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1">
            <Star size={12} className="fill-amber-400 text-amber-400" strokeWidth={0} />
            <span className="text-xs font-bold text-ink">{provider.rating?.toFixed(1) || "—"}</span>
            <span className="text-[10px] text-ink-muted">({provider.reviews_count || 0})</span>
          </div>
          <div className="text-xs font-bold text-forest">
            ₹{provider.starting_price}
            <span className="text-[10px] font-normal text-ink-muted">/onwards</span>
          </div>
        </div>
      </div>
    </button>
  );
}
