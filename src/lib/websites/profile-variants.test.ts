import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { competitors, keywords, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/*
  The customer's own edits after the 2026-11-27 review: a typed keyword that
  only re-spells one already there is not stored twice, and a suggested
  competitor they remove stays removed for the AI visibility sync
  (lib/geo/competitors.ts). Auth is mocked at the tenant boundary; rows are real.
*/
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
async function contextFor(websiteId: string) {
  const db = state.db as TestDb["db"];
  const [site] = await db.select().from(websites).where(eq(websites.id, websiteId));
  return { site, orgId: site.organizationId, userId: "owner", access: "owner" as const };
}
vi.mock("@/lib/tenant", () => ({ requireWebsite: vi.fn(contextFor) }));
vi.mock("@/lib/websites/require-editor", () => ({
  requireEditor: vi.fn(async (id: string) => ({ ok: true, context: await contextFor(id) })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/i18n/app-locale", async () => {
  const { getMessages } = await import("@/lib/i18n/messages");
  return { getAppMessages: async () => ({ t: getMessages("en"), locale: "en" }) };
});
const inngestMock = vi.hoisted(() => ({ send: vi.fn(), createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })) }));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));
vi.mock("@/lib/notifications/create", () => ({ notify: vi.fn() }));
vi.mock("@/lib/websites/verify-domain", () => ({
  verifyDomain: vi.fn(async (domain: string) => ({ domain, alive: true, reason: "http 200" })),
  keepLiveDomains: vi.fn(async (domains: string[]) => ({ live: domains, dropped: [] })),
}));

import { addKeywords } from "@/lib/keywords/actions";
import { addCompetitor, removeCompetitor } from "@/lib/websites/actions";

let test: TestDb;
beforeAll(async () => { test = await createTestDb(); state.db = test.db; });
beforeEach(() => { inngestMock.send.mockReset(); inngestMock.send.mockResolvedValue({ ids: [] }); });

describe("addKeywords", () => {
  it("skips another spelling of a keyword the website has, or of one typed alongside it", async () => {
    const { websiteId } = await seedWebsite(test);
    await test.db.insert(keywords).values({ websiteId, term: "привітання для мужчини", source: "dataforseo_ideas" });
    const added = await addKeywords(websiteId, "привітання для мужчині, dentist dublin, dublin dentist, привітання для мужчини");
    expect(added).toMatchObject({ ok: true, data: { added: 1, skipped: 3 } });
    const terms = (await test.db.select({ term: keywords.term }).from(keywords).where(eq(keywords.websiteId, websiteId))).map((r) => r.term).sort();
    expect(terms).toEqual(["dentist dublin", "привітання для мужчини"].sort());
  });

  it("stores nothing, without failing, when every term is a variant", async () => {
    const { websiteId } = await seedWebsite(test);
    await test.db.insert(keywords).values({ websiteId, term: "running shoes", source: "dataforseo_ideas" });
    expect(await addKeywords(websiteId, "running shoe")).toMatchObject({ ok: true, data: { added: 0, skipped: 1 } });
  });
});

describe("competitors the customer removes", () => {
  const rows = async (websiteId: string) =>
    (await test.db.select({ domain: competitors.domain, source: competitors.source }).from(competitors).where(eq(competitors.websiteId, websiteId)))
      .sort((a, b) => a.domain.localeCompare(b.domain));

  it("deletes their own entry, keeps a removed suggestion as a hidden marker, and lets them add it back", async () => {
    const { websiteId } = await seedWebsite(test);
    await test.db.insert(competitors).values([
      { websiteId, domain: "mine.example", source: "manual" },
      { websiteId, domain: "suggested.example", source: "ai_visibility" },
    ]);
    expect((await removeCompetitor(websiteId, "mine.example")).ok).toBe(true);
    expect((await removeCompetitor(websiteId, "suggested.example")).ok).toBe(true);
    expect(await rows(websiteId)).toEqual([{ domain: "suggested.example", source: "dismissed" }]);

    expect((await addCompetitor(websiteId, "https://suggested.example")).ok).toBe(true);
    expect(await rows(websiteId)).toEqual([{ domain: "suggested.example", source: "manual" }]);
  });
});
