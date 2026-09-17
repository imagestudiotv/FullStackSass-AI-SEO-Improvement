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
export function WebsiteStep() {
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
     * Straight to billing, carrying the site that was just created.
     *
     * Billing is step two, and a new website has no plan whether it is the
     * first or the fifth — so this is the same path for both. The id matters:
     * without it billing falls back to whichever site the switcher last
     * remembered, and a customer adding their second website could subscribe
     * the first one twice.
     */
    router.push(`/billing?site=${result.data.id}`);
  }

  const hasLooked = preview !== null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
      <div>
        <p className="text-sm font-semibold tracking-wide text-primary">
          STEP 01 <span className="text-muted-foreground">/ 05</span>
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          What&apos;s your website?
        </h1>
        <p className="mt-3 text-muted-foreground">
          Enter your website and we will work out what your business does, who
          it is for, and what is worth writing about.
        </p>

        <form onSubmit={handleLook} className="mt-8">
          <Label htmlFor="site-url" className="sr-only">
            Your website address
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
              placeholder="yourbusiness.com"
              autoComplete="url"
              inputMode="url"
              className="h-14 rounded-full pr-14 pl-11 text-base"
              required
            />
            <button
              type="submit"
              disabled={looking || !value.trim()}
              aria-label="Look up this website"
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
              <p className="text-sm font-medium">
                {preview.platform} detected
              </p>
              <p className="text-sm text-muted-foreground">
                {preview.platform === "WordPress"
                  ? "Our plugin connects your blog in about three clicks."
                  : "We can publish straight to it once you are set up."}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
              Detected
              <Check className="size-3" aria-hidden="true" />
            </span>
          </div>
        ) : null}

        <Button
          onClick={handleContinue}
          disabled={pending || looking || !value.trim()}
          className="mt-6 h-14 w-full rounded-full text-base font-semibold"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Adding your website…
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          )}
        </Button>

        {!hasLooked && !looking ? (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Press the arrow to check your website first, or continue straight
            on.
          </p>
        ) : null}
      </div>

      {/* The preview card. */}
      <WebsiteCard preview={preview} looking={looking} />
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
}: {
  preview: WebsitePreview | null;
  looking: boolean;
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
      <div className="relative aspect-[16/7] bg-gradient-to-br from-primary/20 via-muted to-blue-500/10">
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
        <div className="flex items-start gap-3">
          {/* Favicon, overlapping the cover as in the design. */}
          <span className="-mt-10 flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-card bg-card shadow-sm">
            {preview?.faviconUrl ? (
              <img
                src={preview.faviconUrl}
                alt=""
                className="size-full object-contain p-1.5"
              />
            ) : (
              <Globe
                className="size-6 text-muted-foreground/50"
                aria-hidden="true"
              />
            )}
          </span>

          <div className="min-w-0 flex-1">
            {looking ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Reading your website…
              </p>
            ) : preview ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
                Website found
                <Check className="size-3" aria-hidden="true" />
              </span>
            ) : (
              <p className="text-sm text-muted-foreground">
                Enter your address to see what we find.
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
                Region and category next
              </span>
            </div>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              We will use your website to understand your business.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
