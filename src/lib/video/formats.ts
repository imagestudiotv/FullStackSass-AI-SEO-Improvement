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

export const VIDEO_PLATFORMS = ["instagram", "tiktok", "youtube", "facebook", "pinterest", "linkedin", "x"] as const;
export type VideoPlatform = (typeof VIDEO_PLATFORMS)[number];

export function isVideoPlatform(value: string): value is VideoPlatform {
  return (VIDEO_PLATFORMS as readonly string[]).includes(value);
}

/**
 * The platforms every website had before LinkedIn and X (2026-11-12): the
 * default list for a website without saved settings. A new platform is never
 * added to a customer's list without their choice.
 */
export const ORIGINAL_VIDEO_PLATFORMS: readonly VideoPlatform[] = ["instagram", "tiktok", "youtube", "facebook", "pinterest"];

export type VideoBundleType = "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "FACEBOOK" | "PINTEREST" | "LINKEDIN" | "TWITTER";

export type VideoPlatformSpec = {
  name: string;
  bundleType: VideoBundleType;
  /** Whether a photo carousel can be posted there (client: YouTube is reels only). */
  carousel: boolean;
  /** The longest caption the platform takes, in characters. */
  captionMax: number;
  /** The longest title, where a post has one besides its caption (a Short's, a Pin's). */
  titleMax: number | null;
  /**
   * Whether a post there goes to a board (Pinterest): the one the social Pins
   * use, social_accounts.target, chosen on Opportunities. Without a board
   * nothing is sent there.
   */
  board: boolean;
  /** Whether a real Story can be posted there through bundle.social (never a reel sent as a Story). Worker D verifies. */
  story: boolean;
  /** The longest reel/short the platform takes through the API, in seconds. Worker D verifies. */
  maxVideoSeconds: number;
  /** The longest Story video, in seconds; null where there are no Stories. */
  storyMaxSeconds: number | null;
};

export const VIDEO_PLATFORM_SPECS: Record<VideoPlatform, VideoPlatformSpec> = {
  instagram: { name: "Instagram", bundleType: "INSTAGRAM", carousel: true, captionMax: 2200, titleMax: null, board: false, story: true, maxVideoSeconds: 90, storyMaxSeconds: 60 },
  tiktok: { name: "TikTok", bundleType: "TIKTOK", carousel: true, captionMax: 2200, titleMax: null, board: false, story: false, maxVideoSeconds: 600, storyMaxSeconds: null },
  youtube: { name: "YouTube Shorts", bundleType: "YOUTUBE", carousel: false, captionMax: 5000, titleMax: 100, board: false, story: false, maxVideoSeconds: 180, storyMaxSeconds: null },
  facebook: { name: "Facebook", bundleType: "FACEBOOK", carousel: true, captionMax: 5000, titleMax: null, board: false, story: true, maxVideoSeconds: 90, storyMaxSeconds: 60 },
  /*
    A video Pin (client, 2026-11-02). bundle.social's PINTEREST data is a
    single Pin - boardName (required), a title (`text`), a description,
    uploadIds, an optional link - with no post type and no carousel items,
    unlike Instagram's POST/REEL or TikTok's IMAGE/VIDEO. Pinterest's own
    carousel Pins take 2 to 5 images, and a carousel here has 5 to 7 slides:
    so carousels are not sent there, as on YouTube. A title of 100 characters
    and a description of 800, as the social Pins (lib/social/platforms.ts); a
    video of 4 s to 15 min, which a reel of MAX_REEL_SECONDS fits.
  */
  pinterest: { name: "Pinterest", bundleType: "PINTEREST", carousel: false, captionMax: 800, titleMax: 100, board: true, story: false, maxVideoSeconds: 900, storyMaxSeconds: null },
  /* LinkedIn (client, 2026-11-12): a profile or a company page, connected through bundle.social. Limits verified by Worker D. */
  linkedin: { name: "LinkedIn", bundleType: "LINKEDIN", carousel: false, captionMax: 3000, titleMax: null, board: false, story: false, maxVideoSeconds: 600, storyMaxSeconds: null },
  /*
    X (client, 2026-11-12): the same account as the social posts (social_accounts
    platform "x", bundle type TWITTER). X meters each post, so videos go there
    only when configured with a spending limit (Worker D).
  */
  x: { name: "X", bundleType: "TWITTER", carousel: false, captionMax: 280, titleMax: null, board: false, story: false, maxVideoSeconds: 140, storyMaxSeconds: null },
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
/**
 * The earlier milestone, a lifecycle email (lib/email/lifecycle-triggers.ts):
 * sent once per video, only while the kill switch is on, and not when a
 * video jumps straight past MILESTONE_VIEWS - that one says it already.
 */
export const EARLY_MILESTONE_VIEWS = 500;

/**
 * The output formats: a reel/short (9:16 video), a Story (9:16 video, only
 * where VIDEO_PLATFORM_SPECS.story - never a reel sent as a Story), or a photo
 * carousel (1080x1350 slides).
 */
export const VIDEO_FORMATS = ["reel", "story", "carousel"] as const;
export type VideoFormat = (typeof VIDEO_FORMATS)[number];

export function isVideoFormat(value: unknown): value is VideoFormat {
  return typeof value === "string" && (VIDEO_FORMATS as readonly string[]).includes(value);
}

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

/**
 * How a ready video goes out:
 *  - manual ("Review before publishing"): it waits in Your videos for the customer's Publish;
 *  - draft ("Save as draft"): kept in Your videos as a draft, sent nowhere (not a bundle.social DRAFT);
 *  - auto ("Auto-publish approved ideas"): RepGet publishes each made video at the next good
 *    time within the posting frequency - only after the customer chose it.
 */
export const PUBLISH_MODES = ["manual", "draft", "auto"] as const;
export type PublishMode = (typeof PUBLISH_MODES)[number];

/** Frame sizes. A reel is 9:16 for every platform; a carousel slide 4:5, the feed's tallest. */
export const REEL = { width: 1080, height: 1920, fps: 30 } as const;
export const SLIDE = { width: 1080, height: 1350 } as const;

/**
 * The longest reel RepGet makes: the "60-90 seconds" choice (client,
 * 2026-11-12). Each destination's own limit (VIDEO_PLATFORM_SPECS
 * maxVideoSeconds / storyMaxSeconds) is checked before making and scheduling.
 */
export const MAX_REEL_SECONDS = 90;

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

/* ------------------------------------------------------------------------- */
/* Viral social content (client, 2026-11-12): the shared contract.            */
/* Coordinator-owned. Workers ask for changes instead of editing this block.  */
/* ------------------------------------------------------------------------- */

/** What an idea is for: the content strategy. Separate from how it is produced (CreativeDirection) and its output (VideoFormat). */
export const IDEA_CATEGORIES = ["viral", "educational", "authority", "promotional"] as const;
export type IdeaCategory = (typeof IDEA_CATEGORIES)[number];

export function isIdeaCategory(value: unknown): value is IdeaCategory {
  return typeof value === "string" && (IDEA_CATEGORIES as readonly string[]).includes(value);
}

/**
 * How a video is produced - genuinely different productions, not a different hook:
 *  - meme: a relatable POV/reaction situation, top caption, reaction cuts, comic timing;
 *  - footage: real-world stock/customer clips, full-screen, kinetic captions;
 *  - storytelling: situation -> development -> resolution over footage/pictures;
 *  - text_music: fast animated typography over visuals, no narration;
 *  - voiceover: narration over relevant footage with transitions, captions and music;
 *  - animated: the original motion-graphics templates (VideoStyle bold/numbers/story).
 */
export const CREATIVE_DIRECTIONS = ["meme", "footage", "storytelling", "text_music", "voiceover", "animated"] as const;
export type CreativeDirection = (typeof CREATIVE_DIRECTIONS)[number];

export function isCreativeDirection(value: unknown): value is CreativeDirection {
  return typeof value === "string" && (CREATIVE_DIRECTIONS as readonly string[]).includes(value);
}

/** The audio choice in settings (client: Auto is the default). */
export const AUDIO_MODES = ["auto", "voiceover", "text_music"] as const;
export type AudioMode = (typeof AUDIO_MODES)[number];
/** An idea's audio once Auto is resolved by the idea writer: never "auto". Text + Music never calls narration or transcription. */
export type ResolvedAudio = Exclude<AudioMode, "auto">;

export const NARRATION_STYLES = ["natural", "warm", "energetic"] as const;
export type NarrationStyle = (typeof NARRATION_STYLES)[number];

export const CAPTION_STYLES = ["bold", "editorial", "minimal"] as const;
export type CaptionStyle = (typeof CAPTION_STYLES)[number];

export const MUSIC_DIRECTIONS = ["auto", "cinematic", "upbeat", "ambient", "none"] as const;
export type MusicDirection = (typeof MUSIC_DIRECTIONS)[number];

export const DURATION_RANGES = ["15-30", "30-45", "45-60", "60-90"] as const;
export type DurationRange = (typeof DURATION_RANGES)[number];
export const DURATION_SECONDS: Record<DurationRange, { min: number; max: number }> = {
  "15-30": { min: 15, max: 30 },
  "30-45": { min: 30, max: 45 },
  "45-60": { min: 45, max: 60 },
  "60-90": { min: 60, max: 90 },
};

export const CONTENT_GOALS = ["reach", "balanced", "leads"] as const;
export type ContentGoal = (typeof CONTENT_GOALS)[number];

/** How the non-viral rest of a batch is split, by goal (percent; client defaults). */
export const NON_VIRAL_SPLIT: Record<ContentGoal, Record<Exclude<IdeaCategory, "viral">, number>> = {
  balanced: { educational: 50, authority: 30, promotional: 20 },
  reach: { educational: 60, authority: 30, promotional: 10 },
  leads: { educational: 30, authority: 30, promotional: 40 },
};

/** Viral techniques (mockup). "trend_inspired" replaces the mockup's "Trending topics": no claim of current trends without data. */
export const VIRAL_TECHNIQUES = [
  "curiosity_hooks",
  "trend_inspired",
  "myth_busting",
  "hot_takes",
  "before_after",
  "unexpected_facts",
  "comparisons",
  "storytelling",
] as const;
export type ViralTechnique = (typeof VIRAL_TECHNIQUES)[number];
export const DEFAULT_TECHNIQUES: readonly ViralTechnique[] = ["curiosity_hooks", "trend_inspired", "myth_busting"];

/** Brand voice presets; applied next to brand_voice.tone (free text), never replacing it. */
export const TONE_PRESETS = ["professional", "bold", "playful"] as const;
export type TonePreset = (typeof TONE_PRESETS)[number];

/** Noncritical creative preferences the customer may adjust (client). Core protections are not settings. */
export const HUMOR_LEVELS = ["none", "light", "bold"] as const;
export type HumorLevel = (typeof HUMOR_LEVELS)[number];

/** Automatic posting volume. null in settings = before 2026-11-12: each made video at the next best hour. */
export const POSTING_FREQUENCIES = ["3_week", "5_week", "1_day", "2_day"] as const;
export type PostingFrequency = (typeof POSTING_FREQUENCIES)[number];
/** The most automatic posts a day, whatever the frequency (client: keep three). */
export const MAX_AUTO_POSTS_PER_DAY = 3;

/* Ideas: the free daily batch and the free extra batches. */
export const DAILY_BATCH_SIZE = IDEAS_PER_DAY;
export const EXTRA_BATCH_SIZE = 10;
export const EXTRA_BATCHES_PER_DAY = 3;
/** 20 daily + 3 x 10 extra. */
export const MAX_IDEAS_PER_DAY = DAILY_BATCH_SIZE + EXTRA_BATCH_SIZE * EXTRA_BATCHES_PER_DAY;
/** A batch: the day's first 20, or one of the New ideas menu's three kinds. */
export const BATCH_KINDS = ["daily", "mixed", "viral", "website"] as const;
export type BatchKind = (typeof BATCH_KINDS)[number];
export type ExtraBatchKind = Exclude<BatchKind, "daily">;
export const BATCH_STATUSES = ["reserved", "writing", "done", "failed"] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

/* Review: what must be checked by a person before automatic publishing. */
export const REVIEW_STATUSES = ["none", "required", "approved"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export const REVIEW_REASONS = ["unverified_claim", "controversial", "sensitive"] as const;
export type ReviewReason = (typeof REVIEW_REASONS)[number];

/** A factual statement in a script, and where it comes from (null: not found in the material -> review). */
export type FactClaim = { text: string; source: string | null };

/* Shot plan: how each scene of a script is produced. */
export const TRANSITIONS = ["cut", "zoom", "whip", "slide", "flash", "glitch", "fade"] as const;
export type Transition = (typeof TRANSITIONS)[number];
export const PACINGS = ["fast", "medium", "calm"] as const;
export type Pacing = (typeof PACINGS)[number];
export const VISUAL_SOURCES = ["customer", "stock", "ai_image", "article", "brand"] as const;
export type VisualSource = (typeof VISUAL_SOURCES)[number];

/** What a scene should show; resolved to a real asset when the video is made. */
export type VisualRequest = {
  /** Preferred source; the resolver falls back customer -> stock -> article -> ai_image -> brand within the budget. */
  source: VisualSource;
  /** Stock/AI search words in English, concrete and filmable ("barista pouring latte art close-up"). */
  query: string;
  kind: "video" | "image";
};

/**
 * One scene. scenes[] is aligned with spokenParts(script): hook, each point,
 * proof, cta - so voice timing and the editor keep working for every direction.
 */
export type ShotScene = {
  visual: VisualRequest;
  /** The transition into this scene. */
  transition: Transition;
  /** Meme: the reaction beat ("😳", "wait…"); otherwise null. */
  reaction: string | null;
  /** Meme/storytelling: a top caption ("POV: …"); otherwise null. */
  overlay: string | null;
};

export type ShotPlan = {
  direction: CreativeDirection;
  pacing: Pacing;
  captionStyle: CaptionStyle;
  /** Mood for the licensed music when music is on; null = none. */
  musicMood: string | null;
  scenes: ShotScene[];
  /**
   * A fingerprint of the production recipe (direction/pacing/transition set/
   * caption style/music mood/visual mix) the variety rules compare, so a day
   * never repeats near-identical videos.
   */
  recipe: string;
};

/** A real asset used in a video, with where it came from and its licence (kept for the record). */
export type ResolvedAsset = {
  sceneIndex: number;
  url: string;
  kind: "image" | "video";
  source: VisualSource;
  /** e.g. "pixabay", "pexels", "customer", "openai", "article". */
  provider: string;
  providerId: string | null;
  licence: string;
  sourceUrl: string | null;
  author: string | null;
  /** video_stock_assets.id when cached there. */
  assetId: string | null;
};

/** Per-video production choices: a snapshot of the settings when the idea is written, editable per video. */
export type ProductionChoices = {
  audio: ResolvedAudio;
  narration: NarrationStyle;
  captionStyle: CaptionStyle;
  music: MusicDirection;
  duration: DurationRange;
  showHook: boolean;
  includeCta: boolean;
  /** The closing call to action; null = the idea's own. */
  ctaText: string | null;
};

/** Per-video overrides of the global profile/brand voice; they never change the global settings. */
export type IdeaOverrides = {
  audience?: string;
  tone?: string;
  avoid?: string;
  tonePreset?: TonePreset;
};

/* Internal production cost (not a customer price). */
/** The intended maximum internal production cost of one standard video (client, 2026-11-12). */
export const PRODUCTION_BUDGET_USD = 0.3;
/** Kept free before any paid step, for estimate error. */
export const BUDGET_SAFETY_MARGIN_USD = 0.03;
export const COST_KINDS = ["planning", "narration", "transcription", "image", "footage", "render", "storage", "audio_mux"] as const;
export type CostKind = (typeof COST_KINDS)[number];
/** measured: the provider's own figure or usage; estimated: our formula; unmeasured: not known (never counted as zero). */
export type CostBasis = "measured" | "estimated" | "unmeasured";
export type CostItem = { kind: CostKind; provider: string; usd: number | null; basis: CostBasis; attempt: number; at: string; note?: string };
/** The logical video's ledger across every attempt (retries never reset it). */
export type CostLedger = { budgetUsd: number; reservedUsd: number; items: CostItem[] };

/* Publishing: per destination. */
export type DestinationStatus = "pending" | "scheduled" | "posting" | "posted" | "failed" | "skipped";
export type DestinationState = {
  status: DestinationStatus;
  bundlePostId: string | null;
  url: string | null;
  error: string | null;
  attempts: number;
};

/** Instagram native audio chosen for a reel (bundle.social Instagram audio). */
export type NativeAudioSelection = {
  provider: "instagram";
  audioId: string;
  title: string;
  artist: string | null;
  /** Native track volume and the original audio's, as the provider accepts them. */
  volume: number | null;
  originalVolume: number | null;
  /** Only when the provider returned real trending data for it. */
  trending: boolean;
  selectedAt: string;
};
