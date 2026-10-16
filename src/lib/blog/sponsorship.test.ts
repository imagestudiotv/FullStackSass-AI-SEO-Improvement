import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { adminAuditLog, blogPosts, blogSponsorships, spendReservations } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * "Get Featured in This Article" (client, 2026-10-08): €99 (dollars until 2026-10-16), once, through
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
// One live article in English and one in Italian (slugs are unique across languages).
vi.mock("./posts", () => {
  const live: Record<string, { slug: string; title: string; locale: "en" | "it" }> = {
    "live-article": { slug: "live-article", title: "A live article", locale: "en" },
    "articolo-vivo": { slug: "articolo-vivo", title: "Un articolo vivo", locale: "it" },
  };
  return {
    getPost: async (slug: string, locale = "en") => (live[slug]?.locale === locale ? live[slug] : null),
    getPostInAnyLanguage: async (slug: string) => live[slug] ?? null,
  };
});

import { listPlacements, setPlacementStatus } from "@/lib/admin/blog-sponsorships";
import { processStripeEvent } from "@/lib/billing/stripe-events";
import LocaleSponsorshipThanksPage from "@/app/(marketing)/[locale]/blog/sponsorship/thanks/page";
import SponsorshipThanksPage from "@/app/(marketing)/blog/sponsorship/thanks/page";
import { LOCALES } from "@/lib/i18n/config";

import { confirmSponsorship, SPONSORSHIP_CENTS, SPONSORSHIP_CURRENCY, SPONSORSHIP_LIMITS } from "./sponsorship";
import { startBlogSponsorship, type SponsorshipInput } from "./sponsorship-actions";
import { SPONSORSHIP_COPY } from "./sponsorship-copy";

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
  // Served by Vercel, whose edge sets x-real-ip: the only place that header
  // identifies a visitor (lib/visitor-key.ts).
  vi.stubEnv("VERCEL", "1");
  // Each test its own visitor, so the hourly limits of one never reach the next.
  n += 1;
  state.ip = `198.51.100.${n}`;
  state.create.mockImplementation(async (_params: unknown, options: { idempotencyKey: string }) => ({
    id: `cs_test_${options.idempotencyKey.split(":")[1].replace(/-/g, "")}`,
    url: "https://checkout.stripe.com/c/pay/test",
  }));
  state.sendEmail.mockResolvedValue({ ok: true, id: "email" });
});

/** A request as the panel sends it; `locale` may be anything, as a forged one could be. */
function request(overrides: Partial<{ id: string; slug: string; locale: string; email: string; website: string; message: string }> = {}) {
  return {
    id: randomUUID(),
    slug: "live-article",
    email: `buyer${n}@example.com`,
    website: "https://example.com",
    message: "Our wedding videography studio in Rome.",
    ...overrides,
  } as SponsorshipInput & { id: string; slug: string; email: string; website: string; message: string };
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
    currency: "eur",
    metadata: { blogSponsorshipId: id, articleSlug: "live-article" },
    ...overrides,
  } as Stripe.Checkout.Session;
}

/** A request that went to Stripe: its id and its checkout's id. */
async function started(overrides: Parameters<typeof request>[0] = {}) {
  const data = request(overrides);
  const result = await startBlogSponsorship(data);
  if (!("url" in result)) throw new Error(result.error);
  return { id: data.id, checkoutId: (await order(data.id)).checkoutId! };
}

describe("starting a placement payment", () => {
  it("opens a one-time €99 checkout priced on the server, and the same request reuses it", async () => {
    const data = request();
    // A price sent by the browser is ignored: it is not even read.
    expect(await startBlogSponsorship({ ...data, amount: 1 } as never)).toEqual({ url: "https://checkout.stripe.com/c/pay/test" });
    const [params, options] = state.create.mock.calls[0];
    expect(params).toMatchObject({
      mode: "payment",
      customer_email: data.email,
      metadata: { blogSponsorshipId: data.id, articleSlug: "live-article" },
      line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: 9900 } }],
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
  it("counts only this request's own session, paid, one time, exactly €99", async () => {
    const { id, checkoutId } = await started();
    for (const tamper of [
      { id: "cs_test_someone_else" },
      { amount_total: 99 },
      { currency: "gbp" },
      { amount_total: 9000, currency: "usd" },
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
    expect(state.sendEmail.mock.calls[0][0].text).toContain("paid €99.00 for a sponsored mention");
  });

  it("a dollar checkout opened before the switch to euros still counts, and the email says what was paid", async () => {
    const { id, checkoutId } = await started();
    expect(await confirmSponsorship(paidSession(id, checkoutId, { currency: "usd" }))).toBe(true);
    expect((await order(id)).status).toBe("paid");
    expect(state.sendEmail.mock.calls[0][0].text).toContain("paid US$99.00 for a sponsored mention");
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
  const button = async (locale: "en" | "it") => {
    const { BlogSponsorship } = await import("@/components/blog-sponsorship");
    return renderToStaticMarkup(
      createElement(BlogSponsorship, { slug: "live-article", locale, enabled: true, copy: SPONSORSHIP_COPY[locale].panel, contactHref: "/contact" }),
    );
  };

  it("is the client's pill: Get Featured in This Article", async () => {
    const html = await button("en");
    expect(html).toContain("Get Featured in This Article");
    expect(html).toContain('aria-haspopup="dialog"');
  });

  it("is in the article's language on a translated article", async () => {
    expect(await button("it")).toContain(SPONSORSHIP_COPY.it.panel.trigger);
  });
});

/** The offer in every language (client, 2026-10-15): lib/blog/sponsorship-copy.ts. */
describe("in every language", () => {
  it("every language has all of it, and the price is the server's", () => {
    const keys = (value: object): string[] =>
      Object.entries(value).flatMap(([key, inner]) => (typeof inner === "object" ? keys(inner).map((k) => `${key}.${k}`) : [key]));
    const english = keys(SPONSORSHIP_COPY.en).sort();
    for (const locale of LOCALES) {
      expect(keys(SPONSORSHIP_COPY[locale]).sort(), locale).toEqual(english);
      const empty = keys(SPONSORSHIP_COPY[locale]).filter((key) => {
        const value = key.split(".").reduce<unknown>((at, part) => (at as Record<string, unknown>)[part], SPONSORSHIP_COPY[locale]);
        return typeof value !== "string" || !value.trim();
      });
      expect(empty, locale).toEqual([]);
      const { panel, thanks } = SPONSORSHIP_COPY[locale];
      expect(panel.start, locale).toContain("{price}");
      expect(panel.continue, locale).toContain("{price}");
      expect(thanks.paidWithTitle, locale).toContain("{title}");
      expect(thanks.writeTo, locale).toContain("{email}");
      // Never a promise the client did not make.
      expect(JSON.stringify(SPONSORSHIP_COPY[locale]), locale).not.toMatch(/refund|rimbors|reembols|rembours|erstatt/i);
    }
    expect([SPONSORSHIP_CENTS, SPONSORSHIP_CURRENCY]).toEqual([9900, "eur"]);
    expect(SPONSORSHIP_COPY.en.panel.price).toBe("€99");
    // A non-breaking space: the sign never wraps onto a line of its own.
    for (const locale of LOCALES.filter((l) => l !== "en")) expect(SPONSORSHIP_COPY[locale].panel.price, locale).toBe("99\u00a0€");
  });

  it("an Italian article: Stripe's page, its texts and the way back are Italian", async () => {
    const data = request({ slug: "articolo-vivo", locale: "it" });
    expect(await startBlogSponsorship(data)).toEqual({ url: "https://checkout.stripe.com/c/pay/test" });
    const [params] = state.create.mock.calls[0];
    expect(params).toMatchObject({
      locale: "it",
      metadata: { blogSponsorshipId: data.id, articleSlug: "articolo-vivo", articleLocale: "it" },
      line_items: [{ price_data: { currency: "eur", unit_amount: 9900, product_data: { name: SPONSORSHIP_COPY.it.stripe.productName } } }],
      success_url: "https://repget.test/it/blog/sponsorship/thanks?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://repget.test/it/blog/articolo-vivo?featured=cancelled",
      custom_text: { submit: { message: SPONSORSHIP_COPY.it.stripe.submitMessage } },
    });
    expect((await order(data.id)).postSlug).toBe("articolo-vivo");
  });

  it("answers in the article's language, and finds the article only in it", async () => {
    expect(await startBlogSponsorship(request({ slug: "articolo-vivo", locale: "it", website: "localhost" }))).toEqual({
      error: SPONSORSHIP_COPY.it.errors.website,
    });
    // An English slug on an Italian page, and the other way round: no such article there.
    expect(await startBlogSponsorship(request({ slug: "live-article", locale: "it" }))).toEqual({ error: SPONSORSHIP_COPY.it.errors.gone });
    expect(await startBlogSponsorship(request({ slug: "articolo-vivo" }))).toEqual({ error: SPONSORSHIP_COPY.en.errors.gone });
    // A language the site does not have is refused, in English.
    expect(await startBlogSponsorship(request({ locale: "xx" }))).toEqual({ error: SPONSORSHIP_COPY.en.errors.invalid });
    // A forged call that sends no object at all: the same answer, not a crash.
    for (const forged of [null, [], [null], "it"]) {
      expect(await startBlogSponsorship(forged as never), JSON.stringify(forged)).toEqual({ error: SPONSORSHIP_COPY.en.errors.invalid });
    }
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(await startBlogSponsorship(request({ slug: "articolo-vivo", locale: "it" }))).toEqual({ error: SPONSORSHIP_COPY.it.errors.notConfigured });
    expect(state.create).not.toHaveBeenCalled();
  });

  it("the page after paying is Italian, and leads back to the Italian article", async () => {
    const { id, checkoutId } = await started({ slug: "articolo-vivo", locale: "it" });
    state.retrieve.mockResolvedValue(paidSession(id, checkoutId, { metadata: { blogSponsorshipId: id, articleSlug: "articolo-vivo" } }));
    const render = async (locale: string, sessionId?: string) =>
      renderToStaticMarkup(
        await LocaleSponsorshipThanksPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({ session_id: sessionId }) }),
      );
    const html = await render("it", checkoutId);
    expect(html).toContain(SPONSORSHIP_COPY.it.thanks.paidTitle);
    expect(html).toContain("Un articolo vivo");
    expect(html).toContain('href="/it/blog/articolo-vivo"');
    expect(html).toContain('href="/it/contact"');
    expect(await render("it", "cs_test_madeupmadeupmadeup")).toContain(SPONSORSHIP_COPY.it.thanks.waitingTitle);
    await expect(render("en", checkoutId)).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it("the administrators' email says which language's article the mention goes in", async () => {
    const { id, checkoutId } = await started({ slug: "articolo-vivo", locale: "it" });
    expect(await confirmSponsorship(paidSession(id, checkoutId))).toBe(true);
    expect(state.sendEmail).toHaveBeenCalledTimes(1);
    expect(state.sendEmail.mock.calls[0][0]).toMatchObject({ subject: "Paid placement request: Un articolo vivo" });
    expect(state.sendEmail.mock.calls[0][0].text).toContain('"Un articolo vivo" (Italian, /it/blog/articolo-vivo)');
  });

  it("the admin list names the article's language", async () => {
    // A real published Italian article, for the list's join.
    const [post] = await test.db
      .insert(blogPosts)
      .values({ slug: "articolo-in-lista", title: "Articolo in lista", category: "Guides", author: "RepGet team", status: "published", publishedAt: new Date(), locale: "it" })
      .returning({ id: blogPosts.id });
    try {
      const data = request({ slug: "articolo-in-lista", locale: "it" });
      // Started straight in the database: the stand-in posts above do not know this article.
      await test.db.insert(blogSponsorships).values({ id: data.id, postSlug: data.slug, email: data.email, websiteUrl: data.website, message: data.message });
      const row = (await listPlacements("unpaid")).rows.find((r) => r.id === data.id);
      expect(row).toMatchObject({ postTitle: "Articolo in lista", postLocale: "it" });

      // Its decision is logged with the article's real, Italian address.
      await test.db.update(blogSponsorships).set({ status: "paid", paidAt: new Date() }).where(eq(blogSponsorships.id, data.id));
      expect(await setPlacementStatus({ id: data.id, status: "published" })).toEqual({ ok: true, data: { status: "published" } });
      const [entry] = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, data.id));
      expect(entry.summary).toContain("in /it/blog/articolo-in-lista");
    } finally {
      await test.db.delete(blogPosts).where(eq(blogPosts.id, post.id));
    }
  });
});
