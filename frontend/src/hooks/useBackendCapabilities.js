import { useEffect, useState } from "react";
import api from "@/lib/api";

/**
 * Backend feature detection.
 *
 * The deployed backend at pro-booking-21.emergent.host is not in this
 * workspace and its available endpoints have changed multiple times
 * (rollbacks removed /dry-run, /test-send, /login-email overnight, then
 * later restored). To stop the UI from showing buttons that 404, this
 * hook fetches /openapi.json once, extracts every `path` key, and
 * exposes a `has(pathTemplate)` predicate the UI can gate on.
 *
 * If openapi.json is missing/broken/blocked, we DEFAULT to `true` for
 * every check — i.e., fail-open — so a broken feature-detection call
 * doesn't hide legitimate working buttons.
 */
export function useBackendCapabilities() {
  const [paths, setPaths] = useState(null); // null = loading, Set = known, false = unknown/failed

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // openapi.json lives at the API root, NOT under /api. Use axios's baseURL host but strip /api.
        const base = api.defaults.baseURL || "";
        const rootBase = base.replace(/\/api\/?$/, "");
        const url = `${rootBase}/openapi.json`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`openapi ${res.status}`);
        const spec = await res.json();
        const set = new Set(Object.keys(spec.paths || {}));
        if (!cancelled) setPaths(set);
      } catch (err) {
        console.warn("useBackendCapabilities: falling back to fail-open —", err?.message);
        if (!cancelled) setPaths(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = paths === null;
  const has = (pathTemplate) => {
    if (!paths) return true; // fail-open on load or on error
    return paths.has(pathTemplate);
  };

  return { loading, has };
}
