# Image Studio header v3: see-through over photos in light mode

Not installed. Nothing here was run on imagestudio.com.

## What changes

Night Mode paints every header bar solid white in light mode, also over the homepage's video. With this snippet, in light mode:

- **Home, Commercial, Social Media, Music Video, Film Production, AI Production, Wedding Photographer, Podcast, Drone, Reel, Wedding Videographer:** at the top of the page the bar is see-through, with the white logo and white words, as in dark mode. Computers and phones (767px and narrower).
- **After scrolling, with the pointer or keyboard focus in the bar, with Services open, or with the phone menu open:** solid white with dark words, exactly as today.
- **Every other page keeps the white bar:** About, Academy, Contact, Editorial, Shop, Wedding, Wedding Content Creator, articles, products, cart, account and the checkout with its "Secure Checkout" header. Their tops are white or a photo grid with white gaps, where white words could not be read.
- **Tablets (768 to 1024px):** unchanged. Their bar is solid in dark mode too.
- **Italian and Spanish:** unchanged. The snippet lists English page ids only. Checked with public page requests on 2026-11-06: the Italian versions have their own page ids (home 5944, Commercial 6568, Social Media 6729, Music Video 6732, Film Production 6565, AI Production 6737, Wedding Photographer 6853) and their own header, solid in dark mode too. Podcast, Drone, Reel and Wedding Videographer have no Italian page. None of these pages has a Spanish version: `/es/` and these addresses under it answer 404. A translation added later stays out until its id is added.
- **Dark mode:** unchanged.

The repo copy of this snippet lives at `wordpress-plugin/imagestudio-snippets/header/`.

## Install (5 minutes)

This adds one snippet. The two existing snippets, "ISX header consistency", are not edited, and they must stay active: the phone rules use the class their script sets.

1. Back up: Settings, UpdraftPlus Backups, Backup Now (or MyKinsta, Backups, Manual).
2. Code Snippets (WPCode), + Add Snippet, Add Your Custom Code (New Snippet).
3. Title: `ISX header light hero - CSS`. Code Type: **CSS Snippet**.
4. Paste the whole of `v3/isx-header-light-hero.css`. Its first lines must read `SEE-THROUGH HEADER OVER PHOTOS IN LIGHT MODE   v1.0`.
5. Insertion: **Auto Insert**, Location: **Site Wide Header**. Save, switch to **Active**, save again.
6. Clear the caches: Clear Caches (Kinsta), WP Rocket's "Clear and Preload" **and "Clear Used CSS"**, and Cloudflare if used.
7. Open the homepage while logged in as an administrator, and each page in the list once. Night Mode prepares its look again on such a visit.

## Check (5 minutes)

In a private window, in light mode (the moon button shows), on a computer and on a phone:

| Page | Top of page | After scrolling | Menu |
|---|---|---|---|
| Home, Commercial, Podcast | see-through, white logo and words | solid white, dark logo and words | Services or phone menu: solid white, readable |
| About, Contact, Shop | white bar, as today | as today | as today |
| Checkout, with a product in the cart | white bar, logo and "Secure Checkout", as today | as today | no menu |

Press the moon: dark mode looks as it did. Check that the page does not flash a white bar for long on a phone: the phone rule starts when the header's script has run.

If the bar stays solid on a page other than the homepage after the caches were cleared, WP Rocket has dropped the rules: add `isx-` to its CSS safelist (WP Rocket, File Optimization, Remove Unused CSS, CSS safelist), and clear Used CSS again.

## Undo (1 minute)

WPCode, switch `ISX header light hero - CSS` to **Inactive**, clear the caches. Nothing else changed.

## Later

- **Add a page:** in Elementor give its first (photo) container the CSS class `isx-hero-top`.
- **Keep a page out:** give any element on it the CSS class `isx-solid-top`.
