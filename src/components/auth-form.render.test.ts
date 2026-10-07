import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(state.search),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/auth-client", () => ({ authClient: {} }));

import { getMessages } from "@/lib/i18n/messages";
import { AuthForm } from "./auth-form";

/**
 * The link between sign-in and sign-up, as first rendered.
 *
 * It was a bare "/sign-up" (or "/sign-in"), so an invitee who arrived with
 * ?next=/invite/<token> and needed the other screen lost the invitation on
 * the way. It now carries ?next= and the address. The rules for which values
 * are kept are authSwitchHref's (lib/auth/next.test.ts); this checks the form
 * actually uses it, in both directions.
 */

beforeEach(() => {
  state.search = "";
});

/** The href of the switch link, the last link on the form. */
function switchHref(html: string): string {
  const hrefs = [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]);
  // Terms and Privacy come first; the switch link is the last anchor.
  return hrefs[hrefs.length - 1].replaceAll("&amp;", "&");
}

const render = (mode: "sign-in" | "sign-up", initialEmail = "") =>
  renderToStaticMarkup(
    createElement(AuthForm, { mode, initialEmail, t: getMessages("en").app.auth }),
  );

describe("the sign-in / sign-up switch link", () => {
  it("keeps an invitation's ?next= and address going from sign-up to sign-in", () => {
    state.search = "email=editor%40client.example&next=%2Finvite%2Fabc";
    const href = switchHref(render("sign-up", "editor@client.example"));

    expect(href).toBe("/sign-in?next=%2Finvite%2Fabc&email=editor%40client.example");
  });

  it("keeps them going from sign-in to sign-up", () => {
    state.search = "next=%2Finvite%2Fabc";
    const href = switchHref(render("sign-in", "editor@client.example"));

    expect(href).toBe("/sign-up?next=%2Finvite%2Fabc&email=editor%40client.example");
  });

  it("is the bare path when there is nothing to carry", () => {
    expect(switchHref(render("sign-in"))).toBe("/sign-up");
    expect(switchHref(render("sign-up"))).toBe("/sign-in");
  });

  it("never repeats a crafted redirect", () => {
    state.search = "next=%2F%2Fevil.example";
    expect(switchHref(render("sign-in"))).toBe("/sign-up");
  });
});
