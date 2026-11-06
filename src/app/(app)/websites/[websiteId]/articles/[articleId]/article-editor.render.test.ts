import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ArticleDetail } from "@/lib/articles/actions";
import { ARTICLE_DELIVERY } from "@/lib/i18n/article-delivery";
import { format } from "@/lib/i18n/format";
import { getMessages } from "@/lib/i18n/messages";

/**
 * The article workspace by role and state, rendered to static markup (no
 * DOM: dialogs, tabs switching and the editor itself are covered in the
 * browser). Viewers get no controls the server would refuse; editors get
 * Save, Publish and Rewrite in three separate places; publishing waits, in
 * words, for the things the server would hold it for.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("@/lib/articles/actions", () => ({ regenerateArticle: vi.fn(), updateArticle: vi.fn() }));
vi.mock("@/lib/articles/image-actions", () => ({
  listReusableImages: vi.fn(),
  uploadInlineImage: vi.fn(),
  regenerateArticleImage: vi.fn(),
  removeArticleImage: vi.fn(),
  updateArticleImageAlt: vi.fn(),
  uploadArticleImage: vi.fn(),
}));
vi.mock("@/lib/publishing/actions", () => ({ publishArticle: vi.fn(), confirmNotPublished: vi.fn() }));
vi.mock("@/components/rich-text-editor", () => ({ RichTextEditor: () => null }));

import { ArticleEditor, type ArticleEditorProps } from "./article-editor";
import { ArticlePublishing } from "./article-publishing";
import { planPublishing, type PublishFacts } from "./publish-state";

const en = getMessages("en");

const ARTICLE: ArticleDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  calendarItemId: "22222222-2222-4222-8222-222222222222",
  title: "Wedding films in Italy",
  slug: "wedding-films-italy",
  targetKeyword: "wedding films italy",
  wordCount: 3,
  status: "draft",
  generationStep: null,
  error: null,
  updatedAt: new Date("2026-10-01T10:00:00Z"),
  bodyHtml: '<h2 id="intro">Intro</h2><p>Some words here.</p><table><tr><td>a</td></tr></table>',
  metaDescription: "Short films.",
  imageUrl: null,
  imageAlt: null,
  imageAttempts: 0,
  publishedUrl: null,
  publishRequested: null,
  preparing: null,
  withTeam: false,
};

const FACTS: PublishFacts = {
  destination: { kind: "direct", name: "WordPress", provider: "wordpress", site: "Example" },
  review: "none",
  frozen: false,
  uncertain: false,
  delivering: false,
  liveOnSite: false,
  alreadySent: { publish: false, draft: false },
  lastOutcome: { kind: "none" },
  latestDispatchId: null,
  latestLogId: null,
  planned: "12 October 2026",
  plannedInFuture: true,
  autoPublish: "live",
};

function render(overrides: Partial<ArticleEditorProps> = {}) {
  const props: ArticleEditorProps = {
    websiteId: "33333333-3333-4333-8333-333333333333",
    article: ARTICLE,
    canEdit: true,
    locale: "en",
    websiteDomain: "example.com",
    siteOrigin: "https://example.com",
    partnerLinks: [],
    facts: FACTS,
    history: [],
    historyLimit: 10,
    failureKind: null,
    uncertain: false,
    lastSaved: "1 Oct 2026, 10:00 UTC",
    rewriteLimit: 10,
    imageMaxAttempts: 5,
    imageMaxBytes: 8 * 1024 * 1024,
    plannedArticlesLabel: en.app.nav.plannedArticles,
    uncertainText: {
      title: en.app.reports.uncertainTitle,
      help: en.app.reports.uncertainHelp,
      confirm: en.app.reports.uncertainConfirm,
      confirmed: en.app.reports.uncertainConfirmed,
    },
    t: en.app.editor,
    tImage: en.app.image,
    tCommon: en.app.common,
    tStatus: en.app.status,
    tEditorUi: en.app.editorUi,
    tWorkspace: en.app.workspace,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(ArticleEditor, props));
}

/** The button whose visible text is exactly `label`, as markup. */
function button(html: string, label: string): string | null {
  const match = new RegExp(`<button[^>]*>(?:(?!</button>).)*?${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</button>`, "s").exec(html);
  return match ? match[0] : null;
}

describe("the article workspace", () => {
  it("gives a viewer the article, its status and history, and no controls the server would refuse", () => {
    const html = render({ canEdit: false, uncertain: true });
    expect(html).toContain(en.app.workspace.viewOnly);
    expect(html).toContain("Some words here.");
    expect(html).toContain(en.app.editor.publishingHistory);
    expect(button(html, en.app.editor.saveArticle)).toBeNull();
    expect(button(html, en.app.editor.publish)).toBeNull();
    expect(button(html, en.app.editor.sendAsDraft)).toBeNull();
    expect(button(html, en.app.common.rewrite)).toBeNull();
    expect(html).not.toContain('role="tablist"');
    // The uncertain-delivery notice is shown, its confirmation is not.
    expect(html).toContain(en.app.reports.uncertainTitle);
    expect(html).not.toContain(en.app.reports.uncertainConfirm);
  });

  it("gives an editor Preview/Edit tabs, Publish, Send as draft, Rewrite and the save bar, each in its own place", () => {
    const html = render();
    expect(html).toContain('role="tablist"');
    expect(button(html, en.app.editor.publish)).not.toBeNull();
    expect(button(html, en.app.editor.publish)).not.toContain('disabled=""');
    expect(button(html, en.app.editor.sendAsDraft)).not.toBeNull();
    expect(button(html, en.app.common.rewrite)).not.toBeNull();
    expect(button(html, en.app.editor.saveArticle)).not.toBeNull();
    // Breadcrumb back to the list the article was opened from.
    expect(html).toContain('href="/websites/33333333-3333-4333-8333-333333333333/content"');
    // Scheduling facts and the honest note about publishing early.
    expect(html).toContain("12 October 2026");
    expect(html).toContain(en.app.editor.beforePlanned);
    expect(html).toContain(en.app.editor.stateNotSent);
  });

  it("holds Publish for the RepGet team's review, and says so", () => {
    const html = render({ facts: { ...FACTS, review: "pending" } });
    expect(button(html, en.app.editor.publish)).toContain('disabled=""');
    expect(html).toContain(en.app.editor.stateReviewPending);
  });

  it.each(["pending", "changed"] as const)("directs %s research review to the sources instead of the Partner Network", review => {
    const html = render({ facts: { ...FACTS, review, reviewSource: "research" } });
    expect(button(html, en.app.editor.publish)).toContain('disabled=""');
    expect(html).toContain(review === "pending" ? en.app.editor.stateResearchPending : en.app.editor.stateResearchChanged);
    expect(html).not.toContain(en.app.editor.stateReviewPending);
    expect(html).not.toContain(en.app.editor.stateReviewChanged);
  });

  it("explains research approval invalidation on image changes without assigning it to the team", () => {
    const html = render({ facts: { ...FACTS, review: "approved", reviewSource: "research" } });
    expect(html).toContain(en.app.editor.researchEditNote);
    expect(html).not.toContain(en.app.editor.imageReviewNote);
  });

  it("explains a post the WordPress plugin created, instead of offering buttons that cannot update it", () => {
    const html = render({
      facts: { ...FACTS, destination: { kind: "plugin" } },
      article: { ...ARTICLE, publishedUrl: "https://example.com/wedding-films-italy" },
    });
    expect(html).toContain(en.app.editor.statePluginPublished);
    expect(button(html, en.app.editor.publish)).toBeNull();
    expect(button(html, en.app.editor.updatePost)).toBeNull();
  });

  it("offers Update for a live post and says when that exact version is already there", () => {
    const html = render({
      facts: { ...FACTS, liveOnSite: true, alreadySent: { publish: true, draft: false }, lastOutcome: { kind: "live", when: "2 Oct 2026, 09:00 UTC" } },
      article: { ...ARTICLE, status: "published", publishedUrl: "https://example.com/wedding-films-italy" },
    });
    expect(button(html, en.app.editor.updatePost)).toContain('disabled=""');
    expect(html).toContain(en.app.editor.alreadySentLive);
    expect(html).toContain("Live on your website. Last sent 2 Oct 2026, 09:00 UTC.");
    expect(html).toContain('href="https://example.com/wedding-films-italy"');
  });

  it("links to Integrations when nothing is connected", () => {
    const html = render({ facts: { ...FACTS, destination: { kind: "none" } } });
    expect(html).toContain(en.app.editor.connectToPublish);
    expect(html).toContain('href="/websites/33333333-3333-4333-8333-333333333333/integrations"');
  });

  it("shows a writing failure in plain words and offers to try again", () => {
    const html = render({ article: { ...ARTICLE, status: "failed", bodyHtml: null }, failureKind: "busy" });
    expect(html).toContain(en.app.editor.couldNotWrite);
    expect(html).toContain(en.app.editor.genBusy);
    expect(button(html, en.app.editor.tryAgain)).not.toBeNull();
  });

  it("pauses editing and publishing while the article is being rewritten", () => {
    const html = render({ article: { ...ARTICLE, status: "generating", generationStep: "body" } });
    expect(html).toContain(en.app.editor.writingBody);
    expect(html).toContain(en.app.editor.workingPaused);
    expect(button(html, en.app.editor.publish)).toContain('disabled=""');
    expect(button(html, en.app.common.rewrite)).toContain('disabled=""');
  });

  it("lists the publishing history with what the website stored and a link to the real post", () => {
    const html = render({
      history: [
        { id: "a", status: "published", remoteStatus: "draft", remoteUrl: "https://example.com/?p=1", errorKind: null, at: "2026-10-02T09:00:00.000Z", when: "2 Oct 2026, 09:00 UTC" },
        { id: "b", status: "failed", remoteStatus: null, remoteUrl: null, errorKind: "unreachable", at: "2026-10-01T09:00:00.000Z", when: "1 Oct 2026, 09:00 UTC" },
        { id: "c", status: "published", remoteStatus: "publish", remoteUrl: "/relative-path", errorKind: null, at: "2026-09-30T09:00:00.000Z", when: "30 Sept 2026, 09:00 UTC" },
      ],
    });
    expect(html).toContain(en.app.editor.logDraft);
    expect(html).toContain(en.app.editor.pubErrUnreachable);
    expect(html).toContain('href="https://example.com/?p=1"');
    // A bare path would link into this app: not offered.
    expect(html).not.toContain('href="/relative-path"');
  });

  it("shows the metadata beside the article to everyone, viewers included (they have no Edit tab)", () => {
    const html = render({ canEdit: false, article: { ...ARTICLE, metaDescription: "Films shot across Italy." } });
    expect(html).toContain(en.app.editor.searchPreviewTitle);
    expect(html).toContain("Films shot across Italy.");
    expect(html).toContain("example.com › wedding-films-italy");
    // Read-only: no fields for them.
    expect(html).not.toContain('id="article-meta"');
  });

  it("says when there is no meta description rather than showing an empty result", () => {
    const html = render({ article: { ...ARTICLE, metaDescription: null } });
    expect(html).toContain(en.app.editor.metaNone);
  });

  it("warns that changing an approved article's picture sends it back to review, and only then", () => {
    const approved = render({
      facts: { ...FACTS, review: "approved" },
      article: { ...ARTICLE, imageUrl: "https://cdn.example.com/a.jpg", imageAlt: "A couple" },
    });
    expect(approved).toContain(en.app.editor.imageReviewNote);
    expect(render()).not.toContain(en.app.editor.imageReviewNote);
    // Viewers change nothing, so there is nothing to warn about.
    expect(render({ canEdit: false, facts: { ...FACTS, review: "approved" } })).not.toContain(
      en.app.editor.imageReviewNote,
    );
  });

  it("sends the article's own-site links in Preview to the customer's site, not into this app", () => {
    const html = render({
      article: { ...ARTICLE, bodyHtml: '<p>See <a href="/services">our services</a> and <a href="#intro">the intro</a>.</p>' },
    });
    expect(html).toContain('href="https://example.com/services" target="_blank" rel="noopener"');
    expect(html).toContain('href="#intro"');
    expect(html).not.toContain('href="/services"');
  });
});

describe("the publishing panel after a press", () => {
  /** The panel as the editor wires it, for a direct press whose result is not recorded yet. */
  function panel(pressExpired: boolean) {
    const plan = planPublishing({
      canEdit: true,
      hasBody: true,
      working: false,
      dirty: false,
      awaiting: true,
      pressExpired,
      publishRequested: null,
      publishedUrl: null,
      facts: FACTS,
    });
    return renderToStaticMarkup(
      createElement(ArticlePublishing, {
        websiteId: "33333333-3333-4333-8333-333333333333",
        plan,
        facts: FACTS,
        working: false,
        canEdit: true,
        pressing: null,
        awaiting: true,
        pressExpired,
        pressTime: "10:00 UTC",
        pressError: null,
        pluginNotice: null,
        checking: false,
        onPublish: () => {},
        onCheckAgain: () => {},
        t: en.app.editor,
        tCommon: en.app.common,
        delivery: ARTICLE_DELIVERY.en,
      }),
    );
  }

  it("holds Publish and Send as draft while the result is watched", () => {
    const html = panel(false);
    expect(html).toContain(format(en.app.editor.stateQueued, { time: "10:00 UTC" }));
    expect(button(html, en.app.editor.publish)).toContain('disabled=""');
    expect(button(html, en.app.editor.sendAsDraft)).toContain('disabled=""');
  });

  it("after the watch says it is still waiting, offers Check again, and gives both buttons back", () => {
    // The job can hold a press without recording anything; the buttons must not stay locked until a reload.
    const html = panel(true);
    expect(html).toContain(en.app.editor.stateQueuedLong);
    expect(button(html, en.app.editor.checkAgain)).not.toBeNull();
    expect(button(html, en.app.editor.publish)).not.toBeNull();
    expect(button(html, en.app.editor.publish)).not.toContain('disabled=""');
    expect(button(html, en.app.editor.sendAsDraft)).not.toBeNull();
    expect(button(html, en.app.editor.sendAsDraft)).not.toContain('disabled=""');
  });
});

describe("the two-step flow (docs/two-step-articles.md)", () => {
  const d = ARTICLE_DELIVERY.en;
  const READY: PublishFacts = { ...FACTS, twoStep: true, review: "approved", reviewSource: "team", autoPublish: "off", plannedInFuture: false };

  it("a ready article: the finished text, one Publish, no second button and no approval", () => {
    const html = render({ facts: READY });
    expect(html).toContain("Some words here.");
    expect(html).toContain(d.ready);
    expect(button(html, en.app.editor.publish)).not.toBeNull();
    expect(button(html, en.app.editor.publish)).not.toContain('disabled=""');
    expect(button(html, en.app.editor.sendAsDraft)).toBeNull();
    expect(html).not.toContain("Approve");
    expect(html).toContain(en.app.status.ready);
  });

  it("automatic publishing says when it goes, and Publish stays as the way to go sooner", () => {
    const live = render({ facts: { ...READY, autoPublish: "live", plannedInFuture: true } });
    expect(live).toContain(format(d.readyAutoLive, { date: "12 October 2026" }));
    expect(button(live, en.app.editor.publish)).not.toContain('disabled=""');
    const drafts = render({ facts: { ...READY, autoPublish: "draft", plannedInFuture: true } });
    expect(drafts).toContain(format(d.readyAutoDraft, { date: "12 October 2026" }));
    expect(button(drafts, en.app.editor.sendAsDraft)).toBeNull();
  });

  it("not connected: says it is ready and not on the website, and leads to the connection", () => {
    const html = render({ facts: { ...READY, destination: { kind: "none" } } });
    expect(html).toContain(d.readyConnect);
    expect(html).toContain(en.app.editor.connectToPublish);
    expect(html).toContain("/integrations");
    expect(button(html, en.app.editor.publish)).toBeNull();
    expect(html).not.toContain(d.ready);
  });

  it("a version already on the website: Publish waits, and says why", () => {
    const html = render({ facts: { ...READY, alreadySent: { publish: true, draft: false }, liveOnSite: true, lastOutcome: { kind: "live", when: "1 Oct" } } });
    expect(button(html, en.app.editor.updatePost)).toContain('disabled=""');
    expect(html).toContain(en.app.editor.alreadySentLive);
  });

  it("a change to a live post: the team's check is said plainly, and nothing is asked", () => {
    const html = render({
      article: { ...ARTICLE, status: "published", publishedUrl: "https://example.com/a", withTeam: true },
      facts: { ...READY, withTeam: true, liveOnSite: true, alreadySent: { publish: true, draft: false }, lastOutcome: { kind: "live", when: "1 Oct" } },
    });
    expect(html).toContain(d.withTeamLive);
    // That version is what is on the site, so there is nothing to send yet.
    expect(button(html, en.app.editor.updatePost)).toContain('disabled=""');
    expect(html).toContain(d.lockedWithTeam);
  });

  it("a change that was waiting at switch-on: nothing to send, and the panel says so", () => {
    const html = render({
      article: { ...ARTICLE, status: "published", publishedUrl: "https://example.com/a", withTeam: true },
      facts: { ...READY, withTeam: true, review: "pending", liveOnSite: true, lastOutcome: { kind: "live", when: "1 Oct" } },
    });
    expect(html).toContain(d.withTeamChange);
    expect(html).not.toContain(d.withTeamLive);
    expect(button(html, en.app.editor.updatePost)).toContain('disabled=""');
  });

  it("an approved update on a plugin site has its Update button, where the plugin path used to end", () => {
    const facts = { ...READY, destination: { kind: "plugin" as const }, liveOnSite: true, lastOutcome: { kind: "live" as const, when: "1 Oct" } };
    const html = render({ article: { ...ARTICLE, status: "published", publishedUrl: "https://example.com/a" }, facts });
    expect(button(html, en.app.editor.updatePost)).not.toContain('disabled=""');
    expect(html).not.toContain(en.app.editor.statePluginPublished);
    const off = render({ article: { ...ARTICLE, status: "published", publishedUrl: "https://example.com/a" }, facts: { ...facts, twoStep: false } });
    expect(off).toContain(en.app.editor.statePluginPublished);
  });

  it("re-editing an approved article: the last approved version stays, with Publish working and the text locked", () => {
    const html = render({ article: { ...ARTICLE, withTeam: true }, facts: { ...READY, withTeam: true } });
    expect(html).toContain("Some words here.");
    expect(html).toContain(d.withTeam);
    expect(button(html, en.app.editor.publish)).not.toContain('disabled=""');
    expect(button(html, en.app.editor.saveArticle)).toContain("disabled");
    expect(html).toContain(d.lockedWithTeam);
  });

  it("with the switch off, the panel is as it was", () => {
    const html = render({ facts: { ...FACTS, review: "approved", reviewSource: "team" } });
    expect(button(html, en.app.editor.sendAsDraft)).not.toBeNull();
    expect(html).not.toContain(d.ready);
  });
});

describe("the page while the team has the article", () => {
  it("shows honest progress with nothing of the article and no action to take", async () => {
    const { ArticlePreparing } = await import("./article-preparing");
    const props = {
      websiteId: "33333333-3333-4333-8333-333333333333",
      title: "Planned topic",
      stage: "team" as const,
      destination: { kind: "none" as const },
      autoPublish: "off" as const,
      canEdit: true,
      locale: "en" as const,
      plannedArticlesLabel: en.app.nav.plannedArticles,
      breadcrumbLabel: en.app.editor.breadcrumbLabel,
      tStatus: en.app.status,
    };
    const html = renderToStaticMarkup(createElement(ArticlePreparing, props));
    expect(html).toContain(ARTICLE_DELIVERY.en.teamTitle);
    expect(html).toContain(ARTICLE_DELIVERY.en.connectNote);
    expect(html).toContain("/integrations");
    expect(html).not.toContain("<button");
    expect(html).not.toMatch(/approve/i);

    const connected = renderToStaticMarkup(createElement(ArticlePreparing, { ...props, destination: { kind: "plugin" as const }, autoPublish: "live" as const }));
    expect(connected).not.toContain(ARTICLE_DELIVERY.en.connectNote);
    expect(connected).toContain(ARTICLE_DELIVERY.en.autoNoteLive);

    const viewer = renderToStaticMarkup(createElement(ArticlePreparing, { ...props, canEdit: false }));
    expect(viewer).not.toContain(ARTICLE_DELIVERY.en.connectAction);
  });
});
