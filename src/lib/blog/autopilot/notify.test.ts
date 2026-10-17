import { beforeEach, describe, expect, it, vi } from "vitest";

/** The "drafts to review" email: who gets it, what it links to, and that it never breaks the run. */

const mail = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendEmail: mail.send }));

import { emailDraftsReady } from "./notify";

const INPUT = {
  title: "Local SEO for <Plumbers>",
  englishPostId: "post-en",
  translations: [
    { locale: "it" as const, postId: "post-it" },
    { locale: "de" as const, postId: "post-de" },
  ],
  warnings: ["The article has 2 tables; the blog's posts have 3 to 5."],
  costUsd: 3.456,
};

beforeEach(() => {
  mail.send.mockReset();
  mail.send.mockResolvedValue({ ok: true, id: "email" });
  vi.stubEnv("ADMIN_EMAILS", "one@repget.test, two@repget.test");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com");
});

describe("the drafts-ready email", () => {
  it("goes to every administrator, linking each draft, with what to check and the cost", async () => {
    expect(await emailDraftsReady(INPUT)).toEqual({ sent: 2 });
    expect(mail.send.mock.calls.map(([options]) => options.to)).toEqual(["one@repget.test", "two@repget.test"]);
    const [{ subject, html, text }] = mail.send.mock.calls[0];
    expect(subject).toBe("Blog drafts to review: Local SEO for <Plumbers>");
    expect(text).toContain("The English draft and its Italian, German translations are ready to review.");
    expect(text).toContain("English: https://www.repget.com/admin/blog/post-en\nItalian: https://www.repget.com/admin/blog/post-it\nGerman: https://www.repget.com/admin/blog/post-de");
    expect(text).toContain("- The article has 2 tables; the blog's posts have 3 to 5.");
    expect(text).toContain("Translations need a native speaker's review before they can be published. Nothing goes live until you publish it. AI cost: $3.46.");
    // The title is escaped in the HTML.
    expect(html).toContain("Local SEO for &lt;Plumbers&gt;");
    expect(html).not.toContain("<Plumbers>");
  });

  it("sends nothing without administrators, and never throws", async () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    expect(await emailDraftsReady(INPUT)).toEqual({ sent: 0 });
    vi.stubEnv("ADMIN_EMAILS", "one@repget.test");
    mail.send.mockRejectedValueOnce(new Error("provider down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await emailDraftsReady(INPUT)).toEqual({ sent: 0 });
  });
});
