"use server";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { recordAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { organization, user } from "@/lib/db/auth-tables";
import { addonPurchases, websiteProjects } from "@/lib/db/schema";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { WEBSITE_PROJECT_COPY } from "@/lib/i18n/website-projects";
import { notify } from "@/lib/notifications/create";

import { MAX_WEBSITE_PROJECT_CREDITS, WEBSITE_PROJECTS_PATH } from "./shared";

/**
 * The RepGet team's side of a website project: review the brief, agree the scope
 * and set the price, decline it, or mark a paid one delivered.
 *
 * EVERY CHANGE IS CONDITIONAL ON THE STATUS IT EXPECTS, so two administrators, or
 * an administrator and a customer paying at that moment, cannot both win: the
 * customer's payment holds the row while it charges, and a price set after it
 * finds the row no longer open. The audit log records who did what.
 */

export type WebsiteProjectQueueRow = {
  id: string;
  kind: string;
  status: string;
  brief: string;
  existingUrl: string | null;
  requirements: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  scope: string | null;
  creditCost: number | null;
  creditsPaid: number | null;
  deliveryNote: string | null;
  declineReason: string | null;
  createdAt: Date;
  quotedAt: Date | null;
  quotedBy: string | null;
  paidAt: Date | null;
  fulfilledAt: Date | null;
  fulfilledBy: string | null;
  declinedBy: string | null;
  organizationId: string;
  organizationName: string;
  userEmail: string | null;
};

/** What needs someone first: oldest first within waiting and paid, then the rest, newest first. */
export async function listWebsiteProjectQueue(): Promise<WebsiteProjectQueueRow[]> {
  await requireAdmin();
  return db
    .select({
      id: websiteProjects.id,
      kind: websiteProjects.kind,
      status: websiteProjects.status,
      brief: websiteProjects.brief,
      existingUrl: websiteProjects.existingUrl,
      requirements: websiteProjects.requirements,
      contactName: websiteProjects.contactName,
      contactEmail: websiteProjects.contactEmail,
      contactPhone: websiteProjects.contactPhone,
      scope: websiteProjects.scope,
      creditCost: websiteProjects.creditCost,
      creditsPaid: websiteProjects.creditsPaid,
      deliveryNote: websiteProjects.deliveryNote,
      declineReason: websiteProjects.declineReason,
      createdAt: websiteProjects.createdAt,
      quotedAt: websiteProjects.quotedAt,
      quotedBy: websiteProjects.quotedBy,
      paidAt: websiteProjects.paidAt,
      fulfilledAt: websiteProjects.fulfilledAt,
      fulfilledBy: websiteProjects.fulfilledBy,
      declinedBy: websiteProjects.declinedBy,
      organizationId: websiteProjects.organizationId,
      organizationName: organization.name,
      userEmail: user.email,
    })
    .from(websiteProjects)
    .innerJoin(organization, eq(organization.id, websiteProjects.organizationId))
    .leftJoin(user, eq(user.id, websiteProjects.userId))
    .orderBy(
      sql`case when ${websiteProjects.status} in ('quote_requested', 'paid') then 0 else 1 end`,
      sql`case when ${websiteProjects.status} in ('quote_requested', 'paid') then ${websiteProjects.createdAt} end asc`,
      desc(websiteProjects.updatedAt),
    )
    .limit(200);
}

type Decision = { ok: true } | { ok: false; error: string };

const STALE = "This project has changed. Reload the page.";

/** The customer's words for the customer, from the language of whoever asked. */
async function copyFor(projectUser: string | null) {
  if (!projectUser) return WEBSITE_PROJECT_COPY[DEFAULT_LOCALE];
  const [row] = await db.select({ locale: user.locale }).from(user).where(eq(user.id, projectUser)).limit(1);
  return WEBSITE_PROJECT_COPY[row?.locale && isLocale(row.locale) ? row.locale : DEFAULT_LOCALE];
}

/** Sets or changes the agreed scope and price. A later change replaces the old price: paying re-reads it. */
export async function quoteWebsiteProject(id: string, input: { scope: string; credits: number }): Promise<Decision> {
  const admin = await requireAdmin();
  const scope = input.scope.trim().slice(0, 4000);
  if (scope.length < 10) return { ok: false, error: "Describe the agreed scope - the customer sees it with the price." };
  if (!Number.isInteger(input.credits) || input.credits <= 0 || input.credits > MAX_WEBSITE_PROJECT_CREDITS) {
    return { ok: false, error: `The price is a whole number of credits, from 1 to ${MAX_WEBSITE_PROJECT_CREDITS.toLocaleString("en")}.` };
  }

  const done = await db.transaction(async (tx) => {
    const [project] = await tx
      .update(websiteProjects)
      .set({ status: "quoted", scope, creditCost: input.credits, quotedAt: new Date(), quotedBy: admin.email, updatedAt: new Date() })
      .where(and(eq(websiteProjects.id, id), inArray(websiteProjects.status, ["quote_requested", "quoted"])))
      .returning({ organizationId: websiteProjects.organizationId, userId: websiteProjects.userId, kind: websiteProjects.kind });
    if (!project) return null;
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "website_project.quoted",
        targetType: "website_project",
        targetId: id,
        organizationId: project.organizationId,
        summary: `Quoted a website project (${project.kind}): ${input.credits} credits`,
        detail: { kind: project.kind, credits: input.credits },
      },
      tx,
    );
    return project;
  });
  if (!done) return { ok: false, error: STALE };

  const copy = await copyFor(done.userId);
  await notify({
    organizationId: done.organizationId,
    type: "website.quote_ready",
    title: copy.notify.quotedTitle,
    body: format(copy.notify.quotedBody, { credits: input.credits }),
    href: WEBSITE_PROJECTS_PATH,
  });
  revalidatePath("/admin/website-projects");
  revalidatePath(WEBSITE_PROJECTS_PATH);
  return { ok: true };
}

/** Declines before anything was paid, with a reason the customer reads. */
export async function declineWebsiteProject(id: string, reason: string): Promise<Decision> {
  const admin = await requireAdmin();
  const note = reason.trim().slice(0, 1000);
  if (note.length < 3) return { ok: false, error: "Give a short reason - the customer sees it." };

  const done = await db.transaction(async (tx) => {
    const [project] = await tx
      .update(websiteProjects)
      .set({ status: "declined", declineReason: note, declinedAt: new Date(), declinedBy: admin.email, updatedAt: new Date() })
      .where(and(eq(websiteProjects.id, id), inArray(websiteProjects.status, ["quote_requested", "quoted"])))
      .returning({ organizationId: websiteProjects.organizationId, userId: websiteProjects.userId, kind: websiteProjects.kind });
    if (!project) return null;
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "website_project.declined",
        targetType: "website_project",
        targetId: id,
        organizationId: project.organizationId,
        summary: `Declined a website project (${project.kind}): ${note}`,
        detail: { kind: project.kind, reason: note },
      },
      tx,
    );
    return project;
  });
  if (!done) return { ok: false, error: STALE };

  const copy = await copyFor(done.userId);
  await notify({
    organizationId: done.organizationId,
    type: "website.declined",
    title: copy.notify.declinedTitle,
    body: note,
    href: WEBSITE_PROJECTS_PATH,
  });
  revalidatePath("/admin/website-projects");
  revalidatePath(WEBSITE_PROJECTS_PATH);
  return { ok: true };
}

/**
 * Marks a PAID project delivered, and its order with it, so Billing's "Your
 * purchases" reads Delivered from the same row. An unpaid one cannot be.
 */
export async function fulfilWebsiteProject(id: string, deliveryNote: string): Promise<Decision> {
  const admin = await requireAdmin();
  const note = deliveryNote.trim().slice(0, 2000);
  if (note.length < 3) return { ok: false, error: "Say what was delivered - the customer sees it." };

  const done = await db.transaction(async (tx) => {
    const now = new Date();
    const [project] = await tx
      .update(websiteProjects)
      .set({ status: "fulfilled", deliveryNote: note, fulfilledAt: now, fulfilledBy: admin.email, updatedAt: now })
      .where(and(eq(websiteProjects.id, id), eq(websiteProjects.status, "paid")))
      .returning({ organizationId: websiteProjects.organizationId, userId: websiteProjects.userId, kind: websiteProjects.kind });
    if (!project) return null;
    await tx.update(addonPurchases).set({ status: "fulfilled", fulfilledAt: now, updatedAt: now }).where(eq(addonPurchases.id, id));
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "website_project.fulfilled",
        targetType: "website_project",
        targetId: id,
        organizationId: project.organizationId,
        summary: `Delivered a website project (${project.kind})`,
        detail: { kind: project.kind },
      },
      tx,
    );
    return project;
  });
  if (!done) return { ok: false, error: STALE };

  const copy = await copyFor(done.userId);
  await notify({
    organizationId: done.organizationId,
    type: "website.fulfilled",
    title: copy.notify.fulfilledTitle,
    body: note,
    href: WEBSITE_PROJECTS_PATH,
  });
  revalidatePath("/admin/website-projects");
  revalidatePath(WEBSITE_PROJECTS_PATH);
  revalidatePath("/billing");
  return { ok: true };
}
