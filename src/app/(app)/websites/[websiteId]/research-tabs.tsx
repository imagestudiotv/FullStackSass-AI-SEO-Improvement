"use client";

import {
  CalendarDays,
  FileText,
  Loader2,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useRouter } from "next/navigation";
import type { Messages } from "@/lib/i18n/messages";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ContentCalendar } from "./content-calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  deleteKeyword,
  startResearch,
  type CalendarRow,
  type KeywordRow,
} from "@/lib/keywords/actions";
import {
  deleteArticle,
  type ArticleRow,
} from "@/lib/articles/actions";

type ResearchTabsProps = {
  websiteId: string;
  keywords: KeywordRow[];
  calendar: CalendarRow[];
  articles: ArticleRow[];
  /** True while a research run is in flight, so the UI can say so. */
  researching: boolean;
  /** This screen's copy, already in the reader's language. */
  t: Messages["app"]["research"];
  /** Shared words used on several screens. */
  tCommon: Messages["app"]["common"];
  /** The calendar's own slice, forwarded to it. */
  tCalendar: Messages["app"]["calendar"];
};

const ARTICLE_STATUS: Record<
  string,
  {
    key: keyof Messages["app"]["research"];
    variant: "default" | "secondary" | "destructive";
  }
> = {
  queued: { key: "statusQueued", variant: "secondary" },
  generating: { key: "statusGenerating", variant: "secondary" },
  draft: { key: "statusDraft", variant: "default" },
  published: { key: "statusPublished", variant: "default" },
  failed: { key: "statusFailed", variant: "destructive" },
};

const INTENT_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  transactional: "default",
  commercial: "default",
  informational: "secondary",
  navigational: "outline",
};

/**
 * Competition in words, not a 0-100 score.
 *
 * "34" means nothing to a dentist. "Low" tells them whether it is worth
 * going after, which is the only decision they need to make.
 */
function difficultyLabel(
  value: number | null,
  t: Messages["app"]["research"],
): string {
  if (value === null) return "—";
  if (value < 30) return t.difficultyLow;
  if (value < 50) return t.difficultyMedium;
  if (value < 70) return t.difficultyHigh;
  return t.difficultyVeryHigh;
}

export function ResearchTabs({
  websiteId,
  keywords,
  calendar,
  articles,
  researching,
  t,
  tCalendar,
  tCommon,
}: ResearchTabsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function handleResearch() {
    startTransition(async () => {
      const result = await startResearch(websiteId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t.researching);
      router.refresh();
    });
  }

  function handleDeleteKeyword(id: string, term: string) {
    setBusyId(id);
    startTransition(async () => {
      const result = await deleteKeyword(websiteId, id);
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Removed "${term}"`);
      router.refresh();
    });
  }


  function handleDeleteArticle(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const result = await deleteArticle(websiteId, id);
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t.articleDeleted);
      router.refresh();
    });
  }





  const empty = keywords.length === 0 && calendar.length === 0;

  if (empty) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4" />
            {tCommon.noOpportunities}
          </CardTitle>
          <CardDescription>
            We will find the search terms your customers use, group them into
            topics, and turn those into a plan of articles to publish.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleResearch} disabled={pending || researching}>
            {researching ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Looking…
              </>
            ) : (
              <>
                <Search className="size-4" />
                {tCommon.findOpportunities}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="calendar">
      {/*
        Wraps on a narrow screen. Three tabs and a button on one unwrapping
        row measured 515px against a 390px phone, so the whole page scrolled
        sideways — the tabs are the page's navigation and were the part pushed
        off the edge.
      */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/*
          The tab row scrolls within itself rather than forcing the page to.
          Three labels with counts do not fit a phone at any wrapping, and a
          list that wraps to three lines costs more room than it saves.
        */}
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="calendar">
            <CalendarDays className="size-4" />
            {t.contentPlan} ({calendar.length})
          </TabsTrigger>
          <TabsTrigger value="articles">
            <FileText className="size-4" />
            {t.articlesTab} ({articles.length})
          </TabsTrigger>
          <TabsTrigger value="keywords">
            <Search className="size-4" />
            {t.opportunities} ({keywords.length})
          </TabsTrigger>
        </TabsList>
        <Button
          variant="outline"
          size="sm"
          onClick={handleResearch}
          disabled={pending || researching}
        >
          {researching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          {researching ? t.looking : t.refresh}
        </Button>
      </div>

      <TabsContent value="calendar" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.plannedArticles}</CardTitle>
            <CardDescription>{t.plannedHelp}</CardDescription>
          </CardHeader>
          <CardContent>
            <ContentCalendar
              websiteId={websiteId}
              calendar={calendar}
              articles={articles}
              t={tCalendar}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="articles" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.articles}</CardTitle>
            <CardDescription>{t.articlesHelp}</CardDescription>
          </CardHeader>
          <CardContent>
            {articles.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                {t.nothingWritten} <strong>{t.write}</strong>
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.title}</TableHead>
                    <TableHead className="w-28">{t.status}</TableHead>
                    <TableHead className="hidden w-24 sm:table-cell">
                      {t.words}
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.map((article) => {
                    const known = ARTICLE_STATUS[article.status];
                    const status = {
                      label: known ? t[known.key] : article.status,
                      variant: known?.variant ?? ("secondary" as const),
                    };
                    return (
                      <TableRow key={article.id}>
                        <TableCell>
                          <Link
                            href={`/websites/${websiteId}/articles/${article.id}`}
                            className="hover:underline"
                          >
                            {article.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">
                          {article.wordCount?.toLocaleString() ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${article.title}`}
                            disabled={pending && busyId === article.id}
                            onClick={() => handleDeleteArticle(article.id)}
                          >
                            {pending && busyId === article.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="keywords" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.keywords}</CardTitle>
            <CardDescription>{t.keywordsHelp}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table minWidth="34rem">
              <TableHeader>
                <TableRow>
                  <TableHead>{t.keyword}</TableHead>
                  <TableHead className="w-24">{t.opportunity}</TableHead>
                  <TableHead className="w-28">{t.searchesPerMonth}</TableHead>
                  <TableHead className="hidden w-32 sm:table-cell">
                    {t.competition}
                  </TableHead>
                  <TableHead className="hidden md:table-cell">{t.topic}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keywords.map((keyword) => (
                  <TableRow key={keyword.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{keyword.term}</span>
                        {keyword.intent ? (
                          <Badge
                            variant={
                              INTENT_VARIANT[keyword.intent] ?? "secondary"
                            }
                            className="hidden lg:inline-flex"
                          >
                            {keyword.intent}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {keyword.priorityScore?.toFixed(1) ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {keyword.volume?.toLocaleString() ?? "—"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {difficultyLabel(keyword.difficulty, t)}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {keyword.clusterName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${keyword.term}`}
                        disabled={pending && busyId === keyword.id}
                        onClick={() =>
                          handleDeleteKeyword(keyword.id, keyword.term)
                        }
                      >
                        {pending && busyId === keyword.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
