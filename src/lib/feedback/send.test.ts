import { eq } from "drizzle-orm";
import sharp from "sharp";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { feedback, organization, spendReservations, user } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Receiving feedback for RepGet (client, 2026-10-19): from site visitors and
 * signed-in customers, an idea, a problem or anything else, with an optional
 * screenshot - checked, limited, stored privately, and the administrators
 * told by email.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
const mail = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendEmail: mail.send }));

import { FEEDBACK_RATE, MIN_ELAPSED_MS, submitFeedback, type FeedbackInput, type FeedbackSender } from "./send";
import { linkCount } from "./shared";

let test: TestDb;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com");
  vi.stubEnv("ADMIN_EMAILS", "admin@repget.test");
  test = await createTestDb();
  state.db = test.db;
  await test.db.insert(user).values({ id: "user-1", name: "Dana", email: "dana@shop.example" });
  await test.db.insert(organization).values({ id: "org-1", name: "Dana's shop", slug: "danas-shop", createdAt: new Date() });
});

beforeEach(async () => {
  await test.db.delete(feedback);
  await test.db.delete(spendReservations);
  mail.send.mockReset();
  mail.send.mockResolvedValue({ ok: true, id: "email" });
});

const visitor = (overrides: Partial<FeedbackSender> = {}): FeedbackSender => ({
  source: "website",
  visitor: "visitor-hash-1",
  userId: null,
  accountEmail: null,
  organizationId: null,
  ...overrides,
});

const input = (overrides: Partial<FeedbackInput> = {}): FeedbackInput => ({
  kind: "idea",
  message: "Please add a weekly email with my rankings.",
  email: "Visitor@Example.com ",
  name: "  Sam  ",
  pageUrl: "https://repget.com/pricing?plan=pro",
  locale: "it",
  screenshot: null,
  trap: "",
  elapsedMs: 12_000,
  ...overrides,
});

const rows = () => test.db.select().from(feedback);

describe("feedback from a site visitor", () => {
  it("is stored privately and the administrators get an email they can reply to", async () => {
    const result = await submitFeedback(input(), visitor());
    expect(result).toMatchObject({ ok: true });
    const [row] = await rows();
    expect(row).toMatchObject({
      kind: "idea",
      message: "Please add a weekly email with my rankings.",
      email: "visitor@example.com",
      name: "Sam",
      source: "website",
      userId: null,
      pageUrl: "https://www.repget.com/pricing?plan=pro",
      locale: "it",
      status: "new",
      replies: [],
      screenshot: null,
      visitor: "visitor-hash-1",
    });
    expect(mail.send).toHaveBeenCalledTimes(1);
    const [{ to, subject, text, replyTo }] = mail.send.mock.calls[0];
    expect(to).toBe("admin@repget.test");
    expect(replyTo).toBe("visitor@example.com");
    expect(subject).toBe("New feedback (Idea): Please add a weekly email with my rankings.");
    expect(text).toContain(`https://www.repget.com/admin/feedback/${row.id}`);
    expect(text).toContain("Sam <visitor@example.com>, a visitor, from the website.");
  });

  it("keeps a screenshot as a WebP no wider than 1,600 pixels", async () => {
    const png = await sharp({ create: { width: 2400, height: 1500, channels: 3, background: "#ffffff" } }).png().toBuffer();
    await submitFeedback(input({ kind: "problem", screenshot: { data: png, type: "image/png" } }), visitor());
    const [row] = await rows();
    expect(row.screenshotType).toBe("image/webp");
    const meta = await sharp(Buffer.from(row.screenshot as Uint8Array)).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 1600 });
    expect(mail.send.mock.calls[0][0].text).toContain("A screenshot is attached in the admin panel.");
  });

  it("keeps the page only when it is one of RepGet's own", async () => {
    await submitFeedback(input({ pageUrl: "https://evil.example/phish" }), visitor());
    await submitFeedback(input({ pageUrl: "/tools/robots-checker", message: "The robots checker could explain more." }), visitor());
    const pages = (await rows()).map((row) => row.pageUrl).sort();
    expect(pages).toEqual(["https://www.repget.com/tools/robots-checker", null].sort());
  });

  it("is refused, saying why, when it cannot be sent as it is", async () => {
    const cases: [Partial<FeedbackInput>, string][] = [
      [{ kind: "complaint" }, "kind"],
      [{ message: "Too short" }, "message_short"],
      [{ message: "x".repeat(5001) }, "message_long"],
      [{ message: "Cheap links https://a.example https://b.example https://c.example www.d.example http://e.example http://f.example" }, "links"],
      [{ email: "not-an-address" }, "email"],
      [{ name: "n".repeat(101) }, "name"],
      [{ screenshot: { data: Buffer.from("GIF89a"), type: "image/gif" } }, "screenshot_type"],
      [{ screenshot: { data: Buffer.alloc(901 * 1024), type: "image/png" } }, "screenshot_size"],
      [{ screenshot: { data: Buffer.from("not really a png"), type: "image/png" } }, "screenshot_unreadable"],
    ];
    for (const [change, code] of cases) {
      expect(await submitFeedback(input(change), visitor()), code).toEqual({ ok: false, code });
    }
    expect(await rows()).toHaveLength(0);
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("thanks a bot without storing or sending anything", async () => {
    expect(await submitFeedback(input({ trap: "Acme Inc" }), visitor())).toEqual({ ok: true });
    expect(await submitFeedback(input({ elapsedMs: MIN_ELAPSED_MS - 1 }), visitor())).toEqual({ ok: true });
    expect(await submitFeedback(input({ elapsedMs: Number.NaN }), visitor())).toEqual({ ok: true });
    expect(await rows()).toHaveLength(0);
    expect(mail.send).not.toHaveBeenCalled();
  });
});

describe("feedback from a signed-in customer", () => {
  it("uses their account address and is linked to them and their workspace", async () => {
    await submitFeedback(
      input({ email: "someone-else@example.com", kind: "problem", message: "The calendar does not load on my phone." }),
      visitor({ source: "dashboard", userId: "user-1", accountEmail: "Dana@Shop.Example", organizationId: "org-1" }),
    );
    const [row] = await rows();
    expect(row).toMatchObject({ source: "dashboard", email: "dana@shop.example", userId: "user-1", organizationId: "org-1" });
    expect(mail.send.mock.calls[0][0].text).toContain("a customer, from the dashboard");
  });
});

describe("the limits", () => {
  it("allow five an hour from one visitor, counted as used so the day's limit remembers them", async () => {
    for (let n = 0; n < FEEDBACK_RATE.perVisitorPerHour; n += 1) {
      expect(await submitFeedback(input({ message: `Idea number ${n} for the dashboard.` }), visitor())).toMatchObject({ ok: true });
    }
    expect(await submitFeedback(input(), visitor())).toEqual({ ok: false, code: "too_many" });
    // Another visitor is not affected.
    expect(await submitFeedback(input(), visitor({ visitor: "visitor-hash-2" }))).toMatchObject({ ok: true });
    const states = new Set((await test.db.select().from(spendReservations)).map((row) => row.state));
    expect([...states]).toEqual(["consumed"]);
  });

  it("say the form is busy when everyone together has sent too much", async () => {
    const before = FEEDBACK_RATE.globalPerHour;
    FEEDBACK_RATE.globalPerHour = 1;
    try {
      expect(await submitFeedback(input(), visitor({ visitor: "a" }))).toMatchObject({ ok: true });
      expect(await submitFeedback(input(), visitor({ visitor: "b" }))).toEqual({ ok: false, code: "busy" });
    } finally {
      FEEDBACK_RATE.globalPerHour = before;
    }
    expect(await test.db.select().from(feedback).where(eq(feedback.visitor, "b"))).toHaveLength(0);
  });
});

describe("links in a message", () => {
  it("are counted however they are written", () => {
    expect(linkCount("See https://a.example and http://b.example and www.c.example")).toBe(3);
    expect(linkCount("No links, just an email: dana@shop.example")).toBe(0);
  });
});
