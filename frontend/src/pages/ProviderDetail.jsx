import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import CategoryIcon from "@/components/CategoryIcon";
import { useI18n } from "@/i18n";
import { catStyle } from "@/lib/utils-app";
import { Star, MapPin, Clock, Loader2, IndianRupee, MessageSquareText, Info } from "lucide-react";
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

  const { provider, services, reviews, category, has_availability } = data;
  const style = catStyle(category?.color);

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
              <span>{provider.address || provider.city}</span>
            </div>
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

        {/* Services */}
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
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={11}
                          className={i < r.rating ? "fill-amber-400 text-amber-400" : "text-cream-300"}
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
          disabled={!has_availability || services?.length === 0}
          onClick={() => navigate(`/book/${provider.id}`)}
          className="w-full bg-accent hover:bg-accent-dark disabled:bg-ink-muted text-white py-4 rounded-2xl font-bold text-base shadow-[0_10px_30px_rgba(249,115,22,0.35)] transition-colors flex items-center justify-center gap-2"
        >
          {has_availability && services?.length > 0
            ? `Book a slot • from ₹${provider.starting_price}`
            : "Currently unavailable"}
        </button>
      </div>
    </AppShell>
  );
}
