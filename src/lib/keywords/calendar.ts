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
- Each title targets exactly one supplied keyword, used naturally - never
  stuffed or repeated.
- Titles are specific and useful: "Teeth Whitening in Dublin: Costs and Options"
  rather than "Everything About Teeth Whitening".
- 50-65 characters where possible, so the title is not truncated in results.
- No clickbait, no invented statistics, no year numbers unless the keyword has one.
- Vary the format across the set: how-to, cost guide, comparison, checklist.
- Return one article per supplied keyword, in the order given.
- Several keywords may belong to the same topic. When they do, each title must
  answer a DIFFERENT question - a cost guide, a how-to and a comparison, not
  three rewordings of one article. Two titles that would produce the same
  article are a failure.`;

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

  /**
   * One slot per article the plan pays for, spread across the topics.
   *
   * This was `clusters.slice(0, limit)` — one article per topic, so the plan
   * could never be larger than the number of topics research happened to
   * produce. Clustering aims for 5-15, so a Grow customer paying for 30
   * articles got 11, and a Scale customer paying for 100 got the same 11.
   * The allowance was a ceiling that nothing ever reached.
   *
   * Slots are dealt ROUND-ROBIN rather than filling each topic in turn: the
   * clusters arrive ranked, so pass one gives every topic its pillar article,
   * pass two adds a second angle to each, and so on. A plan that runs out
   * partway therefore covers the most topics it can, instead of exhausting
   * the first topic before the second is touched.
   *
   * Each extra slot targets a DIFFERENT supporting keyword from the same
   * cluster, which is what keeps the articles distinct — three articles on
   * three real search terms, not three rewrites of one. A topic is only
   * revisited once every other topic has had a slot at that depth, and never
   * beyond the keywords it actually holds.
   */
  const slots: { cluster: KeywordCluster; keyword: string }[] = [];

  for (let depth = 0; slots.length < limit; depth += 1) {
    const before = slots.length;

    for (const cluster of clusters) {
      if (slots.length >= limit) break;

      /*
        Depth 0 is the pillar. Deeper passes take the cluster's other terms in
        order, so the second article targets its strongest supporting keyword.
        `terms` includes the pillar, so it is filtered out to avoid planning
        the same keyword twice.
      */
      const supporting = cluster.terms.filter(
        (term) => term.toLowerCase() !== cluster.pillarKeyword.toLowerCase(),
      );
      const keyword = depth === 0 ? cluster.pillarKeyword : supporting[depth - 1];

      // This cluster has no keyword left at this depth; others may.
      if (!keyword) continue;

      slots.push({ cluster, keyword });
    }

    /*
      A full pass that added nothing means every cluster is exhausted — the
      keywords genuinely do not support a plan this size. Stopping here is
      what prevents an infinite loop, and the shorter calendar is the honest
      outcome: padding it would mean inventing keywords nobody searches for.
    */
    if (slots.length === before) break;
  }

  if (slots.length === 0) return [];

  const response = await anthropic.messages.create({
    model: MODELS.GENERATION,
    max_tokens: 2000,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: slots
          .map((slot) => `${slot.keyword} (topic: ${slot.cluster.name})`)
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

  const dates = scheduleDates(slots.length);

  /**
   * Built from the slots, not from the model's list: a missing or renamed
   * title falls back to the keyword rather than dropping the article, so the
   * calendar always has exactly one entry per slot.
   *
   * The fallback is the KEYWORD, not the cluster name. With several articles
   * per topic, falling back to the topic name would give two entries the same
   * title — a keyword is at least unique to its slot and describes what the
   * article is about.
   */
  return slots.map((slot, index) => ({
    title: byKeyword.get(slot.keyword.toLowerCase()) ?? slot.keyword,
    targetKeyword: slot.keyword,
    intent: intentByTerm.get(slot.keyword) ?? null,
    clusterName: slot.cluster.name,
    scheduledFor: dates[index],
  }));
}
