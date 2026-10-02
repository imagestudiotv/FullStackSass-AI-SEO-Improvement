import "server-only";

import { and, asc, eq, ne } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/lib/db";
import { websiteMembers, websites } from "@/lib/db/schema";
import { requireOrg } from "@/lib/tenant";
import { listPendingInvitations } from "@/lib/websites/pending-invitations";

/**
 * Every website the signed-in person can open: the ones their workspace owns,
 * then the ones somebody else has shared with them.
 *
 * WHY THIS EXISTS. listWebsites() answers "what does my workspace own", and
 * everything that decided where to send someone - the dashboard, onboarding,
 * the switcher - asked only that. An invited editor is NOT in the owner's
 * workspace (website_members grants one site, deliberately nothing else), and
 * every account gets an empty workspace of its own at signup. So the invitee
 * owned nothing, the dashboard sent them to onboarding, onboarding asked them
 * to add a website, and the site they had been invited to was reachable only
 * by typing its URL. This list is what lets routing see shared sites at all.
 *
 * FOR ROUTING AND DISPLAY ONLY. requireWebsite() / requireWebsitePage() in
 * lib/tenant.ts remain the only authority for READING a site's data. A row
 * here says "offer this site", never "this caller may read it": every page the
 * id leads to checks again. The two must agree - every id listed here passes
 * requireWebsite with the same access - and tenant isolation tests hold this
 * to that, but if they ever disagreed, requireWebsite wins.
 *
 * NO ORGANIZATION IDS. Nothing below carries the owning workspace's id: the
 * result is handed to client components (the switcher, the websites page),
 * and a guest has no business learning which workspace pays for the site
 * they were invited to, let alone being able to name it in a request.
 */

/** The same three answers as WebsiteContext.access in lib/tenant.ts. */
export type WebsiteAccess = "owner" | "editor" | "viewer";

export type AccessibleWebsite = {
  id: string;
  url: string;
  domain: string;
  brandName: string | null;
  industry: string | null;
  status: string;
  createdAt: Date;
  access: WebsiteAccess;
};

/** The columns both halves select, so the two cannot drift apart. */
const columns = {
  id: websites.id,
  url: websites.url,
  domain: websites.domain,
  brandName: websites.brandName,
  industry: websites.industry,
  status: websites.status,
  createdAt: websites.createdAt,
};

/**
 * The websites `userId`, acting from workspace `orgId`, can open.
 *
 * Takes both ids rather than reading the session so it can be tested without
 * one; pages call listAccessibleWebsites() below, which passes requireOrg()'s
 * answer - the same resolution requireWebsite uses, so the two agree on which
 * workspace is "yours".
 *
 * THE ORDER IS PART OF THE CONTRACT (pickDashboardSite relies on it):
 *  - Owned first, oldest first. The site a returning customer means by "my
 *    website", and the same default the dashboard and the sidebar already use.
 *  - Then shared, in the order access was granted. A stable answer to "which
 *    shared site first" that does not change when an owner renames or
 *    re-analyses their site.
 * Ties break on the website id, so two rows written in the same millisecond
 * still come back in the same order on every request.
 */
export async function accessibleWebsitesFor(
  orgId: string,
  userId: string,
): Promise<AccessibleWebsite[]> {
  const owned = await db
    .select(columns)
    .from(websites)
    .where(eq(websites.organizationId, orgId))
    .orderBy(asc(websites.createdAt), asc(websites.id));

  /*
    Shared: joined from website_members BY USER ID ONLY, the same key
    requireWebsite's guest path checks. Nothing here filters by the owner's
    workspace, so a guest's list can only ever contain sites they hold a row
    for - never the owner's other sites.

    Sites the caller's own workspace owns are excluded even if a row exists
    (someone invited before joining the workspace). requireWebsite answers
    "owner" for those, and listing them twice - once as owner, once as an
    editor - would put a lower role on screen than the one the server grants.
  */
  const shared = await db
    .select({ ...columns, role: websiteMembers.role })
    .from(websiteMembers)
    .innerJoin(websites, eq(websites.id, websiteMembers.websiteId))
    .where(
      and(
        eq(websiteMembers.userId, userId),
        ne(websites.organizationId, orgId),
      ),
    )
    .orderBy(asc(websiteMembers.createdAt), asc(websites.id));

  return [
    ...owned.map((site) => ({ ...site, access: "owner" as const })),
    ...shared.map(({ role, ...site }) => ({
      ...site,
      /*
        The same mapping as requireWebsite: anything that is not explicitly
        "viewer" is an editor. Kept identical so the label in the switcher is
        the access the server will actually grant.
      */
      access: role === "viewer" ? ("viewer" as const) : ("editor" as const),
    })),
  ];
}

/**
 * accessibleWebsitesFor() for the signed-in caller.
 *
 * cache(): the layout (switcher, sidebar) and the page (dashboard routing)
 * both need this on the same request, and it should cost one pair of queries.
 */
export const listAccessibleWebsites = cache(
  async (): Promise<AccessibleWebsite[]> => {
    const { orgId, userId } = await requireOrg();
    return accessibleWebsitesFor(orgId, userId);
  },
);

/**
 * True when every website the caller can open was shared with them - they own
 * none, and have been invited to at least one.
 *
 * This is the person onboarding must leave alone: they came to work on
 * somebody else's site, and "add your website" is a question about a site
 * they do not have. Someone with no websites at all is NOT guest-only; they
 * are a new customer and onboarding is exactly right for them.
 */
export async function isGuestOnly(): Promise<boolean> {
  const sites = await listAccessibleWebsites();
  return (
    sites.length > 0 && sites.every((site) => site.access !== "owner")
  );
}

/**
 * True when the caller owns no website but has somebody else's to work on:
 * one shared with them (isGuestOnly), or an invitation waiting for their
 * proven address (lib/websites/pending-invitations.ts).
 *
 * The ONE statement of "came for somebody else's site". Every entry into
 * setup - /onboarding, its website step, /setup - asks it before offering
 * "add your website", and sends a yes to the dashboard, which shows the
 * shared site or the invitation. The app layout asks it before offering
 * Add-ons and a credit balance, which are for buying on a site of your own.
 * Someone with nothing at all is NOT this: they are a new customer, and
 * onboarding is exactly right for them.
 *
 * Invitations are read only when the list is empty, so an owner or a guest
 * pays for no extra query; both reads are request-cached.
 */
export async function hasOnlySharedWork(): Promise<boolean> {
  if (await isGuestOnly()) return true;
  // Not given a site yet either: only a waiting invitation can make it so.
  return (
    (await listAccessibleWebsites()).length === 0 &&
    (await listPendingInvitations()).length > 0
  );
}

/**
 * Which website the dashboard shows.
 *
 *  1. The requested one (?site=), when it is in the list. An id that is not -
 *     another tenant's, a deleted site, a typo - falls back SILENTLY rather
 *     than erroring, so the answer never confirms that an id exists.
 *  2. Otherwise the oldest site the caller owns. Their own site is what an
 *     owner means by "my dashboard", and a dual-role user's own paywall and
 *     onboarding should still find them - unless that site is unpaid, when
 *     resolveDashboard shows the shared one instead (see lib/dashboard/gate).
 *  3. Otherwise the first site shared with them.
 *  4. Otherwise nothing: a brand-new account.
 *
 * Expects `sites` in accessibleWebsitesFor's order, where the first owned
 * entry is the oldest and the first shared entry the earliest granted.
 */
export function pickDashboardSite(
  sites: AccessibleWebsite[],
  requested: string | null,
): AccessibleWebsite | null {
  if (requested) {
    const match = sites.find((site) => site.id === requested);
    if (match) return match;
  }
  return (
    sites.find((site) => site.access === "owner") ??
    sites.find((site) => site.access !== "owner") ??
    null
  );
}
