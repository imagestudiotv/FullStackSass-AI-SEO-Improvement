import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * A broadcast on REAL Postgres with each worker on its own connection (PGlite
 * has one, so it can only run them in turn): whoever starts it, however many
 * workers send it, one email a person. The provider is a stub.
 */

const route = vi.hoisted(() => ({ store: null as unknown as AsyncLocalStorage<unknown>, fallback: null as unknown }));
vi.mock("@/lib/db", async () => {
  const { AsyncLocalStorage: Als } = await import("node:async_hooks");
  route.store = new Als();
  return { db: new Proxy({}, { get: (_t, p) => Reflect.get((route.store.getStore() ?? route.fallback) as object, p) }) };
});
vi.mock("@/lib/auth-guard", () => ({
  getSession: async () => ({ user: { id: "admin_user", email: "admin@repget.test", emailVerified: true }, session: { id: "s" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn(async () => ({ ids: [] })) } }));
const mail = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendEmail: mail.send }));

import { cancelBroadcastNow, getBroadcastsAdmin, saveBroadcastDraft, sendBroadcastNow } from "@/lib/admin/broadcasts";
import { requeueStalledBroadcasts, sendBroadcastBatch, startDueBroadcasts } from "@/lib/broadcasts/engine";
import { emailBroadcastRecipients, emailBroadcasts, user } from "@/lib/db/schema";

describe.skipIf(!testPostgresUrl())("broadcasts, racing on real Postgres", () => {
  type Db = typeof import("@/lib/db").db;
  let dbs: Db[];
  let dispose: () => Promise<void>;
  const on = <T>(i: number, fn: () => Promise<T>) => (route.store as AsyncLocalStorage<unknown>).run(dbs[i], fn);
  const PEOPLE = 60;

  beforeAll(async () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@repget.test");
    vi.stubEnv("RESEND_API_KEY", "test-key-not-real");
    vi.stubEnv("EMAIL_FROM", "RepGet <noreply@send.example>");
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");
    const created = await createPostgresTestDb(3);
    dbs = created.dbs as unknown as Db[];
    dispose = created.dispose;
    route.fallback = dbs[0];
    await dbs[0].insert(user).values(
      Array.from({ length: PEOPLE }, (_, i) => ({ id: `u_${i}`, name: "P", email: `p${i}@people.example`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() })),
    );
  }, 180_000);

  afterAll(async () => {
    await dispose?.();
  });

  async function draft() {
    const saved = await saveBroadcastDraft(randomUUID(), 0, { audience: "all", subject: "News", previewText: "", bodyHtml: "<p>Hello</p>", images: [], ctaLabel: "", ctaUrl: "" });
    if (!saved.ok) throw new Error(saved.error);
    return saved.data;
  }

  it("two presses at once start it once, and three workers send each person one email", async () => {
    const d = await draft();
    const confirm = { recipients: PEOPLE, word: "SEND" };
    const presses = await Promise.all([0, 1, 2].map((i) => on(i, () => sendBroadcastNow(d.id, d.revision, confirm))));
    expect(presses.filter((press) => press.ok)).toHaveLength(1);

    mail.send.mockReset();
    mail.send.mockImplementation(async (options: { to: string }) => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
      return { ok: true, id: `m_${options.to}` };
    });
    const worker = (i: number) =>
      on(i, async () => {
        for (let batch = 0; batch < 20; batch++) {
          const result = await sendBroadcastBatch(d.id, { paceMs: 0 });
          if (result.done || result.waitMs > 0) return;
        }
      });
    await Promise.all([worker(0), worker(1), worker(2)]);
    await sendBroadcastBatch(d.id, { paceMs: 0 });
    const to = mail.send.mock.calls.map(([options]) => options.to as string);
    expect(to).toHaveLength(PEOPLE);
    expect(new Set(to).size).toBe(PEOPLE);
    const [row] = await dbs[0].select().from(emailBroadcasts).where(eq(emailBroadcasts.id, d.id));
    expect(row).toMatchObject({ status: "sent", recipientCount: PEOPLE });
    expect((await getBroadcastsAdmin()).rows[0].counts).toEqual({ queued: 0, sent: PEOPLE, failed: 0, skipped: 0 });
  }, 60_000);

  it("a cancellation while three workers send leaves nobody queued and stops them", async () => {
    const d = await draft();
    await sendBroadcastNow(d.id, d.revision, { recipients: PEOPLE, word: "SEND" });
    mail.send.mockReset();
    let cancelled: Promise<unknown> | null = null;
    mail.send.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (mail.send.mock.calls.length >= 9 && !cancelled) cancelled = on(0, () => cancelBroadcastNow(d.id));
      return { ok: true, id: "m" };
    });
    await Promise.all(
      [0, 1, 2].map((i) =>
        on(i, async () => {
          for (let batch = 0; batch < 20; batch++) if ((await sendBroadcastBatch(d.id, { paceMs: 0 })).done) return;
        }),
      ),
    );
    await cancelled;
    const rows = await dbs[0].select().from(emailBroadcastRecipients).where(eq(emailBroadcastRecipients.broadcastId, d.id));
    const of = (status: string) => rows.filter((row) => row.status === status).length;
    expect(of("queued") + of("sending")).toBe(0);
    expect(of("sent")).toBe(mail.send.mock.calls.length);
    expect(of("sent")).toBeLessThan(PEOPLE);
    expect(of("skipped")).toBe(PEOPLE - of("sent"));
  }, 60_000);

  it("the clock's own queries run on the real driver", async () => {
    expect(await startDueBroadcasts(new Date())).toEqual({ started: [], returned: [] });
    expect(await requeueStalledBroadcasts(new Date(Date.now() + 60 * 60 * 1000))).toEqual([]);
  });
});
