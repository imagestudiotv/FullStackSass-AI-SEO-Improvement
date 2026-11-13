import {
  AlertCircle,
  AppWindow,
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  FileText,
  Globe,
  Link2,
  List,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import { PUBLIC_AUDIT_MAX_PAGES } from "@/lib/audit/limits";
import { auditLandingCopy, type AuditLandingCopy } from "@/lib/i18n/audit-landing";
import { localePath, type Locale } from "@/lib/i18n/config";
import { TRIAL_DAYS } from "@/lib/plans/features";

import styles from "./audit-landing.module.css";
import { AuditSampleTabs } from "./audit-sample-tabs";
import { AUDIT_FIELD_ID, AuditFocusLink, AuditStartForm } from "./audit-start-form";
import { plural } from "./plural";

/** The copy's **bold** runs. */
function Bold({ text }: { text: string }) {
  return text.split("**").map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : <Fragment key={index}>{part}</Fragment>));
}

function Assurances({ items }: { items: readonly string[] }) {
  return (
    <div className={styles.assurances}>
      {items.map((item) => (
        <span key={item}>
          <Check aria-hidden="true" />
          {item}
        </span>
      ))}
    </div>
  );
}

function Mark({ size = 20 }: { size?: number }) {
  return <Image src="/images/repget-mark.png" alt="" width={size} height={size} className={styles.mark} />;
}

/**
 * The hero's picture of a report: decoration with one accessible name, which
 * says it is an illustration, and "example" written on it four times over.
 */
function HeroDevice({ t }: { t: AuditLandingCopy["device"] }) {
  return (
    <div className={styles.visual} role="img" aria-label={t.label}>
      <div className={styles.visualLabel}>
        <span />
        {t.label}
      </div>
      <div className={styles.device}>
        <div className={styles.deviceChrome}>
          <div className={styles.dots}>
            <i />
            <i />
            <i />
          </div>
          <div className={styles.address}>{t.address}</div>
          <div className={styles.deviceTag}>{t.tag}</div>
        </div>
        <div className={styles.deviceUi}>
          <div className={styles.rail}>
            <span className={styles.railLogo}>
              <Mark size={18} />
            </span>
            <span className={`${styles.railIcon} ${styles.railIconOn}`}>
              <BarChart3 />
            </span>
            <span className={styles.railIcon}>
              <Search />
            </span>
            <span className={styles.railIcon}>
              <Bot />
            </span>
            <span className={styles.railIcon}>
              <FileText />
            </span>
          </div>
          <div className={styles.deviceBody}>
            <div className={styles.deviceHeading}>
              <div>
                <small>{t.small}</small>
                <b>{t.title}</b>
              </div>
              <span className={styles.devicePill}>
                <i />
                {t.pill}
              </span>
            </div>
            <div className={styles.deviceCards}>
              <div className={styles.deviceScore}>
                <div className={styles.scoreCircle}>
                  <span>
                    <b>72</b>
                    <small>/ 100</small>
                  </span>
                </div>
                <div className={styles.scoreLabel}>
                  <b>{t.scoreTitle}</b>
                  {t.scoreBody}
                </div>
              </div>
              <div className={styles.deviceStats}>
                <div className={styles.deviceStat}>
                  <div>
                    <small>{t.searchLabel}</small>
                    <b>{t.searchValue}</b>
                  </div>
                  <span>{t.searchTag}</span>
                </div>
                <div className={styles.deviceStat}>
                  <div>
                    <small>{t.aiLabel}</small>
                    <b>{t.aiValue}</b>
                  </div>
                  <span className={styles.good}>{t.aiTag}</span>
                </div>
              </div>
            </div>
            <div className={styles.deviceChart}>
              <div className={styles.chartTitle}>
                <b>{t.chartTitle}</b>
                <small>{t.chartNote}</small>
              </div>
              <svg className={styles.graph} viewBox="0 0 460 80" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0 66H460M0 38H460M0 10H460" stroke="currentColor" strokeOpacity=".15" strokeDasharray="4 5" />
                <path d="M0 64C35 63 55 58 77 59S126 63 153 44 196 55 232 43 267 42 299 27 344 37 378 19 420 28 460 6V80H0Z" fill="#f9bd9b" fillOpacity=".18" />
                <path d="M0 64C35 63 55 58 77 59S126 63 153 44 196 55 232 43 267 42 299 27 344 37 378 19 420 28 460 6" fill="none" stroke="#f0794c" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <div className={styles.chartTags}>
                <span>
                  <i />
                  {t.chartTags[0]}
                </span>
                <span>
                  <i />
                  {t.chartTags[1]}
                </span>
              </div>
            </div>
            <div className={styles.deviceFooter}>
              <span>
                <ShieldCheck />
                {t.footerLeft}
              </span>
              <span>{t.footerRight}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelTop({ eyebrow, title, body, domain }: { eyebrow: string; title: string; body: string; domain: string }) {
  return (
    <div className={styles.panelTop}>
      <div>
        <p className={styles.panelEyebrow}>{eyebrow}</p>
        <h3>{title}</h3>
        <p className={styles.panelBody}>{body}</p>
      </div>
      <div className={styles.fakeDomain}>
        <Globe aria-hidden="true" />
        {domain}
      </div>
    </div>
  );
}

/** The sample report's four panels. Scores and statuses are illustrative, and each panel says so. */
function samplePanels(t: AuditLandingCopy["report"]): ReactNode[] {
  const issueIcons = [AlertCircle, FileText, Bot];
  const tileIcons = [Search, Bot];
  const scores = [58, 72, 84, 64];

  return [
    <Fragment key="overview">
      <PanelTop eyebrow={t.overview.eyebrow} title={t.overview.title} body={t.overview.body} domain={t.domain} />
      <div className={styles.summary}>
        <div className={styles.summaryScore}>
          <span className={styles.summaryRing}>
            <span>72</span>
            <small>/ 100</small>
          </span>
          <div>
            <h4>{t.overview.scoreTitle}</h4>
            <p>{t.overview.scoreBody}</p>
          </div>
        </div>
        {t.overview.tiles.map((tile, index) => {
          const Icon = tileIcons[index];
          return (
            <div key={tile.title} className={styles.summaryTile}>
              <span className={styles.tileIcon} aria-hidden="true">
                <Icon />
              </span>
              <h4>{tile.title}</h4>
              <p>{tile.body}</p>
              <span className={styles.tinyState}>{tile.state}</span>
            </div>
          );
        })}
      </div>
      <div className={styles.issuesTitle}>
        <strong>{t.overview.issuesTitle}</strong>
        <span>{t.overview.issuesNote}</span>
      </div>
      {t.overview.issues.map((issue, index) => {
        const Icon = issueIcons[index];
        return (
          <div key={issue.title} className={styles.issueRow}>
            <span className={styles.issueMarker} aria-hidden="true">
              <Icon />
            </span>
            <div>
              <strong>{issue.title}</strong>
              <small>{issue.body}</small>
            </div>
            <span className={styles.issueTag}>{issue.tag}</span>
          </div>
        );
      })}
    </Fragment>,

    <Fragment key="seo">
      <PanelTop eyebrow={t.seo.eyebrow} title={t.seo.title} body={t.seo.body} domain={t.domain} />
      <div className={styles.detail}>
        <div className={styles.detailCard}>
          <h4>{t.seo.cardTitle}</h4>
          <p>{t.seo.cardBody}</p>
          {t.seo.bars.map((bar, index) => (
            <div key={bar} className={styles.progress}>
              <div className={styles.progressHead}>
                <span>{bar}</span>
                <span>{scores[index]} / 100</span>
              </div>
              <div className={styles.progressLine}>
                <b style={{ width: `${scores[index]}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className={`${styles.detailCard} ${styles.detailPlain}`}>
          <h4>{t.seo.checksTitle}</h4>
          {t.seo.checks.map((check, index) => (
            <div key={check} className={styles.seoCheck}>
              <span>
                {index < 2 ? <AlertCircle aria-hidden="true" /> : <Check aria-hidden="true" />}
                {check}
              </span>
              <small className={index < 2 ? undefined : styles.pass}>{index < 2 ? t.seo.toFix : t.seo.passed}</small>
            </div>
          ))}
        </div>
      </div>
    </Fragment>,

    <Fragment key="ai">
      <PanelTop eyebrow={t.ai.eyebrow} title={t.ai.title} body={t.ai.body} domain={t.domain} />
      <div className={styles.detail}>
        <div className={`${styles.detailCard} ${styles.detailPlain}`}>
          <h4>{t.ai.cardTitle}</h4>
          <p>{t.ai.cardBody}</p>
          <div className={styles.aiRows}>
            {t.ai.rows.map((row, index) => (
              <div key={row} className={styles.aiRow}>
                <span>
                  <i aria-hidden="true">{["G", "C", "P", "AI"][index]}</i>
                  {row}
                </span>
                <small>{index < 3 ? t.ai.reviewRobots : t.ai.checkHtml}</small>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.aiNote}>
          <Sparkles aria-hidden="true" />
          <h4>{t.ai.noteTitle}</h4>
          <p>{t.ai.noteBody}</p>
        </div>
      </div>
    </Fragment>,

    <Fragment key="actions">
      <PanelTop eyebrow={t.actions.eyebrow} title={t.actions.title} body={t.actions.body} domain={t.domain} />
      {t.actions.items.map((item, index) => (
        <div key={item.title} className={styles.actionItem}>
          <span className={styles.actionNo}>0{index + 1}</span>
          <div>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </div>
          <small>{index === 0 ? t.actions.first : index === 3 ? t.actions.ongoing : t.actions.next}</small>
        </div>
      ))}
    </Fragment>,
  ];
}

/**
 * The free audit's landing page (client's design, 2026-11-05,
 * RepGet_Audit_White_Spotlight.html), shown at /audit and its translations
 * until a website is entered. Under the site's own header and footer, not the
 * design's.
 *
 * Both forms and every "check my website" link lead to the real check: the form
 * only navigates to ?domain=, and audit-page.tsx runs it as before. Nothing on
 * this page runs an audit or shows a result; the report here is a labelled
 * sample. See lib/i18n/audit-landing/types.ts for where the words differ from
 * the design, and why.
 */
export function AuditLanding({ locale }: { locale: Locale }) {
  const t = auditLandingCopy(locale);
  const action = localePath(locale, "/audit");
  const inclusionIcons = [Search, BarChart3, Bot];
  const scopeIcons = [Search, Bot, AppWindow, List];
  const checkIcons = [Search, Bot, FileText, List];
  const taskIcons = [Search, FileText, Link2, BarChart3];
  const facts = (text: string) => text.replaceAll("{pages}", String(PUBLIC_AUDIT_MAX_PAGES)).replaceAll("{days}", String(TRIAL_DAYS));

  return (
    <div className={styles.page}>
      <section className={styles.hero} id="start" aria-labelledby="audit-hero-title">
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>
            <span aria-hidden="true">
              <Sparkles />
            </span>
            {t.hero.eyebrow}
          </p>
          <h1 id="audit-hero-title" className={styles.heroTitle}>
            {t.hero.titleLead}
            <br />
            {t.hero.titleBefore} <span className={styles.accent}>{t.hero.titleAccent}</span>
          </h1>
          <p className={styles.heroDescription}>
            <Bold text={t.hero.description} />
          </p>

          <div className={styles.inclusions}>
            <div className={styles.topline}>
              <span aria-hidden="true" />
              <h2>{t.hero.includedTitle}</h2>
              <span aria-hidden="true" />
            </div>
            <div className={styles.inclusionGrid}>
              {t.hero.inclusions.map((item, index) => {
                const Icon = inclusionIcons[index];
                return (
                  <article key={item.title} className={styles.inclusion}>
                    <div className={styles.inclusionTop}>
                      <span aria-hidden="true">
                        <Icon />
                      </span>
                      <h3>
                        <i>{index + 1}.</i> {item.title}
                      </h3>
                    </div>
                    <p>{item.body}</p>
                  </article>
                );
              })}
            </div>
            <div className={styles.conversion}>
              <div className={styles.conversionHead}>
                <span className={styles.conversionKicker}>
                  <Sparkles aria-hidden="true" />
                  {t.hero.startKicker}
                </span>
                <span className={styles.conversionNote}>
                  <Check aria-hidden="true" />
                  {t.hero.startConfidence}
                </span>
              </div>
              <AuditStartForm strings={t.form} action={action} placeholder={t.form.placeholder} id={AUDIT_FIELD_ID} />
            </div>
          </div>

          <Assurances items={t.hero.assurances} />
          <a className={styles.heroSecondary} href="#report">
            {t.hero.sampleLink}
            <ArrowRight aria-hidden="true" />
          </a>
        </div>
        <HeroDevice t={t.device} />
      </section>

      <div className={styles.scope}>
        <div className={`${styles.container} ${styles.scopeInner}`}>
          <p className={styles.scopeLabel}>{t.scope.label}</p>
          {t.scope.items.map((item, index) => {
            const Icon = scopeIcons[index];
            return (
              <div key={item} className={styles.scopeItem}>
                <Icon aria-hidden="true" />
                {item}
              </div>
            );
          })}
        </div>
      </div>

      <section className={styles.preview} id="report" aria-labelledby="audit-report-title">
        <div className={styles.container}>
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>{t.report.kicker}</p>
            <h2 id="audit-report-title" className={styles.sectionTitle}>
              {t.report.titleLead}
              <br />
              <span className={styles.accent}>{t.report.titleAccent}</span>
            </h2>
            <p className={styles.sectionLead}>{t.report.lead}</p>
          </div>
          <div className={styles.reportShell} role="group" aria-label={t.report.shellLabel}>
            <div className={styles.reportChrome}>
              <div className={styles.reportBrand}>
                <Mark />
                RepGet <span>{t.report.crumb}</span>
              </div>
              <span className={styles.reportSample}>{t.report.sampleBadge}</span>
            </div>
            <AuditSampleTabs
              title={t.report.navTitle}
              label={t.report.tabsLabel}
              note={
                <>
                  <ShieldCheck aria-hidden="true" />
                  {t.report.navNote}
                </>
              }
              tabs={[
                { id: "overview", label: t.report.tabs[0], icon: <BarChart3 aria-hidden="true" /> },
                { id: "seo", label: t.report.tabs[1], icon: <Search aria-hidden="true" /> },
                { id: "ai", label: t.report.tabs[2], icon: <Bot aria-hidden="true" /> },
                { id: "actions", label: t.report.tabs[3], icon: <List aria-hidden="true" /> },
              ]}
              panels={samplePanels(t.report)}
            />
          </div>
          <div className={styles.previewUnder}>
            <p>{t.report.under}</p>
            <AuditFocusLink>
              {t.form.submit}
              <ArrowRight aria-hidden="true" />
            </AuditFocusLink>
          </div>
        </div>
      </section>

      <section className={styles.checks} id="what-we-check" aria-labelledby="audit-checks-title">
        <div className={styles.container}>
          <div className={styles.checksHeading}>
            <div>
              <p className={styles.kicker}>{t.checks.kicker}</p>
              <h2 id="audit-checks-title" className={styles.sectionTitle}>
                {t.checks.titleLead} <span className={styles.accent}>{t.checks.titleAccent}</span>
              </h2>
            </div>
            <p className={styles.sectionLead}>{t.checks.lead}</p>
          </div>
          <div className={styles.checksGrid}>
            {t.checks.items.map((item, index) => {
              const Icon = checkIcons[index];
              return (
                <article key={item.title} className={styles.checkFeature}>
                  <div className={styles.featureTop}>
                    <span>0{index + 1} / 04</span>
                    <span className={styles.featureIcon} aria-hidden="true">
                      <Icon />
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className={styles.offerSection} aria-label={t.offer.kicker}>
        <div className={styles.container}>
          <div className={styles.offer}>
            <span className={styles.offerIcon} aria-hidden="true">
              <FileText />
            </span>
            <div className={styles.offerCopy}>
              <small>{t.offer.kicker}</small>
              <strong>{plural(t.offer.title, TRIAL_DAYS)}</strong>
              <p>{facts(t.offer.body)}</p>
            </div>
            <AuditFocusLink className={styles.offerLink}>
              {t.offer.link}
              <ArrowRight aria-hidden="true" />
            </AuditFocusLink>
          </div>
        </div>
      </section>

      <section className={styles.next} aria-label={t.next.label}>
        <div className={styles.container}>
          <div className={styles.nextPanel}>
            <div className={styles.nextContent}>
              <p className={styles.kicker}>{t.next.kicker}</p>
              <h2>
                {t.next.titleLead} <span>{t.next.titleAccent}</span>
              </h2>
              <p className={styles.nextBody}>{t.next.body}</p>
              <Link prefetch={false} className={styles.nextCta} href={localePath(locale, "/sign-up")}>
                {t.next.cta}
                <ArrowRight aria-hidden="true" />
              </Link>
              <p className={styles.nextFoot}>{t.next.foot}</p>
            </div>
            <div className={styles.growth} role="group" aria-label={t.next.visualTop}>
              <p className={styles.growthTop}>
                <span aria-hidden="true" />
                {t.next.visualTop}
              </p>
              <div className={styles.growthCard}>
                <div className={styles.growthRow}>
                  <div>
                    <strong>{t.next.cardTitle}</strong>
                    <small>{t.next.cardBody}</small>
                  </div>
                  <span className={styles.growthBadge}>{t.next.badge}</span>
                </div>
                <div className={styles.growthTasks}>
                  {t.next.tasks.map((task, index) => {
                    const Icon = taskIcons[index];
                    return (
                      <div key={task.title} className={styles.growthTask}>
                        <span className={styles.taskSymbol} aria-hidden="true">
                          <Icon />
                        </span>
                        <div>
                          <strong>{task.title}</strong>
                          <small>{task.body}</small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className={styles.growthFloat}>
                <strong>{t.next.floatTitle}</strong>
                <small>{t.next.floatBody}</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.how} id="how-it-works" aria-labelledby="audit-how-title">
        <div className={`${styles.container} ${styles.howGrid}`}>
          <div>
            <p className={styles.kicker}>{t.how.kicker}</p>
            <h2 id="audit-how-title" className={styles.sectionTitle}>
              {t.how.titleLead}
              <br />
              {t.how.titleAccent}
            </h2>
            <p className={styles.sectionLead}>{t.how.lead}</p>
          </div>
          <ol className={styles.steps}>
            {t.how.steps.map((step, index) => (
              <li key={step.title}>
                <span>0{index + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.faq} aria-labelledby="audit-faq-title">
        <div className={`${styles.container} ${styles.faqGrid}`}>
          <div className={styles.faqIntro}>
            <p className={styles.kicker}>{t.faq.kicker}</p>
            <h2 id="audit-faq-title" className={styles.sectionTitle}>
              {t.faq.titleLead}
              <br />
              {t.faq.titleAccent}
            </h2>
            <p className={styles.sectionLead}>{t.faq.lead}</p>
            <p className={styles.faqFoot}>
              <Check aria-hidden="true" />
              {t.faq.foot}
            </p>
          </div>
          <div className={styles.faqList}>
            {t.faq.items.map((item, index) => (
              <details key={item.q} className={styles.faqItem} open={index === 0}>
                <summary>
                  {item.q}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{facts(typeof item.a === "string" ? item.a : plural(item.a, TRIAL_DAYS))}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.closing} aria-labelledby="audit-closing-title">
        <div className={styles.container}>
          <div className={styles.closingCard}>
            <p className={styles.kicker}>{t.closing.kicker}</p>
            <h2 id="audit-closing-title">
              {t.closing.titleLead}
              <br />
              <span>{t.closing.titleAccent}</span>
            </h2>
            <p className={styles.closingLead}>{t.closing.lead}</p>
            <AuditStartForm strings={t.form} action={action} placeholder={t.form.closingPlaceholder} />
            <Assurances items={t.closing.assurances} />
          </div>
        </div>
      </section>
    </div>
  );
}
