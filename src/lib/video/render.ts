import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";

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

export type RenderHandle = { sandboxId: string; cmdId: string };

/**
 * Remotion's render settings for its sandbox script, as renderMediaOnVercel
 * writes them (@remotion/vercel 4.0.539, pinned): that function only runs
 * detached when the result goes to Vercel Blob, and RepGet keeps its files in
 * Supabase - so the same command is started here and the file read back.
 */
function renderConfig(props: ReelProps) {
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

/** Starts a reel's render on a new sandbox. */
export async function startReelRender(props: ReelProps): Promise<RenderHandle> {
  const { addBundleToSandbox, createSandbox } = await import("@remotion/vercel");
  const sandbox = await createSandbox({ resources: { vcpus: 4 } });
  try {
    await addBundleToSandbox({ sandbox, bundleDir: bundleDir() });
    const command = await sandbox.runCommand({
      cmd: "node",
      args: ["render-video.mjs", JSON.stringify(renderConfig(props))],
      detached: true,
    });
    await sandbox.extendTimeout(20 * 60 * 1000);
    return { sandboxId: sandbox.sandboxId, cmdId: command.cmdId };
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

export async function stopRender(handle: RenderHandle): Promise<void> {
  const { Sandbox } = await import("@vercel/sandbox");
  await Sandbox.get({ sandboxId: handle.sandboxId })
    .then((sandbox) => sandbox.stop())
    .catch(() => undefined);
}

/** A carousel's slides as PNGs, in order, on one sandbox (each takes seconds). */
async function slidesOnVercel(props: ReelProps, count: number): Promise<Buffer[]> {
  const { addBundleToSandbox, createSandbox, renderStillOnVercel } = await import("@remotion/vercel");
  const sandbox = await createSandbox({ resources: { vcpus: 4 } });
  try {
    await addBundleToSandbox({ sandbox, bundleDir: bundleDir() });
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
async function renderHere(kind: "reel" | "slides", props: ReelProps, count = 0): Promise<Buffer[]> {
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

export async function renderReelLocally(props: ReelProps): Promise<Buffer> {
  const [file] = await renderHere("reel", props);
  if (!file) throw new Error("The local render returned no file");
  return file;
}

export async function renderSlides(props: ReelProps, count: number): Promise<Buffer[]> {
  return onVercel() ? slidesOnVercel(props, count) : renderHere("slides", props, count);
}
