pub mod ai;
pub mod db;
pub mod demo;
pub mod net;
pub mod server;

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

fn port_from_env() -> u16 {
    std::env::var("LEDGER_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(server::DEFAULT_PORT)
}

/// Desktop app: starts the local server, then opens a window on it. The window
/// gets this launch's owner token in the URL fragment, which never reaches the network.
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let state = server::AppState::open(data_dir)?;
            let port = tauri::async_runtime::block_on(server::start(state.clone(), port_from_env()))?;
            let url = format!("http://127.0.0.1:{port}/#desktop={}", state.desktop_token);
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url.parse()?))
                .title("LedgerQuarry")
                .inner_size(1320.0, 860.0)
                .min_inner_size(380.0, 620.0)
                .theme(Some(tauri::Theme::Dark))
                .background_color(tauri::webview::Color(11, 13, 18, 255))
                .center()
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running LedgerQuarry");
}

/// Headless server (no window): for an always-on PC or home server.
pub async fn serve_headless(data_dir: std::path::PathBuf) -> Result<(), String> {
    let state = server::AppState::open(data_dir.clone())?;
    let port = server::start(state.clone(), port_from_env()).await.map_err(|e| e.to_string())?;
    println!("LedgerQuarry is running.");
    println!("  Data:    {}", data_dir.display());
    println!("  Owner:   http://127.0.0.1:{port}/#desktop={}", state.desktop_token);
    println!("Open the owner link in a browser on this machine to set up and pair phones. Ctrl+C to stop.");
    tokio::signal::ctrl_c().await.map_err(|e| e.to_string())
}
