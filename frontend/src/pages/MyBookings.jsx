import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { StatusBadge, formatDate, formatTime } from "@/lib/utils-app";
import { Calendar, Loader2, MapPin, CalendarX2 } from "lucide-react";

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("upcoming");
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/bookings");
      setBookings(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const now = new Date();
  const filtered = bookings.filter((b) => {
    const dt = new Date(`${b.date}T${b.start_time || "00:00"}`);
    const isPast = dt < now || ["completed", "cancelled"].includes(b.status);
    return tab === "upcoming" ? !isPast : isPast;
  });

  return (
    <AppShell title="My Bookings">
      <div className="px-4 sm:px-6 pt-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-cream-200 rounded-xl p-1 mb-4">
          {[
            { k: "upcoming", label: "Upcoming" },
            { k: "past", label: "Past" },
          ].map(({ k, label }) => (
            <button
              key={k}
              data-testid={`bookings-tab-${k}`}
              onClick={() => setTab(k)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                tab === k ? "bg-white text-ink shadow-sm" : "text-ink-soft"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-forest" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-20 h-20 bg-cream-200 rounded-full flex items-center justify-center text-ink-soft">
              <CalendarX2 size={32} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-lg font-bold text-ink">No {tab} bookings</p>
              <p className="text-sm text-ink-soft max-w-xs mt-1">
                {tab === "upcoming"
                  ? "Book a slot to see it here"
                  : "Your past bookings will appear here"}
              </p>
            </div>
            {tab === "upcoming" && (
              <button
                data-testid="bookings-browse-btn"
                onClick={() => navigate("/")}
                className="mt-2 bg-forest text-cream-100 px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-forest-dark transition-colors"
              >
                Browse providers
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((b) => (
              <BookingCard key={b.id} booking={b} onClick={() => navigate(`/bookings/${b.id}`)} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function BookingCard({ booking, onClick }) {
  const p = booking.provider || {};
  return (
    <button
      data-testid={`booking-card-${booking.id}`}
      onClick={onClick}
      className="w-full text-left bg-white border border-cream-300 rounded-2xl p-4 transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.05)] hover:-translate-y-0.5"
    >
      <div className="flex justify-between items-start gap-3 mb-2">
        <div className="min-w-0">
          <p className="font-heading font-bold text-ink truncate">
            {p.business_name || "Provider"}
          </p>
          <p className="text-xs text-ink-soft mt-0.5">{booking.service_name}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div className="flex items-center justify-between text-xs text-ink-soft pt-2 border-t border-cream-300">
        <div className="flex items-center gap-1.5">
          <Calendar size={12} strokeWidth={2} />
          <span className="font-semibold text-ink">
            {formatDate(booking.date)} · {formatTime(booking.start_time)}
          </span>
        </div>
        {booking.token_number != null && (
          <div className="bg-forest-faint text-forest text-[11px] font-bold px-2 py-0.5 rounded-full">
            Token #{booking.token_number}
          </div>
        )}
      </div>
      {p.city && (
        <div className="flex items-center gap-1 text-[11px] text-ink-muted mt-2">
          <MapPin size={11} strokeWidth={2} /> {p.city}
        </div>
      )}
    </button>
  );
}
