# Security

Lexiq is an **offline-first** desktop/mobile app (Tauri 2 + Svelte). It has no
user accounts, makes no network requests, and stores everything in a local
SQLite database on the device. This keeps the attack surface small; the notes
below describe the hardening that is in place and how to report an issue.

## Threat model

- **No remote content.** All course content (units, vocabulary, sentences,
  audio) is authored at build time and bundled into the app. The app does not
  fetch anything at runtime.
- **No accounts / no PII.** There is no login, no server, and no personal data
  collected or transmitted.
- **Local data only.** Progress lives in a per-device SQLite file. Losing the
  device is the main confidentiality risk; there is no remote copy.

The planned in-context AI helper and mobile ads (see `docs/mobile-ads.md`) will
introduce network access and third-party content. The protections below are
designed to hold up when that happens.

## Protections in place

- **Content Security Policy.** A strict CSP is set in
  `src-tauri/tauri.conf.json`:
  - `default-src 'self'` — only same-origin resources.
  - `script-src 'self'` — no inline/remote scripts (Tauri nonces its own).
  - `style-src 'self' 'unsafe-inline'` — inline styles are required by Svelte;
    scripts are **not** allowed inline.
  - `img-src 'self' data:`, `font-src 'self'`, `media-src 'self'` — images,
    bundled fonts, and audio clips are served same-origin only.
  - `connect-src 'self' ipc: http://ipc.localhost` — the only permitted
    "network" is Tauri's local IPC bridge.
  - `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`.
- **HTML sanitization.** Lesson markdown is rendered with `marked` and then
  passed through **DOMPurify** before insertion (`src/ui/Markdown.svelte`), so
  even trusted-today content cannot inject scripts, event handlers, or unsafe
  URLs. This is what makes it safe to later render AI-generated text.
- **Minimal capabilities.** Tauri capabilities (`src-tauri/capabilities/`) grant
  only `core:default` and the SQL plugin permissions the app needs. The asset
  protocol is disabled (audio is served as a normal frontend asset).
- **Bundled assets.** Fonts and audio ship inside the app; nothing is loaded
  from a CDN or remote host.

## Dependency auditing

Run before each release.

- **JavaScript:** `npm audit` — production dependencies report **0
  vulnerabilities**.
- **Rust:** `cargo audit` (in `src-tauri/`) — clean. A set of RustSec advisories
  is explicitly reviewed and accepted in `src-tauri/.cargo/audit.toml`:
  - `RUSTSEC-2023-0071` (`rsa` "Marvin Attack") comes only from sqlx's optional
    **MySQL** backend, which this SQLite-only app never compiles
    (`cargo tree -e normal -i rsa` prints nothing) — not in the shipped binary.
  - The remaining entries are gtk-rs/glib/unic crates marked
    unmaintained/unsound; they are part of the Linux-desktop webkit2gtk backend
    and are not compiled on the shipping targets (Windows WebView2 + Android
    WebView).

  Re-review that ignore list whenever dependencies are bumped.

## Reporting a vulnerability

Email **rayan.rambo1233@gmail.com** with details and reproduction steps. Please
do not open a public issue for security problems until a fix is available.
