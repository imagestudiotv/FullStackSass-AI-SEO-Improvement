import { anthropic, isAiConfigured, MODELS } from "@/lib/ai/client";
import type { KeywordCluster } from "@/lib/keywords/cluster";

/**
 * Turns clusters into a dated content plan.
 *
 * This is the screen a customer judges the product on: they see a month of
 * planned articles rather than a spreadsheet of keywords. Everything is a
 * suggestion — titles are editable, items can be rescheduled or removed.
 */

export type PlannedArticle = {
  title: string;
  targetKeyword: string;
  intent: string | null;
  clusterName: string;
  scheduledFor: Date;
};

const SCHEMA = {
  type: "object",
  properties: {
    articles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description:
              "Article headline a person would click. Includes the target keyword naturally.",
          },
          targetKeyword: {
            type: "string",
            description: "The pillar keyword this article targets, verbatim.",
          },
        },
        required: ["title", "targetKeyword"],
        additionalProperties: false,
      },
    },
  },
  required: ["articles"],
  additionalProperties: false,
} as const;

const SYSTEM = `You write article titles for an SEO content calendar.

Rules:
- Each title targets exactly one supplied pillar keyword, used naturally — never
  stuffed or repeated.
- Titles are specific and useful: "Teeth Whitening in Dublin: Costs and Options"
  rather than "Everything About Teeth Whitening".
- 50-65 characters where possible, so the title is not truncated in results.
- No clickbait, no invented statistics, no year numbers unless the keyword has one.
- Vary the format across the set: how-to, cost guide, comparison, checklist.
- Return one article per supplied keyword, in the order given.`;

/**
 * Fills consecutive days, several per day where the plan allows it.
 *
 * This used to spread the month's allowance evenly — `30 / count` days apart —
 * which left a five-article plan showing one article every six days and five
 * empty boxes between each. The calendar is the screen a customer judges the
 * product on, and a mostly empty month reads as a product that is not working.
 *
 * So: start tomorrow, fill every day in order, and put more than one on a day
 * only when the monthly allowance is larger than a month. A plan with fewer
 * articles than days simply runs out partway through the month rather than
 * rationing itself across it — an article a day for a fortnight is a better
 * start than one a week forever, and the next month's research refills it.
 *
 * Starts tomorrow so the first item is never already overdue.
 */
export function scheduleDates(count: number, from: Date = new Date()): Date[] {
  if (count <= 0) return [];

  /**
   * Articles per day. Ceiling against a 30-day month, so 60 becomes 2 and 90
   * becomes 3, while anything at or below 30 stays at one a day.
   */
  const perDay = Math.max(1, Math.ceil(count / 30));

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(from);
    date.setDate(date.getDate() + 1 + Math.floor(index / perDay));
    /**
     * Staggered through the working day when several share a date, so the
     * order within a day is stable and a reader can tell them apart.
     */
    date.setHours(9 + (index % perDay) * 3, 0, 0, 0);
    return date;
  });
}

export async function planCalendar(
  clusters: KeywordCluster[],
  limit: number,
  intentByTerm: Map<string, string> = new Map(),
): Promise<PlannedArticle[]> {
  if (!isAiConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  if (clusters.length === 0 || limit <= 0) return [];

  // Clusters arrive ranked, so taking the first `limit` spends the plan's
  // allowance on the most valuable topics.
  const selected = clusters.slice(0, limit);

  const response = await anthropic.messages.create({
    model: MODELS.GENERATION,
    max_tokens: 2000,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: selected
          .map((c) => `${c.pillarKeyword} (topic: ${c.name})`)
          .join("\n"),
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to plan this calendar");
  }

  const block = response.content.find((item) => item.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No content returned from calendar planning");
  }

  const parsed = JSON.parse(block.text) as { articles?: unknown };
  const raw = Array.isArray(parsed.articles) ? parsed.articles : [];

  const byKeyword = new Map<string, string>();
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const { title, targetKeyword } = item as Record<string, unknown>;
    if (typeof title !== "string" || typeof targetKeyword !== "string") continue;
    byKeyword.set(targetKeyword.trim().toLowerCase(), title.trim().slice(0, 200));
  }

  const dates = scheduleDates(selected.length);

  /**
   * Built from the clusters, not from the model's list: a missing or renamed
   * title falls back to the cluster name rather than dropping the article, so
   * the calendar always has exactly one entry per selected topic.
   */
  return selected.map((cluster, index) => ({
    title:
      byKeyword.get(cluster.pillarKeyword.toLowerCase()) ?? cluster.name,
    targetKeyword: cluster.pillarKeyword,
    intent: intentByTerm.get(cluster.pillarKeyword) ?? null,
    clusterName: cluster.name,
    scheduledFor: dates[index],
  }));
}
