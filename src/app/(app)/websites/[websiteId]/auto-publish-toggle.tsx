"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { setAutoPublish } from "@/lib/websites/actions";
import { cn } from "@/lib/utils";

/**
 * Automatic publishing, on or off.
 *
 * The client asked where to "choose to post as draft not direct publish", and
 * the answer was nowhere: every article had to be published by hand. This is
 * that setting.
 *
 * A real checkbox under the styling rather than a div with a click handler, so
 * it is reachable by keyboard and announced correctly. A switch that only
 * responds to a mouse is a switch some customers cannot use at all.
 */
export function AutoPublishToggle({
  websiteId,
  enabled,
  /** Without somewhere to publish to, the setting has no effect yet. */
  hasIntegration,
}: {
  websiteId: string;
  enabled: boolean;
  hasIntegration: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  /**
   * Optimistic, because a toggle that waits for a round trip feels broken.
   * Reverted below if the save fails, so the control never claims a state the
   * database does not have.
   */
  const [on, setOn] = useState(enabled);

  function toggle(next: boolean) {
    setOn(next);
    startTransition(async () => {
      const result = await setAutoPublish(websiteId, next);
      if (!result.ok) {
        setOn(!next);
        toast.error(result.error);
        return;
      }
      toast.success(
        next
          ? "New articles will publish automatically"
          : "New articles will be saved as drafts",
      );
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <label
            htmlFor="auto-publish"
            className="text-sm font-medium leading-none"
          >
            Publish automatically
          </label>
          <p className="text-sm text-muted-foreground">
            {on
              ? "Finished articles go live on your website by themselves."
              : "Finished articles are saved as drafts for you to review first."}
          </p>
          {on && !hasIntegration ? (
            <p className="text-sm text-muted-foreground">
              Connect a website below and publishing starts from the next
              article. Until then they stay as drafts.
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {pending ? (
            <Loader2
              className="size-4 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          ) : null}
          <label
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors",
              on ? "bg-primary" : "bg-input",
              pending && "opacity-60",
            )}
          >
            <input
              id="auto-publish"
              type="checkbox"
              role="switch"
              checked={on}
              disabled={pending}
              onChange={(event) => toggle(event.target.checked)}
              // Invisible but present: the styled track above is what people
              // see, and this is what a screen reader and the keyboard use.
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none inline-block size-5 rounded-full bg-background shadow transition-transform",
                on ? "translate-x-[1.375rem]" : "translate-x-0.5",
              )}
            />
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
