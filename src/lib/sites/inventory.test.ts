import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { siteImages, sitePosts, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * What a customer's WordPress site already has, read from its public REST
 * API (client, 2026-10-20, Image Studio): its articles in every language and
 * its media library, read gently, and kept when a read is blocked. The site
 * is a fake: nothing here leaves the test.
 */

const state = vi.hoisted(() => ({ db: null as unknown, entitled: new Set<string>() }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/billing/entitled", () => ({ isEntitledToSpend: async (id: string) => (state.entitled.has(id) ? { ok: true } : { ok: false, error: "no plan" }) }));

import { inventoryDue, languageOf, languagesFrom, readWordPressInventory, refreshSiteInventory, websitesDueForInventory, type InventoryFetch } from "./inventory";

const ORIGIN = "https://studio.test";
const HOME = `<html><head>
<link rel="alternate" hreflang="en-US" href="${ORIGIN}/" />
<link rel="alternate" hreflang="it-IT" href="${ORIGIN}/it/" />
<link rel="alternate" hreflang="x-default" href="${ORIGIN}/" />
</head><body>Home</body></html>`;

const json = (body: unknown, totalPages: number | null = null) => ({ status: 200, contentType: "application/json; charset=UTF-8", totalPages, text: JSON.stringify(body) });
const post = (id: number, link: string, title: string) => ({ id, link, title: { rendered: title }, date: "2026-10-01T10:00:00" });

/** A WordPress site with posts (portfolio), "custom_post" articles in English and Italian, and a media library. */
function fakeSite(overrides: Record<string, ReturnType<typeof json> | { status: number; contentType: string; totalPages: null; text: string }> = {}) {
  const asked: string[] = [];
  const fetch: InventoryFetch = async (url) => {
    const path = url.slice(ORIGIN.length);
    asked.push(path);
    if (overrides[path]) return overrides[path];
    if (path === "/wp-json/wp/v2/types") {
      return json({
        post: { rest_base: "posts" },
        page: { rest_base: "pages" },
        attachment: { rest_base: "media" },
        custom_post: { rest_base: "custom_post" },
        elementor_library: { rest_base: "elementor_library" },
        wp_block: { rest_base: "blocks" },
      });
    }
    if (path === "/") return { status: 200, contentType: "text/html", totalPages: null, text: HOME };
    const query = new URL(url).searchParams;
    const lang = query.get("lang");
    const page = Number(query.get("page"));
    if (path.startsWith("/wp-json/wp/v2/posts")) {
      return json(lang === "en" ? [post(1, `${ORIGIN}/lake-como-wedding/`, "Lake Como &#038; Villa")] : lang === "it" ? [post(2, `${ORIGIN}/it/matrimonio-lago-como/`, "Lago di Como")] : [], 1);
    }
    if (path.startsWith("/wp-json/wp/v2/custom_post")) {
      if (lang === "en" && page === 1) return json(Array.from({ length: 100 }, (_, i) => post(100 + i, `${ORIGIN}/editorial/post/guide-${i}/`, `Guide ${i}`)), 2);
      if (lang === "en" && page === 2) return json([post(300, `${ORIGIN}/editorial/post/last-guide/`, "Last <em>guide</em>")], 2);
      if (lang === "it") return json([post(400, `${ORIGIN}/it/editorial/post/guida/`, "Guida")], 1);
      return json([], 0);
    }
    if (path.startsWith("/wp-json/wp/v2/media")) {
      // A short first page with more after it: WordPress counts pictures it then hides (Image Studio: 72 of 100).
      if (page === 2) return json([{ id: 12, source_url: `${ORIGIN}/wp-content/uploads/2025/05/villa.jpg`, alt_text: "Villa garden", title: { rendered: "Villa" }, caption: { rendered: "" }, media_details: { width: 800, height: 600 }, date: "2025-05-01T00:00:00" }], 2);
      return json(
        [
          { id: 9, source_url: `${ORIGIN}/wp-content/uploads/2026/10/couple-boat.jpg`, alt_text: "Couple on a boat on Lake Como", title: { rendered: "Couple &#038; boat" }, caption: { rendered: "<p>At sunset</p>" }, media_details: { width: 1600, height: 1067 }, date: "2026-10-18T22:00:00" },
          { id: 10, source_url: `${ORIGIN}/wp-content/uploads/2026/10/logo.png`, alt_text: "", title: { rendered: "logo" }, caption: { rendered: "" }, media_details: {}, date: "2026-01-01T00:00:00" },
          { id: 11, source_url: `${ORIGIN}/wp-content/uploads/2026/10/couple-boat.jpg`, alt_text: "the same file again", title: { rendered: "" }, caption: { rendered: "" }, media_details: {}, date: null },
        ],
        2,
      );
    }
    return { status: 404, contentType: "application/json", totalPages: null, text: "{}" };
  };
  return { fetch, asked };
}

describe("reading a WordPress site", () => {
  it("finds its articles in every language, its own article types, and its pictures", async () => {
    const site = fakeSite();
    const result = await readWordPressInventory(`${ORIGIN}/somewhere`, { fetch: site.fetch, pauseMs: 0, extraLanguages: ["es"] });
    if (result.status !== "ok") throw new Error(result.status);
    // English (the default, no folder), Italian from hreflang, Spanish named by the customer.
    expect(result.languages).toEqual(["en", "it", "es"]);
    // posts and custom_post; never pages, attachments, Elementor or block types.
    expect(new Set(result.posts.map((p) => p.postType))).toEqual(new Set(["posts", "custom_post"]));
    expect(result.posts).toHaveLength(1 + 1 + 101 + 1);
    expect(result.posts.find((p) => p.remoteId === 1)).toMatchObject({ title: "Lake Como & Villa", language: "en", url: `${ORIGIN}/lake-como-wedding/` });
    expect(result.posts.find((p) => p.remoteId === 400)).toMatchObject({ title: "Guida", language: "it" });
    expect(result.posts.find((p) => p.remoteId === 300)?.title).toBe("Last guide");
    // Each picture once, with what it shows.
    expect(result.images).toEqual([
      { remoteId: 9, url: `${ORIGIN}/wp-content/uploads/2026/10/couple-boat.jpg`, alt: "Couple on a boat on Lake Como", title: "Couple & boat", caption: "At sunset", width: 1600, height: 1067, uploadedAt: new Date("2026-10-18T22:00:00Z") },
      { remoteId: 10, url: `${ORIGIN}/wp-content/uploads/2026/10/logo.png`, alt: null, title: "logo", caption: null, width: null, height: null, uploadedAt: new Date("2026-01-01T00:00:00Z") },
      { remoteId: 12, url: `${ORIGIN}/wp-content/uploads/2025/05/villa.jpg`, alt: "Villa garden", title: "Villa", caption: null, width: 800, height: 600, uploadedAt: new Date("2025-05-01T00:00:00Z") },
    ]);
    // Asked for each language, and read the second page only because there is one.
    expect(site.asked.filter((p) => p.includes("custom_post") && p.includes("lang=en"))).toHaveLength(2);
    expect(site.asked.some((p) => p.includes("lang=es"))).toBe(true);
    expect(result.requests).toBe(site.asked.length);
  });

  it("stops at a bot check and never pushes through", async () => {
    const site = fakeSite({ "/wp-json/wp/v2/types": { status: 503, contentType: "text/html", totalPages: null, text: "<title>Just a moment...</title>" } });
    expect(await readWordPressInventory(ORIGIN, { fetch: site.fetch, pauseMs: 0 })).toMatchObject({ status: "blocked", requests: 1 });

    const kinsta = fakeSite({ "/": { status: 200, contentType: "text/html", totalPages: null, text: '<a href="/?ki-cf-botcl=1">Checking your browser</a>' } });
    expect((await readWordPressInventory(ORIGIN, { fetch: kinsta.fetch, pauseMs: 0 })).status).toBe("blocked");
  });

  it("says when a site has no public WordPress API", async () => {
    const site = fakeSite({ "/wp-json/wp/v2/types": { status: 404, contentType: "text/html", totalPages: null, text: "<html>Not found</html>" } });
    expect(await readWordPressInventory(ORIGIN, { fetch: site.fetch, pauseMs: 0 })).toMatchObject({ status: "not_wordpress" });
  });

  it("reads one language without asking for languages", async () => {
    const site = fakeSite({ "/": { status: 200, contentType: "text/html", totalPages: null, text: "<html><body>One language</body></html>" } });
    const result = await readWordPressInventory(ORIGIN, { fetch: site.fetch, pauseMs: 0 });
    expect(result.status === "ok" && result.languages).toEqual([]);
    expect(site.asked.some((p) => p.includes("lang="))).toBe(false);
  });
});

describe("the site's languages", () => {
  it("put the one without a folder first, and add the customer's own", () => {
    const html = `<link rel="alternate" hreflang="it" href="${ORIGIN}/it/"><link rel="alternate" hreflang="en" href="${ORIGIN}/">`;
    expect(languagesFrom(html, ORIGIN)).toEqual(["en", "it"]);
    expect(languagesFrom(html, ORIGIN, ["ES", "it", "not a code"])).toEqual(["en", "it", "es"]);
    expect(languagesFrom("<p>none</p>", ORIGIN)).toEqual([]);
  });

  it("are read from each post's address", () => {
    const languages = ["en", "it", "es"];
    expect(languageOf(`${ORIGIN}/it/guida/`, "it", languages)).toBe("it");
    expect(languageOf(`${ORIGIN}/guide/?lang=es`, "es", languages)).toBe("es");
    // No folder: the default, even when another language was asked for (a site that ignores ?lang=).
    expect(languageOf(`${ORIGIN}/guide/`, "it", languages)).toBe("en");
    expect(languageOf(`${ORIGIN}/guide/`, null, [])).toBeNull();
  });
});

describe("storing a site's inventory", () => {
  let test: TestDb;

  beforeAll(async () => {
    test = await createTestDb();
    state.db = test.db;
  });

  beforeEach(async () => {
    await test.client.exec("delete from site_posts; delete from site_images;");
    state.entitled.clear();
  });

  it("replaces it whole when the read works, keeps it when the site is blocked, and empties it for a site that is not WordPress", async () => {
    const { websiteId } = await seedWebsite(test);
    await test.db.update(websites).set({ url: ORIGIN }).where(eq(websites.id, websiteId));
    const now = new Date("2026-10-20T03:40:00Z");

    expect(await refreshSiteInventory(websiteId, { fetch: fakeSite().fetch, pauseMs: 0, now })).toEqual({ status: "ok", posts: 104, images: 3 });
    const [site] = await test.db.select().from(websites).where(eq(websites.id, websiteId));
    expect(site).toMatchObject({ inventoryStatus: "ok", inventoryCheckedAt: now, siteLanguages: ["en", "it"] });
    expect(await test.db.select().from(sitePosts).where(eq(sitePosts.websiteId, websiteId))).toHaveLength(104);

    const blocked = fakeSite({ "/wp-json/wp/v2/types": { status: 403, contentType: "text/html", totalPages: null, text: "denied" } });
    expect((await refreshSiteInventory(websiteId, { fetch: blocked.fetch, pauseMs: 0 })).status).toBe("blocked");
    expect(await test.db.select().from(siteImages).where(eq(siteImages.websiteId, websiteId))).toHaveLength(3);
    expect((await test.db.select().from(websites).where(eq(websites.id, websiteId)))[0].inventoryStatus).toMatch(/^blocked: /);

    const gone = fakeSite({ "/wp-json/wp/v2/types": { status: 404, contentType: "text/html", totalPages: null, text: "nope" } });
    expect((await refreshSiteInventory(websiteId, { fetch: gone.fetch, pauseMs: 0 })).status).toBe("not_wordpress");
    expect(await test.db.select().from(sitePosts).where(eq(sitePosts.websiteId, websiteId))).toHaveLength(0);
  });

  it("is read again daily for websites with a plan; one without the API weekly", async () => {
    const now = new Date("2026-10-20T03:40:00Z");
    const hours = (n: number) => new Date(now.getTime() - n * 3_600_000);
    expect(inventoryDue({ inventoryCheckedAt: null, inventoryStatus: null }, now)).toBe(true);
    expect(inventoryDue({ inventoryCheckedAt: hours(23), inventoryStatus: "ok" }, now)).toBe(false);
    expect(inventoryDue({ inventoryCheckedAt: hours(25), inventoryStatus: "ok" }, now)).toBe(true);
    expect(inventoryDue({ inventoryCheckedAt: hours(25), inventoryStatus: "not_wordpress" }, now)).toBe(false);
    expect(inventoryDue({ inventoryCheckedAt: hours(24 * 8), inventoryStatus: "not_wordpress" }, now)).toBe(true);

    const paid = await seedWebsite(test);
    const unpaid = await seedWebsite(test);
    state.entitled.add(paid.websiteId);
    const due = await websitesDueForInventory(50, now);
    expect(due).toContain(paid.websiteId);
    expect(due).not.toContain(unpaid.websiteId);
  });
});
