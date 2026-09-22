import { requireWebsite } from "@/lib/tenant";
import {
  listAvailableProviders,
  listIntegrations,
} from "@/lib/publishing/actions";
import { getIntegrationKeys } from "@/lib/plugin/actions";
import { getBrandVoice } from "@/lib/brand/actions";
import { BrandVoiceForm } from "../brand-voice-form";
import { GenerationPanel } from "../generation-panel";
import { PublishingPanel } from "../publishing-panel";
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
  const [providers, integrations, pluginKeys, voice] = await Promise.all([
    listAvailableProviders(),
    listIntegrations(site.id),
    getIntegrationKeys(site.id),
    getBrandVoice(site.id),
  ]);

  return (
    <div className="space-y-6">
      {/*
        The settings above the connections, because they decide what happens
        to every article and the connections are how it happens.
      */}
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

      <PublishingPanel
        websiteId={site.id}
        providers={providers}
        integrations={integrations}
        pluginKeys={pluginKeys}
      />
    </div>
  );
}
