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
  firstWebsiteId,
}: {
  organizationId: string;
  /** Where the article link points; per-website, so null hides it. */
  firstWebsiteId: string | null;
}) {
  const [articles, credits] = await Promise.all([
    checkLimit(organizationId, "articles").catch(() => null),
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

      {articleLabel ? (
        <Link
          href={
            firstWebsiteId ? `/websites/${firstWebsiteId}/content` : "/websites"
          }
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-accent-foreground"
        >
          <PenLine className="size-3.5 shrink-0" aria-hidden="true" />
          {articleLabel}
        </Link>
      ) : null}

      {credits ? (
        <Link
          href={
            firstWebsiteId
              ? `/websites/${firstWebsiteId}/backlinks`
              : "/websites"
          }
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-accent-foreground"
        >
          <Link2 className="size-3.5 shrink-0" aria-hidden="true" />
          {credits.available} backlink credits
        </Link>
      ) : null}
    </div>
  );
}
