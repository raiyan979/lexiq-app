use tauri::{command, AppHandle, Runtime};

use crate::{AdsExt, BannerSize};

#[command]
pub(crate) async fn load_interstitial<R: Runtime>(app: AppHandle<R>) -> crate::Result<()> {
    app.ads().load_interstitial()
}

#[command]
pub(crate) async fn show_interstitial<R: Runtime>(app: AppHandle<R>) -> crate::Result<()> {
    app.ads().show_interstitial()
}

#[command]
pub(crate) async fn show_banner<R: Runtime>(app: AppHandle<R>) -> crate::Result<BannerSize> {
    app.ads().show_banner()
}

#[command]
pub(crate) async fn hide_banner<R: Runtime>(app: AppHandle<R>) -> crate::Result<()> {
    app.ads().hide_banner()
}
