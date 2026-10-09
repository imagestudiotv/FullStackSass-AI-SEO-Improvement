import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { adminAuditLog, blogSponsorships, spendReservations } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * "Get Featured in This Article" (client, 2026-10-08): $99, once, through
 * RepGet's existing Stripe account and webhook; reviewed by an administrator.
 * Stripe and email are stand-ins; the database is real (PGlite).
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  ip: "203.0.113.7",
  create: vi.fn(),
  retrieve: vi.fn(),
  sendEmail: vi.fn(),
  fulfilAddon: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/stripe/client", () => ({
  stripe: { checkout: { sessions: { create: state.create, retrieve: state.retrieve } } },
  isStripeConfigured: () => Boolean(process.env.STRIPE_SECRET_KEY),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": state.ip }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendEmail: state.sendEmail }));
vi.mock("@/lib/addons/fulfil", () => ({ fulfilAddonPurchase: state.fulfilAddon }));
vi.mock("@/lib/admin/guard", () => ({
  adminEmails: () => ["owner@repget.test"],
  requireAdmin: async () => ({ userId: "admin", email: "owner@repget.test" }),
}));
vi.mock("./posts", () => ({
  getPost: async (slug: string) => (slug === "live-article" ? { slug, title: "A live article" } : null),
}));

import { listPlacements, setPlacementStatus } from "@/lib/admin/blog-sponsorships";
import { processStripeEvent } from "@/lib/billing/stripe-events";
import SponsorshipThanksPage from "@/app/(marketing)/blog/sponsorship/thanks/page";

import { confirmSponsorship, SPONSORSHIP_LIMITS } from "./sponsorship";
import { startBlogSponsorship } from "./sponsorship-actions";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
afterAll(async () => {
  await test.client.close();
  vi.unstubAllEnvs();
});

let n = 0;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_placeholder");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://repget.test");
  // Each test its own visitor, so the hourly limits of one never reach the next.
  n += 1;
  state.ip = `198.51.100.${n}`;
  state.create.mockImplementation(async (_params: unknown, options: { idempotencyKey: string }) => ({
    id: `cs_test_${options.idempotencyKey.split(":")[1].replace(/-/g, "")}`,
    url: "https://checkout.stripe.com/c/pay/test",
  }));
  state.sendEmail.mockResolvedValue({ ok: true, id: "email" });
});

function request(overrides: Partial<{ id: string; slug: string; email: string; website: string; message: string }> = {}) {
  return {
    id: randomUUID(),
    slug: "live-article",
    email: `buyer${n}@example.com`,
    website: "https://example.com",
    message: "Our wedding videography studio in Rome.",
    ...overrides,
  };
}

async function order(id: string) {
  return (await test.db.select().from(blogSponsorships).where(eq(blogSponsorships.id, id)))[0];
}

function paidSession(id: string, checkoutId: string, overrides: Partial<Stripe.Checkout.Session> = {}) {
  return {
    id: checkoutId,
    mode: "payment",
    payment_status: "paid",
    status: "complete",
    amount_total: 9900,
    currency: "usd",
    metadata: { blogSponsorshipId: id, articleSlug: "live-article" },
    ...overrides,
  } as Stripe.Checkout.Session;
}

/** A request that went to Stripe: its id and its checkout's id. */
async function started() {
  const data = request();
  const result = await startBlogSponsorship(data);
  if (!("url" in result)) throw new Error(result.error);
  return { id: data.id, checkoutId: (await order(data.id)).checkoutId! };
}

describe("starting a placement payment", () => {
  it("opens a one-time $99 checkout priced on the server, and the same request reuses it", async () => {
    const data = request();
    // A price sent by the browser is ignored: it is not even read.
    expect(await startBlogSponsorship({ ...data, amount: 1 } as never)).toEqual({ url: "https://checkout.stripe.com/c/pay/test" });
    const [params, options] = state.create.mock.calls[0];
    expect(params).toMatchObject({
      mode: "payment",
      customer_email: data.email,
      metadata: { blogSponsorshipId: data.id, articleSlug: "live-article" },
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: 9900 } }],
      success_url: "https://repget.test/blog/sponsorship/thanks?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://repget.test/blog/live-article?featured=cancelled",
    });
    expect(options).toEqual({ idempotencyKey: `blog-sponsorship:${data.id}` });
    // Nothing promised that the client did not offer.
    expect(JSON.stringify(params)).not.toMatch(/refund/i);
    expect(JSON.stringify(params)).toMatch(/Subject to editorial approval/);

    // Pressed again: the same checkout, no second request or reservation.
    state.retrieve.mockResolvedValue({ status: "open", url: "https://checkout.stripe.com/c/pay/test" });
    const reservations = (await test.db.select().from(spendReservations)).length;
    expect(await startBlogSponsorship(data)).toEqual({ url: "https://checkout.stripe.com/c/pay/test" });
    expect(state.create).toHaveBeenCalledTimes(1);
    expect((await test.db.select().from(spendReservations)).length).toBe(reservations);
  });

  it("takes a website typed without https://, and refuses what is not a web address", async () => {
    const plain = request({ website: "example.com/about" });
    await startBlogSponsorship(plain);
    expect((await order(plain.id)).websiteUrl).toBe("https://example.com/about");

    for (const website of ["javascript:alert(1)", "localhost", "ftp://example.com", "https://user:pass@example.com"]) {
      expect(await startBlogSponsorship(request({ website })), website).toEqual({ error: expect.stringMatching(/website's address/) });
    }
    expect(await startBlogSponsorship(request({ email: "not-an-email" }))).toHaveProperty("error");
    expect(await startBlogSponsorship(request({ message: "   " }))).toHaveProperty("error");
  });

  it("refuses an article that is not published, and points to contact when Stripe is not set up", async () => {
    expect(await startBlogSponsorship(request({ slug: "draft-article" }))).toEqual({ error: "This article is no longer available." });
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(await startBlogSponsorship(request())).toEqual({ error: expect.stringMatching(/contact us/) });
    expect(state.create).not.toHaveBeenCalled();
  });

  it("caps requests per visitor, whatever email they type", async () => {
    for (let i = 0; i < SPONSORSHIP_LIMITS.perVisitorPerHour; i += 1) {
      expect(await startBlogSponsorship(request({ email: `someone${i}@example.com` }))).toHaveProperty("url");
    }
    expect(await startBlogSponsorship(request({ email: "yet-another@example.com" }))).toEqual({ error: expect.stringMatching(/Too many requests/) });
    expect(state.create).toHaveBeenCalledTimes(SPONSORSHIP_LIMITS.perVisitorPerHour);
  });

  it("caps requests per email, from any number of visitors", async () => {
    const email = `same-buyer-${n}@example.com`;
    for (let i = 0; i < SPONSORSHIP_LIMITS.perEmailPerHour; i += 1) {
      state.ip = `192.0.2.${i + 1}`;
      expect(await startBlogSponsorship(request({ email }))).toHaveProperty("url");
    }
    state.ip = "192.0.2.200";
    expect(await startBlogSponsorship(request({ email }))).toEqual({ error: expect.stringMatching(/Too many requests/) });
  });

  it("never reopens a checkout that expired or was paid", async () => {
    const data = request();
    await startBlogSponsorship(data);
    for (const status of ["expired", "complete"]) {
      state.retrieve.mockResolvedValue({ status, url: null });
      expect(await startBlogSponsorship(data)).toHaveProperty("error");
    }
    expect(state.create).toHaveBeenCalledTimes(1);
  });
});

describe("confirming the payment", () => {
  it("counts only this request's own session, paid, one time, exactly $99 in US dollars", async () => {
    const { id, checkoutId } = await started();
    for (const tamper of [
      { id: "cs_test_someone_else" },
      { amount_total: 99 },
      { currency: "eur" },
      { payment_status: "unpaid" as const },
      { mode: "subscription" as const },
    ]) {
      expect(await confirmSponsorship(paidSession(id, checkoutId, tamper))).toBe(false);
    }
    expect((await order(id)).status).toBe("pending");
    expect(state.sendEmail).not.toHaveBeenCalled();
  });

  it("marks it paid once and emails the administrators once, however often Stripe repeats itself", async () => {
    const { id, checkoutId } = await started();
    expect(await confirmSponsorship(paidSession(id, checkoutId))).toBe(true);
    const first = await order(id);
    expect(first).toMatchObject({ status: "paid", paidAt: expect.any(Date) });

    expect(await confirmSponsorship(paidSession(id, checkoutId))).toBe(true);
    expect((await order(id)).paidAt).toEqual(first.paidAt);
    expect(state.sendEmail).toHaveBeenCalledTimes(1);
    expect(state.sendEmail.mock.calls[0][0]).toMatchObject({
      to: "owner@repget.test",
      subject: "Paid placement request: A live article",
      replyTo: first.email,
    });
  });

  it("is a placement in RepGet's existing Stripe webhook, never an add-on purchase", async () => {
    const { id, checkoutId } = await started();
    await processStripeEvent({ type: "checkout.session.completed", data: { object: paidSession(id, checkoutId) } } as Stripe.Event);
    expect((await order(id)).status).toBe("paid");
    expect(state.fulfilAddon).not.toHaveBeenCalled();
  });
});

describe("the page Stripe returns to", () => {
  const render = async (sessionId?: string) =>
    renderToStaticMarkup(await SponsorshipThanksPage({ searchParams: Promise.resolve({ session_id: sessionId }) }));

  it("asks Stripe nothing for a link it does not know, and claims nothing", async () => {
    for (const sessionId of [undefined, "nonsense", "cs_test_madeupmadeupmadeup"]) {
      expect(await render(sessionId)).toContain("We are confirming your payment");
    }
    expect(state.retrieve).not.toHaveBeenCalled();
  });

  it("confirms a waiting request with Stripe once, then reads it from the database", async () => {
    const { id, checkoutId } = await started();
    state.retrieve.mockResolvedValue(paidSession(id, checkoutId));
    const html = await render(checkoutId);
    expect(html).toContain("Thank you - your payment is confirmed");
    expect(html).toContain("A live article");
    expect(html).not.toMatch(/refund/i);
    expect(state.retrieve).toHaveBeenCalledTimes(1);

    await render(checkoutId);
    expect(state.retrieve).toHaveBeenCalledTimes(1);
  });
});

describe("Admin: deciding on paid requests", () => {
  it("lists paid requests apart from unpaid ones, the longest-waiting first", async () => {
    const older = await started();
    await confirmSponsorship(paidSession(older.id, older.checkoutId));
    const newer = await started();
    await confirmSponsorship(paidSession(newer.id, newer.checkoutId));
    const unpaid = await started();

    const review = await listPlacements("review");
    const ids = review.rows.map((row) => row.id);
    expect(ids.indexOf(older.id)).toBeLessThan(ids.indexOf(newer.id));
    expect(ids).not.toContain(unpaid.id);
    expect(review.rows.find((row) => row.id === older.id)?.postTitle).toBeNull(); // the stand-in article is not in the database
    expect((await listPlacements("unpaid")).rows.map((row) => row.id)).toContain(unpaid.id);
  });

  it("publishes or declines only a paid request, records who did it, and can be undone", async () => {
    const paid = await started();
    await confirmSponsorship(paidSession(paid.id, paid.checkoutId));
    const unpaid = await started();

    expect(await setPlacementStatus({ id: unpaid.id, status: "published" })).toEqual({ ok: false, error: expect.stringMatching(/changed/) });
    expect(await setPlacementStatus({ id: paid.id, status: "published" })).toEqual({ ok: true, data: { status: "published" } });
    // A second administrator's stale "Decline" does not overwrite it.
    expect(await setPlacementStatus({ id: paid.id, status: "declined" })).toHaveProperty("ok", false);
    expect(await setPlacementStatus({ id: paid.id, status: "paid" })).toHaveProperty("ok", true);
    expect((await order(paid.id)).status).toBe("paid");

    const log = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, paid.id));
    expect(log.map((entry) => entry.action)).toEqual(["blog.placement_published", "blog.placement_reopened"]);
    expect(log.every((entry) => entry.actorEmail === "owner@repget.test")).toBe(true);
  });
});

// The panel's button, as the article renders it before anyone opens it.
describe("the button on the article", () => {
  it("is the client's pill: Get Featured in This Article", async () => {
    const { BlogSponsorship } = await import("@/components/blog-sponsorship");
    const html = renderToStaticMarkup(createElement(BlogSponsorship, { slug: "live-article", enabled: true }));
    expect(html).toContain("Get Featured in This Article");
    expect(html).toContain('aria-haspopup="dialog"');
  });
});
