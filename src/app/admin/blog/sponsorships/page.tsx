import { ExternalLink, Mail, Newspaper } from "lucide-react";
import Link from "next/link";

import { listPlacements, type PlacementView } from "@/lib/admin/blog-sponsorships";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import { AdminPage, AdminPageHeader } from "../../_ui/page";
import { AdminEmpty } from "../../_ui/states";
import { AdminStatus, type StatusTone } from "../../_ui/status";
import { PlacementActions } from "./placement-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Featured placements" };

const when = (date: Date) =>
  `${formatDate(date, "en", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;

const VIEWS: { value: PlacementView; label: string; status?: string }[] = [
  { value: "review", label: "To review", status: "paid" },
  { value: "unpaid", label: "Not paid", status: "pending" },
  { value: "published", label: "Published", status: "published" },
  { value: "declined", label: "Declined", status: "declined" },
  { value: "all", label: "All" },
];

/** A checkout left a day is gone at Stripe: the buyer did not pay and cannot any more. */
const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000;

function statusOf(row: { status: string; createdAt: Date }): { tone: StatusTone; label: string } {
  switch (row.status) {
    case "paid":
      return { tone: "warning", label: "Paid - to review" };
    case "published":
      return { tone: "success", label: "Published" };
    case "declined":
      return { tone: "neutral", label: "Declined" };
    default:
      return Date.now() - row.createdAt.getTime() > ABANDONED_AFTER_MS
        ? { tone: "neutral", label: "Not paid - checkout expired" }
        : { tone: "pending", label: "Not paid yet" };
  }
}

/**
 * Admin -> Blog -> Featured placements: who paid $99 to be mentioned in which
 * article (lib/blog/sponsorship.ts), oldest paid request first. Placing the
 * mention is done by hand in the article; this page records the decision.
 * Unpaid requests are kept apart, so they can never bury a paid one.
 */
export default async function FeaturedPlacementsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const requested = (await searchParams).view;
  const view = VIEWS.some((option) => option.value === requested) ? (requested as PlacementView) : "review";
  const { rows, counts } = await listPlacements(view);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <AdminPage>
      <AdminPageHeader
        back={{ href: "/admin/blog", label: "Blog" }}
        title="Featured placements"
        description="Paid “Get Featured in This Article” requests from the blog ($99, one time). Add the sponsored mention to the article yourself, then mark it published here - or decline it."
      />

      <nav aria-label="Placement status" className="flex flex-wrap gap-2">
        {VIEWS.map((option) => {
          const n = option.status ? (counts[option.status] ?? 0) : total;
          const active = option.value === view;
          return (
            <Link
              key={option.value}
              href={option.value === "review" ? "/admin/blog/sponsorships" : `/admin/blog/sponsorships?view=${option.value}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted",
              )}
            >
              {option.label}
              <span className={cn("tabular-nums", active ? "text-background/75" : "text-muted-foreground")}>{formatNumber(n, "en")}</span>
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <AdminEmpty
            filtering={false}
            icon={Newspaper}
            noun="requests"
            title={view === "review" ? "Nothing to review" : "No requests here"}
            description={
              view === "review"
                ? "Paid requests appear here as soon as Stripe confirms the payment. Each administrator is emailed too."
                : "Requests appear here when readers use “Get Featured in This Article”."
            }
          />
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => {
            const status = statusOf(row);
            return (
              <li key={row.id} className="rounded-xl border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <AdminStatus tone={status.tone} label={status.label} />
                    <p className="pt-1 font-medium wrap-anywhere">
                      {row.postTitle ? (
                        <a
                          href={`/blog/${row.postSlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-start gap-1 rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {row.postTitle}
                          <ExternalLink className="mt-1 size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                      ) : (
                        <>
                          /blog/{row.postSlug} <span className="font-normal text-muted-foreground">(no longer published)</span>
                        </>
                      )}
                    </p>
                  </div>
                  <PlacementActions id={row.id} status={row.status} />
                </div>

                <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
                  <dt className="text-muted-foreground">Buyer</dt>
                  <dd className="min-w-0">
                    <a href={`mailto:${row.email}`} className="inline-flex items-center gap-1.5 underline-offset-4 wrap-anywhere hover:underline">
                      <Mail className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      {row.email}
                    </a>
                  </dd>
                  <dt className="text-muted-foreground">Website</dt>
                  <dd className="min-w-0">
                    {/* Typed by a stranger: shown, and opened only on purpose, never followed. */}
                    <a href={row.websiteUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline-offset-4 wrap-anywhere hover:underline">
                      {row.websiteUrl}
                    </a>
                  </dd>
                  <dt className="text-muted-foreground">What to mention</dt>
                  <dd className="min-w-0 whitespace-pre-wrap wrap-anywhere">{row.message}</dd>
                  <dt className="text-muted-foreground">{row.paidAt ? "Paid" : "Started"}</dt>
                  <dd className="tabular-nums">{when(row.paidAt ?? row.createdAt)}</dd>
                  {row.checkoutId ? (
                    <>
                      <dt className="text-muted-foreground">Stripe checkout</dt>
                      <dd className="font-mono text-xs wrap-anywhere">{row.checkoutId}</dd>
                    </>
                  ) : null}
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </AdminPage>
  );
}
