import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  adminAuditLog,
  agencyWorkspaces,
  emailBroadcastRecipients,
  emailBroadcasts,
  emailPreferences,
  jobOutbox,
  member,
  session,
  user,
} from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * Email broadcasts end to end against a real (in-process) database, with the
 * provider replaced: who is addressed, that nobody is emailed twice whatever
 * is pressed or retried, that opting out and cancelling are respected to the
 * last moment, and that only an administrator can do any of it. No real email
 * is ever sent: sendEmail is a stub.
 */

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const queue = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/inngest/client", () => ({ inngest: { send: queue.send, createFunction: (config: unknown, handler: unknown) => ({ config, handler }) } }));
const mail = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendEmail: mail.send, emailConfigured: () => true }));

import {
  cancelBroadcastNow,
  countBroadcastAudience,
  deleteBroadcastDraft,
  findBroadcastPeople,
  finishBroadcastImageUpload,
  getBroadcast,
  getBroadcastPerson,
  getBroadcastsAdmin,
  previewBroadcast,
  saveBroadcastDraft,
  scheduleBroadcast,
  sendBroadcastNow,
  sendBroadcastTest,
  startBroadcastImageUpload,
} from "@/lib/admin/broadcasts";
import { audienceSummary } from "@/lib/broadcasts/audience";
import { MAX_ATTEMPTS, REPLAY_LIMIT_MS, requeueStalledBroadcasts, sendBroadcastBatch, STALE_CLAIM_MS, startDueBroadcasts } from "@/lib/broadcasts/engine";
import { setTips } from "@/lib/email/lifecycle";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";

let test: TestDb;
const ADMIN = "admin@repget.test";
const asAdmin = { user: { id: "admin_user", email: ADMIN, emailVerified: true }, session: { id: "s", activeOrganizationId: null } };
const asCustomer = { user: { id: "customer", email: "someone@shop.example", emailVerified: true }, session: { id: "s2", activeOrganizationId: null } };

const DAY = 24 * 60 * 60 * 1000;
let sequence = 0;

async function person(options: { verified?: boolean; tips?: boolean; joined?: Date; seen?: Date; orgId?: string } = {}) {
  const id = `u_${String(sequence++).padStart(4, "0")}`;
  await test.db.insert(user).values({
    id,
    name: id,
    email: `${id}@people.example`,
    emailVerified: options.verified ?? true,
    createdAt: options.joined ?? new Date(),
    updatedAt: new Date(),
  });
  if (options.tips !== undefined) await test.db.insert(emailPreferences).values({ userId: id, tips: options.tips });
  if (options.seen) {
    await test.db.insert(session).values({ id: `s_${id}`, token: `t_${id}`, userId: id, expiresAt: new Date(Date.now() + DAY), createdAt: options.seen, updatedAt: options.seen });
  }
  if (options.orgId) await test.db.insert(member).values({ id: `m_${id}`, organizationId: options.orgId, userId: id, role: "owner", createdAt: new Date() });
  return { id, email: `${id}@people.example` };
}

const content = (over: Record<string, unknown> = {}) => ({
  audience: "all",
  subject: "News",
  previewText: "Short",
  bodyHtml: "<p>Hello</p>",
  images: [],
  ctaLabel: "Open",
  ctaUrl: "https://www.repget.com/dashboard",
  ...over,
});

async function draft(over: Record<string, unknown> = {}) {
  const saved = await saveBroadcastDraft(randomUUID(), 0, content(over));
  if (!saved.ok) throw new Error(saved.error);
  return saved.data;
}

async function started(over: Record<string, unknown> = {}) {
  const d = await draft(over);
  const recipients = await countOf(String(over.audience ?? "all"));
  const result = await sendBroadcastNow(d.id, d.revision, { recipients, word: "SEND" });
  if (!result.ok) throw new Error(result.error);
  return d.id;
}

async function countOf(audience: string) {
  const counted = await countBroadcastAudience(audience);
  return counted.ok ? counted.data.recipients : -1;
}

const recipientsOf = (id: string) => test.db.select().from(emailBroadcastRecipients).where(eq(emailBroadcastRecipients.broadcastId, id));
const broadcastOf = async (id: string) => (await test.db.select().from(emailBroadcasts).where(eq(emailBroadcasts.id, id)))[0];
const sentTo = () => mail.send.mock.calls.map(([options]) => options.to as string).sort();
const batch = (id: string, at: Date = new Date()) => sendBroadcastBatch(id, { paceMs: 0, now: () => at });

beforeAll(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  vi.stubEnv("RESEND_API_KEY", "test-key-not-real");
  vi.stubEnv("EMAIL_FROM", "RepGet <noreply@send.example>");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  state.session = asAdmin;
  await test.db.delete(emailBroadcasts);
  await test.db.delete(adminAuditLog);
  await test.db.delete(jobOutbox);
  await test.db.delete(user);
  mail.send.mockReset();
  mail.send.mockImplementation(async (options: { to: string }) => ({ ok: true, id: `msg_${options.to}` }));
  queue.send.mockReset();
  queue.send.mockResolvedValue({ ids: [] });
});

describe("only an administrator", () => {
  it.each([
    ["a customer", asCustomer],
    ["nobody", null],
    ["an unverified admin address", { ...asAdmin, user: { ...asAdmin.user, emailVerified: false } }],
  ])("refuses %s everywhere", async (_label, who) => {
    const d = await draft();
    state.session = who;
    const id = randomUUID();
    const calls = [
      () => getBroadcastsAdmin(),
      () => getBroadcast(d.id),
      () => countBroadcastAudience("all"),
      () => findBroadcastPeople("people"),
      () => getBroadcastPerson("u_0000"),
      () => previewBroadcast(content()),
      () => saveBroadcastDraft(id, 0, content()),
      () => deleteBroadcastDraft(d.id),
      () => sendBroadcastTest(content()),
      () => sendBroadcastNow(d.id, d.revision, { recipients: 1, word: "SEND" }),
      () => scheduleBroadcast(d.id, d.revision, new Date(Date.now() + DAY).toISOString(), { recipients: 1, word: "SEND" }),
      () => cancelBroadcastNow(d.id),
      () => startBroadcastImageUpload({ type: "image/png", size: 10 }),
      () => finishBroadcastImageUpload({ upload: "x", name: "x" }),
    ];
    for (const call of calls) await expect(call()).rejects.toThrow("Not found");
    expect(mail.send).not.toHaveBeenCalled();
    expect((await broadcastOf(d.id)).status).toBe("draft");
  });
});

describe("who it goes to", () => {
  it("counts real people, and leaves out those who opted out or never proved their address", async () => {
    await person();
    await person({ tips: true });
    await person({ tips: false });
    await person({ verified: false });
    await person({ verified: false, tips: false });
    const summary = await audienceSummary();
    expect(summary).toMatchObject({ registered: 5, suppressed: 3, optedOut: 2, unverified: 2 });
    expect(summary.recipients.all).toBe(2);
    expect(await countOf("all")).toBe(2);
  });

  it("tells paying from free by a running subscription or agency access", async () => {
    const paying = await seedWebsite(test, { status: "active" });
    const trial = await seedWebsite(test, { status: "trialing" });
    const ended = await seedWebsite(test, { status: "canceled" });
    const agency = await seedWebsite(test, { status: null });
    await test.db.insert(agencyWorkspaces).values({ organizationId: agency.orgId });
    for (const orgId of [paying.orgId, trial.orgId, ended.orgId, agency.orgId]) await person({ orgId });
    await person();
    expect(await audienceSummary()).toMatchObject({ recipients: { all: 5, paid: 3, free: 2 } });
    const id = await started({ audience: "free" });
    expect(await recipientsOf(id)).toHaveLength(2);
  });

  it("counts as inactive only someone who joined long ago and has no recent session", async () => {
    const long = new Date(Date.now() - 60 * DAY);
    const inactive = await person({ joined: long });
    const stale = await person({ joined: long, seen: new Date(Date.now() - 40 * DAY) });
    await person({ joined: long, seen: new Date(Date.now() - 2 * DAY) });
    await person({ joined: new Date() });
    expect(await countOf("inactive")).toBe(2);
    const id = await started({ audience: "inactive" });
    expect((await recipientsOf(id)).map((row) => row.userId).sort()).toEqual([inactive.id, stale.id].sort());
  });
});

describe("one person (Admin -> Users -> Send email)", () => {
  it("finds people by email or name, says who would not be sent it, and loads one by id", async () => {
    const plain = await person();
    const out = await person({ tips: false });
    const unproven = await person({ verified: false });
    const found = await findBroadcastPeople("people.example");
    if (!found.ok) throw new Error(found.error);
    expect(found.data.people.map((p) => p.id)).toEqual([plain.id, out.id, unproven.id]);
    expect(found.data.people.find((p) => p.id === out.id)).toMatchObject({ optedOut: true, verified: true });
    expect(found.data.people.find((p) => p.id === unproven.id)).toMatchObject({ optedOut: false, verified: false });
    // One account by its own address; one character finds nothing.
    expect(await findBroadcastPeople(plain.email)).toMatchObject({ ok: true, data: { people: [{ id: plain.id }] } });
    expect(await findBroadcastPeople("u")).toEqual({ ok: true, data: { people: [] } });
    expect(await getBroadcastPerson(plain.id)).toEqual({ id: plain.id, name: plain.id, email: plain.email, verified: true, optedOut: false });
    expect(await getBroadcastPerson("no_such_account")).toBeNull();
  });

  it("sends to the chosen person alone, with the subject and heading as written, without the typed word, and logs it", async () => {
    const chosen = await person();
    await person();
    await person();
    expect((await countBroadcastAudience("person")).ok).toBe(false);
    expect(await countBroadcastAudience("person", chosen.id)).toEqual({ ok: true, data: { recipients: 1 } });
    const d = await draft({ audience: "person", personId: chosen.id, subject: "Just for you", heading: "A note from the team" });
    expect(await getBroadcast(d.id)).toMatchObject({ content: { audience: "person", personId: chosen.id, heading: "A note from the team" } });
    expect(await sendBroadcastNow(d.id, d.revision, { recipients: 1, word: "" })).toEqual({ ok: true, data: { recipients: 1 } });
    expect((await recipientsOf(d.id)).map((row) => row.userId)).toEqual([chosen.id]);

    await batch(d.id);
    expect(sentTo()).toEqual([chosen.email]);
    const [options] = mail.send.mock.calls[0];
    expect(options.subject).toBe("Just for you");
    expect(options.html).toMatch(/<h1[^>]*>A note from the team<\/h1>/);
    const [logged] = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "broadcast.sent"));
    expect(logged.detail).toMatchObject({ audience: "person", personId: chosen.id, recipients: 1 });
    expect((await getBroadcastsAdmin()).rows[0]).toMatchObject({ audience: "person", personEmail: chosen.email });
  });

  it("respects an opt-out and an unverified address, as for everyone", async () => {
    for (const options of [{ tips: false }, { verified: false }]) {
      const who = await person(options);
      const d = await draft({ audience: "person", personId: who.id });
      const refused = await sendBroadcastNow(d.id, d.revision, { recipients: 1, word: "" });
      expect(refused.ok === false && refused.error).toMatch(/cannot be emailed/);
      expect((await broadcastOf(d.id)).status).toBe("draft");
    }
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("sends nothing with nobody chosen, and drops a person from other audiences", async () => {
    const someone = await person();
    const d = await draft({ audience: "person" });
    expect((await sendBroadcastNow(d.id, d.revision, { recipients: 1, word: "" })).ok).toBe(false);
    const all = await draft({ audience: "all", personId: someone.id });
    expect((await broadcastOf(all.id)).personId).toBeNull();
  });
});

describe("drafts", () => {
  it("saves once per new page, however often Save is pressed, and not over a newer save", async () => {
    const id = randomUUID();
    const first = await saveBroadcastDraft(id, 0, content({ subject: "One" }));
    expect(first).toEqual({ ok: true, data: { id, revision: 1 } });
    expect((await saveBroadcastDraft(id, 0, content({ subject: "Again" }))).ok).toBe(false);
    expect(await saveBroadcastDraft(id, 1, content({ subject: "Two" }))).toMatchObject({ ok: true, data: { revision: 2 } });
    // The other tab still holds revision 1.
    expect((await saveBroadcastDraft(id, 1, content({ subject: "Stale" }))).ok).toBe(false);
    expect((await getBroadcast(id))?.content.subject).toBe("Two");
    expect(await test.db.select().from(emailBroadcasts)).toHaveLength(1);
  });

  it("stores sanitised HTML only", async () => {
    const d = await draft({ bodyHtml: '<p onclick="x()">Hi</p><script>alert(1)</script>' });
    expect((await broadcastOf(d.id)).bodyHtml).toBe("<p>Hi</p>");
  });

  it("deletes a draft and nothing that was sent", async () => {
    await person();
    const d = await draft();
    expect((await deleteBroadcastDraft(d.id)).ok).toBe(true);
    const id = await started();
    expect((await deleteBroadcastDraft(id)).ok).toBe(false);
    expect((await test.db.select({ action: adminAuditLog.action }).from(adminAuditLog)).map((row) => row.action)).toEqual(
      expect.arrayContaining(["broadcast.saved", "broadcast.deleted", "broadcast.sent"]),
    );
  });

  it("previews with the code that sends", async () => {
    const preview = await previewBroadcast(content({ subject: "<b>x</b>" }));
    if (!preview.ok) throw new Error(preview.error);
    expect(preview.data.html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(preview.data.html).toContain("/unsubscribe/preview");
    expect(mail.send).not.toHaveBeenCalled();
  });
});

describe("a test", () => {
  it("goes to the signed-in administrator alone", async () => {
    await person();
    expect(await sendBroadcastTest(content())).toEqual({ ok: true, data: { to: ADMIN } });
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0][0]).toMatchObject({ to: ADMIN, subject: "[Test] News" });
    expect(await test.db.select().from(emailBroadcasts)).toHaveLength(0);
  });

  it("is refused while email is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    try {
      const d = await draft();
      expect((await sendBroadcastTest(content())).ok).toBe(false);
      expect((await sendBroadcastNow(d.id, d.revision, { recipients: 1, word: "SEND" })).ok).toBe(false);
      expect((await getBroadcastsAdmin()).problem).toMatch(/RESEND_API_KEY/);
      expect(mail.send).not.toHaveBeenCalled();
    } finally {
      vi.stubEnv("RESEND_API_KEY", "test-key-not-real");
    }
  });
});

describe("sending", () => {
  it("sends once to each person, with a working unsubscribe link and the one-click headers", async () => {
    const people = [await person(), await person(), await person()];
    const id = await started();
    expect((await broadcastOf(id)).status).toBe("sending");
    expect(queue.send).toHaveBeenCalledTimes(1);

    const result = await batch(id);
    expect(result).toMatchObject({ sent: 3, skipped: 0, failed: 0, done: true });
    expect(sentTo()).toEqual(people.map((p) => p.email).sort());
    for (const [options] of mail.send.mock.calls) {
      const who = people.find((p) => p.email === options.to)!;
      const link = /https:\/\/[^"\s]+\/unsubscribe\/([^"\s]+)/.exec(options.html)!;
      expect(verifyUnsubscribeToken(decodeURIComponent(link[1]))).toBe(who.id);
      expect(options.headers["List-Unsubscribe"]).toMatch(/^<https:\/\/.+\/api\/email\/unsubscribe\?token=.+>$/);
      expect(options.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    }
    const keys = mail.send.mock.calls.map(([options]) => options.idempotencyKey);
    expect(new Set(keys).size).toBe(3);
    const row = await broadcastOf(id);
    expect(row.status).toBe("sent");
    expect(row.recipientCount).toBe(3);
    expect((await getBroadcastsAdmin()).rows[0].counts).toEqual({ queued: 0, sent: 3, failed: 0, skipped: 0 });
  });

  it("needs the typed word and an unchanged audience", async () => {
    await person();
    await person();
    const d = await draft();
    expect(await sendBroadcastNow(d.id, d.revision, { recipients: 2, word: "send" })).toEqual({ ok: false, error: "Type SEND to confirm." });
    for (let i = 0; i < 8; i++) await person();
    const changed = await sendBroadcastNow(d.id, d.revision, { recipients: 2, word: "SEND" });
    expect(changed.ok === false && changed.error).toMatch(/audience is now 10 people/);
    expect((await broadcastOf(d.id)).status).toBe("draft");
  });

  it("sends to one person without the typed word", async () => {
    await person();
    const d = await draft();
    expect((await sendBroadcastNow(d.id, d.revision, { recipients: 1, word: "" })).ok).toBe(true);
  });

  it("a double click starts it once", async () => {
    await person();
    await person();
    const d = await draft();
    const confirm = { recipients: 2, word: "SEND" };
    const results = await Promise.all([sendBroadcastNow(d.id, d.revision, confirm), sendBroadcastNow(d.id, d.revision, confirm)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await sendBroadcastNow(d.id, d.revision, confirm)).ok).toBe(false);
    expect(await recipientsOf(d.id)).toHaveLength(2);
    expect(await test.db.select().from(jobOutbox)).toHaveLength(1);
    await batch(d.id);
    await batch(d.id);
    expect(mail.send).toHaveBeenCalledTimes(2);
  });

  it("two workers at once, and a job run again, send to nobody twice", async () => {
    for (let i = 0; i < 6; i++) await person();
    const id = await started();
    await Promise.all([batch(id), batch(id)]);
    await batch(id);
    expect(sentTo()).toHaveLength(6);
    expect(new Set(sentTo()).size).toBe(6);
  });

  it("skips someone who unsubscribed after it started, and a deleted account", async () => {
    const stays = await person();
    const leaves = await person();
    const gone = await person();
    const id = await started();
    await setTips(leaves.id, false, "link", test.db);
    await test.db.delete(user).where(eq(user.id, gone.id));
    const result = await batch(id);
    expect(result).toMatchObject({ sent: 1, skipped: 1, done: true });
    expect(sentTo()).toEqual([stays.email]);
    const [skipped] = await test.db.select().from(emailBroadcastRecipients).where(and(eq(emailBroadcastRecipients.broadcastId, id), eq(emailBroadcastRecipients.userId, leaves.id)));
    expect(skipped).toMatchObject({ status: "skipped", reason: "unsubscribed" });
  });

  it("stops when it is cancelled, mid-batch", async () => {
    for (let i = 0; i < 4; i++) await person();
    const id = await started();
    mail.send.mockImplementationOnce(async () => {
      expect(await cancelBroadcastNow(id)).toMatchObject({ ok: true, data: { was: "sending", notSent: 3 } });
      return { ok: true, id: "m" };
    });
    expect((await batch(id)).done).toBe(true);
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect((await batch(id)).done).toBe(true);
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect((await broadcastOf(id)).status).toBe("cancelled");
    const row = (await getBroadcastsAdmin()).rows[0];
    expect(row.counts).toEqual({ queued: 0, sent: 1, failed: 0, skipped: 3 });
    expect((await cancelBroadcastNow(id)).ok).toBe(false);
  });

  it("does not retry after a cancellation what failed at that moment", async () => {
    await person();
    const id = await started();
    mail.send.mockImplementationOnce(async () => {
      await cancelBroadcastNow(id);
      return { ok: false, error: "rate limited" };
    });
    await batch(id);
    await batch(id, new Date(Date.now() + DAY));
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect((await recipientsOf(id))[0]).toMatchObject({ status: "skipped", reason: "cancelled" });
  });

  it("retries a refused email later with the same key, then leaves it failed", async () => {
    await person();
    const id = await started();
    mail.send.mockResolvedValue({ ok: false, error: "provider down" });
    let at = new Date();
    const first = await batch(id, at);
    expect(first).toMatchObject({ sent: 0, failed: 0, done: false });
    expect(first.waitMs).toBeGreaterThan(50_000);
    // Not due yet: nothing is sent.
    await batch(id, at);
    expect(mail.send).toHaveBeenCalledTimes(1);
    let last = first;
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      at = new Date(at.getTime() + last.waitMs + 1000);
      last = await batch(id, at);
    }
    expect(mail.send).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(new Set(mail.send.mock.calls.map(([options]) => options.idempotencyKey)).size).toBe(1);
    expect(last).toMatchObject({ failed: 1, done: true });
    expect((await recipientsOf(id))[0]).toMatchObject({ status: "failed", reason: "provider down", attempts: MAX_ATTEMPTS });
    expect((await broadcastOf(id)).status).toBe("sent");
  });

  it("takes back a claim whose worker died, with the same key; one too old to repeat is left failed", async () => {
    await person();
    await person();
    const id = await started();
    const [a, b] = await recipientsOf(id);
    const now = Date.now();
    await test.db.update(emailBroadcastRecipients).set({ status: "sending", attempts: 1, claimedAt: new Date(now - STALE_CLAIM_MS - 1000) }).where(eq(emailBroadcastRecipients.id, a.id));
    await test.db.update(emailBroadcastRecipients).set({ status: "sending", attempts: 1, claimedAt: new Date(now - REPLAY_LIMIT_MS - 1000) }).where(eq(emailBroadcastRecipients.id, b.id));
    expect(await batch(id)).toMatchObject({ sent: 1, done: true });
    expect(mail.send.mock.calls[0][0].idempotencyKey).toBe(`broadcast:${a.id}`);
    expect((await recipientsOf(id)).find((row) => row.id === b.id)).toMatchObject({ status: "failed", reason: "outcome unknown: not sent again" });
  });

  it("leaves a claim in progress alone and waits for it", async () => {
    await person();
    const id = await started();
    await test.db.update(emailBroadcastRecipients).set({ status: "sending", attempts: 1, claimedAt: new Date() });
    const result = await batch(id);
    expect(result).toMatchObject({ sent: 0, done: false });
    expect(result.waitMs).toBeGreaterThan(STALE_CLAIM_MS - 60_000);
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("queues again a running broadcast whose job was lost, and not one that is working", async () => {
    await person();
    const id = await started();
    expect(await requeueStalledBroadcasts(new Date())).toEqual([]);
    expect(await requeueStalledBroadcasts(new Date(Date.now() + 2 * 60 * 60 * 1000))).toEqual([id]);
    // The same half hour again: one job.
    await requeueStalledBroadcasts(new Date(Date.now() + 2 * 60 * 60 * 1000));
    expect((await test.db.select().from(jobOutbox)).filter((row) => row.eventId.includes(":resume:"))).toHaveLength(1);
  });
});

describe("scheduling", () => {
  const inAnHour = () => new Date(Date.now() + 60 * 60 * 1000);

  it("starts at its time, to whoever is in the audience then, once", async () => {
    await person();
    const d = await draft();
    const at = inAnHour();
    expect((await scheduleBroadcast(d.id, d.revision, at.toISOString(), { recipients: 1, word: "" })).ok).toBe(true);
    await person();
    expect(await startDueBroadcasts(new Date())).toEqual({ started: [], returned: [] });
    const later = new Date(at.getTime() + 60_000);
    expect((await startDueBroadcasts(later)).started).toEqual([d.id]);
    expect((await startDueBroadcasts(later)).started).toEqual([]);
    expect(await recipientsOf(d.id)).toHaveLength(2);
    await batch(d.id, later);
    expect(mail.send).toHaveBeenCalledTimes(2);
  });

  it("refuses a past time, one too far away, and an incomplete draft", async () => {
    await person();
    const d = await draft();
    const confirm = { recipients: 1, word: "SEND" };
    expect((await scheduleBroadcast(d.id, d.revision, new Date(Date.now() - 1000).toISOString(), confirm)).ok).toBe(false);
    expect((await scheduleBroadcast(d.id, d.revision, new Date(Date.now() + 200 * DAY).toISOString(), confirm)).ok).toBe(false);
    expect((await scheduleBroadcast(d.id, d.revision, "soon", confirm)).ok).toBe(false);
    const empty = await draft({ subject: "" });
    expect((await scheduleBroadcast(empty.id, empty.revision, inAnHour().toISOString(), confirm)).ok).toBe(false);
    expect((await sendBroadcastNow(empty.id, empty.revision, confirm)).ok).toBe(false);
  });

  it("a cancelled one never starts, and a scheduled one cannot be edited", async () => {
    await person();
    const d = await draft();
    const at = inAnHour();
    await scheduleBroadcast(d.id, d.revision, at.toISOString(), { recipients: 1, word: "SEND" });
    expect((await saveBroadcastDraft(d.id, d.revision, content({ subject: "Changed" }))).ok).toBe(false);
    expect((await cancelBroadcastNow(d.id)).ok).toBe(true);
    expect((await startDueBroadcasts(new Date(at.getTime() + DAY))).started).toEqual([]);
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("goes back to a draft when nobody can be emailed at its time", async () => {
    const only = await person();
    const d = await draft();
    const at = inAnHour();
    await scheduleBroadcast(d.id, d.revision, at.toISOString(), { recipients: 1, word: "SEND" });
    await setTips(only.id, false, "settings", test.db);
    expect(await startDueBroadcasts(new Date(at.getTime() + 60_000))).toEqual({ started: [], returned: [d.id] });
    expect((await broadcastOf(d.id)).status).toBe("draft");
    expect(await recipientsOf(d.id)).toHaveLength(0);
  });
});

describe("pictures", () => {
  it("says so when storage is not set up, and takes only what email programs show", async () => {
    expect(await startBroadcastImageUpload({ type: "image/png", size: 10 })).toEqual({ ok: false, error: "Image storage is not set up on this deployment." });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://store.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "not-a-real-key");
    try {
      expect((await startBroadcastImageUpload({ type: "image/webp", size: 10 })).ok).toBe(false);
      expect((await startBroadcastImageUpload({ type: "image/svg+xml", size: 10 })).ok).toBe(false);
      expect((await startBroadcastImageUpload({ type: "image/png", size: 50_000_000 })).ok).toBe(false);
      expect((await finishBroadcastImageUpload({ upload: "../../x.png", name: "x" })).ok).toBe(false);
    } finally {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    }
  });
});
