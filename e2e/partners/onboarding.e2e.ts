import { createHash, randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  member,
  partnerClicks,
  partnerCommissions,
  partnerProfiles,
  partnerReviewCases,
  partnerSignupEligibility,
  partnerStripeAccounts,
  subscriptions,
  websiteInvitations,
  websites,
} from "@/lib/db/schema";
import { syncPayoutAccount } from "@/lib/partners/application/use-cases/manage-payout-account";
import { prepareSettlement } from "@/lib/partners/application/use-cases/prepare-settlement";
import { partnerCopy } from "@/lib/partners/presentation/copy";
import { attachReferral, ensureReferralCode } from "@/lib/referrals/core";
import { readiness, seedStripeCustomer, seedUser, seedWorkspace } from "@/test/partners";

import { Browser } from "./browser";
import {
  approvedPartner,
  attributionOf,
  commissionsOf,
  database,
  decide,
  foundingWorkspace,
  openProgram,
  pay,
  person,
  referredPayment,
  signedInAdmin,
  signIn,
  signUpInBrowser,
  STATE,
  stripeWorld,
  unique,
  userByEmail,
  usersWithEmail,
  verifyEmail,
} from "./driver";

/**
 * Flows 1-3, 6, 17-19: applying and approval, the portal without a
 * subscription, payout-setup states, who does not qualify, isolation and
 * admin authorization, fraud review and suspension, and the legacy credit
 * referrals - through the running application.
 */

const t = partnerCopy("en").portal;
const base = STATE.baseUrl;
let browser: Browser;
let admin: Awaited<ReturnType<typeof signedInAdmin>>;

beforeAll(async () => {
  await openProgram();
  browser = await Browser.launch();
  admin = await signedInAdmin(browser);
});

afterAll(async () => {
  await browser?.close();
});

describe("joining the program", () => {
  it("1-2: an existing user applies and is approved with the same login, no workspace or subscription needed", async () => {
    const email = `${unique("applicant")}@e2e.test`;
    const applicant = await person(browser);
    await signUpInBrowser(applicant.page, email, "Ada Applicant", "/partner/apply");
    const userId = (await userByEmail(email))!.id;
    // The verification email's link.
    await verifyEmail(email);

    let doc = await applicant.page.goto(`${base}/partner/apply`);
    expect(doc).toEqual({ status: 200, path: "/partner/apply" });
    await applicant.page.fill("#website", "https://ada-writes.example");
    await applicant.page.fill("#audience", "Owners of small agencies, about 4,000 newsletter readers");
    await applicant.page.fill("#promotion", "Tutorials in my newsletter and on my blog");
    await applicant.page.selectOption("#country", "IT");
    await applicant.page.evaluate(() => (document.querySelector('input[name="terms"]') as HTMLInputElement).click());
    await applicant.page.clickByText(t.apply.submit, { selector: 'button[type="submit"]' });
    await applicant.page.waitForText(t.apply.pendingTitle);

    await admin.page.goto(`${base}/admin/partners/applications?q=${encodeURIComponent(email)}`);
    await decide(admin.page, "Approve…", "Approve", null, "Approved");

    // Same browser session, no new sign-in: the portal is there.
    doc = await applicant.page.goto(`${base}/partner`);
    expect(doc).toEqual({ status: 200, path: "/partner" });
    await applicant.page.waitForText(t.overview.linkTitle);
    // The readable link the approval dialog suggested from the name "Ada Applicant".
    const shownLink = () => applicant.page.evaluate(() => [...document.querySelectorAll("input")].map((input) => input.value).find((value) => value.includes("?ref=")) ?? "");
    expect(await shownLink()).toMatch(/^https?:\/\/[^/]+\/\?ref=ada[a-z0-9-]*$/);
    expect(await usersWithEmail(email)).toBe(1);
    expect((await userByEmail(email))!.id).toBe(userId);
    // No subscription anywhere near this account.
    const memberships = await database.select({ organizationId: member.organizationId }).from(member).where(eq(member.userId, userId));
    for (const { organizationId } of memberships) {
      expect(await database.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId))).toEqual([]);
    }

    // The administrator renames the link in the partner's page; the old link keeps counting for them.
    const [profile] = await database.select().from(partnerProfiles).where(eq(partnerProfiles.userId, userId));
    const oldCode = profile.referralCode;
    const newCode = unique("ada");
    await admin.page.goto(`${base}/admin/partners/partners/${profile.id}`);
    await admin.page.clickByText("Change link name…");
    await admin.page.waitFor(() => Boolean(document.querySelector('[role="dialog"] #partner-field')), { message: "rename dialog" });
    expect(await admin.page.evaluate(() => (document.querySelector("#partner-field") as HTMLInputElement).value)).toBe(oldCode);
    await admin.page.fill("#partner-field", newCode.toUpperCase());
    await admin.page.fill('[role="dialog"] textarea', "Partner asked for another name");
    await admin.page.clickByText("Change link name", { inDialog: true, selector: 'button[type="submit"]' });
    await admin.page.waitForText(`The link is now ?ref=${newCode}. The old one keeps working.`);
    await applicant.page.goto(`${base}/partner`);
    expect(await shownLink()).toMatch(new RegExp(`/\\?ref=${newCode}$`));
    for (const code of [oldCode, newCode]) {
      const visitor = await person(browser);
      expect(await visitor.page.goto(`${base}/?ref=${code}`)).toEqual({ status: 200, path: "/" });
      expect((await visitor.context.cookies()).some((cookie) => cookie.name === "repget_partner")).toBe(true);
      await visitor.context.close();
    }
    expect(await database.select().from(partnerClicks).where(eq(partnerClicks.partnerId, profile.id))).toHaveLength(2);
    await applicant.context.close();
  });

  it("3: payout setup shows Stripe's onboarding states as Stripe reports them (incomplete, ready, restricted)", async () => {
    const w = stripeWorld();
    const partner = await approvedPartner(w, { ready: false });
    const portal = await person(browser);
    await signIn(portal.page, partner.email);
    await portal.page.goto(`${base}/partner/settings`);
    await portal.page.waitForText(t.setup.states.not_started.title);

    // The account exists at Stripe with details missing (as after a first click on "Set up payouts").
    const accountId = `acct_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    await database.insert(partnerStripeAccounts).values({ partnerId: partner.partnerId, environment: "test", stripeAccountId: accountId, status: "onboarding", creationKey: `partner-account:${partner.partnerId}:test` });
    const states = [
      [readiness(accountId, { metadataPartnerId: partner.partnerId }), t.setup.states.setup_required.title],
      [readiness(accountId, { status: "ready", detailsSubmitted: true, payoutsEnabled: true, transfersCapability: "active", requirementsCurrentlyDue: [], metadataPartnerId: partner.partnerId }), t.setup.states.ready.title],
      [readiness(accountId, { status: "restricted", detailsSubmitted: true, payoutsEnabled: false, transfersCapability: "inactive", requirementsPastDue: ["individual.id_number"], disabledReason: "requirements.past_due", metadataPartnerId: partner.partnerId }), t.setup.states.restricted.title],
    ] as const;
    for (const [state, title] of states) {
      w.stripe.accounts.set(accountId, state);
      expect(await syncPayoutAccount(w.deps, { kind: "system", origin: "e2e" }, { partnerId: partner.partnerId })).toMatchObject({ ok: true });
      await portal.page.goto(`${base}/partner/settings`);
      await portal.page.waitForText(title);
    }
    // Restricted: no payout is prepared.
    expect(await prepareSettlement(w.deps, { kind: "system", origin: "e2e" }, { partnerId: partner.partnerId, currency: "eur", runKey: "e2e-3" })).toEqual({ kind: "skipped", reason: "onboarding_incomplete" });
    await portal.context.close();
  });
});

describe("who does not qualify", () => {
  it("6: an existing user and an invited team member earn the partner nothing", async () => {
    const w = stripeWorld();
    const partner = await approvedPartner(w);

    // An existing user opens the partner link, then starts a workspace and pays.
    const existingEmail = `${unique("existing")}@e2e.test`;
    const existing = await person(browser);
    await signUpInBrowser(existing.page, existingEmail, "Existing User");
    // ?ref= on another page, in capitals, with a campaign tag: lands there, tag kept, ?ref= gone.
    expect(await existing.page.goto(`${base}/pricing?ref=${partner.code.toUpperCase()}&utm_source=e2e`)).toEqual({ status: 200, path: "/pricing?utm_source=e2e" });
    expect((await existing.context.cookies()).some((cookie) => cookie.name === "repget_partner")).toBe(true);
    const existingUser = (await userByEmail(existingEmail))!;
    const existingOrg = await foundingWorkspace(existingUser.id);
    // Paid now, after the click: the account itself predates it.
    await pay(w, await seedStripeCustomer(database, existingOrg), 9900, 0);
    expect(await attributionOf(existingOrg)).toBeNull();

    // Someone invited to another customer's website opens the link and signs up.
    const inviter = await seedUser(database);
    const inviterOrg = await seedWorkspace(database, inviter.id);
    const [site] = await database.insert(websites).values({ organizationId: inviterOrg, domain: `${unique("site")}.example`, url: "https://site.example" }).returning({ id: websites.id });
    const invitedEmail = `${unique("invited")}@e2e.test`;
    await database.insert(websiteInvitations).values({ websiteId: site.id, email: invitedEmail, tokenHash: createHash("sha256").update(randomUUID()).digest("hex"), expiresAt: new Date(Date.now() + 7 * 86_400_000), invitedBy: inviter.id });
    const invited = await person(browser);
    await invited.page.goto(`${base}/go/${partner.code}`);
    await signUpInBrowser(invited.page, invitedEmail, "Invited Editor");
    const invitedUser = (await userByEmail(invitedEmail))!;
    const [eligibility] = await database.select().from(partnerSignupEligibility).where(eq(partnerSignupEligibility.userId, invitedUser.id));
    expect(eligibility).toMatchObject({ eligible: false, exclusions: expect.arrayContaining(["invited"]) });
    const invitedOrg = await foundingWorkspace(invitedUser.id);
    await pay(w, await seedStripeCustomer(database, invitedOrg), 9900, 0);
    expect(await attributionOf(invitedOrg)).toBeNull();

    expect(await commissionsOf(partner.partnerId)).toEqual([]);
    const portal = await person(browser);
    await signIn(portal.page, partner.email);
    await portal.page.goto(`${base}/partner/referrals`);
    await portal.page.waitForText(t.referrals.empty);
    for (const p of [existing, invited, portal]) await p.context.close();
  });
});

describe("isolation and authorization", () => {
  it("17: a partner sees only their own records and never the admin area; signed-out visitors are sent to sign in", async () => {
    const w = stripeWorld();
    const mine = await approvedPartner(w);
    const theirs = await approvedPartner(w);
    await referredPayment(w, mine.code, 9900, 1, { domain: `${unique("mine")}.example` });
    await referredPayment(w, theirs.code, 19900, 1, { domain: `zz${unique("theirs")}.example` });

    const portal = await person(browser);
    await signIn(portal.page, mine.email);
    await portal.page.goto(`${base}/partner/commissions`);
    await portal.page.waitForText("€24.75");
    const text = await portal.page.text();
    expect(text).not.toContain("€49.75");
    expect(text).not.toContain("zz");

    expect((await portal.page.goto(`${base}/admin/partners`)).status).toBe(404);
    expect((await portal.page.goto(`${base}/admin/partners/payouts`)).status).toBe(404);
    expect(await portal.page.evaluate(async () => (await fetch("/admin/partners/export/commissions")).status)).toBe(404);

    const visitor = await person(browser);
    const landed = await visitor.page.goto(`${base}/partner/commissions`);
    expect(landed.path.startsWith("/sign-in")).toBe(true);
    expect((await visitor.page.goto(`${base}/admin/partners`)).status).toBe(404);
    for (const p of [portal, visitor]) await p.context.close();
  });
});

describe("fraud review, holds and suspension", () => {
  it("18: a signup from the partner's own network is held for review, confirmed by an administrator; suspension and payout holds stop payouts", async () => {
    const w = stripeWorld();
    const partner = await approvedPartner(w);
    const portal = await person(browser);
    await signIn(portal.page, partner.email);

    // Same network and device as the partner's session.
    const lookalike = await browser.newContext();
    const page = await lookalike.newPage();
    await page.setHeaders({ "x-real-ip": portal.address });
    await page.goto(`${base}/go/${partner.code}`);
    const email = `${unique("lookalike")}@e2e.test`;
    await signUpInBrowser(page, email, "Look Alike");
    const signup = (await userByEmail(email))!;
    const orgId = await foundingWorkspace(signup.id);
    await pay(w, await seedStripeCustomer(database, orgId), 9900, 0);
    const attribution = (await attributionOf(orgId))!;
    expect(attribution.status).toBe("review");
    const [commission] = await commissionsOf(partner.partnerId);
    expect(commission).toMatchObject({ amount: BigInt(2475), reviewState: "needs_review" });

    await portal.page.goto(`${base}/partner/commissions`);
    await portal.page.waitForText(t.commissions.statuses.review);

    await admin.page.goto(`${base}/admin/partners/reviews?kind=fraud_signal`);
    await admin.page.waitForText("Referral held for review");
    // The case for THIS referral (other runs may have left others).
    const opened = await database.select().from(partnerReviewCases).where(and(eq(partnerReviewCases.attributionId, attribution.id), eq(partnerReviewCases.kind, "fraud_signal")));
    expect(opened).toHaveLength(1);
    await admin.page.goto(`${base}/admin/partners/attribution?status=review&partner=${partner.partnerId}`);
    await decide(admin.page, "Confirm…", "Confirm", "Customer verified by phone", "Referral confirmed");
    const [approved] = await database.select().from(partnerCommissions).where(eq(partnerCommissions.id, commission.id));
    expect(approved.reviewState).toBe("approved");

    // Payout hold, then suspension, through the admin pages.
    await admin.page.goto(`${base}/admin/partners/partners/${partner.partnerId}`);
    await decide(admin.page, "Hold payouts…", "Hold payouts", "Tax form requested", "Payouts held");
    expect(await prepareSettlement(w.deps, { kind: "system", origin: "e2e" }, { partnerId: partner.partnerId, currency: "eur", runKey: "e2e-18a" })).toEqual({ kind: "skipped", reason: "payout_hold" });
    await portal.page.goto(`${base}/partner`);
    await portal.page.waitForText(t.hold.title);

    await admin.page.goto(`${base}/admin/partners/partners/${partner.partnerId}`);
    await decide(admin.page, "Suspend…", "Suspend", "Bidding on the brand name", "Partner suspended");
    await portal.page.goto(`${base}/partner`);
    await portal.page.waitForText(t.suspended.title);
    expect(await prepareSettlement(w.deps, { kind: "system", origin: "e2e" }, { partnerId: partner.partnerId, currency: "eur", runKey: "e2e-18b" })).toMatchObject({ kind: "skipped" });

    // A suspended partner's link records nothing new.
    const before = (await database.select().from(partnerClicks).where(eq(partnerClicks.partnerId, partner.partnerId))).length;
    const visitor = await person(browser);
    await visitor.page.goto(`${base}/go/${partner.code}`);
    expect((await database.select().from(partnerClicks).where(eq(partnerClicks.partnerId, partner.partnerId))).length).toBe(before);
    for (const p of [portal, visitor]) await p.context.close();
    await lookalike.close();
  });
});

describe("the legacy credit referrals", () => {
  it("19: /affiliate and /r/CODE work as before, /go never sets the credit cookie, and a customer of both is held for review", async () => {
    const w = stripeWorld();
    const partner = await approvedPartner(w);
    const referrer = await seedUser(database);
    const referrerOrg = await seedWorkspace(database, referrer.id);
    const code = await ensureReferralCode(referrerOrg);

    const visitor = await person(browser);
    expect((await visitor.page.goto(`${base}/affiliate`)).status).toBe(200);
    expect((await visitor.page.goto(`${base}/partners`)).status).toBe(200);
    expect(await visitor.page.evaluate(() => Boolean(document.querySelector('a[href="/affiliate"]')))).toBe(true);
    const viaPartner = await person(browser);
    await viaPartner.page.goto(`${base}/go/${partner.code}`);
    expect((await viaPartner.context.cookies()).map((cookie) => cookie.name)).not.toContain("ref");
    const landed = await visitor.page.goto(`${base}/r/${code}`);
    expect(landed.path).toBe("/");
    expect((await visitor.context.cookies()).find((cookie) => cookie.name === "ref")?.value).toContain(code);

    // Referred by a customer (credit) AND by a partner (cash): the commission waits for a person.
    const both = await referredPayment(w, partner.code, 9900, 1, {
      beforePayment: async (organizationId) => {
        expect(await attachReferral(organizationId, code)).toEqual({ ok: true });
      },
    });
    const [commission] = await commissionsOf(partner.partnerId);
    expect(commission).toMatchObject({ amount: BigInt(2475), reviewState: "needs_review" });
    const cases = await database.select().from(partnerReviewCases).where(and(eq(partnerReviewCases.organizationId, both.organizationId), eq(partnerReviewCases.kind, "credit_cash_conflict")));
    expect(cases).toHaveLength(1);
    await admin.page.goto(`${base}/admin/partners/reviews?kind=credit_cash_conflict`);
    await admin.page.waitForText("Credit and cash referral");
    for (const p of [visitor, viaPartner]) await p.context.close();
  });
});
