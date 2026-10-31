import { useMemo } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

import type { CaptionWord } from "../../lib/video/formats";
import { fitFontSize } from "../text";
import type { Palette } from "../theme";

/**
 * Word-by-word captions, as in the reference reel: one to three words at a
 * time, each in its own box, the word being spoken in the accent colour.
 *
 * Placed in the centre-lower safe zone: above the bottom fifth (the
 * platforms' caption and buttons) and within x 80..940, clear of the
 * right-hand like/comment column.
 */

const LEFT = 80;
const WIDTH = 860;
/** Vertical centre of the caption block. */
const CENTRE_Y = 1440;
const MAX_WORDS = 3;
const MAX_CHARS = 18;
/** A pause this long starts a new group. */
const GAP_MS = 320;
/** A group stays up this long after its last word if nothing follows. */
const HOLD_MS = 450;

type Group = { words: CaptionWord[]; startMs: number; endMs: number };

/** Groups words the way they are heard: at pauses, sentence ends and every few words. */
export function groupWords(words: CaptionWord[]): Group[] {
  const groups: Group[] = [];
  let current: CaptionWord[] = [];
  const flush = () => {
    if (current.length) groups.push({ words: current, startMs: current[0].startMs, endMs: current[current.length - 1].endMs });
    current = [];
  };
  for (const word of words) {
    const text = word.text.trim();
    if (!text) continue;
    const previous = current[current.length - 1];
    const chars = current.reduce((n, w) => n + w.text.trim().length + 1, 0) + text.length;
    if (
      previous &&
      (current.length >= MAX_WORDS || chars > MAX_CHARS || word.startMs - previous.endMs > GAP_MS || /[.!?,;:]$/.test(previous.text.trim()))
    ) {
      flush();
    }
    current.push({ ...word, text });
  }
  flush();
  return groups;
}

function display(text: string): string {
  return text.replace(/[,.;:]+$/, "").replace(/^["'«»“”„]+|["'«»“”„]+$/g, "");
}

export function Captions({ words, pal }: { words: CaptionWord[]; pal: Palette }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const groups = useMemo(() => groupWords(words), [words]);
  const ms = (frame / fps) * 1000;

  const index = groups.findIndex((group, i) => {
    const next = groups[i + 1];
    const until = next ? Math.min(next.startMs, group.endMs + HOLD_MS) : group.endMs + HOLD_MS;
    return ms >= group.startMs - 40 && ms < until;
  });
  if (index < 0) return null;
  const group = groups[index];
  const text = group.words.map((w) => display(w.text)).join(" ");
  const fontSize = fitFontSize(text, WIDTH - 60, 2, 70, 40, 0.62);

  return (
    <div
      style={{
        position: "absolute",
        left: LEFT,
        width: WIDTH,
        top: CENTRE_Y - 160,
        height: 320,
        display: "flex",
        flexWrap: "wrap",
        alignContent: "center",
        justifyContent: "center",
        gap: `${fontSize * 0.2}px ${fontSize * 0.16}px`,
        pointerEvents: "none",
      }}
    >
      {group.words.map((word, i) => {
        const startFrame = (word.startMs / 1000) * fps;
        const pop = spring({ frame: frame - startFrame + 1.5, fps, config: { damping: 12, stiffness: 260, mass: 0.5 } });
        const said = ms >= word.startMs - 40;
        const next = group.words[i + 1];
        const active = said && (next ? ms < next.startMs : ms < word.endMs + 200);
        // Words join the group as they are said, the group re-centring (as in the reference).
        if (!said) return null;
        return (
          <span
            key={`${index}-${i}`}
            style={{
              display: "inline-block",
              padding: `${fontSize * 0.06}px ${fontSize * 0.2}px ${fontSize * 0.1}px`,
              borderRadius: fontSize * 0.2,
              background: active ? pal.accent : pal.captionBox,
              color: active ? pal.onAccent : pal.captionInk,
              fontSize,
              fontWeight: 900,
              lineHeight: 1.12,
              letterSpacing: "-0.02em",
              transform: `scale(${0.7 + 0.3 * pop}) rotate(${active ? -2 : 0}deg)`,
              boxShadow: "0 10px 26px rgba(0,0,0,0.22)",
              overflowWrap: "anywhere",
              maxWidth: WIDTH,
            }}
          >
            {display(word.text)}
          </span>
        );
      })}
    </div>
  );
}
