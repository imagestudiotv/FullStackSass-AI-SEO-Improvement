"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { JoinWithGoogle } from "@/app/(marketing)/_home/join-with-google";
import { fill, type GrowthPlanCopy } from "@/lib/i18n/growth-plan";
import type { Locale } from "@/lib/i18n/config";
import type { SiteCard } from "@/lib/websites/site-card";

import { auditForPlan, suggestSite, type PlanAudit } from "./actions";
import styles from "./growth-plan.module.css";
import { SiteIcon } from "./site-icon";

/** Research, check, plan; then done. */
type Phase = 0 | 1 | 2 | 3;
type Tone = "plain" | "good" | "warn";
type Line = { id: number; text: string; tone: Tone; seconds: number };

/** Each step stays on screen at least this long, so it can be read before the next one. */
const MIN_STEP_MS = 1400;
/** Writing the plan: nothing to wait for, a beat for the eye. */
const PLAN_MS = 1500;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The growth plan's moving part (growth-plan-page.tsx says why it exists).
 *
 * Two requests start together on arrival: the site's suggestion card (fast)
 * and the free audit (up to a minute). The three steps advance as each real
 * answer arrives, never before, and the log beside them writes out what was
 * actually found, timed from the visitor's arrival: no invented progress, no
 * percentage. A failed request is said once in the log and the plan goes on
 * without it; the trial is always one press away.
 */
export function GrowthPlanFlow({
  domain,
  locale,
  copy: t,
  maxPages,
  trialDays,
  links,
}: {
  domain: string;
  locale: Locale;
  copy: GrowthPlanCopy;
  maxPages: number;
  trialDays: number;
  links: { signUp: string; googleNext: string; plans: string; home: string };
}) {
  const [phase, setPhase] = useState<Phase>(0);
  /** The step shown in the stage: the current one, or a finished one the visitor went back to. */
  const [viewing, setViewing] = useState<0 | 1 | 2 | null>(null);
  const [site, setSite] = useState<SiteCard | null | undefined>(undefined);
  const [audit, setAudit] = useState<PlanAudit | undefined>(undefined);
  const [lines, setLines] = useState<Line[]>([]);
  const started = useRef(false);
  const logEnd = useRef<HTMLOListElement>(null);

  const host = domain.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/\/.*$/, "").replace(/^www\./i, "");
  const name = site?.name || (audit?.ok ? audit.siteName : null) || host;
  const languageCode = site?.language || (audit?.ok ? audit.language : null);
  const language = languageCode ? languageName(languageCode, locale) : null;

  useEffect(() => {
    // Once per page: React's development double effect must not ask twice.
    if (started.current) return;
    started.current = true;
    const began = performance.now();
    let id = 0;
    const log = (text: string, tone: Tone = "plain") =>
      setLines((all) => [...all, { id: id++, text, tone, seconds: Math.round((performance.now() - began) / 1000) }]);

    const auditing = auditForPlan(domain, locale).catch((): PlanAudit => ({ ok: false, message: "" }));
    void (async () => {
      log(fill(t.log.open, { domain: host }));
      const card = await suggestSite(domain).catch(() => null);
      await wait(Math.max(0, MIN_STEP_MS - (performance.now() - began)));
      setSite(card);
      if (card) {
        log(fill(t.log.found, { name: card.name }), "good");
        if (card.platform) log(fill(t.log.platform, { platform: card.platform }));
        if (card.language) log(fill(t.log.language, { language: languageName(card.language, locale) }));
      } else {
        log(t.log.noPreview, "warn");
      }

      setPhase(1);
      const checking = performance.now();
      log(fill(t.log.auditStart, { pages: maxPages }));
      log(t.log.auditWaiting);
      const result = await auditing;
      await wait(Math.max(0, MIN_STEP_MS - (performance.now() - checking)));
      setAudit(result);
      if (result.ok) {
        log(fill(t.log.pages, { count: result.pagesChecked }));
        log(fill(t.log.score, { score: result.score }), result.score >= 80 ? "good" : "warn");
        log(fill(t.log.problems, { critical: result.counts.critical, warnings: result.counts.warning }), result.counts.critical ? "warn" : "plain");
        if (result.crawlersChecked > 0) {
          log(result.blockedCrawlers.length ? fill(t.log.crawlersBlocked, { owners: result.blockedCrawlers.join(", ") }) : t.log.crawlersOpen, result.blockedCrawlers.length ? "warn" : "good");
        }
      } else {
        log(fill(t.log.auditFailed, { message: result.message || "-" }), "warn");
      }

      setPhase(2);
      log(t.log.planStart);
      await wait(PLAN_MS);
      log(t.log.planDone, "good");
      setPhase(3);
    })();
  }, [domain, host, locale, maxPages, t]);

  // The newest line in view, inside the log only (never scrolls the page).
  useEffect(() => {
    const list = logEnd.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [lines]);

  const shown: 0 | 1 | 2 = viewing ?? (phase === 3 ? 2 : phase);
  const done = phase === 3;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>
          <span className={styles.pulse} aria-hidden="true" />
          {t.eyebrow}
        </p>
        <h1 className={styles.title}>{done ? fill(t.titleDone, { name }) : fill(t.title, { domain: host })}</h1>
        <p className={styles.intro}>{t.intro}</p>
      </header>

      <ol className={styles.steps} aria-label={t.phasesLabel}>
        {t.phases.map((label, index) => {
          const state = phase > index ? "done" : phase === index ? "active" : "next";
          return (
            <li key={label} className={styles.step} data-state={state}>
              <button
                type="button"
                className={styles.stepButton}
                disabled={state === "next"}
                aria-current={shown === index ? "step" : undefined}
                aria-label={`${label} (${fill(t.stepOf, { index: index + 1 })})`}
                onClick={() => setViewing(index === (phase === 3 ? 2 : phase) ? null : (index as 0 | 1 | 2))}
              >
                <span className={styles.stepMark} aria-hidden="true">
                  {state === "done" ? "✓" : index + 1}
                </span>
                <span className={styles.stepLabel}>{label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className={styles.grid}>
        <section className={styles.stage} aria-live="polite">
          <div className={styles.windowBar} aria-hidden="true">
            <span className={styles.dots}>
              <i />
              <i />
              <i />
            </span>
            <span className={styles.windowTitle}>{t.phases[shown]}</span>
            <span className={styles.windowHost}>{host}</span>
          </div>
          <div key={shown} className={styles.scene}>
            {shown === 0 ? <Research t={t} host={host} site={site} language={language} /> : null}
            {shown === 1 ? <Audit t={t} audit={audit} /> : null}
            {shown === 2 ? (
              <Plan t={t} name={name} language={language} audit={audit} ready={done} trialDays={trialDays} links={links} />
            ) : null}
          </div>
        </section>

        <aside className={styles.terminal} aria-label={t.logLabel}>
          <div className={styles.terminalBar}>
            <span className={styles.terminalDot} data-busy={!done || undefined} aria-hidden="true" />
            {t.logTitle}
          </div>
          <ol ref={logEnd} className={styles.log} role="log">
            {lines.map((line, index) => (
              <li key={line.id} className={styles.logLine} data-tone={line.tone}>
                <span className={styles.logTime} aria-hidden="true">
                  {`00:${String(Math.min(line.seconds, 99)).padStart(2, "0")}`}
                </span>
                <span className={styles.logText} data-typing={index === lines.length - 1 || undefined}>
                  {line.text}
                </span>
              </li>
            ))}
            {!done ? (
              <li className={styles.cursorLine} aria-hidden="true">
                <span className={styles.cursor} />
              </li>
            ) : null}
          </ol>
          <Link prefetch={false} href={links.home} className={styles.another}>
            {t.another}
          </Link>
        </aside>
      </div>
    </div>
  );
}

/** The language's name in the page's language ("Italian", "italiano"...), or the code if the browser cannot say. */
function languageName(code: string, locale: Locale): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: "language" }).of(code);
    return name ? name.charAt(0).toLocaleUpperCase(locale) + name.slice(1) : code;
  } catch {
    return code;
  }
}

function Skeleton({ label }: { label: string }) {
  return (
    <div className={styles.skeleton}>
      <p className={styles.waiting}>
        <span className={styles.spinner} aria-hidden="true" />
        {label}
      </p>
      <span className={styles.bar} />
      <span className={styles.bar} data-short />
      <span className={styles.bar} />
    </div>
  );
}

function Research({ t, host, site, language }: { t: GrowthPlanCopy; host: string; site: SiteCard | null | undefined; language: string | null }) {
  if (site === undefined) return <Skeleton label={fill(t.research.loading, { domain: host })} />;
  return (
    <div className={styles.research}>
      <p className={styles.kicker}>{t.research.heading}</p>
      <div className={styles.business}>
        <SiteIcon site={site} host={host} size={56} className={styles.icon} letterClassName={styles.iconLetter} />
        <div className={styles.businessText}>
          <h2 className={styles.businessName}>{site?.name ?? host}</h2>
          <p className={styles.businessAbout}>{site?.description ?? t.research.noDescription}</p>
        </div>
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>{t.research.website}</dt>
          <dd>{host}</dd>
        </div>
        <div>
          <dt>{t.research.platform}</dt>
          <dd>{site?.platform ?? t.research.unknown}</dd>
        </div>
        <div>
          <dt>{t.research.language}</dt>
          <dd>{language ?? t.research.unknown}</dd>
        </div>
      </dl>
    </div>
  );
}

function Audit({ t, audit }: { t: GrowthPlanCopy; audit: PlanAudit | undefined }) {
  if (audit === undefined) {
    return (
      <div>
        <Skeleton label={t.audit.loading} />
        <ul className={styles.checks}>
          {t.audit.checks.map((check) => (
            <li key={check}>
              <span className={styles.spinnerSmall} aria-hidden="true" />
              {check}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (!audit.ok) {
    return (
      <div className={styles.auditFailed}>
        <p className={styles.kicker}>{t.audit.heading}</p>
        <p>{fill(t.audit.failed, { message: audit.message })}</p>
      </div>
    );
  }
  const problems = audit.counts.critical + audit.counts.warning;
  return (
    <div className={styles.audit}>
      <p className={styles.kicker}>{t.audit.heading}</p>
      <div className={styles.scoreRow}>
        <div className={styles.score} style={{ "--score": audit.score } as CSSProperties}>
          <strong>{audit.score}</strong>
          <span>/100</span>
        </div>
        <dl className={styles.counts}>
          <div>
            <dt>{t.audit.score}</dt>
            <dd>{audit.score}/100</dd>
          </div>
          <div>
            <dt>{t.audit.pages}</dt>
            <dd>{audit.pagesChecked}</dd>
          </div>
          <div data-tone={audit.counts.critical ? "warn" : undefined}>
            <dt>{t.audit.critical}</dt>
            <dd>{audit.counts.critical}</dd>
          </div>
          <div>
            <dt>{t.audit.warnings}</dt>
            <dd>{audit.counts.warning}</dd>
          </div>
        </dl>
      </div>
      {problems === 0 && audit.issues.length === 0 ? (
        <p className={styles.allGood}>{t.audit.none}</p>
      ) : (
        <ul className={styles.issues}>
          {audit.issues.map((issue) => (
            <li key={issue.label} data-severity={issue.severity}>
              <span className={styles.issueDot} aria-hidden="true" />
              <span className={styles.issueLabel}>{issue.label}</span>
              {issue.pageCount > 1 ? <span className={styles.issueCount}>×{issue.pageCount}</span> : null}
            </li>
          ))}
        </ul>
      )}
      {audit.hiddenIssues > 0 ? <p className={styles.more}>{fill(t.audit.more, { count: audit.hiddenIssues })}</p> : null}
    </div>
  );
}

function Plan({
  t,
  name,
  language,
  audit,
  ready,
  trialDays,
  links,
}: {
  t: GrowthPlanCopy;
  name: string;
  language: string | null;
  audit: PlanAudit | undefined;
  ready: boolean;
  trialDays: number;
  links: { signUp: string; googleNext: string; plans: string };
}) {
  if (!ready) return <Skeleton label={t.log.planStart} />;
  const items: { title: string; detail: string }[] = [];
  if (audit?.ok) {
    const problems = audit.counts.critical + audit.counts.warning;
    items.push(problems > 0 ? { title: fill(t.plan.fix[0], { count: problems }), detail: t.plan.fix[1] } : { title: t.plan.healthy[0], detail: t.plan.healthy[1] });
  }
  items.push({ title: language ? fill(t.plan.articlesIn, { language }) : t.plan.articles[0], detail: fill(t.plan.articles[1], { name }) });
  items.push({ title: t.plan.videos[0], detail: fill(t.plan.videos[1], { name }) });
  if (audit?.ok && audit.crawlersChecked > 0) {
    items.push(
      audit.blockedCrawlers.length
        ? { title: t.plan.aiBlocked[0], detail: fill(t.plan.aiBlocked[1], { owners: audit.blockedCrawlers.join(", "), name }) }
        : { title: t.plan.aiOpen[0], detail: fill(t.plan.aiOpen[1], { name }) },
    );
  }
  items.push({ title: t.plan.conversations[0], detail: t.plan.conversations[1] });

  return (
    <div className={styles.plan}>
      <p className={styles.kicker}>{t.plan.heading}</p>
      <ol className={styles.planList}>
        {items.map((item, index) => (
          <li key={item.title} style={{ animationDelay: `${index * 90}ms` }}>
            <span className={styles.planNum} aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </span>
          </li>
        ))}
      </ol>
      <div className={styles.cta}>
        <div>
          <p className={styles.ctaTitle}>{t.cta.title}</p>
          <p className={styles.ctaBody}>
            {fill(t.cta.body, { days: trialDays })} {t.cta.note}
          </p>
        </div>
        <div className={styles.ctaActions}>
          <Link prefetch={false} href={links.signUp} className={styles.primary}>
            {t.cta.start} <span aria-hidden="true">↗</span>
          </Link>
          <JoinWithGoogle className={styles.google} signUpHref={links.signUp} next={links.googleNext}>
            <span>{t.cta.google}</span>
          </JoinWithGoogle>
          <Link prefetch={false} href={links.plans} className={styles.plansLink}>
            {t.cta.plans}
          </Link>
        </div>
      </div>
    </div>
  );
}
