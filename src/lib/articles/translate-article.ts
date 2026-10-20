import "server-only";

import * as cheerio from "cheerio";

import { MODELS } from "@/lib/ai/client";
import { addUsage, askClaude, type CallUsage } from "@/lib/blog/autopilot/model";
import { bodySlices } from "@/lib/blog/autopilot/translate";

/**
 * One customer article in another language (client, 2026-10-20, Image
 * Studio: Italian and Spanish next to English) - the text only; saving it
 * and sending it are lib/articles/translations.ts.
 *
 * Claude Haiku 5.5 (MODELS.ARTICLE_TRANSLATION), as for RepGet's own blog:
 * the title, slug, description and cover's alt text in one call, then the
 * body in the parts it was written in (bodySlices). A part that loses or
 * changes a heading, list, table row, picture, link or heading id is refused
 * - the article would break on the site - and the whole translation with it.
 * The links stay exactly as written; the WordPress plugin points those to
 * the site's own posts at their versions in this language.
 */

export type ArticleToTranslate = {
  title: string;
  slug: string | null;
  metaDescription: string | null;
  imageAlt: string | null;
  bodyHtml: string;
  /** Language names as articles are written in them: "English", "Italian". */
  from: string;
  to: string;
  /** The website's own hosts: its links may change form ("/x" or "https://www.site/x/") but never place. */
  siteHosts: ReadonlySet<string>;
};

export type TranslatedArticle = {
  title: string;
  slug: string;
  metaDescription: string | null;
  imageAlt: string | null;
  bodyHtml: string;
  usage: CallUsage & { calls: number };
};

/** A translation refused or failed, with what its calls cost before it stopped. */
export class TranslationError extends Error {
  constructor(message: string, readonly usage: CallUsage & { calls: number }) {
    super(message);
    this.name = "TranslationError";
  }
}

const STRING = { type: "string" };

function instructions(from: string, to: string): string {
  return [
    `You translate articles published on a business's own website from ${from} into ${to}.`,
    `Write as a native ${to} copywriter working for that business would: natural and fluent, with the same meaning, facts, tone and level of detail. Add nothing and leave nothing out.`,
    `Keep the names of people, businesses, brands and products as they are. A place keeps its name unless it has a usual ${to} one (for example "Lake Como" is "Lago di Como" in Italian).`,
    `Use the words people searching in ${to} would use for the same thing. Address the reader as the original does, in the form a ${to} business website would use for its readers.`,
    "HTML: keep every tag and attribute exactly as given, in the same order. Translate only the text between tags and the alt and title attributes of pictures. Never change an href, src, id or class. Keep every heading, paragraph, list, list item, table row, picture and link: the same number, in the same places.",
  ].join("\n");
}

/** A short ASCII address from `text`: lower case, words joined by hyphens, at most 80 characters. */
export function slugFrom(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= 80) return slug;
  const cut = slug.slice(0, 81);
  const at = cut.lastIndexOf("-");
  return (at > 0 ? cut.slice(0, at) : slug.slice(0, 80)).replace(/-+$/, "");
}

/** One address however it is written, when it is on the website; any other address exactly as written. */
function addressKey(href: string, siteHosts: ReadonlySet<string>): string {
  try {
    const url = new URL(href, "https://site.invalid");
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const own = url.hostname === "site.invalid" || [...siteHosts].some((known) => known.toLowerCase().replace(/^www\./, "") === host);
    if (!own) return href;
    return `site:${url.pathname.replace(/(.)\/+$/, "$1")}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}

const KEPT = ["h2", "h3", "h4", "p", "table", "tr", "img", "a", "ul", "ol", "li", "figure"];

/** What a translation must keep: its structure, every heading id, every picture and link. */
export function skeleton(html: string, siteHosts: ReadonlySet<string>): string {
  const $ = cheerio.load(html, null, false);
  const counts = KEPT.map((tag) => `${tag}:${$(tag).length}`).join(" ");
  const ids = $("[id]").toArray().map((el) => $(el).attr("id") ?? "").sort();
  const addresses = [
    ...$("a").toArray().map((el) => addressKey($(el).attr("href") ?? "", siteHosts)),
    ...$("img").toArray().map((el) => $(el).attr("src") ?? ""),
  ].sort();
  return [counts, ids.join(","), addresses.join("\n")].join("\n--\n");
}

/** The translation's links written exactly as the original wrote them (they may differ only in form). */
function restoreAddresses(original: string, translated: string, siteHosts: ReadonlySet<string>): string {
  const $original = cheerio.load(original, null, false);
  const written = new Map($original("a").toArray().map((el) => [addressKey($original(el).attr("href") ?? "", siteHosts), $original(el).attr("href") ?? ""]));
  const $ = cheerio.load(translated, null, false);
  let changed = false;
  for (const el of $("a").toArray()) {
    const href = $(el).attr("href") ?? "";
    const exact = written.get(addressKey(href, siteHosts));
    if (exact === undefined || exact === href) continue;
    $(el).attr("href", exact);
    changed = true;
  }
  return changed ? $.html() : translated;
}

const wrap = (tag: string, text: string) => `<${tag}>\n${text}\n</${tag}>`;

export async function translateArticle(article: ArticleToTranslate): Promise<TranslatedArticle> {
  const system = instructions(article.from, article.to);
  const usages: CallUsage[] = [];
  const fail = (message: string): never => {
    throw new TranslationError(message, addUsage(usages));
  };

  try {
    const fields = await askClaude({
      system,
      cache: true,
      request: [
        wrap("title", article.title),
        article.metaDescription ? wrap("description", article.metaDescription) : "",
        article.imageAlt ? wrap("picture_alt", article.imageAlt) : "",
        "",
        `Translate the article's title, its search description (at most 160 characters) and its cover picture's alt text into ${article.to}.`,
        `Also give slug: the translated title's main words as a web address in ${article.to} - lower case, without accents, words joined by hyphens, at most 6 words.`,
        "Leave a field empty when it was not given.",
      ]
        .filter(Boolean)
        .join("\n"),
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { title: STRING, slug: STRING, description: STRING, pictureAlt: STRING },
        required: ["title", "slug", "description", "pictureAlt"],
      },
      effort: "low",
      model: MODELS.ARTICLE_TRANSLATION,
    });
    usages.push(fields.usage);
    const title = String(fields.value.title ?? "").trim();
    if (!title) fail(`The ${article.to} translation came back without a title.`);
    const description = String(fields.value.description ?? "").trim();
    const pictureAlt = String(fields.value.pictureAlt ?? "").trim();
    const slug = slugFrom(String(fields.value.slug ?? "")) || slugFrom(title);

    const parts: string[] = [];
    for (const part of bodySlices(article.bodyHtml)) {
      if (!part.trim()) {
        parts.push(part);
        continue;
      }
      const answer = await askClaude({
        system,
        cache: true,
        request: [
          wrap("html_part", part),
          "",
          `Translate this part of the article's body into ${article.to}, keeping its HTML exactly. The article's ${article.to} title is: ${title}`,
          "Return the HTML in bodyHtml.",
        ].join("\n"),
        schema: { type: "object", additionalProperties: false, properties: { bodyHtml: STRING }, required: ["bodyHtml"] },
        effort: "medium",
        model: MODELS.ARTICLE_TRANSLATION,
      });
      usages.push(answer.usage);
      const translated = String(answer.value.bodyHtml ?? "").trim();
      if (skeleton(part, article.siteHosts) !== skeleton(translated, article.siteHosts)) {
        fail(`The ${article.to} translation changed the article's headings, lists, tables, pictures or links.`);
      }
      parts.push(restoreAddresses(part, translated, article.siteHosts));
    }

    return {
      title,
      slug,
      metaDescription: article.metaDescription ? description || null : null,
      imageAlt: article.imageAlt ? pictureAlt || null : null,
      bodyHtml: parts.join("\n"),
      usage: addUsage(usages),
    };
  } catch (error) {
    if (error instanceof TranslationError) throw error;
    throw new TranslationError(error instanceof Error ? error.message : "The translation failed.", addUsage(usages));
  }
}
