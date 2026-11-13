"use client";

import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteTestimonial, moveTestimonial } from "@/lib/admin/testimonials";

import { ConfirmDialog } from "../blog/confirm-dialog";

/** A card's buttons in the list: edit, move up or down in the homepage order, delete. */
export function TestimonialRowActions({
  id,
  name,
  first,
  last,
  published,
}: {
  id: string;
  name: string;
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
      <Button variant="ghost" size="icon-sm" disabled={pending || first} onClick={() => run(() => moveTestimonial(id, "up"))} aria-label={`Move "${name}" up`}>
        <ArrowUp aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="icon-sm" disabled={pending || last} onClick={() => run(() => moveTestimonial(id, "down"))} aria-label={`Move "${name}" down`}>
        <ArrowDown aria-hidden="true" />
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link href={`/admin/testimonials/${id}`}>
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
          title="Delete this testimonial?"
          description={`"${name}" is deleted for good.${published ? " It disappears from the homepage at once." : ""}`}
          confirmLabel="Delete testimonial"
          tone="danger"
          pending={pending}
          onConfirm={() => run(() => deleteTestimonial(id), "Testimonial deleted")}
        />
      ) : null}
    </div>
  );
}
