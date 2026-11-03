"use client";

import { VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { walkthroughEmbedUrl, walkthroughPoster } from "@/lib/marketing/walkthrough";

import styles from "./sections/story.module.css";

/** Where the privacy-enhanced player lives: the only origin we talk to or listen to. */
const PLAYER_ORIGIN = new URL(walkthroughEmbedUrl("en")).origin;

/** YouTube's player states, as its infoDelivery messages report them. */
const PLAYING = 1;
const BUFFERING = 3;

type Mode =
  /** Only the thumbnail: no iframe, no YouTube request beyond the image. */
  | "poster"
  /** Started by itself, muted, because it scrolled into view. */
  | "preview"
  /** Started by a press, with sound. */
  | "pressed";

/**
 * The walkthrough video on the redesigned homepage (client, 2026-11-03: "more
 * interactive as Outrank, with video also").
 *
 * Same video, host and poster as the old player (lib/marketing/walkthrough.ts,
 * walkthrough-player.tsx): the server's HTML holds only the thumbnail and a
 * play button, so nothing of YouTube's player loads with the page.
 *
 * What is new is that it starts by itself - MUTED, which every browser allows
 * - once half of it is on screen, and pauses again when it is scrolled away.
 * While it plays silently a hint says so, and pressing the hint turns the
 * sound on; it never starts with sound unless someone pressed play. A visitor
 * who asked for reduced motion or for data saving (Save-Data) gets the old
 * behaviour: the poster until they press play.
 *
 * Pause, resume and unmute go to the player as postMessage commands, which
 * `enablejsapi=1` makes it accept. That is the same channel YouTube's iframe
 * API uses, minus its script: nothing extra loads on this page. If the player
 * ever stops answering, the video simply keeps YouTube's own controls.
 */
export function AutoVideo({
  playLabel,
  frameTitle,
  mutedHint,
  lang,
}: {
  /** The play button's accessible name - the thumbnail says nothing on its own. */
  playLabel: string;
  /** The iframe's title, read when focus enters the player. */
  frameTitle: string;
  /** Shown, as a button that turns the sound on, while the muted preview plays. */
  mutedHint: string;
  /** Player interface language. */
  lang: string;
}) {
  const [mode, setMode] = useState<Mode>("poster");
  const [muted, setMuted] = useState(false);
  /** best: the 16:9 webp sizes; fallback: hqdefault; none: the frame's own tint. */
  const [poster, setPoster] = useState<"best" | "fallback" | "none">("best");

  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const image = useRef<HTMLImageElement>(null);
  /* Refs, not state: the observer and the message listener read them without re-subscribing. */
  const modeRef = useRef<Mode>("poster");
  const mutedRef = useRef(false);
  const stateRef = useRef(PLAYING);
  const pausedByScroll = useRef(false);
  const sources = walkthroughPoster();

  const start = useCallback((next: Exclude<Mode, "poster">) => {
    if (modeRef.current !== "poster") return;
    modeRef.current = next;
    mutedRef.current = next === "preview";
    setMuted(next === "preview");
    setMode(next);
  }, []);

  const send = useCallback((func: string, args: unknown[] = []) => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), PLAYER_ORIGIN);
  }, []);

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
    Half on screen starts the muted preview; under a quarter pauses it. The
    gap between the two keeps a video sitting at the edge of the screen from
    flickering between play and pause. Coming back resumes it only while it
    is still muted - once the sound is on, starting again is the visitor's
    call - and only if it was the scroll that paused it, not them.
  */
  useEffect(() => {
    const element = box.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    const autoplay = !saveData && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const ratio = entry.isIntersecting ? entry.intersectionRatio : 0;
        if (modeRef.current === "poster") {
          if (autoplay && ratio >= 0.5) start("preview");
          return;
        }
        if (ratio < 0.25) {
          if (stateRef.current === PLAYING || stateRef.current === BUFFERING) {
            send("pauseVideo");
            pausedByScroll.current = true;
          }
        } else if (ratio >= 0.5 && pausedByScroll.current) {
          pausedByScroll.current = false;
          if (mutedRef.current) send("playVideo");
        }
      },
      { threshold: [0, 0.25, 0.5] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [send, start]);

  /*
    The player's reports: whether it is playing (so a video the visitor
    paused is not resumed for them) and whether it is muted (so the hint goes
    away when they turn the sound on in YouTube's own controls). Only messages
    from our own iframe, on YouTube's origin, are read.
  */
  useEffect(() => {
    if (mode === "poster") return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== PLAYER_ORIGIN || event.source !== frame.current?.contentWindow) return;
      let data: unknown;
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      const info = (data as { event?: string; info?: { playerState?: unknown; muted?: unknown } } | null)?.info;
      if ((data as { event?: string } | null)?.event !== "infoDelivery" || !info) return;
      if (typeof info.playerState === "number") stateRef.current = info.playerState;
      if (typeof info.muted === "boolean" && info.muted !== mutedRef.current) {
        mutedRef.current = info.muted;
        setMuted(info.muted);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [mode]);

  /*
    Focus follows a press into the player, so a keyboard user can pause,
    seek and change the volume straight away. The muted preview starts by
    itself and leaves focus where it was.
  */
  useEffect(() => {
    if (mode === "pressed") frame.current?.focus();
  }, [mode]);

  const turnSoundOn = () => {
    send("unMute");
    send("setVolume", [100]);
    send("playVideo");
    pausedByScroll.current = false;
    mutedRef.current = false;
    setMuted(false);
    frame.current?.focus();
  };

  const src = (() => {
    if (mode === "poster") return "";
    const url = new URL(walkthroughEmbedUrl(lang));
    url.searchParams.set("enablejsapi", "1");
    // Tells the player which page may command it; it ignores anyone else.
    url.searchParams.set("origin", window.location.origin);
    if (mode === "preview") url.searchParams.set("mute", "1");
    return url.toString();
  })();

  return (
    <div ref={box} className={styles.player}>
      {poster !== "none" ? (
        /*
          A plain <img>, not next/image, as in the old player: the optimiser
          would re-serve YouTube's own image from our servers. It stays under
          the iframe, so the swap to the player shows no blank frame.
        */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={image}
          key={poster}
          src={poster === "best" ? sources.src : sources.fallback}
          srcSet={poster === "best" ? sources.srcSet : undefined}
          sizes="(min-width: 1110px) 1092px, 100vw"
          alt=""
          width={1280}
          height={720}
          loading="lazy"
          decoding="async"
          onError={() => setPoster((current) => (current === "best" ? "fallback" : "none"))}
          className={styles.poster}
        />
      ) : null}

      {mode === "poster" ? (
        <button type="button" className={styles.cover} aria-label={playLabel} onClick={() => start("pressed")}>
          <span className={styles.playButton} aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M8 5.5a1.3 1.3 0 0 1 1.98-1.1l10.2 6.5a1.3 1.3 0 0 1 0 2.2l-10.2 6.5A1.3 1.3 0 0 1 8 18.5v-13Z" />
            </svg>
          </span>
        </button>
      ) : (
        <>
          {/* Before the player in the tab order, so the way to the sound comes first. */}
          {mode === "preview" && muted ? (
            <button type="button" className={styles.soundHint} onClick={turnSoundOn}>
              <VolumeX aria-hidden="true" />
              {mutedHint}
            </button>
          ) : null}
          <iframe
            ref={frame}
            src={src}
            title={frameTitle}
            /*
              What YouTube's own embed code grants: "autoplay" lets both the
              muted start and the press start playback; "fullscreen" plus
              allowFullScreen keeps YouTube's fullscreen button working.
            */
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            // YouTube refuses to play (error 153) when it cannot tell which site embeds it.
            referrerPolicy="strict-origin-when-cross-origin"
            /*
              Ask the player to report its state. Sent on every load, so a
              player that reloads keeps reporting.
            */
            onLoad={() => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: "repget-demo", channel: "widget" }), PLAYER_ORIGIN)}
            className={styles.frame}
          />
        </>
      )}
    </div>
  );
}
