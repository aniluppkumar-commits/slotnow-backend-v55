import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { Loader2, Save, MessageSquareText, CreditCard, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

/**
 * Admin → Settings screens for SMS + Payment providers.
 *
 * Fixes the "page goes blank on Save" bug from production by:
 *   (a) explicit structured forms per known provider (no more naive
 *       Object.keys iteration that could crash on unexpected shapes),
 *   (b) input types and value coercion pinned to the API contract,
 *   (c) full try/catch with actionable toasts on every branch,
 *   (d) plus the app-level <ErrorBoundary> in App.js catches any residual
 *       render error and shows a Reload button instead of a white screen.
 */

const SMS_PROVIDERS = [
  { value: "mock", label: "Mock (dev only — always returns 123456)" },
  { value: "msg91", label: "MSG91" },
  { value: "twilio", label: "Twilio" },
];

const PAYMENT_PROVIDERS = [
  { value: "mock", label: "Mock (dev only)" },
  { value: "razorpay", label: "Razorpay" },
  { value: "stripe", label: "Stripe" },
];

// Default shapes we merge into whatever the API returns, so the form
// always renders every field even if the backend omits some keys.
const SMS_DEFAULTS = {
  provider: "mock",
  api_key: "",
  sender_id: "",
  dlt_template_id: "",
  enabled: false,
};

const PAYMENT_DEFAULTS = {
  provider: "mock",
  api_key: "",
  api_secret: "",
  webhook_secret: "",
  enabled: false,
};

export default function AdminSettings() {
  const { kind } = useParams(); // 'sms' or 'payment'
  const isPayment = kind === "payment";

  const endpoint = isPayment ? "/admin/settings/payment" : "/admin/settings/sms";
  const title = isPayment ? "Payment settings" : "SMS settings";
  const defaults = isPayment ? PAYMENT_DEFAULTS : SMS_DEFAULTS;

  const [form, setForm] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(endpoint);
        if (mounted) setForm({ ...defaults, ...(data || {}) });
      } catch (err) {
        console.error(`Load ${endpoint} failed:`, err);
        toast.error(err?.response?.data?.detail || "Failed to load settings");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(endpoint, form);
      // Merge the server-authoritative response back into state so the UI
      // stays consistent (e.g., if the backend normalizes provider name).
      setForm({ ...defaults, ...(data || form) });
      toast.success("Settings saved");
    } catch (err) {
      console.error(`Save ${endpoint} failed:`, err);
      const detail = err?.response?.data?.detail;
      // Pydantic validation errors come back as an array — stringify safely.
      const message =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
          ? detail.map((d) => d.msg || JSON.stringify(d)).join(" · ")
          : "Failed to save settings";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell title={title} showBack>
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-forest" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={title} showBack>
      <div className="px-4 sm:px-6 pt-4 pb-8 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 text-ink-soft">
          {isPayment ? (
            <CreditCard size={18} strokeWidth={2.5} />
          ) : (
            <MessageSquareText size={18} strokeWidth={2.5} />
          )}
          <h2 className="font-heading font-bold text-lg text-ink">{title}</h2>
        </div>

        <div className="bg-white border border-cream-300 rounded-2xl p-5 space-y-4">
          {/* Provider selector */}
          <Field label="Provider">
            <select
              data-testid="admin-setting-provider"
              value={form.provider}
              onChange={(e) => set("provider", e.target.value)}
              className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink font-medium outline-none focus:ring-2 focus:ring-forest/20"
            >
              {(isPayment ? PAYMENT_PROVIDERS : SMS_PROVIDERS).map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>

          {/* Enabled toggle */}
          <Field label="Enabled" hint="When ON, live requests are sent to the provider above. When OFF, requests are rejected.">
            <button
              type="button"
              data-testid="admin-setting-enabled"
              onClick={() => set("enabled", !form.enabled)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${
                form.enabled ? "bg-emerald-100 text-emerald-800" : "bg-cream-200 text-ink-soft"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${form.enabled ? "bg-emerald-500" : "bg-ink-muted"}`}
              />
              {form.enabled ? "ON" : "OFF"}
            </button>
          </Field>

          {isPayment ? (
            <>
              <Field label="Key ID (Razorpay: RAZORPAY_KEY_ID)">
                <input
                  data-testid="admin-setting-api-key"
                  type="text"
                  value={form.api_key || ""}
                  onChange={(e) => set("api_key", e.target.value)}
                  placeholder="rzp_live_xxx or rzp_test_xxx"
                  className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink font-medium outline-none focus:ring-2 focus:ring-forest/20 font-mono text-sm"
                />
              </Field>
              <Field label="Key Secret (Razorpay: RAZORPAY_KEY_SECRET)" hint="Never shared with clients. Stored server-side.">
                <input
                  data-testid="admin-setting-api-secret"
                  type="password"
                  value={form.api_secret || ""}
                  onChange={(e) => set("api_secret", e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink font-medium outline-none focus:ring-2 focus:ring-forest/20 font-mono text-sm"
                />
              </Field>
              <Field label="Webhook secret (optional)">
                <input
                  data-testid="admin-setting-webhook-secret"
                  type="password"
                  value={form.webhook_secret || ""}
                  onChange={(e) => set("webhook_secret", e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink font-medium outline-none focus:ring-2 focus:ring-forest/20 font-mono text-sm"
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="API key (MSG91: authkey)">
                <input
                  data-testid="admin-setting-api-key"
                  type="password"
                  value={form.api_key || ""}
                  onChange={(e) => set("api_key", e.target.value)}
                  placeholder="Enter MSG91 API key"
                  className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink font-medium outline-none focus:ring-2 focus:ring-forest/20 font-mono text-sm"
                />
              </Field>
              <Field label="Sender ID">
                <input
                  data-testid="admin-setting-sender-id"
                  type="text"
                  value={form.sender_id || ""}
                  onChange={(e) => set("sender_id", e.target.value.toUpperCase().slice(0, 6))}
                  maxLength={6}
                  placeholder="6-character sender (e.g. SLOTNW)"
                  className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink font-medium outline-none focus:ring-2 focus:ring-forest/20 uppercase font-mono"
                />
              </Field>
              <Field label="DLT template ID" hint="19-digit DLT registered template used to deliver the OTP.">
                <input
                  data-testid="admin-setting-dlt-template-id"
                  type="text"
                  value={form.dlt_template_id || ""}
                  onChange={(e) => set("dlt_template_id", e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  placeholder="1207178359126464853"
                  className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink font-medium outline-none focus:ring-2 focus:ring-forest/20 font-mono text-sm"
                />
              </Field>
            </>
          )}
        </div>

        {/* Warning banner — currently the backend does NOT actually call MSG91/Razorpay yet.
            This is a heads-up so admin doesn't think the toggle alone triggers live sends. */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" strokeWidth={2.5} />
          <div className="text-xs text-amber-900 leading-snug">
            <p className="font-bold">Backend integration pending.</p>
            <p>
              {isPayment
                ? "Payment credentials are stored, but Razorpay checkout is not yet wired in the backend. Coordinate with Emergent Support to enable live payments."
                : "Credentials are stored, but the backend still returns a demo OTP (123456). Coordinate with Emergent Support to enable live SMS via MSG91."}
            </p>
          </div>
        </div>

        <button
          data-testid="admin-settings-save-btn"
          onClick={save}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-accent text-white py-3 rounded-xl font-bold hover:bg-accent-dark transition-colors disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Save size={16} /> Save {title.toLowerCase()}
            </>
          )}
        </button>
      </div>
    </AppShell>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted block">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-ink-soft leading-snug">{hint}</p>}
    </div>
  );
}
