import { useEffect, useRef } from "react";

/**
 * Live polling hook: page-visibility aware. Pauses when tab hidden, resumes when visible.
 * Provides a near-realtime feel without websockets.
 */
export default function useLivePolling(fn, intervalMs = 5000, enabled = true) {
  const savedFn = useRef(fn);
  useEffect(() => {
    savedFn.current = fn;
  }, [fn]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer = null;

    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState === "visible") {
        try {
          await savedFn.current();
        } catch (err) {
          console.warn("Live polling tick failed:", err);
        }
      }
      timer = setTimeout(tick, intervalMs);
    };

    const onVis = () => {
      if (document.visibilityState === "visible") {
        // fire immediately on becoming visible
        savedFn.current?.();
      }
    };

    document.addEventListener("visibilitychange", onVis);
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs, enabled]);
}
