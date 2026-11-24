import type { CSSProperties } from "react";

import { LOOK_SPECS, outlineShadow, type CaptionLook } from "../caption-looks";
import { ANTON, COURIER, FONT, MARKER } from "../fonts";
import { fitFontSize } from "../text";
import { TEXT_SAFE } from "./ui";

const FAMILIES = { inter: FONT, anton: `"${ANTON}", ${FONT}`, courier: `"${COURIER}", ${FONT}`, marker: `"${MARKER}", ${FONT}` } as const;

/** A Viral video's line in its caption look (caption-looks.ts), sized to `width` and `maxLines`. */
export function LookText({ look, text, width, maxLines = 3, align = "center", scale = 1, style }: { look: CaptionLook; text: string; width: number; maxLines?: number; align?: "center" | "left"; scale?: number; style?: CSSProperties }) {
  const spec = LOOK_SPECS[look];
  const shown = spec.upper ? text.toUpperCase() : text;
  const size = fitFontSize(shown, spec.paint === "box" ? width - 48 : width, maxLines, Math.round(spec.max * scale), Math.round(spec.min * scale), spec.charEm);
  const font: CSSProperties = { fontFamily: FAMILIES[spec.face], fontSize: size, fontWeight: spec.weight, lineHeight: spec.lineHeight, letterSpacing: spec.letterSpacing };
  if (spec.paint === "box") {
    return (
      <div style={{ width, textAlign: align, ...TEXT_SAFE, ...style }}>
        <span
          style={{
            ...font,
            color: "#111114",
            background: "#ffffff",
            padding: `${Math.round(size * 0.12)}px ${Math.round(size * 0.36)}px`,
            borderRadius: Math.round(size * 0.22),
            boxDecorationBreak: "clone",
            WebkitBoxDecorationBreak: "clone",
          }}
        >
          {shown}
        </span>
      </div>
    );
  }
  return <div style={{ width, textAlign: align, ...font, color: "#ffffff", textShadow: outlineShadow(spec.stroke), ...TEXT_SAFE, ...style }}>{shown}</div>;
}
