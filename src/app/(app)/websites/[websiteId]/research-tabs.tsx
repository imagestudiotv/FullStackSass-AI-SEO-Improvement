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

/**
 * Competition in words, not a 0-100 score.
 *
 * "34" means nothing to a dentist. "Low" tells them whether it is worth
 * going after, which is the only decision they need to make.
 */
function difficultyLabel(value: number | null): string {
  if (value === null) return "—";
  if (value < 30) return "Low";
  if (value < 50) return "Medium";
  if (value < 70) return "High";
  return "Very high";
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





  const empty = keywords.length === 0 && calendar.length === 0;

  if (empty) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4" />
            No opportunities found yet
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
                Find opportunities
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
            Opportunities ({keywords.length})
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
          {researching ? "Looking…" : "Refresh"}
        </Button>
      </div>

      <TabsContent value="calendar" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Planned articles</CardTitle>
            <CardDescription>
              Your content plan, by the day each article is due. Hover a
              planned topic to write it now, change it, or take it off the
              plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContentCalendar
              websiteId={websiteId}
              calendar={calendar}
              articles={articles}
            />
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
              Ranked by what you can realistically win. A term with fewer searches
              you can rank for beats a popular one you cannot.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead className="w-24">Opportunity</TableHead>
                  <TableHead className="w-28">Searches / mo</TableHead>
                  <TableHead className="hidden w-32 sm:table-cell">
                    Competition
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
