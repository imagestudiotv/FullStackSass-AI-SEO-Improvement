"use client";

import { useState } from "react";

import { walkthroughEmbedUrl, walkthroughPoster } from "@/lib/marketing/walkthrough";

import styles from "./sections/video.module.css";

/**
 * The walkthrough's frame, as the client's design draws it (design.html,
 * script `rgx-official-demo-player`): YouTube's thumbnail with a round play
 * button, and only after a press the privacy-enhanced player in its place,
 * started with `autoplay=1` - the video the visitor asked for, with sound.
 *
 * Nothing of YouTube's player is in the server's HTML: just the thumbnail
 * (from i.ytimg.com, allowed by the CSP's img-src). If that image ever fails,
 * hqdefault (which every public video has) takes its place, and after that
 * the frame's own warm tint.
 */
export function DemoPlayer({ playLabel, frameTitle, lang }: { playLabel: string; frameTitle: string; lang: string }) {
  const [playing, setPlaying] = useState(false);
  const [poster, setPoster] = useState<"best" | "fallback" | "none">("best");
  const sources = walkthroughPoster();

  return (
    <div className={styles["rgx-video-slot"]} id="rgx-video-slot">
      {playing ? (
        <iframe
          className={styles["rgx-video-iframe"]}
          title={frameTitle}
          src={walkthroughEmbedUrl(lang)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          // The play button it replaces had focus: keep keyboard users in the player.
          ref={(frame) => frame?.focus()}
        />
      ) : (
        <button className={styles["rgx-video-cover"]} id="rgx-video-play" type="button" aria-label={playLabel} onClick={() => setPlaying(true)}>
          {poster !== "none" ? (
            // A remote thumbnail: next/image would proxy it through our server for nothing.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster === "best" ? sources.src : sources.fallback}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setPoster(poster === "best" ? "fallback" : "none")}
            />
          ) : null}
          <span className={styles["rgx-video-play"]} aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M8 5.5a1.3 1.3 0 0 1 1.98-1.1l10.2 6.5a1.3 1.3 0 0 1 0 2.2l-10.2 6.5A1.3 1.3 0 0 1 8 18.5v-13Z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
