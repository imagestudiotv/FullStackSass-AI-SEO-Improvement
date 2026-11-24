"use server";

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { recordAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { addonPurchases, addons, organization, websiteProjects } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Admin -> Service orders: services a workspace bought (add-ons of kind
 * "service", such as USA Local Citations) that the team delivers by hand. They
 * were recorded and shown to the customer as paid, with no page anywhere that
 * told the team about them. A website project's order is delivered on its own
 * page (lib/website-projects/admin.ts) and is not listed here.
 *
 * Marking one delivered changes what Billing shows its customer; it moves no
 * money and no credits.
 */

export type ServiceOrderRow = {
  id: string;
  service: string;
  status: string;
  organizationId: string;
  organizationName: string;
  creditsPaid: number | null;
  pricePaidCents: number;
  currency: string;
  createdAt: Date;
  fulfilledAt: Date | null;
};

/** What is to be delivered first (oldest first), then what was, newest first. */
export async function listServiceOrders(): Promise<ServiceOrderRow[]> {
  await requireAdmin();
  return db
    .select({
      id: addonPurchases.id,
      service: addons.name,
      status: addonPurchases.status,
      organizationId: addonPurchases.organizationId,
      organizationName: organization.name,
      creditsPaid: addonPurchases.creditsPaid,
      pricePaidCents: addonPurchases.pricePaidCents,
      currency: addonPurchases.currency,
      createdAt: addonPurchases.createdAt,
      fulfilledAt: addonPurchases.fulfilledAt,
    })
    .from(addonPurchases)
    .innerJoin(addons, eq(addons.id, addonPurchases.addonId))
    .innerJoin(organization, eq(organization.id, addonPurchases.organizationId))
    .leftJoin(websiteProjects, eq(websiteProjects.id, addonPurchases.id))
    .where(and(eq(addons.kind, "service"), isNull(websiteProjects.id)))
    .orderBy(
      sql`case when ${addonPurchases.status} = 'paid' then 0 else 1 end`,
      sql`case when ${addonPurchases.status} = 'paid' then ${addonPurchases.createdAt} end asc`,
      desc(addonPurchases.createdAt),
    )
    .limit(200);
}

export async function markServiceOrderDelivered(id: string, note: string): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  const what = note.trim().slice(0, 500);
  if (what.length < 3) return { ok: false, error: "Say what was delivered. It is kept in the admin log." };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Order not found." };
  const done = await db.transaction(async (tx) => {
    const now = new Date();
    const [order] = await tx
      .update(addonPurchases)
      .set({ status: "fulfilled", fulfilledAt: now, updatedAt: now })
      .where(
        and(
          eq(addonPurchases.id, id),
          // Only what is still to be delivered, so two administrators record it once.
          eq(addonPurchases.status, "paid"),
          sql`${addonPurchases.addonId} in (select a.id from ${addons} a where a.kind = 'service')`,
          sql`not exists (select 1 from ${websiteProjects} wp where wp.id = ${addonPurchases.id})`,
        ),
      )
      .returning({ organizationId: addonPurchases.organizationId, addonId: addonPurchases.addonId });
    if (!order) return false;
    const [addon] = await tx.select({ name: addons.name }).from(addons).where(eq(addons.id, order.addonId));
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "service_order.delivered",
        targetType: "service_order",
        targetId: id,
        organizationId: order.organizationId,
        summary: `Delivered ${addon?.name ?? "a service"} - ${what}`,
        detail: { note: what },
      },
      tx,
    );
    return true;
  });
  if (!done) return { ok: false, error: "This order has changed. Reload the page." };
  revalidatePath("/admin/service-orders");
  revalidatePath("/billing");
  return { ok: true, data: null };
}
