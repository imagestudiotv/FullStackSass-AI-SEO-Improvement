/**
 * The homepage walkthrough video - the one place its YouTube id lives.
 *
 * TO REPLACE THE VIDEO, change `id` below. The embed, the poster and the
 * "Watch on YouTube" link are all built from it. Check the new video allows
 * embedding first (YouTube's oEmbed endpoint answers 401 for one that does
 * not), and whether it has a maxresdefault thumbnail - see POSTER below.
 */
export const WALKTHROUGH_VIDEO = {
  id: "PqNu8DzBlTQ",
} as const;

/** The public watch page, for the fallback link. */
export function walkthroughWatchUrl(id: string = WALKTHROUGH_VIDEO.id): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/**
 * The player, on YouTube's privacy-enhanced host. It is only requested after
 * the visitor presses play, so `autoplay=1` starts the video they asked for
 * rather than playing anything on page load; a browser that still blocks it
 * leaves YouTube's own play button in place.
 *
 *  - playsinline: plays in the page on iPhone instead of jumping to fullscreen.
 *  - rel=0: suggestions at the end come from the same channel. It does not
 *    remove YouTube's branding or every recommendation; nothing does.
 *  - hl / cc_lang_pref: the player's interface language, and the caption
 *    language to prefer IF the video has captions in it. Neither adds
 *    captions or translated audio that do not exist.
 *
 * Controls, fullscreen and keyboard shortcuts are YouTube's defaults (on).
 * No enablejsapi: nothing here talks to the player, so no API script loads.
 */
export function walkthroughEmbedUrl(
  lang: string,
  id: string = WALKTHROUGH_VIDEO.id,
): string {
  const params = new URLSearchParams({
    autoplay: "1",
    playsinline: "1",
    rel: "0",
    hl: lang,
    cc_lang_pref: lang,
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}

/**
 * The poster, from YouTube's thumbnail host.
 *
 * Both sizes in the srcset are 16:9 (mqdefault 320x180, maxresdefault
 * 1280x720), so the frame never shows the black bars of the 4:3 sizes; both
 * were checked to exist for this video. A video without a maxres thumbnail
 * would fail it, which is what `fallback` is for: hqdefault exists for every
 * public video, and its letterbox is cropped away by object-cover in the 16:9
 * frame.
 *
 * NOTE ON PRIVACY: the player waits for a click, but this image is a request
 * to i.ytimg.com (Google) as soon as the section nears the screen.
 */
export function walkthroughPoster(id: string = WALKTHROUGH_VIDEO.id) {
  return {
    src: `https://i.ytimg.com/vi_webp/${id}/maxresdefault.webp`,
    srcSet: `https://i.ytimg.com/vi_webp/${id}/mqdefault.webp 320w, https://i.ytimg.com/vi_webp/${id}/maxresdefault.webp 1280w`,
    fallback: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}
