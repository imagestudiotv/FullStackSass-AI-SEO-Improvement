import Link from "next/link";
import { CONTENT_TASKS, getContentPerformance } from "@/lib/admin/content-performance";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminPage, AdminPageHeader, AdminSection, AdminStat } from "../_ui/page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Content performance" };
const usd = (value: number | null) => value === null ? "Unknown" :
  new Intl.NumberFormat("en", { style: "currency", currency: "USD", minimumFractionDigits: 4 }).format(value);

export default async function ContentPerformancePage() {
  const data = await getContentPerformance();
  const known = data.usage.filter(row => row.knownCostUsd !== null);
  const cost = known.length ? known.reduce((total, row) => total + row.knownCostUsd!, 0) : null;
  const unknown = data.usage.reduce((total, row) => total + row.unknownCosts, 0);
  const requests = data.usage.reduce((total, row) => total + row.requests, 0);
  return <AdminPage>
    <AdminPageHeader title="Content performance" description="Research rollout, task models and recorded costs for customer articles. This page makes no AI calls." />
    <div className="grid gap-3 sm:grid-cols-3">
      <AdminStat label="Research" value={data.rollout.mode === "pilot" ? "Review pilot" : data.rollout.mode === "on" ? "Enabled" : "Off"}
        hint={data.rollout.mode === "off" ? "New articles use the existing writing workflow." :
          data.rollout.allWebsites ? "All websites" : `${data.rollout.websiteIds.length} selected website(s)`} />
      <AdminStat label="Known text and search cost" value={requests ? usd(cost) : "No data"}
        hint={unknown ? `${unknown} request(s) have unknown cost; the subtotal is incomplete.` : "Last 30 days · estimates, not a billing invoice."} />
      <AdminStat label="Recorded requests" value={requests} hint="Last 30 days · includes retries and recorded failures." />
    </div>
    <AdminSection id="research-rollout" title="Research before writing">
      <div className="space-y-2 text-sm">
        <p>{data.rollout.mode === "pilot" ? "Every new researched article waits for a person to review its saved text and sources before publication, including automatic and scheduled articles." :
          data.rollout.mode === "on" ? "Incomplete research, warnings and evidence-check findings hold articles for review." :
            "Research is not enabled for new articles on this deployment."}</p>
        {data.rollout.mode !== "off" && data.selectedSites.length > 0 &&
          <p>Selected websites: {data.selectedSites.map(site => site.domain).join(", ")}{data.rollout.websiteIds.length > 25 ? " (first 25 shown)" : ""}.</p>}
        <p className="text-muted-foreground">Rollout changes apply to new runs. Existing review holds remain until approved. Automatic checks support editorial review; they do not establish factual accuracy.</p>
      </div>
    </AdminSection>
    <AdminSection id="task-models" title="Models by task" description="Current defaults and configured overrides. Strong writing and evidence reasoning stay separate from simpler preparation tasks.">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.routes.map(route => <div key={route.task} className="min-w-0">
          <dt className="text-sm font-medium">{route.label}</dt>
          <dd className="mt-1 break-words text-sm text-muted-foreground">{route.model}<span className="block text-xs">{route.promptVersion}</span></dd>
        </div>)}
      </dl>
    </AdminSection>
    <AdminSection id="recorded-usage" title="Cost and speed by task"
      description={`Recorded from ${data.since.toISOString().slice(0, 10)} to ${data.until.toISOString().slice(0, 10)} (UTC). Time is per provider request, not total article generation time.`}
      bodyClassName="p-0">
      {data.usage.length ? <Table>
        <TableHeader><TableRow>
          <TableHead>Task / model</TableHead><TableHead>Requests</TableHead><TableHead>Known cost (USD)</TableHead>
          <TableHead>Unknown costs</TableHead><TableHead>Average request time</TableHead><TableHead>Request failures</TableHead>
        </TableRow></TableHeader>
        <TableBody>{data.usage.map(row => <TableRow key={`${row.task}:${row.model}:${row.promptVersion}`}>
          <TableCell><span className="font-medium">{CONTENT_TASKS[row.task as keyof typeof CONTENT_TASKS] ?? "Source searches"}</span>
            <span className="block text-xs text-muted-foreground">{row.model} · {row.promptVersion}</span></TableCell>
          <TableCell>{row.requests}</TableCell><TableCell>{usd(row.knownCostUsd)}</TableCell><TableCell>{row.unknownCosts}</TableCell>
          <TableCell>{row.averageDurationMs === null ? "Not recorded" : `${(row.averageDurationMs / 1000).toFixed(1)} s`}
            {row.measuredDurations > 0 && row.measuredDurations < row.requests &&
              <span className="block text-xs text-muted-foreground">{row.measuredDurations} of {row.requests} measured</span>}</TableCell>
          <TableCell>{row.failedRequests}</TableCell>
        </TableRow>)}</TableBody>
      </Table> : <p className="p-5 text-sm text-muted-foreground">No task measurements yet. New article runs will populate this table. Older unmetered work is not counted as free.</p>}
      <p className="border-t p-5 text-xs text-muted-foreground">Includes recorded article planning, research, writing, checking, automatic corrections and image descriptions. Excludes image generation, other enrichment, hosting and human editing. Cached searches may make no new paid request. Compare similar topics, lengths and languages before drawing conclusions about savings.</p>
    </AdminSection>
    <AdminSection id="recent-articles" title="Recent articles" description="The 20 most recently updated articles in the last 30 days. Findings are review signals, not verified error counts." bodyClassName="p-0">
      {data.recent.length ? <Table>
        <TableHeader><TableRow><TableHead>Article</TableHead><TableHead>Status</TableHead><TableHead>Research</TableHead><TableHead>Evidence check</TableHead><TableHead>Research approval</TableHead></TableRow></TableHeader>
        <TableBody>{data.recent.map(article => <TableRow key={article.id}>
          <TableCell><Link className="font-medium text-primary underline" href={`/admin/articles/${article.id}`}>{article.title}</Link><span className="block text-xs text-muted-foreground">{article.domain}</span></TableCell>
          <TableCell>{article.status}</TableCell><TableCell>{article.researchStatus ?? "No research saved"}</TableCell>
          <TableCell>{article.checked ? `${article.issues} finding(s)` : "Not completed"}</TableCell>
          <TableCell>{article.held ? "Review required" : "No research hold"}</TableCell>
        </TableRow>)}</TableBody>
      </Table> : <p className="p-5 text-sm text-muted-foreground">No recent articles.</p>}
    </AdminSection>
  </AdminPage>;
}
