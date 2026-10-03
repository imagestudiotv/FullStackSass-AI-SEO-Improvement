"use client";

import { CheckCircle2, ExternalLink, Globe, Loader2, Plus, Sparkles, Swords, Trash2, UserRound, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/workspace/field";
import { Notice } from "@/components/workspace/notice";
import { WorkspaceSection, WorkspaceSubsection } from "@/components/workspace/section";
import { format, plural } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { addCompetitor, removeCompetitor } from "@/lib/websites/actions";

import {
  checkCompetitorInput,
  competitorCheckMessage,
  isSuggested,
  serverErrorMessage,
  type Competitor,
} from "./business-profile";

/**
 * Competitors: the one part of Business settings that saves immediately.
 *
 * Every add and remove is its own server action, so nothing here waits for
 * the page's Save - the section says so in its header. Nothing is shown
 * before the server answers: an add is checked (DNS and a request to the
 * site, which can take seconds) and only a domain the server accepted joins
 * the list; a removed row leaves only once the server confirms it.
 *
 * The list on screen is the server's list. Confirmed adds and removes are
 * layered on top only until the refresh they trigger brings the stored rows
 * back, so a chip always shows the domain the server stored (not what was
 * typed), and remove sends that stored domain.
 */
export function CompetitorsSection({
  id,
  websiteId,
  ownDomain,
  competitors,
  truncated,
  limit,
  status,
  canEdit,
  t,
  tw,
}: {
  id: string;
  websiteId: string;
  ownDomain: string;
  competitors: Competitor[];
  /** More are stored than the page loaded. */
  truncated: boolean;
  limit: number;
  /** websites.status, for the empty-state wording. */
  status: string;
  canEdit: boolean;
  t: Messages["app"]["profile"];
  tw: Messages["app"]["workspace"];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string[]>([]);
  const [added, setAdded] = useState<Competitor[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState<{ text: string; tone: "progress" | "done" | "error" } | null>(null);

  // New rows from the server replace the confirmed-but-not-yet-refreshed overlay.
  const [seen, setSeen] = useState(competitors);
  if (seen !== competitors) {
    setSeen(competitors);
    setAdded([]);
    setRemoved([]);
  }

  const list = [
    ...competitors.filter((competitor) => !removed.includes(competitor.domain)),
    ...added.filter((extra) => !competitors.some((competitor) => competitor.domain === extra.domain)),
  ];
  const mine = list.filter((competitor) => !isSuggested(competitor));
  const suggested = list.filter(isSuggested);

  async function handleAdd() {
    if (!canEdit || adding) return;
    const check = checkCompetitorInput(draft, { ownDomain, existing: list });
    if (!check.ok) {
      // Instant and shown under the field the person is in; the field's description carries it.
      setInputError(competitorCheckMessage(check, t));
      setAnnouncement(null);
      return;
    }
    setInputError(null);
    setListError(null);
    setAdding(check.domain);
    setAnnouncement({ text: format(t.checkingCompetitor, { domain: check.domain }), tone: "progress" });
    const refuse = (message: string) => {
      setInputError(message);
      setAnnouncement({ text: message, tone: "error" });
    };
    try {
      const result = await addCompetitor(websiteId, draft.trim());
      // No result: the server redirected (signed out) and the router is already leaving.
      if (!result) return;
      if (!result.ok) {
        refuse(serverErrorMessage(result.error, t, tw));
        return;
      }
      setAdded((current) => [...current, { domain: check.domain, source: "manual" }]);
      // Removed a moment ago and added straight back: it is in the list again.
      setRemoved((current) => current.filter((entry) => entry !== check.domain));
      setDraft("");
      setAnnouncement({ text: format(t.competitorAdded, { domain: check.domain }), tone: "done" });
      router.refresh();
    } catch {
      // Kept typed, so trying again is one press.
      refuse(t.actionFailed);
    } finally {
      setAdding(null);
      inputRef.current?.focus();
    }
  }

  async function handleRemove(domain: string) {
    if (!canEdit || removing.includes(domain)) return;
    setListError(null);
    setRemoving((current) => [...current, domain]);
    setAnnouncement({ text: format(t.removingCompetitor, { domain }), tone: "progress" });
    try {
      const result = await removeCompetitor(websiteId, domain);
      if (!result) return;
      if (!result.ok) {
        setListError(serverErrorMessage(result.error, t, tw));
        setAnnouncement(null);
        return;
      }
      setRemoved((current) => [...current, domain]);
      setAdded((current) => current.filter((competitor) => competitor.domain !== domain));
      setAnnouncement({ text: format(t.competitorRemoved, { domain }), tone: "done" });
      // The row and its button are gone; the add field is the next useful place for focus.
      inputRef.current?.focus();
      router.refresh();
    } catch {
      setListError(t.actionFailed);
      setAnnouncement(null);
    } finally {
      setRemoving((current) => current.filter((entry) => entry !== domain));
    }
  }

  const empty =
    status === "ready" ? t.competitorsEmptyAnalysed : status === "pending" || status === "crawling" ? t.competitorsEmptyAnalysing : t.competitorsEmpty;

  return (
    <WorkspaceSection
      id={id}
      icon={Swords}
      title={t.competitorsTitle}
      description={t.competitorsHelp}
      /*
        Only the short count up here: the header's actions do not shrink, so
        a sentence beside the title (German runs to 45 characters) squeezed
        the title and description into a sliver at tablet widths.
      */
      actions={
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
          {plural(t.competitorCount, list.length)}
        </span>
      }
      bodyClassName="@container space-y-5"
    >
      {canEdit ? (
        <div className="rounded-lg border bg-muted/20 p-4">
          <Field
            id={`${id}-add`}
            label={t.addCompetitor}
            hint={t.addCompetitorHint}
            error={inputError}
            t={tw}
            labelAction={
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="size-3.5 shrink-0" aria-hidden="true" />
                {tw.savesImmediately}
              </span>
            }
          >
            {(props) => (
              <div className="flex flex-col gap-2 @md:flex-row">
                <Input
                  {...props}
                  ref={inputRef}
                  value={draft}
                  readOnly={adding !== null}
                  inputMode="url"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={t.competitorPlaceholder}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    if (inputError) {
                      setInputError(null);
                      setAnnouncement((current) => (current?.tone === "error" ? null : current));
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    void handleAdd();
                  }}
                  className="bg-background @md:max-w-md"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleAdd()}
                  aria-disabled={adding !== null || undefined}
                  className="aria-disabled:opacity-60 @md:w-auto"
                >
                  {adding ? (
                    <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    <Plus aria-hidden="true" />
                  )}
                  {adding ? t.checkingShort : t.addCompetitorButton}
                </Button>
              </div>
            )}
          </Field>
          <p role="status" aria-live="polite" className="mt-2 min-h-5 text-xs">
            {announcement?.tone === "error" ? (
              // Already on screen under the field; spoken here because a refusal can arrive seconds after the press.
              <span className="sr-only">{announcement.text}</span>
            ) : announcement ? (
              <span className={announcement.tone === "done" ? "inline-flex items-center gap-1.5 text-emerald-700" : "text-muted-foreground"}>
                {announcement.tone === "done" ? <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                {announcement.text}
              </span>
            ) : null}
          </p>
        </div>
      ) : null}

      {listError ? (
        <Notice tone="danger" role="alert">
          {listError}
        </Notice>
      ) : null}

      {truncated ? <Notice>{format(t.competitorsTruncated, { count: limit })}</Notice> : null}

      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-5">
          {mine.length > 0 ? (
            <WorkspaceSubsection title={<GroupTitle icon={<UserRound className="size-4 text-muted-foreground" aria-hidden="true" />} label={t.manualGroup} count={mine.length} />}>
              <CompetitorList
                items={mine}
                removing={removing}
                canEdit={canEdit}
                onRemove={handleRemove}
                t={t}
              />
            </WorkspaceSubsection>
          ) : null}
          {suggested.length > 0 ? (
            <WorkspaceSubsection
              title={<GroupTitle icon={<Sparkles className="size-4 text-primary" aria-hidden="true" />} label={t.suggestedGroup} count={suggested.length} />}
              description={canEdit ? t.suggestedGroupHelp : t.suggestedGroupHelpReadOnly}
            >
              <CompetitorList
                items={suggested}
                removing={removing}
                canEdit={canEdit}
                onRemove={handleRemove}
                t={t}
              />
            </WorkspaceSubsection>
          ) : null}
        </div>
      )}
    </WorkspaceSection>
  );
}

function GroupTitle({ icon, label, count }: { icon: ReactNode; label: string; count: number }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {icon}
      {label}
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">{count}</span>
    </span>
  );
}

function CompetitorList({
  items,
  removing,
  canEdit,
  onRemove,
  t,
}: {
  items: Competitor[];
  removing: string[];
  canEdit: boolean;
  onRemove: (domain: string) => void;
  t: Messages["app"]["profile"];
}) {
  return (
    <ul className="grid gap-2 @lg:grid-cols-2">
      {items.map((competitor) => {
        const busy = removing.includes(competitor.domain);
        return (
          <li
            key={competitor.domain}
            aria-busy={busy || undefined}
            className="flex min-w-0 items-center gap-2 rounded-lg border bg-background py-1.5 pr-1.5 pl-3"
          >
            <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium" title={competitor.domain}>
              {competitor.domain}
            </span>
            <a
              href={`https://${competitor.domain}`}
              target="_blank"
              rel="noopener noreferrer nofollow"
              aria-label={format(t.visitCompetitor, { domain: competitor.domain })}
              title={format(t.visitCompetitor, { domain: competitor.domain })}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
            {canEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onRemove(competitor.domain)}
                aria-disabled={busy || undefined}
                aria-label={format(t.removeCompetitor, { domain: competitor.domain })}
                title={format(t.removeCompetitor, { domain: competitor.domain })}
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive aria-disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Trash2 aria-hidden="true" />
                )}
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
