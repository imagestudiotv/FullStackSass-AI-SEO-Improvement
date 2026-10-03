"use client";

import { BarChart3, ChevronDown, Download, Link2, Loader2, RefreshCw, Search, Settings2, Unplug } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { Field } from "@/components/workspace/field";
import { Notice } from "@/components/workspace/notice";
import { WorkspaceSection } from "@/components/workspace/section";
import { useUnsavedChanges } from "@/components/workspace/use-unsaved-changes";
import {
  disconnectGoogle,
  listProperties,
  selectProperties,
  startGoogleConnect,
  startImport,
  type AnalyticsConnection,
  type AvailableProperties,
} from "@/lib/analytics/actions";
import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

import { analyticsPropertyId } from "./google/report-state";

type T = Messages["app"]["analytics"];
type TWorkspace = Messages["app"]["workspace"];

type Props = {
  websiteId: string;
  connection: AnalyticsConnection;
  /** False for a viewer: every control the server would refuse is left out. */
  canEdit: boolean;
  /** Newest day each source reported, formatted on the server; null when nothing was imported. */
  freshness: { search: string | null; analytics: string | null };
  /** Whether the period holds figures (getPerformance's test); ends the import polling early. */
  hasData: boolean;
  /** The report sections, rendered on the server. Absent while there is nothing to report on. */
  report?: ReactNode;
  /** This screen's copy, already in the reader's language. */
  t: T;
  /** The shared workspace words (view-only, unsaved changes, close). */
  tWorkspace: TWorkspace;
};

/** Messages for the ?google= parameter the OAuth callback redirects with. */
const CALLBACK_MESSAGE: Record<string, { key: keyof T; ok: boolean }> = {
  connected: { key: "statusConnected", ok: true },
  cancelled: { key: "statusCancelled", ok: false },
  forbidden: { key: "statusForbidden", ok: false },
  invalid_request: { key: "statusInvalid", ok: false },
  error: { key: "statusError", ok: false },
};

/**
 * The server actions answer in English (lib/analytics/actions.ts and
 * requireEditor). The ones this page can meet are shown in the reader's
 * language; anything else is shown as sent rather than hidden.
 */
const SERVER_ERRORS: Record<string, keyof T> = {
  "Google integration is not configured yet.": "errorNotConfigured",
  "Sign in to connect Google.": "errorSignIn",
  "Reconnect your Google account": "errorReconnect",
  "Connect Google first": "errorConnectFirst",
  "Choose a property to import from first": "errorChooseFirst",
};
const VIEW_ONLY_ERROR = "You have view-only access to this website.";

export function translateServerError(error: string, t: T, tWorkspace: TWorkspace): string {
  if (error === VIEW_ONLY_ERROR) return tWorkspace.viewOnly;
  const key = SERVER_ERRORS[error];
  return key ? t[key] : error;
}

/** How often, and how many times, to refresh while an import runs. */
const IMPORT_POLL_MS = 4000;
const IMPORT_POLL_TICKS = 15;

/** A native select drawn exactly like the Input primitive. */
const SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm motion-reduce:transition-none";

/**
 * Google Search Console and Analytics for one website: connect, choose the
 * properties, import, reconnect and disconnect. The figures themselves are
 * rendered on the server (google/report-sections.tsx) and passed in as
 * `report`, so this client component holds only what needs the browser.
 *
 * The OAuth contract is unchanged: startGoogleConnect gives the consent URL,
 * the browser goes there, and the callback route comes back with ?google=,
 * which is announced once and then cleared from the address.
 */
export function AnalyticsPanel({ websiteId, connection, canEdit, freshness, hasData, report, t, tWorkspace }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const callback = params.get("google");

  useEffect(() => {
    if (!callback) return;
    const message = CALLBACK_MESSAGE[callback];
    if (!message) return;
    if (message.ok) toast.success(t[message.key]);
    else toast.error(t[message.key]);
    // Cleared so a refresh does not repeat the toast. Stays on this page.
    router.replace(`/websites/${websiteId}/google`);
  }, [callback, router, websiteId, t]);

  // Keyed on the connection, so connecting or disconnecting starts each half fresh.
  return connection.connected ? (
    <ConnectedPanel
      key="connected"
      websiteId={websiteId}
      connection={connection}
      canEdit={canEdit}
      freshness={freshness}
      hasData={hasData}
      report={report}
      t={t}
      tWorkspace={tWorkspace}
    />
  ) : (
    <ConnectPanel key="not-connected" websiteId={websiteId} expired={connection.status === "expired"} canEdit={canEdit} t={t} tWorkspace={tWorkspace} />
  );
}

/** Starts Google's consent screen. Shared by Connect and Reconnect. */
function useGoogleConnect(websiteId: string, t: T, tWorkspace: TWorkspace) {
  const [connecting, startTransition] = useTransition();
  function connect() {
    startTransition(async () => {
      try {
        const result = await startGoogleConnect(websiteId);
        if (!result.ok) {
          toast.error(translateServerError(result.error, t, tWorkspace));
          return;
        }
        window.location.assign(result.data.url);
      } catch {
        toast.error(t.statusError);
      }
    });
  }
  return { connect, connecting };
}

/* ------------------------------------------------------------------------ */
/* Not connected                                                            */
/* ------------------------------------------------------------------------ */

function ConnectPanel({
  websiteId,
  expired,
  canEdit,
  t,
  tWorkspace,
}: {
  websiteId: string;
  expired: boolean;
  canEdit: boolean;
  t: T;
  tWorkspace: TWorkspace;
}) {
  const { connect, connecting } = useGoogleConnect(websiteId, t, tWorkspace);

  return (
    <WorkspaceSection id="google-connection" icon={Link2} title={t.connectTitle} description={t.connectHelp}>
      <div className="space-y-5">
        {expired ? (
          <Notice tone="warning" title={t.expiredTitle}>
            {t.expired}
          </Notice>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <SourceIntro icon={Search} name={t.searchConsoleName} purpose={t.searchConsolePurpose} />
          <SourceIntro icon={BarChart3} name={t.analyticsName} purpose={t.analyticsPurpose} />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">{t.setupTitle}</h3>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-foreground">
            <li>{t.setupStep1}</li>
            <li>{t.setupStep2}</li>
            <li>{t.setupStep3}</li>
          </ol>
        </div>

        {canEdit ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <Button onClick={connect} disabled={connecting} className="w-full sm:w-auto">
              {connecting ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              {connecting ? t.redirecting : expired ? t.reconnectGoogle : t.connectGoogle}
            </Button>
            <p className="text-xs text-muted-foreground">{t.readOnlyAccess}</p>
          </div>
        ) : (
          <Notice>{t.viewerCannotConnect}</Notice>
        )}
      </div>
    </WorkspaceSection>
  );
}

function SourceIntro({ icon: Icon, name, purpose }: { icon: LucideIcon; name: string; purpose: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-muted/20 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        {name}
      </h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{purpose}</p>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Connected                                                                */
/* ------------------------------------------------------------------------ */

type PropertyList = { kind: "idle" } | { kind: "loading" } | { kind: "ready"; data: AvailableProperties } | { kind: "failed" };

type Option = { value: string; label: string };

/** The account's properties, plus the saved one when the account no longer lists it (so it never shows blank). */
function withSaved(options: Option[], saved: string, savedLabel: string): Option[] {
  if (!saved || options.some((o) => o.value === saved)) return options;
  return [...options, { value: saved, label: savedLabel }];
}

function ConnectedPanel({
  websiteId,
  connection,
  canEdit,
  freshness,
  hasData,
  report,
  t,
  tWorkspace,
}: Props) {
  const router = useRouter();
  const { connect, connecting } = useGoogleConnect(websiteId, t, tWorkspace);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"save" | "import" | "disconnect" | null>(null);

  const savedSc = connection.searchConsoleSite ?? "";
  const savedGa = connection.analyticsProperty ?? "";
  const needsSetup = !savedSc && !savedGa;
  const [scSite, setScSite] = useState(savedSc);
  const [gaProperty, setGaProperty] = useState(savedGa);
  const dirty = scSite !== savedSc || gaProperty !== savedGa;
  useUnsavedChanges(canEdit && dirty, tWorkspace.leaveConfirm);

  // Open from the start when there is nothing chosen yet: choosing is the only next step.
  const [open, setOpen] = useState(needsSetup);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const panelId = useId();

  /*
    The account's properties are fetched only for someone who can change
    them. A viewer sees the saved choice as text and never receives the list
    of everything in the owner's Google account.
  */
  const [list, setList] = useState<PropertyList>(canEdit ? { kind: "loading" } : { kind: "idle" });
  useEffect(() => {
    if (!canEdit || list.kind !== "loading") return;
    let cancelled = false;
    listProperties(websiteId).then(
      (result) => {
        if (!cancelled) setList(result.ok ? { kind: "ready", data: result.data } : { kind: "failed" });
      },
      // A refresh token Google no longer accepts throws here; it must not become an unhandled rejection.
      () => {
        if (!cancelled) setList({ kind: "failed" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [canEdit, list.kind, websiteId]);

  /*
    The report's "Choose a property" links here; following it opens the
    choice. The click is watched as well as the hash: once the address ends in
    #google-connection, following the link again changes no hash, and the
    panel could not be reopened after being folded away.
  */
  useEffect(() => {
    if (!canEdit) return;
    const onHash = () => {
      if (window.location.hash === "#google-connection") setOpen(true);
    };
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest?.('a[href="#google-connection"]')) setOpen(true);
    };
    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
    };
  }, [canEdit]);

  /*
    The import runs as a background job, so the refresh right after queueing it
    usually lands before any rows exist. Keep refreshing for a while, stopping
    once figures appear for a site that had none. There is no stored job
    status to read, so afterwards the page says the import may still be
    running rather than claiming it finished.
  */
  const [awaitingImport, setAwaitingImport] = useState(0);
  const [importPhase, setImportPhase] = useState<"idle" | "checking" | "waiting">("idle");
  const hasDataRef = useRef(hasData);
  useEffect(() => {
    hasDataRef.current = hasData;
  }, [hasData]);
  useEffect(() => {
    if (!awaitingImport) return;
    const startedEmpty = !hasDataRef.current;
    let ticks = 0;
    const timer = setInterval(() => {
      if (startedEmpty && hasDataRef.current) {
        clearInterval(timer);
        setImportPhase("idle");
        return;
      }
      ticks += 1;
      router.refresh();
      if (ticks >= IMPORT_POLL_TICKS) {
        clearInterval(timer);
        setImportPhase("waiting");
      }
    }, IMPORT_POLL_MS);
    return () => clearInterval(timer);
  }, [awaitingImport, router]);

  async function queueImport(): Promise<void> {
    const result = await startImport(websiteId);
    if (!result.ok) {
      toast.error(translateServerError(result.error, t, tWorkspace));
      return;
    }
    toast.success(t.importing);
    router.refresh();
    setImportPhase("checking");
    setAwaitingImport(Date.now());
  }

  /*
    Saving also imports: people pick their properties, press the primary
    button, and expect their numbers - nobody reads "then import".
  */
  function handleSave() {
    setBusy("save");
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof selectProperties>>;
      try {
        result = await selectProperties(websiteId, {
          searchConsoleSite: scSite || null,
          analyticsProperty: gaProperty || null,
        });
      } catch {
        // A connection Google no longer accepts throws on the server (token refresh).
        toast.error(t.googleUnreachable);
        return;
      }
      if (!result.ok) {
        toast.error(translateServerError(result.error, t, tWorkspace));
        return;
      }
      if (!scSite && !gaProperty) {
        toast.success(t.propertiesSaved);
        router.refresh();
        return;
      }
      try {
        await queueImport();
      } catch {
        toast.error(t.importFailed);
      }
    });
  }

  function handleImport() {
    setBusy("import");
    startTransition(async () => {
      try {
        await queueImport();
      } catch {
        toast.error(t.importFailed);
      }
    });
  }

  function handleDisconnect() {
    setBusy("disconnect");
    startTransition(async () => {
      try {
        const result = await disconnectGoogle(websiteId);
        if (!result.ok) {
          toast.error(translateServerError(result.error, t, tWorkspace));
          return;
        }
        setConfirmOpen(false);
        toast.success(t.disconnected);
        router.refresh();
      } catch {
        toast.error(t.disconnectFailed);
      }
    });
  }

  const working = pending || connecting;
  const spinner = <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />;

  const ready = list.kind === "ready" ? list.data : null;
  const gaName = (value: string) =>
    ready?.analytics.find((p) => p.name === value)?.displayName ?? format(t.analyticsPropertyId, { id: analyticsPropertyId(value) });
  const unavailable = (name: string) => (ready ? format(t.propertyUnavailable, { name }) : name);
  const scOptions = withSaved(
    (ready?.searchConsole ?? []).map((s) => ({ value: s.siteUrl, label: s.siteUrl })),
    savedSc,
    unavailable(savedSc),
  );
  const gaOptions = withSaved(
    (ready?.analytics ?? []).map((p) => ({ value: p.name, label: p.displayName })),
    savedGa,
    unavailable(gaName(savedGa)),
  );

  return (
    <>
      <WorkspaceSection
        id="google-connection"
        icon={Link2}
        title={t.connectionTitle}
        description={t.connectionHelp}
        actions={<StatusBadge status="connected" label={t.connected} />}
      >
        <div className="space-y-4">
          <dl className="grid gap-4 md:grid-cols-2">
            <PropertySummary icon={Search} name={t.searchConsoleName} value={savedSc || null} through={freshness.search} t={t} />
            <PropertySummary icon={BarChart3} name={t.analyticsName} value={savedGa ? gaName(savedGa) : null} through={freshness.analytics} t={t} />
          </dl>

          {needsSetup && !canEdit ? <Notice>{t.viewerSetupPending}</Notice> : null}

          {/* Below the figures rather than in the header, so long labels never squeeze the title. */}
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              {!needsSetup ? (
                <Button variant="outline" size="sm" onClick={handleImport} disabled={working}>
                  {busy === "import" && pending ? spinner : <Download aria-hidden="true" />}
                  {t.importNow}
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
                <Settings2 aria-hidden="true" />
                {t.manageConnection}
                <ChevronDown className={cn("transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
              </Button>
            </div>
          ) : null}

          {importPhase === "checking" ? (
            <Notice role="status" title={t.importRequestedTitle}>
              {t.importRequestedBody}
            </Notice>
          ) : null}
          {importPhase === "waiting" ? <Notice role="status">{t.importStillRunning}</Notice> : null}

          {canEdit ? (
            <div id={panelId} hidden={!open} className="space-y-5 border-t pt-5">
              {needsSetup ? (
                <Notice title={t.setupNeededTitle}>{t.setupNeededBody}</Notice>
              ) : null}

              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">{t.propertiesTitle}</h3>
                <p className="text-sm text-muted-foreground">{t.propertiesHelp}</p>
              </div>

              {list.kind === "loading" ? (
                <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  {t.loadingProperties}
                </p>
              ) : null}
              {list.kind === "failed" ? (
                <Notice
                  tone="danger"
                  role="alert"
                  action={
                    <Button variant="outline" size="sm" onClick={() => setList({ kind: "loading" })}>
                      <RefreshCw aria-hidden="true" />
                      {t.tryAgain}
                    </Button>
                  }
                >
                  {t.propertiesFailed}
                </Notice>
              ) : null}

              <div className="grid gap-x-4 gap-y-5 lg:grid-cols-2">
                <Field
                  id={`${panelId}-search-console`}
                  label={t.searchConsoleProperty}
                  hint={ready && ready.searchConsole.length === 0 ? t.noSearchConsoleFound : t.searchConsoleHint}
                  t={tWorkspace}
                >
                  {(field) => (
                    <select
                      {...field}
                      value={scSite}
                      onChange={(event) => setScSite(event.target.value)}
                      disabled={working || list.kind === "loading"}
                      className={SELECT_CLASS}
                    >
                      <option value="">{t.noSearchConsoleProperty}</option>
                      {scOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field
                  id={`${panelId}-analytics`}
                  label={t.analyticsProperty}
                  hint={ready && ready.analytics.length === 0 ? t.noAnalyticsFound : t.analyticsHint}
                  t={tWorkspace}
                >
                  {(field) => (
                    <select
                      {...field}
                      value={gaProperty}
                      onChange={(event) => setGaProperty(event.target.value)}
                      disabled={working || list.kind === "loading"}
                      className={SELECT_CLASS}
                    >
                      <option value="">{t.noAnalyticsProperty}</option>
                      {gaOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleSave} disabled={working || !dirty}>
                  {busy === "save" && pending ? spinner : null}
                  {scSite || gaProperty ? t.saveAndImport : t.saveSelection}
                </Button>
                {/* Also says why Save is unavailable while nothing has changed. */}
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {dirty ? t.selectionUnsaved : t.noSelectionChange}
                </p>
              </div>

              <div className="space-y-3 border-t pt-5">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">{t.accountTitle}</h3>
                  <p className="text-sm text-muted-foreground">{t.accountHelp}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={connect} disabled={working}>
                    {connecting ? spinner : <RefreshCw aria-hidden="true" />}
                    {connecting ? t.redirecting : t.reconnectGoogle}
                  </Button>
                  <Dialog
                    open={confirmOpen}
                    onOpenChange={(next) => {
                      // Stays open while the disconnect is in flight.
                      if (!pending) setConfirmOpen(next);
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={working}>
                        <Unplug aria-hidden="true" />
                        {t.disconnect}
                      </Button>
                    </DialogTrigger>
                    <DialogContent closeLabel={tWorkspace.close}>
                      <DialogHeader>
                        <DialogTitle>{t.disconnectTitle}</DialogTitle>
                        <DialogDescription>{t.disconnectBody}</DialogDescription>
                      </DialogHeader>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        <li>{t.disconnectKeeps}</li>
                        <li>{t.disconnectAccess}</li>
                      </ul>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline" disabled={pending}>
                            {t.cancel}
                          </Button>
                        </DialogClose>
                        <Button variant="destructive" onClick={handleDisconnect} disabled={pending}>
                          {busy === "disconnect" && pending ? spinner : <Unplug aria-hidden="true" />}
                          {busy === "disconnect" && pending ? t.disconnecting : t.disconnect}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </WorkspaceSection>

      {report}
    </>
  );
}

function PropertySummary({
  icon: Icon,
  name,
  value,
  through,
  t,
}: {
  icon: LucideIcon;
  name: string;
  value: string | null;
  through: string | null;
  t: T;
}) {
  return (
    <div className="min-w-0 rounded-lg border bg-muted/20 p-4">
      <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        {name}
      </dt>
      <dd className="mt-1 text-sm font-medium break-all text-foreground">
        {value ?? <span className="font-normal text-muted-foreground">{t.notChosen}</span>}
      </dd>
      {through || value ? (
        <dd className="mt-1 text-xs text-muted-foreground">{through ? format(t.dataThrough, { date: through }) : t.noFiguresYet}</dd>
      ) : null}
    </div>
  );
}
