import type { Period } from "./types";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function todayIso(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`) + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const month = MONTHS[(m ?? 1) - 1] ?? "";
  return `${d ?? ""} ${month.slice(0, 3)} ${y ?? ""}`;
}

export function formatPretty(iso: string): string {
  const dt = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAYS[dt.getUTCDay()]} ${formatDate(iso)}`;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1] ?? ""} ${y ?? ""}`;
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function inPeriod(iso: string, period: Period, today: string): boolean {
  if (period === "all") return true;
  if (period === "year") return iso.slice(0, 4) === today.slice(0, 4);
  return iso.slice(0, 7) === today.slice(0, 7);
}

export function monthCells(ym: string): { date: string | null; day: number | null }[] {
  const [y, m] = ym.split("-").map(Number);
  const firstDow = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, 1)).getUTCDay();
  const pad = (firstDow + 6) % 7;
  const count = new Date(Date.UTC(y ?? 2026, m ?? 1, 0)).getUTCDate();
  const cells: { date: string | null; day: number | null }[] = [];
  for (let i = 0; i < pad; i += 1) cells.push({ date: null, day: null });
  for (let d = 1; d <= count; d += 1) {
    cells.push({ date: `${ym}-${String(d).padStart(2, "0")}`, day: d });
  }
  return cells;
}
