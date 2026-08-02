import React, { useState } from "react";
import { Share2, Copy, ExternalLink, Check, Globe } from "lucide-react";
import { toast } from "sonner";
import WhatsAppIcon from "@/components/WhatsAppIcon";

const SITE_URL =
  (typeof window !== "undefined" &&
    (window.__SITE_URL__ ||
      (window.location.hostname.endsWith("slotnow.co.in")
        ? "https://slotnow.co.in"
        : window.location.origin))) ||
  "https://slotnow.co.in";

/**
 * Compact "share your public page" card for provider dashboards.
 * Shows the /p/:id URL and one-tap copy, WhatsApp share, native share, open buttons.
 */
export default function PublicPageShare({ providerId, businessName, approved }) {
  const [copied, setCopied] = useState(false);
  if (!providerId) return null;

  const url = `${SITE_URL}/p/${providerId}`;
  const shareText = businessName
    ? `Book an appointment at ${businessName} on SlotNow: ${url}`
    : `Book on SlotNow: ${url}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy — please copy manually");
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: businessName || "SlotNow",
          text: shareText,
          url,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      copy();
    }
  };

  const waHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  return (
    <div
      data-testid="provider-share-card"
      className="bg-white border border-cream-300 rounded-2xl p-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-forest/10 text-forest flex items-center justify-center">
          <Globe size={16} />
        </div>
        <div className="flex-1">
          <p className="font-heading font-bold text-sm text-ink">Your public page</p>
          <p className="text-[11px] text-ink-muted">
            {approved
              ? "Share this link so customers can view and book."
              : "Once approved, share this link with customers."}
          </p>
        </div>
      </div>
      <button
        onClick={copy}
        data-testid="provider-share-url"
        className="w-full text-left mb-3 bg-cream border border-cream-300 rounded-xl px-3 py-2 text-xs text-ink font-mono truncate hover:border-forest"
        title="Tap to copy"
      >
        {url}
      </button>
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={copy}
          data-testid="provider-share-copy"
          className="flex items-center justify-center gap-1 py-2 rounded-xl bg-forest text-white text-xs font-bold hover:bg-forest-dark"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />} Copy
        </button>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="provider-share-wa"
          className="flex items-center justify-center gap-1 py-2 rounded-xl bg-[#25D366] text-white text-xs font-bold hover:opacity-90"
        >
          <WhatsAppIcon size={13} /> WhatsApp
        </a>
        {typeof navigator !== "undefined" && navigator.share ? (
          <button
            onClick={nativeShare}
            data-testid="provider-share-native"
            className="flex items-center justify-center gap-1 py-2 rounded-xl bg-cream-200 text-ink text-xs font-bold hover:bg-cream-300"
          >
            <Share2 size={13} /> Share
          </button>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="provider-share-open"
            className="flex items-center justify-center gap-1 py-2 rounded-xl bg-cream-200 text-ink text-xs font-bold hover:bg-cream-300"
          >
            <ExternalLink size={13} /> Open
          </a>
        )}
      </div>
    </div>
  );
}
