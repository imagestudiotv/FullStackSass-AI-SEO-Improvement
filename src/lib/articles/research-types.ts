import { z } from "zod";

export const researchSourceSchema = z.object({
  id: z.string(), url: z.string().url().regex(/^https?:\/\//i), title: z.string(),
  retrievedAt: z.string(), excerpt: z.string(),
});
export const researchBriefSchema = z.object({
  version: z.literal(1),
  status: z.enum(["ready", "incomplete", "unavailable"]),
  mode: z.enum(["pilot", "on"]),
  question: z.string(),
  intent: z.string(),
  businessAngle: z.string(),
  subquestions: z.array(z.string()),
  sources: z.array(researchSourceSchema),
  claims: z.array(z.object({ text: z.string(), sourceId: z.string(), quote: z.string() })),
  warnings: z.array(z.string()),
  checkedAt: z.string(),
  quality: z.object({ issues: z.array(z.string()), checked: z.boolean() }).optional(),
  correction: z.object({
    attempted: z.literal(true), applied: z.boolean(),
    initialIssues: z.array(z.string()), failure: z.string().optional(),
    followUp: z.object({ applied: z.boolean(), issues: z.array(z.string()), failure: z.string().optional() }).optional(),
  }).optional(),
});
export type ResearchSource = z.infer<typeof researchSourceSchema>;
export type ResearchBrief = z.infer<typeof researchBriefSchema>;

/** Empty scope must never turn a selected-site experiment into a global rollout. */
export function researchRollout(): { mode: "off" | "pilot" | "on"; websiteIds: string[]; allWebsites: boolean } {
  const mode = process.env.ARTICLE_RESEARCH_MODE;
  const websiteIds = [...new Set((process.env.ARTICLE_RESEARCH_WEBSITE_IDS ?? "")
    .split(",").map(x => x.trim()).filter(Boolean))];
  const allWebsites = websiteIds.length === 1 && websiteIds[0] === "*";
  return {
    mode: (mode === "pilot" || mode === "on") && websiteIds.length > 0 ? mode : "off",
    websiteIds: websiteIds.filter(id => id !== "*"),
    allWebsites,
  };
}

/** Rollout is explicit; existing customers keep their workflow until selected. */
export function researchMode(websiteId: string): "off" | "pilot" | "on" {
  const rollout = researchRollout();
  return rollout.allWebsites || rollout.websiteIds.includes(websiteId) ? rollout.mode : "off";
}

export function readResearch(value: unknown): ResearchBrief | null {
  const parsed = researchBriefSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function researchNeedsReview(research: ResearchBrief | null): boolean {
  return Boolean(research && (
    research.mode === "pilot" || research.status !== "ready" || research.warnings.length > 0 ||
    !research.quality?.checked || research.quality.issues.length > 0
  ));
}
