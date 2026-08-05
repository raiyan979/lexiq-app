/*
 * Interstitial ads — Android only, non-personalized, child-directed.
 *
 * Gated three independent ways, all of which must hold before anything fires:
 *   1. ADS_ENABLED — master switch, stays false until the Play Store release.
 *   2. platform    — Android only (the native plugin is a no-op elsewhere).
 *   3. connectivity — online only (the app is offline-first; no net → no ad).
 *
 * Until all three hold, every function here is a silent no-op, so the offline
 * desktop/core experience is completely untouched. Ads are shown only on the
 * session-complete boundary, at low cadence — never mid-lesson.
 */
import { invoke } from '@tauri-apps/api/core';

/** Master switch. Flip to true only for the Play release with real ad IDs. */
const ADS_ENABLED = false;

/** Show an interstitial at most once per this many completed sessions. */
const CADENCE = 2;
const COUNT_KEY = 'lexiq.ads.sessionCount';

const ON_ANDROID =
  typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

function adsActive(): boolean {
  return ADS_ENABLED && ON_ANDROID && typeof navigator !== 'undefined' && navigator.onLine;
}

/** Preload an interstitial so one is ready to show. Safe to call anytime. */
export async function preloadInterstitial(): Promise<void> {
  if (!adsActive()) return;
  try {
    await invoke('plugin:ads|load_interstitial');
  } catch {
    // No ad is always better than a crash.
  }
}

/** Show a preloaded interstitial if ready; no-op otherwise. */
async function showInterstitial(): Promise<void> {
  if (!adsActive()) return;
  try {
    await invoke('plugin:ads|show_interstitial');
  } catch {
    // ignore
  }
}

/**
 * Call when a learning session completes. Counts completions and, every
 * `CADENCE` sessions, shows an interstitial then preloads the next one.
 */
export async function onSessionComplete(): Promise<void> {
  if (!adsActive()) return;
  const n = (Number(localStorage.getItem(COUNT_KEY)) || 0) + 1;
  localStorage.setItem(COUNT_KEY, String(n));
  if (n % CADENCE === 0) {
    await showInterstitial();
  }
  // Always keep one loading so the next eligible boundary has an ad ready.
  void preloadInterstitial();
}
