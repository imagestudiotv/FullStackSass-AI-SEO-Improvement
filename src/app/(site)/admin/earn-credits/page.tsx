import { ExternalLink, Gift } from "lucide-react";

import { listEarnQueue, type EarnQueueRow } from "@/lib/earn/admin";
import { EARN_WAYS, isEarnKind } from "@/lib/earn/ways";

import { AdminPage, AdminPageHeader, AdminSection } from "../_ui/page";
import { AdminEmpty } from "../_ui/states";
import { AdminStatus } from "../_ui/status";
import { EarnDecision } from "./earn-decision";

export const dynamic = "force-dynamic";
export const metadata = { title: "Earn Credits" };

const KIND_LABEL: Record<string, string> = {
  story: "Story",
  post: "Post about RepGet",
  tutorial: "Tutorial",
  feedback: "Improvement idea",
};

/**
 * Admin -> Earn Credits: what customers sent for the extra ways to earn on
 * their Earn Credits page (lib/earn). Approving adds the credits shown;
 * declining needs a reason, which the customer sees and can answer by
 * sending again. Each way pays once per workspace.
 */
export default async function AdminEarnCreditsPage() {
  const rows = await listEarnQueue();
  const waiting = rows.filter((row) => row.status === "pending");
  const decided = rows.filter((row) => row.status !== "pending");

  return (
    <AdminPage width="default">
      <AdminPageHeader
        title="Earn Credits"
        description="Stories, posts, tutorials and ideas customers sent for credits. Check that each is original and genuine - and that a public post or tutorial says the author may receive credits. Never decline one for being critical."
      />

      <AdminSection id="waiting" title={`Waiting (${waiting.length})`} description="Oldest first." bodyClassName="p-0">
        {waiting.length === 0 ? (
          <AdminEmpty filtering={false} icon={Gift} noun="claims" title="Nothing is waiting." description="New claims from the Earn Credits page appear here." />
        ) : (
          <ul className="divide-y">
            {waiting.map((row) => (
              <Claim key={row.id} row={row} />
            ))}
          </ul>
        )}
      </AdminSection>

      {decided.length > 0 ? (
        <AdminSection id="decided" title="Decided" description="The latest decisions." bodyClassName="p-0">
          <ul className="divide-y">
            {decided.map((row) => (
              <Claim key={row.id} row={row} />
            ))}
          </ul>
        </AdminSection>
      ) : null}
    </AdminPage>
  );
}

function Claim({ row }: { row: EarnQueueRow }) {
  const when = (at: Date) => at.toISOString().slice(0, 16).replace("T", " ");
  const credits = isEarnKind(row.kind) ? row.rewardCredits || EARN_WAYS[row.kind].credits : row.rewardCredits;
  return (
    <li className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{KIND_LABEL[row.kind] ?? row.kind}</span>
          <span className="text-sm font-semibold text-primary tabular-nums">+{credits}</span>
          {row.status === "approved" ? (
            <AdminStatus tone="success" label="Approved" />
          ) : row.status === "declined" ? (
            <AdminStatus tone="neutral" label="Declined" />
          ) : (
            <AdminStatus tone="pending" label="Waiting" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {row.organizationName}
          {row.userName || row.userEmail ? ` · ${[row.userName, row.userEmail].filter(Boolean).join(" · ")}` : ""} · sent {when(row.createdAt)} UTC
        </p>
        {row.link ? (
          <a
            href={row.link}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex max-w-full items-center gap-1 text-sm text-primary underline underline-offset-2 [overflow-wrap:anywhere]"
          >
            {row.link}
            <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : null}
        <p className="max-w-3xl text-sm whitespace-pre-line [overflow-wrap:anywhere]">{row.message}</p>
        {row.status !== "pending" ? (
          <p className="text-xs text-muted-foreground">
            {row.status === "approved" ? "Approved" : "Declined"} by {row.reviewedBy ?? "-"}
            {row.reviewedAt ? ` on ${when(row.reviewedAt)} UTC` : ""}
            {row.reviewNote ? `: ${row.reviewNote}` : ""}
          </p>
        ) : null}
      </div>
      {row.status === "pending" ? <EarnDecision id={row.id} credits={credits} /> : null}
    </li>
  );
}
