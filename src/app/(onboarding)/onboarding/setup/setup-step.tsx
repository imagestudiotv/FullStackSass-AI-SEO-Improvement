"use client";

import {
  ArrowRight,
  Check,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addCompetitor,
  removeCompetitor,
  updateWebsiteDetails,
} from "@/lib/websites/actions";
import { SUPPORTED_LANGUAGES } from "@/lib/websites/languages";
import { MARKETS, MARKET_GLOBAL } from "@/lib/websites/markets";

/**
 * Steps 2, 3 and 4 of the reference, on one screen.
 *
 * The client asked for exactly this: "I suggest on step 2, to having this 3
 * options all in one: Target Market & Language, Business Description, and
 * Competitors, instead of redirecting directly to choose a package", and
 * "there will be 3 buttons under each of this steps, so once we click one of
 * this button we go straight to step 5".
 *
 * So all three panels are on screen at once and EACH has its own continue
 * button, any of which moves on. That is not three ways of doing the same
 * thing by accident — it is the point. Everything here is pre-filled by
 * analysis, so a customer who is happy with what we extracted should be able
 * to leave from wherever their eye stopped rather than scrolling to the bottom
 * to find the one real button.
 *
 * WHY EVERY BUTTON SAVES EVERY FIELD: a customer may edit the market, scroll
 * down and continue from the competitors panel. If each button only wrote its
 * own panel, that market edit would be silently dropped — and with three exit
 * points, leaving from a panel other than the one you edited is the normal
 * path rather than an edge case. Competitors are written as they are added and
 * removed, so they are already saved by the time any button runs.
 */

type Competitor = { domain: string; source: string | null };

export type SetupWebsite = {
  id: string;
  domain: string;
  brandName: string | null;
  country: string | null;
  language: string | null;
  description: string | null;
  targetAudience: string | null;
  status: string;
};

/** Where continuing from any panel leads. */
const NEXT_HREF = "/onboarding/plan";

/**
 * Audience entries live in one text column, so the chips are joined and split
 * on a separator. A comma is what people type anyway, and it keeps the stored
 * value readable to the model, which reads this string directly.
 */
const AUDIENCE_SEPARATOR = ", ";

function splitAudience(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** One of the three panels: a numbered header, content, and its own button. */
function Panel({
  step,
  title,
  description,
  children,
  onContinue,
  busy,
  /** Label on the panel's own button, which the design words per panel. */
  action,
}: {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
  onContinue: () => void;
  busy: boolean;
  action: string;
}) {
  return (
    <section className="rounded-2xl border bg-card p-6 sm:p-8">
      <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
        Step {String(step).padStart(2, "0")}{" "}
        <span className="text-muted-foreground">/ 03</span>
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>

      <div className="mt-6">{children}</div>

      {/*
        Each panel's own continue, as the client asked. Full width and dark,
        matching the reference's button and the one on step 1.
      */}
      <Button
        onClick={onContinue}
        disabled={busy}
        className="mt-6 h-12 w-full rounded-full bg-foreground text-base font-semibold text-background hover:bg-foreground/90"
      >
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Saving&hellip;
          </>
        ) : (
          <>
            {action}
            <ArrowRight className="size-4" aria-hidden="true" />
          </>
        )}
      </Button>
    </section>
  );
}

export function SetupStep({
  website,
  competitors: initialCompetitors,
  analysing,
}: {
  website: SetupWebsite;
  competitors: Competitor[];
  analysing: boolean;
}) {
  const router = useRouter();

  const [market, setMarket] = useState(website.country ?? MARKET_GLOBAL);
  const [language, setLanguage] = useState(website.language ?? "English");
  const [description, setDescription] = useState(website.description ?? "");
  const [audience, setAudience] = useState(() =>
    splitAudience(website.targetAudience),
  );
  const [newAudience, setNewAudience] = useState("");
  const [rivals, setRivals] = useState(initialCompetitors);
  const [newRival, setNewRival] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  /**
   * Re-read on arrival.
   *
   * Analysis runs as a background job, so this screen is routinely rendered
   * before the fields it shows have been written. Without this refresh Next's
   * client Router Cache keeps serving that empty copy, and the customer is
   * asked to describe a business we have in fact already described.
   */
  useEffect(() => {
    router.refresh();
  }, [router]);

  /**
   * Take the server's values when — and only when — they CHANGE.
   *
   * This screen is routinely rendered before analysis has written anything, so
   * the fields start empty and fill in when the refresh above lands. useState
   * reads its initial argument once, so something has to carry the new values
   * across.
   *
   * Done by adjusting state during render rather than in an effect. An effect
   * that calls setState runs a second render pass every time, and React flags
   * it for exactly that reason; comparing against the last value we saw does
   * the same job in one pass, and is the pattern React documents for "adjust
   * state when a prop changes".
   *
   * Comparing against the PREVIOUS SERVER VALUE, not against current state, is
   * what protects the customer's typing: a re-render carrying the same server
   * value leaves their edit alone, and only a genuinely new value from analysis
   * overwrites it.
   */
  const [lastSeen, setLastSeen] = useState({
    country: website.country,
    language: website.language,
    description: website.description,
    targetAudience: website.targetAudience,
  });

  if (
    website.country !== lastSeen.country ||
    website.language !== lastSeen.language ||
    website.description !== lastSeen.description ||
    website.targetAudience !== lastSeen.targetAudience
  ) {
    setLastSeen({
      country: website.country,
      language: website.language,
      description: website.description,
      targetAudience: website.targetAudience,
    });
    // Null means "analysis has not filled this in", which is not an answer to
    // overwrite the customer's own with.
    if (website.country !== null && website.country !== lastSeen.country) {
      setMarket(website.country);
    }
    if (website.language !== null && website.language !== lastSeen.language) {
      setLanguage(website.language);
    }
    if (
      website.description !== null &&
      website.description !== lastSeen.description
    ) {
      setDescription(website.description);
    }
    if (
      website.targetAudience !== null &&
      website.targetAudience !== lastSeen.targetAudience
    ) {
      setAudience(splitAudience(website.targetAudience));
    }
  }

  /** Writes everything the three panels own, then moves on. */
  async function saveAndContinue(from: string) {
    setBusy(from);

    const result = await updateWebsiteDetails(website.id, {
      // Global is stored as null; see lib/websites/markets.ts.
      country: market === MARKET_GLOBAL ? null : market,
      language,
      description: description.trim() || null,
      targetAudience: audience.join(AUDIENCE_SEPARATOR) || null,
    });

    if (!result.ok) {
      setBusy(null);
      toast.error(result.error);
      return;
    }

    router.push(NEXT_HREF);
  }

  function addAudience() {
    const value = newAudience.trim();
    if (!value) return;
    // Case-insensitive, because "Dentists" and "dentists" are one answer.
    if (audience.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setNewAudience("");
      return;
    }
    setAudience((current) => [...current, value]);
    setNewAudience("");
  }

  async function handleAddRival() {
    const domain = newRival.trim();
    if (!domain) return;
    setBusy("rival");
    const result = await addCompetitor(website.id, domain);
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setRivals((current) => [...current, { domain, source: "manual" }]);
    setNewRival("");
  }

  async function handleRemoveRival(domain: string) {
    setRivals((current) => current.filter((r) => r.domain !== domain));
    const result = await removeCompetitor(website.id, domain);
    if (!result.ok) toast.error(result.error);
  }

  const stillWorking = analysing || website.status === "crawling";

  return (
    <div className="space-y-5">
      {/*
        Analysis is still running, so the panels below may be part empty.
        Saying so beats showing blank fields that read as a failure — and the
        fields stay editable meanwhile, because someone who wants to type their
        own answer should not have to wait for ours.
      */}
      {stillWorking ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card px-5 py-4 text-sm">
          <Loader2
            className="size-4 shrink-0 animate-spin"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            We are still reading {website.domain}. These fields fill in as we
            work them out — you can type over anything we get wrong.
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0"
            onClick={() => router.refresh()}
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      ) : null}

      {/* ---- Panel 1: target market and language ---- */}
      <Panel
        step={1}
        title="Target market & language"
        description="The market you want to rank in, and the language your content is written in."
        onContinue={() => saveAndContinue("market")}
        busy={busy === "market"}
        action="Continue"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="market"
              className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Target market
            </label>
            <Select value={market} onValueChange={setMarket}>
              <SelectTrigger
                id="market"
                className="mt-2 h-12 w-full rounded-xl"
              >
                <SelectValue placeholder="Choose a market" />
              </SelectTrigger>
              <SelectContent>
                {MARKETS.map((option) => (
                  <SelectItem key={option.label} value={option.value}>
                    <span className="mr-2" aria-hidden="true">
                      {option.flag}
                    </span>
                    {option.label}
                  </SelectItem>
                ))}
                {/*
                  An extracted country outside our list is kept rather than
                  dropped. Without this the picker would silently reset a
                  correct answer — analysis reads the real world, and the world
                  has more countries than this menu.
                */}
                {market &&
                !MARKETS.some((option) => option.value === market) ? (
                  <SelectItem value={market}>{market}</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label
              htmlFor="language"
              className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Primary language
            </label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger
                id="language"
                className="mt-2 h-12 w-full rounded-xl"
              >
                <SelectValue placeholder="Choose a language" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
                {language &&
                !SUPPORTED_LANGUAGES.some(
                  (option) => option.value === language,
                ) ? (
                  <SelectItem value={language}>{language}</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
            {/*
              The reference shows "Potential audience 65 million" under the
              language. We have no audience-size data and will not invent a
              figure, so this says what the choice actually controls.
            */}
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check
                className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              Every article we write will be in this language.
            </p>
          </div>
        </div>
      </Panel>

      {/* ---- Panel 2: business description and audience ---- */}
      <Panel
        step={2}
        title="Describe your business"
        description="This becomes the brief behind every article we write for you."
        onContinue={() => saveAndContinue("description")}
        busy={busy === "description"}
        action="Continue"
      >
        <label
          htmlFor="description"
          className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Business description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={6}
          placeholder="What the business does, who it serves, and what makes it different."
          className="mt-2 w-full resize-y rounded-xl border bg-background px-4 py-3 text-sm"
        />

        <div className="mt-5">
          <label
            htmlFor="audience"
            className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            Target audience
          </label>

          {/* The chips from the design, each removable. */}
          {audience.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {audience.map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-1.5 rounded-full bg-primary/10 py-1.5 pr-2 pl-3 text-sm text-foreground"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() =>
                      setAudience((current) =>
                        current.filter((entry) => entry !== item),
                      )
                    }
                    aria-label={`Remove ${item}`}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-2 flex gap-2">
            <Input
              id="audience"
              value={newAudience}
              onChange={(event) => setNewAudience(event.target.value)}
              placeholder="Add a target audience, e.g. lawyers in Florida"
              className="h-11 rounded-xl"
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                // Otherwise Enter submits the panel instead of adding a chip.
                event.preventDefault();
                addAudience();
              }}
            />
            <Button
              variant="outline"
              className="h-11 shrink-0 rounded-xl"
              onClick={addAudience}
              disabled={!newAudience.trim()}
              aria-label="Add target audience"
            >
              <Plus className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </Panel>

      {/* ---- Panel 3: competitors ---- */}
      <Panel
        step={3}
        title="Select your competitors"
        description="We have already picked a few for you — add or remove any."
        onContinue={() => saveAndContinue("competitors")}
        busy={busy === "competitors"}
        action="Use these competitors"
      >
        {/* The explainer box from the design. */}
        <div className="rounded-xl border-l-4 border-l-primary/40 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <p>Adding competitors helps us:</p>
          <ul className="mt-2 space-y-1">
            <li>
              &bull;{" "}
              <span className="font-medium text-foreground">
                Find trending topics
              </span>{" "}
              and content gaps to stay ahead.
            </li>
            <li>
              &bull;{" "}
              <span className="font-medium text-foreground">
                Identify industry keywords
              </span>{" "}
              to understand your domain.
            </li>
          </ul>
        </div>

        {rivals.length > 0 ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {rivals.map((rival) => (
              <span
                key={rival.domain}
                className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 text-sm"
              >
                <Globe
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{rival.domain}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveRival(rival.domain)}
                  aria-label={`Remove ${rival.domain}`}
                  className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground italic">
            {stillWorking
              ? "Still looking for competitors…"
              : "None found yet. Add any you know of."}
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <Input
            value={newRival}
            onChange={(event) => setNewRival(event.target.value)}
            placeholder="type competitor domain here, e.g. competitor.com"
            className="h-11 rounded-xl"
            disabled={busy === "rival"}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              handleAddRival();
            }}
          />
          <Button
            variant="outline"
            className="h-11 shrink-0 rounded-xl"
            onClick={handleAddRival}
            disabled={busy === "rival" || !newRival.trim()}
            aria-label="Add competitor"
          >
            {busy === "rival" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Not sure? Keep our picks — you can change them any time in settings.
        </p>
      </Panel>
    </div>
  );
}
