/**
 * The assistants we can check a business against.
 *
 * The reference lists eight — ChatGPT, Claude, Gemini, Perplexity, Grok,
 * DeepSeek, Microsoft Copilot, Google AI Overview and AI Mode — and lets the
 * customer split a prompt budget across them.
 *
 * We can only ask the ones we hold an API key for AND have a client for. An
 * engine listed but never queried would report "you are not mentioned" for a
 * check that never ran, which is worse than not offering it: the customer
 * would go and rewrite pages to fix a number that was never measured.
 *
 * Three can be asked since 2026-11-27 (lib/geo/assistants.ts), each with
 * web search on, as a customer's assistant answers today: Claude, ChatGPT
 * and Gemini. One runs only when its key is set AND it is named in
 * GEO_ENGINES; with GEO_ENGINES unset only Claude is asked (owner review,
 * 2026-11-28: OPENAI_API_KEY is already set for pictures, so a key alone
 * must never start a paid engine). The rest are listed, not asked.
 *
 * Pure: no client, no database. The words Copilot uses about AI visibility
 * are built from here (aiVisibilityWords), so they change with this list.
 */

export type EngineId =
  | "claude"
  | "chatgpt"
  | "gemini"
  | "perplexity"
  | "copilot"
  | "grok"
  | "deepseek"
  | "google-ai-overview";

export type Engine = {
  id: EngineId;
  name: string;
  /** Who this assistant's audience tends to be, in the customer's terms. */
  audience: string;
  /** Environment variable that switches it on. */
  envKey: string;
  /** The check has a client for it (lib/geo/assistants.ts); the others are listed only. */
  checked: boolean;
  /** Environment variable that picks the model, and the model used without it. */
  modelEnv?: string;
  defaultModel?: string;
};

export const ENGINES: Engine[] = [
  {
    id: "claude",
    name: "Claude",
    audience:
      "Thoughtful, research-oriented. Patient with longer answers and comparisons.",
    envKey: "ANTHROPIC_API_KEY",
    checked: true,
    modelEnv: "GEO_CLAUDE_MODEL",
    /*
      The cheapest current Claude that takes the web_search_20250305 server
      tool (Anthropic's web search docs, supported models, checked
      2026-11-28): Haiku 5.5, $0.10 / $0.50 per million tokens against
      Sonnet 5's $2 / $10. A search costs the same on both ($10 per 1,000).
      GEO_CLAUDE_MODEL=claude-sonnet-5 for the fuller model (docs/ai-visibility.md).
    */
    defaultModel: "claude-haiku-5-5",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    audience:
      "Mass-market consumer. The default first stop for a general question.",
    envKey: "OPENAI_API_KEY",
    checked: true,
    modelEnv: "GEO_OPENAI_MODEL",
    /*
      Already OpenAI's low-cost tier. gpt-5-nano is cheaper per token, but
      OpenAI's web search guide does not say it takes the tool, and most of
      an answer's cost is the $10 per 1,000 searches either way
      (docs/ai-visibility.md).
    */
    defaultModel: "gpt-5-mini",
  },
  {
    id: "gemini",
    name: "Gemini",
    audience:
      "Google-ecosystem use: Android, Workspace, mobile-first searchers.",
    envKey: "GOOGLE_AI_API_KEY",
    checked: true,
    modelEnv: "GEO_GEMINI_MODEL",
    /*
      Google's alias for its current Flash-Lite (3.5 Flash-Lite takes Google
      Search grounding): $0.30 / $2.50 per million tokens against Flash's
      $0.75 / $3.75. The answer records the exact version.
      GEO_GEMINI_MODEL=gemini-flash-latest for the fuller model.
    */
    defaultModel: "gemini-flash-lite-latest",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    audience:
      "Research-driven, fact-checking. Wants citations and sources it can open.",
    envKey: "PERPLEXITY_API_KEY",
    checked: false,
  },
  {
    id: "copilot",
    name: "Microsoft Copilot",
    audience: "Windows and Microsoft 365 users, often inside a work context.",
    envKey: "MICROSOFT_COPILOT_API_KEY",
    checked: false,
  },
  {
    id: "grok",
    name: "Grok",
    audience: "X-native, current-events tilted, tech-savvy.",
    envKey: "XAI_API_KEY",
    checked: false,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    audience: "Cost-conscious and technically literate; developer-leaning.",
    envKey: "DEEPSEEK_API_KEY",
    checked: false,
  },
  {
    id: "google-ai-overview",
    name: "Google AI Overview",
    audience:
      "Mass-market Google searchers who see the AI block above the results.",
    envKey: "DATAFORSEO_LOGIN",
    checked: false,
  },
];

type Env = Record<string, string | undefined>;

/** The assistants the check has a client for (lib/geo/assistants.ts), whether or not their key is set. */
export const ASKABLE_ENGINE_IDS = ["claude", "chatgpt", "gemini"] as const satisfies readonly EngineId[];

export type CheckedEngineId = (typeof ASKABLE_ENGINE_IDS)[number];

const engine = (id: string) => ENGINES.find((e) => e.id === id);

/** Asked when GEO_ENGINES is unset or blank: Claude alone. */
export const DEFAULT_GEO_ENGINES: readonly CheckedEngineId[] = ["claude"];

/**
 * Which engines this deployment actually asks: a client here, a key set,
 * AND named in GEO_ENGINES ("claude,chatgpt,gemini"). With GEO_ENGINES
 * unset or blank, Claude only.
 *
 * A key alone is never enough: OPENAI_API_KEY is already set for pictures,
 * so ChatGPT would otherwise start being asked - and paid for - the day
 * this is deployed (review of 2026-11-28). Turning an engine on is a
 * decision written into GEO_ENGINES.
 *
 * Server-only in practice: it reads environment variables. The UI receives
 * the result as plain data rather than calling this in the browser, where
 * every value would be undefined and every engine would look unavailable.
 */
export function availableEngineIds(env: Env = process.env): CheckedEngineId[] {
  const listed = (env.GEO_ENGINES ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  const wanted: readonly string[] = listed.length > 0 ? listed : DEFAULT_GEO_ENGINES;
  return ASKABLE_ENGINE_IDS.filter((id) => wanted.includes(id) && Boolean(env[engine(id)?.envKey ?? ""]?.trim()));
}

/**
 * The assistants the check really asks on this deployment: a client here, a
 * key set, and named in GEO_ENGINES (Claude alone when unset). Read once, when the server
 * starts - environment variables do not change under a running server. The
 * one list Copilot, the method section and the sign-in panel are worded from
 * (owner review, 2026-11-27).
 *
 * SERVER ONLY: in a browser bundle no key is visible and this is empty, so
 * a client component is given the names as props (components/auth-showcase).
 * Tests that change the environment call availableEngineIds(env) instead.
 */
export const CHECKED_ENGINE_IDS: readonly CheckedEngineId[] = availableEngineIds();

/** The model an engine is asked with: its environment variable, or the default. */
export function engineModel(id: CheckedEngineId, env: Env = process.env): string {
  const e = engine(id);
  return (e?.modelEnv && env[e.modelEnv]?.trim()) || e?.defaultModel || id;
}

/** The display name for a stored engine id ("chatgpt" -> "ChatGPT"); an unknown id as it is. */
export function engineName(id: string): string {
  return engine(id)?.name ?? id;
}

/** How many times each question is put to each assistant in one check (owner's option B, 2026-11-28). */
export const DEFAULT_RUNS_PER_QUESTION = 2;
const MAX_RUNS_PER_QUESTION = 5;

/**
 * GEO_RUNS_PER_QUESTION, 1-5, default 2. One answer is a sample of one: the
 * same question asked twice can name different businesses, so a single
 * answer cannot say whether a business is usually named or was lucky once.
 */
export function runsPerQuestion(env: Env = process.env): number {
  const value = Number.parseInt(env.GEO_RUNS_PER_QUESTION ?? "", 10);
  if (!Number.isFinite(value)) return DEFAULT_RUNS_PER_QUESTION;
  return Math.min(MAX_RUNS_PER_QUESTION, Math.max(1, value));
}

/** What a check asks with, for the method section and the stored answers. */
export type EngineInUse = { id: CheckedEngineId; name: string; model: string; webSearch: true };

/**
 * The assistants a check asks right now, with their models: the stable list
 * the method section, Copilot and the landing pages say. Web search is on
 * for every one (lib/geo/assistants.ts); an answer where the provider
 * refused it is recorded with web search off.
 */
export function enginesInUse(env: Env = process.env): EngineInUse[] {
  return availableEngineIds(env).map((id) => ({ id, name: engineName(id), model: engineModel(id, env), webSearch: true }));
}

/** The best-known assistants, named when saying which ones are NOT asked. */
const WELL_KNOWN: readonly EngineId[] = ["chatgpt", "gemini", "perplexity"];

/** "Claude", "Claude and ChatGPT", "Claude, ChatGPT and Gemini". */
export function engineNames(ids: readonly string[]): string {
  const names = ids.map(engineName);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The assistants the check asks now, in words: "Claude, ChatGPT and Gemini". */
export function checkedEngineNames(env: Env = process.env): string {
  return engineNames(availableEngineIds(env));
}

/** The well-known assistants the check does not ask now, in words ("Perplexity"); "" once all are asked. */
export function uncheckedEngineNames(env: Env = process.env): string {
  const asked: readonly string[] = availableEngineIds(env);
  return engineNames(WELL_KNOWN.filter((id) => !asked.includes(id)));
}

/**
 * What RepGet's AI visibility check really covers, for Copilot's prompts:
 * "RepGet's weekly check asks Claude, ChatGPT and Gemini, each with web
 * search; Perplexity is not checked, so never say it is". Never a fixed list.
 */
export function aiVisibilityWords(env: Env = process.env): string {
  const asked = checkedEngineNames(env);
  const unchecked = uncheckedEngineNames(env);
  const many = unchecked.includes(" and ");
  const head = asked ? `RepGet's weekly check asks ${asked}, each with web search` : "RepGet's AI visibility check is not running on this deployment";
  return `${head}${unchecked ? `; ${unchecked} ${many ? "are" : "is"} not checked, so never say ${many ? "they are" : "it is"}` : ""}`;
}
