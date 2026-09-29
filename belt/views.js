// The Belt: HTML builders for inspectors and management panels. Pure functions of game state.
import * as S from './sim.js';
import { bestSink, valuePerT } from './ai.js';
const { COMM, COMM_NAME, STATIONS, STATION_IDS, SHIP_TYPES, ROLE_NAME, fmtMoney, fmtT } = S;

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pct = v => Math.round(v * 100) + '%';
export const bar = (v, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, v * 100)).toFixed(0)}%"></i></div>`;
export const pill = (t, cls = '') => `<span class="pill ${cls}">${esc(t)}</span>`;
export const btn = (label, act, data = {}, cls = '') => `<button class="${cls}" data-a="${act}" ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>${label}</button>`;
export function spark(arr, w = 96, h = 26) {
  if (!arr || arr.length < 2) return '';
  const lo = Math.min(...arr), hi = Math.max(...arr), r = hi - lo || 1;
  const pts = arr.map((v, i) => `${(i / (arr.length - 1) * w).toFixed(1)},${(h - 2 - (v - lo) / r * (h - 4)).toFixed(1)}`).join(' ');
  const up = arr[arr.length - 1] >= arr[0];
  return `<svg class="spark ${up ? 'up' : 'down'}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke-width="1.6"/></svg>`;
}
export const kv = (k, v) => `<div class="cell"><span>${k}</span><b>${v}</b></div>`;
const row = (a, b) => `<div class="row"><span>${a}</span><em>${b}</em></div>`;
const co = (g, id) => g.companies[id];
const view = g => g.companies[g.view];

export function shipState(g, s) {
  const map = { travel: ['flying', 'cyan'], mining: ['mining', 'ok'], scanning: ['scanning', 'ok'], surveying: ['surveying', 'ok'], idle: ['idle', 'warn'], nocrew: ['needs crew', 'bad'], broken: ['broken', 'bad'], stranded: ['stranded', 'bad'], waiting: ['waiting', 'warn'], loading: ['loading', 'ok'], refuel: ['refuelling', 'dim'], repair: ['repairing', 'dim'], unloading: ['unloading', 'ok'] };
  const [t, c] = map[s.state] || [s.state, 'dim']; return pill(t, c);
}
export function etaOf(g, s) {
  if (!s.dest) return ''; const d = S.distV(s.pos, S.posOf(g, s.dest)); const days = d / S.shipSpeed(g, s); return days < 1 ? Math.max(1, Math.round(days * 24)) + ' h' : days.toFixed(1) + ' days';
}

// ------------------------------------------------------------ inspectors
export function inspShip(g, s) {
  const T = SHIP_TYPES[s.type], c = co(g, s.co), mine = s.co === g.view, cs = S.crewStatus(g, s), cargo = S.cargoTotal(s);
  const sup = s.sup && g.workers[s.sup];
  const crew = s.crew.map(id => g.workers[id]).filter(Boolean).map(w => `<div class="row"><span>${btn(esc(w.name), 'pick', { id: w.id }, 'link')} <small class="dim">${ROLE_NAME[w.role] || 'Founder'}</small></span><em>${w.skill | 0}${w.fat > 60 ? ' ' + pill('tired', 'warn') : ''}</em></div>`).join('');
  const missing = cs.missing.map(r => `<div class="row"><span class="bad">Needs ${r}</span></div>`).join('');
  const prog = s.prog ? s.prog.steps.map((st, i) => `<li class="${i === s.prog.i && !s.inter.length ? 'cur' : ''}">${esc(S.describeStep(g, st))}</li>`).join('') : '';
  const loaded = Object.entries(s.cargo).filter(([, v]) => v > 0.5).map(([k, v]) => `${Math.round(v)} t ${S.keyName(k).toLowerCase()}`).join(', ');
  return `<div class="eyebrow">${esc(T.name)} · <span style="color:${c.color}">${esc(c.name)}</span></div><h1>${esc(s.name)}</h1>
  <div class="row"><span>${shipState(g, s)} <small class="dim">${esc(s.task)}</small></span><em>${s.dest ? 'ETA ' + etaOf(g, s) : ''}</em></div>
  <div class="grid">
    <div class="cell"><span>Cargo</span><b>${Math.round(cargo)} / ${T.cargo} t</b>${bar(cargo / T.cargo)}</div>
    <div class="cell"><span>Fuel · range ${S.shipRange(g, s).toFixed(1)} AU</span><b>${Math.round(s.fuel)} / ${T.fuelCap} t</b>${bar(s.fuel / T.fuelCap, s.fuel / T.fuelCap < 0.25 ? 'low' : '')}</div>
    <div class="cell"><span>Condition</span><b>${s.cond.toFixed(0)}%</b>${bar(s.cond / 100, s.cond < 40 ? 'low' : '')}</div>
    <div class="cell"><span>Speed</span><b>${(S.shipSpeed(g, s)).toFixed(2)} AU/day</b></div>
  </div>
  ${loaded ? `<small class="dim">Carrying ${esc(loaded)}</small>` : ''}
  <div class="sect">Crew ${cs.used.length}/${cs.capacity}</div>${crew}${missing}${!s.crew.length && !missing ? '<small class="dim">No crew aboard.</small>' : ''}
  ${sup ? row('Supervisor', btn(esc(sup.name), 'pick', { id: sup.id }, 'link')) : ''}
  ${s.prog ? `<div class="sect">Orders${s.prog.label ? ' · ' + esc(s.prog.label) : ''}${s.prog.repeat ? ' · repeating' : ''}</div><ol class="steps">${prog}</ol>` : '<div class="sect">Orders</div><small class="dim">No standing orders.</small>'}
  ${mine ? `<div class="acts">${btn('Orders…', 'orders', { id: s.id }, 'pri')}${btn('Crew…', 'crew', { id: s.id })}${btn('Focus', 'focus', { id: s.id })}${s.state === 'stranded' ? btn('Rescue ¢150k', 'rescue', { id: s.id }) : ''}${btn('Sell', 'sellship', { id: s.id })}</div>` : `<div class="acts">${btn('Focus', 'focus', { id: s.id })}${btn('Follow company', 'followco', { id: s.co })}</div>`}`;
}

export function astIntel(g, a) {
  const e = S.estimate(g, g.view, a), it = S.intelOf(g, g.view, a);
  if (!e) return { e: null, html: '<div class="callout">Not scanned yet. A ship with sensors must come within range to reveal its class and composition.</div>' };
  const lvlName = ['', 'Remote scan', 'Surveyed', 'In production'][e.lvl] || '';
  const sp = e.sig, lo = x => x * Math.exp(-sp), hi = x => x * Math.exp(sp);
  const comp = COMM.map((c, i) => ({ c, v: e.share[i] })).filter(x => x.v > 0.0005).sort((x, y) => y.v - x.v).map(x => `<div class="row"><span>${COMM_NAME[x.c]}</span><em>${(x.v * 100).toFixed(x.v < 0.02 ? 2 : 1)}% <small class="dim">(${(lo(x.v) * 100).toFixed(x.v < 0.02 ? 2 : 0)}–${(hi(x.v) * 100).toFixed(x.v < 0.02 ? 2 : 0)})</small></em></div>`).join('');
  return { e, html: `<div class="grid">${kv('Class', a.cls + '-type')}${kv('Knowledge', lvlName + ' · ±' + Math.round(sp * 100) + '%')}${kv('Ore reserves', fmtT(lo(e.res)) + '–' + fmtT(hi(e.res)))}${kv('Value', '¢ ' + Math.round(e.val).toLocaleString('en-US') + ' / t')}</div><div class="sect">Composition of concentrate</div>${comp}` };
}
export function inspAst(g, a) {
  const c = a.claim !== null ? co(g, a.claim) : null, mine = a.claim === g.view;
  const { e, html } = astIntel(g, a); const me = view(g);
  let sink = ''; if (e) { const b = bestSink(g, me, a.id, e.share, SHIP_TYPES.miner, 1200); sink = row('Best buyer', esc(STATIONS[b.st].short) + ' · ¢ ' + Math.round(valuePerT(g, me, b.st, e.share)) + '/t'); }
  const stk = a.stock[g.view] || {}, stTot = Object.values(stk).reduce((x, y) => x + y, 0);
  const near = S.distLoc(g, a.id, 'ceres');
  return `<div class="eyebrow">Asteroid · ${c ? `<span style="color:${c.color}">claimed by ${esc(c.name)}</span>` : 'unclaimed'}</div><h1>${esc(a.name)}</h1>
  ${html}${sink}${row('Distance from Ceres', near.toFixed(2) + ' AU')}
  ${mine ? row('Your stockpile', fmtT(stTot)) + row('Mined by you', fmtT(a.mined[g.view] || 0)) : ''}
  <div class="acts">${btn('Dispatch ship…', 'dispatch', { id: a.id }, 'pri')}${a.claim === null && e ? btn('Claim ' + fmtMoney(S.claimFee(g, a)), 'claim', { id: a.id }) : ''}${mine ? btn('Release', 'abandon', { id: a.id }) : ''}${btn('Focus', 'focus', { id: a.id })}</div>`;
}
export function inspStation(g, id) {
  const st = STATIONS[id], m = g.mk[id], me = view(g), inv = S.invOf(g, me.id, id), rf = Object.values(g.fac).find(f => f.co === me.id && f.st === id);
  const rows = COMM.map(c => { const h = m.hist[c], p = m.price[c], d = h.length > 30 ? p / h[h.length - 31] - 1 : 0; return `<tr><td>${COMM_NAME[c]}</td><td class="num">${Math.round(p).toLocaleString('en-US')}</td><td class="num ${d > 0.005 ? 'ok' : d < -0.005 ? 'bad' : 'dim'}">${d > 0 ? '+' : ''}${(d * 100).toFixed(0)}%</td><td>${spark(h.slice(-60), 64, 20)}</td><td class="num dim">${Math.round(m.stock[c])} t</td></tr>`; }).join('');
  const held = Object.entries(inv).filter(([, v]) => v > 0.5).map(([k, v]) => `${Math.round(v)} t ${S.keyName(k).toLowerCase()}`).join(', ');
  const evs = g.mev.filter(e => e.st === id && g.t < e.until).map(e => `<div class="callout">${esc(e.text)} <small class="dim">until ${S.dateOf(e.until).date}</small></div>`).join('');
  const docked = Object.values(g.ships).filter(s => s.at === id && s.co === me.id);
  return `<div class="eyebrow">Station</div><h1>${esc(st.name)}</h1>
  <table class="tbl"><thead><tr><th>Goods</th><th class="num">¢/t</th><th class="num">30d</th><th></th><th class="num">Stock</th></tr></thead><tbody>${rows}</tbody></table>
  <small class="dim">Raw ore sells at ${Math.round(S.ORE_FACTOR * 100)}% of these prices. Refined goods sell in full. Fuel ¢ ${Math.round(S.fuelPrice(g, id))} / t.</small>
  ${evs}
  ${held ? row('Your warehouse', esc(held)) : ''}
  ${rf ? `<div class="sect">Your refinery</div>${row('Status', rf.state === 'construction' ? 'Ready ' + S.dateOf(rf.done).date : 'Active · staff ' + Math.round(S.facStaffFactor(g, rf) * 100) + '%')}${row('Ore waiting', fmtT(Object.values(rf.in).reduce((x, y) => x + y, 0)))}${row('Output', rf.sell === 'local' ? 'sold here' : 'held for hauling')}<div class="acts">${btn(rf.sell === 'local' ? 'Hold output' : 'Sell output here', 'togglesell', { id: rf.id })}</div>` : `<div class="acts">${btn('Build refinery ' + fmtMoney(S.REFINERY.cost), 'build', { id })}</div>`}
  ${docked.length ? row('Your ships here', docked.map(s => esc(s.name)).join(', ')) : ''}
  <div class="acts">${btn('Contracts', 'contracts', { id })}${btn('Focus', 'focus', { id })}</div>`;
}
export function inspWorker(g, w) {
  const c = co(g, w.co), mine = w.co === g.view, ship = w.ship && g.ships[w.ship], boss = w.boss && g.workers[w.boss];
  const sv = Object.values(g.workers).find(x => x.team && x.team.includes(w.ship));
  const hist = w.hist.slice(-6).reverse().map(h => `<div class="row"><span>${esc(h.txt)}</span><em>${S.dateOf(h.t).date}</em></div>`).join('');
  const team = w.team && w.team.length ? row('Runs', w.team.map(id => esc(g.ships[id]?.name || '')).join(', ')) : '';
  const mg = w.mgr ? row('Objective', esc(w.mgr.obj)) + row('Spending authority', fmtMoney(w.mgr.spend) + '/month') + row('Spent this month', fmtMoney(w.mgr.spent)) : '';
  return `<div class="eyebrow">${esc(w.founder ? 'Founder' : ROLE_NAME[w.role])} · <span style="color:${c?.color}">${esc(c?.name || '')}</span></div><h1>${esc(w.name)}</h1>
  <div class="grid">${kv('Skill', (w.skill | 0) + ' <small class="dim">/ potential ' + w.pot + '</small>')}${kv('Leadership', w.lead)}${kv('Fatigue', Math.round(w.fat) + '%')}${kv('Pay', w.founder ? '—' : fmtMoney(w.sal) + '/day')}</div>
  ${bar(w.skill / 100)}
  ${row('Assignment', w.ship ? btn(esc(ship?.name || ''), 'pick', { id: w.ship }, 'link') : w.fac ? 'Refinery, ' + esc(STATIONS[g.fac[w.fac]?.st]?.short) : 'Bench')}
  ${team}${mg}${row('Age', w.age)}${row('Employed since', S.dateOf(w.hired).date)}
  <div class="sect">Career</div>${hist || '<small class="dim">No history yet.</small>'}
  ${mine ? `<div class="acts">${btn('Assign…', 'assign', { id: w.id }, 'pri')}${w.role === 'supervisor' || w.role === 'manager' ? btn('Team…', 'team', { id: w.id }) : ''}${w.mgr ? btn('Authority…', 'authority', { id: w.id }) : ''}${!w.founder && w.role !== 'manager' ? btn('Promote…', 'promote', { id: w.id }) : ''}${btn('Follow', 'followw', { id: w.id })}${!w.founder ? btn('Fire', 'fire', { id: w.id }) : ''}</div>` : ''}`;
}
export function inspCompany(g, c) {
  const sh = S.shipsOf(g, c.id), ws = S.workersOf(g, c.id);
  return `<div class="eyebrow">Company${c.dead ? ' · bankrupt' : c.ai ? ' · AI-run' : ' · you'}</div><h1 style="color:${c.color}">${esc(c.name)}</h1>
  <div class="grid">${kv('Cash', fmtMoney(c.cash))}${kv('Debt', fmtMoney(c.debt))}${kv('Ships', sh.length)}${kv('People', ws.length)}${kv('Claims', S.claimsOf(g, c.id).length)}${kv('Refineries', S.facilitiesOf(g, c.id).length)}</div>
  ${row('Philosophy', esc((S.PHILOSOPHY[c.philosophy] || {}).name || ''))}${row('Headquarters', esc(STATIONS[c.hq].short))}
  <div class="acts">${btn('Follow company', 'followco', { id: c.id }, 'pri')}${btn('View as this company', 'viewco', { id: c.id })}${c.id === g.view ? (c.ai ? btn('Take control', 'takectl') : btn('Hand to AI', 'handai')) : ''}</div>`;
}

// ------------------------------------------------------------ management panels
export function panelFleet(g) {
  const me = view(g), ships = S.shipsOf(g, me.id);
  const rows = ships.map(s => { const T = SHIP_TYPES[s.type]; return `<tr data-a="pickfocus" data-id="${s.id}" class="click"><td><b>${esc(s.name)}</b><br><small class="dim">${T.name}</small></td><td>${shipState(g, s)}<br><small class="dim">${esc(s.task)}</small></td><td class="num">${Math.round(S.cargoTotal(s) / T.cargo * 100)}%</td><td class="num">${Math.round(s.fuel / T.fuelCap * 100)}%</td><td class="num">${Math.round(s.cond)}%</td><td class="num">${s.crew.length}</td></tr>`; }).join('');
  return `<div class="acts">${btn('Buy ship…', 'buyship', {}, 'pri')}</div><div class="scroll"><table class="tbl"><thead><tr><th>Ship</th><th>Status</th><th class="num">Cargo</th><th class="num">Fuel</th><th class="num">Cond.</th><th class="num">Crew</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="dim">No ships yet.</td></tr>'}</tbody></table></div>`;
}
export function panelPeople(g, U) {
  const me = view(g), ws = S.workersOf(g, me.id).sort((a, b) => (a.founder ? -1 : b.founder ? 1 : a.role.localeCompare(b.role) || b.skill - a.skill));
  const rows = ws.map(w => `<tr class="click" data-a="pickw" data-id="${w.id}"><td><b>${esc(w.name)}</b><br><small class="dim">${w.founder ? 'Founder' : ROLE_NAME[w.role]}</small></td><td class="num">${w.skill | 0}<small class="dim">/${w.pot}</small></td><td>${w.ship ? esc(g.ships[w.ship]?.name || '') : w.fac ? 'Refinery' : pill('bench', 'warn')}</td><td class="num">${w.founder ? '—' : fmtMoney(w.sal)}</td></tr>`).join('');
  const f = U.roleFilter || 'all';
  const chips = ['all', ...S.ROLES].map(r => `<button class="chip ${f === r ? 'on' : ''}" data-a="rolefilter" data-r="${r}">${r === 'all' ? 'All' : ROLE_NAME[r]}</button>`).join('');
  const cands = g.labour.filter(c => f === 'all' || c.role === f).sort((a, b) => b.skill - a.skill).map(c => `<tr><td><b>${esc(c.name)}</b><br><small class="dim">${ROLE_NAME[c.role]}${c.role === 'supervisor' || c.role === 'manager' ? ' · lead ' + c.lead : ''}</small></td><td class="num">${c.skill}<small class="dim">/${c.pot}</small></td><td class="num">${fmtMoney(c.sal)}/d</td><td>${btn('Hire ' + fmtMoney(c.sal * 10), 'hire', { id: c.id })}</td></tr>`).join('');
  return `<div class="sect">Employees · payroll ${fmtMoney(S.payrollPerDay(g, me.id))}/day</div><div class="scroll"><table class="tbl"><thead><tr><th>Name</th><th class="num">Skill</th><th>Assigned</th><th class="num">Pay/day</th></tr></thead><tbody>${rows}</tbody></table></div>
  <div class="sect">Labour market</div><div class="chips">${chips}</div><div class="scroll"><table class="tbl"><thead><tr><th>Candidate</th><th class="num">Skill/pot.</th><th class="num">Pay</th><th></th></tr></thead><tbody>${cands || '<tr><td colspan="4" class="dim">Nobody matching right now. The market refreshes weekly.</td></tr>'}</tbody></table></div>`;
}
export function panelMarket(g, U) {
  const cols = STATION_IDS.map(id => `<th class="num">${STATIONS[id].short}</th>`).join('');
  const rows = COMM.map(c => `<tr><td><b>${COMM_NAME[c]}</b></td>${STATION_IDS.map(id => { const h = g.mk[id].hist[c]; const d = h.length > 30 ? g.mk[id].price[c] / h[h.length - 31] - 1 : 0; return `<td class="num">${Math.round(g.mk[id].price[c]).toLocaleString('en-US')}<br><small class="${d > 0.005 ? 'ok' : d < -0.005 ? 'bad' : 'dim'}">${d > 0 ? '+' : ''}${(d * 100).toFixed(0)}%</small></td>`; }).join('')}</tr>`).join('');
  const ev = g.mev.filter(e => g.t < e.until).map(e => `<div class="callout">${esc(e.text)} <small class="dim">until ${S.dateOf(e.until).date}</small></div>`).join('');
  const open = g.contracts.filter(c => c.taker === null).map(c => `<tr><td>${STATIONS[c.st].short}</td><td>${c.qty} t ${COMM_NAME[c.c]}</td><td class="num">${fmtMoney(c.price)}/t</td><td class="num">${c.days} d</td><td>${btn('Accept', 'accept', { id: c.id })}</td></tr>`).join('');
  const mine = g.contracts.filter(c => c.taker === g.view && !c.done && !c.failed).map(c => { const have = S.invOf(g, g.view, c.st)[c.c] || 0; return `<tr><td>${STATIONS[c.st].short}</td><td>${c.qty} t ${COMM_NAME[c.c]}</td><td class="num">${fmtMoney(c.qty * c.price)}</td><td class="num">by ${S.dateOf(c.until).date}</td><td><small class="dim">${Math.round(have)} t in warehouse</small></td></tr>`; }).join('');
  return `<div class="sect">Refined prices, ¢ per tonne (30-day change)</div><div class="scroll"><table class="tbl"><thead><tr><th></th>${cols}</tr></thead><tbody>${rows}</tbody></table></div>
  <small class="dim">Raw ore sells for ${Math.round(S.ORE_FACTOR * 100)}% of the refined price. A refinery keeps the rest.</small>${ev}
  <div class="sect">Contracts on offer</div><div class="scroll"><table class="tbl"><tbody>${open || '<tr><td class="dim">None right now.</td></tr>'}</tbody></table></div>
  ${mine ? `<div class="sect">Your contracts</div><div class="scroll"><table class="tbl"><tbody>${mine}</tbody></table></div><small class="dim">Deliver refined goods to the station warehouse (Unload with store, or refinery output on hold). They are collected automatically.</small>` : ''}`;
}
export function panelFinance(g) {
  const me = view(g), h = me.hist.slice(-30), tot = {}; for (const d of h) for (const [k, v] of Object.entries(d)) if (k !== 't' && k !== 'cash') tot[k] = (tot[k] || 0) + v;
  const cats = [['sales', 'Sales'], ['payroll', 'Payroll and hiring'], ['upkeep', 'Ship upkeep'], ['fuel', 'Fuel'], ['repair', 'Repairs'], ['interest', 'Interest'], ['other', 'Refining and other'], ['capex', 'Ships and facilities'], ['claims', 'Claims']];
  const op = ['sales', 'payroll', 'upkeep', 'fuel', 'repair', 'interest', 'other'].reduce((s, k) => s + (tot[k] || 0), 0);
  const rows = cats.map(([k, n]) => tot[k] ? `<tr><td>${n}</td><td class="num ${tot[k] > 0 ? 'ok' : ''}">${fmtMoney(tot[k])}</td></tr>` : '').join('');
  const cash = me.hist.map(x => x.cash), assets = S.shipsOf(g, me.id).reduce((s, x) => s + SHIP_TYPES[x.type].cost * 0.55 * x.cond / 100, 0);
  const P = me.policy, sel = (id, cur, opts) => `<select id="${id}" data-a="policy" data-k="${id}">${opts.map(([v, t]) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  return `<div class="grid">${kv('Cash', fmtMoney(me.cash))}${kv('Debt', fmtMoney(me.debt))}${kv('Operating result, 30 days', `<span class="${op >= 0 ? 'ok' : 'bad'}">${fmtMoney(op)}</span>`)}${kv('Fleet resale value', fmtMoney(assets))}</div>
  ${spark(cash.slice(-120), 320, 60)}
  <div class="sect">Last 30 days</div><table class="tbl"><tbody>${rows || '<tr><td class="dim">No activity yet.</td></tr>'}</tbody></table>
  <div class="sect">Loans</div><div class="acts">${btn('Borrow ¢ 5 M', 'borrow', { n: 5e6 })}${btn('Repay ¢ 5 M', 'repay', { n: 5e6 })}${btn('Repay all', 'repay', { n: 1e12 })}</div><small class="dim">9% a year. Bankruptcy follows twenty days below ¢ −250,000.</small>
  <div class="sect">Company policy</div>
  <label class="field"><span>Maintenance</span>${sel('maint', P.maint, [[90, 'Repair below 90%'], [75, 'Repair below 75%'], [50, 'Repair below 50%']])}</label>
  <label class="field"><span>Fuel reserve</span>${sel('fuelRes', P.fuelRes, [[0.1, '10%'], [0.2, '20%'], [0.3, '30%'], [0.5, '50%']])}</label>
  <label class="field"><span>Risk posture</span>${sel('risk', P.risk, [['conservative', 'Conservative: slower, safer'], ['balanced', 'Balanced'], ['aggressive', 'Aggressive: faster, more wear']])}</label>`;
}
export function panelOrg(g) {
  const me = view(g), ws = S.workersOf(g, me.id), mgrs = ws.filter(w => w.role === 'manager'), sups = ws.filter(w => w.role === 'supervisor'), ships = S.shipsOf(g, me.id);
  const req = g.requests.filter(r => r.co === me.id).map(r => { const m = g.workers[r.by]; return `<div class="request"><b>${esc(m ? m.name : 'A manager')}</b> asks for ${fmtMoney(r.cost)}<br><small>${esc(r.why)}</small><div class="acts">${btn('Approve', 'reqok', { id: r.id }, 'pri')}${btn('Reject', 'reqno', { id: r.id })}${m ? btn('Review', 'pickw', { id: m.id }) : ''}</div></div>`; }).join('');
  const line = w => `<div class="org ${w.role}"><div class="row"><span>${btn(esc(w.name), 'pickw', { id: w.id }, 'link')} <small class="dim">${ROLE_NAME[w.role]} · lead ${w.lead}</small></span><em>${w.team.length} ships</em></div>${w.mgr ? `<small class="dim">${esc(w.mgr.obj)} · up to ${fmtMoney(w.mgr.spend)}/month</small>` : ''}<div class="acts">${btn('Team…', 'team', { id: w.id })}${w.mgr ? btn('Authority…', 'authority', { id: w.id }) : ''}</div></div>`;
  const direct = ships.filter(s => !s.sup || !g.workers[s.sup]);
  const dec = g.decisions.filter(d => d.co === me.id).slice(-25).reverse().map(d => `<div class="row"><span><b>${esc(d.actor)}</b> ${esc(d.text)}</span><em>${S.dateOf(d.t).date}</em></div>`).join('');
  return `${req ? `<div class="sect">Waiting for your decision</div>${req}` : ''}
  <div class="sect">Managers</div>${mgrs.map(line).join('') || '<small class="dim">None. Managers run a set of ships, set their own goals and ask you for money above their limit. Promote or hire a manager.</small>'}
  <div class="sect">Supervisors</div>${sups.map(line).join('') || '<small class="dim">None. A supervisor turns your goal into orders for the ships on their team.</small>'}
  <div class="sect">Directly run by you: ${direct.length} ships</div><small class="dim">${direct.map(s => esc(s.name)).join(', ') || 'None.'}</small>
  <div class="sect">Recent decisions and their reasons</div>${dec || '<small class="dim">Decisions will appear here as your people and AI leadership act.</small>'}`;
}
export function panelLog(g, U) {
  const f = U.logFilter || 'all';
  const list = g.events.filter(e => f === 'all' || e.co === g.view).slice(-120).reverse().map(e => `<div class="ev ${e.sev}"><time>${S.dateOf(e.t).date}</time><span>${esc(e.msg)}</span></div>`).join('');
  return `<div class="chips"><button class="chip ${f === 'all' ? 'on' : ''}" data-a="logfilter" data-f="all">Everything</button><button class="chip ${f === 'mine' ? 'on' : ''}" data-a="logfilter" data-f="mine">My company</button></div>${list}`;
}
export function panelRivals(g) {
  const rows = g.companies.map(c => `<tr class="click" data-a="pickco" data-id="${c.id}"><td><b style="color:${c.color}">${esc(c.name)}</b><br><small class="dim">${c.dead ? 'bankrupt' : c.ai ? 'AI · ' + esc((S.PHILOSOPHY[c.philosophy] || {}).name || '') : 'you'}</small></td><td class="num">${S.shipsOf(g, c.id).length}</td><td class="num">${S.claimsOf(g, c.id).length}</td><td class="num">${fmtMoney(c.cash)}</td></tr>`).join('');
  return `<div class="scroll"><table class="tbl"><thead><tr><th>Company</th><th class="num">Ships</th><th class="num">Claims</th><th class="num">Cash</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
