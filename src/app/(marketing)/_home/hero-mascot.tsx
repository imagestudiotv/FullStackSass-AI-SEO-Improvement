"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type AnimationEvent } from "react";

import styles from "./hero-mascot.module.css";

/** The owl's flight, as long as its animation (hero-mascot.module.css). */
const FLIGHT_MS = 7400;
/** A hop, as long as its animation. */
const HOP_MS = 900;

const SCENES = [styles["scene-one"], styles["scene-two"], styles["scene-three"]];

/**
 * The gecko and the owl between "Meet" and "RepGet." in the hero's title
 * (client's design, 2026-11-11). The motion is all CSS; this only moves the
 * owl from its one flight to its soft hover - when the flight ends, or after
 * its length if the browser never ran it (a background tab) - and makes both
 * hop on a click once it hovers, as the design does.
 *
 * Decoration: hidden from screen readers (the title says "Meet RepGet."), and
 * out of the tab order - a hop is a flourish, not something to reach.
 */
export function HeroMascot({
  notes,
  search,
}: {
  /** What the gecko says, once, in three steps. */
  notes: readonly (readonly [string, string])[];
  /** "Search", in the page's language, on the owl's banner. */
  search: string;
}) {
  const [phase, setPhase] = useState<"intro" | "soft">("intro");
  const [hopping, setHopping] = useState(false);
  const hopTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const fallback = setTimeout(() => setPhase("soft"), FLIGHT_MS);
    return () => {
      clearTimeout(fallback);
      clearTimeout(hopTimer.current);
    };
  }, []);

  function flightEnded(event: AnimationEvent<HTMLSpanElement>) {
    // The class names are hashed, so the keyframes' name only ends with ours.
    if (event.target === event.currentTarget && event.animationName.includes("owl-flight")) setPhase("soft");
  }

  function hop() {
    if (phase !== "soft" || hopping) return;
    setHopping(true);
    hopTimer.current = setTimeout(() => setHopping(false), HOP_MS);
  }

  return (
    <span className={styles.mascot} data-phase={phase} data-hop={hopping ? "" : undefined} aria-hidden="true" onClick={hop}>
      <span className={styles.glow} />
      <span className={`${styles.actor} ${styles.gecko}`}>
        <Image className={styles.photo} src="/images/home/hero/gecko-photo.webp" alt="" width={208} height={208} unoptimized loading="eager" />
        <Image className={styles.arm} src="/images/home/hero/gecko-arm.webp" alt="" width={208} height={208} unoptimized loading="eager" />
      </span>
      <span className={styles.note}>
        <span className={styles["note-dot"]} />
        {notes.map(([lead, rest], index) => (
          <span key={lead} className={`${styles.scene} ${SCENES[index]}`}>
            <strong>{lead}</strong>
            <small>{rest}</small>
          </span>
        ))}
      </span>
      <span className={`${styles.actor} ${styles.owl}`} onAnimationEnd={flightEnded}>
        <Image className={styles.photo} src="/images/home/hero/owl-photo.webp" alt="" width={224} height={224} unoptimized loading="eager" />
        <Image className={`${styles.wing} ${styles["wing-left"]}`} src="/images/home/hero/owl-wing-left.webp" alt="" width={224} height={224} unoptimized loading="eager" />
        <Image className={`${styles.wing} ${styles["wing-right"]}`} src="/images/home/hero/owl-wing-right.webp" alt="" width={224} height={224} unoptimized loading="eager" />
        <Image className={styles.body} src="/images/home/hero/owl-body.webp" alt="" width={224} height={224} unoptimized loading="eager" />
        <span className={styles.banner}>
          <span className={styles["banner-inner"]}>
            <span className={styles["banner-topline"]} />
            <span className={styles["banner-row"]}>
              {[
                [["google", "Google"], ["search", search]],
                [["chatgpt", "ChatGPT"], ["perplexity", "Perplexity"]],
                [["facebook", "Facebook"], ["instagram", "Instagram"]],
              ].map((pair) => (
                <span key={pair[0][0]} className={styles["banner-card"]}>
                  <span className={styles.chips}>
                    {pair.map(([key, label]) => (
                      <span key={key} className={`${styles.chip} ${styles[`chip-${key}`]}`}>
                        {label}
                      </span>
                    ))}
                  </span>
                </span>
              ))}
            </span>
          </span>
        </span>
      </span>
      <span className={styles.star}>✳</span>
      <span className={`${styles.star} ${styles["star-two"]}`}>✦</span>
    </span>
  );
}
