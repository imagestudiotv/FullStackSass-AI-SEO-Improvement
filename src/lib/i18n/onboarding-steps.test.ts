import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WizardProgress } from "@/components/wizard-progress";
import { LOCALES } from "@/lib/i18n/config";
import { plural } from "@/lib/i18n/format";
import { checklistStepText, ONBOARDING_STEPS_COPY } from "@/lib/i18n/onboarding-steps";
import { WIZARD_STEPS, wizardSteps } from "@/lib/onboarding/wizard";

/** Every leaf of a copy object, as [dotted.path, value]. */
function leaves(value: unknown, prefix = ""): [string, unknown][] {
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      leaves(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [[prefix, value]];
}

const en = ONBOARDING_STEPS_COPY.en;
const enPaths = leaves(en).map(([path]) => path).sort();

describe("onboarding step copy", () => {
  it.each(LOCALES)("%s has every key, each a non-empty string", (locale) => {
    const entries = leaves(ONBOARDING_STEPS_COPY[locale]);
    expect(entries.map(([path]) => path).sort()).toEqual(enPaths);
    for (const [path, value] of entries) {
      expect(typeof value, path).toBe("string");
      expect((value as string).trim(), path).not.toBe("");
      // A one|many pair has both halves.
      if ((value as string).includes("|")) {
        expect((value as string).split("|").every((half) => half.trim() !== ""), path).toBe(true);
      }
    }
  });

  it.each(LOCALES)("%s keeps the {placeholders} English has", (locale) => {
    const placeholders = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();
    const own = new Map(leaves(ONBOARDING_STEPS_COPY[locale]));
    for (const [path, value] of leaves(en)) {
      expect(placeholders(own.get(path) as string), `${locale}.${path}`).toEqual(placeholders(value as string));
    }
  });

  it("says in English exactly what the screens said before", () => {
    expect(en.checklist.allSet).toBe("You are all set");
    expect(en.checklist.getStartedBody).toBe("A few steps, and we do most of the work.");
    expect(checklistStepText("en", "plan", { agency: false, trialDays: 3 })).toEqual({
      title: "Choose a plan",
      description: "Each website has its own plan. New accounts get a 3-day free trial.",
    });
    expect(checklistStepText("en", "plan", { agency: true, trialDays: 3 }).description).toBe(
      "This workspace is set up by us - no plan needed.",
    );
    expect(checklistStepText("en", "visibility", { agency: false, trialDays: 3 }).description).toBe(
      "The questions your customers would ask an assistant. We check whether you get named.",
    );
    expect(en.website.wordpressNote).toBe("Our plugin connects your blog in about three clicks.");
    expect(en.google.skip).toBe("Skip for now");
    expect(en.content.intro).toBe("We'll turn what we learned about {brand} into a plan you can publish from.");
    expect(plural(en.content.calendarBodyCount, 1)).toBe(
      "A calendar of 1 briefs a month, each with a title, term and intent.",
    );
    expect(plural(en.content.calendarBodyCount, 8)).toBe(
      "A calendar of 8 briefs a month, each with a title, term and intent.",
    );
    expect(en.content.nextUp).toEqual(["Connect your site", "Activate the backlink exchange", "Linking configuration"]);
    expect(plural(en.visibility.atLimit, 20)).toBe(
      "You have filled your plan's 20 questions. Remove one to add another.",
    );
    expect(plural(en.visibility.moreEngines, 2)).toBe("+ 2 more checked on every run");
    expect(en.checkoutPending.receivedSettingUp).toBe("Payment received - setting up");
  });

  it("keeps the English wizard labels and their order", () => {
    expect(WIZARD_STEPS.map((step) => step.label)).toEqual([
      "Website",
      "Plan",
      "Connect Google",
      "AI visibility",
      "Content & backlinks",
      "Ready to grow",
    ]);
    expect(wizardSteps("en")).toEqual(WIZARD_STEPS);
    for (const locale of LOCALES) {
      expect(wizardSteps(locale).map((step) => step.href)).toEqual(WIZARD_STEPS.map((step) => step.href));
    }
  });
});

describe("WizardProgress", () => {
  const render = (locale?: (typeof LOCALES)[number]) =>
    renderToStaticMarkup(createElement(WizardProgress, { current: "visibility", locale }));

  it("defaults to English", () => {
    const html = render();
    expect(html).toContain("Connect Google");
    expect(html).toContain("Ready to grow");
    expect(html).toContain('aria-label="Back to Plan"');
  });

  it("labels the steps in each language, all different", () => {
    const labelSets = new Set<string>();
    for (const locale of LOCALES) {
      const html = render(locale);
      for (const label of Object.values(wizardSteps(locale)).map((step) => step.label)) {
        expect(html, `${locale}: ${label}`).toContain(label.replace("&", "&amp;"));
      }
      labelSets.add(wizardSteps(locale).map((step) => step.label).join("|"));
    }
    expect(labelSets.size).toBe(LOCALES.length);

    expect(render("it")).toContain("Collega Google");
    expect(render("it")).toContain('aria-label="Torna a Piano"');
    expect(render("de")).toContain("KI-Sichtbarkeit");
    expect(render("de")).toContain('aria-label="Zurück zu Tarif"');
    expect(render("es")).toContain("Visibilidad en IA");
    expect(render("fr")).toContain('aria-label="Retour à Forfait"');
    expect(render("fr")).not.toContain("Ready to grow");
  });
});
