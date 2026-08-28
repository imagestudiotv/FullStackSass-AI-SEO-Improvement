import { and, eq } from "drizzle-orm";

import { getSession } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { member, websites } from "@/lib/db/schema";

/**
 * Tenant access control.
 *
 * FROM DAY 2 ONWARD, requireOrg() AND requireWebsite() ARE THE ONLY WAYS
 * TENANT DATA IS READ. Never query websites, articles, keywords, pages or any
 * other tenant-scoped table without going through one of them first. One
 * customer reading another's data would end this product.
 *
 * A layout guard is not enough on its own: Next.js layouts do not re-run on
 * client-side navigation under partial rendering, so these must be called in
 * every server action, route handler and page that touches tenant data.
 */

export class UnauthenticatedError extends Error {
  readonly status = 401;
  constructor() {
    super("Not signed in");
    this.name = "UnauthenticatedError";
  }
}

export class NoOrganizationError extends Error {
  readonly status = 403;
  constructor() {
    super("User belongs to no organization");
    this.name = "NoOrganizationError";
  }
}

export class NotAMemberError extends Error {
  readonly status = 403;
  constructor() {
    super("Not a member of the active organization");
    this.name = "NotAMemberError";
  }
}

/**
 * Thrown when a website id does not exist *or* belongs to another
 * organization. Deliberately 404, never 403: a 403 confirms the id exists,
 * which leaks the existence of another tenant's records.
 */
export class WebsiteNotFoundError extends Error {
  readonly status = 404;
  constructor() {
    super("Website not found");
    this.name = "WebsiteNotFoundError";
  }
}

export type OrgContext = {
  orgId: string;
  userId: string;
  role: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves the caller's active organization and re-checks membership against
 * the database.
 *
 * activeOrganizationId from the session is NOT trusted: a user removed from an
 * organization can still hold a session naming it. The membership row is the
 * authority, always.
 */
export async function requireOrg(): Promise<OrgContext> {
  const session = await getSession();
  if (!session) {
    throw new UnauthenticatedError();
  }

  const userId = session.user.id;
  const activeOrganizationId = session.session.activeOrganizationId ?? null;

  if (activeOrganizationId) {
    const membership = await db.query.member.findFirst({
      where: and(
        eq(member.organizationId, activeOrganizationId),
        eq(member.userId, userId),
      ),
    });
    // Session names an organization the user is not (or no longer) in.
    if (!membership) {
      throw new NotAMemberError();
    }
    return { orgId: activeOrganizationId, userId, role: membership.role };
  }

  // No active organization on the session (e.g. first request after signup).
  // Fall back to a real membership row rather than trusting session state.
  const fallback = await db.query.member.findFirst({
    where: eq(member.userId, userId),
  });
  if (!fallback) {
    throw new NoOrganizationError();
  }
  return {
    orgId: fallback.organizationId,
    userId,
    role: fallback.role,
  };
}

export type WebsiteContext = OrgContext & {
  site: typeof websites.$inferSelect;
};

/**
 * Loads a website scoped to the caller's organization.
 *
 * A website belonging to another organization is indistinguishable from one
 * that does not exist — both throw WebsiteNotFoundError (404).
 */
export async function requireWebsite(
  websiteId: string,
): Promise<WebsiteContext> {
  const ctx = await requireOrg();

  // A malformed id must 404, not blow up with a Postgres cast error.
  if (!UUID_RE.test(websiteId)) {
    throw new WebsiteNotFoundError();
  }

  const site = await db.query.websites.findFirst({
    where: and(eq(websites.id, websiteId), eq(websites.organizationId, ctx.orgId)),
  });
  if (!site) {
    throw new WebsiteNotFoundError();
  }

  return { site, ...ctx };
}
