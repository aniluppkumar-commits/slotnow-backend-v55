import React, { useState } from "react";
import { X, Send, MessageCircle } from "lucide-react";

/**
 * WhatsApp deep-link helper. Returns full wa.me URL for a phone + preformatted message.
 */
export function waLink(phone, text) {
  const clean = String(phone).replace(/\D/g, "");
  const number = clean.length === 10 ? `91${clean}` : clean; // assume India when 10-digit
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/**
 * Predefined message templates for WhatsApp interactions with a booking customer.
 */
export function buildTemplates({ name = "there", token, provider = "SlotNow", service = "your service", date = "", time = "" }) {
  const dateStr = date ? ` on ${date}${time ? " at " + time : ""}` : "";
  return {
    confirmation:
      `Hi ${name}, this is ${provider}. We're confirming your appointment for ${service}${dateStr}. ` +
      (token ? `Your token is #${token}. ` : "") +
      `See you soon!`,
    reminder:
      `Hi ${name}, friendly reminder from ${provider} — you have an appointment${dateStr} for ${service}. ` +
      (token ? `Token #${token}. ` : "") +
      `Please arrive 10 minutes early.`,
    followup:
      `Hi ${name}, thank you for visiting ${provider}! We hope you're happy with your service. ` +
      `If anything needs attention, please reply here and we'll help right away.`,
    invite:
      `Hi ${name}, we've been sharing SlotNow with friends & family — skip the queue and book slots online. ` +
      `Try it: ${(typeof window !== "undefined" ? window.location.origin : "")}/login`,
  };
}

/**
 * Modal for choosing a WhatsApp message template or typing a custom message.
 * On send → opens wa.me link in a new tab.
 */
export default function WhatsAppModal({ open, onClose, phone, name, token, provider, service, date, time }) {
  const [choice, setChoice] = useState("confirmation");
  const [manual, setManual] = useState("");

  if (!open) return null;

  const templates = buildTemplates({ name, token, provider, service, date, time });
  const isManual = choice === "manual";
  const text = isManual ? manual : templates[choice];

  const send = () => {
    if (!phone) return;
    if (isManual && !manual.trim()) return;
    window.open(waLink(phone, text), "_blank", "noopener,noreferrer");
    onClose();
  };

  const OPTIONS = [
    { k: "confirmation", label: "Appointment Confirmation" },
    { k: "reminder", label: "Service Reminder" },
    { k: "followup", label: "Follow-up" },
    { k: "invite", label: "Referral / Invite" },
    { k: "manual", label: "Manual Message" },
  ];

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center px-4 pb-24 sm:pb-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto" data-testid="wa-modal">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-bold text-lg text-ink flex items-center gap-2">
            <MessageCircle size={18} className="text-[#128C7E]" /> Send WhatsApp
          </h3>
          <button data-testid="wa-close-btn" onClick={onClose} className="p-1 rounded-lg hover:bg-cream-200">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-ink-soft mb-3">
          To: <strong className="text-ink">{name}</strong> · +91 {phone}
        </p>

        <div className="grid grid-cols-1 gap-1.5 mb-3">
          {OPTIONS.map(({ k, label }) => {
            const active = choice === k;
            return (
              <button
                key={k}
                data-testid={`wa-option-${k}`}
                onClick={() => setChoice(k)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                  active
                    ? "bg-forest-faint border-forest text-forest"
                    : "bg-white border-cream-300 text-ink-soft hover:border-forest/40"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {isManual ? (
          <textarea
            data-testid="wa-manual-input"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Type your message…"
            rows={4}
            className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-forest/20 resize-none"
          />
        ) : (
          <div
            data-testid="wa-preview"
            className="bg-[#E7F8EC] rounded-xl p-3 text-sm text-ink whitespace-pre-wrap"
          >
            {text}
          </div>
        )}

        <button
          data-testid="wa-send-btn"
          onClick={send}
          disabled={isManual && !manual.trim()}
          className="w-full mt-3 flex items-center justify-center gap-2 bg-[#128C7E] text-white py-3 rounded-xl font-bold hover:bg-[#0e6f65] disabled:opacity-50"
        >
          <Send size={14} strokeWidth={2.5} />
          Open in WhatsApp
        </button>
      </div>
    </div>
  );
}
