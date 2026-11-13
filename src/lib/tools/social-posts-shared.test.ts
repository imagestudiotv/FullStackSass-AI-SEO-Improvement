import { describe, expect, it } from "vitest";

import { PLATFORMS } from "@/lib/social/platforms";
import { VIDEO_PLATFORM_SPECS } from "@/lib/video/formats";

import {
  allPostsText,
  countCharacters,
  FREE_SOCIAL_PLATFORMS,
  FREE_SOCIAL_SPECS,
  isOverLimit,
  looksLikePublicUrl,
  postsCsv,
} from "./social-posts-shared";

/** The free AI Social Media Post Generator's browser-side rules (client, 2026-11-13). */

describe("the platforms and their limits", () => {
  it("offers the design's nine platforms, with the product's own limits", () => {
    expect([...FREE_SOCIAL_PLATFORMS]).toEqual(["instagram", "linkedin", "x", "facebook", "threads", "tiktok", "pinterest", "reddit", "bluesky"]);
    expect(FREE_SOCIAL_SPECS.x.max).toBe(280);
    expect(FREE_SOCIAL_SPECS.x.max).toBe(PLATFORMS.x.maxLength);
    expect(FREE_SOCIAL_SPECS.bluesky.max).toBe(PLATFORMS.bluesky.maxLength);
    expect(FREE_SOCIAL_SPECS.threads.max).toBe(PLATFORMS.threads.maxLength);
    expect(FREE_SOCIAL_SPECS.instagram.max).toBe(VIDEO_PLATFORM_SPECS.instagram.captionMax);
    expect(FREE_SOCIAL_SPECS.linkedin.max).toBe(VIDEO_PLATFORM_SPECS.linkedin.captionMax);
  });
});

describe("character counting", () => {
  it("counts accents and emoji once on most platforms, not as JavaScript's UTF-16 length", () => {
    expect(countCharacters("instagram", "Café")).toBe(4);
    expect(countCharacters("linkedin", "Hi 👋")).toBe(4);
    expect("Hi 👋".length).toBe(5);
  });

  it("counts the way X does: a link is 23, an emoji or a CJK character is 2", () => {
    expect(countCharacters("x", "Hello")).toBe(5);
    expect(countCharacters("x", "Read https://example.com/a/very/long/path/that/goes/on/and/on")).toBe(5 + 23);
    expect(countCharacters("x", "👍")).toBe(2);
    // A family emoji is several code points joined, still one emoji.
    expect(countCharacters("x", "👨‍👩‍👧")).toBe(2);
    expect(countCharacters("x", "日本")).toBe(4);
  });

  it("counts graphemes on Bluesky", () => {
    expect(countCharacters("bluesky", "👨‍👩‍👧 ok")).toBe(4);
  });

  it("flags a post over its platform's limit", () => {
    expect(isOverLimit("x", "a".repeat(280))).toBe(false);
    expect(isOverLimit("x", "a".repeat(281))).toBe(true);
    expect(isOverLimit("bluesky", "a".repeat(301))).toBe(true);
    expect(isOverLimit("linkedin", "a".repeat(2_000))).toBe(false);
  });
});

describe("export", () => {
  const posts = [
    { angle: "Hook", text: '=HYPERLINK("http://evil.example","click")' },
    { angle: "List", text: "- one\n- two, with \"quotes\"" },
    { angle: "", text: "@repget +1 thanks" },
  ];
  const header: [string, string, string, string, string, string] = ["Platform", "Post", "Angle", "Text", "Characters", "Source URL"];

  it("writes CSV that a spreadsheet will not run as formulas, with quoting and line breaks kept", () => {
    const csv = postsCsv(header, "linkedin", posts, "https://example.com/blog");
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Platform,Post,Angle,Text,Characters,Source URL");
    // Every dangerous first character is defused with a leading quote.
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""click"")"`);
    expect(csv).toContain(`"'- one\n- two, with ""quotes"""`);
    expect(csv).toContain("'@repget +1 thanks");
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
    expect(csv).toContain("LinkedIn,1,Hook,");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("defuses a hostile source address or angle too", () => {
    const csv = postsCsv(header, "x", [{ angle: "+cmd", text: "ok" }, { angle: "a", text: "b" }, { angle: "c", text: "d" }], "=cmd|' /C calc'!A0");
    expect(csv).toContain("'+cmd");
    expect(csv).toContain("'=cmd|' /C calc'!A0");
  });

  it("copies every post as one text, numbered", () => {
    expect(allPostsText(posts.slice(1), (n) => `Post ${n}`)).toBe("Post 1 - List\n- one\n- two, with \"quotes\"\n\n---\n\nPost 2\n@repget +1 thanks");
  });
});

describe("the browser's quick address check (the server checks again)", () => {
  it.each(["example.com", "https://www.example.com/blog/post?id=3", "http://shop.example.co.uk"])("accepts %s", (value) => {
    expect(looksLikePublicUrl(value)).toBe(true);
  });
  it.each(["", "localhost", "http://127.0.0.1", "http://[::1]/", "javascript:alert(1)", "ftp://example.com", "file:///etc/passwd", "https://user:pw@example.com", "intranet", "printer.local", "has space.com"])(
    "refuses %j",
    (value) => {
      expect(looksLikePublicUrl(value)).toBe(false);
    },
  );
});
