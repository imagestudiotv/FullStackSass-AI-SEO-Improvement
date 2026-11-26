/** The sidebar badges' shape and wording, shared by the server and the browser. */

export type AdminBadge = {
  /** What the badge shows: waiting + fresh. */
  count: number;
  /** Things somebody must act on. */
  waiting: number;
  /** New since this administrator last opened the page. */
  fresh: number;
  /** For the accessible name: "2 waiting", "3 new", "2 waiting, 1 new". */
  text: string;
  /** What they are: "1 to quote, 1 to deliver". */
  detail: string;
};

/** By the nav item's href. A page with nothing has no entry; nor has one whose count failed. */
export type AdminBadges = Record<string, AdminBadge>;

export const BADGE_CAP = 99;

/** What fits in a small pill. */
export function badgeNumber(count: number): string {
  return count > BADGE_CAP ? `${BADGE_CAP}+` : String(count);
}

/** Pages whose opening clears their "new" count (lib/admin/badges.ts). */
export const SEEN_PATHS = [
  "/admin/users",
  "/admin/websites",
  "/admin/organizations",
  "/admin/free-plan",
  "/admin/payments",
  "/admin/blog/comments",
  "/admin/social-posting",
] as const;
export type SeenPath = (typeof SEEN_PATHS)[number];

/** The page this path opens, if opening it clears a "new" count. */
export function seenPathOf(pathname: string): SeenPath | null {
  return SEEN_PATHS.find((path) => pathname === path || pathname.startsWith(`${path}/`)) ?? null;
}

export type BadgePart = { href: string; count: number; kind: "waiting" | "new"; what: string };

/** Puts the counts of each page together. */
export function assembleBadges(parts: BadgePart[]): AdminBadges {
  const badges: AdminBadges = {};
  for (const part of parts) {
    if (!(part.count > 0)) continue;
    const badge = (badges[part.href] ??= { count: 0, waiting: 0, fresh: 0, text: "", detail: "" });
    badge.count += part.count;
    if (part.kind === "waiting") badge.waiting += part.count;
    else badge.fresh += part.count;
    badge.detail = [badge.detail, `${part.count} ${part.what}`].filter(Boolean).join(", ");
  }
  for (const badge of Object.values(badges)) {
    badge.text = [badge.waiting > 0 ? `${badge.waiting} waiting` : "", badge.fresh > 0 ? `${badge.fresh} new` : ""].filter(Boolean).join(", ");
  }
  return badges;
}

/**
 * One line of a page's own account of its badge (Daniel, 2026-11-26: "I see
 * on blog dashboard 2 notifications, but I don't see anything there as new"):
 * what is counted, how many, and the page where it is dealt with.
 */
export type BadgeNoticeItem = {
  kind: "waiting" | "new";
  count: number;
  /** As the sidebar says it: "failed autopilot topics". */
  what: string;
  /** The same for one: "failed autopilot topic". */
  one: string;
  /** Where it is dealt with, and what the link says. */
  href: string;
  label: string;
};

/** "1 failed autopilot topic", "2 new comments". */
export function noticeCount(item: Pick<BadgeNoticeItem, "count" | "what" | "one">): string {
  return `${item.count} ${item.count === 1 ? item.one : item.what}`;
}
