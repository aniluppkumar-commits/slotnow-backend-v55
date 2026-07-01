import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useI18n } from "@/i18n";
import api from "@/lib/api";
import {
  Mail,
  MapPin,
  LogOut,
  User as UserIcon,
  Loader2,
  Phone,
  Save,
  Languages,
  LockKeyhole,
  X,
  Share2,
  Copy,
  Gift,
} from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { user, logout, updateProfile, setPin, isProvider } = useAuth();
  const { t, setLang } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    city: user?.city || "",
    address: user?.address || "",
    language: user?.language || "en",
  });
  const [saving, setSaving] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile(form);
      setLang(form.language);
      toast.success(t("profile_updated"));
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const savePin = async () => {
    if (!/^\d{4,6}$/.test(newPin)) return toast.error("PIN must be 4-6 digits");
    setSavingPin(true);
    try {
      await setPin(newPin);
      toast.success("PIN updated");
      setNewPin("");
      setPinOpen(false);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setSavingPin(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <AppShell title={t("profile")}>
      <div className="px-4 sm:px-6 pt-4 space-y-5">
        {/* Avatar */}
        <div className="flex flex-col items-center pt-4 pb-2">
          <div className="w-20 h-20 rounded-full bg-forest flex items-center justify-center text-cream-100 text-2xl font-bold">
            {form.name?.[0]?.toUpperCase() || user?.phone?.slice(-2) || <UserIcon size={28} />}
          </div>
          <p data-testid="profile-name" className="mt-3 font-heading font-bold text-ink text-lg">
            {form.name || (isProvider ? "Provider" : "Guest")}
          </p>
          <p className="text-xs text-ink-soft flex items-center gap-1 mt-0.5">
            <Phone size={11} /> +91 {user?.phone}
          </p>
          {isProvider && (
            <span className="mt-2 text-[10px] font-bold uppercase tracking-widest text-forest bg-forest-faint px-2 py-0.5 rounded-full">
              {t("role_provider")}
            </span>
          )}
        </div>

        {/* Form */}
        <div className="bg-white border border-cream-300 rounded-2xl p-4 space-y-3">
          <Field icon={<UserIcon size={14} />} label={t("name")}>
            <input
              data-testid="profile-name-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("your_full_name")}
              className="w-full bg-transparent outline-none text-ink font-medium placeholder:text-ink-muted"
            />
          </Field>
          <Field icon={<Mail size={14} />} label={t("email")}>
            <input
              data-testid="profile-email-input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@email.com"
              className="w-full bg-transparent outline-none text-ink font-medium placeholder:text-ink-muted"
            />
          </Field>
          <Field icon={<MapPin size={14} />} label={t("city")}>
            <input
              data-testid="profile-city-input"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Mumbai"
              className="w-full bg-transparent outline-none text-ink font-medium placeholder:text-ink-muted"
            />
          </Field>
          <Field icon={<MapPin size={14} />} label={t("address")}>
            <input
              data-testid="profile-address-input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder={t("optional")}
              className="w-full bg-transparent outline-none text-ink font-medium placeholder:text-ink-muted"
            />
          </Field>
          <Field icon={<Languages size={14} />} label={t("language")}>
            <select
              data-testid="profile-language-input"
              value={form.language}
              onChange={(e) => {
                setForm({ ...form, language: e.target.value });
                setLang(e.target.value);
              }}
              className="w-full bg-transparent outline-none text-ink font-medium"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
            </select>
          </Field>

          <button
            data-testid="profile-save-btn"
            onClick={save}
            disabled={saving}
            className="w-full mt-2 flex items-center justify-center gap-2 bg-forest text-cream-100 py-3 rounded-xl font-bold hover:bg-forest-dark transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> {t("save_changes")}</>}
          </button>
        </div>

        <button
          data-testid="profile-change-pin-btn"
          onClick={() => setPinOpen(true)}
          className="w-full flex items-center justify-center gap-2 bg-white border border-cream-300 text-ink py-3 rounded-xl font-bold hover:bg-cream-200 transition-colors"
        >
          <LockKeyhole size={16} /> {user?.has_pin ? t("change_pin") : "Set PIN"}
        </button>

        {/* Refer & earn */}
        {!isProvider && user?.role === "customer" && (
          <ReferShare phone={user?.phone} name={user?.name} />
        )}

        <button
          data-testid="profile-logout-btn"
          onClick={() => setLogoutOpen(true)}
          className="w-full flex items-center justify-center gap-2 bg-white border border-rose-200 text-rose-700 py-3 rounded-xl font-bold hover:bg-rose-50 transition-colors"
        >
          <LogOut size={16} /> {t("logout")}
        </button>
      </div>

      {/* PIN modal */}
      {pinOpen && (
        <Modal onClose={() => setPinOpen(false)} title={user?.has_pin ? t("change_pin") : "Set PIN"}>
          <input
            data-testid="profile-newpin-input"
            type="password"
            inputMode="numeric"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="4-6 digit PIN"
            className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-3 text-lg tracking-[0.4em] font-bold text-ink placeholder:text-ink-muted placeholder:tracking-normal outline-none focus:ring-2 focus:ring-forest/20"
            autoFocus
          />
          <button
            data-testid="profile-newpin-save-btn"
            onClick={savePin}
            disabled={savingPin || newPin.length < 4}
            className="w-full mt-3 bg-forest text-cream-100 py-3 rounded-xl font-bold hover:bg-forest-dark disabled:opacity-60"
          >
            {savingPin ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Save"}
          </button>
        </Modal>
      )}

      {/* Logout modal */}
      {logoutOpen && (
        <Modal onClose={() => setLogoutOpen(false)} title={t("logout_confirm")}>
          <div className="flex gap-2">
            <button
              data-testid="logout-cancel-btn"
              onClick={() => setLogoutOpen(false)}
              className="flex-1 bg-white border border-cream-300 text-ink py-3 rounded-xl font-bold"
            >
              Cancel
            </button>
            <button
              data-testid="logout-confirm-btn"
              onClick={handleLogout}
              className="flex-1 bg-rose-600 text-white py-3 rounded-xl font-bold"
            >
              {t("logout")}
            </button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}

function Field({ icon, label, children }) {
  return (
    <label className="flex items-center gap-3 py-2 border-b border-cream-300 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-cream-200 flex items-center justify-center text-ink-soft shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">{label}</div>
        {children}
      </div>
    </label>
  );
}

function ReferShare({ phone, name }) {
  const link = `${window.location.origin}/login?ref=${phone}`;
  const shareText = `Hey! Book appointments in seconds on SlotNow — no waiting. Use my referral: ${link}`;
  const [stats, setStats] = React.useState({ total: 0, converted: 0, loading: true });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/referrals/mine");
        if (cancelled) return;
        setStats({
          total: data?.total ?? data?.referred ?? 0,
          converted: data?.converted ?? data?.booked ?? 0,
          loading: false,
        });
      } catch {
        // Endpoint may not exist yet — silently fall back to 0
        if (!cancelled) setStats((s) => ({ ...s, loading: false }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join me on SlotNow", text: shareText, url: link });
      } catch (err) {
        // Web Share API throws AbortError when user cancels the share sheet — this is not an error.
        if (err?.name !== "AbortError") console.error("Share failed:", err);
      }
    } else {
      copy();
    }
  };

  const TIERS = [
    { count: 1, reward: "Free ₹50 credit" },
    { count: 3, reward: "Free ₹200 booking" },
    { count: 10, reward: "Priority support" },
  ];
  const totalRefs = stats.converted; // count only converted (booked) for reward eligibility
  const nextTier = TIERS.find((t) => totalRefs < t.count) || TIERS[TIERS.length - 1];
  const prevCount = TIERS.filter((t) => totalRefs >= t.count).slice(-1)[0]?.count || 0;
  const pct = Math.min(100, Math.round(((totalRefs - prevCount) / (nextTier.count - prevCount || 1)) * 100));

  return (
    <div className="bg-gradient-to-br from-accent to-accent-dark text-white rounded-2xl p-4 shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center">
          <Gift size={18} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-heading font-bold text-base">Refer friends to SlotNow</p>
          <p className="text-[11px] opacity-80">Skip the wait, together</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-2">
        <div className="flex items-center justify-between text-[11px] mb-1 opacity-90">
          <span data-testid="refer-progress-label">
            {stats.loading ? "Loading…" : totalRefs >= nextTier.count
              ? `You've unlocked: ${nextTier.reward}!`
              : `${nextTier.count - totalRefs} more → ${nextTier.reward}`}
          </span>
          <span className="font-bold">{totalRefs}/{nextTier.count}</span>
        </div>
        <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
          <div
            data-testid="refer-progress-bar"
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex gap-1 mt-1 text-[10px] opacity-80">
          {TIERS.map((t) => (
            <span key={t.count} className={`flex-1 text-center ${totalRefs >= t.count ? "font-bold" : ""}`}>
              {t.count}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white/15 rounded-xl px-3 py-2 mt-3 flex items-center justify-between gap-2">
        <p data-testid="refer-link" className="text-[11px] font-mono truncate opacity-90">{link}</p>
        <button
          data-testid="refer-copy-btn"
          onClick={copy}
          className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 shrink-0"
          title="Copy link"
        >
          <Copy size={13} />
        </button>
      </div>
      <button
        data-testid="refer-share-btn"
        onClick={share}
        className="mt-3 w-full flex items-center justify-center gap-2 bg-white text-accent-dark py-2.5 rounded-xl font-bold hover:bg-white/95"
      >
        <Share2 size={14} strokeWidth={2.5} /> Share
      </button>
    </div>
  );
}

function Modal({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center px-4 pb-24 sm:pb-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-md">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-bold text-lg text-ink">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-cream-200">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
