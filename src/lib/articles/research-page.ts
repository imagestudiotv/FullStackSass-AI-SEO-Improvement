import type { CheerioAPI } from "cheerio";

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

/** Keep one contiguous passage: never stitch separated text into a quotation. */
function relevantExcerpt(text: string, topic?: string) {
  const limit = 12000;
  if (text.length <= limit || !topic) return text.slice(0, limit);
  const stop = new Set(["the", "and", "for", "with", "from", "how", "what", "your", "this", "that", "into", "are"]);
  const terms = new Set([...new Set((topic.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])
    .filter(term => !stop.has(term)))].slice(0, 64));
  const positions = new Map<string, number[]>();
  for (const match of text.toLocaleLowerCase().matchAll(/[\p{L}\p{N}]{3,}/gu)) {
    if (!terms.has(match[0])) continue;
    const offsets = positions.get(match[0]) ?? [];
    offsets.push(match.index);
    positions.set(match[0], offsets);
  }
  if (!positions.size) return text.slice(0, limit);
  const countBefore = (offsets: number[], point: number) => {
    let low = 0, high = offsets.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (offsets[middle] < point) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  // Rare topic terms distinguish the requested method from repeated product
  // names. Diminishing returns keep repetition from dominating the score.
  const score = (start: number) => [...positions.values()].reduce((total, offsets) =>
    total + Math.log1p(countBefore(offsets, start + limit) - countBefore(offsets, start)) / Math.sqrt(offsets.length), 0);
  let best = 0, bestScore = score(0);
  for (let offset = 500; offset < text.length - limit + 500; offset += 500) {
    const candidate = Math.min(offset, text.length - limit);
    const value = score(candidate);
    if (value > bestScore) { best = candidate; bestScore = value; }
  }
  if (!best) return text.slice(0, limit);
  // Prefer a nearby sentence start, preserving the original text exactly.
  const sentence = text.lastIndexOf(". ", best) + 2;
  const start = sentence > 1 && best - sentence <= 500 ? sentence : text.indexOf(" ", best) + 1;
  const end = text.lastIndexOf(" ", Math.min(start + limit, text.length));
  return text.slice(start, end > start ? end : start + limit);
}

/** Prefer the page's actual headline to the first article (often a related-post card). */
export function researchPageContent($: CheerioAPI, title: string, topic?: string) {
  $("script,style,nav,footer,aside,form,noscript,dialog,[role=navigation],[role=dialog],[hidden]").remove();
  $("header").each((_, node) => {
    if (!$(node).closest("article,main,[role=main]").length && !$(node).find("h1").length) $(node).remove();
  });
  const titleWords = new Set(title.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
  const headings = $("h1").toArray().map(node => {
    const words = normalize($(node).text()).toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
    return { node, score: words.length ? words.filter(word => titleWords.has(word)).length / words.length : 0 };
  }).sort((a, b) => b.score - a.score);
  const headline = headings.find(heading => heading.score >= 0.5);
  let content = headline ? $(headline.node).closest("article,main,[role=main]") : $("main,[role=main]").first();
  // Some page builders use divs throughout and reserve <article> for teasers.
  // A real page headline outside those cards must not fall back to a card.
  if (!content.length && headline) content = $("body");
  if (!content.length) {
    // Without semantic main markup, use a substantial article, not a short teaser.
    const articles = $("article").toArray().sort((a, b) => $(b).text().length - $(a).text().length);
    content = articles.length ? $(articles[0]) : $("body");
  }
  if (!headline && !content.is("article")) {
    const largest = content.find("article").toArray().sort((a, b) => $(b).text().length - $(a).text().length)[0];
    if (largest && $(largest).text().length >= content.text().length * 0.6) content = $(largest);
  }
  // A main container can include unrelated article cards before the real body.
  if (!content.is("article")) {
    content.find("article").each((_, node) => {
      if (headline && !$(node).find("h1").toArray().includes(headline.node) &&
        $(node).find("h1,h2 a[href],h3 a[href]").length) $(node).remove();
    });
  }
  // Keep word boundaries between block elements (Cheerio's text() concatenates them).
  content.find("p,h1,h2,h3,h4,h5,h6,li,tr,div,section,br").each((_, node) => {
    $(node).before(" ").after(" ");
  });
  return { content, excerpt: relevantExcerpt(normalize(content.text()), topic) };
}
