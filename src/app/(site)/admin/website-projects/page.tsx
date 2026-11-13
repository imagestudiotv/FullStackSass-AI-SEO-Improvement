import { ExternalLink, PanelsTopLeft } from "lucide-react";

import { listWebsiteProjectQueue, type WebsiteProjectQueueRow } from "@/lib/website-projects/admin";

import { AdminPage, AdminPageHeader, AdminSection } from "../_ui/page";
import { AdminEmpty } from "../_ui/states";
import { AdminStatus } from "../_ui/status";
import { WebsiteProjectActions } from "./project-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Website projects" };

const KIND_LABEL: Record<string, string> = { new: "New website", redesign: "Website redesign" };

const STATUS: Record<string, { tone: "pending" | "success" | "neutral" | "info"; label: string }> = {
  quote_requested: { tone: "pending", label: "Quote requested" },
  quoted: { tone: "info", label: "Quoted - waiting for the customer" },
  paid: { tone: "pending", label: "Paid in credits - to deliver" },
  fulfilled: { tone: "success", label: "Delivered" },
  declined: { tone: "neutral", label: "Declined" },
};

/**
 * Admin -> Website projects (lib/website-projects): review a brief, agree the
 * scope and set the price in credits, then deliver what was paid for. The
 * customer pays from their own screen; nothing here moves credits.
 */
export default async function AdminWebsiteProjectsPage() {
  const rows = await listWebsiteProjectQueue();
  const groups: { id: string; title: string; description: string; rows: WebsiteProjectQueueRow[] }[] = [
    { id: "requested", title: "Quote requested", description: "Oldest first. Agree the scope with the customer, then set it and the price.", rows: rows.filter((row) => row.status === "quote_requested") },
    { id: "paid", title: "Paid - to deliver", description: "Credits taken. Mark delivered when the work is done.", rows: rows.filter((row) => row.status === "paid") },
    { id: "quoted", title: "Quoted", description: "Waiting for the customer to accept and pay. A changed price replaces the old one.", rows: rows.filter((row) => row.status === "quoted") },
    { id: "closed", title: "Delivered and declined", description: "The latest.", rows: rows.filter((row) => row.status === "fulfilled" || row.status === "declined") },
  ];

  return (
    <AdminPage width="default">
      <AdminPageHeader
        title="Website projects"
        description="Website builds and redesigns customers asked for. There is no tariff: each is priced here, in credits, after the scope is agreed. An unpriced project cannot be paid."
      />
      {rows.length === 0 ? (
        <AdminSection id="empty" title="Website projects" bodyClassName="p-0">
          <AdminEmpty filtering={false} icon={PanelsTopLeft} noun="projects" title="No requests yet." description="New requests from customers' Website projects screen appear here." />
        </AdminSection>
      ) : null}
      {groups
        .filter((group) => group.rows.length > 0)
        .map((group) => (
          <AdminSection key={group.id} id={group.id} title={`${group.title} (${group.rows.length})`} description={group.description} bodyClassName="p-0">
            <ul className="divide-y">
              {group.rows.map((row) => (
                <Project key={row.id} row={row} />
              ))}
            </ul>
          </AdminSection>
        ))}
    </AdminPage>
  );
}

function Project({ row }: { row: WebsiteProjectQueueRow }) {
  const when = (at: Date) => at.toISOString().slice(0, 16).replace("T", " ");
  const status = STATUS[row.status] ?? { tone: "neutral" as const, label: row.status };
  return (
    <li className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{KIND_LABEL[row.kind] ?? row.kind}</span>
          {row.creditCost ? <span className="text-sm font-semibold text-primary tabular-nums">{row.creditCost} credits</span> : null}
          <AdminStatus tone={status.tone} label={status.label} />
        </div>
        <p className="text-xs text-muted-foreground">
          {row.organizationName} · {[row.contactName, row.contactEmail, row.contactPhone].filter(Boolean).join(" · ")} · sent {when(row.createdAt)} UTC
          {row.userEmail && row.userEmail !== row.contactEmail ? ` · account ${row.userEmail}` : ""}
        </p>
        {row.existingUrl ? (
          <a
            href={row.existingUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex max-w-full items-center gap-1 text-sm text-primary underline underline-offset-2 [overflow-wrap:anywhere]"
          >
            {row.existingUrl}
            <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : null}
        <p className="max-w-3xl text-sm whitespace-pre-line [overflow-wrap:anywhere]">{row.brief}</p>
        {row.requirements ? (
          <p className="max-w-3xl text-sm whitespace-pre-line text-muted-foreground [overflow-wrap:anywhere]">
            <span className="font-medium">Requirements: </span>
            {row.requirements}
          </p>
        ) : null}
        {row.scope ? (
          <p className="max-w-3xl text-sm whitespace-pre-line [overflow-wrap:anywhere]">
            <span className="font-medium">Agreed scope: </span>
            {row.scope}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {row.quotedAt ? `Quoted by ${row.quotedBy ?? "-"} on ${when(row.quotedAt)} UTC` : null}
          {row.paidAt ? ` · paid ${row.creditsPaid} credits on ${when(row.paidAt)} UTC` : null}
          {row.fulfilledAt ? ` · delivered by ${row.fulfilledBy ?? "-"} on ${when(row.fulfilledAt)} UTC: ${row.deliveryNote ?? ""}` : null}
          {row.declineReason ? `Declined by ${row.declinedBy ?? "-"}: ${row.declineReason}` : null}
        </p>
      </div>
      <WebsiteProjectActions id={row.id} status={row.status} scope={row.scope} credits={row.creditCost} />
    </li>
  );
}
