# A customer's own articles, photos and languages

Added 2026-10-20. Image Studio asked that its autopilot articles be "of high quality, it should search for the actual blog posts first, and come with a new article idea", use "our current images" for the pictures and the featured image "and not generating new one", and come in its "other 2 additional languages: italian and spanish". Built for every WordPress customer; WordPress plugin 1.9.0.

## 1. The site inventory

Once a day (03:40 UTC, Inngest `refresh-site-inventories`), RepGet reads each paying customer's WordPress site through its public REST API. It reads the articles in every language (posts and custom article types, such as Image Studio's Editorial) and the media library (pictures with their alt text, title, caption and size). Code: `lib/sites/inventory.ts`; tables `site_posts`, `site_images`.

- At most 60 requests per site, 300 ms apart. A bot check or an error keeps the previous copy; a site without a public API is checked again after a week.
- Languages: the site's hreflang links (`websites.site_languages`), plus the WPML languages its plugin reports (below).
- Choosing "Use photos from my website" reads the site at once the first time.

## 2. Content plan: new ideas only

Research skips any keyword the site already covers: one RepGet wrote for that exact keyword, or a post whose title holds all the keyword's words when those words are at least half the title. The planner is also shown the site's existing titles and asked for new angles. Code: `lib/sites/covered*.ts`, `inngest/functions/research-keywords.ts`, `lib/keywords/calendar.ts`.

## 3. Pictures from the site's own library

Article Settings -> Images and branding -> **Where pictures come from**: *Make new pictures* (as before) or *Use photos from my website* (`websites.picture_source = 'library'`).

- For each new article, a cheap model picks the cover from up to 50 of the best-matching photos, and a photo for a section only when one truly shows it. It never picks a logo, an icon or a thumbnail, and never the same photo twice. It writes new alt text in the article's language. Code: `lib/sites/pictures.ts`; job step `choose-library-pictures`.
- When the library has nothing usable, a cover is made as before; a section gets no picture.
- Nothing is uploaded again (`lib/sites/library-media.ts`):
  - the plugin feed sends the cover's `attachmentId` and plugin 1.9.0 sets the featured image from it;
  - a direct connection checks the media item on the site (`findMedia`) and sets `featured_media` to it;
  - photos in the text carry WordPress's class `wp-image-<id>`, so WordPress serves its smaller sizes to phones.
  - The customer's photo itself is never changed.

## 4. Also publish in (translations)

Article Settings -> Writing and SEO -> **Also publish in** appears when the site publishes in more than one language. Each article that goes live **after** a language is ticked is translated into it and published there, linked to the original. Code: `lib/articles/translations.ts`, `lib/articles/translate-article.ts`, Inngest `translate-live-articles` (every 20 minutes).

- **Model and cost:** Claude Haiku 5.5, about $0.01-0.03 per article and language, recorded in `usage_events` (purpose `article_translation`). A translation does **not** count as one of the plan's articles: a released reservation of its own keeps it out of the article ledger.
- **When:** only once the original is live, from the text that went live. Only on a paid plan, and only for a site whose plugin is 1.9.0 or later. Articles live before the language was ticked are not translated.
- **Quality checks:** a translation that changes a heading id, list item, table row, picture or link is refused. Each article and language is tried at most 3 times, an hour apart, and every try is counted before it is paid for.
- **Saved as:** an article of its own (`articles.translation_of`, `language_code`), labelled "Translation (IT)" in the Articles list. The RepGet team's review applies to it as to any new draft.
- **Delivery:** only by the plugin, 1.9.0 or later, and only once the original's post exists.
  - A direct connection holds it (`translation_needs_plugin`), and a Publish press goes the plugin way.
  - Refresh refuses it.
  - English articles never link to a translation.
- **In WordPress (plugin 1.9.0, with WPML):**
  - The translation becomes a post of the original's content type, filed under its language in the original's translation group, so the language switcher offers it.
  - It gets the original's categories in that language when WPML has them.
  - Its links to the site's posts point at their versions in that language when those are published; other links stay as they are.
  - The plugin writes nothing, and tells RepGet why, when there is no WPML, the language is not one of the site's, or the original is not on the site. The same applies when the original already has a version in that language that RepGet did not write: a translation made by hand, or with Image Studio's ChatGPT Translate plugin, is never replaced.
- **Languages offered:** the site's hreflang languages, plus the WPML languages the plugin reports on every check (`X-RepGet-Languages`, stored in `websites.plugin_languages`). Image Studio's home page names only English and Italian, so Spanish is offered once plugin 1.9.0 has checked in.

Translations do not follow later edits to the original; edit a translation on its own page. A translation's Refresh is refused; refresh the original.

## Release (owner steps, in order)

1. **Migrate production** before the code goes out. The new code reads these columns:
   - `0069_site_inventory`
   - `0070_picture_source`
   - `0071_article_translations`
   - `0072_plugin_languages`
2. **Deploy** (push `main`).
3. **Inngest:** resync the app, so the two new functions are registered: `refresh-site-inventories` and `translate-live-articles`.
4. **Image Studio's plugin:** WordPress -> Plugins -> RepGet Connector -> update to **1.9.0**. RepGet's manifest offers the update; the zip is `public/repget-connector.zip`. The next check reports its WPML languages.
5. **Image Studio's settings** (RepGet -> the website -> Article Settings):
   - **Where pictures come from:** *Use photos from my website*, then Save. This reads the media library at once.
   - **Also publish in:** tick Italian and Spanish, then Save. Spanish appears after step 4.
6. **Check** after the first article goes live (read-only):
   - its Italian and Spanish versions appear in the Articles list within 20 minutes, then on the site, linked in WPML;
   - the cost is in `usage_events`;
   - the plan's article count did not change.
