import { eq } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { crawlSite } from "@/lib/audit/crawler";
import { detectPlatform, parseCrawlerAccess } from "@/lib/audit/ai-crawlers";
import { fetchRobotsTxt } from "@/lib/audit/robots";
import { auditPage, auditSite, scoreAudit } from "@/lib/audit/rules";
import { db } from "@/lib/db";
import { audits, crawls, issues, pages, websites } from "@/lib/db/schema";
import { PRICING, track } from "@/lib/usage";
import { notify } from "@/lib/notifications/create";

/**
 * Site audit: crawl, apply rules, store the findings.
 *
 * The crawl is the slow part — tens of seconds to minutes — so it runs as a
 * background job with a `crawls` row the UI can poll for progress. Rules and
 * scoring are separate steps so a failure writing results does not re-crawl
 * the customer's site.
 */

/** Pages crawled per audit. Deliberately modest: the issues found on page 200
 *  are almost always the ones already found on page 20. */
const MAX_PAGES = 25;

export const auditWebsite = inngest.createFunction(
  {
    id: "audit-website",
    retries: 2,
    triggers: [{ event: "website/audit.requested" }],
    // One audit per site: concurrent crawls would hammer the customer's server
    // and write competing results.
    concurrency: { key: "event.data.websiteId", limit: 1 },
    onFailure: async ({ event, error, logger }) => {
      const websiteId = event.data.event.data.websiteId as string;

      /*
        The terminal record for this audit: every retry is spent and the crawl
        row is now "failed". Same `websiteId` field as the rest of the
        function so one filter shows the whole run.
      */
      logger.error(
        { step: "on-failure", websiteId, reason: error.message },
        "Audit failed after all retries - crawl marked failed",
      );

      await db
        .update(crawls)
        .set({
          status: "failed",
          error: error.message.slice(0, 500),
          finishedAt: new Date(),
        })
        .where(eq(crawls.websiteId, websiteId));

      await notify({
        organizationId: event.data.event.data.organizationId as string,
        type: "audit.failed",
        title: "A website check could not be completed",
        body: error.message.slice(0, 200),
        href: `/websites/${websiteId}`,
      });
    },
  },
  async ({ event, step, logger }) => {
    const { websiteId, organizationId } = event.data as {
      websiteId: string;
      organizationId: string;
    };

    /**
     * Structured logs, one per step, so the Inngest timeline explains itself.
     *
     * The UI polls the `crawls` row for progress, which says how far the crawl
     * got but nothing about what the rules made of it. These lines carry the
     * counts — pages, failures, issues, score — keyed by `websiteId`, so a
     * thin audit can be traced to the stage that thinned it.
     */
    logger.info({ step: "start", websiteId, organizationId }, "Audit started");

    const crawlRow = await step.run("start-crawl", async () => {
      const [site] = await db
        .select({ id: websites.id, url: websites.url })
        .from(websites)
        .where(eq(websites.id, websiteId))
        .limit(1);
      if (!site) throw new Error(`Website ${websiteId} not found`);

      // Previous crawl rows are removed rather than accumulated: the UI only
      // ever shows the latest, and history lives in `audits`.
      await db.delete(crawls).where(eq(crawls.websiteId, websiteId));

      const [row] = await db
        .insert(crawls)
        .values({ websiteId, status: "running", startedAt: new Date() })
        .returning({ id: crawls.id });

      logger.info(
        { step: "start-crawl", websiteId, crawlId: row.id, url: site.url },
        "Crawl row created, status set to running",
      );
      return { crawlId: row.id, url: site.url };
    });

    const crawled = await step.run("crawl-site", async () => {
      const startedAt = Date.now();
      const result = await crawlSite(crawlRow.url, MAX_PAGES, async (done, found) => {
        await db
          .update(crawls)
          .set({ pagesCrawled: done, pagesFound: found })
          .where(eq(crawls.id, crawlRow.crawlId));
      });

      await track(organizationId, {
        kind: "crawl",
        websiteId,
        quantity: result.pages.length,
        costUsd: result.pages.length * PRICING.crawl.default.perPage,
        metadata: { purpose: "audit", discovered: result.discovered },
      });

      /**
       * The shape of the crawl, not just "ok".
       *
       * A crawl can succeed and still be useless — a site behind a cookie wall
       * or a JS shell yields a handful of thin pages, and the audit built from
       * them is reassuringly empty for reasons nothing downstream explains.
       * durationMs also separates a fast refusal from a crawl that spent its
       * whole budget waiting.
       */
      logger.info(
        {
          step: "crawl-site",
          websiteId,
          crawlId: crawlRow.crawlId,
          url: crawlRow.url,
          pagesCrawled: result.pages.length,
          pagesDiscovered: result.discovered,
          failures: result.failures.length,
          maxPages: MAX_PAGES,
          durationMs: Date.now() - startedAt,
        },
        "Crawl finished",
      );

      /*
        Zero pages is the state that produces an audit with no findings and a
        score computed from nothing. The run still completes, so warn rather
        than error — but it must not pass silently, because the customer sees
        a clean bill of health for a site we never actually read.
      */
      if (result.pages.length === 0) {
        logger.warn(
          {
            step: "crawl-site",
            websiteId,
            crawlId: crawlRow.crawlId,
            url: crawlRow.url,
            failures: result.failures.length,
            reasons: result.failures.slice(0, 8).map((failure) => failure.reason),
          },
          "Crawl returned no pages - the audit will have nothing to score",
        );
      }

      return result;
    });

    await step.run("record-pages", async () => {
      for (const page of crawled.pages) {
        const row = {
          title: page.title,
          metaDescription: page.metaDescription,
          h1: page.h1,
          headings: page.headings,
          wordCount: page.wordCount,
          statusCode: page.statusCode,
          internalLinks: page.internalLinks,
          images: page.images,
          crawledAt: new Date(),
        };
        // Upsert so re-auditing refreshes each page rather than duplicating it.
        await db
          .insert(pages)
          .values({ websiteId, url: page.finalUrl, ...row })
          .onConflictDoUpdate({
            target: [pages.websiteId, pages.url],
            set: row,
          });
      }

      logger.info(
        {
          step: "record-pages",
          websiteId,
          crawlId: crawlRow.crawlId,
          rowsUpserted: crawled.pages.length,
        },
        "Crawled pages recorded",
      );
    });

    const findings = await step.run("apply-rules", async () => {
      const perPage = crawled.pages.flatMap(auditPage);
      const siteWide = auditSite(crawled.pages);

      // A page that could not be fetched at all is a finding in itself.
      const fetchFailures = crawled.failures.map((failure) => ({
        type: "unreachable_page",
        severity: "critical" as const,
        url: failure.url,
        detail: `Could not be fetched (${failure.reason}).`,
      }));

      const all = [...perPage, ...siteWide, ...fetchFailures];
      const summary = scoreAudit(all, crawled.pages.length);

      /**
       * Counts broken out by where the finding came from.
       *
       * A score is a single number that can move for several unrelated
       * reasons; separating per-page rules from site-wide ones and from
       * unreachable pages says which of them moved it.
       */
      logger.info(
        {
          step: "apply-rules",
          websiteId,
          pagesAudited: crawled.pages.length,
          perPageIssues: perPage.length,
          siteWideIssues: siteWide.length,
          unreachablePages: fetchFailures.length,
          totalIssues: all.length,
          critical: summary.counts.critical,
          warning: summary.counts.warning,
          info: summary.counts.info,
          score: summary.score,
        },
        "Audit rules applied",
      );

      return { issues: all, summary };
    });

    /**
     * The context the report shows beside the findings.
     *
     * ALREADY CRAWLED, just never kept. The crawl reads the declared
     * language, the markup fingerprints that name the platform, and the
     * outbound hosts - see PageSnapshot - and the job threw all of it away,
     * so the signed-in report could only ever show a score and a list while
     * the public one at /audit showed the same site's language, platform and
     * AI-crawler access. The client asked for the two to match.
     *
     * robots.txt is the one extra request, and it is the only way to answer
     * "can AI assistants read your site" - a yes/no fact rather than an
     * estimate, invisible from the customer's own site, and completely
     * fixable once seen.
     *
     * A failure here must not fail the audit. The findings are the product;
     * the context is decoration around them, and a site that serves no
     * robots.txt (or serves it slowly) should still get its report.
     */
    const context = await step.run("collect-context", async () => {
      const home = crawled.pages[0] ?? null;

      let robotsTxt: string | null = null;
      try {
        robotsTxt = await fetchRobotsTxt(crawlRow.url);
      } catch (error) {
        logger.warn(
          { step: "collect-context", websiteId, error: String(error) },
          "Could not read robots.txt - AI crawler access will be unknown",
        );
      }

      /*
        Outbound hosts across every page, most-linked first. One page's links
        are noise; a host that appears on several is a real relationship -
        and it is the same signal the public audit shows as "Sites you link
        out to".
      */
      const hostCounts = new Map<string, number>();
      for (const page of crawled.pages) {
        for (const host of page.externalHosts ?? []) {
          hostCounts.set(host, (hostCounts.get(host) ?? 0) + 1);
        }
      }

      return {
        siteName: home?.ogSiteName ?? home?.title ?? null,
        language: home?.lang ?? null,
        // Asset and link URLs carry the fingerprints; visible text does not.
        platform: home
          ? detectPlatform([
              ...(home.platformSignals ?? []),
              ...(home.images ?? []).map((image) => image.src),
              ...(home.internalUrls ?? []),
            ])
          : null,
        crawlers: parseCrawlerAccess(robotsTxt),
        linkedHosts: [...hostCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([host]) => host),
        previewImage: home?.ogImageUrl ?? null,
      };
    });

    const auditId = await step.run("save-audit", async () => {
      const [audit] = await db
        .insert(audits)
        .values({
          websiteId,
          score: findings.summary.score,
          /*
            The context rides in `summary`, which is already a jsonb column,
            rather than in seven new columns. These values are read together
            and only ever shown - nothing filters or joins on them - so a
            column each would be migration cost for no query benefit.
          */
          summary: { ...findings.summary, context },
        })
        .returning({ id: audits.id });

      if (findings.issues.length > 0) {
        // Chunked: a large site can produce thousands of rows, and a single
        // statement with that many parameters exceeds Postgres' limit.
        const CHUNK = 500;
        for (let i = 0; i < findings.issues.length; i += CHUNK) {
          await db.insert(issues).values(
            findings.issues.slice(i, i + CHUNK).map((issue) => ({
              websiteId,
              auditId: audit.id,
              type: issue.type,
              severity: issue.severity,
              url: issue.url,
              detail: issue.detail,
            })),
          );
        }
      }

      await db
        .update(crawls)
        .set({
          status: "completed",
          pagesCrawled: crawled.pages.length,
          pagesFound: crawled.discovered,
          finishedAt: new Date(),
        })
        .where(eq(crawls.id, crawlRow.crawlId));

      logger.info(
        {
          step: "save-audit",
          websiteId,
          crawlId: crawlRow.crawlId,
          auditId: audit.id,
          issueRowsWritten: findings.issues.length,
          score: findings.summary.score,
        },
        "Audit saved, crawl marked completed",
      );

      return audit.id;
    });

    await step.run("notify-ready", async () => {
      const critical = findings.summary.counts.critical;
      await notify({
        organizationId,
        type: "audit.ready",
        title: "Your website check is ready",
        // States what was actually found rather than "complete", so the
        // notification is worth reading on its own.
        body:
          critical > 0
            ? `Score ${findings.summary.score}/100, with ${critical} serious ${critical === 1 ? "problem" : "problems"} to fix.`
            : `Score ${findings.summary.score}/100 across ${crawled.pages.length} ${crawled.pages.length === 1 ? "page" : "pages"}.`,
        href: `/websites/${websiteId}`,
      });
    });

    /**
     * Every count that matters in one record. If the page count is zero or the
     * issue count is implausibly low, the step logs above say which stage
     * lost them.
     */
    logger.info(
      {
        step: "done",
        websiteId,
        auditId,
        score: findings.summary.score,
        pages: crawled.pages.length,
        failedPages: crawled.failures.length,
        issues: findings.issues.length,
        critical: findings.summary.counts.critical,
      },
      "Audit complete",
    );

    return {
      websiteId,
      auditId,
      score: findings.summary.score,
      pages: crawled.pages.length,
      issues: findings.issues.length,
    };
  },
);
