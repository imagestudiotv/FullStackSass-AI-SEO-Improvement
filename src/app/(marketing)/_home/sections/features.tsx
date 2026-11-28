import Link from "next/link";
import { Fragment } from "react";

import { withAssistants } from "@/lib/geo/engine-words";
import { FEATURE_HIGHLIGHTS, FEATURE_KEYS, featuresCopy } from "@/lib/i18n/home/features";

import { FeaturesShell } from "../features-shell";
import type { SectionProps } from "../types";

import { FEATURE_ICONS, FeatureScene, Icon } from "./features-scenes";
import styles from "./features.module.css";

/** The design's class names, hyphens and all, mapped to the module's. */
const c = (names: string) =>
  names
    .split(" ")
    .map((n) => styles[n] ?? n)
    .join(" ");

const HEADING_ID = "home-features-heading";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "Top features" (client's design, 2026-11-18, repget_features_premium.html):
 * the dark feature shell - nine capabilities on the left, the chosen one's
 * headline, a drawn product preview, its perks, "Start free trial" and the
 * next-feature button, and on desktop a scroll story through four highlights
 * (features-shell.tsx). It replaced the 2026-11-03 selector and its mascot.
 *
 * Everything is drawn here, on the server, in the visitor's language; the
 * client shell only chooses which panel shows. The wording is the design's
 * except where it claimed more than RepGet does (lib/i18n/home/features.ts).
 *
 * The id stays `features`: the header's links and the Social tool point at
 * /#features.
 */
export function Features({ locale, href }: SectionProps) {
  // {assistants}: the ones this deployment asks, filled in here on the server (lib/geo/engine-words.ts).
  const t = withAssistants(featuresCopy(locale), locale);
  const total = pad(FEATURE_KEYS.length);

  return (
    <section id="features" className={c("repget-features")} aria-labelledby={HEADING_ID}>
      <div className={c("repget-features-inner")}>
        <FeaturesShell
          headingId={HEADING_ID}
          navTop={
            <div className={c("nav-top")}>
              <h2 id={HEADING_ID} className={c("nav-eyebrow")}>
                {t.eyebrow}
              </h2>
              <span className={c("nav-count")}>{t.count}</span>
            </div>
          }
          navBottom={
            <div className={c("nav-bottom")}>
              <span className={c("pulse")}>
                <Icon name="sparkle" size={17} />
              </span>
              <span>
                <b>{t.engineTitle}</b>
                {t.engineLine}
              </span>
            </div>
          }
          tabs={FEATURE_KEYS.map((key) => (
            <Fragment key={key}>
              <span className={c("nav-ic")}>
                <Icon name={FEATURE_ICONS[key]} />
              </span>
              <span className={c("nav-txt")}>
                <strong>{t[key].nav}</strong>
                <small>{t[key].navSub}</small>
              </span>
              <span className={c("nav-arrow")}>
                <Icon name="arrow" size={15} />
              </span>
            </Fragment>
          ))}
          panels={FEATURE_KEYS.map((key, i) => {
            const f = t[key];
            return (
              <Fragment key={key}>
                <div className={c("main-top")}>
                  <div className={c("breadcrumb")}>
                    <i className={c("indicator")} aria-hidden="true" /> <span>{t.workspace}</span>
                    <span className={c("breadcrumbs-divider")} aria-hidden="true">
                      /
                    </span>
                    <span className={c("current-category")}>{f.category}</span>
                  </div>
                  <div className={c("switch-counter")}>
                    <span>
                      <b>{pad(i + 1)}</b> / {total}
                    </span>
                    <span className={c("line")} aria-hidden="true" />
                  </div>
                </div>
                <div className={c("intro")}>
                  <div>
                    <h3>
                      {f.headline[0]} <br />
                      <span className={c("impact")}>{f.headline[1]}</span>
                    </h3>
                    <p>{f.description}</p>
                  </div>
                  <div className={c("intro-aside")}>
                    <span className={c("cap-icon")}>
                      <Icon name={FEATURE_ICONS[key]} size={26} />
                    </span>
                    <span>{f.tag}</span>
                  </div>
                </div>
                <div className={c("preview")}>
                  <div className={c("mock-window")}>
                    <div className={c("mock-bar")}>
                      <div className={c("mock-bar-left")}>
                        <span className={c("mock-dots")} aria-hidden="true">
                          <i />
                          <i />
                          <i />
                        </span>
                        <span className={c("mock-app-name")}>
                          <span className={c("mock-logo")} aria-hidden="true">
                            ✳
                          </span>
                          <span>{f.studio}</span>
                        </span>
                      </div>
                      <span className={c("mock-bar-right")}>
                        <span className={c("preview-long")}>{t.preview}</span>
                        <span className={c("preview-short")}>{t.previewShort}</span>
                      </span>
                    </div>
                    <div className={c("mock-body")}>
                      <FeatureScene feature={key} copy={t} />
                    </div>
                  </div>
                </div>
              </Fragment>
            );
          })}
          perks={FEATURE_KEYS.map((key) =>
            t[key].perks.map((perk) => (
              <span key={perk} className={c("perk")}>
                <Icon name="check" size={13} /> {perk}
              </span>
            )),
          )}
          labels={FEATURE_KEYS.map((key) => t[key].nav)}
          highlights={FEATURE_HIGHLIGHTS}
          highlightsLabel={t.highlights}
          jump={t.jump}
          scrollNote={
            <>
              <Icon name="mouse" size={15} /> {t.scroll}
            </>
          }
          cta={
            <Link className={c("primary")} href={href("/pricing")}>
              {t.cta} <span aria-hidden="true">↗</span>
            </Link>
          }
          next={t.next}
        />
      </div>
    </section>
  );
}
