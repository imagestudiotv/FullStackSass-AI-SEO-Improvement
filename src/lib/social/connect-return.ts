/**
 * Where a connection comes back to (client, 2026-11-11: after connecting one
 * account, connecting the next must not take a trip through "Manage"). The
 * Opportunities page's "Social connections" panel carries this id; the
 * return lands on it, with the result in the query for its toast.
 *
 * No server imports: the panel uses the anchor too.
 */

export const CONNECTIONS_ANCHOR = "social-connections";

const NOTICES = ["connected", "not_connected", "connect_failed", "not_configured"] as const;
export type ConnectNotice = (typeof NOTICES)[number];

/** The `social` value the return route sets (api/social/connected). */
export function isConnectNotice(value: string | null): value is ConnectNotice {
  return value !== null && (NOTICES as readonly string[]).includes(value);
}

/**
 * The page a connection returns to: the Opportunities page at its panel, or
 * the Videos page (a video platform, or Pinterest connected from there).
 */
export function connectReturnPath(websiteId: string, page: "social" | "videos", params: Record<string, string>): string {
  const query = new URLSearchParams(params).toString();
  return `/websites/${websiteId}/${page}${query ? `?${query}` : ""}${page === "social" ? `#${CONNECTIONS_ANCHOR}` : ""}`;
}
