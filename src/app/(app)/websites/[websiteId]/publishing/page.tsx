import { requireWebsite } from "@/lib/tenant";
import { listIntegrations } from "@/lib/publishing/actions";
import { getBrandVoice } from "@/lib/brand/actions";
import { BrandVoiceForm } from "../brand-voice-form";
import { ArticleSettingsForm } from "../article-settings-form";
import { GenerationPanel } from "../generation-panel";
import { requirePlan } from "@/lib/billing/require-plan";

export const metadata = { title: "Publishing" };

export const dynamic = "force-dynamic";

export default async function WebsitePublishingPage({
  params,
}: PageProps<"/websites/[websiteId]/publishing">) {
  const { websiteId } = await params;
  const { orgId, site } = await requireWebsite(websiteId);

  // Paywall. See lib/billing/require-plan.ts.
  await requirePlan(orgId);
  /*
    Only what this tab renders. The publishing connections moved to
    Integrations, so their three queries moved with them rather than being
    fetched here for a panel that is no longer on the page.
  */
  const [integrations, voice] = await Promise.all([
    listIntegrations(site.id),
    getBrandVoice(site.id),
  ]);

  return (
    <div className="space-y-6">
      {/*
        The settings above the connections, because they decide what happens
        to every article and the connections are how it happens.
      */}
      {/*
        Content & SEO, the first section of the client's Article Settings
        design. It sits above the schedule because it decides what every
        article IS; the panels below decide when and where it goes.
      */}
      <ArticleSettingsForm
        websiteId={site.id}
        initial={{
          publishAs: site.publishAs === "draft" ? "draft" : "live",
          articleStyle: site.articleStyle,
          internalLinkTarget: site.internalLinkTarget,
          targetWordCount: site.targetWordCount,

          /*
            Null columns become empty strings for the form. A controlled
            input given null warns and then behaves as uncontrolled, and the
            save action turns "" back into null on the way out.
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
          poweredByLink: site.poweredByLink,

          authorName: site.authorName ?? "",
          authorBio: site.authorBio ?? "",
        }}
      />

      <GenerationPanel
        websiteId={site.id}
        mode={site.generationMode === "manual" ? "manual" : "automatic"}
        days={
          Array.isArray(site.publishingDays)
            ? (site.publishingDays as number[])
            : []
        }
        autoPublish={site.autoPublish}
        hasIntegration={integrations.some((i) => i.status === "connected")}
      />

      {/*
        "How we write", moved here from the Business tab.

        The client asked for that tab to go — "To delete also how we write
        from this part" — but the form edits real stored data, so it moves
        rather than disappearing. Article Settings is where it belongs
        anyway: tone, vocabulary and the standing instruction decide how
        every article reads, which is the same question the panels above
        answer about when and whether they publish.
      */}
      <BrandVoiceForm websiteId={site.id} voice={voice} />

      {/*
        Room for the fixed save bar, reserved at the END of the page.

        ArticleSettingsForm renders its bar pinned to the viewport, and the
        panels above render after the form in the DOM - so the last thing on
        screen was sitting behind it. The client hit this: "I can't see some
        of part because they are overlapped with save button bar."

        Reserved unconditionally rather than only while the bar is showing,
        because appearing on the first keystroke would shift the whole page
        under the cursor.
      */}
      <div className="h-20" aria-hidden="true" />

    </div>
  );
}
