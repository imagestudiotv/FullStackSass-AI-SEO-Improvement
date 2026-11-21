import type { HookLibraryClip } from "./hook-library";

/**
 * RepGet's own AI-made hook clips (client, 2026-11-19: "the 10 generated
 * videos on each new ticket", landing in the Viral videos). Each clip is made
 * once with Google's Gemini Omni Flash (scripts/ai-clips.mjs), checked by a
 * person frame by frame, then stored in the video bucket's shared folder
 * (scripts/ai-clips-upload.mjs) - never generated while a customer's video is
 * made, so a video costs nothing more for it.
 *
 * About 70% of videos with a visual hook open on one of these, the rest on
 * the Pixabay library's (hook-library.ts; client: "AI:pixabay = 65%:35%",
 * then 70:30 on 2026-11-21),
 * each with the other as the fallback, then a Pixabay search
 * (footage/hooks.ts opensOnAiClip, make.ts). The
 * customer's text, brand and voice go over the clip as with any hook clip;
 * its own sound is muted. Google's SynthID mark is invisible.
 */
export type AiHookClip = HookLibraryClip & {
  /** Length in ms (all 9:16, 720x1280). */
  durationMs: number;
  /** What the clip was made from, kept to make similar ones. */
  prompt: string;
  /** What making it cost, in USD (the Gemini API's price per second). */
  costUsd: number;
  /** The day it was made (YYYY-MM-DD). */
  madeOn: string;
};

/**
 * RepGet's own AI-made POV clips (client, 2026-11-21: "similar videos, of
 * course without text, the text will be added individually to each client"):
 * a funny reaction character - mostly animals, original cartoon ones too -
 * in the meme cut-out style, 10 s, the top fifth left calm for the caption.
 * A POV clip video (ShotPlan.povClip) shows one full screen with the
 * customer's own POV line on top; half of the viral reels and Stories are
 * POV clip videos (client: "POV clip: 5, others: 5"). Original characters
 * only: never a copyrighted character or a real person.
 */
export type AiPovClip = {
  id: string;
  /** What it shows, for the idea writer to pick one that fits the POV line (English, one sentence). */
  shows: string;
  /** The situations it fits, for matching and the admin page. */
  tags: string[];
  /** Length in ms (all 9:16, 720x1280). */
  durationMs: number;
  prompt: string;
  costUsd: number;
  madeOn: string;
};

export const AI_PROVIDER = "ai";
export const AI_MODEL = "gemini-omni-1.2-flash";
export const AI_LICENCE = "AI-generated for RepGet with Google Gemini Omni Flash (Gemini API terms); RepGet's own footage";
export const AI_CLIP_SIZE = { width: 720, height: 1280 } as const;

/** Where a clip sits in the video bucket: the shared folder, which no website's cleanup touches. */
export function aiClipPath(id: string): string {
  return `shared/ai-clips/${id}.mp4`;
}

/**
 * The checked clips, newest batch last. Ids are "<day>-<subject>"; a removed
 * clip is deleted here (videos already made keep their copy of the URL).
 */
export const AI_HOOK_LIBRARY: readonly AiHookClip[] = [
  // Batch 1, 2026-11-19 (client: "for first 10 I rely on your visual creativity and strong hook possibilities").
  // steel ball rides a wooden marble run and drops into a glass of water
  {
    id: "2026-11-19-marble-run",
    type: "anticipation",
    tags: ["marble", "ball", "track", "run", "glass", "water", "splash", "precision"],
    climaxMs: 5750,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-19",
    prompt:
      "A shiny steel ball rolls down a long twisting wooden marble track on a sunny kitchen table, speeding up through two loops. At about 5 seconds it flies off the last ramp and drops perfectly into a small glass of water, a slow-motion splash rising out of the glass, then the water settles. Photorealistic, vertical 9:16 framing with the action centred, one smooth continuous shot with the camera following the ball, no cuts. Natural sound effects only, no music, no dialogue, no text, no captions, no logos.",
  },
  // paper ball bounces off an office wall into a bin
  {
    id: "2026-11-19-paper-ball-shot",
    type: "anticipation",
    tags: ["paper", "throw", "bin", "office", "trick shot", "aim", "work"],
    climaxMs: 5000,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-19",
    prompt:
      "In a long bright modern office, a crumpled paper ball is thrown from far away. It arcs slowly through the air in slow motion across the room, past desks and plants, bounces once off a white wall at about 4 seconds and at about 5 seconds drops cleanly into a small metal bin, which rocks slightly. Photorealistic, vertical 9:16 framing, one smooth continuous tracking shot, no cuts. Natural sound effects only, no music, no dialogue, no text, no captions, no logos.",
  },
  // needle pops a water balloon, the water keeps its shape
  {
    id: "2026-11-19-water-balloon-pop",
    type: "anticipation",
    tags: ["balloon", "water", "pop", "needle", "slow motion", "macro", "burst"],
    climaxMs: 5000,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-19",
    prompt:
      "Macro slow motion on a white table: a thin needle moves very slowly towards a bright red water balloon. At about 5 seconds the needle touches it and the balloon pops, the red rubber peeling away while the water keeps the balloon's round shape for a moment in mid-air before collapsing in a big splash. Photorealistic, studio light, vertical 9:16 framing with the balloon centred, one continuous shot, no cuts. Natural sound effects only, no music, no dialogue, no text, no captions, no logos.",
  },
  // coffee splash crown turns into glass
  {
    id: "2026-11-19-coffee-crown",
    type: "impossible",
    tags: ["coffee", "drop", "splash", "crown", "freeze", "glass", "cafe", "morning"],
    climaxMs: 4750,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-19",
    prompt:
      "Extreme close-up of a white cup of black coffee on a cafe table. A single drop falls in slow motion and hits the surface, and a perfect crown-shaped splash rises up. At about 5 seconds the splash freezes in mid-air and turns into clear sparkling glass, catching the morning light, while steam keeps drifting around it. Photorealistic, shallow depth of field, vertical 9:16 framing with the cup centred, one continuous shot, no cuts. Natural sound effects only, no music, no dialogue, no text, no captions, no logos.",
  },
  // paper crane on a desk flaps its wings and flies off
  {
    id: "2026-11-19-origami-crane",
    type: "impossible",
    tags: ["paper", "origami", "crane", "desk", "fly", "wings", "idea", "magic"],
    climaxMs: 5250,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-19",
    prompt:
      "A white paper origami crane sits still on a wooden desk next to a laptop in soft morning light. The camera slowly pushes in. At about 5 seconds the paper crane gently flaps its folded wings, lifts off the desk and flies up and away towards the window. Photorealistic, vertical 9:16 framing with the crane centred, one continuous shot, no cuts. Natural sound effects only, no music, no dialogue, no text, no captions, no logos.",
  },
  // tiny storm cloud in a jar flashes lightning
  {
    id: "2026-11-19-storm-in-a-jar",
    type: "impossible",
    tags: ["storm", "cloud", "jar", "lightning", "glass", "weather", "miniature"],
    climaxMs: 4750,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-19",
    prompt:
      "A small glass jar stands on a windowsill in a dim cosy room. Inside the jar a tiny grey storm cloud swirls and grows darker, with a little rain falling inside the glass. At about 5 seconds a small bright bolt of lightning flashes inside the jar and lights up the whole room for a moment. Photorealistic, vertical 9:16 framing with the jar centred, one continuous slow push-in shot, no cuts. Natural sound effects only, no music, no dialogue, no text, no captions, no logos.",
  },
  // glass floor over a canyon cracks under the feet
  {
    id: "2026-11-19-glass-skywalk",
    type: "danger",
    tags: ["glass", "skywalk", "bridge", "canyon", "height", "crack", "travel", "view"],
    climaxMs: 5000,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-19",
    prompt:
      "Point of view looking straight down at a pair of white sneakers standing on a glass skywalk floor high above a deep green canyon with a river far below. A thin crack slowly creeps through the glass towards the feet. At about 5 seconds the crack suddenly branches across the whole glass panel with a sharp sound, and the feet freeze. Nothing breaks and nobody falls. Photorealistic, vertical 9:16 framing, one continuous shot, no cuts. Natural sound effects only, no music, no dialogue, no text, no captions, no logos.",
  },
  // block pulled from a tall wooden tower, it collapses
  {
    id: "2026-11-19-block-tower",
    type: "danger",
    tags: ["jenga", "blocks", "tower", "wood", "collapse", "game", "table", "risk"],
    climaxMs: 5250,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-19",
    prompt:
      "A very tall tower of wooden blocks stands on a table. A hand very slowly slides one block out from near the bottom, and the tower starts to sway. At about 5 seconds the tower collapses in slow motion, wooden blocks tumbling and scattering across the table. Photorealistic, warm light, vertical 9:16 framing with the whole tower in view, one continuous shot, no cuts. Natural sound effects only, no music, no dialogue, no text, no captions, no logos.",
  },
  // climber over the sea hangs by one hand, then catches the hold
  {
    id: "2026-11-19-cliff-climber",
    type: "danger",
    tags: ["climber", "climbing", "cliff", "sea", "rock", "grip", "height", "adventure"],
    climaxMs: 5000,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-19",
    prompt:
      "A rock climber in a harness hangs from a steep overhanging sea cliff by one hand, high above crashing turquoise waves. They swing slightly and reach out for the next small hold, fingers slipping once. At about 5 seconds they lunge and firmly catch the hold with both hands. The climber is seen from the side at a distance, no close-up of the face. Photorealistic, vertical 9:16 framing, one continuous shot, no cuts. Natural sound of wind and waves only, no music, no dialogue, no text, no captions, no logos.",
  },
  // slackliner above the clouds slips and crouches back into balance
  {
    id: "2026-11-19-slackline-wobble",
    type: "danger",
    tags: ["slackline", "balance", "cliff", "height", "clouds", "mountain", "walk", "rope"],
    climaxMs: 4500,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-19",
    prompt:
      "Medium shot from slightly below: a person in a red helmet and climbing harness, filling a third of the frame, balances on a thin slackline high above a sea of clouds and a deep rocky drop. The line bounces and sways hard under their feet, they wobble sideways with arms flailing and one foot slipping off the line. At about 5 seconds they catch the line with the foot, crouch low and freeze perfectly balanced, arms out. No close-up of the face. Photorealistic, golden morning light, vertical 9:16 framing with the walker centred, one continuous shot, no cuts. Natural wind sounds only, no music, no dialogue, no text, no captions, no logos.",
  },
];

/** The checked POV clips, newest batch last (ids "<day>-pov-<subject>"). */
export const AI_POV_LIBRARY: readonly AiPovClip[] = [];

export function povClipById(id: string): AiPovClip | null {
  return AI_POV_LIBRARY.find((clip) => clip.id === id) ?? null;
}

/**
 * Takes that were paid for but not kept (too weak to read in the corner box,
 * wrong physics...), so the spend shown is the real one.
 */
export type AiRejectedTake = { id: string; madeOn: string; costUsd: number; why: string };

export const AI_REJECTED_TAKES: readonly AiRejectedTake[] = [
  { id: "2026-11-19-slackline-clouds", madeOn: "2026-11-19", costUsd: 0.56, why: "the walker was too small to see the wobble; remade closer as 2026-11-19-slackline-wobble" },
];
