"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { confirmNotPublished } from "@/lib/publishing/actions";

/**
 * An earlier send got no answer from the website, and this kind of site
 * cannot be searched for the post (lib/publishing/dispatch.ts). Rather than
 * risk a duplicate post, publishing waits until someone looks. Confirming
 * records who checked; the next Publish press creates the post.
 */
export function UncertainPublication({
  websiteId,
  articleId,
  canEdit,
  text,
}: {
  websiteId: string;
  articleId: string;
  canEdit: boolean;
  text: { title: string; help: string; confirm: string; confirmed: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div role="status" className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <p className="text-sm font-semibold">{text.title}</p>
        <p className="text-xs">{text.help}</p>
      </div>
      {canEdit ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await confirmNotPublished(websiteId, articleId);
              if (!result.ok) return void toast.error(result.error);
              toast.success(text.confirmed);
              router.refresh();
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {text.confirm}
        </Button>
      ) : null}
    </div>
  );
}
