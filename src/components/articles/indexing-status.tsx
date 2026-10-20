import { and, desc, eq } from "drizzle-orm";
import { CircleCheck, CircleSlash, Clock } from "lucide-react";

import { db } from "@/lib/db";
import { articleIndexing } from "@/lib/db/schema";
import type { Locale } from "@/lib/i18n/config";
import { INDEXING_COPY, indexingLine } from "@/lib/i18n/indexing-status";
import { cn } from "@/lib/utils";

/**
 * A published article's Google indexing, on its page (client, 2026-10-20):
 * waiting to be sent, sent on a day and waiting for Google, indexed on a day,
 * or stopped. Nothing for an article never sent (a draft, or one live before
 * indexing). `websiteId` is the site the page already checked access to.
 */
export async function ArticleIndexingStatus({ websiteId, articleId, locale }: { websiteId: string; articleId: string; locale: Locale }) {
  const [row] = await db
    .select({ status: articleIndexing.status, submittedAt: articleIndexing.submittedAt, indexedAt: articleIndexing.indexedAt, createdAt: articleIndexing.createdAt })
    .from(articleIndexing)
    .where(and(eq(articleIndexing.websiteId, websiteId), eq(articleIndexing.articleId, articleId)))
    // A post moved to a new address is sent again: its latest request.
    .orderBy(desc(articleIndexing.createdAt))
    .limit(1);
  const line = row ? indexingLine(row, locale) : null;
  if (!line) return null;
  const Icon = line.tone === "done" ? CircleCheck : line.tone === "waiting" ? Clock : CircleSlash;
  return (
    <section className="mb-6 rounded-xl border bg-card p-5 text-card-foreground" aria-label={INDEXING_COPY[locale].heading}>
      <h2 className="flex items-center gap-2 font-semibold">
        <Icon
          className={cn(
            "size-4 shrink-0",
            line.tone === "done" ? "text-emerald-600 dark:text-emerald-400" : line.tone === "waiting" ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400",
          )}
          aria-hidden="true"
        />
        {INDEXING_COPY[locale].heading}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{line.text}</p>
    </section>
  );
}
