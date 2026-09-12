# Brand assets

The originals everything in `public/` is generated from. Kept so a future
size can be produced from the source rather than by upscaling a favicon.

| File | Size | Notes |
| --- | --- | --- |
| `repget-logo-source.png` | 2757x690 | Horizontal lockup: mark + wordmark, transparent |
| `repget-mark-source.png` | 390x436 | Mark only, transparent. **Not square**, despite the original filename saying 512 |

## What is generated, and why

`public/` holds the literal paths, not Next's `app/` icon convention. That
convention serves icons from hashed URLs (`/icon?abc123`) which change
whenever the file does; Google asks specifically that a favicon URL stay put.
These paths are permanent, and `src/app/layout.tsx` declares them explicitly.

| Output | From | Notes |
| --- | --- | --- |
| `public/favicon.ico` | mark | 16/32/48. No 256: it tripled the file for a size no tab bar requests |
| `public/icon-48.png` | mark | The size Google's guidance asks for |
| `public/icon-192.png` | mark | Android home screen |
| `public/icon-512.png` | mark | Manifest, install prompts |
| `public/apple-touch-icon.png` | mark | 180x180, **white ground** — iOS composites transparency on black |
| `public/images/repget-logo.png` | lockup | Light theme |
| `public/images/repget-logo-light.png` | lockup | Dark theme: only the near-black wordmark pixels are lightened, so the orange mark is untouched |
| `public/images/repget-mark.png` | mark | 256x256, for space too narrow for the wordmark |

The mark source fills its canvas edge to edge, so every square output centres
it at 86% on a transparent canvas. An icon touching its own bounds looks
cropped once a browser or OS rounds the corners.

Brand orange is `#fd9202`, sampled from the mark and used as the manifest
`theme_color`.

## Regenerating

There is no script: this ran once. If the brand changes, regenerate from the
sources above and keep the output paths identical — changing a favicon URL
costs the crawl history attached to it.
