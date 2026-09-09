"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { brandVoice } from "@/lib/db/schema";
import { requireWebsite } from "@/lib/tenant";
import type { ActionResult } from "@/lib/websites/actions";
import {
  MAX_EXAMPLE_ARTICLES,
  type BrandVoiceView,
  type SocialLink,
} from "@/lib/brand/shared";

/**
 * Brand voice.
 *
 * The article generator has always read these fields, but nothing ever wrote
 * them — so the table stayed empty and every article came out sounding like it
 * could belong to any business in the industry. This is the missing half.
 *
 * The `facts` field matters most. The generator is told never to invent facts
 * about a business, which keeps articles truthful but vague. Facts entered
 * here are the only specifics it is allowed to state, because a human
 * confirmed them.
 */

const EMPTY: BrandVoiceView = {
  tone: null,
  vocabulary: null,
  avoid: null,
  usps: [],
  facts: [],
  socialLinks: [],
  articleInstructions: null,
  exampleArticleUrls: [],
};

export async function getBrandVoice(
  websiteId: string,
): Promise<BrandVoiceView> {
  const { site } = await requireWebsite(websiteId);

  const [row] = await db
    .select()
    .from(brandVoice)
    .where(eq(brandVoice.websiteId, site.id))
    .limit(1);

  if (!row) return EMPTY;

  // jsonb columns are typed as unknown; anything malformed degrades to empty
  // rather than reaching the prompt as a broken value.
  return {
    tone: row.tone,
    vocabulary: row.vocabulary,
    avoid: row.avoid,
    usps: Array.isArray(row.usps) ? (row.usps as string[]) : [],
    facts: Array.isArray(row.facts) ? (row.facts as string[]) : [],
    socialLinks: Array.isArray(row.socialLinks)
      ? (row.socialLinks as SocialLink[])
      : [],
    articleInstructions: row.articleInstructions,
    exampleArticleUrls: Array.isArray(row.exampleArticleUrls)
      ? (row.exampleArticleUrls as string[])
      : [],
  };
}

export type BrandVoiceInput = {
  tone?: string | null;
  vocabulary?: string | null;
  avoid?: string | null;
  /** One per line in the UI; stored as an array. */
  usps?: string;
  facts?: string;
  socialLinks?: SocialLink[];
  articleInstructions?: string | null;
  /** One per line in the UI, same as usps and facts. */
  exampleArticleUrls?: string;
};

function clean(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Splits a textarea into a capped list, dropping blanks. */
function toList(value: string | undefined, max: number, maxLength: number) {
  if (!value) return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((line) => line.slice(0, maxLength));
}

export async function updateBrandVoice(
  websiteId: string,
  input: BrandVoiceInput,
): Promise<ActionResult<null>> {
  const { site } = await requireWebsite(websiteId);

  /**
   * Social URLs are validated rather than trusted. They end up in published
   * articles on the customer's own website, so a javascript: or data: URL
   * pasted here would become a link on their live site.
   */
  const socialLinks: SocialLink[] = [];
  for (const link of input.socialLinks ?? []) {
    const url = link.url?.trim();
    if (!url) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") continue;
      socialLinks.push({
        platform: link.platform.slice(0, 40),
        url: parsed.toString().slice(0, 300),
      });
    } catch {
      return { ok: false, error: `"${url}" is not a valid web address` };
    }
  }

  /**
   * Example URLs are validated the same way as social links: they are fetched
   * server-side when an article is written, so an unchecked value here would
   * be a request our server makes to wherever someone typed.
   */
  const exampleArticleUrls: string[] = [];
  for (const raw of toList(input.exampleArticleUrls, MAX_EXAMPLE_ARTICLES, 500)) {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") continue;
      exampleArticleUrls.push(parsed.toString());
    } catch {
      return { ok: false, error: `"${raw}" is not a valid web address` };
    }
  }

  const values = {
    tone: clean(input.tone, 500),
    vocabulary: clean(input.vocabulary, 500),
    avoid: clean(input.avoid, 500),
    usps: toList(input.usps, 8, 200),
    facts: toList(input.facts, 12, 200),
    socialLinks,
    articleInstructions: clean(input.articleInstructions, 2000),
    exampleArticleUrls,
    updatedAt: new Date(),
  };

  await db
    .insert(brandVoice)
    .values({ websiteId: site.id, ...values })
    // One row per website, enforced by the table's unique constraint.
    .onConflictDoUpdate({ target: brandVoice.websiteId, set: values });

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}
