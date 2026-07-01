import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { StatusBadge, formatDate, formatTime } from "@/lib/utils-app";
import { Loader2, MapPin, Clock, Ticket, User2, Ban, Star, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [queuePos, setQueuePos] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/bookings");
      const b = (data || []).find((x) => x.id === id);
      if (!b) {
        toast.error("Booking not found");
        navigate("/bookings", { replace: true });
        return;
      }
      setBooking(b);
      // fetch live queue position for active bookings
      if (["pending", "confirmed", "in_progress"].includes(b.status)) {
        try {
          const { data: qp } = await api.get("/queue/my-position", {
            params: { provider_id: b.provider_id, date: b.date },
          });
          setQueuePos(qp);
        } catch {}
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 15000); // poll every 15s for live queue
    return () => clearInterval(iv);
  }, [id]);

  const cancel = async () => {
    if (!window.confirm("Cancel this booking?")) return;
    setCancelling(true);
    try {
      await api.put(`/bookings/${id}`, { status: "cancelled" });
      toast.success("Booking cancelled");
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
      toast.success("Thanks for the review!");
      setRating(0);
      setComment("");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading || !booking) {
    return (
      <AppShell title="Booking" showBack>
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-forest" />
        </div>
      </AppShell>
    );
  }

  const p = booking.provider || {};
  const isActive = ["pending", "confirmed", "in_progress"].includes(booking.status);
  const isCompleted = booking.status === "completed";

  return (
    <AppShell title="Booking Details" showBack>
      <div className="px-4 sm:px-6 pt-4 space-y-5">
        {/* Live token / status */}
        {isActive && (
          <div className="bg-forest text-white p-6 rounded-2xl flex flex-col items-center text-center gap-2 shadow-lg">
            <div className="flex items-center gap-2 text-xs text-cream-200 uppercase tracking-widest font-bold">
              <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse-dot" />
              Live Token
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
                  ? "You're up next!"
                  : `${queuePos.position} ahead of you`}
              </p>
            )}
            {queuePos?.current_token != null && (
              <p className="text-xs text-cream-200/70 mt-0.5">
                Now serving: #{queuePos.current_token}
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
            <Row icon={<Ticket size={14} />} label="Service" value={booking.service_name} />
            <Row icon={<Clock size={14} />} label="When" value={`${formatDate(booking.date)} · ${formatTime(booking.start_time)}`} />
            <Row icon={<User2 size={14} />} label="Booked as" value={booking.customer_phone} />
            <Row label="Amount" value={`₹${booking.price}`} bold />
            {booking.notes && <Row label="Notes" value={booking.notes} />}
          </div>
        </div>

        {/* Cancel */}
        {isActive && (
          <button
            data-testid="booking-cancel-btn"
            onClick={cancel}
            disabled={cancelling}
            className="w-full flex items-center justify-center gap-2 bg-white border border-rose-200 text-rose-700 py-3 rounded-xl font-bold hover:bg-rose-50 transition-colors disabled:opacity-60"
          >
            {cancelling ? <Loader2 size={18} className="animate-spin" /> : <><Ban size={16} /> Cancel booking</>}
          </button>
        )}

        {/* Review */}
        {isCompleted && (
          <div className="bg-white border border-cream-300 rounded-2xl p-4">
            <h3 className="font-bold text-ink mb-2 flex items-center gap-2">
              <MessageSquare size={16} /> Leave a review
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
              placeholder="Share your experience (optional)"
              rows={3}
              className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-forest/20 resize-none"
            />
            <button
              data-testid="review-submit-btn"
              onClick={submitReview}
              disabled={submittingReview || !rating}
              className="mt-3 w-full bg-forest text-cream-100 py-2.5 rounded-xl font-bold hover:bg-forest-dark transition-colors disabled:bg-ink-muted"
            >
              {submittingReview ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Submit review"}
            </button>
          </div>
        )}
      </div>
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
