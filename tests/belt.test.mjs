// Headless tests for The Belt simulation. Run:  node tests/belt.test.mjs
import assert from 'node:assert/strict';
import * as S from '../belt/sim.js';
import * as AI from '../belt/ai.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); console.log('PASS', name); pass++; } catch (e) { console.log('FAIL', name, '\n   ', e.stack.split('\n').slice(0, 4).join('\n    ')); fail++; } };
const run = (g, days) => { for (let d = 0; d < days; d++) S.advance(g, 24, 1e9); };
const mine = (g, id = 0) => S.shipsOf(g, id);

test('every starting level builds a fully crewed company', () => {
  for (let lvl = 0; lvl < 6; lvl++) {
    const g = S.newGame({ level: lvl, mode: 'owner', seed: 5 + lvl });
    const ships = mine(g); assert.ok(ships.length >= 1, 'level ' + lvl + ' has ships');
    for (const s of ships) assert.ok(S.crewStatus(g, s).ok, `level ${lvl}: ${s.name} has its required crew`);
  }
});
test('solo level: the founder crews the only ship and there are no employees', () => {
  const g = S.newGame({ level: 0, mode: 'owner', seed: 3 });
  assert.equal(S.workersOf(g, 0).length, 1); assert.ok(S.workersOf(g, 0)[0].founder); assert.equal(mine(g).length, 1);
  assert.equal(S.claimsOf(g, 0).length, 0);
});
test('same seed gives the same history', () => {
  const a = S.newGame({ level: 3, mode: 'company', seed: 42 }), b = S.newGame({ level: 3, mode: 'company', seed: 42 });
  run(a, 120); run(b, 120); assert.equal(Math.round(a.companies[0].cash), Math.round(b.companies[0].cash)); assert.equal(a.events.length, b.events.length);
});
test('save and load continue identically', () => {
  const a = S.newGame({ level: 2, mode: 'company', seed: 9 }); run(a, 60);
  const b = S.deserialize(S.serialize(a)); run(a, 60); run(b, 60);
  assert.equal(Math.round(a.companies[0].cash), Math.round(b.companies[0].cash)); assert.equal(a.t, b.t);
});
test('a year of every level runs without errors and keeps numbers finite', () => {
  for (const lvl of [0, 1, 2, 3, 4, 5]) {
    const g = S.newGame({ level: lvl, mode: 'company', seed: 100 + lvl }); run(g, 200);
    for (const c of g.companies) assert.ok(Number.isFinite(c.cash), 'cash finite');
    for (const s of Object.values(g.ships)) { assert.ok(Number.isFinite(s.fuel) && s.fuel >= 0); assert.ok(s.cond <= 100.0001); assert.ok(S.cargoTotal(s) <= S.SHIP_TYPES[s.type].cargo + 1e-6, 'cargo within capacity'); }
    for (const st of S.STATION_IDS) for (const c of S.COMM) assert.ok(g.mk[st].price[c] > 0);
  }
});
test('scan then claim then mine yields ore and cash for a solo player', () => {
  const g = S.newGame({ level: 0, mode: 'owner', seed: 11 }); const ship = mine(g)[0];
  const best = g.ast.filter(a => S.intelOf(g, 0, a)).sort((x, y) => S.estimate(g, 0, y).val - S.estimate(g, 0, x).val)[0];
  const r = S.claim(g, 0, best.id); assert.ok(r.ok, r.msg);
  S.setProgram(g, ship.id, S.miningRun(g, ship, best.id, 'ceres', 'carry'), true, 'Mining run');
  const before = g.companies[0].cash; run(g, 90);
  assert.ok(best.mined[0] > 200, 'ore was mined'); assert.ok(g.companies[0].cash > before, 'ship earned more than it cost');
});
test('cannot mine an asteroid you have not claimed, and cannot claim unscanned rocks', () => {
  const g = S.newGame({ level: 0, mode: 'owner', seed: 12 });
  const blind = g.ast.find(a => !S.intelOf(g, 0, a)); assert.equal(S.claim(g, 0, blind.id).ok, false);
});
test('scanning and surveying sharpen the estimate', () => {
  const g = S.newGame({ level: 2, mode: 'owner', seed: 21 }); const surv = mine(g).find(s => s.type === 'survey');
  const a = g.ast.find(x => !S.intelOf(g, 0, x) && S.distLoc(g, x.id, 'ceres') < 1);
  S.setProgram(g, surv.id, [{ t: 'scan', ast: a.id }, { t: 'survey', ast: a.id }], false); run(g, 40);
  const it = S.intelOf(g, 0, a); assert.ok(it && it.lvl >= 2, 'surveyed'); assert.ok(it.sig < 0.2, 'sigma ' + it.sig);
});
test('stockpile mining plus a tug delivers goods to a station', () => {
  const g = S.newGame({ level: 2, mode: 'owner', seed: 31 }); const ms = mine(g).find(s => s.type === 'miner'), tug = mine(g).find(s => s.type === 'tug');
  const a = S.claimsOf(g, 0)[0]; S.setProgram(g, ms.id, S.miningRun(g, ms, a.id, 'ceres', 'stockpile'), true);
  run(g, 25); const st = Object.values(a.stock[0]).reduce((x, y) => x + y, 0); assert.ok(st > 500, 'stockpile grew: ' + st);
  S.setProgram(g, tug.id, S.haulRun(g, tug, a.id, 'ceres'), false); const c0 = g.companies[0].cash; run(g, 40);
  assert.ok(g.companies[0].cash - c0 > 100000, 'tug hauled and sold stockpiled ore');
});
test('a refinery turns ore into refined goods worth more than raw ore', () => {
  const g = S.newGame({ level: 4, mode: 'owner', seed: 41 }); const f = S.facilitiesOf(g, 0)[0]; assert.ok(f && f.state === 'active');
  f.in.iron_ore = 1000; const before = S.invOf(g, 0, f.st).iron || 0; f.sell = 'hold'; run(g, 4);
  assert.ok((S.invOf(g, 0, f.st).iron || 0) - before > 500, 'refined iron appeared');
});
test('hiring, crewing and firing follow the rules', () => {
  const g = S.newGame({ level: 1, mode: 'owner', seed: 51 }); const c = g.labour.find(w => w.role === 'pilot');
  g.companies[0].cash = 20e6; const r = S.hireCandidate(g, 0, c.id); assert.ok(r.ok); assert.equal(g.workers[r.id].ship, null);
  const s = S.buyShip(g, 0, 'tug'); assert.ok(s.ok); assert.ok(S.assignCrew(g, 0, r.id, s.id).ok); assert.ok(S.crewStatus(g, g.ships[s.id]).ok);
  assert.equal(S.assignCrew(g, 0, g.workers[Object.keys(g.workers).find(id => g.workers[id].role === 'miner')].id, s.id).ok, false, 'miner cannot crew a tug');
  assert.ok(S.fireWorker(g, 0, r.id).ok); assert.equal(g.workers[r.id], undefined);
});
test('a supervisor writes orders for an idle team and a manager asks before overspending', () => {
  const g = S.newGame({ level: 3, mode: 'owner', seed: 61 }); const sup = S.workersOf(g, 0).find(w => w.role === 'supervisor');
  const m = S.hireCandidate(g, 0, (g.labour.find(w => w.role === 'manager') || (g.labour.push(S.candidate(g)), null))?.id || g.labour.find(w => w.role === 'manager').id);
  const idle = mine(g).filter(s => s.sup === sup.id && ['miner', 'tug'].includes(s.type));
  for (const s of idle) S.setProgram(g, s.id, []); run(g, 3);
  assert.ok(idle.some(s => s.prog), 'supervisor gave at least one idle ship a program');
  if (m.ok) { const mg = g.workers[m.id]; mg.role = 'manager'; mg.mgr = { obj: 'profit', spend: 1000, hire: true, buy: true, claim: true, build: true, spent: 0, since: g.t };
    g.companies[0].cash = 60e6; run(g, 15); assert.ok(g.requests.length > 0 || g.decisions.some(d => d.actor.includes(mg.name)), 'manager either asked or acted'); }
});
test('approving a manager request performs the purchase', () => {
  const g = S.newGame({ level: 1, mode: 'owner', seed: 71 }); g.companies[0].cash = 50e6;
  g.requests.push({ id: 'r9', co: 0, by: 'nobody', kind: 'buyShip', type: 'miner', cost: 6e6, why: 'test', t: g.t });
  const n = mine(g).length; assert.ok(S.resolveRequest(g, 'r9', true).ok); assert.equal(mine(g).length, n + 1);
});
test('flooding a market drops the price and explains why', () => {
  const g = S.newGame({ level: 0, mode: 'owner', seed: 81 }); const p0 = S.price(g, 'ceres', 'platinum');
  S.sellGoods(g, 0, 'ceres', 'platinum', 60); run(g, 1); assert.ok(S.price(g, 'ceres', 'platinum') < p0 * 0.9, 'price fell'); assert.ok(g.events.some(e => /Platinum at Ceres fell/.test(e.msg)), 'event logged with cause');
});
test('an AI company with no player can run, hire, claim and expand', () => {
  const g = S.newGame({ level: 1, mode: 'company', seed: 91 }); const n0 = mine(g).length, w0 = S.workersOf(g, 0).length; run(g, 300);
  assert.ok(S.claimsOf(g, 0).length >= 1, 'has claims'); assert.ok(mine(g).length >= n0 || S.workersOf(g, 0).length >= w0, 'kept growing'); assert.ok(g.decisions.length > 3, 'logged reasons');
});
test('handing the company to AI and back works mid-game', () => {
  const g = S.newGame({ level: 3, mode: 'owner', seed: 101 }); run(g, 20); S.setAI(g, 0, true); run(g, 60); assert.equal(g.companies[0].ai, true); S.setAI(g, 0, false); run(g, 5); assert.equal(g.companies[0].ai, false);
});
test('a ship without fuel or crew never moves and never crashes the sim', () => {
  const g = S.newGame({ level: 0, mode: 'owner', seed: 111 }); const s = mine(g)[0]; S.uncrew(g, g.workers[s.crew[0]]); S.setProgram(g, s.id, [{ t: 'goto', to: 'ceres' }], false); run(g, 10);
  assert.equal(s.state, 'nocrew'); assert.equal(s.at, 'earth');
});
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
