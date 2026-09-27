import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AchievementsSection } from "@/components/dashboard/achievements";
import {
  AuthorityCard,
  BestArticlesCard,
  SearchPanels,
  TodaysArticleCard,
  WinsCard,
} from "@/components/dashboard/overview-cards";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireSession } from "@/lib/auth-guard";
import { format } from "@/lib/i18n/format";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { getDashboardOverview } from "@/lib/dashboard/overview";
import { getOnboardingState } from "@/lib/onboarding/steps";
import { requireOrg } from "@/lib/tenant";
import { listWebsites } from "@/lib/websites/actions";
import { requirePlan } from "@/lib/billing/require-plan";

export const metadata = { title: "Dashboard" };

// Reads the caller's websites, so it is per-request by definition.
export const dynamic = "force-dynamic";

/**
 * The dashboard.
 *
 * This listed website names and nothing else, which the client fairly called
 * confusing: the platform had been working for weeks and the first screen said
 * nothing about what it had done. It now answers, in order — what authority
 * the site has, what is being written now, what changed this week, what is
 * performing, and what all of it has been worth.
 *
 * One website at a time, chosen in the switcher. Showing every site at once
 * would mean five copies of six panels on a plan with five sites, and no
 * single number on the page would mean anything without first asking which
 * site it belonged to.
 */
export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const session = await requireSession();

  /**
   * A customer who has not finished setting up goes to the guided flow rather
   * than an empty dashboard. Redirected here rather than from sign-up so it
   * also catches someone who left halfway and came back days later.
   */
  const { orgId } = await requireOrg();
  // Paywall. See lib/billing/require-plan.ts.
  await requirePlan(orgId);
  const onboarding = await getOnboardingState(orgId);
  if (!onboarding.websiteId && !onboarding.complete) {
    redirect("/onboarding");
  }

  const websites = await listWebsites();
  const { t, locale } = await getAppMessages(session.user.id);

  if (websites.length === 0) {
    return (
      <PageShell>
        <EmptyState
          title={t.app.dashboard.noWebsite}
          description={t.app.dashboard.noWebsiteHelp}
          action={
            <Button asChild>
              <Link href="/websites/new">
                <Plus className="size-4" />
                {t.app.dashboard.addWebsite}
              </Link>
            </Button>
          }
        />
      </PageShell>
    );
  }

  /**
   * The requested site, falling back to the first. An id from another
   * organization simply does not match, so it falls back too rather than
   * confirming the id exists.
   */
  const params = await searchParams;
  const requested = typeof params.site === "string" ? params.site : null;

  /**
   * Oldest first for the default. listWebsites returns newest first, which
   * would land a returning customer on whichever site they added most
   * recently rather than their main one — and it disagreed with the sidebar,
   * whose article and credit links point at the oldest.
   */
  const ordered = [...websites].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const current =
    ordered.find((site) => site.id === requested) ?? ordered[0];

  /*
    The website's OWNER pays and owns the credits: listWebsites only returns
    this workspace's sites, so its members are owners. Guests never reach a
    website that is not theirs here (an id from elsewhere falls back above).
  */
  const range = typeof params.range === "string" ? params.range : null;
  const overview = await getDashboardOverview({
    websiteId: current.id,
    ownerOrgId: orgId,
    showCredits: true,
    range,
  });

  if (!overview) {
    return (
      <PageShell>
        <EmptyState
          title={t.app.dashboard.couldNotLoad}
          description={t.app.dashboard.couldNotLoadHelp}
        />
      </PageShell>
    );
  }

  const r = t.app.reports;
  const metric = (["value", "articles", "backlinks", "impressions", "clicks", "sessions"] as const).find((m) => m === params.metric) ?? "value";
  const view = params.view === "details" ? "details" : "chart";

  return (
    <PageShell width="wide">
      {/*
        Which site these numbers describe. Every figure below belongs to one
        website, and without the domain on the page a customer with several
        sites has to remember what the switcher is set to.
      */}
      <PageHeader
        title={t.app.dashboard.overview}
        description={format(t.app.dashboard.performing, {
          domain: current.domain,
        })}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/websites/${current.id}`}>
              {t.app.dashboard.openWebsite}
            </Link>
          </Button>
        }
      />

      {/*
        The reference layout: authority and today's article across the top,
        the week's wins and best articles beneath, the achievements across
        the full width, then Google and AI search.
      */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <AuthorityCard overview={overview} t={r} locale={locale} />
        <TodaysArticleCard overview={overview} t={r} locale={locale} />
        <WinsCard overview={overview} t={r} locale={locale} />
        <BestArticlesCard overview={overview} t={r} locale={locale} />
      </div>

      {overview.achievements.ok ? (
        <AchievementsSection
          data={overview.achievements.data}
          websiteId={overview.websiteId}
          initialMetric={metric}
          initialView={view}
          t={r}
          locale={locale}
        />
      ) : (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">{r.sectionUnavailable}</p>
      )}

      <SearchPanels overview={overview} t={r} locale={locale} />
    </PageShell>
  );
}
