import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { websiteProjects } from "@/lib/db/schema";

/**
 * Whether this workspace has asked for a website. Decides where someone with
 * no website lands when they open the dashboard (lib/dashboard/gate.ts).
 */
export async function hasWebsiteProject(organizationId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: websiteProjects.id })
    .from(websiteProjects)
    .where(eq(websiteProjects.organizationId, organizationId))
    .limit(1);
  return Boolean(row);
}
