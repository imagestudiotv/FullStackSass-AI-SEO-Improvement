"use client";

import { Check, Coins, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { declineWebsiteProject, fulfilWebsiteProject, quoteWebsiteProject } from "@/lib/website-projects/admin";
import { MAX_WEBSITE_PROJECT_CREDITS } from "@/lib/website-projects/shared";

type Mode = "quote" | "decline" | "fulfil";

const TITLE: Record<Mode, string> = { quote: "Scope and price", decline: "Decline this request?", fulfil: "Mark as delivered?" };
const HELP: Record<Mode, string> = {
  quote: "The customer sees both and is notified. They pay from their own screen; a later change replaces this price, and they are asked to check it again.",
  decline: "The customer sees your reason. Nothing has been charged.",
  fulfil: "The customer sees this note, and their order reads Delivered on Billing.",
};

/** Set or change the price, decline, or deliver: whichever this project's status allows. */
export function WebsiteProjectActions({ id, status, scope, credits }: { id: string; status: string; scope: string | null; credits: number | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [text, setText] = useState("");
  const [price, setPrice] = useState("");
  const [pending, start] = useTransition();
  const textId = useId();
  const priceId = useId();

  function open(next: Mode) {
    setMode(next);
    setText(next === "quote" ? (scope ?? "") : "");
    setPrice(next === "quote" && credits ? String(credits) : "");
  }

  function run() {
    start(async () => {
      const result =
        mode === "quote"
          ? await quoteWebsiteProject(id, { scope: text, credits: Number(price) })
          : mode === "decline"
            ? await declineWebsiteProject(id, text)
            : await fulfilWebsiteProject(id, text);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(mode === "quote" ? "Quote saved - the customer was notified" : mode === "decline" ? "Declined" : "Marked as delivered");
      setMode(null);
      router.refresh();
    });
  }

  const quotable = status === "quote_requested" || status === "quoted";
  if (!quotable && status !== "paid") return null;

  return (
    <div className="flex flex-wrap gap-2">
      {quotable ? (
        <>
          <Button type="button" size="sm" onClick={() => open("quote")}>
            <Coins aria-hidden="true" />
            {status === "quoted" ? "Change quote" : "Set scope and price"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => open("decline")}>
            <X aria-hidden="true" />
            Decline
          </Button>
        </>
      ) : (
        <Button type="button" size="sm" onClick={() => open("fulfil")}>
          <Check aria-hidden="true" />
          Mark delivered
        </Button>
      )}

      <Dialog open={mode !== null} onOpenChange={(next) => !next && !pending && setMode(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{mode ? TITLE[mode] : ""}</DialogTitle>
            <DialogDescription>{mode ? HELP[mode] : ""}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={textId}>{mode === "quote" ? "Agreed scope" : mode === "decline" ? "Reason" : "What was delivered"}</Label>
              <Textarea id={textId} rows={mode === "quote" ? 6 : 3} value={text} onChange={(event) => setText(event.target.value)} maxLength={4000} disabled={pending} />
            </div>
            {mode === "quote" ? (
              <div className="grid gap-1.5">
                <Label htmlFor={priceId}>Price in credits</Label>
                <Input id={priceId} type="number" inputMode="numeric" min={1} max={MAX_WEBSITE_PROJECT_CREDITS} step={1} value={price} onChange={(event) => setPrice(event.target.value)} disabled={pending} />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={run}>
              {mode === "quote" ? "Save quote" : mode === "decline" ? "Decline" : "Mark delivered"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
