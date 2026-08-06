import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import CategoryIcon from "@/components/CategoryIcon";
import { useI18n } from "@/i18n";
import { catStyle } from "@/lib/utils-app";
import { unpackAddress } from "@/lib/address";
import { Star, MapPin, Clock, Loader2, IndianRupee, MessageSquareText, Info, Navigation, Phone, Stethoscope, Building2 } from "lucide-react";
import { toast } from "sonner";

export default function ProviderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: res } = await api.get(`/providers/${id}`);
        if (!mounted) return;
        setData(res);
      } catch (e) {
        toast.error("Provider not found");
        navigate(-1);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, [id, navigate]);

  if (loading || !data) {
    return (
      <AppShell title="Loading…" showBack>
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-forest" />
        </div>
      </AppShell>
    );
  }

  const { provider, services, reviews, category, has_availability, staff = [] } = data;
  const style = catStyle(category?.color);
  // Backend has no location_link column — the map link is piggy-backed into `address`.
  const { text: addressText, mapLink } = unpackAddress(provider.address);
  const directionsUrl = provider.location_link || mapLink;
  const isHospital = provider.provider_type === "hospital";
  const doctors = staff.filter((s) => s.kind === "doctor");
  const centers = staff.filter((s) => s.kind === "service");
  // Hospitals: bookable when they have at least one sub-doctor / sub-service.
  // Others: bookable when at least one service is configured and any weekly shift exists.
  const isBookable = isHospital ? staff.length > 0 : (has_availability && (services?.length || 0) > 0);
  const providerPhone = provider.contact_phone || "";

  return (
    <AppShell title={provider.business_name} showBack>
      {/* Hero image */}
      <div className="relative">
        <div className="h-52 sm:h-60 bg-cream-200 overflow-hidden">
          {provider.image ? (
            <img src={provider.image} alt={provider.business_name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ink-muted">
              <CategoryIcon name={category?.icon} size={60} />
            </div>
          )}
        </div>
        <div className="absolute inset-x-0 -bottom-8 px-4 sm:px-6">
          <div className="bg-white rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-cream-300 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-heading text-xl font-extrabold text-ink tracking-tight truncate">
                  {provider.business_name}
                </h2>
                {category && (
                  <span className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                    {lang === "hi" ? category.name_hi : category.name}
                  </span>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-center gap-1 justify-end">
                  <Star size={14} className="fill-amber-400 text-amber-400" strokeWidth={0} />
                  <span className="text-sm font-bold text-ink">{provider.rating?.toFixed(1) || "—"}</span>
                </div>
                <p className="text-[11px] text-ink-muted">{provider.reviews_count || 0} {t("reviews")}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-ink-soft mt-2">
              <MapPin size={12} strokeWidth={2} />
              <span>{addressText || provider.city}</span>
            </div>
            {providerPhone && (
              <div className="flex items-center gap-2 mt-2">
                <a
                  href={`tel:${providerPhone}`}
                  data-testid="provider-call-btn"
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <Phone size={12} strokeWidth={2.5} />
                  Call {providerPhone}
                </a>
              </div>
            )}
            {directionsUrl && (
              <a
                data-testid="provider-directions-btn"
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold bg-sky-50 hover:bg-sky-100 text-sky-800 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <Navigation size={12} strokeWidth={2.5} />
                Get Directions
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 pt-12">
        {/* Bio */}
        {provider.bio && (
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-ink-soft mb-2 flex items-center gap-1.5">
              <Info size={12} strokeWidth={2.5} /> {t("about")}
            </h3>
            <p className="text-sm text-ink leading-relaxed">{provider.bio}</p>
          </div>
        )}

        {/* Hospital sub-doctors & sub-services */}
        {isHospital && (doctors.length > 0 || centers.length > 0) && (
          <div className="mb-6 space-y-4">
            {doctors.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-ink-soft mb-3 flex items-center gap-1.5">
                  <Stethoscope size={12} strokeWidth={2.5} />
                  Our Doctors ({doctors.length})
                </h3>
                <div className="space-y-2" data-testid="pd-doctors">
                  {doctors.map((d) => (
                    <button
                      key={d.id}
                      data-testid={`pd-doctor-${d.id}`}
                      onClick={() => navigate(`/book/${provider.id}?staff=${d.id}`)}
                      className="w-full text-left bg-white border border-cream-300 hover:border-forest rounded-xl p-3 flex gap-3 transition-all hover:shadow-md"
                    >
                      {d.photo ? (
                        <img src={d.photo} alt={d.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-forest-faint text-forest flex items-center justify-center font-heading font-black shrink-0">
                          {d.name?.[0] || "D"}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-ink text-sm truncate">{d.name}</p>
                        {d.specialization && (
                          <p className="text-xs text-forest font-semibold truncate">{d.specialization}</p>
                        )}
                        {d.bio && <p className="text-[11px] text-ink-soft line-clamp-1 mt-0.5">{d.bio}</p>}
                        {d.phone && (
                          <a
                            href={`tel:${d.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`pd-doctor-call-${d.id}`}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
                          >
                            <Phone size={10} strokeWidth={2.5} /> {d.phone}
                          </a>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {centers.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-ink-soft mb-3 flex items-center gap-1.5">
                  <Building2 size={12} strokeWidth={2.5} />
                  Other Services ({centers.length})
                </h3>
                <div className="space-y-2" data-testid="pd-services">
                  {centers.map((c) => (
                    <button
                      key={c.id}
                      data-testid={`pd-service-${c.id}`}
                      onClick={() => navigate(`/book/${provider.id}?staff=${c.id}`)}
                      className="w-full text-left bg-white border border-cream-300 hover:border-forest rounded-xl p-3 transition-all hover:shadow-md"
                    >
                      <p className="font-bold text-ink text-sm">{c.name}</p>
                      {c.service_tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.service_tags.slice(0, 4).map((t) => (
                            <span key={t} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cream-200 text-ink-soft">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {c.phone && (
                        <a
                          href={`tel:${c.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`pd-service-call-${c.id}`}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
                        >
                          <Phone size={10} strokeWidth={2.5} /> {c.phone}
                        </a>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Services — hospitals use per-staff catalogue above, so hide this block for them */}
        {!isHospital && (
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-ink-soft mb-3">
              {t("services_offered")}
            </h3>
            {services?.length > 0 ? (
              <div className="space-y-2">
                {services.map((s) => (
                  <div
                    key={s.id}
                    data-testid={`service-item-${s.id}`}
                    className="bg-white border border-cream-300 rounded-xl p-4 flex justify-between items-center"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-ink text-sm">{s.name}</p>
                      {s.description && (
                        <p className="text-xs text-ink-soft mt-0.5 line-clamp-1">{s.description}</p>
                      )}
                      <div className="flex items-center gap-1 text-[11px] text-ink-muted mt-1">
                        <Clock size={11} strokeWidth={2} /> {s.duration_min} min
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 text-forest font-bold">
                      <IndianRupee size={14} strokeWidth={2.5} />
                      <span>{s.price}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-soft italic">{t("no_services_listed")}</p>
            )}
          </div>
        )}

        {/* Reviews */}
        {reviews?.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-ink-soft mb-3 flex items-center gap-1.5">
              <MessageSquareText size={12} strokeWidth={2.5} />
              {t("recent_reviews")}
            </h3>
            <div className="space-y-2">
              {reviews.slice(0, 5).map((r) => (
                <div key={r.id} className="bg-white border border-cream-300 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-ink">{r.customer_name || "Customer"}</p>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={`review-${r.id}-star-${star}`}
                          size={11}
                          className={star <= r.rating ? "fill-amber-400 text-amber-400" : "text-cream-300"}
                          strokeWidth={0}
                        />
                      ))}
                    </div>
                  </div>
                  {r.comment && <p className="text-xs text-ink-soft">{r.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky book CTA */}
      <div className="fixed bottom-36 md:bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md md:max-w-md px-4 sm:px-6 z-40">
        <button
          data-testid="provider-book-btn"
          disabled={!isBookable}
          onClick={() => navigate(`/book/${provider.id}`)}
          className="w-full bg-accent hover:bg-accent-dark disabled:bg-ink-muted text-white py-4 rounded-2xl font-bold text-base shadow-[0_10px_30px_rgba(249,115,22,0.35)] transition-colors flex items-center justify-center gap-2"
        >
          {isBookable
            ? (isHospital
                ? "Book a slot • pick a doctor / service"
                : `Book a slot • from ₹${provider.starting_price}`)
            : "Currently unavailable"}
        </button>
      </div>
    </AppShell>
  );
}
