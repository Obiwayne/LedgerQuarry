// Browser test of the real app: desktop dashboard as the owner, then a phone
// that pairs by its QR link, snaps a receipt and sees it read.
//
//   node tests/ui-flow.mjs <owner-url> [screenshot-dir]
//
// Needs a running server (npm run server, with LEDGER_PUBLIC_URL set so pairing
// works without Tailscale) whose AI setting points at scripts/mock-ollama.py.
import { chromium, devices } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const ownerUrl = process.argv[2];
const shots = process.argv[3];
if (!ownerUrl) throw new Error('Pass the owner URL printed by the server.');
const base = new URL(ownerUrl).origin;
const token = new URL(ownerUrl).hash.split('desktop=')[1];
if (shots) mkdirSync(shots, { recursive: true });
const shot = async (page, name) => {
  if (!shots) return;
  await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  await page.screenshot({ path: `${shots}/${name}.png` });
};
const check = (ok, msg) => { if (!ok) throw new Error(`FAIL: ${msg}`); console.log(`ok   ${msg}`); };
const owner = (path, opts = {}) => fetch(base + path, { ...opts, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(opts.headers || {}) } });

const browser = await chromium.launch();
const errors = [];

// ---- a receipt photo to scan, rendered from HTML ----
const paper = await browser.newPage({ viewport: { width: 420, height: 640 }, deviceScaleFactor: 2 });
await paper.setContent(`<body style="margin:0;background:#c9b9a0;display:grid;place-items:center;height:100vh">
  <div style="width:300px;padding:26px 22px;background:#fbfaf6;font:13px/1.55 'Courier New',monospace;color:#222;box-shadow:0 10px 30px rgba(0,0,0,.3);transform:rotate(-1.5deg)">
  <div style="text-align:center;font-weight:bold;font-size:18px">GAIL'S BAKERY</div><div style="text-align:center">12 Exmouth Market, London</div>
  <div style="text-align:center">VAT 123 4567 89</div><hr style="border:0;border-top:1px dashed #555">
  <div>${new Date().toLocaleDateString('en-GB')} 08:42</div><br>
  <div style="display:flex;justify-content:space-between"><span>Flat white</span><span>3.60</span></div>
  <div style="display:flex;justify-content:space-between"><span>Cinnamon bun</span><span>3.95</span></div>
  <div style="display:flex;justify-content:space-between"><span>Sourdough loaf</span><span>5.50</span></div>
  <div style="display:flex;justify-content:space-between"><span>Oat milk</span><span>1.80</span></div>
  <hr style="border:0;border-top:1px dashed #555"><div style="display:flex;justify-content:space-between;font-weight:bold;font-size:16px"><span>TOTAL</span><span>£14.85</span></div>
  <div style="display:flex;justify-content:space-between"><span>VAT 20%</span><span>2.48</span></div><div>CARD ************4421</div><br><div style="text-align:center">Thank you!</div></div></body>`);
const receiptPng = await paper.screenshot({ type: 'jpeg', quality: 88 });
if (shots) await paper.screenshot({ path: `${shots}/sample-receipt.jpg`, type: 'jpeg', quality: 88 });
await paper.close();

// ---- desktop, as the owner ----
const desk = await browser.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2 });
const page = await desk.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(ownerUrl);
await page.waitForSelector('.kpi.hero');
check((await page.locator('.kpi.hero .value').innerText()).length > 1, 'dashboard shows this month’s spending');
check(await page.locator('.bar-col').count() === 6, 'six-month trend has six bars');
await shot(page, 'desktop-dashboard');

await page.click('.nav-btn[data-go="receipts"]');
await page.waitForSelector('.ritem');
await page.fill('[data-filter="q"]', 'tesco');
await page.waitForTimeout(600);
const titles = await page.locator('.r-title').allInnerTexts();
check(titles.length > 0 && titles.every((t) => /tesco/i.test(t)), 'search filters receipts');
await page.fill('[data-filter="q"]', '');
await page.waitForTimeout(600);
await shot(page, 'desktop-receipts');
await page.locator('.ritem').first().click();
await page.waitForSelector('.sheet #f-merchant');
await shot(page, 'desktop-receipt-detail');
await page.click('[data-act="close"]');

await page.click('.nav-btn[data-go="budgets"]');
await page.waitForSelector('[data-budget="health"]');
await page.fill('[data-budget="health"]', '45');
await page.locator('[data-budget="health"]').dispatchEvent('change');
await page.waitForTimeout(700);
check((await (await owner('/api/budgets')).json()).health === 4500, 'budget saved from the Budgets page');
await shot(page, 'desktop-budgets');

await page.click('.nav-btn[data-go="connect"]');
await page.waitForSelector('h1:has-text("Connect your phone")');
await page.click('[data-act="qr"]');
await page.waitForSelector('#qr svg');
check(true, 'pairing QR code shown on the PC');
await shot(page, 'desktop-connect');
await page.click('.nav-btn[data-go="settings"]');
await page.waitForSelector('#ai-url');
await shot(page, 'desktop-settings');

// ---- phone: pair with the QR link, then scan ----
const pairing = await (await owner('/api/pairing', { method: 'POST' })).json();
check(pairing.url.includes('#pair='), 'pairing link created');
const phoneCtx = await browser.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 3 });
const phone = await phoneCtx.newPage();
phone.on('pageerror', (e) => errors.push(`phone: ${e.message}`));
await phone.goto(pairing.url.replace(/^https?:\/\/[^/]+/, base));
await phone.waitForSelector('.tabbar .fab');
check(await phone.evaluate(() => !!localStorage.getItem('lq_device')), 'phone paired and kept its key');
check(!(await phone.url()).includes('pair='), 'pairing code removed from the address bar');
await phone.waitForSelector('.toast', { state: 'detached', timeout: 8000 });
await shot(phone, 'phone-dashboard');

await phone.click('.tabbar .fab');
await phone.waitForSelector('.shutter');
await shot(phone, 'phone-scan');
await phone.setInputFiles('#cam', { name: 'receipt.jpg', mimeType: 'image/jpeg', buffer: receiptPng });
await phone.waitForSelector('.qitem .q-title:has-text("Reading")', { timeout: 15000 });
await shot(phone, 'phone-reading');
await phone.waitForSelector('.qitem .q-title:has-text("Gail")', { timeout: 30000 });
check(/14\.85/.test(await phone.locator('.qitem .q-title').innerText()), 'receipt read: shop and total shown');
await shot(phone, 'phone-read');
await phone.click('.qitem [data-act="open"]');
await phone.waitForSelector('#f-merchant');
check(await phone.inputValue('#f-merchant') === "Gail's Bakery", 'receipt detail opens with the read fields');
await shot(phone, 'phone-receipt');
await phone.click('[data-act="close"]');
await phone.click('.tab[data-go="receipts"]');
await phone.waitForSelector('.ritem');
await shot(phone, 'phone-receipts');

// Owner removes the phone: it is locked out.
const devs = await (await owner('/api/devices')).json();
await owner(`/api/devices/${devs[0].id}`, { method: 'DELETE' });
await phone.reload();
await phone.waitForSelector('.gate');
check(true, 'removed phone is sent back to the pairing screen');

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
await browser.close();
console.log('All UI checks passed.');
