import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, CalendarCheck, Bell, User, ChevronLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function AppShell({ children, title, showBack = false, showHeader = true, headerRight = null }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-md mx-auto md:max-w-2xl lg:max-w-3xl relative min-h-screen bg-cream md:bg-white md:shadow-2xl md:border-x md:border-cream-300">
        {showHeader && (
          <header className="sticky top-0 z-40 backdrop-blur-xl bg-cream/85 md:bg-white/90 border-b border-cream-300 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {showBack && (
                <button
                  data-testid="header-back-btn"
                  onClick={() => navigate(-1)}
                  className="p-1.5 -ml-1.5 rounded-lg hover:bg-cream-200 transition-colors shrink-0"
                >
                  <ChevronLeft size={22} className="text-ink" />
                </button>
              )}
              <h1 className="font-heading text-lg font-bold text-ink tracking-tight truncate">
                {title}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">{headerRight}</div>
          </header>
        )}

        <main className="pb-28 md:pb-24 animate-fade-up">{children}</main>

        <BottomNav />
      </div>
    </div>
  );
}

function BottomNav() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return null;

  const items = [
    { to: "/", label: "Home", icon: Home, testId: "nav-home-btn", exact: true },
    { to: "/bookings", label: "Bookings", icon: CalendarCheck, testId: "nav-bookings-btn" },
    { to: "/notifications", label: "Alerts", icon: Bell, testId: "nav-notifications-btn" },
    { to: "/profile", label: "Profile", icon: User, testId: "nav-profile-btn" },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md md:max-w-2xl lg:max-w-3xl bg-white border-t border-cream-300 px-4 pt-2 pb-3 flex justify-around items-center z-50 rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.05)]">
      {items.map(({ to, label, icon: Icon, testId, exact }) => {
        const active = exact
          ? location.pathname === to
          : location.pathname.startsWith(to);
        return (
          <NavLink
            key={to}
            to={to}
            data-testid={testId}
            className={`flex flex-col items-center gap-1 py-1 px-2 min-w-[56px] transition-all ${
              active ? "text-forest scale-105" : "text-ink-muted hover:text-ink-soft"
            }`}
          >
            <Icon size={22} strokeWidth={active ? 2.5 : 1.75} />
            <span className={`text-[11px] font-semibold ${active ? "text-forest" : ""}`}>
              {label}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export default AppShell;
