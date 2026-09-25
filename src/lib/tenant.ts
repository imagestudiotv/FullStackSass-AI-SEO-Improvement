import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { ensureOrganization } from "@/lib/auth";
import { getSession } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { member, websiteMembers, websites } from "@/lib/db/schema";

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

export class NoOrganizationError extends Error {
  readonly status = 403;
  constructor() {
    super("User belongs to no organization");
    this.name = "NoOrganizationError";
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
 *
 * IT RECOVERS RATHER THAN THROWS, and it has to be here rather than in a
 * layout. Next renders a layout and its page IN PARALLEL, so the recovery the
 * app and onboarding layouts used to do - create the missing workspace, then
 * retry - never ran before the page's own requireOrg. The page threw
 * NoOrganizationError first and the customer got the error screen: digest
 * 589590434 in production, on /dashboard, for an account whose workspace was
 * gone. Every caller now gets the same answer, whichever runs first.
 *
 *  - No session: redirect to sign-in, as requireSession does. Throwing here
 *    showed "something went wrong" to anyone whose session expired on a
 *    website page, because the page ran alongside the layout's redirect.
 *  - The session names an organization the user is no longer in: use one they
 *    ARE in. The stale id is never honoured, so nothing is granted; the
 *    customer simply lands in their own workspace instead of on an error.
 *  - No membership at all: create the workspace signup would have created.
 *    ensureOrganization takes a per-user lock, so the layout and page arriving
 *    here together make one workspace, not two.
 *
 * cache(): one resolution per request, shared by the layout, the page and
 * everything they call.
 */
export const requireOrg = cache(async (): Promise<OrgContext> => {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
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
    if (membership) {
      return { orgId: activeOrganizationId, userId, role: membership.role };
    }
    // Stale: the session names an organization the user is not (or no longer)
    // in. Fall through to one they really belong to.
  }

  const fallback = await findMembership(userId);
  if (fallback) return { ...fallback, userId };

  console.warn(
    `[tenant] user ${userId} had no workspace - creating one`,
  );
  await ensureOrganization(session.user);

  const created = await findMembership(userId);
  // A second miss is a real fault (the insert failed) and must surface.
  if (!created) {
    throw new NoOrganizationError();
  }
  return { ...created, userId };
});

async function findMembership(userId: string) {
  const row = await db.query.member.findFirst({
    where: eq(member.userId, userId),
  });
  return row ? { orgId: row.organizationId, role: row.role } : null;
}

export type WebsiteContext = OrgContext & {
  site: typeof websites.$inferSelect;
  /**
   * What the caller may do with this website.
   *
   * "owner" for anyone in the workspace that owns it — they pay for it and
   * can delete it. "editor" and "viewer" come from a website_members row: a
   * person invited to one site, who is NOT in the workspace and must not see
   * its other sites.
   */
  access: "owner" | "editor" | "viewer";
};

/**
 * Loads a website scoped to the caller's organization.
 *
 * A website belonging to another organization is indistinguishable from one
 * that does not exist — both throw WebsiteNotFoundError (404).
 */
export const requireWebsite = cache(async (
  websiteId: string,
): Promise<WebsiteContext> => {
  const ctx = await requireOrg();

  // A malformed id must 404, not blow up with a Postgres cast error.
  if (!UUID_RE.test(websiteId)) {
    throw new WebsiteNotFoundError();
  }

  /**
   * Owned by the caller's workspace: full access, and the common case.
   */
  const owned = await db.query.websites.findFirst({
    where: and(eq(websites.id, websiteId), eq(websites.organizationId, ctx.orgId)),
  });
  if (owned) {
    return { site: owned, access: "owner", ...ctx };
  }

  /**
   * Invited to this one website.
   *
   * Checked only after ownership fails, so the usual path costs one query.
   * The membership row is the authority — being invited to one site grants
   * nothing anywhere else, which is the whole point of inviting an editor to
   * a single client's site.
   *
   * Still a 404 when there is no row: a 403 would confirm the website exists,
   * which is exactly what this guard avoids disclosing.
   */
  const [invited] = await db
    .select({ role: websiteMembers.role })
    .from(websiteMembers)
    .where(
      and(
        eq(websiteMembers.websiteId, websiteId),
        eq(websiteMembers.userId, ctx.userId),
      ),
    )
    .limit(1);

  if (!invited) {
    throw new WebsiteNotFoundError();
  }

  const site = await db.query.websites.findFirst({
    where: eq(websites.id, websiteId),
  });
  if (!site) {
    throw new WebsiteNotFoundError();
  }

  return {
    site,
    access: invited.role === "viewer" ? "viewer" : "editor",
    ...ctx,
  };
});

/**
 * requireWebsite for a PAGE or LAYOUT: a website that is not the caller's
 * renders the 404 screen.
 *
 * The websites layout already turned WebsiteNotFoundError into notFound(), but
 * it renders in parallel with the page, so the page's own throw reached
 * error.tsx first - "Trying again usually works" for a website that was
 * deleted, which trying again never fixes. Seen in production on every
 * section of a removed site.
 *
 * Server actions and route handlers keep calling requireWebsite and catching
 * the error themselves; they answer with their own responses, not a page.
 */
export async function requireWebsitePage(
  websiteId: string,
): Promise<WebsiteContext> {
  try {
    return await requireWebsite(websiteId);
  } catch (error) {
    if (error instanceof WebsiteNotFoundError) notFound();
    throw error;
  }
}
