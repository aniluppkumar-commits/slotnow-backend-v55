import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Mail, MapPin, LogOut, User as UserIcon, Loader2, Phone, Save, Languages } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { user, logout, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    city: user?.city || "",
    address: user?.address || "",
    language: user?.language || "en",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile(form);
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Logout from SlotNow?")) {
      logout();
      navigate("/login", { replace: true });
    }
  };

  return (
    <AppShell title="Profile">
      <div className="px-4 sm:px-6 pt-4 space-y-5">
        {/* Avatar */}
        <div className="flex flex-col items-center pt-4 pb-2">
          <div className="w-20 h-20 rounded-full bg-forest flex items-center justify-center text-cream-100 text-2xl font-bold">
            {form.name?.[0]?.toUpperCase() || user?.phone?.slice(-2) || <UserIcon size={28} />}
          </div>
          <p data-testid="profile-name" className="mt-3 font-heading font-bold text-ink text-lg">
            {form.name || "Guest"}
          </p>
          <p className="text-xs text-ink-soft flex items-center gap-1 mt-0.5">
            <Phone size={11} /> +91 {user?.phone}
          </p>
        </div>

        {/* Form */}
        <div className="bg-white border border-cream-300 rounded-2xl p-4 space-y-3">
          <Field icon={<UserIcon size={14} />} label="Name">
            <input
              data-testid="profile-name-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your full name"
              className="w-full bg-transparent outline-none text-ink font-medium placeholder:text-ink-muted"
            />
          </Field>
          <Field icon={<Mail size={14} />} label="Email">
            <input
              data-testid="profile-email-input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@email.com"
              className="w-full bg-transparent outline-none text-ink font-medium placeholder:text-ink-muted"
            />
          </Field>
          <Field icon={<MapPin size={14} />} label="City">
            <input
              data-testid="profile-city-input"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Mumbai"
              className="w-full bg-transparent outline-none text-ink font-medium placeholder:text-ink-muted"
            />
          </Field>
          <Field icon={<MapPin size={14} />} label="Address">
            <input
              data-testid="profile-address-input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Optional"
              className="w-full bg-transparent outline-none text-ink font-medium placeholder:text-ink-muted"
            />
          </Field>
          <Field icon={<Languages size={14} />} label="Language">
            <select
              data-testid="profile-language-input"
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
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
            {saving ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> Save changes</>}
          </button>
        </div>

        <button
          data-testid="profile-logout-btn"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 bg-white border border-rose-200 text-rose-700 py-3 rounded-xl font-bold hover:bg-rose-50 transition-colors"
        >
          <LogOut size={16} /> Logout
        </button>
      </div>
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
