import Image from "next/image";
import Link from "next/link";

import { DEFAULT_LOCALE, localePath, type Locale } from "@/lib/i18n/config";
import { WEBSITE_CREATION_COPY } from "@/lib/marketing/website-creation/copy";

import { OneOpen } from "../_home/sections/faq-one-open";
import { ClosingStart, HeroStart, ProjectChoice, RegisterLink, StartSimilar } from "./website-start";
import styles from "./website-creation.module.css";

/** Pictures from the design, extracted and compressed: three small files, not 300 kB of inline base64. */
const IMAGES = {
  imageStudio: "/images/website-creation/image-studio.webp",
  aurenia: "/images/website-creation/aurenia-residences.webp",
  forme: "/images/website-creation/forme-objects.webp",
};

const STEP_MARKS = ["✉", "✎", "◈", "↗"];
const BENEFIT_MARKS = ["✦", "▣", "◎", "↗", "◈", "⊕"];
const CARD_SIZES = "(max-width: 700px) 100vw, (max-width: 1060px) 50vw, 400px";

function CaseBrowserTop({ domain, live }: { domain: string; live?: boolean }) {
  return (
    <div className={styles.caseBrowserTop}>
      <div className={styles.caseBrowserDots} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      {/* The concepts' domains are part of the picture: plain text, with no arrow suggesting a link. */}
      <span>{domain}</span>
      {live ? (
        <span className={styles.caseBrowserOpen} aria-hidden="true">
          ↗
        </span>
      ) : (
        <span className={styles.caseBrowserOpen} />
      )}
    </div>
  );
}

/**
 * /website-creation (client's design, RepGet_Website_Final.html, 2026-11-05), in
 * the site's own frame: the marketing layout supplies the real header, footer and
 * theme, so none of the design's mock menu, footer or scripts are here.
 *
 * Static apart from the small client parts in website-start.tsx.
 */
export function WebsiteCreationContent({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const t = WEBSITE_CREATION_COPY[locale];
  const signUpPath = localePath(locale, "/sign-up");

  return (
    <ProjectChoice>
      <div className={styles.page}>
        <section aria-labelledby="website-creation-title" className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.kicker}>
              <span aria-hidden="true" className={styles.kickerLine} />
              {t.hero.kicker}
              <span aria-hidden="true" className={styles.kickerLine} />
            </div>
            <h1 id="website-creation-title">
              {t.hero.title}
              <em>{t.hero.titleEm}</em>
            </h1>
            <p className={styles.intro}>
              <strong>{t.hero.introStrong}</strong> {t.hero.intro} <span>{t.hero.introLast}</span>
            </p>
            <HeroStart strings={t.hero} signUpPath={signUpPath} />
            <div aria-label={t.hero.stepsLabel} className={styles.steps} role="group">
              {t.hero.steps.map((step, index) => (
                <div key={step} className={styles.stepsGroup}>
                  {index > 0 ? <span aria-hidden="true" className={styles.stepDivider} /> : null}
                  <div className={styles.heroStep}>
                    <span className={styles.heroStepN}>{`0${index + 1}`}</span>
                    <span>{step}</span>
                  </div>
                </div>
              ))}
            </div>
            <a className={styles.scrollLink} href="#work">
              {t.hero.explore} <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div aria-hidden="true" className={styles.cornerNote}>
            {t.hero.corner}
          </div>
        </section>

        <div className={styles.heroNext}>
          <strong>{t.next.strong}</strong>
          <span>{t.next.items}</span>
          <a href="#process">
            {t.next.link} <span aria-hidden="true">↗</span>
          </a>
        </div>

        <section aria-label={t.strip.label} className={styles.strip}>
          <div className={`${styles.container} ${styles.stripGrid}`}>
            <div className={styles.stripIntro}>
              {t.strip.a} <span>{t.strip.b}</span> {t.strip.c}
            </div>
            {t.strip.items.map((item) => (
              <div key={item.title} className={styles.stripItem}>
                <strong>{item.title}</strong>
                <small>{item.body}</small>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="work-title" className={`${styles.section} ${styles.work}`} id="work">
          <div className={styles.container}>
            <div className={styles.sectionHead}>
              <div>
                <div className={styles.sectionKicker}>{t.work.kicker}</div>
                <h2 id="work-title">
                  {t.work.title} <em>{t.work.titleEm}</em>
                </h2>
              </div>
              <p>{t.work.body}</p>
            </div>
            <div className={styles.portfolioGrid}>
              <article className={styles.case}>
                <div className={styles.caseBrowser}>
                  <CaseBrowserTop domain="imagestudio.com" live />
                  <a aria-label={t.work.openImageStudio} className={styles.casePage} href="https://imagestudio.com/" rel="noopener noreferrer" target="_blank">
                    <Image src={IMAGES.imageStudio} alt="" fill sizes={CARD_SIZES} className={styles.caseImagePhoto} />
                    <span className={styles.caseImageShade} aria-hidden="true" />
                    <span className={styles.caseSiteTop} aria-hidden="true">
                      <span>IMAGE STUDIO</span>
                      <small>EDITORIAL · SERVICES · ABOUT · CONTACT</small>
                    </span>
                    <span className={styles.caseSiteMain} aria-hidden="true">
                      <small>ITALY / WORLDWIDE</small>
                      <b>
                        Stories with
                        <br />
                        <em>direction.</em>
                      </b>
                      <i>Photo, film &amp; creative production.</i>
                    </span>
                    <span className={styles.caseLiveChip}>{t.work.liveChip}</span>
                  </a>
                </div>
                <div className={styles.caseMeta}>
                  <div className={styles.caseSubrow}>
                    <span>{t.work.imageStudio.sub}</span>
                    <span className={styles.caseLiveLabel}>
                      <i aria-hidden="true" /> {t.work.realLabel}
                    </span>
                  </div>
                  <h3>Image Studio</h3>
                  <p>{t.work.imageStudio.body}</p>
                  <a href="https://imagestudio.com/" rel="noopener noreferrer" target="_blank">
                    {t.work.visit} <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </article>

              <article className={styles.case}>
                <div className={styles.caseBrowser}>
                  <CaseBrowserTop domain="aurenia-residences.com" />
                  <div aria-label={t.work.aurenia.alt} className={styles.casePage} role="img">
                    <Image src={IMAGES.aurenia} alt="" fill sizes={CARD_SIZES} loading="lazy" className={styles.caseImagePhoto} />
                    <span className={styles.hotelShade} aria-hidden="true" />
                    <span className={styles.hotelTop} aria-hidden="true">
                      <span>
                        aurenia <small>RESIDENCES</small>
                      </span>
                      <b>BOOK A STAY</b>
                    </span>
                    <span className={styles.hotelCopy} aria-hidden="true">
                      <small>01 / AN ITALIAN HIDEAWAY</small>
                      <b>
                        Some places
                        <br />
                        stay with you.
                      </b>
                      <i>Slow mornings. Exceptional stays.</i>
                    </span>
                    <span className={styles.conceptChip}>{t.work.conceptLabel}</span>
                  </div>
                </div>
                <div className={styles.caseMeta}>
                  <div className={styles.caseSubrow}>
                    <span>{t.work.aurenia.sub}</span>
                    <span>{t.work.conceptLabel}</span>
                  </div>
                  <h3>Aurenia Residences</h3>
                  <p>{t.work.aurenia.body}</p>
                  <StartSimilar className={styles.caseLink}>
                    {t.work.similar} <span aria-hidden="true">↗</span>
                  </StartSimilar>
                </div>
              </article>

              <article className={styles.case}>
                <div className={styles.caseBrowser}>
                  <CaseBrowserTop domain="atelier-forme.com" />
                  <div className={styles.casePage}>
                    <Image src={IMAGES.forme} alt={t.work.forme.alt} fill sizes={CARD_SIZES} loading="lazy" className={styles.caseImagePhoto} />
                    <span className={styles.conceptChip}>{t.work.conceptLabel}</span>
                  </div>
                </div>
                <div className={styles.caseMeta}>
                  <div className={styles.caseSubrow}>
                    <span>{t.work.forme.sub}</span>
                    <span>{t.work.conceptLabel}</span>
                  </div>
                  <h3>Forme Objects</h3>
                  <p>{t.work.forme.body}</p>
                  <StartSimilar className={styles.caseLink}>
                    {t.work.similar} <span aria-hidden="true">↗</span>
                  </StartSimilar>
                </div>
              </article>
            </div>
            <p className={styles.honesty}>{t.work.honesty}</p>
          </div>
        </section>

        <section aria-labelledby="process-title" className={`${styles.section} ${styles.process}`} id="process">
          <div className={styles.container}>
            <div className={styles.sectionHead}>
              <div>
                <div className={styles.sectionKicker}>{t.process.kicker}</div>
                <h2 id="process-title">
                  {t.process.title}
                  <br />
                  <em>{t.process.titleEm}</em>
                </h2>
              </div>
              <p>{t.process.body}</p>
            </div>
            <div className={styles.stepsGrid}>
              {t.process.steps.map((step, index) => (
                <div key={step.index} className={styles.step}>
                  <div className={styles.stepIndex}>{step.index}</div>
                  <div className={styles.stepMark} aria-hidden="true">
                    {STEP_MARKS[index]}
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="credits-title" className={`${styles.section} ${styles.dashboardSection}`} id="credits">
          <div className={`${styles.container} ${styles.dashboardGrid}`}>
            <div>
              <div className={styles.sectionKicker}>{t.credits.kicker}</div>
              <h2 id="credits-title">
                {t.credits.title} <em>{t.credits.titleEm}</em>
              </h2>
              <p className={styles.sub}>{t.credits.sub}</p>
              <ul className={styles.dashboardBullets}>
                {t.credits.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              <RegisterLink className={styles.linkOrange} signUpPath={signUpPath}>
                {t.credits.link} <span aria-hidden="true">↗</span>
              </RegisterLink>
            </div>
            <div>
              {/* A drawing of the feature, not data: it says so twice, and it shows no price. */}
              <div aria-label={t.credits.demoLabel} className={styles.dashboardDemo} role="img">
                <div className={styles.dTop}>
                  <div className={styles.dBrand}>
                    RepGet<span>.</span>
                  </div>
                  <span className={styles.dBadge}>{t.credits.demoBadge}</span>
                </div>
                <div className={styles.dBody}>
                  <div className={styles.dSidebar}>
                    {t.credits.demoNav.map((item, index) => (
                      <div key={item} className={`${styles.dMenu} ${index === 1 ? styles.dMenuActive : ""}`}>
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className={styles.dContent}>
                    <div className={styles.dContentHead}>
                      <strong>{t.credits.demoHead}</strong>
                      <span>{t.credits.demoSub}</span>
                    </div>
                    <div className={styles.dStatus}>
                      <span className={styles.dDot} />
                      <b>{t.credits.demoStatus}</b>
                      <small>{t.credits.demoExample}</small>
                    </div>
                    <div className={styles.dDetails}>
                      <div className={styles.dDetail}>
                        <span>{t.credits.demoCreditsLabel}</span>
                        <strong>{t.credits.demoCreditsValue}</strong>
                      </div>
                      <div className={styles.dDetail}>
                        <span>{t.credits.demoProjectLabel}</span>
                        <strong>{t.credits.demoProjectValue}</strong>
                      </div>
                    </div>
                    <div className={styles.dProgress}>
                      <i />
                    </div>
                    <div className={styles.dFoot}>{t.credits.demoFoot}</div>
                  </div>
                </div>
              </div>
              <div className={styles.dCaption}>{t.credits.demoCaption}</div>
            </div>
          </div>
        </section>

        <section aria-labelledby="included-title" className={`${styles.section} ${styles.included}`} id="included">
          <div className={styles.container}>
            <div className={styles.sectionHead}>
              <div>
                <div className={styles.sectionKicker}>{t.included.kicker}</div>
                <h2 id="included-title">
                  {t.included.title}
                  <br />
                  <em>{t.included.titleEm}</em>
                </h2>
              </div>
              <p>{t.included.body}</p>
            </div>
            <div className={styles.includedGrid}>
              {t.included.items.map((item, index) => (
                <article key={item.title} className={styles.benefit}>
                  <div className={styles.benefitIcon} aria-hidden="true">
                    {BENEFIT_MARKS[index]}
                  </div>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="faq-title" className={`${styles.section} ${styles.faqSection}`} id="faq">
          <div className={`${styles.container} ${styles.faqGrid}`}>
            <div className={styles.faqLeft}>
              <div className={styles.sectionKicker}>{t.faq.kicker}</div>
              <h2 id="faq-title">{t.faq.title}</h2>
              <p>{t.faq.body}</p>
              <Link href={localePath(locale, "/contact")} prefetch={false}>
                {t.faq.contact} <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.faqList}>
              {t.faq.items.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
            <OneOpen sectionId="faq" />
          </div>
        </section>

        <section className={styles.bottomCta} aria-labelledby="closing-title">
          <div className={styles.container}>
            <div className={styles.ctaPanel}>
              <div>
                <div className={styles.sectionKicker}>{t.cta.kicker}</div>
                <h2 id="closing-title">
                  {t.cta.title} <em>{t.cta.titleEm}</em>
                </h2>
                <p>{t.cta.body}</p>
              </div>
              <div className={styles.ctaFormArea}>
                <ClosingStart strings={t.hero} submit={t.cta.submit} label={t.cta.formLabel} signUpPath={signUpPath} />
                <small>
                  {t.cta.noteBefore}{" "}
                  <RegisterLink signUpPath={signUpPath}>{t.cta.noteLink}</RegisterLink>. {t.cta.noteAfter}
                </small>
              </div>
            </div>
          </div>
        </section>
      </div>
    </ProjectChoice>
  );
}
