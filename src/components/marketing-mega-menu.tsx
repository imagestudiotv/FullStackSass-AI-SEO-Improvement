"use client";

import Link from "next/link";
import { useId, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { ChannelIcon, FeatureIcon, type ChannelIconName, type FeatureIconName } from "@/components/site-icons";
import type { Locale } from "@/lib/i18n/config";
import type { SiteChrome } from "@/lib/i18n/site-chrome";

import styles from "./site-header.module.css";

/**
 * What the header's Features and Integrations menus show (client's design,
 * 2026-11-03): the six-tool showcase with its "demo preview" windows, and
 * the channels RepGet creates for and the website/data connections.
 *
 * Each is ONE piece of markup that the header places either in its desktop
 * menu or, at 1190px and below, in the phone drawer's accordion - as the
 * design moves it - so ids are never duplicated and the selected tab
 * survives the move (the state lives in marketing-nav.tsx).
 *
 * The words come from the server with the rest of the header's
 * (lib/i18n/site-chrome.ts: `menu` and `site`); destinations and marks live
 * here.
 */
export type MegaMenuCopy = SiteChrome[Locale]["menu"];
export type SiteCopy = SiteChrome[Locale]["site"];

/** The design's class names, through the CSS module. */
export const c = (names: string) =>
  names
    .split(" ")
    .map((name) => styles[name] ?? name)
    .join(" ");

/**
 * The six tools, in the copy's order, and where each one's heading leads.
 *
 * Only pages that exist. Three tools have a page of their own (/audit,
 * /backlinks, /rank-on-chatgpt). The other three do not yet, so they point at
 * the nearest real page rather than an address made up to fill the menu:
 *  - Content: the Image Studio case study, which walks through exactly that
 *    plan-write-publish loop on a real site;
 *  - Social: the homepage's feature selector, the only public page that
 *    shows the social side;
 *  - Growth: success stories, which shows what the product measures.
 * A missing entry falls back rather than throwing, so a seventh translated
 * tool never breaks the header.
 */
export const FEATURE_TOOLS: { key: Exclude<FeatureIconName, "arrow">; href: string }[] = [
  { key: "content", href: "/success-stories/image-studio" },
  { key: "social", href: "/#features" },
  { key: "seo", href: "/audit" },
  { key: "backlinks", href: "/backlinks" },
  { key: "ai", href: "/rank-on-chatgpt" },
  { key: "growth", href: "/success-stories" },
];

export function featureTool(index: number) {
  return FEATURE_TOOLS[index] ?? { key: "content" as const, href: "/" };
}

type ChannelKey = keyof SiteCopy["channels"];
export type Channel = {
  key: ChannelKey;
  name: string;
  icon: ChannelIconName;
  /** The design's brand tile class. */
  tile: string;
  /** A public setup guide, when there is one: the entry links to it. */
  guide?: string;
};

/**
 * The social channels, as the design lists them (twelve, three columns).
 * None has a public page of its own, so each previews its line in the
 * menu's footer rather than linking anywhere.
 */
export const SOCIAL_PLATFORMS: Channel[] = [
  { key: "instagram", name: "Instagram", icon: "ig", tile: "instagram" },
  { key: "facebook", name: "Facebook", icon: "fb", tile: "facebook" },
  { key: "tiktok", name: "TikTok", icon: "tiktok", tile: "tiktok" },
  { key: "linkedin", name: "LinkedIn", icon: "linkedin", tile: "linkedin" },
  { key: "x", name: "X (Twitter)", icon: "x", tile: "x-twitter" },
  { key: "youtube", name: "YouTube", icon: "youtube", tile: "youtube" },
  { key: "threads", name: "Threads", icon: "threads", tile: "threads" },
  { key: "pinterest", name: "Pinterest", icon: "pinterest", tile: "pinterest" },
  { key: "gbp", name: "Google Business Profile", icon: "gbp", tile: "google-business" },
  { key: "bluesky", name: "Bluesky", icon: "bluesky", tile: "bluesky" },
  { key: "reddit", name: "Reddit", icon: "reddit", tile: "reddit" },
  { key: "quora", name: "Quora", icon: "quora", tile: "quora" },
];

/**
 * Website and data connections. Each publishing target links to its setup
 * guide (lib/publishing/docs.ts); WordPress goes to the plugin guide, the
 * first and recommended of its two. Search Console and Analytics are
 * connected inside the app and have no public guide, so they only preview.
 */
export const SITE_CONNECTIONS: Channel[] = [
  { key: "wordpress", name: "WordPress", icon: "wordpress", tile: "wordpress", guide: "/docs/integrations/wordpress-plugin" },
  { key: "shopify", name: "Shopify", icon: "shopify", tile: "shopify", guide: "/docs/integrations/shopify" },
  { key: "webflow", name: "Webflow", icon: "webflow", tile: "webflow", guide: "/docs/integrations/webflow" },
  { key: "wix", name: "Wix", icon: "wix", tile: "wix", guide: "/docs/integrations/wix" },
  { key: "ghost", name: "Ghost", icon: "ghost", tile: "ghost", guide: "/docs/integrations/ghost" },
  { key: "webhook", name: "Webhooks", icon: "webhook", tile: "webhook", guide: "/docs/integrations/webhook" },
  { key: "searchconsole", name: "Search Console", icon: "gsc", tile: "searchconsole" },
  { key: "analytics", name: "Analytics", icon: "analytics", tile: "analytics" },
];

/** The Integrations menu's "Explore RepGet": the setup guides. */
export const INTEGRATIONS_HREF = "/docs/integrations";

/** "{n} platforms" with the real count, so the pill cannot drift from the list. */
export function countLabel(template: string, count: number) {
  return template.replace("{n}", String(count));
}

/* ------------------------------------------------------------------ */
/* Features                                                            */
/* ------------------------------------------------------------------ */

/**
 * The six tools as tabs (roving tabindex, arrow keys, Home/End), the
 * selected one described below with its steps, "Next feature" and an
 * illustrative product window. Hovering a card selects it on a fine pointer,
 * as in the design. The heading is the link to the tool's page.
 */
export function FeaturesShowcase({
  menu,
  site,
  href,
  active,
  onSelect,
  onNavigate,
}: {
  menu: MegaMenuCopy;
  site: SiteCopy;
  href: (path: string) => string;
  active: number;
  onSelect: (index: number) => void;
  onNavigate: () => void;
}) {
  const base = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const count = menu.tools.length;
  const tabId = (index: number) => `${base}-tab-${index}`;
  const panelId = (index: number) => `${base}-panel-${index}`;

  const select = (index: number, focus = false) => {
    onSelect(index);
    if (focus) tabs.current[index]?.focus({ preventScroll: true });
  };

  const onKeyDown = (index: number) => (event: ReactKeyboardEvent) => {
    let next: number;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % count;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + count) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    else return;
    event.preventDefault();
    select(next, true);
  };

  return (
    <section aria-labelledby={`${base}-heading`} className={c("rgf-section")}>
      <div className={c("rgf-wrap")}>
        <div className={c("rgf-intro")}>
          <div>
            <div className={c("rgf-overline")}>{menu.featuresOverline}</div>
            <div id={`${base}-heading`} className={c("rgf-title")}>
              {menu.featuresTitle}
            </div>
          </div>
          <p>
            <span className={c("rgf-online-dot")} aria-hidden="true" /> {menu.featuresTagline}
          </p>
        </div>

        <div role="tablist" aria-label={menu.featuresTitle} className={c("rgf-tabs")}>
          {menu.tools.map((tool, index) => {
            const { key } = featureTool(index);
            const selected = index === active;
            return (
              <button
                key={key}
                ref={(node) => {
                  tabs.current[index] = node;
                }}
                id={tabId(index)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId(index)}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(index)}
                onMouseEnter={() => {
                  if (window.matchMedia("(hover:hover) and (pointer:fine)").matches) select(index);
                }}
                onKeyDown={onKeyDown(index)}
                className={c(`rgf-card rgf-card-${key}${selected ? " is-active" : ""}`)}
              >
                <div className={c("rgf-card-head")}>
                  <div>
                    <strong>{tool.title}</strong>
                    <span>{tool.sub}</span>
                  </div>
                  <span className={c("rgf-iconbox")}>
                    <FeatureIcon name={key} className={c("rgf-svg")} />
                  </span>
                </div>
                <MiniCard tool={key} site={site} />
              </button>
            );
          })}
        </div>

        <div className={c("rgf-detail")}>
          {menu.tools.map((tool, index) => {
            const { key, href: target } = featureTool(index);
            return (
              <div
                key={key}
                id={panelId(index)}
                role="tabpanel"
                aria-labelledby={tabId(index)}
                hidden={index !== active}
                className={c("rgf-panel")}
              >
                <div className={c("rgf-detail-copy")}>
                  <div className={c("rgf-detail-kicker")}>{tool.kicker}</div>
                  <div className={c("rgf-heading")}>
                    <Link href={href(target)} onClick={onNavigate}>
                      {tool.heading}
                    </Link>
                  </div>
                  <p>{tool.body}</p>
                  <ul aria-label={site.workflowSteps} className={c("rgf-steps")}>
                    {tool.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                  <button type="button" className={c("rgf-next")} onClick={() => select((index + 1) % count)}>
                    {menu.next} <FeatureIcon name="arrow" className={c("rgf-svg")} />
                  </button>
                </div>
                <div className={c("rgf-detail-preview")}>
                  <PreviewWindow tool={key} site={site} />
                </div>
              </div>
            );
          })}
        </div>

        <div className={c("rgf-bottom")}>
          <span>{menu.bottom}</span>
          <span>{site.illustrations}</span>
        </div>
      </div>
    </section>
  );
}

/** The little drawing at the foot of each tool card. */
function MiniCard({ tool, site }: { tool: Exclude<FeatureIconName, "arrow">; site: SiteCopy }) {
  const m = site.mini;
  const kicker = (text: string) => (
    <div className={c("rgf-mini-kicker")}>
      <span>{text}</span>
      <i className={c("rgf-tiny-dot")} />
    </div>
  );
  let body;
  switch (tool) {
    case "content":
      body = (
        <>
          {kicker(m.content.kicker)}
          <div className={c("rgf-article-line")}>
            <i className={c("rgf-page-thumb")} />
            <div className={c("rgf-article-text")}>
              <b>{m.content.title}</b>
              <span className={c("rgf-skeleton w78")} />
            </div>
          </div>
          <div className={c("rgf-mini-bottom")}>
            <span className={c("rgf-chip")}>{m.content.chip}</span>
            <span className={c("rgf-mini-time")}>{m.content.status}</span>
          </div>
        </>
      );
      break;
    case "social":
      body = (
        <>
          {kicker(m.social.kicker)}
          <div className={c("rgf-social-preview")}>
            <span className={c("rgf-post-img")} />
            <span className={c("rgf-post-lines")}>
              <i />
              <i />
              <i />
            </span>
          </div>
          <div className={c("rgf-mini-bottom")}>
            <span className={c("rgf-social-bubbles")}>
              <b>◎</b>
              <b>in</b>
              <b>p</b>
            </span>
            <span className={c("rgf-chip")}>{m.social.chip}</span>
          </div>
        </>
      );
      break;
    case "seo":
      body = (
        <>
          {kicker(m.seo.kicker)}
          <div className={c("rgf-audit-mini")}>
            <span className={c("rgf-mini-ring")}>A</span>
            <span className={c("rgf-mini-checks")}>
              <i>{"✓\u00a0 "}{m.seo.checks[0]}</i>
              <i>{"✓\u00a0 "}{m.seo.checks[1]}</i>
            </span>
          </div>
          <div className={c("rgf-mini-bottom")}>
            <span>{m.seo.bottom}</span>
            <span className={c("rgf-mini-tag")}>SEO</span>
          </div>
        </>
      );
      break;
    case "backlinks":
      body = (
        <>
          {kicker(m.backlinks.kicker)}
          <div className={c("rgf-link-bars")}>
            {["35%", "55%", "46%", "74%", "100%"].map((height) => (
              <i key={height} style={{ height }} />
            ))}
          </div>
          <div className={c("rgf-mini-bottom")}>
            <span>{m.backlinks.bottom}</span>
            <span className={c("rgf-mini-tag")}>DR</span>
          </div>
        </>
      );
      break;
    case "ai":
      body = (
        <>
          {kicker(m.ai.kicker)}
          <div className={c("rgf-ai-mini-row")}>
            <span className={c("rgf-ai-mark")}>✳</span>
            <b>ChatGPT</b>
            <i className={c("rgf-ai-signal")} />
          </div>
          <div className={c("rgf-ai-mini-row")}>
            <span className={c("rgf-ai-mark gemini")}>✦</span>
            <b>Gemini</b>
            <i className={c("rgf-ai-signal alt")} />
          </div>
          <div className={c("rgf-mini-bottom")}>
            <span>{m.ai.bottom}</span>
            <span className={c("rgf-mini-tag")}>AI</span>
          </div>
        </>
      );
      break;
    case "growth":
      body = (
        <>
          {kicker(m.growth.kicker)}
          <svg aria-hidden="true" className={c("rgf-mini-chart")} preserveAspectRatio="none" viewBox="0 0 160 54">
            <path
              d="M0 48L20 41L39 44L57 32L76 35L96 27L114 29L135 14L160 6"
              fill="none"
              stroke="#5c86d7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
            />
            <path d="M0 48L20 41L39 44L57 32L76 35L96 27L114 29L135 14L160 6V54H0Z" fill="#8db2f5" opacity=".15" />
          </svg>
          <div className={c("rgf-mini-bottom")}>
            <span>{m.growth.bottom}</span>
            <span className={c("rgf-mini-tag")}>↗</span>
          </div>
        </>
      );
      break;
  }
  return (
    <div className={c("rgf-card-mini")} aria-hidden="true">
      {body}
    </div>
  );
}

/** The "demo preview" product window beside each tool's description. */
function PreviewWindow({ tool, site }: { tool: Exclude<FeatureIconName, "arrow">; site: SiteCopy }) {
  const gradient = useId();
  const w = site.windows;
  const kicker = (text: string) => <div className={c("rgf-form-kicker")}>{text}</div>;
  let app: string;
  let content;
  switch (tool) {
    case "content":
      app = w.content.app;
      content = (
        <>
          <div className={c("rgf-content-article")}>
            {kicker(w.content.next)}
            <div className={c("rgf-title-line")}>{w.content.title}</div>
            <div className={c("rgf-fauxcopy")}>
              <span />
              <span />
              <span />
            </div>
            <div className={c("rgf-editor-tags")}>
              <span>{w.content.tags[0]}</span>
              <span>{w.content.tags[1]}</span>
            </div>
          </div>
          <div className={c("rgf-side-queue")}>
            {kicker(w.content.queue)}
            {w.content.rows.map(([step, state], index) => (
              <div key={step} className={c("rgf-queue-row")}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <b>{step}</b>
                <em>{state}</em>
              </div>
            ))}
            <div className={c("rgf-queue-footer")}>
              WordPress <i>•</i> Shopify
            </div>
          </div>
        </>
      );
      break;
    case "social":
      app = w.social.app;
      content = (
        <>
          <div className={c("rgf-social-post")}>
            <div className={c("rgf-social-art")}>
              <span className={c("rgf-social-art-orbit")} />
              <b>
                {w.social.art[0]}
                <br />
                {w.social.art[1]}
              </b>
            </div>
            <div className={c("rgf-social-caption")}>
              <span />
              <span />
            </div>
          </div>
          <div className={c("rgf-social-schedule")}>
            {kicker(w.social.head)}
            {(
              [
                ["insta", "◎", "Instagram"],
                ["linkedin", "in", "LinkedIn"],
                ["pin", "p", "Pinterest"],
              ] as const
            ).map(([mark, glyph, name], index) => (
              <div key={name} className={c("rgf-schedule-row")}>
                <span className={c(`rgf-platform ${mark}`)}>{glyph}</span>
                <b>{name}</b>
                <em>{w.social.statuses[index]}</em>
              </div>
            ))}
            <div className={c("rgf-queue-footer")}>{w.social.footer}</div>
          </div>
        </>
      );
      break;
    case "seo":
      app = w.seo.app;
      content = (
        <>
          <div className={c("rgf-seo-visual")}>
            <div className={c("rgf-seo-ring")}>
              <div>
                {w.seo.ring[0]}
                <br />
                <b>{w.seo.ring[1]}</b>
              </div>
            </div>
            <div className={c("rgf-seo-small")}>
              {w.seo.summary[0]}
              <br />
              <strong>{w.seo.summary[1]}</strong>
            </div>
          </div>
          <div className={c("rgf-seo-findings")}>
            {kicker(w.seo.head)}
            {w.seo.rows.map(([label, state], index) => (
              <div key={label}>
                <span className={c(index === 2 ? "rgf-review" : "rgf-done")}>{index === 2 ? "!" : "✓"}</span>
                <b>{label}</b>
                <em>{state}</em>
              </div>
            ))}
            <div className={c("rgf-queue-footer")}>{w.seo.footer}</div>
          </div>
        </>
      );
      break;
    case "backlinks":
      app = w.backlinks.app;
      content = (
        <>
          <div className={c("rgf-backlink-rows")}>
            {kicker(w.backlinks.head)}
            {w.backlinks.rows.map(([label, state]) => (
              <div key={label} className={c("rgf-backlink-row")}>
                <span className={c("rgf-linkicon")}>↗</span>
                <b>{label}</b>
                <em>{state}</em>
              </div>
            ))}
          </div>
          <div className={c("rgf-backlink-side")}>
            {kicker(w.backlinks.flowHead)}
            <div className={c("rgf-backlink-flow")}>
              <b>{w.backlinks.flow[0]}</b>
              <span>→</span>
              <b>{w.backlinks.flow[1]}</b>
              <span>→</span>
              <b>{w.backlinks.flow[2]}</b>
            </div>
            <div className={c("rgf-backlink-foot")}>{w.backlinks.footer}</div>
          </div>
        </>
      );
      break;
    case "ai":
      app = w.ai.app;
      content = (
        <>
          <div className={c("rgf-ai-question")}>
            {kicker(w.ai.head)}
            <div className={c("rgf-ai-quote")}>{w.ai.quote}</div>
            <div className={c("rgf-ai-tags")}>
              <span>{w.ai.tags[0]}</span>
              <span>{w.ai.tags[1]}</span>
            </div>
          </div>
          <div className={c("rgf-ai-results")}>
            {kicker(w.ai.channels)}
            {(
              [
                ["✳", "ChatGPT"],
                ["✦", "Gemini"],
                ["◉", "Perplexity"],
              ] as const
            ).map(([glyph, name]) => (
              <div key={name}>
                <span>{glyph}</span>
                <b>{name}</b>
                <em>{w.ai.status}</em>
              </div>
            ))}
          </div>
        </>
      );
      break;
    case "growth":
      app = w.growth.app;
      content = (
        <>
          <div className={c("rgf-growth-graph")}>
            <div className={c("rgf-graph-title")}>
              <div>
                {kicker(w.growth.head)}
                <strong>{w.growth.title}</strong>
              </div>
              <span>{w.growth.range}</span>
            </div>
            <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 290 116">
              <defs>
                <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#638ce1" stopOpacity=".27" />
                  <stop offset="1" stopColor="#638ce1" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 95H290M0 61H290M0 28H290" stroke="#e9eef8" strokeWidth="1" />
              <path d="M0 91L30 82L52 86L80 71L108 78L138 59L162 65L186 45L218 50L247 29L290 12V116H0Z" fill={`url(#${gradient})`} />
              <path
                d="M0 91L30 82L52 86L80 71L108 78L138 59L162 65L186 45L218 50L247 29L290 12"
                fill="none"
                stroke="#4f7fdf"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
            </svg>
          </div>
          <div className={c("rgf-growth-side")}>
            {kicker(w.growth.channels)}
            {(["orange", "purple", "blue"] as const).map((dot, index) => (
              <div key={dot}>
                <span className={c(`rgf-channel-dot ${dot}`)} />
                {w.growth.rows[index]}
              </div>
            ))}
            <div className={c("rgf-queue-footer")}>{w.growth.footer}</div>
          </div>
        </>
      );
      break;
  }
  return (
    <div role="img" aria-label={site.windowLabel.replace("{app}", app)} className={c("rgf-window")}>
      <div className={c("rgf-window-top")}>
        <span className={c("rgf-appmark")}>R</span>
        <strong>
          RepGet <span>/ {app}</span>
        </strong>
        <span className={c("rgf-preview-tag")}>{site.demoPreview}</span>
      </div>
      <div className={c("rgf-window-content")}>{content}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Integrations                                                        */
/* ------------------------------------------------------------------ */

/**
 * The channels and connections. Hovering shows an entry is live; clicking
 * or focusing one says what RepGet does with it in the footer, as in the
 * design. Connections with a public setup guide are links to it.
 */
export function IntegrationsShowcase({
  menu,
  site,
  href,
  selected,
  onSelect,
  onNavigate,
}: {
  menu: MegaMenuCopy;
  site: SiteCopy;
  href: (path: string) => string;
  selected: ChannelKey | null;
  onSelect: (key: ChannelKey) => void;
  onNavigate: () => void;
}) {
  const base = useId();
  const current = [...SOCIAL_PLATFORMS, ...SITE_CONNECTIONS].find((channel) => channel.key === selected);

  const entry = (channel: Channel) => {
    const inner = (
      <>
        <span className={c(`icon-box ${channel.tile}`)}>
          <ChannelIcon name={channel.icon} />
        </span>
        <span className={c("name")}>{channel.name}</span>
        <ChannelIcon name="arrow" className={c("entry-arrow")} />
      </>
    );
    const className = c(`entry${channel.key === selected ? " selected" : ""}`);
    const preview = () => onSelect(channel.key);
    return channel.guide ? (
      <Link
        key={channel.key}
        href={href(channel.guide)}
        className={className}
        onFocus={preview}
        onClick={() => {
          preview();
          onNavigate();
        }}
      >
        {inner}
      </Link>
    ) : (
      <button key={channel.key} type="button" className={className} onFocus={preview} onClick={preview}>
        {inner}
      </button>
    );
  };

  return (
    <div className={c("rgint")}>
      <div className={c("mega-body")}>
        <div role="group" aria-labelledby={`${base}-social`} className={c("social-area")}>
          <div id={`${base}-social`} className={c("area-head")}>
            {menu.socialHead} <span className={c("count-pill")}>{countLabel(menu.platforms, SOCIAL_PLATFORMS.length)}</span>
          </div>
          <p className={c("area-sub")}>{menu.socialSub}</p>
          <div className={c("social-grid")}>{SOCIAL_PLATFORMS.map(entry)}</div>
        </div>
        <div role="group" aria-labelledby={`${base}-site`} className={c("connections-area")}>
          <div id={`${base}-site`} className={c("area-head")}>
            {menu.siteHead} <span className={c("count-pill")}>{countLabel(menu.connections, SITE_CONNECTIONS.length)}</span>
          </div>
          <p className={c("area-sub")}>{menu.siteSub}</p>
          <div className={c("connections-grid")}>{SITE_CONNECTIONS.map(entry)}</div>
        </div>
      </div>
      <div aria-live="polite" className={c("mega-footer")}>
        <div className={c("footer-left")}>
          <span className={c("sparkle-box")}>
            <ChannelIcon name="spark" />
          </span>
          <div>
            <p className={c("footer-title")}>{current ? current.name : menu.footerTitle}</p>
            <p className={c("footer-detail")}>{current ? site.channels[current.key] : menu.footerBody}</p>
          </div>
        </div>
        <div aria-hidden="true" className={c("footer-mode")}>
          {site.modes.map((mode) => (
            <span key={mode} className={c("mode-chip")}>
              {mode}
            </span>
          ))}
        </div>
        <Link href={href(INTEGRATIONS_HREF)} onClick={onNavigate} className={c("footer-cta")}>
          {menu.explore} <ChannelIcon name="arrow" />
        </Link>
      </div>
    </div>
  );
}
