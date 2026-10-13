#!/usr/bin/env node
/**
 * Checks the LIVE public site the way a search engine or an audit tool
 * (Ahrefs, Search Console) sees it, so problems are found here first
 * (client, 2026-10-13: "check also other problems like this, even if not
 * yet showing in webmaster tools").
 *
 *   npm run check:site                                  # https://www.repget.com
 *   CHECK_SITE_URL=https://<preview> npm run check:site # another deployment
 *
 * From the sitemap, every page must:
 *  - answer 200, with a canonical address that is the page itself;
 *  - if it declares hreflang alternates: list itself and x-default, and every
 *    alternate must answer 200 and declare the same set back (reciprocal);
 *  - link only to internal addresses that answer 200. A link to a 404 or 5xx
 *    is an error; a link to a redirect is reported as a warning.
 *
 * Read-only: GET and HEAD only, one request at a time with a pause between
 * them, and a cap on the total. Exits 1 on an error, 0 otherwise (warnings
 * are printed but do not fail the run).
 */

const BASE = (process.env.CHECK_SITE_URL ?? "https://www.repget.com").replace(/\/+$/, "");
const HOST = new URL(BASE).host;
const DELAY_MS = Number(process.env.CHECK_SITE_DELAY_MS ?? 300);
const MAX_REQUESTS = Number(process.env.CHECK_SITE_MAX_REQUESTS ?? 800);
const UA = "RepGetSiteCheck/1.0 (+https://www.repget.com)";

let requests = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** One request. `html` holds the body of an HTML page (or of anything, with anyBody). */
async function fetchOnce(url, method, { anyBody = false } = {}) {
  if (requests >= MAX_REQUESTS) throw new Error(`stopped after ${MAX_REQUESTS} requests (CHECK_SITE_MAX_REQUESTS)`);
  requests += 1;
  await sleep(DELAY_MS);
  const response = await fetch(url, { method, redirect: "manual", headers: { "user-agent": UA }, signal: AbortSignal.timeout(30_000) });
  const wanted = method === "GET" && (anyBody || (response.headers.get("content-type") ?? "").includes("html"));
  const html = wanted ? await response.text() : "";
  if (!wanted) await response.body?.cancel().catch(() => {});
  return { status: response.status, location: response.headers.get("location"), html };
}

/** Absolute, without fragment; the root as "<base>/". */
function normalize(href, from) {
  const url = new URL(href, from);
  url.hash = "";
  return url.href;
}
const sameUrl = (a, b) => normalize(a, BASE) === normalize(b, BASE);
const decode = (s) => s.replace(/&amp;/g, "&");

/** The attributes of every tag named `tag`, as plain objects. */
function tags(html, tag) {
  return [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, "gi"))].map((m) => {
    const attributes = {};
    for (const a of m[1].matchAll(/([a-zA-Z:-]+)\s*=\s*"([^"]*)"/g)) attributes[a[1].toLowerCase()] = decode(a[2]);
    return attributes;
  });
}

const errors = [];
const warnings = [];

async function sitemapUrls(url, seen = new Set()) {
  if (seen.has(url)) return [];
  seen.add(url);
  const { status, html: text } = await fetchOnce(url, "GET", { anyBody: true });
  if (status !== 200) {
    errors.push(`sitemap answers ${status}: ${url}`);
    return [];
  }
  const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1].trim()));
  if (/<sitemapindex/i.test(text)) {
    const nested = [];
    for (const loc of locs) nested.push(...(await sitemapUrls(loc, seen)));
    return nested;
  }
  return locs;
}

const pages = [...new Set(await sitemapUrls(`${BASE}/sitemap.xml`))].map((u) => u.replace(/^https:\/\/[^/]+/, BASE));
if (pages.length === 0) {
  console.error(`No URLs in ${BASE}/sitemap.xml.`);
  process.exit(1);
}

const info = new Map(); // url -> { status, alternates: Map(lang -> url) }
const linkedFrom = new Map(); // internal target -> Set(page)
for (const page of pages) {
  const { status, location, html } = await fetchOnce(page, "GET");
  if (status !== 200) {
    errors.push(`sitemap page answers ${status}${location ? ` -> ${location}` : ""}: ${page}`);
    info.set(normalize(page, BASE), { status, alternates: new Map() });
    continue;
  }
  const links = tags(html, "link");
  const canonical = links.find((l) => (l.rel ?? "").split(/\s+/).includes("canonical"))?.href;
  if (!canonical) errors.push(`no canonical: ${page}`);
  else if (!sameUrl(canonical, page)) errors.push(`canonical points elsewhere: ${page} -> ${canonical}`);

  const alternates = new Map();
  for (const l of links) {
    if ((l.rel ?? "").split(/\s+/).includes("alternate") && l.hreflang) alternates.set(l.hreflang.toLowerCase(), normalize(l.href, page));
  }
  info.set(normalize(page, BASE), { status, alternates });

  for (const a of tags(html, "a")) {
    if (!a.href || /^(mailto|tel|javascript):/i.test(a.href) || a.href.startsWith("#")) continue;
    let target;
    try {
      target = new URL(a.href, page);
    } catch {
      errors.push(`unreadable link "${a.href}" on ${page}`);
      continue;
    }
    if (target.host !== HOST) continue;
    target.hash = "";
    const key = target.href;
    if (!linkedFrom.has(key)) linkedFrom.set(key, new Set());
    linkedFrom.get(key).add(new URL(page).pathname);
  }
}

// hreflang: self, x-default, targets alive, and every alternate declares the same set back.
for (const [url, { alternates }] of info) {
  if (!alternates || alternates.size === 0) continue;
  // The page's own language(s): the codes that point at the page itself (x-default does not count).
  const own = [...alternates].filter(([lang, target]) => lang !== "x-default" && sameUrl(target, url)).map(([lang]) => lang);
  if (own.length === 0) errors.push(`hreflang set does not include the page itself: ${url}`);
  if (!alternates.has("x-default")) errors.push(`hreflang without x-default: ${url}`);
  for (const [lang, target] of alternates) {
    if (sameUrl(target, url)) continue;
    let other = info.get(target);
    if (!other) {
      const { status, location } = await fetchOnce(target, "GET");
      other = { status, alternates: null };
      info.set(target, other);
      if (status !== 200) errors.push(`hreflang ${lang} on ${url} points to ${status}${location ? ` -> ${location}` : ""}: ${target}`);
      else warnings.push(`hreflang ${lang} on ${url} points to a page missing from the sitemap: ${target}`);
      continue;
    }
    if (other.status !== 200) {
      errors.push(`hreflang ${lang} on ${url} points to ${other.status}: ${target}`);
      continue;
    }
    // A return link must name this page with ITS language code - pointing back only as x-default does not count.
    if (lang !== "x-default" && other.alternates && !own.some((code) => other.alternates.has(code) && sameUrl(other.alternates.get(code), url))) {
      errors.push(`hreflang not reciprocal: ${url} lists ${target} (${lang}), which does not list it back as ${own.join("/") || "its language"}`);
    }
  }
}

// Internal links that are not sitemap pages: each must answer 200.
for (const [target, from] of linkedFrom) {
  if (info.has(normalize(target, BASE))) continue;
  let { status, location } = await fetchOnce(target, "HEAD");
  if (status === 405 || status === 501) ({ status, location } = await fetchOnce(target, "GET"));
  const where = `linked from ${[...from].slice(0, 5).join(", ")}${from.size > 5 ? ` and ${from.size - 5} more` : ""}`;
  if (status >= 400) errors.push(`link to ${status}: ${target} (${where})`);
  else if (status >= 300) warnings.push(`link to a redirect (${status} -> ${location}): ${target} (${where})`);
}

const withAlternates = [...info.values()].filter((page) => page.alternates && page.alternates.size > 0).length;
console.log(
  `${BASE}: ${pages.length} sitemap page(s) (${withAlternates} with hreflang alternates), ${linkedFrom.size} internal link target(s), ${requests} request(s).`,
);
for (const w of warnings) console.log(`warning  ${w}`);
for (const e of errors) console.error(`ERROR    ${e}`);
if (errors.length > 0) {
  console.error(`\n${errors.length} error(s). Fix them before search engines and audit tools report them.`);
  process.exit(1);
}
console.log(warnings.length ? `\nNo errors, ${warnings.length} warning(s).` : "\nNo problems found.");
