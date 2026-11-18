import type { HookType } from "../formats";

/**
 * The hand-picked hook clips (client, 2026-11-18): Pixabay videos reviewed
 * once, by type, each with the moment its climax starts - so the opening is
 * cut just before it and the payoff plays from it. Fetched by id through the
 * Pixabay API and stored like any stock file (footage/store.ts); Pixabay
 * Content License. Picked with scripts/hook-library.mjs.
 *
 * A video with a visual hook tries these first (footage/hooks.ts), then a
 * Pixabay search with safe words (strategy/hooks.ts).
 */
export type HookLibraryClip = {
  /** The Pixabay video id. */
  id: string;
  type: HookType;
  /** What it shows, for matching the writer's search words. */
  tags: string[];
  /** Where the climax starts, in ms from the clip's start. */
  climaxMs: number;
  /** Where the subject sits across a landscape clip, 0..1 from the left (the 9:16 crop); default the centre. */
  focalX?: number;
};

/**
 * Picked 2026-11-18 from about 450 Pixabay candidates (three search rounds) (scripts/hook-library.mjs):
 * each checked frame by frame for a clear climax, a 9:16 crop and safety
 * (no injury, fire, vehicles, children or animals). Pixabay's free catalogue
 * is thin for these effects; more can be added the same way.
 */
export const HOOK_LIBRARY: readonly HookLibraryClip[] = [
  // Ground-level putt rolls into the hole
  { id: "18080", type: "anticipation", tags: ["golf", "putt", "ball", "hole", "green", "golfer"], climaxMs: 7500, focalX: 0.55 },
  // Domino wave topples the last standing pieces
  { id: "28659", type: "anticipation", tags: ["domino", "dominoes", "chain", "toppling", "falling"], climaxMs: 4500, focalX: 0.68 },
  // first dart misses, second hits bullseye
  { id: "115074", type: "anticipation", tags: ["darts", "bullseye", "dartboard", "throw"], climaxMs: 7500, focalX: 0.5 },
  // layup rolls around rim, drops in
  { id: "43594", type: "anticipation", tags: ["basketball", "layup", "hoop", "rim", "outdoor"], climaxMs: 9000, focalX: 0.74 },
  // skater pops kickflip and lands it
  { id: "37845", type: "anticipation", tags: ["skateboard", "kickflip", "trick", "landing", "street"], climaxMs: 3000, focalX: 0.45 },
  // spinning coin wobbles down, falls flat
  { id: "12564", type: "anticipation", tags: ["coin", "spinning", "table", "settling"], climaxMs: 17250, focalX: 0.45 },
  // golden-hour wave bursts into huge slow splash
  { id: "183960", type: "anticipation", tags: ["wave", "splash", "sunset", "sea", "slow motion"], climaxMs: 9750, focalX: 0.55 },
  // plasma bolts flare out to the glass
  { id: "11414", type: "impossible", tags: ["plasma", "globe", "lightning", "electricity", "science"], climaxMs: 8250, focalX: 0.51 },
  // rainbow swirl surges across soap film
  { id: "220647", type: "impossible", tags: ["soap", "bubble", "rainbow", "colours", "swirl", "macro"], climaxMs: 3750, focalX: 0.5 },
  // red ink cloud billows down through water
  { id: "44580", type: "impossible", tags: ["ink", "water", "glass", "red", "plume"], climaxMs: 11000, focalX: 0.48 },
  // orchid bud opens into full flower
  { id: "17869", type: "impossible", tags: ["orchid", "flower", "bloom", "timelapse", "white"], climaxMs: 9000, focalX: 0.5 },
  // cherry buds burst into white blossoms
  { id: "15614", type: "impossible", tags: ["cherry", "blossom", "bloom", "timelapse", "branch"], climaxMs: 12000, focalX: 0.5 },
  // drooping daffodil bud opens orange trumpet
  { id: "112389", type: "impossible", tags: ["daffodil", "flower", "bloom", "timelapse", "spring"], climaxMs: 27000, focalX: 0.5 },
  // frost crystals sweep over glowing bubble
  { id: "326483", type: "impossible", tags: ["soap", "bubble", "frost", "crystals", "freezing"], climaxMs: 3500, focalX: 0.55 },
  // second ink plume plunges, blooms into cloud
  { id: "20072", type: "impossible", tags: ["ink", "water", "blue", "cloud", "swirl"], climaxMs: 16000, focalX: 0.5 },
  // red flower bursts open, stamens unfurl
  { id: "107914", type: "impossible", tags: ["flower", "bloom", "timelapse", "red", "stamens"], climaxMs: 10500, focalX: 0.5 },
  // snow dome melts away to green
  { id: "112986", type: "impossible", tags: ["snow", "melting", "timelapse", "plant", "ice"], climaxMs: 25000, focalX: 0.45 },
  // flyer drops from handstand, partner catches her
  { id: "35235", type: "danger", tags: ["acrobats", "hand", "balance", "lift", "catch"], climaxMs: 15750, focalX: 0.57 },
  // pilot runs, lifts off the ridge edge
  { id: "49509", type: "danger", tags: ["paraglider", "launch", "wing", "ridge", "sunset"], climaxMs: 11000, focalX: 0.55 },
  // surfer tucks into barrel under crashing lip
  { id: "368", type: "danger", tags: ["surfer", "big", "wave", "barrel", "ocean"], climaxMs: 7000, focalX: 0.42 },
  // surfer drops under breaking lip, rides out
  { id: "13772", type: "danger", tags: ["surfer", "big", "wave", "ocean", "aerial"], climaxMs: 7250, focalX: 0.38 },
];
