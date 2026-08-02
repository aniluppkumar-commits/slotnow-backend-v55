import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Crown, Check, Sparkles, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpay() {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = CHECKOUT_SRC;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function fmt(paise) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

/**
 * Compact "Upgrade to Pro" card + full plan-selection modal.
 * Used only on provider dashboard.
 */
export default function SubscriptionUpgrade({ providerName, providerPhone }) {
  const [plans, setPlans] = useState([]);
  const [mySub, setMySub] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null); // plan id currently paying

  useEffect(() => {
    api.get("/subscriptions/plans").then((r) => setPlans(r.data || [])).catch(() => {});
    api
      .get("/subscriptions/me")
      .then((r) => setMySub(r.data))
      .catch(() => {});
  }, []);

  const startCheckout = async (plan) => {
    setBusy(plan.id);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Failed to load Razorpay");
      const { data } = await api.post("/subscriptions/create-order", { plan_id: plan.id });
      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        order_id: data.order_id,
        name: "SlotNow",
        description: `${plan.name} subscription`,
        prefill: { name: providerName || "", contact: providerPhone || "" },
        theme: { color: "#1D2E5B" },
        handler: async (res) => {
          try {
            await api.post("/subscriptions/verify", {
              razorpay_order_id: res.razorpay_order_id,
              razorpay_payment_id: res.razorpay_payment_id,
              razorpay_signature: res.razorpay_signature,
            });
            toast.success("Subscription activated!");
            setOpen(false);
            api.get("/subscriptions/me").then((r) => setMySub(r.data));
          } catch (e) {
            toast.error(e?.response?.data?.detail || "Verification failed");
          }
        },
        modal: {
          ondismiss: () => setBusy(null),
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (resp) => {
        toast.error(resp?.error?.description || "Payment failed");
        setBusy(null);
      });
      rzp.open();
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message || "Could not start payment");
    } finally {
      setBusy(null);
    }
  };

  const active = mySub?.active;
  const sub = mySub?.subscription;
  const expiresPretty = sub?.expires_at ? new Date(sub.expires_at).toLocaleDateString("en-IN") : "";

  return (
    <>
      <div
        data-testid="provider-subscription-card"
        className={`rounded-2xl p-4 border ${
          active
            ? "bg-emerald-50 border-emerald-200"
            : "bg-gradient-to-br from-forest to-forest-dark text-white border-transparent"
        }`}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              active ? "bg-emerald-200 text-emerald-800" : "bg-accent text-white"
            }`}
          >
            <Crown size={16} />
          </div>
          <div className="flex-1">
            <p className={`font-heading font-bold text-sm ${active ? "text-emerald-900" : "text-white"}`}>
              {active ? `${(plans.find((p) => p.id === sub.plan_id)?.name) || "Pro"} active` : "Upgrade to Pro"}
            </p>
            <p className={`text-[11px] ${active ? "text-emerald-800" : "text-white/70"}`}>
              {active ? `Renews on ${expiresPretty}` : "Unlock unlimited bookings + featured placement"}
            </p>
          </div>
        </div>
        {!active && (
          <button
            onClick={() => setOpen(true)}
            data-testid="provider-upgrade-btn"
            className="w-full mt-2 py-2 rounded-xl bg-white text-forest font-bold text-sm hover:bg-cream"
          >
            View plans
          </button>
        )}
      </div>

      {open && !active && (
        <div
          className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-2xl p-5 sm:p-6 shadow-2xl animate-fade-up max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-heading text-xl font-black text-ink">Choose a plan</h3>
                <p className="text-sm text-ink-muted">Provider subscription — no charge to customers.</p>
              </div>
              <button
                onClick={() => !busy && setOpen(false)}
                className="text-ink-muted hover:text-ink text-2xl leading-none px-2"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className="border-2 border-cream-300 rounded-2xl p-4 flex flex-col hover:border-forest hover:shadow-lg transition-all"
                >
                  <div className="flex items-center gap-1 text-accent mb-1">
                    <Sparkles size={12} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{p.name}</span>
                  </div>
                  <p className="font-heading text-2xl font-black text-ink mb-1">{fmt(p.price_paise)}</p>
                  <p className="text-xs text-ink-muted mb-3">valid {p.duration_days} days</p>
                  <ul className="space-y-1.5 mb-4 flex-1">
                    {(p.features || []).map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-ink-soft">
                        <Check size={12} className="text-forest mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => startCheckout(p)}
                    disabled={!!busy}
                    data-testid={`plan-pay-${p.id}`}
                    className="w-full py-2.5 rounded-xl bg-forest text-white font-bold text-sm hover:bg-forest-dark disabled:opacity-60"
                  >
                    {busy === p.id ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 size={13} className="animate-spin" /> Please wait…
                      </span>
                    ) : (
                      "Pay & activate"
                    )}
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-ink-muted mt-4 text-center">
              Secure payments powered by Razorpay. Cancel anytime from your dashboard.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
