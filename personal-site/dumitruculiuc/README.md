# dumitruculiuc.com

Dumitru Culiuc's personal site: one home page with a portrait you can grab and stretch, plus a blog. It's a small WordPress theme written for this site (`theme/dumitru`). Daniel edits the home page himself with **Elementor (the free version)**, using the theme's own "Dumitru" blocks. No paid plugin is needed. If Elementor is ever switched off, the site still works: the home page is then filled from *Appearance → Customize*.

The site deploys on its own, to Namecheap hosting. It has nothing to do with RepGet's Vercel build.

## What's here

| Path | What it is |
|---|---|
| `theme/dumitru/` | The WordPress theme, uploaded as a zip |
| `theme/dumitru/inc/sections.php` | The home page sections' markup, shared by Elementor and the Customizer fallback |
| `theme/dumitru/inc/elementor.php`, `inc/elementor/widgets.php` | The "Dumitru" Elementor widgets, the set-up button, and the footer/header values read from the Home page |
| `theme/dumitru/assets/js/portrait.js` | The grabbable portrait: a self-written WebGL engine with no libraries |
| `theme/dumitru/assets/images/portrait/` | Crops made from Daniel's photo (the original is not included) |
| `theme/dumitru/assets/fonts/` | Inter and Zalando Sans Expanded, self-hosted (SIL Open Font License, licence files alongside) |
| `tools/make-portrait.mjs` | Rebuilds the portrait crops from the original photo |
| `tools/prepare-expressions.mjs` | Lines AI-edited masters of the photo up with it and keeps only the part that changes (face or eyes) |
| `tools/make-expressions.mjs` | Builds the faces and the eye sheet (`assets/images/portrait/expressions/`) from the photos |
| `preview/portrait.html` | A stand-alone page to try the portrait locally |
| `preview/blueprint.json`, `preview/seed.php` | A local WordPress Playground preview with clearly marked **test** content. Never run on the live site |

## Requirements

- WordPress 6.4 or newer, PHP 7.4 or newer (Namecheap shared hosting has both).
- **Elementor** (free, from *Plugins → Add New*): for editing the home page. Elementor Pro is not needed.
- **Optional:**
  - **LiteSpeed Cache** (free): caching and image optimisation. The Namecheap server runs LiteSpeed.
  - **Yoast SEO** (free), only if wanted. The theme already prints a description, sharing tags and a Person record, and switches these off by itself when Yoast, Rank Math, SEOPress or All in One SEO is active, so nothing is printed twice.
- There is no newsletter (Daniel's decision). The theme's dormant newsletter code stays switched off.

## Install (about 20 minutes)

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
9. **Plugins → Add New:** search for **Elementor**, then *Install Now* and *Activate*. (If Elementor opens its welcome wizard, you can skip it.)
10. **Set up the home page:** go to *Dashboard* (or *Pages*). A box says "Edit your home page in Elementor". Click **Set up the home page in Elementor**. This puts all the home page sections into the Home page, in the right order. Anything already written in the Customizer or under *Projects* is copied in; everything else stays empty and hidden.
    - If the Home page already has content of its own, WordPress asks first. Click *Yes, replace it* only if that content can go.
11. **Posts:** write or import the real posts.
12. Daniel then fills in his texts himself (next section).

## Editing the content

**Everything on the home page is edited in one place: _Pages → Home → Edit with Elementor_.** Click a section on the page to see its fields on the left. Change them, then click **Publish** (or **Update**) at the bottom left.

The theme's sections are in the **"Dumitru"** group of Elementor's widget list (or type "dumitru" in its search box), in case one is deleted by mistake and needs adding back.

Every field starts empty, and **a section with nothing in it is hidden** on the live site. In the Elementor editor, a hidden section shows a dashed note instead, so it can still be clicked and filled in. Placeholder text can never go live by accident.

| On the page | Where to edit (in Elementor, on the Home page) |
|---|---|
| Your name (footer, portrait description, search engines) and the header label next to the small photo | *Intro and portrait* → *Your name (used on every page)* |
| "Hello! My name is **Dumitru**", the intro paragraphs | *Intro and portrait* → *Intro* |
| Speech bubble on the portrait ("Psst. Try RepGet →") | *Intro and portrait* → *Portrait*. It needs both the main line and an address |
| Link under the portrait | *Intro and portrait* → *Portrait* |
| "As featured in" | *As featured in*: add one item per real article (publication name + address) |
| Project cards and the logo strip | *Projects*: add one item per project (logo, name, description, address, "Big card" on or off, optional year and code). Drag items to reorder. While the list is empty, the projects from the admin menu **Projects** are shown instead |
| Projects title, note, "more projects" button | *Projects* |
| About: title, text, highlights, photo, caption | *About* |
| Blog list | Ordinary **Posts**. *Latest posts* sets the title and how many are shown (4 unless changed) |
| Email and social buttons in the footer of every page | *Contact and social*. It shows nothing on the home page itself; its values appear in the footer on every page after you click *Update* |
| Header tabs | Automatic (About, Blog), or *Appearance → Menus → "Header tabs"* |
| Light/dark | Visitors switch it; it follows their device until they do |

**What stays fixed:** the portrait itself (only its speech bubble and the link under it are editable), the section design and the page header and footer layout. Elementor's free version can't edit headers or footers, which is why the footer's email and links are entered in the *Contact and social* section on the Home page.

**Only if Elementor is switched off:** the home page then uses *Appearance → Customize → Home page* and the admin menu **Projects** instead. Those fields are only a fallback; once the home page is built with Elementor, change things in Elementor.

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
   - change one word on the Home page in Elementor, click *Update*, and check it on the live page
5. **Search engines:** after launch, add the site to Google Search Console and submit `https://dumitruculiuc.com/wp-sitemap.xml`.

## Rollback

- **Theme problem:** *Appearance → Themes*, activate a default theme (e.g. Twenty Twenty-Five). Content and settings stay.
- **Elementor problem:** *Plugins*, deactivate Elementor. The home page falls back to the Customizer texts by itself; the Elementor content stays saved for when it is switched back on.
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

**Expressions** (theme 1.3.0; 1.3.1 sharpens the face changes), from AI edits of `Dumitru Culiuc Founder RepGet.png` (535x486):
- his eyes follow the pointer anywhere on the page in 8 directions, and come back to the visitor 2 s after it stops; looking down, the lids come down too
- he blinks (sometimes twice)
- hovered: a strong annoyed frown; held: a grimace; let go, clicked or poked: shock
- shaken hard (a big drag) or poked three times in quick succession: dizzy, eyes rolled up and tongue out
- **When nobody has moved for a while:**
  - he dozes off, head sinking, and wakes with a start
  - he yawns (opening, the big moment with the head tipping back, closing)
  - he whistles a tune with notes, glancing one way then the other
  - he winks
  - a fly buzzes around him while his eyes follow it, lands on his nose (cross-eyed), and he grimaces, shakes his head and blows it away
- Any movement, key or scroll ends the act at once (its fly and notes too). A reaction to being handled shows over the hover face.
- Every change cross-fades from whatever is on screen, so interrupting one never jumps or flashes back to the plain face. The eyes and the mouth swap in a frame or so half-way through, so two mouths never show at once.
- **Reduced motion:** no fly, notes, head movement or hint; the faces still change.
- **Loading:** the plain photo first; then the eyes and the faces for hover, holding, shock and dizzy; the idle faces only when an idle act first wants them, one at a time.
- **Off screen or in a background tab:** whatever he was doing stops, and drawing stops.

Which photo plays which part is `FACE_ROLES` at the top of `portrait.js`. Every photo is optional: a part with no photo is left out.

**Development controls:** add `?dcportrait=dev` to the page URL. Nothing then happens at random (no idle acts, blinks or hint), and a panel triggers every face, eye, gaze direction, act and reaction, or **replay all** (every expression, transition and interruption in a fixed order). The same is available to scripts as `DCPortrait.instances[0].dev` (`replay()`, `mood.run("yawn")`, `mood.show(face, eyes, ms)`, `mood.gaze("ne")`, `drag(dx, dy, ms)`, `poke()`, `state()`).

**Making the expression photos** (photos folder: `dumitru-expressions/`, kept outside git):
1. `rest.png` is the unedited 535x486 photo. Real photos of the same size edited from it go next to it, named after their part (`smile`, `laugh`, `wink`, `shock`, `ouch`, `closed`).
2. AI-edited masters (any size, same framing) go into `masters/`, never changed by the tools. `PLAN` in `tools/prepare-expressions.mjs` says what each prepared photo takes from which master: the face from the brows to the chin (annoyed, dizzy, yawn-1/2/3, whistle-1/2, blow) or only the eyes and lids (look-n/ne/e/se/s/sw/w/nw, half and drowsy from the yawns, fly-cross from look-se and look-sw).
3. `node tools/prepare-expressions.mjs "<photos folder>" <folder with sharp installed>` lines each master up with `rest.png` on what does not move (hair, ears, forehead, nose), matches colour and sharpness at the edge, and writes `prepared/<name>.png` and `prepared/prepared.json` (the fit of each). A master that does not line up or blend in is rejected and listed; check new ones by eye.
4. `node tools/make-expressions.mjs "<photos folder>" <folder with sharp installed>` builds the theme's set from the photos and `prepared/`. It checks every input first and builds in a staging folder: a failed run leaves the current set untouched. Files are stamped with a content hash.
5. Bump `DUMITRU_VERSION` so visitors' browsers fetch the new manifest.

**Not included, needs a decision:** the squeak sound. It needs a licensed or self-recorded sound, and should stay off by default.
