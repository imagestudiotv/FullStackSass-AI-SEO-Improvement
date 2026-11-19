"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteSuccessStory, moveSuccessStory, setSuccessStoryPublished } from "@/lib/admin/success-stories";

import { ConfirmDialog } from "../blog/confirm-dialog";

/** A story's buttons in the list: move up or down (after Image Studio), publish or unpublish, edit, delete. */
export function SuccessStoryRowActions({
  id,
  title,
  first,
  last,
  published,
}: {
  id: string;
  title: string;
  first: boolean;
  last: boolean;
  published: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, done?: string) {
    start(async () => {
      const result = await action().catch(() => null);
      if (!result) {
        toast.error("The server did not finish this. Try again.");
        return;
      }
      if (!result.ok) toast.error(result.error);
      else if (done) toast.success(done);
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
      <Button variant="ghost" size="icon-sm" disabled={pending || first} onClick={() => run(() => moveSuccessStory(id, "up"))} aria-label={`Move "${title}" up`}>
        <ArrowUp aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="icon-sm" disabled={pending || last} onClick={() => run(() => moveSuccessStory(id, "down"))} aria-label={`Move "${title}" down`}>
        <ArrowDown aria-hidden="true" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run(() => setSuccessStoryPublished(id, !published), published ? "Unpublished" : "Published")}
      >
        {published ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        {published ? "Unpublish" : "Publish"}
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link href={`/admin/success-stories/${id}`}>
          <Pencil aria-hidden="true" />
          Edit
        </Link>
      </Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(true)}>
        <Trash2 aria-hidden="true" />
        Delete
      </Button>
      {confirming ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => (open ? null : setConfirming(false))}
          title="Delete this success story?"
          description={`"${title}" is deleted for good.${published ? " It disappears from the homepage, /success-stories and /discover at once, and its page stops working." : ""}`}
          confirmLabel="Delete story"
          tone="danger"
          pending={pending}
          onConfirm={() => run(() => deleteSuccessStory(id), "Success story deleted")}
        />
      ) : null}
    </div>
  );
}
