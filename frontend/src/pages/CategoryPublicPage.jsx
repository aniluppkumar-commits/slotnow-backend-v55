import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  MapPin,
  Star,
  Search,
  ArrowRight,
  ChevronLeft,
} from "lucide-react";
import { api } from "@/lib/api";
import WhatsAppIcon from "@/components/WhatsAppIcon";

const SITE_URL = "https://slotnow.co.in";

function citySlug(name) {
  return (name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCase(s) {
  return (s || "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function useSeoTags({ title, description, image, canonical }) {
  useEffect(() => {
    if (!title) return;
    const prev = document.title;
    document.title = title;

    const setMeta = (attr, name, content) => {
      if (!content) return;
      let el = document.head.querySelector(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:image", image);
    setMeta("property", "og:url", canonical);
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", image);

    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    if (canonical) link.setAttribute("href", canonical);
    return () => {
      document.title = prev;
    };
  }, [title, description, image, canonical]);
}

export default function CategoryPublicPage() {
  const { slug, city: cityParam } = useParams();
  const navigate = useNavigate();
  const cityDisplay = cityParam ? titleCase(cityParam) : "";
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    const params = cityDisplay ? `?city=${encodeURIComponent(cityDisplay)}` : "";
    api
      .get(`/categories/by-slug/${slug}${params}`)
      .then((r) => {
        if (!cancelled) setData(r.data);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.response?.status === 404 ? "not_found" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [slug, cityDisplay]);

  const category = data?.category;
  const providers = data?.providers || [];
  const cities = data?.cities || [];

  const filtered = useMemo(() => {
    if (!query.trim()) return providers;
    const q = query.trim().toLowerCase();
    return providers.filter(
      (p) =>
        p.business_name?.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.bio?.toLowerCase().includes(q)
    );
  }, [providers, query]);

  const canonical = cityDisplay
    ? `${SITE_URL}/c/${slug}/${citySlug(cityDisplay)}`
    : `${SITE_URL}/c/${slug}`;
  const seoTitle = category
    ? `${category.name}${cityDisplay ? ` in ${cityDisplay}` : ""} — Book appointments online | SlotNow`
    : "SlotNow — Book appointments in seconds";
  const seoDesc = category
    ? `Book ${category.name.toLowerCase()} appointments${cityDisplay ? ` in ${cityDisplay}` : " across India"} with verified providers on SlotNow. Real-time slots, live queue updates and zero waiting.`
    : "SlotNow — India's fastest appointment booking platform.";
  const seoImage = `${SITE_URL}/logo.png`;

  useSeoTags({ title: seoTitle, description: seoDesc, image: seoImage, canonical });

  // JSON-LD ItemList of providers
  useEffect(() => {
    if (!category) return;
    const ld = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": canonical,
      name: seoTitle,
      description: seoDesc,
      about: {
        "@type": "Service",
        name: category.name,
      },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: providers.length,
        itemListElement: providers.slice(0, 20).map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${SITE_URL}/p/${p.id}`,
          name: p.business_name,
        })),
      },
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-category-ld", slug);
    script.text = JSON.stringify(ld);
    document.head.appendChild(script);
    return () => {
      document.head
        .querySelectorAll(`script[data-category-ld="${slug}"]`)
        .forEach((el) => el.remove());
    };
  }, [category, providers, canonical, seoTitle, seoDesc, slug]);

  if (error === "not_found") {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white rounded-2xl p-8 border border-cream-300">
          <h1 className="font-heading text-2xl font-black mb-2">Category not found</h1>
          <p className="text-sm text-ink-muted mb-5">
            The category you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-forest text-white font-bold px-5 py-2.5 rounded-xl hover:bg-forest-dark"
          >
            <ChevronLeft size={16} /> Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream text-ink">
      {/* Top nav */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-cream/90 border-b border-cream-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to="/" data-testid="cat-brand" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="SlotNow" className="h-9 w-9 object-contain" />
            <span className="font-heading font-extrabold text-xl tracking-tight">
              <span className="text-forest">Slot</span>
              <span className="text-accent">Now</span>
            </span>
          </Link>
          <Link
            to="/login?role=customer"
            data-testid="cat-login"
            className="text-sm font-semibold text-forest hover:underline"
          >
            Login
          </Link>
        </div>
      </header>

      {!category ? (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 text-center text-ink-muted">
          Loading category…
        </div>
      ) : (
        <>
          {/* Hero */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-8">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-forest mb-4"
            >
              <ChevronLeft size={14} /> Home
            </Link>
            <div className="flex items-start gap-4 flex-wrap">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-heading font-black text-2xl shadow-lg"
                style={{ background: category.color || "#1E3A8A" }}
              >
                {category.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-[240px]">
                <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-black leading-tight text-ink">
                  Book {category.name}
                  {cityDisplay ? ` in ${cityDisplay}` : ""}
                </h1>
                <p className="mt-2 text-ink-soft">
                  {providers.length} verified provider{providers.length === 1 ? "" : "s"}
                  {cityDisplay ? ` in ${cityDisplay}` : " across India"} — real-time slots,
                  live queue updates, zero waiting.
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                />
                <input
                  data-testid="cat-search-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${category.name.toLowerCase()}…`}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-cream-300 focus:border-forest focus:outline-none text-sm"
                />
              </div>
              {cityDisplay && (
                <button
                  onClick={() => navigate(`/c/${slug}`)}
                  data-testid="cat-clear-city"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-forest hover:underline"
                >
                  Clear city filter
                </button>
              )}
            </div>

            {/* City chips */}
            {cities.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {cities.map((c) => {
                  const active = citySlug(c.name) === (cityParam || "");
                  return (
                    <button
                      key={c.name}
                      onClick={() =>
                        navigate(active ? `/c/${slug}` : `/c/${slug}/${citySlug(c.name)}`)
                      }
                      data-testid={`cat-city-${c.name}`}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        active
                          ? "bg-forest text-white border-forest"
                          : "bg-white text-ink border-cream-300 hover:border-forest"
                      }`}
                    >
                      <MapPin size={12} />
                      {c.name}
                      <span className="opacity-70">({c.count})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Providers grid */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-14">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-ink-muted">
                <Search size={32} className="mx-auto mb-2 opacity-40" />
                No providers match your search.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map((p) => (
                  <Link
                    key={p.id}
                    to={`/p/${p.id}`}
                    data-testid={`cat-provider-${p.id}`}
                    className="bg-white rounded-2xl overflow-hidden border border-cream-300 hover:shadow-xl hover:-translate-y-1 transition-all"
                  >
                    {p.image && (
                      <div className="h-40 w-full bg-cream-200 overflow-hidden">
                        <img
                          src={p.image}
                          alt={p.business_name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold text-ink truncate">{p.business_name}</h3>
                        {p.rating != null && (
                          <div className="flex items-center gap-1 shrink-0 text-sm">
                            <Star size={14} className="text-accent fill-accent" />
                            <span className="font-semibold">{p.rating}</span>
                          </div>
                        )}
                      </div>
                      {p.city && (
                        <div className="flex items-center gap-1 text-xs text-ink-muted">
                          <MapPin size={12} />
                          {p.city}
                        </div>
                      )}
                      {p.starting_price != null && (
                        <p className="mt-3 text-sm text-ink-soft">
                          From <span className="font-bold text-ink">₹{p.starting_price}</span>
                        </p>
                      )}
                      <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-forest">
                        View details <ArrowRight size={12} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Footer strip */}
          <footer className="bg-ink text-white/70 mt-4">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="" className="h-7 w-7 bg-white rounded-md p-0.5" />
                <span className="font-heading font-bold text-white">SlotNow</span>
                <span className="text-white/50">· Book appointments in seconds</span>
              </div>
              <div className="flex items-center gap-4">
                <a
                  href="/api/whatsapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-white"
                  aria-label="Chat with SlotNow on WhatsApp"
                >
                  <WhatsAppIcon size={14} className="text-accent" /> WhatsApp
                </a>
                <Link to="/" className="hover:text-white">
                  Home
                </Link>
              </div>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
