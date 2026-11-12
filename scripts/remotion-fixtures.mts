/**
 * Local visual fixtures for the video productions (2026-11-12): renders one
 * MP4 per creative direction, a Story, carousel slides, concept-preview
 * frames and the 15 s / 90 s duration boundaries, makes the version without
 * music by remux, and extracts a few frames of each - for a person to look
 * at. Nothing here is shipped or called by the app.
 *
 *   npx tsx scripts/remotion-fixtures.mts <out-dir> [only=name,name] [concurrency=3]
 *
 * Media is generated on this machine with ffmpeg (animated gradients and
 * shapes, a tone standing in for the AI voice - no OpenAI key is used), and
 * served to the renderer from a local HTTP server that stops at the end.
 * The music is the app's own licensed tracks (public/video-music).
 */
import { execFileSync } from "node:child_process";
import { cpSync, createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

import { bundle } from "@remotion/bundler";
import { RenderInternals, renderMedia, renderStill, selectComposition } from "@remotion/renderer";

import { silentTiming, spokenParts, type ProductionChoices, type ReelProps, type ShotPlan, type ShotScene, type VideoScript } from "../src/lib/video/formats";
import { productionParts } from "../src/remotion/production";
import type { ProductionReelProps, SceneMedia } from "../src/remotion/props";

const root = process.cwd();
const outDir = path.resolve(process.argv[2] ?? "fixtures-out");
const only = (process.argv.find((a) => a.startsWith("only="))?.slice(5) ?? "").split(",").filter(Boolean);
const concurrency = Number(process.argv.find((a) => a.startsWith("concurrency="))?.slice(12) ?? 3);
const media = path.join(outDir, "media");
mkdirSync(media, { recursive: true });
const ffmpeg = process.env.FFMPEG || "ffmpeg";

function run(args: string[]) {
  execFileSync(ffmpeg, ["-nostdin", "-v", "error", "-y", "-threads", "2", ...args], { stdio: "inherit" });
}

/* ------------------------------------------------------------- generated media */

function clip(name: string, w: number, h: number, seconds: number, c0: string, c1: string, c2: string) {
  const file = path.join(media, name);
  if (existsSync(file)) return;
  const box = `drawbox=x='${w * 0.2}+${w * 0.3}*sin(t*1.3)':y='${h * 0.35}+${h * 0.1}*cos(t)':w=${Math.round(w * 0.28)}:h=${Math.round(w * 0.28)}:color=white@0.55:t=fill,drawbox=x='${w * 0.6}-${w * 0.25}*sin(t*0.8)':y='${h * 0.62}':w=${Math.round(w * 0.18)}:h=${Math.round(h * 0.08)}:color=black@0.45:t=fill`;
  run(["-f", "lavfi", "-i", `gradients=s=${w}x${h}:c0=${c0}:c1=${c1}:c2=${c2}:nb_colors=3:speed=0.03:d=${seconds}:r=30`, "-vf", box, "-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-pix_fmt", "yuv420p", file]);
}

function still(name: string, w: number, h: number, c0: string, c1: string) {
  const file = path.join(media, name);
  if (existsSync(file)) return;
  run(["-f", "lavfi", "-i", `gradients=s=${w}x${h}:c0=${c0}:c1=${c1}:d=1:r=1`, "-vf", `drawbox=x=${w * 0.3}:y=${h * 0.3}:w=${w * 0.4}:h=${h * 0.3}:color=white@0.5:t=fill`, "-frames:v", "1", file]);
}

/** A tone standing in for the voice: syllable-like pulses, silent gaps between parts. */
function tone(name: string, seconds: number) {
  const file = path.join(media, name);
  run(["-f", "lavfi", "-i", `sine=frequency=180:sample_rate=24000:duration=${seconds}`, "-af", "volume='0.25+0.25*sin(2*PI*4*t)':eval=frame", "-ac", "1", file]);
}

clip("portrait-a.mp4", 1080, 1920, 8, "0x1e3a8a", "0xf59e0b", "0x0f172a");
clip("portrait-b.mp4", 1080, 1920, 6, "0x065f46", "0xfde68a", "0x111827");
clip("landscape-c.mp4", 1920, 1080, 7, "0x7c2d12", "0x38bdf8", "0x1f2937");
still("photo-d.png", 1080, 1350, "0x9d174d", "0xfbcfe8");
still("photo-e.png", 1600, 900, "0x334155", "0xa3e635");

/* ------------------------------------------------------------- local server */

const types: Record<string, string> = { ".mp4": "video/mp4", ".png": "image/png", ".wav": "audio/wav", ".mp3": "audio/mpeg" };
const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const file = url.startsWith("/music/") ? path.join(root, "public", "video-music", url.slice(7)) : path.join(media, url.slice(1));
  if (!file.startsWith(media) && !file.startsWith(path.join(root, "public", "video-music"))) return void res.writeHead(403).end();
  if (!existsSync(file)) return void res.writeHead(404).end();
  const size = statSync(file).size;
  const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? "");
  const head = { "content-type": types[path.extname(file)] ?? "application/octet-stream", "accept-ranges": "bytes", "access-control-allow-origin": "*" };
  if (range) {
    const start = Number(range[1]);
    const end = range[2] ? Number(range[2]) : size - 1;
    res.writeHead(206, { ...head, "content-range": `bytes ${start}-${end}/${size}`, "content-length": end - start + 1 });
    createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { ...head, "content-length": size });
    createReadStream(file).pipe(res);
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = (server.address() as { port: number }).port;
const at = (name: string) => `http://127.0.0.1:${port}/${name}`;
const music = (file: string, volume: number) => ({ url: `http://127.0.0.1:${port}/music/${file}`, volume });

/* ------------------------------------------------------------- props */

const BRAND = { name: "Image Studio", domain: "imagestudio.example", primary: "#e85d2a", accent: "#ffb38a", background: "#2a1308", text: "#ffffff", logoUrl: null };

const SCRIPT: VideoScript = {
  hook: "POV: the client asks for the product photo again",
  points: [
    { title: "Shoot near a window", detail: "Soft daylight sells better than any studio lamp.", stat: null },
    { title: "Keep the background plain", detail: "The eye goes straight to the product, not the clutter.", stat: null },
    { title: "Get close to the details", detail: "Texture is what people want to touch before they buy.", stat: null },
  ],
  proof: "Image Studio shoots about 300 products a month for local shops.",
  cta: "Follow Image Studio for more photo tips",
};

const LONG_SCRIPT: VideoScript = {
  hook: "Seven product photo mistakes that quietly cost you sales every single week",
  points: [
    { title: "Dark, flat lighting", detail: "A product that looks dull on screen looks cheap, so move next to a big window and shoot in the morning when the light is soft and even across the whole frame.", stat: null },
    { title: "A busy background", detail: "Every object behind the product competes for attention; a plain wall, a sheet of card or a clean table keeps the eye exactly where you want it, on the thing you sell.", stat: null },
    { title: "No close-ups", detail: "People buy what they can almost touch, so add at least one picture that fills the frame with the texture, the stitching, the grain or the finish of the material.", stat: null },
    { title: "Inconsistent angles", detail: "A shop where every product is shot from a different height feels messy; pick one angle and one distance and keep them for the whole catalogue so the grid looks calm.", stat: null },
  ],
  proof: "Shops that fix just these four usually see more clicks on the very same products within a month, with no new stock at all.",
  cta: "Follow Image Studio and fix one of these mistakes this week",
};

const scene = (source: ShotScene["visual"]["source"], query: string, transition: ShotScene["transition"], extra: Partial<ShotScene> = {}): ShotScene => ({
  visual: { source, query, kind: "video" },
  transition,
  reaction: null,
  overlay: null,
  ...extra,
});

function plan(direction: ShotPlan["direction"], pacing: ShotPlan["pacing"], captionStyle: ShotPlan["captionStyle"], scenes: ShotScene[]): ShotPlan {
  return { direction, pacing, captionStyle, musicMood: null, scenes, recipe: `${direction}|${pacing}|${captionStyle}` };
}

const PRODUCTION = (overrides: Partial<ProductionChoices>): ProductionChoices => ({
  audio: "voiceover",
  narration: "natural",
  captionStyle: "bold",
  music: "auto",
  duration: "30-45",
  showHook: true,
  includeCta: true,
  ctaText: null,
  ...overrides,
});

const M = {
  a: { url: at("portrait-a.mp4"), kind: "video", source: "stock", durationMs: 8000 } as SceneMedia,
  b: { url: at("portrait-b.mp4"), kind: "video", source: "customer", durationMs: 6000 } as SceneMedia,
  c: { url: at("landscape-c.mp4"), kind: "video", source: "stock", durationMs: 7000 } as SceneMedia,
  d: { url: at("photo-d.png"), kind: "image", source: "article" } as SceneMedia,
  e: { url: at("photo-e.png"), kind: "image", source: "ai_image" } as SceneMedia,
};

function base(script: VideoScript): ReelProps {
  return { style: "bold", brand: BRAND, script, voiceUrl: null, words: [], sceneStartsMs: silentTiming(script).sceneStartsMs, voiceMs: 0, music: null, media: [], captions: true };
}

/** A voiced production: a tone track paced like speech (2.6 words a second, 280 ms between parts). */
function voiced(props: ProductionReelProps, name: string): ProductionReelProps {
  const parts = productionParts(props.script, props.production!, props.plan);
  const words: { text: string; startMs: number; endMs: number }[] = [];
  const starts: number[] = [];
  let at0 = 0;
  for (const part of parts) {
    starts.push(Math.round(at0));
    const list = part.spoken.split(/\s+/).filter(Boolean);
    for (const word of list) {
      words.push({ text: word, startMs: Math.round(at0), endMs: Math.round(at0 + 330) });
      at0 += 1000 / 2.6;
    }
    at0 += 280;
  }
  tone(`${name}-voice.wav`, at0 / 1000);
  return { ...props, voiceUrl: at(`${name}-voice.wav`), words, sceneStartsMs: starts, voiceMs: Math.round(at0), spokenParts: parts.map((p) => p.part) };
}

type Fixture = { name: string; kind: "reel" | "slides" | "stills"; props: ProductionReelProps; slides?: number[]; frames?: number[] };

const fixtures: Fixture[] = [
  {
    name: "01-meme-text-music",
    kind: "reel",
    props: {
      ...base(SCRIPT),
      direction: "meme",
      plan: plan("meme", "fast", "bold", [
        scene("stock", "frustrated shop owner", "cut", { overlay: "POV: the client asks for the product photo AGAIN", reaction: "😩" }),
        scene("customer", "window light", "cut", { overlay: "Me after moving the table next to the window", reaction: "wait…" }),
        scene("stock", "plain wall", "zoom", { overlay: "When the background is finally just a wall", reaction: "😌" }),
        scene("article", "close up", "flash", { overlay: "Zooming in on the stitching like a detective", reaction: "🔍" }),
        scene("stock", "shop", "cut", { overlay: "300 products a month later", reaction: "💪" }),
        scene("brand", "", "cut"),
      ]),
      production: PRODUCTION({ audio: "text_music", duration: "15-30", captionStyle: "bold" }),
      sceneMedia: [M.a, M.b, M.c, M.d, M.a, null],
      music: music("mixkit-what-about-action.mp3", 0.45),
      language: "en",
    },
  },
  {
    name: "02-footage-voiceover-minimal",
    kind: "reel",
    props: voiced(
      {
        ...base(SCRIPT),
        direction: "footage",
        plan: plan("footage", "fast", "minimal", [scene("stock", "a", "cut"), scene("stock", "b", "whip"), scene("stock", "c", "cut"), scene("customer", "d", "zoom"), scene("stock", "e", "cut"), scene("brand", "", "fade")]),
        production: PRODUCTION({ audio: "voiceover", captionStyle: "minimal", duration: "30-45" }),
        sceneMedia: [M.a, M.c, M.b, M.d, M.a, M.b],
        music: music("mixkit-motivating-mornings.mp3", 0.12),
        language: "en",
      },
      "02",
    ),
  },
  {
    name: "03-storytelling-editorial",
    kind: "reel",
    props: voiced(
      {
        ...base(SCRIPT),
        direction: "storytelling",
        plan: plan("storytelling", "calm", "editorial", [scene("stock", "a", "fade"), scene("stock", "b", "fade"), scene("article", "c", "slide"), scene("stock", "d", "fade"), scene("stock", "e", "flash"), scene("brand", "", "fade")]),
        production: PRODUCTION({ audio: "voiceover", narration: "warm", captionStyle: "editorial", duration: "30-45" }),
        sceneMedia: [M.b, M.a, M.d, M.c, M.e, null],
        music: music("mixkit-a-new-life.mp3", 0.12),
        language: "en",
      },
      "03",
    ),
  },
  {
    name: "04-text-music-15s-boundary",
    kind: "reel",
    props: {
      ...base({ ...SCRIPT, points: SCRIPT.points.slice(0, 2) }),
      direction: "text_music",
      plan: plan("text_music", "fast", "bold", [scene("brand", "", "zoom"), scene("stock", "a", "glitch"), scene("brand", "", "slide"), scene("stock", "b", "zoom"), scene("brand", "", "flash")]),
      production: PRODUCTION({ audio: "text_music", duration: "15-30" }),
      sceneMedia: [null, M.a, null, M.c, null],
      music: music("mixkit-cat-walk.mp3", 0.45),
      language: "en",
    },
  },
  {
    name: "05-voiceover-90s-boundary",
    kind: "reel",
    props: voiced(
      {
        ...base(LONG_SCRIPT),
        direction: "voiceover",
        plan: plan("voiceover", "medium", "bold", [
          scene("stock", "a", "zoom"),
          scene("stock", "b", "whip"),
          scene("stock", "c", "glitch"),
          scene("stock", "d", "slide"),
          scene("stock", "e", "flash"),
          scene("stock", "f", "zoom"),
          scene("brand", "", "fade"),
        ]),
        production: PRODUCTION({ audio: "voiceover", narration: "energetic", duration: "60-90" }),
        sceneMedia: [M.a, M.c, M.b, M.d, M.e, M.a, M.b],
        music: music("mixkit-feeling-happy.mp3", 0.12),
        language: "en",
      },
      "05",
    ),
  },
  { name: "06-animated-legacy-bold", kind: "reel", props: { ...base(SCRIPT), music: music("mixkit-feeling-happy.mp3", 0.45) } },
  {
    name: "07-story-footage-no-hook-no-cta",
    kind: "reel",
    props: {
      ...base(SCRIPT),
      direction: "footage",
      format: "story",
      plan: plan("footage", "medium", "bold", [scene("stock", "a", "cut"), scene("stock", "b", "whip"), scene("stock", "c", "cut"), scene("stock", "d", "zoom"), scene("stock", "e", "cut"), scene("brand", "", "fade")]),
      production: PRODUCTION({ audio: "text_music", duration: "15-30", showHook: false, includeCta: false }),
      sceneMedia: [M.a, M.b, M.c, M.d, M.a, null],
      music: music("mixkit-digital-clouds.mp3", 0.45),
      language: "ro",
    },
  },
  {
    name: "08-carousel-meme",
    kind: "slides",
    slides: [0, 1, 5],
    props: {
      ...base(SCRIPT),
      direction: "meme",
      format: "carousel",
      plan: plan("meme", "fast", "bold", [
        scene("stock", "a", "cut", { overlay: "POV: the client asks for the product photo AGAIN", reaction: "😩" }),
        scene("stock", "b", "cut", { overlay: "Me after moving the table next to the window", reaction: "wait…" }),
        scene("stock", "c", "cut"),
        scene("stock", "d", "cut"),
        scene("stock", "e", "cut"),
        scene("brand", "", "cut"),
      ]),
      production: PRODUCTION({ audio: "text_music" }),
      sceneMedia: [M.d, M.e, M.d, M.e, M.d, null],
    },
  },
  {
    name: "09-carousel-text-music",
    kind: "slides",
    slides: [0, 2],
    props: { ...base(SCRIPT), direction: "text_music", format: "carousel", plan: plan("text_music", "fast", "bold", SCRIPT.points.concat([]).map(() => scene("brand", "", "cut")).concat([scene("brand", "", "cut"), scene("brand", "", "cut"), scene("brand", "", "cut")])), production: PRODUCTION({ audio: "text_music" }), sceneMedia: [] },
  },
  {
    name: "10-carousel-storytelling",
    kind: "slides",
    slides: [0, 3],
    props: { ...base(SCRIPT), direction: "storytelling", format: "carousel", plan: plan("storytelling", "calm", "editorial", Array.from({ length: 6 }, () => scene("stock", "x", "fade"))), production: PRODUCTION({}), sceneMedia: [M.d, M.e, M.d, M.e, M.d, M.e] },
  },
  {
    name: "11-concept-preview-footage",
    kind: "stills",
    frames: [5, 60, 200],
    props: {
      ...base(SCRIPT),
      direction: "footage",
      plan: plan("footage", "fast", "bold", [scene("stock", "barista pouring latte art close-up", "cut"), scene("stock", "window light on a product table", "whip"), scene("stock", "plain white wall studio", "cut"), scene("stock", "macro fabric texture", "zoom"), scene("stock", "busy local shop", "cut"), scene("brand", "", "fade")]),
      production: PRODUCTION({ audio: "voiceover" }),
      concept: true,
    },
  },
];

/* ------------------------------------------------------------- render */

console.log("[fixtures] bundling the templates");
// The templates' public files are their fonts only (as scripts/remotion-bundle.mjs).
const publicDir = path.join(outDir, "bundle-public");
cpSync(path.join(root, "public", "video-fonts"), path.join(publicDir, "video-fonts"), { recursive: true });
// A Chrome already on the machine: Remotion never downloads its own into the shared node_modules.
const browser = {
  browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  chromeMode: "chrome-for-testing" as const,
};
const serveUrl = await bundle({
  entryPoint: path.join(root, "src/remotion/index.ts"),
  outDir: path.join(outDir, "bundle"),
  publicDir,
  webpackOverride: (config) => ({ ...config, resolve: { ...config.resolve, alias: { ...(config.resolve?.alias ?? {}), "@": path.join(root, "src") } } }),
});

const results: Record<string, unknown>[] = [];
for (const fixture of fixtures) {
  if (only.length && !only.some((o) => fixture.name.startsWith(o))) continue;
  const started = Date.now();
  try {
    if (fixture.kind === "reel") {
      const composition = await selectComposition({ serveUrl, id: "Reel", inputProps: fixture.props, ...browser });
      const output = path.join(outDir, `${fixture.name}.mp4`);
      await renderMedia({ serveUrl, composition, inputProps: fixture.props, codec: "h264", crf: 26, x264Preset: "veryfast", audioCodec: "aac", enforceAudioTrack: true, outputLocation: output, concurrency, logLevel: "warn", timeoutInMilliseconds: 120_000, ...browser });
      const seconds = composition.durationInFrames / composition.fps;
      for (const t of [0.3, 1.2, seconds * 0.3, seconds * 0.55, seconds * 0.8, Math.max(0, seconds - 1)]) {
        run(["-ss", t.toFixed(2), "-i", output, "-frames:v", "1", "-vf", "scale=540:-1", "-q:v", "4", path.join(outDir, `${fixture.name}_t${t.toFixed(1)}s.jpg`)]);
      }
      results.push({ name: fixture.name, seconds, frames: composition.durationInFrames, renderS: Math.round((Date.now() - started) / 1000), bytes: statSync(output).size });
      if (fixture.name.startsWith("02")) {
        // The version without RepGet's music: the tone "voice" alone under the same picture, -c:v copy.
        const alt = path.join(outDir, `${fixture.name}_no-music.mp4`);
        const voice = path.join(media, "02-voice.wav");
        await RenderInternals.callFf({
          bin: "ffmpeg",
          args: ["-y", "-i", output, "-i", voice, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", alt],
          indent: false,
          logLevel: "warn",
          binariesDirectory: null,
          cancelSignal: undefined,
        });
        results.push({ name: `${fixture.name}_no-music`, bytes: statSync(alt).size, note: "remuxed with Remotion's ffmpeg, picture copied" });
      }
    } else {
      const frames = fixture.kind === "slides" ? fixture.slides! : fixture.frames!;
      for (const index of frames) {
        const inputProps = fixture.kind === "slides" ? { ...fixture.props, index } : fixture.props;
        const id = fixture.kind === "slides" ? "Slide" : "Reel";
        const composition = await selectComposition({ serveUrl, id, inputProps, ...browser });
        await renderStill({ serveUrl, composition, inputProps, frame: fixture.kind === "slides" ? 0 : index, imageFormat: "jpeg", jpegQuality: 80, output: path.join(outDir, `${fixture.name}_${fixture.kind === "slides" ? "slide" : "frame"}${index}.jpg`), timeoutInMilliseconds: 120_000, ...browser });
      }
      results.push({ name: fixture.name, stills: frames.length, renderS: Math.round((Date.now() - started) / 1000) });
    }
    console.log(`[fixtures] ${fixture.name} done in ${Math.round((Date.now() - started) / 1000)} s`);
  } catch (error) {
    console.error(`[fixtures] ${fixture.name} FAILED: ${(error as Error).message.slice(0, 800)}`);
    results.push({ name: fixture.name, error: (error as Error).message.slice(0, 800) });
  }
}
writeFileSync(path.join(outDir, "fixtures.json"), JSON.stringify({ at: new Date().toISOString(), concurrency, results, spoken: spokenParts(SCRIPT).length }, null, 2));
server.close();
console.log(JSON.stringify(results, null, 2));
