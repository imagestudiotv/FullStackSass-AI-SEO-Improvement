"use client";

import { ExternalLink, Loader2, RefreshCw, TrendingDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { refreshArticle } from "@/lib/articles/refresh-actions";
import type { DecayedPage } from "@/lib/articles/decay";

/**
 * Pages losing traffic.
 *
 * Decline is slow enough to read as noise, so it usually goes unnoticed until
 * the traffic is gone. This shows the real before-and-after numbers from Search
 * Console — never an estimate — and offers the one action that fixes it.
 *
 * A page we did not write can still be shown: it is still the customer's page
 * and still losing traffic. It simply has no rewrite button, because there is
 * no article of ours to regenerate.
 */
export function RefreshPanel({
  websiteId,
  pages,
}: {
  websiteId: string;
  pages: DecayedPage[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [working, setWorking] = useState<string | null>(null);

  function handleRefresh(articleId: string) {
    setWorking(articleId);
    startTransition(async () => {
      const result = await refreshArticle(websiteId, articleId);
      setWorking(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Rewriting — the new version replaces the old one");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="size-4" aria-hidden="true" />
          Losing traffic
        </CardTitle>
        <CardDescription>
          Pages getting fewer clicks than they did a month ago, from your Search
          Console data.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {pages.length === 0 ? (
          <EmptyState
            icon={TrendingDown}
            title="Nothing is losing traffic"
            description="We compare the last 28 days against the 28 before. Nothing has dropped enough to worry about — or there is not enough Search Console history yet."
          />
        ) : (
          <ul className="divide-y rounded-lg border">
            {pages.map((page) => (
              <li
                key={page.pageUrl}
                className="flex flex-wrap items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0 flex-1">
                  <a
                    href={page.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 truncate text-sm font-medium hover:underline"
                  >
                    {page.articleTitle ?? new URL(page.pageUrl).pathname}
                    <ExternalLink
                      className="size-3 shrink-0"
                      aria-hidden="true"
                    />
                  </a>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {page.before} → {page.after} clicks
                    <span className="mx-1">·</span>
                    <span className="text-red-600 dark:text-red-400">
                      down {Math.round(page.drop * 100)}%
                    </span>
                    {page.positionBefore !== null &&
                    page.positionAfter !== null ? (
                      <>
                        <span className="mx-1">·</span>
                        position {page.positionBefore.toFixed(1)} →{" "}
                        {page.positionAfter.toFixed(1)}
                      </>
                    ) : null}
                  </p>
                </div>

                {page.articleId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRefresh(page.articleId as string)}
                    disabled={pending}
                  >
                    {working === page.articleId ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                    Rewrite
                  </Button>
                ) : (
                  // Not one of ours, so there is nothing to regenerate.
                  <span className="text-xs text-muted-foreground">
                    Not written here
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
