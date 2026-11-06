/**
 * The free audit's landing page (client's design, 2026-11-05,
 * RepGet_Audit_White_Spotlight.html). One file per language beside this one,
 * so the page's long copy stays out of messages.ts.
 *
 * WHERE THIS DIFFERS FROM THE DESIGN, on purpose. The design promises "Your
 * first backlink" as part of the free audit, and a section headed "Extra
 * included with the audit". Nothing grants that: backlinks wait for a paid plan
 * (lib/billing/entitled.ts). The third inclusion is what the check really
 * returns, AI crawler access (lib/audit/ai-crawlers.ts), and the extra is the
 * real offer, the free articles (lib/plans/features.ts). Its FAQ answers
 * describe what the crawl reads (lib/audit/rules.ts).
 *
 * Plurals are [one, other]. {count} is FREE_ARTICLES, {days} FREE_ARTICLES_DAYS
 * and {pages} the free check's page limit (lib/audit/limits.ts). Text between
 * ** is set in bold.
 */

export type AuditLandingItem = { title: string; body: string };

export type AuditLandingCopy = {
  form: {
    label: string;
    placeholder: string;
    closingPlaceholder: string;
    submit: string;
    pending: string;
    emptyError: string;
    invalidError: string;
  };
  hero: {
    eyebrow: string;
    titleLead: string;
    titleBefore: string;
    titleAccent: string;
    description: string;
    includedTitle: string;
    inclusions: [AuditLandingItem, AuditLandingItem, AuditLandingItem];
    startKicker: string;
    startConfidence: string;
    assurances: [string, string, string];
    sampleLink: string;
  };
  /** The hero's drawing of a report. Every part of it says it is an example. */
  device: {
    label: string;
    address: string;
    tag: string;
    small: string;
    title: string;
    pill: string;
    scoreTitle: string;
    scoreBody: string;
    searchLabel: string;
    searchValue: string;
    searchTag: string;
    aiLabel: string;
    aiValue: string;
    aiTag: string;
    chartTitle: string;
    chartNote: string;
    chartTags: [string, string];
    footerLeft: string;
    footerRight: string;
  };
  scope: { label: string; items: [string, string, string, string] };
  /** The sample report: illustrative throughout, and labelled so. */
  report: {
    kicker: string;
    titleLead: string;
    titleAccent: string;
    lead: string;
    shellLabel: string;
    crumb: string;
    sampleBadge: string;
    navTitle: string;
    tabsLabel: string;
    tabs: [string, string, string, string];
    navNote: string;
    domain: string;
    overview: {
      eyebrow: string;
      title: string;
      body: string;
      scoreTitle: string;
      scoreBody: string;
      tiles: [AuditLandingItem & { state: string }, AuditLandingItem & { state: string }];
      issuesTitle: string;
      issuesNote: string;
      issues: [AuditLandingItem & { tag: string }, AuditLandingItem & { tag: string }, AuditLandingItem & { tag: string }];
    };
    seo: {
      eyebrow: string;
      title: string;
      body: string;
      cardTitle: string;
      cardBody: string;
      bars: [string, string, string, string];
      checksTitle: string;
      checks: [string, string, string, string];
      toFix: string;
      passed: string;
    };
    ai: {
      eyebrow: string;
      title: string;
      body: string;
      cardTitle: string;
      cardBody: string;
      rows: [string, string, string, string];
      reviewRobots: string;
      checkHtml: string;
      noteTitle: string;
      noteBody: string;
    };
    actions: {
      eyebrow: string;
      title: string;
      body: string;
      items: [AuditLandingItem, AuditLandingItem, AuditLandingItem, AuditLandingItem];
      first: string;
      next: string;
      ongoing: string;
    };
    under: string;
  };
  checks: {
    kicker: string;
    titleLead: string;
    titleAccent: string;
    lead: string;
    items: [AuditLandingItem, AuditLandingItem, AuditLandingItem, AuditLandingItem];
  };
  /** Where the design put its free backlink. */
  offer: {
    kicker: string;
    title: [string, string];
    body: string;
    link: string;
  };
  next: {
    label: string;
    kicker: string;
    titleLead: string;
    titleAccent: string;
    body: string;
    cta: string;
    foot: string;
    visualTop: string;
    cardTitle: string;
    cardBody: string;
    badge: string;
    tasks: [AuditLandingItem, AuditLandingItem, AuditLandingItem, AuditLandingItem];
    floatTitle: string;
    floatBody: string;
  };
  how: {
    kicker: string;
    titleLead: string;
    titleAccent: string;
    lead: string;
    steps: [AuditLandingItem, AuditLandingItem, AuditLandingItem];
  };
  faq: {
    kicker: string;
    titleLead: string;
    titleAccent: string;
    lead: string;
    foot: string;
    /** An answer may be [one, other] when it quotes the free articles. */
    items: { q: string; a: string | [string, string] }[];
  };
  closing: {
    kicker: string;
    titleLead: string;
    titleAccent: string;
    lead: string;
    assurances: [string, string, string];
  };
};
