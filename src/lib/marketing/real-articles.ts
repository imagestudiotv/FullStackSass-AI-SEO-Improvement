/**
 * Real articles for the homepage's content section (client, 2026-10-09: "with
 * 3 real article ... we put image and the body of articles. We will be using
 * this 3 articles"). They replaced samples written for the page.
 *
 * A SNAPSHOT, copied word for word from the published articles on
 * 2026-10-10: the title, the description, the cover picture, the first
 * section headings and the opening of the first section. The full article is
 * one click away. Shown in the language it was published in, whatever the
 * page's language. If an article is rewritten, update its entry here (and its
 * picture in public/images/home-articles/).
 *
 * Plain data, no React: the homepage's server component passes it to the
 * client tabs (article-examples.tsx).
 */

import type { Locale } from "@/lib/i18n/config";

export type RealArticle = {
  /** Its label in the section, from the dictionary (`articles.kinds`). */
  kind: "chatgpt" | "automation" | "wedding";
  /**
   * The language it is published in. The preview marks its words with it, so
   * on /it the English title and opening are read as English, not Italian.
   */
  lang: Locale;
  title: string;
  /** Where it is published: a RepGet path, or a full address on another site. */
  href: string;
  /** The address as shown in the preview's address bar. */
  address: string;
  minutes: number;
  description: string;
  image: { src: string; alt: string; width: number; height: number; fit: "cover" | "contain" };
  /** The article's first section headings, as its contents list shows them. */
  contents: string[];
  heading: string;
  paragraphs: string[];
};

export const REAL_ARTICLES: RealArticle[] = [
  {
    kind: "chatgpt",
    lang: "en",
    title: "How to Get Mentioned in ChatGPT: A Business Guide",
    href: "/blog/get-mentioned-in-chatgpt",
    address: "repget.com/blog/get-mentioned-in-chatgpt",
    minutes: 18,
    description:
      "Learn how to get your business mentioned in ChatGPT with crawler checks, better website information, credible mentions, and a practical visibility tracking plan.",
    image: {
      src: "/images/home-articles/get-mentioned-in-chatgpt.webp",
      alt: "Diagram showing how websites, third-party mentions, and useful content can contribute to ChatGPT brand mentions, citations, and website visits.",
      width: 1200,
      height: 900,
      fit: "contain",
    },
    contents: [
      "How ChatGPT finds businesses to recommend",
      "Check whether ChatGPT can access your website",
      "Make it immediately clear what your business does",
      "Build credible mentions beyond your own website",
      "Publish answers to questions your customers actually ask",
      "Check whether ChatGPT already mentions your business",
    ],
    heading: "How ChatGPT finds businesses to recommend",
    paragraphs: [
      "ChatGPT does not use a single, publicly accessible directory of approved businesses.",
      "Depending on the question and the features involved, an answer may draw on the model's existing knowledge, retrieve current information from the web, or use relevant search and data providers.",
      "When ChatGPT searches the web, it can return an answer supported by links to sources.",
    ],
  },
  {
    kind: "automation",
    lang: "en",
    title: "AI SEO Automation: What to Automate and What to Review",
    href: "/blog/ai-seo-automation",
    address: "repget.com/blog/ai-seo-automation",
    minutes: 15,
    description:
      "AI SEO automation can save hours of work, but not every task belongs on autopilot. Learn what to automate, what to review, and how to build a safer SEO workflow.",
    image: {
      src: "/images/home-articles/ai-seo-automation.webp",
      alt: "AI SEO automation infographic showing which tasks can be automated and which require human review, including reporting, keyword research, technical changes and content approval",
      width: 1200,
      height: 750,
      fit: "contain",
    },
    contents: [
      "First, decide what deserves automation",
      "Automate your SEO reporting before your publishing",
      "Let software find technical problems, not fix everything automatically",
      "Use AI to organize keyword research, then decide what to publish",
      "Automate content preparation, but make the source material better",
      "Automate internal linking and publishing after editorial approval",
    ],
    heading: "First, decide what deserves automation",
    paragraphs: [
      "Before connecting an AI tool to your website, ask three questions.",
      "Can the result be checked? A list of broken URLs is easy to verify. A claim that one article will outrank its competitors is not.",
      "What happens if the tool gets it wrong? A poorly written draft can be corrected before anyone sees it. An incorrect redirect or indexing rule can affect an entire section of your website.",
    ],
  },
  {
    kind: "wedding",
    lang: "en",
    title: "How to Look Natural in Wedding Photos (Even If You Hate Posing)",
    href: "https://imagestudio.com/editorial/post/how-to-look-natural-in-wedding-photos/",
    address: "imagestudio.com/editorial/post/how-to-look-natural-in-wedding-photos",
    minutes: 20,
    description:
      "Camera-shy? Learn how to look natural in wedding photos with practical posing tips, candid vs posed comparisons, and real wedding examples from Italy.",
    image: {
      src: "/images/home-articles/how-to-look-natural-in-wedding-photos.webp",
      alt: "A bride and groom laughing together at a table in a garden, with glasses of spritz and white flowers in the foreground.",
      width: 1200,
      height: 800,
      fit: "cover",
    },
    contents: [
      "Why Do We Feel Awkward in Wedding Photos?",
      "Candid vs Posed vs Guided Wedding Photos: What’s the Difference?",
      "1. Stop Trying to Perform for the Camera",
      "2. Move Instead of Holding a Perfect Pose",
      "3. Give Your Hands Something Familiar to Do",
      "4. You Don’t Have to Look at the Camera",
    ],
    heading: "Why Do We Feel Awkward in Wedding Photos?",
    paragraphs: [
      "Think about the photographs of yourself that you genuinely love.",
      "Perhaps someone took one while you were talking to a friend. Maybe you were walking somewhere, laughing at something unexpected or simply enjoying a moment without knowing you were being photographed.",
      "Now think about what happens when somebody raises a camera and asks you to smile.",
    ],
  },
];
