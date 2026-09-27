/**
 * Which page a URL is, for joining analytics rows to articles.
 *
 * CONSERVATIVE on purpose. The earlier key lower-cased the whole URL and cut
 * the query string, so `/?p=101` and `/?p=202` (WordPress's plain
 * permalinks) became one page and both articles got the other's clicks, and
 * `/Blog/A` merged with `/blog/a` (different pages on a case-sensitive
 * server). Now only what never distinguishes pages is ignored:
 *
 *   - the scheme, a leading "www.", the host's case, a default port;
 *   - a trailing slash and the #fragment;
 *   - tracking parameters (utm_*, gclid, fbclid, ...), and the ORDER of the
 *     remaining parameters.
 *
 * Path case and every other query parameter are kept: `?lang=fr` and
 * `?lang=en` are different pages.
 *
 * A path without a host (Google Analytics reports `pagePath` only) is
 * resolved against the website's own host.
 *
 * The database has the same function, `repget_page_key(url, fallback_host)`
 * (migration 0045); the two are tested against each other. Change both or
 * neither.
 */

const TRACKING = /^(utm_[a-z0-9_]*|gclid|gbraid|wbraid|dclid|fbclid|msclkid|yclid|igshid|mc_cid|mc_eid|_ga|_gl)$/;

function hostKey(raw: string): string {
  let host = raw.toLowerCase();
  const at = host.lastIndexOf("@");
  if (at >= 0) host = host.slice(at + 1);
  host = host.replace(/:(80|443)$/, "");
  return host.replace(/^www\./, "");
}

export function pageKey(url: string | null | undefined, fallbackHost?: string | null): string | null {
  let s = (url ?? "").trim();
  if (!s) return null;
  if (s.startsWith("//")) s = `https:${s}`;
  else if (s.startsWith("/")) {
    if (fallbackHost) s = `${hostKey(fallbackHost.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split("/")[0])}${s}`;
  } else {
    s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  }

  s = s.split("#")[0];
  const q = s.indexOf("?");
  const rest = q >= 0 ? s.slice(0, q) : s;
  const query = q >= 0 ? s.slice(q + 1) : "";

  const slash = rest.indexOf("/");
  const host = hostKey(slash >= 0 ? rest.slice(0, slash) : rest);
  let path = slash >= 0 ? rest.slice(slash) : "";
  path = path.replace(/\/+$/, "");
  if (!path) path = "/";

  const params = query
    .split("&")
    .filter((p) => p !== "")
    .filter((p) => !TRACKING.test(p.split("=")[0].toLowerCase()))
    .sort();

  return `${host}${path}${params.length ? `?${params.join("&")}` : ""}`;
}
