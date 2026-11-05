"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { chargeCredits } from "@/lib/credits/spend";
import { db } from "@/lib/db";
import { addonPurchases, addons, websiteProjects } from "@/lib/db/schema";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { format, plural } from "@/lib/i18n/format";
import { WEBSITE_PROJECT_COPY } from "@/lib/i18n/website-projects";
import { notify } from "@/lib/notifications/create";
import { requireOrg } from "@/lib/tenant";
import { hasOnlySharedWork } from "@/lib/websites/accessible";

import { emailWebsiteProjectToAdmins } from "./notify";
import {
  isWebsiteProjectKind,
  MAX_OPEN_QUOTE_REQUESTS,
  WEBSITE_ADDON_SLUG,
  WEBSITE_PROJECTS_PATH,
  websiteProjectRequestSchema,
  type PayProjectResult,
  type RequestQuoteResult,
  type WebsiteProjectField,
  type WebsiteProjectRequestInput,
  type WebsiteProjectRow,
  type WebsiteProjectStatus,
} from "./shared";

/**
 * The customer's side of a website project (lib/website-projects/shared.ts).
 *
 * THE WORKSPACE IS ALWAYS THE CALLER'S. Every query names the organisation
 * requireOrg resolved from the session and its membership row; no action takes
 * one from the browser, so a project id from another workspace simply finds
 * nothing.
 *
 * DELIBERATELY NOT BEHIND THE PLAN. A customer with no website has no
 * subscription to check, and this is the one thing they can do here: ask, buy
 * credits, pay. It opens nothing else - isEntitledToSpend and requirePlan are
 * untouched, so credits in a workspace without a plan still buy no articles,
 * audits or social posts (website-projects.test.ts holds this).
 */

export async function listWebsiteProjects(): Promise<WebsiteProjectRow[]> {
  const { orgId } = await requireOrg();
  const rows = await db
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
      paidAt: websiteProjects.paidAt,
      fulfilledAt: websiteProjects.fulfilledAt,
    })
    .from(websiteProjects)
    .where(eq(websiteProjects.organizationId, orgId))
    .orderBy(desc(websiteProjects.createdAt))
    .limit(50);
  return rows.map((row) => ({
    ...row,
    kind: isWebsiteProjectKind(row.kind) ? row.kind : "new",
    status: row.status as WebsiteProjectStatus,
  }));
}

function refresh() {
  revalidatePath(WEBSITE_PROJECTS_PATH);
  revalidatePath("/billing");
  revalidatePath("/credits");
  // The sidebar shows the balance on every page.
  revalidatePath("/", "layout");
}

/**
 * Sends a brief. Costs nothing and reserves nothing: it says "please quote",
 * and reads that way everywhere until an administrator prices it.
 *
 * requestKey is the identity of this form, so a double click or a retry makes
 * one project: the second call answers with the first's id.
 */
export async function requestWebsiteQuote(input: WebsiteProjectRequestInput): Promise<RequestQuoteResult> {
  const { orgId, userId } = await requireOrg();
  const { t, locale } = await getAppMessages(userId);
  const copy = WEBSITE_PROJECT_COPY[locale];

  if (await hasOnlySharedWork()) return { ok: false, error: t.app.credits.guestOnly };

  const parsed = websiteProjectRequestSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Partial<Record<WebsiteProjectField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && field in copy.errors) fields[field as WebsiteProjectField] = copy.errors[field as WebsiteProjectField];
    }
    return { ok: false, error: copy.fixFields, fields };
  }
  const data = parsed.data;

  const outcome = await db.transaction(async (tx) => {
    // One at a time per workspace, so the cap below cannot be raced past.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`website-projects:${orgId}`}))`);

    const [already] = await tx
      .select({ id: websiteProjects.id })
      .from(websiteProjects)
      .where(and(eq(websiteProjects.organizationId, orgId), eq(websiteProjects.requestKey, data.requestKey)))
      .limit(1);
    if (already) return { id: already.id, created: false };

    const [waiting] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(websiteProjects)
      .where(and(eq(websiteProjects.organizationId, orgId), eq(websiteProjects.status, "quote_requested")));
    if (Number(waiting?.count ?? 0) >= MAX_OPEN_QUOTE_REQUESTS) return null;

    const [project] = await tx
      .insert(websiteProjects)
      .values({
        organizationId: orgId,
        userId,
        kind: data.kind,
        requestKey: data.requestKey,
        brief: data.brief,
        existingUrl: data.existingUrl,
        requirements: data.requirements,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
      })
      .returning({ id: websiteProjects.id });
    return { id: project.id, created: true };
  });
  if (!outcome) return { ok: false, error: copy.tooManyOpen };

  if (outcome.created) {
    /* After commit, and never able to undo the request. */
    await notify({
      organizationId: orgId,
      type: "website.quote_requested",
      userId,
      title: copy.notify.requestedTitle,
      body: copy.notify.requestedBody,
      href: WEBSITE_PROJECTS_PATH,
    });
    await emailWebsiteProjectToAdmins({ organizationId: orgId, kindLabel: data.kind === "new" ? "New website" : "Website redesign", stage: "requested" });
  }

  revalidatePath(WEBSITE_PROJECTS_PATH);
  return { ok: true, id: outcome.id };
}

/**
 * Accepts a quote and pays it from the credit wallet.
 *
 * ONE IDENTITY FOR THE DEBIT AND THE ORDER: the project's id. The purchase row
 * takes it as its primary key, and the spend is keyed "addon:<id>" (the same
 * form every service bought with credits uses), so however many requests arrive
 * - two tabs, a double click, a retry after a lost response - one debit and one
 * order can exist. Both commit with the status change or none of them does.
 *
 * WHAT THE PRICE IS. The project row, read under a lock inside the transaction.
 * `expectedCredits` is what the customer was shown: when it differs, an
 * administrator changed the price since, so nothing is charged and they are
 * shown the new one. The browser's number is only ever compared, never charged.
 *
 * chargeCredits takes the workspace's credit lock and counts what backlinks
 * hold, so the balance cannot be spent twice and reserved credits stay reserved.
 */
export async function payWebsiteProject(projectId: string, expectedCredits: number): Promise<PayProjectResult> {
  const { orgId, userId } = await requireOrg();
  const { t, locale } = await getAppMessages(userId);
  const copy = WEBSITE_PROJECT_COPY[locale];
  const credits = (count: number) => plural(t.app.credits.creditsCount, count);

  if (await hasOnlySharedWork()) return { ok: false, reason: "unavailable", error: t.app.credits.guestOnly };
  const unavailable: PayProjectResult = { ok: false, reason: "unavailable", error: copy.cannotPay };
  // Not a uuid, so it names no project: answered here rather than as a database error.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) return unavailable;

  const outcome = await db.transaction(async (tx): Promise<PayProjectResult & { fresh?: boolean; kind?: string }> => {
    const [project] = await tx
      .select({
        id: websiteProjects.id,
        kind: websiteProjects.kind,
        status: websiteProjects.status,
        creditCost: websiteProjects.creditCost,
        creditsPaid: websiteProjects.creditsPaid,
      })
      .from(websiteProjects)
      .where(and(eq(websiteProjects.id, projectId), eq(websiteProjects.organizationId, orgId)))
      .for("update");
    if (!project || !isWebsiteProjectKind(project.kind)) return unavailable;

    // Already paid: the retry of a payment that went through. Nothing more is taken.
    if ((project.status === "paid" || project.status === "fulfilled") && project.creditsPaid) {
      return { ok: true, credits: project.creditsPaid };
    }
    // Quote requested (no price yet) or declined: nothing can be paid.
    if (project.status !== "quoted" || !project.creditCost || project.creditCost <= 0) return unavailable;
    if (project.creditCost !== expectedCredits) {
      return {
        ok: false,
        reason: "price_changed",
        credits: project.creditCost,
        error: format(copy.priceChanged, { price: credits(project.creditCost) }),
      };
    }

    const slug = WEBSITE_ADDON_SLUG[project.kind];
    const [addon] = await tx
      .select({ id: addons.id, name: addons.name, currency: addons.currency })
      .from(addons)
      .where(eq(addons.slug, slug))
      .limit(1);
    // The add-ons come with the migration; without them there is nothing to record the order under.
    if (!addon) return unavailable;

    const price = project.creditCost;
    const spend = await chargeCredits(tx, {
      organizationId: orgId,
      action: `addon:${slug}`,
      credits: price,
      key: `addon:${project.id}`,
      note: `Website project: ${addon.name}`,
    });
    if (!spend.ok) {
      return {
        ok: false,
        reason: "not_enough",
        credits: spend.price,
        available: spend.available,
        error: format(t.app.credits.notEnough, { price: spend.price, available: spend.available }),
      };
    }

    await tx.insert(addonPurchases).values({
      id: project.id,
      organizationId: orgId,
      addonId: addon.id,
      stripeSessionId: null,
      pricePaidCents: 0,
      currency: addon.currency,
      creditsPaid: price,
      status: "paid",
    });
    await tx
      .update(websiteProjects)
      .set({ status: "paid", creditsPaid: price, paidAt: new Date(), updatedAt: new Date() })
      .where(eq(websiteProjects.id, project.id));

    return { ok: true, credits: price, fresh: true, kind: project.kind };
  });

  if (!outcome.ok) return outcome;

  if (outcome.fresh) {
    await notify({
      organizationId: orgId,
      type: "website.paid",
      userId,
      title: copy.notify.paidTitle,
      body: format(copy.notify.paidBody, { price: credits(outcome.credits) }),
      href: WEBSITE_PROJECTS_PATH,
    });
    await emailWebsiteProjectToAdmins({
      organizationId: orgId,
      kindLabel: outcome.kind === "new" ? "New website" : "Website redesign",
      stage: "paid",
      credits: outcome.credits,
    });
    refresh();
  }
  return { ok: true, credits: outcome.credits };
}
