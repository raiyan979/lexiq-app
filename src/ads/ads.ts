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
 * Frequency. Product decision: show an interstitial after every completed
 * lesson. The knobs remain so cadence can be softened later without code
 * changes:
 *   - GRACE_SESSIONS: how many opening lessons are always ad-free.
 *   - CADENCE: after the grace period, one ad per this many lessons (1 = every).
 *   - COOLDOWN_MS: minimum gap between two ads (0 = no time gate).
 * All anchored to the session-complete screen — never mid-lesson.
 */
const GRACE_SESSIONS = 0;
const CADENCE = 1;
const COOLDOWN_MS = 0;
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

/** CSS var the shell reads to shrink itself and reserve room for the banner. */
const BANNER_VAR = '--ad-banner-height';

function setBannerHeight(px: number): void {
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty(BANNER_VAR, `${px}px`);
  }
}

/**
 * Show the bottom banner and reserve its height in the layout. No-op (and zero
 * reserved height) unless ads are active, so desktop/offline is untouched.
 */
export async function showBanner(): Promise<void> {
  if (!adsActive()) {
    setBannerHeight(0);
    return;
  }
  try {
    const size = await invoke<{ height: number }>('plugin:ads|show_banner');
    setBannerHeight(size?.height ?? 0);
  } catch {
    setBannerHeight(0);
  }
}

/** Hide the banner and release its reserved space. */
export async function hideBanner(): Promise<void> {
  setBannerHeight(0);
  if (!ON_ANDROID) return;
  try {
    await invoke('plugin:ads|hide_banner');
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
