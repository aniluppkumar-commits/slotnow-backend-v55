import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { generateTimeSlots, nextNDays, formatTime, todayISO } from "@/lib/utils-app";
import { Loader2, Clock, IndianRupee, Calendar as CalIcon, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function BookSlot() {
  const { providerId } = useParams();
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [selectedTime, setSelectedTime] = useState(null);
  const [slots, setSlots] = useState({ shifts: [], has_schedule: false });
  const [notes, setNotes] = useState("");
  const [loadingProvider, setLoadingProvider] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const days = useMemo(() => nextNDays(14), []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/providers/${providerId}`);
        setProvider(data.provider);
        setServices(data.services || []);
        if (data.services?.length) setSelectedService(data.services[0]);
      } catch {
        toast.error("Failed to load provider");
        navigate(-1);
      } finally {
        setLoadingProvider(false);
      }
    })();
  }, [providerId, navigate]);

  useEffect(() => {
    if (!providerId || !selectedDate) return;
    let mounted = true;
    (async () => {
      setLoadingSlots(true);
      setSelectedTime(null);
      try {
        const { data } = await api.get(`/providers/${providerId}/slots`, {
          params: { date: selectedDate },
        });
        if (mounted) setSlots(data);
      } catch {
        if (mounted) setSlots({ shifts: [], has_schedule: false });
      } finally {
        if (mounted) setLoadingSlots(false);
      }
    })();
    return () => (mounted = false);
  }, [providerId, selectedDate]);

  const timeOptions = useMemo(() => {
    if (!slots?.shifts?.length || !selectedService) return [];
    const out = [];
    slots.shifts.forEach((shift) => {
      if (shift.is_full || shift.is_past || !shift.available) return;
      const times = generateTimeSlots(shift.start_time, shift.end_time, selectedService.duration_min);
      out.push(...times);
    });
    return out;
  }, [slots, selectedService]);

  const handleBook = async () => {
    if (!selectedService) return toast.error(t("select_service"));
    if (!selectedTime) return toast.error(t("select_time"));
    if (isAutomobile && !vehicleReg.trim()) return toast.error(t("vehicle_reg_no"));
    setSubmitting(true);
    try {
      const payload = {
        provider_id: providerId,
        service_id: selectedService.id,
        date: selectedDate,
        start_time: selectedTime,
        notes: notes || null,
      };
      if (isAutomobile) {
        payload.vehicle_reg_no = vehicleReg || null;
        payload.vehicle_model = vehicleModel || null;
        payload.service_type = serviceType || selectedService.service_type || null;
      }
      const { data } = await api.post("/bookings", payload);
      toast.success(`${t("booked_token")} #${data.token_number}`);
      navigate(`/bookings/${data.id}`, { replace: true });
    } catch (e) {
      toast.error(e.response?.data?.detail || t("booking_failed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProvider) {
    return (
      <AppShell title={t("book_a_slot")} showBack>
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-forest" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("book_a_slot")} showBack>
      <div className="px-4 sm:px-6 pt-4 space-y-6">
        {/* Provider summary */}
        <div className="bg-forest-faint rounded-2xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/60 shrink-0">
            {provider.image && (
              <img src={provider.image} alt={provider.business_name} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-heading font-bold text-ink truncate">{provider.business_name}</p>
            <p className="text-xs text-ink-soft truncate">{provider.city}</p>
          </div>
        </div>

        {/* Service */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-ink-soft mb-3">
            1. {t("select_service")}
          </h3>
          <div className="space-y-2">
            {services.map((s) => (
              <button
                key={s.id}
                data-testid={`booking-service-${s.id}`}
                onClick={() => setSelectedService(s)}
                className={`w-full flex justify-between items-center p-4 rounded-xl bg-white transition-all text-left ${
                  selectedService?.id === s.id
                    ? "border-2 border-forest ring-2 ring-forest/10 bg-forest-faint"
                    : "border border-cream-300 hover:border-forest/40"
                }`}
              >
                <div>
                  <p className="font-bold text-ink text-sm">{s.name}</p>
                  <div className="flex items-center gap-1 text-[11px] text-ink-soft mt-0.5">
                    <Clock size={11} strokeWidth={2} /> {s.duration_min} min
                  </div>
                </div>
                <div className="flex items-center gap-0.5 text-forest font-bold">
                  <IndianRupee size={13} strokeWidth={2.5} />
                  <span>{s.price}</span>
                </div>
              </button>
            ))}
            {services.length === 0 && (
              <p className="text-sm text-ink-soft italic text-center py-4">{t("no_services_available")}</p>
            )}
          </div>
        </section>

        {/* Date */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-ink-soft mb-3 flex items-center gap-1.5">
            <CalIcon size={12} strokeWidth={2.5} />
            2. {t("select_date")}
          </h3>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 sm:-mx-6 px-4 sm:px-6 pb-1">
            {days.map((d) => {
              const active = d.iso === selectedDate;
              return (
                <button
                  key={d.iso}
                  data-testid={`booking-date-${d.iso}`}
                  onClick={() => setSelectedDate(d.iso)}
                  className={`min-w-[64px] shrink-0 rounded-xl py-3 px-2 text-center transition-all ${
                    active
                      ? "bg-forest text-cream-100 border-2 border-forest shadow-md"
                      : "bg-white text-ink border border-cream-300 hover:border-forest/40"
                  }`}
                >
                  <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                    {d.day}
                  </div>
                  <div className="text-lg font-extrabold leading-none mt-1">{d.date}</div>
                  <div className="text-[10px] opacity-80 mt-0.5">{d.month}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Time */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-ink-soft mb-3">
            3. {t("select_time")}
          </h3>
          {loadingSlots ? (
            <div className="flex justify-center py-6">
              <Loader2 className="animate-spin text-forest" />
            </div>
          ) : !slots.has_schedule ? (
            <p className="text-sm text-ink-soft italic text-center py-4">
              {t("provider_not_available_day")}
            </p>
          ) : timeOptions.length === 0 ? (
            <p className="text-sm text-ink-soft italic text-center py-4">
              {t("no_open_slots")}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {timeOptions.map((t) => {
                const active = t === selectedTime;
                return (
                  <button
                    key={t}
                    data-testid={`booking-time-${t}`}
                    onClick={() => setSelectedTime(t)}
                    className={`py-3 px-2 rounded-xl text-sm font-semibold transition-all ${
                      active
                        ? "bg-forest text-cream-100 border-2 border-forest shadow-md"
                        : "bg-white text-ink border border-cream-300 hover:border-forest/40"
                    }`}
                  >
                    {formatTime(t)}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Notes */}
        <section>
          <label className="text-xs font-bold uppercase tracking-[0.15em] text-ink-soft mb-2 block">
            4. {t("notes_optional")}
          </label>
          <textarea
            data-testid="booking-notes-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("any_specific_request")}
            rows={2}
            className="w-full bg-white border border-cream-300 rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:ring-2 focus:ring-forest/20 focus:border-forest outline-none resize-none"
          />
        </section>

        {/* Automobile-specific fields */}
        {isAutomobile && (
          <section>
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-ink-soft mb-3 flex items-center gap-1.5">
              <Car size={12} strokeWidth={2.5} />
              5. {t("vehicle_details")}
            </h3>
            <div className="space-y-2">
              <input
                data-testid="booking-vehicle-reg"
                value={vehicleReg}
                onChange={(e) => setVehicleReg(e.target.value.toUpperCase())}
                placeholder={`${t("vehicle_reg_no")} *`}
                className="w-full bg-white border border-cream-300 rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:ring-2 focus:ring-forest/20 focus:border-forest outline-none uppercase tracking-wider font-mono"
              />
              <input
                data-testid="booking-vehicle-model"
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                placeholder={t("vehicle_model")}
                className="w-full bg-white border border-cream-300 rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:ring-2 focus:ring-forest/20 focus:border-forest outline-none"
              />
              <input
                data-testid="booking-service-type"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                placeholder={`${t("service_type")} (${t("optional")})`}
                className="w-full bg-white border border-cream-300 rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:ring-2 focus:ring-forest/20 focus:border-forest outline-none"
              />
            </div>
          </section>
        )}

        <div className="h-4" />
      </div>

      {/* Confirm CTA */}
      <div className="fixed bottom-36 md:bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md md:max-w-md px-4 sm:px-6 z-40">
        <button
          data-testid="booking-confirm-btn"
          disabled={!selectedService || !selectedTime || submitting}
          onClick={handleBook}
          className="w-full bg-forest hover:bg-forest-dark disabled:bg-ink-muted text-cream-100 py-4 rounded-2xl font-bold shadow-[0_10px_30px_rgba(44,62,53,0.25)] transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              <CheckCircle2 size={18} strokeWidth={2.5} />
              {selectedTime ? `${t("confirm")} • ${formatTime(selectedTime)}` : t("select_a_slot")}
              {selectedService && selectedTime && (
                <span className="opacity-80 font-normal text-sm">• ₹{selectedService.price}</span>
              )}
            </>
          )}
        </button>
      </div>
    </AppShell>
  );
}
