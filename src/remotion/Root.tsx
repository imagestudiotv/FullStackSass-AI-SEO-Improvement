import { Composition, Still, type CalculateMetadataFunction } from "remotion";

import { REEL, SLIDE, silentTiming, type ReelProps, type VideoScript } from "../lib/video/formats";
import { Reel } from "./Reel";
import { Slide, type SlideProps } from "./Slide";
import { reelTiming } from "./timing";

/**
 * The compositions the renderer and Remotion Studio see: "Reel" (9:16 video)
 * and "Slide" (one 4:5 carousel image, chosen by `index`). The sample props
 * are a fictional SEO agency, so Studio and test renders have something to show.
 */

const SAMPLE_SCRIPT: VideoScript = {
  hook: "3 SEO fixes that doubled our traffic",
  points: [
    {
      title: "Make every page load fast",
      detail: "Pages that open in under two seconds keep 53% more visitors reading.",
      stat: { value: 53, suffix: "%", label: "more visitors stay" },
    },
    {
      title: "Answer the questions people ask",
      detail: "Write one page per question your customers type into Google, in their own words.",
      stat: { value: 3, suffix: "x", label: "more long-tail clicks" },
    },
    {
      title: "Earn links from local partners",
      detail: "Google trusts the sites your neighbours, suppliers and local press already trust.",
      stat: null,
    },
  ],
  proof: "Our clients get 2.4x more organic leads within six months.",
  cta: "Book your free SEO audit today.",
};

export const SAMPLE_REEL: ReelProps = {
  style: "bold",
  brand: {
    name: "Rankwell",
    domain: "rankwell.io",
    primary: "#4F46E5",
    accent: "#F59E0B",
    background: "#EEF0FF",
    text: "#14141C",
    logoUrl: null,
  },
  script: SAMPLE_SCRIPT,
  voiceUrl: null,
  words: [],
  sceneStartsMs: silentTiming(SAMPLE_SCRIPT).sceneStartsMs,
  voiceMs: 0,
  music: null,
  media: [],
  captions: true,
};

const reelMetadata: CalculateMetadataFunction<ReelProps> = ({ props }) => ({
  durationInFrames: reelTiming(props, REEL.fps).durationInFrames,
});

export const RemotionRoot = () => (
  <>
    <Composition
      id="Reel"
      component={Reel}
      width={REEL.width}
      height={REEL.height}
      fps={REEL.fps}
      durationInFrames={reelTiming(SAMPLE_REEL, REEL.fps).durationInFrames}
      defaultProps={SAMPLE_REEL}
      calculateMetadata={reelMetadata}
    />
    <Still id="Slide" component={Slide} width={SLIDE.width} height={SLIDE.height} defaultProps={{ ...SAMPLE_REEL, index: 0 } satisfies SlideProps} />
  </>
);
