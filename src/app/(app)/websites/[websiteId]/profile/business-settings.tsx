"use client";

import { AlertTriangle, Building2, FileText, MapPinned, RefreshCw, Swords } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, type FieldControlProps } from "@/components/workspace/field";
import { Notice } from "@/components/workspace/notice";
import { SaveBar, SaveBarSpacer } from "@/components/workspace/save-bar";
import { WorkspaceSection } from "@/components/workspace/section";
import { SectionNav, type SectionNavItem } from "@/components/workspace/section-nav";
import { useUnsavedChanges } from "@/components/workspace/use-unsaved-changes";
import { format, plural } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";
import { updateWebsiteDetails } from "@/lib/websites/actions";

import {
  afterSave,
  buildPatch,
  changedFields,
  changesBySection,
  checklistMissing,
  englishMarketFor,
  languageChoice,
  mergeRefreshed,
  profileValues,
  sameProfile,
  saveBarState,
  serverErrorMessage,
  statusAfterEdit,
  type Competitor,
  type Option,
  type ProfileField,
  type SaveStatus,
  type StoredProfile,
} from "./business-profile";
import { CompetitorsSection } from "./competitors-section";

export type BusinessWebsite = StoredProfile & { id: string; domain: string; status: string };

const SECTION_IDS = {
  identity: "business-identity",
  market: "business-market",
  about: "business-description",
  competitors: "business-competitors",
} as const;

/** The same box as Input, for the native language picker. */
const SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 motion-reduce:transition-none md:text-sm dark:bg-input/30";

/**
 * Business settings: three sections saved together by the page's Save bar
 * (identity, market and audience, description), and Competitors, which save
 * the moment they change.
 *
 * Save sends only the fields that changed (see buildPatch). Values stay on
 * screen through a failed save, and a refresh from the server only replaces
 * fields the person has not edited (see mergeRefreshed).
 */
export function BusinessSettings({
  website,
  competitors,
  competitorsTruncated,
  competitorLimit,
  canEdit,
  isOwner,
  languageOptions,
  marketSuggestions,
  marketAliases = {},
  dashboardLanguage,
  t,
  tw,
}: {
  website: BusinessWebsite;
  competitors: Competitor[];
  competitorsTruncated: boolean;
  competitorLimit: number;
  /** False for an invited viewer: the page is read-only and the server would refuse every write. */
  canEdit: boolean;
  /** Only the owner sees the Websites list's retry. */
  isOwner: boolean;
  /** Built on the server, labels in the reader's language. */
  languageOptions: Option[];
  marketSuggestions: Option[];
  /** Other-language country names (lowercased) -> the English name keyword research reads. */
  marketAliases?: Record<string, string>;
  /** The reader's dashboard language, named in that language. */
  dashboardLanguage: string;
  t: Messages["app"]["profile"];
  tw: Messages["app"]["workspace"];
}) {
  const router = useRouter();
  const fromServer = profileValues(website);

  const [saved, setSaved] = useState(fromServer);
  const [values, setValues] = useState(fromServer);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });

  /*
    A refresh (after a save, an add, or the analysis notice's button) brings
    new props. Untouched fields follow them; edited fields keep the edit.
  */
  const [seen, setSeen] = useState(fromServer);
  if (!sameProfile(seen, fromServer)) {
    setSeen(fromServer);
    setValues(mergeRefreshed(values, saved, fromServer));
    setSaved(fromServer);
  }

  const changed = changedFields(saved, values);
  const dirty = canEdit && changed.length > 0;
  const bySection = changesBySection(changed);
  useUnsavedChanges(dirty, tw.leaveConfirm);

  function set(field: ProfileField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    // Edits typed WHILE saving keep "saving", so they still get the "newer edits are kept" note when it lands.
    setStatus(statusAfterEdit);
  }

  async function save() {
    if (!canEdit || status.kind === "saving") return;
    const fields = changedFields(saved, values);
    if (fields.length === 0) return;
    const submitted = values;
    setStatus({ kind: "saving", count: fields.length });
    try {
      const result = await updateWebsiteDetails(website.id, buildPatch(fields, submitted));
      // No result: the server redirected (signed out) and the router is already leaving.
      if (!result) return;
      if (!result.ok) {
        setStatus({ kind: "failed", error: serverErrorMessage(result.error, t, tw) });
        return;
      }
      setSaved((current) => afterSave(current, fields, submitted));
      setStatus({ kind: "saved" });
      router.refresh();
    } catch {
      // Everything typed stays on screen; the error page would have thrown it away.
      setStatus({ kind: "failed", error: t.saveError });
    }
  }

  function discard() {
    setValues(saved);
    setStatus({ kind: "idle" });
  }

  const { bar, editsKept: keptAfterSave } = saveBarState(status, changed.length);

  // Primitives, so the section navigation is rebuilt only when a badge changes, not on every keystroke.
  const identityBadge = dirty && bySection.identity > 0 ? t.unsavedBadge : undefined;
  const marketBadge = dirty && bySection.market > 0 ? t.unsavedBadge : undefined;
  const aboutBadge = dirty && bySection.about > 0 ? t.unsavedBadge : undefined;
  const railItems: SectionNavItem[] = [
    { id: SECTION_IDS.identity, label: t.identityTitle, icon: Building2 },
    { id: SECTION_IDS.market, label: t.marketTitle, icon: MapPinned },
    { id: SECTION_IDS.about, label: t.descriptionTitle, icon: FileText },
    { id: SECTION_IDS.competitors, label: t.competitorsTitle, icon: Swords },
  ];
  /*
    The "Unsaved" badge rides only on the scrolling bar, whose links never
    wrap. In the 13rem rail a badge such as "Nicht gespeichert" leaves the
    title about 30px, and German, French and Italian titles then spill over
    it. Wide screens still see each section's own "N unsaved changes" pill
    and the Save bar's count.
  */
  const barItems: SectionNavItem[] = [
    { ...railItems[0], badge: identityBadge },
    { ...railItems[1], badge: marketBadge },
    { ...railItems[2], badge: aboutBadge },
    railItems[3],
  ];

  const pill = (count: number) =>
    canEdit && count > 0 ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-foreground">
        <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
        {plural(tw.unsaved, count)}
      </span>
    ) : null;

  /** One field: an editable control for owners and editors, the stored value as text for a viewer. */
  function field(
    key: ProfileField,
    {
      label,
      hint,
      className,
      control,
    }: { label: string; hint?: ReactNode; className?: string; control: (props: FieldControlProps) => ReactNode },
  ) {
    const id = `profile-${key}`;
    if (!canEdit) {
      const shown = key === "language" ? languageLabel(values.language, languageOptions) : values[key];
      return (
        <div className={cn("min-w-0 space-y-1", className)}>
          <dt className="text-sm font-medium text-foreground">{label}</dt>
          <dd className={cn("text-sm wrap-break-word whitespace-pre-line", shown.trim() ? "text-foreground" : "text-muted-foreground")}>
            {shown.trim() ? shown : t.notSet}
          </dd>
        </div>
      );
    }
    return (
      <Field id={id} label={label} hint={hint} t={tw} className={className}>
        {control}
      </Field>
    );
  }

  const Group = canEdit ? "div" : "dl";
  const language = languageChoice(values.language, saved.language, languageOptions);
  const englishMarket = canEdit ? englishMarketFor(values.country, marketAliases) : null;
  const missing = checklistMissing(saved);
  const analysing = website.status === "pending" || website.status === "crawling";
  const failed = website.status === "failed";

  let checklistNote: string | null = null;
  if (!analysing && canEdit) {
    if (missing.description && missing.language) checklistNote = t.checklistNeedsBoth;
    else if (missing.description) checklistNote = t.checklistNeedsDescription;
    else if (missing.language) checklistNote = t.checklistNeedsLanguage;
  }

  const sections = (
    <>
      <WorkspaceSection
        id={SECTION_IDS.identity}
        icon={Building2}
        title={t.identityTitle}
        description={t.identityHelp}
        actions={pill(bySection.identity)}
        bodyClassName="@container"
      >
        <Group className="grid gap-x-4 gap-y-5 @lg:grid-cols-2">
          {field("brandName", {
            label: t.brandName,
            hint: t.brandNameHint,
            control: (props) => (
              <Input
                {...props}
                value={values.brandName}
                placeholder={t.brandNamePlaceholder}
                autoComplete="off"
                onChange={(event) => set("brandName", event.target.value)}
              />
            ),
          })}
          {field("industry", {
            label: t.industry,
            hint: t.industryHint,
            control: (props) => (
              <Input
                {...props}
                value={values.industry}
                placeholder={t.industryPlaceholder}
                autoComplete="off"
                onChange={(event) => set("industry", event.target.value)}
              />
            ),
          })}
        </Group>
      </WorkspaceSection>

      <WorkspaceSection
        id={SECTION_IDS.market}
        icon={MapPinned}
        title={t.marketTitle}
        description={t.marketHelp}
        actions={pill(bySection.market)}
        bodyClassName="@container"
      >
        <Group className="grid gap-x-4 gap-y-5 @lg:grid-cols-2">
          {field("country", {
            label: t.country,
            hint: (
              <>
                {t.countryHint}
                {englishMarket ? (
                  // A warning with a fix, never a silent rewrite: the stored value changes only if they press it and save.
                  <span className="mt-1.5 flex flex-wrap items-start gap-x-1.5 gap-y-1 font-medium text-amber-800">
                    <AlertTriangle className="mt-1 size-3.5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0">{t.marketNotEnglish}</span>
                    <button
                      type="button"
                      onClick={() => set("country", englishMarket)}
                      className="rounded-sm text-primary underline underline-offset-4 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {format(t.marketUseEnglish, { country: englishMarket })}
                    </button>
                  </span>
                ) : null}
              </>
            ),
            control: (props) => (
              <>
                <Input
                  {...props}
                  list="profile-market-suggestions"
                  value={values.country}
                  placeholder={t.marketPlaceholder}
                  autoComplete="off"
                  onChange={(event) => set("country", event.target.value)}
                />
                <datalist id="profile-market-suggestions">
                  {marketSuggestions.map((market) => (
                    <option key={market.value} value={market.value} label={market.label || undefined} />
                  ))}
                </datalist>
              </>
            ),
          })}
          {field("language", {
            label: t.articleLanguage,
            hint: (
              <>
                {t.articleLanguageHint} {format(t.dashboardLanguageNote, { language: dashboardLanguage })}{" "}
                <Link
                  href="/settings#language"
                  className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {t.dashboardLanguageLink}
                </Link>
              </>
            ),
            control: (props) => (
              <select
                {...props}
                value={values.language}
                onChange={(event) => set("language", event.target.value)}
                className={cn(SELECT_CLASS, values.language === "" && "text-muted-foreground")}
              >
                {language.placeholder ? (
                  <option value="" disabled>
                    {t.chooseLanguage}
                  </option>
                ) : null}
                {language.unknown ? (
                  <option value={language.unknown} className="text-foreground">
                    {format(t.unknownLanguage, { language: language.unknown })}
                  </option>
                ) : null}
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value} className="text-foreground">
                    {option.label}
                  </option>
                ))}
              </select>
            ),
          })}
          {field("targetAudience", {
            label: t.audience,
            hint: t.audienceHint,
            className: "@lg:col-span-2",
            control: (props) => (
              <Textarea
                {...props}
                rows={3}
                value={values.targetAudience}
                placeholder={t.audiencePlaceholder}
                onChange={(event) => set("targetAudience", event.target.value)}
              />
            ),
          })}
        </Group>
      </WorkspaceSection>

      <WorkspaceSection
        id={SECTION_IDS.about}
        icon={FileText}
        title={t.descriptionTitle}
        description={t.descriptionHelp}
        actions={pill(bySection.about)}
      >
        <Group>
          {field("description", {
            label: t.description,
            hint: t.descriptionHint,
            control: (props) => (
              <Textarea
                {...props}
                rows={8}
                className="min-h-40"
                value={values.description}
                placeholder={t.descriptionPlaceholder}
                onChange={(event) => set("description", event.target.value)}
              />
            ),
          })}
        </Group>
      </WorkspaceSection>
    </>
  );

  return (
    <>
      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
        <aside className="hidden lg:block">
          <SectionNav items={railItems} label={tw.onThisPage} variant="rail" />
        </aside>

        <div className="min-w-0 space-y-6">
          <SectionNav items={barItems} label={tw.jumpTo} variant="bar" className="lg:hidden" />

          {!canEdit ? <Notice>{tw.viewOnly}</Notice> : null}

          {analysing ? (
            <Notice
              tone="warning"
              title={t.analysingTitle}
              action={
                <Button type="button" variant="outline" size="sm" onClick={() => router.refresh()}>
                  <RefreshCw aria-hidden="true" />
                  {t.refresh}
                </Button>
              }
            >
              {canEdit ? t.analysingBody : t.analysingBodyReadOnly}
            </Notice>
          ) : null}

          {failed ? (
            <Notice
              tone="warning"
              title={t.analysisFailedTitle}
              action={
                isOwner ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/websites">{t.goToWebsites}</Link>
                  </Button>
                ) : null
              }
            >
              {canEdit ? t.analysisFailedBody : t.analysisFailedBodyReadOnly}
              {isOwner ? ` ${t.analysisFailedRetry}` : null}
            </Notice>
          ) : null}

          {checklistNote ? <Notice>{checklistNote}</Notice> : null}

          {/*
            No <form> submit on Enter: one press in the market field (whose
            suggestion list also takes Enter) would save three sections at
            once. The Save bar is the one way to save, and it says what it
            covers.
          */}
          <div className="space-y-6">{sections}</div>

          <CompetitorsSection
            id={SECTION_IDS.competitors}
            websiteId={website.id}
            ownDomain={website.domain}
            competitors={competitors}
            truncated={competitorsTruncated}
            limit={competitorLimit}
            status={website.status}
            canEdit={canEdit}
            t={t}
            tw={tw}
          />

          {canEdit ? <SaveBarSpacer /> : null}
        </div>
      </div>

      {canEdit ? (
        <SaveBar
          state={bar}
          onSave={() => void save()}
          onDiscard={discard}
          t={tw}
          saveLabel={t.saveBusinessDetails}
          note={keptAfterSave ? tw.editsKept : t.saveScope}
        />
      ) : null}
    </>
  );
}

/** The picker's label for a stored language, or the raw value for one outside the list. */
function languageLabel(value: string, options: readonly Option[]): string {
  return options.find((option) => option.value === value)?.label ?? value;
}
