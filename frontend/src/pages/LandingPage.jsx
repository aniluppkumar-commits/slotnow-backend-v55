import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarClock,
  Users,
  ShieldCheck,
  Sparkles,
  Search,
  BellRing,
  MapPin,
  Star,
  ChevronDown,
  Phone,
  Mail,
  MessageCircle,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api";

// SlotNow production contact — footer defaults. Update here to change site-wide.
const CONTACT = {
  phone: "+91 94125 75970",
  phoneHref: "+919412575970",
  email: "support@slotnow.co.in",
  whatsapp: "919412575970",
};

const FEATURES = [
  {
    icon: CalendarClock,
    title: "Zero-wait bookings",
    text: "Real-time slot availability across doctors, salons, garages, tutors and more.",
  },
  {
    icon: BellRing,
    title: "Live queue alerts",
    text: "Know exactly when your turn is coming — no more sitting idle in the waiting room.",
  },
  {
    icon: ShieldCheck,
    title: "Verified providers",
    text: "Every service provider on SlotNow is manually verified before going live.",
  },
  {
    icon: Sparkles,
    title: "One tap re-book",
    text: "Your favourite doctor, stylist or mechanic — always a single tap away.",
  },
];

const STEPS = [
  { n: 1, title: "Pick a service", text: "Choose from healthcare, salons, automobile, tutors, coaches and more." },
  { n: 2, title: "Grab an open slot", text: "See live availability and confirm your appointment in seconds." },
  { n: 3, title: "Skip the queue", text: "Get live updates on your position and walk in exactly on time." },
];

const LOGIN_OPTIONS = [
  { role: "customer", label: "Customer", desc: "Book appointments" },
  { role: "provider", label: "Service Provider", desc: "Manage bookings & queue" },
  { role: "receptionist", label: "Service Assistant", desc: "Front-desk / receptionist" },
  { role: "admin", label: "Admin", desc: "Platform management" },
];

function LoginMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        data-testid="landing-login-btn"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-forest text-white font-semibold text-sm hover:bg-forest-dark shadow-lg shadow-forest/20 transition-all"
      >
        Login
        <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          data-testid="landing-login-menu"
          className="absolute right-0 mt-2 w-64 bg-white border border-cream-300 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-up"
        >
          <div className="px-4 py-3 border-b border-cream-200">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Login as</p>
          </div>
          {LOGIN_OPTIONS.map((opt) => (
            <Link
              key={opt.role}
              to={`/login?role=${opt.role}`}
              data-testid={`landing-login-${opt.role}`}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-cream-100 transition-colors border-b border-cream-100 last:border-0"
            >
              <div>
                <p className="text-sm font-bold text-ink">{opt.label}</p>
                <p className="text-xs text-ink-muted">{opt.desc}</p>
              </div>
              <ArrowRight size={16} className="text-forest" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [providers, setProviders] = useState([]);

  useEffect(() => {
    api
      .get("/categories")
      .then((r) => setCategories(Array.isArray(r.data) ? r.data.filter((c) => c.active !== false).slice(0, 8) : []))
      .catch(() => {});
    api
      .get("/providers")
      .then((r) => setProviders(Array.isArray(r.data) ? r.data.slice(0, 6) : []))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-cream text-ink">
      {/* Top nav */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-cream/90 border-b border-cream-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to="/" data-testid="landing-brand" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="SlotNow" className="h-10 w-10 object-contain" />
            <span className="font-heading font-extrabold text-2xl tracking-tight">
              <span className="text-forest">Slot</span>
              <span className="text-accent">Now</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <a
              href="#categories"
              className="hidden sm:inline-block text-sm font-semibold text-ink-soft hover:text-forest px-3 py-2 rounded-lg transition-colors"
            >
              Browse
            </a>
            <a
              href="#how"
              className="hidden sm:inline-block text-sm font-semibold text-ink-soft hover:text-forest px-3 py-2 rounded-lg transition-colors"
            >
              How it works
            </a>
            <LoginMenu />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-16 md:pt-20 md:pb-24 grid md:grid-cols-2 gap-10 items-center">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 bg-white border border-cream-300 rounded-full px-3 py-1.5 mb-5 shadow-sm">
              <Sparkles size={14} className="text-accent" />
              <span className="text-xs font-bold text-ink">India&apos;s fastest booking app</span>
            </div>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight text-ink">
              Book appointments <br className="hidden md:block" />
              <span className="text-forest">in seconds.</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-ink-soft max-w-lg leading-relaxed">
              Skip the phone-calls and long queues. Reserve your slot at doctors, salons,
              garages, tutors and more — all in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/login?role=customer"
                data-testid="hero-book-cta"
                className="inline-flex items-center gap-2 bg-forest text-white font-bold px-6 py-3.5 rounded-2xl hover:bg-forest-dark transition-all shadow-lg shadow-forest/25 hover:-translate-y-0.5"
              >
                Book Now
                <ArrowRight size={18} />
              </Link>
              <Link
                to="/login?role=provider"
                data-testid="hero-provider-cta"
                className="inline-flex items-center gap-2 bg-white text-ink font-bold px-6 py-3.5 rounded-2xl border-2 border-cream-300 hover:border-forest hover:text-forest transition-all"
              >
                List Your Business
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-ink-muted">
              <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-forest" /> Verified providers</div>
              <div className="flex items-center gap-2"><CalendarClock size={16} className="text-forest" /> Live queue updates</div>
              <div className="flex items-center gap-2"><Users size={16} className="text-forest" /> 4-role platform</div>
            </div>
          </div>
          <div className="relative animate-fade-up">
            <div className="absolute -inset-6 bg-gradient-to-br from-forest/10 via-accent/10 to-transparent rounded-[3rem] blur-2xl" aria-hidden="true" />
            <div className="relative bg-white rounded-3xl border border-cream-300 shadow-2xl p-8 md:p-10 flex items-center justify-center">
              <img src="/logo.png" alt="SlotNow logo" className="w-full max-w-[280px] md:max-w-[340px] object-contain" />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white border-y border-cream-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-accent mb-2">Why SlotNow</p>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-ink">Made for real Indian queues</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="bg-cream rounded-2xl p-6 border border-cream-300 hover:border-forest/30 hover:shadow-lg transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-forest/10 text-forest flex items-center justify-center mb-4">
                  <Icon size={22} />
                </div>
                <h3 className="font-heading font-bold text-lg text-ink mb-1.5">{title}</h3>
                <p className="text-sm text-ink-soft leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-accent mb-2">Explore</p>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-ink">Popular categories</h2>
          </div>
          <Link to="/login?role=customer" className="text-sm font-semibold text-forest hover:underline">
            See all →
          </Link>
        </div>
        {categories.length === 0 ? (
          <div className="text-center py-12 text-ink-muted">
            <Search size={32} className="mx-auto mb-2 opacity-40" />
            Loading categories…
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((c) => (
              <Link
                key={c.id}
                to="/login?role=customer"
                data-testid={`landing-cat-${c.id}`}
                className="group bg-white rounded-2xl p-5 border border-cream-300 hover:border-forest hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 text-xl font-bold text-white"
                  style={{ background: c.color || "#1D2E5B" }}
                >
                  {(c.name || "?").charAt(0)}
                </div>
                <p className="font-bold text-ink group-hover:text-forest">{c.name}</p>
                {c.name_hi && <p className="text-xs text-ink-muted mt-0.5">{c.name_hi}</p>}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section id="how" className="bg-forest text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-accent-soft mb-2">Simple 3-step flow</p>
            <h2 className="font-heading text-3xl sm:text-4xl font-black">How it works</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <div key={s.n} className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                <div className="w-11 h-11 rounded-xl bg-accent text-white flex items-center justify-center font-heading font-black text-lg mb-4">
                  {s.n}
                </div>
                <h3 className="font-heading font-bold text-xl mb-2">{s.title}</h3>
                <p className="text-sm text-white/70 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured providers */}
      {providers.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-accent mb-2">Featured</p>
              <h2 className="font-heading text-3xl sm:text-4xl font-black text-ink">Top-rated providers</h2>
            </div>
            <Link to="/login?role=customer" className="text-sm font-semibold text-forest hover:underline">
              View all →
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {providers.map((p) => (
              <Link
                key={p.id}
                to="/login?role=customer"
                data-testid={`landing-provider-${p.id}`}
                className="bg-white rounded-2xl overflow-hidden border border-cream-300 hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                {p.image && (
                  <div className="h-40 w-full bg-cream-200 overflow-hidden">
                    <img
                      src={p.image}
                      alt={p.business_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-ink truncate">{p.business_name}</h3>
                    {p.rating && (
                      <div className="flex items-center gap-1 shrink-0 text-sm">
                        <Star size={14} className="text-accent fill-accent" />
                        <span className="font-semibold">{p.rating}</span>
                      </div>
                    )}
                  </div>
                  {p.city && (
                    <div className="flex items-center gap-1 text-xs text-ink-muted">
                      <MapPin size={12} />
                      {p.city}
                    </div>
                  )}
                  {p.starting_price != null && (
                    <p className="mt-3 text-sm text-ink-soft">
                      From <span className="font-bold text-ink">₹{p.starting_price}</span>
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA banner */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <div className="relative overflow-hidden bg-gradient-to-br from-forest to-forest-dark text-white rounded-3xl p-8 md:p-12">
          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-accent/20 rounded-full blur-3xl" aria-hidden="true" />
          <div className="relative grid md:grid-cols-2 gap-6 items-center">
            <div>
              <h2 className="font-heading text-3xl sm:text-4xl font-black mb-3">
                Own a service business?
              </h2>
              <p className="text-white/80 max-w-md">
                List your business on SlotNow and start receiving appointment bookings today.
                It&apos;s free to get started.
              </p>
            </div>
            <div className="md:justify-self-end">
              <Link
                to="/login?role=provider"
                data-testid="cta-provider-signup"
                className="inline-flex items-center gap-2 bg-white text-forest font-bold px-6 py-3.5 rounded-2xl hover:bg-cream transition-all shadow-lg"
              >
                Get Started
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-ink text-white/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <img src="/logo.png" alt="SlotNow" className="h-9 w-9 object-contain bg-white rounded-lg p-1" />
                <span className="font-heading font-extrabold text-2xl">
                  <span className="text-white">Slot</span>
                  <span className="text-accent">Now</span>
                </span>
              </div>
              <p className="text-sm text-white/60 max-w-sm leading-relaxed">
                Book appointments in seconds. Real-time slot booking for doctors, salons,
                garages, tutors, coaches and more — across India.
              </p>
            </div>
            <div>
              <h4 className="text-white font-heading font-bold mb-3">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/login?role=customer" className="hover:text-white">Book a slot</Link></li>
                <li><Link to="/login?role=provider" className="hover:text-white">List your business</Link></li>
                <li><a href="#how" className="hover:text-white">How it works</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-heading font-bold mb-3">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href={`tel:${CONTACT.phoneHref}`}
                    data-testid="footer-phone"
                    className="inline-flex items-center gap-2 hover:text-white"
                  >
                    <Phone size={14} className="text-accent" />
                    {CONTACT.phone}
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${CONTACT.email}`}
                    data-testid="footer-email"
                    className="inline-flex items-center gap-2 hover:text-white break-all"
                  >
                    <Mail size={14} className="text-accent" />
                    {CONTACT.email}
                  </a>
                </li>
                <li>
                  <a
                    href={`https://wa.me/${CONTACT.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="footer-whatsapp"
                    className="inline-flex items-center gap-2 hover:text-white"
                  >
                    <MessageCircle size={14} className="text-accent" />
                    WhatsApp chat
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/50">
            <p>© {new Date().getFullYear()} SlotNow. All rights reserved.</p>
            <p>Made in India — for Indian queues.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
