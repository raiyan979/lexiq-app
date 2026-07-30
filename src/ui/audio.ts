/*
 * Audio playback. Clips ship as frontend static assets (public/audio/*.mp3),
 * so they are served from the app's own origin on every platform — desktop
 * WebView and the Android WebView alike. A DB `audio_path` like
 * "audio/<hash>.mp3" therefore resolves to the same-origin URL "/audio/<hash>.mp3".
 *
 * This deliberately avoids Tauri's resource dir + asset protocol: on Android the
 * bundled resources live inside the APK (not on the filesystem), so resolveResource
 * + convertFileSrc produce an unreachable path and nothing plays. Serving the
 * clips as frontend assets sidesteps that entirely.
 *
 * Everything degrades gracefully: a null path, a missing file, or a disabled
 * audio pref simply plays nothing.
 */

import { prefs } from './prefs.svelte';

let current: HTMLAudioElement | null = null;

/** Play a clip by its DB audio_path. No-op on null/disabled. */
export async function playClip(audioPath: string | null): Promise<void> {
  if (audioPath === null || !prefs.audioEnabled) return;
  // audio_path is app-root-relative ("audio/<hash>.mp3"); the leading slash
  // anchors it to the origin regardless of the current hash route.
  const src = `/${audioPath}`;
  current?.pause();
  current = new Audio(src);
  try {
    await current.play();
  } catch {
    // ignore autoplay/interruption/missing-file rejections
  }
}
