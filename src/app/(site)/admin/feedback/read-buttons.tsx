"use client";

import { CheckCheck, MailOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { markAllFeedbackRead, setFeedbackStatus } from "@/lib/admin/feedback";

/**
 * "Mark as read" on a New message and "Mark all as read" on the list (owner,
 * 2026-11-27: the Feedback badge showed 3 for messages he had already read).
 * Read takes a message out of New and out of the sidebar's count without
 * planning or closing it.
 */

const NOT_FINISHED = "The server did not finish this. Try again.";

export function MarkReadButton({ id, sender }: { id: string; sender: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await setFeedbackStatus({ id, status: "read" }).catch(() => null);
          if (!result) toast.error(NOT_FINISHED);
          else if (!result.ok) toast.error(result.error);
          else toast.success("Marked as read");
          router.refresh();
        })
      }
    >
      <MailOpen aria-hidden="true" />
      Mark as read
      <span className="sr-only">: the message from {sender}</span>
    </Button>
  );
}

export function MarkAllReadButton({ count, kind, kindLabel }: { count: number; kind: string | null; kindLabel: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (count === 0) return null;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await markAllFeedbackRead({ kind }).catch(() => null);
          if (!result) toast.error(NOT_FINISHED);
          else if (!result.ok) toast.error(result.error);
          else toast.success(result.data.marked === 1 ? "1 message marked as read" : `${result.data.marked} messages marked as read`);
          router.refresh();
        })
      }
    >
      <CheckCheck aria-hidden="true" />
      {kindLabel ? `Mark all new ${kindLabel} as read` : "Mark all as read"} ({count})
    </Button>
  );
}
