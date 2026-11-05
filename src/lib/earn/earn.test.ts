import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { organization } from "@/lib/db/auth-tables";
import { adminAuditLog, creditLedger, earnSubmissions, payments, referralCodes, referrals } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Earn Credits (client, 2026-11-02) on a disposable database: a claim is
 * checked and stored, nothing is credited until the team approves, each way
 * pays once, a declined one can be sent again, a double approval credits
 * once, and a new customer can enter someone's referral code.
 */

const state = vi.hoisted(() => ({ db: null as unknown, orgId: "", userId: null as string | null }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/tenant", () => ({ requireOrg: async () => ({ orgId: state.orgId, userId: state.userId, role: "owner" }) }));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: async () => ({ email: "team@repget.test" }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const notifyMock = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/lib/notifications/create", () => ({ notify: notifyMock }));

import { canEnterReferralCode, enterReferralCode, listEarnClaims, submitEarnClaim } from "@/lib/earn/actions";
import { approveEarnClaim, declineEarnClaim, listEarnQueue } from "@/lib/earn/admin";
import { shareTemplates } from "@/lib/earn/share-templates";
import { EARN_WAYS } from "@/lib/earn/ways";
import { EARN_SHARE_COPY } from "@/lib/i18n/earn-share";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

async function org(createdAt = new Date()) {
  const id = `org_${randomUUID().slice(0, 8)}`;
  await test.db.insert(organization).values({ id, name: id, slug: id, createdAt });
  return id;
}

async function balance(orgId: string) {
  const rows = await test.db.select({ amount: creditLedger.amount }).from(creditLedger).where(eq(creditLedger.organizationId, orgId));
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

const STORY = "We publish twice a week now and two of the articles already bring calls from new customers every month.";

beforeEach(async () => {
  state.orgId = await org();
  notifyMock.mockClear();
});

describe("sending a claim", () => {
  it("checks the link and the text before storing anything", async () => {
    expect(await submitEarnClaim({ kind: "post", link: "", message: "My LinkedIn post" })).toEqual({ ok: false, error: "link" });
    expect(await submitEarnClaim({ kind: "post", link: "not a link", message: "My LinkedIn post" })).toEqual({ ok: false, error: "link" });
    expect(await submitEarnClaim({ kind: "story", link: "", message: "great app" })).toEqual({ ok: false, error: "message" });
    expect(await submitEarnClaim({ kind: "cash", link: "", message: STORY })).toEqual({ ok: false, error: "kind" });
    const rows = await test.db.select().from(earnSubmissions).where(eq(earnSubmissions.organizationId, state.orgId));
    expect(rows).toEqual([]);
  });

  it("stores a valid claim as waiting, with its reward, and credits nothing yet", async () => {
    expect(await submitEarnClaim({ kind: "post", link: "linkedin.com/posts/abc", message: "My post about RepGet" })).toEqual({ ok: true });
    const [row] = await test.db.select().from(earnSubmissions).where(eq(earnSubmissions.organizationId, state.orgId));
    expect(row.status).toBe("pending");
    expect(row.link).toBe("https://linkedin.com/posts/abc");
    expect(row.rewardCredits).toBe(EARN_WAYS.post.credits);
    expect(await balance(state.orgId)).toBe(0);
    expect(await listEarnClaims()).toMatchObject([{ kind: "post", status: "pending", credits: 20 }]);
  });

  it("a claim sending the kit's template unedited is still only a pending claim, with no ledger row", async () => {
    const template = shareTemplates(EARN_SHARE_COPY.en.templates, { code: "OWN1CODE", link: "https://www.repget.com/r/OWN1CODE" }).linkedin;
    expect(await submitEarnClaim({ kind: "post", link: "https://linkedin.com/posts/abc", message: template })).toEqual({ ok: true });
    const [row] = await test.db.select().from(earnSubmissions).where(eq(earnSubmissions.organizationId, state.orgId));
    expect(row).toMatchObject({ status: "pending", reviewedAt: null });
    expect(await test.db.select().from(creditLedger).where(eq(creditLedger.organizationId, state.orgId))).toEqual([]);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("refuses a second claim of the same way while one waits", async () => {
    await submitEarnClaim({ kind: "story", link: "", message: STORY });
    expect(await submitEarnClaim({ kind: "story", link: "", message: STORY })).toEqual({ ok: false, error: "already" });
  });
});

describe("the team's decision", () => {
  async function waiting(kind = "story") {
    await submitEarnClaim({ kind, link: kind === "post" || kind === "tutorial" ? "https://example.com/x" : "", message: STORY });
    const [row] = await test.db
      .select({ id: earnSubmissions.id })
      .from(earnSubmissions)
      .where(and(eq(earnSubmissions.organizationId, state.orgId), eq(earnSubmissions.kind, kind), eq(earnSubmissions.status, "pending")));
    return row.id;
  }

  it("approving adds the credits once, records it, and notifies the customer", async () => {
    const id = await waiting("tutorial");
    const [first, second] = await Promise.all([approveEarnClaim(id), approveEarnClaim(id)]);
    expect([first.ok, second.ok].sort()).toEqual([false, true]);
    expect(await balance(state.orgId)).toBe(EARN_WAYS.tutorial.credits);
    const ledger = await test.db.select().from(creditLedger).where(eq(creditLedger.organizationId, state.orgId));
    expect(ledger).toMatchObject([{ type: "reward", amount: 40, idempotencyKey: `earn:${id}` }]);
    const audit = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, id));
    expect(audit.map((row) => row.action)).toEqual(["earn.approved"]);
    expect(notifyMock).toHaveBeenCalledTimes(1);
    // Each way pays once: an approved one cannot be sent again.
    expect(await submitEarnClaim({ kind: "tutorial", link: "https://example.com/y", message: STORY })).toEqual({ ok: false, error: "approved" });
  });

  it("declining needs a reason the customer sees, adds nothing, and lets them send again", async () => {
    const id = await waiting("feedback");
    expect(await declineEarnClaim(id, "")).toMatchObject({ ok: false });
    expect(await declineEarnClaim(id, "We already have this on our list")).toEqual({ ok: true });
    expect(await balance(state.orgId)).toBe(0);
    expect(await listEarnClaims()).toMatchObject([{ kind: "feedback", status: "declined", reviewNote: "We already have this on our list" }]);
    expect(await submitEarnClaim({ kind: "feedback", link: "", message: STORY })).toEqual({ ok: true });
    expect(await approveEarnClaim(id)).toMatchObject({ ok: false });
  });

  it("lists waiting claims first for the team", async () => {
    await waiting("story");
    const queue = await listEarnQueue();
    expect(queue[0].status).toBe("pending");
  });
});

describe("entering someone's referral code", () => {
  it("attaches a new workspace that never paid, once, and never to itself", async () => {
    const referrer = await org(new Date(Date.now() - 90 * 86_400_000));
    await test.db.insert(referralCodes).values({ organizationId: referrer, code: "EARNTEST" });
    await test.db.insert(referralCodes).values({ organizationId: state.orgId, code: "MINEMINE" });

    expect(await canEnterReferralCode()).toBe(true);
    expect(await enterReferralCode("nope")).toEqual({ ok: false, error: "unknown_code" });
    expect(await enterReferralCode("minemine")).toEqual({ ok: false, error: "self_referral" });
    expect(await enterReferralCode(" earntest ")).toEqual({ ok: true });
    const [row] = await test.db.select().from(referrals).where(eq(referrals.referredOrgId, state.orgId));
    expect(row).toMatchObject({ referrerOrgId: referrer, status: "pending" });
    expect(await canEnterReferralCode()).toBe(false);
    expect(await enterReferralCode("EARNTEST")).toEqual({ ok: false, error: "already_referred" });
  });

  it("is not offered once the workspace has paid", async () => {
    await test.db.insert(payments).values({
      organizationId: state.orgId,
      provider: "stripe",
      externalId: `in_${randomUUID()}`,
      amountCents: 4900,
      currency: "eur",
      status: "paid",
    });
    expect(await canEnterReferralCode()).toBe(false);
  });
});
