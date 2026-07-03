// Helpers for storing an optional Google Maps link alongside the address field.
// Backend Provider schema does not include a location_link column, so we piggy-back
// on `address` using a stable separator marker. Frontend splits them back out on display.

const LOCATION_MARKER = "\n\n📍 ";
// A URL is only considered a map link if it starts with one of these hosts
const MAP_HOSTS = [
  "maps.google.com",
  "google.com/maps",
  "maps.app.goo.gl",
  "goo.gl/maps",
  "openstreetmap.org",
  "waze.com",
];

function isMapUrl(u) {
  if (!u) return false;
  try {
    const url = new URL(u);
    const host = url.host.toLowerCase();
    const pathHost = `${host}${url.pathname}`.toLowerCase();
    return MAP_HOSTS.some((m) => host.includes(m) || pathHost.includes(m));
  } catch {
    return false;
  }
}

/**
 * Combine an address text and a map link into the single `address` string the
 * backend stores. Empty inputs are handled gracefully.
 */
export function packAddress(addressText, mapLink) {
  const a = (addressText || "").trim();
  const m = (mapLink || "").trim();
  if (!m) return a;
  return `${a}${LOCATION_MARKER}${m}`;
}

/**
 * Split a stored `address` back into { text, mapLink }. If no marker is present
 * we still try to detect a URL at the end and pull it out; otherwise the whole
 * string is treated as address text and mapLink stays "".
 */
export function unpackAddress(stored) {
  const s = stored || "";
  if (s.includes(LOCATION_MARKER)) {
    const [text, link] = s.split(LOCATION_MARKER);
    return { text: (text || "").trim(), mapLink: (link || "").trim() };
  }
  // Fallback: detect a trailing map URL in legacy addresses
  const urlMatch = s.match(/https?:\/\/\S+$/);
  if (urlMatch && isMapUrl(urlMatch[0])) {
    return {
      text: s.slice(0, urlMatch.index).trim(),
      mapLink: urlMatch[0].trim(),
    };
  }
  return { text: s.trim(), mapLink: "" };
}
