import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { adminAuditLog, successStories } from "@/lib/db/schema";
import type { SuccessStoryInput } from "@/lib/success-stories/fields";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Admin -> Success stories (client, 2026-11-19): only a verified listed
 * administrator can write, every save is validated (and the address is one
 * story's), and what is published follows Image Studio on every page.
 */

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => cache);

import {
  deleteSuccessStory,
  getSuccessStoryAdmin,
  listSuccessStoriesAdmin,
  moveSuccessStory,
  saveSuccessStory,
  setSuccessStoryPublished,
} from "@/lib/admin/success-stories";
import { getPublishedSuccessStory, listStoryCards, otherStoryCards } from "@/lib/success-stories/stories";

let test: TestDb;
const ADMIN = "admin@repget.test";
const adminSession = { user: { id: "admin_user", email: ADMIN, emailVerified: true }, session: { id: "s", activeOrganizationId: null } };

beforeAll(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  state.session = adminSession;
  cache.revalidatePath.mockReset();
  await test.db.delete(successStories);
});

const input = (over: Partial<SuccessStoryInput> = {}): SuccessStoryInput => ({
  name: "Fixture Founder",
  websiteUrl: "fixture-founder.test",
  logoUrl: "",
  title: "How Fixture Founder grew",
  summary: "A fixture's short summary.",
  categoryLabel: "",
  slug: "",
  bodyHtml: "<h2>The start</h2><p>Words.</p><script>alert(1)</script>",
  metrics: [{ value: "291", label: "researched keywords" }, { value: "", label: "" }],
  discoverSlug: "",
  seoTitle: "",
  seoDescription: "",
  published: false,
  ...over,
});

async function created(over: Partial<SuccessStoryInput> = {}) {
  const result = await saveSuccessStory({ id: null, story: input(over) });
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

describe("the guard", () => {
  it.each([
    ["signed out", null],
    ["not on the list", { user: { id: "u", email: "someone@repget.test", emailVerified: true }, session: { id: "s" } }],
    ["listed but unverified", { user: { id: "u", email: ADMIN, emailVerified: false }, session: { id: "s" } }],
  ])("refuses every action %s, and writes nothing", async (_label, session) => {
    state.session = session;
    await expect(saveSuccessStory({ id: null, story: input() })).rejects.toThrow("Not found");
    await expect(listSuccessStoriesAdmin()).rejects.toThrow("Not found");
    await expect(getSuccessStoryAdmin("00000000-0000-4000-8000-000000000001")).rejects.toThrow("Not found");
    await expect(setSuccessStoryPublished("00000000-0000-4000-8000-000000000001", true)).rejects.toThrow("Not found");
    await expect(moveSuccessStory("00000000-0000-4000-8000-000000000001", "up")).rejects.toThrow("Not found");
    await expect(deleteSuccessStory("00000000-0000-4000-8000-000000000001")).rejects.toThrow("Not found");
    expect(await test.db.select().from(successStories)).toEqual([]);
  });
});

describe("saving", () => {
  it("cleans what it stores: the address from the name, the website, the body sanitised, empty figures dropped", async () => {
    const { id, slug } = await created();
    expect(slug).toBe("fixture-founder");
    const story = await getSuccessStoryAdmin(id);
    expect(story).toMatchObject({
      slug: "fixture-founder",
      websiteUrl: "https://fixture-founder.test/",
      categoryLabel: null,
      metrics: [{ value: "291", label: "researched keywords" }],
      published: false,
      publishedAt: null,
      sortOrder: 1,
    });
    expect(story?.bodyHtml).toContain("<h2>The start</h2>");
    expect(story?.bodyHtml).not.toContain("script");
    const [audit] = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, id));
    expect(audit).toMatchObject({ actorEmail: ADMIN, action: "success_story.created", targetType: "success_story" });
  });

  it.each([
    [{ name: "  " }, /name/],
    [{ title: "" }, /title/],
    [{ summary: "" }, /summary/],
    [{ summary: "x".repeat(321) }, /summary under 320/],
    [{ websiteUrl: "javascript:alert(1)" }, /not a website address/],
    [{ slug: "image-studio" }, /taken by another page/],
    [{ logoUrl: "https://elsewhere.test/logo.png" }, /not one uploaded here/],
    [{ metrics: [{ value: "12", label: "" }] }, /both a value and a label/],
    [{ metrics: Array.from({ length: 7 }, (_, i) => ({ value: String(i), label: "figures" })) }, /6 key figures/],
    [{ discoverSlug: "Not A Slug!" }, /Discover profile/],
    [{ websiteUrl: "https://www.imagestudio.com/" }, /already the pinned first story/],
    [{ name: "Image Studio", websiteUrl: "", slug: "image-studio-again" }, /already the pinned first story/],
  ] as [Partial<SuccessStoryInput>, RegExp][])("refuses %o", async (over, error) => {
    expect(await saveSuccessStory({ id: null, story: input(over) })).toEqual({ ok: false, error: expect.stringMatching(error) });
    expect(await test.db.select().from(successStories)).toEqual([]);
  });

  it("gives each address to one story", async () => {
    await created({ slug: "Dumitru Culiuc" });
    expect(await saveSuccessStory({ id: null, story: input({ slug: "dumitru-culiuc" }) })).toEqual({
      ok: false,
      error: "Another story already uses /success-stories/dumitru-culiuc - choose another address",
    });
    const other = await created({ name: "Other", slug: "" });
    expect(await saveSuccessStory({ id: other.id, story: input({ name: "Other", slug: "dumitru-culiuc" }) })).toMatchObject({ ok: false });
  });

  it("refuses an id that is not a story's", async () => {
    expect(await saveSuccessStory({ id: "not-a-uuid", story: input() })).toEqual({ ok: false, error: "Success story not found" });
    expect(await saveSuccessStory({ id: "00000000-0000-4000-8000-000000000001", story: input() })).toEqual({ ok: false, error: "Success story not found" });
  });
});

describe("what the public pages show", () => {
  it("only published stories, after Image Studio, in the admin's order; the first publication date is kept", async () => {
    const a = await created({ name: "Alpha", published: true });
    const b = await created({ name: "Beta" });
    const c = await created({ name: "Gamma", published: true, logoUrl: "/images/testimonials/image-studio.webp" });

    expect((await listStoryCards("en")).map((card) => card.id)).toEqual(["image-studio", `story:${a.id}`, `story:${c.id}`]);
    expect(await getPublishedSuccessStory("beta")).toBeNull();
    expect((await getPublishedSuccessStory("alpha"))?.title).toBe("How Fixture Founder grew");

    // Publishing from the list; moving the newest to the top - still after Image Studio.
    expect(await setSuccessStoryPublished(b.id, true)).toEqual({ ok: true, data: { published: true } });
    expect(await moveSuccessStory(c.id, "up")).toEqual({ ok: true, data: null });
    expect(await moveSuccessStory(c.id, "up")).toEqual({ ok: true, data: null });
    expect(await moveSuccessStory(c.id, "up")).toEqual({ ok: true, data: null });
    const italian = await listStoryCards("it");
    expect(italian.map((card) => card.id)).toEqual(["image-studio", `story:${c.id}`, `story:${a.id}`, `story:${b.id}`]);
    expect(italian[0].href).toBe("/it/success-stories/image-studio");
    expect(italian[1].href).toBe("/it/success-stories/gamma");
    expect((await otherStoryCards("en")).map((card) => card.id)).toEqual([`story:${c.id}`, `story:${a.id}`, `story:${b.id}`]);

    const first = (await getSuccessStoryAdmin(a.id))?.publishedAt;
    expect(first).toBeInstanceOf(Date);
    expect(await setSuccessStoryPublished(a.id, false)).toEqual({ ok: true, data: { published: false } });
    expect(await saveSuccessStory({ id: a.id, story: input({ name: "Alpha", published: true }) })).toMatchObject({ ok: true });
    expect((await getSuccessStoryAdmin(a.id))?.publishedAt).toEqual(first);

    const paths = cache.revalidatePath.mock.calls.map(([path]) => path);
    expect(paths).toEqual(expect.arrayContaining(["/", "/it", "/success-stories", "/it/success-stories", "/success-stories/alpha", "/de/success-stories/alpha"]));

    expect(await deleteSuccessStory(c.id)).toEqual({ ok: true, data: null });
    expect(await getPublishedSuccessStory("gamma")).toBeNull();
    expect((await listStoryCards("en"))[0].id).toBe("image-studio");
  });
});
