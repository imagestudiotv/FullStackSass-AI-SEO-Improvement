/**
 * No dashes used as punctuation in what is written for a client (client,
 * 2026-11-24: "We don't want hypens gpt dashes in the generated articles").
 *
 * Two halves. NO_DASH_RULE goes into every writing prompt; what the model
 * writes anyway is cleaned here, deterministically, BEFORE the evidence check
 * and before anything is saved or hashed, so what is checked, reviewed and
 * published is one and the same text. Only new text goes through this: an
 * article that exists is never rewritten for it.
 *
 *  - a pair around an aside becomes two commas, a single one a comma - or a
 *    colon where that is plainly what it stood for: in a heading or title, after
 *    a bold term that opens its line, before a list after "these", "three", ...
 *  - a range keeps a plain hyphen (10-20, 2024-2026, Mon-Fri), and so does an
 *    en dash between two words (cost-benefit);
 *  - word hyphens (on-premises), suspended ones (two- and three-day), code,
 *    <pre>, addresses, attributes and comments are not touched;
 *  - never two punctuation marks in a row.
 *
 * Works on the text as it is written, not on a parsed document: everything
 * outside the dashes stays byte for byte the same. Pure; safe to run twice.
 */

export const NO_DASH_RULE =
  "Punctuation: never use an em dash or an en dash, or a hyphen with spaces around it, as punctuation - not in headings, tables, FAQ, titles or descriptions either. Use a comma, a colon, parentheses or a new sentence. Hyphens inside words (on-premises) stay, and a range of numbers takes a plain hyphen (10-20).";

type Options = {
  /** "title": a headline, where one dash stands for a colon. */
  kind?: "title" | "text";
  /** The language's name, as articles carry it ("French"): French puts a space before a colon. */
  language?: string | null;
};

/** A tag: transparent. */
const TAG = "\ue000";
/** Something that counts as a word and is never changed: code, an address. */
const KEPT = "\ue001";

const EM = "\u2014\u2015";
const EN = "\u2012\u2013";

const ENTITIES: [RegExp, string][] = [
  [/&(?:mdash|#8212|#x2014);/gi, "\u2014"],
  [/&(?:ndash|#8211|#x2013);/gi, "\u2013"],
  [/&(?:horbar|#8213|#x2015);/gi, "\u2015"],
];
const HARD_SPACED = new RegExp(`((?:&(?:nbsp|#160|#xa0|#8239|#x202f);|\\s)*)([${EM}${EN}]+|(?<=&nbsp;)-(?=&nbsp;))((?:&(?:nbsp|#160|#xa0|#8239|#x202f);|\\s)*)`, "gi");

/** Days and months, for "Monday to Friday" written with a dash, in the languages RepGet writes. */
const DATE_WORD = new RegExp(
  "^(?:" +
    [
      "mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?",
      "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?",
      "lunes|martes|miércoles|jueves|viernes|sábado|domingo|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre",
      "lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre",
      "lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica|gennaio|febbraio|aprile|maggio|giugno|luglio|settembre|ottobre|dicembre",
      "montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|januar|februar|märz|juni|juli|oktober|dezember|mo|di|mi|do|fr|sa|so",
    ].join("|") +
    ")\\.?$",
  "iu",
);

/** Words that join, so what follows is never introduced by a colon. */
const JOINS =
  /^(?:and|but|or|so|yet|nor|which|who|whose|where|when|while|because|if|as|though|although|not|even|especially|particularly|including|like|such|with|without|y|e|pero|o|u|que|quien|donde|cuando|porque|si|aunque|no|incluso|especialmente|como|con|sin|et|mais|ou|donc|qui|que|dont|où|car|si|même|surtout|comme|avec|sans|ma|che|chi|dove|quando|perché|se|anche|non|soprattutto|come|senza|und|aber|oder|also|der|die|das|wo|wenn|weil|obwohl|nicht|sogar|besonders|wie|mit|ohne)(?![\p{L}\p{N}])/iu;

/** Only the coordinating ones: after a headline or a term, "what" and "why" may follow a colon. */
const COORDINATES = /^(?:and|but|or|so|yet|nor|y|e|pero|o|u|et|mais|ou|donc|ma|und|aber|oder)(?![\p{L}\p{N}])/iu;

/** "these", "three", "following"... in the words just before: what follows is being listed. */
const LISTS =
  /(?:^|[^\p{L}\p{N}])(?:these|following|two|three|four|five|six|seven|[2-9]|estos|estas|siguientes|dos|tres|cuatro|cinco|seis|ces|suivants|suivantes|deux|trois|quatre|cinq|six|questi|queste|seguenti|due|tre|quattro|cinque|sei|diese|folgende|folgenden|zwei|drei|vier|fünf|sechs)(?![\p{L}\p{N}])/iu;

/** "a, b and c": two commas at least, or one and a joining word. */
const ENUMERATION = /,[^,.;:!?]+(?:,|[\s,](?:and|or|y|o|e|et|ou|und|oder)\s)/iu;

const DASH_ANY = `[${EM}${EN}]+|--+`;

/** Every dash that may be punctuation, with the spaces and tags around it. A lone hyphen needs a space on both sides. */
const CANDIDATE = new RegExp(`([\\s${TAG}]*)(${DASH_ANY}|(?<=\\s${TAG}*)-(?=${TAG}*\\s))([\\s${TAG}]*)`, "gu");

const spaces = (text: string) => /\s/.test(text);
const tagsIn = (text: string) => text.replace(new RegExp(`[^${TAG}]`, "g"), "");
const plain = (text: string) => text.replace(new RegExp(TAG, "g"), "");

const UNIT = "%|\u00b0[cf]?|\u20ac|\\$|\u00a3|km|kg|mg|cm|mm|ml|g|m|l|lbs?|oz|ft|in|mi|hrs?|h|mins?|ms|s|px|[kmgt]b|k|bn|am|pm|euros?|usd|eur|gbp|x";
const NUMBER = "\\d+(?:[.,:]\\d+)*";
const ENDS_WITH_NUMBER = new RegExp(`(${NUMBER})\\s?(?:${UNIT})?$`, "iu");
const STARTS_WITH_NUMBER = new RegExp(`^[\u20ac$\u00a3~]?\\s?(${NUMBER})`, "u");
/** A number and nothing that goes on from it: "20", "20 km", not "20 of them". */
const NUMBER_ALONE = new RegExp(`^[\u20ac$\u00a3~]?\\s?${NUMBER}\\s?(?:${UNIT})?\\s*(?:$|[.,;:!?)])`, "iu");

const value = (digits: string) => Number.parseFloat(digits.replace(":", ".").replace(/,(?=\d{3}(?!\d))/g, "").replace(",", "."));

/** The number a side ends or starts with, for "is this a range". */
function numberAtEnd(text: string): number | null {
  const match = ENDS_WITH_NUMBER.exec(text);
  return match ? value(match[1]) : null;
}
function numberAtStart(text: string): number | null {
  const match = STARTS_WITH_NUMBER.exec(text);
  return match ? value(match[1]) : null;
}

const lastWord = (text: string) => /([\p{L}.]+)$/u.exec(text)?.[1] ?? "";
const firstWord = (text: string) => /^([\p{L}]+\.?)/u.exec(text)?.[1] ?? "";

function isRange(left: string, right: string, spaced: boolean, em: boolean): boolean {
  if (DATE_WORD.test(lastWord(left)) && (DATE_WORD.test(firstWord(right)) || (!em && numberAtStart(right) !== null))) return true;
  const from = numberAtEnd(left);
  const to = numberAtStart(right);
  if (from === null || to === null) return false;
  // Without spaces two numbers are always a range; with them, only going up ("in 2024 then a dash and 3 of them" is not).
  if (!spaced) return true;
  return from < to && (!em || NUMBER_ALONE.test(right));
}

type Dash = { start: number; end: number; before: string; mark: string; after: string };

/** What one dash becomes, or null for "leave it". */
type Verdict = { kind: "range" } | { kind: "drop" } | { kind: "punctuation" } | { kind: "keep" } | { kind: "minus" };

function verdict(dash: Dash, left: string, right: string): Verdict {
  const { before, mark, after } = dash;
  const em = new RegExp(`[${EM}]`).test(mark) || /^--+$/.test(mark);
  const hyphen = mark === "-";
  const spaceBefore = spaces(before);
  const spaceAfter = spaces(after);

  // Alone in its block: an empty table cell's mark.
  if (!left && !right) return { kind: "range" };
  if (!left || !right) {
    // A minus sign before a number; a list's own hyphen at the start of a line.
    if (!left && !spaceAfter && !em && /^\d/.test(right)) return { kind: "minus" };
    if (hyphen || /^--+$/.test(mark)) return { kind: "keep" };
    return { kind: "drop" };
  }
  if (spaceBefore && !spaceAfter && !em && !hyphen && /^[\d\u20ac$\u00a3]/.test(right)) return { kind: "minus" };
  const spaced = spaceBefore || spaceAfter;
  if (isRange(left, right, spaced, em)) return { kind: "range" };
  // An en dash between two words is a relation (cost-benefit), not a pause.
  if (!spaced && !em) return { kind: "range" };
  // "--" inside something that is not words ("a--b" in a code-like token) has letters both sides: a pause.
  if (/^--+$/.test(mark) && !spaced && !(/[\p{L}\p{N}]$/u.test(left) && /^[\p{L}\p{N}]/u.test(right))) return { kind: "keep" };
  // Next to other punctuation the dash says nothing more.
  if (/[,;:.!?\u2026\u00bf\u00a1([]$/u.test(left) || /[.!?\u2026][\u201d\u2019"'\u00bb)]$/u.test(left)) return { kind: "drop" };
  if (/^[,;:.!?\u2026)\]]/u.test(right)) return { kind: "drop" };
  return { kind: "punctuation" };
}

/** The sentence a position stands in: from the last end of one to the next. */
function sentenceBounds(text: string, at: number): [number, number] {
  const before = text.slice(0, at);
  const starts = [...before.matchAll(/[.!?\u2026][\u201d\u2019"'\u00bb)]?[\s\ue000]+/gu)];
  const last = starts.at(-1);
  const start = last ? last.index + last[0].length : 0;
  const end = /[.!?\u2026][\u201d\u2019"'\u00bb)]?(?=[\s\ue000]|$)/u.exec(text.slice(at));
  return [start, end ? at + end.index : text.length];
}

const colon = (language: string | null | undefined) => (language && /^(?:fr|french|français)/i.test(language) ? "\u00a0:" : ":");

/** One run of text (a block, with its tags as TAG). `opensBold`: whether the tags say a bold term opens it. */
function cleanRun(run: string, options: Options & { boldEnd?: (tagsBefore: number) => boolean; listItem?: boolean }): string {
  const dashes: Dash[] = [...run.matchAll(CANDIDATE)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    before: match[1],
    mark: match[2],
    after: match[3],
  }));
  if (dashes.length === 0) return run;

  const left = (dash: Dash) => plain(run.slice(0, dash.start)).trimEnd();
  const right = (dash: Dash) => plain(run.slice(dash.end)).trimStart();
  const verdicts = dashes.map((dash) => verdict(dash, left(dash), right(dash)));

  let out = "";
  let at = 0;
  dashes.forEach((dash, i) => {
    out += run.slice(at, dash.start);
    at = dash.end;
    const tagsBefore = tagsIn(dash.before);
    const tagsAfter = tagsIn(dash.after);
    const what = verdicts[i];
    switch (what.kind) {
      case "keep":
        out += run.slice(dash.start, dash.end);
        return;
      case "range":
        out += `${tagsBefore}-${tagsAfter}`;
        return;
      case "minus":
        out += `${dash.before}-${tagsAfter}`;
        return;
      case "drop": {
        const edge = !left(dash) || !right(dash) || /^[,;:.!?\u2026)\]]/u.test(right(dash)) || /[([\u00bf\u00a1]$/u.test(left(dash));
        out += `${tagsBefore}${edge ? "" : " "}${tagsAfter}`;
        return;
      }
      case "punctuation": {
        const [from, to] = sentenceBounds(run, dash.start);
        const alone = dashes.every((other, j) => j === i || verdicts[j].kind !== "punctuation" || other.start < from || other.start >= to);
        const said = plain(run.slice(from, dash.start)).trim();
        const next = plain(run.slice(dash.end, to)).trim();
        const introduces =
          alone &&
          !/[:;]/.test(said) &&
          !next.includes(":") &&
          !COORDINATES.test(next) &&
          (options.kind === "title" ||
            Boolean(options.boldEnd?.(tagsIn(run.slice(0, dash.start) + dash.before).length)) ||
            Boolean(options.listItem && from === 0 && said.split(/\s+/).length <= 4) ||
            (!JOINS.test(next) && LISTS.test(said.split(/\s+/).slice(-6).join(" ")) && ENUMERATION.test(next)));
        out += `${tagsBefore}${introduces ? colon(options.language) : ","} ${tagsAfter}`;
        return;
      }
    }
  });
  return out + run.slice(at);
}

const ADDRESS = /(?:https?:\/\/|www\.)[^\s<]+|[^\s<@]+@[^\s<@]+\.[a-z]{2,}/gi;

function protect(text: string): { text: string; kept: string[] } {
  const kept: string[] = [];
  return {
    text: text.replace(ADDRESS, (address) => {
      kept.push(address);
      return KEPT;
    }),
    kept,
  };
}

/** Plain text: a title, a description, a picture's alt text. */
export function cleanDashes(input: string, options: Options = {}): string {
  const { text, kept } = protect(input.replace(/[\ue000\ue001]/g, ""));
  const cleaned = cleanRun(text, options);
  let i = 0;
  return cleaned.replace(/\ue001/g, () => kept[i++] ?? "");
}

const INLINE = new Set(["a", "abbr", "b", "cite", "em", "i", "ins", "del", "mark", "q", "s", "small", "span", "strong", "sub", "sup", "time", "u"]);
const TOKEN = /<!--[\s\S]*?-->|<(pre|code|kbd|samp|var|script|style|textarea|svg|math)\b(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>|<\/?[a-zA-Z!](?:"[^"]*"|'[^']*'|[^'">])*>/g;

/** An article's HTML: its text only, block by block, so an aside may begin before a link and end after it. */
export function cleanDashesHtml(html: string, options: { language?: string | null } = {}): string {
  const source = html.replace(/[\ue000\ue001]/g, "");
  let out = "";
  let run = "";
  /** What stands behind each TAG and KEPT of the run, in order. */
  let tags: string[] = [];
  let kept: string[] = [];
  let block = "";

  const flush = () => {
    if (run) {
      const cleaned = cleanRun(run, {
        kind: /^h[1-6]$/.test(block) ? "title" : "text",
        language: options.language,
        listItem: block === "li",
        // The run opens with a bold term, and its closing tag is the last one before the dash (or just after it).
        boldEnd: (count) => {
          if (!new RegExp(`^\\s*${TAG}`).test(run) || !/^<(?:strong|b)\b/i.test(tags[0] ?? "")) return false;
          const close = tags.findIndex((tag) => /^<\/(?:strong|b)\s*>/i.test(tag));
          return close === count - 1 || close === count;
        },
      });
      let t = 0;
      let k = 0;
      out += cleaned.replace(/[\ue000\ue001]/g, (mark) => (mark === TAG ? tags[t++] : kept[k++]) ?? "");
    }
    run = "";
    tags = [];
    kept = [];
  };
  const text = (raw: string) => {
    let value = raw;
    for (const [entity, dash] of ENTITIES) value = value.replace(entity, dash);
    // A hard space beside a dash is only there because of the dash.
    value = value.replace(HARD_SPACED, (_match, before: string, dash: string, after: string) => `${before ? " " : ""}${dash}${after ? " " : ""}`);
    const safe = protect(value);
    kept.push(...safe.kept);
    run += safe.text;
  };

  let at = 0;
  for (const match of source.matchAll(TOKEN)) {
    if (match.index > at) text(source.slice(at, match.index));
    at = match.index + match[0].length;
    const token = match[0];
    if (token.startsWith("<!--")) {
      tags.push(token);
      run += TAG;
      continue;
    }
    if (match[1]) {
      if (/^(?:pre|script|style|textarea|svg|math)$/i.test(match[1])) {
        flush();
        out += token;
      } else {
        kept.push(token);
        run += KEPT;
      }
      continue;
    }
    const name = /^<\/?([a-zA-Z0-9!]+)/.exec(token)?.[1].toLowerCase() ?? "";
    if (INLINE.has(name)) {
      tags.push(token);
      run += TAG;
      continue;
    }
    flush();
    out += token;
    block = token.startsWith("</") ? "" : name;
  }
  if (at < source.length) text(source.slice(at));
  flush();
  return out;
}
