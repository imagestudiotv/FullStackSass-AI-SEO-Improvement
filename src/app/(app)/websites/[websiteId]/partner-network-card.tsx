"use client";

import { ArrowDown, ArrowLeftRight, ArrowUp, HelpCircle, Info, Loader2, Lock, Plus, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addTarget,
  moveTarget,
  removeTarget,
  setParticipation,
  setMinSourceRank,
  setTargetPriority,
  type PartnerNetwork,
} from "@/lib/backlinks/network-settings";
import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

const PRIORITY_STYLE: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

/**
 * The Partner Network settings card (the client's screenshot): participation,
 * the authority preference, and the pages this website wants links to.
 *
 * Every control persists through a server action scoped to this website
 * (lib/backlinks/network-settings.ts). Nothing here matches partners or
 * spends credits - the RepGet team places links, reading these preferences.
 */
export function PartnerNetworkCard({
  websiteId,
  network,
  credits,
  canEdit,
  t,
}: {
  websiteId: string;
  network: PartnerNetwork;
  /** The workspace's credits; null for a guest, who does not see them. */
  credits: { available: number; reserved: number } | null;
  canEdit: boolean;
  t: Messages["app"]["partnerNetwork"];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("");

  function run<T>(action: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>, success: string, after?: (data: T) => void) {
    start(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        setStatus(result.error);
        return;
      }
      toast.success(success);
      setStatus(success);
      after?.(result.data);
      router.refresh();
    });
  }

  const on = network.participating;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ArrowLeftRight className="size-5" aria-hidden="true" />
          </span>
          <div>
            <CardTitle className="text-lg">{t.title}</CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="sr-only" role="status" aria-live="polite">
          {status}
        </p>
        <div className="grid grid-cols-1 overflow-hidden rounded-xl border md:grid-cols-3 md:divide-x">
          {/* 1. Participation */}
          <section className="min-w-0 space-y-4 border-b p-4 md:border-b-0" aria-labelledby="pn-participation">
            <div>
              <h3 id="pn-participation" className="flex items-center gap-1.5 font-semibold">
                {t.participationTitle}
                <HelpCircle className="size-4 text-muted-foreground" aria-hidden="true" />
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.participationHelp}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium" id="pn-toggle-label">
                {on ? t.enabled : t.disabled}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-labelledby="pn-participation pn-toggle-label"
                disabled={!canEdit || pending}
                onClick={() => run(() => setParticipation(websiteId, !on), on ? t.turnedOff : t.turnedOn)}
                className={cn(
                  "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60",
                  on ? "bg-primary" : "bg-muted-foreground/30",
                )}
              >
                <span
                  className={cn(
                    "inline-block size-5 rounded-full bg-background shadow transition-transform",
                    on ? "translate-x-6" : "translate-x-1",
                  )}
                />
              </button>
              {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" /> : null}
            </div>
            <div className="flex gap-3 rounded-lg bg-muted/50 p-3 text-sm">
              <Users className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-medium">{t.whatTitle}</p>
                <p className="mt-1 text-muted-foreground">{t.whatBody}</p>
              </div>
            </div>
            {!on ? <p className="text-sm text-muted-foreground">{t.offNote}</p> : null}
            {network.inReview > 0 ? <p className="text-sm">{format(t.inReview, { n: network.inReview })}</p> : null}
            {credits ? (
              <p className="text-sm font-medium tabular-nums">
                {format(t.creditsLine, { available: credits.available, reserved: credits.reserved })}
              </p>
            ) : null}
          </section>

          {/* 2. Minimum authority, on DataForSEO Rank - a real, enforced preference, or an honest state. */}
          <section className="min-w-0 space-y-3 border-b p-4 md:border-b-0" aria-labelledby="pn-rating">
            <div>
              <h3 id="pn-rating" className="flex items-center gap-1.5 font-semibold">
                {t.ratingTitle}
                {network.authority !== "available" ? <Lock className="size-4 text-muted-foreground" aria-hidden="true" /> : null}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.ratingHelp}</p>
            </div>
            {network.authority === "available" ? (
              <MinimumAuthority
                value={network.minSourceRank}
                max={network.maxMinSourceRank}
                canEdit={canEdit}
                pending={pending}
                t={t}
                onSave={(value) => run(() => setMinSourceRank(websiteId, value), t.ratingSaved)}
              />
            ) : (
              <div className="flex gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p>{network.authority === "no_access" ? t.ratingNoAccess : t.ratingUnconfigured}</p>
              </div>
            )}
          </section>

          {/* 3. Target pages */}
          <section className="min-w-0 space-y-3 p-4" aria-labelledby="pn-targets">
            <div>
              <h3 id="pn-targets" className="flex items-center gap-1.5 font-semibold">
                {t.targetsTitle}
                <HelpCircle className="size-4 text-muted-foreground" aria-hidden="true" />
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.targetsHelp}</p>
            </div>

            {network.targets.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noTargets}</p>
            ) : (
              <ol className="divide-y rounded-lg border">
                {network.targets.map((target, index) => {
                  let path = target.url;
                  try {
                    const parsed = new URL(target.url);
                    path = `${parsed.pathname}${parsed.search}`;
                  } catch {
                    // Keep the full address.
                  }
                  return (
                    <li key={target.id} className="flex items-center gap-2 px-2 py-2">
                      <div className="flex flex-col">
                        <button
                          type="button"
                          className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
                          aria-label={`${t.moveUp}: ${path}`}
                          disabled={!canEdit || pending || index === 0}
                          onClick={() => run(() => moveTarget(websiteId, target.id, "up"), t.saved)}
                        >
                          <ArrowUp className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
                          aria-label={`${t.moveDown}: ${path}`}
                          disabled={!canEdit || pending || index === network.targets.length - 1}
                          onClick={() => run(() => moveTarget(websiteId, target.id, "down"), t.saved)}
                        >
                          <ArrowDown className="size-3.5" />
                        </button>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" title={target.url}>
                          {path}
                        </p>
                        {target.note ? <p className="truncate text-xs text-muted-foreground">{target.note}</p> : null}
                      </div>
                      <select
                        aria-label={`${t.priorityLabel}: ${path}`}
                        className={cn(
                          "rounded-md border-0 px-2 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          PRIORITY_STYLE[target.priority] ?? PRIORITY_STYLE.medium,
                        )}
                        value={target.priority}
                        disabled={!canEdit || pending}
                        onChange={(e) => run(() => setTargetPriority(websiteId, target.id, e.target.value), t.saved)}
                      >
                        <option value="high">{t.high}</option>
                        <option value="medium">{t.medium}</option>
                        <option value="low">{t.low}</option>
                      </select>
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
                        aria-label={`${t.remove}: ${path}`}
                        disabled={!canEdit || pending}
                        onClick={() => run(() => removeTarget(websiteId, target.id), t.saved)}
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}

            {adding ? (
              <form
                className="space-y-2 rounded-lg border p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  run(() => addTarget(websiteId, { url, note, priority }), t.targetAdded, () => {
                    setUrl("");
                    setNote("");
                    setPriority("medium");
                    setAdding(false);
                  });
                }}
              >
                <div className="space-y-1">
                  <Label htmlFor="pn-url">{t.urlLabel}</Label>
                  <Input id="pn-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pn-note">{t.noteLabel}</Label>
                  <Input id="pn-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pn-priority">{t.priorityLabel}</Label>
                  <select
                    id="pn-priority"
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="high">{t.high}</option>
                    <option value="medium">{t.medium}</option>
                    <option value="low">{t.low}</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={pending || !url.trim()}>
                    {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                    {t.add}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
                    {t.cancel}
                  </Button>
                </div>
              </form>
            ) : canEdit ? (
              <Button type="button" variant="secondary" className="w-full" onClick={() => setAdding(true)} disabled={pending}>
                <Plus className="size-4" />
                {t.addTarget}
              </Button>
            ) : null}
          </section>
        </div>
      </CardContent>
    </Card>
  );
}

/** Minimum DataForSEO Rank: a slider (keyboard: arrows, Home/End) and Save. */
function MinimumAuthority({
  value,
  max,
  canEdit,
  pending,
  t,
  onSave,
}: {
  value: number | null;
  /** The plan's ceiling: 60, or 100 on Scale (lib/backlinks/authority-cap.ts). */
  max: number;
  canEdit: boolean;
  pending: boolean;
  t: Messages["app"]["partnerNetwork"];
  onSave: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState<number>(value ?? 0);
  const [none, setNone] = useState(value === null);
  const changed = none ? value !== null : draft !== value;
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{t.ratingMetric}</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={none} disabled={!canEdit || pending} onChange={(e) => setNone(e.target.checked)} className="size-4" />
        {t.ratingNone}
      </label>
      <div className={cn("flex items-center gap-3", none && "opacity-50")}>
        <input
          type="range"
          min={0}
          max={max}
          step={5}
          value={draft}
          disabled={!canEdit || pending || none}
          onChange={(e) => setDraft(Number(e.target.value))}
          aria-label={t.ratingSliderLabel}
          aria-valuetext={format(t.ratingCurrent, { n: draft })}
          className="h-2 min-w-0 flex-1 accent-violet-600"
        />
        <span className="w-10 rounded-md bg-violet-100 px-1.5 py-0.5 text-center text-sm font-semibold tabular-nums text-violet-800 dark:bg-violet-950/60 dark:text-violet-200">{none ? "-" : draft}</span>
      </div>
      <p className="text-xs text-muted-foreground">{none ? t.ratingNoneHelp : format(t.ratingCurrent, { n: draft })}</p>
      {/* Higher minimums are the Scale plan's (client, 2026-10-02); said where the slider stops. */}
      {max < 100 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5 shrink-0" aria-hidden="true" />
          {format(t.ratingScaleOnly, { cap: max })}
        </p>
      ) : null}
      {canEdit ? (
        <Button type="button" size="sm" variant="secondary" disabled={pending || !changed} onClick={() => onSave(none ? null : draft)}>
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {t.ratingSave}
        </Button>
      ) : null}
    </div>
  );
}
