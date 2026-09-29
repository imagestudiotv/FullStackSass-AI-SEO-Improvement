import "server-only";

import { and, eq, ne, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { member, organization, websiteMembers, websites } from "@/lib/db/schema";

/**
 * What the WordPress card says about WHERE it connects.
 *
 * On 2026-09-29 a client added imagestudio.com to a second RepGet account.
 * Their WordPress already held a key from the first one and said
 * "Connected", while the new account said "Never used" - and nothing on
 * either screen named an account. The card now says which workspace it is
 * connecting, and warns when the same person has the same domain in another
 * workspace, since one WordPress site can be connected to only one of them.
 */
export type PluginConnectionContext = {
  domain: string;
  workspaceName: string;
  /**
   * The person's OTHER workspaces that also have this domain. Only ever
   * workspaces they belong to (as a member, or invited to that website), so
   * no customer learns about another customer's account.
   */
  alsoIn: string[];
};

/** Lower-case and without "www.": the same site, whichever way it was typed. */
const bareDomain = (column: typeof websites.domain) => sql`regexp_replace(lower(${column}), '^www\\.', '')`;

export async function pluginConnectionContext(websiteId: string, userId: string): Promise<PluginConnectionContext | null> {
  const [site] = await db
    .select({ domain: websites.domain, workspaceName: organization.name, organizationId: websites.organizationId })
    .from(websites)
    .innerJoin(organization, eq(organization.id, websites.organizationId))
    .where(eq(websites.id, websiteId))
    .limit(1);
  if (!site) return null;

  const others = await db
    .selectDistinct({ id: organization.id, name: organization.name })
    .from(websites)
    .innerJoin(organization, eq(organization.id, websites.organizationId))
    .leftJoin(member, and(eq(member.organizationId, websites.organizationId), eq(member.userId, userId)))
    .leftJoin(websiteMembers, and(eq(websiteMembers.websiteId, websites.id), eq(websiteMembers.userId, userId)))
    .where(
      and(
        ne(websites.id, websiteId),
        // By workspace, not by name: a second sign-up is often called the same ("<name>'s Workspace").
        ne(websites.organizationId, site.organizationId),
        sql`${bareDomain(websites.domain)} = regexp_replace(lower(${site.domain}), '^www\\.', '')`,
        or(sql`${member.id} is not null`, sql`${websiteMembers.id} is not null`),
      ),
    );

  return {
    domain: site.domain,
    workspaceName: site.workspaceName,
    alsoIn: others.map((row) => row.name).sort(),
  };
}
