//! The local web server. The desktop window and paired phones both use it: the
//! desktop window with a token made fresh at every launch, phones with a token
//! issued when they scan the pairing QR code. It listens on 127.0.0.1 and, when
//! Tailscale is up, on this PC's tailnet address; `tailscale serve` can put it
//! behind a private HTTPS link. It never listens on the LAN or the internet.

use crate::ai::{self, AiConfig, PullProgress};
use crate::db::{self, Db, Filter, ReceiptPatch, CATEGORIES};
use crate::net;
use axum::extract::{DefaultBodyLimit, FromRequestParts, Multipart, Path as UrlPath, Query, State};
use axum::http::{header, request::Parts, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use rand::Rng;
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

pub const DEFAULT_PORT: u16 = 8787;
const PAIR_TTL: Duration = Duration::from_secs(10 * 60);

#[derive(rust_embed::RustEmbed)]
#[folder = "../ui"]
struct Ui;

pub struct AppState {
    pub db: Db,
    pub data_dir: PathBuf,
    pub desktop_token: String,
    pub port: AtomicU16,
    pair_codes: Mutex<HashMap<String, Instant>>,
    pull: Mutex<PullProgress>,
    ai_lock: tokio::sync::Semaphore,
}

pub type Shared = Arc<AppState>;

pub fn random_token(len: usize) -> String {
    const CHARS: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let mut rng = rand::rng();
    (0..len).map(|_| CHARS[rng.random_range(0..CHARS.len())] as char).collect()
}

fn hash(token: &str) -> String {
    let d = Sha256::digest(token.as_bytes());
    d.iter().map(|b| format!("{b:02x}")).collect()
}

impl AppState {
    pub fn open(data_dir: PathBuf) -> Result<Shared, String> {
        std::fs::create_dir_all(data_dir.join("receipts")).map_err(|e| e.to_string())?;
        let db = Db::open(&data_dir.join("ledger.db")).map_err(|e| e.to_string())?;
        Ok(Self::with_db(db, data_dir))
    }

    pub fn with_db(db: Db, data_dir: PathBuf) -> Shared {
        Arc::new(AppState {
            db,
            data_dir,
            desktop_token: random_token(40),
            port: AtomicU16::new(DEFAULT_PORT),
            pair_codes: Mutex::new(HashMap::new()),
            pull: Mutex::new(PullProgress::default()),
            ai_lock: tokio::sync::Semaphore::new(1),
        })
    }

    pub fn ai_config(&self) -> AiConfig {
        self.db
            .setting("ai")
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    pub fn currency(&self) -> String {
        self.db.setting("currency").filter(|c| c.len() == 3).unwrap_or_else(|| "GBP".into())
    }

    fn image_path(&self, name: &str) -> PathBuf {
        self.data_dir.join("receipts").join(name)
    }
}

// ---------- errors and auth ----------

pub struct ApiError(StatusCode, String);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(json!({ "error": self.1 }))).into_response()
    }
}

fn bad(msg: impl Into<String>) -> ApiError {
    ApiError(StatusCode::BAD_REQUEST, msg.into())
}

fn not_found() -> ApiError {
    ApiError(StatusCode::NOT_FOUND, "Not found.".into())
}

impl From<rusqlite::Error> for ApiError {
    fn from(e: rusqlite::Error) -> Self {
        ApiError(StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {e}"))
    }
}

type ApiResult<T> = Result<T, ApiError>;

#[derive(Clone, Debug)]
pub struct Auth {
    pub owner: bool,
    pub device_id: Option<String>,
    pub name: String,
}

impl FromRequestParts<Shared> for Auth {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &Shared) -> Result<Self, Self::Rejection> {
        let token = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .unwrap_or("")
            .trim();
        if token.is_empty() {
            return Err(ApiError(StatusCode::UNAUTHORIZED, "This device is not paired.".into()));
        }
        if token == state.desktop_token {
            return Ok(Auth { owner: true, device_id: None, name: "This PC".into() });
        }
        match state.db.device_by_hash(&hash(token)) {
            Some(d) => Ok(Auth { owner: false, device_id: Some(d.id), name: d.name }),
            None => Err(ApiError(StatusCode::UNAUTHORIZED, "This device is not paired, or was removed.".into())),
        }
    }
}

/// Only the desktop window: pairing, devices, settings and Tailscale.
pub struct Owner;

impl FromRequestParts<Shared> for Owner {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &Shared) -> Result<Self, Self::Rejection> {
        let a = Auth::from_request_parts(parts, state).await?;
        if a.owner {
            Ok(Owner)
        } else {
            Err(ApiError(StatusCode::FORBIDDEN, "Only the desktop app can do this.".into()))
        }
    }
}

// ---------- router ----------

pub fn router(state: Shared) -> Router {
    Router::new()
        .route("/api/me", get(me))
        .route("/api/pair", post(pair))
        .route("/api/pairing", post(new_pairing))
        .route("/api/summary", get(summary))
        .route("/api/receipts", get(list).post(upload).delete(clear_samples))
        .route("/api/receipts/manual", post(manual))
        .route("/api/receipts/{id}", get(one).patch(edit).delete(remove))
        .route("/api/receipts/{id}/image", get(image))
        .route("/api/receipts/{id}/reread", post(reread))
        .route("/api/settings", get(settings).put(save_settings))
        .route("/api/budgets", get(budgets).put(save_budget))
        .route("/api/ai/status", get(ai_status))
        .route("/api/ai/pull", get(pull_status).post(start_pull))
        .route("/api/devices", get(devices))
        .route("/api/devices/self", axum::routing::delete(unpair_self))
        .route("/api/devices/{id}", axum::routing::delete(remove_device))
        .route("/api/tailscale", get(tailscale))
        .route("/api/tailscale/https", post(tailscale_https))
        .route("/api/open", post(open_url))
        .route("/api/demo", post(demo))
        .route("/api/export.csv", get(export_csv))
        .fallback(static_file)
        .layer(DefaultBodyLimit::max(20 * 1024 * 1024))
        .with_state(state)
}

/// Binds 127.0.0.1 (and the Tailscale address when there is one) and serves in the background.
/// Returns the port. Falls back to a free port if the default is taken.
pub async fn start(state: Shared, preferred: u16) -> std::io::Result<u16> {
    let local = match tokio::net::TcpListener::bind(("127.0.0.1", preferred)).await {
        Ok(l) => l,
        Err(_) => tokio::net::TcpListener::bind(("127.0.0.1", 0)).await?,
    };
    let port = local.local_addr()?.port();
    state.port.store(port, Ordering::Relaxed);
    let app = router(state.clone());
    tokio::spawn({
        let app = app.clone();
        async move {
            let _ = axum::serve(local, app).await;
        }
    });
    // Plain-HTTP fallback on the tailnet address (only reachable from the person's own tailnet).
    let ts = tokio::task::spawn_blocking(move || net::status(port)).await.unwrap_or_default();
    if !ts.ip.is_empty() {
        if let Ok(l) = tokio::net::TcpListener::bind((ts.ip.as_str(), port)).await {
            tokio::spawn(async move {
                let _ = axum::serve(l, app).await;
            });
        }
    }
    Ok(port)
}

// ---------- static files ----------

async fn static_file(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');
    if path.starts_with("api/") {
        return not_found().into_response();
    }
    let (file, path) = match Ui::get(path) {
        Some(f) if !path.is_empty() => (f, path.to_string()),
        _ => match Ui::get("index.html") {
            Some(f) => (f, "index.html".to_string()),
            None => return not_found().into_response(),
        },
    };
    let mime = mime_guess::from_path(&path).first_or_octet_stream();
    let cache = if path == "index.html" || path == "sw.js" { "no-cache" } else { "public, max-age=3600" };
    (
        [
            (header::CONTENT_TYPE, mime.as_ref().to_string()),
            (header::CACHE_CONTROL, cache.to_string()),
            (header::HeaderName::from_static("x-content-type-options"), "nosniff".to_string()),
        ],
        file.data.into_owned(),
    )
        .into_response()
}

// ---------- identity and pairing ----------

async fn me(auth: Auth) -> Json<Value> {
    Json(json!({ "owner": auth.owner, "name": auth.name, "device_id": auth.device_id }))
}

fn phone_base(state: &AppState) -> Result<(String, &'static str), String> {
    if let Ok(u) = std::env::var("LEDGER_PUBLIC_URL") {
        return Ok((u.trim_end_matches('/').to_string(), "custom"));
    }
    let ts = net::status(state.port.load(Ordering::Relaxed));
    if !ts.https_url.is_empty() {
        Ok((ts.https_url, "tailscale-https"))
    } else if !ts.http_url.is_empty() {
        Ok((ts.http_url, "tailscale-http"))
    } else {
        Err(ts.message)
    }
}

async fn new_pairing(_: Owner, State(s): State<Shared>) -> ApiResult<Json<Value>> {
    let st = s.clone();
    let base = tokio::task::spawn_blocking(move || phone_base(&st)).await.map_err(|e| bad(e.to_string()))?;
    let (base, via) = base.map_err(|m| ApiError(StatusCode::CONFLICT, m))?;
    let code = random_token(24);
    {
        let mut codes = s.pair_codes.lock().unwrap();
        codes.retain(|_, t| t.elapsed() < PAIR_TTL);
        codes.insert(code.clone(), Instant::now());
    }
    let url = format!("{base}/#pair={code}");
    Ok(Json(json!({ "url": url, "qr": net::qr_svg(&url), "via": via, "expires_in": PAIR_TTL.as_secs() })))
}

#[derive(Deserialize)]
struct PairBody {
    code: String,
    name: Option<String>,
}

async fn pair(State(s): State<Shared>, Json(b): Json<PairBody>) -> ApiResult<Json<Value>> {
    let valid = {
        let mut codes = s.pair_codes.lock().unwrap();
        matches!(codes.remove(&b.code), Some(t) if t.elapsed() < PAIR_TTL)
    };
    if !valid {
        return Err(ApiError(StatusCode::UNAUTHORIZED, "This QR code has expired or was already used. Make a new one on your PC.".into()));
    }
    let token = random_token(48);
    let id = uuid::Uuid::new_v4().to_string();
    let name: String = b.name.unwrap_or_default().chars().take(60).collect();
    let name = if name.trim().is_empty() { "Phone".to_string() } else { name.trim().to_string() };
    s.db.add_device(&id, &name, &hash(&token))?;
    Ok(Json(json!({ "token": token, "device_id": id, "name": name })))
}

async fn devices(_: Owner, State(s): State<Shared>) -> ApiResult<Json<Value>> {
    Ok(Json(json!(s.db.devices()?)))
}

async fn remove_device(_: Owner, State(s): State<Shared>, UrlPath(id): UrlPath<String>) -> ApiResult<StatusCode> {
    if s.db.remove_device(&id)? { Ok(StatusCode::NO_CONTENT) } else { Err(not_found()) }
}

async fn unpair_self(auth: Auth, State(s): State<Shared>) -> ApiResult<StatusCode> {
    match auth.device_id {
        Some(id) => {
            s.db.remove_device(&id)?;
            Ok(StatusCode::NO_CONTENT)
        }
        None => Err(bad("The desktop app is not a paired device.")),
    }
}

// ---------- receipts ----------

#[derive(Deserialize, Default)]
struct ListQuery {
    month: Option<String>,
    category: Option<String>,
    q: Option<String>,
    status: Option<String>,
    limit: Option<i64>,
}

async fn list(_: Auth, State(s): State<Shared>, Query(q): Query<ListQuery>) -> ApiResult<Json<Value>> {
    let f = Filter {
        month: q.month.filter(|m| m.len() == 7),
        category: q.category.filter(|c| !c.is_empty()),
        query: q.q,
        status: q.status.filter(|c| !c.is_empty()),
        limit: q.limit,
    };
    Ok(Json(json!(s.db.receipts(&f)?)))
}

async fn one(_: Auth, State(s): State<Shared>, UrlPath(id): UrlPath<String>) -> ApiResult<Json<Value>> {
    s.db.receipt(&id).map(|r| Json(json!(r))).ok_or_else(not_found)
}

fn image_ext(content_type: &str, filename: &str) -> Option<&'static str> {
    let f = filename.to_lowercase();
    match content_type {
        "image/jpeg" | "image/jpg" => Some("jpg"),
        "image/png" => Some("png"),
        "image/webp" => Some("webp"),
        _ if f.ends_with(".jpg") || f.ends_with(".jpeg") => Some("jpg"),
        _ if f.ends_with(".png") => Some("png"),
        _ if f.ends_with(".webp") => Some("webp"),
        _ => None,
    }
}

async fn upload(auth: Auth, State(s): State<Shared>, mut mp: Multipart) -> ApiResult<Json<Value>> {
    while let Some(field) = mp.next_field().await.map_err(|e| bad(e.to_string()))? {
        if field.name() != Some("image") {
            continue;
        }
        let ct = field.content_type().unwrap_or("").to_string();
        let filename = field.file_name().unwrap_or("").to_string();
        let ext = image_ext(&ct, &filename).ok_or_else(|| bad("Send a JPEG, PNG or WebP photo of the receipt."))?;
        let data = field.bytes().await.map_err(|e| bad(e.to_string()))?;
        if data.len() < 100 {
            return Err(bad("That photo is empty."));
        }
        let id = uuid::Uuid::new_v4().to_string();
        let name = format!("{id}.{ext}");
        tokio::fs::write(s.image_path(&name), &data).await.map_err(|e| bad(e.to_string()))?;
        let source = if auth.owner { "desktop" } else { "phone" };
        s.db.insert_receipt(&id, Some(&name), source, "reading", &s.currency())?;
        spawn_reading(s.clone(), id.clone());
        return Ok(Json(json!(s.db.receipt(&id))));
    }
    Err(bad("No photo was attached."))
}

async fn manual(auth: Auth, State(s): State<Shared>, Json(p): Json<ReceiptPatch>) -> ApiResult<Json<Value>> {
    let id = uuid::Uuid::new_v4().to_string();
    s.db.insert_receipt(&id, None, if auth.owner { "desktop" } else { "phone" }, "ready", &s.currency())?;
    s.db.update_receipt(&id, &ReceiptPatch { status: Some("ready".into()), ..p })?;
    Ok(Json(json!(s.db.receipt(&id))))
}

async fn edit(_: Auth, State(s): State<Shared>, UrlPath(id): UrlPath<String>, Json(mut p): Json<ReceiptPatch>) -> ApiResult<Json<Value>> {
    if let Some(d) = &p.date {
        if chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").is_err() {
            return Err(bad("Use a date like 2026-10-21."));
        }
    }
    // Saving by hand marks the receipt as checked.
    if p.status.is_none() {
        p.status = Some("ready".into());
        p.error = Some(String::new());
    }
    if !s.db.update_receipt(&id, &p)? {
        return Err(not_found());
    }
    Ok(Json(json!(s.db.receipt(&id))))
}

async fn remove(_: Auth, State(s): State<Shared>, UrlPath(id): UrlPath<String>) -> ApiResult<StatusCode> {
    match s.db.delete_receipt(&id)? {
        None => Err(not_found()),
        Some(image) => {
            if let Some(name) = image {
                let _ = tokio::fs::remove_file(s.image_path(&name)).await;
            }
            Ok(StatusCode::NO_CONTENT)
        }
    }
}

async fn image(_: Auth, State(s): State<Shared>, UrlPath(id): UrlPath<String>) -> ApiResult<Response> {
    let name = s.db.image_name(&id).ok_or_else(not_found)?;
    let data = tokio::fs::read(s.image_path(&name)).await.map_err(|_| not_found())?;
    let mime = mime_guess::from_path(&name).first_or_octet_stream();
    Ok(([(header::CONTENT_TYPE, mime.as_ref().to_string()), (header::CACHE_CONTROL, "private, max-age=86400".to_string())], data).into_response())
}

async fn reread(_: Auth, State(s): State<Shared>, UrlPath(id): UrlPath<String>) -> ApiResult<Json<Value>> {
    if s.db.image_name(&id).is_none() {
        return Err(bad("This receipt has no photo to read."));
    }
    s.db.update_receipt(&id, &ReceiptPatch { status: Some("reading".into()), error: Some(String::new()), ..Default::default() })?;
    spawn_reading(s.clone(), id.clone());
    Ok(Json(json!(s.db.receipt(&id))))
}

/// Reads one receipt photo with the AI model in the background, one at a time.
pub fn spawn_reading(s: Shared, id: String) {
    tokio::spawn(async move {
        let _permit = s.ai_lock.acquire().await;
        let Some(name) = s.db.image_name(&id) else { return };
        let patch = match tokio::fs::read(s.image_path(&name)).await {
            Err(e) => ReceiptPatch { status: Some("review".into()), error: Some(format!("The photo could not be opened: {e}")), ..Default::default() },
            Ok(bytes) => {
                let mime = mime_guess::from_path(&name).first_or_octet_stream().to_string();
                match ai::read_receipt(&s.ai_config(), &bytes, &mime).await {
                    Ok(text) => ai::parse_answer(&text, &s.currency()),
                    Err(e) => ReceiptPatch { status: Some("review".into()), error: Some(e), ..Default::default() },
                }
            }
        };
        let _ = s.db.update_receipt(&id, &patch);
    });
}

// ---------- dashboard ----------

#[derive(Deserialize)]
struct MonthQuery {
    month: Option<String>,
}

fn month_start(m: &str) -> Option<chrono::NaiveDate> {
    chrono::NaiveDate::parse_from_str(&format!("{m}-01"), "%Y-%m-%d").ok()
}

fn shift_month(d: chrono::NaiveDate, back: u32) -> String {
    use chrono::Datelike;
    let total = d.year() * 12 + d.month0() as i32 - back as i32;
    format!("{:04}-{:02}", total.div_euclid(12), total.rem_euclid(12) + 1)
}

async fn summary(_: Auth, State(s): State<Shared>, Query(q): Query<MonthQuery>) -> ApiResult<Json<Value>> {
    let month = q.month.filter(|m| month_start(m).is_some()).unwrap_or_else(|| db::today()[..7].to_string());
    let start = month_start(&month).unwrap();
    let months: Vec<String> = (0..6).rev().map(|b| shift_month(start, b)).collect();
    let trend = s.db.monthly_totals(&months)?;
    let (spent, tax, count) = s.db.month_stats(&month)?;
    let (last_spent, _, last_count) = s.db.month_stats(&shift_month(start, 1))?;
    let cats = s.db.category_totals(&month)?;
    let budgets: HashMap<String, i64> = s.db.budgets()?.into_iter().collect();
    let categories: Vec<Value> = CATEGORIES
        .iter()
        .map(|(id, label)| {
            let (total, n) = cats.iter().find(|c| c.0 == *id).map(|c| (c.1, c.2)).unwrap_or((0, 0));
            json!({ "id": id, "label": label, "total": total, "count": n, "budget": budgets.get(*id).copied().unwrap_or(0) })
        })
        .collect();
    let merchants: Vec<Value> = s.db.top_merchants(&month, 5)?.into_iter().map(|(n, t, c)| json!({ "name": n, "total": t, "count": c })).collect();
    let recent = s.db.receipts(&Filter { limit: Some(6), ..Default::default() })?;
    Ok(Json(json!({
        "month": month,
        "currency": s.currency(),
        "spent": spent, "tax": tax, "count": count,
        "last_month": { "spent": last_spent, "count": last_count },
        "trend": trend.into_iter().map(|(m, t)| json!({ "month": m, "total": t })).collect::<Vec<_>>(),
        "categories": categories,
        "merchants": merchants,
        "recent": recent,
        "review": s.db.status_count("review"),
        "reading": s.db.status_count("reading"),
    })))
}

// ---------- settings and budgets ----------

async fn settings(_: Auth, State(s): State<Shared>) -> ApiResult<Json<Value>> {
    Ok(Json(json!({
        "currency": s.db.setting("currency").unwrap_or_default(),
        "ai": s.ai_config(),
        "categories": CATEGORIES.iter().map(|(id, label)| json!({ "id": id, "label": label })).collect::<Vec<_>>(),
        "data_dir": s.data_dir.to_string_lossy(),
        "version": env!("CARGO_PKG_VERSION"),
    })))
}

#[derive(Deserialize)]
struct SettingsBody {
    currency: Option<String>,
    ai: Option<AiConfig>,
}

async fn save_settings(_: Owner, State(s): State<Shared>, Json(b): Json<SettingsBody>) -> ApiResult<Json<Value>> {
    if let Some(c) = b.currency {
        let c = c.trim().to_uppercase();
        if c.len() != 3 || !c.chars().all(|x| x.is_ascii_alphabetic()) {
            return Err(bad("Use a three-letter currency code such as GBP, EUR, USD or ZAR."));
        }
        s.db.set_setting("currency", &c)?;
    }
    if let Some(mut ai) = b.ai {
        if !ai.url.starts_with("http://") && !ai.url.starts_with("https://") {
            return Err(bad("The AI server address must start with http:// or https://"));
        }
        if ai.provider != "openai" {
            ai.provider = "ollama".into();
        }
        s.db.set_setting("ai", &serde_json::to_string(&ai).unwrap())?;
    }
    settings(Auth { owner: true, device_id: None, name: String::new() }, State(s)).await
}

async fn budgets(_: Auth, State(s): State<Shared>) -> ApiResult<Json<Value>> {
    let b: HashMap<String, i64> = s.db.budgets()?.into_iter().collect();
    Ok(Json(json!(b)))
}

#[derive(Deserialize)]
struct BudgetBody {
    category: String,
    amount: i64,
}

async fn save_budget(_: Auth, State(s): State<Shared>, Json(b): Json<BudgetBody>) -> ApiResult<StatusCode> {
    if !CATEGORIES.iter().any(|(id, _)| *id == b.category) {
        return Err(bad("Unknown category."));
    }
    s.db.set_budget(&b.category, b.amount)?;
    Ok(StatusCode::NO_CONTENT)
}

// ---------- AI model ----------

async fn ai_status(_: Auth, State(s): State<Shared>) -> Json<Value> {
    Json(json!(ai::status(&s.ai_config()).await))
}

async fn pull_status(_: Auth, State(s): State<Shared>) -> Json<Value> {
    Json(json!(*s.pull.lock().unwrap()))
}

async fn start_pull(_: Owner, State(s): State<Shared>) -> ApiResult<StatusCode> {
    let cfg = s.ai_config();
    if cfg.provider != "ollama" {
        return Err(bad("Download the model inside your AI app (Jan or LM Studio), then pick it here."));
    }
    {
        let mut p = s.pull.lock().unwrap();
        if p.active {
            return Ok(StatusCode::ACCEPTED);
        }
        *p = PullProgress { active: true, status: "starting".into(), ..Default::default() };
    }
    tokio::spawn(async move {
        ai::pull(&cfg, |p| *s.pull.lock().unwrap() = p).await;
    });
    Ok(StatusCode::ACCEPTED)
}

// ---------- Tailscale and links ----------

async fn tailscale(_: Owner, State(s): State<Shared>) -> Json<Value> {
    let port = s.port.load(Ordering::Relaxed);
    Json(json!(tokio::task::spawn_blocking(move || net::status(port)).await.unwrap_or_default()))
}

async fn tailscale_https(_: Owner, State(s): State<Shared>) -> ApiResult<Json<Value>> {
    let port = s.port.load(Ordering::Relaxed);
    let res = tokio::task::spawn_blocking(move || net::enable_https(port)).await.map_err(|e| bad(e.to_string()))?;
    match res {
        Ok(out) => Ok(Json(json!({ "ok": true, "output": out }))),
        Err(out) => Err(ApiError(StatusCode::CONFLICT, out)),
    }
}

#[derive(Deserialize)]
struct OpenBody {
    url: String,
}

/// Opens a help or download page in the PC's normal browser.
async fn open_url(_: Owner, Json(b): Json<OpenBody>) -> ApiResult<StatusCode> {
    const ALLOWED: [&str; 5] = ["https://ollama.com/", "https://tailscale.com/", "https://login.tailscale.com/", "https://github.com/", "https://repoquarry.dev/"];
    if !ALLOWED.iter().any(|a| b.url.starts_with(a)) {
        return Err(bad("That link is not allowed."));
    }
    #[cfg(windows)]
    std::process::Command::new("rundll32").args(["url.dll,FileProtocolHandler", &b.url]).spawn().map_err(|e| bad(e.to_string()))?;
    #[cfg(target_os = "macos")]
    std::process::Command::new("open").arg(&b.url).spawn().map_err(|e| bad(e.to_string()))?;
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open").arg(&b.url).spawn().map_err(|e| bad(e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

// ---------- sample data and export ----------

async fn demo(_: Owner, State(s): State<Shared>) -> ApiResult<Json<Value>> {
    let n = crate::demo::seed(&s.db, &s.currency())?;
    Ok(Json(json!({ "added": n })))
}

async fn clear_samples(_: Owner, State(s): State<Shared>) -> ApiResult<Json<Value>> {
    Ok(Json(json!({ "removed": s.db.delete_source("sample")? })))
}

fn csv_field(s: &str) -> String {
    // Leading = + - @ would run as a formula in spreadsheet apps.
    let s = if s.starts_with(['=', '+', '-', '@']) { format!("'{s}") } else { s.to_string() };
    if s.contains([',', '"', '\n']) { format!("\"{}\"", s.replace('"', "\"\"")) } else { s }
}

async fn export_csv(_: Auth, State(s): State<Shared>, Query(q): Query<MonthQuery>) -> ApiResult<Response> {
    let rows = s.db.receipts(&Filter { month: q.month, limit: Some(5000), ..Default::default() })?;
    let mut out = String::from("date,merchant,category,total,tax,currency,payment,status,notes\n");
    for r in rows {
        out += &format!(
            "{},{},{},{:.2},{:.2},{},{},{},{}\n",
            r.date,
            csv_field(&r.merchant),
            r.category,
            r.total as f64 / 100.0,
            r.tax as f64 / 100.0,
            r.currency,
            csv_field(&r.payment),
            r.status,
            csv_field(&r.notes)
        );
    }
    Ok((
        [
            (header::CONTENT_TYPE, "text/csv; charset=utf-8".to_string()),
            (header::CONTENT_DISPOSITION, "attachment; filename=\"ledgerquarry-receipts.csv\"".to_string()),
        ],
        out,
    )
        .into_response())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn month_shifting() {
        let d = month_start("2026-02").unwrap();
        assert_eq!(shift_month(d, 0), "2026-02");
        assert_eq!(shift_month(d, 2), "2025-12");
        assert_eq!(shift_month(d, 14), "2024-12");
    }

    #[test]
    fn csv_is_safe() {
        assert_eq!(csv_field("=SUM(A1)"), "'=SUM(A1)");
        assert_eq!(csv_field("Fish, chips"), "\"Fish, chips\"");
    }
}
