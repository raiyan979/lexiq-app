use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "com.plugin.ads";

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<Ads<R>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "AdsPlugin")?;
    Ok(Ads(handle))
}

/// Handle to the native Android ads plugin.
pub struct Ads<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> Ads<R> {
    pub fn load_interstitial(&self) -> crate::Result<()> {
        self.0.run_mobile_plugin::<()>("loadInterstitial", ())?;
        Ok(())
    }

    pub fn show_interstitial(&self) -> crate::Result<()> {
        self.0.run_mobile_plugin::<()>("showInterstitial", ())?;
        Ok(())
    }

    pub fn show_banner(&self) -> crate::Result<crate::BannerSize> {
        Ok(self.0.run_mobile_plugin::<crate::BannerSize>("showBanner", ())?)
    }

    pub fn hide_banner(&self) -> crate::Result<()> {
        self.0.run_mobile_plugin::<()>("hideBanner", ())?;
        Ok(())
    }
}
