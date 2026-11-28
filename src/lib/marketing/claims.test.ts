import { describe, expect, it } from "vitest";

import { assistantWords, notCheckedWords } from "@/lib/geo/engine-words";
import { LOCALES } from "@/lib/i18n/config";
import { pricingCopy } from "@/lib/i18n/home/pricing";
import { pricingPageCopy } from "@/lib/i18n/pricing-page";
import { planFeatures, type PickerPlan } from "@/lib/plans/features";
import { catalogRows } from "../../../scripts/plan-catalog.mjs";

/**
 * Claims the product does not back, kept off the plan surfaces in every
 * language (review of 2026-11-17, english-pilot):
 *  - AI visibility asks the assistants this deployment has a key for AND
 *    names in GEO_ENGINES (Claude alone by default; lib/geo/engines.ts).
 *    So no plan surface may hard-code a list of them: the FAQ names them
 *    through {assistants} and {notChecked}, filled in by the server
 *    (lib/geo/engine-words.ts, review of 2026-11-28). Perplexity, Copilot
 *    and Google's AI results are never queried.
 *  - No schema markup is written for customer articles.
 *  - Nothing gives a tier "priority processing".
 * The FAQ names the assistants in one answer, which says which are not checked.
 */

/** Assistants the check does not ask: never on a plan surface. */
const ASSISTANTS = /Perplexity|Microsoft Copilot|AI Overview/;
/** Any assistant's name written into the copy itself rather than filled in. */
const NAMED = /ChatGPT|Gemini|Claude|Perplexity/;
const SCHEMA = /schema/i;
const PRIORITY_PROCESSING = /priority processing|procesamiento prioritario|traitement prioritaire|elaborazione prioritaria|bevorzugte bearbeitung|written first/i;

describe("plan surfaces make no unsupported claim", () => {
  it.each(LOCALES)("/pricing in %s: features, plan cards and comparison", (locale) => {
    const copy = pricingPageCopy(locale);
    const lists = JSON.stringify([copy.bundle.coreFeatures, copy.plans, copy.compare, copy.hero]);
    expect(lists).not.toMatch(ASSISTANTS);
    expect(lists).not.toMatch(SCHEMA);
    expect(lists).not.toMatch(PRIORITY_PROCESSING);
    expect(copy.compare).not.toHaveProperty("priorityProcessing");
  });

  it.each(LOCALES)("/pricing FAQ in %s names the assistants from the deployment, says which are not checked, and promises no schema or priority", (locale) => {
    const items = pricingPageCopy(locale).faq.groups.flatMap((group) => group.items);
    const answers = JSON.stringify(items);
    expect(answers).not.toMatch(PRIORITY_PROCESSING);
    // No answer hard-codes an assistant: one fills them in.
    expect(answers).not.toMatch(NAMED);
    const assistants = items.filter((item) => item.a.includes("{assistants}"));
    expect(assistants).toHaveLength(1);
    expect(assistants[0].a).toContain("{notChecked}");
    expect(assistants[0].a).toMatch(/web|Web/);
    // The one schema mention says RepGet does NOT add it.
    const schema = items.filter((item) => SCHEMA.test(item.a));
    expect(schema).toHaveLength(1);
    expect(schema[0].a).toMatch(/RepGet (does not|no|n'ajoute pas|non aggiunge|fügt)/);
  });

  it.each(LOCALES)("/pricing plan lists in %s name no assistant, so they are true however many are asked", (locale) => {
    const copy = pricingPageCopy(locale);
    const lists = JSON.stringify([copy.bundle.coreFeatures, copy.plans, copy.compare]);
    expect(lists).not.toMatch(NAMED);
  });

  it.each(LOCALES)("the FAQ's names in %s follow the deployment", (locale) => {
    // Claude alone (GEO_ENGINES unset, though the OpenAI key is there for pictures).
    const claude = { ANTHROPIC_API_KEY: "k", OPENAI_API_KEY: "k" };
    expect(assistantWords(locale, claude)).toBe("Claude");
    expect(notCheckedWords(locale, claude)).toMatch(/^ChatGPT, Gemini, Perplexity /);
    const all = { ...claude, GOOGLE_AI_API_KEY: "k", GEO_ENGINES: "claude,chatgpt,gemini" };
    expect(assistantWords(locale, all)).toMatch(/^Claude, ChatGPT \S+ Gemini$/);
    expect(notCheckedWords(locale, all)).toMatch(/^Perplexity \S+ \S+/);
    expect(notCheckedWords(locale, all)).not.toMatch(/ChatGPT|Gemini|Claude/);
  });

  it.each(LOCALES)("home page plan cards in %s", (locale) => {
    const text = JSON.stringify(pricingCopy(locale));
    expect(text).not.toMatch(ASSISTANTS);
    expect(text).not.toMatch(/major assistants|principales asistentes|principaux assistants|principali assistenti|wichtigsten KI-Assistenten/);
    expect(text).not.toMatch(/Priorit|prioritar|prioritair/);
  });

  it("the plan step and Billing's feature lists, for every plan", () => {
    for (const row of catalogRows()) {
      const features = planFeatures({ ...row, id: row.tier, currency: "eur", monthlyCredits: row.monthlyCredits } as unknown as PickerPlan).join(" | ");
      expect(features).not.toMatch(ASSISTANTS);
      expect(features).not.toMatch(SCHEMA);
      expect(features).not.toMatch(PRIORITY_PROCESSING);
    }
  });
});
