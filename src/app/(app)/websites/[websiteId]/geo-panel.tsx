"use client";

import { Bot, Check, Loader2, Plus, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Messages } from "@/lib/i18n/messages";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, Stat } from "@/components/ui/states";
import { Trend } from "@/components/ui/trend";
import {
  addGeoPrompt,
  removeGeoPrompt,
  runGeoCheck,
  suggestGeoPrompts,
} from "@/lib/geo/actions";
import type { GeoOverview } from "@/lib/geo/shared";

/**
 * Visibility inside AI assistants.
 *
 * The product question this answers: when someone asks an assistant for a
 * business like this one, does this business get named? Customers are used to
 * thinking in rankings, so the panel leads with a score but always shows the
 * evidence behind it — the actual questions, and the sentence where the brand
 * appeared.
 *
 * Nothing here is inferred. A question that has not been checked says so
 * rather than showing a zero, because "not checked" and "not mentioned" mean
 * opposite things to someone deciding what to fix.
 */
export function GeoPanel({
  websiteId,
  overview,
  t,
  tCommon,
}: {
  websiteId: string;
  overview: GeoOverview;
  /** This screen's copy, already in the reader's language. */
  t: Messages["app"]["geo"];
  /** Shared words used on several screens. */
  tCommon: Messages["app"]["common"];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  /**
   * How many prompts had a result when this render began.
   *
   * runGeoCheck only QUEUES the job — each question is two model calls, so
   * answers land over the following minutes. Without something watching for
   * them the panel keeps saying "Not checked" until the customer reloads by
   * hand, which is exactly what someone who just pressed a button will not
   * think to do.
   */
  const checkedCount = overview.prompts.filter((p) => p.latest !== null).length;
  const [waitingFrom, setWaitingFrom] = useState<number | null>(null);

  /**
   * Derived, not stored. Clearing the baseline from inside the effect would be
   * a setState during render, which the React Compiler rightly rejects — and
   * the comparison alone already answers "are we still waiting", so no second
   * source of truth is needed.
   */
  const awaitingResults =
    waitingFrom !== null && checkedCount <= waitingFrom;

  useEffect(() => {
    if (!awaitingResults) return;

    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [awaitingResults, router]);

  /**
   * Re-read on arrival. Next's client Router Cache would otherwise serve the
   * copy rendered before a check finished, showing "Not checked" on questions
   * that have since been answered.
   */
  useEffect(() => {
    router.refresh();
  }, [router]);

  function handleAdd(prompt: string) {
    startTransition(async () => {
      const result = await addGeoPrompt(websiteId, prompt);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDraft("");
      setSuggestions((prev) => prev.filter((s) => s !== prompt));
      toast.success(t.questionAdded);
      router.refresh();
    });
  }

  function handleRemove(promptId: string) {
    startTransition(async () => {
      const result = await removeGeoPrompt(websiteId, promptId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleRun() {
    startTransition(async () => {
      const result = await runGeoCheck(websiteId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Queued, not finished: the job asks every question, which takes a
      // while. Promising results "now" would be a lie the customer notices.
      setWaitingFrom(checkedCount);
      toast.success(t.checkQueued);
    });
  }

  async function handleSuggest() {
    setSuggesting(true);
    try {
      const result = await suggestGeoPrompts(websiteId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const existing = new Set(overview.prompts.map((p) => p.prompt));
      const fresh = result.data.filter((s) => !existing.has(s));
      if (fresh.length === 0) {
        toast.info(t.alreadyTracking);
        return;
      }
      setSuggestions(fresh);
    } finally {
      setSuggesting(false);
    }
  }

  const scoreTone =
    overview.score >= 60
      ? "positive"
      : overview.score >= 30
        ? "warning"
        : "critical";

  const checked = overview.total > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-4" aria-hidden="true" />
              {t.aiVisibility}
            </CardTitle>
            <CardDescription>{t.aiVisibilityHelp}</CardDescription>
          </div>
          {overview.prompts.length > 0 ? (
            <Button
              size="sm"
              onClick={handleRun}
              disabled={pending || awaitingResults}
            >
              {pending || awaitingResults ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {/*
                The queue returns in milliseconds; the answers take minutes.
                Saying "Checking" for that whole window is the honest label —
                "Check now" reappearing straight away reads as a click that
                did nothing.
              */}
              {awaitingResults ? t.checking : t.checkNow}
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {checked ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat
              label={t.visibilityScore}
              value={overview.score}
              tone={scoreTone}
              hint={t.weightedByPosition}
              trend={
                <Trend
                  current={overview.score}
                  previous={overview.previousScore}
                  label={t.vsLastCheck}
                />
              }
            />
            <Stat
              label={t.questionsNamingYou}
              value={`${overview.mentions}/${overview.total}`}
            />
            <Stat
              label={t.averagePosition}
              value={overview.averagePosition ?? "-"}
              hint={
                overview.averagePosition === null
                  ? t.notYetNamed
                  : t.whereYouAppear
              }
            />
            <Stat
              label={t.lastChecked}
              value={
                overview.lastCheckedAt
                  ? new Date(overview.lastCheckedAt).toLocaleDateString()
                  : "-"
              }
            />
          </div>
        ) : null}

        {/* Add a question. */}
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t.questionPlaceholder}
              disabled={pending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.trim()) {
                  e.preventDefault();
                  handleAdd(draft);
                }
              }}
            />
            <div className="flex gap-2">
              <Button
                onClick={() => handleAdd(draft)}
                disabled={pending || !draft.trim()}
              >
                <Plus className="size-4" />
                {t.add}
              </Button>
              <Button
                variant="outline"
                onClick={handleSuggest}
                disabled={suggesting || pending}
              >
                {suggesting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {t.suggest}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t.askHelp}</p>
        </div>

        {suggestions.length > 0 ? (
          <div className="rounded-lg border border-dashed p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {t.suggestedQuestions}
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleAdd(s)}
                  disabled={pending}
                  className="rounded-full border px-3 py-1 text-left text-xs transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Tracked questions and their latest result. */}
        {overview.prompts.length === 0 ? (
          <EmptyState
            icon={Bot}
            title={t.noQuestions}
            description={t.noQuestionsHelp}
            /*
              The action belongs here, not only in the row above the list.

              This is the state a customer arrives in from the launch
              checklist - "Generate prompts & start AI tracking" - and an
              empty panel with nothing to press is how a step becomes a dead
              end. The Suggest control does sit further up the page, but a
              customer who has just been sent here is looking at the empty
              box, not above it.
            */
            action={
              <Button
                variant="outline"
                onClick={handleSuggest}
                disabled={suggesting || pending}
              >
                {suggesting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-4" aria-hidden="true" />
                )}
                {t.suggest}
              </Button>
            }
          />
        ) : (
          <ul className="divide-y rounded-xl border">
            {overview.prompts.map((p) => (
              <li key={p.id} className="flex items-start gap-3 p-3">
                <div className="mt-0.5 shrink-0">
                  {p.latest === null ? (
                    <Badge variant="secondary">{t.notChecked}</Badge>
                  ) : p.latest.mentioned ? (
                    <Badge className="gap-1">
                      <Check className="size-3" aria-hidden="true" />
                      {p.latest.position !== null
                        ? `#${p.latest.position}`
                        : "Named"}
                    </Badge>
                  ) : (
                    <Badge variant="outline">{t.notNamed}</Badge>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm">{p.prompt}</p>
                  {p.latest?.excerpt ? (
                    // The evidence. A score the customer cannot verify is a
                    // score they are right not to trust.
                    <p className="mt-1 border-l-2 pl-2 text-xs text-muted-foreground italic">
                      {p.latest.excerpt}
                    </p>
                  ) : null}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(p.id)}
                  disabled={pending}
                  aria-label={t.stopTracking}
                >
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {overview.topCompetitors.length > 0 ? (
          <div>
            <p className="mb-2 text-sm font-medium">
              {tCommon.namedInstead}
            </p>
            <div className="flex flex-wrap gap-2">
              {overview.topCompetitors.map((c) => (
                <Badge key={c.name} variant="secondary">
                  {c.name}
                  <span className="ml-1 text-muted-foreground">×{c.count}</span>
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
