"use client";

import {
  BookOpen,
  Check,
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
import type { Messages } from "@/lib/i18n/messages";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateIntegrationKey, revokeKey } from "@/lib/plugin/actions";
import type { IntegrationKeyView } from "@/lib/plugin/keys";

/**
 * Integration Keys for the WordPress plugin.
 *
 * The key is shown ONCE, at creation. It is stored only as a hash, so there is
 * genuinely no way to show it again — which the UI has to say plainly, because
 * a customer who closes this assuming they can look it up later ends up
 * creating a second key and leaving the first one live.
 */
export function PluginKeys({
  websiteId,
  siteUrl,
  keys,
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
  keys: IntegrationKeyView[];
  /** This screen's copy, already in the reader's language. */
  t: Messages["app"]["keys"];
  /** Shared words used on several screens. */
  tCommon: Messages["app"]["common"];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /**
   * Whether a key exists that WordPress has never called.
   *
   * That is the waiting state: the customer has copied a key and is pasting
   * it into their site in another tab. The moment the plugin calls
   * /api/plugin/verify, lastUsedAt is written - but by WORDPRESS, not by the
   * browser, so this page has no idea it happened.
   */
  const awaitingFirstUse = keys.some((key) => !key.lastUsedAt);

  /**
   * Their WordPress admin, at the screen that matters.
   *
   * The customer had to find these themselves: open a new tab, remember
   * their own admin address, navigate two levels down. We already store the
   * site address, so the link can simply be correct.
   *
   * Built with URL rather than string concatenation so a stored address with
   * a trailing slash, a port or a subdirectory install still produces a
   * usable link. Null on anything that will not parse - a broken link is
   * worse than none.
   */
  const adminUrls = (() => {
    if (!siteUrl) return null;
    try {
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
   * Poll while a key is waiting to be used.
   *
   * The client hit exactly this: "Status on wordpress connected, on repget is
   * not refreshing... Now finally worked, but I need to refresh the page.
   * Maybe we can find a way to mark complete directly?"
   *
   * There is no way to push from WordPress to this tab, and the connection is
   * made in a different browser tab on a different site - so polling is the
   * honest mechanism. Five seconds is fast enough to feel immediate while
   * someone is pasting a key, and the whole thing stops the moment every key
   * has been used, so a settled account polls nothing at all.
   *
   * router.refresh() re-runs the server component, which also re-reads the
   * launch checklist - so "Connect your site" ticks itself without the
   * customer reloading.
   */
  useEffect(() => {
    if (!awaitingFirstUse) return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [awaitingFirstUse, router]);

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateIntegrationKey(websiteId, label);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setFreshKey(result.data.key);
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

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div>
        <p className="flex items-center gap-2 font-medium">
          <KeyRound className="size-4" aria-hidden="true" />
          {t.pluginTitle}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.pluginHelp}
        </p>
        {/*
          A plain link, not a fetch: the file is served straight from public/,
          and download attributes on a same-origin file are handled by the
          browser without any JavaScript to go wrong.
        */}
        {/*
          Download and guide together.

          The panel offered the file and nothing else - so somebody who had
          never installed a WordPress plugin got a zip, a key, and no
          instructions. The written guide existed the whole time, as a text
          file at the root of the repository that no customer could reach.

          The guide opens in a new tab ON PURPOSE: it is read WHILE working
          through this panel, and navigating away would lose a freshly
          generated key that is shown exactly once.
        */}
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <a
            href="/repget-connector.zip"
            download
            className="inline-flex items-center gap-1 text-sm underline underline-offset-4"
          >
            <Download className="size-3.5" aria-hidden="true" />
            {tCommon.downloadPlugin}
          </a>
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
          {/*
            Straight to their own upload screen.

            The customer used to have to find this themselves: open a tab,
            remember their admin address, then Plugins -> Add New -> Upload
            Plugin. Three navigations before the zip they just downloaded is
            of any use. We already store the site address, so the link can
            simply be correct.
          */}
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
        </div>
      </div>

      {/* The one and only sighting of the key. */}
      {freshKey ? (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
          <p className="text-sm font-medium">
            {tCommon.copyNow}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.copyNowHelp}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={freshKey}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              aria-label={t.newKeyLabel}
              className="font-mono text-xs"
            />
            <Button onClick={handleCopy} variant="outline">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="ghost" onClick={() => setFreshKey(null)}>
              {tCommon.done}
            </Button>
          </div>

          {/*
            Opens WordPress with the key already in the field.

            This removes the step that fails most often - a partial copy,
            which produces "the key was rejected" and tells the customer
            nothing about why. They land on the plugin's own screen with the
            field filled and press Save and connect.

            IT DOES NOT CONNECT BY ITSELF. Acting on a GET would be a CSRF
            hole: an image tag on any page could repoint a logged-in
            administrator's site at somebody else's RepGet account. The usual
            defence is a nonce, and a nonce is generated by WordPress - this
            app has no way to produce one. So the link prepares the form and
            a human presses the button, which is nonce-checked like any other
            submission.

            Offered ALONGSIDE the copy field, never instead of it: the link
            needs the plugin already installed and active, and somebody who
            has not got that far still needs the key in their clipboard.
          */}
          {adminUrls ? (
            <a
              href={`${adminUrls.settings}&repget_key=${encodeURIComponent(freshKey)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              <Plug className="size-3.5" aria-hidden="true" />
              {t.connectInWordPress}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      ) : null}

      {keys.length > 0 ? (
        <ul className="divide-y rounded-xl border">
          {keys.map((key) => (
            <li
              key={key.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm">
                  {key.keyPrefix}
                  <span className="text-muted-foreground">…</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {key.label ? `${key.label} · ` : ""}
                  {/*
                    "Never used" is the useful state to surface: it usually
                    means the plugin was never activated, which is the first
                    thing to check when nothing publishes.
                  */}
                  {key.lastUsedAt
                    ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                    : t.neverUsed}
                  {key.siteInfo ? ` · ${key.siteInfo}` : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRevoke(key.id)}
                disabled={pending}
              >
                <X className="size-4" />
                {tCommon.revoke}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t.keyNotePlaceholder}
          disabled={pending}
        />
        <Button onClick={handleGenerate} disabled={pending} variant="outline">
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          {t.newKey}
        </Button>
      </div>
    </div>
  );
}
