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
    planArticles: (n: number) => string;
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
      articles: (n: number) => string;
      keywords: (n: string) => string;
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
      googleNote: string;
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
      connected: (count: number) => string;
      addWebsite: string;
      emptyTitle: string;
      emptyBody: string;
      addFirst: string;
      tryAgain: string;
      removeLabel: (domain: string) => string;
      removed: (domain: string) => string;
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
      planRenews: (plan: string, date: string) => string;
      planEnds: (plan: string, date: string) => string;
      currentPlan: string;
      accessEnds: string;
      nextInvoice: string;
      onPlan: (plan: string) => string;
      noSubscription: string;
      accessEndsOn: (date: string) => string;
      renewsOn: (date: string) => string;
      monthly: string;
      annual: string;
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
      /** Editorial register options, by id. */
      styles: Record<string, { label: string; hint: string }>;
    };
    editor: {
      backToWebsite: string;
      headings: string;
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
      connectTo: (name: string) => string;
      connectedTo: (name: string) => string;
      disconnectedFrom: (name: string) => string;
      draftPublished: string;
      draftPublishedAt: (name: string) => string;
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
      hosting: (cap: number, used: number, sites: number) => string;
      reserved: (n: number) => string;
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
    planArticles: (n) => `${n} ${n === 1 ? "article" : "articles"} each month`,
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
      articles: (n) =>
        `${n} ${n === 1 ? "article" : "articles"} written each month`,
      keywords: (n) => `${n} search terms tracked`,
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
      googleNote: "You sign in with Google",
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
      connected: (count) =>
        `${count} connected. Each website is billed on its own plan.`,
      addWebsite: "Add website",
      emptyTitle: "No websites yet",
      emptyBody:
        "Add your website and we will read it, work out what your business does, and find the search terms worth going after.",
      addFirst: "Add your first website",
      tryAgain: "Try again",
      removeLabel: (domain) => `Remove ${domain}`,
      removed: (domain) => `Removed ${domain}`,
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
      planRenews: (plan, date) => `${plan} — renews ${date}`,
      planEnds: (plan, date) => `${plan} — ends ${date}`,
      currentPlan: "Current plan",
      accessEnds: "Access ends",
      nextInvoice: "Next invoice",
      onPlan: (plan) => `You are on the ${plan} plan.`,
      noSubscription: "No active subscription yet. Choose a plan below to get started.",
      accessEndsOn: (date) => `Access ends on ${date}.`,
      renewsOn: (date) => `Renews on ${date}.`,
      monthly: "Monthly",
      annual: "Annual",
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
      connectTo: (name) => `Connect ${name}`,
      connectedTo: (name) => `Connected to ${name}`,
      disconnectedFrom: (name) => `Disconnected from ${name}`,
      draftPublished: "Draft published successfully. Check your site’s drafts.",
      draftPublishedAt: (name) => `Draft published — open it at ${name}`,
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
      hosting: (cap, used, sites) => `Hosting up to ${cap} links a month (${used} used). ${sites} site${sites === 1 ? "" : "s"} available to link to you.`,
      reserved: (n) => ` (${n} reserved)`,
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
    planArticles: (n) => `${n} ${n === 1 ? "artículo" : "artículos"} al mes`,
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
      articles: (n) =>
        `${n} ${n === 1 ? "artículo" : "artículos"} escritos cada mes`,
      keywords: (n) => `${n} términos de búsqueda monitorizados`,
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
      googleNote: "Inicia sesión con Google",
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
      connected: (count) =>
        count === 1
        ? "1 conectado. Cada sitio web se factura con su propio plan."
        : `${count} conectados. Cada sitio web se factura con su propio plan.`,
      addWebsite: "Añadir sitio web",
      emptyTitle: "Todavía no hay sitios web",
      emptyBody:
        "Añada su sitio web y lo leeremos, averiguaremos a qué se dedica su negocio y encontraremos los términos de búsqueda que merecen la pena.",
      addFirst: "Añada su primer sitio web",
      tryAgain: "Reintentar",
      removeLabel: (domain) => `Eliminar ${domain}`,
      removed: (domain) => `${domain} eliminado`,
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
      planRenews: (plan, date) => `${plan} — se renueva el ${date}`,
      planEnds: (plan, date) => `${plan} — finaliza el ${date}`,
      currentPlan: "Plan actual",
      accessEnds: "El acceso finaliza",
      nextInvoice: "Próxima factura",
      onPlan: (plan) => `Tiene el plan ${plan}.`,
      noSubscription: "Todavía no hay suscripción activa. Elija un plan para empezar.",
      accessEndsOn: (date) => `El acceso finaliza el ${date}.`,
      renewsOn: (date) => `Se renueva el ${date}.`,
      monthly: "Mensual",
      annual: "Anual",
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
      connectTo: (name) => `Conectar ${name}`,
      connectedTo: (name) => `Conectado a ${name}`,
      disconnectedFrom: (name) => `Desconectado de ${name}`,
      draftPublished: "Borrador publicado correctamente. Revise los borradores de su sitio.",
      draftPublishedAt: (name) => `Borrador publicado — ábralo en ${name}`,
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
      hosting: (cap, used, sites) => `Aloja hasta ${cap} enlaces al mes (${used} usados). ${sites} sitio${sites === 1 ? "" : "s"} disponible${sites === 1 ? "" : "s"} para enlazarle.`,
      reserved: (n) => ` (${n} reservados)`,
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
    planArticles: (n) => `${n} ${n === 1 ? "article" : "articles"} par mois`,
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
      articles: (n) =>
        `${n} ${n === 1 ? "article rédigé" : "articles rédigés"} chaque mois`,
      keywords: (n) => `${n} termes de recherche suivis`,
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
      googleNote: "Vous vous connectez avec Google",
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
      connected: (count) =>
        count === 1
        ? "1 connecté. Chaque site est facturé sur son propre forfait."
        : `${count} connectés. Chaque site est facturé sur son propre forfait.`,
      addWebsite: "Ajouter un site",
      emptyTitle: "Aucun site pour le moment",
      emptyBody:
        "Ajoutez votre site et nous le lirons, comprendrons ce que fait votre entreprise et trouverons les recherches qui valent la peine.",
      addFirst: "Ajouter votre premier site",
      tryAgain: "Réessayer",
      removeLabel: (domain) => `Supprimer ${domain}`,
      removed: (domain) => `${domain} supprimé`,
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
      planRenews: (plan, date) => `${plan} — renouvellement le ${date}`,
      planEnds: (plan, date) => `${plan} — fin le ${date}`,
      currentPlan: "Forfait actuel",
      accessEnds: "Fin de l\u2019accès",
      nextInvoice: "Prochaine facture",
      onPlan: (plan) => `Vous êtes sur le forfait ${plan}.`,
      noSubscription: "Aucun abonnement actif. Choisissez un forfait ci-dessous pour commencer.",
      accessEndsOn: (date) => `L\u2019accès prend fin le ${date}.`,
      renewsOn: (date) => `Renouvellement le ${date}.`,
      monthly: "Mensuel",
      annual: "Annuel",
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
      connectTo: (name) => `Connecter ${name}`,
      connectedTo: (name) => `Connecté à ${name}`,
      disconnectedFrom: (name) => `Déconnecté de ${name}`,
      draftPublished: "Brouillon publié. Vérifiez les brouillons de votre site.",
      draftPublishedAt: (name) => `Brouillon publié — ouvrez-le sur ${name}`,
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
      hosting: (cap, used, sites) => `Héberge jusqu\u2019à ${cap} liens par mois (${used} utilisés). ${sites} site${sites === 1 ? "" : "s"} disponible${sites === 1 ? "" : "s"} pour pointer vers vous.`,
      reserved: (n) => ` (${n} réservés)`,
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
    planArticles: (n) => `${n} ${n === 1 ? "articolo" : "articoli"} al mese`,
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
      articles: (n) =>
        `${n} ${n === 1 ? "articolo scritto" : "articoli scritti"} ogni mese`,
      keywords: (n) => `${n} termini di ricerca monitorati`,
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
      googleNote: "Accede con Google",
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
      connected: (count) =>
        count === 1
        ? "1 collegato. Ogni sito viene fatturato con il proprio piano."
        : `${count} collegati. Ogni sito viene fatturato con il proprio piano.`,
      addWebsite: "Aggiungi sito",
      emptyTitle: "Ancora nessun sito",
      emptyBody:
        "Aggiunga il suo sito: lo leggeremo, capiremo di cosa si occupa la sua attività e troveremo le ricerche che vale la pena presidiare.",
      addFirst: "Aggiunga il suo primo sito",
      tryAgain: "Riprova",
      removeLabel: (domain) => `Rimuovi ${domain}`,
      removed: (domain) => `${domain} rimosso`,
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
      planRenews: (plan, date) => `${plan} — si rinnova il ${date}`,
      planEnds: (plan, date) => `${plan} — termina il ${date}`,
      currentPlan: "Piano attuale",
      accessEnds: "L\u2019accesso termina",
      nextInvoice: "Prossima fattura",
      onPlan: (plan) => `Ha il piano ${plan}.`,
      noSubscription: "Nessun abbonamento attivo. Scelga un piano qui sotto per iniziare.",
      accessEndsOn: (date) => `L\u2019accesso termina il ${date}.`,
      renewsOn: (date) => `Si rinnova il ${date}.`,
      monthly: "Mensile",
      annual: "Annuale",
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
      connectTo: (name) => `Collega ${name}`,
      connectedTo: (name) => `Collegato a ${name}`,
      disconnectedFrom: (name) => `Scollegato da ${name}`,
      draftPublished: "Bozza pubblicata. Controlli le bozze del suo sito.",
      draftPublishedAt: (name) => `Bozza pubblicata — la apra su ${name}`,
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
      hosting: (cap, used, sites) => `Ospita fino a ${cap} link al mese (${used} usati). ${sites} sito${sites === 1 ? "" : "i"} disponibil${sites === 1 ? "e" : "i"} per collegarla.`,
      reserved: (n) => ` (${n} riservati)`,
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
    planArticles: (n) => `${n} Artikel pro Monat`,
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
      articles: (n) =>
        `${n} ${n === 1 ? "Artikel" : "Artikel"} pro Monat geschrieben`,
      keywords: (n) => `${n} Suchbegriffe überwacht`,
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
      googleNote: "Sie melden sich mit Google an",
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
      connected: (count) =>
        count === 1
        ? "1 verbunden. Jede Website wird über ihren eigenen Tarif abgerechnet."
        : `${count} verbunden. Jede Website wird über ihren eigenen Tarif abgerechnet.`,
      addWebsite: "Website hinzufügen",
      emptyTitle: "Noch keine Websites",
      emptyBody:
        "Fügen Sie Ihre Website hinzu. Wir lesen sie, ermitteln, was Ihr Unternehmen tut, und finden die Suchbegriffe, die sich lohnen.",
      addFirst: "Erste Website hinzufügen",
      tryAgain: "Erneut versuchen",
      removeLabel: (domain) => `${domain} entfernen`,
      removed: (domain) => `${domain} entfernt`,
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
      planRenews: (plan, date) => `${plan} — verlängert sich am ${date}`,
      planEnds: (plan, date) => `${plan} — endet am ${date}`,
      currentPlan: "Aktueller Tarif",
      accessEnds: "Zugriff endet",
      nextInvoice: "Nächste Rechnung",
      onPlan: (plan) => `Sie nutzen den Tarif ${plan}.`,
      noSubscription: "Noch kein aktives Abonnement. Wählen Sie unten einen Tarif, um zu starten.",
      accessEndsOn: (date) => `Der Zugriff endet am ${date}.`,
      renewsOn: (date) => `Verlängert sich am ${date}.`,
      monthly: "Monatlich",
      annual: "Jährlich",
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
      connectTo: (name) => `${name} verbinden`,
      connectedTo: (name) => `Mit ${name} verbunden`,
      disconnectedFrom: (name) => `Von ${name} getrennt`,
      draftPublished: "Entwurf veröffentlicht. Sehen Sie in den Entwürfen Ihrer Website nach.",
      draftPublishedAt: (name) => `Entwurf veröffentlicht — öffnen Sie ihn unter ${name}`,
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
      hosting: (cap, used, sites) => `Nimmt bis zu ${cap} Links pro Monat auf (${used} genutzt). ${sites} Website${sites === 1 ? "" : "s"} können auf Sie verlinken.`,
      reserved: (n) => ` (${n} reserviert)`,
    },
  },
};

const MESSAGES: Record<Locale, Messages> = { en, es, fr, it, de };

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale] ?? en;
}
