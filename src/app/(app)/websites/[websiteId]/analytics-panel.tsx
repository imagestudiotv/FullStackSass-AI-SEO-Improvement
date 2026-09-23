"use client";

import { BarChart3, Download, Loader2, Unplug } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";
import { formatNumber as intlNumber } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
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
import { Stat } from "@/components/ui/states";
import { Trend } from "@/components/ui/trend";
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
  /** This screen's copy, already in the reader's language. */
  t: Messages["app"]["analytics"];
  /** For thousands separators. */
  locale: Locale;
  /** Shared words used on several screens. */
  tCommon: Messages["app"]["common"];
};

/** Messages for the ?google= parameter the OAuth callback redirects with. */
const CALLBACK_MESSAGE: Record<
  string,
  { key: keyof Messages["app"]["analytics"]; ok: boolean }
> = {
  connected: { key: "statusConnected", ok: true },
  cancelled: { key: "statusCancelled", ok: false },
  forbidden: { key: "statusForbidden", ok: false },
  invalid_request: { key: "statusInvalid", ok: false },
  error: { key: "statusError", ok: false },
};

/**
 * Thousands separators in the reader's language.
 *
 * Was value.toLocaleString() with no argument, which follows the BROWSER —
 * so a German dashboard on an English-locale machine printed 1,234 where the
 * rest of the page said 1.234.
 */
function formatNumber(value: number, locale: Locale): string {
  return intlNumber(value, locale);
}

export function AnalyticsPanel({
  websiteId,
  connection,
  performance,
  t,
  locale,
  tCommon,
}: Props) {
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
    if (message.ok) toast.success(t[message.key]);
    else toast.error(t[message.key]);
    // Cleared so a refresh does not repeat the toast.
    router.replace(`/websites/${websiteId}`);
  }, [callback, router, websiteId, t]);

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
      toast.success(t.importing);
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
      toast.success(t.disconnected);
      router.refresh();
    });
  }

  if (!connection.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4" />
            {t.googleResults}
          </CardTitle>
          <CardDescription>{t.connectHelp}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleConnect} disabled={pending}>
            {pending ? t.redirecting : t.connectGoogle}
          </Button>
          {connection.status === "expired" ? (
            <p className="mt-3 text-sm text-destructive">{t.expired}</p>
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
              {t.googleResults}
              <Badge>{t.connected}</Badge>
            </CardTitle>
            <CardDescription>
              {performance.hasData
                ? t.last28
                : t.chooseThenImport}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {performance.hasData ? (
          <>
            {/*
              Each figure carries its movement against the preceding window of
              the same length, which is the difference between a number and a
              result. Trend renders nothing when there is no earlier window, so
              a newly connected site shows totals without invented growth.
            */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat
                label={t.visitorsFromGoogle}
                value={formatNumber(performance.clicks, locale)}
                trend={
                  <Trend
                    current={performance.clicks}
                    previous={performance.previous?.clicks ?? null}
                  />
                }
              />
              <Stat
                label={t.timesAppeared}
                value={formatNumber(performance.impressions, locale)}
                trend={
                  <Trend
                    current={performance.impressions}
                    previous={performance.previous?.impressions ?? null}
                  />
                }
              />
              <Stat
                label={t.averageRanking}
                value={
                  performance.averagePosition
                    ? performance.averagePosition.toFixed(1)
                    : "—"
                }
                trend={
                  performance.averagePosition !== null ? (
                    <Trend
                      current={performance.averagePosition}
                      previous={performance.previous?.averagePosition ?? null}
                      /* Position 3 beats position 8, so lower is better. */
                      higherIsBetter={false}
                    />
                  ) : null
                }
              />
              <Stat
                label={t.websiteVisits}
                value={formatNumber(performance.sessions, locale)}
                trend={
                  <Trend
                    current={performance.sessions}
                    previous={performance.previous?.sessions ?? null}
                  />
                }
              />
            </div>

            {performance.topQueries.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-medium">
                  {t.whatPeopleSearched}
                </p>
                <Table minWidth="28rem">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.query}</TableHead>
                      <TableHead className="w-24">{t.visitors}</TableHead>
                      <TableHead className="hidden w-28 sm:table-cell">
                        {tCommon.appeared}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performance.topQueries.map((row) => (
                      <TableRow key={row.query}>
                        <TableCell>{row.query}</TableCell>
                        <TableCell className="tabular-nums">
                          {formatNumber(row.clicks, locale)}
                        </TableCell>
                        <TableCell className="hidden tabular-nums sm:table-cell">
                          {formatNumber(row.impressions, locale)}
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
            <Label>{t.searchConsoleProperty}</Label>
            <Select value={scSite} onValueChange={setScSite}>
              <SelectTrigger>
                <SelectValue placeholder={t.chooseProperty} />
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
            <Label>{t.analyticsProperty}</Label>
            <Select value={gaProperty} onValueChange={setGaProperty}>
              <SelectTrigger>
                <SelectValue placeholder={t.chooseProperty} />
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
          {tCommon.saveProperties}
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
          {tCommon.importData}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
          disabled={pending}
        >
          <Unplug className="size-4" />
          {tCommon.disconnect}
        </Button>
      </CardFooter>
    </Card>
  );
}
