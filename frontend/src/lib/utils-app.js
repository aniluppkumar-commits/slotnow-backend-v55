export const STATUS_STYLES = {
  pending: { bg: "bg-amber-50", text: "text-amber-800", ring: "ring-amber-100", label: "Pending" },
  confirmed: { bg: "bg-emerald-50", text: "text-emerald-800", ring: "ring-emerald-100", label: "Confirmed" },
  completed: { bg: "bg-indigo-50", text: "text-indigo-800", ring: "ring-indigo-100", label: "Completed" },
  cancelled: { bg: "bg-rose-50", text: "text-rose-800", ring: "ring-rose-100", label: "Cancelled" },
  in_progress: { bg: "bg-sky-50", text: "text-sky-800", ring: "ring-sky-100", label: "In Progress" },
};

export function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span
      data-testid={`booking-status-${status}`}
      className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${s.bg} ${s.text} ring-1 ${s.ring}`}
    >
      {s.label}
    </span>
  );
}

export const CATEGORY_COLOR_MAP = {
  "#2A4D3E": { bg: "bg-emerald-50", text: "text-emerald-900", ring: "ring-emerald-100" },
  "#B45309": { bg: "bg-amber-50", text: "text-amber-900", ring: "ring-amber-100" },
  "#166534": { bg: "bg-green-50", text: "text-green-900", ring: "ring-green-100" },
  "#374151": { bg: "bg-stone-100", text: "text-stone-900", ring: "ring-stone-200" },
  "#991B1B": { bg: "bg-rose-50", text: "text-rose-900", ring: "ring-rose-100" },
  "#447A63": { bg: "bg-[#F1F3ED]", text: "text-[#3A4B3E]", ring: "ring-[#E1E5DC]" },
  "#1E40AF": { bg: "bg-sky-50", text: "text-sky-900", ring: "ring-sky-100" },
};

export function catStyle(hex) {
  return (
    CATEGORY_COLOR_MAP[hex] || {
      bg: "bg-cream-200",
      text: "text-forest",
      ring: "ring-cream-300",
    }
  );
}

export function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateShort(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function formatTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function nextNDays(n) {
  const days = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push({
      iso: d.toISOString().slice(0, 10),
      day: d.toLocaleDateString(undefined, { weekday: "short" }),
      date: d.getDate(),
      month: d.toLocaleDateString(undefined, { month: "short" }),
    });
  }
  return days;
}

export function generateTimeSlots(startTime, endTime, durationMin = 30) {
  const slots = [];
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let cur = sh * 60 + sm;
  const end = eh * 60 + em;
  while (cur + durationMin <= end) {
    const h = Math.floor(cur / 60);
    const m = cur % 60;
    slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    cur += durationMin;
  }
  return slots;
}
