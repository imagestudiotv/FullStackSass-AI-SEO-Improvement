"use client";

import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  Loader2,
  Plug,
  Plus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate, intlTag } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { connectWordPress, generateIntegrationKey, revokeKey } from "@/lib/plugin/actions";
import { CONNECT_KEY_LABEL, MANUAL_KEY_LABEL } from "@/lib/plugin/connect-label";
import { IDLE, reconcileWatch, resumeWatch, watchKey, type WatchState } from "@/lib/plugin/connect-watch";
import type { IntegrationKeyView } from "@/lib/plugin/keys";

/** After this long without WordPress calling, the likely reasons are shown. */
const STALLED_AFTER_MS = 2 * 60 * 1000;

/** How often the screen re-reads the keys while it waits and is visible... */
const POLL_MS = 4000;

/** ...and, after this many polls (five minutes), only every fourth one. */
const FAST_POLLS = 75;

/** The first characters the server lists for a key: how this tab recognises its own keys. */
const prefixOf = (key: string) => key.slice(0, 12);

/**
 * Connecting WordPress.
 *
 * WHAT CHANGED (2026-09-29). A key used to be made when this screen first
 * opened, and shown once. A customer who missed that moment - another tab, a
 * reload, a second account - found "Never used" and "Keys are shown only
 * once", while their WordPress already said "Connected" with some other key.
 * Nothing on either screen said which account WordPress belonged to.
 *
 * Now nothing is made on arrival. "Connect WordPress" makes a key at the
 * moment of the click and opens the customer's WordPress with it already in
 * the field (plugin 1.6.0 reads it from the address fragment), so the only
 * step left is Save and connect there. This screen then waits - also after a
 * reload - and turns green by itself when WordPress calls. The card says
 * which workspace it is connecting, and warns when the same person has the
 * domain in another one.
 *
 * Keys are still stored only as hashes: the plaintext exists in this tab's
 * memory and in the WordPress tab's address fragment, never in a query
 * string, a log or storage.
 */
export function PluginKeys({
  websiteId,
  siteUrl,
  wordpressAdmin,
  keys,
  canEdit,
  context,
  locale,
  t,
  tCommon,
}: {
  websiteId: string;
  /**
   * The customer's own website address, for the links into their WordPress
   * admin. Null when it will not parse, which hides those links rather than
   * offering one that goes nowhere.
   */
  siteUrl: string | null;
  /**
   * The wp-admin address a plugin of this website reported
   * ("https://example.com/blog/wp-admin/"), when one has: the website's
   * address cannot say whether WordPress lives in a subdirectory.
   */
  wordpressAdmin?: string | null;
  keys: IntegrationKeyView[];
  /** False for a viewer: they see the status, and nothing is created for them. */
  canEdit: boolean;
  /** Which workspace this connects, and where else the person has the domain. */
  context: { domain: string; workspaceName: string; alsoIn: string[] } | null;
  /** The reader's language, for dates and lists. */
  locale: Locale;
  /** This screen's copy, already in the reader's language. */
  t: Messages["app"]["keys"];
  /** Shared words used on several screens. */
  tCommon: Messages["app"]["common"];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  /** The latest key this tab made, in memory only, until WordPress uses it. */
  const [freshKey, setFreshKey] = useState<string | null>(null);
  /** The one-click link made with it, for plugin 1.7.0 (lib/plugin/handshake.ts). */
  const [freshLink, setFreshLink] = useState<string | null>(null);
  /**
   * How that key reached WordPress: opened in a tab ("opened"), a tab the
   * browser blocked or that could not be opened ("blocked"), or a key made
   * by hand with "New key" ("manual") - the last two show the key to copy.
   */
  const [mode, setMode] = useState<"opened" | "blocked" | "manual">("opened");
  /*
    What this screen is waiting for (lib/plugin/connect-watch.ts). After a
    reload the plaintext is gone, but a key the SERVER still lists as pending
    means a connection is under way: the screen starts out waiting for it, so
    it still turns green by itself when WordPress saves it. Decided from the
    server's data alone, so the server's render and the browser's agree.
  */
  const [watch, setWatch] = useState<WatchState>(() => (canEdit ? resumeWatch(keys) : IDLE));
  /** When the wait began, and the time now - set by the browser's clock only, never while rendering on the server. */
  const [waitingSince, setWaitingSince] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  /** Counts WordPress connections seen, so the toast fires once per connection. */
  const [announced, setAnnounced] = useState(0);
  const [prevKeys, setPrevKeys] = useState(keys);
  /** Why a wait ended without a connection, and which keys were connected then (a later connection hides it). */
  const [notice, setNotice] = useState<{ kind: "replaced" | "expired"; connectedThen: string[] } | null>(null);
  const [copied, setCopied] = useState(false);

  /**
   * Their WordPress admin, at the screen that matters: under the wp-admin
   * address their plugin reported when it has (a WordPress in a
   * subdirectory, example.com/blog), else at the root of their website's
   * address - which is only a guess, since the website's address cannot say
   * where WordPress lives. Built with URL, so a trailing slash or a port
   * still produce a usable link; null on anything that will not parse.
   */
  const adminUrls = (() => {
    try {
      if (wordpressAdmin) {
        const admin = new URL(wordpressAdmin);
        return {
          install: new URL("plugin-install.php?tab=upload", admin).toString(),
          settings: new URL("admin.php?page=repget", admin).toString(),
        };
      }
      if (!siteUrl) return null;
      const base = new URL(siteUrl);
      return {
        // The upload form, with the file picker already on screen.
        install: new URL("/wp-admin/plugin-install.php?tab=upload", base).toString(),
        // Where the key goes, once the plugin is active.
        settings: new URL("/wp-admin/admin.php?page=repget", base).toString(),
      };
    } catch {
      return null;
    }
  })();

  /**
   * The key in the ADDRESS FRAGMENT, never the query string: browsers never
   * send the part after # to a server, so it stays out of access logs and
   * Referer headers. Plugin 1.6.0 reads it into its key field and clears the
   * address bar. It does NOT connect by itself - acting on a link would be a
   * CSRF hole - the administrator presses the nonce-checked Save and connect.
   */
  /*
    Plus the one-click link in the query (the settings address already has
    ?page=repget): plugin 1.7.0 sees it, ignores the key, and finishes with
    one button and a server-to-server handshake (docs/wordpress-connect.md).
    1.6.x ignores the link and uses the key.
  */
  const wordPressWithKey = (key: string, link: string | null) =>
    adminUrls
      ? `${adminUrls.settings}${link ? `&repget_link=${encodeURIComponent(link)}` : ""}#repget_key=${encodeURIComponent(key)}`
      : null;

  const connected = keys
    .filter((key) => key.lastUsedAt)
    .sort((a, b) => new Date(b.lastUsedAt!).getTime() - new Date(a.lastUsedAt!).getTime())[0];

  /** The connected site's plugin, when older than 1.7.0 - which connects in one click and updates itself. */
  const olderPlugin = (() => {
    const match = /plugin (\d+)\.(\d+)\.(\d+)/.exec(connected?.siteInfo ?? "");
    if (!match) return null;
    const [major, minor] = [Number(match[1]), Number(match[2])];
    return major < 1 || (major === 1 && minor < 7) ? `${match[1]}.${match[2]}.${match[3]}` : null;
  })();

  /*
    New keys from the server (every refresh): is the wait over, and why?
    Worked out while rendering, when the keys change (React's pattern for
    state that follows a prop), not in an effect.
  */
  if (keys !== prevKeys) {
    setPrevKeys(keys);
    const next = reconcileWatch(watch, keys);
    if (next.state !== watch) setWatch(next.state);
    if (next.outcome) {
      setWaitingSince(null);
      setFreshKey(null);
      setFreshLink(null);
      if (next.outcome === "connected") {
        setAnnounced((count) => count + 1);
        setNotice(null);
      } else {
        setNotice({ kind: next.outcome, connectedThen: keys.filter((key) => key.lastUsedAt).map((key) => key.keyPrefix) });
      }
    } else if (freshKey && !next.state.watching.includes(prefixOf(freshKey))) {
      setFreshKey(null);
      setFreshLink(null);
    }
  }

  // The toast is the one side effect: once per connection seen.
  useEffect(() => {
    if (announced > 0) toast.success(t.connectedToast);
  }, [announced, t.connectedToast]);

  const waiting = watch.watching.length > 0;
  const stalled = waiting && now !== null && waitingSince !== null && now - waitingSince > STALLED_AFTER_MS;
  // A notice about an earlier attempt is moot once WordPress has connected since.
  const showNotice =
    notice && !waiting && !keys.some((key) => key.lastUsedAt && !notice.connectedThen.includes(key.keyPrefix));

  /*
    Wait for WordPress. It calls RepGet, not this tab, so the tab asks: the
    server component re-reads the keys (and the setup checklist, which then
    ticks "Connect your site" by itself). Only while waiting; only while the
    tab is visible - the customer is in WordPress meanwhile - and at once when
    they come back. The wait ends when the server stops listing the key as
    pending: used, superseded, revoked, or past its grace period.
  */
  useEffect(() => {
    if (!waiting) return;
    let polls = 0;
    const refresh = () => {
      const current = Date.now();
      setNow(current);
      setWaitingSince((since) => since ?? current);
      if (document.visibilityState !== "visible") return;
      polls += 1;
      if (polls > FAST_POLLS && polls % 4 !== 0) return;
      router.refresh();
    };
    const timer = setInterval(refresh, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        polls = 0;
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [waiting, router]);

  function startWaiting(key: string, how: "opened" | "blocked" | "manual", link: string | null) {
    setFreshKey(key);
    setFreshLink(link);
    setMode(how);
    setWatch((current) => watchKey(current, prefixOf(key), keys));
    setWaitingSince(Date.now());
    setNotice(null);
  }

  function handleConnect() {
    /*
      Pressed again while this tab is waiting: the same key, in a new
      WordPress tab. A new key here would leave the first tab holding a key
      the customer might still save.
    */
    if (freshKey && waiting && mode !== "manual") {
      const target = wordPressWithKey(freshKey, freshLink);
      // Without "noopener": with it, window.open returns null even when the tab opened.
      const tab = target ? window.open(target, "_blank") : null;
      if (tab) {
        try {
          tab.opener = null;
        } catch {
          // Some browsers refuse the assignment.
        }
      } else {
        setMode("blocked");
      }
      return;
    }
    /*
      The tab is opened NOW, inside the click. Opened after an await, popup
      blockers refuse it. It starts blank, is cut off from this page
      (opener = null), and is sent to WordPress once the key exists.
    */
    const tab = adminUrls ? window.open("", "_blank") : null;
    if (tab) {
      try {
        tab.opener = null;
      } catch {
        // Some browsers refuse the assignment; the tab is still ours to steer.
      }
    }
    startTransition(async () => {
      try {
        const result = await connectWordPress(websiteId);
        if (!result.ok) {
          tab?.close();
          toast.error(result.error);
          return;
        }
        const target = wordPressWithKey(result.data.key, result.data.link);
        if (tab && !tab.closed && target) {
          tab.location.replace(target);
          startWaiting(result.data.key, "opened", result.data.link);
        } else {
          tab?.close();
          // No tab (blocked, closed meanwhile) or no usable site address: show the key.
          startWaiting(result.data.key, target ? "blocked" : "manual", result.data.link);
        }
        router.refresh();
      } catch (error) {
        tab?.close();
        throw error;
      }
    });
  }

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateIntegrationKey(websiteId, label);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      startWaiting(result.data.key, "manual", null);
      setLabel("");
      router.refresh();
    });
  }

  async function handleCopy() {
    if (!freshKey) return;
    try {
      await navigator.clipboard.writeText(freshKey);
      setCopied(true);
      toast.success(t.keyCopied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t.keyCopyFailed);
    }
  }

  function handleRevoke(keyId: string) {
    startTransition(async () => {
      const result = await revokeKey(websiteId, keyId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t.keyRevoked);
      router.refresh();
    });
  }

  /** Dates on the UTC calendar: the server and the browser then render the same text. */
  const day = (value: Date | string) => formatDate(value, locale, { timeZone: "UTC" });

  const openAgainHref = freshKey ? wordPressWithKey(freshKey, freshLink) : null;
  const otherWorkspaces = context
    ? new Intl.ListFormat(intlTag(locale), { type: "conjunction" }).format(
        context.alsoIn.map((name) => format(t.quotedName, { name })),
      )
    : "";

  return (
    <div className="space-y-4 rounded-xl border p-4" id="wordpress">
      <div>
        <p className="flex items-center gap-2 font-medium">
          <KeyRound className="size-4" aria-hidden="true" />
          {t.pluginTitle}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{t.pluginHelp}</p>
        {context ? (
          <p className="mt-1 text-sm">
            {format(t.connectingIn, { domain: context.domain, workspace: context.workspaceName })}
          </p>
        ) : null}
      </div>

      {/*
        The same domain in another of this person's workspaces: exactly the
        imagestudio.com mix-up. Only workspaces they belong to are named.
      */}
      {context && context.alsoIn.length > 0 ? (
        <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm" role="note">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <p>{format(t.alsoIn, { domain: context.domain, workspaces: otherWorkspaces })}</p>
        </div>
      ) : null}

      {connected ? (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm" role="status">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium">
              {t.connectedTitle}
              {connected.siteInfo ? ` · ${connected.siteInfo}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">{format(t.lastCheckIn, { date: day(connected.lastUsedAt!) })}</p>
            {olderPlugin ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {format(t.updatePlugin, { version: olderPlugin })}{" "}
                <a href="/repget-connector.zip" download className="underline underline-offset-4">
                  {tCommon.downloadPlugin}
                </a>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* 1. Install */}
      <div className="space-y-1">
        <p className="text-sm font-medium">{t.stepInstall}</p>
        <p className="text-xs text-muted-foreground">{t.stepInstallHelp}</p>
        <div className="flex flex-wrap items-center gap-4 pt-1">
          <a href="/repget-connector.zip" download className="inline-flex items-center gap-1 text-sm underline underline-offset-4">
            <Download className="size-3.5" aria-hidden="true" />
            {tCommon.downloadPlugin}
          </a>
          {adminUrls ? (
            <a
              href={adminUrls.install}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm underline underline-offset-4"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              {t.openWordPress}
            </a>
          ) : null}
          <a
            href="/docs/integrations/wordpress-plugin"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm underline underline-offset-4"
          >
            <BookOpen className="size-3.5" aria-hidden="true" />
            {tCommon.pluginGuide}
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* 2. Connect */}
      {canEdit ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t.stepConnect}</p>
          <p className="text-xs text-muted-foreground">{t.stepConnectHelp}</p>
          <Button onClick={handleConnect} disabled={pending} variant={connected && !waiting ? "outline" : "default"}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plug className="size-4" aria-hidden="true" />}
            {connected && !waiting ? t.reconnectButton : t.connectButton}
          </Button>
        </div>
      ) : null}

      {showNotice ? (
        <p className="text-sm text-muted-foreground" role="status">
          {notice.kind === "replaced" ? t.keyReplaced : t.gaveUp}
        </p>
      ) : null}

      {/* Waiting for WordPress to use a key this screen made (or found under way after a reload). */}
      {waiting ? (
        <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <div role="status" aria-live="polite" className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t.waitingTitle}
            </p>
            <p className="text-sm text-muted-foreground">
              {!freshKey
                ? t.waitingResumed
                : mode === "blocked"
                  ? t.popupBlocked
                  : mode === "manual"
                    ? t.nextSteps
                    : t.waitingHelp}
            </p>
            {stalled ? <p className="text-sm">{t.stalledHelp}</p> : null}
          </div>
          {freshKey && mode !== "opened" ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t.copyNowHelp}</p>
              <Input
                value={freshKey}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
                aria-label={t.newKeyLabel}
                className="font-mono text-xs"
              />
            </div>
          ) : null}
          {freshKey ? (
            <div className="flex flex-wrap items-center gap-2">
              {openAgainHref ? (
                <a
                  href={openAgainHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted"
                >
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  {t.openAgain}
                </a>
              ) : null}
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                {t.copyInstead}
              </Button>
            </div>
          ) : null}
          {mode !== "manual" ? <p className="text-xs text-muted-foreground">{t.notActiveHelp}</p> : null}
        </div>
      ) : null}

      {/*
        Keys, for the few who need them: a second WordPress install connected
        by hand, or stopping an install (Revoke). Closed by default - the
        button above is the way to connect.
      */}
      {keys.length > 0 || canEdit ? (
        <details className="rounded-lg border">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
            {t.advancedTitle}
            {keys.length > 0 ? ` (${keys.length})` : ""}
          </summary>
          <div className="space-y-3 border-t p-3">
            <p className="text-xs text-muted-foreground">{t.advancedHelp}</p>
            {keys.length > 0 ? (
              <ul className="divide-y rounded-lg border">
                {keys.map((key) => (
                  <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-mono text-sm">
                        {key.keyPrefix}
                        <span className="text-muted-foreground">…</span>
                        {connected && key.id === connected.id ? (
                          <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 font-sans text-xs text-emerald-700">
                            {t.connectedTitle}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {key.label
                          ? `${key.label === CONNECT_KEY_LABEL ? t.madeByConnect : key.label === MANUAL_KEY_LABEL ? t.madeByHand : key.label} · `
                          : ""}
                        {key.lastUsedAt ? format(t.lastCheckIn, { date: day(key.lastUsedAt) }) : t.neverUsed}
                        {key.siteInfo ? ` · ${key.siteInfo}` : ""}
                      </p>
                    </div>
                    {canEdit ? (
                      <Button variant="ghost" size="sm" onClick={() => handleRevoke(key.id)} disabled={pending}>
                        <X className="size-4" aria-hidden="true" />
                        {tCommon.revoke}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {canEdit ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={t.keyNotePlaceholder}
                  disabled={pending}
                />
                <Button onClick={handleGenerate} disabled={pending} variant="outline">
                  {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
                  {t.newKey}
                </Button>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
