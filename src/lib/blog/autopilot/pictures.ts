import "server-only";

import * as cheerio from "cheerio";
import sharp from "sharp";

import { LANGUAGE_NAMES_EN } from "@/lib/blog/locale";
import type { Locale } from "@/lib/i18n/config";
import { generateOpenAiImage, isOpenAiImageConfigured } from "@/lib/images/generate";
import { isImageStorageConfigured, storeArticleImage } from "@/lib/images/storage";

/**
 * The autopilot's pictures (client's choice 4: made for every article, text
 * in them allowed): two diagrams per article, like the ones the blog's posts
 * carry - a headline, a few cards or steps with simple icons and short
 * labels, pastel colours on white, about twice as wide as tall.
 *
 * The writer's plan says what each one shows and every word in it
 * (lib/blog/autopilot/write.ts PictureIdea). Each language gets its own,
 * with its words translated (lib/blog/autopilot/translate.ts), so an
 * Italian reader never meets an English diagram.
 *
 * OpenAI's image model, because the words have to be legible: at medium
 * quality since 2026-10-18 (client: about a quarter of the cost of high,
 * roughly $0.05 a picture instead of $0.19). Without it -
 * or without image storage - the article is written without pictures and
 * the run says so; a picture that fails never fails the article.
 */

/** Medium (client, 2026-10-18). "high" gives the crispest small labels at about four times the cost. */
const QUALITY = "medium";

/** What one picture says, in one language. */
export type PictureBrief = { title: string; idea: string; labels: string[]; alt: string };

export type MadePicture = { url: string; alt: string; width: number; height: number; costUsd: number };

export function canMakePictures(): boolean {
  return isOpenAiImageConfigured() && isImageStorageConfigured();
}

const quoted = (text: string) => `"${text.replace(/"/g, "'")}"`;

/** The image model's brief: the blog's diagram look, what it shows, and every word in it. */
export function picturePrompt(brief: PictureBrief, locale: Locale): string {
  const language = LANGUAGE_NAMES_EN[locale];
  return [
    "A clean, modern infographic diagram for a blog about SEO for small businesses, in a wide landscape format.",
    "Look: a white background fading to a very light blue, soft pastel accents (blue, green, orange, purple), rounded cards with subtle shadows, simple flat icons, dark navy text in a crisp sans-serif typeface like Inter. Plenty of white space; comfortable margins so nothing touches the edges.",
    `What it shows: ${brief.idea}`,
    `Headline at the top, large: ${quoted(brief.title)}.`,
    brief.labels.length ? `The other text in it, each spelled exactly as written: ${brief.labels.map(quoted).join("; ")}.` : "",
    `All text is in ${language}, correctly spelled. Use no other words.`,
    "No logos, brand marks, watermarks, photographs or people.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Makes one picture and stores it with the blog's pictures in that language (blog/posts/<locale>/). */
export async function makePicture(brief: PictureBrief, locale: Locale): Promise<MadePicture> {
  const generated = await generateOpenAiImage(picturePrompt(brief, locale), QUALITY);
  // WebP, like the blog's own pictures: a fraction of the PNG, and every browser shows it.
  const image = sharp(generated.data, { limitInputPixels: 40_000_000, failOn: "error" }).rotate();
  const { data, info } = await image.webp({ quality: 88 }).toBuffer({ resolveWithObject: true });
  if (!info.width || !info.height) throw new Error("The picture came back empty");
  const url = await storeArticleImage("blog", `posts/${locale}`, data, "image/webp");
  return { url, alt: brief.alt, width: info.width, height: info.height, costUsd: generated.costUsd };
}

const escapeAttribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Puts each picture in the section it illustrates (`section`, from 1): after
 * the section's first table when it has one - the diagram sums the table up -
 * else before its first subheading, else at its end. Never inside a table.
 */
export function placePictures(html: string, pictures: (Pick<MadePicture, "url" | "alt" | "width" | "height"> & { section: number })[]): string {
  const $ = cheerio.load(html, null, false);
  const h2s = $("h2").toArray();
  for (const picture of pictures) {
    const heading = h2s[picture.section - 1];
    if (!heading || !/^https:\/\//i.test(picture.url)) continue;
    const tag = `<img src="${escapeAttribute(picture.url)}" alt="${escapeAttribute(picture.alt)}" width="${picture.width}" height="${picture.height}" />`;
    // The section: everything after its heading up to the next <h2>.
    const section = $(heading).nextUntil("h2");
    const table = section.filter("table").first();
    const subheading = section.filter("h3").first();
    if (table.length) table.after(tag);
    else if (subheading.length) subheading.before(tag);
    else if (section.length) section.last().after(tag);
    else $(heading).after(tag);
  }
  return $.html();
}
