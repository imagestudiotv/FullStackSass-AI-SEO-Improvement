"use client";

import { Globe, Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import type { Messages } from "@/lib/i18n/messages";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addCompetitor, removeCompetitor } from "@/lib/websites/actions";

/**
 * Competitors, on the dashboard.
 *
 * These had NO dashboard UI: they were only editable inside the signup
 * wizard's business-profile step, so once a customer finished signing up
 * there was no way to add or remove one ever again. Moving that step out of
 * signup — at the client's request — would have left them uneditable for
 * good, so the control moves here with it.
 *
 * Everything else that step collected (market, language, description, target
 * audience) is already on this page via WebsiteDetailClient, which is why only
 * this piece was lifted rather than the whole screen: two forms writing the
 * same columns would eventually disagree about what is stored.
 */

type Competitor = { domain: string; source: string | null };

export function CompetitorsCard({
  websiteId,
  competitors: initial,
  t,
}: {
  websiteId: string;
  competitors: Competitor[];
  /** Shared words used on several screens. */
  t: Messages["app"]["common"];
}) {
  const [rivals, setRivals] = useState(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    const domain = draft.trim();
    if (!domain) return;

    setBusy(true);
    const result = await addCompetitor(websiteId, domain);
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setRivals((current) => [...current, { domain, source: "manual" }]);
    setDraft("");
  }

  async function handleRemove(domain: string) {
    // Optimistic, with the row restored if the server disagrees — a silent
    // failure here looks like the × did nothing.
    const previous = rivals;
    setRivals((current) => current.filter((r) => r.domain !== domain));
    const result = await removeCompetitor(websiteId, domain);
    if (!result.ok) {
      setRivals(previous);
      toast.error(result.error);
    }
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <p className="font-medium">{t.competitors}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Who else shows up when buyers search your space. We use these to find
          content gaps and the terms worth going after.
        </p>
      </div>

      <div className="p-4">
        {rivals.length === 0 ? (
          /*
            Says WHY there are none, not just that there are none.

            We suggest competitors during analysis, so an empty list here
            usually means the extractor could not infer the niche — a
            JavaScript-rendered homepage with no server-side text gives it
            nothing to work from, which is the case on justinso.net. "None
            yet" alone reads as a feature that has not run; this reads as a
            result, and points at the one thing the customer can do about it.
          */
          <p className="text-sm text-muted-foreground">
            We did not find any from your site. Add the rivals you know of and
            we will use them to find content gaps.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {rivals.map((rival) => (
              <span
                key={rival.domain}
                className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <Globe
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{rival.domain}</span>
                {/*
                  Ours or theirs. A suggestion the customer has not vetted
                  should not look like a decision they made.
                */}
                {rival.source !== "manual" ? (
                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    suggested
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleRemove(rival.domain)}
                  aria-label={`Remove ${rival.domain}`}
                  className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="competitor.com"
            className="h-9"
            disabled={busy}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              handleAdd();
            }}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0"
            onClick={handleAdd}
            disabled={busy || !draft.trim()}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-3.5" aria-hidden="true" />
            )}
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
