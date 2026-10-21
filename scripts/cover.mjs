// Renders the launch cover and social card from the app screenshots.
//   node scripts/cover.mjs <out-dir>
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeFileSync, rmSync } from 'node:fs';

const out = process.argv[2] || 'docs/blog';
const f = (p) => pathToFileURL(resolve(p)).href;
const html = (w, h, foot) => `<!doctype html><html><head><style>
@font-face{font-family:SG;src:url("${f('ui/fonts/space-grotesk-latin-wght-normal.woff2')}")}
@font-face{font-family:IN;src:url("${f('ui/fonts/inter-latin-wght-normal.woff2')}")}
html,body{margin:0}
body{width:${w}px;height:${h}px;overflow:hidden;position:relative;font-family:IN;color:#eef1f6;
background:radial-gradient(800px 600px at 78% 20%,rgba(61,220,151,.28),transparent 60%),radial-gradient(700px 500px at 100% 100%,rgba(124,156,255,.18),transparent 60%),radial-gradient(600px 500px at 0% 0%,rgba(253,139,64,.12),transparent 60%),#0b0d12}
.copy{position:absolute;left:72px;top:${foot ? 96 : 120}px;width:560px}
.brand{display:flex;align-items:center;gap:14px;font:600 28px SG}
.brand img{width:48px;height:48px;border-radius:13px}
.kick{margin-top:52px;color:#3ddc97;font:500 21px SG;letter-spacing:.14em}
h1{font:700 84px/1 SG;margin:14px 0 0;letter-spacing:-.02em}
.lede{font:600 38px/1.18 SG;margin-top:22px}
ul{list-style:none;padding:0;margin:30px 0 0;font-size:23px;color:#b5bcc8;line-height:1.75}
ul li::before{content:"";display:inline-block;width:9px;height:9px;border-radius:50%;background:#3ddc97;margin:0 14px 3px 0}
.desk{position:absolute;left:690px;top:${foot ? 120 : 130}px;width:1360px;border-radius:20px;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.12),0 40px 120px rgba(0,0,0,.6);transform:scale(.72);transform-origin:top left}
.desk img{display:block;width:1360px}
.phone{position:absolute;left:${foot ? 1180 : 1190}px;top:${foot ? 330 : 300}px;width:412px;border-radius:44px;overflow:hidden;border:10px solid #050608;box-shadow:0 0 0 1px rgba(255,255,255,.18),0 40px 100px rgba(0,0,0,.7);transform:scale(.78);transform-origin:top left}
.phone img{display:block;width:412px}
.foot{position:absolute;left:0;right:0;bottom:0;height:90px;background:#0b0d12;display:flex;align-items:center;justify-content:space-between;padding:0 72px;font:26px SG}
.foot b{color:#3ddc97;font-weight:500}
</style></head><body>
<div class="copy"><div class="brand"><img src="${f('ui/icons/logo.svg')}">LedgerQuarry</div>
<div class="kick">FREE · OPEN SOURCE · PRIVATE</div><h1>Snap it.<br>Track it.</h1>
<div class="lede">Receipts read by AI on your own PC.</div>
<ul><li>Phone app paired by QR over Tailscale</li><li>Local AI reads shop, total and tax</li><li>Dashboard, budgets, CSV export</li></ul></div>
<div class="desk"><img src="${f('docs/screenshots/desktop-dashboard.png')}"></div>
<div class="phone"><img src="${f('docs/screenshots/phone-read.png')}"></div>
${foot ? '<div class="foot"><span>MIT licence · Rust + Tauri · Ollama</span><b>github.com/Obiwayne/LedgerQuarry</b></div>' : ''}
</body></html>`;

const browser = await chromium.launch();
for (const [name, w, h, foot] of [['cover', 1600, 900, false], ['social', 1600, 1000, true]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const tmp = resolve(out, `_${name}.html`);
  writeFileSync(tmp, html(w, h, foot));
  await page.goto(f(tmp));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}.png` });
  rmSync(tmp);
}
await browser.close();
console.log('cover and social card written');
