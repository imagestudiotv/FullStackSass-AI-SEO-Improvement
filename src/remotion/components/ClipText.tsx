import type { CSSProperties, ReactNode } from "react";

import { CLIP_FRAME, CLIP_TOP, clipLineHeight, clipTextLayout, shownClipText, type ClipFont, type ClipTextStyle } from "../clip-text";
import { ANTON, ARIMO, COURIER, ensureClipFont, FIRA, FONT, GELASIO, MARKER } from "../fonts";
import { TEXT_SAFE } from "./ui";

/** The face as CSS; letters it lacks come from Inter. */
export const CLIP_FAMILIES: Record<ClipFont, string> = {
  inter: FONT,
  arimo: `"${ARIMO}", ${FONT}`,
  gelasio: `"${GELASIO}", ${FONT}`,
  anton: `"${ANTON}", ${FONT}`,
  fira: `"${FIRA}", ${FONT}`,
  courier: `"${COURIER}", ${FONT}`,
  marker: `"${MARKER}", ${FONT}`,
};

const BACKGROUND: Record<ClipTextStyle["bg"], string | null> = {
  none: null,
  dark: "rgba(24,29,41,0.85)",
  light: "#ffffff",
  orange: "#eb651e",
  highlight: "linear-gradient(transparent 55%, rgba(255,144,69,0.75) 55%)",
};

/** Px of outline drawn for each step of the outline slider; half of it is under the letter. */
const STROKE_PX = 4;

/**
 * The customer's text on a Viral clip, at its own place. The space over it
 * gives way when the text would pass the bottom, so the words always stay in
 * the frame. `above` (the hook clip's chip) sits over it, or under it at the
 * very top of the frame; `children` (the editor's drag box) cover it.
 */
export function ClipText({ text, style, above, enter, children }: { text: string; style: ClipTextStyle; above?: ReactNode; enter?: CSSProperties; children?: ReactNode }) {
  ensureClipFont(style.font);
  const layout = clipTextLayout(text, style);
  const background = BACKGROUND[style.bg];
  const padded = style.bg === "dark" || style.bg === "light" || style.bg === "orange";
  const top = (style.y / 100) * CLIP_FRAME.height;
  const edge = (CLIP_TOP / 100) * CLIP_FRAME.height;
  return (
    <div style={{ position: "absolute", left: layout.left, width: layout.width, top: edge, bottom: edge, display: "flex", flexDirection: "column", textAlign: style.align, pointerEvents: "none" }}>
      <div style={{ flex: `0 1 ${Math.max(0, top - edge)}px`, minHeight: 0 }} />
      <div style={{ flex: "0 0 auto", position: "relative", ...enter }}>
      {above ? <div style={{ position: "absolute", left: 0, right: 0, ...(top < 110 ? { top: "100%", paddingTop: 22 } : { bottom: "100%", paddingBottom: 22 }) }}>{above}</div> : null}
      <div
        style={{
          fontFamily: CLIP_FAMILIES[style.font],
          fontSize: layout.size,
          fontWeight: style.weight,
          lineHeight: clipLineHeight(style),
          color: style.color,
          ...(style.stroke > 0 ? { WebkitTextStroke: `${style.stroke * STROKE_PX}px ${style.strokeColor}`, paintOrder: "stroke fill", strokeLinejoin: "round" } : {}),
          textShadow: style.bg === "none" || style.bg === "highlight" ? "0 4px 18px rgba(0,0,0,0.55)" : undefined,
          ...TEXT_SAFE,
        }}
      >
        <span
          style={{
            ...(background ? { background, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" } : {}),
            ...(padded ? { padding: `${Math.round(layout.size * 0.12)}px ${Math.round(layout.size * 0.36)}px`, borderRadius: Math.round(layout.size * 0.22) } : {}),
          }}
        >
          {shownClipText(text, style)}
        </span>
      </div>
      {children}
      </div>
    </div>
  );
}
