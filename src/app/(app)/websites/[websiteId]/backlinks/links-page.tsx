import { AuthorityBadge } from "@/components/reports/authority-badge";
import { IssueBanner } from "@/components/reports/issue-banner";
import { LinksView } from "@/components/reports/links-view";
import { readOneAuthority } from "@/lib/authority/metric";
import { requirePlan } from "@/lib/billing/require-plan";
import { format, plural } from "@/lib/i18n/format";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { backlinkIssues, listLinks, parseListQuery, type Direction } from "@/lib/reporting/backlinks";
import { requireWebsitePage } from "@/lib/tenant";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/**
 * The full list of one direction's links, for Earned Backlinks (received)
 * and Hosted links (given). Everything - filters, sort, page - comes from
 * the URL and is applied by the database (lib/reporting/backlinks.ts).
 */
export async function LinksPage({
  direction,
  websiteId,
  searchParams,
}: {
  direction: Direction;
  websiteId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const ctx = await requireWebsitePage(websiteId);
  // Paywall on the OWNER's plan: see lib/billing/require-plan.ts.
  await requirePlan(ctx.ownerOrgId);
  const query = parseListQuery(searchParams);
  const subject = { websiteId: ctx.site.id, orgId: ctx.ownerOrgId };
  const [page, issues, own, { t, locale }] = await Promise.all([
    listLinks(direction, subject, query),
    backlinkIssues(subject),
    readOneAuthority(ctx.site.domain),
    getAppMessages(ctx.userId),
  ]);
  const r = t.app.reports;
  const base = `/websites/${ctx.site.id}/backlinks`;
  const received = direction === "received";
  const issueCount = received ? issues.receivedNotFound : issues.hostedArticlesMissingLink;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{received ? r.earnedTitle : r.hostedTitle}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{received ? r.earnedIntro : r.hostedIntro}</p>
        </div>
        <AuthorityBadge reading={own} t={r} locale={locale} className="shrink-0" />
      </div>

      {issueCount > 0 && query.issue !== "not_found" ? (
        <IssueBanner
          storageKey={`${ctx.site.id}:${direction}:${issues.fingerprint}`}
          title={received ? plural(r.issueReceived, issueCount, { count: issueCount }) : plural(r.issueHosted, issueCount, { count: issueCount })}
          help={received ? r.issueReceivedHelp : r.issueHostedHelp}
          href={`${base}/${received ? "links" : "hosted"}?issue=not_found`}
          actionLabel={r.reviewResolve}
          dismissLabel={r.dismiss}
        />
      ) : null}

      <LinksView
        websiteId={ctx.site.id}
        direction={direction}
        rows={page.rows}
        total={page.total}
        page={page.page}
        pageSize={page.pageSize}
        pageCount={page.pageCount}
        tabCounts={page.tabCounts}
        query={{
          tab: query.tab,
          type: query.type,
          q: query.q,
          from: iso(query.from),
          to: iso(query.to),
          issue: query.issue,
          sort: query.sort,
          dir: query.dir,
        }}
        currency={page.policy && page.policy.backlinkRates.length > 0 ? page.policy.currency : null}
        canEdit={ctx.access !== "viewer"}
        recoverable={received ? 0 : issues.hostedArticlesMissingLink}
        creditsHref={ctx.access === "owner" ? `${base}/credits` : null}
        t={r}
        locale={locale}
      />
      {page.policy && received ? (
        <p className="text-xs text-muted-foreground">
          {format(r.valueFootnote, { version: page.policy.version, currency: page.policy.currency })}
        </p>
      ) : null}
    </div>
  );
}
