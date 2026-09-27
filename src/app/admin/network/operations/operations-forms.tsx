"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publishValuationPolicy, requestAuthorityCollection, setControl } from "@/lib/admin/network-operations";
import type { ClickValueMode } from "@/lib/valuation/policy";

/** One operator switch, with the reason the audit log requires. */
export function ControlToggle({
  controlKey,
  enabled,
  title,
  onLabel,
  offLabel,
}: {
  controlKey: "publication_freeze" | "managed_review";
  enabled: boolean;
  title: string;
  onLabel: string;
  offLabel: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const id = `reason-${controlKey}`;
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const result = await setControl(controlKey, !enabled, reason);
          if (!result.ok) return void toast.error(result.error);
          toast.success(`${title}: ${!enabled ? onLabel : offLabel}`);
          setReason("");
          router.refresh();
        });
      }}
    >
      <div className="flex-1 space-y-1">
        <Label htmlFor={id}>Reason (kept in the audit log)</Label>
        <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={300} />
      </div>
      <Button type="submit" variant={enabled ? "outline" : controlKey === "publication_freeze" ? "destructive" : "default"} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {enabled ? `Turn off` : `Turn on`}
      </Button>
    </form>
  );
}

export function CollectAuthorityButton({ disabled }: { disabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const result = await requestAuthorityCollection();
          if (result.ok) toast.success("Collection requested - it runs in the background");
          else toast.error(result.error);
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      Collect now
    </Button>
  );
}

/**
 * A new valuation policy version. Bands are written as "minRank:value",
 * comma separated, with "unknown:value" for sources without a rank, e.g.
 * "0:40, 30:90, 60:180, unknown:25".
 */
export function PolicyForm({ current }: { current: { currency: string; clickValueMode: ClickValueMode; fixedClickRate: number | null; bands: string; sources: string } | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<ClickValueMode>(current?.clickValueMode ?? "none");
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const bandsText = String(form.get("bands") ?? "").trim();
        const bands = bandsText
          ? bandsText.split(",").map((part) => {
              const [rank, value] = part.split(":").map((x) => x.trim());
              return { minRank: rank.toLowerCase() === "unknown" ? null : Number(rank), value: Number(value) };
            })
          : [];
        if (bands.some((b) => (b.minRank !== null && Number.isNaN(b.minRank)) || Number.isNaN(b.value))) {
          toast.error('Bands must look like "0:40, 30:90, unknown:25"');
          return;
        }
        start(async () => {
          const result = await publishValuationPolicy({
            currency: String(form.get("currency") ?? ""),
            clickValueMode: mode,
            fixedClickRate: mode === "fixed" ? Number(form.get("fixedRate")) : null,
            backlinkRates: bands,
            sources: String(form.get("sources") ?? ""),
            notes: String(form.get("notes") ?? "") || null,
            effectiveFrom: `${String(form.get("effective") ?? today)}T00:00:00Z`,
          });
          if (!result.ok) return void toast.error(result.error);
          toast.success(`Published valuation policy v${result.data.version}`);
          router.refresh();
        });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="currency">Currency (ISO 4217)</Label>
        <Input id="currency" name="currency" defaultValue={current?.currency ?? "USD"} maxLength={3} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="effective">Effective from (UTC day)</Label>
        <Input id="effective" name="effective" type="date" defaultValue={today} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="mode">Traffic valuation</Label>
        <select id="mode" value={mode} onChange={(e) => setMode(e.target.value as ClickValueMode)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
          <option value="none">Not valued</option>
          <option value="keyword_cpc">Keyword CPC (USD only)</option>
          <option value="fixed">Fixed rate per click</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="fixedRate">Fixed rate per click</Label>
        <Input id="fixedRate" name="fixedRate" type="number" min={0} max={1000} step="0.01" disabled={mode !== "fixed"} defaultValue={current?.fixedClickRate ?? undefined} />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="bands">Value of one verified backlink, by source DataForSEO Rank band</Label>
        <Input id="bands" name="bands" placeholder="0:40, 30:90, 60:180, unknown:25" defaultValue={current?.bands ?? ""} />
        <p className="text-xs text-muted-foreground">Empty: backlinks are not valued. &quot;unknown&quot; is the rate for a source whose rank is not known.</p>
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="sources">Where the rates come from (shown to customers)</Label>
        <textarea id="sources" name="sources" required minLength={10} maxLength={1000} defaultValue={current?.sources ?? ""} className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="notes">Internal notes (optional)</Label>
        <Input id="notes" name="notes" maxLength={500} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Publish new version
        </Button>
      </div>
    </form>
  );
}
