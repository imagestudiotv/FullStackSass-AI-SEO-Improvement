import { inngest } from "@/inngest/client";
import { refreshSiteInventory, websitesDueForInventory } from "@/lib/sites/inventory";

/**
 * Reads what each customer's WordPress site already has - its articles in
 * every language and its media library - once a day (lib/sites/inventory.ts;
 * client 2026-10-20, Image Studio). Planning, pictures and translations read
 * the stored copy, never the site itself.
 *
 * One website per step, so one slow or blocked site never holds up the
 * others, and a retry never reads a site twice. "sites/inventory.requested"
 * with a websiteId reads that one at once (when the customer turns on
 * pictures from their library, say).
 */
export const refreshSiteInventories = inngest.createFunction(
  {
    id: "refresh-site-inventories",
    retries: 1,
    concurrency: { limit: 1 },
    triggers: [{ cron: "40 3 * * *" }, { event: "sites/inventory.requested" }],
  },
  async ({ event, step, logger }) => {
    const data: unknown = event?.data;
    const only = data && typeof data === "object" && "websiteId" in data && typeof data.websiteId === "string" ? data.websiteId : null;
    const due = only ? [only] : await step.run("select-websites", () => websitesDueForInventory());
    let read = 0;
    for (const websiteId of due) {
      const result = await step.run(`read-${websiteId}`, () => refreshSiteInventory(websiteId));
      if (result.status === "ok") read += 1;
      logger.info({ step: "read", websiteId, ...result }, "Site inventory read");
    }
    return { websites: due.length, read };
  },
);
