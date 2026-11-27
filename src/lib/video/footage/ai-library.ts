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
  // Batch 3, 2026-11-26 (client: "for next ticket we will generate 20 clips"): 8 of 10 kept.
  // the press squashes a clear jelly ball until it bursts
  {
    id: "2026-11-26-hydraulic-press-bubble",
    type: "anticipation",
    tags: ["press", "pressure", "squeeze", "satisfying", "slow", "crunch"],
    climaxMs: 5000,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-26",
    prompt:
      "A shiny steel hydraulic press slowly lowers onto a perfectly round clear jelly ball on a metal plate in a clean workshop. The jelly bulges and stretches more and more, and at about 5 seconds it bursts outward in a slow-motion glossy splash. Photorealistic, vertical 9:16 framing, macro close-up, the press entering from the top, one smooth continuous shot, no cuts. Natural sound effects only, no music, no dialogue, no text, no captions, no logos.",
  },
  // a hand adds one more cube to a tall ice-cube tower, which holds
  {
    id: "2026-11-26-ice-cube-tower",
    type: "anticipation",
    tags: ["balance", "tower", "stacking", "steady hands", "will it fall", "patience"],
    climaxMs: 4500,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-26",
    prompt:
      "A hand carefully places one more ice cube on top of a tall wobbly tower of ice cubes on a dark marble counter, water droplets glistening. The tower sways, the hand slowly lets go, and the tower holds perfectly still at about 5 seconds while light glints through the ice. Photorealistic, vertical 9:16 framing, the tower centred and tall in frame, one smooth continuous shot, no cuts. Natural sound effects only, no music, no dialogue, no text, no captions, no logos.",
  },
  // a paper plane glides across an office and lands in a mug
  {
    id: "2026-11-26-paper-plane-window",
    type: "anticipation",
    tags: ["paper plane", "throw", "target", "aim", "perfect shot", "office"],
    climaxMs: 6500,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-26",
    prompt:
      "In a bright open-plan office, a white paper plane is thrown from across the room and glides in a long smooth arc between desks and chairs, and at about 6 seconds it lands perfectly inside a narrow coffee mug on a far desk. Photorealistic, vertical 9:16 framing, the camera following the plane, one smooth continuous shot, no cuts. Natural sound effects only, no music, no dialogue, no text, no captions, no logos.",
  },
  // poured water gathers into a floating sphere
  {
    id: "2026-11-26-floating-water-sphere",
    type: "impossible",
    tags: ["water", "floating", "sphere", "zero gravity", "magic", "impossible"],
    climaxMs: 3200,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-26",
    prompt:
      "In a calm sunlit living room, water poured from a glass jug does not fall but gathers in mid-air into a perfect floating sphere of water, slowly rotating and catching the light, small droplets orbiting around it. Photorealistic, vertical 9:16 framing, the sphere in the centre, one smooth continuous shot, no cuts. Gentle natural sound only, no music, no dialogue, no text, no captions, no logos.",
  },
  // a white spiral staircase rises from a meadow into the clouds
  {
    id: "2026-11-26-staircase-into-sky",
    type: "impossible",
    tags: ["stairs", "sky", "clouds", "growth", "climbing", "impossible", "surreal"],
    climaxMs: 4500,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-26",
    prompt:
      "A white spiral staircase rises from a green meadow straight up into the clouds, each step appearing just before the camera reaches it as the camera climbs upward along the staircase, golden sunset light. Photorealistic but surreal, vertical 9:16 framing, the staircase centred, one smooth continuous upward shot, no cuts. Gentle wind sound only, no music, no dialogue, no people, no text, no captions, no logos.",
  },
  // an old book opens and a tiny city unfolds out of it
  {
    id: "2026-11-26-book-city-unfolds",
    type: "impossible",
    tags: ["book", "city", "pop-up", "building", "growth", "magic", "surreal"],
    climaxMs: 3000,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-26",
    prompt:
      "An old leather book lying on a wooden desk opens by itself, and a tiny detailed city rises out of the pages like a living pop-up book: buildings unfolding, little trees springing up, tiny lights switching on in the windows. Photorealistic miniature look, vertical 9:16 framing, the book in the lower half, the camera slowly pushing in, one smooth continuous shot, no cuts. Soft natural sound only, no music, no dialogue, no text, no captions, no logos.",
  },
  // a biker rides a knife-edge ridge above the clouds
  {
    id: "2026-11-26-mountain-bike-ridge",
    type: "danger",
    tags: ["ridge", "mountain", "bike", "edge", "focus", "risk", "steady"],
    climaxMs: 5100,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-26",
    prompt:
      "A mountain biker in a red jacket rides along a very narrow rocky ridge high in the mountains, steep drops on both sides and clouds below, and at about 5 seconds hops over a gap in the rocks and keeps riding steadily. Seen from behind by a following drone, the rider small in frame and never facing the camera. Photorealistic, vertical 9:16 framing, one smooth continuous shot, no cuts. Wind sound only, no music, no dialogue, no text, no captions, no logos.",
  },
  // a diver leaps off a white cliff into a turquoise sea
  {
    id: "2026-11-26-cliff-diver-blue",
    type: "danger",
    tags: ["dive", "cliff", "jump", "leap", "courage", "sea", "go for it"],
    climaxMs: 4000,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-26",
    prompt:
      "A cliff diver stands at the edge of a high white limestone cliff above a deep turquoise sea, arms spread. At about 4 seconds the diver leaps, falling in a clean graceful dive, and enters the water with a small splash far below. Filmed from the side at a distance, the diver small in frame and the face never visible. Photorealistic, vertical 9:16 framing, one smooth continuous shot following the fall, no cuts. Wind and water sound only, no music, no dialogue, no text, no captions, no logos.",
  },
  // Batch 4, 2026-11-27 (client: "new 10 videos. I suggest few, the others you create" + 4 reference reels): 10 of 12 kept; the rooftop jump dropped (rooftop parkour is a copyable risk, see strategy/hooks.ts UNSAFE).
  // a giant wall switch flips green and lights a blank burgundy panel
  {
    id: "2026-11-27-wall-switch-reveal",
    type: "anticipation",
    tags: ["reveal", "switch", "turn it on", "launch", "announcement", "coming soon", "big news"],
    climaxMs: 4200,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-27",
    prompt:
      "A plain white wall in a bright minimalist room. On the wall, at head height, is a huge flat grey toggle switch shape painted like a phone settings switch, in the off position. A woman with a blonde ponytail in a beige knit sweater and white trousers, seen only from behind, walks into frame, stretches up and pushes the switch to the right with her hand. At about 4 seconds the switch flips and turns bright green, and at the same moment a large blank deep-burgundy rectangular panel lights up on the wall below it with a soft warm glow around its edges, completely empty with no writing. She steps aside out of frame and the glowing blank panel stays in the centre. Photorealistic, vertical 9:16 framing, static camera, one continuous shot, no cuts. Natural sound effects only, no music, no dialogue, no text, no letters, no captions, no logos anywhere.",
  },
  // an SUV drives off with the fuel hose still in until the nozzle pops out
  {
    id: "2026-11-27-fuel-hose-drive-off",
    type: "danger",
    tags: ["mistake", "forgot", "rushing", "oops", "warning", "check first", "too fast"],
    climaxMs: 5500,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-27",
    prompt:
      "Seen through the windscreen of a car parked behind it at a petrol station on a grey overcast day: a dark grey SUV stands at a blue petrol pump with the fuel nozzle still plugged into its tank and the black hose hanging to the pump. The SUV slowly starts to drive away, the hose straightens and stretches tighter and tighter, and at about 5 seconds the hose pulls tight and the nozzle pops out of the car and drops to the ground while the SUV rolls on. Photorealistic, vertical 9:16 framing with the SUV and the hose centred, the dashboard edge at the bottom of the frame, one continuous shot, no cuts. Natural sound effects only, no music, no dialogue, no text, no number plates, no brand names, no logos.",
  },
  // a leaning lamp post falls and just misses a parked red car
  {
    id: "2026-11-27-leaning-lamp-post",
    type: "danger",
    tags: ["about to fall", "risk", "warning signs", "ignored problem", "close call", "wait for it"],
    climaxMs: 5100,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-27",
    prompt:
      "Filmed from a third-floor window looking down at a quiet European city street with cream-coloured apartment buildings and bare winter trees. A tall grey street lamp post on the pavement leans dangerously over a small parked red hatchback. It creaks and slowly tips further and further, and at about 5 seconds it falls and crashes onto the pavement right beside the red car, missing it by centimetres, while the car stays untouched. Photorealistic, overcast daylight, vertical 9:16 framing, the lamp post and the red car in the centre, handheld but steady, one continuous shot, no cuts. Natural sound effects only, no music, no dialogue, no text, no number plates, no logos.",
  },
  // a giant axe strikes a desert boulder and splits it in two
  {
    id: "2026-11-27-giant-axe-boulder",
    type: "anticipation",
    tags: ["one strike", "big move", "breakthrough", "split", "impact", "wait for it"],
    climaxMs: 5200,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-27",
    prompt:
      "In a flat red desert under a clear deep-blue sky, a gigantic axe as tall as a house, with a red and yellow painted handle and a shining steel blade, stands balanced on its edge, slowly tipping towards a huge smooth round sandstone boulder beside it. It tips further and further, and at about 5 seconds it falls and its blade strikes the top of the boulder, splitting it cleanly into two halves that fall apart in a puff of red dust. Photorealistic, low angle looking up, vertical 9:16 framing with the axe and boulder filling the frame, one continuous shot, no cuts. Natural sound effects only, no music, no dialogue, no text, no logos.",
  },
  // a red theatre curtain opens on a blank white screen under a spotlight
  {
    id: "2026-11-27-curtain-reveal",
    type: "anticipation",
    tags: ["reveal", "launch", "big news", "unveil", "spotlight", "announcement", "drumroll"],
    climaxMs: 4000,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-27",
    prompt:
      "A heavy dark red velvet theatre curtain fills the frame, closed, lit by a single warm spotlight. The curtain trembles, then slowly parts from the middle and sweeps open to both sides, and at about 4 seconds it reveals a bright empty stage with a large blank white rectangular screen standing in the middle under the spotlight, completely empty with no writing. Light dust floats in the beam. Photorealistic, vertical 9:16 framing centred on the opening, static camera with a very slow push-in, one continuous shot, no cuts. Natural sound effects only, no music, no dialogue, no text, no letters, no captions, no logos.",
  },
  // a rainbow domino chain runs to the end and rings a brass bell
  {
    id: "2026-11-27-domino-chain-run",
    type: "anticipation",
    tags: ["domino", "chain reaction", "satisfying", "precision", "one push", "momentum", "compounding"],
    climaxMs: 6200,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-27",
    prompt:
      "A long winding line of colourful wooden dominoes on a polished wooden floor, filmed from a low angle. In the first second a finger taps the first domino and the dominoes start falling one after another in a fast, clearly visible chain reaction that races along the whole line towards the camera, every single domino toppling, until at about 6 seconds the last domino hits a small brass bell which rings. By the end every domino is lying flat. Photorealistic, vertical 9:16 framing, the camera smoothly tracking alongside the falling wave, one continuous shot, no cuts. Natural sound effects only, no music, no dialogue, no text, no captions, no logos.",
  },
  // a waiter nearly drops a tall stack of plates and saves it
  {
    id: "2026-11-27-waiter-plate-save",
    type: "danger",
    tags: ["close call", "balance", "almost", "save", "steady hands", "wait for it", "nailed it"],
    climaxMs: 5300,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-27",
    prompt:
      "In a busy bright restaurant, a young waiter in a white shirt and black apron walks between tables carrying a very tall wobbly stack of white plates in both hands, the stack reaching above his head. He stumbles slightly, the tower of plates sways far to one side, then far to the other, and at about 5 seconds, just as it is about to topple, he catches it with a quick smooth move and the whole stack settles perfectly still. He gives a small relieved smile. Photorealistic, vertical 9:16 framing, the waiter and the plate tower centred, medium shot from the front, one continuous shot, no cuts. Natural restaurant sounds only, no music, no dialogue, no text, no captions, no logos.",
  },
  // a desk seedling grows into a full leafy tree in seconds
  {
    id: "2026-11-27-desk-plant-tree",
    type: "impossible",
    tags: ["growth", "grow", "results", "compounding", "from small to big", "organic growth", "time-lapse"],
    climaxMs: 3500,
    durationMs: 8000,
    costUsd: 0.56,
    madeOn: "2026-11-27",
    prompt:
      "A tiny green seedling in a small white pot on a clean wooden office desk next to a closed laptop and a coffee cup, soft morning window light. The seedling starts to grow impossibly fast: its stem thickens and climbs, leaves unfold one after another, and by about 5 seconds it has become a small leafy tree reaching above the frame with its branches spreading across the room, the pot still on the desk. Photorealistic, vertical 9:16 framing, static camera, one continuous shot, no cuts. Natural sound effects only, no music, no dialogue, no text, no captions, no logos, no readable screen.",
  },
  // hands tear open a white paper wall onto a blank black panel
  {
    id: "2026-11-27-paper-wall-reveal",
    type: "anticipation",
    tags: ["reveal", "unveil", "grand opening", "launch", "big news", "behind the scenes", "coming soon"],
    climaxMs: 4200,
    durationMs: 10000,
    costUsd: 0.7,
    madeOn: "2026-11-27",
    prompt:
      "A plain white paper wall fills the whole frame, lit softly. Two hands with dark nail polish push through the paper from the front and tear a small hole, then keep ripping the paper away piece by piece, the hole growing wider with crisp torn white edges. By about 7 seconds the hole is large and shows a clean matte black panel behind the paper, completely empty with no writing, framed by the jagged torn edges. The hands move out of frame and the torn opening with the blank black panel stays centred. Photorealistic, vertical 9:16 framing, static camera, one continuous shot, no cuts. Natural paper tearing sounds only, no music, no dialogue, no text, no letters, no captions, no logos.",
  },
  // stick figures: one keeps aiming, the other shoots until he scores
  {
    id: "2026-11-27-overthinker-vs-doer",
    type: "anticipation",
    tags: ["overthinking", "take action", "just start", "practice", "doer", "consistency", "shoot your shot"],
    climaxMs: 7000,
    durationMs: 10000,
    costUsd: 0.7,
    madeOn: "2026-11-27",
    prompt:
      "Minimal flat 2D animation on a plain black background: two simple white stick figures stand on a thin white ground line at the bottom, both facing a glowing white basketball hoop high in the middle of the frame. The figure on the left holds a ball and keeps adjusting his aim, raising and lowering it, small thought dots floating above his head, but never throws. The figure on the right throws ball after ball: the first misses and bounces away, the second hits the rim, and at about 7 seconds the third swishes through the hoop, which flashes bright red with a soft red glow while the left figure is still aiming. Clean vector style, smooth motion, vertical 9:16 framing, the hoop in the upper third, one continuous shot, no cuts. Simple sound effects only, no music, no dialogue, no text, no letters, no labels, no captions, no logos.",
  },
];

/** The checked POV clips, newest batch last (ids "<day>-pov-<subject>"). */
export const AI_POV_LIBRARY: readonly AiPovClip[] = [
  // Batch 1, 2026-11-21: Daniel's 8 reference reels re-made with original characters, plus 2 of ours (suit dog, capybara).
  {
    id: "2026-11-21-pov-wizard-cat-typing",
    shows: "A ginger cat in a wizard hat types frantically at a keyboard, then looks at the camera and throws a paw up in frustration.",
    tags: ["frustrated", "manual work", "overwhelmed", "typing", "computer", "busy", "doing it yourself"],
    durationMs: 10000,
    costUsd: 0.7,
    madeOn: "2026-11-21",
    prompt:
      "Photorealistic funny meme video. A fluffy ginger cat wearing a dark blue pointed wizard hat sits at a computer keyboard in a cosy office lit with purple light, typing frantically with both front paws, eyes wide. At about 6 seconds it stops, looks straight at the camera and throws one paw up in the air in frustration. Vertical 9:16 framing, the cat in the lower two thirds, the top fifth of the frame calm and empty for a caption added later. One continuous shot, no cuts. No text, no captions, no logos, no watermark.",
  },
  {
    id: "2026-11-21-pov-tea-cat-seaside",
    shows: "A cut-out cat in sunglasses and a headscarf calmly sips tea in front of a sunny empty seaside promenade.",
    tags: ["relaxed", "calm", "sipping tea", "no stress", "while it works", "chill", "luxury"],
    durationMs: 10000,
    costUsd: 0.7,
    madeOn: "2026-11-21",
    prompt:
      "Funny meme video in a cut-out collage style: a photo cut-out of a cat wearing a patterned orange headscarf and black sunglasses, with a slightly rough hand-cut edge like a sticker, floats in the middle of the frame holding a tiny white teacup in its paws and sipping calmly, then slowly lowering the cup with a satisfied look. Behind it, a still photo of an empty minimal seaside promenade under a clear deep-blue sky, a single seagull gliding past. Vertical 9:16, the top fifth of the frame plain sky for a caption added later. One continuous shot, no cuts. No text, no captions, no logos, no watermark.",
  },
  {
    id: "2026-11-21-pov-crying-owl-goggles",
    shows: "An original cartoon owl with aviator goggles slowly tears up, emotional, against a night highway.",
    tags: ["tears", "crying", "expensive", "agency bill", "relief", "emotional", "finally"],
    durationMs: 10000,
    costUsd: 0.7,
    madeOn: "2026-11-21",
    prompt:
      "Funny meme video, 2D cartoon style: an original chubby round cartoon owl with brown leather aviator goggles pushed up on its forehead fills the lower half of the frame. Its big shiny eyes slowly fill with tears, its beak trembles, and at about 5 seconds a big tear rolls down its cheek while it sniffs. Behind it, a real night photo of a highway with blurred car lights under a starry sky. Vertical 9:16, the top fifth of the frame dark starry sky for a caption added later. One continuous shot, no cuts. No text, no captions, no logos, no watermark.",
  },
  {
    id: "2026-11-21-pov-smug-pug-sideeye",
    shows: "A cut-out pug in an empty arena slowly gives the camera a heavy, judging side-eye.",
    tags: ["smug", "side eye", "confident", "winning", "ahead of competitors", "know something"],
    durationMs: 10000,
    costUsd: 0.7,
    madeOn: "2026-11-21",
    prompt:
      "Funny meme video in a cut-out collage style: a photo cut-out of a chubby fawn pug wearing a tiny gold chain necklace, with a slightly rough hand-cut edge like a sticker, shown from the chest up and filling the lower half of the frame, looking straight ahead. At about 2 seconds it slowly slides its big round eyes all the way to the side towards the camera, eyelids lowering into a heavy, exaggerated smug side-eye, its mouth curling into a tiny smirk, and it holds that look; at about 7 seconds it gives one slow satisfied nod. Behind it, a still photo of an empty dim indoor basketball arena. Vertical 9:16, the top fifth of the frame calm and dark for a caption added later. One continuous shot, no cuts. No text, no captions, no logos, no watermark.",
  },
  {
    id: "2026-11-21-pov-monkey-flip-phone",
    shows: "A cut-out monkey holds an old flip phone to its ear, listening seriously, in front of mountains.",
    tags: ["phone call", "calling", "new customer", "booking", "serious", "business call", "listening"],
    durationMs: 10000,
    costUsd: 0.7,
    madeOn: "2026-11-21",
    prompt:
      "Funny meme video in a cut-out collage style: a photo cut-out of a macaque monkey, with a slightly rough hand-cut edge like a sticker, holds an old silver flip phone to its ear, listening very seriously, nodding twice and raising its eyebrows as if hearing great news. Behind it, a still photo of a dramatic alpine mountain range with green forest and moody clouds. The monkey fills the lower third of the frame. Vertical 9:16, the top fifth of the frame cloudy sky for a caption added later. One continuous shot, no cuts. No text, no captions, no logos, no watermark.",
  },
  {
    id: "2026-11-21-pov-lizard-zoom-dust",
    shows: "An original cartoon lizard in red sneakers grins on an office desk, then zooms off so fast it leaves a dust cloud.",
    tags: ["fast", "speed", "before competitors", "gone", "quick", "zoom", "first"],
    durationMs: 10000,
    costUsd: 0.7,
    madeOn: "2026-11-21",
    prompt:
      "Funny meme video, 2D cartoon style: an original small green cartoon lizard wearing bright red sneakers stands on a desk next to a laptop in a sunny high-rise office with floor-to-ceiling windows and a city skyline at golden hour (realistic photo background). It grins at the camera, crouches, and at about 4 seconds zooms off upward out of the frame so fast that it leaves behind a puffy white cartoon dust cloud in its shape, which slowly drifts apart and fades. Vertical 9:16, the top fifth of the frame bright window light for a caption added later. One continuous shot, no cuts. No text, no captions, no logos, no watermark.",
  },
  {
    id: "2026-11-21-pov-teary-white-cat",
    shows: "A cut-out white cat looks at the camera with huge teary eyes, heartbroken, over a garden staircase.",
    tags: ["sad", "disappointed", "wasted money", "regret", "teary", "wrong choice", "heartbroken"],
    durationMs: 10000,
    costUsd: 0.7,
    madeOn: "2026-11-21",
    prompt:
      "Funny meme video in a cut-out collage style: a photo cut-out of a fluffy white cat's head and chest, with a slightly rough hand-cut edge like a sticker, looking at the camera with huge glossy teary eyes and a trembling mouth, slowly blinking and tilting its head sadly. Behind it, a still photo looking down a curved concrete garden staircase with green ferns. The cat fills the middle of the frame. Vertical 9:16, the top fifth of the frame plain pale stone for a caption added later. One continuous shot, no cuts. No text, no captions, no logos, no watermark.",
  },
  {
    id: "2026-11-21-pov-nachos-dog-phone",
    shows: "A shih tzu lies back on a sofa scrolling its phone and munching nachos, totally relaxed.",
    tags: ["lazy", "relaxing", "on the sofa", "while it works", "scrolling", "weekend", "horizontal"],
    durationMs: 10000,
    costUsd: 0.7,
    madeOn: "2026-11-21",
    prompt:
      "Photorealistic funny meme video: a fluffy shih tzu dog lies back like a person on a sofa, holding a smartphone in one paw and scrolling, a bowl of nachos resting on its belly. It slowly munches a nacho, glances at the phone, then looks at the camera, totally relaxed. A small dip bowl and a plain unlabeled can sit on a wooden tray beside it. Warm sunset light makes stripes on a brown wall behind. Vertical 9:16, the dog in the lower two thirds, the top fifth of the frame plain wall for a caption added later. One continuous shot, no cuts. No text, no captions, no logos, no labels, no watermark.",
  },
  {
    id: "2026-11-21-pov-suit-dog-confetti",
    shows: "A golden retriever in a business suit reads a laptop and nods, then confetti rains down around it.",
    tags: ["success", "new leads", "celebration", "results", "proud", "boss", "it worked"],
    durationMs: 10000,
    costUsd: 0.7,
    madeOn: "2026-11-21",
    prompt:
      "Photorealistic funny meme video: a golden retriever wearing a tiny navy business suit and tie sits upright at an office desk in front of an open laptop, reading the screen and nodding slowly and confidently. At about 5 seconds colourful confetti bursts and rains down all around it while it keeps a proud calm face. Bright modern office. Vertical 9:16, the dog in the lower two thirds, the top fifth of the frame plain bright wall for a caption added later. One continuous shot, no cuts. No text, no captions, no logos, no watermark.",
  },
  {
    id: "2026-11-21-pov-capybara-hot-spring",
    shows: "A capybara with sunglasses relaxes in a hot spring and ignores a phone buzzing with notifications.",
    tags: ["calm", "unbothered", "notifications", "chill", "no stress", "relaxing", "while it works"],
    durationMs: 10000,
    costUsd: 0.7,
    madeOn: "2026-11-21",
    prompt:
      "Photorealistic funny meme video: a capybara sits relaxed in a steaming outdoor hot spring, wearing tiny round sunglasses with a small yellow citrus fruit balanced on its head. On a flat rock beside it a smartphone keeps lighting up and buzzing with notifications. The capybara ignores it completely, slowly closes its eyes and sinks a little lower into the warm water. Soft evening light, gentle steam. Vertical 9:16, the capybara in the lower two thirds, the top fifth of the frame calm steam and trees for a caption added later. One continuous shot, no cuts. No text, no captions, no logos, no watermark.",
  },
  // Batch 2, 2026-11-26: 10 new reaction characters (two remade after a check: a logo, no dance).
  {
    id: "2026-11-26-pov-raccoon-notifications",
    shows: "A raccoon at a desk stares at a phone that keeps buzzing with notifications, its eyes getting wider, then it slowly grins.",
    tags: ["notifications", "results", "new customers", "phone blowing up", "surprised", "it worked", "leads coming in"],
    durationMs: 10000,
    costUsd: 0.7,
    madeOn: "2026-11-26",
    prompt:
      "Photorealistic funny meme video. A raccoon sits upright at a small wooden desk in a bright home office, holding a smartphone in both paws. The phone keeps lighting up and vibrating on its own, the raccoon's eyes get wider and wider, and at about 6 seconds it slowly breaks into a delighted grin and looks straight at the camera. Vertical 9:16 framing, the raccoon in the lower two thirds, the top fifth of the frame calm and empty for a caption added later. One continuous shot, no cuts. No readable screen content, no text, no captions, no logos, no watermark.",
  },
  {
    id: "2026-11-26-pov-golden-dog-hammock",
    shows: "A golden retriever in sunglasses naps in a hammock between palm trees, one paw lazily waving.",
    tags: ["relaxed", "on holiday", "while it works", "no stress", "autopilot", "sleeping", "passive"],
    durationMs: 10000,
    costUsd: 0.7,
    madeOn: "2026-11-26",
    prompt:
      "Photorealistic funny meme video. A golden retriever wearing small round sunglasses lies on its back in a striped hammock strung between two palm trees on a quiet tropical beach, gently swinging. It lifts one front paw and waves it lazily, then lets out a contented sigh and settles deeper into the hammock. Vertical 9:16 framing, the dog in the lower two thirds, the top fifth of the frame plain blue sky for a caption added later. One continuous shot, no cuts. No text, no captions, no logos, no watermark.",
  },
  {
    id: "2026-11-26-pov-goat-laptop-shut",
    shows: "A goat in reading glasses stares at a plain grey laptop full of numbers, chews nervously, then pushes the lid shut with its nose and looks at the camera, unimpressed.",
    tags: ["overwhelmed", "spreadsheets", "manual work", "confused", "too much data", "giving up", "doing it yourself"],
    durationMs: 10000,
    costUsd: 0.7,
    madeOn: "2026-11-26",
    prompt:
      "Photorealistic funny meme video. A white goat wearing small round reading glasses stands at a wooden kitchen table in front of a plain matte dark grey laptop with a completely blank lid, no logo and no markings anywhere on it. The screen glows with blurry rows of numbers. The goat chews nervously, leans closer and blinks twice, then at about 6 seconds pushes the same grey laptop's lid shut with its nose and looks straight at the camera, unimpressed. The laptop stays the same dark grey laptop for the whole clip. Vertical 9:16 framing, the goat in the lower two thirds, the top fifth of the frame calm and empty for a caption added later. One continuous shot, no cuts. No brand logos, no readable screen content, no text, no captions, no watermark.",
  },
  {
    id: "2026-11-26-pov-penguin-happy-dance",
    shows: "A small penguin on an office chair looks at a monitor, freezes, then hops up and down flapping both flippers wildly in a happy dance.",
    tags: ["celebrating", "success", "ranking", "first page", "good news", "happy dance", "it worked"],
    durationMs: 10000,
    costUsd: 0.7,
    madeOn: "2026-11-26",
    prompt:
      "Photorealistic funny meme video. A small penguin stands on the seat of an office chair in front of a glowing computer monitor in a bright modern office, seen from the front so its face and both flippers are clearly visible. It stares at the screen, freezes for one second, then from about 3 seconds bursts into an obvious, energetic happy dance: hopping up and down several times, flapping both flippers wildly, wiggling its whole body from side to side and spinning around once on the chair, clearly overjoyed until the end. Vertical 9:16 framing, the penguin in the lower two thirds, the top fifth of the frame calm and empty for a caption added later. One continuous shot, no cuts. No brand logos, no readable screen content, no text, no captions, no watermark.",
  },
  {
    id: "2026-11-26-pov-sloth-waiting-clock",
    shows: "A sloth at a café table slowly turns to look at a wall clock, then very slowly face-palms.",
    tags: ["waiting", "slow results", "still waiting", "agency", "too slow", "frustrated", "time"],
    durationMs: 10000,
    costUsd: 0.7,
    madeOn: "2026-11-26",
    prompt:
      "Photorealistic funny meme video. A sloth sits at a small café table with a cup of coffee in front of it. Very slowly it turns its head to look at a large round clock on the wall behind, the clock's second hand ticking, then even more slowly brings one long-clawed hand up to its face in a face-palm and holds it there. Vertical 9:16 framing, the sloth in the lower two thirds, the top fifth of the frame calm and empty for a caption added later. One continuous shot, no cuts. No text, no captions, no logos, no watermark.",
  },
  {
    id: "2026-11-26-pov-cutout-frog-money-rain",
    shows: "A cut-out frog in a tiny crown sits calmly while paper confetti rains down around it.",
    tags: ["winning", "sales", "rich", "celebrating", "smug", "results", "money"],
    durationMs: 10000,
    costUsd: 0.7,
    madeOn: "2026-11-26",
    prompt:
      "Funny meme video in a cut-out collage style: a photo cut-out of a green frog wearing a tiny golden crown, with a slightly rough hand-cut white edge like a sticker, sits in the middle of the frame with a smug, calm expression, blinking slowly while colourful paper confetti rains down around it and settles. Behind it, a still photo of a plain pastel pink wall. Vertical 9:16, the top fifth of the frame plain wall for a caption added later. One continuous shot, no cuts. No banknotes, no text, no captions, no logos, no watermark.",
  },
  {
    id: "2026-11-26-pov-hamster-coffee-overload",
    shows: "A hamster surrounded by tiny coffee cups shakes with caffeine and types faster and faster on a mini keyboard.",
    tags: ["late night", "working too hard", "deadline", "burnout", "caffeine", "doing it yourself", "manual work"],
    durationMs: 10000,
    costUsd: 0.7,
    madeOn: "2026-11-26",
    prompt:
      "Photorealistic funny meme video. A hamster sits at a miniature wooden desk at night, lit by a desk lamp, surrounded by six tiny empty espresso cups. It types on a tiny keyboard faster and faster, its whiskers twitching, eyes wide and slightly trembling with too much caffeine, and at about 7 seconds it stops abruptly and stares at the camera. Vertical 9:16 framing, the hamster in the lower two thirds, the top fifth of the frame dark and empty for a caption added later. One continuous shot, no cuts. No text, no captions, no logos, no watermark.",
  },
  {
    id: "2026-11-26-pov-parrot-side-eye",
    shows: "A green parrot on a perch slowly turns its head and gives the camera a long suspicious side-eye.",
    tags: ["suspicious", "competitor", "side-eye", "not convinced", "really?", "doubt", "judging"],
    durationMs: 10000,
    costUsd: 0.7,
    madeOn: "2026-11-26",
    prompt:
      "Photorealistic funny meme video. A bright green parrot sits on a wooden perch in a sunny living room. It is preening calmly, then stops, slowly turns its head towards the camera and gives a long, suspicious side-eye, one eye narrowed, leaning back slightly, holding the look for several seconds. Vertical 9:16 framing, the parrot in the lower two thirds, the top fifth of the frame calm and empty for a caption added later. One continuous shot, no cuts. No text, no captions, no logos, no watermark.",
  },
  {
    id: "2026-11-26-pov-cutout-bulldog-boss",
    shows: "A cut-out bulldog in a tie leans back in an office chair with paws behind its head, looking very pleased.",
    tags: ["boss", "in control", "everything handled", "smug", "relaxed", "automated", "confident"],
    durationMs: 10000,
    costUsd: 0.7,
    madeOn: "2026-11-26",
    prompt:
      "Funny meme video in a cut-out collage style: a photo cut-out of a French bulldog wearing a red tie, with a slightly rough hand-cut white edge like a sticker, leans back in a black leather office chair with both front paws behind its head, rocking gently and looking very pleased with itself, then gives a slow satisfied nod. Behind it, a still photo of a bright minimal city office with large windows. Vertical 9:16, the top fifth of the frame plain bright window for a caption added later. One continuous shot, no cuts. No text, no captions, no logos, no watermark.",
  },
  {
    id: "2026-11-26-pov-kitten-jaw-drop",
    shows: "A grey kitten looks at a tablet, its jaw slowly drops and it leans back in shock.",
    tags: ["shocked", "surprised", "results", "cannot believe", "jaw drop", "traffic", "numbers went up"],
    durationMs: 10000,
    costUsd: 0.7,
    madeOn: "2026-11-26",
    prompt:
      "Photorealistic funny meme video. A fluffy grey kitten sits on a sofa cushion in front of a tablet propped up against a pillow, the screen glowing softly. The kitten leans in, its eyes widen, its mouth slowly drops open in disbelief, and at about 6 seconds it leans all the way back in shock and looks at the camera. Vertical 9:16 framing, the kitten in the lower two thirds, the top fifth of the frame calm and empty for a caption added later. One continuous shot, no cuts. No readable screen content, no text, no captions, no logos, no watermark.",
  },
];

export function povClipById(id: string): AiPovClip | null {
  return AI_POV_LIBRARY.find((clip) => clip.id === id) ?? null;
}

/**
 * Takes that were paid for but not kept (too weak to read in the corner box,
 * wrong physics...), so the spend shown is the real one.
 */
export type AiRejectedTake = { id: string; madeOn: string; costUsd: number; why: string };

export const AI_REJECTED_TAKES: readonly AiRejectedTake[] = [
  { id: "2026-11-21-pov-smug-hamster", madeOn: "2026-11-21", costUsd: 0.7, why: "a blank stare, no smug side-eye" },
  { id: "2026-11-21-pov-smug-hamster-sideeye", madeOn: "2026-11-21", costUsd: 0.7, why: "still no readable side-eye (hamster eyes too small); remade as 2026-11-21-pov-smug-pug-sideeye" },
  { id: "2026-11-19-slackline-clouds", madeOn: "2026-11-19", costUsd: 0.56, why: "the walker was too small to see the wobble; remade closer as 2026-11-19-slackline-wobble" },
  { id: "2026-11-26-pov-goat-spreadsheet-panic", madeOn: "2026-11-26", costUsd: 0.7, why: "the closed laptop showed a brand logo and changed colour; remade as 2026-11-26-pov-goat-laptop-shut" },
  { id: "2026-11-26-pov-penguin-victory-dance", madeOn: "2026-11-26", costUsd: 0.7, why: "no visible dance; remade as 2026-11-26-pov-penguin-happy-dance" },
  { id: "2026-11-26-domino-spiral", madeOn: "2026-11-26", costUsd: 0.56, why: "only a few dominoes fell, no chain reaction" },
  { id: "2026-11-26-rooftop-skateboard-gap", madeOn: "2026-11-26", costUsd: 0.56, why: "the skater never jumped the gap, so no danger moment" },
  { id: "2026-11-27-rooftop-gap-jump", madeOn: "2026-11-27", costUsd: 0.56, why: "the gap between the roofs never showed, so no danger moment; remade as 2026-11-27-rooftop-gap-jump-b" },
  { id: "2026-11-27-rooftop-gap-jump-b", madeOn: "2026-11-27", costUsd: 0.56, why: "good take, but rooftop parkour is a copyable risk the platforms restrict (UNSAFE words); not used" },
];
