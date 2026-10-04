import type { Locale } from "@/lib/i18n/config";

/**
 * Translated marketing copy.
 *
 * Plain objects rather than a translation library. The set of strings is fixed
 * and small, every one is used at build time on a static page, and a library
 * would add a provider, a loader and a dependency for a lookup that is a
 * property access.
 *
 * WHAT IS TRANSLATED: home, pricing, about, FAQ and contact, plus the shared
 * navigation and footer. These are what Google indexes and what "major reach"
 * in the brief refers to.
 *
 * Still English-only: the free tools and the two network pages. Both are
 * heavily interactive rather than copy, so translating them means translating
 * form labels, validation and result states — a larger job than the prose
 * pages, and the switcher hides itself there rather than offering a link that
 * 404s.
 *
 * WHAT IS NOT, deliberately:
 *
 *  - The legal pages. Privacy, terms and refunds carry commitments with
 *    specific legal meanings, and a mistranslated one is a liability rather
 *    than a typo. They stay in English until a lawyer or a professional
 *    translator has produced a version, and the page says so.
 *  - The signed-in app. The brief says "the website" and gives /es and /it,
 *    which are public URLs. Translating the app is a far larger job and
 *    reaches nobody who has not already signed up.
 *  - The blog. Posts are written content, not interface strings; translating
 *    them means writing them again in each language.
 *
 * These translations are fluent but have NOT been reviewed by a native
 * speaker. Register in particular is a brand decision rather than a
 * translation one — Spanish, French, Italian and German all choose between
 * formal and informal address, and this uses the formal form throughout, which
 * suits a business audience but is worth a native review before launch.
 */

export type Messages = {
  nav: {
    howItWorks: string;
    freeCheck: string;
    tools: string;
    pricing: string;
    blog: string;
    faq: string;
    about: string;
    contact: string;
    signIn: string;
    getStarted: string;
    /** Header nav entry for the case-studies page. */
    successStories: string;
    /**
     * The header's primary button.
     *
     * Separate from getStarted, which labels the per-plan buttons on the
     * pricing page: those two read the same in English and diverge in
     * languages where a plan button and a nav call to action are not phrased
     * alike.
     */
    getStartedCta: string;
    /** The Platform dropdown: its trigger, heading and six entries. */
    platform: string;
    platformHeading: string;
    platformItems: { title: string; detail: string }[];
  };
  footer: {
    tagline: string;
    product: string;
    legal: string;
    freeCheck: string;
    freeTools: string;
    pricing: string;
    blog: string;
    faq: string;
    about: string;
    contact: string;
    backlinkExchange: string;
    publishers: string;
    affiliate: string;
    privacy: string;
    terms: string;
    refunds: string;
  };
  home: {
    eyebrow: string;
    title: string;
    subtitle: string;
    checkFree: string;
    getStarted: string;
    noCard: string;
    /** "Free with your audit" band. */
    auditBand: string;
    auditItems: { title: string; body: string }[];
    /** Placeholder in the homepage audit field. */
    auditPlaceholder: string;
    /**
     * The reassurances under the audit card.
     *
     * The design shows "Cancel anytime" and "No questions asked", which are
     * about a SUBSCRIPTION — nothing is being subscribed to here, and the
     * check needs no account at all. These say what is actually true of it.
     */
    auditAssurances: string[];
    checkMyWebsite: string;
    howItWorks: string;
    steps: { title: string; body: string }[];
    /** Problem / solution. */
    problemsEyebrow: string;
    yourProblem: string;
    ourSolution: string;
    problems: string[];
    solutionTitle: string;
    solution: string[];
    /** One subscription. */
    stackEyebrow: string;
    stackTitle: string;
    stackTitleAccent: string;
    stackSub: string;
    seePricing: string;
    replaces: string[];
    /** Publishing. */
    publishesTitle: string;
    publishesAccent: string;
    publishesTitleEnd: string;
    publishesSub: string;
    publishesPlugin: string;
    platformOther: string;
    /** What you see. */
    trackedTitle: string;
    trackedSub: string;
    tracked: { label: string; detail: string }[];
    /**
     * The cards floating either side of the headline.
     *
     * Separate from `tracked`, which feeds the "what you see" section further
     * down the page. They started as the same four, but the hero now shows six
     * and growing `tracked` would have silently added two cards to a section
     * that is not about them.
     */
    heroCards: { label: string; detail: string }[];
    /**
     * The headline, split so the second half can be coloured.
     *
     * Two keys rather than one string with markup in it, and rather than
     * splitting on a full stop in the component: the break falls in a
     * different place in every language, and German has no full stop where
     * English does. A translator moves the break by moving a word between
     * these two values, without touching the component.
     */
    titleLead: string;
    titleAccent: string;
    /** The four columns under the product shot. */
    pillars: { title: string; body: string }[];
    /** Heading over the dashboard preview. */
    previewTitle: string;
    previewSub: string;
    /**
     * Says the figures in the product shot are an example.
     *
     * A screenshot with invented numbers and no caption is the kind of thing a
     * customer quotes back when their first month looks different.
     */
    previewCaption: string;
    /** Hero call to action, beside "check my website". */
    joinGoogle: string;
    /** Opens the demo video further down the page. */
    seeHow: string;
    /** The video section itself. */
    videoTitle: string;
    videoSub: string;
    videoComingSoon: string;
    /** Integration band under the hero. Not customer logos — see the section. */
    worksWithTitle: string;
    /** Backlink network. */
    networkEyebrow: string;
    networkTitle: string;
    networkTitleRest: string;
    networkHeading: string;
    networkPoints: string[];
    networkHowLink: string;
    /** Pricing preview. */
    pricingEyebrow: string;
    pricingTitle: string;
    pricingTitleAccent: string;
    pricingSub: string;
    seeAllPlans: string;
    mostPopular: string;
    /** Badge on the entry tier in the homepage pricing preview. */
    tryItFirst: string;
    getStartedPlan: string;
    perMonth: string;
    unavailable: string;
    planArticles: string;
    /**
     * Capability lines on the homepage preview, replacing the website and
     * credit counts. Same reason as pricing.features above: the client asked
     * for neither figure to be advertised.
     */
    planBacklinks: string;
    planPublishing: string;
    /** Closing. */
    closingTitle: string;
    closingSub: string;
    cancelAnytime: string;
    guarantee: string;
  };
  pricing: {
    title: string;
    subtitle: string;
    perMonth: string;
    getStarted: string;
    mostPopular: string;
    /** Badge on the entry tier, which exists to be tried rather than compared. */
    tryItFirst: string;
    starterTagline: string;
    unavailable: string;
    annualNote: string;
    refundPolicy: string;
    features: {
      articles: string;
      keywords: string;
      /**
       * Capability lines, not counts.
       *
       * These were `websites: (n) => "3 websites"` and
       * `credits: (n) => "25 link credits each month"`. The client asked for
       * both figures to stop being advertised — "We don't mention number of
       * websites, how many credits we are giving, etc. Because they will most
       * likely start with 0 credits, or some amount we set like a bonus
       * credits." The underlying limits still exist and are still enforced;
       * they are simply no longer a promise printed beside a price.
       */
      backlinks: string;
      audit: string;
      healthChecks: string;
      publishing: string;
    };
  };
  /**
   * Static marketing pages. Each is a title, a lead paragraph and a body, so
   * the same components render every language without per-locale layout.
   */
  about: {
    metaTitle: string;
    metaDescription: string;
    title: string;
    intro: string[];
    beliefTitle: string;
    beliefLead: string;
    belief: string[];
    audienceTitle: string;
    audience: string;
  };
  /**
   * Success stories.
   *
   * Deliberately about what the product measures rather than about named
   * customers, because there are none yet and the homepage already refuses to
   * invent them. See the page for the full reasoning.
   */
  successStories: {
    metaTitle: string;
    metaDescription: string;
    eyebrow: string;
    title: string;
    intro: string;
    results: { label: string; body: string }[];
    timelineTitle: string;
    timelineIntro: string;
    timeline: { when: string; body: string }[];
    ctaTitle: string;
    ctaBody: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  /** Publishers: hosting an article to earn link credits. */
  publishers: {
    metaTitle: string;
    metaDescription: string;
    title: string;
    intro: string;
    creditsTitle: string;
    creditsBody: string;
    steps: { title: string; body: string }[];
    controlTitle: string;
    rules: { title: string; body: string }[];
    suitsTitle: string;
    suitsBody: string;
    joinNote: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  /** Affiliate: referring another business for link credits. */
  affiliate: {
    metaTitle: string;
    metaDescription: string;
    title: string;
    intro: string;
    steps: { title: string; body: string }[];
    termsTitle: string;
    terms: string[];
    ctaPrimary: string;
    ctaNote: string;
  };
  /** The backlink exchange, explained to a prospect. */
  backlinkExchange: {
    metaTitle: string;
    metaDescription: string;
    title: string;
    intro: string;
    steps: { title: string; body: string }[];
    rulesTitle: string;
    rules: { title: string; body: string }[];
    /**
     * Said plainly rather than buried. Anyone who has been sold link building
     * before has been sold a private blog network, and the honest difference
     * is worth more than a claim we cannot back.
     */
    notTitle: string;
    notBody: string;
    ctaTitle: string;
    ctaBody: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  faq: {
    metaTitle: string;
    metaDescription: string;
    title: string;
    subtitle: string;
    items: { question: string; answer: string }[];
  };
  contact: {
    metaTitle: string;
    metaDescription: string;
    title: string;
    subtitle: string;
    emailLabel: string;
    accountNote: string;
  };
  /** The public site's "page not found" (components/not-found-panel.tsx). */
  notFound: {
    /** The browser tab's title, "<this> | RepGet". */
    metaTitle: string;
    eyebrow: string;
    title: string;
    body: string;
    home: string;
    elsewhere: string;
  };
  legalNotice: string;

  /**
   * The signed-in app.
   *
   * Separate from the marketing keys above because the two are translated on
   * different schedules and by different standards: marketing copy is read by
   * strangers deciding whether to trust us, app copy by customers who already
   * have. Keeping them in one file means one dictionary to load and one type
   * to satisfy, and a missing key in any language is a compile error.
   */
  app: {
    /**
     * Shared pieces of the redesigned workspace pages: the save bar, the
     * section navigation, field hints and the view-only notice.
     */
    workspace: {
      /** The save bar's button. */
      save: string;
      /** While a save is in flight. */
      saving: string;
      /** After the server confirmed a save. */
      saved: string;
      /** Puts every field back to its saved value. */
      discard: string;
      /** Pending edits, one|many with {count}. */
      unsaved: string;
      /** Nothing waiting to be saved. */
      noChanges: string;
      /** A refused or failed save; {error} is the server's message. */
      saveFailed: string;
      /** Asked before following a link with unsaved edits. */
      leaveConfirm: string;
      /** Heading of the section navigation. */
      onThisPage: string;
      /** Label of the section navigation on phones. */
      jumpTo: string;
      /** Marks an optional field. */
      optional: string;
      /** Marks a required field. */
      required: string;
      /** Under a limited field, one|many with {count}. */
      charactersLeft: string;
      /** Over a limit, one|many with {count}. */
      overLimit: string;
      /** Shown to a viewer instead of editable controls. */
      viewOnly: string;
      /** Marks a control that saves the moment it changes. */
      savesImmediately: string;
      /** Marks a group saved by the Save button. */
      savedWithButton: string;
      /** After a save while more edits were made. */
      editsKept: string;
      /** Opens a larger preview. */
      preview: string;
      /** Closes a dialog. */
      close: string;
      /** Marks the chosen option. */
      selected: string;
    };
    /**
     * Website health (/websites/[id]): the technical check of a site's pages.
     * Placeholders: {domain}, {date}, {count} (with "one|many" plural pairs),
     * {max}, {score}, {found}, {read}, {shown}, {total}, {checks}, {critical}.
     */
    health: {
      title: string;
      description: string;
      checkNow: string;
      checkAgain: string;
      checking: string;
      starting: string;
      refreshStatus: string;
      dismiss: string;
      unavailableTitle: string;
      siteNotReady: string;
      errNoPlan: string;
      errPlanInactive: string;
      errQuota: string;
      errUnexpected: string;
      queuedTitle: string;
      queuedBody: string;
      queuedStale: string;
      requestedAt: string;
      runningTitle: string;
      runningBody: string;
      runningStale: string;
      /** Shown under a stale queued/running notice to owners and editors only. */
      staleRetry: string;
      startedAt: string;
      progressChecked: string;
      progressFound: string;
      progressLimit: string;
      previousNotice: string;
      failedTitle: string;
      failedPrevious: string;
      finishedTitle: string;
      finishedBody: string;
      /** Why a whole check failed, by the kind the stored error matches. */
      failure: {
        timeout: string;
        notHtml: string;
        tooLarge: string;
        invalidUrl: string;
        refused: string;
        unreachable: string;
        notEntitled: string;
        generic: string;
      };
      /**
       * The failures whose message tells the reader to try again, worded for
       * a viewer, who cannot start a check.
       */
      failureViewer: {
        timeout: string;
        generic: string;
      };
      emptyTitle: string;
      emptyBody: string;
      emptyViewer: string;
      firstRunTitle: string;
      firstRunBody: string;
      scoreTitle: string;
      scoreDescription: string;
      previousResult: string;
      latestResult: string;
      outOf: string;
      scoreAria: string;
      bandGood: string;
      bandFair: string;
      bandPoor: string;
      noScore: string;
      noScoreBody: string;
      notScored: string;
      zeroPagesTitle: string;
      zeroPagesBody: string;
      notAuthority: string;
      lastChecked: string;
      pagesRead: string;
      pagesFailed: string;
      addressesFound: string;
      notRecorded: string;
      severityTitle: string;
      critical: string;
      warnings: string;
      suggestions: string;
      inFindings: string;
      severityAria: string;
      /** The severity of ONE finding, in the singular. */
      badge: { critical: string; warning: string; info: string };
      coverageTitle: string;
      coverageLimit: string;
      coverageSameSite: string;
      coverageQuery: string;
      coverageSkipped: string;
      coverageRefused: string;
      coverageBeyond: string;
      notAssessedTitle: string;
      notAssessedBody: string;
      /** The cross-page checks a one-page crawl cannot run (lib/audit/rules.ts). */
      crossChecks: {
        duplicateTitles: string;
        duplicateDescriptions: string;
        internalLinking: string;
      };
      findingsTitle: string;
      findingsDescription: string;
      findingsCount: string;
      filterLabel: string;
      filterAll: string;
      searchLabel: string;
      searchPlaceholder: string;
      showingFiltered: string;
      clearFilters: string;
      noMatchTitle: string;
      noMatchBody: string;
      noFindingsTitle: string;
      noFindingsBody: string;
      pagesCount: string;
      howToFix: string;
      effortMinutes: string;
      effortHour: string;
      effortLonger: string;
      needsDeveloper: string;
      affectedPages: string;
      homepage: string;
      opensInNewTab: string;
      showAllPages: string;
      showFewerPages: string;
      matchingPages: string;
      notLoaded: string;
      groupNote: string;
      firstPageNote: string;
      noUrl: string;
      rowsCapped: string;
      /** One affected page's own detail, rebuilt from the stored English sentence. */
      detail: {
        titleLong: string;
        titleShort: string;
        descriptionLong: string;
        descriptionShort: string;
        multipleH1: string;
        thinContent: string;
        imagesAlt: string;
        largePage: string;
        httpStatus: string;
        duplicateTitle: string;
        duplicateDescription: string;
        noInternalLinks: string;
        unreachTimeout: string;
        unreachBlocked: string;
        unreachPassword: string;
        unreachStatus: string;
        unreachNotHtml: string;
        unreachRedirects: string;
        unreachRedirectAway: string;
        unreachConnect: string;
        unreachUnknown: string;
      };
      /** Per issue type (the audit's own type names): name, what it means, how to fix it. */
      issues: Record<
        | "noindex"
        | "broken_page"
        | "unreachable_page"
        | "missing_title"
        | "title_too_long"
        | "title_too_short"
        | "missing_meta_description"
        | "meta_description_too_long"
        | "meta_description_too_short"
        | "missing_h1"
        | "multiple_h1"
        | "thin_content"
        | "images_missing_alt"
        | "missing_canonical"
        | "missing_lang"
        | "large_page"
        | "duplicate_title"
        | "duplicate_meta_description"
        | "no_internal_links",
        { label: string; about: string; fix: string }
      >;
      siteTitle: string;
      siteDescription: string;
      siteLegacy: string;
      siteUnavailable: string;
      siteName: string;
      siteNameMissing: string;
      language: string;
      languageMissing: string;
      languageNote: string;
      languageMissingNote: string;
      platform: string;
      platformUnknown: string;
      platformNote: string;
      platformUnknownNote: string;
      previewImage: string;
      previewMissing: string;
      previewNote: string;
      previewMissingNote: string;
      previewBroken: string;
      linkedTitle: string;
      linkedHelp: string;
      linkedEmpty: string;
      aiTitle: string;
      aiDescription: string;
      aiLegacy: string;
      /** A check that read no page: robots.txt was most likely unreadable too. */
      aiUnreadable: string;
      aiNoneBlocked: string;
      aiSomeBlocked: string;
      aiAllowed: string;
      aiBlocked: string;
      aiNamed: string;
      aiCaveat: string;
      aiNoGuarantee: string;
      aiBlockedHelp: string;
      aiVisibilityLink: string;
      fixTitle: string;
      fixSelf: string;
      fixDeveloper: string;
      fixHow: string;
      fixUnavailable: string;
      requestQuote: string;
      mailSubject: string;
      mailGreeting: string;
      mailAsk: string;
      mailCheckedOn: string;
      mailCounts: string;
      mailListTitle: string;
      /** One finding in the email: {label} and {pages} (already "N pages"). */
      mailLine: string;
      mailThanks: string;
    };
    settings: {
      /** Personal details card. */
      personalTitle: string;
      personalSubtitle: string;
      nameLabel: string;
      namePlaceholder: string;
      save: string;
      saving: string;
      cancel: string;
      nameSaved: string;
      nameError: string;
      emailLabel: string;
      changePassword: string;
      /**
       * The set-a-first-password path, for an account that signs in with
       * Google. `googleNote` ("You sign in with Google") used to sit where
       * the button now is; it is gone because the button replaced it.
       */
      setPassword: string;
      setPasswordIntro: string;
      setPasswordHelp: string;
      settingPassword: string;
      passwordCreated: string;
      languageLabel: string;
      languageHelp: string;
      languageError: string;
      /** Change-password form. */
      currentPassword: string;
      newPassword: string;
      updatePassword: string;
      passwordSaved: string;
      passwordTooShort: string;
      passwordError: string;
      passwordHelp: string;
      changing: string;
      saveName: string;
      /** Members & roles card. */
      membersTitle: string;
      membersSubtitle: string;
      addMember: string;
      addMemberHelp: string;
      memberColumn: string;
      roleColumn: string;
      statusColumn: string;
      /** The pending-invitation row: its status pills and its two controls. */
      statusPending: string;
      invitationExpiresOn: string;
      statusExpired: string;
      resendInvite: string;
      cancelInvite: string;
      inviteSent: string;
      inviteResent: string;
      inviteCancelled: string;
      actionsColumn: string;
      active: string;
      removeAccess: string;
      websiteLabel: string;
      emailPlaceholder: string;
      roleHelp: string;
      invite: string;
      nobodyElse: string;
      loadingPeople: string;
      roleEditor: string;
      roleViewer: string;
      /** Account page header. */
      pageTitle: string;
      pageDescription: string;
      /** Under the read-only email address. */
      emailHelp: string;
      nameRequired: string;
      /** Sign-in and security section: the sign-in methods and their states. */
      securityTitle: string;
      securitySubtitle: string;
      methodPassword: string;
      methodGoogle: string;
      methodSet: string;
      methodNotSet: string;
      methodLinked: string;
      passwordSetSummary: string;
      passwordNotSetSummary: string;
      googleLinkedSummary: string;
      /** The set-a-password intro when no Google account is linked. */
      setPasswordIntroGeneric: string;
      currentPasswordWrong: string;
      passwordTooLong: string;
      tooManyAttempts: string;
      passwordAlreadySet: string;
      /** Language section: the dashboard's language beside the articles'. */
      languageTitle: string;
      languageSubtitle: string;
      languageSaved: string;
      articleLanguageLabel: string;
      articleLanguageHelp: string;
      articleLanguageLink: string;
      /** Members panel: roles, the invite dialog, results and confirmations. */
      roleAdmin: string;
      roleEditorHelp: string;
      roleViewerHelp: string;
      /** {domain}. */
      inviteTo: string;
      reinviteHelp: string;
      invalidEmail: string;
      inviteSelf: string;
      inviteFailed: string;
      actionFailed: string;
      /** {email}, {domain}. */
      accessGranted: string;
      accessGrantedNoEmail: string;
      /** {email}. */
      accessRemoved: string;
      loadPeopleFailed: string;
      retry: string;
      thisWebsite: string;
      /** Screen-reader text and labels, with {email}. */
      workspaceAccess: string;
      manageMember: string;
      manageInvitation: string;
      /** The table's caption, {domain}. */
      membersCaption: string;
      removeConfirmTitle: string;
      removeConfirmBody: string;
      keepAccess: string;
      cancelInviteConfirmTitle: string;
      cancelInviteConfirmBody: string;
      keepInvitation: string;
      removing: string;
      cancellingInvite: string;
      inviting: string;
      /** The panel manages the reader's own sites while a shared one ({domain}) is on screen. */
      viewingSharedNote: string;
      /** For someone who owns no site: {domain} shared with them as {role}. */
      guestTeamNote: string;
    };
    websites: {
      title: string;
      /**
       * "3 websites. Each is billed on its own plan."
       *
       * DOES NOT SAY "CONNECTED", though the key is still named that. The
       * word means something else everywhere else in the product - a CMS
       * connection, a Google account - and "1 connected" on this screen read
       * as "your WordPress is connected". The client hit exactly that: he
       * opened this page from the setup guide and reported the site as
       * connected before he had touched the connection.
       *
       * The key keeps its name so the five locale blocks stay aligned;
       * renaming it is a separate change to make when something else in this
       * file moves.
       *
       * A pluralised pair rather than a token: the count governs the plural
       * and every language pluralises differently, so building the sentence
       * in the dictionary lets each locale decide.
       */
      connected: string;
      addWebsite: string;
      emptyTitle: string;
      emptyBody: string;
      addFirst: string;
      tryAgain: string;
      removeLabel: string;
      removed: string;
      retrying: string;
      dialogTitle: string;
      dialogBody: string;
      urlLabel: string;
      urlPlaceholder: string;
      cancel: string;
      adding: string;
      /** The group of websites other people shared with the reader. */
      sharedTitle: string;
      sharedHelp: string;
    };
    billing: {
      title: string;
      subtitle: string;
      yourWebsites: string;
      yourWebsitesHelp: string;
      noPlanYet: string;
      /** "Growth — renews 21/09/2026" / "Growth — ends 21/09/2026". */
      planRenews: string;
      planEnds: string;
      currentPlan: string;
      accessEnds: string;
      nextInvoice: string;
      onPlan: string;
      noSubscription: string;
      accessEndsOn: string;
      renewsOn: string;
      monthly: string;
      annual: string;
      status: string;
      tryItFirst: string;
      paypalReceipts: string;
      promoCodes: string;
      unlimited: string;
      /**
       * Plan feature lines.
       *
       * Whole sentences per language rather than a count plus a noun: the
       * plural rule and the word order both move, and "1 articles" on the
       * entry plan is the first thing a prospect reads.
       */
      articlesEachMonth: string;
      searchTermsTracked: string;
      oneWebsite: string;
      creditsEachMonth: string;
      paymentReceived: string;
      checkoutCancelled: string;
      purchaseReceived: string;
      purchaseCancelled: string;
      addWebsiteFirst: string;
      checkoutFailed: string;
      /** Section titles; {domain} is the website the page describes. */
      planFor: string;
      choosePlan: string;
      choosePlanFor: string;
      choosePlanHelp: string;
      /** Accessible name of the Monthly / Annual tabs. */
      billingPeriod: string;
      /** After a price. */
      perMonth: string;
      perYear: string;
      /** {n} percent. */
      saveBadge: string;
      /** Plan and portal buttons. */
      switchPlan: string;
      payByCard: string;
      redirecting: string;
      opening: string;
      cancelSubscription: string;
      paypalCheckoutFailed: string;
      portalFailed: string;
      /** {email} becomes a mailto link. */
      managedForYou: string;
      /** Screen-reader note on links that open a new tab. */
      newTab: string;
      /** Upgrade strip: {plan}, and {articles}/{terms}/{credits} are plan feature lines. */
      upgradeLead: string;
      upgradeBody: string;
      upgradeLink: string;
      /** Subscription statuses, Stripe's vocabulary (PayPal mapped onto it). */
      statusActive: string;
      statusTrialing: string;
      statusPastDue: string;
      statusUnpaid: string;
      statusIncomplete: string;
      statusIncompleteExpired: string;
      statusCanceled: string;
      statusPaused: string;
      statusInactive: string;
      /** Notices under the plan summary. */
      pastDueNotice: string;
      unsettledNotice: string;
      endedNotice: string;
      /** Why one processor's buttons are missing. */
      billedByPayPal: string;
      billedByCard: string;
      /** billedByCard once the card subscription is set to end: {date} is its period end. */
      billedByCardEnding: string;
      noPlanChange: string;
      /** Return from PayPal (?paypal=success|cancelled). */
      paypalApproved: string;
      paypalCancelled: string;
      /** {shared}: the shared website on screen, billed by its owner. */
      viewingSharedNote: string;
      /** For someone who owns no website and works on shared ones. */
      guestTitle: string;
      guestBody: string;
      addWebsite: string;
      /** Websites list: open another site's plan, or mark the one shown. */
      viewPlan: string;
      shownBelow: string;
      /** Billing history table. */
      paidByCard: string;
      invoiceInPortal: string;
      dateColumn: string;
      descriptionColumn: string;
      methodColumn: string;
      amountColumn: string;
      receiptColumn: string;
      /** {count}. */
      historyCapped: string;
    };
    article: {
      contentSeo: string;
      contentSeoHelp: string;
      publishAs: string;
      publishLive: string;
      publishDraft: string;
      live: string;
      draft: string;
      articleStyle: string;
      internalLinks: string;
      internalLinksHelp: string;
      targetWordCount: string;
      adaptiveOn: string;
      adaptiveOff: string;
      wordsPerArticle: string;
      contentDetails: string;
      sitemapUrl: string;
      blogAddress: string;
      bestArticle: string;
      engagement: string;
      brandColour: string;
      optional: string;
      imageBrief: string;
      imageBriefPlaceholder: string;
      imageInstructions: string;
      imageInstructionsPlaceholder: string;
      tableOfContents: string;
      comparisonTable: string;
      youtubeVideo: string;
      authorPerspective: string;
      mentionSimilar: string;
      poweredBy: string;
      howWeWrite: string;
      toneLabel: string;
      tonePlaceholder: string;
      rulesLabel: string;
      rulesPlaceholder: string;
      factsLabel: string;
      uspsLabel: string;
      onePerLine: string;
      preferLabel: string;
      preferPlaceholder: string;
      avoidLabel: string;
      avoidPlaceholder: string;
      author: string;
      authorName: string;
      authorNamePlaceholder: string;
      shortBio: string;
      shortBioPlaceholder: string;
      closePreview: string;
      unsavedChanges: string;
      contentDetailsHelp: string;
      engagementHelp: string;
      howWeWriteHelp: string;
      factsHelp: string;
      authorHelp: string;
      noBylineHelp: string;
      /* --- Article Settings page, redesigned (sections A-G) --- */
      pageTitle: string;
      pageDescription: string;
      sectionWriting: string;
      sectionWritingHelp: string;
      sectionSources: string;
      sectionSourcesHelp: string;
      sectionImages: string;
      sectionImagesHelp: string;
      sectionEnhancements: string;
      sectionEnhancementsHelp: string;
      sectionVoice: string;
      sectionVoiceHelp: string;
      sectionAuthor: string;
      sectionAuthorHelp: string;
      /** A stored id that is no longer offered, kept as it is; {value}. */
      unknownOption: string;
      linksError: string;
      wordsError: string;
      sitemapHint: string;
      blogHint: string;
      exampleHint: string;
      urlError: string;
      brandColourHint: string;
      brandColourError: string;
      noColour: string;
      invalidColour: string;
      /** aria-label of the native colour picker. */
      pickColour: string;
      clearColour: string;
      imageStyleLabel: string;
      imageStyleHint: string;
      coverStyleLabel: string;
      coverStyleHint: string;
      samplesNote: string;
      /** Under "Match article images"; {style} is the image style it follows. */
      matchFollows: string;
      matchFollowsUnknown: string;
      /** aria-label of a card's preview button; {style}. */
      previewStyle: string;
      /** Preview dialog title; {style}. */
      previewTitle: string;
      /** Preview dialog title for "Match article images"; {style}. */
      previewMatchTitle: string;
      previewHelp: string;
      /** Alt text of the enlarged example; {style}. */
      sampleAlt: string;
      /** A stored image style not among the cards; {value}. */
      unknownImageStyle: string;
      imageBriefHint: string;
      tocHint: string;
      youtubeHint: string;
      perspectiveHint: string;
      similarHint: string;
      comparisonHint: string;
      poweredByHint: string;
      factsPlaceholder: string;
      uspsPlaceholder: string;
      /** one|many with {count} lines over and {max}. */
      tooManyLines: string;
      /** {line} number and {max} characters. */
      lineTooLong: string;
      fixFields: string;
      saveError: string;
      /** Under the save bar: what the Save button covers. */
      saveBarNote: string;
      autoOnHelp: string;
      autoOffHelp: string;
      anyDay: string;
      pickedDays: string;
      daysUtc: string;
      firstArticleOnly: string;
      networkReview: string;
      openIntegrations: string;
      weekdaysShort: { sun: string; mon: string; tue: string; wed: string; thu: string; fri: string; sat: string };
      weekdaysLong: { sun: string; mon: string; tue: string; wed: string; thu: string; fri: string; sat: string };
      /** Image style cards, by stored id (article-options IMAGE_STYLE_IDS). */
      bodyImageStyles: Record<string, { label: string; hint: string }>;
      /** Cover style cards, by stored id (article-options FEATURED_IMAGE_STYLE_IDS). */
      coverImageStyles: Record<string, { label: string; hint: string }>;
      /** Editorial register options, by id. */
      styles: Record<string, { label: string; hint: string }>;
    };
    editor: {
      backToWebsite: string;
      headings: string;
      words: string;
      keywordUses: string;
      internalLinks: string;
      externalLinks: string;
      socialMentions: string;
      starting: string;
      takesAMinute: string;
      couldNotWrite: string;
      tryAgain: string;
      publishingHistory: string;
      historyHelp: string;
      failed: string;
      viewPost: string;
      editArticle: string;
      editHelp: string;
      /** On Preview while the editor holds changes not saved yet. */
      previewUnsaved: string;
      /** Hover label on a Partner Network link in the article. */
      partnerLink: string;
      /** Above Preview, when the article carries Partner Network links. */
      partnerLinksNote: string;
      title: string;
      metaDescription: string;
      slugLabel: string;
      slugPlaceholder: string;
      slugHelp: string;
      articleContent: string;
      saving: string;
      saveChanges: string;
      saved: string;
      rewriting: string;
      sendAsDraft: string;
      publishedToSite: string;
      sentAsDraftToSite: string;
      viewOnSite: string;
      connectToPublish: string;
      publishViaPlugin: string;
      waitingForPlugin: string;
      updatePost: string;
      publish: string;
      sendingDraft: string;
      planningOutline: string;
      writingBody: string;
      /* The article workspace (redesign 2026-10). {placeholders} are filled with format(). */
      breadcrumbLabel: string;
      targetKeywordLabel: string;
      /** {date} */
      lastSaved: string;
      /** Accessible name of the Preview/Edit tab list. */
      viewModeLabel: string;
      /** Read out on the Edit tab when it holds unsaved changes. */
      unsavedMark: string;
      previewLabel: string;
      previewUnsavedNow: string;
      notWrittenYet: string;
      workingPaused: string;
      conflictTitle: string;
      /** {fields}: the changed fields' names. */
      conflictBody: string;
      conflictLoad: string;
      conflictKeep: string;
      /** Why writing failed, by kind (lib/articles/explain.ts patterns). */
      genUnavailable: string;
      genBusy: string;
      genTimeout: string;
      genUnusable: string;
      genQuota: string;
      genGeneric: string;
      /** Why a publish attempt failed, by provider error kind; provider-neutral. */
      pubErrAuth: string;
      pubErrPermission: string;
      pubErrNotFound: string;
      pubErrUnreachable: string;
      pubErrApiDisabled: string;
      pubErrUnsupported: string;
      pubErrUnknown: string;
      editSaveNote: string;
      titleRequired: string;
      /** {count}: characters a search result usually shows. */
      metaHint: string;
      /** {slug} */
      slugSavedAs: string;
      slugEmptyNote: string;
      slugDropped: string;
      slugWordPressNote: string;
      searchPreviewTitle: string;
      searchPreviewHelp: string;
      saveArticle: string;
      saveNoteWorking: string;
      saveNoteDelivering: string;
      saveNoteReview: string;
      saveNoteTitle: string;
      statsTitle: string;
      statsHelp: string;
      statsUnsaved: string;
      publishingTitle: string;
      publishingHelp: string;
      destinationLabel: string;
      destinationNone: string;
      destinationPlugin: string;
      manageConnection: string;
      plannedLabel: string;
      plannedNone: string;
      autoLabel: string;
      autoOnLive: string;
      autoOnDraft: string;
      autoOff: string;
      beforePlanned: string;
      stateNotSent: string;
      /** {date} on each of the next six. */
      stateLive: string;
      stateDraft: string;
      stateScheduled: string;
      stateDelivered: string;
      stateFailed: string;
      statePluginUnconfirmed: string;
      stateWriting: string;
      stateFrozen: string;
      stateReviewPending: string;
      stateReviewChanged: string;
      stateDelivering: string;
      /** {time} */
      stateQueued: string;
      stateQueuedLong: string;
      checkAgain: string;
      /** {mode}: modeLive or modeDraft. */
      statePluginWaiting: string;
      modeLive: string;
      modeDraft: string;
      statePluginPublished: string;
      stateUncertain: string;
      uncertainPublishNote: string;
      connectHelp: string;
      blockedUnsaved: string;
      alreadySentLive: string;
      alreadySentDraft: string;
      confirmDraftTitle: string;
      confirmDraftBody: string;
      /** {count} */
      historyLatest: string;
      historyEmpty: string;
      logLive: string;
      logDraft: string;
      logScheduled: string;
      logDelivered: string;
      rewriteTitle: string;
      /** {count}: rewrites per website per day. */
      rewriteHelp: string;
      rewriteConfirmTitle: string;
      rewriteConfirmBody: string;
      rewriteConfirmPublished: string;
      rewriteConfirmReview: string;
      rewriteConfirmUnsaved: string;
      rewriteConfirmAction: string;
      rewriteNoPlan: string;
      rewriteBlocked: string;
      /** {remaining} of {max} */
      imagePromptHint: string;
      imageGenerate: string;
      imageReplace: string;
      imageAltHint: string;
      imageCheckAlt: string;
      imageLockedWorking: string;
      imageLockedDelivering: string;
      imageTypeError: string;
      /** {size} and {max}, in MB. */
      imageSizeError: string;
      imageNoAlt: string;
      imageAltSaved: string;
      errInFlight: string;
      errNotWritten: string;
      errConnectFirst: string;
      errNotFound: string;
      errRewriteCap: string;
      errAlreadyWriting: string;
      errNoActivePlan: string;
      errImageStorage: string;
      errImageGeneration: string;
      metaNone: string;
      searchPreviewUnsaved: string;
      imageReviewNote: string;
    };
    analytics: {
      googleResults: string;
      connectHelp: string;
      connectGoogle: string;
      redirecting: string;
      expired: string;
      connected: string;
      last28: string;
      chooseThenImport: string;
      visitorsFromGoogle: string;
      timesAppeared: string;
      averageRanking: string;
      websiteVisits: string;
      whatPeopleSearched: string;
      query: string;
      visitors: string;
      searchConsoleProperty: string;
      analyticsProperty: string;
      chooseProperty: string;
      importing: string;
      disconnected: string;
      statusConnected: string;
      statusCancelled: string;
      statusForbidden: string;
      statusInvalid: string;
      statusError: string;
      /* The redesigned Google Search & Analytics page. */
      pageTitle: string;
      pageDescription: string;
      /** Accessible name of the period links. */
      rangeLabel: string;
      /** A period link, {days}. */
      rangeDays: string;
      /** The period's first and last day, {start} and {end}. */
      periodDates: string;
      connectTitle: string;
      searchConsoleName: string;
      analyticsName: string;
      searchConsolePurpose: string;
      analyticsPurpose: string;
      setupTitle: string;
      setupStep1: string;
      setupStep2: string;
      setupStep3: string;
      readOnlyAccess: string;
      expiredTitle: string;
      reconnectGoogle: string;
      viewerCannotConnect: string;
      connectionTitle: string;
      connectionHelp: string;
      notChosen: string;
      /** Newest day a source reported, {date}. */
      dataThrough: string;
      noFiguresYet: string;
      /** A GA property whose name is not known, {id}. */
      analyticsPropertyId: string;
      importNow: string;
      manageConnection: string;
      viewerSetupPending: string;
      importRequestedTitle: string;
      importRequestedBody: string;
      importStillRunning: string;
      setupNeededTitle: string;
      setupNeededBody: string;
      propertiesTitle: string;
      propertiesHelp: string;
      loadingProperties: string;
      propertiesFailed: string;
      tryAgain: string;
      searchConsoleHint: string;
      analyticsHint: string;
      noSearchConsoleFound: string;
      noAnalyticsFound: string;
      noSearchConsoleProperty: string;
      noAnalyticsProperty: string;
      /** A saved property the account no longer lists, {name}. */
      propertyUnavailable: string;
      saveAndImport: string;
      saveSelection: string;
      selectionUnsaved: string;
      noSelectionChange: string;
      propertiesSaved: string;
      accountTitle: string;
      accountHelp: string;
      disconnect: string;
      disconnecting: string;
      disconnectTitle: string;
      disconnectBody: string;
      disconnectKeeps: string;
      disconnectAccess: string;
      cancel: string;
      disconnectFailed: string;
      importFailed: string;
      googleUnreachable: string;
      errorNotConfigured: string;
      errorSignIn: string;
      errorReconnect: string;
      errorConnectFirst: string;
      errorChooseFirst: string;
      searchTitle: string;
      searchDescription: string;
      analyticsTitle: string;
      analyticsDescription: string;
      clicks: string;
      clicksHint: string;
      impressions: string;
      impressionsHint: string;
      ctr: string;
      ctrShort: string;
      ctrHint: string;
      averagePosition: string;
      positionShort: string;
      positionHint: string;
      sessions: string;
      sessionsHint: string;
      /** {days} */
      comparedWith: string;
      /** {days} */
      noComparison: string;
      noChange: string;
      /** Spoken after a change that is good news. */
      better: string;
      /** Spoken after a change that is bad news. */
      worse: string;
      /** A change in percentage points, {value} already signed. */
      pointsChange: string;
      notAvailable: string;
      /** {reported} of {days} days. */
      daysReported: string;
      zeroSearch: string;
      zeroSessions: string;
      /** {source} is "Google Search Console" or "Google Analytics". */
      staleSource: string;
      /** {source} */
      notSelectedTitle: string;
      notSelectedEditor: string;
      notSelectedViewer: string;
      /** {source} */
      awaitingTitle: string;
      awaitingBody: string;
      /** {source} */
      noneInPeriodTitle: string;
      /** {date} */
      latestFrom: string;
      latestOnly: string;
      dailyTitle: string;
      dailyDescription: string;
      chartMetric: string;
      chartClicks: string;
      chartImpressions: string;
      chartSessions: string;
      unitClicks: string;
      unitImpressions: string;
      unitSessions: string;
      notReported: string;
      day: string;
      chartInstructions: string;
      chartEmpty: string;
      topTitle: string;
      topSearches: string;
      topPages: string;
      searchTerm: string;
      page: string;
      topSearchesNote: string;
      topPagesNote: string;
      topSearchesCaption: string;
      topPagesCaption: string;
      noSearches: string;
      noPages: string;
      opensInNewTab: string;
    };
    research: {
      contentPlan: string;
      articlesTab: string;
      opportunities: string;
      refresh: string;
      looking: string;
      researchFailed: string;
      planReady: string;
      planNotRebuilt: string;
      keywordsAdded: string;
      keywordsAddedSkipped: string;
      replanning: string;
      planBusy: string;
      plannedArticles: string;
      plannedHelp: string;
      articles: string;
      articlesHelp: string;
      nothingWritten: string;
      write: string;
      title: string;
      status: string;
      words: string;
      keywords: string;
      keywordsHelp: string;
      addKeywordsLabel: string;
      addKeywordsButton: string;
      addKeywordsPlaceholder: string;
      addKeywordsHelp: string;
      keyword: string;
      opportunity: string;
      searchesPerMonth: string;
      competition: string;
      topic: string;
      difficultyLow: string;
      difficultyMedium: string;
      difficultyHigh: string;
      difficultyVeryHigh: string;
      researching: string;
      articleDeleted: string;
      statusQueued: string;
      statusGenerating: string;
      statusDraft: string;
      statusPublished: string;
      statusFailed: string;
    };
    publishing: {
      connectTitle: string;
      connectHelp: string;
      nothingConnected: string;
      nothingConnectedHelp: string;
      publishTest: string;
      publishing: string;
      disconnect: string;
      connected: string;
      cantFind: string;
      cantFindHelp: string;
      contactUs: string;
      whereDoIFind: string;
      checkBeforeSaving: string;
      noPlatformMatch: string;
      forDevelopers: string;
      connectTo: string;
      connectedTo: string;
      disconnectedFrom: string;
      draftPublished: string;
      draftPublishedAt: string;
      pluginRowName: string;
      /** The plugin row between creating a key and WordPress first calling. */
      pluginAwaiting: string;
      pluginAwaitingHelp: string;
      pluginRowFallback: string;
    };
    geo: {
      aiVisibility: string;
      aiVisibilityHelp: string;
      checkNow: string;
      checking: string;
      visibilityScore: string;
      weightedByPosition: string;
      vsLastCheck: string;
      questionsNamingYou: string;
      averagePosition: string;
      notYetNamed: string;
      whereYouAppear: string;
      lastChecked: string;
      questionPlaceholder: string;
      add: string;
      suggest: string;
      askHelp: string;
      suggestedQuestions: string;
      noQuestions: string;
      noQuestionsHelp: string;
      notChecked: string;
      notNamed: string;
      stopTracking: string;
      questionAdded: string;
      checkQueued: string;
      alreadyTracking: string;
      /* The redesigned page (ai-visibility/). Refusals mapped from the server's English. */
      checksUnavailableTitle: string;
      errAiUnavailable: string;
      errNoPlan: string;
      errPlanInactive: string;
      errCheckQuota: string;
      errSuggestQuota: string;
      errSuggestFailed: string;
      errTooShort: string;
      /** {count} is the plan's allowance. */
      errAllowance: string;
      errDuplicate: string;
      errAddFirst: string;
      errUnexpected: string;
      /* A check in progress or just ended. */
      statusQueuedTitle: string;
      statusQueuedBody: string;
      statusRunningTitle: string;
      statusRunningBody: string;
      /** {answered} of {total}. */
      statusProgress: string;
      /** {date} with time. */
      statusRequestedAt: string;
      statusCompletedTitle: string;
      statusCompletedBody: string;
      statusPartialTitle: string;
      /** {answered} of {total}. */
      statusPartialBody: string;
      statusTimedOutTitle: string;
      statusTimedOutBody: string;
      /** statusTimedOutBody for a viewer, who cannot run a check. */
      statusTimedOutBodyViewer: string;
      statusFailedTitle: string;
      /** {date} with time. */
      statusFailedBody: string;
      /** statusFailedBody for a viewer, who cannot run a check. {date} with time. */
      statusFailedBodyViewer: string;
      statusRefusedTitle: string;
      dismiss: string;
      progressLabel: string;
      /* Performance section. */
      performanceTitle: string;
      performanceHelp: string;
      howMeasured: string;
      scoreOutOf: string;
      scoreGood: string;
      scoreFair: string;
      scoreLow: string;
      /** {change} is a positive number of points. */
      scoreUp: string;
      scoreDown: string;
      scoreSame: string;
      previousCheckOn: string;
      firstCheck: string;
      /** {mentions} of {total}. */
      namedOfChecked: string;
      namedOfCheckedHelp: string;
      /** {position}, e.g. #2. */
      positionValue: string;
      /** {count} of {total}. */
      answeredInLatestCheck: string;
      /** {checked} of {tracked}. */
      basisNote: string;
      /** one|many with {count}. */
      earlierAnswersNote: string;
      notCheckedYetTitle: string;
      notCheckedYetBody: string;
      competitorsHelp: string;
      /** {count} of {total}. */
      competitorCount: string;
      noCompetitors: string;
      /* The next available action. */
      nextStep: string;
      nextAddQuestions: string;
      nextAddQuestionsAction: string;
      nextFirstCheck: string;
      /** one|many with {count}. */
      nextUnchecked: string;
      /** one|many with {count}. */
      nextStale: string;
      /** one|many with {count}. */
      nextNotNamed: string;
      nextNotNamedAction: string;
      nextUpToDate: string;
      nextWaiting: string;
      nextViewer: string;
      /* Tracked questions. */
      questionsTitle: string;
      questionsHelp: string;
      /** {count} of {max}. */
      allowanceCount: string;
      addQuestionLabel: string;
      /** {max} is the plan's allowance. */
      atAllowance: string;
      suggestionsTitle: string;
      suggestionsHelp: string;
      /** {count} selected. */
      addSelected: string;
      /** one|many with {count}. */
      suggestionsRoom: string;
      /** one|many with {count}. */
      questionsAdded: string;
      questionRemoved: string;
      filterLabel: string;
      filterAll: string;
      filterEmpty: string;
      showAll: string;
      noQuestionsViewer: string;
      named: string;
      /** {position}. */
      namedAt: string;
      /** {date}. */
      checkedOn: string;
      /** {date}. */
      fromEarlierCheck: string;
      checkingNow: string;
      noAnswerInCheck: string;
      answeredInCheck: string;
      siteMentioned: string;
      showEvidence: string;
      hideEvidence: string;
      /** {question}. */
      removeQuestionLabel: string;
      /* Evidence for one answer. */
      evidenceExcerpt: string;
      evidenceExcerptNote: string;
      evidencePosition: string;
      /** {position}. */
      evidencePositionValue: string;
      evidenceNotRecommended: string;
      evidenceWebsite: string;
      evidenceWebsiteYes: string;
      evidenceWebsiteNo: string;
      evidenceOthers: string;
      evidenceNoOthers: string;
      evidenceAssistant: string;
      evidenceChecked: string;
      evidenceHistory: string;
      evidenceNoHistory: string;
      /** {date} of the latest check. */
      evidenceStale: string;
      evidenceMissed: string;
      /* Removing a question. */
      removeTitle: string;
      removeBody: string;
      removeConfirm: string;
      removing: string;
      /* What is measured. */
      methodTitle: string;
      methodHelp: string;
      methodAskTitle: string;
      methodAskBody: string;
      methodRecordTitle: string;
      methodRecordBody: string;
      methodScoreTitle: string;
      /** {second}, {third}, {fourth}: points for those positions. */
      methodScoreBody: string;
      methodCompareTitle: string;
      methodCompareBody: string;
      methodScheduleTitle: string;
      /** {action} is the Check now button's label. */
      methodScheduleBody: string;
      methodAssistantsTitle: string;
      /** {names}. */
      methodAssistantsBody: string;
    };
    backlinks: {
      title: string;
      joinHelp: string;
      capLabel: string;
      capHelp: string;
      join: string;
      leave: string;
      inTheNetwork: string;
      creditsAvailable: string;
      received: string;
      receivedFlow: string;
      givenTitle: string;
      givenFlow: string;
      whichPage: string;
      suggestMyPages: string;
      readingSitemap: string;
      anchorLabel: string;
      anchorPlaceholder: string;
      requesting: string;
      requestLink: string;
      noRequests: string;
      noRequestsHelp: string;
      noneGiven: string;
      sourceArticle: string;
      sourceArticleHint: string;
      customerWebsite: string;
      customerWebsiteHint: string;
      creditsUsed: string;
      creditsUsedHint: string;
      yourArticleHint: string;
      destinationWebsite: string;
      destinationWebsiteHint: string;
      creditsEarned: string;
      creditsEarnedHint: string;
      /** A credit amount not yet settled: placed, not verified live. */
      onceLive: string;
      held: string;
      cancelRequest: string;
      untitledArticle: string;
      joined: string;
      leftNetwork: string;
      requestSaved: string;
      requestCancelled: string;
      statusPending: string;
      statusMatched: string;
      statusLive: string;
      statusCancelled: string;
      statusRemoved: string;
      /** "Hosting up to 5 links a month (2 used). 3 sites available." */
      hosting: string;
      reserved: string;
    };
    dashboard: {
      noWebsite: string;
      noWebsiteHelp: string;
      addWebsite: string;
      couldNotLoad: string;
      couldNotLoadHelp: string;
      overview: string;
      openWebsite: string;
      /** "How example.com is performing in search." */
      performing: string;
      /**
       * The badge on a website someone else shared with the reader:
       * "Shared with you · Editor". {role} is app.dash.roleEditor or
       * app.dash.roleViewer.
       */
      sharedBadge: string;
      /**
       * A shared website whose owner's plan is not active. Neutral on
       * purpose: the reader cannot pay for it, so this names who can fix it
       * rather than offering a checkout. Help takes {domain}.
       */
      ownerPlanInactive: string;
      ownerPlanInactiveHelp: string;
      /** Pending invitations to the reader's verified address. */
      invitesTitle: string;
      /**
       * "{name} invited you to work on {domain} as {role}." {role} is
       * roleAnEditor / roleAViewer, written to fit this sentence in each
       * language (French carries "en tant que" inside it, for the elision).
       * NoName is for an invitation whose sender's account was deleted.
       */
      inviteBody: string;
      inviteBodyNoName: string;
      roleAnEditor: string;
      roleAViewer: string;
      acceptInvite: string;
      /** Toast after accepting: "You now have access to {domain}". */
      inviteAccepted: string;
    };
    calendar: {
      changeTopic: string;
      addInstructions: string;
      removeFromPlan: string;
      instructionsPlaceholder: string;
      previousMonth: string;
      nextMonth: string;
      savedInstructions: string;
      removedFromPlan: string;
      writingStarted: string;
    };
    addons: {
      moreCredits: string;
      moreCreditsHelp: string;
      termsPill: string;
      oneTime: string;
      neverExpire: string;
      useAnytime: string;
      buyThis: string;
      buyCredits: string;
      unavailable: string;
      checkoutFailed: string;
      yourPurchases: string;
      added: string;
      delivered: string;
      inProgress: string;
      requestQuote: string;
      quoteHelp: string;
      /** The add-ons section on Billing. */
      title: string;
      subtitle: string;
      /** {price}. */
      perCredit: string;
      quoteFrom: string;
      servicesTitle: string;
      /** {count}. */
      showingRecent: string;
    };
    referral: {
      referSomeone: string;
      linkLabel: string;
      copy: string;
      copied: string;
      copyFailed: string;
      linkCopied: string;
      creditsEarned: string;
      waitingToConvert: string;
      signedUpNotPaying: string;
      peopleReferred: string;
      someoneReferred: string;
      notEligible: string;
      waiting: string;
      cardDescription: string;
      joinedWithName: string;
      joined: string;
      noWebsiteJoined: string;
      creditsBadge: string;
      linkHelp: string;
      peopleReferredStat: string;
      noReferralsYet: string;
      /** {count}. */
      showingRecent: string;
      /** {date}, after "joined …" on a rewarded referral. */
      rewardedOn: string;
      /** The summary could not be read. */
      unavailable: string;
    };
    keys: {
      updatePlugin: string;
      keyCopied: string;
      keyCopyFailed: string;
      keyRevoked: string;
      newKeyLabel: string;
      /** Deep links into the customer's own WordPress admin. */
      openWordPress: string;
      neverUsed: string;
      pluginTitle: string;
      pluginHelp: string;
      copyNowHelp: string;
      newKey: string;
      keyNotePlaceholder: string;
      nextSteps: string;
      /* "Connect WordPress": a key made at the moment of the click. {placeholders} are filled in by the screen. */
      connectingIn: string;
      stepInstall: string;
      stepInstallHelp: string;
      stepConnect: string;
      stepConnectHelp: string;
      connectButton: string;
      reconnectButton: string;
      waitingTitle: string;
      waitingHelp: string;
      stalledHelp: string;
      openAgain: string;
      copyInstead: string;
      popupBlocked: string;
      connectedTitle: string;
      lastCheckIn: string;
      connectedToast: string;
      alsoIn: string;
      madeByConnect: string;
      advancedTitle: string;
      advancedHelp: string;
      /* Waiting states, and labels shown for keys. quotedName wraps one workspace name. */
      keyReplaced: string;
      waitingResumed: string;
      gaveUp: string;
      notActiveHelp: string;
      madeByHand: string;
      quotedName: string;
    };
    partnerNetwork: {
      title: string;
      subtitle: string;
      participationTitle: string;
      participationHelp: string;
      enabled: string;
      disabled: string;
      whatTitle: string;
      whatBody: string;
      offNote: string;
      inReview: string;
      ratingTitle: string;
      ratingHelp: string;
      ratingUnconfigured: string;
      targetsTitle: string;
      targetsHelp: string;
      addTarget: string;
      urlLabel: string;
      noteLabel: string;
      priorityLabel: string;
      high: string;
      medium: string;
      low: string;
      moveUp: string;
      moveDown: string;
      remove: string;
      noTargets: string;
      targetAdded: string;
      saved: string;
      turnedOn: string;
      turnedOff: string;
      creditsLine: string;
      add: string;
      cancel: string;
      ratingMetric: string;
      ratingNone: string;
      ratingNoneHelp: string;
      ratingSliderLabel: string;
      ratingCurrent: string;
      ratingScaleOnly: string;
      ratingSave: string;
      ratingSaved: string;
      ratingNoAccess: string;
    };
    reports: {
      subnavLabel: string;
      navOverview: string;
      navEarned: string;
      navHosted: string;
      navCredits: string;
      authorityLabel: string;
      authorityValueAria: string;
      authorityUpdated: string;
      authorityStale: string;
      authorityCollecting: string;
      authorityNoAccess: string;
      authorityNoData: string;
      authorityError: string;
      authorityNotConfigured: string;
      authorityWhat: string;
      authorityHelp: string;
      authorityDetail: string;
      authorityUnavailableDetail: string;
      rankStaleTitle: string;
      unknownShort: string;
      unknownRank: string;
      issueHosted: string;
      issueHostedHelp: string;
      issueReceived: string;
      issueReceivedHelp: string;
      reviewResolve: string;
      dismiss: string;
      issueFilterGiven: string;
      issueFilterReceived: string;
      issueNofollowHosted: string;
      issueNofollowHostedHelp: string;
      issueNofollowReceived: string;
      issueNofollowReceivedHelp: string;
      issueFilterNofollowGiven: string;
      issueFilterNofollowReceived: string;
      nofollowBadge: string;
      overviewTitle: string;
      overviewIntro: string;
      portfolioTitle: string;
      verifiedBacklinks: string;
      referringDomains: string;
      strongestLink: string;
      strongestHelp: string;
      last30Days: string;
      newInWindowHelp: string;
      estimatedValue: string;
      estimateNotConfigured: string;
      estimateNotConfiguredHelp: string;
      howEstimated: string;
      estimateMethod: string;
      unvaluedLinks: string;
      mostRecentLinks: string;
      colVerified: string;
      verifiedDateHelp: string;
      noVerifiedYet: string;
      pipeline: string;
      seeAllBacklinks: string;
      creditsCardTitle: string;
      creditActivity: string;
      creditsAvailableLine: string;
      recoverFromArticles: string;
      buyCredits: string;
      creditsHowItWorks: string;
      creditsScopeNote: string;
      creditsOwnerOnly: string;
      receivedSectionTitle: string;
      receivedFlow: string;
      givenSectionTitle: string;
      givenFlow: string;
      seeAllCount: string;
      earnedTitle: string;
      earnedIntro: string;
      hostedTitle: string;
      hostedIntro: string;
      statusFilterLabel: string;
      tabAll: string;
      tabVerified: string;
      tabPending: string;
      tabRefunded: string;
      typeLabel: string;
      typeAll: string;
      typeManaged: string;
      typeExchange: string;
      resultCount: string;
      recoverFrom: string;
      recoverQueued: string;
      searchLabel: string;
      searchPlaceholder: string;
      dateFrom: string;
      dateTo: string;
      apply: string;
      clearFilters: string;
      dateMeaning: string;
      colDate: string;
      colLink: string;
      colDestination: string;
      colAuthority: string;
      colValue: string;
      colCredits: string;
      colAiCitation: string;
      colStatus: string;
      colDetails: string;
      aiCitationHelp: string;
      aiNotMeasured: string;
      aiCitations: string;
      aiCitationsDetail: string;
      emptyFiltered: string;
      emptyReceived: string;
      emptyGiven: string;
      unknownWebsite: string;
      untitled: string;
      dateUnknown: string;
      valueNotApplicable: string;
      showDetails: string;
      hideDetails: string;
      loading: string;
      sortable: string;
      sortedAsc: string;
      sortedDesc: string;
      paginationLabel: string;
      showingRange: string;
      perPage: string;
      prev: string;
      next: string;
      pageOf: string;
      valueFootnote: string;
      lcVerified: string;
      lcAwaitingPublication: string;
      lcAwaitingVerification: string;
      lcNotFound: string;
      lcRemoved: string;
      lcWithdrawn: string;
      lcUnknown: string;
      eventVerified: string;
      eventRemoved: string;
      eventPublished: string;
      eventPlaced: string;
      eventUnknown: string;
      creditSettled: string;
      creditEarned: string;
      creditReserved: string;
      creditPending: string;
      creditRefunded: string;
      creditReversed: string;
      creditNone: string;
      dSourceArticle: string;
      dYourArticle: string;
      dSourceSite: string;
      dDestinationSite: string;
      dYourPage: string;
      dDestinationPage: string;
      dAnchor: string;
      dType: string;
      dRel: string;
      dPublished: string;
      dFirstVerified: string;
      dRemoved: string;
      dLastCheck: string;
      dAuthority: string;
      dValue: string;
      dAiCitation: string;
      dCredits: string;
      opensNewTab: string;
      notPublishedYet: string;
      anchorHidden: string;
      relUnknown: string;
      relFollowed: string;
      relUnfollowed: string;
      notYet: string;
      checkAlive: string;
      checkMissing: string;
      checkError: string;
      fvFromCheck: string;
      fvFromLedger: string;
      valueDetail: string;
      noCreditMovements: string;
      adviceNotFoundGiven: string;
      adviceNotFoundReceived: string;
      adviceAwaitingVerification: string;
      adviceAwaitingPublicationGiven: string;
      adviceAwaitingPublicationReceived: string;
      adviceRemoved: string;
      recheck: string;
      recheckRecover: string;
      recheckQueued: string;
      recheckRevived: string;
      recheckAlreadyQueued: string;
      recheckCooldown: string;
      creditsTitle: string;
      creditsIntro: string;
      creditsSummary: string;
      creditsAvailable: string;
      creditsReservedLabel: string;
      creditsReservedHelp: string;
      creditsBalance: string;
      creditsEarnedTotal: string;
      creditsSpentTotal: string;
      creditsRefundedTotal: string;
      colEntry: string;
      colWebsite: string;
      creditsEmpty: string;
      workspaceWide: string;
      ledgerPlanGrant: string;
      ledgerLinkGiven: string;
      ledgerLinkReceived: string;
      ledgerRefund: string;
      ledgerPurchase: string;
      ledgerReferral: string;
      ledgerReferralReversed: string;
      ledgerReversal: string;
      ledgerAdjustment: string;
      sectionUnavailable: string;
      websiteAuthority: string;
      backlinksHeading: string;
      openBacklinks: string;
      partnerNetworkLabel: string;
      getCredits: string;
      verifiedBacklinksLabel: string;
      availableCredits: string;
      ownerOnlyShort: string;
      chartActiveLinks: string;
      unitLinks: string;
      noData: string;
      chartInstructions: string;
      undatedLinks: string;
      todaysArticle: string;
      nothingWritten: string;
      openContentPlan: string;
      stPublished: string;
      stAwaitingReview: string;
      stAwaitingReviewHelp: string;
      stApproved: string;
      stApprovedHelp: string;
      stApprovedNoDate: string;
      stScheduled: string;
      stScheduledHelp: string;
      stDraft: string;
      stDraftHelp: string;
      stWriting: string;
      stFailed: string;
      searchVolume: string;
      perMonth: string;
      difficulty: string;
      articleType: string;
      intentCommercial: string;
      intentTransactional: string;
      intentInformational: string;
      intentNavigational: string;
      whyThisTopic: string;
      whyWithVolume: string;
      whyKeyword: string;
      winsTitle: string;
      winsCount: string;
      noWins: string;
      winPublished: string;
      winPublishedDetail: string;
      winLinksReceived: string;
      winLinksReceivedDetail: string;
      winLinksGiven: string;
      winLinksGivenDetail: string;
      winAudit: string;
      winAuditDetail: string;
      winClicks: string;
      winClicksDetail: string;
      view: string;
      bestArticles: string;
      bestArticlesHelp: string;
      openGoogleResults: string;
      connectSearchConsole: string;
      connect: string;
      noArticleTraffic: string;
      colArticle: string;
      colClicks: string;
      colImpressions: string;
      colPosition: string;
      colSessions: string;
      colFirstPublished: string;
      colKeywordCpc: string;
      searchConsoleThrough: string;
      analyticsThrough: string;
      connectAnalytics: string;
      achievements: string;
      valueHeadline: string;
      valueHeadlineUnconfigured: string;
      achievementsIntro: string;
      lastNDays: string;
      plusArticles: string;
      plusBacklinks: string;
      rangeLabel: string;
      rangeDays: string;
      range12m: string;
      viewLabel: string;
      chart: string;
      details: string;
      metricLabel: string;
      trafficValue: string;
      trafficValueHelp: string;
      backlinkValue: string;
      backlinkValueHelp: string;
      articlesPublished: string;
      articlesPublishedHelp: string;
      articleImpressions: string;
      articleImpressionsHelp: string;
      articleClicks: string;
      articleClicksHelp: string;
      articleSessions: string;
      articleSessionsHelp: string;
      notConnected: string;
      notConfiguredShort: string;
      currencyMismatch: string;
      websiteHealth: string;
      websiteHealthHelp: string;
      noSeries: string;
      utcDays: string;
      unitArticles: string;
      unitClicks: string;
      unitImpressions: string;
      unitSessions: string;
      breakdownCaption: string;
      breakdownShowing: string;
      unknownPublicationDates: string;
      noPublishedArticles: string;
      methodologyTitle: string;
      methodologyPolicy: string;
      methodologyCpc: string;
      methodologyFixed: string;
      methodologyNoTraffic: string;
      methodologyBacklinks: string;
      methodologyNoBacklinks: string;
      methodologySources: string;
      methodologyExcluded: string;
      methodologyNotSavings: string;
      searchPerformance: string;
      websiteTraffic: string;
      aiSearch: string;
      aiNoChecks: string;
      openAiVisibility: string;
      aiChecks: string;
      aiMentioned: string;
      aiCited: string;
      aiReferralNotMeasured: string;
      googleTraffic: string;
      connectSearchConsoleTraffic: string;
      siteClicks: string;
      siteImpressions: string;
      avgPosition: string;
      vsPrevious: string;
      siteWideThrough: string;
      uncertainTitle: string;
      uncertainHelp: string;
      uncertainConfirm: string;
      uncertainConfirmed: string;
      lcNotFoundGiven: string;
      lcRemovedGiven: string;
    };
    image: {
      altLabel: string;
      altPlaceholder: string;
      promptLabel: string;
      promptPlaceholder: string;
      noRegensLeft: string;
      imageReady: string;
      imageUploaded: string;
      imageRemoved: string;
    };
    profile: {
      businessDetails: string;
      detailsHelp: string;
      correctAnything: string;
      fillsIn: string;
      brandName: string;
      brandNamePlaceholder: string;
      industry: string;
      industryPlaceholder: string;
      country: string;
      countryPlaceholder: string;
      audience: string;
      audiencePlaceholder: string;
      mainLanguage: string;
      description: string;
      descriptionPlaceholder: string;
      saveDetails: string;
      saving: string;
      detailsSaved: string;
      /*
        Business settings page (redesign). The keys above stay for
        website-detail-client.tsx; the page itself reads the ones below.
      */
      /** Browser tab and page heading. */
      pageTitle: string;
      /** Under the heading; {domain} is the website. */
      pageDescription: string;
      identityTitle: string;
      identityHelp: string;
      marketTitle: string;
      marketHelp: string;
      descriptionTitle: string;
      descriptionHelp: string;
      competitorsTitle: string;
      /** Must not promise uses the product does not make of the list. */
      competitorsHelp: string;
      brandNameHint: string;
      industryHint: string;
      /** An ENGLISH country name in every locale: keyword research matches English names only. */
      marketPlaceholder: string;
      countryHint: string;
      /** Warning under the market field when it holds a non-English country name. */
      marketNotEnglish: string;
      /** Button that replaces it; {country} is the English name. */
      marketUseEnglish: string;
      articleLanguage: string;
      articleLanguageHint: string;
      /** {language} is the dashboard language, named in that language. */
      dashboardLanguageNote: string;
      dashboardLanguageLink: string;
      /** Shown while no article language is stored. */
      chooseLanguage: string;
      /** A stored language outside the list; {language} is the stored value. */
      unknownLanguage: string;
      audienceHint: string;
      descriptionHint: string;
      /** A viewer's read-only value when nothing is stored. */
      notSet: string;
      /** Section-navigation badge for a section with unsaved edits. */
      unsavedBadge: string;
      /** The Save bar's button. */
      saveBusinessDetails: string;
      /** Under the Save bar: what it saves and what saves on its own. */
      saveScope: string;
      /** A save that failed without an answer from the server. */
      saveError: string;
      checklistNeedsBoth: string;
      checklistNeedsDescription: string;
      checklistNeedsLanguage: string;
      analysingTitle: string;
      analysingBody: string;
      analysingBodyReadOnly: string;
      refresh: string;
      analysisFailedTitle: string;
      analysisFailedBody: string;
      analysisFailedBodyReadOnly: string;
      /** Owners only: retry lives on the Websites list. */
      analysisFailedRetry: string;
      goToWebsites: string;
      /** one|many with {count}. */
      competitorCount: string;
      manualGroup: string;
      suggestedGroup: string;
      suggestedGroupHelp: string;
      suggestedGroupHelpReadOnly: string;
      competitorsEmpty: string;
      competitorsEmptyAnalysed: string;
      competitorsEmptyAnalysing: string;
      /** {count} is how many are shown. */
      competitorsTruncated: string;
      addCompetitor: string;
      addCompetitorHint: string;
      competitorPlaceholder: string;
      addCompetitorButton: string;
      checkingShort: string;
      /** {domain} in each of the next six. */
      checkingCompetitor: string;
      competitorAdded: string;
      removingCompetitor: string;
      competitorRemoved: string;
      visitCompetitor: string;
      removeCompetitor: string;
      competitorRequired: string;
      competitorInvalid: string;
      competitorOwnSite: string;
      /** {domain} */
      competitorDuplicate: string;
      competitorNotPublic: string;
      /** The server's refusal of social networks and large platforms. */
      competitorBlocked: string;
      /** {domain} */
      competitorUnreachable: string;
      actionFailed: string;
    };
    setup: {
      launchChecklist: string;
      allLive: string;
      finishSetup: string;
      allLiveHelp: string;
      /** "2 steps left before everything runs on its own." */
      stepsLeft: string;
    };
    common: {
      cancel: string;
      done: string;
      edit: string;
      preview: string;
      connect: string;
      checking: string;
      discard: string;
      revoke: string;
      failed: string;
      images: string;
      rewrite: string;
      tryAgain: string;
      somethingWentWrong: string;
      remove: string;
      upload: string;
      disconnect: string;
      competitors: string;
      websiteHealth: string;
      checkingWebsite: string;
      nothingNeedsAttention: string;
      requestQuote: string;
      wantUsToFix: string;
      saveProperties: string;
      appeared: string;
      noImageYet: string;
      notScheduled: string;
      nothingPlanned: string;
      /** The confirm bar for article settings nobody has changed. */
      defaultsAreFine: string;
      keepDefaults: string;
      /** The calendar tab when no plan has been built yet. */
      noPlanYet: string;
      noPlanYetHaveKeywords: string;
      buildPlan: string;
      requestLink: string;
      admin: string;
      articleLanguageHelp: string;
      namedInstead: string;
      mostPopular: string;
      receiptInPayPal: string;
      noCharge: string;
      close: string;
      copied: string;
      openMenu: string;
      changeLanguage: string;
      brandHome: string;
      skipped: string;
      hideSetupSteps: string;
      setupProgress: string;
      secureCheckout: string;
      skipForNow: string;
      verifiedCustomer: string;
      searchYourImages: string;
      critical: string;
      suggestion: string;
      warning: string;
      importData: string;
      auditIntro: string;
      losingTrafficIntro: string;
      noCompetitorsFound: string;
      competitorsHelp: string;
      connectWebsiteFirst: string;
      generationHelp: string;
      altHelp: string;
      featuredImageHelp: string;
      factsOnePerLine: string;
      voiceBehindArticles: string;
      creditsExplainer: string;
      articleInProgress: string;
      researchIntro: string;
      noCreditsLeft: string;
      promoCodesHelp: string;
      write: string;
      writingAndPublishing: string;
      featuredImage: string;
      backlinksLabel: string;
      uploadLabel: string;
      aiAssistantsTracked: string;
      freshArticles: string;
      toSetUp: string;
      trustedByBusinesses: string;
      weekly: string;
      twoMinutes: string;
      notAvailable: string;
      notAvailableHelp: string;
      backToDashboard: string;
      viewWebsites: string;
      goToDashboard: string;
      setUp: string;
      setUpHelp: string;
      manageBilling: string;
      manageInPayPal: string;
      payWithPayPal: string;
      noPlans: string;
      billingHistory: string;
      billingHistoryHelp: string;
      invoice: string;
      downloadPlugin: string;
      /** Link to the step-by-step plugin guide, beside the download. */
      pluginGuide: string;
      cantFindIntegration: string;
      adaptive: string;
      custom: string;
      wordRange: string;
      findOpportunities: string;
      noOpportunities: string;
      losingTraffic: string;
      notWrittenHere: string;
      nothingLosing: string;
      nothingLosingHelp: string;
      losingClicksTitle: string;
      losingClicksHelp: string;
      losingVisibilityTitle: string;
      losingVisibilityHelp: string;
      watchTitle: string;
      watchHelp: string;
      noClickLosses: string;
      clicksChange: string;
      percentDown: string;
      percentUp: string;
      rankingChange: string;
      shownChange: string;
      windowNote: string;
      writeAutomatically: string;
      daysToWrite: string;
      publishWithoutAsking: string;
      whenFinished: string;
      finishedReview: string;
      finishedReviewHelp: string;
      finishedDraft: string;
      finishedDraftHelp: string;
      finishedLive: string;
      finishedLiveHelp: string;
      firstArticleNote: string;
    };
    nav: {
      dashboard: string;
      setUp: string;
      plannedArticles: string;
      backlinkExchange: string;
      websiteHealth: string;
      googleResults: string;
      googleConnect: string;
      aiVisibility: string;
      losingTraffic: string;
      settings: string;
      addons: string;
      main: string;
      referralProgram: string;
      business: string;
      articleSettings: string;
      integrations: string;
      account: string;
      billing: string;
      settingsSections: string;
    };
    status: {
      pending: string;
      crawling: string;
      researching: string;
      generated: string;
      ready: string;
      queued: string;
      running: string;
      completed: string;
      planned: string;
      draft: string;
      generating: string;
      published: string;
      publish: string;
      scheduled: string;
      connected: string;
      disconnected: string;
      live: string;
      removed: string;
      matched: string;
      active: string;
      inactive: string;
      cancelled: string;
      expired: string;
      paid: string;
      rewarded: string;
      refunded: string;
      fulfilled: string;
      failed: string;
      rejected: string;
      missing: string;
    };
    editorUi: {
      bold: string;
      italic: string;
      strikethrough: string;
      heading: string;
      subheading: string;
      bulletedList: string;
      numberedList: string;
      quote: string;
      code: string;
      addLink: string;
      removeLink: string;
      insertImage: string;
      undo: string;
      redo: string;
      chooseImage: string;
      articleHtml: string;
      noImageSelected: string;
      pickOneBelow: string;
      closeImagePicker: string;
      imageAlt: string;
      imageAltPlaceholder: string;
      replaceImage: string;
      saveImage: string;
      noMatches: string;
      noPicturesYet: string;
      /* The workspace toolbar (RichTextEditor variant="workspace"). */
      toolbarLabel: string;
      groupText: string;
      groupHeadings: string;
      groupBlocks: string;
      groupLinks: string;
      groupMedia: string;
      groupHistory: string;
      linkDialogTitle: string;
      linkDialogHelp: string;
      linkUrlLabel: string;
      linkApply: string;
      linkInvalid: string;
      htmlHint: string;
      richHint: string;
      editHtml: string;
      backToEditor: string;
      htmlToolbarOff: string;
    };
    dash: {
      bestArticles: string;
      bestArticlesHelp: string;
      openGoogleResults: string;
      connectForPages: string;
      clicks: string;
      impressions: string;
      position: string;
      searchPerformance: string;
      websiteTraffic: string;
      aiSearchTraffic: string;
      googleTraffic: string;
      vsLastMonth: string;
      averagePosition: string;
      connectForClicks: string;
      achievements: string;
      achievementsHelp: string;
      last30Days: string;
      adSpendSaved: string;
      adSpendHelp: string;
      backlinkCostSaved: string;
      showedUpHelp: string;
      visitorsFromArticles: string;
      siteHealth: string;
      siteHealthHelp: string;
      websiteAuthority: string;
      backlinks: string;
      openBacklinks: string;
      backlinkExchange: string;
      getCredits: string;
      verifiedBacklinks: string;
      availableCredits: string;
      noLinksYet: string;
      todaysArticle: string;
      nothingWrittenYet: string;
      openContentPlan: string;
      searchVolume: string;
      difficulty: string;
      articleType: string;
      whyThisTopic: string;
      view: string;
      addAWebsite: string;
      /** Heading of the switcher's group of websites shared with the reader. */
      sharedWithYou: string;
      /**
       * ONE shared website, with the reader's role: the switcher trigger's
       * tooltip and accessible name. Singular where sharedWithYou, a group
       * heading, is plural ("Partagé avec vous" vs "Partagés avec vous").
       * {role} is roleEditor or roleViewer.
       */
      sharedSiteLabel: string;
      /** Role chips beside a shared website, and {role} in sharedBadge. */
      roleEditor: string;
      roleViewer: string;
    };
    wpConnect: {
      title: string;
      signedInAs: string;
      goneTitle: string;
      goneBody: string;
      otherBrowserTitle: string;
      otherBrowserBody: string;
      noneTitle: string;
      noneBody: string;
      addWebsite: string;
      useOtherAccount: string;
      confirmTitle: string;
      confirmBody: string;
      inWorkspace: string;
      movedWarning: string;
      movedWarningNamed: string;
      connect: string;
      connectAgain: string;
      move: string;
      cancel: string;
      tooManyKeys: string;
      notAllowed: string;
    };
    auth: {
      redirecting: string;
      continueWithGoogle: string;
      orContinueWithEmail: string;
      fullName: string;
      namePlaceholder: string;
      email: string;
      emailPlaceholder: string;
      password: string;
      passwordHint: string;
      /** Shown when Better Auth answers 429 (lib/auth/rate-limit.ts). */
      tooManyAttempts: string;
      /** A new password over MAX_PASSWORD_LENGTH (lib/auth/password-policy.ts). */
      passwordTooLong: string;
      emailMeACode: string;
      usePasswordInstead: string;
      sendCode: string;
      sendingCode: string;
      codeLabel: string;
      codePlaceholder: string;
      codeHelp: string;
      verifyCode: string;
      verifying: string;
      resendCode: string;
      useDifferentEmail: string;
      codeSent: string;
      codeNotSent: string;
      codeInvalid: string;
      enterEmailFirst: string;
      organizations: string;
      loading: string;
      createOrganization: string;
      orgHelp: string;
      name: string;
      orgPlaceholder: string;
      cancel: string;
      notifications: string;
      markAllRead: string;
      nothingYet: string;
      unread: string;
    };
    onboarding: {
      whatsYourWebsite: string;
      websiteIntro: string;
      websiteAddress: string;
      websitePlaceholder: string;
      lookUpWebsite: string;
      detected: string;
      addingWebsite: string;
      continueLabel: string;
      pressArrow: string;
      readingWebsite: string;
      websiteFound: string;
      enterAddressToSee: string;
      regionNext: string;
      weWillUseWebsite: string;
      activateRepGet: string;
      seeHowAiTalks: string;
      trackQuestions: string;
      trackingOn: string;
      noAssistants: string;
      questionsWorthTracking: string;
      suggestedFromSite: string;
      writingQuestions: string;
      noQuestionsYet: string;
      addQuestionPlaceholder: string;
      addQuestion: string;
      writing: string;
      suggestMore: string;
      getStarted: string;
      setupProgress: string;
      readingNow: string;
      view: string;
      goToDashboard: string;
      searchOpportunities: string;
      topicClusters: string;
      publishingPlan: string;
      articlesContentBacklinks: string;
      heresWhatWellBuild: string;
      thenOnChecklist: string;
      buildMyPlan: string;
      starting: string;
      takesFewMinutes: string;
      connectGoogle: string;
      analyticsTellUs: string;
      connectedChangeLater: string;
      openingGoogle: string;
      whyWeAsk: string;
      readPerformanceOnly: string;
      connected: string;
      plansUnavailable: string;
      growthEngineReady: string;
      plan: string;
      payYearly: string;
      paypalNoTrial: string;
      cancelAnyTime: string;
      whatsIncluded: string;
      secureByStripe: string;
      paymentTakingLonger: string;
      activatingNow: string;
      goToMyWebsite: string;
      checkBilling: string;
      extraordinaryBusinesses: string;
      chooseYourPlan: string;
      whatHappensSubscribe: string;
      weResearchKeywords: string;
      contentAndBacklinks: string;
      addYourWebsite: string;
    };
  };
};

const en: Messages = {
  nav: {
    howItWorks: "How it works",
    freeCheck: "Free check",
    tools: "Tools",
    pricing: "Pricing",
    blog: "Blog",
    faq: "FAQ",
    about: "About",
    signIn: "Sign in",
    getStarted: "Get started",
    contact: "Contact",
    successStories: "Success Stories",
    getStartedCta: "Get Started",
    platform: "Platform",
    platformHeading: "Explore the platform",
    platformItems: [
      {
        title: "Content Engine",
        detail:
          "Plan and generate articles designed to grow organic visibility.",
      },
      {
        title: "Authority Network",
        detail: "Build relevant backlinks and strengthen domain authority.",
      },
      {
        title: "Site Intelligence",
        detail: "Find technical and SEO issues affecting your performance.",
      },
      {
        title: "Search Performance",
        detail: "Track rankings, visibility and results across Google.",
      },
      {
        title: "AI Presence",
        detail:
          "Monitor how often your brand appears across ChatGPT, Claude, Perplexity and AI search.",
      },
      {
        title: "Traffic Recovery",
        detail: "Identify declining pages before valuable traffic disappears.",
      },
    ],
  },
  footer: {
    tagline: "SEO results for small businesses, without the agency.",
    product: "Product",
    legal: "Legal",
    freeCheck: "Free website check",
    freeTools: "Free tools",
    pricing: "Pricing",
    blog: "Blog",
    faq: "FAQ",
    about: "About",
    contact: "Contact",
    backlinkExchange: "Backlink exchange",
    publishers: "Monetize your blog",
    affiliate: "Refer a business",
    privacy: "Privacy",
    terms: "Terms",
    refunds: "Refunds",
  },
  home: {
    eyebrow: "Get ranked. Get cited. Get recommended.",
    title: "Rank on Google. Show up in AI answers",
    subtitle:
      "RepGet publishes SEO content, earns quality backlinks, and builds the authority that gets your business discovered.",
    checkFree: "Check my website for free",
    getStarted: "Get Started",
    noCard: "No card required to run your first check.",
    auditBand: "Free with your audit",
    auditItems: [
      {
        title: "SEO & AI audit",
        body: "See your site's health, what is missing, and whether AI assistants mention you.",
      },
      {
        title: "A plan to act on",
        body: "The specific changes worth making, in the order worth making them.",
      },
      {
        title: "Your first backlink",
        body: "One link from a real business in a related field, earned rather than bought.",
      },
    ],
    auditPlaceholder: "Enter your website",
    auditAssurances: ["No account needed", "Nothing to cancel"],
    checkMyWebsite: "Check my website",
    howItWorks: "How it works",
    steps: [
      {
        title: "Audit",
        body: "We read your website, find what is holding it back, and check whether AI assistants mention you.",
      },
      {
        title: "Connect",
        body: "Link your site - WordPress, Ghost, Shopify or a webhook - so we can publish for you.",
      },
      {
        title: "Grow",
        body: "We research, write and publish, then show you what actually changed.",
      },
    ],
    problemsEyebrow: "Problems & solution",
    yourProblem: "Your problem",
    ourSolution: "Our solution",
    problems: [
      "Paid ads drain your budget every month - and stop the moment you do.",
      "Hours lost juggling audits, keywords, content and a stack of separate tools.",
      "AI assistants recommend your competitors, and you never find out.",
    ],
    solutionTitle: "Everything you need, in one place",
    solution: [
      "Full SEO and AI-readiness audit",
      "AI visibility tracking across assistants",
      "Keyword and market research",
      "Articles written for you, published automatically",
      "Backlinks earned from real businesses",
    ],
    stackEyebrow: "Us vs. a stack of tools",
    stackTitle: "One subscription replaces",
    stackTitleAccent: "your whole SEO stack",
    stackSub:
      "Audit, AI visibility, research, content, publishing, backlinks and reporting - in one place, for less than the tools cost separately.",
    seePricing: "See pricing",
    replaces: [
      "SEO audit and site crawl",
      "AI visibility tracking",
      "Keyword and market research",
      "Written, optimised articles",
      "Publishing to your CMS",
      "Backlink building",
      "Search Console and Analytics reporting",
    ],
    publishesTitle: "Publishes",
    publishesAccent: "directly",
    publishesTitleEnd: "to your site",
    publishesSub:
      "Connect once. No manual uploads, no copy-paste - articles appear on your site automatically, with their images.",
    publishesPlugin:
      "Our WordPress plugin connects with one key, and works even if your host blocks the WordPress API.",
    platformOther: "Any site via webhook",
    trackedTitle: "You see exactly what changed",
    trackedSub:
      "Not a monthly PDF. A dashboard reading your own Search Console and Analytics data.",
    tracked: [
      { label: "Rankings and clicks", detail: "From Search Console" },
      { label: "AI visibility", detail: "Whether assistants name you" },
      { label: "Backlinks earned", detail: "Checked every day" },
      { label: "Articles published", detail: "And what they did" },
    ],
    pillars: [
      {
        title: "Publish SEO content",
        body: "High-quality articles generated and optimised for your niche.",
      },
      {
        title: "Build real backlinks",
        body: "Get cited on relevant websites to increase your authority.",
      },
      {
        title: "Track your progress",
        body: "See rankings, traffic and results in one simple dashboard.",
      },
      {
        title: "Save time with AI",
        body: "Let AI do the work, while you focus on your business.",
      },
    ],
    previewTitle: "Your growth, on autopilot.",
    previewSub: "High-quality content. Real backlinks. More visibility.",
    previewCaption:
      "An example dashboard. Your own figures start at zero and grow from there.",
    titleLead: "Rank on Google.",
    titleAccent: "Show up in AI answers.",
    heroCards: [
      { label: "Rankings and clicks", detail: "From Search Console" },
      { label: "AI visibility", detail: "Whether assistants name you" },
      { label: "Traffic growth", detail: "Reach more customers" },
      { label: "Visible in AI answers", detail: "Show up where it matters" },
      { label: "Quality backlinks", detail: "Get cited by real websites" },
      { label: "Keyword tracking", detail: "See what is working" },
    ],
    joinGoogle: "Join with Google",
    seeHow: "See how it works",
    videoTitle: "See RepGet in two minutes",
    videoSub:
      "A short walkthrough of what happens after you connect a website.",
    videoComingSoon:
      "The walkthrough video is being recorded. In the meantime, the free check shows you the same thing on your own site.",
    worksWithTitle: "Works with the tools you already use",
    networkEyebrow: "A vetted backlink network",
    networkTitle: "A backlink network",
    networkTitleRest: "that gets stronger with every new customer.",
    networkHeading: "Automated link exchange",
    networkPoints: [
      "Every customer both gives and receives links",
      "Links come from businesses in a related field, never unrelated ones",
      "Placed inside real articles, not a page of links",
      "Checked daily - if a link is removed, tell us and your credit comes back",
    ],
    networkHowLink: "How the exchange works",
    pricingEyebrow: "Pricing",
    pricingTitle: "Start small.",
    pricingTitleAccent: "Grow when you are ready.",
    pricingSub:
      "A free check to start, no contract, and cancel whenever you like.",
    seeAllPlans: "See everything included in each plan",
    mostPopular: "Most popular",
    tryItFirst: "Try it first",
    getStartedPlan: "Get started",
    perMonth: " / month",
    unavailable:
      "Pricing is not available right now. Please check back shortly.",
    planArticles: "{n} article each month|{n} articles each month",
    planBacklinks: "Backlinks from our partner network",
    planPublishing: "Auto-publish to WordPress, Shopify and more",
    closingTitle: "Start growing on autopilot today",
    closingSub:
      "Run a free check on your website and see what is holding it back. No account needed.",
    cancelAnytime: "Cancel any time",
    guarantee: "14-day money-back guarantee",
  },
  pricing: {
    title: "Simple pricing",
    subtitle:
      "Everything is included in every plan. The difference is how much we write for you each month - and how many backlinks you get from our partner network.",
    perMonth: " / month",
    getStarted: "Get started",
    mostPopular: "Most popular",
    tryItFirst: "Try it first",
    starterTagline:
      "Try us with a real article and a real backlink before moving up.",
    unavailable:
      "Pricing is not available right now. Please check back shortly.",
    annualNote:
      "Annual plans are available once you sign up, at two months free. Cancel any time - see our",
    refundPolicy: "refund policy",
    features: {
      articles: "{n} article written each month|{n} articles written each month",
      keywords: "{n} search terms tracked",
      backlinks: "Backlinks from our partner network",
      audit: "Site audit, so your pages are AI- and Google-ready",
      healthChecks: "Website health checks",
      publishing: "Publish to WordPress, Ghost or Shopify",
    },
  },
  about: {
    metaTitle: "About",
    metaDescription: "Why RepGet exists and who it is for.",
    title: "SEO results without the agency",
    intro: [
      'A dentist, a plumber or a small law firm knows they should "do SEO". What that actually needs is a keyword researcher, a writer, someone who understands technical audits, and outreach for links. An agency bundles all of that for a few thousand a month.',
      "Most small businesses cannot justify that, so they do nothing - and stay invisible on exactly the searches that would bring them customers.",
      "We built this to do that work automatically, for a price a small business can actually pay.",
    ],
    beliefTitle: "What we believe",
    beliefLead: "Only recommend what you can realistically win.",
    belief: [
      "A search term used 12,000 times a month is worthless to you if you have no chance of ranking for it. One used 300 times, by someone ready to buy, can bring you a customer next month.",
      "That principle is built into the product, not just written here. Our scoring deliberately ranks winnable terms above popular ones, and weighs whether the searcher actually intends to buy. Our link matching refuses to pair a dentist with an unrelated website, even when the numbers look good.",
      "A tool that produces impressive-looking work nobody will ever find is worse than useless. It takes money and delivers nothing.",
    ],
    audienceTitle: "Who it is for",
    audience:
      'Small and local businesses who need customers, not dashboards. You should never have to learn what "keyword difficulty" means. We do the judgement; you see a plan, the articles, and what changed.',
  },
  successStories: {
    metaTitle: "Success stories",
    metaDescription:
      "What RepGet customers measure: rankings, AI visibility, published articles and backlinks earned - and how the first results arrive.",
    eyebrow: "Success stories",
    title: "We would rather show you what we measure than invent a customer.",
    intro:
      "RepGet is new, and we are not going to invent a business that used it or round someone's numbers up for a landing page. Here is what the product actually tracks, and what the first months honestly look like - so you can judge it on something real.",
    results: [
      {
        label: "Rankings and clicks",
        body: "Pulled from your own Search Console, not estimated. You see which queries you moved on, and what that was worth in clicks.",
      },
      {
        label: "AI visibility",
        body: "Whether ChatGPT, Claude and Perplexity name your business when someone asks for what you sell. Checked on your own prompts.",
      },
      {
        label: "Articles published",
        body: "What was written, when it went live, and what it did afterwards - so a month's work has an answer rather than an invoice.",
      },
      {
        label: "Backlinks earned",
        body: "Real links inside real articles on other businesses' sites, checked daily. If one is removed, tell us and your credit comes back.",
      },
    ],
    timelineTitle: "What the first three months look like",
    timelineIntro:
      "Honestly, including the part where nothing has happened yet.",
    timeline: [
      {
        when: "Week one",
        body: "We crawl the site, find the technical problems holding it back, and plan a month of articles around what your customers actually search for.",
      },
      {
        when: "Weeks two to four",
        body: "Articles go live on your schedule. Backlinks start being placed as other businesses in the network publish theirs.",
      },
      {
        when: "Month two onward",
        body: "Search Console data arrives for the first articles. This is where rankings begin to move - SEO does not pay out in week one, and anyone promising otherwise is selling something else.",
      },
    ],
    ctaTitle: "Be the first story on this page.",
    ctaBody:
      "Start with a free check of your site - it takes a minute and costs nothing. If what we find is worth acting on, new accounts can try RepGet free for {days} days.",
    ctaPrimary: "Check my website",
    ctaSecondary: "See pricing",
  },
  publishers: {
    metaTitle: "Monetize your blog",
    metaDescription:
      "Host one article a month for a related business and earn link credits you can spend on backlinks to your own site.",
    title: "Monetize your blog",
    intro:
      "Host one article a month for a business in a related field, and earn credits you can spend on links back to your own site.",
    creditsTitle: "Credits, not cash",
    creditsBody:
      "You are paid in link credits rather than money. One hosted article earns one credit, and one credit buys you a link from another business's site. If you want cash for guest posts, this is not that - and there are marketplaces that do it.",
    steps: [
      {
        title: "Tell us what your site is about",
        body: "Your topic, language and country. We only match you with businesses in a related field.",
      },
      {
        title: "Set how many articles a month",
        body: "Up to twenty, and most publishers start at three. You can pause or leave at any time.",
      },
      {
        title: "We write the article",
        body: "A real article on a topic your readers care about, written for your site, with one natural link in it.",
      },
      {
        title: "You earn a credit",
        body: "One credit per article hosted, spendable on a link back to your own site from someone else's.",
      },
    ],
    controlTitle: "What you control",
    rules: [
      {
        title: "Related topics only",
        body: "You will never be asked to host something unrelated to your site. If we cannot establish that two sites are topically related, we do not make the match.",
      },
      {
        title: "You set the limit",
        body: "Between one and twenty articles a month, changed whenever you like. Set it to zero and you stop receiving requests.",
      },
      {
        title: "You keep editorial control",
        body: "Articles arrive as drafts on your site. Publish, edit or reject them - nothing goes live without you.",
      },
    ],
    suitsTitle: "Who this suits",
    suitsBody:
      "A small business with a blog that already publishes occasionally, and wants links to its own pages without paying for them. If your site has no readers, hosting articles will not change that - the links you earn are worth what your site is worth.",
    joinNote:
      "Joining is part of every plan. Turn it on from your website settings.",
    ctaPrimary: "Get Started",
    ctaSecondary: "How the exchange works",
  },
  affiliate: {
    metaTitle: "Refer a business",
    metaDescription:
      "Share your link and earn link credits when someone you refer pays for their first month.",
    title: "Refer a business, earn credits",
    intro:
      "Share your link. When someone you refer pays for their first month, credits land in your account.",
    steps: [
      {
        title: "Share your link",
        body: "Every account gets a link. You will find it in Settings once you sign up.",
      },
      {
        title: "They sign up and subscribe",
        body: "Nothing is owed while someone is only trying the product. The referral counts when they pay for their first month.",
      },
      {
        title: "You get your credits",
        body: "Credits land in your account automatically and go toward backlinks to your website.",
      },
    ],
    termsTitle: "The terms, plainly",
    terms: [
      "The reward is account credit, not cash. It cannot be withdrawn.",
      "A referral counts once the person you referred pays for their first month.",
      "Only new accounts can be referred, and each one only once.",
      "Credits are spent on link building inside the product.",
    ],
    ctaPrimary: "Get Started",
    ctaNote:
      "Your referral link is in Settings as soon as you have an account.",
  },
  backlinkExchange: {
    metaTitle: "How the backlink exchange works",
    metaDescription:
      "Earn links to your website by publishing one article for another business. Relevant matches only, verified daily, credits refunded when a removed link is confirmed.",
    title: "How the backlink exchange works",
    intro:
      "Links are earned by giving them. You host one article for a business in a related field, and spend what you earn on links back to your own site.",
    steps: [
      {
        title: "You host an article",
        body: "We write an article for another business in a related field and publish it on your site. It is a real article on a topic your readers care about, not a page of links.",
      },
      {
        title: "You earn a credit",
        body: "Hosting one article earns one credit. Your plan also includes credits every month, so you can start before you have hosted anything.",
      },
      {
        title: "You spend it on a link",
        body: "One credit buys one link to your site, written naturally into an article on someone else's website in a related field.",
      },
    ],
    rulesTitle: "The rules that make it worth having",
    rules: [
      {
        title: "Related topics only",
        body: "A dentist is never matched with a crypto blog. If we cannot establish that two sites are topically related, we do not make the match - an irrelevant link is worth nothing and can do harm.",
      },
      {
        title: "Checked every day",
        body: "We re-check every link daily. Links do not silently disappear without you finding out.",
      },
      {
        title: "Credits refunded if a link goes",
        body: "If a link is removed, tell us: once we confirm it is gone, you get the credit back and it disappears from your dashboard. A site that is only offline for a while, for maintenance say, keeps its links.",
      },
    ],
    notTitle: "What this is not",
    notBody:
      "This is not a private blog network. Every link sits inside a real article on a real business's website, published because that business wanted an article.",
    ctaTitle: "Every plan includes credits",
    ctaBody: "You can request your first links before hosting anything.",
    ctaPrimary: "Get Started",
    ctaSecondary: "Host articles instead",
  },
  faq: {
    metaTitle: "FAQ",
    metaDescription: "Common questions about how RepGet works.",
    title: "Frequently asked questions",
    subtitle: "Straight answers, including where the limits are.",
    items: [
      {
        question: "Do I need to know anything about SEO?",
        answer:
          "No. That is the point of the service. We work out which searches your customers use, write the pages that answer them, and tell you in plain language what changed. You never need to learn what a canonical tag is.",
      },
      {
        question: "How long before I see results?",
        answer:
          "Usually two to four months before new pages start bringing visitors, and longer in competitive industries. Anyone promising results in weeks is not being straight with you. Search engines take time to find, trust and rank new pages.",
      },
      {
        question: "Do you guarantee I will rank first on Google?",
        answer:
          "No, and neither can anyone else. Google decides what to rank and changes how it works constantly. What we do is find the searches you can realistically win, write the pages properly, and show you honestly what happened.",
      },
      {
        question: "Will the articles sound like a robot wrote them?",
        answer:
          "They are written by AI, so you should read them before they go live - we give you an editor for exactly that. They are written for your business, in your language and market, and you can set the tone you want.",
      },
      {
        question: "Do the articles go on my website automatically?",
        answer:
          "Only if you connect your website and choose to publish. We support WordPress, Ghost and Shopify, plus a webhook for anything else. Otherwise they stay as drafts for you to review, edit, or copy elsewhere.",
      },
      {
        question: "What are link credits?",
        answer:
          "Google trusts a website more when other sites link to it. When one of your articles mentions another member's business, you earn a credit. Spend a credit and a different member's article links to you. You never link to whoever linked to you, so the links look natural.",
      },
      {
        question: "Why do you suggest smaller search terms?",
        answer:
          "Because you can win them. A term searched 12,000 times a month that you have no chance of ranking for is worth less than one searched 300 times that brings you customers next month.",
      },
      {
        question: "Can I cancel any time?",
        answer:
          "Yes, from the billing page, with no cancellation fee. Your access continues until the end of the period you have paid for.",
      },
      {
        question: "What happens to my articles if I leave?",
        answer:
          "Anything already published stays on your website - it is your content. You own the articles we write for you.",
      },
    ],
  },
  contact: {
    metaTitle: "Contact",
    metaDescription: "How to get in touch with RepGet.",
    title: "Contact us",
    subtitle:
      "Questions about the product, your account, or billing - we read every message and reply within two working days.",
    emailLabel: "Email",
    accountNote:
      "If you are writing about your account, please send it from the address you signed up with.",
  },
  notFound: {
    metaTitle: "Page not found",
    eyebrow: "Error 404",
    title: "We couldn’t find that page",
    body: "The address may be mistyped, or the page has moved or no longer exists.",
    home: "Go to the home page",
    elsewhere: "Or try one of these:",
  },
  legalNotice: "This page is available in English only. Translations of our legal terms are prepared by a professional translator before publication.",

  app: {
    workspace: {
      save: "Save",
      saving: "Saving…",
      saved: "Saved",
      discard: "Discard changes",
      unsaved: "1 unsaved change|{count} unsaved changes",
      noChanges: "All changes saved",
      saveFailed: "Not saved. {error}",
      leaveConfirm: "You have unsaved changes. Leave this page and lose them?",
      onThisPage: "On this page",
      jumpTo: "Jump to a section",
      optional: "Optional",
      required: "Required",
      charactersLeft: "1 character left|{count} characters left",
      overLimit: "1 character over the limit|{count} characters over the limit",
      viewOnly: "You have view-only access to this website. Only an owner or an editor can make changes.",
      savesImmediately: "Saves as soon as you change it",
      savedWithButton: "Saved with the Save button",
      editsKept: "Your newer edits are kept and still need saving.",
      preview: "Preview",
      close: "Close",
      selected: "Selected",
    },
    health: {
      title: "Website health",
      description: "A technical check of the pages we can read on {domain}: what may hold them back in search results, and how to fix it.",
      checkNow: "Check my website",
      checkAgain: "Check again",
      checking: "Checking…",
      starting: "Starting…",
      refreshStatus: "Refresh status",
      dismiss: "Dismiss",
      unavailableTitle: "New checks are unavailable",
      siteNotReady: "We are still analysing this website. You can run a check once that has finished.",
      errNoPlan: "Choose a plan for this website first.",
      errPlanInactive: "This website's subscription is not active. Update billing to run a check.",
      errQuota: "You have run this check several times in the last hour. Please try again shortly.",
      errUnexpected: "The check could not be started. Please try again.",
      queuedTitle: "Check requested",
      queuedBody: "Your check is waiting to start. This page updates by itself.",
      queuedStale: "This check has not started yet, which is taking longer than usual. The report appears here once it has run.",
      requestedAt: "Requested {date}",
      runningTitle: "Checking your website",
      runningBody: "We are reading your pages one by one. This page updates by itself.",
      runningStale: "This check has been running for longer than expected and may have stopped.",
      staleRetry: "Refresh the status to see whether it has moved on, or start the check again.",
      startedAt: "Started {date}",
      progressChecked: "1 page checked so far|{count} pages checked so far",
      progressFound: "1 address found on your site|{count} addresses found on your site",
      progressLimit: "A check reads up to {max} pages.",
      previousNotice: "The report below is your previous result, from {date}. It is replaced when the new check finishes.",
      failedTitle: "The latest check could not be completed",
      failedPrevious: "The report below is still your previous result, from {date}.",
      finishedTitle: "Your new report is ready",
      finishedBody: "The report below is from the check of {date}.",
      failure: {
        timeout: "Your website took too long to respond. Try again: this is often temporary on a busy server.",
        notHtml: "The website address did not return a web page. Check that it points to your site's home page.",
        tooLarge: "Your home page is too large for us to analyse.",
        invalidUrl: "The website address could not be read. Check the address, including http:// or https://.",
        refused: "Your website refused our request. A firewall or security plugin may be blocking automated visitors.",
        unreachable: "We could not reach your website. Check that it is online and that the address is correct.",
        notEntitled: "The check stopped because this website's subscription is not active. Nothing further was charged.",
        generic: "We could not finish checking your website. Try again, and contact support if it keeps happening.",
      },
      failureViewer: {
        timeout: "Your website took too long to respond. This is often temporary on a busy server. An owner or an editor can run the check again.",
        generic: "We could not finish checking your website. An owner or an editor can run the check again.",
      },
      emptyTitle: "No report yet",
      emptyBody: "A check reads up to {max} pages of your site and lists what may hold it back in search, page by page, with how to fix each problem.",
      emptyViewer: "No check has been run yet. An owner or an editor can start one.",
      firstRunTitle: "Your first report is on its way",
      firstRunBody: "It appears here as soon as the check finishes.",
      scoreTitle: "Health score",
      scoreDescription: "Counts the technical problems on the pages we read, weighted by how serious they are and averaged per page.",
      previousResult: "Previous result",
      latestResult: "Latest result",
      outOf: "of 100",
      scoreAria: "Health score {score} out of 100",
      bandGood: "Good",
      bandFair: "Needs work",
      bandPoor: "Poor",
      noScore: "No score",
      noScoreBody: "No score was recorded for this check.",
      notScored: "Not scored",
      zeroPagesTitle: "No page could be read",
      zeroPagesBody: "We could not open any page on this check, so its score does not describe your site. The findings below say why.",
      notAuthority: "This is not Domain Authority: it measures technical problems on your own pages, not how much other sites trust yours.",
      lastChecked: "Last checked",
      pagesRead: "Pages read",
      pagesFailed: "Could not be opened",
      addressesFound: "Addresses found",
      notRecorded: "Not recorded",
      severityTitle: "Problems by seriousness",
      critical: "Critical",
      warnings: "Warnings",
      suggestions: "Suggestions",
      inFindings: "in 1 finding|in {count} findings",
      severityAria: "Critical: {critical}, warnings: {warning}, suggestions: {info}",
      badge: { critical: "Critical", warning: "Warning", info: "Suggestion" },
      coverageTitle: "What this check covered",
      coverageLimit: "It reads up to {max} pages, starting from your home page and following links.",
      coverageSameSite: "It only follows links within {domain}. Links to other sites are not checked.",
      coverageQuery: "Addresses that differ only after a “?” or “#” count as one page.",
      coverageSkipped: "It skips admin, login, cart and checkout pages, feeds, and files such as images and PDFs.",
      coverageRefused: "A page that does not respond within 15 seconds, or refuses automated visitors, is listed as “could not be opened”.",
      coverageBeyond: "This check found {found} addresses on your site and read {read} pages. The rest were not checked.",
      notAssessedTitle: "Some checks could not run",
      notAssessedBody: "These checks compare pages with each other and need at least two readable pages: {checks}. They are not part of this score.",
      crossChecks: {
        duplicateTitles: "duplicate page titles",
        duplicateDescriptions: "duplicate descriptions",
        internalLinking: "internal linking",
      },
      findingsTitle: "Findings",
      findingsDescription: "Most serious first. Open a finding to see every affected page and how to fix it.",
      findingsCount: "1 finding|{count} findings",
      filterLabel: "Filter by seriousness",
      filterAll: "All",
      searchLabel: "Search findings",
      searchPlaceholder: "Search by problem or page address",
      showingFiltered: "Showing {shown} of {total} findings.",
      clearFilters: "Clear filters",
      noMatchTitle: "No findings match",
      noMatchBody: "Try another search, or show all findings.",
      noFindingsTitle: "No problems found",
      noFindingsBody: "We found nothing to fix on the page we read.|We found nothing to fix on the {count} pages we read.",
      pagesCount: "1 page|{count} pages",
      howToFix: "How to fix it",
      effortMinutes: "Usually a few minutes",
      effortHour: "Usually about an hour",
      effortLonger: "Can take longer",
      needsDeveloper: "May need your web developer",
      affectedPages: "Affected pages ({count})",
      homepage: "home page",
      opensInNewTab: "(opens in a new tab)",
      showAllPages: "Show all {count} pages",
      showFewerPages: "Show fewer pages",
      matchingPages: "Pages matching your search: {shown} of {total}.",
      notLoaded: "{shown} of {total} are listed. The rest were not loaded, to keep this page fast.",
      groupNote: "Each entry is one group of pages; the first page of each group is listed.",
      firstPageNote: "The first page found is listed; the detail gives the total.",
      noUrl: "No page address was recorded",
      rowsCapped: "This check recorded {total} problems. The first {shown} are listed below; the counts above include all of them.",
      detail: {
        titleLong: "The title is {chars} characters; search results cut it off after about {max}.",
        titleShort: "The title is only {chars} characters.",
        descriptionLong: "The description is {chars} characters; search results cut it off after about {max}.",
        descriptionShort: "The description is only {chars} characters.",
        multipleH1: "{count} main headings (H1) on this page.",
        thinContent: "Only {words} words on this page.",
        imagesAlt: "{missing} of {total} images have no description (alt text).",
        largePage: "The page's HTML alone is {kb} KB.",
        httpStatus: "The page answered with error {status}.",
        duplicateTitle: "{count} pages share the title “{title}”.",
        duplicateDescription: "{count} pages share the same description.",
        noInternalLinks: "1 page links to no other page on your site.|{count} pages link to no other page on your site.",
        unreachTimeout: "It did not respond in time.",
        unreachBlocked: "It refuses automated visitors (a security setting on the site).",
        unreachPassword: "It asks for a password.",
        unreachStatus: "It answered with error {status}.",
        unreachNotHtml: "It is not a web page.",
        unreachRedirects: "It redirects too many times.",
        unreachRedirectAway: "It redirects to an address we do not check.",
        unreachConnect: "We could not connect to it.",
        unreachUnknown: "An unexpected error stopped us opening it.",
      },
      issues: {
        noindex: {
          label: "Hidden from search engines",
          about: "The page asks search engines not to include it in their results, so it cannot be found in search.",
          fix: "Unless you hide this page on purpose, remove its “noindex” setting. In WordPress this is usually an option in your SEO plugin, or the “Discourage search engines” box under Settings › Reading.",
        },
        broken_page: {
          label: "Page shows an error",
          about: "The page answers with an error instead of loading.",
          fix: "Fix the page, or if it should no longer exist, redirect it to the closest page that does, so visitors and links are not lost.",
        },
        unreachable_page: {
          label: "Page could not be opened",
          about: "We tried to load this page and could not. Search engines may have the same problem.",
          fix: "Open the page in your own browser. If it no longer exists, update the links that point to it or redirect it. If it opens for you, your host or a security setting may be refusing automated visitors, which can keep search engines out too.",
        },
        missing_title: {
          label: "Page has no title",
          about: "The page has no title tag, the headline shown for it in search results.",
          fix: "Give the page a title that says what it is about. People see it as the headline in search results, so write it for them rather than packing in keywords.",
        },
        title_too_long: {
          label: "Title is too long",
          about: "Search results cut off titles longer than about 60 characters.",
          fix: "Shorten the title so the important part is not cut off. Put what matters first: the end is what gets trimmed.",
        },
        title_too_short: {
          label: "Title is very short",
          about: "Titles shorter than 30 characters often do not say enough about the page.",
          fix: "Add detail to the title, so someone can tell from the search results that this page is what they are looking for.",
        },
        missing_meta_description: {
          label: "No description for search results",
          about: "The page has no description, so search engines choose their own text to show under your link.",
          fix: "Write a one- or two-sentence description of the page. Without one, search engines pick text from the page, and it is often not the best part.",
        },
        meta_description_too_long: {
          label: "Search description is too long",
          about: "Search results cut off descriptions longer than about 158 characters.",
          fix: "Shorten the description, and say early why someone should click.",
        },
        meta_description_too_short: {
          label: "Search description is very short",
          about: "Descriptions shorter than 70 characters leave space unused in search results.",
          fix: "Expand the description to a sentence or two that gives people a reason to choose your result.",
        },
        missing_h1: {
          label: "No main heading",
          about: "The page has no main heading (H1), so its topic is less clear to readers and search engines.",
          fix: "Add one main heading near the top of the page that says what the page is about.",
        },
        multiple_h1: {
          label: "More than one main heading",
          about: "The page has several main headings (H1), so it is unclear which one describes it.",
          fix: "Keep one main heading and turn the others into sub-headings.",
        },
        thin_content: {
          label: "Not much text",
          about: "The page has fewer than 300 words, counting menus and footers. Pages this short rarely rank for competitive searches.",
          fix: "Expand the page so it fully answers what visitors came for, or merge it into a fuller page and redirect this one.",
        },
        images_missing_alt: {
          label: "Images without a description",
          about: "Some images have no alt text, which screen readers read out and image search relies on.",
          fix: "Add a short description to each image saying what it shows. Purely decorative images can have an empty description.",
        },
        missing_canonical: {
          label: "No preferred address set",
          about: "The page does not name its preferred address (canonical link). If it can be reached at several addresses, search engines have to guess which one to show.",
          fix: "Add a canonical link to the page. Most SEO plugins add one automatically once switched on; otherwise ask your web developer.",
        },
        missing_lang: {
          label: "Page language not set",
          about: "The page does not declare which language it is written in.",
          fix: "Set the page language (the “lang” attribute of the html tag). It helps search engines show your pages to the right people and screen readers pronounce them correctly.",
        },
        large_page: {
          label: "Page code is very large",
          about: "The page's HTML alone is over 1.5 MB, which slows loading. Images are not counted in this.",
          fix: "Large HTML usually comes from code, data or images built into the page itself. Ask your web developer to move them into separate files or trim them.",
        },
        duplicate_title: {
          label: "Pages share a title",
          about: "Several pages use the same title, so search engines find it hard to tell them apart.",
          fix: "Give each page a title that describes what only that page covers.",
        },
        duplicate_meta_description: {
          label: "Pages share a description",
          about: "Several pages use the same description in search results.",
          fix: "Write a separate description for each page that says what that page offers.",
        },
        no_internal_links: {
          label: "Pages that link nowhere",
          about: "Some pages have no links to other pages on your site, so visitors and search engines cannot move on from them.",
          fix: "Add links from these pages to related pages on your site, such as a relevant service, an article or your home page.",
        },
      },
      siteTitle: "Your site as we read it",
      siteDescription: "Read from your home page during this check.",
      siteLegacy: "This check was recorded before we started collecting site details. They appear after the next check.",
      siteUnavailable: "No page could be read on this check, so these details are not available.",
      siteName: "Site name",
      siteNameMissing: "Not found",
      language: "Language",
      languageMissing: "Not declared",
      languageNote: "As declared by your home page.",
      languageMissingNote: "Your home page does not say which language it is in, so search engines have to guess.",
      platform: "Platform",
      platformUnknown: "Not recognised",
      platformNote: "Detected from your page's code.",
      platformUnknownNote: "We could not match a common platform. That is not a problem in itself.",
      previewImage: "Link preview image",
      previewMissing: "None set",
      previewNote: "Shown when your home page is shared.",
      previewMissingNote: "No preview image (og:image) was found, so shared links may appear without a picture.",
      previewBroken: "The preview image could not be loaded.",
      linkedTitle: "Sites you link to most",
      linkedHelp: "Up to six, counted across the pages we read. Useful for spotting links you did not mean to give.",
      linkedEmpty: "We found no links to other sites on the pages we read.",
      aiTitle: "AI assistant access",
      aiDescription: "Whether your robots.txt file blocks the crawlers that AI assistants use to read websites.",
      aiLegacy: "This check was recorded before we started reading robots.txt. It appears after the next check.",
      aiUnreadable: "No page could be read on this check, so robots.txt was most likely unreadable too. Here, “Not blocked” may only mean we could not read it.",
      aiNoneBlocked: "None of these {total} crawlers is blocked from your whole site.",
      aiSomeBlocked: "1 of {total} crawlers is blocked from your whole site.|{count} of {total} crawlers are blocked from your whole site.",
      aiAllowed: "Not blocked",
      aiBlocked: "Blocked",
      aiNamed: "Named in robots.txt",
      aiCaveat: "We only check whether robots.txt blocks the whole site. If there is no robots.txt, or we could not read it, a crawler counts as not blocked. Firewalls and rules for single pages are not checked.",
      aiNoGuarantee: "Being readable does not mean an AI assistant will mention or cite your site.",
      aiBlockedHelp: "To let a crawler in, remove the “Disallow: /” rule that applies to it from robots.txt, or ask whoever manages your site to do so.",
      aiVisibilityLink: "See whether AI assistants mention you",
      fixTitle: "Want us to fix these for you?",
      fixSelf: "Most of these are text changes you can make yourself with the guidance above. If you would rather not, send us the list and we will quote.",
      fixDeveloper: "1 of these findings usually needs whoever built your site. Send us the list and we will review everything and quote for fixing it.|{count} of these findings usually need whoever built your site. Send us the list and we will review everything and quote for fixing it.",
      fixHow: "Opens your email app with the list filled in. Nothing is sent until you send it, and nothing is charged.",
      fixUnavailable: "Quote requests by email are not available at the moment.",
      requestQuote: "Request a quote",
      mailSubject: "Fix request for {domain}",
      mailGreeting: "Hello,",
      mailAsk: "Please quote for fixing the problems found on {domain}.",
      mailCheckedOn: "Check of {date}.",
      mailCounts: "1 problem found, {critical} critical.|{count} problems found, {critical} critical.",
      mailListTitle: "Findings:",
      mailLine: "- {label}: {pages}",
      mailThanks: "Thank you.",
    },
    settings: {
      personalTitle: "Personal details",
      personalSubtitle: "Your name and the email address you sign in with.",
      nameLabel: "Name",
      namePlaceholder: "Your name",
      save: "Save",
      saving: "Saving…",
      cancel: "Cancel",
      nameSaved: "Name updated",
      nameError: "Could not save your name",
      emailLabel: "Email",
      changePassword: "Change password",
      setPassword: "Set a password",
      setPasswordIntro:
        "You sign in with Google. Set a password to sign in with your email as well - Google will keep working.",
      setPasswordHelp: "At least 8 characters.",
      settingPassword: "Setting…",
      passwordCreated:
        "Password set. You can now sign in with your email and password.",
      languageLabel: "Dashboard language",
      languageHelp: "Menus, buttons and messages in this dashboard. Changing it does not change your articles.",
      languageError: "Could not save your language",
      currentPassword: "Current password",
      newPassword: "New password",
      updatePassword: "Update password",
      passwordSaved: "Password changed. Other devices have been signed out.",
      passwordTooShort: "Use at least 8 characters",
      passwordError: "Could not change your password",
      passwordHelp: "At least 8 characters. Other devices will be signed out.",
      changing: "Changing…",
      saveName: "Save name",
      membersTitle: "Members & roles",
      membersSubtitle: "Access is given one website at a time. Someone invited here will not see your other sites or your billing.",
      addMember: "Add member",
      addMemberHelp: "Enter their email. If they do not have a RepGet account yet, we will email them an invitation.",
      memberColumn: "Member",
      roleColumn: "Role",
      statusColumn: "Status",
      statusPending: "Invited",
      invitationExpiresOn: "expires {date}",
      statusExpired: "Expired",
      resendInvite: "Resend invitation",
      cancelInvite: "Cancel invitation",
      inviteSent: "Invitation sent",
      inviteResent: "Invitation sent again",
      inviteCancelled: "Invitation cancelled",
      actionsColumn: "Actions",
      active: "Active",
      removeAccess: "Remove access",
      websiteLabel: "Website",
      emailPlaceholder: "editor@example.com",
      roleHelp: "An editor can write, edit and publish articles. A viewer can read only.",
      invite: "Invite",
      nobodyElse: "Nobody else here yet. Invite a colleague or a freelance editor to work on this website.",
      loadingPeople: "Loading people",
      roleEditor: "Editor",
      roleViewer: "Viewer",
      pageTitle: "Account",
      pageDescription: "Your personal details, how you sign in, your language, who works on your websites and your referral link.",
      emailHelp: "You sign in with this address, and receipts are sent to it. It cannot be changed here.",
      nameRequired: "Enter your name.",
      securityTitle: "Sign-in and security",
      securitySubtitle: "The ways you can sign in to your account.",
      methodPassword: "Email and password",
      methodGoogle: "Google",
      methodSet: "Set",
      methodNotSet: "Not set",
      methodLinked: "Linked",
      passwordSetSummary: "You can sign in with your email address and password.",
      passwordNotSetSummary: "This account has no password yet.",
      googleLinkedSummary: "You can sign in with the Google account for this address.",
      setPasswordIntroGeneric: "Set a password to sign in with your email address and a password.",
      currentPasswordWrong: "Your current password is not correct.",
      passwordTooLong: "Use at most 128 characters",
      tooManyAttempts: "Too many attempts. Wait a minute and try again.",
      passwordAlreadySet: "This account already has a password. Enter your current password to change it.",
      languageTitle: "Language",
      languageSubtitle: "The dashboard and your articles each have their own language.",
      languageSaved: "Dashboard language saved.",
      articleLanguageLabel: "Article language",
      articleLanguageHelp: "Each website's articles are written in the language set on its Business tab.",
      articleLanguageLink: "Open the Business tab for {domain}",
      roleAdmin: "Admin",
      roleEditorHelp: "Writes, edits and publishes articles.",
      roleViewerHelp: "Can read everything but change nothing.",
      inviteTo: "They will get access to {domain} only.",
      reinviteHelp: "Inviting someone who already has access changes their role.",
      invalidEmail: "Enter a valid email address.",
      inviteSelf: "You already have access to this website.",
      inviteFailed: "Could not send the invitation. Please try again.",
      actionFailed: "That did not work. Please try again.",
      accessGranted: "{email} can now work on {domain}",
      accessGrantedNoEmail: "{email} can now work on {domain}, but we could not email them.",
      accessRemoved: "{email} no longer has access",
      loadPeopleFailed: "Could not load who works on this website.",
      retry: "Try again",
      thisWebsite: "this website",
      workspaceAccess: "{email} has access through your workspace",
      manageMember: "Manage {email}",
      manageInvitation: "Manage the invitation for {email}",
      membersCaption: "People who can work on {domain}",
      removeConfirmTitle: "Remove access for {email}?",
      removeConfirmBody: "They will no longer be able to open {domain}. You can invite them again later.",
      keepAccess: "Keep access",
      cancelInviteConfirmTitle: "Cancel the invitation for {email}?",
      cancelInviteConfirmBody: "The link we emailed will stop working. You can invite them again later.",
      keepInvitation: "Keep invitation",
      removing: "Removing…",
      cancellingInvite: "Cancelling…",
      inviting: "Sending…",
      viewingSharedNote: "You are looking at {domain}, which is shared with you. Only its owner can change who works on it. The list below is for your own websites.",
      guestTeamNote: "{domain} is shared with you as {role}. Only its owner can invite or remove people.",
    },
    websites: {
      title: "Websites",
      connected: "1 website. Each is billed on its own plan.|{count} websites. Each is billed on its own plan.",
      addWebsite: "Add website",
      emptyTitle: "No websites yet",
      emptyBody:
        "Add your website and we will read it, work out what your business does, and find the search terms worth going after.",
      addFirst: "Add your first website",
      tryAgain: "Try again",
      removeLabel: "Remove {domain}",
      removed: "Removed {domain}",
      retrying: "Trying again",
      dialogTitle: "Add a website",
      dialogBody:
        "Enter the address of the site you want found on Google. We will read it and fill in the details for you.",
      urlLabel: "Website address",
      urlPlaceholder: "example.com",
      cancel: "Cancel",
      adding: "Adding…",
      sharedTitle: "Shared with you",
      sharedHelp: "Websites other people have invited you to work on.",
    },
    billing: {
      title: "Billing",
      subtitle: "Each website has its own plan. Credits are shared across all of them.",
      yourWebsites: "Your websites",
      yourWebsitesHelp: "A website without a plan cannot generate or publish articles.",
      noPlanYet: "No plan yet",
      planRenews: "{plan} - renews {date}",
      planEnds: "{plan} - ends {date}",
      currentPlan: "Current plan",
      accessEnds: "Access ends",
      nextInvoice: "Next invoice",
      onPlan: "You are on the {plan} plan.",
      noSubscription: "No active subscription yet. Choose a plan below to get started.",
      accessEndsOn: "Access ends on {date}.",
      renewsOn: "Renews on {date}.",
      monthly: "Monthly",
      annual: "Annual",
      status: "Status",
      tryItFirst: "Try it first",
      paypalReceipts: "Your receipts and cancellation live in your PayPal account.",
      promoCodes: "Promo codes can be entered at card checkout. PayPal does not support them.",
      unlimited: "Unlimited",
      articlesEachMonth: "{n} article written each month|{n} articles written each month",
      searchTermsTracked: "{n} search term tracked|{n} search terms tracked",
      oneWebsite: "One website per subscription",
      creditsEachMonth: "{n} link credit each month|{n} link credits each month",
      paymentReceived: "Payment received - confirming your subscription…",
      checkoutCancelled: "Checkout cancelled.",
      purchaseReceived: "Payment received - your purchase will appear shortly.",
      purchaseCancelled: "Purchase cancelled.",
      addWebsiteFirst: "Add a website first - each plan pays for one site.",
      checkoutFailed: "Could not start checkout. Please try again.",
      planFor: "Plan for {domain}",
      choosePlan: "Choose a plan",
      choosePlanFor: "Choose a plan for {domain}",
      choosePlanHelp: "A plan pays for one website.",
      billingPeriod: "Billing period",
      perMonth: "/ month",
      perYear: "/ year",
      saveBadge: "Save {n}%",
      switchPlan: "Switch to this plan",
      payByCard: "Pay by card",
      redirecting: "Redirecting…",
      opening: "Opening…",
      cancelSubscription: "Cancel subscription",
      paypalCheckoutFailed: "Could not start PayPal checkout. Please try again.",
      portalFailed: "Could not open the billing portal.",
      managedForYou: "This subscription is managed for you. Contact {email} for receipts or to make a change.",
      newTab: "(opens in a new tab)",
      upgradeLead: "Ready to scale?",
      upgradeBody: "The {plan} plan includes {articles}, {terms} and {credits}.",
      upgradeLink: "See what {plan} offers",
      statusActive: "Active",
      statusTrialing: "Free trial",
      statusPastDue: "Payment overdue",
      statusUnpaid: "Unpaid",
      statusIncomplete: "Payment incomplete",
      statusIncompleteExpired: "Payment expired",
      statusCanceled: "Cancelled",
      statusPaused: "Paused",
      statusInactive: "Inactive",
      pastDueNotice: "The last payment for this website did not go through. Update the payment method to keep access.",
      unsettledNotice: "This website's subscription has to be settled or cancelled before its plan can change.",
      endedNotice: "This subscription has ended. Choose a plan below to start again.",
      billedByPayPal: "This website is billed through PayPal, so plan changes go through PayPal too.",
      billedByCard: "This website is billed by card, so plan changes go through card checkout. To pay with PayPal instead, cancel the card subscription first.",
      billedByCardEnding: "This website's card subscription ends on {date}. You can choose PayPal once it has ended.",
      noPlanChange: "Plan changes are not available for this website right now.",
      paypalApproved: "PayPal approval received - confirming your subscription…",
      paypalCancelled: "PayPal checkout cancelled.",
      viewingSharedNote: "{shared} is shared with you, and its owner pays for it. This page shows billing for your own websites.",
      guestTitle: "Nothing to pay here",
      guestBody: "Websites shared with you are paid for by their owners. You do not need a plan to work on them.",
      addWebsite: "Add a website",
      viewPlan: "View plan",
      shownBelow: "Shown below",
      paidByCard: "Card",
      invoiceInPortal: "Invoice in Manage billing",
      dateColumn: "Date",
      descriptionColumn: "Description",
      methodColumn: "Paid with",
      amountColumn: "Amount",
      receiptColumn: "Receipt",
      historyCapped: "Showing the {count} most recent payments.",
    },
    article: {
      contentSeo: "Content & SEO",
      contentSeoHelp: "How every article is written, and what happens to it once it is.",
      publishAs: "Publish as",
      publishLive: "Articles go live on your site at their scheduled time.",
      publishDraft: "Articles are sent as drafts for you to review first.",
      live: "Live",
      draft: "Draft",
      articleStyle: "Article style",
      internalLinks: "Internal links",
      internalLinksHelp: "Target internal links per article.",
      targetWordCount: "Target word count",
      adaptiveOn: "We pick the best length for each article type.",
      adaptiveOff: "One fixed length across every format.",
      wordsPerArticle: "Words per article",
      contentDetails: "Content details",
      sitemapUrl: "Sitemap URL",
      blogAddress: "Main blog address",
      bestArticle: "Your best article example",
      engagement: "Engagement",
      brandColour: "Brand colour",
      optional: "Optional",
      imageBrief: "How your brand should look in images",
      imageBriefPlaceholder: "Cinematic, minimal, cool greys with accents of electric blue.",
      imageInstructions: "Extra image instructions",
      imageInstructionsPlaceholder: "e.g. Never show faces.",
      tableOfContents: "Table of contents",
      comparisonTable: "Comparison table",
      youtubeVideo: "YouTube video",
      authorPerspective: "Author perspective",
      mentionSimilar: "Mention similar products and tools",
      poweredBy: "Powered by RepGet link",
      howWeWrite: "How we write",
      toneLabel: "How should your articles sound?",
      tonePlaceholder: "Friendly and reassuring, not clinical",
      rulesLabel: "Rules for every article",
      rulesPlaceholder: "Never put a year in the title. Always mention we offer free delivery.",
      factsLabel: "Facts about your business",
      uspsLabel: "What makes you different?",
      onePerLine: "One per line.",
      preferLabel: "Words you prefer",
      preferPlaceholder: "Say treatment, not procedure",
      avoidLabel: "Words to avoid",
      avoidPlaceholder: "Never say cheap",
      author: "Author",
      authorName: "Author name",
      authorNamePlaceholder: "Your name, or the brand",
      shortBio: "Short bio",
      shortBioPlaceholder: "One or two sentences on who is writing and why they know.",
      closePreview: "Close preview",
      unsavedChanges: "Unsaved changes",
      contentDetailsHelp: "Where your content lives, so we can link to it and match its shape.",
      engagementHelp: "How articles look, and what gets added alongside the words.",
      howWeWriteHelp: "The voice behind every article.",
      factsHelp: "One per line. These are the only specifics we will state outright.",
      authorHelp: "The byline shown on each article, here and on your live site.",
      noBylineHelp: "Left empty, articles publish without a byline.",
      pageTitle: "Article settings",
      pageDescription: "How articles for this website are written, illustrated and published.",
      sectionWriting: "Writing and SEO",
      sectionWritingHelp: "The style and length of every article, and how many links it carries to your other pages.",
      sectionSources: "Content sources",
      sectionSourcesHelp: "Where your content lives on your website.",
      sectionImages: "Images and branding",
      sectionImagesHelp: "The image created for each article, and your brand's look.",
      sectionEnhancements: "Article enhancements",
      sectionEnhancementsHelp: "Extras added to articles alongside the words.",
      sectionVoice: "Brand voice",
      sectionVoiceHelp: "How your articles sound, and what they may say about your business.",
      sectionAuthor: "Author",
      sectionAuthorHelp: "The person or brand your articles are written by. It is saved with your settings; articles do not show it as a byline at the moment.",
      unknownOption: "{value} (no longer offered)",
      linksError: "Enter a whole number from 0 to 20.",
      wordsError: "Enter a whole number from 300 to 5,000.",
      sitemapHint: "Lets us find pages on your site worth linking to from new articles.",
      blogHint: "The main page of your blog.",
      exampleHint: "An article of yours that you are happy with.",
      urlError: "Enter a full address that starts with http:// or https://.",
      brandColourHint: "Your main brand colour as a hex code. It is saved with your settings; generated images do not use it at the moment.",
      brandColourError: "Use # followed by six digits or letters a–f, for example #003388.",
      noColour: "No colour set",
      invalidColour: "Not a valid colour",
      pickColour: "Pick a brand colour",
      clearColour: "Remove colour",
      imageStyleLabel: "Image style",
      imageStyleHint: "The style of the image created for each article.",
      coverStyleLabel: "Cover image style",
      coverStyleHint: "Your preferred style for article covers. At the moment each article gets one image, made in the image style above, and that image is also its cover.",
      samplesNote: "The examples illustrate each style. The images for your articles are created for each article and will look different.",
      matchFollows: "Currently follows: {style}",
      matchFollowsUnknown: "Follows the image style above",
      previewStyle: "Preview the {style} example",
      previewTitle: "{style} example",
      previewMatchTitle: "Match article images, currently {style}",
      previewHelp: "An example of this style. Previewing does not change your choice.",
      sampleAlt: "Example image in the {style} style",
      unknownImageStyle: "Your saved choice ({value}) is not one of these styles. It stays as it is until you pick one.",
      imageBriefHint: "Included in the instructions for every article image.",
      tocHint: "Adds a contents list built from the article headings.",
      youtubeHint: "Your choice is saved. Videos are not added to articles at the moment.",
      perspectiveHint: "Writes with a point of view rather than impersonally.",
      similarHint: "References and compares alternatives, for richer coverage.",
      comparisonHint: "Adds a side-by-side table comparing the options the article is about, such as \"Videography vs Cinematography at a Glance\".",
      poweredByHint: "A small credit at the end of each article. Turning it off applies to articles not yet published.",
      factsPlaceholder: "Open since 2004\nFive dentists on the team\nFree parking on site",
      uspsPlaceholder: "Same-day emergency appointments\nWe see nervous patients",
      tooManyLines: "Up to {max} lines. Remove 1 line.|Up to {max} lines. Remove {count} lines.",
      lineTooLong: "Line {line} is longer than {max} characters.",
      fixFields: "Some fields need attention. They are marked on the page.",
      saveError: "Something went wrong. Please try again.",
      saveBarNote: "Covers every section except Writing and publishing, which saves as soon as you change it.",
      autoOnHelp: "We work through your content plan on our own. You can still write any article yourself at any time.",
      autoOffHelp: "Nothing is written until you ask. Open a planned article and press Write.",
      anyDay: "Any day.",
      pickedDays: "Only on the days you pick.",
      daysUtc: "Days follow UTC (Coordinated Universal Time).",
      firstArticleOnly: "Your first article goes out as soon as it is ready, whichever you choose, so you can see how articles look on your site.",
      networkReview: "While your website is in the Partner Network, every article - the first one too - is checked by the RepGet team first, and none goes out before its planned day.",
      openIntegrations: "Open Integrations",
      weekdaysShort: { sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" },
      weekdaysLong: { sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday" },
      bodyImageStyles: {
        sketch: { label: "Sketch", hint: "Hand-drawn line work over soft colour." },
        watercolour: { label: "Watercolour", hint: "Soft painted washes." },
        realistic: { label: "Realistic", hint: "Photographic." },
        illustration: { label: "Illustration", hint: "Flat vector shapes." },
        "brand-text": { label: "Brand & Text", hint: "A photo with a bold colour panel along one edge." },
      },
      coverImageStyles: {
        sketch: { label: "Sketch", hint: "Hand-drawn line work over soft colour." },
        watercolour: { label: "Watercolour", hint: "Soft painted washes." },
        illustration: { label: "Illustration", hint: "Flat vector shapes." },
        match: { label: "Match article images", hint: "Follows the image style above." },
      },
      styles: {
        expert: { label: "Expert", hint: "Precise editorial tone with balanced caveats and terminology." },
        conversational: { label: "Conversational", hint: "Plain, direct sentences. Explains terms the first time they appear." },
        friendly: { label: "Friendly", hint: "Warm and encouraging, second person, light on jargon." },
        journalistic: { label: "Journalistic", hint: "Leads with the finding, attributes claims, no marketing language." },
      },
    },
    editor: {
      backToWebsite: "Back to website",
      headings: "Headings",
      words: "Words",
      keywordUses: "Keyword uses",
      internalLinks: "Internal links",
      externalLinks: "External links",
      socialMentions: "Social mentions",
      starting: "Starting",
      takesAMinute: "This usually takes about a minute. The page updates on its own.",
      couldNotWrite: "We could not write this one",
      tryAgain: "Try again",
      publishingHistory: "Publishing history",
      historyHelp: "Every attempt is recorded, so a failure is visible rather than silent.",
      failed: "Failed",
      viewPost: "View post",
      editArticle: "Edit article",
      editHelp: "Your previous version is kept each time you save.",
      previewUnsaved: "This preview includes changes you have not saved yet. Save them on the Edit tab.",
      partnerLink: "Partner link",
      partnerLinksNote: "Highlighted words are Partner Network links placed by the RepGet team.",
      title: "Title",
      metaDescription: "Meta description",
      slugLabel: "Address on your website",
      slugPlaceholder: "wedding-films-italy",
      slugHelp: "Spaces and punctuation become dashes. Leave empty and your website will choose one from the title.",
      articleContent: "Article content",
      saving: "Saving…",
      saveChanges: "Save changes",
      saved: "Saved",
      rewriting: "Rewriting the article…",
      sendAsDraft: "Send as draft",
      publishedToSite: "Published - it is live on your website.",
      sentAsDraftToSite: "Sent to your website as a draft.",
      viewOnSite: "View on your website",
      connectToPublish: "Connect your website to publish",
      publishViaPlugin: "Your website did not answer, so the article is queued: the WordPress plugin sends it on its next check, within the hour. Update the plugin to 1.4 or later to publish instantly.",
      waitingForPlugin: "Waiting for WordPress plugin",
      updatePost: "Update post",
      publish: "Publish",
      sendingDraft: "Sending as a draft…",
      planningOutline: "Planning what to cover",
      writingBody: "Writing the article",
      breadcrumbLabel: "Breadcrumb",
      targetKeywordLabel: "Target keyword",
      lastSaved: "Last updated {date}",
      viewModeLabel: "Preview or edit",
      unsavedMark: "Unsaved changes",
      previewLabel: "Article preview",
      previewUnsavedNow: "You are previewing changes that are not saved yet. Your website gets them only after you save and publish.",
      notWrittenYet: "The article appears here as soon as it is written.",
      workingPaused: "Editing and publishing wait until it finishes, because the new version replaces the text.",
      conflictTitle: "This article changed while you were editing",
      conflictBody: "The saved {fields} changed in the meantime, for example because a rewrite finished or someone else saved. Saving now replaces that version with yours.",
      conflictLoad: "Use the saved version",
      conflictKeep: "Keep my version",
      genUnavailable: "Writing is temporarily unavailable. This is on our side and we are looking into it.",
      genBusy: "The writing service was busy. Try again in a few minutes.",
      genTimeout: "Writing took too long and stopped. Try again: this is usually temporary.",
      genUnusable: "We could not build a usable article from this topic. Try again, or make the topic and target keyword more specific.",
      genQuota: "This workspace has used all of its articles for the month. Upgrade the plan to write more.",
      genGeneric: "Writing this article did not finish. Try again. If it keeps happening, contact support.",
      pubErrAuth: "Your website refused the saved login. Reconnect it on the Integrations page.",
      pubErrPermission: "The connected account is not allowed to publish posts. Connect an account that can publish.",
      pubErrNotFound: "Your website's address could not be found. Check it on the Integrations page.",
      pubErrUnreachable: "Your website did not respond. This is usually temporary: try again, or check that the site is online.",
      pubErrApiDisabled: "Your website is online, but its publishing interface is switched off, often by a security plugin. Turn it back on, then test the connection.",
      pubErrUnsupported: "Your website does something we cannot publish to yet.",
      pubErrUnknown: "Publishing did not finish. Try again. If it keeps happening, contact support.",
      editSaveNote: "The title, meta description, address and text are saved together with the Save button. The featured image is saved as soon as you change it.",
      titleRequired: "Enter a title.",
      metaHint: "Shown under the title in search results, which usually show about the first {count} characters.",
      slugSavedAs: "Saved as: {slug}",
      slugEmptyNote: "Left empty, your website chooses the address from the title.",
      slugDropped: "Accented letters and other special characters are left out of the address.",
      slugWordPressNote: "WordPress keeps the address the post was first published at. Changing it here does not move the live post.",
      searchPreviewTitle: "Search result preview",
      searchPreviewHelp: "An approximation. Search engines decide what they show.",
      saveArticle: "Save article",
      saveNoteWorking: "Saving waits while the article is being written.",
      saveNoteDelivering: "Saving waits while the article is being delivered to your website.",
      saveNoteReview: "Saving changes sends this article back to the RepGet team for review.",
      saveNoteTitle: "Enter a title to save.",
      statsTitle: "Article statistics",
      statsHelp: "Counted from the article text.",
      statsUnsaved: "Counted from the text on screen, including changes not saved yet.",
      publishingTitle: "Publishing",
      publishingHelp: "Publishing sends the last saved version to your website.",
      destinationLabel: "Destination",
      destinationNone: "Not connected",
      destinationPlugin: "WordPress plugin",
      manageConnection: "Manage connection",
      plannedLabel: "Planned date",
      plannedNone: "No planned date",
      autoLabel: "Automatic publishing",
      autoOnLive: "On, as live posts",
      autoOnDraft: "On, as drafts",
      autoOff: "Off",
      beforePlanned: "Publishing now sends it straight away, before its planned date.",
      stateNotSent: "Not sent to your website yet.",
      stateLive: "Live on your website. Last sent {date}.",
      stateDraft: "On your website as a draft. Last sent {date}.",
      stateScheduled: "Scheduled on your website. Last sent {date}.",
      stateDelivered: "Delivered to your website {date}.",
      stateFailed: "The last attempt, {date}, did not finish.",
      statePluginUnconfirmed: "The WordPress plugin did not confirm the last hand-over ({date}).",
      stateWriting: "Publishing is available once the article is written.",
      stateFrozen: "Publishing is paused by the RepGet team. Nothing is sent to websites until it resumes.",
      stateReviewPending: "The RepGet team is preparing this article for the Partner Network. It goes out as soon as they approve it.",
      stateReviewChanged: "This article changed after the RepGet team approved it, so it is back in their review.",
      stateDelivering: "Being delivered to your website now…",
      stateQueued: "Queued at {time}. The result appears here when your website answers.",
      stateQueuedLong: "Still no result. Delivery can be held back, for example while an earlier attempt is unresolved. Check again in a few minutes.",
      checkAgain: "Check again",
      statePluginWaiting: "Waiting for the WordPress plugin to collect it as {mode}. The plugin checks in at least once an hour.",
      modeLive: "a live post",
      modeDraft: "a draft",
      statePluginPublished: "The WordPress plugin created this post and cannot change it afterwards, so edits saved here do not reach your website. Make further changes in WordPress.",
      stateUncertain: "The last attempt got no answer from your website. See the notice at the top of the page.",
      uncertainPublishNote: "Publishing again does not create a second post while this is unresolved: we look for the earlier one first.",
      connectHelp: "Connect your website to publish this article to it.",
      blockedUnsaved: "Save your changes first. Publishing sends the saved version, not what is on screen.",
      alreadySentLive: "This exact version is already live on your website.",
      alreadySentDraft: "This exact version is already on your website as a draft.",
      confirmDraftTitle: "Send the live post back to draft?",
      confirmDraftBody: "This article is live on your website. Sending it as a draft can take the live post offline (WordPress does). To change the live post, use Update post instead.",
      historyLatest: "The latest {count} attempts, newest first.",
      historyEmpty: "Nothing has been sent to your website yet.",
      logLive: "Live",
      logDraft: "Sent as draft",
      logScheduled: "Scheduled",
      logDelivered: "Delivered",
      rewriteTitle: "Rewrite article",
      rewriteHelp: "Writes the whole article again from its plan. Each website can rewrite {count} articles a day.",
      rewriteConfirmTitle: "Rewrite this article?",
      rewriteConfirmBody: "The text, meta description, address and featured image are replaced with a new version. The current version is not kept.",
      rewriteConfirmPublished: "The post on your website stays as it is until you publish the new version.",
      rewriteConfirmReview: "The new version goes to the RepGet team for review before it can be published.",
      rewriteConfirmUnsaved: "Your unsaved changes are discarded.",
      rewriteConfirmAction: "Rewrite",
      rewriteNoPlan: "This article has no plan entry, so it cannot be written again.",
      rewriteBlocked: "Available again once the current writing or delivery finishes.",
      imagePromptHint: "Leave empty and we choose. {remaining} of {max} new pictures left for this article.",
      imageGenerate: "Generate",
      imageReplace: "Replace",
      imageAltHint: "Saved when you leave the field.",
      imageCheckAlt: "Check that the description still matches the new picture.",
      imageLockedWorking: "Wait until the article is written: a rewrite replaces the picture.",
      imageLockedDelivering: "Wait until the delivery to your website finishes.",
      imageTypeError: "Use a PNG, JPEG or WebP image.",
      imageSizeError: "That image is {size} MB. The limit is {max} MB.",
      imageNoAlt: "No description yet.",
      imageAltSaved: "Description saved.",
      errInFlight: "This article is being delivered to your website right now. Try again in a minute.",
      errNotWritten: "This article has not been written yet.",
      errConnectFirst: "Connect your website before publishing.",
      errNotFound: "This article no longer exists.",
      errRewriteCap: "This website has used all of its rewrites for the last 24 hours. Try again later.",
      errAlreadyWriting: "This article is already being written.",
      errNoActivePlan: "This workspace has no active plan. Choose one to keep writing.",
      errImageStorage: "Image storage is not available right now. Try again later.",
      errImageGeneration: "Image generation is not available right now. Try again later.",
      metaNone: "No meta description yet. Search engines then show a passage from the article.",
      searchPreviewUnsaved: "The preview includes changes that are not saved yet.",
      imageReviewNote: "Changing the picture or its description sends this article back to the RepGet team for review.",
    },
    analytics: {
      googleResults: "Google results",
      connectHelp: "Connect Google to see which searches bring people to your website, and how that changes as we publish.",
      connectGoogle: "Connect Google",
      redirecting: "Redirecting…",
      expired: "The previous connection expired. Reconnect to resume importing.",
      connected: "Connected",
      last28: "Last 28 days.",
      chooseThenImport: "Choose your properties below, then save to import your data.",
      visitorsFromGoogle: "Visitors from Google",
      timesAppeared: "Times you appeared",
      averageRanking: "Average ranking",
      websiteVisits: "Website visits",
      whatPeopleSearched: "What people searched to find you",
      query: "Query",
      visitors: "Visitors",
      searchConsoleProperty: "Search Console property",
      analyticsProperty: "Analytics property",
      chooseProperty: "Choose a property",
      importing: "Importing your data - this takes a moment",
      disconnected: "Google disconnected",
      statusConnected: "Google connected",
      statusCancelled: "Connection cancelled",
      statusForbidden: "You cannot connect that website",
      statusInvalid: "That link was not valid - try again",
      statusError: "Google could not be connected",
      pageTitle: "Google Search & Analytics",
      pageDescription: "How people find your website in Google Search, and how many visits it gets. The figures come from your own Search Console and Google Analytics accounts.",
      rangeLabel: "Period",
      rangeDays: "{days} days",
      periodDates: "{start} – {end}",
      connectTitle: "Connect your Google accounts",
      searchConsoleName: "Google Search Console",
      analyticsName: "Google Analytics",
      searchConsolePurpose: "Shows how your website does in Google Search: how often it is shown (impressions), how often people click through (clicks), its average position, and which searches and pages bring people in.",
      analyticsPurpose: "Shows how many visits (sessions) your whole website receives from every source: Google, other search engines, social media, links and people typing your address.",
      setupTitle: "How connecting works",
      setupStep1: "Sign in with the Google account that can see this website in Search Console and, if you use it, in Google Analytics. One sign-in covers both.",
      setupStep2: "Google asks you to allow read-only access. RepGet can read your figures but cannot change anything in your Google accounts.",
      setupStep3: "Back here, choose the Search Console property and the Analytics property for this website. RepGet imports about the last two months, then new figures every day.",
      readOnlyAccess: "Read-only access. You can disconnect at any time.",
      expiredTitle: "Google needs to be reconnected",
      reconnectGoogle: "Reconnect Google",
      viewerCannotConnect: "Only an owner or an editor of this website can connect Google.",
      connectionTitle: "Google connection",
      connectionHelp: "RepGet imports new figures every day. Google reports with a delay of about three days.",
      notChosen: "Not chosen",
      dataThrough: "Figures up to {date}",
      noFiguresYet: "No figures from Google yet",
      analyticsPropertyId: "Property {id}",
      importNow: "Import now",
      manageConnection: "Manage connection",
      viewerSetupPending: "Google is connected, but no property has been chosen yet. An owner or an editor can choose one.",
      importRequestedTitle: "Import requested",
      importRequestedBody: "RepGet is importing your figures from Google. This page checks for them for about a minute.",
      importStillRunning: "The import can take a few minutes. New figures appear here when it has finished: reload the page later to see them.",
      setupNeededTitle: "Choose what to import",
      setupNeededBody: "Choose the Search Console property and the Analytics property for this website, then save. One of the two is enough.",
      propertiesTitle: "Properties",
      propertiesHelp: "Which of your Google properties belong to this website.",
      loadingProperties: "Loading the properties your Google account can see…",
      propertiesFailed: "Your properties could not be loaded from Google. Try again, or reconnect Google if this keeps happening.",
      tryAgain: "Try again",
      searchConsoleHint: "The Search Console property for this website, for example a domain property.",
      analyticsHint: "The Google Analytics 4 property for this website.",
      noSearchConsoleFound: "No Search Console properties were found for this Google account. Check that it has access, or reconnect with another account.",
      noAnalyticsFound: "No Google Analytics 4 properties were found for this Google account. Check that it has access, or reconnect with another account.",
      noSearchConsoleProperty: "None (do not import from Search Console)",
      noAnalyticsProperty: "None (do not import from Analytics)",
      propertyUnavailable: "{name} (not available to this Google account)",
      saveAndImport: "Save and import",
      saveSelection: "Save",
      selectionUnsaved: "Your new choice is not saved yet.",
      noSelectionChange: "No changes to save.",
      propertiesSaved: "Properties saved",
      accountTitle: "Google account",
      accountHelp: "Reconnect to renew access or to switch to another Google account. Your chosen properties are kept.",
      disconnect: "Disconnect",
      disconnecting: "Disconnecting…",
      disconnectTitle: "Disconnect Google?",
      disconnectBody: "RepGet stops importing from Search Console and Analytics for this website and forgets the chosen properties.",
      disconnectKeeps: "Figures already imported are kept.",
      disconnectAccess: "To remove RepGet’s access from your Google account as well, use your Google account’s security settings.",
      cancel: "Cancel",
      disconnectFailed: "Google could not be disconnected. Try again.",
      importFailed: "The import could not be requested. Try again.",
      googleUnreachable: "Google could not be reached with the saved connection. Reconnect Google and try again.",
      errorNotConfigured: "Connecting Google is not available yet. Please contact support.",
      errorSignIn: "Sign in again to connect Google.",
      errorReconnect: "Reconnect your Google account to continue.",
      errorConnectFirst: "Connect Google first.",
      errorChooseFirst: "Choose a property to import from first.",
      searchTitle: "Google Search",
      searchDescription: "Site-wide figures from Search Console: every page of your website in Google Search, not only the articles RepGet writes.",
      analyticsTitle: "Website visits",
      analyticsDescription: "Sessions on your whole website from every source, from Google Analytics. Not only visits that came from Google Search.",
      clicks: "Clicks",
      clicksHint: "Times someone clicked through to your website from Google Search.",
      impressions: "Impressions",
      impressionsHint: "Times your website was shown in Google Search results.",
      ctr: "Click-through rate (CTR)",
      ctrShort: "CTR",
      ctrHint: "Clicks divided by impressions.",
      averagePosition: "Average position",
      positionShort: "Avg. position",
      positionHint: "Your average place in Google’s results, weighted by impressions. Lower is better.",
      sessions: "Sessions",
      sessionsHint: "Visits to your website from any source. One person can make several sessions.",
      comparedWith: "Changes compare with the previous {days} days.",
      noComparison: "No comparison: not every one of the previous {days} days has figures from Google.",
      noChange: "No change",
      better: "better",
      worse: "worse",
      pointsChange: "{value} pts",
      notAvailable: "Not available",
      daysReported: "Reported on {reported} of {days} days",
      zeroSearch: "Search Console reported no impressions in this period.",
      zeroSessions: "Google Analytics reported no sessions in this period.",
      staleSource: "No {source} property is chosen, so these figures are no longer updated.",
      notSelectedTitle: "No {source} property chosen",
      notSelectedEditor: "Choose one under Google connection to see these figures here.",
      notSelectedViewer: "An owner or an editor can choose one under Google connection.",
      awaitingTitle: "No {source} figures yet",
      awaitingBody: "Google has not reported any figures for this property yet. New or low-traffic websites may have none for a while. RepGet checks for new figures every day.",
      noneInPeriodTitle: "No {source} figures in this period",
      latestFrom: "The latest figures are from {date}. Choose a longer period to include them.",
      latestOnly: "The latest figures are from {date}.",
      dailyTitle: "Day by day",
      dailyDescription: "Days Google has not reported are left as gaps, not drawn as zero.",
      chartMetric: "Figure shown in the chart",
      chartClicks: "Clicks from Google Search per day",
      chartImpressions: "Impressions in Google Search per day",
      chartSessions: "Sessions per day",
      unitClicks: "clicks",
      unitImpressions: "impressions",
      unitSessions: "sessions",
      notReported: "not reported",
      day: "Day",
      chartInstructions: "Use the left and right arrow keys to move between days.",
      chartEmpty: "No daily figures in this period.",
      topTitle: "Top searches and pages",
      topSearches: "Searches",
      topPages: "Pages",
      searchTerm: "Search term",
      page: "Page",
      topSearchesNote: "The 10 searches with the most clicks. Google leaves out rare searches to protect people’s privacy, so these add up to less than the totals above.",
      topPagesNote: "The 10 pages with the most clicks from Google Search.",
      topSearchesCaption: "Top searches in this period",
      topPagesCaption: "Top pages in this period",
      noSearches: "No searches were reported in this period.",
      noPages: "No pages were reported in this period.",
      opensInNewTab: "(opens in a new tab)",
    },
    research: {
      contentPlan: "Content plan",
      articlesTab: "Articles",
      opportunities: "Opportunities",
      refresh: "Refresh",
      looking: "Looking…",
      researchFailed: "Research could not finish, so no content plan was built. Press the button to try again - if it fails twice, contact support.",
      planReady: "Your content plan is ready.",
      planNotRebuilt: "Your content plan could not be rebuilt, so your previous plan is unchanged. Press the button to try again - if it fails twice, contact support.",
      keywordsAdded: "Added {added}.",
      keywordsAddedSkipped: "Added {added}. Skipped {skipped} already tracked or over your plan.",
      replanning: "Rebuilding your content plan…",
      planBusy: "Your plan is being built right now - press {button} once it is ready to include them.",
      plannedArticles: "Planned articles",
      plannedHelp: "Your content plan, by the day each article is due. Hover a planned topic to write it now, change it, or take it off the plan.",
      articles: "Articles",
      articlesHelp: "Written from your content plan. Open one to read, edit or rewrite it.",
      nothingWritten: "Nothing written yet. Use",
      write: "Write",
      title: "Title",
      status: "Status",
      words: "Words",
      keywords: "Keywords",
      keywordsHelp: "Ranked by what you can realistically win. A term with fewer searches you can rank for beats a popular one you cannot.",
      addKeywordsLabel: "Add your own keywords",
      addKeywordsButton: "Add",
      addKeywordsPlaceholder: "wedding videographer tuscany, elopement film italy",
      addKeywordsHelp: "Separate with commas or new lines. Terms you add have no search data of their own, but they still shape your topics and content plan.",
      keyword: "Keyword",
      opportunity: "Opportunity",
      searchesPerMonth: "Searches / mo",
      competition: "Competition",
      topic: "Topic",
      difficultyLow: "Low",
      difficultyMedium: "Medium",
      difficultyHigh: "High",
      difficultyVeryHigh: "Very high",
      researching: "Researching keywords - this takes a minute",
      articleDeleted: "Article deleted",
      statusQueued: "Queued",
      statusGenerating: "Writing…",
      statusDraft: "Draft",
      statusPublished: "Published",
      statusFailed: "Failed",
    },
    publishing: {
      connectTitle: "Connect Your Website",
      connectHelp: "Connect your website once and new articles will get published to your blog automatically.",
      nothingConnected: "Nothing connected yet",
      nothingConnectedHelp: "Connect your website and we can publish finished articles straight to it. Until then, you can still copy them out by hand.",
      publishTest: "Publish test article",
      publishing: "Publishing…",
      disconnect: "Disconnect",
      connected: "Connected",
      cantFind: "Can’t find your integration?",
      cantFindHelp: "Tell us which platform you use and we will look at adding it.",
      contactUs: "Contact us",
      whereDoIFind: "Where do I find these?",
      checkBeforeSaving: "We check the connection before saving anything, so you find out now rather than when an article fails.",
      noPlatformMatch: "No platform match? Publish anywhere with a webhook.",
      forDevelopers: "For developers",
      connectTo: "Connect {name}",
      connectedTo: "Connected to {name}",
      disconnectedFrom: "Disconnected from {name}",
      draftPublished: "Draft published successfully. Check your site’s drafts.",
      draftPublishedAt: "Draft published - open it at {name}",
      pluginRowName: "WordPress plugin",
      pluginAwaiting: "Waiting for WordPress",
      pluginAwaitingHelp: "In the WordPress tab RepGet opened, press Finish connecting to RepGet (Save and connect on older plugins), or press Connect WordPress below.",
      pluginRowFallback: "Connected - waiting for its first report.",
    },
    geo: {
      aiVisibility: "AI visibility",
      aiVisibilityHelp: "Whether an AI assistant names your business when someone asks for a business like yours.",
      checkNow: "Check now",
      checking: "Checking…",
      visibilityScore: "Visibility score",
      weightedByPosition: "Weighted by position",
      vsLastCheck: "vs last check",
      questionsNamingYou: "Questions naming you",
      averagePosition: "Average position",
      notYetNamed: "Not yet named",
      whereYouAppear: "Where you appear in the list",
      lastChecked: "Last checked",
      questionPlaceholder: "e.g. Which dentist in Utrecht is best for nervous patients?",
      add: "Add",
      suggest: "Suggest",
      askHelp: "Ask the way a customer would, and do not name your business - the point is to see whether you come up on your own.",
      suggestedQuestions: "Suggested questions - click to track",
      noQuestions: "No questions tracked yet",
      noQuestionsHelp: "Add the questions your customers would ask an AI assistant, then check whether your business gets named in the answer.",
      notChecked: "Not checked",
      notNamed: "Not named",
      stopTracking: "Stop tracking this question",
      questionAdded: "Question added",
      checkQueued: "Checking - results appear here in a few minutes",
      alreadyTracking: "You are already tracking the questions we would suggest",
      checksUnavailableTitle: "Checks and suggestions are paused for this website",
      errAiUnavailable: "AI checks are not available at the moment. Please try again later.",
      errNoPlan: "Choose a plan for this website to run checks and get suggestions.",
      errPlanInactive: "This website's subscription is not active. Update billing to run checks and get suggestions.",
      errCheckQuota: "AI visibility has been checked several times in the last hour. Please try again later.",
      errSuggestQuota: "Suggestions have been requested many times this hour. Please try again later.",
      errSuggestFailed: "Could not suggest questions. Please try again.",
      errTooShort: "Write a question of at least a few words.",
      errAllowance: "Your plan tracks up to {count} questions. Remove one to add another.",
      errDuplicate: "You are already tracking that question.",
      errAddFirst: "Add a question first.",
      errUnexpected: "Something went wrong. Please try again.",
      statusQueuedTitle: "Check queued",
      statusQueuedBody: "Waiting for the check to start. Answers appear here one question at a time, and you can leave this page in the meantime.",
      statusRunningTitle: "Checking your questions",
      statusRunningBody: "Answers appear here one question at a time. You can leave this page in the meantime.",
      statusProgress: "{answered} of {total} questions answered",
      statusRequestedAt: "Requested {date}",
      statusCompletedTitle: "Check complete",
      statusCompletedBody: "Every question in this check has a new answer.",
      statusPartialTitle: "Check finished with gaps",
      statusPartialBody: "{answered} of {total} questions got a new answer. The others did not get one within 10 minutes; they keep their earlier result and are marked below.",
      statusTimedOutTitle: "No answers yet",
      statusTimedOutBody: "No answers arrived within 10 minutes. The check may still be waiting to run, or it may have failed. Look again later, or run another check.",
      statusTimedOutBodyViewer: "No answers arrived within 10 minutes. The check may still be waiting to run, or it may have failed. Look again later.",
      statusFailedTitle: "The check did not run",
      statusFailedBody: "No answers were recorded for the check requested {date}. You can run another check.",
      statusFailedBodyViewer: "No answers were recorded for the check requested {date}.",
      statusRefusedTitle: "The check was not started",
      dismiss: "Dismiss",
      progressLabel: "Check progress",
      performanceTitle: "How your website is doing",
      performanceHelp: "Measured from the latest answer to each checked question.",
      howMeasured: "How this is measured",
      scoreOutOf: "out of 100",
      scoreGood: "Good",
      scoreFair: "Fair",
      scoreLow: "Low",
      scoreUp: "Up {change} since the previous check",
      scoreDown: "Down {change} since the previous check",
      scoreSame: "No change since the previous check",
      previousCheckOn: "Previous check: {date}",
      firstCheck: "First check, so nothing to compare with yet",
      namedOfChecked: "{mentions} of {total}",
      namedOfCheckedHelp: "Checked questions where your business was recommended",
      positionValue: "#{position}",
      answeredInLatestCheck: "{count} of {total} questions answered in this check",
      basisNote: "Based on the latest answer to {checked} of {tracked} tracked questions.",
      earlierAnswersNote: "1 of these answers is from an earlier check.|{count} of these answers are from earlier checks.",
      notCheckedYetTitle: "Not checked yet",
      notCheckedYetBody: "No question has been checked, so there is no score yet. A score only appears once an assistant has actually been asked.",
      competitorsHelp: "Other businesses recommended in the latest answers, by how many answers named them.",
      competitorCount: "Named in {count} of {total} answers",
      noCompetitors: "No other businesses were named in the latest answers.",
      nextStep: "Next step",
      nextAddQuestions: "Add the questions your customers would ask, or ask for suggestions.",
      nextAddQuestionsAction: "Add questions",
      nextFirstCheck: "Run the first check to see whether assistants name your business.",
      nextUnchecked: "1 question has not been checked yet. Run a check to include it.|{count} questions have not been checked yet. Run a check to include them.",
      nextStale: "1 answer is from an earlier check. Run a check to refresh it.|{count} answers are from earlier checks. Run a check to refresh them.",
      nextNotNamed: "Assistants did not name you for 1 question. See who they named instead.|Assistants did not name you for {count} questions. See who they named instead.",
      nextNotNamedAction: "Show these questions",
      nextUpToDate: "Your results are up to date. Checks also run automatically once a week.",
      nextWaiting: "A check is in progress. Results appear as each question is answered.",
      nextViewer: "Only an owner or an editor can run checks or change the questions.",
      questionsTitle: "Tracked questions",
      questionsHelp: "The questions you track, each with its latest result and the evidence behind it.",
      allowanceCount: "{count} of {max} questions",
      addQuestionLabel: "Add a question",
      atAllowance: "You are tracking as many questions as your plan allows ({max}). Remove one to add another.",
      suggestionsTitle: "Suggested questions",
      suggestionsHelp: "Choose the ones to track. Nothing is added until you press Add selected.",
      addSelected: "Add selected ({count})",
      suggestionsRoom: "You can add 1 more question on your plan.|You can add {count} more questions on your plan.",
      questionsAdded: "1 question added|{count} questions added",
      questionRemoved: "Question removed",
      filterLabel: "Show questions",
      filterAll: "All",
      filterEmpty: "No questions match this filter.",
      showAll: "Show all questions",
      noQuestionsViewer: "No questions are tracked yet. An owner or an editor can add them.",
      named: "Named",
      namedAt: "Named #{position}",
      checkedOn: "Checked {date}",
      fromEarlierCheck: "From an earlier check ({date})",
      checkingNow: "Checking now…",
      noAnswerInCheck: "No answer in the last check",
      answeredInCheck: "Answered in this check",
      siteMentioned: "Your website was mentioned",
      showEvidence: "Show evidence",
      hideEvidence: "Hide evidence",
      removeQuestionLabel: "Stop tracking: {question}",
      evidenceExcerpt: "What the answer said",
      evidenceExcerptNote: "Only the sentence that names your business is stored, not the full answer.",
      evidencePosition: "Your position",
      evidencePositionValue: "#{position} among the businesses the answer recommended",
      evidenceNotRecommended: "Not among the businesses the answer recommended",
      evidenceWebsite: "Your website address",
      evidenceWebsiteYes: "Mentioned in the answer",
      evidenceWebsiteNo: "Not mentioned in the answer",
      evidenceOthers: "Other businesses named, in order",
      evidenceNoOthers: "No other businesses were named.",
      evidenceAssistant: "Assistant asked",
      evidenceChecked: "Checked",
      evidenceHistory: "Earlier results",
      evidenceNoHistory: "This is the first stored result for this question.",
      evidenceStale: "This answer is from an earlier check. The latest check, on {date}, did not return a new answer for this question.",
      evidenceMissed: "The last check did not return a new answer for this question, so this is its earlier result.",
      removeTitle: "Stop tracking this question?",
      removeBody: "Its stored answers and history are deleted as well, and the score is worked out again without it. This cannot be undone.",
      removeConfirm: "Stop tracking",
      removing: "Removing…",
      methodTitle: "What is measured",
      methodHelp: "How a check works and what each number means.",
      methodAskTitle: "How a check works",
      methodAskBody: "Each tracked question is put to an AI assistant as a new conversation, without naming your business. The answer is then read to list the businesses it recommends, in order.",
      methodRecordTitle: "What is recorded",
      methodRecordBody: "Whether your business is among them and at what position, the sentence that names it, the other businesses named, and whether your website address appears. The full answer is not stored.",
      methodScoreTitle: "How the score is worked out",
      methodScoreBody: "A checked question scores 100 when you are named first, less further down the list (about {second} for second, {third} for third and {fourth} for fourth) and 0 when you are not named. The visibility score is the average over the latest answer to each checked question. Questions never checked are left out.",
      methodCompareTitle: "Comparisons",
      methodCompareBody: "The change is measured against the previous check, scored from that check's own answers. Answers more than an hour apart belong to different checks. If the two checks covered different questions, part of the change comes from that.",
      methodScheduleTitle: "When checks run",
      methodScheduleBody: "When an owner or an editor presses {action}, a limited number of times per hour, and automatically once a week. Answers arrive one question at a time over a few minutes.",
      methodAssistantsTitle: "Assistants asked",
      methodAssistantsBody: "The stored answers so far come from: {names}.",
    },
    backlinks: {
      title: "Links from other websites",
      joinHelp: "Google trusts a website more when other sites link to it. Mention another business in your articles to earn a credit, then spend it to get a mention on someone else\u2019s site.",
      capLabel: "Mentions you will include each month",
      capHelp: "Keep this low. A page full of links to other businesses looks suspicious to Google.",
      join: "Join",
      leave: "Leave",
      inTheNetwork: "In the network",
      creditsAvailable: "credits available",
      received: "Backlinks received",
      receivedFlow: "Mentioned in other articles \u2192 Get backlinks \u2192 Spend credits",
      givenTitle: "Backlinks given",
      givenFlow: "Post articles \u2192 Give backlinks \u2192 Earn credits",
      whichPage: "Which of your pages should be linked to?",
      suggestMyPages: "Suggest my pages",
      readingSitemap: "Reading your sitemap…",
      anchorLabel: "Preferred wording (optional)",
      anchorPlaceholder: "teeth whitening in Dublin",
      requesting: "Requesting…",
      requestLink: "Request link (1 credit)",
      noRequests: "No links received yet",
      noRequestsHelp: "Add the pages you want links to under Partner Network above. The RepGet team places them in relevant partners' articles; a link costs its credits only once it is verified live.",
      noneGiven: "None yet. The RepGet team may place a relevant partner's link in one of your articles before it is published; you earn its credits once it is verified live.",
      sourceArticle: "Source article",
      sourceArticleHint: "The article on another website that links to you. Follow it to read the live link.",
      customerWebsite: "Customer website",
      customerWebsiteHint: "The website in the network that published the link.",
      creditsUsed: "Credits used",
      creditsUsedHint: "Credits spent on this link. Returned in full if the link is ever removed.",
      yourArticleHint: "Your article that carries the link.",
      destinationWebsite: "Destination website",
      destinationWebsiteHint: "The website your article links out to.",
      creditsEarned: "Credits earned",
      creditsEarnedHint: "Credits this link earned you, to spend on links back to your own site.",
      onceLive: "+{n} once live",
      held: "{n} held",
      cancelRequest: "Cancel request",
      untitledArticle: "Untitled article",
      joined: "You are in the network",
      leftNetwork: "Left the network",
      requestSaved: "Request saved - waiting for a suitable site",
      requestCancelled: "Request cancelled, credit released",
      statusPending: "Finding a website",
      statusMatched: "Waiting for their next article",
      statusLive: "Live",
      statusCancelled: "Cancelled",
      statusRemoved: "Removed - credit returned",
      hosting: "Hosting up to {cap} links a month ({used} used). {sites} site available to link to you.|Hosting up to {cap} links a month ({used} used). {sites} sites available to link to you.",
      reserved: " ({n} reserved)",
    },
    dashboard: {
      noWebsite: "No website connected yet",
      noWebsiteHelp: "Add your website and we will start finding the search terms your customers actually use.",
      addWebsite: "Add website",
      couldNotLoad: "We could not load this website",
      couldNotLoadHelp: "Try again, or pick a different website.",
      overview: "SEO overview",
      openWebsite: "Open website",
      performing: "How {domain} is performing in search.",
      sharedBadge: "Shared with you · {role}",
      ownerPlanInactive: "This website is paused",
      ownerPlanInactiveHelp:
        "The plan for {domain} is not active, so nothing new can be created. Ask the website's owner to renew it.",
      invitesTitle: "You have been invited",
      inviteBody: "{name} invited you to work on {domain} as {role}.",
      inviteBodyNoName: "You have been invited to work on {domain} as {role}.",
      roleAnEditor: "an editor",
      roleAViewer: "a viewer",
      acceptInvite: "Accept invitation",
      inviteAccepted: "You now have access to {domain}",
    },
    calendar: {
      changeTopic: "Change topic",
      addInstructions: "Add instructions",
      removeFromPlan: "Remove from plan",
      instructionsPlaceholder: "Anything this article should cover or avoid.",
      previousMonth: "Previous month",
      nextMonth: "Next month",
      savedInstructions: "Saved - we will use this when writing",
      removedFromPlan: "Removed from the plan",
      writingStarted: "Writing started - it takes a few minutes",
    },
    addons: {
      moreCredits: "More link credits",
      moreCreditsHelp: "Your plan includes credits each month. Buy more if you run out - these do not expire.",
      termsPill: "One-time purchase · Credits never expire",
      oneTime: "One-time purchase",
      neverExpire: "Credits never expire",
      useAnytime: "Use anytime",
      buyThis: "Buy this",
      buyCredits: "Buy {n} credits",
      unavailable: "Unavailable",
      checkoutFailed: "Could not start checkout. Please try again.",
      yourPurchases: "Your purchases",
      added: "Added",
      delivered: "Delivered",
      inProgress: "In progress",
      requestQuote: "Request a quote",
      quoteHelp: "We quote for the work after reviewing your audit.",
      title: "Add-ons",
      subtitle: "One-off purchases on top of your plan.",
      perCredit: "{price} per credit",
      quoteFrom: "From {price}. We quote for the work after reviewing your audit.",
      servicesTitle: "Services",
      showingRecent: "Showing your {count} most recent purchases.",
    },
    referral: {
      referSomeone: "Refer someone",
      linkLabel: "Your referral link",
      copy: "Copy",
      copied: "Copied",
      copyFailed: "Could not copy. Select the link and copy it manually.",
      linkCopied: "Link copied",
      creditsEarned: "Credits earned",
      waitingToConvert: "Waiting to convert",
      signedUpNotPaying: "Signed up, not yet paying",
      peopleReferred: "People you referred",
      someoneReferred: "Someone you referred",
      notEligible: "Not eligible",
      waiting: "Waiting",
      cardDescription: "Share your link. When someone you refer pays for their first month, you get {credits} link credits.",
      joinedWithName: "{name} · joined {date}",
      joined: "Joined {date}",
      noWebsiteJoined: "No website yet · joined {date}",
      creditsBadge: "+{count} credits",
      linkHelp: "People who sign up through this link count as your referrals.",
      peopleReferredStat: "People referred",
      noReferralsYet: "Nobody has signed up with your link yet.",
      showingRecent: "Showing your {count} most recent referrals.",
      rewardedOn: "credits added {date}",
      unavailable: "Your referral details could not be loaded. Reload the page to try again.",
    },
    keys: {
      updatePlugin: "WordPress has plugin {version}. Version 1.7 connects with one button, shows which RepGet account it publishes for and updates itself: download it, then in WordPress go to Plugins → Add New Plugin → Upload Plugin and choose “Replace current with uploaded”.",
      keyCopied: "Key copied",
      keyCopyFailed: "Could not copy. Select the key and copy it manually.",
      keyRevoked: "Key revoked",
      newKeyLabel: "Your new integration key",
      openWordPress: "Open my WordPress",
      neverUsed: "Never used",
      pluginTitle: "WordPress plugin",
      pluginHelp: "Install our plugin, connect it in one click, and articles publish here automatically.",
      copyNowHelp: "We only store a scrambled version, so it cannot be looked up later. If you lose it, revoke it and make a new one.",
      newKey: "New key",
      keyNotePlaceholder: "What is this key for? (optional)",
      nextSteps: "In WordPress, open RepGet in the menu, paste this key and press Save and connect.",
      connectingIn: "Connecting {domain} in workspace “{workspace}”.",
      stepInstall: "1. Install the plugin",
      stepInstallHelp: "Download it, then upload and activate it in WordPress (Plugins → Add New → Upload Plugin). Skip this if it is already installed.",
      stepConnect: "2. Connect",
      stepConnectHelp: "Opens your WordPress ready to connect. Press Finish connecting to RepGet there (Save and connect on plugins before 1.7) - nothing to copy.",
      connectButton: "Connect WordPress",
      reconnectButton: "Connect again",
      waitingTitle: "Waiting for WordPress…",
      waitingHelp: "In the WordPress tab we opened, press Finish connecting to RepGet (or Save and connect). If WordPress asks you to log in first, log in, then press Open WordPress again.",
      stalledHelp: "Still waiting? If your WordPress already says Connected, it is using a different key - for example from another RepGet account or a test. Finishing in the tab we opened switches it to this account.",
      openAgain: "Open WordPress again",
      copyInstead: "Copy key instead",
      popupBlocked: "Your browser blocked the new tab. Use Open WordPress again, or copy the key and paste it in WordPress.",
      connectedTitle: "Connected",
      lastCheckIn: "Last check-in {date}",
      connectedToast: "WordPress is connected",
      alsoIn: "You also have {domain} in {workspaces}. One WordPress site can publish for only one of them: the key saved in WordPress decides which.",
      madeByConnect: "Made by Connect WordPress",
      advancedTitle: "Keys (advanced)",
      advancedHelp: "Each WordPress install holds one key. You only need these to connect another install by hand, or to stop an install publishing (Revoke).",
      keyReplaced: "That key was replaced or revoked before WordPress used it. Press Connect WordPress again.",
      waitingResumed: "Waiting for WordPress to use the key made a moment ago. If you closed that WordPress tab, press Connect WordPress again.",
      gaveUp: "Stopped waiting. If you finished in WordPress, reload this page; otherwise press Connect WordPress again.",
      notActiveHelp: "If WordPress says you are not allowed to access that page, the plugin is not active yet: do step 1, then press Open WordPress again.",
      madeByHand: "Added by hand",
      quotedName: "“{name}”",
    },
    partnerNetwork: {
      title: "Partner Network",
      subtitle: "Control how your website takes part in RepGet's backlink network.",
      participationTitle: "Network participation",
      participationHelp: "Take part in the RepGet partner network to host relevant links and receive links to your pages.",
      enabled: "Enabled",
      disabled: "Disabled",
      whatTitle: "What this does",
      whatBody: "The RepGet team places relevant links from partners' articles to the pages you list, and may place partners' links in your articles before they are published. Your workspace earns credits for each link you host and spends credits for each link you receive, only once a link is verified live. You never have to choose partners or approve each link.",
      offNote: "Turning this off stops new links being arranged. Links already placed stay as they are, and are still verified and credited.",
      inReview: "{n} of your articles are with the RepGet team for review.",
      ratingTitle: "Minimum authority",
      ratingHelp: "The lowest authority a site linking to you should have.",
      ratingUnconfigured: "Not available yet: authority is not measured for network sites, so a minimum cannot be enforced. The RepGet team checks every linking site by hand.",
      targetsTitle: "Link targeting",
      targetsHelp: "Choose and prioritize which pages on your site should receive backlinks.",
      addTarget: "Add target page",
      urlLabel: "Page address",
      noteLabel: "What this page is (optional)",
      priorityLabel: "Priority",
      high: "High",
      medium: "Medium",
      low: "Low",
      moveUp: "Move up",
      moveDown: "Move down",
      remove: "Remove",
      noTargets: "No target pages yet. Add the pages you most want links to.",
      targetAdded: "Target page added",
      saved: "Saved",
      turnedOn: "You're in the Partner Network",
      turnedOff: "You've left the Partner Network",
      creditsLine: "{available} credits available · {reserved} reserved",
      add: "Add",
      cancel: "Cancel",
      ratingMetric: "Measured as the Domain Authority (0-100) of the linking website.",
      ratingNone: "No minimum",
      ratingNoneHelp: "Any relevant partner may link to you; the RepGet team checks each site by hand.",
      ratingSliderLabel: "Minimum Domain Authority",
      ratingCurrent: "Links only from sites with Domain Authority {n} or above",
      ratingScaleOnly: "Your plan goes up to {cap}. Domain Authority above {cap} comes with the Scale plan.",
      ratingSave: "Save minimum",
      ratingSaved: "Minimum saved",
      ratingNoAccess: "Not available yet: Domain Authority cannot be measured at the moment. The RepGet team checks every linking site by hand.",
    },
    reports: {
      subnavLabel: "Backlinks sections",
      navOverview: "Overview",
      navEarned: "Earned Backlinks",
      navHosted: "Hosted links",
      navCredits: "Credit activity",
      authorityLabel: "Domain Authority",
      authorityValueAria: "Domain Authority {value} out of {max}",
      authorityUpdated: "Updated {date}",
      authorityStale: "From {date} - a refresh is due",
      authorityCollecting: "Being collected",
      authorityNoAccess: "Not available yet",
      authorityNoData: "No data for this site yet",
      authorityError: "Could not be collected - retrying",
      authorityNotConfigured: "Not set up yet",
      authorityWhat: "What is this?",
      authorityHelp: "A 0-100 score based on the websites that link to a domain. It is not your website-health score.",
      authorityDetail: "Domain Authority {value}/{max}, measured {date}",
      authorityUnavailableDetail: "Not available yet",
      rankStaleTitle: "Domain Authority - older than 30 days",
      unknownShort: "n/a",
      unknownRank: "unknown authority",
      issueHosted: "{count} of your articles is missing a partner's link - no credits earned for it|{count} of your articles are missing a partner's link - no credits earned for them",
      issueHostedHelp: "The link was not found on the published article after repeated checks. Restore it, then ask for a new check.",
      issueReceived: "{count} link to your site was not found on the partner's page - you were not charged|{count} links to your site were not found on the partners' pages - you were not charged",
      issueReceivedHelp: "Credits are only spent once a link is verified live. The RepGet team follows up with the partner.",
      reviewResolve: "Review & resolve",
      dismiss: "Dismiss",
      issueFilterGiven: "Showing links not found on your published articles. Restore each link, then use \"Check again\".",
      issueFilterReceived: "Showing links not found on the partner's page. Nothing was charged for them.",
      issueNofollowHosted: "{count} partner link on your articles is marked nofollow - it passes no SEO value|{count} partner links on your articles are marked nofollow - they pass no SEO value",
      issueNofollowHostedHelp: "Search engines ignore links marked nofollow or sponsored. Edit the post, remove nofollow / sponsored from the partner's link, then ask for a new check.",
      issueNofollowReceived: "{count} link to your site is marked nofollow on the partner's page|{count} links to your site are marked nofollow on the partners' pages",
      issueNofollowReceivedHelp: "These links are live but pass little SEO value. The site owner has been asked to make them followed.",
      issueFilterNofollowGiven: "Showing partner links marked nofollow on your published articles. Remove nofollow / sponsored from each link, then use \"Check again\".",
      issueFilterNofollowReceived: "Showing links to your site that the partner's page marks nofollow. The site owner has been asked to fix them.",
      nofollowBadge: "Nofollow",
      overviewTitle: "Backlinks Overview",
      overviewIntro: "Your link portfolio, credit balance and the settings the RepGet team follows when placing links for you.",
      portfolioTitle: "Backlink portfolio",
      verifiedBacklinks: "verified backlink|verified backlinks",
      referringDomains: "from {count} website|from {count} websites",
      strongestLink: "Strongest source",
      strongestHelp: "The highest Domain Authority among the websites linking to you with a verified link.",
      last30Days: "Last 30 days",
      newInWindowHelp: "Links first verified in the last 30 days (UTC).",
      estimatedValue: "Estimated equivalent value",
      estimateNotConfigured: "Estimate not configured",
      estimateNotConfiguredHelp: "RepGet shows a money estimate only once its team has published the rates and their sources. Until then no figure is shown rather than an invented one.",
      howEstimated: "How is this estimated?",
      estimateMethod: "Valuation policy v{version} ({currency}), in force since {date}: one rate per verified link, by the linking site's Domain Authority. Sources: {sources}. An estimate of what equivalent links would cost - not money saved or earned.",
      unvaluedLinks: "{count} verified link has no applicable rate and is not included.|{count} verified links have no applicable rate and are not included.",
      mostRecentLinks: "Most recent links",
      colVerified: "Verified",
      verifiedDateHelp: "The day the link was first seen live.",
      noVerifiedYet: "No verified links yet. They appear here once the verifier sees them live.",
      pipeline: "{publication} awaiting publication · {verification} awaiting verification",
      seeAllBacklinks: "See all backlinks",
      creditsCardTitle: "Backlink credits",
      creditActivity: "Credit activity",
      creditsAvailableLine: "available · {reserved} reserved for links being placed · balance {balance}",
      recoverFromArticles: "Recover credits from {count} article|Recover credits from {count} articles",
      buyCredits: "Buy link credits",
      creditsHowItWorks: "You earn credits when a partner's link in your article is verified live, and spend them when a link to your site is verified live. While a link is being placed its credits are reserved; if a verified link is later removed, they are returned.",
      creditsScopeNote: "Credits belong to your workspace and are shared by all its websites.",
      creditsOwnerOnly: "Credits belong to the workspace that owns this website and are shown to its members only.",
      receivedSectionTitle: "Links to your site",
      receivedFlow: "Placed in partners' articles → verified → credits spent",
      givenSectionTitle: "Links you host",
      givenFlow: "Placed in your articles → verified → credits earned",
      seeAllCount: "See {count} link|See all {count} links",
      earnedTitle: "Earned Backlinks",
      earnedIntro: "Every link your pages have received through the Partner Network, with its source, the words linked and verification status.",
      hostedTitle: "Hosted links",
      hostedIntro: "Partners' links placed in your articles. Each earns credits once it is verified live on your published article.",
      statusFilterLabel: "Filter by status",
      tabAll: "All",
      tabVerified: "Verified",
      tabPending: "Pending",
      tabRefunded: "Refunded",
      typeLabel: "Type",
      typeAll: "Type: all",
      typeManaged: "Placed by the RepGet team",
      typeExchange: "Exchange (automatic matching)",
      resultCount: "{count} link|{count} links",
      recoverFrom: "Recover credits from {count} link|Recover credits from {count} links",
      recoverQueued: "{count} check requested. Credits are earned only if the link is found live.|{count} checks requested. Credits are earned only if the links are found live.",
      searchLabel: "Search links",
      searchPlaceholder: "Website, page or linked words",
      dateFrom: "From",
      dateTo: "To",
      apply: "Apply",
      clearFilters: "Clear filters",
      dateMeaning: "Dates are UTC and show the link's latest step: verified, removed, published or placed.",
      colDate: "Date",
      colLink: "Link",
      colDestination: "Destination",
      colAuthority: "Domain Authority",
      colValue: "Est. value",
      colCredits: "Credits",
      colAiCitation: "AI citations",
      colStatus: "Status",
      colDetails: "Details",
      aiCitationHelp: "How often the page carrying this link was cited in your AI Visibility checks (last 90 days).",
      aiNotMeasured: "Not measured: no AI Visibility checks ran in the last 90 days, or the page is not published yet.",
      aiCitations: "{count} citation|{count} citations",
      aiCitationsDetail: "Cited in {count} AI answer from your AI Visibility checks (last 90 days)|Cited in {count} AI answers from your AI Visibility checks (last 90 days)",
      emptyFiltered: "No links match these filters.",
      emptyReceived: "No links to your site yet. The RepGet team places them in partners' articles; they appear here as soon as one is placed.",
      emptyGiven: "No partner links in your articles yet.",
      unknownWebsite: "Unknown website",
      untitled: "Untitled article",
      dateUnknown: "Date not recorded",
      valueNotApplicable: "Valued once verified",
      showDetails: "Show details for {site}",
      hideDetails: "Hide details for {site}",
      loading: "Loading…",
      sortable: "sortable",
      sortedAsc: "sorted ascending",
      sortedDesc: "sorted descending",
      paginationLabel: "Pages",
      showingRange: "Showing {first}-{last} of {total}",
      perPage: "Per page",
      prev: "Previous",
      next: "Next",
      pageOf: "Page {page} of {pages}",
      valueFootnote: "Estimated equivalent values use valuation policy v{version} ({currency}); they are estimates, not money saved.",
      lcVerified: "Verified",
      lcAwaitingPublication: "Awaiting publication",
      lcAwaitingVerification: "Awaiting verification",
      lcNotFound: "Not found - not charged",
      lcRemoved: "Removed - refunded",
      lcWithdrawn: "Withdrawn - no charge",
      lcUnknown: "Unknown state",
      eventVerified: "verified",
      eventRemoved: "removed",
      eventPublished: "published",
      eventPlaced: "placed",
      eventUnknown: "-",
      creditSettled: "{n} spent",
      creditEarned: "+{n} earned",
      creditReserved: "{n} reserved",
      creditPending: "+{n} once verified",
      creditRefunded: "{n} refunded",
      creditReversed: "{n} reversed",
      creditNone: "No charge",
      dSourceArticle: "Source article",
      dYourArticle: "Your article",
      dSourceSite: "Linking website",
      dDestinationSite: "Destination website",
      dYourPage: "Your page",
      dDestinationPage: "Destination page",
      dAnchor: "Linked words",
      dType: "Placement type",
      dRel: "Link attributes on the page",
      dPublished: "Published",
      dFirstVerified: "First verified",
      dRemoved: "Removed",
      dLastCheck: "Latest check",
      dAuthority: "Source authority",
      dValue: "Estimated value",
      dAiCitation: "AI citations",
      dCredits: "Credits for this link",
      opensNewTab: "(opens in a new tab)",
      notPublishedYet: "Not published yet",
      anchorHidden: "Shown once the partner's article is published",
      relUnknown: "Unknown (not seen live yet)",
      relFollowed: "None (a followed link)",
      relUnfollowed: "{rel} - not followed: passes little SEO value",
      notYet: "Not yet",
      checkAlive: "link found",
      checkMissing: "link not found",
      checkError: "page could not be reached (not counted)",
      fvFromCheck: "From the first successful check (recorded before verification dates were stored).",
      fvFromLedger: "From the settlement entry (recorded before verification dates were stored).",
      valueDetail: "{value}, from the valuation policy and the source's Domain Authority",
      noCreditMovements: "No credits have moved for this link.",
      adviceNotFoundGiven: "The link is missing from your published article. Put it back (or republish the article), then choose \"Check again\" - credits are earned only once it is seen live.",
      adviceNotFoundReceived: "The partner's article does not carry the link. You were not charged; the RepGet team follows up.",
      adviceAwaitingVerification: "The article is live. The link is checked automatically, usually within a day; credits move only once it is seen.",
      adviceAwaitingPublicationGiven: "This link is in one of your articles that is not published yet. It goes out with the article, after the RepGet team's review.",
      adviceAwaitingPublicationReceived: "Placed in a partner's article that is not published yet. Its credits are reserved, not spent.",
      adviceRemoved: "The link was verified, then confirmed gone and removed, so its credits were refunded.",
      recheck: "Check again",
      recheckRecover: "I restored it - check again",
      recheckQueued: "Check requested. It runs shortly; credits move only if the link is seen live.",
      recheckRevived: "Back to awaiting verification. If the link is found live, the credits are settled then.",
      recheckAlreadyQueued: "A check is already queued.",
      recheckCooldown: "Checked recently - you can ask again in a few hours.",
      creditsTitle: "Credit activity",
      creditsIntro: "Every credit your workspace has received, reserved, spent or had returned, newest first.",
      creditsSummary: "Summary",
      creditsAvailable: "Available",
      creditsReservedLabel: "Reserved",
      creditsReservedHelp: "Held for links being placed; spent only once a link is verified live.",
      creditsBalance: "Balance",
      creditsEarnedTotal: "Earned (all time)",
      creditsSpentTotal: "Spent (all time)",
      creditsRefundedTotal: "Refunded (all time)",
      colEntry: "Entry",
      colWebsite: "Website",
      creditsEmpty: "No credit activity yet.",
      workspaceWide: "Workspace",
      ledgerPlanGrant: "Monthly plan allowance",
      ledgerLinkGiven: "Earned: hosted link verified",
      ledgerLinkReceived: "Spent: link to your site verified",
      ledgerRefund: "Refund",
      ledgerPurchase: "Purchased",
      ledgerReferral: "Referral reward",
      ledgerReferralReversed: "Referral reward reversed: payment refunded",
      ledgerReversal: "Reversed: hosted link removed",
      ledgerAdjustment: "Adjustment",
      sectionUnavailable: "This section could not be loaded. Please refresh; if it persists, contact support.",
      websiteAuthority: "Website authority",
      backlinksHeading: "Backlinks",
      openBacklinks: "Open Backlinks",
      partnerNetworkLabel: "Partner Network",
      getCredits: "Get credits",
      verifiedBacklinksLabel: "Verified backlinks",
      availableCredits: "Available credits",
      ownerOnlyShort: "Owner only",
      chartActiveLinks: "Verified links to your site",
      unitLinks: "links",
      noData: "no data",
      chartInstructions: "Use the left and right arrow keys to move between days.",
      undatedLinks: "{count} older verified link has no recorded date and is not on the chart.|{count} older verified links have no recorded date and are not on the chart.",
      todaysArticle: "Today's article",
      nothingWritten: "Nothing written yet. Your first article appears here once your content plan starts.",
      openContentPlan: "Open the content plan",
      stPublished: "Published",
      stAwaitingReview: "With the RepGet team",
      stAwaitingReviewHelp: "Being reviewed by the RepGet team before it goes out. Nothing is published until they approve it.",
      stApproved: "Approved",
      stApprovedHelp: "Approved - goes out on its planned day, {date}, following your publishing settings.",
      stApprovedNoDate: "Approved - goes out following your publishing settings.",
      stScheduled: "Scheduled",
      stScheduledHelp: "Goes out on {date}.",
      stDraft: "Draft",
      stDraftHelp: "Waiting for you to publish it.",
      stWriting: "Being written",
      stFailed: "Needs attention",
      searchVolume: "Search volume",
      perMonth: "{n}/mo",
      difficulty: "Difficulty",
      articleType: "Article type",
      intentCommercial: "Commercial",
      intentTransactional: "Transactional",
      intentInformational: "Informational",
      intentNavigational: "Navigational",
      whyThisTopic: "Why this topic?",
      whyWithVolume: "It targets \"{keyword}\", searched about {volume} times a month.",
      whyKeyword: "It targets \"{keyword}\".",
      winsTitle: "7-day wins",
      winsCount: "{count} win|{count} wins",
      noWins: "Nothing new in the last 7 days yet.",
      winPublished: "Published: {title}",
      winPublishedDetail: "First published to your website this week",
      winLinksReceived: "{count} new link to your site verified|{count} new links to your site verified",
      winLinksReceivedDetail: "Links from partners' articles, seen live",
      winLinksGiven: "{count} hosted link verified - credits earned|{count} hosted links verified - credits earned",
      winLinksGivenDetail: "Partners' links in your articles, seen live",
      winAudit: "Website health checked - score {score}",
      winAuditDetail: "What is holding the site back on Google",
      winClicks: "{count} click from Google (whole site)|{count} clicks from Google (whole site)",
      winClicksDetail: "Search Console data through {date}",
      view: "View",
      bestArticles: "Best articles",
      bestArticlesHelp: "Your RepGet articles that bring the most clicks from Google (last 30 days reported).",
      openGoogleResults: "Open Google results",
      connectSearchConsole: "Connect Google Search Console to see how your articles perform.",
      connect: "Connect",
      noArticleTraffic: "Search Console has not reported clicks or impressions for your RepGet articles yet.",
      colArticle: "Article",
      colClicks: "Clicks",
      colImpressions: "Impressions",
      colPosition: "Position",
      colSessions: "Sessions (GA)",
      colFirstPublished: "First published",
      colKeywordCpc: "Keyword · CPC (USD)",
      searchConsoleThrough: "Search Console data through {date}.",
      analyticsThrough: "Google Analytics data through {date}.",
      connectAnalytics: "Connect Google Analytics to see sessions on your articles.",
      achievements: "Achievements",
      valueHeadline: "Estimated equivalent value: {value}",
      valueHeadlineUnconfigured: "Estimated value not configured yet",
      achievementsIntro: "What your articles and the Partner Network produced in this period. The RepGet team reviews articles and places links by hand.",
      lastNDays: "Last {days} days (UTC)",
      plusArticles: "+{n} articles",
      plusBacklinks: "+{n} backlinks",
      rangeLabel: "Period",
      rangeDays: "{days} days",
      range12m: "12 months",
      viewLabel: "View",
      chart: "Chart",
      details: "Details",
      metricLabel: "Metric shown on the chart",
      trafficValue: "Traffic value",
      trafficValueHelp: "What the clicks to your articles would cost as ads (estimate)",
      backlinkValue: "Backlink value",
      backlinkValueHelp: "Links first verified in this period (estimate)",
      articlesPublished: "Articles published",
      articlesPublishedHelp: "First time live on your site (drafts and edits don't count)",
      articleImpressions: "Article impressions",
      articleImpressionsHelp: "How often your RepGet articles showed in Google",
      articleClicks: "Article clicks",
      articleClicksHelp: "Clicks from Google to your RepGet articles (Search Console)",
      articleSessions: "Article sessions",
      articleSessionsHelp: "Visits to your RepGet articles (Google Analytics)",
      notConnected: "Not connected",
      notConfiguredShort: "Not configured",
      currencyMismatch: "Needs a USD policy",
      websiteHealth: "Website health",
      websiteHealthHelp: "Your latest technical audit - separate from authority",
      noSeries: "No data for this metric in the period yet.",
      utcDays: "Days are UTC calendar days.",
      unitArticles: "articles",
      unitClicks: "clicks",
      unitImpressions: "impressions",
      unitSessions: "sessions",
      breakdownCaption: "Your RepGet articles in this period, by clicks from Google",
      breakdownShowing: "Showing the top {shown} of {total} pages. The totals above include every page.",
      unknownPublicationDates: "{n} earlier articles are live, but when they first went live was not recorded, so they are not counted in any period.",
      noPublishedArticles: "No published RepGet articles yet.",
      methodologyTitle: "How these figures are calculated",
      methodologyPolicy: "Valuation policy v{version}, in {currency}, in force since {date}.",
      methodologyCpc: "Traffic value = each article's Search Console clicks × the cost per click of the keyword it targets, from your keyword research for your market (USD).",
      methodologyFixed: "Traffic value = Search Console clicks to your RepGet articles × {rate} per click.",
      methodologyNoTraffic: "Traffic is not valued under this policy.",
      methodologyBacklinks: "Backlink value per verified link, by the linking site's Domain Authority: {bands}.",
      methodologyNoBacklinks: "Backlinks are not valued under this policy.",
      methodologySources: "Sources: {sources}",
      methodologyExcluded: "Never counted: drafts, links awaiting publication or verification, links not found or removed, internal links and the \"Powered by RepGet\" credit.",
      methodologyNotSavings: "These are estimates of what equivalent ads or links would cost - not money saved, revenue or a guaranteed return.",
      searchPerformance: "Search performance",
      websiteTraffic: "Website traffic",
      aiSearch: "AI search",
      aiNoChecks: "No AI Visibility checks in this period.",
      openAiVisibility: "Open AI Visibility",
      aiChecks: "Answers checked",
      aiMentioned: "Mentioned you",
      aiCited: "Cited your site",
      aiReferralNotMeasured: "Visits arriving from AI assistants are not measured yet - these are answers RepGet checked for you.",
      googleTraffic: "Google traffic",
      connectSearchConsoleTraffic: "Connect Google Search Console to see clicks, impressions and position.",
      siteClicks: "Clicks",
      siteImpressions: "Impressions",
      avgPosition: "Avg. position",
      vsPrevious: "vs previous",
      siteWideThrough: "Whole site, last {days} days; Search Console data through {date}.",
      uncertainTitle: "The last attempt to publish got no answer from your website",
      uncertainHelp: "The post may already exist. Check your website: if the article is there, nothing needs doing; if it is not, confirm below and publish again. We wait rather than risk a duplicate post.",
      uncertainConfirm: "It is not on my site - allow publishing again",
      uncertainConfirmed: "Recorded. You can publish the article again.",
      lcNotFoundGiven: "Not found - no credits earned",
      lcRemovedGiven: "Removed - credits reversed",
    },
    image: {
      altLabel: "Image description",
      altPlaceholder: "What the picture shows",
      promptLabel: "Describe a different picture",
      promptPlaceholder: "An evening ceremony lit by candles, no people in shot",
      noRegensLeft: "You have used all the regenerations for this article. Upload your own picture instead.",
      imageReady: "New image ready",
      imageUploaded: "Image uploaded",
      imageRemoved: "Image removed",
    },
    profile: {
      businessDetails: "Business details",
      detailsHelp: "These details shape your keywords and every article we write.",
      correctAnything: " Correct anything we got wrong.",
      fillsIn: " They fill in automatically once we have analysed the site - you can also enter them now.",
      brandName: "Brand name",
      brandNamePlaceholder: "Acme Ltd",
      industry: "Industry",
      industryPlaceholder: "Dental clinic",
      country: "Primary market",
      countryPlaceholder: "Ireland",
      audience: "Target audience",
      audiencePlaceholder: "Homeowners aged 30-55",
      mainLanguage: "Main language",
      description: "Description",
      descriptionPlaceholder: "What the business does, in a sentence or two.",
      saveDetails: "Save details",
      saving: "Saving…",
      detailsSaved: "Details saved",
      pageTitle: "Business settings",
      pageDescription: "The details of the business behind {domain}. Keyword research and every article we write are based on them.",
      identityTitle: "Business identity",
      identityHelp: "Who you are and what you do.",
      marketTitle: "Market and audience",
      marketHelp: "Where you sell, who you want to reach, and the language your articles are written in.",
      descriptionTitle: "Business description",
      descriptionHelp: "What the business does and what sets it apart, in your own words.",
      competitorsTitle: "Competitors",
      competitorsHelp: "Businesses that compete with you for the same customers. Suggestions come from the analysis of your website, so check them: remove any that are not real competitors and add the ones we missed.",
      brandNameHint: "The name your customers know you by.",
      industryHint: "What you do, in a few words.",
      marketPlaceholder: "Ireland",
      countryHint: "The country you mainly sell in, written in English (for example Spain), so keyword research looks at the right country.",
      marketNotEnglish: "Keyword research only recognises country names written in English.",
      marketUseEnglish: "Use {country}",
      articleLanguage: "Article language",
      articleLanguageHint: "Articles for this website are written in this language. It does not change your dashboard.",
      dashboardLanguageNote: "Your dashboard is shown in {language}, a personal setting in your account.",
      dashboardLanguageLink: "Change dashboard language",
      chooseLanguage: "Choose a language",
      unknownLanguage: "{language} (current value)",
      audienceHint: "Who you want to reach: for example their age, situation or what they need.",
      descriptionHint: "A few sentences is enough: your main products or services, where you work and what makes you different.",
      notSet: "Not set",
      unsavedBadge: "Unsaved",
      saveBusinessDetails: "Save details",
      saveScope: "Covers every section except Competitors, which save as soon as you add or remove one.",
      saveError: "Something went wrong. Your changes are still here, so you can try again.",
      checklistNeedsBoth: "Add a description and choose an article language to complete this step of your launch checklist.",
      checklistNeedsDescription: "Add a description to complete this step of your launch checklist.",
      checklistNeedsLanguage: "Choose an article language to complete this step of your launch checklist.",
      analysingTitle: "Your website is being analysed",
      analysingBody: "When the analysis finishes, it fills in the brand name, industry, market, audience and description, replacing what these fields hold now. The article language you choose is kept.",
      analysingBodyReadOnly: "When the analysis finishes, it fills in these details.",
      refresh: "Refresh",
      analysisFailedTitle: "We could not analyse your website",
      analysisFailedBody: "These details were not filled in automatically. You can enter them yourself.",
      analysisFailedBodyReadOnly: "These details were not filled in automatically.",
      analysisFailedRetry: "You can retry the analysis from the Websites page.",
      goToWebsites: "Go to Websites",
      competitorCount: "1 competitor|{count} competitors",
      manualGroup: "Added by you",
      suggestedGroup: "Suggested by analysis",
      suggestedGroupHelp: "Found when we analysed your website, not chosen by you. Remove any that are not real competitors.",
      suggestedGroupHelpReadOnly: "Found when the website was analysed.",
      competitorsEmpty: "No competitors yet.",
      competitorsEmptyAnalysed: "The analysis of your website did not suggest any competitors.",
      competitorsEmptyAnalysing: "Suggestions appear here when the analysis of your website finishes.",
      competitorsTruncated: "Showing the first {count} competitors.",
      addCompetitor: "Add a competitor",
      addCompetitorHint: "Their website address, for example rival.com. We check that the site exists before adding it, which can take a few seconds.",
      competitorPlaceholder: "rival.com",
      addCompetitorButton: "Add",
      checkingShort: "Checking…",
      checkingCompetitor: "Checking {domain}…",
      competitorAdded: "{domain} added.",
      removingCompetitor: "Removing {domain}…",
      competitorRemoved: "{domain} removed.",
      visitCompetitor: "Open {domain} in a new tab",
      removeCompetitor: "Remove {domain}",
      competitorRequired: "Enter a website address.",
      competitorInvalid: "Enter a website address such as rival.com.",
      competitorOwnSite: "That is your own website.",
      competitorDuplicate: "{domain} is already in your list.",
      competitorNotPublic: "That address is not a public website.",
      competitorBlocked: "Social networks and large platforms such as Google, Amazon or Wikipedia cannot be added as competitors.",
      competitorUnreachable: "We could not reach {domain}. Check the spelling and try again.",
      actionFailed: "Something went wrong. Try again.",
    },
    setup: {
      launchChecklist: "Launch checklist",
      allLive: "All systems live",
      finishSetup: "Finish setting up",
      allLiveHelp: "Every required system is active. Head to the dashboard for your live stats.",
      stepsLeft: "{n} step left before everything runs on its own.|{n} steps left before everything runs on its own.",
    },
    common: {
      cancel: "Cancel",
      done: "Done",
      edit: "Edit",
      preview: "Preview",
      connect: "Connect",
      checking: "Checking…",
      discard: "Discard",
      revoke: "Revoke",
      failed: "Failed",
      images: "Images",
      rewrite: "Rewrite",
      tryAgain: "Try again",
      somethingWentWrong: "Something went wrong on this page",
      remove: "Remove",
      upload: "Upload",
      disconnect: "Disconnect",
      competitors: "Competitors",
      websiteHealth: "Website health",
      checkingWebsite: "Checking your website",
      nothingNeedsAttention: "Nothing needs attention. Check again after you make changes.",
      requestQuote: "Request a quote",
      wantUsToFix: "Want us to fix these for you?",
      saveProperties: "Save properties",
      appeared: "Appeared",
      noImageYet: "No image yet",
      notScheduled: "Not scheduled",
      nothingPlanned: "Nothing planned for this day.",
      defaultsAreFine: "Happy with these? You can change them any time.",
      keepDefaults: "Keep the defaults",
      noPlanYet: "No content plan yet",
      noPlanYetHaveKeywords: "Your search terms are ready, but the plan that turns them into articles has not been built. Build it now.",
      buildPlan: "Build my content plan",
      requestLink: "Request a link",
      admin: "Admin",
      articleLanguageHelp: "Your articles are written in this language.",
      namedInstead: "Named instead of you, most often",
      mostPopular: "Most popular",
      receiptInPayPal: "Receipt in PayPal",
      noCharge: "No charge",
      close: "Close",
      copied: "Copied",
      openMenu: "Open menu",
      changeLanguage: "Change language",
      brandHome: "RepGet home",
      skipped: "Skipped",
      hideSetupSteps: "Hide setup steps",
      setupProgress: "Setup progress",
      secureCheckout: "Secure checkout",
      skipForNow: "Skip for now",
      verifiedCustomer: "Verified customer",
      searchYourImages: "Search your images",
      critical: "Critical",
      suggestion: "Suggestion",
      warning: "Warning",
      importData: "Import data",
      auditIntro: "We check your pages and list what is holding your website back on Google, with the exact page each problem is on.",
      losingTrafficIntro: "Pages getting fewer clicks, or showing up less in Google, than a month ago. From your Search Console data.",
      noCompetitorsFound: "We did not find any from your site. Add the rivals you know of and we will use them to find content gaps.",
      competitorsHelp: "Who else shows up when buyers search your space. We use these to find content gaps and the terms worth going after.",
      connectWebsiteFirst: "Connect your website under Settings → Integrations first. Until then, articles wait in RepGet.",
      generationHelp: "How your articles get written, and what happens to them when they are ready.",
      altHelp: "Read aloud to people using a screen reader, and by search engines.",
      featuredImageHelp: "The picture at the top of the article, and the one shown when it is shared.",
      factsOnePerLine: "One per line. These are the only specifics we will state outright about your business - everything else stays general.",
      voiceBehindArticles: "The voice behind every article. Merged in from its own panel, so one Save covers the whole screen.",
      creditsExplainer: "Credits are added to your account and can be spent on link building. They are not cash and cannot be withdrawn. A referral counts once the person you referred pays for their first month, and only new accounts can be referred, each one once.",
      articleInProgress: "This article can no longer be rescheduled or edited as it is in progress.",
      researchIntro: "We will find the search terms your customers use, group them into topics, and turn those into a plan of articles to publish.",
      noCreditsLeft: "No credits left. Include a link for someone else to earn one, or wait for next month\u2019s allowance.",
      promoCodesHelp: "Promo codes can be entered at card checkout. PayPal does not support discount codes.",
      write: "Write",
      writingAndPublishing: "Writing and publishing",
      featuredImage: "Featured image",
      backlinksLabel: "Backlinks",
      uploadLabel: "Upload",
      aiAssistantsTracked: "AI assistants tracked",
      freshArticles: "Fresh articles",
      toSetUp: "To set up",
      trustedByBusinesses: "Trusted by businesses worldwide",
      weekly: "Weekly",
      twoMinutes: "2 min",
      notAvailable: "This page is not available",
      notAvailableHelp: "The page may have moved, or it belongs to a workspace you are not a member of.",
      backToDashboard: "Back to dashboard",
      viewWebsites: "View your websites",
      goToDashboard: "Go to dashboard",
      setUp: "Set up",
      setUpHelp: "Walk through the launch flow step by step.",
      manageBilling: "Manage billing",
      manageInPayPal: "Manage in PayPal",
      payWithPayPal: "Pay with PayPal",
      noPlans: "No plans are available yet.",
      billingHistory: "Billing history",
      billingHistoryHelp: "Every subscription payment on this workspace.",
      invoice: "Invoice",
      downloadPlugin: "Download the plugin",
      pluginGuide: "Setup guide",
      cantFindIntegration: "Can’t find your integration?",
      adaptive: "Adaptive",
      custom: "Custom",
      wordRange: "Between 300 and 5,000.",
      findOpportunities: "Find opportunities",
      noOpportunities: "No opportunities found yet",
      losingTraffic: "Losing traffic",
      notWrittenHere: "Not written here",
      nothingLosing: "Nothing is losing traffic",
      nothingLosingHelp: "No page lost 30% or more of its clicks, and none slipped in Google. Pages with fewer than 10 clicks a month are checked by ranking instead.",
      losingClicksTitle: "Losing clicks",
      losingClicksHelp: "Lost 30% or more of their clicks, from at least 10 in the earlier 28 days.",
      losingVisibilityTitle: "Losing visibility",
      losingVisibilityHelp: "Fell 3 or more places in Google, or were shown in half as many searches. Checked for pages shown at least 100 times, so pages with few clicks are still watched.",
      watchTitle: "Worth watching",
      watchHelp: "Down 10-30% in clicks. Not a clear decline yet.",
      noClickLosses: "No page lost 30% or more of its clicks.",
      clicksChange: "{before} → {after} clicks",
      percentDown: "down {pct}%",
      percentUp: "up {pct}%",
      rankingChange: "ranking {before} → {after}",
      shownChange: "shown {before} → {after} times",
      windowNote: "The last 28 days Google has reported, up to {date}, against the 28 before.",
      writeAutomatically: "Write articles automatically",
      daysToWrite: "Days to write on",
      publishWithoutAsking: "Publish without asking me",
      whenFinished: "When an article is finished",
      finishedReview: "Keep it in RepGet for me to review",
      finishedReviewHelp: "Nothing reaches your website until you press Publish on the article.",
      finishedDraft: "Send it to my site as a draft",
      finishedDraftHelp: "It appears in your CMS as a draft on its planned day. You publish it there.",
      finishedLive: "Publish it live on its planned day",
      finishedLiveHelp: "It goes live on your website on its planned day, with nothing for you to do.",
      firstArticleNote: "Your first article goes out as soon as it is ready, whichever you choose, so you can see how articles look on your site. While your website is in the Partner Network, every article - the first one too - is checked by the RepGet team first, and none goes out before its planned day.",
    },
    nav: {
      dashboard: "Dashboard",
      setUp: "Set up",
      plannedArticles: "Planned Articles",
      backlinkExchange: "Backlink Exchange",
      websiteHealth: "Website Health",
      googleResults: "Google Results",
      googleConnect: "Google Search & Analytics",
      aiVisibility: "AI Visibility",
      losingTraffic: "Losing Traffic",
      settings: "Settings",
      addons: "Add-ons",
      main: "Main",
      referralProgram: "Referral program",
      business: "Business",
      articleSettings: "Article Settings",
      integrations: "Integrations",
      account: "Account",
      billing: "Billing",
      settingsSections: "Settings sections",
    },
    status: {
      pending: "Waiting to start",
      crawling: "Reading your site",
      researching: "Finding opportunities",
      generated: "Content planned",
      ready: "Ready",
      queued: "Waiting",
      running: "Running",
      completed: "Completed",
      planned: "Planned",
      draft: "Draft",
      generating: "Writing",
      published: "Published",
      publish: "Publishing",
      scheduled: "Scheduled",
      connected: "Connected",
      disconnected: "Not connected",
      live: "Live",
      removed: "Removed",
      matched: "Matched",
      active: "Active",
      inactive: "Inactive",
      cancelled: "Cancelled",
      expired: "Expired",
      paid: "Paid",
      rewarded: "Rewarded",
      refunded: "Refunded",
      fulfilled: "Fulfilled",
      failed: "Needs attention",
      rejected: "Rejected",
      missing: "Missing",
    },
    editorUi: {
      bold: "Bold",
      italic: "Italic",
      strikethrough: "Strikethrough",
      heading: "Heading",
      subheading: "Subheading",
      bulletedList: "Bulleted list",
      numberedList: "Numbered list",
      quote: "Quote",
      code: "Code",
      addLink: "Add link",
      removeLink: "Remove link",
      insertImage: "Insert image",
      undo: "Undo",
      redo: "Redo",
      chooseImage: "Choose an image",
      articleHtml: "Article HTML",
      noImageSelected: "No image selected",
      pickOneBelow: "Pick one below, or upload your own.",
      closeImagePicker: "Close image picker",
      imageAlt: "Image description (alt text)",
      imageAltPlaceholder: "What the picture shows",
      replaceImage: "Replace image",
      saveImage: "Save",
      noMatches: "Nothing matches that.",
      noPicturesYet: "No pictures yet - upload one to start.",
      toolbarLabel: "Text formatting",
      groupText: "Text style",
      groupHeadings: "Headings",
      groupBlocks: "Lists and blocks",
      groupLinks: "Links",
      groupMedia: "Images",
      groupHistory: "Undo and redo",
      linkDialogTitle: "Add or change a link",
      linkDialogHelp: "Paste the full address, for example https://example.com/page.",
      linkUrlLabel: "Link address",
      linkApply: "Apply",
      linkInvalid: "Enter an address that starts with https://, http://, mailto:, tel:, / or #.",
      htmlHint: "Editing the HTML directly. Anything unsafe is removed when you save.",
      richHint: "Formatting is kept simple so it matches your site's own styling.",
      editHtml: "Edit HTML",
      backToEditor: "Back to editor",
      htmlToolbarOff: "The formatting buttons are off while you edit the HTML.",
    },
    dash: {
      bestArticles: "Best articles",
      bestArticlesHelp: "Your pages that bring the most people from Google.",
      openGoogleResults: "Open Google results",
      connectForPages: "Connect Google Search Console to see which of your pages people find.",
      clicks: "Clicks",
      impressions: "Impressions",
      position: "Position",
      searchPerformance: "Search performance",
      websiteTraffic: "Website traffic",
      aiSearchTraffic: "AI search traffic",
      googleTraffic: "Google traffic",
      vsLastMonth: "vs last month",
      averagePosition: "Average position",
      connectForClicks: "Connect Google Search Console to see clicks, impressions and position.",
      achievements: "Achievements",
      achievementsHelp: "All of this happened automatically since you joined.",
      last30Days: "Last 30 days",
      adSpendSaved: "Ad spend saved",
      adSpendHelp: "What this traffic would cost in Google Ads.",
      backlinkCostSaved: "Backlink cost saved",
      showedUpHelp: "How often you showed up in Google.",
      visitorsFromArticles: "Visitors from articles",
      siteHealth: "Your site\u2019s health",
      siteHealthHelp: "Out of 100, from your latest check.",
      websiteAuthority: "Website authority",
      backlinks: "Backlinks",
      openBacklinks: "Open backlinks",
      backlinkExchange: "Backlink exchange",
      getCredits: "Get credits",
      verifiedBacklinks: "Verified backlinks",
      availableCredits: "Available credits",
      noLinksYet: "No links yet. Once other sites in the network link to yours, they appear here.",
      todaysArticle: "Today\u2019s article",
      nothingWrittenYet: "Nothing written yet. Once your content plan is built, the article for today shows here.",
      openContentPlan: "Open the content plan",
      searchVolume: "Search volume",
      difficulty: "Difficulty",
      articleType: "Article type",
      whyThisTopic: "Why this topic?",
      view: "View",
      addAWebsite: "Add a website",
      sharedWithYou: "Shared with you",
      sharedSiteLabel: "Shared with you · {role}",
      roleEditor: "Editor",
      roleViewer: "Viewer",
    },
    wpConnect: {
      title: "Connect WordPress",
      signedInAs: "Signed in as {email}",
      goneTitle: "This connection has ended",
      goneBody: "It expired, was cancelled or has already been used. Go back to WordPress and press Connect to RepGet again.",
      otherBrowserTitle: "This connection was opened somewhere else",
      otherBrowserBody: "For your security, a connection can be finished only in the browser that opened it first. Go back to WordPress and press Connect to RepGet again.",
      noneTitle: "{domain} isn’t in this RepGet account yet",
      noneBody: "Add {domain} as a website first, then press Connect to RepGet in WordPress again. If it is in another RepGet account, sign in to that one. If WordPress runs at a different address from your website in RepGet (for example blog.example.com), connect it with a key instead: in RepGet open Integrations → WordPress plugin → Keys (advanced) → New key, and paste it in WordPress under Advanced: use an Integration Key.",
      addWebsite: "Add a website",
      useOtherAccount: "Use a different account",
      confirmTitle: "Connect {domain} to RepGet?",
      confirmBody: "The WordPress site at {site} will publish the articles RepGet writes for the website below. You can disconnect it at any time in WordPress.",
      inWorkspace: "Workspace “{workspace}”",
      movedWarning: "This WordPress site is connected to another RepGet account. If you continue, that account stops publishing here.",
      movedWarningNamed: "This WordPress site is connected to {domain} in workspace “{workspace}”. If you continue, that website stops publishing here.",
      connect: "Connect {domain}",
      connectAgain: "Connect {domain} again",
      move: "Move {domain} to “{workspace}”",
      cancel: "Cancel",
      tooManyKeys: "This website already has 5 keys. Revoke one you no longer use under Integrations → Keys (advanced), then try again.",
      notAllowed: "You can’t connect WordPress to that website with this account.",
    },
    auth: {
      redirecting: "Redirecting…",
      continueWithGoogle: "Continue with Google",
      orContinueWithEmail: "Or continue with email",
      fullName: "Full name",
      namePlaceholder: "John Doe",
      email: "Email",
      emailPlaceholder: "you@example.com",
      password: "Password",
      passwordHint: "At least 8 characters.",
      tooManyAttempts: "Too many attempts. Wait a few minutes and try again.",
      passwordTooLong: "Use at most 128 characters.",
      emailMeACode: "Email me a sign-in code",
      usePasswordInstead: "Use a password instead",
      sendCode: "Send me a code",
      sendingCode: "Sending your code…",
      codeLabel: "Sign-in code",
      codePlaceholder: "123456",
      codeHelp: "We sent a six-digit code to {email}. It expires in 10 minutes.",
      verifyCode: "Sign in",
      verifying: "Checking your code…",
      resendCode: "Send another code",
      useDifferentEmail: "Use a different email",
      codeSent: "Check your email for the code.",
      codeNotSent: "That code could not be sent. Try again.",
      codeInvalid: "That code is not right, or it has expired.",
      enterEmailFirst: "Enter your email address first.",
      organizations: "Organizations",
      loading: "Loading…",
      createOrganization: "Create organization",
      orgHelp: "Each organization has its own websites, content and billing.",
      name: "Name",
      orgPlaceholder: "Acme Marketing",
      cancel: "Cancel",
      notifications: "Notifications",
      markAllRead: "Mark all read",
      nothingYet: "Nothing yet. We will tell you here when your articles and audits are ready.",
      unread: "Unread",
    },
    onboarding: {
      whatsYourWebsite: "What\u2019s your website?",
      websiteIntro: "Enter your website and we will work out what your business does, who it is for, and what it should rank for.",
      websiteAddress: "Your website address",
      websitePlaceholder: "yourbusiness.com",
      lookUpWebsite: "Look up this website",
      detected: "Detected",
      addingWebsite: "Adding your website…",
      continueLabel: "Continue",
      pressArrow: "Press the arrow to check your website first, or continue straight away.",
      readingWebsite: "Reading your website…",
      websiteFound: "Website found",
      enterAddressToSee: "Enter your address to see what we find.",
      regionNext: "Region and category next",
      weWillUseWebsite: "We will use your website to understand your business.",
      activateRepGet: "Activate RepGet",
      seeHowAiTalks: "See how AI talks about your brand",
      trackQuestions: "Track the questions customers ask AI before they discover your company.",
      trackingOn: "Tracking on",
      noAssistants: "No assistants are configured on this deployment yet. Questions are saved and checked once one is.",
      questionsWorthTracking: "Questions worth tracking",
      suggestedFromSite: "We have suggested these from your website and market. Remove any that do not fit.",
      writingQuestions: "Writing questions your customers would ask…",
      noQuestionsYet: "No questions yet. Add one below, or ask for suggestions.",
      addQuestionPlaceholder: "Add a question your customers would ask",
      addQuestion: "Add question",
      writing: "Writing…",
      suggestMore: "Suggest more",
      getStarted: "Get started",
      setupProgress: "Setup progress",
      readingNow: "We are reading your website now. This usually takes a minute or two.",
      view: "View",
      goToDashboard: "Go to your dashboard",
      searchOpportunities: "Search opportunities",
      topicClusters: "Topic clusters",
      publishingPlan: "Publishing plan",
      articlesContentBacklinks: "Articles, content & backlinks",
      heresWhatWellBuild: "Here\u2019s what we\u2019ll build",
      thenOnChecklist: "Then, on your setup checklist",
      buildMyPlan: "Build my content plan",
      starting: "Starting…",
      takesFewMinutes: "Takes a few minutes. You can continue while we build it in the background.",
      connectGoogle: "Connect Google",
      analyticsTellUs: "Analytics and Search Console tell us which articles are working, so we can write more of what does.",
      connectedChangeLater: "Connected. You can change this later in Integrations.",
      openingGoogle: "Opening Google…",
      whyWeAsk: "Why we ask for this",
      readPerformanceOnly: "We read performance only - clicks, impressions and sessions for your own site. We never post, change or delete anything in your Google account, and you can disconnect at any time.",
      connected: "Connected",
      plansUnavailable: "Plans are not available right now. Please check back shortly.",
      growthEngineReady: "Your growth engine is ready",
      plan: "Plan",
      payYearly: "Pay yearly",
      paypalNoTrial: "PayPal starts your plan straight away, without the free trial.",
      cancelAnyTime: "Cancel any time. A promotion code can be entered at checkout.",
      whatsIncluded: "What\u2019s included",
      secureByStripe: "Secure checkout by Stripe. Your card details never reach us.",
      paymentTakingLonger: "Your payment went through. Activating the plan is taking longer than usual.",
      activatingNow: "Thank you. We are activating your plan now; this usually takes a few seconds.",
      goToMyWebsite: "Go to my website",
      checkBilling: "Check billing",
      extraordinaryBusinesses: "Extraordinary businesses deserve greater visibility.",
      chooseYourPlan: "Choose your plan",
      whatHappensSubscribe: "What happens the moment you subscribe",
      weResearchKeywords: "We research your keywords, build a content calendar sized to your plan, and start writing. You will have your first article to review shortly after.",
      contentAndBacklinks: "Content & backlinks",
      addYourWebsite: "Add your website",
    },
  },
};

const es: Messages = {
  nav: {
    howItWorks: "Cómo funciona",
    freeCheck: "Análisis gratuito",
    tools: "Herramientas",
    pricing: "Precios",
    blog: "Blog",
    faq: "Preguntas frecuentes",
    about: "Nosotros",
    signIn: "Iniciar sesión",
    getStarted: "Empezar",
    contact: "Contacto",
    successStories: "Casos de éxito",
    getStartedCta: "Empezar",
    platform: "Plataforma",
    platformHeading: "Explora la plataforma",
    platformItems: [
      {
        title: "Motor de contenidos",
        detail:
          "Planifica y genera artículos diseñados para aumentar la visibilidad orgánica.",
      },
      {
        title: "Red de autoridad",
        detail:
          "Consigue enlaces relevantes y refuerza la autoridad de tu dominio.",
      },
      {
        title: "Inteligencia del sitio",
        detail:
          "Detecta problemas técnicos y de SEO que afectan a tu rendimiento.",
      },
      {
        title: "Rendimiento en búsqueda",
        detail: "Sigue posiciones, visibilidad y resultados en Google.",
      },
      {
        title: "Presencia en IA",
        detail:
          "Comprueba con qué frecuencia aparece tu marca en ChatGPT, Claude, Perplexity y la búsqueda con IA.",
      },
      {
        title: "Recuperación de tráfico",
        detail: "Identifica páginas en caída antes de perder tráfico valioso.",
      },
    ],
  },
  footer: {
    tagline: "Resultados SEO para pequeñas empresas, sin agencia.",
    product: "Producto",
    legal: "Legal",
    freeCheck: "Análisis gratuito de tu web",
    freeTools: "Herramientas gratuitas",
    pricing: "Precios",
    blog: "Blog",
    faq: "Preguntas frecuentes",
    about: "Nosotros",
    contact: "Contacto",
    backlinkExchange: "Intercambio de enlaces",
    publishers: "Monetiza tu blog",
    affiliate: "Recomienda una empresa",
    privacy: "Privacidad",
    terms: "Términos",
    refunds: "Reembolsos",
  },
  home: {
    eyebrow: "Posiciónate. Que te citen. Que te recomienden.",
    title: "Posiciónese en Google. Aparezca en las respuestas de IA",
    subtitle:
      "RepGet publica contenido SEO, consigue enlaces de calidad y construye la autoridad que hace que descubran su negocio.",
    checkFree: "Analizar mi web gratis",
    getStarted: "Empezar",
    noCard: "No hace falta tarjeta para el primer análisis.",
    auditBand: "Gratis con tu análisis",
    auditItems: [
      {
        title: "Auditoría SEO e IA",
        body: "Vea el estado de su web, qué falta y si los asistentes de IA le mencionan.",
      },
      {
        title: "Un plan para actuar",
        body: "Los cambios concretos que merece la pena hacer, en el orden en que conviene hacerlos.",
      },
      {
        title: "Su primer enlace",
        body: "Un enlace de una empresa real de un sector afín, ganado y no comprado.",
      },
    ],
    auditPlaceholder: "Introduzca su web",
    auditAssurances: ["Sin crear cuenta", "Nada que cancelar"],
    checkMyWebsite: "Analizar mi web",
    howItWorks: "Cómo funciona",
    steps: [
      {
        title: "Análisis",
        body: "Leemos su web, encontramos qué la frena y comprobamos si los asistentes de IA la mencionan.",
      },
      {
        title: "Conexión",
        body: "Conecte su web - WordPress, Ghost, Shopify o un webhook - para que publiquemos por usted.",
      },
      {
        title: "Crecimiento",
        body: "Investigamos, escribimos y publicamos, y le mostramos qué ha cambiado de verdad.",
      },
    ],
    problemsEyebrow: "Problemas y solución",
    yourProblem: "Su problema",
    ourSolution: "Nuestra solución",
    problems: [
      "La publicidad de pago agota su presupuesto cada mes, y se detiene en cuanto usted lo hace.",
      "Horas perdidas entre auditorías, palabras clave, contenido y un montón de herramientas distintas.",
      "Los asistentes de IA recomiendan a su competencia, y usted nunca se entera.",
    ],
    solutionTitle: "Todo lo que necesita, en un solo sitio",
    solution: [
      "Auditoría SEO y de preparación para IA",
      "Seguimiento de visibilidad en asistentes de IA",
      "Investigación de palabras clave y mercado",
      "Artículos escritos y publicados automáticamente",
      "Enlaces ganados de empresas reales",
    ],
    stackEyebrow: "Nosotros frente a un montón de herramientas",
    stackTitle: "Una suscripción sustituye",
    stackTitleAccent: "todo su conjunto de herramientas SEO",
    stackSub:
      "Auditoría, visibilidad en IA, investigación, contenido, publicación, enlaces e informes: todo en un sitio y por menos de lo que cuestan las herramientas por separado.",
    seePricing: "Ver precios",
    replaces: [
      "Auditoría SEO y rastreo del sitio",
      "Seguimiento de visibilidad en IA",
      "Investigación de palabras clave y mercado",
      "Artículos escritos y optimizados",
      "Publicación en su CMS",
      "Creación de enlaces",
      "Informes de Search Console y Analytics",
    ],
    publishesTitle: "Publica",
    publishesAccent: "directamente",
    publishesTitleEnd: "en su web",
    publishesSub:
      "Conecte una vez. Sin subidas manuales ni copiar y pegar: los artículos aparecen solos en su web, con sus imágenes.",
    publishesPlugin:
      "Nuestro plugin de WordPress se conecta con una sola clave y funciona incluso si su alojamiento bloquea la API de WordPress.",
    platformOther: "Cualquier web mediante webhook",
    trackedTitle: "Ve exactamente qué ha cambiado",
    trackedSub:
      "No es un PDF mensual. Es un panel que lee sus propios datos de Search Console y Analytics.",
    tracked: [
      { label: "Posiciones y clics", detail: "Desde Search Console" },
      { label: "Visibilidad en IA", detail: "Si los asistentes le nombran" },
      { label: "Enlaces conseguidos", detail: "Comprobados a diario" },
      { label: "Artículos publicados", detail: "Y qué resultado dieron" },
    ],
    pillars: [
      {
        title: "Publique contenido SEO",
        body: "Artículos de calidad generados y optimizados para su sector.",
      },
      {
        title: "Consiga enlaces reales",
        body: "Sea citado en webs relevantes para aumentar su autoridad.",
      },
      {
        title: "Siga su progreso",
        body: "Vea posiciones, tráfico y resultados en un panel sencillo.",
      },
      {
        title: "Ahorre tiempo con IA",
        body: "Deje que la IA trabaje mientras usted se centra en su negocio.",
      },
    ],
    previewTitle: "Su crecimiento, en automático.",
    previewSub: "Contenido de calidad. Enlaces reales. Más visibilidad.",
    previewCaption:
      "Un panel de ejemplo. Sus cifras empiezan en cero y crecen desde ahí.",
    titleLead: "Posiciónese en Google.",
    titleAccent: "Aparezca en las respuestas de IA.",
    heroCards: [
      { label: "Posiciones y clics", detail: "Desde Search Console" },
      { label: "Visibilidad en IA", detail: "Si los asistentes le nombran" },
      { label: "Crecimiento de tráfico", detail: "Llegue a más clientes" },
      {
        label: "Presente en respuestas de IA",
        detail: "Apareciendo donde importa",
      },
      { label: "Enlaces de calidad", detail: "Citado por webs reales" },
      { label: "Seguimiento de palabras clave", detail: "Vea qué funciona" },
    ],
    joinGoogle: "Entrar con Google",
    seeHow: "Vea cómo funciona",
    videoTitle: "Vea RepGet en dos minutos",
    videoSub:
      "Un recorrido breve por lo que ocurre después de conectar una web.",
    videoComingSoon:
      "Estamos grabando el vídeo explicativo. Mientras tanto, el análisis gratuito le enseña lo mismo sobre su propia web.",
    worksWithTitle: "Funciona con las herramientas que ya usa",
    networkEyebrow: "Una red de enlaces verificada",
    networkTitle: "Una red de enlaces",
    networkTitleRest: "que se refuerza con cada nuevo cliente.",
    networkHeading: "Intercambio automático de enlaces",
    networkPoints: [
      "Cada cliente da y recibe enlaces",
      "Los enlaces vienen de empresas de sectores afines, nunca ajenos",
      "Colocados dentro de artículos reales, no en una página de enlaces",
      "Comprobados a diario: si se retira un enlace, avísenos y recupera su crédito",
    ],
    networkHowLink: "Cómo funciona el intercambio",
    pricingEyebrow: "Precios",
    pricingTitle: "Empiece pequeño.",
    pricingTitleAccent: "Crezca cuando esté listo.",
    pricingSub:
      "Un análisis gratuito para empezar, sin contrato y cancele cuando quiera.",
    seeAllPlans: "Ver todo lo que incluye cada plan",
    mostPopular: "Más popular",
    tryItFirst: "Pruébalo primero",
    getStartedPlan: "Empezar",
    perMonth: " / mes",
    unavailable:
      "Los precios no están disponibles ahora mismo. Vuelva a intentarlo en breve.",
    planArticles: "{n} artículo al mes|{n} artículos al mes",
    planBacklinks: "Backlinks de nuestra red de socios",
    planPublishing: "Publicación automática en WordPress, Shopify y más",
    closingTitle: "Empiece a crecer en piloto automático hoy",
    closingSub:
      "Analice su web gratis y vea qué la está frenando. Sin crear cuenta.",
    cancelAnytime: "Cancele cuando quiera",
    guarantee: "Garantía de devolución de 14 días",
  },
  pricing: {
    title: "Precios sencillos",
    subtitle:
      "Todo está incluido en cada plan. La diferencia es cuánto escribimos para usted cada mes y cuántos backlinks recibe de nuestra red de socios.",
    perMonth: " / mes",
    getStarted: "Empezar",
    mostPopular: "Más popular",
    tryItFirst: "Pruébalo primero",
    starterTagline:
      "Pruébanos con un artículo real y un enlace real antes de subir de plan.",
    unavailable:
      "Los precios no están disponibles en este momento. Vuelva a intentarlo en breve.",
    annualNote:
      "Los planes anuales están disponibles al registrarse, con dos meses gratis. Cancele cuando quiera: consulte nuestra",
    refundPolicy: "política de reembolsos",
    features: {
      articles: "{n} artículo escrito al mes|{n} artículos escritos al mes",
      keywords: "{n} términos de búsqueda monitorizados",
      backlinks: "Backlinks de nuestra red de socios",
      audit:
        "Auditoría del sitio, para que tus páginas estén listas para la IA y Google",
      healthChecks: "Análisis de salud de la web",
      publishing: "Publica en WordPress, Ghost o Shopify",
    },
  },
  about: {
    metaTitle: "Quiénes somos",
    metaDescription: "Por qué existe RepGet y para quién es.",
    title: "Resultados de SEO sin agencia",
    intro: [
      'Un dentista, un fontanero o un pequeño bufete sabe que debería "hacer SEO". Lo que eso requiere en realidad es alguien que investigue palabras clave, alguien que escriba, alguien que entienda las auditorías técnicas y alguien que consiga enlaces. Una agencia lo agrupa todo por unos miles al mes.',
      "La mayoría de las pequeñas empresas no puede justificar ese gasto, así que no hace nada, y sigue siendo invisible justo en las búsquedas que le traerían clientes.",
      "Creamos esto para hacer ese trabajo automáticamente, a un precio que una pequeña empresa sí puede pagar.",
    ],
    beliefTitle: "En qué creemos",
    beliefLead: "Recomendar solo lo que se puede ganar de verdad.",
    belief: [
      "Un término buscado 12.000 veces al mes no le sirve de nada si no tiene ninguna posibilidad de posicionarse. Uno buscado 300 veces, por alguien listo para comprar, puede traerle un cliente el mes que viene.",
      "Ese principio está integrado en el producto, no solo escrito aquí. Nuestra puntuación coloca deliberadamente los términos alcanzables por encima de los populares, y valora si quien busca tiene de verdad intención de comprar. Nuestro emparejamiento de enlaces se niega a unir a un dentista con una web sin relación, aunque los números parezcan buenos.",
      "Una herramienta que produce un trabajo aparentemente impecable que nadie encontrará nunca es peor que inútil: cuesta dinero y no entrega nada.",
    ],
    audienceTitle: "Para quién es",
    audience:
      'Pequeños negocios y negocios locales que necesitan clientes, no paneles de control. Nunca debería tener que aprender qué significa "dificultad de palabra clave". Nosotros hacemos el criterio; usted ve un plan, los artículos y qué ha cambiado.',
  },
  successStories: {
    metaTitle: "Casos de éxito",
    metaDescription:
      "Lo que miden los clientes de RepGet: posiciones, visibilidad en IA, artículos publicados y enlaces conseguidos, y cómo llegan los primeros resultados.",
    eyebrow: "Casos de éxito",
    title:
      "Preferimos enseñarle lo que medimos antes que inventarnos un cliente.",
    intro:
      "RepGet es nuevo, y no vamos a inventarnos una empresa que lo haya usado ni a redondear las cifras de nadie para una página de ventas. Esto es lo que el producto mide de verdad, y cómo son los primeros meses, para que pueda juzgarlo con algo real.",
    results: [
      {
        label: "Posiciones y clics",
        body: "Tomados de su propio Search Console, no estimados. Ve en qué búsquedas ha subido y cuántos clics ha supuesto.",
      },
      {
        label: "Visibilidad en IA",
        body: "Si ChatGPT, Claude y Perplexity nombran su negocio cuando alguien pregunta por lo que usted vende. Comprobado con sus propias preguntas.",
      },
      {
        label: "Artículos publicados",
        body: "Qué se escribió, cuándo se publicó y qué resultado dio, para que el trabajo de un mes tenga una respuesta y no solo una factura.",
      },
      {
        label: "Enlaces conseguidos",
        body: "Enlaces reales dentro de artículos reales en webs de otros negocios, comprobados a diario. Si se elimina uno, avísenos y recupera su crédito.",
      },
    ],
    timelineTitle: "Cómo son los tres primeros meses",
    timelineIntro:
      "Con sinceridad, incluida la parte en la que aún no ha pasado nada.",
    timeline: [
      {
        when: "Semana uno",
        body: "Rastreamos la web, detectamos los problemas técnicos que la frenan y planificamos un mes de artículos según lo que sus clientes buscan de verdad.",
      },
      {
        when: "Semanas dos a cuatro",
        body: "Los artículos se publican según su calendario. Los enlaces empiezan a colocarse a medida que otros negocios de la red publican los suyos.",
      },
      {
        when: "A partir del segundo mes",
        body: "Llegan los datos de Search Console de los primeros artículos. Aquí es donde empiezan a moverse las posiciones: el SEO no da resultados en la primera semana, y quien prometa lo contrario le está vendiendo otra cosa.",
      },
    ],
    ctaTitle: "Sea el primer caso de esta página.",
    ctaBody:
      "Empiece con un análisis gratuito de su web: tarda un minuto y no cuesta nada. Si lo que encontramos merece la pena, las cuentas nuevas pueden probar RepGet gratis durante {days} días.",
    ctaPrimary: "Analizar mi web",
    ctaSecondary: "Ver precios",
  },
  publishers: {
    metaTitle: "Rentabilice su blog",
    metaDescription:
      "Publique un artículo al mes para un negocio afín y gane créditos que podrá gastar en enlaces hacia su propia web.",
    title: "Rentabilice su blog",
    intro:
      "Aloje un artículo al mes de un negocio de un sector relacionado y gane créditos para conseguir enlaces hacia su propia web.",
    creditsTitle: "Créditos, no dinero",
    creditsBody:
      "El pago es en créditos de enlace, no en dinero. Un artículo alojado da un crédito, y un crédito le consigue un enlace desde la web de otro negocio. Si busca cobrar por artículos patrocinados, esto no es eso, y existen mercados que sí lo hacen.",
    steps: [
      {
        title: "Díganos de qué trata su web",
        body: "Su tema, idioma y país. Solo le emparejamos con negocios de un sector relacionado.",
      },
      {
        title: "Elija cuántos artículos al mes",
        body: "Hasta veinte, aunque la mayoría empieza con tres. Puede pausar o salir cuando quiera.",
      },
      {
        title: "Escribimos el artículo",
        body: "Un artículo real sobre un tema que interesa a sus lectores, escrito para su web, con un enlace natural dentro.",
      },
      {
        title: "Usted gana un crédito",
        body: "Un crédito por artículo alojado, que puede gastar en un enlace hacia su web desde la de otro.",
      },
    ],
    controlTitle: "Lo que usted controla",
    rules: [
      {
        title: "Solo temas relacionados",
        body: "Nunca le pediremos alojar algo ajeno a su web. Si no podemos verificar que dos webs están relacionadas temáticamente, no hacemos el emparejamiento.",
      },
      {
        title: "Usted pone el límite",
        body: "Entre uno y veinte artículos al mes, modificable cuando quiera. Si lo pone a cero, dejará de recibir solicitudes.",
      },
      {
        title: "Usted mantiene el control editorial",
        body: "Los artículos llegan como borradores a su web. Publique, edite o rechace: nada se publica sin usted.",
      },
    ],
    suitsTitle: "Para quién es esto",
    suitsBody:
      "Para un pequeño negocio con un blog que ya publica de vez en cuando y quiere enlaces a sus páginas sin pagarlos. Si su web no tiene lectores, alojar artículos no lo cambiará: los enlaces que gane valen lo que valga su web.",
    joinNote:
      "Participar está incluido en todos los planes. Actívelo desde los ajustes de su web.",
    ctaPrimary: "Empezar",
    ctaSecondary: "Cómo funciona el intercambio",
  },
  affiliate: {
    metaTitle: "Recomiende un negocio",
    metaDescription:
      "Comparta su enlace y gane créditos cuando alguien a quien recomiende pague su primer mes.",
    title: "Recomiende un negocio y gane créditos",
    intro:
      "Comparta su enlace. Cuando alguien a quien recomiende pague su primer mes, los créditos llegan a su cuenta.",
    steps: [
      {
        title: "Comparta su enlace",
        body: "Cada cuenta tiene un enlace. Lo encontrará en Ajustes en cuanto se registre.",
      },
      {
        title: "Se registran y se suscriben",
        body: "No se debe nada mientras alguien solo está probando el producto. La recomendación cuenta cuando paga su primer mes.",
      },
      {
        title: "Usted recibe sus créditos",
        body: "Los créditos llegan automáticamente a su cuenta y se destinan a enlaces hacia su sitio web.",
      },
    ],
    termsTitle: "Las condiciones, sin rodeos",
    terms: [
      "La recompensa es crédito en la cuenta, no dinero. No se puede retirar.",
      "Una recomendación cuenta cuando la persona recomendada paga su primer mes.",
      "Solo se pueden recomendar cuentas nuevas, y cada una una sola vez.",
      "Los créditos se gastan en construcción de enlaces dentro del producto.",
    ],
    ctaPrimary: "Empezar",
    ctaNote:
      "Su enlace de recomendación está en Ajustes en cuanto tenga cuenta.",
  },
  backlinkExchange: {
    metaTitle: "Cómo funciona el intercambio de enlaces",
    metaDescription:
      "Consiga enlaces hacia su web publicando un artículo para otro negocio. Solo emparejamientos relevantes, verificados a diario y créditos devueltos cuando se confirma que un enlace ha desaparecido.",
    title: "Cómo funciona el intercambio de enlaces",
    intro:
      "Los enlaces se ganan dándolos. Usted aloja un artículo de un negocio de un sector relacionado y gasta lo que gana en enlaces hacia su propia web.",
    steps: [
      {
        title: "Usted aloja un artículo",
        body: "Escribimos un artículo para otro negocio de un sector relacionado y lo publicamos en su web. Es un artículo real sobre un tema que interesa a sus lectores, no una página de enlaces.",
      },
      {
        title: "Usted gana un crédito",
        body: "Alojar un artículo da un crédito. Su plan también incluye créditos cada mes, así que puede empezar antes de haber alojado nada.",
      },
      {
        title: "Lo gasta en un enlace",
        body: "Un crédito compra un enlace hacia su web, escrito con naturalidad dentro de un artículo en la web de otro negocio relacionado.",
      },
    ],
    rulesTitle: "Las reglas que hacen que valga la pena",
    rules: [
      {
        title: "Solo temas relacionados",
        body: "Un dentista nunca se empareja con un blog de criptomonedas. Si no podemos verificar que dos webs están relacionadas temáticamente, no hacemos el emparejamiento: un enlace irrelevante no vale nada y puede hacer daño.",
      },
      {
        title: "Comprobados a diario",
        body: "Revisamos cada enlace todos los días. Los enlaces no desaparecen en silencio sin que usted se entere.",
      },
      {
        title: "Créditos devueltos si un enlace cae",
        body: "Si se elimina un enlace, avísenos: cuando confirmemos que ha desaparecido, recupera el crédito y desaparece de su panel. Una web que solo está sin conexión un tiempo, por mantenimiento por ejemplo, conserva sus enlaces.",
      },
    ],
    notTitle: "Lo que esto no es",
    notBody:
      "Esto no es una red privada de blogs. Cada enlace está dentro de un artículo real en la web de un negocio real, publicado porque ese negocio quería un artículo.",
    ctaTitle: "Todos los planes incluyen créditos",
    ctaBody: "Puede pedir sus primeros enlaces antes de alojar nada.",
    ctaPrimary: "Empezar",
    ctaSecondary: "Prefiero alojar artículos",
  },
  faq: {
    metaTitle: "Preguntas frecuentes",
    metaDescription:
      "Preguntas habituales sobre cómo funciona RepGet.",
    title: "Preguntas frecuentes",
    subtitle: "Respuestas claras, incluidos los límites.",
    items: [
      {
        question: "¿Necesito saber algo de SEO?",
        answer:
          "No. Ese es justamente el sentido del servicio. Averiguamos qué búsquedas usan sus clientes, escribimos las páginas que las responden y le contamos en lenguaje claro qué ha cambiado. Nunca necesitará aprender qué es una etiqueta canónica.",
      },
      {
        question: "¿Cuánto tardaré en ver resultados?",
        answer:
          "Normalmente entre dos y cuatro meses antes de que las páginas nuevas empiecen a traer visitantes, y más en sectores competidos. Quien le prometa resultados en semanas no está siendo sincero. Los buscadores tardan en encontrar, confiar y posicionar páginas nuevas.",
      },
      {
        question: "¿Garantizan que saldré primero en Google?",
        answer:
          "No, y nadie más puede hacerlo. Google decide qué posiciona y cambia su funcionamiento constantemente. Lo que hacemos es encontrar las búsquedas que puede ganar de forma realista, escribir bien las páginas y mostrarle con honestidad qué ha pasado.",
      },
      {
        question: "¿Los artículos parecerán escritos por un robot?",
        answer:
          "Los escribe una IA, así que conviene leerlos antes de publicarlos; para eso le damos un editor. Están escritos para su negocio, en su idioma y su mercado, y puede definir el tono que quiera.",
      },
      {
        question: "¿Los artículos se publican solos en mi web?",
        answer:
          "Solo si conecta su web y elige publicar. Admitimos WordPress, Ghost y Shopify, además de un webhook para cualquier otra cosa. Si no, quedan como borradores para que los revise, edite o copie donde quiera.",
      },
      {
        question: "¿Qué son los créditos de enlaces?",
        answer:
          "Google confía más en una web cuando otras webs la enlazan. Cuando uno de sus artículos menciona el negocio de otro miembro, usted gana un crédito. Al gastar un crédito, el artículo de otro miembro distinto le enlaza a usted. Nunca enlaza a quien le enlazó, así que los enlaces resultan naturales.",
      },
      {
        question: "¿Por qué proponen búsquedas más pequeñas?",
        answer:
          "Porque puede ganarlas. Un término buscado 12.000 veces al mes para el que no tiene ninguna posibilidad vale menos que uno buscado 300 veces que le trae clientes el mes que viene.",
      },
      {
        question: "¿Puedo cancelar cuando quiera?",
        answer:
          "Sí, desde la página de facturación y sin penalización. Su acceso continúa hasta el final del periodo que ya ha pagado.",
      },
      {
        question: "¿Qué pasa con mis artículos si me voy?",
        answer:
          "Todo lo ya publicado se queda en su web: es su contenido. Los artículos que escribimos para usted son suyos.",
      },
    ],
  },
  contact: {
    metaTitle: "Contacto",
    metaDescription: "Cómo ponerse en contacto con RepGet.",
    title: "Contacto",
    subtitle:
      "Preguntas sobre el producto, su cuenta o la facturación: leemos todos los mensajes y respondemos en un plazo de dos días laborables.",
    emailLabel: "Correo electrónico",
    accountNote:
      "Si escribe sobre su cuenta, hágalo desde la dirección con la que se registró.",
  },
  notFound: {
    metaTitle: "Página no encontrada",
    eyebrow: "Error 404",
    title: "No encontramos esa página",
    body: "Puede que la dirección esté mal escrita, o que la página se haya movido o ya no exista.",
    home: "Ir a la página de inicio",
    elsewhere: "O pruebe una de estas:",
  },
  legalNotice: "Esta página solo está disponible en inglés. Las traducciones de nuestros términos legales las prepara un traductor profesional antes de su publicación.",

  app: {
    workspace: {
      save: "Guardar",
      saving: "Guardando…",
      saved: "Guardado",
      discard: "Descartar cambios",
      unsaved: "1 cambio sin guardar|{count} cambios sin guardar",
      noChanges: "Todos los cambios están guardados",
      saveFailed: "No se ha guardado. {error}",
      leaveConfirm: "Tiene cambios sin guardar. ¿Salir de esta página y perderlos?",
      onThisPage: "En esta página",
      jumpTo: "Ir a una sección",
      optional: "Opcional",
      required: "Obligatorio",
      charactersLeft: "Queda 1 carácter|Quedan {count} caracteres",
      overLimit: "1 carácter por encima del límite|{count} caracteres por encima del límite",
      viewOnly: "Tiene acceso de solo lectura a este sitio web. Solo un propietario o un editor puede hacer cambios.",
      savesImmediately: "Se guarda en cuanto lo cambia",
      savedWithButton: "Se guarda con el botón Guardar",
      editsKept: "Sus cambios más recientes se conservan y aún deben guardarse.",
      preview: "Vista previa",
      close: "Cerrar",
      selected: "Seleccionado",
    },
    health: {
      title: "Salud del sitio",
      description: "Una revisión técnica de las páginas que podemos leer en {domain}: qué puede frenarlas en los resultados de búsqueda y cómo solucionarlo.",
      checkNow: "Revisar mi sitio web",
      checkAgain: "Volver a revisar",
      checking: "Revisando…",
      starting: "Iniciando…",
      refreshStatus: "Actualizar estado",
      dismiss: "Cerrar",
      unavailableTitle: "No se pueden iniciar revisiones nuevas",
      siteNotReady: "Todavía estamos analizando este sitio web. Podrá iniciar una revisión cuando termine.",
      errNoPlan: "Primero elija un plan para este sitio web.",
      errPlanInactive: "La suscripción de este sitio web no está activa. Actualice la facturación para iniciar una revisión.",
      errQuota: "Ha iniciado esta revisión varias veces en la última hora. Inténtelo de nuevo en unos minutos.",
      errUnexpected: "No se ha podido iniciar la revisión. Inténtelo de nuevo.",
      queuedTitle: "Revisión solicitada",
      queuedBody: "Su revisión está a la espera de empezar. Esta página se actualiza sola.",
      queuedStale: "Esta revisión aún no ha empezado y está tardando más de lo habitual. El informe aparecerá aquí cuando se haya realizado.",
      requestedAt: "Solicitada: {date}",
      runningTitle: "Revisando su sitio web",
      runningBody: "Estamos leyendo sus páginas una a una. Esta página se actualiza sola.",
      runningStale: "Esta revisión lleva más tiempo del previsto y puede haberse detenido.",
      staleRetry: "Actualice el estado para ver si ha avanzado, o vuelva a iniciar la revisión.",
      startedAt: "Iniciada: {date}",
      progressChecked: "1 página revisada hasta ahora|{count} páginas revisadas hasta ahora",
      progressFound: "1 dirección encontrada en su sitio|{count} direcciones encontradas en su sitio",
      progressLimit: "Cada revisión lee hasta {max} páginas.",
      previousNotice: "El informe de abajo es su resultado anterior, del {date}. Se sustituirá cuando termine la nueva revisión.",
      failedTitle: "No se ha podido completar la última revisión",
      failedPrevious: "El informe de abajo sigue siendo su resultado anterior, del {date}.",
      finishedTitle: "Su nuevo informe está listo",
      finishedBody: "El informe de abajo corresponde a la revisión del {date}.",
      failure: {
        timeout: "Su sitio web ha tardado demasiado en responder. Inténtelo de nuevo: suele ser algo temporal en un servidor con mucha carga.",
        notHtml: "La dirección del sitio web no ha devuelto una página web. Compruebe que apunta a la página de inicio de su sitio.",
        tooLarge: "Su página de inicio es demasiado grande para que podamos analizarla.",
        invalidUrl: "No se ha podido leer la dirección del sitio web. Compruebe la dirección, incluido http:// o https://.",
        refused: "Su sitio web ha rechazado nuestra solicitud. Puede que un cortafuegos o un plugin de seguridad bloquee a los visitantes automáticos.",
        unreachable: "No hemos podido acceder a su sitio web. Compruebe que está en línea y que la dirección es correcta.",
        notEntitled: "La revisión se ha detenido porque la suscripción de este sitio web no está activa. No se ha cobrado nada más.",
        generic: "No hemos podido terminar de revisar su sitio web. Inténtelo de nuevo y, si vuelve a ocurrir, contacte con soporte.",
      },
      failureViewer: {
        timeout: "Su sitio web ha tardado demasiado en responder. Suele ser algo temporal en un servidor con mucha carga. Un propietario o un editor puede volver a iniciar la revisión.",
        generic: "No hemos podido terminar de revisar su sitio web. Un propietario o un editor puede volver a iniciar la revisión.",
      },
      emptyTitle: "Todavía no hay ningún informe",
      emptyBody: "Una revisión lee hasta {max} páginas de su sitio y enumera, página por página, qué puede frenarlo en las búsquedas y cómo solucionar cada problema.",
      emptyViewer: "Todavía no se ha hecho ninguna revisión. Un propietario o un editor puede iniciarla.",
      firstRunTitle: "Su primer informe está en camino",
      firstRunBody: "Aparecerá aquí en cuanto termine la revisión.",
      scoreTitle: "Puntuación de salud",
      scoreDescription: "Cuenta los problemas técnicos de las páginas que leímos, ponderados según su gravedad y promediados por página.",
      previousResult: "Resultado anterior",
      latestResult: "Último resultado",
      outOf: "de 100",
      scoreAria: "Puntuación de salud: {score} de 100",
      bandGood: "Buena",
      bandFair: "Mejorable",
      bandPoor: "Baja",
      noScore: "Sin puntuación",
      noScoreBody: "No se registró ninguna puntuación para esta revisión.",
      notScored: "Sin puntuar",
      zeroPagesTitle: "No se ha podido leer ninguna página",
      zeroPagesBody: "En esta revisión no pudimos abrir ninguna página, así que su puntuación no describe su sitio. Los hallazgos de abajo explican por qué.",
      notAuthority: "Esto no es la Autoridad de dominio: mide problemas técnicos de sus propias páginas, no cuánto confían otros sitios en el suyo.",
      lastChecked: "Última revisión",
      pagesRead: "Páginas leídas",
      pagesFailed: "No se pudieron abrir",
      addressesFound: "Direcciones encontradas",
      notRecorded: "No registrado",
      severityTitle: "Problemas según su gravedad",
      critical: "Críticos",
      warnings: "Advertencias",
      suggestions: "Sugerencias",
      inFindings: "en 1 hallazgo|en {count} hallazgos",
      severityAria: "Críticos: {critical}, advertencias: {warning}, sugerencias: {info}",
      badge: { critical: "Crítico", warning: "Advertencia", info: "Sugerencia" },
      coverageTitle: "Qué ha cubierto esta revisión",
      coverageLimit: "Lee hasta {max} páginas, empezando por su página de inicio y siguiendo enlaces.",
      coverageSameSite: "Solo sigue enlaces dentro de {domain}. Los enlaces a otros sitios no se revisan.",
      coverageQuery: "Las direcciones que solo se diferencian después de «?» o «#» cuentan como una sola página.",
      coverageSkipped: "Omite las páginas de administración, inicio de sesión, carrito y pago, los feeds y los archivos como imágenes y PDF.",
      coverageRefused: "Una página que no responde en 15 segundos, o que rechaza a los visitantes automáticos, aparece como «no se pudo abrir».",
      coverageBeyond: "Esta revisión encontró {found} direcciones en su sitio y leyó {read} páginas. El resto no se revisó.",
      notAssessedTitle: "Algunas comprobaciones no se pudieron hacer",
      notAssessedBody: "Estas comprobaciones comparan páginas entre sí y necesitan al menos dos páginas legibles: {checks}. No forman parte de esta puntuación.",
      crossChecks: {
        duplicateTitles: "títulos de página duplicados",
        duplicateDescriptions: "descripciones duplicadas",
        internalLinking: "enlaces internos",
      },
      findingsTitle: "Hallazgos",
      findingsDescription: "Primero los más graves. Abra un hallazgo para ver todas las páginas afectadas y cómo solucionarlo.",
      findingsCount: "1 hallazgo|{count} hallazgos",
      filterLabel: "Filtrar por gravedad",
      filterAll: "Todos",
      searchLabel: "Buscar hallazgos",
      searchPlaceholder: "Buscar por problema o dirección de página",
      showingFiltered: "Hallazgos mostrados: {shown} de {total}.",
      clearFilters: "Quitar filtros",
      noMatchTitle: "Ningún hallazgo coincide",
      noMatchBody: "Pruebe otra búsqueda o muestre todos los hallazgos.",
      noFindingsTitle: "No se han encontrado problemas",
      noFindingsBody: "No encontramos nada que corregir en la página que leímos.|No encontramos nada que corregir en las {count} páginas que leímos.",
      pagesCount: "1 página|{count} páginas",
      howToFix: "Cómo solucionarlo",
      effortMinutes: "Suele llevar unos minutos",
      effortHour: "Suele llevar alrededor de una hora",
      effortLonger: "Puede llevar más tiempo",
      needsDeveloper: "Puede necesitar a su desarrollador web",
      affectedPages: "Páginas afectadas ({count})",
      homepage: "página de inicio",
      opensInNewTab: "(se abre en una pestaña nueva)",
      showAllPages: "Mostrar las {count} páginas",
      showFewerPages: "Mostrar menos páginas",
      matchingPages: "Páginas que coinciden con su búsqueda: {shown} de {total}.",
      notLoaded: "Se muestran {shown} de {total}. El resto no se ha cargado para que esta página sea rápida.",
      groupNote: "Cada entrada es un grupo de páginas; se muestra la primera página de cada grupo.",
      firstPageNote: "Se muestra la primera página encontrada; el detalle indica el total.",
      noUrl: "No se registró la dirección de la página",
      rowsCapped: "Esta revisión registró {total} problemas. Abajo se muestran los primeros {shown}; los recuentos de arriba los incluyen todos.",
      detail: {
        titleLong: "El título tiene {chars} caracteres; los resultados de búsqueda lo cortan a partir de unos {max}.",
        titleShort: "El título solo tiene {chars} caracteres.",
        descriptionLong: "La descripción tiene {chars} caracteres; los resultados de búsqueda la cortan a partir de unos {max}.",
        descriptionShort: "La descripción solo tiene {chars} caracteres.",
        multipleH1: "{count} encabezados principales (H1) en esta página.",
        thinContent: "Solo {words} palabras en esta página.",
        imagesAlt: "{missing} de {total} imágenes no tienen descripción (texto alternativo).",
        largePage: "Solo el HTML de la página ocupa {kb} KB.",
        httpStatus: "La página respondió con el error {status}.",
        duplicateTitle: "{count} páginas comparten el título «{title}».",
        duplicateDescription: "{count} páginas comparten la misma descripción.",
        noInternalLinks: "1 página no enlaza a ninguna otra página de su sitio.|{count} páginas no enlazan a ninguna otra página de su sitio.",
        unreachTimeout: "No respondió a tiempo.",
        unreachBlocked: "Rechaza a los visitantes automáticos (un ajuste de seguridad del sitio).",
        unreachPassword: "Pide una contraseña.",
        unreachStatus: "Respondió con el error {status}.",
        unreachNotHtml: "No es una página web.",
        unreachRedirects: "Redirige demasiadas veces.",
        unreachRedirectAway: "Redirige a una dirección que no revisamos.",
        unreachConnect: "No pudimos conectar con ella.",
        unreachUnknown: "Un error inesperado nos impidió abrirla.",
      },
      issues: {
        noindex: {
          label: "Oculta para los buscadores",
          about: "La página pide a los buscadores que no la incluyan en sus resultados, así que no se puede encontrar en las búsquedas.",
          fix: "Salvo que la oculte a propósito, quite su ajuste «noindex». En WordPress suele ser una opción de su plugin de SEO o la casilla «Disuadir a los motores de búsqueda» en Ajustes › Lectura.",
        },
        broken_page: {
          label: "La página muestra un error",
          about: "La página responde con un error en lugar de cargarse.",
          fix: "Corrija la página o, si ya no debe existir, rediríjala a la página más parecida que exista, para no perder visitantes ni enlaces.",
        },
        unreachable_page: {
          label: "No se pudo abrir la página",
          about: "Intentamos cargar esta página y no pudimos. Puede que los buscadores tengan el mismo problema.",
          fix: "Abra la página en su propio navegador. Si ya no existe, actualice los enlaces que apuntan a ella o rediríjala. Si a usted se le abre, puede que su alojamiento o un ajuste de seguridad rechace a los visitantes automáticos, lo que también puede dejar fuera a los buscadores.",
        },
        missing_title: {
          label: "La página no tiene título",
          about: "La página no tiene etiqueta de título, el titular que se muestra en los resultados de búsqueda.",
          fix: "Dé a la página un título que diga de qué trata. Es el titular que la gente ve en los resultados de búsqueda, así que escríbalo para las personas en lugar de llenarlo de palabras clave.",
        },
        title_too_long: {
          label: "El título es demasiado largo",
          about: "Los resultados de búsqueda cortan los títulos de más de unos 60 caracteres.",
          fix: "Acorte el título para que no se corte la parte importante. Ponga primero lo que importa: lo que se recorta es el final.",
        },
        title_too_short: {
          label: "El título es muy corto",
          about: "Los títulos de menos de 30 caracteres a menudo no dicen lo suficiente sobre la página.",
          fix: "Añada detalle al título para que, desde los resultados de búsqueda, se vea que esta página es lo que buscan.",
        },
        missing_meta_description: {
          label: "Sin descripción para los resultados de búsqueda",
          about: "La página no tiene descripción, así que los buscadores eligen su propio texto para mostrar bajo su enlace.",
          fix: "Escriba una descripción de la página de una o dos frases. Sin ella, los buscadores toman un texto de la página, y a menudo no es el mejor.",
        },
        meta_description_too_long: {
          label: "La descripción es demasiado larga",
          about: "Los resultados de búsqueda cortan las descripciones de más de unos 158 caracteres.",
          fix: "Acorte la descripción y diga pronto por qué merece la pena hacer clic.",
        },
        meta_description_too_short: {
          label: "La descripción es muy corta",
          about: "Las descripciones de menos de 70 caracteres desaprovechan espacio en los resultados de búsqueda.",
          fix: "Amplíe la descripción a una o dos frases que den a la gente un motivo para elegir su resultado.",
        },
        missing_h1: {
          label: "Sin encabezado principal",
          about: "La página no tiene encabezado principal (H1), así que su tema queda menos claro para lectores y buscadores.",
          fix: "Añada un encabezado principal cerca del inicio de la página que diga de qué trata.",
        },
        multiple_h1: {
          label: "Más de un encabezado principal",
          about: "La página tiene varios encabezados principales (H1), así que no queda claro cuál la describe.",
          fix: "Deje un solo encabezado principal y convierta los demás en subtítulos.",
        },
        thin_content: {
          label: "Poco texto",
          about: "La página tiene menos de 300 palabras, contando menús y pies de página. Las páginas tan cortas rara vez se posicionan en búsquedas competidas.",
          fix: "Amplíe la página para que responda por completo a lo que buscan los visitantes, o intégrela en una página más completa y redirija esta.",
        },
        images_missing_alt: {
          label: "Imágenes sin descripción",
          about: "Algunas imágenes no tienen texto alternativo, que leen los lectores de pantalla y que usa la búsqueda de imágenes.",
          fix: "Añada a cada imagen una breve descripción de lo que muestra. Las imágenes puramente decorativas pueden tener una descripción vacía.",
        },
        missing_canonical: {
          label: "Sin dirección preferida",
          about: "La página no indica su dirección preferida (enlace canónico). Si se puede acceder a ella desde varias direcciones, los buscadores tienen que adivinar cuál mostrar.",
          fix: "Añada un enlace canónico a la página. La mayoría de los plugins de SEO lo añaden automáticamente al activarlos; si no, consulte a su desarrollador web.",
        },
        missing_lang: {
          label: "Idioma de la página sin indicar",
          about: "La página no indica en qué idioma está escrita.",
          fix: "Indique el idioma de la página (el atributo «lang» de la etiqueta html). Ayuda a los buscadores a mostrar sus páginas a las personas adecuadas y a los lectores de pantalla a pronunciarlas bien.",
        },
        large_page: {
          label: "El código de la página es muy grande",
          about: "Solo el HTML de la página supera 1,5 MB, lo que ralentiza la carga. Las imágenes no se cuentan aquí.",
          fix: "Un HTML grande suele deberse a código, datos o imágenes incrustados en la propia página. Pida a su desarrollador web que los pase a archivos separados o los reduzca.",
        },
        duplicate_title: {
          label: "Páginas con el mismo título",
          about: "Varias páginas usan el mismo título, así que a los buscadores les cuesta distinguirlas.",
          fix: "Dé a cada página un título que describa lo que solo esa página trata.",
        },
        duplicate_meta_description: {
          label: "Páginas con la misma descripción",
          about: "Varias páginas usan la misma descripción en los resultados de búsqueda.",
          fix: "Escriba una descripción distinta para cada página que diga lo que ofrece esa página.",
        },
        no_internal_links: {
          label: "Páginas que no enlazan a ninguna otra",
          about: "Algunas páginas no tienen enlaces a otras páginas de su sitio, así que visitantes y buscadores no pueden seguir desde ellas.",
          fix: "Añada enlaces desde estas páginas a otras relacionadas de su sitio, como un servicio, un artículo o su página de inicio.",
        },
      },
      siteTitle: "Su sitio tal como lo leímos",
      siteDescription: "Leído de su página de inicio durante esta revisión.",
      siteLegacy: "Esta revisión se registró antes de que empezáramos a recoger los datos del sitio. Aparecerán tras la próxima revisión.",
      siteUnavailable: "En esta revisión no se pudo leer ninguna página, así que estos datos no están disponibles.",
      siteName: "Nombre del sitio",
      siteNameMissing: "No encontrado",
      language: "Idioma",
      languageMissing: "No indicado",
      languageNote: "Según indica su página de inicio.",
      languageMissingNote: "Su página de inicio no indica en qué idioma está, así que los buscadores tienen que adivinarlo.",
      platform: "Plataforma",
      platformUnknown: "No reconocida",
      platformNote: "Detectada a partir del código de su página.",
      platformUnknownNote: "No reconocimos ninguna plataforma común. Eso no es un problema en sí.",
      previewImage: "Imagen de vista previa del enlace",
      previewMissing: "Ninguna",
      previewNote: "Se muestra cuando se comparte su página de inicio.",
      previewMissingNote: "No se encontró ninguna imagen de vista previa (og:image), así que los enlaces compartidos pueden aparecer sin imagen.",
      previewBroken: "No se pudo cargar la imagen de vista previa.",
      linkedTitle: "Sitios a los que más enlaza",
      linkedHelp: "Hasta seis, contados en las páginas que leímos. Sirve para detectar enlaces que no quería dar.",
      linkedEmpty: "No encontramos enlaces a otros sitios en las páginas que leímos.",
      aiTitle: "Acceso de los asistentes de IA",
      aiDescription: "Si su archivo robots.txt bloquea los rastreadores que usan los asistentes de IA para leer sitios web.",
      aiLegacy: "Esta revisión se registró antes de que empezáramos a leer robots.txt. Aparecerá tras la próxima revisión.",
      aiUnreadable: "En esta revisión no se pudo leer ninguna página, así que lo más probable es que tampoco se pudiera leer robots.txt. Aquí, «No bloqueado» puede significar solo que no pudimos leerlo.",
      aiNoneBlocked: "Ninguno de estos {total} rastreadores está bloqueado en todo su sitio.",
      aiSomeBlocked: "1 de {total} rastreadores está bloqueado en todo su sitio.|{count} de {total} rastreadores están bloqueados en todo su sitio.",
      aiAllowed: "No bloqueado",
      aiBlocked: "Bloqueado",
      aiNamed: "Mencionado en robots.txt",
      aiCaveat: "Solo comprobamos si robots.txt bloquea todo el sitio. Si no hay robots.txt, o no pudimos leerlo, el rastreador cuenta como no bloqueado. No se comprueban cortafuegos ni reglas para páginas concretas.",
      aiNoGuarantee: "Que su sitio se pueda leer no significa que un asistente de IA vaya a mencionarlo o citarlo.",
      aiBlockedHelp: "Para dejar pasar a un rastreador, quite de robots.txt la regla «Disallow: /» que se le aplica, o pida a quien gestiona su sitio que lo haga.",
      aiVisibilityLink: "Vea si los asistentes de IA le mencionan",
      fixTitle: "¿Quiere que se lo arreglemos?",
      fixSelf: "La mayoría son cambios de texto que puede hacer usted mismo con las indicaciones de arriba. Si lo prefiere, envíenos la lista y le daremos un presupuesto.",
      fixDeveloper: "1 de estos hallazgos suele necesitar a quien creó su sitio. Envíenos la lista: lo revisaremos todo y le daremos un presupuesto para solucionarlo.|{count} de estos hallazgos suelen necesitar a quien creó su sitio. Envíenos la lista: lo revisaremos todo y le daremos un presupuesto para solucionarlo.",
      fixHow: "Abre su aplicación de correo con la lista ya escrita. No se envía nada hasta que usted lo envíe, y no se cobra nada.",
      fixUnavailable: "Ahora mismo no se pueden solicitar presupuestos por correo.",
      requestQuote: "Solicitar presupuesto",
      mailSubject: "Solicitud de corrección para {domain}",
      mailGreeting: "Hola:",
      mailAsk: "Les pido un presupuesto para corregir los problemas encontrados en {domain}.",
      mailCheckedOn: "Revisión del {date}.",
      mailCounts: "1 problema encontrado; críticos: {critical}.|{count} problemas encontrados; críticos: {critical}.",
      mailListTitle: "Hallazgos:",
      mailLine: "- {label}: {pages}",
      mailThanks: "Gracias.",
    },
    settings: {
      personalTitle: "Datos personales",
      personalSubtitle: "Su nombre y la dirección de correo electrónico con la que inicia sesión.",
      nameLabel: "Nombre",
      namePlaceholder: "Su nombre",
      save: "Guardar",
      saving: "Guardando…",
      cancel: "Cancelar",
      nameSaved: "Nombre actualizado",
      nameError: "No se pudo guardar su nombre",
      emailLabel: "Correo electrónico",
      changePassword: "Cambiar contraseña",
      setPassword: "Establecer una contraseña",
      setPasswordIntro:
        "Usted inicia sesión con Google. Establezca una contraseña para entrar también con su correo: Google seguirá funcionando.",
      setPasswordHelp: "Al menos 8 caracteres.",
      settingPassword: "Estableciendo…",
      passwordCreated:
        "Contraseña establecida. Ya puede iniciar sesión con su correo y su contraseña.",
      languageLabel: "Idioma del panel",
      languageHelp: "Menús, botones y mensajes de este panel. Cambiarlo no cambia sus artículos.",
      languageError: "No se pudo guardar su idioma",
      currentPassword: "Contraseña actual",
      newPassword: "Nueva contraseña",
      updatePassword: "Actualizar contraseña",
      passwordSaved: "Contraseña cambiada. Se ha cerrado la sesión en los demás dispositivos.",
      passwordTooShort: "Use al menos 8 caracteres",
      passwordError: "No se pudo cambiar su contraseña",
      passwordHelp: "Al menos 8 caracteres. Se cerrará la sesión en los demás dispositivos.",
      changing: "Cambiando…",
      saveName: "Guardar nombre",
      membersTitle: "Miembros y funciones",
      membersSubtitle: "El acceso se concede a un sitio web a la vez. Quien reciba una invitación aquí no verá sus otros sitios ni su facturación.",
      addMember: "Añadir miembro",
      addMemberHelp: "Introduzca su correo electrónico. Si todavía no tiene una cuenta de RepGet, le enviaremos una invitación.",
      memberColumn: "Miembro",
      roleColumn: "Función",
      statusColumn: "Estado",
      statusPending: "Invitado",
      invitationExpiresOn: "caduca el {date}",
      statusExpired: "Caducada",
      resendInvite: "Reenviar invitación",
      cancelInvite: "Cancelar invitación",
      inviteSent: "Invitación enviada",
      inviteResent: "Invitación reenviada",
      inviteCancelled: "Invitación cancelada",
      actionsColumn: "Acciones",
      active: "Activo",
      removeAccess: "Retirar acceso",
      websiteLabel: "Sitio web",
      emailPlaceholder: "editor@example.com",
      roleHelp: "Un editor puede escribir, editar y publicar artículos. Un lector solo puede consultar.",
      invite: "Invitar",
      nobodyElse: "Todavía no hay nadie más. Invite a un colega o a un editor externo a trabajar en este sitio web.",
      loadingPeople: "Cargando personas",
      roleEditor: "Editor",
      roleViewer: "Lector",
      pageTitle: "Cuenta",
      pageDescription: "Sus datos personales, cómo inicia sesión, su idioma, quién trabaja en sus sitios web y su enlace de recomendación.",
      emailHelp: "Inicia sesión con esta dirección y los recibos se envían a ella. No se puede cambiar aquí.",
      nameRequired: "Introduzca su nombre.",
      securityTitle: "Inicio de sesión y seguridad",
      securitySubtitle: "Las formas en que puede iniciar sesión en su cuenta.",
      methodPassword: "Correo electrónico y contraseña",
      methodGoogle: "Google",
      methodSet: "Configurada",
      methodNotSet: "Sin configurar",
      methodLinked: "Vinculada",
      passwordSetSummary: "Puede iniciar sesión con su dirección de correo y su contraseña.",
      passwordNotSetSummary: "Esta cuenta aún no tiene contraseña.",
      googleLinkedSummary: "Puede iniciar sesión con la cuenta de Google de esta dirección.",
      setPasswordIntroGeneric: "Establezca una contraseña para iniciar sesión con su dirección de correo y una contraseña.",
      currentPasswordWrong: "Su contraseña actual no es correcta.",
      passwordTooLong: "Use como máximo 128 caracteres",
      tooManyAttempts: "Demasiados intentos. Espere un minuto y vuelva a intentarlo.",
      passwordAlreadySet: "Esta cuenta ya tiene contraseña. Introduzca su contraseña actual para cambiarla.",
      languageTitle: "Idioma",
      languageSubtitle: "El panel y sus artículos tienen cada uno su propio idioma.",
      languageSaved: "Idioma del panel guardado.",
      articleLanguageLabel: "Idioma de los artículos",
      articleLanguageHelp: "Los artículos de cada sitio web se escriben en el idioma configurado en su pestaña Negocio.",
      articleLanguageLink: "Abrir la pestaña Negocio de {domain}",
      roleAdmin: "Administrador",
      roleEditorHelp: "Escribe, edita y publica artículos.",
      roleViewerHelp: "Puede consultarlo todo, pero no cambiar nada.",
      inviteTo: "Tendrá acceso solo a {domain}.",
      reinviteHelp: "Invitar a alguien que ya tiene acceso cambia su función.",
      invalidEmail: "Introduzca una dirección de correo electrónico válida.",
      inviteSelf: "Ya tiene acceso a este sitio web.",
      inviteFailed: "No se pudo enviar la invitación. Inténtelo de nuevo.",
      actionFailed: "No ha funcionado. Inténtelo de nuevo.",
      accessGranted: "{email} ya puede trabajar en {domain}",
      accessGrantedNoEmail: "{email} ya puede trabajar en {domain}, pero no hemos podido enviarle un correo.",
      accessRemoved: "{email} ya no tiene acceso",
      loadPeopleFailed: "No se pudo cargar quién trabaja en este sitio web.",
      retry: "Reintentar",
      thisWebsite: "este sitio web",
      workspaceAccess: "{email} tiene acceso a través de su espacio de trabajo",
      manageMember: "Gestionar a {email}",
      manageInvitation: "Gestionar la invitación de {email}",
      membersCaption: "Personas que pueden trabajar en {domain}",
      removeConfirmTitle: "¿Retirar el acceso de {email}?",
      removeConfirmBody: "Ya no podrá abrir {domain}. Puede volver a invitarle más adelante.",
      keepAccess: "Mantener el acceso",
      cancelInviteConfirmTitle: "¿Cancelar la invitación de {email}?",
      cancelInviteConfirmBody: "El enlace que enviamos por correo dejará de funcionar. Puede volver a invitarle más adelante.",
      keepInvitation: "Mantener la invitación",
      removing: "Retirando…",
      cancellingInvite: "Cancelando…",
      inviting: "Enviando…",
      viewingSharedNote: "Está viendo {domain}, que se ha compartido con usted. Solo su propietario puede cambiar quién trabaja en él. La lista siguiente es para sus propios sitios web.",
      guestTeamNote: "{domain} se ha compartido con usted como {role}. Solo su propietario puede invitar o retirar personas.",
    },
    websites: {
      title: "Sitios web",
      connected: "1 sitio web. Cada uno se factura con su propio plan.|{count} sitios web. Cada uno se factura con su propio plan.",
      addWebsite: "Añadir sitio web",
      emptyTitle: "Todavía no hay sitios web",
      emptyBody:
        "Añada su sitio web y lo leeremos, averiguaremos a qué se dedica su negocio y encontraremos los términos de búsqueda que merecen la pena.",
      addFirst: "Añada su primer sitio web",
      tryAgain: "Reintentar",
      removeLabel: "Eliminar {domain}",
      removed: "{domain} eliminado",
      retrying: "Reintentando",
      dialogTitle: "Añadir un sitio web",
      dialogBody:
        "Introduzca la dirección del sitio que quiere que aparezca en Google. Lo leeremos y rellenaremos los datos por usted.",
      urlLabel: "Dirección del sitio web",
      urlPlaceholder: "ejemplo.com",
      cancel: "Cancelar",
      adding: "Añadiendo…",
      sharedTitle: "Compartidos con usted",
      sharedHelp: "Sitios web a los que otras personas le han dado acceso.",
    },
    billing: {
      title: "Facturación",
      subtitle: "Cada sitio web tiene su propio plan. Los créditos se comparten entre todos.",
      yourWebsites: "Sus sitios web",
      yourWebsitesHelp: "Un sitio web sin plan no puede generar ni publicar artículos.",
      noPlanYet: "Todavía sin plan",
      planRenews: "{plan} - se renueva el {date}",
      planEnds: "{plan} - finaliza el {date}",
      currentPlan: "Plan actual",
      accessEnds: "El acceso finaliza",
      nextInvoice: "Próxima factura",
      onPlan: "Tiene el plan {plan}.",
      noSubscription: "Todavía no hay suscripción activa. Elija un plan para empezar.",
      accessEndsOn: "El acceso finaliza el {date}.",
      renewsOn: "Se renueva el {date}.",
      monthly: "Mensual",
      annual: "Anual",
      status: "Estado",
      tryItFirst: "Pruébelo primero",
      paypalReceipts: "Sus recibos y la cancelación están en su cuenta de PayPal.",
      promoCodes: "Los códigos promocionales se introducen al pagar con tarjeta. PayPal no los admite.",
      unlimited: "Ilimitado",
      articlesEachMonth: "{n} artículo escrito al mes|{n} artículos escritos al mes",
      searchTermsTracked: "{n} término de búsqueda monitorizado|{n} términos de búsqueda monitorizados",
      oneWebsite: "Un sitio web por suscripción",
      creditsEachMonth: "{n} crédito de enlace al mes|{n} créditos de enlace al mes",
      paymentReceived: "Pago recibido - confirmando su suscripción…",
      checkoutCancelled: "Pago cancelado.",
      purchaseReceived: "Pago recibido - su compra aparecerá en breve.",
      purchaseCancelled: "Compra cancelada.",
      addWebsiteFirst: "Añada primero un sitio web - cada plan paga un solo sitio.",
      checkoutFailed: "No se pudo iniciar el pago. Inténtelo de nuevo.",
      planFor: "Plan de {domain}",
      choosePlan: "Elija un plan",
      choosePlanFor: "Elija un plan para {domain}",
      choosePlanHelp: "Un plan paga un solo sitio web.",
      billingPeriod: "Periodo de facturación",
      perMonth: "/ mes",
      perYear: "/ año",
      saveBadge: "Ahorre un {n} %",
      switchPlan: "Cambiar a este plan",
      payByCard: "Pagar con tarjeta",
      redirecting: "Redirigiendo…",
      opening: "Abriendo…",
      cancelSubscription: "Cancelar suscripción",
      paypalCheckoutFailed: "No se pudo iniciar el pago con PayPal. Inténtelo de nuevo.",
      portalFailed: "No se pudo abrir el portal de facturación.",
      managedForYou: "Nosotros gestionamos esta suscripción. Escriba a {email} para obtener recibos o hacer un cambio.",
      newTab: "(se abre en una pestaña nueva)",
      upgradeLead: "¿Listo para crecer?",
      upgradeBody: "El plan {plan} incluye {articles}, {terms} y {credits}.",
      upgradeLink: "Vea lo que ofrece {plan}",
      statusActive: "Activa",
      statusTrialing: "Prueba gratuita",
      statusPastDue: "Pago vencido",
      statusUnpaid: "Impagada",
      statusIncomplete: "Pago incompleto",
      statusIncompleteExpired: "Pago caducado",
      statusCanceled: "Cancelada",
      statusPaused: "En pausa",
      statusInactive: "Inactiva",
      pastDueNotice: "El último pago de este sitio web no se ha completado. Actualice el método de pago para mantener el acceso.",
      unsettledNotice: "La suscripción de este sitio web debe regularizarse o cancelarse antes de poder cambiar de plan.",
      endedNotice: "Esta suscripción ha finalizado. Elija un plan a continuación para volver a empezar.",
      billedByPayPal: "Este sitio web se factura a través de PayPal, así que los cambios de plan también se hacen con PayPal.",
      billedByCard: "Este sitio web se factura con tarjeta, así que los cambios de plan se hacen con tarjeta. Para pagar con PayPal, cancele primero la suscripción con tarjeta.",
      billedByCardEnding: "La suscripción con tarjeta de este sitio web finaliza el {date}. Podrá elegir PayPal cuando haya finalizado.",
      noPlanChange: "Ahora mismo no se puede cambiar el plan de este sitio web.",
      paypalApproved: "Aprobación de PayPal recibida - confirmando su suscripción…",
      paypalCancelled: "Pago con PayPal cancelado.",
      viewingSharedNote: "{shared} se ha compartido con usted y lo paga su propietario. Esta página muestra la facturación de sus propios sitios web.",
      guestTitle: "Aquí no hay nada que pagar",
      guestBody: "Los sitios web compartidos con usted los pagan sus propietarios. No necesita un plan para trabajar en ellos.",
      addWebsite: "Añadir un sitio web",
      viewPlan: "Ver plan",
      shownBelow: "Se muestra abajo",
      paidByCard: "Tarjeta",
      invoiceInPortal: "Factura en Gestionar facturación",
      dateColumn: "Fecha",
      descriptionColumn: "Descripción",
      methodColumn: "Pagado con",
      amountColumn: "Importe",
      receiptColumn: "Recibo",
      historyCapped: "Se muestran los {count} pagos más recientes.",
    },
    article: {
      contentSeo: "Contenido y SEO",
      contentSeoHelp: "Cómo se escribe cada artículo y qué ocurre con él después.",
      publishAs: "Publicar como",
      publishLive: "Los artículos se publican en su sitio a la hora programada.",
      publishDraft: "Los artículos se envían como borradores para que los revise primero.",
      live: "Publicado",
      draft: "Borrador",
      articleStyle: "Estilo del artículo",
      internalLinks: "Enlaces internos",
      internalLinksHelp: "Enlaces internos objetivo por artículo.",
      targetWordCount: "Extensión objetivo",
      adaptiveOn: "Elegimos la mejor extensión para cada tipo de artículo.",
      adaptiveOff: "Una extensión fija para todos los formatos.",
      wordsPerArticle: "Palabras por artículo",
      contentDetails: "Detalles del contenido",
      sitemapUrl: "URL del sitemap",
      blogAddress: "Dirección principal del blog",
      bestArticle: "Su mejor artículo de ejemplo",
      engagement: "Interacción",
      brandColour: "Color de marca",
      optional: "Opcional",
      imageBrief: "Cómo debe verse su marca en las imágenes",
      imageBriefPlaceholder: "Cinematográfico, minimalista, grises fríos con toques de azul eléctrico.",
      imageInstructions: "Instrucciones adicionales para las imágenes",
      imageInstructionsPlaceholder: "p. ej. Nunca mostrar caras.",
      tableOfContents: "Índice",
      comparisonTable: "Tabla comparativa",
      youtubeVideo: "Vídeo de YouTube",
      authorPerspective: "Perspectiva del autor",
      mentionSimilar: "Mencionar productos y herramientas similares",
      poweredBy: "Enlace Powered by RepGet",
      howWeWrite: "Cómo escribimos",
      toneLabel: "¿Cómo deben sonar sus artículos?",
      tonePlaceholder: "Cercano y tranquilizador, no clínico",
      rulesLabel: "Reglas para cada artículo",
      rulesPlaceholder: "Nunca ponga un año en el título. Mencione siempre que ofrecemos envío gratuito.",
      factsLabel: "Datos sobre su negocio",
      uspsLabel: "¿Qué le hace diferente?",
      onePerLine: "Uno por línea.",
      preferLabel: "Palabras que prefiere",
      preferPlaceholder: "Diga tratamiento, no procedimiento",
      avoidLabel: "Palabras que evitar",
      avoidPlaceholder: "Nunca diga barato",
      author: "Autor",
      authorName: "Nombre del autor",
      authorNamePlaceholder: "Su nombre, o el de la marca",
      shortBio: "Biografía breve",
      shortBioPlaceholder: "Una o dos frases sobre quién escribe y por qué sabe del tema.",
      closePreview: "Cerrar vista previa",
      unsavedChanges: "Cambios sin guardar",
      contentDetailsHelp: "Dónde vive su contenido, para poder enlazarlo e imitar su formato.",
      engagementHelp: "Qué aspecto tienen los artículos y qué se añade junto al texto.",
      howWeWriteHelp: "La voz detrás de cada artículo.",
      factsHelp: "Uno por línea. Son los únicos datos concretos que afirmaremos.",
      authorHelp: "La firma que aparece en cada artículo, aquí y en su sitio.",
      noBylineHelp: "Si lo deja vacío, los artículos se publican sin firma.",
      pageTitle: "Ajustes de artículos",
      pageDescription: "Cómo se escriben, ilustran y publican los artículos de este sitio web.",
      sectionWriting: "Redacción y SEO",
      sectionWritingHelp: "El estilo y la extensión de cada artículo, y cuántos enlaces lleva a sus otras páginas.",
      sectionSources: "Fuentes de contenido",
      sectionSourcesHelp: "Dónde está su contenido en su sitio web.",
      sectionImages: "Imágenes y marca",
      sectionImagesHelp: "La imagen que se crea para cada artículo y el aspecto de su marca.",
      sectionEnhancements: "Mejoras del artículo",
      sectionEnhancementsHelp: "Extras que se añaden a los artículos junto al texto.",
      sectionVoice: "Voz de marca",
      sectionVoiceHelp: "Cómo suenan sus artículos y qué pueden decir sobre su negocio.",
      sectionAuthor: "Autor",
      sectionAuthorHelp: "La persona o marca que firma sus artículos. Se guarda con sus ajustes; por ahora los artículos no la muestran como firma.",
      unknownOption: "{value} (ya no disponible)",
      linksError: "Introduzca un número entero de 0 a 20.",
      wordsError: "Introduzca un número entero de 300 a 5000.",
      sitemapHint: "Nos permite encontrar páginas de su sitio a las que enlazar desde los nuevos artículos.",
      blogHint: "La página principal de su blog.",
      exampleHint: "Un artículo suyo con el que esté satisfecho.",
      urlError: "Introduzca una dirección completa que empiece por http:// o https://.",
      brandColourHint: "El color principal de su marca en código hexadecimal. Se guarda con sus ajustes; por ahora las imágenes generadas no lo usan.",
      brandColourError: "Use # seguido de seis dígitos o letras de la a a la f, por ejemplo #003388.",
      noColour: "Sin color",
      invalidColour: "Color no válido",
      pickColour: "Elegir un color de marca",
      clearColour: "Quitar color",
      imageStyleLabel: "Estilo de imagen",
      imageStyleHint: "El estilo de la imagen que se crea para cada artículo.",
      coverStyleLabel: "Estilo de la imagen de portada",
      coverStyleHint: "Su estilo preferido para las portadas. Por ahora cada artículo recibe una sola imagen, en el estilo de imagen de arriba, y esa imagen es también su portada.",
      samplesNote: "Los ejemplos ilustran cada estilo. Las imágenes de sus artículos se crean para cada artículo y serán distintas.",
      matchFollows: "Ahora sigue: {style}",
      matchFollowsUnknown: "Sigue el estilo de imagen de arriba",
      previewStyle: "Ver el ejemplo de {style}",
      previewTitle: "Ejemplo: {style}",
      previewMatchTitle: "Igual que las imágenes del artículo, ahora {style}",
      previewHelp: "Un ejemplo de este estilo. Verlo no cambia su elección.",
      sampleAlt: "Imagen de ejemplo en el estilo {style}",
      unknownImageStyle: "Su elección guardada ({value}) no es uno de estos estilos. Se mantiene hasta que elija uno.",
      imageBriefHint: "Se incluye en las instrucciones de cada imagen de artículo.",
      tocHint: "Añade un índice creado a partir de los encabezados del artículo.",
      youtubeHint: "Su elección se guarda. Por ahora no se añaden vídeos a los artículos.",
      perspectiveHint: "Escribe con un punto de vista propio en lugar de forma impersonal.",
      similarHint: "Menciona y compara alternativas para una cobertura más completa.",
      comparisonHint: "Añade una tabla que compara lado a lado las opciones de las que trata el artículo, como «Videografía frente a cinematografía de un vistazo».",
      poweredByHint: "Un pequeño crédito al final de cada artículo. Desactivarlo se aplica a los artículos aún no publicados.",
      factsPlaceholder: "Abierto desde 2004\nCinco dentistas en el equipo\nAparcamiento gratuito",
      uspsPlaceholder: "Citas de urgencia el mismo día\nAtendemos a pacientes nerviosos",
      tooManyLines: "Hasta {max} líneas. Quite 1 línea.|Hasta {max} líneas. Quite {count} líneas.",
      lineTooLong: "La línea {line} tiene más de {max} caracteres.",
      fixFields: "Algunos campos necesitan atención. Están marcados en la página.",
      saveError: "Algo ha fallado. Inténtelo de nuevo.",
      saveBarNote: "Incluye todas las secciones salvo Redacción y publicación, que se guarda en cuanto la cambia.",
      autoOnHelp: "Trabajamos su plan de contenidos por nuestra cuenta. Puede escribir cualquier artículo usted mismo cuando quiera.",
      autoOffHelp: "No se escribe nada hasta que lo pida. Abra un artículo planificado y pulse Escribir.",
      anyDay: "Cualquier día.",
      pickedDays: "Solo los días que elija.",
      daysUtc: "Los días siguen la hora UTC (tiempo universal coordinado).",
      firstArticleOnly: "Su primer artículo se envía en cuanto está listo, elija lo que elija, para que vea cómo quedan los artículos en su sitio.",
      networkReview: "Mientras su web esté en la Red de socios, el equipo de RepGet revisa antes cada artículo - también el primero - y ninguno se envía antes de su día previsto.",
      openIntegrations: "Abrir Integraciones",
      weekdaysShort: { sun: "Dom", mon: "Lun", tue: "Mar", wed: "Mié", thu: "Jue", fri: "Vie", sat: "Sáb" },
      weekdaysLong: { sun: "Domingo", mon: "Lunes", tue: "Martes", wed: "Miércoles", thu: "Jueves", fri: "Viernes", sat: "Sábado" },
      bodyImageStyles: {
        sketch: { label: "Boceto", hint: "Trazos a mano sobre color suave." },
        watercolour: { label: "Acuarela", hint: "Aguadas pintadas suaves." },
        realistic: { label: "Realista", hint: "Fotográfico." },
        illustration: { label: "Ilustración", hint: "Formas vectoriales planas." },
        "brand-text": { label: "Marca y texto", hint: "Una foto con un panel de color intenso a lo largo de un borde." },
      },
      coverImageStyles: {
        sketch: { label: "Boceto", hint: "Trazos a mano sobre color suave." },
        watercolour: { label: "Acuarela", hint: "Aguadas pintadas suaves." },
        illustration: { label: "Ilustración", hint: "Formas vectoriales planas." },
        match: { label: "Igual que las imágenes del artículo", hint: "Sigue el estilo de imagen de arriba." },
      },
      styles: {
        expert: { label: "Experto", hint: "Tono editorial preciso, con matices y terminología equilibrados." },
        conversational: { label: "Conversacional", hint: "Frases claras y directas. Explica los términos la primera vez que aparecen." },
        friendly: { label: "Cercano", hint: "Cálido y alentador, en segunda persona, con poca jerga." },
        journalistic: { label: "Periodístico", hint: "Empieza por el hallazgo, atribuye las afirmaciones, sin lenguaje comercial." },
      },
    },
    editor: {
      backToWebsite: "Volver al sitio web",
      headings: "Encabezados",
      words: "Palabras",
      keywordUses: "Usos de la palabra clave",
      internalLinks: "Enlaces internos",
      externalLinks: "Enlaces externos",
      socialMentions: "Menciones sociales",
      starting: "Empezando",
      takesAMinute: "Esto suele tardar alrededor de un minuto. La página se actualiza sola.",
      couldNotWrite: "No pudimos escribir este artículo",
      tryAgain: "Reintentar",
      publishingHistory: "Historial de publicación",
      historyHelp: "Cada intento queda registrado, para que un fallo sea visible y no silencioso.",
      failed: "Fallido",
      viewPost: "Ver publicación",
      editArticle: "Editar artículo",
      editHelp: "Su versión anterior se conserva cada vez que guarda.",
      previewUnsaved: "Esta vista previa incluye cambios que aún no ha guardado. Guárdelos en la pestaña Editar.",
      partnerLink: "Enlace de socio",
      partnerLinksNote: "Las palabras resaltadas son enlaces de la red de socios que colocó el equipo de RepGet.",
      title: "Título",
      metaDescription: "Meta descripción",
      slugLabel: "Dirección en su sitio web",
      slugPlaceholder: "bodas-video-italia",
      slugHelp: "Los espacios y la puntuación se convierten en guiones. Déjelo vacío y su sitio web elegirá una a partir del título.",
      articleContent: "Contenido del artículo",
      saving: "Guardando…",
      saveChanges: "Guardar cambios",
      saved: "Guardado",
      rewriting: "Reescribiendo el artículo…",
      sendAsDraft: "Enviar como borrador",
      publishedToSite: "Publicado: ya está en su sitio web.",
      sentAsDraftToSite: "Enviado a su sitio web como borrador.",
      viewOnSite: "Ver en su sitio web",
      connectToPublish: "Conecte su sitio web para publicar",
      publishViaPlugin: "Su sitio web no respondió, así que el artículo queda en cola: el plugin de WordPress lo envía en su próxima comprobación, antes de una hora. Actualice el plugin a la versión 1.4 o posterior para publicar al instante.",
      waitingForPlugin: "Esperando al plugin de WordPress",
      updatePost: "Actualizar publicación",
      publish: "Publicar",
      sendingDraft: "Enviando como borrador…",
      planningOutline: "Planificando qué cubrir",
      writingBody: "Escribiendo el artículo",
      breadcrumbLabel: "Ruta de navegación",
      targetKeywordLabel: "Palabra clave objetivo",
      lastSaved: "Actualizado por última vez el {date}",
      viewModeLabel: "Vista previa o edición",
      unsavedMark: "Cambios sin guardar",
      previewLabel: "Vista previa del artículo",
      previewUnsavedNow: "Está viendo cambios que aún no se han guardado. Su sitio web solo los recibe después de guardar y publicar.",
      notWrittenYet: "El artículo aparecerá aquí en cuanto esté escrito.",
      workingPaused: "La edición y la publicación esperan a que termine, porque la nueva versión sustituye el texto.",
      conflictTitle: "Este artículo cambió mientras lo editaba",
      conflictBody: "Mientras tanto cambió lo guardado en: {fields}, por ejemplo porque terminó una reescritura o porque otra persona guardó. Si guarda ahora, su versión sustituirá a esa.",
      conflictLoad: "Usar la versión guardada",
      conflictKeep: "Conservar mi versión",
      genUnavailable: "La redacción no está disponible por el momento. El problema es nuestro y ya lo estamos revisando.",
      genBusy: "El servicio de redacción estaba saturado. Vuelva a intentarlo en unos minutos.",
      genTimeout: "La redacción tardó demasiado y se detuvo. Vuelva a intentarlo: suele ser algo pasajero.",
      genUnusable: "No pudimos crear un artículo útil con este tema. Vuelva a intentarlo o concrete más el tema y la palabra clave objetivo.",
      genQuota: "Este espacio de trabajo ha usado todos sus artículos del mes. Mejore el plan para escribir más.",
      genGeneric: "La redacción de este artículo no terminó. Vuelva a intentarlo. Si sigue ocurriendo, contacte con soporte.",
      pubErrAuth: "Su sitio web rechazó el acceso guardado. Vuelva a conectarlo en la página Integraciones.",
      pubErrPermission: "La cuenta conectada no tiene permiso para publicar entradas. Conecte una cuenta que pueda publicar.",
      pubErrNotFound: "No se encontró la dirección de su sitio web. Compruébela en la página Integraciones.",
      pubErrUnreachable: "Su sitio web no respondió. Suele ser algo pasajero: vuelva a intentarlo o compruebe que el sitio está en línea.",
      pubErrApiDisabled: "Su sitio web está en línea, pero su interfaz de publicación está desactivada, a menudo por un plugin de seguridad. Vuelva a activarla y pruebe la conexión.",
      pubErrUnsupported: "Su sitio web hace algo en lo que todavía no podemos publicar.",
      pubErrUnknown: "La publicación no terminó. Vuelva a intentarlo. Si sigue ocurriendo, contacte con soporte.",
      editSaveNote: "El título, la meta descripción, la dirección y el texto se guardan juntos con el botón Guardar. La imagen destacada se guarda en cuanto la cambia.",
      titleRequired: "Escriba un título.",
      metaHint: "Aparece bajo el título en los resultados de búsqueda, que suelen mostrar unos {count} caracteres.",
      slugSavedAs: "Se guardará como: {slug}",
      slugEmptyNote: "Si lo deja vacío, su sitio web elige la dirección a partir del título.",
      slugDropped: "Las letras con acentos y otros caracteres especiales se omiten en la dirección.",
      slugWordPressNote: "WordPress mantiene la dirección con la que se publicó la entrada por primera vez. Cambiarla aquí no mueve la entrada publicada.",
      searchPreviewTitle: "Vista previa en los resultados de búsqueda",
      searchPreviewHelp: "Es una aproximación. Los buscadores deciden qué muestran.",
      saveArticle: "Guardar artículo",
      saveNoteWorking: "El guardado espera mientras se escribe el artículo.",
      saveNoteDelivering: "El guardado espera mientras el artículo se entrega a su sitio web.",
      saveNoteReview: "Al guardar cambios, este artículo vuelve a revisión del equipo de RepGet.",
      saveNoteTitle: "Escriba un título para guardar.",
      statsTitle: "Estadísticas del artículo",
      statsHelp: "Calculadas a partir del texto del artículo.",
      statsUnsaved: "Calculadas a partir del texto en pantalla, incluidos los cambios sin guardar.",
      publishingTitle: "Publicación",
      publishingHelp: "Al publicar se envía a su sitio web la última versión guardada.",
      destinationLabel: "Destino",
      destinationNone: "Sin conectar",
      destinationPlugin: "Plugin de WordPress",
      manageConnection: "Gestionar la conexión",
      plannedLabel: "Fecha prevista",
      plannedNone: "Sin fecha prevista",
      autoLabel: "Publicación automática",
      autoOnLive: "Activada, como entradas publicadas",
      autoOnDraft: "Activada, como borradores",
      autoOff: "Desactivada",
      beforePlanned: "Si publica ahora, se envía de inmediato, antes de su fecha prevista.",
      stateNotSent: "Aún no se ha enviado a su sitio web.",
      stateLive: "Publicado en su sitio web. Último envío: {date}.",
      stateDraft: "En su sitio web como borrador. Último envío: {date}.",
      stateScheduled: "Programado en su sitio web. Último envío: {date}.",
      stateDelivered: "Entregado a su sitio web el {date}.",
      stateFailed: "El último intento ({date}) no terminó.",
      statePluginUnconfirmed: "El plugin de WordPress no confirmó la última entrega ({date}).",
      stateWriting: "La publicación estará disponible cuando el artículo esté escrito.",
      stateFrozen: "El equipo de RepGet ha pausado la publicación. No se envía nada a los sitios web hasta que se reanude.",
      stateReviewPending: "El equipo de RepGet está preparando este artículo para la red de socios. Se publicará en cuanto lo aprueben.",
      stateReviewChanged: "Este artículo cambió después de que el equipo de RepGet lo aprobara, así que ha vuelto a su revisión.",
      stateDelivering: "Entregándose a su sitio web ahora…",
      stateQueued: "En cola desde las {time}. El resultado aparecerá aquí cuando responda su sitio web.",
      stateQueuedLong: "Aún no hay resultado. La entrega puede quedar retenida, por ejemplo mientras un intento anterior está sin resolver. Vuelva a comprobarlo en unos minutos.",
      checkAgain: "Comprobar de nuevo",
      statePluginWaiting: "Esperando a que el plugin de WordPress lo recoja como {mode}. El plugin comprueba al menos una vez por hora.",
      modeLive: "entrada publicada",
      modeDraft: "borrador",
      statePluginPublished: "El plugin de WordPress creó esta entrada y no puede modificarla después, así que los cambios guardados aquí no llegan a su sitio web. Haga los demás cambios en WordPress.",
      stateUncertain: "El último intento no obtuvo respuesta de su sitio web. Consulte el aviso al principio de la página.",
      uncertainPublishNote: "Mientras esto esté sin resolver, volver a publicar no crea una segunda entrada: primero buscamos la anterior.",
      connectHelp: "Conecte su sitio web para publicar en él este artículo.",
      blockedUnsaved: "Guarde primero sus cambios. Al publicar se envía la versión guardada, no lo que ve en pantalla.",
      alreadySentLive: "Esta misma versión ya está publicada en su sitio web.",
      alreadySentDraft: "Esta misma versión ya está en su sitio web como borrador.",
      confirmDraftTitle: "¿Devolver la entrada publicada a borrador?",
      confirmDraftBody: "Este artículo está publicado en su sitio web. Enviarlo como borrador puede retirar la entrada publicada (WordPress lo hace). Para cambiar la entrada publicada, use Actualizar publicación.",
      historyLatest: "Los últimos {count} intentos, del más reciente al más antiguo.",
      historyEmpty: "Todavía no se ha enviado nada a su sitio web.",
      logLive: "Publicado",
      logDraft: "Enviado como borrador",
      logScheduled: "Programado",
      logDelivered: "Entregado",
      rewriteTitle: "Reescribir el artículo",
      rewriteHelp: "Vuelve a escribir todo el artículo a partir de su plan. Cada sitio web puede reescribir {count} artículos al día.",
      rewriteConfirmTitle: "¿Reescribir este artículo?",
      rewriteConfirmBody: "El texto, la meta descripción, la dirección y la imagen destacada se sustituyen por una versión nueva. La versión actual no se conserva.",
      rewriteConfirmPublished: "La entrada de su sitio web no cambia hasta que publique la versión nueva.",
      rewriteConfirmReview: "La versión nueva pasa a revisión del equipo de RepGet antes de poder publicarse.",
      rewriteConfirmUnsaved: "Sus cambios sin guardar se descartan.",
      rewriteConfirmAction: "Reescribir",
      rewriteNoPlan: "Este artículo no tiene una entrada en el plan, así que no se puede volver a escribir.",
      rewriteBlocked: "Disponible de nuevo cuando termine la redacción o la entrega en curso.",
      imagePromptHint: "Déjelo vacío y elegimos nosotros. Quedan {remaining} de {max} imágenes nuevas para este artículo.",
      imageGenerate: "Generar",
      imageReplace: "Sustituir",
      imageAltHint: "Se guarda al salir del campo.",
      imageCheckAlt: "Compruebe que la descripción sigue correspondiendo a la nueva imagen.",
      imageLockedWorking: "Espere a que el artículo esté escrito: una reescritura sustituye la imagen.",
      imageLockedDelivering: "Espere a que termine la entrega a su sitio web.",
      imageTypeError: "Use una imagen PNG, JPEG o WebP.",
      imageSizeError: "Esa imagen ocupa {size} MB. El límite es {max} MB.",
      imageNoAlt: "Aún sin descripción.",
      imageAltSaved: "Descripción guardada.",
      errInFlight: "Este artículo se está entregando ahora a su sitio web. Vuelva a intentarlo en un minuto.",
      errNotWritten: "Este artículo aún no se ha escrito.",
      errConnectFirst: "Conecte su sitio web antes de publicar.",
      errNotFound: "Este artículo ya no existe.",
      errRewriteCap: "Este sitio web ha usado todas sus reescrituras de las últimas 24 horas. Vuelva a intentarlo más tarde.",
      errAlreadyWriting: "Este artículo ya se está escribiendo.",
      errNoActivePlan: "Este espacio de trabajo no tiene un plan activo. Elija uno para seguir escribiendo.",
      errImageStorage: "El almacenamiento de imágenes no está disponible ahora. Vuelva a intentarlo más tarde.",
      errImageGeneration: "La generación de imágenes no está disponible ahora. Vuelva a intentarlo más tarde.",
      metaNone: "Todavía no hay meta descripción. Los buscadores muestran entonces un fragmento del artículo.",
      searchPreviewUnsaved: "La vista previa incluye cambios que aún no se han guardado.",
      imageReviewNote: "Si cambia la imagen o su descripción, este artículo vuelve a revisión del equipo de RepGet.",
    },
    analytics: {
      googleResults: "Resultados de Google",
      connectHelp: "Conecte Google para ver qué búsquedas llevan gente a su sitio web y cómo cambia a medida que publicamos.",
      connectGoogle: "Conectar Google",
      redirecting: "Redirigiendo…",
      expired: "La conexión anterior caducó. Vuelva a conectarla para seguir importando.",
      connected: "Conectado",
      last28: "Últimos 28 días.",
      chooseThenImport: "Elija sus propiedades abajo y guarde para importar sus datos.",
      visitorsFromGoogle: "Visitantes desde Google",
      timesAppeared: "Veces que apareció",
      averageRanking: "Posición media",
      websiteVisits: "Visitas al sitio web",
      whatPeopleSearched: "Qué buscaron para encontrarle",
      query: "Consulta",
      visitors: "Visitantes",
      searchConsoleProperty: "Propiedad de Search Console",
      analyticsProperty: "Propiedad de Analytics",
      chooseProperty: "Elija una propiedad",
      importing: "Importando sus datos - esto tarda un momento",
      disconnected: "Google desconectado",
      statusConnected: "Google conectado",
      statusCancelled: "Conexión cancelada",
      statusForbidden: "No puede conectar ese sitio web",
      statusInvalid: "Ese enlace no era válido - inténtelo de nuevo",
      statusError: "No se pudo conectar Google",
      pageTitle: "Google Search y Analytics",
      pageDescription: "Cómo le encuentra la gente en la Búsqueda de Google y cuántas visitas recibe su sitio web. Las cifras proceden de sus propias cuentas de Search Console y Google Analytics.",
      rangeLabel: "Periodo",
      rangeDays: "{days} días",
      periodDates: "{start} – {end}",
      connectTitle: "Conecte sus cuentas de Google",
      searchConsoleName: "Google Search Console",
      analyticsName: "Google Analytics",
      searchConsolePurpose: "Muestra cómo le va a su sitio web en la Búsqueda de Google: cuántas veces aparece (impresiones), cuántas veces hacen clic (clics), su posición media y qué búsquedas y páginas atraen a la gente.",
      analyticsPurpose: "Muestra cuántas visitas (sesiones) recibe todo su sitio web desde cualquier origen: Google, otros buscadores, redes sociales, enlaces y personas que escriben su dirección.",
      setupTitle: "Cómo funciona la conexión",
      setupStep1: "Inicie sesión con la cuenta de Google que ve este sitio web en Search Console y, si lo usa, en Google Analytics. Un solo inicio de sesión sirve para ambos.",
      setupStep2: "Google le pide que permita el acceso de solo lectura. RepGet puede leer sus cifras, pero no puede cambiar nada en sus cuentas de Google.",
      setupStep3: "De vuelta aquí, elija la propiedad de Search Console y la de Analytics de este sitio web. RepGet importa aproximadamente los dos últimos meses y después las cifras nuevas cada día.",
      readOnlyAccess: "Acceso de solo lectura. Puede desconectarlo en cualquier momento.",
      expiredTitle: "Hay que volver a conectar Google",
      reconnectGoogle: "Volver a conectar Google",
      viewerCannotConnect: "Solo un propietario o un editor de este sitio web puede conectar Google.",
      connectionTitle: "Conexión con Google",
      connectionHelp: "RepGet importa cifras nuevas cada día. Google informa con unos tres días de retraso.",
      notChosen: "Sin elegir",
      dataThrough: "Cifras hasta el {date}",
      noFiguresYet: "Aún no hay cifras de Google",
      analyticsPropertyId: "Propiedad {id}",
      importNow: "Importar ahora",
      manageConnection: "Gestionar la conexión",
      viewerSetupPending: "Google está conectado, pero aún no se ha elegido ninguna propiedad. Un propietario o un editor puede elegirla.",
      importRequestedTitle: "Importación solicitada",
      importRequestedBody: "RepGet está importando sus cifras de Google. Esta página las busca durante aproximadamente un minuto.",
      importStillRunning: "La importación puede tardar unos minutos. Las cifras nuevas aparecerán aquí cuando termine: vuelva a cargar la página más tarde para verlas.",
      setupNeededTitle: "Elija qué importar",
      setupNeededBody: "Elija la propiedad de Search Console y la de Analytics de este sitio web y guarde. Basta con una de las dos.",
      propertiesTitle: "Propiedades",
      propertiesHelp: "Qué propiedades de Google pertenecen a este sitio web.",
      loadingProperties: "Cargando las propiedades que ve su cuenta de Google…",
      propertiesFailed: "No se pudieron cargar sus propiedades desde Google. Inténtelo de nuevo o vuelva a conectar Google si sigue ocurriendo.",
      tryAgain: "Reintentar",
      searchConsoleHint: "La propiedad de Search Console de este sitio web, por ejemplo una propiedad de dominio.",
      analyticsHint: "La propiedad de Google Analytics 4 de este sitio web.",
      noSearchConsoleFound: "No se encontraron propiedades de Search Console para esta cuenta de Google. Compruebe que tiene acceso o vuelva a conectar con otra cuenta.",
      noAnalyticsFound: "No se encontraron propiedades de Google Analytics 4 para esta cuenta de Google. Compruebe que tiene acceso o vuelva a conectar con otra cuenta.",
      noSearchConsoleProperty: "Ninguna (no importar de Search Console)",
      noAnalyticsProperty: "Ninguna (no importar de Analytics)",
      propertyUnavailable: "{name} (no disponible para esta cuenta de Google)",
      saveAndImport: "Guardar e importar",
      saveSelection: "Guardar",
      selectionUnsaved: "Su nueva elección aún no está guardada.",
      noSelectionChange: "No hay cambios que guardar.",
      propertiesSaved: "Propiedades guardadas",
      accountTitle: "Cuenta de Google",
      accountHelp: "Vuelva a conectar para renovar el acceso o cambiar a otra cuenta de Google. Las propiedades elegidas se conservan.",
      disconnect: "Desconectar",
      disconnecting: "Desconectando…",
      disconnectTitle: "¿Desconectar Google?",
      disconnectBody: "RepGet deja de importar de Search Console y Analytics para este sitio web y olvida las propiedades elegidas.",
      disconnectKeeps: "Las cifras ya importadas se conservan.",
      disconnectAccess: "Para retirar también el acceso de RepGet en su cuenta de Google, use la configuración de seguridad de su cuenta de Google.",
      cancel: "Cancelar",
      disconnectFailed: "No se pudo desconectar Google. Inténtelo de nuevo.",
      importFailed: "No se pudo solicitar la importación. Inténtelo de nuevo.",
      googleUnreachable: "No se pudo acceder a Google con la conexión guardada. Vuelva a conectar Google e inténtelo de nuevo.",
      errorNotConfigured: "La conexión con Google aún no está disponible. Póngase en contacto con soporte.",
      errorSignIn: "Vuelva a iniciar sesión para conectar Google.",
      errorReconnect: "Vuelva a conectar su cuenta de Google para continuar.",
      errorConnectFirst: "Conecte Google primero.",
      errorChooseFirst: "Elija primero una propiedad de la que importar.",
      searchTitle: "Búsqueda de Google",
      searchDescription: "Cifras de todo el sitio desde Search Console: todas las páginas de su sitio web en la Búsqueda de Google, no solo los artículos que escribe RepGet.",
      analyticsTitle: "Visitas al sitio web",
      analyticsDescription: "Sesiones en todo su sitio web desde cualquier origen, según Google Analytics. No solo las visitas que llegaron desde la Búsqueda de Google.",
      clicks: "Clics",
      clicksHint: "Veces que alguien hizo clic para entrar en su sitio web desde la Búsqueda de Google.",
      impressions: "Impresiones",
      impressionsHint: "Veces que su sitio web apareció en los resultados de la Búsqueda de Google.",
      ctr: "Porcentaje de clics (CTR)",
      ctrShort: "CTR",
      ctrHint: "Clics divididos entre impresiones.",
      averagePosition: "Posición media",
      positionShort: "Posición media",
      positionHint: "Su lugar medio en los resultados de Google, ponderado por impresiones. Cuanto más bajo, mejor.",
      sessions: "Sesiones",
      sessionsHint: "Visitas a su sitio web desde cualquier origen. Una persona puede hacer varias sesiones.",
      comparedWith: "Los cambios se comparan con los {days} días anteriores.",
      noComparison: "Sin comparación: no todos los {days} días anteriores tienen cifras de Google.",
      noChange: "Sin cambios",
      better: "mejor",
      worse: "peor",
      pointsChange: "{value} p. p.",
      notAvailable: "No disponible",
      daysReported: "Datos de {reported} de {days} días",
      zeroSearch: "Search Console no registró impresiones en este periodo.",
      zeroSessions: "Google Analytics no registró sesiones en este periodo.",
      staleSource: "No hay ninguna propiedad de {source} elegida, así que estas cifras ya no se actualizan.",
      notSelectedTitle: "Ninguna propiedad de {source} elegida",
      notSelectedEditor: "Elija una en Conexión con Google para ver aquí estas cifras.",
      notSelectedViewer: "Un propietario o un editor puede elegirla en Conexión con Google.",
      awaitingTitle: "Aún no hay cifras de {source}",
      awaitingBody: "Google aún no ha informado de ninguna cifra para esta propiedad. Los sitios web nuevos o con poco tráfico pueden no tener ninguna durante un tiempo. RepGet busca cifras nuevas cada día.",
      noneInPeriodTitle: "No hay cifras de {source} en este periodo",
      latestFrom: "Las cifras más recientes son del {date}. Elija un periodo más largo para incluirlas.",
      latestOnly: "Las cifras más recientes son del {date}.",
      dailyTitle: "Día a día",
      dailyDescription: "Los días de los que Google no ha informado quedan como huecos, no se dibujan como cero.",
      chartMetric: "Cifra que muestra el gráfico",
      chartClicks: "Clics desde la Búsqueda de Google por día",
      chartImpressions: "Impresiones en la Búsqueda de Google por día",
      chartSessions: "Sesiones por día",
      unitClicks: "clics",
      unitImpressions: "impresiones",
      unitSessions: "sesiones",
      notReported: "sin datos",
      day: "Día",
      chartInstructions: "Use las flechas izquierda y derecha para moverse entre los días.",
      chartEmpty: "No hay cifras diarias en este periodo.",
      topTitle: "Principales búsquedas y páginas",
      topSearches: "Búsquedas",
      topPages: "Páginas",
      searchTerm: "Búsqueda",
      page: "Página",
      topSearchesNote: "Las 10 búsquedas con más clics. Google omite las búsquedas poco frecuentes para proteger la privacidad, así que suman menos que los totales de arriba.",
      topPagesNote: "Las 10 páginas con más clics desde la Búsqueda de Google.",
      topSearchesCaption: "Principales búsquedas de este periodo",
      topPagesCaption: "Principales páginas de este periodo",
      noSearches: "No se registraron búsquedas en este periodo.",
      noPages: "No se registraron páginas en este periodo.",
      opensInNewTab: "(se abre en una pestaña nueva)",
    },
    research: {
      contentPlan: "Plan de contenidos",
      articlesTab: "Artículos",
      opportunities: "Oportunidades",
      refresh: "Actualizar",
      looking: "Buscando…",
      researchFailed: "La investigación no pudo terminar, así que no se creó ningún plan de contenido. Pulse el botón para intentarlo de nuevo; si falla dos veces, contacte con soporte.",
      planReady: "Su plan de contenido está listo.",
      planNotRebuilt: "No se pudo reconstruir su plan de contenido, así que el plan anterior no ha cambiado. Pulse el botón para intentarlo de nuevo; si falla dos veces, contacte con soporte.",
      keywordsAdded: "Añadidas: {added}.",
      keywordsAddedSkipped: "Añadidas: {added}. Omitidas: {skipped}, ya incluidas o por encima de su plan.",
      replanning: "Reconstruyendo su plan de contenido…",
      planBusy: "Su plan se está creando ahora mismo: pulse {button} cuando esté listo para incluirlas.",
      plannedArticles: "Artículos planificados",
      plannedHelp: "Su plan de contenidos, por el día en que vence cada artículo. Pase el cursor sobre un tema planificado para escribirlo ahora, cambiarlo o quitarlo del plan.",
      articles: "Artículos",
      articlesHelp: "Escritos a partir de su plan de contenidos. Abra uno para leerlo, editarlo o reescribirlo.",
      nothingWritten: "Todavía no hay nada escrito. Use",
      write: "Escribir",
      title: "Título",
      status: "Estado",
      words: "Palabras",
      keywords: "Palabras clave",
      keywordsHelp: "Ordenadas por lo que puede ganar de forma realista. Un término con menos búsquedas en el que puede posicionarse vale más que uno popular en el que no.",
      addKeywordsLabel: "Añada sus propias palabras clave",
      addKeywordsButton: "Añadir",
      addKeywordsPlaceholder: "videografo de bodas toscana, film de fuga italia",
      addKeywordsHelp: "Sepárelas con comas o saltos de línea. Los términos que añada no tienen datos de búsqueda propios, pero igualmente dan forma a sus temas y a su plan de contenidos.",
      keyword: "Palabra clave",
      opportunity: "Oportunidad",
      searchesPerMonth: "Búsquedas / mes",
      competition: "Competencia",
      topic: "Tema",
      difficultyLow: "Baja",
      difficultyMedium: "Media",
      difficultyHigh: "Alta",
      difficultyVeryHigh: "Muy alta",
      researching: "Investigando palabras clave - esto tarda un minuto",
      articleDeleted: "Artículo eliminado",
      statusQueued: "En cola",
      statusGenerating: "Escribiendo…",
      statusDraft: "Borrador",
      statusPublished: "Publicado",
      statusFailed: "Fallido",
    },
    publishing: {
      connectTitle: "Conecte su sitio web",
      connectHelp: "Conecte su sitio web una vez y los artículos nuevos se publicarán en su blog automáticamente.",
      nothingConnected: "Todavía no hay nada conectado",
      nothingConnectedHelp: "Conecte su sitio web y podremos publicar los artículos terminados directamente en él. Hasta entonces, puede copiarlos a mano.",
      publishTest: "Publicar artículo de prueba",
      publishing: "Publicando…",
      disconnect: "Desconectar",
      connected: "Conectado",
      cantFind: "¿No encuentra su integración?",
      cantFindHelp: "Díganos qué plataforma usa y estudiaremos añadirla.",
      contactUs: "Contáctenos",
      whereDoIFind: "¿Dónde encuentro esto?",
      checkBeforeSaving: "Comprobamos la conexión antes de guardar nada, para que lo sepa ahora y no cuando falle un artículo.",
      noPlatformMatch: "¿Ninguna plataforma le encaja? Publique donde sea con un webhook.",
      forDevelopers: "Para desarrolladores",
      connectTo: "Conectar {name}",
      connectedTo: "Conectado a {name}",
      disconnectedFrom: "Desconectado de {name}",
      draftPublished: "Borrador publicado correctamente. Revise los borradores de su sitio.",
      draftPublishedAt: "Borrador publicado - ábralo en {name}",
      pluginRowName: "Plugin de WordPress",
      pluginAwaiting: "Esperando a WordPress",
      pluginAwaitingHelp: "En la pestaña de WordPress que abrió RepGet, pulse Finish connecting to RepGet (Save and connect en plugins anteriores), o pulse Conectar WordPress abajo.",
      pluginRowFallback: "Conectado - esperando su primer informe.",
    },
    geo: {
      aiVisibility: "Visibilidad en IA",
      aiVisibilityHelp: "Si un asistente de IA menciona su negocio cuando alguien busca un negocio como el suyo.",
      checkNow: "Comprobar ahora",
      checking: "Comprobando…",
      visibilityScore: "Puntuación de visibilidad",
      weightedByPosition: "Ponderada por posición",
      vsLastCheck: "frente a la última comprobación",
      questionsNamingYou: "Preguntas que le mencionan",
      averagePosition: "Posición media",
      notYetNamed: "Todavía sin mención",
      whereYouAppear: "Dónde aparece en la lista",
      lastChecked: "Última comprobación",
      questionPlaceholder: "p. ej. ¿Qué dentista de Utrecht es mejor para pacientes nerviosos?",
      add: "Añadir",
      suggest: "Sugerir",
      askHelp: "Pregunte como lo haría un cliente y no nombre su negocio - la idea es ver si aparece por sí solo.",
      suggestedQuestions: "Preguntas sugeridas - haga clic para seguirlas",
      noQuestions: "Todavía no hay preguntas en seguimiento",
      noQuestionsHelp: "Añada las preguntas que sus clientes harían a un asistente de IA y luego compruebe si su negocio aparece en la respuesta.",
      notChecked: "Sin comprobar",
      notNamed: "Sin mención",
      stopTracking: "Dejar de seguir esta pregunta",
      questionAdded: "Pregunta añadida",
      checkQueued: "Comprobando - los resultados aparecerán aquí en unos minutos",
      alreadyTracking: "Ya está siguiendo las preguntas que le sugeriríamos",
      checksUnavailableTitle: "Las comprobaciones y sugerencias están en pausa para este sitio web",
      errAiUnavailable: "Las comprobaciones con IA no están disponibles en este momento. Inténtelo de nuevo más tarde.",
      errNoPlan: "Elija un plan para este sitio web para hacer comprobaciones y recibir sugerencias.",
      errPlanInactive: "La suscripción de este sitio web no está activa. Actualice la facturación para hacer comprobaciones y recibir sugerencias.",
      errCheckQuota: "La visibilidad en IA se ha comprobado varias veces en la última hora. Inténtelo de nuevo más tarde.",
      errSuggestQuota: "Se han pedido sugerencias muchas veces en esta hora. Inténtelo de nuevo más tarde.",
      errSuggestFailed: "No se pudieron sugerir preguntas. Inténtelo de nuevo.",
      errTooShort: "Escriba una pregunta de al menos unas pocas palabras.",
      errAllowance: "Su plan sigue hasta {count} preguntas. Elimine una para añadir otra.",
      errDuplicate: "Ya está siguiendo esa pregunta.",
      errAddFirst: "Añada primero una pregunta.",
      errUnexpected: "Algo ha fallado. Inténtelo de nuevo.",
      statusQueuedTitle: "Comprobación en cola",
      statusQueuedBody: "Esperando a que empiece la comprobación. Las respuestas aparecen aquí pregunta a pregunta, y mientras tanto puede salir de esta página.",
      statusRunningTitle: "Comprobando sus preguntas",
      statusRunningBody: "Las respuestas aparecen aquí pregunta a pregunta. Mientras tanto puede salir de esta página.",
      statusProgress: "{answered} de {total} preguntas respondidas",
      statusRequestedAt: "Solicitada el {date}",
      statusCompletedTitle: "Comprobación completada",
      statusCompletedBody: "Todas las preguntas de esta comprobación tienen una respuesta nueva.",
      statusPartialTitle: "Comprobación terminada con huecos",
      statusPartialBody: "{answered} de {total} preguntas recibieron una respuesta nueva. Las demás no la recibieron en 10 minutos; conservan su resultado anterior y se marcan abajo.",
      statusTimedOutTitle: "Aún no hay respuestas",
      statusTimedOutBody: "No llegó ninguna respuesta en 10 minutos. Puede que la comprobación siga esperando para empezar o que haya fallado. Vuelva a mirar más tarde o haga otra comprobación.",
      statusTimedOutBodyViewer: "No llegó ninguna respuesta en 10 minutos. Puede que la comprobación siga esperando para empezar o que haya fallado. Vuelva a mirar más tarde.",
      statusFailedTitle:"La comprobación no se realizó",
      statusFailedBody: "No se registró ninguna respuesta para la comprobación solicitada el {date}. Puede hacer otra comprobación.",
      statusFailedBodyViewer: "No se registró ninguna respuesta para la comprobación solicitada el {date}.",
      statusRefusedTitle: "La comprobación no se inició",
      dismiss: "Descartar",
      progressLabel: "Progreso de la comprobación",
      performanceTitle: "Cómo va su sitio web",
      performanceHelp: "Medido a partir de la última respuesta a cada pregunta comprobada.",
      howMeasured: "Cómo se mide",
      scoreOutOf: "de 100",
      scoreGood: "Buena",
      scoreFair: "Media",
      scoreLow: "Baja",
      scoreUp: "{change} puntos más que en la comprobación anterior",
      scoreDown: "{change} puntos menos que en la comprobación anterior",
      scoreSame: "Sin cambios desde la comprobación anterior",
      previousCheckOn: "Comprobación anterior: {date}",
      firstCheck: "Primera comprobación, todavía no hay nada con qué comparar",
      namedOfChecked: "{mentions} de {total}",
      namedOfCheckedHelp: "Preguntas comprobadas en las que se recomendó su negocio",
      positionValue: "n.º {position}",
      answeredInLatestCheck: "{count} de {total} preguntas respondidas en esta comprobación",
      basisNote: "Basado en la última respuesta a {checked} de {tracked} preguntas seguidas.",
      earlierAnswersNote: "1 de estas respuestas es de una comprobación anterior.|{count} de estas respuestas son de comprobaciones anteriores.",
      notCheckedYetTitle: "Aún sin comprobar",
      notCheckedYetBody: "No se ha comprobado ninguna pregunta, así que todavía no hay puntuación. La puntuación solo aparece cuando se ha preguntado de verdad a un asistente.",
      competitorsHelp: "Otros negocios recomendados en las últimas respuestas, según cuántas respuestas los nombraron.",
      competitorCount: "Mencionado en {count} de {total} respuestas",
      noCompetitors: "No se nombró a ningún otro negocio en las últimas respuestas.",
      nextStep: "Siguiente paso",
      nextAddQuestions: "Añada las preguntas que harían sus clientes o pida sugerencias.",
      nextAddQuestionsAction: "Añadir preguntas",
      nextFirstCheck: "Haga la primera comprobación para ver si los asistentes nombran su negocio.",
      nextUnchecked: "1 pregunta aún no se ha comprobado. Haga una comprobación para incluirla.|{count} preguntas aún no se han comprobado. Haga una comprobación para incluirlas.",
      nextStale: "1 respuesta es de una comprobación anterior. Haga una comprobación para actualizarla.|{count} respuestas son de comprobaciones anteriores. Haga una comprobación para actualizarlas.",
      nextNotNamed: "Los asistentes no le nombraron en 1 pregunta. Vea a quién nombraron en su lugar.|Los asistentes no le nombraron en {count} preguntas. Vea a quién nombraron en su lugar.",
      nextNotNamedAction: "Mostrar estas preguntas",
      nextUpToDate: "Sus resultados están al día. Las comprobaciones también se hacen automáticamente una vez por semana.",
      nextWaiting: "Hay una comprobación en curso. Los resultados aparecen a medida que se responde cada pregunta.",
      nextViewer: "Solo un propietario o un editor puede hacer comprobaciones o cambiar las preguntas.",
      questionsTitle: "Preguntas seguidas",
      questionsHelp: "Las preguntas que sigue, cada una con su último resultado y la evidencia que lo respalda.",
      allowanceCount: "{count} de {max} preguntas",
      addQuestionLabel: "Añadir una pregunta",
      atAllowance: "Sigue tantas preguntas como permite su plan ({max}). Elimine una para añadir otra.",
      suggestionsTitle: "Preguntas sugeridas",
      suggestionsHelp: "Elija las que quiere seguir. No se añade nada hasta que pulse Añadir seleccionadas.",
      addSelected: "Añadir seleccionadas ({count})",
      suggestionsRoom: "Puede añadir 1 pregunta más con su plan.|Puede añadir {count} preguntas más con su plan.",
      questionsAdded: "1 pregunta añadida|{count} preguntas añadidas",
      questionRemoved: "Pregunta eliminada",
      filterLabel: "Mostrar preguntas",
      filterAll: "Todas",
      filterEmpty: "Ninguna pregunta coincide con este filtro.",
      showAll: "Mostrar todas las preguntas",
      noQuestionsViewer: "Aún no se sigue ninguna pregunta. Un propietario o un editor puede añadirlas.",
      named: "Con mención",
      namedAt: "Mención n.º {position}",
      checkedOn: "Comprobada el {date}",
      fromEarlierCheck: "De una comprobación anterior ({date})",
      checkingNow: "Comprobando…",
      noAnswerInCheck: "Sin respuesta en la última comprobación",
      answeredInCheck: "Respondida en esta comprobación",
      siteMentioned: "Se mencionó su sitio web",
      showEvidence: "Ver evidencia",
      hideEvidence: "Ocultar evidencia",
      removeQuestionLabel: "Dejar de seguir: {question}",
      evidenceExcerpt: "Lo que dijo la respuesta",
      evidenceExcerptNote: "Solo se guarda la frase que nombra su negocio, no la respuesta completa.",
      evidencePosition: "Su posición",
      evidencePositionValue: "N.º {position} entre los negocios que recomendó la respuesta",
      evidenceNotRecommended: "No está entre los negocios que recomendó la respuesta",
      evidenceWebsite: "La dirección de su sitio web",
      evidenceWebsiteYes: "Mencionada en la respuesta",
      evidenceWebsiteNo: "No mencionada en la respuesta",
      evidenceOthers: "Otros negocios nombrados, en orden",
      evidenceNoOthers: "No se nombró a ningún otro negocio.",
      evidenceAssistant: "Asistente consultado",
      evidenceChecked: "Comprobada",
      evidenceHistory: "Resultados anteriores",
      evidenceNoHistory: "Es el primer resultado guardado para esta pregunta.",
      evidenceStale: "Esta respuesta es de una comprobación anterior. La última comprobación, el {date}, no devolvió una respuesta nueva para esta pregunta.",
      evidenceMissed: "La última comprobación no devolvió una respuesta nueva para esta pregunta, así que este es su resultado anterior.",
      removeTitle: "¿Dejar de seguir esta pregunta?",
      removeBody: "También se eliminan sus respuestas guardadas y su historial, y la puntuación se vuelve a calcular sin ella. No se puede deshacer.",
      removeConfirm: "Dejar de seguir",
      removing: "Eliminando…",
      methodTitle: "Qué se mide",
      methodHelp: "Cómo funciona una comprobación y qué significa cada cifra.",
      methodAskTitle: "Cómo funciona una comprobación",
      methodAskBody: "Cada pregunta seguida se plantea a un asistente de IA en una conversación nueva, sin nombrar su negocio. Después se lee la respuesta para listar, en orden, los negocios que recomienda.",
      methodRecordTitle: "Qué se guarda",
      methodRecordBody: "Si su negocio está entre ellos y en qué posición, la frase que lo nombra, los demás negocios nombrados y si aparece la dirección de su sitio web. La respuesta completa no se guarda.",
      methodScoreTitle: "Cómo se calcula la puntuación",
      methodScoreBody: "Una pregunta comprobada vale 100 cuando le nombran en primer lugar, menos cuanto más abajo en la lista (unos {second} en segundo lugar, {third} en tercero y {fourth} en cuarto) y 0 cuando no le nombran. La puntuación de visibilidad es la media de la última respuesta a cada pregunta comprobada. Las preguntas nunca comprobadas no cuentan.",
      methodCompareTitle: "Comparaciones",
      methodCompareBody: "El cambio se mide frente a la comprobación anterior, puntuada con sus propias respuestas. Las respuestas separadas por más de una hora pertenecen a comprobaciones distintas. Si las dos comprobaciones cubrieron preguntas diferentes, parte del cambio se debe a eso.",
      methodScheduleTitle: "Cuándo se hacen las comprobaciones",
      methodScheduleBody: "Cuando un propietario o un editor pulsa {action}, un número limitado de veces por hora, y automáticamente una vez por semana. Las respuestas llegan pregunta a pregunta en unos minutos.",
      methodAssistantsTitle: "Asistentes consultados",
      methodAssistantsBody: "Las respuestas guardadas hasta ahora proceden de: {names}.",
    },
    backlinks: {
      title: "Enlaces desde otros sitios web",
      joinHelp: "Google confía más en un sitio web cuando otros enlazan a él. Mencione otro negocio en sus artículos para ganar un crédito y gástelo para conseguir una mención en el sitio de otra persona.",
      capLabel: "Menciones que incluirá cada mes",
      capHelp: "Mantenga este número bajo. Una página llena de enlaces a otros negocios resulta sospechosa para Google.",
      join: "Unirse",
      leave: "Salir",
      inTheNetwork: "En la red",
      creditsAvailable: "créditos disponibles",
      received: "Enlaces recibidos",
      receivedFlow: "Mencionado en otros artículos \u2192 Consiga enlaces \u2192 Gaste créditos",
      givenTitle: "Enlaces concedidos",
      givenFlow: "Publique artículos \u2192 Conceda enlaces \u2192 Gane créditos",
      whichPage: "¿A cuál de sus páginas se debe enlazar?",
      suggestMyPages: "Sugerir mis páginas",
      readingSitemap: "Leyendo su sitemap…",
      anchorLabel: "Texto preferido (opcional)",
      anchorPlaceholder: "blanqueamiento dental en Dublín",
      requesting: "Solicitando…",
      requestLink: "Solicitar enlace (1 crédito)",
      noRequests: "Todavía no ha recibido enlaces",
      noRequestsHelp: "Añada arriba, en Red de socios, las páginas a las que quiere recibir enlaces. El equipo de RepGet los coloca en artículos relevantes de socios; un enlace consume sus créditos solo cuando se verifica que está activo.",
      noneGiven: "Todavía ninguno. El equipo de RepGet puede colocar el enlace de un socio relevante en uno de sus artículos antes de publicarlo; usted gana sus créditos cuando se verifica que está activo.",
      sourceArticle: "Artículo de origen",
      sourceArticleHint: "El artículo de otro sitio web que enlaza al suyo. Ábralo para ver el enlace activo.",
      customerWebsite: "Sitio web del cliente",
      customerWebsiteHint: "El sitio web de la red que publicó el enlace.",
      creditsUsed: "Créditos usados",
      creditsUsedHint: "Créditos gastados en este enlace. Se devuelven íntegros si el enlace se retira.",
      yourArticleHint: "Su artículo que contiene el enlace.",
      destinationWebsite: "Sitio web de destino",
      destinationWebsiteHint: "El sitio web al que enlaza su artículo.",
      creditsEarned: "Créditos ganados",
      creditsEarnedHint: "Créditos que le dio este enlace, para gastarlos en enlaces hacia su propio sitio.",
      onceLive: "+{n} al activarse",
      held: "{n} reservados",
      cancelRequest: "Cancelar solicitud",
      untitledArticle: "Artículo sin título",
      joined: "Ya está en la red",
      leftNetwork: "Ha salido de la red",
      requestSaved: "Solicitud guardada - esperando un sitio adecuado",
      requestCancelled: "Solicitud cancelada, crédito liberado",
      statusPending: "Buscando un sitio web",
      statusMatched: "Esperando su próximo artículo",
      statusLive: "Activo",
      statusCancelled: "Cancelado",
      statusRemoved: "Retirado - crédito devuelto",
      hosting: "Aloja hasta {cap} enlaces al mes ({used} usados). {sites} sitio disponible para enlazarle.|Aloja hasta {cap} enlaces al mes ({used} usados). {sites} sitios disponibles para enlazarle.",
      reserved: " ({n} reservados)",
    },
    dashboard: {
      noWebsite: "Todavía no hay ningún sitio web conectado",
      noWebsiteHelp: "Añada su sitio web y empezaremos a encontrar los términos de búsqueda que usan sus clientes.",
      addWebsite: "Añadir sitio web",
      couldNotLoad: "No pudimos cargar este sitio web",
      couldNotLoadHelp: "Inténtelo de nuevo o elija otro sitio web.",
      overview: "Resumen SEO",
      openWebsite: "Abrir sitio web",
      performing: "Cómo está funcionando {domain} en las búsquedas.",
      sharedBadge: "Compartido con usted · {role}",
      ownerPlanInactive: "Este sitio web está en pausa",
      ownerPlanInactiveHelp:
        "El plan de {domain} no está activo, así que no se puede crear nada nuevo. Pida al propietario del sitio web que lo renueve.",
      invitesTitle: "Le han invitado",
      inviteBody: "{name} le invita a trabajar en {domain} como {role}.",
      inviteBodyNoName: "Tiene una invitación para trabajar en {domain} como {role}.",
      roleAnEditor: "editor",
      roleAViewer: "lector",
      acceptInvite: "Aceptar invitación",
      inviteAccepted: "Ahora tiene acceso a {domain}",
    },
    calendar: {
      changeTopic: "Cambiar tema",
      addInstructions: "Añadir instrucciones",
      removeFromPlan: "Quitar del plan",
      instructionsPlaceholder: "Cualquier cosa que este artículo deba tratar o evitar.",
      previousMonth: "Mes anterior",
      nextMonth: "Mes siguiente",
      savedInstructions: "Guardado - lo usaremos al escribir",
      removedFromPlan: "Quitado del plan",
      writingStarted: "Redacción iniciada - tarda unos minutos",
    },
    addons: {
      moreCredits: "Más créditos de enlace",
      moreCreditsHelp: "Su plan incluye créditos cada mes. Compre más si se le acaban - estos no caducan.",
      termsPill: "Compra única · Los créditos no caducan",
      oneTime: "Compra única",
      neverExpire: "Los créditos no caducan",
      useAnytime: "Úselos cuando quiera",
      buyThis: "Comprar",
      buyCredits: "Comprar {n} créditos",
      unavailable: "No disponible",
      checkoutFailed: "No se pudo iniciar el pago. Inténtelo de nuevo.",
      yourPurchases: "Sus compras",
      added: "Añadido",
      delivered: "Entregado",
      inProgress: "En curso",
      requestQuote: "Solicitar presupuesto",
      quoteHelp: "Le damos un presupuesto tras revisar su auditoría.",
      title: "Complementos",
      subtitle: "Compras puntuales además de su plan.",
      perCredit: "{price} por crédito",
      quoteFrom: "Desde {price}. Le damos un presupuesto tras revisar su auditoría.",
      servicesTitle: "Servicios",
      showingRecent: "Se muestran sus {count} compras más recientes.",
    },
    referral: {
      referSomeone: "Recomiende a alguien",
      linkLabel: "Su enlace de recomendación",
      copy: "Copiar",
      copied: "Copiado",
      copyFailed: "No se pudo copiar. Seleccione el enlace y cópielo manualmente.",
      linkCopied: "Enlace copiado",
      creditsEarned: "Créditos ganados",
      waitingToConvert: "Pendientes de convertir",
      signedUpNotPaying: "Registrados, aún sin pagar",
      peopleReferred: "Personas que ha recomendado",
      someoneReferred: "Alguien a quien recomendó",
      notEligible: "No elegible",
      waiting: "En espera",
      cardDescription: "Comparta su enlace. Cuando alguien a quien recomiende pague su primer mes, recibirá {credits} créditos de enlaces.",
      joinedWithName: "{name} · se unió el {date}",
      joined: "Se unió el {date}",
      noWebsiteJoined: "Aún sin sitio web · se unió el {date}",
      creditsBadge: "+{count} créditos",
      linkHelp: "Las personas que se registren con este enlace cuentan como recomendaciones suyas.",
      peopleReferredStat: "Personas recomendadas",
      noReferralsYet: "Todavía nadie se ha registrado con su enlace.",
      showingRecent: "Se muestran sus {count} recomendaciones más recientes.",
      rewardedOn: "créditos añadidos el {date}",
      unavailable: "No se han podido cargar los datos de sus recomendaciones. Recargue la página para volver a intentarlo.",
    },
    keys: {
      updatePlugin: "WordPress tiene el plugin {version}. La versión 1.7 se conecta con un botón, muestra para qué cuenta de RepGet publica y se actualiza sola: descárguela y, en WordPress, vaya a Plugins → Añadir nuevo → Subir plugin y elija “Reemplazar el actual por el subido”.",
      keyCopied: "Clave copiada",
      keyCopyFailed: "No se pudo copiar. Seleccione la clave y cópiela manualmente.",
      keyRevoked: "Clave revocada",
      newKeyLabel: "Su nueva clave de integración",
      openWordPress: "Abrir mi WordPress",
      neverUsed: "Nunca usada",
      pluginTitle: "Plugin de WordPress",
      pluginHelp: "Instale nuestro plugin, conéctelo con un clic y los artículos se publicarán aquí automáticamente.",
      copyNowHelp: "Solo guardamos una versión cifrada, así que no se puede consultar después. Si la pierde, revóquela y cree una nueva.",
      newKey: "Nueva clave",
      keyNotePlaceholder: "¿Para qué es esta clave? (opcional)",
      nextSteps: "En WordPress, abra RepGet en el menú, pegue esta clave y pulse Save and connect.",
      connectingIn: "Conectando {domain} en el espacio de trabajo “{workspace}”.",
      stepInstall: "1. Instale el plugin",
      stepInstallHelp: "Descárguelo y luego súbalo y actívelo en WordPress (Plugins → Añadir nuevo → Subir plugin). Omita este paso si ya está instalado.",
      stepConnect: "2. Conecte",
      stepConnectHelp: "Abre su WordPress listo para conectar. Pulse allí Finish connecting to RepGet (Save and connect en plugins anteriores a 1.7): no hay nada que copiar.",
      connectButton: "Conectar WordPress",
      reconnectButton: "Conectar de nuevo",
      waitingTitle: "Esperando a WordPress…",
      waitingHelp: "En la pestaña de WordPress que abrimos, pulse Finish connecting to RepGet (o Save and connect). Si WordPress le pide iniciar sesión, hágalo y pulse Abrir WordPress de nuevo.",
      stalledHelp: "¿Sigue esperando? Si su WordPress ya dice Connected, está usando otra clave, por ejemplo de otra cuenta de RepGet o de una prueba. Al terminar en la pestaña que abrimos, pasa a esta cuenta.",
      openAgain: "Abrir WordPress de nuevo",
      copyInstead: "Copiar la clave",
      popupBlocked: "Su navegador bloqueó la pestaña nueva. Use Abrir WordPress de nuevo, o copie la clave y péguela en WordPress.",
      connectedTitle: "Conectado",
      lastCheckIn: "Última conexión: {date}",
      connectedToast: "WordPress está conectado",
      alsoIn: "También tiene {domain} en {workspaces}. Un sitio WordPress solo puede publicar para uno de ellos: lo decide la clave guardada en WordPress.",
      madeByConnect: "Creada con Conectar WordPress",
      advancedTitle: "Claves (avanzado)",
      advancedHelp: "Cada instalación de WordPress guarda una clave. Solo las necesita para conectar otra instalación a mano o para que una instalación deje de publicar (Revocar).",
      keyReplaced: "Esa clave se reemplazó o revocó antes de que WordPress la usara. Pulse Conectar WordPress de nuevo.",
      waitingResumed: "Esperando a que WordPress use la clave creada hace un momento. Si cerró esa pestaña de WordPress, pulse Conectar WordPress de nuevo.",
      gaveUp: "Se dejó de esperar. Si terminó en WordPress, recargue esta página; si no, pulse Conectar WordPress de nuevo.",
      notActiveHelp: "Si WordPress dice que no tiene permiso para acceder a esa página, el plugin aún no está activo: haga el paso 1 y pulse Abrir WordPress de nuevo.",
      madeByHand: "Añadida a mano",
      quotedName: "“{name}”",
    },
    partnerNetwork: {
      title: "Red de socios",
      subtitle: "Controla cómo participa tu web en la red de enlaces de RepGet.",
      participationTitle: "Participación en la red",
      participationHelp: "Participa en la red de socios de RepGet para alojar enlaces relevantes y recibir enlaces a tus páginas.",
      enabled: "Activada",
      disabled: "Desactivada",
      whatTitle: "Qué hace",
      whatBody: "El equipo de RepGet coloca enlaces relevantes desde artículos de socios hacia las páginas que indiques, y puede colocar enlaces de socios en tus artículos antes de publicarlos. Tu espacio gana créditos por cada enlace que alojas y gasta créditos por cada enlace que recibes, solo cuando el enlace se verifica publicado. No tienes que elegir socios ni aprobar cada enlace.",
      offNote: "Si la desactivas, no se organizan enlaces nuevos. Los enlaces ya colocados se mantienen y se siguen verificando y acreditando.",
      inReview: "{n} de tus artículos están en revisión con el equipo de RepGet.",
      ratingTitle: "Autoridad mínima",
      ratingHelp: "La autoridad mínima que debe tener un sitio que te enlace.",
      ratingUnconfigured: "Aún no disponible: la autoridad de los sitios de la red no se mide, así que no se puede exigir un mínimo. El equipo de RepGet revisa a mano cada sitio que enlaza.",
      targetsTitle: "Páginas objetivo",
      targetsHelp: "Elige y prioriza qué páginas de tu web deben recibir enlaces.",
      addTarget: "Añadir página objetivo",
      urlLabel: "Dirección de la página",
      noteLabel: "Qué es esta página (opcional)",
      priorityLabel: "Prioridad",
      high: "Alta",
      medium: "Media",
      low: "Baja",
      moveUp: "Subir",
      moveDown: "Bajar",
      remove: "Quitar",
      noTargets: "Aún no hay páginas objetivo. Añade las páginas a las que más quieres enlaces.",
      targetAdded: "Página objetivo añadida",
      saved: "Guardado",
      turnedOn: "Estás en la Red de socios",
      turnedOff: "Has salido de la Red de socios",
      creditsLine: "{available} créditos disponibles · {reserved} reservados",
      add: "Añadir",
      cancel: "Cancelar",
      ratingMetric: "Se mide con la Autoridad de dominio (0-100) del sitio que enlaza.",
      ratingNone: "Sin mínimo",
      ratingNoneHelp: "Cualquier socio relevante puede enlazarte; el equipo de RepGet revisa cada sitio a mano.",
      ratingSliderLabel: "Autoridad de dominio mínima",
      ratingCurrent: "Solo enlaces de sitios con Autoridad de dominio {n} o superior",
      ratingScaleOnly: "Su plan llega hasta {cap}. Una Autoridad de dominio superior a {cap} se incluye en el plan Scale.",
      ratingSave: "Guardar mínimo",
      ratingSaved: "Mínimo guardado",
      ratingNoAccess: "Aún no disponible: por ahora no se puede medir la Autoridad de dominio. El equipo de RepGet revisa a mano cada sitio que enlaza.",
    },
    reports: {
      subnavLabel: "Secciones de backlinks",
      navOverview: "Resumen",
      navEarned: "Backlinks recibidos",
      navHosted: "Enlaces alojados",
      navCredits: "Actividad de créditos",
      authorityLabel: "Autoridad de dominio",
      authorityValueAria: "Autoridad de dominio {value} de {max}",
      authorityUpdated: "Actualizado el {date}",
      authorityStale: "Del {date}; pendiente de actualizar",
      authorityCollecting: "Se está recopilando",
      authorityNoAccess: "Aún no disponible",
      authorityNoData: "Aún no hay datos de este sitio",
      authorityError: "No se pudo recopilar; se reintentará",
      authorityNotConfigured: "Aún no configurado",
      authorityWhat: "¿Qué es esto?",
      authorityHelp: "Una puntuación de 0 a 100 basada en los sitios que enlazan a un dominio. No es tu puntuación de salud del sitio.",
      authorityDetail: "Autoridad de dominio {value}/{max}, medida el {date}",
      authorityUnavailableDetail: "Aún no disponible",
      rankStaleTitle: "Autoridad de dominio - de hace más de 30 días",
      unknownShort: "n/d",
      unknownRank: "autoridad desconocida",
      issueHosted: "A {count} de tus artículos le falta el enlace de un socio: no gana créditos|A {count} de tus artículos les falta el enlace de un socio: no ganan créditos",
      issueHostedHelp: "No se encontró el enlace en el artículo publicado tras varias comprobaciones. Restáuralo y pide una nueva comprobación.",
      issueReceived: "{count} enlace a tu sitio no apareció en la página del socio: no se te cobró|{count} enlaces a tu sitio no aparecieron en las páginas de los socios: no se te cobró",
      issueReceivedHelp: "Los créditos solo se gastan cuando se verifica que el enlace está activo. El equipo de RepGet lo revisa con el socio.",
      reviewResolve: "Revisar y resolver",
      dismiss: "Descartar",
      issueFilterGiven: "Se muestran los enlaces no encontrados en tus artículos publicados. Restaura cada enlace y usa «Comprobar de nuevo».",
      issueFilterReceived: "Se muestran los enlaces no encontrados en la página del socio. No se cobró nada por ellos.",
      issueNofollowHosted: "{count} enlace de un socio en tus artículos está marcado nofollow: no aporta valor SEO|{count} enlaces de socios en tus artículos están marcados nofollow: no aportan valor SEO",
      issueNofollowHostedHelp: "Los buscadores ignoran los enlaces nofollow o sponsored. Edita la entrada, quita nofollow / sponsored del enlace del socio y pide una nueva comprobación.",
      issueNofollowReceived: "{count} enlace a tu sitio está marcado nofollow en la página del socio|{count} enlaces a tu sitio están marcados nofollow en las páginas de los socios",
      issueNofollowReceivedHelp: "Estos enlaces están activos pero aportan poco valor SEO. Se ha pedido al propietario del sitio que los haga seguidos.",
      issueFilterNofollowGiven: "Se muestran los enlaces de socios marcados nofollow en tus artículos publicados. Quita nofollow / sponsored de cada enlace y usa «Comprobar de nuevo».",
      issueFilterNofollowReceived: "Se muestran los enlaces a tu sitio que la página del socio marca nofollow. Se ha pedido al propietario del sitio que los corrija.",
      nofollowBadge: "Nofollow",
      overviewTitle: "Resumen de backlinks",
      overviewIntro: "Tu cartera de enlaces, tu saldo de créditos y los ajustes que sigue el equipo de RepGet al colocar enlaces para ti.",
      portfolioTitle: "Cartera de backlinks",
      verifiedBacklinks: "backlink verificado|backlinks verificados",
      referringDomains: "de {count} sitio web|de {count} sitios web",
      strongestLink: "Fuente más fuerte",
      strongestHelp: "La Autoridad de dominio más alta entre los sitios que te enlazan con un enlace verificado.",
      last30Days: "Últimos 30 días",
      newInWindowHelp: "Enlaces verificados por primera vez en los últimos 30 días (UTC).",
      estimatedValue: "Valor equivalente estimado",
      estimateNotConfigured: "Estimación no configurada",
      estimateNotConfiguredHelp: "RepGet solo muestra una estimación en dinero cuando su equipo ha publicado las tarifas y sus fuentes. Hasta entonces no se muestra ninguna cifra en lugar de una inventada.",
      howEstimated: "¿Cómo se estima?",
      estimateMethod: "Política de valoración v{version} ({currency}), vigente desde el {date}: una tarifa por enlace verificado según la Autoridad de dominio del sitio que enlaza. Fuentes: {sources}. Es una estimación de lo que costarían enlaces equivalentes, no dinero ahorrado ni ganado.",
      unvaluedLinks: "{count} enlace verificado no tiene tarifa aplicable y no se incluye.|{count} enlaces verificados no tienen tarifa aplicable y no se incluyen.",
      mostRecentLinks: "Enlaces más recientes",
      colVerified: "Verificado",
      verifiedDateHelp: "El día en que el enlace se vio activo por primera vez.",
      noVerifiedYet: "Aún no hay enlaces verificados. Aparecerán aquí cuando el verificador los vea activos.",
      pipeline: "{publication} pendientes de publicar · {verification} pendientes de verificar",
      seeAllBacklinks: "Ver todos los backlinks",
      creditsCardTitle: "Créditos de backlinks",
      creditActivity: "Actividad de créditos",
      creditsAvailableLine: "disponibles · {reserved} reservados para enlaces en curso · saldo {balance}",
      recoverFromArticles: "Recuperar créditos de {count} artículo|Recuperar créditos de {count} artículos",
      buyCredits: "Comprar créditos de enlaces",
      creditsHowItWorks: "Ganas créditos cuando se verifica que el enlace de un socio en tu artículo está activo, y los gastas cuando se verifica un enlace a tu sitio. Mientras se coloca un enlace, sus créditos quedan reservados; si después se retira un enlace verificado, se devuelven.",
      creditsScopeNote: "Los créditos pertenecen a tu espacio de trabajo y los comparten todos sus sitios.",
      creditsOwnerOnly: "Los créditos pertenecen al espacio de trabajo propietario de este sitio y solo los ven sus miembros.",
      receivedSectionTitle: "Enlaces a tu sitio",
      receivedFlow: "Colocados en artículos de socios → verificados → créditos gastados",
      givenSectionTitle: "Enlaces que alojas",
      givenFlow: "Colocados en tus artículos → verificados → créditos ganados",
      seeAllCount: "Ver {count} enlace|Ver los {count} enlaces",
      earnedTitle: "Backlinks recibidos",
      earnedIntro: "Todos los enlaces que tus páginas han recibido a través de la red de socios, con su origen, las palabras enlazadas y el estado de verificación.",
      hostedTitle: "Enlaces alojados",
      hostedIntro: "Enlaces de socios colocados en tus artículos. Cada uno gana créditos cuando se verifica activo en tu artículo publicado.",
      statusFilterLabel: "Filtrar por estado",
      tabAll: "Todos",
      tabVerified: "Verificados",
      tabPending: "Pendientes",
      tabRefunded: "Reembolsados",
      typeLabel: "Tipo",
      typeAll: "Tipo: todos",
      typeManaged: "Colocado por el equipo de RepGet",
      typeExchange: "Intercambio (asignación automática)",
      resultCount: "{count} enlace|{count} enlaces",
      recoverFrom: "Recuperar créditos de {count} enlace|Recuperar créditos de {count} enlaces",
      recoverQueued: "Se ha solicitado {count} comprobación. Solo se ganan créditos si el enlace se encuentra activo.|Se han solicitado {count} comprobaciones. Solo se ganan créditos si los enlaces se encuentran activos.",
      searchLabel: "Buscar enlaces",
      searchPlaceholder: "Sitio, página o palabras enlazadas",
      dateFrom: "Desde",
      dateTo: "Hasta",
      apply: "Aplicar",
      clearFilters: "Quitar filtros",
      dateMeaning: "Las fechas están en UTC y muestran el último paso del enlace: verificado, retirado, publicado o colocado.",
      colDate: "Fecha",
      colLink: "Enlace",
      colDestination: "Destino",
      colAuthority: "Autoridad de dominio",
      colValue: "Valor est.",
      colCredits: "Créditos",
      colAiCitation: "Citas de IA",
      colStatus: "Estado",
      colDetails: "Detalles",
      aiCitationHelp: "Cuántas veces la página con este enlace se citó en tus comprobaciones de visibilidad en IA (últimos 90 días).",
      aiNotMeasured: "Sin medir: no se hicieron comprobaciones de visibilidad en IA en los últimos 90 días o la página aún no está publicada.",
      aiCitations: "{count} cita|{count} citas",
      aiCitationsDetail: "Citada en {count} respuesta de IA de tus comprobaciones (últimos 90 días)|Citada en {count} respuestas de IA de tus comprobaciones (últimos 90 días)",
      emptyFiltered: "Ningún enlace coincide con estos filtros.",
      emptyReceived: "Aún no hay enlaces a tu sitio. El equipo de RepGet los coloca en artículos de socios; aparecen aquí en cuanto se coloca uno.",
      emptyGiven: "Aún no hay enlaces de socios en tus artículos.",
      unknownWebsite: "Sitio desconocido",
      untitled: "Artículo sin título",
      dateUnknown: "Fecha no registrada",
      valueNotApplicable: "Se valora una vez verificado",
      showDetails: "Mostrar detalles de {site}",
      hideDetails: "Ocultar detalles de {site}",
      loading: "Cargando…",
      sortable: "ordenable",
      sortedAsc: "orden ascendente",
      sortedDesc: "orden descendente",
      paginationLabel: "Páginas",
      showingRange: "Mostrando {first}-{last} de {total}",
      perPage: "Por página",
      prev: "Anterior",
      next: "Siguiente",
      pageOf: "Página {page} de {pages}",
      valueFootnote: "Los valores equivalentes estimados usan la política de valoración v{version} ({currency}); son estimaciones, no dinero ahorrado.",
      lcVerified: "Verificado",
      lcAwaitingPublication: "Pendiente de publicar",
      lcAwaitingVerification: "Pendiente de verificar",
      lcNotFound: "No encontrado: sin cargo",
      lcRemoved: "Retirado: reembolsado",
      lcWithdrawn: "Retirado antes de publicar: sin cargo",
      lcUnknown: "Estado desconocido",
      eventVerified: "verificado",
      eventRemoved: "retirado",
      eventPublished: "publicado",
      eventPlaced: "colocado",
      eventUnknown: "-",
      creditSettled: "{n} gastados",
      creditEarned: "+{n} ganados",
      creditReserved: "{n} reservados",
      creditPending: "+{n} al verificarse",
      creditRefunded: "{n} reembolsados",
      creditReversed: "{n} revertidos",
      creditNone: "Sin cargo",
      dSourceArticle: "Artículo de origen",
      dYourArticle: "Tu artículo",
      dSourceSite: "Sitio que enlaza",
      dDestinationSite: "Sitio de destino",
      dYourPage: "Tu página",
      dDestinationPage: "Página de destino",
      dAnchor: "Palabras enlazadas",
      dType: "Tipo de colocación",
      dRel: "Atributos del enlace en la página",
      dPublished: "Publicado",
      dFirstVerified: "Primera verificación",
      dRemoved: "Retirado",
      dLastCheck: "Última comprobación",
      dAuthority: "Autoridad de la fuente",
      dValue: "Valor estimado",
      dAiCitation: "Citas de IA",
      dCredits: "Créditos de este enlace",
      opensNewTab: "(se abre en una pestaña nueva)",
      notPublishedYet: "Aún no publicado",
      anchorHidden: "Se muestra cuando se publique el artículo del socio",
      relUnknown: "Desconocido (aún no visto activo)",
      relFollowed: "Ninguno (enlace seguido)",
      relUnfollowed: "{rel} - no seguido: aporta poco valor SEO",
      notYet: "Todavía no",
      checkAlive: "enlace encontrado",
      checkMissing: "enlace no encontrado",
      checkError: "no se pudo acceder a la página (no cuenta)",
      fvFromCheck: "Según la primera comprobación correcta (registrada antes de que se guardaran las fechas de verificación).",
      fvFromLedger: "Según el apunte de liquidación (registrado antes de que se guardaran las fechas de verificación).",
      valueDetail: "{value}, según la política de valoración y la Autoridad de dominio de la fuente",
      noCreditMovements: "No se han movido créditos por este enlace.",
      adviceNotFoundGiven: "Falta el enlace en tu artículo publicado. Vuelve a ponerlo (o republica el artículo) y elige «Comprobar de nuevo»: los créditos solo se ganan cuando se ve activo.",
      adviceNotFoundReceived: "El artículo del socio no incluye el enlace. No se te cobró; el equipo de RepGet lo revisa.",
      adviceAwaitingVerification: "El artículo está publicado. El enlace se comprueba automáticamente, normalmente en un día; los créditos solo se mueven cuando se ve.",
      adviceAwaitingPublicationGiven: "Este enlace está en uno de tus artículos aún sin publicar. Saldrá con el artículo, tras la revisión del equipo de RepGet.",
      adviceAwaitingPublicationReceived: "Colocado en un artículo de un socio aún sin publicar. Sus créditos están reservados, no gastados.",
      adviceRemoved: "El enlace se verificó y después se confirmó que había desaparecido y se retiró, así que sus créditos se reembolsaron.",
      recheck: "Comprobar de nuevo",
      recheckRecover: "Ya lo he restaurado: comprobar de nuevo",
      recheckQueued: "Comprobación solicitada. Se hará en breve; los créditos solo se mueven si el enlace se ve activo.",
      recheckRevived: "Vuelve a estar pendiente de verificación. Si el enlace se encuentra activo, los créditos se liquidarán entonces.",
      recheckAlreadyQueued: "Ya hay una comprobación en cola.",
      recheckCooldown: "Comprobado hace poco; podrás pedirlo de nuevo en unas horas.",
      creditsTitle: "Actividad de créditos",
      creditsIntro: "Todos los créditos que tu espacio de trabajo ha recibido, reservado, gastado o recuperado, de más reciente a más antiguo.",
      creditsSummary: "Resumen",
      creditsAvailable: "Disponibles",
      creditsReservedLabel: "Reservados",
      creditsReservedHelp: "Retenidos para enlaces en curso; solo se gastan cuando el enlace se verifica activo.",
      creditsBalance: "Saldo",
      creditsEarnedTotal: "Ganados (total)",
      creditsSpentTotal: "Gastados (total)",
      creditsRefundedTotal: "Reembolsados (total)",
      colEntry: "Movimiento",
      colWebsite: "Sitio web",
      creditsEmpty: "Aún no hay actividad de créditos.",
      workspaceWide: "Espacio de trabajo",
      ledgerPlanGrant: "Asignación mensual del plan",
      ledgerLinkGiven: "Ganado: enlace alojado verificado",
      ledgerLinkReceived: "Gastado: enlace a tu sitio verificado",
      ledgerRefund: "Reembolso",
      ledgerPurchase: "Comprados",
      ledgerReferral: "Recompensa por recomendación",
      ledgerReferralReversed: "Recompensa por recomendación revertida: pago reembolsado",
      ledgerReversal: "Revertido: enlace alojado retirado",
      ledgerAdjustment: "Ajuste",
      sectionUnavailable: "No se pudo cargar esta sección. Actualiza la página; si continúa, contacta con soporte.",
      websiteAuthority: "Autoridad del sitio",
      backlinksHeading: "Backlinks",
      openBacklinks: "Abrir backlinks",
      partnerNetworkLabel: "Red de socios",
      getCredits: "Obtener créditos",
      verifiedBacklinksLabel: "Backlinks verificados",
      availableCredits: "Créditos disponibles",
      ownerOnlyShort: "Solo propietario",
      chartActiveLinks: "Enlaces verificados a tu sitio",
      unitLinks: "enlaces",
      noData: "sin datos",
      chartInstructions: "Usa las flechas izquierda y derecha para moverte entre días.",
      undatedLinks: "{count} enlace verificado antiguo no tiene fecha registrada y no aparece en el gráfico.|{count} enlaces verificados antiguos no tienen fecha registrada y no aparecen en el gráfico.",
      todaysArticle: "Artículo de hoy",
      nothingWritten: "Aún no hay nada escrito. Tu primer artículo aparecerá aquí cuando empiece tu plan de contenidos.",
      openContentPlan: "Abrir el plan de contenidos",
      stPublished: "Publicado",
      stAwaitingReview: "Con el equipo de RepGet",
      stAwaitingReviewHelp: "El equipo de RepGet lo está revisando antes de publicarlo. No se publica nada hasta que lo aprueben.",
      stApproved: "Aprobado",
      stApprovedHelp: "Aprobado: se publica en su día previsto, {date}, según tus ajustes de publicación.",
      stApprovedNoDate: "Aprobado: se publica según tus ajustes de publicación.",
      stScheduled: "Programado",
      stScheduledHelp: "Se publica el {date}.",
      stDraft: "Borrador",
      stDraftHelp: "Esperando a que lo publiques.",
      stWriting: "Redactándose",
      stFailed: "Requiere atención",
      searchVolume: "Volumen de búsqueda",
      perMonth: "{n}/mes",
      difficulty: "Dificultad",
      articleType: "Tipo de artículo",
      intentCommercial: "Comercial",
      intentTransactional: "Transaccional",
      intentInformational: "Informativo",
      intentNavigational: "Navegacional",
      whyThisTopic: "¿Por qué este tema?",
      whyWithVolume: "Apunta a «{keyword}», que se busca unas {volume} veces al mes.",
      whyKeyword: "Apunta a «{keyword}».",
      winsTitle: "Logros de 7 días",
      winsCount: "{count} logro|{count} logros",
      noWins: "Nada nuevo en los últimos 7 días.",
      winPublished: "Publicado: {title}",
      winPublishedDetail: "Publicado por primera vez en tu sitio esta semana",
      winLinksReceived: "{count} enlace nuevo a tu sitio verificado|{count} enlaces nuevos a tu sitio verificados",
      winLinksReceivedDetail: "Enlaces desde artículos de socios, vistos activos",
      winLinksGiven: "{count} enlace alojado verificado: créditos ganados|{count} enlaces alojados verificados: créditos ganados",
      winLinksGivenDetail: "Enlaces de socios en tus artículos, vistos activos",
      winAudit: "Salud del sitio revisada: puntuación {score}",
      winAuditDetail: "Lo que frena al sitio en Google",
      winClicks: "{count} clic desde Google (todo el sitio)|{count} clics desde Google (todo el sitio)",
      winClicksDetail: "Datos de Search Console hasta el {date}",
      view: "Ver",
      bestArticles: "Mejores artículos",
      bestArticlesHelp: "Tus artículos de RepGet que más clics reciben desde Google (últimos 30 días disponibles).",
      openGoogleResults: "Abrir resultados de Google",
      connectSearchConsole: "Conecta Google Search Console para ver el rendimiento de tus artículos.",
      connect: "Conectar",
      noArticleTraffic: "Search Console aún no ha registrado clics ni impresiones de tus artículos de RepGet.",
      colArticle: "Artículo",
      colClicks: "Clics",
      colImpressions: "Impresiones",
      colPosition: "Posición",
      colSessions: "Sesiones (GA)",
      colFirstPublished: "Primera publicación",
      colKeywordCpc: "Palabra clave · CPC (USD)",
      searchConsoleThrough: "Datos de Search Console hasta el {date}.",
      analyticsThrough: "Datos de Google Analytics hasta el {date}.",
      connectAnalytics: "Conecta Google Analytics para ver las sesiones de tus artículos.",
      achievements: "Logros",
      valueHeadline: "Valor equivalente estimado: {value}",
      valueHeadlineUnconfigured: "Valor estimado aún no configurado",
      achievementsIntro: "Lo que tus artículos y la red de socios han logrado en este periodo. El equipo de RepGet revisa los artículos y coloca los enlaces a mano.",
      lastNDays: "Últimos {days} días (UTC)",
      plusArticles: "+{n} artículos",
      plusBacklinks: "+{n} backlinks",
      rangeLabel: "Periodo",
      rangeDays: "{days} días",
      range12m: "12 meses",
      viewLabel: "Vista",
      chart: "Gráfico",
      details: "Detalles",
      metricLabel: "Métrica del gráfico",
      trafficValue: "Valor del tráfico",
      trafficValueHelp: "Lo que costarían en anuncios los clics a tus artículos (estimación)",
      backlinkValue: "Valor de backlinks",
      backlinkValueHelp: "Enlaces verificados por primera vez en el periodo (estimación)",
      articlesPublished: "Artículos publicados",
      articlesPublishedHelp: "Primera vez publicados en tu sitio (los borradores y las ediciones no cuentan)",
      articleImpressions: "Impresiones de artículos",
      articleImpressionsHelp: "Cuántas veces aparecieron tus artículos de RepGet en Google",
      articleClicks: "Clics en artículos",
      articleClicksHelp: "Clics desde Google a tus artículos de RepGet (Search Console)",
      articleSessions: "Sesiones en artículos",
      articleSessionsHelp: "Visitas a tus artículos de RepGet (Google Analytics)",
      notConnected: "No conectado",
      notConfiguredShort: "No configurado",
      currencyMismatch: "Requiere una política en USD",
      websiteHealth: "Salud del sitio",
      websiteHealthHelp: "Tu última auditoría técnica; distinta de la autoridad",
      noSeries: "Aún no hay datos de esta métrica en el periodo.",
      utcDays: "Los días son días naturales en UTC.",
      unitArticles: "artículos",
      unitClicks: "clics",
      unitImpressions: "impresiones",
      unitSessions: "sesiones",
      breakdownCaption: "Tus artículos de RepGet en este periodo, por clics desde Google",
      breakdownShowing: "Se muestran las {shown} primeras de {total} páginas. Los totales de arriba incluyen todas las páginas.",
      unknownPublicationDates: "{n} artículos anteriores están publicados, pero no se registró cuándo se publicaron por primera vez, así que no se cuentan en ningún periodo.",
      noPublishedArticles: "Aún no hay artículos de RepGet publicados.",
      methodologyTitle: "Cómo se calculan estas cifras",
      methodologyPolicy: "Política de valoración v{version}, en {currency}, vigente desde el {date}.",
      methodologyCpc: "Valor del tráfico = clics de Search Console de cada artículo × coste por clic de su palabra clave, según tu investigación de palabras clave para tu mercado (USD).",
      methodologyFixed: "Valor del tráfico = clics de Search Console a tus artículos de RepGet × {rate} por clic.",
      methodologyNoTraffic: "El tráfico no se valora con esta política.",
      methodologyBacklinks: "Valor por enlace verificado, según la Autoridad de dominio del sitio que enlaza: {bands}.",
      methodologyNoBacklinks: "Los backlinks no se valoran con esta política.",
      methodologySources: "Fuentes: {sources}",
      methodologyExcluded: "Nunca se cuentan: borradores, enlaces pendientes de publicar o verificar, enlaces no encontrados o retirados, enlaces internos ni el crédito «Powered by RepGet».",
      methodologyNotSavings: "Son estimaciones de lo que costarían anuncios o enlaces equivalentes; no son dinero ahorrado, ingresos ni un rendimiento garantizado.",
      searchPerformance: "Rendimiento en buscadores",
      websiteTraffic: "Tráfico del sitio",
      aiSearch: "Búsqueda con IA",
      aiNoChecks: "No hay comprobaciones de visibilidad en IA en este periodo.",
      openAiVisibility: "Abrir visibilidad en IA",
      aiChecks: "Respuestas revisadas",
      aiMentioned: "Te mencionan",
      aiCited: "Citan tu sitio",
      aiReferralNotMeasured: "Aún no se miden las visitas que llegan desde asistentes de IA; estas son respuestas que RepGet revisó por ti.",
      googleTraffic: "Tráfico de Google",
      connectSearchConsoleTraffic: "Conecta Google Search Console para ver clics, impresiones y posición.",
      siteClicks: "Clics",
      siteImpressions: "Impresiones",
      avgPosition: "Posición media",
      vsPrevious: "vs. anterior",
      siteWideThrough: "Todo el sitio, últimos {days} días; datos de Search Console hasta el {date}.",
      uncertainTitle: "El último intento de publicación no recibió respuesta de tu sitio",
      uncertainHelp: "Puede que la entrada ya exista. Revisa tu sitio: si el artículo está, no hace falta nada; si no, confírmalo abajo y vuelve a publicar. Esperamos para no arriesgar una entrada duplicada.",
      uncertainConfirm: "No está en mi sitio: permitir publicar de nuevo",
      uncertainConfirmed: "Registrado. Puedes volver a publicar el artículo.",
      lcNotFoundGiven: "No encontrado: sin créditos ganados",
      lcRemovedGiven: "Retirado: créditos revertidos",
    },
    image: {
      altLabel: "Descripción de la imagen",
      altPlaceholder: "Qué muestra la imagen",
      promptLabel: "Describa una imagen diferente",
      promptPlaceholder: "Una ceremonia nocturna iluminada con velas, sin personas",
      noRegensLeft: "Ha agotado las regeneraciones de este artículo. Suba su propia imagen.",
      imageReady: "Nueva imagen lista",
      imageUploaded: "Imagen subida",
      imageRemoved: "Imagen eliminada",
    },
    profile: {
      businessDetails: "Datos del negocio",
      detailsHelp: "Estos datos definen sus palabras clave y cada artículo que escribimos.",
      correctAnything: " Corrija cualquier cosa que hayamos entendido mal.",
      fillsIn: " Se rellenan solos en cuanto hayamos analizado el sitio - también puede introducirlos ahora.",
      brandName: "Nombre de la marca",
      brandNamePlaceholder: "Acme S.L.",
      industry: "Sector",
      industryPlaceholder: "Clínica dental",
      country: "Mercado principal",
      countryPlaceholder: "España",
      audience: "Público objetivo",
      audiencePlaceholder: "Propietarios de 30 a 55 años",
      mainLanguage: "Idioma principal",
      description: "Descripción",
      descriptionPlaceholder: "Qué hace el negocio, en una o dos frases.",
      saveDetails: "Guardar datos",
      saving: "Guardando…",
      detailsSaved: "Datos guardados",
      pageTitle: "Ajustes del negocio",
      pageDescription: "Los datos del negocio detrás de {domain}. La investigación de palabras clave y cada artículo que escribimos se basan en ellos.",
      identityTitle: "Identidad del negocio",
      identityHelp: "Quién es usted y a qué se dedica.",
      marketTitle: "Mercado y público",
      marketHelp: "Dónde vende, a quién quiere llegar y el idioma en el que se escriben sus artículos.",
      descriptionTitle: "Descripción del negocio",
      descriptionHelp: "Qué hace el negocio y qué lo distingue, con sus propias palabras.",
      competitorsTitle: "Competidores",
      competitorsHelp: "Negocios que compiten con usted por los mismos clientes. Las sugerencias proceden del análisis de su sitio web, así que revíselas: elimine las que no sean competidores reales y añada los que falten.",
      brandNameHint: "El nombre por el que le conocen sus clientes.",
      industryHint: "A qué se dedica, en pocas palabras.",
      marketPlaceholder: "Spain",
      countryHint: "El país en el que vende principalmente, escrito en inglés (por ejemplo, Spain), para que la investigación de palabras clave analice el país correcto.",
      marketNotEnglish: "La investigación de palabras clave solo reconoce nombres de países escritos en inglés.",
      marketUseEnglish: "Usar {country}",
      articleLanguage: "Idioma de los artículos",
      articleLanguageHint: "Los artículos de este sitio web se escriben en este idioma. No cambia su panel.",
      dashboardLanguageNote: "Su panel se muestra en {language}, un ajuste personal de su cuenta.",
      dashboardLanguageLink: "Cambiar el idioma del panel",
      chooseLanguage: "Elija un idioma",
      unknownLanguage: "{language} (valor actual)",
      audienceHint: "A quién quiere llegar: por ejemplo, su edad, su situación o lo que necesitan.",
      descriptionHint: "Bastan unas frases: sus principales productos o servicios, dónde trabaja y qué le diferencia.",
      notSet: "Sin definir",
      unsavedBadge: "Sin guardar",
      saveBusinessDetails: "Guardar datos",
      saveScope: "Incluye todas las secciones salvo Competidores, que se guardan en cuanto añade o elimina uno.",
      saveError: "Algo ha fallado. Sus cambios siguen aquí, así que puede intentarlo de nuevo.",
      checklistNeedsBoth: "Añada una descripción y elija un idioma de los artículos para completar este paso de su lista de lanzamiento.",
      checklistNeedsDescription: "Añada una descripción para completar este paso de su lista de lanzamiento.",
      checklistNeedsLanguage: "Elija un idioma de los artículos para completar este paso de su lista de lanzamiento.",
      analysingTitle: "Estamos analizando su sitio web",
      analysingBody: "Cuando termine el análisis, rellenará el nombre de la marca, el sector, el mercado, el público y la descripción, y sustituirá lo que contengan ahora estos campos. Se conserva el idioma de los artículos que elija.",
      analysingBodyReadOnly: "Cuando termine el análisis, rellenará estos datos.",
      refresh: "Actualizar",
      analysisFailedTitle: "No hemos podido analizar su sitio web",
      analysisFailedBody: "Estos datos no se han rellenado automáticamente. Puede introducirlos usted.",
      analysisFailedBodyReadOnly: "Estos datos no se han rellenado automáticamente.",
      analysisFailedRetry: "Puede reintentar el análisis desde la página Sitios web.",
      goToWebsites: "Ir a Sitios web",
      competitorCount: "1 competidor|{count} competidores",
      manualGroup: "Añadidos por usted",
      suggestedGroup: "Sugeridos por el análisis",
      suggestedGroupHelp: "Encontrados al analizar su sitio web, no elegidos por usted. Elimine los que no sean competidores reales.",
      suggestedGroupHelpReadOnly: "Encontrados al analizar el sitio web.",
      competitorsEmpty: "Todavía no hay competidores.",
      competitorsEmptyAnalysed: "El análisis de su sitio web no sugirió ningún competidor.",
      competitorsEmptyAnalysing: "Las sugerencias aparecerán aquí cuando termine el análisis de su sitio web.",
      competitorsTruncated: "Se muestran los primeros {count} competidores.",
      addCompetitor: "Añadir un competidor",
      addCompetitorHint: "La dirección de su sitio web, por ejemplo rival.com. Comprobamos que el sitio existe antes de añadirlo, lo que puede tardar unos segundos.",
      competitorPlaceholder: "rival.com",
      addCompetitorButton: "Añadir",
      checkingShort: "Comprobando…",
      checkingCompetitor: "Comprobando {domain}…",
      competitorAdded: "{domain} añadido.",
      removingCompetitor: "Eliminando {domain}…",
      competitorRemoved: "{domain} eliminado.",
      visitCompetitor: "Abrir {domain} en una pestaña nueva",
      removeCompetitor: "Eliminar {domain}",
      competitorRequired: "Introduzca una dirección web.",
      competitorInvalid: "Introduzca una dirección web como rival.com.",
      competitorOwnSite: "Ese es su propio sitio web.",
      competitorDuplicate: "{domain} ya está en su lista.",
      competitorNotPublic: "Esa dirección no es un sitio web público.",
      competitorBlocked: "No se pueden añadir como competidores redes sociales ni grandes plataformas como Google, Amazon o Wikipedia.",
      competitorUnreachable: "No hemos podido acceder a {domain}. Compruebe la ortografía e inténtelo de nuevo.",
      actionFailed: "Algo ha fallado. Inténtelo de nuevo.",
    },
    setup: {
      launchChecklist: "Lista de lanzamiento",
      allLive: "Todo está activo",
      finishSetup: "Termine la configuración",
      allLiveHelp: "Todos los sistemas necesarios están activos. Vaya al panel para ver sus datos en directo.",
      stepsLeft:
        "Queda {n} paso para que todo funcione solo.|Quedan {n} pasos para que todo funcione solo.",
    },
    common: {
      cancel: "Cancelar",
      done: "Hecho",
      edit: "Editar",
      preview: "Vista previa",
      connect: "Conectar",
      checking: "Comprobando…",
      discard: "Descartar",
      revoke: "Revocar",
      failed: "Fallido",
      images: "Imágenes",
      rewrite: "Reescribir",
      tryAgain: "Reintentar",
      somethingWentWrong: "Algo ha salido mal en esta página",
      remove: "Quitar",
      upload: "Subir",
      disconnect: "Desconectar",
      competitors: "Competidores",
      websiteHealth: "Salud del sitio web",
      checkingWebsite: "Comprobando su sitio web",
      nothingNeedsAttention: "No hay nada que requiera atención. Vuelva a comprobarlo tras hacer cambios.",
      requestQuote: "Solicitar presupuesto",
      wantUsToFix: "¿Quiere que se lo arreglemos?",
      saveProperties: "Guardar propiedades",
      appeared: "Apariciones",
      noImageYet: "Todavía sin imagen",
      notScheduled: "Sin programar",
      nothingPlanned: "Nada planificado para este día.",
      defaultsAreFine: "¿Le parecen bien? Puede cambiarlas cuando quiera.",
      keepDefaults: "Mantener los valores por defecto",
      noPlanYet: "Aún no hay plan de contenidos",
      noPlanYetHaveKeywords: "Sus términos de búsqueda están listos, pero aún no se ha creado el plan que los convierte en artículos. Créelo ahora.",
      buildPlan: "Crear mi plan de contenidos",
      requestLink: "Solicitar un enlace",
      admin: "Administración",
      articleLanguageHelp: "Sus artículos se escriben en este idioma.",
      namedInstead: "Mencionados en su lugar con más frecuencia",
      mostPopular: "Más popular",
      receiptInPayPal: "Recibo en PayPal",
      noCharge: "Sin cargo",
      close: "Cerrar",
      copied: "Copiado",
      openMenu: "Abrir menú",
      changeLanguage: "Cambiar idioma",
      brandHome: "Inicio de RepGet",
      skipped: "Omitido",
      hideSetupSteps: "Ocultar los pasos",
      setupProgress: "Progreso de la configuración",
      secureCheckout: "Pago seguro",
      skipForNow: "Omitir por ahora",
      verifiedCustomer: "Cliente verificado",
      searchYourImages: "Buscar en sus imágenes",
      critical: "Crítico",
      suggestion: "Sugerencia",
      warning: "Advertencia",
      importData: "Importar datos",
      auditIntro: "Revisamos sus páginas y enumeramos qué frena su sitio web en Google, indicando la página exacta de cada problema.",
      losingTrafficIntro: "Páginas que reciben menos clics, o aparecen menos en Google, que hace un mes. Según sus datos de Search Console.",
      noCompetitorsFound: "No encontramos ninguno en su sitio. Añada los rivales que conozca y los usaremos para detectar huecos de contenido.",
      competitorsHelp: "Quién más aparece cuando los compradores buscan en su sector. Los usamos para encontrar huecos de contenido y los términos que merecen la pena.",
      connectWebsiteFirst: "Conecte primero su sitio web en Ajustes → Integraciones. Hasta entonces, los artículos esperan en RepGet.",
      generationHelp: "Cómo se escriben sus artículos y qué ocurre con ellos cuando están listos.",
      altHelp: "Se lee en voz alta a quienes usan lector de pantalla, y la leen los buscadores.",
      featuredImageHelp: "La imagen de la parte superior del artículo, y la que se muestra al compartirlo.",
      factsOnePerLine: "Uno por línea. Son los únicos datos concretos que afirmaremos sobre su negocio; todo lo demás queda general.",
      voiceBehindArticles: "La voz detrás de cada artículo. Integrada desde su propio panel, así que un solo Guardar cubre toda la pantalla.",
      creditsExplainer: "Los créditos se añaden a su cuenta y pueden gastarse en construcción de enlaces. No son dinero y no se pueden retirar. Una recomendación cuenta cuando la persona recomendada paga su primer mes, y solo se pueden recomendar cuentas nuevas, cada una una sola vez.",
      articleInProgress: "Este artículo ya no se puede reprogramar ni editar porque está en curso.",
      researchIntro: "Encontraremos los términos que usan sus clientes, los agruparemos por temas y los convertiremos en un plan de artículos que publicar.",
      noCreditsLeft: "No le quedan créditos. Incluya un enlace para que alguien gane uno, o espere a la asignación del mes que viene.",
      promoCodesHelp: "Los códigos promocionales se introducen al pagar con tarjeta. PayPal no admite códigos de descuento.",
      write: "Escribir",
      writingAndPublishing: "Redacción y publicación",
      featuredImage: "Imagen destacada",
      backlinksLabel: "Enlaces entrantes",
      uploadLabel: "Subir",
      aiAssistantsTracked: "Asistentes de IA supervisados",
      freshArticles: "Artículos nuevos",
      toSetUp: "Por configurar",
      trustedByBusinesses: "La confianza de negocios de todo el mundo",
      weekly: "Cada semana",
      twoMinutes: "2 min",
      notAvailable: "Esta página no está disponible",
      notAvailableHelp: "Puede que la página se haya movido o que pertenezca a un espacio de trabajo del que no forma parte.",
      backToDashboard: "Volver al panel",
      viewWebsites: "Ver sus sitios web",
      goToDashboard: "Ir al panel",
      setUp: "Configurar",
      setUpHelp: "Le guiamos por el proceso de lanzamiento paso a paso.",
      manageBilling: "Gestionar facturación",
      manageInPayPal: "Gestionar en PayPal",
      payWithPayPal: "Pagar con PayPal",
      noPlans: "Todavía no hay planes disponibles.",
      billingHistory: "Historial de facturación",
      billingHistoryHelp: "Todos los pagos de suscripción de este espacio de trabajo.",
      invoice: "Factura",
      downloadPlugin: "Descargar el plugin",
      pluginGuide: "Guía de instalación",
      cantFindIntegration: "¿No encuentra su integración?",
      adaptive: "Adaptable",
      custom: "Personalizado",
      wordRange: "Entre 300 y 5000.",
      findOpportunities: "Buscar oportunidades",
      noOpportunities: "Todavía no se han encontrado oportunidades",
      losingTraffic: "Perdiendo tráfico",
      notWrittenHere: "No escrito aquí",
      nothingLosing: "Nada está perdiendo tráfico",
      nothingLosingHelp: "Ninguna página perdió el 30% o más de sus clics, y ninguna bajó en Google. Las páginas con menos de 10 clics al mes se revisan por su posición.",
      losingClicksTitle: "Pierden clics",
      losingClicksHelp: "Perdieron el 30% o más de sus clics, partiendo de al menos 10 en los 28 días anteriores.",
      losingVisibilityTitle: "Pierden visibilidad",
      losingVisibilityHelp: "Bajaron 3 o más posiciones en Google, o aparecieron en la mitad de búsquedas. Se revisan las páginas mostradas al menos 100 veces, así que también se vigilan las que tienen pocos clics.",
      watchTitle: "Para vigilar",
      watchHelp: "Entre un 10 y un 30% menos de clics. Aún no es un descenso claro.",
      noClickLosses: "Ninguna página perdió el 30% o más de sus clics.",
      clicksChange: "{before} → {after} clics",
      percentDown: "bajó un {pct}%",
      percentUp: "subió un {pct}%",
      rankingChange: "posición {before} → {after}",
      shownChange: "mostrada {before} → {after} veces",
      windowNote: "Los últimos 28 días que Google ha publicado, hasta el {date}, frente a los 28 anteriores.",
      writeAutomatically: "Escribir artículos automáticamente",
      daysToWrite: "Días en los que escribir",
      publishWithoutAsking: "Publicar sin preguntarme",
      whenFinished: "Cuando un artículo esté terminado",
      finishedReview: "Guardarlo en RepGet para que lo revise",
      finishedReviewHelp: "Nada llega a su sitio web hasta que pulse Publicar en el artículo.",
      finishedDraft: "Enviarlo a mi sitio como borrador",
      finishedDraftHelp: "Aparece en su CMS como borrador el día previsto. Usted lo publica allí.",
      finishedLive: "Publicarlo el día previsto",
      finishedLiveHelp: "Se publica en su sitio web el día previsto, sin que tenga que hacer nada.",
      firstArticleNote: "Su primer artículo se envía en cuanto está listo, elija lo que elija, para que vea cómo quedan los artículos en su sitio. Mientras su web esté en la Red de socios, el equipo de RepGet revisa antes cada artículo - también el primero - y ninguno se envía antes de su día previsto.",
    },
    nav: {
      dashboard: "Panel",
      setUp: "Configuración",
      plannedArticles: "Artículos planificados",
      backlinkExchange: "Red de enlaces",
      websiteHealth: "Salud del sitio",
      googleResults: "Resultados de Google",
      googleConnect: "Google Search y Analytics",
      aiVisibility: "Visibilidad en IA",
      losingTraffic: "Tráfico en caída",
      settings: "Ajustes",
      addons: "Complementos",
      main: "Principal",
      referralProgram: "Programa de recomendación",
      business: "Negocio",
      articleSettings: "Ajustes de artículos",
      integrations: "Integraciones",
      account: "Cuenta",
      billing: "Facturación",
      settingsSections: "Secciones de ajustes",
    },
    status: {
      pending: "Pendiente de empezar",
      crawling: "Leyendo su sitio",
      researching: "Buscando oportunidades",
      generated: "Contenido planificado",
      ready: "Listo",
      queued: "En espera",
      running: "En curso",
      completed: "Completado",
      planned: "Planificado",
      draft: "Borrador",
      generating: "Escribiendo",
      published: "Publicado",
      publish: "Publicando",
      scheduled: "Programado",
      connected: "Conectado",
      disconnected: "Sin conectar",
      live: "Activo",
      removed: "Retirado",
      matched: "Emparejado",
      active: "Activo",
      inactive: "Inactivo",
      cancelled: "Cancelado",
      expired: "Caducado",
      paid: "Pagado",
      rewarded: "Recompensado",
      refunded: "Reembolsado",
      fulfilled: "Entregado",
      failed: "Requiere atención",
      rejected: "Rechazado",
      missing: "Falta",
    },
    editorUi: {
      bold: "Negrita",
      italic: "Cursiva",
      strikethrough: "Tachado",
      heading: "Título",
      subheading: "Subtítulo",
      bulletedList: "Lista con viñetas",
      numberedList: "Lista numerada",
      quote: "Cita",
      code: "Código",
      addLink: "Añadir enlace",
      removeLink: "Quitar enlace",
      insertImage: "Insertar imagen",
      undo: "Deshacer",
      redo: "Rehacer",
      chooseImage: "Elija una imagen",
      articleHtml: "HTML del artículo",
      noImageSelected: "Ninguna imagen seleccionada",
      pickOneBelow: "Elija una de abajo o suba la suya.",
      closeImagePicker: "Cerrar el selector de imágenes",
      imageAlt: "Descripción de la imagen (texto alternativo)",
      imageAltPlaceholder: "Qué muestra la imagen",
      replaceImage: "Reemplazar imagen",
      saveImage: "Guardar",
      noMatches: "No hay coincidencias.",
      noPicturesYet: "Aún no hay imágenes: suba una para empezar.",
      toolbarLabel: "Formato del texto",
      groupText: "Estilo del texto",
      groupHeadings: "Encabezados",
      groupBlocks: "Listas y bloques",
      groupLinks: "Enlaces",
      groupMedia: "Imágenes",
      groupHistory: "Deshacer y rehacer",
      linkDialogTitle: "Añadir o cambiar un enlace",
      linkDialogHelp: "Pegue la dirección completa, por ejemplo https://example.com/pagina.",
      linkUrlLabel: "Dirección del enlace",
      linkApply: "Aplicar",
      linkInvalid: "Escriba una dirección que empiece por https://, http://, mailto:, tel:, / o #.",
      htmlHint: "Está editando el HTML directamente. Todo lo que no sea seguro se elimina al guardar.",
      richHint: "El formato es sencillo para que encaje con el estilo de su sitio.",
      editHtml: "Editar HTML",
      backToEditor: "Volver al editor",
      htmlToolbarOff: "Los botones de formato están desactivados mientras edita el HTML.",
    },
    dash: {
      bestArticles: "Mejores artículos",
      bestArticlesHelp: "Sus páginas que traen más gente desde Google.",
      openGoogleResults: "Abrir resultados de Google",
      connectForPages: "Conecte Google Search Console para ver qué páginas suyas encuentra la gente.",
      clicks: "Clics",
      impressions: "Impresiones",
      position: "Posición",
      searchPerformance: "Rendimiento en búsquedas",
      websiteTraffic: "Tráfico del sitio",
      aiSearchTraffic: "Tráfico de búsquedas con IA",
      googleTraffic: "Tráfico de Google",
      vsLastMonth: "frente al mes pasado",
      averagePosition: "Posición media",
      connectForClicks: "Conecte Google Search Console para ver clics, impresiones y posición.",
      achievements: "Logros",
      achievementsHelp: "Todo esto ha ocurrido automáticamente desde que se unió.",
      last30Days: "Últimos 30 días",
      adSpendSaved: "Ahorro en publicidad",
      adSpendHelp: "Lo que costaría este tráfico en Google Ads.",
      backlinkCostSaved: "Ahorro en enlaces",
      showedUpHelp: "Con qué frecuencia apareció en Google.",
      visitorsFromArticles: "Visitantes desde artículos",
      siteHealth: "La salud de su sitio",
      siteHealthHelp: "Sobre 100, según su última comprobación.",
      websiteAuthority: "Autoridad del sitio",
      backlinks: "Enlaces entrantes",
      openBacklinks: "Abrir enlaces",
      backlinkExchange: "Red de enlaces",
      getCredits: "Conseguir créditos",
      verifiedBacklinks: "Enlaces verificados",
      availableCredits: "Créditos disponibles",
      noLinksYet: "Todavía no hay enlaces. Cuando otros sitios de la red enlacen al suyo, aparecerán aquí.",
      todaysArticle: "El artículo de hoy",
      nothingWrittenYet: "Todavía no hay nada escrito. Cuando su plan de contenidos esté listo, el artículo de hoy aparecerá aquí.",
      openContentPlan: "Abrir el plan de contenidos",
      searchVolume: "Volumen de búsqueda",
      difficulty: "Dificultad",
      articleType: "Tipo de artículo",
      whyThisTopic: "¿Por qué este tema?",
      view: "Ver",
      addAWebsite: "Añadir un sitio web",
      sharedWithYou: "Compartidos con usted",
      sharedSiteLabel: "Compartido con usted · {role}",
      roleEditor: "Editor",
      roleViewer: "Lector",
    },
    wpConnect: {
      title: "Conectar WordPress",
      signedInAs: "Sesión iniciada como {email}",
      goneTitle: "Esta conexión ha terminado",
      goneBody: "Caducó, se canceló o ya se usó. Vuelva a WordPress y pulse Connect to RepGet de nuevo.",
      otherBrowserTitle: "Esta conexión se abrió en otro lugar",
      otherBrowserBody: "Por su seguridad, una conexión solo puede completarse en el navegador que la abrió primero. Vuelva a WordPress y pulse Connect to RepGet de nuevo.",
      noneTitle: "{domain} aún no está en esta cuenta de RepGet",
      noneBody: "Añada primero {domain} como sitio web y luego pulse Connect to RepGet en WordPress de nuevo. Si está en otra cuenta de RepGet, inicie sesión en esa. Si WordPress funciona en una dirección distinta de la de su sitio web en RepGet (por ejemplo blog.example.com), conéctelo con una clave: en RepGet abra Integraciones → Plugin de WordPress → Claves (avanzado) → Nueva clave, y péguela en WordPress en Advanced: use an Integration Key.",
      addWebsite: "Añadir un sitio web",
      useOtherAccount: "Usar otra cuenta",
      confirmTitle: "¿Conectar {domain} a RepGet?",
      confirmBody: "El sitio WordPress en {site} publicará los artículos que RepGet escribe para el sitio web de abajo. Puede desconectarlo cuando quiera desde WordPress.",
      inWorkspace: "Espacio de trabajo “{workspace}”",
      movedWarning: "Este sitio WordPress está conectado a otra cuenta de RepGet. Si continúa, esa cuenta dejará de publicar aquí.",
      movedWarningNamed: "Este sitio WordPress está conectado a {domain} en el espacio de trabajo “{workspace}”. Si continúa, ese sitio web dejará de publicar aquí.",
      connect: "Conectar {domain}",
      connectAgain: "Volver a conectar {domain}",
      move: "Mover {domain} a “{workspace}”",
      cancel: "Cancelar",
      tooManyKeys: "Este sitio web ya tiene 5 claves. Revoque una que ya no use en Integraciones → Claves (avanzado) e inténtelo de nuevo.",
      notAllowed: "No puede conectar WordPress a ese sitio web con esta cuenta.",
    },
    auth: {
      redirecting: "Redirigiendo…",
      continueWithGoogle: "Continuar con Google",
      orContinueWithEmail: "O continuar con el correo",
      fullName: "Nombre completo",
      namePlaceholder: "Juan Pérez",
      email: "Correo electrónico",
      emailPlaceholder: "usted@ejemplo.com",
      password: "Contraseña",
      passwordHint: "Al menos 8 caracteres.",
      tooManyAttempts: "Demasiados intentos. Espere unos minutos y vuelva a intentarlo.",
      passwordTooLong: "Use como máximo 128 caracteres.",
      emailMeACode: "Envíenme un código por correo",
      usePasswordInstead: "Usar una contraseña",
      sendCode: "Enviarme un código",
      sendingCode: "Enviando su código…",
      codeLabel: "Código de acceso",
      codePlaceholder: "123456",
      codeHelp: "Hemos enviado un código de seis dígitos a {email}. Caduca en 10 minutos.",
      verifyCode: "Iniciar sesión",
      verifying: "Comprobando su código…",
      resendCode: "Enviar otro código",
      useDifferentEmail: "Usar otro correo",
      codeSent: "Revise su correo para ver el código.",
      codeNotSent: "No se ha podido enviar el código. Inténtelo de nuevo.",
      codeInvalid: "Ese código no es correcto o ha caducado.",
      enterEmailFirst: "Introduzca primero su correo electrónico.",
      organizations: "Organizaciones",
      loading: "Cargando…",
      createOrganization: "Crear organización",
      orgHelp: "Cada organización tiene sus propios sitios web, contenidos y facturación.",
      name: "Nombre",
      orgPlaceholder: "Acme Marketing",
      cancel: "Cancelar",
      notifications: "Notificaciones",
      markAllRead: "Marcar todo como leído",
      nothingYet: "Todavía nada. Le avisaremos aquí cuando sus artículos y auditorías estén listos.",
      unread: "Sin leer",
    },
    onboarding: {
      whatsYourWebsite: "¿Cuál es su sitio web?",
      websiteIntro: "Introduzca su sitio web y averiguaremos a qué se dedica su negocio, para quién es y por qué debería posicionarse.",
      websiteAddress: "La dirección de su sitio web",
      websitePlaceholder: "sunegocio.com",
      lookUpWebsite: "Analizar este sitio web",
      detected: "Detectado",
      addingWebsite: "Añadiendo su sitio web…",
      continueLabel: "Continuar",
      pressArrow: "Pulse la flecha para comprobar su sitio primero, o continúe directamente.",
      readingWebsite: "Leyendo su sitio web…",
      websiteFound: "Sitio web encontrado",
      enterAddressToSee: "Introduzca su dirección para ver qué encontramos.",
      regionNext: "Región y categoría a continuación",
      weWillUseWebsite: "Usaremos su sitio web para entender su negocio.",
      activateRepGet: "Activar RepGet",
      seeHowAiTalks: "Vea cómo habla la IA de su marca",
      trackQuestions: "Siga las preguntas que los clientes hacen a la IA antes de descubrir su empresa.",
      trackingOn: "Seguimiento activo",
      noAssistants: "Todavía no hay asistentes configurados en esta instalación. Las preguntas se guardan y se comprueban en cuanto haya uno.",
      questionsWorthTracking: "Preguntas que merece la pena seguir",
      suggestedFromSite: "Las hemos sugerido a partir de su sitio web y su mercado. Quite las que no encajen.",
      writingQuestions: "Redactando preguntas que harían sus clientes…",
      noQuestionsYet: "Todavía no hay preguntas. Añada una abajo o pida sugerencias.",
      addQuestionPlaceholder: "Añada una pregunta que harían sus clientes",
      addQuestion: "Añadir pregunta",
      writing: "Redactando…",
      suggestMore: "Sugerir más",
      getStarted: "Empezar",
      setupProgress: "Progreso de la configuración",
      readingNow: "Estamos leyendo su sitio web. Esto suele tardar un minuto o dos.",
      view: "Ver",
      goToDashboard: "Ir a su panel",
      searchOpportunities: "Oportunidades de búsqueda",
      topicClusters: "Grupos temáticos",
      publishingPlan: "Plan de publicación",
      articlesContentBacklinks: "Artículos, contenidos y enlaces",
      heresWhatWellBuild: "Esto es lo que vamos a construir",
      thenOnChecklist: "Después, en su lista de configuración",
      buildMyPlan: "Crear mi plan de contenidos",
      starting: "Empezando…",
      takesFewMinutes: "Tarda unos minutos. Puede continuar mientras lo preparamos en segundo plano.",
      connectGoogle: "Conectar Google",
      analyticsTellUs: "Analytics y Search Console nos dicen qué artículos funcionan, para escribir más de lo que da resultado.",
      connectedChangeLater: "Conectado. Puede cambiarlo más adelante en Integraciones.",
      openingGoogle: "Abriendo Google…",
      whyWeAsk: "Por qué se lo pedimos",
      readPerformanceOnly: "Solo leemos el rendimiento: clics, impresiones y sesiones de su propio sitio. Nunca publicamos, cambiamos ni borramos nada en su cuenta de Google, y puede desconectarla cuando quiera.",
      connected: "Conectado",
      plansUnavailable: "Los planes no están disponibles ahora mismo. Vuelva a intentarlo en breve.",
      growthEngineReady: "Su motor de crecimiento está listo",
      plan: "Plan",
      payYearly: "Pago anual",
      paypalNoTrial: "PayPal inicia su plan de inmediato, sin la prueba gratuita.",
      cancelAnyTime: "Cancele cuando quiera. Puede introducir un código promocional al pagar.",
      whatsIncluded: "Qué incluye",
      secureByStripe: "Pago seguro con Stripe. Los datos de su tarjeta nunca llegan a nosotros.",
      paymentTakingLonger: "Su pago se ha realizado. Activar el plan está tardando más de lo habitual.",
      activatingNow: "Gracias. Estamos activando su plan; esto suele tardar unos segundos.",
      goToMyWebsite: "Ir a mi sitio web",
      checkBilling: "Ver la facturación",
      extraordinaryBusinesses: "Los negocios extraordinarios merecen mayor visibilidad.",
      chooseYourPlan: "Elija su plan",
      whatHappensSubscribe: "Qué ocurre en cuanto se suscribe",
      weResearchKeywords: "Investigamos sus palabras clave, creamos un calendario de contenidos a la medida de su plan y empezamos a escribir. Poco después tendrá su primer artículo para revisar.",
      contentAndBacklinks: "Contenidos y enlaces",
      addYourWebsite: "Añada su sitio web",
    },
  },
};

const fr: Messages = {
  nav: {
    howItWorks: "Comment ça marche",
    freeCheck: "Analyse gratuite",
    tools: "Outils",
    pricing: "Tarifs",
    blog: "Blog",
    faq: "FAQ",
    about: "À propos",
    signIn: "Se connecter",
    getStarted: "Commencer",
    contact: "Contact",
    successStories: "Témoignages",
    getStartedCta: "Commencer",
    platform: "Plateforme",
    platformHeading: "Découvrir la plateforme",
    platformItems: [
      {
        title: "Moteur de contenu",
        detail:
          "Planifiez et générez des articles conçus pour développer la visibilité organique.",
      },
      {
        title: "Réseau d'autorité",
        detail:
          "Obtenez des backlinks pertinents et renforcez l'autorité de votre domaine.",
      },
      {
        title: "Intelligence du site",
        detail:
          "Repérez les problèmes techniques et SEO qui pèsent sur vos performances.",
      },
      {
        title: "Performance de recherche",
        detail: "Suivez positions, visibilité et résultats sur Google.",
      },
      {
        title: "Présence IA",
        detail:
          "Mesurez la fréquence à laquelle votre marque apparaît sur ChatGPT, Claude, Perplexity et la recherche IA.",
      },
      {
        title: "Récupération de trafic",
        detail:
          "Identifiez les pages en déclin avant que le trafic ne disparaisse.",
      },
    ],
  },
  footer: {
    tagline: "Des résultats SEO pour les petites entreprises, sans agence.",
    product: "Produit",
    legal: "Mentions légales",
    freeCheck: "Analyse gratuite de votre site",
    freeTools: "Outils gratuits",
    pricing: "Tarifs",
    blog: "Blog",
    faq: "FAQ",
    about: "À propos",
    contact: "Contact",
    backlinkExchange: "Échange de liens",
    publishers: "Monétisez votre blog",
    affiliate: "Recommander une entreprise",
    privacy: "Confidentialité",
    terms: "Conditions",
    refunds: "Remboursements",
  },
  home: {
    eyebrow: "Soyez classé. Soyez cité. Soyez recommandé.",
    title: "Positionnez-vous sur Google. Apparaissez dans les réponses IA",
    subtitle:
      "RepGet publie du contenu SEO, obtient des backlinks de qualité et construit l'autorité qui fait découvrir votre entreprise.",
    checkFree: "Analyser mon site gratuitement",
    getStarted: "Commencer",
    noCard: "Aucune carte requise pour la première analyse.",
    auditBand: "Offert avec votre analyse",
    auditItems: [
      {
        title: "Audit SEO et IA",
        body: "Voyez l'état de votre site, ce qui manque, et si les assistants IA vous mentionnent.",
      },
      {
        title: "Un plan concret",
        body: "Les changements qui comptent vraiment, dans l'ordre où il faut les faire.",
      },
      {
        title: "Votre premier lien",
        body: "Un lien d'une entreprise réelle d'un secteur proche, gagné et non acheté.",
      },
    ],
    auditPlaceholder: "Entrez votre site",
    auditAssurances: ["Sans créer de compte", "Rien à annuler"],
    checkMyWebsite: "Analyser mon site",
    howItWorks: "Comment ça marche",
    steps: [
      {
        title: "Analyse",
        body: "Nous lisons votre site, trouvons ce qui le freine et vérifions si les assistants IA le mentionnent.",
      },
      {
        title: "Connexion",
        body: "Reliez votre site - WordPress, Ghost, Shopify ou un webhook - pour que nous publiions à votre place.",
      },
      {
        title: "Croissance",
        body: "Nous cherchons, rédigeons et publions, puis vous montrons ce qui a réellement changé.",
      },
    ],
    problemsEyebrow: "Problèmes et solution",
    yourProblem: "Votre problème",
    ourSolution: "Notre solution",
    problems: [
      "La publicité payante épuise votre budget chaque mois, et s'arrête dès que vous arrêtez.",
      "Des heures perdues entre audits, mots-clés, contenu et une pile d'outils séparés.",
      "Les assistants IA recommandent vos concurrents, et vous ne le savez jamais.",
    ],
    solutionTitle: "Tout ce qu'il vous faut, au même endroit",
    solution: [
      "Audit SEO et préparation à l'IA",
      "Suivi de visibilité dans les assistants IA",
      "Recherche de mots-clés et de marché",
      "Articles rédigés pour vous et publiés automatiquement",
      "Liens gagnés auprès d'entreprises réelles",
    ],
    stackEyebrow: "Nous face à une pile d'outils",
    stackTitle: "Un abonnement remplace",
    stackTitleAccent: "toute votre panoplie SEO",
    stackSub:
      "Audit, visibilité IA, recherche, contenu, publication, liens et rapports : le tout au même endroit, pour moins cher que les outils séparément.",
    seePricing: "Voir les tarifs",
    replaces: [
      "Audit SEO et exploration du site",
      "Suivi de visibilité dans l'IA",
      "Recherche de mots-clés et de marché",
      "Articles rédigés et optimisés",
      "Publication sur votre CMS",
      "Création de liens",
      "Rapports Search Console et Analytics",
    ],
    publishesTitle: "Publie",
    publishesAccent: "directement",
    publishesTitleEnd: "sur votre site",
    publishesSub:
      "Connectez une fois. Aucun téléversement manuel, aucun copier-coller : les articles paraissent seuls sur votre site, avec leurs images.",
    publishesPlugin:
      "Notre extension WordPress se connecte avec une seule clé, et fonctionne même si votre hébergeur bloque l'API WordPress.",
    platformOther: "N'importe quel site via webhook",
    trackedTitle: "Vous voyez exactement ce qui a changé",
    trackedSub:
      "Pas un PDF mensuel. Un tableau de bord qui lit vos propres données Search Console et Analytics.",
    tracked: [
      { label: "Positions et clics", detail: "Depuis Search Console" },
      { label: "Visibilité IA", detail: "Si les assistants vous citent" },
      { label: "Liens obtenus", detail: "Vérifiés chaque jour" },
      { label: "Articles publiés", detail: "Et ce qu'ils ont donné" },
    ],
    pillars: [
      {
        title: "Publiez du contenu SEO",
        body: "Des articles de qualité générés et optimisés pour votre secteur.",
      },
      {
        title: "Obtenez de vrais backlinks",
        body: "Soyez cité sur des sites pertinents pour renforcer votre autorité.",
      },
      {
        title: "Suivez vos progrès",
        body: "Positions, trafic et résultats dans un tableau de bord simple.",
      },
      {
        title: "Gagnez du temps avec l'IA",
        body: "Laissez l'IA travailler pendant que vous vous concentrez sur votre activité.",
      },
    ],
    previewTitle: "Votre croissance, en pilote automatique.",
    previewSub:
      "Du contenu de qualité. De vrais backlinks. Plus de visibilité.",
    previewCaption:
      "Un tableau de bord d'exemple. Vos propres chiffres partent de zéro.",
    titleLead: "Positionnez-vous sur Google.",
    titleAccent: "Apparaissez dans les réponses IA.",
    heroCards: [
      { label: "Positions et clics", detail: "Depuis Search Console" },
      { label: "Visibilité IA", detail: "Si les assistants vous citent" },
      { label: "Croissance du trafic", detail: "Touchez plus de clients" },
      {
        label: "Visible dans les réponses IA",
        detail: "Présent là où ça compte",
      },
      { label: "Backlinks de qualité", detail: "Cité par de vrais sites" },
      { label: "Suivi des mots-clés", detail: "Voyez ce qui fonctionne" },
    ],
    joinGoogle: "Rejoindre avec Google",
    seeHow: "Voir comment ça marche",
    videoTitle: "Découvrez RepGet en deux minutes",
    videoSub:
      "Un court aperçu de ce qui se passe après avoir connecté un site.",
    videoComingSoon:
      "La vidéo de présentation est en cours d'enregistrement. En attendant, l'analyse gratuite vous montre la même chose sur votre propre site.",
    worksWithTitle: "Fonctionne avec les outils que vous utilisez déjà",
    networkEyebrow: "Un réseau de liens vérifié",
    networkTitle: "Un réseau de liens",
    networkTitleRest: "qui se renforce à chaque nouveau client.",
    networkHeading: "Échange de liens automatisé",
    networkPoints: [
      "Chaque client donne et reçoit des liens",
      "Les liens viennent d'entreprises d'un secteur proche, jamais sans rapport",
      "Placés dans de vrais articles, pas sur une page de liens",
      "Vérifiés chaque jour : si un lien disparaît, prévenez-nous et votre crédit revient",
    ],
    networkHowLink: "Comment fonctionne l'échange",
    pricingEyebrow: "Tarifs",
    pricingTitle: "Commencez petit.",
    pricingTitleAccent: "Grandissez quand vous êtes prêt.",
    pricingSub:
      "Une analyse gratuite pour commencer, sans engagement, et annulez quand vous voulez.",
    seeAllPlans: "Voir tout ce que comprend chaque formule",
    mostPopular: "Le plus choisi",
    tryItFirst: "Essayez d'abord",
    getStartedPlan: "Commencer",
    perMonth: " / mois",
    unavailable:
      "Les tarifs ne sont pas disponibles pour le moment. Merci de réessayer sous peu.",
    planArticles: "{n} article par mois|{n} articles par mois",
    planBacklinks: "Backlinks issus de notre réseau de partenaires",
    planPublishing: "Publication automatique sur WordPress, Shopify et plus",
    closingTitle: "Commencez à croître en pilote automatique dès aujourd'hui",
    closingSub:
      "Lancez une analyse gratuite de votre site et voyez ce qui le freine. Sans créer de compte.",
    cancelAnytime: "Annulez à tout moment",
    guarantee: "Garantie satisfait ou remboursé sous 14 jours",
  },
  pricing: {
    title: "Des tarifs simples",
    subtitle:
      "Tout est inclus dans chaque formule. La différence tient à ce que nous rédigeons pour vous chaque mois, et au nombre de backlinks que vous recevez de notre réseau de partenaires.",
    perMonth: " / mois",
    getStarted: "Commencer",
    mostPopular: "Le plus choisi",
    tryItFirst: "Essayez d'abord",
    starterTagline:
      "Essayez-nous avec un vrai article et un vrai lien avant de passer au niveau supérieur.",
    unavailable:
      "Les tarifs ne sont pas disponibles pour le moment. Merci de réessayer sous peu.",
    annualNote:
      "Les formules annuelles sont proposées après votre inscription, avec deux mois offerts. Annulez à tout moment : consultez notre",
    refundPolicy: "politique de remboursement",
    features: {
      articles: "{n} article rédigé par mois|{n} articles rédigés par mois",
      keywords: "{n} termes de recherche suivis",
      backlinks: "Backlinks issus de notre réseau de partenaires",
      audit: "Audit du site, pour des pages prêtes pour l'IA et Google",
      healthChecks: "Analyses de santé du site",
      publishing: "Publiez sur WordPress, Ghost ou Shopify",
    },
  },
  about: {
    metaTitle: "À propos",
    metaDescription: "Pourquoi RepGet existe et à qui il s'adresse.",
    title: "Des résultats SEO sans agence",
    intro: [
      "Un dentiste, un plombier ou un petit cabinet d'avocats sait qu'il devrait \"faire du SEO\". Ce que cela exige réellement, c'est quelqu'un pour la recherche de mots-clés, quelqu'un pour rédiger, quelqu'un qui comprend les audits techniques et quelqu'un pour obtenir des liens. Une agence regroupe tout cela pour quelques milliers par mois.",
      "La plupart des petites entreprises ne peuvent pas justifier une telle dépense : elles ne font donc rien, et restent invisibles précisément sur les recherches qui leur amèneraient des clients.",
      "Nous avons construit ceci pour faire ce travail automatiquement, à un prix qu'une petite entreprise peut réellement payer.",
    ],
    beliefTitle: "Ce en quoi nous croyons",
    beliefLead: "Ne recommander que ce que vous pouvez réellement gagner.",
    belief: [
      "Un terme recherché 12 000 fois par mois ne vous sert à rien si vous n'avez aucune chance de vous positionner dessus. Un terme recherché 300 fois, par quelqu'un prêt à acheter, peut vous amener un client le mois prochain.",
      "Ce principe est intégré au produit, pas seulement écrit ici. Notre score place délibérément les termes atteignables au-dessus des termes populaires, et évalue si la personne qui cherche a vraiment l'intention d'acheter. Notre appariement de liens refuse d'associer un dentiste à un site sans rapport, même quand les chiffres semblent bons.",
      "Un outil qui produit un travail impressionnant que personne ne trouvera jamais est pire qu'inutile : il coûte de l'argent et ne livre rien.",
    ],
    audienceTitle: "À qui cela s'adresse",
    audience:
      'Aux petites entreprises et aux commerces de proximité qui ont besoin de clients, pas de tableaux de bord. Vous ne devriez jamais avoir à apprendre ce que signifie "difficulté de mot-clé". Nous nous chargeons du jugement ; vous voyez un plan, les articles et ce qui a changé.',
  },
  successStories: {
    metaTitle: "Témoignages",
    metaDescription:
      "Ce que mesurent les clients RepGet : positions, visibilité IA, articles publiés et backlinks obtenus, et comment arrivent les premiers résultats.",
    eyebrow: "Témoignages",
    title:
      "Nous préférons vous montrer ce que nous mesurons plutôt que d'inventer un client.",
    intro:
      "RepGet est récent, et nous n'allons pas inventer une entreprise qui l'aurait utilisé ni arrondir les chiffres de quelqu'un pour une page de vente. Voici ce que le produit mesure réellement, et à quoi ressemblent honnêtement les premiers mois.",
    results: [
      {
        label: "Positions et clics",
        body: "Issus de votre propre Search Console, pas estimés. Vous voyez sur quelles requêtes vous avez progressé, et ce que cela a rapporté en clics.",
      },
      {
        label: "Visibilité IA",
        body: "Si ChatGPT, Claude et Perplexity citent votre entreprise quand on demande ce que vous vendez. Vérifié sur vos propres questions.",
      },
      {
        label: "Articles publiés",
        body: "Ce qui a été écrit, quand c'est paru et ce que cela a donné - pour qu'un mois de travail ait une réponse et pas seulement une facture.",
      },
      {
        label: "Backlinks obtenus",
        body: "De vrais liens dans de vrais articles sur les sites d'autres entreprises, vérifiés chaque jour. Si un lien disparaît, prévenez-nous et votre crédit vous est rendu.",
      },
    ],
    timelineTitle: "À quoi ressemblent les trois premiers mois",
    timelineIntro:
      "Honnêtement, y compris la partie où il ne s'est encore rien passé.",
    timeline: [
      {
        when: "Semaine un",
        body: "Nous explorons le site, trouvons les problèmes techniques qui le freinent et planifions un mois d'articles autour de ce que vos clients recherchent vraiment.",
      },
      {
        when: "Semaines deux à quatre",
        body: "Les articles paraissent selon votre calendrier. Les backlinks commencent à être placés à mesure que d'autres entreprises du réseau publient les leurs.",
      },
      {
        when: "À partir du deuxième mois",
        body: "Les données Search Console arrivent pour les premiers articles. C'est là que les positions commencent à bouger : le SEO ne paie pas en une semaine, et quiconque promet le contraire vend autre chose.",
      },
    ],
    ctaTitle: "Soyez le premier témoignage de cette page.",
    ctaBody:
      "Commencez par une analyse gratuite de votre site : une minute, sans frais. Si ce que nous trouvons mérite d'agir, les nouveaux comptes peuvent essayer RepGet gratuitement pendant {days} jours.",
    ctaPrimary: "Analyser mon site",
    ctaSecondary: "Voir les tarifs",
  },
  publishers: {
    metaTitle: "Rentabilisez votre blog",
    metaDescription:
      "Hébergez un article par mois pour une entreprise d'un secteur proche et gagnez des crédits à dépenser en liens vers votre propre site.",
    title: "Rentabilisez votre blog",
    intro:
      "Hébergez un article par mois pour une entreprise d'un secteur proche et gagnez des crédits à dépenser en liens vers votre propre site.",
    creditsTitle: "Des crédits, pas de l'argent",
    creditsBody:
      "Vous êtes rémunéré en crédits de liens, pas en argent. Un article hébergé rapporte un crédit, et un crédit vous obtient un lien depuis le site d'une autre entreprise. Si vous cherchez à être payé pour des articles invités, ce n'est pas cela - et il existe des places de marché pour ça.",
    steps: [
      {
        title: "Dites-nous de quoi parle votre site",
        body: "Votre sujet, votre langue et votre pays. Nous ne vous associons qu'à des entreprises d'un secteur proche.",
      },
      {
        title: "Choisissez combien d'articles par mois",
        body: "Jusqu'à vingt, la plupart commencent à trois. Vous pouvez suspendre ou partir quand vous voulez.",
      },
      {
        title: "Nous rédigeons l'article",
        body: "Un vrai article sur un sujet qui intéresse vos lecteurs, écrit pour votre site, avec un lien naturel dedans.",
      },
      {
        title: "Vous gagnez un crédit",
        body: "Un crédit par article hébergé, à dépenser en lien vers votre site depuis celui d'une autre entreprise.",
      },
    ],
    controlTitle: "Ce que vous contrôlez",
    rules: [
      {
        title: "Uniquement des sujets proches",
        body: "On ne vous demandera jamais d'héberger un contenu sans rapport avec votre site. Si nous ne pouvons pas établir que deux sites sont liés thématiquement, nous ne faisons pas l'association.",
      },
      {
        title: "Vous fixez la limite",
        body: "Entre un et vingt articles par mois, modifiable quand vous le souhaitez. À zéro, vous ne recevez plus de demandes.",
      },
      {
        title: "Vous gardez le contrôle éditorial",
        body: "Les articles arrivent en brouillon sur votre site. Publiez, modifiez ou refusez : rien ne paraît sans vous.",
      },
    ],
    suitsTitle: "À qui cela convient",
    suitsBody:
      "À une petite entreprise dont le blog publie déjà de temps en temps et qui veut des liens vers ses pages sans les payer. Si votre site n'a pas de lecteurs, héberger des articles n'y changera rien : les liens que vous gagnez valent ce que vaut votre site.",
    joinNote:
      "L'adhésion est incluse dans tous les forfaits. Activez-la dans les paramètres de votre site.",
    ctaPrimary: "Commencer",
    ctaSecondary: "Comment fonctionne l'échange",
  },
  affiliate: {
    metaTitle: "Parrainer une entreprise",
    metaDescription:
      "Partagez votre lien et gagnez des crédits quand une personne que vous parrainez paie son premier mois.",
    title: "Parrainez une entreprise, gagnez des crédits",
    intro:
      "Partagez votre lien. Quand une personne que vous parrainez paie son premier mois, les crédits arrivent sur votre compte.",
    steps: [
      {
        title: "Partagez votre lien",
        body: "Chaque compte a un lien. Vous le trouverez dans les Paramètres dès votre inscription.",
      },
      {
        title: "Elle s'inscrit et s'abonne",
        body: "Rien n'est dû tant qu'une personne ne fait qu'essayer le produit. Le parrainage compte quand elle paie son premier mois.",
      },
      {
        title: "Vous recevez vos crédits",
        body: "Les crédits arrivent automatiquement sur votre compte et servent aux liens vers votre site.",
      },
    ],
    termsTitle: "Les conditions, clairement",
    terms: [
      "La récompense est un crédit sur le compte, pas de l'argent. Elle n'est pas retirable.",
      "Un parrainage compte une fois que la personne parrainée a payé son premier mois.",
      "Seuls les nouveaux comptes peuvent être parrainés, et chacun une seule fois.",
      "Les crédits se dépensent en netlinking dans le produit.",
    ],
    ctaPrimary: "Commencer",
    ctaNote:
      "Votre lien de parrainage est dans les Paramètres dès que vous avez un compte.",
  },
  backlinkExchange: {
    metaTitle: "Comment fonctionne l'échange de liens",
    metaDescription:
      "Gagnez des liens vers votre site en publiant un article pour une autre entreprise. Uniquement des associations pertinentes, vérifiées chaque jour, crédits remboursés quand la disparition d'un lien est confirmée.",
    title: "Comment fonctionne l'échange de liens",
    intro:
      "Les liens se gagnent en en donnant. Vous hébergez un article pour une entreprise d'un secteur proche, et vous dépensez ce que vous gagnez en liens vers votre propre site.",
    steps: [
      {
        title: "Vous hébergez un article",
        body: "Nous rédigeons un article pour une autre entreprise d'un secteur proche et le publions sur votre site. C'est un vrai article sur un sujet qui intéresse vos lecteurs, pas une page de liens.",
      },
      {
        title: "Vous gagnez un crédit",
        body: "Héberger un article rapporte un crédit. Votre forfait inclut aussi des crédits chaque mois, vous pouvez donc commencer avant d'avoir hébergé quoi que ce soit.",
      },
      {
        title: "Vous le dépensez en lien",
        body: "Un crédit achète un lien vers votre site, intégré naturellement dans un article sur le site d'une autre entreprise d'un secteur proche.",
      },
    ],
    rulesTitle: "Les règles qui en font quelque chose d'utile",
    rules: [
      {
        title: "Uniquement des sujets proches",
        body: "Un dentiste n'est jamais associé à un blog crypto. Si nous ne pouvons pas établir que deux sites sont liés thématiquement, nous ne faisons pas l'association : un lien hors sujet ne vaut rien et peut nuire.",
      },
      {
        title: "Vérifiés chaque jour",
        body: "Nous revérifions chaque lien quotidiennement. Les liens ne disparaissent pas en silence sans que vous le sachiez.",
      },
      {
        title: "Crédits remboursés si un lien tombe",
        body: "Si un lien est retiré, prévenez-nous : une fois sa disparition confirmée, le crédit vous est rendu et le lien disparaît de votre tableau de bord. Un site simplement hors ligne un moment, pour maintenance par exemple, garde ses liens.",
      },
    ],
    notTitle: "Ce que ce n'est pas",
    notBody:
      "Ce n'est pas un réseau de blogs privés. Chaque lien se trouve dans un vrai article sur le site d'une vraie entreprise, publié parce que cette entreprise voulait un article.",
    ctaTitle: "Tous les forfaits incluent des crédits",
    ctaBody:
      "Vous pouvez demander vos premiers liens avant d'avoir hébergé quoi que ce soit.",
    ctaPrimary: "Commencer",
    ctaSecondary: "Plutôt héberger des articles",
  },
  faq: {
    metaTitle: "FAQ",
    metaDescription:
      "Questions fréquentes sur le fonctionnement de RepGet.",
    title: "Questions fréquentes",
    subtitle: "Des réponses franches, y compris sur les limites.",
    items: [
      {
        question: "Dois-je connaître le SEO ?",
        answer:
          "Non. C'est précisément l'intérêt du service. Nous déterminons quelles recherches vos clients utilisent, nous rédigeons les pages qui y répondent et nous vous expliquons en langage clair ce qui a changé. Vous n'aurez jamais besoin d'apprendre ce qu'est une balise canonique.",
      },
      {
        question: "Combien de temps avant de voir des résultats ?",
        answer:
          "Généralement deux à quatre mois avant que les nouvelles pages commencent à amener des visiteurs, et davantage dans les secteurs concurrentiels. Quiconque vous promet des résultats en quelques semaines n'est pas honnête. Les moteurs de recherche mettent du temps à trouver, à faire confiance et à classer de nouvelles pages.",
      },
      {
        question: "Garantissez-vous la première place sur Google ?",
        answer:
          "Non, et personne d'autre ne le peut. Google décide de ce qu'il classe et modifie son fonctionnement en permanence. Ce que nous faisons, c'est trouver les recherches que vous pouvez réellement gagner, rédiger les pages correctement et vous montrer honnêtement ce qui s'est passé.",
      },
      {
        question: "Les articles auront-ils l'air écrits par un robot ?",
        answer:
          "Ils sont rédigés par une IA : lisez-les donc avant leur mise en ligne - nous vous fournissons un éditeur exactement pour cela. Ils sont écrits pour votre entreprise, dans votre langue et votre marché, et vous pouvez définir le ton souhaité.",
      },
      {
        question:
          "Les articles sont-ils publiés automatiquement sur mon site ?",
        answer:
          "Uniquement si vous connectez votre site et choisissez de publier. Nous prenons en charge WordPress, Ghost et Shopify, ainsi qu'un webhook pour le reste. Sinon, ils restent en brouillon pour que vous puissiez les relire, les modifier ou les copier ailleurs.",
      },
      {
        question: "Que sont les crédits de liens ?",
        answer:
          "Google fait davantage confiance à un site quand d'autres sites pointent vers lui. Quand l'un de vos articles mentionne l'entreprise d'un autre membre, vous gagnez un crédit. En dépensant un crédit, l'article d'un membre différent pointe vers vous. Vous ne créez jamais de lien vers celui qui vous a cité, ce qui rend les liens naturels.",
      },
      {
        question: "Pourquoi proposez-vous des recherches plus modestes ?",
        answer:
          "Parce que vous pouvez les gagner. Un terme recherché 12 000 fois par mois sur lequel vous n'avez aucune chance vaut moins qu'un terme recherché 300 fois qui vous amène des clients le mois prochain.",
      },
      {
        question: "Puis-je annuler à tout moment ?",
        answer:
          "Oui, depuis la page de facturation, sans frais d'annulation. Votre accès se poursuit jusqu'à la fin de la période déjà payée.",
      },
      {
        question: "Que deviennent mes articles si je pars ?",
        answer:
          "Tout ce qui est déjà publié reste sur votre site : c'est votre contenu. Les articles que nous rédigeons pour vous vous appartiennent.",
      },
    ],
  },
  contact: {
    metaTitle: "Contact",
    metaDescription: "Comment joindre RepGet.",
    title: "Nous contacter",
    subtitle:
      "Des questions sur le produit, votre compte ou la facturation : nous lisons chaque message et répondons sous deux jours ouvrés.",
    emailLabel: "E-mail",
    accountNote:
      "Si votre message concerne votre compte, envoyez-le depuis l'adresse utilisée lors de l'inscription.",
  },
  notFound: {
    metaTitle: "Page introuvable",
    eyebrow: "Erreur 404",
    title: "Nous n’avons pas trouvé cette page",
    body: "L’adresse est peut-être mal saisie, ou la page a été déplacée ou n’existe plus.",
    home: "Aller à la page d’accueil",
    elsewhere: "Ou essayez l’une de ces pages :",
  },
  legalNotice: "Cette page n'est disponible qu'en anglais. Les traductions de nos conditions légales sont réalisées par un traducteur professionnel avant publication.",

  app: {
    workspace: {
      save: "Enregistrer",
      saving: "Enregistrement…",
      saved: "Enregistré",
      discard: "Annuler les modifications",
      unsaved: "1 modification non enregistrée|{count} modifications non enregistrées",
      noChanges: "Toutes les modifications sont enregistrées",
      saveFailed: "Non enregistré. {error}",
      leaveConfirm: "Vous avez des modifications non enregistrées. Quitter cette page et les perdre ?",
      onThisPage: "Sur cette page",
      jumpTo: "Aller à une section",
      optional: "Facultatif",
      required: "Obligatoire",
      charactersLeft: "1 caractère restant|{count} caractères restants",
      overLimit: "1 caractère de trop|{count} caractères de trop",
      viewOnly: "Vous avez un accès en lecture seule à ce site. Seul un propriétaire ou un éditeur peut apporter des modifications.",
      savesImmediately: "Enregistré dès que vous le modifiez",
      savedWithButton: "Enregistré avec le bouton Enregistrer",
      editsKept: "Vos modifications plus récentes sont conservées et doivent encore être enregistrées.",
      preview: "Aperçu",
      close: "Fermer",
      selected: "Sélectionné",
    },
    health: {
      title: "Santé du site",
      description: "Un contrôle technique des pages que nous pouvons lire sur {domain} : ce qui peut les freiner dans les résultats de recherche, et comment le corriger.",
      checkNow: "Vérifier mon site",
      checkAgain: "Vérifier à nouveau",
      checking: "Vérification…",
      starting: "Lancement…",
      refreshStatus: "Actualiser l’état",
      dismiss: "Fermer",
      unavailableTitle: "Nouvelles vérifications indisponibles",
      siteNotReady: "Nous analysons encore ce site. Vous pourrez lancer une vérification une fois l’analyse terminée.",
      errNoPlan: "Choisissez d’abord un forfait pour ce site.",
      errPlanInactive: "L’abonnement de ce site n’est pas actif. Mettez à jour la facturation pour lancer une vérification.",
      errQuota: "Vous avez lancé cette vérification plusieurs fois au cours de la dernière heure. Réessayez dans quelques instants.",
      errUnexpected: "La vérification n’a pas pu être lancée. Veuillez réessayer.",
      queuedTitle: "Vérification demandée",
      queuedBody: "Votre vérification attend de démarrer. Cette page se met à jour toute seule.",
      queuedStale: "Cette vérification n’a pas encore démarré, ce qui prend plus de temps que d’habitude. Le rapport apparaîtra ici une fois qu’elle aura été effectuée.",
      requestedAt: "Demandée : {date}",
      runningTitle: "Vérification de votre site",
      runningBody: "Nous lisons vos pages une par une. Cette page se met à jour toute seule.",
      runningStale: "Cette vérification dure plus longtemps que prévu et s’est peut-être arrêtée.",
      staleRetry: "Actualisez l’état pour voir si elle a avancé, ou relancez la vérification.",
      startedAt: "Démarrée : {date}",
      progressChecked: "1 page vérifiée jusqu’ici|{count} pages vérifiées jusqu’ici",
      progressFound: "1 adresse trouvée sur votre site|{count} adresses trouvées sur votre site",
      progressLimit: "Une vérification lit jusqu’à {max} pages.",
      previousNotice: "Le rapport ci-dessous est votre résultat précédent, du {date}. Il sera remplacé à la fin de la nouvelle vérification.",
      failedTitle: "La dernière vérification n’a pas pu aboutir",
      failedPrevious: "Le rapport ci-dessous reste votre résultat précédent, du {date}.",
      finishedTitle: "Votre nouveau rapport est prêt",
      finishedBody: "Le rapport ci-dessous provient de la vérification du {date}.",
      failure: {
        timeout: "Votre site a mis trop de temps à répondre. Réessayez : c’est souvent passager sur un serveur chargé.",
        notHtml: "L’adresse du site n’a pas renvoyé de page web. Vérifiez qu’elle pointe vers la page d’accueil de votre site.",
        tooLarge: "Votre page d’accueil est trop volumineuse pour être analysée.",
        invalidUrl: "L’adresse du site n’a pas pu être lue. Vérifiez l’adresse, y compris http:// ou https://.",
        refused: "Votre site a refusé notre requête. Un pare-feu ou une extension de sécurité bloque peut-être les visiteurs automatisés.",
        unreachable: "Nous n’avons pas pu joindre votre site. Vérifiez qu’il est en ligne et que l’adresse est correcte.",
        notEntitled: "La vérification s’est arrêtée car l’abonnement de ce site n’est pas actif. Rien de plus n’a été facturé.",
        generic: "Nous n’avons pas pu terminer la vérification de votre site. Réessayez, et contactez le support si cela se reproduit.",
      },
      failureViewer: {
        timeout: "Votre site a mis trop de temps à répondre. C’est souvent passager sur un serveur chargé. Un propriétaire ou un éditeur peut relancer la vérification.",
        generic: "Nous n’avons pas pu terminer la vérification de votre site. Un propriétaire ou un éditeur peut relancer la vérification.",
      },
      emptyTitle: "Aucun rapport pour l’instant",
      emptyBody: "Une vérification lit jusqu’à {max} pages de votre site et liste, page par page, ce qui peut le freiner dans la recherche, avec la façon de corriger chaque problème.",
      emptyViewer: "Aucune vérification n’a encore été lancée. Un propriétaire ou un éditeur peut en lancer une.",
      firstRunTitle: "Votre premier rapport est en préparation",
      firstRunBody: "Il apparaîtra ici dès la fin de la vérification.",
      scoreTitle: "Score de santé",
      scoreDescription: "Compte les problèmes techniques des pages lues, pondérés selon leur gravité et ramenés à une moyenne par page.",
      previousResult: "Résultat précédent",
      latestResult: "Dernier résultat",
      outOf: "sur 100",
      scoreAria: "Score de santé : {score} sur 100",
      bandGood: "Bon",
      bandFair: "À améliorer",
      bandPoor: "Faible",
      noScore: "Aucun score",
      noScoreBody: "Aucun score n’a été enregistré pour cette vérification.",
      notScored: "Non noté",
      zeroPagesTitle: "Aucune page n’a pu être lue",
      zeroPagesBody: "Nous n’avons pu ouvrir aucune page lors de cette vérification : son score ne décrit donc pas votre site. Les constats ci-dessous expliquent pourquoi.",
      notAuthority: "Ce n’est pas l’Autorité de domaine : ce score mesure les problèmes techniques de vos propres pages, pas la confiance que d’autres sites accordent au vôtre.",
      lastChecked: "Dernière vérification",
      pagesRead: "Pages lues",
      pagesFailed: "Impossibles à ouvrir",
      addressesFound: "Adresses trouvées",
      notRecorded: "Non enregistré",
      severityTitle: "Problèmes par gravité",
      critical: "Critiques",
      warnings: "Avertissements",
      suggestions: "Suggestions",
      inFindings: "dans 1 constat|dans {count} constats",
      severityAria: "Critiques : {critical}, avertissements : {warning}, suggestions : {info}",
      badge: { critical: "Critique", warning: "Avertissement", info: "Suggestion" },
      coverageTitle: "Ce que cette vérification a couvert",
      coverageLimit: "Elle lit jusqu’à {max} pages, en partant de votre page d’accueil et en suivant les liens.",
      coverageSameSite: "Elle ne suit que les liens internes à {domain}. Les liens vers d’autres sites ne sont pas vérifiés.",
      coverageQuery: "Les adresses qui ne diffèrent qu’après un « ? » ou un « # » comptent comme une seule page.",
      coverageSkipped: "Elle ignore les pages d’administration, de connexion, de panier et de paiement, les flux, ainsi que les fichiers comme les images et les PDF.",
      coverageRefused: "Une page qui ne répond pas en 15 secondes, ou qui refuse les visiteurs automatisés, est indiquée comme « impossible à ouvrir ».",
      coverageBeyond: "Cette vérification a trouvé {found} adresses sur votre site et lu {read} pages. Les autres n’ont pas été vérifiées.",
      notAssessedTitle: "Certains contrôles n’ont pas pu être effectués",
      notAssessedBody: "Ces contrôles comparent les pages entre elles et demandent au moins deux pages lisibles : {checks}. Ils ne comptent pas dans ce score.",
      crossChecks: {
        duplicateTitles: "titres de page en double",
        duplicateDescriptions: "descriptions en double",
        internalLinking: "maillage interne",
      },
      findingsTitle: "Constats",
      findingsDescription: "Les plus graves d’abord. Ouvrez un constat pour voir toutes les pages concernées et comment le corriger.",
      findingsCount: "1 constat|{count} constats",
      filterLabel: "Filtrer par gravité",
      filterAll: "Tous",
      searchLabel: "Rechercher dans les constats",
      searchPlaceholder: "Rechercher un problème ou une adresse de page",
      showingFiltered: "Constats affichés : {shown} sur {total}.",
      clearFilters: "Effacer les filtres",
      noMatchTitle: "Aucun constat ne correspond",
      noMatchBody: "Essayez une autre recherche, ou affichez tous les constats.",
      noFindingsTitle: "Aucun problème trouvé",
      noFindingsBody: "Nous n’avons rien trouvé à corriger sur la page lue.|Nous n’avons rien trouvé à corriger sur les {count} pages lues.",
      pagesCount: "1 page|{count} pages",
      howToFix: "Comment corriger",
      effortMinutes: "En général quelques minutes",
      effortHour: "En général environ une heure",
      effortLonger: "Peut prendre plus de temps",
      needsDeveloper: "Peut nécessiter votre développeur web",
      affectedPages: "Pages concernées ({count})",
      homepage: "page d’accueil",
      opensInNewTab: "(s’ouvre dans un nouvel onglet)",
      showAllPages: "Afficher les {count} pages",
      showFewerPages: "Afficher moins de pages",
      matchingPages: "Pages correspondant à votre recherche : {shown} sur {total}.",
      notLoaded: "{shown} sur {total} sont listées. Les autres n’ont pas été chargées, pour que cette page reste rapide.",
      groupNote: "Chaque entrée est un groupe de pages ; la première page de chaque groupe est listée.",
      firstPageNote: "La première page trouvée est listée ; le détail donne le total.",
      noUrl: "Aucune adresse de page n’a été enregistrée",
      rowsCapped: "Cette vérification a enregistré {total} problèmes. Les {shown} premiers sont listés ci-dessous ; les totaux ci-dessus les incluent tous.",
      detail: {
        titleLong: "Le titre fait {chars} caractères ; les résultats de recherche le coupent après environ {max}.",
        titleShort: "Le titre ne fait que {chars} caractères.",
        descriptionLong: "La description fait {chars} caractères ; les résultats de recherche la coupent après environ {max}.",
        descriptionShort: "La description ne fait que {chars} caractères.",
        multipleH1: "{count} titres principaux (H1) sur cette page.",
        thinContent: "Seulement {words} mots sur cette page.",
        imagesAlt: "{missing} images sur {total} n’ont pas de description (texte alternatif).",
        largePage: "Le HTML seul de la page pèse {kb} Ko.",
        httpStatus: "La page a répondu par l’erreur {status}.",
        duplicateTitle: "{count} pages partagent le titre « {title} ».",
        duplicateDescription: "{count} pages partagent la même description.",
        noInternalLinks: "1 page ne renvoie vers aucune autre page de votre site.|{count} pages ne renvoient vers aucune autre page de votre site.",
        unreachTimeout: "Elle n’a pas répondu à temps.",
        unreachBlocked: "Elle refuse les visiteurs automatisés (un réglage de sécurité du site).",
        unreachPassword: "Elle demande un mot de passe.",
        unreachStatus: "Elle a répondu par l’erreur {status}.",
        unreachNotHtml: "Ce n’est pas une page web.",
        unreachRedirects: "Elle redirige trop de fois.",
        unreachRedirectAway: "Elle redirige vers une adresse que nous ne vérifions pas.",
        unreachConnect: "Nous n’avons pas pu nous y connecter.",
        unreachUnknown: "Une erreur inattendue nous a empêchés de l’ouvrir.",
      },
      issues: {
        noindex: {
          label: "Masquée aux moteurs de recherche",
          about: "La page demande aux moteurs de recherche de ne pas l’inclure dans leurs résultats : elle ne peut donc pas être trouvée.",
          fix: "Sauf si vous masquez cette page volontairement, retirez son réglage « noindex ». Sous WordPress, c’est en général une option de votre extension SEO, ou la case « Demander aux moteurs de recherche de ne pas indexer ce site » dans Réglages › Lecture.",
        },
        broken_page: {
          label: "La page affiche une erreur",
          about: "La page répond par une erreur au lieu de s’afficher.",
          fix: "Corrigez la page ou, si elle ne doit plus exister, redirigez-la vers la page existante la plus proche, pour ne perdre ni visiteurs ni liens.",
        },
        unreachable_page: {
          label: "Page impossible à ouvrir",
          about: "Nous avons essayé de charger cette page sans y parvenir. Les moteurs de recherche ont peut-être le même problème.",
          fix: "Ouvrez la page dans votre propre navigateur. Si elle n’existe plus, mettez à jour les liens qui y mènent ou redirigez-la. Si elle s’ouvre chez vous, votre hébergeur ou un réglage de sécurité refuse peut-être les visiteurs automatisés, ce qui peut aussi bloquer les moteurs de recherche.",
        },
        missing_title: {
          label: "La page n’a pas de titre",
          about: "La page n’a pas de balise de titre, le titre affiché dans les résultats de recherche.",
          fix: "Donnez à la page un titre qui dit de quoi elle parle. C’est le titre que les gens voient dans les résultats de recherche : écrivez-le pour eux plutôt que d’y entasser des mots-clés.",
        },
        title_too_long: {
          label: "Le titre est trop long",
          about: "Les résultats de recherche coupent les titres de plus de 60 caractères environ.",
          fix: "Raccourcissez le titre pour que la partie importante ne soit pas coupée. Placez l’essentiel en premier : c’est la fin qui est tronquée.",
        },
        title_too_short: {
          label: "Le titre est très court",
          about: "Les titres de moins de 30 caractères en disent souvent trop peu sur la page.",
          fix: "Ajoutez des précisions au titre, pour qu’on voie dès les résultats de recherche que cette page est celle qu’on cherche.",
        },
        missing_meta_description: {
          label: "Pas de description pour les résultats de recherche",
          about: "La page n’a pas de description : les moteurs de recherche choisissent eux-mêmes le texte affiché sous votre lien.",
          fix: "Rédigez une description d’une ou deux phrases. Sans elle, les moteurs de recherche reprennent un passage de la page, souvent pas le meilleur.",
        },
        meta_description_too_long: {
          label: "La description est trop longue",
          about: "Les résultats de recherche coupent les descriptions de plus de 158 caractères environ.",
          fix: "Raccourcissez la description et dites tôt pourquoi cliquer.",
        },
        meta_description_too_short: {
          label: "La description est très courte",
          about: "Les descriptions de moins de 70 caractères laissent de la place inutilisée dans les résultats de recherche.",
          fix: "Développez la description en une ou deux phrases qui donnent envie de choisir votre résultat.",
        },
        missing_h1: {
          label: "Pas de titre principal",
          about: "La page n’a pas de titre principal (H1) : son sujet est moins clair pour les lecteurs et les moteurs de recherche.",
          fix: "Ajoutez en haut de la page un titre principal qui dit de quoi elle parle.",
        },
        multiple_h1: {
          label: "Plusieurs titres principaux",
          about: "La page a plusieurs titres principaux (H1) : on ne sait pas lequel la décrit.",
          fix: "Gardez un seul titre principal et transformez les autres en sous-titres.",
        },
        thin_content: {
          label: "Peu de texte",
          about: "La page compte moins de 300 mots, menus et pied de page compris. Les pages aussi courtes se positionnent rarement sur des recherches concurrentielles.",
          fix: "Développez la page pour qu’elle réponde pleinement à ce que cherchent les visiteurs, ou fusionnez-la avec une page plus complète et redirigez celle-ci.",
        },
        images_missing_alt: {
          label: "Images sans description",
          about: "Certaines images n’ont pas de texte alternatif, que lisent les lecteurs d’écran et qu’utilise la recherche d’images.",
          fix: "Ajoutez à chaque image une courte description de ce qu’elle montre. Les images purement décoratives peuvent avoir une description vide.",
        },
        missing_canonical: {
          label: "Aucune adresse préférée définie",
          about: "La page n’indique pas son adresse préférée (lien canonique). Si elle est accessible à plusieurs adresses, les moteurs de recherche doivent deviner laquelle afficher.",
          fix: "Ajoutez un lien canonique à la page. La plupart des extensions SEO l’ajoutent automatiquement une fois activées ; sinon, demandez à votre développeur web.",
        },
        missing_lang: {
          label: "Langue de la page non définie",
          about: "La page n’indique pas dans quelle langue elle est rédigée.",
          fix: "Définissez la langue de la page (l’attribut « lang » de la balise html). Cela aide les moteurs de recherche à montrer vos pages aux bonnes personnes et les lecteurs d’écran à les prononcer correctement.",
        },
        large_page: {
          label: "Code de la page très volumineux",
          about: "Le HTML seul de la page dépasse 1,5 Mo, ce qui ralentit le chargement. Les images ne sont pas comptées ici.",
          fix: "Un HTML volumineux vient en général de code, de données ou d’images intégrés à la page elle-même. Demandez à votre développeur web de les déplacer dans des fichiers séparés ou de les alléger.",
        },
        duplicate_title: {
          label: "Des pages partagent un titre",
          about: "Plusieurs pages utilisent le même titre : les moteurs de recherche ont du mal à les distinguer.",
          fix: "Donnez à chaque page un titre qui décrit ce qu’elle seule traite.",
        },
        duplicate_meta_description: {
          label: "Des pages partagent une description",
          about: "Plusieurs pages utilisent la même description dans les résultats de recherche.",
          fix: "Rédigez pour chaque page une description distincte qui dit ce que cette page propose.",
        },
        no_internal_links: {
          label: "Pages sans liens vers le reste du site",
          about: "Certaines pages ne contiennent aucun lien vers d’autres pages de votre site : visiteurs et moteurs de recherche ne peuvent pas aller plus loin.",
          fix: "Ajoutez depuis ces pages des liens vers des pages proches de votre site, par exemple un service, un article ou votre page d’accueil.",
        },
      },
      siteTitle: "Votre site tel que nous l’avons lu",
      siteDescription: "Lu sur votre page d’accueil pendant cette vérification.",
      siteLegacy: "Cette vérification date d’avant la collecte des informations du site. Elles apparaîtront après la prochaine vérification.",
      siteUnavailable: "Aucune page n’a pu être lue lors de cette vérification : ces informations ne sont donc pas disponibles.",
      siteName: "Nom du site",
      siteNameMissing: "Introuvable",
      language: "Langue",
      languageMissing: "Non déclarée",
      languageNote: "Telle que déclarée par votre page d’accueil.",
      languageMissingNote: "Votre page d’accueil n’indique pas sa langue : les moteurs de recherche doivent la deviner.",
      platform: "Plateforme",
      platformUnknown: "Non reconnue",
      platformNote: "Détectée à partir du code de votre page.",
      platformUnknownNote: "Nous n’avons reconnu aucune plateforme courante. Ce n’est pas un problème en soi.",
      previewImage: "Image d’aperçu des liens",
      previewMissing: "Aucune",
      previewNote: "Affichée quand votre page d’accueil est partagée.",
      previewMissingNote: "Aucune image d’aperçu (og:image) n’a été trouvée : les liens partagés peuvent s’afficher sans image.",
      previewBroken: "L’image d’aperçu n’a pas pu être chargée.",
      linkedTitle: "Sites vers lesquels vous faites le plus de liens",
      linkedHelp: "Jusqu’à six, comptés sur les pages lues. Utile pour repérer des liens que vous ne vouliez pas donner.",
      linkedEmpty: "Nous n’avons trouvé aucun lien vers d’autres sites sur les pages lues.",
      aiTitle: "Accès des assistants IA",
      aiDescription: "Si votre fichier robots.txt bloque les robots que les assistants IA utilisent pour lire les sites web.",
      aiLegacy: "Cette vérification date d’avant la lecture du fichier robots.txt. Cette information apparaîtra après la prochaine vérification.",
      aiUnreadable: "Aucune page n’a pu être lue lors de cette vérification : le fichier robots.txt n’a donc probablement pas pu l’être non plus. Ici, « Non bloqué » peut seulement signifier que nous n’avons pas pu le lire.",
      aiNoneBlocked: "Aucun de ces {total} robots n’est bloqué sur l’ensemble de votre site.",
      aiSomeBlocked: "1 robot sur {total} est bloqué sur l’ensemble de votre site.|{count} robots sur {total} sont bloqués sur l’ensemble de votre site.",
      aiAllowed: "Non bloqué",
      aiBlocked: "Bloqué",
      aiNamed: "Cité dans robots.txt",
      aiCaveat: "Nous vérifions seulement si robots.txt bloque l’ensemble du site. S’il n’y a pas de robots.txt, ou si nous n’avons pas pu le lire, le robot est considéré comme non bloqué. Les pare-feu et les règles visant des pages précises ne sont pas vérifiés.",
      aiNoGuarantee: "Être lisible ne signifie pas qu’un assistant IA mentionnera ou citera votre site.",
      aiBlockedHelp: "Pour laisser passer un robot, retirez de robots.txt la règle « Disallow: / » qui s’applique à lui, ou demandez-le à la personne qui gère votre site.",
      aiVisibilityLink: "Voir si les assistants IA vous mentionnent",
      fixTitle: "Vous voulez que nous corrigions cela ?",
      fixSelf: "La plupart sont des modifications de texte que vous pouvez faire vous-même grâce aux conseils ci-dessus. Si vous préférez, envoyez-nous la liste et nous vous ferons un devis.",
      fixDeveloper: "1 de ces constats nécessite en général la personne qui a créé votre site. Envoyez-nous la liste : nous examinerons tout et vous ferons un devis pour la correction.|{count} de ces constats nécessitent en général la personne qui a créé votre site. Envoyez-nous la liste : nous examinerons tout et vous ferons un devis pour la correction.",
      fixHow: "Ouvre votre messagerie avec la liste déjà remplie. Rien n’est envoyé tant que vous ne l’envoyez pas, et rien n’est facturé.",
      fixUnavailable: "Les demandes de devis par e-mail ne sont pas disponibles pour le moment.",
      requestQuote: "Demander un devis",
      mailSubject: "Demande de correction pour {domain}",
      mailGreeting: "Bonjour,",
      mailAsk: "Pourriez-vous me faire un devis pour corriger les problèmes trouvés sur {domain} ?",
      mailCheckedOn: "Vérification du {date}.",
      mailCounts: "1 problème trouvé (critiques : {critical}).|{count} problèmes trouvés (critiques : {critical}).",
      mailListTitle: "Constats :",
      mailLine: "- {label} : {pages}",
      mailThanks: "Merci.",
    },
    settings: {
      personalTitle: "Informations personnelles",
      personalSubtitle: "Votre nom et l’adresse e-mail avec laquelle vous vous connectez.",
      nameLabel: "Nom",
      namePlaceholder: "Votre nom",
      save: "Enregistrer",
      saving: "Enregistrement…",
      cancel: "Annuler",
      nameSaved: "Nom mis à jour",
      nameError: "Impossible d\u2019enregistrer votre nom",
      emailLabel: "E-mail",
      changePassword: "Changer le mot de passe",
      setPassword: "Définir un mot de passe",
      setPasswordIntro:
        "Vous vous connectez avec Google. Définissez un mot de passe pour vous connecter aussi avec votre e-mail : Google continuera de fonctionner.",
      setPasswordHelp: "Au moins 8 caractères.",
      settingPassword: "Définition…",
      passwordCreated:
        "Mot de passe défini. Vous pouvez désormais vous connecter avec votre e-mail et votre mot de passe.",
      languageLabel: "Langue du tableau de bord",
      languageHelp: "Menus, boutons et messages de ce tableau de bord. La modifier ne change pas vos articles.",
      languageError: "Impossible d\u2019enregistrer votre langue",
      currentPassword: "Mot de passe actuel",
      newPassword: "Nouveau mot de passe",
      updatePassword: "Mettre à jour le mot de passe",
      passwordSaved: "Mot de passe changé. Les autres appareils ont été déconnectés.",
      passwordTooShort: "Utilisez au moins 8 caractères",
      passwordError: "Impossible de changer votre mot de passe",
      passwordHelp: "Au moins 8 caractères. Les autres appareils seront déconnectés.",
      changing: "Modification…",
      saveName: "Enregistrer le nom",
      membersTitle: "Membres et rôles",
      membersSubtitle: "L\u2019accès est accordé un site à la fois. Une personne invitée ici ne verra ni vos autres sites ni votre facturation.",
      addMember: "Ajouter un membre",
      addMemberHelp: "Saisissez son adresse e-mail. S’il n’a pas encore de compte RepGet, nous lui enverrons une invitation.",
      memberColumn: "Membre",
      roleColumn: "Rôle",
      statusColumn: "Statut",
      statusPending: "Invité",
      invitationExpiresOn: "expire le {date}",
      statusExpired: "Expirée",
      resendInvite: "Renvoyer l’invitation",
      cancelInvite: "Annuler l’invitation",
      inviteSent: "Invitation envoyée",
      inviteResent: "Invitation renvoyée",
      inviteCancelled: "Invitation annulée",
      actionsColumn: "Actions",
      active: "Actif",
      removeAccess: "Retirer l\u2019accès",
      websiteLabel: "Site web",
      emailPlaceholder: "editor@example.com",
      roleHelp: "Un éditeur peut rédiger, modifier et publier des articles. Un lecteur peut seulement consulter.",
      invite: "Inviter",
      nobodyElse: "Personne d\u2019autre pour l\u2019instant. Invitez un collègue ou un éditeur indépendant à travailler sur ce site.",
      loadingPeople: "Chargement des personnes",
      roleEditor: "Éditeur",
      roleViewer: "Lecteur",
      pageTitle: "Compte",
      pageDescription: "Vos informations personnelles, vos moyens de connexion, votre langue, les personnes qui travaillent sur vos sites et votre lien de parrainage.",
      emailHelp: "Vous vous connectez avec cette adresse et les reçus y sont envoyés. Elle ne peut pas être modifiée ici.",
      nameRequired: "Saisissez votre nom.",
      securityTitle: "Connexion et sécurité",
      securitySubtitle: "Les moyens de vous connecter à votre compte.",
      methodPassword: "E-mail et mot de passe",
      methodGoogle: "Google",
      methodSet: "Défini",
      methodNotSet: "Non défini",
      methodLinked: "Associé",
      passwordSetSummary: "Vous pouvez vous connecter avec votre adresse e-mail et votre mot de passe.",
      passwordNotSetSummary: "Ce compte n’a pas encore de mot de passe.",
      googleLinkedSummary: "Vous pouvez vous connecter avec le compte Google de cette adresse.",
      setPasswordIntroGeneric: "Définissez un mot de passe pour vous connecter avec votre adresse e-mail et un mot de passe.",
      currentPasswordWrong: "Votre mot de passe actuel est incorrect.",
      passwordTooLong: "Utilisez 128 caractères au maximum",
      tooManyAttempts: "Trop de tentatives. Patientez une minute et réessayez.",
      passwordAlreadySet: "Ce compte a déjà un mot de passe. Saisissez votre mot de passe actuel pour le modifier.",
      languageTitle: "Langue",
      languageSubtitle: "Le tableau de bord et vos articles ont chacun leur propre langue.",
      languageSaved: "Langue du tableau de bord enregistrée.",
      articleLanguageLabel: "Langue des articles",
      articleLanguageHelp: "Les articles de chaque site sont rédigés dans la langue définie dans son onglet Entreprise.",
      articleLanguageLink: "Ouvrir l’onglet Entreprise de {domain}",
      roleAdmin: "Administrateur",
      roleEditorHelp: "Rédige, modifie et publie des articles.",
      roleViewerHelp: "Peut tout consulter, sans rien modifier.",
      inviteTo: "Cette personne aura accès à {domain} uniquement.",
      reinviteHelp: "Inviter une personne qui a déjà accès modifie son rôle.",
      invalidEmail: "Saisissez une adresse e-mail valide.",
      inviteSelf: "Vous avez déjà accès à ce site.",
      inviteFailed: "Impossible d’envoyer l’invitation. Réessayez.",
      actionFailed: "L’opération a échoué. Réessayez.",
      accessGranted: "{email} peut maintenant travailler sur {domain}",
      accessGrantedNoEmail: "{email} peut maintenant travailler sur {domain}, mais nous n’avons pas pu lui envoyer d’e-mail.",
      accessRemoved: "{email} n’a plus accès",
      loadPeopleFailed: "Impossible de charger les personnes qui travaillent sur ce site.",
      retry: "Réessayer",
      thisWebsite: "ce site",
      workspaceAccess: "{email} a accès via votre espace de travail",
      manageMember: "Gérer {email}",
      manageInvitation: "Gérer l’invitation de {email}",
      membersCaption: "Personnes pouvant travailler sur {domain}",
      removeConfirmTitle: "Retirer l’accès de {email} ?",
      removeConfirmBody: "Cette personne ne pourra plus ouvrir {domain}. Vous pourrez l’inviter de nouveau plus tard.",
      keepAccess: "Conserver l’accès",
      cancelInviteConfirmTitle: "Annuler l’invitation de {email} ?",
      cancelInviteConfirmBody: "Le lien envoyé par e-mail ne fonctionnera plus. Vous pourrez l’inviter de nouveau plus tard.",
      keepInvitation: "Conserver l’invitation",
      removing: "Retrait…",
      cancellingInvite: "Annulation…",
      inviting: "Envoi…",
      viewingSharedNote: "Vous consultez {domain}, qui est partagé avec vous. Seul son propriétaire peut modifier qui y travaille. La liste ci-dessous concerne vos propres sites.",
      guestTeamNote: "{domain} est partagé avec vous en tant que {role}. Seul son propriétaire peut inviter ou retirer des personnes.",
    },
    websites: {
      title: "Sites web",
      connected: "1 site web. Chacun est facturé sur son propre forfait.|{count} sites web. Chacun est facturé sur son propre forfait.",
      addWebsite: "Ajouter un site",
      emptyTitle: "Aucun site pour le moment",
      emptyBody:
        "Ajoutez votre site et nous le lirons, comprendrons ce que fait votre entreprise et trouverons les recherches qui valent la peine.",
      addFirst: "Ajouter votre premier site",
      tryAgain: "Réessayer",
      removeLabel: "Supprimer {domain}",
      removed: "{domain} supprimé",
      retrying: "Nouvel essai",
      dialogTitle: "Ajouter un site web",
      dialogBody:
        "Saisissez l\u2019adresse du site que vous voulez voir sur Google. Nous le lirons et remplirons les détails pour vous.",
      urlLabel: "Adresse du site",
      urlPlaceholder: "exemple.com",
      cancel: "Annuler",
      adding: "Ajout…",
      sharedTitle: "Partagés avec vous",
      sharedHelp: "Les sites web auxquels d\u2019autres personnes vous ont donné accès.",
    },
    billing: {
      title: "Facturation",
      subtitle: "Chaque site a son propre forfait. Les crédits sont partagés entre tous.",
      yourWebsites: "Vos sites web",
      yourWebsitesHelp: "Un site sans forfait ne peut ni générer ni publier d\u2019articles.",
      noPlanYet: "Pas encore de forfait",
      planRenews: "{plan} - renouvellement le {date}",
      planEnds: "{plan} - fin le {date}",
      currentPlan: "Forfait actuel",
      accessEnds: "Fin de l\u2019accès",
      nextInvoice: "Prochaine facture",
      onPlan: "Vous êtes sur le forfait {plan}.",
      noSubscription: "Aucun abonnement actif. Choisissez un forfait ci-dessous pour commencer.",
      accessEndsOn: "L’accès prend fin le {date}.",
      renewsOn: "Renouvellement le {date}.",
      monthly: "Mensuel",
      annual: "Annuel",
      status: "Statut",
      tryItFirst: "Essayez d\u2019abord",
      paypalReceipts: "Vos reçus et la résiliation se trouvent dans votre compte PayPal.",
      promoCodes: "Les codes promo se saisissent au paiement par carte. PayPal ne les accepte pas.",
      unlimited: "Illimité",
      articlesEachMonth: "{n} article rédigé par mois|{n} articles rédigés par mois",
      searchTermsTracked: "{n} terme de recherche suivi|{n} termes de recherche suivis",
      oneWebsite: "Un site par abonnement",
      creditsEachMonth: "{n} crédit de lien par mois|{n} crédits de lien par mois",
      paymentReceived: "Paiement reçu - confirmation de votre abonnement…",
      checkoutCancelled: "Paiement annulé.",
      purchaseReceived: "Paiement reçu - votre achat apparaîtra sous peu.",
      purchaseCancelled: "Achat annulé.",
      addWebsiteFirst: "Ajoutez d\u2019abord un site - chaque forfait paie un seul site.",
      checkoutFailed: "Impossible de lancer le paiement. Réessayez.",
      planFor: "Forfait de {domain}",
      choosePlan: "Choisissez un forfait",
      choosePlanFor: "Choisissez un forfait pour {domain}",
      choosePlanHelp: "Un forfait couvre un seul site.",
      billingPeriod: "Période de facturation",
      perMonth: "/ mois",
      perYear: "/ an",
      saveBadge: "Économisez {n} %",
      switchPlan: "Passer à ce forfait",
      payByCard: "Payer par carte",
      redirecting: "Redirection…",
      opening: "Ouverture…",
      cancelSubscription: "Résilier l’abonnement",
      paypalCheckoutFailed: "Impossible de lancer le paiement PayPal. Réessayez.",
      portalFailed: "Impossible d’ouvrir le portail de facturation.",
      managedForYou: "Nous gérons cet abonnement pour vous. Écrivez à {email} pour obtenir vos reçus ou faire une modification.",
      newTab: "(s’ouvre dans un nouvel onglet)",
      upgradeLead: "Prêt à passer à la vitesse supérieure ?",
      upgradeBody: "Le forfait {plan} comprend {articles}, {terms} et {credits}.",
      upgradeLink: "Découvrir {plan}",
      statusActive: "Actif",
      statusTrialing: "Essai gratuit",
      statusPastDue: "Paiement en retard",
      statusUnpaid: "Impayé",
      statusIncomplete: "Paiement incomplet",
      statusIncompleteExpired: "Paiement expiré",
      statusCanceled: "Résilié",
      statusPaused: "En pause",
      statusInactive: "Inactif",
      pastDueNotice: "Le dernier paiement de ce site n’a pas abouti. Mettez à jour le moyen de paiement pour conserver l’accès.",
      unsettledNotice: "L’abonnement de ce site doit être régularisé ou résilié avant de pouvoir changer de forfait.",
      endedNotice: "Cet abonnement est terminé. Choisissez un forfait ci-dessous pour reprendre.",
      billedByPayPal: "Ce site est facturé via PayPal : les changements de forfait passent donc aussi par PayPal.",
      billedByCard: "Ce site est facturé par carte : les changements de forfait passent donc par le paiement par carte. Pour payer avec PayPal, résiliez d’abord l’abonnement par carte.",
      billedByCardEnding: "L’abonnement par carte de ce site prend fin le {date}. Vous pourrez choisir PayPal une fois qu’il aura pris fin.",
      noPlanChange: "Le changement de forfait n’est pas disponible pour ce site pour le moment.",
      paypalApproved: "Autorisation PayPal reçue - confirmation de votre abonnement…",
      paypalCancelled: "Paiement PayPal annulé.",
      viewingSharedNote: "{shared} est partagé avec vous et c’est son propriétaire qui le paie. Cette page présente la facturation de vos propres sites.",
      guestTitle: "Rien à payer ici",
      guestBody: "Les sites partagés avec vous sont payés par leurs propriétaires. Vous n’avez pas besoin de forfait pour y travailler.",
      addWebsite: "Ajouter un site",
      viewPlan: "Voir le forfait",
      shownBelow: "Affiché ci-dessous",
      paidByCard: "Carte",
      invoiceInPortal: "Facture dans Gérer la facturation",
      dateColumn: "Date",
      descriptionColumn: "Description",
      methodColumn: "Payé avec",
      amountColumn: "Montant",
      receiptColumn: "Reçu",
      historyCapped: "Affichage des {count} paiements les plus récents.",
    },
    article: {
      contentSeo: "Contenu et SEO",
      contentSeoHelp: "Comment chaque article est rédigé, et ce qu\u2019il devient ensuite.",
      publishAs: "Publier en",
      publishLive: "Les articles sont mis en ligne sur votre site à l\u2019heure prévue.",
      publishDraft: "Les articles sont envoyés en brouillon pour que vous les relisiez.",
      live: "En ligne",
      draft: "Brouillon",
      articleStyle: "Style des articles",
      internalLinks: "Liens internes",
      internalLinksHelp: "Nombre visé de liens internes par article.",
      targetWordCount: "Longueur visée",
      adaptiveOn: "Nous choisissons la meilleure longueur selon le type d\u2019article.",
      adaptiveOff: "Une longueur fixe pour tous les formats.",
      wordsPerArticle: "Mots par article",
      contentDetails: "Détails du contenu",
      sitemapUrl: "URL du sitemap",
      blogAddress: "Adresse principale du blog",
      bestArticle: "Votre meilleur article en exemple",
      engagement: "Engagement",
      brandColour: "Couleur de marque",
      optional: "Facultatif",
      imageBrief: "L’allure de votre marque dans les images",
      imageBriefPlaceholder: "Cinématographique, minimal, gris froids avec des touches de bleu électrique.",
      imageInstructions: "Consignes supplémentaires pour les images",
      imageInstructionsPlaceholder: "ex. Ne jamais montrer de visages.",
      tableOfContents: "Sommaire",
      comparisonTable: "Tableau comparatif",
      youtubeVideo: "Vidéo YouTube",
      authorPerspective: "Point de vue de l\u2019auteur",
      mentionSimilar: "Mentionner des produits et outils similaires",
      poweredBy: "Lien Powered by RepGet",
      howWeWrite: "Notre façon d\u2019écrire",
      toneLabel: "Quel ton vos articles doivent-ils avoir ?",
      tonePlaceholder: "Chaleureux et rassurant, pas clinique",
      rulesLabel: "Règles pour chaque article",
      rulesPlaceholder: "Ne jamais mettre d\u2019année dans le titre. Toujours mentionner la livraison gratuite.",
      factsLabel: "Informations sur votre entreprise",
      uspsLabel: "Qu\u2019est-ce qui vous distingue ?",
      onePerLine: "Un par ligne.",
      preferLabel: "Mots que vous préférez",
      preferPlaceholder: "Dire traitement, pas intervention",
      avoidLabel: "Mots à éviter",
      avoidPlaceholder: "Ne jamais dire pas cher",
      author: "Auteur",
      authorName: "Nom de l\u2019auteur",
      authorNamePlaceholder: "Votre nom, ou celui de la marque",
      shortBio: "Courte biographie",
      shortBioPlaceholder: "Une ou deux phrases sur qui écrit et pourquoi cette personne s\u2019y connaît.",
      closePreview: "Fermer l\u2019aperçu",
      unsavedChanges: "Modifications non enregistrées",
      contentDetailsHelp: "Où vit votre contenu, pour que nous puissions y renvoyer et en suivre la forme.",
      engagementHelp: "L\u2019apparence des articles et ce qui accompagne le texte.",
      howWeWriteHelp: "La voix derrière chaque article.",
      factsHelp: "Un par ligne. Ce sont les seuls éléments précis que nous affirmerons.",
      authorHelp: "La signature affichée sur chaque article, ici et sur votre site.",
      noBylineHelp: "Laissé vide, les articles paraissent sans signature.",
      pageTitle: "Paramètres des articles",
      pageDescription: "Comment les articles de ce site sont rédigés, illustrés et publiés.",
      sectionWriting: "Rédaction et SEO",
      sectionWritingHelp: "Le style et la longueur de chaque article, et le nombre de liens vers vos autres pages.",
      sectionSources: "Sources de contenu",
      sectionSourcesHelp: "Où se trouve votre contenu sur votre site.",
      sectionImages: "Images et identité de marque",
      sectionImagesHelp: "L’image créée pour chaque article, et l’allure de votre marque.",
      sectionEnhancements: "Enrichissements des articles",
      sectionEnhancementsHelp: "Les éléments ajoutés aux articles en plus du texte.",
      sectionVoice: "Ton de la marque",
      sectionVoiceHelp: "Le ton de vos articles, et ce qu’ils peuvent dire de votre entreprise.",
      sectionAuthor: "Auteur",
      sectionAuthorHelp: "La personne ou la marque qui signe vos articles. Elle est enregistrée avec vos paramètres ; pour l’instant, les articles ne l’affichent pas comme signature.",
      unknownOption: "{value} (plus proposé)",
      linksError: "Saisissez un nombre entier de 0 à 20.",
      wordsError: "Saisissez un nombre entier de 300 à 5 000.",
      sitemapHint: "Nous permet de trouver les pages de votre site à lier depuis les nouveaux articles.",
      blogHint: "La page principale de votre blog.",
      exampleHint: "Un de vos articles dont vous êtes satisfait.",
      urlError: "Saisissez une adresse complète commençant par http:// ou https://.",
      brandColourHint: "La couleur principale de votre marque, en code hexadécimal. Elle est enregistrée avec vos paramètres ; pour l’instant, les images générées ne l’utilisent pas.",
      brandColourError: "Utilisez # suivi de six chiffres ou lettres de a à f, par exemple #003388.",
      noColour: "Aucune couleur",
      invalidColour: "Couleur non valide",
      pickColour: "Choisir une couleur de marque",
      clearColour: "Retirer la couleur",
      imageStyleLabel: "Style d’image",
      imageStyleHint: "Le style de l’image créée pour chaque article.",
      coverStyleLabel: "Style de l’image de couverture",
      coverStyleHint: "Votre style préféré pour les couvertures. Pour l’instant, chaque article reçoit une seule image, dans le style d’image ci-dessus, et cette image sert aussi de couverture.",
      samplesNote: "Les exemples illustrent chaque style. Les images de vos articles sont créées pour chaque article et seront différentes.",
      matchFollows: "Suit actuellement : {style}",
      matchFollowsUnknown: "Suit le style d’image ci-dessus",
      previewStyle: "Voir l’exemple {style}",
      previewTitle: "Exemple : {style}",
      previewMatchTitle: "Comme les images de l’article, actuellement {style}",
      previewHelp: "Un exemple de ce style. L’aperçu ne change pas votre choix.",
      sampleAlt: "Image d’exemple dans le style {style}",
      unknownImageStyle: "Votre choix enregistré ({value}) ne fait pas partie de ces styles. Il reste tel quel jusqu’à ce que vous en choisissiez un.",
      imageBriefHint: "Inclus dans les instructions de chaque image d’article.",
      tocHint: "Ajoute une table des matières construite à partir des intertitres.",
      youtubeHint: "Votre choix est enregistré. Pour l’instant, aucune vidéo n’est ajoutée aux articles.",
      perspectiveHint: "Écrit avec un point de vue plutôt que de façon impersonnelle.",
      similarHint: "Cite et compare des alternatives, pour un sujet mieux couvert.",
      comparisonHint: "Ajoute un tableau comparant côte à côte les options dont parle l’article, comme « Vidéographie ou cinématographie en un coup d’œil ».",
      poweredByHint: "Une petite mention à la fin de chaque article. La désactiver s’applique aux articles pas encore publiés.",
      factsPlaceholder: "Ouvert depuis 2004\nCinq dentistes dans l’équipe\nParking gratuit sur place",
      uspsPlaceholder: "Rendez-vous d’urgence le jour même\nNous recevons les patients anxieux",
      tooManyLines: "Jusqu’à {max} lignes. Retirez 1 ligne.|Jusqu’à {max} lignes. Retirez {count} lignes.",
      lineTooLong: "La ligne {line} dépasse {max} caractères.",
      fixFields: "Certains champs sont à corriger. Ils sont signalés sur la page.",
      saveError: "Une erreur s’est produite. Veuillez réessayer.",
      saveBarNote: "Couvre toutes les sections sauf Rédaction et publication, enregistrée dès que vous la modifiez.",
      autoOnHelp: "Nous avançons dans votre plan de contenu de nous-mêmes. Vous pouvez toujours rédiger n’importe quel article vous-même.",
      autoOffHelp: "Rien n’est rédigé tant que vous ne le demandez pas. Ouvrez un article planifié et cliquez sur Rédiger.",
      anyDay: "N’importe quel jour.",
      pickedDays: "Uniquement les jours choisis.",
      daysUtc: "Les jours suivent l’heure UTC (temps universel coordonné).",
      firstArticleOnly: "Votre premier article est envoyé dès qu’il est prêt, quel que soit votre choix, pour que vous voyiez le rendu sur votre site.",
      networkReview: "Tant que votre site fait partie du Réseau partenaire, l’équipe RepGet vérifie chaque article - le premier aussi - et aucun ne part avant son jour prévu.",
      openIntegrations: "Ouvrir Intégrations",
      weekdaysShort: { sun: "Dim", mon: "Lun", tue: "Mar", wed: "Mer", thu: "Jeu", fri: "Ven", sat: "Sam" },
      weekdaysLong: { sun: "Dimanche", mon: "Lundi", tue: "Mardi", wed: "Mercredi", thu: "Jeudi", fri: "Vendredi", sat: "Samedi" },
      bodyImageStyles: {
        sketch: { label: "Croquis", hint: "Trait dessiné à la main sur une couleur douce." },
        watercolour: { label: "Aquarelle", hint: "Lavis peints tout en douceur." },
        realistic: { label: "Réaliste", hint: "Photographique." },
        illustration: { label: "Illustration", hint: "Formes vectorielles en aplat." },
        "brand-text": { label: "Marque et texte", hint: "Une photo avec un bandeau de couleur vive le long d’un bord." },
      },
      coverImageStyles: {
        sketch: { label: "Croquis", hint: "Trait dessiné à la main sur une couleur douce." },
        watercolour: { label: "Aquarelle", hint: "Lavis peints tout en douceur." },
        illustration: { label: "Illustration", hint: "Formes vectorielles en aplat." },
        match: { label: "Comme les images de l’article", hint: "Suit le style d’image ci-dessus." },
      },
      styles: {
        expert: { label: "Expert", hint: "Ton éditorial précis, nuances et terminologie équilibrées." },
        conversational: { label: "Conversationnel", hint: "Des phrases simples et directes. Explique les termes dès leur première apparition." },
        friendly: { label: "Chaleureux", hint: "Encourageant, à la deuxième personne, peu de jargon." },
        journalistic: { label: "Journalistique", hint: "Commence par le constat, attribue les affirmations, sans langage marketing." },
      },
    },
    editor: {
      backToWebsite: "Retour au site",
      headings: "Titres",
      words: "Mots",
      keywordUses: "Occurrences du mot-clé",
      internalLinks: "Liens internes",
      externalLinks: "Liens externes",
      socialMentions: "Mentions sociales",
      starting: "Démarrage",
      takesAMinute: "Cela prend généralement une minute. La page se met à jour toute seule.",
      couldNotWrite: "Nous n\u2019avons pas pu rédiger celui-ci",
      tryAgain: "Réessayer",
      publishingHistory: "Historique de publication",
      historyHelp: "Chaque tentative est enregistrée, pour qu\u2019un échec soit visible plutôt que silencieux.",
      failed: "Échec",
      viewPost: "Voir l\u2019article",
      editArticle: "Modifier l\u2019article",
      editHelp: "Votre version précédente est conservée à chaque enregistrement.",
      previewUnsaved: "Cet aperçu inclut des modifications que vous n'avez pas encore enregistrées. Enregistrez-les dans l'onglet Modifier.",
      partnerLink: "Lien partenaire",
      partnerLinksNote: "Les mots surlignés sont des liens du réseau de partenaires placés par l'équipe RepGet.",
      title: "Titre",
      metaDescription: "Méta description",
      slugLabel: "Adresse sur votre site",
      slugPlaceholder: "films-mariage-italie",
      slugHelp: "Les espaces et la ponctuation deviennent des tirets. Laissez vide et votre site en choisira une à partir du titre.",
      articleContent: "Contenu de l\u2019article",
      saving: "Enregistrement…",
      saveChanges: "Enregistrer",
      saved: "Enregistré",
      rewriting: "Réécriture de l\u2019article…",
      sendAsDraft: "Envoyer en brouillon",
      publishedToSite: "Publié : il est en ligne sur votre site.",
      sentAsDraftToSite: "Envoyé sur votre site en brouillon.",
      viewOnSite: "Voir sur votre site",
      connectToPublish: "Connectez votre site pour publier",
      publishViaPlugin: "Votre site n’a pas répondu, l’article est donc en file d’attente : le plugin WordPress l’envoie à sa prochaine vérification, dans l’heure. Mettez le plugin à jour en 1.4 ou plus pour publier instantanément.",
      waitingForPlugin: "En attente du plugin WordPress",
      updatePost: "Mettre à jour",
      publish: "Publier",
      sendingDraft: "Envoi en brouillon…",
      breadcrumbLabel: "Fil d’Ariane",
      targetKeywordLabel: "Mot-clé cible",
      lastSaved: "Dernière mise à jour : {date}",
      viewModeLabel: "Aperçu ou modification",
      unsavedMark: "Modifications non enregistrées",
      previewLabel: "Aperçu de l’article",
      previewUnsavedNow: "Vous prévisualisez des modifications qui ne sont pas encore enregistrées. Votre site ne les reçoit qu’après enregistrement et publication.",
      notWrittenYet: "L’article apparaîtra ici dès qu’il sera rédigé.",
      workingPaused: "La modification et la publication attendent la fin, car la nouvelle version remplace le texte.",
      conflictTitle: "Cet article a changé pendant que vous le modifiiez",
      conflictBody: "Entre-temps, la version enregistrée a changé pour : {fields}, par exemple parce qu’une réécriture s’est terminée ou que quelqu’un d’autre a enregistré. Si vous enregistrez maintenant, votre version remplace celle-ci.",
      conflictLoad: "Utiliser la version enregistrée",
      conflictKeep: "Garder ma version",
      genUnavailable: "La rédaction est momentanément indisponible. Le problème vient de chez nous et nous y travaillons.",
      genBusy: "Le service de rédaction était saturé. Réessayez dans quelques minutes.",
      genTimeout: "La rédaction a pris trop de temps et s’est arrêtée. Réessayez : c’est généralement passager.",
      genUnusable: "Nous n’avons pas pu tirer un article exploitable de ce sujet. Réessayez, ou précisez le sujet et le mot-clé cible.",
      genQuota: "Cet espace de travail a utilisé tous ses articles du mois. Passez à une offre supérieure pour en rédiger davantage.",
      genGeneric: "La rédaction de cet article n’a pas abouti. Réessayez. Si cela se reproduit, contactez le support.",
      pubErrAuth: "Votre site a refusé l’identifiant enregistré. Reconnectez-le sur la page Intégrations.",
      pubErrPermission: "Le compte connecté n’a pas le droit de publier des articles. Connectez un compte qui peut publier.",
      pubErrNotFound: "L’adresse de votre site est introuvable. Vérifiez-la sur la page Intégrations.",
      pubErrUnreachable: "Votre site n’a pas répondu. C’est généralement passager : réessayez, ou vérifiez que le site est en ligne.",
      pubErrApiDisabled: "Votre site est en ligne, mais son interface de publication est désactivée, souvent par une extension de sécurité. Réactivez-la, puis testez la connexion.",
      pubErrUnsupported: "Votre site fonctionne d’une façon sur laquelle nous ne pouvons pas encore publier.",
      pubErrUnknown: "La publication n’a pas abouti. Réessayez. Si cela se reproduit, contactez le support.",
      editSaveNote: "Le titre, la méta description, l’adresse et le texte s’enregistrent ensemble avec le bouton Enregistrer. L’image mise en avant s’enregistre dès que vous la modifiez.",
      titleRequired: "Saisissez un titre.",
      metaHint: "Affichée sous le titre dans les résultats de recherche, qui en montrent généralement les {count} premiers caractères environ.",
      slugSavedAs: "Enregistrée sous : {slug}",
      slugEmptyNote: "Si vous la laissez vide, votre site choisit l’adresse à partir du titre.",
      slugDropped: "Les lettres accentuées et autres caractères spéciaux sont omis de l’adresse.",
      slugWordPressNote: "WordPress conserve l’adresse sous laquelle l’article a été publié la première fois. La modifier ici ne déplace pas l’article en ligne.",
      searchPreviewTitle: "Aperçu dans les résultats de recherche",
      searchPreviewHelp: "Il s’agit d’une approximation. Les moteurs de recherche décident de ce qu’ils affichent.",
      saveArticle: "Enregistrer l’article",
      saveNoteWorking: "L’enregistrement attend pendant la rédaction de l’article.",
      saveNoteDelivering: "L’enregistrement attend pendant l’envoi de l’article à votre site.",
      saveNoteReview: "Enregistrer des modifications renvoie cet article en relecture auprès de l’équipe RepGet.",
      saveNoteTitle: "Saisissez un titre pour enregistrer.",
      statsTitle: "Statistiques de l’article",
      statsHelp: "Calculées à partir du texte de l’article.",
      statsUnsaved: "Calculées à partir du texte affiché, y compris les modifications non enregistrées.",
      publishingTitle: "Publication",
      publishingHelp: "Publier envoie à votre site la dernière version enregistrée.",
      destinationLabel: "Destination",
      destinationNone: "Non connecté",
      destinationPlugin: "Plugin WordPress",
      manageConnection: "Gérer la connexion",
      plannedLabel: "Date prévue",
      plannedNone: "Aucune date prévue",
      autoLabel: "Publication automatique",
      autoOnLive: "Activée, en articles publiés",
      autoOnDraft: "Activée, en brouillons",
      autoOff: "Désactivée",
      beforePlanned: "Publier maintenant l’envoie immédiatement, avant sa date prévue.",
      stateNotSent: "Pas encore envoyé à votre site.",
      stateLive: "En ligne sur votre site. Dernier envoi : {date}.",
      stateDraft: "Sur votre site en brouillon. Dernier envoi : {date}.",
      stateScheduled: "Programmé sur votre site. Dernier envoi : {date}.",
      stateDelivered: "Livré à votre site le {date}.",
      stateFailed: "La dernière tentative ({date}) n’a pas abouti.",
      statePluginUnconfirmed: "Le plugin WordPress n’a pas confirmé la dernière remise ({date}).",
      stateWriting: "La publication sera possible une fois l’article rédigé.",
      stateFrozen: "La publication est suspendue par l’équipe RepGet. Rien n’est envoyé aux sites tant qu’elle n’a pas repris.",
      stateReviewPending: "L’équipe RepGet prépare cet article pour le réseau de partenaires. Il sera publié dès qu’elle l’aura approuvé.",
      stateReviewChanged: "Cet article a changé après l’approbation de l’équipe RepGet ; il est donc de nouveau en relecture.",
      stateDelivering: "Envoi à votre site en cours…",
      stateQueued: "En file d’attente depuis {time}. Le résultat s’affichera ici quand votre site répondra.",
      stateQueuedLong: "Toujours aucun résultat. L’envoi peut être retenu, par exemple tant qu’une tentative précédente n’est pas résolue. Vérifiez de nouveau dans quelques minutes.",
      checkAgain: "Vérifier de nouveau",
      statePluginWaiting: "En attente du plugin WordPress, qui doit le récupérer en tant que {mode}. Le plugin se manifeste au moins une fois par heure.",
      modeLive: "article publié",
      modeDraft: "brouillon",
      statePluginPublished: "Le plugin WordPress a créé cet article et ne peut plus le modifier ensuite : les changements enregistrés ici n’atteignent donc pas votre site. Faites les modifications suivantes dans WordPress.",
      stateUncertain: "La dernière tentative n’a reçu aucune réponse de votre site. Consultez l’avis en haut de la page.",
      uncertainPublishNote: "Tant que ce point n’est pas résolu, publier de nouveau ne crée pas de second article : nous cherchons d’abord le précédent.",
      connectHelp: "Connectez votre site pour y publier cet article.",
      blockedUnsaved: "Enregistrez d’abord vos modifications. Publier envoie la version enregistrée, pas ce qui est à l’écran.",
      alreadySentLive: "Cette version exacte est déjà en ligne sur votre site.",
      alreadySentDraft: "Cette version exacte est déjà sur votre site en brouillon.",
      confirmDraftTitle: "Repasser l’article en ligne en brouillon ?",
      confirmDraftBody: "Cet article est en ligne sur votre site. L’envoyer en brouillon peut mettre l’article hors ligne (c’est le cas avec WordPress). Pour modifier l’article en ligne, utilisez plutôt Mettre à jour.",
      historyLatest: "Les {count} dernières tentatives, de la plus récente à la plus ancienne.",
      historyEmpty: "Rien n’a encore été envoyé à votre site.",
      logLive: "En ligne",
      logDraft: "Envoyé en brouillon",
      logScheduled: "Programmé",
      logDelivered: "Livré",
      rewriteTitle: "Réécrire l’article",
      rewriteHelp: "Rédige de nouveau tout l’article à partir de son plan. Chaque site peut réécrire {count} articles par jour.",
      rewriteConfirmTitle: "Réécrire cet article ?",
      rewriteConfirmBody: "Le texte, la méta description, l’adresse et l’image mise en avant sont remplacés par une nouvelle version. La version actuelle n’est pas conservée.",
      rewriteConfirmPublished: "L’article sur votre site reste inchangé jusqu’à ce que vous publiiez la nouvelle version.",
      rewriteConfirmReview: "La nouvelle version passe en relecture auprès de l’équipe RepGet avant de pouvoir être publiée.",
      rewriteConfirmUnsaved: "Vos modifications non enregistrées sont abandonnées.",
      rewriteConfirmAction: "Réécrire",
      rewriteNoPlan: "Cet article n’a pas d’entrée dans le plan, il ne peut donc pas être rédigé de nouveau.",
      rewriteBlocked: "De nouveau disponible quand la rédaction ou l’envoi en cours sera terminé.",
      imagePromptHint: "Laissez vide et nous choisissons. Il reste {remaining} nouvelles images sur {max} pour cet article.",
      imageGenerate: "Générer",
      imageReplace: "Remplacer",
      imageAltHint: "Enregistrée quand vous quittez le champ.",
      imageCheckAlt: "Vérifiez que la description correspond toujours à la nouvelle image.",
      imageLockedWorking: "Attendez que l’article soit rédigé : une réécriture remplace l’image.",
      imageLockedDelivering: "Attendez la fin de l’envoi à votre site.",
      imageTypeError: "Utilisez une image PNG, JPEG ou WebP.",
      imageSizeError: "Cette image pèse {size} Mo. La limite est de {max} Mo.",
      imageNoAlt: "Pas encore de description.",
      imageAltSaved: "Description enregistrée.",
      errInFlight: "Cet article est en cours d’envoi vers votre site. Réessayez dans une minute.",
      errNotWritten: "Cet article n’a pas encore été rédigé.",
      errConnectFirst: "Connectez votre site avant de publier.",
      errNotFound: "Cet article n’existe plus.",
      errRewriteCap: "Ce site a utilisé toutes ses réécritures des dernières 24 heures. Réessayez plus tard.",
      errAlreadyWriting: "Cet article est déjà en cours de rédaction.",
      errNoActivePlan: "Cet espace de travail n’a pas d’offre active. Choisissez-en une pour continuer à rédiger.",
      errImageStorage: "Le stockage des images est indisponible pour le moment. Réessayez plus tard.",
      errImageGeneration: "La génération d’images est indisponible pour le moment. Réessayez plus tard.",
      metaNone: "Pas encore de méta description. Les moteurs de recherche affichent alors un extrait de l’article.",
      searchPreviewUnsaved: "L’aperçu inclut des modifications pas encore enregistrées.",
      imageReviewNote: "Modifier l’image ou sa description renvoie cet article en relecture auprès de l’équipe RepGet.",
      planningOutline: "Préparation du plan",
      writingBody: "Rédaction de l\u2019article",
    },
    analytics: {
      googleResults: "Résultats Google",
      connectHelp: "Connectez Google pour voir quelles recherches amènent des visiteurs sur votre site, et comment cela évolue à mesure que nous publions.",
      connectGoogle: "Connecter Google",
      redirecting: "Redirection…",
      expired: "La connexion précédente a expiré. Reconnectez-vous pour reprendre l\u2019import.",
      connected: "Connecté",
      last28: "28 derniers jours.",
      chooseThenImport: "Choisissez vos propriétés ci-dessous, puis enregistrez pour importer vos données.",
      visitorsFromGoogle: "Visiteurs venus de Google",
      timesAppeared: "Apparitions",
      averageRanking: "Position moyenne",
      websiteVisits: "Visites du site",
      whatPeopleSearched: "Ce que les gens ont cherché pour vous trouver",
      query: "Requête",
      visitors: "Visiteurs",
      searchConsoleProperty: "Propriété Search Console",
      analyticsProperty: "Propriété Analytics",
      chooseProperty: "Choisir une propriété",
      importing: "Import de vos données - cela prend un instant",
      disconnected: "Google déconnecté",
      statusConnected: "Google connecté",
      statusCancelled: "Connexion annulée",
      statusForbidden: "Vous ne pouvez pas connecter ce site",
      statusInvalid: "Ce lien n\u2019était pas valide - réessayez",
      statusError: "Google n\u2019a pas pu être connecté",
      pageTitle: "Google Search et Analytics",
      pageDescription: "Comment les internautes trouvent votre site dans la recherche Google, et combien de visites il reçoit. Les chiffres proviennent de vos propres comptes Search Console et Google Analytics.",
      rangeLabel: "Période",
      rangeDays: "{days} jours",
      periodDates: "{start} – {end}",
      connectTitle: "Connectez vos comptes Google",
      searchConsoleName: "Google Search Console",
      analyticsName: "Google Analytics",
      searchConsolePurpose: "Montre les performances de votre site dans la recherche Google : combien de fois il est affiché (impressions), combien de fois on clique dessus (clics), sa position moyenne, et quelles recherches et pages amènent des visiteurs.",
      analyticsPurpose: "Montre combien de visites (sessions) reçoit l’ensemble de votre site, quelle qu’en soit l’origine : Google, autres moteurs de recherche, réseaux sociaux, liens et saisie directe de votre adresse.",
      setupTitle: "Comment fonctionne la connexion",
      setupStep1: "Connectez-vous avec le compte Google qui voit ce site dans Search Console et, si vous l’utilisez, dans Google Analytics. Une seule connexion couvre les deux.",
      setupStep2: "Google vous demande d’autoriser un accès en lecture seule. RepGet peut lire vos chiffres mais ne peut rien modifier dans vos comptes Google.",
      setupStep3: "De retour ici, choisissez la propriété Search Console et la propriété Analytics de ce site. RepGet importe environ les deux derniers mois, puis les nouveaux chiffres chaque jour.",
      readOnlyAccess: "Accès en lecture seule. Vous pouvez vous déconnecter à tout moment.",
      expiredTitle: "Google doit être reconnecté",
      reconnectGoogle: "Reconnecter Google",
      viewerCannotConnect: "Seul un propriétaire ou un éditeur de ce site peut connecter Google.",
      connectionTitle: "Connexion Google",
      connectionHelp: "RepGet importe de nouveaux chiffres chaque jour. Google les publie avec environ trois jours de retard.",
      notChosen: "Non choisie",
      dataThrough: "Chiffres jusqu’au {date}",
      noFiguresYet: "Aucun chiffre de Google pour l’instant",
      analyticsPropertyId: "Propriété {id}",
      importNow: "Importer maintenant",
      manageConnection: "Gérer la connexion",
      viewerSetupPending: "Google est connecté, mais aucune propriété n’a encore été choisie. Un propriétaire ou un éditeur peut en choisir une.",
      importRequestedTitle: "Import demandé",
      importRequestedBody: "RepGet importe vos chiffres depuis Google. Cette page les recherche pendant environ une minute.",
      importStillRunning: "L’import peut prendre quelques minutes. Les nouveaux chiffres apparaîtront ici une fois terminé : rechargez la page plus tard pour les voir.",
      setupNeededTitle: "Choisissez quoi importer",
      setupNeededBody: "Choisissez la propriété Search Console et la propriété Analytics de ce site, puis enregistrez. Une seule des deux suffit.",
      propertiesTitle: "Propriétés",
      propertiesHelp: "Les propriétés Google qui correspondent à ce site.",
      loadingProperties: "Chargement des propriétés visibles par votre compte Google…",
      propertiesFailed: "Vos propriétés n’ont pas pu être chargées depuis Google. Réessayez, ou reconnectez Google si le problème persiste.",
      tryAgain: "Réessayer",
      searchConsoleHint: "La propriété Search Console de ce site, par exemple une propriété de domaine.",
      analyticsHint: "La propriété Google Analytics 4 de ce site.",
      noSearchConsoleFound: "Aucune propriété Search Console n’a été trouvée pour ce compte Google. Vérifiez qu’il y a accès, ou reconnectez-vous avec un autre compte.",
      noAnalyticsFound: "Aucune propriété Google Analytics 4 n’a été trouvée pour ce compte Google. Vérifiez qu’il y a accès, ou reconnectez-vous avec un autre compte.",
      noSearchConsoleProperty: "Aucune (ne pas importer depuis Search Console)",
      noAnalyticsProperty: "Aucune (ne pas importer depuis Analytics)",
      propertyUnavailable: "{name} (non disponible pour ce compte Google)",
      saveAndImport: "Enregistrer et importer",
      saveSelection: "Enregistrer",
      selectionUnsaved: "Votre nouveau choix n’est pas encore enregistré.",
      noSelectionChange: "Aucune modification à enregistrer.",
      propertiesSaved: "Propriétés enregistrées",
      accountTitle: "Compte Google",
      accountHelp: "Reconnectez-vous pour renouveler l’accès ou passer à un autre compte Google. Les propriétés choisies sont conservées.",
      disconnect: "Déconnecter",
      disconnecting: "Déconnexion…",
      disconnectTitle: "Déconnecter Google ?",
      disconnectBody: "RepGet cesse d’importer depuis Search Console et Analytics pour ce site et oublie les propriétés choisies.",
      disconnectKeeps: "Les chiffres déjà importés sont conservés.",
      disconnectAccess: "Pour retirer aussi l’accès de RepGet à votre compte Google, utilisez les paramètres de sécurité de votre compte Google.",
      cancel: "Annuler",
      disconnectFailed: "Google n’a pas pu être déconnecté. Réessayez.",
      importFailed: "L’import n’a pas pu être demandé. Réessayez.",
      googleUnreachable: "Google n’a pas pu être joint avec la connexion enregistrée. Reconnectez Google et réessayez.",
      errorNotConfigured: "La connexion à Google n’est pas encore disponible. Veuillez contacter le support.",
      errorSignIn: "Reconnectez-vous à votre compte pour connecter Google.",
      errorReconnect: "Reconnectez votre compte Google pour continuer.",
      errorConnectFirst: "Connectez d’abord Google.",
      errorChooseFirst: "Choisissez d’abord une propriété à importer.",
      searchTitle: "Recherche Google",
      searchDescription: "Chiffres de tout le site, issus de Search Console : toutes les pages de votre site dans la recherche Google, pas seulement les articles rédigés par RepGet.",
      analyticsTitle: "Visites du site",
      analyticsDescription: "Sessions sur l’ensemble de votre site, toutes origines confondues, d’après Google Analytics. Pas seulement les visites venues de la recherche Google.",
      clicks: "Clics",
      clicksHint: "Nombre de fois où quelqu’un a cliqué vers votre site depuis la recherche Google.",
      impressions: "Impressions",
      impressionsHint: "Nombre de fois où votre site est apparu dans les résultats de recherche Google.",
      ctr: "Taux de clics (CTR)",
      ctrShort: "CTR",
      ctrHint: "Clics divisés par impressions.",
      averagePosition: "Position moyenne",
      positionShort: "Position moy.",
      positionHint: "Votre place moyenne dans les résultats Google, pondérée par les impressions. Plus elle est basse, mieux c’est.",
      sessions: "Sessions",
      sessionsHint: "Visites de votre site, toutes origines confondues. Une même personne peut faire plusieurs sessions.",
      comparedWith: "Les évolutions sont comparées aux {days} jours précédents.",
      noComparison: "Pas de comparaison : les {days} jours précédents n’ont pas tous des chiffres de Google.",
      noChange: "Aucun changement",
      better: "mieux",
      worse: "moins bien",
      pointsChange: "{value} pts",
      notAvailable: "Non disponible",
      daysReported: "Données sur {reported} des {days} jours",
      zeroSearch: "Search Console n’a enregistré aucune impression sur cette période.",
      zeroSessions: "Google Analytics n’a enregistré aucune session sur cette période.",
      staleSource: "Aucune propriété {source} n’est choisie : ces chiffres ne sont plus mis à jour.",
      notSelectedTitle: "Aucune propriété {source} choisie",
      notSelectedEditor: "Choisissez-en une dans Connexion Google pour voir ces chiffres ici.",
      notSelectedViewer: "Un propriétaire ou un éditeur peut en choisir une dans Connexion Google.",
      awaitingTitle: "Pas encore de chiffres {source}",
      awaitingBody: "Google n’a encore communiqué aucun chiffre pour cette propriété. Les sites nouveaux ou peu fréquentés peuvent n’en avoir aucun pendant un certain temps. RepGet vérifie chaque jour s’il y a de nouveaux chiffres.",
      noneInPeriodTitle: "Aucun chiffre {source} sur cette période",
      latestFrom: "Les chiffres les plus récents datent du {date}. Choisissez une période plus longue pour les inclure.",
      latestOnly: "Les chiffres les plus récents datent du {date}.",
      dailyTitle: "Jour par jour",
      dailyDescription: "Les jours que Google n’a pas communiqués restent vides au lieu d’être affichés à zéro.",
      chartMetric: "Chiffre affiché dans le graphique",
      chartClicks: "Clics depuis la recherche Google par jour",
      chartImpressions: "Impressions dans la recherche Google par jour",
      chartSessions: "Sessions par jour",
      unitClicks: "clics",
      unitImpressions: "impressions",
      unitSessions: "sessions",
      notReported: "non communiqué",
      day: "Jour",
      chartInstructions: "Utilisez les flèches gauche et droite pour passer d’un jour à l’autre.",
      chartEmpty: "Aucun chiffre quotidien sur cette période.",
      topTitle: "Principales recherches et pages",
      topSearches: "Recherches",
      topPages: "Pages",
      searchTerm: "Recherche",
      page: "Page",
      topSearchesNote: "Les 10 recherches qui génèrent le plus de clics. Google omet les recherches rares pour protéger la vie privée, leur somme est donc inférieure aux totaux ci-dessus.",
      topPagesNote: "Les 10 pages qui reçoivent le plus de clics depuis la recherche Google.",
      topSearchesCaption: "Principales recherches sur cette période",
      topPagesCaption: "Principales pages sur cette période",
      noSearches: "Aucune recherche enregistrée sur cette période.",
      noPages: "Aucune page enregistrée sur cette période.",
      opensInNewTab: "(s’ouvre dans un nouvel onglet)",
    },
    research: {
      contentPlan: "Plan de contenu",
      articlesTab: "Articles",
      opportunities: "Opportunités",
      refresh: "Actualiser",
      looking: "Recherche…",
      researchFailed: "La recherche n’a pas pu aboutir, aucun plan de contenu n’a donc été créé. Appuyez sur le bouton pour réessayer ; en cas de second échec, contactez le support.",
      planReady: "Votre plan de contenu est prêt.",
      planNotRebuilt: "Votre plan de contenu n’a pas pu être reconstruit, le plan précédent reste donc inchangé. Appuyez sur le bouton pour réessayer ; en cas de second échec, contactez le support.",
      keywordsAdded: "Ajoutés : {added}.",
      keywordsAddedSkipped: "Ajoutés : {added}. Ignorés : {skipped}, déjà suivis ou au-delà de votre forfait.",
      replanning: "Reconstruction de votre plan de contenu…",
      planBusy: "Votre plan est en cours de création : appuyez sur {button} une fois qu’il est prêt pour les inclure.",
      plannedArticles: "Articles planifiés",
      plannedHelp: "Votre plan de contenu, par date de publication prévue. Survolez un sujet planifié pour le rédiger maintenant, le modifier ou le retirer du plan.",
      articles: "Articles",
      articlesHelp: "Rédigés à partir de votre plan de contenu. Ouvrez-en un pour le lire, le modifier ou le réécrire.",
      nothingWritten: "Rien de rédigé pour l\u2019instant. Utilisez",
      write: "Rédiger",
      title: "Titre",
      status: "Statut",
      words: "Mots",
      keywords: "Mots-clés",
      keywordsHelp: "Classés selon ce que vous pouvez réellement gagner. Un terme moins recherché sur lequel vous pouvez vous positionner vaut mieux qu\u2019un terme populaire hors de portée.",
      addKeywordsLabel: "Ajoutez vos propres mots-clés",
      addKeywordsButton: "Ajouter",
      addKeywordsPlaceholder: "vidéaste mariage toscane, film d’élopement italie",
      addKeywordsHelp: "Séparez-les par des virgules ou des retours à la ligne. Les termes que vous ajoutez n’ont pas de données de recherche propres, mais ils orientent tout de même vos thèmes et votre plan de contenu.",
      keyword: "Mot-clé",
      opportunity: "Opportunité",
      searchesPerMonth: "Recherches / mois",
      competition: "Concurrence",
      topic: "Sujet",
      difficultyLow: "Faible",
      difficultyMedium: "Moyenne",
      difficultyHigh: "Élevée",
      difficultyVeryHigh: "Très élevée",
      researching: "Recherche de mots-clés - cela prend une minute",
      articleDeleted: "Article supprimé",
      statusQueued: "En attente",
      statusGenerating: "Rédaction…",
      statusDraft: "Brouillon",
      statusPublished: "Publié",
      statusFailed: "Échec",
    },
    publishing: {
      connectTitle: "Connectez votre site",
      connectHelp: "Connectez votre site une fois et les nouveaux articles seront publiés automatiquement sur votre blog.",
      nothingConnected: "Rien de connecté pour l’instant",
      nothingConnectedHelp: "Connectez votre site et nous pourrons y publier les articles terminés directement. En attendant, vous pouvez les copier à la main.",
      publishTest: "Publier un article de test",
      publishing: "Publication…",
      disconnect: "Déconnecter",
      connected: "Connecté",
      cantFind: "Vous ne trouvez pas votre intégration ?",
      cantFindHelp: "Dites-nous quelle plateforme vous utilisez et nous étudierons son ajout.",
      contactUs: "Nous contacter",
      whereDoIFind: "Où les trouver ?",
      checkBeforeSaving: "Nous vérifions la connexion avant tout enregistrement, pour que vous le sachiez maintenant plutôt qu\u2019au moment où un article échoue.",
      noPlatformMatch: "Aucune plateforme ne correspond ? Publiez partout avec un webhook.",
      forDevelopers: "Pour les développeurs",
      connectTo: "Connecter {name}",
      connectedTo: "Connecté à {name}",
      disconnectedFrom: "Déconnecté de {name}",
      draftPublished: "Brouillon publié. Vérifiez les brouillons de votre site.",
      draftPublishedAt: "Brouillon publié - ouvrez-le sur {name}",
      pluginRowName: "Extension WordPress",
      pluginAwaiting: "En attente de WordPress",
      pluginAwaitingHelp: "Dans l’onglet WordPress ouvert par RepGet, cliquez sur Finish connecting to RepGet (Save and connect sur les anciennes extensions), ou sur Connecter WordPress ci-dessous.",
      pluginRowFallback: "Connecté - en attente de son premier rapport.",
    },
    geo: {
      aiVisibility: "Visibilité dans l\u2019IA",
      aiVisibilityHelp: "Si un assistant IA cite votre entreprise quand on lui demande une entreprise comme la vôtre.",
      checkNow: "Vérifier maintenant",
      checking: "Vérification…",
      visibilityScore: "Score de visibilité",
      weightedByPosition: "Pondéré par la position",
      vsLastCheck: "vs dernière vérification",
      questionsNamingYou: "Questions qui vous citent",
      averagePosition: "Position moyenne",
      notYetNamed: "Pas encore cité",
      whereYouAppear: "Où vous apparaissez dans la liste",
      lastChecked: "Dernière vérification",
      questionPlaceholder: "ex. Quel dentiste à Utrecht est le meilleur pour les patients anxieux ?",
      add: "Ajouter",
      suggest: "Suggérer",
      askHelp: "Posez la question comme le ferait un client, sans nommer votre entreprise - le but est de voir si vous ressortez de vous-même.",
      suggestedQuestions: "Questions suggérées - cliquez pour suivre",
      noQuestions: "Aucune question suivie",
      noQuestionsHelp: "Ajoutez les questions que vos clients poseraient à un assistant IA, puis vérifiez si votre entreprise est citée dans la réponse.",
      notChecked: "Non vérifié",
      notNamed: "Non cité",
      stopTracking: "Ne plus suivre cette question",
      questionAdded: "Question ajoutée",
      checkQueued: "Vérification - les résultats apparaîtront ici dans quelques minutes",
      alreadyTracking: "Vous suivez déjà les questions que nous suggérerions",
      checksUnavailableTitle: "Les vérifications et suggestions sont suspendues pour ce site",
      errAiUnavailable: "Les vérifications par IA ne sont pas disponibles pour le moment. Veuillez réessayer plus tard.",
      errNoPlan: "Choisissez une offre pour ce site afin de lancer des vérifications et d’obtenir des suggestions.",
      errPlanInactive: "L’abonnement de ce site n’est pas actif. Mettez à jour la facturation pour lancer des vérifications et obtenir des suggestions.",
      errCheckQuota: "La visibilité dans l’IA a été vérifiée plusieurs fois au cours de la dernière heure. Veuillez réessayer plus tard.",
      errSuggestQuota: "Des suggestions ont été demandées de nombreuses fois cette heure-ci. Veuillez réessayer plus tard.",
      errSuggestFailed: "Impossible de suggérer des questions. Veuillez réessayer.",
      errTooShort: "Écrivez une question d’au moins quelques mots.",
      errAllowance: "Votre offre suit jusqu’à {count} questions. Retirez-en une pour en ajouter une autre.",
      errDuplicate: "Vous suivez déjà cette question.",
      errAddFirst: "Ajoutez d’abord une question.",
      errUnexpected: "Un problème est survenu. Veuillez réessayer.",
      statusQueuedTitle: "Vérification en file d’attente",
      statusQueuedBody: "En attente du démarrage de la vérification. Les réponses apparaissent ici question par question, et vous pouvez quitter cette page en attendant.",
      statusRunningTitle: "Vérification de vos questions",
      statusRunningBody: "Les réponses apparaissent ici question par question. Vous pouvez quitter cette page en attendant.",
      statusProgress: "Réponses reçues : {answered} sur {total} questions",
      statusRequestedAt: "Demandée le {date}",
      statusCompletedTitle: "Vérification terminée",
      statusCompletedBody: "Chaque question de cette vérification a reçu une nouvelle réponse.",
      statusPartialTitle: "Vérification terminée avec des manques",
      statusPartialBody: "Nouvelles réponses : {answered} sur {total} questions. Les autres n’en ont pas reçu en 10 minutes ; elles gardent leur résultat précédent et sont signalées ci-dessous.",
      statusTimedOutTitle: "Pas encore de réponse",
      statusTimedOutBody: "Aucune réponse n’est arrivée en 10 minutes. La vérification attend peut-être encore de démarrer, ou elle a échoué. Revenez plus tard ou lancez une autre vérification.",
      statusTimedOutBodyViewer: "Aucune réponse n’est arrivée en 10 minutes. La vérification attend peut-être encore de démarrer, ou elle a échoué. Revenez plus tard.",
      statusFailedTitle:"La vérification n’a pas eu lieu",
      statusFailedBody: "Aucune réponse n’a été enregistrée pour la vérification demandée le {date}. Vous pouvez lancer une autre vérification.",
      statusFailedBodyViewer: "Aucune réponse n’a été enregistrée pour la vérification demandée le {date}.",
      statusRefusedTitle: "La vérification n’a pas été lancée",
      dismiss: "Masquer",
      progressLabel: "Avancement de la vérification",
      performanceTitle: "Où en est votre site",
      performanceHelp: "Mesuré à partir de la dernière réponse à chaque question vérifiée.",
      howMeasured: "Comment c’est mesuré",
      scoreOutOf: "sur 100",
      scoreGood: "Bon",
      scoreFair: "Moyen",
      scoreLow: "Faible",
      scoreUp: "{change} points de plus qu’à la vérification précédente",
      scoreDown: "{change} points de moins qu’à la vérification précédente",
      scoreSame: "Aucun changement depuis la vérification précédente",
      previousCheckOn: "Vérification précédente : {date}",
      firstCheck: "Première vérification, rien à comparer pour l’instant",
      namedOfChecked: "{mentions} sur {total}",
      namedOfCheckedHelp: "Questions vérifiées où votre entreprise a été recommandée",
      positionValue: "n° {position}",
      answeredInLatestCheck: "Réponses lors de cette vérification : {count} sur {total} questions",
      basisNote: "Basé sur la dernière réponse à {checked} des {tracked} questions suivies.",
      earlierAnswersNote: "1 de ces réponses provient d’une vérification antérieure.|{count} de ces réponses proviennent de vérifications antérieures.",
      notCheckedYetTitle: "Pas encore vérifié",
      notCheckedYetBody: "Aucune question n’a été vérifiée, il n’y a donc pas encore de score. Un score n’apparaît qu’une fois qu’un assistant a réellement été interrogé.",
      competitorsHelp: "Autres entreprises recommandées dans les dernières réponses, selon le nombre de réponses qui les citent.",
      competitorCount: "Réponses qui la citent : {count} sur {total}",
      noCompetitors: "Aucune autre entreprise n’a été citée dans les dernières réponses.",
      nextStep: "Prochaine étape",
      nextAddQuestions: "Ajoutez les questions que vos clients poseraient, ou demandez des suggestions.",
      nextAddQuestionsAction: "Ajouter des questions",
      nextFirstCheck: "Lancez la première vérification pour voir si les assistants citent votre entreprise.",
      nextUnchecked: "1 question n’a pas encore été vérifiée. Lancez une vérification pour l’inclure.|{count} questions n’ont pas encore été vérifiées. Lancez une vérification pour les inclure.",
      nextStale: "1 réponse provient d’une vérification antérieure. Lancez une vérification pour l’actualiser.|{count} réponses proviennent de vérifications antérieures. Lancez une vérification pour les actualiser.",
      nextNotNamed: "Les assistants ne vous ont pas cité pour 1 question. Voyez qui ils ont cité à votre place.|Les assistants ne vous ont pas cité pour {count} questions. Voyez qui ils ont cité à votre place.",
      nextNotNamedAction: "Afficher ces questions",
      nextUpToDate: "Vos résultats sont à jour. Une vérification a aussi lieu automatiquement une fois par semaine.",
      nextWaiting: "Une vérification est en cours. Les résultats apparaissent au fur et à mesure des réponses.",
      nextViewer: "Seul un propriétaire ou un éditeur peut lancer des vérifications ou modifier les questions.",
      questionsTitle: "Questions suivies",
      questionsHelp: "Les questions que vous suivez, chacune avec son dernier résultat et les preuves qui l’appuient.",
      allowanceCount: "{count} sur {max} questions",
      addQuestionLabel: "Ajouter une question",
      atAllowance: "Vous suivez autant de questions que votre offre le permet ({max}). Retirez-en une pour en ajouter une autre.",
      suggestionsTitle: "Questions suggérées",
      suggestionsHelp: "Choisissez celles à suivre. Rien n’est ajouté tant que vous n’appuyez pas sur Ajouter la sélection.",
      addSelected: "Ajouter la sélection ({count})",
      suggestionsRoom: "Vous pouvez ajouter encore 1 question avec votre offre.|Vous pouvez ajouter encore {count} questions avec votre offre.",
      questionsAdded: "1 question ajoutée|{count} questions ajoutées",
      questionRemoved: "Question retirée",
      filterLabel: "Afficher les questions",
      filterAll: "Toutes",
      filterEmpty: "Aucune question ne correspond à ce filtre.",
      showAll: "Afficher toutes les questions",
      noQuestionsViewer: "Aucune question n’est encore suivie. Un propriétaire ou un éditeur peut en ajouter.",
      named: "Cité",
      namedAt: "Cité n° {position}",
      checkedOn: "Vérifiée le {date}",
      fromEarlierCheck: "D’une vérification antérieure ({date})",
      checkingNow: "Vérification en cours…",
      noAnswerInCheck: "Pas de réponse à la dernière vérification",
      answeredInCheck: "Réponse reçue lors de cette vérification",
      siteMentioned: "Votre site a été mentionné",
      showEvidence: "Voir les preuves",
      hideEvidence: "Masquer les preuves",
      removeQuestionLabel: "Ne plus suivre : {question}",
      evidenceExcerpt: "Ce que disait la réponse",
      evidenceExcerptNote: "Seule la phrase qui cite votre entreprise est conservée, pas la réponse complète.",
      evidencePosition: "Votre position",
      evidencePositionValue: "N° {position} parmi les entreprises recommandées par la réponse",
      evidenceNotRecommended: "Absente des entreprises recommandées par la réponse",
      evidenceWebsite: "L’adresse de votre site",
      evidenceWebsiteYes: "Mentionnée dans la réponse",
      evidenceWebsiteNo: "Non mentionnée dans la réponse",
      evidenceOthers: "Autres entreprises citées, dans l’ordre",
      evidenceNoOthers: "Aucune autre entreprise n’a été citée.",
      evidenceAssistant: "Assistant interrogé",
      evidenceChecked: "Vérifiée",
      evidenceHistory: "Résultats précédents",
      evidenceNoHistory: "C’est le premier résultat enregistré pour cette question.",
      evidenceStale: "Cette réponse provient d’une vérification antérieure. La dernière vérification, le {date}, n’a pas donné de nouvelle réponse pour cette question.",
      evidenceMissed: "La dernière vérification n’a pas donné de nouvelle réponse pour cette question ; voici donc son résultat précédent.",
      removeTitle: "Ne plus suivre cette question ?",
      removeBody: "Ses réponses enregistrées et son historique sont aussi supprimés, et le score est recalculé sans elle. Cette action est définitive.",
      removeConfirm: "Ne plus suivre",
      removing: "Suppression…",
      methodTitle: "Ce qui est mesuré",
      methodHelp: "Comment fonctionne une vérification et ce que signifie chaque chiffre.",
      methodAskTitle: "Comment fonctionne une vérification",
      methodAskBody: "Chaque question suivie est posée à un assistant IA dans une nouvelle conversation, sans nommer votre entreprise. La réponse est ensuite lue pour lister, dans l’ordre, les entreprises qu’elle recommande.",
      methodRecordTitle: "Ce qui est enregistré",
      methodRecordBody: "Si votre entreprise en fait partie et à quelle position, la phrase qui la cite, les autres entreprises citées et si l’adresse de votre site apparaît. La réponse complète n’est pas conservée.",
      methodScoreTitle: "Comment le score est calculé",
      methodScoreBody: "Une question vérifiée vaut 100 quand vous êtes cité en premier, moins plus bas dans la liste (environ {second} en deuxième, {third} en troisième et {fourth} en quatrième position) et 0 quand vous n’êtes pas cité. Le score de visibilité est la moyenne de la dernière réponse à chaque question vérifiée. Les questions jamais vérifiées ne comptent pas.",
      methodCompareTitle: "Comparaisons",
      methodCompareBody: "L’évolution est mesurée par rapport à la vérification précédente, notée sur ses propres réponses. Des réponses espacées de plus d’une heure appartiennent à des vérifications différentes. Si les deux vérifications portaient sur des questions différentes, une partie de l’évolution vient de là.",
      methodScheduleTitle: "Quand les vérifications ont lieu",
      methodScheduleBody: "Quand un propriétaire ou un éditeur clique sur {action}, un nombre limité de fois par heure, et automatiquement une fois par semaine. Les réponses arrivent question par question en quelques minutes.",
      methodAssistantsTitle: "Assistants interrogés",
      methodAssistantsBody: "Les réponses enregistrées jusqu’ici proviennent de : {names}.",
    },
    backlinks: {
      title: "Liens depuis d\u2019autres sites",
      joinHelp: "Google fait davantage confiance à un site quand d\u2019autres sites pointent vers lui. Mentionnez une autre entreprise dans vos articles pour gagner un crédit, puis dépensez-le pour être mentionné sur le site de quelqu\u2019un d\u2019autre.",
      capLabel: "Mentions que vous inclurez chaque mois",
      capHelp: "Gardez ce nombre bas. Une page remplie de liens vers d\u2019autres entreprises paraît suspecte à Google.",
      join: "Rejoindre",
      leave: "Quitter",
      inTheNetwork: "Dans le réseau",
      creditsAvailable: "crédits disponibles",
      received: "Liens reçus",
      receivedFlow: "Mentionné dans d\u2019autres articles \u2192 Obtenez des liens \u2192 Dépensez des crédits",
      givenTitle: "Liens accordés",
      givenFlow: "Publiez des articles \u2192 Accordez des liens \u2192 Gagnez des crédits",
      whichPage: "Vers laquelle de vos pages faut-il pointer ?",
      suggestMyPages: "Suggérer mes pages",
      readingSitemap: "Lecture de votre sitemap…",
      anchorLabel: "Formulation souhaitée (facultatif)",
      anchorPlaceholder: "blanchiment dentaire à Dublin",
      requesting: "Demande…",
      requestLink: "Demander un lien (1 crédit)",
      noRequests: "Aucun lien reçu pour l’instant",
      noRequestsHelp: "Ajoutez ci-dessus, dans Réseau partenaire, les pages vers lesquelles vous souhaitez des liens. L’équipe RepGet les place dans des articles pertinents de partenaires ; un lien ne coûte ses crédits qu’une fois vérifié en ligne.",
      noneGiven: "Aucun pour l’instant. L’équipe RepGet peut placer le lien d’un partenaire pertinent dans l’un de vos articles avant sa publication ; vous gagnez ses crédits une fois le lien vérifié en ligne.",
      sourceArticle: "Article source",
      sourceArticleHint: "L\u2019article d\u2019un autre site qui pointe vers vous. Ouvrez-le pour voir le lien en ligne.",
      customerWebsite: "Site du client",
      customerWebsiteHint: "Le site du réseau qui a publié le lien.",
      creditsUsed: "Crédits utilisés",
      creditsUsedHint: "Crédits dépensés pour ce lien. Intégralement restitués si le lien est retiré.",
      yourArticleHint: "Votre article qui porte le lien.",
      destinationWebsite: "Site de destination",
      destinationWebsiteHint: "Le site vers lequel votre article pointe.",
      creditsEarned: "Crédits gagnés",
      creditsEarnedHint: "Crédits rapportés par ce lien, à dépenser pour des liens vers votre propre site.",
      onceLive: "+{n} une fois en ligne",
      held: "{n} réservés",
      cancelRequest: "Annuler la demande",
      untitledArticle: "Article sans titre",
      joined: "Vous êtes dans le réseau",
      leftNetwork: "Vous avez quitté le réseau",
      requestSaved: "Demande enregistrée - en attente d\u2019un site adapté",
      requestCancelled: "Demande annulée, crédit libéré",
      statusPending: "Recherche d\u2019un site",
      statusMatched: "En attente de leur prochain article",
      statusLive: "En ligne",
      statusCancelled: "Annulé",
      statusRemoved: "Retiré - crédit restitué",
      hosting: "Héberge jusqu’à {cap} liens par mois ({used} utilisés). {sites} site disponible pour pointer vers vous.|Héberge jusqu’à {cap} liens par mois ({used} utilisés). {sites} sites disponibles pour pointer vers vous.",
      reserved: " ({n} réservés)",
    },
    dashboard: {
      noWebsite: "Aucun site connecté pour l\u2019instant",
      noWebsiteHelp: "Ajoutez votre site et nous commencerons à trouver les recherches que vos clients utilisent vraiment.",
      addWebsite: "Ajouter un site",
      couldNotLoad: "Impossible de charger ce site",
      couldNotLoadHelp: "Réessayez ou choisissez un autre site.",
      overview: "Vue d\u2019ensemble SEO",
      openWebsite: "Ouvrir le site",
      performing: "Les performances de {domain} dans la recherche.",
      sharedBadge: "Partagé avec vous · {role}",
      ownerPlanInactive: "Ce site est en pause",
      ownerPlanInactiveHelp:
        "Le forfait de {domain} n\u2019est pas actif, rien de nouveau ne peut donc être créé. Demandez au propriétaire du site de le renouveler.",
      invitesTitle: "Invitations en attente",
      inviteBody: "{name} vous invite à travailler sur {domain} {role}.",
      inviteBodyNoName: "Vous avez reçu une invitation à travailler sur {domain} {role}.",
      roleAnEditor: "en tant qu\u2019éditeur",
      roleAViewer: "en tant que lecteur",
      acceptInvite: "Accepter l\u2019invitation",
      inviteAccepted: "Vous avez maintenant accès à {domain}",
    },
    calendar: {
      changeTopic: "Changer de sujet",
      addInstructions: "Ajouter des consignes",
      removeFromPlan: "Retirer du plan",
      instructionsPlaceholder: "Ce que cet article doit aborder ou éviter.",
      previousMonth: "Mois précédent",
      nextMonth: "Mois suivant",
      savedInstructions: "Enregistré - nous l\u2019utiliserons à la rédaction",
      removedFromPlan: "Retiré du plan",
      writingStarted: "Rédaction lancée - cela prend quelques minutes",
    },
    addons: {
      moreCredits: "Plus de crédits de lien",
      moreCreditsHelp: "Votre forfait inclut des crédits chaque mois. Achetez-en si vous en manquez - ils n\u2019expirent pas.",
      termsPill: "Achat unique · Les crédits n\u2019expirent pas",
      oneTime: "Achat unique",
      neverExpire: "Les crédits n\u2019expirent pas",
      useAnytime: "Utilisables à tout moment",
      buyThis: "Acheter",
      buyCredits: "Acheter {n} crédits",
      unavailable: "Indisponible",
      checkoutFailed: "Impossible de lancer le paiement. Réessayez.",
      yourPurchases: "Vos achats",
      added: "Ajouté",
      delivered: "Livré",
      inProgress: "En cours",
      requestQuote: "Demander un devis",
      quoteHelp: "Nous établissons un devis après avoir examiné votre audit.",
      title: "Modules",
      subtitle: "Achats ponctuels en plus de votre forfait.",
      perCredit: "{price} par crédit",
      quoteFrom: "À partir de {price}. Nous établissons un devis après avoir examiné votre audit.",
      servicesTitle: "Services",
      showingRecent: "Affichage de vos {count} achats les plus récents.",
    },
    referral: {
      referSomeone: "Parrainer quelqu\u2019un",
      linkLabel: "Votre lien de parrainage",
      copy: "Copier",
      copied: "Copié",
      copyFailed: "Copie impossible. Sélectionnez le lien et copiez-le manuellement.",
      linkCopied: "Lien copié",
      creditsEarned: "Crédits gagnés",
      waitingToConvert: "En attente de conversion",
      signedUpNotPaying: "Inscrits, pas encore payants",
      peopleReferred: "Personnes que vous avez parrainées",
      someoneReferred: "Une personne que vous avez parrainée",
      notEligible: "Non éligible",
      waiting: "En attente",
      cardDescription: "Partagez votre lien. Quand une personne que vous parrainez paie son premier mois, vous recevez {credits} crédits de liens.",
      joinedWithName: "{name} · inscrit le {date}",
      joined: "Inscrit le {date}",
      noWebsiteJoined: "Pas encore de site · inscrit le {date}",
      creditsBadge: "+{count} crédits",
      linkHelp: "Les personnes qui s’inscrivent via ce lien comptent comme vos parrainages.",
      peopleReferredStat: "Personnes parrainées",
      noReferralsYet: "Personne ne s’est encore inscrit avec votre lien.",
      showingRecent: "Affichage de vos {count} parrainages les plus récents.",
      rewardedOn: "crédits ajoutés le {date}",
      unavailable: "Impossible de charger vos données de parrainage. Rechargez la page pour réessayer.",
    },
    keys: {
      updatePlugin: "WordPress a l’extension {version}. La version 1.7 se connecte en un clic, indique pour quel compte RepGet elle publie et se met à jour seule : téléchargez-la, puis dans WordPress allez dans Extensions → Ajouter → Téléverser une extension et choisissez « Remplacer la version actuelle par la version téléversée ».",
      keyCopied: "Clé copiée",
      keyCopyFailed: "Copie impossible. Sélectionnez la clé et copiez-la manuellement.",
      keyRevoked: "Clé révoquée",
      newKeyLabel: "Votre nouvelle clé d\u2019intégration",
      openWordPress: "Ouvrir mon WordPress",
      neverUsed: "Jamais utilisée",
      pluginTitle: "Plugin WordPress",
      pluginHelp: "Installez notre extension, connectez-la en un clic, et les articles se publient ici automatiquement.",
      copyNowHelp: "Nous n\u2019en stockons qu\u2019une version chiffrée : elle ne peut pas être retrouvée ensuite. Si vous la perdez, révoquez-la et créez-en une autre.",
      newKey: "Nouvelle clé",
      keyNotePlaceholder: "À quoi sert cette clé ? (facultatif)",
      nextSteps: "Dans WordPress, ouvrez RepGet dans le menu, collez cette clé et cliquez sur Save and connect.",
      connectingIn: "Connexion de {domain} dans l’espace de travail « {workspace} ».",
      stepInstall: "1. Installez l’extension",
      stepInstallHelp: "Téléchargez-la, puis téléversez-la et activez-la dans WordPress (Extensions → Ajouter → Téléverser une extension). Passez cette étape si elle est déjà installée.",
      stepConnect: "2. Connectez",
      stepConnectHelp: "Ouvre votre WordPress prêt à se connecter. Cliquez sur Finish connecting to RepGet (Save and connect avant l’extension 1.7) : rien à copier.",
      connectButton: "Connecter WordPress",
      reconnectButton: "Connecter à nouveau",
      waitingTitle: "En attente de WordPress…",
      waitingHelp: "Dans l’onglet WordPress que nous avons ouvert, cliquez sur Finish connecting to RepGet (ou Save and connect). Si WordPress vous demande de vous connecter, faites-le, puis cliquez sur Rouvrir WordPress.",
      stalledHelp: "Toujours en attente ? Si votre WordPress indique déjà Connected, il utilise une autre clé, par exemple d’un autre compte RepGet ou d’un test. Terminer dans l’onglet que nous avons ouvert le bascule vers ce compte.",
      openAgain: "Rouvrir WordPress",
      copyInstead: "Copier la clé",
      popupBlocked: "Votre navigateur a bloqué le nouvel onglet. Utilisez Rouvrir WordPress, ou copiez la clé et collez-la dans WordPress.",
      connectedTitle: "Connecté",
      lastCheckIn: "Dernier contact : {date}",
      connectedToast: "WordPress est connecté",
      alsoIn: "Vous avez aussi {domain} dans {workspaces}. Un site WordPress ne publie que pour l’un d’eux : c’est la clé enregistrée dans WordPress qui décide.",
      madeByConnect: "Créée par Connecter WordPress",
      advancedTitle: "Clés (avancé)",
      advancedHelp: "Chaque installation WordPress conserve une clé. Vous n’en avez besoin que pour connecter une autre installation à la main, ou pour arrêter une installation (Révoquer).",
      keyReplaced: "Cette clé a été remplacée ou révoquée avant que WordPress ne l’utilise. Cliquez à nouveau sur Connecter WordPress.",
      waitingResumed: "En attente que WordPress utilise la clé créée il y a un instant. Si vous avez fermé cet onglet WordPress, cliquez à nouveau sur Connecter WordPress.",
      gaveUp: "Attente interrompue. Si vous avez terminé dans WordPress, rechargez cette page ; sinon, cliquez à nouveau sur Connecter WordPress.",
      notActiveHelp: "Si WordPress indique que vous n’avez pas l’autorisation d’accéder à cette page, l’extension n’est pas encore active : faites l’étape 1, puis cliquez sur Rouvrir WordPress.",
      madeByHand: "Ajoutée à la main",
      quotedName: "« {name} »",
    },
    partnerNetwork: {
      title: "Réseau partenaire",
      subtitle: "Gérez la participation de votre site au réseau de liens de RepGet.",
      participationTitle: "Participation au réseau",
      participationHelp: "Participez au réseau partenaire de RepGet pour héberger des liens pertinents et recevoir des liens vers vos pages.",
      enabled: "Activée",
      disabled: "Désactivée",
      whatTitle: "Ce que cela fait",
      whatBody: "L’équipe RepGet place des liens pertinents depuis des articles de partenaires vers les pages que vous indiquez, et peut placer des liens de partenaires dans vos articles avant leur publication. Votre espace gagne des crédits pour chaque lien hébergé et en dépense pour chaque lien reçu, uniquement une fois le lien vérifié en ligne. Vous n’avez ni partenaire à choisir ni lien à approuver.",
      offNote: "La désactiver arrête l’organisation de nouveaux liens. Les liens déjà placés restent, et sont toujours vérifiés et crédités.",
      inReview: "{n} de vos articles sont en relecture chez l’équipe RepGet.",
      ratingTitle: "Autorité minimale",
      ratingHelp: "L’autorité minimale d’un site qui vous fait un lien.",
      ratingUnconfigured: "Pas encore disponible : l’autorité des sites du réseau n’est pas mesurée, donc un minimum ne peut pas être imposé. L’équipe RepGet vérifie chaque site à la main.",
      targetsTitle: "Pages cibles",
      targetsHelp: "Choisissez et priorisez les pages de votre site qui doivent recevoir des liens.",
      addTarget: "Ajouter une page cible",
      urlLabel: "Adresse de la page",
      noteLabel: "Ce qu’est cette page (facultatif)",
      priorityLabel: "Priorité",
      high: "Haute",
      medium: "Moyenne",
      low: "Basse",
      moveUp: "Monter",
      moveDown: "Descendre",
      remove: "Retirer",
      noTargets: "Aucune page cible. Ajoutez les pages pour lesquelles vous voulez le plus de liens.",
      targetAdded: "Page cible ajoutée",
      saved: "Enregistré",
      turnedOn: "Vous faites partie du Réseau partenaire",
      turnedOff: "Vous avez quitté le Réseau partenaire",
      creditsLine: "{available} crédits disponibles · {reserved} réservés",
      add: "Ajouter",
      cancel: "Annuler",
      ratingMetric: "Mesuré avec l'Autorité de domaine (0-100) du site qui fait le lien.",
      ratingNone: "Pas de minimum",
      ratingNoneHelp: "Tout partenaire pertinent peut pointer vers vous ; l'équipe RepGet vérifie chaque site à la main.",
      ratingSliderLabel: "Autorité de domaine minimale",
      ratingCurrent: "Uniquement des liens de sites avec une Autorité de domaine de {n} ou plus",
      ratingScaleOnly: "Votre forfait va jusqu’à {cap}. Une Autorité de domaine supérieure à {cap} est incluse dans le forfait Scale.",
      ratingSave: "Enregistrer le minimum",
      ratingSaved: "Minimum enregistré",
      ratingNoAccess: "Pas encore disponible : l'Autorité de domaine ne peut pas être mesurée pour le moment. L'équipe RepGet vérifie chaque site à la main.",
    },
    reports: {
      subnavLabel: "Sections des backlinks",
      navOverview: "Vue d'ensemble",
      navEarned: "Backlinks obtenus",
      navHosted: "Liens hébergés",
      navCredits: "Activité des crédits",
      authorityLabel: "Autorité de domaine",
      authorityValueAria: "Autorité de domaine {value} sur {max}",
      authorityUpdated: "Mis à jour le {date}",
      authorityStale: "Du {date} - mise à jour en attente",
      authorityCollecting: "En cours de collecte",
      authorityNoAccess: "Pas encore disponible",
      authorityNoData: "Pas encore de données pour ce site",
      authorityError: "Collecte impossible - nouvel essai prévu",
      authorityNotConfigured: "Pas encore configuré",
      authorityWhat: "Qu'est-ce que c'est ?",
      authorityHelp: "Un score de 0 à 100 fondé sur les sites qui pointent vers un domaine. Ce n'est pas votre score de santé du site.",
      authorityDetail: "Autorité de domaine {value}/{max}, mesurée le {date}",
      authorityUnavailableDetail: "Pas encore disponible",
      rankStaleTitle: "Autorité de domaine - date de plus de 30 jours",
      unknownShort: "n/d",
      unknownRank: "autorité inconnue",
      issueHosted: "{count} de vos articles n'a plus le lien d'un partenaire - aucun crédit gagné|{count} de vos articles n'ont plus le lien d'un partenaire - aucun crédit gagné",
      issueHostedHelp: "Le lien est introuvable sur l'article publié après plusieurs vérifications. Rétablissez-le, puis demandez une nouvelle vérification.",
      issueReceived: "{count} lien vers votre site est introuvable sur la page du partenaire - rien ne vous a été facturé|{count} liens vers votre site sont introuvables sur les pages des partenaires - rien ne vous a été facturé",
      issueReceivedHelp: "Les crédits ne sont dépensés qu'une fois le lien vérifié en ligne. L'équipe RepGet assure le suivi avec le partenaire.",
      reviewResolve: "Examiner et résoudre",
      dismiss: "Masquer",
      issueFilterGiven: "Liens introuvables sur vos articles publiés. Rétablissez chaque lien, puis utilisez « Vérifier à nouveau ».",
      issueFilterReceived: "Liens introuvables sur la page du partenaire. Rien n'a été facturé.",
      issueNofollowHosted: "{count} lien partenaire dans vos articles est en nofollow : il n'apporte aucune valeur SEO|{count} liens partenaires dans vos articles sont en nofollow : ils n'apportent aucune valeur SEO",
      issueNofollowHostedHelp: "Les moteurs de recherche ignorent les liens nofollow ou sponsored. Modifiez l'article, retirez nofollow / sponsored du lien partenaire, puis demandez une nouvelle vérification.",
      issueNofollowReceived: "{count} lien vers votre site est en nofollow sur la page du partenaire|{count} liens vers votre site sont en nofollow sur les pages des partenaires",
      issueNofollowReceivedHelp: "Ces liens sont en ligne mais apportent peu de valeur SEO. Le propriétaire du site a été invité à les rendre suivis.",
      issueFilterNofollowGiven: "Liens partenaires en nofollow dans vos articles publiés. Retirez nofollow / sponsored de chaque lien, puis utilisez « Vérifier à nouveau ».",
      issueFilterNofollowReceived: "Liens vers votre site que la page du partenaire marque en nofollow. Le propriétaire du site a été invité à les corriger.",
      nofollowBadge: "Nofollow",
      overviewTitle: "Vue d'ensemble des backlinks",
      overviewIntro: "Votre portefeuille de liens, votre solde de crédits et les réglages que l'équipe RepGet suit pour placer des liens pour vous.",
      portfolioTitle: "Portefeuille de backlinks",
      verifiedBacklinks: "backlink vérifié|backlinks vérifiés",
      referringDomains: "depuis {count} site|depuis {count} sites",
      strongestLink: "Source la plus forte",
      strongestHelp: "L'Autorité de domaine la plus élevée parmi les sites qui pointent vers vous avec un lien vérifié.",
      last30Days: "30 derniers jours",
      newInWindowHelp: "Liens vérifiés pour la première fois ces 30 derniers jours (UTC).",
      estimatedValue: "Valeur équivalente estimée",
      estimateNotConfigured: "Estimation non configurée",
      estimateNotConfiguredHelp: "RepGet n'affiche une estimation en argent qu'une fois que son équipe a publié les tarifs et leurs sources. D'ici là, aucun chiffre n'est affiché plutôt qu'un chiffre inventé.",
      howEstimated: "Comment est-ce estimé ?",
      estimateMethod: "Politique d'estimation v{version} ({currency}), en vigueur depuis le {date} : un tarif par lien vérifié, selon l'Autorité de domaine du site qui fait le lien. Sources : {sources}. Estimation de ce que coûteraient des liens équivalents - pas de l'argent économisé ou gagné.",
      unvaluedLinks: "{count} lien vérifié n'a pas de tarif applicable et n'est pas inclus.|{count} liens vérifiés n'ont pas de tarif applicable et ne sont pas inclus.",
      mostRecentLinks: "Liens les plus récents",
      colVerified: "Vérifié",
      verifiedDateHelp: "Le jour où le lien a été vu en ligne pour la première fois.",
      noVerifiedYet: "Aucun lien vérifié pour l'instant. Ils apparaissent ici dès que la vérification les voit en ligne.",
      pipeline: "{publication} en attente de publication · {verification} en attente de vérification",
      seeAllBacklinks: "Voir tous les backlinks",
      creditsCardTitle: "Crédits de backlinks",
      creditActivity: "Activité des crédits",
      creditsAvailableLine: "disponibles · {reserved} réservés pour des liens en cours · solde {balance}",
      recoverFromArticles: "Récupérer les crédits de {count} article|Récupérer les crédits de {count} articles",
      buyCredits: "Acheter des crédits de liens",
      creditsHowItWorks: "Vous gagnez des crédits quand le lien d'un partenaire dans votre article est vérifié en ligne, et vous en dépensez quand un lien vers votre site est vérifié. Pendant le placement, les crédits sont réservés ; si un lien vérifié est ensuite retiré, ils sont restitués.",
      creditsScopeNote: "Les crédits appartiennent à votre espace de travail et sont partagés par tous ses sites.",
      creditsOwnerOnly: "Les crédits appartiennent à l'espace de travail propriétaire de ce site et ne sont visibles que par ses membres.",
      receivedSectionTitle: "Liens vers votre site",
      receivedFlow: "Placés dans des articles de partenaires → vérifiés → crédits dépensés",
      givenSectionTitle: "Liens que vous hébergez",
      givenFlow: "Placés dans vos articles → vérifiés → crédits gagnés",
      seeAllCount: "Voir {count} lien|Voir les {count} liens",
      earnedTitle: "Backlinks obtenus",
      earnedIntro: "Tous les liens reçus par vos pages via le réseau partenaire, avec leur source, les mots liés et l'état de vérification.",
      hostedTitle: "Liens hébergés",
      hostedIntro: "Les liens de partenaires placés dans vos articles. Chacun rapporte des crédits une fois vérifié en ligne sur votre article publié.",
      statusFilterLabel: "Filtrer par statut",
      tabAll: "Tous",
      tabVerified: "Vérifiés",
      tabPending: "En attente",
      tabRefunded: "Remboursés",
      typeLabel: "Type",
      typeAll: "Type : tous",
      typeManaged: "Placé par l'équipe RepGet",
      typeExchange: "Échange (appariement automatique)",
      resultCount: "{count} lien|{count} liens",
      recoverFrom: "Récupérer les crédits de {count} lien|Récupérer les crédits de {count} liens",
      recoverQueued: "{count} vérification demandée. Les crédits ne sont gagnés que si le lien est trouvé en ligne.|{count} vérifications demandées. Les crédits ne sont gagnés que si les liens sont trouvés en ligne.",
      searchLabel: "Rechercher des liens",
      searchPlaceholder: "Site, page ou mots liés",
      dateFrom: "Du",
      dateTo: "Au",
      apply: "Appliquer",
      clearFilters: "Effacer les filtres",
      dateMeaning: "Les dates sont en UTC et indiquent la dernière étape du lien : vérifié, retiré, publié ou placé.",
      colDate: "Date",
      colLink: "Lien",
      colDestination: "Destination",
      colAuthority: "Autorité de domaine",
      colValue: "Valeur est.",
      colCredits: "Crédits",
      colAiCitation: "Citations IA",
      colStatus: "Statut",
      colDetails: "Détails",
      aiCitationHelp: "Nombre de fois où la page contenant ce lien a été citée dans vos contrôles de visibilité IA (90 derniers jours).",
      aiNotMeasured: "Non mesuré : aucun contrôle de visibilité IA ces 90 derniers jours, ou la page n'est pas encore publiée.",
      aiCitations: "{count} citation|{count} citations",
      aiCitationsDetail: "Citée dans {count} réponse IA de vos contrôles (90 derniers jours)|Citée dans {count} réponses IA de vos contrôles (90 derniers jours)",
      emptyFiltered: "Aucun lien ne correspond à ces filtres.",
      emptyReceived: "Aucun lien vers votre site pour l'instant. L'équipe RepGet les place dans des articles de partenaires ; ils apparaissent ici dès qu'un lien est placé.",
      emptyGiven: "Aucun lien de partenaire dans vos articles pour l'instant.",
      unknownWebsite: "Site inconnu",
      untitled: "Article sans titre",
      dateUnknown: "Date non enregistrée",
      valueNotApplicable: "Valorisé une fois vérifié",
      showDetails: "Afficher les détails de {site}",
      hideDetails: "Masquer les détails de {site}",
      loading: "Chargement…",
      sortable: "triable",
      sortedAsc: "tri croissant",
      sortedDesc: "tri décroissant",
      paginationLabel: "Pages",
      showingRange: "Affichage de {first} à {last} sur {total}",
      perPage: "Par page",
      prev: "Précédent",
      next: "Suivant",
      pageOf: "Page {page} sur {pages}",
      valueFootnote: "Les valeurs équivalentes estimées suivent la politique v{version} ({currency}) ; ce sont des estimations, pas de l'argent économisé.",
      lcVerified: "Vérifié",
      lcAwaitingPublication: "En attente de publication",
      lcAwaitingVerification: "En attente de vérification",
      lcNotFound: "Introuvable - non facturé",
      lcRemoved: "Retiré - remboursé",
      lcWithdrawn: "Retiré avant publication - sans frais",
      lcUnknown: "État inconnu",
      eventVerified: "vérifié",
      eventRemoved: "retiré",
      eventPublished: "publié",
      eventPlaced: "placé",
      eventUnknown: "-",
      creditSettled: "{n} dépensés",
      creditEarned: "+{n} gagnés",
      creditReserved: "{n} réservés",
      creditPending: "+{n} une fois vérifié",
      creditRefunded: "{n} remboursés",
      creditReversed: "{n} annulés",
      creditNone: "Aucun frais",
      dSourceArticle: "Article source",
      dYourArticle: "Votre article",
      dSourceSite: "Site qui fait le lien",
      dDestinationSite: "Site de destination",
      dYourPage: "Votre page",
      dDestinationPage: "Page de destination",
      dAnchor: "Mots liés",
      dType: "Type de placement",
      dRel: "Attributs du lien sur la page",
      dPublished: "Publié",
      dFirstVerified: "Première vérification",
      dRemoved: "Retiré",
      dLastCheck: "Dernière vérification",
      dAuthority: "Autorité de la source",
      dValue: "Valeur estimée",
      dAiCitation: "Citations IA",
      dCredits: "Crédits de ce lien",
      opensNewTab: "(s'ouvre dans un nouvel onglet)",
      notPublishedYet: "Pas encore publié",
      anchorHidden: "Affiché une fois l'article du partenaire publié",
      relUnknown: "Inconnu (pas encore vu en ligne)",
      relFollowed: "Aucun (lien suivi)",
      relUnfollowed: "{rel} - non suivi : apporte peu de valeur SEO",
      notYet: "Pas encore",
      checkAlive: "lien trouvé",
      checkMissing: "lien introuvable",
      checkError: "page inaccessible (non comptabilisé)",
      fvFromCheck: "D'après la première vérification réussie (antérieure à l'enregistrement des dates).",
      fvFromLedger: "D'après l'écriture de règlement (antérieure à l'enregistrement des dates).",
      valueDetail: "{value}, selon la politique d'estimation et l'Autorité de domaine de la source",
      noCreditMovements: "Aucun crédit n'a bougé pour ce lien.",
      adviceNotFoundGiven: "Le lien manque dans votre article publié. Remettez-le (ou republiez l'article), puis choisissez « Vérifier à nouveau » - les crédits ne sont gagnés qu'une fois le lien vu en ligne.",
      adviceNotFoundReceived: "L'article du partenaire ne contient pas le lien. Rien ne vous a été facturé ; l'équipe RepGet assure le suivi.",
      adviceAwaitingVerification: "L'article est en ligne. Le lien est vérifié automatiquement, généralement sous un jour ; les crédits ne bougent qu'une fois le lien vu.",
      adviceAwaitingPublicationGiven: "Ce lien se trouve dans un de vos articles non encore publié. Il partira avec l'article, après la revue de l'équipe RepGet.",
      adviceAwaitingPublicationReceived: "Placé dans l'article d'un partenaire pas encore publié. Ses crédits sont réservés, pas dépensés.",
      adviceRemoved: "Le lien a été vérifié, puis sa disparition a été confirmée et il a été retiré : ses crédits ont été remboursés.",
      recheck: "Vérifier à nouveau",
      recheckRecover: "Je l'ai rétabli - vérifier à nouveau",
      recheckQueued: "Vérification demandée. Elle aura lieu sous peu ; les crédits ne bougent que si le lien est vu en ligne.",
      recheckRevived: "De retour en attente de vérification. Si le lien est trouvé en ligne, les crédits seront réglés à ce moment-là.",
      recheckAlreadyQueued: "Une vérification est déjà prévue.",
      recheckCooldown: "Vérifié récemment - vous pourrez redemander dans quelques heures.",
      creditsTitle: "Activité des crédits",
      creditsIntro: "Tous les crédits que votre espace de travail a reçus, réservés, dépensés ou récupérés, du plus récent au plus ancien.",
      creditsSummary: "Résumé",
      creditsAvailable: "Disponibles",
      creditsReservedLabel: "Réservés",
      creditsReservedHelp: "Retenus pour des liens en cours ; dépensés seulement une fois le lien vérifié.",
      creditsBalance: "Solde",
      creditsEarnedTotal: "Gagnés (total)",
      creditsSpentTotal: "Dépensés (total)",
      creditsRefundedTotal: "Remboursés (total)",
      colEntry: "Opération",
      colWebsite: "Site",
      creditsEmpty: "Aucune activité de crédits pour l'instant.",
      workspaceWide: "Espace de travail",
      ledgerPlanGrant: "Allocation mensuelle du forfait",
      ledgerLinkGiven: "Gagné : lien hébergé vérifié",
      ledgerLinkReceived: "Dépensé : lien vers votre site vérifié",
      ledgerRefund: "Remboursement",
      ledgerPurchase: "Achat",
      ledgerReferral: "Récompense de parrainage",
      ledgerReferralReversed: "Récompense de parrainage annulée : paiement remboursé",
      ledgerReversal: "Annulé : lien hébergé retiré",
      ledgerAdjustment: "Ajustement",
      sectionUnavailable: "Cette section n'a pas pu être chargée. Actualisez ; si cela persiste, contactez le support.",
      websiteAuthority: "Autorité du site",
      backlinksHeading: "Backlinks",
      openBacklinks: "Ouvrir les backlinks",
      partnerNetworkLabel: "Réseau partenaire",
      getCredits: "Obtenir des crédits",
      verifiedBacklinksLabel: "Backlinks vérifiés",
      availableCredits: "Crédits disponibles",
      ownerOnlyShort: "Propriétaire uniquement",
      chartActiveLinks: "Liens vérifiés vers votre site",
      unitLinks: "liens",
      noData: "pas de données",
      chartInstructions: "Utilisez les flèches gauche et droite pour passer d'un jour à l'autre.",
      undatedLinks: "{count} ancien lien vérifié n'a pas de date enregistrée et n'apparaît pas sur le graphique.|{count} anciens liens vérifiés n'ont pas de date enregistrée et n'apparaissent pas sur le graphique.",
      todaysArticle: "Article du jour",
      nothingWritten: "Rien d'écrit pour l'instant. Votre premier article apparaîtra ici quand votre plan de contenu démarrera.",
      openContentPlan: "Ouvrir le plan de contenu",
      stPublished: "Publié",
      stAwaitingReview: "Chez l'équipe RepGet",
      stAwaitingReviewHelp: "En cours de revue par l'équipe RepGet avant envoi. Rien n'est publié avant leur accord.",
      stApproved: "Approuvé",
      stApprovedHelp: "Approuvé - part le jour prévu, le {date}, selon vos réglages de publication.",
      stApprovedNoDate: "Approuvé - part selon vos réglages de publication.",
      stScheduled: "Planifié",
      stScheduledHelp: "Part le {date}.",
      stDraft: "Brouillon",
      stDraftHelp: "En attente de votre publication.",
      stWriting: "En rédaction",
      stFailed: "Nécessite une action",
      searchVolume: "Volume de recherche",
      perMonth: "{n}/mois",
      difficulty: "Difficulté",
      articleType: "Type d'article",
      intentCommercial: "Commercial",
      intentTransactional: "Transactionnel",
      intentInformational: "Informationnel",
      intentNavigational: "Navigationnel",
      whyThisTopic: "Pourquoi ce sujet ?",
      whyWithVolume: "Il cible « {keyword} », recherché environ {volume} fois par mois.",
      whyKeyword: "Il cible « {keyword} ».",
      winsTitle: "Réussites sur 7 jours",
      winsCount: "{count} réussite|{count} réussites",
      noWins: "Rien de nouveau ces 7 derniers jours.",
      winPublished: "Publié : {title}",
      winPublishedDetail: "Publié pour la première fois sur votre site cette semaine",
      winLinksReceived: "{count} nouveau lien vers votre site vérifié|{count} nouveaux liens vers votre site vérifiés",
      winLinksReceivedDetail: "Liens depuis des articles de partenaires, vus en ligne",
      winLinksGiven: "{count} lien hébergé vérifié - crédits gagnés|{count} liens hébergés vérifiés - crédits gagnés",
      winLinksGivenDetail: "Liens de partenaires dans vos articles, vus en ligne",
      winAudit: "Santé du site vérifiée - score {score}",
      winAuditDetail: "Ce qui freine le site sur Google",
      winClicks: "{count} clic depuis Google (tout le site)|{count} clics depuis Google (tout le site)",
      winClicksDetail: "Données Search Console jusqu'au {date}",
      view: "Voir",
      bestArticles: "Meilleurs articles",
      bestArticlesHelp: "Vos articles RepGet qui apportent le plus de clics depuis Google (30 derniers jours disponibles).",
      openGoogleResults: "Ouvrir les résultats Google",
      connectSearchConsole: "Connectez Google Search Console pour voir les performances de vos articles.",
      connect: "Connecter",
      noArticleTraffic: "Search Console n'a encore signalé ni clic ni impression pour vos articles RepGet.",
      colArticle: "Article",
      colClicks: "Clics",
      colImpressions: "Impressions",
      colPosition: "Position",
      colSessions: "Sessions (GA)",
      colFirstPublished: "Première publication",
      colKeywordCpc: "Mot-clé · CPC (USD)",
      searchConsoleThrough: "Données Search Console jusqu'au {date}.",
      analyticsThrough: "Données Google Analytics jusqu'au {date}.",
      connectAnalytics: "Connectez Google Analytics pour voir les sessions sur vos articles.",
      achievements: "Réalisations",
      valueHeadline: "Valeur équivalente estimée : {value}",
      valueHeadlineUnconfigured: "Valeur estimée pas encore configurée",
      achievementsIntro: "Ce que vos articles et le réseau partenaire ont produit sur la période. L'équipe RepGet relit les articles et place les liens à la main.",
      lastNDays: "{days} derniers jours (UTC)",
      plusArticles: "+{n} articles",
      plusBacklinks: "+{n} backlinks",
      rangeLabel: "Période",
      rangeDays: "{days} jours",
      range12m: "12 mois",
      viewLabel: "Affichage",
      chart: "Graphique",
      details: "Détails",
      metricLabel: "Mesure affichée sur le graphique",
      trafficValue: "Valeur du trafic",
      trafficValueHelp: "Ce que coûteraient en annonces les clics vers vos articles (estimation)",
      backlinkValue: "Valeur des backlinks",
      backlinkValueHelp: "Liens vérifiés pour la première fois sur la période (estimation)",
      articlesPublished: "Articles publiés",
      articlesPublishedHelp: "Première mise en ligne sur votre site (les brouillons et les modifications ne comptent pas)",
      articleImpressions: "Impressions des articles",
      articleImpressionsHelp: "Combien de fois vos articles RepGet sont apparus dans Google",
      articleClicks: "Clics sur les articles",
      articleClicksHelp: "Clics depuis Google vers vos articles RepGet (Search Console)",
      articleSessions: "Sessions sur les articles",
      articleSessionsHelp: "Visites de vos articles RepGet (Google Analytics)",
      notConnected: "Non connecté",
      notConfiguredShort: "Non configuré",
      currencyMismatch: "Nécessite une politique en USD",
      websiteHealth: "Santé du site",
      websiteHealthHelp: "Votre dernier audit technique - distinct de l'autorité",
      noSeries: "Pas encore de données pour cette mesure sur la période.",
      utcDays: "Les jours sont des jours calendaires UTC.",
      unitArticles: "articles",
      unitClicks: "clics",
      unitImpressions: "impressions",
      unitSessions: "sessions",
      breakdownCaption: "Vos articles RepGet sur la période, par clics depuis Google",
      breakdownShowing: "Affichage des {shown} premières pages sur {total}. Les totaux ci-dessus incluent toutes les pages.",
      unknownPublicationDates: "{n} articles plus anciens sont en ligne, mais la date de leur première mise en ligne n'a pas été enregistrée ; ils ne sont comptés dans aucune période.",
      noPublishedArticles: "Aucun article RepGet publié pour l'instant.",
      methodologyTitle: "Comment ces chiffres sont calculés",
      methodologyPolicy: "Politique d'estimation v{version}, en {currency}, en vigueur depuis le {date}.",
      methodologyCpc: "Valeur du trafic = clics Search Console de chaque article × coût par clic de son mot-clé, issu de votre recherche de mots-clés pour votre marché (USD).",
      methodologyFixed: "Valeur du trafic = clics Search Console vers vos articles RepGet × {rate} par clic.",
      methodologyNoTraffic: "Le trafic n'est pas valorisé par cette politique.",
      methodologyBacklinks: "Valeur par lien vérifié, selon l'Autorité de domaine du site qui fait le lien : {bands}.",
      methodologyNoBacklinks: "Les backlinks ne sont pas valorisés par cette politique.",
      methodologySources: "Sources : {sources}",
      methodologyExcluded: "Jamais comptés : brouillons, liens en attente de publication ou de vérification, liens introuvables ou retirés, liens internes et la mention « Powered by RepGet ».",
      methodologyNotSavings: "Ce sont des estimations du coût d'annonces ou de liens équivalents - ni de l'argent économisé, ni un revenu, ni un rendement garanti.",
      searchPerformance: "Performance de recherche",
      websiteTraffic: "Trafic du site",
      aiSearch: "Recherche IA",
      aiNoChecks: "Aucun contrôle de visibilité IA sur la période.",
      openAiVisibility: "Ouvrir la visibilité IA",
      aiChecks: "Réponses vérifiées",
      aiMentioned: "Vous mentionnent",
      aiCited: "Citent votre site",
      aiReferralNotMeasured: "Les visites venant d'assistants IA ne sont pas encore mesurées - ce sont des réponses que RepGet a vérifiées pour vous.",
      googleTraffic: "Trafic Google",
      connectSearchConsoleTraffic: "Connectez Google Search Console pour voir clics, impressions et position.",
      siteClicks: "Clics",
      siteImpressions: "Impressions",
      avgPosition: "Position moyenne",
      vsPrevious: "vs précédent",
      siteWideThrough: "Tout le site, {days} derniers jours ; données Search Console jusqu'au {date}.",
      uncertainTitle: "La dernière tentative de publication n'a reçu aucune réponse de votre site",
      uncertainHelp: "L'article existe peut-être déjà. Vérifiez votre site : s'il y est, rien à faire ; sinon, confirmez ci-dessous et publiez à nouveau. Nous attendons plutôt que de risquer un doublon.",
      uncertainConfirm: "Il n'est pas sur mon site - autoriser une nouvelle publication",
      uncertainConfirmed: "Enregistré. Vous pouvez republier l'article.",
      lcNotFoundGiven: "Introuvable - aucun crédit gagné",
      lcRemovedGiven: "Retiré - crédits annulés",
    },
    image: {
      altLabel: "Description de l\u2019image",
      altPlaceholder: "Ce que montre l\u2019image",
      promptLabel: "Décrivez une autre image",
      promptPlaceholder: "Une cérémonie en soirée éclairée aux bougies, sans personne",
      noRegensLeft: "Vous avez utilisé toutes les régénérations pour cet article. Importez votre propre image.",
      imageReady: "Nouvelle image prête",
      imageUploaded: "Image importée",
      imageRemoved: "Image supprimée",
    },
    profile: {
      businessDetails: "Informations sur l\u2019entreprise",
      detailsHelp: "Ces informations déterminent vos mots-clés et chaque article que nous rédigeons.",
      correctAnything: " Corrigez ce que nous avons mal compris.",
      fillsIn: " Elles se remplissent automatiquement une fois le site analysé - vous pouvez aussi les saisir maintenant.",
      brandName: "Nom de la marque",
      brandNamePlaceholder: "Acme SARL",
      industry: "Secteur",
      industryPlaceholder: "Cabinet dentaire",
      country: "Marché principal",
      countryPlaceholder: "France",
      audience: "Public cible",
      audiencePlaceholder: "Propriétaires de 30 à 55 ans",
      mainLanguage: "Langue principale",
      description: "Description",
      descriptionPlaceholder: "Ce que fait l\u2019entreprise, en une ou deux phrases.",
      saveDetails: "Enregistrer",
      saving: "Enregistrement…",
      detailsSaved: "Informations enregistrées",
      pageTitle: "Paramètres de l’entreprise",
      pageDescription: "Les informations sur l’entreprise derrière {domain}. La recherche de mots-clés et chaque article que nous rédigeons s’appuient sur elles.",
      identityTitle: "Identité de l’entreprise",
      identityHelp: "Qui vous êtes et ce que vous faites.",
      marketTitle: "Marché et public",
      marketHelp: "Où vous vendez, qui vous voulez toucher et la langue dans laquelle vos articles sont rédigés.",
      descriptionTitle: "Description de l’entreprise",
      descriptionHelp: "Ce que fait l’entreprise et ce qui la distingue, avec vos propres mots.",
      competitorsTitle: "Concurrents",
      competitorsHelp: "Les entreprises qui vous disputent les mêmes clients. Les suggestions viennent de l’analyse de votre site, vérifiez-les donc : supprimez celles qui ne sont pas de vrais concurrents et ajoutez ceux qui manquent.",
      brandNameHint: "Le nom sous lequel vos clients vous connaissent.",
      industryHint: "Ce que vous faites, en quelques mots.",
      marketPlaceholder: "France",
      countryHint: "Le pays où vous vendez principalement, écrit en anglais (par exemple Spain), pour que la recherche de mots-clés cible le bon pays.",
      marketNotEnglish: "La recherche de mots-clés ne reconnaît que les noms de pays écrits en anglais.",
      marketUseEnglish: "Utiliser {country}",
      articleLanguage: "Langue des articles",
      articleLanguageHint: "Les articles de ce site sont rédigés dans cette langue. Cela ne change pas votre tableau de bord.",
      dashboardLanguageNote: "Votre tableau de bord s’affiche en {language}, un réglage personnel de votre compte.",
      dashboardLanguageLink: "Changer la langue du tableau de bord",
      chooseLanguage: "Choisissez une langue",
      unknownLanguage: "{language} (valeur actuelle)",
      audienceHint: "Qui vous voulez toucher : par exemple leur âge, leur situation ou leurs besoins.",
      descriptionHint: "Quelques phrases suffisent : vos principaux produits ou services, où vous intervenez et ce qui vous distingue.",
      notSet: "Non renseigné",
      unsavedBadge: "Non enregistré",
      saveBusinessDetails: "Enregistrer",
      saveScope: "Couvre toutes les sections sauf Concurrents, enregistrés dès que vous en ajoutez ou en supprimez un.",
      saveError: "Une erreur s’est produite. Vos modifications sont toujours là, vous pouvez donc réessayer.",
      checklistNeedsBoth: "Ajoutez une description et choisissez une langue des articles pour terminer cette étape de votre liste de lancement.",
      checklistNeedsDescription: "Ajoutez une description pour terminer cette étape de votre liste de lancement.",
      checklistNeedsLanguage: "Choisissez une langue des articles pour terminer cette étape de votre liste de lancement.",
      analysingTitle: "Votre site est en cours d’analyse",
      analysingBody: "À la fin de l’analyse, le nom de la marque, le secteur, le marché, le public et la description seront remplis automatiquement et remplaceront le contenu actuel de ces champs. La langue des articles que vous choisissez est conservée.",
      analysingBodyReadOnly: "À la fin de l’analyse, ces informations seront remplies automatiquement.",
      refresh: "Actualiser",
      analysisFailedTitle: "Nous n’avons pas pu analyser votre site",
      analysisFailedBody: "Ces informations n’ont pas été remplies automatiquement. Vous pouvez les saisir vous-même.",
      analysisFailedBodyReadOnly: "Ces informations n’ont pas été remplies automatiquement.",
      analysisFailedRetry: "Vous pouvez relancer l’analyse depuis la page Sites web.",
      goToWebsites: "Aller aux sites web",
      competitorCount: "1 concurrent|{count} concurrents",
      manualGroup: "Ajoutés par vous",
      suggestedGroup: "Suggérés par l’analyse",
      suggestedGroupHelp: "Trouvés lors de l’analyse de votre site, pas choisis par vous. Supprimez ceux qui ne sont pas de vrais concurrents.",
      suggestedGroupHelpReadOnly: "Trouvés lors de l’analyse du site.",
      competitorsEmpty: "Aucun concurrent pour l’instant.",
      competitorsEmptyAnalysed: "L’analyse de votre site n’a suggéré aucun concurrent.",
      competitorsEmptyAnalysing: "Les suggestions apparaîtront ici à la fin de l’analyse de votre site.",
      competitorsTruncated: "Affichage des {count} premiers concurrents.",
      addCompetitor: "Ajouter un concurrent",
      addCompetitorHint: "L’adresse de son site, par exemple rival.com. Nous vérifions que le site existe avant de l’ajouter, ce qui peut prendre quelques secondes.",
      competitorPlaceholder: "rival.com",
      addCompetitorButton: "Ajouter",
      checkingShort: "Vérification…",
      checkingCompetitor: "Vérification de {domain}…",
      competitorAdded: "{domain} ajouté.",
      removingCompetitor: "Suppression de {domain}…",
      competitorRemoved: "{domain} supprimé.",
      visitCompetitor: "Ouvrir {domain} dans un nouvel onglet",
      removeCompetitor: "Supprimer {domain}",
      competitorRequired: "Saisissez une adresse web.",
      competitorInvalid: "Saisissez une adresse web comme rival.com.",
      competitorOwnSite: "C’est votre propre site.",
      competitorDuplicate: "{domain} figure déjà dans votre liste.",
      competitorNotPublic: "Cette adresse n’est pas un site web public.",
      competitorBlocked: "Les réseaux sociaux et les grandes plateformes comme Google, Amazon ou Wikipédia ne peuvent pas être ajoutés comme concurrents.",
      competitorUnreachable: "Nous n’avons pas pu joindre {domain}. Vérifiez l’orthographe et réessayez.",
      actionFailed: "Une erreur s’est produite. Réessayez.",
    },
    setup: {
      launchChecklist: "Liste de lancement",
      allLive: "Tout est actif",
      finishSetup: "Terminer la configuration",
      allLiveHelp: "Tous les systèmes requis sont actifs. Rendez-vous sur le tableau de bord pour vos statistiques en direct.",
      stepsLeft: "{n} étape restante avant que tout fonctionne seul.|{n} étapes restantes avant que tout fonctionne seul.",
    },
    common: {
      cancel: "Annuler",
      done: "Terminé",
      edit: "Modifier",
      preview: "Aperçu",
      connect: "Connecter",
      checking: "Vérification…",
      discard: "Abandonner",
      revoke: "Révoquer",
      failed: "Échec",
      images: "Images",
      rewrite: "Réécrire",
      tryAgain: "Réessayer",
      somethingWentWrong: "Un problème est survenu sur cette page",
      remove: "Retirer",
      upload: "Importer",
      disconnect: "Déconnecter",
      competitors: "Concurrents",
      websiteHealth: "Santé du site",
      checkingWebsite: "Analyse de votre site",
      nothingNeedsAttention: "Rien ne demande votre attention. Revérifiez après avoir fait des modifications.",
      requestQuote: "Demander un devis",
      wantUsToFix: "Vous voulez que nous corrigions cela ?",
      saveProperties: "Enregistrer les propriétés",
      appeared: "Apparitions",
      noImageYet: "Pas encore d\u2019image",
      notScheduled: "Non planifié",
      nothingPlanned: "Rien de prévu ce jour-là.",
      defaultsAreFine: "Cela vous convient ? Vous pourrez les modifier à tout moment.",
      keepDefaults: "Garder les valeurs par défaut",
      noPlanYet: "Pas encore de plan de contenu",
      noPlanYetHaveKeywords: "Vos mots-clés sont prêts, mais le plan qui les transforme en articles n’a pas encore été créé. Créez-le maintenant.",
      buildPlan: "Créer mon plan de contenu",
      requestLink: "Demander un lien",
      admin: "Administration",
      articleLanguageHelp: "Vos articles sont rédigés dans cette langue.",
      namedInstead: "Cités à votre place, le plus souvent",
      mostPopular: "Le plus choisi",
      receiptInPayPal: "Reçu dans PayPal",
      noCharge: "Aucun débit",
      close: "Fermer",
      copied: "Copié",
      openMenu: "Ouvrir le menu",
      changeLanguage: "Changer de langue",
      brandHome: "Accueil RepGet",
      skipped: "Ignoré",
      hideSetupSteps: "Masquer les étapes",
      setupProgress: "Progression de la configuration",
      secureCheckout: "Paiement sécurisé",
      skipForNow: "Ignorer pour l’instant",
      verifiedCustomer: "Client vérifié",
      searchYourImages: "Rechercher dans vos images",
      critical: "Critique",
      suggestion: "Suggestion",
      warning: "Avertissement",
      importData: "Importer les données",
      auditIntro: "Nous examinons vos pages et listons ce qui freine votre site sur Google, en indiquant la page exacte de chaque problème.",
      losingTrafficIntro: "Pages qui reçoivent moins de clics, ou apparaissent moins dans Google, qu’il y a un mois. D’après vos données Search Console.",
      noCompetitorsFound: "Nous n\u2019en avons trouvé aucun depuis votre site. Ajoutez les concurrents que vous connaissez et nous les utiliserons pour repérer les manques de contenu.",
      competitorsHelp: "Qui d\u2019autre apparaît quand les acheteurs cherchent dans votre domaine. Nous les utilisons pour repérer les manques de contenu et les termes qui valent la peine.",
      connectWebsiteFirst: "Connectez d’abord votre site dans Paramètres → Intégrations. En attendant, les articles restent dans RepGet.",
      generationHelp: "Comment vos articles sont rédigés, et ce qu\u2019ils deviennent une fois prêts.",
      altHelp: "Lu à voix haute aux personnes utilisant un lecteur d\u2019écran, et lu par les moteurs de recherche.",
      featuredImageHelp: "L\u2019image en haut de l\u2019article, et celle affichée lors d\u2019un partage.",
      factsOnePerLine: "Un par ligne. Ce sont les seuls éléments précis que nous affirmerons sur votre entreprise ; tout le reste reste général.",
      voiceBehindArticles: "La voix derrière chaque article. Intégrée depuis son propre panneau, un seul Enregistrer couvre tout l\u2019écran.",
      creditsExplainer: "Les crédits sont ajoutés à votre compte et peuvent servir à la création de liens. Ce n\u2019est pas de l\u2019argent et ils ne peuvent pas être retirés. Un parrainage compte dès que la personne parrainée paie son premier mois, et seuls les nouveaux comptes peuvent être parrainés, chacun une seule fois.",
      articleInProgress: "Cet article ne peut plus être replanifié ni modifié car il est en cours.",
      researchIntro: "Nous trouverons les termes que vos clients utilisent, les regrouperons par sujets et en ferons un plan d\u2019articles à publier.",
      noCreditsLeft: "Plus de crédits. Incluez un lien pour que quelqu\u2019un en gagne un, ou attendez l\u2019allocation du mois prochain.",
      promoCodesHelp: "Les codes promo se saisissent au paiement par carte. PayPal n\u2019accepte pas les codes de réduction.",
      write: "Rédiger",
      writingAndPublishing: "Rédaction et publication",
      featuredImage: "Image à la une",
      backlinksLabel: "Liens entrants",
      uploadLabel: "Importer",
      aiAssistantsTracked: "Assistants IA suivis",
      freshArticles: "Nouveaux articles",
      toSetUp: "À configurer",
      trustedByBusinesses: "La confiance d’entreprises du monde entier",
      weekly: "Chaque semaine",
      twoMinutes: "2 min",
      notAvailable: "Cette page n\u2019est pas disponible",
      notAvailableHelp: "La page a peut-être été déplacée, ou elle appartient à un espace de travail dont vous n\u2019êtes pas membre.",
      backToDashboard: "Retour au tableau de bord",
      viewWebsites: "Voir vos sites",
      goToDashboard: "Aller au tableau de bord",
      setUp: "Configurer",
      setUpHelp: "Suivez le parcours de lancement étape par étape.",
      manageBilling: "Gérer la facturation",
      manageInPayPal: "Gérer dans PayPal",
      payWithPayPal: "Payer avec PayPal",
      noPlans: "Aucun forfait disponible pour le moment.",
      billingHistory: "Historique de facturation",
      billingHistoryHelp: "Tous les paiements d\u2019abonnement de cet espace de travail.",
      invoice: "Facture",
      downloadPlugin: "Télécharger le plugin",
      pluginGuide: "Guide d’installation",
      cantFindIntegration: "Vous ne trouvez pas votre intégration ?",
      adaptive: "Adaptatif",
      custom: "Personnalisé",
      wordRange: "Entre 300 et 5 000.",
      findOpportunities: "Trouver des opportunités",
      noOpportunities: "Aucune opportunité trouvée pour l\u2019instant",
      losingTraffic: "Perte de trafic",
      notWrittenHere: "Non rédigé ici",
      nothingLosing: "Rien ne perd de trafic",
      nothingLosingHelp: "Aucune page n’a perdu 30 % ou plus de ses clics, et aucune n’a reculé dans Google. Les pages de moins de 10 clics par mois sont suivies par leur position.",
      losingClicksTitle: "Perdent des clics",
      losingClicksHelp: "Ont perdu 30 % ou plus de leurs clics, à partir d’au moins 10 sur les 28 jours précédents.",
      losingVisibilityTitle: "Perdent en visibilité",
      losingVisibilityHelp: "Ont reculé de 3 places ou plus dans Google, ou sont apparues dans deux fois moins de recherches. Vérifié pour les pages affichées au moins 100 fois, pour suivre aussi celles qui ont peu de clics.",
      watchTitle: "À surveiller",
      watchHelp: "Entre 10 et 30 % de clics en moins. Pas encore une baisse nette.",
      noClickLosses: "Aucune page n’a perdu 30 % ou plus de ses clics.",
      clicksChange: "{before} → {after} clics",
      percentDown: "en baisse de {pct} %",
      percentUp: "en hausse de {pct} %",
      rankingChange: "position {before} → {after}",
      shownChange: "affichée {before} → {after} fois",
      windowNote: "Les 28 derniers jours publiés par Google, jusqu’au {date}, comparés aux 28 précédents.",
      writeAutomatically: "Rédiger les articles automatiquement",
      daysToWrite: "Jours de rédaction",
      publishWithoutAsking: "Publier sans me demander",
      whenFinished: "Quand un article est terminé",
      finishedReview: "Le garder dans RepGet pour que je le relise",
      finishedReviewHelp: "Rien n’arrive sur votre site tant que vous n’appuyez pas sur Publier dans l’article.",
      finishedDraft: "L’envoyer sur mon site en brouillon",
      finishedDraftHelp: "Il apparaît en brouillon dans votre CMS le jour prévu. Vous le publiez depuis celui-ci.",
      finishedLive: "Le publier le jour prévu",
      finishedLiveHelp: "Il est mis en ligne sur votre site le jour prévu, sans rien à faire de votre part.",
      firstArticleNote: "Votre premier article est envoyé dès qu’il est prêt, quel que soit votre choix, pour que vous voyiez le rendu sur votre site. Tant que votre site fait partie du Réseau partenaire, l’équipe RepGet vérifie chaque article - le premier aussi - et aucun ne part avant son jour prévu.",
    },
    nav: {
      dashboard: "Tableau de bord",
      setUp: "Configuration",
      plannedArticles: "Articles planifiés",
      backlinkExchange: "Réseau de liens",
      websiteHealth: "Santé du site",
      googleResults: "Résultats Google",
      googleConnect: "Google Search et Analytics",
      aiVisibility: "Visibilité dans l\u2019IA",
      losingTraffic: "Perte de trafic",
      settings: "Paramètres",
      addons: "Modules",
      main: "Principal",
      referralProgram: "Programme de parrainage",
      business: "Entreprise",
      articleSettings: "Paramètres des articles",
      integrations: "Intégrations",
      account: "Compte",
      billing: "Facturation",
      settingsSections: "Sections des paramètres",
    },
    status: {
      pending: "En attente de démarrage",
      crawling: "Lecture de votre site",
      researching: "Recherche d\u2019opportunités",
      generated: "Contenu planifié",
      ready: "Prêt",
      queued: "En attente",
      running: "En cours",
      completed: "Terminé",
      planned: "Planifié",
      draft: "Brouillon",
      generating: "Rédaction",
      published: "Publié",
      publish: "Publication",
      scheduled: "Programmé",
      connected: "Connecté",
      disconnected: "Non connecté",
      live: "En ligne",
      removed: "Retiré",
      matched: "Associé",
      active: "Actif",
      inactive: "Inactif",
      cancelled: "Annulé",
      expired: "Expiré",
      paid: "Payé",
      rewarded: "Récompensé",
      refunded: "Remboursé",
      fulfilled: "Livré",
      failed: "Action requise",
      rejected: "Refusé",
      missing: "Manquant",
    },
    editorUi: {
      bold: "Gras",
      italic: "Italique",
      strikethrough: "Barré",
      heading: "Titre",
      subheading: "Sous-titre",
      bulletedList: "Liste à puces",
      numberedList: "Liste numérotée",
      quote: "Citation",
      code: "Code",
      addLink: "Ajouter un lien",
      removeLink: "Retirer le lien",
      insertImage: "Insérer une image",
      undo: "Annuler",
      redo: "Rétablir",
      chooseImage: "Choisir une image",
      articleHtml: "HTML de l\u2019article",
      noImageSelected: "Aucune image sélectionnée",
      pickOneBelow: "Choisissez ci-dessous, ou importez la vôtre.",
      closeImagePicker: "Fermer le sélecteur d\u2019images",
      imageAlt: "Description de l\u2019image (texte alternatif)",
      imageAltPlaceholder: "Ce que montre l\u2019image",
      replaceImage: "Remplacer l\u2019image",
      saveImage: "Enregistrer",
      toolbarLabel: "Mise en forme du texte",
      groupText: "Style du texte",
      groupHeadings: "Titres",
      groupBlocks: "Listes et blocs",
      groupLinks: "Liens",
      groupMedia: "Images",
      groupHistory: "Annuler et rétablir",
      linkDialogTitle: "Ajouter ou modifier un lien",
      linkDialogHelp: "Collez l’adresse complète, par exemple https://example.com/page.",
      linkUrlLabel: "Adresse du lien",
      linkApply: "Appliquer",
      linkInvalid: "Saisissez une adresse qui commence par https://, http://, mailto:, tel:, / ou #.",
      htmlHint: "Vous modifiez directement le HTML. Tout ce qui n’est pas sûr est supprimé à l’enregistrement.",
      richHint: "La mise en forme reste simple pour s’accorder au style de votre site.",
      editHtml: "Modifier le HTML",
      backToEditor: "Revenir à l’éditeur",
      htmlToolbarOff: "Les boutons de mise en forme sont désactivés pendant que vous modifiez le HTML.",
      noMatches: "Aucun résultat.",
      noPicturesYet: "Pas encore d\u2019images : importez-en une pour commencer.",
    },
    dash: {
      bestArticles: "Meilleurs articles",
      bestArticlesHelp: "Vos pages qui amènent le plus de visiteurs depuis Google.",
      openGoogleResults: "Ouvrir les résultats Google",
      connectForPages: "Connectez Google Search Console pour voir quelles pages les gens trouvent.",
      clicks: "Clics",
      impressions: "Impressions",
      position: "Position",
      searchPerformance: "Performance dans la recherche",
      websiteTraffic: "Trafic du site",
      aiSearchTraffic: "Trafic des recherches IA",
      googleTraffic: "Trafic Google",
      vsLastMonth: "vs mois dernier",
      averagePosition: "Position moyenne",
      connectForClicks: "Connectez Google Search Console pour voir clics, impressions et position.",
      achievements: "Résultats",
      achievementsHelp: "Tout cela s\u2019est produit automatiquement depuis votre inscription.",
      last30Days: "30 derniers jours",
      adSpendSaved: "Budget pub économisé",
      adSpendHelp: "Ce que ce trafic coûterait en Google Ads.",
      backlinkCostSaved: "Coût des liens économisé",
      showedUpHelp: "À quelle fréquence vous êtes apparu dans Google.",
      visitorsFromArticles: "Visiteurs venus des articles",
      siteHealth: "La santé de votre site",
      siteHealthHelp: "Sur 100, d\u2019après votre dernière analyse.",
      websiteAuthority: "Autorité du site",
      backlinks: "Liens entrants",
      openBacklinks: "Ouvrir les liens",
      backlinkExchange: "Réseau de liens",
      getCredits: "Obtenir des crédits",
      verifiedBacklinks: "Liens vérifiés",
      availableCredits: "Crédits disponibles",
      noLinksYet: "Aucun lien pour l\u2019instant. Dès que d\u2019autres sites du réseau pointeront vers le vôtre, ils apparaîtront ici.",
      todaysArticle: "L\u2019article du jour",
      nothingWrittenYet: "Rien de rédigé pour l\u2019instant. Une fois votre plan de contenu établi, l\u2019article du jour apparaîtra ici.",
      openContentPlan: "Ouvrir le plan de contenu",
      searchVolume: "Volume de recherche",
      difficulty: "Difficulté",
      articleType: "Type d\u2019article",
      whyThisTopic: "Pourquoi ce sujet ?",
      view: "Voir",
      addAWebsite: "Ajouter un site",
      sharedWithYou: "Partagés avec vous",
      sharedSiteLabel: "Partagé avec vous · {role}",
      roleEditor: "Éditeur",
      roleViewer: "Lecteur",
    },
    wpConnect: {
      title: "Connecter WordPress",
      signedInAs: "Connecté en tant que {email}",
      goneTitle: "Cette connexion est terminée",
      goneBody: "Elle a expiré, a été annulée ou a déjà été utilisée. Retournez dans WordPress et cliquez à nouveau sur Connect to RepGet.",
      otherBrowserTitle: "Cette connexion a été ouverte ailleurs",
      otherBrowserBody: "Pour votre sécurité, une connexion ne peut être terminée que dans le navigateur qui l’a ouverte en premier. Retournez dans WordPress et cliquez à nouveau sur Connect to RepGet.",
      noneTitle: "{domain} n’est pas encore dans ce compte RepGet",
      noneBody: "Ajoutez d’abord {domain} comme site, puis cliquez à nouveau sur Connect to RepGet dans WordPress. S’il se trouve dans un autre compte RepGet, connectez-vous à celui-ci. Si WordPress fonctionne à une autre adresse que votre site dans RepGet (par exemple blog.example.com), connectez-le avec une clé : dans RepGet, ouvrez Intégrations → Plugin WordPress → Clés (avancé) → Nouvelle clé, puis collez-la dans WordPress sous Advanced: use an Integration Key.",
      addWebsite: "Ajouter un site",
      useOtherAccount: "Utiliser un autre compte",
      confirmTitle: "Connecter {domain} à RepGet ?",
      confirmBody: "Le site WordPress {site} publiera les articles que RepGet rédige pour le site ci-dessous. Vous pouvez le déconnecter à tout moment dans WordPress.",
      inWorkspace: "Espace de travail « {workspace} »",
      movedWarning: "Ce site WordPress est connecté à un autre compte RepGet. Si vous continuez, ce compte cessera d’y publier.",
      movedWarningNamed: "Ce site WordPress est connecté à {domain} dans l’espace de travail « {workspace} ». Si vous continuez, ce site cessera d’y publier.",
      connect: "Connecter {domain}",
      connectAgain: "Reconnecter {domain}",
      move: "Déplacer {domain} vers « {workspace} »",
      cancel: "Annuler",
      tooManyKeys: "Ce site a déjà 5 clés. Révoquez-en une que vous n’utilisez plus dans Intégrations → Clés (avancé), puis réessayez.",
      notAllowed: "Vous ne pouvez pas connecter WordPress à ce site avec ce compte.",
    },
    auth: {
      redirecting: "Redirection…",
      continueWithGoogle: "Continuer avec Google",
      orContinueWithEmail: "Ou continuer avec un e-mail",
      fullName: "Nom complet",
      namePlaceholder: "Jean Dupont",
      email: "E-mail",
      emailPlaceholder: "vous@exemple.com",
      password: "Mot de passe",
      passwordHint: "Au moins 8 caractères.",
      tooManyAttempts: "Trop de tentatives. Patientez quelques minutes et réessayez.",
      passwordTooLong: "Utilisez 128 caractères au maximum.",
      emailMeACode: "Envoyez-moi un code par e-mail",
      usePasswordInstead: "Utiliser un mot de passe",
      sendCode: "M\u2019envoyer un code",
      sendingCode: "Envoi de votre code…",
      codeLabel: "Code de connexion",
      codePlaceholder: "123456",
      codeHelp: "Nous avons envoyé un code à six chiffres à {email}. Il expire dans 10 minutes.",
      verifyCode: "Se connecter",
      verifying: "Vérification de votre code…",
      resendCode: "Envoyer un autre code",
      useDifferentEmail: "Utiliser une autre adresse",
      codeSent: "Consultez votre boîte mail pour le code.",
      codeNotSent: "Ce code n\u2019a pas pu être envoyé. Réessayez.",
      codeInvalid: "Ce code est incorrect ou a expiré.",
      enterEmailFirst: "Saisissez d\u2019abord votre adresse e-mail.",
      organizations: "Organisations",
      loading: "Chargement…",
      createOrganization: "Créer une organisation",
      orgHelp: "Chaque organisation a ses propres sites, contenus et facturation.",
      name: "Nom",
      orgPlaceholder: "Acme Marketing",
      cancel: "Annuler",
      notifications: "Notifications",
      markAllRead: "Tout marquer comme lu",
      nothingYet: "Rien pour l\u2019instant. Nous vous préviendrons ici dès que vos articles et audits seront prêts.",
      unread: "Non lu",
    },
    onboarding: {
      whatsYourWebsite: "Quel est votre site web ?",
      websiteIntro: "Saisissez votre site et nous déterminerons ce que fait votre entreprise, pour qui, et sur quoi elle doit se positionner.",
      websiteAddress: "L\u2019adresse de votre site",
      websitePlaceholder: "votreentreprise.com",
      lookUpWebsite: "Analyser ce site",
      detected: "Détecté",
      addingWebsite: "Ajout de votre site…",
      continueLabel: "Continuer",
      pressArrow: "Appuyez sur la flèche pour vérifier votre site d\u2019abord, ou continuez directement.",
      readingWebsite: "Lecture de votre site…",
      websiteFound: "Site trouvé",
      enterAddressToSee: "Saisissez votre adresse pour voir ce que nous trouvons.",
      regionNext: "Région et catégorie ensuite",
      weWillUseWebsite: "Nous utiliserons votre site pour comprendre votre entreprise.",
      activateRepGet: "Activer RepGet",
      seeHowAiTalks: "Voyez comment l\u2019IA parle de votre marque",
      trackQuestions: "Suivez les questions que les clients posent à l\u2019IA avant de découvrir votre entreprise.",
      trackingOn: "Suivi actif",
      noAssistants: "Aucun assistant n\u2019est encore configuré sur ce déploiement. Les questions sont enregistrées et vérifiées dès qu\u2019il y en a un.",
      questionsWorthTracking: "Questions à suivre",
      suggestedFromSite: "Nous les avons suggérées à partir de votre site et de votre marché. Retirez celles qui ne conviennent pas.",
      writingQuestions: "Rédaction des questions que poseraient vos clients…",
      noQuestionsYet: "Aucune question pour l\u2019instant. Ajoutez-en une ci-dessous, ou demandez des suggestions.",
      addQuestionPlaceholder: "Ajoutez une question que poseraient vos clients",
      addQuestion: "Ajouter la question",
      writing: "Rédaction…",
      suggestMore: "Suggérer plus",
      getStarted: "Commencer",
      setupProgress: "Progression de la configuration",
      readingNow: "Nous lisons votre site. Cela prend généralement une à deux minutes.",
      view: "Voir",
      goToDashboard: "Aller à votre tableau de bord",
      searchOpportunities: "Opportunités de recherche",
      topicClusters: "Groupes de sujets",
      publishingPlan: "Plan de publication",
      articlesContentBacklinks: "Articles, contenu et liens",
      heresWhatWellBuild: "Voici ce que nous allons construire",
      thenOnChecklist: "Ensuite, sur votre liste de configuration",
      buildMyPlan: "Créer mon plan de contenu",
      starting: "Démarrage…",
      takesFewMinutes: "Cela prend quelques minutes. Vous pouvez continuer pendant que nous le préparons en arrière-plan.",
      connectGoogle: "Connecter Google",
      analyticsTellUs: "Analytics et Search Console nous disent quels articles fonctionnent, pour en écrire davantage.",
      connectedChangeLater: "Connecté. Vous pourrez le changer plus tard dans Intégrations.",
      openingGoogle: "Ouverture de Google…",
      whyWeAsk: "Pourquoi nous le demandons",
      readPerformanceOnly: "Nous lisons uniquement les performances : clics, impressions et sessions de votre propre site. Nous ne publions, ne modifions ni ne supprimons rien dans votre compte Google, et vous pouvez vous déconnecter à tout moment.",
      connected: "Connecté",
      plansUnavailable: "Les forfaits ne sont pas disponibles pour le moment. Revenez bientôt.",
      growthEngineReady: "Votre moteur de croissance est prêt",
      plan: "Forfait",
      payYearly: "Paiement annuel",
      paypalNoTrial: "PayPal démarre votre forfait immédiatement, sans essai gratuit.",
      cancelAnyTime: "Annulez à tout moment. Un code promo peut être saisi au paiement.",
      whatsIncluded: "Ce qui est inclus",
      secureByStripe: "Paiement sécurisé par Stripe. Vos données bancaires ne nous parviennent jamais.",
      paymentTakingLonger: "Votre paiement est passé. L\u2019activation du forfait prend plus de temps que d\u2019habitude.",
      activatingNow: "Merci. Nous activons votre forfait ; cela prend généralement quelques secondes.",
      goToMyWebsite: "Aller à mon site",
      checkBilling: "Voir la facturation",
      extraordinaryBusinesses: "Les entreprises remarquables méritent plus de visibilité.",
      chooseYourPlan: "Choisissez votre forfait",
      whatHappensSubscribe: "Ce qui se passe dès votre abonnement",
      weResearchKeywords: "Nous recherchons vos mots-clés, construisons un calendrier de contenu adapté à votre forfait et commençons à rédiger. Vous aurez votre premier article à relire peu après.",
      contentAndBacklinks: "Contenu et liens",
      addYourWebsite: "Ajoutez votre site",
    },
  },
};

const it: Messages = {
  nav: {
    howItWorks: "Come funziona",
    freeCheck: "Analisi gratuita",
    tools: "Strumenti",
    pricing: "Prezzi",
    blog: "Blog",
    faq: "Domande frequenti",
    about: "Chi siamo",
    signIn: "Accedi",
    getStarted: "Inizia",
    contact: "Contatti",
    successStories: "Casi di successo",
    getStartedCta: "Inizia",
    platform: "Piattaforma",
    platformHeading: "Esplora la piattaforma",
    platformItems: [
      {
        title: "Motore di contenuti",
        detail:
          "Pianifica e genera articoli pensati per far crescere la visibilità organica.",
      },
      {
        title: "Rete di autorità",
        detail:
          "Ottieni backlink pertinenti e rafforza l'autorità del dominio.",
      },
      {
        title: "Intelligence del sito",
        detail:
          "Individua problemi tecnici e SEO che influiscono sulle prestazioni.",
      },
      {
        title: "Performance di ricerca",
        detail: "Monitora posizioni, visibilità e risultati su Google.",
      },
      {
        title: "Presenza IA",
        detail:
          "Controlla quanto spesso il tuo brand compare su ChatGPT, Claude, Perplexity e nella ricerca IA.",
      },
      {
        title: "Recupero del traffico",
        detail:
          "Individua le pagine in calo prima che il traffico prezioso sparisca.",
      },
    ],
  },
  footer: {
    tagline: "Risultati SEO per le piccole imprese, senza agenzia.",
    product: "Prodotto",
    legal: "Note legali",
    freeCheck: "Analisi gratuita del tuo sito",
    freeTools: "Strumenti gratuiti",
    pricing: "Prezzi",
    blog: "Blog",
    faq: "Domande frequenti",
    about: "Chi siamo",
    contact: "Contatti",
    backlinkExchange: "Scambio di link",
    publishers: "Monetizza il tuo blog",
    affiliate: "Segnala un'azienda",
    privacy: "Privacy",
    terms: "Termini",
    refunds: "Rimborsi",
  },
  home: {
    eyebrow: "Posizionati. Fatti citare. Fatti consigliare.",
    title: "Si posizioni su Google. Compaia nelle risposte IA",
    subtitle:
      "RepGet pubblica contenuti SEO, ottiene backlink di qualità e costruisce l'autorevolezza che fa scoprire la sua azienda.",
    checkFree: "Controlla il mio sito gratis",
    getStarted: "Inizia",
    noCard: "Nessuna carta richiesta per la prima analisi.",
    auditBand: "Incluso con la tua analisi",
    auditItems: [
      {
        title: "Analisi SEO e IA",
        body: "Veda lo stato del suo sito, che cosa manca e se gli assistenti IA la citano.",
      },
      {
        title: "Un piano su cui agire",
        body: "Le modifiche che contano davvero, nell'ordine in cui conviene farle.",
      },
      {
        title: "Il suo primo link",
        body: "Un link da un'azienda reale di un settore affine, guadagnato e non comprato.",
      },
    ],
    auditPlaceholder: "Inserisca il suo sito",
    auditAssurances: ["Senza registrarsi", "Nulla da annullare"],
    checkMyWebsite: "Analizza il mio sito",
    howItWorks: "Come funziona",
    steps: [
      {
        title: "Analisi",
        body: "Leggiamo il suo sito, troviamo che cosa lo frena e verifichiamo se gli assistenti IA lo citano.",
      },
      {
        title: "Collegamento",
        body: "Colleghi il suo sito - WordPress, Ghost, Shopify o un webhook - così pubblichiamo noi per lei.",
      },
      {
        title: "Crescita",
        body: "Facciamo ricerca, scriviamo e pubblichiamo, poi le mostriamo che cosa è cambiato davvero.",
      },
    ],
    problemsEyebrow: "Problemi e soluzione",
    yourProblem: "Il suo problema",
    ourSolution: "La nostra soluzione",
    problems: [
      "Le campagne a pagamento consumano il budget ogni mese e si fermano appena si ferma lei.",
      "Ore perse tra analisi, parole chiave, contenuti e una serie di strumenti separati.",
      "Gli assistenti IA consigliano i suoi concorrenti, e lei non lo scopre mai.",
    ],
    solutionTitle: "Tutto quello che serve, in un unico posto",
    solution: [
      "Analisi SEO e di preparazione all'IA",
      "Monitoraggio della visibilità negli assistenti IA",
      "Ricerca di parole chiave e di mercato",
      "Articoli scritti per lei e pubblicati automaticamente",
      "Link guadagnati da aziende reali",
    ],
    stackEyebrow: "Noi contro una serie di strumenti",
    stackTitle: "Un abbonamento sostituisce",
    stackTitleAccent: "tutti i suoi strumenti SEO",
    stackSub:
      "Analisi, visibilità IA, ricerca, contenuti, pubblicazione, link e report: tutto in un posto e a meno di quanto costino gli strumenti separati.",
    seePricing: "Vedi i prezzi",
    replaces: [
      "Analisi SEO e scansione del sito",
      "Monitoraggio della visibilità IA",
      "Ricerca di parole chiave e di mercato",
      "Articoli scritti e ottimizzati",
      "Pubblicazione sul suo CMS",
      "Costruzione di link",
      "Report da Search Console e Analytics",
    ],
    publishesTitle: "Pubblica",
    publishesAccent: "direttamente",
    publishesTitleEnd: "sul suo sito",
    publishesSub:
      "Colleghi una volta sola. Nessun caricamento manuale, nessun copia e incolla: gli articoli compaiono da soli sul suo sito, con le immagini.",
    publishesPlugin:
      "Il nostro plugin per WordPress si collega con una sola chiave e funziona anche se il suo hosting blocca le API di WordPress.",
    platformOther: "Qualsiasi sito tramite webhook",
    trackedTitle: "Vede esattamente che cosa è cambiato",
    trackedSub:
      "Non un PDF mensile. Una dashboard che legge i suoi dati di Search Console e Analytics.",
    tracked: [
      { label: "Posizioni e clic", detail: "Da Search Console" },
      { label: "Visibilità IA", detail: "Se gli assistenti la nominano" },
      { label: "Link ottenuti", detail: "Verificati ogni giorno" },
      { label: "Articoli pubblicati", detail: "E che risultati hanno dato" },
    ],
    pillars: [
      {
        title: "Pubblichi contenuti SEO",
        body: "Articoli di qualità generati e ottimizzati per il suo settore.",
      },
      {
        title: "Ottenga backlink veri",
        body: "Sia citato su siti pertinenti per aumentare la sua autorevolezza.",
      },
      {
        title: "Monitori i progressi",
        body: "Posizioni, traffico e risultati in un'unica dashboard.",
      },
      {
        title: "Risparmi tempo con l'IA",
        body: "Lasci lavorare l'IA mentre lei si concentra sulla sua attività.",
      },
    ],
    previewTitle: "La sua crescita, in automatico.",
    previewSub: "Contenuti di qualità. Backlink veri. Più visibilità.",
    previewCaption:
      "Una dashboard di esempio. I suoi numeri partono da zero e crescono da lì.",
    titleLead: "Si posizioni su Google.",
    titleAccent: "Compaia nelle risposte IA.",
    heroCards: [
      { label: "Posizioni e clic", detail: "Da Search Console" },
      { label: "Visibilità IA", detail: "Se gli assistenti la nominano" },
      { label: "Crescita del traffico", detail: "Raggiunga più clienti" },
      { label: "Presente nelle risposte IA", detail: "Dove conta davvero" },
      { label: "Backlink di qualità", detail: "Citato da siti veri" },
      { label: "Monitoraggio parole chiave", detail: "Veda cosa funziona" },
    ],
    joinGoogle: "Entra con Google",
    seeHow: "Guarda come funziona",
    videoTitle: "RepGet in due minuti",
    videoSub:
      "Una breve panoramica di cosa succede dopo aver collegato un sito.",
    videoComingSoon:
      "Stiamo registrando il video di presentazione. Nel frattempo, il controllo gratuito le mostra la stessa cosa sul suo sito.",
    worksWithTitle: "Funziona con gli strumenti che già usa",
    networkEyebrow: "Una rete di link verificata",
    networkTitle: "Una rete di link",
    networkTitleRest: "che si rafforza con ogni nuovo cliente.",
    networkHeading: "Scambio di link automatico",
    networkPoints: [
      "Ogni cliente dà e riceve link",
      "I link arrivano da aziende di settori affini, mai estranei",
      "Inseriti dentro articoli veri, non in una pagina di link",
      "Verificati ogni giorno: se un link sparisce, ce lo segnali e il credito torna indietro",
    ],
    networkHowLink: "Come funziona lo scambio",
    pricingEyebrow: "Prezzi",
    pricingTitle: "Inizi in piccolo.",
    pricingTitleAccent: "Cresca quando è pronto.",
    pricingSub:
      "Un'analisi gratuita per iniziare, senza vincoli, e disdica quando vuole.",
    seeAllPlans: "Vedi tutto ciò che include ogni piano",
    mostPopular: "Il più scelto",
    tryItFirst: "Provalo prima",
    getStartedPlan: "Inizia",
    perMonth: " / mese",
    unavailable:
      "I prezzi non sono disponibili in questo momento. Riprovi tra poco.",
    planArticles: "{n} articolo al mese|{n} articoli al mese",
    planBacklinks: "Backlink dalla nostra rete di partner",
    planPublishing: "Pubblicazione automatica su WordPress, Shopify e altro",
    closingTitle: "Inizi oggi a crescere in automatico",
    closingSub:
      "Faccia un'analisi gratuita del suo sito e veda che cosa lo frena. Senza registrarsi.",
    cancelAnytime: "Disdica quando vuole",
    guarantee: "Garanzia di rimborso entro 14 giorni",
  },
  pricing: {
    title: "Prezzi semplici",
    subtitle:
      "Ogni piano include tutto. La differenza è quanto scriviamo per lei ogni mese e quanti backlink riceve dalla nostra rete di partner.",
    perMonth: " / mese",
    getStarted: "Inizia",
    mostPopular: "Il più scelto",
    tryItFirst: "Provalo prima",
    starterTagline:
      "Provaci con un articolo vero e un backlink vero prima di passare a un piano superiore.",
    unavailable:
      "I prezzi non sono disponibili in questo momento. Riprovi tra poco.",
    annualNote:
      "I piani annuali sono disponibili dopo la registrazione, con due mesi gratis. Può disdire quando vuole: consulti la nostra",
    refundPolicy: "politica di rimborso",
    features: {
      articles: "{n} articolo scritto al mese|{n} articoli scritti al mese",
      keywords: "{n} termini di ricerca monitorati",
      backlinks: "Backlink dalla nostra rete di partner",
      audit: "Audit del sito, per pagine pronte per l'IA e Google",
      healthChecks: "Controlli sullo stato del sito",
      publishing: "Pubblica su WordPress, Ghost o Shopify",
    },
  },
  about: {
    metaTitle: "Chi siamo",
    metaDescription: "Perché RepGet esiste e a chi si rivolge.",
    title: "Risultati SEO senza agenzia",
    intro: [
      'Un dentista, un idraulico o un piccolo studio legale sa di dover "fare SEO". Ciò che serve davvero è qualcuno che studi le parole chiave, qualcuno che scriva, qualcuno che capisca gli audit tecnici e qualcuno che ottenga i link. Un\'agenzia mette insieme tutto questo per qualche migliaio al mese.',
      "La maggior parte delle piccole imprese non può giustificare quella spesa, quindi non fa nulla e resta invisibile proprio sulle ricerche che le porterebbero clienti.",
      "Abbiamo creato questo servizio per svolgere quel lavoro automaticamente, a un prezzo che una piccola impresa può davvero permettersi.",
    ],
    beliefTitle: "In cosa crediamo",
    beliefLead: "Consigliare solo ciò che si può davvero vincere.",
    belief: [
      "Un termine cercato 12.000 volte al mese non le serve a nulla se non ha alcuna possibilità di posizionarsi. Uno cercato 300 volte, da chi è pronto ad acquistare, può portarle un cliente il mese prossimo.",
      "Questo principio è integrato nel prodotto, non solo scritto qui. Il nostro punteggio mette deliberatamente i termini raggiungibili sopra quelli popolari e valuta se chi cerca ha davvero intenzione di acquistare. Il nostro abbinamento dei link rifiuta di associare un dentista a un sito non pertinente, anche quando i numeri sembrano buoni.",
      "Uno strumento che produce un lavoro all'apparenza impeccabile che nessuno troverà mai è peggio che inutile: costa denaro e non consegna nulla.",
    ],
    audienceTitle: "A chi si rivolge",
    audience:
      'Piccole imprese e attività locali che hanno bisogno di clienti, non di cruscotti. Non dovrebbe mai dover imparare cosa significa "difficoltà della parola chiave". Il giudizio lo mettiamo noi; lei vede un piano, gli articoli e che cosa è cambiato.',
  },
  successStories: {
    metaTitle: "Casi di successo",
    metaDescription:
      "Ciò che misurano i clienti RepGet: posizioni, visibilità IA, articoli pubblicati e backlink ottenuti, e come arrivano i primi risultati.",
    eyebrow: "Casi di successo",
    title:
      "Preferiamo mostrarle ciò che misuriamo piuttosto che inventare un cliente.",
    intro:
      "RepGet è nuovo e non inventeremo un'azienda che lo ha usato né arrotonderemo i numeri di qualcuno per una pagina di vendita. Ecco cosa misura davvero il prodotto e come sono onestamente i primi mesi.",
    results: [
      {
        label: "Posizioni e clic",
        body: "Presi dalla sua Search Console, non stimati. Vede su quali ricerche è salito e quanti clic ha portato.",
      },
      {
        label: "Visibilità IA",
        body: "Se ChatGPT, Claude e Perplexity nominano la sua azienda quando qualcuno chiede ciò che lei vende. Verificato sulle sue domande.",
      },
      {
        label: "Articoli pubblicati",
        body: "Cosa è stato scritto, quando è uscito e che risultato ha dato - così un mese di lavoro ha una risposta e non solo una fattura.",
      },
      {
        label: "Backlink ottenuti",
        body: "Link veri dentro articoli veri su siti di altre aziende, controllati ogni giorno. Se un link viene rimosso, ce lo segnali e il credito le torna.",
      },
    ],
    timelineTitle: "Come sono i primi tre mesi",
    timelineIntro:
      "Onestamente, compresa la parte in cui non è ancora successo nulla.",
    timeline: [
      {
        when: "Prima settimana",
        body: "Analizziamo il sito, troviamo i problemi tecnici che lo frenano e pianifichiamo un mese di articoli su ciò che i suoi clienti cercano davvero.",
      },
      {
        when: "Settimane due-quattro",
        body: "Gli articoli escono secondo il suo calendario. I backlink iniziano a essere inseriti man mano che le altre aziende della rete pubblicano i loro.",
      },
      {
        when: "Dal secondo mese",
        body: "Arrivano i dati di Search Console dei primi articoli. È qui che le posizioni iniziano a muoversi: la SEO non rende nella prima settimana, e chi promette il contrario le sta vendendo altro.",
      },
    ],
    ctaTitle: "Sia il primo caso di questa pagina.",
    ctaBody:
      "Inizi con un controllo gratuito del sito: un minuto e nessun costo. Se ciò che troviamo merita, i nuovi account possono provare RepGet gratis per {days} giorni.",
    ctaPrimary: "Controlla il mio sito",
    ctaSecondary: "Vedi i prezzi",
  },
  publishers: {
    metaTitle: "Monetizzi il suo blog",
    metaDescription:
      "Ospiti un articolo al mese per un'azienda di un settore affine e guadagni crediti da spendere in link verso il suo sito.",
    title: "Monetizzi il suo blog",
    intro:
      "Ospiti un articolo al mese per un'azienda di un settore affine e guadagni crediti da spendere in link verso il suo sito.",
    creditsTitle: "Crediti, non denaro",
    creditsBody:
      "Il compenso è in crediti per link, non in denaro. Un articolo ospitato vale un credito, e un credito le procura un link dal sito di un'altra azienda. Se cerca un pagamento in denaro per articoli ospiti, questo non lo è: esistono marketplace che lo fanno.",
    steps: [
      {
        title: "Ci dica di cosa parla il suo sito",
        body: "Argomento, lingua e paese. La abbiniamo solo ad aziende di un settore affine.",
      },
      {
        title: "Scelga quanti articoli al mese",
        body: "Fino a venti, ma la maggior parte inizia con tre. Può sospendere o uscire quando vuole.",
      },
      {
        title: "Scriviamo noi l'articolo",
        body: "Un articolo vero su un tema che interessa ai suoi lettori, scritto per il suo sito, con un link naturale all'interno.",
      },
      {
        title: "Lei guadagna un credito",
        body: "Un credito per articolo ospitato, spendibile in un link verso il suo sito da quello di un altro.",
      },
    ],
    controlTitle: "Cosa controlla lei",
    rules: [
      {
        title: "Solo argomenti affini",
        body: "Non le chiederemo mai di ospitare qualcosa estraneo al suo sito. Se non possiamo stabilire che due siti sono collegati per argomento, non facciamo l'abbinamento.",
      },
      {
        title: "Il limite lo decide lei",
        body: "Da uno a venti articoli al mese, modificabile quando vuole. Impostandolo a zero non riceve più richieste.",
      },
      {
        title: "Il controllo editoriale resta suo",
        body: "Gli articoli arrivano come bozze sul suo sito. Pubblichi, modifichi o rifiuti: nulla va online senza di lei.",
      },
    ],
    suitsTitle: "A chi è utile",
    suitsBody:
      "A una piccola azienda con un blog che già pubblica ogni tanto e vuole link alle proprie pagine senza pagarli. Se il suo sito non ha lettori, ospitare articoli non lo cambierà: i link che guadagna valgono quanto vale il suo sito.",
    joinNote:
      "L'adesione è inclusa in ogni piano. La attivi dalle impostazioni del sito.",
    ctaPrimary: "Inizia",
    ctaSecondary: "Come funziona lo scambio",
  },
  affiliate: {
    metaTitle: "Segnali un'azienda",
    metaDescription:
      "Condivida il suo link e guadagni crediti quando una persona che ha segnalato paga il primo mese.",
    title: "Segnali un'azienda, guadagni crediti",
    intro:
      "Condivida il suo link. Quando una persona che ha segnalato paga il primo mese, i crediti arrivano sul suo account.",
    steps: [
      {
        title: "Condivida il suo link",
        body: "Ogni account ha un link. Lo trova nelle Impostazioni appena si registra.",
      },
      {
        title: "Si registra e si abbona",
        body: "Nulla è dovuto finché qualcuno sta solo provando il prodotto. La segnalazione conta quando paga il primo mese.",
      },
      {
        title: "Lei riceve i crediti",
        body: "I crediti arrivano automaticamente sul suo account e vanno ai link verso il suo sito.",
      },
    ],
    termsTitle: "Le condizioni, senza giri di parole",
    terms: [
      "Il premio è credito sull'account, non denaro. Non è prelevabile.",
      "Una segnalazione conta quando la persona segnalata paga il primo mese.",
      "Si possono segnalare solo account nuovi, e ognuno una sola volta.",
      "I crediti si spendono in link building dentro il prodotto.",
    ],
    ctaPrimary: "Inizia",
    ctaNote:
      "Il suo link di segnalazione è nelle Impostazioni appena ha un account.",
  },
  backlinkExchange: {
    metaTitle: "Come funziona lo scambio di link",
    metaDescription:
      "Guadagni link verso il suo sito pubblicando un articolo per un'altra azienda. Solo abbinamenti pertinenti, verificati ogni giorno, crediti rimborsati quando si conferma che un link è sparito.",
    title: "Come funziona lo scambio di link",
    intro:
      "I link si guadagnano dandoli. Lei ospita un articolo per un'azienda di un settore affine e spende ciò che guadagna in link verso il suo sito.",
    steps: [
      {
        title: "Lei ospita un articolo",
        body: "Scriviamo un articolo per un'altra azienda di un settore affine e lo pubblichiamo sul suo sito. È un articolo vero su un tema che interessa ai suoi lettori, non una pagina di link.",
      },
      {
        title: "Lei guadagna un credito",
        body: "Ospitare un articolo vale un credito. Il suo piano include anche crediti ogni mese, quindi può iniziare prima di aver ospitato qualcosa.",
      },
      {
        title: "Lo spende in un link",
        body: "Un credito compra un link verso il suo sito, inserito con naturalezza in un articolo sul sito di un'altra azienda affine.",
      },
    ],
    rulesTitle: "Le regole che lo rendono utile",
    rules: [
      {
        title: "Solo argomenti affini",
        body: "Un dentista non viene mai abbinato a un blog di criptovalute. Se non possiamo stabilire che due siti sono collegati per argomento, non facciamo l'abbinamento: un link fuori tema non vale nulla e può fare danni.",
      },
      {
        title: "Controllati ogni giorno",
        body: "Ricontrolliamo ogni link quotidianamente. I link non spariscono in silenzio senza che lei lo sappia.",
      },
      {
        title: "Crediti rimborsati se un link cade",
        body: "Se un link viene rimosso, ce lo segnali: una volta confermato che è sparito, il credito le torna e il link sparisce dalla dashboard. Un sito offline solo per un po', per manutenzione ad esempio, mantiene i suoi link.",
      },
    ],
    notTitle: "Cosa non è",
    notBody:
      "Non è una rete privata di blog. Ogni link si trova dentro un articolo vero sul sito di un'azienda vera, pubblicato perché quell'azienda voleva un articolo.",
    ctaTitle: "Ogni piano include crediti",
    ctaBody: "Può richiedere i primi link prima di aver ospitato qualcosa.",
    ctaPrimary: "Inizia",
    ctaSecondary: "Preferisco ospitare articoli",
  },
  faq: {
    metaTitle: "Domande frequenti",
    metaDescription: "Domande comuni sul funzionamento di RepGet.",
    title: "Domande frequenti",
    subtitle: "Risposte chiare, limiti compresi.",
    items: [
      {
        question: "Devo sapere qualcosa di SEO?",
        answer:
          "No. È proprio questo il senso del servizio. Individuiamo quali ricerche usano i suoi clienti, scriviamo le pagine che rispondono e le spieghiamo in parole semplici che cosa è cambiato. Non dovrà mai imparare che cos'è un tag canonical.",
      },
      {
        question: "Quanto tempo prima di vedere risultati?",
        answer:
          "Di solito dai due ai quattro mesi prima che le nuove pagine inizino a portare visitatori, e di più nei settori competitivi. Chi le promette risultati in poche settimane non è sincero. I motori di ricerca hanno bisogno di tempo per trovare, dare fiducia e posizionare pagine nuove.",
      },
      {
        question: "Garantite il primo posto su Google?",
        answer:
          "No, e nemmeno nessun altro può farlo. Google decide che cosa posizionare e cambia continuamente il proprio funzionamento. Quello che facciamo è trovare le ricerche che può davvero vincere, scrivere bene le pagine e mostrarle con onestà che cosa è successo.",
      },
      {
        question: "Gli articoli sembreranno scritti da un robot?",
        answer:
          "Sono scritti da un'IA, quindi è bene leggerli prima della pubblicazione: per questo le diamo un editor. Sono scritti per la sua attività, nella sua lingua e nel suo mercato, e può impostare il tono che preferisce.",
      },
      {
        question: "Gli articoli finiscono automaticamente sul mio sito?",
        answer:
          "Solo se collega il suo sito e sceglie di pubblicare. Supportiamo WordPress, Ghost e Shopify, oltre a un webhook per tutto il resto. Altrimenti restano come bozze da rivedere, modificare o copiare altrove.",
      },
      {
        question: "Che cosa sono i crediti per i link?",
        answer:
          "Google si fida di più di un sito quando altri siti lo collegano. Quando un suo articolo cita l'attività di un altro membro, lei guadagna un credito. Spendendo un credito, l'articolo di un membro diverso rimanda a lei. Non collega mai chi ha collegato lei, così i link risultano naturali.",
      },
      {
        question: "Perché proponete ricerche più piccole?",
        answer:
          "Perché può vincerle. Un termine cercato 12.000 volte al mese per cui non ha alcuna possibilità vale meno di uno cercato 300 volte che le porta clienti il mese prossimo.",
      },
      {
        question: "Posso disdire quando voglio?",
        answer:
          "Sì, dalla pagina di fatturazione e senza penali. L'accesso prosegue fino alla fine del periodo già pagato.",
      },
      {
        question: "Che fine fanno i miei articoli se me ne vado?",
        answer:
          "Tutto ciò che è già pubblicato resta sul suo sito: è contenuto suo. Gli articoli che scriviamo per lei le appartengono.",
      },
    ],
  },
  contact: {
    metaTitle: "Contatti",
    metaDescription: "Come contattare RepGet.",
    title: "Contattaci",
    subtitle:
      "Domande sul prodotto, sul suo account o sulla fatturazione: leggiamo ogni messaggio e rispondiamo entro due giorni lavorativi.",
    emailLabel: "E-mail",
    accountNote:
      "Se scrive riguardo al suo account, lo faccia dall'indirizzo con cui si è registrato.",
  },
  notFound: {
    metaTitle: "Pagina non trovata",
    eyebrow: "Errore 404",
    title: "Non abbiamo trovato questa pagina",
    body: "L’indirizzo potrebbe essere errato, oppure la pagina è stata spostata o non esiste più.",
    home: "Vai alla pagina iniziale",
    elsewhere: "Oppure provi una di queste:",
  },
  legalNotice: "Questa pagina è disponibile solo in inglese. Le traduzioni dei nostri termini legali sono curate da un traduttore professionista prima della pubblicazione.",

  app: {
    workspace: {
      save: "Salva",
      saving: "Salvataggio…",
      saved: "Salvato",
      discard: "Annulla le modifiche",
      unsaved: "1 modifica non salvata|{count} modifiche non salvate",
      noChanges: "Tutte le modifiche sono salvate",
      saveFailed: "Non salvato. {error}",
      leaveConfirm: "Ci sono modifiche non salvate. Uscire da questa pagina e perderle?",
      onThisPage: "In questa pagina",
      jumpTo: "Vai a una sezione",
      optional: "Facoltativo",
      required: "Obbligatorio",
      charactersLeft: "1 carattere rimanente|{count} caratteri rimanenti",
      overLimit: "1 carattere oltre il limite|{count} caratteri oltre il limite",
      viewOnly: "Ha accesso in sola lettura a questo sito web. Solo un proprietario o un editor può apportare modifiche.",
      savesImmediately: "Si salva appena lo modifica",
      savedWithButton: "Si salva con il pulsante Salva",
      editsKept: "Le modifiche più recenti sono state mantenute e devono ancora essere salvate.",
      preview: "Anteprima",
      close: "Chiudi",
      selected: "Selezionato",
    },
    health: {
      title: "Salute del sito",
      description: "Un controllo tecnico delle pagine che riusciamo a leggere su {domain}: che cosa può frenarle nei risultati di ricerca e come correggerlo.",
      checkNow: "Controlla il mio sito",
      checkAgain: "Controlla di nuovo",
      checking: "Controllo in corso…",
      starting: "Avvio…",
      refreshStatus: "Aggiorna lo stato",
      dismiss: "Chiudi",
      unavailableTitle: "Nuovi controlli non disponibili",
      siteNotReady: "Stiamo ancora analizzando questo sito. Potrà avviare un controllo al termine dell’analisi.",
      errNoPlan: "Scelga prima un piano per questo sito.",
      errPlanInactive: "L’abbonamento di questo sito non è attivo. Aggiorni la fatturazione per avviare un controllo.",
      errQuota: "Ha avviato questo controllo diverse volte nell’ultima ora. Riprovi tra poco.",
      errUnexpected: "Non è stato possibile avviare il controllo. Riprovi.",
      queuedTitle: "Controllo richiesto",
      queuedBody: "Il suo controllo è in attesa di partire. Questa pagina si aggiorna da sola.",
      queuedStale: "Questo controllo non è ancora partito e sta richiedendo più tempo del solito. Il report comparirà qui una volta eseguito.",
      requestedAt: "Richiesto: {date}",
      runningTitle: "Controllo del suo sito",
      runningBody: "Stiamo leggendo le sue pagine una alla volta. Questa pagina si aggiorna da sola.",
      runningStale: "Questo controllo dura più del previsto e potrebbe essersi fermato.",
      staleRetry: "Aggiorni lo stato per vedere se è andato avanti, oppure avvii di nuovo il controllo.",
      startedAt: "Avviato: {date}",
      progressChecked: "1 pagina controllata finora|{count} pagine controllate finora",
      progressFound: "1 indirizzo trovato sul suo sito|{count} indirizzi trovati sul suo sito",
      progressLimit: "Ogni controllo legge fino a {max} pagine.",
      previousNotice: "Il report qui sotto è il suo risultato precedente, del {date}. Verrà sostituito al termine del nuovo controllo.",
      failedTitle: "Non è stato possibile completare l’ultimo controllo",
      failedPrevious: "Il report qui sotto è ancora il suo risultato precedente, del {date}.",
      finishedTitle: "Il suo nuovo report è pronto",
      finishedBody: "Il report qui sotto si riferisce al controllo del {date}.",
      failure: {
        timeout: "Il suo sito ha impiegato troppo a rispondere. Riprovi: spesso è un problema temporaneo di un server sovraccarico.",
        notHtml: "L’indirizzo del sito non ha restituito una pagina web. Verifichi che punti alla home page del suo sito.",
        tooLarge: "La sua home page è troppo grande per essere analizzata.",
        invalidUrl: "Non è stato possibile leggere l’indirizzo del sito. Controlli l’indirizzo, compreso http:// o https://.",
        refused: "Il suo sito ha rifiutato la nostra richiesta. Un firewall o un plugin di sicurezza potrebbe bloccare i visitatori automatici.",
        unreachable: "Non siamo riusciti a raggiungere il suo sito. Verifichi che sia online e che l’indirizzo sia corretto.",
        notEntitled: "Il controllo si è interrotto perché l’abbonamento di questo sito non è attivo. Non è stato addebitato altro.",
        generic: "Non siamo riusciti a completare il controllo del suo sito. Riprovi e contatti l’assistenza se il problema si ripete.",
      },
      failureViewer: {
        timeout: "Il suo sito ha impiegato troppo a rispondere. Spesso è un problema temporaneo di un server sovraccarico. Un proprietario o un editor può avviare di nuovo il controllo.",
        generic: "Non siamo riusciti a completare il controllo del suo sito. Un proprietario o un editor può avviare di nuovo il controllo.",
      },
      emptyTitle: "Ancora nessun report",
      emptyBody: "Un controllo legge fino a {max} pagine del suo sito ed elenca, pagina per pagina, che cosa può frenarlo nella ricerca e come correggere ogni problema.",
      emptyViewer: "Non è ancora stato eseguito alcun controllo. Un proprietario o un editor può avviarlo.",
      firstRunTitle: "Il suo primo report è in arrivo",
      firstRunBody: "Comparirà qui non appena il controllo sarà terminato.",
      scoreTitle: "Punteggio di salute",
      scoreDescription: "Conta i problemi tecnici delle pagine lette, pesati in base alla gravità e mediati per pagina.",
      previousResult: "Risultato precedente",
      latestResult: "Ultimo risultato",
      outOf: "su 100",
      scoreAria: "Punteggio di salute: {score} su 100",
      bandGood: "Buono",
      bandFair: "Da migliorare",
      bandPoor: "Scarso",
      noScore: "Nessun punteggio",
      noScoreBody: "Per questo controllo non è stato registrato alcun punteggio.",
      notScored: "Non valutato",
      zeroPagesTitle: "Non è stato possibile leggere alcuna pagina",
      zeroPagesBody: "In questo controllo non siamo riusciti ad aprire alcuna pagina, quindi il punteggio non descrive il suo sito. Le segnalazioni qui sotto spiegano perché.",
      notAuthority: "Non si tratta dell’Autorità di dominio: misura i problemi tecnici delle sue pagine, non quanto altri siti si fidano del suo.",
      lastChecked: "Ultimo controllo",
      pagesRead: "Pagine lette",
      pagesFailed: "Non aperte",
      addressesFound: "Indirizzi trovati",
      notRecorded: "Non registrato",
      severityTitle: "Problemi per gravità",
      critical: "Critici",
      warnings: "Avvisi",
      suggestions: "Suggerimenti",
      inFindings: "in 1 segnalazione|in {count} segnalazioni",
      severityAria: "Critici: {critical}, avvisi: {warning}, suggerimenti: {info}",
      badge: { critical: "Critico", warning: "Avviso", info: "Suggerimento" },
      coverageTitle: "Che cosa ha coperto questo controllo",
      coverageLimit: "Legge fino a {max} pagine, partendo dalla home page e seguendo i link.",
      coverageSameSite: "Segue solo i link all’interno di {domain}. I link ad altri siti non vengono controllati.",
      coverageQuery: "Gli indirizzi che differiscono solo dopo un «?» o un «#» contano come una sola pagina.",
      coverageSkipped: "Salta le pagine di amministrazione, accesso, carrello e pagamento, i feed e i file come immagini e PDF.",
      coverageRefused: "Una pagina che non risponde entro 15 secondi, o che rifiuta i visitatori automatici, viene indicata come «non aperta».",
      coverageBeyond: "Questo controllo ha trovato {found} indirizzi sul suo sito e letto {read} pagine. Le altre non sono state controllate.",
      notAssessedTitle: "Alcune verifiche non sono state eseguite",
      notAssessedBody: "Queste verifiche confrontano le pagine tra loro e richiedono almeno due pagine leggibili: {checks}. Non rientrano in questo punteggio.",
      crossChecks: {
        duplicateTitles: "titoli di pagina duplicati",
        duplicateDescriptions: "descrizioni duplicate",
        internalLinking: "link interni",
      },
      findingsTitle: "Segnalazioni",
      findingsDescription: "Prima le più gravi. Apra una segnalazione per vedere tutte le pagine coinvolte e come correggerla.",
      findingsCount: "1 segnalazione|{count} segnalazioni",
      filterLabel: "Filtra per gravità",
      filterAll: "Tutte",
      searchLabel: "Cerca nelle segnalazioni",
      searchPlaceholder: "Cerchi per problema o indirizzo di pagina",
      showingFiltered: "Segnalazioni mostrate: {shown} su {total}.",
      clearFilters: "Rimuovi i filtri",
      noMatchTitle: "Nessuna segnalazione corrisponde",
      noMatchBody: "Provi un’altra ricerca o mostri tutte le segnalazioni.",
      noFindingsTitle: "Nessun problema trovato",
      noFindingsBody: "Non abbiamo trovato nulla da correggere nella pagina letta.|Non abbiamo trovato nulla da correggere nelle {count} pagine lette.",
      pagesCount: "1 pagina|{count} pagine",
      howToFix: "Come correggere",
      effortMinutes: "Di solito pochi minuti",
      effortHour: "Di solito circa un’ora",
      effortLonger: "Può richiedere più tempo",
      needsDeveloper: "Potrebbe servire il suo sviluppatore web",
      affectedPages: "Pagine coinvolte ({count})",
      homepage: "home page",
      opensInNewTab: "(si apre in una nuova scheda)",
      showAllPages: "Mostra tutte le {count} pagine",
      showFewerPages: "Mostra meno pagine",
      matchingPages: "Pagine corrispondenti alla ricerca: {shown} su {total}.",
      notLoaded: "Ne sono elencate {shown} su {total}. Le altre non sono state caricate, per mantenere veloce questa pagina.",
      groupNote: "Ogni voce è un gruppo di pagine; per ogni gruppo è elencata la prima pagina.",
      firstPageNote: "È elencata la prima pagina trovata; il dettaglio indica il totale.",
      noUrl: "Nessun indirizzo di pagina registrato",
      rowsCapped: "Questo controllo ha registrato {total} problemi. Qui sotto sono elencati i primi {shown}; i totali qui sopra li includono tutti.",
      detail: {
        titleLong: "Il titolo è di {chars} caratteri; i risultati di ricerca lo tagliano dopo circa {max}.",
        titleShort: "Il titolo è di soli {chars} caratteri.",
        descriptionLong: "La descrizione è di {chars} caratteri; i risultati di ricerca la tagliano dopo circa {max}.",
        descriptionShort: "La descrizione è di soli {chars} caratteri.",
        multipleH1: "{count} titoli principali (H1) in questa pagina.",
        thinContent: "Solo {words} parole in questa pagina.",
        imagesAlt: "{missing} immagini su {total} non hanno una descrizione (testo alternativo).",
        largePage: "Il solo HTML della pagina pesa {kb} KB.",
        httpStatus: "La pagina ha risposto con l’errore {status}.",
        duplicateTitle: "{count} pagine condividono il titolo «{title}».",
        duplicateDescription: "{count} pagine condividono la stessa descrizione.",
        noInternalLinks: "1 pagina non rimanda a nessun’altra pagina del suo sito.|{count} pagine non rimandano a nessun’altra pagina del suo sito.",
        unreachTimeout: "Non ha risposto in tempo.",
        unreachBlocked: "Rifiuta i visitatori automatici (un’impostazione di sicurezza del sito).",
        unreachPassword: "Richiede una password.",
        unreachStatus: "Ha risposto con l’errore {status}.",
        unreachNotHtml: "Non è una pagina web.",
        unreachRedirects: "Reindirizza troppe volte.",
        unreachRedirectAway: "Reindirizza a un indirizzo che non controlliamo.",
        unreachConnect: "Non siamo riusciti a collegarci.",
        unreachUnknown: "Un errore imprevisto ci ha impedito di aprirla.",
      },
      issues: {
        noindex: {
          label: "Nascosta ai motori di ricerca",
          about: "La pagina chiede ai motori di ricerca di non includerla nei risultati, quindi non può essere trovata nelle ricerche.",
          fix: "Se non la nasconde di proposito, rimuova l’impostazione «noindex» della pagina. In WordPress di solito è un’opzione del plugin SEO, oppure la casella «Scoraggia i motori di ricerca» in Impostazioni › Lettura.",
        },
        broken_page: {
          label: "La pagina mostra un errore",
          about: "La pagina risponde con un errore invece di caricarsi.",
          fix: "Corregga la pagina oppure, se non deve più esistere, la reindirizzi alla pagina esistente più simile, per non perdere visitatori e link.",
        },
        unreachable_page: {
          label: "Impossibile aprire la pagina",
          about: "Abbiamo provato a caricare questa pagina senza riuscirci. I motori di ricerca potrebbero avere lo stesso problema.",
          fix: "Apra la pagina nel suo browser. Se non esiste più, aggiorni i link che vi puntano o la reindirizzi. Se a lei si apre, il suo hosting o un’impostazione di sicurezza potrebbe rifiutare i visitatori automatici, il che può tenere fuori anche i motori di ricerca.",
        },
        missing_title: {
          label: "La pagina non ha un titolo",
          about: "La pagina non ha un tag title, il titolo mostrato nei risultati di ricerca.",
          fix: "Dia alla pagina un titolo che dica di che cosa parla. È il titolo che le persone vedono nei risultati di ricerca: lo scriva per loro invece di riempirlo di parole chiave.",
        },
        title_too_long: {
          label: "Il titolo è troppo lungo",
          about: "I risultati di ricerca tagliano i titoli più lunghi di circa 60 caratteri.",
          fix: "Accorci il titolo perché la parte importante non venga tagliata. Metta per prima la cosa più importante: è la fine a essere tagliata.",
        },
        title_too_short: {
          label: "Il titolo è molto breve",
          about: "I titoli sotto i 30 caratteri spesso dicono troppo poco della pagina.",
          fix: "Aggiunga dettagli al titolo, così dai risultati di ricerca si capisce che questa pagina è quella che si cerca.",
        },
        missing_meta_description: {
          label: "Nessuna descrizione per i risultati di ricerca",
          about: "La pagina non ha una descrizione, quindi i motori di ricerca scelgono da soli il testo da mostrare sotto il suo link.",
          fix: "Scriva una descrizione della pagina di una o due frasi. Senza, i motori di ricerca prendono un testo dalla pagina, spesso non il migliore.",
        },
        meta_description_too_long: {
          label: "La descrizione è troppo lunga",
          about: "I risultati di ricerca tagliano le descrizioni più lunghe di circa 158 caratteri.",
          fix: "Accorci la descrizione e dica subito perché vale la pena cliccare.",
        },
        meta_description_too_short: {
          label: "La descrizione è molto breve",
          about: "Le descrizioni sotto i 70 caratteri lasciano spazio inutilizzato nei risultati di ricerca.",
          fix: "Ampli la descrizione con una o due frasi che diano un motivo per scegliere il suo risultato.",
        },
        missing_h1: {
          label: "Nessun titolo principale",
          about: "La pagina non ha un titolo principale (H1), quindi il suo argomento è meno chiaro per lettori e motori di ricerca.",
          fix: "Aggiunga in alto nella pagina un titolo principale che dica di che cosa parla.",
        },
        multiple_h1: {
          label: "Più di un titolo principale",
          about: "La pagina ha diversi titoli principali (H1), quindi non è chiaro quale la descriva.",
          fix: "Mantenga un solo titolo principale e trasformi gli altri in sottotitoli.",
        },
        thin_content: {
          label: "Poco testo",
          about: "La pagina ha meno di 300 parole, contando menu e piè di pagina. Pagine così brevi raramente si posizionano per ricerche competitive.",
          fix: "Ampli la pagina perché risponda pienamente a ciò che cercano i visitatori, oppure la unisca a una pagina più completa e reindirizzi questa.",
        },
        images_missing_alt: {
          label: "Immagini senza descrizione",
          about: "Alcune immagini non hanno un testo alternativo, che gli screen reader leggono e la ricerca per immagini utilizza.",
          fix: "Aggiunga a ogni immagine una breve descrizione di ciò che mostra. Le immagini puramente decorative possono avere una descrizione vuota.",
        },
        missing_canonical: {
          label: "Nessun indirizzo preferito",
          about: "La pagina non indica il suo indirizzo preferito (link canonico). Se è raggiungibile da più indirizzi, i motori di ricerca devono indovinare quale mostrare.",
          fix: "Aggiunga un link canonico alla pagina. La maggior parte dei plugin SEO lo aggiunge automaticamente una volta attivata; altrimenti si rivolga al suo sviluppatore web.",
        },
        missing_lang: {
          label: "Lingua della pagina non impostata",
          about: "La pagina non dichiara in quale lingua è scritta.",
          fix: "Imposti la lingua della pagina (l’attributo «lang» del tag html). Aiuta i motori di ricerca a mostrare le sue pagine alle persone giuste e gli screen reader a pronunciarle correttamente.",
        },
        large_page: {
          label: "Il codice della pagina è molto grande",
          about: "Il solo HTML della pagina supera 1,5 MB e rallenta il caricamento. Le immagini non sono incluse in questo calcolo.",
          fix: "Un HTML grande di solito dipende da codice, dati o immagini inseriti nella pagina stessa. Chieda al suo sviluppatore web di spostarli in file separati o di ridurli.",
        },
        duplicate_title: {
          label: "Pagine con lo stesso titolo",
          about: "Più pagine usano lo stesso titolo, quindi per i motori di ricerca è difficile distinguerle.",
          fix: "Dia a ogni pagina un titolo che descriva ciò di cui tratta solo quella pagina.",
        },
        duplicate_meta_description: {
          label: "Pagine con la stessa descrizione",
          about: "Più pagine usano la stessa descrizione nei risultati di ricerca.",
          fix: "Scriva per ogni pagina una descrizione diversa che dica che cosa offre quella pagina.",
        },
        no_internal_links: {
          label: "Pagine senza link al resto del sito",
          about: "Alcune pagine non hanno link ad altre pagine del suo sito, quindi visitatori e motori di ricerca non possono proseguire.",
          fix: "Aggiunga da queste pagine link a pagine correlate del suo sito, ad esempio un servizio, un articolo o la home page.",
        },
      },
      siteTitle: "Il suo sito come lo abbiamo letto",
      siteDescription: "Letto dalla sua home page durante questo controllo.",
      siteLegacy: "Questo controllo risale a prima che iniziassimo a raccogliere i dati del sito. Compariranno dopo il prossimo controllo.",
      siteUnavailable: "In questo controllo non è stato possibile leggere alcuna pagina, quindi questi dati non sono disponibili.",
      siteName: "Nome del sito",
      siteNameMissing: "Non trovato",
      language: "Lingua",
      languageMissing: "Non dichiarata",
      languageNote: "Come dichiarata dalla sua home page.",
      languageMissingNote: "La sua home page non indica in quale lingua è scritta, quindi i motori di ricerca devono indovinarla.",
      platform: "Piattaforma",
      platformUnknown: "Non riconosciuta",
      platformNote: "Rilevata dal codice della sua pagina.",
      platformUnknownNote: "Non abbiamo riconosciuto una piattaforma comune. Di per sé non è un problema.",
      previewImage: "Immagine di anteprima dei link",
      previewMissing: "Nessuna",
      previewNote: "Mostrata quando la sua home page viene condivisa.",
      previewMissingNote: "Non è stata trovata un’immagine di anteprima (og:image), quindi i link condivisi potrebbero apparire senza immagine.",
      previewBroken: "Non è stato possibile caricare l’immagine di anteprima.",
      linkedTitle: "Siti a cui rimanda di più",
      linkedHelp: "Fino a sei, contati sulle pagine lette. Utile per individuare link che non intendeva dare.",
      linkedEmpty: "Non abbiamo trovato link ad altri siti nelle pagine lette.",
      aiTitle: "Accesso degli assistenti IA",
      aiDescription: "Se il suo file robots.txt blocca i crawler che gli assistenti IA usano per leggere i siti web.",
      aiLegacy: "Questo controllo risale a prima che iniziassimo a leggere robots.txt. Questa informazione comparirà dopo il prossimo controllo.",
      aiUnreadable: "In questo controllo non è stato possibile leggere alcuna pagina, quindi molto probabilmente nemmeno robots.txt era leggibile. Qui «Non bloccato» può significare solo che non siamo riusciti a leggerlo.",
      aiNoneBlocked: "Nessuno di questi {total} crawler è bloccato sull’intero sito.",
      aiSomeBlocked: "1 crawler su {total} è bloccato sull’intero sito.|{count} crawler su {total} sono bloccati sull’intero sito.",
      aiAllowed: "Non bloccato",
      aiBlocked: "Bloccato",
      aiNamed: "Indicato in robots.txt",
      aiCaveat: "Controlliamo solo se robots.txt blocca l’intero sito. Se robots.txt non c’è, o non siamo riusciti a leggerlo, il crawler risulta non bloccato. Firewall e regole per singole pagine non vengono controllati.",
      aiNoGuarantee: "Essere leggibile non significa che un assistente IA menzionerà o citerà il suo sito.",
      aiBlockedHelp: "Per far entrare un crawler, rimuova da robots.txt la regola «Disallow: /» che lo riguarda, oppure chieda a chi gestisce il suo sito di farlo.",
      aiVisibilityLink: "Scopra se gli assistenti IA la menzionano",
      fixTitle: "Vuole che li sistemiamo noi?",
      fixSelf: "Quasi tutte sono modifiche al testo che può fare da sé seguendo le indicazioni qui sopra. Se preferisce, ci invii l’elenco e le faremo un preventivo.",
      fixDeveloper: "1 di queste segnalazioni di solito richiede chi ha realizzato il suo sito. Ci invii l’elenco: esamineremo tutto e le faremo un preventivo per la correzione.|{count} di queste segnalazioni di solito richiedono chi ha realizzato il suo sito. Ci invii l’elenco: esamineremo tutto e le faremo un preventivo per la correzione.",
      fixHow: "Apre la sua app di posta con l’elenco già compilato. Non viene inviato nulla finché non lo invia lei, e non viene addebitato nulla.",
      fixUnavailable: "Al momento non è possibile richiedere preventivi via email.",
      requestQuote: "Richiedi un preventivo",
      mailSubject: "Richiesta di correzione per {domain}",
      mailGreeting: "Buongiorno,",
      mailAsk: "vorrei un preventivo per correggere i problemi trovati su {domain}.",
      mailCheckedOn: "Controllo del {date}.",
      mailCounts: "1 problema trovato (critici: {critical}).|{count} problemi trovati (critici: {critical}).",
      mailListTitle: "Segnalazioni:",
      mailLine: "- {label}: {pages}",
      mailThanks: "Grazie.",
    },
    settings: {
      personalTitle: "Dati personali",
      personalSubtitle: "Il suo nome e l’indirizzo email con cui accede.",
      nameLabel: "Nome",
      namePlaceholder: "Il suo nome",
      save: "Salva",
      saving: "Salvataggio…",
      cancel: "Annulla",
      nameSaved: "Nome aggiornato",
      nameError: "Impossibile salvare il nome",
      emailLabel: "E-mail",
      changePassword: "Cambia password",
      setPassword: "Imposta una password",
      setPasswordIntro:
        "Lei accede con Google. Imposti una password per accedere anche con la sua email: Google continuerà a funzionare.",
      setPasswordHelp: "Almeno 8 caratteri.",
      settingPassword: "Impostazione…",
      passwordCreated:
        "Password impostata. Ora può accedere con la sua email e la sua password.",
      languageLabel: "Lingua del pannello",
      languageHelp: "Menu, pulsanti e messaggi di questo pannello. Modificarla non cambia i suoi articoli.",
      languageError: "Impossibile salvare la lingua",
      currentPassword: "Password attuale",
      newPassword: "Nuova password",
      updatePassword: "Aggiorna password",
      passwordSaved: "Password cambiata. Gli altri dispositivi sono stati disconnessi.",
      passwordTooShort: "Usi almeno 8 caratteri",
      passwordError: "Impossibile cambiare la password",
      passwordHelp: "Almeno 8 caratteri. Gli altri dispositivi verranno disconnessi.",
      changing: "Modifica in corso…",
      saveName: "Salva nome",
      membersTitle: "Membri e ruoli",
      membersSubtitle: "L\u2019accesso viene concesso un sito alla volta. Chi riceve un invito qui non vedrà gli altri suoi siti né la fatturazione.",
      addMember: "Aggiungi membro",
      addMemberHelp: "Inserisca la sua email. Se non ha ancora un account RepGet, gli invieremo un invito.",
      memberColumn: "Membro",
      roleColumn: "Ruolo",
      statusColumn: "Stato",
      statusPending: "Invitato",
      invitationExpiresOn: "scade il {date}",
      statusExpired: "Scaduto",
      resendInvite: "Invia di nuovo l’invito",
      cancelInvite: "Annulla invito",
      inviteSent: "Invito inviato",
      inviteResent: "Invito inviato di nuovo",
      inviteCancelled: "Invito annullato",
      actionsColumn: "Azioni",
      active: "Attivo",
      removeAccess: "Revoca accesso",
      websiteLabel: "Sito web",
      emailPlaceholder: "editor@example.com",
      roleHelp: "Un editor può scrivere, modificare e pubblicare articoli. Un lettore può solo consultare.",
      invite: "Invita",
      nobodyElse: "Non c\u2019è ancora nessun altro. Inviti un collega o un editor esterno a lavorare su questo sito.",
      loadingPeople: "Caricamento persone",
      roleEditor: "Editor",
      roleViewer: "Lettore",
      pageTitle: "Account",
      pageDescription: "I suoi dati personali, come accede, la sua lingua, chi lavora sui suoi siti web e il suo link di invito.",
      emailHelp: "Accede con questo indirizzo e le ricevute vengono inviate qui. Non può essere modificato da questa pagina.",
      nameRequired: "Inserisca il suo nome.",
      securityTitle: "Accesso e sicurezza",
      securitySubtitle: "I modi in cui può accedere al suo account.",
      methodPassword: "Email e password",
      methodGoogle: "Google",
      methodSet: "Impostata",
      methodNotSet: "Non impostata",
      methodLinked: "Collegato",
      passwordSetSummary: "Può accedere con il suo indirizzo email e la sua password.",
      passwordNotSetSummary: "Questo account non ha ancora una password.",
      googleLinkedSummary: "Può accedere con l’account Google di questo indirizzo.",
      setPasswordIntroGeneric: "Imposti una password per accedere con il suo indirizzo email e una password.",
      currentPasswordWrong: "La password attuale non è corretta.",
      passwordTooLong: "Usi al massimo 128 caratteri",
      tooManyAttempts: "Troppi tentativi. Attenda un minuto e riprovi.",
      passwordAlreadySet: "Questo account ha già una password. Inserisca la password attuale per modificarla.",
      languageTitle: "Lingua",
      languageSubtitle: "Il pannello e i suoi articoli hanno ciascuno la propria lingua.",
      languageSaved: "Lingua del pannello salvata.",
      articleLanguageLabel: "Lingua degli articoli",
      articleLanguageHelp: "Gli articoli di ogni sito web vengono scritti nella lingua impostata nella sua scheda Attività.",
      articleLanguageLink: "Apri la scheda Attività di {domain}",
      roleAdmin: "Amministratore",
      roleEditorHelp: "Scrive, modifica e pubblica articoli.",
      roleViewerHelp: "Può leggere tutto, ma non modificare nulla.",
      inviteTo: "Avrà accesso solo a {domain}.",
      reinviteHelp: "Invitare qualcuno che ha già accesso ne cambia il ruolo.",
      invalidEmail: "Inserisca un indirizzo email valido.",
      inviteSelf: "Ha già accesso a questo sito web.",
      inviteFailed: "Non è stato possibile inviare l’invito. Riprovi.",
      actionFailed: "L’operazione non è riuscita. Riprovi.",
      accessGranted: "{email} può ora lavorare su {domain}",
      accessGrantedNoEmail: "{email} può ora lavorare su {domain}, ma non siamo riusciti a inviargli un’email.",
      accessRemoved: "{email} non ha più accesso",
      loadPeopleFailed: "Impossibile caricare chi lavora su questo sito web.",
      retry: "Riprova",
      thisWebsite: "questo sito web",
      workspaceAccess: "{email} ha accesso tramite il suo spazio di lavoro",
      manageMember: "Gestisci {email}",
      manageInvitation: "Gestisci l’invito per {email}",
      membersCaption: "Persone che possono lavorare su {domain}",
      removeConfirmTitle: "Rimuovere l’accesso di {email}?",
      removeConfirmBody: "Non potrà più aprire {domain}. Potrà invitarlo di nuovo in seguito.",
      keepAccess: "Mantieni l’accesso",
      cancelInviteConfirmTitle: "Annullare l’invito per {email}?",
      cancelInviteConfirmBody: "Il link inviato via email smetterà di funzionare. Potrà invitarlo di nuovo in seguito.",
      keepInvitation: "Mantieni l’invito",
      removing: "Rimozione…",
      cancellingInvite: "Annullamento…",
      inviting: "Invio…",
      viewingSharedNote: "Sta visualizzando {domain}, condiviso con lei. Solo il proprietario può cambiare chi ci lavora. L’elenco qui sotto riguarda i suoi siti web.",
      guestTeamNote: "{domain} è condiviso con lei come {role}. Solo il proprietario può invitare o rimuovere persone.",
    },
    websites: {
      title: "Siti web",
      connected: "1 sito web. Ognuno viene fatturato con il proprio piano.|{count} siti web. Ognuno viene fatturato con il proprio piano.",
      addWebsite: "Aggiungi sito",
      emptyTitle: "Ancora nessun sito",
      emptyBody:
        "Aggiunga il suo sito: lo leggeremo, capiremo di cosa si occupa la sua attività e troveremo le ricerche che vale la pena presidiare.",
      addFirst: "Aggiunga il suo primo sito",
      tryAgain: "Riprova",
      removeLabel: "Rimuovi {domain}",
      removed: "{domain} rimosso",
      retrying: "Nuovo tentativo",
      dialogTitle: "Aggiungi un sito web",
      dialogBody:
        "Inserisca l\u2019indirizzo del sito che vuole far trovare su Google. Lo leggeremo e compileremo i dettagli per lei.",
      urlLabel: "Indirizzo del sito",
      urlPlaceholder: "esempio.com",
      cancel: "Annulla",
      adding: "Aggiunta…",
      sharedTitle: "Condivisi con lei",
      sharedHelp: "Siti web a cui altre persone le hanno dato accesso.",
    },
    billing: {
      title: "Fatturazione",
      subtitle: "Ogni sito ha il proprio piano. I crediti sono condivisi tra tutti.",
      yourWebsites: "I suoi siti web",
      yourWebsitesHelp: "Un sito senza piano non può generare né pubblicare articoli.",
      noPlanYet: "Ancora nessun piano",
      planRenews: "{plan} - si rinnova il {date}",
      planEnds: "{plan} - termina il {date}",
      currentPlan: "Piano attuale",
      accessEnds: "L\u2019accesso termina",
      nextInvoice: "Prossima fattura",
      onPlan: "Ha il piano {plan}.",
      noSubscription: "Nessun abbonamento attivo. Scelga un piano qui sotto per iniziare.",
      accessEndsOn: "L’accesso termina il {date}.",
      renewsOn: "Si rinnova il {date}.",
      monthly: "Mensile",
      annual: "Annuale",
      status: "Stato",
      tryItFirst: "Lo provi prima",
      paypalReceipts: "Le sue ricevute e la disdetta si trovano nel suo account PayPal.",
      promoCodes: "I codici promozionali si inseriscono al pagamento con carta. PayPal non li supporta.",
      unlimited: "Illimitati",
      articlesEachMonth: "{n} articolo scritto al mese|{n} articoli scritti al mese",
      searchTermsTracked: "{n} termine di ricerca monitorato|{n} termini di ricerca monitorati",
      oneWebsite: "Un sito web per abbonamento",
      creditsEachMonth: "{n} credito per link al mese|{n} crediti per link al mese",
      paymentReceived: "Pagamento ricevuto - stiamo confermando il suo abbonamento…",
      checkoutCancelled: "Pagamento annullato.",
      purchaseReceived: "Pagamento ricevuto - il suo acquisto comparirà a breve.",
      purchaseCancelled: "Acquisto annullato.",
      addWebsiteFirst: "Aggiunga prima un sito web - ogni piano paga un solo sito.",
      checkoutFailed: "Non è stato possibile avviare il pagamento. Riprovi.",
      planFor: "Piano di {domain}",
      choosePlan: "Scelga un piano",
      choosePlanFor: "Scelga un piano per {domain}",
      choosePlanHelp: "Un piano copre un solo sito web.",
      billingPeriod: "Periodo di fatturazione",
      perMonth: "/ mese",
      perYear: "/ anno",
      saveBadge: "Risparmi il {n}%",
      switchPlan: "Passa a questo piano",
      payByCard: "Paga con carta",
      redirecting: "Reindirizzamento…",
      opening: "Apertura…",
      cancelSubscription: "Disdici l’abbonamento",
      paypalCheckoutFailed: "Non è stato possibile avviare il pagamento con PayPal. Riprovi.",
      portalFailed: "Non è stato possibile aprire il portale di fatturazione.",
      managedForYou: "Gestiamo noi questo abbonamento. Scriva a {email} per le ricevute o per una modifica.",
      newTab: "(si apre in una nuova scheda)",
      upgradeLead: "Pronto a crescere?",
      upgradeBody: "Il piano {plan} include {articles}, {terms} e {credits}.",
      upgradeLink: "Scopra cosa offre {plan}",
      statusActive: "Attivo",
      statusTrialing: "Prova gratuita",
      statusPastDue: "Pagamento in ritardo",
      statusUnpaid: "Non pagato",
      statusIncomplete: "Pagamento incompleto",
      statusIncompleteExpired: "Pagamento non completato",
      statusCanceled: "Disdetto",
      statusPaused: "In pausa",
      statusInactive: "Inattivo",
      pastDueNotice: "L’ultimo pagamento per questo sito web non è andato a buon fine. Aggiorni il metodo di pagamento per mantenere l’accesso.",
      unsettledNotice: "L’abbonamento di questo sito web deve essere regolarizzato o disdetto prima di poter cambiare piano.",
      endedNotice: "Questo abbonamento è terminato. Scelga un piano qui sotto per ricominciare.",
      billedByPayPal: "Questo sito web viene fatturato tramite PayPal, quindi anche i cambi di piano passano da PayPal.",
      billedByCard: "Questo sito web viene fatturato con carta, quindi i cambi di piano passano dal pagamento con carta. Per pagare con PayPal, disdica prima l’abbonamento con carta.",
      billedByCardEnding: "L’abbonamento con carta di questo sito web termina il {date}. Potrà scegliere PayPal quando sarà terminato.",
      noPlanChange: "Al momento non è possibile cambiare il piano di questo sito web.",
      paypalApproved: "Approvazione PayPal ricevuta - stiamo confermando il suo abbonamento…",
      paypalCancelled: "Pagamento PayPal annullato.",
      viewingSharedNote: "{shared} è condiviso con lei e lo paga il proprietario. Questa pagina mostra la fatturazione dei suoi siti web.",
      guestTitle: "Qui non c’è nulla da pagare",
      guestBody: "I siti web condivisi con lei sono pagati dai rispettivi proprietari. Non le serve un piano per lavorarci.",
      addWebsite: "Aggiungi un sito web",
      viewPlan: "Vedi il piano",
      shownBelow: "Mostrato sotto",
      paidByCard: "Carta",
      invoiceInPortal: "Fattura in Gestisci fatturazione",
      dateColumn: "Data",
      descriptionColumn: "Descrizione",
      methodColumn: "Pagato con",
      amountColumn: "Importo",
      receiptColumn: "Ricevuta",
      historyCapped: "Sono mostrati i {count} pagamenti più recenti.",
    },
    article: {
      contentSeo: "Contenuti e SEO",
      contentSeoHelp: "Come viene scritto ogni articolo e che cosa ne succede dopo.",
      publishAs: "Pubblica come",
      publishLive: "Gli articoli vengono pubblicati sul suo sito all\u2019orario previsto.",
      publishDraft: "Gli articoli vengono inviati come bozze da rivedere prima.",
      live: "Pubblicato",
      draft: "Bozza",
      articleStyle: "Stile degli articoli",
      internalLinks: "Link interni",
      internalLinksHelp: "Link interni previsti per articolo.",
      targetWordCount: "Lunghezza prevista",
      adaptiveOn: "Scegliamo la lunghezza migliore per ogni tipo di articolo.",
      adaptiveOff: "Una lunghezza fissa per ogni formato.",
      wordsPerArticle: "Parole per articolo",
      contentDetails: "Dettagli del contenuto",
      sitemapUrl: "URL della sitemap",
      blogAddress: "Indirizzo principale del blog",
      bestArticle: "Il suo miglior articolo di esempio",
      engagement: "Coinvolgimento",
      brandColour: "Colore del marchio",
      optional: "Facoltativo",
      imageBrief: "Come deve apparire il suo marchio nelle immagini",
      imageBriefPlaceholder: "Cinematografico, minimale, grigi freddi con accenti di blu elettrico.",
      imageInstructions: "Istruzioni aggiuntive per le immagini",
      imageInstructionsPlaceholder: "es. Non mostrare mai volti.",
      tableOfContents: "Indice",
      comparisonTable: "Tabella di confronto",
      youtubeVideo: "Video YouTube",
      authorPerspective: "Punto di vista dell\u2019autore",
      mentionSimilar: "Citare prodotti e strumenti simili",
      poweredBy: "Link Powered by RepGet",
      howWeWrite: "Come scriviamo",
      toneLabel: "Che tono devono avere i suoi articoli?",
      tonePlaceholder: "Cordiale e rassicurante, non clinico",
      rulesLabel: "Regole per ogni articolo",
      rulesPlaceholder: "Mai mettere un anno nel titolo. Citare sempre la spedizione gratuita.",
      factsLabel: "Informazioni sulla sua attività",
      uspsLabel: "Che cosa la rende diversa?",
      onePerLine: "Uno per riga.",
      preferLabel: "Parole che preferisce",
      preferPlaceholder: "Dica trattamento, non procedura",
      avoidLabel: "Parole da evitare",
      avoidPlaceholder: "Mai dire economico",
      author: "Autore",
      authorName: "Nome dell\u2019autore",
      authorNamePlaceholder: "Il suo nome, o quello del marchio",
      shortBio: "Breve biografia",
      shortBioPlaceholder: "Una o due frasi su chi scrive e perché se ne intende.",
      closePreview: "Chiudi anteprima",
      unsavedChanges: "Modifiche non salvate",
      contentDetailsHelp: "Dove vivono i suoi contenuti, così possiamo collegarli e seguirne la forma.",
      engagementHelp: "Come appaiono gli articoli e che cosa viene aggiunto al testo.",
      howWeWriteHelp: "La voce dietro ogni articolo.",
      factsHelp: "Uno per riga. Sono gli unici dati precisi che affermeremo.",
      authorHelp: "La firma mostrata su ogni articolo, qui e sul suo sito.",
      noBylineHelp: "Se lo lascia vuoto, gli articoli escono senza firma.",
      pageTitle: "Impostazioni articoli",
      pageDescription: "Come vengono scritti, illustrati e pubblicati gli articoli di questo sito.",
      sectionWriting: "Scrittura e SEO",
      sectionWritingHelp: "Lo stile e la lunghezza di ogni articolo, e quanti link porta alle sue altre pagine.",
      sectionSources: "Fonti dei contenuti",
      sectionSourcesHelp: "Dove si trovano i suoi contenuti sul sito.",
      sectionImages: "Immagini e brand",
      sectionImagesHelp: "L’immagine creata per ogni articolo e l’aspetto del suo brand.",
      sectionEnhancements: "Elementi aggiuntivi",
      sectionEnhancementsHelp: "Extra aggiunti agli articoli oltre al testo.",
      sectionVoice: "Voce del brand",
      sectionVoiceHelp: "Come suonano i suoi articoli e che cosa possono dire della sua attività.",
      sectionAuthor: "Autore",
      sectionAuthorHelp: "La persona o il brand che firma i suoi articoli. Viene salvato con le impostazioni; per ora gli articoli non lo mostrano come firma.",
      unknownOption: "{value} (non più disponibile)",
      linksError: "Inserisca un numero intero da 0 a 20.",
      wordsError: "Inserisca un numero intero da 300 a 5.000.",
      sitemapHint: "Ci permette di trovare le pagine del sito da collegare nei nuovi articoli.",
      blogHint: "La pagina principale del suo blog.",
      exampleHint: "Un suo articolo di cui è soddisfatto.",
      urlError: "Inserisca un indirizzo completo che inizi con http:// o https://.",
      brandColourHint: "Il colore principale del suo brand in codice esadecimale. Viene salvato con le impostazioni; per ora le immagini generate non lo usano.",
      brandColourError: "Usi # seguito da sei cifre o lettere dalla a alla f, per esempio #003388.",
      noColour: "Nessun colore",
      invalidColour: "Colore non valido",
      pickColour: "Scegli un colore del brand",
      clearColour: "Rimuovi colore",
      imageStyleLabel: "Stile delle immagini",
      imageStyleHint: "Lo stile dell’immagine creata per ogni articolo.",
      coverStyleLabel: "Stile dell’immagine di copertina",
      coverStyleHint: "Il suo stile preferito per le copertine. Per ora ogni articolo riceve una sola immagine, nello stile indicato sopra, e quell’immagine è anche la copertina.",
      samplesNote: "Gli esempi illustrano ogni stile. Le immagini dei suoi articoli vengono create per ciascun articolo e saranno diverse.",
      matchFollows: "Ora segue: {style}",
      matchFollowsUnknown: "Segue lo stile delle immagini sopra",
      previewStyle: "Vedi l’esempio {style}",
      previewTitle: "Esempio: {style}",
      previewMatchTitle: "Come le immagini dell’articolo, ora {style}",
      previewHelp: "Un esempio di questo stile. L’anteprima non cambia la sua scelta.",
      sampleAlt: "Immagine di esempio in stile {style}",
      unknownImageStyle: "La scelta salvata ({value}) non è uno di questi stili. Resta così finché non ne sceglie uno.",
      imageBriefHint: "Incluso nelle istruzioni di ogni immagine degli articoli.",
      tocHint: "Aggiunge un indice costruito dai titoli dell’articolo.",
      youtubeHint: "La sua scelta viene salvata. Per ora non vengono aggiunti video agli articoli.",
      perspectiveHint: "Scrive con un punto di vista invece che in modo impersonale.",
      similarHint: "Cita e confronta alternative, per una trattazione più ricca.",
      comparisonHint: "Aggiunge una tabella che confronta fianco a fianco le opzioni di cui parla l’articolo, come «Videografia e cinematografia a confronto».",
      poweredByHint: "Una piccola menzione alla fine di ogni articolo. Disattivarla vale per gli articoli non ancora pubblicati.",
      factsPlaceholder: "Aperti dal 2004\nCinque dentisti nel team\nParcheggio gratuito",
      uspsPlaceholder: "Appuntamenti urgenti in giornata\nAccogliamo pazienti ansiosi",
      tooManyLines: "Fino a {max} righe. Tolga 1 riga.|Fino a {max} righe. Tolga {count} righe.",
      lineTooLong: "La riga {line} supera i {max} caratteri.",
      fixFields: "Alcuni campi vanno corretti. Sono segnalati nella pagina.",
      saveError: "Qualcosa è andato storto. Riprovi.",
      saveBarNote: "Vale per tutte le sezioni tranne Scrittura e pubblicazione, che si salva appena la modifica.",
      autoOnHelp: "Procediamo da soli con il suo piano dei contenuti. Può comunque scrivere qualsiasi articolo in qualsiasi momento.",
      autoOffHelp: "Non viene scritto nulla finché non lo chiede. Apra un articolo pianificato e prema Scrivi.",
      anyDay: "Qualsiasi giorno.",
      pickedDays: "Solo nei giorni scelti.",
      daysUtc: "I giorni seguono l’ora UTC (tempo coordinato universale).",
      firstArticleOnly: "Il suo primo articolo viene inviato appena è pronto, qualunque sia la scelta, così vede come appaiono gli articoli sul suo sito.",
      networkReview: "Finché il sito fa parte della Rete partner, il team RepGet controlla prima ogni articolo - anche il primo - e nessuno esce prima del giorno previsto.",
      openIntegrations: "Apri Integrazioni",
      weekdaysShort: { sun: "Dom", mon: "Lun", tue: "Mar", wed: "Mer", thu: "Gio", fri: "Ven", sat: "Sab" },
      weekdaysLong: { sun: "Domenica", mon: "Lunedì", tue: "Martedì", wed: "Mercoledì", thu: "Giovedì", fri: "Venerdì", sat: "Sabato" },
      bodyImageStyles: {
        sketch: { label: "Schizzo", hint: "Tratto a mano su colore tenue." },
        watercolour: { label: "Acquerello", hint: "Velature dipinte delicate." },
        realistic: { label: "Realistico", hint: "Fotografico." },
        illustration: { label: "Illustrazione", hint: "Forme vettoriali piatte." },
        "brand-text": { label: "Brand e testo", hint: "Una foto con una fascia di colore deciso lungo un bordo." },
      },
      coverImageStyles: {
        sketch: { label: "Schizzo", hint: "Tratto a mano su colore tenue." },
        watercolour: { label: "Acquerello", hint: "Velature dipinte delicate." },
        illustration: { label: "Illustrazione", hint: "Forme vettoriali piatte." },
        match: { label: "Come le immagini dell’articolo", hint: "Segue lo stile delle immagini sopra." },
      },
      styles: {
        expert: { label: "Esperto", hint: "Tono editoriale preciso, con sfumature e terminologia equilibrate." },
        conversational: { label: "Colloquiale", hint: "Frasi semplici e dirette. Spiega i termini alla prima comparsa." },
        friendly: { label: "Cordiale", hint: "Caloroso e incoraggiante, in seconda persona, poco gergo." },
        journalistic: { label: "Giornalistico", hint: "Parte dal risultato, attribuisce le affermazioni, senza linguaggio pubblicitario." },
      },
    },
    editor: {
      backToWebsite: "Torna al sito",
      headings: "Titoli",
      words: "Parole",
      keywordUses: "Usi della parola chiave",
      internalLinks: "Link interni",
      externalLinks: "Link esterni",
      socialMentions: "Menzioni social",
      starting: "Avvio",
      takesAMinute: "Di solito ci vuole circa un minuto. La pagina si aggiorna da sola.",
      couldNotWrite: "Non siamo riusciti a scrivere questo articolo",
      tryAgain: "Riprova",
      publishingHistory: "Cronologia di pubblicazione",
      historyHelp: "Ogni tentativo viene registrato, così un errore è visibile e non silenzioso.",
      failed: "Non riuscito",
      viewPost: "Vedi articolo",
      editArticle: "Modifica articolo",
      editHelp: "La versione precedente viene conservata a ogni salvataggio.",
      previewUnsaved: "Questa anteprima include modifiche non ancora salvate. Salvale nella scheda Modifica.",
      partnerLink: "Link partner",
      partnerLinksNote: "Le parole evidenziate sono link della rete di partner inseriti dal team RepGet.",
      title: "Titolo",
      metaDescription: "Meta descrizione",
      slugLabel: "Indirizzo sul suo sito",
      slugPlaceholder: "video-matrimonio-italia",
      slugHelp: "Spazi e punteggiatura diventano trattini. Lo lasci vuoto e il suo sito ne sceglierà uno dal titolo.",
      articleContent: "Contenuto dell\u2019articolo",
      saving: "Salvataggio…",
      saveChanges: "Salva modifiche",
      saved: "Salvato",
      rewriting: "Riscrittura dell\u2019articolo…",
      sendAsDraft: "Invia come bozza",
      publishedToSite: "Pubblicato: è online sul suo sito.",
      sentAsDraftToSite: "Inviato al suo sito come bozza.",
      viewOnSite: "Vedi sul suo sito",
      connectToPublish: "Colleghi il suo sito per pubblicare",
      publishViaPlugin: "Il suo sito non ha risposto, quindi l’articolo è in coda: il plugin WordPress lo invia al prossimo controllo, entro un’ora. Aggiorni il plugin alla versione 1.4 o successiva per pubblicare subito.",
      waitingForPlugin: "In attesa del plugin WordPress",
      updatePost: "Aggiorna articolo",
      publish: "Pubblica",
      sendingDraft: "Invio come bozza…",
      breadcrumbLabel: "Percorso di navigazione",
      targetKeywordLabel: "Parola chiave obiettivo",
      lastSaved: "Ultimo aggiornamento: {date}",
      viewModeLabel: "Anteprima o modifica",
      unsavedMark: "Modifiche non salvate",
      previewLabel: "Anteprima dell’articolo",
      previewUnsavedNow: "Sta visualizzando modifiche non ancora salvate. Il suo sito le riceve solo dopo il salvataggio e la pubblicazione.",
      notWrittenYet: "L’articolo comparirà qui non appena sarà scritto.",
      workingPaused: "Modifica e pubblicazione attendono la fine, perché la nuova versione sostituisce il testo.",
      conflictTitle: "Questo articolo è cambiato mentre lo modificava",
      conflictBody: "Nel frattempo è cambiata la versione salvata di: {fields}, per esempio perché è terminata una riscrittura o qualcun altro ha salvato. Salvando ora, la sua versione sostituisce quella.",
      conflictLoad: "Usa la versione salvata",
      conflictKeep: "Mantieni la mia versione",
      genUnavailable: "La scrittura non è disponibile al momento. Il problema è nostro e ce ne stiamo occupando.",
      genBusy: "Il servizio di scrittura era sovraccarico. Riprovi tra qualche minuto.",
      genTimeout: "La scrittura ha richiesto troppo tempo e si è interrotta. Riprovi: di solito è temporaneo.",
      genUnusable: "Non siamo riusciti a ricavare un articolo utilizzabile da questo argomento. Riprovi, oppure renda più specifici l’argomento e la parola chiave obiettivo.",
      genQuota: "Questo spazio di lavoro ha usato tutti gli articoli del mese. Passi a un piano superiore per scriverne altri.",
      genGeneric: "La scrittura di questo articolo non è terminata. Riprovi. Se continua a succedere, contatti l’assistenza.",
      pubErrAuth: "Il suo sito ha rifiutato l’accesso salvato. Lo ricolleghi nella pagina Integrazioni.",
      pubErrPermission: "L’account collegato non può pubblicare articoli. Colleghi un account con i permessi di pubblicazione.",
      pubErrNotFound: "Non è stato possibile trovare l’indirizzo del suo sito. Lo controlli nella pagina Integrazioni.",
      pubErrUnreachable: "Il suo sito non ha risposto. Di solito è temporaneo: riprovi o verifichi che il sito sia online.",
      pubErrApiDisabled: "Il suo sito è online, ma la sua interfaccia di pubblicazione è disattivata, spesso da un plugin di sicurezza. La riattivi, poi verifichi la connessione.",
      pubErrUnsupported: "Il suo sito funziona in un modo su cui non possiamo ancora pubblicare.",
      pubErrUnknown: "La pubblicazione non è terminata. Riprovi. Se continua a succedere, contatti l’assistenza.",
      editSaveNote: "Titolo, meta descrizione, indirizzo e testo si salvano insieme con il pulsante Salva. L’immagine in evidenza si salva non appena la modifica.",
      titleRequired: "Inserisca un titolo.",
      metaHint: "Compare sotto il titolo nei risultati di ricerca, che di solito ne mostrano i primi {count} caratteri circa.",
      slugSavedAs: "Verrà salvato come: {slug}",
      slugEmptyNote: "Se lo lascia vuoto, il suo sito sceglie l’indirizzo a partire dal titolo.",
      slugDropped: "Le lettere accentate e gli altri caratteri speciali vengono omessi dall’indirizzo.",
      slugWordPressNote: "WordPress mantiene l’indirizzo con cui l’articolo è stato pubblicato la prima volta. Cambiarlo qui non sposta l’articolo online.",
      searchPreviewTitle: "Anteprima nei risultati di ricerca",
      searchPreviewHelp: "È un’approssimazione. Sono i motori di ricerca a decidere cosa mostrare.",
      saveArticle: "Salva articolo",
      saveNoteWorking: "Il salvataggio attende mentre l’articolo viene scritto.",
      saveNoteDelivering: "Il salvataggio attende mentre l’articolo viene consegnato al suo sito.",
      saveNoteReview: "Salvando le modifiche, questo articolo torna in revisione presso il team RepGet.",
      saveNoteTitle: "Inserisca un titolo per salvare.",
      statsTitle: "Statistiche dell’articolo",
      statsHelp: "Calcolate dal testo dell’articolo.",
      statsUnsaved: "Calcolate dal testo sullo schermo, comprese le modifiche non salvate.",
      publishingTitle: "Pubblicazione",
      publishingHelp: "Pubblicando si invia al suo sito l’ultima versione salvata.",
      destinationLabel: "Destinazione",
      destinationNone: "Non collegato",
      destinationPlugin: "Plugin WordPress",
      manageConnection: "Gestisci il collegamento",
      plannedLabel: "Data prevista",
      plannedNone: "Nessuna data prevista",
      autoLabel: "Pubblicazione automatica",
      autoOnLive: "Attiva, come articoli pubblicati",
      autoOnDraft: "Attiva, come bozze",
      autoOff: "Disattivata",
      beforePlanned: "Pubblicando ora, l’articolo viene inviato subito, prima della data prevista.",
      stateNotSent: "Non ancora inviato al suo sito.",
      stateLive: "Online sul suo sito. Ultimo invio: {date}.",
      stateDraft: "Sul suo sito come bozza. Ultimo invio: {date}.",
      stateScheduled: "Programmato sul suo sito. Ultimo invio: {date}.",
      stateDelivered: "Consegnato al suo sito il {date}.",
      stateFailed: "L’ultimo tentativo ({date}) non è andato a buon fine.",
      statePluginUnconfirmed: "Il plugin WordPress non ha confermato l’ultima consegna ({date}).",
      stateWriting: "La pubblicazione sarà disponibile quando l’articolo sarà scritto.",
      stateFrozen: "La pubblicazione è sospesa dal team RepGet. Non viene inviato nulla ai siti finché non riprende.",
      stateReviewPending: "Il team RepGet sta preparando questo articolo per la rete di partner. Verrà pubblicato non appena lo approverà.",
      stateReviewChanged: "Questo articolo è cambiato dopo l’approvazione del team RepGet, quindi è tornato in revisione.",
      stateDelivering: "Consegna al suo sito in corso…",
      stateQueued: "In coda dalle {time}. Il risultato comparirà qui quando il suo sito risponderà.",
      stateQueuedLong: "Ancora nessun risultato. La consegna può essere trattenuta, per esempio finché un tentativo precedente non è risolto. Ricontrolli tra qualche minuto.",
      checkAgain: "Controlla di nuovo",
      statePluginWaiting: "In attesa che il plugin WordPress lo prelevi come {mode}. Il plugin si collega almeno una volta all’ora.",
      modeLive: "articolo pubblicato",
      modeDraft: "bozza",
      statePluginPublished: "Il plugin WordPress ha creato questo articolo e non può modificarlo in seguito, quindi le modifiche salvate qui non arrivano al suo sito. Apporti le altre modifiche in WordPress.",
      stateUncertain: "L’ultimo tentativo non ha ricevuto risposta dal suo sito. Veda l’avviso in cima alla pagina.",
      uncertainPublishNote: "Finché la questione non è risolta, pubblicare di nuovo non crea un secondo articolo: prima cerchiamo quello precedente.",
      connectHelp: "Colleghi il suo sito per pubblicarvi questo articolo.",
      blockedUnsaved: "Salvi prima le modifiche. La pubblicazione invia la versione salvata, non ciò che vede sullo schermo.",
      alreadySentLive: "Questa stessa versione è già online sul suo sito.",
      alreadySentDraft: "Questa stessa versione è già sul suo sito come bozza.",
      confirmDraftTitle: "Riportare l’articolo pubblicato a bozza?",
      confirmDraftBody: "Questo articolo è online sul suo sito. Inviarlo come bozza può togliere l’articolo dal sito (WordPress lo fa). Per modificare l’articolo online, usi invece Aggiorna articolo.",
      historyLatest: "Gli ultimi {count} tentativi, dal più recente.",
      historyEmpty: "Non è ancora stato inviato nulla al suo sito.",
      logLive: "Online",
      logDraft: "Inviato come bozza",
      logScheduled: "Programmato",
      logDelivered: "Consegnato",
      rewriteTitle: "Riscrivi l’articolo",
      rewriteHelp: "Riscrive l’intero articolo a partire dal suo piano. Ogni sito può riscrivere {count} articoli al giorno.",
      rewriteConfirmTitle: "Riscrivere questo articolo?",
      rewriteConfirmBody: "Testo, meta descrizione, indirizzo e immagine in evidenza vengono sostituiti da una nuova versione. La versione attuale non viene conservata.",
      rewriteConfirmPublished: "L’articolo sul suo sito resta com’è finché non pubblica la nuova versione.",
      rewriteConfirmReview: "La nuova versione passa in revisione presso il team RepGet prima di poter essere pubblicata.",
      rewriteConfirmUnsaved: "Le modifiche non salvate vengono scartate.",
      rewriteConfirmAction: "Riscrivi",
      rewriteNoPlan: "Questo articolo non ha una voce nel piano, quindi non può essere riscritto.",
      rewriteBlocked: "Di nuovo disponibile al termine della scrittura o della consegna in corso.",
      imagePromptHint: "Lo lasci vuoto e scegliamo noi. Restano {remaining} nuove immagini su {max} per questo articolo.",
      imageGenerate: "Genera",
      imageReplace: "Sostituisci",
      imageAltHint: "Si salva quando esce dal campo.",
      imageCheckAlt: "Verifichi che la descrizione corrisponda ancora alla nuova immagine.",
      imageLockedWorking: "Attenda che l’articolo sia scritto: una riscrittura sostituisce l’immagine.",
      imageLockedDelivering: "Attenda la fine della consegna al suo sito.",
      imageTypeError: "Usi un’immagine PNG, JPEG o WebP.",
      imageSizeError: "L’immagine pesa {size} MB. Il limite è {max} MB.",
      imageNoAlt: "Ancora nessuna descrizione.",
      imageAltSaved: "Descrizione salvata.",
      errInFlight: "Questo articolo è in consegna al suo sito proprio ora. Riprovi tra un minuto.",
      errNotWritten: "Questo articolo non è ancora stato scritto.",
      errConnectFirst: "Colleghi il suo sito prima di pubblicare.",
      errNotFound: "Questo articolo non esiste più.",
      errRewriteCap: "Questo sito ha usato tutte le riscritture delle ultime 24 ore. Riprovi più tardi.",
      errAlreadyWriting: "Questo articolo è già in fase di scrittura.",
      errNoActivePlan: "Questo spazio di lavoro non ha un piano attivo. Ne scelga uno per continuare a scrivere.",
      errImageStorage: "L’archiviazione delle immagini non è disponibile al momento. Riprovi più tardi.",
      errImageGeneration: "La generazione di immagini non è disponibile al momento. Riprovi più tardi.",
      metaNone: "Ancora nessuna meta descrizione. I motori di ricerca mostrano allora un estratto dell’articolo.",
      searchPreviewUnsaved: "L’anteprima include modifiche non ancora salvate.",
      imageReviewNote: "Se cambia l’immagine o la sua descrizione, questo articolo torna in revisione presso il team RepGet.",
      planningOutline: "Pianificazione degli argomenti",
      writingBody: "Scrittura dell\u2019articolo",
    },
    analytics: {
      googleResults: "Risultati Google",
      connectHelp: "Colleghi Google per vedere quali ricerche portano persone sul suo sito e come cambiano man mano che pubblichiamo.",
      connectGoogle: "Collega Google",
      redirecting: "Reindirizzamento…",
      expired: "La connessione precedente è scaduta. La ricolleghi per riprendere l\u2019importazione.",
      connected: "Collegato",
      last28: "Ultimi 28 giorni.",
      chooseThenImport: "Scelga le sue proprietà qui sotto, poi salvi per importare i dati.",
      visitorsFromGoogle: "Visitatori da Google",
      timesAppeared: "Volte in cui è apparso",
      averageRanking: "Posizione media",
      websiteVisits: "Visite al sito",
      whatPeopleSearched: "Che cosa hanno cercato per trovarla",
      query: "Query",
      visitors: "Visitatori",
      searchConsoleProperty: "Proprietà Search Console",
      analyticsProperty: "Proprietà Analytics",
      chooseProperty: "Scelga una proprietà",
      importing: "Importazione dei dati - ci vuole un momento",
      disconnected: "Google scollegato",
      statusConnected: "Google collegato",
      statusCancelled: "Connessione annullata",
      statusForbidden: "Non può collegare quel sito web",
      statusInvalid: "Quel link non era valido - riprovi",
      statusError: "Non è stato possibile collegare Google",
      pageTitle: "Google Search e Analytics",
      pageDescription: "Come le persone trovano il suo sito nella Ricerca Google e quante visite riceve. I dati provengono dai suoi account Search Console e Google Analytics.",
      rangeLabel: "Periodo",
      rangeDays: "{days} giorni",
      periodDates: "{start} – {end}",
      connectTitle: "Colleghi i suoi account Google",
      searchConsoleName: "Google Search Console",
      analyticsName: "Google Analytics",
      searchConsolePurpose: "Mostra come va il suo sito nella Ricerca Google: quante volte viene mostrato (impressioni), quante volte le persone fanno clic (clic), la posizione media e quali ricerche e pagine portano visitatori.",
      analyticsPurpose: "Mostra quante visite (sessioni) riceve l’intero sito da qualsiasi fonte: Google, altri motori di ricerca, social media, link e persone che digitano il suo indirizzo.",
      setupTitle: "Come funziona il collegamento",
      setupStep1: "Acceda con l’account Google che vede questo sito in Search Console e, se lo usa, in Google Analytics. Un solo accesso vale per entrambi.",
      setupStep2: "Google le chiede di consentire l’accesso in sola lettura. RepGet può leggere i suoi dati ma non può modificare nulla nei suoi account Google.",
      setupStep3: "Di ritorno qui, scelga la proprietà Search Console e la proprietà Analytics di questo sito. RepGet importa circa gli ultimi due mesi, poi i nuovi dati ogni giorno.",
      readOnlyAccess: "Accesso in sola lettura. Può scollegarlo in qualsiasi momento.",
      expiredTitle: "Google deve essere ricollegato",
      reconnectGoogle: "Ricollega Google",
      viewerCannotConnect: "Solo un proprietario o un editor di questo sito può collegare Google.",
      connectionTitle: "Collegamento Google",
      connectionHelp: "RepGet importa nuovi dati ogni giorno. Google li fornisce con circa tre giorni di ritardo.",
      notChosen: "Non scelta",
      dataThrough: "Dati fino al {date}",
      noFiguresYet: "Ancora nessun dato da Google",
      analyticsPropertyId: "Proprietà {id}",
      importNow: "Importa ora",
      manageConnection: "Gestisci collegamento",
      viewerSetupPending: "Google è collegato, ma non è ancora stata scelta alcuna proprietà. Un proprietario o un editor può sceglierne una.",
      importRequestedTitle: "Importazione richiesta",
      importRequestedBody: "RepGet sta importando i suoi dati da Google. Questa pagina li cerca per circa un minuto.",
      importStillRunning: "L’importazione può richiedere qualche minuto. I nuovi dati compariranno qui al termine: ricarichi la pagina più tardi per vederli.",
      setupNeededTitle: "Scelga cosa importare",
      setupNeededBody: "Scelga la proprietà Search Console e la proprietà Analytics di questo sito, poi salvi. Ne basta una delle due.",
      propertiesTitle: "Proprietà",
      propertiesHelp: "Quali proprietà Google appartengono a questo sito.",
      loadingProperties: "Caricamento delle proprietà visibili al suo account Google…",
      propertiesFailed: "Non è stato possibile caricare le sue proprietà da Google. Riprovi, oppure ricolleghi Google se il problema persiste.",
      tryAgain: "Riprova",
      searchConsoleHint: "La proprietà Search Console di questo sito, ad esempio una proprietà di dominio.",
      analyticsHint: "La proprietà Google Analytics 4 di questo sito.",
      noSearchConsoleFound: "Nessuna proprietà Search Console trovata per questo account Google. Verifichi che abbia accesso, oppure ricolleghi un altro account.",
      noAnalyticsFound: "Nessuna proprietà Google Analytics 4 trovata per questo account Google. Verifichi che abbia accesso, oppure ricolleghi un altro account.",
      noSearchConsoleProperty: "Nessuna (non importare da Search Console)",
      noAnalyticsProperty: "Nessuna (non importare da Analytics)",
      propertyUnavailable: "{name} (non disponibile per questo account Google)",
      saveAndImport: "Salva e importa",
      saveSelection: "Salva",
      selectionUnsaved: "La nuova scelta non è ancora salvata.",
      noSelectionChange: "Nessuna modifica da salvare.",
      propertiesSaved: "Proprietà salvate",
      accountTitle: "Account Google",
      accountHelp: "Ricolleghi per rinnovare l’accesso o passare a un altro account Google. Le proprietà scelte vengono mantenute.",
      disconnect: "Scollega",
      disconnecting: "Scollegamento…",
      disconnectTitle: "Scollegare Google?",
      disconnectBody: "RepGet smette di importare da Search Console e Analytics per questo sito e dimentica le proprietà scelte.",
      disconnectKeeps: "I dati già importati vengono mantenuti.",
      disconnectAccess: "Per revocare anche l’accesso di RepGet al suo account Google, usi le impostazioni di sicurezza del suo account Google.",
      cancel: "Annulla",
      disconnectFailed: "Non è stato possibile scollegare Google. Riprovi.",
      importFailed: "Non è stato possibile richiedere l’importazione. Riprovi.",
      googleUnreachable: "Non è stato possibile raggiungere Google con il collegamento salvato. Ricolleghi Google e riprovi.",
      errorNotConfigured: "Il collegamento a Google non è ancora disponibile. Contatti l’assistenza.",
      errorSignIn: "Acceda di nuovo per collegare Google.",
      errorReconnect: "Ricolleghi il suo account Google per continuare.",
      errorConnectFirst: "Colleghi prima Google.",
      errorChooseFirst: "Scelga prima una proprietà da cui importare.",
      searchTitle: "Ricerca Google",
      searchDescription: "Dati dell’intero sito da Search Console: tutte le pagine del suo sito nella Ricerca Google, non solo gli articoli scritti da RepGet.",
      analyticsTitle: "Visite al sito",
      analyticsDescription: "Sessioni sull’intero sito da qualsiasi fonte, secondo Google Analytics. Non solo le visite arrivate dalla Ricerca Google.",
      clicks: "Clic",
      clicksHint: "Volte in cui qualcuno ha fatto clic per arrivare al suo sito dalla Ricerca Google.",
      impressions: "Impressioni",
      impressionsHint: "Volte in cui il suo sito è comparso nei risultati della Ricerca Google.",
      ctr: "Percentuale di clic (CTR)",
      ctrShort: "CTR",
      ctrHint: "Clic divisi per impressioni.",
      averagePosition: "Posizione media",
      positionShort: "Posizione media",
      positionHint: "La sua posizione media nei risultati di Google, ponderata per impressioni. Più è bassa, meglio è.",
      sessions: "Sessioni",
      sessionsHint: "Visite al suo sito da qualsiasi fonte. Una persona può fare più sessioni.",
      comparedWith: "Le variazioni sono confrontate con i {days} giorni precedenti.",
      noComparison: "Nessun confronto: non tutti i {days} giorni precedenti hanno dati di Google.",
      noChange: "Nessuna variazione",
      better: "meglio",
      worse: "peggio",
      pointsChange: "{value} p.p.",
      notAvailable: "Non disponibile",
      daysReported: "Dati per {reported} giorni su {days}",
      zeroSearch: "Search Console non ha registrato impressioni in questo periodo.",
      zeroSessions: "Google Analytics non ha registrato sessioni in questo periodo.",
      staleSource: "Non è scelta alcuna proprietà {source}, quindi questi dati non vengono più aggiornati.",
      notSelectedTitle: "Nessuna proprietà {source} scelta",
      notSelectedEditor: "Ne scelga una in Collegamento Google per vedere qui questi dati.",
      notSelectedViewer: "Un proprietario o un editor può sceglierne una in Collegamento Google.",
      awaitingTitle: "Ancora nessun dato da {source}",
      awaitingBody: "Google non ha ancora comunicato alcun dato per questa proprietà. I siti nuovi o con poco traffico possono non averne per un po’ di tempo. RepGet controlla ogni giorno se ci sono nuovi dati.",
      noneInPeriodTitle: "Nessun dato da {source} in questo periodo",
      latestFrom: "I dati più recenti sono del {date}. Scelga un periodo più lungo per includerli.",
      latestOnly: "I dati più recenti sono del {date}.",
      dailyTitle: "Giorno per giorno",
      dailyDescription: "I giorni non comunicati da Google restano vuoti, non vengono disegnati come zero.",
      chartMetric: "Dato mostrato nel grafico",
      chartClicks: "Clic dalla Ricerca Google al giorno",
      chartImpressions: "Impressioni nella Ricerca Google al giorno",
      chartSessions: "Sessioni al giorno",
      unitClicks: "clic",
      unitImpressions: "impressioni",
      unitSessions: "sessioni",
      notReported: "non comunicato",
      day: "Giorno",
      chartInstructions: "Usi le frecce sinistra e destra per spostarsi tra i giorni.",
      chartEmpty: "Nessun dato giornaliero in questo periodo.",
      topTitle: "Ricerche e pagine principali",
      topSearches: "Ricerche",
      topPages: "Pagine",
      searchTerm: "Ricerca",
      page: "Pagina",
      topSearchesNote: "Le 10 ricerche con più clic. Google omette le ricerche rare per proteggere la privacy, quindi la loro somma è inferiore ai totali qui sopra.",
      topPagesNote: "Le 10 pagine con più clic dalla Ricerca Google.",
      topSearchesCaption: "Ricerche principali in questo periodo",
      topPagesCaption: "Pagine principali in questo periodo",
      noSearches: "Nessuna ricerca registrata in questo periodo.",
      noPages: "Nessuna pagina registrata in questo periodo.",
      opensInNewTab: "(si apre in una nuova scheda)",
    },
    research: {
      contentPlan: "Piano dei contenuti",
      articlesTab: "Articoli",
      opportunities: "Opportunità",
      refresh: "Aggiorna",
      looking: "Ricerca…",
      researchFailed: "La ricerca non è riuscita a terminare, quindi non è stato creato alcun piano dei contenuti. Prema il pulsante per riprovare; se non riesce di nuovo, contatti l’assistenza.",
      planReady: "Il suo piano dei contenuti è pronto.",
      planNotRebuilt: "Non è stato possibile ricostruire il suo piano dei contenuti, quindi il piano precedente non è cambiato. Prema il pulsante per riprovare; se non riesce di nuovo, contatti l’assistenza.",
      keywordsAdded: "Aggiunte: {added}.",
      keywordsAddedSkipped: "Aggiunte: {added}. Saltate: {skipped}, già monitorate o oltre il suo piano.",
      replanning: "Ricostruzione del suo piano dei contenuti…",
      planBusy: "Il suo piano è in costruzione proprio ora: prema {button} quando è pronto per includerle.",
      plannedArticles: "Articoli pianificati",
      plannedHelp: "Il suo piano dei contenuti, per giorno di pubblicazione previsto. Passi il cursore su un argomento pianificato per scriverlo subito, modificarlo o toglierlo dal piano.",
      articles: "Articoli",
      articlesHelp: "Scritti a partire dal suo piano dei contenuti. Ne apra uno per leggerlo, modificarlo o riscriverlo.",
      nothingWritten: "Ancora nulla di scritto. Usi",
      write: "Scrivi",
      title: "Titolo",
      status: "Stato",
      words: "Parole",
      keywords: "Parole chiave",
      keywordsHelp: "Ordinate per ciò che può realisticamente ottenere. Un termine con meno ricerche su cui può posizionarsi vale più di uno popolare fuori portata.",
      addKeywordsLabel: "Aggiunga le sue parole chiave",
      addKeywordsButton: "Aggiungi",
      addKeywordsPlaceholder: "videografo matrimoni toscana, film di fuga italia",
      addKeywordsHelp: "Le separi con virgole o a capo. I termini che aggiunge non hanno dati di ricerca propri, ma orientano comunque i suoi temi e il suo piano editoriale.",
      keyword: "Parola chiave",
      opportunity: "Opportunità",
      searchesPerMonth: "Ricerche / mese",
      competition: "Concorrenza",
      topic: "Argomento",
      difficultyLow: "Bassa",
      difficultyMedium: "Media",
      difficultyHigh: "Alta",
      difficultyVeryHigh: "Molto alta",
      researching: "Ricerca delle parole chiave - ci vuole un minuto",
      articleDeleted: "Articolo eliminato",
      statusQueued: "In coda",
      statusGenerating: "Scrittura…",
      statusDraft: "Bozza",
      statusPublished: "Pubblicato",
      statusFailed: "Non riuscito",
    },
    publishing: {
      connectTitle: "Colleghi il suo sito web",
      connectHelp: "Colleghi il suo sito una volta e i nuovi articoli verranno pubblicati automaticamente sul suo blog.",
      nothingConnected: "Ancora nulla di collegato",
      nothingConnectedHelp: "Colleghi il suo sito e potremo pubblicarvi direttamente gli articoli finiti. Nel frattempo può copiarli a mano.",
      publishTest: "Pubblica articolo di prova",
      publishing: "Pubblicazione…",
      disconnect: "Scollega",
      connected: "Collegato",
      cantFind: "Non trova la sua integrazione?",
      cantFindHelp: "Ci dica quale piattaforma usa e valuteremo di aggiungerla.",
      contactUs: "Ci contatti",
      whereDoIFind: "Dove li trovo?",
      checkBeforeSaving: "Controlliamo la connessione prima di salvare qualsiasi cosa, così lo scopre ora e non quando un articolo non parte.",
      noPlatformMatch: "Nessuna piattaforma corrisponde? Pubblichi ovunque con un webhook.",
      forDevelopers: "Per sviluppatori",
      connectTo: "Collega {name}",
      connectedTo: "Collegato a {name}",
      disconnectedFrom: "Scollegato da {name}",
      draftPublished: "Bozza pubblicata. Controlli le bozze del suo sito.",
      draftPublishedAt: "Bozza pubblicata - la apra su {name}",
      pluginRowName: "Plugin WordPress",
      pluginAwaiting: "In attesa di WordPress",
      pluginAwaitingHelp: "Nella scheda di WordPress aperta da RepGet prema Finish connecting to RepGet (Save and connect sui plugin precedenti), oppure Collega WordPress qui sotto.",
      pluginRowFallback: "Collegato - in attesa del primo rapporto.",
    },
    geo: {
      aiVisibility: "Visibilità nell\u2019IA",
      aiVisibilityHelp: "Se un assistente IA cita la sua attività quando qualcuno cerca un\u2019attività come la sua.",
      checkNow: "Controlla ora",
      checking: "Controllo…",
      visibilityScore: "Punteggio di visibilità",
      weightedByPosition: "Ponderato per posizione",
      vsLastCheck: "rispetto all\u2019ultimo controllo",
      questionsNamingYou: "Domande che la citano",
      averagePosition: "Posizione media",
      notYetNamed: "Non ancora citata",
      whereYouAppear: "Dove compare nell\u2019elenco",
      lastChecked: "Ultimo controllo",
      questionPlaceholder: "es. Quale dentista a Utrecht è il migliore per pazienti ansiosi?",
      add: "Aggiungi",
      suggest: "Suggerisci",
      askHelp: "Chieda come farebbe un cliente e non nomini la sua attività - il punto è vedere se emerge da sola.",
      suggestedQuestions: "Domande suggerite - clicchi per seguirle",
      noQuestions: "Nessuna domanda monitorata",
      noQuestionsHelp: "Aggiunga le domande che i suoi clienti porrebbero a un assistente IA, poi controlli se la sua attività viene citata nella risposta.",
      notChecked: "Non controllata",
      notNamed: "Non citata",
      stopTracking: "Smetti di seguire questa domanda",
      questionAdded: "Domanda aggiunta",
      checkQueued: "Controllo in corso - i risultati compariranno qui tra pochi minuti",
      alreadyTracking: "Sta già seguendo le domande che suggeriremmo",
      checksUnavailableTitle: "Controlli e suggerimenti sono sospesi per questo sito",
      errAiUnavailable: "I controlli con l’IA non sono disponibili al momento. Riprovi più tardi.",
      errNoPlan: "Scelga un piano per questo sito per avviare controlli e ricevere suggerimenti.",
      errPlanInactive: "L’abbonamento di questo sito non è attivo. Aggiorni la fatturazione per avviare controlli e ricevere suggerimenti.",
      errCheckQuota: "La visibilità nell’IA è stata controllata più volte nell’ultima ora. Riprovi più tardi.",
      errSuggestQuota: "Sono stati chiesti suggerimenti molte volte in quest’ora. Riprovi più tardi.",
      errSuggestFailed: "Impossibile suggerire domande. Riprovi.",
      errTooShort: "Scriva una domanda di almeno qualche parola.",
      errAllowance: "Il suo piano segue fino a {count} domande. Ne rimuova una per aggiungerne un’altra.",
      errDuplicate: "Sta già seguendo questa domanda.",
      errAddFirst: "Aggiunga prima una domanda.",
      errUnexpected: "Qualcosa è andato storto. Riprovi.",
      statusQueuedTitle: "Controllo in coda",
      statusQueuedBody: "In attesa che il controllo inizi. Le risposte compaiono qui una domanda alla volta, e nel frattempo può lasciare questa pagina.",
      statusRunningTitle: "Controllo delle sue domande",
      statusRunningBody: "Le risposte compaiono qui una domanda alla volta. Nel frattempo può lasciare questa pagina.",
      statusProgress: "Risposte ricevute: {answered} su {total} domande",
      statusRequestedAt: "Richiesto il {date}",
      statusCompletedTitle: "Controllo completato",
      statusCompletedBody: "Ogni domanda di questo controllo ha una nuova risposta.",
      statusPartialTitle: "Controllo terminato con lacune",
      statusPartialBody: "Nuove risposte: {answered} su {total} domande. Le altre non l’hanno ricevuta entro 10 minuti; mantengono il risultato precedente e sono segnalate qui sotto.",
      statusTimedOutTitle: "Ancora nessuna risposta",
      statusTimedOutBody: "Nessuna risposta è arrivata entro 10 minuti. Il controllo potrebbe essere ancora in attesa di partire, oppure non è riuscito. Ricontrolli più tardi o avvii un altro controllo.",
      statusTimedOutBodyViewer: "Nessuna risposta è arrivata entro 10 minuti. Il controllo potrebbe essere ancora in attesa di partire, oppure non è riuscito. Ricontrolli più tardi.",
      statusFailedTitle:"Il controllo non è stato eseguito",
      statusFailedBody: "Nessuna risposta è stata registrata per il controllo richiesto il {date}. Può avviare un altro controllo.",
      statusFailedBodyViewer: "Nessuna risposta è stata registrata per il controllo richiesto il {date}.",
      statusRefusedTitle: "Il controllo non è stato avviato",
      dismiss: "Chiudi",
      progressLabel: "Avanzamento del controllo",
      performanceTitle: "Come sta andando il suo sito",
      performanceHelp: "Misurato sull’ultima risposta a ogni domanda controllata.",
      howMeasured: "Come viene misurato",
      scoreOutOf: "su 100",
      scoreGood: "Buona",
      scoreFair: "Discreta",
      scoreLow: "Bassa",
      scoreUp: "{change} punti in più rispetto al controllo precedente",
      scoreDown: "{change} punti in meno rispetto al controllo precedente",
      scoreSame: "Nessuna variazione rispetto al controllo precedente",
      previousCheckOn: "Controllo precedente: {date}",
      firstCheck: "Primo controllo, ancora nulla con cui confrontarlo",
      namedOfChecked: "{mentions} su {total}",
      namedOfCheckedHelp: "Domande controllate in cui la sua attività è stata consigliata",
      positionValue: "n. {position}",
      answeredInLatestCheck: "Risposte in questo controllo: {count} su {total} domande",
      basisNote: "Basato sull’ultima risposta a {checked} delle {tracked} domande seguite.",
      earlierAnswersNote: "1 di queste risposte viene da un controllo precedente.|{count} di queste risposte vengono da controlli precedenti.",
      notCheckedYetTitle: "Non ancora controllato",
      notCheckedYetBody: "Nessuna domanda è stata controllata, quindi non c’è ancora un punteggio. Il punteggio compare solo dopo che un assistente è stato davvero interpellato.",
      competitorsHelp: "Altre attività consigliate nelle ultime risposte, in base a quante risposte le citano.",
      competitorCount: "Risposte che la citano: {count} su {total}",
      noCompetitors: "Nessun’altra attività è stata citata nelle ultime risposte.",
      nextStep: "Prossimo passo",
      nextAddQuestions: "Aggiunga le domande che farebbero i suoi clienti, oppure chieda dei suggerimenti.",
      nextAddQuestionsAction: "Aggiungi domande",
      nextFirstCheck: "Avvii il primo controllo per vedere se gli assistenti citano la sua attività.",
      nextUnchecked: "1 domanda non è ancora stata controllata. Avvii un controllo per includerla.|{count} domande non sono ancora state controllate. Avvii un controllo per includerle.",
      nextStale: "1 risposta viene da un controllo precedente. Avvii un controllo per aggiornarla.|{count} risposte vengono da controlli precedenti. Avvii un controllo per aggiornarle.",
      nextNotNamed: "Gli assistenti non l’hanno citata per 1 domanda. Veda chi hanno citato al suo posto.|Gli assistenti non l’hanno citata per {count} domande. Veda chi hanno citato al suo posto.",
      nextNotNamedAction: "Mostra queste domande",
      nextUpToDate: "I suoi risultati sono aggiornati. I controlli avvengono anche automaticamente una volta alla settimana.",
      nextWaiting: "È in corso un controllo. I risultati compaiono man mano che ogni domanda riceve risposta.",
      nextViewer: "Solo un proprietario o un editor può avviare controlli o modificare le domande.",
      questionsTitle: "Domande seguite",
      questionsHelp: "Le domande che segue, ciascuna con il suo ultimo risultato e le prove che lo sostengono.",
      allowanceCount: "{count} su {max} domande",
      addQuestionLabel: "Aggiungi una domanda",
      atAllowance: "Sta seguendo tutte le domande consentite dal suo piano ({max}). Ne rimuova una per aggiungerne un’altra.",
      suggestionsTitle: "Domande suggerite",
      suggestionsHelp: "Scelga quelle da seguire. Non viene aggiunto nulla finché non preme Aggiungi selezionate.",
      addSelected: "Aggiungi selezionate ({count})",
      suggestionsRoom: "Con il suo piano può aggiungere ancora 1 domanda.|Con il suo piano può aggiungere ancora {count} domande.",
      questionsAdded: "1 domanda aggiunta|{count} domande aggiunte",
      questionRemoved: "Domanda rimossa",
      filterLabel: "Mostra domande",
      filterAll: "Tutte",
      filterEmpty: "Nessuna domanda corrisponde a questo filtro.",
      showAll: "Mostra tutte le domande",
      noQuestionsViewer: "Non è ancora seguita nessuna domanda. Un proprietario o un editor può aggiungerle.",
      named: "Citata",
      namedAt: "Citata n. {position}",
      checkedOn: "Controllata il {date}",
      fromEarlierCheck: "Da un controllo precedente ({date})",
      checkingNow: "Controllo in corso…",
      noAnswerInCheck: "Nessuna risposta nell’ultimo controllo",
      answeredInCheck: "Risposta ricevuta in questo controllo",
      siteMentioned: "Il suo sito è stato menzionato",
      showEvidence: "Mostra prove",
      hideEvidence: "Nascondi prove",
      removeQuestionLabel: "Smetti di seguire: {question}",
      evidenceExcerpt: "Cosa diceva la risposta",
      evidenceExcerptNote: "Viene conservata solo la frase che cita la sua attività, non la risposta completa.",
      evidencePosition: "La sua posizione",
      evidencePositionValue: "N. {position} tra le attività consigliate dalla risposta",
      evidenceNotRecommended: "Non tra le attività consigliate dalla risposta",
      evidenceWebsite: "L’indirizzo del suo sito",
      evidenceWebsiteYes: "Menzionato nella risposta",
      evidenceWebsiteNo: "Non menzionato nella risposta",
      evidenceOthers: "Altre attività citate, in ordine",
      evidenceNoOthers: "Nessun’altra attività è stata citata.",
      evidenceAssistant: "Assistente interpellato",
      evidenceChecked: "Controllata",
      evidenceHistory: "Risultati precedenti",
      evidenceNoHistory: "È il primo risultato registrato per questa domanda.",
      evidenceStale: "Questa risposta viene da un controllo precedente. L’ultimo controllo, il {date}, non ha dato una nuova risposta per questa domanda.",
      evidenceMissed: "L’ultimo controllo non ha dato una nuova risposta per questa domanda, quindi questo è il suo risultato precedente.",
      removeTitle: "Smettere di seguire questa domanda?",
      removeBody: "Vengono eliminate anche le risposte registrate e la cronologia, e il punteggio viene ricalcolato senza di essa. L’operazione non si può annullare.",
      removeConfirm: "Smetti di seguire",
      removing: "Rimozione…",
      methodTitle: "Cosa viene misurato",
      methodHelp: "Come funziona un controllo e cosa significa ogni numero.",
      methodAskTitle: "Come funziona un controllo",
      methodAskBody: "Ogni domanda seguita viene posta a un assistente IA in una nuova conversazione, senza nominare la sua attività. La risposta viene poi letta per elencare, in ordine, le attività che consiglia.",
      methodRecordTitle: "Cosa viene registrato",
      methodRecordBody: "Se la sua attività è tra queste e in quale posizione, la frase che la cita, le altre attività citate e se compare l’indirizzo del suo sito. La risposta completa non viene conservata.",
      methodScoreTitle: "Come si calcola il punteggio",
      methodScoreBody: "Una domanda controllata vale 100 quando lei è citata per prima, meno più in basso nella lista (circa {second} in seconda, {third} in terza e {fourth} in quarta posizione) e 0 quando non è citata. Il punteggio di visibilità è la media dell’ultima risposta a ogni domanda controllata. Le domande mai controllate non vengono contate.",
      methodCompareTitle: "Confronti",
      methodCompareBody: "La variazione è misurata rispetto al controllo precedente, valutato sulle sue stesse risposte. Le risposte a più di un’ora di distanza appartengono a controlli diversi. Se i due controlli riguardavano domande diverse, parte della variazione dipende da questo.",
      methodScheduleTitle: "Quando avvengono i controlli",
      methodScheduleBody: "Quando un proprietario o un editor preme {action}, un numero limitato di volte all’ora, e automaticamente una volta alla settimana. Le risposte arrivano una domanda alla volta nel giro di pochi minuti.",
      methodAssistantsTitle: "Assistenti interpellati",
      methodAssistantsBody: "Le risposte registrate finora provengono da: {names}.",
    },
    backlinks: {
      title: "Link da altri siti web",
      joinHelp: "Google si fida di più di un sito quando altri siti lo collegano. Citi un\u2019altra attività nei suoi articoli per guadagnare un credito, poi lo spenda per ottenere una citazione sul sito di qualcun altro.",
      capLabel: "Citazioni che includerà ogni mese",
      capHelp: "Tenga questo numero basso. Una pagina piena di link ad altre attività risulta sospetta a Google.",
      join: "Partecipa",
      leave: "Esci",
      inTheNetwork: "Nella rete",
      creditsAvailable: "crediti disponibili",
      received: "Link ricevuti",
      receivedFlow: "Citato in altri articoli \u2192 Ottenga link \u2192 Spenda crediti",
      givenTitle: "Link concessi",
      givenFlow: "Pubblichi articoli \u2192 Conceda link \u2192 Guadagni crediti",
      whichPage: "Quale delle sue pagine deve ricevere il link?",
      suggestMyPages: "Suggerisci le mie pagine",
      readingSitemap: "Lettura della sitemap…",
      anchorLabel: "Testo preferito (facoltativo)",
      anchorPlaceholder: "sbiancamento dentale a Dublino",
      requesting: "Richiesta…",
      requestLink: "Richiedi link (1 credito)",
      noRequests: "Ancora nessun link ricevuto",
      noRequestsHelp: "Aggiunga qui sopra, in Rete partner, le pagine verso cui desidera ricevere link. Il team RepGet li inserisce in articoli pertinenti dei partner; un link costa i suoi crediti solo dopo essere stato verificato online.",
      noneGiven: "Ancora nessuno. Il team RepGet può inserire il link di un partner pertinente in uno dei suoi articoli prima della pubblicazione; lei guadagna i crediti quando il link è verificato online.",
      sourceArticle: "Articolo di origine",
      sourceArticleHint: "L\u2019articolo su un altro sito che la collega. Lo apra per vedere il link attivo.",
      customerWebsite: "Sito del cliente",
      customerWebsiteHint: "Il sito della rete che ha pubblicato il link.",
      creditsUsed: "Crediti usati",
      creditsUsedHint: "Crediti spesi per questo link. Restituiti per intero se il link viene rimosso.",
      yourArticleHint: "Il suo articolo che contiene il link.",
      destinationWebsite: "Sito di destinazione",
      destinationWebsiteHint: "Il sito verso cui punta il suo articolo.",
      creditsEarned: "Crediti guadagnati",
      creditsEarnedHint: "Crediti che questo link le ha fatto guadagnare, da spendere per link verso il suo sito.",
      onceLive: "+{n} quando online",
      held: "{n} riservati",
      cancelRequest: "Annulla richiesta",
      untitledArticle: "Articolo senza titolo",
      joined: "È nella rete",
      leftNetwork: "Ha lasciato la rete",
      requestSaved: "Richiesta salvata - in attesa di un sito adatto",
      requestCancelled: "Richiesta annullata, credito liberato",
      statusPending: "Ricerca di un sito",
      statusMatched: "In attesa del loro prossimo articolo",
      statusLive: "Attivo",
      statusCancelled: "Annullato",
      statusRemoved: "Rimosso - credito restituito",
      hosting: "Ospita fino a {cap} link al mese ({used} usati). {sites} sito disponibile per collegarla.|Ospita fino a {cap} link al mese ({used} usati). {sites} siti disponibili per collegarla.",
      reserved: " ({n} riservati)",
    },
    dashboard: {
      noWebsite: "Ancora nessun sito collegato",
      noWebsiteHelp: "Aggiunga il suo sito e inizieremo a trovare i termini di ricerca che i suoi clienti usano davvero.",
      addWebsite: "Aggiungi sito",
      couldNotLoad: "Non è stato possibile caricare questo sito",
      couldNotLoadHelp: "Riprovi o scelga un altro sito.",
      overview: "Panoramica SEO",
      openWebsite: "Apri sito",
      performing: "Come sta andando {domain} nella ricerca.",
      sharedBadge: "Condiviso con lei · {role}",
      ownerPlanInactive: "Questo sito è in pausa",
      ownerPlanInactiveHelp:
        "Il piano di {domain} non è attivo, quindi non è possibile creare nulla di nuovo. Chieda al proprietario del sito di rinnovarlo.",
      invitesTitle: "Inviti ricevuti",
      inviteBody: "{name} la invita a lavorare su {domain} come {role}.",
      inviteBodyNoName: "Ha ricevuto un invito a lavorare su {domain} come {role}.",
      roleAnEditor: "editor",
      roleAViewer: "lettore",
      acceptInvite: "Accetta invito",
      inviteAccepted: "Ora ha accesso a {domain}",
    },
    calendar: {
      changeTopic: "Cambia argomento",
      addInstructions: "Aggiungi istruzioni",
      removeFromPlan: "Togli dal piano",
      instructionsPlaceholder: "Qualsiasi cosa questo articolo debba trattare o evitare.",
      previousMonth: "Mese precedente",
      nextMonth: "Mese successivo",
      savedInstructions: "Salvato - lo useremo in fase di scrittura",
      removedFromPlan: "Tolto dal piano",
      writingStarted: "Scrittura avviata - ci vogliono alcuni minuti",
    },
    addons: {
      moreCredits: "Altri crediti per i link",
      moreCreditsHelp: "Il suo piano include crediti ogni mese. Ne acquisti altri se finiscono - questi non scadono.",
      termsPill: "Acquisto singolo · I crediti non scadono",
      oneTime: "Acquisto singolo",
      neverExpire: "I crediti non scadono",
      useAnytime: "Li usi quando vuole",
      buyThis: "Acquista",
      buyCredits: "Acquista {n} crediti",
      unavailable: "Non disponibile",
      checkoutFailed: "Non è stato possibile avviare il pagamento. Riprovi.",
      yourPurchases: "I suoi acquisti",
      added: "Aggiunto",
      delivered: "Consegnato",
      inProgress: "In corso",
      requestQuote: "Richiedi un preventivo",
      quoteHelp: "Le forniamo un preventivo dopo aver esaminato il suo audit.",
      title: "Componenti aggiuntivi",
      subtitle: "Acquisti singoli in aggiunta al suo piano.",
      perCredit: "{price} per credito",
      quoteFrom: "Da {price}. Le forniamo un preventivo dopo aver esaminato il suo audit.",
      servicesTitle: "Servizi",
      showingRecent: "Sono mostrati i suoi {count} acquisti più recenti.",
    },
    referral: {
      referSomeone: "Inviti qualcuno",
      linkLabel: "Il suo link di invito",
      copy: "Copia",
      copied: "Copiato",
      copyFailed: "Copia non riuscita. Selezioni il link e lo copi manualmente.",
      linkCopied: "Link copiato",
      creditsEarned: "Crediti guadagnati",
      waitingToConvert: "In attesa di conversione",
      signedUpNotPaying: "Registrati, non ancora paganti",
      peopleReferred: "Persone che ha invitato",
      someoneReferred: "Una persona che ha invitato",
      notEligible: "Non idoneo",
      waiting: "In attesa",
      cardDescription: "Condivida il suo link. Quando una persona che ha invitato paga il primo mese, riceve {credits} crediti per i link.",
      joinedWithName: "{name} · iscritto il {date}",
      joined: "Iscritto il {date}",
      noWebsiteJoined: "Nessun sito ancora · iscritto il {date}",
      creditsBadge: "+{count} crediti",
      linkHelp: "Le persone che si registrano tramite questo link contano come suoi inviti.",
      peopleReferredStat: "Persone invitate",
      noReferralsYet: "Nessuno si è ancora registrato con il suo link.",
      showingRecent: "Sono mostrati i suoi {count} inviti più recenti.",
      rewardedOn: "crediti aggiunti il {date}",
      unavailable: "Impossibile caricare i dati dei suoi inviti. Ricarichi la pagina per riprovare.",
    },
    keys: {
      updatePlugin: "WordPress ha il plugin {version}. La versione 1.7 si collega con un pulsante, mostra per quale account RepGet pubblica e si aggiorna da sola: la scarichi, poi in WordPress vada in Plugin → Aggiungi nuovo → Carica plugin e scelga “Sostituisci quello attuale con quello caricato”.",
      keyCopied: "Chiave copiata",
      keyCopyFailed: "Copia non riuscita. Selezioni la chiave e la copi manualmente.",
      keyRevoked: "Chiave revocata",
      newKeyLabel: "La sua nuova chiave di integrazione",
      openWordPress: "Apri il mio WordPress",
      neverUsed: "Mai usata",
      pluginTitle: "Plugin WordPress",
      pluginHelp: "Installi il nostro plugin, lo colleghi con un clic e gli articoli verranno pubblicati qui automaticamente.",
      copyNowHelp: "Ne conserviamo solo una versione cifrata, quindi non è più recuperabile. Se la perde, la revochi e ne crei una nuova.",
      newKey: "Nuova chiave",
      keyNotePlaceholder: "A che cosa serve questa chiave? (facoltativo)",
      nextSteps: "In WordPress apra RepGet nel menu, incolli questa chiave e prema Save and connect.",
      connectingIn: "Collegamento di {domain} nell’area di lavoro “{workspace}”.",
      stepInstall: "1. Installi il plugin",
      stepInstallHelp: "Lo scarichi, poi lo carichi e lo attivi in WordPress (Plugin → Aggiungi nuovo → Carica plugin). Salti questo passo se è già installato.",
      stepConnect: "2. Colleghi",
      stepConnectHelp: "Apre il Suo WordPress pronto per il collegamento. Prema Finish connecting to RepGet (Save and connect prima del plugin 1.7): niente da copiare.",
      connectButton: "Collega WordPress",
      reconnectButton: "Collega di nuovo",
      waitingTitle: "In attesa di WordPress…",
      waitingHelp: "Nella scheda di WordPress che abbiamo aperto, prema Finish connecting to RepGet (o Save and connect). Se WordPress chiede di accedere, acceda e poi prema Riapri WordPress.",
      stalledHelp: "Ancora in attesa? Se il Suo WordPress dice già Connected, usa un’altra chiave, per esempio di un altro account RepGet o di una prova. Completando nella scheda che abbiamo aperto, passa a questo account.",
      openAgain: "Riapri WordPress",
      copyInstead: "Copia la chiave",
      popupBlocked: "Il browser ha bloccato la nuova scheda. Usi Riapri WordPress, oppure copi la chiave e la incolli in WordPress.",
      connectedTitle: "Collegato",
      lastCheckIn: "Ultimo contatto: {date}",
      connectedToast: "WordPress è collegato",
      alsoIn: "Ha anche {domain} in {workspaces}. Un sito WordPress può pubblicare solo per uno di essi: lo decide la chiave salvata in WordPress.",
      madeByConnect: "Creata con Collega WordPress",
      advancedTitle: "Chiavi (avanzate)",
      advancedHelp: "Ogni installazione di WordPress conserva una chiave. Servono solo per collegare a mano un’altra installazione o per fermarne una (Revoca).",
      keyReplaced: "Quella chiave è stata sostituita o revocata prima che WordPress la usasse. Prema di nuovo Collega WordPress.",
      waitingResumed: "In attesa che WordPress usi la chiave creata poco fa. Se ha chiuso quella scheda di WordPress, prema di nuovo Collega WordPress.",
      gaveUp: "Attesa interrotta. Se ha completato in WordPress, ricarichi questa pagina; altrimenti prema di nuovo Collega WordPress.",
      notActiveHelp: "Se WordPress dice che non ha il permesso di accedere a quella pagina, il plugin non è ancora attivo: faccia il passo 1, poi prema Riapri WordPress.",
      madeByHand: "Aggiunta a mano",
      quotedName: "“{name}”",
    },
    partnerNetwork: {
      title: "Rete partner",
      subtitle: "Gestisci come il tuo sito partecipa alla rete di link di RepGet.",
      participationTitle: "Partecipazione alla rete",
      participationHelp: "Partecipa alla rete partner di RepGet per ospitare link pertinenti e ricevere link alle tue pagine.",
      enabled: "Attiva",
      disabled: "Disattiva",
      whatTitle: "Cosa fa",
      whatBody: "Il team RepGet inserisce link pertinenti dagli articoli dei partner verso le pagine che indichi, e può inserire link dei partner nei tuoi articoli prima della pubblicazione. Il tuo spazio guadagna crediti per ogni link ospitato e li spende per ogni link ricevuto, solo quando il link è verificato online. Non devi scegliere partner né approvare ogni link.",
      offNote: "Disattivandola non vengono più organizzati nuovi link. I link già inseriti restano e continuano a essere verificati e accreditati.",
      inReview: "{n} dei tuoi articoli sono in revisione presso il team RepGet.",
      ratingTitle: "Autorità minima",
      ratingHelp: "L’autorità minima di un sito che ti linka.",
      ratingUnconfigured: "Non ancora disponibile: l’autorità dei siti della rete non viene misurata, quindi non si può imporre un minimo. Il team RepGet controlla a mano ogni sito che linka.",
      targetsTitle: "Pagine obiettivo",
      targetsHelp: "Scegli e ordina per priorità le pagine del tuo sito che devono ricevere link.",
      addTarget: "Aggiungi pagina obiettivo",
      urlLabel: "Indirizzo della pagina",
      noteLabel: "Che pagina è (facoltativo)",
      priorityLabel: "Priorità",
      high: "Alta",
      medium: "Media",
      low: "Bassa",
      moveUp: "Sposta su",
      moveDown: "Sposta giù",
      remove: "Rimuovi",
      noTargets: "Nessuna pagina obiettivo. Aggiungi le pagine per cui vuoi più link.",
      targetAdded: "Pagina obiettivo aggiunta",
      saved: "Salvato",
      turnedOn: "Fai parte della Rete partner",
      turnedOff: "Hai lasciato la Rete partner",
      creditsLine: "{available} crediti disponibili · {reserved} riservati",
      add: "Aggiungi",
      cancel: "Annulla",
      ratingMetric: "Misurata con l'Autorità di dominio (0-100) del sito che linka.",
      ratingNone: "Nessun minimo",
      ratingNoneHelp: "Qualsiasi partner pertinente può linkarti; il team RepGet controlla ogni sito a mano.",
      ratingSliderLabel: "Autorità di dominio minima",
      ratingCurrent: "Solo link da siti con Autorità di dominio {n} o superiore",
      ratingScaleOnly: "Il suo piano arriva fino a {cap}. Un’Autorità di dominio superiore a {cap} è inclusa nel piano Scale.",
      ratingSave: "Salva minimo",
      ratingSaved: "Minimo salvato",
      ratingNoAccess: "Non ancora disponibile: al momento l'Autorità di dominio non può essere misurata. Il team RepGet controlla a mano ogni sito che linka.",
    },
    reports: {
      subnavLabel: "Sezioni backlink",
      navOverview: "Panoramica",
      navEarned: "Backlink ottenuti",
      navHosted: "Link ospitati",
      navCredits: "Attività dei crediti",
      authorityLabel: "Autorità di dominio",
      authorityValueAria: "Autorità di dominio {value} su {max}",
      authorityUpdated: "Aggiornato il {date}",
      authorityStale: "Del {date} - aggiornamento in attesa",
      authorityCollecting: "In raccolta",
      authorityNoAccess: "Non ancora disponibile",
      authorityNoData: "Ancora nessun dato per questo sito",
      authorityError: "Raccolta non riuscita - nuovo tentativo previsto",
      authorityNotConfigured: "Non ancora configurato",
      authorityWhat: "Che cos'è?",
      authorityHelp: "Un punteggio da 0 a 100 basato sui siti che rimandano a un dominio. Non è il punteggio di salute del tuo sito.",
      authorityDetail: "Autorità di dominio {value}/{max}, misurata il {date}",
      authorityUnavailableDetail: "Non ancora disponibile",
      rankStaleTitle: "Autorità di dominio - più vecchia di 30 giorni",
      unknownShort: "n/d",
      unknownRank: "autorità sconosciuta",
      issueHosted: "A {count} tuo articolo manca il link di un partner: nessun credito guadagnato|A {count} tuoi articoli manca il link di un partner: nessun credito guadagnato",
      issueHostedHelp: "Il link non è stato trovato nell'articolo pubblicato dopo più controlli. Ripristinalo e chiedi un nuovo controllo.",
      issueReceived: "{count} link al tuo sito non è stato trovato nella pagina del partner: non ti è stato addebitato nulla|{count} link al tuo sito non sono stati trovati nelle pagine dei partner: non ti è stato addebitato nulla",
      issueReceivedHelp: "I crediti si spendono solo quando il link è verificato online. Il team RepGet segue la cosa con il partner.",
      reviewResolve: "Esamina e risolvi",
      dismiss: "Chiudi",
      issueFilterGiven: "Link non trovati nei tuoi articoli pubblicati. Ripristina ogni link, poi usa «Controlla di nuovo».",
      issueFilterReceived: "Link non trovati nella pagina del partner. Non è stato addebitato nulla.",
      issueNofollowHosted: "{count} link di un partner nei suoi articoli è nofollow: non porta valore SEO|{count} link di partner nei suoi articoli sono nofollow: non portano valore SEO",
      issueNofollowHostedHelp: "I motori di ricerca ignorano i link nofollow o sponsored. Modifichi l'articolo, tolga nofollow / sponsored dal link del partner, poi chieda un nuovo controllo.",
      issueNofollowReceived: "{count} link al suo sito è nofollow nella pagina del partner|{count} link al suo sito sono nofollow nelle pagine dei partner",
      issueNofollowReceivedHelp: "Questi link sono attivi ma portano poco valore SEO. È stato chiesto al proprietario del sito di renderli follow.",
      issueFilterNofollowGiven: "Link di partner nofollow nei suoi articoli pubblicati. Tolga nofollow / sponsored da ogni link, poi usi \"Controlla di nuovo\".",
      issueFilterNofollowReceived: "Link al suo sito che la pagina del partner marca nofollow. È stato chiesto al proprietario del sito di correggerli.",
      nofollowBadge: "Nofollow",
      overviewTitle: "Panoramica backlink",
      overviewIntro: "Il tuo portafoglio di link, il saldo crediti e le impostazioni che il team RepGet segue quando inserisce link per te.",
      portfolioTitle: "Portafoglio backlink",
      verifiedBacklinks: "backlink verificato|backlink verificati",
      referringDomains: "da {count} sito|da {count} siti",
      strongestLink: "Fonte più forte",
      strongestHelp: "L'Autorità di dominio più alta tra i siti che ti linkano con un link verificato.",
      last30Days: "Ultimi 30 giorni",
      newInWindowHelp: "Link verificati per la prima volta negli ultimi 30 giorni (UTC).",
      estimatedValue: "Valore equivalente stimato",
      estimateNotConfigured: "Stima non configurata",
      estimateNotConfiguredHelp: "RepGet mostra una stima in denaro solo dopo che il suo team ha pubblicato le tariffe e le loro fonti. Fino ad allora non viene mostrata alcuna cifra, invece di una inventata.",
      howEstimated: "Come viene stimato?",
      estimateMethod: "Politica di valutazione v{version} ({currency}), in vigore dal {date}: una tariffa per link verificato in base all'Autorità di dominio del sito che linka. Fonti: {sources}. È una stima di quanto costerebbero link equivalenti, non denaro risparmiato o guadagnato.",
      unvaluedLinks: "{count} link verificato non ha una tariffa applicabile e non è incluso.|{count} link verificati non hanno una tariffa applicabile e non sono inclusi.",
      mostRecentLinks: "Link più recenti",
      colVerified: "Verificato",
      verifiedDateHelp: "Il giorno in cui il link è stato visto online per la prima volta.",
      noVerifiedYet: "Ancora nessun link verificato. Compariranno qui quando il controllo li vedrà online.",
      pipeline: "{publication} in attesa di pubblicazione · {verification} in attesa di verifica",
      seeAllBacklinks: "Vedi tutti i backlink",
      creditsCardTitle: "Crediti backlink",
      creditActivity: "Attività dei crediti",
      creditsAvailableLine: "disponibili · {reserved} riservati per link in corso · saldo {balance}",
      recoverFromArticles: "Recupera i crediti da {count} articolo|Recupera i crediti da {count} articoli",
      buyCredits: "Acquista crediti link",
      creditsHowItWorks: "Guadagni crediti quando il link di un partner nel tuo articolo è verificato online e li spendi quando viene verificato un link al tuo sito. Durante l'inserimento i crediti restano riservati; se un link verificato viene poi rimosso, vengono restituiti.",
      creditsScopeNote: "I crediti appartengono al tuo spazio di lavoro e sono condivisi da tutti i suoi siti.",
      creditsOwnerOnly: "I crediti appartengono allo spazio di lavoro proprietario di questo sito e sono visibili solo ai suoi membri.",
      receivedSectionTitle: "Link al tuo sito",
      receivedFlow: "Inseriti negli articoli dei partner → verificati → crediti spesi",
      givenSectionTitle: "Link che ospiti",
      givenFlow: "Inseriti nei tuoi articoli → verificati → crediti guadagnati",
      seeAllCount: "Vedi {count} link|Vedi tutti i {count} link",
      earnedTitle: "Backlink ottenuti",
      earnedIntro: "Tutti i link che le tue pagine hanno ricevuto tramite la rete partner, con la fonte, le parole collegate e lo stato di verifica.",
      hostedTitle: "Link ospitati",
      hostedIntro: "Link dei partner inseriti nei tuoi articoli. Ognuno fa guadagnare crediti quando è verificato online nel tuo articolo pubblicato.",
      statusFilterLabel: "Filtra per stato",
      tabAll: "Tutti",
      tabVerified: "Verificati",
      tabPending: "In attesa",
      tabRefunded: "Rimborsati",
      typeLabel: "Tipo",
      typeAll: "Tipo: tutti",
      typeManaged: "Inserito dal team RepGet",
      typeExchange: "Scambio (abbinamento automatico)",
      resultCount: "{count} link|{count} link",
      recoverFrom: "Recupera i crediti da {count} link|Recupera i crediti da {count} link",
      recoverQueued: "{count} controllo richiesto. I crediti si guadagnano solo se il link risulta online.|{count} controlli richiesti. I crediti si guadagnano solo se i link risultano online.",
      searchLabel: "Cerca link",
      searchPlaceholder: "Sito, pagina o parole collegate",
      dateFrom: "Dal",
      dateTo: "Al",
      apply: "Applica",
      clearFilters: "Rimuovi filtri",
      dateMeaning: "Le date sono in UTC e mostrano l'ultimo passaggio del link: verificato, rimosso, pubblicato o inserito.",
      colDate: "Data",
      colLink: "Link",
      colDestination: "Destinazione",
      colAuthority: "Autorità di dominio",
      colValue: "Valore stim.",
      colCredits: "Crediti",
      colAiCitation: "Citazioni IA",
      colStatus: "Stato",
      colDetails: "Dettagli",
      aiCitationHelp: "Quante volte la pagina con questo link è stata citata nei tuoi controlli di visibilità IA (ultimi 90 giorni).",
      aiNotMeasured: "Non misurato: nessun controllo di visibilità IA negli ultimi 90 giorni, o la pagina non è ancora pubblicata.",
      aiCitations: "{count} citazione|{count} citazioni",
      aiCitationsDetail: "Citata in {count} risposta IA dei tuoi controlli (ultimi 90 giorni)|Citata in {count} risposte IA dei tuoi controlli (ultimi 90 giorni)",
      emptyFiltered: "Nessun link corrisponde a questi filtri.",
      emptyReceived: "Ancora nessun link al tuo sito. Il team RepGet li inserisce negli articoli dei partner; compaiono qui appena ne viene inserito uno.",
      emptyGiven: "Ancora nessun link di partner nei tuoi articoli.",
      unknownWebsite: "Sito sconosciuto",
      untitled: "Articolo senza titolo",
      dateUnknown: "Data non registrata",
      valueNotApplicable: "Valutato dopo la verifica",
      showDetails: "Mostra dettagli di {site}",
      hideDetails: "Nascondi dettagli di {site}",
      loading: "Caricamento…",
      sortable: "ordinabile",
      sortedAsc: "ordine crescente",
      sortedDesc: "ordine decrescente",
      paginationLabel: "Pagine",
      showingRange: "Da {first} a {last} di {total}",
      perPage: "Per pagina",
      prev: "Precedente",
      next: "Successiva",
      pageOf: "Pagina {page} di {pages}",
      valueFootnote: "I valori equivalenti stimati usano la politica di valutazione v{version} ({currency}); sono stime, non denaro risparmiato.",
      lcVerified: "Verificato",
      lcAwaitingPublication: "In attesa di pubblicazione",
      lcAwaitingVerification: "In attesa di verifica",
      lcNotFound: "Non trovato - non addebitato",
      lcRemoved: "Rimosso - rimborsato",
      lcWithdrawn: "Ritirato prima della pubblicazione - nessun addebito",
      lcUnknown: "Stato sconosciuto",
      eventVerified: "verificato",
      eventRemoved: "rimosso",
      eventPublished: "pubblicato",
      eventPlaced: "inserito",
      eventUnknown: "-",
      creditSettled: "{n} spesi",
      creditEarned: "+{n} guadagnati",
      creditReserved: "{n} riservati",
      creditPending: "+{n} dopo la verifica",
      creditRefunded: "{n} rimborsati",
      creditReversed: "{n} stornati",
      creditNone: "Nessun addebito",
      dSourceArticle: "Articolo di origine",
      dYourArticle: "Il tuo articolo",
      dSourceSite: "Sito che linka",
      dDestinationSite: "Sito di destinazione",
      dYourPage: "La tua pagina",
      dDestinationPage: "Pagina di destinazione",
      dAnchor: "Parole collegate",
      dType: "Tipo di inserimento",
      dRel: "Attributi del link nella pagina",
      dPublished: "Pubblicato",
      dFirstVerified: "Prima verifica",
      dRemoved: "Rimosso",
      dLastCheck: "Ultimo controllo",
      dAuthority: "Autorità della fonte",
      dValue: "Valore stimato",
      dAiCitation: "Citazioni IA",
      dCredits: "Crediti di questo link",
      opensNewTab: "(si apre in una nuova scheda)",
      notPublishedYet: "Non ancora pubblicato",
      anchorHidden: "Visibile quando l'articolo del partner sarà pubblicato",
      relUnknown: "Sconosciuto (non ancora visto online)",
      relFollowed: "Nessuno (link seguito)",
      relUnfollowed: "{rel} - non seguito: porta poco valore SEO",
      notYet: "Non ancora",
      checkAlive: "link trovato",
      checkMissing: "link non trovato",
      checkError: "pagina non raggiungibile (non conteggiato)",
      fvFromCheck: "Dal primo controllo riuscito (registrato prima che si salvassero le date di verifica).",
      fvFromLedger: "Dalla registrazione di addebito (prima che si salvassero le date di verifica).",
      valueDetail: "{value}, in base alla politica di valutazione e all'Autorità di dominio della fonte",
      noCreditMovements: "Nessun credito è stato movimentato per questo link.",
      adviceNotFoundGiven: "Il link manca nel tuo articolo pubblicato. Rimettilo (o ripubblica l'articolo), poi scegli «Controlla di nuovo»: i crediti si guadagnano solo quando è visto online.",
      adviceNotFoundReceived: "L'articolo del partner non contiene il link. Non ti è stato addebitato nulla; il team RepGet segue la cosa.",
      adviceAwaitingVerification: "L'articolo è online. Il link viene controllato automaticamente, di solito entro un giorno; i crediti si muovono solo quando è visto.",
      adviceAwaitingPublicationGiven: "Questo link è in un tuo articolo non ancora pubblicato. Uscirà con l'articolo, dopo la revisione del team RepGet.",
      adviceAwaitingPublicationReceived: "Inserito nell'articolo di un partner non ancora pubblicato. I suoi crediti sono riservati, non spesi.",
      adviceRemoved: "Il link era verificato, poi è stato confermato che era sparito ed è stato rimosso: i crediti sono stati rimborsati.",
      recheck: "Controlla di nuovo",
      recheckRecover: "L'ho ripristinato - controlla di nuovo",
      recheckQueued: "Controllo richiesto. Verrà eseguito a breve; i crediti si muovono solo se il link risulta online.",
      recheckRevived: "Di nuovo in attesa di verifica. Se il link risulta online, i crediti verranno regolati allora.",
      recheckAlreadyQueued: "Un controllo è già in coda.",
      recheckCooldown: "Controllato di recente: potrai chiederlo di nuovo tra qualche ora.",
      creditsTitle: "Attività dei crediti",
      creditsIntro: "Tutti i crediti che il tuo spazio di lavoro ha ricevuto, riservato, speso o recuperato, dal più recente.",
      creditsSummary: "Riepilogo",
      creditsAvailable: "Disponibili",
      creditsReservedLabel: "Riservati",
      creditsReservedHelp: "Trattenuti per link in corso; spesi solo quando il link è verificato online.",
      creditsBalance: "Saldo",
      creditsEarnedTotal: "Guadagnati (totale)",
      creditsSpentTotal: "Spesi (totale)",
      creditsRefundedTotal: "Rimborsati (totale)",
      colEntry: "Movimento",
      colWebsite: "Sito",
      creditsEmpty: "Ancora nessuna attività dei crediti.",
      workspaceWide: "Spazio di lavoro",
      ledgerPlanGrant: "Dotazione mensile del piano",
      ledgerLinkGiven: "Guadagnato: link ospitato verificato",
      ledgerLinkReceived: "Speso: link al tuo sito verificato",
      ledgerRefund: "Rimborso",
      ledgerPurchase: "Acquistati",
      ledgerReferral: "Premio per segnalazione",
      ledgerReferralReversed: "Premio per segnalazione annullato: pagamento rimborsato",
      ledgerReversal: "Stornato: link ospitato rimosso",
      ledgerAdjustment: "Rettifica",
      sectionUnavailable: "Impossibile caricare questa sezione. Aggiorna la pagina; se persiste, contatta l'assistenza.",
      websiteAuthority: "Autorità del sito",
      backlinksHeading: "Backlink",
      openBacklinks: "Apri backlink",
      partnerNetworkLabel: "Rete partner",
      getCredits: "Ottieni crediti",
      verifiedBacklinksLabel: "Backlink verificati",
      availableCredits: "Crediti disponibili",
      ownerOnlyShort: "Solo proprietario",
      chartActiveLinks: "Link verificati al tuo sito",
      unitLinks: "link",
      noData: "nessun dato",
      chartInstructions: "Usa le frecce sinistra e destra per spostarti tra i giorni.",
      undatedLinks: "{count} vecchio link verificato non ha una data registrata e non è nel grafico.|{count} vecchi link verificati non hanno una data registrata e non sono nel grafico.",
      todaysArticle: "Articolo di oggi",
      nothingWritten: "Ancora niente di scritto. Il tuo primo articolo comparirà qui quando partirà il piano dei contenuti.",
      openContentPlan: "Apri il piano dei contenuti",
      stPublished: "Pubblicato",
      stAwaitingReview: "Presso il team RepGet",
      stAwaitingReviewHelp: "In revisione dal team RepGet prima dell'uscita. Nulla viene pubblicato prima della loro approvazione.",
      stApproved: "Approvato",
      stApprovedHelp: "Approvato: esce nel giorno previsto, {date}, secondo le tue impostazioni di pubblicazione.",
      stApprovedNoDate: "Approvato: esce secondo le tue impostazioni di pubblicazione.",
      stScheduled: "Programmato",
      stScheduledHelp: "Esce il {date}.",
      stDraft: "Bozza",
      stDraftHelp: "In attesa che tu lo pubblichi.",
      stWriting: "In scrittura",
      stFailed: "Richiede attenzione",
      searchVolume: "Volume di ricerca",
      perMonth: "{n}/mese",
      difficulty: "Difficoltà",
      articleType: "Tipo di articolo",
      intentCommercial: "Commerciale",
      intentTransactional: "Transazionale",
      intentInformational: "Informativo",
      intentNavigational: "Navigazionale",
      whyThisTopic: "Perché questo argomento?",
      whyWithVolume: "Punta a «{keyword}», cercato circa {volume} volte al mese.",
      whyKeyword: "Punta a «{keyword}».",
      winsTitle: "Risultati di 7 giorni",
      winsCount: "{count} risultato|{count} risultati",
      noWins: "Niente di nuovo negli ultimi 7 giorni.",
      winPublished: "Pubblicato: {title}",
      winPublishedDetail: "Pubblicato per la prima volta sul tuo sito questa settimana",
      winLinksReceived: "{count} nuovo link al tuo sito verificato|{count} nuovi link al tuo sito verificati",
      winLinksReceivedDetail: "Link dagli articoli dei partner, visti online",
      winLinksGiven: "{count} link ospitato verificato: crediti guadagnati|{count} link ospitati verificati: crediti guadagnati",
      winLinksGivenDetail: "Link dei partner nei tuoi articoli, visti online",
      winAudit: "Salute del sito controllata: punteggio {score}",
      winAuditDetail: "Cosa frena il sito su Google",
      winClicks: "{count} clic da Google (tutto il sito)|{count} clic da Google (tutto il sito)",
      winClicksDetail: "Dati di Search Console fino al {date}",
      view: "Vedi",
      bestArticles: "Articoli migliori",
      bestArticlesHelp: "I tuoi articoli RepGet che portano più clic da Google (ultimi 30 giorni disponibili).",
      openGoogleResults: "Apri i risultati Google",
      connectSearchConsole: "Collega Google Search Console per vedere il rendimento dei tuoi articoli.",
      connect: "Collega",
      noArticleTraffic: "Search Console non ha ancora riportato clic o impressioni per i tuoi articoli RepGet.",
      colArticle: "Articolo",
      colClicks: "Clic",
      colImpressions: "Impressioni",
      colPosition: "Posizione",
      colSessions: "Sessioni (GA)",
      colFirstPublished: "Prima pubblicazione",
      colKeywordCpc: "Parola chiave · CPC (USD)",
      searchConsoleThrough: "Dati di Search Console fino al {date}.",
      analyticsThrough: "Dati di Google Analytics fino al {date}.",
      connectAnalytics: "Collega Google Analytics per vedere le sessioni dei tuoi articoli.",
      achievements: "Risultati",
      valueHeadline: "Valore equivalente stimato: {value}",
      valueHeadlineUnconfigured: "Valore stimato non ancora configurato",
      achievementsIntro: "Cosa hanno prodotto i tuoi articoli e la rete partner in questo periodo. Il team RepGet rivede gli articoli e inserisce i link a mano.",
      lastNDays: "Ultimi {days} giorni (UTC)",
      plusArticles: "+{n} articoli",
      plusBacklinks: "+{n} backlink",
      rangeLabel: "Periodo",
      rangeDays: "{days} giorni",
      range12m: "12 mesi",
      viewLabel: "Vista",
      chart: "Grafico",
      details: "Dettagli",
      metricLabel: "Metrica mostrata nel grafico",
      trafficValue: "Valore del traffico",
      trafficValueHelp: "Quanto costerebbero in annunci i clic ai tuoi articoli (stima)",
      backlinkValue: "Valore dei backlink",
      backlinkValueHelp: "Link verificati per la prima volta nel periodo (stima)",
      articlesPublished: "Articoli pubblicati",
      articlesPublishedHelp: "Prima volta online sul tuo sito (bozze e modifiche non contano)",
      articleImpressions: "Impressioni degli articoli",
      articleImpressionsHelp: "Quante volte i tuoi articoli RepGet sono comparsi su Google",
      articleClicks: "Clic sugli articoli",
      articleClicksHelp: "Clic da Google ai tuoi articoli RepGet (Search Console)",
      articleSessions: "Sessioni sugli articoli",
      articleSessionsHelp: "Visite ai tuoi articoli RepGet (Google Analytics)",
      notConnected: "Non collegato",
      notConfiguredShort: "Non configurato",
      currencyMismatch: "Richiede una politica in USD",
      websiteHealth: "Salute del sito",
      websiteHealthHelp: "Il tuo ultimo audit tecnico, distinto dall'autorità",
      noSeries: "Ancora nessun dato per questa metrica nel periodo.",
      utcDays: "I giorni sono giorni di calendario UTC.",
      unitArticles: "articoli",
      unitClicks: "clic",
      unitImpressions: "impressioni",
      unitSessions: "sessioni",
      breakdownCaption: "I tuoi articoli RepGet nel periodo, per clic da Google",
      breakdownShowing: "Sono mostrate le prime {shown} pagine su {total}. I totali qui sopra includono tutte le pagine.",
      unknownPublicationDates: "{n} articoli precedenti sono online, ma non è stato registrato quando sono andati online la prima volta, quindi non sono contati in nessun periodo.",
      noPublishedArticles: "Ancora nessun articolo RepGet pubblicato.",
      methodologyTitle: "Come vengono calcolate queste cifre",
      methodologyPolicy: "Politica di valutazione v{version}, in {currency}, in vigore dal {date}.",
      methodologyCpc: "Valore del traffico = clic di Search Console di ogni articolo × costo per clic della sua parola chiave, dalla ricerca di parole chiave per il tuo mercato (USD).",
      methodologyFixed: "Valore del traffico = clic di Search Console ai tuoi articoli RepGet × {rate} per clic.",
      methodologyNoTraffic: "Il traffico non è valutato con questa politica.",
      methodologyBacklinks: "Valore per link verificato, in base all'Autorità di dominio del sito che linka: {bands}.",
      methodologyNoBacklinks: "I backlink non sono valutati con questa politica.",
      methodologySources: "Fonti: {sources}",
      methodologyExcluded: "Mai conteggiati: bozze, link in attesa di pubblicazione o verifica, link non trovati o rimossi, link interni e la dicitura «Powered by RepGet».",
      methodologyNotSavings: "Sono stime del costo di annunci o link equivalenti, non denaro risparmiato, ricavi o un rendimento garantito.",
      searchPerformance: "Prestazioni di ricerca",
      websiteTraffic: "Traffico del sito",
      aiSearch: "Ricerca IA",
      aiNoChecks: "Nessun controllo di visibilità IA nel periodo.",
      openAiVisibility: "Apri visibilità IA",
      aiChecks: "Risposte controllate",
      aiMentioned: "Ti menzionano",
      aiCited: "Citano il tuo sito",
      aiReferralNotMeasured: "Le visite dagli assistenti IA non sono ancora misurate: queste sono risposte che RepGet ha controllato per te.",
      googleTraffic: "Traffico da Google",
      connectSearchConsoleTraffic: "Collega Google Search Console per vedere clic, impressioni e posizione.",
      siteClicks: "Clic",
      siteImpressions: "Impressioni",
      avgPosition: "Posizione media",
      vsPrevious: "vs precedente",
      siteWideThrough: "Tutto il sito, ultimi {days} giorni; dati di Search Console fino al {date}.",
      uncertainTitle: "L'ultimo tentativo di pubblicazione non ha ricevuto risposta dal tuo sito",
      uncertainHelp: "Il post potrebbe già esistere. Controlla il tuo sito: se l'articolo c'è, non serve altro; se non c'è, confermalo qui sotto e pubblica di nuovo. Aspettiamo per non rischiare un post duplicato.",
      uncertainConfirm: "Non è sul mio sito - consenti di pubblicare di nuovo",
      uncertainConfirmed: "Registrato. Puoi pubblicare di nuovo l'articolo.",
      lcNotFoundGiven: "Non trovato - nessun credito guadagnato",
      lcRemovedGiven: "Rimosso - crediti stornati",
    },
    image: {
      altLabel: "Descrizione dell\u2019immagine",
      altPlaceholder: "Che cosa mostra l\u2019immagine",
      promptLabel: "Descriva un\u2019immagine diversa",
      promptPlaceholder: "Una cerimonia serale illuminata da candele, senza persone",
      noRegensLeft: "Ha esaurito le rigenerazioni per questo articolo. Carichi una sua immagine.",
      imageReady: "Nuova immagine pronta",
      imageUploaded: "Immagine caricata",
      imageRemoved: "Immagine rimossa",
    },
    profile: {
      businessDetails: "Dati dell\u2019attività",
      detailsHelp: "Questi dati definiscono le sue parole chiave e ogni articolo che scriviamo.",
      correctAnything: " Corregga ciò che abbiamo frainteso.",
      fillsIn: " Si compilano da soli una volta analizzato il sito - può anche inserirli ora.",
      brandName: "Nome del marchio",
      brandNamePlaceholder: "Acme S.r.l.",
      industry: "Settore",
      industryPlaceholder: "Studio dentistico",
      country: "Mercato principale",
      countryPlaceholder: "Italia",
      audience: "Pubblico di riferimento",
      audiencePlaceholder: "Proprietari di casa dai 30 ai 55 anni",
      mainLanguage: "Lingua principale",
      description: "Descrizione",
      descriptionPlaceholder: "Che cosa fa l\u2019attività, in una o due frasi.",
      saveDetails: "Salva dati",
      saving: "Salvataggio…",
      detailsSaved: "Dati salvati",
      pageTitle: "Impostazioni dell’attività",
      pageDescription: "I dati dell’attività dietro {domain}. La ricerca delle parole chiave e ogni articolo che scriviamo si basano su di essi.",
      identityTitle: "Identità dell’attività",
      identityHelp: "Chi è e di cosa si occupa.",
      marketTitle: "Mercato e pubblico",
      marketHelp: "Dove vende, chi vuole raggiungere e la lingua in cui vengono scritti i suoi articoli.",
      descriptionTitle: "Descrizione dell’attività",
      descriptionHelp: "Cosa fa l’attività e cosa la distingue, con parole sue.",
      competitorsTitle: "Concorrenti",
      competitorsHelp: "Le attività che competono con lei per gli stessi clienti. I suggerimenti provengono dall’analisi del suo sito, quindi li controlli: rimuova quelli che non sono veri concorrenti e aggiunga quelli che mancano.",
      brandNameHint: "Il nome con cui la conoscono i suoi clienti.",
      industryHint: "Di cosa si occupa, in poche parole.",
      marketPlaceholder: "Italy",
      countryHint: "Il paese in cui vende principalmente, scritto in inglese (per esempio Spain), così la ricerca delle parole chiave considera il paese giusto.",
      marketNotEnglish: "La ricerca delle parole chiave riconosce solo i nomi dei paesi scritti in inglese.",
      marketUseEnglish: "Usa {country}",
      articleLanguage: "Lingua degli articoli",
      articleLanguageHint: "Gli articoli di questo sito vengono scritti in questa lingua. Non cambia la sua dashboard.",
      dashboardLanguageNote: "La sua dashboard è in {language}, un’impostazione personale del suo account.",
      dashboardLanguageLink: "Cambia la lingua della dashboard",
      chooseLanguage: "Scelga una lingua",
      unknownLanguage: "{language} (valore attuale)",
      audienceHint: "Chi vuole raggiungere: per esempio età, situazione o esigenze.",
      descriptionHint: "Bastano poche frasi: i suoi principali prodotti o servizi, dove lavora e cosa la distingue.",
      notSet: "Non impostato",
      unsavedBadge: "Non salvato",
      saveBusinessDetails: "Salva dati",
      saveScope: "Vale per tutte le sezioni tranne Concorrenti, che si salvano appena ne aggiunge o ne rimuove uno.",
      saveError: "Qualcosa è andato storto. Le sue modifiche sono ancora qui, quindi può riprovare.",
      checklistNeedsBoth: "Aggiunga una descrizione e scelga una lingua degli articoli per completare questo passaggio della sua lista di lancio.",
      checklistNeedsDescription: "Aggiunga una descrizione per completare questo passaggio della sua lista di lancio.",
      checklistNeedsLanguage: "Scelga una lingua degli articoli per completare questo passaggio della sua lista di lancio.",
      analysingTitle: "Stiamo analizzando il suo sito",
      analysingBody: "Al termine dell’analisi verranno compilati nome del marchio, settore, mercato, pubblico e descrizione, sostituendo il contenuto attuale di questi campi. La lingua degli articoli che sceglie viene mantenuta.",
      analysingBodyReadOnly: "Al termine dell’analisi questi dati verranno compilati.",
      refresh: "Aggiorna",
      analysisFailedTitle: "Non siamo riusciti ad analizzare il suo sito",
      analysisFailedBody: "Questi dati non sono stati compilati automaticamente. Può inserirli lei.",
      analysisFailedBodyReadOnly: "Questi dati non sono stati compilati automaticamente.",
      analysisFailedRetry: "Può riprovare l’analisi dalla pagina Siti web.",
      goToWebsites: "Vai a Siti web",
      competitorCount: "1 concorrente|{count} concorrenti",
      manualGroup: "Aggiunti da lei",
      suggestedGroup: "Suggeriti dall’analisi",
      suggestedGroupHelp: "Trovati analizzando il suo sito, non scelti da lei. Rimuova quelli che non sono veri concorrenti.",
      suggestedGroupHelpReadOnly: "Trovati analizzando il sito.",
      competitorsEmpty: "Ancora nessun concorrente.",
      competitorsEmptyAnalysed: "L’analisi del suo sito non ha suggerito concorrenti.",
      competitorsEmptyAnalysing: "I suggerimenti compariranno qui al termine dell’analisi del suo sito.",
      competitorsTruncated: "Sono mostrati i primi {count} concorrenti.",
      addCompetitor: "Aggiungi un concorrente",
      addCompetitorHint: "L’indirizzo del suo sito, per esempio rival.com. Verifichiamo che il sito esista prima di aggiungerlo, e può richiedere qualche secondo.",
      competitorPlaceholder: "rival.com",
      addCompetitorButton: "Aggiungi",
      checkingShort: "Verifica…",
      checkingCompetitor: "Verifica di {domain}…",
      competitorAdded: "{domain} aggiunto.",
      removingCompetitor: "Rimozione di {domain}…",
      competitorRemoved: "{domain} rimosso.",
      visitCompetitor: "Apri {domain} in una nuova scheda",
      removeCompetitor: "Rimuovi {domain}",
      competitorRequired: "Inserisca un indirizzo web.",
      competitorInvalid: "Inserisca un indirizzo web come rival.com.",
      competitorOwnSite: "Questo è il suo sito.",
      competitorDuplicate: "{domain} è già nella sua lista.",
      competitorNotPublic: "Questo indirizzo non è un sito web pubblico.",
      competitorBlocked: "Social network e grandi piattaforme come Google, Amazon o Wikipedia non possono essere aggiunti come concorrenti.",
      competitorUnreachable: "Non siamo riusciti a raggiungere {domain}. Controlli l’ortografia e riprovi.",
      actionFailed: "Qualcosa è andato storto. Riprovi.",
    },
    setup: {
      launchChecklist: "Lista di lancio",
      allLive: "Tutto è attivo",
      finishSetup: "Completi la configurazione",
      allLiveHelp: "Tutti i sistemi necessari sono attivi. Vada alla dashboard per i dati in tempo reale.",
      stepsLeft:
        "Manca {n} passaggio prima che tutto funzioni da solo.|Mancano {n} passaggi prima che tutto funzioni da solo.",
    },
    common: {
      cancel: "Annulla",
      done: "Fatto",
      edit: "Modifica",
      preview: "Anteprima",
      connect: "Collega",
      checking: "Controllo…",
      discard: "Scarta",
      revoke: "Revoca",
      failed: "Non riuscito",
      images: "Immagini",
      rewrite: "Riscrivi",
      tryAgain: "Riprova",
      somethingWentWrong: "Qualcosa è andato storto su questa pagina",
      remove: "Rimuovi",
      upload: "Carica",
      disconnect: "Scollega",
      competitors: "Concorrenti",
      websiteHealth: "Salute del sito",
      checkingWebsite: "Controllo del suo sito",
      nothingNeedsAttention: "Non c\u2019è nulla da sistemare. Ricontrolli dopo aver fatto modifiche.",
      requestQuote: "Richiedi un preventivo",
      wantUsToFix: "Vuole che li sistemiamo noi?",
      saveProperties: "Salva proprietà",
      appeared: "Comparse",
      noImageYet: "Ancora nessuna immagine",
      notScheduled: "Non pianificato",
      nothingPlanned: "Nulla in programma per questo giorno.",
      defaultsAreFine: "Le vanno bene? Può modificarle in qualsiasi momento.",
      keepDefaults: "Mantieni le impostazioni predefinite",
      noPlanYet: "Nessun piano editoriale",
      noPlanYetHaveKeywords: "I suoi termini di ricerca sono pronti, ma il piano che li trasforma in articoli non è ancora stato creato. Lo crei ora.",
      buildPlan: "Crea il mio piano editoriale",
      requestLink: "Richiedi un link",
      admin: "Amministrazione",
      articleLanguageHelp: "I suoi articoli vengono scritti in questa lingua.",
      namedInstead: "Citati al suo posto, più spesso",
      mostPopular: "Il più scelto",
      receiptInPayPal: "Ricevuta in PayPal",
      noCharge: "Nessun addebito",
      close: "Chiudi",
      copied: "Copiato",
      openMenu: "Apri il menu",
      changeLanguage: "Cambia lingua",
      brandHome: "Home di RepGet",
      skipped: "Saltato",
      hideSetupSteps: "Nascondi i passaggi",
      setupProgress: "Avanzamento della configurazione",
      secureCheckout: "Pagamento sicuro",
      skipForNow: "Salta per ora",
      verifiedCustomer: "Cliente verificato",
      searchYourImages: "Cerca tra le sue immagini",
      critical: "Critico",
      suggestion: "Suggerimento",
      warning: "Avviso",
      importData: "Importa dati",
      auditIntro: "Controlliamo le sue pagine ed elenchiamo che cosa frena il suo sito su Google, indicando la pagina esatta di ogni problema.",
      losingTrafficIntro: "Pagine che ricevono meno clic, o compaiono meno su Google, rispetto a un mese fa. Secondo i suoi dati di Search Console.",
      noCompetitorsFound: "Non ne abbiamo trovato nessuno dal suo sito. Aggiunga i concorrenti che conosce e li useremo per individuare lacune nei contenuti.",
      competitorsHelp: "Chi altro compare quando gli acquirenti cercano nel suo settore. Li usiamo per trovare lacune nei contenuti e i termini che vale la pena presidiare.",
      connectWebsiteFirst: "Colleghi prima il suo sito in Impostazioni → Integrazioni. Fino ad allora, gli articoli restano in RepGet.",
      generationHelp: "Come vengono scritti i suoi articoli e che cosa ne succede quando sono pronti.",
      altHelp: "Viene letta ad alta voce a chi usa uno screen reader, e dai motori di ricerca.",
      featuredImageHelp: "L\u2019immagine in cima all\u2019articolo, e quella mostrata quando viene condiviso.",
      factsOnePerLine: "Uno per riga. Sono gli unici dati precisi che affermeremo sulla sua attività; tutto il resto resta generico.",
      voiceBehindArticles: "La voce dietro ogni articolo. Integrata dal suo pannello, così un solo Salva copre tutta la schermata.",
      creditsExplainer: "I crediti vengono aggiunti al suo account e possono essere spesi per la creazione di link. Non sono denaro e non sono prelevabili. Un invito conta quando la persona invitata paga il primo mese, e si possono invitare solo account nuovi, ognuno una sola volta.",
      articleInProgress: "Questo articolo non può più essere riprogrammato né modificato perché è in lavorazione.",
      researchIntro: "Troveremo i termini che usano i suoi clienti, li raggrupperemo per argomenti e ne faremo un piano di articoli da pubblicare.",
      noCreditsLeft: "Crediti esauriti. Includa un link perché qualcun altro ne guadagni uno, oppure attenda la quota del mese prossimo.",
      promoCodesHelp: "I codici promozionali si inseriscono al pagamento con carta. PayPal non supporta i codici sconto.",
      write: "Scrivi",
      writingAndPublishing: "Scrittura e pubblicazione",
      featuredImage: "Immagine in evidenza",
      backlinksLabel: "Link in entrata",
      uploadLabel: "Carica",
      aiAssistantsTracked: "Assistenti IA monitorati",
      freshArticles: "Articoli nuovi",
      toSetUp: "Da configurare",
      trustedByBusinesses: "La fiducia di attività in tutto il mondo",
      weekly: "Ogni settimana",
      twoMinutes: "2 min",
      notAvailable: "Questa pagina non è disponibile",
      notAvailableHelp: "La pagina potrebbe essere stata spostata, oppure appartiene a uno spazio di lavoro di cui non fa parte.",
      backToDashboard: "Torna alla dashboard",
      viewWebsites: "Vedi i suoi siti",
      goToDashboard: "Vai alla dashboard",
      setUp: "Configura",
      setUpHelp: "La guidiamo passo dopo passo nel percorso di avvio.",
      manageBilling: "Gestisci fatturazione",
      manageInPayPal: "Gestisci in PayPal",
      payWithPayPal: "Paga con PayPal",
      noPlans: "Ancora nessun piano disponibile.",
      billingHistory: "Cronologia di fatturazione",
      billingHistoryHelp: "Tutti i pagamenti di abbonamento di questo spazio di lavoro.",
      invoice: "Fattura",
      downloadPlugin: "Scarica il plugin",
      pluginGuide: "Guida all’installazione",
      cantFindIntegration: "Non trova la sua integrazione?",
      adaptive: "Adattiva",
      custom: "Personalizzata",
      wordRange: "Tra 300 e 5.000.",
      findOpportunities: "Trova opportunità",
      noOpportunities: "Ancora nessuna opportunità trovata",
      losingTraffic: "Traffico in calo",
      notWrittenHere: "Non scritto qui",
      nothingLosing: "Nulla sta perdendo traffico",
      nothingLosingHelp: "Nessuna pagina ha perso il 30% o più dei clic e nessuna è scesa su Google. Le pagine con meno di 10 clic al mese vengono controllate in base alla posizione.",
      losingClicksTitle: "Perdono clic",
      losingClicksHelp: "Hanno perso il 30% o più dei clic, partendo da almeno 10 nei 28 giorni precedenti.",
      losingVisibilityTitle: "Perdono visibilità",
      losingVisibilityHelp: "Sono scese di 3 o più posizioni su Google, o sono comparse in metà delle ricerche. Controllato per le pagine mostrate almeno 100 volte, così anche quelle con pochi clic restano sotto controllo.",
      watchTitle: "Da tenere d’occhio",
      watchHelp: "Tra il 10 e il 30% di clic in meno. Non ancora un calo netto.",
      noClickLosses: "Nessuna pagina ha perso il 30% o più dei clic.",
      clicksChange: "{before} → {after} clic",
      percentDown: "in calo del {pct}%",
      percentUp: "in crescita del {pct}%",
      rankingChange: "posizione {before} → {after}",
      shownChange: "mostrata {before} → {after} volte",
      windowNote: "Gli ultimi 28 giorni pubblicati da Google, fino al {date}, rispetto ai 28 precedenti.",
      writeAutomatically: "Scrivi articoli automaticamente",
      daysToWrite: "Giorni in cui scrivere",
      publishWithoutAsking: "Pubblica senza chiedermelo",
      whenFinished: "Quando un articolo è pronto",
      finishedReview: "Tenerlo in RepGet per rivederlo",
      finishedReviewHelp: "Nulla arriva sul suo sito finché non preme Pubblica sull’articolo.",
      finishedDraft: "Inviarlo al mio sito come bozza",
      finishedDraftHelp: "Compare come bozza nel suo CMS nel giorno previsto. Lo pubblica lei da lì.",
      finishedLive: "Pubblicarlo nel giorno previsto",
      finishedLiveHelp: "Va online sul suo sito nel giorno previsto, senza che debba fare nulla.",
      firstArticleNote: "Il suo primo articolo viene inviato appena è pronto, qualunque sia la scelta, così vede come appaiono gli articoli sul suo sito. Finché il sito fa parte della Rete partner, il team RepGet controlla prima ogni articolo - anche il primo - e nessuno esce prima del giorno previsto.",
    },
    nav: {
      dashboard: "Dashboard",
      setUp: "Configurazione",
      plannedArticles: "Articoli pianificati",
      backlinkExchange: "Rete di link",
      websiteHealth: "Salute del sito",
      googleResults: "Risultati Google",
      googleConnect: "Google Search e Analytics",
      aiVisibility: "Visibilità nell\u2019IA",
      losingTraffic: "Traffico in calo",
      settings: "Impostazioni",
      addons: "Componenti aggiuntivi",
      main: "Principale",
      referralProgram: "Programma inviti",
      business: "Attività",
      articleSettings: "Impostazioni articoli",
      integrations: "Integrazioni",
      account: "Account",
      billing: "Fatturazione",
      settingsSections: "Sezioni delle impostazioni",
    },
    status: {
      pending: "In attesa di iniziare",
      crawling: "Lettura del suo sito",
      researching: "Ricerca di opportunità",
      generated: "Contenuti pianificati",
      ready: "Pronto",
      queued: "In coda",
      running: "In corso",
      completed: "Completato",
      planned: "Pianificato",
      draft: "Bozza",
      generating: "Scrittura",
      published: "Pubblicato",
      publish: "Pubblicazione",
      scheduled: "Programmato",
      connected: "Collegato",
      disconnected: "Non collegato",
      live: "Attivo",
      removed: "Rimosso",
      matched: "Abbinato",
      active: "Attivo",
      inactive: "Inattivo",
      cancelled: "Annullato",
      expired: "Scaduto",
      paid: "Pagato",
      rewarded: "Premiato",
      refunded: "Rimborsato",
      fulfilled: "Consegnato",
      failed: "Richiede attenzione",
      rejected: "Rifiutato",
      missing: "Mancante",
    },
    editorUi: {
      bold: "Grassetto",
      italic: "Corsivo",
      strikethrough: "Barrato",
      heading: "Titolo",
      subheading: "Sottotitolo",
      bulletedList: "Elenco puntato",
      numberedList: "Elenco numerato",
      quote: "Citazione",
      code: "Codice",
      addLink: "Aggiungi link",
      removeLink: "Rimuovi link",
      insertImage: "Inserisci immagine",
      undo: "Annulla",
      redo: "Ripristina",
      chooseImage: "Scelga un\u2019immagine",
      articleHtml: "HTML dell\u2019articolo",
      noImageSelected: "Nessuna immagine selezionata",
      pickOneBelow: "Ne scelga una qui sotto o carichi la sua.",
      closeImagePicker: "Chiudi il selettore di immagini",
      imageAlt: "Descrizione dell\u2019immagine (testo alternativo)",
      imageAltPlaceholder: "Che cosa mostra l\u2019immagine",
      replaceImage: "Sostituisci immagine",
      saveImage: "Salva",
      toolbarLabel: "Formattazione del testo",
      groupText: "Stile del testo",
      groupHeadings: "Titoli",
      groupBlocks: "Elenchi e blocchi",
      groupLinks: "Link",
      groupMedia: "Immagini",
      groupHistory: "Annulla e ripeti",
      linkDialogTitle: "Aggiungi o modifica un link",
      linkDialogHelp: "Incolli l’indirizzo completo, per esempio https://example.com/pagina.",
      linkUrlLabel: "Indirizzo del link",
      linkApply: "Applica",
      linkInvalid: "Inserisca un indirizzo che inizi con https://, http://, mailto:, tel:, / o #.",
      htmlHint: "Sta modificando direttamente l’HTML. Tutto ciò che non è sicuro viene rimosso al salvataggio.",
      richHint: "La formattazione resta semplice per adattarsi allo stile del suo sito.",
      editHtml: "Modifica HTML",
      backToEditor: "Torna all’editor",
      htmlToolbarOff: "I pulsanti di formattazione sono disattivati mentre modifica l’HTML.",
      noMatches: "Nessun risultato.",
      noPicturesYet: "Ancora nessuna immagine: ne carichi una per iniziare.",
    },
    dash: {
      bestArticles: "Articoli migliori",
      bestArticlesHelp: "Le sue pagine che portano più persone da Google.",
      openGoogleResults: "Apri i risultati Google",
      connectForPages: "Colleghi Google Search Console per vedere quali sue pagine trovano le persone.",
      clicks: "Clic",
      impressions: "Impressioni",
      position: "Posizione",
      searchPerformance: "Rendimento nella ricerca",
      websiteTraffic: "Traffico del sito",
      aiSearchTraffic: "Traffico da ricerche IA",
      googleTraffic: "Traffico da Google",
      vsLastMonth: "rispetto al mese scorso",
      averagePosition: "Posizione media",
      connectForClicks: "Colleghi Google Search Console per vedere clic, impressioni e posizione.",
      achievements: "Risultati",
      achievementsHelp: "Tutto questo è avvenuto automaticamente da quando si è iscritto.",
      last30Days: "Ultimi 30 giorni",
      adSpendSaved: "Spesa pubblicitaria risparmiata",
      adSpendHelp: "Quanto costerebbe questo traffico in Google Ads.",
      backlinkCostSaved: "Costo dei link risparmiato",
      showedUpHelp: "Quante volte è comparso su Google.",
      visitorsFromArticles: "Visitatori dagli articoli",
      siteHealth: "La salute del suo sito",
      siteHealthHelp: "Su 100, secondo il suo ultimo controllo.",
      websiteAuthority: "Autorevolezza del sito",
      backlinks: "Link in entrata",
      openBacklinks: "Apri i link",
      backlinkExchange: "Rete di link",
      getCredits: "Ottieni crediti",
      verifiedBacklinks: "Link verificati",
      availableCredits: "Crediti disponibili",
      noLinksYet: "Ancora nessun link. Quando altri siti della rete collegheranno il suo, compariranno qui.",
      todaysArticle: "L\u2019articolo di oggi",
      nothingWrittenYet: "Ancora nulla di scritto. Una volta pronto il piano dei contenuti, l\u2019articolo di oggi comparirà qui.",
      openContentPlan: "Apri il piano dei contenuti",
      searchVolume: "Volume di ricerca",
      difficulty: "Difficoltà",
      articleType: "Tipo di articolo",
      whyThisTopic: "Perché questo argomento?",
      view: "Vedi",
      addAWebsite: "Aggiungi un sito",
      sharedWithYou: "Condivisi con lei",
      sharedSiteLabel: "Condiviso con lei · {role}",
      roleEditor: "Editor",
      roleViewer: "Lettore",
    },
    wpConnect: {
      title: "Collega WordPress",
      signedInAs: "Accesso effettuato come {email}",
      goneTitle: "Questo collegamento è terminato",
      goneBody: "È scaduto, è stato annullato o è già stato usato. Torni in WordPress e prema di nuovo Connect to RepGet.",
      otherBrowserTitle: "Questo collegamento è stato aperto altrove",
      otherBrowserBody: "Per la Sua sicurezza, un collegamento può essere completato solo nel browser che lo ha aperto per primo. Torni in WordPress e prema di nuovo Connect to RepGet.",
      noneTitle: "{domain} non è ancora in questo account RepGet",
      noneBody: "Aggiunga prima {domain} come sito, poi prema di nuovo Connect to RepGet in WordPress. Se si trova in un altro account RepGet, acceda a quello. Se WordPress funziona a un indirizzo diverso da quello del Suo sito in RepGet (per esempio blog.example.com), lo colleghi con una chiave: in RepGet apra Integrazioni → Plugin WordPress → Chiavi (avanzate) → Nuova chiave, e la incolli in WordPress sotto Advanced: use an Integration Key.",
      addWebsite: "Aggiungi un sito",
      useOtherAccount: "Usa un altro account",
      confirmTitle: "Collegare {domain} a RepGet?",
      confirmBody: "Il sito WordPress {site} pubblicherà gli articoli che RepGet scrive per il sito qui sotto. Può scollegarlo in qualsiasi momento da WordPress.",
      inWorkspace: "Area di lavoro “{workspace}”",
      movedWarning: "Questo sito WordPress è collegato a un altro account RepGet. Se continua, quell’account smetterà di pubblicare qui.",
      movedWarningNamed: "Questo sito WordPress è collegato a {domain} nell’area di lavoro “{workspace}”. Se continua, quel sito smetterà di pubblicare qui.",
      connect: "Collega {domain}",
      connectAgain: "Ricollega {domain}",
      move: "Sposta {domain} in “{workspace}”",
      cancel: "Annulla",
      tooManyKeys: "Questo sito ha già 5 chiavi. Revochi una che non usa più in Integrazioni → Chiavi (avanzate), poi riprovi.",
      notAllowed: "Con questo account non può collegare WordPress a quel sito.",
    },
    auth: {
      redirecting: "Reindirizzamento…",
      continueWithGoogle: "Continua con Google",
      orContinueWithEmail: "Oppure continua con l\u2019e-mail",
      fullName: "Nome completo",
      namePlaceholder: "Mario Rossi",
      email: "E-mail",
      emailPlaceholder: "lei@esempio.com",
      password: "Password",
      passwordHint: "Almeno 8 caratteri.",
      tooManyAttempts: "Troppi tentativi. Attenda qualche minuto e riprovi.",
      passwordTooLong: "Usi al massimo 128 caratteri.",
      emailMeACode: "Inviatemi un codice via e-mail",
      usePasswordInstead: "Usa una password",
      sendCode: "Inviami un codice",
      sendingCode: "Invio del codice…",
      codeLabel: "Codice di accesso",
      codePlaceholder: "123456",
      codeHelp: "Abbiamo inviato un codice di sei cifre a {email}. Scade tra 10 minuti.",
      verifyCode: "Accedi",
      verifying: "Verifica del codice…",
      resendCode: "Invia un altro codice",
      useDifferentEmail: "Usa un\u2019altra e-mail",
      codeSent: "Controlli la sua e-mail per il codice.",
      codeNotSent: "Non è stato possibile inviare il codice. Riprovi.",
      codeInvalid: "Il codice non è corretto o è scaduto.",
      enterEmailFirst: "Inserisca prima il suo indirizzo e-mail.",
      organizations: "Organizzazioni",
      loading: "Caricamento…",
      createOrganization: "Crea organizzazione",
      orgHelp: "Ogni organizzazione ha i propri siti, contenuti e fatturazione.",
      name: "Nome",
      orgPlaceholder: "Acme Marketing",
      cancel: "Annulla",
      notifications: "Notifiche",
      markAllRead: "Segna tutto come letto",
      nothingYet: "Ancora nulla. La avviseremo qui quando i suoi articoli e audit saranno pronti.",
      unread: "Non letto",
    },
    onboarding: {
      whatsYourWebsite: "Qual è il suo sito web?",
      websiteIntro: "Inserisca il suo sito e capiremo di cosa si occupa la sua attività, a chi si rivolge e per cosa dovrebbe posizionarsi.",
      websiteAddress: "L\u2019indirizzo del suo sito",
      websitePlaceholder: "lasuaattivita.com",
      lookUpWebsite: "Analizza questo sito",
      detected: "Rilevato",
      addingWebsite: "Aggiunta del suo sito…",
      continueLabel: "Continua",
      pressArrow: "Prema la freccia per controllare prima il suo sito, oppure continui subito.",
      readingWebsite: "Lettura del suo sito…",
      websiteFound: "Sito trovato",
      enterAddressToSee: "Inserisca il suo indirizzo per vedere che cosa troviamo.",
      regionNext: "Poi regione e categoria",
      weWillUseWebsite: "Useremo il suo sito per capire la sua attività.",
      activateRepGet: "Attiva RepGet",
      seeHowAiTalks: "Veda come l\u2019IA parla del suo marchio",
      trackQuestions: "Monitori le domande che i clienti pongono all\u2019IA prima di scoprire la sua azienda.",
      trackingOn: "Monitoraggio attivo",
      noAssistants: "Su questa installazione non è ancora configurato alcun assistente. Le domande vengono salvate e controllate appena ce ne sarà uno.",
      questionsWorthTracking: "Domande che vale la pena monitorare",
      suggestedFromSite: "Le abbiamo suggerite dal suo sito e dal suo mercato. Rimuova quelle che non le sembrano adatte.",
      writingQuestions: "Stiamo scrivendo le domande che porrebbero i suoi clienti…",
      noQuestionsYet: "Ancora nessuna domanda. Ne aggiunga una qui sotto o chieda dei suggerimenti.",
      addQuestionPlaceholder: "Aggiunga una domanda che porrebbero i suoi clienti",
      addQuestion: "Aggiungi domanda",
      writing: "Scrittura…",
      suggestMore: "Suggerisci altre",
      getStarted: "Inizia",
      setupProgress: "Avanzamento della configurazione",
      readingNow: "Stiamo leggendo il suo sito. Di solito ci vogliono uno o due minuti.",
      view: "Vedi",
      goToDashboard: "Vai alla sua dashboard",
      searchOpportunities: "Opportunità di ricerca",
      topicClusters: "Gruppi di argomenti",
      publishingPlan: "Piano di pubblicazione",
      articlesContentBacklinks: "Articoli, contenuti e link",
      heresWhatWellBuild: "Ecco che cosa costruiremo",
      thenOnChecklist: "Poi, nella sua lista di configurazione",
      buildMyPlan: "Crea il mio piano dei contenuti",
      starting: "Avvio…",
      takesFewMinutes: "Ci vogliono alcuni minuti. Può continuare mentre lo prepariamo in background.",
      connectGoogle: "Collega Google",
      analyticsTellUs: "Analytics e Search Console ci dicono quali articoli funzionano, così ne scriviamo di più.",
      connectedChangeLater: "Collegato. Potrà cambiarlo più avanti in Integrazioni.",
      openingGoogle: "Apertura di Google…",
      whyWeAsk: "Perché glielo chiediamo",
      readPerformanceOnly: "Leggiamo solo i dati di rendimento: clic, impressioni e sessioni del suo sito. Non pubblichiamo, modifichiamo né cancelliamo nulla nel suo account Google, e può scollegarlo quando vuole.",
      connected: "Collegato",
      plansUnavailable: "I piani non sono disponibili al momento. Riprovi tra poco.",
      growthEngineReady: "Il suo motore di crescita è pronto",
      plan: "Piano",
      payYearly: "Pagamento annuale",
      paypalNoTrial: "PayPal avvia subito il suo piano, senza la prova gratuita.",
      cancelAnyTime: "Disdica quando vuole. Al pagamento può inserire un codice promozionale.",
      whatsIncluded: "Che cosa include",
      secureByStripe: "Pagamento sicuro con Stripe. I dati della sua carta non arrivano mai a noi.",
      paymentTakingLonger: "Il pagamento è andato a buon fine. L\u2019attivazione del piano sta richiedendo più del solito.",
      activatingNow: "Grazie. Stiamo attivando il suo piano; di solito ci vogliono pochi secondi.",
      goToMyWebsite: "Vai al mio sito",
      checkBilling: "Vedi la fatturazione",
      extraordinaryBusinesses: "Le attività straordinarie meritano più visibilità.",
      chooseYourPlan: "Scelga il suo piano",
      whatHappensSubscribe: "Che cosa succede appena si abbona",
      weResearchKeywords: "Studiamo le sue parole chiave, costruiamo un calendario di contenuti su misura per il suo piano e iniziamo a scrivere. Poco dopo avrà il primo articolo da rivedere.",
      contentAndBacklinks: "Contenuti e link",
      addYourWebsite: "Aggiunga il suo sito",
    },
  },
};

const de: Messages = {
  nav: {
    howItWorks: "So funktioniert es",
    freeCheck: "Kostenlose Analyse",
    tools: "Werkzeuge",
    pricing: "Preise",
    blog: "Blog",
    faq: "Häufige Fragen",
    about: "Über uns",
    signIn: "Anmelden",
    getStarted: "Loslegen",
    contact: "Kontakt",
    successStories: "Erfolgsgeschichten",
    getStartedCta: "Loslegen",
    platform: "Plattform",
    platformHeading: "Plattform entdecken",
    platformItems: [
      {
        title: "Content-Engine",
        detail:
          "Planen und erstellen Sie Artikel, die die organische Sichtbarkeit steigern.",
      },
      {
        title: "Authority-Netzwerk",
        detail:
          "Gewinnen Sie relevante Backlinks und stärken Sie Ihre Domain-Autorität.",
      },
      {
        title: "Site-Intelligence",
        detail:
          "Finden Sie technische und SEO-Probleme, die Ihre Leistung beeinträchtigen.",
      },
      {
        title: "Suchleistung",
        detail:
          "Verfolgen Sie Rankings, Sichtbarkeit und Ergebnisse bei Google.",
      },
      {
        title: "KI-Präsenz",
        detail:
          "Sehen Sie, wie oft Ihre Marke in ChatGPT, Claude, Perplexity und der KI-Suche erscheint.",
      },
      {
        title: "Traffic-Rückgewinnung",
        detail:
          "Erkennen Sie fallende Seiten, bevor wertvoller Traffic verschwindet.",
      },
    ],
  },
  footer: {
    tagline: "SEO-Ergebnisse für kleine Unternehmen, ohne Agentur.",
    product: "Produkt",
    legal: "Rechtliches",
    freeCheck: "Kostenlose Website-Analyse",
    freeTools: "Kostenlose Werkzeuge",
    pricing: "Preise",
    blog: "Blog",
    faq: "Häufige Fragen",
    about: "Über uns",
    contact: "Kontakt",
    backlinkExchange: "Linktausch",
    publishers: "Monetarisieren Sie Ihren Blog",
    affiliate: "Unternehmen empfehlen",
    privacy: "Datenschutz",
    terms: "AGB",
    refunds: "Rückerstattungen",
  },
  home: {
    eyebrow: "Ranken. Zitiert werden. Empfohlen werden.",
    title: "Bei Google ranken. In KI-Antworten erscheinen",
    subtitle:
      "RepGet veröffentlicht SEO-Inhalte, gewinnt hochwertige Backlinks und baut die Autorität auf, durch die Ihr Unternehmen gefunden wird.",
    checkFree: "Website kostenlos prüfen",
    getStarted: "Loslegen",
    noCard: "Für die erste Prüfung ist keine Karte nötig.",
    auditBand: "Kostenlos zu Ihrer Analyse",
    auditItems: [
      {
        title: "SEO- und KI-Analyse",
        body: "Sehen Sie den Zustand Ihrer Website, was fehlt und ob KI-Assistenten Sie nennen.",
      },
      {
        title: "Ein Plan zum Handeln",
        body: "Die konkreten Änderungen, die sich lohnen - in der Reihenfolge, in der sie sinnvoll sind.",
      },
      {
        title: "Ihr erster Backlink",
        body: "Ein Link von einem echten Unternehmen aus einer verwandten Branche, verdient statt gekauft.",
      },
    ],
    auditPlaceholder: "Ihre Website eingeben",
    auditAssurances: ["Kein Konto nötig", "Nichts zu kündigen"],
    checkMyWebsite: "Website prüfen",
    howItWorks: "So funktioniert es",
    steps: [
      {
        title: "Analyse",
        body: "Wir lesen Ihre Website, finden heraus, was sie bremst, und prüfen, ob KI-Assistenten sie nennen.",
      },
      {
        title: "Verbinden",
        body: "Verbinden Sie Ihre Website - WordPress, Ghost, Shopify oder einen Webhook - damit wir für Sie veröffentlichen.",
      },
      {
        title: "Wachsen",
        body: "Wir recherchieren, schreiben und veröffentlichen und zeigen Ihnen, was sich wirklich verändert hat.",
      },
    ],
    problemsEyebrow: "Probleme und Lösung",
    yourProblem: "Ihr Problem",
    ourSolution: "Unsere Lösung",
    problems: [
      "Bezahlte Anzeigen verbrauchen jeden Monat Ihr Budget - und hören auf, sobald Sie aufhören.",
      "Stunden, die zwischen Analysen, Keywords, Inhalten und einem Stapel einzelner Tools verloren gehen.",
      "KI-Assistenten empfehlen Ihre Wettbewerber, und Sie erfahren es nie.",
    ],
    solutionTitle: "Alles, was Sie brauchen, an einem Ort",
    solution: [
      "Vollständige SEO- und KI-Analyse",
      "Sichtbarkeitsverfolgung in KI-Assistenten",
      "Keyword- und Marktrecherche",
      "Artikel, die für Sie geschrieben und automatisch veröffentlicht werden",
      "Backlinks von echten Unternehmen",
    ],
    stackEyebrow: "Wir gegen einen Stapel von Tools",
    stackTitle: "Ein Abo ersetzt",
    stackTitleAccent: "Ihr gesamtes SEO-Werkzeug",
    stackSub:
      "Analyse, KI-Sichtbarkeit, Recherche, Inhalte, Veröffentlichung, Backlinks und Berichte - an einem Ort und günstiger als die Tools einzeln.",
    seePricing: "Preise ansehen",
    replaces: [
      "SEO-Analyse und Website-Crawl",
      "KI-Sichtbarkeitsverfolgung",
      "Keyword- und Marktrecherche",
      "Geschriebene, optimierte Artikel",
      "Veröffentlichung in Ihrem CMS",
      "Backlink-Aufbau",
      "Berichte aus Search Console und Analytics",
    ],
    publishesTitle: "Veröffentlicht",
    publishesAccent: "direkt",
    publishesTitleEnd: "auf Ihrer Website",
    publishesSub:
      "Einmal verbinden. Kein manuelles Hochladen, kein Kopieren und Einfügen - Artikel erscheinen von selbst auf Ihrer Website, mit Bildern.",
    publishesPlugin:
      "Unser WordPress-Plugin verbindet sich mit einem einzigen Schlüssel und funktioniert auch dann, wenn Ihr Hoster die WordPress-API blockiert.",
    platformOther: "Jede Website per Webhook",
    trackedTitle: "Sie sehen genau, was sich verändert hat",
    trackedSub:
      "Kein monatliches PDF. Ein Dashboard, das Ihre eigenen Daten aus Search Console und Analytics liest.",
    tracked: [
      { label: "Positionen und Klicks", detail: "Aus der Search Console" },
      { label: "KI-Sichtbarkeit", detail: "Ob Assistenten Sie nennen" },
      { label: "Erhaltene Backlinks", detail: "Täglich geprüft" },
      {
        label: "Veröffentlichte Artikel",
        detail: "Und was sie gebracht haben",
      },
    ],
    pillars: [
      {
        title: "SEO-Inhalte veröffentlichen",
        body: "Hochwertige Artikel, erstellt und optimiert für Ihre Branche.",
      },
      {
        title: "Echte Backlinks aufbauen",
        body: "Werden Sie auf relevanten Websites zitiert und gewinnen Sie Autorität.",
      },
      {
        title: "Fortschritt verfolgen",
        body: "Rankings, Traffic und Ergebnisse in einem einfachen Dashboard.",
      },
      {
        title: "Zeit sparen mit KI",
        body: "Die KI übernimmt die Arbeit, Sie konzentrieren sich auf Ihr Geschäft.",
      },
    ],
    previewTitle: "Ihr Wachstum, auf Autopilot.",
    previewSub: "Hochwertige Inhalte. Echte Backlinks. Mehr Sichtbarkeit.",
    previewCaption:
      "Ein Beispiel-Dashboard. Ihre eigenen Zahlen starten bei null.",
    titleLead: "Bei Google ranken.",
    titleAccent: "In KI-Antworten erscheinen.",
    heroCards: [
      { label: "Positionen und Klicks", detail: "Aus der Search Console" },
      { label: "KI-Sichtbarkeit", detail: "Ob Assistenten Sie nennen" },
      { label: "Traffic-Wachstum", detail: "Mehr Kunden erreichen" },
      { label: "Sichtbar in KI-Antworten", detail: "Dort, wo es zählt" },
      { label: "Hochwertige Backlinks", detail: "Von echten Websites zitiert" },
      { label: "Keyword-Tracking", detail: "Sehen, was funktioniert" },
    ],
    joinGoogle: "Mit Google beitreten",
    seeHow: "So funktioniert es",
    videoTitle: "RepGet in zwei Minuten",
    videoSub:
      "Ein kurzer Rundgang durch das, was nach dem Verbinden einer Website passiert.",
    videoComingSoon:
      "Das Erklärvideo wird gerade aufgenommen. Bis dahin zeigt Ihnen die kostenlose Prüfung dasselbe an Ihrer eigenen Website.",
    worksWithTitle: "Funktioniert mit den Tools, die Sie schon nutzen",
    networkEyebrow: "Ein geprüftes Backlink-Netzwerk",
    networkTitle: "Ein Backlink-Netzwerk,",
    networkTitleRest: "das mit jedem neuen Kunden stärker wird.",
    networkHeading: "Automatischer Linktausch",
    networkPoints: [
      "Jeder Kunde gibt und erhält Links",
      "Links kommen aus verwandten Branchen, nie aus fremden",
      "Platziert in echten Artikeln, nicht auf einer Linkseite",
      "Täglich geprüft - wird ein Link entfernt, sagen Sie uns Bescheid und Sie erhalten Ihr Guthaben zurück",
    ],
    networkHowLink: "So funktioniert der Tausch",
    pricingEyebrow: "Preise",
    pricingTitle: "Klein anfangen.",
    pricingTitleAccent: "Wachsen, wenn Sie so weit sind.",
    pricingSub:
      "Eine kostenlose Prüfung zum Start, kein Vertrag, jederzeit kündbar.",
    seeAllPlans: "Alle Leistungen jedes Tarifs ansehen",
    mostPopular: "Am beliebtesten",
    tryItFirst: "Erst ausprobieren",
    getStartedPlan: "Loslegen",
    perMonth: " / Monat",
    unavailable:
      "Die Preise sind derzeit nicht verfügbar. Bitte versuchen Sie es in Kürze erneut.",
    planArticles: "{n} Artikel pro Monat|{n} Artikel pro Monat",
    planBacklinks: "Backlinks aus unserem Partnernetzwerk",
    planPublishing:
      "Automatisch veröffentlichen auf WordPress, Shopify und mehr",
    closingTitle: "Starten Sie heute Ihr Wachstum auf Autopilot",
    closingSub:
      "Prüfen Sie Ihre Website kostenlos und sehen Sie, was sie bremst. Ohne Konto.",
    cancelAnytime: "Jederzeit kündbar",
    guarantee: "14 Tage Geld-zurück-Garantie",
  },
  pricing: {
    title: "Einfache Preise",
    subtitle:
      "In jedem Tarif ist alles enthalten. Der Unterschied liegt darin, wie viel wir jeden Monat für Sie schreiben und wie viele Backlinks Sie aus unserem Partnernetzwerk erhalten.",
    perMonth: " / Monat",
    getStarted: "Loslegen",
    mostPopular: "Am beliebtesten",
    tryItFirst: "Erst ausprobieren",
    starterTagline:
      "Testen Sie uns mit einem echten Artikel und einem echten Backlink, bevor Sie aufsteigen.",
    unavailable:
      "Die Preise sind derzeit nicht verfügbar. Bitte versuchen Sie es in Kürze erneut.",
    annualNote:
      "Jahrestarife sind nach der Anmeldung verfügbar, mit zwei Freimonaten. Jederzeit kündbar - siehe unsere",
    refundPolicy: "Rückerstattungsrichtlinie",
    features: {
      articles: "{n} Artikel pro Monat geschrieben|{n} Artikel pro Monat geschrieben",
      keywords: "{n} Suchbegriffe überwacht",
      backlinks: "Backlinks aus unserem Partnernetzwerk",
      audit: "Website-Audit, damit Ihre Seiten KI- und Google-bereit sind",
      healthChecks: "Website-Gesundheitschecks",
      publishing: "Veröffentlichen auf WordPress, Ghost oder Shopify",
    },
  },
  about: {
    metaTitle: "Über uns",
    metaDescription:
      "Warum es RepGet gibt und für wen es gedacht ist.",
    title: "SEO-Ergebnisse ohne Agentur",
    intro: [
      'Eine Zahnarztpraxis, ein Installateur oder eine kleine Kanzlei weiß, dass sie "SEO machen" sollte. Nötig sind dafür in Wirklichkeit jemand für die Keyword-Recherche, jemand zum Schreiben, jemand mit Verständnis für technische Audits und jemand, der Links besorgt. Eine Agentur bündelt all das für einige tausend im Monat.',
      "Die meisten kleinen Unternehmen können diese Ausgabe nicht rechtfertigen. Also tun sie nichts und bleiben genau bei den Suchanfragen unsichtbar, die ihnen Kunden bringen würden.",
      "Wir haben dies gebaut, um diese Arbeit automatisch zu erledigen - zu einem Preis, den ein kleines Unternehmen tatsächlich zahlen kann.",
    ],
    beliefTitle: "Woran wir glauben",
    beliefLead: "Nur empfehlen, was realistisch zu gewinnen ist.",
    belief: [
      "Ein Suchbegriff mit 12.000 Anfragen im Monat nützt Ihnen nichts, wenn Sie keine Chance auf eine gute Platzierung haben. Einer mit 300 Anfragen, von jemandem mit Kaufabsicht, kann Ihnen nächsten Monat einen Kunden bringen.",
      "Dieses Prinzip steckt im Produkt, nicht nur in diesem Text. Unsere Bewertung stellt erreichbare Begriffe bewusst über beliebte und wägt ab, ob die suchende Person wirklich kaufen will. Unsere Link-Zuordnung verweigert die Verbindung einer Zahnarztpraxis mit einer thematisch fremden Website, auch wenn die Zahlen gut aussehen.",
      "Ein Werkzeug, das beeindruckende Arbeit produziert, die niemand je findet, ist schlimmer als nutzlos: Es kostet Geld und liefert nichts.",
    ],
    audienceTitle: "Für wen es gedacht ist",
    audience:
      'Für kleine und lokale Unternehmen, die Kunden brauchen, keine Dashboards. Sie sollten nie lernen müssen, was "Keyword-Schwierigkeit" bedeutet. Wir übernehmen die Einschätzung; Sie sehen einen Plan, die Artikel und was sich verändert hat.',
  },
  successStories: {
    metaTitle: "Erfolgsgeschichten",
    metaDescription:
      "Was RepGet-Kunden messen: Rankings, KI-Sichtbarkeit, veröffentlichte Artikel und gewonnene Backlinks - und wann die ersten Ergebnisse kommen.",
    eyebrow: "Erfolgsgeschichten",
    title:
      "Wir zeigen Ihnen lieber, was wir messen, als einen Kunden zu erfinden.",
    intro:
      "RepGet ist neu, und wir erfinden weder ein Unternehmen, das es eingesetzt hätte, noch runden wir die Zahlen von jemandem für eine Verkaufsseite auf. Hier steht, was das Produkt tatsächlich misst und wie die ersten Monate ehrlich aussehen.",
    results: [
      {
        label: "Rankings und Klicks",
        body: "Aus Ihrer eigenen Search Console, nicht geschätzt. Sie sehen, bei welchen Suchanfragen Sie gestiegen sind und was das an Klicks gebracht hat.",
      },
      {
        label: "KI-Sichtbarkeit",
        body: "Ob ChatGPT, Claude und Perplexity Ihr Unternehmen nennen, wenn jemand nach dem fragt, was Sie anbieten. Geprüft anhand Ihrer eigenen Fragen.",
      },
      {
        label: "Veröffentlichte Artikel",
        body: "Was geschrieben wurde, wann es erschien und was es bewirkt hat - damit ein Monat Arbeit eine Antwort hat und nicht nur eine Rechnung.",
      },
      {
        label: "Gewonnene Backlinks",
        body: "Echte Links in echten Artikeln auf Websites anderer Unternehmen, täglich geprüft. Wird einer entfernt, sagen Sie uns Bescheid und Sie bekommen Ihr Guthaben zurück.",
      },
    ],
    timelineTitle: "Wie die ersten drei Monate aussehen",
    timelineIntro:
      "Ehrlich, einschließlich des Teils, in dem noch nichts passiert ist.",
    timeline: [
      {
        when: "Woche eins",
        body: "Wir crawlen die Website, finden die technischen Probleme, die sie ausbremsen, und planen einen Monat Artikel rund um das, wonach Ihre Kunden wirklich suchen.",
      },
      {
        when: "Woche zwei bis vier",
        body: "Die Artikel erscheinen nach Ihrem Zeitplan. Backlinks werden gesetzt, sobald andere Unternehmen im Netzwerk ihre Artikel veröffentlichen.",
      },
      {
        when: "Ab dem zweiten Monat",
        body: "Die Search-Console-Daten der ersten Artikel treffen ein. Jetzt bewegen sich die Rankings - SEO zahlt sich nicht in Woche eins aus, und wer das verspricht, verkauft etwas anderes.",
      },
    ],
    ctaTitle: "Werden Sie die erste Geschichte auf dieser Seite.",
    ctaBody:
      "Starten Sie mit einer kostenlosen Prüfung Ihrer Website - eine Minute, kostenlos. Wenn sich das Ergebnis lohnt, können neue Konten RepGet {days} Tage kostenlos testen.",
    ctaPrimary: "Website prüfen",
    ctaSecondary: "Preise ansehen",
  },
  publishers: {
    metaTitle: "Monetarisieren Sie Ihren Blog",
    metaDescription:
      "Veröffentlichen Sie einen Artikel pro Monat für ein Unternehmen aus einer verwandten Branche und verdienen Sie Link-Guthaben für Backlinks auf Ihre eigene Website.",
    title: "Monetarisieren Sie Ihren Blog",
    intro:
      "Veröffentlichen Sie einen Artikel pro Monat für ein Unternehmen aus einer verwandten Branche und verdienen Sie Guthaben für Links auf Ihre eigene Website.",
    creditsTitle: "Guthaben, kein Geld",
    creditsBody:
      "Sie werden in Link-Guthaben vergütet, nicht in Geld. Ein veröffentlichter Artikel bringt ein Guthaben, und ein Guthaben verschafft Ihnen einen Link von der Website eines anderen Unternehmens. Wenn Sie Geld für Gastbeiträge suchen, ist das hier nicht das Richtige - dafür gibt es Marktplätze.",
    steps: [
      {
        title: "Sagen Sie uns, worum es auf Ihrer Website geht",
        body: "Thema, Sprache und Land. Wir bringen Sie nur mit Unternehmen aus einer verwandten Branche zusammen.",
      },
      {
        title: "Legen Sie fest, wie viele Artikel pro Monat",
        body: "Bis zu zwanzig, die meisten starten mit drei. Sie können jederzeit pausieren oder aufhören.",
      },
      {
        title: "Wir schreiben den Artikel",
        body: "Ein echter Artikel zu einem Thema, das Ihre Leser interessiert, für Ihre Website geschrieben, mit einem natürlichen Link darin.",
      },
      {
        title: "Sie verdienen ein Guthaben",
        body: "Ein Guthaben pro veröffentlichtem Artikel, einsetzbar für einen Link auf Ihre Website von der eines anderen.",
      },
    ],
    controlTitle: "Was Sie bestimmen",
    rules: [
      {
        title: "Nur verwandte Themen",
        body: "Sie werden nie gebeten, etwas zu veröffentlichen, das nichts mit Ihrer Website zu tun hat. Wenn wir nicht feststellen können, dass zwei Websites thematisch verwandt sind, stellen wir die Verbindung nicht her.",
      },
      {
        title: "Sie setzen das Limit",
        body: "Zwischen einem und zwanzig Artikeln pro Monat, jederzeit änderbar. Auf null gesetzt, erhalten Sie keine Anfragen mehr.",
      },
      {
        title: "Die redaktionelle Kontrolle bleibt bei Ihnen",
        body: "Artikel kommen als Entwürfe auf Ihre Website. Veröffentlichen, bearbeiten oder ablehnen - ohne Sie geht nichts online.",
      },
    ],
    suitsTitle: "Für wen das passt",
    suitsBody:
      "Für ein kleines Unternehmen mit einem Blog, der ohnehin gelegentlich veröffentlicht und Links auf die eigenen Seiten möchte, ohne dafür zu zahlen. Hat Ihre Website keine Leser, ändert das Veröffentlichen daran nichts: Die Links, die Sie verdienen, sind so viel wert wie Ihre Website.",
    joinNote:
      "Die Teilnahme ist in jedem Tarif enthalten. Aktivieren Sie sie in den Einstellungen Ihrer Website.",
    ctaPrimary: "Loslegen",
    ctaSecondary: "So funktioniert der Austausch",
  },
  affiliate: {
    metaTitle: "Ein Unternehmen empfehlen",
    metaDescription:
      "Teilen Sie Ihren Link und verdienen Sie Guthaben, wenn jemand, den Sie empfohlen haben, den ersten Monat bezahlt.",
    title: "Empfehlen Sie ein Unternehmen, verdienen Sie Guthaben",
    intro:
      "Teilen Sie Ihren Link. Wenn jemand, den Sie empfohlen haben, den ersten Monat bezahlt, landet das Guthaben auf Ihrem Konto.",
    steps: [
      {
        title: "Teilen Sie Ihren Link",
        body: "Jedes Konto hat einen Link. Sie finden ihn nach der Anmeldung in den Einstellungen.",
      },
      {
        title: "Anmeldung und Abo",
        body: "Solange jemand das Produkt nur ausprobiert, ist nichts fällig. Die Empfehlung zählt, wenn der erste Monat bezahlt wird.",
      },
      {
        title: "Sie erhalten Ihr Guthaben",
        body: "Das Guthaben landet automatisch auf Ihrem Konto und fließt in Backlinks zu Ihrer Website.",
      },
    ],
    termsTitle: "Die Bedingungen, klar gesagt",
    terms: [
      "Die Vergütung ist Kontoguthaben, kein Geld. Es ist nicht auszahlbar.",
      "Eine Empfehlung zählt, sobald die empfohlene Person den ersten Monat bezahlt hat.",
      "Nur neue Konten können empfohlen werden, und jedes nur einmal.",
      "Guthaben wird im Produkt für Linkaufbau eingesetzt.",
    ],
    ctaPrimary: "Loslegen",
    ctaNote:
      "Ihr Empfehlungslink steht in den Einstellungen, sobald Sie ein Konto haben.",
  },
  backlinkExchange: {
    metaTitle: "So funktioniert der Backlink-Austausch",
    metaDescription:
      "Verdienen Sie Links auf Ihre Website, indem Sie einen Artikel für ein anderes Unternehmen veröffentlichen. Nur passende Zuordnungen, täglich geprüft, Guthaben zurück, wenn bestätigt ist, dass ein Link verschwunden ist.",
    title: "So funktioniert der Backlink-Austausch",
    intro:
      "Links verdient man, indem man welche gibt. Sie veröffentlichen einen Artikel für ein Unternehmen aus einer verwandten Branche und setzen das Verdiente für Links auf Ihre eigene Website ein.",
    steps: [
      {
        title: "Sie veröffentlichen einen Artikel",
        body: "Wir schreiben einen Artikel für ein anderes Unternehmen aus einer verwandten Branche und veröffentlichen ihn auf Ihrer Website. Ein echter Artikel zu einem Thema, das Ihre Leser interessiert - keine Linkliste.",
      },
      {
        title: "Sie verdienen ein Guthaben",
        body: "Ein veröffentlichter Artikel bringt ein Guthaben. Ihr Tarif enthält zusätzlich monatliches Guthaben, Sie können also starten, bevor Sie etwas veröffentlicht haben.",
      },
      {
        title: "Sie setzen es für einen Link ein",
        body: "Ein Guthaben kauft einen Link auf Ihre Website, natürlich eingebunden in einen Artikel auf der Website eines anderen Unternehmens aus einer verwandten Branche.",
      },
    ],
    rulesTitle: "Die Regeln, die es wertvoll machen",
    rules: [
      {
        title: "Nur verwandte Themen",
        body: "Ein Zahnarzt wird nie einem Krypto-Blog zugeordnet. Wenn wir nicht feststellen können, dass zwei Websites thematisch verwandt sind, stellen wir die Verbindung nicht her: Ein themenfremder Link ist nichts wert und kann schaden.",
      },
      {
        title: "Täglich geprüft",
        body: "Wir prüfen jeden Link täglich erneut. Links verschwinden nicht stillschweigend, ohne dass Sie es erfahren.",
      },
      {
        title: "Guthaben zurück, wenn ein Link fällt",
        body: "Wird ein Link entfernt, sagen Sie uns Bescheid: Sobald bestätigt ist, dass er weg ist, erhalten Sie das Guthaben zurück und der Link verschwindet aus Ihrem Dashboard. Eine Website, die nur kurz offline ist, etwa wegen Wartung, behält ihre Links.",
      },
    ],
    notTitle: "Was das nicht ist",
    notBody:
      "Das ist kein privates Blog-Netzwerk. Jeder Link steht in einem echten Artikel auf der Website eines echten Unternehmens, veröffentlicht, weil dieses Unternehmen einen Artikel wollte.",
    ctaTitle: "Jeder Tarif enthält Guthaben",
    ctaBody:
      "Sie können Ihre ersten Links anfordern, bevor Sie etwas veröffentlicht haben.",
    ctaPrimary: "Loslegen",
    ctaSecondary: "Lieber Artikel veröffentlichen",
  },
  faq: {
    metaTitle: "Häufige Fragen",
    metaDescription: "Häufige Fragen dazu, wie RepGet funktioniert.",
    title: "Häufige Fragen",
    subtitle: "Klare Antworten, auch zu den Grenzen.",
    items: [
      {
        question: "Muss ich etwas über SEO wissen?",
        answer:
          "Nein. Genau darum geht es bei diesem Dienst. Wir ermitteln, welche Suchanfragen Ihre Kunden nutzen, schreiben die Seiten, die diese beantworten, und sagen Ihnen in klarer Sprache, was sich geändert hat. Sie müssen nie lernen, was ein Canonical-Tag ist.",
      },
      {
        question: "Wie lange dauert es bis zu Ergebnissen?",
        answer:
          "Meist zwei bis vier Monate, bis neue Seiten Besucher bringen, in umkämpften Branchen länger. Wer Ihnen Ergebnisse in Wochen verspricht, ist nicht ehrlich. Suchmaschinen brauchen Zeit, um neue Seiten zu finden, ihnen zu vertrauen und sie einzuordnen.",
      },
      {
        question: "Garantieren Sie Platz eins bei Google?",
        answer:
          "Nein, und das kann auch sonst niemand. Google entscheidet über die Platzierung und ändert seine Funktionsweise ständig. Wir finden die Suchanfragen, die Sie realistisch gewinnen können, schreiben die Seiten sauber und zeigen Ihnen ehrlich, was passiert ist.",
      },
      {
        question: "Klingen die Artikel, als hätte sie ein Roboter geschrieben?",
        answer:
          "Sie werden von einer KI geschrieben, lesen Sie sie also vor der Veröffentlichung - genau dafür geben wir Ihnen einen Editor. Sie sind für Ihr Unternehmen geschrieben, in Ihrer Sprache und Ihrem Markt, und Sie können den gewünschten Ton festlegen.",
      },
      {
        question: "Erscheinen die Artikel automatisch auf meiner Website?",
        answer:
          "Nur wenn Sie Ihre Website verbinden und sich für die Veröffentlichung entscheiden. Wir unterstützen WordPress, Ghost und Shopify sowie einen Webhook für alles andere. Andernfalls bleiben sie Entwürfe, die Sie prüfen, bearbeiten oder anderswo einfügen können.",
      },
      {
        question: "Was sind Link-Guthaben?",
        answer:
          "Google vertraut einer Website mehr, wenn andere Seiten auf sie verlinken. Erwähnt einer Ihrer Artikel das Unternehmen eines anderen Mitglieds, erhalten Sie ein Guthaben. Geben Sie eines aus, verlinkt der Artikel eines anderen Mitglieds auf Sie. Sie verlinken nie zurück auf denjenigen, der auf Sie verlinkt hat - so wirken die Links natürlich.",
      },
      {
        question: "Warum schlagen Sie kleinere Suchbegriffe vor?",
        answer:
          "Weil Sie diese gewinnen können. Ein Begriff mit 12.000 Suchanfragen im Monat, bei dem Sie keine Chance haben, ist weniger wert als einer mit 300 Anfragen, der Ihnen nächsten Monat Kunden bringt.",
      },
      {
        question: "Kann ich jederzeit kündigen?",
        answer:
          "Ja, über die Abrechnungsseite und ohne Kündigungsgebühr. Ihr Zugang läuft bis zum Ende des bereits bezahlten Zeitraums weiter.",
      },
      {
        question: "Was passiert mit meinen Artikeln, wenn ich gehe?",
        answer:
          "Alles bereits Veröffentlichte bleibt auf Ihrer Website - es ist Ihr Inhalt. Die Artikel, die wir für Sie schreiben, gehören Ihnen.",
      },
    ],
  },
  contact: {
    metaTitle: "Kontakt",
    metaDescription: "So erreichen Sie RepGet.",
    title: "Kontakt",
    subtitle:
      "Fragen zum Produkt, zu Ihrem Konto oder zur Abrechnung - wir lesen jede Nachricht und antworten innerhalb von zwei Werktagen.",
    emailLabel: "E-Mail",
    accountNote:
      "Wenn es um Ihr Konto geht, schreiben Sie bitte von der Adresse, mit der Sie sich registriert haben.",
  },
  notFound: {
    metaTitle: "Seite nicht gefunden",
    eyebrow: "Fehler 404",
    title: "Diese Seite haben wir nicht gefunden",
    body: "Die Adresse ist vielleicht falsch geschrieben, oder die Seite wurde verschoben oder existiert nicht mehr.",
    home: "Zur Startseite",
    elsewhere: "Oder versuchen Sie eine dieser Seiten:",
  },
  legalNotice: "Diese Seite ist nur auf Englisch verfügbar. Übersetzungen unserer rechtlichen Bedingungen werden vor der Veröffentlichung von einem professionellen Übersetzer erstellt.",

  app: {
    workspace: {
      save: "Speichern",
      saving: "Wird gespeichert…",
      saved: "Gespeichert",
      discard: "Änderungen verwerfen",
      unsaved: "1 ungespeicherte Änderung|{count} ungespeicherte Änderungen",
      noChanges: "Alle Änderungen sind gespeichert",
      saveFailed: "Nicht gespeichert. {error}",
      leaveConfirm: "Sie haben ungespeicherte Änderungen. Diese Seite verlassen und die Änderungen verwerfen?",
      onThisPage: "Auf dieser Seite",
      jumpTo: "Zu einem Abschnitt springen",
      optional: "Optional",
      required: "Pflichtfeld",
      charactersLeft: "Noch 1 Zeichen|Noch {count} Zeichen",
      overLimit: "1 Zeichen zu viel|{count} Zeichen zu viel",
      viewOnly: "Sie haben für diese Website nur Lesezugriff. Änderungen können nur Inhaber oder Bearbeiter vornehmen.",
      savesImmediately: "Wird sofort gespeichert, wenn Sie es ändern",
      savedWithButton: "Wird mit der Schaltfläche Speichern gespeichert",
      editsKept: "Ihre neueren Änderungen bleiben erhalten und müssen noch gespeichert werden.",
      preview: "Vorschau",
      close: "Schließen",
      selected: "Ausgewählt",
    },
    health: {
      title: "Website-Zustand",
      description: "Eine technische Prüfung der Seiten, die wir auf {domain} lesen können: was sie in den Suchergebnissen bremsen kann und wie Sie es beheben.",
      checkNow: "Meine Website prüfen",
      checkAgain: "Erneut prüfen",
      checking: "Wird geprüft…",
      starting: "Wird gestartet…",
      refreshStatus: "Status aktualisieren",
      dismiss: "Schließen",
      unavailableTitle: "Neue Prüfungen nicht verfügbar",
      siteNotReady: "Wir analysieren diese Website noch. Sie können eine Prüfung starten, sobald die Analyse abgeschlossen ist.",
      errNoPlan: "Wählen Sie zuerst einen Tarif für diese Website.",
      errPlanInactive: "Das Abonnement dieser Website ist nicht aktiv. Aktualisieren Sie die Zahlungsdaten, um eine Prüfung zu starten.",
      errQuota: "Sie haben diese Prüfung in der letzten Stunde mehrmals gestartet. Bitte versuchen Sie es in Kürze erneut.",
      errUnexpected: "Die Prüfung konnte nicht gestartet werden. Bitte versuchen Sie es erneut.",
      queuedTitle: "Prüfung angefordert",
      queuedBody: "Ihre Prüfung wartet auf den Start. Diese Seite aktualisiert sich von selbst.",
      queuedStale: "Diese Prüfung hat noch nicht begonnen und braucht länger als üblich. Der Bericht erscheint hier, sobald sie gelaufen ist.",
      requestedAt: "Angefordert: {date}",
      runningTitle: "Ihre Website wird geprüft",
      runningBody: "Wir lesen Ihre Seiten eine nach der anderen. Diese Seite aktualisiert sich von selbst.",
      runningStale: "Diese Prüfung läuft länger als erwartet und wurde möglicherweise unterbrochen.",
      staleRetry: "Aktualisieren Sie den Status, um zu sehen, ob sie weitergekommen ist, oder starten Sie die Prüfung erneut.",
      startedAt: "Gestartet: {date}",
      progressChecked: "Bisher 1 Seite geprüft|Bisher {count} Seiten geprüft",
      progressFound: "1 Adresse auf Ihrer Website gefunden|{count} Adressen auf Ihrer Website gefunden",
      progressLimit: "Eine Prüfung liest bis zu {max} Seiten.",
      previousNotice: "Der Bericht unten ist Ihr vorheriges Ergebnis vom {date}. Er wird ersetzt, sobald die neue Prüfung fertig ist.",
      failedTitle: "Die letzte Prüfung konnte nicht abgeschlossen werden",
      failedPrevious: "Der Bericht unten ist weiterhin Ihr vorheriges Ergebnis vom {date}.",
      finishedTitle: "Ihr neuer Bericht ist fertig",
      finishedBody: "Der Bericht unten stammt aus der Prüfung vom {date}.",
      failure: {
        timeout: "Ihre Website hat zu lange gebraucht, um zu antworten. Versuchen Sie es erneut: Bei einem ausgelasteten Server ist das oft nur vorübergehend.",
        notHtml: "Die Website-Adresse hat keine Webseite geliefert. Prüfen Sie, ob sie auf die Startseite Ihrer Website zeigt.",
        tooLarge: "Ihre Startseite ist zu groß, als dass wir sie analysieren könnten.",
        invalidUrl: "Die Website-Adresse konnte nicht gelesen werden. Prüfen Sie die Adresse, einschließlich http:// oder https://.",
        refused: "Ihre Website hat unsere Anfrage abgelehnt. Möglicherweise blockiert eine Firewall oder ein Sicherheits-Plugin automatische Besucher.",
        unreachable: "Wir konnten Ihre Website nicht erreichen. Prüfen Sie, ob sie online ist und die Adresse stimmt.",
        notEntitled: "Die Prüfung wurde beendet, weil das Abonnement dieser Website nicht aktiv ist. Es wurde nichts weiter berechnet.",
        generic: "Wir konnten die Prüfung Ihrer Website nicht abschließen. Versuchen Sie es erneut, und wenden Sie sich an den Support, wenn es wieder passiert.",
      },
      failureViewer: {
        timeout: "Ihre Website hat zu lange gebraucht, um zu antworten. Bei einem ausgelasteten Server ist das oft nur vorübergehend. Ein Inhaber oder Bearbeiter kann die Prüfung erneut starten.",
        generic: "Wir konnten die Prüfung Ihrer Website nicht abschließen. Ein Inhaber oder Bearbeiter kann die Prüfung erneut starten.",
      },
      emptyTitle: "Noch kein Bericht",
      emptyBody: "Eine Prüfung liest bis zu {max} Seiten Ihrer Website und listet Seite für Seite auf, was sie in der Suche bremsen kann und wie Sie jedes Problem beheben.",
      emptyViewer: "Es wurde noch keine Prüfung durchgeführt. Ein Inhaber oder Bearbeiter kann eine starten.",
      firstRunTitle: "Ihr erster Bericht ist unterwegs",
      firstRunBody: "Er erscheint hier, sobald die Prüfung abgeschlossen ist.",
      scoreTitle: "Zustandswert",
      scoreDescription: "Zählt die technischen Probleme auf den gelesenen Seiten, gewichtet nach Schwere und gemittelt pro Seite.",
      previousResult: "Vorheriges Ergebnis",
      latestResult: "Neuestes Ergebnis",
      outOf: "von 100",
      scoreAria: "Zustandswert: {score} von 100",
      bandGood: "Gut",
      bandFair: "Verbesserungswürdig",
      bandPoor: "Schwach",
      noScore: "Kein Wert",
      noScoreBody: "Für diese Prüfung wurde kein Wert gespeichert.",
      notScored: "Nicht bewertet",
      zeroPagesTitle: "Keine Seite konnte gelesen werden",
      zeroPagesBody: "Bei dieser Prüfung konnten wir keine Seite öffnen, daher beschreibt ihr Wert Ihre Website nicht. Die Befunde unten nennen den Grund.",
      notAuthority: "Das ist nicht die Domain-Autorität: Der Wert misst technische Probleme auf Ihren eigenen Seiten, nicht, wie sehr andere Websites Ihrer vertrauen.",
      lastChecked: "Zuletzt geprüft",
      pagesRead: "Gelesene Seiten",
      pagesFailed: "Nicht geöffnet",
      addressesFound: "Gefundene Adressen",
      notRecorded: "Nicht erfasst",
      severityTitle: "Probleme nach Schwere",
      critical: "Kritisch",
      warnings: "Warnungen",
      suggestions: "Vorschläge",
      inFindings: "in 1 Befund|in {count} Befunden",
      severityAria: "Kritisch: {critical}, Warnungen: {warning}, Vorschläge: {info}",
      badge: { critical: "Kritisch", warning: "Warnung", info: "Vorschlag" },
      coverageTitle: "Was diese Prüfung abgedeckt hat",
      coverageLimit: "Sie liest bis zu {max} Seiten, beginnend mit Ihrer Startseite und den Links folgend.",
      coverageSameSite: "Sie folgt nur Links innerhalb von {domain}. Links zu anderen Websites werden nicht geprüft.",
      coverageQuery: "Adressen, die sich nur nach einem „?“ oder „#“ unterscheiden, zählen als eine Seite.",
      coverageSkipped: "Sie überspringt Admin-, Login-, Warenkorb- und Kassenseiten, Feeds sowie Dateien wie Bilder und PDFs.",
      coverageRefused: "Eine Seite, die nicht innerhalb von 15 Sekunden antwortet oder automatische Besucher ablehnt, wird als „nicht geöffnet“ aufgeführt.",
      coverageBeyond: "Diese Prüfung hat {found} Adressen auf Ihrer Website gefunden und {read} Seiten gelesen. Die übrigen wurden nicht geprüft.",
      notAssessedTitle: "Einige Prüfungen konnten nicht laufen",
      notAssessedBody: "Diese Prüfungen vergleichen Seiten miteinander und brauchen mindestens zwei lesbare Seiten: {checks}. Sie fließen nicht in diesen Wert ein.",
      crossChecks: {
        duplicateTitles: "doppelte Seitentitel",
        duplicateDescriptions: "doppelte Beschreibungen",
        internalLinking: "interne Verlinkung",
      },
      findingsTitle: "Befunde",
      findingsDescription: "Die schwersten zuerst. Öffnen Sie einen Befund, um alle betroffenen Seiten und die Lösung zu sehen.",
      findingsCount: "1 Befund|{count} Befunde",
      filterLabel: "Nach Schwere filtern",
      filterAll: "Alle",
      searchLabel: "Befunde durchsuchen",
      searchPlaceholder: "Nach Problem oder Seitenadresse suchen",
      showingFiltered: "Angezeigte Befunde: {shown} von {total}.",
      clearFilters: "Filter zurücksetzen",
      noMatchTitle: "Keine passenden Befunde",
      noMatchBody: "Versuchen Sie eine andere Suche oder zeigen Sie alle Befunde an.",
      noFindingsTitle: "Keine Probleme gefunden",
      noFindingsBody: "Auf der gelesenen Seite haben wir nichts zu beheben gefunden.|Auf den {count} gelesenen Seiten haben wir nichts zu beheben gefunden.",
      pagesCount: "1 Seite|{count} Seiten",
      howToFix: "So beheben Sie es",
      effortMinutes: "Meist ein paar Minuten",
      effortHour: "Meist etwa eine Stunde",
      effortLonger: "Kann länger dauern",
      needsDeveloper: "Eventuell braucht es Ihren Webentwickler",
      affectedPages: "Betroffene Seiten ({count})",
      homepage: "Startseite",
      opensInNewTab: "(öffnet in einem neuen Tab)",
      showAllPages: "Alle {count} Seiten anzeigen",
      showFewerPages: "Weniger Seiten anzeigen",
      matchingPages: "Zu Ihrer Suche passende Seiten: {shown} von {total}.",
      notLoaded: "{shown} von {total} sind aufgeführt. Die übrigen wurden nicht geladen, damit diese Seite schnell bleibt.",
      groupNote: "Jeder Eintrag ist eine Gruppe von Seiten; aufgeführt ist jeweils die erste Seite der Gruppe.",
      firstPageNote: "Aufgeführt ist die erste gefundene Seite; die Gesamtzahl steht im Detail.",
      noUrl: "Keine Seitenadresse erfasst",
      rowsCapped: "Diese Prüfung hat {total} Probleme erfasst. Unten sind die ersten {shown} aufgeführt; die Zahlen oben enthalten alle.",
      detail: {
        titleLong: "Der Titel hat {chars} Zeichen; Suchergebnisse schneiden ihn nach etwa {max} ab.",
        titleShort: "Der Titel hat nur {chars} Zeichen.",
        descriptionLong: "Die Beschreibung hat {chars} Zeichen; Suchergebnisse schneiden sie nach etwa {max} ab.",
        descriptionShort: "Die Beschreibung hat nur {chars} Zeichen.",
        multipleH1: "{count} Hauptüberschriften (H1) auf dieser Seite.",
        thinContent: "Nur {words} Wörter auf dieser Seite.",
        imagesAlt: "{missing} von {total} Bildern haben keine Beschreibung (Alt-Text).",
        largePage: "Allein das HTML der Seite ist {kb} KB groß.",
        httpStatus: "Die Seite hat mit Fehler {status} geantwortet.",
        duplicateTitle: "{count} Seiten teilen sich den Titel „{title}“.",
        duplicateDescription: "{count} Seiten teilen sich dieselbe Beschreibung.",
        noInternalLinks: "1 Seite verlinkt auf keine andere Seite Ihrer Website.|{count} Seiten verlinken auf keine andere Seite Ihrer Website.",
        unreachTimeout: "Sie hat nicht rechtzeitig geantwortet.",
        unreachBlocked: "Sie lehnt automatische Besucher ab (eine Sicherheitseinstellung der Website).",
        unreachPassword: "Sie verlangt ein Passwort.",
        unreachStatus: "Sie hat mit Fehler {status} geantwortet.",
        unreachNotHtml: "Sie ist keine Webseite.",
        unreachRedirects: "Sie leitet zu oft weiter.",
        unreachRedirectAway: "Sie leitet auf eine Adresse weiter, die wir nicht prüfen.",
        unreachConnect: "Wir konnten keine Verbindung herstellen.",
        unreachUnknown: "Ein unerwarteter Fehler hat das Öffnen verhindert.",
      },
      issues: {
        noindex: {
          label: "Für Suchmaschinen verborgen",
          about: "Die Seite bittet Suchmaschinen, sie nicht in die Ergebnisse aufzunehmen, daher ist sie in der Suche nicht zu finden.",
          fix: "Sofern Sie die Seite nicht absichtlich verbergen, entfernen Sie ihre „noindex“-Einstellung. In WordPress ist das meist eine Option Ihres SEO-Plugins oder das Kästchen „Suchmaschinen davon abhalten, diese Website zu indexieren“ unter Einstellungen › Lesen.",
        },
        broken_page: {
          label: "Seite zeigt einen Fehler",
          about: "Die Seite antwortet mit einem Fehler, statt zu laden.",
          fix: "Beheben Sie den Fehler, oder leiten Sie die Seite, wenn es sie nicht mehr geben soll, auf die passendste vorhandene Seite um, damit keine Besucher und Links verloren gehen.",
        },
        unreachable_page: {
          label: "Seite konnte nicht geöffnet werden",
          about: "Wir haben versucht, diese Seite zu laden, und es ist nicht gelungen. Suchmaschinen haben womöglich dasselbe Problem.",
          fix: "Öffnen Sie die Seite in Ihrem eigenen Browser. Gibt es sie nicht mehr, aktualisieren Sie die Links darauf oder leiten Sie sie um. Öffnet sie sich bei Ihnen, lehnt Ihr Hoster oder eine Sicherheitseinstellung womöglich automatische Besucher ab, was auch Suchmaschinen aussperren kann.",
        },
        missing_title: {
          label: "Seite hat keinen Titel",
          about: "Die Seite hat kein Title-Tag, also keine Überschrift für die Suchergebnisse.",
          fix: "Geben Sie der Seite einen Titel, der sagt, worum es geht. Er erscheint als Überschrift in den Suchergebnissen; schreiben Sie ihn also für Menschen, statt ihn mit Suchbegriffen zu füllen.",
        },
        title_too_long: {
          label: "Titel ist zu lang",
          about: "Suchergebnisse schneiden Titel ab, die länger als etwa 60 Zeichen sind.",
          fix: "Kürzen Sie den Titel, damit der wichtige Teil nicht abgeschnitten wird. Stellen Sie das Wichtigste an den Anfang: Gekürzt wird am Ende.",
        },
        title_too_short: {
          label: "Titel ist sehr kurz",
          about: "Titel unter 30 Zeichen sagen oft zu wenig über die Seite aus.",
          fix: "Ergänzen Sie den Titel, damit man schon in den Suchergebnissen erkennt, dass diese Seite die gesuchte ist.",
        },
        missing_meta_description: {
          label: "Keine Beschreibung für Suchergebnisse",
          about: "Die Seite hat keine Beschreibung, daher wählen Suchmaschinen selbst den Text unter Ihrem Link.",
          fix: "Schreiben Sie eine Beschreibung der Seite in ein bis zwei Sätzen. Ohne sie übernehmen Suchmaschinen einen Text von der Seite, oft nicht den besten.",
        },
        meta_description_too_long: {
          label: "Beschreibung ist zu lang",
          about: "Suchergebnisse schneiden Beschreibungen ab, die länger als etwa 158 Zeichen sind.",
          fix: "Kürzen Sie die Beschreibung und sagen Sie früh, warum sich ein Klick lohnt.",
        },
        meta_description_too_short: {
          label: "Beschreibung ist sehr kurz",
          about: "Beschreibungen unter 70 Zeichen lassen in den Suchergebnissen Platz ungenutzt.",
          fix: "Erweitern Sie die Beschreibung auf ein bis zwei Sätze, die einen Grund geben, Ihr Ergebnis zu wählen.",
        },
        missing_h1: {
          label: "Keine Hauptüberschrift",
          about: "Die Seite hat keine Hauptüberschrift (H1), daher ist ihr Thema für Leser und Suchmaschinen weniger klar.",
          fix: "Fügen Sie oben auf der Seite eine Hauptüberschrift ein, die sagt, worum es geht.",
        },
        multiple_h1: {
          label: "Mehr als eine Hauptüberschrift",
          about: "Die Seite hat mehrere Hauptüberschriften (H1), daher ist unklar, welche sie beschreibt.",
          fix: "Behalten Sie eine Hauptüberschrift und machen Sie die anderen zu Zwischenüberschriften.",
        },
        thin_content: {
          label: "Wenig Text",
          about: "Die Seite hat weniger als 300 Wörter, Menüs und Fußzeilen eingerechnet. So kurze Seiten ranken selten bei umkämpften Suchanfragen.",
          fix: "Erweitern Sie die Seite, damit sie vollständig beantwortet, weswegen Besucher kommen, oder führen Sie sie mit einer ausführlicheren Seite zusammen und leiten Sie diese hier um.",
        },
        images_missing_alt: {
          label: "Bilder ohne Beschreibung",
          about: "Einige Bilder haben keinen Alt-Text, den Screenreader vorlesen und die Bildersuche nutzt.",
          fix: "Geben Sie jedem Bild eine kurze Beschreibung dessen, was es zeigt. Rein dekorative Bilder dürfen eine leere Beschreibung haben.",
        },
        missing_canonical: {
          label: "Keine bevorzugte Adresse festgelegt",
          about: "Die Seite nennt ihre bevorzugte Adresse nicht (Canonical-Link). Ist sie unter mehreren Adressen erreichbar, müssen Suchmaschinen raten, welche sie zeigen.",
          fix: "Fügen Sie der Seite einen Canonical-Link hinzu. Die meisten SEO-Plugins tun das automatisch, sobald sie aktiviert sind; andernfalls fragen Sie Ihren Webentwickler.",
        },
        missing_lang: {
          label: "Seitensprache nicht festgelegt",
          about: "Die Seite gibt nicht an, in welcher Sprache sie geschrieben ist.",
          fix: "Legen Sie die Sprache der Seite fest (das Attribut „lang“ des html-Tags). Das hilft Suchmaschinen, Ihre Seiten den richtigen Menschen zu zeigen, und Screenreadern, sie richtig auszusprechen.",
        },
        large_page: {
          label: "Seitencode ist sehr groß",
          about: "Allein das HTML der Seite ist größer als 1,5 MB, was das Laden verlangsamt. Bilder sind hier nicht mitgezählt.",
          fix: "Großes HTML entsteht meist durch Code, Daten oder Bilder, die direkt in die Seite eingebettet sind. Bitten Sie Ihren Webentwickler, sie in eigene Dateien auszulagern oder zu verkleinern.",
        },
        duplicate_title: {
          label: "Seiten mit demselben Titel",
          about: "Mehrere Seiten verwenden denselben Titel, daher können Suchmaschinen sie schwer unterscheiden.",
          fix: "Geben Sie jeder Seite einen Titel, der beschreibt, was nur diese Seite behandelt.",
        },
        duplicate_meta_description: {
          label: "Seiten mit derselben Beschreibung",
          about: "Mehrere Seiten verwenden dieselbe Beschreibung in den Suchergebnissen.",
          fix: "Schreiben Sie für jede Seite eine eigene Beschreibung, die sagt, was diese Seite bietet.",
        },
        no_internal_links: {
          label: "Seiten ohne Links zum Rest der Website",
          about: "Einige Seiten enthalten keine Links zu anderen Seiten Ihrer Website, daher kommen Besucher und Suchmaschinen von dort nicht weiter.",
          fix: "Fügen Sie auf diesen Seiten Links zu passenden Seiten Ihrer Website hinzu, etwa zu einer Leistung, einem Artikel oder Ihrer Startseite.",
        },
      },
      siteTitle: "Ihre Website, wie wir sie gelesen haben",
      siteDescription: "Bei dieser Prüfung von Ihrer Startseite gelesen.",
      siteLegacy: "Diese Prüfung stammt aus der Zeit, bevor wir Website-Angaben erfasst haben. Sie erscheinen nach der nächsten Prüfung.",
      siteUnavailable: "Bei dieser Prüfung konnte keine Seite gelesen werden, daher sind diese Angaben nicht verfügbar.",
      siteName: "Name der Website",
      siteNameMissing: "Nicht gefunden",
      language: "Sprache",
      languageMissing: "Nicht angegeben",
      languageNote: "So wie von Ihrer Startseite angegeben.",
      languageMissingNote: "Ihre Startseite gibt ihre Sprache nicht an, daher müssen Suchmaschinen raten.",
      platform: "Plattform",
      platformUnknown: "Nicht erkannt",
      platformNote: "Aus dem Code Ihrer Seite erkannt.",
      platformUnknownNote: "Wir konnten keine gängige Plattform erkennen. Das ist an sich kein Problem.",
      previewImage: "Vorschaubild für Links",
      previewMissing: "Keines",
      previewNote: "Wird angezeigt, wenn Ihre Startseite geteilt wird.",
      previewMissingNote: "Es wurde kein Vorschaubild (og:image) gefunden, daher erscheinen geteilte Links womöglich ohne Bild.",
      previewBroken: "Das Vorschaubild konnte nicht geladen werden.",
      linkedTitle: "Websites, auf die Sie am häufigsten verlinken",
      linkedHelp: "Bis zu sechs, gezählt auf den gelesenen Seiten. Hilfreich, um Links zu entdecken, die Sie nicht setzen wollten.",
      linkedEmpty: "Auf den gelesenen Seiten haben wir keine Links zu anderen Websites gefunden.",
      aiTitle: "Zugang für KI-Assistenten",
      aiDescription: "Ob Ihre robots.txt-Datei die Crawler blockiert, mit denen KI-Assistenten Websites lesen.",
      aiLegacy: "Diese Prüfung stammt aus der Zeit, bevor wir robots.txt gelesen haben. Diese Angabe erscheint nach der nächsten Prüfung.",
      aiUnreadable: "Bei dieser Prüfung konnte keine Seite gelesen werden, daher war sehr wahrscheinlich auch die robots.txt nicht lesbar. „Nicht blockiert“ kann hier nur bedeuten, dass wir sie nicht lesen konnten.",
      aiNoneBlocked: "Keiner dieser {total} Crawler ist für Ihre gesamte Website blockiert.",
      aiSomeBlocked: "1 von {total} Crawlern ist für Ihre gesamte Website blockiert.|{count} von {total} Crawlern sind für Ihre gesamte Website blockiert.",
      aiAllowed: "Nicht blockiert",
      aiBlocked: "Blockiert",
      aiNamed: "In robots.txt genannt",
      aiCaveat: "Wir prüfen nur, ob robots.txt die gesamte Website blockiert. Gibt es keine robots.txt oder konnten wir sie nicht lesen, gilt ein Crawler als nicht blockiert. Firewalls und Regeln für einzelne Seiten werden nicht geprüft.",
      aiNoGuarantee: "Lesbar zu sein heißt nicht, dass ein KI-Assistent Ihre Website erwähnt oder zitiert.",
      aiBlockedHelp: "Um einen Crawler zuzulassen, entfernen Sie die für ihn geltende Regel „Disallow: /“ aus robots.txt, oder bitten Sie die Person, die Ihre Website betreut, darum.",
      aiVisibilityLink: "Sehen Sie, ob KI-Assistenten Sie erwähnen",
      fixTitle: "Sollen wir das für Sie beheben?",
      fixSelf: "Die meisten davon sind Textänderungen, die Sie mit den Hinweisen oben selbst vornehmen können. Wenn Sie das lieber nicht möchten, senden Sie uns die Liste, und wir machen Ihnen ein Angebot.",
      fixDeveloper: "1 dieser Befunde braucht meist die Person, die Ihre Website gebaut hat. Senden Sie uns die Liste: Wir prüfen alles und machen Ihnen ein Angebot für die Behebung.|{count} dieser Befunde brauchen meist die Person, die Ihre Website gebaut hat. Senden Sie uns die Liste: Wir prüfen alles und machen Ihnen ein Angebot für die Behebung.",
      fixHow: "Öffnet Ihr E-Mail-Programm mit bereits ausgefüllter Liste. Es wird nichts gesendet, bevor Sie selbst senden, und nichts berechnet.",
      fixUnavailable: "Angebotsanfragen per E-Mail sind derzeit nicht verfügbar.",
      requestQuote: "Angebot anfordern",
      mailSubject: "Anfrage zur Behebung für {domain}",
      mailGreeting: "Guten Tag,",
      mailAsk: "bitte erstellen Sie mir ein Angebot für die Behebung der auf {domain} gefundenen Probleme.",
      mailCheckedOn: "Prüfung vom {date}.",
      mailCounts: "1 Problem gefunden (davon kritisch: {critical}).|{count} Probleme gefunden (davon kritisch: {critical}).",
      mailListTitle: "Befunde:",
      mailLine: "- {label}: {pages}",
      mailThanks: "Vielen Dank.",
    },
    settings: {
      personalTitle: "Persönliche Daten",
      personalSubtitle: "Ihr Name und die E-Mail-Adresse, mit der Sie sich anmelden.",
      nameLabel: "Name",
      namePlaceholder: "Ihr Name",
      save: "Speichern",
      saving: "Wird gespeichert…",
      cancel: "Abbrechen",
      nameSaved: "Name aktualisiert",
      nameError: "Ihr Name konnte nicht gespeichert werden",
      emailLabel: "E-Mail",
      changePassword: "Passwort ändern",
      setPassword: "Passwort festlegen",
      setPasswordIntro:
        "Sie melden sich mit Google an. Legen Sie ein Passwort fest, um sich auch mit Ihrer E-Mail-Adresse anzumelden - Google funktioniert weiterhin.",
      setPasswordHelp: "Mindestens 8 Zeichen.",
      settingPassword: "Wird festgelegt…",
      passwordCreated:
        "Passwort festgelegt. Sie können sich jetzt mit Ihrer E-Mail-Adresse und Ihrem Passwort anmelden.",
      languageLabel: "Sprache des Dashboards",
      languageHelp: "Menüs, Schaltflächen und Meldungen dieses Dashboards. Eine Änderung wirkt sich nicht auf Ihre Artikel aus.",
      languageError: "Ihre Sprache konnte nicht gespeichert werden",
      currentPassword: "Aktuelles Passwort",
      newPassword: "Neues Passwort",
      updatePassword: "Passwort aktualisieren",
      passwordSaved: "Passwort geändert. Andere Geräte wurden abgemeldet.",
      passwordTooShort: "Verwenden Sie mindestens 8 Zeichen",
      passwordError: "Ihr Passwort konnte nicht geändert werden",
      passwordHelp: "Mindestens 8 Zeichen. Andere Geräte werden abgemeldet.",
      changing: "Wird geändert…",
      saveName: "Namen speichern",
      membersTitle: "Mitglieder und Rollen",
      membersSubtitle: "Der Zugriff wird jeweils für eine Website vergeben. Wer hier eingeladen wird, sieht weder Ihre anderen Websites noch Ihre Abrechnung.",
      addMember: "Mitglied hinzufügen",
      addMemberHelp: "Geben Sie die E-Mail-Adresse ein. Wenn noch kein RepGet-Konto besteht, senden wir eine Einladung per E-Mail.",
      memberColumn: "Mitglied",
      roleColumn: "Rolle",
      statusColumn: "Status",
      statusPending: "Eingeladen",
      invitationExpiresOn: "läuft am {date} ab",
      statusExpired: "Abgelaufen",
      resendInvite: "Einladung erneut senden",
      cancelInvite: "Einladung zurücknehmen",
      inviteSent: "Einladung gesendet",
      inviteResent: "Einladung erneut gesendet",
      inviteCancelled: "Einladung zurückgenommen",
      actionsColumn: "Aktionen",
      active: "Aktiv",
      removeAccess: "Zugriff entziehen",
      websiteLabel: "Website",
      emailPlaceholder: "editor@example.com",
      roleHelp: "Ein Redakteur kann Artikel schreiben, bearbeiten und veröffentlichen. Ein Leser kann nur lesen.",
      invite: "Einladen",
      nobodyElse: "Hier ist noch niemand sonst. Laden Sie eine Kollegin, einen Kollegen oder eine freie Redaktion zu dieser Website ein.",
      loadingPeople: "Personen werden geladen",
      roleEditor: "Redakteur",
      roleViewer: "Leser",
      pageTitle: "Konto",
      pageDescription: "Ihre persönlichen Daten, Ihre Anmeldung, Ihre Sprache, wer an Ihren Websites arbeitet und Ihr Empfehlungslink.",
      emailHelp: "Sie melden sich mit dieser Adresse an, und Belege werden an sie gesendet. Sie kann hier nicht geändert werden.",
      nameRequired: "Geben Sie Ihren Namen ein.",
      securityTitle: "Anmeldung und Sicherheit",
      securitySubtitle: "Die Möglichkeiten, sich bei Ihrem Konto anzumelden.",
      methodPassword: "E-Mail und Passwort",
      methodGoogle: "Google",
      methodSet: "Festgelegt",
      methodNotSet: "Nicht festgelegt",
      methodLinked: "Verknüpft",
      passwordSetSummary: "Sie können sich mit Ihrer E-Mail-Adresse und Ihrem Passwort anmelden.",
      passwordNotSetSummary: "Dieses Konto hat noch kein Passwort.",
      googleLinkedSummary: "Sie können sich mit dem Google-Konto dieser Adresse anmelden.",
      setPasswordIntroGeneric: "Legen Sie ein Passwort fest, um sich mit Ihrer E-Mail-Adresse und einem Passwort anzumelden.",
      currentPasswordWrong: "Ihr aktuelles Passwort ist nicht korrekt.",
      passwordTooLong: "Verwenden Sie höchstens 128 Zeichen",
      tooManyAttempts: "Zu viele Versuche. Warten Sie eine Minute und versuchen Sie es erneut.",
      passwordAlreadySet: "Dieses Konto hat bereits ein Passwort. Geben Sie Ihr aktuelles Passwort ein, um es zu ändern.",
      languageTitle: "Sprache",
      languageSubtitle: "Das Dashboard und Ihre Artikel haben jeweils eine eigene Sprache.",
      languageSaved: "Dashboard-Sprache gespeichert.",
      articleLanguageLabel: "Artikelsprache",
      articleLanguageHelp: "Die Artikel jeder Website werden in der Sprache verfasst, die im Tab Unternehmen der Website eingestellt ist.",
      articleLanguageLink: "Tab Unternehmen von {domain} öffnen",
      roleAdmin: "Administrator",
      roleEditorHelp: "Schreibt, bearbeitet und veröffentlicht Artikel.",
      roleViewerHelp: "Kann alles lesen, aber nichts ändern.",
      inviteTo: "Die Person erhält nur Zugriff auf {domain}.",
      reinviteHelp: "Wenn Sie jemanden einladen, der bereits Zugriff hat, ändert sich seine Rolle.",
      invalidEmail: "Geben Sie eine gültige E-Mail-Adresse ein.",
      inviteSelf: "Sie haben bereits Zugriff auf diese Website.",
      inviteFailed: "Die Einladung konnte nicht gesendet werden. Bitte erneut versuchen.",
      actionFailed: "Das hat nicht funktioniert. Bitte erneut versuchen.",
      accessGranted: "{email} kann jetzt an {domain} arbeiten",
      accessGrantedNoEmail: "{email} kann jetzt an {domain} arbeiten, aber wir konnten keine E-Mail senden.",
      accessRemoved: "{email} hat keinen Zugriff mehr",
      loadPeopleFailed: "Wer an dieser Website arbeitet, konnte nicht geladen werden.",
      retry: "Erneut versuchen",
      thisWebsite: "diese Website",
      workspaceAccess: "{email} hat über Ihren Arbeitsbereich Zugriff",
      manageMember: "{email} verwalten",
      manageInvitation: "Einladung für {email} verwalten",
      membersCaption: "Personen, die an {domain} arbeiten können",
      removeConfirmTitle: "Zugriff für {email} entfernen?",
      removeConfirmBody: "Die Person kann {domain} dann nicht mehr öffnen. Sie können sie später erneut einladen.",
      keepAccess: "Zugriff behalten",
      cancelInviteConfirmTitle: "Einladung für {email} zurückziehen?",
      cancelInviteConfirmBody: "Der per E-Mail gesendete Link funktioniert dann nicht mehr. Sie können die Person später erneut einladen.",
      keepInvitation: "Einladung behalten",
      removing: "Wird entfernt…",
      cancellingInvite: "Wird zurückgezogen…",
      inviting: "Wird gesendet…",
      viewingSharedNote: "Sie sehen gerade {domain}, das mit Ihnen geteilt wurde. Nur der Inhaber kann ändern, wer daran arbeitet. Die Liste unten gilt für Ihre eigenen Websites.",
      guestTeamNote: "{domain} wurde mit Ihnen als {role} geteilt. Nur der Inhaber kann Personen einladen oder entfernen.",
    },
    websites: {
      title: "Websites",
      connected: "1 Website. Jede wird über ihren eigenen Tarif abgerechnet.|{count} Websites. Jede wird über ihren eigenen Tarif abgerechnet.",
      addWebsite: "Website hinzufügen",
      emptyTitle: "Noch keine Websites",
      emptyBody:
        "Fügen Sie Ihre Website hinzu. Wir lesen sie, ermitteln, was Ihr Unternehmen tut, und finden die Suchbegriffe, die sich lohnen.",
      addFirst: "Erste Website hinzufügen",
      tryAgain: "Erneut versuchen",
      removeLabel: "{domain} entfernen",
      removed: "{domain} entfernt",
      retrying: "Neuer Versuch",
      dialogTitle: "Website hinzufügen",
      dialogBody:
        "Geben Sie die Adresse der Website ein, die bei Google gefunden werden soll. Wir lesen sie und füllen die Details für Sie aus.",
      urlLabel: "Website-Adresse",
      urlPlaceholder: "beispiel.de",
      cancel: "Abbrechen",
      adding: "Wird hinzugefügt…",
      sharedTitle: "Mit Ihnen geteilt",
      sharedHelp: "Websites, an denen Sie auf Einladung anderer mitarbeiten.",
    },
    billing: {
      title: "Abrechnung",
      subtitle: "Jede Website hat ihren eigenen Tarif. Credits gelten für alle gemeinsam.",
      yourWebsites: "Ihre Websites",
      yourWebsitesHelp: "Eine Website ohne Tarif kann keine Artikel erstellen oder veröffentlichen.",
      noPlanYet: "Noch kein Tarif",
      planRenews: "{plan} - verlängert sich am {date}",
      planEnds: "{plan} - endet am {date}",
      currentPlan: "Aktueller Tarif",
      accessEnds: "Zugriff endet",
      nextInvoice: "Nächste Rechnung",
      onPlan: "Sie nutzen den Tarif {plan}.",
      noSubscription: "Noch kein aktives Abonnement. Wählen Sie unten einen Tarif, um zu starten.",
      accessEndsOn: "Der Zugriff endet am {date}.",
      renewsOn: "Verlängert sich am {date}.",
      monthly: "Monatlich",
      annual: "Jährlich",
      status: "Status",
      tryItFirst: "Erst testen",
      paypalReceipts: "Ihre Belege und die Kündigung finden Sie in Ihrem PayPal-Konto.",
      promoCodes: "Gutscheincodes können beim Kartenzahlvorgang eingegeben werden. PayPal unterstützt sie nicht.",
      unlimited: "Unbegrenzt",
      // "Artikel" is the same in singular and plural; no ternary to write.
      articlesEachMonth: "{n} Artikel pro Monat geschrieben|{n} Artikel pro Monat geschrieben",
      searchTermsTracked: "{n} Suchbegriff überwacht|{n} Suchbegriffe überwacht",
      oneWebsite: "Eine Website pro Abonnement",
      creditsEachMonth: "{n} Link-Guthaben pro Monat|{n} Link-Guthaben pro Monat",
      paymentReceived: "Zahlung erhalten - Ihr Abonnement wird bestätigt…",
      checkoutCancelled: "Bezahlvorgang abgebrochen.",
      purchaseReceived: "Zahlung erhalten - Ihr Kauf erscheint in Kürze.",
      purchaseCancelled: "Kauf abgebrochen.",
      addWebsiteFirst: "Fügen Sie zuerst eine Website hinzu - jeder Tarif bezahlt eine Website.",
      checkoutFailed: "Der Bezahlvorgang konnte nicht gestartet werden. Bitte erneut versuchen.",
      planFor: "Tarif für {domain}",
      choosePlan: "Tarif wählen",
      choosePlanFor: "Tarif für {domain} wählen",
      choosePlanHelp: "Ein Tarif gilt für eine Website.",
      billingPeriod: "Abrechnungszeitraum",
      perMonth: "/ Monat",
      perYear: "/ Jahr",
      saveBadge: "{n} % sparen",
      switchPlan: "Zu diesem Tarif wechseln",
      payByCard: "Mit Karte bezahlen",
      redirecting: "Weiterleitung…",
      opening: "Wird geöffnet…",
      cancelSubscription: "Abonnement kündigen",
      paypalCheckoutFailed: "Der PayPal-Bezahlvorgang konnte nicht gestartet werden. Bitte erneut versuchen.",
      portalFailed: "Das Abrechnungsportal konnte nicht geöffnet werden.",
      managedForYou: "Dieses Abonnement verwalten wir für Sie. Schreiben Sie an {email}, um Belege zu erhalten oder etwas zu ändern.",
      newTab: "(öffnet in einem neuen Tab)",
      upgradeLead: "Bereit zu wachsen?",
      upgradeBody: "Der Tarif {plan} umfasst {articles}, {terms} und {credits}.",
      upgradeLink: "Mehr zu {plan}",
      statusActive: "Aktiv",
      statusTrialing: "Kostenloser Test",
      statusPastDue: "Zahlung überfällig",
      statusUnpaid: "Unbezahlt",
      statusIncomplete: "Zahlung unvollständig",
      statusIncompleteExpired: "Zahlung abgelaufen",
      statusCanceled: "Gekündigt",
      statusPaused: "Pausiert",
      statusInactive: "Inaktiv",
      pastDueNotice: "Die letzte Zahlung für diese Website ist fehlgeschlagen. Aktualisieren Sie die Zahlungsmethode, um den Zugriff zu behalten.",
      unsettledNotice: "Das Abonnement dieser Website muss beglichen oder gekündigt werden, bevor der Tarif geändert werden kann.",
      endedNotice: "Dieses Abonnement ist beendet. Wählen Sie unten einen Tarif, um neu zu starten.",
      billedByPayPal: "Diese Website wird über PayPal abgerechnet, daher laufen auch Tarifwechsel über PayPal.",
      billedByCard: "Diese Website wird per Karte abgerechnet, daher laufen Tarifwechsel über die Kartenzahlung. Um stattdessen mit PayPal zu zahlen, kündigen Sie zuerst das Kartenabonnement.",
      billedByCardEnding: "Das Kartenabonnement dieser Website endet am {date}. Sobald es beendet ist, können Sie PayPal wählen.",
      noPlanChange: "Ein Tarifwechsel ist für diese Website derzeit nicht möglich.",
      paypalApproved: "PayPal-Freigabe erhalten - Ihr Abonnement wird bestätigt…",
      paypalCancelled: "PayPal-Bezahlvorgang abgebrochen.",
      viewingSharedNote: "{shared} wurde mit Ihnen geteilt und wird von seinem Inhaber bezahlt. Diese Seite zeigt die Abrechnung Ihrer eigenen Websites.",
      guestTitle: "Hier gibt es nichts zu bezahlen",
      guestBody: "Mit Ihnen geteilte Websites werden von ihren Inhabern bezahlt. Sie brauchen keinen Tarif, um daran zu arbeiten.",
      addWebsite: "Website hinzufügen",
      viewPlan: "Tarif ansehen",
      shownBelow: "Unten angezeigt",
      paidByCard: "Karte",
      invoiceInPortal: "Rechnung unter Abrechnung verwalten",
      dateColumn: "Datum",
      descriptionColumn: "Beschreibung",
      methodColumn: "Bezahlt mit",
      amountColumn: "Betrag",
      receiptColumn: "Beleg",
      historyCapped: "Angezeigt werden die {count} neuesten Zahlungen.",
    },
    article: {
      contentSeo: "Inhalte und SEO",
      contentSeoHelp: "Wie jeder Artikel geschrieben wird und was danach mit ihm geschieht.",
      publishAs: "Veröffentlichen als",
      publishLive: "Artikel gehen zur geplanten Zeit auf Ihrer Website live.",
      publishDraft: "Artikel werden als Entwurf gesendet, damit Sie sie zuerst prüfen.",
      live: "Live",
      draft: "Entwurf",
      articleStyle: "Artikelstil",
      internalLinks: "Interne Links",
      internalLinksHelp: "Angestrebte interne Links pro Artikel.",
      targetWordCount: "Angestrebte Länge",
      adaptiveOn: "Wir wählen die passende Länge für jede Artikelart.",
      adaptiveOff: "Eine feste Länge für jedes Format.",
      wordsPerArticle: "Wörter pro Artikel",
      contentDetails: "Inhaltsdetails",
      sitemapUrl: "Sitemap-URL",
      blogAddress: "Hauptadresse des Blogs",
      bestArticle: "Ihr bester Beispielartikel",
      engagement: "Interaktion",
      brandColour: "Markenfarbe",
      optional: "Optional",
      imageBrief: "Wie Ihre Marke in Bildern wirken soll",
      imageBriefPlaceholder: "Filmisch, minimal, kühle Grautöne mit Akzenten in Elektroblau.",
      imageInstructions: "Zusätzliche Bildanweisungen",
      imageInstructionsPlaceholder: "z. B. Nie Gesichter zeigen.",
      tableOfContents: "Inhaltsverzeichnis",
      comparisonTable: "Vergleichstabelle",
      youtubeVideo: "YouTube-Video",
      authorPerspective: "Perspektive der Autorin oder des Autors",
      mentionSimilar: "Ähnliche Produkte und Tools erwähnen",
      poweredBy: "Powered-by-RepGet-Link",
      howWeWrite: "Wie wir schreiben",
      toneLabel: "Wie sollen Ihre Artikel klingen?",
      tonePlaceholder: "Freundlich und beruhigend, nicht klinisch",
      rulesLabel: "Regeln für jeden Artikel",
      rulesPlaceholder: "Nie eine Jahreszahl im Titel. Immer den kostenlosen Versand erwähnen.",
      factsLabel: "Fakten über Ihr Unternehmen",
      uspsLabel: "Was unterscheidet Sie?",
      onePerLine: "Eines pro Zeile.",
      preferLabel: "Bevorzugte Wörter",
      preferPlaceholder: "Behandlung sagen, nicht Eingriff",
      avoidLabel: "Zu vermeidende Wörter",
      avoidPlaceholder: "Nie billig sagen",
      author: "Autor",
      authorName: "Name der Autorin oder des Autors",
      authorNamePlaceholder: "Ihr Name oder der der Marke",
      shortBio: "Kurzbiografie",
      shortBioPlaceholder: "Ein bis zwei Sätze dazu, wer schreibt und warum diese Person sich auskennt.",
      closePreview: "Vorschau schließen",
      unsavedChanges: "Nicht gespeicherte Änderungen",
      contentDetailsHelp: "Wo Ihre Inhalte liegen, damit wir darauf verlinken und ihre Form aufgreifen können.",
      engagementHelp: "Wie Artikel aussehen und was neben dem Text ergänzt wird.",
      howWeWriteHelp: "Die Stimme hinter jedem Artikel.",
      factsHelp: "Eines pro Zeile. Nur diese Angaben nennen wir ausdrücklich.",
      authorHelp: "Die Autorenzeile auf jedem Artikel, hier und auf Ihrer Website.",
      noBylineHelp: "Bleibt das Feld leer, erscheinen Artikel ohne Autorenzeile.",
      pageTitle: "Artikeleinstellungen",
      pageDescription: "Wie die Artikel für diese Website geschrieben, bebildert und veröffentlicht werden.",
      sectionWriting: "Schreiben und SEO",
      sectionWritingHelp: "Stil und Länge jedes Artikels und wie viele Links er auf Ihre anderen Seiten enthält.",
      sectionSources: "Inhaltsquellen",
      sectionSourcesHelp: "Wo Ihre Inhalte auf Ihrer Website liegen.",
      sectionImages: "Bilder und Marke",
      sectionImagesHelp: "Das Bild, das für jeden Artikel erstellt wird, und der Look Ihrer Marke.",
      sectionEnhancements: "Artikel-Extras",
      sectionEnhancementsHelp: "Was Artikeln zusätzlich zum Text hinzugefügt wird.",
      sectionVoice: "Markenstimme",
      sectionVoiceHelp: "Wie Ihre Artikel klingen und was sie über Ihr Unternehmen sagen dürfen.",
      sectionAuthor: "Autor",
      sectionAuthorHelp: "Die Person oder Marke, von der Ihre Artikel stammen. Sie wird mit Ihren Einstellungen gespeichert; Artikel zeigen sie derzeit nicht als Autorenzeile an.",
      unknownOption: "{value} (nicht mehr angeboten)",
      linksError: "Geben Sie eine ganze Zahl von 0 bis 20 ein.",
      wordsError: "Geben Sie eine ganze Zahl von 300 bis 5.000 ein.",
      sitemapHint: "Damit finden wir Seiten Ihrer Website, auf die neue Artikel verlinken können.",
      blogHint: "Die Hauptseite Ihres Blogs.",
      exampleHint: "Ein Artikel von Ihnen, mit dem Sie zufrieden sind.",
      urlError: "Geben Sie eine vollständige Adresse ein, die mit http:// oder https:// beginnt.",
      brandColourHint: "Ihre Hauptmarkenfarbe als Hex-Code. Sie wird mit Ihren Einstellungen gespeichert; generierte Bilder verwenden sie derzeit nicht.",
      brandColourError: "Verwenden Sie # gefolgt von sechs Ziffern oder Buchstaben a–f, zum Beispiel #003388.",
      noColour: "Keine Farbe festgelegt",
      invalidColour: "Keine gültige Farbe",
      pickColour: "Markenfarbe auswählen",
      clearColour: "Farbe entfernen",
      imageStyleLabel: "Bildstil",
      imageStyleHint: "Der Stil des Bildes, das für jeden Artikel erstellt wird.",
      coverStyleLabel: "Stil des Titelbilds",
      coverStyleHint: "Ihr bevorzugter Stil für Titelbilder. Derzeit erhält jeder Artikel ein einziges Bild im obigen Bildstil, und dieses Bild ist auch sein Titelbild.",
      samplesNote: "Die Beispiele veranschaulichen jeden Stil. Die Bilder Ihrer Artikel werden für jeden Artikel neu erstellt und sehen anders aus.",
      matchFollows: "Folgt derzeit: {style}",
      matchFollowsUnknown: "Folgt dem obigen Bildstil",
      previewStyle: "Beispiel für {style} ansehen",
      previewTitle: "Beispiel: {style}",
      previewMatchTitle: "Wie die Artikelbilder, derzeit {style}",
      previewHelp: "Ein Beispiel für diesen Stil. Die Vorschau ändert Ihre Auswahl nicht.",
      sampleAlt: "Beispielbild im Stil {style}",
      unknownImageStyle: "Ihre gespeicherte Auswahl ({value}) gehört nicht zu diesen Stilen. Sie bleibt bestehen, bis Sie einen auswählen.",
      imageBriefHint: "Wird in die Anweisungen für jedes Artikelbild aufgenommen.",
      tocHint: "Fügt ein Inhaltsverzeichnis aus den Zwischenüberschriften hinzu.",
      youtubeHint: "Ihre Auswahl wird gespeichert. Derzeit werden Artikeln keine Videos hinzugefügt.",
      perspectiveHint: "Schreibt mit eigener Perspektive statt unpersönlich.",
      similarHint: "Nennt und vergleicht Alternativen für eine umfassendere Darstellung.",
      comparisonHint: "Fügt eine Tabelle hinzu, die die Optionen des Artikels nebeneinander vergleicht, etwa „Videografie vs. Kinematografie auf einen Blick“.",
      poweredByHint: "Ein kleiner Hinweis am Ende jedes Artikels. Das Ausschalten gilt für noch nicht veröffentlichte Artikel.",
      factsPlaceholder: "Seit 2004 geöffnet\nFünf Zahnärzte im Team\nKostenlose Parkplätze vor Ort",
      uspsPlaceholder: "Notfalltermine am selben Tag\nWir behandeln ängstliche Patienten",
      tooManyLines: "Bis zu {max} Zeilen. Entfernen Sie 1 Zeile.|Bis zu {max} Zeilen. Entfernen Sie {count} Zeilen.",
      lineTooLong: "Zeile {line} ist länger als {max} Zeichen.",
      fixFields: "Einige Felder müssen korrigiert werden. Sie sind auf der Seite markiert.",
      saveError: "Etwas ist schiefgegangen. Bitte versuchen Sie es erneut.",
      saveBarNote: "Gilt für alle Abschnitte außer Schreiben und Veröffentlichen, der sofort beim Ändern gespeichert wird.",
      autoOnHelp: "Wir arbeiten Ihren Inhaltsplan selbstständig ab. Sie können jederzeit selbst jeden Artikel schreiben lassen.",
      autoOffHelp: "Es wird nichts geschrieben, bis Sie es anfordern. Öffnen Sie einen geplanten Artikel und klicken Sie auf Schreiben.",
      anyDay: "An jedem Tag.",
      pickedDays: "Nur an den ausgewählten Tagen.",
      daysUtc: "Die Tage richten sich nach UTC (koordinierte Weltzeit).",
      firstArticleOnly: "Ihr erster Artikel wird gesendet, sobald er fertig ist, egal was Sie wählen, damit Sie sehen, wie Artikel auf Ihrer Website aussehen.",
      networkReview: "Solange Ihre Website im Partnernetzwerk ist, prüft das RepGet-Team jeden Artikel vorher - auch den ersten - und keiner geht vor seinem geplanten Tag raus.",
      openIntegrations: "Integrationen öffnen",
      weekdaysShort: { sun: "So", mon: "Mo", tue: "Di", wed: "Mi", thu: "Do", fri: "Fr", sat: "Sa" },
      weekdaysLong: { sun: "Sonntag", mon: "Montag", tue: "Dienstag", wed: "Mittwoch", thu: "Donnerstag", fri: "Freitag", sat: "Samstag" },
      bodyImageStyles: {
        sketch: { label: "Skizze", hint: "Handgezeichnete Linien über sanfter Farbe." },
        watercolour: { label: "Aquarell", hint: "Weiche, gemalte Lasuren." },
        realistic: { label: "Realistisch", hint: "Fotografisch." },
        illustration: { label: "Illustration", hint: "Flache Vektorformen." },
        "brand-text": { label: "Marke & Text", hint: "Ein Foto mit einer kräftigen Farbfläche entlang eines Randes." },
      },
      coverImageStyles: {
        sketch: { label: "Skizze", hint: "Handgezeichnete Linien über sanfter Farbe." },
        watercolour: { label: "Aquarell", hint: "Weiche, gemalte Lasuren." },
        illustration: { label: "Illustration", hint: "Flache Vektorformen." },
        match: { label: "Wie die Artikelbilder", hint: "Folgt dem obigen Bildstil." },
      },
      styles: {
        expert: { label: "Fachlich", hint: "Präziser redaktioneller Ton mit ausgewogenen Einschränkungen und Fachbegriffen." },
        conversational: { label: "Gesprächsnah", hint: "Klare, direkte Sätze. Erklärt Begriffe beim ersten Auftreten." },
        friendly: { label: "Freundlich", hint: "Warm und ermutigend, in der Sie-Form, wenig Fachjargon." },
        journalistic: { label: "Journalistisch", hint: "Beginnt mit dem Befund, schreibt Aussagen zu, ohne Werbesprache." },
      },
    },
    editor: {
      backToWebsite: "Zurück zur Website",
      headings: "Überschriften",
      words: "Wörter",
      keywordUses: "Verwendungen des Suchbegriffs",
      internalLinks: "Interne Links",
      externalLinks: "Externe Links",
      socialMentions: "Social-Media-Erwähnungen",
      starting: "Wird gestartet",
      takesAMinute: "Das dauert meist etwa eine Minute. Die Seite aktualisiert sich von selbst.",
      couldNotWrite: "Diesen Artikel konnten wir nicht schreiben",
      tryAgain: "Erneut versuchen",
      publishingHistory: "Veröffentlichungsverlauf",
      historyHelp: "Jeder Versuch wird protokolliert, damit ein Fehler sichtbar und nicht stillschweigend ist.",
      failed: "Fehlgeschlagen",
      viewPost: "Beitrag ansehen",
      editArticle: "Artikel bearbeiten",
      editHelp: "Ihre vorherige Version bleibt bei jedem Speichern erhalten.",
      previewUnsaved: "Diese Vorschau enthält Änderungen, die Sie noch nicht gespeichert haben. Speichern Sie sie im Tab Bearbeiten.",
      partnerLink: "Partnerlink",
      partnerLinksNote: "Hervorgehobene Wörter sind Partnernetzwerk-Links, die das RepGet-Team gesetzt hat.",
      title: "Titel",
      metaDescription: "Meta-Beschreibung",
      slugLabel: "Adresse auf Ihrer Website",
      slugPlaceholder: "hochzeitsfilme-italien",
      slugHelp: "Leerzeichen und Satzzeichen werden zu Bindestrichen. Lassen Sie das Feld leer, wählt Ihre Website eine aus dem Titel.",
      articleContent: "Artikelinhalt",
      saving: "Wird gespeichert…",
      saveChanges: "Änderungen speichern",
      saved: "Gespeichert",
      rewriting: "Artikel wird neu geschrieben…",
      sendAsDraft: "Als Entwurf senden",
      publishedToSite: "Veröffentlicht - der Artikel ist live auf Ihrer Website.",
      sentAsDraftToSite: "Als Entwurf an Ihre Website gesendet.",
      viewOnSite: "Auf Ihrer Website ansehen",
      connectToPublish: "Website verbinden, um zu veröffentlichen",
      publishViaPlugin: "Ihre Website hat nicht geantwortet, daher steht der Artikel in der Warteschlange: Das WordPress-Plugin sendet ihn bei der nächsten Prüfung, innerhalb einer Stunde. Aktualisieren Sie das Plugin auf 1.4 oder neuer, um sofort zu veröffentlichen.",
      waitingForPlugin: "Warte auf das WordPress-Plugin",
      updatePost: "Beitrag aktualisieren",
      publish: "Veröffentlichen",
      sendingDraft: "Wird als Entwurf gesendet…",
      breadcrumbLabel: "Brotkrümelnavigation",
      targetKeywordLabel: "Ziel-Suchbegriff",
      lastSaved: "Zuletzt aktualisiert: {date}",
      viewModeLabel: "Vorschau oder Bearbeiten",
      unsavedMark: "Ungespeicherte Änderungen",
      previewLabel: "Artikelvorschau",
      previewUnsavedNow: "Sie sehen Änderungen, die noch nicht gespeichert sind. Ihre Website erhält sie erst, wenn Sie speichern und veröffentlichen.",
      notWrittenYet: "Der Artikel erscheint hier, sobald er geschrieben ist.",
      workingPaused: "Bearbeiten und Veröffentlichen warten, bis das fertig ist, denn die neue Version ersetzt den Text.",
      conflictTitle: "Dieser Artikel hat sich geändert, während Sie ihn bearbeitet haben",
      conflictBody: "Inzwischen hat sich die gespeicherte Version geändert bei: {fields}, zum Beispiel weil eine Neufassung fertig wurde oder jemand anderes gespeichert hat. Wenn Sie jetzt speichern, ersetzt Ihre Version diese.",
      conflictLoad: "Gespeicherte Version verwenden",
      conflictKeep: "Meine Version behalten",
      genUnavailable: "Das Schreiben ist vorübergehend nicht verfügbar. Das Problem liegt bei uns, und wir kümmern uns darum.",
      genBusy: "Der Schreibdienst war ausgelastet. Versuchen Sie es in ein paar Minuten erneut.",
      genTimeout: "Das Schreiben hat zu lange gedauert und wurde abgebrochen. Versuchen Sie es erneut - das ist meist vorübergehend.",
      genUnusable: "Aus diesem Thema konnten wir keinen brauchbaren Artikel erstellen. Versuchen Sie es erneut oder formulieren Sie Thema und Ziel-Suchbegriff genauer.",
      genQuota: "Dieser Arbeitsbereich hat alle Artikel des Monats verbraucht. Wählen Sie einen größeren Tarif, um mehr zu schreiben.",
      genGeneric: "Das Schreiben dieses Artikels wurde nicht abgeschlossen. Versuchen Sie es erneut. Wenn es weiter passiert, wenden Sie sich an den Support.",
      pubErrAuth: "Ihre Website hat die gespeicherte Anmeldung abgelehnt. Verbinden Sie sie auf der Seite Integrationen neu.",
      pubErrPermission: "Das verbundene Konto darf keine Beiträge veröffentlichen. Verbinden Sie ein Konto mit Veröffentlichungsrechten.",
      pubErrNotFound: "Die Adresse Ihrer Website wurde nicht gefunden. Prüfen Sie sie auf der Seite Integrationen.",
      pubErrUnreachable: "Ihre Website hat nicht geantwortet. Das ist meist vorübergehend: Versuchen Sie es erneut oder prüfen Sie, ob die Website online ist.",
      pubErrApiDisabled: "Ihre Website ist online, aber ihre Veröffentlichungsschnittstelle ist abgeschaltet, oft durch ein Sicherheits-Plugin. Schalten Sie sie wieder ein und testen Sie dann die Verbindung.",
      pubErrUnsupported: "Ihre Website arbeitet auf eine Weise, in die wir noch nicht veröffentlichen können.",
      pubErrUnknown: "Die Veröffentlichung wurde nicht abgeschlossen. Versuchen Sie es erneut. Wenn es weiter passiert, wenden Sie sich an den Support.",
      editSaveNote: "Titel, Meta-Beschreibung, Adresse und Text werden zusammen mit der Schaltfläche Speichern gespeichert. Das Beitragsbild wird gespeichert, sobald Sie es ändern.",
      titleRequired: "Geben Sie einen Titel ein.",
      metaHint: "Erscheint in Suchergebnissen unter dem Titel; meist werden etwa die ersten {count} Zeichen angezeigt.",
      slugSavedAs: "Wird gespeichert als: {slug}",
      slugEmptyNote: "Bleibt das Feld leer, wählt Ihre Website die Adresse anhand des Titels.",
      slugDropped: "Buchstaben mit Akzenten oder Umlauten und andere Sonderzeichen werden in der Adresse weggelassen.",
      slugWordPressNote: "WordPress behält die Adresse, unter der der Beitrag zuerst veröffentlicht wurde. Eine Änderung hier verschiebt den Live-Beitrag nicht.",
      searchPreviewTitle: "Vorschau im Suchergebnis",
      searchPreviewHelp: "Eine Annäherung. Was angezeigt wird, entscheiden die Suchmaschinen.",
      saveArticle: "Artikel speichern",
      saveNoteWorking: "Speichern wartet, während der Artikel geschrieben wird.",
      saveNoteDelivering: "Speichern wartet, während der Artikel an Ihre Website übermittelt wird.",
      saveNoteReview: "Wenn Sie Änderungen speichern, geht dieser Artikel zurück in die Prüfung durch das RepGet-Team.",
      saveNoteTitle: "Geben Sie einen Titel ein, um zu speichern.",
      statsTitle: "Artikelstatistik",
      statsHelp: "Aus dem Artikeltext gezählt.",
      statsUnsaved: "Aus dem Text auf dem Bildschirm gezählt, einschließlich ungespeicherter Änderungen.",
      publishingTitle: "Veröffentlichung",
      publishingHelp: "Beim Veröffentlichen wird die zuletzt gespeicherte Version an Ihre Website gesendet.",
      destinationLabel: "Ziel",
      destinationNone: "Nicht verbunden",
      destinationPlugin: "WordPress-Plugin",
      manageConnection: "Verbindung verwalten",
      plannedLabel: "Geplantes Datum",
      plannedNone: "Kein geplantes Datum",
      autoLabel: "Automatisches Veröffentlichen",
      autoOnLive: "An, als Live-Beiträge",
      autoOnDraft: "An, als Entwürfe",
      autoOff: "Aus",
      beforePlanned: "Wenn Sie jetzt veröffentlichen, wird der Artikel sofort gesendet, vor seinem geplanten Datum.",
      stateNotSent: "Noch nicht an Ihre Website gesendet.",
      stateLive: "Live auf Ihrer Website. Zuletzt gesendet: {date}.",
      stateDraft: "Als Entwurf auf Ihrer Website. Zuletzt gesendet: {date}.",
      stateScheduled: "Auf Ihrer Website geplant. Zuletzt gesendet: {date}.",
      stateDelivered: "An Ihre Website übermittelt am {date}.",
      stateFailed: "Der letzte Versuch ({date}) wurde nicht abgeschlossen.",
      statePluginUnconfirmed: "Das WordPress-Plugin hat die letzte Übergabe nicht bestätigt ({date}).",
      stateWriting: "Veröffentlichen ist möglich, sobald der Artikel geschrieben ist.",
      stateFrozen: "Das RepGet-Team hat das Veröffentlichen pausiert. Bis es weitergeht, wird nichts an Websites gesendet.",
      stateReviewPending: "Das RepGet-Team bereitet diesen Artikel für das Partnernetzwerk vor. Er geht hinaus, sobald das Team ihn freigibt.",
      stateReviewChanged: "Dieser Artikel wurde nach der Freigabe durch das RepGet-Team geändert und ist deshalb wieder in der Prüfung.",
      stateDelivering: "Wird gerade an Ihre Website übermittelt…",
      stateQueued: "Seit {time} in der Warteschlange. Das Ergebnis erscheint hier, sobald Ihre Website antwortet.",
      stateQueuedLong: "Noch kein Ergebnis. Die Übermittlung kann zurückgehalten werden, zum Beispiel solange ein früherer Versuch ungeklärt ist. Prüfen Sie es in ein paar Minuten erneut.",
      checkAgain: "Erneut prüfen",
      statePluginWaiting: "Warte darauf, dass das WordPress-Plugin ihn als {mode} abholt. Das Plugin meldet sich mindestens einmal pro Stunde.",
      modeLive: "Live-Beitrag",
      modeDraft: "Entwurf",
      statePluginPublished: "Das WordPress-Plugin hat diesen Beitrag erstellt und kann ihn danach nicht mehr ändern. Hier gespeicherte Änderungen erreichen Ihre Website daher nicht. Nehmen Sie weitere Änderungen in WordPress vor.",
      stateUncertain: "Der letzte Versuch hat keine Antwort von Ihrer Website erhalten. Siehe den Hinweis oben auf der Seite.",
      uncertainPublishNote: "Solange das ungeklärt ist, entsteht beim erneuten Veröffentlichen kein zweiter Beitrag: Wir suchen zuerst den früheren.",
      connectHelp: "Verbinden Sie Ihre Website, um diesen Artikel dort zu veröffentlichen.",
      blockedUnsaved: "Speichern Sie zuerst Ihre Änderungen. Veröffentlicht wird die gespeicherte Version, nicht das, was auf dem Bildschirm steht.",
      alreadySentLive: "Genau diese Version ist bereits live auf Ihrer Website.",
      alreadySentDraft: "Genau diese Version ist bereits als Entwurf auf Ihrer Website.",
      confirmDraftTitle: "Live-Beitrag zurück zum Entwurf machen?",
      confirmDraftBody: "Dieser Artikel ist live auf Ihrer Website. Wenn Sie ihn als Entwurf senden, kann der Live-Beitrag offline gehen (bei WordPress ist das so). Um den Live-Beitrag zu ändern, verwenden Sie stattdessen Beitrag aktualisieren.",
      historyLatest: "Die letzten {count} Versuche, neueste zuerst.",
      historyEmpty: "Bisher wurde nichts an Ihre Website gesendet.",
      logLive: "Live",
      logDraft: "Als Entwurf gesendet",
      logScheduled: "Geplant",
      logDelivered: "Übermittelt",
      rewriteTitle: "Artikel neu schreiben",
      rewriteHelp: "Schreibt den ganzen Artikel anhand seines Plans neu. Jede Website kann {count} Artikel pro Tag neu schreiben lassen.",
      rewriteConfirmTitle: "Diesen Artikel neu schreiben?",
      rewriteConfirmBody: "Text, Meta-Beschreibung, Adresse und Beitragsbild werden durch eine neue Version ersetzt. Die aktuelle Version bleibt nicht erhalten.",
      rewriteConfirmPublished: "Der Beitrag auf Ihrer Website bleibt unverändert, bis Sie die neue Version veröffentlichen.",
      rewriteConfirmReview: "Die neue Version geht zur Prüfung an das RepGet-Team, bevor sie veröffentlicht werden kann.",
      rewriteConfirmUnsaved: "Ihre ungespeicherten Änderungen werden verworfen.",
      rewriteConfirmAction: "Neu schreiben",
      rewriteNoPlan: "Dieser Artikel hat keinen Eintrag im Plan und kann daher nicht neu geschrieben werden.",
      rewriteBlocked: "Wieder verfügbar, sobald das laufende Schreiben oder Übermitteln abgeschlossen ist.",
      imagePromptHint: "Lassen Sie das Feld leer, dann wählen wir. Noch {remaining} von {max} neuen Bildern für diesen Artikel.",
      imageGenerate: "Erstellen",
      imageReplace: "Ersetzen",
      imageAltHint: "Wird gespeichert, wenn Sie das Feld verlassen.",
      imageCheckAlt: "Prüfen Sie, ob die Beschreibung noch zum neuen Bild passt.",
      imageLockedWorking: "Warten Sie, bis der Artikel geschrieben ist: Eine Neufassung ersetzt das Bild.",
      imageLockedDelivering: "Warten Sie, bis die Übermittlung an Ihre Website abgeschlossen ist.",
      imageTypeError: "Verwenden Sie ein PNG-, JPEG- oder WebP-Bild.",
      imageSizeError: "Dieses Bild ist {size} MB groß. Das Limit liegt bei {max} MB.",
      imageNoAlt: "Noch keine Beschreibung.",
      imageAltSaved: "Beschreibung gespeichert.",
      errInFlight: "Dieser Artikel wird gerade an Ihre Website übermittelt. Versuchen Sie es in einer Minute erneut.",
      errNotWritten: "Dieser Artikel wurde noch nicht geschrieben.",
      errConnectFirst: "Verbinden Sie Ihre Website, bevor Sie veröffentlichen.",
      errNotFound: "Diesen Artikel gibt es nicht mehr.",
      errRewriteCap: "Diese Website hat alle Neufassungen der letzten 24 Stunden verbraucht. Versuchen Sie es später erneut.",
      errAlreadyWriting: "Dieser Artikel wird bereits geschrieben.",
      errNoActivePlan: "Dieser Arbeitsbereich hat keinen aktiven Tarif. Wählen Sie einen, um weiter zu schreiben.",
      errImageStorage: "Der Bildspeicher ist gerade nicht verfügbar. Versuchen Sie es später erneut.",
      errImageGeneration: "Die Bilderstellung ist gerade nicht verfügbar. Versuchen Sie es später erneut.",
      metaNone: "Noch keine Meta-Beschreibung. Suchmaschinen zeigen dann einen Auszug aus dem Artikel.",
      searchPreviewUnsaved: "Die Vorschau enthält Änderungen, die noch nicht gespeichert sind.",
      imageReviewNote: "Wenn Sie das Bild oder seine Beschreibung ändern, geht dieser Artikel zurück in die Prüfung durch das RepGet-Team.",
      planningOutline: "Themen werden geplant",
      writingBody: "Artikel wird geschrieben",
    },
    analytics: {
      googleResults: "Google-Ergebnisse",
      connectHelp: "Verbinden Sie Google, um zu sehen, welche Suchanfragen Menschen auf Ihre Website bringen und wie sich das ändert, während wir veröffentlichen.",
      connectGoogle: "Google verbinden",
      redirecting: "Weiterleitung…",
      expired: "Die vorherige Verbindung ist abgelaufen. Verbinden Sie erneut, um den Import fortzusetzen.",
      connected: "Verbunden",
      last28: "Letzte 28 Tage.",
      chooseThenImport: "Wählen Sie unten Ihre Properties und speichern Sie, um Ihre Daten zu importieren.",
      visitorsFromGoogle: "Besucher über Google",
      timesAppeared: "Einblendungen",
      averageRanking: "Durchschnittliche Position",
      websiteVisits: "Website-Besuche",
      whatPeopleSearched: "Wonach Menschen gesucht haben, um Sie zu finden",
      query: "Suchanfrage",
      visitors: "Besucher",
      searchConsoleProperty: "Search-Console-Property",
      analyticsProperty: "Analytics-Property",
      chooseProperty: "Property wählen",
      importing: "Ihre Daten werden importiert - das dauert einen Moment",
      disconnected: "Google getrennt",
      statusConnected: "Google verbunden",
      statusCancelled: "Verbindung abgebrochen",
      statusForbidden: "Sie können diese Website nicht verbinden",
      statusInvalid: "Dieser Link war ungültig - versuchen Sie es erneut",
      statusError: "Google konnte nicht verbunden werden",
      pageTitle: "Google Search & Analytics",
      pageDescription: "Wie Menschen Ihre Website in der Google-Suche finden und wie viele Besuche sie erhält. Die Zahlen stammen aus Ihren eigenen Search-Console- und Google-Analytics-Konten.",
      rangeLabel: "Zeitraum",
      rangeDays: "{days} Tage",
      periodDates: "{start} – {end}",
      connectTitle: "Verbinden Sie Ihre Google-Konten",
      searchConsoleName: "Google Search Console",
      analyticsName: "Google Analytics",
      searchConsolePurpose: "Zeigt, wie Ihre Website in der Google-Suche abschneidet: wie oft sie angezeigt wird (Impressionen), wie oft darauf geklickt wird (Klicks), ihre durchschnittliche Position und welche Suchanfragen und Seiten Besucher bringen.",
      analyticsPurpose: "Zeigt, wie viele Besuche (Sitzungen) Ihre gesamte Website aus allen Quellen erhält: Google, andere Suchmaschinen, soziale Medien, Links und direkte Eingabe Ihrer Adresse.",
      setupTitle: "So funktioniert die Verbindung",
      setupStep1: "Melden Sie sich mit dem Google-Konto an, das diese Website in der Search Console und, falls Sie es nutzen, in Google Analytics sieht. Eine Anmeldung gilt für beides.",
      setupStep2: "Google bittet Sie, Lesezugriff zu erlauben. RepGet kann Ihre Zahlen lesen, aber nichts in Ihren Google-Konten ändern.",
      setupStep3: "Wählen Sie danach hier die Search-Console-Property und die Analytics-Property dieser Website. RepGet importiert etwa die letzten zwei Monate und danach täglich die neuen Zahlen.",
      readOnlyAccess: "Nur Lesezugriff. Sie können die Verbindung jederzeit trennen.",
      expiredTitle: "Google muss neu verbunden werden",
      reconnectGoogle: "Google neu verbinden",
      viewerCannotConnect: "Nur Inhaber oder Bearbeiter dieser Website können Google verbinden.",
      connectionTitle: "Google-Verbindung",
      connectionHelp: "RepGet importiert täglich neue Zahlen. Google meldet sie mit etwa drei Tagen Verzögerung.",
      notChosen: "Nicht gewählt",
      dataThrough: "Zahlen bis {date}",
      noFiguresYet: "Noch keine Zahlen von Google",
      analyticsPropertyId: "Property {id}",
      importNow: "Jetzt importieren",
      manageConnection: "Verbindung verwalten",
      viewerSetupPending: "Google ist verbunden, aber es wurde noch keine Property gewählt. Inhaber oder Bearbeiter können eine wählen.",
      importRequestedTitle: "Import angefordert",
      importRequestedBody: "RepGet importiert Ihre Zahlen von Google. Diese Seite sieht etwa eine Minute lang nach ihnen.",
      importStillRunning: "Der Import kann einige Minuten dauern. Neue Zahlen erscheinen hier, sobald er fertig ist: Laden Sie die Seite später neu, um sie zu sehen.",
      setupNeededTitle: "Wählen Sie, was importiert wird",
      setupNeededBody: "Wählen Sie die Search-Console-Property und die Analytics-Property dieser Website und speichern Sie. Eine der beiden genügt.",
      propertiesTitle: "Properties",
      propertiesHelp: "Welche Ihrer Google-Properties zu dieser Website gehören.",
      loadingProperties: "Die Properties Ihres Google-Kontos werden geladen…",
      propertiesFailed: "Ihre Properties konnten nicht von Google geladen werden. Versuchen Sie es erneut oder verbinden Sie Google neu, wenn das Problem bleibt.",
      tryAgain: "Erneut versuchen",
      searchConsoleHint: "Die Search-Console-Property dieser Website, zum Beispiel eine Domain-Property.",
      analyticsHint: "Die Google-Analytics-4-Property dieser Website.",
      noSearchConsoleFound: "Für dieses Google-Konto wurden keine Search-Console-Properties gefunden. Prüfen Sie, ob es Zugriff hat, oder verbinden Sie ein anderes Konto.",
      noAnalyticsFound: "Für dieses Google-Konto wurden keine Google-Analytics-4-Properties gefunden. Prüfen Sie, ob es Zugriff hat, oder verbinden Sie ein anderes Konto.",
      noSearchConsoleProperty: "Keine (nicht aus der Search Console importieren)",
      noAnalyticsProperty: "Keine (nicht aus Analytics importieren)",
      propertyUnavailable: "{name} (für dieses Google-Konto nicht verfügbar)",
      saveAndImport: "Speichern und importieren",
      saveSelection: "Speichern",
      selectionUnsaved: "Ihre neue Auswahl ist noch nicht gespeichert.",
      noSelectionChange: "Keine Änderungen zu speichern.",
      propertiesSaved: "Properties gespeichert",
      accountTitle: "Google-Konto",
      accountHelp: "Verbinden Sie neu, um den Zugriff zu erneuern oder zu einem anderen Google-Konto zu wechseln. Die gewählten Properties bleiben erhalten.",
      disconnect: "Trennen",
      disconnecting: "Wird getrennt…",
      disconnectTitle: "Google trennen?",
      disconnectBody: "RepGet importiert für diese Website nicht mehr aus der Search Console und aus Analytics und vergisst die gewählten Properties.",
      disconnectKeeps: "Bereits importierte Zahlen bleiben erhalten.",
      disconnectAccess: "Um den Zugriff von RepGet auch in Ihrem Google-Konto zu entfernen, nutzen Sie die Sicherheitseinstellungen Ihres Google-Kontos.",
      cancel: "Abbrechen",
      disconnectFailed: "Google konnte nicht getrennt werden. Versuchen Sie es erneut.",
      importFailed: "Der Import konnte nicht angefordert werden. Versuchen Sie es erneut.",
      googleUnreachable: "Google war mit der gespeicherten Verbindung nicht erreichbar. Verbinden Sie Google neu und versuchen Sie es erneut.",
      errorNotConfigured: "Die Verbindung mit Google ist noch nicht verfügbar. Bitte wenden Sie sich an den Support.",
      errorSignIn: "Melden Sie sich erneut an, um Google zu verbinden.",
      errorReconnect: "Verbinden Sie Ihr Google-Konto neu, um fortzufahren.",
      errorConnectFirst: "Verbinden Sie zuerst Google.",
      errorChooseFirst: "Wählen Sie zuerst eine Property, aus der importiert werden soll.",
      searchTitle: "Google-Suche",
      searchDescription: "Zahlen für die gesamte Website aus der Search Console: alle Seiten Ihrer Website in der Google-Suche, nicht nur die Artikel, die RepGet schreibt.",
      analyticsTitle: "Website-Besuche",
      analyticsDescription: "Sitzungen auf Ihrer gesamten Website aus allen Quellen, laut Google Analytics. Nicht nur Besuche aus der Google-Suche.",
      clicks: "Klicks",
      clicksHint: "Wie oft jemand aus der Google-Suche auf Ihre Website geklickt hat.",
      impressions: "Impressionen",
      impressionsHint: "Wie oft Ihre Website in den Ergebnissen der Google-Suche angezeigt wurde.",
      ctr: "Klickrate (CTR)",
      ctrShort: "CTR",
      ctrHint: "Klicks geteilt durch Impressionen.",
      averagePosition: "Durchschnittliche Position",
      positionShort: "Ø Position",
      positionHint: "Ihr durchschnittlicher Platz in den Google-Ergebnissen, gewichtet nach Impressionen. Niedriger ist besser.",
      sessions: "Sitzungen",
      sessionsHint: "Besuche Ihrer Website aus allen Quellen. Eine Person kann mehrere Sitzungen haben.",
      comparedWith: "Veränderungen im Vergleich zu den vorherigen {days} Tagen.",
      noComparison: "Kein Vergleich: Nicht für alle der vorherigen {days} Tage liegen Zahlen von Google vor.",
      noChange: "Keine Veränderung",
      better: "besser",
      worse: "schlechter",
      pointsChange: "{value} Pp.",
      notAvailable: "Nicht verfügbar",
      daysReported: "Daten für {reported} von {days} Tagen",
      zeroSearch: "Die Search Console hat in diesem Zeitraum keine Impressionen gemeldet.",
      zeroSessions: "Google Analytics hat in diesem Zeitraum keine Sitzungen gemeldet.",
      staleSource: "Es ist keine Property für {source} gewählt, daher werden diese Zahlen nicht mehr aktualisiert.",
      notSelectedTitle: "Keine Property für {source} gewählt",
      notSelectedEditor: "Wählen Sie unter Google-Verbindung eine aus, um diese Zahlen hier zu sehen.",
      notSelectedViewer: "Inhaber oder Bearbeiter können unter Google-Verbindung eine auswählen.",
      awaitingTitle: "Noch keine Zahlen aus {source}",
      awaitingBody: "Google hat für diese Property noch keine Zahlen gemeldet. Neue Websites oder Websites mit wenig Traffic haben möglicherweise eine Zeit lang keine. RepGet prüft jeden Tag, ob es neue Zahlen gibt.",
      noneInPeriodTitle: "Keine Zahlen aus {source} in diesem Zeitraum",
      latestFrom: "Die neuesten Zahlen sind vom {date}. Wählen Sie einen längeren Zeitraum, um sie einzuschließen.",
      latestOnly: "Die neuesten Zahlen sind vom {date}.",
      dailyTitle: "Tag für Tag",
      dailyDescription: "Tage, die Google nicht gemeldet hat, bleiben als Lücke stehen und werden nicht als null gezeichnet.",
      chartMetric: "Im Diagramm gezeigte Zahl",
      chartClicks: "Klicks aus der Google-Suche pro Tag",
      chartImpressions: "Impressionen in der Google-Suche pro Tag",
      chartSessions: "Sitzungen pro Tag",
      unitClicks: "Klicks",
      unitImpressions: "Impressionen",
      unitSessions: "Sitzungen",
      notReported: "nicht gemeldet",
      day: "Tag",
      chartInstructions: "Mit den Pfeiltasten links und rechts wechseln Sie zwischen den Tagen.",
      chartEmpty: "Keine Tageswerte in diesem Zeitraum.",
      topTitle: "Top-Suchanfragen und -Seiten",
      topSearches: "Suchanfragen",
      topPages: "Seiten",
      searchTerm: "Suchanfrage",
      page: "Seite",
      topSearchesNote: "Die 10 Suchanfragen mit den meisten Klicks. Google lässt seltene Suchanfragen zum Schutz der Privatsphäre weg, daher ergeben sie zusammen weniger als die Summen oben.",
      topPagesNote: "Die 10 Seiten mit den meisten Klicks aus der Google-Suche.",
      topSearchesCaption: "Top-Suchanfragen in diesem Zeitraum",
      topPagesCaption: "Top-Seiten in diesem Zeitraum",
      noSearches: "In diesem Zeitraum wurden keine Suchanfragen gemeldet.",
      noPages: "In diesem Zeitraum wurden keine Seiten gemeldet.",
      opensInNewTab: "(öffnet in einem neuen Tab)",
    },
    research: {
      contentPlan: "Contentplan",
      articlesTab: "Artikel",
      opportunities: "Chancen",
      refresh: "Aktualisieren",
      looking: "Suche…",
      researchFailed: "Die Recherche konnte nicht abgeschlossen werden, daher wurde kein Inhaltsplan erstellt. Klicken Sie auf die Schaltfläche, um es erneut zu versuchen - schlägt es zweimal fehl, wenden Sie sich an den Support.",
      planReady: "Ihr Inhaltsplan ist fertig.",
      planNotRebuilt: "Ihr Inhaltsplan konnte nicht neu erstellt werden, der bisherige Plan bleibt daher unverändert. Klicken Sie auf die Schaltfläche, um es erneut zu versuchen - schlägt es zweimal fehl, wenden Sie sich an den Support.",
      keywordsAdded: "Hinzugefügt: {added}.",
      keywordsAddedSkipped: "Hinzugefügt: {added}. Übersprungen: {skipped}, bereits erfasst oder über Ihrem Tarif.",
      replanning: "Ihr Inhaltsplan wird neu erstellt…",
      planBusy: "Ihr Plan wird gerade erstellt - klicken Sie auf {button}, sobald er fertig ist, um sie aufzunehmen.",
      plannedArticles: "Geplante Artikel",
      plannedHelp: "Ihr Contentplan, nach dem Tag, an dem jeder Artikel fällig ist. Fahren Sie über ein geplantes Thema, um es jetzt zu schreiben, zu ändern oder aus dem Plan zu nehmen.",
      articles: "Artikel",
      articlesHelp: "Aus Ihrem Contentplan geschrieben. Öffnen Sie einen, um ihn zu lesen, zu bearbeiten oder neu schreiben zu lassen.",
      nothingWritten: "Noch nichts geschrieben. Nutzen Sie",
      write: "Schreiben",
      title: "Titel",
      status: "Status",
      words: "Wörter",
      keywords: "Suchbegriffe",
      keywordsHelp: "Sortiert danach, was Sie realistisch gewinnen können. Ein Begriff mit weniger Suchanfragen, für den Sie ranken können, schlägt einen beliebten, für den Sie es nicht können.",
      addKeywordsLabel: "Eigene Suchbegriffe hinzufügen",
      addKeywordsButton: "Hinzufügen",
      addKeywordsPlaceholder: "hochzeitsvideograf toskana, elopement film italien",
      addKeywordsHelp: "Mit Komma oder Zeilenumbruch trennen. Begriffe, die Sie hinzufügen, haben keine eigenen Suchdaten, prägen aber trotzdem Ihre Themen und Ihren Contentplan.",
      keyword: "Suchbegriff",
      opportunity: "Chance",
      searchesPerMonth: "Suchanfragen / Monat",
      competition: "Wettbewerb",
      topic: "Thema",
      difficultyLow: "Niedrig",
      difficultyMedium: "Mittel",
      difficultyHigh: "Hoch",
      difficultyVeryHigh: "Sehr hoch",
      researching: "Suchbegriffe werden recherchiert - das dauert eine Minute",
      articleDeleted: "Artikel gelöscht",
      statusQueued: "In Warteschlange",
      statusGenerating: "Wird geschrieben…",
      statusDraft: "Entwurf",
      statusPublished: "Veröffentlicht",
      statusFailed: "Fehlgeschlagen",
    },
    publishing: {
      connectTitle: "Verbinden Sie Ihre Website",
      connectHelp: "Verbinden Sie Ihre Website einmal, und neue Artikel werden automatisch in Ihrem Blog veröffentlicht.",
      nothingConnected: "Noch nichts verbunden",
      nothingConnectedHelp: "Verbinden Sie Ihre Website, dann veröffentlichen wir fertige Artikel direkt dort. Bis dahin können Sie sie von Hand kopieren.",
      publishTest: "Testartikel veröffentlichen",
      publishing: "Wird veröffentlicht…",
      disconnect: "Trennen",
      connected: "Verbunden",
      cantFind: "Ihre Integration nicht gefunden?",
      cantFindHelp: "Sagen Sie uns, welche Plattform Sie nutzen, und wir prüfen die Aufnahme.",
      contactUs: "Kontakt aufnehmen",
      whereDoIFind: "Wo finde ich das?",
      checkBeforeSaving: "Wir prüfen die Verbindung, bevor wir etwas speichern - so erfahren Sie es jetzt und nicht erst, wenn ein Artikel scheitert.",
      noPlatformMatch: "Keine passende Plattform? Veröffentlichen Sie überall per Webhook.",
      forDevelopers: "Für Entwickler",
      connectTo: "{name} verbinden",
      connectedTo: "Mit {name} verbunden",
      disconnectedFrom: "Von {name} getrennt",
      draftPublished: "Entwurf veröffentlicht. Sehen Sie in den Entwürfen Ihrer Website nach.",
      draftPublishedAt: "Entwurf veröffentlicht - öffnen Sie ihn unter {name}",
      pluginRowName: "WordPress-Plugin",
      pluginAwaiting: "Warte auf WordPress",
      pluginAwaitingHelp: "Klicken Sie im von RepGet geöffneten WordPress-Tab auf Finish connecting to RepGet (bei älteren Plugins Save and connect), oder unten auf WordPress verbinden.",
      pluginRowFallback: "Verbunden - wartet auf die erste Rückmeldung.",
    },
    geo: {
      aiVisibility: "KI-Sichtbarkeit",
      aiVisibilityHelp: "Ob ein KI-Assistent Ihr Unternehmen nennt, wenn jemand nach einem Unternehmen wie Ihrem fragt.",
      checkNow: "Jetzt prüfen",
      checking: "Wird geprüft…",
      visibilityScore: "Sichtbarkeitswert",
      weightedByPosition: "Nach Position gewichtet",
      vsLastCheck: "ggü. letzter Prüfung",
      questionsNamingYou: "Fragen, die Sie nennen",
      averagePosition: "Durchschnittliche Position",
      notYetNamed: "Noch nicht genannt",
      whereYouAppear: "Wo Sie in der Liste erscheinen",
      lastChecked: "Zuletzt geprüft",
      questionPlaceholder: "z. B. Welcher Zahnarzt in Utrecht ist am besten für ängstliche Patienten?",
      add: "Hinzufügen",
      suggest: "Vorschlagen",
      askHelp: "Fragen Sie so, wie es ein Kunde täte, und nennen Sie Ihr Unternehmen nicht - es geht darum, ob Sie von selbst auftauchen.",
      suggestedQuestions: "Vorgeschlagene Fragen - zum Verfolgen anklicken",
      noQuestions: "Noch keine Fragen verfolgt",
      noQuestionsHelp: "Fügen Sie die Fragen hinzu, die Ihre Kunden einem KI-Assistenten stellen würden, und prüfen Sie dann, ob Ihr Unternehmen in der Antwort genannt wird.",
      notChecked: "Nicht geprüft",
      notNamed: "Nicht genannt",
      stopTracking: "Diese Frage nicht mehr verfolgen",
      questionAdded: "Frage hinzugefügt",
      checkQueued: "Wird geprüft - Ergebnisse erscheinen hier in wenigen Minuten",
      alreadyTracking: "Sie verfolgen bereits die Fragen, die wir vorschlagen würden",
      checksUnavailableTitle: "Prüfungen und Vorschläge sind für diese Website pausiert",
      errAiUnavailable: "KI-Prüfungen sind im Moment nicht verfügbar. Bitte versuchen Sie es später erneut.",
      errNoPlan: "Wählen Sie einen Tarif für diese Website, um Prüfungen zu starten und Vorschläge zu erhalten.",
      errPlanInactive: "Das Abonnement dieser Website ist nicht aktiv. Aktualisieren Sie die Abrechnung, um Prüfungen zu starten und Vorschläge zu erhalten.",
      errCheckQuota: "Die KI-Sichtbarkeit wurde in der letzten Stunde schon mehrmals geprüft. Bitte versuchen Sie es später erneut.",
      errSuggestQuota: "In dieser Stunde wurden schon viele Vorschläge angefordert. Bitte versuchen Sie es später erneut.",
      errSuggestFailed: "Es konnten keine Fragen vorgeschlagen werden. Bitte versuchen Sie es erneut.",
      errTooShort: "Schreiben Sie eine Frage aus mindestens ein paar Wörtern.",
      errAllowance: "Ihr Tarif verfolgt bis zu {count} Fragen. Entfernen Sie eine, um eine andere hinzuzufügen.",
      errDuplicate: "Sie verfolgen diese Frage bereits.",
      errAddFirst: "Fügen Sie zuerst eine Frage hinzu.",
      errUnexpected: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
      statusQueuedTitle: "Prüfung in der Warteschlange",
      statusQueuedBody: "Warten auf den Start der Prüfung. Die Antworten erscheinen hier Frage für Frage, und Sie können diese Seite in der Zwischenzeit verlassen.",
      statusRunningTitle: "Ihre Fragen werden geprüft",
      statusRunningBody: "Die Antworten erscheinen hier Frage für Frage. Sie können diese Seite in der Zwischenzeit verlassen.",
      statusProgress: "{answered} von {total} Fragen beantwortet",
      statusRequestedAt: "Angefordert am {date}",
      statusCompletedTitle: "Prüfung abgeschlossen",
      statusCompletedBody: "Jede Frage dieser Prüfung hat eine neue Antwort.",
      statusPartialTitle: "Prüfung mit Lücken beendet",
      statusPartialBody: "{answered} von {total} Fragen haben eine neue Antwort erhalten. Die übrigen haben innerhalb von 10 Minuten keine erhalten; sie behalten ihr früheres Ergebnis und sind unten markiert.",
      statusTimedOutTitle: "Noch keine Antworten",
      statusTimedOutBody: "Innerhalb von 10 Minuten ist keine Antwort eingegangen. Die Prüfung wartet vielleicht noch auf ihren Start, oder sie ist fehlgeschlagen. Sehen Sie später noch einmal nach oder starten Sie eine neue Prüfung.",
      statusTimedOutBodyViewer: "Innerhalb von 10 Minuten ist keine Antwort eingegangen. Die Prüfung wartet vielleicht noch auf ihren Start, oder sie ist fehlgeschlagen. Sehen Sie später noch einmal nach.",
      statusFailedTitle:"Die Prüfung wurde nicht durchgeführt",
      statusFailedBody: "Für die am {date} angeforderte Prüfung wurde keine Antwort gespeichert. Sie können eine neue Prüfung starten.",
      statusFailedBodyViewer: "Für die am {date} angeforderte Prüfung wurde keine Antwort gespeichert.",
      statusRefusedTitle: "Die Prüfung wurde nicht gestartet",
      dismiss: "Ausblenden",
      progressLabel: "Fortschritt der Prüfung",
      performanceTitle: "So steht Ihre Website da",
      performanceHelp: "Gemessen an der neuesten Antwort auf jede geprüfte Frage.",
      howMeasured: "So wird gemessen",
      scoreOutOf: "von 100",
      scoreGood: "Gut",
      scoreFair: "Mittel",
      scoreLow: "Niedrig",
      scoreUp: "{change} Punkte mehr als bei der vorigen Prüfung",
      scoreDown: "{change} Punkte weniger als bei der vorigen Prüfung",
      scoreSame: "Keine Veränderung seit der vorigen Prüfung",
      previousCheckOn: "Vorige Prüfung: {date}",
      firstCheck: "Erste Prüfung, daher noch kein Vergleich",
      namedOfChecked: "{mentions} von {total}",
      namedOfCheckedHelp: "Geprüfte Fragen, bei denen Ihr Unternehmen empfohlen wurde",
      positionValue: "Nr. {position}",
      answeredInLatestCheck: "{count} von {total} Fragen in dieser Prüfung beantwortet",
      basisNote: "Basiert auf der neuesten Antwort auf {checked} von {tracked} verfolgten Fragen.",
      earlierAnswersNote: "1 dieser Antworten stammt aus einer früheren Prüfung.|{count} dieser Antworten stammen aus früheren Prüfungen.",
      notCheckedYetTitle: "Noch nicht geprüft",
      notCheckedYetBody: "Es wurde noch keine Frage geprüft, daher gibt es noch keinen Wert. Ein Wert erscheint erst, wenn ein Assistent tatsächlich gefragt wurde.",
      competitorsHelp: "Andere Unternehmen, die in den neuesten Antworten empfohlen wurden, nach Anzahl der Antworten, die sie nennen.",
      competitorCount: "In {count} von {total} Antworten genannt",
      noCompetitors: "In den neuesten Antworten wurden keine anderen Unternehmen genannt.",
      nextStep: "Nächster Schritt",
      nextAddQuestions: "Fügen Sie die Fragen hinzu, die Ihre Kunden stellen würden, oder lassen Sie sich Vorschläge machen.",
      nextAddQuestionsAction: "Fragen hinzufügen",
      nextFirstCheck: "Starten Sie die erste Prüfung, um zu sehen, ob Assistenten Ihr Unternehmen nennen.",
      nextUnchecked: "1 Frage wurde noch nicht geprüft. Starten Sie eine Prüfung, um sie einzubeziehen.|{count} Fragen wurden noch nicht geprüft. Starten Sie eine Prüfung, um sie einzubeziehen.",
      nextStale: "1 Antwort stammt aus einer früheren Prüfung. Starten Sie eine Prüfung, um sie zu aktualisieren.|{count} Antworten stammen aus früheren Prüfungen. Starten Sie eine Prüfung, um sie zu aktualisieren.",
      nextNotNamed: "Bei 1 Frage haben die Assistenten Sie nicht genannt. Sehen Sie, wen sie stattdessen genannt haben.|Bei {count} Fragen haben die Assistenten Sie nicht genannt. Sehen Sie, wen sie stattdessen genannt haben.",
      nextNotNamedAction: "Diese Fragen anzeigen",
      nextUpToDate: "Ihre Ergebnisse sind aktuell. Prüfungen laufen außerdem automatisch einmal pro Woche.",
      nextWaiting: "Eine Prüfung läuft. Die Ergebnisse erscheinen, sobald jede Frage beantwortet ist.",
      nextViewer: "Nur ein Inhaber oder ein Bearbeiter kann Prüfungen starten oder die Fragen ändern.",
      questionsTitle: "Verfolgte Fragen",
      questionsHelp: "Die Fragen, die Sie verfolgen, jeweils mit dem neuesten Ergebnis und den Belegen dafür.",
      allowanceCount: "{count} von {max} Fragen",
      addQuestionLabel: "Frage hinzufügen",
      atAllowance: "Sie verfolgen so viele Fragen, wie Ihr Tarif erlaubt ({max}). Entfernen Sie eine, um eine andere hinzuzufügen.",
      suggestionsTitle: "Vorgeschlagene Fragen",
      suggestionsHelp: "Wählen Sie die Fragen aus, die Sie verfolgen möchten. Erst mit Auswahl hinzufügen wird etwas hinzugefügt.",
      addSelected: "Auswahl hinzufügen ({count})",
      suggestionsRoom: "Mit Ihrem Tarif können Sie noch 1 Frage hinzufügen.|Mit Ihrem Tarif können Sie noch {count} Fragen hinzufügen.",
      questionsAdded: "1 Frage hinzugefügt|{count} Fragen hinzugefügt",
      questionRemoved: "Frage entfernt",
      filterLabel: "Fragen anzeigen",
      filterAll: "Alle",
      filterEmpty: "Keine Frage passt zu diesem Filter.",
      showAll: "Alle Fragen anzeigen",
      noQuestionsViewer: "Es werden noch keine Fragen verfolgt. Ein Inhaber oder ein Bearbeiter kann sie hinzufügen.",
      named: "Genannt",
      namedAt: "Genannt auf Nr. {position}",
      checkedOn: "Geprüft am {date}",
      fromEarlierCheck: "Aus einer früheren Prüfung ({date})",
      checkingNow: "Wird geprüft…",
      noAnswerInCheck: "Keine Antwort in der letzten Prüfung",
      answeredInCheck: "In dieser Prüfung beantwortet",
      siteMentioned: "Ihre Website wurde erwähnt",
      showEvidence: "Belege anzeigen",
      hideEvidence: "Belege ausblenden",
      removeQuestionLabel: "Nicht mehr verfolgen: {question}",
      evidenceExcerpt: "Was die Antwort sagte",
      evidenceExcerptNote: "Gespeichert wird nur der Satz, der Ihr Unternehmen nennt, nicht die vollständige Antwort.",
      evidencePosition: "Ihre Position",
      evidencePositionValue: "Nr. {position} unter den Unternehmen, die die Antwort empfohlen hat",
      evidenceNotRecommended: "Nicht unter den Unternehmen, die die Antwort empfohlen hat",
      evidenceWebsite: "Ihre Website-Adresse",
      evidenceWebsiteYes: "In der Antwort erwähnt",
      evidenceWebsiteNo: "In der Antwort nicht erwähnt",
      evidenceOthers: "Andere genannte Unternehmen, in Reihenfolge",
      evidenceNoOthers: "Es wurden keine anderen Unternehmen genannt.",
      evidenceAssistant: "Gefragter Assistent",
      evidenceChecked: "Geprüft",
      evidenceHistory: "Frühere Ergebnisse",
      evidenceNoHistory: "Das ist das erste gespeicherte Ergebnis für diese Frage.",
      evidenceStale: "Diese Antwort stammt aus einer früheren Prüfung. Die letzte Prüfung am {date} hat für diese Frage keine neue Antwort geliefert.",
      evidenceMissed: "Die letzte Prüfung hat für diese Frage keine neue Antwort geliefert, daher ist dies ihr früheres Ergebnis.",
      removeTitle: "Diese Frage nicht mehr verfolgen?",
      removeBody: "Ihre gespeicherten Antworten und ihr Verlauf werden ebenfalls gelöscht, und der Wert wird ohne sie neu berechnet. Das lässt sich nicht rückgängig machen.",
      removeConfirm: "Nicht mehr verfolgen",
      removing: "Wird entfernt…",
      methodTitle: "Was gemessen wird",
      methodHelp: "Wie eine Prüfung abläuft und was jede Zahl bedeutet.",
      methodAskTitle: "So läuft eine Prüfung ab",
      methodAskBody: "Jede verfolgte Frage wird einem KI-Assistenten in einem neuen Gespräch gestellt, ohne Ihr Unternehmen zu nennen. Danach wird die Antwort ausgewertet und die empfohlenen Unternehmen werden der Reihe nach erfasst.",
      methodRecordTitle: "Was gespeichert wird",
      methodRecordBody: "Ob Ihr Unternehmen darunter ist und an welcher Position, der Satz, der es nennt, die anderen genannten Unternehmen und ob Ihre Website-Adresse vorkommt. Die vollständige Antwort wird nicht gespeichert.",
      methodScoreTitle: "So wird der Wert berechnet",
      methodScoreBody: "Eine geprüfte Frage zählt 100, wenn Sie als Erstes genannt werden, weiter unten in der Liste weniger (etwa {second} auf Platz zwei, {third} auf Platz drei und {fourth} auf Platz vier) und 0, wenn Sie nicht genannt werden. Der Sichtbarkeitswert ist der Durchschnitt über die neueste Antwort auf jede geprüfte Frage. Nie geprüfte Fragen zählen nicht mit.",
      methodCompareTitle: "Vergleiche",
      methodCompareBody: "Die Veränderung wird gegenüber der vorigen Prüfung gemessen, bewertet anhand ihrer eigenen Antworten. Antworten, die mehr als eine Stunde auseinanderliegen, gehören zu verschiedenen Prüfungen. Haben die beiden Prüfungen unterschiedliche Fragen abgedeckt, geht ein Teil der Veränderung darauf zurück.",
      methodScheduleTitle: "Wann geprüft wird",
      methodScheduleBody: "Wenn ein Inhaber oder ein Bearbeiter auf {action} klickt (nur begrenzt oft pro Stunde), und automatisch einmal pro Woche. Die Antworten treffen Frage für Frage innerhalb weniger Minuten ein.",
      methodAssistantsTitle: "Gefragte Assistenten",
      methodAssistantsBody: "Die bisher gespeicherten Antworten stammen von: {names}.",
    },
    backlinks: {
      title: "Links von anderen Websites",
      joinHelp: "Google vertraut einer Website mehr, wenn andere Seiten auf sie verlinken. Erwähnen Sie ein anderes Unternehmen in Ihren Artikeln, um ein Credit zu verdienen, und geben Sie es aus, um selbst erwähnt zu werden.",
      capLabel: "Erwähnungen, die Sie pro Monat aufnehmen",
      capHelp: "Halten Sie diese Zahl niedrig. Eine Seite voller Links zu anderen Unternehmen wirkt auf Google verdächtig.",
      join: "Beitreten",
      leave: "Verlassen",
      inTheNetwork: "Im Netzwerk",
      creditsAvailable: "Credits verfügbar",
      received: "Erhaltene Backlinks",
      receivedFlow: "In anderen Artikeln erwähnt \u2192 Backlinks erhalten \u2192 Credits ausgeben",
      givenTitle: "Vergebene Backlinks",
      givenFlow: "Artikel veröffentlichen \u2192 Backlinks vergeben \u2192 Credits verdienen",
      whichPage: "Auf welche Ihrer Seiten soll verlinkt werden?",
      suggestMyPages: "Meine Seiten vorschlagen",
      readingSitemap: "Ihre Sitemap wird gelesen…",
      anchorLabel: "Gewünschter Linktext (optional)",
      anchorPlaceholder: "Zahnaufhellung in Dublin",
      requesting: "Wird angefragt…",
      requestLink: "Link anfragen (1 Credit)",
      noRequests: "Noch keine Links erhalten",
      noRequestsHelp: "Fügen Sie oben im Partnernetzwerk die Seiten hinzu, auf die Links zeigen sollen. Das RepGet-Team platziert sie in passenden Artikeln von Partnern; ein Link kostet seine Credits erst, wenn er als live bestätigt ist.",
      noneGiven: "Noch keine. Das RepGet-Team kann vor der Veröffentlichung den Link eines passenden Partners in einen Ihrer Artikel setzen; Sie erhalten die Credits, sobald er als live bestätigt ist.",
      sourceArticle: "Quellartikel",
      sourceArticleHint: "Der Artikel auf einer anderen Website, der auf Sie verlinkt. Öffnen Sie ihn, um den aktiven Link zu sehen.",
      customerWebsite: "Website des Kunden",
      customerWebsiteHint: "Die Website im Netzwerk, die den Link veröffentlicht hat.",
      creditsUsed: "Verbrauchte Credits",
      creditsUsedHint: "Für diesen Link ausgegebene Credits. Werden vollständig erstattet, falls der Link entfernt wird.",
      yourArticleHint: "Ihr Artikel, der den Link enthält.",
      destinationWebsite: "Zielwebsite",
      destinationWebsiteHint: "Die Website, auf die Ihr Artikel verlinkt.",
      creditsEarned: "Verdiente Credits",
      creditsEarnedHint: "Credits, die Ihnen dieser Link eingebracht hat - für Links zurück auf Ihre eigene Seite.",
      onceLive: "+{n} sobald live",
      held: "{n} reserviert",
      cancelRequest: "Anfrage abbrechen",
      untitledArticle: "Artikel ohne Titel",
      joined: "Sie sind im Netzwerk",
      leftNetwork: "Netzwerk verlassen",
      requestSaved: "Anfrage gespeichert - warten auf eine passende Website",
      requestCancelled: "Anfrage abgebrochen, Credit freigegeben",
      statusPending: "Website wird gesucht",
      statusMatched: "Warten auf deren nächsten Artikel",
      statusLive: "Aktiv",
      statusCancelled: "Abgebrochen",
      statusRemoved: "Entfernt - Credit erstattet",
      hosting: "Nimmt bis zu {cap} Links pro Monat auf ({used} genutzt). {sites} Website kann auf Sie verlinken.|Nimmt bis zu {cap} Links pro Monat auf ({used} genutzt). {sites} Websites können auf Sie verlinken.",
      reserved: " ({n} reserviert)",
    },
    dashboard: {
      noWebsite: "Noch keine Website verbunden",
      noWebsiteHelp: "Fügen Sie Ihre Website hinzu, dann suchen wir die Suchbegriffe, die Ihre Kunden tatsächlich verwenden.",
      addWebsite: "Website hinzufügen",
      couldNotLoad: "Diese Website konnte nicht geladen werden",
      couldNotLoadHelp: "Versuchen Sie es erneut oder wählen Sie eine andere Website.",
      overview: "SEO-Überblick",
      openWebsite: "Website öffnen",
      performing: "Wie {domain} in der Suche abschneidet.",
      sharedBadge: "Mit Ihnen geteilt · {role}",
      ownerPlanInactive: "Diese Website ist pausiert",
      ownerPlanInactiveHelp:
        "Der Tarif für {domain} ist nicht aktiv, daher kann nichts Neues erstellt werden. Bitten Sie den Inhaber der Website, ihn zu verlängern.",
      invitesTitle: "Sie wurden eingeladen",
      inviteBody: "{name} hat Sie eingeladen, als {role} an {domain} mitzuarbeiten.",
      inviteBodyNoName: "Sie wurden eingeladen, als {role} an {domain} mitzuarbeiten.",
      roleAnEditor: "Redakteur",
      roleAViewer: "Leser",
      acceptInvite: "Einladung annehmen",
      inviteAccepted: "Sie haben jetzt Zugriff auf {domain}",
    },
    calendar: {
      changeTopic: "Thema ändern",
      addInstructions: "Anweisungen hinzufügen",
      removeFromPlan: "Aus dem Plan entfernen",
      instructionsPlaceholder: "Alles, was dieser Artikel behandeln oder vermeiden soll.",
      previousMonth: "Voriger Monat",
      nextMonth: "Nächster Monat",
      savedInstructions: "Gespeichert - wir verwenden das beim Schreiben",
      removedFromPlan: "Aus dem Plan entfernt",
      writingStarted: "Schreiben gestartet - das dauert einige Minuten",
    },
    addons: {
      moreCredits: "Mehr Link-Credits",
      moreCreditsHelp: "Ihr Tarif enthält monatlich Credits. Kaufen Sie mehr, wenn sie ausgehen - diese verfallen nicht.",
      termsPill: "Einmaliger Kauf · Credits verfallen nicht",
      oneTime: "Einmaliger Kauf",
      neverExpire: "Credits verfallen nicht",
      useAnytime: "Jederzeit einsetzbar",
      buyThis: "Kaufen",
      buyCredits: "{n} Credits kaufen",
      unavailable: "Nicht verfügbar",
      checkoutFailed: "Der Bezahlvorgang konnte nicht gestartet werden. Bitte erneut versuchen.",
      yourPurchases: "Ihre Käufe",
      added: "Hinzugefügt",
      delivered: "Geliefert",
      inProgress: "In Bearbeitung",
      requestQuote: "Angebot anfordern",
      quoteHelp: "Wir erstellen ein Angebot, nachdem wir Ihr Audit geprüft haben.",
      title: "Add-ons",
      subtitle: "Einmalige Käufe zusätzlich zu Ihrem Tarif.",
      perCredit: "{price} pro Credit",
      quoteFrom: "Ab {price}. Wir erstellen ein Angebot, nachdem wir Ihr Audit geprüft haben.",
      servicesTitle: "Leistungen",
      showingRecent: "Angezeigt werden Ihre {count} neuesten Käufe.",
    },
    referral: {
      referSomeone: "Jemanden empfehlen",
      linkLabel: "Ihr Empfehlungslink",
      copy: "Kopieren",
      copied: "Kopiert",
      copyFailed: "Kopieren nicht möglich. Markieren Sie den Link und kopieren Sie ihn von Hand.",
      linkCopied: "Link kopiert",
      creditsEarned: "Verdiente Credits",
      waitingToConvert: "Warten auf Umwandlung",
      signedUpNotPaying: "Registriert, zahlt noch nicht",
      peopleReferred: "Von Ihnen empfohlene Personen",
      someoneReferred: "Eine von Ihnen empfohlene Person",
      notEligible: "Nicht berechtigt",
      waiting: "Wartet",
      cardDescription: "Teilen Sie Ihren Link. Wenn jemand, den Sie empfohlen haben, den ersten Monat bezahlt, erhalten Sie {credits} Link-Credits.",
      joinedWithName: "{name} · beigetreten am {date}",
      joined: "Beigetreten am {date}",
      noWebsiteJoined: "Noch keine Website · beigetreten am {date}",
      creditsBadge: "+{count} Credits",
      linkHelp: "Wer sich über diesen Link registriert, zählt als Ihre Empfehlung.",
      peopleReferredStat: "Empfohlene Personen",
      noReferralsYet: "Über Ihren Link hat sich noch niemand registriert.",
      showingRecent: "Angezeigt werden Ihre {count} neuesten Empfehlungen.",
      rewardedOn: "Credits gutgeschrieben am {date}",
      unavailable: "Ihre Empfehlungsdaten konnten nicht geladen werden. Laden Sie die Seite neu, um es erneut zu versuchen.",
    },
    keys: {
      updatePlugin: "WordPress hat das Plugin {version}. Version 1.7 verbindet sich mit einem Klick, zeigt, für welches RepGet-Konto es veröffentlicht, und aktualisiert sich selbst: Laden Sie es herunter, gehen Sie in WordPress zu Plugins → Neues Plugin hinzufügen → Plugin hochladen und wählen Sie „Aktuelle Version durch hochgeladene ersetzen“.",
      keyCopied: "Schlüssel kopiert",
      keyCopyFailed: "Kopieren nicht möglich. Markieren Sie den Schlüssel und kopieren Sie ihn von Hand.",
      keyRevoked: "Schlüssel widerrufen",
      newKeyLabel: "Ihr neuer Integrationsschlüssel",
      openWordPress: "Mein WordPress öffnen",
      neverUsed: "Nie verwendet",
      pluginTitle: "WordPress-Plugin",
      pluginHelp: "Installieren Sie unser Plugin, verbinden Sie es mit einem Klick, und Artikel erscheinen hier automatisch.",
      copyNowHelp: "Wir speichern nur eine verschlüsselte Fassung, sie lässt sich später nicht nachschlagen. Geht sie verloren, widerrufen Sie sie und erstellen eine neue.",
      newKey: "Neuer Schlüssel",
      keyNotePlaceholder: "Wofür ist dieser Schlüssel? (optional)",
      nextSteps: "Öffnen Sie in WordPress im Menü RepGet, fügen Sie diesen Schlüssel ein und klicken Sie auf Save and connect.",
      connectingIn: "{domain} wird im Arbeitsbereich „{workspace}“ verbunden.",
      stepInstall: "1. Plugin installieren",
      stepInstallHelp: "Laden Sie es herunter, dann in WordPress hochladen und aktivieren (Plugins → Neues Plugin hinzufügen → Plugin hochladen). Überspringen, wenn es schon installiert ist.",
      stepConnect: "2. Verbinden",
      stepConnectHelp: "Öffnet Ihr WordPress, bereit zum Verbinden. Klicken Sie dort auf Finish connecting to RepGet (vor Plugin 1.7: Save and connect) – nichts zu kopieren.",
      connectButton: "WordPress verbinden",
      reconnectButton: "Erneut verbinden",
      waitingTitle: "Warten auf WordPress…",
      waitingHelp: "Klicken Sie im geöffneten WordPress-Tab auf Finish connecting to RepGet (oder Save and connect). Fragt WordPress zuerst nach der Anmeldung, melden Sie sich an und klicken Sie dann auf WordPress erneut öffnen.",
      stalledHelp: "Wartet es noch? Zeigt Ihr WordPress bereits Connected an, nutzt es einen anderen Schlüssel – etwa von einem anderen RepGet-Konto oder einem Test. Schließen Sie im geöffneten Tab ab, um es auf dieses Konto umzustellen.",
      openAgain: "WordPress erneut öffnen",
      copyInstead: "Schlüssel kopieren",
      popupBlocked: "Ihr Browser hat den neuen Tab blockiert. Nutzen Sie WordPress erneut öffnen, oder kopieren Sie den Schlüssel und fügen ihn in WordPress ein.",
      connectedTitle: "Verbunden",
      lastCheckIn: "Zuletzt gemeldet: {date}",
      connectedToast: "WordPress ist verbunden",
      alsoIn: "Sie haben {domain} auch in {workspaces}. Eine WordPress-Website kann nur für eines davon veröffentlichen: Das entscheidet der in WordPress gespeicherte Schlüssel.",
      madeByConnect: "Erstellt mit WordPress verbinden",
      advancedTitle: "Schlüssel (erweitert)",
      advancedHelp: "Jede WordPress-Installation speichert einen Schlüssel. Sie brauchen diese nur, um eine weitere Installation von Hand zu verbinden oder eine Installation zu stoppen (Widerrufen).",
      keyReplaced: "Dieser Schlüssel wurde ersetzt oder widerrufen, bevor WordPress ihn benutzt hat. Klicken Sie erneut auf WordPress verbinden.",
      waitingResumed: "Warten darauf, dass WordPress den gerade erstellten Schlüssel benutzt. Haben Sie den WordPress-Tab geschlossen, klicken Sie erneut auf WordPress verbinden.",
      gaveUp: "Warten beendet. Haben Sie in WordPress abgeschlossen, laden Sie diese Seite neu; sonst klicken Sie erneut auf WordPress verbinden.",
      notActiveHelp: "Meldet WordPress, dass Sie diese Seite nicht aufrufen dürfen, ist das Plugin noch nicht aktiv: Erledigen Sie Schritt 1 und klicken Sie dann auf WordPress erneut öffnen.",
      madeByHand: "Von Hand hinzugefügt",
      quotedName: "„{name}“",
    },
    partnerNetwork: {
      title: "Partnernetzwerk",
      subtitle: "Legen Sie fest, wie Ihre Website am Backlink-Netzwerk von RepGet teilnimmt.",
      participationTitle: "Teilnahme am Netzwerk",
      participationHelp: "Nehmen Sie am RepGet-Partnernetzwerk teil, um relevante Links zu hosten und Links zu Ihren Seiten zu erhalten.",
      enabled: "Aktiviert",
      disabled: "Deaktiviert",
      whatTitle: "Was das bewirkt",
      whatBody: "Das RepGet-Team setzt relevante Links aus Partnerartikeln auf die von Ihnen genannten Seiten und kann Partnerlinks in Ihre Artikel setzen, bevor diese veröffentlicht werden. Ihr Workspace verdient Credits für jeden gehosteten Link und gibt Credits für jeden erhaltenen Link aus – erst wenn der Link live bestätigt ist. Sie müssen weder Partner auswählen noch jeden Link freigeben.",
      offNote: "Wenn Sie das ausschalten, werden keine neuen Links mehr arrangiert. Bereits gesetzte Links bleiben bestehen und werden weiter geprüft und gutgeschrieben.",
      inReview: "{n} Ihrer Artikel werden vom RepGet-Team geprüft.",
      ratingTitle: "Mindestautorität",
      ratingHelp: "Die Mindestautorität einer Website, die auf Sie verlinkt.",
      ratingUnconfigured: "Noch nicht verfügbar: Die Autorität der Netzwerk-Websites wird nicht gemessen, daher kann kein Minimum durchgesetzt werden. Das RepGet-Team prüft jede verlinkende Website von Hand.",
      targetsTitle: "Zielseiten",
      targetsHelp: "Wählen und priorisieren Sie, welche Seiten Ihrer Website Backlinks erhalten sollen.",
      addTarget: "Zielseite hinzufügen",
      urlLabel: "Seitenadresse",
      noteLabel: "Was diese Seite ist (optional)",
      priorityLabel: "Priorität",
      high: "Hoch",
      medium: "Mittel",
      low: "Niedrig",
      moveUp: "Nach oben",
      moveDown: "Nach unten",
      remove: "Entfernen",
      noTargets: "Noch keine Zielseiten. Fügen Sie die Seiten hinzu, für die Sie am meisten Links möchten.",
      targetAdded: "Zielseite hinzugefügt",
      saved: "Gespeichert",
      turnedOn: "Sie sind im Partnernetzwerk",
      turnedOff: "Sie haben das Partnernetzwerk verlassen",
      creditsLine: "{available} Credits verfügbar · {reserved} reserviert",
      add: "Hinzufügen",
      cancel: "Abbrechen",
      ratingMetric: "Gemessen als Domain-Autorität (0-100) der verlinkenden Website.",
      ratingNone: "Kein Minimum",
      ratingNoneHelp: "Jeder passende Partner darf auf Sie verlinken; das RepGet-Team prüft jede Website von Hand.",
      ratingSliderLabel: "Mindest-Domain-Autorität",
      ratingCurrent: "Nur Links von Websites mit Domain-Autorität {n} oder höher",
      ratingScaleOnly: "Ihr Tarif reicht bis {cap}. Eine Domain-Autorität über {cap} gibt es mit dem Scale-Tarif.",
      ratingSave: "Minimum speichern",
      ratingSaved: "Minimum gespeichert",
      ratingNoAccess: "Noch nicht verfügbar: Die Domain-Autorität kann derzeit nicht gemessen werden. Das RepGet-Team prüft jede verlinkende Website von Hand.",
    },
    reports: {
      subnavLabel: "Backlink-Bereiche",
      navOverview: "Übersicht",
      navEarned: "Erhaltene Backlinks",
      navHosted: "Gehostete Links",
      navCredits: "Credit-Aktivität",
      authorityLabel: "Domain-Autorität",
      authorityValueAria: "Domain-Autorität {value} von {max}",
      authorityUpdated: "Aktualisiert am {date}",
      authorityStale: "Vom {date} - Aktualisierung steht aus",
      authorityCollecting: "Wird erhoben",
      authorityNoAccess: "Noch nicht verfügbar",
      authorityNoData: "Noch keine Daten zu dieser Website",
      authorityError: "Konnte nicht erhoben werden - neuer Versuch folgt",
      authorityNotConfigured: "Noch nicht eingerichtet",
      authorityWhat: "Was ist das?",
      authorityHelp: "Ein Wert von 0 bis 100, basierend auf den Websites, die auf eine Domain verlinken. Er ist nicht Ihr Website-Gesundheitswert.",
      authorityDetail: "Domain-Autorität {value}/{max}, gemessen am {date}",
      authorityUnavailableDetail: "Noch nicht verfügbar",
      rankStaleTitle: "Domain-Autorität - älter als 30 Tage",
      unknownShort: "k. A.",
      unknownRank: "Autorität unbekannt",
      issueHosted: "In {count} Ihrer Artikel fehlt der Link eines Partners - keine Credits verdient|In {count} Ihrer Artikel fehlt der Link eines Partners - keine Credits verdient",
      issueHostedHelp: "Der Link wurde nach mehreren Prüfungen im veröffentlichten Artikel nicht gefunden. Stellen Sie ihn wieder her und fordern Sie eine neue Prüfung an.",
      issueReceived: "{count} Link zu Ihrer Website wurde auf der Partnerseite nicht gefunden - nichts berechnet|{count} Links zu Ihrer Website wurden auf den Partnerseiten nicht gefunden - nichts berechnet",
      issueReceivedHelp: "Credits werden erst verbraucht, wenn ein Link als live bestätigt ist. Das RepGet-Team klärt es mit dem Partner.",
      reviewResolve: "Prüfen und beheben",
      dismiss: "Ausblenden",
      issueFilterGiven: "Angezeigt werden Links, die in Ihren veröffentlichten Artikeln fehlen. Stellen Sie jeden Link wieder her und nutzen Sie „Erneut prüfen“.",
      issueFilterReceived: "Angezeigt werden Links, die auf der Partnerseite fehlen. Dafür wurde nichts berechnet.",
      issueNofollowHosted: "{count} Partnerlink in Ihren Artikeln ist nofollow - er bringt keinen SEO-Wert|{count} Partnerlinks in Ihren Artikeln sind nofollow - sie bringen keinen SEO-Wert",
      issueNofollowHostedHelp: "Suchmaschinen ignorieren Links mit nofollow oder sponsored. Bearbeiten Sie den Beitrag, entfernen Sie nofollow / sponsored vom Partnerlink und fordern Sie eine neue Prüfung an.",
      issueNofollowReceived: "{count} Link auf Ihre Website ist auf der Partnerseite nofollow|{count} Links auf Ihre Website sind auf den Partnerseiten nofollow",
      issueNofollowReceivedHelp: "Diese Links sind live, bringen aber wenig SEO-Wert. Der Websitebetreiber wurde gebeten, sie auf follow umzustellen.",
      issueFilterNofollowGiven: "Angezeigt werden Partnerlinks mit nofollow in Ihren veröffentlichten Artikeln. Entfernen Sie nofollow / sponsored von jedem Link und nutzen Sie dann „Erneut prüfen“.",
      issueFilterNofollowReceived: "Angezeigt werden Links auf Ihre Website, die die Partnerseite als nofollow markiert. Der Websitebetreiber wurde gebeten, sie zu korrigieren.",
      nofollowBadge: "Nofollow",
      overviewTitle: "Backlink-Übersicht",
      overviewIntro: "Ihr Link-Portfolio, Ihr Credit-Guthaben und die Einstellungen, denen das RepGet-Team beim Platzieren von Links folgt.",
      portfolioTitle: "Backlink-Portfolio",
      verifiedBacklinks: "bestätigter Backlink|bestätigte Backlinks",
      referringDomains: "von {count} Website|von {count} Websites",
      strongestLink: "Stärkste Quelle",
      strongestHelp: "Die höchste Domain-Autorität unter den Websites, die mit einem bestätigten Link auf Sie verweisen.",
      last30Days: "Letzte 30 Tage",
      newInWindowHelp: "Links, die in den letzten 30 Tagen (UTC) erstmals bestätigt wurden.",
      estimatedValue: "Geschätzter Gegenwert",
      estimateNotConfigured: "Schätzung nicht eingerichtet",
      estimateNotConfiguredHelp: "RepGet zeigt eine Geldschätzung erst, wenn das Team die Sätze und ihre Quellen veröffentlicht hat. Bis dahin wird keine Zahl gezeigt statt einer erfundenen.",
      howEstimated: "Wie wird das geschätzt?",
      estimateMethod: "Bewertungsrichtlinie v{version} ({currency}), gültig seit {date}: ein Satz pro bestätigtem Link, abhängig von der Domain-Autorität der verlinkenden Website. Quellen: {sources}. Eine Schätzung, was gleichwertige Links kosten würden - kein gespartes oder verdientes Geld.",
      unvaluedLinks: "{count} bestätigter Link hat keinen passenden Satz und ist nicht enthalten.|{count} bestätigte Links haben keinen passenden Satz und sind nicht enthalten.",
      mostRecentLinks: "Neueste Links",
      colVerified: "Bestätigt",
      verifiedDateHelp: "Der Tag, an dem der Link erstmals live gesehen wurde.",
      noVerifiedYet: "Noch keine bestätigten Links. Sie erscheinen hier, sobald die Prüfung sie live sieht.",
      pipeline: "{publication} warten auf Veröffentlichung · {verification} warten auf Prüfung",
      seeAllBacklinks: "Alle Backlinks ansehen",
      creditsCardTitle: "Backlink-Credits",
      creditActivity: "Credit-Aktivität",
      creditsAvailableLine: "verfügbar · {reserved} reserviert für Links in Arbeit · Guthaben {balance}",
      recoverFromArticles: "Credits aus {count} Artikel zurückholen|Credits aus {count} Artikeln zurückholen",
      buyCredits: "Link-Credits kaufen",
      creditsHowItWorks: "Sie verdienen Credits, wenn der Link eines Partners in Ihrem Artikel als live bestätigt ist, und verbrauchen sie, wenn ein Link zu Ihrer Website bestätigt ist. Während ein Link platziert wird, sind die Credits reserviert; wird ein bestätigter Link später entfernt, werden sie zurückgebucht.",
      creditsScopeNote: "Credits gehören zu Ihrem Arbeitsbereich und werden von allen seinen Websites geteilt.",
      creditsOwnerOnly: "Credits gehören dem Arbeitsbereich, dem diese Website gehört, und sind nur für dessen Mitglieder sichtbar.",
      receivedSectionTitle: "Links zu Ihrer Website",
      receivedFlow: "In Partnerartikeln platziert → bestätigt → Credits verbraucht",
      givenSectionTitle: "Links, die Sie hosten",
      givenFlow: "In Ihren Artikeln platziert → bestätigt → Credits verdient",
      seeAllCount: "{count} Link ansehen|Alle {count} Links ansehen",
      earnedTitle: "Erhaltene Backlinks",
      earnedIntro: "Alle Links, die Ihre Seiten über das Partnernetzwerk erhalten haben, mit Quelle, verlinkten Wörtern und Prüfstatus.",
      hostedTitle: "Gehostete Links",
      hostedIntro: "Partnerlinks in Ihren Artikeln. Jeder bringt Credits, sobald er in Ihrem veröffentlichten Artikel als live bestätigt ist.",
      statusFilterLabel: "Nach Status filtern",
      tabAll: "Alle",
      tabVerified: "Bestätigt",
      tabPending: "Ausstehend",
      tabRefunded: "Erstattet",
      typeLabel: "Art",
      typeAll: "Art: alle",
      typeManaged: "Vom RepGet-Team platziert",
      typeExchange: "Tausch (automatische Zuordnung)",
      resultCount: "{count} Link|{count} Links",
      recoverFrom: "Credits aus {count} Link zurückholen|Credits aus {count} Links zurückholen",
      recoverQueued: "{count} Prüfung angefordert. Credits gibt es nur, wenn der Link live gefunden wird.|{count} Prüfungen angefordert. Credits gibt es nur, wenn die Links live gefunden werden.",
      searchLabel: "Links suchen",
      searchPlaceholder: "Website, Seite oder verlinkte Wörter",
      dateFrom: "Von",
      dateTo: "Bis",
      apply: "Anwenden",
      clearFilters: "Filter zurücksetzen",
      dateMeaning: "Datumsangaben in UTC zeigen den letzten Schritt des Links: bestätigt, entfernt, veröffentlicht oder platziert.",
      colDate: "Datum",
      colLink: "Link",
      colDestination: "Ziel",
      colAuthority: "Domain-Autorität",
      colValue: "Gesch. Wert",
      colCredits: "Credits",
      colAiCitation: "KI-Zitate",
      colStatus: "Status",
      colDetails: "Details",
      aiCitationHelp: "Wie oft die Seite mit diesem Link in Ihren KI-Sichtbarkeitsprüfungen zitiert wurde (letzte 90 Tage).",
      aiNotMeasured: "Nicht gemessen: In den letzten 90 Tagen lief keine KI-Sichtbarkeitsprüfung, oder die Seite ist noch nicht veröffentlicht.",
      aiCitations: "{count} Zitat|{count} Zitate",
      aiCitationsDetail: "In {count} KI-Antwort Ihrer Prüfungen zitiert (letzte 90 Tage)|In {count} KI-Antworten Ihrer Prüfungen zitiert (letzte 90 Tage)",
      emptyFiltered: "Keine Links passen zu diesen Filtern.",
      emptyReceived: "Noch keine Links zu Ihrer Website. Das RepGet-Team platziert sie in Partnerartikeln; sie erscheinen hier, sobald einer platziert ist.",
      emptyGiven: "Noch keine Partnerlinks in Ihren Artikeln.",
      unknownWebsite: "Unbekannte Website",
      untitled: "Artikel ohne Titel",
      dateUnknown: "Datum nicht erfasst",
      valueNotApplicable: "Wird nach der Bestätigung bewertet",
      showDetails: "Details zu {site} anzeigen",
      hideDetails: "Details zu {site} ausblenden",
      loading: "Wird geladen…",
      sortable: "sortierbar",
      sortedAsc: "aufsteigend sortiert",
      sortedDesc: "absteigend sortiert",
      paginationLabel: "Seiten",
      showingRange: "{first}-{last} von {total}",
      perPage: "Pro Seite",
      prev: "Zurück",
      next: "Weiter",
      pageOf: "Seite {page} von {pages}",
      valueFootnote: "Geschätzte Gegenwerte folgen der Bewertungsrichtlinie v{version} ({currency}); es sind Schätzungen, kein gespartes Geld.",
      lcVerified: "Bestätigt",
      lcAwaitingPublication: "Wartet auf Veröffentlichung",
      lcAwaitingVerification: "Wartet auf Prüfung",
      lcNotFound: "Nicht gefunden - nicht berechnet",
      lcRemoved: "Entfernt - erstattet",
      lcWithdrawn: "Vor Veröffentlichung zurückgezogen - kostenlos",
      lcUnknown: "Unbekannter Status",
      eventVerified: "bestätigt",
      eventRemoved: "entfernt",
      eventPublished: "veröffentlicht",
      eventPlaced: "platziert",
      eventUnknown: "-",
      creditSettled: "{n} verbraucht",
      creditEarned: "+{n} verdient",
      creditReserved: "{n} reserviert",
      creditPending: "+{n} nach Bestätigung",
      creditRefunded: "{n} erstattet",
      creditReversed: "{n} storniert",
      creditNone: "Keine Kosten",
      dSourceArticle: "Quellartikel",
      dYourArticle: "Ihr Artikel",
      dSourceSite: "Verlinkende Website",
      dDestinationSite: "Ziel-Website",
      dYourPage: "Ihre Seite",
      dDestinationPage: "Zielseite",
      dAnchor: "Verlinkte Wörter",
      dType: "Art der Platzierung",
      dRel: "Link-Attribute auf der Seite",
      dPublished: "Veröffentlicht",
      dFirstVerified: "Erstmals bestätigt",
      dRemoved: "Entfernt",
      dLastCheck: "Letzte Prüfung",
      dAuthority: "Autorität der Quelle",
      dValue: "Geschätzter Wert",
      dAiCitation: "KI-Zitate",
      dCredits: "Credits für diesen Link",
      opensNewTab: "(öffnet in neuem Tab)",
      notPublishedYet: "Noch nicht veröffentlicht",
      anchorHidden: "Sichtbar, sobald der Partnerartikel veröffentlicht ist",
      relUnknown: "Unbekannt (noch nicht live gesehen)",
      relFollowed: "Keine (gefolgter Link)",
      relUnfollowed: "{rel} - nicht gefolgt: bringt wenig SEO-Wert",
      notYet: "Noch nicht",
      checkAlive: "Link gefunden",
      checkMissing: "Link nicht gefunden",
      checkError: "Seite nicht erreichbar (zählt nicht)",
      fvFromCheck: "Aus der ersten erfolgreichen Prüfung (vor der Speicherung von Prüfdaten erfasst).",
      fvFromLedger: "Aus der Abrechnungsbuchung (vor der Speicherung von Prüfdaten erfasst).",
      valueDetail: "{value}, laut Bewertungsrichtlinie und Domain-Autorität der Quelle",
      noCreditMovements: "Für diesen Link wurden keine Credits bewegt.",
      adviceNotFoundGiven: "Der Link fehlt in Ihrem veröffentlichten Artikel. Fügen Sie ihn wieder ein (oder veröffentlichen Sie neu) und wählen Sie „Erneut prüfen“ - Credits gibt es erst, wenn er live gesehen wird.",
      adviceNotFoundReceived: "Der Partnerartikel enthält den Link nicht. Es wurde nichts berechnet; das RepGet-Team kümmert sich.",
      adviceAwaitingVerification: "Der Artikel ist live. Der Link wird automatisch geprüft, meist innerhalb eines Tages; Credits bewegen sich erst, wenn er gesehen wird.",
      adviceAwaitingPublicationGiven: "Dieser Link steht in einem Ihrer noch unveröffentlichten Artikel. Er erscheint mit dem Artikel, nach der Prüfung durch das RepGet-Team.",
      adviceAwaitingPublicationReceived: "In einem noch unveröffentlichten Partnerartikel platziert. Die Credits sind reserviert, nicht verbraucht.",
      adviceRemoved: "Der Link war bestätigt, dann wurde bestätigt, dass er verschwunden ist, und er wurde entfernt; die Credits wurden erstattet.",
      recheck: "Erneut prüfen",
      recheckRecover: "Wiederhergestellt - erneut prüfen",
      recheckQueued: "Prüfung angefordert. Sie läuft in Kürze; Credits bewegen sich nur, wenn der Link live gesehen wird.",
      recheckRevived: "Wieder in Prüfung. Wird der Link live gefunden, werden die Credits dann verrechnet.",
      recheckAlreadyQueued: "Eine Prüfung ist bereits geplant.",
      recheckCooldown: "Kürzlich geprüft - in einigen Stunden erneut möglich.",
      creditsTitle: "Credit-Aktivität",
      creditsIntro: "Alle Credits, die Ihr Arbeitsbereich erhalten, reserviert, verbraucht oder zurückerhalten hat, neueste zuerst.",
      creditsSummary: "Übersicht",
      creditsAvailable: "Verfügbar",
      creditsReservedLabel: "Reserviert",
      creditsReservedHelp: "Für Links in Arbeit zurückgehalten; erst bei bestätigtem Link verbraucht.",
      creditsBalance: "Guthaben",
      creditsEarnedTotal: "Verdient (gesamt)",
      creditsSpentTotal: "Verbraucht (gesamt)",
      creditsRefundedTotal: "Erstattet (gesamt)",
      colEntry: "Buchung",
      colWebsite: "Website",
      creditsEmpty: "Noch keine Credit-Aktivität.",
      workspaceWide: "Arbeitsbereich",
      ledgerPlanGrant: "Monatliches Kontingent",
      ledgerLinkGiven: "Verdient: gehosteter Link bestätigt",
      ledgerLinkReceived: "Verbraucht: Link zu Ihrer Website bestätigt",
      ledgerRefund: "Erstattung",
      ledgerPurchase: "Gekauft",
      ledgerReferral: "Empfehlungsprämie",
      ledgerReferralReversed: "Empfehlungsprämie storniert: Zahlung erstattet",
      ledgerReversal: "Storniert: gehosteter Link entfernt",
      ledgerAdjustment: "Korrektur",
      sectionUnavailable: "Dieser Bereich konnte nicht geladen werden. Bitte neu laden; bei Fortbestehen den Support kontaktieren.",
      websiteAuthority: "Website-Autorität",
      backlinksHeading: "Backlinks",
      openBacklinks: "Backlinks öffnen",
      partnerNetworkLabel: "Partnernetzwerk",
      getCredits: "Credits holen",
      verifiedBacklinksLabel: "Bestätigte Backlinks",
      availableCredits: "Verfügbare Credits",
      ownerOnlyShort: "Nur Eigentümer",
      chartActiveLinks: "Bestätigte Links zu Ihrer Website",
      unitLinks: "Links",
      noData: "keine Daten",
      chartInstructions: "Mit den Pfeiltasten links und rechts zwischen Tagen wechseln.",
      undatedLinks: "{count} älterer bestätigter Link hat kein erfasstes Datum und fehlt im Diagramm.|{count} ältere bestätigte Links haben kein erfasstes Datum und fehlen im Diagramm.",
      todaysArticle: "Heutiger Artikel",
      nothingWritten: "Noch nichts geschrieben. Ihr erster Artikel erscheint hier, sobald Ihr Inhaltsplan startet.",
      openContentPlan: "Inhaltsplan öffnen",
      stPublished: "Veröffentlicht",
      stAwaitingReview: "Beim RepGet-Team",
      stAwaitingReviewHelp: "Wird vom RepGet-Team geprüft, bevor er erscheint. Nichts wird vor der Freigabe veröffentlicht.",
      stApproved: "Freigegeben",
      stApprovedHelp: "Freigegeben - erscheint am geplanten Tag, {date}, gemäß Ihren Veröffentlichungseinstellungen.",
      stApprovedNoDate: "Freigegeben - erscheint gemäß Ihren Veröffentlichungseinstellungen.",
      stScheduled: "Geplant",
      stScheduledHelp: "Erscheint am {date}.",
      stDraft: "Entwurf",
      stDraftHelp: "Wartet darauf, dass Sie ihn veröffentlichen.",
      stWriting: "Wird geschrieben",
      stFailed: "Braucht Aufmerksamkeit",
      searchVolume: "Suchvolumen",
      perMonth: "{n}/Monat",
      difficulty: "Schwierigkeit",
      articleType: "Artikeltyp",
      intentCommercial: "Kommerziell",
      intentTransactional: "Transaktional",
      intentInformational: "Informativ",
      intentNavigational: "Navigational",
      whyThisTopic: "Warum dieses Thema?",
      whyWithVolume: "Es zielt auf „{keyword}“, etwa {volume}-mal im Monat gesucht.",
      whyKeyword: "Es zielt auf „{keyword}“.",
      winsTitle: "Erfolge der letzten 7 Tage",
      winsCount: "{count} Erfolg|{count} Erfolge",
      noWins: "In den letzten 7 Tagen noch nichts Neues.",
      winPublished: "Veröffentlicht: {title}",
      winPublishedDetail: "Diese Woche erstmals auf Ihrer Website veröffentlicht",
      winLinksReceived: "{count} neuer Link zu Ihrer Website bestätigt|{count} neue Links zu Ihrer Website bestätigt",
      winLinksReceivedDetail: "Links aus Partnerartikeln, live gesehen",
      winLinksGiven: "{count} gehosteter Link bestätigt - Credits verdient|{count} gehostete Links bestätigt - Credits verdient",
      winLinksGivenDetail: "Partnerlinks in Ihren Artikeln, live gesehen",
      winAudit: "Website-Gesundheit geprüft - Wert {score}",
      winAuditDetail: "Was die Website bei Google bremst",
      winClicks: "{count} Klick von Google (ganze Website)|{count} Klicks von Google (ganze Website)",
      winClicksDetail: "Search-Console-Daten bis {date}",
      view: "Ansehen",
      bestArticles: "Beste Artikel",
      bestArticlesHelp: "Ihre RepGet-Artikel mit den meisten Klicks von Google (letzte 30 gemeldete Tage).",
      openGoogleResults: "Google-Ergebnisse öffnen",
      connectSearchConsole: "Verbinden Sie die Google Search Console, um die Leistung Ihrer Artikel zu sehen.",
      connect: "Verbinden",
      noArticleTraffic: "Die Search Console hat für Ihre RepGet-Artikel noch keine Klicks oder Impressionen gemeldet.",
      colArticle: "Artikel",
      colClicks: "Klicks",
      colImpressions: "Impressionen",
      colPosition: "Position",
      colSessions: "Sitzungen (GA)",
      colFirstPublished: "Erstveröffentlichung",
      colKeywordCpc: "Keyword · CPC (USD)",
      searchConsoleThrough: "Search-Console-Daten bis {date}.",
      analyticsThrough: "Google-Analytics-Daten bis {date}.",
      connectAnalytics: "Verbinden Sie Google Analytics, um Sitzungen auf Ihren Artikeln zu sehen.",
      achievements: "Erfolge",
      valueHeadline: "Geschätzter Gegenwert: {value}",
      valueHeadlineUnconfigured: "Geschätzter Wert noch nicht eingerichtet",
      achievementsIntro: "Was Ihre Artikel und das Partnernetzwerk in diesem Zeitraum erreicht haben. Das RepGet-Team prüft Artikel und platziert Links von Hand.",
      lastNDays: "Letzte {days} Tage (UTC)",
      plusArticles: "+{n} Artikel",
      plusBacklinks: "+{n} Backlinks",
      rangeLabel: "Zeitraum",
      rangeDays: "{days} Tage",
      range12m: "12 Monate",
      viewLabel: "Ansicht",
      chart: "Diagramm",
      details: "Details",
      metricLabel: "Im Diagramm gezeigte Kennzahl",
      trafficValue: "Traffic-Wert",
      trafficValueHelp: "Was die Klicks auf Ihre Artikel als Anzeigen kosten würden (Schätzung)",
      backlinkValue: "Backlink-Wert",
      backlinkValueHelp: "In diesem Zeitraum erstmals bestätigte Links (Schätzung)",
      articlesPublished: "Veröffentlichte Artikel",
      articlesPublishedHelp: "Zum ersten Mal live auf Ihrer Website (Entwürfe und Änderungen zählen nicht)",
      articleImpressions: "Artikel-Impressionen",
      articleImpressionsHelp: "Wie oft Ihre RepGet-Artikel bei Google erschienen",
      articleClicks: "Artikel-Klicks",
      articleClicksHelp: "Klicks von Google auf Ihre RepGet-Artikel (Search Console)",
      articleSessions: "Artikel-Sitzungen",
      articleSessionsHelp: "Besuche Ihrer RepGet-Artikel (Google Analytics)",
      notConnected: "Nicht verbunden",
      notConfiguredShort: "Nicht eingerichtet",
      currencyMismatch: "Erfordert eine USD-Richtlinie",
      websiteHealth: "Website-Gesundheit",
      websiteHealthHelp: "Ihr letztes technisches Audit - getrennt von der Autorität",
      noSeries: "Für diese Kennzahl gibt es im Zeitraum noch keine Daten.",
      utcDays: "Tage sind Kalendertage in UTC.",
      unitArticles: "Artikel",
      unitClicks: "Klicks",
      unitImpressions: "Impressionen",
      unitSessions: "Sitzungen",
      breakdownCaption: "Ihre RepGet-Artikel im Zeitraum, nach Klicks von Google",
      breakdownShowing: "Angezeigt werden die ersten {shown} von {total} Seiten. Die Summen oben umfassen alle Seiten.",
      unknownPublicationDates: "{n} ältere Artikel sind online, aber wann sie zum ersten Mal online gingen, wurde nicht erfasst. Sie werden in keinem Zeitraum gezählt.",
      noPublishedArticles: "Noch keine veröffentlichten RepGet-Artikel.",
      methodologyTitle: "Wie diese Zahlen berechnet werden",
      methodologyPolicy: "Bewertungsrichtlinie v{version}, in {currency}, gültig seit {date}.",
      methodologyCpc: "Traffic-Wert = Search-Console-Klicks jedes Artikels × Kosten pro Klick seines Keywords aus Ihrer Keyword-Recherche für Ihren Markt (USD).",
      methodologyFixed: "Traffic-Wert = Search-Console-Klicks auf Ihre RepGet-Artikel × {rate} pro Klick.",
      methodologyNoTraffic: "Traffic wird nach dieser Richtlinie nicht bewertet.",
      methodologyBacklinks: "Wert pro bestätigtem Link nach Domain-Autorität der verlinkenden Website: {bands}.",
      methodologyNoBacklinks: "Backlinks werden nach dieser Richtlinie nicht bewertet.",
      methodologySources: "Quellen: {sources}",
      methodologyExcluded: "Nie gezählt: Entwürfe, Links vor Veröffentlichung oder Prüfung, nicht gefundene oder entfernte Links, interne Links und der Hinweis „Powered by RepGet“.",
      methodologyNotSavings: "Dies sind Schätzungen, was gleichwertige Anzeigen oder Links kosten würden - kein gespartes Geld, kein Umsatz und keine garantierte Rendite.",
      searchPerformance: "Suchleistung",
      websiteTraffic: "Website-Traffic",
      aiSearch: "KI-Suche",
      aiNoChecks: "Keine KI-Sichtbarkeitsprüfungen im Zeitraum.",
      openAiVisibility: "KI-Sichtbarkeit öffnen",
      aiChecks: "Geprüfte Antworten",
      aiMentioned: "Nennen Sie",
      aiCited: "Zitieren Ihre Website",
      aiReferralNotMeasured: "Besuche über KI-Assistenten werden noch nicht gemessen - dies sind Antworten, die RepGet für Sie geprüft hat.",
      googleTraffic: "Google-Traffic",
      connectSearchConsoleTraffic: "Verbinden Sie die Google Search Console für Klicks, Impressionen und Position.",
      siteClicks: "Klicks",
      siteImpressions: "Impressionen",
      avgPosition: "Ø Position",
      vsPrevious: "ggü. vorher",
      siteWideThrough: "Ganze Website, letzte {days} Tage; Search-Console-Daten bis {date}.",
      uncertainTitle: "Der letzte Veröffentlichungsversuch erhielt keine Antwort von Ihrer Website",
      uncertainHelp: "Der Beitrag existiert vielleicht schon. Prüfen Sie Ihre Website: Ist der Artikel da, ist nichts zu tun; wenn nicht, bestätigen Sie unten und veröffentlichen Sie erneut. Wir warten, statt einen doppelten Beitrag zu riskieren.",
      uncertainConfirm: "Nicht auf meiner Website - erneut veröffentlichen erlauben",
      uncertainConfirmed: "Erfasst. Sie können den Artikel erneut veröffentlichen.",
      lcNotFoundGiven: "Nicht gefunden - keine Credits verdient",
      lcRemovedGiven: "Entfernt - Credits storniert",
    },
    image: {
      altLabel: "Bildbeschreibung",
      altPlaceholder: "Was das Bild zeigt",
      promptLabel: "Beschreiben Sie ein anderes Bild",
      promptPlaceholder: "Eine Abendzeremonie im Kerzenlicht, ohne Personen",
      noRegensLeft: "Sie haben alle Neuerstellungen für diesen Artikel aufgebraucht. Laden Sie stattdessen ein eigenes Bild hoch.",
      imageReady: "Neues Bild fertig",
      imageUploaded: "Bild hochgeladen",
      imageRemoved: "Bild entfernt",
    },
    profile: {
      businessDetails: "Unternehmensdaten",
      detailsHelp: "Diese Angaben prägen Ihre Suchbegriffe und jeden Artikel, den wir schreiben.",
      correctAnything: " Korrigieren Sie, was wir falsch verstanden haben.",
      fillsIn: " Sie werden automatisch ausgefüllt, sobald wir die Website analysiert haben - Sie können sie auch jetzt eintragen.",
      brandName: "Markenname",
      brandNamePlaceholder: "Acme GmbH",
      industry: "Branche",
      industryPlaceholder: "Zahnarztpraxis",
      country: "Hauptmarkt",
      countryPlaceholder: "Deutschland",
      audience: "Zielgruppe",
      audiencePlaceholder: "Hausbesitzer zwischen 30 und 55",
      mainLanguage: "Hauptsprache",
      description: "Beschreibung",
      descriptionPlaceholder: "Was das Unternehmen tut, in ein bis zwei Sätzen.",
      saveDetails: "Daten speichern",
      saving: "Wird gespeichert…",
      detailsSaved: "Daten gespeichert",
      pageTitle: "Unternehmenseinstellungen",
      pageDescription: "Die Angaben zum Unternehmen hinter {domain}. Die Keyword-Recherche und jeder Artikel, den wir schreiben, beruhen darauf.",
      identityTitle: "Unternehmens­identität",
      identityHelp: "Wer Sie sind und was Sie tun.",
      marketTitle: "Markt und Zielgruppe",
      marketHelp: "Wo Sie verkaufen, wen Sie erreichen möchten und in welcher Sprache Ihre Artikel geschrieben werden.",
      descriptionTitle: "Unternehmens­beschreibung",
      descriptionHelp: "Was das Unternehmen tut und was es auszeichnet, in Ihren eigenen Worten.",
      competitorsTitle: "Wettbewerber",
      competitorsHelp: "Unternehmen, die mit Ihnen um dieselben Kunden konkurrieren. Die Vorschläge stammen aus der Analyse Ihrer Website, prüfen Sie sie also: Entfernen Sie alle, die keine echten Wettbewerber sind, und ergänzen Sie fehlende.",
      brandNameHint: "Der Name, unter dem Ihre Kunden Sie kennen.",
      industryHint: "Was Sie tun, in wenigen Worten.",
      marketPlaceholder: "Germany",
      countryHint: "Das Land, in dem Sie hauptsächlich verkaufen, auf Englisch geschrieben (zum Beispiel Spain), damit die Keyword-Recherche das richtige Land betrachtet.",
      marketNotEnglish: "Die Keyword-Recherche erkennt nur Ländernamen, die auf Englisch geschrieben sind.",
      marketUseEnglish: "{country} verwenden",
      articleLanguage: "Artikelsprache",
      articleLanguageHint: "Die Artikel für diese Website werden in dieser Sprache geschrieben. Ihr Dashboard ändert sich dadurch nicht.",
      dashboardLanguageNote: "Ihr Dashboard wird auf {language} angezeigt, eine persönliche Einstellung in Ihrem Konto.",
      dashboardLanguageLink: "Dashboard-Sprache ändern",
      chooseLanguage: "Sprache wählen",
      unknownLanguage: "{language} (aktueller Wert)",
      audienceHint: "Wen Sie erreichen möchten: zum Beispiel Alter, Lebenssituation oder Bedarf.",
      descriptionHint: "Ein paar Sätze genügen: Ihre wichtigsten Produkte oder Leistungen, wo Sie tätig sind und was Sie unterscheidet.",
      notSet: "Nicht festgelegt",
      unsavedBadge: "Nicht gespeichert",
      saveBusinessDetails: "Speichern",
      saveScope: "Gilt für alle Abschnitte außer Wettbewerber, die sofort beim Hinzufügen oder Entfernen gespeichert werden.",
      saveError: "Etwas ist schiefgelaufen. Ihre Änderungen sind noch da, Sie können es also erneut versuchen.",
      checklistNeedsBoth: "Fügen Sie eine Beschreibung hinzu und wählen Sie eine Artikelsprache, um diesen Schritt Ihrer Startcheckliste abzuschließen.",
      checklistNeedsDescription: "Fügen Sie eine Beschreibung hinzu, um diesen Schritt Ihrer Startcheckliste abzuschließen.",
      checklistNeedsLanguage: "Wählen Sie eine Artikelsprache, um diesen Schritt Ihrer Startcheckliste abzuschließen.",
      analysingTitle: "Ihre Website wird analysiert",
      analysingBody: "Wenn die Analyse abgeschlossen ist, füllt sie Markenname, Branche, Markt, Zielgruppe und Beschreibung aus und ersetzt dabei den aktuellen Inhalt dieser Felder. Die von Ihnen gewählte Artikelsprache bleibt erhalten.",
      analysingBodyReadOnly: "Wenn die Analyse abgeschlossen ist, werden diese Angaben ausgefüllt.",
      refresh: "Aktualisieren",
      analysisFailedTitle: "Wir konnten Ihre Website nicht analysieren",
      analysisFailedBody: "Diese Angaben wurden nicht automatisch ausgefüllt. Sie können sie selbst eintragen.",
      analysisFailedBodyReadOnly: "Diese Angaben wurden nicht automatisch ausgefüllt.",
      analysisFailedRetry: "Sie können die Analyse auf der Seite Websites erneut starten.",
      goToWebsites: "Zu den Websites",
      competitorCount: "1 Wettbewerber|{count} Wettbewerber",
      manualGroup: "Von Ihnen hinzugefügt",
      suggestedGroup: "Von der Analyse vorgeschlagen",
      suggestedGroupHelp: "Bei der Analyse Ihrer Website gefunden, nicht von Ihnen gewählt. Entfernen Sie alle, die keine echten Wettbewerber sind.",
      suggestedGroupHelpReadOnly: "Bei der Analyse der Website gefunden.",
      competitorsEmpty: "Noch keine Wettbewerber.",
      competitorsEmptyAnalysed: "Die Analyse Ihrer Website hat keine Wettbewerber vorgeschlagen.",
      competitorsEmptyAnalysing: "Vorschläge erscheinen hier, sobald die Analyse Ihrer Website abgeschlossen ist.",
      competitorsTruncated: "Die ersten {count} Wettbewerber werden angezeigt.",
      addCompetitor: "Wettbewerber hinzufügen",
      addCompetitorHint: "Die Adresse seiner Website, zum Beispiel rival.com. Wir prüfen vor dem Hinzufügen, ob die Website existiert; das kann einige Sekunden dauern.",
      competitorPlaceholder: "rival.com",
      addCompetitorButton: "Hinzufügen",
      checkingShort: "Wird geprüft…",
      checkingCompetitor: "{domain} wird geprüft…",
      competitorAdded: "{domain} hinzugefügt.",
      removingCompetitor: "{domain} wird entfernt…",
      competitorRemoved: "{domain} entfernt.",
      visitCompetitor: "{domain} in einem neuen Tab öffnen",
      removeCompetitor: "{domain} entfernen",
      competitorRequired: "Geben Sie eine Webadresse ein.",
      competitorInvalid: "Geben Sie eine Webadresse wie rival.com ein.",
      competitorOwnSite: "Das ist Ihre eigene Website.",
      competitorDuplicate: "{domain} ist bereits in Ihrer Liste.",
      competitorNotPublic: "Diese Adresse ist keine öffentliche Website.",
      competitorBlocked: "Soziale Netzwerke und große Plattformen wie Google, Amazon oder Wikipedia können nicht als Wettbewerber hinzugefügt werden.",
      competitorUnreachable: "Wir konnten {domain} nicht erreichen. Prüfen Sie die Schreibweise und versuchen Sie es erneut.",
      actionFailed: "Etwas ist schiefgelaufen. Versuchen Sie es erneut.",
    },
    setup: {
      launchChecklist: "Startcheckliste",
      allLive: "Alle Systeme aktiv",
      finishSetup: "Einrichtung abschließen",
      allLiveHelp: "Alle erforderlichen Systeme sind aktiv. Ihre Live-Zahlen finden Sie im Dashboard.",
      stepsLeft: "Noch {n} Schritt, bis alles von selbst läuft.|Noch {n} Schritte, bis alles von selbst läuft.",
    },
    common: {
      cancel: "Abbrechen",
      done: "Fertig",
      edit: "Bearbeiten",
      preview: "Vorschau",
      connect: "Verbinden",
      checking: "Wird geprüft…",
      discard: "Verwerfen",
      revoke: "Widerrufen",
      failed: "Fehlgeschlagen",
      images: "Bilder",
      rewrite: "Neu schreiben",
      tryAgain: "Erneut versuchen",
      somethingWentWrong: "Auf dieser Seite ist etwas schiefgelaufen",
      remove: "Entfernen",
      upload: "Hochladen",
      disconnect: "Trennen",
      competitors: "Wettbewerber",
      websiteHealth: "Website-Zustand",
      checkingWebsite: "Ihre Website wird geprüft",
      nothingNeedsAttention: "Es gibt nichts zu tun. Prüfen Sie erneut, nachdem Sie Änderungen gemacht haben.",
      requestQuote: "Angebot anfordern",
      wantUsToFix: "Sollen wir das für Sie beheben?",
      saveProperties: "Properties speichern",
      appeared: "Einblendungen",
      noImageYet: "Noch kein Bild",
      notScheduled: "Nicht geplant",
      nothingPlanned: "Für diesen Tag ist nichts geplant.",
      defaultsAreFine: "Passt so? Sie können die Einstellungen jederzeit ändern.",
      keepDefaults: "Standardwerte behalten",
      noPlanYet: "Noch kein Redaktionsplan",
      noPlanYetHaveKeywords: "Ihre Suchbegriffe stehen bereit, aber der Plan, der daraus Artikel macht, wurde noch nicht erstellt. Erstellen Sie ihn jetzt.",
      buildPlan: "Redaktionsplan erstellen",
      requestLink: "Link anfragen",
      admin: "Verwaltung",
      articleLanguageHelp: "Ihre Artikel werden in dieser Sprache verfasst.",
      namedInstead: "Werden am häufigsten statt Ihrer genannt",
      mostPopular: "Am beliebtesten",
      receiptInPayPal: "Beleg in PayPal",
      noCharge: "Keine Belastung",
      close: "Schließen",
      copied: "Kopiert",
      openMenu: "Menü öffnen",
      changeLanguage: "Sprache ändern",
      brandHome: "RepGet-Startseite",
      skipped: "Übersprungen",
      hideSetupSteps: "Schritte ausblenden",
      setupProgress: "Fortschritt der Einrichtung",
      secureCheckout: "Sichere Zahlung",
      skipForNow: "Vorerst überspringen",
      verifiedCustomer: "Bestätigter Kunde",
      searchYourImages: "Ihre Bilder durchsuchen",
      critical: "Kritisch",
      suggestion: "Vorschlag",
      warning: "Warnung",
      importData: "Daten importieren",
      auditIntro: "Wir prüfen Ihre Seiten und listen auf, was Ihre Website bei Google bremst - mit der genauen Seite zu jedem Problem.",
      losingTrafficIntro: "Seiten, die weniger Klicks bekommen oder seltener in Google erscheinen als vor einem Monat. Laut Ihren Search-Console-Daten.",
      noCompetitorsFound: "Wir haben auf Ihrer Website keine gefunden. Fügen Sie die Wettbewerber hinzu, die Sie kennen, und wir finden damit Inhaltslücken.",
      competitorsHelp: "Wer sonst auftaucht, wenn Käufer in Ihrem Bereich suchen. Wir nutzen das, um Inhaltslücken und lohnende Suchbegriffe zu finden.",
      connectWebsiteFirst: "Verbinden Sie zuerst Ihre Website unter Einstellungen → Integrationen. Bis dahin warten Artikel in RepGet.",
      generationHelp: "Wie Ihre Artikel geschrieben werden und was mit ihnen geschieht, wenn sie fertig sind.",
      altHelp: "Wird Menschen mit Screenreader vorgelesen und von Suchmaschinen gelesen.",
      featuredImageHelp: "Das Bild oben im Artikel und das Bild, das beim Teilen erscheint.",
      factsOnePerLine: "Eines pro Zeile. Nur diese Angaben nennen wir ausdrücklich über Ihr Unternehmen; alles andere bleibt allgemein.",
      voiceBehindArticles: "Die Stimme hinter jedem Artikel. Aus dem eigenen Bereich übernommen, sodass ein Speichern den ganzen Bildschirm abdeckt.",
      creditsExplainer: "Credits werden Ihrem Konto gutgeschrieben und können für Linkaufbau eingesetzt werden. Sie sind kein Bargeld und nicht auszahlbar. Eine Empfehlung zählt, sobald die empfohlene Person ihren ersten Monat bezahlt, und nur neue Konten können empfohlen werden, jedes nur einmal.",
      articleInProgress: "Dieser Artikel kann nicht mehr umgeplant oder bearbeitet werden, da er gerade erstellt wird.",
      researchIntro: "Wir finden die Suchbegriffe Ihrer Kunden, gruppieren sie nach Themen und machen daraus einen Plan für Artikel zum Veröffentlichen.",
      noCreditsLeft: "Keine Credits mehr. Nehmen Sie einen Link auf, damit jemand anderes einen verdient, oder warten Sie auf das Kontingent des nächsten Monats.",
      promoCodesHelp: "Gutscheincodes können beim Kartenzahlvorgang eingegeben werden. PayPal unterstützt keine Rabattcodes.",
      write: "Schreiben",
      writingAndPublishing: "Schreiben und Veröffentlichen",
      featuredImage: "Beitragsbild",
      backlinksLabel: "Backlinks",
      uploadLabel: "Hochladen",
      aiAssistantsTracked: "Beobachtete KI-Assistenten",
      freshArticles: "Neue Artikel",
      toSetUp: "Einzurichten",
      trustedByBusinesses: "Unternehmen weltweit vertrauen darauf",
      weekly: "Wöchentlich",
      twoMinutes: "2 Min.",
      notAvailable: "Diese Seite ist nicht verfügbar",
      notAvailableHelp: "Die Seite wurde möglicherweise verschoben oder gehört zu einem Arbeitsbereich, in dem Sie kein Mitglied sind.",
      backToDashboard: "Zurück zum Dashboard",
      viewWebsites: "Ihre Websites ansehen",
      goToDashboard: "Zum Dashboard",
      setUp: "Einrichten",
      setUpHelp: "Wir führen Sie Schritt für Schritt durch den Start.",
      manageBilling: "Abrechnung verwalten",
      manageInPayPal: "In PayPal verwalten",
      payWithPayPal: "Mit PayPal bezahlen",
      noPlans: "Noch keine Tarife verfügbar.",
      billingHistory: "Abrechnungsverlauf",
      billingHistoryHelp: "Alle Abonnementzahlungen dieses Arbeitsbereichs.",
      invoice: "Rechnung",
      downloadPlugin: "Plugin herunterladen",
      pluginGuide: "Einrichtungsanleitung",
      cantFindIntegration: "Ihre Integration nicht gefunden?",
      adaptive: "Adaptiv",
      custom: "Eigene",
      wordRange: "Zwischen 300 und 5.000.",
      findOpportunities: "Chancen finden",
      noOpportunities: "Noch keine Chancen gefunden",
      losingTraffic: "Traffic-Verlust",
      notWrittenHere: "Nicht hier verfasst",
      nothingLosing: "Nichts verliert Traffic",
      nothingLosingHelp: "Keine Seite hat 30 % oder mehr ihrer Klicks verloren, und keine ist in Google gefallen. Seiten mit weniger als 10 Klicks im Monat werden stattdessen über ihre Position geprüft.",
      losingClicksTitle: "Verlieren Klicks",
      losingClicksHelp: "Haben 30 % oder mehr ihrer Klicks verloren, ausgehend von mindestens 10 in den 28 Tagen davor.",
      losingVisibilityTitle: "Verlieren Sichtbarkeit",
      losingVisibilityHelp: "Sind in Google um 3 oder mehr Plätze gefallen oder erschienen in halb so vielen Suchen. Geprüft für Seiten mit mindestens 100 Einblendungen, damit auch Seiten mit wenigen Klicks beobachtet werden.",
      watchTitle: "Im Blick behalten",
      watchHelp: "10-30 % weniger Klicks. Noch kein klarer Rückgang.",
      noClickLosses: "Keine Seite hat 30 % oder mehr ihrer Klicks verloren.",
      clicksChange: "{before} → {after} Klicks",
      percentDown: "{pct} % weniger",
      percentUp: "{pct} % mehr",
      rankingChange: "Position {before} → {after}",
      shownChange: "{before} → {after} Einblendungen",
      windowNote: "Die letzten 28 Tage, die Google gemeldet hat, bis {date}, verglichen mit den 28 davor.",
      writeAutomatically: "Artikel automatisch schreiben",
      daysToWrite: "Tage zum Schreiben",
      publishWithoutAsking: "Ohne Rückfrage veröffentlichen",
      whenFinished: "Wenn ein Artikel fertig ist",
      finishedReview: "In RepGet zur Prüfung behalten",
      finishedReviewHelp: "Nichts erscheint auf Ihrer Website, bis Sie beim Artikel auf Veröffentlichen klicken.",
      finishedDraft: "Als Entwurf an meine Website senden",
      finishedDraftHelp: "Er erscheint am geplanten Tag als Entwurf in Ihrem CMS. Sie veröffentlichen ihn dort.",
      finishedLive: "Am geplanten Tag live veröffentlichen",
      finishedLiveHelp: "Er geht am geplanten Tag auf Ihrer Website live, ohne dass Sie etwas tun müssen.",
      firstArticleNote: "Ihr erster Artikel wird gesendet, sobald er fertig ist, egal was Sie wählen, damit Sie sehen, wie Artikel auf Ihrer Website aussehen. Solange Ihre Website im Partnernetzwerk ist, prüft das RepGet-Team jeden Artikel vorher - auch den ersten - und keiner geht vor seinem geplanten Tag raus.",
    },
    nav: {
      dashboard: "Dashboard",
      setUp: "Einrichtung",
      plannedArticles: "Geplante Artikel",
      backlinkExchange: "Link-Netzwerk",
      websiteHealth: "Website-Zustand",
      googleResults: "Google-Ergebnisse",
      googleConnect: "Google Search & Analytics",
      aiVisibility: "KI-Sichtbarkeit",
      losingTraffic: "Traffic-Verlust",
      settings: "Einstellungen",
      addons: "Add-ons",
      main: "Allgemein",
      referralProgram: "Empfehlungsprogramm",
      business: "Unternehmen",
      articleSettings: "Artikeleinstellungen",
      integrations: "Integrationen",
      account: "Konto",
      billing: "Abrechnung",
      settingsSections: "Einstellungsbereiche",
    },
    status: {
      pending: "Wartet auf Start",
      crawling: "Ihre Website wird gelesen",
      researching: "Chancen werden gesucht",
      generated: "Inhalte geplant",
      ready: "Bereit",
      queued: "In Warteschlange",
      running: "Läuft",
      completed: "Abgeschlossen",
      planned: "Geplant",
      draft: "Entwurf",
      generating: "Wird geschrieben",
      published: "Veröffentlicht",
      publish: "Wird veröffentlicht",
      scheduled: "Terminiert",
      connected: "Verbunden",
      disconnected: "Nicht verbunden",
      live: "Aktiv",
      removed: "Entfernt",
      matched: "Zugeordnet",
      active: "Aktiv",
      inactive: "Inaktiv",
      cancelled: "Storniert",
      expired: "Abgelaufen",
      paid: "Bezahlt",
      rewarded: "Gutgeschrieben",
      refunded: "Erstattet",
      fulfilled: "Geliefert",
      failed: "Erfordert Aufmerksamkeit",
      rejected: "Abgelehnt",
      missing: "Fehlt",
    },
    editorUi: {
      bold: "Fett",
      italic: "Kursiv",
      strikethrough: "Durchgestrichen",
      heading: "Überschrift",
      subheading: "Zwischenüberschrift",
      bulletedList: "Aufzählung",
      numberedList: "Nummerierte Liste",
      quote: "Zitat",
      code: "Code",
      addLink: "Link hinzufügen",
      removeLink: "Link entfernen",
      insertImage: "Bild einfügen",
      undo: "Rückgängig",
      redo: "Wiederholen",
      chooseImage: "Bild auswählen",
      articleHtml: "Artikel-HTML",
      noImageSelected: "Kein Bild ausgewählt",
      pickOneBelow: "Wählen Sie unten eines aus oder laden Sie ein eigenes hoch.",
      closeImagePicker: "Bildauswahl schließen",
      imageAlt: "Bildbeschreibung (Alt-Text)",
      imageAltPlaceholder: "Was das Bild zeigt",
      replaceImage: "Bild ersetzen",
      saveImage: "Speichern",
      toolbarLabel: "Textformatierung",
      groupText: "Textstil",
      groupHeadings: "Überschriften",
      groupBlocks: "Listen und Blöcke",
      groupLinks: "Links",
      groupMedia: "Bilder",
      groupHistory: "Rückgängig und wiederholen",
      linkDialogTitle: "Link hinzufügen oder ändern",
      linkDialogHelp: "Fügen Sie die vollständige Adresse ein, zum Beispiel https://example.com/seite.",
      linkUrlLabel: "Linkadresse",
      linkApply: "Übernehmen",
      linkInvalid: "Geben Sie eine Adresse ein, die mit https://, http://, mailto:, tel:, / oder # beginnt.",
      htmlHint: "Sie bearbeiten das HTML direkt. Alles Unsichere wird beim Speichern entfernt.",
      richHint: "Die Formatierung bleibt schlicht, damit sie zum Stil Ihrer Website passt.",
      editHtml: "HTML bearbeiten",
      backToEditor: "Zurück zum Editor",
      htmlToolbarOff: "Die Formatierungsschaltflächen sind aus, während Sie das HTML bearbeiten.",
      noMatches: "Keine Treffer.",
      noPicturesYet: "Noch keine Bilder - laden Sie eines hoch, um zu beginnen.",
    },
    dash: {
      bestArticles: "Beste Artikel",
      bestArticlesHelp: "Ihre Seiten, die die meisten Menschen über Google bringen.",
      openGoogleResults: "Google-Ergebnisse öffnen",
      connectForPages: "Verbinden Sie Google Search Console, um zu sehen, welche Ihrer Seiten gefunden werden.",
      clicks: "Klicks",
      impressions: "Impressionen",
      position: "Position",
      searchPerformance: "Suchleistung",
      websiteTraffic: "Website-Traffic",
      aiSearchTraffic: "Traffic aus KI-Suchen",
      googleTraffic: "Google-Traffic",
      vsLastMonth: "ggü. Vormonat",
      averagePosition: "Durchschnittliche Position",
      connectForClicks: "Verbinden Sie Google Search Console, um Klicks, Impressionen und Position zu sehen.",
      achievements: "Ergebnisse",
      achievementsHelp: "All das ist seit Ihrer Anmeldung automatisch passiert.",
      last30Days: "Letzte 30 Tage",
      adSpendSaved: "Gespartes Werbebudget",
      adSpendHelp: "Was dieser Traffic in Google Ads kosten würde.",
      backlinkCostSaved: "Gesparte Linkkosten",
      showedUpHelp: "Wie oft Sie in Google erschienen sind.",
      visitorsFromArticles: "Besucher über Artikel",
      siteHealth: "Der Zustand Ihrer Website",
      siteHealthHelp: "Von 100, aus Ihrer letzten Prüfung.",
      websiteAuthority: "Autorität der Website",
      backlinks: "Backlinks",
      openBacklinks: "Backlinks öffnen",
      backlinkExchange: "Link-Netzwerk",
      getCredits: "Credits holen",
      verifiedBacklinks: "Bestätigte Backlinks",
      availableCredits: "Verfügbare Credits",
      noLinksYet: "Noch keine Links. Sobald andere Websites im Netzwerk auf Ihre verlinken, erscheinen sie hier.",
      todaysArticle: "Der heutige Artikel",
      nothingWrittenYet: "Noch nichts geschrieben. Sobald Ihr Contentplan steht, erscheint der heutige Artikel hier.",
      openContentPlan: "Contentplan öffnen",
      searchVolume: "Suchvolumen",
      difficulty: "Schwierigkeit",
      articleType: "Artikelart",
      whyThisTopic: "Warum dieses Thema?",
      view: "Ansehen",
      addAWebsite: "Website hinzufügen",
      sharedWithYou: "Mit Ihnen geteilt",
      sharedSiteLabel: "Mit Ihnen geteilt · {role}",
      roleEditor: "Redakteur",
      roleViewer: "Leser",
    },
    wpConnect: {
      title: "WordPress verbinden",
      signedInAs: "Angemeldet als {email}",
      goneTitle: "Diese Verbindung ist beendet",
      goneBody: "Sie ist abgelaufen, wurde abgebrochen oder bereits verwendet. Gehen Sie zurück zu WordPress und klicken Sie erneut auf Connect to RepGet.",
      otherBrowserTitle: "Diese Verbindung wurde woanders geöffnet",
      otherBrowserBody: "Zu Ihrer Sicherheit kann eine Verbindung nur in dem Browser abgeschlossen werden, der sie zuerst geöffnet hat. Gehen Sie zurück zu WordPress und klicken Sie erneut auf Connect to RepGet.",
      noneTitle: "{domain} ist noch nicht in diesem RepGet-Konto",
      noneBody: "Fügen Sie {domain} zuerst als Website hinzu und klicken Sie dann in WordPress erneut auf Connect to RepGet. Ist sie in einem anderen RepGet-Konto, melden Sie sich dort an. Läuft WordPress unter einer anderen Adresse als Ihre Website in RepGet (zum Beispiel blog.example.com), verbinden Sie es mit einem Schlüssel: Öffnen Sie in RepGet Integrationen → WordPress-Plugin → Schlüssel (erweitert) → Neuer Schlüssel und fügen Sie ihn in WordPress unter Advanced: use an Integration Key ein.",
      addWebsite: "Website hinzufügen",
      useOtherAccount: "Anderes Konto verwenden",
      confirmTitle: "{domain} mit RepGet verbinden?",
      confirmBody: "Die WordPress-Website unter {site} veröffentlicht die Artikel, die RepGet für die Website unten schreibt. Sie können sie jederzeit in WordPress trennen.",
      inWorkspace: "Arbeitsbereich „{workspace}“",
      movedWarning: "Diese WordPress-Website ist mit einem anderen RepGet-Konto verbunden. Wenn Sie fortfahren, veröffentlicht dieses Konto hier nicht mehr.",
      movedWarningNamed: "Diese WordPress-Website ist mit {domain} im Arbeitsbereich „{workspace}“ verbunden. Wenn Sie fortfahren, veröffentlicht diese Website hier nicht mehr.",
      connect: "{domain} verbinden",
      connectAgain: "{domain} erneut verbinden",
      move: "{domain} nach „{workspace}“ verschieben",
      cancel: "Abbrechen",
      tooManyKeys: "Diese Website hat bereits 5 Schlüssel. Widerrufen Sie unter Integrationen → Schlüssel (erweitert) einen, den Sie nicht mehr verwenden, und versuchen Sie es erneut.",
      notAllowed: "Mit diesem Konto können Sie WordPress nicht mit dieser Website verbinden.",
    },
    auth: {
      redirecting: "Weiterleitung…",
      continueWithGoogle: "Mit Google fortfahren",
      orContinueWithEmail: "Oder mit E-Mail fortfahren",
      fullName: "Vollständiger Name",
      namePlaceholder: "Max Mustermann",
      email: "E-Mail",
      emailPlaceholder: "sie@beispiel.de",
      password: "Passwort",
      passwordHint: "Mindestens 8 Zeichen.",
      tooManyAttempts: "Zu viele Versuche. Warten Sie einige Minuten und versuchen Sie es erneut.",
      passwordTooLong: "Verwenden Sie höchstens 128 Zeichen.",
      emailMeACode: "Code per E-Mail senden",
      usePasswordInstead: "Stattdessen Passwort verwenden",
      sendCode: "Code senden",
      sendingCode: "Code wird gesendet…",
      codeLabel: "Anmeldecode",
      codePlaceholder: "123456",
      codeHelp: "Wir haben einen sechsstelligen Code an {email} gesendet. Er läuft in 10 Minuten ab.",
      verifyCode: "Anmelden",
      verifying: "Code wird geprüft…",
      resendCode: "Neuen Code senden",
      useDifferentEmail: "Andere E-Mail verwenden",
      codeSent: "Sehen Sie in Ihrem Postfach nach dem Code.",
      codeNotSent: "Der Code konnte nicht gesendet werden. Versuchen Sie es erneut.",
      codeInvalid: "Der Code ist falsch oder abgelaufen.",
      enterEmailFirst: "Geben Sie zuerst Ihre E-Mail-Adresse ein.",
      organizations: "Organisationen",
      loading: "Wird geladen…",
      createOrganization: "Organisation erstellen",
      orgHelp: "Jede Organisation hat eigene Websites, Inhalte und Abrechnung.",
      name: "Name",
      orgPlaceholder: "Acme Marketing",
      cancel: "Abbrechen",
      notifications: "Benachrichtigungen",
      markAllRead: "Alle als gelesen markieren",
      nothingYet: "Noch nichts. Wir sagen Ihnen hier Bescheid, sobald Ihre Artikel und Audits fertig sind.",
      unread: "Ungelesen",
    },
    onboarding: {
      whatsYourWebsite: "Wie lautet Ihre Website?",
      websiteIntro: "Geben Sie Ihre Website ein, und wir ermitteln, was Ihr Unternehmen tut, für wen, und wofür es ranken sollte.",
      websiteAddress: "Ihre Website-Adresse",
      websitePlaceholder: "ihrunternehmen.de",
      lookUpWebsite: "Diese Website prüfen",
      detected: "Erkannt",
      addingWebsite: "Ihre Website wird hinzugefügt…",
      continueLabel: "Weiter",
      pressArrow: "Tippen Sie auf den Pfeil, um Ihre Website zuerst zu prüfen, oder fahren Sie direkt fort.",
      readingWebsite: "Ihre Website wird gelesen…",
      websiteFound: "Website gefunden",
      enterAddressToSee: "Geben Sie Ihre Adresse ein, um zu sehen, was wir finden.",
      regionNext: "Als Nächstes Region und Kategorie",
      weWillUseWebsite: "Wir nutzen Ihre Website, um Ihr Unternehmen zu verstehen.",
      activateRepGet: "RepGet aktivieren",
      seeHowAiTalks: "Sehen Sie, wie KI über Ihre Marke spricht",
      trackQuestions: "Verfolgen Sie die Fragen, die Kunden einer KI stellen, bevor sie Ihr Unternehmen entdecken.",
      trackingOn: "Verfolgung aktiv",
      noAssistants: "Auf dieser Installation ist noch kein Assistent eingerichtet. Fragen werden gespeichert und geprüft, sobald einer da ist.",
      questionsWorthTracking: "Fragen, die sich zu verfolgen lohnen",
      suggestedFromSite: "Diese haben wir aus Ihrer Website und Ihrem Markt vorgeschlagen. Entfernen Sie, was nicht passt.",
      writingQuestions: "Wir formulieren Fragen, die Ihre Kunden stellen würden…",
      noQuestionsYet: "Noch keine Fragen. Fügen Sie unten eine hinzu oder lassen Sie sich welche vorschlagen.",
      addQuestionPlaceholder: "Fügen Sie eine Frage hinzu, die Ihre Kunden stellen würden",
      addQuestion: "Frage hinzufügen",
      writing: "Wird geschrieben…",
      suggestMore: "Mehr vorschlagen",
      getStarted: "Loslegen",
      setupProgress: "Fortschritt der Einrichtung",
      readingNow: "Wir lesen gerade Ihre Website. Das dauert meist ein bis zwei Minuten.",
      view: "Ansehen",
      goToDashboard: "Zu Ihrem Dashboard",
      searchOpportunities: "Such-Chancen",
      topicClusters: "Themencluster",
      publishingPlan: "Veröffentlichungsplan",
      articlesContentBacklinks: "Artikel, Inhalte und Backlinks",
      heresWhatWellBuild: "Das werden wir aufbauen",
      thenOnChecklist: "Danach in Ihrer Einrichtungscheckliste",
      buildMyPlan: "Meinen Contentplan erstellen",
      starting: "Wird gestartet…",
      takesFewMinutes: "Das dauert einige Minuten. Sie können weitermachen, während wir ihn im Hintergrund erstellen.",
      connectGoogle: "Google verbinden",
      analyticsTellUs: "Analytics und Search Console zeigen uns, welche Artikel wirken - damit wir mehr davon schreiben.",
      connectedChangeLater: "Verbunden. Sie können das später unter Integrationen ändern.",
      openingGoogle: "Google wird geöffnet…",
      whyWeAsk: "Warum wir danach fragen",
      readPerformanceOnly: "Wir lesen ausschließlich Leistungsdaten: Klicks, Impressionen und Sitzungen Ihrer eigenen Website. Wir veröffentlichen, ändern oder löschen nichts in Ihrem Google-Konto, und Sie können die Verbindung jederzeit trennen.",
      connected: "Verbunden",
      plansUnavailable: "Tarife sind derzeit nicht verfügbar. Schauen Sie bitte in Kürze wieder vorbei.",
      growthEngineReady: "Ihr Wachstumsmotor steht bereit",
      plan: "Tarif",
      payYearly: "Jährlich zahlen",
      paypalNoTrial: "PayPal startet Ihren Tarif sofort, ohne die kostenlose Testphase.",
      cancelAnyTime: "Jederzeit kündbar. Einen Gutscheincode können Sie beim Bezahlen eingeben.",
      whatsIncluded: "Was enthalten ist",
      secureByStripe: "Sichere Zahlung über Stripe. Ihre Kartendaten erreichen uns nie.",
      paymentTakingLonger: "Ihre Zahlung ist eingegangen. Die Aktivierung des Tarifs dauert länger als üblich.",
      activatingNow: "Vielen Dank. Wir aktivieren Ihren Tarif; das dauert meist wenige Sekunden.",
      goToMyWebsite: "Zu meiner Website",
      checkBilling: "Abrechnung ansehen",
      extraordinaryBusinesses: "Außergewöhnliche Unternehmen verdienen mehr Sichtbarkeit.",
      chooseYourPlan: "Wählen Sie Ihren Tarif",
      whatHappensSubscribe: "Was passiert, sobald Sie abonnieren",
      weResearchKeywords: "Wir recherchieren Ihre Suchbegriffe, bauen einen auf Ihren Tarif zugeschnittenen Contentplan und fangen an zu schreiben. Kurz darauf haben Sie Ihren ersten Artikel zur Durchsicht.",
      contentAndBacklinks: "Inhalte und Backlinks",
      addYourWebsite: "Fügen Sie Ihre Website hinzu",
    },
  },
};

const MESSAGES: Record<Locale, Messages> = { en, es, fr, it, de };

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale] ?? en;
}
