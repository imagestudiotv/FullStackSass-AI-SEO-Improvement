import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";

import type { Sandbox } from "@vercel/sandbox";

import type { ProductionReelProps } from "@/remotion/props";

import type { ReelProps } from "./formats";

/**
 * Turning a reel into an MP4, and a carousel into its slides (Remotion,
 * client 2026-10-29: "Remotion is the video making we want to use").
 *
 * On Vercel the work is done on a Vercel Sandbox - a short-lived machine with
 * a browser, on the client's own Vercel account, a few cents a reel - because
 * a function cannot run a browser for minutes. The render runs DETACHED: the
 * job starts it (startReelRender), comes back every few seconds to ask how
 * far it is (reelRenderProgress), and collects the file when it is done
 * (collectReel). No single step comes near a function's time limit, and a
 * retried step finds the same render instead of starting another.
 *
 * Elsewhere (a developer's machine) the same templates render locally with
 * @remotion/renderer, in one go, in a process of its own.
 *
 * The templates (src/remotion) are bundled at build time into
 * REMOTION_BUNDLE_DIR (scripts/remotion-bundle.mjs) and that folder is
 * shipped with the background jobs' function (next.config.ts).
 *
 * Remotion's licence: free for companies of up to 3 people; above that a
 * company licence is needed before going live (REMOTION_LICENSE_KEY is passed
 * when set).
 */

export const REMOTION_BUNDLE_DIR = ".remotion-bundle";
const OUTPUT_FILE = "/tmp/reel.mp4";
/** Where @remotion/vercel puts the templates on the sandbox (its serveUrl below). */
const SANDBOX_BUNDLE_DIR = "remotion-bundle";

function bundleDir(): string {
  return path.join(process.cwd(), REMOTION_BUNDLE_DIR);
}

export function onVercel(): boolean {
  return Boolean(process.env.VERCEL);
}

export function isRenderConfigured(): boolean {
  return existsSync(bundleDir()) || !onVercel();
}

const licenseKey = () => process.env.REMOTION_LICENSE_KEY?.trim() || null;

/**
 * A detached render. startedAt and vcpus measure what the sandbox cost
 * (lib/video/cost-math.ts sandboxCost): from its creation to its stop.
 */
export type RenderHandle = { sandboxId: string; cmdId: string; startedAt?: number; vcpus?: number };

/** The reel's props: ReelProps for the original templates, ProductionReelProps for the new productions (src/remotion/props.ts). */
export type RenderProps = ReelProps | ProductionReelProps;

const RENDER_VCPUS = 4;

/**
 * Remotion's render settings for its sandbox script, as renderMediaOnVercel
 * writes them (@remotion/vercel 4.0.539, pinned): that function only runs
 * detached when the result goes to Vercel Blob, and RepGet keeps its files in
 * Supabase - so the same command is started here and the file read back.
 */
function renderConfig(props: RenderProps) {
  return {
    serveUrl: "/vercel/sandbox/remotion-bundle",
    compositionId: "Reel",
    inputProps: props,
    outputLocation: OUTPUT_FILE,
    codec: "h264",
    crf: 20,
    imageFormat: null,
    pixelFormat: "yuv420p",
    envVariables: {},
    frameRange: null,
    everyNthFrame: 1,
    proResProfile: null,
    chromiumOptions: {},
    scale: 1,
    preferLossless: false,
    enforceAudioTrack: true,
    disallowParallelEncoding: false,
    disableSharedMemoryCapture: false,
    concurrency: null,
    metadata: null,
    licenseKey: licenseKey(),
    videoBitrate: null,
    audioBitrate: "192k",
    encodingMaxRate: null,
    encodingBufferSize: null,
    muted: false,
    numberOfGifLoops: null,
    x264Preset: "medium",
    gopSize: null,
    colorSpace: "default",
    jpegQuality: 85,
    audioCodec: "aac",
    logLevel: "warn",
    // The templates' fonts and pictures load over the network: room for a slow one.
    timeoutInMilliseconds: 180_000,
    forSeamlessAacConcatenation: false,
    separateAudioTo: null,
    hardwareAcceleration: "disable",
    offthreadVideoCacheSizeInBytes: null,
    mediaCacheSizeInBytes: null,
    offthreadVideoThreads: null,
    chromeMode: "headless-shell",
    browserExecutable: null,
    binariesDirectory: null,
    repro: false,
    sampleRate: 48000,
    vercelBlob: null,
  };
}

/**
 * Copies the templates onto a new sandbox. @remotion/vercel (4.0.539, the
 * latest) creates the bundle's sub-folders (remotion-bundle/public, ...) but
 * not remotion-bundle itself, and the sandbox does not create missing parent
 * folders - every render failed with "cannot create directory
 * '/vercel/sandbox/remotion-bundle/public'" (2026-10-31). So it is made first.
 */
export async function addBundle(sandbox: Pick<Sandbox, "mkDir" | "writeFiles">): Promise<void> {
  const { addBundleToSandbox } = await import("@remotion/vercel");
  await sandbox.mkDir(SANDBOX_BUNDLE_DIR);
  await addBundleToSandbox({ sandbox: sandbox as Sandbox, bundleDir: bundleDir() });
}

/** Starts a reel's render on a new sandbox. */
export async function startReelRender(props: RenderProps): Promise<RenderHandle> {
  const { createSandbox } = await import("@remotion/vercel");
  const startedAt = Date.now();
  const sandbox = await createSandbox({ resources: { vcpus: RENDER_VCPUS } });
  try {
    await addBundle(sandbox);
    const command = await sandbox.runCommand({
      cmd: "node",
      args: ["render-video.mjs", JSON.stringify(renderConfig(props))],
      detached: true,
    });
    await sandbox.extendTimeout(20 * 60 * 1000);
    return { sandboxId: sandbox.sandboxId, cmdId: command.cmdId, startedAt, vcpus: RENDER_VCPUS };
  } catch (error) {
    await sandbox.stop().catch(() => undefined);
    throw error;
  }
}

export type RenderState = { stage: "working"; progress: number } | { stage: "done" } | { stage: "error"; message: string };

export async function reelRenderProgress(handle: RenderHandle): Promise<RenderState> {
  const { getRenderProgress } = await import("@remotion/vercel");
  const progress = await getRenderProgress(handle);
  if (progress.stage === "done") return { stage: "done" };
  if (progress.stage === "error") return { stage: "error", message: progress.message.slice(0, 500) };
  if (progress.stage === "expired") return { stage: "error", message: "The render machine stopped before the video was finished" };
  return { stage: "working", progress: "overallProgress" in progress ? progress.overallProgress : 0 };
}

/** The finished reel's file, and the machine stopped. */
export async function collectReel(handle: RenderHandle): Promise<Buffer> {
  const { Sandbox } = await import("@vercel/sandbox");
  const sandbox = await Sandbox.get({ sandboxId: handle.sandboxId });
  try {
    const file = await sandbox.readFileToBuffer({ path: OUTPUT_FILE });
    if (!file) throw new Error("The finished video was not found on the render machine");
    return Buffer.from(file);
  } finally {
    await sandbox.stop().catch(() => undefined);
  }
}

/* ------------------------------------------------- the version without RepGet's music */

/**
 * The ffmpeg arguments that put another audio track under the rendered
 * video without re-encoding the picture (-c:v copy): the voice alone, or
 * silence - the reel Instagram gets when native Instagram audio is attached
 * (client, 2026-11-12). Seconds of work, never a second render. The audio
 * may end before the picture (the 1.2 s tail): the file is as long as its
 * video stream.
 */
export function noMusicRemuxArgs({ video, audio, output }: { video: string; audio: string; output: string }): string[] {
  return ["-y", "-i", video, "-i", audio, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", output];
}

/** A silent WAV (8 kHz mono) of the given length: the audio of a Text + Music reel without its music. */
export function silentWav(ms: number): Buffer {
  const rate = 8000;
  const samples = Math.max(1, Math.round((ms / 1000) * rate));
  const pcm = Buffer.alloc(samples * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export type NoMusicSource = { voiceUrl: string | null; durationMs: number };

const ALT_OUTPUT = "/tmp/reel-no-music.mp4";

/**
 * The script run on the render machine: fetches the inputs it is given by
 * URL (or writes the bytes given), then runs Remotion's own ffmpeg - the
 * binary the render used - with the arguments built here.
 */
export const REMUX_SCRIPT = [
  `import { writeFile } from "node:fs/promises";`,
  `import { RenderInternals } from "@remotion/renderer";`,
  `const job = JSON.parse(process.argv[2]);`,
  `for (const input of job.inputs) {`,
  `  if (input.url) {`,
  `    const response = await fetch(input.url, { signal: AbortSignal.timeout(120000) });`,
  `    if (!response.ok) throw new Error("download failed " + response.status);`,
  `    await writeFile(input.path, Buffer.from(await response.arrayBuffer()));`,
  `  } else {`,
  `    await writeFile(input.path, Buffer.from(input.base64, "base64"));`,
  `  }`,
  `}`,
  `await RenderInternals.callFf({ bin: "ffmpeg", args: job.args, indent: false, logLevel: "warn", binariesDirectory: null, cancelSignal: undefined });`,
  `console.log("remuxed");`,
].join("\n");

type SandboxLike = Pick<Sandbox, "writeFiles" | "runCommand" | "readFileToBuffer">;

/** The job the remux script is given: what to fetch or write, and ffmpeg's arguments. */
export function remuxJob(videoPath: string | null, videoUrl: string | null, source: NoMusicSource): { inputs: { path: string; url?: string; base64?: string }[]; args: string[] } {
  const audioPath = "/tmp/no-music-audio.wav";
  const inputs: { path: string; url?: string; base64?: string }[] = [];
  const video = videoUrl ? "/tmp/no-music-video.mp4" : videoPath;
  if (!video) throw new Error("No video to remux");
  if (videoUrl) inputs.push({ path: video, url: videoUrl });
  inputs.push(source.voiceUrl ? { path: audioPath, url: source.voiceUrl } : { path: audioPath, base64: silentWav(source.durationMs).toString("base64") });
  return { inputs, args: noMusicRemuxArgs({ video, audio: audioPath, output: ALT_OUTPUT }) };
}

/** Runs the remux on a sandbox that has Remotion installed, returning the new file. */
async function remuxOnSandbox(sandbox: SandboxLike, videoPath: string | null, videoUrl: string | null, source: NoMusicSource): Promise<Buffer> {
  await sandbox.writeFiles([{ path: "remux.mjs", content: REMUX_SCRIPT }]);
  const result = await sandbox.runCommand({ cmd: "node", args: ["remux.mjs", JSON.stringify(remuxJob(videoPath, videoUrl, source))] });
  if (result.exitCode !== 0) throw new Error(`The version without music could not be made: ${(await result.stderr()).slice(0, 300)}`);
  const file = await sandbox.readFileToBuffer({ path: ALT_OUTPUT });
  if (!file) throw new Error("The version without music was not found on the render machine");
  return Buffer.from(file);
}

export type CollectedRender = { video: Buffer; noMusic: Buffer | null; noMusicError: string | null; runtimeMs: number | null; vcpus: number };

/**
 * The finished reel and, when asked, the same reel without RepGet's music
 * (remuxed on the same machine before it stops), with how long the machine
 * ran - for the cost ledger.
 */
export async function collectRender(handle: RenderHandle, noMusic: NoMusicSource | null): Promise<CollectedRender> {
  const { Sandbox } = await import("@vercel/sandbox");
  const sandbox = await Sandbox.get({ sandboxId: handle.sandboxId });
  try {
    const file = await sandbox.readFileToBuffer({ path: OUTPUT_FILE });
    if (!file) throw new Error("The finished video was not found on the render machine");
    let alt: Buffer | null = null;
    let altError: string | null = null;
    if (noMusic) {
      // The music-free copy is a bonus: its failure never fails the video (makeNoMusicVersion tries again later).
      try {
        alt = await remuxOnSandbox(sandbox, OUTPUT_FILE, null, noMusic);
      } catch (error) {
        altError = (error as Error).message;
      }
    }
    return { video: Buffer.from(file), noMusic: alt, noMusicError: altError, runtimeMs: handle.startedAt ? Date.now() - handle.startedAt : null, vcpus: handle.vcpus ?? RENDER_VCPUS };
  } finally {
    await sandbox.stop().catch(() => undefined);
  }
}

/**
 * The version without music for a video already made: on Vercel a small
 * sandbox (Remotion installed, 2 vCPUs) downloads the reel and the voice and
 * remuxes them; locally the same with Remotion's ffmpeg on this machine.
 * Returns the file and the sandbox's runtime (null locally).
 */
export async function remuxNoMusic(videoUrl: string, source: NoMusicSource): Promise<{ file: Buffer; runtimeMs: number | null; vcpus: number }> {
  if (!onVercel()) {
    // The same job with this machine's temporary folder instead of the sandbox's /tmp.
    const job = JSON.parse(JSON.stringify(remuxJob(null, videoUrl, source)).replaceAll("/tmp/", "{OUT}/"));
    const [file] = await renderHere("remux", job);
    if (!file) throw new Error("The local remux returned no file");
    return { file, runtimeMs: null, vcpus: 0 };
  }
  const { createSandbox } = await import("@remotion/vercel");
  const startedAt = Date.now();
  const sandbox = await createSandbox({ resources: { vcpus: 2 } });
  try {
    const file = await remuxOnSandbox(sandbox, null, videoUrl, source);
    return { file, runtimeMs: Date.now() - startedAt, vcpus: 2 };
  } finally {
    await sandbox.stop().catch(() => undefined);
  }
}

export async function stopRender(handle: RenderHandle): Promise<void> {
  const { Sandbox } = await import("@vercel/sandbox");
  await Sandbox.get({ sandboxId: handle.sandboxId })
    .then((sandbox) => sandbox.stop())
    .catch(() => undefined);
}

/** A carousel's slides as PNGs, in order, on one sandbox (each takes seconds). */
async function slidesOnVercel(props: RenderProps, count: number): Promise<Buffer[]> {
  const { createSandbox, renderStillOnVercel } = await import("@remotion/vercel");
  const sandbox = await createSandbox({ resources: { vcpus: 4 } });
  try {
    await addBundle(sandbox);
    const slides: Buffer[] = [];
    for (let index = 0; index < count; index += 1) {
      const { sandboxFilePath } = await renderStillOnVercel({
        sandbox,
        compositionId: "Slide",
        inputProps: { ...props, index },
        outputFile: `/tmp/slide-${index}.png`,
        imageFormat: "png",
        licenseKey: licenseKey(),
        logLevel: "warn",
      });
      const file = await sandbox.readFileToBuffer({ path: sandboxFilePath });
      if (!file) throw new Error(`Slide ${index + 1} was not found on the render machine`);
      slides.push(Buffer.from(file));
    }
    return slides;
  } finally {
    await sandbox.stop().catch(() => undefined);
  }
}

// ---------------------------------------------------------------- local (development)

/**
 * A render on this machine, in a process of its own
 * (scripts/remotion-render-local.mjs): Remotion's renderer cannot load inside
 * Next's server. Returns the files written, in order.
 */
async function renderHere(kind: "reel" | "slides" | "remux", props: RenderProps | Record<string, unknown>, count = 0): Promise<Buffer[]> {
  const { spawn } = await import("node:child_process");
  const { mkdtemp, readFile, rm, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const dir = await mkdtemp(path.join(tmpdir(), "repget-render-"));
  try {
    const propsFile = path.join(dir, "props.json");
    await writeFile(propsFile, JSON.stringify(props));
    const script = path.join(process.cwd(), "scripts", "remotion-render-local.mjs");
    const output = await new Promise<string>((resolve, reject) => {
      const child = spawn(process.execPath, [script, kind, propsFile, dir, String(count)], { cwd: process.cwd(), env: process.env });
      let out = "";
      let err = "";
      child.stdout.on("data", (chunk) => (out += chunk));
      child.stderr.on("data", (chunk) => (err += chunk));
      child.on("error", reject);
      // The error's own message comes first; the rest is mostly the browser's stack.
      child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`The local render failed (${code}): ${err.slice(0, 1500)}`))));
    });
    const last = output.trim().split("\n").pop() ?? "{}";
    const { files } = JSON.parse(last) as { files: string[] };
    return Promise.all(files.map((file) => readFile(file)));
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function renderReelLocally(props: RenderProps): Promise<Buffer> {
  const [file] = await renderHere("reel", props);
  if (!file) throw new Error("The local render returned no file");
  return file;
}

export async function renderSlides(props: RenderProps, count: number): Promise<Buffer[]> {
  return onVercel() ? slidesOnVercel(props, count) : renderHere("slides", props, count);
}
