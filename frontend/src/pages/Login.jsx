import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Phone, KeyRound, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { sendOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [demoOtp, setDemoOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone)) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    setLoading(true);
    try {
      const res = await sendOtp(phone, "customer");
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
    if (!/^\d{4,6}$/.test(otp)) {
      toast.error("Enter the OTP");
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(phone, otp, "customer");
      toast.success("Welcome to SlotNow");
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-forest-faint text-forest rounded-full text-xs font-bold uppercase tracking-widest mb-6">
            <Sparkles size={14} strokeWidth={2.5} />
            SlotNow
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl font-extrabold tracking-tighter text-ink leading-tight">
            Book slots without the wait
          </h1>
          <p className="mt-3 text-ink-soft text-base">
            Salons, clinics, tutors & more. All in one queue.
          </p>
        </div>

        <div className="bg-white border border-cream-300 rounded-2xl p-6 shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
          {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <label className="block text-sm font-semibold text-ink mb-1.5">
                Mobile number
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
                  placeholder="10-digit mobile"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="w-full bg-white border border-cream-300 rounded-xl pl-24 pr-4 py-3.5 text-base text-ink placeholder:text-ink-muted focus:ring-2 focus:ring-forest/20 focus:border-forest outline-none transition-all font-medium"
                  autoFocus
                />
              </div>
              <button
                data-testid="login-send-otp-btn"
                type="submit"
                disabled={loading || phone.length !== 10}
                className="w-full flex items-center justify-center gap-2 bg-forest hover:bg-forest-dark disabled:bg-forest/40 text-cream-100 py-3.5 rounded-xl font-bold transition-colors"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    Continue <ArrowRight size={18} strokeWidth={2.5} />
                  </>
                )}
              </button>
              <p className="text-center text-xs text-ink-muted mt-2">
                By continuing, you agree to our Terms & Privacy
              </p>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <p className="text-sm text-ink-soft">
                  We sent an OTP to <span className="font-semibold text-ink">+91 {phone}</span>
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
                  Change number
                </button>
              </div>

              {demoOtp && (
                <div className="bg-forest-faint border border-forest/10 rounded-xl px-3 py-2 text-xs text-forest">
                  <strong>Demo OTP:</strong> {demoOtp}
                </div>
              )}

              <label className="block text-sm font-semibold text-ink mb-1.5">Enter OTP</label>
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
                {loading ? <Loader2 size={18} className="animate-spin" /> : "Verify & Login"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
