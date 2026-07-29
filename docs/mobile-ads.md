# Mobile ads & monetization — plan (NOT built yet)

Captured so we don't forget. Revisit after the app runs on Android (Phase 1)
and the core is stable. Desktop stays ad-free; ads are an Android-only feature.

## Goal

Minimal, unobtrusive ads on the **mobile app only**, to recoup distribution
costs (Google Play $25 one-time; Apple $99/yr only if iOS happens later).
This is **cost recovery, not a business model** — set expectations low.

## Hard constraint: Lexiq is a children's app

It has a child mode (under-12) and is education/kids-oriented, which triggers
strict advertising rules. We **cannot** drop in a generic ad SDK.

- **Non-personalized / contextual ads ONLY.** No behavioral targeting, no
  ad-driven data collection on minors.
- **Child-appropriate ad content only** — no alcohol, gambling, dating,
  mature/violent campaigns. (This is the "below eighteen" requirement.)
- **Use a certified family-safe ad network** — e.g. Google AdMob with
  child-directed treatment (`tagForChildDirectedTreatment`) + certified for
  Google Play Families, or a kid-specific network (e.g. SuperAwesome / Kidtech).
- **Compliance:** COPPA (US, under-13), GDPR-K (EU, under-16), Google Play
  Families Policy, Apple Kids Category rules (Apple allows only Apple-reviewed
  ad networks and forbids third-party tracking in kids apps).
- **Gentle placement:** a single small banner, or an interstitial **between**
  completed sessions — never during a lesson/exercise, never where a child can
  mis-tap. Play Families has explicit placement rules; follow them.

## Technical implications

- **Network access:** the app is fully offline today. Add the Android INTERNET
  permission and connectivity **only inside the ad module, only on Android**;
  the core learning experience stays 100% offline.
- **Security/CSP:** the strict CSP planned in the security phase must be relaxed
  **on mobile only** to allow the ad network's exact domains. Desktop CSP stays
  strict. Document the allowed domains precisely.
- **Platform-gate everything:** `if (isAndroid) { … }` — desktop must never
  load or compile the ad code.

## Honest expectations

- Store fees: Play $25 once; Apple $99/yr (iOS only, and iOS needs a Mac).
- A minimal non-personalized banner in a small kids app earns very little until
  there's a real user base. It offsets fees slowly.
- Meaningful revenue implies **store distribution** (not just sideloaded APKs),
  which adds real code signing, store review, content rating, and privacy
  labels — a separate chunk of work from the current sideload plan.

## Status

NOTED. Not scheduled. Depends on: app running on Android → core stable →
decision to distribute via stores.
