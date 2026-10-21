//! SQLite storage. Money is stored as integer minor units (cents/pence) so sums
//! never pick up floating-point drift. Dates are ISO `YYYY-MM-DD` strings.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;

/// Spending categories, in the fixed order the charts colour them.
pub const CATEGORIES: [(&str, &str); 8] = [
    ("groceries", "Groceries"),
    ("eating-out", "Eating out"),
    ("transport", "Transport"),
    ("shopping", "Shopping"),
    ("bills", "Bills and utilities"),
    ("health", "Health"),
    ("entertainment", "Entertainment"),
    ("other", "Other"),
];

pub fn valid_category(c: &str) -> &'static str {
    CATEGORIES.iter().find(|(id, _)| *id == c).map(|(id, _)| *id).unwrap_or("other")
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct Item {
    pub name: String,
    pub amount: i64,
}

#[derive(Serialize, Clone, Debug)]
pub struct Receipt {
    pub id: String,
    pub created_at: String,
    pub date: String,
    pub merchant: String,
    pub total: i64,
    pub tax: i64,
    pub currency: String,
    pub category: String,
    pub payment: String,
    pub notes: String,
    pub items: Vec<Item>,
    pub has_image: bool,
    /// `reading` while the AI model works, `ready`, or `review` when a field is missing.
    pub status: String,
    pub source: String,
    pub error: String,
}

/// Fields a person or the AI model can set. `None` leaves a field unchanged.
#[derive(Deserialize, Default, Debug, Clone)]
pub struct ReceiptPatch {
    pub date: Option<String>,
    pub merchant: Option<String>,
    pub total: Option<i64>,
    pub tax: Option<i64>,
    pub currency: Option<String>,
    pub category: Option<String>,
    pub payment: Option<String>,
    pub notes: Option<String>,
    pub items: Option<Vec<Item>>,
    pub status: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct Device {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub last_seen: String,
}

pub struct Db {
    conn: Mutex<Connection>,
}

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  date TEXT NOT NULL,
  merchant TEXT NOT NULL DEFAULT '',
  total INTEGER NOT NULL DEFAULT 0,
  tax INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other',
  payment TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  items TEXT NOT NULL DEFAULT '[]',
  image TEXT,
  status TEXT NOT NULL DEFAULT 'ready',
  source TEXT NOT NULL DEFAULT 'desktop',
  error TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS receipts_date ON receipts(date);
CREATE TABLE IF NOT EXISTS budgets (category TEXT PRIMARY KEY, amount INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL, last_seen TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
"#;

const RECEIPT_COLS: &str =
    "id, created_at, date, merchant, total, tax, currency, category, payment, notes, items, image IS NOT NULL, status, source, error";

fn row_to_receipt(r: &rusqlite::Row) -> rusqlite::Result<Receipt> {
    let items: String = r.get(10)?;
    Ok(Receipt {
        id: r.get(0)?,
        created_at: r.get(1)?,
        date: r.get(2)?,
        merchant: r.get(3)?,
        total: r.get(4)?,
        tax: r.get(5)?,
        currency: r.get(6)?,
        category: r.get(7)?,
        payment: r.get(8)?,
        notes: r.get(9)?,
        items: serde_json::from_str(&items).unwrap_or_default(),
        has_image: r.get(11)?,
        status: r.get(12)?,
        source: r.get(13)?,
        error: r.get(14)?,
    })
}

pub fn now() -> String {
    chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

pub fn today() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

#[derive(Default)]
pub struct Filter {
    pub month: Option<String>,
    pub category: Option<String>,
    pub query: Option<String>,
    pub status: Option<String>,
    pub limit: Option<i64>,
}

impl Db {
    pub fn open(path: &Path) -> rusqlite::Result<Db> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        conn.execute_batch(SCHEMA)?;
        Ok(Db { conn: Mutex::new(conn) })
    }

    pub fn memory() -> Db {
        let conn = Connection::open_in_memory().expect("memory db");
        conn.execute_batch(SCHEMA).expect("schema");
        Db { conn: Mutex::new(conn) }
    }

    fn c(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().unwrap_or_else(|e| e.into_inner())
    }

    // ---- settings ----

    pub fn setting(&self, key: &str) -> Option<String> {
        self.c()
            .query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| r.get(0))
            .optional()
            .ok()
            .flatten()
    }

    pub fn set_setting(&self, key: &str, value: &str) -> rusqlite::Result<()> {
        self.c().execute(
            "INSERT INTO settings(key, value) VALUES(?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    // ---- receipts ----

    pub fn insert_receipt(&self, id: &str, image: Option<&str>, source: &str, status: &str, currency: &str) -> rusqlite::Result<()> {
        self.c().execute(
            "INSERT INTO receipts(id, created_at, date, image, source, status, currency) VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![id, now(), today(), image, source, status, currency],
        )?;
        Ok(())
    }

    pub fn update_receipt(&self, id: &str, p: &ReceiptPatch) -> rusqlite::Result<bool> {
        let c = self.c();
        let mut sets: Vec<String> = Vec::new();
        let mut vals: Vec<rusqlite::types::Value> = Vec::new();
        let mut push = |col: &str, v: rusqlite::types::Value| {
            sets.push(format!("{} = ?{}", col, sets.len() + 1));
            vals.push(v);
        };
        if let Some(v) = &p.date { push("date", v.clone().into()) }
        if let Some(v) = &p.merchant { push("merchant", v.trim().to_string().into()) }
        if let Some(v) = p.total { push("total", v.into()) }
        if let Some(v) = p.tax { push("tax", v.into()) }
        if let Some(v) = &p.currency { push("currency", v.to_uppercase().into()) }
        if let Some(v) = &p.category { push("category", valid_category(v).to_string().into()) }
        if let Some(v) = &p.payment { push("payment", v.clone().into()) }
        if let Some(v) = &p.notes { push("notes", v.clone().into()) }
        if let Some(v) = &p.items { push("items", serde_json::to_string(v).unwrap_or_else(|_| "[]".into()).into()) }
        if let Some(v) = &p.status { push("status", v.clone().into()) }
        if let Some(v) = &p.error { push("error", v.clone().into()) }
        if sets.is_empty() {
            return Ok(true);
        }
        vals.push(id.to_string().into());
        let sql = format!("UPDATE receipts SET {} WHERE id = ?{}", sets.join(", "), vals.len());
        Ok(c.execute(&sql, rusqlite::params_from_iter(vals))? > 0)
    }

    pub fn receipt(&self, id: &str) -> Option<Receipt> {
        self.c()
            .query_row(&format!("SELECT {RECEIPT_COLS} FROM receipts WHERE id = ?1"), [id], row_to_receipt)
            .optional()
            .ok()
            .flatten()
    }

    pub fn image_name(&self, id: &str) -> Option<String> {
        self.c()
            .query_row("SELECT image FROM receipts WHERE id = ?1", [id], |r| r.get::<_, Option<String>>(0))
            .optional()
            .ok()
            .flatten()
            .flatten()
    }

    pub fn delete_receipt(&self, id: &str) -> rusqlite::Result<Option<Option<String>>> {
        let image = self
            .c()
            .query_row("SELECT image FROM receipts WHERE id = ?1", [id], |r| r.get::<_, Option<String>>(0))
            .optional()?;
        if image.is_some() {
            self.c().execute("DELETE FROM receipts WHERE id = ?1", [id])?;
        }
        Ok(image)
    }

    pub fn receipts(&self, f: &Filter) -> rusqlite::Result<Vec<Receipt>> {
        let mut sql = format!("SELECT {RECEIPT_COLS} FROM receipts WHERE 1=1");
        let mut vals: Vec<String> = Vec::new();
        if let Some(m) = &f.month {
            vals.push(format!("{m}%"));
            sql += &format!(" AND date LIKE ?{}", vals.len());
        }
        if let Some(c) = &f.category {
            vals.push(c.clone());
            sql += &format!(" AND category = ?{}", vals.len());
        }
        if let Some(s) = &f.status {
            vals.push(s.clone());
            sql += &format!(" AND status = ?{}", vals.len());
        }
        if let Some(q) = f.query.as_ref().filter(|q| !q.trim().is_empty()) {
            vals.push(format!("%{}%", q.trim()));
            sql += &format!(" AND (merchant LIKE ?{n} OR notes LIKE ?{n} OR items LIKE ?{n})", n = vals.len());
        }
        sql += &format!(" ORDER BY date DESC, created_at DESC LIMIT {}", f.limit.unwrap_or(500).clamp(1, 5000));
        let c = self.c();
        let mut stmt = c.prepare(&sql)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(vals), row_to_receipt)?;
        rows.collect()
    }

    /// (month "YYYY-MM", total) for the given months, zero-filled.
    pub fn monthly_totals(&self, months: &[String]) -> rusqlite::Result<Vec<(String, i64)>> {
        let c = self.c();
        let mut stmt = c.prepare("SELECT COALESCE(SUM(total), 0) FROM receipts WHERE date LIKE ?1 AND status != 'reading'")?;
        months
            .iter()
            .map(|m| Ok((m.clone(), stmt.query_row([format!("{m}%")], |r| r.get(0))?)))
            .collect()
    }

    pub fn category_totals(&self, month: &str) -> rusqlite::Result<Vec<(String, i64, i64)>> {
        let c = self.c();
        let mut stmt = c.prepare(
            "SELECT category, SUM(total), COUNT(*) FROM receipts WHERE date LIKE ?1 AND status != 'reading' GROUP BY category",
        )?;
        let rows = stmt.query_map([format!("{month}%")], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?;
        rows.collect()
    }

    pub fn top_merchants(&self, month: &str, n: i64) -> rusqlite::Result<Vec<(String, i64, i64)>> {
        let c = self.c();
        let mut stmt = c.prepare(
            "SELECT merchant, SUM(total) AS t, COUNT(*) FROM receipts WHERE date LIKE ?1 AND status != 'reading' AND merchant != ''
             GROUP BY lower(merchant) ORDER BY t DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![format!("{month}%"), n], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?;
        rows.collect()
    }

    /// (sum of total, sum of tax, count) for a month.
    pub fn month_stats(&self, month: &str) -> rusqlite::Result<(i64, i64, i64)> {
        self.c().query_row(
            "SELECT COALESCE(SUM(total),0), COALESCE(SUM(tax),0), COUNT(*) FROM receipts WHERE date LIKE ?1 AND status != 'reading'",
            [format!("{month}%")],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
    }

    pub fn status_count(&self, status: &str) -> i64 {
        self.c()
            .query_row("SELECT COUNT(*) FROM receipts WHERE status = ?1", [status], |r| r.get(0))
            .unwrap_or(0)
    }

    pub fn clear_receipts(&self) -> rusqlite::Result<Vec<String>> {
        let c = self.c();
        let images: Vec<String> = {
            let mut stmt = c.prepare("SELECT image FROM receipts WHERE image IS NOT NULL")?;
            let rows = stmt.query_map([], |r| r.get(0))?;
            rows.filter_map(Result::ok).collect()
        };
        c.execute("DELETE FROM receipts", [])?;
        Ok(images)
    }

    /// Deletes receipts added by `source` (used for sample data). Returns how many.
    pub fn delete_source(&self, source: &str) -> rusqlite::Result<usize> {
        self.c().execute("DELETE FROM receipts WHERE source = ?1", [source])
    }

    pub fn insert_full(&self, id: &str, created_at: &str, source: &str, p: &ReceiptPatch) -> rusqlite::Result<()> {
        self.c().execute(
            "INSERT INTO receipts(id, created_at, date, source, status, currency) VALUES(?1, ?2, ?3, ?4, 'ready', ?5)",
            params![id, created_at, p.date.clone().unwrap_or_else(today), source, p.currency.clone().unwrap_or_default()],
        )?;
        self.update_receipt(id, p)?;
        Ok(())
    }

    // ---- budgets ----

    pub fn budgets(&self) -> rusqlite::Result<Vec<(String, i64)>> {
        let c = self.c();
        let mut stmt = c.prepare("SELECT category, amount FROM budgets")?;
        let rows = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?;
        rows.collect()
    }

    pub fn set_budget(&self, category: &str, amount: i64) -> rusqlite::Result<()> {
        let c = self.c();
        if amount <= 0 {
            c.execute("DELETE FROM budgets WHERE category = ?1", [category])?;
        } else {
            c.execute(
                "INSERT INTO budgets(category, amount) VALUES(?1, ?2) ON CONFLICT(category) DO UPDATE SET amount = excluded.amount",
                params![valid_category(category), amount],
            )?;
        }
        Ok(())
    }

    // ---- devices ----

    pub fn add_device(&self, id: &str, name: &str, token_hash: &str) -> rusqlite::Result<()> {
        let t = now();
        self.c().execute(
            "INSERT INTO devices(id, name, token_hash, created_at, last_seen) VALUES(?1, ?2, ?3, ?4, ?4)",
            params![id, name, token_hash, t],
        )?;
        Ok(())
    }

    /// Looks up a device by token hash and records that it was seen.
    pub fn device_by_hash(&self, hash: &str) -> Option<Device> {
        let c = self.c();
        let d = c
            .query_row("SELECT id, name, created_at, last_seen FROM devices WHERE token_hash = ?1", [hash], |r| {
                Ok(Device { id: r.get(0)?, name: r.get(1)?, created_at: r.get(2)?, last_seen: r.get(3)? })
            })
            .optional()
            .ok()
            .flatten()?;
        let _ = c.execute("UPDATE devices SET last_seen = ?1 WHERE id = ?2", params![now(), d.id]);
        Some(d)
    }

    pub fn devices(&self) -> rusqlite::Result<Vec<Device>> {
        let c = self.c();
        let mut stmt = c.prepare("SELECT id, name, created_at, last_seen FROM devices ORDER BY last_seen DESC")?;
        let rows = stmt.query_map([], |r| {
            Ok(Device { id: r.get(0)?, name: r.get(1)?, created_at: r.get(2)?, last_seen: r.get(3)? })
        })?;
        rows.collect()
    }

    pub fn remove_device(&self, id: &str) -> rusqlite::Result<bool> {
        Ok(self.c().execute("DELETE FROM devices WHERE id = ?1", [id])? > 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seeded() -> Db {
        let db = Db::memory();
        for (id, date, total, cat) in [
            ("a", "2026-10-02", 4250, "groceries"),
            ("b", "2026-10-05", 1999, "eating-out"),
            ("c", "2026-10-20", 750, "groceries"),
            ("d", "2026-09-28", 10000, "bills"),
        ] {
            db.insert_receipt(id, None, "desktop", "ready", "GBP").unwrap();
            db.update_receipt(
                id,
                &ReceiptPatch {
                    date: Some(date.into()),
                    total: Some(total),
                    category: Some(cat.into()),
                    merchant: Some(format!("Shop {id}")),
                    ..Default::default()
                },
            )
            .unwrap();
        }
        db
    }

    #[test]
    fn month_totals_and_categories() {
        let db = seeded();
        assert_eq!(db.month_stats("2026-10").unwrap(), (6999, 0, 3));
        let mut cats = db.category_totals("2026-10").unwrap();
        cats.sort();
        assert_eq!(cats, vec![("eating-out".into(), 1999, 1), ("groceries".into(), 5000, 2)]);
        assert_eq!(
            db.monthly_totals(&["2026-09".into(), "2026-10".into(), "2026-11".into()]).unwrap(),
            vec![("2026-09".into(), 10000), ("2026-10".into(), 6999), ("2026-11".into(), 0)]
        );
    }

    #[test]
    fn reading_receipts_are_not_counted() {
        let db = seeded();
        db.update_receipt("a", &ReceiptPatch { status: Some("reading".into()), ..Default::default() }).unwrap();
        assert_eq!(db.month_stats("2026-10").unwrap().0, 2749);
    }

    #[test]
    fn filters_and_unknown_category() {
        let db = seeded();
        let f = Filter { query: Some("shop c".into()), ..Default::default() };
        assert_eq!(db.receipts(&f).unwrap().len(), 1);
        db.update_receipt("b", &ReceiptPatch { category: Some("yachts".into()), ..Default::default() }).unwrap();
        assert_eq!(db.receipt("b").unwrap().category, "other");
    }

    #[test]
    fn budgets_and_devices() {
        let db = Db::memory();
        db.set_budget("groceries", 40000).unwrap();
        db.set_budget("health", 0).unwrap();
        assert_eq!(db.budgets().unwrap(), vec![("groceries".into(), 40000)]);
        db.add_device("d1", "Pixel", "hash1").unwrap();
        assert_eq!(db.device_by_hash("hash1").unwrap().name, "Pixel");
        assert!(db.device_by_hash("nope").is_none());
        assert!(db.remove_device("d1").unwrap());
        assert!(db.device_by_hash("hash1").is_none());
    }
}
