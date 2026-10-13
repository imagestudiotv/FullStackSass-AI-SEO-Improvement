#!/usr/bin/env node
/**
 * After `next build`: no page under the nonce CSP (src/proxy.ts's matcher)
 * may be prerendered.
 *
 *   npm run build && npm run check:csp-routes
 *
 * A nonce can only be put on scripts while a page is rendered for its
 * request. If a page the proxy covers were prerendered (static or ISR), its
 * cached HTML would carry no nonce while the proxy's enforced policy demands
 * one - every script on it would be blocked and the page would stop working.
 * Next builds such a page without complaint, so this reads the build's
 * prerender manifest and fails instead. Fix by keeping the page dynamic, or
 * by taking it out of the matcher (it then gets the baseline policy).
 */
import { readFileSync } from "node:fs";

const proxy = readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8");
const list = /matcher:\s*\[([^\]]*)\]/.exec(proxy)?.[1];
if (!list) {
  console.error("Could not read the matcher in src/proxy.ts.");
  process.exit(2);
}
const patterns = [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

/** "/admin/:path*" -> /admin and everything under it; "/sign-in" -> exactly that. */
function toRegExp(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\/:[A-Za-z]+\*/g, "(?:/.*)?").replace(/\/:[A-Za-z]+/g, "/[^/]+")}/?$`);
}
const matchers = patterns.map((p) => [p, toRegExp(p)]);

let manifest;
try {
  manifest = JSON.parse(readFileSync(new URL("../.next/prerender-manifest.json", import.meta.url), "utf8"));
} catch {
  console.error("No .next/prerender-manifest.json: run `npm run build` first.");
  process.exit(2);
}
const prerendered = [...Object.keys(manifest.routes ?? {}), ...Object.keys(manifest.dynamicRoutes ?? {})];
const clashes = prerendered.flatMap((route) => matchers.filter(([, re]) => re.test(route)).map(([pattern]) => `${route} (proxy matcher ${pattern})`));

if (clashes.length > 0) {
  console.error("Prerendered pages under the nonce CSP - their scripts would be blocked:");
  for (const clash of clashes) console.error(`  ${clash}`);
  process.exit(1);
}
console.log(`None of ${prerendered.length} prerendered route(s) is under the nonce CSP's ${patterns.length} matcher pattern(s).`);
