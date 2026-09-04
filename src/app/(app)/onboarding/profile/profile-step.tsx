"use client";

import { ArrowRight, Check, Loader2, Plus, RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addCompetitor,
  removeCompetitor,
  updateWebsiteDetails,
  updateWebsiteServices,
} from "@/lib/websites/actions";

/**
 * The brand profile, one editable card per field.
 *
 * Each card shows what analysis extracted with a "Confirmed" badge, and an
 * Edit button that turns it into an input — the reference's layout, and the
 * right one here: a page of open form fields makes correct answers look
 * unfinished, while a page of plain text hides that anything can be changed.
 *
 * A field we could not extract shows as empty and asks to be filled rather
 * than claiming a confident guess. The extractor is told to return null rather
 * than invent, so an empty field is a real signal, not a failure.
 */

type Website = {
  id: string;
  url: string;
  domain: string;
  brandName: string | null;
  industry: string | null;
  country: string | null;
  language: string | null;
  description: string | null;
  services: string[];
  status: string;
};

type Competitor = { domain: string; source: string | null };

/** One field card: label, value or input, Confirmed badge, Edit toggle. */
function FieldCard({
  label,
  value,
  placeholder,
  multiline,
  onSave,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  multiline?: boolean;
  onSave: (next: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  const filled = Boolean(value && value.trim());

  async function handleSave() {
    setSaving(true);
    await onSave(draft.trim());
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        {filled ? (
          <span className="flex items-center gap-1 rounded-full border border-emerald-500/40 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            <Check className="size-3" aria-hidden="true" />
            Confirmed
          </span>
        ) : (
          <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
            Needs you
          </span>
        )}
      </div>

      <div className="px-4 py-3">
        {editing ? (
          <div className="space-y-2">
            {multiline ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={5}
                placeholder={placeholder}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                autoFocus
              />
            ) : (
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={placeholder}
                autoFocus
              />
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(value ?? "");
                  setEditing(false);
                }}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p
              className={`text-sm ${filled ? "" : "text-muted-foreground italic"}`}
            >
              {filled ? value : placeholder}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => {
                setDraft(value ?? "");
                setEditing(true);
              }}
            >
              Edit
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function ProfileStep({
  website,
  competitors: initialCompetitors,
  analysing,
}: {
  website: Website;
  competitors: Competitor[];
  analysing: boolean;
}) {
  const router = useRouter();
  const [services, setServices] = useState(website.services);
  const [newService, setNewService] = useState("");
  const [rivals, setRivals] = useState(initialCompetitors);
  const [newRival, setNewRival] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveField(field: string, next: string) {
    const result = await updateWebsiteDetails(website.id, {
      [field]: next === "" ? null : next,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  async function saveServices(next: string[]) {
    setServices(next);
    const result = await updateWebsiteServices(website.id, next);
    if (!result.ok) toast.error(result.error);
  }

  async function handleAddRival() {
    const domain = newRival.trim();
    if (!domain) return;
    setBusy(true);
    const result = await addCompetitor(website.id, domain);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setNewRival("");
    router.refresh();
  }

  async function handleRemoveRival(domain: string) {
    setRivals((current) => current.filter((r) => r.domain !== domain));
    const result = await removeCompetitor(website.id, domain);
    if (!result.ok) toast.error(result.error);
  }

  /**
   * Analysis is still running. The fields below are shown anyway rather than
   * hidden — the URL is already known and the rest fill in as they arrive, so
   * a customer who wants to start correcting can.
   */
  const stillWorking = analysing || website.status === "crawling";

  return (
    <div className="space-y-4">
      {stillWorking ? (
        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          <span>
            We are still reading your site. Fields fill in as we work them out —
            refresh in a minute if some are still empty.
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto shrink-0"
            onClick={() => router.refresh()}
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      ) : null}

      {/* The URL is what the customer typed, so it is shown but not editable —
          changing it would mean crawling a different site, which is a new
          website rather than an edit. */}
      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-2.5">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Brand URL
          </span>
        </div>
        <p className="px-4 py-3 font-mono text-sm">{website.url}</p>
      </div>

      <FieldCard
        label="Brand name"
        value={website.brandName}
        placeholder="What the business calls itself"
        onSave={(next) => saveField("brandName", next)}
      />
      <FieldCard
        label="Industry"
        value={website.industry}
        placeholder="e.g. dental clinic, wedding photography"
        onSave={(next) => saveField("industry", next)}
      />
      <FieldCard
        label="Primary market"
        value={website.country}
        placeholder="The country most of your customers are in"
        onSave={(next) => saveField("country", next)}
      />
      <FieldCard
        label="Main language"
        value={website.language}
        placeholder="The language you publish in"
        onSave={(next) => saveField("language", next)}
      />
      <FieldCard
        label="Description"
        value={website.description}
        placeholder="What the business does, in a sentence or two"
        multiline
        onSave={(next) => saveField("description", next)}
      />

      {/* Services: a list, edited in place. */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Services
          </span>
          {services.length > 0 ? (
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/40 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <Check className="size-3" aria-hidden="true" />
              {services.length}
            </span>
          ) : null}
        </div>
        <div className="space-y-2 px-4 py-3">
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              What you sell or offer. Add at least one.
            </p>
          ) : (
            services.map((service) => (
              <div key={service} className="flex items-center gap-2">
                <Check
                  className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {service}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    saveServices(services.filter((s) => s !== service))
                  }
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${service}`}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            ))
          )}

          <div className="flex gap-2 pt-1">
            <Input
              value={newService}
              onChange={(e) => setNewService(e.target.value)}
              placeholder="Add a service"
              className="h-9"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const value = newService.trim();
                if (!value) return;
                saveServices([...services, value]);
                setNewService("");
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-9"
              onClick={() => {
                const value = newService.trim();
                if (!value) return;
                saveServices([...services, value]);
                setNewService("");
              }}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* Competitors, with the ones we suggested marked as such. */}
      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-2.5">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Competitors
          </span>
          <p className="mt-1 text-xs text-muted-foreground">
            Who else shows up when buyers search your space. Remove any that are
            not really rivals.
          </p>
        </div>
        <div className="space-y-2 px-4 py-3">
          {rivals.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              None found yet. Add any you know of.
            </p>
          ) : (
            rivals.map((rival) => (
              <div key={rival.domain} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono text-sm">
                  {rival.domain}
                </span>
                {rival.source !== "manual" ? (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    suggested
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleRemoveRival(rival.domain)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${rival.domain}`}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            ))
          )}

          <div className="flex gap-2 pt-1">
            <Input
              value={newRival}
              onChange={(e) => setNewRival(e.target.value)}
              placeholder="competitor.com"
              className="h-9"
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                handleAddRival();
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-9"
              onClick={handleAddRival}
              disabled={busy || !newRival.trim()}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          className="h-11 rounded-full px-6"
          onClick={() => router.push("/onboarding/visibility")}
        >
          Next
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
