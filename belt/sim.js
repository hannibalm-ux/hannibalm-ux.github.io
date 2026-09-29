// The Belt: simulation core. No DOM and no rendering: the whole game is one plain JSON object `g`.
// Units: time in game hours (g.t), distance in AU, mass in tonnes, money in credits (¢).
// Player actions and AI actions call the same exported functions.
export const HOURS = 24;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- data
export const COMM = ['iron', 'water', 'nickel', 'cobalt', 'platinum'];
export const COMM_NAME = { iron: 'Iron', water: 'Water', nickel: 'Nickel', cobalt: 'Cobalt', platinum: 'Platinum' };
export const BASE_PRICE = { iron: 90, water: 150, nickel: 1100, cobalt: 9000, platinum: 90000 };
const CONS = { iron: 500, water: 350, nickel: 70, cobalt: 9, platinum: 1.2 };
export const ORE_FACTOR = 0.6;      // public processors pay this share of the refined price for raw ore
export const REFINE_YIELD = 0.9;
export const isOre = k => k.endsWith('_ore');
export const baseOf = k => k.replace('_ore', '');
export const keyName = k => (isOre(k) ? (baseOf(k) === 'water' ? 'Water ice' : COMM_NAME[baseOf(k)] + ' ore') : COMM_NAME[k]);

export const STATIONS = {
  earth: { name: 'Terra High Orbital', short: 'Earth', scale: 1.5, fuel: 0.9, mult: { iron: 1.15, water: 1.0, nickel: 1.2, cobalt: 1.25, platinum: 1.2 } },
  moon:  { name: 'Luna Depot', short: 'Moon', scale: 0.6, fuel: 1.0, mult: { iron: 1.1, water: 1.6, nickel: 1.0, cobalt: 1.0, platinum: 1.0 } },
  mars:  { name: 'Ares Orbital', short: 'Mars', scale: 0.9, fuel: 1.05, mult: { iron: 1.2, water: 1.4, nickel: 1.1, cobalt: 1.1, platinum: 1.05 } },
  ceres: { name: 'Ceres Station', short: 'Ceres', scale: 0.7, fuel: 1.25, mult: { iron: 0.85, water: 1.1, nickel: 0.85, cobalt: 0.85, platinum: 0.85 } },
};
export const STATION_IDS = Object.keys(STATIONS);
const FUEL_BASE_PRICE = 300;

const BODY_DEF = {
  earth: { a: 1.0, P: 365.25, ph: 0.6, inc: 0, name: 'Earth' },
  moon:  { parent: 'earth', a: 0.05, P: 27.3, ph: 1.1, name: 'Moon' },   // stylised: real Moon is 0.0026 AU out
  mars:  { a: 1.524, P: 687, ph: 3.7, inc: 0.03, name: 'Mars' },
  ceres: { a: 2.767, P: 1682, ph: 2.2, inc: 0.18, name: 'Ceres' },
};
export const BODY_IDS = ['earth', 'moon', 'mars', 'ceres'];

export const SHIP_TYPES = {
  prospector: { name: 'Prospector', cost: 1.2e6, speed: 0.14, cargo: 400, fuelCap: 80, fuelBase: 1.2, fuelCargo: 0.004, mine: 4, scanR: 0.15, surveyF: 0.8, upkeep: 120,
    crew: { req: [['pilot', 'miner', 'surveyor']], opt: [['miner', 'engineer', 'surveyor'], ['engineer', 'miner', 'surveyor'], ['surveyor', 'engineer', 'miner']] }, blurb: 'All-round starter ship. Flies, scans and mines, slowly.' },
  miner: { name: 'Mining Vessel', cost: 6e6, speed: 0.12, cargo: 1200, fuelCap: 200, fuelBase: 3, fuelCargo: 0.0035, mine: 7, scanR: 0.05, surveyF: 0, upkeep: 450,
    crew: { req: [['pilot'], ['miner']], opt: [['miner'], ['engineer']] }, blurb: 'Heavy extraction. Needs a pilot and a mining operator.' },
  tug: { name: 'Cargo Tug', cost: 4e6, speed: 0.16, cargo: 3000, fuelCap: 400, fuelBase: 4, fuelCargo: 0.002, mine: 0, scanR: 0.02, surveyF: 0, upkeep: 300,
    crew: { req: [['pilot']], opt: [['engineer']] }, blurb: 'Hauls ore from claim stockpiles and goods between stations.' },
  survey: { name: 'Survey Vessel', cost: 3e6, speed: 0.22, cargo: 20, fuelCap: 150, fuelBase: 1.5, fuelCargo: 0.01, mine: 0, scanR: 0.8, surveyF: 1.5, upkeep: 250,
    crew: { req: [['pilot', 'surveyor']], opt: [['surveyor'], ['engineer']] }, blurb: 'Long-range sensors. Scans and surveys asteroids quickly.' },
};
export const SHIP_ORDER = ['prospector', 'survey', 'miner', 'tug'];

export const ROLES = ['pilot', 'miner', 'engineer', 'surveyor', 'supervisor', 'manager'];
export const ROLE_NAME = { pilot: 'Pilot', miner: 'Mining operator', engineer: 'Engineer', surveyor: 'Surveyor', supervisor: 'Supervisor', manager: 'Manager' };

export const LEVELS = [
  { name: 'Solo Prospector', blurb: '1 ship, no employees. You do everything.', ships: { prospector: 1 }, crew: 0, sups: 0, mgrs: 0, cash: 2.4e6, refineries: 0, claims: 0 },
  { name: 'Independent Crew', blurb: '1 ship, a crew of 3. Direct task assignment.', ships: { prospector: 1 }, crew: 3, sups: 0, mgrs: 0, cash: 2.8e6, refineries: 0, claims: 1 },
  { name: 'Established Contractor', blurb: '3 ships, about 10 people, one supervisor.', ships: { miner: 1, tug: 1, survey: 1 }, crew: 1, sups: 1, mgrs: 0, cash: 9e6, refineries: 0, claims: 1 },
  { name: 'Small Mining Company', blurb: '6 ships, 25 people, supervisors.', ships: { miner: 3, tug: 2, survey: 1 }, crew: 1, sups: 2, mgrs: 0, cash: 18e6, refineries: 0, claims: 3 },
  { name: 'Established Corporation', blurb: '16 ships, 60 people, managers and a refinery.', ships: { miner: 8, tug: 5, survey: 3 }, crew: 1, sups: 3, mgrs: 2, cash: 60e6, refineries: 1, claims: 6 },
  { name: 'Industrial Enterprise', blurb: '36 ships, 140 people, managers and two refineries.', ships: { miner: 18, tug: 12, survey: 6 }, crew: 1, sups: 6, mgrs: 4, cash: 200e6, refineries: 2, claims: 12 },
  { name: 'Custom', blurb: 'You choose ships and people.', ships: { prospector: 1 }, crew: 0, sups: 0, mgrs: 0, cash: 3e6, refineries: 0, claims: 0 },
];
export const QUALITY = {
  inexperienced: { name: 'Inexperienced', mu: 40, sd: 8, pot: 30, blurb: 'Cheap, high growth, needs supervision.' },
  professional: { name: 'Professional', mu: 60, sd: 7, pot: 15, blurb: 'Balanced pay and output.' },
  veteran: { name: 'Veteran', mu: 80, sd: 6, pot: 6, blurb: 'Strong and autonomous, but expensive.' },
  mixed: { name: 'Mixed', mu: 58, sd: 16, pot: 18, blurb: 'A natural spread of ability.' },
  random: { name: 'Random', mu: 55, sd: 20, pot: 22, blurb: 'Drawn from the labour market.' },
};
export const DIFFICULTY = {
  relaxed: { name: 'Relaxed', price: 1.15, cost: 0.85, blurb: 'Kinder prices and cheaper operations.' },
  standard: { name: 'Standard', price: 1, cost: 1, blurb: 'The intended economy.' },
  hard: { name: 'Hard Economy', price: 0.88, cost: 1.15, blurb: 'Thin margins, costly fuel and wages.' },
  simulation: { name: 'Simulation', price: 1, cost: 1, blurb: 'Standard economy with market shocks twice as often.' },
};
export const PHILOSOPHY = {
  balanced: { name: 'Balanced', reserve: 90, payback: 500, explore: 1, refine: 1500, haul: 1 },
  growth: { name: 'Growth', reserve: 45, payback: 800, explore: 1, refine: 1200, haul: 1 },
  conservative: { name: 'Conservative', reserve: 180, payback: 350, explore: 0.6, refine: 2500, haul: 1 },
  exploration: { name: 'Exploration', reserve: 90, payback: 550, explore: 2, refine: 2500, haul: 1 },
  industrial: { name: 'Industrial / vertical integration', reserve: 90, payback: 550, explore: 1, refine: 500, haul: 1 },
  trading: { name: 'Trading / logistics', reserve: 90, payback: 550, explore: 0.8, refine: 1500, haul: 2 },
  research: { name: 'Research-led', reserve: 120, payback: 450, explore: 1.6, refine: 2000, haul: 1 },
  random: { name: 'Random / leadership-driven', reserve: 90, payback: 500, explore: 1, refine: 1500, haul: 1 },
};
const RISK = { conservative: { out: 0.9, wear: 0.7, fuel: 0.15 }, balanced: { out: 1, wear: 1, fuel: 0 }, aggressive: { out: 1.15, wear: 1.5, fuel: -0.1 } };
const CO_NAMES = ['Ceres Deep Mining', 'Ares Haulage & Refining', 'Kuiper Heavy Industries', 'Luna Prospecting Guild', 'Helion Metals', 'Pallas Ore Syndicate'];
const CO_COLORS = ['#ffb03a', '#4fd1e8', '#ff6b7f', '#9be564', '#c792ea', '#f5e663', '#7fb2ff'];
const FIRST = 'Marta Dev Maya Tomas Ines Kofi Yuki Aleksei Noor Priya Ravi Chen Sofia Omar Lena Jabari Mira Hugo Ana Idris Freya Kenji Zainab Luca Amara Tariq Elena Bruno Sana Miguel Ilse Nadia Owen Rania Sven Talia Viktor Wren Xavi Zola'.split(' ');
const LAST = 'Okonkwo Rao Chen Alvarez Novak Hollis Tanaka Haddad Petrov Mbeki Larsen Ito Silva Kowalski Osei Fischer Rahman Moreau Duarte Kim Lindqvist Abara Costa Varga Nakamura Reyes Sato Bianchi Ekwueme Hart Ivanova Jensen Khan Lopez Mendes Ng Olsen Park Quinn'.split(' ');

// ---------------------------------------------------------------- utilities
export function rnd(g) { g.rng = (g.rng + 0x6D2B79F5) >>> 0; let t = g.rng; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const ri = (g, a, b) => a + Math.floor(rnd(g) * (b - a + 1));
const pick = (g, arr) => arr[Math.floor(rnd(g) * arr.length)];
const gauss = g => (rnd(g) + rnd(g) + rnd(g) + rnd(g) - 2) * 1.732;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const round = (v, d = 0) => { const m = 10 ** d; return Math.round(v * m) / m; };
export const hooks = { daily: [], init: [] };   // ai.js registers itself here

export function fmtMoney(n) { const a = Math.abs(n); const s = a >= 1e9 ? (a / 1e9).toFixed(2) + ' B' : a >= 1e7 ? (a / 1e6).toFixed(1) + ' M' : Math.round(a).toLocaleString('en-US'); return (n < 0 ? '−¢ ' : '¢ ') + s; }
export function fmtT(n) { return (n >= 1e6 ? (n / 1e6).toFixed(2) + ' Mt' : n >= 1e4 ? (n / 1e3).toFixed(0) + ' kt' : n >= 1000 ? (n / 1e3).toFixed(1) + ' kt' : Math.round(n) + ' t'); }
export function dateOf(t) { const d = new Date(Date.UTC(2238, 0, 1) + t * 3600e3); return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16), year: d.getUTCFullYear() }; }

// ---------------------------------------------------------------- positions
export function posOf(g, id, t = g.t, out = [0, 0, 0]) {
  if (id === 'sun') { out[0] = out[1] = out[2] = 0; return out; }
  if (id.charCodeAt(0) === 97 && id.length > 1 && id !== 'ares') {   // asteroid "a123"
    const a = g.ast[+id.slice(1)]; const ang = a.ph + TAU * t / (HOURS * a.P);
    const x = Math.cos(ang) * a.a, y = Math.sin(ang) * a.a; out[0] = x; out[1] = y * Math.cos(a.inc); out[2] = y * Math.sin(a.inc); return out;
  }
  const b = BODY_DEF[id]; const ang = b.ph + TAU * t / (HOURS * b.P); let x = Math.cos(ang) * b.a, y = Math.sin(ang) * b.a;
  if (b.parent) { const p = posOf(g, b.parent, t, [0, 0, 0]); out[0] = p[0] + x; out[1] = p[1] + y; out[2] = p[2]; return out; }
  out[0] = x; out[1] = y * Math.cos(b.inc); out[2] = y * Math.sin(b.inc); return out;
}
export const distV = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const distLoc = (g, a, b, t = g.t) => distV(posOf(g, a, t), posOf(g, b, t));
export const isStation = id => !!STATIONS[id];
export const locName = (g, id) => !id ? 'deep space' : STATIONS[id] ? STATIONS[id].name : id[0] === 'a' ? g.ast[+id.slice(1)].name : id;

function intercept(g, pos, id, speed) {   // predicted position of a moving target when we arrive
  let tp = posOf(g, id), d = distV(pos, tp);
  for (let k = 0; k < 3; k++) { tp = posOf(g, id, g.t + d / speed * HOURS); d = distV(pos, tp); }
  return tp;
}

// ---------------------------------------------------------------- events and ledger
export function log(g, msg, o = {}) {
  const e = { id: (g.eid = (g.eid || 0) + 1), t: g.t, msg, sev: o.sev || 'info', co: o.co ?? null, ref: o.ref || null, slow: !!o.slow };
  g.events.push(e); if (g.events.length > 500) g.events.shift(); return e;
}
export function why(g, co, actor, text) { g.decisions.push({ t: g.t, co, actor, text }); if (g.decisions.length > 300) g.decisions.shift(); }
export function money(g, co, amt, cat) {   // the only place company cash changes
  co.cash += amt; co.acc[cat] = (co.acc[cat] || 0) + amt;
}
const co$ = (g, id) => g.companies[id];

// ---------------------------------------------------------------- world generation
function genAsteroids(g, n) {
  const centres = [2.32, 2.55, 2.77, 2.77, 3.02, 3.2];
  const list = [];
  for (let i = 0; i < n; i++) {
    const a = clamp(pick(g, centres) + gauss(g) * 0.11, 2.1, 3.4);
    const r = rnd(g); const cls = r < 0.58 ? 'C' : r < 0.9 ? 'S' : 'M';
    const base = { C: { water: 0.35, iron: 0.30, nickel: 0.03, cobalt: 0.002, platinum: 0.00005 }, S: { iron: 0.40, nickel: 0.06, cobalt: 0.004, water: 0.02, platinum: 0.0002 }, M: { iron: 0.55, nickel: 0.18, cobalt: 0.015, water: 0, platinum: 0.003 } }[cls];
    const f = COMM.map(c => Math.max(0, (base[c] || 0) * Math.exp(gauss(g) * 0.35)));
    const res = Math.round((cls === 'M' ? 150e3 : 400e3) * Math.exp(gauss(g) * 0.9));
    const name = String.fromCharCode(65 + ri(g, 0, 25)) + String.fromCharCode(65 + ri(g, 0, 25)) + '-' + ri(g, 100, 999);
    list.push({ id: 'a' + i, name, a, ph: rnd(g) * TAU, P: 365.25 * a ** 1.5, inc: gauss(g) * 0.06, cls, f, res0: res, res, claim: null, stock: {}, mined: {} });
  }
  return list;
}

function mkMarkets(g) {
  g.mk = {};
  for (const id of STATION_IDS) {
    const st = STATIONS[id], m = { stock: {}, target: {}, cons: {}, price: {}, hist: {}, flow: {}, last: {} };
    for (const c of COMM) { m.cons[c] = CONS[c] * st.scale; m.target[c] = m.cons[c] * 30; m.stock[c] = m.target[c]; m.flow[c] = {}; m.hist[c] = []; }
    g.mk[id] = m;
  }
  g.mev = [];
  for (const id of STATION_IDS) for (const c of COMM) { g.mk[id].price[c] = calcPrice(g, id, c); g.mk[id].last[c] = g.mk[id].price[c]; }
}
function calcPrice(g, st, c, stock = null) {
  const m = g.mk[st], S = stock ?? m.stock[c];
  return BASE_PRICE[c] * STATIONS[st].mult[c] * DIFFICULTY[g.settings.difficulty].price * clamp(Math.pow(m.target[c] / Math.max(S, m.target[c] * 0.02), 0.6), 0.35, 2.8);
}
export const price = (g, st, c) => g.mk[st].price[c];
export const orePrice = (g, st, c) => g.mk[st].price[c] * ORE_FACTOR;
export const avgPrice = (g, c) => STATION_IDS.reduce((s, id) => s + g.mk[id].price[c], 0) / STATION_IDS.length;
export const fuelPrice = (g, st) => FUEL_BASE_PRICE * STATIONS[st].fuel * DIFFICULTY[g.settings.difficulty].cost;

// ---------------------------------------------------------------- people
let _wid = 0;
export function newWorker(g, role, o = {}) {
  const Q = QUALITY[o.quality || 'professional'];
  const lead = role === 'supervisor' || role === 'manager';
  const skill = clamp(Math.round(o.skill ?? (Q.mu + gauss(g) * Q.sd + (lead ? 2 : 0))), 25, 96);
  const pot = clamp(Math.round(o.pot ?? (skill + rnd(g) * Q.pot * 2)), skill, 99);
  const w = { id: 'w' + (g.nid++), name: pick(g, FIRST) + ' ' + pick(g, LAST), role, skill, pot, xp: 0, fat: 0, morale: 70, lead: clamp(Math.round(o.lead ?? (35 + rnd(g) * 45 + (lead ? 12 : 0))), 20, 95),
    age: ri(g, 24, 58), co: o.co ?? null, at: o.at || 'earth', ship: null, fac: null, grade: role === 'supervisor' ? 'supervisor' : role === 'manager' ? 'manager' : 'worker',
    team: [], mgr: role === 'manager' ? { obj: 'profit', spend: 3e6, hire: true, buy: true, claim: true, build: false, spent: 0, since: g.t } : null, hired: g.t, hist: [], founder: false };
  w.sal = salaryOf(g, w); return w;
}
export function salaryOf(g, w) {
  const base = 60 + w.skill * 3.4 + (w.pot - w.skill) * 0.6;
  const mult = w.role === 'supervisor' ? 1.5 : w.role === 'manager' ? 2.6 : 1;
  return Math.round(base * mult * DIFFICULTY[g.settings.difficulty].cost);
}
export function candidate(g) {
  const roles = ['pilot', 'pilot', 'miner', 'miner', 'engineer', 'surveyor', 'supervisor', 'manager'];
  const q = pick(g, ['inexperienced', 'professional', 'professional', 'veteran', 'mixed']);
  const w = newWorker(g, pick(g, roles), { quality: g.labourTone > 0.66 ? 'veteran' : g.labourTone < 0.33 ? 'inexperienced' : q });
  return w;
}
export function hist(g, w, txt) { w.hist.push({ t: g.t, txt }); if (w.hist.length > 30) w.hist.shift(); }

// ---------------------------------------------------------------- companies
export function makeCompany(g, o = {}) {
  const id = g.companies.length;
  const co = { id, name: o.name || CO_NAMES[id % CO_NAMES.length], color: o.color || CO_COLORS[id % CO_COLORS.length], cash: 0, debt: 0, ai: !!o.ai, philosophy: o.philosophy || 'balanced',
    lean: null, hq: o.hq || 'earth', policy: { maint: 75, fuelRes: 0.2, risk: 'balanced' }, acc: {}, hist: [], dead: false, born: g.t, negDays: 0, obj: 'profit', sold30: 0 };
  if (co.philosophy === 'random') co.lean = { reserve: ri(g, 40, 200), payback: ri(g, 300, 900), explore: 0.5 + rnd(g) * 1.8, refine: ri(g, 500, 3000), haul: 1 + (rnd(g) > 0.5 ? 1 : 0) };
  g.companies.push(co); g.inv[id] = {}; g.intel[id] = {}; return co;
}
export const lean = co => co.lean || PHILOSOPHY[co.philosophy] || PHILOSOPHY.balanced;

const IDX = new WeakMap();   // per-company lists, rebuilt whenever ships or workers are added, removed or change owner
function idx(g) { let x = IDX.get(g); if (!x) { x = { ships: {}, workers: {} }; for (const s of Object.values(g.ships)) (x.ships[s.co] ||= []).push(s); for (const w of Object.values(g.workers)) (x.workers[w.co] ||= []).push(w); IDX.set(g, x); } return x; }
export const dirty = g => IDX.delete(g);
export const shipsOf = (g, coId) => idx(g).ships[coId] || [];
export const workersOf = (g, coId) => idx(g).workers[coId] || [];
export function facilitiesOf(g, coId) { return Object.values(g.fac).filter(f => f.co === coId); }
export function claimsOf(g, coId) { return g.ast.filter(a => a.claim === coId); }
export const payrollPerDay = (g, coId) => workersOf(g, coId).reduce((s, w) => s + w.sal, 0);

export function addShip(g, co, type, at = null, free = false) {
  const T = SHIP_TYPES[type]; at = at || co.hq;
  const nm = { prospector: ['Wanderer', 'Lodestar', 'Pickaxe', 'Kestrel'], miner: ['Hollis', 'Bedrock', 'Deepcut', 'Ironside', 'Marrow'], tug: ['Haul', 'Drayhorse', 'Ballast', 'Carter'], survey: ['Lantern', 'Farsight', 'Sounder', 'Plumb'] }[type];
  const s = { id: 's' + (g.nid++), type, name: pick(g, nm) + ' ' + ri(g, 2, 99), co: co.id, pos: posOf(g, at).slice(), at, dest: null, stopR: 0, state: 'idle', task: 'Docked', fuel: T.fuelCap, cargo: {}, cond: 100, crew: [], prog: null, inter: [], sp: 0, sup: null, built: g.t, warned: 0, trail: [] };
  g.ships[s.id] = s; dirty(g); if (!free) money(g, co, -T.cost, 'capex'); return s;
}
export function hireWorker(g, co, w, at = null) { w.co = co.id; w.at = at || co.hq; w.hired = g.t; g.workers[w.id] = w; dirty(g); hist(g, w, 'Joined ' + co.name); return w; }

// Found a starting company of a given size. Crews are generated to fit the ships.
export function foundCompany(g, co, level, quality, o = {}) {
  const L = LEVELS[level], custom = o.custom;
  const ships = custom ? custom.ships : L.ships;
  co.cash = custom ? custom.cash : L.cash; co.level = level;
  const mk = (role, extra) => hireWorker(g, co, newWorker(g, role, { quality, ...extra }));
  const S = [];
  for (const [type, n] of Object.entries(ships)) for (let i = 0; i < n; i++) S.push(addShip(g, co, type, null, true));
  const founder = o.founder ? (() => { const w = newWorker(g, 'pilot', { skill: 58, pot: 58, lead: 60, quality }); w.founder = true; w.sal = 0; w.name = o.founderName || 'You'; w.grade = 'founder'; return hireWorker(g, co, w); })() : null;
  let crewTarget = custom ? custom.crew : L.crew;
  for (const s of S) {
    const T = SHIP_TYPES[s.type];
    if (founder && !founder.ship && level < 2 && s === S[0]) { crew(g, s, founder); }
    else for (const slot of T.crew.req) { const w = mk(slot[0]); crew(g, s, w); }
    const nOpt = custom ? (custom.opt ?? 1) : level >= 3 ? 2 : level === 2 ? 1 : (level === 1 && s.type === 'prospector' ? 3 : 0);
    for (let k = 0; k < Math.min(T.crew.opt.length, nOpt); k++) { const w = mk(T.crew.opt[k][0]); crew(g, s, w); }
  }
  co.startClaims = custom ? (custom.claims ?? 1) : L.claims;
  const nRef = custom ? (custom.refineries || 0) : L.refineries;
  for (let i = 0; i < nRef; i++) { const st = ['ceres', 'mars', 'earth'][i]; const f = { id: 'f' + (g.nid++), kind: 'refinery', co: co.id, st, state: 'active', done: g.t, cap: REFINERY.cap, in: {}, sell: 'local', made: 0 };
    g.fac[f.id] = f; for (let k = 0; k < REFINERY.staff; k++) { const w = mk('engineer', { at: st }); w.fac = f.id; w.at = st; } }
  if (custom && crewTarget) for (let k = 0; k < crewTarget; k++) hireWorker(g, co, newWorker(g, pick(g, ['pilot', 'miner', 'engineer', 'surveyor']), { quality }));
  const sups = custom ? custom.sups : L.sups, mgrs = custom ? custom.mgrs : L.mgrs;
  const supList = []; for (let i = 0; i < sups; i++) supList.push(mk('supervisor'));
  const cap = 8; supList.forEach((sv, i) => { sv.team = S.filter((s, j) => j % supList.length === i).map(s => s.id).slice(0, cap); sv.team.forEach(id => g.ships[id].sup = sv.id); });
  for (let i = 0; i < mgrs; i++) { const m = mk('manager'); m.mgr = { obj: ['profit', 'volume', 'explore'][i % 3], spend: 4e6, hire: true, buy: true, claim: true, build: i === 0, spent: 0, since: g.t }; }
  return co;
}
export function crew(g, s, w) { if (w.ship) uncrew(g, w); s.crew.push(w.id); w.ship = s.id; w.at = s.at || w.at; }
export function uncrew(g, w) { const s = g.ships[w.ship]; if (s) s.crew = s.crew.filter(id => id !== w.id); w.ship = null; }

// ---------------------------------------------------------------- crew rules
const rolesOfSlot = slot => slot;
export function crewStatus(g, s) {   // do the aboard workers fill every required slot?
  const T = SHIP_TYPES[s.type], used = new Set(), missing = [];
  const ws = s.crew.map(id => g.workers[id]).filter(Boolean);
  const fits = (w, slot) => w.founder || slot.includes(w.role);
  for (const slot of T.crew.req) { const w = ws.find(x => !used.has(x.id) && fits(x, slot)); if (w) used.add(w.id); else missing.push(slot[0]); }
  return { ok: missing.length === 0, missing, capacity: T.crew.req.length + T.crew.opt.length, used: ws };
}
const eff = w => w ? clamp(1 - Math.max(0, w.fat - 60) / 100, 0.6, 1) * (0.7 + w.morale / 300) : 0;
function crewSkill(g, s, role) {   // best skill aboard for a role, fatigue adjusted; founder covers any role
  let best = 0; for (const id of s.crew) { const w = g.workers[id]; if (!w) continue; if (w.role === role || w.founder) best = Math.max(best, w.skill * eff(w)); else if (s.type === 'prospector') best = Math.max(best, w.skill * eff(w) * 0.8); } return best;
}
function minersAboard(g, s) {   // on a prospector any crew member can run the drill, less well
  const ws = s.crew.map(id => g.workers[id]).filter(Boolean); const m = ws.filter(w => w.role === 'miner' || w.founder);
  return (m.length || s.type !== 'prospector' ? m : ws.map(w => ({ ...w, skill: w.skill * 0.8 }))).sort((a, b) => b.skill - a.skill);
}
export function mineRate(g, s) {
  const T = SHIP_TYPES[s.type], co = co$(g, s.co), R = RISK[co.policy.risk], W = [1, 0.7, 0.5];
  const ms = minersAboard(g, s); let r = 0; ms.forEach((w, i) => { r += (W[i] || 0.4) * (0.5 + 0.7 * w.skill / 100) * eff(w); });
  return T.mine * r * R.out * (0.6 + 0.4 * s.cond / 100);
}
export const cargoTotal = s => Object.values(s.cargo).reduce((a, b) => a + b, 0);
export const fuelPerAU = (s, cargo = cargoTotal(s)) => SHIP_TYPES[s.type].fuelBase + SHIP_TYPES[s.type].fuelCargo * cargo;
export function shipSpeed(g, s) { const p = crewSkill(g, s, 'pilot') || 40; return SHIP_TYPES[s.type].speed * (0.9 + 0.2 * p / 100); }
export const shipRange = (g, s) => s.fuel / (fuelPerAU(s) * (1.1 - 0.2 * (crewSkill(g, s, 'pilot') || 40) / 100));

// ---------------------------------------------------------------- intelligence (scan / survey / drill)
export const intelOf = (g, coId, a) => g.intel[coId][a.id] || null;
const LVL_SIG = [1, 0.4, 0.12, 0.04];
export function learn(g, coId, a, lvl, sigma) {
  let it = g.intel[coId][a.id];
  if (!it) it = g.intel[coId][a.id] = { lvl: 0, sig: 1, n: [...COMM, 'res'].map(() => gauss(g)) };
  if (lvl > it.lvl) it.lvl = lvl; if (sigma < it.sig) it.sig = sigma;
  return it;
}
export function estimate(g, coId, a) {   // what this company believes about the asteroid
  const it = intelOf(g, coId, a); if (!it || it.lvl < 1) return null;
  const f = a.f.map((v, i) => v * Math.exp(it.n[i] * it.sig)), sum = f.reduce((x, y) => x + y, 0) || 1;
  const share = f.map(v => v / sum); const res = a.res * Math.exp(it.n[5] * it.sig * 1.3);
  const val = share.reduce((s, v, i) => s + v * avgPrice(g, COMM[i]), 0);
  return { lvl: it.lvl, sig: it.sig, share, res, val, cls: a.cls, worth: val * res * ORE_FACTOR };
}
export const trueShare = a => { const s = a.f.reduce((x, y) => x + y, 0) || 1; return a.f.map(v => v / s); };
const MINE_TRUTH = a => trueShare(a);

// ---------------------------------------------------------------- claims, facilities, orders (player and AI share these)
export function claimFee(g, a) { return Math.round((25000 + a.res0 * 0.1) * DIFFICULTY[g.settings.difficulty].cost / 1000) * 1000; }
export function claim(g, coId, astId) {
  const co = co$(g, coId), a = g.ast[+astId.slice(1)]; const it = intelOf(g, coId, a), fee = claimFee(g, a);
  if (a.claim !== null) return { ok: false, msg: a.name + ' is already claimed.' };
  if (!it || it.lvl < 1) return { ok: false, msg: 'Scan ' + a.name + ' before claiming it.' };
  if (co.cash < fee) return { ok: false, msg: 'Claim fee is ' + fmtMoney(fee) + '.' };
  money(g, co, -fee, 'claims'); a.claim = coId; a.stock[coId] = {};
  log(g, co.name + ' claimed ' + a.name + '.', { co: coId, ref: astId, sev: coId === g.view ? 'good' : 'info' });
  return { ok: true, msg: 'Claimed ' + a.name + ' for ' + fmtMoney(fee) + '.' };
}
export function abandonClaim(g, coId, astId) { const a = g.ast[+astId.slice(1)]; if (a.claim !== coId) return { ok: false, msg: 'Not your claim.' }; a.claim = null; a.stock[coId] = {}; return { ok: true, msg: 'Claim released.' }; }

export const REFINERY = { cost: 12e6, days: 45, cap: 600, staff: 3, opex: 30 };
export function buildRefinery(g, coId, st) {
  const co = co$(g, coId);
  if (!STATIONS[st]) return { ok: false, msg: 'Pick a station.' };
  if (Object.values(g.fac).some(f => f.co === coId && f.st === st)) return { ok: false, msg: 'You already have a facility there.' };
  const cost = REFINERY.cost * DIFFICULTY[g.settings.difficulty].cost; if (co.cash < cost) return { ok: false, msg: 'A refinery costs ' + fmtMoney(cost) + '.' };
  money(g, co, -cost, 'capex');
  const f = { id: 'f' + (g.nid++), kind: 'refinery', co: coId, st, state: 'construction', done: g.t + REFINERY.days * HOURS, cap: REFINERY.cap, in: {}, sell: 'local', made: 0 };
  g.fac[f.id] = f; log(g, co.name + ' began building a refinery at ' + STATIONS[st].short + '.', { co: coId, ref: st });
  return { ok: true, msg: 'Refinery under construction, ready in ' + REFINERY.days + ' days.', id: f.id };
}
export function refineryAt(g, coId, st) { return Object.values(g.fac).find(f => f.co === coId && f.st === st && f.state === 'active') || null; }
export function facStaffFactor(g, f) {
  const ws = Object.values(g.workers).filter(w => w.fac === f.id); if (!ws.length) return 0.15;
  const avg = ws.reduce((s, w) => s + w.skill * eff(w), 0) / ws.length; return Math.min(1, ws.length / REFINERY.staff) * (0.6 + 0.4 * avg / 100);
}

export const STEP_NAME = { goto: 'Travel to', mine: 'Mine', scan: 'Scan', survey: 'Survey', unload: 'Unload and sell', load: 'Load cargo', refuel: 'Refuel', repair: 'Repair', wait: 'Wait' };
export function describeStep(g, st) {
  const L = id => locName(g, id);
  switch (st.t) {
    case 'goto': return 'Travel to ' + L(st.to);
    case 'mine': return 'Mine ' + L(st.ast) + (st.mode === 'stockpile' ? ' into stockpile' : ' until cargo ≥ ' + Math.round((st.until ?? 0.9) * 100) + '%');
    case 'scan': return 'Scan ' + L(st.ast);
    case 'survey': return 'Survey ' + L(st.ast);
    case 'unload': return st.store ? 'Unload to warehouse' : 'Unload and sell';
    case 'load': return 'Load from ' + (isStation(st.loc) ? L(st.loc) + ' warehouse' : L(st.loc) + ' stockpile');
    case 'refuel': return 'Refuel if below ' + Math.round(st.below * 100) + '%';
    case 'repair': return 'Repair if below ' + st.below + '%';
    case 'wait': return 'Wait ' + st.days + ' days';
  } return st.t;
}
export function setProgram(g, sid, steps, repeat = true, label = '', quiet = false) {
  const s = g.ships[sid]; s.prog = steps.length ? { steps, i: 0, repeat, label, quiet } : null; s.inter = []; s.sp = 0;
  if (s.state === 'travel' && steps[0]?.t !== 'goto') { /* keep flying to the previous target, then continue */ }
  return { ok: true };
}
export function miningRun(g, s, astId, sink, mode = 'carry', pol) {   // the standing order from the design document
  const co = co$(g, s.co);
  return [{ t: 'goto', to: astId }, { t: 'mine', ast: astId, until: 0.95, mode }, ...(mode === 'stockpile' ? [] : [{ t: 'goto', to: sink }, { t: 'unload' }, { t: 'refuel', below: 0.5 }, { t: 'repair', below: 80 }])];
}
export function haulRun(g, s, fromLoc, sink) { return [{ t: 'goto', to: fromLoc }, { t: 'load', loc: fromLoc }, { t: 'goto', to: sink }, { t: 'unload' }, { t: 'refuel', below: 0.5 }, { t: 'repair', below: 80 }]; }

// ---------------------------------------------------------------- selling
function attribute(g, st, c, who, amt) { const f = g.mk[st].flow[c]; f[who] = (f[who] || 0) + amt; }
export function sellGoods(g, coId, st, k, qty) {   // returns revenue; moves price along the curve
  if (qty <= 0) return 0;
  const co = co$(g, coId), m = g.mk[st], c = baseOf(k), ore = isOre(k), eq = ore ? qty * REFINE_YIELD * 0.6 : qty;
  const p0 = calcPrice(g, st, c), p1 = calcPrice(g, st, c, m.stock[c] + eq), avg = (p0 + p1) / 2 * (ore ? ORE_FACTOR : 1);
  m.stock[c] += eq; attribute(g, st, c, co.name, eq);
  const rev = avg * qty; money(g, co, rev, 'sales'); co.sold30 += qty; (co.sink ||= {})[st] = (co.sink[st] || 0) * 0.999 + qty; return rev;
}
export function invAdd(g, coId, st, k, t) { const i = (g.inv[coId][st] ||= {}); i[k] = (i[k] || 0) + t; if (i[k] < 1e-6) delete i[k]; }
export const invOf = (g, coId, st) => g.inv[coId][st] || {};
function checkContracts(g, coId, st) {
  for (const c of g.contracts) if (c.taker === coId && !c.done && c.st === st) {
    const have = invOf(g, coId, st)[c.c] || 0;
    if (have >= c.qty) { invAdd(g, coId, st, c.c, -c.qty); const co = co$(g, coId); money(g, co, c.qty * c.price, 'sales'); c.done = true;
      log(g, co.name + ' delivered ' + c.qty + ' t of ' + COMM_NAME[c.c] + ' to ' + STATIONS[st].short + ' and earned ' + fmtMoney(c.qty * c.price) + '.', { co: coId, sev: coId === g.view ? 'good' : 'info' }); }
  }
}
export function acceptContract(g, coId, id) { const c = g.contracts.find(x => x.id === id); if (!c || c.taker !== null) return { ok: false, msg: 'Contract no longer available.' }; c.taker = coId; c.until = g.t + c.days * HOURS; return { ok: true, msg: 'Contract accepted.' }; }

// ---------------------------------------------------------------- ships: per-hour behaviour
function wear(g, s, dt, k = 1) {
  const co = co$(g, s.co), eng = crewSkill(g, s, 'engineer');
  s.cond -= 0.012 * dt * k * RISK[co.policy.risk].wear * (1 - 0.5 * eng / 100);
  if (eng) s.cond = Math.min(100, s.cond + 0.006 * dt * eng / 50);
  if (s.cond < 30 && rnd(g) < 0.004 * (30 - s.cond) / 30 * dt) {
    s.state = 'broken'; s.task = 'Broken down'; s.sp = 0; s.rescue = g.t + 96;
    log(g, s.name + ' suffered a critical failure' + (s.at ? ' at ' + locName(g, s.at) : ' in deep space') + '.', { co: s.co, ref: s.id, sev: 'bad', slow: true });
  }
}
function moveShip(g, s, dt) {   // one travel tick, pursuit with intercept prediction
  const spd = shipSpeed(g, s), T = SHIP_TYPES[s.type];
  const tp = intercept(g, s.pos, s.dest, spd), d = distV(s.pos, tp), step = spd * dt / HOURS;
  const perAU = fuelPerAU(s) * (1.1 - 0.2 * (crewSkill(g, s, 'pilot') || 40) / 100);
  const stop = Math.max(step, s.stopR || 0.0015);
  if (d <= stop) { const move = Math.max(0, d - (s.stopR || 0)); s.fuel -= move * perAU;
    s.pos = s.stopR ? s.pos : tp.slice(); if (!s.stopR) s.at = s.dest; s.dest = null; s.stopR = 0; s.state = 'idle'; s.task = s.at ? 'At ' + locName(g, s.at) : 'Holding'; return true; }
  const f = step / d; s.pos[0] += (tp[0] - s.pos[0]) * f; s.pos[1] += (tp[1] - s.pos[1]) * f; s.pos[2] += (tp[2] - s.pos[2]) * f;
  s.fuel -= step * perAU; s.trail.push(s.pos[0], s.pos[1], s.pos[2]); if (s.trail.length > 90) s.trail.splice(0, 3);
  if (s.fuel <= 0) { s.fuel = 0; s.state = 'stranded'; s.task = 'Out of fuel'; s.dest = null; s.at = null; log(g, s.name + ' ran out of fuel in deep space.', { co: s.co, ref: s.id, sev: 'bad', slow: true }); return true; }
  return false;
}
function nearestStation(g, pos, exclude = null) { let best = null, bd = 1e9; for (const id of STATION_IDS) { if (id === exclude) continue; const d = distV(pos, posOf(g, id)); if (d < bd) { bd = d; best = id; } } return best; }
export const nearestStationTo = nearestStation;

function beginTravel(g, s, to, stopR = 0) {   // 'go' | 'again' (inserted a refuel detour) | 'no' (cannot reach)
  const co = co$(g, s.co), T = SHIP_TYPES[s.type];
  const dp = posOf(g, to), d = distV(s.pos, dp), perAU = fuelPerAU(s) * 1.15, need = d * perAU;
  const reserve = Math.max(0.08, co.policy.fuelRes + RISK[co.policy.risk].fuel) * T.fuelCap;
  const dockedHere = s.at && isStation(s.at);
  if (s.fuel - need < reserve && !s.inter.length) {   // not enough fuel for this leg plus the reserve: refuel first
    if (dockedHere && s.fuel < T.fuelCap * 0.98) { s.inter.unshift({ t: 'refuel', below: 1, auto: true }); return 'again'; }
    if (!dockedHere) {
      const stns = STATION_IDS.map(id => ({ id, d: distV(s.pos, posOf(g, id)) })).sort((a, b) => a.d - b.d);
      const st = stns.find(x => x.d * perAU < s.fuel);
      if (st && st.id !== to) { s.inter.unshift({ t: 'goto', to: st.id, auto: true }, { t: 'refuel', below: 1, auto: true }); return 'again'; }
    }
  }
  if (need > s.fuel) return 'no';
  s.dest = to; s.stopR = stopR; s.at = null; s.state = 'travel'; s.task = 'To ' + locName(g, to); return 'go';
}

function tickShip(g, s, dt) {
  const T = SHIP_TYPES[s.type], co = co$(g, s.co);
  if (s.at) { const p = posOf(g, s.at); s.pos[0] = p[0]; s.pos[1] = p[1]; s.pos[2] = p[2]; for (const id of s.crew) { const w = g.workers[id]; if (w) w.at = s.at; } }
  // crew fatigue and skills
  const working = s.state === 'mining' || s.state === 'travel' || s.state === 'surveying' || s.state === 'scanning';
  for (const id of s.crew) { const w = g.workers[id]; if (!w) continue; w.fat = clamp(w.fat + (working ? 0.045 : -0.3) * dt, 0, 100); if (working && w.role !== 'supervisor') w.xp += dt; }
  if (s.state === 'stranded') { if (s.rescue && g.t >= s.rescue) { s.fuel = T.fuelCap * 0.3; s.state = 'idle'; s.rescue = 0; log(g, 'Rescue tanker refuelled ' + s.name + '.', { co: s.co, ref: s.id }); } return; }
  if (s.state === 'broken') {
    const eng = crewSkill(g, s, 'engineer');
    if (eng) { s.cond += 0.4 * eng / 50 * dt; if (s.cond > 40) { s.state = 'idle'; s.task = 'Repaired'; log(g, s.name + '\'s engineer restored the ship.', { co: s.co, ref: s.id, sev: 'good' }); } }
    else if (g.t >= s.rescue) { const fee = 60000 * DIFFICULTY[g.settings.difficulty].cost; money(g, co, -fee, 'repair'); s.cond = 45; s.state = 'idle'; log(g, 'Rescue crew repaired ' + s.name + ' for ' + fmtMoney(fee) + '.', { co: s.co, ref: s.id }); }
    return;
  }
  const cs = crewStatus(g, s);
  if (!cs.ok) { if (s.state !== 'nocrew') { s.state = 'nocrew'; s.task = 'Needs ' + cs.missing.join(', '); } return; }
  if (s.state === 'nocrew') { s.state = s.dest ? 'travel' : 'idle'; s.task = 'Crew ready'; }
  if (s.state === 'travel') { if (s.dest) { moveShip(g, s, dt); wear(g, s, dt, 0.2); } if (s.state === 'travel') return; }
  runProgram(g, s, dt);
}

function runProgram(g, s, dt) {
  for (let guard = 0; guard < 8; guard++) {
    let step = s.inter.length ? s.inter[0] : s.prog && s.prog.steps[s.prog.i];
    if (!step) { if (s.state !== 'idle') { s.state = 'idle'; } s.task = s.at ? 'Idle at ' + locName(g, s.at) : 'Holding'; return; }
    const r = runStep(g, s, step, dt);
    if (r === 'done') {
      s.sp = 0;
      if (s.inter.length) s.inter.shift();
      else { const p = s.prog; p.i++; if (p.i >= p.steps.length) { if (p.repeat) { p.i = 0; p.cycles = (p.cycles || 0) + 1; } else { s.prog = null; s.state = 'idle'; s.task = 'Program complete'; if (!p.quiet) log(g, s.name + ' finished its orders and is idle.', { co: s.co, ref: s.id }); return; } } }
      continue;
    }
    if (r === 'skip') { s.sp = 0; if (s.inter.length) s.inter.shift(); else if (s.prog) { s.prog.i = (s.prog.i + 1) % s.prog.steps.length; if (s.prog.i === 0 && !s.prog.repeat) s.prog = null; } s.state = 'idle'; return; }
    return;   // step is consuming time
  }
}

function runStep(g, s, st, dt) {
  const T = SHIP_TYPES[s.type], co = co$(g, s.co);
  switch (st.t) {
    case 'goto': {
      if (s.at === st.to) return 'done';
      if (s.state === 'travel') return 'busy';
      const r = beginTravel(g, s, st.to);
      if (r === 'go') return 'busy'; if (r === 'again') return 'again';
      if (g.t - s.warned > 24 * 20) { s.warned = g.t; log(g, s.name + ' cannot reach ' + locName(g, st.to) + ' on its fuel.', { co: s.co, ref: s.id, sev: 'warn' }); }
      s.inter = []; return 'skip';
    }
    case 'mine': {
      const a = g.ast[+st.ast.slice(1)];
      if (s.at !== st.ast) { s.inter.unshift({ t: 'goto', to: st.ast, auto: true }); return 'again'; }
      if (a.claim !== s.co) { if (g.t - s.warned > 24 * 30) { s.warned = g.t; log(g, s.name + ' cannot mine ' + a.name + ': no claim.', { co: s.co, ref: s.id, sev: 'warn' }); } if (s.prog) s.prog.stale = true; return 'skip'; }
      if (a.res < 1) { log(g, a.name + ' is depleted. ' + s.name + ' needs new orders.', { co: s.co, ref: s.id, sev: 'warn' }); s.prog = null; s.state = 'idle'; return 'busy'; }
      if (st.mode === 'stockpile' && s.cond < 50 && !s.inter.length) { s.inter.push({ t: 'goto', to: nearestStation(g, s.pos), auto: true }, { t: 'repair', below: 100, auto: true }, { t: 'goto', to: st.ast, auto: true }); return 'again'; }   // stockpile miners never dock, so send them for repairs
      const cap = T.cargo - cargoTotal(s);
      if (st.mode === 'stockpile' && cap < T.cargo * 0.02) {   // hold full: hand over to the claim stockpile
        const stk = (a.stock[s.co] ||= {}), tot = Object.values(stk).reduce((x, y) => x + y, 0);
        if (tot + T.cargo > 6000) { s.state = 'waiting'; s.task = 'Stockpile full'; s.sp += dt; if (s.sp > 72 && s.prog) s.prog.stale = true; return 'busy'; }
        for (const [k, v] of Object.entries(s.cargo)) stk[k] = (stk[k] || 0) + v; s.cargo = {};
      }
      const full = st.mode === 'stockpile' ? false : cargoTotal(s) >= T.cargo * (st.until ?? 0.95) - 0.5;
      if (full) return 'done';
      const amt = Math.min(mineRate(g, s) * dt, T.cargo - cargoTotal(s), a.res);
      if (amt <= 0) { s.state = 'idle'; s.task = 'No mining crew'; return 'busy'; }
      const sh = MINE_TRUTH(a); COMM.forEach((c, i) => { const q = amt * sh[i]; if (q > 0) s.cargo[c + '_ore'] = (s.cargo[c + '_ore'] || 0) + q; });
      a.res -= amt; a.mined[s.co] = (a.mined[s.co] || 0) + amt;
      const it = intelOf(g, s.co, a); if (it) { it.sig = Math.max(0.03, Math.min(it.sig, 0.12) * (1 - amt / 40000)); it.lvl = Math.max(it.lvl, 3); }
      s.state = 'mining'; s.task = 'Mining ' + a.name; wear(g, s, dt); return 'busy';
    }
    case 'scan': case 'survey': {
      const a = g.ast[+st.ast.slice(1)], scan = st.t === 'scan';
      if (T.surveyF === 0) return 'skip';
      const d = distV(s.pos, posOf(g, st.ast));
      if (scan ? d > T.scanR : s.at !== st.ast) {
        if (s.state === 'travel') return 'busy';
        const r = beginTravel(g, s, st.ast, scan ? T.scanR * 0.7 : 0); return r === 'go' ? 'busy' : r === 'again' ? 'again' : 'skip';
      }
      const it = intelOf(g, s.co, a);
      if (scan && it && it.lvl >= 1) return 'done'; if (!scan && it && it.lvl >= 2) return 'done';
      const sk = Math.max(crewSkill(g, s, 'surveyor'), 30), hours = (scan ? 10 : 60) / (T.surveyF || 0.5) / (0.6 + sk / 100);
      s.sp += dt; s.state = scan ? 'scanning' : 'surveying'; s.task = (scan ? 'Scanning ' : 'Surveying ') + a.name; wear(g, s, dt, 0.3);
      if (s.sp >= hours) { learn(g, s.co, a, scan ? 1 : 2, scan ? LVL_SIG[1] : LVL_SIG[2] - 0.08 * sk / 100);
        const e = estimate(g, s.co, a); log(g, s.name + (scan ? ' scanned ' : ' surveyed ') + a.name + ': class ' + a.cls + ', about ' + fmtT(e.res) + ' of ore.', { co: s.co, ref: a.id, sev: s.co === g.view ? 'good' : 'info' }); return 'done'; }
      return 'busy';
    }
    case 'unload': {
      const stn = s.at; if (!stn || !isStation(stn)) { s.inter.unshift({ t: 'goto', to: nearestStation(g, s.pos), auto: true }); return 'again'; }
      const rf = refineryAt(g, s.co, stn); let rev = 0;
      for (const [k, v] of Object.entries(s.cargo)) {
        if (isOre(k) && rf) rf.in[k] = (rf.in[k] || 0) + v;
        else if (st.store && !isOre(k)) invAdd(g, s.co, stn, k, v);
        else rev += sellGoods(g, s.co, stn, k, v);
      }
      s.cargo = {}; checkContracts(g, s.co, stn);
      if (rev > 0 && s.co === g.view && rev > 1e5) log(g, s.name + ' sold cargo at ' + STATIONS[stn].short + ' for ' + fmtMoney(rev) + '.', { co: s.co, ref: s.id, sev: 'good' });
      s.state = 'idle'; return 'done';
    }
    case 'load': {
      const loc = st.loc, cap = T.cargo - cargoTotal(s);
      if (s.at !== loc) { s.inter.unshift({ t: 'goto', to: loc, auto: true }); return 'again'; }
      const pool = isStation(loc) ? (g.inv[s.co][loc] ||= {}) : (g.ast[+loc.slice(1)].stock[s.co] ||= {});
      let take = Math.min(cap, 500 * dt), moved = 0;
      for (const k of Object.keys(pool)) { const q = Math.min(pool[k], take); if (q > 0) { s.cargo[k] = (s.cargo[k] || 0) + q; pool[k] -= q; take -= q; moved += q; if (pool[k] < 1e-6) delete pool[k]; } }
      s.state = 'loading'; s.task = 'Loading at ' + locName(g, loc); s.sp += dt;
      if (cargoTotal(s) >= T.cargo * 0.98 || (moved === 0 && cargoTotal(s) > 0) || s.sp > 60) return 'done';
      if (moved === 0 && s.sp > 24) return 'done';
      return 'busy';
    }
    case 'refuel': {
      if (s.fuel / T.fuelCap >= st.below) return 'done';
      if (!s.at || !isStation(s.at)) { s.inter.unshift({ t: 'goto', to: nearestStation(g, s.pos), auto: true }); return 'again'; }
      const need = T.fuelCap - s.fuel, p = fuelPrice(g, s.at), q = Math.min(need, 60 * dt);
      s.fuel += q; money(g, co, -q * p, 'fuel'); s.state = 'refuel'; s.task = 'Refuelling at ' + STATIONS[s.at].short; return s.fuel >= T.fuelCap - 0.01 ? 'done' : 'busy';
    }
    case 'repair': {
      if (s.cond >= st.below) return 'done';
      if (!s.at || !isStation(s.at)) { s.inter.unshift({ t: 'goto', to: nearestStation(g, s.pos), auto: true }); return 'again'; }
      const per = T.cost * 0.0004 * DIFFICULTY[g.settings.difficulty].cost, pts = Math.min(100 - s.cond, 5 * dt);
      s.cond += pts; money(g, co, -pts * per, 'repair'); s.state = 'repair'; s.task = 'Repairing at ' + STATIONS[s.at].short; return s.cond >= 99.5 ? 'done' : 'busy';
    }
    case 'wait': { s.sp += dt; s.state = 'waiting'; s.task = 'Waiting'; return s.sp >= st.days * HOURS ? 'done' : 'busy'; }
  }
  return 'done';
}

// ---------------------------------------------------------------- facilities
function tickFacilities(g, dt) {
  for (const f of Object.values(g.fac)) {
    if (f.state === 'construction') { if (g.t >= f.done) { f.state = 'active'; log(g, co$(g, f.co).name + '\'s refinery at ' + STATIONS[f.st].short + ' is online.', { co: f.co, ref: f.st, sev: f.co === g.view ? 'good' : 'info', slow: f.co === g.view }); } continue; }
    const sf = f.sf ?? (f.sf = facStaffFactor(g, f)); let cap = f.cap / HOURS * dt * sf;
    for (const k of Object.keys(f.in)) {
      if (cap <= 0) break; const q = Math.min(f.in[k], cap); if (q <= 0) continue;
      f.in[k] -= q; cap -= q; if (f.in[k] < 1e-6) delete f.in[k];
      const out = q * REFINE_YIELD; invAdd(g, f.co, f.st, baseOf(k), out); f.made += out; money(g, co$(g, f.co), -q * REFINERY.opex * DIFFICULTY[g.settings.difficulty].cost, 'other');
    }
  }
}

// ---------------------------------------------------------------- markets and daily economy
function marketDay(g) {
  const day = Math.floor(g.t / HOURS);
  for (const id of STATION_IDS) {
    const m = g.mk[id];
    for (const c of COMM) {
      let cons = m.cons[c], prod = m.cons[c];
      for (const e of g.mev) if (e.st === id && (e.c === c || e.c === null) && g.t < e.until) { cons *= e.cons; prod *= e.prod; }
      const net = prod - cons; m.stock[c] = Math.max(0, m.stock[c] + net + (m.target[c] - m.stock[c]) * 0.03);
      if (Math.abs(net) > m.cons[c] * 0.05) for (const e of g.mev) if (e.st === id && (e.c === c || e.c === null) && g.t < e.until) attribute(g, id, c, e.label, net);
      for (const k of Object.keys(m.flow[c])) { m.flow[c][k] *= 0.9; if (Math.abs(m.flow[c][k]) < m.cons[c] * 0.02) delete m.flow[c][k]; }
      const p = calcPrice(g, id, c); m.price[c] = p; m.hist[c].push(Math.round(p)); if (m.hist[c].length > 120) m.hist[c].shift();
      const ref = m.last[c];
      if (Math.abs(p / ref - 1) > 0.08) {   // announce price moves together with what caused them
        const up = p > ref, minT = Math.max(1, m.target[c] * 0.01), causes = Object.entries(m.flow[c]).filter(([, v]) => (up ? v < 0 : v > 0) && Math.abs(v) >= minT).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 2).map(([k, v]) => k + (v > 0 ? ' supplied ' : ' drew down ') + (Math.abs(v) < 10 ? Math.abs(v).toFixed(1) : Math.round(Math.abs(v))) + ' t');
        const own = g.view != null && Object.keys(m.flow[c]).includes(g.companies[g.view]?.name);
        log(g, COMM_NAME[c] + ' at ' + STATIONS[id].short + (up ? ' rose ' : ' fell ') + Math.abs(Math.round((p / ref - 1) * 100)) + '%' + (causes.length ? ' after ' + causes.join(' and ') : '') + '.', { sev: up ? 'good' : 'warn', ref: id, slow: own && Math.abs(p / ref - 1) > 0.15 && (c === 'platinum' || c === 'cobalt') });
        m.last[c] = p;
      }
    }
  }
  g.mev = g.mev.filter(e => g.t < e.until + 24 * 5);
  if (rnd(g) < 0.05 * (g.settings.difficulty === 'simulation' ? 2 : 1)) marketEvent(g);
  // contracts
  g.contracts = g.contracts.filter(c => !(c.taker === null && g.t > c.expires) && !((c.done || c.failed) && g.t > c.expires + 240));
  for (const c of g.contracts) if (c.taker !== null && !c.done && !c.failed && g.t > c.until) { c.failed = true; const co = co$(g, c.taker), pen = Math.round(c.qty * c.price * 0.15); money(g, co, -pen, 'other'); log(g, co.name + ' missed a contract for ' + c.qty + ' t of ' + COMM_NAME[c.c] + ' and paid ' + fmtMoney(pen) + '.', { co: c.taker, sev: 'bad' }); }
  if (g.contracts.filter(c => c.taker === null).length < 4 && rnd(g) < 0.12) newContract(g);
}
function marketEvent(g) {
  const st = pick(g, STATION_IDS), c = pick(g, COMM), S = STATIONS[st].short, N = COMM_NAME[c], r = rnd(g);
  const days = ri(g, 40, 120);
  const e = r < 0.4 ? { cons: 1.6, prod: 1, label: 'a demand boom for ' + N.toLowerCase() + ' at ' + S, text: 'Demand for ' + N.toLowerCase() + ' is booming at ' + S + '.' }
    : r < 0.75 ? { cons: 1, prod: 0.55, label: 'a supply disruption for ' + N.toLowerCase() + ' at ' + S, text: 'A strike cut local ' + N.toLowerCase() + ' supply at ' + S + '.' }
    : { cons: 1, prod: 2.2, label: 'a new deposit online for ' + N.toLowerCase() + ' at ' + S, text: 'A large new deposit is flooding ' + S + ' with ' + N.toLowerCase() + '.' };
  g.mev.push({ st, c, until: g.t + days * HOURS, ...e }); log(g, e.text, { ref: st, sev: e.cons > 1 ? 'good' : e.prod < 1 ? 'warn' : 'bad' });
}
function newContract(g) {
  const st = pick(g, STATION_IDS), c = pick(g, COMM), S = STATIONS[st];
  const qty = Math.round(CONS[c] * S.scale * pick(g, [4, 6, 10]) / 5) * 5 || 5;
  g.contracts.push({ id: 'c' + (g.nid++), st, c, qty: Math.max(qty, c === 'platinum' ? 2 : 5), price: Math.round(g.mk[st].price[c] * 1.25), days: ri(g, 60, 120), expires: g.t + 40 * HOURS, taker: null, done: false });
}

function dayEnd(g) {
  const day = Math.floor(g.t / HOURS);
  marketDay(g);
  for (const co of g.companies) {
    if (co.dead) continue;
    // payroll and upkeep
    let pay = 0; for (const w of Object.values(g.workers)) if (w.co === co.id) pay += w.sal;
    let up = 0; for (const s of Object.values(g.ships)) if (s.co === co.id) up += SHIP_TYPES[s.type].upkeep * DIFFICULTY[g.settings.difficulty].cost;
    money(g, co, -pay, 'payroll'); money(g, co, -up, 'upkeep');
    if (co.debt > 0) { const i = co.debt * 0.09 / 365; money(g, co, -i, 'interest'); }
    // refinery output policy
    for (const f of Object.values(g.fac)) if (f.co === co.id && f.state === 'active' && f.sell === 'local') { const inv = g.inv[co.id][f.st] || {}; for (const c of COMM) { const q = inv[c] || 0; if (q > 0) { invAdd(g, co.id, f.st, c, -q); sellGoods(g, co.id, f.st, c, q); } } }
    for (const st of STATION_IDS) checkContracts(g, co.id, st);
    co.sold30 *= 0.967;
    co.hist.push({ t: g.t, cash: Math.round(co.cash), ...Object.fromEntries(Object.entries(co.acc).map(([k, v]) => [k, Math.round(v)])) }); if (co.hist.length > 400) co.hist.shift(); co.acc = {};
    co.negDays = co.cash < -250000 ? co.negDays + 1 : 0;
    if (co.negDays > 20) bankrupt(g, co);
  }
  for (const f of Object.values(g.fac)) f.sf = facStaffFactor(g, f);
  for (const w of Object.values(g.workers)) {   // skills grow by doing the work
    if (w.founder) continue; const s = w.ship ? g.ships[w.ship] : null;
    if (w.xp > 20 && w.skill < w.pot) { w.skill = Math.min(w.pot, w.skill + (w.pot - w.skill) * 0.0007 * Math.min(w.xp / 24, 1)); w.xp = 0; }
    w.morale = clamp(w.morale + (w.fat > 75 ? -0.6 : 0.15), 20, 100);
    const target = salaryOf(g, { ...w, skill: Math.round(w.skill) }); if (target > w.sal * 1.08) { w.sal = target; }
  }
  if (day % 7 === 0) refreshLabour(g);
  for (const fn of hooks.daily) fn(g);
  if (day % 30 === 0) for (const w of Object.values(g.workers)) if (w.mgr) { w.mgr.spent = 0; w.mgr.since = g.t; }
}
function refreshLabour(g) {
  g.labourTone = clamp(g.labourTone + gauss(g) * 0.15, 0.05, 0.95);
  g.labour = g.labour.filter(() => rnd(g) > 0.3); while (g.labour.length < 14) g.labour.push(candidate(g));
}

function bankrupt(g, co) {
  co.dead = true; co.ai = true; log(g, co.name + ' has gone bankrupt.', { co: co.id, sev: 'bad', slow: true });
  const buyers = g.companies.filter(c => !c.dead && c.id !== co.id).sort((a, b) => b.cash - a.cash);
  const buyer = buyers[0];
  for (const s of Object.values(g.ships)) if (s.co === co.id) {
    if (buyer && buyer.cash > SHIP_TYPES[s.type].cost * 0.4) { money(g, buyer, -SHIP_TYPES[s.type].cost * 0.3, 'capex'); s.co = buyer.id; s.crew = []; s.prog = null; s.inter = []; s.sup = null; }
    else delete g.ships[s.id];
  }
  for (const w of Object.values(g.workers)) if (w.co === co.id) { w.ship = null; delete g.workers[w.id]; }
  for (const a of g.ast) if (a.claim === co.id) { if (buyer) a.claim = buyer.id, a.stock[buyer.id] = a.stock[co.id] || {}; else a.claim = null; delete a.stock[co.id]; }
  for (const f of Object.values(g.fac)) if (f.co === co.id) { if (buyer) f.co = buyer.id; else delete g.fac[f.id]; }
  dirty(g); if (g.view === co.id) g.over = true;
}

// ---------------------------------------------------------------- the clock
export function tick(g) {   // one game hour
  const dt = 1;
  for (const s of Object.values(g.ships)) tickShip(g, s, dt);
  tickFacilities(g, dt);
  g.t += dt;
  if (g.t % HOURS === 0) dayEnd(g);
}
export function advance(g, hours, budgetMs = 12) {   // run whole hours until done or out of time
  const t0 = performance.now(); let n = 0;
  while (n < hours) { tick(g); n++; if ((n & 15) === 0 && performance.now() - t0 > budgetMs) break; }
  return n;
}

// ---------------------------------------------------------------- new game, save and load
export function newGame(settings = {}) {
  const S = { mode: 'owner', level: 0, quality: 'professional', difficulty: 'standard', philosophy: 'balanced', rivals: 2, seed: 1234, name: 'Vesta Ore Co.', asteroids: 1600, ...settings };
  const g = { v: 1, settings: S, rng: (S.seed >>> 0) || 1, nid: 1, t: 72 * 24 + 6, ast: [], companies: [], ships: {}, workers: {}, fac: {}, inv: {}, intel: {}, contracts: [], events: [], decisions: [], requests: [], labour: [], labourTone: 0.5, view: 0, over: false, mev: [] };
  g.ast = genAsteroids(g, S.asteroids); mkMarkets(g);
  const observer = S.mode !== 'owner';
  const you = makeCompany(g, { name: S.name || 'Vesta Ore Co.', ai: observer, philosophy: S.philosophy, hq: 'earth' });
  foundCompany(g, you, S.level, S.quality, { founder: S.mode === 'owner', founderName: S.founderName, custom: S.level === 6 ? S.custom : null });
  const hqs = ['mars', 'ceres', 'moon', 'earth', 'mars'];
  const phils = ['industrial', 'trading', 'growth', 'conservative', 'exploration', 'balanced'];
  const rivalLevel = S.mode === 'universe' ? Math.max(1, Math.min(5, S.level || 3)) : Math.max(1, Math.min(4, S.level));
  for (let i = 0; i < S.rivals; i++) {
    const r = makeCompany(g, { ai: true, philosophy: phils[i % phils.length], hq: hqs[i % hqs.length] });
    foundCompany(g, r, S.mode === 'universe' ? clamp(2 + (i % 3), 2, 5) : clamp(rivalLevel - (i % 2), 2, 4), 'mixed', {});
  }
  seedIntel(g); refreshLabour(g); for (const fn of hooks.init) fn(g);
  g.view = 0;
  log(g, S.mode === 'owner' ? 'Welcome to the Belt, ' + you.name + '.' : 'Observation begins. Follow any company from its inspector.', { co: 0, sev: 'good' });
  return g;
}
function seedIntel(g) {   // every company starts with a few scanned neighbours and a survey on its claims
  const cer = 'ceres';
  for (const co of g.companies) {
    const near = g.ast.map(a => ({ a, d: distLoc(g, a.id, cer) })).sort((x, y) => x.d - y.d).slice(0, 220);
    const pool = near.filter(() => rnd(g) < 0.35).slice(0, 6);
    if (co.id === 0) { const m = near.find(x => x.a.cls === 'M' && x.a.claim === null); if (m && !pool.some(x => x.a === m.a)) pool.push(m); }
    for (const p of pool) learn(g, co.id, p.a, 1, LVL_SIG[1]);
    const cap = co.startClaims || 0;
    const cands = near.filter(x => x.a.claim === null && x.a.res0 > 200e3 && x.a.cls !== 'C').sort((x, y) => (y.a.res0 * (y.a.cls === 'M' ? 3 : 1)) - (x.a.res0 * (x.a.cls === 'M' ? 3 : 1))).slice(rnd(g) * 8 | 0);
    let k = 0; for (const x of cands) { if (k >= cap) break; if (x.a.claim !== null) continue; learn(g, co.id, x.a, 2, 0.1); x.a.claim = co.id; x.a.stock[co.id] = {}; k++; }
    
  }
}
export const serialize = g => JSON.stringify(g);
export function deserialize(s) { const g = JSON.parse(s); g.ast.forEach(a => { a.stock ||= {}; }); return g; }
export function setPolicy(g, coId, patch) { Object.assign(co$(g, coId).policy, patch); return { ok: true }; }

// ---------------------------------------------------------------- player-facing actions (the AI uses these too)
const ok = (msg, extra = {}) => ({ ok: true, msg, ...extra });
const no = msg => ({ ok: false, msg });
export function buyShip(g, coId, type) {
  const co = co$(g, coId), T = SHIP_TYPES[type]; if (co.cash < T.cost) return no('A ' + T.name + ' costs ' + fmtMoney(T.cost) + '.');
  const s = addShip(g, co, type); log(g, co.name + ' bought the ' + T.name + ' ' + s.name + '.', { co: coId, ref: s.id }); return ok('Bought ' + s.name + '. It needs a crew.', { id: s.id });
}
export function sellShip(g, coId, sid) {
  const s = g.ships[sid], co = co$(g, coId); if (!s || s.co !== coId) return no('Not your ship.');
  if (!(s.at && isStation(s.at))) return no('Dock the ship at a station first.');
  for (const id of [...s.crew]) uncrew(g, g.workers[id]);
  const v = Math.round(SHIP_TYPES[s.type].cost * 0.55 * s.cond / 100); money(g, co, v, 'capex'); delete g.ships[sid]; dirty(g); return ok('Sold for ' + fmtMoney(v) + '.');
}
export function hireCandidate(g, coId, cid) {
  const co = co$(g, coId), i = g.labour.findIndex(w => w.id === cid); if (i < 0) return no('That candidate took another job.');
  const w = g.labour[i], fee = w.sal * 10; if (co.cash < fee) return no('Signing fee is ' + fmtMoney(fee) + '.');
  g.labour.splice(i, 1); money(g, co, -fee, 'payroll'); hireWorker(g, co, w); log(g, co.name + ' hired ' + w.name + ' (' + ROLE_NAME[w.role].toLowerCase() + ').', { co: coId, ref: w.id }); return ok('Hired ' + w.name + '.', { id: w.id });
}
export function fireWorker(g, coId, wid) {
  const w = g.workers[wid]; if (!w || w.co !== coId) return no('Not your employee.'); if (w.founder) return no('You cannot fire yourself.');
  if (w.ship) { const s = g.ships[w.ship]; if (!(s.at && isStation(s.at))) return no('Wait until ' + s.name + ' is docked at a station.'); uncrew(g, w); }
  money(g, co$(g, coId), -w.sal * 15, 'payroll'); for (const sv of Object.values(g.workers)) sv.team = sv.team.filter(x => x !== wid);
  for (const s of Object.values(g.ships)) if (s.sup === wid) s.sup = null; delete g.workers[wid]; dirty(g); return ok(w.name + ' left with severance.');
}
export function assignCrew(g, coId, wid, sid) {
  const w = g.workers[wid], s = g.ships[sid]; if (!w || !s || w.co !== coId || s.co !== coId) return no('Not yours.');
  if (!(s.at && isStation(s.at))) return no(s.name + ' must be docked at a station to change crew.');
  if (w.ship === sid) return ok('Already aboard.'); if (w.ship && !(g.ships[w.ship].at && isStation(g.ships[w.ship].at))) return no(w.name + ' is aboard a ship in flight.');
  const T = SHIP_TYPES[s.type]; const allowed = new Set([...T.crew.req.flat(), ...T.crew.opt.flat()]);
  if (!w.founder && !allowed.has(w.role)) return no(ROLE_NAME[w.role] + 's cannot crew a ' + T.name + '.');
  if (s.crew.length >= T.crew.req.length + T.crew.opt.length) return no(s.name + ' has no free berth.');
  if (w.fac) w.fac = null; crew(g, s, w); return ok(w.name + ' joined ' + s.name + '.');
}
export function unassignCrew(g, coId, wid) {
  const w = g.workers[wid]; if (!w || w.co !== coId) return no('Not yours.');
  if (w.ship) { const s = g.ships[w.ship]; if (!(s.at && isStation(s.at))) return no(s.name + ' must be docked at a station.'); uncrew(g, w); } w.fac = null; return ok(w.name + ' is on the bench.');
}
export function assignFacility(g, coId, wid, fid) {
  const w = g.workers[wid], f = g.fac[fid]; if (!w || !f || w.co !== coId || f.co !== coId) return no('Not yours.');
  if (w.ship) { const s = g.ships[w.ship]; if (!(s.at && isStation(s.at))) return no(s.name + ' must be docked.'); uncrew(g, w); }
  if (w.role !== 'engineer') return no('Refineries are staffed by engineers.'); w.fac = fid; w.at = f.st; return ok(w.name + ' now works at the ' + STATIONS[f.st].short + ' refinery.');
}
export function promote(g, coId, wid, role) {
  const w = g.workers[wid]; if (!w || w.co !== coId) return no('Not yours.'); if (w.founder) return no('The founder already leads.');
  if (role !== 'supervisor' && role !== 'manager') return no('Promote to supervisor or manager.');
  const need = role === 'supervisor' ? 55 : 68; if (w.lead < need - 12) return no(w.name + ' lacks the leadership for this step (leadership ' + w.lead + ').');
  if (w.ship) { const s = g.ships[w.ship]; if (!(s.at && isStation(s.at))) return no('Wait until ' + s.name + ' docks.'); uncrew(g, w); }
  hist(g, w, 'Promoted from ' + ROLE_NAME[w.role].toLowerCase() + ' to ' + role); w.role = role; w.grade = role; w.fac = null; w.sal = salaryOf(g, w);
  if (role === 'manager') w.mgr = { obj: 'profit', spend: 3e6, hire: true, buy: true, claim: true, build: false, spent: 0, since: g.t };
  log(g, w.name + ' was promoted to ' + role + '.', { co: coId, ref: w.id, sev: 'good' }); return ok(w.name + ' is now a ' + role + '.');
}
export function setTeam(g, coId, wid, shipIds) {
  const w = g.workers[wid]; if (!w || w.co !== coId || (w.role !== 'supervisor' && w.role !== 'manager')) return no('Pick a supervisor or manager.');
  const cap = w.role === 'supervisor' ? 8 : 40; shipIds = shipIds.slice(0, cap);
  for (const id of w.team) if (g.ships[id] && g.ships[id].sup === wid) g.ships[id].sup = null;
  w.team = shipIds; for (const id of shipIds) { const s = g.ships[id]; if (s.sup && s.sup !== wid) { const o = g.workers[s.sup]; if (o) o.team = o.team.filter(x => x !== id); } s.sup = wid; }
  return ok(w.name + ' now runs ' + shipIds.length + ' ships.');
}
export function setManager(g, coId, wid, patch) { const w = g.workers[wid]; if (!w || !w.mgr) return no('Not a manager.'); Object.assign(w.mgr, patch); return ok('Authority updated.'); }
export function rescueShip(g, coId, sid) {
  const s = g.ships[sid], co = co$(g, coId); if (!s || s.state !== 'stranded') return no('Not stranded.'); const fee = 150000;
  if (co.cash < fee) return no('Rescue costs ' + fmtMoney(fee) + '.'); money(g, co, -fee, 'other'); s.rescue = g.t + 120; return ok('A tanker will reach ' + s.name + ' in 5 days.');
}
export function borrow(g, coId, amt) { const co = co$(g, coId), limit = 30e6 + payrollPerDay(g, coId) * 400; if (co.debt + amt > limit) return no('The bank will lend up to ' + fmtMoney(limit) + ' in total.'); co.debt += amt; money(g, co, amt, 'loans'); return ok('Borrowed ' + fmtMoney(amt) + ' at 9% a year.'); }
export function repay(g, coId, amt) { const co = co$(g, coId); amt = Math.min(amt, co.debt, Math.max(0, co.cash)); if (amt <= 0) return no('Nothing to repay.'); co.debt -= amt; money(g, co, -amt, 'loans'); return ok('Repaid ' + fmtMoney(amt) + '.'); }
export function setAI(g, coId, on) { const co = co$(g, coId); co.ai = on; log(g, on ? co.name + ' is now run by its AI leadership.' : 'You took control of ' + co.name + '.', { co: coId, sev: 'info' }); return ok(on ? 'Handed to AI.' : 'You are in control.'); }
export function execRequest(g, r) {   // approve a manager's request
  const co = co$(g, r.co);
  if (r.kind === 'buyShip') return buyShip(g, r.co, r.type);
  if (r.kind === 'hire') return hireCandidate(g, r.co, r.cid);
  if (r.kind === 'claim') return claim(g, r.co, r.ast);
  if (r.kind === 'build') return buildRefinery(g, r.co, r.st);
  return no('Unknown request.');
}
export function resolveRequest(g, id, approve) {
  const i = g.requests.findIndex(r => r.id === id); if (i < 0) return no('Request expired.'); const r = g.requests[i]; g.requests.splice(i, 1);
  if (!approve) { const m = g.workers[r.by]; if (m && m.mgr) m.mgr.denied = (m.mgr.denied || 0) + 1; return ok('Rejected.'); }
  const res = execRequest(g, r); if (res.ok && r.kind === 'buyShip' && res.id) { const m = g.workers[r.by]; if (m) setTeam(g, r.co, r.by, [...m.team, res.id]); }
  return res;
}
