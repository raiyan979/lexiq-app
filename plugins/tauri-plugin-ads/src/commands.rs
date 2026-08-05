use tauri::{command, AppHandle, Runtime};

use crate::AdsExt;

#[command]
pub(crate) async fn load_interstitial<R: Runtime>(app: AppHandle<R>) -> crate::Result<()> {
    app.ads().load_interstitial()
}

#[command]
pub(crate) async fn show_interstitial<R: Runtime>(app: AppHandle<R>) -> crate::Result<()> {
    app.ads().show_interstitial()
}
