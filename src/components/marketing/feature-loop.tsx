"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { CLIP_HEIGHT, CLIP_WIDTH } from "@/lib/marketing/product-tools";

/**
 * One dashboard recording on /features and the homepage's "Top features":
 * its poster first, the silent loop only once it is on screen.
 *
 * WHAT LOADS, AND WHEN:
 *  - the poster, through next/image: lazy, resized to the box, so a phone
 *    never downloads a 1280 px picture and nothing loads above the fold
 *    that the visitor cannot see;
 *  - the <video> is not in the page at all until the poster comes near the
 *    screen (an IntersectionObserver, 200 px ahead). Then it is added muted,
 *    looping, inline and preload="none", and plays while at least a quarter
 *    of it is visible; scrolled away, it pauses.
 *  - prefers-reduced-motion: the video is never added; the poster stays.
 *  - no JavaScript (or no IntersectionObserver): the poster stays.
 * So a visitor who never scrolls to a clip never downloads a byte of it.
 *
 * The recording repeats the words beside it, so it is one labelled picture
 * for a screen reader rather than a video with controls.
 */
export function FeatureLoop({
  mp4,
  poster,
  label,
  sizes,
  className,
}: {
  mp4: string;
  poster: string;
  /** What a screen reader hears for the recording. */
  label: string;
  /** The box's width at each breakpoint, for the poster's srcset. */
  sizes: string;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [playing, setPlaying] = useState(false);

  // Add the video once the poster is about to be seen - never with reduced motion.
  useEffect(() => {
    const el = box.current;
    if (!el || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Play while visible, pause when scrolled away.
  useEffect(() => {
    const el = video.current;
    if (!near || !el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          // A refused play (data saver, a low-power mode) leaves the poster showing.
          el.play().catch(() => undefined);
        } else {
          el.pause();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);

  return (
    <div
      ref={box}
      role="img"
      aria-label={label}
      className={className}
      style={{ position: "relative", aspectRatio: `${CLIP_WIDTH} / ${CLIP_HEIGHT}`, overflow: "hidden" }}
    >
      <Image src={poster} alt="" width={CLIP_WIDTH} height={CLIP_HEIGHT} sizes={sizes} loading="lazy" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
      {near ? (
        <video
          ref={video}
          muted
          loop
          playsInline
          preload="none"
          poster={poster}
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => setPlaying(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            // Over the poster only once frames are coming, so the box never blinks blank.
            opacity: playing ? 1 : 0,
            transition: "opacity 0.3s",
          }}
        >
          <source src={mp4} type="video/mp4" />
        </video>
      ) : null}
    </div>
  );
}
