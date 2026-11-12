import type {
  CreativeDirection,
  ProductionChoices,
  ReelProps,
  ShotPlan,
  VideoFormat,
  VisualSource,
} from "../lib/video/formats";

/**
 * The props of the "Reel" and "Slide" compositions since the viral content
 * upgrade (client, 2026-11-12: "genuinely different video formats").
 *
 * A superset of ReelProps (lib/video/formats.ts): an idea without a plan, or
 * with direction "animated", renders exactly as before (the Bold, Numbers and
 * Story templates), so the swipe preview and older rows keep working with
 * plain ReelProps. With a plan, the direction picks a production of its own
 * (src/remotion/directions).
 *
 * No server imports: the Videos page's Player uses these too.
 */

/** A real picture or clip for one scene, resolved when the video is made (lib/video/assets.ts). */
export type SceneMedia = {
  url: string;
  kind: "image" | "video";
  source: VisualSource;
  /** Where the subject sits, 0..1 from the left/top, for the 9:16 crop; default the centre. */
  focalX?: number;
  focalY?: number;
  /** A clip's length, so a scene longer than the clip loops it instead of freezing. */
  durationMs?: number | null;
  /**
   * Stock or AI footage paired with words about people ("our client", "meet
   * the team"): the video marks it as illustrative so stock actors are never
   * passed off as the customer's clients or staff.
   */
  illustrative?: boolean;
};

export type ProductionReelProps = ReelProps & {
  direction?: CreativeDirection | null;
  plan?: ShotPlan | null;
  production?: ProductionChoices | null;
  /** reel (default), story (Story safe zones, <= 60 s) or carousel. */
  format?: VideoFormat;
  /** Per spokenParts(script) index: the scene's picture or clip; null = none resolved. */
  sceneMedia?: (SceneMedia | null)[] | null;
  /**
   * A voiced production speaks only the parts it shows (no hook card when
   * showHook is off, no CTA when includeCta is off): the spokenParts indexes
   * spoken, in order, which sceneStartsMs is aligned with. null = all parts.
   */
  spokenParts?: number[] | null;
  /**
   * The swipe preview before the video is made: footage, voice and music are
   * chosen at make time, so scenes without media show labelled placeholder
   * frames and the video says it is a concept. Never the final video.
   */
  concept?: boolean;
  /** The script's language (ISO code), for the few words the templates write themselves. */
  language?: string;
};

/** Whether the props describe one of the new productions (else the original templates render). */
export function isProduction(input: object): boolean {
  const props = input as Partial<Pick<ProductionReelProps, "direction" | "plan">>;
  return Boolean(props.direction && props.direction !== "animated" && props.plan && Array.isArray(props.plan.scenes));
}
