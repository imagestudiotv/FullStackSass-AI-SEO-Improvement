"use client";

import { BarChart3, Download, Loader2, Unplug } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  disconnectGoogle,
  listProperties,
  selectProperties,
  startGoogleConnect,
  startImport,
  type AnalyticsConnection,
  type AvailableProperties,
  type PerformanceSummary,
} from "@/lib/analytics/actions";

type Props = {
  websiteId: string;
  connection: AnalyticsConnection;
  performance: PerformanceSummary;
};

/** Messages for the ?google= parameter the OAuth callback redirects with. */
const CALLBACK_MESSAGE: Record<string, { text: string; ok: boolean }> = {
  connected: { text: "Google connected", ok: true },
  cancelled: { text: "Connection cancelled", ok: false },
  forbidden: { text: "You cannot connect that website", ok: false },
  invalid_request: { text: "That link was not valid — try again", ok: false },
  error: { text: "Google could not be connected", ok: false },
};

function formatNumber(value: number): string {
  return value.toLocaleString();
}

export function AnalyticsPanel({ websiteId, connection, performance }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [properties, setProperties] = useState<AvailableProperties | null>(null);
  const [scSite, setScSite] = useState(connection.searchConsoleSite ?? "");
  const [gaProperty, setGaProperty] = useState(connection.analyticsProperty ?? "");

  const callback = params.get("google");

  useEffect(() => {
    if (!callback) return;
    const message = CALLBACK_MESSAGE[callback];
    if (!message) return;
    if (message.ok) toast.success(message.text);
    else toast.error(message.text);
    // Cleared so a refresh does not repeat the toast.
    router.replace(`/websites/${websiteId}`);
  }, [callback, router, websiteId]);

  // Property lists are only fetched once connected, since the call needs a
  // token and would fail noisily otherwise.
  useEffect(() => {
    if (!connection.connected || properties) return;
    let cancelled = false;
    void listProperties(websiteId).then((result) => {
      if (!cancelled && result.ok) setProperties(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [connection.connected, properties, websiteId]);

  function handleConnect() {
    startTransition(async () => {
      const result = await startGoogleConnect(websiteId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.location.assign(result.data.url);
    });
  }

  function handleSave() {
    startTransition(async () => {
      const result = await selectProperties(websiteId, {
        searchConsoleSite: scSite || null,
        analyticsProperty: gaProperty || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Saved");
      router.refresh();
    });
  }

  function handleImport() {
    startTransition(async () => {
      const result = await startImport(websiteId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Importing your data — this takes a moment");
      router.refresh();
    });
  }

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectGoogle(websiteId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Google disconnected");
      router.refresh();
    });
  }

  if (!connection.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4" />
            Google results
          </CardTitle>
          <CardDescription>
            Connect Google to see which searches bring people to your website,
            and how that changes as we publish.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleConnect} disabled={pending}>
            {pending ? "Redirecting…" : "Connect Google"}
          </Button>
          {connection.status === "expired" ? (
            <p className="mt-3 text-sm text-destructive">
              The previous connection expired. Reconnect to resume importing.
            </p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4" />
              Google results
              <Badge>Connected</Badge>
            </CardTitle>
            <CardDescription>
              {performance.hasData
                ? "Last 28 days."
                : "Choose your properties below, then import."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {performance.hasData ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <div className="text-2xl font-semibold tabular-nums">
                  {formatNumber(performance.clicks)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Visitors from Google
                </div>
              </div>
              <div>
                <div className="text-2xl font-semibold tabular-nums">
                  {formatNumber(performance.impressions)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Times you appeared
                </div>
              </div>
              <div>
                <div className="text-2xl font-semibold tabular-nums">
                  {performance.averagePosition
                    ? performance.averagePosition.toFixed(1)
                    : "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Average ranking
                </div>
              </div>
              <div>
                <div className="text-2xl font-semibold tabular-nums">
                  {formatNumber(performance.sessions)}
                </div>
                <div className="text-xs text-muted-foreground">Website visits</div>
              </div>
            </div>

            {performance.topQueries.length > 0 ? (
              <div className="overflow-x-auto">
                <p className="mb-2 text-sm font-medium">
                  What people searched to find you
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Query</TableHead>
                      <TableHead className="w-24">Visitors</TableHead>
                      <TableHead className="hidden w-28 sm:table-cell">
                        Appeared
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performance.topQueries.map((row) => (
                      <TableRow key={row.query}>
                        <TableCell>{row.query}</TableCell>
                        <TableCell className="tabular-nums">
                          {formatNumber(row.clicks)}
                        </TableCell>
                        <TableCell className="hidden tabular-nums sm:table-cell">
                          {formatNumber(row.impressions)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Search Console property</Label>
            <Select value={scSite} onValueChange={setScSite}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a property" />
              </SelectTrigger>
              <SelectContent>
                {(properties?.searchConsole ?? []).map((site) => (
                  <SelectItem key={site.siteUrl} value={site.siteUrl}>
                    {site.siteUrl}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Analytics property</Label>
            <Select value={gaProperty} onValueChange={setGaProperty}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a property" />
              </SelectTrigger>
              <SelectContent>
                {(properties?.analytics ?? []).map((property) => (
                  <SelectItem key={property.name} value={property.name}>
                    {property.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex-wrap gap-2">
        <Button size="sm" onClick={handleSave} disabled={pending}>
          Save properties
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleImport}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Import data
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
          disabled={pending}
        >
          <Unplug className="size-4" />
          Disconnect
        </Button>
      </CardFooter>
    </Card>
  );
}
