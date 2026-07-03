import React, { useState, useEffect } from "react";
import { X, MapPin, Navigation, ExternalLink, Loader2, Check, AlertTriangle } from "lucide-react";

/**
 * Modal that helps the provider capture a Google Maps location link.
 *
 * Flows:
 *  1. "Use my current location" — asks the browser for geolocation, generates a
 *     Google Maps URL of the form https://www.google.com/maps?q=<lat>,<lng>.
 *     Retries with lower accuracy on timeout. Detects the "we are in a
 *     cross-origin iframe without allow=geolocation" case and shows a clear
 *     "Open in new tab" hint (the most common failure when the app is
 *     accessed via Emergent's chat preview).
 *  2. "Open Google Maps to search" — opens maps.google.com in a new tab.
 *  3. Manual paste of a URL.
 */

// True when this window is rendered inside a cross-origin iframe. Cross-origin
// iframes must be granted geolocation by the parent via allow="geolocation".
// If the parent hasn't done that, navigator.geolocation.getCurrentPosition
// resolves to PERMISSION_DENIED immediately — regardless of the user's
// browser/OS permission. Detect this so we can give a real explanation.
function isInsideCrossOriginIframe() {
  try {
    return window.self !== window.top && !window.top.document;
  } catch {
    // Reading window.top.document throws for cross-origin — so yes, we're framed.
    return true;
  }
}

function openInNewTab() {
  const url = window.location.href;
  window.open(url, "_blank", "noopener,noreferrer");
}

// Wrap the callback-based Geolocation API in a promise so we can retry.
function getPosition(opts) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, opts);
  });
}

export default function LocationPickerModal({ open, onClose, initial, onSave }) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [url, setUrl] = useState(initial || "");
  const [error, setError] = useState("");
  const [errorKind, setErrorKind] = useState(""); // "iframe" | "denied" | "unavailable" | "timeout" | "other" | ""

  const framed = isInsideCrossOriginIframe();

  useEffect(() => {
    if (open) {
      setUrl(initial || "");
      setError("");
      setErrorKind("");
    }
  }, [open, initial]);

  if (!open) return null;

  const useCurrent = async () => {
    setError("");
    setErrorKind("");

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser. Please paste a Maps link below.");
      setErrorKind("unavailable");
      return;
    }

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError("Geolocation requires a secure (HTTPS) connection. Please paste a Maps link instead.");
      setErrorKind("unavailable");
      return;
    }

    // Preflight with the Permissions API where available — gives us a
    // reliable read on whether the browser genuinely has 'denied' the site
    // (persistent block), versus 'prompt' (never asked yet) or 'granted'.
    let permState = "prompt";
    try {
      if (navigator.permissions?.query) {
        const status = await navigator.permissions.query({ name: "geolocation" });
        permState = status.state; // "granted" | "prompt" | "denied"
      }
    } catch {
      // Some browsers (Safari) throw on unknown names — ignore and proceed.
    }

    // If we KNOW it's persistently denied AND we're in a cross-origin iframe,
    // the iframe is the actual culprit — the browser doesn't even ask.
    if (permState === "denied" && framed) {
      setError(
        "Location is blocked because the site is running inside a preview frame. Tap 'Open in a new tab' below — the browser will then ask for your location."
      );
      setErrorKind("iframe");
      return;
    }
    if (permState === "denied") {
      setError(
        "Location permission is blocked in your browser settings for this site. Tap the padlock icon in the address bar → Site settings → Location → Allow, then try again. Or paste a Maps link below."
      );
      setErrorKind("denied");
      return;
    }

    setGpsLoading(true);

    // Attempt 1 — high accuracy, 15s. Attempt 2 (on TIMEOUT only) — low
    // accuracy, 20s (falls back to Wi-Fi / cell-tower based location).
    const tryOnce = (highAccuracy, timeoutMs) =>
      getPosition({ enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: 60000 });

    try {
      let pos;
      try {
        pos = await tryOnce(true, 15000);
      } catch (err) {
        if (err && err.code === 3 /* TIMEOUT */) {
          // Retry with network-based positioning
          pos = await tryOnce(false, 20000);
        } else {
          throw err;
        }
      }

      const { latitude, longitude } = pos.coords;
      const generated = `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
      setUrl(generated);
      setError("");
      setErrorKind("");
    } catch (err) {
      // Best-effort classification of the failure so we can give an actionable message.
      const code = err && typeof err.code === "number" ? err.code : 0;

      if (code === 1 /* PERMISSION_DENIED */) {
        if (framed) {
          setError(
            "The preview frame does not have permission to read location. Tap 'Open in a new tab' below — the app will then prompt you for permission."
          );
          setErrorKind("iframe");
        } else {
          setError(
            "Location permission was denied. Tap the padlock icon in the address bar → Site settings → Location → Allow, then reload and try again."
          );
          setErrorKind("denied");
        }
      } else if (code === 2 /* POSITION_UNAVAILABLE */) {
        setError(
          "Your device could not determine a location right now. Check that GPS/Location is turned ON in your phone settings, then try again."
        );
        setErrorKind("unavailable");
      } else if (code === 3 /* TIMEOUT */) {
        setError(
          "Getting your location took too long. Move to an area with better signal (near a window works) and try again, or paste a Maps link below."
        );
        setErrorKind("timeout");
      } else {
        setError(
          `Could not read your location (${err?.message || "unknown error"}). Please try again or paste a Maps link below.`
        );
        setErrorKind("other");
      }
    } finally {
      setGpsLoading(false);
    }
  };

  const openMaps = () => {
    window.open("https://www.google.com/maps", "_blank", "noopener,noreferrer");
  };

  const handleSave = () => {
    const trimmed = (url || "").trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      setError("Enter a valid https:// map URL, or use the buttons above.");
      setErrorKind("other");
      return;
    }
    onSave(trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center px-4 pb-4">
      <div
        data-testid="location-picker-modal"
        className="bg-white rounded-2xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl max-h-[92vh]"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-cream-300">
          <h3 className="font-heading font-bold text-ink flex items-center gap-2">
            <MapPin size={16} strokeWidth={2.5} />
            Set clinic location
          </h3>
          <button
            data-testid="location-picker-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-cream-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <p className="text-xs text-ink-soft leading-snug">
            Pick your clinic location so customers can navigate to you with one tap.
          </p>

          {/* Preview-frame notice — shown proactively so mobile users know
              why "Use my current location" won't work inside Emergent chat. */}
          {framed && (
            <div
              data-testid="location-picker-frame-notice"
              className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-2"
            >
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" strokeWidth={2.5} />
              <div className="text-[11px] text-amber-900 leading-snug flex-1">
                <span className="font-bold">Running in a preview frame.</span>{" "}
                Location may be blocked here. Tap below to continue in a real browser tab.
                <button
                  type="button"
                  data-testid="location-picker-open-new-tab-btn"
                  onClick={openInNewTab}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold bg-amber-500 text-white px-2 py-1 rounded-md hover:bg-amber-600"
                >
                  <ExternalLink size={11} strokeWidth={3} />
                  Open in a new tab
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            data-testid="location-picker-use-current-btn"
            onClick={useCurrent}
            disabled={gpsLoading}
            className="w-full flex items-center justify-center gap-2 bg-forest text-cream-100 py-2.5 rounded-xl font-bold hover:bg-forest-dark disabled:opacity-60"
          >
            {gpsLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Reading your location…
              </>
            ) : (
              <>
                <Navigation size={16} strokeWidth={2.5} /> Use my current location
              </>
            )}
          </button>

          <button
            type="button"
            data-testid="location-picker-open-maps-btn"
            onClick={openMaps}
            className="w-full flex items-center justify-center gap-2 bg-sky-50 text-sky-800 py-2.5 rounded-xl font-bold hover:bg-sky-100"
          >
            <ExternalLink size={14} strokeWidth={2.5} /> Open Google Maps to search
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-cream-300" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-2 text-[10px] uppercase tracking-widest font-bold text-ink-muted">
                or paste a link
              </span>
            </div>
          </div>

          <input
            data-testid="location-picker-url-input"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError("");
              setErrorKind("");
            }}
            placeholder="https://maps.app.goo.gl/…"
            className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20 text-sm"
          />

          {error && (
            <div
              data-testid="location-picker-error"
              data-error-kind={errorKind}
              className="bg-rose-50 border border-rose-200 rounded-xl p-2.5"
            >
              <p className="text-xs text-rose-800 leading-snug">{error}</p>
              {errorKind === "iframe" && (
                <button
                  type="button"
                  data-testid="location-picker-open-new-tab-btn-from-error"
                  onClick={openInNewTab}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold bg-rose-600 text-white px-2 py-1 rounded-md hover:bg-rose-700"
                >
                  <ExternalLink size={11} strokeWidth={3} />
                  Open in a new tab
                </button>
              )}
            </div>
          )}

          {url && !error && (
            <p className="text-[11px] text-emerald-700 flex items-center gap-1 truncate">
              <Check size={11} strokeWidth={3} />
              <span className="truncate">{url}</span>
            </p>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-cream-300 bg-cream/40">
          <button
            data-testid="location-picker-cancel-btn"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm text-ink-soft hover:bg-cream-200"
          >
            Cancel
          </button>
          <button
            data-testid="location-picker-save-btn"
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-forest text-cream-100 hover:bg-forest-dark"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
