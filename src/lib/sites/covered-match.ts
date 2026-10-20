import type { KeywordCluster } from "@/lib/keywords/cluster";

/**
 * Whether a keyword is already covered by an article (client, 2026-10-20:
 * new articles should be new ideas, not the blog's own topics again).
 * Plain word matching, no AI: a keyword is covered when RepGet has already
 * written an article for that very keyword, or when one article's title holds
 * every one of its meaningful words (plurals and word forms folded -
 * "photographer" and "photography" are one word here) AND those words are at
 * least half of what the title is about. "Choosing a Wedding Videography
 * Studio: Questions to Ask" does not cover "wedding videographer"; "Lake
 * Como Wedding Photography: Venues, Light and Timing" covers "lake como
 * wedding photographer". A one-word keyword is never covered by a title.
 */

export type CoveredTopics = {
  /** The site's own articles, in its main language. */
  siteTitles: string[];
  /** What RepGet has written for it. */
  writtenTitles: string[];
  writtenKeywords: string[];
};

/** Words that say nothing about a topic, in the languages RepGet writes. */
const STOP = new Set(
  (
    "a an and are as at be best by can do does for from get how in into is it many much need of on or our should the to vs what when where which who why with your you " +
    "il lo la i gli le un una di da del della dei delle e o per con su sul sulla sui come cosa nel nella nei al alla " +
    // Not "como": it is also Lake Como.
    "el los las unos unas de del y o para por con en que al " +
    "le les des du et ou pour par avec sur dans comment " +
    "der die das den dem des ein eine einer und oder für mit auf im in wie was"
  ).split(" "),
);

/** One word's stem: lower case, no accents, the plural folded, then the usual word forms ("weddings" and "wedding" are one). */
function stem(word: string): string {
  let w = word.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && /(ch|sh|x|ss|z)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  for (const ending of ["ing", "er", "y"]) {
    if (w.length > ending.length + 3 && w.endsWith(ending)) {
      w = w.slice(0, -ending.length);
      break;
    }
  }
  return w;
}

/** A text's meaningful words, as stems. */
export function topicWords(text: string): string[] {
  return (text.match(/[\p{L}\p{N}]+/gu) ?? []).map((word) => word.toLowerCase()).filter((word) => word.length > 1 && !STOP.has(word)).map(stem);
}

const sameKeyword = (a: string, b: string) => topicWords(a).join(" ") === topicWords(b).join(" ");

/** The article that covers `keyword` already - a written one's keyword, or a title holding every word - or null. */
export function coveredBy(keyword: string, covered: CoveredTopics): string | null {
  const words = topicWords(keyword);
  if (words.length === 0) return null;
  const written = covered.writtenKeywords.find((other) => sameKeyword(other, keyword));
  if (written) return written;
  if (words.length < 2) return null;
  for (const title of [...covered.writtenTitles, ...covered.siteTitles]) {
    const titleWords = new Set(topicWords(title));
    // Every word of the keyword, and the keyword is what the title is mostly about.
    if (titleWords.size > 0 && words.every((word) => titleWords.has(word)) && new Set(words).size / titleWords.size >= 0.5) return title;
  }
  return null;
}

/**
 * The clusters without what is already covered: a covered pillar gives way to
 * the cluster's next keyword that is not, and a cluster with nothing left is
 * dropped. What was dropped is returned too, for the log.
 */
export function withoutCovered(clusters: KeywordCluster[], covered: CoveredTopics): { clusters: KeywordCluster[]; dropped: { keyword: string; by: string }[] } {
  const dropped: { keyword: string; by: string }[] = [];
  const kept: KeywordCluster[] = [];
  for (const cluster of clusters) {
    const terms = cluster.terms.filter((term) => {
      const by = coveredBy(term, covered);
      if (by) dropped.push({ keyword: term, by });
      return !by;
    });
    if (terms.length === 0) continue;
    const pillarKept = terms.some((term) => term.toLowerCase() === cluster.pillarKeyword.toLowerCase());
    kept.push({ ...cluster, terms, pillarKeyword: pillarKept ? cluster.pillarKeyword : terms[0] });
  }
  return { clusters: kept, dropped };
}
