"use client";

import { Check, ExternalLink, Loader2, Plus, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "@/lib/publishing/actions";
import type { IntegrationView, ProviderInfo } from "@/lib/publishing/shared";

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
}: {
  websiteId: string;
  providers: ProviderInfo[];
  integrations: IntegrationView[];
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="size-4" aria-hidden="true" />
          Publishing
        </CardTitle>
        <CardDescription>
          Where your finished articles are published. You can connect more than
          one.
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
          <ul className="divide-y rounded-lg border">
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
                      <Badge className="gap-1">
                        <Check className="size-3" aria-hidden="true" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        {integration.status}
                      </Badge>
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
              </li>
            ))}
          </ul>
        )}

        {/* Choose a destination. */}
        {selected === null ? (
          <div className="flex flex-wrap gap-2">
            {providers.map((provider) => (
              <Button
                key={provider.id}
                variant="outline"
                size="sm"
                onClick={() => {
                  setAdding(provider.id);
                  setValues({});
                }}
                disabled={pending}
              >
                <Plus className="size-4" />
                {connectedKinds.has(provider.id)
                  ? `Reconnect ${provider.name}`
                  : provider.name}
              </Button>
            ))}
          </div>
        ) : (
          /*
            The form is generated from the provider's declared fields, so a new
            CMS needs no UI work — only an adapter and a registry entry.
          */
          <div className="space-y-4 rounded-lg border p-4">
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
      </CardContent>
    </Card>
  );
}
