import { SEEN_PATHS, type SeenPath } from "./badges-shared";

/**
 * When this administrator last opened each page, in an httpOnly cookie limited
 * to /admin. Not secret and not trusted for anything but their own badges, so
 * it is not signed; it names its administrator, so two people sharing a
 * browser do not clear each other's. Anything malformed reads as never opened.
 */

export const SEEN_COOKIE = "admin_seen";
export const SEEN_COOKIE_OPTIONS = {
  path: "/admin",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 365 * 24 * 60 * 60,
};

export type SeenTimes = Partial<Record<SeenPath, Date>>;

export function readSeen(value: string | undefined, userId: string): SeenTimes {
  if (!value || value.length > 2000) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return {};
    const { u, t } = parsed as { u?: unknown; t?: unknown };
    if (u !== userId || typeof t !== "object" || t === null) return {};
    const times: SeenTimes = {};
    for (const path of SEEN_PATHS) {
      const seconds = (t as Record<string, unknown>)[path];
      // Nothing is opened in the future: a wrong clock must not hide everything from then on.
      if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 && seconds * 1000 <= Date.now() + 60_000) {
        times[path] = new Date(Math.round(seconds * 1000));
      }
    }
    return times;
  } catch {
    return {};
  }
}

export function writeSeen(times: SeenTimes, userId: string, opened: SeenPath, now: Date = new Date()): string {
  const t: Record<string, number> = {};
  for (const path of SEEN_PATHS) {
    const at = path === opened ? now : times[path];
    // Milliseconds kept: cut to the second, what arrived earlier in that second would be new again.
    if (at) t[path] = at.getTime() / 1000;
  }
  return JSON.stringify({ u: userId, t });
}
