// The Belt: game shell. Owns the clock, the DOM, save/load and every button. Game rules live in sim.js and ai.js.
import * as S from './sim.js';
import { bestSink, benchWorkers } from './ai.js';
import { createView } from './render.js';
import * as V from './views.js';
const { esc, btn } = V;
const { STATIONS, STATION_IDS, SHIP_TYPES, ROLE_NAME, fmtMoney, fmtT } = S;
const $ = id => document.getElementById(id);
const SAVE_KEY = 'belt.save.v1';
const SPEEDS = [[1, '1×'], [10, '10×'], [100, '100×'], [1000, '1k×'], [10000, '10k×']];

const U = { g: null, view: null, speed: 10, paused: true, acc: 0, sel: null, tab: 'fleet', roleFilter: 'all', logFilter: 'all', autoSlow: true, follow: null, coachOff: false, seenEv: 0, toastAt: 0, throttled: false, lastUi: 0, lastSave: 0, modalFn: null };
let view3d = null;
const me = () => U.g.companies[U.g.view];

// ------------------------------------------------------------ toast, modal, sheet
let toastTimer = 0;
function toast(msg, sev = '') { const t = $('toast'); t.textContent = msg; t.className = 'show ' + sev; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.className = '', 3800); }
const res = r => { toast(r.msg, r.ok ? '' : 'warn'); refreshAll(); return r; };
function openModal(html) { const m = $('modal'); m.innerHTML = `<div class="sheetbox"><div class="modalbox">${html}</div></div>`; m.hidden = false; }
function closeModal() { $('modal').hidden = true; U.modalFn = null; }
$('modal').addEventListener('click', e => { if (e.target === $('modal')) closeModal(); });
$('sheet').addEventListener('click', e => { if (e.target === $('sheet')) closePanel(); });
const TABS = [['fleet', 'Fleet'], ['people', 'People'], ['market', 'Markets'], ['finance', 'Finance'], ['org', 'Organisation'], ['log', 'Log'], ['rivals', 'Companies']];
function openPanel(tab) { U.tab = tab || U.tab; $('sheet').hidden = false; renderPanel(); }
function closePanel() { $('sheet').hidden = true; }
function renderPanel() {
  if ($('sheet').hidden) return; const g = U.g;
  const body = { fleet: V.panelFleet, people: V.panelPeople, market: V.panelMarket, finance: V.panelFinance, org: V.panelOrg, log: V.panelLog, rivals: V.panelRivals }[U.tab](g, U);
  const reqN = g.requests.filter(r => r.co === g.view).length;
  const keep = $('sheet').querySelector('.sheetbody'), st = keep ? keep.scrollTop : 0;
  $('sheet').innerHTML = `<div class="sheetbox"><div class="sheethead"><div class="tabs">${TABS.map(([k, n]) => `<button class="tab ${U.tab === k ? 'on' : ''}" data-a="tab" data-k="${k}">${n}${k === 'org' && reqN ? ' <span class="pill warn">' + reqN + '</span>' : ''}</button>`).join('')}</div><button data-a="closepanel" aria-label="Close">✕</button></div><div class="sheetbody">${body}</div></div>`;
  $('sheet').querySelector('.sheetbody').scrollTop = st;
}

// ------------------------------------------------------------ selection and inspector
function select(id, focus = false) {
  U.sel = id; const g = U.g;
  const ren = /^[sa]\d+$/.test(id || '') || STATION_IDS.includes(id) ? id : null;
  view3d.select(ren); if (focus && ren) view3d.focus(ren);
  renderInsp();
}
function renderInsp() {
  const g = U.g, el = $('insp'), id = U.sel; if (!g) return;
  if (!id) { el.hidden = true; return; }
  let h = '';
  if (/^s\d+$/.test(id)) { const s = g.ships[id]; if (!s) { U.sel = null; el.hidden = true; return; } h = V.inspShip(g, s); }
  else if (/^a\d+$/.test(id)) h = V.inspAst(g, g.ast[+id.slice(1)]);
  else if (STATION_IDS.includes(id)) h = V.inspStation(g, id);
  else if (/^w\d+$/.test(id)) { const w = g.workers[id]; if (!w) { U.sel = null; el.hidden = true; return; } h = V.inspWorker(g, w); }
  else if (id.startsWith('co')) h = V.inspCompany(g, g.companies[+id.slice(2)]);
  else { el.hidden = true; return; }
  const sc = el.scrollTop; el.innerHTML = `<button class="close" data-a="deselect" aria-label="Close">✕</button>${h}`; el.hidden = false; el.scrollTop = sc;
}

// ------------------------------------------------------------ top bar, controls, feed, coach
function net30(c) { let t = 0; for (const d of c.hist.slice(-30)) t += (d.sales || 0) + (d.payroll || 0) + (d.upkeep || 0) + (d.fuel || 0) + (d.repair || 0) + (d.interest || 0) + (d.other || 0); return t; }
function renderTop() {
  const g = U.g, c = me(), d = S.dateOf(g.t), n = net30(c), sh = S.shipsOf(g, c.id).length, w = S.workersOf(g, c.id).length;
  $('stCo').innerHTML = `${c.ai ? 'AI-run company' : 'Your company'}<b style="color:${c.color}">${esc(c.name)}</b>`;
  $('stCash').innerHTML = `Cash<b>${fmtMoney(c.cash)}</b>`;
  $('stNet').innerHTML = `Last 30 days<b class="${n >= 0 ? 'ok' : 'bad'}">${n >= 0 ? '+' : ''}${fmtMoney(n)}</b>`;
  $('stFleet').innerHTML = `Fleet<b>${sh} ships · ${w} people</b>`;
  $('stDate').innerHTML = `${view3d.scaleLevel()} view · ${U.paused ? 'paused' : U.throttled ? 'sim limited' : U.speed + '×'}<b>${d.date} ${d.time}</b>`;
}
function renderBar() {
  const c = me(), g = U.g;
  const speeds = SPEEDS.filter(([v]) => v < 10000 || c.ai || g.settings.mode !== 'owner');
  $('speeds').innerHTML = `<button data-a="pause" class="${U.paused ? 'warnbtn on' : ''}" aria-label="Pause">${U.paused ? '▶ Play' : '⏸ Pause'}</button>` + speeds.map(([v, t]) => `<button data-a="speed" data-v="${v}" class="${!U.paused && U.speed === v ? 'on' : ''}">${t}</button>`).join('');
  const reqN = g.requests.filter(r => r.co === g.view).length;
  $('nav').innerHTML = [['fleet', 'Fleet'], ['people', 'People'], ['market', 'Markets'], ['finance', 'Finance'], ['org', 'Org' + (reqN ? ' ●' : '')]].map(([k, n]) => `<button data-a="tab" data-k="${k}" class="${reqN && k === 'org' ? 'warnbtn' : ''}">${n}</button>`).join('') +
    `<button data-a="cam" data-k="system">System</button><button data-a="cam" data-k="belt">Belt</button><button data-a="menu">Menu</button>`;
}
function feedFilter(e) {
  const g = U.g, f = U.follow;
  if (f) return f.kind === 'co' ? e.co === f.id : e.ref === f.id || e.co === g.workers[f.id]?.co && e.ref === f.id;
  return g.settings.mode !== 'owner' || e.co === g.view || e.co === null;
}
function renderFeed() {
  const g = U.g, list = g.events.filter(feedFilter).slice(-5).reverse();
  const f = U.follow, label = f ? `<div class="eyebrow">Following ${esc(f.kind === 'co' ? g.companies[f.id]?.name : f.kind === 'worker' ? g.workers[f.id]?.name : (g.ships[f.id]?.name || g.ast[+f.id.slice(1)]?.name || f.id))} ${btn('stop', 'unfollow', {}, 'link')}</div>` : '';
  $('feed').innerHTML = label + list.map(e => `<div class="ev ${e.sev}"><time>${S.dateOf(e.t).date.slice(5)}</time><span>${esc(e.msg)}</span></div>`).join('') || '<small class="dim">Events will appear here.</small>';
}
function coachStage() {
  const g = U.g, c = me(); if (g.settings.mode !== 'owner' || U.coachOff || c.ai) return null;
  const ships = S.shipsOf(g, c.id), claims = S.claimsOf(g, c.id), scanned = g.ast.filter(a => (S.intelOf(g, c.id, a)?.lvl || 0) >= 1);
  const working = ships.some(s => s.prog && s.prog.steps.some(st => st.t === 'mine'));
  if (!claims.length && g.t < 72 * 24 + 8) return ['Welcome aboard.', 'Your ship is docked at Earth and <b>time is paused</b>. Tap an asteroid near Ceres (blue ones are metal-rich once scanned), choose <b>Dispatch ship…</b>, and send your ship to <b>scan</b> it. Then press <b>▶ Play</b>.'];
  if (!claims.length && scanned.length < 3 && !ships.some(s => s.prog)) return ['Find a deposit', 'Dispatch your ship to scan nearby asteroids. Scanning shows class and rough composition. A survey narrows the error bars.'];
  if (!claims.length) return ['Choose a deposit', 'Open a scanned asteroid and read its estimated value per tonne and reserves. <b>Claim</b> the one you like, or survey it first for better numbers.'];
  if (!working) return ['Start mining', 'Open your ship and choose <b>Orders… → Mining run</b>. It will fly to your claim, mine, sell and repeat on its own.'];
  if (ships.length < 2 && c.cash > SHIP_TYPES.miner.cost * 1.3) return ['Grow', `You can afford a bigger ship. Open <b>Fleet → Buy ship</b>, then hire crew under <b>People</b>. Every ship needs its required crew.`];
  if (ships.length >= 3 && !S.workersOf(g, c.id).some(w => w.role === 'supervisor')) return ['Delegate', 'Repeating work can be handed off. Hire a <b>supervisor</b> under People, then give them ships in <b>Org → Team…</b>. They will write the orders for you.'];
  return null;
}
function renderCoach() {
  const el = $('coach'), st = coachStage(); if (!st) { el.hidden = true; return; }
  el.hidden = false; el.innerHTML = `<button class="x" data-a="coachoff" aria-label="Hide tips">✕</button><b>${st[0]}</b><br>${st[1]}`;
}
function refreshAll() { if (!U.g) return; renderTop(); renderBar(); renderInsp(); renderPanel(); renderFeed(); renderCoach(); if (U.modalFn && !$('modal').hidden) U.modalFn(); }

// ------------------------------------------------------------ program builders shared by orders and dispatch
function claimOptions(g) { return S.claimsOf(g, g.view).map(a => `<option value="${a.id}">${a.name} · ${a.cls} · ${fmtT(a.res)}</option>`).join(''); }
const stationOptions = (sel) => STATION_IDS.map(id => `<option value="${id}" ${id === sel ? 'selected' : ''}>${STATIONS[id].short}</option>`).join('');
function nearestUnscanned(g, s, n = 3) { const c = g.view; return g.ast.filter(a => !S.intelOf(g, c, a)).map(a => ({ a, d: S.distV(S.posOf(g, a.id), s.pos) })).sort((x, y) => x.d - y.d).slice(0, n).map(x => x.a); }
function buildProgram(g, s, kind, o) {
  const T = SHIP_TYPES[s.type];
  if (kind === 'mine') {
    const a = g.ast[+o.ast.slice(1)]; if (a.claim !== g.view) return { ok: false, msg: 'Claim ' + a.name + ' before mining it.' }; if (T.mine <= 0) return { ok: false, msg: 'A ' + T.name + ' cannot mine.' };
    S.setProgram(g, s.id, S.miningRun(g, s, a.id, o.sink, o.mode || 'carry'), true, 'Mining run'); return { ok: true, msg: s.name + ' will mine ' + a.name + '.' };
  }
  if (kind === 'haul') { S.setProgram(g, s.id, S.haulRun(g, s, o.from, o.sink), true, 'Haul run'); return { ok: true, msg: s.name + ' will haul goods.' }; }
  if (kind === 'scan') {
    if (T.surveyF <= 0) return { ok: false, msg: 'A ' + T.name + ' has no survey sensors.' };
    const list = o.ast === 'nearest3' ? nearestUnscanned(g, s, 3) : [g.ast[+o.ast.slice(1)]];
    if (!list.length) return { ok: false, msg: 'Nothing left to scan nearby.' }; S.setProgram(g, s.id, list.map(a => ({ t: 'scan', ast: a.id })), false, 'Scan run'); return { ok: true, msg: s.name + ' will scan ' + list.map(a => a.name).join(', ') + '.' };
  }
  if (kind === 'survey') { if (T.surveyF <= 0) return { ok: false, msg: 'A ' + T.name + ' has no survey sensors.' }; S.setProgram(g, s.id, [{ t: 'survey', ast: o.ast }], false, 'Survey'); return { ok: true, msg: s.name + ' will survey ' + S.locName(g, o.ast) + '.' }; }
  if (kind === 'goto') { S.setProgram(g, s.id, [{ t: 'goto', to: o.to }], false, 'Travel'); return { ok: true, msg: s.name + ' is heading to ' + S.locName(g, o.to) + '.' }; }
  if (kind === 'clear') { S.setProgram(g, s.id, []); return { ok: true, msg: 'Orders cleared.' }; }
  return { ok: false, msg: 'Unknown order.' };
}
const shipReady = (g, s) => S.crewStatus(g, s).ok && !['broken', 'stranded'].includes(s.state);

function ordersModal(sid) {
  const g = U.g, s = g.ships[sid]; if (!s) return closeModal(); const T = SHIP_TYPES[s.type], me_ = me();
  const claims = S.claimsOf(g, me_.id), stk = claims.filter(a => Object.keys(a.stock[me_.id] || {}).length);
  const kinds = [];
  if (T.mine > 0) kinds.push(['mine', 'Mining run (mine, sell, repeat)']);
  if (T.cargo >= 1000) kinds.push(['haul', 'Haul run (stockpile or warehouse to a buyer)']);
  if (T.surveyF > 0) kinds.push(['scan', 'Scan asteroids'], ['survey', 'Survey an asteroid']);
  kinds.push(['goto', 'Go to…'], ['clear', 'Clear orders']);
  const scannedList = g.ast.filter(a => (S.intelOf(g, g.view, a)?.lvl || 0) === 1).slice(0, 40).map(a => `<option value="${a.id}">${a.name} · class ${a.cls}</option>`).join('');
  const nearU = nearestUnscanned(g, s, 12).map(a => `<option value="${a.id}">${a.name} · ${S.distV(S.posOf(g, a.id), s.pos).toFixed(2)} AU away</option>`).join('');
  const fromOpts = stk.map(a => `<option value="${a.id}">${a.name} stockpile (${fmtT(Object.values(a.stock[me_.id]).reduce((x, y) => x + y, 0))})</option>`).join('') + STATION_IDS.map(id => `<option value="${id}">${STATIONS[id].short} warehouse</option>`).join('');
  const gotoOpts = STATION_IDS.map(id => `<option value="${id}">${STATIONS[id].name}</option>`).join('') + claims.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  openModal(`<h2>Orders · ${esc(s.name)}</h2>
   <label class="field"><span>Order</span><select id="oKind">${kinds.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
   <div data-sec="mine">${claims.length ? `<label class="field"><span>Deposit</span><select id="oAst">${claimOptions(g)}</select></label>
     <label class="field"><span>Sell at</span><select id="oSink">${stationOptions('ceres')}</select></label>
     <label class="field"><span>Method</span><select id="oMode"><option value="carry">Carry ore to the buyer</option><option value="stockpile">Mine into the claim stockpile (tugs collect)</option></select></label>
     <div class="callout" id="oHint"></div>` : '<div class="callout">You have no claims yet. Scan an asteroid, then claim it.</div>'}</div>
   <div data-sec="haul" class="hide"><label class="field"><span>Pick up at</span><select id="oFrom">${fromOpts}</select></label><label class="field"><span>Sell at</span><select id="oSink2">${stationOptions('earth')}</select></label></div>
   <div data-sec="scan" class="hide"><label class="field"><span>Target</span><select id="oScan"><option value="nearest3">The 3 nearest unscanned</option>${nearU}</select></label></div>
   <div data-sec="survey" class="hide"><label class="field"><span>Target</span><select id="oSurvey">${scannedList || '<option value="">No scanned asteroids yet</option>'}</select></label></div>
   <div data-sec="goto" class="hide"><label class="field"><span>Destination</span><select id="oGoto">${gotoOpts}</select></label></div>
   <div class="acts">${btn('Apply orders', 'applyorders', { id: sid }, 'pri')}${btn('Close', 'closemodal')}</div>`);
  const upd = () => { const k = $('oKind').value; document.querySelectorAll('#modal [data-sec]').forEach(e => e.classList.toggle('hide', e.dataset.sec !== k));
    if (k === 'mine' && $('oAst')) { const a = g.ast[+$('oAst').value.slice(1)], e = S.estimate(g, g.view, a); if (e) { const b = bestSink(g, me_, a.id, e.share, T, T.cargo); $('oSink').value = b.st; $('oHint').textContent = 'Suggested buyer: ' + STATIONS[b.st].short + ', about ' + Math.round(b.rate).toLocaleString('en-US') + ' ¢/day at today\'s prices.'; } } };
  $('modal').onchange = e => { if (e.target.id === 'oKind' || e.target.id === 'oAst') upd(); }; upd();
}
function applyOrders(sid) {
  const g = U.g, s = g.ships[sid], k = $('oKind').value; let o = {};
  if (k === 'mine') o = { ast: $('oAst')?.value, sink: $('oSink')?.value, mode: $('oMode')?.value }; if (k === 'haul') o = { from: $('oFrom').value, sink: $('oSink2').value };
  if (k === 'scan') o = { ast: $('oScan').value }; if (k === 'survey') o = { ast: $('oSurvey').value }; if (k === 'goto') o = { to: $('oGoto').value };
  if ((k === 'mine' && !o.ast) || (k === 'survey' && !o.ast)) return toast('Pick a target first.', 'warn');
  const r = buildProgram(g, s, k, o); if (r.ok) closeModal(); res(r);
}
function dispatchModal(astId) {
  const g = U.g, a = g.ast[+astId.slice(1)], ships = S.shipsOf(g, g.view).filter(s => shipReady(g, s));
  const it = S.intelOf(g, g.view, a);
  if (!ships.length) return toast('You have no ship with a full crew. Open Fleet or People to fix that.', 'warn');
  const acts = [['scan', 'Scan (remote sensors)'], ['survey', 'Survey (fly there, take samples)']]; if (a.claim === g.view) acts.push(['mine', 'Mine and sell']);
  openModal(`<h2>Dispatch to ${esc(a.name)}</h2>
  <label class="field"><span>Ship</span><select id="dShip">${ships.map(s => `<option value="${s.id}">${esc(s.name)} · ${SHIP_TYPES[s.type].name} · ${(S.distV(s.pos, S.posOf(g, a.id))).toFixed(2)} AU away</option>`).join('')}</select></label>
  <label class="field"><span>Task</span><select id="dKind">${acts.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
  <div class="callout">${it ? 'Current knowledge: level ' + it.lvl + ' (±' + Math.round(it.sig * 100) + '%).' : 'Nothing known yet.'} Scanning takes about half a day on site. A survey takes several days but cuts the uncertainty sharply.</div>
  <div class="acts">${btn('Send', 'applydispatch', { id: astId }, 'pri')}${btn('Cancel', 'closemodal')}</div>`);
}
function applyDispatch(astId) {
  const g = U.g, s = g.ships[$('dShip').value], k = $('dKind').value; let o = { ast: astId };
  if (k === 'mine') { const a = g.ast[+astId.slice(1)], e = S.estimate(g, g.view, a); o.sink = e ? bestSink(g, me(), a.id, e.share, SHIP_TYPES[s.type], SHIP_TYPES[s.type].cargo).st : 'ceres'; }
  const r = buildProgram(g, s, k, o); if (r.ok) closeModal(); res(r);
}
function crewModal(sid) {
  const g = U.g, s = g.ships[sid]; if (!s) return closeModal(); const cs = S.crewStatus(g, s), docked = s.at && S.isStation(s.at), T = SHIP_TYPES[s.type];
  const allowed = new Set([...T.crew.req.flat(), ...T.crew.opt.flat()]);
  const bench = S.workersOf(g, g.view).filter(w => !w.ship && !w.fac && (w.founder || allowed.has(w.role))).sort((a, b) => b.skill - a.skill);
  const on = s.crew.map(id => g.workers[id]).filter(Boolean);
  openModal(`<h2>Crew · ${esc(s.name)}</h2>
  ${docked ? '' : '<div class="callout">Crew can only change while the ship is docked at a station.</div>'}
  ${cs.missing.length ? `<div class="callout">Required and missing: ${cs.missing.join(', ')}.</div>` : ''}
  <div class="sect">Aboard (${on.length}/${cs.capacity})</div>${on.map(w => `<div class="row"><span>${esc(w.name)} <small class="dim">${w.founder ? 'Founder' : ROLE_NAME[w.role]} · ${w.skill | 0}</small></span>${btn('Remove', 'uncrew', { id: w.id })}</div>`).join('') || '<small class="dim">Nobody.</small>'}
  <div class="sect">On the bench</div>${bench.map(w => `<div class="row"><span>${esc(w.name)} <small class="dim">${w.founder ? 'Founder' : ROLE_NAME[w.role]} · ${w.skill | 0}</small></span>${btn('Assign', 'crewadd', { id: w.id, sid })}</div>`).join('') || '<small class="dim">Nobody free. Hire people under People.</small>'}
  <div class="acts">${btn('Done', 'closemodal', {}, 'pri')}</div>`);
  U.modalFn = () => crewModal(sid);
}
function assignModal(wid) {
  const g = U.g, w = g.workers[wid]; if (!w) return closeModal();
  const ships = S.shipsOf(g, g.view).filter(s => s.at && S.isStation(s.at));
  const facs = S.facilitiesOf(g, g.view).filter(f => f.state === 'active');
  openModal(`<h2>Assign ${esc(w.name)}</h2><small class="dim">Ships must be docked at a station.</small>
  ${ships.map(s => `<div class="row"><span>${esc(s.name)} <small class="dim">${s.crew.length}/${S.crewStatus(g, s).capacity} crew</small></span>${btn('Assign', 'assignship', { id: wid, sid: s.id })}</div>`).join('') || '<small class="dim">No ships are docked.</small>'}
  ${w.role === 'engineer' ? facs.map(f => `<div class="row"><span>Refinery at ${STATIONS[f.st].short}</span>${btn('Assign', 'assignfac', { id: wid, fid: f.id })}</div>`).join('') : ''}
  <div class="acts">${btn('Move to bench', 'bench', { id: wid })}${btn('Close', 'closemodal')}</div>`);
}
function buyShipModal() {
  const g = U.g, c = me();
  openModal(`<h2>Buy a ship</h2><small class="dim">Delivered to ${STATIONS[c.hq].name}. It needs its required crew before it can work.</small><div class="opts">${S.SHIP_ORDER.map(t => { const T = SHIP_TYPES[t]; return `<div class="opt"><b>${T.name}</b> · ${fmtMoney(T.cost)}<br><small class="dim">${T.blurb}</small><br><small>Cargo ${T.cargo} t · ${T.speed} AU/day · Mining ${T.mine} t/h · Crew: ${T.crew.req.map(r => r.join('/')).join(' + ')}${T.crew.opt.length ? ' (up to ' + (T.crew.req.length + T.crew.opt.length) + ')' : ''}</small><div class="acts">${btn('Buy', 'buy', { t }, c.cash >= T.cost ? 'pri' : '')}</div></div>`; }).join('')}</div><div class="acts">${btn('Close', 'closemodal')}</div>`);
}
function teamModal(wid) {
  const g = U.g, w = g.workers[wid], ships = S.shipsOf(g, g.view), cap = w.role === 'supervisor' ? 8 : 40;
  openModal(`<h2>${esc(w.name)}'s team</h2><small class="dim">A ${w.role} can run up to ${cap} ships. They write standing orders and staff idle ships from the bench.</small>
  <div class="opts" style="margin-top:8px">${ships.map(s => { const other = s.sup && s.sup !== wid && g.workers[s.sup]; return `<label class="opt" style="display:flex;gap:10px;align-items:center"><input type="checkbox" class="tm" value="${s.id}" ${s.sup === wid ? 'checked' : ''}> <span>${esc(s.name)} <small class="dim">${SHIP_TYPES[s.type].name}${other ? ' · now ' + esc(other.name) : ''}</small></span></label>`; }).join('')}</div>
  <div class="acts">${btn('Save team', 'saveteam', { id: wid }, 'pri')}${btn('Cancel', 'closemodal')}</div>`);
}
function authorityModal(wid) {
  const g = U.g, w = g.workers[wid], m = w.mgr; const opt = (v, cur, t) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${t}</option>`;
  openModal(`<h2>${esc(w.name)}: objective and authority</h2>
  <label class="field"><span>Objective</span><select id="mObj">${opt('profit', m.obj, 'Maximise profit')}${opt('volume', m.obj, 'Maximise volume')}${opt('explore', m.obj, 'Explore for new deposits')}</select></label>
  <label class="field"><span>Monthly spending</span><select id="mSpend">${[1e6, 3e6, 6e6, 12e6, 30e6, 80e6].map(v => opt(v, m.spend, fmtMoney(v))).join('')}</select></label>
  ${[['hire', 'May hire crew'], ['buy', 'May buy ships'], ['claim', 'May claim deposits'], ['build', 'May build refineries']].map(([k, t]) => `<label class="field"><span>${t}</span><input type="checkbox" id="m_${k}" ${m[k] ? 'checked' : ''}></label>`).join('')}
  <small class="dim">Anything beyond these limits comes to you as a request.</small>
  <div class="acts">${btn('Save', 'saveauth', { id: wid }, 'pri')}${btn('Cancel', 'closemodal')}</div>`);
}
function promoteModal(wid) { const w = U.g.workers[wid]; openModal(`<h2>Promote ${esc(w.name)}</h2><small class="dim">Leadership ${w.lead}. Supervisors need about 43, managers about 56. Their pay rises to match.</small><div class="acts">${btn('Supervisor', 'dopromote', { id: wid, r: 'supervisor' }, 'pri')}${btn('Manager', 'dopromote', { id: wid, r: 'manager' })}${btn('Cancel', 'closemodal')}</div>`); }
function contractsModal(st) {
  const g = U.g, list = g.contracts.filter(c => c.st === st && c.taker === null && !c.done);
  openModal(`<h2>Contracts · ${STATIONS[st].short}</h2>${list.map(c => `<div class="opt"><b>${c.qty} t ${S.COMM_NAME[c.c]}</b> at ${fmtMoney(c.price)}/t = ${fmtMoney(c.qty * c.price)}<br><small class="dim">Deliver within ${c.days} days of accepting. Goods must be refined and in your warehouse here.</small><div class="acts">${btn('Accept', 'accept', { id: c.id }, 'pri')}</div></div>`).join('') || '<small class="dim">No open contracts here.</small>'}<div class="acts">${btn('Close', 'closemodal')}</div>`);
}
function helpModal() {
  openModal(`<h2>How to play</h2>
  <p><b>Tap or click</b> a ship, asteroid or station to inspect it. <b>Drag</b> to orbit, <b>pinch or wheel</b> to zoom, <b>double-tap</b> to focus. Shift-drag pans.</p>
  <p><b>The loop:</b> scan asteroids, claim a good one, mine it, sell the ore. Refining ore yourself pays about ${Math.round(S.REFINE_YIELD / S.ORE_FACTOR * 100 - 100)}% more than selling it raw. Prices fall when you flood a market.</p>
  <p><b>Delegation:</b> ships run standing orders you set. Hire supervisors to write orders for a team, managers to pursue goals with a budget, and eventually hand the whole company to AI from the Menu.</p>
  <p><b>Time:</b> 1× is one game hour per second. The game slows itself for important events unless you turn that off in the Menu.</p>
  <div class="acts">${btn('Got it', 'closemodal', {}, 'pri')}</div>`);
}
function menuModal() {
  const g = U.g, c = me(), saved = !!localStorage.getItem(SAVE_KEY);
  openModal(`<h2>Menu</h2><div class="opts">
   ${btn('New game…', 'newgame')}${btn('Save game', 'save')}${saved ? btn('Load saved game', 'load') : ''}
   ${c.ai ? btn('Take control of ' + esc(c.name), 'takectl', {}, 'pri') : btn('Hand ' + esc(c.name) + ' to AI', 'handai')}
   ${btn('Companies and following…', 'tab', { k: 'rivals' })}
   ${btn((U.autoSlow ? '✓' : '✗') + ' Slow down for important events', 'autoslow')}
   ${btn('How to play', 'help')}${btn('Close', 'closemodal')}</div>
   <small class="dim">The game autosaves to this browser every minute.</small>`);
}

// ------------------------------------------------------------ actions
function act(a, d) {
  const g = U.g;
  switch (a) {
    case 'pause': U.paused = !U.paused; refreshAll(); break;
    case 'speed': U.speed = +d.v; U.paused = false; refreshAll(); break;
    case 'tab': closeModal(); openPanel(d.k); renderBar(); break;
    case 'closepanel': closePanel(); break;
    case 'closemodal': closeModal(); break;
    case 'deselect': select(null); break;
    case 'cam': view3d.home(d.k); break;
    case 'focus': view3d.focus(d.id); break;
    case 'menu': menuModal(); break;
    case 'help': helpModal(); break;
    case 'pick': select(d.id, true); break;
    case 'pickfocus': closePanel(); select(d.id, true); break;
    case 'pickw': closePanel(); select(d.id); break;
    case 'pickco': closePanel(); select('co' + d.id); break;
    case 'coachoff': U.coachOff = true; renderCoach(); break;
    case 'rolefilter': U.roleFilter = d.r; renderPanel(); break;
    case 'logfilter': U.logFilter = d.f; renderPanel(); break;
    case 'orders': ordersModal(d.id); break;
    case 'applyorders': applyOrders(d.id); break;
    case 'dispatch': dispatchModal(d.id); break;
    case 'applydispatch': applyDispatch(d.id); break;
    case 'crew': crewModal(d.id); break;
    case 'crewadd': { const r = S.assignCrew(g, g.view, d.id, d.sid); toast(r.msg, r.ok ? '' : 'warn'); crewModal(d.sid); refreshAll(); break; }
    case 'uncrew': { const w = g.workers[d.id], sid = w.ship; const r = S.unassignCrew(g, g.view, d.id); toast(r.msg, r.ok ? '' : 'warn'); crewModal(sid); refreshAll(); break; }
    case 'assign': assignModal(d.id); break;
    case 'assignship': { const r = S.assignCrew(g, g.view, d.id, d.sid); if (r.ok) closeModal(); res(r); break; }
    case 'assignfac': { const r = S.assignFacility(g, g.view, d.id, d.fid); if (r.ok) closeModal(); res(r); break; }
    case 'bench': { const r = S.unassignCrew(g, g.view, d.id); if (r.ok) closeModal(); res(r); break; }
    case 'buyship': buyShipModal(); break;
    case 'buy': { const r = S.buyShip(g, g.view, d.t); if (r.ok) { closeModal(); select(r.id, true); } res(r); break; }
    case 'sellship': { const r = S.sellShip(g, g.view, d.id); if (r.ok) select(null); res(r); break; }
    case 'rescue': res(S.rescueShip(g, g.view, d.id)); break;
    case 'hire': { const r = S.hireCandidate(g, g.view, d.id); res(r); break; }
    case 'fire': { const r = S.fireWorker(g, g.view, d.id); if (r.ok) select(null); res(r); break; }
    case 'promote': promoteModal(d.id); break;
    case 'dopromote': { const r = S.promote(g, g.view, d.id, d.r); if (r.ok) closeModal(); res(r); break; }
    case 'team': teamModal(d.id); break;
    case 'saveteam': { const ids = [...document.querySelectorAll('#modal .tm:checked')].map(e => e.value); const r = S.setTeam(g, g.view, d.id, ids); if (r.ok) closeModal(); res(r); break; }
    case 'authority': authorityModal(d.id); break;
    case 'saveauth': { const r = S.setManager(g, g.view, d.id, { obj: $('mObj').value, spend: +$('mSpend').value, hire: $('m_hire').checked, buy: $('m_buy').checked, claim: $('m_claim').checked, build: $('m_build').checked }); if (r.ok) closeModal(); res(r); break; }
    case 'reqok': res(S.resolveRequest(g, d.id, true)); break;
    case 'reqno': res(S.resolveRequest(g, d.id, false)); break;
    case 'claim': res(S.claim(g, g.view, d.id)); break;
    case 'abandon': res(S.abandonClaim(g, g.view, d.id)); break;
    case 'build': { const st = d.id; openModal(`<h2>Build a refinery at ${STATIONS[st].short}</h2><p>Cost ${fmtMoney(S.REFINERY.cost)}, ${S.REFINERY.days} days to build. It turns ore into refined goods at a ${Math.round(S.REFINE_YIELD * 100)}% yield, up to ${S.REFINERY.cap} t/day, and needs ${S.REFINERY.staff} engineers (assign them under People) or it runs at a crawl. Ships that unload ore here deliver it straight to the refinery.</p><div class="acts">${btn('Build', 'dobuild', { id: st }, 'pri')}${btn('Cancel', 'closemodal')}</div>`); break; }
    case 'dobuild': { const r = S.buildRefinery(g, g.view, d.id); if (r.ok) closeModal(); res(r); break; }
    case 'togglesell': { const f = g.fac[d.id]; f.sell = f.sell === 'local' ? 'hold' : 'local'; toast(f.sell === 'local' ? 'Output is sold at the station.' : 'Output is held in the warehouse for tugs to haul.'); refreshAll(); break; }
    case 'contracts': contractsModal(d.id); break;
    case 'accept': { const r = S.acceptContract(g, g.view, d.id); res(r); if (!$('modal').hidden) contractsModal(U.sel); break; }
    case 'borrow': res(S.borrow(g, g.view, +d.n)); break;
    case 'repay': res(S.repay(g, g.view, +d.n)); break;
    case 'handai': closeModal(); res(S.setAI(g, g.view, true)); break;
    case 'takectl': closeModal(); res(S.setAI(g, g.view, false)); break;
    case 'viewco': g.view = +d.id; select(null); refreshAll(); toast('Now viewing ' + me().name + '.'); break;
    case 'followco': U.follow = { kind: 'co', id: +d.id }; toast('Following ' + g.companies[+d.id].name + '. The feed now shows only its events.'); renderFeed(); break;
    case 'followw': U.follow = { kind: 'worker', id: d.id }; toast('Following ' + g.workers[d.id].name + '.'); renderFeed(); break;
    case 'unfollow': U.follow = null; renderFeed(); break;
    case 'autoslow': U.autoSlow = !U.autoSlow; menuModal(); break;
    case 'save': saveGame(true); closeModal(); break;
    case 'load': loadGame(); closeModal(); break;
    case 'newgame': closeModal(); showStart(true); break;
    case 'startgame': startFromForm(); break;
    case 'continue': loadGame(); break;
    case 'cancelstart': $('start').hidden = true; break;
  }
}
document.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && !b.disabled) { e.preventDefault(); act(b.dataset.a, b.dataset); } });
document.addEventListener('change', e => { const t = e.target; if (t.dataset && t.dataset.a === 'policy') { const v = t.id === 'maint' ? +t.value : t.id === 'fuelRes' ? +t.value : t.value; S.setPolicy(U.g, U.g.view, { [t.id]: v }); toast('Policy updated.'); } });
document.addEventListener('keydown', e => {
  if (!U.g || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); act('pause', {}); } else if (e.key >= '1' && e.key <= '5') { const s = SPEEDS[+e.key - 1]; if (s && (s[0] < 10000 || me().ai)) act('speed', { v: s[0] }); }
  else if (e.key === 'Escape') { if (!$('modal').hidden) closeModal(); else if (!$('sheet').hidden) closePanel(); else select(null); }
});

// ------------------------------------------------------------ new game and saves
const LVL_COUNT = S.LEVELS.length;
function showStart(canCancel) {
  const has = !!localStorage.getItem(SAVE_KEY);
  $('start').innerHTML = `<div class="sheetbox"><div class="sheetbody">
  <h1 class="brand">THE BELT</h1><div class="sub">An interplanetary industrial simulation. Start small, hire people, and build an organisation that can run without you.</div>
  <div class="startgrid">
   <div class="full"><div class="modes">
     <label><input type="radio" name="mode" value="owner" checked><b>Owner-operator</b><small>You run the company and delegate as you grow.</small></label>
     <label><input type="radio" name="mode" value="company"><b>Company simulation</b><small>No player. AI leadership runs one company while you watch.</small></label>
     <label><input type="radio" name="mode" value="universe"><b>Universe simulation</b><small>Every company is AI. Follow any firm, worker or market.</small></label></div></div>
   <div><div class="sect" style="margin-top:0">Company name</div><input type="text" id="sName" value="Vesta Ore Co." maxlength="28" style="width:100%">
     <div class="sect">Workforce quality</div><select id="sQual" style="width:100%">${Object.entries(S.QUALITY).map(([k, q]) => `<option value="${k}" ${k === 'professional' ? 'selected' : ''}>${q.name}: ${q.blurb}</option>`).join('')}</select>
     <div class="sect">Difficulty</div><select id="sDiff" style="width:100%">${Object.entries(S.DIFFICULTY).map(([k, q]) => `<option value="${k}" ${k === 'standard' ? 'selected' : ''}>${q.name}: ${q.blurb}</option>`).join('')}</select>
     <div class="sect">AI company philosophy</div><select id="sPhil" style="width:100%">${Object.entries(S.PHILOSOPHY).map(([k, q]) => `<option value="${k}">${q.name}</option>`).join('')}</select>
     <div class="sect">Rival companies</div><select id="sRiv" style="width:100%">${[0, 1, 2, 3, 4, 5].map(n => `<option value="${n}" ${n === 2 ? 'selected' : ''}>${n}</option>`).join('')}</select>
     <div class="sect">Seed</div><input type="number" id="sSeed" value="${(Math.random() * 9000 + 1000) | 0}" style="width:100%"></div>
   <div><div class="sect" style="margin-top:0">Starting level</div><div class="lvl">${S.LEVELS.map((l, i) => `<label><input type="radio" name="lvl" value="${i}" ${i === 0 ? 'checked' : ''}><span><b>${l.name}</b><small>${l.blurb}</small></span></label>`).join('')}</div></div>
   <div class="full hide" id="customBox"><div class="sect">Custom start</div><div class="grid" style="grid-template-columns:repeat(4,1fr)">
     ${[['cP', 'Prospectors', 1], ['cM', 'Mining vessels', 0], ['cT', 'Cargo tugs', 0], ['cS', 'Survey vessels', 0], ['cO', 'Extra crew per ship', 1], ['cSup', 'Supervisors', 0], ['cMg', 'Managers', 0], ['cR', 'Refineries', 0], ['cC', 'Claims', 1], ['cCash', 'Cash (millions)', 5]].map(([id, n, v]) => `<label class="cell"><span>${n}</span><input type="number" id="${id}" value="${v}" min="0" max="${id === 'cCash' ? 500 : 60}" style="width:100%"></label>`).join('')}</div></div>
  </div>
  <div class="acts">${btn('Start', 'startgame', {}, 'pri')}${has ? btn('Continue saved game', 'continue') : ''}${canCancel ? btn('Cancel', 'cancelstart') : ''}</div>
  </div></div>`;
  $('start').hidden = false;
  $('start').onchange = () => { const l = +document.querySelector('input[name=lvl]:checked').value; $('customBox').classList.toggle('hide', l !== LVL_COUNT - 1); const m = document.querySelector('input[name=mode]:checked').value; if (m === 'universe' && +$('sRiv').value < 2) $('sRiv').value = 4; };
}
function startFromForm() {
  const q = id => $(id).value, mode = document.querySelector('input[name=mode]:checked').value, level = +document.querySelector('input[name=lvl]:checked').value;
  const set = { mode, level, name: q('sName').trim() || 'Vesta Ore Co.', quality: q('sQual'), difficulty: q('sDiff'), philosophy: q('sPhil'), rivals: +q('sRiv'), seed: +q('sSeed') || 1 };
  if (mode === 'universe') set.rivals = Math.max(2, set.rivals);
  if (level === LVL_COUNT - 1) { const n = id => Math.max(0, +q(id) || 0); set.custom = { ships: { prospector: n('cP'), miner: n('cM'), tug: n('cT'), survey: n('cS') }, opt: n('cO'), crew: 0, sups: n('cSup'), mgrs: n('cMg'), refineries: Math.min(3, n('cR')), claims: n('cC'), cash: n('cCash') * 1e6 };
    if (!Object.values(set.custom.ships).some(v => v > 0)) set.custom.ships.prospector = 1; }
  beginGame(S.newGame(set));
}
function beginGame(g) {
  U.g = g; U.sel = null; U.follow = null; U.acc = 0; U.paused = true; U.speed = g.settings.mode === 'owner' ? 10 : 100; U.seenEv = g.eid || 0; U.coachOff = false;
  view3d.setGame(g); view3d.select(null); view3d.follow = null; view3d.home('belt');
  $('start').hidden = true; $('sheet').hidden = true; $('modal').hidden = true; refreshAll();
  if (g.settings.mode !== 'owner') { U.paused = false; toast('Observation mode. Follow any company from its inspector.'); }
}
function saveGame(manual) {
  if (!U.g) return; try { localStorage.setItem(SAVE_KEY, S.serialize(U.g)); U.lastSave = performance.now(); if (manual) toast('Game saved in this browser.'); } catch (e) { if (manual) toast('Could not save: browser storage is full or blocked.', 'bad'); }
}
function loadGame() {
  let raw = null; try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { /* blocked */ }
  if (!raw) return toast('No saved game found.', 'warn');
  try { const g = S.deserialize(raw); beginGame(g); toast('Game loaded.'); } catch (e) { toast('The saved game could not be read.', 'bad'); }
}

// ------------------------------------------------------------ main loop
function afterAdvance() {
  const g = U.g; let slowed = false, latest = null;
  if ((g.eid || 0) > U.seenEv) {
    for (const e of g.events) if (e.id > U.seenEv) {
      const mine = e.co === g.view || (U.follow && U.follow.kind === 'co' && e.co === U.follow.id) || (U.follow && e.ref === U.follow.id);
      if (e.slow && mine && U.autoSlow && !U.paused && U.speed > 10) { U.speed = 10; slowed = true; latest = e; }
      else if (mine && (e.sev === 'bad' || e.sev === 'good') && performance.now() - U.toastAt > 2500) { toast(e.msg, e.sev === 'bad' ? 'bad' : ''); U.toastAt = performance.now(); }
    }
    U.seenEv = g.eid; renderFeed();
  }
  if (slowed) { toast('Slowed to 10×: ' + latest.msg, 'warn'); renderBar(); }
  if (g.over) { U.paused = true; gameOver(); }
}
function gameOver() {
  if (U.overShown) return; U.overShown = true; const g = U.g;
  openModal(`<h2>${esc(me().name)} is bankrupt</h2><p>Its ships and claims were sold to creditors and competitors. You can start again or keep watching the rest of the belt.</p><div class="acts">${btn('New game', 'newgame', {}, 'pri')}${btn('Watch the belt', 'closemodal')}</div>`);
  const alive = g.companies.filter(c => !c.dead).sort((a, b) => b.cash - a.cash)[0]; if (alive) g.view = alive.id; g.over = false; setTimeout(() => U.overShown = false, 1000);
}
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  try {
    if (U.g) {
      if (!U.paused) { U.acc += U.speed * dt; const h = Math.floor(U.acc); if (h > 0) { U.acc -= h; const n = S.advance(U.g, h, 9); U.throttled = n < h; if (U.throttled) U.acc = 0; afterAdvance(); } }
      view3d.frame();
      if (now - U.lastUi > 450) { U.lastUi = now; const a = document.activeElement; const editing = a && /SELECT|INPUT/.test(a.tagName) && $('sheet').contains(a); renderTop(); if (!editing) { renderInsp(); renderPanel(); } renderCoach(); if (!U.paused && U.modalFn && !$('modal').hidden) U.modalFn(); }
      if (now - U.lastSave > 60000 && !U.paused) saveGame(false);
    }
  } catch (err) { console.error(err); if (!U.errShown) { U.errShown = true; toast('Something went wrong: ' + err.message, 'bad'); } }
  requestAnimationFrame(loop);
}

function boot() {
  try { view3d = createView($('view'), $('labels')); }
  catch (e) { document.body.insertAdjacentHTML('beforeend', '<div style="position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center">The Belt needs WebGL, which this browser could not start.</div>'); return; }
  view3d.onPick = id => { if (id) select(id); else select(null); };
  view3d.onDbl = id => { select(id, true); };
  new ResizeObserver(() => view3d.resize()).observe($('view')); view3d.resize();
  new ResizeObserver(() => document.documentElement.style.setProperty('--barh', $('bar').offsetHeight + 'px')).observe($('bar'));
  addEventListener('visibilitychange', () => { if (document.hidden) saveGame(false); }); addEventListener('pagehide', () => saveGame(false));
  window.BELT = { U, S, view: view3d, act, beginGame, select };   // handy for debugging and tests
  showStart(false);
  requestAnimationFrame(loop);
}
boot();
