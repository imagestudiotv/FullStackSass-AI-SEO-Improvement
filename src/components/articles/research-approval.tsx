"use client";
import { useActionState } from "react";
import { approveArticleResearch } from "@/lib/articles/research-actions";
import { CONTENT_COPY } from "@/lib/i18n/content-improvements";
import type { Locale } from "@/lib/i18n/config";

export function ResearchApproval({ websiteId, articleId, revision, locale }: {
  websiteId: string; articleId: string; revision: string; locale: Locale;
}) {
  const t = CONTENT_COPY[locale];
  const [error, action, pending] = useActionState(async (_previous: string | null, form: FormData) => {
    try { await approveArticleResearch(websiteId, articleId, form); return null; }
    catch (error) { return error instanceof Error ? error.message : t.incomplete; }
  }, null);
  return <form action={action} className="mt-3 space-y-3">
    <input type="hidden" name="revision" value={revision} />
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name="reviewed" value="yes" required className="mt-1 size-4" />
      {t.confirm}
    </label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <button disabled={pending} className="min-h-10 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring">
      {pending ? t.approving : t.approve}
    </button>
  </form>;
}
