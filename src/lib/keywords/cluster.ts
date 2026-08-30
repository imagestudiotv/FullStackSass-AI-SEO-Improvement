import { anthropic, isAiConfigured, MODELS } from "@/lib/ai/client";

/**
 * Groups keywords into topics, one article per topic.
 *
 * Without this, "teeth whitening dublin", "professional teeth whitening cost"
 * and "how long does teeth whitening last" become three articles that answer
 * the same question and compete with each other for the same results — keyword
 * cannibalisation, where the site's own pages split their ranking signal.
 * One article covering all three ranks better than three thin ones.
 *
 * Runs on Sonnet rather than Haiku: judging which phrases are genuinely the
 * same search need is the reasoning step that decides the content plan.
 */

export type ClusterInput = {
  term: string;
  volume: number | null;
  priorityScore: number;
};

export type KeywordCluster = {
  name: string;
  /** The keyword the article primarily targets. */
  pillarKeyword: string;
  /** Every keyword in this group, including the pillar. */
  terms: string[];
};

const SCHEMA = {
  type: "object",
  properties: {
    clusters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Short topic name, 2-5 words, e.g. 'Teeth Whitening'.",
          },
          pillarKeyword: {
            type: "string",
            description:
              "The single keyword the article targets. Must be one of the supplied terms.",
          },
          terms: {
            type: "array",
            items: { type: "string" },
            description:
              "All supplied terms belonging to this topic, including the pillar.",
          },
        },
        required: ["name", "pillarKeyword", "terms"],
        additionalProperties: false,
      },
    },
  },
  required: ["clusters"],
  additionalProperties: false,
} as const;

const SYSTEM = `You group SEO keywords into topics. One topic becomes one article.

Rules:
- Group keywords that a SINGLE article could satisfy. If two keywords need
  genuinely different articles, they belong in different topics.
- Use only the exact terms supplied. Never invent, reword or correct a term.
- Every supplied term appears in exactly one topic.
- The pillar keyword is the most commercially valuable term in its topic, not
  necessarily the highest volume one.
- Prefer 5-15 topics. A topic holding one keyword is fine when nothing else
  fits it.
- Topic names are human labels for a content calendar, not keywords.`;

export async function clusterKeywords(
  keywords: ClusterInput[],
): Promise<KeywordCluster[]> {
  if (!isAiConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  if (keywords.length === 0) return [];

  const list = keywords
    .map((k) => `${k.term} (volume ${k.volume ?? "?"}, score ${k.priorityScore})`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: MODELS.GENERATION,
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: `Keywords:\n${list}` }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to cluster these keywords");
  }

  const block = response.content.find((item) => item.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No content returned from clustering");
  }

  const parsed = JSON.parse(block.text) as { clusters?: unknown };
  if (!Array.isArray(parsed.clusters)) return [];

  /**
   * The model is told to reuse the supplied terms verbatim, but a hallucinated
   * or reworded term would silently fail to match any keyword row and be lost.
   * Everything is checked against the input set, and anything left over is
   * collected into its own cluster rather than dropped.
   */
  const valid = new Map(keywords.map((k) => [k.term.toLowerCase(), k.term]));
  const assigned = new Set<string>();
  const clusters: KeywordCluster[] = [];

  for (const item of parsed.clusters) {
    if (typeof item !== "object" || item === null) continue;
    const { name, pillarKeyword, terms } = item as Record<string, unknown>;
    if (typeof name !== "string" || !Array.isArray(terms)) continue;

    const members: string[] = [];
    for (const term of terms) {
      if (typeof term !== "string") continue;
      const real = valid.get(term.trim().toLowerCase());
      if (real && !assigned.has(real)) {
        assigned.add(real);
        members.push(real);
      }
    }
    if (members.length === 0) continue;

    const pillar =
      typeof pillarKeyword === "string"
        ? (valid.get(pillarKeyword.trim().toLowerCase()) ?? members[0])
        : members[0];

    clusters.push({
      name: name.trim().slice(0, 100),
      // Guard against a pillar the model placed in a different cluster.
      pillarKeyword: members.includes(pillar) ? pillar : members[0],
      terms: members,
    });
  }

  const orphans = keywords
    .map((k) => k.term)
    .filter((term) => !assigned.has(term));

  if (orphans.length > 0) {
    clusters.push({
      name: "Other keywords",
      pillarKeyword: orphans[0],
      terms: orphans,
    });
  }

  return clusters;
}
