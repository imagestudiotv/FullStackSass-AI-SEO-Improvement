import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { member, partnerAttributions, partnerCommissions, partnerProfiles, partnerSignupEligibility, partnerStripeAccounts, plans, user, websites } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import type { CouponGateway } from "@/lib/partners/application/ports/billing-source";
import { captureSignupEligibility } from "@/lib/partners/application/use-cases/attribute-new-customer";
import { processInvoice } from "@/lib/partners/application/use-cases/process-payment";
import { recordReferralClick } from "@/lib/partners/application/use-cases/record-referral-click";
import { approveApplication } from "@/lib/partners/application/use-cases/review-application";
import { submitApplication } from "@/lib/partners/application/use-cases/submit-application";
import { fakeBilling, fakePayouts, partnerTestDeps, readiness, seedStripeCustomer, seedUser, seedWorkspace, setControl } from "@/test/partners";

import { DESKTOP, type Browser, type Page, type Viewport } from "./browser";

/**
 * The tests' side of the world: everything EXTERNAL to RepGet, played by
 * fakes, plus helpers to reach the state a flow starts from.
 *
 * What is real: the running application (routes, authentication, pages,
 * server actions) and every partner-program use case, here run in-process
 * against the same throwaway database - the same functions the Stripe
 * webhook worker, the monthly run and the sweeps call. What is fake:
 * Stripe (billing reads, Connect transfers, bank payouts, coupons), email
 * delivery (an address is marked verified as clicking the emailed link
 * would) and the clock of the in-process side (set relative to now).
 */

export type E2eState = { baseUrl: string; databaseUrl: string; adminEmail: string; webhookSecret: string; connectWebhookSecret: string };

export const STATE: E2eState = JSON.parse(readFileSync(process.env.E2E_STATE_FILE!, "utf8"));
export const PASSWORD = "E2e-Partner-Passw0rd!";
const DAY = 86_400_000;
export const database = db as unknown as Database;

/** A fresh fake Stripe and the partner-program dependencies wired to it, with the clock at now. */
export function stripeWorld() {
  const billing = fakeBilling();
  const stripe = fakePayouts();
  stripe.fund("eur", 100_000_000);
  const coupons: string[] = [];
  const couponGateway: CouponGateway = {
    async createCouponWithCode(spec) {
      coupons.push(spec.code);
      return { couponId: `co_${randomUUID().slice(0, 8)}`, promotionCodeId: `promo_${randomUUID().replace(/-/g, "").slice(0, 14)}` };
    },
    async deactivatePromotionCode() {},
    async activatePromotionCode() {},
    async productIntervals() {
      return {};
    },
  };
  const env = partnerTestDeps(database, { billing: billing.source, connect: stripe.gateway, payouts: stripe.gateway, couponGateway });
  env.clock.set(new Date());
  return { ...env, billing, stripe, coupons, ago: (days: number) => new Date(Date.now() - days * DAY) };
}
export type World = ReturnType<typeof stripeWorld>;

export const unique = (prefix: string) => `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 10)}`;

export async function openProgram() {
  for (const key of ["partner_program", "partner_commissions", "partner_payouts"] as const) await setControl(database, key, true);
}

/**
 * A distinct client address per simulated person, from the IPv6
 * documentation prefix (2001:db8::/32) - random /64s, so no two people (in
 * any test file or run) share a network or a rate-limit bucket by accident.
 */
export function newAddress(): string {
  const hex = () => randomUUID().replace(/-/g, "").slice(0, 4);
  return `2001:db8:${hex()}:${hex()}::1`;
}

/** Creates an account through the application's own sign-up endpoint. */
export async function signUpViaApi(email: string, name = "E2E Person", address = newAddress()): Promise<string> {
  const response = await fetch(`${STATE.baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: STATE.baseUrl, "x-real-ip": address },
    body: JSON.stringify({ email, password: PASSWORD, name }),
  });
  if (response.status !== 200) throw new Error(`sign-up ${email}: ${response.status} ${await response.text()}`);
  return (await userByEmail(email))!.id;
}

/** What clicking the link in the verification email does. */
export async function verifyEmail(email: string) {
  await database.update(user).set({ emailVerified: true }).where(eq(user.email, email));
}

export async function userByEmail(email: string) {
  const [row] = await database.select().from(user).where(eq(user.email, email));
  return row ?? null;
}

/**
 * The workspace a person founded when they signed up through the app (the
 * sign-up hook creates it) - the one a referral is attributed to. Extra
 * workspaces created later never are.
 */
export async function foundingWorkspace(userId: string): Promise<string> {
  const [eligibility] = await database.select({ id: partnerSignupEligibility.foundingOrganizationId }).from(partnerSignupEligibility).where(eq(partnerSignupEligibility.userId, userId));
  if (eligibility?.id) return eligibility.id;
  const [owned] = await database.select({ id: member.organizationId }).from(member).where(and(eq(member.userId, userId), eq(member.role, "owner")));
  if (!owned) throw new Error(`no founding workspace for ${userId}`);
  return owned.id;
}

export async function usersWithEmail(email: string) {
  return (await database.select({ id: user.id }).from(user).where(eq(user.email, email))).length;
}

/** Signs in through the real form (password method). */
export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto(`${STATE.baseUrl}/sign-in`);
  const hasPassword = await page.evaluate(() => Boolean(document.querySelector("#password")));
  if (!hasPassword) await page.clickByText("Use a password", { selector: "button" }).catch(() => page.clickByText("Password", { selector: "button" }));
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.evaluate(() => (document.querySelector("#password") as HTMLInputElement).form!.requestSubmit());
  await page.waitFor(() => !location.pathname.startsWith("/sign-in"), { timeout: 30_000, message: "leave /sign-in" });
}

/** Signs up through the real form, in this browser context (its cookies included). */
export async function signUpInBrowser(page: Page, email: string, name = "E2E Customer", next?: string) {
  await page.goto(`${STATE.baseUrl}/sign-up${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.evaluate(() => (document.querySelector("#password") as HTMLInputElement).form!.requestSubmit());
  await page.waitFor(() => !location.pathname.startsWith("/sign-up"), { timeout: 30_000, message: "leave /sign-up" });
}

/** An approved partner (application and approval through the use cases the pages call), with a ready Stripe account. */
export async function approvedPartner(w: World, options: { email?: string; name?: string; ready?: boolean } = {}) {
  const email = options.email ?? `${unique("partner")}@e2e.test`;
  const userId = await signUpViaApi(email, options.name ?? "E2E Partner");
  await verifyEmail(email);
  const submitted = await submitApplication(w.deps, { kind: "applicant", userId, email, name: options.name ?? "E2E Partner" }, {
    website: "https://partner.e2e.test",
    audience: "Agencies that publish for small businesses",
    promotion: "A monthly newsletter",
    country: "IT",
  });
  if (!submitted.ok) throw new Error(`application: ${JSON.stringify(submitted)}`);
  const approved = await approveApplication(w.deps, { kind: "admin", userId: "e2e-admin", email: STATE.adminEmail }, submitted.value.applicationId, null);
  if (!approved.ok) throw new Error(`approval: ${JSON.stringify(approved)}`);
  const partnerId = approved.value.partner.id;
  const [profile] = await database.select().from(partnerProfiles).where(eq(partnerProfiles.id, partnerId));
  let accountId: string | null = null;
  if (options.ready !== false) accountId = await readyAccount(w, partnerId);
  return { email, userId, partnerId, code: profile.referralCode, accountId };
}

export async function readyAccount(w: World, partnerId: string) {
  const accountId = `acct_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  await database.insert(partnerStripeAccounts).values({ partnerId, environment: "test", stripeAccountId: accountId, status: "ready", detailsSubmitted: true, payoutsEnabled: true, transfersCapability: "active", payoutInterval: "manual", creationKey: `e2e-${randomUUID()}`, lastSyncedAt: new Date() });
  w.stripe.accounts.set(accountId, readiness(accountId, { status: "ready", detailsSubmitted: true, payoutsEnabled: true, transfersCapability: "active", requirementsCurrentlyDue: [], metadataPartnerId: partnerId }));
  return accountId;
}

/**
 * A visitor who opens the partner's link, signs up and starts a workspace
 * (in-process: the link rule and signup capture are the real use cases),
 * then pays `amount` cents `paidDaysAgo` days ago.
 */
export async function referredPayment(
  w: World,
  code: string,
  amount: number,
  paidDaysAgo: number,
  options: { domain?: string; tax?: number; discount?: number; promotionCodeIds?: string[]; beforePayment?: (organizationId: string) => Promise<void> } = {},
) {
  const now = new Date();
  w.clock.set(w.ago(paidDaysAgo + 2));
  const click = await recordReferralClick(w.deps, { code, existingToken: null, landingPath: "/", referrerHost: null, visitor: randomUUID() });
  const createdAt = w.clock.now();
  const person = await seedUser(database, { createdAt });
  const organizationId = await seedWorkspace(database, person.id, { createdAt });
  if (options.domain) await database.insert(websites).values({ organizationId, domain: options.domain, url: `https://${options.domain}` });
  await captureSignupEligibility(w.deps, { userId: person.id, email: person.email, createdAt, method: "email", trackingToken: click.setCookie?.token ?? null, ipAddress: null, userAgent: null });
  w.clock.set(now);
  const customerId = await seedStripeCustomer(database, organizationId);
  if (options.beforePayment) await options.beforePayment(organizationId);
  const invoice = await pay(w, customerId, amount, paidDaysAgo, options);
  return { organizationId, customerId, invoice, chargeId: invoice.collections[0].chargeId!, userId: person.id };
}

/** A customer who signed up `daysAgo` days ago (through the partner's link when `code` is given), with a workspace and a Stripe customer, who has not paid yet. */
export async function signedUpCustomer(w: World, code: string | null, daysAgo = 2) {
  const now = new Date();
  w.clock.set(w.ago(daysAgo));
  const click = code ? await recordReferralClick(w.deps, { code, existingToken: null, landingPath: "/", referrerHost: null, visitor: randomUUID() }) : null;
  const createdAt = w.clock.now();
  const person = await seedUser(database, { createdAt });
  const organizationId = await seedWorkspace(database, person.id, { createdAt });
  await captureSignupEligibility(w.deps, { userId: person.id, email: person.email, createdAt, method: "email", trackingToken: click?.setCookie?.token ?? null, ipAddress: null, userAgent: null });
  w.clock.set(now);
  return { organizationId, customerId: await seedStripeCustomer(database, organizationId), userId: person.id };
}

/** A paid invoice at the fake Stripe, processed by the real commission use case (as the worker would). `cash` below `amount` = the rest paid from credit. */
/** The plan the simulated payments charge (seeded by ensureE2ePlan), shown beside each commission. */
export const E2E_PLAN = { name: "Grow", priceId: "price_e2e_grow", priceCents: 9900 };

/** A monthly plan in the throwaway database, as production has: the /partners estimate and the commission "Plan" column use it. */
export async function ensureE2ePlan() {
  await database
    .insert(plans)
    .values({ name: E2E_PLAN.name, tier: "e2e-grow", interval: "month", currency: "eur", stripePriceId: E2E_PLAN.priceId, priceCents: E2E_PLAN.priceCents, articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 })
    .onConflictDoNothing();
}

export async function pay(w: World, customerId: string, amount: number, paidDaysAgo: number, options: { tax?: number; discount?: number; promotionCodeIds?: string[]; cash?: number } = {}) {
  const invoice = w.billing.invoice({ customerId, total: amount, tax: options.tax, discount: options.discount, promotionCodeIds: options.promotionCodeIds, priceId: E2E_PLAN.priceId, collections: [{ cash: options.cash ?? amount, paidAt: w.ago(paidDaysAgo) }] });
  const result = await processInvoice(w.deps, invoice.invoiceId, "test");
  return { ...invoice, result };
}

export async function commissionsOf(partnerId: string) {
  return database.select().from(partnerCommissions).where(eq(partnerCommissions.partnerId, partnerId));
}

export async function attributionOf(organizationId: string) {
  const [row] = await database.select().from(partnerAttributions).where(eq(partnerAttributions.organizationId, organizationId));
  return row ?? null;
}

/** Signs a Stripe webhook payload the way Stripe does (v1 scheme), for the application's own webhook route. */
export async function signedStripeDelivery(path: "/api/stripe/webhook" | "/api/stripe/connect-webhook", event: Record<string, unknown>) {
  const { createHmac } = await import("node:crypto");
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const secret = path === "/api/stripe/webhook" ? STATE.webhookSecret : STATE.connectWebhookSecret;
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return fetch(`${STATE.baseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": `t=${timestamp},v1=${signature}` }, body: payload });
}

/** Admin context for in-process admin decisions the UI does not need to show. */
export const ADMIN = { kind: "admin" as const, userId: "e2e-admin", email: "admin@e2e.test" };

/** A person with their own browser profile (cookies, storage) and their own network address. */
export async function person(browser: Browser, viewport: Viewport = DESKTOP) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const address = newAddress();
  await page.setHeaders({ "x-real-ip": address });
  await page.setViewport(viewport);
  return { context, page, address };
}

/** The administrator (ADMIN_EMAILS of the app under test), signed in through the real form. */
export async function signedInAdmin(browser: Browser) {
  if (!(await userByEmail(STATE.adminEmail))) await signUpViaApi(STATE.adminEmail, "E2E Admin");
  await verifyEmail(STATE.adminEmail);
  const admin = await person(browser);
  await signIn(admin.page, STATE.adminEmail);
  return admin;
}

/** Opens a reason dialog by its button, types the reason, confirms, and waits for the toast. */
export async function decide(page: Page, button: string, confirm: string, reason: string | null, toast: string) {
  await page.clickByText(button);
  await page.waitFor(() => Boolean(document.querySelector('[role="dialog"]')), { message: "dialog open" });
  if (reason !== null) {
    await page.fill('[role="dialog"] textarea', reason);
  }
  await page.clickByText(confirm, { inDialog: true, selector: 'button[type="submit"]' });
  await page.waitForText(toast);
}
