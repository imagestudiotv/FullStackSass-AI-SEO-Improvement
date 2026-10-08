"use client";

import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  walkthroughEmbedUrl,
  walkthroughPoster,
} from "@/lib/marketing/walkthrough";

/**
 * The walkthrough video, loaded only when the visitor asks for it.
 *
 * Until then it is a poster with a play button: no YouTube player, no
 * iframe and no YouTube script on the page, which is most of a megabyte of
 * JavaScript a visitor who never presses play would otherwise download. The
 * press swaps in the real player (YouTube's own, with its controls for
 * pause, seeking, sound, captions and fullscreen) and asks it to start; it
 * never starts by itself, so scrolling here from the hero plays nothing.
 *
 * The frame is a fixed 16:9 box with a 200px floor (YouTube's minimum player
 * size), so poster and player occupy the same space and nothing below moves.
 *
 * The poster is YouTube's thumbnail (i.ytimg.com), a lazy image in the
 * server's HTML so it shows without JavaScript. Lazy is not late: Chrome
 * fetches lazy images from well below the fold, and this section sits just
 * under the hero, so on most screens the thumbnail is requested during the
 * first load - after the headline has painted. (Holding it back until the
 * frame neared the screen was measured too: the headline painted no sooner,
 * and the poster popping in later made PageSpeed's speed index worse.)
 */
export function WalkthroughPlayer({
  playLabel,
  frameTitle,
  lang,
}: {
  /** The button's accessible name - the poster image says nothing on its own. */
  playLabel: string;
  /** The iframe's title, read when focus enters the player. */
  frameTitle: string;
  /** Player interface language. */
  lang: string;
}) {
  const [active, setActive] = useState(false);
  /** best: the 16:9 webp sizes; fallback: hqdefault; none: drawn poster. */
  const [poster, setPoster] = useState<"best" | "fallback" | "none">("best");
  const frame = useRef<HTMLIFrameElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const sources = walkthroughPoster();

  const nextPoster = () =>
    setPoster((current) => (current === "best" ? "fallback" : "none"));

  /*
    An image that failed before React attached its handlers never reports
    the error, so check once after each render: complete with no width means
    broken. (A lazy image not yet requested is not complete.)
  */
  useEffect(() => {
    const element = image.current;
    if (element?.complete && element.naturalWidth === 0) {
      setPoster((current) => (current === "best" ? "fallback" : "none"));
    }
  }, [poster]);

  /*
    Focus follows the press into the player, so a keyboard user can pause,
    seek and change the volume straight away instead of being left on a
    button that no longer exists.
  */
  useEffect(() => {
    if (active) frame.current?.focus();
  }, [active]);

  return (
    <div
      className="relative aspect-video min-h-50 w-full overflow-hidden rounded-2xl border bg-linear-to-br from-primary/10 via-background to-primary/15 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.45)]"
    >
      {active ? (
        <iframe
          ref={frame}
          src={walkthroughEmbedUrl(lang)}
          title={frameTitle}
          /*
            What YouTube's own embed code grants. Without "autoplay" the
            press could not start playback; "fullscreen" plus allowFullScreen
            keeps YouTube's fullscreen button working.
          */
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          /*
            YouTube refuses to play (error 153) when it cannot tell which site
            embeds it. This is the browser default, stated so a stricter
            page-wide policy can never silence it.
          */
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setActive(true)}
          aria-label={playLabel}
          className="group absolute inset-0 size-full cursor-pointer focus-visible:outline-none"
        >
          {poster === "none" ? (
            /*
              The thumbnail could not load: the frame's warm tint stays, with
              a soft glow behind the button.
            */
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(234,88,12,0.18),transparent_60%)]"
            />
          ) : (
            /*
              A plain <img>, not next/image: the optimiser would fetch and
              re-serve YouTube's image from our servers on every new size,
              for a picture YouTube already serves in the right formats.
              Lazy, with its size reserved by the frame.
            */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={image}
              key={poster}
              src={poster === "best" ? sources.src : sources.fallback}
              srcSet={poster === "best" ? sources.srcSet : undefined}
              sizes="(min-width: 1024px) 64rem, 100vw"
              alt=""
              width={1280}
              height={720}
              loading="lazy"
              decoding="async"
              onError={nextPoster}
              className="absolute inset-0 size-full object-cover"
            />
          )}

          {/* A light scrim so the button reads on any frame of the poster. */}
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-black/10 transition-colors group-hover:bg-black/20"
          />
          <span
            aria-hidden="true"
            className="absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_30px_-6px_rgba(0,0,0,0.45)] ring-8 ring-white/30 motion-safe:transition-transform group-hover:scale-105 group-focus-visible:ring-white sm:size-20"
          >
            <Play className="ml-1 size-7 fill-current sm:size-8" />
          </span>
          {/* Visible focus on the whole frame, not only the button inside it. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-2xl ring-primary ring-inset group-focus-visible:ring-4"
          />
        </button>
      )}
    </div>
  );
}
