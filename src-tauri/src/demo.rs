//! Sample receipts so the dashboard can be explored before the first real one.
//! Deterministic, tagged `source = sample`, and removable from Settings.

use crate::db::{Db, Item, ReceiptPatch};
use chrono::{Datelike, Duration, Local};

struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        self.0 >> 33
    }
    fn range(&mut self, lo: i64, hi: i64) -> i64 {
        lo + (self.next() % (hi - lo + 1) as u64) as i64
    }
    fn pick<'a, T>(&mut self, xs: &'a [T]) -> &'a T {
        &xs[self.next() as usize % xs.len()]
    }
}

/// (category, merchants, min, max in major units, receipts per month)
const PLAN: &[(&str, &[&str], i64, i64, i64)] = &[
    ("groceries", &["Tesco", "Sainsbury's", "Lidl", "Aldi", "Co-op"], 8, 95, 8),
    ("eating-out", &["Pret A Manger", "Nando's", "Dishoom", "Wagamama", "Costa Coffee"], 4, 48, 6),
    ("transport", &["TfL", "Shell", "Trainline", "Uber"], 3, 70, 4),
    ("shopping", &["Amazon", "IKEA", "Uniqlo", "Boots"], 9, 140, 3),
    ("bills", &["Octopus Energy", "Thames Water", "Vodafone"], 25, 120, 2),
    ("health", &["Boots Pharmacy", "PureGym"], 6, 35, 1),
    ("entertainment", &["Odeon", "Waterstones", "Steam"], 7, 45, 2),
    ("other", &["Post Office", "Timpson"], 3, 25, 1),
];

const ITEMS: &[(&str, &[&str])] = &[
    ("groceries", &["Semi-skimmed milk", "Sourdough loaf", "Bananas", "Free-range eggs", "Pasta", "Cheddar", "Coffee beans", "Tomatoes"]),
    ("eating-out", &["Flat white", "Chicken wrap", "Ramen", "Lemonade", "Side salad"]),
    ("shopping", &["Phone case", "Storage boxes", "T-shirt", "Shampoo"]),
];

fn scale(currency: &str) -> i64 {
    match currency {
        "ZAR" => 18,
        "INR" => 100,
        "JPY" => 190,
        "NGN" => 1500,
        "KES" => 160,
        _ => 1,
    }
}

pub fn seed(db: &Db, currency: &str) -> rusqlite::Result<usize> {
    let mut rng = Rng(42);
    let today = Local::now().date_naive();
    let k = scale(currency);
    let mut added = 0;
    for back in (0..6).rev() {
        let first = {
            let total = today.year() * 12 + today.month0() as i32 - back;
            chrono::NaiveDate::from_ymd_opt(total.div_euclid(12), total.rem_euclid(12) as u32 + 1, 1).unwrap()
        };
        let last_day = if back == 0 { today.day() as i64 } else { 28 };
        for (cat, merchants, lo, hi, per_month) in PLAN {
            // Spending drifts a little month to month so the trend is not flat.
            let n = (*per_month + rng.range(-1, 1)).max(1);
            for _ in 0..n {
                let day = rng.range(1, last_day.max(1));
                let date = first + Duration::days(day - 1);
                let total = rng.range(lo * 100, hi * 100) * k;
                let tax = if *cat == "groceries" || *cat == "health" { 0 } else { total / 6 };
                let items: Vec<Item> = ITEMS
                    .iter()
                    .find(|(c, _)| c == cat)
                    .map(|(_, names)| {
                        let count = rng.range(2, 4);
                        let mut left = total;
                        (0..count)
                            .map(|i| {
                                let amount = if i == count - 1 { left } else { (left / (count - i)).max(1) };
                                left -= amount;
                                Item { name: rng.pick(names).to_string(), amount }
                            })
                            .collect()
                    })
                    .unwrap_or_default();
                let id = uuid::Uuid::new_v4().to_string();
                db.insert_full(
                    &id,
                    &format!("{}T12:00:00", date.format("%Y-%m-%d")),
                    "sample",
                    &ReceiptPatch {
                        date: Some(date.format("%Y-%m-%d").to_string()),
                        merchant: Some(rng.pick(merchants).to_string()),
                        total: Some(total),
                        tax: Some(tax),
                        currency: Some(currency.to_string()),
                        category: Some(cat.to_string()),
                        payment: Some(if rng.range(0, 5) == 0 { "cash" } else { "card" }.into()),
                        items: Some(items),
                        ..Default::default()
                    },
                )?;
                added += 1;
            }
        }
    }
    if db.budgets()?.is_empty() {
        for (cat, amount) in [("groceries", 400), ("eating-out", 180), ("transport", 150), ("shopping", 200), ("entertainment", 80)] {
            db.set_budget(cat, amount * 100 * k)?;
        }
    }
    Ok(added)
}

#[cfg(test)]
mod tests {
    #[test]
    fn seeds_six_months() {
        let db = crate::db::Db::memory();
        let n = super::seed(&db, "GBP").unwrap();
        assert!(n > 100);
        assert_eq!(db.delete_source("sample").unwrap(), n);
        assert_eq!(db.budgets().unwrap().len(), 5);
    }
}
