"use client";

import {
  ArrowRight,
  Check,
  FileText,
  Globe,
  Languages,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GeoPromptView } from "@/lib/geo/shared";
import {
  addGeoPrompt,
  ensureGeoPrompts,
  removeGeoPrompt,
  suggestGeoPrompts,
} from "@/lib/geo/actions";

/**
 * Step four: the questions we ask assistants on the customer's behalf.
 *
 * THE LIST ARRIVES FULL AND SELECTED. That is the whole point of this screen's
 * design, and it comes straight from the client:
 *
 *   "This was the most confusing part for me when firstly I joined this
 *    platforms. So it will be nice to having it simple that we generate
 *    prompts without people click suggest question … we want to be able to
 *    cancel prompts and also having them selected from first glance."
 *
 * So the page fills itself on arrival via ensureGeoPrompts — a plan's worth of
 * questions, already saved and already ticked — and the customer's job is to
 * remove the ones they do not want, ask for more, or type their own. Nobody
 * has to discover a button before the step does anything.
 *
 * WHY REMOVING IS A DELETE, NOT A TICKBOX: the checkbox in the design reads as
 * "included", and everything shown is included. A prompt the customer does not
 * want is removed with the × beside it. Two ways to exclude the same question
 * — untick it, or delete it — would be two states meaning one thing, and the
 * count at the top could then disagree with the list under it.
 */

type EngineView = {
  id: string;
  name: string;
  audience: string;
  available: boolean;
};

export function VisibilityStep({
  websiteId,
  market,
  language,
  initialPrompts,
  engines,
  /** How many this website's plan may track: 20 on Grow, 50 on Scale. */
  allowance,
}: {
  websiteId: string;
  market: string | null;
  language: string | null;
  initialPrompts: GeoPromptView[];
  engines: EngineView[];
  allowance: number;
}) {
  const router = useRouter();
  const [prompts, setPrompts] = useState(initialPrompts);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  /** True while the first fill is running, so the list can say why it is empty. */
  const [filling, setFilling] = useState(initialPrompts.length === 0);
  const [adding, setAdding] = useState(false);

  const liveEngines = engines.filter((engine) => engine.available);
  const atLimit = prompts.length >= allowance;

  /**
   * Fill the list on arrival, once.
   *
   * The ref guards against React's development double-render and against a
   * re-render while the request is in flight; the action is idempotent too, so
   * this is belt and braces rather than the only protection.
   */
  const filled = useRef(false);
  useEffect(() => {
    if (filled.current || initialPrompts.length > 0) {
      setFilling(false);
      return;
    }
    filled.current = true;

    let cancelled = false;
    void (async () => {
      const result = await ensureGeoPrompts(websiteId);
      if (cancelled) return;
      setFilling(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPrompts(result.data);
    })();

    return () => {
      cancelled = true;
    };
  }, [websiteId, initialPrompts.length]);

  async function handleAdd(text: string) {
    const value = text.trim();
    if (!value) return;

    setAdding(true);
    const result = await addGeoPrompt(websiteId, value);
    setAdding(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setPrompts((current) => [
      ...current,
      {
        id: result.data.id,
        prompt: value,
        isSuggested: false,
        active: true,
        latest: null,
      },
    ]);
    setDraft("");
  }

  async function handleRemove(id: string) {
    // Optimistic: the row goes immediately and the server catches up. A
    // failure is reported rather than silently reinstating the row, which
    // would look like the × did nothing.
    const previous = prompts;
    setPrompts((current) => current.filter((p) => p.id !== id));
    const result = await removeGeoPrompt(websiteId, id);
    if (!result.ok) {
      setPrompts(previous);
      toast.error(result.error);
    }
  }

  /**
   * Ask for more, and SAVE them straight away.
   *
   * The old version put suggestions in a holding area the customer then had to
   * click one by one. The client asked for the opposite: "They can click
   * suggest question and it will generate also more options and people can
   * cancel the prompts they don't like." So new questions join the list
   * already included, and unwanted ones are removed the same way as any other.
   */
  async function handleSuggestMore() {
    if (atLimit) {
      toast.error(`Your plan tracks up to ${allowance} questions.`);
      return;
    }

    setSuggesting(true);
    const room = allowance - prompts.length;
    const result = await suggestGeoPrompts(
      websiteId,
      Math.min(room, 6),
      prompts.map((p) => p.prompt),
    );

    if (!result.ok) {
      setSuggesting(false);
      toast.error(result.error);
      return;
    }

    /*
      Saved one at a time through the same action the manual field uses, so
      the plan limit and the duplicate check are enforced in exactly one
      place. Duplicates are dropped quietly: the model occasionally returns a
      rephrasing despite being told not to, and an error toast for that would
      blame the customer for something they did not do.
    */
    const seen = new Set(prompts.map((p) => p.prompt.trim().toLowerCase()));
    const added: GeoPromptView[] = [];
    for (const text of result.data.slice(0, room)) {
      if (seen.has(text.trim().toLowerCase())) continue;
      const saved = await addGeoPrompt(websiteId, text);
      if (!saved.ok) continue;
      seen.add(text.trim().toLowerCase());
      added.push({
        id: saved.data.id,
        prompt: text,
        isSuggested: true,
        active: true,
        latest: null,
      });
    }

    setSuggesting(false);
    if (added.length === 0) {
      toast.info("No new questions this time — try adding one of your own.");
      return;
    }
    setPrompts((current) => [...current, ...added]);
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
        Activate RepGet
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        See how AI talks about your brand
      </h1>
      <p className="mt-2 text-muted-foreground">
        Track the questions customers ask AI before they discover your company.
      </p>

      {/*
        The summary strip from the design: market, language, and how many
        questions the plan includes. Editing market or language means going
        back a step, which is where those fields live — one place to change
        them rather than two that can disagree.
      */}
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border bg-card px-5 py-4 text-sm">
        <span className="flex items-center gap-2">
          <Globe
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          {market ?? "Global"}
        </span>
        <span
          className="hidden h-4 w-px bg-border sm:block"
          aria-hidden="true"
        />
        <span className="flex items-center gap-2">
          <Languages
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          {language ?? "English"}
        </span>
        <span
          className="hidden h-4 w-px bg-border sm:block"
          aria-hidden="true"
        />
        <span className="flex items-center gap-2">
          <FileText
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          {allowance} prompts included
        </span>
        <button
          type="button"
          onClick={() => router.push("/onboarding/setup")}
          className="ml-auto font-medium text-primary hover:underline"
        >
          Edit
        </button>
      </div>

      {/* Which assistants we can actually ask. */}
      <div className="mt-4 rounded-2xl border bg-card p-5">
        <p className="font-semibold">Tracking on</p>
        {liveEngines.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No assistants are configured on this deployment yet. Questions are
            saved and will be checked as soon as one is connected.
          </p>
        ) : (
          <>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {liveEngines.slice(0, 3).map((engine) => (
                <span
                  key={engine.id}
                  className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {engine.name}
                  </span>
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15"
                    aria-hidden="true"
                  >
                    <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                  </span>
                </span>
              ))}
            </div>
            {/*
              The design's "Connect more AI sources later". Ours states the
              real number rather than implying an action that does not exist:
              the remaining engines need an API key on the deployment, which
              is not something the customer can do from here.
            */}
            {liveEngines.length > 3 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                + {liveEngines.length - 3} more checked on every run
              </p>
            ) : null}
          </>
        )}
      </div>

      {/* The question list. */}
      <div className="mt-4 rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold">Questions worth tracking</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We have suggested these from your website and market. Remove any
              you do not want to track.
            </p>
          </div>
          <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {prompts.length} / {allowance} selected
          </span>
        </div>

        {filling ? (
          /*
            The first fill takes a few seconds. Saying so beats an empty box,
            which is exactly the "is this broken?" moment the client described.
          */
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-sm text-muted-foreground">
            <Loader2
              className="size-4 shrink-0 animate-spin"
              aria-hidden="true"
            />
            Writing questions your customers would ask…
          </div>
        ) : prompts.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No questions yet. Add one below, or ask for suggestions.
          </div>
        ) : (
          /*
            Scrolls within itself past a certain height: fifty questions on
            Scale would otherwise push the Continue button far off the screen.
          */
          <ul className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
            {prompts.map((prompt) => (
              <li
                key={prompt.id}
                className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5"
              >
                {/*
                  A tick, not a checkbox: everything listed IS tracked, so
                  this states the fact rather than offering a second way to
                  exclude something the × already handles.
                */}
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary"
                  aria-hidden="true"
                >
                  <Check className="size-3.5 text-primary-foreground" />
                </span>
                <span className="min-w-0 flex-1 text-sm">{prompt.prompt}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(prompt.id)}
                  aria-label={`Remove "${prompt.prompt}"`}
                  className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add your own, and ask for more. */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
          <div className="flex min-w-0 flex-1 gap-2">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Add a question your customers would ask"
              className="h-10 rounded-xl"
              disabled={adding || atLimit}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                handleAdd(draft);
              }}
            />
            <Button
              variant="outline"
              className="h-10 shrink-0 rounded-xl"
              onClick={() => handleAdd(draft)}
              disabled={adding || atLimit || !draft.trim()}
              aria-label="Add question"
            >
              {adding ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>

          <Button
            variant="ghost"
            className="h-10 shrink-0"
            onClick={handleSuggestMore}
            disabled={suggesting || atLimit || filling}
          >
            {suggesting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Writing…
              </>
            ) : (
              <>
                <RefreshCw className="size-4" aria-hidden="true" />
                Suggest more
              </>
            )}
          </Button>
        </div>

        {atLimit ? (
          <p className="mt-3 text-xs text-muted-foreground">
            You have filled your plan&apos;s {allowance} questions. Remove one
            to add another.
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => router.push("/onboarding/setup")}
        >
          Back
        </Button>
        <Button
          className="h-12 rounded-full px-6 text-base font-semibold"
          disabled={busy || prompts.length === 0}
          onClick={() => {
            setBusy(true);
            router.push("/onboarding/content");
          }}
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Saving&hellip;
            </>
          ) : (
            <>
              Start tracking {prompts.length}
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
