import { eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";

import { inngest } from "@/inngest/client";
import { MODELS } from "@/lib/ai/client";
import { db } from "@/lib/db";
import { competitors, pages, websites } from "@/lib/db/schema";
import { keepLiveDomains } from "@/lib/websites/verify-domain";
import { PRICING, track } from "@/lib/usage";
import { CrawlError, fetchHomepage } from "@/lib/websites/crawl";
import { extractProfile } from "@/lib/websites/extract";
import { isPublicWebsiteUrl } from "@/lib/websites/url";

/**
 * Website onboarding analysis: fetch the homepage, extract a profile, save it.
 *
 * Split into steps because Inngest memoises each one. A failure in extraction
 * replays the function from the top but returns the fetch's stored result
 * instead of re-running it, so a retry does not re-crawl the customer's site
 * or re-bill the model call that already succeeded.
 */

export const analyzeWebsite = inngest.createFunction(
  {
    id: "analyze-website",
    retries: 2,
    triggers: [{ event: "website/analyze.requested" }],
    // One analysis per website at a time; a double-click must not double-spend.
    concurrency: { key: "event.data.websiteId", limit: 1 },
    onFailure: async ({ event, error, logger }) => {
      // Runs after retries are exhausted, so the row never sticks on
      // "crawling" and the UI can offer a retry.
      const websiteId = event.data.event.data.websiteId as string;

      /*
        The terminal record for this website: every retry is spent and the
        row is now "failed". Logged with the same `websiteId` field as the
        rest of the function so one filter shows the whole history.
      */
      logger.error(
        { step: "on-failure", websiteId, reason: error.message },
        "Analysis failed after all retries — website marked failed",
      );

      await db
        .update(websites)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(websites.id, websiteId));
    },
  },
  async ({ event, step, logger }) => {
    const { websiteId, organizationId } = event.data as {
      websiteId: string;
      organizationId: string;
    };

    /**
     * Logged as an OBJECT, not an interpolated string.
     *
     * Inngest indexes the fields of a structured log, so `websiteId` becomes
     * something you can filter a run list by. A template string collapses the
     * same information into prose that can only be eyeballed, which is no use
     * when the question is "what happened to this one site".
     *
     * Every log line in this function carries `step`, so the run timeline
     * reads as a sequence: which stage was reached, and what it produced.
     */
    logger.info({ step: "start", websiteId, organizationId }, "Analysis started");

    const site = await step.run("load-website", async () => {
      const [row] = await db
        .select({ id: websites.id, url: websites.url })
        .from(websites)
        .where(eq(websites.id, websiteId))
        .limit(1);
      if (!row) throw new Error(`Website ${websiteId} not found`);

      await db
        .update(websites)
        .set({ status: "crawling", updatedAt: new Date() })
        .where(eq(websites.id, websiteId));

      logger.info(
        { step: "load-website", websiteId, url: row.url },
        "Website loaded, status set to crawling",
      );
      return row;
    });

    const snapshot = await step.run("fetch-homepage", async () => {
      const startedAt = Date.now();
      try {
        // Re-validated per redirect hop: an open redirect on the customer's
        // site must not walk us onto a private address.
        const page = await fetchHomepage(site.url, isPublicWebsiteUrl);

        /**
         * The shape of what came back, not just "ok".
         *
         * A crawl can succeed and still be useless — a 200 that is a cookie
         * wall or a JS shell returns almost no text, and the profile
         * extracted from it is thin for reasons nothing downstream explains.
         * Recording wordCount and htmlBytes here makes that visible at the
         * point it happens rather than three steps later.
         */
        logger.info(
          {
            step: "fetch-homepage",
            websiteId,
            url: site.url,
            finalUrl: page.finalUrl,
            statusCode: page.statusCode,
            wordCount: page.wordCount,
            htmlBytes: page.htmlBytes,
            internalLinks: page.internalLinks.length,
            durationMs: Date.now() - startedAt,
          },
          "Homepage fetched",
        );
        return page;
      } catch (error) {
        if (error instanceof CrawlError) {
          /**
           * The KIND of failure, as its own field.
           *
           * This is the line that would have answered the imagestudio.com
           * outage in seconds instead of days: the run history showed only
           * "The site returned 403" with no indication of whether the site
           * was down, blocking us, or unreachable — and the site loaded fine
           * in every browser. `kind` separates those cases, and durationMs
           * distinguishes an instant refusal from a timeout.
           */
          logger.error(
            {
              step: "fetch-homepage",
              websiteId,
              url: site.url,
              kind: error.kind,
              reason: error.message,
              durationMs: Date.now() - startedAt,
            },
            "Crawl failed",
          );

          await db
            .update(websites)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(websites.id, websiteId));

          /**
           * A REFUSAL IS PERMANENT. DO NOT RETRY IT.
           *
           * 401/403/451 are the site deciding not to serve us, and sites run
           * by enterprise bot management — DataDome, Akamai, Cloudflare Bot
           * Management — refuse every automated client on principle:
           * hermes.com and rolex.com answer 403 to a real Chrome user-agent
           * from a residential IP, not just to us. Trying twice more changes
           * nothing except the delay before the customer is told, and each
           * attempt bills another crawl.
           *
           * Everything else still retries. A timeout, a refused connection
           * or a 5xx is a site having a moment, and those genuinely do come
           * back on the second attempt.
           */
          const message = `Crawl failed (${error.kind}): ${error.message}`;
          throw error.status === 401 ||
            error.status === 403 ||
            error.status === 451
            ? new NonRetriableError(message)
            : new Error(message);
        }

        logger.error(
          {
            step: "fetch-homepage",
            websiteId,
            url: site.url,
            err: error,
            durationMs: Date.now() - startedAt,
          },
          "Crawl failed with an unexpected error",
        );
        throw error;
      }
    });

    await step.run("record-page", async () => {
      const pageRow = {
        title: snapshot.title,
        metaDescription: snapshot.metaDescription,
        h1: snapshot.h1,
        headings: snapshot.headings,
        wordCount: snapshot.wordCount,
        statusCode: snapshot.statusCode,
        internalLinks: snapshot.internalLinks,
        crawledAt: new Date(),
      };

      // Upsert: re-analysing a site must refresh the snapshot for that URL,
      // not append a second row that later page counts would double-count.
      await db
        .insert(pages)
        .values({ websiteId, url: snapshot.finalUrl, ...pageRow })
        .onConflictDoUpdate({
          target: [pages.websiteId, pages.url],
          set: pageRow,
        });

      await track(organizationId, {
        kind: "crawl",
        websiteId,
        quantity: 1,
        costUsd: PRICING.crawl.default.perPage,
        metadata: { url: snapshot.finalUrl, status: snapshot.statusCode },
      });
    });

    const profile = await step.run("extract-profile", async () => {
      const extracted = await extractProfile(snapshot);

      /**
       * Cost is recorded from the model's own token counts rather than an
       * estimate, so per-tenant unit economics stay real as prompts change.
       * Token counts are not returned by extractProfile, so this is an
       * approximation of the input size until it surfaces usage.
       */
      const price = PRICING.llm[MODELS.EXTRACTION];
      const approxInputK = snapshot.text.length / 4 / 1000;
      await track(organizationId, {
        kind: "llm",
        websiteId,
        provider: "anthropic",
        model: MODELS.EXTRACTION,
        quantity: 1,
        costUsd: approxInputK * price.inputPer1k + 0.5 * price.outputPer1k,
        metadata: { purpose: "onboarding_extraction" },
      });

      /**
       * Which fields the model actually filled, rather than the values.
       *
       * The profile can contain a customer's business description, so the
       * content stays out of the logs; what matters operationally is whether
       * extraction produced a usable profile at all. An empty brandName or
       * industry here is what later starves keyword research, so this is the
       * step where that becomes visible.
       */
      logger.info(
        {
          step: "extract-profile",
          websiteId,
          brandName: extracted.brandName ?? null,
          industry: extracted.industry ?? null,
          country: extracted.country ?? null,
          language: extracted.language ?? null,
          services: extracted.services?.length ?? 0,
          competitorsSuggested: extracted.competitors?.length ?? 0,
          hasDescription: Boolean(extracted.description),
          model: MODELS.EXTRACTION,
        },
        "Profile extracted",
      );

      return extracted;
    });

    await step.run("save-profile", async () => {
      /**
       * A language the customer set by hand wins over detection.
       *
       * Detection reads whichever version of the site was served, which is not
       * always the one they write for — a business may run an English site
       * while wanting Spanish articles for a Spanish market. Overwriting their
       * choice on every re-analysis would silently switch their content back,
       * and they would have no idea why.
       *
       * Every other field is refreshed: those are descriptions of the site as
       * it is now, where newer detection is genuinely better.
       */
      const [current] = await db
        .select({ language: websites.language })
        .from(websites)
        .where(eq(websites.id, websiteId))
        .limit(1);

      await db
        .update(websites)
        .set({
          brandName: profile.brandName,
          industry: profile.industry,
          country: profile.country,
          language: current?.language ?? profile.language,
          description: profile.description,
          targetAudience: profile.targetAudience,
          services: profile.services,
          status: "ready",
          updatedAt: new Date(),
        })
        .where(eq(websites.id, websiteId));

      /**
       * Only competitors that actually exist are stored.
       *
       * This is the one extracted field the model is allowed to infer, and it
       * duly invents plausible domains: in a real account 7 of 20 suggestions
       * did not resolve, four with no DNS record at all. Presenting those as
       * "your competitors" is a claim about someone's market that we made up,
       * and keyword research reads this list — so an imaginary rival would
       * quietly shape real articles.
       */
      const checked = await keepLiveDomains(profile.competitors);
      if (checked.dropped.length > 0) {
        /*
          logger, not console: console output is not attached to the run, so
          this warning was invisible in the Inngest timeline that explains the
          rest of the analysis.
        */
        logger.warn(
          {
            step: "save-profile",
            websiteId,
            droppedCount: checked.dropped.length,
            keptCount: checked.live.length,
            dropped: checked.dropped.map((d) => ({
              domain: d.domain,
              reason: d.reason,
            })),
          },
          "Dropped unreachable competitor domains",
        );
      }

      if (checked.live.length > 0) {
        await db
          .insert(competitors)
          .values(
            checked.live.map((domain) => ({
              websiteId,
              domain,
              source: "ai_suggested",
            })),
          )
          // Needs an explicit target: without one there is no constraint to
          // match and every re-run inserts the same rivals again.
          .onConflictDoNothing({
            target: [competitors.websiteId, competitors.domain],
          });
      }

      logger.info(
        {
          step: "save-profile",
          websiteId,
          competitorsStored: checked.live.length,
          languageKeptFromUser: Boolean(current?.language),
        },
        "Profile saved, status set to ready",
      );
    });

    logger.info(
      { step: "done", websiteId, status: "ready" },
      "Analysis complete",
    );
    return { websiteId, status: "ready", profile };
  },
);
