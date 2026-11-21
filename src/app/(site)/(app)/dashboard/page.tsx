import { CirclePause, ListChecks, Plus, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { NextActions } from "@/components/dashboard/next-actions";
import { CheckoutPending } from "@/app/(site)/(onboarding)/onboarding/plan/checkout-pending";
import { PayPalReturn } from "@/components/paypal-return";

import { AchievementsSection } from "@/components/dashboard/achievements";
import {
  AuthorityCard,
  BestArticlesCard,
  SearchPanels,
  TodaysArticleCard,
  WinsCard,
} from "@/components/dashboard/overview-cards";
import { PendingInvitations } from "@/components/dashboard/pending-invitations";
import { RememberWebsite } from "@/components/dashboard/remember-website";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DailyClaimBanner } from "@/components/dashboard/daily-claim-banner";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireSession } from "@/lib/auth-guard";
import { readCheckoutReturn } from "@/lib/billing/return-to";
import { arrivedFromGrowthPlan, waitsForPayment } from "@/lib/dashboard/checkout-wait";
import { resolveDashboard } from "@/lib/dashboard/gate";
import { getDashboardOverview } from "@/lib/dashboard/overview";
import { format } from "@/lib/i18n/format";
import { getAppMessages } from "@/lib/i18n/app-locale";
import type { Locale } from "@/lib/i18n/config";
import { TASKS_COPY } from "@/lib/i18n/tasks";
import { getOnboardingState } from "@/lib/onboarding/steps";
import { requireOrg } from "@/lib/tenant";
import { listAccessibleWebsites } from "@/lib/websites/accessible";
import { readSelectedWebsite, resolveWebsiteId } from "@/lib/websites/selected";

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
 *
 * WHICH SITE, AND WHETHER TO SHOW ONE AT ALL, is decided by resolveDashboard
 * (lib/dashboard/gate.ts), not here. The page used to ask "has MY workspace
 * paid, has it finished onboarding" first, and an invited editor's own
 * workspace is always empty - so every invitee was sent to "add your website"
 * while the site they were invited to sat out of reach. The gate asks those
 * questions only about a site the caller owns; a shared site is shown with
 * the role it was shared with, and never the owner's setup or checkout.
 */
export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const session = await requireSession();

  /*
    ?site= is a REQUEST, not an authority. The gate picks from the sites this
    person can open and falls back silently when the id is not one of them -
    another tenant's, a deleted site, a typo - so the answer never confirms
    that an id exists. Whatever it picks is then loaded through the tenant
    guard (requireWebsitePage), whose ownerOrgId is the one used below.
  */
  const params = await searchParams;
  const requested = typeof params.site === "string" ? params.site : null;

  /*
    Back from paying in the growth plan (lib/billing/return-to.ts): the
    webhook may not have landed yet, and the gate's paywall would send
    someone who has just paid to the plan screen. Until the website has its
    plan, the waiting screen - which refreshes until it does - instead. Read
    for the caller's own workspace only; it grants nothing (checkout-wait.ts).
  */
  const back = readCheckoutReturn(params);
  if (back?.outcome === "success" && requested) {
    const { orgId } = await requireOrg();
    if (waitsForPayment(back, requested, await getOnboardingState(orgId, requested))) {
      const { t } = await getAppMessages(session.user.id);
      return (
        <PageShell>
          {/* Back from PayPal: the subscription is read back from PayPal, so a late webhook does not keep them waiting. */}
          {back.provider === "paypal" ? <PayPalReturn outcome="success" websiteId={requested} /> : null}
          <CheckoutPending websiteId={requested} t={t.app.onboarding} />
        </PageShell>
      );
    }
  }

  // May redirect: to the plan screen or onboarding, for the caller's OWN site.
  const gate = await resolveDashboard(requested);
  const { t, locale } = await getAppMessages(session.user.id);
  const d = t.app.dashboard;

  /*
    Nothing to show and nothing waiting - the gate returns "invitations"
    before this whenever an invitation is. Rare: see DashboardGate.
  */
  if (gate.kind === "empty") {
    return (
      <PageShell>
        <EmptyState
          title={d.noWebsite}
          description={d.noWebsiteHelp}
          action={
            <Button asChild>
              <Link href="/websites/new">
                <Plus className="size-4" />
                {d.addWebsite}
              </Link>
            </Button>
          }
        />
      </PageShell>
    );
  }

  /*
    Invitations waiting for this person's verified address ride along on
    every other kind of dashboard: someone with sites of their own can still
    be invited to somebody else's. Only the wording the cards use is sent to
    the client, and only the fields a card shows.
  */
  const inviteText = {
    invitesTitle: d.invitesTitle,
    inviteBody: d.inviteBody,
    inviteBodyNoName: d.inviteBodyNoName,
    roleAnEditor: d.roleAnEditor,
    roleAViewer: d.roleAViewer,
    acceptInvite: d.acceptInvite,
    inviteAccepted: d.inviteAccepted,
  };
  const inviteCards = gate.invitations.map(
    ({ id, domain, role, invitedByName }) => ({
      id,
      domain,
      role,
      invitedByName,
    }),
  );

  /*
    No website shared with them and none of their own (or only an unpaid
    one), but invitations are waiting: the invitations ARE the page. This is
    the person who signed up from an invitation email and lost the link on
    the way; "add your website" would bury the one thing they came for.
  */
  if (gate.kind === "invitations") {
    return (
      <PageShell>
        {/*
          "Add website" stays one click away for someone who also has a site
          of their own. /websites/new is the additional-site entry into setup
          (?next=1), so it does not bounce them back here.
        */}
        <PageHeader
          title={d.invitesTitle}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href="/websites/new">
                <Plus className="size-4" />
                {d.addWebsite}
              </Link>
            </Button>
          }
        />
        <PendingInvitations
          invitations={inviteCards}
          t={inviteText}
          showHeading={false}
        />
      </PageShell>
    );
  }

  const { ctx } = gate;

  /*
    The shell around this page - switcher, sidebar sections, Add-ons, credits,
    the setup panel - is drawn by the layout from the remembered-site cookie,
    and a layout cannot read ?site=. When the shell is on a different site
    from the one on screen, RememberWebsite brings it into line from the
    client.

    Only when one side or the other is a SHARED site, which is when the shell
    would describe the wrong person's site:
     - a shared site on screen under another selection: a lapsed shared
       site's pages redirecting here with ?site= before the sidebar could
       record it, or an invitee whose own site is unpaid being shown the
       shared one;
     - an owner's own site on screen under a shell still set to a shared one
       (after accepting an invitation, or visiting it): their own dashboard
       would sit under "Editor", without their credits, add-ons or setup
       panel.
    Never when both are the caller's own: an owner with several sites keeps
    the selection they made, exactly as before.

    The shell's site is worked out by the layout's own rule - resolveWebsiteId
    over the same request-cached list - so this cannot disagree with what the
    layout actually shows.
  */
  const accessible = await listAccessibleWebsites();
  const shellId = resolveWebsiteId(
    null,
    await readSelectedWebsite(),
    accessible.map((site) => site.id),
  );
  const shellShared = accessible.some(
    (site) => site.id === shellId && site.access !== "owner",
  );
  /*
    Also when the owner has just started this website from the growth plan
    (paid, or Free): the dashboard opens on it, so the shell follows, even
    when it was on another site of their own.
  */
  const welcome = ctx.access === "owner" && ctx.site.id === requested && arrivedFromGrowthPlan(back, params.welcome);
  const remember =
    shellId !== ctx.site.id && (ctx.access !== "owner" || shellShared || welcome) ? (
      <RememberWebsite websiteId={ctx.site.id} />
    ) : null;

  /*
    "Shared with you · Editor" on a website someone else owns. Without it an
    invitee sees a dashboard indistinguishable from an owner's and has no way
    to tell why billing and setup are missing. The chip says the access the
    tenant guard GRANTED (ctx.access), not what any list claimed.
  */
  const sharedBadge =
    ctx.access === "owner" ? null : (
      <Badge variant="secondary">
        <Users aria-hidden="true" />
        {format(d.sharedBadge, {
          role:
            ctx.access === "viewer"
              ? t.app.dash.roleViewer
              : t.app.dash.roleEditor,
        })}
      </Badge>
    );

  /*
    A SHARED website whose owner's plan is not active. Only a guest reaches
    this kind (an owner's unpaid site was sent to the plan screen by the
    gate), so it offers nothing to buy and names no other site: the guest
    cannot pay for it and has no business seeing the owner's checkout. It
    names who can fix it instead. No "Open website" either - the site's own
    pages send a guest straight back here while the plan is inactive.
  */
  if (gate.kind === "inactive") {
    return (
      <PageShell>
        {remember}
        <PageHeader
          title={d.overview}
          description={format(d.performing, { domain: ctx.site.domain })}
          actions={sharedBadge}
        />
        <PendingInvitations invitations={inviteCards} t={inviteText} />
        <EmptyState
          icon={CirclePause}
          title={d.ownerPlanInactive}
          description={format(d.ownerPlanInactiveHelp, {
            domain: ctx.site.domain,
          })}
        />
      </PageShell>
    );
  }

  /*
    THE OWNER'S WORKSPACE, from the tenant guard - never the caller's own
    workspace and never anything from the list. For an owner the two are the
    same; for a guest they differ, and the figures (links given, credits)
    belong to the workspace that owns the site.

    Credits only for the owner: they belong to the paying workspace, and a
    guest would otherwise be shown a balance, and offered a top-up, for money
    that is not theirs. The overview also carries that as ownerView, which the
    cards use to hide every purchase link.
  */
  const range = typeof params.range === "string" ? params.range : null;
  const overview = await getDashboardOverview({
    websiteId: ctx.site.id,
    ownerOrgId: ctx.ownerOrgId,
    showCredits: ctx.access === "owner",
    range,
  });

  if (!overview) {
    return (
      <PageShell>
        {remember}
        <PendingInvitations invitations={inviteCards} t={inviteText} />
        <EmptyState title={d.couldNotLoad} description={d.couldNotLoadHelp} />
      </PageShell>
    );
  }

  const r = t.app.reports;
  const metric = (["value", "articles", "backlinks", "impressions", "clicks", "sessions"] as const).find((m) => m === params.metric) ?? "value";
  const view = params.view === "details" ? "details" : "chart";

  return (
    <PageShell width="wide">
      {remember}
      {/*
        Which site these numbers describe. Every figure below belongs to one
        website, and without the domain on the page a customer with several
        sites has to remember what the switcher is set to.
      */}
      <PageHeader
        title={d.overview}
        description={format(d.performing, {
          domain: overview.domain,
        })}
        actions={
          <>
            {sharedBadge}
            <Button asChild variant="outline" size="sm">
              <Link href={`/websites/${overview.websiteId}`}>
                {d.openWebsite}
              </Link>
            </Button>
          </>
        }
      />

      <PendingInvitations invitations={inviteCards} t={inviteText} />

      {/* PayPal's return, settled for this website (renders nothing); the webhook would record it too. */}
      {back?.provider === "paypal" && ctx.access === "owner" && ctx.site.id === requested ? (
        <PayPalReturn outcome={back.outcome} websiteId={ctx.site.id} />
      ) : null}

      {/*
        Just started from the growth plan: the onboarding steps it skips
        (Connect Google, AI visibility, the content plan...) are on Tasks.
      */}
      {welcome ? growthPlanWelcome(ctx.site.id, overview.domain, locale) : null}

      {ctx.access === "owner" ? <DailyClaimBanner locale={locale} /> : null}

      {/* The AI chat moved to its own page, Growth Copilot (client, 2026-11-02). */}
      <Suspense fallback={<div className="h-28 animate-pulse rounded-xl border bg-card" aria-hidden="true" />}>
        <NextActions websiteId={ctx.site.id} ownerOrgId={ctx.ownerOrgId} canManage={ctx.access === "owner"} locale={locale} />
      </Suspense>

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

/**
 * The note on a website just started from the growth plan (Daniel,
 * 2026-11-21): paying there lands here rather than in the onboarding steps
 * after the plan, and those steps wait on Tasks (lib/tasks/tasks.ts
 * ONBOARDING_STEP_TASKS). Shown while the address says so (?checkout=success,
 * ?paypal=success or ?welcome=1); the sidebar's Dashboard link drops it.
 * Drawn inline (not as a component) so the page's tree carries its link.
 */
function growthPlanWelcome(websiteId: string, domain: string, locale: Locale) {
  const w = TASKS_COPY[locale].welcome;
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <ListChecks className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h2 className="font-semibold">{format(w.title, { domain })}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{w.body}</p>
        </div>
      </div>
      <Button asChild className="shrink-0">
        <Link href={`/tasks?site=${encodeURIComponent(websiteId)}`}>{w.cta}</Link>
      </Button>
    </section>
  );
}
