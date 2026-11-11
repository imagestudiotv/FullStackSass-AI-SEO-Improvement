import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

/**
 * A business's showcase profile in the blog editor (client, 2026-11-11 round
 * 2): its fields are tidied and checked (limits, the address made of
 * letters, digits and hyphens), stored and read back; the address is unique
 * in each language and a translation keeps it; the website stays http(s).
 */

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/indexnow", () => ({ notifyIndexNow: vi.fn() }));

import { createBlogTranslation, getBlogPostAdmin, saveBlogPost, type BlogPostInput } from "@/lib/admin/blog";
import { cleanBusinessProfile } from "@/lib/blog/post-fields";
import { discoverSlug, EMPTY_PROFILE, isDiscoverSlug, PROFILE_LIMITS, type BusinessProfile } from "@/lib/discover/profile-fields";

let test: TestDb;
const ADMIN = "admin@repget.test";

beforeAll(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://repget.test");
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(() => {
  state.session = { user: { id: "admin_user", email: ADMIN, emailVerified: true }, session: { id: "s_admin", activeOrganizationId: null } };
});

let n = 0;
function input(overrides: Partial<BlogPostInput> = {}): BlogPostInput {
  n += 1;
  return {
    title: `Profile story ${n}`,
    slug: "",
    description: "How a studio grew.",
    seoTitle: "",
    primaryKeyword: "",
    secondaryKeywords: [],
    breadcrumbLabel: "",
    category: "Customer stories",
    author: "",
    shortAnswer: "",
    bodyHtml: "<p>Text.</p>",
    faqs: [],
    sources: [],
    ...overrides,
  };
}
const profile = (overrides: Partial<BusinessProfile> = {}): BusinessProfile => ({ ...EMPTY_PROFILE, ...overrides });

describe("the profile's fields", () => {
  it("tidies the address and the lists, and keeps paragraphs", () => {
    expect(discoverSlug("  Image Studio!  ")).toBe("image-studio");
    expect(discoverSlug("Café Été")).toBe("cafe-ete");
    expect(isDiscoverSlug("image-studio")).toBe(true);
    for (const bad of ["", "Image", "-a", "a--b", "a/b", "../x", "a".repeat(61)]) expect(isDiscoverSlug(bad), bad).toBe(false);

    const clean = cleanBusinessProfile(
      profile({
        slug: "Image Studio",
        tags: " Photography \n\nFilm   & Video\nphotography\n",
        services: "Weddings\nBrands",
        about: "  First   line.\r\nSame paragraph.\n\n\n\nSecond.  ",
        audience: "",
        location: "  Rome  and Milan ",
      }),
    );
    expect(clean).toEqual({
      businessSlug: "image-studio",
      businessTags: ["Photography", "Film & Video"],
      businessLocation: "Rome and Milan",
      businessAvailability: null,
      businessAbout: "First line.\nSame paragraph.\n\nSecond.",
      businessAudience: null,
      businessServices: ["Weddings", "Brands"],
      businessIndustry: null,
    });
    expect(cleanBusinessProfile(null)).toMatchObject({ businessSlug: null, businessTags: [], businessServices: [] });
  });

  it("refuses what is over the limits rather than cutting it", () => {
    const tooMany = Array.from({ length: PROFILE_LIMITS.tags + 1 }, (_, i) => `Tag ${i}`).join("\n");
    expect(() => cleanBusinessProfile(profile({ tags: tooMany }))).toThrow(/Up to 6/);
    expect(() => cleanBusinessProfile(profile({ services: "x".repeat(PROFILE_LIMITS.service + 1) }))).toThrow(/too long/);
    expect(() => cleanBusinessProfile(profile({ about: "x".repeat(PROFILE_LIMITS.about + 1) }))).toThrow(/About/);
    expect(() => cleanBusinessProfile(profile({ location: "x".repeat(PROFILE_LIMITS.location + 1) }))).toThrow(/location/);
    expect(() => cleanBusinessProfile(profile({ slug: "!!!" }))).toThrow(/address/);
    expect(() => cleanBusinessProfile(profile({ slug: "a".repeat(PROFILE_LIMITS.slug + 1) }))).toThrow(/address/);
    expect(() => cleanBusinessProfile(profile({ slug: "search" }))).toThrow(/directory/);
  });
});

describe("saving a profile", () => {
  it("stores and reads it back; a translation keeps the address; the address is unique in each language", async () => {
    const saved = await saveBlogPost({
      id: null,
      expectedVersion: 0,
      status: "published",
      post: input({
        business: { logoUrl: "", name: "Image Studio", category: "Creative", websiteUrl: "imagestudio.com", tagline: "Films" },
        businessProfile: profile({ slug: "Image Studio", tags: "Photography\nFilm", services: "Weddings", industry: "Photography", location: "Rome", availability: "Worldwide", about: "About it.", audience: "Couples." }),
      }),
    });
    if (!saved.ok) throw new Error(saved.error);
    const post = await getBlogPostAdmin(saved.data.id);
    expect(post?.businessProfile).toEqual({
      slug: "image-studio",
      tags: "Photography\nFilm",
      location: "Rome",
      availability: "Worldwide",
      about: "About it.",
      audience: "Couples.",
      services: "Weddings",
      industry: "Photography",
    });
    expect(post?.business.websiteUrl).toBe("https://imagestudio.com/");

    // A save without the profile keeps it.
    const again = await saveBlogPost({ id: saved.data.id, expectedVersion: saved.data.version, status: "published", post: input({ title: "Renamed", slug: saved.data.slug }) });
    expect(again.ok).toBe(true);
    expect((await getBlogPostAdmin(saved.data.id))?.businessProfile.slug).toBe("image-studio");

    // Another English post cannot take the address.
    const clash = await saveBlogPost({ id: null, expectedVersion: 0, status: "draft", post: input({ businessProfile: profile({ slug: "image-studio" }) }) });
    expect(clash).toEqual({ ok: false, error: expect.stringContaining("/discover/image-studio") });

    // The Italian translation keeps it (/it/discover/image-studio).
    const translated = await createBlogTranslation({ sourceId: saved.data.id, locale: "it", mode: "copy" });
    if (!translated.ok) throw new Error(translated.error);
    expect((await getBlogPostAdmin(translated.data.id))?.businessProfile).toEqual(post?.businessProfile);

    // A different Italian post cannot take it either; an Italian post may use another.
    const itClash = await saveBlogPost({ id: null, expectedVersion: 0, status: "draft", post: input({ locale: "it", businessProfile: profile({ slug: "image-studio" }) }) });
    expect(itClash.ok).toBe(false);
    const itOther = await saveBlogPost({ id: null, expectedVersion: 0, status: "draft", post: input({ locale: "it", businessProfile: profile({ slug: "altro-studio" }) }) });
    expect(itOther.ok).toBe(true);
  });

  it("keeps the website http(s) only", async () => {
    const refused = await saveBlogPost({
      id: null,
      expectedVersion: 0,
      status: "draft",
      post: input({
        business: { logoUrl: "", name: "X", category: "", websiteUrl: "javascript:alert(1)", tagline: "" },
        businessProfile: profile({ slug: "x-co" }),
      }),
    });
    expect(refused.ok).toBe(false);
  });
});
