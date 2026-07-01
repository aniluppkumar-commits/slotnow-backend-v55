import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n";
import { Phone, KeyRound, ArrowRight, Sparkles, Loader2, LockKeyhole, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { sendOtp, verifyOtp, pinLogin, setPin: setPinApi } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;

  const [role, setRole] = useState("customer");
  const [mode, setMode] = useState("otp"); // 'otp' | 'pin'
  const [step, setStep] = useState(1); // 1=phone, 2=otp/pin, 3=setPinPrompt
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [demoOtp, setDemoOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const validPhone = /^\d{10}$/.test(phone);

  const navigateAfter = (u) => {
    if (from && from !== "/login") return navigate(from, { replace: true });
    if (u?.role === "provider") {
      navigate(u.linked_provider_id ? "/provider" : "/provider/onboarding", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
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
    if (!/^\d{4,6}$/.test(otp)) return toast.error("Enter the OTP");
    setLoading(true);
    try {
      const res = await verifyOtp(phone, otp, role);
      toast.success("Welcome to SlotNow");
      // Prompt to set PIN if not yet set
      if (!res.user?.has_pin) {
        setStep(3);
      } else {
        navigateAfter(res.user);
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
      navigateAfter(res.user);
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
      navigateAfter(u);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to set PIN");
    } finally {
      setLoading(false);
    }
  };

  const skipSetPin = () => {
    const u = JSON.parse(localStorage.getItem("slotnow_user") || "{}");
    navigateAfter(u);
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-forest-faint text-forest rounded-full text-xs font-bold uppercase tracking-widest mb-6">
            <Sparkles size={14} strokeWidth={2.5} />
            SlotNow
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl font-extrabold tracking-tighter text-ink leading-tight">
            {t("app_tagline")}
          </h1>
          <p className="mt-3 text-ink-soft text-base">{t("app_subtitle")}</p>
        </div>

        {/* Role toggle */}
        {step === 1 && (
          <div className="mb-4">
            <label className="block text-[10px] uppercase tracking-widest font-bold text-ink-soft text-center mb-2">
              {t("im_a")}
            </label>
            <div className="flex gap-1 bg-cream-200 rounded-xl p-1">
              {[
                { k: "customer", label: t("role_customer") },
                { k: "provider", label: t("role_provider") },
              ].map(({ k, label }) => (
                <button
                  key={k}
                  data-testid={`login-role-${k}`}
                  type="button"
                  onClick={() => setRole(k)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                    role === k ? "bg-white text-forest shadow-sm" : "text-ink-soft"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white border border-cream-300 rounded-2xl p-6 shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
          {step === 1 && (
            <>
              <form onSubmit={mode === "otp" ? handleSendOtp : handlePinLogin} className="space-y-4">
                <label className="block text-sm font-semibold text-ink mb-1.5">
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
                    className="w-full bg-white border border-cream-300 rounded-xl pl-24 pr-4 py-3.5 text-base text-ink placeholder:text-ink-muted focus:ring-2 focus:ring-forest/20 focus:border-forest outline-none transition-all font-medium"
                    autoFocus
                  />
                </div>

                {mode === "pin" && (
                  <>
                    <label className="block text-sm font-semibold text-ink mb-1.5">{t("enter_pin")}</label>
                    <div className="relative">
                      <LockKeyhole
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
                      />
                      <input
                        data-testid="login-pin-input"
                        type="password"
                        inputMode="numeric"
                        placeholder="••••"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="w-full bg-white border border-cream-300 rounded-xl pl-10 pr-4 py-3.5 text-lg tracking-[0.4em] font-bold text-ink placeholder:text-ink-muted placeholder:tracking-normal focus:ring-2 focus:ring-forest/20 focus:border-forest outline-none transition-all"
                      />
                    </div>
                  </>
                )}

                <button
                  data-testid={mode === "otp" ? "login-send-otp-btn" : "login-pin-submit-btn"}
                  type="submit"
                  disabled={loading || !validPhone || (mode === "pin" && pin.length < 4)}
                  className="w-full flex items-center justify-center gap-2 bg-forest hover:bg-forest-dark disabled:bg-forest/40 text-cream-100 py-3.5 rounded-xl font-bold transition-colors"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : mode === "otp" ? (
                    <>
                      {t("continue")} <ArrowRight size={18} strokeWidth={2.5} />
                    </>
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

              <label className="block text-sm font-semibold text-ink mb-1.5">{t("enter_otp")}</label>
              <div className="relative">
                <KeyRound
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
                />
                <input
                  data-testid="login-otp-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full bg-white border border-cream-300 rounded-xl pl-10 pr-4 py-3.5 text-lg tracking-[0.4em] text-ink placeholder:text-ink-muted placeholder:tracking-normal font-bold focus:ring-2 focus:ring-forest/20 focus:border-forest outline-none transition-all"
                  autoFocus
                />
              </div>
              <button
                data-testid="login-verify-otp-btn"
                type="submit"
                disabled={loading || otp.length < 4}
                className="w-full flex items-center justify-center gap-2 bg-forest hover:bg-forest-dark disabled:bg-forest/40 text-cream-100 py-3.5 rounded-xl font-bold transition-colors"
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
                  className="w-full bg-white border border-cream-300 rounded-xl pl-10 pr-4 py-3.5 text-lg tracking-[0.4em] font-bold text-ink placeholder:text-ink-muted placeholder:tracking-normal focus:ring-2 focus:ring-forest/20 focus:border-forest outline-none transition-all"
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
                  className="flex-1 bg-forest hover:bg-forest-dark disabled:bg-forest/40 text-cream-100 py-3 rounded-xl font-bold"
                >
                  {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : t("save_pin")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
