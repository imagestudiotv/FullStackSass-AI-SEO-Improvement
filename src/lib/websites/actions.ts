"use server";

import { and, desc, eq, lt, ne, notInArray, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { isEntitledToSpend } from "@/lib/billing/entitled";
import { db } from "@/lib/db";
import { competitors, networkSites, websiteMembers, websites } from "@/lib/db/schema";
import { NEW_SITE_DEFAULTS, NEW_SITE_NETWORK } from "@/lib/websites/new-site-defaults";
import { settingsForMode, type FinishedMode } from "@/lib/publishing/policy";
import {
  requireOrg,
  requireWebsite,
  WebsiteNotFoundError,
} from "@/lib/tenant";
import { deleteWebsiteAsOwner } from "@/lib/websites/deletion";
import { queueAnalysis } from "@/lib/websites/analysis-quota";
import { requireEditor } from "@/lib/websites/require-editor";
import { writeSelectedWebsite } from "@/lib/websites/selected";
import { InvalidUrlError, normalizeWebsiteUrl } from "@/lib/websites/url";
import { verifyDomain } from "@/lib/websites/verify-domain";
import { normalizeLanguage } from "@/lib/websites/languages";
import { pendingInvitationsFor } from "@/lib/websites/pending-invitations";

/**
 * Website CRUD.
 *
 * Every action starts at requireOrg() or requireWebsite() — never a raw query
 * against websites. A server action is a public HTTP endpoint: the caller
 * chooses the arguments, so the website id can be anything and must be scoped
 * to the caller's organization before it is trusted.
 */

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: string };

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
 */
export async function addWebsite(
  rawUrl: string,
): Promise<ActionResult<{ id: string }>> {
  const { orgId, userId } = await requireOrg();

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

  /**
   * A website somebody SHARED with the caller from another workspace.
   *
   * WHY. An invited editor who cannot find the site they were invited to -
   * routing used to send a guest into onboarding, whose first step is "add
   * your website" - types its address and makes a second copy in their own
   * empty workspace. That copy starts unpaid, walks its creator through the
   * paywall for a site somebody else already pays for, spends a free analysis,
   * and if it is ever paid for it writes a second content plan for the same
   * WordPress. The shared site is already theirs to work on; the answer is to
   * send them to it.
   *
   * ONLY THE CALLER'S OWN GRANTS. Joined on website_members by this user id,
   * so the refusal can only ever describe a site the caller can already open
   * from the switcher. A domain merely present in some stranger's workspace is
   * not refused here - saying so would tell anyone which domains other
   * customers have added.
   *
   * ANOTHER WORKSPACE ONLY (ne organizationId): a site the caller's own
   * workspace owns is the duplicate above, with its own message.
   *
   * WWW-INSENSITIVE ON THE STORED SIDE. normalized.domain is already lowercase
   * with "www." removed, but rows written before that normalisation can carry
   * either spelling; the same expression lib/plugin/connection.ts matches on.
   *
   * The message never names the other workspace: the person who shared it
   * named themselves in the invitation, and the workspace's name is the
   * owner's business.
   */
  const [shared] = await db
    .select({ id: websites.id })
    .from(websiteMembers)
    .innerJoin(websites, eq(websites.id, websiteMembers.websiteId))
    .where(
      and(
        eq(websiteMembers.userId, userId),
        ne(websites.organizationId, orgId),
        sql`regexp_replace(lower(${websites.domain}), '^www\\.', '') = ${normalized.domain}`,
      ),
    )
    .limit(1);

  if (shared) {
    /*
      Points at the Websites page rather than the switcher: this is usually
      read on the add-website form, where there is no switcher, and the
      header hides it on phones. Websites lists it under "Shared with you".
    */
    return {
      ok: false,
      error: "That website is already shared with you. Find it under Websites, in Shared with you.",
    };
  }

  /**
   * The same, for an invitation still WAITING for the caller. Adding the
   * invited domain to their own workspace instead of accepting it made the
   * same unpaid copy, and put its paywall in front of the dashboard where
   * the invitation card is. The dashboard lists the invitation with an
   * Accept button, so that is where this sends them.
   *
   * pendingInvitationsFor answers only for a PROVEN address, so this tells an
   * unverified account nothing it could not already see, and it never
   * describes an invitation addressed to somebody else. Compared the same
   * www-insensitive way as the check above.
   */
  const waiting = (await pendingInvitationsFor(userId)).some(
    (invitation) =>
      invitation.domain.toLowerCase().replace(/^www\./, "") ===
      normalized.domain,
  );
  if (waiting) {
    return {
      ok: false,
      error: "You have an invitation waiting for that website. Accept it on your dashboard.",
    };
  }

  /**
   * No cap on how many websites a workspace may add.
   *
   * Each website carries its own subscription now, so the number of sites is
   * limited by what the customer is willing to pay for rather than by a
   * siteLimit on one plan. A new site starts unsubscribed and cannot generate
   * anything until it has a plan of its own, which is the real gate.
   *
   * Analysis is the exception: it runs on an unpaid site, so it draws on a
   * bounded free allowance, reserved before the row exists so a refusal
   * leaves nothing behind. See lib/websites/analysis-quota.ts.
   */
  /**
   * Analysis runs in the background: fetching a homepage and calling a model
   * takes seconds to tens of seconds, which is far too long to hold a form
   * submission open. The row is visible as "pending" at once.
   *
   * The reservation, the website row and the analysis job commit together
   * (queueAnalysis), so a site can never sit "pending" with no job behind
   * it. A queue outage only delays the analysis.
   */
  const queued = await queueAnalysis(orgId, { entitled: false }, async (tx) => {
    const [created] = await tx
      .insert(websites)
      .values({
        organizationId: orgId,
        url: normalized.url,
        domain: normalized.domain,
        status: "pending",
        // Written here, not as column defaults: see new-site-defaults.ts.
        ...NEW_SITE_DEFAULTS,
      })
      .returning({ id: websites.id });
    /*
      New websites JOIN the managed Partner Network by default (client
      decision, migration 0043), in the same transaction as the website, so
      the two cannot disagree. It is visible and can be switched off on the
      Backlinks screen. Existing websites are not touched. The hosting cap is
      the product's existing default (see joinNetwork); nothing is spent or
      matched by joining - the RepGet team places links (lib/backlinks/managed.ts).
    */
    await tx
      .insert(networkSites)
      .values({ websiteId: created.id, ...NEW_SITE_NETWORK })
      .onConflictDoNothing({ target: networkSites.websiteId });
    return created.id;
  });
  if (!queued.ok) return { ok: false, error: queued.error };

  revalidatePath("/websites");
  return { ok: true, data: { id: queued.websiteId } };
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
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  /**
   * Only the fields actually PASSED are written.
   *
   * This used to set all six columns unconditionally, so a caller sending one
   * field wiped the other five: `clean(undefined)` returns null, and the update
   * happily wrote that null over real data. The full-form editor on the website
   * page always sent every field, so the bug stayed hidden until the setup
   * wizard began saving one card at a time — entering a description there blanked
   * the brand name, industry, market and language a moment after they were set.
   *
   * `undefined` now means "leave alone" and an explicit `null` still means
   * "clear it", which is the distinction the callers need and the reason this
   * cannot simply drop nullish values.
   */
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (input.brandName !== undefined) patch.brandName = clean(input.brandName);
  if (input.industry !== undefined) patch.industry = clean(input.industry);
  if (input.country !== undefined) patch.country = clean(input.country);
  if (input.description !== undefined) {
    patch.description = clean(input.description);
  }
  if (input.targetAudience !== undefined) {
    patch.targetAudience = clean(input.targetAudience);
  }
  if (input.language !== undefined) {
    /**
     * Normalised so "spanish", "Español" and "es" all store "Spanish". The
     * stored string goes straight into the article prompt, and an unrecognised
     * spelling silently produces an English article. Falls back to the raw
     * value rather than null so an unusual but valid language is not discarded.
     */
    patch.language =
      normalizeLanguage(input.language ?? null) ?? clean(input.language);
  }

  // Nothing but the timestamp: no field was supplied, so there is nothing to do.
  if (Object.keys(patch).length === 1) return { ok: true, data: null };

  await db.update(websites).set(patch).where(eq(websites.id, site.id));

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
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

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
 * What happens to an article once it is written: kept for review, sent to the
 * CMS as a draft, or published live on its planned day.
 *
 * One setting stored as the two columns it replaced (auto_publish and
 * publish_as), which were two controls in two cards before - see
 * lib/publishing/policy.ts. Anything but the three known values is refused
 * rather than guessed at.
 */
export async function setFinishedMode(
  websiteId: string,
  mode: FinishedMode,
): Promise<ActionResult<null>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  if (mode !== "review" && mode !== "draft" && mode !== "live") {
    return { ok: false, error: "Unknown publishing choice" };
  }

  await db
    .update(websites)
    .set({ ...settingsForMode(mode), updatedAt: new Date() })
    .where(eq(websites.id, site.id));

  revalidatePath(`/websites/${site.id}/publishing`);
  return { ok: true, data: null };
}

/**
 * Remembers which website the customer is working on.
 *
 * Access is checked before storing: the cookie drives which sections the
 * sidebar shows, and a value pointing at somebody else's website would render
 * eight links that all 404. requireWebsite throws for an id the caller can
 * neither reach through their own workspace nor through a website_members
 * row - so a site shared with them can be selected, and nothing else can.
 */
export async function selectWebsite(
  websiteId: string,
): Promise<ActionResult<null>> {
  /**
   * A website the caller cannot open (neither owned nor shared with them) is
   * REFUSED, not thrown.
   *
   * requireWebsite throws WebsiteNotFoundError, which is right for a page —
   * it becomes a 404. It is wrong here, because sidebar-nav calls this from
   * an effect with an id parsed out of the URL, and an unhandled rejection
   * in a server action does not 404: it takes down the whole route with
   * "Something went wrong on this page".
   *
   * That happens on ordinary paths. Deleting a website while its page is
   * open, following a stale link or bookmark, opening a URL copied from
   * another account, or hitting back after the workspace was reset — the
   * customer sees a crash where the right answer is "that site is gone, use
   * the one you have".
   *
   * Returning an error instead lets the caller carry on. The cookie keeps
   * whatever it had, which is a website they can open, and the shell renders.
   */
  let site;
  try {
    ({ site } = await requireWebsite(websiteId));
  } catch (error) {
    if (error instanceof WebsiteNotFoundError) {
      return { ok: false, error: "That website is not available." };
    }
    throw error;
  }

  await writeSelectedWebsite(site.id);

  // The sidebar is rendered by the layout, so the whole shell re-renders.
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

/**
 * Chooses whether articles are written on a schedule or only on request.
 *
 * "automatic" is what the product is sold as; "manual" is for someone who
 * wants to decide each time. Manual generation keeps working either way — the
 * button never goes away, so choosing automatic adds a behaviour rather than
 * removing one.
 */
export async function setGenerationMode(
  websiteId: string,
  mode: "automatic" | "manual",
  /** Weekdays to write on, 0 = Sunday. Empty means every day. */
  publishingDays?: number[],
): Promise<ActionResult<null>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  // Bounded and de-duplicated: the value comes from a form and ends up
  // driving a scheduled job.
  const days = Array.from(
    new Set(
      (publishingDays ?? []).filter(
        (d) => Number.isInteger(d) && d >= 0 && d <= 6,
      ),
    ),
  ).sort();

  await db
    .update(websites)
    .set({
      generationMode: mode,
      publishingDays: days.length > 0 ? days : null,
      updatedAt: new Date(),
    })
    .where(eq(websites.id, site.id));

  revalidatePath(`/websites/${site.id}/publishing`);
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
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

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

  /**
   * Checked before it is stored, as suggested ones are.
   *
   * A typo — "theknott.com" — otherwise sits in the list looking like a real
   * rival, gets clicked, and shows a browser error. Saying so immediately is
   * the difference between a typo and a broken entry the customer has to work
   * out for themselves later.
   *
   * verifyDomain keeps anything that resolves but refuses our request, so a
   * real site behind Cloudflare is not rejected.
   */
  const check = await verifyDomain(domain);
  if (!check.alive) {
    return {
      ok: false,
      error: `We could not reach ${domain} (${check.reason}). Check the spelling.`,
    };
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
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  await db
    .delete(competitors)
    .where(
      and(eq(competitors.websiteId, site.id), eq(competitors.domain, domain)),
    );

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}

/** An analysis takes well under a minute; one this old is not coming back. */
const STALE_ANALYSIS_MS = 15 * 60 * 1000;

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
  /*
    Guarded like the other writes. The verb list that added these missed
    "reanalyze", and this one queues a crawl of the customer's site - a
    viewer triggering it spends money on somebody else's account.
  */
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;
  // Billed to the website's owner, not an invited editor's own workspace.
  const ownerOrgId = site.organizationId;

  /*
    A paid site draws on its workspace's hourly ceiling; an unpaid one (still
    in onboarding) on the bounded free allowance. See analysis-quota.ts.
  */
  const entitled = await isEntitledToSpend(site.id, { freeArticles: true });

  /*
    Claimed atomically: only a site that is not already being analysed moves
    to "pending", so simultaneous presses queue one crawl, not several. A run
    that died without reaching onFailure stops blocking after STALE_ANALYSIS_MS.
    The claim, the reservation and the job commit together; a press that
    finds it already running backs out of all three.
  */
  const queued = await queueAnalysis(
    ownerOrgId,
    { entitled: entitled.ok, websiteId: site.id },
    async (tx) => {
      const claimed = await tx
        .update(websites)
        .set({ status: "pending", updatedAt: new Date() })
        .where(
          and(
            eq(websites.id, site.id),
            or(
              notInArray(websites.status, ["pending", "crawling"]),
              lt(websites.updatedAt, new Date(Date.now() - STALE_ANALYSIS_MS)),
            ),
          ),
        )
        .returning({ id: websites.id });
      return claimed.length > 0 ? site.id : false;
    },
  );
  if (!queued.ok) {
    return {
      ok: false,
      error: queued.declined ? "This website is already being analysed" : queued.error,
    };
  }

  revalidatePath("/websites");
  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}

/**
 * Deletes a website - owners only, and never while it is still being billed.
 *
 * Not requireEditor: that let an invited editor delete the whole site. See
 * lib/websites/deletion.ts for both rules, which the admin tool shares.
 */
export async function deleteWebsite(
  websiteId: string,
): Promise<ActionResult<null>> {
  let context;
  try {
    context = await requireWebsite(websiteId);
  } catch (error) {
    if (error instanceof WebsiteNotFoundError) {
      return { ok: false, error: "That website is not available." };
    }
    throw error;
  }

  // Pages, keywords, articles and the rest cascade via their foreign keys.
  const result = await deleteWebsiteAsOwner(db, context);
  if (!result.ok) return result;

  revalidatePath("/websites");
  return { ok: true, data: null };
}
