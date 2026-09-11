import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { AuthorityPanel } from "@/components/dashboard/authority-panel";
import {
  AchievementsPanel,
  BestArticlesPanel,
  SearchPerformancePanel,
} from "@/components/dashboard/performance-panels";
import { TodaysArticlePanel } from "@/components/dashboard/todays-article";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireSession } from "@/lib/auth-guard";
import { getDashboardOverview } from "@/lib/dashboard/overview";
import { getOnboardingState } from "@/lib/onboarding/steps";
import { requireOrg } from "@/lib/tenant";
import { listWebsites } from "@/lib/websites/actions";

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
  await requireSession();

  /**
   * A customer who has not finished setting up goes to the guided flow rather
   * than an empty dashboard. Redirected here rather than from sign-up so it
   * also catches someone who left halfway and came back days later.
   */
  const { orgId } = await requireOrg();
  const onboarding = await getOnboardingState(orgId);
  if (!onboarding.websiteId && !onboarding.complete) {
    redirect("/onboarding");
  }

  const websites = await listWebsites();

  if (websites.length === 0) {
    return (
      <PageShell>
        <EmptyState
          title="No website connected yet"
          description="Add your website and we will start finding the search terms your customers actually use."
          action={
            <Button asChild>
              <Link href="/websites/new">
                <Plus className="size-4" />
                Add website
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

  const overview = await getDashboardOverview(orgId, current.id);

  if (!overview) {
    return (
      <PageShell>
        <EmptyState
          title="We could not load this website"
          description="Try again, or pick a different website."
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/*
        Which site these numbers describe. Every figure below belongs to one
        website, and without the domain on the page a customer with several
        sites has to remember what the switcher is set to.
      */}
      <PageHeader
        title="SEO overview"
        description={`How ${current.domain} is performing in search.`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/websites/${current.id}`}>Open website</Link>
          </Button>
        }
      />

      {/*
        Search performance first.

        The page is meant to answer "how is my SEO doing?", and this is the
        only panel that answers it directly — clicks, impressions and the
        movement in both. It sat third, below the credit balance and the
        in-progress article, so the outcome the customer pays for was the
        last thing they read.
      */}
      <SearchPerformancePanel
        websiteId={overview.websiteId}
        performance={overview.performance}
      />

      {/*
        Then the work: authority and today's article side by side — one is the
        site's standing, the other is what is being written now. The activity
        feed sits under authority because both answer "what has changed
        lately".
      */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <AuthorityPanel
            websiteId={overview.websiteId}
            verifiedBacklinks={overview.authority.verifiedBacklinks}
            availableCredits={overview.authority.availableCredits}
            chart={overview.authority.chart}
          />
          <ActivityFeed items={overview.activity} />
        </div>

        <div className="space-y-4">
          <TodaysArticlePanel
            websiteId={overview.websiteId}
            article={overview.todaysArticle}
          />
          <BestArticlesPanel
            websiteId={overview.websiteId}
            articles={overview.bestArticles}
          />
        </div>
      </div>

      {/*
        Last: what all of it has been worth. A summary of months of work reads
        as a closing statement, not an opening one.
      */}
      <AchievementsPanel achievements={overview.achievements} />
    </PageShell>
  );
}
