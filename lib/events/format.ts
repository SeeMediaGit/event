import type { EventPhase, SeeEvent } from "./types";

const MONTHS_MN = [
  "1-р сар",
  "2-р сар",
  "3-р сар",
  "4-р сар",
  "5-р сар",
  "6-р сар",
  "7-р сар",
  "8-р сар",
  "9-р сар",
  "10-р сар",
  "11-р сар",
  "12-р сар",
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${formatDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatLongDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()} оны ${MONTHS_MN[d.getMonth()]}ын ${d.getDate()}`;
}

// "2026.08.01 – 2026.08.20", or just the one end we have.
export function formatDateRange(event: SeeEvent): string {
  const start = formatDate(event.starts_at);
  const end = formatDate(event.ends_at);
  if (start && end) return `${start} – ${end}`;
  if (start) return `${start}-нээс`;
  if (end) return `${end} хүртэл`;
  return "Огноо тодорхойгүй";
}

export const PHASE_LABEL: Record<EventPhase, string> = {
  upcoming: "Удахгүй",
  ongoing: "Явагдаж байна",
  finished: "Дууссан",
  undated: "Огноогүй",
};

// Rough "3 өдрийн дараа" / "2 цагийн дараа" countdown for upcoming events.
export function formatCountdown(iso: string | null, now = new Date()): string {
  if (!iso) return "";
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return "";

  const diffMs = target - now.getTime();
  if (diffMs <= 0) return "";

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes} минутын дараа`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} цагийн дараа`;

  const days = Math.floor(hours / 24);
  return `${days} өдрийн дараа`;
}
