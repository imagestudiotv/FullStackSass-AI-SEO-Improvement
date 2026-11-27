/**
 * The writing sample on /ai-blog-writer: "How to plan Lake Como wedding
 * portraits around the aperitivo", the owner-approved sample from Daniel's
 * Free AI Blog Writer mockup (2026-11-27, daniel-free-blog-writer-spec.md).
 *
 * The title, credit, opening and the three sections are the mockup's words,
 * verbatim. The TL;DR, the heading that groups the first two sections and the
 * three questions are added here to show an article's full shape, and say
 * nothing the sections do not: no times, prices, places or names beyond the
 * mockup's own.
 *
 * It is a SAMPLE, not a published article: the page says so, and it shows no
 * address, date or result for it. In English on every language's page (lang="en").
 *
 * The picture is Image Studio's own (lib/marketing/real-articles.ts, the
 * wedding article on imagestudio.com), with its description as alt text.
 */

export type SampleSection = {
  id: string;
  heading: string;
  paragraphs: string[];
  subsections: { id: string; heading: string; paragraphs: string[] }[];
};

export type AiBlogWriterSample = {
  lang: "en";
  title: string;
  credit: string;
  tldr: string;
  intro: string;
  image: { src: string; alt: string; width: number; height: number };
  sections: SampleSection[];
  faqHeading: string;
  faq: { question: string; answer: string }[];
};

export const AI_BLOG_WRITER_SAMPLE: AiBlogWriterSample = {
  lang: "en",
  title: "How to plan Lake Como wedding portraits around the aperitivo",
  credit: "Image Studio / Wedding photography · imagestudio.com",
  tldr:
    "Decide which part of the aperitivo you want to be there for, then plan the portraits backwards from it. Count the walk and the boat as part of the portrait time, and keep a shorter plan within sight of the reception in case the speeches run late.",
  intro:
    "Start with the photograph you would hate to miss. For some couples, it is the two of them on a wooden boat. For others, it is a grandfather raising his glass at the aperitivo. Both belong on the timeline. The order in which you plan them matters.",
  image: {
    src: "/images/home-articles/how-to-look-natural-in-wedding-photos.webp",
    alt: "A bride and groom laughing together at a table in a garden, with glasses of spritz and white flowers in the foreground.",
    width: 1200,
    height: 800,
  },
  sections: [
    {
      id: "sample-plan-backwards",
      heading: "Plan backwards from the aperitivo",
      paragraphs: [],
      subsections: [
        {
          id: "sample-return-time",
          heading: "Choose your return time first",
          paragraphs: [
            "Ask your planner when guests will gather for drinks and when everyone will move to dinner. Choose the part you want to be there for. If it is the first toast, write that down as a fixed appointment before choosing a pier or a portrait location.",
          ],
        },
        {
          id: "sample-time-outside",
          heading: "Count the time outside the photograph",
          paragraphs: [
            "Walk from the ceremony exit to the boarding point in the shoes you will wear. Then ask the boat operator about boarding, turning and docking. A short ride can fit on paper while the walk back through the gardens quietly consumes the rest of the break.",
          ],
        },
      ],
    },
    {
      id: "sample-shorter-version",
      heading: "Give the plan a shorter version",
      paragraphs: [
        "Choose a second location within sight of the reception. If speeches run late, you can take portraits on the terrace and still hear the toast. Put both locations on the planner’s copy of the schedule so nobody needs to interrupt you for a decision.",
      ],
      subsections: [],
    },
  ],
  faqHeading: "Frequently asked questions",
  faq: [
    {
      question: "What should we decide first?",
      answer: "The part of the aperitivo you want to be there for, such as the first toast. Treat it as a fixed appointment and plan the portraits backwards from it.",
    },
    {
      question: "What if the speeches run late?",
      answer: "Use the second location within sight of the reception. You can take portraits on the terrace and still hear the toast.",
    },
    {
      question: "Who needs a copy of the plan?",
      answer: "Your planner. Put both locations on the planner’s copy of the schedule, so nobody needs to interrupt you for a decision.",
    },
  ],
};

/** What the sample's side panel counts: measured from the sample itself, never typed in. */
export type SampleStats = {
  words: number;
  sections: number;
  subheadings: number;
  questions: number;
  picturesWithAlt: number;
  outsideLinks: number;
};

export function sampleStats(sample: AiBlogWriterSample): SampleStats {
  const text = [
    sample.tldr,
    sample.intro,
    ...sample.sections.flatMap((section) => [
      section.heading,
      ...section.paragraphs,
      ...section.subsections.flatMap((sub) => [sub.heading, ...sub.paragraphs]),
    ]),
    ...sample.faq.flatMap((item) => [item.question, item.answer]),
  ].join(" ");
  return {
    words: text.split(/\s+/).filter(Boolean).length,
    // The FAQ is an H2 of its own, as in a real article.
    sections: sample.sections.length + (sample.faq.length > 0 ? 1 : 0),
    subheadings: sample.sections.reduce((sum, section) => sum + section.subsections.length, 0),
    questions: sample.faq.length,
    picturesWithAlt: sample.image.alt.trim() ? 1 : 0,
    // The sample has no links at all: the contents list only jumps within it.
    outsideLinks: 0,
  };
}
