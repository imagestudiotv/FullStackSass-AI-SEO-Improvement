import { createHash } from "node:crypto";

import { and, asc, eq, gt, gte, inArray, lt, ne, sql } from "drizzle-orm";

import {
  billingCustomers,
  invitation,
  member,
  organization,
  payments,
  session,
  user,
  websiteInvitations,
  websites,
} from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

import type { UserDirectory } from "../application/ports/directory";

/** The rest of the app's identity tables, read-only, for the partner program. */
export function userDirectory(db: Executor): UserDirectory {
  return {
    async findUser(userId) {
      const [row] = await db
        .select({ id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerified, createdAt: user.createdAt })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      return row ? { ...row, emailVerified: row.emailVerified === true } : null;
    },
    async isInvited(email) {
      const normalised = email.trim().toLowerCase();
      /*
        Website invitations are the invitations this app sends; their rows
        are kept after acceptance or expiry, so ANY row means this address
        came to work on somebody else's site. Better Auth's organization
        invitations are not used by the app today; a pending one counts too.
      */
      const [site] = await db
        .select({ id: websiteInvitations.id })
        .from(websiteInvitations)
        .where(eq(websiteInvitations.email, normalised))
        .limit(1);
      if (site) return true;
      const [org] = await db
        .select({ id: invitation.id })
        .from(invitation)
        .where(and(sql`lower(${invitation.email}) = ${normalised}`, eq(invitation.status, "pending")))
        .limit(1);
      return Boolean(org);
    },
    async foundingOrganization(userId, userCreatedAt) {
      // The workspace signup creates: an owner membership in an organization made no earlier than the account.
      const [row] = await db
        .select({ organizationId: member.organizationId })
        .from(member)
        .innerJoin(organization, eq(organization.id, member.organizationId))
        .where(
          and(
            eq(member.userId, userId),
            eq(member.role, "owner"),
            gte(organization.createdAt, new Date(userCreatedAt.getTime() - 60_000)),
          ),
        )
        .orderBy(asc(organization.createdAt))
        .limit(1);
      return row?.organizationId ?? null;
    },
    async ownersOf(organizationId) {
      const rows = await db
        .select({ userId: member.userId })
        .from(member)
        .where(and(eq(member.organizationId, organizationId), eq(member.role, "owner")))
        .orderBy(asc(member.createdAt));
      return rows.map((row) => row.userId);
    },
    async sessionSignals(partnerUserId, signup) {
      if (!signup.ipAddress) return { sharedNetwork: false, sharedDevice: false };
      const rows = await db
        .select({ userAgent: session.userAgent })
        .from(session)
        .where(and(eq(session.userId, partnerUserId), eq(session.ipAddress, signup.ipAddress)))
        .limit(20);
      return {
        sharedNetwork: rows.length > 0,
        sharedDevice: Boolean(signup.userAgent) && rows.some((row) => row.userAgent === signup.userAgent),
      };
    },
    async organizationForStripeCustomer(customerId) {
      const [row] = await db
        .select({ organizationId: billingCustomers.organizationId })
        .from(billingCustomers)
        .where(eq(billingCustomers.stripeCustomerId, customerId))
        .limit(1);
      return row?.organizationId ?? null;
    },
    async organizationForInvoice(invoiceId) {
      const [row] = await db
        .select({ organizationId: payments.organizationId })
        .from(payments)
        .where(and(eq(payments.provider, "stripe"), eq(payments.externalId, invoiceId)))
        .limit(1);
      return row?.organizationId ?? null;
    },
    async priorPaidPayments(organizationId, before, excludingStripeInvoiceId) {
      const [row] = await db
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            eq(payments.organizationId, organizationId),
            gt(payments.amountCents, 0),
            inArray(payments.status, ["paid", "refunded"]),
            lt(payments.paidAt, before),
            ne(payments.externalId, excludingStripeInvoiceId),
          ),
        )
        .limit(1);
      return Boolean(row);
    },
    async customerLabels(organizationIds) {
      if (organizationIds.length === 0) return {};
      /*
        Privacy-safe: the customer's (public) website domain once they have
        one, else an opaque reference. Never a name or an email: a partner
        link can be posted publicly, and the people who arrive through it are
        not necessarily anyone the partner knows.
      */
      const sites = await db
        .select({ organizationId: websites.organizationId, domain: websites.domain })
        .from(websites)
        .where(inArray(websites.organizationId, organizationIds))
        .orderBy(asc(websites.createdAt));
      const labels: Record<string, string> = {};
      for (const site of sites) {
        if (!labels[site.organizationId]) labels[site.organizationId] = site.domain;
      }
      for (const id of organizationIds) {
        if (!labels[id]) labels[id] = `Customer ${createHash("sha256").update(id).digest("hex").slice(0, 6).toUpperCase()}`;
      }
      return labels;
    },
  };
}
