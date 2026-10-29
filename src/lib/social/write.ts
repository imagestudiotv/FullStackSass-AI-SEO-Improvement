import "server-only";

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";

import { anthropic, MODELS } from "@/lib/ai/client";
import { dataBlock, dataRule } from "@/lib/ai/untrusted";

import { PLATFORMS, type SocialPlatform } from "./platforms";

/**
 * Writes the day's drafts in one model call: replies to the discussions
 * found, and the own posts. Everything returned is checked again in code
 * (lib/social/rules.ts checkDraft) - the instructions below are the first
 * line, not the guarantee.
 */

export type BusinessProfile = {
  brandName: string | null;
  domain: string;
  description: string | null;
  industry: string | null;
  services: string[];
  targetAudience: string | null;
  country: string | null;
  language: string;
  tone: string | null;
  avoid: string | null;
};

export type ThreadInput = { platform: SocialPlatform; title: string; snippet: string; warmup: boolean };
export type PostSlot = {
  platform: SocialPlatform;
  warmup: boolean;
  /** The one link this post may carry (a live article), or null. */
  link: { url: string; title: string } | null;
  /** For a Pin: what its picture shows (the article's title). */
  topic?: string | null;
};

export type Drafts = {
  /** `disclosure`: the one sentence that may name the business, added at the end (lib/social/rules.ts replyText). */
  replies: { thread: number; body: string; disclosure?: string | null }[];
  posts: { slot: number; title: string | null; body: string }[];
};

const draftsSchema = z.object({
  replies: z.array(z.object({ thread: z.number().int(), body: z.string(), disclosure: z.string().nullable() })),
  posts: z.array(z.object({ slot: z.number().int(), title: z.string().nullable(), body: z.string() })),
});

/** Per platform, how a good contribution reads there. */
const STYLE: Record<SocialPlatform, string> = {
  reddit:
    "Reddit: conversational and specific, like an experienced member of the community, 40-150 words. A reply answers the post; an own post (for the account's own profile) has a title of at most 120 characters and a body of 60-200 words that shares a useful tip or asks the community a genuine question.",
  quora: "Quora: a complete, well-organised answer to the question, 80-250 words, from first-hand experience.",
  x: `X: at most 260 characters. At most one hashtag, usually none.`,
  threads: "Threads: at most 450 characters, friendly and direct. At most one topic hashtag, usually none.",
  pinterest:
    "Pinterest: a Pin title of at most 90 characters and a description of 150-400 characters that tells the reader what they will learn or see, with natural keywords and no hashtags.",
  bluesky: "Bluesky: at most 280 characters, plain and genuine, no hashtags.",
};

/** The model's estimated cost, for usage tracking. */
export type WriteUsage = { inputTokens: number; outputTokens: number; model: string };

export async function writeDrafts(
  profile: BusinessProfile,
  threads: ThreadInput[],
  slots: PostSlot[],
): Promise<{ drafts: Drafts; usage: WriteUsage }> {
  if (threads.length === 0 && slots.length === 0) {
    return { drafts: { replies: [], posts: [] }, usage: { inputTokens: 0, outputTokens: 0, model: MODELS.GENERATION } };
  }
  const platforms = [...new Set([...threads.map((thread) => thread.platform), ...slots.map((slot) => slot.platform)])];

  const response = await anthropic.messages.create(
    {
      model: MODELS.GENERATION,
      max_tokens: 8000,
      output_config: { format: zodOutputFormat(draftsSchema) },
      system: `You write social media contributions for a business owner, in the first person, as a real person who knows the field - never as an advertiser.

Two kinds of work:
1. "replies": for each discussion in <social_thread> worth answering, a reply that genuinely helps the person who asked. Answer the actual question. Skip a discussion (leave it out) when you cannot help honestly, when it is not about the business's field, or when it is a complaint, news or politics.
2. "posts": one own post for each slot given, for the account's own profile or board.

Rules that apply to everything:
- Write in the language of the discussion for a reply, and in ${profile.language} for an own post.
- Helpful first. No sales talk, no superlatives, no calls to action, no "DM me", no emojis beyond one where natural.
- Never invent facts, figures, prices, customers, awards or experiences that are not in <business_profile>.
- Each text is different: never reuse a sentence between drafts.
- WARM-UP (warmup: true): no links of any kind, no website addresses, and do not name the business, its brand or its products at all. Just be useful. A reply's "disclosure" is null.
- After the warm-up (warmup: false): a reply may mention the business only where it really answers the question, and then honestly. Keep the business's name out of the reply's "body" (say "my studio", "in my work") and put it in "disclosure": one short sentence, at most 160 characters, in the reply's language, saying plainly that you run or work at the business - for example "Disclosure: I run Image Studio." RepGet adds it at the end, so the body and the disclosure together must fit the platform's length. A reply that does not mention the business has "disclosure": null. Never add a link to a reply.
- An own post after the warm-up may mention the business once, briefly - it is the business's own account. It may include its slot's link (and only that exact URL) only when the slot has one.
- Platform styles:
${platforms.map((platform) => `  - ${STYLE[platform]} (Never more than ${PLATFORMS[platform].maxLength} characters.)`).join("\n")}

Return "thread" and "slot" as the numbers given. A reply's title is not used. An own post's title is required for Reddit and Pinterest and null for the others.
${dataRule("business_profile")}
${dataRule("social_thread")}`,
      messages: [
        {
          role: "user",
          content: [
            dataBlock("business_profile", JSON.stringify(profile)),
            dataBlock(
              "social_thread",
              JSON.stringify(
                threads.map((thread, index) => ({
                  thread: index + 1,
                  platform: PLATFORMS[thread.platform].name,
                  warmup: thread.warmup,
                  title: thread.title.slice(0, 300),
                  excerpt: thread.snippet.slice(0, 600),
                })),
              ),
            ),
            `Own post slots: ${JSON.stringify(
              slots.map((slot, index) => ({
                slot: index + 1,
                platform: PLATFORMS[slot.platform].name,
                warmup: slot.warmup,
                link: slot.link?.url ?? null,
                linkTitle: slot.link?.title ?? null,
                ...(slot.topic ? { pictureShows: slot.topic } : {}),
              })),
            )}`,
          ].join("\n\n"),
        },
      ],
    },
    { maxRetries: 0 },
  );
  if (response.stop_reason !== "end_turn") throw new Error("Social drafts did not finish");
  const drafts = draftsSchema.parse(JSON.parse(response.content.find((block) => block.type === "text")?.text ?? ""));
  return {
    drafts,
    usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, model: MODELS.GENERATION },
  };
}
