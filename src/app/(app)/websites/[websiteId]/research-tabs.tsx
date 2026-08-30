"use client";

import {
  CalendarDays,
  FileText,
  Loader2,
  PenLine,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { Input } from "@/components/ui/input";
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
  deleteCalendarItem,
  deleteKeyword,
  startResearch,
  updateCalendarItem,
  type CalendarRow,
  type KeywordRow,
} from "@/lib/keywords/actions";
import {
  deleteArticle,
  generateFromCalendarItem,
  type ArticleRow,
} from "@/lib/articles/actions";

type ResearchTabsProps = {
  websiteId: string;
  keywords: KeywordRow[];
  calendar: CalendarRow[];
  articles: ArticleRow[];
  /** True while a research run is in flight, so the UI can say so. */
  researching: boolean;
};

const ARTICLE_STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  queued: { label: "Queued", variant: "secondary" },
  generating: { label: "Writing…", variant: "secondary" },
  draft: { label: "Draft", variant: "default" },
  published: { label: "Published", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

const INTENT_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  transactional: "default",
  commercial: "default",
  informational: "secondary",
  navigational: "outline",
};

/** Difficulty is 0-100; the bands are the usual SEO reading of it. */
function difficultyLabel(value: number | null): string {
  if (value === null) return "—";
  if (value < 30) return `${value} · easy`;
  if (value < 50) return `${value} · medium`;
  if (value < 70) return `${value} · hard`;
  return `${value} · very hard`;
}

export function ResearchTabs({
  websiteId,
  keywords,
  calendar,
  articles,
  researching,
}: ResearchTabsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  function handleResearch() {
    startTransition(async () => {
      const result = await startResearch(websiteId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Researching keywords — this takes a minute");
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

  function handleGenerate(calendarItemId: string) {
    setBusyId(calendarItemId);
    startTransition(async () => {
      const result = await generateFromCalendarItem(websiteId, calendarItemId);
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Writing the article — this takes about a minute");
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
      toast.success("Article deleted");
      router.refresh();
    });
  }

  function handleDeleteItem(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const result = await deleteCalendarItem(websiteId, id);
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Removed from the plan");
      router.refresh();
    });
  }

  function saveTitle(id: string) {
    const title = draftTitle;
    setEditingId(null);
    startTransition(async () => {
      const result = await updateCalendarItem(websiteId, id, { title });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  // A calendar item that already has an article links to it instead of
  // offering to generate a second one.
  const articleByItem = new Map(
    articles
      .filter((article) => article.calendarItemId !== null)
      .map((article) => [article.calendarItemId as string, article]),
  );

  const empty = keywords.length === 0 && calendar.length === 0;

  if (empty) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4" />
            No keyword research yet
          </CardTitle>
          <CardDescription>
            We will find the keywords worth targeting, group them into topics,
            and turn those into a content plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleResearch} disabled={pending || researching}>
            {researching ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Researching…
              </>
            ) : (
              <>
                <Search className="size-4" />
                Research keywords
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="calendar">
      <div className="flex items-center justify-between gap-4">
        <TabsList>
          <TabsTrigger value="calendar">
            <CalendarDays className="size-4" />
            Content plan ({calendar.length})
          </TabsTrigger>
          <TabsTrigger value="articles">
            <FileText className="size-4" />
            Articles ({articles.length})
          </TabsTrigger>
          <TabsTrigger value="keywords">
            <Search className="size-4" />
            Keywords ({keywords.length})
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
          {researching ? "Researching…" : "Re-run research"}
        </Button>
      </div>

      <TabsContent value="calendar" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Planned articles</CardTitle>
            <CardDescription>
              Click a title to edit it. Re-running research replaces items that
              have not been written yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Keyword</TableHead>
                  <TableHead className="w-32" />
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {calendar.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground">
                      {item.scheduledFor
                        ? new Date(item.scheduledFor).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {editingId === item.id ? (
                        <Input
                          autoFocus
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          onBlur={() => saveTitle(item.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveTitle(item.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => {
                            setEditingId(item.id);
                            setDraftTitle(item.title);
                          }}
                        >
                          {item.title}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {item.targetKeyword ?? "—"}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const article = articleByItem.get(item.id);
                        if (article) {
                          return (
                            <Button variant="outline" size="sm" asChild>
                              <Link
                                href={`/websites/${websiteId}/articles/${article.id}`}
                              >
                                <FileText className="size-4" />
                                {article.status === "generating" ||
                                article.status === "queued"
                                  ? "Writing…"
                                  : "Open"}
                              </Link>
                            </Button>
                          );
                        }
                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pending && busyId === item.id}
                            onClick={() => handleGenerate(item.id)}
                          >
                            {pending && busyId === item.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <PenLine className="size-4" />
                            )}
                            Write
                          </Button>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${item.title}`}
                        disabled={pending && busyId === item.id}
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        {pending && busyId === item.id ? (
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

      <TabsContent value="articles" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Articles</CardTitle>
            <CardDescription>
              Written from your content plan. Open one to read, edit or rewrite
              it.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {articles.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                Nothing written yet. Use <strong>Write</strong> on a planned
                article to start.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="hidden w-24 sm:table-cell">
                      Words
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.map((article) => {
                    const status = ARTICLE_STATUS[article.status] ?? {
                      label: article.status,
                      variant: "secondary" as const,
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
            <CardTitle className="text-base">Keywords</CardTitle>
            <CardDescription>
              Ranked by opportunity: search demand weighed against how hard the
              term is to rank for, and whether the searcher intends to buy.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead className="w-20">Score</TableHead>
                  <TableHead className="w-24">Volume</TableHead>
                  <TableHead className="hidden w-32 sm:table-cell">
                    Difficulty
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Topic</TableHead>
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
                      {difficultyLabel(keyword.difficulty)}
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
