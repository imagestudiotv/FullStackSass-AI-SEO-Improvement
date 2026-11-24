import { Mail } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getBroadcast, getBroadcastsAdmin, type BroadcastRow } from "@/lib/admin/broadcasts";
import { pageFrom } from "@/lib/admin/shared";
import { AUDIENCE_META, BROADCAST_STATUS, BROADCAST_TEMPLATES, isBroadcastAudience, type BroadcastContent } from "@/lib/broadcasts/shared";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import { siteUrl } from "@/lib/site-url";

import { AdminPage, AdminPageHeader, AdminSection, AdminStat } from "../_ui/page";
import { AdminEmpty, AdminUnavailable } from "../_ui/states";
import { AdminStatus } from "../_ui/status";
import { AdminTableCard } from "../_ui/table";
import { Pagination } from "../pagination";
import { BroadcastComposer } from "./composer";
import { BroadcastActions, RefreshWhileSending } from "./history-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Email broadcasts" };

const BASE = "/admin/email-broadcasts";
const n = (value: number) => formatNumber(value, "en");
const when = (date: Date | null) =>
  date ? `${formatDate(date, "en", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC` : "-";

/**
 * Admin -> Email broadcasts (Daniel, 2026-11-24): write one email, preview
 * exactly what will arrive, and send it to everyone who may receive it.
 * Rules: lib/broadcasts.
 */
export default async function EmailBroadcastsPage({ searchParams }: PageProps<"/admin/email-broadcasts">) {
  const params = await searchParams;
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const editId = one(params.edit);
  const copyId = one(params.copy);
  const [data, opened] = await Promise.all([
    getBroadcastsAdmin(pageFrom(params.page)),
    editId || copyId ? getBroadcast(String(editId ?? copyId)) : Promise.resolve(null),
  ]);

  // Only a draft is edited; anything else is opened as the start of a new one.
  const editing = opened && editId && opened.status === "draft" ? opened : null;
  const first = BROADCAST_TEMPLATES[0];
  const blank: BroadcastContent = { audience: "all", ...first.content, images: [], ctaUrl: `${siteUrl()}${first.path}` };
  const content = opened?.content ?? blank;

  return (
    <AdminPage width="default">
      <AdminPageHeader
        title="Email broadcasts"
        description="Write one email and send it to all registered users, or to one group of them. People who unsubscribed are always left out, and nobody is emailed the same broadcast twice."
        actions={
          opened ? (
            <Button variant="outline" asChild>
              <Link href={BASE}>New broadcast</Link>
            </Button>
          ) : null
        }
      />

      {data.problem ? <AdminUnavailable title="Sending is switched off" description={data.problem} /> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminStat label="Registered users" value={n(data.summary.registered)} href="/admin/users" hint="People with a RepGet account" />
        <AdminStat
          label="Suppressed contacts"
          value={n(data.summary.suppressed)}
          hint={`${n(data.summary.optedOut)} unsubscribed · ${n(data.summary.unverified)} address not verified. Bounces are held back by Resend`}
        />
        <AdminStat label="Draft campaigns" value={n(data.drafts)} hint="Saved and not sent" />
        <AdminStat label="Last send" value={data.lastSend ? <span className="text-base">{when(data.lastSend)}</span> : "Never"} hint="When the latest broadcast started" />
      </div>

      <BroadcastComposer
        key={editing ? `edit-${editing.id}` : opened ? `copy-${opened.id}` : "new"}
        editing={editing ? { id: editing.id, revision: editing.revision } : null}
        initial={content}
        recipients={data.summary.recipients}
        sendingAllowed={data.problem === null}
        imagesEnabled={data.imagesEnabled}
        appUrl={siteUrl()}
      />

      <AdminSection id="history" title="History" description="Drafts, scheduled and sent broadcasts, newest first." bodyClassName="p-0" className="scroll-mt-20">
        {data.rows.length === 0 ? (
          <AdminEmpty filtering={false} icon={Mail} noun="broadcasts" title="Nothing sent yet." description="Saved drafts and sent broadcasts appear here." />
        ) : (
          <AdminTableCard
            className="rounded-t-none border-0 shadow-none"
            footer={data.total > data.pageSize ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath={BASE} /> : undefined}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Broadcast</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">When</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-80 whitespace-normal">
                      <span className="block font-medium wrap-anywhere">{row.subject || "No subject"}</span>
                      <span className="block text-xs text-muted-foreground">{isBroadcastAudience(row.audience) ? AUDIENCE_META[row.audience].label : row.audience}</span>
                      <span className="block text-xs text-muted-foreground wrap-anywhere">by {row.sentBy ?? row.createdBy}</span>
                      <span className="block text-xs text-muted-foreground md:hidden">{whenOf(row)}</span>
                    </TableCell>
                    <TableCell>
                      <AdminStatus tone={BROADCAST_STATUS[row.status].tone} label={BROADCAST_STATUS[row.status].label} />
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">{whenOf(row)}</TableCell>
                    <TableCell className="text-sm tabular-nums">
                      <Counts row={row} />
                    </TableCell>
                    <TableCell className="text-right">
                      <BroadcastActions id={row.id} status={row.status} subject={row.subject || "No subject"} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminTableCard>
        )}
      </AdminSection>

      <RefreshWhileSending active={data.rows.some((row) => row.status === "sending")} />
    </AdminPage>
  );
}

function whenOf(row: BroadcastRow): string {
  if (row.status === "scheduled") return `For ${when(row.scheduledFor)}`;
  if (row.startedAt) return `Started ${when(row.startedAt)}`;
  return `Saved ${when(row.createdAt)}`;
}

function Counts({ row }: { row: BroadcastRow }) {
  if (row.recipientCount === null) return <span className="text-muted-foreground">Not sent</span>;
  const { sent, failed, skipped, queued } = row.counts;
  return (
    <>
      <span className="block">
        {n(sent)} of {n(row.recipientCount)} sent
      </span>
      <span className="block text-xs text-muted-foreground">
        {n(queued)} queued · {n(failed)} failed · {n(skipped)} skipped
      </span>
    </>
  );
}
