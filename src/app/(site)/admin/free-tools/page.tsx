import type { Metadata } from "next";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getFreeToolsAdmin, type FreeToolPeriod } from "@/lib/admin/free-tools";
import { AI_FREE_TOOLS, type FreeToolSlug } from "@/lib/tools/free-tools";
import { TOOLS_COMMON } from "@/lib/tools/i18n/common";
import { DEFAULT_DAILY_CAP_CENTS } from "@/lib/tools/tool-tracking";

import { AdminPage, AdminPageHeader, AdminSection, AdminStat } from "../_ui/page";
import { AdminToolbar, type ToolbarFilter } from "../_ui/toolbar";
import { ToolCapForm, ToolSwitch } from "./tool-controls";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Free tools" };

const PERIODS: FreeToolPeriod[] = [7, 30, 90];

const FILTERS: ToolbarFilter[] = [
  {
    param: "days",
    label: "Period",
    allValue: "30",
    options: PERIODS.map((days) => ({ value: String(days), label: `Last ${days} days` })),
  },
];

/** What is counted for each tool: what the owner should know before comparing them. */
const TRACKING: Record<FreeToolSlug, string> = {
  "blog-writer": "Every opening, by path; sign-ups attributed.",
  "social-media-post-generator": "Each delivered batch, with its AI cost; sign-ups attributed.",
  "meta-description-generator": "Each AI write, with its cost; cached answers are not counted; sign-ups not attributed.",
  "growth-copilot": "Each answer, with its cost (the home page's chat too); sign-ups attributed.",
  "robots-checker": "Each server check; cached answers are not counted; sign-ups not attributed.",
  "sitemap-checker": "Each server check; cached answers are not counted; sign-ups not attributed.",
  "meta-tag-checker": "Each server check; cached answers are not counted; sign-ups not attributed.",
  "ai-crawler-checker": "Each server check; cached answers are not counted; sign-ups not attributed.",
  "llms-txt-generator": "Each server check; cached answers are not counted; sign-ups not attributed.",
  "llm-html-checker": "Each server check; cached answers are not counted; sign-ups not attributed.",
  "keyword-density": "Each server check; cached answers are not counted; sign-ups not attributed.",
  "snippet-preview": "Runs only in the browser: not tracked.",
};

const usd = (value: number, digits = 2) =>
  new Intl.NumberFormat("en", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const count = (value: number) => new Intl.NumberFormat("en").format(value);

function periodOf(value: string | string[] | undefined): FreeToolPeriod {
  const days = Number(typeof value === "string" ? value : "30");
  return (PERIODS as number[]).includes(days) ? (days as FreeToolPeriod) : 30;
}

/**
 * Admin -> Free tools (owner, 2026-11-27: "how much we spend, and other
 * useful information to check over time if there is a good option to keep
 * ... this will allow us to keep only the true value tools"). Per tool and
 * period: uses by path, visitors, AI cost, sign-ups and cost per sign-up,
 * with each tool's switch and daily AI cap (lib/admin/free-tools.ts). This
 * page makes no AI calls.
 */
export default async function FreeToolsPage({ searchParams }: PageProps<"/admin/free-tools">) {
  const days = periodOf((await searchParams).days);
  const data = await getFreeToolsAdmin(days);
  const totals = data.rows.reduce(
    (sum, row) => ({ uses: sum.uses + row.totalUses, cost: sum.cost + row.costUsd, signups: sum.signups + row.signups, today: sum.today + row.todayUsd }),
    { uses: 0, cost: 0, signups: 0, today: 0 },
  );

  return (
    <AdminPage>
      <AdminPageHeader
        title="Free tools"
        description="What each free tool is used for, what its AI costs and how many sign-ups it brings, with a switch to turn it off. Uses are counted from the day this page shipped; visitors are counted by a one-way hash, never their address. Costs are what the model calls recorded, in USD at list prices."
      />

      <AdminToolbar filters={FILTERS} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStat label={`Uses, last ${days} days`} value={count(totals.uses)} hint="All tracked tools together" />
        <AdminStat label="AI cost" value={usd(totals.cost)} hint={`Today (UTC) ${usd(totals.today)}`} />
        <AdminStat label="Sign-ups from tools" value={count(totals.signups)} hint="New accounts that used a tool in the 30 days before" />
        <AdminStat label="AI cost per sign-up" value={totals.signups ? usd(totals.cost / totals.signups) : "—"} hint="Every tool's cost over every tool's sign-ups" />
      </div>

      <AdminSection
        id="tools"
        title="By tool"
        description={`Uses split by how they were answered: in the visitor's browser (no cost), on RepGet's server, or by the page's template (no cost). The daily AI cap stops a tool's server AI for the rest of the UTC day once reached; 0 stops it entirely; empty means the default (the Blog Writer: ${usd((DEFAULT_DAILY_CAP_CENTS["blog-writer"] ?? 0) / 100)}; the other tools: no cap of their own beyond their hourly limits).`}
        bodyClassName="p-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tool</TableHead>
              <TableHead className="text-right">Uses</TableHead>
              <TableHead className="text-right">Browser / server / template</TableHead>
              <TableHead className="text-right">Visitors</TableHead>
              <TableHead className="text-right">AI cost</TableHead>
              <TableHead className="text-right">Sign-ups</TableHead>
              <TableHead className="text-right">Cost per sign-up</TableHead>
              <TableHead>Today / daily AI cap</TableHead>
              <TableHead>On</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => {
              const name = TOOLS_COMMON.en.tools[`/tools/${row.tool}`]?.title ?? row.tool;
              const ai = AI_FREE_TOOLS.includes(row.tool);
              return (
                <TableRow key={row.tool}>
                  <TableCell className="max-w-72">
                    <a href={`/tools/${row.tool}`} className="font-medium hover:underline" target="_blank" rel="noreferrer">
                      {name}
                    </a>
                    <span className="block text-xs whitespace-normal text-muted-foreground">{TRACKING[row.tool]}</span>
                    {row.failedCalls ? (
                      <span className="block text-xs text-warning">{count(row.failedCalls)} failed paid call(s): no usable answer, or no answer at all (cost unknown, not added)</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{count(row.totalUses)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {count(row.uses.on_device)} / {count(row.uses.server)} / {count(row.uses.template)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{count(row.visitors)}</TableCell>
                  <TableCell className="text-right tabular-nums">{ai ? usd(row.costUsd, 4) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{count(row.signups)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.costPerSignupUsd === null ? "—" : usd(row.costPerSignupUsd)}</TableCell>
                  <TableCell>
                    {ai ? (
                      <div className="space-y-1">
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          Today {usd(row.todayUsd, 4)}
                          {row.setting.dailyCapCents === null ? ", no cap" : ` of ${usd(row.setting.dailyCapCents / 100)}`}
                          {row.setting.capFromSetting ? "" : " (default)"}
                        </span>
                        <ToolCapForm tool={row.tool} name={name} capCents={row.setting.dailyCapCents} fromSetting={row.setting.capFromSetting} />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No AI call</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ToolSwitch tool={row.tool} name={name} enabled={row.setting.enabled} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </AdminSection>
    </AdminPage>
  );
}
