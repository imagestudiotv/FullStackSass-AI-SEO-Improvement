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
];
