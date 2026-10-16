// The Belt: delegation and AI leadership. Supervisors, managers and AI executives all act through the same
// planning helpers, using the same actions a player has. Every decision records a reason (see S.why).
import * as S from './sim.js';
const { SHIP_TYPES, STATION_IDS, STATIONS, COMM, ORE_FACTOR, REFINE_YIELD, shipsOf, workersOf, claimsOf, facilitiesOf, estimate, intelOf, fmtMoney, fmtT } = S;

const cap = (v, a, b) => Math.max(a, Math.min(b, v));
const co$ = (g, id) => g.companies[id];
const stationDocked = s => s.at && S.isStation(s.at);

// ---------------------------------------------------------------- valuation helpers
export function valuePerT(g, co, st, share) {   // credits per tonne of concentrate delivered to a station
  const rf = S.refineryAt(g, co.id, st); let v = 0;
  share.forEach((sh, i) => { v += sh * S.price(g, st, COMM[i]) * (rf ? REFINE_YIELD : ORE_FACTOR); });
  return rf ? v - S.REFINERY.opex : v;
}
export function bestSink(g, co, from, share, T, cargo) {
  let best = null; const fp = 300;
  for (const st of STATION_IDS) {
    const d = S.distLoc(g, from, st), rev = cargo * valuePerT(g, co, st, share) - 2 * d * (T.fuelBase + T.fuelCargo * cargo / 2) * fp * STATIONS[st].fuel;
    const days = 2 * d / T.speed + 3, rate = rev / days;
    if (!best || rate > best.rate) best = { st, rate, d, days, rev };
  }
  return best;
}
const stockShare = (a, coId) => { const stk = a.stock[coId] || {}; const tot = Object.values(stk).reduce((x, y) => x + y, 0); if (!tot) return S.trueShare(a); return COMM.map(c => (stk[c + '_ore'] || 0) / tot); };
const stockTotal = (a, coId) => Object.values(a.stock[coId] || {}).reduce((x, y) => x + y, 0);
const maxMiners = e => Math.max(1, Math.min(4, Math.round(e.res / 150e3)));
const targeted = (g, coId, astId, kind) => shipsOf(g, coId).filter(x => x.prog && x.prog.steps.some(st => (kind === 'mine' ? st.t === 'mine' && st.ast === astId : st.t === 'load' && st.loc === astId))).length;
const reserveOf = (g, co) => {
  let up = 0; for (const s of shipsOf(g, co.id)) up += SHIP_TYPES[s.type].upkeep;
  return S.lean(co).reserve * (S.payrollPerDay(g, co.id) + up) + 250000;
};

// ---------------------------------------------------------------- per-ship planning (what a supervisor does)
export function benchWorkers(g, coId, role) { return workersOf(g, coId).filter(w => !w.ship && !w.fac && !w.founder && w.role === role); }
export function staffShip(g, co, s) {   // fill crew from the company's bench; the ship must be docked
  if (!stationDocked(s)) return 0;
  const cs = S.crewStatus(g, s); let n = 0;
  for (const role of cs.missing) { const w = benchWorkers(g, co.id, role).sort((a, b) => b.skill - a.skill)[0]; if (w && S.assignCrew(g, co.id, w.id, s.id).ok) n++; }
  const T = SHIP_TYPES[s.type];
  if (s.crew.length < T.crew.req.length + T.crew.opt.length) {   // spare people fill optional berths: miners and engineers first
    for (const role of ['engineer', 'miner', 'surveyor']) { const w = benchWorkers(g, co.id, role)[0]; if (w && S.assignCrew(g, co.id, w.id, s.id).ok) { n++; break; } }
  }
  return n;
}
function candidatesToMine(g, co, s, q) {
  const T = SHIP_TYPES[s.type], out = [];
  for (const a of claimsOf(g, co.id)) {
    if (a.res < 2000) continue; const e = estimate(g, co.id, a); if (!e) continue;
    if (targeted(g, co.id, a.id, 'mine') >= maxMiners(e)) continue;
    const sink = bestSink(g, co, a.id, e.share, T, T.cargo); out.push({ a, e, sink, score: sink.rate });
  }
  out.sort((x, y) => y.score - x.score);
  if (out.length > 1 && S.rnd(g) < (1 - q) * 0.5) return [out[Math.min(out.length - 1, 1 + (S.rnd(g) * 2 | 0))]];   // weaker leaders sometimes pick badly
  return out;
}
const stockpileMode = (g, co, s, a, sinkD) => {   // stockpile only while the tugs can actually keep up
  const tugT = SHIP_TYPES.tug, tugs = shipsOf(g, co.id).filter(x => x.type === 'tug'); if (!tugs.length || sinkD < 0.9) return false;
  const cycle = 2 * sinkD / tugT.speed + 3, tugCap = tugs.length * tugT.cargo / cycle * 0.8;
  const out = SHIP_TYPES[s.type].mine * 0.9 * 24;
  const stk = shipsOf(g, co.id).filter(x => x !== s && x.prog && x.prog.steps.some(st => st.t === 'mine' && st.mode === 'stockpile')).length;
  return (stk + 1) * out <= tugCap;
};
export function planShip(g, co, s, q = 0.6, actor = 'AI leadership') {
  if (s.prog && s.prog.steps.length && !s.prog.stale) return false;
  if (['travel', 'broken', 'stranded', 'nocrew'].includes(s.state)) return false;
  if (!S.crewStatus(g, s).ok) return false;
  const T = SHIP_TYPES[s.type];
  const claims = claimsOf(g, co.id);
  if (s.type === 'miner' || (s.type === 'prospector' && claims.some(a => a.res > 2000 && targeted(g, co.id, a.id, 'mine') < 1))) {
    const c = candidatesToMine(g, co, s, q)[0];
    if (c) {
      const mode = stockpileMode(g, co, s, c.a, c.sink.d) ? 'stockpile' : 'carry';
      S.setProgram(g, s.id, S.miningRun(g, s, c.a.id, c.sink.st, mode), true, 'Mining run', true);
      S.why(g, co.id, actor, s.name + ' will mine ' + c.a.name + (mode === 'stockpile' ? ' into its stockpile' : ' and sell at ' + STATIONS[c.sink.st].short) + '. Estimated ' + Math.round(c.sink.rate).toLocaleString('en-US') + ' ¢/day at current prices.');
      return true;
    }
    if (s.type === 'miner') return false;
  }
  if (s.type === 'tug') return planHaul(g, co, s, actor);
  if (s.type === 'survey' || s.type === 'prospector') return planExplore(g, co, s, q, actor);
  return false;
}
function planHaul(g, co, s, actor) {
  const T = SHIP_TYPES[s.type]; let best = null;
  for (const a of claimsOf(g, co.id)) {
    const tot = stockTotal(a, co.id); if (tot < Math.min(400, T.cargo * 0.3) || targeted(g, co.id, a.id, 'load') >= Math.max(1, Math.floor(tot / (T.cargo * 0.8)))) continue;
    const sh = stockShare(a, co.id), sink = bestSink(g, co, a.id, sh, T, Math.min(tot, T.cargo));
    const sc = sink.rate; if (!best || sc > best.sc) best = { loc: a.id, sink, sc, tot, name: a.name };
  }
  for (const f of facilitiesOf(g, co.id)) {   // refined goods held at a refinery station
    if (f.state !== 'active' || f.sell !== 'hold') continue; const inv = S.invOf(g, co.id, f.st); const tot = COMM.reduce((x, c) => x + (inv[c] || 0), 0);
    if (tot < 300 || shipsOf(g, co.id).some(x => x.prog && x.prog.steps.some(st => st.t === 'load' && st.loc === f.st))) continue;
    let bs = null; for (const st of STATION_IDS) { if (st === f.st) continue; const v = COMM.reduce((x, c) => x + (inv[c] || 0) * S.price(g, st, c), 0); const d = S.distLoc(g, f.st, st); const r = v / (2 * d / T.speed + 3); if (!bs || r > bs.r) bs = { st, r }; }
    if (bs && (!best || bs.r > best.sc)) best = { loc: f.st, sink: { st: bs.st, rate: bs.r }, sc: bs.r, tot, name: STATIONS[f.st].short + ' warehouse' };
  }
  if (!best) return false;
  S.setProgram(g, s.id, S.haulRun(g, s, best.loc, best.sink.st), true, 'Haul run', true);
  S.why(g, co.id, actor, s.name + ' will haul ' + fmtT(best.tot) + ' from ' + best.name + ' to ' + STATIONS[best.sink.st].short + '.');
  return true;
}
function planExplore(g, co, s, q, actor) {
  const T = SHIP_TYPES[s.type], pos = s.pos;
  const scanned = [], intel = g.intel[co.id]; let lvl2 = 0;
  for (const id in intel) { const a = g.ast[+id.slice(1)]; if (a.claim !== null) continue; const it = intel[id]; if (it.lvl >= 2) lvl2++; else if (it.lvl === 1) scanned.push({ a, e: estimate(g, co.id, a) }); }
  scanned.sort((x, y) => y.e.val * Math.min(y.e.res, 8e5) - x.e.val * Math.min(x.e.res, 8e5));
  const list = g.ast;
  if (scanned.length && lvl2 < 4 && S.rnd(g) < 0.5 + q * 0.5) {
    const t = scanned[0];
    S.setProgram(g, s.id, [{ t: 'survey', ast: t.a.id }], false, 'Survey', true);
    S.why(g, co.id, actor, s.name + ' will survey ' + t.a.name + ' (class ' + t.a.cls + ', worth about ' + Math.round(t.e.val) + ' ¢/t of ore).'); return true;
  }
  const home = S.posOf(g, 'ceres'); const near = list.filter(a => a.claim === null && !intel[a.id]).map(a => ({ a, d: S.distV(S.posOf(g, a.id), home) + 0.4 * S.distV(S.posOf(g, a.id), pos) })).sort((x, y) => x.d - y.d).slice(0, 3);
  if (!near.length) return false;
  S.setProgram(g, s.id, near.map(x => ({ t: 'scan', ast: x.a.id })), false, 'Scan run', true);
  S.why(g, co.id, actor, s.name + ' will scan ' + near.map(x => x.a.name).join(', ') + ' to find new deposits.'); return true;
}

// ---------------------------------------------------------------- supervisors and managers
function coverShips(g, co, ships, q, actor) {
  for (const s of ships) { if (!g.ships[s.id]) continue; if (s.state === 'nocrew' || !S.crewStatus(g, s).ok) staffShip(g, co, s); else if (s.state === 'idle' || !s.prog) { if (stationDocked(s) && s.crew.length < SHIP_TYPES[s.type].crew.req.length + SHIP_TYPES[s.type].crew.opt.length) staffShip(g, co, s); } planShip(g, co, s, q, actor); }
}
export function superDaily(g, co, w) {
  const q = cap(0.25 + w.lead / 110 + w.skill / 300, 0.2, 1);
  const team = w.team.map(id => g.ships[id]).filter(Boolean); w.team = team.map(s => s.id);
  coverShips(g, co, team, q, w.name + ' (supervisor)');
}
function staffFacilities(g, co) {
  for (const f of facilitiesOf(g, co.id)) { if (f.state !== 'active') continue; const n = workersOf(g, co.id).filter(w => w.fac === f.id).length; for (let i = n; i < S.REFINERY.staff; i++) { const w = benchWorkers(g, co.id, 'engineer')[0]; if (w) S.assignFacility(g, co.id, w.id, f.id); } }
}
export function managerDaily(g, co, w) {
  const q = cap(0.3 + w.lead / 110 + w.skill / 300, 0.2, 1);
  const own = w.team.map(id => g.ships[id]).filter(Boolean); w.team = own.map(s => s.id);
  const loose = shipsOf(g, co.id).filter(s => !s.sup || !g.workers[s.sup]);
  coverShips(g, co, [...own.filter(s => g.workers[s.sup]?.role === 'manager' || s.sup === w.id), ...loose], q, w.name + ' (manager)');
  staffFacilities(g, co);
  if (!co.ai) growth(g, co, w);   // AI-run companies grow through the executive below, so decisions are not duplicated
}

// ---------------------------------------------------------------- growth: what to buy, hire, claim or build
function bestCandidate(g, role) {
  return g.labour.filter(w => w.role === role).sort((a, b) => (b.skill + b.pot * 0.4 + (role === 'supervisor' || role === 'manager' ? b.lead * 0.6 : 0) - b.sal / 12) - (a.skill + a.pot * 0.4 + (role === 'supervisor' || role === 'manager' ? a.lead * 0.6 : 0) - a.sal / 12))[0] || null;
}
function minerEconomics(g, co) {
  const T = SHIP_TYPES.miner; let best = null, totalFree = 0;
  for (const a of claimsOf(g, co.id)) {
    if (a.res < 20000) continue; const e = estimate(g, co.id, a); if (!e) continue; const free = maxMiners(e) - targeted(g, co.id, a.id, 'mine'); if (free <= 0) continue;
    totalFree += free; const sink = bestSink(g, co, a.id, e.share, T, T.cargo); const stock = shipsOf(g, co.id).some(s => s.type === 'tug');
    const mineDays = T.cargo / (T.mine * 0.9 * 24), cycle = mineDays + 2 * sink.d / T.speed + 1;
    const gross = stock ? T.mine * 0.9 * 24 * 0.8 * valuePerT(g, co, sink.st, e.share) : T.cargo * valuePerT(g, co, sink.st, e.share) / cycle;
    const costs = 2 * 280 + T.upkeep + 350;
    const net = gross - costs; if (!best || net > best.net) best = { a, e, net, free, sink };
  }
  if (best) best.totalFree = totalFree;
  return best;
}
function shipCountFor(g, co, type) { return shipsOf(g, co.id).filter(s => s.type === type).length; }

// Each call takes at most one step, so an organisation grows in visible increments.
export function growth(g, co, actor = null, ai = false) {
  const L = S.lean(co), reserve = reserveOf(g, co), mg = actor?.mgr, name = actor ? actor.name + ' (manager)' : 'AI leadership';
  const obj = mg?.obj || (co.obj) || 'profit';
  const allow = mg ? { hire: mg.hire, buy: mg.buy, claim: mg.claim, build: mg.build } : { hire: true, buy: true, claim: true, build: true };
  const budgetLeft = mg ? mg.spend - mg.spent : Infinity;
  const payback = L.payback * (obj === 'volume' ? 1.4 : obj === 'profit' ? 0.9 : 1);
  const pendingSame = (kind, key) => g.requests.some(r => r.co === co.id && r.by === actor?.id && r.kind === kind && r.key === key);
  // helper: do the thing now if authority and cash allow, otherwise ask the owner (player companies) or stop
  const act = (kind, key, cost, why, permitted, run) => {
    const affordable = co.cash - cost >= (kind === 'hire' ? reserve * 0.3 : reserve * 0.5);
    if (!affordable) return false;
    if (!permitted || cost > budgetLeft) {
      if (ai || !actor || pendingSame(kind, key)) return false;
      g.requests.push({ id: 'r' + (g.nid++), co: co.id, by: actor.id, kind, key, cost, why, t: g.t, ...run.args });
      S.log(g, actor.name + ' asks for approval: ' + why, { co: co.id, sev: 'warn', slow: true }); return true;
    }
    const res = run.go(); if (res.ok) { if (mg) mg.spent += cost; S.why(g, co.id, name, why); } return res.ok;
  };
  const ships = shipsOf(g, co.id);
  // A. crew shortages
  for (const s of ships) {
    const cs = S.crewStatus(g, s); if (cs.ok) continue;
    for (const role of cs.missing) {
      if (benchWorkers(g, co.id, role).length) continue;
      const c = bestCandidate(g, role); if (!c) continue;
      if (act('hire', c.id, c.sal * 10, 'Hire ' + c.name + ' (' + S.ROLE_NAME[role].toLowerCase() + ', skill ' + c.skill + ') because ' + s.name + ' has no ' + role + '.', allow.hire, { args: { cid: c.id }, go: () => S.hireCandidate(g, co.id, c.id) })) return true;
    }
  }
  // refinery staff
  for (const f of facilitiesOf(g, co.id)) if (f.state === 'active') { const n = workersOf(g, co.id).filter(w => w.fac === f.id).length;
    if (n < S.REFINERY.staff && !benchWorkers(g, co.id, 'engineer').length) { const c = bestCandidate(g, 'engineer'); if (c && act('hire', c.id, c.sal * 10, 'Hire engineer ' + c.name + ' to staff the ' + STATIONS[f.st].short + ' refinery.', allow.hire, { args: { cid: c.id }, go: () => S.hireCandidate(g, co.id, c.id) })) return true; } }
  // B. exploration
  const explorers = ships.filter(s => s.type === 'survey' || s.type === 'prospector').length;
  const known = g.ast.filter(a => a.claim === null && (intelOf(g, co.id, a)?.lvl || 0) >= 2).length;
  const eco = minerEconomics(g, co);
  if (!explorers && known < 2 * L.explore && S.SHIP_TYPES.survey.cost + reserve < co.cash) {
    if (act('buyShip', 'survey', SHIP_TYPES.survey.cost, 'Buy a survey vessel: no deposits are left to develop and nobody is exploring.', allow.buy, { args: { type: 'survey' }, go: () => S.buyShip(g, co.id, 'survey') })) return true;
  }
  if (obj === 'explore' && shipCountFor(g, co, 'survey') < 2 && ships.length >= 4 && act('buyShip', 'survey2', SHIP_TYPES.survey.cost, 'Buy a second survey vessel to widen the search.', allow.buy, { args: { type: 'survey' }, go: () => S.buyShip(g, co.id, 'survey') })) return true;
  // C. claims
  if (!eco || eco.totalFree < 2) {
    const cands = g.ast.filter(a => a.claim === null).map(a => ({ a, e: estimate(g, co.id, a) })).filter(x => x.e && (x.e.lvl >= 2 || !explorers && x.e.lvl >= 1) && x.e.val > 120)
      .sort((x, y) => y.e.val * Math.min(y.e.res, 6e5) - x.e.val * Math.min(x.e.res, 6e5));
    const t = cands[0];
    if (t) { const fee = S.claimFee(g, t.a); if (act('claim', t.a.id, fee, 'Claim ' + t.a.name + ': class ' + t.a.cls + ', about ' + fmtT(t.e.res) + ' of ore worth ' + Math.round(t.e.val) + ' ¢/t.', allow.claim, { args: { ast: t.a.id }, go: () => S.claim(g, co.id, t.a.id) })) return true; }
  }
  // D. mining capacity
  const tugs = shipCountFor(g, co, 'tug'), miners = shipCountFor(g, co, 'miner') + ships.filter(s => s.type === 'prospector').length;
  if (eco && eco.net > 0) {
    const pb = SHIP_TYPES.miner.cost / eco.net;
    if (pb < payback && act('buyShip', 'miner', SHIP_TYPES.miner.cost, 'Buy a mining vessel for ' + eco.a.name + ': about ' + Math.round(eco.net).toLocaleString('en-US') + ' ¢/day net, payback ' + Math.round(pb) + ' days.', allow.buy, { args: { type: 'miner' }, go: () => S.buyShip(g, co.id, 'miner') })) return true;
  }
  // E. tugs when stockpiles pile up
  const piled = claimsOf(g, co.id).reduce((s, a) => s + stockTotal(a, co.id), 0);
  if ((piled > 2500 * Math.max(1, tugs) || (miners >= 3 && tugs < Math.floor(miners / 2) * L.haul && L.haul > 1)) && tugs < 8 && act('buyShip', 'tug', SHIP_TYPES.tug.cost, 'Buy a cargo tug: ' + fmtT(piled) + ' is waiting in claim stockpiles.', allow.buy, { args: { type: 'tug' }, go: () => S.buyShip(g, co.id, 'tug') })) return true;
  // F. refinery
  if (facilitiesOf(g, co.id).length < 2 && co.sold30 >= L.refine * (facilitiesOf(g, co.id).length + 1) && co.sold30 > 300) {
    const sink = Object.entries(co.sink || {}).sort((a, b) => b[1] - a[1])[0]; const st = sink && !facilitiesOf(g, co.id).some(f => f.st === sink[0]) ? sink[0] : 'ceres';
    if (!facilitiesOf(g, co.id).some(f => f.st === st) && act('build', st, S.REFINERY.cost, 'Build a refinery at ' + STATIONS[st].short + ': ' + Math.round(co.sold30) + ' t of ore sold recently at only ' + Math.round(ORE_FACTOR * 100) + '% of the refined price.', allow.build, { args: { st }, go: () => S.buildRefinery(g, co.id, st) })) return true;
  }
  return false;
}

// ---------------------------------------------------------------- AI executive: runs a company that has no human at the helm
export function execDaily(g, co) {
  const q = 0.7;
  const uncovered = shipsOf(g, co.id).filter(s => !s.sup || !g.workers[s.sup]);
  coverShips(g, co, uncovered, q, 'AI leadership');
  staffFacilities(g, co);
  const ws = workersOf(g, co.id), ships = shipsOf(g, co.id);
  const sups = ws.filter(w => w.role === 'supervisor'), mgrs = ws.filter(w => w.role === 'manager');
  const L = S.lean(co);
  if (ships.length >= 6 && sups.length * 8 < ships.length && co.cash > reserveOf(g, co) * 0.5) {   // build a management layer: hire a supervisor and hand them ships
    const c = bestCandidate(g, 'supervisor');
    if (c && co.cash > c.sal * 12) { const r = S.hireCandidate(g, co.id, c.id); if (r.ok) { const w = g.workers[r.id]; const free = ships.filter(s => !s.sup || !g.workers[s.sup]).map(s => s.id); S.setTeam(g, co.id, w.id, free); S.why(g, co.id, 'AI leadership', 'Appoint ' + w.name + ' as supervisor over ' + w.team.length + ' ships, because ' + ships.length + ' ships are too many to run directly.'); return; } }
  }
  if (ships.length >= 14 && !mgrs.length && sups.length >= 2) {
    const c = bestCandidate(g, 'manager'); if (c && co.cash > c.sal * 20) { const r = S.hireCandidate(g, co.id, c.id); if (r.ok) S.why(g, co.id, 'AI leadership', 'Appoint ' + g.workers[r.id].name + ' as manager to oversee operations.'); return; }
  }
  if (co.debt > 0 && co.cash > reserveOf(g, co) * 3 + co.debt) S.repay(g, co.id, co.debt);
  if (!growth(g, co, null, true) && co.cash < reserveOf(g, co) * 0.2 && co.debt < 12e6 && L.reserve > 0 && S.payrollPerDay(g, co.id) > 0) { const r = S.borrow(g, co.id, 3e6); if (r.ok) S.why(g, co.id, 'AI leadership', 'Borrow ¢ 3.0 M to cover the cash reserve.'); }
}

// ---------------------------------------------------------------- daily driver
function daily(g) {
  for (const co of g.companies) {
    if (co.dead) continue;
    for (const w of workersOf(g, co.id)) { if (w.role === 'supervisor') superDaily(g, co, w); else if (w.role === 'manager') managerDaily(g, co, w); }
    if (co.ai) execDaily(g, co);
  }
  g.requests = g.requests.filter(r => g.t - r.t < 24 * 30);
}
S.hooks.daily.push(daily);
S.hooks.init.push(g => { for (const co of g.companies) { for (const w of workersOf(g, co.id)) { if (w.role === 'supervisor') superDaily(g, co, w); else if (w.role === 'manager') managerDaily(g, co, w); } if (co.ai) { coverShips(g, co, shipsOf(g, co.id).filter(s => !s.sup), 0.7, 'AI leadership'); staffFacilities(g, co); } } });
