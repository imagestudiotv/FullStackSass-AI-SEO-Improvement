"use client";

import {
  Check,
  ExternalLink,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/states";
import {
  connectProvider,
  disconnectProvider,
  publishTestArticle,
} from "@/lib/publishing/actions";
import type { IntegrationView, ProviderInfo } from "@/lib/publishing/shared";
import type { IntegrationKeyView } from "@/lib/plugin/keys";
import { PluginKeys } from "./plugin-keys";

/**
 * Where articles get published.
 *
 * Replaces the WordPress-only panel. A website may connect more than one
 * destination, and the form renders itself from whichever provider is chosen —
 * so adding a CMS needs no change here at all.
 */
export function PublishingPanel({
  websiteId,
  providers,
  integrations,
  pluginKeys,
}: {
  websiteId: string;
  providers: ProviderInfo[];
  integrations: IntegrationView[];
  pluginKeys: IntegrationKeyView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const selected = providers.find((p) => p.id === adding) ?? null;
  const connectedKinds = new Set(integrations.map((i) => i.kind));

  function handleConnect() {
    if (!selected) return;
    startTransition(async () => {
      const result = await connectProvider(websiteId, selected.id, values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Connected to ${result.data.siteName}`);
      setAdding(null);
      setValues({});
      router.refresh();
    });
  }

  /** Which integration is mid-test, so only that row shows a spinner. */
  const [testing, setTesting] = useState<string | null>(null);

  async function handleTest(integrationId: string) {
    setTesting(integrationId);
    const result = await publishTestArticle(websiteId, integrationId);
    setTesting(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    /**
     * The URL matters more than the confirmation. "It worked" is a claim; a
     * link the customer can open is proof, and it is also how they find the
     * draft to delete.
     */
    toast.success(
      result.data.remoteUrl
        ? `Draft published — open it at ${result.data.remoteUrl}`
        : "Draft published successfully. Check your site's drafts.",
    );
  }

  function handleDisconnect(kind: string, name: string) {
    startTransition(async () => {
      const result = await disconnectProvider(websiteId, kind);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Disconnected from ${name}`);
      router.refresh();
    });
  }

  /**
   * CMS platforms and developer options are shown separately, as the design
   * splits them.
   *
   * A webhook is not a platform you "connect to" - it is what you reach for
   * when none of the platforms fit, and putting it in the same grid asked a
   * non-technical customer to consider it as a peer of WordPress. Below a
   * "For developers" heading it reads as the escape hatch it is.
   *
   * Derived from the registry rather than hardcoded, so a new provider lands
   * in the right group by declaring itself rather than by being added to a
   * list here.
   */
  const DEVELOPER_IDS = new Set(["webhook", "api"]);
  const platforms = providers.filter((p) => !DEVELOPER_IDS.has(p.id));
  const developerOptions = providers.filter((p) => DEVELOPER_IDS.has(p.id));

  return (
    <Card>
      <CardHeader>
        {/*
          "Connect Your Website", as the design titles it, rather than
          "Publishing". The heading names the job the customer came to do;
          "Publishing" named the part of the system doing it, which is our
          word for it rather than theirs.
        */}
        <CardTitle className="text-xl">Connect Your Website</CardTitle>
        <CardDescription>
          Connect your website once and new articles will get published to your
          blog automatically.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {integrations.length === 0 ? (
          <EmptyState
            icon={Send}
            title="Nothing connected yet"
            description="Connect your website and we can publish finished articles straight to it. Until then, you can still copy them out by hand."
          />
        ) : (
          <ul className="divide-y rounded-xl border">
            {integrations.map((integration) => (
              <li
                key={integration.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {integration.providerName}
                    </span>
                    {integration.status === "connected" ? (
                      <StatusBadge status="connected" />
                    ) : (
                      <StatusBadge status={integration.status} />
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {integration.siteName ?? "—"}
                    {integration.accountLabel
                      ? ` · ${integration.accountLabel}`
                      : ""}
                  </p>
                  {/*
                    Masked secrets, so the customer can tell which credential is
                    in use without it ever being sent back to the browser.
                  */}
                  {Object.entries(integration.secretHints).length > 0 ? (
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground/80">
                      {Object.values(integration.secretHints).join(" · ")}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  {/*
                    Only offered on a live connection. testConnection already
                    proved the credentials work, but only a real write finds the
                    failures customers actually hit — a plugin rejecting the
                    payload, a media upload timing out — and finding them now
                    beats finding them when the first scheduled article
                    silently fails overnight.
                  */}
                  {integration.status === "connected" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(integration.id)}
                      disabled={pending || testing !== null}
                    >
                      {testing === integration.id ? (
                        <>
                          <Loader2
                            className="size-3.5 animate-spin"
                            aria-hidden="true"
                          />
                          Publishing…
                        </>
                      ) : (
                        "Publish test article"
                      )}
                    </Button>
                  ) : null}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    handleDisconnect(
                      integration.kind,
                      integration.providerName,
                    )
                  }
                  disabled={pending}
                >
                  <X className="size-4" />
                  Disconnect
                </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/*
          Choose a destination — a card grid, as the client drew it.

          It was a row of small outline buttons. The design gives each
          platform a card with its name, what connecting does, and a state:
          "Connected" with a Manage action, or "+ Connect". That difference
          is not decoration — the row of buttons could not show which
          platforms were already connected without reading the list above it,
          so the same information appeared twice and neither place was
          obviously the answer.

          Each card still opens the same generated credential form below, so
          adding a provider to the registry still adds a card with no work
          here.
        */}
        {selected === null ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {platforms.map((provider) => {
              const connected = connectedKinds.has(provider.id);
              return (
                <div
                  key={provider.id}
                  className={`flex flex-col rounded-xl border p-4 ${
                    connected ? "border-emerald-500/40 bg-emerald-500/5" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{provider.name}</p>
                    {connected ? (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        <Check className="size-3" aria-hidden="true" />
                        Connected
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1 flex-1 text-sm text-muted-foreground">
                    {provider.description}
                  </p>

                  <Button
                    variant={connected ? "secondary" : "outline"}
                    size="sm"
                    className="mt-3 self-start"
                    onClick={() => {
                      setAdding(provider.id);
                      setValues({});
                    }}
                    disabled={pending}
                  >
                    {connected ? (
                      "Manage"
                    ) : (
                      <>
                        <Plus className="size-4" />
                        Connect
                      </>
                    )}
                  </Button>
                </div>
              );
            })}

            {/*
              The last card in the design: a way out for somebody whose
              platform is not listed.

              Not a dead end and not a form. It opens the support chat that
              is already on every page, because the useful answer to "my CMS
              is missing" is a conversation - which platform, how many
              people want it - and a contact form would collect that into an
              inbox nobody is watching.
            */}
            <div className="flex flex-col rounded-xl border border-dashed p-4">
              <p className="font-medium">Can&rsquo;t find your integration?</p>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">
                Tell us which platform you use and we will look at adding it.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 self-start"
                onClick={() => {
                  /*
                    Crisp is loaded on every page inside (app); $crisp is its
                    command queue, so pushing works whether or not the script
                    has finished loading. Falling back to a mailto keeps the
                    button honest if the widget is blocked.
                  */
                  const crisp = (
                    window as unknown as {
                      $crisp?: { push: (command: unknown[]) => void };
                    }
                  ).$crisp;
                  if (crisp) {
                    crisp.push(["do", "chat:open"]);
                    crisp.push([
                      "set",
                      "message:text",
                      ["I use a platform that is not listed: "],
                    ]);
                  } else {
                    window.location.href =
                      "mailto:support@repget.com?subject=Integration%20request";
                  }
                }}
              >
                <MessageCircle className="size-4" />
                Contact us
              </Button>
            </div>
          </div>
        ) : (
          /*
            The form is generated from the provider's declared fields, so a new
            CMS needs no UI work — only an adapter and a registry entry.
          */
          <div className="space-y-4 rounded-xl border p-4">
            <div>
              <p className="font-medium">Connect {selected.name}</p>
              <p className="text-sm text-muted-foreground">
                {selected.description}
              </p>
              {selected.helpUrl ? (
                <a
                  href={selected.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-sm underline underline-offset-4"
                >
                  Where do I find these?
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              ) : null}
            </div>

            {selected.fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  type={field.secret ? "password" : "text"}
                  value={values[field.key] ?? ""}
                  placeholder={field.placeholder}
                  autoComplete="off"
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                />
                {field.help ? (
                  <p className="text-xs text-muted-foreground">{field.help}</p>
                ) : null}
              </div>
            ))}

            <div className="flex gap-2">
              <Button onClick={handleConnect} disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Checking…
                  </>
                ) : (
                  "Connect"
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setAdding(null);
                  setValues({});
                }}
                disabled={pending}
              >
                Cancel
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              We check the connection before saving anything, so you find out
              here if something is wrong rather than when an article fails to
              appear.
            </p>
          </div>
        )}
        <PluginKeys websiteId={websiteId} keys={pluginKeys} />
        {/*
          For developers, as the design separates it.

          Rendered only when a developer option exists and no credential form
          is open - the form replaces the choice above it, and a second
          heading below an open form would suggest there is more to pick.
        */}
        {selected === null && developerOptions.length > 0 ? (
          <div className="space-y-3 border-t pt-6">
            <div>
              <p className="font-medium">For developers</p>
              <p className="text-sm text-muted-foreground">
                No platform match? Publish anywhere with a webhook.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {developerOptions.map((provider) => {
                const connected = connectedKinds.has(provider.id);
                return (
                  <div
                    key={provider.id}
                    className={`flex flex-col rounded-xl border p-4 ${
                      connected ? "border-emerald-500/40 bg-emerald-500/5" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{provider.name}</p>
                      {connected ? (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          <Check className="size-3" aria-hidden="true" />
                          Connected
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 flex-1 text-sm text-muted-foreground">
                      {provider.description}
                    </p>
                    <Button
                      variant={connected ? "secondary" : "outline"}
                      size="sm"
                      className="mt-3 self-start"
                      onClick={() => {
                        setAdding(provider.id);
                        setValues({});
                      }}
                      disabled={pending}
                    >
                      {connected ? (
                        "Manage"
                      ) : (
                        <>
                          <Plus className="size-4" />
                          Connect
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
