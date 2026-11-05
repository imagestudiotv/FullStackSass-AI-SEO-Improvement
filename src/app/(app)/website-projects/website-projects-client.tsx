"use client";

import { Check, Globe, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceSection } from "@/components/workspace/section";
import { Notice } from "@/components/workspace/notice";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate, plural } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import type { WebsiteProjectCopy } from "@/lib/i18n/website-projects";
import { cn } from "@/lib/utils";
import { payWebsiteProject, requestWebsiteQuote } from "@/lib/website-projects/actions";
import type { WebsiteProjectField, WebsiteProjectKind, WebsiteProjectRow, WebsiteProjectStatus } from "@/lib/website-projects/shared";

type CreditsWord = Messages["app"]["credits"]["creditsCount"];

const KIND_ICON = { new: Globe, redesign: RefreshCw } as const;

export function WebsiteProjectsClient({
  copy,
  locale,
  creditsWord,
  available,
  projects,
  chosen,
  defaultName,
  defaultEmail,
}: {
  copy: WebsiteProjectCopy;
  locale: Locale;
  creditsWord: CreditsWord;
  /** Spendable credits, from the wallet: what backlinks hold is already taken off. */
  available: number;
  projects: WebsiteProjectRow[];
  /** From ?type=, carried through sign-up from the public page. */
  chosen: WebsiteProjectKind | null;
  defaultName: string;
  defaultEmail: string;
}) {
  const [kind, setKind] = useState<WebsiteProjectKind | null>(chosen);
  const form = useRef<HTMLDivElement>(null);

  function choose(next: WebsiteProjectKind) {
    setKind(next);
    // After the form has rendered. Instant under reduced motion.
    requestAnimationFrame(() => {
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      form.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      form.current?.querySelector("textarea")?.focus({ preventScroll: true });
    });
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2" role="group" aria-label={copy.title}>
        {(["new", "redesign"] as const).map((option) => {
          const Icon = KIND_ICON[option];
          const on = kind === option;
          return (
            <div key={option} className={cn("flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-5", on && "border-primary ring-1 ring-primary")}>
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <h2 className="text-base font-semibold text-foreground">{copy.options[option].title}</h2>
              </div>
              <p className="flex-1 text-sm text-muted-foreground">{copy.options[option].body}</p>
              <div>
                <Button type="button" variant={on ? "default" : "outline"} aria-pressed={on} onClick={() => choose(option)} className="h-auto min-h-9 whitespace-normal">
                  {copy.options[option].cta}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div ref={form} id="request" className="scroll-mt-20">
        {kind ? <RequestForm key={kind} kind={kind} copy={copy} defaultName={defaultName} defaultEmail={defaultEmail} onSent={() => setKind(null)} /> : null}
      </div>

      <WorkspaceSection id="projects" title={copy.listTitle} description={copy.listHelp}>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.listEmpty}</p>
        ) : (
          <ul className="space-y-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} copy={copy} locale={locale} creditsWord={creditsWord} available={available} />
            ))}
          </ul>
        )}
      </WorkspaceSection>
    </>
  );
}

function RequestForm({
  kind,
  copy,
  defaultName,
  defaultEmail,
  onSent,
}: {
  kind: WebsiteProjectKind;
  copy: WebsiteProjectCopy;
  defaultName: string;
  defaultEmail: string;
  onSent: () => void;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Partial<Record<WebsiteProjectField, string>>>({});
  const [formError, setFormError] = useState("");
  const [pending, start] = useTransition();
  /** This form's identity: a double click or a retry of the same form makes one request. */
  const [requestKey] = useState(() => crypto.randomUUID());
  const baseId = useId();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "");
    start(async () => {
      try {
        const result = await requestWebsiteQuote({
          kind,
          requestKey,
          brief: text("brief"),
          existingUrl: kind === "redesign" ? text("existingUrl") : "",
          requirements: text("requirements"),
          contactName: text("contactName"),
          contactEmail: text("contactEmail"),
          contactPhone: text("contactPhone"),
        });
        if (!result.ok) {
          setErrors(result.fields ?? {});
          setFormError(result.error);
          return;
        }
        toast.success(copy.sent);
        onSent();
        router.refresh();
      } catch {
        setFormError(copy.sendFailed);
      }
    });
  }

  function field(name: WebsiteProjectField, control: (props: { id: string; name: string; "aria-invalid"?: true; "aria-describedby": string; disabled: boolean }) => React.ReactNode, optional = false) {
    const id = `${baseId}-${name}`;
    const words = copy.fields[name];
    const error = errors[name];
    return (
      <div className="grid gap-1.5">
        <Label htmlFor={id}>
          {words.label}
          {optional ? <span className="font-normal text-muted-foreground"> ({copy.optional})</span> : null}
        </Label>
        {control({ id, name, "aria-invalid": error ? true : undefined, "aria-describedby": `${id}-note`, disabled: pending })}
        <p id={`${id}-note`} className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
          {error ?? words.hint}
        </p>
      </div>
    );
  }

  return (
    <WorkspaceSection title={copy.formTitle[kind]} description={copy.formHelp}>
      <form onSubmit={submit} noValidate className="grid gap-4">
        {field("brief", (props) => <Textarea {...props} rows={5} maxLength={4000} />)}
        {kind === "redesign" ? field("existingUrl", (props) => <Input {...props} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="example.com" />, true) : null}
        {field("requirements", (props) => <Textarea {...props} rows={3} maxLength={4000} />, true)}
        <div className="grid gap-4 md:grid-cols-3">
          {field("contactName", (props) => <Input {...props} autoComplete="name" defaultValue={defaultName} maxLength={120} />)}
          {field("contactEmail", (props) => <Input {...props} type="email" autoComplete="email" defaultValue={defaultEmail} maxLength={254} />)}
          {field("contactPhone", (props) => <Input {...props} type="tel" autoComplete="tel" maxLength={40} />, true)}
        </div>
        {formError ? (
          <p className="text-sm text-destructive" role="alert">
            {formError}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            {pending ? copy.sending : copy.submit}
          </Button>
        </div>
      </form>
    </WorkspaceSection>
  );
}

/** Where a status sits on the four stages; a declined project shows none of them. */
const STAGE_OF: Record<WebsiteProjectStatus, number> = { quote_requested: 0, quoted: 1, paid: 2, fulfilled: 3, declined: -1 };

function Stages({ status, copy }: { status: WebsiteProjectStatus; copy: WebsiteProjectCopy }) {
  const current = STAGE_OF[status];
  if (current < 0) return null;
  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label={copy.stagesLabel}>
      {copy.stages.map((stage, index) => {
        const done = index < current || status === "fulfilled";
        const here = index === current;
        return (
          <li key={stage} aria-current={here ? "step" : undefined} className={cn("flex items-center gap-1.5 text-xs", here ? "font-semibold text-foreground" : done ? "text-foreground" : "text-muted-foreground")}>
            <span
              className={cn(
                "flex size-4 items-center justify-center rounded-full border text-[10px]",
                done ? "border-primary bg-primary text-primary-foreground" : here ? "border-primary text-primary" : "border-border",
              )}
              aria-hidden="true"
            >
              {done ? <Check className="size-2.5" /> : index + 1}
            </span>
            {stage}
          </li>
        );
      })}
    </ol>
  );
}

function ProjectCard({
  project,
  copy,
  locale,
  creditsWord,
  available,
}: {
  project: WebsiteProjectRow;
  copy: WebsiteProjectCopy;
  locale: Locale;
  creditsWord: CreditsWord;
  available: number;
}) {
  const credits = (count: number) => plural(creditsWord, count);
  const words = copy.status[project.status];
  const date = (at: Date) => formatDate(at, locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  // Only a priced, open quote carries a button: an unpriced request has nothing to pay.
  const payable = project.status === "quoted" && project.creditCost !== null;

  return (
    <li className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{copy.kind[project.kind]}</h3>
          <p className="text-xs text-muted-foreground">{format(copy.sentOn, { date: date(project.createdAt) })}</p>
        </div>
        <StatusBadge
          status={project.status === "fulfilled" ? "fulfilled" : project.status === "declined" ? "failed" : "pending"}
          label={words.label}
          tone={project.status === "paid" || project.status === "quoted" ? "active" : undefined}
          animate={false}
        />
      </div>

      <Stages status={project.status} copy={copy} />
      <p className="text-sm text-muted-foreground">{words.help}</p>

      {project.scope && project.status !== "declined" ? (
        <div className="space-y-1 rounded-md bg-muted/50 p-3">
          <p className="text-xs font-semibold text-foreground">{copy.scopeTitle}</p>
          <p className="text-sm whitespace-pre-line text-foreground [overflow-wrap:anywhere]">{project.scope}</p>
        </div>
      ) : null}

      {project.status === "declined" && project.declineReason ? (
        <Notice tone="info" title={copy.declinedTitle}>
          <span className="whitespace-pre-line [overflow-wrap:anywhere]">{project.declineReason}</span>
        </Notice>
      ) : null}

      {project.status === "fulfilled" && project.deliveryNote ? (
        <Notice tone="success" title={copy.deliveredTitle}>
          <span className="whitespace-pre-line [overflow-wrap:anywhere]">{project.deliveryNote}</span>
        </Notice>
      ) : null}

      {project.creditsPaid ? (
        <p className="text-sm text-foreground">
          <span className="text-muted-foreground">{copy.paidLabel}: </span>
          <span className="font-semibold tabular-nums">{credits(project.creditsPaid)}</span>
        </p>
      ) : null}

      {payable ? <PayQuote project={project} cost={project.creditCost as number} copy={copy} credits={credits} available={available} /> : null}

      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">{copy.yourBrief}</summary>
        <dl className="mt-2 space-y-2">
          <div>
            <dd className="whitespace-pre-line text-foreground [overflow-wrap:anywhere]">{project.brief}</dd>
          </div>
          {project.existingUrl ? (
            <div>
              <dt className="text-xs text-muted-foreground">{copy.currentWebsite}</dt>
              <dd className="[overflow-wrap:anywhere]">{project.existingUrl}</dd>
            </div>
          ) : null}
          {project.requirements ? (
            <div>
              <dt className="text-xs text-muted-foreground">{copy.yourRequirements}</dt>
              <dd className="whitespace-pre-line [overflow-wrap:anywhere]">{project.requirements}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-muted-foreground">{copy.contactLabel}</dt>
            <dd className="[overflow-wrap:anywhere]">{[project.contactName, project.contactEmail, project.contactPhone].filter(Boolean).join(" · ")}</dd>
          </div>
        </dl>
      </details>
    </li>
  );
}

function PayQuote({
  project,
  cost,
  copy,
  credits,
  available,
}: {
  project: WebsiteProjectRow;
  cost: number;
  copy: WebsiteProjectCopy;
  credits: (count: number) => string;
  available: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const covered = available >= cost;

  function pay() {
    start(async () => {
      try {
        // The price on screen goes with it: the server compares it with the current one and charges only the current one.
        const result = await payWebsiteProject(project.id, cost);
        if (!result.ok) {
          toast.error(result.error);
          setOpen(false);
          router.refresh();
          return;
        }
        toast.success(copy.paid);
        setOpen(false);
        router.refresh();
      } catch {
        toast.error(copy.payFailed);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <p className="text-sm">
        <span className="text-muted-foreground">{copy.priceLabel}: </span>
        <span className="text-xl font-semibold tabular-nums text-foreground">{credits(cost)}</span>
      </p>
      {covered ? (
        <Button type="button" onClick={() => setOpen(true)} className="h-auto min-h-9 whitespace-normal">
          {format(copy.accept, { price: credits(cost) })}
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">{format(copy.short, { price: credits(cost), available: credits(available) })}</p>
          <Button asChild>
            <Link href="/billing#addons">{copy.buyToPay}</Link>
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={(next) => !next && !pending && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{copy.confirmTitle}</DialogTitle>
            <DialogDescription>{format(copy.confirmBody, { price: credits(cost), available: credits(available) })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              {copy.cancel}
            </Button>
            <Button type="button" disabled={pending} onClick={pay}>
              {pending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              {copy.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
