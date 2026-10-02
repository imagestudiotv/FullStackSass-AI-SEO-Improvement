import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireWebsitePlan } from "@/lib/billing/require-plan";
import { format, formatDate } from "@/lib/i18n/format";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { creditActivity, workspaceCredits } from "@/lib/reporting/backlinks";
import { requireWebsitePage } from "@/lib/tenant";
import { cn } from "@/lib/utils";

export const metadata = { title: "Credit activity" };
export const dynamic = "force-dynamic";

/**
 * The workspace's credit ledger. Credits belong to the WORKSPACE - every
 * website in it draws on the same balance - so this page says so and shows
 * the one ledger, not a per-website copy. Only the workspace's own members
 * see it; a guest invited to one website does not see the workspace's money.
 */
export default async function CreditActivityPage({
  params,
  searchParams,
}: PageProps<"/websites/[websiteId]/backlinks/credits">) {
  const { websiteId } = await params;
  const ctx = await requireWebsitePage(websiteId);
  // Paywall: the owner's plan for an owner, this site's plan for a guest.
  // See lib/billing/require-plan.ts.
  await requireWebsitePlan(ctx);
  const { t, locale } = await getAppMessages(ctx.userId);
  const r = t.app.reports;

  if (ctx.access !== "owner") {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{r.creditsTitle}</h1>
        <p className="text-sm text-muted-foreground">{r.creditsOwnerOnly}</p>
      </div>
    );
  }

  const sp = await searchParams;
  const requestedPage = Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10);
  const [credits, activity] = await Promise.all([
    workspaceCredits(ctx.ownerOrgId),
    creditActivity(ctx.ownerOrgId, { page: Number.isFinite(requestedPage) ? requestedPage : 1, pageSize: 25 }),
  ]);
  const base = `/websites/${ctx.site.id}/backlinks/credits`;
  const typeLabel = (type: string, note: string | null, amount: number) =>
    type === "plan_grant" ? r.ledgerPlanGrant
    : type === "link_given" ? r.ledgerLinkGiven
    : type === "link_received" ? r.ledgerLinkReceived
    : type === "refund" ? r.ledgerRefund
    : type === "purchase" ? r.ledgerPurchase
    // A negative referral entry takes a reward back after a refund (lib/referrals/core.ts).
    : type === "referral" ? (amount < 0 ? r.ledgerReferralReversed : r.ledgerReferral)
    : note?.includes("no longer live") ? r.ledgerReversal
    : r.ledgerAdjustment;

  const stats: Array<[string, number, string?]> = [
    [r.creditsAvailable, credits.available],
    [r.creditsReservedLabel, credits.reserved, r.creditsReservedHelp],
    [r.creditsBalance, credits.balance],
    [r.creditsEarnedTotal, credits.earned],
    [r.creditsSpentTotal, credits.spent],
    [r.creditsRefundedTotal, credits.refunded],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{r.creditsTitle}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{r.creditsIntro}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/billing#addons">{r.buyCredits}</Link>
        </Button>
      </div>

      <section aria-labelledby="credit-summary" className="rounded-xl border bg-card p-4">
        <h2 id="credit-summary" className="sr-only">{r.creditsSummary}</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map(([label, value, help]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground" title={help}>{label}</dt>
              <dd className="text-xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">{r.creditsScopeNote}</p>
        <p className="mt-1 text-xs text-muted-foreground">{r.creditsHowItWorks}</p>
      </section>

      <div className="relative overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[40rem] text-sm">
          <caption className="sr-only">{r.creditsTitle}</caption>
          <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">{r.colDate}</th>
              <th scope="col" className="px-3 py-2 text-left font-medium">{r.colEntry}</th>
              <th scope="col" className="px-3 py-2 text-left font-medium">{r.colWebsite}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{r.colCredits}</th>
            </tr>
          </thead>
          <tbody>
            {activity.rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">{r.creditsEmpty}</td>
              </tr>
            ) : null}
            {activity.rows.map((row) => (
              <tr key={row.id} className="border-b last:border-b-0">
                <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                  {formatDate(row.at, locale, { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-medium">{typeLabel(row.type, row.note, row.amount)}</div>
                  {row.note ? <div className="text-xs text-muted-foreground">{row.note}</div> : null}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{row.websiteDomain ?? r.workspaceWide}</td>
                <td className={cn("px-3 py-2.5 text-right font-medium tabular-nums", row.amount > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-foreground")}>
                  {row.amount > 0 ? `+${row.amount}` : row.amount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav aria-label={r.paginationLabel} className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground tabular-nums">{format(r.pageOf, { page: activity.page, pages: activity.pageCount })}</span>
        <div className="flex gap-2">
          {activity.page > 1 ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`${base}?page=${activity.page - 1}`} rel="prev">{r.prev}</Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled>{r.prev}</Button>
          )}
          {activity.page < activity.pageCount ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`${base}?page=${activity.page + 1}`} rel="next">{r.next}</Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled>{r.next}</Button>
          )}
        </div>
      </nav>
    </div>
  );
}
