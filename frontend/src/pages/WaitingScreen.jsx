import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import api from "@/lib/api";

// SlotNow official brand assets (uploaded to Emergent artifact CDN).
const SLOTNOW_LOGO = "https://customer-assets-eiarnc6j.emergentagent.net/job_slotnow-web/artifacts/9l3qowlw_logo.png";
const APP_QR = "https://customer-assets-eiarnc6j.emergentagent.net/job_slotnow-web/artifacts/io2hwrjj_QR.webp";
const CACHE_KEY = (id) => `slotnow.waiting.${id}`;

// Clinic waiting-screen for LED / Smart-TV. Public URL. Layout mirrors the
// approved Apex Clinic demo mock — deep-navy bg, medical caduceus overlay,
// three-column multi-doctor + single-doctor variant, huge yellow token,
// bilingual footer banner, official SlotNow brand logo everywhere.
export default function WaitingScreen() {
  const { providerId } = useParams();
  const [params] = useSearchParams();
  const staffIds = params.get("staff") || "";
  const refreshMs = Math.max(2000, Number(params.get("refresh")) * 1000 || 5000);
  const muted = params.get("mute") === "1";
  const [snap, setSnap] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY(providerId)) || "null"); }
    catch { return null; }
  });
  const [online, setOnline] = useState(navigator.onLine);
  const [now, setNow] = useState(new Date());
  // Track the last-seen token per column so we can chime + announce only on advance.
  const lastTokensRef = useRef({});
  const bootedRef = useRef(false);

  const fetchSnap = useCallback(async () => {
    try {
      const qs = staffIds ? `?staff_ids=${encodeURIComponent(staffIds)}` : "";
      const { data } = await api.get(`/public/waiting/${providerId}${qs}`);
      setSnap(data); setOnline(true);
      try { localStorage.setItem(CACHE_KEY(providerId), JSON.stringify(data)); } catch {}
    } catch { setOnline(false); }
  }, [providerId, staffIds]);

  useEffect(() => {
    fetchSnap();
    const t = setInterval(fetchSnap, refreshMs);
    const clk = setInterval(() => setNow(new Date()), 15000);
    const on = () => { setOnline(true); fetchSnap(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { clearInterval(t); clearInterval(clk);
      window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [fetchSnap, refreshMs]);

  // Chime + Text-to-Speech whenever a column's current_token changes.
  // Silent on the very first snapshot (bootedRef) so we do not blast on load.
  useEffect(() => {
    if (muted || !snap) return;
    const cols = snap.columns || [];
    const seen = lastTokensRef.current;
    const changes = [];
    cols.forEach((c) => {
      const key = c.staff_id || "single";
      const cur = c.current_token || 0;
      const prev = seen[key];
      if (prev !== undefined && cur && cur !== prev) changes.push(c);
      seen[key] = cur;
    });
    if (bootedRef.current && changes.length > 0) {
      playChime();
      changes.forEach(speakToken);
    }
    bootedRef.current = true;
  }, [snap, muted]);

  const provider = snap?.provider;
  const columns = snap?.columns || [];
  const isMulti = columns.length >= 2;
  const timeLabel = now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  const dateLabel = now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const clinicName = provider?.business_name || "Clinic";
  const isHospital = provider?.provider_type === "hospital";
  const [audioUnlocked, setAudioUnlocked] = useState(muted);

  const unlockAudio = () => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        window.__slotnowAC = window.__slotnowAC || new AC();
        window.__slotnowAC.resume?.().catch(() => {});
        // Silent priming beep so subsequent playChime() works on strict browsers.
        const ctx = window.__slotnowAC;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        g.gain.value = 0.0001;
        o.connect(g).connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime + 0.05);
      }
      if (window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0; window.speechSynthesis.speak(u);
      }
    } catch { /* ignore */ }
    setAudioUnlocked(true);
  };

  return (
    // Deep navy background with a very subtle medical caduceus SVG overlay
    <div
      className="relative min-h-screen text-white flex flex-col overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at top, #0d2a5c 0%, #071638 55%, #04091e 100%)",
      }}
    >
      <MedicalOverlay />
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-4 min-w-0">
          <CaduceusIcon className="w-14 h-14 text-white shrink-0" />
          <div className="min-w-0 leading-none">
            <p data-testid="waiting-clinic-name" className="text-4xl sm:text-5xl font-black tracking-tight truncate">
              {clinicName}
            </p>
            {isHospital && (
              <p className="mt-1 text-sm sm:text-base text-sky-300/90 font-semibold tracking-wide">Multi-Specialty Clinic</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-sky-300/80 font-bold">Powered by</span>
            <img src={SLOTNOW_LOGO} alt="SlotNow" className="h-9 sm:h-11 w-auto object-contain" />
          </div>
          <div className="text-right leading-tight">
            <p data-testid="waiting-time" className="text-4xl sm:text-5xl font-black">{timeLabel}</p>
            <p className="text-xs sm:text-sm text-sky-300/80 mt-1">
              Date: {dateLabel} {!online && <span className="text-amber-300 ml-1">· offline</span>}
            </p>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="relative z-10 flex-1 min-h-0 px-8 pb-6 flex flex-col">
        {isMulti ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 flex-1 auto-rows-fr">
            {columns.slice(0, 3).map((c, i) => (
              <DoctorColumn key={c.staff_id || i} column={c} cabinFallback={String.fromCharCode(65 + i)} />
            ))}
          </div>
        ) : (
          <SingleView column={columns[0]} />
        )}
      </main>

      {/* Footer banner (bilingual) */}
      <footer className="relative z-10 bg-[#040d24]/90 border-t-2 border-yellow-300/40 px-8 py-5 flex items-center gap-6">
        <div className="flex-1 min-w-0">
          <p className="text-sky-300 text-lg sm:text-2xl font-bold leading-tight">
            {clinicName}: Consult a specialist today. · आज ही किसी विशेषज्ञ से मिलें।
          </p>
          <p className="mt-1 text-white text-2xl sm:text-3xl font-black leading-tight flex items-center gap-2 flex-wrap">
            BOOK YOUR APPOINTMENT VIA
            <span className="inline-flex items-center gap-1.5">
              <img src={SLOTNOW_LOGO} alt="SlotNow" className="inline h-8 sm:h-10 w-auto align-middle" />
              <span className="text-yellow-300">SlotNow</span>
            </span>
            <span>APP NOW!</span>
            <span className="text-yellow-300 font-black">| Scan the QR Code →</span>
          </p>
        </div>
        <img
          data-testid="waiting-qr"
          src={APP_QR}
          alt="Scan to download SlotNow"
          className="w-24 h-24 sm:w-28 sm:h-28 bg-white p-1.5 rounded-lg shrink-0"
        />
      </footer>

      {/* One-tap audio unlock overlay — required by browser autoplay policies.
          Automatically skipped when the URL has ?mute=1. */}
      {!audioUnlocked && (
        <button
          type="button"
          data-testid="waiting-audio-unlock"
          onClick={unlockAudio}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <div className="bg-white text-ink rounded-3xl px-8 py-6 shadow-2xl text-center max-w-md mx-4">
            <p className="text-3xl font-black text-forest">🔔 Enable Sound</p>
            <p className="text-base text-ink-muted mt-2">
              Tap once to enable chime + voice announcements when tokens change.
            </p>
            <p className="text-xs text-ink-muted mt-3">
              (Add <code className="bg-cream px-1.5 py-0.5 rounded">?mute=1</code> to the URL to skip this screen.)
            </p>
            <span className="mt-4 inline-block bg-forest text-white font-bold px-6 py-2 rounded-xl">
              Tap anywhere to continue
            </span>
          </div>
        </button>
      )}
    </div>
  );
}

// -- Multi-doctor column --------------------------------------------------
function DoctorColumn({ column, cabinFallback }) {
  const c = column || {};
  const cabin = c.cabin || cabinFallback;
  return (
    <div className="h-full bg-white/[0.03] border border-white/10 rounded-3xl px-6 pt-5 pb-6 flex flex-col backdrop-blur-sm">
      <div className="text-center border-b border-white/10 pb-4 mb-4">
        <p data-testid={`waiting-doc-${c.staff_id}`} className="text-3xl sm:text-4xl font-black tracking-wide truncate">
          {(c.staff_name || "").toUpperCase()}
          {c.specialization && (
            <span className="block text-xl sm:text-2xl font-semibold text-sky-300/90 mt-1">
              ({c.specialization})
            </span>
          )}
        </p>
      </div>
      <p className="text-center text-2xl sm:text-3xl font-bold uppercase tracking-wider text-white/90">NOW SERVING:</p>
      <p className="text-center text-3xl sm:text-4xl font-bold text-white mt-2">
        TOKEN NO:
      </p>
      <p
        data-testid={`waiting-token-${c.staff_id}`}
        className="flex-1 flex items-center justify-center text-yellow-300 font-black leading-none"
        style={{ fontSize: "clamp(7rem, 14vw, 13rem)" }}
      >
        {c.current_token || "—"}
      </p>
      <p className="text-center text-xl sm:text-2xl mt-2">
        {c.current_patient ? (
          <>
            <span className="font-bold">Patient:</span>{" "}
            <span className="font-semibold">
              {c.current_patient.masked_name}
              {c.current_patient.age ? ` (${c.current_patient.age} yrs)` : ""}
            </span>{" "}
            <span className="text-sky-300">| Cabin {cabin}</span>
          </>
        ) : (
          <span className="text-sky-300/80 italic">Waiting for next patient</span>
        )}
      </p>
      <div className="mt-4 border-t border-white/10 pt-4">
        <p className="text-yellow-300 text-2xl sm:text-3xl font-black uppercase tracking-wider mb-2">UP NEXT:</p>
        {(c.up_next || []).length === 0 ? (
          <p className="text-white/60 italic text-xl">—</p>
        ) : (
          <ul className="space-y-1.5">
            {(c.up_next || []).slice(0, 3).map((u) => (
              <li key={u.token} className="text-2xl sm:text-3xl text-white leading-snug">
                <span className="font-black">{u.token}</span> - {u.masked_name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// -- Single-doctor / provider-wide view -----------------------------------
function SingleView({ column }) {
  if (!column) return null;
  const c = column;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 flex-1 min-h-0">
      <div className="h-full bg-white/[0.03] border border-white/10 rounded-3xl p-10 flex flex-col justify-center items-center backdrop-blur-sm">
        <p className="text-white text-3xl sm:text-4xl font-bold uppercase tracking-wider">NOW SERVING:</p>
        <p className="text-white text-4xl sm:text-5xl font-bold mt-3">TOKEN NO:</p>
        <p
          data-testid="waiting-current-token"
          className="flex-1 flex items-center justify-center text-yellow-300 font-black leading-none w-full"
          style={{ fontSize: "clamp(9rem, 22vw, 22rem)" }}
        >
          {c.current_token || "—"}
        </p>
        {c.current_patient ? (
          <p className="mt-2 text-3xl sm:text-4xl font-semibold text-center">
            <span className="font-bold">Patient:</span>{" "}
            <span data-testid="waiting-current-patient">
              {c.current_patient.masked_name}
              {c.current_patient.age ? ` (${c.current_patient.age} yrs)` : ""}
            </span>
            {c.cabin && <span className="text-sky-300"> | Cabin {c.cabin}</span>}
          </p>
        ) : (
          <p className="mt-2 text-2xl text-sky-300/80 italic">Waiting for the next patient…</p>
        )}
      </div>
      <div className="h-full bg-white/[0.03] border border-white/10 rounded-3xl p-8 flex flex-col backdrop-blur-sm">
        <p className="text-yellow-300 text-4xl sm:text-5xl font-black uppercase tracking-widest text-center">UP NEXT</p>
        <p className="text-sky-300/80 text-center text-xl mb-4">अगले नंबर</p>
        <div className="flex-1 flex flex-col justify-center">
          {(c.up_next || []).length === 0 ? (
            <p className="text-white/60 italic text-center text-2xl">Queue empty</p>
          ) : (
            <ul className="space-y-4">
              {(c.up_next || []).map((u) => (
                <li key={u.token} className="text-3xl sm:text-4xl bg-white/5 border border-white/10 rounded-2xl px-5 py-4">
                  <span className="font-black text-yellow-300 mr-2">{u.token}</span>
                  <span className="font-semibold">- {u.masked_name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// Very subtle background caduceus / DNA overlay to match the demo's medical feel.
function MedicalOverlay() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none"
      viewBox="0 0 1600 900"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <pattern id="cad" x="0" y="0" width="220" height="220" patternUnits="userSpaceOnUse">
          <g stroke="white" strokeWidth="1.2" fill="none">
            <circle cx="110" cy="110" r="46" />
            <path d="M110 60 v100 M60 110 h100" />
          </g>
        </pattern>
      </defs>
      <rect width="1600" height="900" fill="url(#cad)" />
    </svg>
  );
}

// Simple caduceus icon for the header (no external assets required).
function CaduceusIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <circle cx="32" cy="32" r="30" strokeOpacity="0.7" />
      <path d="M32 6v52" />
      <path d="M20 14c6 6 18 6 24 0" />
      <path d="M20 26c6 6 18 6 24 0" />
      <path d="M32 6l-5 6M32 6l5 6" />
    </svg>
  );
}

// --- Audio helpers -------------------------------------------------------
// Two-tone "ding-dong" chime on token advance using the Web Audio API. No
// external assets, and Chrome / Silk / Fire-TV Silk all support this. The
// AudioContext lives on window so we don't re-create it on every call.
function playChime() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    window.__slotnowAC = window.__slotnowAC || new AC();
    const ctx = window.__slotnowAC;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    [
      { f: 880, t: now, d: 0.35 },       // high tone
      { f: 660, t: now + 0.32, d: 0.5 }, // low tone
    ].forEach(({ f, t, d }) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + d + 0.05);
    });
  } catch { /* ignore audio failures on kiosks that block it */ }
}

// Announce the new token + patient name via SpeechSynthesis. Runs after the
// chime so it does not overlap. Selects an English voice if available and
// falls back to the browser default. Guarded so it never throws.
function speakToken(col) {
  try {
    const synth = window.speechSynthesis;
    if (!synth || !col?.current_token) return;
    const doc = col.staff_name || "";
    const patient = col.current_patient?.masked_name || "";
    const cabin = col.cabin || "";
    const parts = [
      `Token number ${col.current_token}`,
      patient ? `${patient}` : "",
      cabin ? `please proceed to cabin ${cabin}` : (doc ? `please proceed to ${doc}` : "please proceed"),
    ].filter(Boolean);
    const utter = new SpeechSynthesisUtterance(parts.join(", "));
    utter.rate = 0.95;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    utter.lang = "en-IN";
    // Prefer an Indian-English voice when present for clearer pronunciation.
    const voices = synth.getVoices?.() || [];
    const pick = voices.find((v) => /en-IN/i.test(v.lang)) || voices.find((v) => /en/i.test(v.lang));
    if (pick) utter.voice = pick;
    // Chrome sometimes queues stale utterances — cancel before speak on advance.
    synth.cancel();
    // Delay slightly so the chime finishes first.
    setTimeout(() => { try { synth.speak(utter); } catch { /* noop */ } }, 900);
  } catch { /* ignore TTS failures */ }
}
