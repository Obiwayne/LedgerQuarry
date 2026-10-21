# How LedgerQuarry works

## Pieces

| Part | Where | What it does |
|---|---|---|
| `src-tauri/src/lib.rs` | Desktop | Starts the server, opens a Tauri window on `http://127.0.0.1:<port>/#desktop=<owner key>` |
| `src-tauri/src/server.rs` | Desktop | axum routes, auth, uploads, pairing, background reading, CSV export, static files (embedded with rust-embed) |
| `src-tauri/src/db.rs` | Desktop | SQLite schema and queries (receipts, budgets, devices, settings) |
| `src-tauri/src/ai.rs` | Desktop | Talks to Ollama (`/api/chat` with a JSON schema) or an OpenAI-compatible server (`/v1/chat/completions`), parses the answer, downloads models via `/api/pull` |
| `src-tauri/src/net.rs` | Desktop | `tailscale status --json`, `tailscale serve --bg <port>`, QR code SVG |
| `src-tauri/src/demo.rs` | Desktop | Deterministic sample data, tagged `source = sample` |
| `ui/` | Both | One responsive app: sidebar dashboard on wide screens, tab bar with a camera button on phones; service worker and IndexedDB upload queue for phones |

## Who can do what

| Action | Desktop window (owner) | Paired phone |
|---|---|---|
| See dashboard, receipts, budgets | yes | yes |
| Add, edit, delete receipts | yes | yes |
| Set budgets | yes | yes |
| Pair or remove phones, Tailscale, settings, AI model, sample data | yes | no (403) |
| Unpair itself | n/a | yes |

The owner key is random per launch and lives only in the window's session storage. Phone keys are 48 random characters; the database keeps their SHA-256. Pairing codes are 24 characters, single use, 10-minute lifetime, held only in memory.

## Network exposure

- Always: `127.0.0.1:<port>` (default 8787).
- When Tailscale is running at start-up: also `<tailnet IPv4>:<port>` over plain HTTP. Only devices on the person's tailnet can route to that address.
- Optional: `tailscale serve --bg <port>` publishes `https://<pc>.<tailnet>.ts.net/` to the tailnet with a real certificate, which phones need to install the web app and use the camera from the home-screen app.
- Never: `0.0.0.0`, the LAN address, or a public tunnel.

## Reading a receipt

1. The phone shrinks the photo (longest side 2000 px, JPEG 86%) and posts it to `/api/receipts`.
2. The server writes `receipts/<uuid>.jpg`, inserts a row with status `reading`, and queues a background task. A semaphore keeps one model call at a time.
3. Ollama gets the photo with a prompt and a JSON schema (structured outputs, temperature 0). OpenAI-compatible servers get `response_format: json_object`.
4. `parse_answer` turns the reply into a patch: amounts in both `1,234.56` and `1.234,56` styles become integer minor units; dates must be ISO and printed on the receipt; unknown categories become `other`; a missing shop, total or date sets status `review` with a message saying which, instead of inventing a value.
5. The phone polls the receipt and shows the result with a link to edit it. Saving by hand marks it checked.

## Offline phones

Uploads that fail with a network error are stored in IndexedDB (`ledgerquarry/queue`) with their photo and retried when the browser fires `online` or the app is next opened. The service worker caches the app shell (network first) so the app opens without a connection; `/api/*` is never cached.

## Tests

- `cargo test`: 12 unit tests (database totals and filters, AI answer parsing in several number formats, budgets and devices, sample data, CSV formula escaping, month maths, QR) and `tests/api.rs`, which runs a real server on a random port with a stand-in Ollama and walks pairing, permissions, upload, reading, dashboard totals, editing, CSV export and device removal.
- `tests/ui-flow.mjs`: Playwright against a running server: desktop dashboard, search, budgets, pairing QR, a Pixel 7 profile pairing by link, snapping a rendered receipt photo, seeing it read and opening it, then being locked out after removal; fails on any page error.
