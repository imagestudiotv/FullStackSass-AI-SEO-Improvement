"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { replyToFeedback, setFeedbackStatus } from "@/lib/admin/feedback";
import { FEEDBACK_STATUSES, type FeedbackStatus } from "@/lib/feedback/shared";

import { STATUS_LABEL } from "../labels";

/**
 * What an administrator does with a message: set its status, and reply to the
 * sender by email - optionally changing the status at the same time, which
 * the email then mentions ("We have added this to our plans").
 */
export function FeedbackActions({ id, status, language }: { id: string; status: FeedbackStatus; language: string }) {
  const router = useRouter();
  const formId = useId();
  const [pending, start] = useTransition();
  const [reply, setReply] = useState("");
  const [replyStatus, setReplyStatus] = useState<FeedbackStatus | "">("");

  function changeStatus(next: FeedbackStatus) {
    if (next === status) return;
    start(async () => {
      const result = await setFeedbackStatus({ id, status: next }).catch(() => null);
      if (!result) toast.error("The server did not finish this. Try again.");
      else if (!result.ok) toast.error(result.error);
      else toast.success(`Marked ${STATUS_LABEL[next].label}`);
      router.refresh();
    });
  }

  function send(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      const result = await replyToFeedback({ id, message: reply, status: replyStatus || null }).catch(() => null);
      if (!result) {
        toast.error("The server did not finish this. Check Replies sent before trying again.");
        return;
      }
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Reply sent");
      setReply("");
      setReplyStatus("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium">Status</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
          {FEEDBACK_STATUSES.map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              // The current status filled, the others outlined: readable in light and dark alike.
              variant={option === status ? "default" : "outline"}
              disabled={pending}
              aria-pressed={option === status}
              onClick={() => changeStatus(option)}
            >
              {STATUS_LABEL[option].label}
            </Button>
          ))}
        </div>
      </div>

      <form onSubmit={send} className="space-y-3">
        <label htmlFor={`${formId}-reply`} className="text-sm font-medium">
          Reply to the sender
        </label>
        <Textarea
          id={`${formId}-reply`}
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          rows={5}
          maxLength={5000}
          placeholder={`Write in ${language} - it is sent as you write it.`}
        />
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor={`${formId}-status`} className="text-sm text-muted-foreground">
            And mark it
          </label>
          <select
            id={`${formId}-status`}
            value={replyStatus}
            onChange={(event) => setReplyStatus(event.target.value as FeedbackStatus | "")}
            className="h-9 rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">(keep {STATUS_LABEL[status].label})</option>
            {FEEDBACK_STATUSES.filter((option) => option !== status && option !== "new").map((option) => (
              <option key={option} value={option}>
                {STATUS_LABEL[option].label}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={pending || reply.trim().length < 2} className="ml-auto">
            <Send aria-hidden />
            {pending ? "Sending…" : "Send reply"}
          </Button>
        </div>
      </form>
    </div>
  );
}
