import type { Priority, TicketStatus } from "./types";

/** All stored timestamps are UTC (requirements: "Use UTC timestamps"). */
export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateShort(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function relativeTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const minutes = Math.round(abs / 60_000);
  if (minutes < 1) return diffMs >= 0 ? "just now" : "in a moment";
  if (minutes < 60) return rtf.format(-Math.sign(diffMs) * minutes, "minute");
  const hours = Math.round(abs / 3_600_000);
  if (hours < 24) return rtf.format(-Math.sign(diffMs) * hours, "hour");
  const days = Math.round(abs / 86_400_000);
  if (days < 30) return rtf.format(-Math.sign(diffMs) * days, "day");
  const months = Math.round(abs / 2_592_000_000);
  return rtf.format(-Math.sign(diffMs) * months, "month");
}

/** e.g. "1d 4h", "3h 20m", "45m" — used for average resolution time. */
export function formatDuration(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  const d = Math.floor(hours / 24);
  const h = Math.floor(hours % 24);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.round((hours % 1) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function statusLabel(status: TicketStatus): string {
  return status.replace(/([a-z])([A-Z])/g, "$1 $2");
}

/** Human label for the priority, e.g. "Critical" stays as-is. */
export function priorityLabel(priority: Priority): string {
  return priority;
}

export function initials(name: string): string {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function plural(n: number, word: string): string {
  return `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
}
