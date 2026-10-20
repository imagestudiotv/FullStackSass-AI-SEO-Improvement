import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/** The autopilot's settings as an administrator sees them, with how many articles a day (client, 2026-10-20). */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/admin/blog-autopilot", () => ({ saveBlogAutopilotSettings: vi.fn() }));

import type { AutopilotSettings } from "@/lib/blog/autopilot/settings";

import { AutopilotSettingsForm } from "./autopilot-settings";

const settings = (overrides: Partial<AutopilotSettings> = {}): AutopilotSettings => ({
  enabled: true,
  runHour: 5,
  articlesPerDay: 1,
  languages: ["es", "it"],
  updatedBy: null,
  updatedAt: null,
  ...overrides,
});
const render = (value: AutopilotSettings) =>
  renderToStaticMarkup(
    createElement(AutopilotSettingsForm, {
      settings: value,
      hours: [{ value: 5, label: "05:00 UTC (07:00 in Rome)" }],
      maxPerDay: 5,
      languages: [{ code: "es", name: "Spanish" }],
    }),
  );

describe("the autopilot's settings", () => {
  it("offer one to five articles a day, with what that means", () => {
    const html = render(settings({ articlesPerDay: 3 }));
    expect(html).toContain(">Articles a day</label>");
    expect((html.match(/<option value="\d"(?: selected="")?>\d articles?<\/option>/g) ?? []).length).toBe(5);
    expect(html).toMatch(/<option value="3" selected="">3 articles<\/option>/);
    expect(html).toContain("On: 3 articles are written every day, one an hour from 05:00 UTC (07:00 in Rome).");
    expect(html).toContain("costs about $0.90");
  });

  it("say one article a day as before", () => {
    expect(render(settings())).toContain("On: an article is written every day at 05:00 UTC (07:00 in Rome).");
    expect(render(settings({ enabled: false }))).toContain("Off: nothing is written until you turn it on.");
  });
});
