import { Gift, Link2, PenLine } from "lucide-react";
import Link from "next/link";

import { getAvailable } from "@/lib/backlinks/credits";
import { checkLimit } from "@/lib/usage";
import { UNLIMITED } from "@/lib/usage-shared";

/**
 * What the plan allows, at the bottom of the sidebar.
 *
 * The brief asks for an articles-per-month figure linking to the content plan
 * and a backlink-credits figure linking to the exchange. Both are the numbers
 * a customer checks most often — "how much have I got left" — and both used to
 * require opening Billing to find.
 *
 * Server component: it reads the org's subscription and ledger, and neither
 * belongs in a client bundle.
 */
export async function SidebarUsage({
  organizationId,
  websiteId,
}: {
  organizationId: string;
  /**
   * The website currently selected.
   *
   * Articles are allowed per website now, so there is no single figure for an
   * account with several sites — the sidebar reports the one the customer is
   * looking at. Credits stay account-wide: they are bought by the person and
   * spent on whichever site they choose.
   */
  websiteId: string | null;
}) {
  const [articles, credits] = await Promise.all([
    websiteId
      ? checkLimit(websiteId, "articles").catch(() => null)
      : Promise.resolve(null),
    getAvailable(organizationId).catch(() => null),
  ]);

  const articleLabel =
    articles === null
      ? null
      : articles.limit === UNLIMITED
        ? "Unlimited articles"
        : `${Math.max(articles.limit - articles.used, 0)} of ${articles.limit} articles left`;

  return (
    <div className="mt-4 space-y-1 border-t px-3 pt-3">
      <Link
        href="/billing"
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/60"
      >
        <Gift className="size-4 shrink-0 text-primary" aria-hidden="true" />
        Referral program
      </Link>

      {/*
        Both figures on one line, divided.
        
        They were stacked as two rows, which spent two lines of a sidebar on
        two short numbers that answer the same question — what is left. Side
        by side they read as one allowance strip, and the divider only appears
        when there is something on each side of it.

        Each half still links where it did: articles to the content plan,
        credits to the exchange. min-w-0 with truncate on both, so a long
        figure shortens its own half instead of pushing the other out of the
        sidebar.
      */}
      {articleLabel || credits ? (
        <div className="flex items-center px-3 py-1.5 text-xs text-muted-foreground">
          {articleLabel ? (
            <Link
              href={websiteId ? `/websites/${websiteId}/content` : "/websites"}
              title={articleLabel}
              className="flex min-w-0 items-center gap-1.5 rounded-md transition-colors hover:text-accent-foreground"
            >
              <PenLine className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{articleLabel}</span>
            </Link>
          ) : null}

          {articleLabel && credits ? (
            <span
              className="mx-2 h-3 w-px shrink-0 bg-border"
              role="presentation"
            />
          ) : null}

          {credits ? (
            <Link
              href={
                websiteId ? `/websites/${websiteId}/backlinks` : "/websites"
              }
              title={`${credits.available} backlink credits`}
              className="flex min-w-0 items-center gap-1.5 rounded-md transition-colors hover:text-accent-foreground"
            >
              <Link2 className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {credits.available} backlink credits
              </span>
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
