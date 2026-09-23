"use client";

/*
  eslint-disable @next/next/no-img-element --
  These two images are on the CUSTOMER's domain, which is not knowable ahead
  of time. next/image needs every remote host listed in remotePatterns, so
  optimising them would mean either a wildcard (which turns our optimiser into
  an open image proxy) or a config change per signup. A plain <img> on a
  preview card that is visible for a few seconds is the right trade.
*/

import {
  ArrowRight,
  Check,
  Globe,
  ImageIcon,
  Languages,
  Loader2,
  RotateCw,
  Tag,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { getMessages, type Messages } from "@/lib/i18n/messages";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addWebsite } from "@/lib/websites/actions";
import { previewWebsite, type WebsitePreview } from "@/lib/websites/preview";

/**
 * Step one: the website, and what we can tell about it immediately.
 *
 * The design puts a preview card beside the field — favicon, cover image,
 * platform, region, category — filled in as soon as an address is entered. The
 * full analysis produces richer versions of most of that, but it runs as a
 * background job over tens of seconds, so the card would sit empty at exactly
 * the moment the design shows it populated.
 *
 * So the flow is two steps with one click: a fast look at the homepage to fill
 * the card (one fetch, roughly a second or two), then Continue to actually add
 * the site and start the real analysis. That also means the customer confirms
 * we found the right website before anything is written, which is worth having
 * on its own — a typo in a domain is the most common mistake on this screen and
 * the preview makes it obvious.
 *
 * A failed preview never blocks the form. The site can still be added, because
 * the analysis job will try again on its own schedule where a retry costs the
 * customer nothing.
 */
export function WebsiteStep({
  t = getMessages("en").app.onboarding,
}: {
  /** This step's copy, defaulting to English. */
  t?: Messages["app"]["onboarding"];
} = {}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [preview, setPreview] = useState<WebsitePreview | null>(null);
  const [looking, setLooking] = useState(false);
  const [pending, setPending] = useState(false);

  /** Looks at the site and fills the card. Never writes anything. */
  async function handleLook(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A pasted address routinely carries a trailing space.
    const url = value.trim();
    if (!url) return;

    setLooking(true);
    setPreview(null);
    const result = await previewWebsite(url);
    setLooking(false);

    if (!result.ok) {
      /**
       * A warning rather than an error: the address may be perfectly valid
       * and simply blocking our fetch, and the next button still works.
       */
      toast.warning(`${result.error}. You can still continue.`);
      return;
    }
    setPreview(result.data);
  }

  /** Adds the site for real and moves on. */
  async function handleContinue() {
    const url = preview?.url ?? value.trim();
    if (!url) return;

    setPending(true);
    const result = await addWebsite(url);

    if (!result.ok) {
      setPending(false);
      toast.error(result.error);
      return;
    }

    /**
     * Straight to the plan, carrying the site just created.
     *
     * The business profile used to sit between these two. It moved to the
     * dashboard's launch checklist at the client's request, so signup is now
     * website → plan and analysis fills the profile in while they pay.
     *
     * The id matters: without it the next screen falls back to whichever site
     * the switcher last remembered, so a customer adding their second website
     * would be shown the first one's details.
     */
    router.push(`/onboarding/plan?site=${result.data.id}`);
  }

  const hasLooked = preview !== null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
      <div>
        <p className="text-sm font-semibold tracking-wide text-primary">
          STEP 01 <span className="text-muted-foreground">/ 02</span>
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t.whatsYourWebsite}
        </h1>
        <p className="mt-3 text-muted-foreground">
          Enter your website and we will work out what your business does, who
          it is for, and what is worth writing about.
        </p>

        <form onSubmit={handleLook} className="mt-8">
          <Label htmlFor="site-url" className="sr-only">
            {t.websiteAddress}
          </Label>
          <div className="relative">
            <Globe
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="site-url"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                // The card belongs to the address that produced it.
                setPreview(null);
              }}
              placeholder={t.websitePlaceholder}
              autoComplete="url"
              inputMode="url"
              className="h-14 rounded-full pr-14 pl-11 text-base"
              required
            />
            <button
              type="submit"
              disabled={looking || !value.trim()}
              aria-label={t.lookUpWebsite}
              className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-foreground text-background transition-opacity disabled:opacity-40"
            >
              {looking ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowRight className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </form>

        {/*
          The platform row from the design. Only shown once something was
          actually detected: "Platform: unknown" tells the customer nothing and
          takes up the space where a real finding would go.
        */}
        {preview?.platform ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl border p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-sm font-semibold text-background">
              {preview.platform.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{preview.platform} detected</p>
              <p className="text-sm text-muted-foreground">
                {preview.platform === "WordPress"
                  ? "Our plugin connects your blog in about three clicks."
                  : "We can publish straight to it once you are set up."}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
              {t.detected}
              <Check className="size-3" aria-hidden="true" />
            </span>
          </div>
        ) : null}

        {/*
          Near-black rather than the brand orange, as drawn. The orange is the
          marketing site's colour; inside setup it is competing with the arrow
          button in the field directly above, and the design makes the primary
          action the darker of the two.
        */}
        <Button
          onClick={handleContinue}
          disabled={pending || looking || !value.trim()}
          className="mt-6 h-14 w-full rounded-full bg-foreground text-base font-semibold text-background hover:bg-foreground/90"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t.addingWebsite}
            </>
          ) : (
            <>
              {t.continueLabel}
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          )}
        </Button>

        {/*
          Kept, and only while it is useful.
          
          The design has no line here, but the arrow inside the field is not
          self-evident — someone who does not press it never sees the preview
          the whole screen is built around. It goes as soon as they have
          looked, so the card does the explaining from then on.
        */}
        {!hasLooked && !looking ? (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Press the arrow to check your website first, or continue straight
            on.
          </p>
        ) : null}
      </div>

      <div>
        <WebsiteCard preview={preview} looking={looking} t={t} />

        {/*
          The handwritten note from the design. Decorative, so it is hidden
          from assistive technology — it says nothing the page has not already
          said, and reading out a line of marketing copy between a preview card
          and the next control is noise.
        */}
        <p
          className="mt-6 hidden max-w-[16rem] -rotate-2 pl-6 text-sm leading-snug text-muted-foreground/70 xl:ml-auto xl:block"
          style={{ fontFamily: "ui-rounded, 'Segoe UI', cursive" }}
          aria-hidden="true"
        >
          <span className="mr-2 text-muted-foreground/40">&mdash;</span>
          Extraordinary businesses deserve greater visibility.
        </p>
      </div>
    </div>
  );
}

/**
 * The browser-chrome card from the design.
 *
 * Three states, because an empty frame with no explanation reads as something
 * that failed to load: nothing entered yet, looking, and found.
 */
function WebsiteCard({
  preview,
  looking,
  t,
}: {
  preview: WebsitePreview | null;
  looking: boolean;
  t: Messages["app"]["onboarding"];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_24px_60px_-30px_rgba(0,0,0,0.25)]">
      {/* Browser chrome: the traffic lights and the address bar. */}
      <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-red-400" />
          <span className="size-2.5 rounded-full bg-amber-400" />
          <span className="size-2.5 rounded-full bg-emerald-400" />
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-background px-3 py-1.5 text-xs text-muted-foreground">
          <Globe className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {preview?.domain ?? "your-website.com"}
          </span>
        </span>
        <RotateCw
          className={`size-3.5 shrink-0 text-muted-foreground ${
            looking ? "animate-spin" : ""
          }`}
          aria-hidden="true"
        />
      </div>

      {/*
        The cover. A tinted block when there is no og:image rather than a
        placeholder photograph, which would be a picture of someone else's
        business sitting above this customer's name.
      */}
      <div className="relative aspect-[16/6] bg-gradient-to-br from-primary/20 via-muted to-blue-500/10">
        {preview?.coverUrl ? (
          <img
            src={preview.coverUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <ImageIcon
              className="size-8 text-muted-foreground/40"
              aria-hidden="true"
            />
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start gap-4">
          {/*
            A circle straddling the edge of the cover, as drawn — round rather
            than a rounded square, and lifted by half its own height so it sits
            on the seam instead of below it. A thick card-coloured ring gives
            the cut-out the design shows.
          */}
          <span className="-mt-12 flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-[5px] border-card bg-card shadow-sm">
            {preview?.faviconUrl ? (
              <img
                src={preview.faviconUrl}
                alt=""
                className="size-full rounded-full object-contain p-2"
              />
            ) : (
              <Globe
                className="size-7 text-muted-foreground/40"
                aria-hidden="true"
              />
            )}
          </span>

          {/*
            Nudged down so the name lines up with the middle of the circle
            rather than with its top, which is where the design sets it.
          */}
          <div className="min-w-0 flex-1 pt-1">
            {looking ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                {t.readingWebsite}
              </p>
            ) : preview ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
                {t.websiteFound}
                <Check className="size-3" aria-hidden="true" />
              </span>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t.enterAddressToSee}
              </p>
            )}

            <p className="mt-2 truncate text-lg font-semibold">
              {preview?.name ?? "Your business"}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {preview?.domain ?? "your-website.com"}
            </p>
          </div>
        </div>

        {/*
          The detail row. Each item appears only when it was actually found —
          the design shows three, and showing a dash where a value should be
          makes the card look broken rather than incomplete.
        */}
        {preview ? (
          <>
            {/*
              The divided detail row from the design: platform, region,
              category. Each is rendered only when we actually have it, and
              the dividers come from the items themselves so a missing one
              does not leave a stray line.

              Region and category come from the FULL analysis, not from this
              fast look — they need a model reading the page, not a regex over
              the markup. Rather than show an empty slot, the row says where
              they are coming from, which is true and sets the expectation for
              the next step.
            */}
            <div className="mt-4 flex flex-wrap items-center gap-y-2 border-t pt-4 text-sm text-muted-foreground">
              {preview.platform ? (
                <span className="flex items-center gap-1.5 pr-4">
                  <Check
                    className="size-3.5 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                  {preview.platform}
                </span>
              ) : null}
              {preview.language ? (
                <span className="flex items-center gap-1.5 border-l pr-4 pl-4 first:border-l-0 first:pl-0">
                  <Languages className="size-3.5 shrink-0" aria-hidden="true" />
                  {preview.language.toUpperCase()}
                </span>
              ) : null}
              <span className="flex items-center gap-1.5 border-l pl-4 first:border-l-0 first:pl-0">
                <Tag className="size-3.5 shrink-0" aria-hidden="true" />
                {t.regionNext}
              </span>
            </div>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              {t.weWillUseWebsite}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
