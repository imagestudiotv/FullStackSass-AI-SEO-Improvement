import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

import { TrialComparison } from "./trial-comparison";

/**
 * Free trial vs paid plan (client, 2026-10-27): what the trial gives, what it
 * does not, and the numbers from the settings rather than from the copy.
 */
function render(locale: (typeof LOCALES)[number], trialDailyCredits = 15) {
  return renderToStaticMarkup(
    createElement(TrialComparison, {
      t: getMessages(locale).pricing.trial,
      freeArticles: 3,
      freeDays: 30,
      trialDailyCredits,
      trialCreditDays: 3,
    }),
  );
}

describe("TrialComparison", () => {
  it("shows the trial's articles, check and credits, and crosses out AI visibility and backlinks", () => {
    const html = render("en");
    expect(html).toContain("3 free articles, researched, illustrated and published");
    expect(html).toContain("15 credits a day for your first 3 days");
    expect(html).toContain("after 30 days at the latest");
    // Both are in the paid column, and crossed out (with a spoken label) in the trial's.
    expect(html.match(/AI visibility in ChatGPT/g)).toHaveLength(2);
    expect(html.match(/Backlinks from our partner network/g)).toHaveLength(2);
    expect(html.match(/Not included: /g)).toHaveLength(2);
  });

  it("leaves the credits line out while the trial's daily credits are off", () => {
    expect(render("en", 0)).not.toContain("credits a day");
  });

  it("is written in every language, with no placeholder left unfilled", () => {
    for (const locale of LOCALES) {
      const html = render(locale);
      expect(html).not.toMatch(/\{\w+\}/);
      expect(html).toContain("15");
    }
  });
});
