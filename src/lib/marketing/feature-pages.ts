/**
 * Two product pages linked from the footer, /backlinks and /rank-on-chatgpt
 * (client, 2026-10-09: pages like Babylovegrowth's footer pages "with a real
 * article featuring Image Studio").
 *
 * EVERY CLAIM HERE IS WHAT THE PRODUCT DOES TODAY, checked against the code
 * on 2026-10-10: links placed by hand inside articles on related customers'
 * sites (lib/backlinks/managed.ts), sent followed and flagged if a host
 * changes that (lib/backlinks/follow.ts), credits included monthly and spent
 * only once a link is verified live, the audit's AI-crawler check
 * (lib/audit/ai-crawlers.ts), 20 / 50 tracked questions on Grow / Scale
 * (lib/geo/shared.ts). No traffic figures, no prices per link, no counts of
 * customers: the reference pages print numbers we cannot back.
 *
 * The examples are real Image Studio articles, a snapshot taken on
 * 2026-10-10 (like lib/marketing/real-articles.ts). Image Studio's Domain
 * Authority is shown only once the client gives the figure; a placed partner
 * link is shown only once one exists on the article.
 *
 * English only for now: localePath() keeps every language on these paths
 * until translated copy is added.
 */

export type FeatureExample = {
  siteName: string;
  site: string;
  /** Who the site belongs to, in a few words. */
  about: string;
  title: string;
  href: string;
  /** Date published, YYYY-MM-DD. */
  published: string;
  category: string;
  description: string;
  image: { src: string; alt: string; width: number; height: number };
  /** Read time, when the page shows one. */
  minutes: number | null;
  /** Domain Authority of the site, as RepGet's dashboard shows it. From the client; hidden while null. */
  domainAuthority: number | null;
  /** What to notice in the article, each one checkable on the live page. */
  highlights: string[];
  /** A partner link really placed in this article, once there is one. Hidden while null. */
  placedLink: { url: string; anchor: string } | null;
};

export type FeaturePage = {
  path: "/backlinks" | "/rank-on-chatgpt";
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  accent: string;
  intro: string;
  primaryCta: string;
  secondaryCta: { label: string; href: string };
  benefitsTitle: string;
  benefits: { title: string; body: string }[];
  compare: { title: string; without: { label: string; points: string[] }; with: { label: string; points: string[] } };
  stepsTitle: string;
  steps: { title: string; body: string }[];
  example: { eyebrow: string; title: string; body: string; readLabel: string; daLabel: string; placedLabel: string };
  table: { title: string; columns: string[]; rows: { label: string; cells: string[] }[] } | null;
  related: { label: string; href: string } | null;
  faqTitle: string;
  faq: { question: string; answer: string }[];
  closingTitle: string;
  closingBody: string;
};

const IMAGE_STUDIO = {
  siteName: "Image Studio",
  site: "imagestudio.com",
  about: "a wedding film and photography studio in Italy, and a RepGet customer",
};

export const BACKLINKS_EXAMPLE: FeatureExample = {
  ...IMAGE_STUDIO,
  title: "Everything Couples Should Know Before Choosing a Wedding Venue in Italy",
  href: "https://imagestudio.com/editorial/post/choosing-wedding-venue-italy/",
  published: "2026-08-27",
  category: "Wedding",
  description:
    "Choosing a wedding venue in Italy? Compare destinations, venue types, costs, logistics, weather plans, ceremony rules and the questions to ask before booking.",
  image: {
    src: "/images/feature-pages/choosing-wedding-venue-italy.webp",
    alt: "A couple leaving their wedding ceremony at Castello di Rossino in Italy, guests on either side.",
    width: 960,
    height: 640,
  },
  minutes: null,
  domainAuthority: null,
  highlights: [],
  placedLink: null,
};

export const CHATGPT_EXAMPLE: FeatureExample = {
  ...IMAGE_STUDIO,
  title: "How to Look Natural in Wedding Photos (Even If You Hate Posing)",
  href: "https://imagestudio.com/editorial/post/how-to-look-natural-in-wedding-photos/",
  published: "2026-10-09",
  category: "Wedding",
  description:
    "Camera-shy? Learn how to look natural in wedding photos with practical posing tips, candid vs posed comparisons, and real wedding examples from Italy.",
  image: {
    src: "/images/home-articles/how-to-look-natural-in-wedding-photos.webp",
    alt: "Guests and the couple sharing a natural, unposed moment at an Italian wedding reception.",
    width: 1200,
    height: 800,
  },
  minutes: 20,
  domainAuthority: null,
  highlights: [
    "Headings that are the questions people ask: “Why Do We Feel Awkward in Wedding Photos?”",
    "A direct comparison: “Candid vs Posed vs Guided Wedding Photos: What’s the Difference?”",
    "Eight numbered tips, each one a clear answer on its own",
    "A real example from the studio’s own work: “Julia & Mihail in Rome”",
    "A “Frequently Asked Questions” section near the end",
  ],
  placedLink: null,
};

const SIGN_UP_CTA = "Create 3 articles for free";

export const BACKLINKS_PAGE: FeaturePage = {
  path: "/backlinks",
  metaTitle: "Backlinks from real business websites",
  metaDescription:
    "RepGet places links to your website inside new articles on related businesses' websites. Followed links, checked on the live page, with credits included in every plan.",
  eyebrow: "Backlinks",
  title: "Backlinks from real business websites,",
  accent: "without a single outreach email.",
  intro:
    "RepGet places links to your website inside new articles published on other businesses' websites in a related field. Every link is listed in your dashboard and checked on the live page.",
  primaryCta: SIGN_UP_CTA,
  secondaryCta: { label: "See pricing", href: "/pricing" },
  benefitsTitle: "What you get",
  benefits: [
    {
      title: "Inside real articles",
      body: "Your link sits in the body of an article written for the host's own readers. Never on a page of links, never hidden in a footer.",
    },
    {
      title: "From a related field",
      body: "Links come from businesses in a field related to yours, never from unrelated websites.",
    },
    {
      title: "Followed links",
      body: "Every partner link is sent as a normal, followed link that search engines can count. If a host changes one, the next check flags it.",
    },
    {
      title: "Credits come with your plan",
      body: "Every plan includes link credits each month, and hosting articles for others earns more. A link uses its credits only once it is verified live.",
    },
  ],
  compare: {
    title: "Link building on your own, and with RepGet",
    without: {
      label: "On your own",
      points: [
        "Writing to site owners who rarely answer",
        "Paying per link, or trading favours one at a time",
        "Links on pages written only to hold links",
        "No easy way to know if a link is still there",
      ],
    },
    with: {
      label: "With RepGet",
      points: [
        "No outreach: links are placed for you",
        "Credits included in your plan",
        "Links inside new articles, written for real readers",
        "Every link listed, and checked on the live page",
      ],
    },
  },
  stepsTitle: "Three steps to your first backlink",
  steps: [
    {
      title: "Choose your important pages",
      body: "Tell us which pages on your website should receive links, and which matter most. RepGet can suggest them from your sitemap.",
    },
    {
      title: "We place the links",
      body: "The RepGet team places each link by hand, inside an article on a related business's website. Every article is reviewed before it goes live.",
    },
    {
      title: "Follow every link",
      body: "Your Backlinks page lists each link: the article that carries it, the website it is on, and its status, from “finding a website” to “live”.",
    },
  ],
  example: {
    eyebrow: "A real example",
    title: "This is the kind of article a link goes in",
    body: "Partner links are placed inside articles like this one: written by RepGet for a real business, for its own readers, and published on its own website.",
    readLabel: "Read the article",
    daLabel: "Domain Authority",
    placedLabel: "Partner link in this article",
  },
  table: {
    title: "How it compares",
    columns: ["On your own", "An agency", "RepGet"],
    rows: [
      { label: "Your time", cells: ["Hours of outreach every month", "Briefing and reviewing reports", "Choose your pages once"] },
      { label: "Where links appear", cells: ["Wherever a site owner agrees", "Depends on the agency", "Inside new articles on related businesses' websites"] },
      { label: "Seeing each link", cells: ["Your own spreadsheet", "A monthly report", "Your dashboard, checked on the live page"] },
      { label: "How you pay", cells: ["Per link, or with your time", "A monthly fee", "Credits included in your plan"] },
    ],
  },
  related: { label: "How link credits work", href: "/backlink-exchange" },
  faqTitle: "Questions about backlinks",
  faq: [
    {
      question: "What is a backlink, and why does it matter?",
      answer:
        "A backlink is a link from another website to yours. Search engines and AI assistants read links from relevant websites as a sign that others vouch for your pages, which helps those pages rank and get cited.",
    },
    {
      question: "Where do the links come from?",
      answer:
        "From the websites of other RepGet customers in a field related to yours. Each link is placed inside a new article on their website, written for their readers.",
    },
    {
      question: "Do I have to host articles for others?",
      answer:
        "That is how the network works: your website may carry a link to another customer, just as theirs carry links to you, and hosting earns you credits. You decide how your website takes part in its settings.",
    },
    {
      question: "Are the links followed?",
      answer:
        "Yes. RepGet sends every partner link as a normal, followed link. The regular check of the live page flags any link a host has changed.",
    },
    {
      question: "What happens if a link is removed?",
      answer: "The checks keep looking for it. If a link is gone for good, tell us and your credit comes back.",
    },
    {
      question: "How many backlinks will I get?",
      answer:
        "It depends on your plan's credits and on how many related businesses are publishing at the time. Your Backlinks page shows each link as it arrives.",
    },
  ],
  closingTitle: "Get your first backlinks without sending an email",
  closingBody: "Start with three free articles, and see your dashboard for yourself.",
};

export const CHATGPT_PAGE: FeaturePage = {
  path: "/rank-on-chatgpt",
  metaTitle: "How to rank on ChatGPT and get your business recommended",
  metaDescription:
    "RepGet helps AI assistants like ChatGPT find, trust and name your business: an AI-crawler check, articles that answer real questions, links from related websites, and AI visibility tracking.",
  eyebrow: "AI search",
  title: "Get your business",
  accent: "recommended by ChatGPT.",
  intro:
    "People now ask AI assistants which business to choose. RepGet checks that assistants can read your website, publishes clear articles that answer your customers' questions, earns mentions on related websites, and tracks whether your business is named.",
  primaryCta: SIGN_UP_CTA,
  secondaryCta: { label: "Run the free audit", href: "/audit" },
  benefitsTitle: "How RepGet helps you get named",
  benefits: [
    {
      title: "AI crawlers let in",
      body: "The audit reads your robots.txt and shows whether the crawlers of ChatGPT, Claude, Perplexity and Gemini may read your website. Blocking them by accident is common.",
    },
    {
      title: "Answers to real questions",
      body: "Articles are planned from what your customers actually search, written in your language, with clear headings, a contents list and comparison tables where they help.",
    },
    {
      title: "Mentions on related websites",
      body: "Links from businesses in a related field, inside real articles, show assistants that others vouch for you.",
    },
    {
      title: "AI visibility tracking",
      body: "Add the questions your customers would ask an assistant, 20 on Grow and 50 on Scale, and see whether your business is named, and where in the answer.",
    },
  ],
  compare: {
    title: "AI search without RepGet, and with it",
    without: {
      label: "Without RepGet",
      points: [
        "You don't know whether assistants mention you",
        "A blocked AI crawler goes unnoticed",
        "Pages that never answer the question directly",
        "Few other websites talk about you",
      ],
    },
    with: {
      label: "With RepGet",
      points: [
        "Tracked questions show where you are named",
        "The audit flags a blocked AI crawler",
        "Articles that answer questions in plain words",
        "Links from related businesses' articles",
      ],
    },
  },
  stepsTitle: "Three steps to being named",
  steps: [
    {
      title: "Run the free audit",
      body: "It checks which AI crawlers may read your website, and the technical basics both Google and assistants rely on. No account needed.",
    },
    {
      title: "Publish answers every month",
      body: "RepGet plans, writes and publishes articles to your website through WordPress, Shopify or Ghost, on the schedule you set.",
    },
    {
      title: "Track your AI visibility",
      body: "The questions you track are asked again over time, so you can see when your business starts being named.",
    },
  ],
  example: {
    eyebrow: "A real example",
    title: "An article written to be quoted",
    body: "Written by RepGet and published on the customer's own website. Notice how it is built:",
    readLabel: "Read the article",
    daLabel: "Domain Authority",
    placedLabel: "Partner link in this article",
  },
  table: null,
  related: { label: "Read our guide: How to Get Mentioned in ChatGPT", href: "/blog/get-mentioned-in-chatgpt" },
  faqTitle: "Questions about AI search",
  faq: [
    {
      question: "Can you guarantee that ChatGPT will recommend my business?",
      answer:
        "No one can: assistants decide for themselves, and their answers change. RepGet improves what they can find and quote about you, and shows you, question by question, whether you are named.",
    },
    {
      question: "How do AI assistants choose which businesses to mention?",
      answer:
        "They draw on what they can read: your own website, articles that answer the question, and what other websites say about you. Clear, specific pages and mentions on relevant websites both help.",
    },
    {
      question: "How does the tracking work?",
      answer:
        "RepGet asks an AI assistant each question you track, the way a customer would, and records which businesses the answer names and in what order. When a check cannot be completed, nothing is recorded, so a failed check never looks like a miss.",
    },
    {
      question: "How long does it take?",
      answer:
        "Assistants update what they know at their own pace, so think in weeks and months, not days. Tracking the same questions over time shows the change.",
    },
    {
      question: "Do I need to change my website?",
      answer:
        "Usually not. The audit points out anything that blocks AI crawlers, and the articles are published to your existing website through WordPress, Shopify or Ghost.",
    },
  ],
  closingTitle: "Find out what AI assistants say about your business",
  closingBody: "Start with three free articles, or run the free audit first.",
};
