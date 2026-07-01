import React from "react";

/**
 * SlotNow logo — replicates the mobile app's clock + orange pin/checkmark mark.
 * `size` controls total height; wordmark shows on the right when `withText` is true.
 */
export function SlotNowMark({ size = 44, className = "" }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-label="SlotNow logo"
      role="img"
    >
      {/* Blue clock arc (opens to right, from ~55° through top to ~305°) */}
      <path
        d="M 78 32
           A 34 34 0 1 0 78 68"
        fill="none"
        stroke="#1E3A8A"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Clock face (subtle) */}
      <circle cx="50" cy="50" r="22" fill="#FFFFFF" stroke="#1E3A8A" strokeWidth="1.5" />
      {/* Tick marks */}
      {[0, 3, 6, 9].map((h) => {
        const ang = (h / 12) * Math.PI * 2 - Math.PI / 2;
        const x1 = 50 + Math.cos(ang) * 20;
        const y1 = 50 + Math.sin(ang) * 20;
        const x2 = 50 + Math.cos(ang) * 17;
        const y2 = 50 + Math.sin(ang) * 17;
        return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1E3A8A" strokeWidth="1.8" strokeLinecap="round" />;
      })}
      {/* Clock hands — orange */}
      <line x1="50" y1="50" x2="50" y2="36" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
      <line x1="50" y1="50" x2="62" y2="55" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="50" r="2" fill="#F97316" />
      {/* Speed lines to the right */}
      <line x1="80" y1="52" x2="94" y2="52" stroke="#F97316" strokeWidth="4" strokeLinecap="round" />
      <line x1="82" y1="60" x2="92" y2="60" stroke="#F97316" strokeWidth="4" strokeLinecap="round" />
      {/* Orange pin/checkmark tail below */}
      <path
        d="M 40 74
           L 50 92
           L 66 68"
        fill="none"
        stroke="#F97316"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SlotNowWordmark({ className = "", size = "text-3xl" }) {
  return (
    <span className={`font-heading font-extrabold tracking-tight ${size} ${className}`}>
      <span className="text-forest">Slot</span>
      <span className="text-accent">Now</span>
    </span>
  );
}

export function SlotNowLogoLockup({ compact = false }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <SlotNowMark size={compact ? 56 : 72} />
      <SlotNowWordmark size={compact ? "text-2xl" : "text-4xl"} />
      {!compact && (
        <>
          <p className="text-xs text-ink-soft mt-1">Book appointments in seconds</p>
          <p className="text-[10px] text-ink-muted">by Saving Plus</p>
        </>
      )}
    </div>
  );
}

export default SlotNowLogoLockup;
