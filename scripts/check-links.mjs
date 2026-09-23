/**
 * Checks that every outbound documentation link still resolves.
 *
 *   npm run check:links
 *
 * These URLs point at other companies' documentation — WordPress's
 * application-password page, Webflow's site-token reference — and those move
 * without telling us. Three of the five publishing providers had a dead
 * helpUrl at once, including the WordPress one, which is the single link on
 * the connect form and therefore the link someone clicks precisely because
 * they do not know where their credential lives. A 404 lands them on an error
 * page at the exact moment they needed help.
 *
 * Nothing in the app can notice this: a hardcoded string cannot tell that the
 * page behind it was retired, TypeScript sees a valid string, and the build
 * never fetches it. Only asking the network answers the question.
 *
 * The URLs are DISCOVERED from source rather than listed here, so a provider
 * added later is covered without anyone remembering to update this file.
 *
 * Read-only, and safe to run in CI: it issues one request per URL and writes
 * nothing.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = "src";

/**
 * What counts as a documentation link.
 *
 * Only pages a person is sent to read. Three kinds of URL live in this
 * codebase and none of them belong in this check:
 *
 *  - API endpoints (api.openai.com, api.webflow.com/v2, www.wixapis.com).
 *    They answer 405 or 404 to a browser GET because they are not pages, and
 *    reporting that as a broken link is a false alarm.
 *  - Sign-in and account destinations (accounts.google.com, PayPal's autopay
 *    page). They redirect to a login wall, so the check would measure our
 *    logged-out state rather than whether the link works.
 *  - Schema and namespace identifiers, which are names that merely look like
 *    URLs.
 *
 * A documentation host is therefore matched on the `docs`/`developer(s)`/
 * `help`/`support` subdomain, or a path that begins with a documentation
 * segment. That covers every help link the product actually shows and admits
 * a new provider's docs without an edit here.
 */
const DOC_HOST =
  /^https:\/\/(?:docs|developers?|help|support|dev)\.[a-z0-9.-]+\//i;
const DOC_PATH =
  /^https:\/\/[a-z0-9.-]+\/(?:docs?|documentation|support|help|guides?|manual|kb|article)\b/i;
const isDocLink = (url) => DOC_HOST.test(url) || DOC_PATH.test(url);

/** Source files worth scanning. */
const SOURCE = /\.(ts|tsx|mjs)$/;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      yield* walk(path);
    } else if (SOURCE.test(entry.name)) {
      yield path;
    }
  }
}

/**
 * Every documentation URL in the tree, with the files that reference it.
 *
 * Trailing punctuation is trimmed because these appear inside prose and JSX as
 * often as they do in a bare string literal.
 */
async function collect() {
  const found = new Map();
  for await (const file of walk(ROOT)) {
    const text = await readFile(file, "utf8");
    for (const raw of text.match(/https:\/\/[^\s"'`)<>\\]+/g) ?? []) {
      const url = raw.replace(/[.,;:]+$/, "");
      if (!isDocLink(url)) continue;
      const where = found.get(url) ?? new Set();
      where.add(relative(ROOT, file).replace(/\\/g, "/"));
      found.set(url, where);
    }
  }
  return found;
}

/**
 * HEAD first, GET as a fallback.
 *
 * Some documentation hosts answer HEAD with 403 or 405 while serving the page
 * perfectly well to a reader, so a HEAD failure is not yet evidence of a dead
 * link. A browser User-Agent for the same reason: help.shopify.com returns 403
 * to an unrecognised client and would otherwise be reported as broken every
 * run — a false alarm that teaches people to ignore this check.
 */
async function probe(url) {
  const headers = {
    "user-agent":
      "Mozilla/5.0 (compatible; RepGet-LinkCheck/1.0; +https://repget.com)",
    accept: "text/html,application/xhtml+xml",
  };
  for (const method of ["HEAD", "GET"]) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      if (response.ok) return { ok: true, status: response.status, url: response.url };
      // A 4xx from HEAD may still be a readable page; let GET decide.
      if (method === "HEAD") continue;
      return { ok: false, status: response.status, url: response.url };
    } catch (error) {
      if (method === "GET") {
        return { ok: false, status: 0, reason: error?.message ?? String(error) };
      }
    }
  }
  return { ok: false, status: 0, reason: "no response" };
}

const links = await collect();
if (links.size === 0) {
  console.log("No documentation links found — is this the right directory?");
  process.exit(1);
}

/*
  `source` is the URL as written in the code; `url` is where the request
  ended up. Keeping both is what lets a redirect be reported, and what lets a
  failure name the file to edit.
*/
const results = await Promise.all(
  [...links.keys()]
    .sort()
    .map(async (source) => ({ source, ...(await probe(source)) })),
);

const broken = results.filter((r) => !r.ok);
const line = "-".repeat(64);
console.log(`\n${line}\n  DOCUMENTATION LINKS\n${line}\n`);

for (const r of results) {
  if (!r.ok) continue;
  /*
    The URL printed is where the request LANDED, not what the source says, so
    a redirect is visible rather than hidden. A 301 still works and never
    fails this check, but it is where a dead link starts: Ghost's redirect
    today is someone's 404 after the next reorganisation.
  */
  const landed = r.url && r.url !== r.source ? `  →  ${r.url}` : "";
  console.log(`  [ok]   ${r.status}  ${r.source}${landed}`);
}

if (broken.length) {
  console.log("");
  for (const r of broken) {
    console.log(`  [DEAD] ${r.status || "—"}  ${r.source}`);
    console.log(`         ${r.reason ?? "did not resolve"}`);
    // The files to edit, so the fix does not start with a search.
    for (const file of links.get(r.source) ?? []) {
      console.log(`         referenced in ${file}`);
    }
  }
}

console.log(`\n${line}`);
console.log(`  ${results.length - broken.length} ok, ${broken.length} dead`);
console.log(
  broken.length === 0
    ? "  Every documentation link resolves.\n"
    : "  Replace the dead links above with pages that exist.\n",
);
process.exit(broken.length ? 1 : 0);
