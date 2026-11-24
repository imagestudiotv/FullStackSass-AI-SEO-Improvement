import { beforeAll, describe, expect, it, vi } from "vitest";

import { httpsUrl, readBroadcastContent, sanitizeBroadcastHtml } from "./content";
import { renderBroadcastEmail } from "./render";
import { BROADCAST_TEMPLATES, type BroadcastContent } from "./shared";

/** What an administrator may put in a broadcast, and that nothing else leaves in the email. */

const STORED = "https://store.example/storage/v1/object/public/article-images/broadcasts/email/pic.png";

const content = (over: Partial<BroadcastContent> = {}): BroadcastContent => ({
  audience: "all",
  subject: "News",
  previewText: "Preview",
  bodyHtml: "<p>Hello</p>",
  images: [],
  ctaLabel: "",
  ctaUrl: "",
  ...over,
});

beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://store.example");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com");
});

describe("sanitising the message", () => {
  it("keeps the editor's own formatting and nothing else", () => {
    const { html, droppedLinks } = sanitizeBroadcastHtml(
      '<p style="color:red" onclick="x()">A <b>bold</b> <i>it</i></p><ul><li><p>one</p></li></ul><p><a href="https://repget.com/x" target="_blank" onmouseover="y()">go</a> <a href="mailto:a@b.co">mail</a></p><p></p>',
    );
    expect(html).toBe(
      '<p>A <strong>bold</strong> <em>it</em></p><ul><li><p>one</p></li></ul><p><a href="https://repget.com/x">go</a> <a href="mailto:a@b.co">mail</a></p>',
    );
    expect(droppedLinks).toBe(0);
  });

  it.each([
    ["<script>alert(1)</script><p>x</p>", "<p>x</p>"],
    ["<p><img src=x onerror=alert(1)>x</p>", "<p>x</p>"],
    ["<style>p{}</style><iframe src='https://e.example'></iframe><p>x</p>", "<p>x</p>"],
    ["<h1>x</h1>", "x"],
  ])("removes %s", (input, output) => {
    expect(sanitizeBroadcastHtml(input).html).toBe(output);
  });

  it.each(["javascript:alert(1)", "java\tscript:alert(1)", "http://a.example", "//a.example/x", "data:text/html,x", "https://user:pw@a.example/"])(
    "drops the link %s and reports it",
    (href) => {
      const result = sanitizeBroadcastHtml(`<p><a href="${href}">words</a></p>`);
      expect(result.html).toBe("<p>words</p>");
      expect(result.droppedLinks).toBe(1);
    },
  );
});

describe("the button's address", () => {
  it("is https with a real host, or refused", () => {
    expect(httpsUrl(" https://www.repget.com/app ")).toBe("https://www.repget.com/app");
    for (const bad of ["", "http://repget.com", "repget.com", "javascript:alert(1)", "https://localhost/x", "https://a@b.example/", "https:// a.example"]) {
      expect(httpsUrl(bad)).toBeNull();
    }
  });
});

describe("checking what was typed", () => {
  it("accepts a draft with nothing in it, and refuses to send one", () => {
    const empty = content({ subject: "", bodyHtml: "" });
    expect(readBroadcastContent(empty, { complete: false }).ok).toBe(true);
    expect(readBroadcastContent(empty, { complete: true })).toEqual({ ok: false, error: "Write a subject." });
    expect(readBroadcastContent(content({ bodyHtml: "<p>&nbsp;</p>" }), { complete: true })).toEqual({ ok: false, error: "Write a message." });
  });

  it("puts the subject on one line", () => {
    const read = readBroadcastContent(content({ subject: "One\r\nBcc: x@y.example" }), { complete: true });
    expect(read.ok && read.content.subject).toBe("One Bcc: x@y.example");
  });

  it("needs both halves of a button, and an https address", () => {
    expect(readBroadcastContent(content({ ctaLabel: "Go" }), { complete: true }).ok).toBe(false);
    expect(readBroadcastContent(content({ ctaLabel: "Go", ctaUrl: "http://a.example" }), { complete: false }).ok).toBe(false);
    expect(readBroadcastContent(content({ ctaLabel: "Go", ctaUrl: "https://a.example" }), { complete: true }).ok).toBe(true);
  });

  it("accepts only our own stored pictures", () => {
    expect(readBroadcastContent(content({ images: [{ url: STORED, alt: " A chart " }] }), { complete: true })).toMatchObject({
      ok: true,
      content: { images: [{ url: STORED, alt: "A chart" }] },
    });
    for (const url of [
      "https://evil.example/storage/v1/object/public/article-images/broadcasts/email/pic.png",
      STORED.replace("broadcasts/email", "broadcasts/pending"),
      `${STORED}" onerror="x`,
      STORED.replace("pic.png", "../../blog/x.png"),
    ]) {
      expect(readBroadcastContent(content({ images: [{ url, alt: "" }] }), { complete: true }).ok).toBe(false);
    }
  });

  it("refuses an unknown audience", () => {
    expect(readBroadcastContent({ ...content(), audience: "admins" }, { complete: false }).ok).toBe(false);
  });

  it("every template passes as it is", () => {
    for (const template of BROADCAST_TEMPLATES) {
      const read = readBroadcastContent(content({ ...template.content, ctaUrl: `https://www.repget.com${template.path}` }), { complete: true });
      expect(read).toMatchObject({ ok: true, content: { bodyHtml: template.content.bodyHtml.replace(/<br>/g, "<br />") } });
    }
  });
});

describe("the email", () => {
  const render = (over: Partial<BroadcastContent> = {}) =>
    renderBroadcastEmail(content(over), { unsubscribeUrl: "https://www.repget.com/unsubscribe/tok" });

  it("escapes the subject, the preview text, the button and the picture's description", () => {
    const email = render({
      subject: 'A <b>"bold"</b> & co',
      previewText: "<script>p</script>",
      ctaLabel: "<i>Go</i>",
      ctaUrl: "https://a.example/?a=1&b=2",
      images: [{ url: STORED, alt: '"><script>alert(1)</script>' }],
    });
    expect(email.subject).toBe('A <b>"bold"</b> & co');
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<i>Go");
    expect(email.html).toContain("A &lt;b&gt;&quot;bold&quot;&lt;/b&gt; &amp; co");
    expect(email.html).toContain('href="https://a.example/?a=1&amp;b=2"');
    expect(email.html).toContain("&lt;i&gt;Go&lt;/i&gt;");
  });

  it("sanitises again whatever is stored", () => {
    expect(render({ bodyHtml: '<p>x</p><script>alert(1)</script><a href="javascript:x">y</a>' }).html).not.toMatch(/<script|javascript:/);
  });

  it("always ends with the unsubscribe link, in both parts", () => {
    const email = render();
    expect(email.html).toContain('href="https://www.repget.com/unsubscribe/tok"');
    expect(email.text).toContain("https://www.repget.com/unsubscribe/tok");
  });

  it("writes a readable plain-text part", () => {
    const email = render({
      bodyHtml: '<p>Hello<br>there</p><ol><li><p>First</p></li><li><p>Second</p></li></ol><ul><li>Dot</li></ul><p>See <a href="https://a.example/x">this &amp; that</a>.</p>',
      ctaLabel: "Open",
      ctaUrl: "https://b.example/",
    });
    expect(email.text).toBe(
      [
        "Hello\nthere",
        "1. First\n2. Second",
        "- Dot",
        "See this & that (https://a.example/x).",
        "Open:\nhttps://b.example/",
        "--",
        "You receive this because you have a RepGet account.\nUnsubscribe from tips and reports: https://www.repget.com/unsubscribe/tok",
      ].join("\n\n"),
    );
  });
});
