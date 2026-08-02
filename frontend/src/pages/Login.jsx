import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n";
import { useBackendCapabilities } from "@/hooks/useBackendCapabilities";
import { SlotNowMark } from "@/components/SlotNowLogo";
import api from "@/lib/api";
import {
  Phone,
  KeyRound,
  ArrowRight,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  X,
  User,
  Store,
  UserCog,
  ShieldQuestion,
  Languages,
  Mail,
} from "lucide-react";
import { toast } from "sonner";

const ROLE_TILES = [
  { k: "customer", labelKey: "role_customer", Icon: User },
  { k: "provider", labelKey: "role_provider", Icon: Store },
  { k: "receptionist", labelKey: "role_assistant", Icon: UserCog },
  { k: "admin", labelKey: "role_admin", Icon: ShieldQuestion },
];

export default function Login() {
  const { sendOtp, verifyOtp, pinLogin, loginEmail, setPin: setPinApi } = useAuth();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;

  // Capture ?ref=<phone> from URL — persists across form steps
  const [refCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) sessionStorage.setItem("slotnow_ref", ref);
    return ref || sessionStorage.getItem("slotnow_ref") || null;
  });

  const [role, setRole] = useState(() => {
    const r = new URLSearchParams(window.location.search).get("role");
    return ["customer", "provider", "receptionist", "admin"].includes(r) ? r : "customer";
  });
  const [mode, setMode] = useState("otp"); // "otp" | "pin" | "email"
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [demoOtp, setDemoOtp] = useState("");
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const validPhone = /^\d{10}$/.test(phone);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Only render the email-login toggle when the backend actually exposes the endpoint.
  const caps = useBackendCapabilities();
  const hasEmailLogin = caps.has("/api/auth/login-email");

  const homeForRole = async (u) => {
    switch (u?.role) {
      case "provider": {
        // Force onboarding when profile is missing OR incomplete (empty business_name).
        try {
          const { data } = await api.get("/providers/me/profile");
          if (!data?.business_name || String(data.business_name).trim() === "") {
            return "/provider/onboarding";
          }
          return "/provider";
        } catch (e) {
          if (e.response?.status === 404) return "/provider/onboarding";
          return "/provider";
        }
      }
      case "admin":
        return "/admin";
      case "receptionist":
        return "/receptionist";
      default:
        return "/home";
    }
  };

  const navigateAfter = async (u) => {
    const target = await homeForRole(u);
    if (from && from !== "/login") navigate(from, { replace: true });
    else navigate(target, { replace: true });
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!validPhone) return toast.error("Enter a valid 10-digit phone");
    setLoading(true);
    try {
      const res = await sendOtp(phone, role);
      if (res.demo_otp) setDemoOtp(res.demo_otp);
      toast.success("OTP sent");
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(otp)) return toast.error("Enter the OTP");
    setLoading(true);
    try {
      const res = await verifyOtp(phone, otp, role, refCode);
      toast.success("Welcome to SlotNow");
      // Consumed — clear stored ref
      sessionStorage.removeItem("slotnow_ref");
      if (!res.user?.has_pin && res.user?.role !== "admin") {
        setStep(3);
      } else {
        await navigateAfter(res.user);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handlePinLogin = async (e) => {
    e.preventDefault();
    if (!validPhone) return toast.error("Enter phone first");
    if (!/^\d{4,6}$/.test(pin)) return toast.error("Enter your PIN");
    setLoading(true);
    try {
      const res = await pinLogin(phone, pin, role);
      toast.success("Welcome back");
      const target = await homeForRole(res.user);
      navigate(target, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Invalid PIN");
    } finally {
      setLoading(false);
    }
  };

  const handleSetPin = async (e) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(newPin)) return toast.error("PIN must be 4-6 digits");
    setLoading(true);
    try {
      await setPinApi(newPin);
      toast.success("PIN set");
      const u = JSON.parse(localStorage.getItem("slotnow_user") || "{}");
      await navigateAfter(u);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to set PIN");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!validEmail) return toast.error("Enter a valid email");
    if (!emailPassword) return toast.error("Enter your password");
    setLoading(true);
    try {
      const res = await loginEmail(email, emailPassword);
      toast.success("Welcome to SlotNow");
      sessionStorage.removeItem("slotnow_ref");
      await navigateAfter(res.user);
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) {
        toast.error("Email login is not enabled on this backend build — please use phone + OTP");
      } else {
        toast.error(err.response?.data?.detail || "Incorrect email or password");
      }
    } finally {
      setLoading(false);
    }
  };

  const skipSetPin = async () => {
    const u = JSON.parse(localStorage.getItem("slotnow_user") || "{}");
    await navigateAfter(u);
  };

  return (
    <div className="min-h-screen bg-cream text-ink">
      <div className="grid lg:grid-cols-2 min-h-screen">
        {/* Marketing panel (desktop only) */}
        <aside className="hidden lg:flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-forest via-forest-dark to-ink text-white p-12 xl:p-16">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-accent/25 blur-3xl" aria-hidden="true" />
          <div className="absolute -bottom-32 -left-16 w-[28rem] h-[28rem] rounded-full bg-white/5 blur-3xl" aria-hidden="true" />
          <a href="/" className="relative inline-flex items-center gap-2.5 self-start">
            <img src="/logo.png" alt="SlotNow" className="h-10 w-10 object-contain bg-white rounded-lg p-1" />
            <span className="font-heading font-extrabold text-2xl tracking-tight">
              <span className="text-white">Slot</span>
              <span className="text-accent">Now</span>
            </span>
          </a>
          <div className="relative max-w-md">
            <h2 className="font-heading text-4xl xl:text-5xl font-black leading-[1.05] tracking-tight">
              Book appointments <br />
              <span className="text-accent">in seconds.</span>
            </h2>
            <p className="mt-4 text-white/75 leading-relaxed">
              Log in to manage your bookings, queue, and dashboard — or book your next
              doctor / salon / garage slot from anywhere in India.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-white/80">
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-accent" /> Real-time queue and slot updates</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-accent" /> Verified providers, zero waiting</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-accent" /> One app for customers, providers, admins</li>
            </ul>
          </div>
          <p className="relative text-xs text-white/50">© {new Date().getFullYear()} SlotNow · Made in India</p>
        </aside>

        {/* Form panel */}
        <main className="flex items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-md">
            {/* Mobile brand (visible on small screens only) */}
            <div className="lg:hidden flex flex-col items-center gap-1 mb-6">
              <SlotNowMark size={72} />
              <span className="font-heading font-extrabold tracking-tight text-3xl mt-1">
                <span className="text-forest">Slot</span>
                <span className="text-accent">Now</span>
              </span>
              <p className="text-sm text-ink-soft">{t("book_appointments_seconds")}</p>
            </div>
            <div className="bg-white border border-cream-300 lg:border-transparent lg:bg-transparent rounded-3xl p-6 sm:p-8 lg:p-0 shadow-[0_4px_24px_rgba(29,46,91,0.06)] lg:shadow-none relative">
              <button
                data-testid="login-lang-toggle"
                onClick={() => setLang(lang === "hi" ? "en" : "hi")}
                className="absolute top-4 right-4 lg:top-0 lg:right-0 flex items-center gap-1 bg-cream-200 hover:bg-cream-300 text-ink text-xs font-bold px-2.5 py-1.5 rounded-full transition-colors"
              >
                <Languages size={12} strokeWidth={2.5} />
                {lang === "hi" ? "हिं" : "EN"}
              </button>

              <div className="hidden lg:block mb-6">
                <h1 className="font-heading text-3xl font-black text-ink">Welcome back</h1>
                <p className="text-sm text-ink-muted mt-1">Sign in to your SlotNow account</p>
              </div>

          {step === 1 && (
            <>
              {refCode && (
                <div
                  data-testid="referral-banner"
                  className="bg-accent-faint border border-accent/30 rounded-xl px-3 py-2 text-xs text-accent-dark mb-3 flex items-center gap-2"
                >
                  <span>🎁</span> Referred by <strong>+91 {refCode}</strong>
                </div>
              )}
              {/* Role tiles - 2x2 grid */}
              <div className="mb-5">
                <p className="text-sm font-bold text-ink mb-2">{t("im_a")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_TILES.map(({ k, labelKey, Icon }) => {
                    const active = role === k;
                    return (
                      <button
                        key={k}
                        data-testid={`login-role-${k}`}
                        type="button"
                        onClick={() => setRole(k)}
                        className={`flex flex-col items-center gap-1.5 rounded-2xl py-3.5 px-2 border-2 transition-all ${
                          active
                            ? "bg-forest-faint border-forest ring-2 ring-forest/10"
                            : "bg-cream-200 border-transparent hover:border-cream-300"
                        }`}
                      >
                        <Icon
                          size={20}
                          strokeWidth={2}
                          className={active ? "text-forest" : "text-ink-soft"}
                        />
                        <span
                          className={`text-xs font-bold text-center leading-tight ${
                            active ? "text-forest" : "text-ink-soft"
                          }`}
                        >
                          {t(labelKey)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={mode === "otp" ? handleSendOtp : mode === "email" ? handleEmailLogin : handlePinLogin} className="space-y-3">
                {mode === "email" ? (
                  <>
                    <label className="block text-sm font-semibold text-ink">Email</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                      <input
                        data-testid="login-email-input"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value.trim())}
                        className="w-full bg-white border border-cream-300 rounded-xl pl-10 pr-4 py-3.5 text-base text-ink placeholder:text-ink-muted focus:ring-2 focus:ring-forest/20 focus:border-forest outline-none font-medium"
                        autoFocus
                      />
                    </div>
                    <label className="block text-sm font-semibold text-ink pt-1">Password</label>
                    <div className="relative">
                      <LockKeyhole size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                      <input
                        data-testid="login-email-password-input"
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={emailPassword}
                        onChange={(e) => setEmailPassword(e.target.value)}
                        className="w-full bg-white border border-cream-300 rounded-xl pl-10 pr-4 py-3.5 text-base text-ink placeholder:text-ink-muted focus:ring-2 focus:ring-forest/20 focus:border-forest outline-none font-medium"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <label className="block text-sm font-semibold text-ink">
                      {t("mobile_number")}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 pr-3 flex items-center border-r border-cream-300 pointer-events-none">
                        <Phone size={16} className="text-ink-soft mr-2" />
                        <span className="text-ink font-semibold">+91</span>
                      </div>
                      <input
                        data-testid="login-phone-input"
                        type="tel"
                        inputMode="numeric"
                        placeholder={t("ten_digit")}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        className="w-full bg-white border border-cream-300 rounded-xl pl-24 pr-4 py-3.5 text-base text-ink placeholder:text-ink-muted focus:ring-2 focus:ring-forest/20 focus:border-forest outline-none font-medium"
                        autoFocus
                      />
                    </div>
                  </>
                )}

                {mode === "pin" && (
                  <>
                    <label className="block text-sm font-semibold text-ink pt-1">
                      {t("enter_pin")}
                    </label>
                    <div className="relative">
                      <LockKeyhole size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                      <input
                        data-testid="login-pin-input"
                        type="password"
                        inputMode="numeric"
                        placeholder="••••"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="w-full bg-white border border-cream-300 rounded-xl pl-10 pr-4 py-3.5 text-lg tracking-[0.4em] font-bold text-ink placeholder:text-ink-muted placeholder:tracking-normal focus:ring-2 focus:ring-forest/20 focus:border-forest outline-none"
                      />
                    </div>
                  </>
                )}

                <button
                  data-testid={mode === "otp" ? "login-send-otp-btn" : mode === "email" ? "login-email-submit-btn" : "login-pin-submit-btn"}
                  type="submit"
                  disabled={
                    loading ||
                    (mode === "email" ? !validEmail || !emailPassword : !validPhone) ||
                    (mode === "pin" && pin.length < 4)
                  }
                  className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark disabled:bg-accent/40 text-white py-3.5 rounded-xl font-bold transition-colors shadow-[0_6px_20px_rgba(249,115,22,0.25)]"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : mode === "otp" ? (
                    <>
                      {t("continue")} <ArrowRight size={18} strokeWidth={2.5} />
                    </>
                  ) : mode === "email" ? (
                    "Sign in"
                  ) : (
                    t("verify_login")
                  )}
                </button>
              </form>

              <button
                data-testid="login-mode-toggle"
                type="button"
                onClick={() => {
                  setMode(mode === "otp" ? "pin" : "otp");
                  setOtp("");
                  setPin("");
                }}
                className="w-full mt-3 text-sm font-semibold text-forest hover:underline flex items-center justify-center gap-1.5"
              >
                {mode === "otp" ? <LockKeyhole size={14} /> : <Phone size={14} />}
                {mode === "otp" ? t("login_with_pin") : t("login_with_otp")}
              </button>

              {/* Email/password fallback — only shown when the backend actually
                  exposes the login-email endpoint. Otherwise clicking it 404's. */}
              {hasEmailLogin && (
                <button
                  data-testid="login-email-toggle-btn"
                  type="button"
                  onClick={() => {
                    setMode(mode === "email" ? "otp" : "email");
                    setEmailPassword("");
                  }}
                  className="w-full mt-2 text-xs font-semibold text-ink-soft hover:text-forest hover:underline flex items-center justify-center gap-1.5"
                >
                  <Mail size={12} />
                  {mode === "email" ? "Use phone instead" : "Sign in with email & password"}
                </button>
              )}
              <p className="text-center text-xs text-ink-muted mt-3">{t("terms_note")}</p>
            </>
          )}

          {step === 2 && (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <p className="text-sm text-ink-soft">
                  {t("otp_sent_to")} <span className="font-semibold text-ink">+91 {phone}</span>
                </p>
                <button
                  data-testid="login-change-phone-btn"
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setOtp("");
                    setDemoOtp("");
                  }}
                  className="text-xs font-semibold text-forest hover:underline mt-1"
                >
                  {t("change_number")}
                </button>
              </div>

              {demoOtp && (
                <div className="bg-forest-faint border border-forest/10 rounded-xl px-3 py-2 text-xs text-forest">
                  <strong>{t("demo_otp")}:</strong> {demoOtp}
                </div>
              )}

              <label className="block text-sm font-semibold text-ink">{t("enter_otp")}</label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input
                  data-testid="login-otp-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="1234"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="w-full bg-white border border-cream-300 rounded-xl pl-10 pr-4 py-3.5 text-lg tracking-[0.4em] text-ink placeholder:text-ink-muted placeholder:tracking-normal font-bold focus:ring-2 focus:ring-forest/20 focus:border-forest outline-none"
                  autoFocus
                />
              </div>
              <button
                data-testid="login-verify-otp-btn"
                type="submit"
                disabled={loading || otp.length < 4}
                className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark disabled:bg-accent/40 text-white py-3.5 rounded-xl font-bold transition-colors shadow-[0_6px_20px_rgba(249,115,22,0.25)]"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : t("verify_login")}
              </button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleSetPin} className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-forest-faint rounded-xl flex items-center justify-center text-forest shrink-0">
                  <ShieldCheck size={20} strokeWidth={2} />
                </div>
                <div>
                  <p className="font-heading font-bold text-ink text-lg leading-tight">
                    {t("set_pin_title")}
                  </p>
                  <p className="text-xs text-ink-soft mt-1">{t("set_pin_sub")}</p>
                </div>
                <button
                  data-testid="setpin-close-btn"
                  type="button"
                  onClick={skipSetPin}
                  className="p-1 rounded-lg hover:bg-cream-200 text-ink-soft shrink-0"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="relative">
                <LockKeyhole size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input
                  data-testid="setpin-input"
                  type="password"
                  inputMode="numeric"
                  placeholder="4-6 digit PIN"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full bg-white border border-cream-300 rounded-xl pl-10 pr-4 py-3.5 text-lg tracking-[0.4em] font-bold text-ink placeholder:text-ink-muted placeholder:tracking-normal focus:ring-2 focus:ring-forest/20 focus:border-forest outline-none"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  data-testid="setpin-skip-btn"
                  type="button"
                  onClick={skipSetPin}
                  className="flex-1 bg-white border border-cream-300 text-ink py-3 rounded-xl font-bold hover:bg-cream-200"
                >
                  {t("skip")}
                </button>
                <button
                  data-testid="setpin-save-btn"
                  type="submit"
                  disabled={loading || newPin.length < 4}
                  className="flex-1 bg-accent hover:bg-accent-dark disabled:bg-accent/40 text-white py-3 rounded-xl font-bold"
                >
                  {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : t("save_pin")}
                </button>
              </div>
            </form>
          )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
