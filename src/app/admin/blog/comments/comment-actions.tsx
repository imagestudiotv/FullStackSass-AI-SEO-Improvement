"use client";

import { EyeOff, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setCommentRemoved } from "@/lib/admin/blog-comments";

import { ConfirmDialog } from "../confirm-dialog";

/** Remove (confirmed first) or restore one comment. */
export function CommentActions({ id, removed }: { id: string; removed: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function run(remove: boolean) {
    start(async () => {
      const result = await setCommentRemoved({ id, removed: remove }).catch(() => null);
      if (!result) {
        toast.error("The server did not finish this. Try again.");
        return;
      }
      setConfirming(false);
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success(remove ? "Comment removed from the blog" : "Comment restored");
      }
      router.refresh();
    });
  }

  return (
    <>
      {removed ? (
        <Button type="button" size="sm" variant="outline" onClick={() => run(false)} disabled={pending}>
          <RotateCcw aria-hidden="true" />
          Restore
        </Button>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(true)} disabled={pending}>
          <EyeOff aria-hidden="true" />
          Remove
        </Button>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Remove this comment?"
        description="It disappears from the post at once and stops counting in Earn Credits. You can restore it from the Removed list."
        confirmLabel="Remove comment"
        tone="danger"
        pending={pending}
        onConfirm={() => run(true)}
      />
    </>
  );
}
