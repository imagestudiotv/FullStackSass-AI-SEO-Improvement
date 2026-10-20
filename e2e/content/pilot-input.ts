import { readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { ArticleBrief } from "@/lib/articles/generate";

const text = z.string().max(20000).nullable();
const strings = z.array(z.string().max(5000)).max(100);
const briefSchema = z.object({
  title: z.string().min(1).max(500), targetKeyword: z.string().min(1).max(500),
  intent: text, relatedKeywords: strings, brandName: text, industry: text,
  country: text, language: text, description: text, targetAudience: text,
  services: strings, customInstructions: text, articleInstructions: text,
  tone: text, avoid: text, vocabulary: text, usps: strings, facts: strings,
  socialLinks: z.array(z.object({ platform: z.string(), url: z.string().url() }).strict()).max(30),
  backlink: z.null(), articleStyle: text, targetWordCount: z.number().int().min(300).max(5000).nullable(),
  internalLinkTarget: z.number().int().nonnegative().nullable(),
  tableOfContents: z.boolean(), authorPerspective: z.boolean(),
  mentionSimilarProducts: z.boolean(), comparisonTable: z.boolean(),
  tableCount: z.number().int().min(1).max(3), faqSection: z.boolean(),
  imageStyle: text, imageBrief: text, imageInstructions: text,
}).strict() satisfies z.ZodType<ArticleBrief>;

export const customerPilotSchema = z.object({
  version: z.literal(1), caseId: z.string().regex(/^customer-[a-z0-9-]{1,70}$/),
  websiteId: z.string().uuid(), calendarItemId: z.string().uuid(),
  capturedAt: z.string().datetime(), brief: briefSchema,
}).strict();

export function loadCustomerPilot(filename: string) {
  // Real paths also reject symlinks/junctions pointing outside the ignored folder.
  const root = realpathSync(path.resolve("test-results/content-pilot/customer-inputs"));
  const file = realpathSync(path.resolve(filename));
  const relative = path.relative(root, file);
  if (relative.startsWith("..") || path.isAbsolute(relative) || path.extname(file) !== ".json") {
    throw new Error("Customer pilot inputs must be JSON files inside test-results/content-pilot/customer-inputs.");
  }
  if (statSync(file).size > 256000) throw new Error("Customer pilot input is too large.");
  return customerPilotSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}
