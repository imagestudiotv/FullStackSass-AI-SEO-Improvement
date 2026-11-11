import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BANNER_TONES,
  cleanBanner,
  countdownParts,
  EMPTY_BANNER,
  liveBanner,
  resolveBannerCopy,
  type BannerInput,
} from "./banner";

/** The bar above the public site's header (client, 2026-11-11). */

const NOW = new Date("2026-11-11T12:00:00Z");
const english = { label: "BLACK FRIDAY", message: "Lifetime Premium 67% off", linkText: "" };

function input(overrides: Partial<BannerInput> = {}): BannerInput {
  return { enabled: true, tone: "orange", endsAt: "2026-11-28T23:59:00Z", copy: { en: english }, ...overrides };
}

describe("saving the banner", () => {
  it("keeps the words on one line and stores the end as a moment", () => {
    const result = cleanBanner(input({ copy: { en: { label: "  BLACK\nFRIDAY ", message: "67%   off" } } }), NOW);
    expect(result).toEqual({
      ok: true,
      value: {
        enabled: true,
        tone: "orange",
        endsAt: new Date("2026-11-28T23:59:00Z"),
        copy: { en: { label: "BLACK FRIDAY", message: "67% off", linkText: "" } },
      },
    });
  });

  it("will not turn on without the English message", () => {
    expect(cleanBanner(input({ copy: { es: { message: "67% de descuento" } } }), NOW)).toEqual({
      ok: false,
      error: "Write the English message before turning the banner on.",
    });
    // Off, a draft without English can be kept.
    expect(cleanBanner(input({ enabled: false, copy: {} }), NOW).ok).toBe(true);
  });

  it("refuses a countdown that is over, invalid or more than a year away", () => {
    expect(cleanBanner(input({ endsAt: "2026-11-11T11:59:00Z" }), NOW)).toMatchObject({ ok: false, error: expect.stringContaining("already passed") });
    expect(cleanBanner(input({ endsAt: "2026-11-" }), NOW)).toEqual({ ok: false, error: "The countdown end is not a valid date." });
    expect(cleanBanner(input({ endsAt: "2027-12-01T00:00:00Z" }), NOW)).toMatchObject({ ok: false, error: expect.stringContaining("366 days") });
    // An old end may stay on a banner that is off.
    expect(cleanBanner(input({ enabled: false, endsAt: "2026-11-01T00:00:00Z" }), NOW).ok).toBe(true);
    // No countdown at all.
    expect(cleanBanner(input({ endsAt: null }), NOW)).toMatchObject({ ok: true, value: { endsAt: null } });
  });

  it("refuses unknown colours, over-long words and a language with a label but no message", () => {
    expect(cleanBanner(input({ tone: "pink" }), NOW)).toEqual({ ok: false, error: "Pick one of the colours." });
    expect(cleanBanner(input({ copy: { en: { message: "x".repeat(161) } } }), NOW)).toEqual({
      ok: false,
      error: "English: the message is longer than 160 characters.",
    });
    expect(cleanBanner(input({ copy: { en: english, fr: { label: "BLACK FRIDAY" } } }), NOW)).toEqual({
      ok: false,
      error: "Français: add the message, or clear the other fields there to show the English words.",
    });
  });

  it("drops languages left empty, and ignores languages the site does not have", () => {
    const result = cleanBanner(input({ copy: { en: english, es: { label: "", message: " " }, xx: { message: "hi" } } }), NOW);
    expect(result.ok && Object.keys(result.value.copy)).toEqual(["en"]);
  });
});

describe("what visitors are sent", () => {
  const saved = { ...EMPTY_BANNER, enabled: true, copy: { en: english }, endsAt: new Date("2026-11-28T23:59:00Z") };

  it("nothing when off, without English, or once the countdown is over", () => {
    expect(liveBanner({ ...saved, enabled: false }, NOW)).toBeNull();
    expect(liveBanner({ ...saved, copy: {} }, NOW)).toBeNull();
    expect(liveBanner(saved, new Date("2026-11-28T23:59:00Z"))).toBeNull();
    expect(liveBanner(saved, NOW)).toMatchObject({ tone: "orange", endsAt: "2026-11-28T23:59:00.000Z" });
    expect(liveBanner({ ...saved, endsAt: null }, NOW)).toMatchObject({ endsAt: null });
  });

  it("a language without its own message gets the English words and the English link, never half of each", () => {
    const copy = resolveBannerCopy({ en: english, it: { label: "", message: "Premium a vita -67%", linkText: "" } });
    expect(copy.en).toEqual({ label: "BLACK FRIDAY", message: "Lifetime Premium 67% off", linkText: "See pricing", lang: "en" });
    expect(copy.it).toEqual({ label: "", message: "Premium a vita -67%", linkText: "Vedi i prezzi", lang: "it" });
    expect(copy.es).toEqual(copy.en);
    expect(resolveBannerCopy({ en: { ...english, linkText: "Grab the deal" } }).de.linkText).toBe("Grab the deal");
  });
});

describe("the countdown", () => {
  it("splits what is left into days, hours, minutes and seconds, and stops at zero", () => {
    expect(countdownParts(((21 * 24 + 6) * 3600 + 52 * 60 + 34) * 1000 + 999)).toEqual([21, 6, 52, 34]);
    expect(countdownParts(-5000)).toEqual([0, 0, 0, 0]);
  });
});

describe("the colours", () => {
  // WCAG relative luminance and contrast.
  const channel = (value: number) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = ([r, g, b]: number[]) => 0.2126 * channel(r / 255) + 0.7152 * channel(g / 255) + 0.0722 * channel(b / 255);
  const contrastWithWhite = (rgb: number[]) => 1.05 / (luminance(rgb) + 0.05);
  const hex = (value: string) => [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16));
  const over = (base: number[], [r, g, b, a]: number[]) => base.map((value, index) => value * (1 - a) + [r, g, b][index] * a);

  const css = readFileSync(path.join(__dirname, "../../components/promo-banner.module.css"), "utf8");
  const rule = (selector: string) => css.slice(css.indexOf(selector), css.indexOf("}", css.indexOf(selector)));
  const declared = (block: string, name: string) => block.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
  const rgba = (value: string) => value.match(/[\d.]+/g)!.map(Number);

  it.each(BANNER_TONES)("%s carries white text at 4.5:1, on the bar and in the countdown's boxes", (tone) => {
    const own = tone === "orange" ? rule(".bar {") : rule(`.bar[data-tone="${tone}"]`);
    const base = rule(".bar {");
    const background = hex(declared(own, "--tone") ?? declared(base, "--tone")!);
    const box = rgba(declared(own, "--box") ?? declared(base, "--box")!);
    expect(contrastWithWhite(background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastWithWhite(over(background, box))).toBeGreaterThanOrEqual(4.5);
  });
});
