/**
 * Builders for the blog autopilot's tests: what Claude would answer for a
 * plan and for each part of the body, in the shapes lib/blog/autopilot/write.ts
 * asks for. Nothing here calls a model.
 */

export const SECTION_HEADINGS = [
  "How local SEO works on Google",
  "Check whether your business is eligible",
  "Make your Business Profile useful",
  "Improve the pages that support local searches",
  "Build trust with real reviews",
  "A worked example: a cleaning company",
  "A practical 30-day plan",
  "Common local SEO mistakes",
  "Where RepGet fits into local SEO",
  "The bottom line",
];

/** A plan as the model returns it (before readPlan). */
export function planReply(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: "Local SEO for Plumbers: How to Get Found by Nearby Customers",
    slug: "Local SEO for Plumbers",
    seoTitle: "Local SEO for Plumbers: A Practical Guide",
    description:
      "Learn local SEO for plumbers with practical Business Profile, website, review and tracking steps that help nearby customers find and call you first.",
    primaryKeyword: "local SEO for plumbers",
    secondaryKeywords: ["plumber SEO", "Google Maps for plumbers", "plumbing website SEO"],
    category: "Playbooks",
    shortAnswer:
      "To improve local SEO for a plumbing business, start with an accurate Google Business Profile, clear service and area information on your website, and genuine customer reviews. Make it easy to call you. Google's local results depend mainly on relevance, distance and prominence, so no business can guarantee the top spot in every area.",
    reader: "Owners of small plumbing businesses who want more calls from nearby customers.",
    opening: "Someone's kitchen pipe bursts at 7pm and they search for a plumber on their phone.",
    sections: SECTION_HEADINGS.map((heading, index) => ({
      heading,
      covers: `What section ${index + 1} explains.`,
      subheadings: [`${heading}: first point`, `${heading}: second point`],
      table: index % 3 === 0 ? "A comparison with two columns" : "",
      links: [],
    })),
    pictures: [
      { afterSection: 1, title: "From search to call", idea: "A flow from search to map pack to call", labels: ["Search", "Map pack", "Call"], alt: "How a local search becomes a call" },
      { afterSection: 7, title: "A 30-day local SEO plan", idea: "A 30-day plan as four weekly boxes", labels: ["Week 1", "Week 2", "Week 3", "Week 4"], alt: "A 30-day local SEO plan" },
    ],
    faqQuestions: [
      "What is local SEO for plumbers?",
      "How long does local SEO take?",
      "Do reviews help a plumber rank?",
      "Do I need a page for every town?",
      "Can I rank without an address?",
      "How do I track calls from Google?",
    ],
    ...overrides,
  };
}

/** `count` words of plain filler. */
export function words(count: number, seed = "practical"): string {
  return Array.from({ length: count }, (_, index) => (index % 12 === 11 ? `${seed}.` : seed)).join(" ");
}

/** One section's HTML: its H2, an H3, a paragraph or two, a table when asked. */
export function sectionHtml(heading: string, wordsEach = 330, table = false): string {
  return [
    `<h2>${heading}</h2>`,
    `<p>${words(wordsEach / 2)}</p>`,
    `<h3>${heading} in practice</h3>`,
    `<p>${words(wordsEach / 2, "useful")}</p>`,
    table ? "<table><tbody><tr><th><p>Factor</p></th><th><p>What it means</p></th></tr><tr><td><p>Relevance</p></td><td><p>How well it matches</p></td></tr></tbody></table>" : "",
  ].join("");
}

/** The body parts as the model writes them, for the sections lib/blog/autopilot/write.ts bodyParts gives each. */
export function partReplies(ranges: { from: number; to: number }[], options: { wordsEach?: number } = {}): Record<string, unknown>[] {
  return ranges.map(({ from, to }, index) => {
    const opening = index === 0 ? `<p>Someone's kitchen pipe bursts. They search for local SEO for plumbers.</p><p>${words(40)}</p>` : "";
    const body = SECTION_HEADINGS.slice(from, to)
      .map((heading, offset) => sectionHtml(heading, options.wordsEach ?? 330, (from + offset) % 3 === 0))
      .join("");
    const last = index === ranges.length - 1;
    return last
      ? {
          bodyHtml: `${opening}${body}<h3>Find out what your website needs first</h3><p>Run a <a href="https://www.repget.com/audit">free website audit</a>. No account or credit card required.</p>`,
          faqs: [
            { question: "What is local SEO for plumbers?", answer: "<p>It is the work of helping nearby customers find your plumbing business on Google.</p>" },
            { question: "How long does local SEO take?", answer: "Usually weeks to months, depending on your area & competition." },
            { question: "Do reviews help a plumber rank?", answer: "<p>Genuine reviews help customers trust you, and they are part of prominence.</p>" },
            { question: "Do I need a page for every town?", answer: "<p>Only where you genuinely serve it and have something specific to say.</p>" },
            { question: "Can I rank without an address?", answer: "<p>A service-area business can hide its address in its Business Profile.</p>" },
            { question: "How do I track calls from Google?", answer: "<p>Your Business Profile shows calls, and Search Console shows clicks.</p>" },
          ],
        }
      : { bodyHtml: `${opening}${body}` };
  });
}

/** A Claude message carrying `value` as its JSON answer, with a thinking block first as Opus 5.5 sends. */
export function message(
  value: unknown,
  options: { stop?: string; usage?: Partial<Record<"input_tokens" | "output_tokens" | "cache_read_input_tokens" | "cache_creation_input_tokens", number>> } = {},
) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "text", text: typeof value === "string" ? value : JSON.stringify(value) },
    ],
    stop_reason: options.stop ?? "end_turn",
    usage: { input_tokens: 1_000, output_tokens: 2_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 20_000, ...options.usage },
  };
}
