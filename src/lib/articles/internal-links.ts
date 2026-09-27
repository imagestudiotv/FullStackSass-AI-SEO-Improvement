import { and, desc, eq, inArray, sql } from "drizzle-orm";

import {
  guardLinks,
  internalLinkKeys,
  siteScope,
  type LinkFinding,
  type LinkTarget,
  type LinkVerdict,
} from "@/lib/articles/link-guard";
import { findVerifiedTargets, pageTitle } from "@/lib/articles/link-inventory";
import { reviewHash } from "@/lib/articles/review";
import { ArticleInFlightError, lockForEdit } from "@/lib/publishing/dispatch";
import { cachedPages, verifyUrls, type VerifyOptions } from "@/lib/articles/link-verify";
import { db } from "@/lib/db";
import { articles, articleVersions, publishLogs, websites } from "@/lib/db/schema";

/**
 * Internal links, end to end.
 *
 * Three entry points, one rule - a link to the customer's site is only ever
 * written to a page verified to exist there:
 *
 *  - linkGeneratedArticle: straight after the writer. Removes any link it
 *    made up, then adds up to the website's internalLinkTarget links to
 *    verified, relevant pages. Nothing verifiable, nothing added.
 *  - prepareStoredArticle: at every publication boundary (the WordPress
 *    plugin's pull, direct CMS publishing, scheduled and retried publishes),
 *    so drafts written before this fix are repaired before they go out.
 *    Confirmed defects are fixed; links that could not be checked right now
 *    are kept and reported. The original is kept as a version.
 *  - auditArticleLinks: a dry run for one website's selected articles.
 *    Writes nothing.
 *
 * See link-guard.ts for the per-link rules, link-verify.ts for what counts as
 * a page existing, and link-inventory.ts for where candidates come from.
 */

type Site = { id: string; url: string; domain: string; sitemapUrl: string | null };

async function loadSite(websiteId: string): Promise<Site | null> {
  const [site] = await db
    .select({ id: websites.id, url: websites.url, domain: websites.domain, sitemapUrl: websites.sitemapUrl })
    .from(websites)
    .where(eq(websites.id, websiteId))
    .limit(1);
  return site ?? null;
}

/** Verified pages already known for this site: replacements that cost no request. */
async function knownTargets(websiteId: string): Promise<LinkTarget[]> {
  return (await cachedPages(websiteId))
    .filter((verdict) => verdict.isHtml)
    .map((verdict) => ({
      url: verdict.finalUrl ?? verdict.url,
      title: pageTitle(verdict.title) ?? "",
      score: 0,
    }))
    .filter((target) => target.title);
}

const count = (findings: LinkFinding[], outcome: LinkFinding["outcome"]) =>
  findings.filter((finding) => finding.outcome === outcome).length;

/** Counts only - never URLs or text, which are the customer's content. */
export function summarize(findings: LinkFinding[], inserted = 0) {
  return {
    kept: count(findings, "kept"),
    rewritten: count(findings, "rewritten"),
    replaced: count(findings, "replaced"),
    unwrapped: count(findings, "unwrapped"),
    trimmed: count(findings, "trimmed"),
    unverified: count(findings, "unverified"),
    inserted,
  };
}

/* ------------------------------------------------------------------------ */
/* New articles                                                             */
/* ------------------------------------------------------------------------ */

export type GeneratedLinkInput = {
  websiteId: string;
  /** The article being written, when it already has a public address (a rewrite). */
  articleId?: string | null;
  title: string;
  targetKeyword: string | null;
  html: string;
  /** The website's internalLinkTarget: a maximum for automatic links, 0 for none. */
  internalLinkTarget: number;
  /** A matched backlink the article must keep, whatever it is. */
  backlinkUrl?: string | null;
};

export async function linkGeneratedArticle(
  input: GeneratedLinkInput,
  options: VerifyOptions = {},
): Promise<{ html: string; inserted: LinkTarget[]; findings: LinkFinding[] }> {
  const site = await loadSite(input.websiteId);
  if (!site) throw new Error(`Website ${input.websiteId} not found`);
  const scope = siteScope(site);

  let articleUrl: string | null = null;
  if (input.articleId) {
    const [row] = await db
      .select({ publishedUrl: articles.publishedUrl })
      .from(articles)
      .where(and(eq(articles.id, input.articleId), eq(articles.websiteId, input.websiteId)))
      .limit(1);
    articleUrl = row?.publishedUrl ?? null;
  }

  const limit = Math.max(0, Math.floor(input.internalLinkTarget || 0));
  const keys = internalLinkKeys(input.html, scope, articleUrl);
  const budgetMs = options.budgetMs ?? 20_000;
  const started = Date.now();
  const verdicts = keys.length > 0 ? await verifyUrls(site.id, keys, scope, { ...options, budgetMs }) : new Map<string, LinkVerdict>();

  const remaining = Math.max(2_000, budgetMs - (Date.now() - started));
  // With a limit of 0 every internal link is removed anyway: nothing to look up.
  const targets =
    limit > 0
      ? await findVerifiedTargets(
          {
            websiteId: site.id,
            scope,
            sitemapUrl: site.sitemapUrl,
            subject: `${input.title} ${input.targetKeyword ?? ""}`,
            excludeUrls: articleUrl ? [articleUrl] : [],
            limit,
          },
          { ...options, budgetMs: remaining },
        )
      : [];

  const result = guardLinks(input.html, {
    scope,
    mode: "generated",
    verdicts,
    articleUrl,
    targets,
    maxAutoLinks: limit,
    protectedHrefs: input.backlinkUrl ? [input.backlinkUrl] : [],
  });
  return { html: result.html, inserted: result.inserted, findings: result.findings };
}

/**
 * The same rules with no network at all: every internal link the writer
 * made is unverified, so it goes; placeholders and dead section links go.
 * Used when checking itself failed, so a failure can only ever remove an
 * unproven link, never publish one.
 */
export function stripUnverifiedLinks(
  html: string,
  site: { url: string; domain: string },
  backlinkUrl?: string | null,
): string {
  return guardLinks(html, {
    scope: siteScope(site),
    mode: "generated",
    verdicts: new Map(),
    maxAutoLinks: 0,
    protectedHrefs: backlinkUrl ? [backlinkUrl] : [],
  }).html;
}

/* ------------------------------------------------------------------------ */
/* Stored articles, at publication                                          */
/* ------------------------------------------------------------------------ */

export type PreparedArticle = {
  /** The HTML to deliver: repaired when a confirmed defect was found. */
  html: string;
  changed: boolean;
  findings: LinkFinding[];
};

/**
 * Checks a stored article's links before it is published, fixes confirmed
 * defects in the stored copy, and returns exactly what was stored.
 *
 * - The original is saved as a version first, so nothing is lost.
 * - The update only lands if the body is still the one that was checked:
 *   an edit saved in between wins, and that newer body is checked instead.
 * - A link that could not be verified right now is KEPT (and reported):
 *   stored content may be hand-edited, and a timeout proves nothing.
 * - Nothing is added here; automatic links are chosen when an article is
 *   written, not at publication.
 */
export async function prepareStoredArticle(
  articleId: string,
  websiteId: string,
  options: VerifyOptions = {},
): Promise<PreparedArticle | null> {
  const site = await loadSite(websiteId);
  if (!site) return null;
  const scope = siteScope(site);
  const targets = await knownTargets(websiteId);

  for (let attempt = 0; attempt < 3; attempt++) {
    const [article] = await db
      .select({
        bodyHtml: articles.bodyHtml,
        publishedUrl: articles.publishedUrl,
        title: articles.title,
        slug: articles.slug,
        metaDescription: articles.metaDescription,
        imageUrl: articles.imageUrl,
        imageAlt: articles.imageAlt,
        reviewStatus: articles.reviewStatus,
        reviewApprovedHash: articles.reviewApprovedHash,
      })
      .from(articles)
      .where(and(eq(articles.id, articleId), eq(articles.websiteId, websiteId)))
      .limit(1);
    if (!article?.bodyHtml) return null;
    const original = article.bodyHtml;

    const keys = internalLinkKeys(original, scope, article.publishedUrl);
    const verdicts = keys.length > 0 ? await verifyUrls(websiteId, keys, scope, options) : new Map<string, LinkVerdict>();
    const result = guardLinks(original, {
      scope,
      mode: "existing",
      verdicts,
      articleUrl: article.publishedUrl,
      targets,
    });
    if (!result.changed) return { html: original, changed: false, findings: result.findings };

    /*
      An APPROVED article (lib/articles/review.ts) that is still exactly what
      was approved: a repair that only removes or re-points broken links
      keeps the approval, re-hashed to the repaired text. A repair that puts
      a DIFFERENT page in (a replacement) withdraws it - an administrator
      looks again before anything with new content goes out.
    */
    const approvedAndCurrent =
      article.reviewStatus === "approved" && article.reviewApprovedHash === reviewHash(article);
    const substituted = result.findings.some((finding) => finding.outcome === "replaced");
    const review =
      approvedAndCurrent && !substituted
        ? { reviewApprovedHash: reviewHash({ ...article, bodyHtml: result.html }) }
        : approvedAndCurrent
          ? {
              reviewStatus: "pending",
              reviewApprovedAt: null,
              reviewApprovedBy: null,
              reviewApprovedHash: null,
              reviewVersion: sql`${articles.reviewVersion} + 1`,
            }
          : {};

    /*
      Under the article's row lock like every edit; while a revision of it is
      being sent (lib/publishing/dispatch.ts) the repair waits for the next
      delivery rather than changing what is in flight.
    */
    const saved = await db.transaction(async (tx) => {
      try {
        await lockForEdit(tx, articleId);
      } catch (error) {
        if (error instanceof ArticleInFlightError) return false;
        throw error;
      }
      const updated = await tx
        .update(articles)
        .set({ bodyHtml: result.html, updatedAt: new Date(), ...review })
        .where(and(eq(articles.id, articleId), eq(articles.bodyHtml, original)))
        .returning({ id: articles.id });
      if (updated.length === 0) return false;
      // The pre-repair body, as the editor keeps every earlier body.
      await tx.insert(articleVersions).values({ articleId, bodyHtml: original });
      return true;
    });
    if (saved) return { html: result.html, changed: true, findings: result.findings };
    // Edited while we checked: check the newer body instead.
  }

  const [latest] = await db
    .select({ bodyHtml: articles.bodyHtml })
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.websiteId, websiteId)))
    .limit(1);
  return latest?.bodyHtml ? { html: latest.bodyHtml, changed: false, findings: [] } : null;
}

/* ------------------------------------------------------------------------ */
/* Dry-run audit                                                            */
/* ------------------------------------------------------------------------ */

export type AuditRow = {
  articleId: string;
  title: string;
  status: string;
  /** The WordPress (or other CMS) post id, when a publish recorded one. */
  remotePostId: string | null;
  publicUrl: string | null;
  findings: LinkFinding[];
  /** What the stored body would become. Nothing is written. */
  wouldChange: boolean;
};

/**
 * Reports what prepareStoredArticle would do to each selected article, and
 * does none of it: no article, version or cache row is written. The network
 * checks are real (read-only GETs of the customer's own pages).
 */
export async function auditArticleLinks(
  websiteId: string,
  articleIds: string[],
  options: VerifyOptions = {},
): Promise<AuditRow[]> {
  const site = await loadSite(websiteId);
  if (!site) throw new Error(`Website ${websiteId} not found`);
  if (articleIds.length === 0) return [];
  const scope = siteScope(site);
  const targets = await knownTargets(websiteId);

  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      status: articles.status,
      bodyHtml: articles.bodyHtml,
      publishedUrl: articles.publishedUrl,
    })
    .from(articles)
    // Scoped to the website: an article id from elsewhere finds nothing.
    .where(and(eq(articles.websiteId, websiteId), inArray(articles.id, articleIds)));

  const out: AuditRow[] = [];
  for (const row of rows) {
    const [log] = await db
      .select({ remoteId: publishLogs.remoteId, remoteUrl: publishLogs.remoteUrl })
      .from(publishLogs)
      .where(and(eq(publishLogs.articleId, row.id), eq(publishLogs.status, "published")))
      .orderBy(desc(publishLogs.createdAt))
      .limit(1);

    const html = row.bodyHtml ?? "";
    const keys = internalLinkKeys(html, scope, row.publishedUrl);
    const verdicts = keys.length > 0
      ? await verifyUrls(websiteId, keys, scope, { ...options, writeCache: false })
      : new Map<string, LinkVerdict>();
    const result = guardLinks(html, {
      scope,
      mode: "existing",
      verdicts,
      articleUrl: row.publishedUrl,
      targets,
    });
    out.push({
      articleId: row.id,
      title: row.title,
      status: row.status,
      remotePostId: log?.remoteId ?? null,
      publicUrl: row.publishedUrl ?? log?.remoteUrl ?? null,
      findings: result.findings.filter((finding) => finding.outcome !== "kept"),
      wouldChange: result.changed,
    });
  }
  return out;
}
