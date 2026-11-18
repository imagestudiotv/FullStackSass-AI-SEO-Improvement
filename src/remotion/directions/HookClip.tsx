import type { CSSProperties } from "react";
import { AbsoluteFill, Freeze, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import type { HookType } from "../../lib/video/formats";
import { FONT } from "../fonts";
import { hookTiming, type HookSegment } from "../production";
import type { SceneMedia } from "../props";
import { fitFontSize } from "../text";
import { ConceptFrame, FilmTexture, LegibilityShade, type DirectionProps } from "./common";

/**
 * A visual hook (client, 2026-11-18; ShotPlan.hookClip) over any production:
 * the hook clip full screen with the bridge line while the hook is said, then
 * small in a corner - still running, its climax not yet shown - while the
 * points play, then full screen again from just before its climax behind the
 * proof line. Timing: production.ts hookTiming. Without a moving clip (none
 * found, a picture) the production shows as it is; the concept preview shows
 * the structure over a placeholder.
 */

const CHIP: Record<HookType, Record<string, string>> = {
  anticipation: { en: "Wait for it…", fr: "Attendez la fin…", de: "Warte ab…", es: "Espera…", it: "Aspetta…", pt: "Espera só…", nl: "Wacht maar…", pl: "Poczekaj…", ro: "Așteaptă…" },
  impossible: { en: "How is this possible?", fr: "Comment est-ce possible ?", de: "Wie geht das?", es: "¿Cómo es posible?", it: "Com'è possibile?", pt: "Como é possível?", nl: "Hoe kan dit?", pl: "Jak to możliwe?", ro: "Cum e posibil?" },
  danger: { en: "One wrong move…", fr: "Un seul faux pas…", de: "Ein falscher Schritt…", es: "Un paso en falso…", it: "Un passo falso…", pt: "Um passo em falso…", nl: "Eén verkeerde beweging…", pl: "Jeden zły ruch…", ro: "O singură mișcare greșită…" },
};

/** Under a danger clip: it shows professionals and is not to be copied (platform safety). */
const DANGER_NOTE: Record<string, string> = {
  en: "Professionals. Don't try this.",
  fr: "Professionnels. Ne pas reproduire.",
  de: "Profis. Nicht nachmachen.",
  es: "Profesionales. No lo intentes.",
  it: "Professionisti. Non imitare.",
  pt: "Profissionais. Não tente isto.",
  nl: "Professionals. Niet nadoen.",
  pl: "Profesjonaliści. Nie próbuj tego.",
  ro: "Profesioniști. Nu încercați.",
};

const said = (table: Record<string, string>, language?: string) => table[(language ?? "en").slice(0, 2).toLowerCase()] ?? table.en;

/** The corner box: right of centre, clear of the platform buttons and the captions. */
const INSET = { width: 270, height: 420, radius: 28 };

/** The clip length the concept preview assumes, to show the structure before a clip is chosen. */
const CONCEPT_CLIP_MS = 8000;

export function HookClipLayer(props: DirectionProps) {
  const { fps } = useVideoConfig();
  const type = props.plan?.hookClip?.type;
  const media = props.sceneMedia?.[0] ?? null;
  const clip = media?.kind === "video" ? media : null;
  if (!type || (!clip && !props.concept)) return null;
  const timing = hookTiming(props.timeline, clip ?? { durationMs: CONCEPT_CLIP_MS }, fps);
  if (!timing) return null;
  const hook = props.timeline.parts[0];
  const proof = props.timeline.parts.find((part) => part.role === "proof");
  const query = props.plan?.scenes?.[0]?.visual.query;
  return (
    <>
      <Sequence from={timing.open.from} durationInFrames={timing.open.frames} layout="none">
        <FullScreen {...props} clip={clip} segment={timing.open} query={query} text={hook.title} chip={said(CHIP[type], props.language)} note={type === "danger" ? said(DANGER_NOTE, props.language) : null} />
      </Sequence>
      {timing.inset ? (
        <Sequence from={timing.inset.from} durationInFrames={timing.inset.frames} layout="none">
          <Inset {...props} clip={clip} segment={timing.inset} query={query} chip={said(CHIP[type], props.language)} />
        </Sequence>
      ) : null}
      {timing.payoff && proof ? (
        <Sequence from={timing.payoff.from} durationInFrames={timing.payoff.frames} layout="none">
          <FullScreen {...props} clip={clip} segment={timing.payoff} query={query} text={proof.title} chip={null} note={null} payoff />
        </Sequence>
      ) : null}
    </>
  );
}

type ClipProps = { clip: SceneMedia | null; segment: HookSegment; query?: string };

/** The clip from segment.clipFrom at segment.rate, held on its last played frame after segment.playFrames. */
function ClipVideo({ clip, segment, query, style, pal, seed }: ClipProps & { style?: CSSProperties; pal: DirectionProps["pal"]; seed: number }) {
  if (!clip) return <ConceptFrame query={query} seed={seed} pal={pal} />;
  const position = `${Math.round((clip.focalX ?? 0.5) * 100)}% ${Math.round((clip.focalY ?? 0.45) * 100)}%`;
  return (
    <Freeze frame={Math.max(0, segment.playFrames - 1)} active={(f) => f >= segment.playFrames}>
      <OffthreadVideo
        src={clip.url}
        muted
        startFrom={segment.clipFrom}
        playbackRate={segment.rate}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: position, ...style }}
      />
    </Freeze>
  );
}

function FullScreen(props: DirectionProps & ClipProps & { text: string; chip: string | null; note: string | null; payoff?: boolean }) {
  const { safe, pal, text, chip, note, payoff } = props;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // The payoff lands with a short punch-in and a white flash.
  const punch = payoff ? interpolate(frame, [0, 8], [1.14, 1.04], { extrapolateRight: "clamp" }) : interpolate(frame, [0, props.segment.frames], [1.02, 1.1], { extrapolateRight: "clamp" });
  const flash = payoff ? interpolate(frame, [0, 6], [0.7, 0], { extrapolateRight: "clamp" }) : 0;
  const enter = interpolate(frame, [2, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const width = safe.right - safe.left;
  const size = fitFontSize(text, width - 40, 3, 92, 56, 0.56);
  const blink = chip ? 0.75 + 0.25 * Math.sin((frame / fps) * Math.PI * 2.4) : 1;
  return (
    <AbsoluteFill style={{ background: "#000", zIndex: 30 }}>
      <AbsoluteFill style={{ transform: `scale(${punch})` }}>
        <ClipVideo clip={props.clip} segment={props.segment} query={props.query} pal={pal} seed={payoff ? 2 : 1} />
      </AbsoluteFill>
      <LegibilityShade strength={0.85} top={0.55} />
      <FilmTexture strength={0.6} />
      <div style={{ position: "absolute", left: safe.left, width, top: safe.top + 150, opacity: enter, transform: `translateY(${(1 - enter) * 24}px)` }}>
        {chip ? (
          <div
            style={{
              display: "inline-block",
              marginBottom: 22,
              padding: "10px 22px",
              borderRadius: 999,
              background: pal.accent,
              color: "#fff",
              fontFamily: FONT,
              fontSize: 34,
              fontWeight: 800,
              opacity: blink,
              boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
            }}
          >
            {chip}
          </div>
        ) : null}
        <div style={{ fontFamily: FONT, fontSize: size, fontWeight: 900, lineHeight: 1.08, letterSpacing: "-0.02em", color: "#fff", textShadow: "0 4px 24px rgba(0,0,0,0.65)" }}>{text}</div>
      </div>
      {note ? (
        <div style={{ position: "absolute", left: safe.left, top: safe.bottom - 60, fontFamily: FONT, fontSize: 26, fontWeight: 600, color: "rgba(255,255,255,0.8)", textShadow: "0 2px 10px rgba(0,0,0,0.7)" }}>
          {note}
        </div>
      ) : null}
      {flash > 0 ? <AbsoluteFill style={{ background: "#fff", opacity: flash }} /> : null}
    </AbsoluteFill>
  );
}

/** The clip shrinking from the full frame into the corner box, then running there with its chip. */
function Inset(props: DirectionProps & ClipProps & { chip: string }) {
  const { safe, pal, chip } = props;
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ease = 1 - (1 - t) ** 3;
  const box = { left: safe.right - INSET.width, top: Math.round((safe.top + safe.bottom) / 2 - INSET.height / 2), width: INSET.width, height: INSET.height };
  const left = box.left * ease;
  const top = box.top * ease;
  const width = 1080 + (box.width - 1080) * ease;
  const height = 1920 + (box.height - 1920) * ease;
  return (
    <AbsoluteFill style={{ zIndex: 30, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left,
          top,
          width,
          height,
          borderRadius: INSET.radius * ease,
          overflow: "hidden",
          border: `${Math.round(6 * ease)}px solid #fff`,
          boxShadow: `0 18px 50px rgba(0,0,0,${0.5 * ease})`,
          background: "#000",
        }}
      >
        <ClipVideo clip={props.clip} segment={props.segment} query={props.query} pal={pal} seed={3} />
      </div>
      <div
        style={{
          position: "absolute",
          left: box.left,
          width: box.width,
          top: box.top - 58,
          textAlign: "center",
          opacity: ease,
        }}
      >
        <span style={{ padding: "8px 16px", borderRadius: 999, background: pal.accent, color: "#fff", fontFamily: FONT, fontSize: 26, fontWeight: 800, whiteSpace: "nowrap" }}>{chip}</span>
      </div>
    </AbsoluteFill>
  );
}
