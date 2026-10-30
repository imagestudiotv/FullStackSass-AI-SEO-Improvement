import { describe, expect, it } from "vitest";

import { checkDraft, isOwnLink, isRepeat, linksIn, mayLink, namesBrand, postingTime, replyText } from "./rules";
import { cleanUsername, composeUrl, replyUrl, threadFromUrl } from "./platforms";

describe("threadFromUrl", () => {
  it.each([
    ["reddit", "https://old.reddit.com/r/Photography/comments/1ABC23/best_lens/?share=1", "https://www.reddit.com/r/Photography/comments/1abc23/"],
    ["quora", "https://www.quora.com/How-do-I-choose-a-wedding-photographer/answer/Jane-Doe", "https://www.quora.com/How-do-I-choose-a-wedding-photographer"],
    ["quora", "https://it.quora.com/Come-scegliere-un-fotografo-di-matrimonio", "https://it.quora.com/Come-scegliere-un-fotografo-di-matrimonio"],
    ["quora", "https://www.quora.com/unanswered/How-much-does-product-photography-cost", "https://www.quora.com/How-much-does-product-photography-cost"],
    ["x", "https://twitter.com/someone/status/1849000000000000000?s=20", "https://x.com/someone/status/1849000000000000000"],
    ["threads", "https://www.threads.net/@someone/post/C9abcDEF12x", "https://www.threads.com/@someone/post/C9abcDEF12x"],
    ["bluesky", "https://bsky.app/profile/someone.bsky.social/post/3kabcdefg2x", "https://bsky.app/profile/someone.bsky.social/post/3kabcdefg2x"],
  ] as const)("finds the %s discussion in %s", (platform, raw, url) => {
    expect(threadFromUrl(platform, raw)?.url).toBe(url);
  });

  it.each([
    ["reddit", "https://www.reddit.com/r/Photography/"],
    ["reddit", "https://www.reddit.com/user/someone/"],
    ["quora", "https://www.quora.com/profile/Jane-Doe"],
    ["quora", "https://www.quora.com/topic/Photography"],
    ["quora", "https://photography.quora.com/Some-post"],
    ["quora", "https://it.quora.com/"],
    ["x", "https://x.com/someone"],
    ["x", "https://x.com/i/status/1849000000000000000"],
    ["threads", "https://www.threads.com/@someone"],
    ["bluesky", "https://bsky.app/profile/someone.bsky.social"],
    ["pinterest", "https://www.pinterest.com/pin/123/"],
    ["reddit", "javascript:alert(1)"],
  ] as const)("ignores the %s page %s", (platform, raw) => {
    expect(threadFromUrl(platform, raw)).toBeNull();
  });

  it("knows a Quora question's language from its address", () => {
    expect(threadFromUrl("quora", "https://www.quora.com/How-do-I-choose-a-wedding-photographer")?.language).toBe("en");
    expect(threadFromUrl("quora", "https://it.quora.com/Come-scegliere-un-fotografo-di-matrimonio")?.language).toBe("it");
    expect(threadFromUrl("reddit", "https://www.reddit.com/r/photo/comments/abc123/x/")?.language).toBeUndefined();
  });

  it("keeps what the reply link needs", () => {
    expect(threadFromUrl("x", "https://x.com/a/status/123456789")?.replyTo).toBe("123456789");
    expect(threadFromUrl("threads", "https://www.threads.com/@a/post/C9abcDEF12x")?.replyTo).toBe("C9abcDEF12x");
  });
});

describe("reply and compose links", () => {
  it("fill the reply in where the platform can", () => {
    const x = threadFromUrl("x", "https://x.com/a/status/123456789")!;
    expect(replyUrl(x, "Hi & thanks")).toBe("https://x.com/intent/post?in_reply_to=123456789&text=Hi%20%26%20thanks");
    const threads = threadFromUrl("threads", "https://www.threads.com/@a/post/C9abcDEF12x")!;
    expect(replyUrl(threads, "Hi")).toBe("https://www.threads.com/intent/post?reply_post_shortcode=C9abcDEF12x&text=Hi");
  });

  it("open the discussion elsewhere: the text is on the clipboard", () => {
    const reddit = threadFromUrl("reddit", "https://www.reddit.com/r/photo/comments/abc123/x/")!;
    expect(replyUrl(reddit, "Hi")).toBe(reddit.url);
  });

  it("leave a Pin's link out when there is none", () => {
    expect(composeUrl("pinterest", { body: "Nice", imageUrl: "https://cdn.example/a.jpg" })).toBe(
      "https://www.pinterest.com/pin/create/button/?media=https%3A%2F%2Fcdn.example%2Fa.jpg&description=Nice",
    );
  });
});

describe("cleanUsername", () => {
  it.each([
    ["reddit", "u/Some_User", "Some_User"],
    ["reddit", "https://www.reddit.com/user/Some_User/", "Some_User"],
    ["x", "@someone", "someone"],
    ["quora", "https://www.quora.com/profile/Jane-Doe", "Jane-Doe"],
    ["bluesky", "@someone.bsky.social", "someone.bsky.social"],
  ] as const)("reads %s %s as %s", (platform, raw, name) => {
    expect(cleanUsername(platform, raw)).toBe(name);
  });

  it("refuses what is not a username", () => {
    expect(cleanUsername("x", "two words")).toBeNull();
    expect(cleanUsername("x", "")).toBeNull();
  });
});

describe("the anti-ban rules", () => {
  const site = { brandName: "Image Studio", domain: "imagestudio.io" };

  it("find links and bare domains", () => {
    expect(linksIn("See https://a.com/x and www.b.org, or c.io.")).toEqual(["https://a.com/x", "www.b.org,", "c.io"]);
    expect(linksIn("No link here, e.g. a sentence.")).toEqual([]);
  });

  it("know the website's own links", () => {
    expect(isOwnLink("https://www.imagestudio.io/blog", "imagestudio.io")).toBe(true);
    expect(isOwnLink("shop.imagestudio.io", "imagestudio.io")).toBe(true);
    expect(isOwnLink("https://notimagestudio.io", "imagestudio.io")).toBe(false);
  });

  it("spot the brand however it is written, but not inside other words", () => {
    expect(namesBrand("We at Image Studio think", site)).toBe(true);
    expect(namesBrand("imagestudio does this", site)).toBe(true);
    expect(namesBrand("image-studio does this", site)).toBe(true);
    expect(namesBrand("A good image, a studio light", site)).toBe(false);
  });

  it("keep the warm-up free of links and names", () => {
    const warm = { ...site, warmup: true };
    expect(checkDraft({ platform: "reddit", body: "Use soft light." }, warm)).toEqual({ ok: true });
    expect(checkDraft({ platform: "reddit", body: "See imagestudio.io" }, warm)).toEqual({ ok: false, reason: "link during the warm-up" });
    expect(checkDraft({ platform: "reddit", body: "Image Studio can help" }, warm)).toEqual({ ok: false, reason: "brand name during the warm-up" });
    expect(checkDraft({ platform: "pinterest", body: "Soft light", link: "https://imagestudio.io" }, warm).ok).toBe(false);
    // The website's address with a TLD the link pattern does not know is still a link.
    expect(checkDraft({ platform: "x", body: "More at erika-shop.example" }, { brandName: null, domain: "erika-shop.example", warmup: true })).toEqual({
      ok: false,
      reason: "link during the warm-up",
    });
  });

  it("allow one link to the website itself after it", () => {
    const after = { ...site, warmup: false };
    expect(checkDraft({ platform: "x", body: "More at https://imagestudio.io/blog" }, after)).toEqual({ ok: true });
    expect(checkDraft({ platform: "x", body: "See https://other.com" }, after)).toEqual({ ok: false, reason: "link to another website" });
    expect(checkDraft({ platform: "x", body: "imagestudio.io and imagestudio.io/blog" }, after)).toEqual({ ok: false, reason: "more than one link" });
  });

  it("hold every platform to its length", () => {
    expect(checkDraft({ platform: "x", body: "a".repeat(281) }, { ...site, warmup: false })).toEqual({ ok: false, reason: "too long" });
    expect(checkDraft({ platform: "bluesky", body: "a".repeat(300) }, { ...site, warmup: false })).toEqual({ ok: true });
  });

  it("name the business in a reply only where it says it is the writer's own", () => {
    expect(replyText("Shoot a test session first.", null, site)).toBe("Shoot a test session first.");
    expect(replyText("In my studio we test first.", "Disclosure: I run Image Studio.", site)).toBe(
      "In my studio we test first.\n\nDisclosure: I run Image Studio.",
    );
    // Any language: the check is where the name is, not how the sentence reads.
    expect(replyText("Nel mio studio proviamo prima.", "Trasparenza: gestisco Image Studio.", site)).toBe(
      "Nel mio studio proviamo prima.\n\nTrasparenza: gestisco Image Studio.",
    );
    // The name in the body itself, as if from an unrelated customer: dropped.
    expect(replyText("Image Studio does this really well.", null, site)).toBeNull();
    expect(replyText("Image Studio does this really well.", "Disclosure: I run Image Studio.", site)).toBeNull();
    // A disclosure that does not name the business, carries a link or runs long: dropped.
    expect(replyText("Test first.", "Disclosure: I run a studio.", site)).toBeNull();
    expect(replyText("Test first.", "Disclosure: I run imagestudio.io", site)).toBeNull();
    expect(replyText("Test first.", `Disclosure: I run Image Studio, ${"a".repeat(160)}`, site)).toBeNull();
  });

  it("never repeat a text", () => {
    expect(isRepeat("Soft light, always!", ["soft  light always"])).toBe(true);
    expect(isRepeat("Soft light, always!", ["Hard light"])).toBe(false);
  });

  it("put a link in one own post out of three, never during the warm-up", () => {
    expect(mayLink(true, 10)).toBe(false);
    expect(mayLink(false, 0)).toBe(false);
    expect(mayLink(false, 1)).toBe(false);
    expect(mayLink(false, 2)).toBe(true);
  });

  it("post between 3 and 9 hours later, at an uneven minute", () => {
    const at = new Date("2026-10-28T07:00:00Z");
    expect(postingTime(at, 0).toISOString()).toBe("2026-10-28T10:00:00.000Z");
    expect(postingTime(at, 0.9999).toISOString()).toBe("2026-10-28T15:59:00.000Z");
  });
});
