import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MapPin, Star, ArrowRight, ChevronLeft } from "lucide-react";
import { api } from "@/lib/api";
import WhatsAppIcon from "@/components/WhatsAppIcon";

const SITE_URL = "https://slotnow.co.in";

function useSeoTags({ title, description, canonical }) {
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
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
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
  }, [title, description, canonical]);
}

export default function CityPublicPage() {
  const { cityName } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    api
      .get(`/city/${cityName}`)
      .then((r) => !cancelled && setData(r.data))
      .catch((e) =>
        !cancelled && setError(e?.response?.status === 404 ? "not_found" : "error")
      );
    return () => {
      cancelled = true;
    };
  }, [cityName]);

  const cityDisplay = data?.city || (cityName || "").replace(/-/g, " ");
  const canonical = `${SITE_URL}/city/${cityName}`;
  const seoTitle = data
    ? `${cityDisplay} — Doctors, Salons, Garages & more on SlotNow`
    : "SlotNow — Book appointments in seconds";
  const seoDesc = data
    ? `Book appointments with ${data.total} verified service providers in ${cityDisplay}. Doctors, hospitals, salons, garages, tutors — all on SlotNow.`
    : "SlotNow — India's fastest appointment booking platform.";

  useSeoTags({ title: seoTitle, description: seoDesc, canonical });

  useEffect(() => {
    if (!data) return;
    const ld = {
      "@context": "https://schema.org",
      "@type": "Place",
      "@id": canonical,
      name: cityDisplay,
      description: seoDesc,
    };
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.setAttribute("data-city-ld", cityName);
    s.text = JSON.stringify(ld);
    document.head.appendChild(s);
    return () => {
      document.head
        .querySelectorAll(`script[data-city-ld="${cityName}"]`)
        .forEach((el) => el.remove());
    };
  }, [data, cityDisplay, canonical, cityName, seoDesc]);

  if (error === "not_found") {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white rounded-2xl p-8 border border-cream-300">
          <h1 className="font-heading text-2xl font-black mb-2">City not found</h1>
          <p className="text-sm text-ink-muted mb-5">
            We don&apos;t have providers in this city yet.
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
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-cream/90 border-b border-cream-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="SlotNow" className="h-12 w-12 object-contain" />
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

      {!data ? (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 text-center text-ink-muted">
          Loading…
        </div>
      ) : (
        <>
          <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-6">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-forest mb-3"
            >
              <ChevronLeft size={14} /> Home
            </Link>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-forest text-white flex items-center justify-center shadow-lg">
                <MapPin size={22} />
              </div>
              <div>
                <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-black leading-tight text-ink">
                  Services in {cityDisplay}
                </h1>
                <p className="text-ink-soft">
                  {data.total} verified providers across {data.groups.length} categories
                </p>
              </div>
            </div>
          </section>

          {data.groups.map(({ category, providers, total }) => (
            <section
              key={category.id}
              className="max-w-6xl mx-auto px-4 sm:px-6 pb-10"
              data-testid={`city-group-${category.id}`}
            >
              <div className="flex items-end justify-between gap-4 mb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-accent mb-1">
                    {total} available
                  </p>
                  <h2 className="font-heading text-2xl sm:text-3xl font-black text-ink">
                    {category.name}
                  </h2>
                </div>
                <Link
                  to={`/c/${category.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${cityName}`}
                  className="text-sm font-semibold text-forest hover:underline shrink-0"
                >
                  View all →
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {providers.map((p) => (
                  <Link
                    key={p.id}
                    to={`/p/${p.id}`}
                    className="bg-white rounded-2xl overflow-hidden border border-cream-300 hover:shadow-lg hover:-translate-y-0.5 transition-all"
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
                      {p.specialization && (
                        <p className="text-xs text-forest font-semibold mb-1">
                          {p.specialization}
                        </p>
                      )}
                      {p.starting_price != null && (
                        <p className="text-sm text-ink-soft">
                          From <span className="font-bold text-ink">₹{p.starting_price}</span>
                        </p>
                      )}
                      <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-forest">
                        View <ArrowRight size={11} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}

          <footer className="bg-ink text-white/70 mt-4">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="" className="h-7 w-7 bg-white rounded-md p-0.5" />
                <span className="font-heading font-bold text-white">SlotNow</span>
              </div>
              <a
                href="/api/whatsapp"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-white"
                aria-label="Chat with SlotNow on WhatsApp"
              >
                <WhatsAppIcon size={14} className="text-accent" /> WhatsApp
              </a>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
