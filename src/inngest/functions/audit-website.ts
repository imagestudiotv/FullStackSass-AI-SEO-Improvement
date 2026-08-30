import { eq } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { crawlSite } from "@/lib/audit/crawler";
import { auditPage, auditSite, scoreAudit } from "@/lib/audit/rules";
import { db } from "@/lib/db";
import { audits, crawls, issues, pages, websites } from "@/lib/db/schema";
import { PRICING, track } from "@/lib/usage";

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
    onFailure: async ({ event, error }) => {
      const websiteId = event.data.event.data.websiteId as string;
      await db
        .update(crawls)
        .set({
          status: "failed",
          error: error.message.slice(0, 500),
          finishedAt: new Date(),
        })
        .where(eq(crawls.websiteId, websiteId));
    },
  },
  async ({ event, step }) => {
    const { websiteId, organizationId } = event.data as {
      websiteId: string;
      organizationId: string;
    };

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

      return { crawlId: row.id, url: site.url };
    });

    const crawled = await step.run("crawl-site", async () => {
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
      return { issues: all, summary: scoreAudit(all, crawled.pages.length) };
    });

    const auditId = await step.run("save-audit", async () => {
      const [audit] = await db
        .insert(audits)
        .values({
          websiteId,
          score: findings.summary.score,
          summary: findings.summary,
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

      return audit.id;
    });

    return {
      websiteId,
      auditId,
      score: findings.summary.score,
      pages: crawled.pages.length,
      issues: findings.issues.length,
    };
  },
);
