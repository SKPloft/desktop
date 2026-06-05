fn main() {
    let channel = std::env::var("APP_CHANNEL").unwrap_or("stable".to_string());
    println!("cargo:rustc-env=APP_CHANNEL={}", channel); // I18N: no-translate - Rust console output
    // Ensure TS-RS bindings are exported to the correct directory
    println!("cargo:rustc-env=TS_RS_EXPORT_DIR=../src/rs-bindings"); // I18N: no-translate - Rust console output

    println!("cargo:rerun-if-changed=migrations"); // I18N: no-translate - Rust console output
    tauri_build::build()
}
