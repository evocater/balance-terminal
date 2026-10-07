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
const fmt2 = v => '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
let S = Object.assign({ from: null, to: null, preset: '12', inv: 'sector', liab: 'cat', hidden: {} }, LS.get('bt-view', {}));
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
const saveView = () => LS.set('bt-view', { preset: S.preset, from: S.from, to: S.to, inv: S.inv, liab: S.liab, hidden: S.hidden });

// ---------------------------------------------------------------- charts
Chart.defaults.font.family = '"IBM Plex Mono", ui-monospace, monospace';
Chart.defaults.color = C.ink3;
const charts = {};
function upsert(id, cfgc) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart($(id), cfgc); }
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

  // KPIs
  const K = [{ l: 'NET WORTH', v: X.nw, hero: true }, { l: 'INVESTMENTS', v: X.secT }, { l: 'CASH ON HAND', v: X.cash }, { l: 'CURRENT LIABILITIES', v: X.liab, inv: true }, { l: 'WORKING CAPITAL', v: X.wc }];
  $('kpis').innerHTML = K.map(k => {
    const d = k.v[b] - k.v[a], p = pctS(k.v[b], k.v[a]);
    const good = k.inv ? d <= 0 : d >= 0;
    const c = a === b ? '&nbsp;' : `<span class="${d === 0 ? 'flat' : good ? 'up' : 'down'}">${d >= 0 ? '+' : '-'}${fmtK(Math.abs(d)).replace('-', '')}${p === null || !isFinite(p) ? '' : ` (${p >= 0 ? '+' : ''}${p.toFixed(1)}%)`}</span> vs ${lab(M[a])}`;
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

function renderLive() {
  const L = D.live;
  const hold = (D.holdings || []);
  const refDate = hold[0] && hold[0].ref_date ? new Date(hold[0].ref_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() : 'MONTH END';
  // Positions
  const P = (L && L.holdings) || hold.map(h => ({ account: h.account, ticker: h.ticker, shares: h.shares, price: h.ref_price, value: h.ref_value }));
  const refP = Object.fromEntries(hold.map(h => [h.ticker, h.ref_price]));
  const color = Object.fromEntries(HOLD.map(h => [h.k, h.c])); color.IBIT = '#f7931a';
  const ps = P.slice().sort((x, y) => y.value - x.value);
  let tot = 0, totRef = 0;
  const pr = ps.map(p => {
    const ref = refP[p.ticker] || p.price; const dv = (p.price - ref) * p.shares; tot += p.value; totRef += ref * p.shares;
    return `<tr><td><span class="sw" style="background:${color[p.ticker] || '#8a95a6'};margin-right:8px"></span>${p.ticker}${p.stale ? '<span class="tag-stale">STALE</span>' : ''}</td><td>${p.account}</td><td>${Number(p.shares).toLocaleString('en-US', { maximumFractionDigits: 4 })}</td><td>${fmt2(p.price)}</td><td>${fmt(p.value)}</td><td class="${cls(dv)}">${(p.price / ref * 100 - 100 >= 0 ? '+' : '') + (p.price / ref * 100 - 100).toFixed(2)}%</td><td>${chg(dv)}</td></tr>`;
  }).join('');
  $('pos-asof').textContent = L ? '· ' + tstr(L.asof) : '· month-end values';
  $('pos').innerHTML = `<thead><tr><th>TICKER</th><th>ACCOUNT</th><th>SHARES</th><th>LAST</th><th>VALUE</th><th>% VS ${refDate}</th><th>P/L VS ${refDate}</th></tr></thead><tbody>${pr}<tr class="tot"><td>TOTAL</td><td></td><td></td><td></td><td>${fmt(tot)}</td><td></td><td>${chg(tot - totRef)}</td></tr></tbody>`;

  // Wallets
  const W = (L && L.crypto) || [];
  $('wal-asof').textContent = L ? '· ' + tstr(L.asof) : '· run a refresh to read wallets';
  const secColor = { Solana: '#9b4dff', Monad: '#e04fb3', Bitcoin: '#f7931a', NFTs: '#ff4d5e' };
  const ws = W.slice().sort((x, y) => (y.usd || 0) - (x.usd || 0));
  const wt = ws.reduce((s, r) => s + (r.usd || 0), 0);
  $('wal').innerHTML = W.length ? `<thead><tr><th>WALLET / LINE</th><th>ASSET</th><th>AMOUNT</th><th>PRICE</th><th>USD</th><th>KIND</th></tr></thead><tbody>${ws.map(r =>
    `<tr><td><span class="sw" style="background:${secColor[r.sector] || '#8a95a6'};margin-right:8px"></span>${r.label}${r.stale ? '<span class="tag-stale">STALE</span>' : ''}</td><td>${r.asset}</td><td>${Number(r.amount).toLocaleString('en-US', { maximumFractionDigits: r.asset === 'USD' ? 2 : 4 })}</td><td>${r.asset === 'USD' ? '–' : fmt2(r.price)}</td><td>${fmt(r.usd)}</td><td>${r.kind.toUpperCase()}</td></tr>`).join('')}<tr class="tot"><td>TOTAL</td><td></td><td></td><td></td><td>${fmt(wt)}</td><td></td></tr></tbody>` : '<tbody><tr><td>No live wallet read yet. Press REFRESH.</td></tr></tbody>';

  // Tape
  const cRef = (D.crypto && D.crypto.ref_prices) || {};
  const items = [];
  const cp = (L && L.cprices) || cRef;
  [['BTC', cp.BTC, cRef.BTC], ['SOL', cp.SOL, cRef.SOL], ['MON', cp.MON, cRef.MON]].forEach(([s, p, r]) => { if (p) items.push([s, p, r]); });
  const sp = (L && L.prices) || refP;
  Object.keys(refP).forEach(t => items.push([t, sp[t], refP[t]]));
  const html = items.map(([s, p, r]) => { const d = r ? (p / r - 1) * 100 : 0; return `<span><b>${s}</b>${p < 1 ? p.toFixed(4) : p.toLocaleString('en-US', { maximumFractionDigits: 2 })} <span class="${cls(d)}">${d >= 0 ? '▲' : '▼'}${Math.abs(d).toFixed(2)}%</span></span>`; }).join('');
  $('tape').innerHTML = html + html;

  // Status + jobs + footer
  const st = $('status');
  st.className = 'status';
  if (L) { const fresh = (Date.now() - new Date(L.asof)) < 15 * 60 * 1000; st.classList.add(fresh ? 'live' : 'stale'); $('status-text').textContent = (fresh ? 'LIVE · ' : 'AS OF ') + tstr(L.asof).toUpperCase(); }
  else { $('status-text').textContent = 'MONTH-END · ' + longLab(D.months[NM - 1]).toUpperCase(); }
  const j = D.jobs && D.jobs.full;
  const jc = $('jobs');
  if (j && j.status) {
    const m = { queued: ['q', 'MAC JOB QUEUED ' + ago(j.requested_at).toUpperCase()], running: ['run', 'MAC UPDATING · ' + (j.message || '').toUpperCase()], done: ['ok', 'MAC UPDATE DONE ' + ago(j.finished_at || j.requested_at).toUpperCase()], error: ['err', 'MAC UPDATE FAILED · ' + (j.message || '').toUpperCase()] }[j.status] || ['q', j.status];
    jc.innerHTML = `<span class="chip ${m[0]}">${m[1]}</span>`;
  } else jc.innerHTML = '';
  const sheet = (D.sheets || [])[0];
  $('foot').innerHTML = `History through ${longLab(D.months[NM - 1])}${D.updated_at ? ' · full update ' + tstr(D.updated_at) : ''}${sheet ? ` · last sheet: <a href="${sheet.url}" target="_blank" rel="noopener">${sheet.name}</a>` : ''}`;
}

// ---------------------------------------------------------------- actions
let toastT = null;
function toast(html, ms) { const t = $('toast'); t.innerHTML = html; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms || 4000); }
function busy(on, text) {
  ['btn-refresh', 'btn-save', 'btn-full'].forEach(id => { $(id).disabled = on; });
  if (on) { $('status').className = 'status busy'; $('status-text').textContent = text; }
}
async function load(quiet) {
  try { const r = await api({ action: 'data' }); D = r.state; LS.set('bt-state', D); render(); pollJob(); }
  catch (e) { if (!quiet) toast(e.message, 6000); if (D) render(); }
}
async function refresh(save) {
  const t0 = Date.now();
  busy(true, save ? 'REFRESHING + SAVING SHEET…' : 'REFRESHING…');
  try {
    const r = await api({ action: 'refresh', save: !!save });
    D = r.state; LS.set('bt-state', D);
    if (S.preset) S.to = null;
    render();
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    toast(r.sheet ? `Saved <a href="${r.sheet.url}" target="_blank" rel="noopener">${r.sheet.name}</a> to Drive · ${secs}s` : `Refreshed in ${secs}s${(D.live.stale || []).length ? ' · stale: ' + D.live.stale.join(', ') : ''}`, r.sheet ? 9000 : 4000);
  } catch (e) { toast('Refresh failed: ' + e.message, 7000); render(); }
  finally { busy(false); renderLive(); }
}
async function full() {
  busy(true, 'QUEUEING MAC JOB…');
  try { const r = await api({ action: 'queue_full', save: true }); D.jobs = { full: r.job }; LS.set('bt-state', D); toast(r.note || 'Queued. Your Mac picks it up within a couple of minutes if it is awake.', 6000); pollJob(); }
  catch (e) { toast('Could not queue: ' + e.message, 7000); }
  finally { busy(false); renderLive(); }
}
let pollT = null;
function pollJob() {
  clearTimeout(pollT);
  const j = D && D.jobs && D.jobs.full;
  if (j && (j.status === 'queued' || j.status === 'running')) pollT = setTimeout(() => load(true), 20000);
}

// ---------------------------------------------------------------- settings
function openSettings() {
  const c = cfg(); $('set-api').value = c.api; $('set-key').value = c.key;
  if (!$('settings').open) $('settings').showModal();
}
$('settings-form').addEventListener('submit', e => {
  if (e.submitter && e.submitter.value === 'ok') {
    LS.set('bt-api', $('set-api').value.trim()); LS.set('bt-key', $('set-key').value.trim());
    setTimeout(() => load(), 50);
  }
});

// ---------------------------------------------------------------- wiring
$('btn-refresh').onclick = () => refresh(false);
$('btn-save').onclick = () => refresh(true);
$('btn-full').onclick = full;
$('btn-settings').onclick = openSettings;
$('from').onchange = () => { S.from = +$('from').value; if (S.from > S.to) S.to = S.from; S.preset = null; render(); };
$('to').onchange = () => { S.to = +$('to').value; if (S.to < S.from) S.from = S.to; S.preset = null; render(); };
document.querySelectorAll('#presets button').forEach(x => x.onclick = () => { S.preset = x.dataset.p; render(); });
document.querySelectorAll('#inv-mode button').forEach(x => x.onclick = () => { S.inv = x.dataset.m; render(); });
document.addEventListener('keydown', e => {
  if (e.key === 'F5') { e.preventDefault(); refresh(false); }
  else if (e.key === 'F6') { e.preventDefault(); refresh(true); }
  else if (e.key === 'F9') { e.preventDefault(); full(); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(true); });
setInterval(() => { $('clock').textContent = new Date().toLocaleTimeString('en-US', { hour12: false }) + ' ET'; }, 1000);

if (D) render();
if (!cfg().key) openSettings(); else load();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
