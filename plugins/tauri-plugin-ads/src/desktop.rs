use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<Ads<R>> {
    Ok(Ads(app.clone()))
}

/// Desktop implementation: intentionally a no-op. Ads are Android-only.
pub struct Ads<R: Runtime>(#[allow(dead_code)] AppHandle<R>);

impl<R: Runtime> Ads<R> {
    pub fn load_interstitial(&self) -> crate::Result<()> {
        Ok(())
    }

    pub fn show_interstitial(&self) -> crate::Result<()> {
        Ok(())
    }
}
