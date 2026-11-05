import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DAILY_CLAIM_COPY } from "@/lib/i18n/daily-claim";
import { EARN_COPY } from "@/lib/i18n/earn";
import { EARN_SHARE_COPY } from "@/lib/i18n/earn-share";
import { LOCALES } from "@/lib/i18n/config";
import { SHARE_CHANNELS, SHARE_LIMITS, shareHref, shareLength, shareOverLimit, shareTemplates } from "@/lib/earn/share-templates";

/**
 * The share kit's messages (client design, 2026-11-05): each carries the
 * reader's own code and link and the incentive disclosure, fits its platform,
 * and copying or opening one touches nothing but the clipboard and the address.
 */

const ACCOUNT = { code: "OWN1CODE", link: "https://www.repget.com/r/OWN1CODE" };
const OTHER = { code: "OTHER999", link: "https://www.repget.com/r/OTHER999" };

/** The words each language's disclosure rests on: "I may receive RepGet credits". */
const DISCLOSURE = { en: "may receive RepGet credits", es: "puedo recibir créditos de RepGet", fr: "recevoir des crédits RepGet", it: "posso ricevere crediti RepGet", de: "RepGet-Credits erhalten" } as const;

describe.each(LOCALES)("the templates in %s", (locale) => {
  const copy = EARN_SHARE_COPY[locale];
  const templates = shareTemplates(copy.templates, ACCOUNT);

  it.each(SHARE_CHANNELS)("%s carries this account's own link, code and the disclosure, with no placeholder left", (channel) => {
    const text = templates[channel];
    expect(text).toContain(ACCOUNT.link);
    expect(text).toContain(ACCOUNT.code);
    expect(text).toContain(DISCLOSURE[locale]);
    expect(text).not.toMatch(/\{\w+\}/);
    expect(text).not.toContain(OTHER.code);
  });

  it.each(SHARE_CHANNELS)("%s fits its platform's limit", (channel) => {
    expect(shareOverLimit(channel, templates[channel])).toBe(0);
  });

  it("gives another account its own link, never this one's", () => {
    const others = shareTemplates(copy.templates, OTHER);
    for (const channel of SHARE_CHANNELS) {
      expect(others[channel]).toContain(OTHER.link);
      expect(others[channel]).not.toContain(ACCOUNT.code);
    }
  });

  it("uses no demo account data, and has real line breaks where the design does", () => {
    const words = JSON.stringify(copy);
    for (const demo of ["MUH7XWWT", "263"]) expect(words).not.toContain(demo);
    expect(templates.linkedin.split("\n").length).toBeGreaterThan(3);
    expect(templates.email.split("\n").length).toBeGreaterThan(3);
  });

  it("never says something was shared or that the post pays for itself", () => {
    expect(copy.openedPrefilled).toContain("{platform}");
    expect(copy.openedPaste).toContain("{platform}");
  });
});

describe.each(LOCALES)("the kit's rules in %s", (locale) => {
  /** How each language says it, as the existing claim rule does. */
  const OWN_WORDS = { en: "your own words", es: "sus propias palabras", fr: "vos propres mots", it: "parole Sue", de: "eigenen Worten" } as const;
  const STARTING = { en: "starting point", es: "punto de partida", fr: "point de départ", it: "punto di partenza", de: "Ausgangspunkt" } as const;
  const copy = EARN_SHARE_COPY[locale];

  it("presents the templates as editable starting points", () => {
    for (const words of [copy.body, copy.editable, copy.honest]) expect(words).toContain(STARTING[locale]);
  });

  it("keeps the rule: in your own words, on the kit and on the claim form", () => {
    expect(copy.honest).toContain(OWN_WORDS[locale]);
    expect(copy.steps[2][1]).toContain(OWN_WORDS[locale]);
    expect(EARN_COPY[locale].ways.post.details).toContain(OWN_WORDS[locale]);
  });
});

describe("how a platform counts", () => {
  it("counts any link as 23 characters on X, however long", () => {
    expect(shareLength("x", "https://www.repget.com/r/AVERYLONGCODEINDEEDINDEEDINDEED")).toBe(23);
    expect(shareLength("x", "see https://a.example/1 and https://b.example/2")).toBe(4 + 23 + 5 + 23);
  });

  it("weighs emoji and other wide characters as 2 on X, and not elsewhere", () => {
    expect(shareLength("x", "é")).toBe(1);
    expect(shareLength("x", "😀")).toBe(2);
    expect(shareLength("linkedin", "😀")).toBe(1);
  });

  it("flags what is over each limit, and email has none", () => {
    expect(shareOverLimit("x", "a".repeat(280))).toBe(0);
    expect(shareOverLimit("x", "a".repeat(285))).toBe(5);
    expect(shareOverLimit("linkedin", "a".repeat(3001))).toBe(1);
    expect(SHARE_LIMITS.email).toBeNull();
    expect(shareOverLimit("email", "a".repeat(100_000))).toBe(0);
  });
});

describe("the addresses", () => {
  const options = { link: ACCOUNT.link, subject: "A subject & more" };
  const tricky = "Line one & two?\nLine two #3 = ok\n" + ACCOUNT.link;

  it("URL-encodes the whole message for X and WhatsApp, line breaks included", () => {
    for (const channel of ["x", "whatsapp"] as const) {
      const { href, prefilled } = shareHref(channel, tricky, options);
      const value = new URL(href).searchParams.get("text");
      expect(value).toBe(tricky);
      expect(prefilled).toBe(true);
      expect(href).toContain("%0A");
      expect(href).not.toContain("\n");
    }
  });

  it("gives email CRLF line breaks and an encoded subject, staying in the mail app", () => {
    const { href, prefilled } = shareHref("email", tricky, options);
    expect(href.startsWith("mailto:?subject=A%20subject%20%26%20more&body=")).toBe(true);
    expect(href).toContain("%0D%0A");
    expect(prefilled).toBe(true);
  });

  it("gives LinkedIn and Facebook only the link, so the kit says to paste the text", () => {
    for (const channel of ["linkedin", "facebook"] as const) {
      const { href, prefilled } = shareHref(channel, tricky, options);
      expect(prefilled).toBe(false);
      expect(href).toContain(encodeURIComponent(ACCOUNT.link));
      expect(href).not.toContain("Line");
    }
  });

  it("opens without the text when it is too long for an address, instead of cutting it", () => {
    const long = "é".repeat(1500);
    expect(shareHref("whatsapp", long, options)).toEqual({ href: "https://wa.me/", prefilled: false });
    const mail = shareHref("email", long, options);
    expect(mail.prefilled).toBe(false);
    expect(mail.href).not.toContain("body=");
  });
});

describe("copying and sharing earn nothing", () => {
  const kit = readFileSync(path.resolve(__dirname, "../../app/(app)/earn-credits/share-kit.tsx"), "utf8");
  const copy = readFileSync(path.resolve(__dirname, "../../app/(app)/earn-credits/copy-text.ts"), "utf8");
  const templatesModule = readFileSync(path.resolve(__dirname, "./share-templates.ts"), "utf8");

  it("the kit reaches no server action, route or database: only the clipboard and an address", () => {
    for (const source of [kit, copy, templatesModule]) {
      expect(source).not.toMatch(/from "@\/lib\/[^"]*actions"/);
      expect(source).not.toMatch(/from "@\/lib\/db/);
      expect(source).not.toMatch(/\bfetch\(/);
      expect(source).not.toMatch(/submitEarnClaim|recordCredit|claimDailyCredits/);
    }
  });

  it("the kit reads the rewards it names, rather than repeating them", () => {
    expect(kit).not.toMatch(/\b(100|20)\b credits/);
    for (const locale of LOCALES) {
      const words = EARN_SHARE_COPY[locale];
      expect(words.flag).toContain("{credits}");
      expect(words.guide).toContain("{post}");
      expect(words.guide).toContain("{referral}");
    }
  });
});

describe("the manual check-in's words", () => {
  it("no surface says daily credits arrive by themselves, in any language", () => {
    const automatic = /automatic|automátic|automatiq|automatisch/i;
    for (const locale of LOCALES) {
      const earn = EARN_COPY[locale];
      expect(earn.dailyBody).not.toMatch(automatic);
      for (const [question, answer] of earn.faq) {
        if (/daily|diari|quotidien|giornal|täglich/i.test(question)) expect(answer).not.toMatch(automatic);
      }
      expect(JSON.stringify(DAILY_CLAIM_COPY[locale])).not.toMatch(automatic);
    }
  });

  it("no check-in string hardcodes an amount", () => {
    for (const locale of LOCALES) {
      const { credits: _plural, ...rest } = DAILY_CLAIM_COPY[locale];
      expect(JSON.stringify(rest)).not.toMatch(/[+ ]3 /);
    }
  });
});
