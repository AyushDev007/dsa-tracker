import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Midnight UTC for a date — the canonical key for ActivityDay rows. */
export function toUtcDay(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** "2026-08-05" for a Date, in UTC. */
export function isoDay(date: Date): string {
  return toUtcDay(date).toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Relative time that stays readable without pulling in a whole i18n stack. */
export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const future = diff < 0;

  const units: [number, string][] = [
    [60_000, "minute"],
    [3_600_000, "hour"],
    [86_400_000, "day"],
    [604_800_000, "week"],
    [2_592_000_000, "month"],
  ];

  if (abs < 60_000) return future ? "in a moment" : "just now";
  for (let i = 0; i < units.length; i++) {
    const [ms, name] = units[i];
    const next = units[i + 1]?.[0] ?? Infinity;
    if (abs < next) {
      const n = Math.floor(abs / ms);
      return future ? `in ${pluralize(n, name)}` : `${pluralize(n, name)} ago`;
    }
  }
  const years = Math.floor(abs / 31_536_000_000);
  return future ? `in ${pluralize(years, "year")}` : `${pluralize(years, "year")} ago`;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\//g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}
