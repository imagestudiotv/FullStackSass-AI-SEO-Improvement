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
import type { Messages } from "@/lib/i18n/messages";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { ProviderLogo } from "@/components/provider-logo";
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
  t,
  tKeys,
  tCommon,
  tStatus,
}: {
  websiteId: string;
  providers: ProviderInfo[];
  integrations: IntegrationView[];
  pluginKeys: IntegrationKeyView[];
  /** This screen's copy, already in the reader's language. */
  t: Messages["app"]["publishing"];
  /** The key panel's own slice, forwarded to it. */
  tKeys: Messages["app"]["keys"];
  /** Shared words used on several screens. */
  tCommon: Messages["app"]["common"];
  /** The status vocabulary, for the badges. */
  tStatus: Messages["app"]["status"];
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
      toast.success(t.connectedTo(result.data.siteName));
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
        ? t.draftPublishedAt(result.data.remoteUrl)
        : t.draftPublished,
    );
  }

  function handleDisconnect(kind: string, name: string) {
    startTransition(async () => {
      const result = await disconnectProvider(websiteId, kind);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t.disconnectedFrom(name));
      router.refresh();
    });
  }

  /** Close the open form, discarding whatever was typed into it. */
  function closeForm() {
    setAdding(null);
    setValues({});
  }

  /**
   * Opening a provider clears the form. Clicking the provider that is already
   * open closes it again, so the card's button is a toggle rather than a
   * one-way door — the same click that opened the form takes it back.
   */
  function openForm(providerId: string) {
    setAdding((current) => (current === providerId ? null : providerId));
    setValues({});
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

  /** Props every card needs, gathered so the two grids stay in step. */
  const cardProps = {
    selectedId: adding,
    connectedKinds,
    pending,
    values,
    setValues,
    onToggle: openForm,
    onConnect: handleConnect,
    onCancel: closeForm,
    t,
    tCommon,
  };

  return (
    <Card>
      <CardHeader>
        {/*
          "Connect Your Website", as the design titles it, rather than
          "Publishing". The heading names the job the customer came to do;
          "Publishing" named the part of the system doing it, which is our
          word for it rather than theirs.
        */}
        <CardTitle className="text-xl">{t.connectTitle}</CardTitle>
        <CardDescription>{t.connectHelp}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {integrations.length === 0 ? (
          <EmptyState
            icon={Send}
            title={t.nothingConnected}
            description={t.nothingConnectedHelp}
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
                      <StatusBadge status={integration.status} t={tStatus} />
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
                          {t.publishing}
                        </>
                      ) : (
                        t.publishTest
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
                  {t.disconnect}
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

          The grid is always on screen. The credential form used to replace
          it, so choosing a platform emptied the page of every other one and
          the only way back to the choice was Cancel — a customer comparing
          two platforms, or one who clicked the wrong card, had to undo
          before they could look again. Now the form opens inside the card
          that was clicked, and the rest of the platforms stay where they
          were, still visible by scrolling past it.
        */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {platforms.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} {...cardProps} />
          ))}

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
            <p className="font-medium">{t.cantFind}</p>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">
              {t.cantFindHelp}
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
              {t.contactUs}
            </Button>
          </div>
        </div>

        <PluginKeys
          websiteId={websiteId}
          keys={pluginKeys}
          t={tKeys}
          tCommon={tCommon}
        />

        {/*
          For developers, as the design separates it.

          Stays on screen while a credential form is open, for the same
          reason the platform grid does: opening WordPress should not hide
          the webhook, which is often the thing somebody falls back to when
          the platform form turns out to ask for something they do not have.
        */}
        {developerOptions.length > 0 ? (
          <div className="space-y-3 border-t pt-6">
            <div>
              <p className="font-medium">{t.forDevelopers}</p>
              <p className="text-sm text-muted-foreground">
                {t.noPlatformMatch}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {developerOptions.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  {...cardProps}
                />
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * One platform, and its credential form when it is the one chosen.
 *
 * The open card spans the whole grid row — the form's labelled fields need
 * the width, and a card that grew inside a single column would push its
 * neighbours down by a screen's worth of empty space. Spanning keeps the
 * cards below it exactly where the customer last saw them.
 */
function ProviderCard({
  provider,
  selectedId,
  connectedKinds,
  pending,
  values,
  setValues,
  onToggle,
  onConnect,
  onCancel,
  t,
  tCommon,
}: {
  provider: ProviderInfo;
  selectedId: string | null;
  connectedKinds: Set<string>;
  pending: boolean;
  values: Record<string, string>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onToggle: (providerId: string) => void;
  onConnect: () => void;
  onCancel: () => void;
  t: Messages["app"]["publishing"];
  tCommon: Messages["app"]["common"];
}) {
  const connected = connectedKinds.has(provider.id);
  const open = selectedId === provider.id;

  /**
   * Bring the opened form into view and put the cursor in its first field.
   *
   * The card that was clicked is already on screen, but its form is not: on a
   * three-column grid the form unfolds below the fold, and without this the
   * click appears to do nothing. Scrolling the card — not the field — keeps
   * the provider's name in frame, so it stays obvious which one is being
   * connected.
   */
  const cardRef = useRef<HTMLDivElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    firstFieldRef.current?.focus();
  }, [open]);

  return (
    <div
      ref={cardRef}
      className={`flex flex-col rounded-xl border p-4 ${
        open ? "sm:col-span-2 lg:col-span-3 border-primary/50 shadow-sm" : ""
      } ${connected && !open ? "border-emerald-500/40 bg-emerald-500/5" : ""}`}
    >
      <div className="flex items-start gap-3">
        {/*
          A provider with no brand mark falls back to the puzzle piece —
          which is the right answer for "anything that speaks HTTP".
        */}
        <ProviderLogo providerId={provider.id} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{provider.name}</p>
            {connected ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <Check className="size-3" aria-hidden="true" />
                {t.connected}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {provider.description}
          </p>
          {open && provider.helpUrl ? (
            <a
              href={provider.helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm underline underline-offset-4"
            >
              {t.whereDoIFind}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>

      {open ? (
        /*
          The form is generated from the provider's declared fields, so a new
          CMS needs no UI work — only an adapter and a registry entry.
        */
        <div className="mt-4 space-y-4 border-t pt-4">
          {provider.fields.map((field, index) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={`${provider.id}-${field.key}`}>
                {field.label}
              </Label>
              <Input
                id={`${provider.id}-${field.key}`}
                ref={index === 0 ? firstFieldRef : undefined}
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
            <Button onClick={onConnect} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {tCommon.checking}
                </>
              ) : (
                tCommon.connect
              )}
            </Button>
            <Button variant="ghost" onClick={onCancel} disabled={pending}>
              {tCommon.cancel}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">{t.checkBeforeSaving}</p>
        </div>
      ) : (
        <>
          <div className="flex-1" aria-hidden="true" />
          <Button
            variant={connected ? "secondary" : "outline"}
            size="sm"
            className="mt-3 self-start"
            onClick={() => onToggle(provider.id)}
            disabled={pending}
          >
            {connected ? (
              "Manage"
            ) : (
              <>
                <Plus className="size-4" />
                {tCommon.connect}
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}
