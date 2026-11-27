import { describe, expect, it } from "vitest";

import { ASKABLE_ENGINE_IDS, engineName } from "@/lib/geo/engines";
import { LOCALES } from "@/lib/i18n/config";
import { pricingCopy } from "@/lib/i18n/home/pricing";
import { pricingPageCopy } from "@/lib/i18n/pricing-page";
import { planFeatures, type PickerPlan } from "@/lib/plans/features";
import { catalogRows } from "../../../scripts/plan-catalog.mjs";

/**
 * Claims the product does not back, kept off the plan surfaces in every
 * language (review of 2026-11-17, english-pilot):
 *  - AI visibility asks ChatGPT, Gemini and Claude, through their APIs with
 *    web search (lib/geo/engines.ts ASKABLE_ENGINE_IDS, since 2026-11-27);
 *    Perplexity, Copilot and Google's AI results are never queried, so no
 *    list may read as tracking them.
 *  - No schema markup is written for customer articles.
 *  - Nothing gives a tier "priority processing".
 * The FAQ names the assistants in one answer, which says which are not checked.
 */

/** Assistants the check does not ask: never on a plan surface. */
const ASSISTANTS = /Perplexity|Microsoft Copilot|AI Overview/;
/** The ones it asks, as the copy names them. */
const ASKED = ASKABLE_ENGINE_IDS.map(engineName);
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

  it.each(LOCALES)("/pricing FAQ in %s names the assistants checked, says Perplexity is not, and promises no schema or priority", (locale) => {
    const items = pricingPageCopy(locale).faq.groups.flatMap((group) => group.items);
    const answers = JSON.stringify(items);
    expect(answers).not.toMatch(PRIORITY_PROCESSING);
    const assistants = items.filter((item) => /ChatGPT|Gemini|Claude|Perplexity/.test(item.a));
    expect(assistants).toHaveLength(1);
    for (const name of ASKED) expect(assistants[0].a).toContain(name);
    expect(assistants[0].a).toMatch(/Perplexity/);
    expect(assistants[0].a).toMatch(/web|Web/);
    // The one schema mention says RepGet does NOT add it.
    const schema = items.filter((item) => SCHEMA.test(item.a));
    expect(schema).toHaveLength(1);
    expect(schema[0].a).toMatch(/RepGet (does not|no|n'ajoute pas|non aggiunge|fügt)/);
  });

  it.each(LOCALES)("/pricing plan lists in %s name exactly the assistants checked", (locale) => {
    const copy = pricingPageCopy(locale);
    const lists = JSON.stringify([copy.bundle.coreFeatures, copy.plans, copy.compare]);
    for (const name of ASKED) expect(lists).toContain(name);
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
