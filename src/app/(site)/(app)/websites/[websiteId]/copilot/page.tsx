import { Assistant } from "@/components/chat/assistant";
import { requireWebsitePlan } from "@/lib/billing/require-plan";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { requireWebsitePage } from "@/lib/tenant";

export const metadata = { title: "Growth Copilot" };

export const dynamic = "force-dynamic";

/**
 * Growth Copilot, the AI chat, on a page of its own (client, 2026-11-02: "I
 * prefer an independent section for the chat"). It was on the Dashboard,
 * above the task list, where he did not find it.
 */
export default async function WebsiteCopilotPage({ params }: PageProps<"/websites/[websiteId]/copilot">) {
  const { websiteId } = await params;
  const ctx = await requireWebsitePage(websiteId);
  const { locale, t } = await getAppMessages(ctx.userId);
  // Paywall, as on every section (lib/billing/require-plan.ts); trials pass.
  await requireWebsitePlan(ctx);

  return (
    <Assistant
      websiteId={ctx.site.id}
      ownerOrgId={ctx.ownerOrgId}
      userId={ctx.userId}
      canUse={ctx.access !== "viewer"}
      locale={locale}
      creditsCount={t.app.credits.creditsCount}
      standalone
    />
  );
}
