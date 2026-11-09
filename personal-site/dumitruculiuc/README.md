# dumitruculiuc.com

Dumitru Culiuc's personal site: one home page with a portrait you can grab and stretch, plus a blog. It's a small WordPress theme written for this site (`theme/dumitru`). It needs no page builder and no paid plugin.

The site deploys on its own, to Namecheap hosting. It has nothing to do with RepGet's Vercel build.

## What's here

| Path | What it is |
|---|---|
| `theme/dumitru/` | The WordPress theme, uploaded as a zip |
| `theme/dumitru/assets/js/portrait.js` | The grabbable portrait: a self-written WebGL engine with no libraries |
| `theme/dumitru/assets/images/portrait/` | Crops made from Daniel's photo (the original is not included) |
| `theme/dumitru/assets/fonts/` | Inter and Zalando Sans Expanded, self-hosted (SIL Open Font License, licence files alongside) |
| `tools/make-portrait.mjs` | Rebuilds the portrait crops from the original photo |
| `preview/portrait.html` | A stand-alone page to try the portrait locally |
| `preview/blueprint.json`, `preview/seed.php` | A local WordPress Playground preview with clearly marked **test** content. Never run on the live site |

## Requirements

- WordPress 6.4 or newer, PHP 7.4 or newer (Namecheap shared hosting has both).
- **No plugin is required.**
- **Optional:**
  - **LiteSpeed Cache** (free): caching and image optimisation. The Namecheap server runs LiteSpeed.
  - **A newsletter plugin**, only if Daniel wants a newsletter, e.g. MailPoet (free tier).
  - **Yoast SEO** (free), only if wanted. The theme already prints a description, sharing tags and a Person record, and switches these off by itself when Yoast, Rank Math, SEOPress or All in One SEO is active, so nothing is printed twice.
  - **Elementor (free)**, for building *other* pages. The home page is edited in the Customizer (below).

## Install (about 15 minutes)

1. **Make the theme zip.** From the repository root:
   `git archive --format=zip --prefix=dumitru/ HEAD:personal-site/dumitruculiuc/theme/dumitru -o dumitru.zip`
2. **Install WordPress** in cPanel → *Softaculous* → *WordPress*. Choose the domain `dumitruculiuc.com` and leave the directory **empty** (root). Use a new admin username and a strong password. Softaculous replaces the parking page; the mail DNS records are not touched.
3. In WordPress, go to *Appearance → Themes → Add New → Upload Theme*, choose `dumitru.zip`, then **Activate**.
4. **Settings → Permalinks:** choose *Post name*, then Save.
5. **Pages → Add New:** create an empty page **Home** and an empty page **Blog**.
6. **Settings → Reading:**
   - *Your homepage displays* → *A static page*
   - Homepage → **Home**
   - Posts page → **Blog**
7. **Settings → General:** set the *Site Title* to "Dumitru Culiuc" and the *Tagline* to one real sentence. The tagline becomes the home page's search description.
8. **Settings → Discussion:** turn comments on or off as Daniel prefers.
9. **Appearance → Customize → Home page:** fill in the texts and links (next section).
10. **Projects → Add project:** add RepGet, Image Studio and others.
11. **Posts:** write or import the real posts.

## Editing the content

Every field starts empty, and **a section with nothing in it is hidden**. Placeholder text can never go live by accident.

| On the page | Where to edit |
|---|---|
| Header label (next to the avatar) | Customize → Home page → *Name and header* |
| "Hello! My name is **Dumitru**", the intro paragraphs | *Intro and portrait* |
| Speech bubble on the portrait ("Psst. Try RepGet →") | *Intro and portrait*. It needs both the main line and an address |
| Link under the portrait | *Intro and portrait* |
| "As featured in" | *As featured in*, one line per real article: `Name \| https://…` |
| Project cards and the logo strip | Admin menu **Projects** (logo = "Logo" box, description = "Excerpt", tick "big card" for the top row, order = "Order") |
| Projects title, note, "more projects" button | *Projects section* |
| About: title, text, highlights, photo, caption | *About* |
| Newsletter (3 places) | *Newsletter*. See below |
| Blog list | Ordinary **Posts**. The home page shows the latest 4 |
| Email and social buttons in the footer | *Contact and social links* |
| Header tabs | Automatic (About, Blog), or *Appearance → Menus → "Header tabs"* |
| Light/dark | Visitors switch it; it follows their device until they do |

**Newsletter.** The forms appear only when a newsletter plugin is really connected:
1. Install the newsletter plugin.
2. Create a form in it and copy its shortcode, e.g. `[mailpoet_form id="1"]`.
3. Paste the shortcode into Customize → *Newsletter*, tick *Show the newsletter forms*, and fill in the titles.
4. Test one sign-up with a real address.

**The portrait anywhere else:** the shortcode `[dumitru_portrait width="320"]` (in Elementor, use the free *Shortcode* widget).

**Changing the photo:**
1. Run `node tools/make-portrait.mjs "<new photo.png>" <folder with sharp installed>`.
2. If the face sits somewhere else in the new photo, adjust `CROP` in the tool, and the circle/head numbers at the top of `portrait.js` and `portrait.css`.

## Deployment plan

1. **Backup.** The domain shows Namecheap's parking page today (checked 2026-11-07), so there is no site to lose. If Softaculous reports an existing install, back it up from cPanel first and stop to ask.
2. **DNS: no change.** The domain already points at the hosting (`dns1/dns2.namecheaphosting.com`, A `162.0.232.126`). Leave the MX (`mx1–3-hosting.jellyfish.systems`) and SPF records alone; they carry the email.
3. **SSL:** already valid (SSL.com, until 22 May 2027, renewed by cPanel AutoSSL). After installing, check that *Settings → General* shows `https://` in both addresses.
4. **Install** as above, then check on a phone and a computer:
   - grab the face
   - scroll over the portrait
   - open the blog and one post
   - switch light/dark
   - the footer links
5. **Search engines:** after launch, add the site to Google Search Console and submit `https://dumitruculiuc.com/wp-sitemap.xml`.

## Rollback

- **Theme problem:** *Appearance → Themes*, activate a default theme (e.g. Twenty Twenty-Five). Content and settings stay.
- **Whole site:** in Softaculous, remove the installation (or restore the backup from step 1). The domain then shows the hosting's default page again, and DNS and email are untouched.
- **Earlier theme version:** upload the earlier `dumitru.zip` and choose *Replace current with uploaded*.

## Portrait: what it does, and what needs more photos

**Done**, from the one supplied photo:
- grab anywhere on the face with a mouse or finger and stretch it in any direction; the skin around the hand comes along, limited so it never tears
- a spring/wobble back on release, and the head leaning toward the pull
- the head can leave the circle while the body stays inside it
- a light mouse "half-hold" on hover
- a tap pokes
- the keyboard "Poke" button
- a one-time phantom-hand cheek tug as a hint
- faked lighting on stretched skin
- **Phones:** a vertical swipe scrolls the page; a sideways pull or a long press grabs.
- **Reduced motion:** no wobble and no hint animation.
- **Without JavaScript or WebGL:** the plain photo.
- **Efficiency:** drawing stops when he is still or off screen; the WebGL context is released and rebuilt if the phone takes it away.

**Needs extra photos from Daniel** (same framing and light):
- **Changing expressions** while held, pulled or let go: smile, surprised, laughing, annoyed.
- **Eyes that follow the cursor, and blinking:** eyes looking left, right, up and down, closed, and half closed.
- **Idle acts that need those faces:** yawn, whistle, dozing off.

**Not included, needs a decision:** the squeak sound. It needs a licensed or self-recorded sound, and should stay off by default.
