/**
 * What an administrator asks for in a comparison article (Admin -> Blog ->
 * Autopilot; client, 2026-11-05): the things to compare and the brief. Plain
 * functions and no imports, so the schema, the admin actions and the writer can
 * all use them. What the autopilot does with it: lib/blog/autopilot/comparison.ts.
 */

export const ARTICLE_TYPES = ["informative", "comparison"] as const;
export type ArticleType = (typeof ARTICLE_TYPES)[number];

export const COMPARISON_LIMITS = {
  entitiesMin: 2,
  entitiesMax: 5,
  entity: 80,
  url: 500,
  brief: 2000,
  criteria: 8,
  criterion: 120,
} as const;

export type ComparisonEntity = {
  /** "Semrush", "Hiring an agency"... */
  name: string;
  /** Its own page, read first as research; null when the administrator gave none. */
  url: string | null;
};

export type ComparisonBrief = {
  entities: ComparisonEntity[];
  /** The angle, the reader, anything the writer should know. May be empty. */
  brief: string;
  /** What to compare them on. Empty: the writer chooses, from the research. */
  criteria: string[];
};

const line = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ");

function webAddress(value: string): string | null {
  // "acme.example/pricing" is fine without a scheme; "ftp://..." is not a web address.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) && !/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** What the form sent, tidied, or what is wrong with it in words for the administrator. */
export function cleanComparison(input: unknown): ComparisonBrief | string {
  const raw = (input ?? {}) as { entities?: unknown; brief?: unknown; criteria?: unknown };
  const rows = Array.isArray(raw.entities) ? raw.entities : [];
  const entities: ComparisonEntity[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const name = line((row as { name?: unknown } | null)?.name);
    if (!name) continue;
    if (name.length > COMPARISON_LIMITS.entity) return `Keep each thing to compare under ${COMPARISON_LIMITS.entity} characters`;
    const key = name.toLowerCase();
    if (seen.has(key)) return `"${name}" is listed twice`;
    seen.add(key);
    const typed = line((row as { url?: unknown } | null)?.url);
    if (typed.length > COMPARISON_LIMITS.url) return `The address for "${name}" is too long`;
    const url = typed ? webAddress(typed) : null;
    if (typed && !url) return `The address for "${name}" is not a web address`;
    entities.push({ name, url });
  }
  if (entities.length < COMPARISON_LIMITS.entitiesMin) return `Name at least ${COMPARISON_LIMITS.entitiesMin} things to compare`;
  if (entities.length > COMPARISON_LIMITS.entitiesMax) return `Compare at most ${COMPARISON_LIMITS.entitiesMax} things in one article`;
  const brief = String(raw.brief ?? "").trim();
  if (brief.length > COMPARISON_LIMITS.brief) return `Keep the brief under ${COMPARISON_LIMITS.brief} characters`;
  const criteria = [...new Set((Array.isArray(raw.criteria) ? raw.criteria : []).map(line).filter(Boolean))];
  if (criteria.length > COMPARISON_LIMITS.criteria) return `Give at most ${COMPARISON_LIMITS.criteria} things to compare them on`;
  if (criteria.some((criterion) => criterion.length > COMPARISON_LIMITS.criterion)) return `Keep each criterion under ${COMPARISON_LIMITS.criterion} characters`;
  return { entities, brief, criteria };
}

/** A stored brief, read defensively; null when it cannot be written from. */
export function readComparison(value: unknown): ComparisonBrief | null {
  const clean = cleanComparison(value);
  return typeof clean === "string" ? null : clean;
}

/** The same comparison however it is worded or ordered: "A vs B" and "B vs A" are one article. */
export function comparisonKey(brief: Pick<ComparisonBrief, "entities">): string {
  return brief.entities
    .map((entity) => entity.name.toLowerCase())
    .sort()
    .join("|");
}

/** "Semrush vs Ahrefs vs Moz". */
export function comparisonLabel(brief: Pick<ComparisonBrief, "entities">): string {
  return brief.entities.map((entity) => entity.name).join(" vs ");
}
