import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { Loader2, Save, MessageSquareText, CreditCard, Send, CheckCircle2 } from "lucide-react";
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
  { value: "mock", label: "Mock (dev only — no SMS sent)" },
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
  dlt_entity_id: "",
  dlt_variable_name: "num",
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
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);

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

  const sendTestSms = async () => {
    if (!/^\d{10}$/.test(testPhone)) {
      toast.error("Enter a 10-digit phone number");
      return;
    }
    setTesting(true);
    try {
      const { data } = await api.post("/admin/settings/sms/test-send", { phone: testPhone });
      toast.success(data?.message || `Test SMS sent to ${testPhone}`);
    } catch (err) {
      console.error("Test SMS failed:", err);
      toast.error(err?.response?.data?.detail || "Failed to send test SMS");
    } finally {
      setTesting(false);
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
              <Field label="DLT entity ID (Principal Entity ID / PEID)" hint="19-digit DLT-registered Principal Entity ID issued by your telecom operator.">
                <input
                  data-testid="admin-setting-dlt-entity-id"
                  type="text"
                  value={form.dlt_entity_id || ""}
                  onChange={(e) => set("dlt_entity_id", e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  placeholder="1101234567890123456"
                  className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink font-medium outline-none focus:ring-2 focus:ring-forest/20 font-mono text-sm"
                />
              </Field>
              <Field label="DLT variable name" hint="Variable placeholder name inside the DLT template (default: 'num').">
                <input
                  data-testid="admin-setting-dlt-variable-name"
                  type="text"
                  value={form.dlt_variable_name || ""}
                  onChange={(e) => set("dlt_variable_name", e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                  placeholder="num"
                  className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink font-medium outline-none focus:ring-2 focus:ring-forest/20 font-mono text-sm"
                />
              </Field>
            </>
          )}
        </div>

        {/* Live status indicator — reflects the actual toggle+provider combination.
            Prior iteration showed a stale "backend pending" warning; the backend team
            has since shipped MSG91 + Razorpay, so we now show real, actionable status. */}
        {form.enabled && form.provider !== "mock" ? (
          <div
            data-testid="admin-settings-status-live"
            className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-start gap-2"
          >
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" strokeWidth={2.5} />
            <div className="text-xs text-emerald-900 leading-snug">
              <p className="font-bold">Live mode — {form.provider.toUpperCase()}.</p>
              <p>
                {isPayment
                  ? "Real payments are being processed via this gateway."
                  : "Real OTPs are being sent via this gateway. Verify with the test button below."}
              </p>
            </div>
          </div>
        ) : (
          <div
            data-testid="admin-settings-status-off"
            className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2"
          >
            <MessageSquareText size={16} className="text-amber-600 shrink-0 mt-0.5" strokeWidth={2.5} />
            <div className="text-xs text-amber-900 leading-snug">
              <p className="font-bold">
                {form.provider === "mock"
                  ? `Provider set to Mock — no real ${isPayment ? "payments" : "SMS"} will go out.`
                  : `Provider set to ${form.provider.toUpperCase()} but toggle is OFF.`}
              </p>
              <p>Turn Enabled ON and click Save to go live.</p>
            </div>
          </div>
        )}

        {/* SMS-only: Send Test SMS section (uses the new /admin/settings/sms/test-send backend endpoint) */}
        {!isPayment && form.provider !== "mock" && form.enabled && (
          <div className="bg-white border border-cream-300 rounded-2xl p-4 space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-bold text-ink-muted">
              Send a real test SMS
            </p>
            <p className="text-xs text-ink-soft">
              After saving MSG91 credentials, verify by sending a test SMS to your own phone.
            </p>
            <div className="flex gap-2">
              <input
                data-testid="admin-settings-test-phone"
                type="tel"
                inputMode="numeric"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit phone (e.g. 9876543210)"
                className="flex-1 bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink font-medium outline-none focus:ring-2 focus:ring-forest/20 font-mono"
              />
              <button
                data-testid="admin-settings-send-test-btn"
                onClick={sendTestSms}
                disabled={testing || testPhone.length !== 10}
                className="flex items-center gap-1.5 bg-forest text-cream-100 px-4 rounded-xl font-bold hover:bg-forest-dark disabled:opacity-60"
              >
                {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={2.5} />}
                Send
              </button>
            </div>
          </div>
        )}

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
