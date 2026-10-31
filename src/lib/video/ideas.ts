import "server-only";

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod/v4";

import { anthropic, isAiConfigured, MODELS } from "@/lib/ai/client";
import { dataBlock, dataRule } from "@/lib/ai/untrusted";
import { mainLanguageCode } from "@/lib/articles/translation-languages";
import { db } from "@/lib/db";
import { articles, brandVoice, videoIdeas, videoMedia, websites } from "@/lib/db/schema";
import { PRICING, track } from "@/lib/usage";

import { IDEAS_PER_DAY, VIDEO_STYLES, type MediaItem, type VideoFormat, type VideoScript, type VideoStyle } from "./formats";
import { readVideoSettings, videoAccess } from "./settings";

/**
 * A website's video ideas for the day (client, 2026-10-29: "we are giving 20
 * swipes like the reference website"), topped up to IDEAS_PER_DAY - so the
 * daily run, a retry and a run after the customer opens the page never add
 * more than the day's twenty.
 *
 * One model call writes them all, from the website's live articles and its
 * business profile. An idea is only a script: it is previewed in the browser
 * with the real template (no voice, nothing rendered), so twenty cost a few
 * cents. Only an approved one is voiced and made into a video
 * (lib/video/make.ts).
 *
 * Most ideas use the website's chosen style; a few use the others, so the
 * customer sees what else there is. About one in four is a carousel.
 */

const utcDay = (now: Date) => now.toISOString().slice(0, 10);

const servicesOf = (site: { services: unknown }): string[] =>
  Array.isArray(site.services) ? site.services.filter((service): service is string => typeof service === "string") : [];

const ideaSchema = z.object({
  ideas: z.array(
    z.object({
      title: z.string(),
      article: z.number().int().nullable(),
      hook: z.string(),
      points: z.array(
        z.object({
          title: z.string(),
          detail: z.string(),
          stat: z.object({ value: z.number(), suffix: z.string(), label: z.string() }).nullable(),
        }),
      ),
      proof: z.string(),
      cta: z.string(),
      caption: z.string(),
      hashtags: z.array(z.string()),
    }),
  ),
});

type WrittenIdea = z.infer<typeof ideaSchema>["ideas"][number];

export type SuggestVideoResult = { created: number; reason?: string };

const clip = (text: string, max: number) => text.replace(/\s+/g, " ").trim().slice(0, max);

/** A script as the templates can show it: the right number of points, each text within its space. */
export function cleanScript(idea: WrittenIdea): VideoScript | null {
  const points = idea.points
    .filter((point) => point.title.trim())
    .slice(0, 4)
    .map((point) => ({
      title: clip(point.title, 48),
      detail: clip(point.detail, 180),
      stat:
        point.stat && Number.isFinite(point.stat.value) && point.stat.value >= 0 && point.stat.value < 1e9
          ? { value: point.stat.value, suffix: clip(point.stat.suffix, 6), label: clip(point.stat.label, 40) }
          : null,
    }));
  const hook = clip(idea.hook, 80);
  if (points.length < 2 || !hook) return null;
  return { hook, points, proof: clip(idea.proof, 160), cta: clip(idea.cta, 80) };
}

/** The caption with its hashtags, within every platform's limit (TikTok and Instagram: 2,200). */
export function captionText(caption: string, hashtags: string[]): string {
  const tags = [...new Set(hashtags.map((tag) => tag.replace(/[^\p{L}\p{N}_]/gu, "")).filter(Boolean))]
    .slice(0, 5)
    .map((tag) => `#${tag}`);
  return [clip(caption, 1500), tags.join(" ")].filter(Boolean).join("\n\n");
}

/** Today's styles: mostly the website's own, every fourth another one, so the others are seen too. */
export function styleFor(index: number, chosen: VideoStyle): VideoStyle {
  if (index % 4 !== 3) return chosen;
  const others = VIDEO_STYLES.filter((style) => style !== chosen);
  return others[Math.floor(index / 4) % others.length];
}

export function formatFor(index: number): VideoFormat {
  return index % 4 === 1 ? "carousel" : "reel";
}

export type IdeaDeps = {
  write: typeof writeIdeas;
};

export async function suggestVideoIdeas(websiteId: string, now: Date = new Date(), deps: Partial<IdeaDeps> = {}): Promise<SuggestVideoResult> {
  const write = deps.write ?? writeIdeas;
  const [site] = await db.select().from(websites).where(eq(websites.id, websiteId));
  if (!site || site.status !== "ready") return { created: 0, reason: "website not ready" };
  if ((await videoAccess(websiteId)) === "none") return { created: 0, reason: "no plan" };
  if (!isAiConfigured()) return { created: 0, reason: "AI is not configured" };

  const day = utcDay(now);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(videoIdeas)
    .where(and(eq(videoIdeas.websiteId, websiteId), eq(videoIdeas.day, day)));
  const wanted = IDEAS_PER_DAY - Number(n);
  if (wanted <= 0) return { created: 0, reason: "the day has its ideas" };

  const [settings, live, own, recent, [voice]] = await Promise.all([
    readVideoSettings(websiteId),
    db
      .select({ id: articles.id, title: articles.title, keyword: articles.targetKeyword, summary: articles.metaDescription, imageUrl: articles.imageUrl })
      .from(articles)
      .where(and(eq(articles.websiteId, websiteId), isNotNull(articles.publishedUrl), isNotNull(articles.firstLiveAt)))
      .orderBy(desc(articles.firstLiveAt))
      .limit(15),
    db.select().from(videoMedia).where(eq(videoMedia.websiteId, websiteId)).orderBy(desc(videoMedia.createdAt)).limit(12),
    db
      .select({ title: videoIdeas.title })
      .from(videoIdeas)
      .where(eq(videoIdeas.websiteId, websiteId))
      .orderBy(desc(videoIdeas.createdAt))
      .limit(120),
    db.select({ tone: brandVoice.tone, avoid: brandVoice.avoid }).from(brandVoice).where(eq(brandVoice.websiteId, websiteId)),
  ]);

  const language = mainLanguageCode(site.language);
  const { ideas, usage } = await write({
    count: wanted,
    language: site.language || "English",
    profile: {
      brandName: site.brandName,
      domain: site.domain,
      description: site.description,
      industry: site.industry,
      services: servicesOf(site),
      targetAudience: site.targetAudience,
      country: site.country,
      tone: voice?.tone ?? null,
      avoid: voice?.avoid ?? null,
    },
    articles: live.map((article) => ({ title: article.title, keyword: article.keyword, summary: article.summary })),
    avoidTitles: recent.map((row) => row.title),
  });
  const price = PRICING.llm[usage.model as keyof typeof PRICING.llm];
  await track(site.organizationId, {
    kind: "llm",
    websiteId,
    provider: "anthropic",
    model: usage.model,
    quantity: usage.inputTokens + usage.outputTokens,
    costUsd: price ? (usage.inputTokens / 1000) * price.inputPer1k + (usage.outputTokens / 1000) * price.outputPer1k : undefined,
    metadata: { purpose: "video_ideas", ideas: wanted },
  });

  const ownMedia: MediaItem[] = own.map((item) => ({ url: item.url, kind: item.kind === "video" ? "video" : "image" }));
  const pictures = live.flatMap((article) => (article.imageUrl ? [article.imageUrl] : []));
  const seen = new Set(recent.map((row) => row.title.toLowerCase()));
  const rows: (typeof videoIdeas.$inferInsert)[] = [];
  for (const idea of ideas) {
    if (rows.length >= wanted) break;
    const script = cleanScript(idea);
    const title = clip(idea.title, 90);
    if (!script || !title || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    const index = Number(n) + rows.length;
    const article = idea.article && idea.article >= 1 ? live[idea.article - 1] : undefined;
    // Its article's picture first, then the customer's own, then the website's others.
    const media: MediaItem[] = [
      ...(article?.imageUrl ? [{ url: article.imageUrl, kind: "image" as const }] : []),
      ...ownMedia.slice(index % Math.max(1, ownMedia.length)).concat(ownMedia).slice(0, 3),
      ...pictures.filter((url) => url !== article?.imageUrl).slice(index % 5, (index % 5) + 3).map((url) => ({ url, kind: "image" as const })),
    ].slice(0, 5);
    rows.push({
      websiteId,
      day,
      format: formatFor(index),
      style: styleFor(index, settings.style),
      language,
      title,
      script,
      caption: captionText(idea.caption, idea.hashtags),
      articleId: article?.id ?? null,
      media,
      voice: settings.voice,
      captions: settings.captions,
    });
  }
  if (rows.length > 0) await db.insert(videoIdeas).values(rows);
  return { created: rows.length };
}

export type IdeaInput = {
  count: number;
  language: string;
  profile: Record<string, unknown>;
  articles: { title: string; keyword: string | null; summary: string | null }[];
  avoidTitles: string[];
};

export async function writeIdeas(input: IdeaInput): Promise<{ ideas: WrittenIdea[]; usage: { inputTokens: number; outputTokens: number; model: string } }> {
  const response = await anthropic.messages.create(
    {
      model: MODELS.GENERATION,
      max_tokens: 16000,
      output_config: { format: zodOutputFormat(ideaSchema) },
      system: `You write scripts for short vertical social media videos (Instagram Reels, TikTok, YouTube Shorts, Facebook Reels) for a business, from its website's content. A faceless animated video: big words on screen, an AI voice reading the script, captions.

Write ${input.count} different ideas, all in ${input.language}.

Each idea:
- "title": a short name for the idea (at most 60 characters), for the business owner's list.
- "article": the number of the article it is based on, or null for a general idea about the business's field. Base most ideas on the articles.
- "hook": the first line, said in the first two seconds: a question, a surprising fact, or a bold promise that makes the viewer stay. At most 60 characters. No clickbait that the video does not deliver.
- "points": 3 points (2 or 4 when it fits better). Each has a "title" shown big on screen (at most 40 characters, punchy, like a checklist item) and a "detail": one sentence the voice adds (at most 20 words).
  "stat": only when the material states a real figure for that point: {value, suffix ("%", "x", "+", "" ...), label (at most 30 characters)}. Otherwise null. NEVER invent a number.
- "proof": one line that makes it credible - a fact from the material, or what the business does. Never invent customers, results, awards or prices.
- "cta": the closing line, e.g. inviting to follow for more or to visit the website by name (no URL, no "link in bio").
- "caption": the post text under the video: 1-3 short sentences that add value, conversational, at most one emoji. No links.
- "hashtags": 3-5 relevant hashtags without the "#".

The whole script read aloud (hook, points with details, proof, cta) must take 25-45 seconds: about 70-110 words.
Vary the angles across ideas: tips, mistakes to avoid, myths, how-to steps, checklists, before/after, questions customers ask. Never repeat an idea from the list of earlier titles.
Helpful first, like a knowledgeable creator - not an advert. Follow the business's tone and avoid what it asks to avoid.
${dataRule("business_profile")}
${dataRule("website_page")}`,
      messages: [
        {
          role: "user",
          content: [
            dataBlock("business_profile", JSON.stringify(input.profile)),
            dataBlock(
              "website_page",
              JSON.stringify(input.articles.map((article, index) => ({ article: index + 1, ...article }))),
            ),
            `Earlier titles (do not repeat): ${JSON.stringify(input.avoidTitles.slice(0, 120))}`,
          ].join("\n\n"),
        },
      ],
    },
    { maxRetries: 0 },
  );
  if (response.stop_reason !== "end_turn") throw new Error("Video ideas did not finish");
  const ideas = ideaSchema.parse(JSON.parse(response.content.find((block) => block.type === "text")?.text ?? "")).ideas;
  return {
    ideas,
    usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, model: MODELS.GENERATION },
  };
}
