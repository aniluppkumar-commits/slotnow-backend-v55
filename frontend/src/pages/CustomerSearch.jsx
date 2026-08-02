import React, { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MapPin, Star, Search, ArrowRight, Locate, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

/**
 * Public customer search — filters by city, specialization, service and can
 * sort by nearby (geolocation + backend Haversine). No auth required.
 */
export default function CustomerSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reference, setReference] = useState(null);
  const [cities, setCities] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  // Filters (driven by URL search params for shareability)
  const q = searchParams.get("q") || "";
  const city = searchParams.get("city") || "";
  const specialization = searchParams.get("specialization") || "";
  const service = searchParams.get("service") || "";
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  // Load reference lists + city aggregations for dropdowns
  useEffect(() => {
    api.get("/reference/healthcare").then((r) => setReference(r.data)).catch(() => {});
    // Derive cities from provider list (light-weight — top 50 approved)
    api
      .get("/search/providers?limit=500")
      .then((r) => {
        const set = new Set();
        (r.data || []).forEach((p) => p.city && set.add(p.city));
        setCities(Array.from(set).sort());
      })
      .catch(() => {});
  }, []);

  // Run search whenever filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (city) params.set("city", city);
    if (specialization) params.set("specialization", specialization);
    if (service) params.set("service", service);
    if (lat && lng) {
      params.set("lat", lat);
      params.set("lng", lng);
    }
    params.set("limit", "60");
    setLoading(true);
    api
      .get(`/search/providers?${params.toString()}`)
      .then((r) => setProviders(r.data || []))
      .catch(() => setProviders([]))
      .finally(() => setLoading(false));
  }, [q, city, specialization, service, lat, lng]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location not supported on this browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = new URLSearchParams(searchParams);
        next.set("lat", String(pos.coords.latitude));
        next.set("lng", String(pos.coords.longitude));
        setSearchParams(next);
        setLocating(false);
      },
      () => {
        toast.error("Could not get your location");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const clearAll = () => setSearchParams({});

  const hasNearby = !!(lat && lng);
  const activeFilters = useMemo(
    () => [q, city, specialization, service, hasNearby ? "nearby" : ""].filter(Boolean).length,
    [q, city, specialization, service, hasNearby]
  );

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-cream/90 border-b border-cream-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="SlotNow" className="h-9 w-9 object-contain" />
            <span className="font-heading font-extrabold text-xl tracking-tight">
              <span className="text-forest">Slot</span>
              <span className="text-accent">Now</span>
            </span>
          </Link>
          <Link
            to="/login?role=customer"
            className="text-sm font-semibold text-forest hover:underline"
          >
            Login
          </Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-forest mb-3"
        >
          <ChevronLeft size={14} /> Home
        </Link>
        <h1 className="font-heading text-3xl sm:text-4xl font-black text-ink mb-1">
          Find a provider
        </h1>
        <p className="text-ink-soft">
          Search by city, specialist doctor, service or use your location.
        </p>

        {/* Filter grid */}
        <div className="mt-6 bg-white rounded-2xl border border-cream-300 p-4 sm:p-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">
                Keyword
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  data-testid="search-q"
                  value={q}
                  onChange={(e) => updateParam("q", e.target.value)}
                  placeholder="Doctor name, clinic…"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-cream border border-cream-300 focus:border-forest focus:outline-none text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">
                City
              </label>
              <select
                data-testid="search-city"
                value={city}
                onChange={(e) => updateParam("city", e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-cream border border-cream-300 focus:border-forest focus:outline-none text-sm"
              >
                <option value="">All cities</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">
                Specialist doctor
              </label>
              <select
                data-testid="search-specialization"
                value={specialization}
                onChange={(e) => updateParam("specialization", e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-cream border border-cream-300 focus:border-forest focus:outline-none text-sm"
              >
                <option value="">Any specialist</option>
                {(reference?.specializations || []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">
                Service
              </label>
              <select
                data-testid="search-service"
                value={service}
                onChange={(e) => updateParam("service", e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-cream border border-cream-300 focus:border-forest focus:outline-none text-sm"
              >
                <option value="">Any service</option>
                {(reference?.services || []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <button
              onClick={useMyLocation}
              data-testid="search-nearby-btn"
              disabled={locating}
              className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-full transition-all ${
                hasNearby
                  ? "bg-forest text-white"
                  : "bg-white text-ink border border-cream-300 hover:border-forest"
              }`}
            >
              {locating ? <Loader2 size={13} className="animate-spin" /> : <Locate size={13} />}
              {hasNearby ? "Nearby (using your location)" : "Find nearby"}
            </button>
            {activeFilters > 0 && (
              <button
                onClick={clearAll}
                data-testid="search-clear"
                className="text-xs font-semibold text-forest hover:underline"
              >
                Clear all ({activeFilters})
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-14">
        {loading ? (
          <div className="text-center py-14 text-ink-muted">
            <Loader2 size={26} className="mx-auto animate-spin mb-2" />
            Searching…
          </div>
        ) : providers.length === 0 ? (
          <div className="text-center py-14 text-ink-muted">
            <Search size={32} className="mx-auto mb-2 opacity-40" />
            No providers match your search. Try widening the filters.
          </div>
        ) : (
          <>
            <p className="text-sm text-ink-muted mb-4">
              {providers.length} provider{providers.length === 1 ? "" : "s"} found
              {hasNearby ? " · sorted by distance" : " · sorted by rating"}
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {providers.map((p) => (
                <Link
                  key={p.id}
                  to={`/p/${p.id}`}
                  data-testid={`search-result-${p.id}`}
                  className="bg-white rounded-2xl overflow-hidden border border-cream-300 hover:shadow-xl hover:-translate-y-0.5 transition-all"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-bold text-ink truncate">{p.business_name}</h3>
                      {p.rating != null && (
                        <div className="flex items-center gap-1 shrink-0 text-sm">
                          <Star size={13} className="text-accent fill-accent" />
                          <span className="font-semibold">{p.rating}</span>
                        </div>
                      )}
                    </div>
                    {p.is_featured && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-accent-dark bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded-full mb-1">
                        ★ Featured
                      </span>
                    )}
                    {p.specialization && (
                      <p className="text-xs text-forest font-semibold mb-1">
                        {p.specialization}
                      </p>
                    )}
                    {p.city && (
                      <div className="flex items-center gap-1 text-xs text-ink-muted">
                        <MapPin size={11} />
                        {p.city}
                        {p.distance_km != null && (
                          <span className="ml-1 font-semibold text-forest">
                            · {p.distance_km} km
                          </span>
                        )}
                      </div>
                    )}
                    {Array.isArray(p.service_tags) && p.service_tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {p.service_tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cream text-ink-soft"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-forest">
                      View <ArrowRight size={11} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
