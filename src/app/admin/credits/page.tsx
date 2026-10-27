import type { Metadata } from "next";

import { getCreditsAdmin } from "@/lib/admin/credits";
import { MAX_PLACEMENT_CREDITS, MIN_PLACEMENT_CREDITS } from "@/lib/backlinks/managed";
import { ACTION_ADMIN, isCreditAction, MAX_ACTION_PRICE, MAX_ADDON_PRICE, MAX_DAILY_FREE } from "@/lib/credits/prices";
import { formatDate, formatNumber } from "@/lib/i18n/format";

import { AdminPage, AdminPageHeader, AdminSection } from "../_ui/page";
import { CreditsForm } from "./credits-form";

export const metadata: Metadata = { title: "Credits" };

/**
 * Admin -> Credits (client, 2026-10-26): what each action and each service
 * costs in credits, and the daily credits a paying workspace is given. How
 * spending works: lib/credits/spend.ts.
 */
export default async function AdminCreditsPage() {
  const { settings, addons, usage } = await getCreditsAdmin();
  const addonBySlug = new Map(addons.map((addon) => [addon.slug, addon]));
  const label = (action: string) =>
    isCreditAction(action)
      ? ACTION_ADMIN[action].label
      : (addonBySlug.get(action.replace(/^addon:/, ""))?.name ?? action);

  return (
    <AdminPage width="narrow">
      <AdminPageHeader
        title="Credits"
        description={`Customers pay money for two things only: their plan and credit packs. Everything else is paid with credits. Set what each action and each service costs, and the daily credits. A backlink's credits (${MIN_PLACEMENT_CREDITS} to ${MAX_PLACEMENT_CREDITS}) are set per link when it is placed (Partner Network).`}
        meta={
          settings.updatedAt ? (
            <span>
              Last changed {formatDate(settings.updatedAt, "en", { day: "numeric", month: "short", year: "numeric" })}
              {settings.updatedBy ? ` by ${settings.updatedBy}` : ""}
            </span>
          ) : (
            <span>Nothing set yet: every action is free and there are no daily credits.</span>
          )
        }
      />

      <CreditsForm
        dailyFree={settings.dailyFree}
        prices={usage.filter(({ action }) => isCreditAction(action)).map(({ action }) => ({
          key: action,
          label: ACTION_ADMIN[action as keyof typeof ACTION_ADMIN].label,
          help: ACTION_ADMIN[action as keyof typeof ACTION_ADMIN].help,
          value: settings.prices[action as keyof typeof settings.prices],
        }))}
        services={addons.map((addon) => ({
          key: addon.id,
          label: addon.name,
          help:
            addon.kind === "quote"
              ? "Shown as \"from\": the work is quoted per website after the audit is reviewed, then taken from the customer's credits (Admin -> Organizations, adjustment). 0 hides the figure."
              : "Bought with credits on Billing and delivered by hand; the administrators are emailed for each order. 0 takes it off sale.",
          value: addon.creditPrice ?? 0,
        }))}
        maxDaily={MAX_DAILY_FREE}
        maxPrice={MAX_ACTION_PRICE}
        maxServicePrice={MAX_ADDON_PRICE}
      />

      <AdminSection title="Last 30 days" description="Credits spent on each action and service, not counting what was given back because it failed." bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-5 py-2 text-left font-medium">What</th>
                <th scope="col" className="px-5 py-2 text-right font-medium">Times</th>
                <th scope="col" className="px-5 py-2 text-right font-medium">Credits</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((row) => (
                <tr key={row.action} className="border-b last:border-b-0">
                  <td className="px-5 py-2.5">{label(row.action)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{formatNumber(row.spends, "en")}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{formatNumber(row.credits, "en")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminSection>
    </AdminPage>
  );
}
