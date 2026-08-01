# Mobile ads — implementation spec (NOT built yet)

Concrete, follow-the-steps plan for adding ads to Croqui. Nothing here is built.
Desktop stays ad-free forever; ads are an **Android-only** feature, gated off by
default. Read the constraints first — they dictate every technical choice.

---

## 0. Decision & timing (settled 2026-08-01)

- **Build against Google's official TEST ad IDs first.** No AdMob account needed
  to develop and verify. The account only blocks real revenue + publishing.
- **Do not ship ads on sideloaded APKs.** A banner in a small kids app earns
  almost nothing; the payoff only exists with **Play Store distribution**. So:
  build + verify now if desired, but keep ads **switched off** (feature flag)
  until we're publishing to Play with a real AdMob account.
- **Ship the privacy-policy rewrite in the SAME release as ads.** The instant
  ads are live, "collects nothing / no ads" is false. See §5.

---

## 1. Hard constraint: Croqui is a children's app

It has an under-12 child mode, so it is child-directed and triggers the strict
rules. We **cannot** drop in a generic ad SDK.

- **Non-personalized / contextual ads ONLY** — no behavioral targeting on minors
  (COPPA US <13, GDPR-K EU <16, Google Play Families).
- **Certified family-safe network** — use **Google AdMob with child-directed
  treatment**, certified for Play Families. (Alternative: a kid network like
  SuperAwesome, if AdMob's fill is poor.)
- **Kid-safe content only** — max ad content rating **G**; no alcohol, gambling,
  dating, mature/violent campaigns.
- **Gentle placement** — one small banner, OR an interstitial **between**
  completed sessions. **Never** mid-lesson, never where a child can mis-tap.
- **Online-only** — ads are requested only when the device is actually online.
  Offline (the default for this app) → never request or show an ad.
- **Event-anchored cadence, never a wall-clock timer** — e.g. "after ~2 lessons"
  or on a session-complete screen. A timer can interrupt a child mid-lesson and
  can violate Play Families placement rules.

---

## 2. Blockers (must clear before real ads ship)

1. **AdMob account — Raiyan only.** Needs identity + tax/payout details; Claude
   cannot create it. In the account, configure **child-directed treatment** and
   create the ad units (one banner, one interstitial). This yields the real App
   ID + unit IDs that replace the test IDs.
2. **Privacy policy + Play Data Safety rewrite** — see §5. Ships with the ads.
3. **Play Store distribution** — real signing (done), store review, content
   rating, Data Safety. Sideload alone isn't worth wiring ads for.

---

## 3. Technical implementation

AdMob is a **native Android SDK** (Google Mobile Ads, "GMA"). There is no
official Tauri plugin, so we write a **small Android-only Tauri v2 mobile plugin
in Kotlin** that wraps GMA and exposes calls to the JS side. Everything is
platform-gated: desktop never loads or compiles any of it.

### 3.1 Native side (Kotlin Tauri plugin, `src-tauri` mobile plugin)

- **Gradle dependency** (Android only): `com.google.android.gms:play-services-ads:<latest 23.x>`.
- **AndroidManifest.xml** — add the AdMob application ID meta-data:
  ```xml
  <meta-data
      android:name="com.google.android.gms.ads.APPLICATION_ID"
      android:value="ca-app-pub-3940256099942544~3347511713"/>  <!-- TEST App ID -->
  ```
- **INTERNET permission** — already present in the manifest; confirm it stays.
- **Initialize GMA once** with child-directed + G-rated config:
  ```kotlin
  val config = RequestConfiguration.Builder()
      .setTagForChildDirectedTreatment(
          RequestConfiguration.TAG_FOR_CHILD_DIRECTED_TREATMENT_TRUE)
      .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_G)
      .build()
  MobileAds.setRequestConfiguration(config)
  MobileAds.initialize(context) { /* ready */ }
  ```
- **Force non-personalized** on every request via extras:
  ```kotlin
  val extras = Bundle().apply { putString("npa", "1") }
  val adRequest = AdRequest.Builder()
      .addNetworkExtrasBundle(AdMobAdapter::class.java, extras)
      .build()
  ```
- **Expose to JS** (plugin commands): `initAds()`, `showBanner()`,
  `hideBanner()`, `loadInterstitial()`, `showInterstitial()`. Banner is an
  `AdView`; interstitial is `InterstitialAd.load(...)` then `.show(activity)`.

### 3.2 JS/Svelte side

- **Platform gate everything**: `const ON_ANDROID = /* tauri platform check */;`
  All ad code short-circuits to no-op off Android.
- **Feature flag**: `const ADS_ENABLED = false;` until Play launch. When false,
  nothing initializes.
- **Connectivity gate**: only call `showBanner` / `showInterstitial` when
  `navigator.onLine` is true (+ optionally a lightweight reachability ping).
  Re-check on the `online`/`offline` events; hide the banner when going offline.
- **Placement**:
  - *Banner* — a small, fixed slot that doesn't overlap lesson content
    (e.g. a reserved strip on the dashboard/home, not inside an exercise).
  - *Interstitial* — trigger on the **session-complete** screen, at low
    frequency (e.g. once per ~2 completed sessions), gated on `ADS_ENABLED &&
    ON_ANDROID && online`. Preload with `loadInterstitial()` a bit before.
- **Never** mount ad UI on desktop or inside `TextExercise` / any live exercise.

### 3.3 Security / CSP

- The strict CSP must be relaxed **on Android only** to allow the AdMob domains
  (`*.googlesyndication.com`, `*.google.com`, `*.doubleclick.net`,
  `*.gstatic.com`, and the GMA endpoints Google documents). Desktop CSP stays
  strict. Document the exact allowlist next to the change.

### 3.4 Official Google TEST IDs (use during development — no account needed)

| Purpose            | Test ID                                          |
|--------------------|--------------------------------------------------|
| App ID             | `ca-app-pub-3940256099942544~3347511713`         |
| Banner unit        | `ca-app-pub-3940256099942544/6300978111`         |
| Interstitial unit  | `ca-app-pub-3940256099942544/1033173712`         |

Test ads show a clear "Test Ad" label. **Never** click your own live ads later —
that's invalid-traffic and gets accounts banned; use the test IDs for all dev.

---

## 4. Verification (on the tablet)

- Test banner renders in its slot, doesn't overlap lessons, disappears offline.
- Test interstitial shows only on session-complete, at the intended low cadence,
  never mid-lesson.
- Desktop build: no ad code compiled/loaded, CSP still strict, still offline.
- Airplane mode → zero ad requests (check no network calls fire).

---

## 5. Privacy / compliance changes (ship WITH the ads)

The current story is "offline, collects nothing, no ads." Ads break that. Update
**all three** in the same release:

- **`src/routes/Legal.svelte`** (in-app) — replace the "no network / no ads"
  bullets with an honest, child-appropriate ads disclosure: Android-only,
  online-only, non-personalized, kid-safe, served by Google AdMob; link AdMob's
  policy.
- **`docs/index.html`** (public GitHub Pages policy) — same disclosure.
- **Google Play Data Safety form** — declare the ad SDK's data collection
  (device/ad identifiers etc. per AdMob's disclosure guidance) and the
  child-directed / Families settings. Re-affirm the Families policy target.

---

## 6. Ordered checklist

- [ ] (Raiyan) Create AdMob account, enable child-directed treatment, create
      banner + interstitial units → obtain real App ID + unit IDs.
- [ ] Write the Kotlin GMA Tauri plugin (init + banner + interstitial), §3.1.
- [ ] Add gradle dep + manifest App ID meta-data (test ID first), §3.1.
- [ ] JS bridge + `ON_ANDROID` gate + `ADS_ENABLED` flag + connectivity gate, §3.2.
- [ ] Banner slot (non-overlapping) + session-complete interstitial trigger, §3.2.
- [ ] Android-only CSP allowlist for AdMob domains, §3.3.
- [ ] Verify on tablet with TEST IDs, §4.
- [ ] Rewrite Legal.svelte + docs/index.html + Play Data Safety, §5.
- [ ] Swap test IDs → real IDs, flip `ADS_ENABLED = true`, ship in a Play release.

---

## 7. Honest expectations

- Store fees: Play $25 once (Apple $99/yr only if iOS ever happens — needs a Mac).
- A non-personalized banner in a small kids app earns very little until there's a
  real user base; it offsets fees slowly.
- Meaningful revenue implies **store distribution**, not sideloading — which is
  why ads are sequenced to land with (not before) the Play release.

## Status

PLANNED, not scheduled. Depends on: Play Store launch decision → AdMob account →
implement §3 against test IDs → policy rewrite §5 → real IDs.
