//! End-to-end API test against a real server on a random port, with a stand-in
//! Ollama server so no AI model is needed.

use axum::routing::{get, post};
use axum::{Json, Router};
use ledgerquarry_lib::{db::Db, server};
use serde_json::{json, Value};
use std::time::Duration;

async fn fake_ollama() -> String {
    let app = Router::new()
        .route("/api/tags", get(|| async { Json(json!({"models": [{"name": "qwen2.5vl:7b"}]})) }))
        .route(
            "/api/chat",
            post(|Json(body): Json<Value>| async move {
                // The real request carries the photo as base64 in `images`.
                assert!(body["messages"][0]["images"][0].as_str().unwrap().len() > 10);
                Json(json!({"message": {"content": r#"{"merchant":"Corner Café","date":"2026-10-19","total":"12.40","tax":2.07,"currency":"GBP","category":"eating-out","payment":"card","items":[{"name":"Flat white","amount":3.4},{"name":"Toastie","amount":9}]}"#}}))
            }),
        );
    let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", l.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(l, app).await.unwrap() });
    url
}

#[tokio::test]
async fn pair_upload_read_and_summarise() {
    std::env::set_var("LEDGER_PUBLIC_URL", "http://phone.test");
    let dir = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(dir.path().join("receipts")).unwrap();
    let state = server::AppState::with_db(Db::memory(), dir.path().to_path_buf());
    let port = server::start(state.clone(), 0).await.unwrap();
    let base = format!("http://127.0.0.1:{port}");
    let http = reqwest::Client::new();
    let owner = format!("Bearer {}", state.desktop_token);

    // The app page is served without a token; the API is not.
    let page = http.get(&base).send().await.unwrap();
    assert_eq!(page.status(), 200);
    assert_eq!(http.get(format!("{base}/api/summary")).send().await.unwrap().status(), 401);

    // Point the app at the stand-in model.
    let ai = fake_ollama().await;
    let r = http
        .put(format!("{base}/api/settings"))
        .header("authorization", &owner)
        .json(&json!({"currency": "gbp", "ai": {"provider": "ollama", "url": ai, "model": "qwen2.5vl:7b"}}))
        .send()
        .await
        .unwrap();
    assert_eq!(r.status(), 200);
    let st: Value = http.get(format!("{base}/api/ai/status")).header("authorization", &owner).send().await.unwrap().json().await.unwrap();
    assert_eq!(st["has_model"], true);

    // Pair a phone with a one-time code.
    let p: Value = http.post(format!("{base}/api/pairing")).header("authorization", &owner).send().await.unwrap().json().await.unwrap();
    let url = p["url"].as_str().unwrap();
    assert!(url.starts_with("http://phone.test/#pair="));
    assert!(p["qr"].as_str().unwrap().contains("<svg"));
    let code = url.split("#pair=").nth(1).unwrap();
    let paired: Value = http.post(format!("{base}/api/pair")).json(&json!({"code": code, "name": "Pixel 9"})).send().await.unwrap().json().await.unwrap();
    let phone = format!("Bearer {}", paired["token"].as_str().unwrap());
    let reuse = http.post(format!("{base}/api/pair")).json(&json!({"code": code})).send().await.unwrap();
    assert_eq!(reuse.status(), 401, "a pairing code works once");

    // A phone can't change settings or pair more devices.
    assert_eq!(http.post(format!("{base}/api/pairing")).header("authorization", &phone).send().await.unwrap().status(), 403);

    // The phone uploads a photo; the model reads it in the background.
    let jpeg = vec![0xFFu8, 0xD8, 0xFF, 0xE0].into_iter().chain(std::iter::repeat_n(7u8, 500)).collect::<Vec<_>>();
    let form = reqwest::multipart::Form::new().part("image", reqwest::multipart::Part::bytes(jpeg).file_name("r.jpg").mime_str("image/jpeg").unwrap());
    let created: Value = http.post(format!("{base}/api/receipts")).header("authorization", &phone).multipart(form).send().await.unwrap().json().await.unwrap();
    assert_eq!(created["status"], "reading");
    assert_eq!(created["source"], "phone");
    let id = created["id"].as_str().unwrap().to_string();
    let mut r: Value = Value::Null;
    for _ in 0..50 {
        r = http.get(format!("{base}/api/receipts/{id}")).header("authorization", &phone).send().await.unwrap().json().await.unwrap();
        if r["status"] != "reading" {
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    assert_eq!(r["status"], "ready", "{r}");
    assert_eq!(r["merchant"], "Corner Café");
    assert_eq!(r["total"], 1240);
    assert_eq!(r["tax"], 207);
    assert_eq!(r["items"].as_array().unwrap().len(), 2);

    let img = http.get(format!("{base}/api/receipts/{id}/image")).header("authorization", &phone).send().await.unwrap();
    assert_eq!(img.headers()["content-type"], "image/jpeg");

    // Dashboard for that month.
    let s: Value = http.get(format!("{base}/api/summary?month=2026-10")).header("authorization", &owner).send().await.unwrap().json().await.unwrap();
    assert_eq!(s["spent"], 1240);
    assert_eq!(s["currency"], "GBP");
    let eating = s["categories"].as_array().unwrap().iter().find(|c| c["id"] == "eating-out").unwrap();
    assert_eq!(eating["total"], 1240);
    assert_eq!(s["trend"].as_array().unwrap().len(), 6);

    // Editing by hand, then CSV export.
    let e: Value = http.patch(format!("{base}/api/receipts/{id}")).header("authorization", &phone).json(&json!({"merchant": "Corner Cafe", "notes": "=team lunch"})).send().await.unwrap().json().await.unwrap();
    assert_eq!(e["merchant"], "Corner Cafe");
    let csv = http.get(format!("{base}/api/export.csv")).header("authorization", &owner).send().await.unwrap().text().await.unwrap();
    assert!(csv.contains("2026-10-19,Corner Cafe,eating-out,12.40,2.07,GBP,card,ready,'=team lunch"), "{csv}");

    // Removing the phone revokes its token.
    let devices: Value = http.get(format!("{base}/api/devices")).header("authorization", &owner).send().await.unwrap().json().await.unwrap();
    let dev = devices[0]["id"].as_str().unwrap();
    http.delete(format!("{base}/api/devices/{dev}")).header("authorization", &owner).send().await.unwrap();
    assert_eq!(http.get(format!("{base}/api/me")).header("authorization", &phone).send().await.unwrap().status(), 401);
}
