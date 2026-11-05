"use client";

import { ChevronRight, Loader2, Upload } from "lucide-react";
import Link from "next/link";

import { useRefreshWhile } from "@/components/refresh-while";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ARTICLE_DELIVERY } from "@/lib/i18n/article-delivery";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

import type { Destination } from "./publish-state";
import { useSlowRefresh } from "./use-slow-refresh";

/**
 * What the customer sees of an article before the RepGet team has approved it,
 * under the two-step flow (docs/two-step-articles.md): where it stands, what
 * happens next, and that nothing is asked of them. Nothing of the article
 * reaches this page: getArticle returned it empty.
 */
export function ArticlePreparing({
  websiteId,
  title,
  stage,
  destination,
  autoPublish,
  canEdit,
  locale,
  plannedArticlesLabel,
  breadcrumbLabel,
  tStatus,
}: {
  websiteId: string;
  title: string;
  stage: "writing" | "team";
  destination: Destination;
  autoPublish: "off" | "live" | "draft";
  canEdit: boolean;
  locale: Locale;
  plannedArticlesLabel: string;
  breadcrumbLabel: string;
  tStatus: Messages["app"]["status"];
}) {
  const t = ARTICLE_DELIVERY[locale];
  // A finished article arrives without a reload: writing takes minutes, the team's work longer.
  useRefreshWhile(stage === "writing");
  useSlowRefresh(stage === "team");
  const steps = [
    { label: t.stepTeam, current: true },
    { label: t.stepPublish, current: false },
  ];
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <nav aria-label={breadcrumbLabel}>
          <ol className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <li className="shrink-0">
              <Link
                href={`/websites/${websiteId}/content`}
                className="rounded-sm font-medium outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {plannedArticlesLabel}
              </Link>
            </li>
            <li aria-hidden="true" className="shrink-0">
              <ChevronRight className="size-3.5" />
            </li>
            <li aria-current="page" className="min-w-0 truncate text-foreground">
              {title}
            </li>
          </ol>
        </nav>
        <h1 className="text-xl font-semibold tracking-tight text-foreground wrap-anywhere sm:text-2xl">{title}</h1>
        <StatusBadge status={stage === "writing" ? "generating" : "preparing"} t={tStatus} size="lg" />
      </div>

      <section className="max-w-2xl space-y-5 rounded-xl border bg-card p-5 text-card-foreground sm:p-6" aria-labelledby="article-preparing-title">
        <div role="status" className="flex items-start gap-3">
          <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
          <div className="min-w-0 space-y-1">
            <h2 id="article-preparing-title" className="font-semibold">
              {stage === "writing" ? t.writingTitle : t.teamTitle}
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">{stage === "writing" ? t.writingBody : t.teamBody}</p>
          </div>
        </div>

        <ol aria-label={t.stepsLabel} className="space-y-2 border-t pt-4 text-sm">
          {steps.map((step, index) => (
            <li key={step.label} className="flex items-center gap-2.5" aria-current={step.current ? "step" : undefined}>
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                  step.current ? "border-primary text-primary" : "text-muted-foreground",
                )}
              >
                {index + 1}
              </span>
              <span className={cn("min-w-0", step.current ? "font-medium text-foreground" : "text-muted-foreground")}>{step.label}</span>
              {step.current ? <span className="sr-only">({t.currentStep})</span> : null}
            </li>
          ))}
        </ol>

        {autoPublish !== "off" ? (
          <p className="text-sm leading-6 text-muted-foreground">{autoPublish === "live" ? t.autoNoteLive : t.autoNoteDraft}</p>
        ) : null}

        {destination.kind === "none" && canEdit ? (
          <div className="space-y-3 border-t pt-4">
            <p className="text-sm leading-6 text-muted-foreground">{t.connectNote}</p>
            <Button asChild variant="outline" className="h-auto min-h-8 whitespace-normal text-left">
              <Link href={`/websites/${websiteId}/integrations`}>
                <Upload aria-hidden="true" />
                {t.connectAction}
              </Link>
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
