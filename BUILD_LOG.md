# Build log

How LedgerQuarry was built on 21 October 2026, in order, with the tools and repos used and the decisions made. Written as it happened so the next build can reuse it.

## Brief

A personal finance app that looks after someone's spending: a stylish dashboard on the desktop, a phone app to send receipt photos, receipts recorded and tracked automatically, the phone connecting privately through Tailscale with a QR code, mobile responsive, built from what is in the RepoQuarry catalogue. WhatsApp was floated and then made optional ("maybe it can be an app on their phone").

## 1. What we had to work with

**From the RepoQuarry catalogue** (`data/projects`):

| Project | Used for |
|---|---|
| [Ollama](https://repoquarry.dev/projects/ollama) | Runs the vision model that reads receipts, on the PC. Default provider. |
| [Jan](https://repoquarry.dev/projects/jan) | Alternative local AI app; supported through its OpenAI-compatible server. |
| Receipt scanner build (`/builds/receipt-scanner`) | The blueprint idea (photo → local model → books). LedgerQuarry is a single-app version of it. |
| Bigcapital, GnuCash, Invoice Ninja (`invoicing`) | Considered as the ledger. Not bundled: they need a server or desktop install of their own; CSV export covers getting data into them. |
| Syncthing, Nextcloud (`file-storage`) | Considered for moving photos. Not needed: the phone uploads straight to the PC over Tailscale. |

**Outside the catalogue:** Tailscale (private networking), Qwen2.5-VL 7B (the default vision model), Tauri, Rust crates listed in the README.

**On this machine:** Rust 1.96 (MSVC), Node 24, Tailscale installed, Android SDK without the NDK, LM Studio with an incomplete Qwen download, an RTX 4070 (12 GB). Ollama not installed.

## 2. Decisions (asked or reasoned)

- **Phone app: installable web app, not native.** Asked; chosen. Works on Android and iPhone from one codebase, installs from the QR link, no app store, no NDK download. A native Android wrapper stays possible later.
- **AI model: built in, not installed here.** Asked; the owner said ship Ollama support and the model download inside the app but don't install them on this PC. So receipt reading was tested end to end with a stand-in Ollama server (`scripts/mock-ollama.py`) that returns a real-shaped answer after a delay.
- **WhatsApp: left out.** Meta's Business API needs a public webhook and a paid account; unofficial WhatsApp Web bridges break WhatsApp's terms and get numbers banned. Both clash with the private-by-default design.
- **One server, one UI.** The desktop window and phones load the same responsive web app from a small Rust server inside the desktop app. The desktop is the owner; phones are paired devices.
- **Never listen on the LAN.** `127.0.0.1` plus the tailnet address only; `tailscale serve` for the HTTPS link phones need to install the app.
- **Money as integers, dates as ISO strings, flag instead of guess.** A receipt the model can't fully read goes to "needs a check" with the reason.
- **Charts:** colours follow a categorical palette validated for colour blindness (dark-mode steps), one hue per category in fixed order, status colours (good/warning/over) always with an icon and a word, tooltips on hover and tap, a hidden table behind the trend chart.
- **Name and look:** LedgerQuarry, part of the Quarry family (DiskQuarry). Dark ink background, mint accent, Inter and Space Grotesk (the RepoQuarry fonts), RepoQuarry hexagon in the icon.

## 3. Build steps

1. Scaffolded `F:\LedgerQuarry` (Tauri 2 + Rust, `ui/` static app), copied fonts from RepoQuarry.
2. `db.rs`: schema and queries; 4 unit tests.
3. `ai.rs`: Ollama and OpenAI-compatible clients, JSON schema prompt, tolerant parser (comma and dot decimals, fenced JSON, missing fields), model download with progress; 4 unit tests.
4. `net.rs`: Tailscale status and `serve`, QR SVG.
5. `server.rs`: axum routes, owner/device auth, one-time pairing codes, uploads with a 20 MB limit, background reading behind a semaphore, dashboard summary, budgets, settings, CSV export with spreadsheet-formula escaping, embedded static files.
6. `demo.rs`: six months of deterministic sample receipts in the chosen currency.
7. `tests/api.rs`: real server + stand-in Ollama: pairing, permission checks, upload, reading, totals, edit, CSV, device removal. Passed first run.
8. Icon: SVG (receipt with a torn edge, rising bars, RepoQuarry block) rendered to every size with resvg; `tauri icon` for the installer.
9. UI: `styles.css`, `index.html`, `manifest.webmanifest`, `sw.js`, `app.js` (dashboard, receipts, budgets, connect, this phone, settings, receipt sheet, scan sheet with on-phone resizing and upload progress, offline queue, tooltips, paste-to-add on desktop).
10. Headless `ledgerquarry-server` binary for test runs (and always-on PCs).
11. `tests/ui-flow.mjs` with Playwright: desktop and Pixel 7 profiles. Fixed what it and the screenshots showed:
    - an unsized tick icon rendering huge in the upload card;
    - the phone KPI grid leaving a lone tile, now three across;
    - toasts covering the phone tab bar;
    - the trend chart leaving empty space in its card;
    - Tailscale's raw `NoState` shown to people, now "Not connected" with a next step;
    - the pairing button hidden when Tailscale wasn't up even if another address was configured.
12. `tauri build`: NSIS setup (3.8 MB) and MSI (7.2 MB). Launched the real `ledgerquarry.exe` and checked through WebView2's debug port that it opens as the owner, removes the key from the address bar, and reports Ollama and Tailscale status correctly. Removed the data folder that check created.

## 4. Results

- Rust: 12 unit tests + 1 end-to-end API test passing.
- Browser: 12 checks passing with no page errors.
- Not tested on a physical phone or with a real model on this PC (by request). The stand-in model returns the same JSON shape Ollama's structured outputs produce.

## 5. Publishing

- GitHub repo and v0.1.0 release with the setup.exe, MSI and checksums.
- Blog post on RepoQuarry: https://repoquarry.dev/blog/ledgerquarry-private-receipt-tracker (cover and screenshots hosted in `docs/blog/`).
- Shared-build entry under RepoQuarry's Receipt scanner build: https://github.com/Obiwayne/RepoQuarry/pull/49 (waiting for review).

## 6. Promo video (20 s, 9:16)

`promo/` holds the source; the finished file is attached to the v0.1.0 release.

- **Research:** TikTok's discover pages show nothing without signing in, so the patterns came from product-video guides (Rotato): hook on something familiar in the first second, one idea per shot, hold then move, zoom into the UI so it reads on a phone, monitor-to-phone camera moves, dark high-contrast finish.
- **Storyboard first** (`promo/STORYBOARD.md`): hook → snap → read → track → private → end card, 1200 frames at 60 fps. Rebalanced once after recording the voice, because two lines ran longer than their scenes.
- **Voice:** [Kokoro](https://repoquarry.dev/projects/kokoro) from the RepoQuarry catalogue, voice `af_heart`, run locally with kokoro-onnx (`promo/voice/speak.py`, model files not committed). One clip per scene, trimmed, timed to the cuts.
- **Music:** an original 112 bpm jazz bed synthesised in Python (`promo/music/jazz.py`): Rhodes-style piano on Gm9–C13–Fmaj9–Dm9, walking bass, brushes and a swung ride. No samples, no licences. Ducked by about 8 dB under each voice line.
- **Animation:** Remotion. Shared camera (slow push and drift), spring entrances with overshoot, faster ease-in exits, staggered elements, a tap that travels on an arc and presses, a one-second count-up, word-by-word captions so it works muted. Real 3× app captures for the phone and dashboard.
- **Checks:** key-frame stills of every scene before the full render; fixed the receipt pile and a chip colliding with captions, a capture taken mid-animation, a smudge showing through a card, and a label switching before its tick. Final pass with ffmpeg: −14 LUFS integrated, −1.5 dB true peak, yuv420p, faststart.
