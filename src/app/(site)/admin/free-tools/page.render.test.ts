import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FREE_TOOL_SLUGS } from "@/lib/tools/free-tools";

/** Admin -> Free tools (owner, 2026-11-27): per tool, the figures, the cap and the switch. */

const state = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/admin/free-tools", () => ({ getFreeToolsAdmin: state.load, setToolEnabled: vi.fn(), setToolDailyCap: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/free-tools",
  useSearchParams: () => new URLSearchParams(),
}));

import FreeToolsPage from "./page";

const empty = (tool: string) => ({
  tool,
  uses: { on_device: 0, server: 0, template: 0 },
  totalUses: 0,
  visitors: 0,
  costUsd: 0,
  failedCalls: 0,
  signups: 0,
  costPerSignupUsd: null,
  todayUsd: 0,
  setting: { enabled: true, dailyCapCents: null, capFromSetting: false },
});

afterEach(() => vi.clearAllMocks());

describe("Admin -> Free tools", () => {
  it("shows uses by path, cost, sign-ups and cost per sign-up, with each tool's cap and switch", async () => {
    state.load.mockResolvedValue({
      days: 7,
      since: new Date("2026-11-20"),
      rows: FREE_TOOL_SLUGS.map((tool) =>
        tool === "blog-writer"
          ? {
              ...empty(tool),
              uses: { on_device: 3, server: 5, template: 2 },
              totalUses: 10,
              visitors: 7,
              costUsd: 0.0123,
              signups: 2,
              costPerSignupUsd: 0.00615,
              todayUsd: 0.004,
              setting: { enabled: true, dailyCapCents: 100, capFromSetting: false },
            }
          : tool === "robots-checker"
            ? { ...empty(tool), setting: { enabled: false, dailyCapCents: null, capFromSetting: false } }
            : empty(tool),
      ),
    });
    const markup = renderToStaticMarkup(await FreeToolsPage({ searchParams: Promise.resolve({ days: "7" }) } as never));
    expect(state.load).toHaveBeenCalledWith(7);
    expect(markup).toContain("Free AI Blog Writer");
    expect(markup).toContain("3 / 5 / 2");
    expect(markup).toContain("$0.0123");
    expect(markup).toContain("$0.01");
    expect(markup).toContain("of $1.00");
    expect(markup).toContain("(default)");
    expect(markup).toContain("Robots.txt Checker");
    expect(markup).toContain("No AI call");
    expect(markup).toContain('aria-label="Robots.txt Checker: off"');
    expect(markup).toContain('aria-label="Free AI Blog Writer: on"');
    expect(markup).toContain("Runs only in the browser: not tracked.");
  });

  it("falls back to 30 days for an unknown period", async () => {
    state.load.mockResolvedValue({ days: 30, since: new Date(), rows: FREE_TOOL_SLUGS.map(empty) });
    await FreeToolsPage({ searchParams: Promise.resolve({ days: "365" }) } as never);
    expect(state.load).toHaveBeenCalledWith(30);
  });
});
