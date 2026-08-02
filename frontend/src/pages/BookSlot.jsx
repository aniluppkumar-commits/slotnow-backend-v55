import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { useI18n } from "@/i18n";
import { generateTimeSlots, nextNDays, formatTime, todayISO } from "@/lib/utils-app";
import { Loader2, Clock, IndianRupee, Calendar as CalIcon, CheckCircle2, Car } from "lucide-react";
import { toast } from "sonner";
import { isAutomobileProvider } from "@/lib/providerType";

export default function BookSlot() {
  const { providerId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const staffParam = searchParams.get("staff");
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const navigate = useNavigate();
  const { t } = useI18n();
  const [provider, setProvider] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [selectedTime, setSelectedTime] = useState(null);
  const [slots, setSlots] = useState({ shifts: [], has_schedule: false });
  const [notes, setNotes] = useState("");
  const [vehicleReg, setVehicleReg] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [serviceType, setServiceType] = useState("Paid");
  const [loadingProvider, setLoadingProvider] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isAutomobile = isAutomobileProvider(provider);

  const days = useMemo(() => nextNDays(14), []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/providers/${providerId}`);
        setProvider({ ...data.provider, category_name: data.category?.name });
        setServices(data.services || []);
        if (data.services?.length) setSelectedService(data.services[0]);
        // Load hospital sub-staff so customer can pick a specific doctor / service
        if (data.provider?.provider_type === "hospital") {
          try {
            const s = await api.get(`/providers/${providerId}/staff`);
            const list = Array.isArray(s.data) ? s.data : [];
            setStaffList(list);
            if (staffParam) {
              const pre = list.find((x) => x.id === staffParam);
              if (pre) setSelectedStaff(pre);
            }
          } catch {
            setStaffList([]);
          }
        }
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
        const params = { date: selectedDate };
        const effectiveStaff = selectedStaff?.id || staffParam;
        if (effectiveStaff) params.staff_id = effectiveStaff;
        const { data } = await api.get(`/providers/${providerId}/slots`, { params });
        if (mounted) setSlots(data);
      } catch {
        if (mounted) setSlots({ shifts: [], has_schedule: false });
      } finally {
        if (mounted) setLoadingSlots(false);
      }
    })();
    return () => (mounted = false);
  }, [providerId, selectedDate, selectedStaff, staffParam]);

  // The backend queue is shift-based — customer picks a shift (session)
  // and gets a queue token, not a specific time slot within the shift.
  const bookableShifts = useMemo(() => {
    if (!slots?.shifts?.length) return [];
    // Dedupe by start_time (in case of duplicate seed rows)
    const seen = new Set();
    return slots.shifts.filter((s) => {
      if (!s.available || s.is_full || s.is_past) return false;
      if (seen.has(s.start_time)) return false;
      seen.add(s.start_time);
      return true;
    });
  }, [slots]);

  const handleBook = async () => {
    if (!selectedService) return toast.error(t("select_service"));
    if (staffList.length > 0 && !selectedStaff) {
      return toast.error("Please pick a doctor or service");
    }
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
        staff_id: (selectedStaff?.id) || staffParam || undefined,
      };
      if (isAutomobile) {
        payload.vehicle_reg_no = vehicleReg || null;
        payload.vehicle_model = vehicleModel || null;
        // Backend expects payment mode 'Paid' or 'Free' (not vehicle class)
        payload.service_type = serviceType || "Paid";
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

        {/* Hospital sub-doctor / service picker (only for hospitals) */}
        {staffList.length > 0 && (
          <section data-testid="booking-staff-picker" className="space-y-4">
            {["doctor", "service"].map((kind) => {
              const group = staffList.filter((s) => s.kind === kind);
              if (group.length === 0) return null;
              return (
                <div key={kind}>
                  <h3
                    data-testid={`staff-group-${kind}`}
                    className="text-xs font-bold uppercase tracking-[0.15em] text-ink-soft mb-3"
                  >
                    {kind === "doctor" ? "Doctors" : "Other Services"} ({group.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {group.map((s) => {
                      const on = selectedStaff?.id === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSelectedStaff(s);
                            const next = new URLSearchParams(searchParams);
                            next.set("staff", s.id);
                            setSearchParams(next, { replace: true });
                          }}
                          data-testid={`book-staff-${s.id}`}
                          className={`text-left p-3 rounded-xl border transition-all ${
                            on
                              ? "bg-forest text-white border-forest shadow-md"
                              : "bg-white border-cream-300 hover:border-forest"
                          }`}
                        >
                          <p className={`font-bold text-sm truncate ${on ? "text-white" : "text-ink"}`}>
                            {s.name}
                          </p>
                          {s.specialization && (
                            <p className={`text-[11px] font-semibold truncate ${on ? "text-white/85" : "text-forest"}`}>
                              {s.specialization}
                            </p>
                          )}
                          {s.kind === "service" && s.service_tags?.length > 0 && (
                            <p className={`text-[10px] truncate ${on ? "text-white/70" : "text-ink-muted"}`}>
                              {s.service_tags.slice(0, 2).join(", ")}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {!selectedStaff && (
              <p className="text-[11px] text-amber-700 mt-2">
                Please select a doctor or service to continue.
              </p>
            )}
          </section>
        )}

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

        {/* Time / Session */}
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
          ) : bookableShifts.length === 0 ? (
            <p className="text-sm text-ink-soft italic text-center py-4">
              {t("no_open_slots")}
            </p>
          ) : (
            <div className="space-y-2">
              {bookableShifts.map((shift) => {
                const active = shift.start_time === selectedTime;
                const capText =
                  shift.max_bookings != null
                    ? `${shift.booked || 0}/${shift.max_bookings} booked`
                    : `${shift.booked || 0} booked so far`;
                return (
                  <button
                    key={shift.start_time}
                    data-testid={`booking-time-${shift.start_time}`}
                    onClick={() => setSelectedTime(shift.start_time)}
                    className={`w-full flex justify-between items-center gap-3 p-4 rounded-xl transition-all text-left ${
                      active
                        ? "bg-forest-faint border-2 border-forest ring-2 ring-forest/10"
                        : "bg-white border border-cream-300 hover:border-forest/40"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-heading font-bold text-ink text-base leading-tight">
                        {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                      </p>
                      <p className="text-[11px] text-ink-soft mt-1 leading-tight">
                        {capText}
                      </p>
                      <p className="text-[10px] text-ink-muted mt-0.5 leading-tight">
                        Token on confirm
                      </p>
                    </div>
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        active ? "bg-forest text-white" : "border-2 border-cream-300"
                      }`}
                    >
                      {active && <CheckCircle2 size={14} strokeWidth={3} />}
                    </div>
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
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-ink-muted mb-1 block">
                  {t("service_type")}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["Paid", "Free"].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      data-testid={`booking-service-type-${mode.toLowerCase()}`}
                      onClick={() => setServiceType(mode)}
                      className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                        serviceType === mode
                          ? "bg-forest-faint border-forest text-forest ring-2 ring-forest/10"
                          : "bg-white border-cream-300 text-ink-soft hover:border-forest/40"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
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
          className="w-full bg-accent hover:bg-accent-dark disabled:bg-ink-muted text-white py-4 rounded-2xl font-bold shadow-[0_10px_30px_rgba(249,115,22,0.35)] transition-colors flex items-center justify-center gap-2"
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
