import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Where /sign-in and /sign-up send someone who is ALREADY signed in.
 *
 * They follow ?next= so an invitation link survives a bounce through them.
 * The check on ?next= used to be a copy written out in each page, and the
 * copy did not reject control characters: "/<TAB>/evil.com" passed, and a
 * browser strips the tab and navigates to "//evil.com" - another site. Both
 * pages now use safeNext from lib/auth/next.ts, whose own rules are tested in
 * lib/auth/next.test.ts; this checks the pages actually apply it.
 */

const state = vi.hoisted(() => ({ signedIn: true }));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock("@/lib/auth-guard", () => ({
  getSession: async () =>
    state.signedIn ? { user: { id: "u1", email: "a@example.com" } } : null,
}));
vi.mock("@/lib/i18n/app-locale", async () => {
  const { getMessages } = await import("@/lib/i18n/messages");
  return { getPublicMessages: async () => ({ locale: "en", t: getMessages("en") }) };
});
vi.mock("@/components/auth-form", () => ({ AuthForm: () => null }));

import SignInPage from "./sign-in/page";
import SignUpPage from "./sign-up/page";

/**
 * Either page, called with only what it reads. Each page's PageProps names
 * its own route, so neither type fits the other; the tests need the shape
 * they share - search params in, a redirect or an element out.
 */
type Page = (props: {
  searchParams: Promise<Record<string, string>>;
}) => Promise<unknown>;

/** Renders the page for `query` and returns where it redirected, or null. */
async function landing(page: Page, query: Record<string, string>) {
  try {
    await page({ searchParams: Promise.resolve(query) });
    return null;
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith("redirect:")) return message.slice("redirect:".length);
    throw error;
  }
}

beforeEach(() => {
  state.signedIn = true;
});

describe.each([
  ["/sign-in", SignInPage as unknown as Page],
  ["/sign-up", SignUpPage as unknown as Page],
])("%s for a signed-in visitor", (_path, page) => {
  it("goes on to an invitation named in ?next=", async () => {
    expect(await landing(page, { next: "/invite/abc" })).toBe("/invite/abc");
  });

  it("goes to the dashboard without ?next=", async () => {
    expect(await landing(page, {})).toBe("/dashboard");
  });

  it.each([
    ["a protocol-relative URL", "//evil.example"],
    ["a backslash", "/\\evil.example"],
    ["an absolute URL", "https://evil.example"],
    ["a tab the browser would strip", "/\t/evil.example"],
    ["a newline the browser would strip", "/\n/evil.example"],
  ])("refuses %s and goes to the dashboard", async (_label, next) => {
    expect(await landing(page, { next })).toBe("/dashboard");
  });

  it("renders the form for somebody signed out", async () => {
    state.signedIn = false;
    expect(await landing(page, { next: "/invite/abc" })).toBeNull();
  });
});
