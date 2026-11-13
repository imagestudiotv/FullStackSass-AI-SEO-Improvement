"use client";

import { ExternalLink, Globe, Loader2, MoreHorizontal, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { removeMissingLink } from "@/lib/admin/network";

import { AdminFacts } from "../_ui/page";
import { useReturnFocus } from "../_ui/use-return-focus";

/**
 * One missing link's actions: where it is, and "Remove and refund" behind a
 * confirmation that asks for the reason the audit log requires.
 *
 * Being on the missing list is a REPORT, not a removal: the link is still
 * live for the customer and still checked. Removing it is the administrator's
 * decision once it is confirmed really gone - nothing is refunded
 * automatically (lib/backlinks/placements.ts), and the server does not check
 * the page again first, so the dialog says what will happen before it does.
 */
export function MissingLinkActions({
  placementId,
  credits,
  targetUrl,
  liveUrl,
  hostDomain,
  beneficiaryDomain,
  missingSince,
}: {
  placementId: string;
  credits: number;
  targetUrl: string;
  liveUrl: string | null;
  hostDomain: string | null;
  beneficiaryDomain: string;
  /** Already formatted on the server. */
  missingSince: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const creditWord = `credit${credits === 1 ? "" : "s"}`;
  const reasonId = `missing-reason-${placementId}`;
  // Opened from a menu item, which is gone when the dialog closes: focus goes back to the row's menu button.
  const menuButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useReturnFocus(menuButton);

  function close() {
    setOpen(false);
    setReason("");
  }

  function submit() {
    start(async () => {
      const result = await removeMissingLink({ placementId, reason });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Removed. ${result.data.credits} credit${result.data.credits === 1 ? "" : "s"} refunded to the customer.`);
      close();
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button ref={menuButton} variant="ghost" size="icon-sm" aria-label={`Actions for the link to ${beneficiaryDomain}`}>
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {liveUrl ? (
            <DropdownMenuItem asChild>
              <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" />
                Open the page it should be on
              </a>
            </DropdownMenuItem>
          ) : null}
          {hostDomain ? (
            <DropdownMenuItem asChild>
              <Link href={`/admin/websites?q=${encodeURIComponent(hostDomain)}`}>
                <Globe aria-hidden="true" />
                Find host website
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href={`/admin/websites?q=${encodeURIComponent(beneficiaryDomain)}`}>
              <Globe aria-hidden="true" />
              Find receiving website
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setOpen(true)}>
            <Undo2 aria-hidden="true" />
            Remove and refund {credits}…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          // Not while the removal is running: its outcome must be seen.
          if (!next && !pending) close();
        }}
      >
        <DialogContent className="sm:max-w-lg" {...returnFocus}>
          <DialogHeader>
            <DialogTitle>
              Remove this link and refund {credits} {creditWord}?
            </DialogTitle>
            <DialogDescription>
              Do this only once you have confirmed the link is really gone - usually after the customer reports it. The
              customer gets {credits} {creditWord} back and the host&apos;s reward is reversed. The page is not checked
              again first, and this cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <AdminFacts
            className="rounded-lg border bg-muted/30 p-3 text-[13px]"
            items={[
              { label: "Link to", value: <span className="font-mono text-xs">{targetUrl}</span> },
              {
                label: "On page",
                value: liveUrl ? <span className="font-mono text-xs">{liveUrl}</span> : (hostDomain ?? "host website deleted"),
              },
              { label: "Missing since", value: missingSince },
            ]}
          />

          <div className="space-y-2">
            <Label htmlFor={reasonId}>Reason for removing this link</Label>
            <Input
              id={reasonId}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason, e.g. customer reported it"
              autoComplete="off"
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">At least 3 characters. Recorded against your name in the admin log.</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submit} disabled={pending || reason.trim().length < 3}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Undo2 className="size-4" aria-hidden="true" />}
              Remove and refund {credits}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
