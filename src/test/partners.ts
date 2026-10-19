import { randomUUID } from "node:crypto";

import { member, organization, partnerApplications, partnerProfiles, partnerTierHistory, user } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

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
