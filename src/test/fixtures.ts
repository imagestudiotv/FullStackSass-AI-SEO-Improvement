import { randomUUID } from "node:crypto";

import {
  calendarItems,
  plans,
  subscriptions,
  websites,
} from "@/lib/db/schema";
import { organization } from "@/lib/db/auth-tables";
import type { TestDb } from "@/test/db";

/**
 * Disposable tenants for tests: a workspace with one website and, unless
 * `status` is null, a subscription on a plan. Every id is random, so tests in
 * one database never see each other's rows.
 */
export async function seedWebsite(
  { db }: TestDb,
  options: { status?: string | null; articleLimit?: number } = {},
) {
  const orgId = `org_${randomUUID()}`;
  await db.insert(organization).values({
    id: orgId,
    name: "Test workspace",
    slug: orgId,
    createdAt: new Date(),
  });

  const [site] = await db
    .insert(websites)
    .values({
      organizationId: orgId,
      url: `https://${orgId}.example`,
      domain: `${orgId}.example`,
      status: "ready",
    })
    .returning({ id: websites.id });

  const status = options.status === undefined ? "active" : options.status;
  if (status !== null) {
    const [plan] = await db
      .insert(plans)
      .values({
        name: "Test plan",
        // Plans are unique per (tier, interval).
        tier: `test_${randomUUID()}`,
        priceCents: 1000,
        articleLimit: options.articleLimit ?? 30,
        keywordLimit: 100,
        siteLimit: 1,
        monthlyCredits: 0,
      })
      .returning({ id: plans.id });
    await db.insert(subscriptions).values({
      organizationId: orgId,
      websiteId: site.id,
      planId: plan.id,
      status,
      currentPeriodStart: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
  }

  return { orgId, websiteId: site.id };
}

export async function seedCalendarItem({ db }: TestDb, websiteId: string) {
  const [item] = await db
    .insert(calendarItems)
    .values({ websiteId, title: "How to test spend controls" })
    .returning({ id: calendarItems.id });
  return item.id;
}
