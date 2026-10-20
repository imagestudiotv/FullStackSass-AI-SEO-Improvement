import type { CheerioAPI } from "cheerio";

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

/** Prefer the page's actual headline to the first article (often a related-post card). */
export function researchPageContent($: CheerioAPI, title: string) {
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
  return { content, excerpt: normalize(content.text()).slice(0, 12000) };
}
