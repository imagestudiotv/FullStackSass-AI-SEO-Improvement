import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LOCALES, localePath } from "@/lib/i18n/config";
import { finalCtaCopy } from "@/lib/i18n/home/final-cta";
import { signUpWithEmail, signUpWithWebsite } from "../start-field";

/**
 * The closing banner (client's design cta.html, 2026-11-11): two tabs, one
 * field. The tab decides where the field goes and what the button says; the
 * switch under the field decides whether it takes a website or an email.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { FinalCta } from "./final-cta";
import { START_WAYS, startDestination, startWording, type FinalCtaPaths } from "./final-cta-form";

type Locale = (typeof LOCALES)[number];

const render = (locale: Locale) => renderToStaticMarkup(createElement(FinalCta, { locale, href: (path: string) => localePath(locale, path) }));
const text = (html: string) => html.replace(/<[^>]+>/g, "").trim();
const button = (html: string) => text(/<button[^>]*type="submit"[^>]*>(.*?)<\/button>/.exec(html)?.[1] ?? "");
const tabs = (html: string) => [...html.matchAll(/<button[^>]*role="tab"[^>]*>(.*?)<\/button>/g)].map((m) => m[0]);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");
const paths = (locale: Locale): FinalCtaPaths => ({
  auditPath: localePath(locale, "/audit"),
  signUpPath: localePath(locale, "/sign-up"),
  onboardingPath: localePath(locale, "/onboarding/website"),
});

describe("the closing banner", () => {
  it.each(LOCALES)("%s: renders the design in the page's language, the website check first", (locale) => {
    const t = finalCtaCopy(locale);
    const html = render(locale);

    expect(html).toContain('id="repget-final-cta"');
    expect(html).not.toMatch(/<h1[\s>]/);
    expect(html).toContain(`<h2 id="rcta-heading">${esc(t.titleLead)} <em>${esc(t.titleAccent)}</em></h2>`);
    expect(html).toContain(esc(t.form.startLabel));
    expect(html).toContain(`role="tablist" aria-label="${esc(t.form.tabsLabel)}"`);

    // Two tabs, "Check my website" selected and the only one in the Tab order.
    const [audit, trial] = tabs(html);
    expect(tabs(html)).toHaveLength(2);
    expect(text(audit)).toContain(t.form.audit.tab);
    expect(audit).toMatch(/aria-selected="true"/);
    expect(audit).toMatch(/tabindex="0"/);
    expect(text(trial)).toContain(t.form.trial.tab);
    expect(trial).toMatch(/aria-selected="false"/);
    expect(trial).toMatch(/tabindex="-1"/);
    expect(html).toContain('role="tabpanel"');

    // One field, a website by default.
    expect(html.match(/<form/g)).toHaveLength(1);
    expect(html.match(/<input/g)).toHaveLength(1);
    expect(html).toContain('name="website"');
    expect(html).toContain(`placeholder="${esc(t.form.websitePlaceholder)}"`);
    expect(button(html)).toBe(`${t.form.audit.submit} ↗`);
    expect(html).toContain(esc(t.form.audit.hint));
    expect(html).toContain(esc(t.form.useEmail));

    for (const point of t.points) expect(html).toContain(esc(point));
    for (const pill of t.pills) expect(html).toContain(`>${esc(pill)}</li>`);
    expect(html).toContain(`<h3>${esc(t.panelTitle)}</h3>`);
    for (const item of t.items) expect(html).toContain(esc(item.title));
    expect(html).toContain(esc(t.sideNote));
  });

  it("no longer shows the old banner's second pair of buttons", () => {
    const html = render("en");
    expect(html).not.toContain("Check my website for free");
    expect(html).not.toMatch(/Create \d+ (?:free articles|Articles for Free)/);
    expect(html).not.toContain("<a ");
  });

  it("leaves the support line as it is: its wording is waiting for a review", () => {
    expect(finalCtaCopy("en").points).toContain("24/7 human support");
  });
});

describe("the button and the line under the field", () => {
  const t = finalCtaCopy("en").form;

  it("follow the tab and the field", () => {
    expect(startWording(t, "audit", "website")).toEqual({
      submit: "Check my website free",
      hint: "Enter your website to get your free check.",
      swap: "Use your email instead",
    });
    expect(startWording(t, "audit", "email")).toEqual({
      submit: "Continue with email",
      hint: "We'll ask for your website in the next step.",
      swap: "Use website instead",
    });
    expect(startWording(t, "trial", "website")).toEqual({
      submit: "Start free trial",
      hint: "Enter your website to start your free trial.",
      swap: "Use your email instead",
    });
    expect(startWording(t, "trial", "email")).toEqual({
      submit: "Start free trial",
      hint: "Enter your email to start your free trial.",
      swap: "Use website instead",
    });
  });

  it.each(LOCALES.filter((locale) => locale !== "en"))("%s: are translated, every one of them", (locale) => {
    const own = finalCtaCopy(locale).form;
    for (const way of START_WAYS) {
      for (const key of ["tab", "submit", "submitEmail", "hint", "hintEmail"] as const) {
        expect(own[way][key], `${way}.${key}`).toBeTruthy();
        expect(own[way][key], `${way}.${key}`).not.toBe(t[way][key]);
      }
    }
    expect(own.startLabel).not.toBe(t.startLabel);
    expect(own.tabsLabel).not.toBe(t.tabsLabel);
    expect(finalCtaCopy(locale).points[0]).not.toBe(finalCtaCopy("en").points[0]);
  });
});

describe("where the field goes", () => {
  it.each(LOCALES)("%s: a website on the check runs the free check, on the trial goes through sign-up", (locale) => {
    const t = finalCtaCopy(locale).form;
    const p = paths(locale);
    expect(startDestination(t, "audit", "website", " acme.com ", p)).toEqual({ url: `${localePath(locale, "/audit")}?domain=acme.com` });
    expect(startDestination(t, "trial", "website", "acme.com", p)).toEqual({ url: signUpWithWebsite(p.signUpPath, p.onboardingPath, "acme.com") });
    expect(signUpWithWebsite(p.signUpPath, p.onboardingPath, "acme.com")).toContain("?next=");
  });

  it.each(LOCALES)("%s: an email goes to sign-up with the address, on either tab", (locale) => {
    const t = finalCtaCopy(locale).form;
    const p = paths(locale);
    for (const way of START_WAYS) {
      expect(startDestination(t, way, "email", "me@acme.com", p)).toEqual({ url: signUpWithEmail(p.signUpPath, "me@acme.com") });
    }
  });

  it.each(LOCALES)("%s: an empty or wrong field shows the page's own message instead", (locale) => {
    const t = finalCtaCopy(locale).form;
    const p = paths(locale);
    for (const way of START_WAYS) {
      expect(startDestination(t, way, "website", "  ", p)).toEqual({ error: t.emptyWebsite });
      expect(startDestination(t, way, "email", "", p)).toEqual({ error: t.emptyEmail });
      expect(startDestination(t, way, "website", "not a site", p)).toEqual({ error: t.invalidWebsite });
      expect(startDestination(t, way, "email", "me@acme", p)).toEqual({ error: t.invalidEmail });
    }
  });

  it("escapes the address it carries", () => {
    const t = finalCtaCopy("en").form;
    expect(startDestination(t, "audit", "website", "https://acme.com/shop?x=1", paths("en"))).toEqual({
      url: `/audit?domain=${encodeURIComponent("https://acme.com/shop?x=1")}`,
    });
  });
});
