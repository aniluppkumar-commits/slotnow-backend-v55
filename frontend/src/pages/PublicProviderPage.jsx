import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  MapPin,
  Star,
  Phone,
  ArrowRight,
  Sparkles,
  Clock,
  IndianRupee,
  ChevronLeft,
  MessageCircle,
} from "lucide-react";
import { api } from "@/lib/api";

const SITE_URL = "https://slotnow.co.in";

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

function StarRow({ value = 0, size = 14 }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={
            n <= rounded
              ? "text-accent fill-accent"
              : "text-cream-300 fill-cream-300"
          }
        />
      ))}
    </div>
  );
}

export default function PublicProviderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    api
      .get(`/providers/${id}`)
      .then((r) => {
        if (!cancelled) setData(r.data);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.response?.status === 404 ? "not_found" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const provider = data?.provider;
  const services = data?.services || [];
  const reviews = data?.reviews || [];
  const category = data?.category;

  const avgRating = useMemo(() => {
    if (!reviews.length) return provider?.rating || 0;
    const sum = reviews.reduce((a, r) => a + (Number(r.rating) || 0), 0);
    return Number((sum / reviews.length).toFixed(1));
  }, [reviews, provider]);

  const canonical = `${SITE_URL}/p/${id}`;
  const seoTitle = provider
    ? `${provider.business_name} — ${category?.name || "Book"} in ${provider.city || "India"} | SlotNow`
    : "SlotNow — Book appointments in seconds";
  const seoDesc = provider
    ? `Book ${category?.name || "an appointment"} at ${provider.business_name}${provider.city ? ` in ${provider.city}` : ""}. ${provider.bio ? provider.bio.slice(0, 130) : "Real-time slot booking with live queue updates on SlotNow."}`
    : "SlotNow — India's fastest appointment booking platform.";
  const seoImage = provider?.image || `${SITE_URL}/logo.png`;

  useSeoTags({ title: seoTitle, description: seoDesc, image: seoImage, canonical });

  // JSON-LD LocalBusiness / Service schema
  useEffect(() => {
    if (!provider) return;
    const ld = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "@id": canonical,
      name: provider.business_name,
      description: provider.bio || undefined,
      image: provider.image || undefined,
      url: canonical,
      telephone: provider.phone || undefined,
      address: provider.address
        ? {
            "@type": "PostalAddress",
            streetAddress: provider.address,
            addressLocality: provider.city || undefined,
            addressCountry: "IN",
          }
        : undefined,
      aggregateRating:
        reviews.length > 0
          ? {
              "@type": "AggregateRating",
              ratingValue: avgRating,
              reviewCount: reviews.length,
            }
          : undefined,
      priceRange: provider.starting_price ? `₹${provider.starting_price}+` : undefined,
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-provider-ld", id);
    script.text = JSON.stringify(ld);
    document.head.appendChild(script);
    return () => {
      document.head
        .querySelectorAll(`script[data-provider-ld="${id}"]`)
        .forEach((el) => el.remove());
    };
  }, [provider, reviews, avgRating, canonical, id]);

  const bookHref = `/book/${id}`;
  const goBook = () =>
    navigate("/login?role=customer", { state: { from: { pathname: bookHref } } });

  if (error === "not_found") {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white rounded-2xl p-8 border border-cream-300">
          <h1 className="font-heading text-2xl font-black mb-2">Provider not found</h1>
          <p className="text-sm text-ink-muted mb-5">
            The listing you&apos;re looking for doesn&apos;t exist or has been removed.
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
          <Link to="/" data-testid="pp-brand" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="SlotNow" className="h-9 w-9 object-contain" />
            <span className="font-heading font-extrabold text-xl tracking-tight">
              <span className="text-forest">Slot</span>
              <span className="text-accent">Now</span>
            </span>
          </Link>
          <Link
            to="/login?role=customer"
            data-testid="pp-login"
            className="text-sm font-semibold text-forest hover:underline"
          >
            Login
          </Link>
        </div>
      </header>

      {!provider ? (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 text-center text-ink-muted">
          Loading provider…
        </div>
      ) : (
        <>
          {/* Hero */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-6">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-forest mb-4"
            >
              <ChevronLeft size={14} /> Back
            </Link>
            <div className="grid md:grid-cols-5 gap-6">
              <div className="md:col-span-2">
                <div className="relative bg-white rounded-3xl overflow-hidden border border-cream-300 shadow-lg aspect-square">
                  {provider.image ? (
                    <img
                      src={provider.image}
                      alt={provider.business_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-forest/5">
                      <img src="/logo.png" alt="" className="w-32 h-32 opacity-60" />
                    </div>
                  )}
                </div>
              </div>
              <div className="md:col-span-3">
                {category && (
                  <span className="inline-block bg-accent/10 text-accent-dark text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3">
                    {category.name}
                  </span>
                )}
                <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-black leading-tight text-ink mb-2">
                  {provider.business_name}
                </h1>
                {provider.name && (
                  <p className="text-sm text-ink-soft mb-3">by {provider.name}</p>
                )}
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  {(avgRating || provider.rating) ? (
                    <div className="flex items-center gap-2">
                      <StarRow value={avgRating || provider.rating} />
                      <span className="text-sm font-bold">
                        {avgRating || provider.rating}
                      </span>
                      {reviews.length > 0 && (
                        <span className="text-xs text-ink-muted">
                          ({reviews.length} reviews)
                        </span>
                      )}
                    </div>
                  ) : null}
                  {provider.city && (
                    <div className="inline-flex items-center gap-1 text-sm text-ink-soft">
                      <MapPin size={14} className="text-forest" />
                      {provider.city}
                    </div>
                  )}
                  {provider.starting_price != null && (
                    <div className="inline-flex items-center gap-1 text-sm text-ink-soft">
                      <IndianRupee size={14} className="text-forest" />
                      From ₹{provider.starting_price}
                    </div>
                  )}
                </div>
                {provider.bio && (
                  <p className="text-ink-soft leading-relaxed mb-5">{provider.bio}</p>
                )}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={goBook}
                    data-testid="pp-book-cta"
                    className="inline-flex items-center gap-2 bg-forest text-white font-bold px-6 py-3.5 rounded-2xl hover:bg-forest-dark shadow-lg shadow-forest/20"
                  >
                    Book appointment <ArrowRight size={16} />
                  </button>
                  {provider.phone && (
                    <a
                      href={`tel:+91${provider.phone.replace(/[^\d]/g, "").slice(-10)}`}
                      data-testid="pp-call"
                      className="inline-flex items-center gap-2 bg-white text-ink font-bold px-6 py-3.5 rounded-2xl border-2 border-cream-300 hover:border-forest hover:text-forest"
                    >
                      <Phone size={16} /> Call
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Details grid */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid md:grid-cols-3 gap-6">
            {/* Services */}
            <div className="md:col-span-2 space-y-6">
              {services.length > 0 && (
                <div className="bg-white rounded-2xl p-6 border border-cream-300">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles size={16} className="text-accent" />
                    <h2 className="font-heading text-xl font-black">Services</h2>
                  </div>
                  <ul className="divide-y divide-cream-200">
                    {services.map((s) => (
                      <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-ink">{s.name}</p>
                          {s.duration_min && (
                            <p className="text-xs text-ink-muted inline-flex items-center gap-1 mt-0.5">
                              <Clock size={12} />
                              {s.duration_min} min
                            </p>
                          )}
                        </div>
                        {s.price != null && (
                          <p className="font-bold text-ink whitespace-nowrap">
                            ₹{s.price}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Reviews */}
              {reviews.length > 0 && (
                <div className="bg-white rounded-2xl p-6 border border-cream-300">
                  <div className="flex items-center gap-2 mb-4">
                    <Star size={16} className="text-accent fill-accent" />
                    <h2 className="font-heading text-xl font-black">Reviews</h2>
                  </div>
                  <div className="space-y-4">
                    {reviews.slice(0, 6).map((r) => (
                      <div key={r.id} className="border-b border-cream-200 last:border-0 pb-4 last:pb-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-bold text-sm text-ink">
                            {r.customer_name || "Customer"}
                          </p>
                          <StarRow value={r.rating} size={12} />
                        </div>
                        {r.comment && (
                          <p className="text-sm text-ink-soft">{r.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Address / Contact */}
            <aside className="space-y-6">
              {provider.address && (
                <div className="bg-white rounded-2xl p-6 border border-cream-300">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin size={16} className="text-forest" />
                    <h2 className="font-heading text-lg font-black">Location</h2>
                  </div>
                  <p className="text-sm text-ink-soft leading-relaxed">{provider.address}</p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      provider.address + (provider.city ? `, ${provider.city}` : "")
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="pp-map"
                    className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-forest hover:underline"
                  >
                    View on Google Maps <ArrowRight size={14} />
                  </a>
                </div>
              )}

              <div className="bg-gradient-to-br from-forest to-forest-dark text-white rounded-2xl p-6">
                <h3 className="font-heading text-lg font-black mb-1">Ready to book?</h3>
                <p className="text-sm text-white/80 mb-4">
                  Reserve your slot in seconds. Get live queue updates.
                </p>
                <button
                  onClick={goBook}
                  data-testid="pp-sidebar-book"
                  className="w-full inline-flex items-center justify-center gap-2 bg-accent text-white font-bold px-5 py-3 rounded-xl hover:bg-accent-dark transition-colors"
                >
                  Book on SlotNow <ArrowRight size={16} />
                </button>
              </div>
            </aside>
          </section>

          {/* Footer strip */}
          <footer className="bg-ink text-white/70 mt-8">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="" className="h-7 w-7 bg-white rounded-md p-0.5" />
                <span className="font-heading font-bold text-white">SlotNow</span>
                <span className="text-white/50">· Book appointments in seconds</span>
              </div>
              <div className="flex items-center gap-4">
                <a
                  href="https://wa.me/919412575970"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-white"
                >
                  <MessageCircle size={14} className="text-accent" /> WhatsApp
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
