import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { brandVoice, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/*
  Brand voice saves against a real (PGlite) database. Auth is mocked at the
  tenant boundary only: the caller "is" whoever owns the website, with the
  access the test sets.
*/
const state = vi.hoisted(() => ({ db: null as unknown, access: "owner" }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

async function contextFor(websiteId: string) {
  const db = state.db as TestDb["db"];
  const [site] = await db.select().from(websites).where(eq(websites.id, websiteId));
  if (!site) throw new Error("not found");
  return { site, orgId: site.organizationId, userId: "user_1", access: state.access };
}
vi.mock("@/lib/tenant", () => ({ requireWebsite: vi.fn(contextFor) }));
vi.mock("@/lib/websites/require-editor", () => ({
  requireEditor: vi.fn(async (id: string) => {
    const context = await contextFor(id);
    return context.access === "viewer"
      ? { ok: false, error: "You have view-only access to this website." }
      : { ok: true, context };
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getBrandVoice, updateBrandVoice } from "./actions";
import { saveArticleSettings } from "@/lib/websites/article-settings";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(() => {
  state.access = "owner";
});

const SOCIAL = [{ platform: "LinkedIn", url: "https://www.linkedin.com/company/acme" }];
const EXAMPLES = ["https://acme.example/blog/our-best-post"];

/** A site whose brand voice already has social links and example articles - set elsewhere, not on Article Settings. */
async function siteWithVoice() {
  const { websiteId } = await seedWebsite(test);
  await test.db.insert(brandVoice).values({
    websiteId,
    tone: "Warm",
    vocabulary: "treatment",
    avoid: "cheap",
    usps: ["Same-day appointments"],
    facts: ["Open since 2004"],
    socialLinks: SOCIAL,
    articleInstructions: "Never put a year in the title.",
    exampleArticleUrls: EXAMPLES,
  });
  return websiteId;
}

async function storedVoice(websiteId: string) {
  const [row] = await test.db.select().from(brandVoice).where(eq(brandVoice.websiteId, websiteId));
  return row;
}

/** Exactly what the Article Settings form sends: every voice field it has, and no social links or example URLs. */
const FORM_SAVE = {
  articleStyle: "expert",
  internalLinkTarget: 3,
  targetWordCount: null,
  sitemapUrl: "",
  blogUrl: "",
  exampleArticleUrl: "",
  brandColor: "",
  imageStyle: "realistic",
  featuredImageStyle: "match",
  imageBrief: "",
  imageInstructions: "",
  tableOfContents: true,
  youtubeVideo: false,
  authorPerspective: true,
  mentionSimilarProducts: true,
  comparisonTable: true,
  poweredByLink: true,
  authorName: "",
  authorBio: "",
  tone: "Friendly and reassuring",
  vocabulary: "treatment",
  avoid: "cheap",
  usps: "Same-day appointments\nWe see nervous patients",
  facts: "Open since 2004",
  articleInstructions: "Never put a year in the title.",
};

describe("saving Article Settings", () => {
  it("keeps the brand voice's social links and example articles, which the form does not carry", async () => {
    const websiteId = await siteWithVoice();

    expect(await saveArticleSettings(websiteId, FORM_SAVE)).toEqual({ ok: true, data: null });

    const row = await storedVoice(websiteId);
    expect(row.socialLinks).toEqual(SOCIAL);
    expect(row.exampleArticleUrls).toEqual(EXAMPLES);
    // What the form did send is written.
    expect(row.tone).toBe("Friendly and reassuring");
    expect(row.usps).toEqual(["Same-day appointments", "We see nervous patients"]);
    // And the page reads them back unchanged.
    const view = await getBrandVoice(websiteId);
    expect(view.socialLinks).toEqual(SOCIAL);
    expect(view.exampleArticleUrls).toEqual(EXAMPLES);
  });

  it("keeps them through 'Keep the defaults' too, which sends the untouched form", async () => {
    const websiteId = await siteWithVoice();
    await saveArticleSettings(websiteId, { ...FORM_SAVE, tone: "Warm", usps: "Same-day appointments" });
    const row = await storedVoice(websiteId);
    expect(row.socialLinks).toEqual(SOCIAL);
    expect(row.exampleArticleUrls).toEqual(EXAMPLES);
    const [site] = await test.db.select().from(websites).where(eq(websites.id, websiteId));
    expect(site.articleSettingsReviewedAt).not.toBeNull();
  });

  it("refuses a viewer and changes nothing", async () => {
    const websiteId = await siteWithVoice();
    state.access = "viewer";
    expect((await saveArticleSettings(websiteId, FORM_SAVE)).ok).toBe(false);
    const row = await storedVoice(websiteId);
    expect(row.tone).toBe("Warm");
    expect(row.socialLinks).toEqual(SOCIAL);
  });
});

describe("updateBrandVoice", () => {
  it("leaves every field it was not given as stored", async () => {
    const websiteId = await siteWithVoice();
    expect(await updateBrandVoice(websiteId, { tone: "Calm" })).toEqual({ ok: true, data: null });
    const row = await storedVoice(websiteId);
    expect(row).toMatchObject({
      tone: "Calm",
      vocabulary: "treatment",
      avoid: "cheap",
      usps: ["Same-day appointments"],
      facts: ["Open since 2004"],
      socialLinks: SOCIAL,
      articleInstructions: "Never put a year in the title.",
      exampleArticleUrls: EXAMPLES,
    });
  });

  it("still clears a field that is sent empty, social links and example URLs included", async () => {
    const websiteId = await siteWithVoice();
    await updateBrandVoice(websiteId, { tone: "", usps: "", socialLinks: [], exampleArticleUrls: "" });
    const row = await storedVoice(websiteId);
    expect(row.tone).toBeNull();
    expect(row.usps).toEqual([]);
    expect(row.socialLinks).toEqual([]);
    expect(row.exampleArticleUrls).toEqual([]);
    expect(row.vocabulary).toBe("treatment");
  });

  it("still validates and replaces social links when they are sent", async () => {
    const websiteId = await siteWithVoice();
    const refused = await updateBrandVoice(websiteId, { socialLinks: [{ platform: "X", url: "not a url" }] });
    expect(refused.ok).toBe(false);
    expect((await storedVoice(websiteId)).socialLinks).toEqual(SOCIAL);

    await updateBrandVoice(websiteId, { socialLinks: [{ platform: "X", url: "https://x.com/acme" }] });
    expect((await storedVoice(websiteId)).socialLinks).toEqual([{ platform: "X", url: "https://x.com/acme" }]);
  });

  it("creates the row on a site that has none", async () => {
    const { websiteId } = await seedWebsite(test);
    await updateBrandVoice(websiteId, { tone: "Plain" });
    const row = await storedVoice(websiteId);
    expect(row.tone).toBe("Plain");
    expect(row.socialLinks).toEqual([]);
    expect(row.exampleArticleUrls).toEqual([]);
  });
});
