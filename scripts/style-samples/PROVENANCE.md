# Image-style examples: where they come from

The eight examples on Article Settings (`public/style-samples/`) were made on
2026-10-03 by `scripts/style-samples/build.mjs`. No image model and no paid
service was used. They illustrate what each style means. They are **not**
output from the production image model, so no screen should call them that.

All eight show the same subject, a bright studio desk by a large window, so
the cards compare styles rather than scenes. Each one is 16:9, the shape of
the production article image (1280 x 720). There are two files per style:
`<name>.webp` is the 640 x 360 card image, and `<name>-large.webp` is the
1280 x 720 image shown in the enlarged preview.

| Files | Style | Source |
|---|---|---|
| `body-sketch`, `featured-sketch` | Sketch | Original artwork. The scene in `scene.mjs` is drawn as a coloured sketch in `media.mjs`: sepia ink linework drawn twice with a hand wobble, soft warm colour set slightly off the lines, hatched shadows, and textured paper. |
| `body-watercolour`, `featured-watercolour` | Watercolour | Original artwork, the same scene. Vivid transparent washes with bled edges, darker drying rims, uneven pooling, streaky brushwork and granulation. The whites are left as bare paper, and there is a faint pencil underdrawing. |
| `body-illustration`, `featured-illustration` | Illustration | Original artwork, the same scene. Flat vector shapes in a limited palette, with no gradients and no texture. |
| `body-realistic` | Realistic | Photograph by **Christian Mackie** on Unsplash, "Apple laptop in a dark home office with bright windows": https://unsplash.com/photos/lDlU1zbjGQA. It is used under the [Unsplash License](https://unsplash.com/license) (free for commercial use, attribution not required), and cropped to 16:9. |
| `body-brand-text` | Brand & Text | Photograph by **Samantha Gades** on Unsplash, "White desk lamp beside green plant": https://unsplash.com/photos/BlIhVfXbi9s, under the [Unsplash License](https://unsplash.com/license). It is cropped to 16:9 with a flat deep-blue panel along the left edge. |

There is **no text in the Brand & Text image, deliberately.** That matches
what production asks the model for: the prompt in
`src/lib/websites/article-options.ts` requests "a bold flat colour panel …
leaving clear empty space in that panel" and ends with "No text". As of this
date no code sets a headline over the picture, and the stored brand colour is
not passed to the model.

Featured ("cover") examples use the same scene recomposed as a centred still
life (desk, notebook, lamp, plant, mug against the window), with space above
and below. That follows the production cover rule ("keep the main subject
centred, with space above and below it").

## Rebuilding

```
node scripts/style-samples/build.mjs            # builds into a temp folder and prints sizes
node scripts/style-samples/build.mjs --install  # then copies into public/style-samples
```

After installing, bump `STYLE_SAMPLE_VERSION` in
`src/lib/websites/style-samples.ts` so browsers fetch the new files instead of
cached old ones.

`scripts/generate-style-samples.mjs` is the separate, **billed** route that
generates samples with the production model through the OpenAI API. It
writes to its own folder, never into `public/`, and only runs with `--apply`.
