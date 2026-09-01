"use client";

import {
  Check,
  Copy,
  Download,
  KeyRound,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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
}: {
  websiteId: string;
  keys: IntegrationKeyView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      toast.success("Key copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Select the key and copy it manually.");
    }
  }

  function handleRevoke(keyId: string) {
    startTransition(async () => {
      const result = await revokeKey(websiteId, keyId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Key revoked");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <p className="flex items-center gap-2 font-medium">
          <KeyRound className="size-4" aria-hidden="true" />
          WordPress plugin
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Install our plugin, paste a key, and articles publish here
          automatically. Works even if your site is behind a firewall or your
          host blocks the WordPress API.
        </p>
        {/*
          A plain link, not a fetch: the file is served straight from public/,
          and download attributes on a same-origin file are handled by the
          browser without any JavaScript to go wrong.
        */}
        <a
          href="/seovision-connector.zip"
          download
          className="mt-2 inline-flex items-center gap-1 text-sm underline underline-offset-4"
        >
          <Download className="size-3.5" aria-hidden="true" />
          Download the plugin
        </a>
      </div>

      {/* The one and only sighting of the key. */}
      {freshKey ? (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
          <p className="text-sm font-medium">
            Copy this now — it is not shown again
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            We only store a scrambled version, so it cannot be looked up later.
            If you lose it, revoke it and make a new one.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={freshKey}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Your new integration key"
              className="font-mono text-xs"
            />
            <Button onClick={handleCopy} variant="outline">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="ghost" onClick={() => setFreshKey(null)}>
              Done
            </Button>
          </div>
        </div>
      ) : null}

      {keys.length > 0 ? (
        <ul className="divide-y rounded-lg border">
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
                    : "Never used"}
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
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="What is this key for? (optional)"
          disabled={pending}
        />
        <Button onClick={handleGenerate} disabled={pending} variant="outline">
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          New key
        </Button>
      </div>
    </div>
  );
}
