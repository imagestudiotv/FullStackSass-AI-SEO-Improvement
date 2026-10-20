"use client";

import Link from "next/link";
import { Loader2, Trash2 } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import type { ArticleRow } from "@/lib/articles/actions";
import type { Messages } from "@/lib/i18n/messages";
import { format } from "@/lib/i18n/format";
import { paginate } from "@/lib/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, statusLabel } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePager } from "@/components/table-pager";

const PAGE_SIZES = [25, 50, 100] as const;

/** "Translation (IT)": the article in another of the website's languages (lib/articles/translations.ts). */
function TranslationLabel({ article, t }: { article: ArticleRow; t: Messages["app"]["research"] }) {
  if (!article.languageCode) return null;
  return (
    <span className="inline-block whitespace-nowrap rounded-md border px-1.5 py-0.5 align-middle text-xs text-muted-foreground">
      {format(t.translationOf, { language: article.languageCode.toUpperCase() })}
    </span>
  );
}

export function ArticleList({ websiteId, articles, pending, busyId, onDelete, t, tStatus }: {
  websiteId: string;
  articles: ArticleRow[];
  pending: boolean;
  busyId: string | null;
  onDelete: (id: string) => void;
  t: Messages["app"]["research"];
  tStatus: Messages["app"]["status"];
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const matching = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return articles.filter(article => (status === "all" || article.status === status) &&
      (!term || `${article.title} ${article.targetKeyword ?? ""}`.toLocaleLowerCase().includes(term)));
  }, [articles, query, status]);
  const paging = paginate(matching.length, page, pageSize);
  const visible = matching.slice(paging.start, paging.end);
  const statuses = [...new Set(articles.map(article => article.status))];
  const changePage = (next: number) => {
    setPage(next);
    root.current?.scrollIntoView({ block: "start" });
  };
  const removeButton = (article: ArticleRow) => (
    <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0"
      aria-label={format(t.deleteArticleLabel, { title: article.title })}
      disabled={pending} onClick={() => onDelete(article.id)}>
      {pending && busyId === article.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </Button>
  );

  return (
    <div ref={root} className="scroll-mt-20 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="min-w-0 flex-1 space-y-1.5">
          <label htmlFor={`${id}-search`} className="text-sm font-medium">{t.searchArticles}</label>
          <Input id={`${id}-search`} className="h-11" type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
        </div>
        <div className="space-y-1.5 sm:w-48">
          <label htmlFor={`${id}-status`} className="block text-sm font-medium">{t.status}</label>
          <select id={`${id}-status`} className="h-11 w-full rounded-md border bg-background px-3 text-sm"
            value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
            <option value="all">{t.allStatuses}</option>
            {statuses.map(value => <option key={value} value={value}>{statusLabel(value, tStatus)}</option>)}
          </select>
        </div>
      </div>
      {matching.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">{t.noArticleMatch}</p>
          <Button variant="link" onClick={() => { setQuery(""); setStatus("all"); setPage(1); }}>{t.clearFilters}</Button>
        </div>
      ) : (
        <>
          <ul className="divide-y rounded-lg border md:hidden">
            {visible.map(article => (
              <li key={article.id} className="flex items-start gap-2 p-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <Link className="block break-words text-sm font-medium hover:underline" href={`/websites/${websiteId}/articles/${article.id}`}>{article.title}</Link>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={article.status} t={tStatus} />
                    <TranslationLabel article={article} t={t} />
                  </div>
                </div>
                {removeButton(article)}
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <Table className="table-fixed">
              <TableHeader><TableRow>
                <TableHead>{t.title}</TableHead><TableHead className="w-32">{t.status}</TableHead>
                <TableHead className="w-24">{t.words}</TableHead><TableHead className="w-16"><span className="sr-only">{t.deleteArticleLabel.replace("{title}", "")}</span></TableHead>
              </TableRow></TableHeader>
              <TableBody>{visible.map(article => (
                <TableRow key={article.id}>
                  <TableCell className="whitespace-normal break-words"><Link className="font-medium hover:underline" href={`/websites/${websiteId}/articles/${article.id}`}>{article.title}</Link> <TranslationLabel article={article} t={t} /></TableCell>
                  <TableCell><StatusBadge status={article.status} t={tStatus} /></TableCell>
                  <TableCell className="text-muted-foreground">{article.wordCount?.toLocaleString() ?? "-"}</TableCell>
                  <TableCell>{removeButton(article)}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </div>
        </>
      )}
      <TablePager page={paging.current} pageCount={paging.pageCount} first={matching.length ? paging.start + 1 : 0}
        last={paging.end} total={matching.length} pageSize={pageSize} pageSizes={PAGE_SIZES}
        onPage={changePage} onPageSize={size => { setPageSize(size); setPage(1); }}
        labels={{ ...t, pagination: t.articlePages }} />
    </div>
  );
}
