import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { useI18n } from "@/i18n";
import useLivePolling from "@/hooks/useLivePolling";
import { StatusBadge, formatDate, formatTime, generateTimeSlots, nextNDays, todayISO } from "@/lib/utils-app";
import {
  Loader2,
  MapPin,
  Clock,
  Ticket,
  User2,
  Ban,
  Star,
  MessageSquare,
  CalendarCog,
  X,
  Car,
  Radio,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [queuePos, setQueuePos] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState(todayISO());
  const [newTime, setNewTime] = useState(null);
  const [rescheduleSlots, setRescheduleSlots] = useState({ shifts: [], has_schedule: false });
  const [loadingReslots, setLoadingReslots] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/bookings");
      const b = (data || []).find((x) => x.id === id);
      if (!b) {
        toast.error("Booking not found");
        navigate("/bookings", { replace: true });
        return;
      }
      setBooking(b);
      if (["pending", "confirmed", "in_progress"].includes(b.status)) {
        try {
          const { data: qp } = await api.get("/queue/my-position", {
            params: { provider_id: b.provider_id, date: b.date },
          });
          setQueuePos(qp);
        } catch (err) {
          // Non-fatal — booking detail still renders, queue position UI just hides.
          console.warn("Queue position lookup failed:", err);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  // Live polling for active bookings (every 4s, page-visibility-aware)
  const isActive = booking ? ["pending", "confirmed", "in_progress"].includes(booking.status) : false;
  useLivePolling(load, 4000, isActive);

  const cancel = async () => {
    if (!window.confirm(t("cancel_confirm"))) return;
    setCancelling(true);
    try {
      await api.put(`/bookings/${id}`, { status: "cancelled" });
      toast.success(t("booking_cancelled"));
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  };

  const submitReview = async () => {
    if (!rating) return toast.error("Give a rating");
    setSubmittingReview(true);
    try {
      await api.post("/reviews", { booking_id: id, rating, comment: comment || null });
      toast.success(t("thanks_review"));
      setRating(0);
      setComment("");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  // Reschedule flow
  useEffect(() => {
    if (!rescheduleOpen || !booking) return;
    setNewTime(null);
    let mounted = true;
    (async () => {
      setLoadingReslots(true);
      try {
        const { data } = await api.get(`/providers/${booking.provider_id}/slots`, {
          params: { date: newDate },
        });
        if (mounted) setRescheduleSlots(data);
      } catch {
        if (mounted) setRescheduleSlots({ shifts: [], has_schedule: false });
      } finally {
        if (mounted) setLoadingReslots(false);
      }
    })();
    return () => (mounted = false);
  }, [rescheduleOpen, newDate, booking]);

  const rescheduleShifts = useMemo(() => {
    if (!rescheduleSlots?.shifts?.length) return [];
    const seen = new Set();
    return rescheduleSlots.shifts.filter((s) => {
      if (!s.available || s.is_full || s.is_past) return false;
      if (seen.has(s.start_time)) return false;
      seen.add(s.start_time);
      return true;
    });
  }, [rescheduleSlots]);

  const doReschedule = async () => {
    if (!newTime) return toast.error(t("select_time"));
    setRescheduling(true);
    try {
      await api.put(`/bookings/${id}`, { date: newDate, start_time: newTime });
      toast.success(t("booking_updated"));
      setRescheduleOpen(false);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setRescheduling(false);
    }
  };

  const days = useMemo(() => nextNDays(14), []);

  if (loading || !booking) {
    return (
      <AppShell title={t("booking_details")} showBack>
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-forest" />
        </div>
      </AppShell>
    );
  }

  const p = booking.provider || {};
  const isCompleted = booking.status === "completed";

  return (
    <AppShell title={t("booking_details")} showBack>
      <div className="px-4 sm:px-6 pt-4 space-y-5">
        {/* Live token / status */}
        {isActive && (
          <div className="bg-forest text-white p-6 rounded-2xl flex flex-col items-center text-center gap-2 shadow-lg">
            <div className="flex items-center gap-2 text-xs text-cream-200 uppercase tracking-widest font-bold">
              <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse-dot" />
              {t("live_token")}
            </div>
            <div
              data-testid="booking-token-number"
              className="text-7xl font-black tracking-tighter text-cream-100 leading-none"
            >
              #{booking.token_number ?? "—"}
            </div>
            {queuePos && queuePos.position != null && (
              <p className="text-sm text-cream-200 mt-1">
                {queuePos.position === 0
                  ? t("youre_up_next")
                  : `${queuePos.position} ${t("ahead_of_you")}`}
              </p>
            )}
            {queuePos?.current_token != null && (
              <p className="text-xs text-cream-200/70 mt-0.5">
                {t("now_serving")}: #{queuePos.current_token}
              </p>
            )}
          </div>
        )}

        {/* Booking summary */}
        <div className="bg-white border border-cream-300 rounded-2xl overflow-hidden">
          <div className="p-4 flex items-center gap-3 border-b border-cream-300">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-cream-200 shrink-0">
              {p.image && (
                <img src={p.image} alt={p.business_name} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-heading font-bold text-ink truncate">{p.business_name}</p>
              <div className="flex items-center gap-1 text-[11px] text-ink-soft mt-0.5">
                <MapPin size={11} strokeWidth={2} /> {p.city}
              </div>
            </div>
            <StatusBadge status={booking.status} />
          </div>
          <div className="p-4 space-y-3 text-sm">
            <Row icon={<Ticket size={14} />} label={t("service")} value={booking.service_name} />
            <Row icon={<Clock size={14} />} label={t("when")} value={`${formatDate(booking.date)} · ${formatTime(booking.start_time)}`} />
            <Row icon={<User2 size={14} />} label={t("booked_as")} value={booking.customer_phone} />
            <Row label={t("amount")} value={`₹${booking.price}`} bold />
            {booking.vehicle_reg_no && (
              <Row icon={<Car size={14} />} label={t("vehicle_reg_no")} value={booking.vehicle_reg_no} />
            )}
            {booking.vehicle_model && (
              <Row label={t("vehicle_model")} value={booking.vehicle_model} />
            )}
            {booking.notes && <Row label={t("notes")} value={booking.notes} />}
          </div>
        </div>

        {/* Actions for active bookings */}
        {isActive && (
          <div className="grid grid-cols-2 gap-2">
            <button
              data-testid="booking-reschedule-btn"
              onClick={() => setRescheduleOpen(true)}
              className="flex items-center justify-center gap-2 bg-white border border-forest/30 text-forest py-3 rounded-xl font-bold hover:bg-forest-faint transition-colors"
            >
              <CalendarCog size={16} /> {t("reschedule")}
            </button>
            <button
              data-testid="booking-cancel-btn"
              onClick={cancel}
              disabled={cancelling}
              className="flex items-center justify-center gap-2 bg-white border border-rose-200 text-rose-700 py-3 rounded-xl font-bold hover:bg-rose-50 transition-colors disabled:opacity-60"
            >
              {cancelling ? <Loader2 size={18} className="animate-spin" /> : <><Ban size={16} /> {t("cancel_booking")}</>}
            </button>
          </div>
        )}

        {/* Review */}
        {isCompleted && (
          <div className="bg-white border border-cream-300 rounded-2xl p-4">
            <h3 className="font-bold text-ink mb-2 flex items-center gap-2">
              <MessageSquare size={16} /> {t("leave_review")}
            </h3>
            <div className="flex items-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  data-testid={`review-star-${n}`}
                  onClick={() => setRating(n)}
                  className="p-1"
                >
                  <Star
                    size={28}
                    className={n <= rating ? "fill-amber-400 text-amber-400" : "text-cream-300"}
                    strokeWidth={0}
                  />
                </button>
              ))}
            </div>
            <textarea
              data-testid="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("share_experience")}
              rows={3}
              className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-forest/20 resize-none"
            />
            <button
              data-testid="review-submit-btn"
              onClick={submitReview}
              disabled={submittingReview || !rating}
              className="mt-3 w-full bg-forest text-cream-100 py-2.5 rounded-xl font-bold hover:bg-forest-dark transition-colors disabled:bg-ink-muted"
            >
              {submittingReview ? <Loader2 size={16} className="animate-spin mx-auto" /> : t("submit_review")}
            </button>
          </div>
        )}
      </div>

      {/* Reschedule modal */}
      {rescheduleOpen && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center px-4 pb-24 sm:pb-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-lg text-ink">{t("reschedule_booking")}</h3>
              <button
                data-testid="reschedule-close-btn"
                onClick={() => setRescheduleOpen(false)}
                className="p-1 rounded-lg hover:bg-cream-200"
              >
                <X size={18} />
              </button>
            </div>

            <label className="text-[10px] uppercase tracking-wider font-bold text-ink-muted mb-2 block">
              {t("new_date")}
            </label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4">
              {days.map((d) => {
                const active = d.iso === newDate;
                return (
                  <button
                    key={d.iso}
                    data-testid={`reschedule-date-${d.iso}`}
                    onClick={() => setNewDate(d.iso)}
                    className={`min-w-[60px] shrink-0 rounded-xl py-2 px-2 text-center ${
                      active
                        ? "bg-forest text-cream-100 border-2 border-forest"
                        : "bg-white text-ink border border-cream-300"
                    }`}
                  >
                    <div className="text-[10px] uppercase font-bold tracking-wider">{d.day}</div>
                    <div className="text-lg font-extrabold leading-none mt-1">{d.date}</div>
                    <div className="text-[10px] mt-0.5">{d.month}</div>
                  </button>
                );
              })}
            </div>

            <label className="text-[10px] uppercase tracking-wider font-bold text-ink-muted mb-2 block">
              {t("new_time")}
            </label>
            {loadingReslots ? (
              <div className="flex justify-center py-6"><Loader2 className="animate-spin text-forest" /></div>
            ) : rescheduleShifts.length === 0 ? (
              <p className="text-sm text-ink-soft italic text-center py-4">{t("no_open_slots")}</p>
            ) : (
              <div className="space-y-2 mb-4 max-h-56 overflow-y-auto">
                {rescheduleShifts.map((shift) => {
                  const active = shift.start_time === newTime;
                  return (
                    <button
                      key={shift.start_time}
                      data-testid={`reschedule-time-${shift.start_time}`}
                      onClick={() => setNewTime(shift.start_time)}
                      className={`w-full flex justify-between items-center py-2.5 px-3 rounded-lg text-sm font-semibold ${
                        active
                          ? "bg-forest text-white border-2 border-forest"
                          : "bg-white text-ink border border-cream-300"
                      }`}
                    >
                      <span>{formatTime(shift.start_time)} – {formatTime(shift.end_time)}</span>
                      {active && <CheckCircle2 size={16} />}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              data-testid="reschedule-confirm-btn"
              onClick={doReschedule}
              disabled={!newTime || rescheduling}
              className="w-full bg-forest text-cream-100 py-3 rounded-xl font-bold hover:bg-forest-dark disabled:bg-ink-muted"
            >
              {rescheduling ? <Loader2 size={16} className="animate-spin mx-auto" /> : t("confirm")}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Row({ icon, label, value, bold }) {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="text-ink-soft mt-0.5">{icon}</span>}
      <div className="flex-1 flex justify-between gap-3">
        <span className="text-ink-soft">{label}</span>
        <span className={`text-right text-ink ${bold ? "font-bold" : "font-medium"}`}>{value}</span>
      </div>
    </div>
  );
}
