import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { Building2, User as UserIcon, Wifi, WifiOff } from "lucide-react";

// SlotNow QR (App download) — served from the artifact CDN.
const QR_URL = "https://customer-assets-eiarnc6j.emergentagent.net/job_slotnow-web/artifacts/io2hwrjj_QR.webp";
const LOCAL_CACHE_KEY = (id) => `slotnow.waiting.${id}`;

// Clinic waiting-screen for LED TVs / Smart TVs. Public URL — no login. The
// clinic just points a browser at `/waiting/<provider_id>` and leaves it on.
// Auto-picks Multi-Doctor layout when the provider is a hospital with 2+ staff,
// otherwise falls back to Single-Doctor. Offline-first: last snapshot persists
// in localStorage so a Wi-Fi glitch doesn't blank the screen.
export default function WaitingScreen() {
  const { providerId } = useParams();
  const [params] = useSearchParams();
  const staffIds = params.get("staff") || ""; // e.g. "?staff=a,b,c"
  const refreshMs = Math.max(2000, Number(params.get("refresh")) * 1000 || 5000);
  const [snap, setSnap] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LOCAL_CACHE_KEY(providerId)) || "null"); }
    catch { return null; }
  });
  const [online, setOnline] = useState(navigator.onLine);
  const [now, setNow] = useState(new Date());
  const timerRef = useRef(null);

  const fetchSnap = useCallback(async () => {
    try {
      const qs = staffIds ? `?staff_ids=${encodeURIComponent(staffIds)}` : "";
      const { data } = await api.get(`/public/waiting/${providerId}${qs}`);
      setSnap(data);
      setOnline(true);
      try { localStorage.setItem(LOCAL_CACHE_KEY(providerId), JSON.stringify(data)); } catch {}
    } catch {
      // Offline / backend down → keep whatever was last cached.
      setOnline(false);
    }
  }, [providerId, staffIds]);

  useEffect(() => {
    fetchSnap();
    timerRef.current = setInterval(fetchSnap, refreshMs);
    const on = () => { setOnline(true); fetchSnap(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const clock = setInterval(() => setNow(new Date()), 15000);
    return () => {
      clearInterval(timerRef.current);
      clearInterval(clock);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [fetchSnap, refreshMs]);

  const provider = snap?.provider;
  const columns = snap?.columns || [];
  const isMulti = columns.length >= 2;
  const timeLabel = now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  const dateLabel = now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="min-h-screen bg-[#0a1a3a] text-white flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#0f2450] border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          {provider?.image ? (
            <img src={provider.image} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-yellow-300" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
              <Building2 size={22} className="text-yellow-300" />
            </div>
          )}
          <div className="min-w-0">
            <p data-testid="waiting-clinic-name" className="text-xl sm:text-3xl font-black leading-tight truncate">
              {provider?.business_name || "Clinic"}
            </p>
            {provider?.provider_type === "hospital" && (
              <p className="text-xs sm:text-sm text-yellow-200/80 leading-tight">Multi-Specialty Clinic</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-xs">
            {online ? <Wifi size={14} className="text-emerald-400" /> : <WifiOff size={14} className="text-amber-400" />}
            <span className={online ? "text-emerald-300" : "text-amber-300"}>
              {online ? "Live" : "Offline · showing last update"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SlotNowLogo />
            <span className="text-[10px] uppercase tracking-widest text-yellow-200/80 hidden sm:inline">Powered by</span>
          </div>
          <div className="text-right">
            <p className="text-2xl sm:text-4xl font-black">{timeLabel}</p>
            <p className="text-[11px] sm:text-xs text-yellow-200/70">Date: {dateLabel}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 sm:p-6">
        {isMulti ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
            {columns.slice(0, 3).map((c, i) => (
              <DoctorColumn key={c.staff_id || i} column={c} cabinFallback={String.fromCharCode(65 + i)} />
            ))}
          </div>
        ) : (
          <SingleView column={columns[0]} />
        )}
      </div>

      {/* Bottom banner (QR) */}
      <div className="bg-yellow-400 text-[#0a1a3a] flex items-center gap-4 px-6 py-3">
        <p className="flex-1 font-black text-sm sm:text-xl leading-tight">
          {(provider?.business_name || "Our Clinic")}
          <span className="text-[#0a1a3a]/70 font-bold"> · Book your next appointment on the </span>
          <SlotNowLogo variant="dark" small />
          <span className="text-[#0a1a3a]/70 font-bold"> app · Scan → </span>
        </p>
        <img
          src={QR_URL}
          alt="Scan to download SlotNow"
          className="w-16 h-16 sm:w-20 sm:h-20 bg-white p-1 rounded"
          data-testid="waiting-qr"
        />
      </div>
    </div>
  );
}

// Single-doctor / provider-wide layout — big centered token + Up Next list.
function SingleView({ column }) {
  if (!column) return null;
  const c = column;
  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
      <div className="flex flex-col justify-center bg-[#0f2450] rounded-3xl p-8 border border-yellow-300/20">
        <p className="text-yellow-300 text-2xl sm:text-4xl font-black mb-4">अब अंदर पधारें</p>
        <p className="text-3xl sm:text-5xl font-bold mb-3">Token No:</p>
        <p data-testid="waiting-current-token" className="text-7xl sm:text-[9rem] font-black leading-none mb-6">
          {c.current_token || "—"}
        </p>
        {c.current_patient ? (
          <div className="flex items-start gap-3 text-white/90">
            <UserIcon size={28} className="mt-1 text-yellow-300" />
            <div>
              <p className="text-2xl sm:text-3xl font-bold" data-testid="waiting-current-patient">
                Patient: {c.current_patient.masked_name}
                {c.current_patient.age ? ` (${c.current_patient.age} yrs)` : ""}
              </p>
              {c.cabin && (
                <p className="mt-3 inline-block bg-yellow-400/90 text-[#0a1a3a] font-black text-lg sm:text-2xl px-4 py-1.5 rounded-full">
                  Please proceed to Cabin {c.cabin}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xl text-yellow-200/80 italic">Waiting for the next patient…</p>
        )}
      </div>

      <div className="bg-[#0f2450]/70 rounded-3xl p-6 border border-yellow-300/10 flex flex-col">
        <p className="text-yellow-300 text-3xl sm:text-4xl font-black text-center">UP NEXT</p>
        <p className="text-yellow-200/70 text-center text-sm mb-4">अगले नंबर</p>
        <div className="flex-1 flex flex-col gap-3 justify-start">
          {(c.up_next || []).length === 0 && (
            <p className="text-center text-white/60 italic">Queue empty</p>
          )}
          {(c.up_next || []).map((u) => (
            <div
              key={u.token}
              data-testid={`waiting-upnext-${u.token}`}
              className="flex items-center gap-3 bg-[#132c5c] rounded-2xl px-4 py-3 border border-yellow-300/10"
            >
              <UserIcon size={20} className="text-yellow-300 shrink-0" />
              <p className="text-2xl sm:text-3xl font-bold">
                {u.token} <span className="text-yellow-200/70">— {u.masked_name}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// One doctor column in the 3-up multi-doctor layout.
function DoctorColumn({ column, cabinFallback }) {
  const c = column;
  const cabin = c.cabin || cabinFallback;
  return (
    <div className="bg-[#0f2450] rounded-3xl p-4 sm:p-5 border border-yellow-300/20 flex flex-col">
      <div className="bg-[#173166] rounded-xl px-3 py-2 mb-3 text-center">
        <p data-testid={`waiting-doc-${c.staff_id}`} className="text-lg sm:text-xl font-black truncate">
          {c.staff_name}
          {c.specialization && <span className="text-yellow-200/80 font-bold text-sm sm:text-base"> ({c.specialization})</span>}
        </p>
      </div>
      <p className="text-white text-xl sm:text-2xl font-black text-center">NOW SERVING:</p>
      <p className="text-yellow-300 text-5xl sm:text-6xl font-black text-center leading-none my-2">
        TOKEN NO: {c.current_token || "—"}
      </p>
      {c.current_patient ? (
        <p className="text-center text-white/90 text-base sm:text-lg font-bold mt-2">
          Patient: {c.current_patient.masked_name}
          {c.current_patient.age ? ` (${c.current_patient.age} yrs)` : ""}
          <span className="text-yellow-200/80"> | Cabin {cabin}</span>
        </p>
      ) : (
        <p className="text-center text-yellow-200/70 italic mt-2">No patient</p>
      )}
      <div className="border-t border-yellow-300/10 mt-4 pt-3 flex-1">
        <p className="text-yellow-300 text-sm font-black uppercase tracking-wider mb-1.5">Up Next</p>
        {(c.up_next || []).length === 0 && (
          <p className="text-white/50 text-sm italic">—</p>
        )}
        {(c.up_next || []).slice(0, 3).map((u) => (
          <p key={u.token} className="text-base sm:text-lg text-white/90">
            <span className="text-yellow-300 font-bold">{u.token}</span> — {u.masked_name}
          </p>
        ))}
      </div>
    </div>
  );
}

function SlotNowLogo({ variant = "light", small = false }) {
  const isDark = variant === "dark";
  const size = small ? "text-sm sm:text-base" : "text-base sm:text-lg";
  return (
    <span className={`inline-flex items-center gap-1 font-black ${size} ${isDark ? "text-[#0a1a3a]" : "text-yellow-300"}`}>
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${isDark ? "bg-[#0a1a3a] text-yellow-300" : "bg-yellow-300 text-[#0a1a3a]"}`}>
        S
      </span>
      SlotNow
    </span>
  );
}
