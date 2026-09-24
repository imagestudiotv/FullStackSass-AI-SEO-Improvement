"use client";

import {
  BookOpen,
  Check,
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  Loader2,
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
  keys,
  t,
  tCommon,
}: {
  websiteId: string;
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
