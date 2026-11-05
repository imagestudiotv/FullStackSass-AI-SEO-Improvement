import { and, eq, inArray, ne, or, sql } from "drizzle-orm";

import { DEFAULT_MONTHLY_CAP } from "@/lib/backlinks/network-defaults";
import { member, organization, user } from "@/lib/db/auth-tables";
import { calendarItems, integrations, jobOutbox, networkSites, socialAccounts, subscriptions, websites } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";
import { NEW_SITE_DEFAULTS } from "@/lib/websites/new-site-defaults";
import { normalizeWebsiteUrl } from "@/lib/websites/url";

/**
 * RepGet's own website as a normal website in its owner's dashboard, so it can
 * use audits and social tools (client, 2026-11-05). scripts/setup-repget-site.ts
 * is the way in; it does nothing here but ask and print until told to write.
 *
 * THE SAME RECORD addWebsite makes (lib/websites/actions.ts), from the same
 * address validation and defaults, with three differences, because this site
 * already has its blog (the blog autopilot) and must not get a second one:
 *
 *  - generationMode "manual": the article scheduler only picks "automatic" sites.
 *  - autoPublish off (the "review" publishing mode): nothing goes out by itself.
 *  - a Partner Network row with acceptingLinks OFF, where addWebsite writes ON.
 *    Links are placed only between sites accepting them, and the daily job that
 *    enrols subscribed websites (activate-exchange) only inserts where there is
 *    no row, so this row is what keeps it out for good.
 *
 * Nothing about entitlement is changed or weakened: audits and social tools
 * still ask for a live plan on this website, and this reports whether there is
 * one. It never creates a subscription, credits or a social or CMS connection.
 */

/** The address the client gave. Normal validation stores it without "www.", like every customer's. */
export const OWN_SITE_ADDRESS = "https://www.repget.com";

/** The settings that keep this site from writing, publishing or swapping links by itself. */
export const OWN_SITE_SETTINGS = { generationMode: "manual", autoPublish: false, publishAs: "live" } as const;

export const OWN_SITE_NETWORK = { acceptingLinks: false, monthlyCap: DEFAULT_MONTHLY_CAP } as const;

/** Serialises setups: the websites table has no unique index a second run could trip over. */
const LOCK = sql`select pg_advisory_xact_lock(hashtext('own_site_setup'))`;

export type Change = { field: string; from: unknown; to: unknown };

export type OwnSitePlan =
  | { action: "refuse"; reason: string }
  | {
      action: "create" | "update" | "nothing";
      url: string;
      domain: string;
      workspace: { id: string; name: string; slug: string; owners: string[] };
      websiteId: string | null;
      /** What writing would change; empty when nothing would. */
      changes: Change[];
      /** A live plan on this site: audits and social tools ask for it. */
      plan: { status: string } | null;
      calendarItems: number;
      socialAccounts: number;
      cmsConnections: number;
    };

const refuse = (reason: string): OwnSitePlan => ({ action: "refuse", reason });

/** The workspace named, exactly: by id, by slug, or by a name only one has. Never a guess. */
async function findWorkspace(db: Executor, named: string | undefined) {
  const wanted = named?.trim();
  if (!wanted) return { error: "Name the owner workspace: --workspace <organization id or slug>. Nothing was changed; it never picks one by itself." };
  const rows = await db
    .select({ id: organization.id, name: organization.name, slug: organization.slug })
    .from(organization)
    .where(or(eq(organization.id, wanted), eq(organization.slug, wanted), sql`lower(${organization.name}) = ${wanted.toLowerCase()}`));
  if (rows.length === 0) return { error: `No workspace is called "${wanted}". Nothing was changed.` };
  if (rows.length > 1) return { error: `"${wanted}" matches ${rows.length} workspaces (${rows.map((row) => row.id).join(", ")}). Name one by its id. Nothing was changed.` };
  const owners = await db
    .select({ email: user.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.organizationId, rows[0].id), eq(member.role, "owner")));
  if (owners.length === 0) return { error: `Workspace ${rows[0].id} has no owner, so it cannot be the owner's workspace. Nothing was changed.` };
  return { workspace: { ...rows[0], owners: owners.map((owner) => owner.email) } };
}

/** What setting the site up would do. Reads only. */
export async function planOwnSite(db: Executor, input: { workspace: string | undefined; address?: string }): Promise<OwnSitePlan> {
  const normalized = normalizeWebsiteUrl(input.address ?? OWN_SITE_ADDRESS);
  const found = await findWorkspace(db, input.workspace);
  if (found.error !== undefined) return refuse(found.error);
  const { workspace } = found;

  const sameDomain = sql`regexp_replace(lower(${websites.domain}), '^www\\.', '') = ${normalized.domain}`;
  const elsewhere = await db
    .select({ id: websites.id, organizationId: websites.organizationId })
    .from(websites)
    .where(and(sameDomain, ne(websites.organizationId, workspace.id)));
  if (elsewhere.length > 0) {
    return refuse(`${normalized.domain} is already in another workspace (${elsewhere.map((row) => `${row.organizationId}, website ${row.id}`).join("; ")}). Decide which one owns it. Nothing was changed.`);
  }
  const here = await db
    .select({ id: websites.id, generationMode: websites.generationMode, autoPublish: websites.autoPublish, publishAs: websites.publishAs })
    .from(websites)
    .where(and(sameDomain, eq(websites.organizationId, workspace.id)));
  if (here.length > 1) return refuse(`${normalized.domain} is in this workspace ${here.length} times (${here.map((row) => row.id).join(", ")}). Remove the extra one by hand. Nothing was changed.`);

  const base = { url: normalized.url, domain: normalized.domain, workspace };
  const [site] = here;
  if (!site) {
    return {
      action: "create",
      ...base,
      websiteId: null,
      changes: [
        ...Object.entries(OWN_SITE_SETTINGS).map(([field, to]) => ({ field, from: null, to })),
        { field: "network.acceptingLinks", from: null, to: OWN_SITE_NETWORK.acceptingLinks },
      ],
      plan: null,
      calendarItems: 0,
      socialAccounts: 0,
      cmsConnections: 0,
    };
  }

  const changes: Change[] = [];
  for (const [field, to] of Object.entries(OWN_SITE_SETTINGS)) {
    const from = site[field as keyof typeof OWN_SITE_SETTINGS];
    if (from !== to) changes.push({ field, from, to });
  }
  const [network] = await db.select({ acceptingLinks: networkSites.acceptingLinks }).from(networkSites).where(eq(networkSites.websiteId, site.id));
  if (network?.acceptingLinks !== false) changes.push({ field: "network.acceptingLinks", from: network?.acceptingLinks ?? null, to: false });

  const [plan] = await db.select({ status: subscriptions.status }).from(subscriptions).where(and(eq(subscriptions.websiteId, site.id), inArray(subscriptions.status, ["active", "trialing", "past_due"]))).limit(1);
  const count = async (table: typeof calendarItems | typeof socialAccounts | typeof integrations) =>
    (await db.select({ n: sql<number>`count(*)::int` }).from(table).where(eq(table.websiteId, site.id)))[0].n;
  return {
    action: changes.length > 0 ? "update" : "nothing",
    ...base,
    websiteId: site.id,
    changes,
    plan: plan ?? null,
    calendarItems: await count(calendarItems),
    socialAccounts: await count(socialAccounts),
    cmsConnections: await count(integrations),
  };
}

/**
 * Does what planOwnSite says, deciding again inside one locked transaction, so
 * running it twice, or twice at once, leaves one website. A new website gets
 * the normal analysis job with it (a site "pending" with no job behind it would
 * wait for ever, and audits refuse until it is analysed): the job outbox delivers
 * it, the analysis reads the homepage once and makes one model call, and sets
 * the site "ready". No other job follows from it.
 */
export async function applyOwnSite(db: Pick<Executor, "transaction">, input: { workspace: string | undefined; address?: string }): Promise<OwnSitePlan> {
  return db.transaction(async (tx) => {
    await tx.execute(LOCK);
    const plan = await planOwnSite(tx, input);
    if (plan.action === "refuse" || plan.action === "nothing") return plan;
    const now = new Date();

    if (plan.action === "create") {
      const [created] = await tx
        .insert(websites)
        .values({ organizationId: plan.workspace.id, url: plan.url, domain: plan.domain, status: "pending", ...NEW_SITE_DEFAULTS, ...OWN_SITE_SETTINGS })
        .returning({ id: websites.id });
      await tx.insert(networkSites).values({ websiteId: created.id, ...OWN_SITE_NETWORK });
      await tx
        .insert(jobOutbox)
        .values({
          eventId: `website-analyze:own-site:${created.id}`,
          name: "website/analyze.requested",
          data: { websiteId: created.id, organizationId: plan.workspace.id, reservations: [] },
          status: "pending",
          nextAttemptAt: now,
        })
        .onConflictDoNothing({ target: jobOutbox.eventId });
      return { ...plan, websiteId: created.id };
    }

    const websiteId = plan.websiteId as string;
    await tx.update(websites).set({ ...OWN_SITE_SETTINGS, updatedAt: now }).where(eq(websites.id, websiteId));
    await tx
      .insert(networkSites)
      .values({ websiteId, ...OWN_SITE_NETWORK })
      .onConflictDoUpdate({ target: networkSites.websiteId, set: { acceptingLinks: false, updatedAt: now } });
    return plan;
  });
}

/**
 * Everything a new website sets off, traced from the code, with what happens to
 * this one. Printed in the report so nobody has to take the settings on trust.
 */
export const OWN_SITE_TRIGGERS = [
  { what: "addWebsite's defaults (lib/websites/new-site-defaults.ts): publish live on the planned day", outcome: "Replaced: autoPublish off, generationMode manual." },
  { what: "addWebsite's Partner Network row, accepting links", outcome: "Replaced: the row is written with acceptingLinks off. Placements refuse a site not accepting (lib/backlinks/managed.ts), and matching skips it (lib/backlinks/matching.ts)." },
  { what: "website/analyze.requested (inngest/functions/analyze-website.ts)", outcome: "HAPPENS once on a new website: one homepage fetch and one model call, then status ready. It queues nothing after it. Skipped for an existing website." },
  { what: "activate-exchange, daily: joins sites with a plan to the network after 3 days", outcome: "Blocked: it only inserts where no network row exists." },
  { what: "scheduled-articles, twice daily: writes due calendar items", outcome: "Blocked: it selects generation_mode 'automatic' only, so anything on the calendar stays unwritten." },
  { what: "publishing: the first article goes out at once, whatever the setting", outcome: "Cannot happen: no article is written by itself, and this creates no CMS connection. Report line 'CMS connections' shows if someone adds one." },
  { what: "blog autopilot (inngest/functions/blog-autopilot.ts)", outcome: "Unrelated: it reads its own topic list, not websites, so no second blog starts from here." },
  { what: "renewal-replan, hourly, with a plan: keyword research for a new period", outcome: "May run once the site has a plan (research cost only). It fills the calendar, which is never written by itself on a manual site." },
  { what: "site-inventory, daily: reads a site's public WordPress posts", outcome: "Once the site has a plan: a read-only request to the site. It writes no post; a site without WordPress is recorded as such." },
  { what: "collect-authority, daily: the domain's authority figure", outcome: "Once the site has a plan: one domain in the shared daily bulk request (a data-provider cost). It places nothing." },
  { what: "social-suggestions-daily and video-ideas-daily", outcome: "Only once a social account is connected or videos are used; this connects nothing and posts nothing." },
  { what: "check-geo, import-analytics, index-articles, verify-backlinks, article-translations", outcome: "Nothing to act on: they need prompts, a Google connection, articles or placements, and this creates none." },
] as const;
