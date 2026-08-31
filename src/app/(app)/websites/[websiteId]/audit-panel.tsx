"use client";

import { AlertTriangle, ExternalLink, Info, Loader2, ShieldCheck, Stethoscope } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { startAudit, type AuditView, type CrawlProgress } from "@/lib/audit/actions";
import { ISSUE_LABELS } from "@/lib/audit/rules";

type AuditPanelProps = {
  websiteId: string;
  audit: AuditView | null;
  crawl: CrawlProgress;
};

const SEVERITY_META: Record<
  string,
  { label: string; variant: "destructive" | "default" | "secondary"; icon: typeof Info }
> = {
  critical: { label: "Critical", variant: "destructive", icon: AlertTriangle },
  warning: { label: "Warning", variant: "default", icon: AlertTriangle },
  info: { label: "Suggestion", variant: "secondary", icon: Info },
};

/** Colour band for the headline score. */
function scoreTone(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function AuditPanel({ websiteId, audit, crawl }: AuditPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAll, setShowAll] = useState(false);

  const running = crawl?.status === "running";

  /**
   * The crawl writes progress from a background job, so the page cannot know
   * it advanced. Polling stops as soon as the crawl is no longer running.
   */
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [running, router]);

  function handleAudit() {
    startTransition(async () => {
      const result = await startAudit(websiteId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Checking your site…");
      router.refresh();
    });
  }

  if (running) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Loader2 className="size-4 animate-spin" />
            Checking your site
          </CardTitle>
          <CardDescription>
            {crawl.pagesCrawled} of {crawl.pagesFound} pages checked. This takes
            a minute or two.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!audit) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Stethoscope className="size-4" />
            SEO health check
          </CardTitle>
          <CardDescription>
            We will crawl your pages and list what is holding your rankings
            back, with the exact page each problem is on.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleAudit} disabled={pending}>
            {pending ? "Starting…" : "Run health check"}
          </Button>
          {crawl?.status === "failed" && crawl.error ? (
            <p className="mt-3 text-sm text-destructive">{crawl.error}</p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const visible = showAll ? audit.issues : audit.issues.slice(0, 10);
  const counts = audit.summary?.counts;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4" />
              SEO health check
            </CardTitle>
            <CardDescription>
              {audit.summary?.pagesCrawled ?? 0} pages checked on{" "}
              {new Date(audit.createdAt).toLocaleDateString()}
            </CardDescription>
          </div>
          <div className="text-right">
            <div
              className={`text-3xl font-semibold tabular-nums ${scoreTone(audit.score ?? 0)}`}
            >
              {audit.score ?? "—"}
            </div>
            <div className="text-xs text-muted-foreground">out of 100</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {counts ? (
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="destructive">{counts.critical} critical</Badge>
            <Badge>{counts.warning} warnings</Badge>
            <Badge variant="secondary">{counts.info} suggestions</Badge>
          </div>
        ) : null}

        {audit.issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No problems found. Re-run the check after you make changes.
          </p>
        ) : (
          <ul className="divide-y">
            {visible.map((issue) => {
              const meta = SEVERITY_META[issue.severity] ?? SEVERITY_META.info;
              return (
                <li key={issue.id} className="flex gap-3 py-3">
                  <meta.icon
                    className={`mt-0.5 size-4 shrink-0 ${
                      issue.severity === "critical"
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {ISSUE_LABELS[issue.type] ?? issue.type}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {issue.detail}
                    </p>
                    {issue.url ? (
                      <a
                        href={issue.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                      >
                        {issue.url.replace(/^https?:\/\//, "").slice(0, 60)}
                        <ExternalLink className="size-3" />
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-wrap gap-2">
          {audit.issues.length > 10 ? (
            <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)}>
              {showAll
                ? "Show fewer"
                : `Show all ${audit.issues.length} findings`}
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={handleAudit}
            disabled={pending}
          >
            {pending ? "Starting…" : "Re-run check"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
