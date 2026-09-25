"use client";

import {
  CalendarDays,
  FileText,
  Loader2,
  Plus,
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
import { Input } from "@/components/ui/input";
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
  addKeywords,
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
  /** The status vocabulary, forwarded to the calendar and the badges. */
  tStatus: Messages["app"]["status"];
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
  if (value === null) return "-";
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
  tStatus,
}: ResearchTabsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  /** The add-keywords field. */
  const [newKeywords, setNewKeywords] = useState("");

  /*
    Follow a research run to its end.

    `researching` comes from the server render, and nothing re-rendered this
    screen until the customer reloaded - so a run that failed four minutes in
    left "Looking…" spinning for as long as they cared to watch. Refreshing
    every few seconds while it runs lets the screen change the moment the job
    does, and stops as soon as it has.
  */
  React.useEffect(() => {
    if (!researching) return;
    const timer = window.setInterval(() => router.refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [researching, router]);

  /*
    A run that ends with no content plan did not succeed: on success the job
    saves the plan before it clears "researching". Said here rather than left
    to the notification bell, where the only trace used to be a raw SDK error.
  */
  const wasResearching = React.useRef(researching);
  React.useEffect(() => {
    if (wasResearching.current && !researching && calendar.length === 0) {
      toast.error(t.researchFailed, { duration: 15000 });
    }
    wasResearching.current = researching;
  }, [researching, calendar.length, t.researchFailed]);

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

  /**
   * Adds the keywords somebody typed.
   *
   * The field is cleared only on success: a failed submission that also wipes
   * what was typed makes the customer retype a list they may have pasted from
   * somewhere else.
   */
  function handleAddKeywords(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newKeywords.trim()) return;

    startTransition(async () => {
      const result = await addKeywords(websiteId, newKeywords);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setNewKeywords("");
      /*
        Says what happened to every term AND what the product is now doing.
        "8 added" on a list of ten reads as a bug unless the other two are
        accounted for, and a content plan that silently starts rebuilding is
        the kind of surprise that makes people press the button again.
      */
      const { added, skipped, replanned } = result.data;
      const counted =
        skipped > 0
          ? `Added ${added}. Skipped ${skipped} already tracked or over your plan.`
          : `Added ${added}.`;

      toast.success(
        replanned ? `${counted} Rebuilding your content plan…` : counted,
      );
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
            {tCommon.researchIntro}
            </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleResearch} disabled={pending || researching}>
            {researching ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t.looking}
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
        {/*
          A calendar with nothing in it needs to say so, and offer the way
          out.

          The full-page empty state above only appears when there are NO
          keywords AND no calendar. A run that stored keywords and then
          failed before planning - which is exactly what happened to the
          client when clustering ran out of room - lands here instead: a
          month grid reading "0 Planned", every day blank, and the only
          control a small outline "Refresh" beside the tabs. He described it
          precisely: "I'm on this step but users can't do nothing here. They
          are not having options, and they can't go ahead."

          So the state gets named and given the same button the empty state
          has, in the place the customer is already looking.
        */}
        {calendar.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="size-4" aria-hidden="true" />
                {tCommon.noPlanYet}
              </CardTitle>
              <CardDescription>
                {keywords.length > 0
                  ? tCommon.noPlanYetHaveKeywords
                  : tCommon.researchIntro}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleResearch} disabled={pending || researching}>
                {researching ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t.looking}
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    {tCommon.buildPlan}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
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
              tCommon={tCommon}
              tStatus={tStatus}
            />
          </CardContent>
        </Card>
        )}
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
                          {article.wordCount?.toLocaleString() ?? "-"}
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
            {/*
              Add your own terms.

              Research is good at the obvious phrases and blind to the ones a
              business knows from its own customers — and what it finds caps
              everything downstream, because the topics are built from the
              keywords and the content plan is built from the topics. A niche
              business whose research returned thirty terms got a plan far
              smaller than the one they pay for, with no way to say so.

              Above the table rather than below it: on a long list the control
              would otherwise be off-screen at the moment someone reads a term
              and thinks of one we missed.
            */}
            <form onSubmit={handleAddKeywords} className="mb-4 flex gap-2">
              <Input
                value={newKeywords}
                onChange={(event) => setNewKeywords(event.target.value)}
                placeholder={t.addKeywordsPlaceholder}
                aria-label={t.addKeywordsLabel}
                disabled={pending}
              />
              <Button
                type="submit"
                variant="outline"
                disabled={pending || !newKeywords.trim()}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="size-4" aria-hidden="true" />
                )}
                {t.addKeywordsButton}
              </Button>
            </form>
            <p className="mb-4 text-xs text-muted-foreground">
              {t.addKeywordsHelp}
            </p>

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
                      {keyword.priorityScore?.toFixed(1) ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {keyword.volume?.toLocaleString() ?? "-"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {difficultyLabel(keyword.difficulty, t)}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {keyword.clusterName ?? "-"}
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
