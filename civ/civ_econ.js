/* =====================================================================
   Pixel Town — civilization mode: economy
   Gifts and favours → barter → a meeting place → a trading spot → market stalls → shops → a commercial district.
   Money appears when barter keeps failing; businesses appear when someone sees an opening and can fund it.
   Organizations, jobs, contracts, credit, banks, shares and bankruptcy all run on the same few structures.
   ===================================================================== */
const GOOD_TASK = {berries:'forage', roots:'forage', fish:'fish', game:'hunt', hide:'hunt', wood:'chop', stone:'quarry', fiber:'gather', thatch:'gather', clay:'gather',
  tools:'craft', rope:'craft', cloth:'craft', pottery:'craft', clothes:'craft', mtools:'craft', preserved:'cook', grain:'farm', veg:'farm', milk:'herd', eggs:'herd', meat:'herd'};
function civMoneyOn(){ return !!(S && S.civ && S.civ.econ.money); }
function civMoneyName(){ return S.civ.econ.money==='coins' ? 'coins' : 'shell money'; }
function civPrice(g){ const P = S.civ.econ.prices; return P[g] || (CG[g] ? CG[g].v : 1); }
function civMoneyVal(c){ return civMoneyOn() ? (c.wallet < 20 ? 1.4 : c.wallet < 100 ? 1 : c.wallet < 500 ? 0.7 : 0.45) : 0; }

// ---------- purses: people, organizations, the government and the community fund ----------
function civOwnerPurse(o){ if (!o) return {k:'community'}; if (o.k==='hh'){ const h = S.civ.hh[o.id]; const m = h && hhAdults(h).sort((a,b)=>b.wallet-a.wallet)[0]; return m ? {k:'person', id:m.id} : {k:'community'}; } return o; }
function civPurse(p){ if (!p) return 0; if (p.k==='person'){ const c = alive(p.id); return c ? c.wallet : 0; } if (p.k==='org'){ const o = S.civ.orgs[p.id]; return o ? o.cash : 0; } if (p.k==='gov') return S.civ.gov.treasury; return S.civ.fund||0; }
function civAdjPurse(p, d){ if (p.k==='person'){ const c = alive(p.id); if (!c){ S.civ.fund = (S.civ.fund||0) + d; return; } if (c){ c.wallet = Math.round((c.wallet + d)*100)/100; const b = c.days[c.days.length-1]; if (d>0) b.inc += d; else b.exp -= d; } } else if (p.k==='org'){ const o = S.civ.orgs[p.id]; if (o){ o.cash = Math.round((o.cash + d)*100)/100; if (d>0) o.revWk = (o.revWk||0)+d; else o.expWk = (o.expWk||0)-d; } } else if (p.k==='gov') S.civ.gov.treasury += d; else S.civ.fund = (S.civ.fund||0) + d; }
function civMoveMoney(from, to, amt, why){ amt = Math.round(amt*100)/100; if (!(amt>0) || !from || !to) return false; if (civPurse(from) < amt) return false; civAdjPurse(from, -amt); civAdjPurse(to, amt); S.civ.econ.vol += amt; if (why==='sale'||why==='property') S.civ.econ.wkVol = (S.civ.econ.wkVol||0) + amt; return true; }

// ---------- barter: two people, two larders, and a trade only if both come out ahead ----------
function civSurplus(h, c){ const out = []; const days = hhFoodDays(h), need = Math.max(1, hhMembers(h).length)*90; for (const g in h.store){ const D = CG[g]; if (!D || g==='water' || g==='beads') continue; const q = h.store[g];
  // food above three days' worth, or anything fresh that will spoil before it is eaten; materials beyond what their own projects need
  const keep = D.cat==='food' ? (days>3 ? Math.max(0, q - (days-3)*need/Math.max(1,storeFood(h.store))*q) : q) * (D.perish && D.perish<6 && q*D.food > need*2 ? 0.5 : 1) : civMaterialNeed(c, g) + (D.cat==='crafted' ? 1 : 6);
  if (q - keep >= 1) out.push([g, Math.floor(q-keep)]); } return out; }
function civWants(h, c){ const w = []; const days = hhFoodDays(h); if (days < 4) w.push(['food', 6]); const tools = (h.store.tools||0)+(h.store.mtools||0); if (tools < 1) w.push(['tools', 1]); civProjectsFor(c).forEach(p=>{ for (const g in p.need){ const miss = p.need[g]-(p.have[g]||0)-(h.store[g]||0); if (miss>0) w.push([g, Math.ceil(miss)]); } }); if (!(h.store.rope>0) && sk(c,'fishing')>30) w.push(['rope',1]); if (seasonOf(civDay())>=2 && !(h.store.clothes>0) && (h.store.cloth||0)<2) w.push(['cloth',2]); return w; }
function civBarter(a, b){
  const ha = hhOf(a), hb = hhOf(b); if (!ha || !hb || ha===hb) return false;
  const wa = civWants(ha, a), wb = civWants(hb, b); if (!wa.length && !wb.length) return false;
  const sa = civSurplus(ha, a), sb = civSurplus(hb, b);
  const match = (wants, surplus) => { for (const [g, q] of wants){ const hit = surplus.find(([x])=> g==='food' ? CG[x].cat==='food' : x===g); if (hit) return [hit[0], Math.min(q, hit[1])]; } return null; };
  const getA = match(wa, sb), getB = match(wb, sa);
  if (civMoneyOn() && (getA || getB)) return civCashDeal(a, b, getA, getB);
  if (!getA || !getB){
    // one side wants something the other can't match: a gift between friends, or a failed barter that makes people wish for money
    const want = getA ? [a, b, getA] : getB ? [b, a, getB] : null;
    if (want){ const [x, y, [g,q]] = want; const R = peekRel(y, x.id); if ((R.tags.includes('Family') || R.affinity>55) && y.personality.agreeableness>0.45){ storeTake(hhOf(y).store, g, q); storeAdd(hhOf(x).store, g, q); civFavor(x, y, CG[g].v*q); adjustRel(x, y, 3); ev('gifts'); civCredit(y, GOOD_TASK[g], x); return true; } }
    // a failed swap: both had something to trade, one wanted something, and nothing matched (the double coincidence problem)
    if ((wa.length || wb.length) && sa.length && sb.length && S.minute - (a.civ.failAt||-999) > 600){ a.civ.failAt = S.minute; S.civ.econ.barterFail++; ev('barter_fail'); }
    if (wa.length || wb.length) civDemand(wa.concat(wb));
    return false;
  }
  // value both sides; negotiation skill tips the quantities
  const va = CG[getA[0]].v*getA[1], vb = CG[getB[0]].v*getB[1];
  let qa = getA[1], qb = getB[1];
  if (va > vb*1.3) qa = Math.max(1, Math.floor(qa*vb/va*(1+ (sk(a,'negotiation')-sk(b,'negotiation'))/300)));
  else if (vb > va*1.3) qb = Math.max(1, Math.floor(qb*va/vb*(1+ (sk(b,'negotiation')-sk(a,'negotiation'))/300)));
  storeTake(hb.store, getA[0], qa); storeAdd(ha.store, getA[0], qa);
  storeTake(ha.store, getB[0], qb); storeAdd(hb.store, getB[0], qb);
  adjustRel(a, b, 2); adjustRel(b, a, 2); civCredit(b, GOOD_TASK[getA[0]], a); civCredit(a, GOOD_TASK[getB[0]], b);
  const E = S.civ.econ, k = civSpotKey(a); E.barter++; E.spots[k] = (E.spots[k]||0) + 1; ev('barter'); S.week.trades++;
  if (hash(a.id+b.id+S.minute)%9===0) remember(a, `Swapped ${qb} ${CG[getB[0]].name.toLowerCase()} with ${b.name} for ${qa} ${CG[getA[0]].name.toLowerCase()}.`, 3, [b.id], 'Transaction');
  return true;
}
function civCredit(producer, task, customer){ if (!task || !producer) return; const m = producer.civ.buyers[task] = producer.civ.buyers[task] || {}; m[customer.id] = (m[customer.id]||0) + 1; }
function civDemand(list){ const D = S.civ.demand = S.civ.demand || {}; list.forEach(([g,q])=>{ const t = g==='food' ? 'forage' : GOOD_TASK[g]; if (t) D[t] = (D[t]||0) + q; }); }
function civSpotKey(c){ return Math.floor(c.rt.x/4)+','+Math.floor(c.rt.y/4); }
function civCashDeal(a, b, getA, getB){
  const E = S.civ.econ; let did = false;
  const deal = (buyer, seller, g, q) => { const p = civPrice(g)*q; if (buyer.wallet < p) { q = Math.floor(buyer.wallet/civPrice(g)); if (q<1) return; } const cost = Math.round(civPrice(g)*q*100)/100; storeTake(hhOf(seller).store, g, q); storeAdd(hhOf(buyer).store, g, q); civMoveMoney({k:'person',id:buyer.id}, {k:'person',id:seller.id}, cost, 'sale'); civCredit(seller, GOOD_TASK[g], buyer); E.wkTrades++; ev('trades'); did = true; };
  if (getA) deal(a, b, getA[0], getA[1]); if (getB) deal(b, a, getB[0], getB[1]);
  if (did){ const k = civSpotKey(a); E.spots[k] = (E.spots[k]||0)+1; S.week.trades++; }
  return did;
}

// ---------- money: shell beads become currency when barter keeps failing; coins come with metal and authority ----------
function civMoneyCheck(){
  const E = S.civ.econ; if (E.money==='coins') return;
  const hhs = Object.values(S.civ.hh), holders = hhs.filter(h=>(h.store.beads||0)>=3).length;
  const traders = S.citizens.filter(c=>kn(c,'trade')>=20).length;
  if (!E.money && E.barterFail >= 90 && E.barter >= 40 && (holders >= hhs.length*0.25 || traders>=3)){
    E.money = 'beads'; E.moneyDay = civDay();
    // the beads people hold become their savings
    hhs.forEach(h=>{ const n = Math.floor(h.store.beads||0); if (!n) return; storeTake(h.store, 'beads', n); const ad = hhAdults(h); ad.forEach((m,i)=>{ m.wallet += Math.floor(n/ad.length) + (i===0 ? n%Math.max(1,ad.length) : 0); }); });
    CIV_GOODS.forEach(g=>{ E.prices[g.id] = +(g.v).toFixed(2); });
    chronicle(`Too many swaps were falling through. Shell beads have become money: people now price things in beads and pay with them.`, 9, '🐚', 'economy');
    S.civ.stageNote = 'money'; ev('money');
  }
  if (E.money==='beads' && civTechKnown('currency') && (S.civ.gov.stage>=3 || civTechKnown('smelting'))){
    E.money = 'coins'; E.coinDay = civDay(); chronicle(`The first coins were struck. Beads are traded in for metal money, one for one.`, 8, '🪙', 'economy'); ev('coins');
  }
}
// minting from precious metal grows the money supply (and prices follow)
function civMint(g, q){ const E = S.civ.econ; if (E.money!=='coins') return 0; const coins = Math.round(q*(g==='gold'?40:g==='silver'?12:3)); return coins; }
function civMoneySupply(){ return S.citizens.reduce((a,c)=>a+Math.max(0,c.wallet),0) + Object.values(S.civ.orgs).reduce((a,o)=>a+Math.max(0,o.cash),0) + S.civ.gov.treasury + (S.civ.fund||0); }

// ---------- the market's stages ----------
function civMarketStages(){
  const E = S.civ.econ, C = S.civ, wk = E.barter - (E.barterWk0||0) + (E.wkTrades||0);
  const topSpot = Object.entries(E.spots).sort((a,b)=>b[1]-a[1])[0];
  const set = (n, text) => { if (E.stage >= n) return; E.stage = n; E.stageHist.push({stage:n, day:civDay()}); chronicle(text, 8, '🧺', 'economy'); S.week.society.push(`Market: ${MARKET_STAGES[n]}`); ev('market_stage'); };
  if (E.stage<2 && wk >= 12 && topSpot && topSpot[1] >= 8) set(2, 'People keep meeting at the same spot to swap goods. It is becoming the place to trade.');
  if (E.stage<3 && E.stage>=2 && wk >= 25 && !civHas(['trading_spot','market']).length && !civProjects().some(p=>p.def==='trading_spot')){
    const [kx, ky] = topSpot ? topSpot[0].split(',').map(Number) : [0,0]; const site = civFindSite('trading_spot', topSpot ? [kx*4+2, ky*4+2] : C.center, {margin:0});
    if (site){ civStartProject('trading_spot', site, {k:'community'}, {purpose:'commerce', why:'so traders have a place to lay out goods'}); } }
  if (E.stage<3 && civHas('trading_spot').length) set(3, 'A trading spot has been cleared. Goods change hands there most days.');
  if (E.stage>=3 && E.stage<4 && (wk >= 40 || E.wkVol > 150) && !civHas('market').length && !civProjects().some(p=>p.def==='market')){
    const ts = civHas('trading_spot')[0], site = civFindSite('market', ts ? [ts.x+2, ts.y+1] : C.center, {margin:0});
    if (site) civStartProject('market', site, C.gov.stage>=3 ? {k:'gov'} : {k:'community'}, {purpose:'commerce', why:'the trading spot is overflowing'}); }
  if (E.stage<4 && civHas('market').length) set(4, 'Market stalls stand where the trading spot used to be.');
  const shops = Object.values(C.orgs).filter(o=>o.status==='active' && o.hq && S.civ.structs[o.hq] && ['retail','food','crafts','hospitality','health','professional'].includes((BUSINESS_TYPES[o.biz]||{}).industry));
  if (E.stage<5 && E.stage>=3 && shops.length) set(5, `${shops[0].name} opened its doors: the settlement's first permanent shop.`);
  if (E.stage===5 && shops.length>=4){ const [mx,my] = civMarketCenter(); const near = shops.filter(o=>{ const s = S.civ.structs[o.hq]; return Math.hypot(s.x-mx, s.y-my) < 12; }); if (near.length>=4){ set(6, 'Shops now crowd around the market: the settlement has a commercial district.'); E.district = true; } }
}

// ---------- market with money ----------
function civList(seller, g, q, price, at){ const E = S.civ.econ; let L = E.listings.find(l=>l.seller.k===seller.k && l.seller.id===seller.id && l.g===g); if (!L){ L = {id:++E.lSeq, seller, g, q:0, price, at: at||null, day:civDay()}; E.listings.push(L); } L.q += q; L.price = price; return L; }
function civHHSellDaily(){
  if (!civMoneyOn()) return;
  Object.values(S.civ.hh).forEach(h=>{ const c = hhAdults(h)[0]; if (!c) return; const sp = civSurplus(h, c);
    sp.forEach(([g,q])=>{ if (q<2) return; const sell = Math.floor(q*0.6); storeTake(h.store, g, sell); civList({k:'person', id:c.id}, g, sell, civPrice(g)); }); });
}
function civBuyFood(c){
  const E = S.civ.econ; let ate = false;
  const opts = E.listings.filter(l=>l.q>=1 && CG[l.g] && CG[l.g].cat==='food' && !(l.seller.k==='person' && l.seller.id===c.id)).sort((a,b)=>a.price/CG[a.g].food - b.price/CG[b.g].food);
  for (const L of opts){ if (c.needs.hunger>=60) break; const q = Math.min(L.q, 3, Math.floor(c.wallet/L.price)); if (q<1) continue;
    if (!civMoveMoney({k:'person', id:c.id}, civOwnerPurse(L.seller), L.price*q, 'sale')) continue;
    L.q -= q; c.needs.hunger = clamp(c.needs.hunger + CG[L.g].food*q, 0, 100); ate = true; E.wkTrades++; ev('trades'); ev('food_bought', q);
    const s = L.seller.k==='person' ? alive(L.seller.id) : null; if (s) civCredit(s, GOOD_TASK[L.g], c); }
  if (!ate) { E.unmet = E.unmet || {}; E.unmet.food = (E.unmet.food||0)+1; civDemand([['food',2]]); }
  return ate;
}
function civBuy(c, g, q, maxPrice){
  const E = S.civ.econ; let got = 0;
  for (const L of E.listings.filter(l=>l.g===g && l.q>=1).sort((a,b)=>a.price-b.price)){ if (got>=q) break; if (maxPrice && L.price>maxPrice) break;
    const n = Math.min(L.q, q-got, Math.floor(civPurse({k:'person',id:c.id})/L.price)); if (n<1) break;
    if (!civMoveMoney({k:'person', id:c.id}, civOwnerPurse(L.seller), L.price*n, 'sale')) break; L.q -= n; got += n; const h = hhOf(c); if (h) storeAdd(h.store, g, n); E.wkTrades++; ev('trades'); }
  if (got<q){ E.unmet = E.unmet || {}; E.unmet[g] = (E.unmet[g]||0) + (q-got); civDemand([[g, q-got]]); }
  return got;
}
function civMarketHour(h){
  if (!civMoneyOn()) return;
  const E = S.civ.econ;
  if (h===8 || h===16){
    // prices move with what sits unsold and what people failed to buy
    const sup = {}; E.listings.forEach(l=>{ sup[l.g] = (sup[l.g]||0) + l.q; });
    for (const g in E.prices){ const un = (E.unmet||{})[g==='food'?'food':g] || 0, s = sup[g]||0, p = E.prices[g], base = CG[g].v*(E.level||1);
      let np = p; if (un>2) np = p*1.04; else if (s > 30) np = p*0.97; else np = p + (base-p)*0.01;
      if (CG[g].cat==='food' && (E.unmet||{}).food > 4) np *= 1.03;
      E.prices[g] = +clamp(np, CG[g].v*0.25, CG[g].v*12*(E.level||1)).toFixed(2); }
    E.listings.forEach(l=>{ l.price = E.prices[l.g] ?? l.price; });
    E.unmet = {};
  }
  E.listings = E.listings.filter(l=>l.q>=0.5 && civDay()-l.day < 20);
}

// ---------- organizations ----------
function civOrgs(pred){ return Object.values(S.civ.orgs).filter(o=>o.status==='active' && (!pred || pred(o))); }
function civNewOrg(type, name, founders, opts){
  opts = opts || {}; const C = S.civ, id = 'org_'+(++C.oSeq);
  const owners = {}; if (ORG_TYPES[type].own!=='none' && ORG_TYPES[type].own!=='members'){ const share = 1/Math.max(1,founders.length); founders.forEach(f=>owners[f.id] = opts.shares ? (opts.shares[f.id]||share) : share); }
  const o = {id, type, biz: opts.biz||null, name, founded:civDay(), founders: founders.map(f=>f.id), owners, shares: 1000, members: ORG_TYPES[type].own==='members' ? founders.map(f=>f.id) : [], board:[], mgr: founders[0] ? founders[0].id : null,
    staff:[], cash:0, debt:0, stock:{}, sites:[], hq:null, price:1, quality:0.5, reputation:0.5, revWk:0, expWk:0, profitAvg:0, hist:[], status:'active', listed:false, sharePrice:0, divs:0, retained:0,
    memory:{products:{}, suppliers:{}, employees:{}, investments:[], locations:{}, lawsuits:[], expansions:[], lessons:[]}, contrib: opts.contrib||{}, authority: opts.authority||{}, edu: opts.edu||null, meta: opts.meta||{}};
  C.orgs[id] = o; ev('orgs'); ev('org_'+type);
  S.civ.history.push({t:S.minute, kind:'org', type, name});
  return o;
}
function civOrgPurse(o){ return {k:'org', id:o.id}; }
function civOrgDissolve(o, why){ o.status = why==='bankrupt' ? 'bankrupt' : 'dissolved'; o.ended = civDay(); (o.staff||[]).map(alive).filter(Boolean).forEach(w=>civQuit(w, 'the business closed')); S.civ.jobs = S.civ.jobs.filter(j=>j.org!==o.id); chronicle(`${o.name} has ${why==='bankrupt'?'gone bankrupt':'closed'}.`, 7, why==='bankrupt'?'📉':'🚪', 'business'); ev(why==='bankrupt'?'bankruptcies':'closures'); }
// founder dies: shares pass to heirs, and the company carries on under a new manager
function civOrgsOnDeath(c){
  const heirs = [c.partner && alive(c.partner)].concat(S.citizens.filter(k=>k.parents.includes(c.id) && isAdult(k))).filter(Boolean);
  civOrgs().forEach(o=>{ if (o.owners[c.id]){ const sh = o.owners[c.id]; delete o.owners[c.id]; if (heirs.length) heirs.forEach(hh=>o.owners[hh.id] = (o.owners[hh.id]||0) + sh/heirs.length); else { const rest = Object.keys(o.owners); if (rest.length) rest.forEach(id=>o.owners[id] += sh/rest.length); } }
    if (o.mgr===c.id){ const next = (o.staff||[]).map(cById).filter(x=>x && x!==c).sort((a,b)=>civStaffScore(b,o)-civStaffScore(a,o))[0] || heirs[0]; o.mgr = next ? next.id : null; if (next) chronicle(`${next.name} now runs ${o.name} after ${c.name}'s death.`, 6, '🏢', 'business'); else if (!Object.keys(o.owners).length && !o.members.length) civOrgDissolve(o, 'founder died'); }
    o.staff = o.staff.filter(x=>x!==c.id); o.members = o.members.filter(x=>x!==c.id); });
  // debts do not vanish: creditors can claim against the estate
  Object.values(S.civ.contracts).forEach(k=>{ if (k.status!=='active') return; if (k.kind==='loan' && k.parties[1].k==='person' && k.parties[1].id===c.id){ k.parties[1] = heirs[0] ? {k:'person', id:heirs[0].id} : k.parties[1]; if (!heirs[0]){ k.status = 'defaulted'; civCaseFile('civil', 'inheritance', k.parties[0], {k:'estate', id:c.id, name:c.name}, `debts of the late ${c.name}`, k.terms.left||0); } } });
}
function civStaffScore(c, o){ const B = BUSINESS_TYPES[o.biz]; let s = 0; if (B) for (const k in B.skills) s += sk(c,k); return s + sk(c,'management')*0.8 + (o.memory.employees[c.id]||0)*5; }

// ---------- business formation: someone notices an opening and can act on it ----------
function civOpportunities(c){
  const out = [];
  for (const id in BUSINESS_TYPES){ const B = BUSINESS_TYPES[id];
    if (B.tech && !civTechKnown(B.tech)) continue;
    let fit = 0, n = 0; for (const k in B.skills){ fit += Math.min(1, sk(c,k)/B.skills[k]); n++; } fit = n ? fit/n : 0.5; if (B.know) for (const k in B.know) fit *= Math.min(1, kn(c,k)/B.know[k]);
    if (fit < 0.55) continue;
    const comp = civOrgs(o=>o.biz===id).length;
    const dem = civBizDemand(B);
    const inputsOk = !B.in || Object.keys(B.in).every(g=>civAvail(g) > 0);
    const workers = S.citizens.filter(x=>isAdult(x) && !x.civ.job && x!==c).length;
    const capital = c.wallet + (hhOf(c) ? civHHWealth(hhOf(c))*0.2 : 0);
    if (comp && dem < comp*3) continue; // the market is already served
    const score = dem*fit/(1+comp*1.6) + (inputsOk?1:-2) + Math.min(2, capital/Math.max(20, B.start)) + (workers>3 ? 0.5 : 0) - (B.start > capital*3 ? 2 : 0);
    out.push({id, score, fit, comp, dem});
  }
  return out.sort((a,b)=>b.score-a.score);
}
function civAvail(g){ const E = S.civ.econ; return E.listings.filter(l=>l.g===g).reduce((a,l)=>a+l.q,0) + Object.values(S.civ.hh).reduce((a,h)=>a+(h.store[g]||0),0)*0.2; }
function civBizDemand(B){
  const E = S.civ.econ, n = S.citizens.length; let d = 0;
  if (B.out) for (const g in B.out){ d += ((E.unmet||{})[g]||0)*0.5 + ((S.civ.demand||{})[GOOD_TASK[g]]||0)*0.02 + (civPrice(g) > CG[g].v*1.4 ? 2 : 0) + (CG[g].cat==='food' ? n/60 : n/150); }
  if (B.svc) d += (CIV_SVC_DEMAND[B.svc] ? CIV_SVC_DEMAND[B.svc]() : n/80);
  if (B.retail) d += n/70; if (B.mine) d += S.civ.deposits.filter(x=>x.known && !x.mine && !x.claim).length*1.5; if (B.land) d += (S.civ.problems.food||0)*0.1 + n/90; if (B.contractor) d += civProjects().length*0.4;
  return d;
}
const CIV_SVC_DEMAND = {
  care: () => S.citizens.filter(c=>c.sick||c.civ.hurt).length*1.2, drink: () => S.citizens.filter(c=>isAdult(c) && c.wallet>30).length/12, meal: () => S.citizens.filter(c=>isAdult(c) && c.wallet>40).length/14,
  lodging: () => Object.values(S.civ.hh).filter(h=>!h.home).length*1.5 + (S.civ.migration.in||0)*0.2, legal: () => (S.civ.justice.cases||[]).filter(k=>k.status==='open').length*1.5, accounts: () => civOrgs().length*0.4,
  realty: () => civStructsOf(s=>s.forSale).length*0.8, insurance: () => civOrgs().length*0.2, invest: () => S.citizens.filter(c=>c.wallet>300).length*0.3, ads: () => civOrgs(o=>o.biz && BUSINESS_TYPES[o.biz].industry==='retail').length*0.6,
  consulting: () => civOrgs().length*0.15, news: () => S.citizens.filter(c=>kn(c,'literacy')>30).length/10, haulage: () => S.civ.econ.wkTrades/30, show: () => S.citizens.filter(c=>c.wallet>80).length/15,
  dental: () => S.citizens.length/90, vet: () => S.civ.animals.length/12, jewelry: () => S.citizens.filter(c=>c.wallet>400).length/6
};
// the multi-step plan: learn → experience → save → tools → property → finance → premises → inputs → sell → hire
const BIZ_STEPS = ['learn','experience','save','tools','property','finance','premises','inputs','sell','hire'];
function civBusinessDaily(){
  if (!civMoneyOn()) return;
  const d = civDay();
  S.citizens.forEach(c=>{
    if (!isAdult(c) || c.age>68) return;
    let g = civGoal(c,'start_business');
    if (!g){
      if ((d + hash(c.id)%7) % 7) return;
      const drive = c.civ.cog.planning*0.4 + c.personality.openness*0.2 + (c.traits.includes('Ambitious')?0.25:0) + (civHasGoal(c,'wealth')?0.2:0) + (civHasGoal(c,'organization')?0.25:0) + cog(c,'risk')*0.2 - (c.civ.job?0.15:0);
      if (drive < 0.55 || rnd() > 0.35) return;
      const best = civOpportunities(c)[0]; if (!best || best.score < 2.2) return;
      g = civAddGoal(c, 'start_business', {biz:best.id, task: civBizTask(best.id)}, BIZ_STEPS);
      remember(c, `I think the settlement needs ${an(BUSINESS_TYPES[best.id].label.toLowerCase())}, and I could run it.`, 7, [], 'Decision');
      civDecision(c, 'found:'+best.id, {exp:best.score, obj:'start a business', sit:`demand ${best.dem.toFixed(1)}, ${best.comp} competitors`, major:true});
    }
    civBusinessStep(c, g);
  });
}
function civBizTask(biz){ const B = BUSINESS_TYPES[biz]; if (!B) return null; if (B.land) return 'farm'; if (B.mine) return 'mine'; if (B.contractor) return 'build'; if (B.wild==='tree') return 'chop'; if (B.svc==='care') return 'heal'; const sk0 = Object.keys(B.skills||{})[0]; return Object.keys(ACTIVITIES).find(t=>ACTIVITIES[t].skill===sk0) || 'craft'; }
function civBusinessStep(c, g){
  const B = BUSINESS_TYPES[g.data.biz]; if (!B){ civEndGoal(c, g, 'dropped'); return; }
  const step = g.steps.find(s=>!s.done); if (!step){ civEndGoal(c, g, 'done'); return; }
  const need = Object.entries(B.skills||{});
  switch (step.k){
    case 'learn': if (need.every(([k,v])=>sk(c,k) >= v*0.8)) step.done = true; else if (!civHasGoal(c,'learn_skill')) civAddGoal(c, 'learn_skill', {skill:need[0][0], task:g.data.task}); break;
    case 'experience': if ((c.civ.exp[g.data.task]||{n:0}).n >= 2 || B.retail || B.svc) step.done = true; break;
    case 'save': if (c.wallet >= B.start*0.6) step.done = true; else if (civDay()-g.made > 40){ step.done = true; g.data.borrow = true; } break;
    case 'tools': { const h = hhOf(c); if (!B.equip || B.equip.every(e=>(h && h.store[e]>0) || civBuy(c, e, 1))) step.done = true; break; }
    case 'property': { const own = civStructsOf(s=>civOwnedBy(s.owner, c) && B.bld.includes(s.def) && !s.org); if (own.length){ g.data.site = own[0].id; step.done = true; }
      else if (B.bld.includes('workshop') || B.bld.includes('shop') || B.bld.some(b=>STRUCTURES[b] && STRUCTURES[b].biz)){ step.done = true; g.data.build = B.bld.find(b=>STRUCTURES[b] && civCanBuild(b, [c])) || null; if (!g.data.build) { const vac = civStructsOf(s=>s.forSale && B.bld.includes(s.def))[0]; if (vac){ g.data.lease = vac.id; } else { civEndGoal(c, g, 'dropped', `Nobody here can build ${an(STRUCTURES[B.bld[0]].label.toLowerCase())} yet.`); } } }
      else step.done = true; break; }
    case 'finance': { const short = B.start - c.wallet; if (short <= 0){ step.done = true; break; } const loan = civSeekLoan(c, Math.ceil(short), 'business'); if (loan) step.done = true; else if (c.wallet >= B.start*0.5){ step.done = true; g.data.partner = true; } else if (civDay()-g.made > 70) civEndGoal(c, g, 'dropped', 'I could not raise the money to start my business.'); break; }
    case 'premises': {
      const o = civFoundBusiness(c, g); if (!o) { civEndGoal(c, g, 'dropped'); return; }
      g.data.org = o.id; step.done = true;
      if (g.data.site){ const s = S.civ.structs[g.data.site]; s.org = o.id; s.owner = {k:'org', id:o.id}; o.sites.push(s.id); o.hq = s.id; }
      else if (g.data.lease){ const s = S.civ.structs[g.data.lease]; if (s){ civContract('lease', [s.owner, {k:'org', id:o.id}], {struct:s.id, amount:Math.max(3, Math.round(s.value*0.008)), every:7}, 7); s.org = o.id; s.forSale = false; o.sites.push(s.id); o.hq = s.id; } }
      else if (g.data.build){ const site = civFindSite(g.data.build, civMarketCenter(), {margin:1}); if (site) civStartProject(g.data.build, site, {k:'org', id:o.id}, {purpose:'business', org:o.id, why:`for ${o.name}`}); }
      break; }
    case 'inputs': { const o = S.civ.orgs[g.data.org]; if (!o) { civEndGoal(c, g, 'dropped'); return; } if (!B.in) { step.done = true; break; } for (const gi in B.in) civOrgBuy(o, gi, Math.ceil(B.in[gi]*20)); step.done = true; break; }
    case 'sell': { const o = S.civ.orgs[g.data.org]; if (!o) { civEndGoal(c, g, 'dropped'); return; } if (o.revTotal > 0 || civDay()-g.made > 60) step.done = true; break; }
    case 'hire': { const o = S.civ.orgs[g.data.org]; if (o && (o.staff.length >= 2 || civDay()-g.made > 90)){ step.done = true; civEndGoal(c, g, 'done', `${o.name} is up and running.`); } break; }
  }
}
function civFoundBusiness(c, g){
  const B = BUSINESS_TYPES[g.data.biz];
  // a partner brings money when the founder cannot fund it alone
  let partners = [c];
  if (g.data.partner || c.wallet < B.start){ const p = S.citizens.filter(o=>o!==c && isAdult(o) && o.wallet >= B.start*0.5 && peekRel(o,c.id).affinity > 25 && peekRel(o,c.id).trust > 0.45).sort((a,b)=>peekRel(b,c.id).affinity-peekRel(a,c.id).affinity)[0]; if (p) partners.push(p); }
  const family = partners.length===1 && hhAdults(hhOf(c)).length>=2 && c.values.includes('Family');
  const type = partners.length>1 ? 'partnership' : family ? 'family' : 'sole';
  // the founder puts in what they can; a partner brings the rest of the capital, and shares follow what each put in
  const contrib = {}; partners.forEach((p,i)=>{ contrib[p.id] = Math.floor(i===0 ? Math.min(p.wallet*0.8, B.start) : Math.min(p.wallet*0.5, B.start*1.5)); });
  const total = Object.values(contrib).reduce((a,b)=>a+b,0) || 1;
  const shares = {}; partners.forEach(p=>shares[p.id] = contrib[p.id]/total);
  const name = civBizName(c, B, partners);
  const o = civNewOrg(type, name, partners, {biz:B.id, contrib, shares, authority: Object.fromEntries(partners.map((p,i)=>[p.id, i===0?'managing':'silent']))});
  partners.forEach(p=>civMoveMoney({k:'person', id:p.id}, civOrgPurse(o), contrib[p.id], 'capital'));
  if (type==='family') hhAdults(hhOf(c)).forEach(m=>{ if (!o.owners[m.id]) o.owners[m.id] = 0; });
  if (partners.length>1) civContract('partnership', partners.map(p=>({k:'person', id:p.id})), {org:o.id, shares, profit:'by share', debts:'joint'}, 0);
  o.staff.push(c.id); c.civ.employer = o.id; c.civ.job = civJobFor(o, c, B.label.replace(/ (shop|office|company|store)$/,'') + ' owner', 0).id;
  chronicle(`${partners.map(p=>p.name).join(' and ')} founded ${name}, ${an(ORG_TYPES[type].label.toLowerCase())}.`, 8, '🏪', 'business');
  S.week.society.push(`${name} founded`); ev('businesses');
  return o;
}
function civBizName(c, B, partners){ const sur = surnameOf(c), n = hash(c.id+B.id); if (partners.length>1) return `${sur} & ${surnameOf(partners[1])} ${B.label}`; const adj = ['Riverside','Old Oak','Golden','Northfield','Stonebridge','Meadow','Lantern','Copper'][n%8]; return n%2 ? `${sur}'s ${B.label}` : `${adj} ${B.label}`; }

// ---------- running businesses ----------
function civOrgBuy(o, g, q){ const E = S.civ.econ; let got = 0; for (const L of E.listings.filter(l=>l.g===g && l.q>=1 && !(l.seller.k==='org' && l.seller.id===o.id)).sort((a,b)=>a.price-b.price)){ if (got>=q) break; const n = Math.min(L.q, q-got, Math.floor(o.cash/L.price)); if (n<1) break; if (!civMoveMoney(civOrgPurse(o), civOwnerPurse(L.seller), L.price*n, 'sale')) break; L.q -= n; got += n; storeAdd(o.stock, g, n);
    const sid = L.seller.k+':'+L.seller.id; o.memory.suppliers[sid] = (o.memory.suppliers[sid]||0) + 1; }
  if (got<q){ o.memory.shortages = (o.memory.shortages||0)+1; E.unmet = E.unmet || {}; E.unmet[g] = (E.unmet[g]||0)+(q-got); }
  return got; }
function civOrgsHour(h){
  if (h!==18 || !civMoneyOn()) return;
  // end of the working day: sell what was made, pay the staff
  civOrgs(o=>o.biz).forEach(o=>{ const B = BUSINESS_TYPES[o.biz];
    for (const g in o.stock){ if (!CG[g] || g==='water') continue; const q = Math.floor(o.stock[g]); if (q>=1 && (!B.in || !B.in[g])){ storeTake(o.stock, g, q); civList(civOrgPurse(o), g, q, +(civPrice(g)*(0.9+o.quality*0.25)*(o.priceMod||1)).toFixed(2)); } } });
}
CIV_WORK.job = (c, b, hrs) => {
  const j = civJobOf(c); if (!j) return {value:0, why:'no job'};
  const o = S.civ.orgs[j.org]; if (!o || o.status!=='active') return {value:0, why:'the business is closed'};
  const B = BUSINESS_TYPES[o.biz] || {}, eff = hrs * (0.5 + civStaffScore(c, o)/200);
  let made = 0;
  if (B.in || B.out){ let k = eff; if (B.in) for (const g in B.in){ const need = B.in[g]*eff; const have = o.stock[g]||0; if (have < need){ civOrgBuy(o, g, Math.ceil(need-have)+2); } k = Math.min(k, (o.stock[g]||0)/B.in[g]); }
    if (B.in) for (const g in B.in) storeTake(o.stock, g, B.in[g]*k); if (B.out) for (const g in B.out){ storeAdd(o.stock, g, +(B.out[g]*k).toFixed(2)); made += B.out[g]*k*civPrice(g); } }
  if (B.svc){ o.svcCap = (o.svcCap||0) + eff*3; }
  if (B.retail) o.svcCap = (o.svcCap||0) + eff*2;
  o.memory.employees[c.id] = +((o.memory.employees[c.id]||0)*0.9 + eff*0.1).toFixed(2);
  return {value: j.wage*civMoneyVal(c)*1.2 + made*0.05, why:null};
};
function civJobOf(c){ const id = c.civ.job; if (!id) return null; const j = S.civ.jobs.find(x=>x.id===id); if (!j){ c.civ.job = null; return null; } const o = S.civ.orgs[j.org]; return Object.assign(j, {orgName: o ? o.name : '?'}); }
function civWorkplaceXY(c, j){
  const o = S.civ.orgs[j.org]; const B = o && BUSINESS_TYPES[o.biz];
  if (B && B.mine){ const m = civStructsOf(s=>s.org===o.id && STRUCTURES[s.def].mine)[0]; if (m){ const L = LOC[m.id]; return {loc:m.id, xy: L && L.door ? L.door : [m.x, m.y+m.h]}; } }
  if (B && B.land){ const f = civStructsOf(s=>s.org===o.id && (STRUCTURES[s.def].farm||STRUCTURES[s.def].ranch))[0]; if (f) return {loc:f.id, xy:[f.x+1+hash(c.id)%Math.max(1,f.w-2), f.y+1+hash(c.id+'y')%Math.max(1,f.h-2)]}; }
  if (B && B.contractor){ const p = civProjects().find(p=>p.contractor===o.id) || civProjects().find(p=>p.owner.k==='org' && p.owner.id===o.id); if (p) return {loc:'wild', xy:civSiteSpot(p)}; }
  const s = o && o.hq && S.civ.structs[o.hq]; if (s){ const L = LOC[s.id]; return {loc:s.id, xy: L && L.door ? L.door : [s.x, s.y+s.h]}; }
  return {loc:'loc_town_square', xy:null};
}
// the task an employee actually does: the company's mine, field, building site or workshop
function civJobTask(c, j){ const o = S.civ.orgs[j.org]; const B = o && BUSINESS_TYPES[o.biz]; if (!B) return 'job'; if (civProjects().some(p=>p.owner.k==='org' && p.owner.id===o.id && civProjectMatFrac(p)>0.3)) return 'build'; if (B.mine && civStructsOf(s=>s.org===o.id && STRUCTURES[s.def].mine).length) return 'mine'; if (B.land && civStructsOf(s=>s.org===o.id && STRUCTURES[s.def].farm).length) return 'farm'; if (B.land && civStructsOf(s=>s.org===o.id && STRUCTURES[s.def].ranch).length) return 'herd'; if (B.contractor && civProjects().some(p=>p.contractor===o.id || (p.owner.k==='org' && p.owner.id===o.id))) return 'build'; if (B.wild==='tree') return 'chop'; if (B.svc==='care') return 'heal'; return 'job'; }

// ---------- the labour market ----------
function civJobFor(o, c, role, wage){ const j = {id:'job_'+(++S.civ.jSeq), org:o.id, role, wage, skill: o.biz ? Object.keys(BUSINESS_TYPES[o.biz].skills||{})[0] : null, open:false, since:civDay(), filled:c.id}; S.civ.jobs.push(j); return j; }
function civPostJob(o, role, wage){ wage = Math.max(wage, 2*(S.civ.econ.level||1)); const B = BUSINESS_TYPES[o.biz] || {}; const j = {id:'job_'+(++S.civ.jSeq), org:o.id, role, wage:Math.round(wage*10)/10, skill:Object.keys(B.skills||{})[0]||null, know:B.know||null, open:true, since:civDay(), filled:null, schedule:'7:00–17:00'}; S.civ.jobs.push(j); ev('job_posts'); return j; }
function civLaborDaily(){
  if (!civMoneyOn()) return;
  const open = S.civ.jobs.filter(j=>j.open);
  open.forEach(j=>{
    const o = S.civ.orgs[j.org]; if (!o || o.status!=='active'){ j.open = false; return; }
    const wl = o.hq && S.civ.structs[o.hq];
    // applicants weigh pay, distance, the firm's reputation and conditions, and what they'd earn on their own
    const apps = S.citizens.filter(c=>isAdult(c) && c.age<66 && !c.civ.job && !(c.civ.goals||[]).some(g=>g.kind==='start_business' && g.status==='active')).map(c=>{
      const own = Math.max(0, ...Object.values(c.civ.exp).map(e=>e.v||0)) * 0.12, dist = wl ? Math.hypot(wl.x-c.rt.x, wl.y-c.rt.y)/20 : 0.5;
      const u = j.wage*civMoneyVal(c)*1.5 - own - dist + (o.reputation-0.5)*2 + (j.skill ? sk(c,j.skill)/80 : 0) + (c.wallet<15 ? 2 : 0) - (c.civ.occ && c.civ.tier>=1 ? 1.5 : 0);
      return {c, u}; }).filter(x=>x.u>0.4);
    if (!apps.length){ if (civDay()-j.since > 5){ j.wage = +(j.wage*1.08).toFixed(1); j.since = civDay(); ev('wage_rises'); } return; }
    // the employer picks: skill, knowledge, trust, record
    const pick = apps.map(x=>({c:x.c, s: (j.skill ? sk(x.c,j.skill) : 20) + (x.c.civ.credit.score-50)*0.2 + (o.mgr ? peekRel(alive(o.mgr)||x.c, x.c.id).trust*20 : 0) + (o.memory.employees[x.c.id]||0)*10})).sort((a,b)=>b.s-a.s)[0].c;
    civHire(o, j, pick);
  });
}
function civHire(o, j, c){
  j.open = false; j.filled = c.id; c.civ.job = j.id; c.civ.employer = o.id; o.staff.push(c.id);
  civContract('employment', [civOrgPurse(o), {k:'person', id:c.id}], {job:j.id, wage:j.wage, every:1}, 1);
  c.profession = j.role; chronicle(`${o.name} hired ${c.name} as ${an(j.role.toLowerCase())} at ${j.wage}¢ a day.`, 5, '🤝', 'work'); remember(c, `I took a job at ${o.name}.`, 7); ev('hires');
}
function civQuit(c, why){ const j = civJobOf(c); if (j){ j.filled = null; const o = S.civ.orgs[j.org]; if (o){ o.staff = o.staff.filter(x=>x!==c.id); if (o.status==='active' && why!=='fired' && j.wage>0) j.open = true, j.since = civDay(); else S.civ.jobs = S.civ.jobs.filter(x=>x!==j); } Object.values(S.civ.contracts).forEach(k=>{ if (k.kind==='employment' && k.terms.job===j.id) k.status = 'ended'; }); } c.civ.job = null; c.civ.employer = null; c.profession = c.civ.occ ? civOccTitle(c) : 'Settler'; if (why) remember(c, `I lost my job: ${why}.`, 6); }

// ---------- contracts: obligations that can be enforced ----------
function civContract(kind, parties, terms, every){ const C = S.civ, id = 'k_'+(++C.kSeq); const k = {id, kind, parties, terms, every:every||0, start:civDay(), next: every ? civDay()+every : null, status:'active', breaches:0, written: civTechKnown('writing')}; C.contracts[id] = k; ev('contracts'); ev('k_'+kind); return k; }
function civContractsDaily(){
  const d = civDay();
  Object.values(S.civ.contracts).forEach(k=>{
    if (k.status!=='active' || !k.every || k.next > d) return; k.next = d + k.every;
    const [a, b] = k.parties;
    if (k.kind==='employment'){ const pay = k.terms.wage; if (!civMoveMoney(a, b, pay, 'wages')){ k.breaches++; const w = alive(b.id); if (w && k.breaches>=3){ civCaseFile('civil', 'breach', b, a, `unpaid wages at ${S.civ.orgs[a.id] ? S.civ.orgs[a.id].name : 'work'}`, pay*k.breaches, k); k.status = 'breached'; civQuit(w, 'wages went unpaid'); } } else k.breaches = 0; return; }
    if (k.kind==='rent' || k.kind==='lease'){ const payer = k.parties[1].k==='hh' ? civOwnerPurse(k.parties[1]) : k.parties[1]; if (!civMoveMoney(payer, civOwnerPurse(a), k.terms.amount, 'rent')){ k.breaches++; if (k.breaches>=3){ k.status = 'breached'; civCaseFile('civil', 'landlord', a, k.parties[1], 'unpaid rent', k.terms.amount*k.breaches, k); civEvict(k); } } else k.breaches = 0; return; }
    if (k.kind==='loan') return civLoanPayment(k);
    if (k.kind==='supply'){ const from = S.civ.orgs[a.id], to = S.civ.orgs[b.id]; if (!from || !to){ k.status = 'ended'; return; } const q = Math.min(k.terms.q, from.stock[k.terms.g]||0); if (q < k.terms.q*0.5){ k.breaches++; to.memory.suppliers[a.k+':'+a.id] = (to.memory.suppliers[a.k+':'+a.id]||0) - 2; if (k.breaches>=3){ k.status = 'breached'; civCaseFile('civil', 'breach', b, a, `undelivered ${CG[k.terms.g].name.toLowerCase()}`, k.terms.price*k.terms.q, k); } return; } storeTake(from.stock, k.terms.g, q); storeAdd(to.stock, k.terms.g, q); civMoveMoney(b, a, k.terms.price*q, 'sale'); return; }
    if (k.kind==='sponsorship' || k.kind==='sports'){ if (!civMoveMoney(a, b, k.terms.amount, k.kind)) k.breaches++; if (k.terms.until && d>=k.terms.until) k.status = 'ended'; return; }
  });
}
function civEvict(k){ const s = S.civ.structs[k.terms.struct]; if (!s) return; const h = S.civ.hh[s.occ]; if (h){ h.home = null; hhMembers(h).forEach(m=>m.home = 'loc_town_square'); chronicle(`The ${h.name} household was evicted from ${s.name}.`, 6, '📦', 'land'); ev('evictions'); } s.occ = null; indexCitizens(); }

// ---------- credit: informal lending → moneylenders → credit organisations → banks ----------
function civSeekLoan(c, amt, purpose){
  const bank = civOrgs(o=>o.type==='bank'||o.type==='credit_union').sort((a,b)=>b.cash-a.cash)[0];
  if (bank && bank.cash > amt*1.5 && c.civ.credit.score >= 35){ const rate = civBankRate(bank, c); return civLoan({k:'org', id:bank.id}, {k:'person', id:c.id}, amt, rate, 8, purpose); }
  const lenders = S.citizens.filter(o=>o!==c && isAdult(o) && o.wallet > amt*1.4 && (peekRel(o,c.id).trust > 0.45 || o.civ.occ==='lender') && c.civ.credit.score > 25);
  const L = lenders.sort((a,b)=>(peekRel(b,c.id).trust + (b.civ.occ==='lender'?0.3:0)) - (peekRel(a,c.id).trust + (a.civ.occ==='lender'?0.3:0)))[0];
  if (!L) return null;
  const family = peekRel(L,c.id).tags.includes('Family'), rate = family ? 0 : L.civ.occ==='lender' ? 0.08 : 0.04;
  if (!family && L.personality.agreeableness < 0.35 && !L.traits.includes('Greedy')) return null;
  return civLoan({k:'person', id:L.id}, {k:'person', id:c.id}, amt, rate, 10, purpose);
}
function civLoan(lender, borrower, amt, rate, weeks, purpose){
  if (!civMoveMoney(lender, borrower, amt, 'loan')) return null;
  const total = Math.round(amt*(1+rate)), per = Math.ceil(total/weeks);
  const k = civContract('loan', [lender, borrower], {principal:amt, rate, weeks, per, left:total, purpose, mortgage: purpose==='home' ? true : false}, 7);
  const lp = lender.k==='person' && alive(lender.id), bp = borrower.k==='person' && alive(borrower.id);
  if (lp){ lp.civ.log.lend = (lp.civ.log.lend||0) + 3; lp.civ.lent = (lp.civ.lent||0)+1; if (bp) civCredit(lp, 'lend', bp); }
  chronicle(`${civOwnerLabel(lender)} lent ${civOwnerLabel(borrower)} ${amt}¢ for ${purpose} at ${Math.round(rate*100)}%.`, 4, '💰', 'finance'); ev('loans');
  if (S.civ.fin.stage < 1) civFinStage(1, 'People have started lending each other money.');
  return k;
}
function civLoanPayment(k){
  const [lender, borrower] = k.parties, t = k.terms, pay = Math.min(t.per, t.left);
  const bc = borrower.k==='person' ? alive(borrower.id) : null;
  if (civMoveMoney(borrower, lender, pay, 'loan')){ t.left -= pay; if (bc){ bc.civ.credit.repaid++; bc.civ.credit.score = Math.min(100, bc.civ.credit.score+1); } if (t.left<=0){ k.status = 'repaid'; if (bc) bc.civ.credit.score = Math.min(100, bc.civ.credit.score+4); } k.late = 0; return; }
  k.late = (k.late||0)+1; if (bc){ bc.civ.credit.late++; bc.civ.credit.score = Math.max(0, bc.civ.credit.score-4); if (!civHasGoal(bc,'repay_debt')) civAddGoal(bc, 'repay_debt', {k:k.id}); }
  if (k.late>=3){ k.status = 'defaulted'; if (bc){ bc.civ.credit.defaulted++; bc.civ.credit.score = Math.max(0, bc.civ.credit.score-20); }
    const L = lender.k==='org' && S.civ.orgs[lender.id]; if (L){ L.bad = (L.bad||0) + t.left; L.memory.investments.push({day:civDay(), kind:'bad loan', amt:t.left, to:civOwnerLabel(borrower)}); }
    civCaseFile('civil', 'debt', lender, borrower, `an unpaid loan of ${t.principal}¢`, t.left, k); civCheckInsolvent(borrower); }
}
function civBankRate(bank, c){ return +(0.05 + (100-c.civ.credit.score)/400 + (bank.bad||0)/Math.max(200,bank.cash)*0.05).toFixed(3); }
function civFinStage(n, text){ const F = S.civ.fin; if (F.stage >= n) return; F.stage = n; F.stageHist.push({stage:n, day:civDay()}); chronicle(text, 7, '🏦', 'finance'); S.week.society.push(`Finance: ${FIN_STAGES[n]}`); }
function civFinanceWeekly(){
  // people who keep lending are known for it
  S.citizens.filter(c=>isAdult(c) && (c.civ.lent||0) >= 3 && Object.values(S.civ.contracts).filter(k=>k.kind==='loan' && k.status==='active' && k.parties[0].id===c.id).length >= 2 && c.civ.occ!=='lender' && !c.civ.job).forEach(c=>{ c.civ.occ = 'lender'; c.civ.tier = 0; c.civ.occSince = civDay(); c.profession = 'Moneylender'; chronicle(`${c.name} has become known as a moneylender.`, 6, '💰', 'finance'); ev('occupations'); });
  const F = S.civ.fin, lenders = S.citizens.filter(c=>c.civ.occ==='lender');
  if (lenders.length) civFinStage(2, `${lenders[0].name} has become known as a moneylender.`);
  // a lender with many loans, some bookkeeping and enough capital sets up a bank; a close-knit group may form a credit union
  if (F.stage>=2 && !civOrgs(o=>o.type==='bank'||o.type==='credit_union').length){
    const f = S.citizens.filter(c=>isAdult(c) && (c.civ.lent||0) >= 4 && kn(c,'finance') >= 22 && c.wallet >= 300 && (civTechKnown('bookkeeping') || civTechKnown('writing'))).sort((a,b)=>b.wallet-a.wallet)[0];
    if (f){ const coop = f.values.includes('Community') && rnd()<0.5; const o = civNewOrg(coop ? 'credit_union' : 'bank', coop ? `${S.civ.stageLabel||'Settlement'} Credit Union` : `${surnameOf(f)} Bank`, [f], {meta:{reserve:0.2}});
      civMoveMoney({k:'person',id:f.id}, civOrgPurse(o), Math.floor(f.wallet*0.7), 'capital'); o.mgr = f.id; f.civ.employer = o.id; f.civ.job = civJobFor(o, f, 'Banker', 3).id; f.profession = 'Banker';
      civFinStage(coop ? 3 : 4, coop ? `${o.name} was founded: members pool their savings and lend to each other.` : `${f.name} opened ${o.name}. Savings can now earn interest, and loans come with paperwork.`);
      const site = civFindSite('bank', civMarketCenter(), {margin:1}); if (site && civCanBuild('bank', [f])) civStartProject('bank', site, {k:'org', id:o.id}, {org:o.id, why:'a proper bank building'}); } }
  if (F.stage===3 && civOrgs(o=>o.type==='bank').length) civFinStage(4, 'The settlement now has a proper bank.');
  // banks take deposits, pay interest, lend, and can fail
  civOrgs(o=>o.type==='bank'||o.type==='credit_union').forEach(b=>{
    b.deposits = b.deposits || {};
    S.citizens.filter(c=>c.wallet > 150 && (peekRel(c, b.mgr).trust > 0.4 || c.personality.conscientiousness>0.6)).forEach(c=>{ const put = Math.floor((c.wallet-100)*0.4); if (put>10 && civMoveMoney({k:'person',id:c.id}, civOrgPurse(b), put, 'deposit')){ b.deposits[c.id] = (b.deposits[c.id]||0) + put; ev('deposits', put); } });
    const owed = Object.values(b.deposits).reduce((a,x)=>a+x,0);
    Object.keys(b.deposits).forEach(id=>{ const intr = +(b.deposits[id]*0.004).toFixed(2); if (intr>0 && b.cash > owed*0.1) { b.cash -= intr; b.deposits[id] += intr; } });
    // too many bad loans and savers start to worry; a run empties the vault
    const loansOut = Object.values(S.civ.contracts).filter(k=>k.kind==='loan' && k.status==='active' && k.parties[0].k==='org' && k.parties[0].id===b.id).reduce((a,k)=>a+k.terms.left,0);
    const equity = b.cash + loansOut - owed; b.meta.equity = Math.round(equity);
    if ((b.bad||0) > 0 && equity < 0 && owed > 0){ const want = owed*0.6; if (b.cash < want){ civBankFail(b, owed); } }
  });
  if (civOrgs(o=>o.type==='bank').length >= 2 || civOrgs(o=>o.type==='exchange').length) civFinStage(5, 'Several banks and an exchange now move the settlement\'s money: it has real financial institutions.');
}
function civBankFail(b, owed){
  const pay = Math.max(0, b.cash), frac = owed ? pay/owed : 0;
  Object.entries(b.deposits).forEach(([id, amt])=>{ const c = alive(id); if (c){ c.wallet += Math.floor(amt*frac); remember(c, `${b.name} failed. I lost ${Math.round(amt*(1-frac))}¢ of my savings.`, 9); setEmotion(c, 'Anxious', DAY*2); } });
  b.cash = 0; b.deposits = {}; chronicle(`Run on ${b.name}! Too many bad loans: depositors got back only ${Math.round(frac*100)}% of their savings and the bank has failed.`, 9, '🏦', 'finance');
  civOrgDissolve(b, 'bankrupt'); civProblem('finance', 5); ev('bank_failures');
}

// ---------- insolvency and bankruptcy ----------
function civDebts(p){ return Object.values(S.civ.contracts).filter(k=>k.kind==='loan' && (k.status==='active' || k.status==='defaulted') && k.parties[1].k===p.k && k.parties[1].id===p.id).reduce((a,k)=>a+k.terms.left,0); }
function civAssets(p){ let v = civPurse(p); civStructsOf(s=>s.owner.k===p.k && s.owner.id===p.id).forEach(s=>v += s.value*0.7); if (p.k==='org'){ const o = S.civ.orgs[p.id]; if (o) for (const g in o.stock) v += o.stock[g]*civPrice(g)*0.5; } return v; }
function civCheckInsolvent(p){
  const debts = civDebts(p); if (debts <= 0) return false;
  if (civAssets(p) >= debts*0.8 && civPurse(p) > 0) return false;
  if (S.civ.justice.stage >= 6) civCaseFile('civil', 'bankruptcy', p, null, `insolvency of ${civOwnerLabel(p)}`, debts);
  else civBankrupt(p, 'informal');
  return true;
}
// liquidation pays creditors pro rata; a viable debtor may get its loans restructured instead
function civBankrupt(p, how){
  const loans = Object.values(S.civ.contracts).filter(k=>k.kind==='loan' && (k.status==='active'||k.status==='defaulted') && k.parties[1].k===p.k && k.parties[1].id===p.id);
  const debts = loans.reduce((a,k)=>a+k.terms.left,0), o = p.k==='org' ? S.civ.orgs[p.id] : null;
  const viable = o && o.profitAvg > 0;
  if (viable && how!=='informal'){ loans.forEach(k=>{ k.status = 'active'; k.late = 0; k.terms.per = Math.ceil(k.terms.left/Math.max(4, k.terms.weeks*2)); k.terms.rate = k.terms.rate*0.5; });
    chronicle(`${civOwnerLabel(p)}'s debts were restructured: longer terms, lower interest, and the business keeps running.`, 7, '⚖️', 'finance'); ev('restructurings'); return 'restructured'; }
  let pot = Math.max(0, civPurse(p)); civAdjPurse(p, -pot);
  civStructsOf(s=>s.owner.k===p.k && s.owner.id===p.id && !STRUCTURES[s.def].home).forEach(s=>{ pot += s.value*0.6; s.owner = {k:'community'}; s.forSale = civMoneyOn(); s.price = Math.round(s.value*0.7); s.org = null; });
  if (o) for (const g in o.stock){ pot += (o.stock[g]||0)*civPrice(g)*0.4; } if (o) o.stock = {};
  const frac = debts ? Math.min(1, pot/debts) : 1;
  loans.forEach(k=>{ civAdjPurse(k.parties[0], Math.floor(k.terms.left*frac)); k.status = 'discharged'; });
  if (o) civOrgDissolve(o, 'bankrupt'); else { const c = alive(p.id); if (c){ c.civ.credit.score = Math.max(0, c.civ.credit.score-30); chronicle(`${c.name} went bankrupt; creditors recovered ${Math.round(frac*100)}% of what they were owed.`, 7, '📉', 'finance'); ev('bankruptcies'); } }
  return 'liquidated';
}

// ---------- corporations, shares and the exchange ----------
function civIncorporate(o){
  if (o.type==='corporation' || !o.biz) return;
  const was = ORG_TYPES[o.type].label; o.type = 'corporation'; o.shares = 1000; const own = {}; for (const id in o.owners) own[id] = Math.round(o.owners[id]*1000); o.owners = own;
  o.board = Object.keys(own).sort((a,b)=>own[b]-own[a]).slice(0,3); civSharePrice(o);
  chronicle(`${o.name} incorporated (it was ${an(was.toLowerCase())}): it now has shares, a board and can raise money from investors.`, 8, '📜', 'business'); ev('incorporations');
}
function civBook(o){ let v = o.cash - civDebts(civOrgPurse(o)); civStructsOf(s=>s.owner.k==='org' && s.owner.id===o.id).forEach(s=>v += s.value); for (const g in o.stock) v += (o.stock[g]||0)*civPrice(g); return Math.max(0, v); }
// share prices follow the business: assets and earnings, nudged by what investors are doing
function civSharePrice(o){ const fund = (civBook(o)*0.6 + Math.max(0, o.profitAvg)*52*0.5)/o.shares; o.sharePrice = +Math.max(0.01, (o.sharePrice ? o.sharePrice*0.6 + fund*0.4 : fund)*(1 + (o.sentiment||0))).toFixed(3); o.sentiment = (o.sentiment||0)*0.5; o.priceHist = (o.priceHist||[]).concat(o.sharePrice).slice(-26); return o.sharePrice; }
function civSellShares(o, seller, buyer, n){ const price = o.sharePrice*n; if (!civMoveMoney({k:'person', id:buyer.id}, seller ? {k:'person', id:seller.id} : civOrgPurse(o), price, 'shares')) return false; if (seller){ o.owners[seller.id] -= n; if (o.owners[seller.id] <= 0) delete o.owners[seller.id]; } else o.shares += n; o.owners[buyer.id] = (o.owners[buyer.id]||0) + n; ev('share_trades'); return true; }
function civStockWeekly(){
  const corps = civOrgs(o=>o.type==='corporation'||o.type==='public_corp');
  corps.forEach(civSharePrice);
  // an exchange appears once there are enough companies and someone who knows finance wants to run it
  if (!S.civ.exchange && corps.length >= 3){ const f = S.citizens.filter(c=>isAdult(c) && kn(c,'finance')>=35 && c.wallet>200).sort((a,b)=>kn(b,'finance')-kn(a,'finance'))[0];
    if (f){ const x = civNewOrg('exchange', `${S.civ.stageLabel||'Settlement'} Stock Exchange`, [f]); S.civ.exchange = x.id; corps.forEach(o=>{ o.type = 'public_corp'; o.listed = true; }); chronicle(`${f.name} founded the ${x.name}. Shares in ${corps.length} companies can now be bought and sold openly.`, 9, '📈', 'finance'); ev('exchanges');
      const site = civFindSite('exchange_hall', civMarketCenter(), {margin:1}); if (site && civCanBuild('exchange_hall',[f])) civStartProject('exchange_hall', site, {k:'org', id:x.id}, {org:x.id}); } }
  if (!S.civ.exchange) return;
  const listed = civOrgs(o=>o.listed);
  // investors act on their styles: conservative, growth, value, speculation, and some trade on what they should not know
  S.citizens.filter(c=>isAdult(c) && c.wallet > 120).forEach(c=>{
    const style = c.civ.style, insider = listed.find(o=>(o.staff.includes(c.id) || o.board.includes(c.id)) && !c.traits.includes('Honest') && c.personality.conscientiousness < 0.5);
    let pick = null, sell = null;
    if (insider){ const trend = (insider.revWk||0) - (insider.expWk||0); if (trend > insider.profitAvg*1.2) pick = insider; else if (trend < 0 && insider.owners[c.id]) sell = insider; if (pick||sell){ civInsiderTrade(c, pick||sell, !!pick); } }
    if (!pick && !sell){
      if (style==='conservative') pick = listed.filter(o=>o.divs>0).sort((a,b)=>b.divs/b.sharePrice - a.divs/a.sharePrice)[0];
      else if (style==='growth') pick = listed.slice().sort((a,b)=>(b.profitAvg-(b.prevProfit||0)) - (a.profitAvg-(a.prevProfit||0)))[0];
      else if (style==='value') pick = listed.find(o=>o.sharePrice < civBook(o)/o.shares*0.8);
      else if (style==='speculator'){ const mom = listed.map(o=>[o, (o.priceHist||[]).length>2 ? o.sharePrice - o.priceHist[o.priceHist.length-3] : 0]).sort((a,b)=>b[1]-a[1]); pick = mom[0] && mom[0][1]>0 ? mom[0][0] : null; sell = mom.length && mom[mom.length-1][1]<0 ? mom[mom.length-1][0] : null; }
    }
    if (pick && rnd()<0.4){ const holders = Object.keys(pick.owners).map(cById).filter(x=>x && x!==c && x.wallet < 60); const n = Math.max(1, Math.floor(c.wallet*0.15/Math.max(0.05,pick.sharePrice))); const seller = holders[0] || null; if (seller && pick.owners[seller.id] >= n) civSellShares(pick, seller, c, n); else if (!seller && pick.cash < 500) civSellShares(pick, null, c, n); pick.sentiment = (pick.sentiment||0) + 0.02; }
    if (sell && sell.owners[c.id] && rnd()<0.4){ const n = Math.ceil(sell.owners[c.id]*0.5), buyer = S.citizens.find(x=>x!==c && x.wallet > n*sell.sharePrice*1.2 && x.civ.style==='value'); if (buyer) civSellShares(sell, c, buyer, n); sell.sentiment = (sell.sentiment||0) - 0.03; }
  });
}
function civInsiderTrade(c, o, buy){
  ev('insider_trades'); c.civ.insider = (c.civ.insider||0)+1;
  S.civ.insiderLog = (S.civ.insiderLog||[]).concat({who:c.id, org:o.id, day:civDay(), buy}).slice(-30);
  if (S.civ.gov.laws.insider_trading && S.civ.justice.stage >= 4 && rnd() < 0.15 + S.civ.justice.stage*0.03) civCaseFile('criminal', 'insider trading', {k:'gov'}, {k:'person', id:c.id}, `trading ${o.name} shares on inside knowledge`, 0);
}

// ---------- weekly business decisions, and learning from their own history ----------
function civOrgsWeekly(){
  civOrgs(o=>o.biz).forEach(o=>{
    const B = BUSINESS_TYPES[o.biz], profit = (o.revWk||0) - (o.expWk||0);
    o.prevProfit = o.profitAvg; o.profitAvg = +(o.profitAvg*0.7 + profit*0.3).toFixed(2); o.revTotal = (o.revTotal||0) + (o.revWk||0);
    o.hist.push({day:civDay(), rev:Math.round(o.revWk||0), exp:Math.round(o.expWk||0), staff:o.staff.length, cash:Math.round(o.cash)}); if (o.hist.length>26) o.hist.shift();
    o.revWk = 0; o.expWk = 0;
    // memory: which products sold, which locations work, which expansions failed
    const hq = o.hq && S.civ.structs[o.hq]; if (hq) o.memory.locations[hq.id] = +((o.memory.locations[hq.id]||0)*0.8 + profit*0.2).toFixed(1);
    if (B.out) for (const g in B.out) o.memory.products[g] = +((o.memory.products[g]||0)*0.8 + (profit>0?1:-1)*0.2).toFixed(2);
    // dividends and retained earnings
    if (profit > 0 && (o.type==='corporation'||o.type==='public_corp')){ const div = profit*0.35; o.divs = +(div/o.shares).toFixed(4); Object.entries(o.owners).forEach(([id,n])=>{ civMoveMoney(civOrgPurse(o), {k:'person', id}, div*n/o.shares, 'dividend'); }); o.retained += profit - div; }
    else if (profit > 0 && ['partnership','family','sole'].includes(o.type)){ const take = profit*0.5; Object.entries(o.owners).forEach(([id,sh])=>civMoveMoney(civOrgPurse(o), {k:'person', id}, take*sh, 'profit share')); }
    // hiring when demand outstrips staff; layoffs when losing money
    const openJobs = S.civ.jobs.filter(j=>j.org===o.id && j.open).length, cap = B.workers ? B.workers[1] : 4;
    const demand = civBizDemand(B), growing = o.profitAvg > 2 || (o.svcCap||0) < demand*2;
    const avgW = civAvgWage();
    if (growing && o.staff.length + openJobs < cap && o.cash > avgW*10 && openJobs===0) civPostJob(o, civRoleName(o), +(avgW*(o.memory.lessons.includes('pay more')?1.15:1)).toFixed(1));
    if (o.profitAvg < -3 && o.staff.length > 1 && o.cash < avgW*5){ const worst = o.staff.map(cById).filter(x=>x && x.id!==o.mgr).sort((a,b)=>civStaffScore(a,o)-civStaffScore(b,o))[0]; if (worst){ civQuit(worst, 'fired'); chronicle(`${o.name} let ${worst.name} go.`, 4, '📉', 'business'); o.memory.lessons.push('cut costs'); } }
    // competition: prices, quality, advertising
    const rivals = civOrgs(x=>x!==o && x.biz===o.biz);
    if (rivals.length){ const best = rivals.sort((a,b)=>b.profitAvg-a.profitAvg)[0]; if (best.profitAvg > o.profitAvg + 2){ o.priceMod = Math.max(0.7, (o.priceMod||1) - 0.05); if (o.cash > 60){ o.quality = Math.min(1, o.quality + 0.05); o.cash -= 20; } }
      const ad = civOrgs(x=>x.biz==='advertising')[0]; if (ad && o.cash > 80 && rnd()<0.3){ civMoveMoney(civOrgPurse(o), civOrgPurse(ad), 20, 'ads'); o.reputation = Math.min(1, o.reputation+0.05); }
      // buying out a failing competitor, or merging
      const weak = rivals.find(x=>x.cash < 10 && x.profitAvg < 0); if (weak && o.cash > civBook(weak)*1.2 + 50 && rnd()<0.4) civAcquire(o, weak, 'merger');
    }
    // vertical integration: a firm short of its inputs buys a supplier
    if ((o.memory.shortages||0) > 6 && B.in){ const g = Object.keys(B.in)[0]; const sup = civOrgs(x=>x!==o && x.biz && BUSINESS_TYPES[x.biz].out && BUSINESS_TYPES[x.biz].out[g]); if (sup.length && o.cash > civBook(sup[0])*1.3){ civAcquire(o, sup[0], 'vertical'); } else if (sup.length && !Object.values(S.civ.contracts).some(k=>k.kind==='supply' && k.parties[1].id===o.id)){ civContract('supply', [civOrgPurse(sup[0]), civOrgPurse(o)], {g, q:Math.ceil(B.in[g]*20), price:civPrice(g)}, 7); } o.memory.shortages = 0; }
    // expansion: a second site where the first one pays
    if (o.profitAvg > 8 && o.cash > (B.start||100)*1.5 && o.sites.length < 3 && !o.memory.expansions.some(e=>e.failed && civDay()-e.day<120)){ const bdef = (B.bld||[]).find(b=>STRUCTURES[b] && !STRUCTURES[b].tile && civCanBuild(b, o.staff.map(alive).filter(Boolean))); if (bdef){ const site = civFindSite(bdef, civMarketCenter(), {margin:1}); if (site){ civStartProject(bdef, site, {k:'org', id:o.id}, {org:o.id, why:`${o.name} is expanding`}); o.memory.expansions.push({day:civDay(), site:bdef}); civMoveMoney(civOrgPurse(o), {k:'community'}, 0, 'x'); } } }
    // incorporation when a growing firm needs capital and its owners understand shares
    if (o.type!=='corporation' && o.type!=='public_corp' && o.profitAvg > 6 && Object.keys(o.owners).some(id=>kn(alive(id)||{civ:{know:{}}},'finance')>=25) && (civTechKnown('bookkeeping')||civTechKnown('writing'))) civIncorporate(o);
    // failure
    if (o.cash < -5 || (o.profitAvg < -5 && o.cash < 5 && civDay()-o.founded > 42)){ o.memory.lessons.push('failed'); if (!civCheckInsolvent(civOrgPurse(o)) && o.cash < 0) civOrgDissolve(o, 'bankrupt'); }
    else if (o.staff.length===0 && civDay()-o.founded > 60 && !o.mgr) civOrgDissolve(o, 'closed');
  });
}
function civAcquire(buyer, target, how){
  const price = Math.round(civBook(target)*1.1); if (!civMoveMoney(civOrgPurse(buyer), {k:'community'}, 0, 'x') && buyer.cash < price) return;
  Object.entries(target.owners).forEach(([id,sh])=>civMoveMoney(civOrgPurse(buyer), {k:'person', id}, price*(target.type==='corporation'||target.type==='public_corp' ? sh/target.shares : sh), 'acquisition'));
  target.sites.forEach(id=>{ const s = S.civ.structs[id]; if (s){ s.owner = {k:'org', id:buyer.id}; s.org = buyer.id; buyer.sites.push(id); } });
  target.staff.forEach(id=>{ const c = alive(id); if (c){ buyer.staff.push(id); c.civ.employer = buyer.id; const j = civJobOf(c); if (j) j.org = buyer.id; } });
  for (const g in target.stock) storeAdd(buyer.stock, g, target.stock[g]);
  target.status = 'merged'; target.ended = civDay(); target.into = buyer.id;
  chronicle(how==='vertical' ? `${buyer.name} bought its supplier ${target.name}.` : `${buyer.name} bought out its struggling rival ${target.name}.`, 7, '🤝', 'business'); ev(how==='vertical'?'integrations':'mergers');
}
function civRoleName(o){ const B = BUSINESS_TYPES[o.biz]; const map = {food:'Baker', agriculture:'Farmhand', forestry:'Lumberjack', crafts:'Craftsman', metal:'Smith', construction:'Builder', textiles:'Weaver', mining:'Miner', energy:'Driller', chemicals:'Chemist', retail:'Shop assistant', hospitality:'Server', health:'Nurse', professional:'Clerk', media:'Reporter', transport:'Carter', leisure:'Stagehand'}; return map[B.industry] || 'Worker'; }
function civAvgWage(){ const w = S.civ.jobs.filter(j=>j.filled && j.wage>0).map(j=>j.wage); return w.length ? w.reduce((a,b)=>a+b,0)/w.length : 3*(S.civ.econ.level||1); }

// ---------- services: customers choose by price, quality, reputation and distance ----------
function civServicesDaily(){
  civOrgs(o=>o.biz && BUSINESS_TYPES[o.biz].svc || BUSINESS_TYPES[o.biz||'x'] && BUSINESS_TYPES[o.biz].retail).forEach(o=>{
    const B = BUSINESS_TYPES[o.biz], dem = B.svc ? (CIV_SVC_DEMAND[B.svc] ? CIV_SVC_DEMAND[B.svc]() : 1) : S.citizens.length/40;
    const rivals = civOrgs(x=>x.biz===o.biz), share = (o.reputation*0.5 + o.quality*0.3 + (2-(o.priceMod||1))*0.2) / rivals.reduce((a,x)=>a + x.reputation*0.5 + x.quality*0.3 + (2-(x.priceMod||1))*0.2, 0);
    const served = Math.min(o.svcCap||0, dem*share); o.svcCap = 0; if (served < 0.5) return;
    const fee = (B.svc==='lodging' ? 6 : B.svc==='legal' ? 10 : B.svc==='care' ? 4 : B.retail ? 2 : 3) * (o.priceMod||1) * (S.civ.econ.level||1);
    const payers = S.citizens.filter(c=>isAdult(c) && c.wallet > fee*2).sort(()=>rnd()-0.5).slice(0, Math.round(served));
    payers.forEach(c=>{ if (civMoveMoney({k:'person', id:c.id}, civOrgPurse(o), fee, 'service')){ c.needs.fun = clamp(c.needs.fun+6,0,100); if (B.svc==='care' && (c.sick||c.civ.hurt)) c.civ.treated = 1; } });
    if (B.retail && payers.length) o.reputation = Math.min(1, o.reputation + 0.002*payers.length);
  });
}

// ---------- the daily, weekly and monthly economy ----------
// organisations buy what their building projects lack
function civOrgProjectsDaily(){ civProjects().filter(p=>p.owner.k==='org').forEach(p=>{ const o = S.civ.orgs[p.owner.id]; if (!o || o.status!=='active'){ return; } for (const g in p.need){ const miss = p.need[g] - (p.have[g]||0) - (o.stock[g]||0); if (miss>0 && civMoneyOn()) civOrgBuy(o, g, Math.ceil(miss)); } civDeliver(p, o.stock);
  const founder = o.founders.map(alive).find(Boolean), h = founder && hhOf(founder); if (h) civDeliver(p, h.store); }); }
function civEconDaily(){
  civMoneyCheck();
  civOrgProjectsDaily();
  civFieldsDaily(); civAnimalsDaily();
  civHHSellDaily();
  civBusinessDaily();
  civLaborDaily();
  civContractsDaily();
  civServicesDaily();
  civHelpTheHungry();
  S.citizens.forEach(c=>{ c.civ.wealth = Math.round(c.wallet + (hhOf(c) ? civHHWealth(hhOf(c))/Math.max(1,hhOf(c).members.length) : 0)); });
}
function civEconWeekly(){
  const E = S.civ.econ;
  civMarketStages(); E.barterWk0 = E.barter; E.wkTrades = 0; E.wkVol = 0;
  civOrgsWeekly(); civFinanceWeekly(); civStockWeekly(); civPropertyWeekly(); civBridgesWeekly();
  if (S.civ.demand) for (const k in S.civ.demand) S.civ.demand[k] = Math.floor(S.civ.demand[k]*0.6);
  // the price level follows the money supply against the goods it chases
  if (civMoneyOn()){ const m = civMoneySupply(), base = E.baseSupply || (E.baseSupply = Math.max(200, m)); E.level = +clamp(0.7 + 0.3*m/base, 0.5, 6).toFixed(3); }
  // informal loans to struggling households, when someone can spare it
  S.citizens.filter(c=>isAdult(c) && civMoneyOn() && c.wallet < 5 && hhOf(c) && hhFoodDays(hhOf(c)) < 1).slice(0,4).forEach(c=>civSeekLoan(c, 12, 'food'));
}
function civEconMonthly(){
  // industrial expansion happens in the organisations' weekly decisions; here, the month's record
  S.civ.econ.monthly = (S.civ.econ.monthly||[]).concat({day:civDay(), orgs:civOrgs().length, money:Math.round(civMoneySupply()), level:S.civ.econ.level||1}).slice(-24);
}
// the hungry are fed from the common stores when they have to be
function civHelpTheHungry(){
  const hungry = Object.values(S.civ.hh).filter(h=>hhFoodDays(h) < 0.3);
  if (!hungry.length) return;
  if (storeFood(S.civ.commons) < 40) civProblem('food', hungry.length);
}
function civTryRentOrBuy(h){
  const s = civStructsOf(x=>STRUCTURES[x.def].home && !x.occ && x.status==='active' && (x.forSale || x.owner.k!=='hh'))[0]; if (!s) return false;
  if (s.forSale && civHHMoney(h) >= s.price){ const payer = hhAdults(h).sort((a,b)=>b.wallet-a.wallet)[0]; civSellStruct(s, {k:'hh', id:h.id}, {k:'person', id:payer.id}); h.home = s.id; s.occ = h.id; hhMembers(h).forEach(m=>m.home = s.id); indexCitizens(); return true; }
  civLandlordOffer(s); return h.home===s.id;
}
function civOnStructBuiltEcon(s, p){ const o = s.org && S.civ.orgs[s.org]; if (o && !o.hq && !STRUCTURES[s.def].tile) o.hq = s.id; }
