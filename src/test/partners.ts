import { createHash, randomUUID } from "node:crypto";

import { member, organization, partnerApplications, partnerProfiles, partnerTierHistory, platformControls, user } from "@/lib/db/schema";
import type { Database, Executor } from "@/lib/db/types";
import type { AccountReadiness, ConnectAccountGateway, ProviderOutcome } from "@/lib/partners/application/ports/payout-gateway";
import type { PartnerControlKey } from "@/lib/partners/application/ports/repositories";
import type { PartnerDeps } from "@/lib/partners/application/use-cases/deps";
import { fixedClock } from "@/lib/partners/infrastructure/clock";
import { userDirectory } from "@/lib/partners/infrastructure/directory";
import { drizzleUnitOfWork } from "@/lib/partners/infrastructure/persistence/unit-of-work";
import { settingsFromEnv } from "@/lib/partners/infrastructure/settings";

/** Switches a partner program control on (or off) directly, as an operator would. */
export async function setControl(db: Executor, key: PartnerControlKey, enabled = true) {
  await db
    .insert(platformControls)
    .values({ key, enabled, reason: "test", updatedBy: "test", updatedAt: new Date() })
    .onConflictDoUpdate({ target: platformControls.key, set: { enabled } });
}

/** A fake Connect gateway: records calls, answers from `accounts`, never reaches Stripe. */
export function fakeConnect(environment: "test" | "live" = "test") {
  const accounts = new Map<string, AccountReadiness>();
  const calls: { method: string; args: unknown }[] = [];
  let nextCreate: ProviderOutcome<{ accountId: string }> | null = null;
  const byKey = new Map<string, string>();
  const gateway: ConnectAccountGateway = {
    environment: () => environment,
    async createConnectedAccount(input) {
      calls.push({ method: "createConnectedAccount", args: input });
      if (nextCreate) {
        const outcome = nextCreate;
        nextCreate = null;
        if (outcome.kind !== "succeeded") return outcome;
      }
      // Stripe's idempotency: the same key returns the same account.
      const existing = byKey.get(input.idempotencyKey);
      const accountId = existing ?? `acct_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      byKey.set(input.idempotencyKey, accountId);
      if (!accounts.has(accountId)) {
        accounts.set(accountId, readiness(accountId, { metadataPartnerId: input.partnerId, livemode: environment === "live" }));
      }
      return { kind: "succeeded", value: { accountId } };
    },
    async createOnboardingLink(input) {
      calls.push({ method: "createOnboardingLink", args: input });
      return { url: `https://connect.stripe.test/setup/${input.accountId}`, expiresAt: new Date(Date.now() + 300_000) };
    },
    async createDashboardLink(accountId) {
      calls.push({ method: "createDashboardLink", args: accountId });
      return { url: `https://connect.stripe.test/express/${accountId}` };
    },
    async retrieveAccount(accountId) {
      calls.push({ method: "retrieveAccount", args: accountId });
      const account = accounts.get(accountId);
      if (!account) throw Object.assign(new Error("No such account"), { statusCode: 404, code: "resource_missing" });
      return account;
    },
  };
  return {
    gateway,
    accounts,
    calls,
    failNextCreate(outcome: ProviderOutcome<{ accountId: string }>) {
      nextCreate = outcome;
    },
  };
}

export function readiness(accountId: string, overrides: Partial<AccountReadiness> = {}): AccountReadiness {
  return {
    accountId,
    livemode: false,
    status: "onboarding",
    country: "IT",
    defaultCurrency: "eur",
    detailsSubmitted: false,
    payoutsEnabled: false,
    transfersCapability: "inactive",
    requirementsCurrentlyDue: ["individual.verification.document"],
    requirementsPastDue: [],
    requirementsPendingVerification: [],
    disabledReason: null,
    currentDeadline: null,
    payoutInterval: "manual",
    metadataPartnerId: null,
    ...overrides,
  };
}

/**
 * Real repositories on a disposable database, a controlled clock, and
 * fakes for the external boundaries (Stripe, mail, rate limits).
 */
export function partnerTestDeps(db: Database, overrides: Partial<PartnerDeps> = {}) {
  const clock = fixedClock(new Date("2026-10-01T09:00:00Z"));
  const mail: { to: string; kind: string }[] = [];
  let mailFails = false;
  const admitted = { quota: true, burst: true };
  const deps: PartnerDeps = {
    uow: drizzleUnitOfWork(db, { deliver: false }),
    clock,
    settings: { ...settingsFromEnv({ STRIPE_SECRET_KEY: "sk_test_fake", NEXT_PUBLIC_APP_URL: "https://repget.test" } as unknown as NodeJS.ProcessEnv) },
    directory: userDirectory(db),
    random: {
      indexes: (n, max) => Array.from({ length: n }, () => Math.floor(Math.random() * max)),
      token: () => createHash("sha256").update(randomUUID()).digest("base64url"),
      uuid: () => randomUUID(),
    },
    hasher: {
      sha256: (value) => createHash("sha256").update(value).digest("hex"),
      hmac: (value) => createHash("sha256").update(`test-key:${value}`).digest("hex").slice(0, 32),
    },
    mailer: {
      async sendPartnerWelcome(input) {
        if (mailFails) return { ok: false, error: "mail down" };
        mail.push({ to: input.to, kind: "welcome" });
        return { ok: true };
      },
      async sendPartnerNotice(input) {
        mail.push({ to: input.to, kind: input.subject });
        return { ok: true };
      },
    },
    quotaLimiter: { admit: async () => admitted.quota },
    burstLimiter: { admit: async () => admitted.burst },
    connect: null,
    payouts: null,
    billing: null,
    couponGateway: null,
    ...overrides,
  };
  return {
    deps,
    clock,
    mail,
    admitted,
    failMail(fail = true) {
      mailFails = fail;
    },
  };
}

/**
 * Disposable partner-program fixtures. Every id is random, so tests sharing
 * one database never see each other's rows. Timestamps are written
 * explicitly (UTC), never left to a database default in the host's zone.
 */

export async function seedUser(
  db: Executor,
  options: { email?: string; name?: string; verified?: boolean; createdAt?: Date } = {},
) {
  const id = `user_${randomUUID()}`;
  const email = options.email ?? `${id}@example.test`;
  const createdAt = options.createdAt ?? new Date();
  await db.insert(user).values({
    id,
    name: options.name ?? "Test User",
    email,
    emailVerified: options.verified ?? true,
    createdAt,
    updatedAt: createdAt,
  });
  return { id, email, name: options.name ?? "Test User", createdAt };
}

/** A customer workspace owned by `ownerId` (created now unless told otherwise). */
export async function seedWorkspace(db: Executor, ownerId: string, options: { createdAt?: Date } = {}) {
  const id = `org_${randomUUID()}`;
  const createdAt = options.createdAt ?? new Date();
  await db.insert(organization).values({ id, name: "Workspace", slug: id, createdAt });
  await db.insert(member).values({ id: randomUUID(), organizationId: id, userId: ownerId, role: "owner", createdAt });
  return id;
}

/** An approved partner (with its application and base tier period). */
export async function seedPartner(
  db: Executor,
  options: { status?: "active" | "suspended"; code?: string; approvedAt?: Date; email?: string; country?: string } = {},
) {
  const owner = await seedUser(db, { email: options.email });
  const approvedAt = options.approvedAt ?? new Date("2026-01-01T00:00:00Z");
  const [application] = await db
    .insert(partnerApplications)
    .values({
      userId: owner.id,
      status: "approved",
      answers: { website: "https://partner.example", audience: "Agencies", promotion: "Newsletter", country: options.country ?? "IT" },
      applicantEmail: owner.email,
      applicantName: owner.name,
      submittedAt: approvedAt,
      reviewedAt: approvedAt,
      reviewedByEmail: "admin@repget.test",
    })
    .returning({ id: partnerApplications.id });
  const code = options.code ?? randomUUID().replace(/[^a-z2-9]/g, "").slice(0, 10).padEnd(10, "a");
  const [partner] = await db
    .insert(partnerProfiles)
    .values({
      userId: owner.id,
      referralCode: code,
      status: options.status ?? "active",
      displayName: owner.name,
      contactEmail: owner.email,
      country: options.country ?? "IT",
      applicationId: application.id,
      approvedAt,
      approvedByEmail: "admin@repget.test",
      createdAt: approvedAt,
      updatedAt: approvedAt,
    })
    .returning({ id: partnerProfiles.id });
  await db.insert(partnerTierHistory).values({
    partnerId: partner.id,
    tierKey: "base",
    rateBasisPoints: 2500,
    programVersion: 1,
    qualifyingCustomers: 0,
    effectiveFrom: approvedAt,
  });
  return { partnerId: partner.id, userId: owner.id, email: owner.email, code, applicationId: application.id };
}
