/* Balance Terminal. Reads the dashboard state from the Apps Script API (key kept on this device). */
(function () {
'use strict';

// ---------------------------------------------------------------- settings + api
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
const cfg = () => ({ api: LS.get('bt-api', (window.BT_CONFIG || {}).api || ''), key: LS.get('bt-key', '') });

async function api(body) {
  const c = cfg();
  if (!c.api || !c.key) { openSettings(); throw new Error('Not connected yet. Paste your access key.'); }
  const r = await fetch(c.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ key: c.key }, body)) });
  const j = await r.json().catch(() => ({ ok: false, error: 'The API did not answer with data (HTTP ' + r.status + ').' }));
  if (!j.ok) throw new Error(j.error || 'Request failed');
  return j;
}

// ---------------------------------------------------------------- formatting
const $ = id => document.getElementById(id);
const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const lab = m => m === 'NOW' ? 'NOW' : m.split('-')[0] + " '" + m.split('-')[1];
const longLab = m => m === 'NOW' ? 'now' : m.split('-')[0] + ' 20' + m.split('-')[1];
const monthEnd = m => { const [a, y] = m.split('-'); return new Date(2000 + +y, MN.indexOf(a) + 1, 0, 23, 59); };
const fmt = v => (v < 0 ? '-' : '') + '$' + Math.round(Math.abs(v || 0)).toLocaleString('en-US');
const fmt2 = v => { const n = Number(v || 0); const d = Math.abs(n) < 1 ? 5 : 2; return '$' + n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); };
const fmtK = v => { const a = Math.abs(v), s = v < 0 ? '-' : ''; return a >= 1e6 ? s + '$' + (a / 1e6).toFixed(2) + 'M' : a >= 1e3 ? s + '$' + (a / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'k' : s + '$' + Math.round(a); };
const pctS = (a, b) => b ? ((a - b) / Math.abs(b) * 100) : null;
const cls = d => d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
const chg = d => `<span class="${cls(d)}">${d >= 0 ? '+' : '-'}${fmt(Math.abs(d))}</span>`;
const ago = iso => { const s = (Date.now() - new Date(iso)) / 1000; return s < 90 ? 'just now' : s < 3600 ? Math.round(s / 60) + 'm ago' : s < 86400 ? Math.round(s / 3600) + 'h ago' : Math.round(s / 86400) + 'd ago'; };
const tstr = iso => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// ---------------------------------------------------------------- palette (same entity, same color everywhere)
const HOLD = [
  { k: 'Cash', g: 'CASH', c: '#8a95a6', src: 'sec' },
  { k: 'IVV', g: 'INDEX', c: '#1baf7a' }, { k: 'S&P 500 Index (401k)', g: 'INDEX', c: '#0f8a5f' }, { k: 'FQAL', g: 'INDEX', c: '#6fd3a8' }, { k: 'UPRO', g: 'INDEX', c: '#0b6e4f' },
  { k: 'GOOG', g: 'BIG TECH', c: '#2a78d6' }, { k: 'MSFT', g: 'BIG TECH', c: '#0ea5e9' }, { k: 'META', g: 'BIG TECH', c: '#3554d1' }, { k: 'PLTR', g: 'BIG TECH', c: '#7c7ff5' }, { k: 'SNAP', g: 'BIG TECH', c: '#93b4e8' },
  { k: 'SFM', g: 'OTHER STOCKS', c: '#8fc31f' }, { k: 'XOM', g: 'OTHER STOCKS', c: '#b07a1e' }, { k: 'IRDM', g: 'OTHER STOCKS', c: '#6b7c9c' }, { k: 'GLD, USO, options', g: 'OTHER STOCKS', c: '#b5a796', from: ['GLD', 'USO', 'ZNGA option'] },
  { k: 'Bitcoin', g: 'CRYPTO', c: '#f7931a', src: 'sec' }, { k: 'Monad', g: 'CRYPTO', c: '#e04fb3', src: 'sec' }, { k: 'Solana', g: 'CRYPTO', c: '#9b4dff', src: 'sec' }, { k: 'NFTs', g: 'CRYPTO', c: '#ff4d5e', src: 'sec' },
];
const GROUPS = ['CRYPTO', 'BIG TECH', 'INDEX', 'OTHER STOCKS', 'CASH'];
const TYPES = [{ k: 'ROTH IRA', c: '#0f8a5f' }, { k: '401(k)', c: '#f7931a' }, { k: 'Brokerage', c: '#2a78d6' }, { k: 'Cryptocurrency', c: '#9b4dff' }, { k: 'NFT', c: '#ff4d5e' }];
const CARD_C = ['#2a78d6', '#1baf7a', '#ff8a3d', '#8a95a6'];
const CAT_GROUPS = [
  { k: 'Travel', from: ['Travel'], c: '#2a78d6' }, { k: 'Dining', from: ['Dining'], c: '#ff8a3d' }, { k: 'Groceries', from: ['Groceries'], c: '#1baf7a' },
  { k: 'Shopping', from: ['Shopping'], c: '#ffc53d' }, { k: 'Transportation', from: ['Transportation'], c: '#f08bb4' }, { k: 'Entertainment', from: ['Entertainment'], c: '#2fae2f' },
  { k: 'Subscriptions & bills', from: ['Subscriptions', 'Bills & Utilities'], c: '#7c6cf0' }, { k: 'Foreign transaction fees', from: ['Foreign transaction fees', 'Fees & Interest'], c: '#ff4d5e' },
  { k: 'Health & other', from: ['Health', 'Other'], c: '#8a95a6' },
];
const C = { ink3: '#5d6878', grid: '#121821', line: '#1a2029', panel: '#0a0d12', ink: '#d9e0ea', ink2: '#9aa6b6', amber: '#ffb020', sec: '#3a8de6', cash: '#8a95a6' };

// ---------------------------------------------------------------- state
const WIDE = matchMedia('(min-width: 761px)').matches;
let S = Object.assign({ from: null, to: null, preset: '12', inv: 'sector', liab: 'cat', hidden: {}, x: { pos: false, expo: WIDE, wal: false } }, LS.get('bt-view', {}));
let Q = LS.get('bt-quotes', null);
let D = LS.get('bt-state', null);
let M = [], N = 0, NM = 0, X = {};

function derive() {
  if (!D || !D.months) return false;
  const months = D.months.slice();
  const L = D.live;
  const hasNow = !!(L && L.asof && new Date(L.asof) > monthEnd(months[months.length - 1]));
  NM = months.length;
  M = hasNow ? months.concat(['NOW']) : months;
  N = M.length;
  const ext = (arr, v) => hasNow ? (arr || Array(NM).fill(0)).concat([v || 0]) : (arr || Array(NM).fill(0));
  const sumAt = (obj, i) => Object.values(obj || {}).reduce((s, a) => s + (a[i] || 0), 0);
  X.cash = ext(months.map((_, i) => sumAt(D.cash, i)), L && L.cash);
  X.liab = ext(months.map((_, i) => sumAt(D.liab, i)), L && L.liab);
  X.type = {}; TYPES.forEach(t => { X.type[t.k] = ext(D.type[t.k], L && L.type && L.type[t.k]); });
  X.sec = HOLD.map(h => {
    let arr;
    if (h.src === 'sec') arr = ext(D.sec[h.k], L && L.sec && L.sec[h.k]);
    else if (h.from) arr = ext(months.map((_, i) => h.from.reduce((s, f) => s + ((D.tickers[f] || [])[i] || 0), 0)), 0);
    else arr = ext(D.tickers[h.k], L && L.tickers && L.tickers[h.k]);
    return Object.assign({}, h, { data: arr });
  });
  X.secT = M.map((_, i) => TYPES.reduce((s, t) => s + (X.type[t.k][i] || 0), 0));
  X.wc = X.cash.map((c, i) => c - X.liab[i]);
  X.nw = X.cash.map((c, i) => c + X.secT[i] - X.liab[i]);
  X.cards = Object.keys(D.liab || {}).map((k, i) => ({ k: k === 'Returned Signing Bonus' ? 'Other (signing bonus)' : k, c: CARD_C[i] || '#8a95a6', data: D.liab[k] }));
  X.cats = D.liabCats ? CAT_GROUPS.map(g => ({ k: g.k, c: g.c, data: months.map((_, j) => { const vals = g.from.map(f => (D.liabCats[f] || [])[j]); return vals.every(v => v == null) ? null : vals.reduce((s, v) => s + (v || 0), 0); }) })) : null;
  X.catStart = X.cats ? months.findIndex((_, j) => X.cats.some(c => c.data[j] != null)) : -1;
  X.hasNow = hasNow;
  return true;
}

function applyPreset() {
  if (!S.preset) { S.from = Math.min(S.from ?? 0, N - 1); S.to = Math.min(S.to ?? N - 1, N - 1); return; }
  S.to = N - 1;
  const p = S.preset;
  if (p === 'all') S.from = 0;
  else if (p === 'ytd') { const y = D.months[NM - 1].split('-')[1]; S.from = Math.max(0, M.indexOf('Jan-' + y)); }
  else S.from = Math.max(0, N - (+p));
}
const saveView = () => LS.set('bt-view', { preset: S.preset, from: S.from, to: S.to, inv: S.inv, liab: S.liab, hidden: S.hidden, x: S.x });
const PRESET_NAME = { '3': '3M', '6': '6M', '12': '1Y', ytd: 'YTD', '36': '3Y', all: 'ALL' };

// ---------------------------------------------------------------- charts
Chart.defaults.font.family = '"IBM Plex Mono", ui-monospace, monospace';
Chart.defaults.color = C.ink3;
const charts = {};
const TOUCH = matchMedia('(hover: none)').matches;
// Phones: callouts open only on a tap (never while scrolling), a second tap on the same bar closes it,
// and tapping anywhere outside the chart closes it. Runs after Chart.js's own tooltip handling.
const tapToggle = {
  id: 'tapToggle',
  afterEvent(chart, args) {
    const e = args.event;
    if (!TOUCH || e.type !== 'click') return;
    const act = chart.tooltip.getActiveElements();
    const key = act.length ? String(act[0].index) : null;
    if (chart.$pinned != null && chart.$pinned === key) { clearTip(chart); args.changed = true; }
    else chart.$pinned = key;
  },
};
function clearTip(chart) {
  chart.$pinned = null;
  chart.setActiveElements([]);
  chart.tooltip.setActiveElements([], { x: 0, y: 0 });
}
function upsert(id, cfgc) {
  if (charts[id]) charts[id].destroy();
  cfgc.options = cfgc.options || {};
  if (TOUCH) cfgc.options.events = ['click'];
  cfgc.plugins = (cfgc.plugins || []).concat([tapToggle]);
  charts[id] = new Chart($(id), cfgc);
}
document.addEventListener('click', e => {
  Object.values(charts).forEach(c => { if (c && c.canvas !== e.target && (c.tooltip.getActiveElements() || []).length) { clearTip(c); c._lastEvent = null; c.render(); } });
});
function baseOpts(stacked) {
  return {
    responsive: true, maintainAspectRatio: false, animation: { duration: 200 }, layout: { padding: { right: 8 } },
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false }, tooltip: {
      backgroundColor: '#0f1319', titleColor: C.amber, bodyColor: C.ink, borderColor: C.line, borderWidth: 1, padding: 10, boxPadding: 4, usePointStyle: true,
      titleFont: { weight: '600' }, bodyFont: { size: 11 }, footerFont: { size: 11, weight: '600' }, footerColor: C.amber,
      itemSort: (a, b) => (b.raw || 0) - (a.raw || 0),
      filter: it => it.raw !== 0 && it.raw !== null,
      callbacks: { label: c => ` ${c.dataset.label}: ${fmt(c.raw)}`, footer: items => stacked && items.length > 1 ? 'TOTAL ' + fmt(items.reduce((s, i) => s + (i.raw || 0), 0)) : '' } } },
    scales: {
      x: { stacked, grid: { display: false }, border: { color: C.line }, ticks: { font: { size: 10 }, maxRotation: 0, autoSkipPadding: 14 } },
      y: { stacked, grid: { color: C.grid }, border: { display: false }, ticks: { font: { size: 10 }, callback: v => fmtK(v), maxTicksLimit: 6 } },
    },
  };
}
function legend(el, items, key) {
  const groups = {};
  items.forEach(it => (groups[it.g || ''] = groups[it.g || ''] || []).push(it));
  el.innerHTML = Object.entries(groups).map(([g, arr]) => `<div class="grp${g ? ' boxed' : ''}">${g ? `<b>${g}</b>` : ''}${arr.map(it =>
    `<button type="button" data-k="${it.k}" aria-pressed="${!S.hidden[key + ':' + it.k]}"><span class="sw" style="background:${it.c}"></span>${it.k}</button>`).join('')}</div>`).join('');
  el.querySelectorAll('button').forEach(b => b.onclick = () => { const id = key + ':' + b.dataset.k; S.hidden[id] = !S.hidden[id]; saveView(); render(); });
}
const vis = (key, k) => !S.hidden[key + ':' + k];

// ---------------------------------------------------------------- render
function render() {
  if (!derive()) return;
  applyPreset();
  const a = S.from, b = S.to, idx = [...Array(b - a + 1)].map((_, i) => a + i);
  const labels = idx.map(i => lab(M[i]));
  const sl = arr => idx.map(i => arr[i] || 0);
  const barMax = idx.length <= 6 ? 80 : idx.length <= 12 ? 54 : idx.length <= 24 ? 30 : 16;
  const bar = { maxBarThickness: barMax, categoryPercentage: .72, barPercentage: .92, borderRadius: 1 };

  // selects + presets
  const fs = $('from'), ts = $('to');
  if (fs.options.length !== N) { fs.innerHTML = ''; ts.innerHTML = ''; M.forEach((m, i) => { fs.add(new Option(lab(m), i)); ts.add(new Option(lab(m), i)); }); }
  fs.value = a; ts.value = b;
  document.querySelectorAll('#presets button').forEach(x => x.setAttribute('aria-pressed', x.dataset.p === S.preset));
  $('range-label').textContent = `${S.preset ? PRESET_NAME[S.preset] + ' · ' : ''}${lab(M[a])} → ${lab(M[b])}`;
  applyX();

  // KPIs
  const K = [{ l: 'NET WORTH', v: X.nw, hero: true }, { l: 'INVESTMENTS', v: X.secT }, { l: 'CASH ON HAND', v: X.cash }, { l: 'CURRENT LIABILITIES', v: X.liab, inv: true }, { l: 'WORKING CAPITAL', v: X.wc }];
  $('kpis').innerHTML = K.map(k => {
    const d = k.v[b] - k.v[a], p = pctS(k.v[b], k.v[a]);
    const good = k.inv ? d <= 0 : d >= 0;
    const c = a === b ? '&nbsp;' : `<span class="${d === 0 ? 'flat' : good ? 'up' : 'down'}">${d >= 0 ? '+' : '-'}${fmtK(Math.abs(d)).replace('-', '')}${p === null || !isFinite(p) ? '' : ` (${p >= 0 ? '+' : ''}${p.toFixed(1)}%)`}</span><span class="vs"> vs ${lab(M[a])}</span>`;
    return `<div class="kpi${k.hero ? ' hero' : ''}"><span class="lab">${k.l}</span><span class="val">${fmt(k.v[b])}</span><span class="chg">${c}</span></div>`;
  }).join('');

  // Assets
  const A = [{ k: 'Total securities', c: C.sec, data: X.secT }, { k: 'Cash', c: C.cash, data: X.cash }];
  legend($('lg-assets'), A, 'as');
  upsert('c-assets', { type: 'bar', data: { labels, datasets: A.filter(s => vis('as', s.k)).map(s => Object.assign({ label: s.k, data: sl(s.data), backgroundColor: s.c }, bar)) }, options: baseOpts(true) });

  // Working capital
  const WC = { k: 'Cash less current liabilities', c: C.sec };
  legend($('lg-wc'), [WC], 'wc');
  upsert('c-wc', { type: 'bar', data: { labels, datasets: vis('wc', WC.k) ? [Object.assign({ label: WC.k, data: sl(X.wc), backgroundColor: WC.c }, bar)] : [] }, options: baseOpts(false) });

  // Investments
  const set = S.inv === 'sector' ? X.sec.filter(s => idx.some(i => s.data[i])) : TYPES.map(t => Object.assign({}, t, { data: X.type[t.k] })).filter(s => idx.some(i => s.data[i]));
  const key = 'inv-' + S.inv;
  legend($('lg-inv'), set, key);
  document.querySelectorAll('#inv-mode button').forEach(x => x.setAttribute('aria-pressed', x.dataset.m === S.inv));
  upsert('c-inv', { type: 'line', data: { labels, datasets: set.filter(s => vis(key, s.k)).map(s => ({ label: s.k, data: sl(s.data), borderColor: s.c, backgroundColor: s.c + 'bb', fill: true, borderWidth: 1.2, pointRadius: 0, pointHoverRadius: 3, tension: .15 })) }, options: baseOpts(true) });

  // Exposure
  $('tbl-month').textContent = '@ ' + (M[b] === 'NOW' ? 'NOW · ' + tstr(D.live.asof) : longLab(M[b]).toUpperCase());
  const totB = X.sec.reduce((s, x) => s + (x.data[b] || 0), 0), totA = X.sec.reduce((s, x) => s + (x.data[a] || 0), 0);
  const held = GROUPS.flatMap(g => X.sec.filter(s => s.g === g && (s.data[b] || s.data[a])).sort((x, y) => (y.data[b] || 0) - (x.data[b] || 0)));
  const pie = held.filter(s => s.data[b] > 0);
  $('pie-total').textContent = fmt(totB);
  upsert('c-pie', { type: 'doughnut', data: { labels: pie.map(s => s.k), datasets: [{ data: pie.map(s => s.data[b]), backgroundColor: pie.map(s => s.c), borderColor: C.panel, borderWidth: 2, hoverOffset: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '64%', animation: { duration: 200 }, plugins: { legend: { display: false }, tooltip: Object.assign({}, baseOpts(false).plugins.tooltip, { callbacks: { label: c => ` ${c.label}: ${fmt(c.raw)} (${(c.raw / totB * 100).toFixed(1)}%)` } }) } } });
  let rows = '';
  for (const g of GROUPS) {
    const items = held.filter(s => s.g === g); if (!items.length) continue;
    const gb = items.reduce((s, x) => s + (x.data[b] || 0), 0), ga = items.reduce((s, x) => s + (x.data[a] || 0), 0);
    rows += `<tr class="sub"><td>${g}</td><td class="gv">${fmt(gb)}</td><td class="gv">${totB ? (gb / totB * 100).toFixed(1) : 0}%</td><td class="gv">${chg(gb - ga)}</td></tr>`;
    for (const s of items) {
      let last = -1; for (let i = b; i >= a; i--) { if (s.data[i]) { last = i; break; } }
      const sold = !s.data[b] && last >= 0 && last < b;
      rows += `<tr${sold ? ' class="sold"' : ''}><td><span class="sw" style="background:${s.c};margin-right:8px"></span>${s.k}</td><td>${sold ? '–' : fmt(s.data[b])}</td><td>${sold ? '–' : (totB ? (s.data[b] / totB * 100).toFixed(1) : 0) + '%'}</td><td>${sold ? `<span class="pill">SOLD AFTER ${lab(M[last]).toUpperCase()}</span>` : chg((s.data[b] || 0) - (s.data[a] || 0))}</td></tr>`;
    }
  }
  rows += `<tr class="tot"><td>TOTAL</td><td>${fmt(totB)}</td><td>100%</td><td>${chg(totB - totA)}</td></tr>`;
  $('tbl').innerHTML = `<thead><tr><th>HOLDING</th><th>VALUE</th><th>SHARE</th><th>CHG SINCE ${lab(M[a]).toUpperCase()}</th></tr></thead><tbody>${rows}</tbody>`;

  // Liabilities (monthly only; no NOW column)
  const lb = Math.min(b, NM - 1), la = Math.min(a, lb), lidx = [...Array(lb - la + 1)].map((_, i) => la + i);
  const byCat = X.cats && S.liab === 'cat';
  $('liab-mode').innerHTML = X.cats ? `<button data-m="cat" aria-pressed="${S.liab === 'cat'}">BY CATEGORY</button><button data-m="card" aria-pressed="${S.liab === 'card'}">BY CARD</button>` : '';
  $('liab-mode').querySelectorAll('button').forEach(x => x.onclick = () => { S.liab = x.dataset.m; saveView(); render(); });
  const LSr = (byCat ? X.cats : X.cards).filter(s => lidx.some(i => s.data[i]));
  const note = $('liab-note');
  if (byCat && la < X.catStart) { note.hidden = false; note.textContent = `Plaid transaction history starts ${longLab(D.months[X.catStart])}, so earlier months are empty in this view.`; } else note.hidden = true;
  legend($('lg-liab'), LSr, 'li-' + S.liab);
  const lo = baseOpts(true); lo.scales.y.min = 0;
  upsert('c-liab', { type: 'bar', data: { labels: lidx.map(i => lab(M[i])), datasets: LSr.filter(s => vis('li-' + S.liab, s.k)).map(s => Object.assign({ label: s.k, data: lidx.map(i => byCat ? s.data[i] : (s.data[i] || 0)), backgroundColor: s.c }, bar)) }, options: lo });

  renderLive();
  saveView();
}

// Small inline marks for wallet providers (own drawings, not official artwork).
const ICON = {
  phantom: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect width="20" height="20" rx="5" fill="#ab9ff2"/><path d="M4.5 13.2c0-4.3 2.6-7.4 5.8-7.4 3.1 0 5.2 2.6 5.2 5.6 0 3-1.6 4.8-2.7 4.8-.6 0-.8-.5-.8-.9-.4.6-1 .9-1.6.9-.6 0-1-.4-1.1-.8-.4.5-1 .8-1.6.8-.9 0-1.4-.6-1.4-1.3 0-.7.4-1.2.4-1.7z" fill="#fff"/><circle cx="10.6" cy="10.2" r=".9" fill="#ab9ff2"/><circle cx="13.2" cy="10.2" r=".9" fill="#ab9ff2"/></svg>',
  backpack: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect width="20" height="20" rx="5" fill="#e33e3f"/><path d="M7.6 6.2V5.4a2.4 2.4 0 0 1 4.8 0v.8" stroke="#fff" stroke-width="1.4" fill="none"/><rect x="5.2" y="6.2" width="9.6" height="9.4" rx="2.4" fill="#fff"/><rect x="7.4" y="10.4" width="5.2" height="2.6" rx=".8" fill="#e33e3f"/></svg>',
  coinbase: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect width="20" height="20" rx="5" fill="#1652f0"/><circle cx="10" cy="10" r="5.2" fill="#fff"/><rect x="8.2" y="8.2" width="3.6" height="3.6" rx=".6" fill="#1652f0"/></svg>',
  nft: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect width="20" height="20" rx="5" fill="#3a1820"/><path d="M10 4.2l5 2.9v5.8l-5 2.9-5-2.9V7.1z" fill="none" stroke="#ff4d5e" stroke-width="1.4"/></svg>',
  bot: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect width="20" height="20" rx="5" fill="#1d2a3a"/><rect x="5" y="7" width="10" height="7.5" rx="2" fill="#3ab7ff"/><circle cx="8.2" cy="10.6" r="1" fill="#1d2a3a"/><circle cx="11.8" cy="10.6" r="1" fill="#1d2a3a"/><rect x="9.4" y="4.4" width="1.2" height="2.6" fill="#3ab7ff"/></svg>',
};
function walletLabel(r) {
  const L = r.label;
  let m = L.match(/^(Phantom|Backpack)\s*(\d+)\s*\(([^)]+)\)(.*)$/i);
  if (m) {
    const stake = /stake/i.test(m[4]);
    const n2 = (m[4].match(/stake\s*(\d+)/i) || [])[1];
    return `<span class="wl">${ICON[m[1].toLowerCase()]}<span>${m[2]} <span class="tail">· ${m[3]}</span></span>${stake ? `<span class="badge stake" title="Staked">STAKE${n2 ? ' ' + n2 : ''}</span>` : ''}</span>`;
  }
  if (/^NFT\s+/i.test(L)) return `<span class="wl">${ICON.nft}<span>NFT · ${L.replace(/^NFT\s+/i, '')}</span></span>`;
  if (/^Coinbase/i.test(L)) return `<span class="wl">${ICON.coinbase}<span>Coinbase <span class="tail">· ${L.replace(/^Coinbase\s*/i, '')}</span></span></span>`;
  if (/TG Bots/i.test(L)) return `<span class="wl">${ICON.bot}<span>Telegram bots</span><span class="badge manual">MANUAL</span></span>`;
  return `<span class="wl"><span>${L}</span></span>`;
}

function renderLive() {
  const L = D.live;
  const hold = (D.holdings || []);
  const refDate = hold[0] && hold[0].ref_date ? new Date(hold[0].ref_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() : 'MONTH END';
  // Positions (value first so it shows on a phone)
  const P = (L && L.holdings) || hold.map(h => ({ account: h.account, ticker: h.ticker, shares: h.shares, price: h.ref_price, value: h.ref_value }));
  const refP = Object.fromEntries(hold.map(h => [h.ticker, h.ref_price]));
  const color = Object.fromEntries(HOLD.map(h => [h.k, h.c])); color.IBIT = '#f7931a';
  const ps = P.slice().sort((x, y) => y.value - x.value);
  let tot = 0, totRef = 0;
  const pr = ps.map(p => {
    const ref = refP[p.ticker] || p.price; const dv = (p.price - ref) * p.shares; tot += p.value; totRef += ref * p.shares;
    const pct = p.price / ref * 100 - 100;
    return `<tr><td><span class="sw" style="background:${color[p.ticker] || '#8a95a6'};margin-right:8px"></span>${p.ticker}${p.stale ? '<span class="tag-stale">STALE</span>' : ''}</td><td class="usd">${fmt(p.value)}</td><td class="${cls(dv)}">${(pct >= 0 ? '+' : '') + pct.toFixed(2)}%</td><td>${chg(dv)}</td><td class="hide-sm">${p.account}</td><td class="hide-sm">${Number(p.shares).toLocaleString('en-US', { maximumFractionDigits: 4 })}</td><td class="hide-sm">${fmt2(p.price)}</td></tr>`;
  }).join('');
  $('pos-asof').textContent = L ? '· ' + tstr(L.asof) : '· month-end values';
  $('pos').innerHTML = `<thead><tr><th>TICKER</th><th>VALUE</th><th>% VS ${refDate}</th><th>P/L</th><th class="hide-sm">ACCOUNT</th><th class="hide-sm">SHARES</th><th class="hide-sm">LAST</th></tr></thead><tbody>${pr}<tr class="tot"><td>TOTAL</td><td>${fmt(tot)}</td><td></td><td>${chg(tot - totRef)}</td><td class="hide-sm"></td><td class="hide-sm"></td><td class="hide-sm"></td></tr></tbody>`;

  // Wallets: highest USD first
  const W = ((L && L.crypto) || []).filter(Boolean);
  $('wal-asof').textContent = L ? '· ' + tstr(L.asof) : '· refresh to read wallets';
  const ws = W.slice().sort((x, y) => (y.usd || 0) - (x.usd || 0));
  const wt = ws.reduce((s, r) => s + (r.usd || 0), 0);
  const short = n => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : n >= 1 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : n.toFixed(4);
  const amt = r => r.asset === 'USD' ? '–' : `${short(Number(r.amount))}<small>${r.asset}</small>`;
  $('wal').innerHTML = ws.length ? `<thead><tr><th>WALLET</th><th>AMOUNT</th><th class="hide-sm">PRICE</th><th>USD</th></tr></thead><tbody>${ws.map(r =>
    `<tr><td>${walletLabel(r)}${r.stale ? '<span class="tag-stale">STALE</span>' : ''}</td><td class="amt">${amt(r)}</td><td class="hide-sm">${r.asset === 'USD' ? '–' : fmt2(r.price)}</td><td class="usd">${fmt(r.usd)}</td></tr>`).join('')}<tr class="tot"><td>TOTAL</td><td></td><td class="hide-sm"></td><td>${fmt(wt)}</td></tr></tbody>` : '<tbody><tr><td>No wallet read yet. Use Refresh.</td></tr></tbody>';

  renderTape();
  renderTree();
  renderStatus();
  const sheet = (D.sheets || [])[0];
  $('foot').innerHTML = `History through ${longLab(D.months[NM - 1])}${D.updated_at ? ' · full update ' + tstr(D.updated_at) : ''}${D.restored_from ? ' · restored from ' + D.restored_from : ''}${sheet ? ` · last sheet: <a href="${sheet.url}" target="_blank" rel="noopener">${sheet.name}</a>` : ''}`;
}

let busyText = null;
function renderLoading() {
  const job = D && D.jobs && D.jobs.full && ['running', 'cancel_requested'].includes(D.jobs.full.status);
  document.querySelectorAll('.panel, .kpi').forEach(el => {
    const on = job || (busyText && el.id !== 'p-liab');
    el.classList.toggle('loading', !!on);
  });
}
function renderStatus() {
  renderLoading();
  const st = $('status');
  st.className = 'updated';
  if (busyText) { st.classList.add('busy'); $('status-text').textContent = busyText; }
  else {
    const L = D && D.live;
    const when = [L && L.asof, D && D.updated_at].filter(Boolean).sort().pop();
    if (when) { st.classList.add((Date.now() - new Date(when)) < 60 * 60 * 1000 ? 'fresh' : 'old'); $('status-text').textContent = tstr(when).toUpperCase(); }
    else $('status-text').textContent = D ? 'MONTH-END ' + longLab(D.months[NM - 1]).toUpperCase() : '—';
  }
  const j = D && D.jobs && D.jobs.full;
  const jc = $('jobs');
  if (j && j.status) {
    const a = ago(j.finished_at || j.requested_at).toUpperCase();
    const m = {
      queued: ['q', 'MAC UPDATE QUEUED ' + ago(j.requested_at).toUpperCase(), 'MAC QUEUED', true],
      running: ['run', 'MAC UPDATING · ' + (j.message || '').toUpperCase(), 'MAC UPDATING…', true],
      cancel_requested: ['q', 'STOPPING ON THE MAC…', 'STOPPING…', false],
      cancelled: ['err', 'MAC UPDATE CANCELLED · NOTHING CHANGED', 'MAC CANCELLED', false],
      done: ['ok', 'MAC UPDATE DONE ' + a, 'MAC DONE ' + a, false],
      error: ['err', 'MAC UPDATE FAILED · ' + (j.message || '').toUpperCase(), 'MAC FAILED', false],
    }[j.status] || ['q', String(j.status).toUpperCase(), String(j.status).toUpperCase(), false];
    jc.innerHTML = `<span class="chip ${m[0]}" title="${(j.message || '').replace(/"/g, '&quot;')}"><span class="long">${m[1]}</span><span class="short">${m[2]}</span>${m[3] ? '<button class="x" id="job-cancel" type="button">CANCEL</button>' : ''}</span>`;
    const x = $('job-cancel'); if (x) x.onclick = cancelFull;
  } else jc.innerHTML = '';
}

// ---------------------------------------------------------------- actions
let toastT = null;
function toast(html, ms) { const t = $('toast'); t.innerHTML = html; t.hidden = false; clearTimeout(toastT); if (ms !== 0) toastT = setTimeout(() => { t.hidden = true; }, ms || 4000); }
function busy(on, text) { $('btn-menu').disabled = on; busyText = on ? text : null; if (D) renderStatus(); }

// ---------------------------------------------------------------- expanders (tap a chart to see its table)
function applyX() {
  Object.entries(S.x).forEach(([k, open]) => {
    const body = $('x-' + k); if (body) body.hidden = !open;
    document.querySelectorAll(`.expander[data-x="${k}"]`).forEach(b => b.setAttribute('aria-expanded', String(!!open)));
  });
  const hint = document.querySelector('.donut .hint'); if (hint) hint.textContent = S.x.expo ? 'TAP TO HIDE TABLE' : 'TAP FOR TABLE';
}
document.querySelectorAll('[data-x]').forEach(el => {
  const go = () => { const k = el.dataset.x; S.x[k] = !S.x[k]; applyX(); saveView(); if (S.x[k]) setTimeout(() => $('x-' + k).scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50); };
  el.addEventListener('click', go);
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
});

// ---------------------------------------------------------------- ticker tape: always today's prices
function renderTape() {
  let items = [];
  if (Q && Q.items && Q.items.length) items = Q.items.map(i => [i.s, i.price, i.pct]);
  else if (D && D.live) {
    const hold = D.holdings || [];
    const refP = Object.fromEntries(hold.map(h => [h.ticker, h.ref_price]));
    const cRef = (D.crypto && D.crypto.ref_prices) || {};
    const cp = D.live.cprices || {};
    ['BTC', 'SOL', 'MON'].forEach(k => { if (cp[k]) items.push([k, cp[k], cRef[k] ? (cp[k] / cRef[k] - 1) * 100 : null]); });
    Object.keys(refP).forEach(t => { const p = (D.live.prices || {})[t]; if (p) items.push([t, p, (p / refP[t] - 1) * 100]); });
  }
  const sign = d => d == null ? '' : `<span class="${cls(d)}">${d >= 0 ? '+' : '-'}${Math.abs(d).toFixed(2)}%</span>`;
  const html = items.map(([k, p, d]) => `<span><b>${k}</b>${p < 1 ? p.toFixed(4) : p.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${sign(d)}</span>`).join('');
  $('tape').innerHTML = html + html;
}
async function loadQuotes() {
  if (!cfg().key) return;
  try { const r = await api({ action: 'quotes' }); Q = r.quotes; LS.set('bt-quotes', Q); renderTape(); } catch (e) {}
}
$('tape-btn').onclick = () => {
  if (!Q) { toast('Prices are from the last refresh. Today\'s prices load when the app can reach your API.'); return; }
  const st = (Q.items || []).find(i => i.basis === 'day' && i.time);
  toast(`Fetched ${tstr(Q.asof)}.<br>Stocks: last trade ${st ? tstr(st.time) : 'n/a'}, change vs the prior close.<br>Crypto: live price, change over the last 24 hours.`, 7000);
};

// ---------------------------------------------------------------- wallet map (squarified treemap)
function squarify(items, x, y, w, h) {
  const out = []; let rest = items.slice(); const total = rest.reduce((s, i) => s + i.v, 0); if (!total) return out;
  const scale = w * h / total; rest = rest.map(i => Object.assign({}, i, { a: i.v * scale }));
  const worst = (row, side) => { const s = row.reduce((t, r) => t + r.a, 0); const mx = Math.max(...row.map(r => r.a)), mn = Math.min(...row.map(r => r.a)); return Math.max(side * side * mx / (s * s), (s * s) / (side * side * mn)); };
  while (rest.length) {
    const side = Math.min(w, h); let row = [rest[0]]; let i = 1;
    while (i < rest.length && worst(row.concat([rest[i]]), side) <= worst(row, side)) { row.push(rest[i]); i++; }
    rest = rest.slice(i);
    const s = row.reduce((t, r) => t + r.a, 0);
    if (w >= h) { const cw = s / h; let cy = y; row.forEach(r => { const ch = r.a / cw; out.push(Object.assign(r, { x, y: cy, w: cw, h: ch })); cy += ch; }); x += cw; w -= cw; }
    else { const ch = s / w; let cx = x; row.forEach(r => { const cw2 = r.a / ch; out.push(Object.assign(r, { x: cx, y, w: cw2, h: ch })); cx += cw2; }); y += ch; h -= ch; }
  }
  return out;
}
function walletShort(r) {
  const m = r.label.match(/^(Phantom|Backpack)\s*(\d+)\s*\(([^)]+)\)(.*)$/i);
  if (m) return { icon: ICON[m[1].toLowerCase()], text: `${m[2]} · ${m[3]}${/stake/i.test(m[4]) ? ' STAKE' : ''}` };
  if (/^NFT\s+/i.test(r.label)) return { icon: ICON.nft, text: 'NFT · ' + r.label.replace(/^NFT\s+/i, '') };
  if (/^Coinbase/i.test(r.label)) return { icon: ICON.coinbase, text: r.label.replace(/^Coinbase\s*/i, 'CB ') };
  if (/TG Bots/i.test(r.label)) return { icon: ICON.bot, text: 'TG bots' };
  return { icon: '', text: r.label };
}
const SECTOR_C = { Solana: '#7b3fe0', Monad: '#c23b97', Bitcoin: '#d97a10', NFTs: '#d43a4a' };
function renderTree() {
  const el = $('tree'); if (!el) return;
  const W = ((D.live && D.live.crypto) || []).filter(r => r && r.usd > 0);
  if (!W.length) { el.innerHTML = '<div class="tile" style="inset:0;border:0;color:var(--ink-3)">Refresh to read wallets.</div>'; return; }
  const total = W.reduce((s, r) => s + r.usd, 0);
  const big = W.filter(r => r.usd / total >= .012).sort((a, b) => b.usd - a.usd);
  const small = W.filter(r => r.usd / total < .012);
  const items = big.map(r => ({ v: r.usd, r }));
  if (small.length) items.push({ v: small.reduce((s, r) => s + r.usd, 0), other: small });
  const qp = Object.fromEntries(((Q && Q.items) || []).map(i => [i.s, i.pct]));
  const rect = el.getBoundingClientRect();
  const tiles = squarify(items, 0, 0, rect.width || 600, rect.height || 300);
  el.innerHTML = tiles.map(t => {
    const area = t.w * t.h, size = area < 3500 ? (area < 1500 ? ' small tiny' : ' small') : '';
    if (t.other) return `<div class="tile${size}" style="left:${t.x}px;top:${t.y}px;width:${t.w}px;height:${t.h}px;background:#2a3140"><span class="t1">+${t.other.length} small</span><span class="t2">${fmtK(t.v)}</span><span class="t3">${(t.v / total * 100).toFixed(1)}%</span></div>`;
    const r = t.r, ws = walletShort(r), d = qp[r.asset];
    return `<div class="tile${size}" style="left:${t.x}px;top:${t.y}px;width:${t.w}px;height:${t.h}px;background:${SECTOR_C[r.sector] || '#3a4250'}" title="${r.label}: ${fmt(r.usd)}"><span class="t1">${ws.icon}${ws.text}</span><span class="t2">${fmtK(r.usd)}</span><span class="t3">${(r.usd / total * 100).toFixed(1)}%${d != null ? ` · ${d >= 0 ? '+' : '-'}${Math.abs(d).toFixed(1)}% 24h` : ''}</span></div>`;
  }).join('');
}
if ('ResizeObserver' in window) new ResizeObserver(() => { if (D && D.live) renderTree(); }).observe($('tree'));
async function load(quiet) {
  try { const prevJob = D && D.jobs && D.jobs.full && D.jobs.full.status; const r = await api({ action: 'data' }); D = r.state;
    const nowJob = D.jobs && D.jobs.full && D.jobs.full.status;
    if (prevJob && ['queued', 'running', 'cancel_requested'].includes(prevJob) && nowJob && nowJob !== prevJob && ['done', 'error', 'cancelled'].includes(nowJob)) toast('Mac update ' + (nowJob === 'done' ? 'finished: ' : nowJob + ': ') + (D.jobs.full.message || ''), 8000); LS.set('bt-state', D); render(); pollJob(); }
  catch (e) { if (!quiet) toast(e.message, 6000); if (D) render(); }
}
function apply(state) { D = state; LS.set('bt-state', D); if (S.preset) S.to = null; render(); }

async function quickRefresh() {
  const t0 = Date.now();
  busy(true, 'REFRESHING…');
  try {
    const r = await api({ action: 'refresh' });
    apply(r.state);
    toast(`Refreshed in ${((Date.now() - t0) / 1000).toFixed(1)}s${(D.live.stale || []).length ? ' · stale: ' + D.live.stale.join(', ') : ''}`);
  } catch (e) { toast('Refresh failed: ' + e.message, 7000); }
  finally { busy(false); }
}

// Refresh + save sheet: refresh first, then save only if nobody pressed Cancel in between.
let saveCancelled = false;
async function refreshAndSave() {
  saveCancelled = false;
  busy(true, 'REFRESHING, THEN SAVING SHEET…');
  toast('Refreshing prices and wallets… <a href="#" id="t-cancel">Cancel</a>', 0);
  $('t-cancel').onclick = e => { e.preventDefault(); saveCancelled = true; toast('Cancelled. No sheet will be saved.', 4000); };
  try {
    const r = await api({ action: 'refresh' });
    apply(r.state);
    if (saveCancelled) return;
    toast('Saving spreadsheet to Drive…', 0);
    busy(true, 'SAVING SHEET…');
    const s2 = await api({ action: 'save_sheet' });
    apply(s2.state);
    toast(`Saved <a href="${s2.sheet.url}" target="_blank" rel="noopener">${s2.sheet.name}</a> to Drive › Finances › Auto Generated`, 10000);
  } catch (e) { toast('Failed: ' + e.message + '. Your data was not changed.', 8000); }
  finally { busy(false); }
}

async function queueFull() {
  busy(true, 'QUEUEING MAC UPDATE…');
  try { const r = await api({ action: 'queue_full', save: true }); D.jobs = { full: r.job }; LS.set('bt-state', D); toast(r.note || 'Queued. Your Mac starts it within 2 minutes if it is awake. You can cancel until it finishes.', 7000); pollJob(); }
  catch (e) { toast('Could not queue: ' + e.message, 7000); }
  finally { busy(false); }
}
async function cancelFull() {
  try { const r = await api({ action: 'cancel_full' }); D.jobs = { full: r.job }; LS.set('bt-state', D); renderStatus(); toast(r.note || (r.job.status === 'cancelled' ? 'Cancelled before it started. Nothing changed.' : 'Stopping it on the Mac. Nothing is pushed until its last step.'), 6000); pollJob(); }
  catch (e) { toast('Could not cancel: ' + e.message, 7000); }
}
let pollT = null;
function pollJob() {
  clearTimeout(pollT);
  const j = D && D.jobs && D.jobs.full;
  if (j && ['queued', 'running', 'cancel_requested'].includes(j.status)) pollT = setTimeout(() => load(true), 15000);
}

// ---------------------------------------------------------------- two-step confirm
const FLOWS = {
  save: [
    { step: 'STEP 1 OF 2', title: 'REFRESH + SAVE SHEET', ok: 'CONTINUE', body: `
      <p>This does two things:</p>
      <ul><li>Pulls live stock prices, crypto prices and on-chain wallet and stake balances.</li>
      <li>Creates a <b>new spreadsheet</b> in Google Drive › Finances › Auto Generated, with Summary, Holdings, Crypto and History tabs.</li></ul>
      <p class="warn">Bank and card balances are not pulled here. They stay as of the last full update. Nothing in your history changes.</p>` },
    { step: 'STEP 2 OF 2', title: 'CREATE THE SHEET?', ok: 'REFRESH + SAVE', body: `
      <p>A new file named <b>Balances ${new Date().toISOString().slice(0, 10)} … (auto)</b> will be added to Drive. Older sheets are kept.</p>
      <p class="warn">You can still cancel while it refreshes. Once the sheet is being written it can't be stopped, but you can delete the file from Drive.</p>` },
  ],
  full: [
    { step: 'STEP 1 OF 2', title: 'FULL UPDATE · MAC', ok: 'CONTINUE', body: `
      <p>Your Mac (it must be awake, with Chrome open) will ask ChatGPT for your Plaid data:</p>
      <ul><li>Credit card balances and this month's spend by category</li><li>Wells Fargo and other cash balances</li><li>Fidelity positions and cash for Brokerage, Roth IRA and 401(k)</li></ul>
      <p>Then it refreshes crypto, closes last month into the history if it's the first 10 days of a month, and saves a spreadsheet.</p>
      <p class="warn">This changes your bank, card and position numbers. It usually takes 5 to 15 minutes. You get a Telegram message when it starts.</p>` },
    { step: 'STEP 2 OF 2', title: 'QUEUE IT ON THE MAC?', ok: 'QUEUE FULL UPDATE', body: `
      <ul><li>Nothing changes until the very last step. If any number looks wrong (a card or bank total way off, positions off by over 30%), it stops and changes nothing.</li>
      <li>The current version is backed up first. You can restore it under Settings and restore.</li>
      <li>You can cancel from the status chip until it finishes.</li></ul>` },
  ],
};
function confirmFlow(name, onDone) {
  const steps = typeof name === 'string' ? FLOWS[name] : name;
  let i = 0;
  const dlg = $('confirm');
  const show = () => {
    const s = steps[i];
    $('cf-step').textContent = s.step; $('cf-title').textContent = s.title; $('cf-body').innerHTML = s.body; $('cf-ok').textContent = s.ok;
    $('cf-ok').className = 'fn ' + (i === steps.length - 1 ? 'amber' : 'ghost');
  };
  $('cf-ok').onclick = () => { if (i < steps.length - 1) { i++; show(); } else { dlg.close(); onDone(); } };
  $('cf-cancel').onclick = () => dlg.close();
  show();
  dlg.showModal();
}

// ---------------------------------------------------------------- menu
function toggleMenu(open) {
  const m = $('menu'); const b = $('btn-menu');
  const willOpen = open === undefined ? m.hidden : open;
  m.hidden = !willOpen; b.setAttribute('aria-expanded', String(willOpen));
}
$('btn-menu').onclick = e => { e.stopPropagation(); toggleMenu(); };
document.addEventListener('click', e => { if (!e.target.closest('.menu-wrap')) toggleMenu(false); });
$('menu').querySelectorAll('button[data-act]').forEach(b => b.onclick = () => {
  toggleMenu(false);
  const a = b.dataset.act;
  if (a === 'quick') quickRefresh();
  else if (a === 'save') confirmFlow('save', refreshAndSave);
  else if (a === 'full') confirmFlow('full', queueFull);
  else if (a === 'settings') openSettings();
});

// ---------------------------------------------------------------- settings + restore
function openSettings() {
  const c = cfg(); $('set-api').value = c.api; $('set-key').value = c.key;
  if (!$('settings').open) $('settings').showModal();
  loadVersions();
}
async function loadVersions() {
  const box = $('versions');
  if (!cfg().key) { box.innerHTML = '<span class="sub">Connect first.</span>'; return; }
  try {
    const r = await api({ action: 'versions' });
    box.innerHTML = r.versions.length ? r.versions.map(v => `<div class="ver"><span>${tstr(v.created)}<span class="n">${v.note || ''}</span></span><button class="fn ghost" data-id="${v.id}" type="button">RESTORE</button></div>`).join('') : '<span class="sub">No saved versions yet.</span>';
    box.querySelectorAll('button[data-id]').forEach(btn => btn.onclick = () => {
      const v = r.versions.find(x => x.id === btn.dataset.id);
      $('settings').close();
      confirmFlow([
        { step: 'STEP 1 OF 2', title: 'RESTORE A VERSION', ok: 'CONTINUE', body: `<p>Puts your history, bank, card and position numbers back to how they were at <b>${tstr(v.created)}</b>.</p><p class="warn">The current version is backed up first, so you can undo this.</p>` },
        { step: 'STEP 2 OF 2', title: 'RESTORE IT?', ok: 'RESTORE', body: `<p>${v.note || v.name}</p><p>Afterwards, use Refresh to get live prices again.</p>` },
      ], async () => {
        busy(true, 'RESTORING…');
        try { const rr = await api({ action: 'restore', id: v.id }); apply(rr.state); toast('Restored the version from ' + tstr(v.created) + '.', 6000); }
        catch (e) { toast('Restore failed: ' + e.message, 7000); }
        finally { busy(false); }
      });
    });
  } catch (e) { box.innerHTML = `<span class="sub">${e.message}</span>`; }
}
$('settings-form').addEventListener('submit', e => {
  if (e.submitter && e.submitter.value === 'ok') {
    LS.set('bt-api', $('set-api').value.trim()); LS.set('bt-key', $('set-key').value.trim());
    setTimeout(() => load(), 50);
  }
});

// ---------------------------------------------------------------- wiring
$('from').onchange = () => { S.from = +$('from').value; if (S.from > S.to) S.to = S.from; S.preset = null; render(); };
$('to').onchange = () => { S.to = +$('to').value; if (S.to < S.from) S.from = S.to; S.preset = null; render(); };
document.querySelectorAll('#presets button').forEach(x => x.onclick = () => { S.preset = x.dataset.p; render(); toggleRange(false); });
function toggleRange(open) { const p = $('range-pop'); const will = open === undefined ? p.hidden : open; p.hidden = !will; $('range-btn').setAttribute('aria-expanded', String(will)); }
$('range-btn').onclick = e => { e.stopPropagation(); toggleRange(); };
document.addEventListener('click', e => { if (!e.target.closest('.range-wrap')) toggleRange(false); });
document.querySelectorAll('#inv-mode button').forEach(x => x.onclick = () => { S.inv = x.dataset.m; render(); });
document.addEventListener('keydown', e => { if (e.key === 'F5' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); quickRefresh(); } });
const wake = () => { if (!document.hidden) { load(true); loadQuotes(); } };
document.addEventListener('visibilitychange', wake);
window.addEventListener('focus', wake);
window.addEventListener('pageshow', wake);
setInterval(() => { if (!document.hidden) loadQuotes(); }, 5 * 60 * 1000);

if (D) render();
if (!cfg().key) openSettings(); else { load(); loadQuotes(); }
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
