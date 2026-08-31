"use client";

import { Bot, Check, Loader2, Plus, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
}: {
  websiteId: string;
  overview: GeoOverview;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  function handleAdd(prompt: string) {
    startTransition(async () => {
      const result = await addGeoPrompt(websiteId, prompt);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDraft("");
      setSuggestions((prev) => prev.filter((s) => s !== prompt));
      toast.success("Question added");
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
      toast.success("Checking — results appear here in a few minutes");
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
        toast.info("You are already tracking the questions we would suggest");
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
              AI visibility
            </CardTitle>
            <CardDescription>
              Whether an AI assistant names your business when someone asks for
              a business like yours.
            </CardDescription>
          </div>
          {overview.prompts.length > 0 ? (
            <Button size="sm" onClick={handleRun} disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Check now
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {checked ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat
              label="Visibility score"
              value={overview.score}
              tone={scoreTone}
              hint="Weighted by position"
            />
            <Stat
              label="Questions naming you"
              value={`${overview.mentions}/${overview.total}`}
            />
            <Stat
              label="Average position"
              value={overview.averagePosition ?? "—"}
              hint={
                overview.averagePosition === null
                  ? "Not yet named"
                  : "Where you appear in the list"
              }
            />
            <Stat
              label="Last checked"
              value={
                overview.lastCheckedAt
                  ? new Date(overview.lastCheckedAt).toLocaleDateString()
                  : "—"
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
              placeholder="e.g. Which dentist in Utrecht is best for nervous patients?"
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
                Add
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
                Suggest
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Ask the way a customer would, and do not name your business — the
            point is to see whether you come up on your own.
          </p>
        </div>

        {suggestions.length > 0 ? (
          <div className="rounded-lg border border-dashed p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Suggested questions — click to track
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
            title="No questions tracked yet"
            description="Add the questions your customers would ask an AI assistant, then check whether your business gets named in the answer."
          />
        ) : (
          <ul className="divide-y rounded-lg border">
            {overview.prompts.map((p) => (
              <li key={p.id} className="flex items-start gap-3 p-3">
                <div className="mt-0.5 shrink-0">
                  {p.latest === null ? (
                    <Badge variant="secondary">Not checked</Badge>
                  ) : p.latest.mentioned ? (
                    <Badge className="gap-1">
                      <Check className="size-3" aria-hidden="true" />
                      {p.latest.position !== null
                        ? `#${p.latest.position}`
                        : "Named"}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Not named</Badge>
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
                  aria-label="Stop tracking this question"
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
              Named instead of you, most often
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
