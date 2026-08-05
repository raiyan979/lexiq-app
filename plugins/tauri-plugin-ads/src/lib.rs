//! Tauri plugin exposing child-directed, non-personalized AdMob interstitial
//! ads. Android-only: on desktop every command is a no-op so the offline core
//! is completely unaffected. The frontend gates all calls behind an
//! `ADS_ENABLED` flag + platform + connectivity checks (see `src/ads/ads.ts`).

use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

/// The banner's height in CSS pixels (dp), returned to the web layer so it can
/// reserve exactly that much space above the native banner.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BannerSize {
    pub height: f64,
}

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::Ads;
#[cfg(mobile)]
use mobile::Ads;

/// Extension trait to reach the ads API from any `Manager` (app handle, window…).
pub trait AdsExt<R: Runtime> {
    fn ads(&self) -> &Ads<R>;
}

impl<R: Runtime, T: Manager<R>> AdsExt<R> for T {
    fn ads(&self) -> &Ads<R> {
        self.state::<Ads<R>>().inner()
    }
}

/// Register the plugin. Add `.plugin(tauri_plugin_ads::init())` in the app.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("ads")
        .invoke_handler(tauri::generate_handler![
            commands::load_interstitial,
            commands::show_interstitial,
            commands::show_banner,
            commands::hide_banner
        ])
        .setup(|app, api| {
            #[cfg(mobile)]
            let ads = mobile::init(app, api)?;
            #[cfg(desktop)]
            let ads = desktop::init(app, api)?;
            app.manage(ads);
            Ok(())
        })
        .build()
}
