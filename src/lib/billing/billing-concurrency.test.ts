import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const inngestMock = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));

import { oweCancellation, processCancellations, type CancellationOps } from "@/lib/billing/cancellations";
import { beginCheckout, type CheckoutProviderOps } from "@/lib/billing/checkouts";
import { syncProviderSubscription } from "@/lib/billing/subscription-sync";
import { deliverJobs, MAX_DELIVERY_ATTEMPTS } from "@/lib/jobs/outbox";
import {
  billingCheckouts,
  jobOutbox,
  organization,
  plans,
  subscriptions,
  websites,
} from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { FREE_ARTICLES_DAYS } from "@/lib/plans/features";
import {
  deleteWebsiteIfBillingResolved,
  deleteWorkspaceIfBillingResolved,
} from "@/lib/websites/deletion";
import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * Lock coordination between deletion, checkout creation and the webhooks,
 * on a real Postgres with separate connections. Skipped unless
 * TEST_POSTGRES_URL names a disposable server (see src/test/postgres.ts).
 *
 * Each case holds a deletion open at its last step - every check passed, the
 * delete not yet run - and shows that a writer on another connection waits
 * for it rather than slipping in, then does the right thing once the
 * deletion commits.
 */

const available = Boolean(testPostgresUrl());

/** Deletion must never reach a provider in these tests. */
const noProviders: CheckoutProviderOps = {
  expireStripeCheckout: async () => {
    throw new Error("provider unreachable");
  },
  payPalApprovalState: async () => {
    throw new Error("provider unreachable");
  },
  stripeSessionState: async () => {
    throw new Error("provider unreachable");
  },
  findStripeSession: async () => {
    throw new Error("provider unreachable");
  },
};

/** A provider that accepts every owed cancellation. */
function cancellations() {
  const cancel = vi.fn(async () => "cancelled" as const);
  return { ops: { cancel } satisfies CancellationOps, cancel };
}

/** A loader for a subscription the provider says is live for this site. */
function live(siteId: string, status = "trialing") {
  return async () => ({
    organizationId: "org_a",
    claimedOrganizationId: "org_a",
    claimedWebsiteId: siteId,
    values: { status },
  });
}

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function settledWithin(promise: Promise<unknown>, ms: number) {
  return Promise.race([
    promise.then(
      () => true,
      () => true,
    ),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms)),
  ]);
}

describe.skipIf(!available)("billing locks on real Postgres", () => {
  let a: Database;
  let b: Database;
  let dispose: () => Promise<void>;
  let siteId: string;
  let planId: string;

  beforeAll(async () => {
    const created = await createPostgresTestDb(2);
    [a, b] = created.dbs as unknown as Database[];
    dispose = created.dispose;
  }, 120_000);

  afterAll(async () => {
    await dispose?.();
  });

  beforeEach(async () => {
    await a.delete(organization);
    await a.delete(plans);
    const [plan] = await a
      .insert(plans)
      .values({
        name: "Growth",
        priceCents: 4900,
        articleLimit: 30,
        keywordLimit: 100,
        siteLimit: 1,
        monthlyCredits: 0,
      })
      .returning();
    planId = plan.id;
    await a
      .insert(organization)
      .values({ id: "org_a", name: "Acme", slug: "acme", createdAt: new Date() });
    const [site] = await a
      .insert(websites)
      .values({ organizationId: "org_a", url: "https://acme.test", domain: "acme.test" })
      .returning();
    siteId = site.id;
  });

  /** Starts a deletion and pauses it after its checks, holding its locks. */
  function pausedWebsiteDeletion() {
    const entered = gate();
    const hold = gate();
    const result = deleteWebsiteIfBillingResolved(a, {
      websiteId: siteId,
      organizationId: "org_a",
      providers: noProviders,
      beforeDelete: async () => {
        entered.release();
        await hold.promise;
      },
    });
    return { entered: entered.promise, release: hold.release, result };
  }

  it("a checkout opened during a website deletion waits, then is refused", async () => {
    const deletion = pausedWebsiteDeletion();
    await deletion.entered;

    const checkout = beginCheckout(
      b,
      { organizationId: "org_a", websiteId: siteId, provider: "stripe", planId },
      noProviders,
    ).catch(() => "error");
    expect(await settledWithin(checkout, 500)).toBe(false);

    deletion.release();
    expect(await deletion.result).toEqual({ ok: true });
    expect(await checkout).toEqual({ kind: "refuse", error: "Website not found" });
    expect(await a.select().from(billingCheckouts)).toHaveLength(0);
  });

  it("a checkout opened first makes the deletion refuse", async () => {
    // Opened on B and committed before the deletion starts on A.
    const begun = await beginCheckout(
      b,
      { organizationId: "org_a", websiteId: siteId, provider: "stripe", planId },
      noProviders,
    );
    expect(begun.kind).toBe("create");

    const result = await deleteWebsiteIfBillingResolved(a, {
      websiteId: siteId,
      organizationId: "org_a",
      providers: noProviders,
    });

    expect(result.ok).toBe(false);
    const rows = await a.select().from(websites).where(eq(websites.id, siteId));
    expect(rows).toHaveLength(1);
  });

  it("a webhook attaching a plan during a website deletion waits, then records it unattached and cancels", async () => {
    const deletion = pausedWebsiteDeletion();
    await deletion.entered;

    const { ops, cancel } = cancellations();
    const sync = syncProviderSubscription(
      b,
      { provider: "stripe", providerSubscriptionId: "sub_race", load: live(siteId) },
      ops,
    );
    expect(await settledWithin(sync, 500)).toBe(false);

    deletion.release();
    expect(await deletion.result).toEqual({ ok: true });
    expect(await sync).toMatchObject({
      outcome: "detached_deleted_website",
      cancellationOwed: true,
      cancelled: true,
    });
    expect(cancel).toHaveBeenCalledWith("stripe", "sub_race", "detached_deleted_website");
    const [row] = await a.select().from(subscriptions);
    expect(row).toMatchObject({ websiteId: null, stripeSubscriptionId: "sub_race" });
  });

  it("a subscription activated just before the deletion's lock makes it refuse", async () => {
    // B records the plan and commits; A's locked re-read then sees it.
    await syncProviderSubscription(
      b,
      { provider: "stripe", providerSubscriptionId: "sub_first", load: live(siteId) },
      cancellations().ops,
    );

    const result = await deleteWebsiteIfBillingResolved(a, {
      websiteId: siteId,
      organizationId: "org_a",
      providers: noProviders,
    });

    expect(!result.ok && result.error).toMatch(/active subscription/);
  });

  it("writers wait for a workspace deletion, then find the workspace gone", async () => {
    const entered = gate();
    const hold = gate();
    const deletion = deleteWorkspaceIfBillingResolved(a, {
      organizationId: "org_a",
      providers: noProviders,
      beforeDelete: async () => {
        entered.release();
        await hold.promise;
      },
    });
    await entered.promise;

    const { ops } = cancellations();
    const sync = syncProviderSubscription(
      b,
      { provider: "stripe", providerSubscriptionId: "sub_orphan", load: live(siteId) },
      ops,
    );
    expect(await settledWithin(sync, 500)).toBe(false);

    hold.release();
    expect(await deletion).toEqual({ ok: true });
    expect(await sync).toMatchObject({
      outcome: "orphaned_deleted_workspace",
      cancellationOwed: true,
      cancelled: true,
    });
    expect(await a.select().from(subscriptions)).toHaveLength(0);
  });

  it("a website deletion and a workspace deletion do not deadlock", async () => {
    const entered = gate();
    const hold = gate();
    const workspace = deleteWorkspaceIfBillingResolved(a, {
      organizationId: "org_a",
      providers: noProviders,
      beforeDelete: async () => {
        entered.release();
        await hold.promise;
      },
    });
    await entered.promise;

    const site = deleteWebsiteIfBillingResolved(b, {
      websiteId: siteId,
      organizationId: "org_a",
      providers: noProviders,
    });
    expect(await settledWithin(site, 500)).toBe(false);

    hold.release();
    expect(await workspace).toEqual({ ok: true });
    expect(await site).toEqual({ ok: false, error: "Website not found." });
  });

  it("concurrent checkouts for one website make one provider checkout", async () => {
    const results = await Promise.all(
      [a, b].map((database) =>
        beginCheckout(
          database,
          { organizationId: "org_a", websiteId: siteId, provider: "stripe", planId },
          noProviders,
        ),
      ),
    );
    expect(results.filter((r) => r.kind === "create")).toHaveLength(1);
    expect(results.find((r) => r.kind !== "create")).toMatchObject({
      kind: "refuse",
      error: expect.stringMatching(/being prepared/),
    });
    expect(await a.select().from(billingCheckouts)).toHaveLength(1);
  });

  it("simultaneous checkouts for two websites offer the workspace one free-articles trial", async () => {
    const [second] = await a
      .insert(websites)
      .values({ organizationId: "org_a", url: "https://two.test", domain: "two.test" })
      .returning();
    const results = await Promise.all([
      beginCheckout(
        a,
        { organizationId: "org_a", websiteId: siteId, provider: "stripe", planId },
        noProviders,
      ),
      beginCheckout(
        b,
        { organizationId: "org_a", websiteId: second.id, provider: "stripe", planId },
        noProviders,
      ),
    ]);
    const trials = results.map((r) => (r.kind === "create" ? r.trialDays : -1));
    expect(trials.sort((x, y) => x - y)).toEqual([0, FREE_ARTICLES_DAYS]);
  });

  it("two syncs of the SAME subscription read the provider one after the other", async () => {
    const [row] = await a
      .insert(subscriptions)
      .values({
        organizationId: "org_a",
        websiteId: siteId,
        status: "active",
        stripeSubscriptionId: "sub_same",
      })
      .returning();
    const first = gate();
    let seenBySecond: string | null = null;

    // A: a delivery that read an older "past_due" and is slow to write it.
    const older = syncProviderSubscription(
      a,
      {
        provider: "stripe",
        providerSubscriptionId: "sub_same",
        load: async () => {
          await first.promise;
          return live(siteId, "past_due")();
        },
      },
      cancellations().ops,
    );
    await new Promise((resolve) => setTimeout(resolve, 100));

    // B: the cancellation. Its provider read must come after A's write.
    const newer = syncProviderSubscription(
      b,
      {
        provider: "stripe",
        providerSubscriptionId: "sub_same",
        load: async (tx) => {
          const [current] = await tx
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, row.id));
          seenBySecond = current.status;
          return live(siteId, "canceled")();
        },
      },
      cancellations().ops,
    );
    expect(await settledWithin(newer, 500)).toBe(false);

    first.release();
    await Promise.all([older, newer]);
    // B ran only once A had committed: it saw A's write, then wrote last.
    expect(seenBySecond).toBe("past_due");
    const [final] = await a.select().from(subscriptions).where(eq(subscriptions.id, row.id));
    expect(final.status).toBe("canceled");
  });

  it("two maintenance workers cancel an owed subscription once", async () => {
    let calls = 0;
    const slow: CancellationOps = {
      cancel: async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 200));
        return "cancelled";
      },
    };
    /*
      Owed the way production owes it. A raw INSERT took next_attempt_at from
      the database clock (microseconds), while the workers compare against
      the app's Date (milliseconds): a worker that ran in the same
      millisecond found the row not yet due, and nothing was cancelled.
    */
    await oweCancellation(a, { provider: "stripe", providerSubscriptionId: "sub_owed", reason: "detached_deleted_website" });
    const [first, second] = await Promise.all([
      processCancellations(a, slow),
      processCancellations(b, slow),
    ]);
    expect(calls).toBe(1);
    expect([...first.completed, ...second.completed]).toEqual(["sub_owed"]);
  });

  it("an outbox worker that outlived its lease cannot fail work another worker delivered", async () => {
    await a.update(websites).set({ status: "pending" }).where(eq(websites.id, siteId));
    const t0 = new Date("2026-09-26T12:00:00Z");
    await a.insert(jobOutbox).values({
      eventId: "evt-lease",
      name: "website/analyze.requested",
      data: { websiteId: siteId, reservations: [] },
      attempts: MAX_DELIVERY_ATTEMPTS - 1,
      nextAttemptAt: t0,
    });
    let failA!: (error: Error) => void;
    inngestMock.send.mockReset();
    inngestMock.send
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { failA = reject; }))
      .mockResolvedValueOnce({ ids: ["evt-lease"] });

    const workerA = deliverJobs(a, { now: t0 });
    await vi.waitFor(() => expect(inngestMock.send).toHaveBeenCalledTimes(1));
    const workerB = await deliverJobs(b, { now: new Date(t0.getTime() + 120_000) });
    expect(workerB.sent).toEqual(["evt-lease"]);

    failA(new Error("timeout"));
    expect((await workerA).lost).toEqual(["evt-lease"]);
    const [job] = await a.select().from(jobOutbox).where(eq(jobOutbox.eventId, "evt-lease"));
    const [site] = await a.select().from(websites).where(eq(websites.id, siteId));
    expect([job.status, site.status]).toEqual(["sent", "pending"]);
  });
});
