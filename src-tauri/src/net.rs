//! Tailscale: finds this PC's tailnet name and address, and can publish the app
//! on the tailnet over HTTPS with `tailscale serve`, so a phone signed in to the
//! same Tailscale account can open it. Nothing is exposed to the public internet.

use serde::Serialize;
use serde_json::Value;
use std::process::Command;

#[derive(Serialize, Default, Clone, Debug)]
pub struct Tailscale {
    pub installed: bool,
    /// `Running`, `NeedsLogin`, `Stopped`, `Starting`...
    pub state: String,
    pub dns_name: String,
    pub ip: String,
    /// The phone link: `https://<name>.ts.net` when `tailscale serve` points at this app.
    pub https_url: String,
    /// Fallback link over plain HTTP on the tailnet address.
    pub http_url: String,
    pub message: String,
}

fn exe() -> String {
    #[cfg(windows)]
    {
        let p = r"C:\Program Files\Tailscale\tailscale.exe";
        if std::path::Path::new(p).exists() {
            return p.into();
        }
    }
    "tailscale".into()
}

fn run(args: &[&str]) -> Option<(bool, String)> {
    let mut cmd = Command::new(exe());
    cmd.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let out = cmd.output().ok()?;
    let text = format!("{}{}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr));
    Some((out.status.success(), text))
}

/// Reads `tailscale status --json` and `tailscale serve status --json`.
pub fn status(port: u16) -> Tailscale {
    let Some((_, text)) = run(&["status", "--json"]) else {
        return Tailscale { message: "Tailscale is not installed on this PC.".into(), ..Default::default() };
    };
    let v: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
    let state = v["BackendState"].as_str().unwrap_or("Unknown").to_string();
    let dns_name = v["Self"]["DNSName"].as_str().unwrap_or("").trim_end_matches('.').to_string();
    let ip = v["Self"]["TailscaleIPs"]
        .as_array()
        .and_then(|a| a.iter().filter_map(Value::as_str).find(|s| s.contains('.')))
        .unwrap_or("")
        .to_string();
    let mut t = Tailscale { installed: true, state: state.clone(), dns_name: dns_name.clone(), ip: ip.clone(), ..Default::default() };
    if state != "Running" {
        t.message = match state.as_str() {
            "NeedsLogin" => "Sign in to Tailscale on this PC first.".into(),
            "Stopped" => "Tailscale is turned off. Open it and connect.".into(),
            "NoState" => "Tailscale is not connected on this PC. Open Tailscale and sign in.".into(),
            _ => "Tailscale is starting. Try again in a moment.".into(),
        };
        return t;
    }
    if !ip.is_empty() {
        t.http_url = format!("http://{ip}:{port}");
    }
    if !dns_name.is_empty() && serving(&dns_name, port) {
        t.https_url = format!("https://{dns_name}");
    }
    t.message = if t.https_url.is_empty() {
        "Connected. Turn on the private HTTPS link so the phone app can be installed.".into()
    } else {
        "Connected. Your phone can reach this app privately over Tailscale.".into()
    };
    t
}

/// True when `tailscale serve` already proxies `https://<dns_name>/` to this app.
fn serving(dns_name: &str, port: u16) -> bool {
    let Some((true, text)) = run(&["serve", "status", "--json"]) else { return false };
    let v: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
    let proxy = &v["Web"][format!("{dns_name}:443")]["Handlers"]["/"]["Proxy"];
    proxy.as_str().map(|p| p.ends_with(&format!(":{port}"))).unwrap_or(false)
}

/// Runs `tailscale serve --bg <port>`. Tailscale may answer with a link to turn on
/// HTTPS for the tailnet first; that text is passed back so the person can follow it.
pub fn enable_https(port: u16) -> Result<String, String> {
    match run(&["serve", "--bg", "--yes", &port.to_string()]) {
        None => Err("Tailscale is not installed on this PC.".into()),
        Some((true, text)) => Ok(text.trim().to_string()),
        Some((false, text)) => Err(text.trim().to_string()),
    }
}

/// A QR code for `url` as a standalone SVG.
pub fn qr_svg(url: &str) -> String {
    use qrcode::render::svg;
    qrcode::QrCode::with_error_correction_level(url.as_bytes(), qrcode::EcLevel::M)
        .map(|c| c.render::<svg::Color>().min_dimensions(240, 240).quiet_zone(true).dark_color(svg::Color("#0b0d12")).light_color(svg::Color("#ffffff")).build())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    #[test]
    fn qr_renders() {
        let s = super::qr_svg("https://pc.tail1234.ts.net/#pair=abc");
        assert!(s.starts_with("<?xml") || s.starts_with("<svg"));
        assert!(s.contains("#0b0d12"));
    }
}
