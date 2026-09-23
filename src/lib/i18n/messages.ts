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
    networkWhyTitle: string;
    networkWhyBody: string;
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
    };
    websites: {
      title: string;
      /**
       * "3 connected. Each website is billed on its own plan."
       *
       * A function rather than a string with a token in it: the count governs
       * the plural, and every language pluralises differently. Building the
       * sentence in the dictionary lets each locale decide; a token would
       * force one language's grammar onto the other four.
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
      updatePost: string;
      publish: string;
      sendingDraft: string;
      planningOutline: string;
      writingBody: string;
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
    };
    research: {
      contentPlan: string;
      articlesTab: string;
      opportunities: string;
      refresh: string;
      looking: string;
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
    };
    keys: {
      keyCopied: string;
      keyCopyFailed: string;
      keyRevoked: string;
      newKeyLabel: string;
      neverUsed: string;
      pluginTitle: string;
      pluginHelp: string;
      copyNowHelp: string;
      newKey: string;
      keyNotePlaceholder: string;
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
      requestLink: string;
      admin: string;
      articleLanguageHelp: string;
      namedInstead: string;
      mostPopular: string;
      receiptInPayPal: string;
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
      copyNow: string;
      downloadPlugin: string;
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
      writeAutomatically: string;
      daysToWrite: string;
      publishWithoutAsking: string;
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
        body: "Link your site — WordPress, Ghost, Shopify or a webhook — so we can publish for you.",
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
      "Paid ads drain your budget every month — and stop the moment you do.",
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
      "Audit, AI visibility, research, content, publishing, backlinks and reporting — in one place, for less than the tools cost separately.",
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
      "Connect once. No manual uploads, no copy-paste — articles appear on your site automatically, with their images.",
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
      "Checked daily — if a link is removed, your credit comes back",
    ],
    networkHowLink: "How the exchange works",
    networkWhyTitle: "Why exchange rather than buy",
    networkWhyBody:
      "Buying links is against Google's guidelines and can be penalised. Every link here sits in a real article on a real business's site, published because that business wanted the article — which is why the network works by exchange.",
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
      "Everything is included in every plan. The difference is how much we write for you each month.",
    perMonth: " / month",
    getStarted: "Get started",
    mostPopular: "Most popular",
    tryItFirst: "Try it first",
    starterTagline:
      "Try us with a real article and a real backlink before moving up.",
    unavailable:
      "Pricing is not available right now. Please check back shortly.",
    annualNote:
      "Annual plans are available once you sign up, at two months free. Cancel any time — see our",
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
    metaDescription: "Why AI SEO Platform exists and who it is for.",
    title: "SEO results without the agency",
    intro: [
      'A dentist, a plumber or a small law firm knows they should "do SEO". What that actually needs is a keyword researcher, a writer, someone who understands technical audits, and outreach for links. An agency bundles all of that for a few thousand a month.',
      "Most small businesses cannot justify that, so they do nothing — and stay invisible on exactly the searches that would bring them customers.",
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
      "What RepGet customers measure: rankings, AI visibility, published articles and backlinks earned — and how the first results arrive.",
    eyebrow: "Success stories",
    title: "We would rather show you what we measure than invent a customer.",
    intro:
      "RepGet is new, and we are not going to invent a business that used it or round someone's numbers up for a landing page. Here is what the product actually tracks, and what the first months honestly look like — so you can judge it on something real.",
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
        body: "What was written, when it went live, and what it did afterwards — so a month's work has an answer rather than an invoice.",
      },
      {
        label: "Backlinks earned",
        body: "Real links inside real articles on other businesses' sites, checked daily. If one is removed, your credit comes back.",
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
        body: "Search Console data arrives for the first articles. This is where rankings begin to move — SEO does not pay out in week one, and anyone promising otherwise is selling something else.",
      },
    ],
    ctaTitle: "Be the first story on this page.",
    ctaBody:
      "Start with a free check of your site — it takes a minute and costs nothing. If what we find is worth acting on, plans start at €1 for the first month.",
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
      "You are paid in link credits rather than money. One hosted article earns one credit, and one credit buys you a link from another business's site. If you want cash for guest posts, this is not that — and there are marketplaces that do it.",
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
        body: "Articles arrive as drafts on your site. Publish, edit or reject them — nothing goes live without you.",
      },
    ],
    suitsTitle: "Who this suits",
    suitsBody:
      "A small business with a blog that already publishes occasionally, and wants links to its own pages without paying for them. If your site has no readers, hosting articles will not change that — the links you earn are worth what your site is worth.",
    joinNote:
      "Joining is part of every plan. Turn it on from your website settings.",
    ctaPrimary: "Get Started",
    ctaSecondary: "How the exchange works",
  },
  affiliate: {
    metaTitle: "Refer a business",
    metaDescription:
      "Share your link and earn link credits when someone you refer starts a paid plan.",
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
        body: "Credits land in your account automatically and can be spent on backlinks straight away.",
      },
    ],
    termsTitle: "The terms, plainly",
    terms: [
      "The reward is account credit, not cash. It cannot be withdrawn.",
      "A referral counts once the person you referred pays for their first month.",
      "Each business can be referred once.",
      "Credits are spent on link building inside the product.",
    ],
    ctaPrimary: "Get Started",
    ctaNote:
      "Your referral link is in Settings as soon as you have an account.",
  },
  backlinkExchange: {
    metaTitle: "How the backlink exchange works",
    metaDescription:
      "Earn links to your website by publishing one article for another business. Relevant matches only, verified daily, credits refunded if a link is removed.",
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
        body: "A dentist is never matched with a crypto blog. If we cannot establish that two sites are topically related, we do not make the match — an irrelevant link is worth nothing and can do harm.",
      },
      {
        title: "Checked every day",
        body: "We re-check every link daily. Links do not silently disappear without you finding out.",
      },
      {
        title: "Credits refunded if a link goes",
        body: "If a link is removed, you get the credit back and it disappears from your dashboard. We do not count links that no longer exist.",
      },
    ],
    notTitle: "What this is not",
    notBody:
      "This is not a private blog network, and we do not sell links. Every link sits inside a real article on a real business's website, published because that business wanted an article. Buying links is against Google's guidelines and can be penalised — which is exactly why the network works by exchange rather than by sale.",
    ctaTitle: "Every plan includes credits",
    ctaBody: "You can request your first links before hosting anything.",
    ctaPrimary: "Get Started",
    ctaSecondary: "Host articles instead",
  },
  faq: {
    metaTitle: "FAQ",
    metaDescription: "Common questions about how AI SEO Platform works.",
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
          "They are written by AI, so you should read them before they go live — we give you an editor for exactly that. They are written for your business, in your language and market, and you can set the tone you want.",
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
          "Anything already published stays on your website — it is your content. You own the articles we write for you.",
      },
    ],
  },
  contact: {
    metaTitle: "Contact",
    metaDescription: "How to get in touch with AI SEO Platform.",
    title: "Contact us",
    subtitle:
      "Questions about the product, your account, or billing — we read every message and reply within two working days.",
    emailLabel: "Email",
    accountNote:
      "If you are writing about your account, please send it from the address you signed up with.",
  },
  legalNotice: "This page is available in English only. Translations of our legal terms are prepared by a professional translator before publication.",

  app: {
    settings: {
      personalTitle: "Personal details",
      personalSubtitle: "Your personal account details",
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
        "You sign in with Google. Set a password to sign in with your email as well — Google will keep working.",
      setPasswordHelp: "At least 8 characters.",
      settingPassword: "Setting…",
      passwordCreated:
        "Password set. You can now sign in with your email and password.",
      languageLabel: "Dashboard language",
      languageHelp: "The language of this dashboard. Your articles are written in the language set on the Business tab.",
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
      addMemberHelp: "They need a RepGet account already. Invite them by the email they signed up with.",
      memberColumn: "Member",
      roleColumn: "Role",
      statusColumn: "Status",
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
    },
    websites: {
      title: "Websites",
      connected: "1 connected. Each website is billed on its own plan.|{count} connected. Each website is billed on its own plan.",
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
    },
    billing: {
      title: "Billing",
      subtitle: "Each website has its own plan. Credits are shared across all of them.",
      yourWebsites: "Your websites",
      yourWebsitesHelp: "A website without a plan cannot generate or publish articles.",
      noPlanYet: "No plan yet",
      planRenews: "{plan} — renews {date}",
      planEnds: "{plan} — ends {date}",
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
      paymentReceived: "Payment received — confirming your subscription…",
      checkoutCancelled: "Checkout cancelled.",
      purchaseReceived: "Payment received — your purchase will appear shortly.",
      purchaseCancelled: "Purchase cancelled.",
      addWebsiteFirst: "Add a website first — each plan pays for one site.",
      checkoutFailed: "Could not start checkout. Please try again.",
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
      updatePost: "Update post",
      publish: "Publish",
      sendingDraft: "Sending as a draft…",
      planningOutline: "Planning what to cover",
      writingBody: "Writing the article",
    },
    analytics: {
      googleResults: "Google results",
      connectHelp: "Connect Google to see which searches bring people to your website, and how that changes as we publish.",
      connectGoogle: "Connect Google",
      redirecting: "Redirecting…",
      expired: "The previous connection expired. Reconnect to resume importing.",
      connected: "Connected",
      last28: "Last 28 days.",
      chooseThenImport: "Choose your properties below, then import.",
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
      importing: "Importing your data — this takes a moment",
      disconnected: "Google disconnected",
      statusConnected: "Google connected",
      statusCancelled: "Connection cancelled",
      statusForbidden: "You cannot connect that website",
      statusInvalid: "That link was not valid — try again",
      statusError: "Google could not be connected",
    },
    research: {
      contentPlan: "Content plan",
      articlesTab: "Articles",
      opportunities: "Opportunities",
      refresh: "Refresh",
      looking: "Looking…",
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
      keyword: "Keyword",
      opportunity: "Opportunity",
      searchesPerMonth: "Searches / mo",
      competition: "Competition",
      topic: "Topic",
      difficultyLow: "Low",
      difficultyMedium: "Medium",
      difficultyHigh: "High",
      difficultyVeryHigh: "Very high",
      researching: "Researching keywords — this takes a minute",
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
      cantFind: "Can&rsquo;t find your integration?",
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
      draftPublishedAt: "Draft published — open it at {name}",
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
      askHelp: "Ask the way a customer would, and do not name your business — the point is to see whether you come up on your own.",
      suggestedQuestions: "Suggested questions — click to track",
      noQuestions: "No questions tracked yet",
      noQuestionsHelp: "Add the questions your customers would ask an AI assistant, then check whether your business gets named in the answer.",
      notChecked: "Not checked",
      notNamed: "Not named",
      stopTracking: "Stop tracking this question",
      questionAdded: "Question added",
      checkQueued: "Checking — results appear here in a few minutes",
      alreadyTracking: "You are already tracking the questions we would suggest",
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
      noRequests: "No link requests yet",
      noRequestsHelp: "Request a link and we find another business in the network to publish it in their next article. Each live link costs one credit.",
      noneGiven: "None yet. When we write your next article, a link to another business may be included and you will earn a credit.",
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
      cancelRequest: "Cancel request",
      untitledArticle: "Untitled article",
      joined: "You are in the network",
      leftNetwork: "Left the network",
      requestSaved: "Request saved — waiting for a suitable site",
      requestCancelled: "Request cancelled, credit released",
      statusPending: "Finding a website",
      statusMatched: "Waiting for their next article",
      statusLive: "Live",
      statusCancelled: "Cancelled",
      statusRemoved: "Removed — credit returned",
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
    },
    calendar: {
      changeTopic: "Change topic",
      addInstructions: "Add instructions",
      removeFromPlan: "Remove from plan",
      instructionsPlaceholder: "Anything this article should cover or avoid.",
      previousMonth: "Previous month",
      nextMonth: "Next month",
      savedInstructions: "Saved — we will use this when writing",
      removedFromPlan: "Removed from the plan",
      writingStarted: "Writing started — it takes a few minutes",
    },
    addons: {
      moreCredits: "More link credits",
      moreCreditsHelp: "Your plan includes credits each month. Buy more if you run out — these do not expire.",
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
    },
    keys: {
      keyCopied: "Key copied",
      keyCopyFailed: "Could not copy. Select the key and copy it manually.",
      keyRevoked: "Key revoked",
      newKeyLabel: "Your new integration key",
      neverUsed: "Never used",
      pluginTitle: "WordPress plugin",
      pluginHelp: "Install our plugin, paste a key, and articles publish here automatically.",
      copyNowHelp: "We only store a scrambled version, so it cannot be looked up later. If you lose it, revoke it and make a new one.",
      newKey: "New key",
      keyNotePlaceholder: "What is this key for? (optional)",
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
      fillsIn: " They fill in automatically once we have analysed the site — you can also enter them now.",
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
      requestLink: "Request a link",
      admin: "Admin",
      articleLanguageHelp: "Your articles are written in this language.",
      namedInstead: "Named instead of you, most often",
      mostPopular: "Most popular",
      receiptInPayPal: "Receipt in PayPal",
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
      losingTrafficIntro: "Pages getting fewer clicks than they did a month ago, from your Search Console data.",
      noCompetitorsFound: "We did not find any from your site. Add the rivals you know of and we will use them to find content gaps.",
      competitorsHelp: "Who else shows up when buyers search your space. We use these to find content gaps and the terms worth going after.",
      connectWebsiteFirst: "Connect a website below first. Until then articles stay as drafts.",
      generationHelp: "How your articles get written, and what happens to them when they are ready.",
      altHelp: "Read aloud to people using a screen reader, and by search engines.",
      featuredImageHelp: "The picture at the top of the article, and the one shown when it is shared.",
      factsOnePerLine: "One per line. These are the only specifics we will state outright about your business — everything else stays general.",
      voiceBehindArticles: "The voice behind every article. Merged in from its own panel, so one Save covers the whole screen.",
      creditsExplainer: "Credits are added to your account and can be spent on link building. They are not cash and cannot be withdrawn. A referral counts once the person you referred pays for their first month, and each person can be referred once.",
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
      copyNow: "Copy this now — it is not shown again",
      downloadPlugin: "Download the plugin",
      cantFindIntegration: "Can&rsquo;t find your integration?",
      adaptive: "Adaptive",
      custom: "Custom",
      wordRange: "Between 300 and 5,000.",
      findOpportunities: "Find opportunities",
      noOpportunities: "No opportunities found yet",
      losingTraffic: "Losing traffic",
      notWrittenHere: "Not written here",
      nothingLosing: "Nothing is losing traffic",
      nothingLosingHelp: "We compare the last 28 days against the 28 before. Nothing has dropped.",
      writeAutomatically: "Write articles automatically",
      daysToWrite: "Days to write on",
      publishWithoutAsking: "Publish without asking me",
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
      passwordHint: "At least 8 characters, including a number and a letter.",
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
      readPerformanceOnly: "We read performance only — clicks, impressions and sessions for your own site. We never post, change or delete anything in your Google account, and you can disconnect at any time.",
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
        body: "Conecte su web — WordPress, Ghost, Shopify o un webhook — para que publiquemos por usted.",
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
      "Comprobados a diario: si se retira un enlace, recupera su crédito",
    ],
    networkHowLink: "Cómo funciona el intercambio",
    networkWhyTitle: "Por qué intercambiar en lugar de comprar",
    networkWhyBody:
      "Comprar enlaces va contra las directrices de Google y puede penalizarse. Aquí cada enlace está dentro de un artículo real, en la web de una empresa real que quería ese artículo. Por eso la red funciona por intercambio.",
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
      "Todo está incluido en cada plan. La diferencia es cuánto escribimos para usted cada mes.",
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
    metaDescription: "Por qué existe AI SEO Platform y para quién es.",
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
        body: "Enlaces reales dentro de artículos reales en webs de otros negocios, comprobados a diario. Si se elimina uno, recupera su crédito.",
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
      "Empiece con un análisis gratuito de su web: tarda un minuto y no cuesta nada. Si lo que encontramos merece la pena, los planes empiezan en 1€ el primer mes.",
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
      "Comparta su enlace y gane créditos cuando alguien a quien recomiende contrate un plan de pago.",
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
        body: "Los créditos llegan automáticamente a su cuenta y puede gastarlos en enlaces de inmediato.",
      },
    ],
    termsTitle: "Las condiciones, sin rodeos",
    terms: [
      "La recompensa es crédito en la cuenta, no dinero. No se puede retirar.",
      "Una recomendación cuenta cuando la persona recomendada paga su primer mes.",
      "Cada negocio puede ser recomendado una sola vez.",
      "Los créditos se gastan en construcción de enlaces dentro del producto.",
    ],
    ctaPrimary: "Empezar",
    ctaNote:
      "Su enlace de recomendación está en Ajustes en cuanto tenga cuenta.",
  },
  backlinkExchange: {
    metaTitle: "Cómo funciona el intercambio de enlaces",
    metaDescription:
      "Consiga enlaces hacia su web publicando un artículo para otro negocio. Solo emparejamientos relevantes, verificados a diario y créditos devueltos si un enlace desaparece.",
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
        body: "Si se elimina un enlace, recupera el crédito y desaparece de su panel. No contamos enlaces que ya no existen.",
      },
    ],
    notTitle: "Lo que esto no es",
    notBody:
      "Esto no es una red privada de blogs y no vendemos enlaces. Cada enlace está dentro de un artículo real en la web de un negocio real, publicado porque ese negocio quería un artículo. Comprar enlaces va contra las directrices de Google y puede ser penalizado, y por eso precisamente la red funciona por intercambio y no por venta.",
    ctaTitle: "Todos los planes incluyen créditos",
    ctaBody: "Puede pedir sus primeros enlaces antes de alojar nada.",
    ctaPrimary: "Empezar",
    ctaSecondary: "Prefiero alojar artículos",
  },
  faq: {
    metaTitle: "Preguntas frecuentes",
    metaDescription:
      "Preguntas habituales sobre cómo funciona AI SEO Platform.",
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
    metaDescription: "Cómo ponerse en contacto con AI SEO Platform.",
    title: "Contacto",
    subtitle:
      "Preguntas sobre el producto, su cuenta o la facturación: leemos todos los mensajes y respondemos en un plazo de dos días laborables.",
    emailLabel: "Correo electrónico",
    accountNote:
      "Si escribe sobre su cuenta, hágalo desde la dirección con la que se registró.",
  },
  legalNotice: "Esta página solo está disponible en inglés. Las traducciones de nuestros términos legales las prepara un traductor profesional antes de su publicación.",

  app: {
    settings: {
      personalTitle: "Datos personales",
      personalSubtitle: "Los datos de su cuenta",
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
      languageHelp: "El idioma de este panel. Sus artículos se escriben en el idioma configurado en la pestaña Negocio.",
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
      addMemberHelp: "Necesitan tener ya una cuenta de RepGet. Invítelos con el correo con el que se registraron.",
      memberColumn: "Miembro",
      roleColumn: "Función",
      statusColumn: "Estado",
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
    },
    websites: {
      title: "Sitios web",
      connected: "1 conectado. Cada sitio web se factura con su propio plan.|{count} conectados. Cada sitio web se factura con su propio plan.",
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
    },
    billing: {
      title: "Facturación",
      subtitle: "Cada sitio web tiene su propio plan. Los créditos se comparten entre todos.",
      yourWebsites: "Sus sitios web",
      yourWebsitesHelp: "Un sitio web sin plan no puede generar ni publicar artículos.",
      noPlanYet: "Todavía sin plan",
      planRenews: "{plan} — se renueva el {date}",
      planEnds: "{plan} — finaliza el {date}",
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
      paymentReceived: "Pago recibido — confirmando su suscripción…",
      checkoutCancelled: "Pago cancelado.",
      purchaseReceived: "Pago recibido — su compra aparecerá en breve.",
      purchaseCancelled: "Compra cancelada.",
      addWebsiteFirst: "Añada primero un sitio web — cada plan paga un solo sitio.",
      checkoutFailed: "No se pudo iniciar el pago. Inténtelo de nuevo.",
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
      updatePost: "Actualizar publicación",
      publish: "Publicar",
      sendingDraft: "Enviando como borrador…",
      planningOutline: "Planificando qué cubrir",
      writingBody: "Escribiendo el artículo",
    },
    analytics: {
      googleResults: "Resultados de Google",
      connectHelp: "Conecte Google para ver qué búsquedas llevan gente a su sitio web y cómo cambia a medida que publicamos.",
      connectGoogle: "Conectar Google",
      redirecting: "Redirigiendo…",
      expired: "La conexión anterior caducó. Vuelva a conectarla para seguir importando.",
      connected: "Conectado",
      last28: "Últimos 28 días.",
      chooseThenImport: "Elija sus propiedades abajo y luego importe.",
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
      importing: "Importando sus datos — esto tarda un momento",
      disconnected: "Google desconectado",
      statusConnected: "Google conectado",
      statusCancelled: "Conexión cancelada",
      statusForbidden: "No puede conectar ese sitio web",
      statusInvalid: "Ese enlace no era válido — inténtelo de nuevo",
      statusError: "No se pudo conectar Google",
    },
    research: {
      contentPlan: "Plan de contenidos",
      articlesTab: "Artículos",
      opportunities: "Oportunidades",
      refresh: "Actualizar",
      looking: "Buscando…",
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
      keyword: "Palabra clave",
      opportunity: "Oportunidad",
      searchesPerMonth: "Búsquedas / mes",
      competition: "Competencia",
      topic: "Tema",
      difficultyLow: "Baja",
      difficultyMedium: "Media",
      difficultyHigh: "Alta",
      difficultyVeryHigh: "Muy alta",
      researching: "Investigando palabras clave — esto tarda un minuto",
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
      draftPublishedAt: "Borrador publicado — ábralo en {name}",
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
      askHelp: "Pregunte como lo haría un cliente y no nombre su negocio — la idea es ver si aparece por sí solo.",
      suggestedQuestions: "Preguntas sugeridas — haga clic para seguirlas",
      noQuestions: "Todavía no hay preguntas en seguimiento",
      noQuestionsHelp: "Añada las preguntas que sus clientes harían a un asistente de IA y luego compruebe si su negocio aparece en la respuesta.",
      notChecked: "Sin comprobar",
      notNamed: "Sin mención",
      stopTracking: "Dejar de seguir esta pregunta",
      questionAdded: "Pregunta añadida",
      checkQueued: "Comprobando — los resultados aparecerán aquí en unos minutos",
      alreadyTracking: "Ya está siguiendo las preguntas que le sugeriríamos",
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
      noRequests: "Todavía no hay solicitudes de enlace",
      noRequestsHelp: "Solicite un enlace y buscaremos otro negocio de la red que lo publique en su próximo artículo. Cada enlace activo cuesta un crédito.",
      noneGiven: "Todavía ninguno. Cuando escribamos su próximo artículo, puede incluirse un enlace a otro negocio y usted ganará un crédito.",
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
      cancelRequest: "Cancelar solicitud",
      untitledArticle: "Artículo sin título",
      joined: "Ya está en la red",
      leftNetwork: "Ha salido de la red",
      requestSaved: "Solicitud guardada — esperando un sitio adecuado",
      requestCancelled: "Solicitud cancelada, crédito liberado",
      statusPending: "Buscando un sitio web",
      statusMatched: "Esperando su próximo artículo",
      statusLive: "Activo",
      statusCancelled: "Cancelado",
      statusRemoved: "Retirado — crédito devuelto",
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
    },
    calendar: {
      changeTopic: "Cambiar tema",
      addInstructions: "Añadir instrucciones",
      removeFromPlan: "Quitar del plan",
      instructionsPlaceholder: "Cualquier cosa que este artículo deba tratar o evitar.",
      previousMonth: "Mes anterior",
      nextMonth: "Mes siguiente",
      savedInstructions: "Guardado — lo usaremos al escribir",
      removedFromPlan: "Quitado del plan",
      writingStarted: "Redacción iniciada — tarda unos minutos",
    },
    addons: {
      moreCredits: "Más créditos de enlace",
      moreCreditsHelp: "Su plan incluye créditos cada mes. Compre más si se le acaban — estos no caducan.",
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
    },
    keys: {
      keyCopied: "Clave copiada",
      keyCopyFailed: "No se pudo copiar. Seleccione la clave y cópiela manualmente.",
      keyRevoked: "Clave revocada",
      newKeyLabel: "Su nueva clave de integración",
      neverUsed: "Nunca usada",
      pluginTitle: "Plugin de WordPress",
      pluginHelp: "Instale nuestro plugin, pegue una clave y los artículos se publicarán aquí automáticamente.",
      copyNowHelp: "Solo guardamos una versión cifrada, así que no se puede consultar después. Si la pierde, revóquela y cree una nueva.",
      newKey: "Nueva clave",
      keyNotePlaceholder: "¿Para qué es esta clave? (opcional)",
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
      fillsIn: " Se rellenan solos en cuanto hayamos analizado el sitio — también puede introducirlos ahora.",
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
      requestLink: "Solicitar un enlace",
      admin: "Administración",
      articleLanguageHelp: "Sus artículos se escriben en este idioma.",
      namedInstead: "Mencionados en su lugar con más frecuencia",
      mostPopular: "Más popular",
      receiptInPayPal: "Recibo en PayPal",
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
      losingTrafficIntro: "Páginas que reciben menos clics que hace un mes, según sus datos de Search Console.",
      noCompetitorsFound: "No encontramos ninguno en su sitio. Añada los rivales que conozca y los usaremos para detectar huecos de contenido.",
      competitorsHelp: "Quién más aparece cuando los compradores buscan en su sector. Los usamos para encontrar huecos de contenido y los términos que merecen la pena.",
      connectWebsiteFirst: "Conecte primero un sitio web abajo. Hasta entonces los artículos quedan como borradores.",
      generationHelp: "Cómo se escriben sus artículos y qué ocurre con ellos cuando están listos.",
      altHelp: "Se lee en voz alta a quienes usan lector de pantalla, y la leen los buscadores.",
      featuredImageHelp: "La imagen de la parte superior del artículo, y la que se muestra al compartirlo.",
      factsOnePerLine: "Uno por línea. Son los únicos datos concretos que afirmaremos sobre su negocio; todo lo demás queda general.",
      voiceBehindArticles: "La voz detrás de cada artículo. Integrada desde su propio panel, así que un solo Guardar cubre toda la pantalla.",
      creditsExplainer: "Los créditos se añaden a su cuenta y pueden gastarse en construcción de enlaces. No son dinero y no se pueden retirar. Una recomendación cuenta cuando la persona recomendada paga su primer mes, y cada persona puede ser recomendada una sola vez.",
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
      copyNow: "Cópielo ahora — no se volverá a mostrar",
      downloadPlugin: "Descargar el plugin",
      cantFindIntegration: "¿No encuentra su integración?",
      adaptive: "Adaptable",
      custom: "Personalizado",
      wordRange: "Entre 300 y 5000.",
      findOpportunities: "Buscar oportunidades",
      noOpportunities: "Todavía no se han encontrado oportunidades",
      losingTraffic: "Perdiendo tráfico",
      notWrittenHere: "No escrito aquí",
      nothingLosing: "Nada está perdiendo tráfico",
      nothingLosingHelp: "Comparamos los últimos 28 días con los 28 anteriores. Nada ha bajado.",
      writeAutomatically: "Escribir artículos automáticamente",
      daysToWrite: "Días en los que escribir",
      publishWithoutAsking: "Publicar sin preguntarme",
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
      passwordHint: "Al menos 8 caracteres, incluyendo un número y una letra.",
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
        body: "Reliez votre site — WordPress, Ghost, Shopify ou un webhook — pour que nous publiions à votre place.",
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
      "Vérifiés chaque jour : si un lien disparaît, votre crédit revient",
    ],
    networkHowLink: "Comment fonctionne l'échange",
    networkWhyTitle: "Pourquoi échanger plutôt qu'acheter",
    networkWhyBody:
      "Acheter des liens va à l'encontre des consignes de Google et peut être pénalisé. Ici chaque lien se trouve dans un vrai article, sur le site d'une entreprise réelle qui voulait cet article. C'est pourquoi le réseau fonctionne par échange.",
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
      "Tout est inclus dans chaque formule. La différence tient à ce que nous rédigeons pour vous chaque mois.",
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
    metaDescription: "Pourquoi AI SEO Platform existe et à qui il s'adresse.",
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
        body: "Ce qui a été écrit, quand c'est paru et ce que cela a donné — pour qu'un mois de travail ait une réponse et pas seulement une facture.",
      },
      {
        label: "Backlinks obtenus",
        body: "De vrais liens dans de vrais articles sur les sites d'autres entreprises, vérifiés chaque jour. Si un lien disparaît, votre crédit vous est rendu.",
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
      "Commencez par une analyse gratuite de votre site : une minute, sans frais. Si ce que nous trouvons mérite d'agir, les forfaits démarrent à 1€ le premier mois.",
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
      "Vous êtes rémunéré en crédits de liens, pas en argent. Un article hébergé rapporte un crédit, et un crédit vous obtient un lien depuis le site d'une autre entreprise. Si vous cherchez à être payé pour des articles invités, ce n'est pas cela — et il existe des places de marché pour ça.",
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
      "Partagez votre lien et gagnez des crédits quand une personne que vous parrainez souscrit un forfait payant.",
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
        body: "Les crédits arrivent automatiquement sur votre compte et sont utilisables immédiatement.",
      },
    ],
    termsTitle: "Les conditions, clairement",
    terms: [
      "La récompense est un crédit sur le compte, pas de l'argent. Elle n'est pas retirable.",
      "Un parrainage compte une fois que la personne parrainée a payé son premier mois.",
      "Chaque entreprise ne peut être parrainée qu'une fois.",
      "Les crédits se dépensent en netlinking dans le produit.",
    ],
    ctaPrimary: "Commencer",
    ctaNote:
      "Votre lien de parrainage est dans les Paramètres dès que vous avez un compte.",
  },
  backlinkExchange: {
    metaTitle: "Comment fonctionne l'échange de liens",
    metaDescription:
      "Gagnez des liens vers votre site en publiant un article pour une autre entreprise. Uniquement des associations pertinentes, vérifiées chaque jour, crédits remboursés si un lien disparaît.",
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
        body: "Si un lien est retiré, le crédit vous est rendu et le lien disparaît de votre tableau de bord. Nous ne comptons pas les liens qui n'existent plus.",
      },
    ],
    notTitle: "Ce que ce n'est pas",
    notBody:
      "Ce n'est pas un réseau de blogs privés et nous ne vendons pas de liens. Chaque lien se trouve dans un vrai article sur le site d'une vraie entreprise, publié parce que cette entreprise voulait un article. Acheter des liens est contraire aux consignes de Google et peut être pénalisé — c'est exactement pour cela que le réseau fonctionne par échange et non par vente.",
    ctaTitle: "Tous les forfaits incluent des crédits",
    ctaBody:
      "Vous pouvez demander vos premiers liens avant d'avoir hébergé quoi que ce soit.",
    ctaPrimary: "Commencer",
    ctaSecondary: "Plutôt héberger des articles",
  },
  faq: {
    metaTitle: "FAQ",
    metaDescription:
      "Questions fréquentes sur le fonctionnement d'AI SEO Platform.",
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
          "Ils sont rédigés par une IA : lisez-les donc avant leur mise en ligne — nous vous fournissons un éditeur exactement pour cela. Ils sont écrits pour votre entreprise, dans votre langue et votre marché, et vous pouvez définir le ton souhaité.",
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
    metaDescription: "Comment joindre AI SEO Platform.",
    title: "Nous contacter",
    subtitle:
      "Des questions sur le produit, votre compte ou la facturation : nous lisons chaque message et répondons sous deux jours ouvrés.",
    emailLabel: "E-mail",
    accountNote:
      "Si votre message concerne votre compte, envoyez-le depuis l'adresse utilisée lors de l'inscription.",
  },
  legalNotice: "Cette page n'est disponible qu'en anglais. Les traductions de nos conditions légales sont réalisées par un traducteur professionnel avant publication.",

  app: {
    settings: {
      personalTitle: "Informations personnelles",
      personalSubtitle: "Les informations de votre compte",
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
      languageHelp: "La langue de ce tableau de bord. Vos articles sont rédigés dans la langue définie dans l\u2019onglet Entreprise.",
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
      addMemberHelp: "Ils doivent déjà avoir un compte RepGet. Invitez-les avec l\u2019adresse utilisée à l\u2019inscription.",
      memberColumn: "Membre",
      roleColumn: "Rôle",
      statusColumn: "Statut",
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
    },
    websites: {
      title: "Sites web",
      connected: "1 connecté. Chaque site est facturé sur son propre forfait.|{count} connectés. Chaque site est facturé sur son propre forfait.",
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
    },
    billing: {
      title: "Facturation",
      subtitle: "Chaque site a son propre forfait. Les crédits sont partagés entre tous.",
      yourWebsites: "Vos sites web",
      yourWebsitesHelp: "Un site sans forfait ne peut ni générer ni publier d\u2019articles.",
      noPlanYet: "Pas encore de forfait",
      planRenews: "{plan} — renouvellement le {date}",
      planEnds: "{plan} — fin le {date}",
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
      paymentReceived: "Paiement reçu — confirmation de votre abonnement…",
      checkoutCancelled: "Paiement annulé.",
      purchaseReceived: "Paiement reçu — votre achat apparaîtra sous peu.",
      purchaseCancelled: "Achat annulé.",
      addWebsiteFirst: "Ajoutez d\u2019abord un site — chaque forfait paie un seul site.",
      checkoutFailed: "Impossible de lancer le paiement. Réessayez.",
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
      updatePost: "Mettre à jour",
      publish: "Publier",
      sendingDraft: "Envoi en brouillon…",
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
      chooseThenImport: "Choisissez vos propriétés ci-dessous, puis importez.",
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
      importing: "Import de vos données — cela prend un instant",
      disconnected: "Google déconnecté",
      statusConnected: "Google connecté",
      statusCancelled: "Connexion annulée",
      statusForbidden: "Vous ne pouvez pas connecter ce site",
      statusInvalid: "Ce lien n\u2019était pas valide — réessayez",
      statusError: "Google n\u2019a pas pu être connecté",
    },
    research: {
      contentPlan: "Plan de contenu",
      articlesTab: "Articles",
      opportunities: "Opportunités",
      refresh: "Actualiser",
      looking: "Recherche…",
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
      keyword: "Mot-clé",
      opportunity: "Opportunité",
      searchesPerMonth: "Recherches / mois",
      competition: "Concurrence",
      topic: "Sujet",
      difficultyLow: "Faible",
      difficultyMedium: "Moyenne",
      difficultyHigh: "Élevée",
      difficultyVeryHigh: "Très élevée",
      researching: "Recherche de mots-clés — cela prend une minute",
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
      draftPublishedAt: "Brouillon publié — ouvrez-le sur {name}",
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
      askHelp: "Posez la question comme le ferait un client, sans nommer votre entreprise — le but est de voir si vous ressortez de vous-même.",
      suggestedQuestions: "Questions suggérées — cliquez pour suivre",
      noQuestions: "Aucune question suivie",
      noQuestionsHelp: "Ajoutez les questions que vos clients poseraient à un assistant IA, puis vérifiez si votre entreprise est citée dans la réponse.",
      notChecked: "Non vérifié",
      notNamed: "Non cité",
      stopTracking: "Ne plus suivre cette question",
      questionAdded: "Question ajoutée",
      checkQueued: "Vérification — les résultats apparaîtront ici dans quelques minutes",
      alreadyTracking: "Vous suivez déjà les questions que nous suggérerions",
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
      noRequests: "Aucune demande de lien",
      noRequestsHelp: "Demandez un lien et nous trouverons une autre entreprise du réseau pour le publier dans son prochain article. Chaque lien actif coûte un crédit.",
      noneGiven: "Aucun pour l\u2019instant. Lors de votre prochain article, un lien vers une autre entreprise pourra être inclus et vous gagnerez un crédit.",
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
      cancelRequest: "Annuler la demande",
      untitledArticle: "Article sans titre",
      joined: "Vous êtes dans le réseau",
      leftNetwork: "Vous avez quitté le réseau",
      requestSaved: "Demande enregistrée — en attente d\u2019un site adapté",
      requestCancelled: "Demande annulée, crédit libéré",
      statusPending: "Recherche d\u2019un site",
      statusMatched: "En attente de leur prochain article",
      statusLive: "En ligne",
      statusCancelled: "Annulé",
      statusRemoved: "Retiré — crédit restitué",
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
    },
    calendar: {
      changeTopic: "Changer de sujet",
      addInstructions: "Ajouter des consignes",
      removeFromPlan: "Retirer du plan",
      instructionsPlaceholder: "Ce que cet article doit aborder ou éviter.",
      previousMonth: "Mois précédent",
      nextMonth: "Mois suivant",
      savedInstructions: "Enregistré — nous l\u2019utiliserons à la rédaction",
      removedFromPlan: "Retiré du plan",
      writingStarted: "Rédaction lancée — cela prend quelques minutes",
    },
    addons: {
      moreCredits: "Plus de crédits de lien",
      moreCreditsHelp: "Votre forfait inclut des crédits chaque mois. Achetez-en si vous en manquez — ils n\u2019expirent pas.",
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
    },
    keys: {
      keyCopied: "Clé copiée",
      keyCopyFailed: "Copie impossible. Sélectionnez la clé et copiez-la manuellement.",
      keyRevoked: "Clé révoquée",
      newKeyLabel: "Votre nouvelle clé d\u2019intégration",
      neverUsed: "Jamais utilisée",
      pluginTitle: "Plugin WordPress",
      pluginHelp: "Installez notre plugin, collez une clé, et les articles se publient ici automatiquement.",
      copyNowHelp: "Nous n\u2019en stockons qu\u2019une version chiffrée : elle ne peut pas être retrouvée ensuite. Si vous la perdez, révoquez-la et créez-en une autre.",
      newKey: "Nouvelle clé",
      keyNotePlaceholder: "À quoi sert cette clé ? (facultatif)",
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
      fillsIn: " Elles se remplissent automatiquement une fois le site analysé — vous pouvez aussi les saisir maintenant.",
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
      requestLink: "Demander un lien",
      admin: "Administration",
      articleLanguageHelp: "Vos articles sont rédigés dans cette langue.",
      namedInstead: "Cités à votre place, le plus souvent",
      mostPopular: "Le plus choisi",
      receiptInPayPal: "Reçu dans PayPal",
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
      losingTrafficIntro: "Pages recevant moins de clics qu\u2019il y a un mois, d\u2019après vos données Search Console.",
      noCompetitorsFound: "Nous n\u2019en avons trouvé aucun depuis votre site. Ajoutez les concurrents que vous connaissez et nous les utiliserons pour repérer les manques de contenu.",
      competitorsHelp: "Qui d\u2019autre apparaît quand les acheteurs cherchent dans votre domaine. Nous les utilisons pour repérer les manques de contenu et les termes qui valent la peine.",
      connectWebsiteFirst: "Connectez d\u2019abord un site ci-dessous. En attendant, les articles restent en brouillon.",
      generationHelp: "Comment vos articles sont rédigés, et ce qu\u2019ils deviennent une fois prêts.",
      altHelp: "Lu à voix haute aux personnes utilisant un lecteur d\u2019écran, et lu par les moteurs de recherche.",
      featuredImageHelp: "L\u2019image en haut de l\u2019article, et celle affichée lors d\u2019un partage.",
      factsOnePerLine: "Un par ligne. Ce sont les seuls éléments précis que nous affirmerons sur votre entreprise ; tout le reste reste général.",
      voiceBehindArticles: "La voix derrière chaque article. Intégrée depuis son propre panneau, un seul Enregistrer couvre tout l\u2019écran.",
      creditsExplainer: "Les crédits sont ajoutés à votre compte et peuvent servir à la création de liens. Ce n\u2019est pas de l\u2019argent et ils ne peuvent pas être retirés. Un parrainage compte dès que la personne parrainée paie son premier mois, et chaque personne ne peut être parrainée qu\u2019une fois.",
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
      copyNow: "Copiez-le maintenant — il ne sera plus affiché",
      downloadPlugin: "Télécharger le plugin",
      cantFindIntegration: "Vous ne trouvez pas votre intégration ?",
      adaptive: "Adaptatif",
      custom: "Personnalisé",
      wordRange: "Entre 300 et 5 000.",
      findOpportunities: "Trouver des opportunités",
      noOpportunities: "Aucune opportunité trouvée pour l\u2019instant",
      losingTraffic: "Perte de trafic",
      notWrittenHere: "Non rédigé ici",
      nothingLosing: "Rien ne perd de trafic",
      nothingLosingHelp: "Nous comparons les 28 derniers jours aux 28 précédents. Rien n\u2019a baissé.",
      writeAutomatically: "Rédiger les articles automatiquement",
      daysToWrite: "Jours de rédaction",
      publishWithoutAsking: "Publier sans me demander",
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
      passwordHint: "Au moins 8 caractères, dont un chiffre et une lettre.",
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
        body: "Colleghi il suo sito — WordPress, Ghost, Shopify o un webhook — così pubblichiamo noi per lei.",
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
      "Verificati ogni giorno: se un link sparisce, il credito torna indietro",
    ],
    networkHowLink: "Come funziona lo scambio",
    networkWhyTitle: "Perché scambiare invece di comprare",
    networkWhyBody:
      "Comprare link va contro le linee guida di Google e può essere penalizzato. Qui ogni link sta dentro un articolo vero, sul sito di un'azienda vera che voleva quell'articolo. È per questo che la rete funziona per scambio.",
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
      "Ogni piano include tutto. La differenza è quanto scriviamo per lei ogni mese.",
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
    metaDescription: "Perché AI SEO Platform esiste e a chi si rivolge.",
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
        body: "Cosa è stato scritto, quando è uscito e che risultato ha dato — così un mese di lavoro ha una risposta e non solo una fattura.",
      },
      {
        label: "Backlink ottenuti",
        body: "Link veri dentro articoli veri su siti di altre aziende, controllati ogni giorno. Se un link viene rimosso, il credito le torna.",
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
      "Inizi con un controllo gratuito del sito: un minuto e nessun costo. Se ciò che troviamo merita, i piani partono da 1€ il primo mese.",
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
      "Condivida il suo link e guadagni crediti quando una persona che ha segnalato attiva un piano a pagamento.",
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
        body: "I crediti arrivano automaticamente sul suo account e sono spendibili subito.",
      },
    ],
    termsTitle: "Le condizioni, senza giri di parole",
    terms: [
      "Il premio è credito sull'account, non denaro. Non è prelevabile.",
      "Una segnalazione conta quando la persona segnalata paga il primo mese.",
      "Ogni azienda può essere segnalata una sola volta.",
      "I crediti si spendono in link building dentro il prodotto.",
    ],
    ctaPrimary: "Inizia",
    ctaNote:
      "Il suo link di segnalazione è nelle Impostazioni appena ha un account.",
  },
  backlinkExchange: {
    metaTitle: "Come funziona lo scambio di link",
    metaDescription:
      "Guadagni link verso il suo sito pubblicando un articolo per un'altra azienda. Solo abbinamenti pertinenti, verificati ogni giorno, crediti rimborsati se un link sparisce.",
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
        body: "Se un link viene rimosso, il credito le torna e il link sparisce dalla dashboard. Non contiamo link che non esistono più.",
      },
    ],
    notTitle: "Cosa non è",
    notBody:
      "Non è una rete privata di blog e non vendiamo link. Ogni link si trova dentro un articolo vero sul sito di un'azienda vera, pubblicato perché quell'azienda voleva un articolo. Comprare link è contro le linee guida di Google e può essere penalizzato: proprio per questo la rete funziona per scambio e non per vendita.",
    ctaTitle: "Ogni piano include crediti",
    ctaBody: "Può richiedere i primi link prima di aver ospitato qualcosa.",
    ctaPrimary: "Inizia",
    ctaSecondary: "Preferisco ospitare articoli",
  },
  faq: {
    metaTitle: "Domande frequenti",
    metaDescription: "Domande comuni sul funzionamento di AI SEO Platform.",
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
    metaDescription: "Come contattare AI SEO Platform.",
    title: "Contattaci",
    subtitle:
      "Domande sul prodotto, sul suo account o sulla fatturazione: leggiamo ogni messaggio e rispondiamo entro due giorni lavorativi.",
    emailLabel: "E-mail",
    accountNote:
      "Se scrive riguardo al suo account, lo faccia dall'indirizzo con cui si è registrato.",
  },
  legalNotice: "Questa pagina è disponibile solo in inglese. Le traduzioni dei nostri termini legali sono curate da un traduttore professionista prima della pubblicazione.",

  app: {
    settings: {
      personalTitle: "Dati personali",
      personalSubtitle: "I dati del suo account",
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
      languageHelp: "La lingua di questo pannello. I suoi articoli vengono scritti nella lingua impostata nella scheda Attività.",
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
      addMemberHelp: "Devono già avere un account RepGet. Li inviti con l\u2019indirizzo usato per registrarsi.",
      memberColumn: "Membro",
      roleColumn: "Ruolo",
      statusColumn: "Stato",
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
    },
    websites: {
      title: "Siti web",
      connected: "1 collegato. Ogni sito viene fatturato con il proprio piano.|{count} collegati. Ogni sito viene fatturato con il proprio piano.",
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
    },
    billing: {
      title: "Fatturazione",
      subtitle: "Ogni sito ha il proprio piano. I crediti sono condivisi tra tutti.",
      yourWebsites: "I suoi siti web",
      yourWebsitesHelp: "Un sito senza piano non può generare né pubblicare articoli.",
      noPlanYet: "Ancora nessun piano",
      planRenews: "{plan} — si rinnova il {date}",
      planEnds: "{plan} — termina il {date}",
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
      paymentReceived: "Pagamento ricevuto — stiamo confermando il suo abbonamento…",
      checkoutCancelled: "Pagamento annullato.",
      purchaseReceived: "Pagamento ricevuto — il suo acquisto comparirà a breve.",
      purchaseCancelled: "Acquisto annullato.",
      addWebsiteFirst: "Aggiunga prima un sito web — ogni piano paga un solo sito.",
      checkoutFailed: "Non è stato possibile avviare il pagamento. Riprovi.",
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
      updatePost: "Aggiorna articolo",
      publish: "Pubblica",
      sendingDraft: "Invio come bozza…",
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
      chooseThenImport: "Scelga le sue proprietà qui sotto, poi importi.",
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
      importing: "Importazione dei dati — ci vuole un momento",
      disconnected: "Google scollegato",
      statusConnected: "Google collegato",
      statusCancelled: "Connessione annullata",
      statusForbidden: "Non può collegare quel sito web",
      statusInvalid: "Quel link non era valido — riprovi",
      statusError: "Non è stato possibile collegare Google",
    },
    research: {
      contentPlan: "Piano dei contenuti",
      articlesTab: "Articoli",
      opportunities: "Opportunità",
      refresh: "Aggiorna",
      looking: "Ricerca…",
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
      keyword: "Parola chiave",
      opportunity: "Opportunità",
      searchesPerMonth: "Ricerche / mese",
      competition: "Concorrenza",
      topic: "Argomento",
      difficultyLow: "Bassa",
      difficultyMedium: "Media",
      difficultyHigh: "Alta",
      difficultyVeryHigh: "Molto alta",
      researching: "Ricerca delle parole chiave — ci vuole un minuto",
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
      draftPublishedAt: "Bozza pubblicata — la apra su {name}",
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
      askHelp: "Chieda come farebbe un cliente e non nomini la sua attività — il punto è vedere se emerge da sola.",
      suggestedQuestions: "Domande suggerite — clicchi per seguirle",
      noQuestions: "Nessuna domanda monitorata",
      noQuestionsHelp: "Aggiunga le domande che i suoi clienti porrebbero a un assistente IA, poi controlli se la sua attività viene citata nella risposta.",
      notChecked: "Non controllata",
      notNamed: "Non citata",
      stopTracking: "Smetti di seguire questa domanda",
      questionAdded: "Domanda aggiunta",
      checkQueued: "Controllo in corso — i risultati compariranno qui tra pochi minuti",
      alreadyTracking: "Sta già seguendo le domande che suggeriremmo",
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
      noRequests: "Ancora nessuna richiesta di link",
      noRequestsHelp: "Richieda un link e troveremo un\u2019altra attività della rete che lo pubblichi nel suo prossimo articolo. Ogni link attivo costa un credito.",
      noneGiven: "Ancora nessuno. Quando scriveremo il suo prossimo articolo, potrà essere incluso un link a un\u2019altra attività e lei guadagnerà un credito.",
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
      cancelRequest: "Annulla richiesta",
      untitledArticle: "Articolo senza titolo",
      joined: "È nella rete",
      leftNetwork: "Ha lasciato la rete",
      requestSaved: "Richiesta salvata — in attesa di un sito adatto",
      requestCancelled: "Richiesta annullata, credito liberato",
      statusPending: "Ricerca di un sito",
      statusMatched: "In attesa del loro prossimo articolo",
      statusLive: "Attivo",
      statusCancelled: "Annullato",
      statusRemoved: "Rimosso — credito restituito",
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
    },
    calendar: {
      changeTopic: "Cambia argomento",
      addInstructions: "Aggiungi istruzioni",
      removeFromPlan: "Togli dal piano",
      instructionsPlaceholder: "Qualsiasi cosa questo articolo debba trattare o evitare.",
      previousMonth: "Mese precedente",
      nextMonth: "Mese successivo",
      savedInstructions: "Salvato — lo useremo in fase di scrittura",
      removedFromPlan: "Tolto dal piano",
      writingStarted: "Scrittura avviata — ci vogliono alcuni minuti",
    },
    addons: {
      moreCredits: "Altri crediti per i link",
      moreCreditsHelp: "Il suo piano include crediti ogni mese. Ne acquisti altri se finiscono — questi non scadono.",
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
    },
    keys: {
      keyCopied: "Chiave copiata",
      keyCopyFailed: "Copia non riuscita. Selezioni la chiave e la copi manualmente.",
      keyRevoked: "Chiave revocata",
      newKeyLabel: "La sua nuova chiave di integrazione",
      neverUsed: "Mai usata",
      pluginTitle: "Plugin WordPress",
      pluginHelp: "Installi il nostro plugin, incolli una chiave e gli articoli verranno pubblicati qui automaticamente.",
      copyNowHelp: "Ne conserviamo solo una versione cifrata, quindi non è più recuperabile. Se la perde, la revochi e ne crei una nuova.",
      newKey: "Nuova chiave",
      keyNotePlaceholder: "A che cosa serve questa chiave? (facoltativo)",
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
      fillsIn: " Si compilano da soli una volta analizzato il sito — può anche inserirli ora.",
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
      requestLink: "Richiedi un link",
      admin: "Amministrazione",
      articleLanguageHelp: "I suoi articoli vengono scritti in questa lingua.",
      namedInstead: "Citati al suo posto, più spesso",
      mostPopular: "Il più scelto",
      receiptInPayPal: "Ricevuta in PayPal",
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
      losingTrafficIntro: "Pagine che ricevono meno clic rispetto a un mese fa, secondo i suoi dati di Search Console.",
      noCompetitorsFound: "Non ne abbiamo trovato nessuno dal suo sito. Aggiunga i concorrenti che conosce e li useremo per individuare lacune nei contenuti.",
      competitorsHelp: "Chi altro compare quando gli acquirenti cercano nel suo settore. Li usiamo per trovare lacune nei contenuti e i termini che vale la pena presidiare.",
      connectWebsiteFirst: "Colleghi prima un sito qui sotto. Fino ad allora gli articoli restano bozze.",
      generationHelp: "Come vengono scritti i suoi articoli e che cosa ne succede quando sono pronti.",
      altHelp: "Viene letta ad alta voce a chi usa uno screen reader, e dai motori di ricerca.",
      featuredImageHelp: "L\u2019immagine in cima all\u2019articolo, e quella mostrata quando viene condiviso.",
      factsOnePerLine: "Uno per riga. Sono gli unici dati precisi che affermeremo sulla sua attività; tutto il resto resta generico.",
      voiceBehindArticles: "La voce dietro ogni articolo. Integrata dal suo pannello, così un solo Salva copre tutta la schermata.",
      creditsExplainer: "I crediti vengono aggiunti al suo account e possono essere spesi per la creazione di link. Non sono denaro e non sono prelevabili. Un invito conta quando la persona invitata paga il primo mese, e ogni persona può essere invitata una sola volta.",
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
      copyNow: "La copi ora — non verrà mostrata di nuovo",
      downloadPlugin: "Scarica il plugin",
      cantFindIntegration: "Non trova la sua integrazione?",
      adaptive: "Adattiva",
      custom: "Personalizzata",
      wordRange: "Tra 300 e 5.000.",
      findOpportunities: "Trova opportunità",
      noOpportunities: "Ancora nessuna opportunità trovata",
      losingTraffic: "Traffico in calo",
      notWrittenHere: "Non scritto qui",
      nothingLosing: "Nulla sta perdendo traffico",
      nothingLosingHelp: "Confrontiamo gli ultimi 28 giorni con i 28 precedenti. Nulla è calato.",
      writeAutomatically: "Scrivi articoli automaticamente",
      daysToWrite: "Giorni in cui scrivere",
      publishWithoutAsking: "Pubblica senza chiedermelo",
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
      passwordHint: "Almeno 8 caratteri, con un numero e una lettera.",
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
        body: "Die konkreten Änderungen, die sich lohnen — in der Reihenfolge, in der sie sinnvoll sind.",
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
        body: "Verbinden Sie Ihre Website — WordPress, Ghost, Shopify oder einen Webhook — damit wir für Sie veröffentlichen.",
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
      "Bezahlte Anzeigen verbrauchen jeden Monat Ihr Budget — und hören auf, sobald Sie aufhören.",
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
      "Analyse, KI-Sichtbarkeit, Recherche, Inhalte, Veröffentlichung, Backlinks und Berichte — an einem Ort und günstiger als die Tools einzeln.",
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
      "Einmal verbinden. Kein manuelles Hochladen, kein Kopieren und Einfügen — Artikel erscheinen von selbst auf Ihrer Website, mit Bildern.",
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
      "Täglich geprüft — wird ein Link entfernt, erhalten Sie Ihr Guthaben zurück",
    ],
    networkHowLink: "So funktioniert der Tausch",
    networkWhyTitle: "Warum tauschen statt kaufen",
    networkWhyBody:
      "Links zu kaufen verstößt gegen die Richtlinien von Google und kann abgestraft werden. Hier steht jeder Link in einem echten Artikel auf der Website eines echten Unternehmens, das diesen Artikel wollte. Genau deshalb funktioniert das Netzwerk über Tausch.",
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
      "In jedem Tarif ist alles enthalten. Der Unterschied liegt darin, wie viel wir jeden Monat für Sie schreiben.",
    perMonth: " / Monat",
    getStarted: "Loslegen",
    mostPopular: "Am beliebtesten",
    tryItFirst: "Erst ausprobieren",
    starterTagline:
      "Testen Sie uns mit einem echten Artikel und einem echten Backlink, bevor Sie aufsteigen.",
    unavailable:
      "Die Preise sind derzeit nicht verfügbar. Bitte versuchen Sie es in Kürze erneut.",
    annualNote:
      "Jahrestarife sind nach der Anmeldung verfügbar, mit zwei Freimonaten. Jederzeit kündbar — siehe unsere",
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
      "Warum es AI SEO Platform gibt und für wen es gedacht ist.",
    title: "SEO-Ergebnisse ohne Agentur",
    intro: [
      'Eine Zahnarztpraxis, ein Installateur oder eine kleine Kanzlei weiß, dass sie "SEO machen" sollte. Nötig sind dafür in Wirklichkeit jemand für die Keyword-Recherche, jemand zum Schreiben, jemand mit Verständnis für technische Audits und jemand, der Links besorgt. Eine Agentur bündelt all das für einige tausend im Monat.',
      "Die meisten kleinen Unternehmen können diese Ausgabe nicht rechtfertigen. Also tun sie nichts und bleiben genau bei den Suchanfragen unsichtbar, die ihnen Kunden bringen würden.",
      "Wir haben dies gebaut, um diese Arbeit automatisch zu erledigen — zu einem Preis, den ein kleines Unternehmen tatsächlich zahlen kann.",
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
      "Was RepGet-Kunden messen: Rankings, KI-Sichtbarkeit, veröffentlichte Artikel und gewonnene Backlinks — und wann die ersten Ergebnisse kommen.",
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
        body: "Was geschrieben wurde, wann es erschien und was es bewirkt hat — damit ein Monat Arbeit eine Antwort hat und nicht nur eine Rechnung.",
      },
      {
        label: "Gewonnene Backlinks",
        body: "Echte Links in echten Artikeln auf Websites anderer Unternehmen, täglich geprüft. Wird einer entfernt, bekommen Sie Ihr Guthaben zurück.",
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
        body: "Die Search-Console-Daten der ersten Artikel treffen ein. Jetzt bewegen sich die Rankings — SEO zahlt sich nicht in Woche eins aus, und wer das verspricht, verkauft etwas anderes.",
      },
    ],
    ctaTitle: "Werden Sie die erste Geschichte auf dieser Seite.",
    ctaBody:
      "Starten Sie mit einer kostenlosen Prüfung Ihrer Website — eine Minute, kostenlos. Wenn sich das Ergebnis lohnt, beginnen die Tarife bei 1€ im ersten Monat.",
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
      "Sie werden in Link-Guthaben vergütet, nicht in Geld. Ein veröffentlichter Artikel bringt ein Guthaben, und ein Guthaben verschafft Ihnen einen Link von der Website eines anderen Unternehmens. Wenn Sie Geld für Gastbeiträge suchen, ist das hier nicht das Richtige — dafür gibt es Marktplätze.",
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
        body: "Artikel kommen als Entwürfe auf Ihre Website. Veröffentlichen, bearbeiten oder ablehnen — ohne Sie geht nichts online.",
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
      "Teilen Sie Ihren Link und verdienen Sie Guthaben, wenn jemand, den Sie empfohlen haben, einen bezahlten Tarif startet.",
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
        body: "Das Guthaben landet automatisch auf Ihrem Konto und ist sofort einsetzbar.",
      },
    ],
    termsTitle: "Die Bedingungen, klar gesagt",
    terms: [
      "Die Vergütung ist Kontoguthaben, kein Geld. Es ist nicht auszahlbar.",
      "Eine Empfehlung zählt, sobald die empfohlene Person den ersten Monat bezahlt hat.",
      "Jedes Unternehmen kann nur einmal empfohlen werden.",
      "Guthaben wird im Produkt für Linkaufbau eingesetzt.",
    ],
    ctaPrimary: "Loslegen",
    ctaNote:
      "Ihr Empfehlungslink steht in den Einstellungen, sobald Sie ein Konto haben.",
  },
  backlinkExchange: {
    metaTitle: "So funktioniert der Backlink-Austausch",
    metaDescription:
      "Verdienen Sie Links auf Ihre Website, indem Sie einen Artikel für ein anderes Unternehmen veröffentlichen. Nur passende Zuordnungen, täglich geprüft, Guthaben zurück, wenn ein Link verschwindet.",
    title: "So funktioniert der Backlink-Austausch",
    intro:
      "Links verdient man, indem man welche gibt. Sie veröffentlichen einen Artikel für ein Unternehmen aus einer verwandten Branche und setzen das Verdiente für Links auf Ihre eigene Website ein.",
    steps: [
      {
        title: "Sie veröffentlichen einen Artikel",
        body: "Wir schreiben einen Artikel für ein anderes Unternehmen aus einer verwandten Branche und veröffentlichen ihn auf Ihrer Website. Ein echter Artikel zu einem Thema, das Ihre Leser interessiert — keine Linkliste.",
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
        body: "Wird ein Link entfernt, erhalten Sie das Guthaben zurück und der Link verschwindet aus Ihrem Dashboard. Wir zählen keine Links, die es nicht mehr gibt.",
      },
    ],
    notTitle: "Was das nicht ist",
    notBody:
      "Das ist kein privates Blog-Netzwerk, und wir verkaufen keine Links. Jeder Link steht in einem echten Artikel auf der Website eines echten Unternehmens, veröffentlicht, weil dieses Unternehmen einen Artikel wollte. Linkkauf verstößt gegen die Google-Richtlinien und kann abgestraft werden — genau darum funktioniert das Netzwerk über Austausch statt über Verkauf.",
    ctaTitle: "Jeder Tarif enthält Guthaben",
    ctaBody:
      "Sie können Ihre ersten Links anfordern, bevor Sie etwas veröffentlicht haben.",
    ctaPrimary: "Loslegen",
    ctaSecondary: "Lieber Artikel veröffentlichen",
  },
  faq: {
    metaTitle: "Häufige Fragen",
    metaDescription: "Häufige Fragen dazu, wie AI SEO Platform funktioniert.",
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
          "Sie werden von einer KI geschrieben, lesen Sie sie also vor der Veröffentlichung — genau dafür geben wir Ihnen einen Editor. Sie sind für Ihr Unternehmen geschrieben, in Ihrer Sprache und Ihrem Markt, und Sie können den gewünschten Ton festlegen.",
      },
      {
        question: "Erscheinen die Artikel automatisch auf meiner Website?",
        answer:
          "Nur wenn Sie Ihre Website verbinden und sich für die Veröffentlichung entscheiden. Wir unterstützen WordPress, Ghost und Shopify sowie einen Webhook für alles andere. Andernfalls bleiben sie Entwürfe, die Sie prüfen, bearbeiten oder anderswo einfügen können.",
      },
      {
        question: "Was sind Link-Guthaben?",
        answer:
          "Google vertraut einer Website mehr, wenn andere Seiten auf sie verlinken. Erwähnt einer Ihrer Artikel das Unternehmen eines anderen Mitglieds, erhalten Sie ein Guthaben. Geben Sie eines aus, verlinkt der Artikel eines anderen Mitglieds auf Sie. Sie verlinken nie zurück auf denjenigen, der auf Sie verlinkt hat — so wirken die Links natürlich.",
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
          "Alles bereits Veröffentlichte bleibt auf Ihrer Website — es ist Ihr Inhalt. Die Artikel, die wir für Sie schreiben, gehören Ihnen.",
      },
    ],
  },
  contact: {
    metaTitle: "Kontakt",
    metaDescription: "So erreichen Sie AI SEO Platform.",
    title: "Kontakt",
    subtitle:
      "Fragen zum Produkt, zu Ihrem Konto oder zur Abrechnung — wir lesen jede Nachricht und antworten innerhalb von zwei Werktagen.",
    emailLabel: "E-Mail",
    accountNote:
      "Wenn es um Ihr Konto geht, schreiben Sie bitte von der Adresse, mit der Sie sich registriert haben.",
  },
  legalNotice: "Diese Seite ist nur auf Englisch verfügbar. Übersetzungen unserer rechtlichen Bedingungen werden vor der Veröffentlichung von einem professionellen Übersetzer erstellt.",

  app: {
    settings: {
      personalTitle: "Persönliche Daten",
      personalSubtitle: "Die Daten Ihres Kontos",
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
        "Sie melden sich mit Google an. Legen Sie ein Passwort fest, um sich auch mit Ihrer E-Mail-Adresse anzumelden — Google funktioniert weiterhin.",
      setPasswordHelp: "Mindestens 8 Zeichen.",
      settingPassword: "Wird festgelegt…",
      passwordCreated:
        "Passwort festgelegt. Sie können sich jetzt mit Ihrer E-Mail-Adresse und Ihrem Passwort anmelden.",
      languageLabel: "Sprache des Dashboards",
      languageHelp: "Die Sprache dieses Dashboards. Ihre Artikel werden in der Sprache verfasst, die im Tab Unternehmen eingestellt ist.",
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
      addMemberHelp: "Sie brauchen bereits ein RepGet-Konto. Laden Sie sie mit der Adresse ein, mit der sie sich registriert haben.",
      memberColumn: "Mitglied",
      roleColumn: "Rolle",
      statusColumn: "Status",
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
    },
    websites: {
      title: "Websites",
      connected: "1 verbunden. Jede Website wird über ihren eigenen Tarif abgerechnet.|{count} verbunden. Jede Website wird über ihren eigenen Tarif abgerechnet.",
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
    },
    billing: {
      title: "Abrechnung",
      subtitle: "Jede Website hat ihren eigenen Tarif. Credits gelten für alle gemeinsam.",
      yourWebsites: "Ihre Websites",
      yourWebsitesHelp: "Eine Website ohne Tarif kann keine Artikel erstellen oder veröffentlichen.",
      noPlanYet: "Noch kein Tarif",
      planRenews: "{plan} — verlängert sich am {date}",
      planEnds: "{plan} — endet am {date}",
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
      paymentReceived: "Zahlung erhalten — Ihr Abonnement wird bestätigt…",
      checkoutCancelled: "Bezahlvorgang abgebrochen.",
      purchaseReceived: "Zahlung erhalten — Ihr Kauf erscheint in Kürze.",
      purchaseCancelled: "Kauf abgebrochen.",
      addWebsiteFirst: "Fügen Sie zuerst eine Website hinzu — jeder Tarif bezahlt eine Website.",
      checkoutFailed: "Der Bezahlvorgang konnte nicht gestartet werden. Bitte erneut versuchen.",
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
      updatePost: "Beitrag aktualisieren",
      publish: "Veröffentlichen",
      sendingDraft: "Wird als Entwurf gesendet…",
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
      chooseThenImport: "Wählen Sie unten Ihre Properties und importieren Sie dann.",
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
      importing: "Ihre Daten werden importiert — das dauert einen Moment",
      disconnected: "Google getrennt",
      statusConnected: "Google verbunden",
      statusCancelled: "Verbindung abgebrochen",
      statusForbidden: "Sie können diese Website nicht verbinden",
      statusInvalid: "Dieser Link war ungültig — versuchen Sie es erneut",
      statusError: "Google konnte nicht verbunden werden",
    },
    research: {
      contentPlan: "Contentplan",
      articlesTab: "Artikel",
      opportunities: "Chancen",
      refresh: "Aktualisieren",
      looking: "Suche…",
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
      keyword: "Suchbegriff",
      opportunity: "Chance",
      searchesPerMonth: "Suchanfragen / Monat",
      competition: "Wettbewerb",
      topic: "Thema",
      difficultyLow: "Niedrig",
      difficultyMedium: "Mittel",
      difficultyHigh: "Hoch",
      difficultyVeryHigh: "Sehr hoch",
      researching: "Suchbegriffe werden recherchiert — das dauert eine Minute",
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
      checkBeforeSaving: "Wir prüfen die Verbindung, bevor wir etwas speichern — so erfahren Sie es jetzt und nicht erst, wenn ein Artikel scheitert.",
      noPlatformMatch: "Keine passende Plattform? Veröffentlichen Sie überall per Webhook.",
      forDevelopers: "Für Entwickler",
      connectTo: "{name} verbinden",
      connectedTo: "Mit {name} verbunden",
      disconnectedFrom: "Von {name} getrennt",
      draftPublished: "Entwurf veröffentlicht. Sehen Sie in den Entwürfen Ihrer Website nach.",
      draftPublishedAt: "Entwurf veröffentlicht — öffnen Sie ihn unter {name}",
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
      askHelp: "Fragen Sie so, wie es ein Kunde täte, und nennen Sie Ihr Unternehmen nicht — es geht darum, ob Sie von selbst auftauchen.",
      suggestedQuestions: "Vorgeschlagene Fragen — zum Verfolgen anklicken",
      noQuestions: "Noch keine Fragen verfolgt",
      noQuestionsHelp: "Fügen Sie die Fragen hinzu, die Ihre Kunden einem KI-Assistenten stellen würden, und prüfen Sie dann, ob Ihr Unternehmen in der Antwort genannt wird.",
      notChecked: "Nicht geprüft",
      notNamed: "Nicht genannt",
      stopTracking: "Diese Frage nicht mehr verfolgen",
      questionAdded: "Frage hinzugefügt",
      checkQueued: "Wird geprüft — Ergebnisse erscheinen hier in wenigen Minuten",
      alreadyTracking: "Sie verfolgen bereits die Fragen, die wir vorschlagen würden",
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
      noRequests: "Noch keine Linkanfragen",
      noRequestsHelp: "Fragen Sie einen Link an, und wir finden ein anderes Unternehmen im Netzwerk, das ihn im nächsten Artikel veröffentlicht. Jeder aktive Link kostet ein Credit.",
      noneGiven: "Noch keine. Wenn wir Ihren nächsten Artikel schreiben, kann ein Link zu einem anderen Unternehmen enthalten sein, und Sie verdienen ein Credit.",
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
      creditsEarnedHint: "Credits, die Ihnen dieser Link eingebracht hat — für Links zurück auf Ihre eigene Seite.",
      cancelRequest: "Anfrage abbrechen",
      untitledArticle: "Artikel ohne Titel",
      joined: "Sie sind im Netzwerk",
      leftNetwork: "Netzwerk verlassen",
      requestSaved: "Anfrage gespeichert — warten auf eine passende Website",
      requestCancelled: "Anfrage abgebrochen, Credit freigegeben",
      statusPending: "Website wird gesucht",
      statusMatched: "Warten auf deren nächsten Artikel",
      statusLive: "Aktiv",
      statusCancelled: "Abgebrochen",
      statusRemoved: "Entfernt — Credit erstattet",
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
    },
    calendar: {
      changeTopic: "Thema ändern",
      addInstructions: "Anweisungen hinzufügen",
      removeFromPlan: "Aus dem Plan entfernen",
      instructionsPlaceholder: "Alles, was dieser Artikel behandeln oder vermeiden soll.",
      previousMonth: "Voriger Monat",
      nextMonth: "Nächster Monat",
      savedInstructions: "Gespeichert — wir verwenden das beim Schreiben",
      removedFromPlan: "Aus dem Plan entfernt",
      writingStarted: "Schreiben gestartet — das dauert einige Minuten",
    },
    addons: {
      moreCredits: "Mehr Link-Credits",
      moreCreditsHelp: "Ihr Tarif enthält monatlich Credits. Kaufen Sie mehr, wenn sie ausgehen — diese verfallen nicht.",
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
    },
    keys: {
      keyCopied: "Schlüssel kopiert",
      keyCopyFailed: "Kopieren nicht möglich. Markieren Sie den Schlüssel und kopieren Sie ihn von Hand.",
      keyRevoked: "Schlüssel widerrufen",
      newKeyLabel: "Ihr neuer Integrationsschlüssel",
      neverUsed: "Nie verwendet",
      pluginTitle: "WordPress-Plugin",
      pluginHelp: "Installieren Sie unser Plugin, fügen Sie einen Schlüssel ein, und Artikel erscheinen hier automatisch.",
      copyNowHelp: "Wir speichern nur eine verschlüsselte Fassung, sie lässt sich später nicht nachschlagen. Geht sie verloren, widerrufen Sie sie und erstellen eine neue.",
      newKey: "Neuer Schlüssel",
      keyNotePlaceholder: "Wofür ist dieser Schlüssel? (optional)",
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
      fillsIn: " Sie werden automatisch ausgefüllt, sobald wir die Website analysiert haben — Sie können sie auch jetzt eintragen.",
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
      requestLink: "Link anfragen",
      admin: "Verwaltung",
      articleLanguageHelp: "Ihre Artikel werden in dieser Sprache verfasst.",
      namedInstead: "Werden am häufigsten statt Ihrer genannt",
      mostPopular: "Am beliebtesten",
      receiptInPayPal: "Beleg in PayPal",
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
      auditIntro: "Wir prüfen Ihre Seiten und listen auf, was Ihre Website bei Google bremst — mit der genauen Seite zu jedem Problem.",
      losingTrafficIntro: "Seiten mit weniger Klicks als vor einem Monat, laut Ihren Search-Console-Daten.",
      noCompetitorsFound: "Wir haben auf Ihrer Website keine gefunden. Fügen Sie die Wettbewerber hinzu, die Sie kennen, und wir finden damit Inhaltslücken.",
      competitorsHelp: "Wer sonst auftaucht, wenn Käufer in Ihrem Bereich suchen. Wir nutzen das, um Inhaltslücken und lohnende Suchbegriffe zu finden.",
      connectWebsiteFirst: "Verbinden Sie zuerst unten eine Website. Bis dahin bleiben Artikel Entwürfe.",
      generationHelp: "Wie Ihre Artikel geschrieben werden und was mit ihnen geschieht, wenn sie fertig sind.",
      altHelp: "Wird Menschen mit Screenreader vorgelesen und von Suchmaschinen gelesen.",
      featuredImageHelp: "Das Bild oben im Artikel und das Bild, das beim Teilen erscheint.",
      factsOnePerLine: "Eines pro Zeile. Nur diese Angaben nennen wir ausdrücklich über Ihr Unternehmen; alles andere bleibt allgemein.",
      voiceBehindArticles: "Die Stimme hinter jedem Artikel. Aus dem eigenen Bereich übernommen, sodass ein Speichern den ganzen Bildschirm abdeckt.",
      creditsExplainer: "Credits werden Ihrem Konto gutgeschrieben und können für Linkaufbau eingesetzt werden. Sie sind kein Bargeld und nicht auszahlbar. Eine Empfehlung zählt, sobald die empfohlene Person ihren ersten Monat bezahlt, und jede Person kann nur einmal empfohlen werden.",
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
      copyNow: "Jetzt kopieren — wird nicht erneut angezeigt",
      downloadPlugin: "Plugin herunterladen",
      cantFindIntegration: "Ihre Integration nicht gefunden?",
      adaptive: "Adaptiv",
      custom: "Eigene",
      wordRange: "Zwischen 300 und 5.000.",
      findOpportunities: "Chancen finden",
      noOpportunities: "Noch keine Chancen gefunden",
      losingTraffic: "Traffic-Verlust",
      notWrittenHere: "Nicht hier verfasst",
      nothingLosing: "Nichts verliert Traffic",
      nothingLosingHelp: "Wir vergleichen die letzten 28 Tage mit den 28 davor. Nichts ist gefallen.",
      writeAutomatically: "Artikel automatisch schreiben",
      daysToWrite: "Tage zum Schreiben",
      publishWithoutAsking: "Ohne Rückfrage veröffentlichen",
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
      passwordHint: "Mindestens 8 Zeichen, davon eine Ziffer und ein Buchstabe.",
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
      analyticsTellUs: "Analytics und Search Console zeigen uns, welche Artikel wirken — damit wir mehr davon schreiben.",
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
