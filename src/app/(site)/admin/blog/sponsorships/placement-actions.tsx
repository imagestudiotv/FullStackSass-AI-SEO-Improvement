"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setPlacementStatus } from "@/lib/admin/blog-sponsorships";

import { ConfirmDialog } from "../confirm-dialog";

type Target = "published" | "declined" | "paid";

const CONFIRM: Record<Target, { title: string; description: string; label: string; done: string }> = {
  published: {
    title: "Mark this placement as published?",
    description: "Do this once the sponsored mention is in the article. It leaves the review list.",
    label: "Mark as published",
    done: "Marked as published",
  },
  declined: {
    title: "Decline this placement?",
    description:
      "It leaves the review list. Nothing is sent to the buyer and no money moves: reply to them yourself, and settle any payment in Stripe if you choose to.",
    label: "Decline",
    done: "Declined",
  },
  paid: {
    title: "Move this request back to review?",
    description: "It returns to the list of paid requests waiting for a decision.",
    label: "Move back to review",
    done: "Back in review",
  },
};

/** The decision buttons on one paid request (or the undo on a decided one), each confirmed first. */
export function PlacementActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState<Target | null>(null);

  function run(target: Target) {
    start(async () => {
      const result = await setPlacementStatus({ id, status: target }).catch(() => null);
      if (!result) {
        toast.error("The server did not finish this. Try again.");
        return;
      }
      if (!result.ok) {
        toast.error(result.error);
        setConfirming(null);
        router.refresh();
        return;
      }
      toast.success(CONFIRM[target].done);
      setConfirming(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "paid" ? (
        <>
          <Button type="button" size="sm" onClick={() => setConfirming("published")} disabled={pending}>
            <Check aria-hidden="true" />
            Mark as published
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setConfirming("declined")} disabled={pending}>
            <X aria-hidden="true" />
            Decline
          </Button>
        </>
      ) : status === "published" || status === "declined" ? (
        <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming("paid")} disabled={pending}>
          <RotateCcw aria-hidden="true" />
          Move back to review
        </Button>
      ) : null}

      {confirming ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => (open ? null : setConfirming(null))}
          title={CONFIRM[confirming].title}
          description={CONFIRM[confirming].description}
          confirmLabel={CONFIRM[confirming].label}
          tone={confirming === "declined" ? "danger" : "default"}
          pending={pending}
          onConfirm={() => run(confirming)}
        />
      ) : null}
    </div>
  );
}
