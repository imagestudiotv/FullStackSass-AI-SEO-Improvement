"use client";

import { ArrowRight, Bot, Check, Loader2, Plus, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_PROMPTS } from "@/lib/geo/shared";
import {
  addGeoPrompt,
  removeGeoPrompt,
  suggestGeoPrompts,
} from "@/lib/geo/actions";

/**
 * Choosing the questions we ask assistants, and seeing which assistants we
 * can ask.
 *
 * The reference lets a customer distribute a numeric prompt budget across
 * engines. That shape assumes every engine is reachable and that prompts cost
 * differently per engine; ours run the same question against every engine we
 * have a key for, so a per-engine budget would be a slider that changes
 * nothing. The honest equivalent is: pick the questions, see the engines.
 */

type Prompt = { id: string; prompt: string; isSuggested: boolean };

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
}: {
  websiteId: string;
  market: string | null;
  language: string | null;
  initialPrompts: Prompt[];
  engines: EngineView[];
}) {
  const router = useRouter();
  const [prompts, setPrompts] = useState(initialPrompts);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const liveEngines = engines.filter((engine) => engine.available);
  const atLimit = prompts.length >= MAX_PROMPTS;

  async function handleAdd(text: string) {
    const value = text.trim();
    if (!value) return;

    setBusy(true);
    const result = await addGeoPrompt(websiteId, value);
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setPrompts((current) => [
      ...current,
      { id: result.data.id, prompt: value, isSuggested: false },
    ]);
    setDraft("");
    setSuggestions((current) => current.filter((s) => s !== value));
  }

  async function handleRemove(id: string) {
    setPrompts((current) => current.filter((p) => p.id !== id));
    const result = await removeGeoPrompt(websiteId, id);
    if (!result.ok) toast.error(result.error);
  }

  async function handleSuggest() {
    setSuggesting(true);
    const result = await suggestGeoPrompts(websiteId);
    setSuggesting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    // Anything already tracked is dropped, so the list is only things worth
    // clicking.
    const existing = new Set(prompts.map((p) => p.prompt.toLowerCase()));
    setSuggestions(
      result.data.filter((s) => !existing.has(s.trim().toLowerCase())),
    );
  }

  return (
    <div className="space-y-4">
      {/* Market and language, carried over from the profile step. */}
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { label: "Primary market", value: market },
          { label: "Primary language", value: language },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {item.label}
            </p>
            <p className="mt-1 text-sm">
              {item.value ?? (
                <span className="text-muted-foreground italic">Not set</span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Which assistants we can actually ask. */}
      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <p className="flex items-center gap-2 font-medium">
            <Bot className="size-4 text-primary" aria-hidden="true" />
            Assistants we check
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {liveEngines.length === 0
              ? "None are configured on this deployment yet."
              : `Every question runs against ${liveEngines.length} of ${engines.length} assistants. The rest need an API key before they can be checked.`}
          </p>
        </div>
        <ul className="grid gap-2 px-4 py-3 sm:grid-cols-2">
          {engines.map((engine) => (
            <li
              key={engine.id}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${
                engine.available ? "" : "opacity-60"
              }`}
            >
              {engine.available ? (
                <Check
                  className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
              ) : (
                <X
                  className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {engine.name}
                  {engine.available ? null : (
                    <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                      not connected
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {engine.audience}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* The prompts themselves. */}
      <div className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="font-medium">Your questions</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Never name your business — these are what someone asks before they
              know you exist.
            </p>
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {prompts.length} of {MAX_PROMPTS}
          </span>
        </div>

        <div className="space-y-2 px-4 py-3">
          {prompts.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Nothing tracked yet. Write one below, or let us suggest some.
            </p>
          ) : (
            prompts.map((prompt) => (
              <div key={prompt.id} className="flex items-start gap-2">
                <span className="min-w-0 flex-1 text-sm">{prompt.prompt}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(prompt.id)}
                  className="mt-0.5 text-muted-foreground hover:text-destructive"
                  aria-label="Remove question"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            ))
          )}

          <div className="flex gap-2 pt-1">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Who is the best wedding photographer in Milan?"
              className="h-9"
              disabled={busy || atLimit}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                handleAdd(draft);
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-9 shrink-0"
              onClick={() => handleAdd(draft)}
              disabled={busy || atLimit || !draft.trim()}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add
            </Button>
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="mt-1"
            onClick={handleSuggest}
            disabled={suggesting || atLimit}
          >
            {suggesting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Thinking…
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" aria-hidden="true" />
                Suggest questions
              </>
            )}
          </Button>

          {suggestions.length > 0 ? (
            <ul className="mt-2 space-y-1.5 border-t pt-3">
              {suggestions.map((suggestion) => (
                <li key={suggestion} className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 text-sm text-muted-foreground">
                    {suggestion}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAdd(suggestion)}
                    disabled={busy || atLimit}
                    className="shrink-0 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          variant="ghost"
          onClick={() => router.push("/onboarding/profile")}
        >
          Back
        </Button>
        <Button
          className="h-11 rounded-full px-6"
          onClick={() => router.push("/onboarding/content")}
        >
          Next
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
