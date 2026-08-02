import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n";
import AppShell from "@/components/AppShell";
import CategoryIcon from "@/components/CategoryIcon";
import { catStyle } from "@/lib/utils-app";
import { Search, Star, MapPin, Bell, TrendingUp, Loader2, Locate, X, Timer, Sparkles, ChevronDown, Filter } from "lucide-react";
import { toast } from "sonner";

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [categories, setCategories] = useState([]);
  const [providers, setProviders] = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  // Category-aware secondary filter (from /reference/filters)
  const [filterSpec, setFilterSpec] = useState({ options: [], param: "service", label: "Filter" });
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [secondaryValue, setSecondaryValue] = useState("");
  // City filter
  const [cityQuery, setCityQuery] = useState("");
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [showCityBox, setShowCityBox] = useState(false);
  const [geo, setGeo] = useState(null); // { lat, lng }
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [waitStats, setWaitStats] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [catRes, provRes, notifRes, wtRes] = await Promise.all([
          api.get("/categories"),
          api.get("/providers"),
          api.get("/notifications").catch(() => ({ data: [] })),
          api.get("/customers/me/wait-history").catch(() => ({ data: null })),
        ]);
        if (!mounted) return;
        setCategories(catRes.data || []);
        setProviders(provRes.data || []);
        setNotifCount((notifRes.data || []).filter((n) => !n.read).length);
        setWaitStats(wtRes.data);
      } catch (err) {
        console.error("Home data load failed:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  // Whenever the customer picks (or clears) a category, refresh the secondary
  // filter definition so the UI stays category-aware.
  useEffect(() => {
    let alive = true;
    setSecondaryValue("");
    api
      .get(`/reference/filters${selectedCategoryId ? `?category_id=${selectedCategoryId}` : ""}`)
      .then((r) => alive && setFilterSpec(r.data || { options: [], param: "service", label: "Filter" }))
      .catch(() => alive && setFilterSpec({ options: [], param: "service", label: "Filter" }));
    return () => (alive = false);
  }, [selectedCategoryId]);

  // City suggestions typeahead (debounced against /reference/cities)
  useEffect(() => {
    let alive = true;
    const handle = setTimeout(() => {
      api
        .get(`/reference/cities${cityQuery ? `?q=${encodeURIComponent(cityQuery)}` : ""}`)
        .then((r) => alive && setCitySuggestions(r.data?.cities || []))
        .catch(() => alive && setCitySuggestions([]));
    }, 180);
    return () => { alive = false; clearTimeout(handle); };
  }, [cityQuery]);

  // Server-side search fired on every meaningful filter change (debounced 300ms
  // so keystrokes don't hammer the API).
  useEffect(() => {
    const hasAnyFilter = query.trim() || secondaryValue || cityQuery || geo || selectedCategoryId;
    if (!hasAnyFilter) return;
    const handle = setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (cityQuery) params.set("city", cityQuery);
      if (selectedCategoryId) params.set("category_id", selectedCategoryId);
      if (secondaryValue) params.set(filterSpec.param || "service", secondaryValue);
      if (geo) {
        params.set("lat", String(geo.lat));
        params.set("lng", String(geo.lng));
      }
      params.set("limit", "60");
      setSearching(true);
      api
        .get(`/search/providers?${params.toString()}`)
        .then((r) => setProviders(r.data || []))
        .catch(() => setProviders([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, cityQuery, selectedCategoryId, secondaryValue, geo, filterSpec.param]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("Location not supported");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast.success("Showing providers nearby you");
      },
      () => { setLocating(false); toast.error("Could not access location"); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const clearFilters = () => {
    setQuery("");
    setSelectedCategoryId("");
    setSecondaryValue("");
    setCityQuery("");
    setGeo(null);
    // Reload the default provider list
    api.get("/providers").then((r) => setProviders(r.data || [])).catch(() => {});
  };

  const anyFilterActive = query.trim() || selectedCategoryId || secondaryValue || cityQuery || geo;

  // Server-side search already applies query/city/category/spec filters. When no filter
  // is active we still show the full unfiltered /providers list.
  const filtered = providers;

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

        {/* Global search bar */}
        <div className="relative mb-3">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            data-testid="home-search-input"
            type="text"
            placeholder="Search provider, doctor, clinic or service…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white border border-cream-300 rounded-2xl pl-11 pr-10 py-3.5 text-sm text-ink placeholder:text-ink-muted focus:ring-2 focus:ring-forest/15 focus:border-forest outline-none transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
              aria-label="Clear search"
              data-testid="home-search-clear"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filters row: Nearby + City + Category-aware secondary */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            data-testid="home-nearby-btn"
            onClick={useMyLocation}
            disabled={locating}
            className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full transition-all disabled:opacity-60 ${
              geo ? "bg-forest text-cream-100" : "bg-white text-ink border border-cream-300 hover:border-forest"
            }`}
          >
            {locating ? <Loader2 size={13} className="animate-spin" /> : <Locate size={13} />}
            {geo ? "Nearby (active)" : "Find nearby"}
          </button>

          {/* City typeahead */}
          <div className="relative">
            <div className={`inline-flex items-center gap-1 rounded-full border ${
              cityQuery ? "bg-forest text-cream-100 border-forest" : "bg-white border-cream-300 text-ink"
            }`}>
              <MapPin size={13} className="ml-3" />
              <input
                data-testid="home-city-input"
                type="text"
                value={cityQuery}
                onFocus={() => setShowCityBox(true)}
                onBlur={() => setTimeout(() => setShowCityBox(false), 180)}
                onChange={(e) => { setCityQuery(e.target.value); setShowCityBox(true); }}
                placeholder="Any city"
                className={`w-24 sm:w-28 bg-transparent py-2 pr-2 text-xs font-bold placeholder:opacity-60 outline-none ${
                  cityQuery ? "text-cream-100 placeholder:text-cream-100" : "text-ink"
                }`}
              />
              {cityQuery && (
                <button
                  onClick={() => { setCityQuery(""); setShowCityBox(false); }}
                  className="pr-2"
                  aria-label="Clear city"
                  data-testid="home-city-clear"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {showCityBox && citySuggestions.length > 0 && (
              <div className="absolute left-0 top-full mt-1 z-10 bg-white border border-cream-300 rounded-xl shadow-lg py-1 min-w-[160px]" data-testid="home-city-suggestions">
                {citySuggestions.map((c) => (
                  <button
                    key={c}
                    data-testid={`home-city-opt-${c}`}
                    onMouseDown={() => { setCityQuery(c); setShowCityBox(false); }}
                    className="w-full text-left px-3 py-1.5 text-sm text-ink hover:bg-cream-100"
                  >
                    <MapPin size={12} className="inline mr-1.5 text-forest" /> {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Category dropdown */}
          <div className="relative inline-flex">
            <select
              data-testid="home-category-filter"
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className={`appearance-none pl-3 pr-8 py-2 rounded-full text-xs font-bold border ${
                selectedCategoryId ? "bg-forest text-cream-100 border-forest" : "bg-white text-ink border-cream-300 hover:border-forest"
              } focus:outline-none`}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown size={11} className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 ${selectedCategoryId ? "text-cream-100" : "text-ink-muted"}`} />
          </div>

          {/* Category-aware secondary filter — only when the picked category has options */}
          {filterSpec.options?.length > 0 && (
            <div className="relative inline-flex">
              <select
                data-testid="home-secondary-filter"
                value={secondaryValue}
                onChange={(e) => setSecondaryValue(e.target.value)}
                className={`appearance-none pl-3 pr-8 py-2 rounded-full text-xs font-bold border max-w-[180px] truncate ${
                  secondaryValue ? "bg-forest text-cream-100 border-forest" : "bg-white text-ink border-cream-300 hover:border-forest"
                } focus:outline-none`}
              >
                <option value="">{filterSpec.label}</option>
                {filterSpec.options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <Filter size={11} className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 ${secondaryValue ? "text-cream-100" : "text-ink-muted"}`} />
            </div>
          )}

          {anyFilterActive && (
            <button
              data-testid="home-filters-clear"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-500 hover:underline"
            >
              <X size={12} /> Clear all
            </button>
          )}
          {searching && <Loader2 size={13} className="animate-spin text-forest" />}
        </div>

        {/* Wait-time history widget — only for customers with ≥1 completed booking */}
        {waitStats && waitStats.avg_wait_min != null && (
          <button
            data-testid="home-wait-history-widget"
            onClick={() => navigate("/bookings?tab=completed")}
            className="w-full text-left mb-6 bg-gradient-to-br from-forest to-forest-dark text-white rounded-2xl p-4 shadow-md flex items-center gap-3 hover:shadow-lg transition-shadow"
          >
            <div className="bg-white/15 rounded-xl p-2.5 shrink-0">
              <Timer size={20} className="text-cream-100" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span data-testid="wait-avg-min" className="text-2xl font-heading font-black text-cream-100">
                  {waitStats.avg_wait_min}
                </span>
                <span className="text-xs text-cream-200 font-bold">min avg wait</span>
                <span className="ml-auto text-[10px] text-cream-200/70">Last {waitStats.counted_for_avg} visits</span>
              </div>
              {waitStats.hint ? (
                <p data-testid="wait-hint" className="text-[11px] text-cream-100/90 mt-0.5 flex items-start gap-1">
                  <Sparkles size={11} className="mt-0.5 shrink-0" />
                  <span className="truncate">{waitStats.hint}</span>
                </p>
              ) : (
                <p className="text-[11px] text-cream-100/80 mt-0.5">Tap to see your booking history & avoid peak hours</p>
              )}
            </div>
          </button>
        )}

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

        {!loading && !searching && filtered.length === 0 && (
          <div className="text-center py-16 px-4" data-testid="home-empty-state">
            <p className="text-ink-soft">
              {anyFilterActive
                ? "No providers match your filters. Try clearing some."
                : t("no_providers_matching")}
            </p>
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
