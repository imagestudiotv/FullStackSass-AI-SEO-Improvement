import { AlertTriangle, ArrowRight, Info, Lock } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ISSUE_LABELS } from "@/lib/audit/rules";
import { runPublicAudit } from "@/lib/audit/public-audit";
import { AuditForm } from "./audit-form";

export const metadata = {
  title: "Free website check",
  description:
    "See what is holding your website back on Google. No account needed.",
};

// Crawls a live website per request, so it can never be prerendered.
export const dynamic = "force-dynamic";

function scoreTone(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

/**
 * Free public audit — the lead magnet.
 *
 * Shows real findings from a real crawl, then stops. The visitor sees that we
 * found genuine problems on their site, and signing up is how they see the
 * rest and get them fixed. Nothing here is invented: if the crawl fails, the
 * page says so rather than showing a made-up score.
 */
export default async function AuditPage({
  searchParams,
}: PageProps<"/audit">) {
  const params = await searchParams;
  const domain = typeof params.domain === "string" ? params.domain.trim() : "";

  const outcome = domain ? await runPublicAudit(domain) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          How healthy is your website?
        </h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          We will check your pages and show you what is holding you back on
          Google. Free, and no account needed.
        </p>
      </div>

      <div className="mt-8">
        <AuditForm key={domain} defaultValue={domain} />
      </div>

      {outcome && !outcome.ok ? (
        <div
          className="mt-8 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
          role="alert"
        >
          <p className="font-medium">We could not check that website</p>
          <p className="mt-1 text-muted-foreground">
            {outcome.error.message}
          </p>
        </div>
      ) : null}

      {outcome?.ok ? (
        <div className="mt-10 space-y-6">
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-6">
              <div>
                <p className="font-medium">{outcome.result.domain}</p>
                <p className="text-sm text-muted-foreground">
                  {outcome.result.pagesChecked}{" "}
                  {outcome.result.pagesChecked === 1 ? "page" : "pages"} checked
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="destructive">
                    {outcome.result.counts.critical} critical
                  </Badge>
                  <Badge>{outcome.result.counts.warning} warnings</Badge>
                  <Badge variant="secondary">
                    {outcome.result.counts.info} suggestions
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-4xl font-semibold tabular-nums ${scoreTone(outcome.result.score)}`}
                >
                  {outcome.result.score}
                </div>
                <div className="text-xs text-muted-foreground">out of 100</div>
              </div>
            </CardContent>
          </Card>

          {outcome.result.issues.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                We found nothing wrong on the pages we checked. Sign up and we
                will check your whole site, then start finding the searches your
                customers use.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-2">
                <ul className="divide-y">
                  {outcome.result.issues.map((issue, index) => (
                    <li
                      key={`${issue.type}-${index}`}
                      className="flex gap-3 py-4"
                    >
                      {issue.severity === "critical" ? (
                        <AlertTriangle
                          className="mt-0.5 size-4 shrink-0 text-destructive"
                          aria-hidden="true"
                        />
                      ) : (
                        <Info
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {ISSUE_LABELS[issue.type] ?? issue.type}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {issue.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/*
            The gate. It states a real number from the real crawl — never an
            invented "47 issues found" — so the visitor can trust it.
          */}
          {outcome.result.hiddenIssues > 0 ? (
            <Card className="border-primary/30">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-6">
                <div className="flex items-start gap-3">
                  <Lock
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-medium">
                      {outcome.result.hiddenIssues} more{" "}
                      {outcome.result.hiddenIssues === 1 ? "thing" : "things"} to
                      fix
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Sign up free to see the full list, and we will start
                      writing the pages that fix them.
                    </p>
                  </div>
                </div>
                <Button asChild>
                  <Link href="/sign-up">
                    See the full report
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center">
              <Button asChild>
                <Link href="/sign-up">
                  Get started free
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          )}

          {outcome.result.cached ? (
            <p className="text-center text-xs text-muted-foreground">
              Showing a check from the last 24 hours.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
