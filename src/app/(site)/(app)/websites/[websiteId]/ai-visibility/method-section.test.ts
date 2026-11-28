import { describe, expect, it } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

import { engineList, methodItems } from "./method-section";
import { outcomeText } from "./question-list";

const METHOD = {
  engines: [
    { name: "Claude", model: "claude-sonnet-5", webSearch: "on" as const },
    { name: "ChatGPT", model: "gpt-5-mini", webSearch: "on" as const },
  ],
  runs: 3,
  language: "Ukrainian",
  region: "Ukraine",
  weeklyChecks: 3,
};

/**
 * The method is on the page (review of 2026-11-27: "method undisclosed"):
 * which assistants and models, web search, runs per question, question
 * language and market, and how often it runs - in every language, from the
 * settings the job reads.
 */
describe("what the AI visibility page says it measures", () => {
  it.each(LOCALES)("states assistants, models, web search, runs, language, market and schedule in %s", (locale) => {
    const t = getMessages(locale).app.geo;
    const items = methodItems(METHOD, ["Claude"], t);
    const text = items.map((item) => `${item.title} ${item.body}`).join("\n");
    for (const value of ["Claude", "claude-sonnet-5", "ChatGPT", "gpt-5-mini", "Ukrainian", "Ukraine", t.methodSearchOn, t.checkNow]) {
      expect(text).toContain(value);
    }
    expect(items.find((item) => item.title === t.methodAskTitle)?.body).toMatch(/3/);
    expect(items.find((item) => item.title === t.methodScheduleTitle)?.body).toMatch(/3/);
    // Every placeholder filled.
    expect(text).not.toMatch(/\{\w+\}/);
    // No assistant named by the copy itself: only the configured ones appear.
    expect(text).not.toMatch(/Gemini|Perplexity/);
  });

  it.each(LOCALES)("says when web search was not available in the latest check, in %s", (locale) => {
    const t = getMessages(locale).app.geo;
    const engines = [
      { name: "Claude", model: "claude-haiku-5-5", webSearch: "off" as const },
      { name: "ChatGPT", model: "gpt-5-mini", webSearch: "partly" as const },
      // An older check that did not record its model.
      { name: "Gemini", model: "", webSearch: "on" as const },
    ];
    const text = engineList({ ...METHOD, engines }, t);
    expect(text).toContain(`Claude (claude-haiku-5-5, ${t.methodSearchOff})`);
    expect(text).toContain(`ChatGPT (gpt-5-mini, ${t.methodSearchPartly})`);
    expect(text).toContain(`Gemini (${t.methodSearchOn})`);
    expect(text).not.toMatch(/\{\w+\}/);
    // "Web search on" is said only of the assistant that had it.
    expect(text.split(t.methodSearchOn)).toHaveLength(2);
  });

  it.each(LOCALES)("says plainly when no assistant is configured, in %s", (locale) => {
    const t = getMessages(locale).app.geo;
    const items = methodItems({ ...METHOD, engines: [], region: null }, [], t);
    expect(items[0].body).toBe(t.methodNoEngines);
    expect(items.map((item) => item.body).join(" ")).toContain(t.methodNoRegion);
  });

  it.each(LOCALES)("shows the share of answers naming the business in %s", (locale) => {
    const t = getMessages(locale).app.geo;
    const base = { checkedAt: new Date(), position: 2 };
    expect(outcomeText({ ...base, mentioned: true, samples: 9, mentionCount: 2 }, t)).toMatch(/2.*9|9.*2/);
    expect(outcomeText({ ...base, mentioned: false, position: null, samples: 3, mentionCount: 0 }, t)).toContain("3");
    // A one-answer result from before keeps its old wording.
    expect(outcomeText({ ...base, mentioned: true }, t)).toBe(t.namedAt.replace("{position}", "2"));
  });
});
