import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { getOperations } from "@/lib/admin/network-operations";
import { CollectAuthorityButton, ControlToggle, PolicyForm, ResolveDispatchForm } from "./operations-forms";

export const dynamic = "force-dynamic";

/**
 * Partner Network operations: the publication freeze and the managed-review
 * switch, authority collection, and the valuation policy. See
 * docs/managed-network.md for when each is used.
 */
export default async function NetworkOperationsPage() {
  const ops = await getOperations();
  const control = (key: string) => ops.controls.find((c) => c.key === key)!;
  const freeze = control("publication_freeze");
  const review = control("managed_review");
  const when = (d: Date | null) => (d ? `${d.toISOString().slice(0, 16).replace("T", " ")} UTC` : "never");

  return (
    <PageShell width="wide">
      <PageHeader
        title="Partner Network operations"
        description="Publishing switches, authority collection and the valuation policy. Every change is recorded in the audit log."
        actions={<Link href="/admin/network" className="text-sm underline-offset-4 hover:underline">← Review queue</Link>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Publication freeze <Badge variant={freeze.enabled ? "destructive" : "secondary"}>{freeze.enabled ? "ON - nothing is sent" : "off"}</Badge>
            </CardTitle>
            <CardDescription>
              While on, no publishing path sends anything to a customer site: direct publishing, the plugin feed, scheduled and queued
              jobs all hold at their dispatch claim. Turning it on waits for claims already being made. Sends already admitted cannot be
              recalled: their outcome must be known before switching builds (see the rollback procedure).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="grid grid-cols-2 gap-1 text-sm">
              <li>In flight: <strong>{ops.drain.inFlight}</strong></li>
              <li>Lease ran out, no outcome: <strong>{ops.drain.inFlightStale}</strong></li>
              <li>Uncertain direct sends: <strong>{ops.drain.uncertain}</strong></li>
              <li>Unacknowledged plugin hand-overs: <strong>{ops.drain.unacknowledged}</strong></li>
            </ul>
            <p className={ops.drain.drained ? "font-medium" : "font-medium text-destructive"}>
              {ops.drain.drained
                ? "Drained: no delivery has an unknown outcome."
                : "Not drained: resolve every attempt listed under Unresolved deliveries before switching builds."}
            </p>
            <p className="text-xs text-muted-foreground">
              Last change: {when(freeze.updatedAt)} by {freeze.updatedBy ?? "-"}{freeze.reason ? ` - ${freeze.reason}` : ""}
            </p>
            <ControlToggle controlKey="publication_freeze" enabled={freeze.enabled} title="Publication freeze" onLabel="on" offLabel="off" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Managed review <Badge variant={review.enabled ? "default" : "secondary"}>{review.enabled ? "on" : "off"}</Badge>
            </CardTitle>
            <CardDescription>
              While on, new drafts on Partner Network websites wait for the RepGet team&apos;s review. Turn on only after a deploy has
              finished, so no older build that ignores the review gate is still running.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Last change: {when(review.updatedAt)} by {review.updatedBy ?? "-"}{review.reason ? ` - ${review.reason}` : ""}
            </p>
            <ControlToggle controlKey="managed_review" enabled={review.enabled} title="Managed review" onLabel="on" offLabel="off" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Authority - {ops.authority.metric}</CardTitle>
            <CardDescription>
              Collected in the background from the DataForSEO Backlinks API (bulk ranks), capped per day by AUTHORITY_DAILY_REQUESTS
              and reserved before each request. Page views never call the provider.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!ops.authority.configured ? (
              <p>DataForSEO credentials are not configured on this deployment.</p>
            ) : (
              <>
                <ul className="flex flex-wrap gap-2">
                  {Object.entries(ops.authority.byStatus).length === 0 ? <li className="text-muted-foreground">No domains tracked yet.</li> : null}
                  {Object.entries(ops.authority.byStatus).map(([status, n]) => (
                    <li key={status}>
                      <Badge variant={status === "no_access" || status === "error" ? "destructive" : "secondary"}>
                        {status}: {n}
                      </Badge>
                    </li>
                  ))}
                </ul>
                {ops.authority.byStatus.no_access ? (
                  <p className="text-sm text-destructive">
                    DataForSEO answered 40204 (no Backlinks API access) for the configured account. Enable it in the DataForSEO
                    account (an operator decision - nothing is purchased from here); collection retries weekly.
                  </p>
                ) : null}
                <p className="text-xs">
                  Daily request limit:{" "}
                  {ops.authority.dailyLimit.source === "invalid" ? (
                    <span className="text-destructive">AUTHORITY_DAILY_REQUESTS is not a whole number - collection is disabled until it is fixed</span>
                  ) : ops.authority.dailyLimit.source === "disabled" ? (
                    "0 - collection disabled (AUTHORITY_DAILY_REQUESTS=0)"
                  ) : (
                    `${ops.authority.dailyLimit.limit} per day${ops.authority.dailyLimit.source === "default" ? " (default)" : ""}`
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Last attempt: {when(ops.authority.lastAttemptAt)}{ops.authority.lastError ? ` - ${ops.authority.lastError}` : ""}
                </p>
              </>
            )}
            <CollectAuthorityButton disabled={!ops.authority.configured} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Valuation policy</CardTitle>
            <CardDescription>
              Estimated equivalent value is shown to customers only under a published policy. Versions are append-only; the newest one
              in effect applies.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {ops.policy ? (
              <div className="rounded-md border p-3">
                <p className="font-medium">
                  In force: v{ops.policy.version} ({ops.policy.currency}) since {ops.policy.effectiveFrom.toISOString().slice(0, 10)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Traffic: {ops.policy.clickValueMode}
                  {ops.policy.clickValueMode === "fixed" ? ` at ${ops.policy.fixedClickRate} per click` : ""} · Backlinks:{" "}
                  {ops.policy.backlinkRates.length === 0
                    ? "not valued"
                    : ops.policy.backlinkRates.map((r) => `${r.minRank ?? "unknown"}:${r.value}`).join(", ")}
                </p>
                <p className="text-xs text-muted-foreground">Sources: {ops.policy.sources}</p>
              </div>
            ) : (
              <p className="text-muted-foreground">No policy published: customers see &quot;Estimate not configured&quot;.</p>
            )}
            {ops.policies.length > 1 ? (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Earlier versions ({ops.policies.length - 1})</summary>
                <ul className="mt-1 space-y-0.5">
                  {ops.policies.slice(1).map((p) => (
                    <li key={p.id}>
                      v{p.version} · {p.currency} · from {p.effectiveFrom.toISOString().slice(0, 10)} · by {p.createdBy ?? "-"}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Unresolved deliveries ({ops.unresolved.length})</CardTitle>
          <CardDescription>
            Attempts whose outcome is not known. An uncertain direct send is looked up automatically by its ownership marker and adopted
            only when exactly one post carries it; an empty lookup is not proof. An expired hand-over from a plugin older than 1.6.0 blocks
            newer revisions of that article until the plugin reports it or it is released here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ops.unresolved.length === 0 ? (
            <p className="text-sm text-muted-foreground">None.</p>
          ) : (
            <ul className="divide-y">
              {ops.unresolved.map((d) => (
                <li key={d.id} className="grid gap-2 py-3 text-sm lg:grid-cols-[1fr_minmax(0,24rem)]">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{d.articleTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.domain} · {d.channel}{d.protocol ? ` (${d.protocol})` : ""} · {d.state.replace(/_/g, " ")} · claimed {when(d.claimedAt)}
                      {d.lookupAttempts ? ` · ${d.lookupAttempts} lookups, last: ${d.lookupResult ?? "-"}` : ""}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">{d.id}</p>
                  </div>
                  {d.state === "uncertain" || (d.state === "expired" && d.channel === "plugin") ? (
                    <ResolveDispatchForm dispatchId={d.id} kind={d.state === "uncertain" ? "uncertain" : "expired"} />
                  ) : (
                    <p className="text-xs text-muted-foreground">Waiting for its outcome.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publish a new valuation policy version</CardTitle>
          <CardDescription>Do not enter market prices you cannot source. Rates and their sources are shown to customers.</CardDescription>
        </CardHeader>
        <CardContent>
          <PolicyForm
            current={
              ops.policy
                ? {
                    currency: ops.policy.currency,
                    clickValueMode: ops.policy.clickValueMode,
                    fixedClickRate: ops.policy.fixedClickRate,
                    bands: ops.policy.backlinkRates.map((r) => `${r.minRank ?? "unknown"}:${r.value}`).join(", "),
                    sources: ops.policy.sources,
                  }
                : null
            }
          />
        </CardContent>
      </Card>
    </PageShell>
  );
}
