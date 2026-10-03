"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/workspace/notice";
import { confirmNotPublished } from "@/lib/publishing/actions";

/**
 * An earlier send got no answer from the website, and this kind of site
 * cannot be searched for the post (lib/publishing/dispatch.ts). Rather than
 * risk a duplicate post, publishing waits until someone looks. Confirming
 * records who checked; the next Publish press creates the post.
 *
 * Viewers see the notice without the button (the server refuses them too).
 */
export function UncertainPublication({
  websiteId,
  articleId,
  canEdit,
  text,
  errorText,
}: {
  websiteId: string;
  articleId: string;
  canEdit: boolean;
  text: { title: string; help: string; confirm: string; confirmed: string };
  /** Translates a refusal from the server. */
  errorText: (error: string) => string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function confirm() {
    setResult(null);
    start(async () => {
      const response = await confirmNotPublished(websiteId, articleId);
      if (!response.ok) {
        setResult({ ok: false, message: errorText(response.error) });
        return;
      }
      setResult({ ok: true, message: text.confirmed });
      router.refresh();
    });
  }

  return (
    <Notice tone="warning" role="status" title={text.title}>
      <p>{text.help}</p>
      {canEdit ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={confirm} className="h-auto min-h-7 max-w-full shrink whitespace-normal text-left">
            {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            {text.confirm}
          </Button>
          {result ? (
            <p role={result.ok ? "status" : "alert"} className={result.ok ? "text-emerald-800" : "text-destructive"}>
              {result.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </Notice>
  );
}
