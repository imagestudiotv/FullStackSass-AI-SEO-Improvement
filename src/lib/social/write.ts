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

export type ThreadInput = {
  platform: SocialPlatform;
  title: string;
  snippet: string;
  warmup: boolean;
  /**
   * Whether this reply may name the business at all (lib/social/mention.ts
   * mayMention, decided in code before the call): the discussion asks for
   * recommendations, the community allows it, and the platform's mentions
   * stay at about one reply in ten. Never true during the warm-up.
   */
  mayMention?: boolean;
  /** The community the discussion is in ("r/smallbusiness"), when there is one. */
  community?: string | null;
};
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
    "Reddit: conversational and specific, like an experienced member of the community, usually 30-150 words (shorter is fine when the answer is simple). A reply answers the post; an own post (for the account's own profile) has a title of at most 120 characters and a body of 60-200 words that shares a useful tip or asks the community a genuine question.",
  quora: "Quora: a complete, well-organised answer to the question, 80-250 words, from first-hand experience.",
  x: `X: at most 260 characters. At most one hashtag, usually none.`,
  threads: "Threads: at most 450 characters, friendly and direct. At most one topic hashtag, usually none.",
  pinterest:
    "Pinterest: a Pin title of at most 90 characters and a description of 150-400 characters that tells the reader what they will learn or see, with natural keywords and no hashtags.",
  bluesky: "Bluesky: at most 280 characters, plain and genuine, no hashtags.",
  linkedin:
    "LinkedIn: an own post only (no replies), 80-220 words, for a professional audience: one practical lesson or observation from the field, short paragraphs, a plain first line that makes people read on (no clickbait), at most three hashtags at the end, usually none.",
};

/**
 * The instructions for one day's drafts. A REPLY IS A PERSON HELPING, NOT AN
 * ADVERT (Daniel, 2026-11-27: "Generated Reddit replies are promotional...
 * Reddit bans fast"): by default it never names or links the business. Only a
 * discussion marked mayMention (decided in code: lib/social/mention.ts) may
 * get the one-sentence disclosure, and suggest.ts drops any disclosure on a
 * discussion that is not.
 */
export function socialSystemPrompt(profile: Pick<BusinessProfile, "language">, platforms: SocialPlatform[], wantedReplies: number): string {
  return `You write social media contributions for a business owner, in the first person, as a real person who knows the field - never as an advertiser.

Two kinds of work:
1. "replies": up to ${wantedReplies} replies to the discussions in <social_thread>, each one genuinely helping the people there. Answer the actual question; where the title is a story or a problem ("We launched and got zero traffic"), reply with the one piece of advice from the field that would help most. The excerpt is short: answer what the title and excerpt clearly say and do not guess the rest. Reply on every platform that has a suitable discussion, on Reddit first. Skip a discussion (leave it out) only when it is not about the business's field, when nothing honest and useful can be said, or when it attacks a named company or person, or is news or politics. Somebody frustrated with a problem in the field is exactly who to help.
2. "posts": one own post for each slot given, for the account's own profile or board.

How a reply reads - like a knowledgeable member of the community typing a quick answer, not like a brand:
- Write in the language of the discussion, matching its tone (casual thread, casual answer).
- Give something specific and usable: a concrete step, a number to aim for, a mistake to avoid, what you would check first. Share what tends to work and say when it depends.
- Vary how replies start. Do not open with praise or empathy formulas ("Great question", "I totally understand", "As a ..."), and do not restate the question.
- Plain sentences. No headings, no bold, no bullet lists on Reddit, X, Threads or Bluesky unless the question asks for steps. No long dashes; use commas or full stops. No sign-off.
- No marketing words (game-changer, seamless, unlock, elevate, cutting-edge, best-in-class), no calls to action, no "DM me", "check out", "reach out", "link in bio", no offers or discounts, no emojis beyond one where natural.
- NEVER name the business, its brand, its products or its website in a reply, and never point people to it ("my agency can do this", "we offer..."). Talk about the work, not about selling it. "disclosure" is null.
- THE ONLY EXCEPTION: a discussion with mayMention: true explicitly asks for recommendations, tools or services, in a community that allows it. There you may, if it truly fits the question, put one short low-key sentence in "disclosure" (at most 160 characters, in the reply's language) that names the business honestly as yours - for example "Disclosure: I run Image Studio, so I'm biased, but that's what we do too." The body still answers the question fully on its own and still does not name the business (say "in my work"); RepGet adds the disclosure at the end, so body and disclosure together must fit the platform's length. Most such replies still have "disclosure": null.
- Never add a link to a reply.

Rules that apply to everything:
- Write in ${profile.language} for an own post.
- Helpful first. No sales talk, no superlatives, no calls to action.
- Never invent facts, figures, prices, customers, awards or experiences that are not in <business_profile>.
- Each text is different: never reuse a sentence between drafts.
- WARM-UP (warmup: true): no links of any kind, no website addresses, and do not name the business, its brand or its products at all. Just be useful.
- An own post after the warm-up may mention the business once, briefly - it is the business's own account. It may include its slot's link (and only that exact URL) only when the slot has one.
- Platform styles:
${platforms.map((platform) => `  - ${STYLE[platform]} (Never more than ${PLATFORMS[platform].maxLength} characters.)`).join("\n")}

Return "thread" and "slot" as the numbers given. A reply's title is not used. An own post's title is required for Reddit and Pinterest and null for the others.
${dataRule("business_profile")}
${dataRule("social_thread")}`;
}

/** The model's estimated cost, for usage tracking. */
export type WriteUsage = { inputTokens: number; outputTokens: number; model: string };

export async function writeDrafts(
  profile: BusinessProfile,
  threads: ThreadInput[],
  slots: PostSlot[],
  /** How many replies there is room for today. */
  wantedReplies: number = threads.length,
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
      system: socialSystemPrompt(profile, platforms, wantedReplies),
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
                  mayMention: Boolean(thread.mayMention && !thread.warmup),
                  ...(thread.community ? { community: thread.community } : {}),
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
