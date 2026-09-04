"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { competitors, websites } from "@/lib/db/schema";
import { requireOrg, requireWebsite } from "@/lib/tenant";
import { LimitExceededError, requireWithinLimit } from "@/lib/usage";
import { InvalidUrlError, normalizeWebsiteUrl } from "@/lib/websites/url";
import { normalizeLanguage } from "@/lib/websites/languages";

/**
 * Website CRUD.
 *
 * Every action starts at requireOrg() or requireWebsite() — never a raw query
 * against websites. A server action is a public HTTP endpoint: the caller
 * chooses the arguments, so the website id can be anything and must be scoped
 * to the caller's organization before it is trusted.
 */

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type WebsiteSummary = {
  id: string;
  url: string;
  domain: string;
  brandName: string | null;
  industry: string | null;
  status: string;
  createdAt: Date;
};

export async function listWebsites(): Promise<WebsiteSummary[]> {
  const { orgId } = await requireOrg();
  return db
    .select({
      id: websites.id,
      url: websites.url,
      domain: websites.domain,
      brandName: websites.brandName,
      industry: websites.industry,
      status: websites.status,
      createdAt: websites.createdAt,
    })
    .from(websites)
    .where(eq(websites.organizationId, orgId))
    .orderBy(desc(websites.createdAt));
}

/**
 * Adds a website to the caller's organization.
 *
 * The plan limit is checked BEFORE the insert. checkLimit only reports; this
 * path must refuse, so it uses requireWithinLimit and lets the error surface
 * as a message the form can show.
 */
export async function addWebsite(
  rawUrl: string,
): Promise<ActionResult<{ id: string }>> {
  const { orgId } = await requireOrg();

  let normalized;
  try {
    normalized = normalizeWebsiteUrl(rawUrl);
  } catch (error) {
    if (error instanceof InvalidUrlError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  // Checked before the limit so re-adding an existing site reads as a
  // duplicate rather than a billing problem.
  const [existing] = await db
    .select({ id: websites.id })
    .from(websites)
    .where(
      and(
        eq(websites.organizationId, orgId),
        eq(websites.domain, normalized.domain),
      ),
    )
    .limit(1);

  if (existing) {
    return { ok: false, error: "That website is already in this workspace" };
  }

  try {
    await requireWithinLimit(orgId, "websites");
  } catch (error) {
    if (error instanceof LimitExceededError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  const [created] = await db
    .insert(websites)
    .values({
      organizationId: orgId,
      url: normalized.url,
      domain: normalized.domain,
      status: "pending",
    })
    .returning({ id: websites.id });

  /**
   * Analysis runs in the background: fetching a homepage and calling a model
   * takes seconds to tens of seconds, which is far too long to hold a form
   * submission open. The row is already visible as "pending".
   */
  await inngest.send({
    name: "website/analyze.requested",
    data: { websiteId: created.id, organizationId: orgId },
  });

  revalidatePath("/websites");
  return { ok: true, data: { id: created.id } };
}

/**
 * Fields a user may correct after automatic extraction fills them in.
 *
 * The client's requirement is explicit: every auto-filled field must be
 * editable, because extraction will not always be right. Listing them here
 * rather than accepting a partial row keeps organizationId, status and id out
 * of reach of a crafted request.
 */
export type WebsiteDetailsInput = {
  brandName?: string | null;
  industry?: string | null;
  country?: string | null;
  language?: string | null;
  description?: string | null;
  targetAudience?: string | null;
};

function clean(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function updateWebsiteDetails(
  websiteId: string,
  input: WebsiteDetailsInput,
): Promise<ActionResult<null>> {
  // Throws WebsiteNotFoundError for another tenant's id, so no extra check.
  const { site } = await requireWebsite(websiteId);

  await db
    .update(websites)
    .set({
      brandName: clean(input.brandName),
      industry: clean(input.industry),
      country: clean(input.country),
      /**
       * Normalised so "spanish", "Español" and "es" all store "Spanish". The
       * stored string goes straight into the article prompt, and an unrecognised
       * spelling silently produces an English article. Falls back to the raw
       * value rather than null so an unusual but valid language is not discarded.
       */
      language: normalizeLanguage(input.language ?? null) ?? clean(input.language),
      description: clean(input.description),
      targetAudience: clean(input.targetAudience),
      updatedAt: new Date(),
    })
    .where(eq(websites.id, site.id));

  revalidatePath("/websites");
  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}

/**
 * Replaces the services list.
 *
 * Separate from updateWebsiteDetails because it is a jsonb array rather than a
 * text column, and because the profile screen edits it on its own — sending
 * every scalar field along with a services edit would let a stale form
 * overwrite a correction the customer made a moment earlier.
 */
export async function updateWebsiteServices(
  websiteId: string,
  services: string[],
): Promise<ActionResult<null>> {
  const { site } = await requireWebsite(websiteId);

  // Trimmed, blanks dropped, de-duplicated case-insensitively: the UI adds a
  // row per keystroke-completed entry and it is easy to submit the same
  // service twice with different capitalisation.
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of services) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(value);
  }

  await db
    .update(websites)
    .set({ services: cleaned, updatedAt: new Date() })
    .where(eq(websites.id, site.id));

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}

/**
 * Adds a competitor the customer named themselves.
 *
 * source "manual" distinguishes these from the ones analysis suggested, so a
 * re-run cannot quietly delete a rival the customer added by hand.
 */
export async function addCompetitor(
  websiteId: string,
  rawDomain: string,
): Promise<ActionResult<null>> {
  const { site } = await requireWebsite(websiteId);

  let domain: string;
  try {
    // Accepts "example.com", "https://example.com/path" and everything
    // between, storing just the host.
    domain = normalizeWebsiteUrl(rawDomain).domain;
  } catch (error) {
    if (error instanceof InvalidUrlError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  if (domain === site.domain) {
    return { ok: false, error: "That is your own website." };
  }

  await db
    .insert(competitors)
    .values({ websiteId: site.id, domain, source: "manual" })
    // The unique index makes re-adding a no-op rather than a duplicate.
    .onConflictDoNothing();

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}

/** Removes a competitor, whether we suggested it or the customer added it. */
export async function removeCompetitor(
  websiteId: string,
  domain: string,
): Promise<ActionResult<null>> {
  const { site } = await requireWebsite(websiteId);

  await db
    .delete(competitors)
    .where(
      and(eq(competitors.websiteId, site.id), eq(competitors.domain, domain)),
    );

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}

/**
 * Re-runs analysis for a website whose last attempt failed or stalled.
 *
 * Without this a transient failure (the site was down, a model call errored)
 * leaves the row permanently on "Analysis failed" and the only way forward is
 * to delete and re-add it — which also throws away anything already attached.
 */
export async function reanalyzeWebsite(
  websiteId: string,
): Promise<ActionResult<null>> {
  const { site, orgId } = await requireWebsite(websiteId);

  await db
    .update(websites)
    .set({ status: "pending", updatedAt: new Date() })
    .where(eq(websites.id, site.id));

  await inngest.send({
    name: "website/analyze.requested",
    data: { websiteId: site.id, organizationId: orgId },
  });

  revalidatePath("/websites");
  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}

export async function deleteWebsite(
  websiteId: string,
): Promise<ActionResult<null>> {
  const { site } = await requireWebsite(websiteId);

  // Pages, keywords, articles and the rest cascade via their foreign keys.
  await db.delete(websites).where(eq(websites.id, site.id));

  revalidatePath("/websites");
  return { ok: true, data: null };
}
