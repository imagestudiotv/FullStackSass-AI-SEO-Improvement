import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { LaunchStep } from "@/lib/onboarding/launch";
import { setupProgress } from "@/lib/onboarding/progress";

import { SetupSteps } from "./setup-steps";

/**
 * The Setup list and its "n steps left" agree (eval 2026-11-28: "5 steps left"
 * beside 6 "To do" chips): the closing "Launched live" row is the end state,
 * never a "To do", and the optional Search Console reads "Optional".
 */

const step = (id: string, done: boolean, optional = false): LaunchStep => ({
  id: id as LaunchStep["id"],
  title: id,
  description: `${id} description`,
  done,
  optional,
  href: `/${id}`,
  icon: "site",
});

const rows = (allDone: boolean): LaunchStep[] => {
  const steps = [
    step("profile", true),
    step("site", allDone),
    step("search-console", false, true),
    step("audit", allDone),
    step("articles", allDone),
    step("preferences", allDone),
    step("backlinks", allDone),
  ];
  return [...steps, { ...step("launched", setupProgress(steps).remaining === 0), detail: "Everything is running." }];
};

const count = (html: string, status: string) => html.split(`data-status="${status}"`).length - 1;

describe("SetupSteps", () => {
  it("shows exactly as many 'To do' chips as steps left, the Launched row not among them", () => {
    const steps = rows(false);
    const html = renderToStaticMarkup(createElement(SetupSteps, { steps }));
    expect(setupProgress(steps).remaining).toBe(5);
    expect(count(html, "todo")).toBe(5);
    expect(html.split(">To do<").length - 1).toBe(5);
    expect(count(html, "optional")).toBe(1);
    // The Launched row is still listed, as the goal.
    expect(html).toContain(">launched<");
  });

  it("marks Launched done once everything required is", () => {
    const steps = rows(true);
    const html = renderToStaticMarkup(createElement(SetupSteps, { steps }));
    expect(count(html, "todo")).toBe(0);
    expect(count(html, "done")).toBe(7);
  });
});
