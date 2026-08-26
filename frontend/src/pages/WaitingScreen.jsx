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
  const [snap, setSnap] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY(providerId)) || "null"); }
    catch { return null; }
  });
  const [online, setOnline] = useState(navigator.onLine);
  const [now, setNow] = useState(new Date());

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

  const provider = snap?.provider;
  const columns = snap?.columns || [];
  const isMulti = columns.length >= 2;
  const timeLabel = now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  const dateLabel = now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const clinicName = provider?.business_name || "Clinic";
  const isHospital = provider?.provider_type === "hospital";

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
      <main className="relative z-10 flex-1 px-8 pb-6">
        {isMulti ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 h-full">
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
            <img src={SLOTNOW_LOGO} alt="SlotNow" className="inline h-8 sm:h-10 w-auto align-middle" />
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
    </div>
  );
}

// -- Multi-doctor column --------------------------------------------------
function DoctorColumn({ column, cabinFallback }) {
  const c = column || {};
  const cabin = c.cabin || cabinFallback;
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-3xl px-5 pt-4 pb-5 flex flex-col backdrop-blur-sm">
      <div className="text-center border-b border-white/10 pb-3 mb-3">
        <p data-testid={`waiting-doc-${c.staff_id}`} className="text-2xl sm:text-3xl font-black tracking-wide truncate">
          {(c.staff_name || "").toUpperCase()}
          {c.specialization && (
            <span className="block text-base sm:text-lg font-semibold text-sky-300/90 mt-1">
              ({c.specialization})
            </span>
          )}
        </p>
      </div>
      <p className="text-center text-lg sm:text-xl font-bold uppercase tracking-wider text-white/90">NOW SERVING:</p>
      <p className="text-center text-2xl sm:text-3xl font-bold text-white mt-1">
        TOKEN NO:{" "}
        <span data-testid={`waiting-token-${c.staff_id}`} className="text-yellow-300 text-6xl sm:text-8xl font-black align-middle ml-2">
          {c.current_token || "—"}
        </span>
      </p>
      <p className="text-center text-base sm:text-lg mt-3">
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
      <div className="mt-4 border-t border-white/10 pt-3 flex-1">
        <p className="text-yellow-300 text-lg sm:text-xl font-black uppercase tracking-wider mb-2">UP NEXT:</p>
        {(c.up_next || []).length === 0 ? (
          <p className="text-white/60 italic">—</p>
        ) : (
          <ul className="space-y-1">
            {(c.up_next || []).slice(0, 3).map((u) => (
              <li key={u.token} className="text-lg sm:text-xl text-white">
                <span className="font-bold">{u.token}</span> - {u.masked_name}
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
    <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 h-full">
      <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-10 flex flex-col justify-center items-center backdrop-blur-sm">
        <p className="text-white text-3xl sm:text-4xl font-bold uppercase tracking-wider">NOW SERVING:</p>
        <p className="text-white text-4xl sm:text-5xl font-bold mt-3">TOKEN NO:</p>
        <p data-testid="waiting-current-token" className="text-yellow-300 text-[10rem] sm:text-[14rem] font-black leading-none mt-2">
          {c.current_token || "—"}
        </p>
        {c.current_patient ? (
          <p className="mt-4 text-2xl sm:text-3xl font-semibold text-center">
            <span className="font-bold">Patient:</span>{" "}
            <span data-testid="waiting-current-patient">
              {c.current_patient.masked_name}
              {c.current_patient.age ? ` (${c.current_patient.age} yrs)` : ""}
            </span>
            {c.cabin && <span className="text-sky-300"> | Cabin {c.cabin}</span>}
          </p>
        ) : (
          <p className="mt-4 text-2xl text-sky-300/80 italic">Waiting for the next patient…</p>
        )}
      </div>
      <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 flex flex-col backdrop-blur-sm">
        <p className="text-yellow-300 text-3xl sm:text-4xl font-black uppercase tracking-widest text-center">UP NEXT</p>
        <p className="text-sky-300/80 text-center text-lg mb-6">अगले नंबर</p>
        {(c.up_next || []).length === 0 ? (
          <p className="text-white/60 italic text-center">Queue empty</p>
        ) : (
          <ul className="space-y-3">
            {(c.up_next || []).map((u) => (
              <li key={u.token} className="text-2xl sm:text-3xl bg-white/5 border border-white/10 rounded-2xl px-5 py-3">
                <span className="font-black text-yellow-300 mr-2">{u.token}</span>
                <span className="font-semibold">- {u.masked_name}</span>
              </li>
            ))}
          </ul>
        )}
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
