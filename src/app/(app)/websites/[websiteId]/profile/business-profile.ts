import type { SaveBarState } from "@/components/workspace/save-bar";
import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import type { WebsiteDetailsInput } from "@/lib/websites/actions";

/**
 * The Business settings page's rules, kept out of the components so they can
 * be tested on their own: which fields changed, what a Save sends, how a
 * refresh from the server is merged with edits still on screen, and how a
 * competitor address is checked before the (slow) server check runs.
 *
 * No React and no server imports: the client components and the tests both
 * use this file.
 */

/** The six columns updateWebsiteDetails accepts, in the order the page shows them. */
export const PROFILE_FIELDS = ["brandName", "industry", "country", "language", "targetAudience", "description"] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];
export type ProfileValues = Record<ProfileField, string>;

/** The page's three form sections and the fields each one holds. Competitors save on their own. */
export type ProfileSectionId = "identity" | "market" | "about";

export const SECTION_FIELDS: Record<ProfileSectionId, readonly ProfileField[]> = {
  identity: ["brandName", "industry"],
  market: ["country", "language", "targetAudience"],
  about: ["description"],
};

export type StoredProfile = {
  brandName: string | null;
  industry: string | null;
  country: string | null;
  language: string | null;
  targetAudience: string | null;
  description: string | null;
};

/** What the form starts from: the stored row, with NULL shown as an empty field. */
export function profileValues(site: StoredProfile): ProfileValues {
  return {
    brandName: site.brandName ?? "",
    industry: site.industry ?? "",
    country: site.country ?? "",
    language: site.language ?? "",
    targetAudience: site.targetAudience ?? "",
    description: site.description ?? "",
  };
}

/**
 * Two values are the same when they store the same thing. The server trims
 * every field before writing it, so a trailing space is not a change worth a
 * Save - and counting it as one would leave a Save that changes nothing.
 */
function sameStored(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

/** The fields that differ from what is saved, in page order. */
export function changedFields(saved: ProfileValues, current: ProfileValues): ProfileField[] {
  return PROFILE_FIELDS.filter((field) => !sameStored(saved[field], current[field]));
}

/**
 * The request for a Save: ONLY the changed fields.
 *
 * updateWebsiteDetails treats a missing key as "leave alone" and an empty
 * string as "clear". Sending all six (as the old form did) wrote the page's
 * stale copy over anything that changed since it loaded - an analysis that
 * finished meanwhile, or a colleague's correction - and an empty field the
 * person never touched cleared the stored value.
 */
export function buildPatch(fields: readonly ProfileField[], current: ProfileValues): WebsiteDetailsInput {
  const patch: WebsiteDetailsInput = {};
  for (const field of fields) patch[field] = current[field];
  return patch;
}

/** The saved values once the server accepted a Save of `fields` from `submitted`. */
export function afterSave(saved: ProfileValues, fields: readonly ProfileField[], submitted: ProfileValues): ProfileValues {
  const next = { ...saved };
  for (const field of fields) next[field] = submitted[field].trim();
  return next;
}

/**
 * Fresh values from the server (after a refresh), merged with the form.
 *
 * A field the person has not touched since the last save follows the server;
 * a field they have edited keeps their edit. So a refresh never throws away
 * typing, and an untouched field never shows a value the server no longer has.
 */
export function mergeRefreshed(current: ProfileValues, previousSaved: ProfileValues, fresh: ProfileValues): ProfileValues {
  const next = { ...current };
  for (const field of PROFILE_FIELDS) {
    if (sameStored(current[field], previousSaved[field])) next[field] = fresh[field];
  }
  return next;
}

export function sameProfile(a: ProfileValues, b: ProfileValues): boolean {
  return PROFILE_FIELDS.every((field) => a[field] === b[field]);
}

/** How many unsaved fields each section holds. */
export function changesBySection(fields: readonly ProfileField[]): Record<ProfileSectionId, number> {
  const counts: Record<ProfileSectionId, number> = { identity: 0, market: 0, about: 0 };
  for (const section of Object.keys(SECTION_FIELDS) as ProfileSectionId[]) {
    counts[section] = SECTION_FIELDS[section].filter((field) => fields.includes(field)).length;
  }
  return counts;
}

/** Where the page's one Save stands. */
export type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving"; count: number }
  | { kind: "saved" }
  | { kind: "failed"; error: string };

/**
 * What the Save bar shows. A failure stays on screen while there is still
 * something to save; "saved" only once the server confirmed it. `editsKept`
 * is true right after a save that landed while the person kept typing, so
 * the bar can say those newer edits still need saving.
 */
export function saveBarState(status: SaveStatus, changedCount: number): { bar: SaveBarState; editsKept: boolean } {
  if (status.kind === "saving") return { bar: { kind: "saving", count: status.count }, editsKept: false };
  if (changedCount > 0 && status.kind === "failed") {
    return { bar: { kind: "failed", error: status.error, count: changedCount }, editsKept: false };
  }
  if (changedCount > 0) return { bar: { kind: "dirty", count: changedCount }, editsKept: status.kind === "saved" };
  if (status.kind === "saved") return { bar: { kind: "saved" }, editsKept: false };
  return { bar: { kind: "clean" }, editsKept: false };
}

/**
 * The status once the person edits a field. A finished save is old news: the
 * bar goes back to saying what Save covers instead of "your newer edits are
 * kept" for the rest of the visit. Saving and failed states are left alone.
 */
export function statusAfterEdit(status: SaveStatus): SaveStatus {
  return status.kind === "saved" ? { kind: "idle" } : status;
}

/**
 * What the launch checklist still needs from this page. Its "profile" step is
 * done when the stored description AND language are set
 * (lib/onboarding/launch.ts), so this reads the SAVED values, not the form.
 */
export function checklistMissing(saved: ProfileValues): { description: boolean; language: boolean } {
  return { description: saved.description.trim() === "", language: saved.language.trim() === "" };
}

/**
 * The English name for a market typed in another language ("España" ->
 * "Spain"), or null when the value is empty, already English (in any case -
 * keyword research ignores case) or not one we know another name for.
 */
export function englishMarketFor(value: string, aliases: Readonly<Record<string, string>>): string | null {
  const key = value.trim().toLowerCase();
  if (!key || !Object.hasOwn(aliases, key)) return null;
  return aliases[key];
}

/* ------------------------------------------------------------------------ */
/* Competitors                                                               */
/* ------------------------------------------------------------------------ */

export type Competitor = { domain: string; source: string | null };

/**
 * Only "manual" is the customer's own choice. "ai_suggested" and the NULL of
 * older rows both came from analysis (scripts/prune-competitors.mjs reads it
 * the same way).
 */
export function isSuggested(competitor: Competitor): boolean {
  return competitor.source !== "manual";
}

/**
 * The domain the server will store for what was typed, or null when the
 * server would refuse it as malformed.
 *
 * A copy of normalizeWebsiteUrl's domain step (lib/websites/url.ts), which
 * cannot be imported here: it pulls in node:net. It only decides what to say
 * BEFORE asking the server - "already in your list", "that is your own site",
 * "not an address" - so nobody waits seconds for a check whose answer is
 * known. The server still normalises, validates and verifies everything.
 */
export function guessDomain(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const host = parsed.hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.+$/, "");
  const domain = host.startsWith("www.") ? host.slice(4) : host;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) ? domain : null;
}

export type CompetitorCheck =
  | { ok: true; domain: string }
  | { ok: false; reason: "required" | "invalid" | "ownSite" | "duplicate"; domain?: string };

/** The checks that need no network, in the order a person would want to hear them. */
export function checkCompetitorInput(
  raw: string,
  { ownDomain, existing }: { ownDomain: string; existing: readonly Competitor[] },
): CompetitorCheck {
  if (!raw.trim()) return { ok: false, reason: "required" };
  const domain = guessDomain(raw);
  if (!domain) return { ok: false, reason: "invalid" };
  const own = ownDomain.toLowerCase().replace(/^www\./, "");
  if (domain === own) return { ok: false, reason: "ownSite", domain };
  if (existing.some((competitor) => competitor.domain === domain)) {
    return { ok: false, reason: "duplicate", domain };
  }
  return { ok: true, domain };
}

type ProfileMessages = Messages["app"]["profile"];
type WorkspaceMessages = Messages["app"]["workspace"];

export function competitorCheckMessage(check: Exclude<CompetitorCheck, { ok: true }>, t: ProfileMessages): string {
  switch (check.reason) {
    case "required":
      return t.competitorRequired;
    case "invalid":
      return t.competitorInvalid;
    case "ownSite":
      return t.competitorOwnSite;
    case "duplicate":
      return format(t.competitorDuplicate, { domain: check.domain ?? "" });
  }
}

/**
 * The server's refusals, in the reader's language.
 *
 * The actions answer in English (lib/websites/require-editor.ts,
 * actions.ts, url.ts). Those strings are matched here and replaced, and
 * anything unrecognised is shown as the server wrote it rather than hidden.
 * The url.ts "not a social profile" message was written for a customer
 * entering their OWN site; for a competitor it is reworded to what it means.
 */
export function serverErrorMessage(error: string, t: ProfileMessages, tw: WorkspaceMessages): string {
  const text = error.trim();
  if (text === "You have view-only access to this website.") return tw.viewOnly;
  if (text === "That is your own website.") return t.competitorOwnSite;
  if (text === "Enter a valid website address") return t.competitorInvalid;
  if (text === "That address is not a public website") return t.competitorNotPublic;
  if (text === "Enter your own website, not a social profile") return t.competitorBlocked;
  const unreachable = /^We could not reach (\S+) \(.*\)\. Check the spelling\.$/.exec(text);
  if (unreachable) return format(t.competitorUnreachable, { domain: unreachable[1] });
  return text;
}

/* ------------------------------------------------------------------------ */
/* Language picker                                                           */
/* ------------------------------------------------------------------------ */

export type Option = { value: string; label: string };

/**
 * What the article-language picker must offer for a stored value.
 *
 *  - Nothing stored: a "Choose a language" placeholder is selected. Without
 *    it the browser selects the first option and the picker claims English
 *    while nothing is saved (the launch checklist step stays open and the
 *    article prompt gets no language).
 *  - A stored value outside the list (a legacy "Catalan"): kept as its own
 *    option, so saving another field never silently switches it. Read from
 *    the SAVED value, so it stays on offer after picking something else.
 */
export function languageChoice(
  current: string,
  saved: string,
  options: readonly Option[],
): { placeholder: boolean; unknown: string | null } {
  const known = (value: string) => options.some((option) => option.value === value);
  const unknown = [saved, current].find((value) => value !== "" && !known(value)) ?? null;
  return { placeholder: current === "", unknown };
}
