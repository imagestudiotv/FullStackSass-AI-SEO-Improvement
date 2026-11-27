import { describe, expect, it } from "vitest";

import { countryCode, domainCountry, marketOf, questionLanguage, questionsToRewrite } from "@/lib/geo/market";

/** Questions are written and asked in the website's article language, for its market. */
describe("the language and market of a website's questions", () => {
  it("is the article language, a language RepGet does not list included", () => {
    expect(questionLanguage("es")).toBe("Spanish");
    expect(questionLanguage("Italiano")).toBe("Italian");
    expect(questionLanguage("ukrainian")).toBe("Ukrainian");
    expect(questionLanguage(null)).toBe("English");
    expect(questionLanguage("write everything in pirate speak please, thanks")).toBe("English");
  });

  it("places the market as a country code for the assistants' location settings", () => {
    expect(countryCode("Ukraine")).toBe("UA");
    expect(countryCode("italy")).toBe("IT");
    expect(countryCode("UK")).toBe("GB");
    expect(countryCode("de")).toBe("DE");
    expect(countryCode("Atlantis")).toBeNull();
    expect(marketOf({ language: "Ukrainian", country: "Ukraine" })).toEqual({ language: "Ukrainian", region: "Ukraine", countryCode: "UA" });
    expect(marketOf({ language: null, country: null })).toEqual({ language: "English", region: null, countryCode: null });
  });

  it("reads a website's country from its address, not from generic endings", () => {
    expect(domainCountry("shop.com.br")).toBe("BR");
    expect(domainCountry("example.co.uk")).toBe("GB");
    expect(domainCountry("example.com")).toBeNull();
    expect(domainCountry("startup.io")).toBeNull();
  });

  it("counts the suggested questions to write again, never the customer's own", () => {
    const prompts = [
      { isSuggested: true, language: null },
      { isSuggested: true, language: "English" },
      { isSuggested: true, language: "Ukrainian" },
      { isSuggested: false, language: null },
    ];
    expect(questionsToRewrite(prompts, "Ukrainian")).toBe(2);
    expect(questionsToRewrite(prompts, null)).toBe(2);
    expect(questionsToRewrite([{ isSuggested: false, language: null }], "Ukrainian")).toBe(0);
  });
});
