/**
 * The free music for videos (client, 2026-10-29: "use free music"): tracks
 * from Mixkit (mixkit.co), whose Stock Music Free License allows commercial
 * use in videos and on social media with no credit needed (not on CDs, DVDs,
 * games or TV and radio). Each is trimmed to 75 seconds, its loudness evened
 * out (-16 LUFS) and kept in public/video-music, so the swipe preview, the
 * render machine and the platforms all hear the same file. Few on purpose:
 * every track is shipped with the app.
 *
 * An idea gets a track by its mood when it is made into a video; the
 * customer can pick another one, or none.
 *
 * No server imports: the Videos page uses the list too.
 */

export const MUSIC_MOODS = ["upbeat", "inspiring", "chill", "energetic", "warm", "minimal"] as const;
export type MusicMood = (typeof MUSIC_MOODS)[number];

export type MusicTrack = { id: string; title: string; mood: MusicMood; file: string };

export const MUSIC_TRACKS: readonly MusicTrack[] = [
  // Mixkit item 5, "Feeling Happy".
  { id: "feeling-happy", title: "Feeling Happy", mood: "upbeat", file: "mixkit-feeling-happy.mp3" },
  // Mixkit item 371, "Cat Walk".
  { id: "cat-walk", title: "Cat Walk", mood: "energetic", file: "mixkit-cat-walk.mp3" },
  // Mixkit item 175, "Digital Clouds".
  { id: "digital-clouds", title: "Digital Clouds", mood: "chill", file: "mixkit-digital-clouds.mp3" },
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

/** A track for an idea, the same one each time for the same idea, varied across ideas. */
export function pickTrack(seed: string, style: string): MusicTrack | null {
  if (MUSIC_TRACKS.length === 0) return null;
  const moods: Record<string, MusicMood[]> = {
    bold: ["upbeat", "energetic", "inspiring"],
    numbers: ["minimal", "upbeat", "energetic"],
    story: ["inspiring", "warm", "chill"],
  };
  const preferred = MUSIC_TRACKS.filter((track) => (moods[style] ?? MUSIC_MOODS).includes(track.mood));
  const pool = preferred.length > 0 ? preferred : MUSIC_TRACKS;
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return pool[hash % pool.length];
}
