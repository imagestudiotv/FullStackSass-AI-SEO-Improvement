/**
 * One keyword per search, not one per spelling.
 *
 * Research returns the same search in several forms - an inflection ("для
 * мужчині" / "для мужчини"), a typo, a plural, the words in another order
 * ("dentist dublin" / "dublin dentist") - and each became its own keyword row,
 * its own slot in the plan and, eventually, two articles competing for one
 * query (review of 2026-11-27, a Ukrainian site). Here they are grouped and
 * only the form people search most is kept.
 *
 * Deterministic and free: no model call. Deliberately conservative - two
 * keywords merge only when every word of one pairs with a word of the other:
 *  - the same word, or
 *  - the same word with a different ending (a shared start of all but the
 *    last two letters, five letters at least: "мужчині" / "мужчини"), or
 *  - a plural made with s/es/ies ("shoe" / "shoes", "agency" / "agencies"), or
 *  - one typing slip in a longer word that starts the same ("привітання" /
 *    "привітаня"), never in its first three letters, so "hotels" and "motels"
 *    stay apart.
 * An ending that makes another word is not an inflection: of two Latin-script
 * words, when only one ends in a derivational suffix (-er, -or, -ist, -ing,
 * -ion, -ment, -ry...), they never merge. "design" / "designer", "massage" /
 * "massager", "videography" / "videographer", "dentist" / "dentistry" are
 * different searches, often for a different page (outside review of
 * 2026-11-28).
 * Numbers and short words must match exactly: "2025" is not "2026", "car" is
 * not "cat". With two words or more, at least one must match exactly.
 */

/** Lowercase, one kind of apostrophe, no punctuation, single spaces. */
export function normalizeTerm(term: string): string {
  return term
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’ʼʹ`´']/g, "'")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}'\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const tokens = (term: string) => normalizeTerm(term).split(" ").filter(Boolean);

function commonPrefix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/** Edit distance, stopping early once it passes 1. */
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

const isWord = (token: string) => /^\p{L}[\p{L}']*$/u.test(token);

/**
 * English derivational suffixes: endings that make a new word (a person, an
 * activity, a quality, a field) rather than a form of the same one. Checked
 * on Latin-script words only; a Cyrillic case ending is an inflection.
 */
const DERIVATIONAL = [
  "er", "or", "ist", "ing", "ion", "ism", "ment", "ness", "ity", "ry", "ship", "hood",
  "ee", "ian", "ive", "able", "ible", "ful", "less", "ous", "ize", "ise", "ology",
];
const LATIN = /^[a-z']+$/;

/** The word without an English plural ending: "agencies" -> "agency", "boxes" -> "box", "shoes" -> "shoe". */
function singular(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(s|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/**
 * True when only one of two Latin-script words carries a derivational suffix
 * ("design" / "designer"): different words, however close their spelling.
 * Compared without plural endings, so "designer" / "designers" stay one.
 */
export function derivedPair(a: string, b: string): boolean {
  if (!LATIN.test(a) || !LATIN.test(b)) return false;
  const x = singular(a);
  const y = singular(b);
  if (x === y) return false;
  const ends = (word: string, suffix: string) => word.length - suffix.length >= 3 && word.endsWith(suffix);
  return DERIVATIONAL.some((suffix) => ends(x, suffix) !== ends(y, suffix));
}

export function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (!isWord(a) || !isWord(b)) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 3 && (long === `${short}s` || long === `${short}es`)) return true;
  if (short.length >= 3 && short.endsWith("y") && long === `${short.slice(0, -1)}ies`) return true;
  if (derivedPair(a, b)) return false;
  if (short.length < 5) return false;
  if (commonPrefix(a, b) >= Math.max(5, long.length - 2)) return true;
  return short.length >= 6 && a.slice(0, 3) === b.slice(0, 3) && withinOneEdit(a, b);
}

/** True when two keywords are the same search written differently. */
export function areVariants(a: string, b: string): boolean {
  const left = tokens(a);
  const right = tokens(b);
  if (left.length === 0 || left.length !== right.length) return false;
  if (left.join(" ") === right.join(" ")) return true;

  // Pair every word on the left with a word on the right, exact pairs first.
  const free = [...right];
  let exact = 0;
  const unmatched: string[] = [];
  for (const word of left) {
    const at = free.indexOf(word);
    if (at >= 0) {
      free.splice(at, 1);
      exact++;
    } else {
      unmatched.push(word);
    }
  }
  for (const word of unmatched) {
    const at = free.findIndex((other) => sameWord(word, other));
    if (at < 0) return false;
    free.splice(at, 1);
  }
  return left.length === 1 || exact > 0;
}

/**
 * Only words that could pair are compared: the same number of words, each
 * starting with the same two letters. Keeps a Scale site's 1,200 keywords
 * from becoming 700,000 comparisons.
 */
function bucketOf(term: string): string {
  const words = tokens(term);
  return `${words.length}|${words.map((word) => word.slice(0, 2)).sort().join(" ")}`;
}

export type VariantRow = {
  term: string;
  volume: number | null;
  source?: string | null;
  /** Must stand for its group: an article or a planned topic already targets it. */
  pinned?: boolean;
};

/**
 * Which row of a group stands for it: one the customer typed (their wording
 * is theirs), then one an article already targets, then the most searched, then one with any measurement, then the
 * shortest, then alphabetical - so the answer never depends on input order.
 */
function better<T extends VariantRow>(a: T, b: T): T {
  const manual = (row: T) => (row.source === "manual" ? 2 : row.pinned ? 1 : 0);
  if (manual(a) !== manual(b)) return manual(a) > manual(b) ? a : b;
  const volume = (row: T) => row.volume ?? -1;
  if (volume(a) !== volume(b)) return volume(a) > volume(b) ? a : b;
  if (a.term.length !== b.term.length) return a.term.length < b.term.length ? a : b;
  return a.term <= b.term ? a : b;
}

/**
 * The rows with variants folded together: one per search, the best form of
 * each (`better`), in the input order of the kept rows. `mergedInto` maps
 * each dropped term to the term that stands for it.
 */
export function mergeVariants<T extends VariantRow>(rows: T[]): { kept: T[]; mergedInto: Map<string, string> } {
  const parent = rows.map((_, index) => index);
  const find = (index: number): number => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  };

  const buckets = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const key = bucketOf(row.term);
    buckets.set(key, [...(buckets.get(key) ?? []), index]);
  });
  for (const members of buckets.values()) {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = find(members[i]);
        const b = find(members[j]);
        if (a !== b && areVariants(rows[members[i]].term, rows[members[j]].term)) parent[b] = a;
      }
    }
  }

  const best = new Map<number, T>();
  rows.forEach((row, index) => {
    const root = find(index);
    const current = best.get(root);
    best.set(root, current ? better(current, row) : row);
  });

  const keptTerms = new Set([...best.values()].map((row) => row.term));
  const mergedInto = new Map<string, string>();
  rows.forEach((row, index) => {
    const winner = best.get(find(index))!;
    if (row.term !== winner.term) mergedInto.set(row.term, winner.term);
  });
  const seen = new Set<string>();
  const kept = rows.filter((row) => {
    if (!keptTerms.has(row.term) || seen.has(row.term)) return false;
    seen.add(row.term);
    return true;
  });
  return { kept, mergedInto };
}

/** The first existing keyword `term` is a variant of, or null. */
export function variantOf(term: string, existing: string[]): string | null {
  const key = bucketOf(term);
  return existing.find((other) => other !== term && bucketOf(other) === key && areVariants(term, other)) ?? null;
}
