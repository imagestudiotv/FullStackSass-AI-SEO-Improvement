#!/usr/bin/env node
/**
 * Makes AI hook clips for the library (src/lib/video/footage/ai-library.ts),
 * for a person to check before any is added. Nothing here runs in the app.
 *
 *   GEMINI_API_KEY=... node scripts/ai-clips.mjs <prompts.json> <out-dir> [budget=9]
 *
 * prompts.json: [{ "id": "2026-11-19-marble-run", "type": "anticipation",
 * "tags": [...], "prompt": "..." }, ...]. Each clip is made once with Google's
 * Gemini Omni Flash (Gemini API): 9:16, 720p, 8 seconds; a clip already in
 * <out-dir> is skipped, so a stopped run picks up where it was. The run stops
 * before a clip that would take the estimated spend over budget= (USD).
 *
 * For each clip it saves <out-dir>/<id>.mp4, an 8-frame strip
 * (<out-dir>/<id>.png), the suggested climax (the biggest change between
 * frames after the first second, ffmpeg's scene score) and the estimated cost
 * in <out-dir>/clips.json, plus <out-dir>/index.html to look through. A kept
 * clip goes into AI_HOOK_LIBRARY with its climax checked by eye.
 *
 * Price (Gemini API pricing page, 2026-11-19): $0.07 a second at 720p, so
 * $0.56 a clip. No free tier: the project's prepaid credit pays; at $0 the
 * key gets 402 and the run stops. Needs ffmpeg on PATH. The key is read from
 * the environment and never printed.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const MODEL = "gemini-omni-1.2-flash";
const SECONDS = 8;
const RESOLUTION = "720p";
const USD_PER_SECOND = 0.07;
const API = "https://generativelanguage.googleapis.com/v1beta/interactions";

const [promptsFile, outArg] = process.argv.slice(2);
const budget = Number(process.argv.find((a) => a.startsWith("budget="))?.slice(7) ?? 9);
const key = process.env.GEMINI_API_KEY?.trim();
if (!promptsFile || !outArg) {
  console.error("Usage: node scripts/ai-clips.mjs <prompts.json> <out-dir> [budget=9]");
  process.exit(1);
}
if (!key) {
  console.error("Set GEMINI_API_KEY (Google AI Studio, a project with billing on).");
  process.exit(1);
}
const scrub = (text) => String(text).split(key).join("[key]");
const out = path.resolve(outArg);
mkdirSync(out, { recursive: true });
const prompts = JSON.parse(readFileSync(promptsFile, "utf8"));
const listFile = path.join(out, "clips.json");
const made = existsSync(listFile) ? JSON.parse(readFileSync(listFile, "utf8")) : [];
const clipCost = SECONDS * USD_PER_SECOND;

/** The second with the biggest change between frames after the first second: a guess at the climax. */
function suggestedClimaxMs(file) {
  const log = execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-i", file, "-vf", "select='gte(scene,0)',metadata=print:file=-", "-an", "-f", "null", "-"], { stdio: ["ignore", "pipe", "pipe"] }).toString();
  let best = { t: null, score: -1 };
  let t = null;
  for (const line of log.split(/\r?\n/)) {
    const time = line.match(/pts_time:([\d.]+)/);
    if (time) t = Number(time[1]);
    const score = line.match(/lavfi\.scene_score=([\d.]+)/);
    if (score && t !== null && t > 1 && Number(score[1]) > best.score) best = { t, score: Number(score[1]) };
  }
  return best.t === null ? null : Math.round(best.t * 1000);
}

async function generate(prompt) {
  const response = await fetch(API, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      input: prompt,
      response_format: { type: "video", aspect_ratio: "9:16", resolution: RESOLUTION, duration: `${SECONDS}s` },
    }),
    signal: AbortSignal.timeout(10 * 60_000),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${scrub(body.slice(0, 400))}`);
  const json = JSON.parse(body);
  const video = (json.steps ?? []).flatMap((step) => step.content ?? []).find((part) => part.type === "video");
  if (!video?.data) throw new Error(`no video in the answer (status ${json.status})`);
  return Buffer.from(video.data, "base64");
}

let spent = made.reduce((sum, clip) => sum + clip.estimatedUsd, 0);
for (const item of prompts) {
  const file = path.join(out, `${item.id}.mp4`);
  if (existsSync(file)) continue;
  if (spent + clipCost > budget) {
    console.log(`stopped: the next clip would take the spend over $${budget} (spent about $${spent.toFixed(2)})`);
    break;
  }
  const started = Date.now();
  let data;
  try {
    data = await generate(item.prompt);
  } catch (error) {
    console.error(`${item.id}: ${error.message}`);
    // No credit left or a bad key: nothing later can succeed.
    if (/^(400|401|402|403|429) /.test(error.message)) break;
    continue;
  }
  writeFileSync(file, data);
  spent += clipCost;
  const strip = path.join(out, `${item.id}.png`);
  execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", "-i", file, "-vf", `fps=1,scale=180:-2,tile=8x1:padding=4:color=white`, "-frames:v", "1", strip]);
  const clip = { ...item, model: MODEL, seconds: SECONDS, resolution: RESOLUTION, estimatedUsd: clipCost, suggestedClimaxMs: suggestedClimaxMs(file), madeAt: new Date().toISOString(), tookSeconds: Math.round((Date.now() - started) / 1000) };
  made.push(clip);
  writeFileSync(listFile, JSON.stringify(made, null, 2));
  console.log(`${item.id}: ${Math.round(data.length / 1024)} KB, ${clip.tookSeconds}s, climax~${clip.suggestedClimaxMs}ms, spent about $${spent.toFixed(2)}`);
}
const rows = made
  .map((c) => `<tr><td>${c.type}<br><b>${c.id}</b><br>climax ~${c.suggestedClimaxMs ?? "?"} ms<br>$${c.estimatedUsd.toFixed(2)}<br><video src="${c.id}.mp4" width="180" controls muted></video></td><td><img src="${c.id}.png" width="1500"><br><small>${c.prompt}</small></td></tr>`)
  .join("\n");
writeFileSync(path.join(out, "index.html"), `<!doctype html><meta charset="utf-8"><title>AI hook clips</title><table border="1" cellpadding="6">${rows}</table>`);
console.log(`${made.length} clips, about $${spent.toFixed(2)} -> ${path.join(out, "index.html")}`);
