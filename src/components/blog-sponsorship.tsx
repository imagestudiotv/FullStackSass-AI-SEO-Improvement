"use client";

import { ArrowLeft, ArrowUpRight, CircleCheck, Info, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { startBlogSponsorship } from "@/lib/blog/sponsorship-actions";

const BLACK = "bg-foreground text-background hover:bg-foreground/90 dark:bg-foreground dark:text-background";

/**
 * "Get Featured in This Article" (client, 2026-10-08, after babylovegrowth's
 * article pages; design okPInmTvoyUs.jpg): a pill on the right of the
 * article's author row opens a panel under it with the offer, word for word
 * as the client's design has it - $99, one time, no subscription, per article
 * placement, subject to editorial approval.
 *
 * "Get Featured for $99" then asks three short things in the same panel -
 * the buyer's email, website, and what the mention should say (agreed with
 * the client: the placement needs them) - and goes on to Stripe
 * (lib/blog/sponsorship-actions.ts). Where Stripe is not set up, the panel
 * points to the contact page instead of a form that cannot be paid.
 *
 * `cancelled`: the buyer came back from Stripe without paying, so the panel
 * opens again, saying nothing was charged.
 */
export function BlogSponsorship({ slug, enabled, cancelled = false }: { slug: string; enabled: boolean; cancelled?: boolean }) {
  const [open, setOpen] = useState(cancelled);
  const [step, setStep] = useState<"offer" | "details">("offer");
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [pending, start] = useTransition();
  /** The request id for the details last sent: the same details again reuse it, so nothing is paid twice. */
  const request = useRef<{ id: string; details: string } | null>(null);
  const busy = pending || redirecting;

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
        const result = await startBlogSponsorship({ id, slug, ...details });
        if ("url" in result) {
          setRedirecting(true);
          window.location.assign(result.url);
          return;
        }
        setError(result.error);
      } catch {
        setError("We could not reach the server. Check your connection and try again.");
      }
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) {
          setStep("offer");
          setError(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 rounded-full px-4 font-medium text-foreground">
          Get Featured in This Article
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={12}
        collisionPadding={16}
        aria-labelledby="featured-title"
        // The box itself takes focus, not its first button: read from the heading, no ring on a mouse click.
        tabIndex={-1}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
        // As wide as the article column it opens over (max-w-3xl, less its padding).
        className="max-h-(--radix-popover-content-available-height) w-[min(46rem,calc(100vw-2rem))] overflow-y-auto p-5 sm:p-6"
      >
        <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <Sparkles className="size-3.5" aria-hidden="true" />
          Sponsored feature opportunity
        </p>
        <h2 id="featured-title" className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
          Get Your Website Featured in This Article.
        </h2>
        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Reach readers already interested in this topic. Showcase your business with a relevant sponsored mention and
          website link inside this article.
        </p>

        {cancelled && step === "offer" ? (
          <p role="status" className="mt-4 flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            Payment cancelled - you were not charged. You can start again whenever you like.
          </p>
        ) : null}

        <div className="mt-5 rounded-xl border bg-muted/40 p-4 sm:p-5">
          {step === "offer" ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">One-time payment</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums">$99</p>
                </div>
                <div className="space-y-2 text-sm sm:text-right">
                  <p className="flex items-center gap-1.5 sm:justify-end">
                    <CircleCheck className="size-4 text-success" aria-hidden="true" />
                    No subscription
                  </p>
                  <p className="text-muted-foreground">Per article placement</p>
                </div>
              </div>
              <Button type="button" className={`mt-4 h-12 w-full rounded-full text-base font-semibold ${BLACK}`} onClick={() => setStep("details")}>
                Get Featured for $99
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Button>
              <p className="mt-3 text-center text-sm text-muted-foreground">Subject to editorial approval</p>
            </>
          ) : enabled ? (
            <form onSubmit={submit} className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">Tell us what to feature</p>
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
                  Back
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="featured-email">Your email</Label>
                  <Input id="featured-email" name="email" type="email" autoComplete="email" required maxLength={254} disabled={busy} className="bg-background" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="featured-website">Your website</Label>
                  <Input
                    id="featured-website"
                    name="website"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="yourwebsite.com"
                    required
                    maxLength={2000}
                    disabled={busy}
                    className="bg-background"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="featured-message">What should the mention say about your business?</Label>
                <textarea
                  id="featured-message"
                  name="message"
                  rows={3}
                  required
                  maxLength={1000}
                  disabled={busy}
                  placeholder="A sentence or two: what you offer, and who it is for."
                  className="flex w-full min-w-0 rounded-lg border border-input bg-background px-2.5 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                />
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={busy} className={`h-12 w-full rounded-full text-base font-semibold ${BLACK}`}>
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    Opening secure payment…
                  </>
                ) : (
                  <>
                    Continue to payment - $99
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </>
                )}
              </Button>
              <p className="text-center text-sm text-muted-foreground">Secure payment by Stripe. Subject to editorial approval.</p>
            </form>
          ) : (
            <div className="space-y-3 text-sm">
              <p>Online payment is not available right now.</p>
              <p>
                <Link href="/contact" className="font-medium underline underline-offset-4">
                  Contact us
                </Link>{" "}
                and we will arrange your placement.
              </p>
              <button
                type="button"
                onClick={() => setStep("offer")}
                className="inline-flex items-center gap-1 rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                Back
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
