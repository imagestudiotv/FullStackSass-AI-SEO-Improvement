import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { adminAuditLog, jobOutbox, partnerApplications, partnerClicks, partnerProfiles, partnerTierHistory, user } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { partnerTestDeps, seedPartner, seedUser, setControl } from "@/test/partners";

/**
 * Part 2: applying, approval, the partner lifecycle, the one welcome email,
 * and partner link clicks - real repositories on PGlite, a controlled clock,
 * fake mail and rate limits.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));

import type { AdminContext, ApplicantContext } from "../contracts/commands";
import { recordReferralClick } from "./record-referral-click";
import { approveApplication, rejectApplication, sendWelcome, setPartnerStatus, setPayoutHold, welcomeJobId } from "./review-application";
import { submitApplication } from "./submit-application";

let test: TestDb;
const admin: AdminContext = { kind: "admin", userId: "admin-user", email: "admin@repget.test" };
const answers = {
  website: "https://newsletter.example",
  audience: "Marketing agencies in Italy, about 4,000 readers",
  promotion: "A monthly newsletter and two YouTube reviews",
  country: "IT",
};

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  await setControl(test.db, "partner_program", true);
});

async function applicant(options: { verified?: boolean } = {}): Promise<ApplicantContext> {
  const person = await seedUser(test.db, { verified: options.verified ?? true });
  return { kind: "applicant", userId: person.id, email: person.email, name: person.name };
}

describe("applying", () => {
  it("uses the existing login: no new user, workspace, plan or website", async () => {
    const { deps } = partnerTestDeps(test.db);
    const me = await applicant();
    const usersBefore = (await test.db.select().from(user)).length;
    const result = await submitApplication(deps, me, answers);
    expect(result.ok).toBe(true);
    expect((await test.db.select().from(user)).length).toBe(usersBefore);
    const [row] = await test.db.select().from(partnerApplications).where(eq(partnerApplications.userId, me.userId));
    expect(row).toMatchObject({ status: "submitted", applicantEmail: me.email });
  });

  it("allows one open application, and none for an existing partner", async () => {
    const { deps } = partnerTestDeps(test.db);
    const me = await applicant();
    expect((await submitApplication(deps, me, answers)).ok).toBe(true);
    expect(await submitApplication(deps, me, answers)).toEqual({ ok: false, reason: "already_processed", detail: "already_applied" });
    const partner = await seedPartner(test.db);
    expect(
      await submitApplication(deps, { kind: "applicant", userId: partner.userId, email: partner.email, name: "P" }, answers),
    ).toMatchObject({ ok: false, detail: "already_partner" });
  });

  it("validates answers and the payout country", async () => {
    const { deps } = partnerTestDeps(test.db);
    const me = await applicant();
    expect(await submitApplication(deps, me, { ...answers, website: "not a url" })).toMatchObject({ detail: "website" });
    expect(await submitApplication(deps, me, { ...answers, country: "IN" })).toMatchObject({ detail: "country" });
    expect(await submitApplication(deps, me, { ...answers, audience: "short" })).toMatchObject({ detail: "audience" });
  });

  it("is rate limited, and closed while the program switch is off", async () => {
    const env = partnerTestDeps(test.db);
    env.admitted.quota = false;
    expect(await submitApplication(env.deps, await applicant(), answers)).toEqual({ ok: false, reason: "rate_limited" });
    await setControl(test.db, "partner_program", false);
    try {
      expect(await submitApplication(partnerTestDeps(test.db).deps, await applicant(), answers)).toMatchObject({ reason: "disabled" });
    } finally {
      await setControl(test.db, "partner_program", true);
    }
  });
});

describe("approval", () => {
  async function submitted() {
    const { deps } = partnerTestDeps(test.db);
    const me = await applicant();
    const result = await submitApplication(deps, me, answers);
    if (!result.ok) throw new Error("setup");
    return { me, applicationId: result.value.applicationId };
  }

  it("creates one profile with a link name from the applicant's name, the base tier and one welcome job, audited", async () => {
    const { deps } = partnerTestDeps(test.db);
    const { me, applicationId } = await submitted();
    const result = await approveApplication(deps, admin, applicationId);
    if (!result.ok) throw new Error(result.reason);
    expect(result.value.created).toBe(true);
    expect(result.value.partner).toMatchObject({ userId: me.userId, status: "active", tierKey: "base", country: "IT" });
    // "Test User": "test" is reserved, so the whole name.
    expect(result.value.partner.referralCode).toMatch(/^test-user\d*$/);

    const tiers = await test.db.select().from(partnerTierHistory).where(eq(partnerTierHistory.partnerId, result.value.partner.id));
    expect(tiers).toMatchObject([{ tierKey: "base", rateBasisPoints: 2500, effectiveTo: null }]);
    const jobs = await test.db.select().from(jobOutbox).where(eq(jobOutbox.eventId, welcomeJobId(result.value.partner.id)));
    expect(jobs).toHaveLength(1);
    const audit = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, result.value.partner.id));
    expect(audit.map((a) => a.action)).toEqual(["partner.application_approved"]);
  });

  it("is idempotent: a retried approval returns the same profile, and no second email job", async () => {
    const { deps } = partnerTestDeps(test.db);
    const { me, applicationId } = await submitted();
    const first = await approveApplication(deps, admin, applicationId);
    const second = await approveApplication(deps, admin, applicationId);
    if (!first.ok || !second.ok) throw new Error("approval failed");
    expect(second.value).toEqual({ partner: first.value.partner, created: false });
    expect(await test.db.select().from(partnerProfiles).where(eq(partnerProfiles.userId, me.userId))).toHaveLength(1);
    expect(await test.db.select().from(jobOutbox).where(eq(jobOutbox.eventId, welcomeJobId(first.value.partner.id)))).toHaveLength(1);
  });

  it("rejects with a reason, and never approves a rejected application", async () => {
    const { deps } = partnerTestDeps(test.db);
    const { applicationId } = await submitted();
    expect(await rejectApplication(deps, admin, applicationId, "no")).toMatchObject({ ok: false, detail: "reason" });
    expect((await rejectApplication(deps, admin, applicationId, "Audience is not a fit")).ok).toBe(true);
    expect(await approveApplication(deps, admin, applicationId)).toMatchObject({ ok: false, detail: "application_rejected" });
  });

  it("does not let an approval grant administrator access", async () => {
    const { deps } = partnerTestDeps(test.db);
    const { me, applicationId } = await submitted();
    await approveApplication(deps, admin, applicationId);
    vi.stubEnv("ADMIN_EMAILS", "admin@repget.test");
    const { adminFromSession } = await import("@/lib/admin/guard");
    expect(adminFromSession({ user: { id: me.userId, email: me.email, emailVerified: true } })).toBeNull();
    vi.unstubAllEnvs();
  });
});

describe("partner lifecycle", () => {
  it("suspends and reactivates with a reason; holds payouts", async () => {
    const { deps } = partnerTestDeps(test.db);
    const partner = await seedPartner(test.db);
    expect((await setPartnerStatus(deps, admin, partner.partnerId, "suspended", "Spam on social media")).ok).toBe(true);
    let [row] = await test.db.select().from(partnerProfiles).where(eq(partnerProfiles.id, partner.partnerId));
    expect(row).toMatchObject({ status: "suspended", suspendedReason: "Spam on social media" });
    expect((await setPartnerStatus(deps, admin, partner.partnerId, "active", "Resolved with the partner")).ok).toBe(true);
    expect((await setPayoutHold(deps, admin, partner.partnerId, true, "Chargeback investigation")).ok).toBe(true);
    [row] = await test.db.select().from(partnerProfiles).where(eq(partnerProfiles.id, partner.partnerId));
    expect(row).toMatchObject({ status: "active", payoutHoldReason: "Chargeback investigation" });
    expect(await setPayoutHold(deps, admin, partner.partnerId, false, "x")).toMatchObject({ ok: false, detail: "reason" });
  });
});

describe("the welcome email", () => {
  it("is sent once, and retried after a mail failure", async () => {
    const env = partnerTestDeps(test.db);
    const partner = await seedPartner(test.db);
    env.failMail(true);
    await expect(sendWelcome(env.deps, partner.partnerId)).rejects.toThrow(/Welcome email not sent/);
    env.failMail(false);
    expect(await sendWelcome(env.deps, partner.partnerId)).toEqual({ ok: true, value: "sent" });
    expect(await sendWelcome(env.deps, partner.partnerId)).toEqual({ ok: true, value: "already_sent" });
    expect(env.mail.filter((m) => m.to === partner.email)).toHaveLength(1);
  });
});

describe("partner link clicks", () => {
  it("issues a random token and stores only its hash", async () => {
    const env = partnerTestDeps(test.db);
    const partner = await seedPartner(test.db);
    const outcome = await recordReferralClick(env.deps, { code: partner.code, existingToken: null, landingPath: "/", referrerHost: "news.example", visitor: "v1" });
    expect(outcome.recorded).toBe(true);
    expect(outcome.setCookie?.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(outcome.setCookie?.expiresAt.toISOString()).toBe("2026-12-30T09:00:00.000Z");
    const rows = await test.db.select().from(partnerClicks).where(eq(partnerClicks.partnerId, partner.partnerId));
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(env.deps.hasher.sha256(outcome.setCookie!.token));
    expect(JSON.stringify(rows[0])).not.toContain(outcome.setCookie!.token);
    expect(rows[0].visitorHash).not.toBe("v1");
  });

  it("keeps the first valid link: a second partner's link counts but does not move the cookie", async () => {
    const env = partnerTestDeps(test.db);
    const first = await seedPartner(test.db);
    const second = await seedPartner(test.db);
    const a = await recordReferralClick(env.deps, { code: first.code, existingToken: null, landingPath: "/", referrerHost: null, visitor: "v2" });
    const b = await recordReferralClick(env.deps, { code: second.code, existingToken: a.setCookie!.token, landingPath: "/", referrerHost: null, visitor: "v2" });
    expect(b).toEqual({ setCookie: null, recorded: true });
    // A reload of the same link within half an hour is not a second click.
    const again = await recordReferralClick(env.deps, { code: second.code, existingToken: a.setCookie!.token, landingPath: "/", referrerHost: null, visitor: "v2" });
    expect(again.reason).toBe("duplicate");
  });

  it("replaces an expired first touch", async () => {
    const env = partnerTestDeps(test.db);
    const first = await seedPartner(test.db);
    const second = await seedPartner(test.db);
    const a = await recordReferralClick(env.deps, { code: first.code, existingToken: null, landingPath: "/", referrerHost: null, visitor: "v3" });
    env.clock.advance(91 * 24 * 60 * 60 * 1000);
    const b = await recordReferralClick(env.deps, { code: second.code, existingToken: a.setCookie!.token, landingPath: "/", referrerHost: null, visitor: "v3" });
    expect(b.setCookie).not.toBeNull();
  });

  it("ignores unknown codes, suspended partners, the closed program and floods", async () => {
    const env = partnerTestDeps(test.db);
    const suspended = await seedPartner(test.db, { status: "suspended" });
    const ok = await seedPartner(test.db);
    expect((await recordReferralClick(env.deps, { code: "zzzzzzzzzz", existingToken: null, landingPath: "/", referrerHost: null, visitor: "v" })).reason).toBe("unknown_code");
    expect((await recordReferralClick(env.deps, { code: "<script>", existingToken: null, landingPath: "/", referrerHost: null, visitor: "v" })).reason).toBe("unknown_code");
    expect((await recordReferralClick(env.deps, { code: suspended.code, existingToken: null, landingPath: "/", referrerHost: null, visitor: "v" })).reason).toBe("inactive_partner");
    env.admitted.burst = false;
    expect((await recordReferralClick(env.deps, { code: ok.code, existingToken: null, landingPath: "/", referrerHost: null, visitor: "v" })).reason).toBe("rate_limited");
    env.admitted.burst = true;
    await setControl(test.db, "partner_program", false);
    try {
      expect((await recordReferralClick(env.deps, { code: ok.code, existingToken: null, landingPath: "/", referrerHost: null, visitor: "v" })).reason).toBe("program_closed");
    } finally {
      await setControl(test.db, "partner_program", true);
    }
    const clicks = await test.db.select().from(partnerClicks).where(and(eq(partnerClicks.partnerId, ok.partnerId)));
    expect(clicks).toHaveLength(0);
  });
});
