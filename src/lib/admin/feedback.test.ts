import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { adminAuditLog, feedback, organization, user } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Admin -> Feedback (client, 2026-10-19): the list by status and type, one
 * message with the customer it came from, statuses, and a reply emailed to
 * the sender in their language - recorded only once it has gone.
 */

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const mail = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendEmail: mail.send }));

import { getAttention } from "@/lib/admin/dashboard";
import { getFeedbackAdmin, listFeedbackAdmin, replyToFeedback, setFeedbackStatus } from "@/lib/admin/feedback";
import { GET as screenshot } from "@/app/admin/feedback/[id]/screenshot/route";

let test: TestDb;
const ADMIN = "admin@repget.test";
const signedIn = { user: { id: "admin_user", email: ADMIN, emailVerified: true }, session: { id: "s", activeOrganizationId: null } };

beforeAll(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  test = await createTestDb();
  state.db = test.db;
  await test.db.insert(user).values({ id: "user-1", name: "Dana", email: "dana@shop.example" });
  await test.db.insert(organization).values({ id: "org-1", name: "Dana's shop", slug: "danas-shop", createdAt: new Date() });
});

beforeEach(async () => {
  state.session = signedIn;
  await test.db.delete(feedback);
  await test.db.delete(adminAuditLog);
  mail.send.mockReset();
  mail.send.mockResolvedValue({ ok: true, id: "email-1" });
});

async function add(values: Partial<typeof feedback.$inferInsert> = {}) {
  const [row] = await test.db
    .insert(feedback)
    .values({ kind: "idea", message: "A weekly ranking email would help.", email: "sam@example.com", source: "website", ...values })
    .returning({ id: feedback.id });
  return row.id;
}

describe("the list", () => {
  it("shows the new ones first by default, newest first, with counts for each status", async () => {
    await add({ message: "Older idea", createdAt: new Date("2026-10-18T10:00:00Z") });
    await add({ message: "Newer problem", kind: "problem", createdAt: new Date("2026-10-19T10:00:00Z"), screenshot: Buffer.from("webp"), screenshotType: "image/webp" });
    await add({ message: "Already done", status: "done" });
    const list = await listFeedbackAdmin({ view: "", kind: "", page: 1 });
    expect(list.rows.map((row) => row.excerpt)).toEqual(["Newer problem", "Older idea"]);
    expect(list.rows[0]).toMatchObject({ kind: "problem", status: "new", hasScreenshot: true, replies: 0 });
    expect(list.counts).toEqual({ new: 2, planned: 0, done: 1, wont_do: 0 });
    expect(list.total).toBe(2);
  });

  it("filters by status and by type, and the counts follow the type", async () => {
    await add({ kind: "problem", status: "planned" });
    await add({ kind: "idea", status: "planned" });
    await add({ kind: "idea" });
    expect((await listFeedbackAdmin({ view: "planned", kind: "problem", page: 1 })).rows).toHaveLength(1);
    expect((await listFeedbackAdmin({ view: "all", kind: "idea", page: 1 })).counts).toEqual({ new: 1, planned: 1, done: 0, wont_do: 0 });
  });

  it("shows a short excerpt and keeps a page number past the end on the last page", async () => {
    await add({ message: "x".repeat(600) });
    const list = await listFeedbackAdmin({ view: "new", kind: "all", page: 99 });
    expect(list.page).toBe(1);
    expect(list.rows[0].excerpt).toHaveLength(240);
  });

  it("is for administrators only", async () => {
    state.session = { ...signedIn, user: { ...signedIn.user, email: "someone@example.com" } };
    await expect(listFeedbackAdmin({ view: "new", kind: "all", page: 1 })).rejects.toThrow();
  });
});

describe("one message", () => {
  it("comes with the customer and workspace it was sent from", async () => {
    const id = await add({ source: "dashboard", userId: "user-1", organizationId: "org-1", email: "dana@shop.example", pageUrl: "https://www.repget.com/dashboard" });
    expect(await getFeedbackAdmin(id)).toMatchObject({
      id,
      source: "dashboard",
      pageUrl: "https://www.repget.com/dashboard",
      customer: { userId: "user-1", name: "Dana", email: "dana@shop.example", organizationId: "org-1", organizationName: "Dana's shop" },
      replies: [],
    });
    expect(await getFeedbackAdmin("00000000-0000-4000-8000-000000000000")).toBeNull();
    expect(await getFeedbackAdmin("not-an-id")).toBeNull();
  });
});

describe("the status", () => {
  it("changes, and the change is in the admin log", async () => {
    const id = await add();
    expect(await setFeedbackStatus({ id, status: "planned" })).toEqual({ ok: true, data: null });
    expect((await test.db.select().from(feedback).where(eq(feedback.id, id)))[0].status).toBe("planned");
    const [log] = await test.db.select().from(adminAuditLog);
    expect(log).toMatchObject({ actorEmail: ADMIN, action: "feedback.status_changed", targetId: id, summary: "Marked feedback from sam@example.com as planned" });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("refuses what is not a status, or a message that is gone", async () => {
    const id = await add();
    expect(await setFeedbackStatus({ id, status: "archived" })).toEqual({ ok: false, error: "Choose a status" });
    expect(await setFeedbackStatus({ id: "00000000-0000-4000-8000-000000000000", status: "done" })).toMatchObject({ ok: false });
  });
});

describe("a reply", () => {
  it("is emailed in the sender's language, with what is now happening and their message, then recorded", async () => {
    const id = await add({ locale: "it", name: "Giulia", message: "Vorrei un report <settimanale>." });
    expect(await replyToFeedback({ id, message: "Grazie! Lo faremo entro novembre.", status: "planned" })).toEqual({ ok: true, data: null });

    const [{ to, subject, html, text, replyTo }] = mail.send.mock.calls[0];
    expect(to).toBe("sam@example.com");
    expect(replyTo).toBe("support@repget.com");
    expect(subject).toBe("Re: il suo feedback a RepGet");
    expect(text).toBe(
      "Buongiorno Giulia,\n\nGrazie! Lo faremo entro novembre.\n\nLo abbiamo aggiunto ai nostri piani.\n\nIl team di RepGet\n\nIl suo messaggio:\nVorrei un report <settimanale>.",
    );
    expect(html).toContain("Vorrei un report &lt;settimanale&gt;.");

    const [row] = await test.db.select().from(feedback).where(eq(feedback.id, id));
    expect(row.status).toBe("planned");
    expect(row.replies).toEqual([{ message: "Grazie! Lo faremo entro novembre.", by: ADMIN, at: expect.any(String), status: "planned" }]);
    const [log] = await test.db.select().from(adminAuditLog);
    expect(log).toMatchObject({ action: "feedback.replied", summary: "Replied to feedback from sam@example.com and marked it planned" });
  });

  it("without a status change says nothing about one, and later replies are added", async () => {
    const id = await add();
    await replyToFeedback({ id, message: "Thanks, noted." });
    await replyToFeedback({ id, message: "One more thing." });
    expect(mail.send.mock.calls[0][0].text).toBe("Hello,\n\nThanks, noted.\n\nThe RepGet team\n\nYour message:\nA weekly ranking email would help.");
    const [row] = await test.db.select().from(feedback).where(eq(feedback.id, id));
    expect(row.replies.map((reply) => reply.message)).toEqual(["Thanks, noted.", "One more thing."]);
    expect(row.status).toBe("new");
  });

  it("that could not be emailed is not recorded", async () => {
    const id = await add();
    mail.send.mockResolvedValueOnce({ ok: false, error: "Email is not configured on this deployment." });
    expect(await replyToFeedback({ id, message: "Thanks!", status: "done" })).toEqual({
      ok: false,
      error: "The reply could not be sent (Email is not configured on this deployment.). Nothing was recorded - try again.",
    });
    const [row] = await test.db.select().from(feedback).where(eq(feedback.id, id));
    expect(row).toMatchObject({ status: "new", replies: [] });
    expect(await test.db.select().from(adminAuditLog)).toHaveLength(0);
  });

  it("must say something", async () => {
    const id = await add();
    expect(await replyToFeedback({ id, message: " " })).toEqual({ ok: false, error: "Write the reply first" });
    expect(mail.send).not.toHaveBeenCalled();
  });
});

describe("the screenshot", () => {
  const call = (id: string) => screenshot(new Request(`http://localhost/admin/feedback/${id}/screenshot`), { params: Promise.resolve({ id }) });

  it("is served to administrators, never cached", async () => {
    const id = await add({ screenshot: Buffer.from([1, 2, 3]), screenshotType: "image/webp" });
    const response = await call(id);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3]);
  });

  it("does not exist for anyone else, nor for a message without one", async () => {
    const id = await add({ screenshot: Buffer.from([1, 2, 3]), screenshotType: "image/webp" });
    state.session = null;
    expect((await call(id)).status).toBe(404);
    state.session = signedIn;
    expect((await call(await add())).status).toBe(404);
    expect((await call("nope")).status).toBe(404);
  });
});

describe("the admin overview", () => {
  it("counts the feedback nobody has read yet", async () => {
    await add();
    await add();
    await add({ status: "done" });
    expect((await getAttention()).newFeedback).toBe(2);
  });
});
