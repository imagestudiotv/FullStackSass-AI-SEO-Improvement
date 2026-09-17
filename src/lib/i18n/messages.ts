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
    planWebsites: (n: number) => string;
    planCredits: (n: number) => string;
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
      websites: (n: number) => string;
      credits: (n: number) => string;
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
    subtitle: "RepGet publishes SEO content, earns quality backlinks, and builds the authority that gets your business discovered.",
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
    auditAssurances: [
      "No account needed",
      "Nothing to cancel",
    ],
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
      { title: "Publish SEO content", body: "High-quality articles generated and optimised for your niche." },
      { title: "Build real backlinks", body: "Get cited on relevant websites to increase your authority." },
      { title: "Track your progress", body: "See rankings, traffic and results in one simple dashboard." },
      { title: "Save time with AI", body: "Let AI do the work, while you focus on your business." },
    ],
    previewTitle: "Your growth, on autopilot.",
    previewSub: "High-quality content. Real backlinks. More visibility.",
    previewCaption: "An example dashboard. Your own figures start at zero and grow from there.",
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
    videoSub: "A short walkthrough of what happens after you connect a website.",
    videoComingSoon: "The walkthrough video is being recorded. In the meantime, the free check shows you the same thing on your own site.",
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
    planWebsites: (n) => `${n} ${n === 1 ? "website" : "websites"}`,
    planCredits: (n) => `${n} ${n === 1 ? "link credit" : "link credits"}`,
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
      websites: (n) => `${n} ${n === 1 ? "website" : "websites"}`,
      credits: (n) =>
        `${n} ${n === 1 ? "link credit" : "link credits"} each month`,
      healthChecks: "Website health checks",
      publishing: "Publish to WordPress, Ghost or Shopify",
    },
  },
  about: {
    metaTitle: "About",
    metaDescription: "Why AI SEO Platform exists and who it is for.",
    title: "SEO results without the agency",
    intro: [
      "A dentist, a plumber or a small law firm knows they should \"do SEO\". What that actually needs is a keyword researcher, a writer, someone who understands technical audits, and outreach for links. An agency bundles all of that for a few thousand a month.",
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
    audience: "Small and local businesses who need customers, not dashboards. You should never have to learn what \"keyword difficulty\" means. We do the judgement; you see a plan, the articles, and what changed.",
  },
  successStories: {
    metaTitle: "Success stories",
    metaDescription: "What RepGet customers measure: rankings, AI visibility, published articles and backlinks earned — and how the first results arrive.",
    eyebrow: "Success stories",
    title: "We would rather show you what we measure than invent a customer.",
    intro: "RepGet is new, and we are not going to invent a business that used it or round someone's numbers up for a landing page. Here is what the product actually tracks, and what the first months honestly look like — so you can judge it on something real.",
    results: [
      { label: "Rankings and clicks", body: "Pulled from your own Search Console, not estimated. You see which queries you moved on, and what that was worth in clicks." },
      { label: "AI visibility", body: "Whether ChatGPT, Claude and Perplexity name your business when someone asks for what you sell. Checked on your own prompts." },
      { label: "Articles published", body: "What was written, when it went live, and what it did afterwards — so a month's work has an answer rather than an invoice." },
      { label: "Backlinks earned", body: "Real links inside real articles on other businesses' sites, checked daily. If one is removed, your credit comes back." },
    ],
    timelineTitle: "What the first three months look like",
    timelineIntro: "Honestly, including the part where nothing has happened yet.",
    timeline: [
      { when: "Week one", body: "We crawl the site, find the technical problems holding it back, and plan a month of articles around what your customers actually search for." },
      { when: "Weeks two to four", body: "Articles go live on your schedule. Backlinks start being placed as other businesses in the network publish theirs." },
      { when: "Month two onward", body: "Search Console data arrives for the first articles. This is where rankings begin to move — SEO does not pay out in week one, and anyone promising otherwise is selling something else." },
    ],
    ctaTitle: "Be the first story on this page.",
    ctaBody: "Start with a free check of your site — it takes a minute and costs nothing. If what we find is worth acting on, plans start at €1 for the first month.",
    ctaPrimary: "Check my website",
    ctaSecondary: "See pricing",
  },
  publishers: {
    metaTitle: "Monetize your blog",
    metaDescription: "Host one article a month for a related business and earn link credits you can spend on backlinks to your own site.",
    title: "Monetize your blog",
    intro: "Host one article a month for a business in a related field, and earn credits you can spend on links back to your own site.",
    creditsTitle: "Credits, not cash",
    creditsBody: "You are paid in link credits rather than money. One hosted article earns one credit, and one credit buys you a link from another business's site. If you want cash for guest posts, this is not that — and there are marketplaces that do it.",
    steps: [
      { title: "Tell us what your site is about", body: "Your topic, language and country. We only match you with businesses in a related field." },
      { title: "Set how many articles a month", body: "Up to twenty, and most publishers start at three. You can pause or leave at any time." },
      { title: "We write the article", body: "A real article on a topic your readers care about, written for your site, with one natural link in it." },
      { title: "You earn a credit", body: "One credit per article hosted, spendable on a link back to your own site from someone else's." },
    ],
    controlTitle: "What you control",
    rules: [
      { title: "Related topics only", body: "You will never be asked to host something unrelated to your site. If we cannot establish that two sites are topically related, we do not make the match." },
      { title: "You set the limit", body: "Between one and twenty articles a month, changed whenever you like. Set it to zero and you stop receiving requests." },
      { title: "You keep editorial control", body: "Articles arrive as drafts on your site. Publish, edit or reject them — nothing goes live without you." },
    ],
    suitsTitle: "Who this suits",
    suitsBody: "A small business with a blog that already publishes occasionally, and wants links to its own pages without paying for them. If your site has no readers, hosting articles will not change that — the links you earn are worth what your site is worth.",
    joinNote: "Joining is part of every plan. Turn it on from your website settings.",
    ctaPrimary: "Get Started",
    ctaSecondary: "How the exchange works",
  },
  affiliate: {
    metaTitle: "Refer a business",
    metaDescription: "Share your link and earn link credits when someone you refer starts a paid plan.",
    title: "Refer a business, earn credits",
    intro: "Share your link. When someone you refer pays for their first month, credits land in your account.",
    steps: [
      { title: "Share your link", body: "Every account gets a link. You will find it in Settings once you sign up." },
      { title: "They sign up and subscribe", body: "Nothing is owed while someone is only trying the product. The referral counts when they pay for their first month." },
      { title: "You get your credits", body: "Credits land in your account automatically and can be spent on backlinks straight away." },
    ],
    termsTitle: "The terms, plainly",
    terms: [
      "The reward is account credit, not cash. It cannot be withdrawn.",
      "A referral counts once the person you referred pays for their first month.",
      "Each business can be referred once.",
      "Credits are spent on link building inside the product.",
    ],
    ctaPrimary: "Get Started",
    ctaNote: "Your referral link is in Settings as soon as you have an account.",
  },
  backlinkExchange: {
    metaTitle: "How the backlink exchange works",
    metaDescription: "Earn links to your website by publishing one article for another business. Relevant matches only, verified daily, credits refunded if a link is removed.",
    title: "How the backlink exchange works",
    intro: "Links are earned by giving them. You host one article for a business in a related field, and spend what you earn on links back to your own site.",
    steps: [
      { title: "You host an article", body: "We write an article for another business in a related field and publish it on your site. It is a real article on a topic your readers care about, not a page of links." },
      { title: "You earn a credit", body: "Hosting one article earns one credit. Your plan also includes credits every month, so you can start before you have hosted anything." },
      { title: "You spend it on a link", body: "One credit buys one link to your site, written naturally into an article on someone else's website in a related field." },
    ],
    rulesTitle: "The rules that make it worth having",
    rules: [
      { title: "Related topics only", body: "A dentist is never matched with a crypto blog. If we cannot establish that two sites are topically related, we do not make the match — an irrelevant link is worth nothing and can do harm." },
      { title: "Checked every day", body: "We re-check every link daily. Links do not silently disappear without you finding out." },
      { title: "Credits refunded if a link goes", body: "If a link is removed, you get the credit back and it disappears from your dashboard. We do not count links that no longer exist." },
    ],
    notTitle: "What this is not",
    notBody: "This is not a private blog network, and we do not sell links. Every link sits inside a real article on a real business's website, published because that business wanted an article. Buying links is against Google's guidelines and can be penalised — which is exactly why the network works by exchange rather than by sale.",
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
    subtitle: "Questions about the product, your account, or billing — we read every message and reply within two working days.",
    emailLabel: "Email",
    accountNote: "If you are writing about your account, please send it from the address you signed up with.",
  },
  legalNotice:
    "This page is available in English only. Translations of our legal terms are prepared by a professional translator before publication.",
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
        detail:
          "Sigue posiciones, visibilidad y resultados en Google.",
      },
      {
        title: "Presencia en IA",
        detail:
          "Comprueba con qué frecuencia aparece tu marca en ChatGPT, Claude, Perplexity y la búsqueda con IA.",
      },
      {
        title: "Recuperación de tráfico",
        detail:
          "Identifica páginas en caída antes de perder tráfico valioso.",
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
    subtitle: "RepGet publica contenido SEO, consigue enlaces de calidad y construye la autoridad que hace que descubran su negocio.",
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
    auditAssurances: [
      "Sin crear cuenta",
      "Nada que cancelar",
    ],
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
      { title: "Publique contenido SEO", body: "Artículos de calidad generados y optimizados para su sector." },
      { title: "Consiga enlaces reales", body: "Sea citado en webs relevantes para aumentar su autoridad." },
      { title: "Siga su progreso", body: "Vea posiciones, tráfico y resultados en un panel sencillo." },
      { title: "Ahorre tiempo con IA", body: "Deje que la IA trabaje mientras usted se centra en su negocio." },
    ],
    previewTitle: "Su crecimiento, en automático.",
    previewSub: "Contenido de calidad. Enlaces reales. Más visibilidad.",
    previewCaption: "Un panel de ejemplo. Sus cifras empiezan en cero y crecen desde ahí.",
    titleLead: "Posiciónese en Google.",
    titleAccent: "Aparezca en las respuestas de IA.",
    heroCards: [
      { label: "Posiciones y clics", detail: "Desde Search Console" },
      { label: "Visibilidad en IA", detail: "Si los asistentes le nombran" },
      { label: "Crecimiento de tráfico", detail: "Llegue a más clientes" },
      { label: "Presente en respuestas de IA", detail: "Apareciendo donde importa" },
      { label: "Enlaces de calidad", detail: "Citado por webs reales" },
      { label: "Seguimiento de palabras clave", detail: "Vea qué funciona" },
    ],
    joinGoogle: "Entrar con Google",
    seeHow: "Vea cómo funciona",
    videoTitle: "Vea RepGet en dos minutos",
    videoSub: "Un recorrido breve por lo que ocurre después de conectar una web.",
    videoComingSoon: "Estamos grabando el vídeo explicativo. Mientras tanto, el análisis gratuito le enseña lo mismo sobre su propia web.",
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
    planWebsites: (n) => `${n} ${n === 1 ? "sitio web" : "sitios web"}`,
    planCredits: (n) =>
      `${n} ${n === 1 ? "crédito de enlace" : "créditos de enlace"}`,
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
      websites: (n) => `${n} ${n === 1 ? "sitio web" : "sitios web"}`,
      credits: (n) =>
        `${n} ${n === 1 ? "crédito de enlace" : "créditos de enlace"} cada mes`,
      healthChecks: "Análisis de salud de la web",
      publishing: "Publica en WordPress, Ghost o Shopify",
    },
  },
  about: {
    metaTitle: "Quiénes somos",
    metaDescription: "Por qué existe AI SEO Platform y para quién es.",
    title: "Resultados de SEO sin agencia",
    intro: [
      "Un dentista, un fontanero o un pequeño bufete sabe que debería \"hacer SEO\". Lo que eso requiere en realidad es alguien que investigue palabras clave, alguien que escriba, alguien que entienda las auditorías técnicas y alguien que consiga enlaces. Una agencia lo agrupa todo por unos miles al mes.",
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
    audience: "Pequeños negocios y negocios locales que necesitan clientes, no paneles de control. Nunca debería tener que aprender qué significa \"dificultad de palabra clave\". Nosotros hacemos el criterio; usted ve un plan, los artículos y qué ha cambiado.",
  },
  successStories: {
    metaTitle: "Casos de éxito",
    metaDescription: "Lo que miden los clientes de RepGet: posiciones, visibilidad en IA, artículos publicados y enlaces conseguidos, y cómo llegan los primeros resultados.",
    eyebrow: "Casos de éxito",
    title: "Preferimos enseñarle lo que medimos antes que inventarnos un cliente.",
    intro: "RepGet es nuevo, y no vamos a inventarnos una empresa que lo haya usado ni a redondear las cifras de nadie para una página de ventas. Esto es lo que el producto mide de verdad, y cómo son los primeros meses, para que pueda juzgarlo con algo real.",
    results: [
      { label: "Posiciones y clics", body: "Tomados de su propio Search Console, no estimados. Ve en qué búsquedas ha subido y cuántos clics ha supuesto." },
      { label: "Visibilidad en IA", body: "Si ChatGPT, Claude y Perplexity nombran su negocio cuando alguien pregunta por lo que usted vende. Comprobado con sus propias preguntas." },
      { label: "Artículos publicados", body: "Qué se escribió, cuándo se publicó y qué resultado dio, para que el trabajo de un mes tenga una respuesta y no solo una factura." },
      { label: "Enlaces conseguidos", body: "Enlaces reales dentro de artículos reales en webs de otros negocios, comprobados a diario. Si se elimina uno, recupera su crédito." },
    ],
    timelineTitle: "Cómo son los tres primeros meses",
    timelineIntro: "Con sinceridad, incluida la parte en la que aún no ha pasado nada.",
    timeline: [
      { when: "Semana uno", body: "Rastreamos la web, detectamos los problemas técnicos que la frenan y planificamos un mes de artículos según lo que sus clientes buscan de verdad." },
      { when: "Semanas dos a cuatro", body: "Los artículos se publican según su calendario. Los enlaces empiezan a colocarse a medida que otros negocios de la red publican los suyos." },
      { when: "A partir del segundo mes", body: "Llegan los datos de Search Console de los primeros artículos. Aquí es donde empiezan a moverse las posiciones: el SEO no da resultados en la primera semana, y quien prometa lo contrario le está vendiendo otra cosa." },
    ],
    ctaTitle: "Sea el primer caso de esta página.",
    ctaBody: "Empiece con un análisis gratuito de su web: tarda un minuto y no cuesta nada. Si lo que encontramos merece la pena, los planes empiezan en 1€ el primer mes.",
    ctaPrimary: "Analizar mi web",
    ctaSecondary: "Ver precios",
  },
  publishers: {
    metaTitle: "Rentabilice su blog",
    metaDescription: "Publique un artículo al mes para un negocio afín y gane créditos que podrá gastar en enlaces hacia su propia web.",
    title: "Rentabilice su blog",
    intro: "Aloje un artículo al mes de un negocio de un sector relacionado y gane créditos para conseguir enlaces hacia su propia web.",
    creditsTitle: "Créditos, no dinero",
    creditsBody: "El pago es en créditos de enlace, no en dinero. Un artículo alojado da un crédito, y un crédito le consigue un enlace desde la web de otro negocio. Si busca cobrar por artículos patrocinados, esto no es eso, y existen mercados que sí lo hacen.",
    steps: [
      { title: "Díganos de qué trata su web", body: "Su tema, idioma y país. Solo le emparejamos con negocios de un sector relacionado." },
      { title: "Elija cuántos artículos al mes", body: "Hasta veinte, aunque la mayoría empieza con tres. Puede pausar o salir cuando quiera." },
      { title: "Escribimos el artículo", body: "Un artículo real sobre un tema que interesa a sus lectores, escrito para su web, con un enlace natural dentro." },
      { title: "Usted gana un crédito", body: "Un crédito por artículo alojado, que puede gastar en un enlace hacia su web desde la de otro." },
    ],
    controlTitle: "Lo que usted controla",
    rules: [
      { title: "Solo temas relacionados", body: "Nunca le pediremos alojar algo ajeno a su web. Si no podemos verificar que dos webs están relacionadas temáticamente, no hacemos el emparejamiento." },
      { title: "Usted pone el límite", body: "Entre uno y veinte artículos al mes, modificable cuando quiera. Si lo pone a cero, dejará de recibir solicitudes." },
      { title: "Usted mantiene el control editorial", body: "Los artículos llegan como borradores a su web. Publique, edite o rechace: nada se publica sin usted." },
    ],
    suitsTitle: "Para quién es esto",
    suitsBody: "Para un pequeño negocio con un blog que ya publica de vez en cuando y quiere enlaces a sus páginas sin pagarlos. Si su web no tiene lectores, alojar artículos no lo cambiará: los enlaces que gane valen lo que valga su web.",
    joinNote: "Participar está incluido en todos los planes. Actívelo desde los ajustes de su web.",
    ctaPrimary: "Empezar",
    ctaSecondary: "Cómo funciona el intercambio",
  },
  affiliate: {
    metaTitle: "Recomiende un negocio",
    metaDescription: "Comparta su enlace y gane créditos cuando alguien a quien recomiende contrate un plan de pago.",
    title: "Recomiende un negocio y gane créditos",
    intro: "Comparta su enlace. Cuando alguien a quien recomiende pague su primer mes, los créditos llegan a su cuenta.",
    steps: [
      { title: "Comparta su enlace", body: "Cada cuenta tiene un enlace. Lo encontrará en Ajustes en cuanto se registre." },
      { title: "Se registran y se suscriben", body: "No se debe nada mientras alguien solo está probando el producto. La recomendación cuenta cuando paga su primer mes." },
      { title: "Usted recibe sus créditos", body: "Los créditos llegan automáticamente a su cuenta y puede gastarlos en enlaces de inmediato." },
    ],
    termsTitle: "Las condiciones, sin rodeos",
    terms: [
      "La recompensa es crédito en la cuenta, no dinero. No se puede retirar.",
      "Una recomendación cuenta cuando la persona recomendada paga su primer mes.",
      "Cada negocio puede ser recomendado una sola vez.",
      "Los créditos se gastan en construcción de enlaces dentro del producto.",
    ],
    ctaPrimary: "Empezar",
    ctaNote: "Su enlace de recomendación está en Ajustes en cuanto tenga cuenta.",
  },
  backlinkExchange: {
    metaTitle: "Cómo funciona el intercambio de enlaces",
    metaDescription: "Consiga enlaces hacia su web publicando un artículo para otro negocio. Solo emparejamientos relevantes, verificados a diario y créditos devueltos si un enlace desaparece.",
    title: "Cómo funciona el intercambio de enlaces",
    intro: "Los enlaces se ganan dándolos. Usted aloja un artículo de un negocio de un sector relacionado y gasta lo que gana en enlaces hacia su propia web.",
    steps: [
      { title: "Usted aloja un artículo", body: "Escribimos un artículo para otro negocio de un sector relacionado y lo publicamos en su web. Es un artículo real sobre un tema que interesa a sus lectores, no una página de enlaces." },
      { title: "Usted gana un crédito", body: "Alojar un artículo da un crédito. Su plan también incluye créditos cada mes, así que puede empezar antes de haber alojado nada." },
      { title: "Lo gasta en un enlace", body: "Un crédito compra un enlace hacia su web, escrito con naturalidad dentro de un artículo en la web de otro negocio relacionado." },
    ],
    rulesTitle: "Las reglas que hacen que valga la pena",
    rules: [
      { title: "Solo temas relacionados", body: "Un dentista nunca se empareja con un blog de criptomonedas. Si no podemos verificar que dos webs están relacionadas temáticamente, no hacemos el emparejamiento: un enlace irrelevante no vale nada y puede hacer daño." },
      { title: "Comprobados a diario", body: "Revisamos cada enlace todos los días. Los enlaces no desaparecen en silencio sin que usted se entere." },
      { title: "Créditos devueltos si un enlace cae", body: "Si se elimina un enlace, recupera el crédito y desaparece de su panel. No contamos enlaces que ya no existen." },
    ],
    notTitle: "Lo que esto no es",
    notBody: "Esto no es una red privada de blogs y no vendemos enlaces. Cada enlace está dentro de un artículo real en la web de un negocio real, publicado porque ese negocio quería un artículo. Comprar enlaces va contra las directrices de Google y puede ser penalizado, y por eso precisamente la red funciona por intercambio y no por venta.",
    ctaTitle: "Todos los planes incluyen créditos",
    ctaBody: "Puede pedir sus primeros enlaces antes de alojar nada.",
    ctaPrimary: "Empezar",
    ctaSecondary: "Prefiero alojar artículos",
  },
  faq: {
    metaTitle: "Preguntas frecuentes",
    metaDescription: "Preguntas habituales sobre cómo funciona AI SEO Platform.",
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
    subtitle: "Preguntas sobre el producto, su cuenta o la facturación: leemos todos los mensajes y respondemos en un plazo de dos días laborables.",
    emailLabel: "Correo electrónico",
    accountNote: "Si escribe sobre su cuenta, hágalo desde la dirección con la que se registró.",
  },
  legalNotice:
    "Esta página solo está disponible en inglés. Las traducciones de nuestros términos legales las prepara un traductor profesional antes de su publicación.",
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
        detail:
          "Suivez positions, visibilité et résultats sur Google.",
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
    subtitle: "RepGet publie du contenu SEO, obtient des backlinks de qualité et construit l'autorité qui fait découvrir votre entreprise.",
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
    auditAssurances: [
      "Sans créer de compte",
      "Rien à annuler",
    ],
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
      { title: "Publiez du contenu SEO", body: "Des articles de qualité générés et optimisés pour votre secteur." },
      { title: "Obtenez de vrais backlinks", body: "Soyez cité sur des sites pertinents pour renforcer votre autorité." },
      { title: "Suivez vos progrès", body: "Positions, trafic et résultats dans un tableau de bord simple." },
      { title: "Gagnez du temps avec l'IA", body: "Laissez l'IA travailler pendant que vous vous concentrez sur votre activité." },
    ],
    previewTitle: "Votre croissance, en pilote automatique.",
    previewSub: "Du contenu de qualité. De vrais backlinks. Plus de visibilité.",
    previewCaption: "Un tableau de bord d'exemple. Vos propres chiffres partent de zéro.",
    titleLead: "Positionnez-vous sur Google.",
    titleAccent: "Apparaissez dans les réponses IA.",
    heroCards: [
      { label: "Positions et clics", detail: "Depuis Search Console" },
      { label: "Visibilité IA", detail: "Si les assistants vous citent" },
      { label: "Croissance du trafic", detail: "Touchez plus de clients" },
      { label: "Visible dans les réponses IA", detail: "Présent là où ça compte" },
      { label: "Backlinks de qualité", detail: "Cité par de vrais sites" },
      { label: "Suivi des mots-clés", detail: "Voyez ce qui fonctionne" },
    ],
    joinGoogle: "Rejoindre avec Google",
    seeHow: "Voir comment ça marche",
    videoTitle: "Découvrez RepGet en deux minutes",
    videoSub: "Un court aperçu de ce qui se passe après avoir connecté un site.",
    videoComingSoon: "La vidéo de présentation est en cours d'enregistrement. En attendant, l'analyse gratuite vous montre la même chose sur votre propre site.",
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
    planWebsites: (n) => `${n} ${n === 1 ? "site web" : "sites web"}`,
    planCredits: (n) =>
      `${n} ${n === 1 ? "crédit de lien" : "crédits de lien"}`,
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
      websites: (n) => `${n} ${n === 1 ? "site web" : "sites web"}`,
      credits: (n) =>
        `${n} ${n === 1 ? "crédit de lien" : "crédits de lien"} chaque mois`,
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
    audience: "Aux petites entreprises et aux commerces de proximité qui ont besoin de clients, pas de tableaux de bord. Vous ne devriez jamais avoir à apprendre ce que signifie \"difficulté de mot-clé\". Nous nous chargeons du jugement ; vous voyez un plan, les articles et ce qui a changé.",
  },
  successStories: {
    metaTitle: "Témoignages",
    metaDescription: "Ce que mesurent les clients RepGet : positions, visibilité IA, articles publiés et backlinks obtenus, et comment arrivent les premiers résultats.",
    eyebrow: "Témoignages",
    title: "Nous préférons vous montrer ce que nous mesurons plutôt que d'inventer un client.",
    intro: "RepGet est récent, et nous n'allons pas inventer une entreprise qui l'aurait utilisé ni arrondir les chiffres de quelqu'un pour une page de vente. Voici ce que le produit mesure réellement, et à quoi ressemblent honnêtement les premiers mois.",
    results: [
      { label: "Positions et clics", body: "Issus de votre propre Search Console, pas estimés. Vous voyez sur quelles requêtes vous avez progressé, et ce que cela a rapporté en clics." },
      { label: "Visibilité IA", body: "Si ChatGPT, Claude et Perplexity citent votre entreprise quand on demande ce que vous vendez. Vérifié sur vos propres questions." },
      { label: "Articles publiés", body: "Ce qui a été écrit, quand c'est paru et ce que cela a donné — pour qu'un mois de travail ait une réponse et pas seulement une facture." },
      { label: "Backlinks obtenus", body: "De vrais liens dans de vrais articles sur les sites d'autres entreprises, vérifiés chaque jour. Si un lien disparaît, votre crédit vous est rendu." },
    ],
    timelineTitle: "À quoi ressemblent les trois premiers mois",
    timelineIntro: "Honnêtement, y compris la partie où il ne s'est encore rien passé.",
    timeline: [
      { when: "Semaine un", body: "Nous explorons le site, trouvons les problèmes techniques qui le freinent et planifions un mois d'articles autour de ce que vos clients recherchent vraiment." },
      { when: "Semaines deux à quatre", body: "Les articles paraissent selon votre calendrier. Les backlinks commencent à être placés à mesure que d'autres entreprises du réseau publient les leurs." },
      { when: "À partir du deuxième mois", body: "Les données Search Console arrivent pour les premiers articles. C'est là que les positions commencent à bouger : le SEO ne paie pas en une semaine, et quiconque promet le contraire vend autre chose." },
    ],
    ctaTitle: "Soyez le premier témoignage de cette page.",
    ctaBody: "Commencez par une analyse gratuite de votre site : une minute, sans frais. Si ce que nous trouvons mérite d'agir, les forfaits démarrent à 1€ le premier mois.",
    ctaPrimary: "Analyser mon site",
    ctaSecondary: "Voir les tarifs",
  },
  publishers: {
    metaTitle: "Rentabilisez votre blog",
    metaDescription: "Hébergez un article par mois pour une entreprise d'un secteur proche et gagnez des crédits à dépenser en liens vers votre propre site.",
    title: "Rentabilisez votre blog",
    intro: "Hébergez un article par mois pour une entreprise d'un secteur proche et gagnez des crédits à dépenser en liens vers votre propre site.",
    creditsTitle: "Des crédits, pas de l'argent",
    creditsBody: "Vous êtes rémunéré en crédits de liens, pas en argent. Un article hébergé rapporte un crédit, et un crédit vous obtient un lien depuis le site d'une autre entreprise. Si vous cherchez à être payé pour des articles invités, ce n'est pas cela — et il existe des places de marché pour ça.",
    steps: [
      { title: "Dites-nous de quoi parle votre site", body: "Votre sujet, votre langue et votre pays. Nous ne vous associons qu'à des entreprises d'un secteur proche." },
      { title: "Choisissez combien d'articles par mois", body: "Jusqu'à vingt, la plupart commencent à trois. Vous pouvez suspendre ou partir quand vous voulez." },
      { title: "Nous rédigeons l'article", body: "Un vrai article sur un sujet qui intéresse vos lecteurs, écrit pour votre site, avec un lien naturel dedans." },
      { title: "Vous gagnez un crédit", body: "Un crédit par article hébergé, à dépenser en lien vers votre site depuis celui d'une autre entreprise." },
    ],
    controlTitle: "Ce que vous contrôlez",
    rules: [
      { title: "Uniquement des sujets proches", body: "On ne vous demandera jamais d'héberger un contenu sans rapport avec votre site. Si nous ne pouvons pas établir que deux sites sont liés thématiquement, nous ne faisons pas l'association." },
      { title: "Vous fixez la limite", body: "Entre un et vingt articles par mois, modifiable quand vous le souhaitez. À zéro, vous ne recevez plus de demandes." },
      { title: "Vous gardez le contrôle éditorial", body: "Les articles arrivent en brouillon sur votre site. Publiez, modifiez ou refusez : rien ne paraît sans vous." },
    ],
    suitsTitle: "À qui cela convient",
    suitsBody: "À une petite entreprise dont le blog publie déjà de temps en temps et qui veut des liens vers ses pages sans les payer. Si votre site n'a pas de lecteurs, héberger des articles n'y changera rien : les liens que vous gagnez valent ce que vaut votre site.",
    joinNote: "L'adhésion est incluse dans tous les forfaits. Activez-la dans les paramètres de votre site.",
    ctaPrimary: "Commencer",
    ctaSecondary: "Comment fonctionne l'échange",
  },
  affiliate: {
    metaTitle: "Parrainer une entreprise",
    metaDescription: "Partagez votre lien et gagnez des crédits quand une personne que vous parrainez souscrit un forfait payant.",
    title: "Parrainez une entreprise, gagnez des crédits",
    intro: "Partagez votre lien. Quand une personne que vous parrainez paie son premier mois, les crédits arrivent sur votre compte.",
    steps: [
      { title: "Partagez votre lien", body: "Chaque compte a un lien. Vous le trouverez dans les Paramètres dès votre inscription." },
      { title: "Elle s'inscrit et s'abonne", body: "Rien n'est dû tant qu'une personne ne fait qu'essayer le produit. Le parrainage compte quand elle paie son premier mois." },
      { title: "Vous recevez vos crédits", body: "Les crédits arrivent automatiquement sur votre compte et sont utilisables immédiatement." },
    ],
    termsTitle: "Les conditions, clairement",
    terms: [
      "La récompense est un crédit sur le compte, pas de l'argent. Elle n'est pas retirable.",
      "Un parrainage compte une fois que la personne parrainée a payé son premier mois.",
      "Chaque entreprise ne peut être parrainée qu'une fois.",
      "Les crédits se dépensent en netlinking dans le produit.",
    ],
    ctaPrimary: "Commencer",
    ctaNote: "Votre lien de parrainage est dans les Paramètres dès que vous avez un compte.",
  },
  backlinkExchange: {
    metaTitle: "Comment fonctionne l'échange de liens",
    metaDescription: "Gagnez des liens vers votre site en publiant un article pour une autre entreprise. Uniquement des associations pertinentes, vérifiées chaque jour, crédits remboursés si un lien disparaît.",
    title: "Comment fonctionne l'échange de liens",
    intro: "Les liens se gagnent en en donnant. Vous hébergez un article pour une entreprise d'un secteur proche, et vous dépensez ce que vous gagnez en liens vers votre propre site.",
    steps: [
      { title: "Vous hébergez un article", body: "Nous rédigeons un article pour une autre entreprise d'un secteur proche et le publions sur votre site. C'est un vrai article sur un sujet qui intéresse vos lecteurs, pas une page de liens." },
      { title: "Vous gagnez un crédit", body: "Héberger un article rapporte un crédit. Votre forfait inclut aussi des crédits chaque mois, vous pouvez donc commencer avant d'avoir hébergé quoi que ce soit." },
      { title: "Vous le dépensez en lien", body: "Un crédit achète un lien vers votre site, intégré naturellement dans un article sur le site d'une autre entreprise d'un secteur proche." },
    ],
    rulesTitle: "Les règles qui en font quelque chose d'utile",
    rules: [
      { title: "Uniquement des sujets proches", body: "Un dentiste n'est jamais associé à un blog crypto. Si nous ne pouvons pas établir que deux sites sont liés thématiquement, nous ne faisons pas l'association : un lien hors sujet ne vaut rien et peut nuire." },
      { title: "Vérifiés chaque jour", body: "Nous revérifions chaque lien quotidiennement. Les liens ne disparaissent pas en silence sans que vous le sachiez." },
      { title: "Crédits remboursés si un lien tombe", body: "Si un lien est retiré, le crédit vous est rendu et le lien disparaît de votre tableau de bord. Nous ne comptons pas les liens qui n'existent plus." },
    ],
    notTitle: "Ce que ce n'est pas",
    notBody: "Ce n'est pas un réseau de blogs privés et nous ne vendons pas de liens. Chaque lien se trouve dans un vrai article sur le site d'une vraie entreprise, publié parce que cette entreprise voulait un article. Acheter des liens est contraire aux consignes de Google et peut être pénalisé — c'est exactement pour cela que le réseau fonctionne par échange et non par vente.",
    ctaTitle: "Tous les forfaits incluent des crédits",
    ctaBody: "Vous pouvez demander vos premiers liens avant d'avoir hébergé quoi que ce soit.",
    ctaPrimary: "Commencer",
    ctaSecondary: "Plutôt héberger des articles",
  },
  faq: {
    metaTitle: "FAQ",
    metaDescription: "Questions fréquentes sur le fonctionnement d'AI SEO Platform.",
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
        question: "Les articles sont-ils publiés automatiquement sur mon site ?",
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
    subtitle: "Des questions sur le produit, votre compte ou la facturation : nous lisons chaque message et répondons sous deux jours ouvrés.",
    emailLabel: "E-mail",
    accountNote: "Si votre message concerne votre compte, envoyez-le depuis l'adresse utilisée lors de l'inscription.",
  },
  legalNotice:
    "Cette page n'est disponible qu'en anglais. Les traductions de nos conditions légales sont réalisées par un traducteur professionnel avant publication.",
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
        detail:
          "Monitora posizioni, visibilità e risultati su Google.",
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
    subtitle: "RepGet pubblica contenuti SEO, ottiene backlink di qualità e costruisce l'autorevolezza che fa scoprire la sua azienda.",
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
    auditAssurances: [
      "Senza registrarsi",
      "Nulla da annullare",
    ],
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
      { title: "Pubblichi contenuti SEO", body: "Articoli di qualità generati e ottimizzati per il suo settore." },
      { title: "Ottenga backlink veri", body: "Sia citato su siti pertinenti per aumentare la sua autorevolezza." },
      { title: "Monitori i progressi", body: "Posizioni, traffico e risultati in un'unica dashboard." },
      { title: "Risparmi tempo con l'IA", body: "Lasci lavorare l'IA mentre lei si concentra sulla sua attività." },
    ],
    previewTitle: "La sua crescita, in automatico.",
    previewSub: "Contenuti di qualità. Backlink veri. Più visibilità.",
    previewCaption: "Una dashboard di esempio. I suoi numeri partono da zero e crescono da lì.",
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
    videoSub: "Una breve panoramica di cosa succede dopo aver collegato un sito.",
    videoComingSoon: "Stiamo registrando il video di presentazione. Nel frattempo, il controllo gratuito le mostra la stessa cosa sul suo sito.",
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
    planWebsites: (n) => `${n} ${n === 1 ? "sito web" : "siti web"}`,
    planCredits: (n) => `${n} ${n === 1 ? "credito link" : "crediti link"}`,
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
      websites: (n) => `${n} ${n === 1 ? "sito web" : "siti web"}`,
      credits: (n) =>
        `${n} ${n === 1 ? "credito link" : "crediti link"} ogni mese`,
      healthChecks: "Controlli sullo stato del sito",
      publishing: "Pubblica su WordPress, Ghost o Shopify",
    },
  },
  about: {
    metaTitle: "Chi siamo",
    metaDescription: "Perché AI SEO Platform esiste e a chi si rivolge.",
    title: "Risultati SEO senza agenzia",
    intro: [
      "Un dentista, un idraulico o un piccolo studio legale sa di dover \"fare SEO\". Ciò che serve davvero è qualcuno che studi le parole chiave, qualcuno che scriva, qualcuno che capisca gli audit tecnici e qualcuno che ottenga i link. Un'agenzia mette insieme tutto questo per qualche migliaio al mese.",
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
    audience: "Piccole imprese e attività locali che hanno bisogno di clienti, non di cruscotti. Non dovrebbe mai dover imparare cosa significa \"difficoltà della parola chiave\". Il giudizio lo mettiamo noi; lei vede un piano, gli articoli e che cosa è cambiato.",
  },
  successStories: {
    metaTitle: "Casi di successo",
    metaDescription: "Ciò che misurano i clienti RepGet: posizioni, visibilità IA, articoli pubblicati e backlink ottenuti, e come arrivano i primi risultati.",
    eyebrow: "Casi di successo",
    title: "Preferiamo mostrarle ciò che misuriamo piuttosto che inventare un cliente.",
    intro: "RepGet è nuovo e non inventeremo un'azienda che lo ha usato né arrotonderemo i numeri di qualcuno per una pagina di vendita. Ecco cosa misura davvero il prodotto e come sono onestamente i primi mesi.",
    results: [
      { label: "Posizioni e clic", body: "Presi dalla sua Search Console, non stimati. Vede su quali ricerche è salito e quanti clic ha portato." },
      { label: "Visibilità IA", body: "Se ChatGPT, Claude e Perplexity nominano la sua azienda quando qualcuno chiede ciò che lei vende. Verificato sulle sue domande." },
      { label: "Articoli pubblicati", body: "Cosa è stato scritto, quando è uscito e che risultato ha dato — così un mese di lavoro ha una risposta e non solo una fattura." },
      { label: "Backlink ottenuti", body: "Link veri dentro articoli veri su siti di altre aziende, controllati ogni giorno. Se un link viene rimosso, il credito le torna." },
    ],
    timelineTitle: "Come sono i primi tre mesi",
    timelineIntro: "Onestamente, compresa la parte in cui non è ancora successo nulla.",
    timeline: [
      { when: "Prima settimana", body: "Analizziamo il sito, troviamo i problemi tecnici che lo frenano e pianifichiamo un mese di articoli su ciò che i suoi clienti cercano davvero." },
      { when: "Settimane due-quattro", body: "Gli articoli escono secondo il suo calendario. I backlink iniziano a essere inseriti man mano che le altre aziende della rete pubblicano i loro." },
      { when: "Dal secondo mese", body: "Arrivano i dati di Search Console dei primi articoli. È qui che le posizioni iniziano a muoversi: la SEO non rende nella prima settimana, e chi promette il contrario le sta vendendo altro." },
    ],
    ctaTitle: "Sia il primo caso di questa pagina.",
    ctaBody: "Inizi con un controllo gratuito del sito: un minuto e nessun costo. Se ciò che troviamo merita, i piani partono da 1€ il primo mese.",
    ctaPrimary: "Controlla il mio sito",
    ctaSecondary: "Vedi i prezzi",
  },
  publishers: {
    metaTitle: "Monetizzi il suo blog",
    metaDescription: "Ospiti un articolo al mese per un'azienda di un settore affine e guadagni crediti da spendere in link verso il suo sito.",
    title: "Monetizzi il suo blog",
    intro: "Ospiti un articolo al mese per un'azienda di un settore affine e guadagni crediti da spendere in link verso il suo sito.",
    creditsTitle: "Crediti, non denaro",
    creditsBody: "Il compenso è in crediti per link, non in denaro. Un articolo ospitato vale un credito, e un credito le procura un link dal sito di un'altra azienda. Se cerca un pagamento in denaro per articoli ospiti, questo non lo è: esistono marketplace che lo fanno.",
    steps: [
      { title: "Ci dica di cosa parla il suo sito", body: "Argomento, lingua e paese. La abbiniamo solo ad aziende di un settore affine." },
      { title: "Scelga quanti articoli al mese", body: "Fino a venti, ma la maggior parte inizia con tre. Può sospendere o uscire quando vuole." },
      { title: "Scriviamo noi l'articolo", body: "Un articolo vero su un tema che interessa ai suoi lettori, scritto per il suo sito, con un link naturale all'interno." },
      { title: "Lei guadagna un credito", body: "Un credito per articolo ospitato, spendibile in un link verso il suo sito da quello di un altro." },
    ],
    controlTitle: "Cosa controlla lei",
    rules: [
      { title: "Solo argomenti affini", body: "Non le chiederemo mai di ospitare qualcosa estraneo al suo sito. Se non possiamo stabilire che due siti sono collegati per argomento, non facciamo l'abbinamento." },
      { title: "Il limite lo decide lei", body: "Da uno a venti articoli al mese, modificabile quando vuole. Impostandolo a zero non riceve più richieste." },
      { title: "Il controllo editoriale resta suo", body: "Gli articoli arrivano come bozze sul suo sito. Pubblichi, modifichi o rifiuti: nulla va online senza di lei." },
    ],
    suitsTitle: "A chi è utile",
    suitsBody: "A una piccola azienda con un blog che già pubblica ogni tanto e vuole link alle proprie pagine senza pagarli. Se il suo sito non ha lettori, ospitare articoli non lo cambierà: i link che guadagna valgono quanto vale il suo sito.",
    joinNote: "L'adesione è inclusa in ogni piano. La attivi dalle impostazioni del sito.",
    ctaPrimary: "Inizia",
    ctaSecondary: "Come funziona lo scambio",
  },
  affiliate: {
    metaTitle: "Segnali un'azienda",
    metaDescription: "Condivida il suo link e guadagni crediti quando una persona che ha segnalato attiva un piano a pagamento.",
    title: "Segnali un'azienda, guadagni crediti",
    intro: "Condivida il suo link. Quando una persona che ha segnalato paga il primo mese, i crediti arrivano sul suo account.",
    steps: [
      { title: "Condivida il suo link", body: "Ogni account ha un link. Lo trova nelle Impostazioni appena si registra." },
      { title: "Si registra e si abbona", body: "Nulla è dovuto finché qualcuno sta solo provando il prodotto. La segnalazione conta quando paga il primo mese." },
      { title: "Lei riceve i crediti", body: "I crediti arrivano automaticamente sul suo account e sono spendibili subito." },
    ],
    termsTitle: "Le condizioni, senza giri di parole",
    terms: [
      "Il premio è credito sull'account, non denaro. Non è prelevabile.",
      "Una segnalazione conta quando la persona segnalata paga il primo mese.",
      "Ogni azienda può essere segnalata una sola volta.",
      "I crediti si spendono in link building dentro il prodotto.",
    ],
    ctaPrimary: "Inizia",
    ctaNote: "Il suo link di segnalazione è nelle Impostazioni appena ha un account.",
  },
  backlinkExchange: {
    metaTitle: "Come funziona lo scambio di link",
    metaDescription: "Guadagni link verso il suo sito pubblicando un articolo per un'altra azienda. Solo abbinamenti pertinenti, verificati ogni giorno, crediti rimborsati se un link sparisce.",
    title: "Come funziona lo scambio di link",
    intro: "I link si guadagnano dandoli. Lei ospita un articolo per un'azienda di un settore affine e spende ciò che guadagna in link verso il suo sito.",
    steps: [
      { title: "Lei ospita un articolo", body: "Scriviamo un articolo per un'altra azienda di un settore affine e lo pubblichiamo sul suo sito. È un articolo vero su un tema che interessa ai suoi lettori, non una pagina di link." },
      { title: "Lei guadagna un credito", body: "Ospitare un articolo vale un credito. Il suo piano include anche crediti ogni mese, quindi può iniziare prima di aver ospitato qualcosa." },
      { title: "Lo spende in un link", body: "Un credito compra un link verso il suo sito, inserito con naturalezza in un articolo sul sito di un'altra azienda affine." },
    ],
    rulesTitle: "Le regole che lo rendono utile",
    rules: [
      { title: "Solo argomenti affini", body: "Un dentista non viene mai abbinato a un blog di criptovalute. Se non possiamo stabilire che due siti sono collegati per argomento, non facciamo l'abbinamento: un link fuori tema non vale nulla e può fare danni." },
      { title: "Controllati ogni giorno", body: "Ricontrolliamo ogni link quotidianamente. I link non spariscono in silenzio senza che lei lo sappia." },
      { title: "Crediti rimborsati se un link cade", body: "Se un link viene rimosso, il credito le torna e il link sparisce dalla dashboard. Non contiamo link che non esistono più." },
    ],
    notTitle: "Cosa non è",
    notBody: "Non è una rete privata di blog e non vendiamo link. Ogni link si trova dentro un articolo vero sul sito di un'azienda vera, pubblicato perché quell'azienda voleva un articolo. Comprare link è contro le linee guida di Google e può essere penalizzato: proprio per questo la rete funziona per scambio e non per vendita.",
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
    subtitle: "Domande sul prodotto, sul suo account o sulla fatturazione: leggiamo ogni messaggio e rispondiamo entro due giorni lavorativi.",
    emailLabel: "E-mail",
    accountNote: "Se scrive riguardo al suo account, lo faccia dall'indirizzo con cui si è registrato.",
  },
  legalNotice:
    "Questa pagina è disponibile solo in inglese. Le traduzioni dei nostri termini legali sono curate da un traduttore professionista prima della pubblicazione.",
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
    subtitle: "RepGet veröffentlicht SEO-Inhalte, gewinnt hochwertige Backlinks und baut die Autorität auf, durch die Ihr Unternehmen gefunden wird.",
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
    auditAssurances: [
      "Kein Konto nötig",
      "Nichts zu kündigen",
    ],
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
      { title: "SEO-Inhalte veröffentlichen", body: "Hochwertige Artikel, erstellt und optimiert für Ihre Branche." },
      { title: "Echte Backlinks aufbauen", body: "Werden Sie auf relevanten Websites zitiert und gewinnen Sie Autorität." },
      { title: "Fortschritt verfolgen", body: "Rankings, Traffic und Ergebnisse in einem einfachen Dashboard." },
      { title: "Zeit sparen mit KI", body: "Die KI übernimmt die Arbeit, Sie konzentrieren sich auf Ihr Geschäft." },
    ],
    previewTitle: "Ihr Wachstum, auf Autopilot.",
    previewSub: "Hochwertige Inhalte. Echte Backlinks. Mehr Sichtbarkeit.",
    previewCaption: "Ein Beispiel-Dashboard. Ihre eigenen Zahlen starten bei null.",
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
    videoSub: "Ein kurzer Rundgang durch das, was nach dem Verbinden einer Website passiert.",
    videoComingSoon: "Das Erklärvideo wird gerade aufgenommen. Bis dahin zeigt Ihnen die kostenlose Prüfung dasselbe an Ihrer eigenen Website.",
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
    planWebsites: (n) => `${n} ${n === 1 ? "Website" : "Websites"}`,
    planCredits: (n) => `${n} Link-Guthaben`,
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
      websites: (n) => `${n} ${n === 1 ? "Website" : "Websites"}`,
      credits: (n) =>
        `${n} ${n === 1 ? "Link-Guthaben" : "Link-Guthaben"} pro Monat`,
      healthChecks: "Website-Gesundheitschecks",
      publishing: "Veröffentlichen auf WordPress, Ghost oder Shopify",
    },
  },
  about: {
    metaTitle: "Über uns",
    metaDescription: "Warum es AI SEO Platform gibt und für wen es gedacht ist.",
    title: "SEO-Ergebnisse ohne Agentur",
    intro: [
      "Eine Zahnarztpraxis, ein Installateur oder eine kleine Kanzlei weiß, dass sie \"SEO machen\" sollte. Nötig sind dafür in Wirklichkeit jemand für die Keyword-Recherche, jemand zum Schreiben, jemand mit Verständnis für technische Audits und jemand, der Links besorgt. Eine Agentur bündelt all das für einige tausend im Monat.",
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
    audience: "Für kleine und lokale Unternehmen, die Kunden brauchen, keine Dashboards. Sie sollten nie lernen müssen, was \"Keyword-Schwierigkeit\" bedeutet. Wir übernehmen die Einschätzung; Sie sehen einen Plan, die Artikel und was sich verändert hat.",
  },
  successStories: {
    metaTitle: "Erfolgsgeschichten",
    metaDescription: "Was RepGet-Kunden messen: Rankings, KI-Sichtbarkeit, veröffentlichte Artikel und gewonnene Backlinks — und wann die ersten Ergebnisse kommen.",
    eyebrow: "Erfolgsgeschichten",
    title: "Wir zeigen Ihnen lieber, was wir messen, als einen Kunden zu erfinden.",
    intro: "RepGet ist neu, und wir erfinden weder ein Unternehmen, das es eingesetzt hätte, noch runden wir die Zahlen von jemandem für eine Verkaufsseite auf. Hier steht, was das Produkt tatsächlich misst und wie die ersten Monate ehrlich aussehen.",
    results: [
      { label: "Rankings und Klicks", body: "Aus Ihrer eigenen Search Console, nicht geschätzt. Sie sehen, bei welchen Suchanfragen Sie gestiegen sind und was das an Klicks gebracht hat." },
      { label: "KI-Sichtbarkeit", body: "Ob ChatGPT, Claude und Perplexity Ihr Unternehmen nennen, wenn jemand nach dem fragt, was Sie anbieten. Geprüft anhand Ihrer eigenen Fragen." },
      { label: "Veröffentlichte Artikel", body: "Was geschrieben wurde, wann es erschien und was es bewirkt hat — damit ein Monat Arbeit eine Antwort hat und nicht nur eine Rechnung." },
      { label: "Gewonnene Backlinks", body: "Echte Links in echten Artikeln auf Websites anderer Unternehmen, täglich geprüft. Wird einer entfernt, bekommen Sie Ihr Guthaben zurück." },
    ],
    timelineTitle: "Wie die ersten drei Monate aussehen",
    timelineIntro: "Ehrlich, einschließlich des Teils, in dem noch nichts passiert ist.",
    timeline: [
      { when: "Woche eins", body: "Wir crawlen die Website, finden die technischen Probleme, die sie ausbremsen, und planen einen Monat Artikel rund um das, wonach Ihre Kunden wirklich suchen." },
      { when: "Woche zwei bis vier", body: "Die Artikel erscheinen nach Ihrem Zeitplan. Backlinks werden gesetzt, sobald andere Unternehmen im Netzwerk ihre Artikel veröffentlichen." },
      { when: "Ab dem zweiten Monat", body: "Die Search-Console-Daten der ersten Artikel treffen ein. Jetzt bewegen sich die Rankings — SEO zahlt sich nicht in Woche eins aus, und wer das verspricht, verkauft etwas anderes." },
    ],
    ctaTitle: "Werden Sie die erste Geschichte auf dieser Seite.",
    ctaBody: "Starten Sie mit einer kostenlosen Prüfung Ihrer Website — eine Minute, kostenlos. Wenn sich das Ergebnis lohnt, beginnen die Tarife bei 1€ im ersten Monat.",
    ctaPrimary: "Website prüfen",
    ctaSecondary: "Preise ansehen",
  },
  publishers: {
    metaTitle: "Monetarisieren Sie Ihren Blog",
    metaDescription: "Veröffentlichen Sie einen Artikel pro Monat für ein Unternehmen aus einer verwandten Branche und verdienen Sie Link-Guthaben für Backlinks auf Ihre eigene Website.",
    title: "Monetarisieren Sie Ihren Blog",
    intro: "Veröffentlichen Sie einen Artikel pro Monat für ein Unternehmen aus einer verwandten Branche und verdienen Sie Guthaben für Links auf Ihre eigene Website.",
    creditsTitle: "Guthaben, kein Geld",
    creditsBody: "Sie werden in Link-Guthaben vergütet, nicht in Geld. Ein veröffentlichter Artikel bringt ein Guthaben, und ein Guthaben verschafft Ihnen einen Link von der Website eines anderen Unternehmens. Wenn Sie Geld für Gastbeiträge suchen, ist das hier nicht das Richtige — dafür gibt es Marktplätze.",
    steps: [
      { title: "Sagen Sie uns, worum es auf Ihrer Website geht", body: "Thema, Sprache und Land. Wir bringen Sie nur mit Unternehmen aus einer verwandten Branche zusammen." },
      { title: "Legen Sie fest, wie viele Artikel pro Monat", body: "Bis zu zwanzig, die meisten starten mit drei. Sie können jederzeit pausieren oder aufhören." },
      { title: "Wir schreiben den Artikel", body: "Ein echter Artikel zu einem Thema, das Ihre Leser interessiert, für Ihre Website geschrieben, mit einem natürlichen Link darin." },
      { title: "Sie verdienen ein Guthaben", body: "Ein Guthaben pro veröffentlichtem Artikel, einsetzbar für einen Link auf Ihre Website von der eines anderen." },
    ],
    controlTitle: "Was Sie bestimmen",
    rules: [
      { title: "Nur verwandte Themen", body: "Sie werden nie gebeten, etwas zu veröffentlichen, das nichts mit Ihrer Website zu tun hat. Wenn wir nicht feststellen können, dass zwei Websites thematisch verwandt sind, stellen wir die Verbindung nicht her." },
      { title: "Sie setzen das Limit", body: "Zwischen einem und zwanzig Artikeln pro Monat, jederzeit änderbar. Auf null gesetzt, erhalten Sie keine Anfragen mehr." },
      { title: "Die redaktionelle Kontrolle bleibt bei Ihnen", body: "Artikel kommen als Entwürfe auf Ihre Website. Veröffentlichen, bearbeiten oder ablehnen — ohne Sie geht nichts online." },
    ],
    suitsTitle: "Für wen das passt",
    suitsBody: "Für ein kleines Unternehmen mit einem Blog, der ohnehin gelegentlich veröffentlicht und Links auf die eigenen Seiten möchte, ohne dafür zu zahlen. Hat Ihre Website keine Leser, ändert das Veröffentlichen daran nichts: Die Links, die Sie verdienen, sind so viel wert wie Ihre Website.",
    joinNote: "Die Teilnahme ist in jedem Tarif enthalten. Aktivieren Sie sie in den Einstellungen Ihrer Website.",
    ctaPrimary: "Loslegen",
    ctaSecondary: "So funktioniert der Austausch",
  },
  affiliate: {
    metaTitle: "Ein Unternehmen empfehlen",
    metaDescription: "Teilen Sie Ihren Link und verdienen Sie Guthaben, wenn jemand, den Sie empfohlen haben, einen bezahlten Tarif startet.",
    title: "Empfehlen Sie ein Unternehmen, verdienen Sie Guthaben",
    intro: "Teilen Sie Ihren Link. Wenn jemand, den Sie empfohlen haben, den ersten Monat bezahlt, landet das Guthaben auf Ihrem Konto.",
    steps: [
      { title: "Teilen Sie Ihren Link", body: "Jedes Konto hat einen Link. Sie finden ihn nach der Anmeldung in den Einstellungen." },
      { title: "Anmeldung und Abo", body: "Solange jemand das Produkt nur ausprobiert, ist nichts fällig. Die Empfehlung zählt, wenn der erste Monat bezahlt wird." },
      { title: "Sie erhalten Ihr Guthaben", body: "Das Guthaben landet automatisch auf Ihrem Konto und ist sofort einsetzbar." },
    ],
    termsTitle: "Die Bedingungen, klar gesagt",
    terms: [
      "Die Vergütung ist Kontoguthaben, kein Geld. Es ist nicht auszahlbar.",
      "Eine Empfehlung zählt, sobald die empfohlene Person den ersten Monat bezahlt hat.",
      "Jedes Unternehmen kann nur einmal empfohlen werden.",
      "Guthaben wird im Produkt für Linkaufbau eingesetzt.",
    ],
    ctaPrimary: "Loslegen",
    ctaNote: "Ihr Empfehlungslink steht in den Einstellungen, sobald Sie ein Konto haben.",
  },
  backlinkExchange: {
    metaTitle: "So funktioniert der Backlink-Austausch",
    metaDescription: "Verdienen Sie Links auf Ihre Website, indem Sie einen Artikel für ein anderes Unternehmen veröffentlichen. Nur passende Zuordnungen, täglich geprüft, Guthaben zurück, wenn ein Link verschwindet.",
    title: "So funktioniert der Backlink-Austausch",
    intro: "Links verdient man, indem man welche gibt. Sie veröffentlichen einen Artikel für ein Unternehmen aus einer verwandten Branche und setzen das Verdiente für Links auf Ihre eigene Website ein.",
    steps: [
      { title: "Sie veröffentlichen einen Artikel", body: "Wir schreiben einen Artikel für ein anderes Unternehmen aus einer verwandten Branche und veröffentlichen ihn auf Ihrer Website. Ein echter Artikel zu einem Thema, das Ihre Leser interessiert — keine Linkliste." },
      { title: "Sie verdienen ein Guthaben", body: "Ein veröffentlichter Artikel bringt ein Guthaben. Ihr Tarif enthält zusätzlich monatliches Guthaben, Sie können also starten, bevor Sie etwas veröffentlicht haben." },
      { title: "Sie setzen es für einen Link ein", body: "Ein Guthaben kauft einen Link auf Ihre Website, natürlich eingebunden in einen Artikel auf der Website eines anderen Unternehmens aus einer verwandten Branche." },
    ],
    rulesTitle: "Die Regeln, die es wertvoll machen",
    rules: [
      { title: "Nur verwandte Themen", body: "Ein Zahnarzt wird nie einem Krypto-Blog zugeordnet. Wenn wir nicht feststellen können, dass zwei Websites thematisch verwandt sind, stellen wir die Verbindung nicht her: Ein themenfremder Link ist nichts wert und kann schaden." },
      { title: "Täglich geprüft", body: "Wir prüfen jeden Link täglich erneut. Links verschwinden nicht stillschweigend, ohne dass Sie es erfahren." },
      { title: "Guthaben zurück, wenn ein Link fällt", body: "Wird ein Link entfernt, erhalten Sie das Guthaben zurück und der Link verschwindet aus Ihrem Dashboard. Wir zählen keine Links, die es nicht mehr gibt." },
    ],
    notTitle: "Was das nicht ist",
    notBody: "Das ist kein privates Blog-Netzwerk, und wir verkaufen keine Links. Jeder Link steht in einem echten Artikel auf der Website eines echten Unternehmens, veröffentlicht, weil dieses Unternehmen einen Artikel wollte. Linkkauf verstößt gegen die Google-Richtlinien und kann abgestraft werden — genau darum funktioniert das Netzwerk über Austausch statt über Verkauf.",
    ctaTitle: "Jeder Tarif enthält Guthaben",
    ctaBody: "Sie können Ihre ersten Links anfordern, bevor Sie etwas veröffentlicht haben.",
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
    subtitle: "Fragen zum Produkt, zu Ihrem Konto oder zur Abrechnung — wir lesen jede Nachricht und antworten innerhalb von zwei Werktagen.",
    emailLabel: "E-Mail",
    accountNote: "Wenn es um Ihr Konto geht, schreiben Sie bitte von der Adresse, mit der Sie sich registriert haben.",
  },
  legalNotice:
    "Diese Seite ist nur auf Englisch verfügbar. Übersetzungen unserer rechtlichen Bedingungen werden vor der Veröffentlichung von einem professionellen Übersetzer erstellt.",
};

const MESSAGES: Record<Locale, Messages> = { en, es, fr, it, de };

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale] ?? en;
}
