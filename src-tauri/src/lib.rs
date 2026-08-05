use std::fs;

use tauri::{App, Manager};

/// The pre-built seed DB (curriculum + cards), embedded in the binary at compile
/// time. Embedding is what makes first-launch seeding work identically on desktop
/// AND Android: on Android a bundled *resource file* lives inside the APK and
/// can't be read via std::fs, so we ship the bytes in the binary instead. The
/// seed is small (~0.6 MB after the pool trim), so this is cheap.
static SEED_DB: &[u8] = include_bytes!("../resources/lexiq.db");

/// Seed + content-sync setup, writing the embedded seed into the app config dir.
///
/// * `lexiq.db` — the user's working database. Written on the *first* run only;
///   left untouched afterwards so progress is preserved.
/// * `lexiq.seed.db` — a pristine copy of the seed, refreshed on *every* run. The
///   frontend opens it read-only and diffs its `content_version` against the
///   working DB to upgrade content in place (src/db/content-sync.ts).
///
/// Both live in the app config dir, where the SQL plugin resolves `sqlite:<name>`
/// and can open them read-write.
fn seed_database(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let config_dir = app.path().app_config_dir()?;
    fs::create_dir_all(&config_dir)?;

    // First launch only: seed the user's working DB.
    let target = config_dir.join("lexiq.db");
    if !target.exists() {
        fs::write(&target, SEED_DB)?;
    }

    // Every launch: refresh the read-only seed sidecar the content-sync diffs
    // against, clearing any stale WAL/SHM so the fresh copy opens cleanly.
    let seed_side = config_dir.join("lexiq.seed.db");
    fs::write(&seed_side, SEED_DB)?;
    for suffix in ["-wal", "-shm"] {
        let stale = config_dir.join(format!("lexiq.seed.db{suffix}"));
        if stale.exists() {
            let _ = fs::remove_file(stale);
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // The SQL plugin owns all DB access from the JS side (@tauri-apps/plugin-sql).
    // The frontend opens `sqlite:lexiq.db`, which resolves to the app config dir
    // where `seed_database` (below) placed the pre-built seed on first launch.
    .plugin(tauri_plugin_sql::Builder::default().build())
    // Child-directed AdMob interstitials — Android only, no-op on desktop.
    .plugin(tauri_plugin_ads::init())
    .setup(|app| {
      // Seed the DB before the WebView calls Database.load().
      seed_database(app)?;

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
