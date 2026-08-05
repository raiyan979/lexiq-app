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

/*
 * Frequency, tuned to stay gentle (this is a kids' learning app — annoyance
 * costs retention). Three limits stack:
 *   - GRACE_SESSIONS: the first lessons are always ad-free, so a new learner
 *     gets real value before ever seeing an ad (better first impression, fewer
 *     early uninstalls).
 *   - CADENCE: after the grace period, at most one ad per this many lessons.
 *   - COOLDOWN_MS: never two ads within this window, so blitzing several short
 *     lessons in a row can't stack ads back-to-back.
 * All anchored to the session-complete screen — never mid-lesson.
 */
const GRACE_SESSIONS = 2;
const CADENCE = 3;
const COOLDOWN_MS = 3 * 60_000;
const COUNT_KEY = 'lexiq.ads.sessionCount';
const LAST_AD_KEY = 'lexiq.ads.lastShownAt';

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
 * Call when a learning session completes. Shows an interstitial only past the
 * grace period, on the cadence, and outside the cooldown window — then keeps
 * one preloaded for next time.
 */
export async function onSessionComplete(): Promise<void> {
  if (!adsActive()) return;
  const n = (Number(localStorage.getItem(COUNT_KEY)) || 0) + 1;
  localStorage.setItem(COUNT_KEY, String(n));

  const pastGrace = n > GRACE_SESSIONS;
  const onCadence = (n - GRACE_SESSIONS) % CADENCE === 0;
  const lastAt = Number(localStorage.getItem(LAST_AD_KEY)) || 0;
  const cooledDown = Date.now() - lastAt >= COOLDOWN_MS;

  if (pastGrace && onCadence && cooledDown) {
    await showInterstitial();
    localStorage.setItem(LAST_AD_KEY, String(Date.now()));
  }
  // Keep one loading so the next eligible boundary has an ad ready.
  void preloadInterstitial();
}
