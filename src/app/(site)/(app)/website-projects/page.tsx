import { eq } from "drizzle-orm";
import { Coins, Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";

import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireSession } from "@/lib/auth-guard";
import { topUpForReturn } from "@/lib/credits/quote-topup";
import { walletOf } from "@/lib/credits/spend";
import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { format, formatNumber } from "@/lib/i18n/format";
import { QUOTE_CREDITS_COPY } from "@/lib/i18n/quote-credits";
import { WEBSITE_PROJECT_COPY } from "@/lib/i18n/website-projects";
import { requireOrg } from "@/lib/tenant";
import { hasOnlySharedWork } from "@/lib/websites/accessible";
import { listWebsiteProjects } from "@/lib/website-projects/actions";
import { isWebsiteProjectKind } from "@/lib/website-projects/shared";

import { WebsiteProjectsClient } from "./website-projects-client";

const messagesFor = cache((userId: string) => getAppMessages(userId));

export async function generateMetadata(): Promise<Metadata> {
  const session = await requireSession();
  const { locale } = await messagesFor(session.user.id);
  return { title: WEBSITE_PROJECT_COPY[locale].title };
}

// Statuses and the balance change from elsewhere; never serve a cached view.
export const dynamic = "force-dynamic";

/**
 * "New website" and "Website redesign": ask for a quote, follow it, pay it.
 *
 * DELIBERATELY FREE OF requirePlan, like Billing. The person it exists for may
 * have no website, and so no plan and no reason to be sent to "add your
 * website". It can only do what its own actions do; nothing here unlocks a
 * feature that a plan pays for.
 */
export default async function WebsiteProjectsPage({ searchParams }: PageProps<"/website-projects">) {
  const session = await requireSession();
  const { orgId } = await requireOrg();
  const { locale, t } = await messagesFor(session.user.id);
  const copy = WEBSITE_PROJECT_COPY[locale];

  // Credits are the reader's own workspace's; someone here only for another's website has none to spend.
  if (await hasOnlySharedWork()) {
    return (
      <PageShell>
        <PageHeader title={copy.title} />
        <EmptyState icon={Users} title={t.app.billing.guestTitle} description={t.app.credits.guestOnly} className="bg-card" />
      </PageShell>
    );
  }

  const [projects, wallet, ownSites] = await Promise.all([
    listWebsiteProjects(),
    walletOf(db, orgId),
    db.select({ id: websites.id }).from(websites).where(eq(websites.organizationId, orgId)).limit(1),
  ]);

  const { type, topup } = await searchParams;
  const chosen = isWebsiteProjectKind(type) ? type : null;
  // Back from buying a quote's credits: that top-up, in this workspace only (lib/credits/quote-topup.ts).
  const returned = typeof topup === "string" ? await topUpForReturn(orgId, topup) : null;

  return (
    <PageShell>
      <PageHeader
        title={copy.title}
        description={copy.subtitle}
        actions={
          <div className="rounded-xl border bg-card px-4 py-3 sm:min-w-56">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Coins className="size-3.5" aria-hidden="true" />
              {copy.walletLabel}
            </p>
            <p className="text-2xl font-semibold tabular-nums text-foreground">{formatNumber(wallet.available, locale)}</p>
            {wallet.reserved > 0 ? (
              <p className="text-xs text-muted-foreground">{format(copy.walletReserved, { count: formatNumber(wallet.reserved, locale) })}</p>
            ) : null}
            <Link href="/billing#addons" className="mt-1 inline-block text-xs font-medium text-primary underline underline-offset-2">
              {copy.buyCredits}
            </Link>
          </div>
        }
      />

      <WebsiteProjectsClient
        key={chosen ?? "none"}
        copy={copy}
        locale={locale}
        creditsWord={t.app.credits.creditsCount}
        available={wallet.available}
        projects={projects}
        chosen={chosen}
        defaultName={session.user.name ?? ""}
        defaultEmail={session.user.email}
        returned={returned ? { projectId: returned.websiteProjectId, status: returned.status, credits: returned.credits } : null}
        quoteCopy={QUOTE_CREDITS_COPY[locale]}
      />

      {/* Not a dead end for someone who does have a website, and the way into setup from here. */}
      {ownSites.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-foreground">{copy.addSiteTitle}</p>
          <Button asChild variant="outline" className="shrink-0">
            <Link href="/onboarding/website">
              <Plus className="size-4" aria-hidden="true" />
              {copy.addSiteCta}
            </Link>
          </Button>
        </div>
      ) : null}
    </PageShell>
  );
}
