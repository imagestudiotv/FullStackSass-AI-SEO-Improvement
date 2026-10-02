import { and, desc, eq, sql } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { articles, publishLogs, websites } from "@/lib/db/schema";
import {
  loadCredentialsById,
  resolveIntegration,
} from "@/lib/publishing/credentials";
import { prepareStoredArticle, summarize } from "@/lib/articles/internal-links";
import { prepareForDelivery } from "@/lib/articles/delivery";
import { siteScope } from "@/lib/articles/link-guard";
import { checkReleasable, releaseCheckFor, reviewHash } from "@/lib/articles/review";
import {
  claimDispatch,
  HOLD_MESSAGES,
  latestUncertain,
  settleDispatch,
  type DispatchTrigger,
} from "@/lib/publishing/dispatch";
import { withOwnershipMarker } from "@/lib/publishing/ownership";
import { nextLookupDelayMs, reconcileDirectUncertain } from "@/lib/publishing/reconcile";
import { notify } from "@/lib/notifications/create";
import { markFirstArticleSentAndContinue } from "@/lib/publishing/policy";
import { placementUrlsForArticle, recordArticlePublication } from "@/lib/backlinks/placements";
import { describeArticleScene } from "@/lib/images/scene";
import { safeFetch } from "@/lib/net/safe-fetch";
import {
  generateArticleImage,
  isImageGenerationConfigured,
} from "@/lib/images/generate";
import { ProviderError } from "@/lib/publishing/provider";
import { getProvider } from "@/lib/publishing/registry";

/**
 * Publishes an article to the connected WordPress site.
 *
 * Runs as a job rather than in the request: the customer's site may be slow,
 * and a publish that takes twenty seconds must not block a form. Every attempt
 * writes a publish_logs row, success or failure, so "did it publish?" has a
 * recorded answer rather than depending on someone watching at the time.
 */

export const publishArticleJob = inngest.createFunction(
  {
    id: "publish-article",
    retries: 2,
    triggers: [{ event: "article/publish.requested" }],
    // One publish per article: two concurrent runs would create two posts.
    concurrency: { key: "event.data.articleId", limit: 1 },
    onFailure: async ({ event, error, logger }) => {
      const articleId = event.data.event.data.articleId as string;

      /*
        The terminal record for this publish: every retry is spent and the
        article is not live on the customer's site. Keyed by the same
        `articleId` as the rest of the function.
      */
      logger.error(
        { step: "on-failure", articleId, reason: error.message },
        "Publish failed after all retries - article is not live",
      );

      await db.insert(publishLogs).values({
        articleId,
        status: "failed",
        error: error.message.slice(0, 500),
      });
      await db
        .update(articles)
        .set({ error: error.message.slice(0, 500), updatedAt: new Date() })
        .where(eq(articles.id, articleId));

      /**
       * Worth telling them about even more than a generation failure: the
       * customer believes their article is live on their own website, and it
       * is not.
       */
      const websiteId = event.data.event.data.websiteId as string | undefined;
      await notify({
        organizationId: event.data.event.data.organizationId as string,
        type: "article.failed",
        title: "An article could not be published",
        body: error.message.slice(0, 200),
        href: websiteId
          ? `/websites/${websiteId}/articles/${articleId}`
          : null,
      });
    },
  },
  async ({ event, step, logger }) => {
    const { articleId, websiteId, status, trigger: sentTrigger } = event.data as {
      articleId: string;
      websiteId: string;
      organizationId: string;
      status: "publish" | "draft";
      /** Why it was queued; decides the schedule rule at dispatch. */
      trigger?: DispatchTrigger;
    };
    /*
      Events queued by a build before this field existed carry no trigger,
      and nothing says whether a person pressed Publish or a schedule queued
      them. They get the strict rule ("legacy": automatic, or first-article
      while it is the first article), never a press's - a press held this
      way is pressed again. See DispatchTrigger in lib/publishing/dispatch.ts.
    */
    const trigger: DispatchTrigger = sentTrigger ?? "legacy";

    /**
     * Structured logs, one per step, so the Inngest timeline explains itself.
     *
     * `publish_logs` already records the outcome, but only the outcome: when a
     * publish stalls or lands somewhere unexpected, these lines say which
     * stage it reached and what the customer's CMS did about it. Credentials
     * are never logged — only the provider id and the integration row id.
     */
    logger.info(
      { step: "start", articleId, websiteId, requestedStatus: status },
      "Publish started",
    );

    const prepared = await step.run("load-article", async () => {
      const [article] = await db
        .select()
        .from(articles)
        .where(and(eq(articles.id, articleId), eq(articles.websiteId, websiteId)))
        .limit(1);
      if (!article) throw new Error(`Article ${articleId} not found`);
      if (!article.bodyHtml) throw new Error("Article has no content to publish");

      /*
        THE REVIEW GATE, enforced by the job itself - whatever queued it: the
        scheduled release, the first-article release, connecting a CMS, a
        Publish press or a retry. An article held for the RepGet team, or
        changed since they approved it, is not sent. See lib/articles/review.ts.
      */
      const before = releaseCheckFor(article);
      if (!before.ok) {
        logger.info(
          { step: "load-article", articleId, websiteId, reason: before.reason },
          "Held for the RepGet team's review - not published",
        );
        return { held: before.reason };
      }

      /*
        Links checked before publishing: a draft written before links were
        verified can hold "#" placeholders and invented paths. Confirmed
        defects are fixed in the stored copy (original kept as a version),
        and the repaired copy is what is sent - this step's result is what a
        retry replays, so scheduled and retried publishes send the same
        checked HTML. A link that could not be checked right now stays.
        A failure here never blocks publishing. See lib/articles/internal-links.ts.
      */
      let contentHtml = article.bodyHtml;
      try {
        const checked = await prepareStoredArticle(articleId, websiteId, { budgetMs: 20_000 });
        if (checked) {
          contentHtml = checked.html;
          if (checked.changed) {
            logger.info(
              { step: "load-article", articleId, websiteId, ...summarize(checked.findings) },
              "Broken links fixed before publishing",
            );
          }
        }
      } catch (error) {
        logger.warn(
          {
            step: "load-article",
            articleId,
            websiteId,
            reason: error instanceof Error ? error.message : "unknown",
          },
          "Link check failed - publishing the stored copy as it is",
        );
      }

      /*
        Read again AFTER the link check, and checked again: an edit saved in
        between must not ride out on an earlier approval. What is sent below
        is exactly this row - the one that passed the gate.
      */
      const [current] = await db
        .select()
        .from(articles)
        .where(and(eq(articles.id, articleId), eq(articles.websiteId, websiteId)))
        .limit(1);
      if (!current?.bodyHtml) throw new Error("Article has no content to publish");
      const after = releaseCheckFor(current);
      if (!after.ok) {
        logger.info(
          { step: "load-article", articleId, websiteId, reason: after.reason },
          "Changed during the link check - held for the RepGet team's review",
        );
        return { held: after.reason };
      }

      // Industry lives on the website, and steers the header image prompt.
      const [site] = await db
        .select({
          industry: websites.industry,
          url: websites.url,
          domain: websites.domain,
          poweredByLink: websites.poweredByLink,
        })
        .from(websites)
        .where(eq(websites.id, websiteId))
        .limit(1);

      /*
        What is sent: the checked stored copy, plus the delivery-only changes
        (the "Powered by RepGet" line per the website's setting, responsive
        images, section-link repair). See lib/articles/delivery.ts.
      */
      contentHtml = prepareForDelivery(current.bodyHtml, {
        poweredBy: site?.poweredByLink ?? false,
        siteHosts: site ? siteScope(site).hosts : undefined,
        followUrls: await placementUrlsForArticle(articleId),
      });

      /**
       * IDENTIFIERS ONLY. This step's return value is persisted by Inngest so a
       * retry can resume from it, and it used to carry the decrypted
       * credentials - putting a customer's WordPress application password into
       * durable job state. Each step that talks to the CMS now loads the secret
       * itself from this id. See lib/publishing/credentials.ts.
       */
      const integration = await resolveIntegration(websiteId);
      if (!integration) throw new Error("No publishing integration is connected");

      /**
       * A previous successful publish means this is an UPDATE, not a new post.
       * Without this check, re-publishing an edited article would leave the
       * original live and create a duplicate competing with it — which is the
       * exact SEO problem the product exists to avoid.
       */
      const [previous] = await db
        .select({ remoteId: publishLogs.remoteId })
        .from(publishLogs)
        .where(
          and(
            eq(publishLogs.articleId, articleId),
            eq(publishLogs.status, "published"),
          ),
        )
        .orderBy(desc(publishLogs.createdAt))
        .limit(1);

      /**
       * `isUpdate` is the field to check when a customer reports a duplicate
       * post: it says whether this run decided to update an existing remote
       * post or create a new one, which is the decision that produces two
       * competing URLs when it goes wrong. Credentials are deliberately
       * absent — only the provider name and the integration row id.
       */
      logger.info(
        {
          step: "load-article",
          articleId,
          websiteId,
          integrationId: integration.integrationId,
          providerId: integration.providerId,
          isUpdate: Boolean(previous?.remoteId),
          htmlBytes: contentHtml.length,
          hasSlug: Boolean(current.slug),
          hasExcerpt: Boolean(current.metaDescription),
        },
        "Article and integration loaded",
      );

      return {
        held: null,
        /*
          The exact revision prepared here. The send step claims the dispatch
          only if the article is STILL this revision (lib/publishing/dispatch.ts),
          so nothing prepared from an older revision can go out.
        */
        revisionHash: reviewHash(current),
        integrationId: integration.integrationId,
        providerId: integration.providerId,
        // No `credentials` key, deliberately: see above.
        remoteId: previous?.remoteId ?? null,
        // Used to steer the header image toward the customer's sector.
        industry: site?.industry ?? null,
        // The image saved with the article, published as-is when present.
        image: current.imageUrl
          ? { url: current.imageUrl, alt: current.imageAlt ?? current.title }
          : null,
        post: {
          title: current.title,
          contentHtml,
          slug: current.slug,
          excerpt: current.metaDescription,
          status,
        },
      };
    });

    // Held by the review gate: nothing to publish, and nothing failed.
    if (prepared.held !== null) {
      return { held: prepared.held };
    }

    /**
     * The header image is generated here rather than carried from article
     * generation: image bytes are far too large to hold in a job result, and
     * provider URLs expire within hours. Uploading to the customer's own
     * media library is what makes the image permanent.
     *
     * Entirely optional. No provider, or a failure, publishes the article
     * without an image rather than not publishing it.
     */
    const featuredMedia = await step.run("upload-image", async () => {
      /*
        Not uploaded for a revision that is already held: the dispatch claim
        would refuse it anyway, and a media item nobody sends is litter in
        the customer's library. (Not the gate itself - that is the claim.)
      */
      const now = await checkReleasable(articleId);
      if (!now.ok) return null;
      // Nothing to upload only when there is no saved image AND none can be
      // generated; a saved image needs no provider.
      if (!prepared.image && !isImageGenerationConfigured()) {
        /*
          Not an error: the post goes up either way. Logged because a post
          appearing without its header image looks like a bug from the
          outside, and "no provider is configured" is the answer.
        */
        logger.warn(
          { step: "upload-image", articleId, websiteId },
          "Image generation not configured - publishing without a header image",
        );
        return null;
      }

      const startedAt = Date.now();
      try {
        /*
          The image the article already has - the one generated to match its
          content when it was written, or one the customer chose - rather than
          a new one. This used to generate a second, different picture here,
          so what went live was not what the preview showed, and it was paid
          for twice. Only an article with no image gets one generated now,
          from its content as well.
        */
        let generated: { data: Buffer; contentType: string; alt: string; costUsd: number };
        if (prepared.image) {
          /*
            safeFetch: after a publish this address is whatever the
            customer's CMS reported for the uploaded image, so it is a URL a
            third-party server chose - never fetched without the public-
            address check. See lib/net/safe-fetch.ts.
          */
          const response = await safeFetch(prepared.image.url, {
            signal: AbortSignal.timeout(30_000),
            // Checked while streaming: a CMS-reported URL could serve anything.
            maxBytes: 25 * 1024 * 1024,
            timeoutMs: 30_000,
          });
          if (!response.ok) {
            throw new Error(`Could not load the article image (${response.status})`);
          }
          generated = {
            data: Buffer.from(await response.arrayBuffer()),
            contentType: response.headers.get("content-type") ?? "image/png",
            alt: prepared.image.alt,
            costUsd: 0,
          };
        } else {
          const scene = await describeArticleScene({
            title: prepared.post.title,
            industry: prepared.industry,
            bodyHtml: prepared.post.contentHtml,
          });
          generated = await generateArticleImage(
            prepared.post.title,
            prepared.industry,
            null,
            { scene: scene?.scene, alt: scene?.alt },
          );
        }
        const provider = getProvider(prepared.providerId);
        // Not every CMS takes uploads. Shopify and the webhook adapter both
        // reference an image by URL instead, so publishing continues without
        // one rather than failing on a step that is optional by design.
        if (!provider?.uploadMedia) {
          // Expected for these providers, so info rather than warn — but it
          // does mean an image was generated and paid for, then discarded.
          logger.info(
            {
              step: "upload-image",
              articleId,
              websiteId,
              providerId: prepared.providerId,
              imageBytes: generated.data.length,
            },
            "Provider does not support media upload - publishing without a header image",
          );
          return null;
        }

        /*
          Loaded here, inside the step that sends it, rather than carried in
          from the previous step's persisted result. Re-read on every attempt,
          so a password rotated between a failure and its retry is picked up.
        */
        const integration = await loadCredentialsById(prepared.integrationId);
        if (!integration) {
          logger.warn(
            {
              step: "upload-image",
              articleId,
              websiteId,
              integrationId: prepared.integrationId,
            },
            "Integration is no longer connected - publishing without a header image",
          );
          return null;
        }

        const media = await provider.uploadMedia(integration.credentials, {
          data: generated.data,
          contentType: generated.contentType,
          filename: `${prepared.post.slug ?? "header"}.${
            generated.contentType.includes("jpeg") ? "jpg"
              : generated.contentType.includes("webp") ? "webp" : "png"
          }`,
          alt: generated.alt,
        });

        logger.info(
          {
            step: "upload-image",
            articleId,
            websiteId,
            providerId: prepared.providerId,
            mediaId: media.id,
            imageBytes: generated.data.length,
            costUsd: generated.costUsd,
            durationMs: Date.now() - startedAt,
          },
          "Header image uploaded to the customer's media library",
        );
        return { id: media.id, url: media.url };
      } catch (error) {
        /*
          The swallow is the point of this log. The catch is deliberate — an
          image must not block a publish — but it hides generation failures
          and CMS upload rejections alike behind the same silent `null`.
        */
        logger.warn(
          {
            step: "upload-image",
            articleId,
            websiteId,
            providerId: prepared.providerId,
            reason: error instanceof Error ? error.message : "unknown",
            durationMs: Date.now() - startedAt,
          },
          "Header image failed - publishing without one",
        );
        return null;
      }
    });

    /*
      THE DISPATCH BOUNDARY, at every attempt (lib/publishing/dispatch.ts).

      This step used to send `prepared.post` - HTML read when the job began -
      with no fresh check, so an approval withdrawn or an edit saved during
      the image upload, or between a failed attempt and its retry (earlier
      steps are replayed from cache), still went out. Now each attempt:

        1. reconciles an earlier create whose answer never arrived, so a
           retry updates that post instead of creating a second one;
        2. CLAIMS the dispatch: in one transaction holding the article's row
           lock it re-checks the freeze, the review gate, that the article is
           still exactly the revision prepared, and the schedule rule for why
           it was queued - and records the revision as in flight;
        3. sends THAT locked revision, and records the outcome at once.

      Edits and review changes take the same row lock and are refused while
      a revision is in flight, so nothing can slip between check and send.
    */
    const sendOutcome = await step.run("send-to-cms", async () => {
      const provider = getProvider(prepared.providerId);
      if (!provider) {
        /*
          An integration row naming a provider the registry does not have.
          This throws, but the error alone does not say which provider id was
          stored, which is the one fact needed to fix the row.
        */
        logger.error(
          {
            step: "send-to-cms",
            articleId,
            websiteId,
            providerId: prepared.providerId,
          },
          "No provider registered for this integration - cannot publish",
        );
        throw new Error(
          `No integration named ${prepared.providerId} is available`,
        );
      }

      /*
        The secret is fetched here, in the step that sends the request, and is
        never returned from it. Re-read per attempt so a rotated credential is
        used on a retry rather than the value a previous attempt captured.
      */
      const integration = await loadCredentialsById(prepared.integrationId);
      if (!integration) {
        logger.error(
          {
            step: "send-to-cms",
            articleId,
            websiteId,
            integrationId: prepared.integrationId,
          },
          "Integration is no longer connected - cannot publish",
        );
        throw new Error("The publishing integration is no longer connected");
      }

      /*
        Which remote post this is, read NOW rather than when the job began:
        another attempt may have created it since.
      */
      const [previous] = await db
        .select({ remoteId: publishLogs.remoteId })
        .from(publishLogs)
        .where(and(eq(publishLogs.articleId, articleId), eq(publishLogs.status, "published")))
        .orderBy(desc(publishLogs.createdAt))
        .limit(1);
      let remoteId = previous?.remoteId ?? null;
      /** A post an earlier, unanswered create turned out to have made. */
      let reconciled: { remoteId: string; remoteUrl: string; status: string } | null = null;

      /*
        1. An earlier create got no answer: the post may exist. It is looked
        for by THAT dispatch's own ownership marker, on the integration it
        was sent to (lib/publishing/reconcile.ts) - never by slug, never from
        the article's current fields - and adopted only on proof. Nothing
        found is not proof it does not exist: the send stays held and is
        looked up again later; only a person can declare it not published.
      */
      if (!remoteId) {
        const unknown = await latestUncertain(articleId);
        if (unknown) {
          const outcome = await reconcileDirectUncertain(unknown, provider, prepared.integrationId);
          if (outcome.adopted) {
            remoteId = outcome.remoteId;
            reconciled = outcome;
            logger.info(
              { step: "send-to-cms", articleId, websiteId, dispatchId: unknown.id, remoteId },
              "Earlier send had created the post (found by its marker) - updating it instead of creating another",
            );
          } else {
            await db
              .update(articles)
              .set({ error: HOLD_MESSAGES.uncertain_previous, updatedAt: new Date() })
              .where(eq(articles.id, articleId));
            const delay = outcome.result === "none" || outcome.result === "error" ? nextLookupDelayMs(outcome.attempts) : null;
            if (delay !== null) {
              // Looked up again later: a slow create can land after an empty lookup.
              await inngest.send({
                id: `publish-recheck:${unknown.id}:${outcome.attempts}`,
                name: "article/publish.requested",
                data: { ...event.data, trigger },
                ts: Date.now() + delay,
              });
            }
            logger.warn(
              { step: "send-to-cms", articleId, websiteId, dispatchId: unknown.id, lookup: outcome.result, attempts: outcome.attempts, recheckInMs: delay },
              "Earlier send got no answer and its post is not proven - nothing is created; waiting",
            );
            return { held: "uncertain_previous" as const, sent: null, title: null };
          }
        }
      }

      // 2. The claim.
      const claim = await claimDispatch({
        articleId,
        websiteId,
        channel: "direct",
        trigger,
        // A Publish press's own choice; every other trigger is decided from the settings now.
        requestedStatus: status,
        integrationId: prepared.integrationId,
        expectedRevision: prepared.revisionHash,
        owner: `publish-article:${event.id ?? "run"}`,
        refuseAfterUncertain: !remoteId,
      });
      if (!claim.ok && claim.reason === "already_sent" && reconciled) {
        /*
          The unanswered create DID make the post, and it is this very
          revision: nothing to send. Its delivery was logged when it was
          found; the article is brought up to date below, once.
        */
        const [current] = await db
          .select({ title: articles.title })
          .from(articles)
          .where(eq(articles.id, articleId))
          .limit(1);
        return { held: null, sent: reconciled, title: current?.title ?? "", dispatchId: null as string | null };
      }
      if (!claim.ok) {
        logger.info(
          { step: "send-to-cms", articleId, websiteId, trigger, reason: claim.reason },
          `Not sent: ${HOLD_MESSAGES[claim.reason]}`,
        );
        if (claim.reason === "revision_changed") {
          /*
            Changed while this job prepared it. Nothing stale is sent; a
            fresh job prepares the new revision from the start (links
            checked, footer, image) and claims again under the same rules.
          */
          await inngest.send({
            id: `publish-revision:${articleId}:${Date.now()}`,
            name: "article/publish.requested",
            data: { ...event.data, trigger },
          });
        }
        return { held: claim.reason, sent: null, title: null };
      }

      // 3. Send exactly the claimed revision.
      const [site] = await db
        .select({ url: websites.url, domain: websites.domain, poweredByLink: websites.poweredByLink })
        .from(websites)
        .where(eq(websites.id, websiteId))
        .limit(1);
      const post = {
        title: claim.article.title,
        /*
          The dispatch's ownership marker rides along (an HTML comment): if
          this request's answer is lost, the post is found by it and nothing
          else (lib/publishing/ownership.ts).
        */
        contentHtml: withOwnershipMarker(
          prepareForDelivery(claim.article.bodyHtml, {
            poweredBy: site?.poweredByLink ?? false,
            siteHosts: site ? siteScope(site).hosts : undefined,
            followUrls: await placementUrlsForArticle(articleId),
          }),
          { articleId, websiteId, dispatchId: claim.dispatchId },
        ),
        slug: claim.article.slug,
        excerpt: claim.article.metaDescription,
        // Decided at the claim from the settings now, not when this was queued.
        status: claim.status,
        featuredMediaId: featuredMedia?.id ?? null,
      };

      const startedAt = Date.now();
      try {
        const sent = remoteId
          ? await provider.updatePost(integration.credentials, remoteId, post)
          : await provider.createPost(integration.credentials, post);
        await settleDispatch(claim.dispatchId, { status: "sent", remoteId: sent.remoteId, remoteUrl: sent.remoteUrl, remoteStatus: sent.status });

        /**
         * `returnedStatus` is read back from the CMS rather than assumed: a
         * WordPress site can accept a publish and store it as a draft (an
         * editorial workflow plugin, or a user without publish rights), and
         * the customer is then told their article is live when it is not.
         */
        logger.info(
          {
            step: "send-to-cms",
            articleId,
            websiteId,
            providerId: prepared.providerId,
            operation: remoteId ? "update" : "create",
            remoteId: sent.remoteId,
            requestedStatus: claim.status,
            returnedStatus: sent.status,
            dispatchId: claim.dispatchId,
            durationMs: Date.now() - startedAt,
          },
          "Article sent to the CMS",
        );
        return { held: null, sent, title: claim.article.title, dispatchId: claim.dispatchId as string | null };
      } catch (error) {
        /*
          Did the post get created? A refusal the site answered with a 4xx
          is a clear "no". No answer at all (timeout, connection lost), or a
          5xx on a CREATE, may have created it: recorded as uncertain, and
          the retry reconciles before creating anything. An UPDATE is safe
          to repeat, so its failures are plain failures.
        */
        const httpStatus = error instanceof ProviderError ? error.status : undefined;
        const refused = typeof httpStatus === "number" && httpStatus < 500;
        const uncertain = !remoteId && !refused;
        const message = error instanceof Error ? error.message : "unknown";
        await settleDispatch(claim.dispatchId, { status: uncertain ? "uncertain" : "failed", error: message });

        if (error instanceof ProviderError) {
          /*
            `kind` is what separates bad credentials from a site that is down
            or rejecting the post — three very different fixes that otherwise
            reach the timeline as the same "publish failed".
          */
          logger.error(
            {
              step: "send-to-cms",
              articleId,
              websiteId,
              providerId: prepared.providerId,
              operation: remoteId ? "update" : "create",
              kind: error.kind,
              reason: error.message,
              uncertain,
              durationMs: Date.now() - startedAt,
            },
            "CMS rejected the article",
          );

          // Recorded with the reason so the UI can show something actionable
          // rather than "publish failed".
          await db.insert(publishLogs).values({
            articleId,
            integrationId: prepared.integrationId,
            dispatchId: claim.dispatchId,
            status: "failed",
            error: `${error.kind}: ${error.message}`.slice(0, 500),
          }).onConflictDoNothing();
          throw new Error(error.message);
        }
        throw error;
      }
    });

    // Held at the dispatch boundary: nothing was sent, and nothing failed.
    if (sendOutcome.held !== null || !sendOutcome.sent) {
      return { held: sendOutcome.held };
    }
    const result = sendOutcome.sent;
    const sentTitle = sendOutcome.title ?? "";

    await step.run("record-result", async () => {
      /*
        Keyed by the dispatch: a retried step writes nothing twice. (An
        adopted post was logged under its own dispatch when it was found.)
      */
      if (sendOutcome.dispatchId) {
        await db
          .insert(publishLogs)
          .values({
            articleId,
            integrationId: prepared.integrationId,
            dispatchId: sendOutcome.dispatchId,
            status: "published",
            remoteId: result.remoteId,
            remoteUrl: result.remoteUrl,
            remoteStatus: result.status,
          })
          .onConflictDoNothing();
      }

      const live = result.status === "publish";
      await db
        .update(articles)
        .set({
          // A WordPress draft is not live, so the article is not "published".
          status: live ? "published" : "draft",
          publishedUrl: result.remoteUrl,
          // When it FIRST went live; a republish or a later edit keeps it.
          ...(live ? { firstLiveAt: sql`coalesce(${articles.firstLiveAt}, timezone('utc', now()))` } : {}),
          // The CMS's own URL, which does not expire the way the provider's
          // does. Left untouched when no image was uploaded this run.
          ...(featuredMedia ? { imageUrl: featuredMedia.url } : {}),
          error: null,
          updatedAt: new Date(),
        })
        .where(eq(articles.id, articleId));

      /*
        A backlink carried by this article now has a real URL to be checked
        at. Nothing is charged here: credits move only once the verifier has
        seen the link live (lib/backlinks/placements.ts).
      */
      await recordArticlePublication(
        articleId,
        result.remoteUrl ?? null,
        result.status === "publish" ? "publish" : "draft",
      );

      /*
        The website's first article is out. Record it, so the first-article
        rule never fires again, and - only for the call that recorded it -
        start writing the next two days' articles now rather than at the next
        scheduled run: "the first article published immediately, and then the
        other next-2-day articles". See lib/publishing/policy.ts.
      */
      await markFirstArticleSentAndContinue(websiteId);

      logger.info(
        {
          step: "record-result",
          articleId,
          websiteId,
          remoteId: result.remoteId,
          remoteUrl: result.remoteUrl,
          storedStatus: result.status === "publish" ? "published" : "draft",
          imageUrlUpdated: Boolean(featuredMedia),
          rowsWritten: 1,
        },
        "Publish result recorded",
      );
    });

    await step.run("notify-published", async () => {
      const live = result.status === "publish";
      await notify({
        organizationId: event.data.organizationId as string,
        type: "article.published",
        // A WordPress draft is not live, and saying otherwise would have the
        // customer believing a page exists that nobody can visit.
        title: live
          ? `"${sentTitle}" is live`
          : `"${sentTitle}" was saved as a draft`,
        body: live ? result.remoteUrl : "Publish it from WordPress when ready.",
        href: `/websites/${websiteId}/articles/${articleId}`,
      });
    });

    /**
     * The one line that answers "is this article actually live".
     *
     * `requestedStatus` and `finalStatus` are logged side by side because they
     * can legitimately differ — a CMS may downgrade a publish to a draft — and
     * that gap is exactly what a customer reporting "you said it was live"
     * needs to be visible.
     */
    logger.info(
      {
        step: "done",
        articleId,
        websiteId,
        requestedStatus: status,
        finalStatus: result.status,
        remoteUrl: result.remoteUrl,
        hasImage: Boolean(featuredMedia),
      },
      "Publish complete",
    );

    return { articleId, remoteUrl: result.remoteUrl, status: result.status };
  },
);
