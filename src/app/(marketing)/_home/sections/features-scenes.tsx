import type { ReactNode } from "react";

import type { FeatureKey, FeaturesCopy } from "@/lib/i18n/home/features";

import styles from "./features.module.css";

/** The design's class names, hyphens and all, mapped to the module's. */
const c = (names: string) =>
  names
    .split(" ")
    .map((n) => styles[n] ?? n)
    .join(" ");

/**
 * The drawn product previews of the "Top features" shell, one per capability
 * (client's design, 2026-11-18, the `scene` functions of
 * repget_features_premium.html), as JSX instead of the design's HTML strings.
 *
 * Server-only markup: the section renders all nine into the page and the
 * client shell only shows and hides them. Every word comes from
 * lib/i18n/home/features.ts; the figures are samples, labelled so.
 */

export type IconName =
  | "video"
  | "chat"
  | "book"
  | "link"
  | "sparkle"
  | "chart"
  | "sliders"
  | "search"
  | "brain"
  | "check"
  | "arrow"
  | "mouse";

/** The design's sprite (`#i-*`), drawn inline. */
const PATHS: Record<IconName, ReactNode> = {
  video: (
    <>
      <rect x="2" y="5" width="14" height="14" rx="3" />
      <path d="m16 10 6-4v12l-6-4" />
    </>
  ),
  chat: (
    <>
      <path d="M21 11.4a8.6 8.6 0 0 1-9 8.3 10 10 0 0 1-4.8-1.3L2 20l1.7-4.7A8.5 8.5 0 0 1 3 11.4 8.9 8.9 0 0 1 12 3a8.9 8.9 0 0 1 9 8.4Z" />
      <path d="M7.5 10h9M7.5 13.7h6" />
    </>
  ),
  book: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  link: (
    <>
      <path d="M10 13.5a5 5 0 0 0 7.5.5l2-2A5 5 0 0 0 12.4 5l-1.2 1.2" />
      <path d="M14 10.5a5 5 0 0 0-7.5-.5l-2 2A5 5 0 0 0 11.6 19l1.2-1.2" />
    </>
  ),
  sparkle: (
    <>
      <path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z" />
      <path d="m19 2 .8 2.2L22 5l-2.2.8L19 8l-.8-2.2L16 5l2.2-.8L19 2Z" />
    </>
  ),
  chart: (
    <>
      <path d="M3 20h18M5 16l5-5 4 3 6-8" />
      <path d="M16 6h4v4" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="9" cy="6" r="2" fill="#fff" />
      <circle cx="16" cy="12" r="2" fill="#fff" />
      <circle cx="10" cy="18" r="2" fill="#fff" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="7.5" />
      <path d="m16.5 16.5 5 5" />
      <path d="M7 11h7M10.5 7.5v7" />
    </>
  ),
  brain: (
    <>
      <path d="M12 5.8C9.8 2 4.5 3.8 4.5 7.5a4.5 4.5 0 0 0 0 8.2C4 19 7.5 22 11 19V6c0-3-5-2-5 1" />
      <path d="M12 5.8c2.2-3.8 7.5-2 7.5 1.7a4.5 4.5 0 0 1 0 8.2C20 19 16.5 22 13 19V6c0-3 5-2 5 1" />
    </>
  ),
  check: <path d="m4 12 5 5L20 6" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  mouse: (
    <>
      <rect x="6" y="2" width="12" height="19" rx="6" />
      <path d="M12 6v5" />
    </>
  ),
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

/** Each capability's icon, in the tab and beside the headline. */
export const FEATURE_ICONS: Record<FeatureKey, IconName> = {
  social: "video",
  conversations: "chat",
  seo: "book",
  backlinks: "link",
  ai: "sparkle",
  marketing: "sliders",
  technical: "search",
  analytics: "chart",
  copilot: "brain",
};

/** A glyph the design draws as text (✳, ▶ ...): decoration, not words. */
const Glyph = ({ children }: { children: string }) => <span aria-hidden="true">{children}</span>;

/** The social queue's rows: platform tile, then the status pill's colour (Ready, Review, Ready, Scheduled). */
const SOCIAL_ROWS = [
  { tile: "IG", platform: "", pill: "green" },
  { tile: "TK", platform: "tk", pill: "orange" },
  { tile: "YT", platform: "yt", pill: "green" },
  { tile: "f", platform: "fb", pill: "violet" },
] as const;

function SocialScene({ t }: { t: FeaturesCopy["social"] }) {
  return (
    <div className={c("scene social-scene")}>
      <div className={c("poster")}>
        <div className={c("poster-top")}>
          {t.posterTop} <span className={c("poster-asterisk")} aria-hidden="true">✳</span>
        </div>
        <div className={c("poster-big")}>
          {t.poster[0]} <br />
          {t.poster[1]}
        </div>
        <div className={c("poster-bottom")}>
          <span>{t.format}</span>
          <span className={c("poster-play")} aria-hidden="true">
            ▶
          </span>
        </div>
      </div>
      <div className={c("queue")}>
        <div className={c("queue-head")}>
          <b>{t.queueTitle}</b>
          <span>{t.queueCount}</span>
        </div>
        {t.rows.map(([name, detail, status], i) => (
          <div key={name} className={c("queue-row")}>
            <span className={c(`platform-ic ${SOCIAL_ROWS[i].platform}`)} aria-hidden="true">
              {SOCIAL_ROWS[i].tile}
            </span>
            <span>
              <b>{name}</b>
              <small>{detail}</small>
            </span>
            <span className={c(`pill ${SOCIAL_ROWS[i].pill}`)}>{status}</span>
          </div>
        ))}
        <div className={c("queue-footer")}>
          <Icon name="check" size={13} /> {t.footer}
        </div>
      </div>
    </div>
  );
}

function ConversationScene({ t }: { t: FeaturesCopy["conversations"] }) {
  return (
    <div className={c("scene conversation-scene")}>
      <div className={c("card conversation-card")}>
        <div className={c("conversation-source")}>
          <span className={c("platform-ic reddit")} aria-hidden="true">
            R
          </span>{" "}
          Reddit <small>{t.sourceNote}</small>
        </div>
        <div className={c("conversation-question")}>{t.question}</div>
        <div className={c("muted")}>{t.fit}</div>
        <div className={c("reply-box")}>
          <b>
            <Glyph>✳ </Glyph>
            {t.replyLabel}
          </b>
          <p>{t.reply}</p>
        </div>
        <span className={c("pill orange pill-start")}>{t.status}</span>
      </div>
      <div className={c("conversation-right")}>
        <div className={c("card")}>
          <div className={c("eyebrow-row")}>
            <b>{t.queue}</b>
            <span className={c("pill green")}>{t.found}</span>
          </div>
          <p>{t.queueText}</p>
        </div>
        {t.rows.map(([title, detail]) => (
          <div key={title} className={c("card")}>
            <b>{title}</b>
            <p>{detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArticleScene({ t }: { t: FeaturesCopy["seo"] }) {
  return (
    <div className={c("scene article-scene")}>
      <div className={c("card editor")}>
        <span className={c("doc-crumb")}>{t.crumb}</span>
        <strong className={c("doc-title")}>{t.title}</strong>
        <div className={c("doc-abstract")}>{t.abstract}</div>
        <strong className={c("doc-sections")}>{t.sections}</strong>
        <span className={c("fake-line")} />
        <span className={c("fake-line w80")} />
        <span className={c("fake-line")} />
        <span className={c("fake-line w55")} />
        <span className={c("pill green pill-end")}>{t.status}</span>
      </div>
      <div className={c("editor-right")}>
        <div className={c("card")}>
          <div className={c("eyebrow-row")}>
            <b>{t.cluster}</b>
            <span className={c("pill violet")}>SEO</span>
          </div>
          <div className={c("keyword-list")}>
            {t.keywords.map((keyword) => (
              <span key={keyword} className={c("pill")}>
                {keyword}
              </span>
            ))}
          </div>
        </div>
        <div className={c("card editor-calendar")}>
          <b>{t.calendar}</b>
          <strong>07</strong>
          <small>{t.calendarNote}</small>
          <span className={c("calendar-bars")} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
      </div>
    </div>
  );
}

function BacklinkScene({ t }: { t: FeaturesCopy["backlinks"] }) {
  const [one, two, centre, three, four] = t.nodes;
  return (
    <div className={c("scene backlink-scene")}>
      <div className={c("network")}>
        <svg className={c("lines")} viewBox="0 0 440 300" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="rgf-link-gradient">
              <stop stopColor="#ffae83" />
              <stop offset="1" stopColor="#c7a5ff" />
            </linearGradient>
          </defs>
          <g stroke="url(#rgf-link-gradient)" strokeWidth="1.5" strokeDasharray="5 7" fill="none">
            <path d="M203 148 67 58M203 148 367 60M203 148 75 239M203 148 350 237" />
          </g>
          <g fill="#ffc1a9">
            <circle cx="67" cy="58" r="3" />
            <circle cx="367" cy="60" r="3" />
            <circle cx="75" cy="239" r="3" />
            <circle cx="350" cy="237" r="3" />
          </g>
        </svg>
        <div className={c("node one")}>
          <Glyph>✦</Glyph> <span>{one}</span>
        </div>
        <div className={c("node two")}>
          <Glyph>✧</Glyph> <span>{two}</span>
        </div>
        <div className={c("node main-node")}>
          <Glyph>✳</Glyph> {centre}
        </div>
        <div className={c("node three")}>
          <Glyph>✦</Glyph> <span>{three}</span>
        </div>
        <div className={c("node four")}>
          <Glyph>✧</Glyph> <span>{four}</span>
        </div>
        <div className={c("network-foot")}>{t.foot}</div>
      </div>
      <div className={c("card placement")}>
        <div className={c("placement-head")}>
          <div>
            <div className={c("mini-label")}>{t.kicker}</div>
            <strong className={c("placement-title")}>{t.title}</strong>
          </div>
          <span className={c("pill violet")}>{t.pill}</span>
        </div>
        <div className={c("quality-card")}>
          <div className={c("quality-ring")} aria-hidden="true">
            ✓
          </div>
          <div className={c("copy")}>
            <b>{t.quality}</b>
            <small>{t.qualityNote}</small>
          </div>
        </div>
        <div className={c("step-list")}>
          <div className={c("step-line")}>
            <span className={c("step-dot")} aria-hidden="true">
              ✓
            </span>{" "}
            {t.steps[0]}
          </div>
          <div className={c("step-line")}>
            <span className={c("step-dot")} aria-hidden="true">
              ✓
            </span>{" "}
            {t.steps[1]}
          </div>
          <div className={c("step-line")}>
            <span className={c("step-dot future")} aria-hidden="true">
              3
            </span>{" "}
            {t.steps[2]}
          </div>
        </div>
        <div className={c("notice")}>
          <Icon name="check" size={14} /> {t.notice}
        </div>
      </div>
    </div>
  );
}

function AiScene({ t }: { t: FeaturesCopy["ai"] }) {
  return (
    <div className={c("scene ai-scene")}>
      <div className={c("card answer")}>
        <div className={c("answer-head")}>
          <div className={c("answer-logo")}>
            <span aria-hidden="true">✳</span> {t.answerTitle}
          </div>
          <span className={c("pill violet")}>{t.illustration}</span>
        </div>
        <div className={c("question")}>{t.question}</div>
        <div className={c("mini-label")}>{t.sample}</div>
        <p>{t.answer}</p>
        <div className={c("mention")}>
          <span className={c("mention-symbol")}>
            <Icon name="link" size={16} />
          </span>
          <span>
            <b>{t.domain}</b>
            <small>{t.domainNote}</small>
          </span>
          <span className={c("mention-badge")}>{t.citation}</span>
        </div>
      </div>
      <div className={c("ai-ops")}>
        <div className={c("ai-ops-top")}>
          <b>{t.opsTitle}</b>
          <small>{t.opsText}</small>
        </div>
        {t.rows.map(([name, detail]) => (
          <div key={name} className={c("ai-search-row")}>
            <b>{name}</b>
            <small>{detail}</small>
            <span className={c("small-mark")} aria-hidden="true" />
          </div>
        ))}
      </div>
    </div>
  );
}

function OptimizationScene({ t }: { t: FeaturesCopy["marketing"] }) {
  return (
    <div className={c("scene optimization-scene")}>
      <div className={c("card before-after")}>
        <div className={c("eyebrow-row")}>
          <b>{t.review}</b>
          <span className={c("pill orange")}>{t.found}</span>
        </div>
        <div className={c("example-site")}>
          <span>{t.siteLabel}</span>
          <strong>
            {t.site[0]} <br />
            {t.site[1]}
          </strong>
          <small>{t.siteText}</small>
          <div className={c("example-cta")} aria-hidden="true" />
        </div>
      </div>
      <div className={c("fix-list")}>
        {t.fixes.map(([title, detail], i) => (
          <div key={title} className={c("card")}>
            <span className={c("fix-check")}>
              <Icon name="check" size={12} />
            </span>
            <b>
              0{i + 1} · {title}
            </b>
            <small>{detail}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function TechnicalScene({ t }: { t: FeaturesCopy["technical"] }) {
  return (
    <div className={c("scene technical-scene")}>
      <div className={c("card technical-panel")}>
        <div className={c("mini-label")}>{t.kicker}</div>
        <strong className={c("technical-title")}>{t.title}</strong>
        {t.rows.map(([title, detail]) => (
          <div key={title} className={c("tech-row")}>
            <span className={c("tech-icon")}>
              <Icon name="check" size={13} />
            </span>
            <span>
              <b>{title}</b>
              <small>{detail}</small>
            </span>
            <span className={c("pill orange")}>{t.review}</span>
          </div>
        ))}
      </div>
      <div className={c("technical-side")}>
        <div className={c("scorebox")}>
          <span>{t.scoreLabel}</span>
          <strong>
            91<span> / 100</span>
          </strong>
          <small>{t.scoreText}</small>
        </div>
        <div className={c("card")}>
          <Icon name="chart" size={15} /> {t.first}
        </div>
      </div>
    </div>
  );
}

function AnalyticsScene({ t }: { t: FeaturesCopy["analytics"] }) {
  return (
    <div className={c("scene analytic-scene")}>
      <div className={c("card graph-panel")}>
        <div className={c("graph-head")}>
          <div>
            <b>{t.graphTitle}</b>
            <small>{t.graphNote}</small>
          </div>
          <span className={c("pill green")}>{t.trend}</span>
        </div>
        <div className={c("graph-number")}>
          {t.value} <span>{t.change}</span>
        </div>
        <div className={c("chart-space")}>
          <svg viewBox="0 0 520 170" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="rgf-area-fill" x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#ff8b73" stopOpacity=".33" />
                <stop offset="1" stopColor="#ff8b73" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="rgf-trend-stroke">
                <stop stopColor="#f29e7f" />
                <stop offset="1" stopColor="#a27ce4" />
              </linearGradient>
            </defs>
            <g stroke="#eeedf1" strokeWidth="1">
              <path d="M5 31H515M5 71H515M5 111H515M5 151H515" />
            </g>
            <path
              d="M5 145C41 138 53 156 94 125S151 137 186 103S255 126 297 77S347 91 386 53S440 66 515 16V170H5Z"
              fill="url(#rgf-area-fill)"
            />
            <path
              d="M5 145C41 138 53 156 94 125S151 137 186 103S255 126 297 77S347 91 386 53S440 66 515 16"
              fill="none"
              stroke="url(#rgf-trend-stroke)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx="515" cy="16" r="6" fill="#a27ce4" stroke="white" strokeWidth="3" />
          </svg>
        </div>
        <div className={c("chart-labels")}>
          {t.weeks.map((week) => (
            <span key={week}>{week}</span>
          ))}
        </div>
      </div>
      <div className={c("metric-cards")}>
        <div className={c("card metric")}>
          <div className={c("top")}>
            <Icon name="search" size={13} /> {t.search}
          </div>
          <div className={c("number")}>{t.searchValue}</div>
          <small>{t.searchNote}</small>
        </div>
        <div className={c("card metric")}>
          <div className={c("top")}>
            <Icon name="sparkle" size={13} /> {t.ai}
          </div>
          <div className={c("number")}>07</div>
          <small>{t.aiNote}</small>
        </div>
        <div className={c("card metric recommendation")}>
          <strong>
            <Glyph>✳ </Glyph>
            {t.next}
          </strong>
          <small>{t.nextText}</small>
        </div>
      </div>
    </div>
  );
}

function CopilotScene({ t }: { t: FeaturesCopy["copilot"] }) {
  return (
    <div className={c("scene cmo-scene")}>
      <div className={c("card priority")}>
        <div className={c("mini-label")}>{t.kicker}</div>
        <strong className={c("priority-title")}>{t.title}</strong>
        {t.rows.map(([title, detail], i) => (
          <div key={title} className={c("priority-row")}>
            <span className={c("priority-num")}>0{i + 1}</span>
            <span>
              <b>{title}</b>
              <small>{detail}</small>
            </span>
          </div>
        ))}
      </div>
      <div className={c("cmo-side")}>
        <b>{t.sideTitle}</b>
        <p>{t.sideText}</p>
        <div className={c("cmo-brand")} aria-hidden="true">
          ✳
        </div>
      </div>
    </div>
  );
}

/** One capability's preview, from the visitor's copy. */
export function FeatureScene({ feature, copy }: { feature: FeatureKey; copy: FeaturesCopy }) {
  switch (feature) {
    case "social":
      return <SocialScene t={copy.social} />;
    case "conversations":
      return <ConversationScene t={copy.conversations} />;
    case "seo":
      return <ArticleScene t={copy.seo} />;
    case "backlinks":
      return <BacklinkScene t={copy.backlinks} />;
    case "ai":
      return <AiScene t={copy.ai} />;
    case "marketing":
      return <OptimizationScene t={copy.marketing} />;
    case "technical":
      return <TechnicalScene t={copy.technical} />;
    case "analytics":
      return <AnalyticsScene t={copy.analytics} />;
    case "copilot":
      return <CopilotScene t={copy.copilot} />;
  }
}
