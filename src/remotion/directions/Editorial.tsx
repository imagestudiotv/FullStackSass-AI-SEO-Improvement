import { Fragment, useState, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import type { EditorialImage, VideoFormat } from "../../lib/video/formats";
import { shownClipText, type ClipTextStyle } from "../clip-text";
import { CLIP_FAMILIES } from "../components/ClipText";
import { ArrowIcon, LogoTile, TEXT_SAFE } from "../components/ui";
import {
  EDITORIAL_FOOTER,
  EDITORIAL_INK,
  EDITORIAL_PUSH,
  EDITORIAL_REVEAL,
  editorialImageFor,
  editorialImages,
  editorialLayout,
  editorialScene,
  editorialStyleOf,
  editorialWords,
  stripHighlight,
  type EditorialLayout,
  type EditorialScene,
} from "../editorial";
import { ensureClipFont, FONT } from "../fonts";
import { partEnd, productionOf, productionParts, type ProductionPart } from "../production";
import type { ProductionReelProps } from "../props";
import { alpha, contrast, ensureContrast, mix, palette, type Palette } from "../theme";
import type { DirectionProps } from "./common";

/**
 * The editorial look (client, 2026-11-26: "a second one that reads images
 * from blog posts and website and create a clean carousel with option to edit
 * it as we edit the video"; his reference: black, huge condensed capitals,
 * the key words in red, a real photo overlapping bottom right). The
 * website's own pictures under big type in the customer's text style (one
 * style for every slide: font, size, colour, case, place, highlight colour).
 *
 * The carousel slides (4:5) and the reel or Story (9:16) draw the same
 * scenes; the reel adds the motion: a slow move on the picture, the words
 * rising one after another, the highlighted ones popping, each part sliding
 * in like a swipe, a thin progress bar. No web address (rule since
 * 2026-11-23). Layouts and places: editorial.ts.
 */

type Motion = { frame: number; fps: number; duration: number } | null;

/** The parts the video shows: a carousel always opens on the hook (as Slides.tsx). */
function partsOf(props: ProductionReelProps, carousel: boolean): ProductionPart[] {
  const production = carousel ? { ...productionOf(props), showHook: true } : productionOf(props);
  return productionParts(props.script, production, props.plan);
}

const formatOf = (props: ProductionReelProps, carousel: boolean): VideoFormat => (carousel ? "carousel" : props.format === "story" ? "story" : "reel");

/** Everything one slide or scene needs, worked out once. */
function sceneOf(props: ProductionReelProps, parts: ProductionPart[], index: number, carousel: boolean) {
  const format = formatOf(props, carousel);
  const part = parts[index];
  const images = editorialImages(props.plan, props.media);
  // The closing card reuses the cover's picture rather than the next one: the brand ends on its opening image.
  const image = editorialImageFor(images, part.role === "cta" ? 0 : index);
  const layout = editorialLayout(index, part.role, Boolean(image));
  const style = editorialStyleOf(props.production, format, props.brand);
  const scene = editorialScene(part.title, part.detail, style, format, layout);
  return { format, part, image, layout, style, scene };
}

/* ------------------------------------------------------------------------- */

/** One carousel slide (1080x1350) of an editorial video: a still, everything settled. */
export function EditorialSlide(props: ProductionReelProps & { index: number }) {
  const parts = partsOf(props, true);
  const index = Math.max(0, Math.min(parts.length - 1, Math.round(props.index)));
  return (
    <AbsoluteFill style={{ fontFamily: FONT, overflow: "hidden", background: EDITORIAL_INK }}>
      <EditorialCanvas props={props} parts={parts} index={index} carousel motion={null} />
    </AbsoluteFill>
  );
}

/** The reel or Story: one scene per part, each sliding in over the last. */
export function EditorialProduction(props: DirectionProps) {
  const { timeline } = props;
  return (
    <>
      {timeline.parts.map((part, index) => {
        const from = timeline.starts[index];
        const duration = Math.max(1, partEnd(timeline, index) - from);
        const last = index === timeline.parts.length - 1;
        return (
          <Sequence key={part.part} from={from} durationInFrames={duration + (last ? 0 : EDITORIAL_PUSH)} layout="none">
            <PushedScene first={index === 0} duration={duration}>
              <AnimatedScene props={props} parts={timeline.parts} index={index} duration={duration} />
            </PushedScene>
          </Sequence>
        );
      })}
      <ProgressBar total={timeline.durationInFrames} color={editorialStyleOf(props.production, formatOf(props, false), props.brand).accent ?? "#ffffff"} />
    </>
  );
}

function AnimatedScene({ props, parts, index, duration }: { props: ProductionReelProps; parts: ProductionPart[]; index: number; duration: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <EditorialCanvas props={props} parts={parts} index={index} carousel={false} motion={{ frame, fps, duration }} />;
}

/** A part entering from the right like a swipe, and pushed left (and darkened) as the next one comes. */
function PushedScene({ first, duration, children }: { first: boolean; duration: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const ease = (t: number) => 1 - (1 - t) ** 3;
  const enter = first ? 1 : ease(interpolate(frame, [0, EDITORIAL_PUSH], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const leave = ease(interpolate(frame, [duration, duration + EDITORIAL_PUSH], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <AbsoluteFill style={{ overflow: "hidden", transform: `translateX(${(1 - enter) * 100 - leave * 30}%)`, background: EDITORIAL_INK }}>
      {children}
      {leave > 0 ? <AbsoluteFill style={{ background: `rgba(0,0,0,${0.6 * leave})` }} /> : null}
    </AbsoluteFill>
  );
}

function ProgressBar({ total, color }: { total: number; color: string }) {
  const frame = useCurrentFrame();
  const done = Math.min(1, frame / Math.max(1, total - 1));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 8, background: "rgba(255,255,255,0.14)", zIndex: 20 }}>
      <div style={{ width: `${done * 100}%`, height: "100%", background: color }} />
    </div>
  );
}


/* ------------------------------------------------------------------------- */

function EditorialCanvas({ props, parts, index, carousel, motion }: { props: ProductionReelProps; parts: ProductionPart[]; index: number; carousel: boolean; motion: Motion }) {
  const { part, image, layout, style, scene } = sceneOf(props, parts, index, carousel);
  const pal = palette(props.brand, "story");
  const accent = style.accent ?? "#ffffff";
  const typeBg = brandGround(props.brand.primary);
  // On the brand colour the highlight must still stand out from it.
  const shownAccent = layout === "type" ? (contrast(accent, typeBg.mid) >= 3 ? accent : ensureContrast(mix(accent, "#ffffff", 0.35), typeBg.mid, 3)) : accent;
  const t = motion ? Math.min(1, motion.frame / Math.max(1, motion.duration + EDITORIAL_PUSH)) : 0;
  const settle = motion ? spring({ frame: motion.frame - 2, fps: motion.fps, config: { damping: 18, stiffness: 110, mass: 0.9 } }) : 1;
  const picture = <Picture layout={layout} image={image} scene={scene} brand={props.brand} pal={pal} index={index} t={t} settle={settle} />;
  return (
    <AbsoluteFill style={{ background: EDITORIAL_INK, overflow: "hidden" }}>
      <Ground layout={layout} image={image} scene={scene} pal={pal} index={index} t={t} typeBg={typeBg} />
      <TextColumn scene={scene} style={style} above={scene.photo && !scene.textTop ? picture : null} below={scene.photo && scene.textTop ? picture : null}>
        <EditorialText title={part.title} detail={part.detail} style={style} scene={scene} accent={shownAccent} motion={motion} />
      </TextColumn>
      <Footer props={props} pal={pal} index={index} total={parts.length} scene={scene} carousel={carousel} layout={layout} settle={settle} />
    </AbsoluteFill>
  );
}

function brandGround(primary: string) {
  const top = mix(primary, "#000000", 0.42);
  const bottom = mix(primary, "#000000", 0.78);
  return { top, bottom, mid: mix(top, bottom, 0.5) };
}

/**
 * The text at the customer's place, and the picture beside it. One column
 * over the text area: the room above the text (its place, giving way when the
 * text would pass the bottom, as ClipText does), the text, the room under it.
 * The picture fills the room on its side, so it starts exactly where the words
 * end, whatever their length, font or size.
 */
function TextColumn({ scene, style, above, below, children }: { scene: EditorialScene; style: ClipTextStyle; above: ReactNode; below: ReactNode; children: ReactNode }) {
  const { frame, bounds } = scene;
  const wanted = Math.round((style.y / 100) * frame.height);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: bounds.top, bottom: frame.height - bounds.bottom, display: "flex", flexDirection: "column", pointerEvents: "none" }}>
      <div style={{ position: "relative", flex: `0 1 ${Math.max(0, wanted - bounds.top)}px`, minHeight: 0 }}>{above}</div>
      <div style={{ position: "relative", flex: "0 0 auto", zIndex: 2 }}>{children}</div>
      <div style={{ position: "relative", flex: "1 1 0", minHeight: 0 }}>{below}</div>
    </div>
  );
}

/** The full-frame grounds: the picture under a gradient, the brand colour, or the black with a soft light. */
function Ground({ layout, image, scene, pal, index, t, typeBg }: { layout: EditorialLayout; image: EditorialImage | null; scene: EditorialScene; pal: Palette; index: number; t: number; typeBg: ReturnType<typeof brandGround> }) {
  const { frame, text, textTop } = scene;
  if (layout === "bleed" || layout === "end") {
    const edge = ((textTop ? text.top + text.height : text.top) / frame.height) * 100;
    const shade =
      layout === "end"
        ? "linear-gradient(180deg, rgba(5,5,7,0.82) 0%, rgba(5,5,7,0.74) 55%, rgba(5,5,7,0.9) 100%)"
        : textTop
          ? `linear-gradient(180deg, rgba(5,5,7,0.9) 0%, rgba(5,5,7,0.78) ${Math.max(10, edge - 8)}%, rgba(5,5,7,0.12) ${Math.min(92, edge + 22)}%, rgba(5,5,7,0.6) 100%)`
          : `linear-gradient(0deg, rgba(5,5,7,0.94) 0%, rgba(5,5,7,0.8) ${Math.max(10, 100 - edge - 6)}%, rgba(5,5,7,0.12) ${Math.min(92, 100 - edge + 24)}%, rgba(5,5,7,0.45) 100%)`;
    return (
      <AbsoluteFill>
        {image ? <Photo image={image} t={t} seed={index} style={layout === "end" ? { filter: "grayscale(0.35)" } : undefined} /> : <TypeGround typeBg={typeBg} index={index} frame={frame} />}
        <AbsoluteFill style={{ background: shade }} />
      </AbsoluteFill>
    );
  }
  if (layout === "type") return <TypeGround typeBg={typeBg} index={index} frame={frame} />;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 60% at 15% 0%, rgba(255,255,255,0.07) 0%, transparent 60%)" }} />
      {layout === "cover" ? <AbsoluteFill style={{ background: `radial-gradient(circle at 78% ${textTop ? 82 : 18}%, ${alpha(pal.accent, 0.16)} 0%, transparent 45%)` }} /> : null}
    </AbsoluteFill>
  );
}

/**
 * The picture beside the text, placed in its room of the column (TextColumn):
 *  - card: a large rounded card across the text area;
 *  - frame: edge to edge, from the text to the frame's edge, fading into black;
 *  - cover: the reference's card on the right, tilted, overlapping the last
 *    line and running off the frame.
 */
function Picture({ layout, image, scene, brand, pal, index, t, settle }: { layout: EditorialLayout; image: EditorialImage | null; scene: EditorialScene; brand: ProductionReelProps["brand"]; pal: Palette; index: number; t: number; settle: number }) {
  const { frame, bounds, textTop, photo } = scene;
  if (!photo) return null;
  const toTop = -bounds.top;
  const toBottom = -(frame.height - bounds.bottom);
  if (layout === "frame") {
    const fade = Math.round(frame.height * 0.16);
    const mask = textTop ? `linear-gradient(180deg, transparent 0px, rgba(0,0,0,0.55) ${Math.round(fade * 0.45)}px, black ${fade}px)` : `linear-gradient(0deg, transparent 0px, rgba(0,0,0,0.55) ${Math.round(fade * 0.45)}px, black ${fade}px)`;
    const place: CSSProperties = textTop ? { top: Math.round(scene.gap * 0.4), bottom: toBottom } : { top: toTop, bottom: Math.round(scene.gap * 0.4) };
    return (
      <div style={{ position: "absolute", left: 0, right: 0, ...place, overflow: "hidden", maskImage: mask, WebkitMaskImage: mask, opacity: settle }}>
        <Photo image={image} t={t} seed={index} />
        {/* The brand row sits on the picture: a little shade under it. */}
        <AbsoluteFill style={{ background: textTop ? "linear-gradient(180deg, transparent 70%, rgba(5,5,7,0.55) 100%)" : undefined }} />
      </div>
    );
  }
  const cover = layout === "cover";
  const bleed = Math.round(frame.height * 0.04);
  const place: CSSProperties = cover
    ? textTop
      ? { top: -scene.overlap, bottom: toBottom - bleed, left: photo.left, width: photo.width }
      : { top: toTop - bleed, bottom: -scene.overlap, left: photo.left, width: photo.width }
    : textTop
      ? { top: scene.gap, bottom: 0, left: bounds.left, right: frame.width - bounds.right }
      : { top: 0, bottom: scene.gap, left: bounds.left, right: frame.width - bounds.right };
  const tilt = cover ? (textTop ? -4 : 4) - (1 - settle) * 5 : 0;
  const lift = (1 - settle) * (textTop ? 140 : -140);
  return (
    <div
      style={{
        position: "absolute",
        ...place,
        borderRadius: cover ? 44 : 36,
        overflow: "hidden",
        transform: `translateY(${lift}px) rotate(${tilt}deg)`,
        boxShadow: "0 40px 90px rgba(0,0,0,0.65), 0 0 0 2px rgba(255,255,255,0.08)",
        opacity: Math.min(1, settle * 1.4),
        background: "#151518",
      }}
    >
      {image ? <Photo image={image} t={t} seed={index} /> : <BrandCard brand={brand} pal={pal} />}
    </div>
  );
}

/** A cover without pictures: the brand's own card in the picture's place. */
function BrandCard({ brand, pal }: { brand: ProductionReelProps["brand"]; pal: Palette }) {
  return (
    <AbsoluteFill style={{ background: `linear-gradient(150deg, ${mix(brand.primary, "#ffffff", 0.08)} 0%, ${mix(brand.primary, "#000000", 0.55)} 100%)`, alignItems: "center", justifyContent: "center" }}>
      <LogoTile brand={brand} size={200} pal={pal} />
    </AbsoluteFill>
  );
}

/** No picture: the brand colour, deep, with the slide's number drawn large and faint. */
function TypeGround({ typeBg, index, frame }: { typeBg: ReturnType<typeof brandGround>; index: number; frame: { width: number; height: number } }) {
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${typeBg.top} 0%, ${typeBg.bottom} 100%)` }}>
      <div
        style={{
          position: "absolute",
          right: -30,
          bottom: Math.round(frame.height * 0.08),
          fontFamily: CLIP_FAMILIES.anton,
          fontSize: Math.round(frame.width * 0.6),
          lineHeight: 0.8,
          color: "transparent",
          WebkitTextStroke: "4px rgba(255,255,255,0.13)",
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </div>
    </AbsoluteFill>
  );
}

/** A picture filling its box, with a slow push (the reel) or still (the carousel). A picture that fails leaves a dark card. */
function Photo({ image, t, seed, style }: { image: EditorialImage | null; t: number; seed: number; style?: CSSProperties }) {
  const [failed, setFailed] = useState(false);
  if (!image || failed) return <AbsoluteFill style={{ background: "linear-gradient(160deg, #1d1d22 0%, #0b0b0d 100%)" }} />;
  const scale = 1.03 + 0.09 * t;
  const dx = (seed % 2 ? 1 : -1) * 18 * t;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img
        src={image.url}
        alt={image.alt ?? ""}
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale}) translateX(${dx}px)`, ...style }}
      />
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------------- */

/**
 * The title in the customer's style, the highlighted words in the highlight
 * colour (never the stars), and the supporting line under it. In the reel
 * the words rise one after another and the highlighted ones pop; `children`
 * (the editor's drag box) cover the block. Placed by TextColumn.
 */
export function EditorialText({ title, detail, style, scene, accent, motion, children }: { title: string; detail: string | null; style: ClipTextStyle; scene: EditorialScene; accent: string; motion: Motion; children?: ReactNode }) {
  ensureClipFont(style.font);
  const { text: box } = scene;
  const words = editorialWords(title);
  const boxed = style.bg === "dark" || style.bg === "light" || style.bg === "orange";
  const background = { none: null, dark: "rgba(18,18,22,0.88)", light: "#ffffff", orange: "#eb651e", highlight: `linear-gradient(transparent 58%, ${alpha(accent, 0.55)} 58%)` }[style.bg];
  const detailText = detail ? stripHighlight(detail) : "";
  const r = EDITORIAL_REVEAL;
  const wordStyle = (i: number, strong: boolean): { outer: CSSProperties; inner: CSSProperties } => {
    if (!motion) return { outer: {}, inner: {} };
    const at = r.start + r.stagger * i;
    const rise = spring({ frame: motion.frame - at, fps: motion.fps, config: { damping: 20, stiffness: 190, mass: 0.6 } });
    const popAt = motion.frame - at - r.pop;
    const pop = strong ? interpolate(popAt, [0, 4, 11], [1, 1.14, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
    const lit = strong ? interpolate(popAt, [0, 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
    return {
      outer: rise < 0.995 ? { overflow: "hidden", verticalAlign: "top", paddingBottom: "0.06em", marginBottom: "-0.06em" } : {},
      inner: { transform: `translateY(${(1 - rise) * 105}%) scale(${pop})`, transformOrigin: "50% 70%", ...(strong ? { color: lit >= 1 ? accent : mix(style.color, accent, lit) } : {}) },
    };
  };
  const detailIn = motion ? spring({ frame: motion.frame - (r.start + r.stagger * words.length + 6), fps: motion.fps, config: { damping: 200, stiffness: 120 } }) : 1;
  const onPhoto = scene.photo === null;
  return (
    <div style={{ position: "relative", marginLeft: box.left, width: box.width, textAlign: style.align, pointerEvents: "none" }}>
      <div
        style={{
          fontFamily: CLIP_FAMILIES[style.font],
          fontSize: box.size,
          fontWeight: style.weight,
          lineHeight: box.lineHeight,
          letterSpacing: style.font === "anton" ? "0.005em" : "-0.02em",
          color: style.color,
          // No lone word on the last line where the browser can help it.
          textWrap: "pretty",
          ...(style.stroke > 0 ? { WebkitTextStroke: `${style.stroke * 4}px ${style.strokeColor}`, paintOrder: "stroke fill", strokeLinejoin: "round" } : {}),
          textShadow: !boxed && onPhoto ? "0 4px 28px rgba(0,0,0,0.45)" : undefined,
          ...TEXT_SAFE,
        }}
      >
        <span
          style={{
            ...(background ? { background, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" } : {}),
            ...(boxed ? { padding: `${Math.round(box.size * 0.1)}px ${Math.round(box.size * 0.3)}px`, borderRadius: Math.round(box.size * 0.18) } : {}),
          }}
        >
          {(() => {
            const draw = (i: number) => {
              const word = words[i];
              const motionStyle = wordStyle(i, word.strong);
              return (
                <span key={i} style={{ display: "inline-block", ...motionStyle.outer }}>
                  <span style={{ display: "inline-block", ...(word.strong && !motion ? { color: accent } : {}), ...motionStyle.inner }}>{shownClipText(word.text, style)}</span>
                </span>
              );
            };
            // A short last word ("IT") never sits alone on the last line: it keeps the word before it.
            const bind = words.length > 2 && words[words.length - 1].text.length <= 3 ? words.length - 2 : -1;
            const nodes: ReactNode[] = [];
            for (let i = 0; i < words.length; i++) {
              if (i === bind) {
                nodes.push(
                  <span key={`b${i}`} style={{ whiteSpace: "nowrap" }}>
                    {draw(i)} {draw(i + 1)}
                  </span>,
                );
                i++;
              } else nodes.push(draw(i));
              if (i < words.length - 1) nodes.push(<Fragment key={`s${i}`}> </Fragment>);
            }
            return nodes;
          })()}
        </span>
      </div>
      {detailText ? (
        <div
          style={{
            marginTop: box.detailGap,
            fontFamily: FONT,
            fontSize: box.detailSize,
            fontWeight: 500,
            lineHeight: 1.3,
            color: alpha(style.bg === "light" ? "#ffffff" : style.color, 0.82),
            textShadow: onPhoto ? "0 2px 16px rgba(0,0,0,0.6)" : undefined,
            opacity: detailIn,
            transform: `translateY(${(1 - detailIn) * 20}px)`,
            textWrap: "pretty",
            ...TEXT_SAFE,
          }}
        >
          {detailText}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** The brand at the bottom left; the slide's place ("02 / 06") or, on the cover, a swipe arrow at the bottom right. Bigger on the closing card. */
function Footer({ props, pal, index, total, scene, carousel, layout, settle }: { props: ProductionReelProps; pal: Palette; index: number; total: number; scene: EditorialScene; carousel: boolean; layout: EditorialLayout; settle: number }) {
  const end = layout === "end";
  const logo = end ? 92 : 56;
  const bottom = carousel ? EDITORIAL_FOOTER.carousel.bottom : scene.frame.height - scene.bounds.bottom - 30 - EDITORIAL_FOOTER.video.height;
  const pad = (k: number) => String(k).padStart(2, "0");
  return (
    <div style={{ position: "absolute", left: scene.bounds.left, right: carousel ? scene.bounds.left : scene.frame.width - scene.bounds.right, bottom, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, opacity: Math.min(1, settle * 1.2) }}>
      <div style={{ display: "flex", alignItems: "center", gap: end ? 22 : 14, minWidth: 0 }}>
        <LogoTile brand={props.brand} size={logo} pal={pal} />
        <span style={{ fontFamily: FONT, fontSize: end ? 40 : 28, fontWeight: 800, color: "#ffffff", textShadow: "0 2px 12px rgba(0,0,0,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{props.brand.name}</span>
      </div>
      {carousel && index === 0 && total > 1 ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 76, height: 76, borderRadius: 38, background: "rgba(10,10,12,0.55)", border: "2px solid rgba(255,255,255,0.55)", flexShrink: 0 }}>
          <ArrowIcon size={40} color="#ffffff" />
        </div>
      ) : carousel ? (
        <span style={{ fontFamily: FONT, fontSize: 26, fontWeight: 700, color: "rgba(255,255,255,0.7)", fontVariantNumeric: "tabular-nums", flexShrink: 0, textShadow: "0 2px 10px rgba(0,0,0,0.6)" }}>
          {pad(index + 1)} / {pad(total)}
        </span>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

/**
 * The editor's drag box for one part (src/app/.../videos/clip-text-editor.tsx):
 * the same text block as the slide or scene draws, unseen, with `children`
 * over it. Null when the part is not shown.
 */
export function EditorialPartText({ props, part, children }: { props: ProductionReelProps; part: number; children?: ReactNode }) {
  const carousel = props.format === "carousel";
  const parts = partsOf(props, carousel);
  const index = parts.findIndex((value) => value.part === part);
  if (index < 0) return null;
  const { part: shown, style, scene } = sceneOf(props, parts, index, carousel);
  return (
    <TextColumn scene={scene} style={style} above={null} below={null}>
      <EditorialText title={shown.title} detail={shown.detail} style={style} scene={scene} accent={style.accent ?? "#ffffff"} motion={null}>
        {children}
      </EditorialText>
    </TextColumn>
  );
}
