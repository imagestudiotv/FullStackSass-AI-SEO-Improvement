/**
 * One line in the server log for each address a visitor could not find
 * (client's launch review, 2026-10-03: "404 logging"), so broken links can be
 * found and fixed: search the logs for "[404]".
 *
 * The 404 page reports itself from the browser (components/not-found-panel.tsx
 * to app/api/not-found). The point is the referrer: Vercel's own request log
 * already lists 404 paths, but not WHERE the visitor came from - which page
 * holds the broken link. Crawlers that do not run scripts are not counted;
 * Search Console's "Not found" report covers them.
 *
 * Safe to write: only the path is kept, never a query string; anything that
 * looks like a secret in it (an invitation token, say) is masked; and the
 * values are JSON-encoded, so a crafted address cannot forge extra log lines.
 */

export type MissReport = { path: string; from: string | null; internal: boolean };

const MAX_PATH = 300;

/** Segments that are secret by position: the token in an invitation link. */
const SECRET_AFTER = new Set(["invite"]);

/**
 * A segment that looks like a key rather than words: a UUID, a long hex
 * string, or 20+ characters mixing capitals and digits (a base64url token).
 * Ordinary slugs - lowercase words and hyphens, however long, numbers
 * included - are kept, so a broken blog link still names the post.
 */
function looksSecret(segment: string): boolean {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) return true;
  if (/^[0-9a-f]{24,}$/i.test(segment)) return true;
  return segment.length >= 20 && /^[A-Za-z0-9_-]+$/.test(segment) && /[A-Z]/.test(segment) && /[0-9]/.test(segment);
}

function maskSegments(pathname: string): string {
  const parts = pathname.split("/");
  return parts
    .map((segment, i) => ((segment !== "" && SECRET_AFTER.has(parts[i - 1] ?? "")) || looksSecret(segment) ? ":token" : segment))
    .join("/");
}

/** Control characters out, length capped. */
function tidy(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, MAX_PATH);
}

/**
 * The report for what a 404 page sent, or null when it is not one worth a
 * line. `siteOrigin` is this site's own origin, to tell a broken link on our
 * own pages (internal - fix it here) from one elsewhere.
 */
export function describeMiss(input: unknown, siteOrigin: string): MissReport | null {
  if (!input || typeof input !== "object") return null;
  const { path, referrer } = input as { path?: unknown; referrer?: unknown };
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return null;

  let pathname: string;
  try {
    pathname = new URL(path, siteOrigin).pathname;
  } catch {
    return null;
  }

  let from: string | null = null;
  let internal = false;
  if (typeof referrer === "string" && referrer) {
    try {
      const url = new URL(referrer);
      if (url.protocol === "http:" || url.protocol === "https:") {
        internal = url.origin === new URL(siteOrigin).origin;
        from = tidy(`${url.origin}${maskSegments(url.pathname)}`);
      }
    } catch {
      // Not an address: reported without one.
    }
  }

  return { path: tidy(maskSegments(pathname)), from, internal };
}

/** The log line: "[404]" and JSON, so it is searchable and cannot break out of its line. */
export function missLogLine(report: MissReport): string {
  return `[404] ${JSON.stringify(report)}`;
}
