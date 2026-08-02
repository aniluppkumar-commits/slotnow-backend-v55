import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  MapPin,
  Star,
  ArrowRight,
  Sparkles,
  Clock,
  IndianRupee,
  ChevronLeft,
  MessageSquare,
  X,
  ImagePlus,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { compressImageToDataURL } from "@/lib/image";

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
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState([]); // array of data URLs
  const [submitting, setSubmitting] = useState(false);
  const [reviewsRefresh, setReviewsRefresh] = useState(0);
  const [staff, setStaff] = useState([]);

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
  }, [id, reviewsRefresh]);

  // Hospital-type providers: fetch child staff (doctors + service centers)
  useEffect(() => {
    if (!provider || provider.provider_type !== "hospital") {
      setStaff([]);
      return;
    }
    let cancelled = false;
    api
      .get(`/providers/${id}/staff`)
      .then((r) => !cancelled && setStaff(Array.isArray(r.data) ? r.data : []))
      .catch(() => !cancelled && setStaff([]));
    return () => {
      cancelled = true;
    };
  }, [id, provider]);

  // Check review eligibility only when a customer is logged in
  useEffect(() => {
    if (!user || user.role !== "customer") {
      setEligibility(null);
      return;
    }
    let cancelled = false;
    api
      .get(`/providers/${id}/reviewable-booking`)
      .then((r) => {
        if (!cancelled) setEligibility(r.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, user, reviewsRefresh]);

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

  const onReviewClick = () => {
    if (!user) {
      toast.message("Please log in as customer to leave a review");
      navigate("/login?role=customer", { state: { from: { pathname: `/p/${id}` } } });
      return;
    }
    if (user.role !== "customer") {
      toast.error("Only customers can leave reviews");
      return;
    }
    if (!eligibility?.eligible) {
      if (eligibility?.reason === "already_reviewed") {
        toast.message("You have already reviewed this provider.");
      } else {
        toast.message("Complete a booking with this provider to leave a review.");
      }
      return;
    }
    setReviewOpen(true);
  };

  const submitReview = async () => {
    if (rating < 1) {
      toast.error("Please select a rating");
      return;
    }
    if (!eligibility?.booking_id) return;
    setSubmitting(true);
    try {
      await api.post("/reviews", {
        booking_id: eligibility.booking_id,
        rating,
        comment: comment.trim(),
        photos,
      });
      toast.success("Thanks for your review!");
      setReviewOpen(false);
      setRating(0);
      setComment("");
      setPhotos([]);
      setReviewsRefresh((v) => v + 1);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not submit review");
    } finally {
      setSubmitting(false);
    }
  };

  const onAddPhoto = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const room = Math.max(0, 3 - photos.length);
    if (room === 0) {
      toast.error("You can attach up to 3 photos");
      return;
    }
    try {
      const compressed = await Promise.all(
        files.slice(0, room).map((f) => compressImageToDataURL(f, { maxDim: 800, quality: 0.72 }))
      );
      setPhotos((prev) => [...prev, ...compressed]);
    } catch (err) {
      toast.error(err?.message || "Could not add photo");
    }
  };

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
                </div>
              </div>
            </div>
          </section>

          {/* Details grid */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid md:grid-cols-3 gap-6">
            {/* Services */}
            <div className="md:col-span-2 space-y-6">
              {/* Hospital: doctors and service centers */}
              {provider.provider_type === "hospital" && staff.length > 0 && (
                <>
                  {staff.filter((s) => s.kind === "doctor").length > 0 && (
                    <div className="bg-white rounded-2xl p-6 border border-cream-300" data-testid="pp-doctors">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles size={16} className="text-forest" />
                        <h2 className="font-heading text-xl font-black">Our doctors</h2>
                        <span className="text-xs text-ink-muted">
                          ({staff.filter((s) => s.kind === "doctor").length})
                        </span>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {staff.filter((s) => s.kind === "doctor").map((d) => (
                          <button
                            key={d.id}
                            onClick={() =>
                              navigate("/login?role=customer", {
                                state: { from: { pathname: `/book/${id}?staff=${d.id}` } },
                              })
                            }
                            data-testid={`pp-doctor-${d.id}`}
                            className="text-left flex gap-3 p-3 rounded-xl border border-cream-300 hover:border-forest hover:shadow-md transition-all"
                          >
                            {d.photo ? (
                              <img src={d.photo} alt="" className="w-12 h-12 rounded-lg object-cover" />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-forest/10 text-forest flex items-center justify-center font-heading font-black">
                                {d.name?.[0] || "D"}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-ink truncate">{d.name}</p>
                              {d.specialization && (
                                <p className="text-xs text-forest font-semibold">{d.specialization}</p>
                              )}
                              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
                                Book <ArrowRight size={10} />
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {staff.filter((s) => s.kind === "service").length > 0 && (
                    <div className="bg-white rounded-2xl p-6 border border-cream-300" data-testid="pp-service-centers">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles size={16} className="text-accent" />
                        <h2 className="font-heading text-xl font-black">Diagnostic services</h2>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {staff.filter((s) => s.kind === "service").map((c) => (
                          <button
                            key={c.id}
                            onClick={() =>
                              navigate("/login?role=customer", {
                                state: { from: { pathname: `/book/${id}?staff=${c.id}` } },
                              })
                            }
                            data-testid={`pp-service-${c.id}`}
                            className="text-left p-4 rounded-xl border border-cream-300 hover:border-forest hover:shadow-md transition-all"
                          >
                            <p className="font-bold text-ink truncate">{c.name}</p>
                            {c.service_tags?.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {c.service_tags.slice(0, 4).map((t) => (
                                  <span
                                    key={t}
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cream text-ink-soft"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                            {c.address && (
                              <p className="text-[11px] text-ink-muted mt-1 truncate">{c.address}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

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
              <div className="bg-white rounded-2xl p-6 border border-cream-300">
                <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Star size={16} className="text-accent fill-accent" />
                    <h2 className="font-heading text-xl font-black">Reviews</h2>
                    {reviews.length > 0 && (
                      <span className="text-xs text-ink-muted">({reviews.length})</span>
                    )}
                  </div>
                  <button
                    onClick={onReviewClick}
                    data-testid="pp-leave-review"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl bg-accent/10 text-accent-dark hover:bg-accent/20 border border-accent/20 transition-colors"
                  >
                    <MessageSquare size={14} /> Leave a review
                  </button>
                </div>
                {reviews.length === 0 ? (
                  <p className="text-sm text-ink-muted">
                    No reviews yet. Be the first to share your experience after booking.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {reviews.slice(0, 6).map((r) => (
                      <div key={r.id} className="border-b border-cream-200 last:border-0 pb-4 last:pb-0">
                        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-sm text-ink">
                              {r.customer_name || "Customer"}
                            </p>
                            <span
                              title="This customer completed a booking with this provider"
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
                            >
                              <ShieldCheck size={10} strokeWidth={2.5} />
                              Verified booking
                            </span>
                          </div>
                          <StarRow value={r.rating} size={12} />
                        </div>
                        {r.comment && (
                          <p className="text-sm text-ink-soft">{r.comment}</p>
                        )}
                        {Array.isArray(r.photos) && r.photos.length > 0 && (
                          <div className="flex gap-2 mt-2 flex-wrap">
                            {r.photos.map((src, i) => (
                              <a
                                key={i}
                                href={src}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-16 h-16 rounded-lg overflow-hidden border border-cream-300 hover:border-forest"
                              >
                                <img
                                  src={src}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

      {/* Leave a review modal */}
      {reviewOpen && (
        <div
          data-testid="review-modal"
          className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !submitting && setReviewOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-heading text-xl font-black text-ink">Leave a review</h3>
                <p className="text-sm text-ink-muted mt-0.5">
                  Sharing helps other customers choose confidently.
                </p>
              </div>
              <button
                onClick={() => !submitting && setReviewOpen(false)}
                className="text-ink-muted hover:text-ink"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider mb-2">
                Your rating
              </label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    data-testid={`review-star-${n}`}
                    className="p-1 rounded hover:bg-cream-100"
                  >
                    <Star
                      size={30}
                      className={
                        n <= rating
                          ? "text-accent fill-accent"
                          : "text-cream-300 fill-cream-300"
                      }
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-5">
              <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider mb-2">
                Comment (optional)
              </label>
              <textarea
                data-testid="review-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 500))}
                rows={4}
                placeholder="Tell us about your experience…"
                className="w-full px-3 py-2.5 rounded-xl bg-cream border border-cream-300 focus:border-forest focus:outline-none text-sm resize-none"
              />
              <p className="text-[11px] text-ink-muted mt-1">{comment.length}/500</p>
            </div>
            <div className="mb-5">
              <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider mb-2">
                Photos (optional, up to 3)
              </label>
              <div className="flex flex-wrap gap-2">
                {photos.map((src, i) => (
                  <div key={i} className="relative w-20 h-20">
                    <img
                      src={src}
                      alt=""
                      className="w-full h-full object-cover rounded-lg border border-cream-300"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 bg-ink text-white rounded-full w-5 h-5 flex items-center justify-center shadow"
                      aria-label="Remove photo"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {photos.length < 3 && (
                  <label
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-cream-300 text-ink-muted hover:border-forest hover:text-forest flex flex-col items-center justify-center cursor-pointer text-[10px] font-bold"
                    data-testid="review-photo-add"
                  >
                    <ImagePlus size={20} />
                    ADD
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={onAddPhoto}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => !submitting && setReviewOpen(false)}
                className="flex-1 py-3 rounded-xl border-2 border-cream-300 font-bold text-ink hover:border-forest"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={submitReview}
                data-testid="review-submit"
                disabled={submitting || rating < 1}
                className="flex-1 py-3 rounded-xl bg-forest text-white font-bold hover:bg-forest-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting…" : "Submit review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
