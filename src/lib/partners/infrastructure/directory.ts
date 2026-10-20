import { createHash } from "node:crypto";
import { isIP } from "node:net";

import { and, asc, desc, eq, gt, gte, inArray, lt, ne, sql } from "drizzle-orm";

import {
  billingCustomers,
  invitation,
  member,
  organization,
  payments,
  plans,
  session,
  subscriptions,
  user,
  websiteInvitations,
  websites,
} from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

import type { PlanSummary, UserDirectory } from "../application/ports/directory";

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
      // Sessions hold the address as Better Auth stores it (an IPv6 address as its /64); compare like with like.
      const forms = [...new Set([signup.ipAddress, sessionAddressForm(signup.ipAddress)])];
      const rows = await db
        .select({ userAgent: session.userAgent })
        .from(session)
        .where(and(eq(session.userId, partnerUserId), inArray(session.ipAddress, forms)))
        .limit(20);
      return {
        sharedNetwork: rows.length > 0,
        sharedDevice: Boolean(signup.userAgent) && rows.some((row) => row.userAgent === signup.userAgent),
      };
    },
    networkKey(ipAddress) {
      return sessionAddressForm(ipAddress);
    },
    async recentSessions(userId) {
      const rows = await db
        .select({ ipAddress: session.ipAddress, userAgent: session.userAgent })
        .from(session)
        .where(eq(session.userId, userId))
        .orderBy(desc(session.createdAt))
        .limit(50);
      return rows.map((row) => ({ network: row.ipAddress ? sessionAddressForm(row.ipAddress) : null, userAgent: row.userAgent }));
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
        Privacy-safe: a shortened form of the customer's website address
        (enough for a partner to recognise a referral they made, not enough
        to look the business up), else an opaque reference. Never a name or
        an email: a partner link can be posted publicly, and the people who
        arrive through it are not necessarily anyone the partner knows.
      */
      const domains = await firstDomains(db, organizationIds);
      const labels: Record<string, string> = {};
      for (const id of organizationIds) {
        const domain = domains.get(id);
        labels[id] = domain ? maskDomain(domain) : customerReference(id);
      }
      return labels;
    },
    async organizationSummaries(organizationIds) {
      if (organizationIds.length === 0) return {};
      const [domains, names] = await Promise.all([
        firstDomains(db, organizationIds),
        db.select({ id: organization.id, name: organization.name }).from(organization).where(inArray(organization.id, organizationIds)),
      ]);
      const byId = new Map(names.map((row) => [row.id, row.name]));
      const summaries: Record<string, { name: string; domain: string | null; reference: string }> = {};
      for (const id of organizationIds) {
        summaries[id] = { name: byId.get(id) ?? "(workspace removed)", domain: domains.get(id) ?? null, reference: customerReference(id) };
      }
      return summaries;
    },
    async plansFor(input) {
      const summary = (row: { name: string; interval: string; priceCents: number; currency: string }): PlanSummary => ({
        name: row.name,
        interval: row.interval === "year" ? "year" : "month",
        priceCents: row.priceCents,
        currency: row.currency,
      });
      const columns = { name: plans.name, interval: plans.interval, priceCents: plans.priceCents, currency: plans.currency };
      const [byPriceRows, bySubscriptionRows] = await Promise.all([
        input.priceIds.length
          ? db.select({ ...columns, priceId: plans.stripePriceId }).from(plans).where(inArray(plans.stripePriceId, input.priceIds))
          : Promise.resolve([]),
        input.subscriptionIds.length
          ? db
              .select({ ...columns, subscriptionId: subscriptions.stripeSubscriptionId })
              .from(subscriptions)
              .innerJoin(plans, eq(plans.id, subscriptions.planId))
              .where(inArray(subscriptions.stripeSubscriptionId, input.subscriptionIds))
          : Promise.resolve([]),
      ]);
      const byPrice: Record<string, PlanSummary> = {};
      for (const row of byPriceRows) if (row.priceId) byPrice[row.priceId] = summary(row);
      const bySubscription: Record<string, PlanSummary> = {};
      for (const row of bySubscriptionRows) if (row.subscriptionId) bySubscription[row.subscriptionId] = summary(row);
      return { byPrice, bySubscription };
    },
  };
}

async function firstDomains(db: Executor, organizationIds: string[]): Promise<Map<string, string>> {
  const sites = await db
    .select({ organizationId: websites.organizationId, domain: websites.domain })
    .from(websites)
    .where(inArray(websites.organizationId, organizationIds))
    .orderBy(asc(websites.createdAt));
  const domains = new Map<string, string>();
  for (const site of sites) {
    if (!domains.has(site.organizationId)) domains.set(site.organizationId, site.domain);
  }
  return domains;
}

/**
 * An address in the form Better Auth stores in session.ip_address
 * (@better-auth/core utils/ip normalizeIP, default /64): IPv4 as is, an
 * IPv4-mapped IPv6 address as its IPv4, any other IPv6 address expanded with
 * everything after its /64 network zeroed - "2001:db8:763d:a5::1" ->
 * "2001:0db8:763d:00a5:0000:0000:0000:0000". Without this, a signup's raw
 * IPv6 address never matched the partner's sessions and the shared-network
 * signal could not fire for IPv6 visitors.
 */
export function sessionAddressForm(ip: string): string {
  const value = ip.trim().toLowerCase();
  const version = isIP(value);
  if (version !== 6) return value;
  let text = value;
  // A dotted IPv4 tail ("::ffff:192.0.2.1", "64:ff9b::192.0.2.1") as two hex groups.
  const dotted = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text);
  if (dotted) {
    const [a, b, c, d] = dotted.slice(1).map(Number);
    text = `${text.slice(0, dotted.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [left, right] = text.includes("::") ? text.split("::") : [text, null];
  const head = left ? left.split(":") : [];
  const tail = right === null ? [] : right ? right.split(":") : [];
  const groups = [...head, ...Array(8 - head.length - tail.length).fill("0"), ...tail].map((group) => group.padStart(4, "0"));
  if (groups.slice(0, 5).every((group) => group === "0000") && groups[5] === "ffff") {
    const [high, low] = [parseInt(groups[6], 16), parseInt(groups[7], 16)];
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }
  return [...groups.slice(0, 4), "0000", "0000", "0000", "0000"].join(":");
}

/** The same opaque reference for a customer in the partner's and the administrator's views. */
export function customerReference(organizationId: string): string {
  return `Customer ${createHash("sha256").update(organizationId).digest("hex").slice(0, 6).toUpperCase()}`;
}

/**
 * "example.co.uk" -> "ex•••.co.uk", "www.shop.io" -> "sh•••.io": the first two
 * letters of the name and its ending. Subdomains are dropped.
 */
export function maskDomain(domain: string): string {
  const labels = domain.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].split(".").filter(Boolean);
  if (labels[0] === "www") labels.shift();
  if (labels.length < 2) return `${(labels[0] ?? "").slice(0, 2)}•••`;
  // A two-part ending such as co.uk or com.br: both parts short.
  const twoPart = labels.length >= 3 && labels[labels.length - 1].length <= 3 && labels[labels.length - 2].length <= 3;
  const suffix = labels.slice(twoPart ? -2 : -1).join(".");
  const name = labels[labels.length - (twoPart ? 3 : 2)];
  return `${name.slice(0, 2)}•••.${suffix}`;
}
