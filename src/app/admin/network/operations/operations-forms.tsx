"use client";

import { AlertTriangle, Loader2, PauseCircle, PlayCircle, RefreshCw, ShieldCheck, ShieldOff, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publishValuationPolicy, requestAuthorityCollection, resolveDispatch, setControl } from "@/lib/admin/network-operations";
import type { BacklinkRate, ClickValueMode } from "@/lib/valuation/policy";
import { cn } from "@/lib/utils";

/**
 * The state-changing controls of the operations page. Each runs one server
 * action inside a transition; nothing here runs on render. A success message
 * appears only after the action returns ok - never before - and the page is
 * then refreshed from the server.
 */

/** The server's own floor for every audited reason (trimmed). */
const reasonOk = (reason: string) => reason.trim().length >= 3;

function ReasonField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Reason (kept in the audit log)</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={3}
        maxLength={300}
        autoComplete="off"
        disabled={disabled}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        At least 3 characters. Recorded against your name.
      </p>
    </div>
  );
}

const SWITCH_COPY: Record<
  "publication_freeze" | "managed_review",
  { on: { title: string; body: ReactNode; confirm: string }; off: { title: string; body: ReactNode; confirm: string } }
> = {
  publication_freeze: {
    on: {
      title: "Turn on the publication freeze?",
      body: (
        <>
          Nothing will be sent to any customer site: direct publishing, the plugin feed, scheduled and queued jobs all hold at their
          dispatch claim. Turning it on waits for claims already being made, so it can take a while. Sends already admitted cannot be
          recalled - check the delivery drain before switching builds.
        </>
      ),
      confirm: "Turn on freeze",
    },
    off: {
      title: "Turn off the publication freeze?",
      body: <>Every publishing path can send to customer sites again.</>,
      confirm: "Turn off freeze",
    },
  },
  managed_review: {
    on: {
      title: "Turn on managed review?",
      body: (
        <>
          New drafts on Partner Network websites will wait for the RepGet team&apos;s review, and the unpublished drafts written on
          those websites since this build&apos;s cutover are held for review now. Turn on only after a deploy has finished, so no older
          build that ignores the review gate is still running.
        </>
      ),
      confirm: "Turn on review",
    },
    off: {
      title: "Turn off managed review?",
      body: <>New drafts on Partner Network websites will no longer wait for the RepGet team&apos;s review.</>,
      confirm: "Turn off review",
    },
  },
};

/**
 * One operator switch: a button that opens a confirmation with what the
 * change does and the reason the audit log requires.
 */
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
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const id = `reason-${controlKey}`;
  const freeze = controlKey === "publication_freeze";
  const copy = SWITCH_COPY[controlKey][enabled ? "off" : "on"];
  const TriggerIcon = freeze ? (enabled ? PlayCircle : PauseCircle) : enabled ? ShieldOff : ShieldCheck;
  // Turning the freeze on is the one that stops customers' publishing.
  const variant = enabled ? "outline" : freeze ? "destructive" : "default";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // The switch keeps running on the server once sent; keep its outcome on screen.
        if (!pending) setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="lg" variant={variant}>
          <TriggerIcon aria-hidden="true" />
          {copy.confirm}…
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" showCloseButton={!pending}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!reasonOk(reason)) return;
            start(async () => {
              const result = await setControl(controlKey, !enabled, reason);
              if (!result.ok) return void toast.error(result.error);
              toast.success(`${title}: ${!enabled ? onLabel : offLabel}`);
              setReason("");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.body}</DialogDescription>
          </DialogHeader>
          <ReasonField id={id} value={reason} onChange={setReason} disabled={pending} />
          {pending && freeze && !enabled ? (
            <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Waiting for claims already being made to finish…
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={!enabled && freeze ? "destructive" : "default"} disabled={pending || !reasonOk(reason)}>
              {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              {copy.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Decision = "not_published" | "published" | "release";

const DECISION_TEXT: Record<Decision, string> = {
  not_published:
    "The send is recorded as failed (confirmed not on the site) and the article's error is cleared, so the next publish may create the post.",
  published: "The post's id and address are recorded, so the next publish updates that post instead of creating another.",
  release:
    "The hand-over is released so newer revisions of this article can be sent. If the plugin reports it later, the report is still recorded, as late.",
};

/**
 * An operator's decision on a delivery whose outcome is unknown. Every
 * decision needs a reason and is audited; see resolveDispatch.
 */
export function ResolveDispatchForm({
  dispatchId,
  kind,
  articleTitle,
  domain,
  channel,
  claimed,
}: {
  dispatchId: string;
  kind: "uncertain" | "expired";
  articleTitle: string;
  domain: string;
  channel: string;
  claimed: string;
}) {
  const router = useRouter();
  const initial: Decision = kind === "expired" ? "release" : "not_published";
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState<Decision>(initial);
  const [remoteId, setRemoteId] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [pending, start] = useTransition();
  const id = `resolve-${dispatchId}`;

  // The same shape the server insists on, so the button says why it waits.
  const postOk = decision !== "published" || (/^\d+$/.test(remoteId.trim()) && /^https?:\/\//.test(remoteUrl.trim()));
  const ready = reasonOk(reason) && postOk;

  function reset() {
    setReason("");
    setDecision(initial);
    setRemoteId("");
    setRemoteUrl("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" aria-label={`${kind === "expired" ? "Release" : "Record outcome for"} ${articleTitle}`}>
          {kind === "expired" ? "Release…" : "Record outcome…"}
        </Button>
      </DialogTrigger>
      <DialogContent className="text-left sm:max-w-lg" showCloseButton={!pending}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!ready) return;
            start(async () => {
              const result = await resolveDispatch({ dispatchId, decision, reason, remoteId, remoteUrl });
              if (!result.ok) return void toast.error(result.error);
              toast.success(
                decision === "release" ? "Recorded: hand-over released" : decision === "published" ? "Recorded: post found" : "Recorded: not on the site",
              );
              setOpen(false);
              reset();
              router.refresh();
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{kind === "expired" ? "Release this plugin hand-over?" : "Record what happened to this send"}</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-0.5">
                <p className="font-medium text-foreground wrap-anywhere">{articleTitle}</p>
                <p className="wrap-anywhere">
                  {domain} · {channel} · claimed {claimed}
                </p>
                <p className="font-mono text-[11px] wrap-anywhere">{dispatchId}</p>
              </div>
            </DialogDescription>
          </DialogHeader>

          {kind === "uncertain" ? (
            <fieldset className="space-y-2" disabled={pending}>
              <legend className="mb-2 text-sm font-medium">What did you find on the site?</legend>
              {(["not_published", "published"] as const).map((value) => (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors motion-reduce:transition-none",
                    decision === value ? "border-foreground/30 bg-muted/50" : "hover:bg-muted/30",
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-d`}
                    className="mt-0.5 accent-primary"
                    checked={decision === value}
                    onChange={() => setDecision(value)}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{value === "published" ? "Found the post" : "Checked: not on the site"}</span>
                    <span className="block text-xs text-muted-foreground">{DECISION_TEXT[value]}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">{DECISION_TEXT.release}</p>
          )}

          {decision === "published" ? (
            <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-post-id`}>Post id</Label>
                <Input
                  id={`${id}-post-id`}
                  placeholder="Post id"
                  value={remoteId}
                  onChange={(e) => setRemoteId(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  disabled={pending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-post-url`}>Post address</Label>
                <Input
                  id={`${id}-post-url`}
                  placeholder="https://"
                  value={remoteUrl}
                  onChange={(e) => setRemoteUrl(e.target.value)}
                  autoComplete="off"
                  disabled={pending}
                />
              </div>
              {!postOk ? (
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  Give the post&apos;s id (digits only) and its full address, starting with http:// or https://.
                </p>
              ) : null}
            </div>
          ) : null}

          <ReasonField id={id} value={reason} onChange={setReason} disabled={pending} />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !ready}>
              {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              {kind === "expired" ? "Release" : "Record decision"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Asks for one background collection run. Nothing is collected by viewing the page. */
export function CollectAuthorityButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const result = await requestAuthorityCollection();
          if (!result.ok) return void toast.error(result.error);
          toast.success("Collection requested - it runs in the background");
          router.refresh();
        })
      }
    >
      {pending ? (
        <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        <RefreshCw aria-hidden="true" />
      )}
      Collect now
    </Button>
  );
}

type PolicyDraft = {
  currency: string;
  clickValueMode: ClickValueMode;
  fixedClickRate: number | null;
  backlinkRates: BacklinkRate[];
  sources: string;
  notes: string | null;
  effectiveFrom: string;
};

const MODE_LABEL: Record<ClickValueMode, string> = {
  none: "Not valued",
  keyword_cpc: "Keyword CPC (USD only)",
  fixed: "Fixed rate per click",
};

const fieldClass =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

/**
 * A new valuation policy version. Bands are written as "minRank:value",
 * comma separated, with "unknown:value" for sources without a rank, e.g.
 * "0:40, 30:90, 60:180, unknown:25". The form is checked, then summarised
 * in a confirmation before anything is published.
 */
export function PolicyForm({
  current,
}: {
  current: { currency: string; clickValueMode: ClickValueMode; fixedClickRate: number | null; bands: string; sources: string } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<ClickValueMode>(current?.clickValueMode ?? "none");
  const [draft, setDraft] = useState<PolicyDraft | null>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  function publish() {
    if (!draft) return;
    start(async () => {
      const result = await publishValuationPolicy(draft);
      if (!result.ok) {
        toast.error(result.error);
        setDraft(null);
        return;
      }
      toast.success(`Published valuation policy v${result.data.version}`);
      setDraft(null);
      router.refresh();
    });
  }

  return (
    <>
      <form
        className="grid gap-4 sm:grid-cols-2"
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
          const rateText = String(form.get("fixedRate") ?? "").trim();
          if (mode === "fixed" && rateText === "") {
            // A blank rate would otherwise be read as 0 and published.
            toast.error("Enter the fixed rate per click");
            return;
          }
          setDraft({
            currency: String(form.get("currency") ?? ""),
            clickValueMode: mode,
            fixedClickRate: mode === "fixed" ? Number(rateText) : null,
            backlinkRates: bands,
            sources: String(form.get("sources") ?? ""),
            notes: String(form.get("notes") ?? "") || null,
            effectiveFrom: `${String(form.get("effective") ?? today)}T00:00:00Z`,
          });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="currency">Currency (ISO 4217)</Label>
          <Input id="currency" name="currency" defaultValue={current?.currency ?? "USD"} maxLength={3} required autoComplete="off" className="uppercase" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="effective">Effective from (UTC day)</Label>
          <Input id="effective" name="effective" type="date" defaultValue={today} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mode">Traffic valuation</Label>
          <select id="mode" value={mode} onChange={(e) => setMode(e.target.value as ClickValueMode)} className={cn(fieldClass, "h-8")}>
            <option value="none">{MODE_LABEL.none}</option>
            <option value="keyword_cpc">{MODE_LABEL.keyword_cpc}</option>
            <option value="fixed">{MODE_LABEL.fixed}</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fixedRate">Fixed rate per click</Label>
          <Input
            id="fixedRate"
            name="fixedRate"
            type="number"
            min={0}
            max={1000}
            step="0.01"
            disabled={mode !== "fixed"}
            required={mode === "fixed"}
            defaultValue={current?.fixedClickRate ?? undefined}
            aria-describedby="fixedRate-hint"
          />
          <p id="fixedRate-hint" className="text-xs text-muted-foreground">
            {mode === "fixed" ? "Required: 0 to 1000, in the policy's currency." : "Used only with a fixed rate per click."}
          </p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="bands">Value of one verified backlink, by source Domain Authority band</Label>
          <Input
            id="bands"
            name="bands"
            placeholder="0:40, 30:90, 60:180, unknown:25"
            defaultValue={current?.bands ?? ""}
            autoComplete="off"
            aria-describedby="bands-hint"
          />
          <p id="bands-hint" className="text-xs text-muted-foreground">
            Empty: backlinks are not valued. &quot;unknown&quot; is the rate for a source whose rank is not known.
          </p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="sources">Where the rates come from (shown to customers)</Label>
          <textarea
            id="sources"
            name="sources"
            required
            minLength={10}
            maxLength={1000}
            defaultValue={current?.sources ?? ""}
            aria-describedby="sources-hint"
            className={cn(fieldClass, "min-h-24 py-2")}
          />
          <p id="sources-hint" className="text-xs text-muted-foreground">
            10 to 1000 characters. Customers read this - describe the sources without naming data providers.
          </p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">Internal notes (optional)</Label>
          <Input id="notes" name="notes" maxLength={500} autoComplete="off" aria-describedby="notes-hint" />
          <p id="notes-hint" className="text-xs text-muted-foreground">
            Not shown to customers.
          </p>
        </div>
        <div className="flex flex-col gap-3 border-t pt-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="mt-px size-3.5 shrink-0 text-warning" aria-hidden="true" />
            Customer-visible from its effective day. Published versions cannot be edited; a mistake is corrected by publishing another
            version.
          </p>
          <Button ref={submitRef} type="submit" size="lg" disabled={pending}>
            <Upload aria-hidden="true" />
            Review and publish…
          </Button>
        </div>
      </form>

      <Dialog
        open={draft !== null}
        onOpenChange={(next) => {
          if (!next && !pending) setDraft(null);
        }}
      >
        <DialogContent
          className="sm:max-w-lg"
          showCloseButton={!pending}
          onCloseAutoFocus={(event) => {
            // Opened from the form's submit, not a trigger: return focus there.
            event.preventDefault();
            submitRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Publish this valuation policy?</DialogTitle>
            <DialogDescription>
              Customers see these rates and their sources from the effective day. Versions are append-only: this cannot be edited
              afterwards.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[9rem_1fr]">
              <dt className="text-muted-foreground">Currency</dt>
              <dd className="font-medium uppercase">{draft.currency.trim() || "-"}</dd>
              <dt className="text-muted-foreground">Effective from</dt>
              <dd className="tabular-nums">{draft.effectiveFrom.slice(0, 10)} (UTC)</dd>
              <dt className="text-muted-foreground">Traffic</dt>
              <dd>
                {MODE_LABEL[draft.clickValueMode]}
                {draft.clickValueMode === "fixed" ? <span className="tabular-nums">: {draft.fixedClickRate} per click</span> : null}
              </dd>
              <dt className="text-muted-foreground">Backlinks</dt>
              <dd className="tabular-nums wrap-anywhere">
                {draft.backlinkRates.length === 0
                  ? "Not valued"
                  : draft.backlinkRates.map((r) => `${r.minRank ?? "unknown"}:${r.value}`).join(", ")}
              </dd>
              <dt className="text-muted-foreground">Sources</dt>
              <dd className="line-clamp-4 whitespace-pre-line wrap-anywhere">{draft.sources}</dd>
            </dl>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={publish}>
              {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              Publish version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
