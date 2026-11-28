/**
 * The assistants we can check a business against.
 *
 * The reference lists eight — ChatGPT, Claude, Gemini, Perplexity, Grok,
 * DeepSeek, Microsoft Copilot, Google AI Overview and AI Mode — and lets the
 * customer split a prompt budget across them.
 *
 * We can only ask the ones we hold an API key for. An engine listed but never
 * queried would report "you are not mentioned" for a check that never ran,
 * which is worse than not offering it: the customer would go and rewrite pages
 * to fix a number that was never measured.
 *
 * So every engine is listed, because knowing the gap is useful, but each says
 * plainly whether it is running. Adding a key is the only thing needed to turn
 * one on — no code change.
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
};

export const ENGINES: Engine[] = [
  {
    id: "claude",
    name: "Claude",
    audience:
      "Thoughtful, research-oriented. Patient with longer answers and comparisons.",
    envKey: "ANTHROPIC_API_KEY",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    audience:
      "Mass-market consumer. The default first stop for a general question.",
    envKey: "OPENAI_API_KEY",
  },
  {
    id: "gemini",
    name: "Gemini",
    audience:
      "Google-ecosystem use: Android, Workspace, mobile-first searchers.",
    envKey: "GOOGLE_AI_API_KEY",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    audience:
      "Research-driven, fact-checking. Wants citations and sources it can open.",
    envKey: "PERPLEXITY_API_KEY",
  },
  {
    id: "copilot",
    name: "Microsoft Copilot",
    audience: "Windows and Microsoft 365 users, often inside a work context.",
    envKey: "MICROSOFT_COPILOT_API_KEY",
  },
  {
    id: "grok",
    name: "Grok",
    audience: "X-native, current-events tilted, tech-savvy.",
    envKey: "XAI_API_KEY",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    audience: "Cost-conscious and technically literate; developer-leaning.",
    envKey: "DEEPSEEK_API_KEY",
  },
  {
    id: "google-ai-overview",
    name: "Google AI Overview",
    audience:
      "Mass-market Google searchers who see the AI block above the results.",
    envKey: "DATAFORSEO_LOGIN",
  },
];

/**
 * Which engines this deployment can actually query.
 *
 * Server-only: it reads environment variables. The UI receives the result as
 * plain data rather than calling this in the browser, where every value would
 * be undefined and every engine would look unavailable.
 */
export function availableEngineIds(): EngineId[] {
  return ENGINES.filter((engine) => Boolean(process.env[engine.envKey])).map(
    (engine) => engine.id,
  );
}

/**
 * The assistants the weekly AI visibility check really asks (lib/geo/check.ts
 * takes its ENGINE from here). Copilot's words about AI visibility are built
 * from this list (owner review, 2026-11-27: Copilot said "ChatGPT, Gemini and
 * Perplexity" while only Claude is asked), so they change with it. Add an
 * engine here only once check.ts asks it.
 */
export const CHECKED_ENGINE_IDS = ["claude"] as const satisfies readonly EngineId[];

/** The best-known assistants, named when saying which ones are NOT asked. */
const WELL_KNOWN: readonly EngineId[] = ["chatgpt", "gemini", "perplexity"];

/** "Claude", "Claude and ChatGPT", "Claude, ChatGPT and Gemini". */
export function engineNames(ids: readonly EngineId[]): string {
  const names = ids.map((id) => ENGINES.find((engine) => engine.id === id)?.name ?? id);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The assistants the check asks, in words: "Claude". */
export function checkedEngineNames(): string {
  return engineNames(CHECKED_ENGINE_IDS);
}

/** The well-known assistants the check does not ask, in words ("ChatGPT, Gemini and Perplexity"); "" once all are asked. */
export function uncheckedEngineNames(): string {
  return engineNames(WELL_KNOWN.filter((id) => !(CHECKED_ENGINE_IDS as readonly EngineId[]).includes(id)));
}

/**
 * What RepGet's AI visibility check really covers, for Copilot's prompts,
 * from CHECKED_ENGINE_IDS: "RepGet's weekly check asks Claude;
 * ChatGPT, Gemini and Perplexity are not checked". Never a fixed list of
 * assistants (owner review, 2026-11-27).
 */
export function aiVisibilityWords(): string {
  const unchecked = uncheckedEngineNames();
  return `RepGet's weekly check asks ${checkedEngineNames()}${unchecked ? `; ${unchecked} are not checked, so never say they are` : ""}`;
}
