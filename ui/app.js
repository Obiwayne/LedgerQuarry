'use strict';

/* LedgerQuarry front end. One responsive app: the desktop window (owner) and
   paired phones (devices) both load it from the PC's local server. */

// ---------------------------------------------------------------- utilities

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  receipt: '<path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  wallet: '<path d="M4 7h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 7l11-3v3"/><circle cx="16" cy="13.5" r="1.2"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.2v.1"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  download: '<path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  loader: '<path d="M12 3a9 9 0 1 0 9 9"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  cart: '<path d="M3 4h2l2.4 11h10.8L20 8H6.2"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
  utensils: '<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5a2 2 0 0 0 2 2M9 3v5a2 2 0 0 1-2 2"/><path d="M17 21V3c-2 1-3 3.5-3 7h3"/>',
  car: '<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v3H3z"/><circle cx="7.5" cy="13.5" r=".8"/><circle cx="16.5" cy="13.5" r=".8"/>',
  bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  heart: '<path d="M12 20s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.4 12 20 12 20z"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  dots: '<circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/>',
};
const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;

const CAT_ICON = { groceries: 'cart', 'eating-out': 'utensils', transport: 'car', shopping: 'bag', bills: 'bolt', health: 'heart', entertainment: 'film', other: 'dots' };
const CATS = [
  ['groceries', 'Groceries'], ['eating-out', 'Eating out'], ['transport', 'Transport'], ['shopping', 'Shopping'],
  ['bills', 'Bills and utilities'], ['health', 'Health'], ['entertainment', 'Entertainment'], ['other', 'Other'],
];
const catLabel = (id) => (CATS.find((c) => c[0] === id) || CATS[7])[1];
const catColor = (id) => `var(--c-${CAT_ICON[id] ? id : 'other'})`;

const fmts = new Map();
function money(cents, opts = {}) {
  const cur = opts.currency || state.currency || 'GBP';
  const key = cur + (opts.whole ? 'w' : '');
  if (!fmts.has(key)) {
    try {
      fmts.set(key, new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol', maximumFractionDigits: opts.whole ? 0 : 2, minimumFractionDigits: opts.whole ? 0 : 2 }));
    } catch {
      fmts.set(key, new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }));
    }
  }
  return fmts.get(key).format((cents || 0) / 100);
}
function symbol(cur = state.currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency').value;
  } catch { return cur; }
}
const toCents = (v) => Math.round(parseFloat(String(v).replace(/[^0-9.\-]/g, '')) * 100) || 0;
const fromCents = (c) => ((c || 0) / 100).toFixed(2);

const thisMonth = () => new Date().toISOString().slice(0, 7);
function shiftMonth(m, by) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const monthName = (m, style = 'long') => new Date(`${m}-01T12:00`).toLocaleDateString(undefined, { month: style, year: style === 'long' ? 'numeric' : undefined });
const dayLabel = (d) => (d ? new Date(`${d}T12:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');
const ago = (iso) => {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
};

const REGION_CURRENCY = { GB: 'GBP', US: 'USD', ZA: 'ZAR', CA: 'CAD', AU: 'AUD', NZ: 'NZD', IN: 'INR', NG: 'NGN', KE: 'KES', JP: 'JPY', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN' };
const EURO = ['IE', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'PT', 'FI', 'GR', 'LU', 'SK', 'SI', 'EE', 'LV', 'LT', 'MT', 'CY', 'HR'];
function guessCurrency() {
  const region = (navigator.language.split('-')[1] || '').toUpperCase();
  return EURO.includes(region) ? 'EUR' : REGION_CURRENCY[region] || 'GBP';
}

// ---------------------------------------------------------------- auth and API

const state = {
  token: null,
  owner: false,
  me: null,
  view: 'home',
  month: thisMonth(),
  currency: 'GBP',
  settings: null,
  summary: null,
  receipts: [],
  filter: { q: '', category: '', status: '', month: '' },
  ai: null,
  installPrompt: null,
  queued: 0,
};

(function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('desktop')) sessionStorage.setItem('lq_owner', h.get('desktop'));
  if (h.get('pair')) state.pairCode = h.get('pair');
  if (h.has('scan')) state.openScan = true;
  if (h.get('desktop') || h.get('pair')) history.replaceState(null, '', location.pathname + location.search);
})();
state.token = sessionStorage.getItem('lq_owner') || localStorage.getItem('lq_device');

class ApiError extends Error {}

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (state.token) headers.authorization = `Bearer ${state.token}`;
  let body = opts.body;
  if (body && !(body instanceof FormData) && typeof body !== 'string') {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const res = await fetch(path, { ...opts, headers, body });
  if (res.status === 401 && !state.owner) {
    localStorage.removeItem('lq_device');
    state.token = null;
    renderGate('This phone is no longer paired. Scan a new QR code from LedgerQuarry on your PC.');
    throw new ApiError('Not paired');
  }
  if (res.status === 204) return null;
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : await res.blob();
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`);
  return data;
}

const images = new Map();
async function imageUrl(id) {
  if (!images.has(id)) images.set(id, api(`/api/receipts/${id}/image`).then((b) => URL.createObjectURL(b)).catch(() => null));
  return images.get(id);
}
function hydrateImages(root = document) {
  $$('img[data-rid]', root).forEach(async (img) => {
    const url = await imageUrl(img.dataset.rid);
    if (url) img.src = url;
    else img.replaceWith(Object.assign(document.createElement('span'), { innerHTML: icon('image') }));
  });
}

let toastTimer;
function toast(msg, ms = 3800) {
  let t = $('.toast');
  if (!t) document.body.append((t = Object.assign(document.createElement('div'), { className: 'toast', role: 'status' })));
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
}

// ---------------------------------------------------------------- shell

const NAV = [
  ['home', 'Dashboard', 'home'],
  ['receipts', 'Receipts', 'receipt'],
  ['budgets', 'Budgets', 'wallet'],
  ['connect', 'Connect phone', 'link'],
  ['settings', 'Settings', 'settings'],
];

function shell(content) {
  const review = state.summary?.review || 0;
  const nav = NAV.filter(([id]) => state.owner || !['settings'].includes(id)).map(([id, label, ic]) => {
    const l = !state.owner && id === 'connect' ? 'This phone' : label;
    return `<button class="nav-btn ${state.view === id ? 'active' : ''}" data-go="${id}">${icon(id === 'connect' && !state.owner ? 'phone' : ic)}<span>${l}</span>${id === 'receipts' && review ? `<span class="count">${review}</span>` : ''}</button>`;
  }).join('');
  const tab = (id, label, ic) => `<button class="tab ${state.view === id ? 'active' : ''}" data-go="${id}">${icon(ic)}${label}${id === 'receipts' && review ? `<span class="count">${review}</span>` : ''}</button>`;
  const brand = `<div class="brand"><img src="icons/logo.svg" alt=""><div>LedgerQuarry<small>${state.owner ? 'On this PC' : esc(state.me?.name || 'Paired phone')}</small></div></div>`;
  return `
    <div class="app">
      <aside class="rail">
        ${brand}
        ${nav}
        <div class="rail-foot">
          <button class="btn primary" data-act="scan">${icon('plus')} Add receipt</button>
          <div class="pill-status" id="ai-pill">${aiPill()}</div>
        </div>
      </aside>
      <div>
        <header class="topbar">${brand}${state.owner ? '' : `<button class="icon-btn" data-go="connect" aria-label="This phone">${icon('phone')}</button>`}</header>
        <main class="main" id="main">${content}</main>
      </div>
      <nav class="tabbar" aria-label="Sections">
        ${tab('home', 'Home', 'home')}
        ${tab('receipts', 'Receipts', 'receipt')}
        <button class="fab" data-act="scan" aria-label="Scan a receipt">${icon('camera')}</button>
        ${tab('budgets', 'Budgets', 'wallet')}
        ${tab(state.owner ? 'settings' : 'connect', state.owner ? 'Settings' : 'More', state.owner ? 'settings' : 'more')}
      </nav>
    </div>`;
}

function aiPill() {
  const a = state.ai;
  if (!a) return `<span class="dot"></span>Checking receipt reader…`;
  if (a.has_model) return `<span class="dot on"></span>Receipt reader ready`;
  return `<span class="dot warn"></span>${a.reachable ? 'Model not downloaded' : 'Receipt reader off'}`;
}

async function go(view) {
  state.view = view;
  window.scrollTo(0, 0);
  await render();
}

async function render() {
  const root = $('#root');
  const views = { home: viewHome, receipts: viewReceipts, budgets: viewBudgets, connect: state.owner ? viewConnect : viewPhone, settings: viewSettings };
  const v = views[state.view] || viewHome;
  try {
    const html = await v();
    root.innerHTML = shell(html);
    hydrateImages(root);
    afterRender();
  } catch (e) {
    if (!(e instanceof ApiError && e.message === 'Not paired')) root.innerHTML = shell(`<div class="empty"><h3>Something went wrong</h3><p>${esc(e.message)}</p></div>`);
  }
}

// ---------------------------------------------------------------- dashboard

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

async function viewHome() {
  const s = (state.summary = await api(`/api/summary?month=${state.month}`));
  state.currency = s.currency;
  const isNow = state.month === thisMonth();
  const delta = s.last_month.spent ? Math.round(((s.spent - s.last_month.spent) / s.last_month.spent) * 100) : null;
  const avg = s.count ? Math.round(s.spent / s.count) : 0;
  const nothingYet = !s.recent.length;

  const banners = [
    s.reading ? `<div class="banner info">${icon('loader', 'spin')}<p><b>Reading ${s.reading} receipt${s.reading === 1 ? '' : 's'}…</b> The AI model on your PC is filling in the details.</p></div>` : '',
    s.review ? `<div class="banner warn">${icon('alert')}<p><b>${s.review} receipt${s.review === 1 ? '' : 's'} need${s.review === 1 ? 's' : ''} a quick check.</b> Something on the photo couldn't be read.</p><button class="btn small" data-act="review">Check now</button></div>` : '',
    state.queued ? `<div class="banner info">${icon('upload')}<p><b>${state.queued} receipt${state.queued === 1 ? '' : 's'} waiting to upload.</b> They'll send when this phone can reach your PC.</p></div>` : '',
    state.owner && state.ai && !state.ai.has_model ? `<div class="banner info">${icon('spark')}<p><b>Turn on receipt reading.</b> Install Ollama and download the free receipt model so photos fill themselves in.</p><button class="btn small" data-go="settings">Set up</button></div>` : '',
  ].join('');

  if (nothingYet) {
    return `
      <div class="head"><div><h1>${greeting()}</h1><div class="sub">Your receipts and spending, kept on your own PC.</div></div></div>
      ${banners}
      <div class="card empty">
        <div class="art">${icon('receipt')}</div>
        <h3>No receipts yet</h3>
        <p>Snap one with your phone, drop a photo here, or try the dashboard with sample data first.</p>
        <div class="actions">
          <button class="btn primary" data-act="scan">${icon('camera')} Add a receipt</button>
          ${state.owner ? `<button class="btn" data-go="connect">${icon('phone')} Connect your phone</button><button class="btn ghost" data-act="demo">Try sample data</button>` : ''}
        </div>
      </div>`;
  }

  const kpis = `
    <div class="grid kpis">
      <div class="card kpi hero">
        <div class="label">Spent in ${monthName(state.month, 'long')}</div>
        <div class="value num">${money(s.spent)}</div>
        <div class="delta">${delta === null ? 'No spending last month to compare' : `${icon(delta > 0 ? 'up' : 'down')} ${Math.abs(delta)}% ${delta > 0 ? 'more' : 'less'} than last month`}</div>
      </div>
      <div class="card kpi"><div class="label">Receipts</div><div class="value num">${s.count}</div><div class="delta">${s.last_month.count} last month</div></div>
      <div class="card kpi"><div class="label">Average receipt</div><div class="value num">${money(avg)}</div><div class="delta">per purchase</div></div>
      <div class="card kpi"><div class="label">Tax paid</div><div class="value num">${money(s.tax)}</div><div class="delta">VAT and sales tax</div></div>
    </div>`;

  return `
    <div class="head">
      <div><h1>${greeting()}</h1><div class="sub">${isNow ? "Here's where your money went this month." : `Looking back at ${monthName(state.month)}.`}</div></div>
      <div class="actions">
        ${monthSwitch()}
        <button class="btn primary desktop-only" data-act="scan">${icon('plus')} Add receipt</button>
      </div>
    </div>
    ${banners}
    ${kpis}
    <div class="grid row-2">
      <section class="card trend"><div class="card-head"><h2>Spending over six months</h2></div><div class="card-sub">Total of all receipts per month</div>${trendChart(s.trend)}</section>
      <section class="card"><div class="card-head"><h2>Where it went</h2><button class="link" data-go="receipts">All receipts</button></div><div class="card-sub">${monthName(state.month)} by category</div>${categoryBars(s)}</section>
    </div>
    <div class="grid row-3">
      <section class="card"><div class="card-head"><h2>Budgets</h2><button class="link" data-go="budgets">Edit</button></div><div class="card-sub">This month against your limits</div>${budgetList(s)}</section>
      <section class="card"><div class="card-head"><h2>Recent receipts</h2><button class="link" data-go="receipts">See all</button></div><div class="card-sub">Newest first</div><div class="rlist">${s.recent.map(receiptItem).join('')}</div></section>
      <section class="card"><div class="card-head"><h2>Top shops</h2></div><div class="card-sub">${monthName(state.month)}</div>${s.merchants.length ? s.merchants.map((m) => `<div class="merchant-row"><span>${esc(m.name)} <span class="faint">· ${m.count}</span></span><b class="num">${money(m.total)}</b></div>`).join('') : '<p class="muted">No receipts this month.</p>'}</section>
    </div>`;
}

function monthSwitch() {
  const next = shiftMonth(state.month, 1);
  return `<div class="month"><button class="icon-btn" data-act="month" data-by="-1" aria-label="Previous month">${icon('left')}</button><span>${monthName(state.month)}</span><button class="icon-btn" data-act="month" data-by="1" aria-label="Next month" ${next > thisMonth() ? 'disabled' : ''}>${icon('right')}</button></div>`;
}

function trendChart(trend) {
  const max = Math.max(...trend.map((t) => t.total), 1);
  const cols = trend.map((t) => {
    const cur = t.month === state.month;
    const h = Math.max(2, Math.round((t.total / max) * 100));
    return `<div class="bar-col ${cur ? 'current' : ''}" data-tip="<b>${monthName(t.month)}</b><br>${money(t.total)}">
      ${cur ? `<span class="bar-val num" style="bottom:${h}%">${money(t.total, { whole: true })}</span>` : ''}
      <div class="bar" style="height:${h}%"></div><span class="bar-hit"></span></div>`;
  }).join('');
  const labels = trend.map((t) => `<span class="${t.month === state.month ? 'current' : ''}">${monthName(t.month, 'short')}</span>`).join('');
  const table = `<table hidden><caption>Spending per month</caption>${trend.map((t) => `<tr><th>${monthName(t.month)}</th><td>${money(t.total)}</td></tr>`).join('')}</table>`;
  return `<div class="chart" role="img" aria-label="Monthly spending: ${trend.map((t) => `${monthName(t.month)} ${money(t.total)}`).join(', ')}"><div class="bars">${cols}</div><div class="bar-labels">${labels}</div>${table}</div>`;
}

function categoryBars(s) {
  const rows = s.categories.filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  if (!rows.length) return '<p class="muted">No spending in this month yet.</p>';
  const max = Math.max(...rows.map((c) => Math.max(c.total, c.budget)), 1);
  return `<div class="catlist">${rows.map((c) => {
    const share = s.spent ? Math.round((c.total / s.spent) * 100) : 0;
    return `<div class="cat-row" data-tip="<b>${esc(c.label)}</b><br>${money(c.total)} · ${c.count} receipt${c.count === 1 ? '' : 's'}${c.budget ? `<br>Budget ${money(c.budget)}` : ''}">
      <span class="swatch" style="background:${catColor(c.id)}"></span>
      <div><div class="cat-name"><span>${esc(c.label)}</span><span>${share}%</span></div>
        <div class="track"><i style="width:${(c.total / max) * 100}%;background:${catColor(c.id)}"></i>${c.budget ? `<span class="mark" style="left:${Math.min(100, (c.budget / max) * 100)}%" title="Budget"></span>` : ''}</div></div>
      <span class="cat-amt num">${money(c.total)}</span></div>`;
  }).join('')}</div>`;
}

function budgetStatus(spent, budget) {
  const pct = budget ? spent / budget : 0;
  if (pct > 1) return ['critical', 'x', `Over by ${money(spent - budget)}`];
  if (pct >= 0.85) return ['warning', 'alert', `${money(budget - spent)} left`];
  return ['good', 'check', `${money(budget - spent)} left`];
}

function budgetList(s) {
  const rows = s.categories.filter((c) => c.budget > 0);
  if (!rows.length) return `<p class="muted">No budgets yet. <button class="link" data-go="budgets" style="color:var(--accent)">Set a monthly limit</button> for the categories you want to watch.</p>`;
  return rows.map((c) => {
    const [st, ic, note] = budgetStatus(c.total, c.budget);
    return `<div class="budget-row"><span class="st ${st}" title="${st === 'good' ? 'On track' : st === 'warning' ? 'Close to the limit' : 'Over budget'}">${icon(ic)}</span>
      <div><div class="budget-top"><span>${esc(c.label)}</span><span class="num">${money(c.total, { whole: true })} <span class="muted">/ ${money(c.budget, { whole: true })}</span></span></div>
      <div class="track budget"><i class="${st}" style="width:${Math.min(100, (c.total / c.budget) * 100)}%"></i></div>
      <div class="faint" style="font-size:12px;margin-top:4px">${note}</div></div></div>`;
  }).join('');
}

function receiptItem(r) {
  const chip = r.status === 'reading' ? `<span class="chip reading">${icon('loader', 'spin')} Reading</span>` : r.status === 'review' ? `<span class="chip review">${icon('alert')} Check</span>` : '';
  return `<button class="ritem" data-act="open" data-id="${r.id}">
    <span class="thumb" style="--c:${catColor(r.category)}">${r.has_image ? `<img data-rid="${r.id}" alt="">` : icon(CAT_ICON[r.category] || 'dots')}</span>
    <span style="min-width:0"><span class="r-title">${esc(r.merchant || (r.status === 'reading' ? 'New receipt' : 'Unknown shop'))}</span>
      <span class="r-meta">${dayLabel(r.date)} · ${esc(catLabel(r.category))} ${chip}</span></span>
    <span class="r-amt num">${r.status === 'reading' ? '…' : money(r.total, { currency: r.currency || state.currency })}</span></button>`;
}

// ---------------------------------------------------------------- receipts

async function viewReceipts() {
  const f = state.filter;
  const q = new URLSearchParams({ q: f.q, category: f.category, status: f.status, month: f.month });
  state.receipts = await api(`/api/receipts?${q}`);
  if (!state.summary) state.summary = await api(`/api/summary?month=${state.month}`);
  const total = state.receipts.filter((r) => r.status !== 'reading').reduce((n, r) => n + r.total, 0);
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(thisMonth(), -i));
  return `
    <div class="head"><div><h1>Receipts</h1><div class="sub">${state.receipts.length} shown · ${money(total)}</div></div>
      <div class="actions"><button class="btn desktop-only" data-act="manual">${icon('edit')} Add without photo</button><button class="btn primary desktop-only" data-act="scan">${icon('plus')} Add receipt</button></div></div>
    <div class="dropzone" id="drop">${icon('upload')}<span><b>Drop receipt photos here</b> or use Add receipt. They're read by the AI model on this PC.</span></div>
    <div class="toolbar">
      <input class="input search" type="search" placeholder="Search shops, items or notes" value="${esc(f.q)}" data-filter="q" aria-label="Search receipts">
      <select class="input" data-filter="month" aria-label="Month"><option value="">All months</option>${months.map((m) => `<option value="${m}" ${f.month === m ? 'selected' : ''}>${monthName(m)}</option>`).join('')}</select>
      <select class="input" data-filter="category" aria-label="Category"><option value="">All categories</option>${CATS.map(([id, l]) => `<option value="${id}" ${f.category === id ? 'selected' : ''}>${l}</option>`).join('')}</select>
    </div>
    <div class="chips" style="margin-bottom:12px">
      ${[['', 'All'], ['review', 'Needs a check'], ['reading', 'Being read']].map(([v, l]) => `<button class="fchip ${f.status === v ? 'on' : ''}" data-act="status" data-v="${v}">${l}</button>`).join('')}
    </div>
    <section class="card">${state.receipts.length ? `<div class="rlist">${state.receipts.map(receiptItem).join('')}</div>` : `<div class="empty"><div class="art">${icon('receipt')}</div><h3>Nothing here</h3><p>No receipts match these filters.</p></div>`}</section>`;
}

// ---------------------------------------------------------------- budgets

async function viewBudgets() {
  const s = (state.summary = await api(`/api/summary?month=${state.month}`));
  const sym = symbol();
  return `
    <div class="head"><div><h1>Budgets</h1><div class="sub">Monthly limits per category. Leave blank for no limit.</div></div><div class="actions">${monthSwitch()}</div></div>
    <section class="card">
      ${s.categories.map((c) => {
        const [st, ic, note] = c.budget ? budgetStatus(c.total, c.budget) : ['', '', ''];
        return `<div class="budget-row" style="grid-template-columns:44px minmax(0,1fr) 150px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)">
          <span class="thumb" style="--c:${catColor(c.id)}">${icon(CAT_ICON[c.id])}</span>
          <div><div class="budget-top"><b>${esc(c.label)}</b><span class="num muted">${money(c.total)} spent</span></div>
            ${c.budget ? `<div class="track budget"><i class="${st}" style="width:${Math.min(100, (c.total / c.budget) * 100)}%"></i></div><div class="faint" style="font-size:12px;margin-top:4px;display:flex;gap:6px;align-items:center"><span class="st ${st}" style="width:18px;height:18px">${icon(ic)}</span>${note}</div>` : '<div class="faint" style="font-size:12px">No limit</div>'}</div>
          <label class="money"><span>${esc(sym)}</span><input class="input num" inputmode="decimal" data-budget="${c.id}" value="${c.budget ? fromCents(c.budget) : ''}" placeholder="No limit" aria-label="${esc(c.label)} monthly budget"></label></div>`;
      }).join('')}
    </section>`;
}

// ---------------------------------------------------------------- connect (owner)

async function viewConnect() {
  const [ts, devices] = await Promise.all([api('/api/tailscale'), api('/api/devices')]);
  const running = ts.installed && ts.state === 'Running';
  const STATE = { NeedsLogin: 'Signed out', Stopped: 'Off', NoState: 'Not connected', Starting: 'Starting' };
  const status = !ts.installed ? ['warn', 'Not installed'] : running ? ['on', 'Connected'] : ['warn', STATE[ts.state] || 'Not connected'];
  return `
    <div class="head"><div><h1>Connect your phone</h1><div class="sub">Your phone reaches this PC privately through Tailscale. Nothing is opened to the internet.</div></div></div>
    <div class="grid row-2" style="margin-top:0">
      <section class="card">
        <div class="card-head"><h2>1. Tailscale on this PC</h2><span class="chip"><span class="dot ${status[0]}"></span>${status[1]}</span></div>
        <div class="card-sub">${esc(ts.message)}</div>
        ${running ? `<dl class="kv"><dt>Name</dt><dd>${esc(ts.dns_name || '—')}</dd><dt>Address</dt><dd>${esc(ts.ip || '—')}</dd><dt>Phone link</dt><dd>${ts.https_url ? `<code>${esc(ts.https_url)}</code> ${icon('shield')}` : 'Not set up yet'}</dd></dl>` : ''}
        <div class="actions" style="margin-top:16px">
          ${!ts.installed ? `<button class="btn primary" data-act="open-url" data-url="https://tailscale.com/download">${icon('download')} Get Tailscale</button>` : ''}
          ${running && !ts.https_url ? `<button class="btn primary" data-act="ts-https">${icon('shield')} Turn on private HTTPS link</button>` : ''}
          <button class="btn" data-act="refresh">${icon('refresh')} Check again</button>
        </div>
        ${running && !ts.https_url ? '<p class="faint" style="font-size:12.5px;margin:12px 0 0">The HTTPS link lets the phone install LedgerQuarry as an app. Tailscale may ask you to switch on HTTPS for your tailnet once; it opens the page for you.</p>' : ''}
      </section>
      <section class="card">
        <h2>2. On your phone</h2>
        <div class="card-sub">Once, before scanning the code</div>
        <ol class="steps">
          <li><span>Install <b>Tailscale</b> from the App Store or Google Play.</span></li>
          <li><span>Sign in with the <b>same account</b> you use on this PC and switch it on.</span></li>
          <li><span>Scan the code below with the phone's camera. LedgerQuarry opens and pairs itself.</span></li>
          <li><span>Choose <b>Add to Home Screen</b> (iPhone: Share menu; Android: Install app) to keep it as an app.</span></li>
        </ol>
      </section>
    </div>
    <section class="card" style="margin-top:16px">
      <div class="card-head"><h2>3. Scan to pair</h2><span class="faint" id="qr-timer"></span></div>
      <div class="card-sub">Each code works once and expires after 10 minutes.</div>
      <div class="qr-box">
        <div class="qr" id="qr"><button class="btn primary" data-act="qr">${icon('phone')} Show pairing code</button></div>
        <div id="qr-info" class="muted">The phone gets its own key, which you can remove below at any time. A removed phone can't see or add receipts.</div>
      </div>
    </section>
    <section class="card" style="margin-top:16px">
      <h2>Paired phones</h2><div class="card-sub">${devices.length ? 'Devices that can add and see receipts' : 'No phones paired yet'}</div>
      ${devices.map((d) => `<div class="merchant-row" style="align-items:center"><span>${icon('phone')} <b>${esc(d.name)}</b> <span class="faint">· paired ${ago(d.created_at)} · last seen ${ago(d.last_seen)}</span></span><button class="btn small danger" data-act="unpair" data-id="${d.id}">Remove</button></div>`).join('')}
    </section>`;
}

let qrInterval;
async function showQr() {
  try {
    const p = await api('/api/pairing', { method: 'POST' });
    $('#qr').innerHTML = p.qr;
    $('#qr-info').innerHTML = `<p style="margin-top:0"><b style="color:var(--text)">Scan with your phone's camera.</b> It opens:</p><code>${esc(p.url.replace(/#pair=.*/, ''))}</code><p class="faint" style="font-size:12.5px">${p.via === 'tailscale-https' ? 'Private HTTPS link over Tailscale.' : p.via === 'custom' ? 'Address set with LEDGER_PUBLIC_URL.' : 'Plain address over Tailscale. Turn on the HTTPS link above to install it as an app.'}</p><button class="btn small" data-act="qr">${icon('refresh')} New code</button>`;
    let left = p.expires_in;
    clearInterval(qrInterval);
    qrInterval = setInterval(() => {
      left -= 1;
      const t = $('#qr-timer');
      if (!t) return clearInterval(qrInterval);
      t.textContent = left > 0 ? `Expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'Expired';
      if (left <= 0) { clearInterval(qrInterval); $('#qr').innerHTML = `<button class="btn primary" data-act="qr">${icon('refresh')} Make a new code</button>`; }
    }, 1000);
  } catch (e) {
    toast(e.message, 6000);
  }
}

// ---------------------------------------------------------------- this phone

async function viewPhone() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return `
    <div class="head"><div><h1>This phone</h1><div class="sub">Paired as <b>${esc(state.me?.name)}</b></div></div></div>
    <section class="card">
      <h2>${standalone ? 'Installed as an app' : 'Keep it on your home screen'}</h2>
      <div class="card-sub">${standalone ? 'Open LedgerQuarry from your home screen any time.' : 'So it opens like an app, straight to the camera.'}</div>
      ${standalone ? '' : state.installPrompt ? `<button class="btn primary" data-act="install">${icon('download')} Install app</button>` : `<ol class="steps"><li><span><b>iPhone:</b> tap Share, then <b>Add to Home Screen</b>.</span></li><li><span><b>Android:</b> open the browser menu, then <b>Install app</b> or <b>Add to Home screen</b>.</span></li></ol>`}
    </section>
    <section class="card" style="margin-top:16px">
      <h2>How it connects</h2>
      <div class="card-sub">Through Tailscale to your PC. Keep Tailscale switched on when you add receipts. Photos taken while it's off wait on the phone and send later.</div>
      <div class="actions"><button class="btn" data-act="export">${icon('download')} Export CSV</button><button class="btn danger" data-act="unpair-self">Unpair this phone</button></div>
    </section>`;
}

// ---------------------------------------------------------------- settings (owner)

async function viewSettings() {
  const [s, ai, pull] = await Promise.all([api('/api/settings'), api('/api/ai/status'), api('/api/ai/pull')]);
  state.settings = s;
  state.ai = ai;
  const currencies = ['GBP', 'EUR', 'USD', 'ZAR', 'CAD', 'AUD', 'NZD', 'INR', 'NGN', 'KES', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN'];
  if (s.currency && !currencies.includes(s.currency)) currencies.unshift(s.currency);
  const ollama = s.ai.provider !== 'openai';
  const pct = pull.total ? Math.round((pull.completed / pull.total) * 100) : 0;
  return `
    <div class="head"><div><h1>Settings</h1><div class="sub">Everything stays in <code>${esc(s.data_dir)}</code> on this PC.</div></div></div>
    <div class="grid row-2" style="margin-top:0">
      <section class="card">
        <div class="card-head"><h2>Receipt reading</h2><span class="chip"><span class="dot ${ai.has_model ? 'on' : 'warn'}"></span>${ai.has_model ? 'Ready' : 'Not ready'}</span></div>
        <div class="card-sub">${esc(ai.message)}</div>
        <div class="radio-cards" style="margin-bottom:14px">
          <button class="radio-card ${ollama ? 'on' : ''}" data-act="provider" data-v="ollama"><b>Ollama</b><span>Recommended. Free, runs on this PC.</span></button>
          <button class="radio-card ${!ollama ? 'on' : ''}" data-act="provider" data-v="openai"><b>Another AI app</b><span>Jan, LM Studio or any OpenAI-style server.</span></button>
        </div>
        <div class="fields">
          <div class="field wide"><label for="ai-url">Server address</label><input class="input" id="ai-url" value="${esc(s.ai.url)}"></div>
          <div class="field wide"><label for="ai-model">Vision model</label><input class="input" id="ai-model" value="${esc(s.ai.model)}" list="ai-models"><datalist id="ai-models">${ai.models.map((m) => `<option value="${esc(m)}">`).join('')}</datalist></div>
        </div>
        <div class="actions" style="margin-top:14px">
          <button class="btn primary" data-act="save-ai">${icon('check')} Save and test</button>
          ${ollama && !ai.reachable ? `<button class="btn" data-act="open-url" data-url="https://ollama.com/download">${icon('download')} Download Ollama</button>` : ''}
          ${ollama && ai.reachable && !ai.has_model ? `<button class="btn" data-act="pull" ${pull.active ? 'disabled' : ''}>${icon('download')} Download ${esc(s.ai.model)} (about 6 GB)</button>` : ''}
        </div>
        ${pull.active || pull.error ? `<div style="margin-top:14px" id="pull"><div class="faint" style="font-size:12.5px;margin-bottom:6px">${pull.error ? esc(pull.error) : `${esc(pull.status)} ${pct ? `· ${pct}%` : ''}`}</div><div class="progress"><i style="width:${pct}%"></i></div></div>` : ''}
        <p class="faint" style="font-size:12.5px;margin:14px 0 0">Photos never leave your PC: the model runs locally. Qwen2.5-VL 7B needs about 6 GB of disk and runs best with 8 GB or more of graphics memory; it also works on a CPU, more slowly.</p>
      </section>
      <section class="card">
        <h2>General</h2><div class="card-sub">Currency for new receipts and totals</div>
        <div class="field"><label for="currency">Currency</label><select class="input" id="currency" data-act-change="currency">${currencies.map((c) => `<option ${c === (s.currency || state.currency) ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <h2 style="margin-top:22px">Your data</h2><div class="card-sub">Export for your accountant or a spreadsheet</div>
        <div class="actions">
          <button class="btn" data-act="export">${icon('download')} Export all as CSV</button>
          <button class="btn ghost" data-act="demo">Add sample data</button>
          <button class="btn ghost" data-act="clear-demo">Remove sample data</button>
        </div>
        <h2 style="margin-top:22px">Built from RepoQuarry</h2>
        <div class="card-sub">Open-source parts listed on repoquarry.dev</div>
        <p class="muted" style="margin:0">Receipt reading runs on <a href="#" data-act="open-url" data-url="https://repoquarry.dev/projects/ollama">Ollama</a> or <a href="#" data-act="open-url" data-url="https://repoquarry.dev/projects/jan">Jan</a>. Private phone access uses Tailscale. Version ${esc(s.version)} · <a href="#" data-act="open-url" data-url="https://github.com/Obiwayne/LedgerQuarry">GitHub</a></p>
      </section>
    </div>`;
}

// ---------------------------------------------------------------- receipt sheet

function sheet(title, body, foot = '') {
  closeSheet();
  const el = document.createElement('div');
  el.className = 'scrim';
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-act="close" aria-label="Close">${icon('x')}</button></div><div class="sheet-body">${body}</div>${foot ? `<div class="sheet-foot">${foot}</div>` : ''}</div>`;
  el.addEventListener('click', (e) => { if (e.target === el) closeSheet(); });
  document.body.append(el);
  document.body.style.overflow = 'hidden';
  return el;
}
function closeSheet() {
  $('.scrim')?.remove();
  document.body.style.overflow = '';
  clearTimeout(state.sheetPoll);
}

function receiptForm(r) {
  const sym = symbol(r.currency || state.currency);
  return `
    ${r.error ? `<p class="note-err">${icon('alert')}<span>${esc(r.error)}</span></p>` : ''}
    <div class="fields">
      <div class="field wide"><label for="f-merchant">Shop</label><input class="input" id="f-merchant" value="${esc(r.merchant)}" placeholder="Where you bought it"></div>
      <div class="field"><label for="f-total">Total</label><label class="money"><span>${esc(sym)}</span><input class="input num" id="f-total" inputmode="decimal" value="${r.total ? fromCents(r.total) : ''}"></label></div>
      <div class="field"><label for="f-date">Date</label><input class="input" id="f-date" type="date" value="${esc(r.date)}"></div>
      <div class="field"><label for="f-category">Category</label><select class="input" id="f-category">${CATS.map(([id, l]) => `<option value="${id}" ${r.category === id ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label for="f-tax">Tax</label><label class="money"><span>${esc(sym)}</span><input class="input num" id="f-tax" inputmode="decimal" value="${r.tax ? fromCents(r.tax) : ''}"></label></div>
      <div class="field"><label for="f-payment">Paid by</label><select class="input" id="f-payment">${[['', '—'], ['card', 'Card'], ['cash', 'Cash'], ['other', 'Other']].map(([v, l]) => `<option value="${v}" ${r.payment === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label for="f-currency">Currency</label><input class="input" id="f-currency" maxlength="3" value="${esc(r.currency || state.currency)}"></div>
      <div class="field wide"><label for="f-notes">Notes</label><input class="input" id="f-notes" value="${esc(r.notes)}" placeholder="Optional, e.g. client lunch"></div>
    </div>`;
}

async function openReceipt(id) {
  const r = await api(`/api/receipts/${id}`);
  const reading = r.status === 'reading';
  const body = `
    <div class="receipt-layout">
      <div class="receipt-img">${r.has_image ? `<img data-rid="${r.id}" alt="Receipt photo" data-act="zoom">` : `<span>${icon('image')}<br>No photo</span>`}</div>
      <div>${reading ? `<div class="banner info">${icon('loader', 'spin')}<p><b>Reading this receipt…</b> The details appear here when the AI model is done.</p></div>` : receiptForm(r)}
        ${r.items.length ? `<div class="items"><h3>Items</h3>${r.items.map((i) => `<div class="item-row"><span>${esc(i.name)}</span><span class="num">${money(i.amount, { currency: r.currency })}</span></div>`).join('')}</div>` : ''}
        <p class="faint" style="font-size:12px;margin-top:16px">Added ${ago(r.created_at)} from ${r.source === 'phone' ? 'a phone' : r.source === 'sample' ? 'sample data' : 'this PC'}.</p>
      </div>
    </div>`;
  const foot = reading ? `<button class="btn danger" data-act="delete" data-id="${r.id}">${icon('trash')} Delete</button><span class="spacer"></span><button class="btn" data-act="close">Close</button>`
    : `<button class="btn danger" data-act="delete" data-id="${r.id}">${icon('trash')}<span class="desktop-label">Delete</span></button>${r.has_image ? `<button class="btn" data-act="reread" data-id="${r.id}">${icon('spark')} Read again</button>` : ''}<span class="spacer"></span><button class="btn primary" data-act="save" data-id="${r.id}">${icon('check')} Save</button>`;
  const el = sheet(r.merchant || 'Receipt', body, foot);
  hydrateImages(el);
  if (reading) state.sheetPoll = setTimeout(() => $('.scrim') && openReceipt(id), 2000);
}

function readForm() {
  return {
    merchant: $('#f-merchant').value,
    total: toCents($('#f-total').value),
    tax: toCents($('#f-tax').value),
    date: $('#f-date').value,
    category: $('#f-category').value,
    payment: $('#f-payment').value,
    currency: $('#f-currency').value.toUpperCase(),
    notes: $('#f-notes').value,
  };
}

function openManual() {
  const r = { merchant: '', total: 0, tax: 0, date: new Date().toISOString().slice(0, 10), category: 'groceries', payment: 'card', currency: state.currency, notes: '' };
  sheet('Add without a photo', receiptForm(r), `<span class="spacer"></span><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="save-manual">${icon('check')} Add receipt</button>`);
}

// ---------------------------------------------------------------- scanning and upload

function openScan() {
  const body = `
    <div class="scan-hero">
      <button class="shutter" data-act="camera" aria-label="Take a photo">${icon('camera')}</button>
      <h3 style="font:600 20px var(--display);margin:0 0 6px">Snap a receipt</h3>
      <p class="muted" style="margin:0 auto;max-width:340px">Lay it flat in good light. The AI model on your PC reads the shop, date, total and tax.</p>
      <div class="actions" style="justify-content:center;margin-top:16px">
        <button class="btn" data-act="pick">${icon('image')} Choose photos</button>
        <button class="btn ghost" data-act="manual">${icon('edit')} No photo</button>
      </div>
      <input type="file" id="cam" accept="image/*" capture="environment" hidden>
      <input type="file" id="pick" accept="image/*" multiple hidden>
    </div>
    <div class="queue" id="queue"></div>`;
  const el = sheet('Add receipt', body);
  for (const id of ['cam', 'pick']) $(`#${id}`, el).addEventListener('change', (e) => { handleFiles([...e.target.files]); e.target.value = ''; });
}

/** Shrinks big phone photos before upload: faster over the tailnet and easier for the model. */
async function compress(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
    return blob || file;
  } catch {
    return file;
  }
}

function upload(blob, name, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/receipts');
    xhr.setRequestHeader('authorization', `Bearer ${state.token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      xhr.status < 300 ? resolve(data) : reject(new ApiError(data?.error || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new TypeError('offline'));
    const fd = new FormData();
    fd.append('image', blob, name.replace(/\.\w+$/, '') + '.jpg');
    xhr.send(fd);
  });
}

async function handleFiles(files) {
  const images = files.filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(f.name));
  if (!images.length) return toast('Choose a photo of a receipt.');
  if (!$('#queue')) openScan();
  for (const file of images) {
    const row = document.createElement('div');
    row.className = 'qitem';
    const blob = await compress(file);
    const preview = URL.createObjectURL(blob);
    row.innerHTML = `<img src="${preview}" alt=""><div><b class="q-title">Uploading…</b><div class="faint q-sub" style="font-size:12.5px">${esc(file.name)}</div><div class="progress"><i style="width:0%"></i></div></div>`;
    $('#queue')?.prepend(row);
    const bar = $('.progress i', row);
    try {
      const r = await upload(blob, file.name, (p) => (bar.style.width = `${Math.round(p * 100)}%`));
      bar.style.width = '100%';
      $('.q-title', row).innerHTML = `${icon('loader', 'spin')} Reading…`;
      watchReceipt(r.id, row);
    } catch (e) {
      if (e instanceof TypeError) {
        await queueAdd(blob, file.name);
        $('.q-title', row).textContent = 'Saved on this phone';
        $('.q-sub', row).textContent = "It uploads when your PC is reachable again.";
      } else {
        $('.q-title', row).textContent = 'Could not upload';
        $('.q-sub', row).textContent = e.message;
      }
    }
  }
}

async function watchReceipt(id, row) {
  for (let i = 0; i < 200; i++) {
    await sleep(1500);
    if (!row.isConnected) return refreshQuiet();
    let r;
    try { r = await api(`/api/receipts/${id}`); } catch { continue; }
    if (r.status === 'reading') continue;
    const ok = r.status === 'ready';
    $('.q-title', row).innerHTML = ok ? `${icon('check')} ${esc(r.merchant)} · ${money(r.total, { currency: r.currency })}` : `${icon('alert')} Needs a quick check`;
    $('.q-sub', row).innerHTML = ok ? `${esc(catLabel(r.category))} · ${dayLabel(r.date)} · <button class="link" style="color:var(--accent)" data-act="open" data-id="${r.id}">Edit</button>` : `${esc(r.error)} <button class="link" style="color:var(--accent)" data-act="open" data-id="${r.id}">Fix it</button>`;
    $('.progress', row)?.remove();
    return refreshQuiet();
  }
}

// Offline queue (IndexedDB): receipts snapped while the PC is unreachable.
function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ledgerquarry', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function queueTx(mode, fn) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', mode);
    const out = fn(tx.objectStore('queue'));
    tx.oncomplete = () => resolve(out.result ?? out);
    tx.onerror = () => reject(tx.error);
  });
}
const queueAdd = (blob, name) => queueTx('readwrite', (s) => s.add({ blob, name, at: Date.now() })).then(updateQueueCount);
const queueAll = () => queueTx('readonly', (s) => s.getAll());
const queueDel = (id) => queueTx('readwrite', (s) => s.delete(id));
async function updateQueueCount() {
  try { state.queued = (await queueAll()).length; } catch { state.queued = 0; }
}
async function flushQueue() {
  if (state.owner || !state.token) return;
  let items = [];
  try { items = await queueAll(); } catch { return; }
  let sent = 0;
  for (const it of items) {
    try {
      await upload(it.blob, it.name, () => {});
      await queueDel(it.id);
      sent++;
    } catch (e) {
      if (e instanceof TypeError) break;
      await queueDel(it.id);
    }
  }
  await updateQueueCount();
  if (sent) { toast(`Sent ${sent} saved receipt${sent === 1 ? '' : 's'}.`); refreshQuiet(); }
}

// ---------------------------------------------------------------- events

function afterRender() {
  const drop = $('#drop');
  if (drop) {
    ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('over')));
    drop.addEventListener('drop', (e) => { e.preventDefault(); handleFiles([...e.dataTransfer.files]); });
  }
  if ((state.summary?.reading || state.receipts.some((r) => r.status === 'reading')) && ['home', 'receipts'].includes(state.view)) {
    clearTimeout(state.poll);
    state.poll = setTimeout(refreshQuiet, 2500);
  }
}

let refreshing = false;
async function refreshQuiet() {
  if (refreshing || $('.scrim:not(:has(#queue))')) return;
  refreshing = true;
  const y = window.scrollY;
  const focus = document.activeElement?.dataset?.filter;
  try {
    if (state.view === 'receipts' || state.view === 'home') {
      state.summary = await api(`/api/summary?month=${state.month}`);
      await render();
      window.scrollTo(0, y);
      if (focus) $(`[data-filter="${focus}"]`)?.focus();
    }
  } finally {
    refreshing = false;
  }
}

let searchTimer;
document.addEventListener('input', (e) => {
  const f = e.target.dataset.filter;
  if (f === 'q') {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => { state.filter.q = e.target.value; await render(); const s = $('[data-filter="q"]'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }, 250);
  }
});

document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.filter && t.dataset.filter !== 'q') { state.filter[t.dataset.filter] = t.value; return render(); }
  if (t.dataset.budget) {
    try {
      await api('/api/budgets', { method: 'PUT', body: { category: t.dataset.budget, amount: toCents(t.value) } });
      toast(t.value ? `${catLabel(t.dataset.budget)} budget saved.` : `${catLabel(t.dataset.budget)} budget removed.`);
      render();
    } catch (err) { toast(err.message); }
  }
  if (t.dataset.actChange === 'currency') {
    try {
      await api('/api/settings', { method: 'PUT', body: { currency: t.value } });
      state.currency = t.value;
      fmts.clear();
      toast(`Currency set to ${t.value}.`);
    } catch (err) { toast(err.message); }
  }
});

document.addEventListener('click', async (e) => {
  const g = e.target.closest('[data-go]');
  if (g) { closeSheet(); return go(g.dataset.go); }
  const a = e.target.closest('[data-act]');
  if (!a) return;
  const act = a.dataset.act;
  if (a.tagName === 'A') e.preventDefault();
  try {
    switch (act) {
      case 'scan': return openScan();
      case 'camera': return $('#cam').click();
      case 'pick': return $('#pick').click();
      case 'manual': return openManual();
      case 'close': closeSheet(); return refreshQuiet();
      case 'open': return openReceipt(a.dataset.id);
      case 'zoom': {
        const z = Object.assign(document.createElement('div'), { className: 'zoom', innerHTML: `<img src="${a.src}" alt="Receipt photo">` });
        z.onclick = () => z.remove();
        return document.body.append(z);
      }
      case 'save': {
        await api(`/api/receipts/${a.dataset.id}`, { method: 'PATCH', body: readForm() });
        closeSheet();
        toast('Saved.');
        return render();
      }
      case 'save-manual': {
        const body = readForm();
        if (!body.merchant || !body.total) return toast('Add the shop and the total.');
        await api('/api/receipts/manual', { method: 'POST', body });
        closeSheet();
        toast('Receipt added.');
        return render();
      }
      case 'delete': {
        if (!confirm('Delete this receipt and its photo? This cannot be undone.')) return;
        await api(`/api/receipts/${a.dataset.id}`, { method: 'DELETE' });
        images.delete(a.dataset.id);
        closeSheet();
        toast('Receipt deleted.');
        return render();
      }
      case 'reread': {
        await api(`/api/receipts/${a.dataset.id}/reread`, { method: 'POST' });
        return openReceipt(a.dataset.id);
      }
      case 'month': {
        const next = shiftMonth(state.month, Number(a.dataset.by));
        if (next > thisMonth()) return;
        state.month = next;
        return render();
      }
      case 'review': state.filter = { q: '', category: '', status: 'review', month: '' }; return go('receipts');
      case 'status': state.filter.status = a.dataset.v; return render();
      case 'demo': {
        const r = await api('/api/demo', { method: 'POST' });
        toast(`Added ${r.added} sample receipts. Remove them any time in Settings.`, 5000);
        return go('home');
      }
      case 'clear-demo': {
        const r = await api('/api/receipts', { method: 'DELETE' });
        toast(`Removed ${r.removed} sample receipts.`);
        return render();
      }
      case 'export': {
        const blob = await api('/api/export.csv');
        const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `ledgerquarry-${new Date().toISOString().slice(0, 10)}.csv` });
        document.body.append(link);
        link.click();
        link.remove();
        return toast('CSV exported.');
      }
      case 'open-url': return api('/api/open', { method: 'POST', body: { url: a.dataset.url } });
      case 'refresh': return render();
      case 'qr': return showQr();
      case 'ts-https': {
        a.disabled = true;
        try {
          await api('/api/tailscale/https', { method: 'POST' });
          toast('Private HTTPS link is on.');
        } catch (err) {
          const link = err.message.match(/https:\/\/login\.tailscale\.com\S*/);
          if (link) { await api('/api/open', { method: 'POST', body: { url: link[0] } }); toast('Tailscale needs HTTPS switched on for your tailnet. Approve it in the page that opened, then press the button again.', 9000); }
          else toast(err.message, 8000);
        }
        return render();
      }
      case 'unpair': {
        if (!confirm('Remove this phone? It will need a new QR code to connect again.')) return;
        await api(`/api/devices/${a.dataset.id}`, { method: 'DELETE' });
        return render();
      }
      case 'unpair-self': {
        if (!confirm('Unpair this phone from your PC?')) return;
        await api('/api/devices/self', { method: 'DELETE' });
        localStorage.removeItem('lq_device');
        return renderGate('This phone is unpaired.');
      }
      case 'install': {
        state.installPrompt?.prompt();
        state.installPrompt = null;
        return;
      }
      case 'provider': {
        const openai = a.dataset.v === 'openai';
        $$('.radio-card').forEach((c) => c.classList.toggle('on', c === a));
        const url = $('#ai-url');
        if (openai && url.value.includes(':11434')) url.value = 'http://127.0.0.1:1337';
        if (!openai && !url.value.includes(':11434')) url.value = 'http://127.0.0.1:11434';
        a.closest('section').dataset.provider = a.dataset.v;
        return;
      }
      case 'save-ai': {
        const provider = $('.radio-card.on')?.dataset.v || 'ollama';
        await api('/api/settings', { method: 'PUT', body: { ai: { provider, url: $('#ai-url').value.trim(), model: $('#ai-model').value.trim() } } });
        state.ai = await api('/api/ai/status');
        toast(state.ai.message, 6000);
        return render();
      }
      case 'pull': {
        await api('/api/ai/pull', { method: 'POST' });
        render();
        return pollPull();
      }
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.message === 'Not paired')) toast(err.message, 6000);
  }
});

async function pollPull() {
  while (state.view === 'settings') {
    await sleep(1500);
    const p = await api('/api/ai/pull');
    const box = $('#pull');
    if (box) {
      const pct = p.total ? Math.round((p.completed / p.total) * 100) : 0;
      box.innerHTML = `<div class="faint" style="font-size:12.5px;margin-bottom:6px">${p.error ? esc(p.error) : `${esc(p.status)} ${pct ? `· ${pct}%` : ''}`}</div><div class="progress"><i style="width:${pct}%"></i></div>`;
    }
    if (!p.active) {
      state.ai = await api('/api/ai/status');
      toast(p.error ? p.error : state.ai.message, 6000);
      return render();
    }
  }
}

// Chart tooltips: hover on desktop, tap on phones.
let tipEl;
function showTip(target, x, y) {
  if (!tipEl) document.body.append((tipEl = Object.assign(document.createElement('div'), { className: 'tip' })));
  tipEl.innerHTML = target.dataset.tip;
  tipEl.style.left = `${Math.min(Math.max(x, 80), innerWidth - 80)}px`;
  tipEl.style.top = `${y}px`;
  tipEl.hidden = false;
}
document.addEventListener('pointermove', (e) => {
  const t = e.target.closest('[data-tip]');
  if (t && e.pointerType === 'mouse') showTip(t, e.clientX, e.clientY);
  else if (tipEl && e.pointerType === 'mouse') tipEl.hidden = true;
});
document.addEventListener('pointerdown', (e) => {
  const t = e.target.closest('[data-tip]');
  if (t && e.pointerType !== 'mouse') { const r = t.getBoundingClientRect(); showTip(t, r.left + r.width / 2, r.top); }
  else if (tipEl) tipEl.hidden = true;
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeSheet(); $('.zoom')?.remove(); } });

// Paste a screenshot of a receipt straight in (desktop).
document.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
  if (files.length && state.token) handleFiles(files);
});

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.installPrompt = e; });
window.addEventListener('online', flushQueue);

// ---------------------------------------------------------------- start

function renderGate(message) {
  $('#root').innerHTML = `
    <div class="gate"><div class="card">
      <img src="icons/logo.svg" alt="">
      <h1>Pair this phone</h1>
      <p class="muted">${esc(message || 'Open LedgerQuarry on your PC, go to Connect phone, and scan the code with this phone’s camera.')}</p>
      <ol class="steps" style="text-align:left;margin-top:18px">
        <li><span>Make sure <b>Tailscale</b> is on, on this phone and on your PC.</span></li>
        <li><span>On the PC: <b>Connect phone → Show pairing code</b>.</span></li>
        <li><span>Scan it with this phone's camera.</span></li>
      </ol>
    </div></div>`;
}

async function init() {
  if (state.pairCode) {
    try {
      const name = /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : /Android/.test(navigator.userAgent) ? (navigator.userAgent.match(/Android [\d.]+; ([^;)]+)/)?.[1]?.trim() || 'Android phone') : 'Browser';
      const r = await fetch('/api/pair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: state.pairCode, name }) }).then(async (res) => ({ ok: res.ok, data: await res.json() }));
      if (!r.ok) return renderGate(r.data.error);
      localStorage.setItem('lq_device', r.data.token);
      sessionStorage.removeItem('lq_owner');
      state.token = r.data.token;
      toast('Paired. Snap your first receipt with the camera button.', 5000);
    } catch {
      return renderGate("Couldn't reach your PC. Check that Tailscale is on, then scan the code again.");
    }
  }
  if (!state.token) return renderGate();
  try {
    state.me = await api('/api/me');
  } catch (e) {
    if (e instanceof ApiError && e.message === 'Not paired') return;
    return renderGate("Couldn't reach your PC. Check that Tailscale is on and LedgerQuarry is open on the PC.");
  }
  state.owner = state.me.owner;
  document.documentElement.dataset.role = state.owner ? 'owner' : 'device';
  if (!state.owner && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  const settings = await api('/api/settings');
  if (state.owner && !settings.currency) {
    await api('/api/settings', { method: 'PUT', body: { currency: guessCurrency() } }).catch(() => {});
    settings.currency = guessCurrency();
  }
  state.currency = settings.currency || 'GBP';
  await updateQueueCount();
  api('/api/ai/status').then((a) => { state.ai = a; const pill = $('#ai-pill'); if (pill) pill.innerHTML = aiPill(); if (state.view === 'home' && state.owner && !a.has_model) render(); }).catch(() => {});
  await render();
  flushQueue();
  if (state.openScan) openScan();
}

init();
