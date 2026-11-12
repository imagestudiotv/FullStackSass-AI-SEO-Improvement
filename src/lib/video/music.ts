import type { CreativeDirection, MusicDirection } from "./formats";

/**
 * The music for videos (client, 2026-10-29: "use free music"; 2026-11-12:
 * "use licensed music appropriate for commercial distribution"): tracks from
 * Mixkit (mixkit.co), each under the Mixkit Stock Music Free License
 * (https://mixkit.co/license/#musicFree, checked 2026-11-12 on the track
 * listings' own records and the music pages): free for personal and
 * commercial projects including YouTube, social media posts, online ads and
 * websites, no attribution needed; NOT for CDs, DVDs, video games or TV and
 * radio broadcasts. Each is trimmed to 75 seconds, its loudness evened out
 * (about -16 LUFS, ffmpeg loudnorm) with a 3 s fade out, 128 kbps - so the
 * swipe preview, the render machine and the platforms all hear the same
 * file. Few on purpose: every track is shipped with the app.
 *
 * The record of each track (source page, licence, date) is kept here, next
 * to the file, for the licence's sake.
 *
 * No server imports: the Videos page uses the list too.
 */

export const MUSIC_MOODS = ["upbeat", "inspiring", "chill", "energetic", "warm", "minimal", "cinematic", "ambient"] as const;
export type MusicMood = (typeof MUSIC_MOODS)[number];

export type MusicTrack = {
  id: string;
  title: string;
  mood: MusicMood;
  file: string;
  /** Provenance, kept for the licence. */
  artist: string;
  source: string;
  licence: string;
  /** When it was downloaded and checked. */
  added: string;
};

const MIXKIT_LICENCE = "Mixkit Stock Music Free License (https://mixkit.co/license/#musicFree)";

export const MUSIC_TRACKS: readonly MusicTrack[] = [
  { id: "feeling-happy", title: "Feeling Happy", mood: "upbeat", file: "mixkit-feeling-happy.mp3", artist: "Ahjay Stelino", source: "https://assets.mixkit.co/music/5/5.mp3", licence: MIXKIT_LICENCE, added: "2026-10-29" },
  { id: "cat-walk", title: "Cat Walk", mood: "energetic", file: "mixkit-cat-walk.mp3", artist: "Arulo", source: "https://assets.mixkit.co/music/371/371.mp3", licence: MIXKIT_LICENCE, added: "2026-10-29" },
  { id: "digital-clouds", title: "Digital Clouds", mood: "chill", file: "mixkit-digital-clouds.mp3", artist: "Alejandro Magaña (A. M.)", source: "https://assets.mixkit.co/music/175/175.mp3", licence: MIXKIT_LICENCE, added: "2026-10-29" },
  // 2026-11-12: the cinematic, ambient/minimal and more upbeat moods (viral content).
  { id: "driving-ambition", title: "Driving Ambition", mood: "cinematic", file: "mixkit-driving-ambition.mp3", artist: "Ahjay Stelino", source: "https://assets.mixkit.co/music/32/32.mp3", licence: MIXKIT_LICENCE, added: "2026-11-12" },
  { id: "a-new-life", title: "A New Life", mood: "cinematic", file: "mixkit-a-new-life.mp3", artist: "Eugenio Mininni", source: "https://assets.mixkit.co/music/543/543.mp3", licence: MIXKIT_LICENCE, added: "2026-11-12" },
  { id: "placeit-world-02", title: "PlaceIt World 02", mood: "minimal", file: "mixkit-placeit-world-02.mp3", artist: "Lily J", source: "https://assets.mixkit.co/music/725/725.mp3", licence: MIXKIT_LICENCE, added: "2026-11-12" },
  { id: "valley-sunset", title: "Valley Sunset", mood: "ambient", file: "mixkit-valley-sunset.mp3", artist: "Alejandro Magaña (A. M.)", source: "https://assets.mixkit.co/music/127/127.mp3", licence: MIXKIT_LICENCE, added: "2026-11-12" },
  { id: "motivating-mornings", title: "Motivating Mornings", mood: "upbeat", file: "mixkit-motivating-mornings.mp3", artist: "Ahjay Stelino", source: "https://assets.mixkit.co/music/33/33.mp3", licence: MIXKIT_LICENCE, added: "2026-11-12" },
  { id: "what-about-action", title: "What About Action?", mood: "energetic", file: "mixkit-what-about-action.mp3", artist: "Diego Nava", source: "https://assets.mixkit.co/music/474/474.mp3", licence: MIXKIT_LICENCE, added: "2026-11-12" },
];

/** How loud the music plays under the voice, and without one. */
export const MUSIC_VOLUME = { underVoice: 0.12, alone: 0.45 } as const;

export function musicTrack(id: string | null | undefined): MusicTrack | null {
  return MUSIC_TRACKS.find((track) => track.id === id) ?? null;
}

/** The track's address, from the app's own address (the render machine fetches it). */
export function musicUrl(track: MusicTrack, appUrl: string): string {
  return `${appUrl.replace(/\/+$/, "")}/video-music/${track.file}`;
}

function hashOf(seed: string): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

/** A track for an idea, the same one each time for the same idea, varied across ideas (the original templates). */
export function pickTrack(seed: string, style: string): MusicTrack | null {
  if (MUSIC_TRACKS.length === 0) return null;
  const moods: Record<string, MusicMood[]> = {
    bold: ["upbeat", "energetic", "inspiring"],
    numbers: ["minimal", "upbeat", "energetic"],
    story: ["inspiring", "warm", "chill"],
  };
  const preferred = MUSIC_TRACKS.filter((track) => (moods[style] ?? MUSIC_MOODS).includes(track.mood));
  const pool = preferred.length > 0 ? preferred : MUSIC_TRACKS;
  return pool[hashOf(seed) % pool.length];
}

/** The moods each creative direction suits when the music is on Auto. */
const DIRECTION_MOODS: Record<CreativeDirection, MusicMood[]> = {
  meme: ["upbeat", "energetic", "chill"],
  footage: ["upbeat", "cinematic", "chill"],
  storytelling: ["cinematic", "ambient", "minimal"],
  text_music: ["energetic", "upbeat", "cinematic"],
  voiceover: ["minimal", "ambient", "chill", "upbeat"],
  animated: ["upbeat", "energetic", "minimal"],
};

/** The moods a MusicDirection choice allows (Auto: by direction and the plan's mood). */
const DIRECTION_CHOICE: Record<Exclude<MusicDirection, "auto" | "none">, MusicMood[]> = {
  cinematic: ["cinematic"],
  upbeat: ["upbeat", "energetic"],
  ambient: ["ambient", "minimal", "chill"],
};

/**
 * The track for a production: none when the customer chose "none"; the
 * chosen character (cinematic, upbeat, ambient) otherwise; on Auto, the
 * plan's mood when it names one we have, else what suits the direction -
 * varied across ideas by the seed, the same for the same idea.
 */
export function pickProductionTrack(seed: string, direction: CreativeDirection, music: MusicDirection, planMood: string | null | undefined): MusicTrack | null {
  if (music === "none" || MUSIC_TRACKS.length === 0) return null;
  let moods: MusicMood[];
  if (music !== "auto") moods = DIRECTION_CHOICE[music];
  else {
    const mood = planMood?.trim().toLowerCase() ?? "";
    const named = MUSIC_MOODS.find((candidate) => mood.includes(candidate));
    moods = named ? [named] : DIRECTION_MOODS[direction] ?? MUSIC_MOODS.slice();
  }
  const pool = MUSIC_TRACKS.filter((track) => moods.includes(track.mood));
  const tracks = pool.length > 0 ? pool : MUSIC_TRACKS;
  return tracks[hashOf(seed) % tracks.length];
}
