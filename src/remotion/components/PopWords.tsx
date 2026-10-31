import { spring, useCurrentFrame, useVideoConfig } from "remotion";

import { POP } from "./ui";

/**
 * Words that pop in one after another (the reference reel's headlines).
 * Wrapping happens between words, so long German compounds stay whole.
 */
export function PopWords({
  words,
  delay,
  stagger,
  color,
  emphasis,
  emphasisColor,
  box,
}: {
  words: string[];
  delay: number;
  stagger: number;
  color: string;
  emphasis?: Set<number>;
  emphasisColor?: string;
  /** Draw a colour box behind emphasised words instead of colouring them. */
  box?: { background: string; color: string };
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      {words.map((word, i) => {
        const s = spring({ frame: frame - delay - i * stagger, fps, config: POP });
        const strong = emphasis?.has(i) ?? false;
        const wipe = box && strong ? spring({ frame: frame - delay - i * stagger - 6, fps, config: { damping: 200 } }) : 0;
        return (
          <span key={`${word}-${i}`}>
            <span
              style={{
                display: "inline-block",
                position: "relative",
                color: strong ? (box ? (wipe > 0.5 ? box.color : color) : emphasisColor ?? color) : color,
                opacity: Math.min(1, s * 1.5),
                transform: `translateY(${(1 - s) * 0.45}em) scale(${0.8 + 0.2 * s})`,
                transformOrigin: "50% 100%",
              }}
            >
              {box && strong ? (
                <span
                  style={{
                    position: "absolute",
                    left: "-0.12em",
                    right: "-0.12em",
                    top: "0.06em",
                    bottom: "-0.02em",
                    borderRadius: "0.14em",
                    background: box.background,
                    transform: `scaleX(${wipe})`,
                    transformOrigin: "0% 50%",
                    zIndex: 0,
                  }}
                />
              ) : null}
              <span style={{ position: "relative", zIndex: 1 }}>{word}</span>
            </span>{" "}
          </span>
        );
      })}
    </>
  );
}
