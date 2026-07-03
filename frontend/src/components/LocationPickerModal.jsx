import React, { useState } from "react";
import { X, MapPin, Navigation, ExternalLink, Loader2, Check } from "lucide-react";

/**
 * Modal that helps the provider capture a Google Maps location link without
 * having to leave the app entirely. Two flows:
 *  1. "Use my current location" — asks browser for geolocation, generates a
 *     Google Maps URL of the form https://www.google.com/maps?q=<lat>,<lng>.
 *  2. "Open Google Maps to search" — opens maps.google.com in a new tab so
 *     the user can search their clinic and paste the URL back.
 * Also accepts direct paste of an existing map URL.
 */
export default function LocationPickerModal({ open, onClose, initial, onSave }) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [url, setUrl] = useState(initial || "");
  const [error, setError] = useState("");

  React.useEffect(() => {
    if (open) {
      setUrl(initial || "");
      setError("");
    }
  }, [open, initial]);

  if (!open) return null;

  const useCurrent = () => {
    setError("");
    if (!navigator.geolocation) {
      setError("Geolocation not supported in this browser. Please paste a Maps link instead.");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const generated = `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
        setUrl(generated);
        setGpsLoading(false);
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Enable it in your browser settings or paste a link below."
            : "Could not read your location. Please try again or paste a link."
        );
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const openMaps = () => {
    window.open("https://www.google.com/maps", "_blank", "noopener,noreferrer");
  };

  const handleSave = () => {
    const trimmed = (url || "").trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      setError("Enter a valid https:// map URL, or use the buttons above.");
      return;
    }
    onSave(trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center px-4 pb-4">
      <div
        data-testid="location-picker-modal"
        className="bg-white rounded-2xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl"
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

        <div className="p-4 space-y-3">
          <p className="text-xs text-ink-soft leading-snug">
            Pick your clinic location so customers can navigate to you with one tap.
          </p>

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
            }}
            placeholder="https://maps.app.goo.gl/…"
            className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20 text-sm"
          />

          {error && (
            <p data-testid="location-picker-error" className="text-xs text-rose-600">
              {error}
            </p>
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
