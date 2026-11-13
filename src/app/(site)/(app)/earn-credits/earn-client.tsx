"use client";

import { ArrowUpRight, Check, CheckCircle2, Clapperboard, Clock3, Copy, Lightbulb, Link2, Megaphone, MessageCircle, Send, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition, type ComponentType } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { enterReferralCode, submitEarnClaim } from "@/lib/earn/actions";
import { EARN_KINDS, EARN_WAYS, type EarnClaim, type EarnKind } from "@/lib/earn/ways";
import { format } from "@/lib/i18n/format";
import type { EarnCopy } from "@/lib/i18n/earn";
import { cn } from "@/lib/utils";

import { copyText } from "./copy-text";

/**
 * The interactive parts of the Earn Credits page (client design,
 * 2026-11-02): copying the referral code and link, sending a claim for one of
 * the other ways to earn, and entering someone else's code. The page around
 * them is rendered on the server (page.tsx); sharing is the kit (share-kit.tsx).
 */

/** "Copy" that says "Copied" for a moment. */
function useFlag(): [boolean, () => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return;
    const timer = window.setTimeout(() => setOn(false), 2000);
    return () => window.clearTimeout(timer);
  }, [on]);
  return [on, () => setOn(true)];
}

export function ReferralShare({ code, link, t }: { code: string; link: string; t: EarnCopy }) {
  const [codeCopied, flagCode] = useFlag();
  const [linkCopied, flagLink] = useFlag();
  // What the browser refused to copy, held selected in a field for a manual copy.
  const [manual, setManual] = useState<string | null>(null);

  async function copy(text: string, done: () => void, success: string) {
    if (await copyText(text)) {
      setManual(null);
      done();
      toast.success(success);
    } else {
      setManual(text);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 px-4 pt-3 text-xs font-medium text-muted-foreground">
        <span>{t.codeLabel}</span>
        <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          {t.ready}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-1 pb-3">
        <strong className="font-mono text-xl tracking-[0.12em] text-foreground">{code}</strong>
        <Button type="button" variant="outline" size="sm" onClick={() => copy(code, flagCode, t.codeCopied)}>
          {codeCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {t.copyCode}
        </Button>
      </div>
      <div className="flex flex-col gap-2 border-t px-3 py-2.5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
          <Link2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <Input
            value={link}
            readOnly
            aria-label={t.copyLink}
            onFocus={(event) => event.currentTarget.select()}
            className="h-8 border-0 bg-transparent px-0 font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" className="flex-1 sm:flex-none" onClick={() => copy(link, flagLink, t.linkCopied)}>
            {linkCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {t.copyLink}
          </Button>
        </div>
      </div>
      {manual ? (
        <div className="border-t px-4 py-3">
          <p role="alert" className="text-xs text-destructive">
            {t.copyFailed}
          </p>
          <Input
            key={manual}
            value={manual}
            readOnly
            autoFocus
            aria-label={t.copyFailed}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-2 h-8 font-mono text-xs"
          />
        </div>
      ) : null}
    </div>
  );
}

const WAY_ICONS: Record<EarnKind, ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>> = {
  story: MessageCircle,
  post: Megaphone,
  tutorial: Clapperboard,
  feedback: Lightbulb,
};

/** The four ways, each a card that opens its form; what was sent shows on the card. */
export function EarnWays({ claims, t }: { claims: EarnClaim[]; t: EarnCopy }) {
  const [open, setOpen] = useState<EarnKind | null>(null);
  const byKind = new Map(claims.map((claim) => [claim.kind, claim]));

  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {EARN_KINDS.map((kind) => {
          const way = t.ways[kind];
          const claim = byKind.get(kind);
          const Icon = WAY_ICONS[kind];
          const locked = claim?.status === "pending" || claim?.status === "approved";
          return (
            <li key={kind}>
              <button
                type="button"
                onClick={() => setOpen(kind)}
                disabled={locked}
                className={cn(
                  "flex h-full w-full flex-col rounded-xl border bg-card p-4 text-left transition-[box-shadow,transform,border-color]",
                  locked ? "cursor-default" : "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-bold text-primary tabular-nums">+{EARN_WAYS[kind].credits}</span>
                </span>
                <span className="mt-4 text-sm font-semibold text-foreground">{way.title}</span>
                <span className="mt-1.5 flex-1 text-xs leading-5 text-muted-foreground">{way.body}</span>
                <span className="mt-4 flex items-center justify-between gap-2 border-t pt-3 text-xs font-medium">
                  <ClaimState claim={claim} cta={way.cta} t={t} />
                </span>
              </button>
              {claim?.status === "declined" && claim.reviewNote ? (
                <p className="mt-1.5 px-1 text-xs text-muted-foreground">{format(t.statusDeclined, { reason: claim.reviewNote })}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {open ? <ClaimDialog kind={open} t={t} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function ClaimState({ claim, cta, t }: { claim: EarnClaim | undefined; cta: string; t: EarnCopy }) {
  if (claim?.status === "pending") {
    return (
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Clock3 className="size-3.5" aria-hidden="true" />
        {t.statusPending}
      </span>
    );
  }
  if (claim?.status === "approved") {
    return (
      <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
        {format(t.statusApproved, { credits: claim.credits })}
      </span>
    );
  }
  return (
    <>
      <span className="flex items-center gap-1.5 text-primary">
        {claim?.status === "declined" ? <XCircle className="size-3.5" aria-hidden="true" /> : null}
        {cta}
      </span>
      <ArrowUpRight className="size-3.5 text-primary" aria-hidden="true" />
    </>
  );
}

function ClaimDialog({ kind, t, onClose }: { kind: EarnKind; t: EarnCopy; onClose: () => void }) {
  const router = useRouter();
  const way = EARN_WAYS[kind];
  const copy = t.ways[kind];
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const linkId = useId();
  const messageId = useId();
  const errorId = useId();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      try {
        const result = await submitEarnClaim({ kind, link, message });
        if (!result.ok) {
          setError(t.errors[result.error] ?? t.errors.generic);
          return;
        }
        toast.success(t.sent);
        onClose();
        router.refresh();
      } catch {
        setError(t.errors.generic);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3 pr-6">
              {copy.title}
              <span className="text-base font-bold text-primary tabular-nums">+{way.credits}</span>
            </DialogTitle>
            <DialogDescription>{copy.body}</DialogDescription>
          </DialogHeader>
          <p className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-xs leading-5 text-foreground/80">{copy.details}</p>
          <div className="grid gap-1.5">
            <Label htmlFor={linkId}>{way.needsLink ? t.linkLabel : t.linkOptional}</Label>
            <Input
              id={linkId}
              type="url"
              inputMode="url"
              placeholder="https://"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              required={way.needsLink}
              disabled={pending}
              aria-describedby={error ? errorId : undefined}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={messageId}>{copy.messageLabel}</Label>
            <Textarea
              id={messageId}
              rows={kind === "story" || kind === "feedback" ? 5 : 3}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              minLength={way.minMessage}
              maxLength={4000}
              required
              disabled={pending}
              aria-describedby={error ? errorId : undefined}
            />
          </div>
          {error ? (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              <Send aria-hidden="true" />
              {pending ? t.sending : t.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** "Were you recommended by someone?" - shown only while a code can still be applied. */
export function EnterReferralCode({ t }: { t: EarnCopy }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputId = useId();
  const errorId = useId();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      try {
        const result = await enterReferralCode(code);
        if (!result.ok) {
          setError(t.codeErrors[result.error] ?? t.codeErrors.generic);
          return;
        }
        toast.success(t.applied);
        router.refresh();
      } catch {
        setError(t.codeErrors.generic);
      }
    });
  }

  return (
    <form onSubmit={submit} className="rounded-xl border bg-card p-5" aria-labelledby={`${inputId}-title`}>
      <h2 id={`${inputId}-title`} className="font-semibold">
        {t.haveCode}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.haveCodeBody}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Label htmlFor={inputId} className="sr-only">
          {t.codePlaceholder}
        </Label>
        <Input
          id={inputId}
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder={t.codePlaceholder}
          autoComplete="off"
          spellCheck={false}
          maxLength={32}
          required
          disabled={pending}
          className="font-mono tracking-widest sm:max-w-xs"
          aria-describedby={error ? errorId : undefined}
        />
        <Button type="submit" disabled={pending || !code.trim()}>
          {t.apply}
        </Button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
