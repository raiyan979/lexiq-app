const COMMANDS: &[&str] = &[
    "load_interstitial",
    "show_interstitial",
    "show_banner",
    "hide_banner",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();

    // cfg aliases so `#[cfg(mobile)]` / `#[cfg(desktop)]` resolve in this crate,
    // mirroring how the official Tauri plugins gate platform code.
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap();
    let mobile = target_os == "ios" || target_os == "android";
    alias("desktop", !mobile);
    alias("mobile", mobile);
}

fn alias(alias: &str, has_feature: bool) {
    println!("cargo:rustc-check-cfg=cfg({alias})");
    if has_feature {
        println!("cargo:rustc-cfg={alias}");
    }
}
