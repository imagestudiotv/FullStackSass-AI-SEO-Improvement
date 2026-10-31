import "server-only";

import type { CaptionWord, Voice } from "./formats";

/**
 * The AI voice and its word timings (client, 2026-10-29: "AI voice-over in
 * the website's language; the client can change it").
 *
 * Each part of the script (hook, every point, proof, call to action) is
 * spoken separately by OpenAI's text-to-speech as raw PCM, so its length is
 * exact - bytes / (rate x 2) - and the scene for that part starts the moment
 * its words do. The parts are joined with a short pause into one WAV file.
 * Each part is then transcribed with word timestamps (Whisper) for the
 * word-by-word captions.
 *
 * Cost: about $0.015 a minute of voice plus $0.006 a minute of
 * transcription - under 2 cents a reel.
 */

const SPEECH_MODEL = "gpt-4o-mini-tts";
const TRANSCRIBE_MODEL = "whisper-1";
/** OpenAI's PCM: 24 kHz, 16-bit, mono. */
const RATE = 24_000;
const BYTES_PER_MS = (RATE * 2) / 1000;
/** The pause between two parts. */
const GAP_MS = 280;
const TIMEOUT_MS = 60_000;

/** Approximate list prices, for usage tracking (USD per minute). */
export const VOICE_COST_PER_MINUTE = 0.015 + 0.006;

export function isVoiceConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function key(): string {
  const value = process.env.OPENAI_API_KEY?.trim();
  if (!value) throw new Error("OPENAI_API_KEY is not set");
  return value;
}

async function speak(text: string, voice: Voice, language: string): Promise<Buffer> {
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { authorization: `Bearer ${key()}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: SPEECH_MODEL,
      voice,
      input: text.slice(0, 1500),
      response_format: "pcm",
      instructions: `Speak in ${language} as an upbeat, confident narrator of a short social media video: lively, clear and natural, never robotic.`,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Text to speech failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  return Buffer.from(await response.arrayBuffer());
}

/** A WAV header in front of raw 24 kHz mono PCM. */
export function wav(pcm: Buffer): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function transcribe(pcm: Buffer, language: string): Promise<{ words: CaptionWord[] }> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(wav(pcm))], { type: "audio/wav" }), "part.wav");
  form.append("model", TRANSCRIBE_MODEL);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  if (/^[a-z]{2}$/.test(language)) form.append("language", language);
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${key()}` },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Transcription failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  const json = (await response.json()) as { words?: { word: string; start: number; end: number }[] };
  return {
    words: (json.words ?? []).map((word) => ({
      text: word.word.trim(),
      startMs: Math.round(word.start * 1000),
      endMs: Math.round(word.end * 1000),
    })),
  };
}

/**
 * The words a part's transcription heard, re-spelt with the script's own
 * words where they line up one for one - Whisper may write "3" for "three"
 * or drop an accent, and the captions should read as the script does.
 */
export function respell(heard: CaptionWord[], text: string): CaptionWord[] {
  const written = text.split(/\s+/).filter(Boolean);
  if (written.length !== heard.length) return heard;
  return heard.map((word, index) => ({ ...word, text: written[index] }));
}

export type SpokenScript = {
  /** The whole voice as one WAV file. */
  audio: Buffer;
  words: CaptionWord[];
  sceneStartsMs: number[];
  durationMs: number;
};

/**
 * Speaks the parts in order. The scenes follow the voice: part n starts at
 * sceneStartsMs[n].
 */
export async function speakScript(parts: string[], voice: Voice, language: string): Promise<SpokenScript> {
  const spoken = await Promise.all(parts.map((part) => speak(part, voice, language)));
  const heard = await Promise.all(spoken.map((pcm) => transcribe(pcm, language)));

  const gap = Buffer.alloc(Math.round(GAP_MS * BYTES_PER_MS) & ~1);
  const chunks: Buffer[] = [];
  const words: CaptionWord[] = [];
  const sceneStartsMs: number[] = [];
  let at = 0;
  spoken.forEach((pcm, index) => {
    sceneStartsMs.push(Math.round(at));
    for (const word of respell(heard[index].words, parts[index])) {
      words.push({ text: word.text, startMs: Math.round(at + word.startMs), endMs: Math.round(at + word.endMs) });
    }
    chunks.push(pcm);
    at += pcm.length / BYTES_PER_MS;
    if (index < spoken.length - 1) {
      chunks.push(gap);
      at += gap.length / BYTES_PER_MS;
    }
  });
  return { audio: wav(louder(Buffer.concat(chunks))), words, sceneStartsMs, durationMs: Math.round(at) };
}

/** The loudest sample after louder(): 1 dB under full scale. */
const PEAK = Math.round(32767 * 10 ** (-1 / 20));
/** At most 4x (12 dB), so a near-silent voice is not turned into noise. */
const MAX_GAIN = 4;

/**
 * The voice turned up as one piece, its loudest moment just under full
 * scale. OpenAI's speech comes out quiet (about -28 LUFS, peaks near -10 dB)
 * and the apps play reels at about -14 LUFS, so a reel would sound faint
 * next to the others. A plain gain: nothing clips, the parts keep their
 * levels.
 */
export function louder(pcm: Buffer): Buffer {
  let peak = 0;
  for (let at = 0; at + 1 < pcm.length; at += 2) peak = Math.max(peak, Math.abs(pcm.readInt16LE(at)));
  const gain = peak > 0 ? Math.min(MAX_GAIN, PEAK / peak) : 1;
  if (gain <= 1) return pcm;
  const out = Buffer.alloc(pcm.length);
  for (let at = 0; at + 1 < pcm.length; at += 2) out.writeInt16LE(Math.round(pcm.readInt16LE(at) * gain), at);
  return out;
}
