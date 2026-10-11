import { asc, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { adminAuditLog, testimonials } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Admin -> Testimonials (client, 2026-10-11): the sample cards migration 0055
 * loads, the rules for publishing (no untouched sample, the person's
 * agreement confirmed), order, deletion, and what the homepage reads.
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
  deleteTestimonial,
  getTestimonialAdmin,
  listTestimonialsAdmin,
  moveTestimonial,
  saveTestimonial,
  type TestimonialInput,
} from "@/lib/admin/testimonials";
import { listPublishedTestimonials, listTestimonialsForPreview } from "@/lib/marketing/testimonials-db";

let test: TestDb;
const ADMIN = "admin@repget.test";

beforeAll(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(() => {
  state.session = { user: { id: "admin_user", email: ADMIN, emailVerified: true }, session: { id: "s", activeOrganizationId: null } };
  cache.revalidatePath.mockReset();
});

const card = (over: Partial<TestimonialInput> = {}): TestimonialInput => ({
  name: "Fixture Studio",
  role: "Photo & Film Studio, run by RepGet's founder",
  quote: "Fixture words the person agreed to.",
  avatarUrl: "/images/testimonials/image-studio.webp",
  published: false,
  permissionConfirmed: false,
  ...over,
});

async function sampleRow() {
  const [row] = await test.db.select().from(testimonials).where(eq(testimonials.sample, true)).orderBy(asc(testimonials.sortOrder)).limit(1);
  return row;
}

describe("the sample cards from the design package", () => {
  it("are loaded by the migration as unpublished drafts, in the package's order, and none reaches the homepage", async () => {
    const all = await listTestimonialsAdmin();
    const samples = all.filter((row) => row.sample);
    expect(samples).toHaveLength(12);
    expect(samples.map((row) => row.name).slice(0, 3)).toEqual(["Image Studio", "Culiucs", "Stefan Coetzer"]);
    expect(samples.every((row) => !row.published && row.avatarUrl?.startsWith("/preview/testimonials/sample-"))).toBe(true);
    expect(await listPublishedTestimonials()).toEqual([]);
    expect((await listTestimonialsForPreview()).length).toBe(12);
  });

  it("cannot be published as they are, even with the box ticked", async () => {
    const row = await sampleRow();
    const result = await saveTestimonial({
      id: row.id,
      card: { name: row.name, role: row.role, quote: row.quote, avatarUrl: row.avatarUrl, published: true, permissionConfirmed: true },
    });
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/sample card/) });
    expect((await getTestimonialAdmin(row.id))?.published).toBe(false);
  });

  it("stop being samples once their words are replaced, and can then go live with the person's agreement", async () => {
    const row = await sampleRow();
    const real = { name: row.name, role: "Photo & Film Studio, run by RepGet's founder", quote: "Real words, agreed in writing.", avatarUrl: row.avatarUrl };

    const unconfirmed = await saveTestimonial({ id: row.id, card: { ...real, published: true, permissionConfirmed: false } });
    expect(unconfirmed).toEqual({ ok: false, error: expect.stringMatching(/agreed in writing/) });

    const draft = await saveTestimonial({ id: row.id, card: { ...real, published: false, permissionConfirmed: false } });
    expect(draft).toEqual({ ok: true, data: { id: row.id, published: false, sample: false } });

    const live = await saveTestimonial({ id: row.id, card: { ...real, published: true, permissionConfirmed: true } });
    expect(live.ok && live.data.published).toBe(true);
    const saved = await getTestimonialAdmin(row.id);
    expect(saved).toMatchObject({ published: true, sample: false, permissionConfirmedBy: ADMIN });
    expect(await listPublishedTestimonials()).toEqual([{ name: row.name, role: real.role, quote: real.quote, avatar: row.avatarUrl }]);
    // The homepages in every language, the plan screen and the preview are refreshed.
    expect(cache.revalidatePath.mock.calls.map(([path]) => path)).toEqual(expect.arrayContaining(["/", "/it", "/onboarding/plan", "/preview/testimonials"]));

    // A live card's words changing needs the agreement again; moving it does not.
    const changed = await saveTestimonial({ id: row.id, card: { ...real, quote: "Other words.", published: true, permissionConfirmed: false } });
    expect(changed.ok).toBe(false);

    const unpublished = await saveTestimonial({ id: row.id, card: { ...real, published: false, permissionConfirmed: false } });
    expect(unpublished.ok && unpublished.data.published).toBe(false);
    const actions = (await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, row.id))).map((entry) => entry.action);
    expect(actions).toEqual(expect.arrayContaining(["testimonial.saved", "testimonial.published", "testimonial.unpublished"]));
  });
});

describe("writing a card", () => {
  it("adds a new one last in the order, and publishes it only with the agreement confirmed", async () => {
    expect(await saveTestimonial({ id: null, card: card({ published: true }) })).toEqual({
      ok: false,
      error: expect.stringMatching(/agreed in writing/),
    });
    const created = await saveTestimonial({ id: null, card: card({ published: true, permissionConfirmed: true }) });
    expect(created.ok).toBe(true);
    const all = await listTestimonialsAdmin();
    expect(all.at(-1)).toMatchObject({ name: "Fixture Studio", published: true, sample: false, permissionConfirmedBy: ADMIN });
  });

  it("checks the fields and refuses a picture from elsewhere", async () => {
    expect(await saveTestimonial({ id: null, card: card({ name: " " }) })).toEqual({ ok: false, error: "Add the person's or company's name" });
    expect(await saveTestimonial({ id: null, card: card({ quote: "" }) })).toEqual({ ok: false, error: "Add the quote" });
    expect((await saveTestimonial({ id: null, card: card({ quote: "x".repeat(601) }) })).ok).toBe(false);
    for (const avatarUrl of ["https://elsewhere.example/face.webp", "/etc/passwd", "javascript:alert(1)"]) {
      expect(await saveTestimonial({ id: null, card: card({ avatarUrl }) })).toEqual({ ok: false, error: "That picture is not one uploaded here - upload it again" });
    }
    expect((await saveTestimonial({ id: null, card: card({ avatarUrl: null }) })).ok).toBe(true);
  });

  it("moves a card up and down the homepage order, and deletes one", async () => {
    const before = await listTestimonialsAdmin();
    const second = before[1];
    expect((await moveTestimonial(second.id, "up")).ok).toBe(true);
    const after = await listTestimonialsAdmin();
    expect(after[0].id).toBe(second.id);
    expect(after[1].id).toBe(before[0].id);

    expect((await deleteTestimonial(second.id)).ok).toBe(true);
    expect(await getTestimonialAdmin(second.id)).toBeNull();
    const [audit] = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, second.id)).orderBy(asc(adminAuditLog.createdAt));
    expect(audit).toBeDefined();
  });

  it("reads no card, without failing the homepage, while the table does not exist yet", async () => {
    const original = state.db;
    state.db = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: async () => {
              throw Object.assign(new Error('relation "testimonials" does not exist'), { code: "42P01" });
            },
          }),
        }),
      }),
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(await listPublishedTestimonials()).toEqual([]);
    } finally {
      warn.mockRestore();
      state.db = original;
    }
  });

  it("is for administrators only", async () => {
    state.session = { user: { id: "u1", email: "customer@example.test", emailVerified: true }, session: { id: "s1", activeOrganizationId: "o1" } };
    await expect(listTestimonialsAdmin()).rejects.toThrow();
    await expect(saveTestimonial({ id: null, card: card() })).rejects.toThrow();
  });
});
