import Anthropic from "@anthropic-ai/sdk";

import { anthropic } from "@/lib/ai/client";
import { engineModel, type CheckedEngineId } from "@/lib/geo/engines";
import type { Market } from "@/lib/geo/market";

/**
 * Asking each assistant a customer's question, the way the customer's own
 * assistant would answer it today: with web search on, from where the
 * customer is.
 *
 * Until 2026-11-27 only Claude was asked, through its API with no tools, so
 * the answer came from training data alone - not what a person sees in
 * Claude, ChatGPT or Gemini, all of which search the web for a "where can I
 * buy..." question. Each engine here turns its provider's web search on:
 *
 *  - Claude: Anthropic's server tool web_search (web_search_20250305, the
 *    version every current model accepts), with the asker's country;
 *  - ChatGPT: OpenAI's Responses API with its web_search tool and the
 *    asker's country (plain fetch: the OpenAI key is already used for images
 *    and no SDK is installed for it);
 *  - Gemini: Google's Generative Language API with Google Search grounding
 *    (GOOGLE_AI_API_KEY). Its search grounding takes no location setting
 *    (Google's grounding docs, checked 2026-11-28), so the asker's country
 *    goes in a one-line system instruction, as the Gemini app knows where its
 *    user is: a location, never the brand.
 *
 * A provider that refuses the search tool (an account without web search
 * enabled, a model without it) is asked once more without it, and the
 * answer is recorded with web search OFF - shown as such on the page, never
 * passed off as a searched answer.
 *
 * No system prompt naming the brand: mentioning it would prime the model to
 * produce it, and the measurement would report our own suggestion back.
 */

export type AssistantAnswer = {
  engine: CheckedEngineId;
  /** The model that answered, as the provider reports it when it does. */
  model: string;
  webSearch: boolean;
  text: string;
  /** Web pages the answer cited, as the provider listed them. */
  sources: string[];
  /** Searches the provider ran (what web search is billed by). */
  searches: number;
  usage: { inputTokens: number; outputTokens: number };
};

type Env = Record<string, string | undefined>;
export type AskOptions = { fetch?: typeof fetch; env?: Env };

/** An answer takes seconds; a search-heavy one up to a minute or two. */
const TIMEOUT_MS = 120_000;
/** Enough for a recommendation answer; a longer one costs more and says no more. */
const MAX_OUTPUT_TOKENS = 1500;
/** Searches Claude may run per answer: one or two is what a recommendation needs. */
const CLAUDE_MAX_SEARCHES = 3;

/** The search tool, as each provider names it in an error. */
const SEARCH_TOOL = String.raw`(?:web[_ ]?search(?:_preview)?|google[_ ]?search|search grounding|grounding)`;
/** Words that say the tool cannot be used here: switched off for the account, or not offered for the model. */
const UNAVAILABLE = String.raw`(?:not (?:enabled|supported|available|allowed|permitted)|disabled|unsupported|unavailable)`;
const SEARCH_UNAVAILABLE = new RegExp(`${SEARCH_TOOL}[^.]{0,80}?${UNAVAILABLE}|${UNAVAILABLE}[^.]{0,40}?${SEARCH_TOOL}`, "i");

/**
 * A provider refusing the search tool itself: an organisation with web
 * search switched off (Anthropic: 400 "web search is not enabled"), or a
 * model that does not take the tool. Only then is the question asked again
 * without search.
 *
 * Any other 400 is thrown (review of 2026-11-28: every 400 that mentioned
 * "tool" used to be taken as a refusal and quietly downgraded), including
 * one about the search tool's own settings - a country the provider does
 * not accept is our mistake to see, not a reason to stop searching.
 */
export function refusesSearch(status: number, message: string): boolean {
  if (status !== 400 && status !== 403) return false;
  if (/user_location|country|location/i.test(message)) return false;
  return SEARCH_UNAVAILABLE.test(message);
}

const unique = (values: string[]) => [...new Set(values.filter((v) => typeof v === "string" && v.startsWith("http")))].slice(0, 20);

/* ------------------------------------------------------------------------ */
/* Claude                                                                    */
/* ------------------------------------------------------------------------ */

async function askClaude(prompt: string, market: Market, env: Env): Promise<AssistantAnswer> {
  const model = engineModel("claude", env);
  const tool: Anthropic.WebSearchTool20250305 = {
    type: "web_search_20250305",
    name: "web_search",
    max_uses: CLAUDE_MAX_SEARCHES,
    ...(market.countryCode ? { user_location: { type: "approximate", country: market.countryCode } } : {}),
  };
  const ask = (withSearch: boolean, messages: Anthropic.MessageParam[]) =>
    anthropic.messages.create(
      { model, max_tokens: MAX_OUTPUT_TOKENS, messages, ...(withSearch ? { tools: [tool] } : {}) },
      { timeout: TIMEOUT_MS },
    );

  const first: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  let webSearch = true;
  let response: Anthropic.Message;
  try {
    response = await ask(true, first);
  } catch (error) {
    if (!(error instanceof Anthropic.APIError) || !refusesSearch(error.status ?? 0, error.message)) throw error;
    webSearch = false;
    response = await ask(false, first);
  }

  const usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
  let searches = response.usage.server_tool_use?.web_search_requests ?? 0;
  let content = response.content;
  /*
    A long server-tool turn can pause; it is continued once, as the API
    asks, with the paused turn sent back. A second pause is answered with
    what was written so far.
  */
  if (response.stop_reason === "pause_turn") {
    const more = await ask(webSearch, [...first, { role: "assistant", content: response.content }]);
    usage.inputTokens += more.usage.input_tokens;
    usage.outputTokens += more.usage.output_tokens;
    searches += more.usage.server_tool_use?.web_search_requests ?? 0;
    content = [...content, ...more.content];
  }

  const texts = content.filter((block): block is Anthropic.TextBlock => block.type === "text");
  const sources = texts.flatMap((block) =>
    (block.citations ?? []).flatMap((citation) => (citation.type === "web_search_result_location" ? [citation.url] : [])),
  );
  return {
    engine: "claude",
    model: response.model || model,
    webSearch,
    text: texts.map((block) => block.text).join("").trim(),
    sources: unique(sources),
    searches,
    usage,
  };
}

/* ------------------------------------------------------------------------ */
/* ChatGPT (OpenAI Responses API)                                            */
/* ------------------------------------------------------------------------ */

type OpenAiResponse = {
  model?: string;
  status?: string;
  error?: { message?: string } | null;
  output?: {
    type?: string;
    content?: { type?: string; text?: string; annotations?: { type?: string; url?: string }[] }[];
  }[];
  usage?: { input_tokens?: number; output_tokens?: number };
};

async function askChatGpt(prompt: string, market: Market, env: Env, http: typeof fetch): Promise<AssistantAnswer> {
  const model = engineModel("chatgpt", env);
  const tool = {
    type: "web_search",
    ...(market.countryCode ? { user_location: { type: "approximate", country: market.countryCode } } : {}),
  };
  const ask = (withSearch: boolean) =>
    http("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      // store: false - nothing of the customer's question is kept at OpenAI for later.
      body: JSON.stringify({ model, input: prompt, store: false, max_output_tokens: MAX_OUTPUT_TOKENS * 4, ...(withSearch ? { tools: [tool] } : {}) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  let webSearch = true;
  let response = await ask(true);
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    if (!refusesSearch(response.status, message)) throw new Error(`OpenAI ${response.status}: ${message.slice(0, 200)}`);
    webSearch = false;
    response = await ask(false);
    if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(await response.text().catch(() => "")).slice(0, 200)}`);
  }

  const body = (await response.json()) as OpenAiResponse;
  if (body.error?.message) throw new Error(`OpenAI: ${body.error.message.slice(0, 200)}`);
  const output = body.output ?? [];
  const parts = output.filter((item) => item.type === "message").flatMap((item) => item.content ?? []).filter((part) => part.type === "output_text");
  const text = parts.map((part) => part.text ?? "").join("").trim();
  // An empty answer is not "not mentioned": the caller records nothing for it.
  if (!text) throw new Error("OpenAI returned no answer");
  return {
    engine: "chatgpt",
    model: body.model || model,
    webSearch,
    text,
    sources: unique(parts.flatMap((part) => (part.annotations ?? []).flatMap((a) => (a.type === "url_citation" && a.url ? [a.url] : [])))),
    searches: output.filter((item) => item.type === "web_search_call").length,
    usage: { inputTokens: body.usage?.input_tokens ?? 0, outputTokens: body.usage?.output_tokens ?? 0 },
  };
}

/* ------------------------------------------------------------------------ */
/* Gemini (Generative Language API, Google Search grounding)                 */
/* ------------------------------------------------------------------------ */

type GeminiResponse = {
  modelVersion?: string;
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    groundingMetadata?: { webSearchQueries?: string[]; groundingChunks?: { web?: { uri?: string } }[] };
  }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; toolUsePromptTokenCount?: number };
};

/** Where the asker is, for Gemini: "The user's approximate location: Ukraine (UA)." Null when not known. */
export function geminiLocation(market: Market): string | null {
  if (!market.region && !market.countryCode) return null;
  const where = market.region && market.countryCode ? `${market.region} (${market.countryCode})` : (market.region ?? market.countryCode);
  return `The user's approximate location: ${where}.`;
}

async function askGemini(prompt: string, market: Market, env: Env, http: typeof fetch): Promise<AssistantAnswer> {
  const model = engineModel("gemini", env);
  const location = geminiLocation(market);
  const ask = (withSearch: boolean) =>
    http(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": env.GOOGLE_AI_API_KEY ?? "", "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(location ? { systemInstruction: { parts: [{ text: location }] } } : {}),
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        ...(withSearch ? { tools: [{ google_search: {} }] } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  let webSearch = true;
  let response = await ask(true);
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    if (!refusesSearch(response.status, message)) throw new Error(`Gemini ${response.status}: ${message.slice(0, 200)}`);
    webSearch = false;
    response = await ask(false);
    if (!response.ok) throw new Error(`Gemini ${response.status}: ${(await response.text().catch(() => "")).slice(0, 200)}`);
  }

  const body = (await response.json()) as GeminiResponse;
  const candidate = body.candidates?.[0];
  const text = (candidate?.content?.parts ?? []).filter((part) => !part.thought).map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini returned no answer");
  const grounding = candidate?.groundingMetadata;
  const usage = body.usageMetadata ?? {};
  return {
    engine: "gemini",
    model: body.modelVersion || model,
    webSearch,
    text,
    sources: unique((grounding?.groundingChunks ?? []).map((chunk) => chunk.web?.uri ?? "")),
    searches: grounding?.webSearchQueries?.length ?? 0,
    usage: {
      inputTokens: (usage.promptTokenCount ?? 0) + (usage.toolUsePromptTokenCount ?? 0),
      outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
    },
  };
}

/** Asks one assistant one question. Throws when no answer came back: nothing is recorded then. */
export async function askEngine(engine: CheckedEngineId, prompt: string, market: Market, options: AskOptions = {}): Promise<AssistantAnswer> {
  const env = options.env ?? process.env;
  const http = options.fetch ?? fetch;
  if (engine === "claude") return askClaude(prompt, market, env);
  if (engine === "chatgpt") return askChatGpt(prompt, market, env, http);
  return askGemini(prompt, market, env, http);
}

/* ------------------------------------------------------------------------ */
/* What an answer cost                                                       */
/* ------------------------------------------------------------------------ */

export type AnswerPrice = { inputPerM: number; outputPerM: number; perSearch: number };

/**
 * List prices, USD, checked 2026-11-28 on each provider's pricing page (to
 * re-check before quoting margins): tokens per million, web search per
 * search. Chosen by the model that answered (the provider reports it, often
 * with a version: "gemini-3.5-flash-lite", "gpt-5-mini-2026-08-07"); an
 * unknown model of an engine is costed at that engine's fuller model, so
 * the estimate errs high rather than low.
 *
 *  - Claude: Haiku 5.5 $0.10 / $0.50 (prompts over 100K tokens $0.50 /
 *    $2.50), Haiku 4.5 $1 / $5, Sonnet 5 and 5.5 $2 / $10, Opus 5.5 $4 /
 *    $20. Web search $10 per 1,000, and its results are billed as input.
 *  - ChatGPT: GPT-5 nano $0.05 / $0.40, GPT-5 mini $0.25 / $2. Web search
 *    $10 per 1,000 calls, search content billed as input.
 *  - Gemini: 3.5 Flash-Lite $0.30 / $2.50, Flash $0.75 / $3.75 (Google's
 *    price until 2026-12-31; $1.50 / $7.50 from 2027-01-01). Gemini 3 and
 *    newer bill every search query the model runs, $14 per 1,000 after
 *    5,000 free a month per project (the free ones are not subtracted).
 */
export function answerPrice(engine: CheckedEngineId, model: string, inputTokens = 0): AnswerPrice {
  const m = model.toLowerCase();
  if (engine === "claude") {
    const perSearch = 0.01;
    if (m.includes("haiku-4")) return { inputPerM: 1, outputPerM: 5, perSearch };
    if (m.includes("haiku")) return inputTokens > 100_000 ? { inputPerM: 0.5, outputPerM: 2.5, perSearch } : { inputPerM: 0.1, outputPerM: 0.5, perSearch };
    if (m.includes("opus")) return { inputPerM: 4, outputPerM: 20, perSearch };
    return { inputPerM: 2, outputPerM: 10, perSearch };
  }
  if (engine === "chatgpt") {
    if (m.includes("nano")) return { inputPerM: 0.05, outputPerM: 0.4, perSearch: 0.01 };
    return { inputPerM: 0.25, outputPerM: 2, perSearch: 0.01 };
  }
  if (m.includes("lite")) return { inputPerM: 0.3, outputPerM: 2.5, perSearch: 0.014 };
  return { inputPerM: 0.75, outputPerM: 3.75, perSearch: 0.014 };
}

export function answerCostUsd(answer: Pick<AssistantAnswer, "engine" | "model" | "searches" | "usage">): number {
  const price = answerPrice(answer.engine, answer.model, answer.usage.inputTokens);
  const cost =
    (answer.usage.inputTokens / 1_000_000) * price.inputPerM +
    (answer.usage.outputTokens / 1_000_000) * price.outputPerM +
    answer.searches * price.perSearch;
  return Number(cost.toFixed(6));
}
