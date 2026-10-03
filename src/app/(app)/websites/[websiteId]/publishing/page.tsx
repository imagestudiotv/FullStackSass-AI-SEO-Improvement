import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { cache } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/workspace/notice";
import { SaveBarSpacer } from "@/components/workspace/save-bar";
import { inManagedNetwork } from "@/lib/articles/review";
import { requireWebsitePlan } from "@/lib/billing/require-plan";
import { getBrandVoice } from "@/lib/brand/actions";
import { db } from "@/lib/db";
import { integrationKeys } from "@/lib/db/schema";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { listIntegrations } from "@/lib/publishing/actions";
import { finishedModeOf } from "@/lib/publishing/policy";
import { requireWebsitePage } from "@/lib/tenant";

import { ArticleSettingsForm } from "../article-settings-form";
import { GenerationPanel } from "../generation-panel";
import { ArticleSettingsSectionNav } from "./settings-section-nav";

export const dynamic = "force-dynamic";

/** The locale lookup, once per request for the title and the page. */
const messagesFor = cache((userId: string) => getAppMessages(userId));

export async function generateMetadata({
  params,
}: PageProps<"/websites/[websiteId]/publishing">): Promise<Metadata> {
  const { websiteId } = await params;
  // requireWebsite is request-cached, so this is the page's own guard, not a second one.
  const { userId } = await requireWebsitePage(websiteId);
  const { t } = await messagesFor(userId);
  return { title: t.app.article.pageTitle };
}

/**
 * Arrays are edited as one-per-line text, so they are joined for the form and
 * split again by the save action.
 */
const NEWLINE = String.fromCharCode(10);

/**
 * Article Settings: sections A-G in one page, with a section rail on wide
 * screens and the same links as a scrolling row on narrow ones.
 *
 * A-F (ArticleSettingsForm) are kept by the one Save bar; G (GenerationPanel)
 * saves each change immediately, as it always has. Each section says which.
 */
export default async function WebsitePublishingPage({
  params,
}: PageProps<"/websites/[websiteId]/publishing">) {
  const { websiteId } = await params;
  const ctx = await requireWebsitePage(websiteId);
  const { site, userId, access } = ctx;
  const { t } = await messagesFor(userId);

  // Paywall. See lib/billing/require-plan.ts. An owner gets requirePlan on
  // the workspace that pays for this site, exactly as before. A guest is
  // judged on this website alone and, if its owner's plan has lapsed, is
  // sent to the dashboard to be told so - never into the owner's checkout.
  await requireWebsitePlan(ctx);

  /*
    Only what this tab renders. Each query is bounded: the brand voice row
    and the plugin key are limit(1), the managed-network check is one row,
    and integrations is this website's connections.
  */
  const [integrations, voice, plugin, managedNetwork] = await Promise.all([
    listIntegrations(site.id),
    getBrandVoice(site.id),
    // A WordPress plugin that has checked in is a connection too; it keeps
    // no integrations row, so it is looked up on its own.
    db
      .select({ id: integrationKeys.id })
      .from(integrationKeys)
      .where(
        and(
          eq(integrationKeys.websiteId, site.id),
          isNull(integrationKeys.revokedAt),
          isNotNull(integrationKeys.lastUsedAt),
        ),
      )
      .limit(1),
    // Whether every article is held for the RepGet team's review, which the
    // first-article note has to mention (and must not mention otherwise).
    inManagedNetwork(site.id),
  ]);

  // Viewers see every setting, read-only; the save actions refuse them anyway.
  const canEdit = access !== "viewer";

  return (
    <>
      <PageHeader title={t.app.article.pageTitle} description={t.app.article.pageDescription} />

      {canEdit ? null : <Notice>{t.app.workspace.viewOnly}</Notice>}

      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
        <aside className="hidden lg:block">
          <ArticleSettingsSectionNav
            variant="rail"
            t={t.app.article}
            tCommon={t.app.common}
            tWorkspace={t.app.workspace}
          />
        </aside>

        <div className="min-w-0 space-y-6">
          <ArticleSettingsSectionNav
            variant="bar"
            className="lg:hidden"
            t={t.app.article}
            tCommon={t.app.common}
            tWorkspace={t.app.workspace}
          />

          <ArticleSettingsForm
            websiteId={site.id}
            /*
              Whether these settings have ever been saved. Drives the "keep
              the defaults" confirm bar, which exists so a customer who
              changes nothing can still close the checklist step.
            */
            reviewed={site.articleSettingsReviewedAt !== null}
            canEdit={canEdit}
            initial={{
              articleStyle: site.articleStyle,
              internalLinkTarget: site.internalLinkTarget,
              targetWordCount: site.targetWordCount,

              /*
                Null columns become empty strings for the form. A controlled
                input given null warns and then behaves as uncontrolled, and
                the save action turns "" back into null on the way out.
              */
              sitemapUrl: site.sitemapUrl ?? "",
              blogUrl: site.blogUrl ?? "",
              exampleArticleUrl: site.exampleArticleUrl ?? "",

              brandColor: site.brandColor ?? "",
              imageStyle: site.imageStyle,
              featuredImageStyle: site.featuredImageStyle,
              imageBrief: site.imageBrief ?? "",
              imageInstructions: site.imageInstructions ?? "",

              tableOfContents: site.tableOfContents,
              youtubeVideo: site.youtubeVideo,
              authorPerspective: site.authorPerspective,
              mentionSimilarProducts: site.mentionSimilarProducts,
              comparisonTable: site.comparisonTable,
              poweredByLink: site.poweredByLink,

              authorName: site.authorName ?? "",
              authorBio: site.authorBio ?? "",

              /*
                Brand voice, from its own table. Arrays become newline-
                separated text because that is how the customer edits them;
                the save action splits them back. Social links and example
                article URLs are not on this screen and are not sent, so the
                save keeps them (lib/brand/actions.ts).
              */
              tone: voice.tone ?? "",
              vocabulary: voice.vocabulary ?? "",
              avoid: voice.avoid ?? "",
              usps: voice.usps.join(NEWLINE),
              facts: voice.facts.join(NEWLINE),
              articleInstructions: voice.articleInstructions ?? "",
            }}
            t={t.app.article}
            tCommon={t.app.common}
            tWorkspace={t.app.workspace}
          />

          <GenerationPanel
            websiteId={site.id}
            mode={site.generationMode === "manual" ? "manual" : "automatic"}
            days={
              Array.isArray(site.publishingDays)
                ? (site.publishingDays as unknown[]).filter((d): d is number => Number.isInteger(d))
                : []
            }
            finishedMode={finishedModeOf(site)}
            hasIntegration={
              integrations.some((i) => i.status === "connected") ||
              plugin.length > 0
            }
            canEdit={canEdit}
            firstArticleSent={site.firstArticleSentAt !== null}
            inPartnerNetwork={managedNetwork}
            t={t.app.common}
            tArticle={t.app.article}
            tWorkspace={t.app.workspace}
          />

          {/*
            Room at the end so the fixed save bar never covers the last
            section - a little more on phones, where the bar's words and
            buttons stack and it is taller.
          */}
          {canEdit ? (
            <>
              <SaveBarSpacer />
              <div aria-hidden="true" className="h-8 sm:hidden" />
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
