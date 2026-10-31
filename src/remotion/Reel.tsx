import type { ReactNode } from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import type { ReelProps } from "../lib/video/formats";
import { Captions } from "./components/Captions";
import { Background, LogoTile, PAD, cleanDomain } from "./components/ui";
import { FONT } from "./fonts";
import { BoldChecklist, BoldHook, BoldProof } from "./scenes/Bold";
import { CtaScene } from "./scenes/Cta";
import { NumbersHook, NumbersPoint, NumbersProof } from "./scenes/Numbers";
import { StoryBackdrop, StoryHook, StoryPoint, StoryProof } from "./scenes/Story";
import { palette, type Palette } from "./theme";
import { reelTiming, sceneEnd, type ReelTiming } from "./timing";

/**
 * The reel: one scene per part of the script (hook, each point, proof, call
 * to action), each starting exactly when the voice reaches that part, with
 * the voice, the music under it and the word-by-word captions on top.
 *
 * Usable both as the "Reel" composition and in @remotion/player - pass the
 * Player `durationInFrames={reelTiming(props).durationInFrames}`.
 */
export function Reel(props: ReelProps) {
  const { fps } = useVideoConfig();
  const timing = reelTiming(props, fps);
  const pal = palette(props.brand, props.style);

  return (
    <AbsoluteFill style={{ fontFamily: FONT, background: pal.bgBottom, color: pal.ink, overflow: "hidden" }}>
      {props.style === "bold" ? <BoldReel {...props} timing={timing} pal={pal} /> : null}
      {props.style === "numbers" ? <NumbersReel {...props} timing={timing} pal={pal} /> : null}
      {props.style === "story" ? <StoryReel {...props} timing={timing} pal={pal} /> : null}
      {props.captions && props.words.length ? <Captions words={props.words} pal={pal} /> : null}
      {props.voiceUrl ? <Audio src={props.voiceUrl} /> : null}
      {props.music ? <Music url={props.music.url} volume={props.music.volume} durationInFrames={timing.durationInFrames} /> : null}
    </AbsoluteFill>
  );
}

type StyleProps = ReelProps & { timing: ReelTiming; pal: Palette };

/** A part of the script as a sequence; `overlap` keeps it on under the next one (cross-fades). */
function Part({ timing, index, overlap = 0, children }: { timing: ReelTiming; index: number; overlap?: number; children: (duration: number) => ReactNode }) {
  const from = timing.starts[index];
  const duration = Math.max(1, sceneEnd(timing, index) - from);
  const last = index === timing.starts.length - 1;
  return (
    <Sequence from={from} durationInFrames={duration + (last ? 0 : overlap)} layout="none">
      <AbsoluteFill>{children(last ? duration + 30 : duration)}</AbsoluteFill>
    </Sequence>
  );
}

function BoldReel({ brand, script, timing, pal }: StyleProps) {
  const n = script.points.length;
  const listFrom = timing.starts[1];
  const listTo = timing.starts[1 + n];
  return (
    <>
      <Background pal={pal} />
      <Part timing={timing} index={0}>
        {(duration) => <BoldHook brand={brand} hook={script.hook} duration={duration} pal={pal} />}
      </Part>
      <Sequence from={listFrom} durationInFrames={Math.max(1, listTo - listFrom)} layout="none">
        <AbsoluteFill>
          <BoldChecklist
            brand={brand}
            hook={script.hook}
            points={script.points}
            pointStarts={script.points.map((_, i) => timing.starts[1 + i] - listFrom)}
            duration={listTo - listFrom}
            pal={pal}
          />
        </AbsoluteFill>
      </Sequence>
      <Part timing={timing} index={n + 1}>
        {(duration) => <BoldProof brand={brand} proof={script.proof} duration={duration} pal={pal} />}
      </Part>
      <Part timing={timing} index={n + 2}>
        {() => <CtaScene brand={brand} cta={script.cta} pal={pal} />}
      </Part>
      <Footer domain={brand.domain} timing={timing} pal={pal} />
    </>
  );
}

function NumbersReel({ brand, script, timing, pal }: StyleProps) {
  const n = script.points.length;
  return (
    <>
      <Background pal={pal} />
      <Part timing={timing} index={0}>
        {(duration) => <NumbersHook hook={script.hook} duration={duration} pal={pal} />}
      </Part>
      {script.points.map((point, i) => (
        <Part key={i} timing={timing} index={1 + i}>
          {(duration) => <NumbersPoint point={point} index={i} total={n} duration={duration} pal={pal} />}
        </Part>
      ))}
      <Part timing={timing} index={n + 1}>
        {(duration) => <NumbersProof proof={script.proof} duration={duration} pal={pal} />}
      </Part>
      <Part timing={timing} index={n + 2}>
        {() => <CtaScene brand={brand} cta={script.cta} pal={pal} />}
      </Part>
      <TopBar brand={brand} timing={timing} pal={pal} showBrand />
    </>
  );
}

/** Frames a story scene stays on under the next one, for the cross-fade. */
const STORY_OVERLAP = 12;

function StoryReel({ brand, script, media, timing, pal }: StyleProps) {
  const n = script.points.length;
  const pick = (k: number) => (media.length ? media[k % media.length] : null);
  const backdrop = (k: number, duration: number, shade = 1) => (
    <StoryBackdrop item={pick(k)} seed={k} duration={duration + STORY_OVERLAP} pal={pal} shade={shade} />
  );
  return (
    <>
      <Part timing={timing} index={0} overlap={STORY_OVERLAP}>
        {(duration) => (
          <>
            {backdrop(0, duration)}
            <StoryHook brand={brand} hook={script.hook} duration={duration} pal={pal} />
          </>
        )}
      </Part>
      {script.points.map((point, i) => (
        <Part key={i} timing={timing} index={1 + i} overlap={STORY_OVERLAP}>
          {(duration) => (
            <>
              {backdrop(1 + i, duration)}
              <StoryPoint point={point} index={i} duration={duration} pal={pal} />
            </>
          )}
        </Part>
      ))}
      <Part timing={timing} index={n + 1} overlap={STORY_OVERLAP}>
        {(duration) => (
          <>
            {backdrop(n + 1, duration)}
            <StoryProof proof={script.proof} duration={duration} pal={pal} />
          </>
        )}
      </Part>
      <Part timing={timing} index={n + 2}>
        {(duration) => (
          <>
            {backdrop(n + 2, duration, 1.5)}
            <CtaScene brand={brand} cta={script.cta} pal={pal} />
          </>
        )}
      </Part>
      <TopBar brand={brand} timing={timing} pal={pal} showBrand={false} />
    </>
  );
}

/** The part being shown, and how far through it we are. */
function usePart(timing: ReelTiming): { index: number; progress: number } {
  const frame = useCurrentFrame();
  let index = 0;
  timing.starts.forEach((start, i) => {
    if (frame >= start) index = i;
  });
  const start = timing.starts[index];
  const end = sceneEnd(timing, index);
  return { index, progress: interpolate(frame, [start, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) };
}

/** The reference reel's footer: the site on the left, "02 / 06" on the right. */
function Footer({ domain, timing, pal }: { domain: string; timing: ReelTiming; pal: Palette }) {
  const frame = useCurrentFrame();
  const { index } = usePart(timing);
  const enter = interpolate(frame, [4, 18], [0, 1], { extrapolateRight: "clamp" });
  const pad = (k: number) => String(k).padStart(2, "0");
  return (
    <div
      style={{
        position: "absolute",
        left: PAD,
        right: PAD,
        bottom: 84,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 28,
        fontWeight: 700,
        color: pal.ink,
        opacity: enter * 0.85,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: pal.highlight }} />
        {cleanDomain(domain)}
      </span>
      <span style={{ color: pal.inkSoft, fontVariantNumeric: "tabular-nums" }}>
        {pad(index + 1)} / {pad(timing.starts.length)}
      </span>
    </div>
  );
}

/** Story-style segments at the top (one per part, the current one filling), with the brand under them. */
function TopBar({ brand, timing, pal, showBrand }: { brand: ReelProps["brand"]; timing: ReelTiming; pal: Palette; showBrand: boolean }) {
  const frame = useCurrentFrame();
  const { index, progress } = usePart(timing);
  const enter = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 96, left: PAD, right: PAD, opacity: enter }}>
      <div style={{ display: "flex", gap: 10 }}>
        {timing.starts.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.22)", overflow: "hidden" }}>
            <div style={{ width: `${(i < index ? 1 : i === index ? progress : 0) * 100}%`, height: "100%", background: "#ffffff" }} />
          </div>
        ))}
      </div>
      {showBrand ? (
        <div style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 18 }}>
          <LogoTile brand={brand} size={60} pal={pal} />
          <span style={{ fontSize: 32, fontWeight: 800, color: pal.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{brand.name}</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The music under the voice: ducked to its set volume, faded in and out. Not
 * looped: every track is 75 seconds and a reel at most 60 (MAX_REEL_SECONDS),
 * and a loop has the browser load the whole track first to learn its length.
 */
function Music({ url, volume, durationInFrames }: { url: string; volume: number; durationInFrames: number }) {
  return (
    <Audio
      src={url}
      volume={(f) =>
        volume *
        interpolate(f, [0, 15, durationInFrames - 30, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      }
    />
  );
}
