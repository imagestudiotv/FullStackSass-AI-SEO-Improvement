import { describe, expect, it } from "vitest";

import { ESSENTIAL, LIFECYCLE_COPY, LIFECYCLE_KINDS, renderLifecycleEmail, type LifecycleEmail, type LifecycleKind } from "@/lib/email/lifecycle-copy";
import { LOCALES } from "@/lib/i18n/config";
import { EMAILS_COPY } from "@/lib/i18n/emails";

/**
 * Every lifecycle email in all five languages: the same sentences, the same
 * {placeholders} as the English, nothing empty, and every one renders with
 * no placeholder left unfilled. A translation that dropped {date} would ship
 * a promise with no date in it.
 */

/** Every string in a copy object, by its path ("trial_started.card"). */
function strings(value: unknown, path = ""): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof value === "string") out.set(path, value);
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      for (const [p, s] of strings(child, path ? `${path}.${key}` : key)) out.set(p, s);
    }
  }
  return out;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

const SAMPLES: Record<LifecycleKind, LifecycleEmail> = {
  welcome: { kind: "welcome", invited: false },
  setup_reminder: { kind: "setup_reminder" },
  trial_started: { kind: "trial_started", websiteId: "w1", domain: "example.com", plan: "Growth", endsOn: new Date("2026-12-01T00:00:00Z"), provider: "stripe" },
  trial_ending: { kind: "trial_ending", websiteId: "w1", domain: "example.com", plan: "Growth", endsOn: new Date("2026-12-01T00:00:00Z") },
  trial_ended: { kind: "trial_ended", websiteId: "w1", domain: "example.com" },
  plan_started: { kind: "plan_started", websiteId: "w1", domain: "example.com", plan: "Growth" },
  payment_failed: { kind: "payment_failed", websiteId: "w1", domain: "example.com", plan: "Growth" },
  cancellation_confirmed: {
    kind: "cancellation_confirmed",
    websiteId: "w1",
    domain: "example.com",
    plan: "Growth",
    endsOn: new Date("2026-12-01T00:00:00Z"),
    trial: false,
  },
  article_published: { kind: "article_published", websiteId: "w1", articleId: "a1", domain: "example.com", title: "Hello", url: "https://example.com/hello" },
  article_failed: { kind: "article_failed", websiteId: "w1", articleId: "a1", domain: "example.com", title: "Hello", error: "401 Unauthorized" },
  video_views: { kind: "video_views", websiteId: "w1", domain: "example.com", title: "Clip", views: 500 },
  referral_reward: { kind: "referral_reward", credits: 50 },
  weekly_summary: { kind: "weekly_summary", articlesPublished: 3, liveArticles: 12, socialPosts: 4, videosPosted: 2, credits: 120 },
};

describe("lifecycle email copy", () => {
  const english = strings(LIFECYCLE_COPY.en);

  it.each(LOCALES)("%s has every sentence, with the English placeholders", (locale) => {
    const theirs = strings(LIFECYCLE_COPY[locale]);
    expect([...theirs.keys()].sort()).toEqual([...english.keys()].sort());
    for (const [path, text] of english) {
      expect(theirs.get(path)?.trim(), `${locale} ${path}`).toBeTruthy();
      expect(placeholders(theirs.get(path)!), `${locale} ${path}`).toEqual(placeholders(text));
    }
  });

  it("has a copy and a sample for every kind", () => {
    for (const kind of LIFECYCLE_KINDS) {
      expect(LIFECYCLE_COPY.en[kind]).toBeDefined();
      expect(SAMPLES[kind].kind).toBe(kind);
      expect(typeof ESSENTIAL[kind]).toBe("boolean");
    }
  });

  it.each(LOCALES)("renders every email in %s with nothing left unfilled", (locale) => {
    for (const kind of LIFECYCLE_KINDS) {
      const email = renderLifecycleEmail(SAMPLES[kind], {
        locale,
        name: "Ada",
        appUrl: "https://app.test",
        unsubscribeUrl: ESSENTIAL[kind] ? null : "https://app.test/unsubscribe/token",
      });
      for (const part of [email.subject, email.text, email.html]) expect(part, `${locale} ${kind}`).not.toMatch(/\{\w+\}/);
      expect(email.html).toContain(`lang="${locale}"`);
      // One button, to the app.
      expect(email.text).toContain("https://app.test/");
      // The unsubscribe link on tips and reports only.
      expect(email.text.includes("/unsubscribe/"), `${locale} ${kind}`).toBe(!ESSENTIAL[kind]);
    }
  });

  it("leaves out a weekly figure that is zero or unknown", () => {
    const email = renderLifecycleEmail(
      { kind: "weekly_summary", articlesPublished: 2 },
      { locale: "en", name: null, appUrl: "https://app.test", unsubscribeUrl: "https://app.test/unsubscribe/t" },
    );
    expect(email.text).toContain("Articles published: 2");
    expect(email.text).not.toMatch(/Videos posted|Credit balance|Social posts/);
  });

  it("escapes what it is given", () => {
    const email = renderLifecycleEmail(
      { kind: "article_published", websiteId: "w1", articleId: "a1", domain: "example.com", title: "<script>x</script>", url: "https://example.com/a" },
      { locale: "en", name: "<b>Ada</b>", appUrl: "https://app.test", unsubscribeUrl: "https://app.test/unsubscribe/t" },
    );
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>Ada</b>");
  });
});

describe("email settings copy", () => {
  const english = strings(EMAILS_COPY.en);
  it.each(LOCALES)("%s has every sentence", (locale) => {
    const theirs = strings(EMAILS_COPY[locale]);
    expect([...theirs.keys()].sort()).toEqual([...english.keys()].sort());
    for (const path of english.keys()) expect(theirs.get(path)?.trim(), `${locale} ${path}`).toBeTruthy();
  });
});
