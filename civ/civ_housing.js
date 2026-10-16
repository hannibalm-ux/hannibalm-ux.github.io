/* =====================================================================
   Pixel Town — civilization mode: getting things built, and a roof for everyone
   Construction used to stall: people with jobs never built, construction
   companies never got a client, a missing plank could hold up a house for a
   year, and empty homes rotted while families slept outside. Now:
   - households build their own home in the evenings and on rest days;
   - neighbours hold a building bee for families with no roof;
   - construction companies take on paid and stalled projects;
   - households with money buy the materials they lack at the market, and
     builders make do with what exists when nobody can supply something;
   - projects that stall for months are taken over by the settlement or given up;
   - property whose owner is gone, or that stands empty and unsold, returns to
     the settlement, which gives its homes rent-free to families in need.
   ===================================================================== */
// ---------- food comes first ----------
// before winter, and whenever stores are low, building gives way to food: no building bees, no public contracts,
// no spending on materials; and the treasury keeps enough to buy food in an emergency
function civBuildSeasonOK(){ const s = seasonOf(civDay()), fd = civFoodDaysAll(); return fd >= 3 && !((s===2 || s===3) && fd < 10); }
function civTreasuryReserve(){ return S.citizens.length * 2 * (S.civ.econ.level||1); }
// ---------- what counts as progress ----------
function civProjProgress(p){ p.lastProg = civDay(); }
function civHomelessHH(){ const C = S.civ; return Object.values(C.hh).filter(h=>h.members && h.members.length && (!h.home || !C.structs[h.home])); }
// a project is ready to work on when most materials are there
function civProjReady(p){ return civProjectMatFrac(p) >= 0.6 && p.done < p.labor; }
// the household's own project that could use an evening's work
function civOwnHomeProject(c){ const h = hhOf(c); if (!h || hhFoodDays(h) < 1.5) return null; return civProjects().filter(p=>(p.forHH===h.id || (p.owner.k==='hh' && p.owner.id===h.id)) && civProjReady(p)).sort((a,b)=>(b.purpose==='home')-(a.purpose==='home') || civProjectMatFrac(b)-civProjectMatFrac(a))[0] || null; }
// homes for families with no roof: anyone may lend a hand
function civNeedyHomeProjects(){ const hl = new Set(civHomelessHH().map(h=>h.id)); return civProjects().filter(p=>p.purpose==='home' && p.forHH && hl.has(p.forHH) && civProjectMatFrac(p) >= 0.4 && p.done < p.labor); }
function civWillHelp(c, p){
  const h = S.civ.hh[p.forHH]; if (!h || hhOf(c)===h) return 0; if (!civBuildSeasonOK() || (hhOf(c) && hhFoodDays(hhOf(c)) < 5)) return 0; // only when food is secure can people spare a day
  const kin = hhMembers(h).some(m=>peekRel(c, m.id).tags.includes('Family')), friend = hhMembers(h).some(m=>peekRel(c, m.id).affinity > 30);
  return (kin ? 8 : 0) + (friend ? 4 : 0) + (civCivic(c) ? 5 : 0) + c.personality.agreeableness*3 + (hhMembers(h).some(m=>!isAdult(m)) ? 2 : 0);
}

// ---------- materials: buy what is missing, make do with what exists ----------
const CIV_SUBST = {lumber:[['wood',1.5]], metal:[['wood',2]], steel:[['wood',2],['stone',1]], brick:[['stone',1.2]], glass:[['fiber',1]], cement:[['clay',1.5]], rope:[['fiber',2]]};
function civSourceable(g, miss){
  if (GOOD_TASK[g]) return true;                                  // anyone can gather it, given time
  const C = S.civ, stock = Object.values(C.hh).reduce((a,h)=>a+(h.store[g]||0),0) + (C.commons[g]||0) + Object.values(C.orgs).reduce((a,o)=>a+((o.stock||{})[g]||0),0) + (C.econ.listings||[]).filter(l=>l.g===g).reduce((a,l)=>a+l.q,0);
  if (stock >= miss*0.5) return true;
  return Object.values(C.orgs).some(o=>o.status==='active' && BUSINESS_TYPES[o.biz] && BUSINESS_TYPES[o.biz].out && BUSINESS_TYPES[o.biz].out[g]); // someone makes it
}
function civMaterialsDaily(){
  const C = S.civ, d = civDay();
  civProjects().forEach(p=>{
    p.lastProg = p.lastProg ?? p.started; p.wait = p.wait || {};
    const firm = p.contractor && C.orgs[p.contractor]; if (firm && firm.stock && civDeliver(p, firm.stock) > 0) civProjProgress(p); // the builders bring their own timber
    for (const g in p.need){
      const miss = p.need[g] - (p.have[g]||0); if (miss <= 0.01){ delete p.wait[g]; continue; }
      p.wait[g] = p.wait[g] ?? d;
      // the owner's household buys it if there is a market and they have the means
      if (civMoneyOn() && (p.owner.k==='hh' || p.owner.k==='person') && d - p.wait[g] >= 3){
        const h = p.owner.k==='hh' ? C.hh[p.owner.id] : hhOf(alive(p.owner.id)), buyer = h && hhAdults(h).sort((a,b)=>b.wallet-a.wallet)[0];
        if (buyer && buyer.wallet > civPrice(g)*2 && hhFoodDays(h) >= 4 && civFoodDaysAll() >= 2){ const got = civBuy(buyer, g, Math.ceil(miss), civPrice(g)*1.6); if (got > 0){ civDeliver(p, h.store); civProjProgress(p); } } }
      // public projects draw on the common store
      if ((p.owner.k==='community' || p.owner.k==='gov' || civNeedyHomeProjects().includes(p)) && (C.commons[g]||0) > 0){ const t = storeTake(C.commons, g, miss); if (t > 0){ p.have[g] = (p.have[g]||0) + t; civProjProgress(p); } }
      // nobody here can supply it: after two weeks the builders make do with something else
      if (d - p.wait[g] >= 14 && CIV_SUBST[g] && !civSourceable(g, miss)){
        const left = p.need[g] - (p.have[g]||0); p.need[g] = +(p.have[g]||0); if (p.need[g] <= 0) delete p.need[g];
        CIV_SUBST[g].forEach(([s, f])=>{ p.need[s] = Math.round((p.need[s]||0) + left*f); }); delete p.wait[g];
        chronicle(`With no ${CG[g] ? CG[g].name.toLowerCase() : g} to be had, the builders of the ${STRUCTURES[p.def].label.toLowerCase()} made do with ${CIV_SUBST[g].map(([s])=>CG[s].name.toLowerCase()).join(' and ')}.`, 3, '🪵', 'land'); ev('substitutions');
      }
    }
  });
}

// ---------- construction companies take on work ----------
function civBuildContractsDaily(){
  if (!civMoneyOn()) return;
  const C = S.civ, firms = civOrgs(o=>o.status==='active' && BUSINESS_TYPES[o.biz] && BUSINESS_TYPES[o.biz].contractor && (o.staff||[]).length);
  if (!firms.length) return;
  const d = civDay(), load = o => civProjects().filter(p=>p.contractor===o.id).length;
  // projects that need hands: public works, homes for the homeless, and anything whose owner can pay and has stalled
  const want = civProjects().filter(p=>!p.contractor && civProjectMatFrac(p) >= 0.5 && p.done < p.labor && (p.owner.k==='gov' || p.owner.k==='community' || civNeedyHomeProjects().includes(p) || d - (p.lastProg ?? p.started) >= 5))
    .sort((a,b)=>(b.purpose==='home')-(a.purpose==='home') || (a.lastProg??a.started)-(b.lastProg??b.started));
  want.forEach(p=>{
    const rate = +(1.2*(C.econ.level||1)).toFixed(2), payer = civContractPayer(p); if (!payer || civPurse(payer) < rate*8) return;
    const firm = firms.filter(o=>load(o) < Math.max(1, Math.ceil(o.staff.length/2))).sort((a,b)=>load(a)-load(b) || (b.reputation||0.5)-(a.reputation||0.5))[0]; if (!firm) return;
    p.contractor = firm.id; p.rate = rate; p.payer = payer;
    chronicle(`${firm.name} took on the ${STRUCTURES[p.def].label.toLowerCase()} for ${civOwnerLabel(p.owner)}${p.owner.k==='gov'||p.owner.k==='community'?' (paid by the settlement)':''}.`, 4, '🏗️', 'land'); ev('contracts_build');
  });
}
// who pays: the owner, the treasury for public works and for homes of families who cannot
function civContractPayer(p){ const pub = civBuildSeasonOK() && (S.civ.gov.treasury||0) > civTreasuryReserve() + 20;
  if (p.owner.k==='gov' || p.owner.k==='community') return pub ? {k:'gov'} : null;
  const own = civOwnerPurse(p.owner); if (own && civPurse(own) >= 10) return own;
  if (civNeedyHomeProjects().includes(p) && pub) return {k:'gov'}; return null; }
// an hour of a contractor's work is paid to the firm; if the money runs out, the contract ends
function civContractWork(p, c, hrs){
  if (!p.contractor || c.civ.employer!==p.contractor) return;
  const amt = +(p.rate*hrs).toFixed(2); if (amt <= 0) return;
  const payer = p.payer || civOwnerPurse(p.owner); if (payer.k==='gov' && ((S.civ.gov.treasury||0) - amt < civTreasuryReserve() || !civBuildSeasonOK())){ p.contractor = null; chronicle(`The settlement paused paid work on the ${STRUCTURES[p.def].label.toLowerCase()} to keep money for food.`, 3, '🏗️', 'land'); return; }
  if (!civMoveMoney(payer, {k:'org', id:p.contractor}, amt, 'construction')){ const o = S.civ.orgs[p.contractor]; chronicle(`${o?o.name:'The builders'} stopped work on the ${STRUCTURES[p.def].label.toLowerCase()}: the money ran out.`, 4, '🏗️', 'land'); p.contractor = null; }
}
function civContractorProject(c){ const id = c.civ.employer; if (!id) return null; return civProjects().filter(p=>p.contractor===id && p.done < p.labor).sort((a,b)=>civProjectMatFrac(b)-civProjectMatFrac(a))[0] || null; }

// ---------- stalled projects: the settlement takes them on, or they are given up ----------
function civStalledMonthly(){
  const C = S.civ, d = civDay(), town = civTownOwner();
  civProjects().forEach(p=>{
    const idle = d - (p.lastProg ?? p.started); if (idle < 45 || d - p.started < 60) return;
    const h = p.forHH && C.hh[p.forHH], needy = h && (!h.home || !C.structs[h.home]);
    if (needy && p.owner.k!=='community' && p.owner.k!=='gov'){ p.owner = town; p.lastProg = d; chronicle(`The settlement took over the unfinished ${STRUCTURES[p.def].label.toLowerCase()} for the ${h.name} household, who still have no roof.`, 5, '🤝', 'land'); ev('projects_taken_over'); return; }
    if (!needy && (p.upgradeOf || p.purpose!=='home' || !h)){ delete C.projects[p.id]; civReserve(p, false); const st = civOwnerStore(p.owner); if (st) for (const g in p.have) storeAdd(st, g, p.have[g]); chronicle(`Work on the ${STRUCTURES[p.def].label.toLowerCase()} for ${civOwnerLabel(p.owner)} was given up after months without progress.`, 4, '🚧', 'land'); ev('abandoned'); }
  });
}

// ---------- abandoned property returns to the settlement and shelters the needy ----------
function civTownOwner(){ return S.civ.gov.stage >= 4 ? {k:'gov'} : {k:'community'}; }
function civOwnerGone(o){
  if (!o) return true;
  if (o.k==='hh'){ const h = S.civ.hh[o.id]; return !h || !hhMembers(h).length; }
  if (o.k==='person') return !alive(o.id);
  if (o.k==='org'){ const g = S.civ.orgs[o.id]; return !g || ['closed','dissolved','bankrupt','merged'].includes(g.status); }
  return false;
}
function civReclaimDaily(){
  const C = S.civ, d = civDay(), town = civTownOwner();
  Object.values(C.structs).forEach(s=>{
    const D = STRUCTURES[s.def]; if (!D || D.bridge || D.tile==='BRIDGE' || D.tile==='DOCK') return;
    const empty = !civUsers(s).length && !(D.home && s.occ && C.hh[s.occ]);
    if (empty) s.emptySince = s.emptySince ?? d; else delete s.emptySince;
    if (s.owner.k==='community' || s.owner.k==='gov') return;
    const gone = civOwnerGone(s.owner), longEmpty = s.emptySince != null && d - s.emptySince >= 21 && (s.forSale || s.status==='abandoned' || D.home && !civMoneyOn());
    if (!gone && !longEmpty) return;
    // it passes to the settlement: an owner who is gone, or a place left empty and unwanted
    const was = civOwnerLabel(s.owner);
    s.owner = town; s.forSale = false; s.listed = null; s.price = null; const pc = C.parcels[s.id]; if (pc) pc.owner = town;
    if (s.status==='abandoned' && s.cond >= 8) s.status = 'active';
    if (s.rentK && C.contracts[s.rentK]) C.contracts[s.rentK].status = 'ended'; s.rentK = null;
    s.reclaimed = d; ev('reclaimed');
    chronicle(gone ? `${s.name} had no owner left (it belonged to ${was}), so it returned to the settlement.` : `${s.name} stood empty and unwanted, so it returned to the settlement.`, 4, '🏚️', 'land');
  });
  civShelterNeedy();
  civDenseHousingDaily();
}
// town-owned homes go rent-free to those with no roof: families with children first, then those without longest
function civShelterNeedy(){
  const C = S.civ, d = civDay();
  const needy = civHomelessHH().sort((a,b)=>hhMembers(b).filter(m=>!isAdult(m)).length - hhMembers(a).filter(m=>!isAdult(m)).length || (a.homelessSince??d) - (b.homelessSince??d));
  needy.forEach(h=>{ h.homelessSince = h.homelessSince ?? d; });
  if (!needy.length) return;
  // doubling up: a single person or a couple with no roof moves in with kin or friends who have room
  needy.filter(h=>h.members.length <= 2 && d - h.homelessSince >= 2).forEach(h=>{
    const people = hhMembers(h); if (!people.length) return;
    const hosts = Object.values(C.hh).filter(x=>x!==h && x.home && C.structs[x.home] && STRUCTURES[C.structs[x.home].def].home && S.citizens.filter(c=>c.home===x.home).length + people.length <= STRUCTURES[C.structs[x.home].def].home.cap)
      .map(x=>({x, w: Math.max(...hhMembers(x).flatMap(m=>people.map(p=>{ const r = peekRel(m, p.id); return (r.tags.includes('Family')?60:0) + r.affinity; })), -99) + (hhAdults(x).some(civCivic) ? 15 : 0)})).filter(o=>o.w >= 25).sort((a,b)=>b.w-a.w);
    const host = hosts[0] && hosts[0].x; if (!host) return;
    const home = C.structs[host.home]; people.forEach(p=>civJoinHH(p, host)); indexCitizens(); ev('taken_in');
    chronicle(`The ${host.name} household took in ${people.map(p=>p.name).join(' and ')}, who had no roof, at ${home.name}.`, 4, '🏠', 'family');
    people.filter(isAdult).forEach(p=>civHear(p, {type:'helped', text:`The ${host.name} household took me in when I had nowhere to live.`, topics:{poor:0.3}, imp:6, src:'self', emo:0.3}));
  });
  // town homes with room: an empty one, or a shelter that still has space (a longhouse can take several families)
  const living = s => S.citizens.filter(c=>c.home===s.id).length;
  const free = Object.values(C.structs).filter(s=>STRUCTURES[s.def].home && (s.owner.k==='community' || s.owner.k==='gov') && s.cond >= 8 && (s.shelter ? living(s) < STRUCTURES[s.def].home.cap : !(s.occ && C.hh[s.occ] && C.hh[s.occ].members.length) && !living(s)))
    .sort((a,b)=>STRUCTURES[b.def].home.cap - STRUCTURES[a.def].home.cap);
  free.forEach(s=>{ for (let k=0;k<4;k++){
    const cap = STRUCTURES[s.def].home.cap, room = cap - living(s), h = needy.find(x=>(!x.home || !C.structs[x.home]) && (living(s)===0 || x.members.length <= room)); if (!h) return;
    h.home = s.id; if (!s.occ || !C.hh[s.occ]) s.occ = h.id; s.status = 'active'; s.shelter = true; delete h.homelessSince; hhMembers(h).forEach(m=>{ m.home = s.id; if (isAdult(m)) civHear(m, {type:'sheltered', text:`The settlement gave us ${s.name} when we had no roof.`, topics:{relief:0.8, council:0.5, poor:0.4}, imp:7, src:'self', emo:0.4}); });
    if (s.cond < 40){ const give = Math.min(20, C.commons.wood||0); if (give){ storeTake(C.commons, 'wood', give); s.cond = Math.min(100, s.cond + give*2); } }
    indexCitizens(); ev('sheltered');
    chronicle(`The settlement gave ${s.name} to the ${h.name} household, who had no roof${hhMembers(h).some(m=>!isAdult(m))?' and young children':''}. They live there rent-free.`, 5, '🏠', 'land');
    if (S.week) S.week.society.push(`${h.name} household housed in ${s.name}`);
    if (STRUCTURES[s.def].home.cap - living(s) < 2) return; } });
}

// ---------- modern housing: terraces, boarding houses, apartment blocks and towers ----------
// A household only ever builds a house for itself, so dense housing needs someone building for others: a building firm or a
// wealthy investor who lets the flats, or the government building public housing. They build where there is real demand
// (families with no roof, crowding, people still in huts, land running out); families move in, and the huts they leave
// go to others or fall empty. Each new building technique raises the ceiling: boarding houses with sawn lumber, terraces with
// bricks, apartment blocks with multi-storey building, towers with steel frames.
const CIV_DENSE = ['tower','apartments','row_houses','boarding'];
const CIV_POOR_HOMES = ['lean_to','crude_hut','longhouse','wattle_hut'];
function civDenseLiving(s){ return S.citizens.filter(c=>c.home===s.id).length; }
function civDenseRoom(s){ return STRUCTURES[s.def].home.cap - civDenseLiving(s); }
function civDenseHousingDaily(){
  const C = S.civ, d = civDay();
  const dense = civStructsOf(s=>CIV_DENSE.includes(s.def) && s.status==='active' && s.cond >= 20); dense.forEach(s=>{ s.multi = true; });
  if (dense.length) civDenseTenancy(dense, d);
  if (d % 7 === 3) civDenseDevelop(d);
}
function civDenseDevelop(d){
  const C = S.civ, G = C.gov;
  const homeless = civHomelessHH().length, crowded = Object.values(C.hh).filter(h=>{ const s = h.home && C.structs[h.home]; return s && STRUCTURES[s.def].home && h.members.length > STRUCTURES[s.def].home.cap; }).length;
  const poor = Object.values(C.hh).filter(h=>{ const s = h.home && C.structs[h.home]; return s && CIV_POOR_HOMES.includes(s.def); }).length, short = C.landShort != null && d - C.landShort < 56;
  const demand = homeless*2 + crowded + (short ? 6 : 0) + Math.floor(poor/5) + Math.floor(S.citizens.length/150);
  const vacant = civStructsOf(s=>s.multi && s.status==='active').reduce((a,s)=>a + Math.max(0, civDenseRoom(s)), 0);
  const building = civProjects().filter(p=>CIV_DENSE.includes(p.def)).length;
  C.denseDemand = demand;
  if (demand < 4 || vacant >= 8 || building >= 1 + Math.floor(S.citizens.length/300)) return;
  const builders = S.citizens.filter(isAdult), def = CIV_DENSE.find(x=>civCanBuild(x, builders)); if (!def) return;
  const D = STRUCTURES[def], cost = Math.round(Object.entries(D.mat).reduce((a,[g,q])=>a + q*civPrice(g), 0) + D.labor*2*(C.econ.level||1));
  const firm = civMoneyOn() ? civOrgs(o=>o.biz && BUSINESS_TYPES[o.biz] && BUSINESS_TYPES[o.biz].contractor && o.cash > cost*0.4).sort((a,b)=>b.cash-a.cash)[0] : null;
  const rich = civMoneyOn() && !firm ? S.citizens.filter(c=>isAdult(c) && !c.jail && c.wallet > cost*0.6).sort((a,b)=>b.wallet-a.wallet)[0] : null;
  const publicOK = !firm && !rich && G.stage >= 3 && (!civMoneyOn() || (G.treasury||0) - cost*0.4 >= civTreasuryReserve()) && (homeless >= 2 || short);
  const owner = firm ? {k:'org', id:firm.id} : rich ? {k:'person', id:rich.id} : publicOK ? civTownOwner() : null; if (!owner) return;
  const site = civFindSite(def, civMarketCenter(), {margin:1, anySide:true}) || (typeof civFrontierSite==='function' ? civFrontierSite(def, {margin:1}) : null); if (!site){ C.landShort = d; return; }
  if (firm) firm.cash -= Math.round(cost*0.3); else if (rich) rich.wallet -= Math.round(cost*0.4); else if (civMoneyOn()) G.treasury -= Math.round(cost*0.4);
  const p = civStartProject(def, site, owner, {purpose:'home', meta:{dense:true}, pay: civMoneyOn() ? 3*(C.econ.level||1) : 0, fund: Math.round(cost*0.4), org: firm ? firm.id : null, why: firm ? `${firm.name} is building flats to let` : rich ? `${rich.name} is building flats to let` : 'public housing'});
  if (p && firm) p.contractor = firm.id;
  chronicle(`${firm ? firm.name : rich ? rich.name : 'The settlement'} began ${an(D.label.toLowerCase())} with room for ${D.home.cap} people: ${homeless ? homeless+' families have no roof' : short ? 'there is no land left for houses' : 'too many still live in huts'}.`, 7, '🏢', 'land'); ev('dense_started');
}
function civDenseTenancy(dense, d){
  const C = S.civ, money = civMoneyOn();
  // who wants a flat: families with no roof first, then crowded ones, then (weekly) those in huts who can pay
  const homeless = civHomelessHH(), crowded = Object.values(C.hh).filter(h=>{ const s = h.home && C.structs[h.home]; return s && !s.multi && STRUCTURES[s.def].home && h.members.length > STRUCTURES[s.def].home.cap; });
  const huts = d % 7 === 1 ? Object.values(C.hh).filter(h=>{ const s = h.home && C.structs[h.home]; return s && CIV_POOR_HOMES.includes(s.def) && (!money || civHHMoney(h) >= 30*(C.econ.level||1)); }) : [];
  const want = [...new Set(homeless.concat(crowded, huts))];
  for (const s of dense){ let room = civDenseRoom(s); if (room <= 0) continue;
    for (const h of want){ if (room <= 0) break; if (h.home===s.id || h.members.length > room) continue;
      const pub = s.owner.k==='gov' || s.owner.k==='community', rent = money ? Math.max(2, Math.round(s.value*0.004/Math.max(1, STRUCTURES[s.def].home.cap/5))) : 0;
      if (money && !pub && civHHMoney(h) < rent*4) continue; // a landlord wants a month's rent in hand
      const was = h.home && C.structs[h.home];
      if (money && rent && !(pub && !(civHHMoney(h) >= rent*4))){ civContract('rent', [s.owner, {k:'hh', id:h.id}], {struct:s.id, hh:h.id, amount:rent, every:7}, 7); }
      h.home = s.id; if (!s.occ || !C.hh[s.occ]) s.occ = h.id; delete h.homelessSince; hhMembers(h).forEach(m=>m.home = s.id); room -= h.members.length; want.splice(want.indexOf(h), 1);
      if (was && was.id !== s.id) civVacated(was, h);
      ev('dense_tenants'); if (hash(h.id+s.id)%3===0) chronicle(`The ${h.name} household moved into a flat in ${s.name}${was ? `, leaving their ${STRUCTURES[was.def].label.toLowerCase()}` : ''}.`, 4, '🏢', 'land');
    } }
  indexCitizens();
}
