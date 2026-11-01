/**
 * Videos (client, 2026-10-29; docs/videos.md): short animated reels and photo
 * carousels made from the website's own content, in the style of the Ootto
 * reel the client sent - faceless motion graphics in the brand's colours,
 * bold headlines, animated checklists and numbers, an AI voice with
 * word-by-word captions, free music and a closing card with the brand.
 *
 * Each day a website gets IDEAS_PER_DAY ideas to swipe through; only the ones
 * approved are made into a video (each one credit, Admin -> Credits
 * "video_post"), and the day is complete after COMPLETE_AFTER approvals.
 *
 * No server imports: the Videos page's client components and the Remotion
 * templates use these too.
 */

export const VIDEO_PLATFORMS = ["instagram", "tiktok", "youtube", "facebook"] as const;
export type VideoPlatform = (typeof VIDEO_PLATFORMS)[number];

export function isVideoPlatform(value: string): value is VideoPlatform {
  return (VIDEO_PLATFORMS as readonly string[]).includes(value);
}

export type VideoBundleType = "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "FACEBOOK";

export type VideoPlatformSpec = {
  name: string;
  bundleType: VideoBundleType;
  /** Whether a photo carousel can be posted there (client: YouTube is reels only). */
  carousel: boolean;
  /** The longest caption the platform takes, in characters. */
  captionMax: number;
};

export const VIDEO_PLATFORM_SPECS: Record<VideoPlatform, VideoPlatformSpec> = {
  instagram: { name: "Instagram", bundleType: "INSTAGRAM", carousel: true, captionMax: 2200 },
  tiktok: { name: "TikTok", bundleType: "TIKTOK", carousel: true, captionMax: 2200 },
  youtube: { name: "YouTube Shorts", bundleType: "YOUTUBE", carousel: false, captionMax: 5000 },
  facebook: { name: "Facebook", bundleType: "FACEBOOK", carousel: true, captionMax: 5000 },
};

/** Ideas a website gets a day to swipe through (client: 20, like the reference site). */
export const IDEAS_PER_DAY = 20;
/** Approvals after which the day shows complete (client: 3 a day). */
export const COMPLETE_AFTER = 3;
/** How a video was made: Make it, a swipe (phone), the → key, Try again, or the AI chat's Confirm. */
export const MAKE_VIA = ["button", "swipe", "key", "retry", "chat"] as const;
export type MakeVia = (typeof MAKE_VIA)[number];

export function isMakeVia(value: unknown): value is MakeVia {
  return typeof value === "string" && (MAKE_VIA as readonly string[]).includes(value);
}

/**
 * Seconds a make from today's ideas can be undone (a press or swipe by
 * mistake), the credit returned. The make-video job waits MAKE_WAIT first,
 * so an undone idea is never started.
 */
export const UNDO_SECONDS = 10;
export const MAKE_WAIT = "15s";

/** Videos RepGet publishes on one platform a day at most, so an account never floods (anti-ban). */
export const MAX_POSTS_PER_DAY = 3;
/** Days the video files are kept after posting (they are on the platforms by then). */
export const FILE_DAYS = 7;
/** Views that earn the customer a "your video took off" email. */
export const MILESTONE_VIEWS = 1000;

/** The kinds of content: a reel (video) or a carousel (photo slides). */
export const VIDEO_FORMATS = ["reel", "carousel"] as const;
export type VideoFormat = (typeof VIDEO_FORMATS)[number];

/**
 * The three styles (client: "2-3 styles"):
 *  - bold: big headlines and an animated checklist, the Ootto look;
 *  - numbers: counters and bars that make each point a figure;
 *  - story: the website's own pictures and the customer's clips, with the
 *    words over them.
 */
export const VIDEO_STYLES = ["bold", "numbers", "story"] as const;
export type VideoStyle = (typeof VIDEO_STYLES)[number];

export function isVideoStyle(value: string): value is VideoStyle {
  return (VIDEO_STYLES as readonly string[]).includes(value);
}

/** OpenAI's voices (lib/video/voice.ts); the first is the default. */
export const VOICES = ["coral", "ash", "nova", "onyx", "sage", "shimmer", "verse", "ballad"] as const;
export type Voice = (typeof VOICES)[number];

export function isVoice(value: string): value is Voice {
  return (VOICES as readonly string[]).includes(value);
}

/** How a ready video goes out: the customer presses Publish, or RepGet publishes it at the next good time. */
export const PUBLISH_MODES = ["manual", "auto"] as const;
export type PublishMode = (typeof PUBLISH_MODES)[number];

/** Frame sizes. A reel is 9:16 for all four platforms; a carousel slide 4:5, the feed's tallest. */
export const REEL = { width: 1080, height: 1920, fps: 30 } as const;
export const SLIDE = { width: 1080, height: 1350 } as const;

/** A reel stays inside every platform's limit for short videos (Facebook Reels: 90 s). */
export const MAX_REEL_SECONDS = 60;

/**
 * The best hours to post short videos, local to the website's country (the
 * usual evening and lunch peaks). RepGet picks the next free one.
 */
export const BEST_HOURS = [12, 18, 20] as const;

/**
 * An idea's script: what the voice says and the screen shows, scene by
 * scene. Written by lib/video/ideas.ts in the website's language.
 */
export type VideoScript = {
  /** The first words: the reason to keep watching. At most 60 characters. */
  hook: string;
  /** Two to four points, each a scene. */
  points: VideoPoint[];
  /** One line of proof or a striking fact from the website. */
  proof: string;
  /** The closing call to action, without a link. */
  cta: string;
};

export type VideoPoint = {
  /** On screen: at most 40 characters. */
  title: string;
  /** What the voice adds: one sentence. */
  detail: string;
  /** For the numbers style: a figure that is on the website (never invented), or null. */
  stat: { value: number; suffix: string; label: string } | null;
};

/** One spoken word and when it is said, for the captions. */
export type CaptionWord = { text: string; startMs: number; endMs: number };

export type BrandLook = {
  name: string;
  domain: string;
  /** Hex colours: the brand's, and the ones derived from it for contrast. */
  primary: string;
  accent: string;
  background: string;
  text: string;
  /** The customer's uploaded logo; null shows the brand's initial instead. */
  logoUrl: string | null;
};

export type MediaItem = { url: string; kind: "image" | "video" };

/** Everything a reel or carousel template needs (src/remotion). */
export type ReelProps = {
  style: VideoStyle;
  brand: BrandLook;
  script: VideoScript;
  /** The voice track, or null when the voice is off (the scenes then run on fixed times). */
  voiceUrl: string | null;
  /** The voice's words with their times; empty without a voice. */
  words: CaptionWord[];
  /** Milliseconds each part of the script is spoken from: hook, each point, proof, CTA. */
  sceneStartsMs: number[];
  /** The voice's length; 0 without one. */
  voiceMs: number;
  music: { url: string; volume: number } | null;
  /** Pictures and clips for the scenes: the website's, then the customer's. */
  media: MediaItem[];
  /** Whether captions are shown (on by default). */
  captions: boolean;
};

/** Seconds each scene lasts when there is no voice to follow. */
export const SILENT_SCENE_SECONDS = { hook: 3, point: 4, proof: 3.5, cta: 3.5 } as const;

/**
 * The scene start times for a script without a voice, and the total length -
 * so the swipe preview and a voice-off video share one timing.
 */
export function silentTiming(script: VideoScript): { sceneStartsMs: number[]; totalMs: number } {
  const lengths = [
    SILENT_SCENE_SECONDS.hook,
    ...script.points.map(() => SILENT_SCENE_SECONDS.point),
    SILENT_SCENE_SECONDS.proof,
    SILENT_SCENE_SECONDS.cta,
  ].map((seconds) => seconds * 1000);
  const sceneStartsMs: number[] = [];
  let at = 0;
  for (const length of lengths) {
    sceneStartsMs.push(at);
    at += length;
  }
  return { sceneStartsMs, totalMs: at };
}

/** The slides of a carousel: a cover, one per point, the proof, the call to action. */
export function slideCount(script: VideoScript): number {
  return 1 + script.points.length + 2;
}

/** The text the voice reads, part by part (hook, points, proof, CTA). */
export function spokenParts(script: VideoScript): string[] {
  return [script.hook, ...script.points.map((point) => `${point.title}. ${point.detail}`), script.proof, script.cta];
}
