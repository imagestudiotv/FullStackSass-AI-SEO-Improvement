import { formatNumber } from "@/lib/i18n/format";

/**
 * Number formatting for the Site analytics page. The admin area is English,
 * so everything here is "en".
 */

export const count = (value: number) => formatNumber(Math.round(value), "en");

/** 0..1 as "54.3%". */
export const percent = (ratio: number) =>
  new Intl.NumberFormat("en-GB", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(ratio);

/** 0..1 as a whole "54%", for shares of a total. */
export const share = (ratio: number) =>
  new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 0 }).format(ratio);

/** Seconds as GA shows them: "45s", "1m 05s", "1h 02m". */
export function duration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;
  if (total < 3600) return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, "0")}s`;
  return `${Math.floor(total / 3600)}h ${String(Math.floor((total % 3600) / 60)).padStart(2, "0")}m`;
}

export type Change =
  | { kind: "up" | "down"; text: string }
  | { kind: "flat" | "new" | "none"; text: string };

/**
 * The current period against the previous one, as words - never as colour
 * alone. `points` compares two rates by their difference in percentage
 * points ("+2.1 pts"); everything else by relative change ("+12%").
 */
export function change(current: number, previous: number, options: { points?: boolean } = {}): Change {
  if (options.points) {
    const diff = (current - previous) * 100;
    if (current === 0 && previous === 0) return { kind: "none", text: "None in either period" };
    if (Math.abs(diff) < 0.05) return { kind: "flat", text: "No change" };
    const value = Math.abs(diff).toFixed(1);
    return diff > 0 ? { kind: "up", text: `+${value} pts` } : { kind: "down", text: `−${value} pts` };
  }
  if (current === 0 && previous === 0) return { kind: "none", text: "None in either period" };
  if (previous === 0) return { kind: "new", text: "None in the previous period" };
  const ratio = (current - previous) / previous;
  if (Math.abs(ratio) < 0.005) return { kind: "flat", text: "No change" };
  const value = Math.round(Math.abs(ratio) * 100).toLocaleString("en");
  return ratio > 0 ? { kind: "up", text: `+${value}%` } : { kind: "down", text: `−${value}%` };
}
