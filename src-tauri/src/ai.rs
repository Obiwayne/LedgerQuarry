//! Reads a receipt photo with a local vision model. Two kinds of server work:
//! Ollama's own API (the default, from the RepoQuarry catalogue) and any
//! OpenAI-compatible server (Jan, LM Studio, llama.cpp server).

use crate::db::{valid_category, Item, ReceiptPatch};
use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

pub const DEFAULT_URL: &str = "http://127.0.0.1:11434";
pub const DEFAULT_MODEL: &str = "qwen2.5vl:7b";

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct AiConfig {
    /// `ollama` or `openai` (any OpenAI-compatible server).
    pub provider: String,
    pub url: String,
    pub model: String,
}

impl Default for AiConfig {
    fn default() -> Self {
        AiConfig { provider: "ollama".into(), url: DEFAULT_URL.into(), model: DEFAULT_MODEL.into() }
    }
}

const PROMPT: &str = "You are reading a photo of a shop receipt or invoice. Reply with JSON only, using these keys:
merchant (shop or company name), date (YYYY-MM-DD, the purchase date printed on the receipt), total (final amount paid, a number),
tax (VAT/GST/sales tax amount, a number, 0 if none), currency (ISO code such as GBP, EUR, USD, ZAR, or empty if not shown),
category (one of: groceries, eating-out, transport, shopping, bills, health, entertainment, other),
payment (card, cash, or empty), items (array of {name, amount} for each line item, amounts as numbers).
If a value is unreadable use an empty string or 0. Do not guess a date that is not printed.";

fn schema() -> Value {
    json!({
        "type": "object",
        "properties": {
            "merchant": {"type": "string"},
            "date": {"type": "string"},
            "total": {"type": "number"},
            "tax": {"type": "number"},
            "currency": {"type": "string"},
            "category": {"type": "string"},
            "payment": {"type": "string"},
            "items": {"type": "array", "items": {"type": "object", "properties": {"name": {"type": "string"}, "amount": {"type": "number"}}}}
        },
        "required": ["merchant", "date", "total", "tax", "currency", "category", "items"]
    })
}

fn client(timeout: u64) -> reqwest::Client {
    reqwest::Client::builder().timeout(Duration::from_secs(timeout)).build().expect("http client")
}

fn base(url: &str) -> String {
    url.trim().trim_end_matches('/').trim_end_matches("/v1").to_string()
}

/// Sends the image to the model and returns the raw JSON text it answered with.
pub async fn read_receipt(cfg: &AiConfig, image: &[u8], mime: &str) -> Result<String, String> {
    let b64 = base64::engine::general_purpose::STANDARD.encode(image);
    let http = client(300);
    let url = base(&cfg.url);
    let res = if cfg.provider == "openai" {
        http.post(format!("{url}/v1/chat/completions"))
            .json(&json!({
                "model": cfg.model,
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": [{"role": "user", "content": [
                    {"type": "text", "text": PROMPT},
                    {"type": "image_url", "image_url": {"url": format!("data:{mime};base64,{b64}")}}
                ]}]
            }))
            .send()
            .await
    } else {
        http.post(format!("{url}/api/chat"))
            .json(&json!({
                "model": cfg.model,
                "stream": false,
                "format": schema(),
                "options": {"temperature": 0},
                "messages": [{"role": "user", "content": PROMPT, "images": [b64]}]
            }))
            .send()
            .await
    };
    let res = res.map_err(|e| format!("Could not reach the AI model at {url}: {e}"))?;
    let status = res.status();
    let body: Value = res.json().await.map_err(|e| format!("The AI server sent something unexpected: {e}"))?;
    if !status.is_success() {
        let msg = body["error"]["message"].as_str().or(body["error"].as_str()).unwrap_or("unknown error");
        return Err(format!("The AI model returned an error: {msg}"));
    }
    let text = if cfg.provider == "openai" {
        body["choices"][0]["message"]["content"].as_str()
    } else {
        body["message"]["content"].as_str()
    };
    text.map(str::to_string).ok_or_else(|| "The AI model gave an empty answer.".into())
}

fn number(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => {
            let cleaned: String = s.chars().filter(|c| c.is_ascii_digit() || *c == '.' || *c == ',' || *c == '-').collect();
            // "1.234,56" -> 1234.56 ; "1,234.56" -> 1234.56 ; "12,50" -> 12.50
            let normal = match (cleaned.rfind(','), cleaned.rfind('.')) {
                (Some(c), Some(d)) if c > d => cleaned.replace('.', "").replace(',', "."),
                (Some(_), Some(_)) => cleaned.replace(',', ""),
                (Some(c), None) if cleaned.len() - c == 3 => cleaned.replace(',', "."),
                _ => cleaned.replace(',', ""),
            };
            normal.parse().ok()
        }
        _ => None,
    }
}

fn cents(v: &Value) -> i64 {
    number(v).map(|n| (n * 100.0).round() as i64).unwrap_or(0)
}

fn valid_date(s: &str) -> Option<String> {
    let s = s.trim();
    chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok().map(|d| d.format("%Y-%m-%d").to_string())
}

/// Turns the model's answer into a patch. Missing merchant, total or date marks the
/// receipt for review rather than inventing a value.
pub fn parse_answer(text: &str, default_currency: &str) -> ReceiptPatch {
    let trimmed = text.trim().trim_start_matches("```json").trim_start_matches("```").trim_end_matches("```").trim();
    let start = trimmed.find('{').unwrap_or(0);
    let end = trimmed.rfind('}').map(|e| e + 1).unwrap_or(trimmed.len());
    let v: Value = match serde_json::from_str(&trimmed[start..end]) {
        Ok(v) => v,
        Err(_) => {
            return ReceiptPatch {
                status: Some("review".into()),
                error: Some("The AI model's answer could not be read. Fill in the details by hand.".into()),
                ..Default::default()
            }
        }
    };
    let merchant = v["merchant"].as_str().unwrap_or("").trim().to_string();
    let total = cents(&v["total"]);
    let date = v["date"].as_str().and_then(valid_date);
    let currency = v["currency"].as_str().unwrap_or("").trim().to_uppercase();
    let currency = if currency.len() == 3 && currency.chars().all(|c| c.is_ascii_alphabetic()) { currency } else { default_currency.to_string() };
    let items: Vec<Item> = v["items"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|i| {
                    let name = i["name"].as_str()?.trim().to_string();
                    (!name.is_empty()).then(|| Item { name, amount: cents(&i["amount"]) })
                })
                .take(80)
                .collect()
        })
        .unwrap_or_default();
    let mut missing = Vec::new();
    if merchant.is_empty() { missing.push("shop") }
    if total <= 0 { missing.push("total") }
    if date.is_none() { missing.push("date") }
    ReceiptPatch {
        merchant: Some(merchant),
        total: Some(total.max(0)),
        tax: Some(cents(&v["tax"]).max(0)),
        date,
        currency: Some(currency),
        category: Some(valid_category(v["category"].as_str().unwrap_or("other")).to_string()),
        payment: Some(v["payment"].as_str().unwrap_or("").trim().to_lowercase()),
        items: Some(items),
        status: Some(if missing.is_empty() { "ready" } else { "review" }.into()),
        error: Some(if missing.is_empty() { String::new() } else { format!("Check the {}: the AI model could not read it.", missing.join(", ")) }),
        notes: None,
    }
}

#[derive(Serialize, Default, Clone)]
pub struct AiStatus {
    pub reachable: bool,
    pub models: Vec<String>,
    pub has_model: bool,
    pub message: String,
}

pub async fn status(cfg: &AiConfig) -> AiStatus {
    let http = client(4);
    let url = base(&cfg.url);
    let (path, key) = if cfg.provider == "openai" { ("/v1/models", "data") } else { ("/api/tags", "models") };
    let res = match http.get(format!("{url}{path}")).send().await {
        Ok(r) => r,
        Err(_) => {
            return AiStatus {
                message: if cfg.provider == "ollama" {
                    "Ollama is not running on this PC. Install it, then come back to download the receipt model.".into()
                } else {
                    format!("Nothing is answering at {url}.")
                },
                ..Default::default()
            }
        }
    };
    let body: Value = res.json().await.unwrap_or(Value::Null);
    let models: Vec<String> = body[key]
        .as_array()
        .map(|a| a.iter().filter_map(|m| m["name"].as_str().or(m["id"].as_str()).map(str::to_string)).collect())
        .unwrap_or_default();
    let want = cfg.model.trim_end_matches(":latest");
    let has_model = models.iter().any(|m| m == &cfg.model || m.trim_end_matches(":latest") == want);
    AiStatus {
        reachable: true,
        message: if has_model { format!("Ready: {} will read your receipts.", cfg.model) } else { format!("Connected, but {} is not downloaded yet.", cfg.model) },
        models,
        has_model,
    }
}

#[derive(Serialize, Default, Clone)]
pub struct PullProgress {
    pub active: bool,
    pub status: String,
    pub completed: u64,
    pub total: u64,
    pub error: String,
}

/// Downloads a model through Ollama's `/api/pull`, reporting progress through `report`.
pub async fn pull(cfg: &AiConfig, mut report: impl FnMut(PullProgress)) {
    use futures_util::StreamExt;
    let url = base(&cfg.url);
    let res = match reqwest::Client::new().post(format!("{url}/api/pull")).json(&json!({"model": cfg.model, "stream": true})).send().await {
        Ok(r) => r,
        Err(e) => return report(PullProgress { error: format!("Could not reach Ollama: {e}"), ..Default::default() }),
    };
    let mut stream = res.bytes_stream();
    let mut buf = Vec::new();
    let mut last = PullProgress { active: true, status: "starting".into(), ..Default::default() };
    while let Some(chunk) = stream.next().await {
        let Ok(chunk) = chunk else { break };
        buf.extend_from_slice(&chunk);
        while let Some(pos) = buf.iter().position(|b| *b == b'\n') {
            let line: Vec<u8> = buf.drain(..=pos).collect();
            let Ok(v) = serde_json::from_slice::<Value>(&line) else { continue };
            if let Some(err) = v["error"].as_str() {
                return report(PullProgress { error: err.to_string(), ..Default::default() });
            }
            last.status = v["status"].as_str().unwrap_or("").to_string();
            if let Some(t) = v["total"].as_u64() { last.total = t }
            if let Some(c) = v["completed"].as_u64() { last.completed = c }
            report(last.clone());
        }
    }
    last.active = false;
    report(last);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_clean_answer() {
        let p = parse_answer(
            r#"{"merchant":"Tesco Express","date":"2026-10-18","total":23.47,"tax":"3.91","currency":"gbp","category":"groceries","payment":"Card","items":[{"name":"Milk","amount":1.45},{"name":"","amount":2}]}"#,
            "EUR",
        );
        assert_eq!(p.merchant.as_deref(), Some("Tesco Express"));
        assert_eq!(p.total, Some(2347));
        assert_eq!(p.tax, Some(391));
        assert_eq!(p.currency.as_deref(), Some("GBP"));
        assert_eq!(p.items.as_ref().unwrap().len(), 1);
        assert_eq!(p.status.as_deref(), Some("ready"));
        assert_eq!(p.payment.as_deref(), Some("card"));
    }

    #[test]
    fn flags_missing_fields_for_review() {
        let p = parse_answer("```json\n{\"merchant\":\"\",\"date\":\"18/10/2026\",\"total\":\"R 1 234,50\",\"tax\":0,\"currency\":\"\",\"category\":\"spa\",\"items\":[]}\n```", "ZAR");
        assert_eq!(p.total, Some(123450));
        assert_eq!(p.date, None);
        assert_eq!(p.currency.as_deref(), Some("ZAR"));
        assert_eq!(p.category.as_deref(), Some("other"));
        assert_eq!(p.status.as_deref(), Some("review"));
        assert!(p.error.unwrap().contains("shop, date"));
    }

    #[test]
    fn unreadable_answer_goes_to_review() {
        let p = parse_answer("I cannot read this image.", "GBP");
        assert_eq!(p.status.as_deref(), Some("review"));
        assert!(p.total.is_none());
    }

    #[test]
    fn number_formats() {
        assert_eq!(cents(&json!("1.234,56")), 123456);
        assert_eq!(cents(&json!("1,234.56")), 123456);
        assert_eq!(cents(&json!("12,50")), 1250);
        assert_eq!(cents(&json!(7)), 700);
    }
}
