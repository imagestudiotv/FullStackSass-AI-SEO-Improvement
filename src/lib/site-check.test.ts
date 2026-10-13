import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * scripts/check-site.mjs against a small local site with known mistakes:
 * it must report each of them, and pass the same site once they are fixed.
 */

type Site = Record<string, { status?: number; location?: string; html?: string; xml?: string }>;

function page(path: string, { canonical = path, alternates = {}, links = [] }: { canonical?: string; alternates?: Record<string, string>; links?: string[] }) {
  const head = [
    `<link rel="canonical" href="BASE${canonical}"/>`,
    ...Object.entries(alternates).map(([lang, href]) => `<link rel="alternate" hrefLang="${lang}" href="BASE${href}"/>`),
  ].join("");
  return { html: `<html><head>${head}</head><body>${links.map((l) => `<a href="${l}">x</a>`).join("")}</body></html>` };
}

function serve(site: Site): Promise<{ server: Server; base: string }> {
  return new Promise((ready) => {
    const server = createServer((req, res) => {
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const entry = site[req.url ?? "/"];
      if (!entry) {
        res.writeHead(404, { "content-type": "text/html" }).end("<html>missing</html>");
        return;
      }
      if (entry.location) {
        res.writeHead(entry.status ?? 307, { location: entry.location }).end();
        return;
      }
      const body = (entry.xml ?? entry.html ?? "").replaceAll("BASE", base);
      res.writeHead(entry.status ?? 200, { "content-type": entry.xml ? "application/xml" : "text/html" }).end(req.method === "HEAD" ? undefined : body);
    });
    server.listen(0, "127.0.0.1", () => ready({ server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }));
  });
}

function check(base: string): Promise<{ code: number | null; out: string }> {
  return new Promise((done) => {
    const child = spawn(process.execPath, [resolve(__dirname, "../../scripts/check-site.mjs")], {
      env: { ...process.env, CHECK_SITE_URL: base, CHECK_SITE_DELAY_MS: "0" },
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => done({ code, out }));
  });
}

const sitemap = (paths: string[]) => ({ xml: `<urlset>${paths.map((p) => `<url><loc>BASE${p}</loc></url>`).join("")}</urlset>` });
const pair = { en: "/about", es: "/es/about", "x-default": "/about" };

describe("check-site", () => {
  let broken: { server: Server; base: string };
  let fixed: { server: Server; base: string };

  beforeAll(async () => {
    broken = await serve({
      "/sitemap.xml": sitemap(["/about", "/es/about", "/pricing", "/gone"]),
      "/about": page("/about", { alternates: pair, links: ["/pricing", "/old-page", "/moved"] }),
      // Lists itself, but not the English page back.
      "/es/about": page("/es/about", { alternates: { es: "/es/about", "x-default": "/about" } }),
      // Canonical pointing at another page.
      "/pricing": page("/pricing", { canonical: "/about" }),
      "/gone": { status: 404, html: "<html>gone</html>" },
      "/moved": { status: 308, location: "/pricing" },
    });
    fixed = await serve({
      "/sitemap.xml": sitemap(["/about", "/es/about", "/pricing"]),
      "/about": page("/about", { alternates: pair, links: ["/pricing", "/es/about"] }),
      "/es/about": page("/es/about", { alternates: pair }),
      "/pricing": page("/pricing", {}),
    });
  });
  afterAll(() => {
    broken?.server.close();
    fixed?.server.close();
  });

  it("reports a missing sitemap page, a wrong canonical, a non-reciprocal hreflang, a broken link and a link to a redirect", async () => {
    const { code, out } = await check(broken.base);
    expect(code).toBe(1);
    expect(out).toMatch(/sitemap page answers 404: .*\/gone/);
    expect(out).toMatch(/canonical points elsewhere: .*\/pricing -> .*\/about/);
    expect(out).toMatch(/hreflang not reciprocal: .*\/about lists .*\/es\/about \(es\)/);
    expect(out).toMatch(/link to 404: .*\/old-page \(linked from \/about\)/);
    expect(out).toMatch(/warning {2}link to a redirect \(308 -> \/pricing\): .*\/moved/);
  });

  it("passes the same site once it is right", async () => {
    const { code, out } = await check(fixed.base);
    expect(out).toContain("3 sitemap page(s) (2 with hreflang alternates)");
    expect(out).toContain("No problems found.");
    expect(code).toBe(0);
  });
});
