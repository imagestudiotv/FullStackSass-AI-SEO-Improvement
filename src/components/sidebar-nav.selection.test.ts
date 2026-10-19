import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  path: "/websites/first/content",
  remembered: { current: undefined as string | null | undefined },
  select: vi.fn(),
}));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useEffect: (effect: () => void) => effect(),
  useRef: () => state.remembered,
  useState: (initial: unknown) => [initial, vi.fn()],
}));
vi.mock("next/navigation", () => ({ usePathname: () => state.path }));
vi.mock("@/lib/websites/actions", () => ({ selectWebsite: state.select }));
import { SidebarNav } from "./sidebar-nav";
import { getMessages } from "@/lib/i18n/messages";

const render = (selectedWebsiteId: string) => SidebarNav({ selectedWebsiteId, t: getMessages("en").app.nav });
beforeEach(() => {
  state.path = "/websites/first/content";
  state.remembered.current = undefined;
  state.select.mockReset().mockResolvedValue({ ok: true, data: null });
});
describe("remembering the website from navigation", () => {
  it("does not restore the old site while an explicit switch updates the cookie", () => {
    render("first");
    render("second"); // The action's cookie update arrives before its navigation.
    expect(state.select).not.toHaveBeenCalled();
    state.path = "/websites/second/content";
    render("second");
    expect(state.select).not.toHaveBeenCalled();
  });
  it("remembers direct links once, and remembers a later return to a site", () => {
    render("second");
    render("second");
    expect(state.select).toHaveBeenCalledExactlyOnceWith("first");
    state.path = "/dashboard";
    render("second");
    state.path = "/websites/first/google";
    render("second");
    expect(state.select).toHaveBeenCalledTimes(2);
  });
  it("handles a failed background selection without crashing the route", async () => {
    state.select.mockRejectedValueOnce(new Error("Connection interrupted"));
    render("second");
    await Promise.resolve();
    expect(state.select).toHaveBeenCalledOnce();
  });
});
