//! `ledgerquarry-server [data-dir]`: the same app without a window.

#[tokio::main]
async fn main() {
    let dir = std::env::args().nth(1).map(std::path::PathBuf::from).unwrap_or_else(|| {
        dirs::data_dir().unwrap_or_else(|| ".".into()).join("dev.repoquarry.ledgerquarry")
    });
    if let Err(e) = ledgerquarry_lib::serve_headless(dir).await {
        eprintln!("LedgerQuarry could not start: {e}");
        std::process::exit(1);
    }
}
