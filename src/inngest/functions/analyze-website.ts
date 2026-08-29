import { eq } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { MODELS } from "@/lib/ai/client";
import { db } from "@/lib/db";
import { competitors, pages, websites } from "@/lib/db/schema";
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
    onFailure: async ({ event }) => {
      // Runs after retries are exhausted, so the row never sticks on
      // "crawling" and the UI can offer a retry.
      const websiteId = event.data.event.data.websiteId as string;
      await db
        .update(websites)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(websites.id, websiteId));
    },
  },
  async ({ event, step }) => {
    const { websiteId, organizationId } = event.data as {
      websiteId: string;
      organizationId: string;
    };

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
      return row;
    });

    const snapshot = await step.run("fetch-homepage", async () => {
      try {
        // Re-validated per redirect hop: an open redirect on the customer's
        // site must not walk us onto a private address.
        return await fetchHomepage(site.url, isPublicWebsiteUrl);
      } catch (error) {
        if (error instanceof CrawlError) {
          // NonRetriableError would be cleaner, but a plain throw with a
          // recorded reason keeps the failure visible in the run history.
          await db
            .update(websites)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(websites.id, websiteId));
          throw new Error(`Crawl failed (${error.kind}): ${error.message}`);
        }
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

      return extracted;
    });

    await step.run("save-profile", async () => {
      await db
        .update(websites)
        .set({
          brandName: profile.brandName,
          industry: profile.industry,
          country: profile.country,
          language: profile.language,
          description: profile.description,
          targetAudience: profile.targetAudience,
          services: profile.services,
          status: "ready",
          updatedAt: new Date(),
        })
        .where(eq(websites.id, websiteId));

      if (profile.competitors.length > 0) {
        await db
          .insert(competitors)
          .values(
            profile.competitors.map((domain) => ({
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
    });

    return { websiteId, status: "ready", profile };
  },
);
