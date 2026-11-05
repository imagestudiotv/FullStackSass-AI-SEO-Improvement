"use client";

import { ArrowLeft, ArrowUpRight, CircleCheck, Info, Loader2, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SponsorshipPanelCopy } from "@/lib/blog/sponsorship-copy";
import { startBlogSponsorship } from "@/lib/blog/sponsorship-actions";
import type { Locale } from "@/lib/i18n/config";

const BLACK = "bg-foreground text-background hover:bg-foreground/90 dark:bg-foreground dark:text-background";
/**
 * The panel's full-width pay buttons. Their words may wrap: "Continuer vers le
 * paiement - 99 €" is wider than the button on most phones, and a label that
 * cannot wrap spills out of both ends of it.
 */
const WIDE = "h-auto min-h-12 w-full rounded-full py-2 text-center text-base leading-snug font-semibold whitespace-normal";

/**
 * "Get Featured in This Article" (client, 2026-10-08, after babylovegrowth's
 * article pages; design okPInmTvoyUs.jpg): a pill on the right of the
 * article's author row opens a panel with the offer, word for word as the
 * client's design has it - €99 (US dollars until 2026-10-16), one time, no
 * subscription, per article placement, subject to editorial approval.
 *
 * "Get Featured for €99" then asks three short things in the same panel -
 * the buyer's email, website, and what the mention should say (agreed with
 * the client: the placement needs them) - and goes on to Stripe
 * (lib/blog/sponsorship-actions.ts). Where Stripe is not set up, the panel
 * points to the contact page instead of a form that cannot be paid.
 *
 * On every language's articles (client, 2026-10-15), in the article's
 * language: the page passes this panel's words (`copy`, from
 * lib/blog/sponsorship-copy.ts) and its language, which the server uses for
 * its answers, Stripe's page and the way back.
 *
 * `cancelled`: the buyer came back from Stripe without paying, so the panel
 * opens again, saying nothing was charged.
 *
 * CENTRED, WITH THE ACTION ALWAYS ON SCREEN (client, 2026-11-05: the panel,
 * anchored to the pill, opened above it and was cut off above its pay button,
 * so you had to scroll around inside it to find out there was one). A native
 * modal <dialog>, in the browser's top layer: it never leaves the viewport,
 * and only its middle scrolls, so the pay button stays in view at any height.
 * The browser also traps focus, closes on Escape and gives focus back to the
 * pill. Native rather than a Radix dialog: this is on every article, and it
 * replaces the Radix popover, so articles load less, not more. Its contents
 * exist only while it is open, as the popover's did, so the article's HTML
 * does not change.
 */
export function BlogSponsorship({
  slug,
  locale,
  enabled,
  copy,
  contactHref,
  cancelled = false,
}: {
  slug: string;
  locale: Locale;
  enabled: boolean;
  copy: SponsorshipPanelCopy;
  /** The contact page in the article's language. */
  contactHref: string;
  cancelled?: boolean;
}) {
  const [open, setOpen] = useState(cancelled);
  const [step, setStep] = useState<"offer" | "details">("offer");
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [pending, start] = useTransition();
  /** The request id for the details last sent: the same details again reuse it, so nothing is paid twice. */
  const request = useRef<{ id: string; details: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const email = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const formId = useId();
  const busy = pending || redirecting;

  function close() {
    if (busy) return;
    setOpen(false);
    setStep("offer");
    setError(null);
  }

  /* The dialog follows `open`. While it is open the page behind it does not scroll or shift. */
  useEffect(() => {
    const element = dialog.current;
    if (!element || !open) return;
    if (!element.open) element.showModal();
    const { body, documentElement } = document;
    const before = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      element.close();
      body.style.overflow = before.overflow;
      body.style.paddingRight = before.paddingRight;
    };
  }, [open]);

  /*
    Focus: the box itself on the offer, so it reads from the heading with no
    ring on a mouse click, then the first field. The button that was pressed
    has just gone, and focus must not fall out of the panel with it.
  */
  useEffect(() => {
    if (!open) return;
    if (step === "details" && enabled) email.current?.focus();
    else dialog.current?.focus();
  }, [open, step, enabled]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const details = {
      email: String(form.get("email") ?? ""),
      website: String(form.get("website") ?? ""),
      message: String(form.get("message") ?? ""),
    };
    const key = JSON.stringify(details);
    if (request.current?.details !== key) request.current = { id: crypto.randomUUID(), details: key };
    const id = request.current.id;

    setError(null);
    start(async () => {
      try {
        const result = await startBlogSponsorship({ id, slug, locale, ...details });
        if ("url" in result) {
          setRedirecting(true);
          window.location.assign(result.url);
          return;
        }
        setError(result.error);
      } catch {
        setError(copy.network);
      }
    });
  }

  return (
    <>
      {/* Wraps rather than spilling out of the pill if a language's words are long for a phone. */}
      <Button
        type="button"
        variant="outline"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="h-auto min-h-10 rounded-full px-4 py-2 text-left leading-snug font-medium whitespace-normal text-foreground"
      >
        {copy.trigger}
        <ArrowUpRight className="size-4" aria-hidden="true" />
      </Button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        // Inside the article, whose language it may not state: it declares its own.
        lang={locale}
        tabIndex={-1}
        onCancel={(event) => {
          // Escape: closed through the state, or left open while the payment is starting.
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          // The panel's contents cover the whole box, so only the backdrop is the dialog itself.
          if (event.target === event.currentTarget) close();
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(46rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl bg-popover p-0 text-base text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none backdrop:bg-black/50 open:flex"
      >
        {open ? (
          <>
            <button
              type="button"
              onClick={close}
              disabled={busy}
              aria-label={copy.close}
              className="absolute top-3 right-3 z-10 inline-flex size-9 items-center justify-center rounded-full bg-popover text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <X className="size-4" aria-hidden="true" />
            </button>

            {/* Only this part scrolls, when the window is too short for all of it. */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
              <p className="flex items-center gap-2 pr-8 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <Sparkles className="size-3.5" aria-hidden="true" />
                {copy.eyebrow}
              </p>
              <h2 id={titleId} className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
                {copy.title}
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground sm:text-base">{copy.intro}</p>

              {cancelled && step === "offer" ? (
                <p role="status" className="mt-4 flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                  <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {copy.cancelled}
                </p>
              ) : null}

              <div className="mt-5 rounded-xl border bg-muted/40 p-4 sm:p-5">
                {step === "offer" ? (
                  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                    <div>
                      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{copy.oneTime}</p>
                      <p className="mt-1 text-3xl font-semibold tabular-nums">{copy.price}</p>
                    </div>
                    <div className="space-y-2 text-sm sm:text-right">
                      <p className="flex items-center gap-1.5 sm:justify-end">
                        <CircleCheck className="size-4 text-success" aria-hidden="true" />
                        {copy.noSubscription}
                      </p>
                      <p className="text-muted-foreground">{copy.perArticle}</p>
                    </div>
                  </div>
                ) : enabled ? (
                  <form id={formId} onSubmit={submit} className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{copy.detailsTitle}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setStep("offer");
                          setError(null);
                        }}
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      >
                        <ArrowLeft className="size-3.5" aria-hidden="true" />
                        {copy.back}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="featured-email">{copy.email}</Label>
                        <Input ref={email} id="featured-email" name="email" type="email" autoComplete="email" required maxLength={254} disabled={busy} className="bg-background" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="featured-website">{copy.website}</Label>
                        <Input
                          id="featured-website"
                          name="website"
                          inputMode="url"
                          autoComplete="url"
                          placeholder={copy.websitePlaceholder}
                          required
                          maxLength={2000}
                          disabled={busy}
                          className="bg-background"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="featured-message">{copy.message}</Label>
                      <textarea
                        id="featured-message"
                        name="message"
                        rows={3}
                        required
                        maxLength={1000}
                        disabled={busy}
                        placeholder={copy.messagePlaceholder}
                        className="flex w-full min-w-0 rounded-lg border border-input bg-background px-2.5 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                      />
                    </div>
                  </form>
                ) : (
                  <div className="space-y-3 text-sm">
                    <p>{copy.unavailable}</p>
                    <p>
                      <Link href={contactHref} className="font-medium underline underline-offset-4">
                        {copy.contactLink}
                      </Link>{" "}
                      {copy.contactRest}
                    </p>
                    <button
                      type="button"
                      onClick={() => setStep("offer")}
                      className="inline-flex items-center gap-1 rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ArrowLeft className="size-3.5" aria-hidden="true" />
                      {copy.back}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* The action, outside the scrolling part: always in view. */}
            {step === "offer" ? (
              <div className="shrink-0 border-t bg-popover px-5 py-4 sm:px-6">
                <Button type="button" className={`${WIDE} ${BLACK}`} onClick={() => setStep("details")}>
                  {copy.start.replace("{price}", copy.price)}
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Button>
                <p className="mt-2 text-center text-sm text-muted-foreground">{copy.approval}</p>
              </div>
            ) : enabled ? (
              <div className="shrink-0 border-t bg-popover px-5 py-4 sm:px-6">
                {error ? (
                  <p role="alert" className="mb-2 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" form={formId} disabled={busy} className={`${WIDE} ${BLACK}`}>
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      {copy.opening}
                    </>
                  ) : (
                    <>
                      {copy.continue.replace("{price}", copy.price)}
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </>
                  )}
                </Button>
                <p className="mt-2 text-center text-sm text-muted-foreground">{copy.secure}</p>
              </div>
            ) : null}
          </>
        ) : null}
      </dialog>
    </>
  );
}
