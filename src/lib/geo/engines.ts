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
