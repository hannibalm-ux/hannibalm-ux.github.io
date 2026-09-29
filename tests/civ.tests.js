// Pixel Town — automated tests for the civilization mode (a new game).
// Every test starts from a fresh, seeded settlement (the runner loads pixel_town.html?seed=N),
// sets up the conditions it needs, lets the simulation's own systems act, and checks what emerged.
// Run with:  node tests/run_tests.js      (or CivTests.run('V10') in the console of a fresh ?seed= page)
(function(){
  const TESTS = [];
  const test = (id, name, fn, seed) => TESTS.push({id, name, fn, seed});
  const ok = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };
  const C = () => S.civ;
  const days = n => { for (let i=0;i<Math.round(n*DAY);i++) simTick(); };
  const adults = f => S.citizens.filter(c=>isAdult(c) && c.age>=18 && (!f || f(c)));
  const money = (amt) => { C().econ.money = 'beads'; CIV_GOODS.forEach(g=>{ if (!C().econ.prices[g.id]) C().econ.prices[g.id] = g.v; }); S.citizens.filter(isAdult).forEach(c=>c.wallet += amt||0); };
  const finish = p => { for (const g in p.need) p.have[g] = p.need[g]; p.done = p.labor; return civFinishProject(p); };
  const know = (c, techs, k) => { techs.forEach(t=>{ if (!knowsTech(c,t)) c.civ.techs.push(t); }); Object.assign(c.civ.know, k||{}); civTechRecount(); };
  const three = async () => { if (typeof THREE!=='undefined' && THREE && THREE.Mesh) return; const src = document.getElementById('three-src'); ok(src, 'three.js source not injected'); THREE = await import(URL.createObjectURL(new Blob([src.textContent], {type:'text/javascript'}))); };
  const otherHH = (c, n) => Object.values(C().hh).filter(h=>h.id!==c.civ.hh).slice(0, n).map(h=>hhAdults(h)[0]).filter(Boolean);

  // ============================ THE STARTING WORLD ============================
  test('V1', 'Exactly 100 people at the start', ()=>{ ok(PT.CIV, 'a new game did not start in civilization mode'); ok(S.citizens.length===100, `population is ${S.citizens.length}`); });
  test('V2', '80 adults and 20 children', ()=>{ const a = S.citizens.filter(isAdult).length, k = S.citizens.filter(c=>!isAdult(c)).length; ok(a===80 && k===20, `${a} adults, ${k} children`); ok(S.citizens.filter(c=>!isAdult(c)).every(c=>c.age<16), 'a "child" is 16 or older'); });
  test('V3', 'No starting professions or career goals', ()=>{
    const ad = S.citizens.filter(isAdult);
    ok(ad.every(c=>c.profession==='Settler' && !c.civ.occ && !c.work && !c.civ.job), 'an adult starts with a profession or job');
    ok(ad.every(c=>!c.civ.goals.some(g=>['start_business','learn_skill'].includes(g.kind))), 'someone starts with a career goal');
    // but they differ in knowledge, intelligence, skills, body, personality, values, family and possessions
    const spread = k => { const v = ad.map(c=>c.civ.cog[k]); return Math.max(...v) - Math.min(...v); };
    ok(COG.every(k=>spread(k) > 0.3), 'cognitive attributes barely differ');
    ok(ad.every(c=>COG.filter(k=>c.civ.cog[k] > 0.8).length < COG.length), 'someone is good at everything');
    ok(new Set(ad.map(c=>Object.keys(c.civ.know).sort().join())).size > 20, 'knowledge profiles are too similar');
    const wealth = Object.values(C().hh).map(h=>civHHWealth(h)); ok(Math.max(...wealth) > Math.min(...wealth)*3, 'possessions do not vary');
  });
  test('V4', 'No starting businesses or organisations', ()=>{ ok(Object.keys(C().orgs).length===0, 'there are organisations'); ok(C().jobs.length===0, 'there are jobs'); ok(Object.values(C().structs).every(s=>!STRUCTURES[s.def].biz), 'a business building exists'); ok(!C().econ.money && C().econ.stage<=1, 'money or a market exists'); });
  test('V5', 'No starting government or justice system', ()=>{ const G = C().gov; ok(G.stage===0 && !G.leader && !G.council.length && !Object.keys(G.laws).length && !G.taxes.rate && !Object.keys(G.offices).length, 'a government exists'); ok(C().justice.stage===0 && !C().justice.cases.length, 'a justice system exists'); ok(C().edu.stage<=1 && !Object.values(C().orgs).some(o=>o.type==='school'), 'a school exists'); });
  test('V6', 'No starting farms', ()=>{ ok(!Object.values(C().structs).some(s=>STRUCTURES[s.def].farm), 'a farm exists'); ok(!MAP.some(r=>r.includes(T.FIELD)), 'field tiles exist'); });
  test('V7', 'No starting ranches', ()=>{ ok(!Object.values(C().structs).some(s=>STRUCTURES[s.def].ranch), 'a ranch exists'); ok(!MAP.some(r=>r.includes(T.PASTURE) || r.includes(T.FENCE)), 'pasture exists'); ok(C().animals.length===0, 'animals are already kept'); });
  test('V8', 'No starting mine, and resources are hidden', ()=>{ ok(!Object.values(C().structs).some(s=>STRUCTURES[s.def].mine), 'a mine exists'); ok(C().deposits.length > 10, 'no hidden deposits'); ok(C().deposits.every(d=>!d.known && !d.claim), 'a deposit is already known'); ok(!BRIDGE_TILES.length && !MAP.some(r=>r.includes(T.BRIDGE)), 'a bridge exists'); ok(!MAP.some(r=>r.includes(T.PLAZA)), 'a town square exists'); });
  test('V9', 'Only basic, poor housing', ()=>{
    const s = Object.values(C().structs); ok(s.length>0 && s.every(x=>['lean_to','crude_hut','longhouse'].includes(x.def)), 'non-primitive structures exist');
    ok(s.every(x=>{ const H = STRUCTURES[x.def].home; return H.comfort<=20 && H.insul<=25 && H.dur<=35 && H.store<=90 && H.privacy<=20; }), 'a starting home is not crude');
    ok(S.citizens.every(c=>C().structs[c.home]), 'someone has no shelter'); ok(storeFood(C().commons)/90/S.citizens.length < 10, 'the food reserve is too large');
  });

  // ============================ PEOPLE AND MINDS ============================
  test('V10', 'Occupations emerge from repeated valuable work', ()=>{
    const c = adults()[3]; ok(!c.civ.occ, 'already has an occupation');
    c.civ.logWk = [0,1,2,3].map(()=>({chop:30, forage:4})); c.civ.buyers.chop = Object.fromEntries(otherHH(c, 4).map(o=>[o.id, 2]));
    civOccupationWeekly(c); ok(c.civ.occ==='woodcutter' && c.profession==='Woodcutter', `recognised as ${c.profession}`);
    // doing it without anyone relying on it is not enough
    const d = adults()[5]; d.civ.logWk = [{chop:30}]; d.civ.buyers = {}; civOccupationWeekly(d); ok(!d.civ.occ, 'an occupation without demand');
    // healer → medical worker as knowledge grows
    const h = adults()[7]; h.civ.logWk = [0,1,2,3].map(()=>({heal:28})); h.civ.buyers.heal = Object.fromEntries(otherHH(h, 3).map(o=>[o.id,1])); civOccupationWeekly(h); ok(h.profession==='Healer', 'healer not recognised');
    h.civ.know.medicine = 45; civOccupationWeekly(h); ok(h.profession==='Medical Worker', `healer did not progress: ${h.profession}`);
  });
  test('V11', 'Occupations emerge in a free-running settlement', ()=>{ days(35); ok((C().stats.occupations||0) > 0 && S.citizens.some(c=>c.civ.occ), 'nobody became known for their work in five weeks'); }, 4321);
  test('V12', 'Emergent business creation', ()=>{
    money(0); const c = adults(x=>x.age<50)[0]; know(c, ['smoking'], {foodcraft:40}); c.civ.skill.cooking = 60; c.wallet = 300; c.traits = ['Ambitious','Hardworking']; c.personality.openness = 0.8; Object.assign(c.civ.cog, {planning:0.9, risk:0.8});
    C().econ.unmet = {preserved:30}; C().demand = {cook:200};
    for (let i=0;i<60 && !civOrgs(o=>o.founders.includes(c.id)).length;i++){ civBusinessDaily(); days(1); }
    const o = civOrgs(o=>o.founders.includes(c.id))[0]; ok(o, 'no business was founded'); ok(o.biz && BUSINESS_TYPES[o.biz], 'the business has no type');
    ok((c.civ.major||[]).some(d=>String(d.act).startsWith('found:') && d.sit && d.obj && d.exp!=null), 'no decision record for the founding');
  }, 99);
  test('V13', 'Emergent market: barter → meeting place → trading spot → stalls', ()=>{
    const E = C().econ; ok(E.stage===1, 'market not at barter'); const [cx,cy] = C().center;
    E.spots[`${Math.floor(cx/4)},${Math.floor(cy/4)}`] = 40; E.barter = 60; E.barterWk0 = 0; civMarketStages(); ok(E.stage===2, 'no meeting place');
    E.barter = 120; civMarketStages(); const p = civProjects().find(p=>p.def==='trading_spot'); ok(p, 'no trading spot started'); finish(p); civMarketStages(); ok(E.stage===3, 'no trading spot');
    E.wkVol = 400; civMarketStages(); const m = civProjects().find(p=>p.def==='market'); ok(m, 'no market started'); finish(m); civMarketStages(); ok(E.stage===4 && civHas('market').length, 'no market stalls');
  });
  test('V14', 'Money emerges when barter keeps failing', ()=>{ const E = C().econ; ok(!E.money, 'money already'); E.barterFail = 120; E.barter = 60; civMoneyCheck(); ok(E.money==='beads', 'no money appeared'); ok(S.citizens.some(c=>c.wallet>0), 'nobody holds money'); });
  test('V15', 'Learning: practice, mentors, parents', ()=>{
    const c = adults()[2], s0 = sk(c,'woodcutting'); civLearnFromWork(c, {task:'chop'}, 8, null); ok(sk(c,'woodcutting') > s0, 'no skill from practice');
    const kid = S.citizens.find(k=>!isAdult(k) && k.age>=6 && k.parents.some(p=>alive(p))); const par = kid.parents.map(alive).find(Boolean); par.civ.know.history = 60; const h0 = kn(kid,'history'); for (let i=0;i<40;i++){ S.minute += DAY; civEducationDaily(); } ok(kn(kid,'history') > h0, 'a child learned nothing from a parent');
    const m = adults()[4], ap = adults(x=>x.age<30)[0]; m.civ.skill.fishing = 80; ap.civ.skill.fishing = 5; ap.civ.mentor = m.id; m.plan = {blocks:[{task:'fish', act:'Work'}]}; m.rt.blockIdx = 0;
    const f0 = sk(ap,'fishing'); civLearnFromWork(ap, {task:'fish'}, 4, null); const withM = sk(ap,'fishing') - f0; ap.civ.mentor = null; const f1 = sk(ap,'fishing'); civLearnFromWork(ap, {task:'fish'}, 4, null); ok(withM > sk(ap,'fishing') - f1, 'a mentor did not speed up learning');
  });
  test('V16', 'Schools form when children and a teacher are there', ()=>{
    const t = adults()[1]; t.civ.skill.teaching = 45; t.civ.know.teaching = 45; t.civ.know.literacy = 40;
    civProblem('education', 12); C().gov.meetings = []; civGathering('education');
    ok(civOrgs(o=>o.type==='school').length===1, 'no school organisation'); ok(C().edu.stage>=2, 'education stage did not advance');
    const p = civProjects().find(p=>p.def==='school_hut'); ok(p, 'no schoolhouse being built'); finish(p); ok(civSchoolFor(S.citizens.find(k=>!isAdult(k) && k.age>=7)), 'children have no school to go to');
  });
  test('V17', 'Knowledge is separate from intelligence; science disciplines exist', ()=>{
    ok(SCIENCES.length>=10 && ['mathematics','physics','chemistry','biology','geology','medicine','astronomy','engineering','agriscience','envscience'].every(s=>SCIENCES.includes(s)), 'missing science disciplines');
    ['agriculture','construction','medicine','law','finance','trade','politics','engineering','technology','geology','mathematics','history','geography'].forEach(k=>ok(KN[k], 'missing knowledge domain '+k));
    const smart = adults()[0]; COG.forEach(k=>smart.civ.cog[k] = 0.95); smart.civ.know = {}; smart.civ.skill = {};
    const exp = adults()[1]; COG.forEach(k=>exp.civ.cog[k] = 0.4); exp.civ.know.wilderness = 60; exp.civ.skill.hunting = 70;
    // a brilliant novice's forecast of a hunt is noisier than an experienced hunter's
    let errS = 0, errE = 0; for (let d=0; d<30; d++){ S.minute = d*DAY + 6*60; const a = civPredict(smart,'hunt',hhOf(smart)), b = civPredict(exp,'hunt',hhOf(exp)); errS += Math.abs(a.v/a.raw-1); errE += Math.abs(b.v/b.raw-1); }
    ok(errS > errE, 'intelligence alone gave good judgement in an unfamiliar field');
  });
  test('V18', 'Research follows the scientific method; wrong theories can win', ()=>{
    const r = adults()[0]; r.civ.know.chemistry = 30; r.civ.know.mathematics = 5; r.personality.openness = 0.9; r.civ.cog.creativity = 0.9; r.civ.cog.reasoning = 0.1;
    C().theories = {}; const R = {id:'rp_t', by:r.id, disc:'chemistry', q:'Does burning release a fire-substance?', theory:'th_phlogiston', tech:null, stage:0, prog:0, results:[], started:civDay(), status:'active', rigor:0}; C().research.push(R);
    let steps = 0; while (R.status==='active' && steps++ < 60) CIV_WORK.research(r, {task:'research'}, 8);
    ok(R.status==='done' && R.results.length>=1, 'research did not complete'); ok(RESEARCH_STAGES.length===7, 'missing method stages');
    ok(C().theories.th_phlogiston && C().theories.th_phlogiston.trials>0, 'results were not communicated');
    ok(r.civ.beliefs.th_phlogiston != null, 'the researcher holds no belief');
    // sloppy experiments support a false idea more often than careful ones
    let sloppy = 0, careful = 0; for (let i=0;i<200;i++){ const A = {theory:'th_phlogiston', results:[]}; r.civ.cog.reasoning = 0.05; civExperiment(A, r); sloppy += A.results[0].support; const B = {theory:'th_phlogiston', results:[]}; r.civ.cog.reasoning = 0.95; r.civ.know.mathematics = 90; civExperiment(B, r); careful += B.results[0].support; r.civ.know.mathematics = 5; }
    ok(sloppy > careful, 'rigour does not matter');
    // research can produce a technology when the prerequisites are there
    const e = adults()[2]; know(e, ['pottery'], {chemistry:20, crafts:30}); const R2 = {id:'rp_t2', by:e.id, disc:'chemistry', q:'smelting?', theory:null, tech:'smelting', stage:0, prog:0, results:[], started:civDay(), status:'active', rigor:0.8}; C().research.push(R2);
    let tries = 0; while (!knowsTech(e,'smelting') && tries++ < 20){ R2.status='active'; R2.stage=0; R2.results=[]; while (R2.status==='active') CIV_WORK.research(e, {task:'research'}, 8); } ok(knowsTech(e,'smelting'), 'research never produced the technology');
  });

  // ============================ FOOD ============================
  test('V19', 'Food shortage is detected and acted on', ()=>{
    Object.values(C().hh).forEach(h=>CIV_FOODS.forEach(g=>delete h.store[g])); C().commons = {};
    ok(civFoodDaysAll() < 0.5, 'food still counted'); const g0 = C().gov.meetings.length, p0 = C().problems.food||0;
    S.citizens.forEach(c=>c.needs.hunger = 10); S.citizens.slice(0,30).forEach(c=>civEat(c, true)); civSocietyDaily();
    ok((C().problems.food||0) > p0, 'hunger did not register as a problem'); ok((C().stats.shortage_days||0) > 0, 'shortage not counted'); ok(C().gov.meetings.length > g0, 'nobody called a gathering about food');
  });
  test('V20', 'Buying food from a neighbouring town costs money and takes time', ()=>{
    money(0); C().gov.stage = 4; C().gov.treasury = 5000; Object.values(C().hh).forEach(h=>CIV_FOODS.forEach(g=>delete h.store[g])); C().commons = {};
    C().neighbors.forEach(n=>{ n.food = n.pop*60; n.shortage = false; });
    const r = civOrderImport('test'); ok(r && /buy/.test(r), 'no purchase was made: '+r);
    const sh = C().shipments[C().shipments.length-1]; ok(sh.status==='en route' && sh.cost>0 && sh.arrive > civDay(), 'the shipment is free or instant');
    const n = C().neighbors.find(x=>x.id===sh.from); ok(C().gov.treasury < 5000, 'no public money was spent'); ok(sh.price > 1.1, 'price ignores transport');
    // imports are not guaranteed: neighbours in shortage have nothing to sell
    C().neighbors.forEach(n=>{ n.food = 0; n.shortage = true; }); const r2 = civOrderImport('test'); ok(/none to spare/.test(r2||''), 'food was bought from starving neighbours');
  });
  test('V21', 'Food shipments arrive after the journey', ()=>{
    money(0); C().gov.stage = 4; C().gov.treasury = 5000; C().neighbors.forEach(n=>{ n.food = n.pop*60; n.shortage = false; }); C().commons = {};
    civOrderImport('test'); const sh = C().shipments[C().shipments.length-1]; const f0 = storeFood(C().commons);
    RNG.s = 7; days(sh.arrive - civDay() + 1); ok(sh.status==='arrived' || sh.status==='lost', 'the shipment never resolved');
    if (sh.status==='arrived') ok(storeFood(C().commons) > f0, 'arrived food is not in the store');
  });

  // ============================ BUILDING ============================
  test('V22', 'Bridges are built where people need to cross, and can be demolished', ()=>{
    S.citizens.slice(0,10).forEach(c=>know(c, ['carpentry'], {construction:40}));
    C().crossing = {12:40, 13:10}; civBridgesWeekly(); const p = civProjects().find(p=>STRUCTURES[p.def].bridge); ok(p, 'no bridge project');
    const s = finish(p); ok(s && s.tiles.every(([x,y])=>MAP[y][x]===T.BRIDGE), 'bridge tiles not laid');
    const [x0,y0] = s.tiles[0], [x1] = s.tiles[s.tiles.length-1]; ok(findPath(x0-1, y0, x1+1, y0), 'cannot walk across the bridge');
    civRemoveStruct(s, 'demolish'); ok(s.tiles.every(([x,y])=>MAP[y][x]===T.WATER), 'demolished bridge left tiles behind'); ok((C().stats.bridges_built||0)===1 && (C().stats.demolished||0)>=1, 'not recorded');
  });
  test('V23', 'Farms and ranches are built, converted and demolished like anything else', ()=>{
    const c = adults()[0]; know(c, ['cultivation','domestication'], {agriculture:30, husbandry:30}); c.civ.skill.farming = 40; const h = hhOf(c); storeAdd(h.store, 'grain', 40);
    S.minute = Math.floor(S.minute/DAY)*DAY + 6*60; civLandUseGoals(c, h); const pf = civProjects().find(p=>STRUCTURES[p.def].farm && p.owner.id===h.id); ok(pf, 'no field project');
    const f = finish(pf); ok(MAP[f.y][f.x]===T.FIELD, 'no field tiles');
    civCaptureAnimal(c, 'goat'); civCaptureAnimal(c, 'goat'); civLandUseGoals(c, h); const pp = civProjects().find(p=>STRUCTURES[p.def].ranch && p.owner.id===h.id); ok(pp, 'no pen project'); const pen = finish(pp); ok(MAP[pen.y+1][pen.x+1]===T.PASTURE && MAP[pen.y][pen.x]===T.FENCE, 'no pasture and fence');
    ok(civConvert(f, 'garden') || civConvert(f, 'orchard'), 'field could not be converted'); civRemoveStruct(f, 'demolish'); ok(MAP[f.y][f.x]===T.GRASS, 'demolished field is still a field'); civRemoveStruct(pen, 'demolish'); ok(MAP[pen.y][pen.x]===T.GRASS, 'demolished pen remains');
  });
  test('V24', 'A private individual digs their own mine', ()=>{
    const d = C().deposits.find(x=>x.depth<=1 && !MIN[x.min].fluid) || Object.assign(C().deposits[0], {depth:1}); const c = adults()[0]; c.civ.skill.mining = 20; c.civ.know.geology = 20;
    civDiscover(d, c); ok(d.known && d.claim && d.claim.who.id===c.id, 'the find was not claimed');
    civMinesDaily(); const p = civProjects().find(p=>p.meta && p.meta.deposit===d.id); ok(p && p.def==='pit' && p.owner.k==='hh', 'no private pit started'); const m = finish(p);
    ok(d.mine===m.id, 'the mine is not linked to its deposit'); const left = d.left; const r = CIV_WORK.mine(c, {task:'mine', mine:m.id}, 5); ok(d.left < left && r.value>0, 'nothing was mined'); ok(storeUnits(hhOf(c).store) > 0, 'ore did not reach the household');
  });
  test('V25', 'Prospecting finds hidden minerals with knowledge and luck', ()=>{
    const c = adults()[0]; c.civ.know.geology = 70; c.civ.skill.geology = 60; const d = C().deposits.find(x=>x.depth<=2 && !MIN[x.min].fluid);
    let found = false; for (let i=0;i<40 && !found;i++){ CIV_WORK.prospect(c, {task:'prospect', xy:[d.x, d.y]}, 5); found = d.known; }
    ok(found, 'a skilled prospector standing on it never found it');
    const n = adults()[1]; n.civ.know.geology = 0; n.civ.skill.geology = 0; const d2 = C().deposits.find(x=>x!==d && !x.known && x.depth<=2 && !MIN[x.min].fluid); let f2 = 0; for (let i=0;i<40;i++){ const k = d2.known; CIV_WORK.prospect(n, {task:'prospect', xy:[d2.x,d2.y]}, 5); if (d2.known && !k) f2 = i+1; }
    ok(!d2.known || f2 > 1, 'a novice found it at once');
  });
  test('V26', 'Precious-metal discovery sets off a boom', ()=>{
    const d = C().deposits.find(x=>MIN[x.min].precious) || C().deposits[0]; Object.assign(d, {min:'gold', depth:1}); const c = adults()[0];
    const before = civLandPrice(d.x, d.y); civDiscover(d, c); ok((C().stats.precious_found||0)===1 && C().boom && C().boom.min==='gold', 'no gold strike recorded'); ok(civLandPrice(d.x, d.y) > before*1.5, 'land near the strike did not jump in value'); ok(civAttractiveness().opp > 0, 'a strike does not attract people');
  });
  test('V27', 'Oil is found by drilling once the knowledge exists', ()=>{
    money(500); const d = C().deposits.find(x=>x.min==='oil'); ok(d, 'no hidden oil in this world');
    const c = adults()[0]; civDiscover(d, c); ok(!d.known && d.suspected, 'oil was understood before anyone knew about drilling');
    S.citizens.slice(0,5).forEach(x=>know(x, ['drilling','steam_power','ironworking'], {geology:50, engineering:50}));
    const o = civNewOrg('corporation', 'Test Oil Co', [c], {biz:'oil_co'}); o.cash = 2000;
    const site = civFindSite('test_well', [d.x, d.y], {margin:0, maxR:3, anySide:true}); const p = civStartProject('test_well', site, {k:'org', id:o.id}, {org:o.id, meta:{test:true}}); finish(p);
    ok(d.known && (C().stats.oil_found||0)===1, 'drilling on the seep did not strike oil');
    const far = civFindSite('test_well', [2, 2], {margin:0, maxR:6, anySide:true}); const p2 = civStartProject('test_well', far, {k:'org', id:o.id}, {org:o.id, meta:{test:true}}); finish(p2); ok((C().stats.dry_wells||0)>=1, 'a well far from any oil was not dry');
  });

  // ============================ POPULATION ============================
  test('V28', 'Migration grows a successful settlement', ()=>{
    Object.values(C().hh).forEach(h=>storeAdd(h.store, 'grain', 400)); money(50); C().jobs.push({id:'j1', org:'x', role:'x', wage:9, open:true}, {id:'j2', org:'x', role:'x', wage:9, open:true});
    C().neighbors.forEach(n=>{ n.shortage = true; n.food = 0; n.rel = 60; });
    const n0 = S.citizens.length; civMigrationMonthly(); ok(S.citizens.length > n0, 'nobody came'); ok(C().migration.in > 0, 'arrivals not counted');
  });
  test('V29', 'No population cap: the settlement can grow past 110', ()=>{
    Object.values(C().hh).forEach(h=>storeAdd(h.store, 'grain', 400)); money(50); C().neighbors.forEach(n=>{ n.shortage = true; n.food = 0; n.rel = 80; });
    for (let i=0;i<12 && S.citizens.length<=125;i++) civMigrationMonthly();
    ok(S.citizens.length > 110, `population stuck at ${S.citizens.length}`);
    const [a, b] = S.citizens.filter(c=>c.partner && canConceive(c, alive(c.partner)) && hhOf(c)===hhOf(alive(c.partner))).map(c=>[c, alive(c.partner)])[0] || []; ok(a, 'no couple to test births'); const n = S.citizens.length; civBirth(a, b); ok(S.citizens.length===n+1, 'births stopped above the old cap');
  });

  // ============================ ORGANISATIONS AND FINANCE ============================
  test('V30', 'Partnerships: contributions, shares, authority, a contract', ()=>{
    money(0); const [a, b] = adults(); a.wallet = 30; b.wallet = 400; a.civ.skill.cooking = 60; know(a, ['smoking']); [[a,b],[b,a]].forEach(([x,y])=>{ const R = getRel(x,y.id); R.affinity = 70; R.trust = .8; });
    const g = civAddGoal(a, 'start_business', {biz:'smokehouse', task:'cook', partner:true}, BIZ_STEPS); const o = civFoundBusiness(a, g);
    ok(o.type==='partnership', `formed a ${o.type}`); ok(Object.keys(o.owners).length===2 && Math.abs(Object.values(o.owners).reduce((x,y)=>x+y,0)-1) < 0.01, 'ownership shares are wrong');
    ok(o.owners[b.id] > o.owners[a.id], 'shares ignore contributions'); ok(o.authority[a.id]==='managing', 'no managing partner'); ok(Object.values(C().contracts).some(k=>k.kind==='partnership' && k.terms.org===o.id), 'no partnership agreement');
    // the founder dies and the business carries on
    die(a, 'test'); ok(o.status==='active' && Object.keys(o.owners).length>=1 && !o.owners[a.id], 'the business died with its founder');
  });
  test('V31', 'Corporations: shares, board, dividends', ()=>{
    money(0); const [a, b] = adults(); a.wallet = 200; const o = civNewOrg('sole', 'Test Mill', [a], {biz:'mill'}); o.cash = 500; o.profitAvg = 20;
    civIncorporate(o); ok(o.type==='corporation' && o.shares===1000 && o.owners[a.id]===1000, 'not incorporated with 1000 shares'); ok(o.board.includes(a.id), 'no board');
    civSharePrice(o); ok(o.sharePrice > 0, 'no share price');
    o.revWk = 100; o.expWk = 20; b.wallet = 100000; ok(civSellShares(o, a, b, 200), 'shares were not sold'); b.wallet = 100; const w0 = b.wallet; civOrgsWeekly(); ok(b.wallet > w0, 'a shareholder got no dividend');
  });
  test('V32', 'Stock ownership and an exchange', ()=>{
    money(0); const [a, b, c, f] = adults(); [a,b,c,f].forEach(x=>x.wallet = 1000); f.civ.know.finance = 50;
    const corps = [0,1,2].map(i=>{ const o = civNewOrg('sole', 'Co '+i, [[a,b,c][i]], {biz:'mill'}); o.cash = 300; civIncorporate(o); return o; });
    ok(civSellShares(corps[0], a, b, 100) && corps[0].owners[b.id]===100 && corps[0].owners[a.id]===900, 'shares did not change hands');
    civStockWeekly(); ok(C().exchange && corps.every(o=>o.listed), 'no exchange formed with three corporations');
    // share prices follow the business, not dice
    const o = corps[1]; o.priceHist = []; o.sharePrice = 0; o.cash = 300; o.profitAvg = 0; civSharePrice(o); const low = o.sharePrice; o.cash = 3000; o.profitAvg = 50; for (let i=0;i<5;i++) civSharePrice(o); ok(o.sharePrice > low*2, 'a much richer company is not worth more');
    ok(['conservative','growth','value','speculator'].includes(a.civ.style), 'no investor style');
  });
  test('V33', 'Loans: informal lending, repayments, credit history', ()=>{
    money(0); const [a, b] = adults(); a.wallet = 0; b.wallet = 500; const R = getRel(b, a.id); R.trust = 0.8; R.affinity = 60; R.tags = ['Friend']; b.personality.agreeableness = 0.8;
    const k = civSeekLoan(a, 100, 'test'); ok(k && k.kind==='loan' && a.wallet===100, 'no loan'); a.wallet += 200; const s0 = a.civ.credit.score;
    for (let i=0;i<12;i++){ S.minute += 7*DAY; civContractsDaily(); } ok(k.status==='repaid', `loan status ${k.status}`); ok(a.civ.credit.score > s0 && a.civ.credit.repaid>0, 'credit history did not improve');
    ok(C().fin.stage>=1, 'finance stage did not advance');
  });
  test('V34', 'Civil lawsuits: an unpaid debt becomes a claim with evidence', ()=>{
    money(0); const [a, b] = adults(); a.wallet = 0; b.wallet = 500; getRel(b, a.id).trust = 0.9; b.personality.agreeableness = 0.9;
    const k = civSeekLoan(a, 150, 'test'); a.wallet = 0; for (let i=0;i<4;i++){ S.minute += 7*DAY; civContractsDaily(); }
    const cs = C().justice.cases.find(x=>x.kind==='civil' && x.type==='debt'); ok(cs, 'no lawsuit'); ok(cs.plaintiff.id===b.id && cs.defendant.id===a.id && cs.damages>0 && cs.evidence.length, 'case is missing parties, damages or evidence');
    C().justice.stage = 6; C().gov.offices.magistrate = adults()[5].id; adults()[5].civ.know.law = 60; cs.day = civDay()-5; civJusticeDaily(); ok(cs.status==='judged' && cs.judgment, 'the case was never judged');
  });
  test('V35', 'Bankruptcy: liquidation and restructuring', ()=>{
    money(0); const [a, b, c] = adults(); b.wallet = 1000;
    const o = civNewOrg('sole', 'Doomed Co', [a], {biz:'mill'}); o.cash = 10; o.profitAvg = -5; civLoan({k:'person', id:b.id}, {k:'org', id:o.id}, 300, 0.1, 5, 'test'); o.cash = 5;
    const w0 = b.wallet; const r = civBankrupt({k:'org', id:o.id}, 'court'); ok(r==='liquidated' && o.status==='bankrupt', `org not liquidated: ${r}`); ok(b.wallet > w0, 'the creditor recovered nothing');
    const good = civNewOrg('sole', 'Viable Co', [c], {biz:'mill'}); good.profitAvg = 10; const k = civLoan({k:'person', id:b.id}, {k:'org', id:good.id}, 200, 0.2, 4, 'test'); good.cash = 0;
    ok(civBankrupt({k:'org', id:good.id}, 'court')==='restructured' && good.status==='active' && k.terms.rate < 0.2, 'a viable business was not restructured');
  });

  // ============================ GOVERNMENT AND JUSTICE ============================
  test('V36', 'Government emerges from coordination problems, not dates', ()=>{
    const G = C().gov; ok(G.stage===0, 'already governed'); days(3); if (civProblemTotal() < 9) { civProblem('dispute', 6); civProblem('food', 5); } civGovDaily(); ok(G.stage>=1 && G.meetings.length, 'no gathering despite problems');
    for (let i=0;i<5;i++){ S.minute += 6*DAY; civProblem('dispute', 10); civGovDaily(); } ok(G.stage>=2 && G.council.length, 'no council after repeated gatherings');
    ok(G.form && GOV_FORMS.includes(G.form), 'no form of government');
  });
  test('V37', 'Justice grows from informal mediation', ()=>{
    const [a, b] = adults(); const k = civCaseFile('civil', 'breach', {k:'person', id:a.id}, {k:'person', id:b.id}, 'a broken promise', 10); ok(k && k.status==='open', 'no case');
    for (let i=0;i<30 && k.status==='open';i++){ S.minute += DAY; civJusticeDaily(); civMediate(k, civMediator(k)); }
    ok(k.status!=='open', 'nobody resolved the dispute'); ok(['settled','retaliation','dropped'].includes(k.status), `resolved oddly: ${k.status}`);
  });

  // ============================ 3D AND APPEARANCE ============================
  test('V38', '3D animals are real animated models with persistent attributes', async ()=>{
    await three();
    ['cow','pig','sheep','chicken','horse','dog','cat','goat','deer','boar','rabbit','wolf','bird','fish'].forEach(k=>{ const g = an3Build(k, 0); ok(g.isGroup && g.userData.core && g.userData.core.isMesh, k+' is not a 3D model'); if (!['bird','fish'].includes(k)) ok(g.userData.legs.length===(k==='chicken' ? 2 : 4), k+' has the wrong number of legs'); if (k==='bird') ok(g.userData.wings, 'birds have no wings'); });
    const c = adults()[0]; const a = civNewAnimal('goat', {k:'hh', id:c.civ.hh}, {age:200, sex:'F'}); ['age','health','sex','owner','prod','born','mother','kids'].forEach(f=>ok(f in a, 'animal lacks '+f));
    const saved = JSON.parse(JSON.stringify(S.civ.animals)); ok(saved.find(x=>x.id===a.id).sex==='F', 'animal not saved');
    ok(typeof lpBuild==='function' && typeof r3Animals==='function', 'no 3D animal pass');
  });
  test('V39', 'Appearance is inherited and persists through a save', async ()=>{
    await three();
    const [a, b] = S.citizens.filter(c=>c.partner && canConceive(c, alive(c.partner))).map(c=>[c, alive(c.partner)])[0];
    a.civ.genes.height = 0.95; b.civ.genes.height = 0.9; a.civ.genes.hair = '#c8702a'; b.civ.genes.hair = '#c8702a';
    const kids = []; for (let i=0;i<6;i++){ civBirth(a, b); kids.push(S.citizens[S.citizens.length-1]); }
    ok(kids.every(k=>k.civ.genes.hair==='#c8702a'), 'hair colour not inherited'); ok(kids.reduce((s,k)=>s+k.civ.genes.height,0)/kids.length > 0.7, 'height not inherited');
    saveGame(true); const sv = store.get(SAVE_KEY); const k0 = sv.state.citizens.find(x=>x.id===kids[0].id);
    ok(JSON.stringify(k0.civ.genes)===JSON.stringify(kids[0].civ.genes) && k0.look.hair, 'appearance was not saved');
    // grown bodies and old age show in the 3D figure
    const kid = kids[0]; kid.age = 3; const g1 = lpBuild(kid); kid.age = 30; kid.profession = 'Settler'; const g2 = lpBuild(kid); kid.age = 75; const g3 = lpBuild(kid);
    ok(g1.scale.y < g2.scale.y*0.8, 'children are not smaller'); ok(g3.userData.stoop > 0.2, 'the old do not stoop');
  });

  test('V40', 'A woman who marries takes a hyphenated surname; divorce restores her birth name', ()=>{
    const f = adults().find(c=>genderOf(c)==='F' && !c.partner && !c.maiden), m = adults().find(c=>genderOf(c)==='M' && !c.partner && surnameOf(c)!==surnameOf(f));
    ok(f && m, 'no unmarried pair to test');
    const first = f.name.split(' ')[0], own = surnameOf(f), his = surnameOf(m), hisName = m.name;
    civMarry(f, m);
    ok(f.name===`${first} ${own}-${his}`, 'bride is called '+f.name); ok(f.maiden===own, 'birth surname not kept'); ok(m.name===hisName, 'the husband\'s name changed');
    ok(S.chronicle.slice(-6).some(e=>(e.text||'').includes(`She is now ${f.name}`)), 'the name change was not announced');
    civDivorce(f, m); ok(f.name===`${first} ${own}` && !f.maiden, 'divorce did not restore '+f.name);
    // the classic town does the same
    ok(typeof marriedName==='function' && typeof restoreBirthName==='function', 'classic wedding lacks hyphenation');
  });
  test('V41', 'Food storage can be learned, and knowing how keeps food from spoiling', ()=>{
    ['storage_pits','salting','sealed_jars','root_cellar','raised_granary','pest_control'].forEach(t=>ok(TECHS[t] && TECHS[t].store && TECHS[t].prac, t+' is not a learnable storage technique'));
    const h = Object.values(S.civ.hh).find(h=>hhMembers(h).filter(isAdult).length>=1), mem = hhMembers(h).filter(isAdult);
    const saved = mem.map(m=>m.civ.techs.slice()); const keepStore = Object.assign({}, h.store);
    const lose = () => { h.store = {fish:100, veg:100, grain:100}; const cs = S.civ.commons; S.civ.commons = {}; civSpoilage(); S.civ.commons = cs; return 300 - (h.store.fish||0) - (h.store.veg||0) - (h.store.grain||0); };
    mem.forEach(m=>m.civ.techs = m.civ.techs.filter(t=>!TECHS[t] || !TECHS[t].store));
    const without = lose();
    mem[0].civ.techs.push('salting','root_cellar','sealed_jars');
    const withT = lose();
    ok(withT < without*0.75, `techniques barely helped: ${without.toFixed(1)} vs ${withT.toFixed(1)} lost`);
    const mult = civHHStoreMult(h); ok(mult.fish > 1.7 && mult.veg > 1.7, 'storage multipliers not applied');
    mem.forEach((m,i)=>m.civ.techs = saved[i]); h.store = keepStore;
  });
  test('V42', 'Food is distributed: kin share, the common store rations, spare perishables are given away', ()=>{
    const hs = Object.values(S.civ.hh).filter(h=>hhMembers(h).some(isAdult));
    const poor = hs[0], rich = hs.find(h=>h!==poor);
    const pa = hhMembers(poor).find(isAdult), ra = hhMembers(rich).filter(isAdult);
    const keepP = Object.assign({}, poor.store), keepR = Object.assign({}, rich.store), keepC = Object.assign({}, S.civ.commons);
    poor.store = {}; rich.store = {grain:400, fish:60}; S.civ.commons = {};
    ra.forEach(r=>{ r.personality.agreeableness = 0.9; getRel(pa, r.id).tags.push('Family'); getRel(r, pa.id).tags.push('Family'); });
    civDistributeFood();
    ok(storeFood(poor.store) > 0, 'relatives with plenty did not share'); ok(S.civ.dist.shared > 0 && S.civ.dist.helped >= 1, 'sharing not recorded');
    // no relatives with food: the common store hands out rations
    poor.store = {}; rich.store = {}; S.civ.commons = {grain:500}; S.civ.rationToday = 0; civDistributeFood();
    ok(storeFood(poor.store) > 0 && S.civ.dist.rations > 0, 'the common store did not ration');
    poor.store = keepP; rich.store = keepR; S.civ.commons = keepC;
  });
  test('V43', 'The resources tab shows food, storage, animals, trees, materials and minerals', ()=>{
    ok(document.querySelector('[data-p=res]') && $('p-res'), 'no resources tab');
    civResSnapshot(); civRenderResources(); const html = $('p-res').innerHTML;
    ['Food', 'Storage', 'spoiled', 'Keeping food', 'Sharing food', 'Animals', 'Wild game', 'Trees standing', 'Building materials', 'Ores', 'Energy', 'Made goods'].forEach(k=>ok(html.includes(k), 'resources tab lacks '+k));
    const R = civResourceTotals(); ok(isFinite(R.foodDays) && R.trees > 0 && R.cap > 0, 'resource totals are wrong');
    ok((S.civ.resHist||[]).length >= 1, 'no resource history kept');
  });
  test('V44', 'Clicking a building in the land tab finds it on the map', ()=>{
    civRenderLand(); const link = $('p-land').querySelector('[data-loc]'); ok(link, 'buildings are not clickable');
    const [x,y,w,h] = link.dataset.loc.split(',').map(Number); cam.x = 0; cam.y = 0; cam.follow = true;
    link.click();
    ok(Math.abs(cam.x - (x+w/2)*TILE) < 1 && Math.abs(cam.y - (y+h/2)*TILE) < 1, 'camera did not move to the building'); ok(!cam.follow, 'camera still following someone');
    ok(ui.hl && ui.hl.x===x && ui.hl.until > performance.now(), 'building not highlighted');
  });
  test('V45', 'People and animals are detailed voxel models; the palette is wide', async ()=>{
    await three();
    const f = adults().find(c=>genderOf(c)==='F'), g = lpBuild(f), U = g.userData;
    const tris = o => { let n = 0; o.traverse(m=>{ if (m.isMesh) n += m.geometry.index ? m.geometry.index.count/3 : m.geometry.attributes.position.count/3; }); return n; };
    ok(tris(g) > 1500, 'the figure is too simple: '+tris(g)+' triangles');
    ok(U.aL.joint && U.lL.joint && U.hand, 'limbs do not bend'); const box = new THREE.Box3().setFromObject(g), sz = box.getSize(new THREE.Vector3());
    ok(sz.y > sz.x*2.2 && sz.y > 1.2 && sz.y < 2.2, 'unrealistic proportions '+sz.x.toFixed(2)+'x'+sz.y.toFixed(2));
    ['cow','horse','sheep','deer','dog'].forEach(k=>{ const a = an3Build(k, 0); ok(a.userData.head && a.userData.head.isGroup, k+' has no posable head'); ok(tris(a) > 250, k+' is too simple'); });
    ok(SKINS.length >= 12 && HAIRS.length >= 14 && EYES.length >= 10 && CLOTH.dyed.length >= 16 && CLOTH.pants.length >= 6, 'palette is still narrow');
  });

  // ======================= JUSTICE (civilization mode) =======================
  // fix(v): make the settlement's dice return v (a number or a function) until the returned undo is called
  const fix = v => { const o = RNG.next; RNG.next = typeof v==='function' ? v : () => v; return () => { RNG.next = o; }; };
  const put = (c, x, y) => { c.rt.x = x; c.rt.y = y; c.rt.state = 'Working'; c.away = null; c.jail = 0; };
  const cleanSlate = () => S.citizens.forEach(c=>{ c.rt.x = 5; c.rt.y = 5; c.rt.state = 'Sleeping'; });
  const theftCase = (offender, victim, statements) => { const k = civCaseFile('criminal', 'theft', {k:'person', id:victim.id}, null, 'food stolen', 5); k.actual = offender.id; k.truth = true; k.sev = 4; k.statements = []; k.proof = []; k.pending = []; k.phase = 'reported'; k.at = [40, 20]; (statements||[]).forEach(([by, acc, conf, clears])=>civStatement(k, by, acc.id, conf, clears ? 'alibi' : 'saw', 'test', clears)); return k; };
  const officials = () => { const [cop, inv, mag] = adults(c=>c.age<55).slice(20, 23); const G = C().gov; G.stage = Math.max(G.stage, 4); G.offices.constable = cop.id; cop.office = 'Constable'; G.offices.investigator = inv.id; inv.office = 'Investigator'; inv.civ.cog.reasoning = 0.9; inv.civ.cog.attention = 0.9; G.offices.magistrate = mag.id; mag.office = 'Magistrate'; mag.civ.know.law = 60; mag.civ.cog.reasoning = 0.9; mag.traits = ['Honest']; return {cop, inv, mag}; };
  test('CJ1', 'A minor fight is still settled on the spot by a constable', ()=>{
    money(10); cleanSlate(); const {cop} = officials(); C().justice.stage = 3; const [a, b] = adults(c=>c.age<50 && !c.office).slice(0,2); a.personality.agreeableness = 0.1; b.personality.agreeableness = 0.9;
    [a, b, cop].forEach((c,i)=>put(c, 40+i, 20)); const n = C().justice.cases.length;
    let n0 = 0; const undo = fix(()=>n0++===0 ? 0.1 : 0.9); try { civQuarrel(a, b); } finally { undo(); } // the fight happens; nobody is hurt
    ok(C().justice.cases.length===n, 'a simple brawl became a case'); ok((a.civ.legal||[]).some(e=>e.v==='fined' && e.type==='brawling'), 'the constable did not deal with it');
    ok(S.chronicle.slice(-3).some(e=>/broke up a fight/.test(e.text)), 'nothing in the chronicle');
  });
  test('CJ2', 'Serious vandalism creates a case, without anyone knowing who did it', ()=>{
    cleanSlate(); const [v, foe] = adults(c=>c.civ.hh && S.civ.hh[c.civ.hh].home).slice(0,2); const s = S.civ.structs[hhOf(foe).home]; const cond = s.cond;
    civVandalism(v, foe); const k = C().justice.cases[C().justice.cases.length-1];
    ok(k && k.type==='vandalism' && k.kind==='criminal' && k.status==='open', 'no vandalism case'); ok(k.actual===v.id && !k.defendant, 'the offender should be known only to the world'); ok(s.cond < cond, 'nothing was damaged');
  });
  test('CJ3', 'A crime nobody saw can go unsolved', ()=>{
    cleanSlate(); const [o, v] = adults().slice(0,2); const k = theftCase(o, v, []); k.day = civDay() - 41;
    civJusticeDaily(); ok(k.status==='unsolved', `status ${k.status}`);
  });
  test('CJ4', 'An investigator identifies a suspect from what witnesses say', ()=>{
    cleanSlate(); const {inv} = officials(); C().justice.stage = 4; const [o, v, w1, w2] = adults(c=>!c.office).slice(0,4);
    const k = theftCase(o, v, []); k.pending = [{by:w1.id, acc:o.id, conf:0.85}, {by:w2.id, acc:o.id, conf:0.8}];
    const undo = fix(0.05); try { for (let i=0;i<3;i++) civInvestigate(k); } finally { undo(); }
    ok(k.inv===inv.id, 'the investigator did not take the case'); ok(k.named===o.id, `named ${k.named}`); ok(k.statements.length>=2, 'witnesses were not interviewed');
  });
  test('CJ5', 'Witnesses can disagree, and that weakens the case', ()=>{
    const [o, x, v, w1, w2] = adults().slice(0,5);
    const one = theftCase(o, v, [[w1, o, 0.8]]), two = theftCase(o, v, [[w1, o, 0.8], [w2, x, 0.8]]);
    const sc = civCaseScores(two); ok(sc[o.id] > 0 && sc[x.id] > 0, 'both accounts should count'); ok(civCaseStrength(two, o.id) < civCaseStrength(one, o.id), 'contradiction did not weaken the case');
  });
  test('CJ6', 'An innocent suspect can be cleared by an alibi', ()=>{
    cleanSlate(); officials(); C().justice.stage = 4; const [o, inno, v, w1, w2] = adults(c=>!c.office && !c.traits.includes('Cunning')).slice(0,5);
    const k = theftCase(o, inno, []); k.plaintiff = {k:'person', id:v.id}; civStatement(k, w1, inno.id, 0.7, 'saw', 't'); civStatement(k, w2, inno.id, 0.7, 'saw', 't'); k.named = inno.id;
    const undo = fix(0.05); try { civInvestigate(k); civInvestigate(k); } finally { undo(); }
    ok(k.statements.some(s=>s.clears && s.acc===inno.id), 'no alibi was found'); ok((inno.civ.legal||[]).some(e=>e.v==='cleared'), 'the innocent suspect was not cleared'); ok(k.named!==inno.id, 'still named');
  });
  test('CJ7', 'A court can convict on strong evidence', ()=>{
    const {mag} = officials(); C().justice.stage = 6; const [o, v, w1, w2] = adults(c=>!c.office).slice(0,4);
    const k = theftCase(o, v, [[w1, o, 0.9], [w2, o, 0.9]]); civProof(k, {kind:'goods', who:o.id, str:0.7, text:'stolen food found'}); k.defendant = {k:'person', id:o.id};
    const undo = fix(0.5); try { civJudge(k, mag, 0); } finally { undo(); }
    ok(k.status==='judged' && k.judgment.found, 'not convicted'); ok((o.civ.legal||[]).some(e=>e.v==='guilty'), 'no record of the conviction');
  });
  test('CJ8', 'A court can acquit when the case is weak', ()=>{
    const {mag} = officials(); const [o, x, v, w1, w2] = adults(c=>!c.office).slice(0,5);
    const k = theftCase(x, v, [[w1, o, 0.35], [w2, o, 0.7, true]]); k.defendant = {k:'person', id:o.id};
    const undo = fix(0.5); try { civJudge(k, mag, 0); } finally { undo(); }
    ok(k.status==='judged' && !k.judgment.found, 'convicted on nothing'); ok((o.civ.legal||[]).some(e=>e.v==='acquitted'), 'no record of the acquittal');
  });
  test('CJ9', 'A case with too little evidence is dismissed', ()=>{
    officials(); C().justice.stage = 5; const [o, v, w1] = adults(c=>!c.office).slice(0,3);
    const k = theftCase(o, v, [[w1, o, 0.2]]); k.defendant = {k:'person', id:o.id}; k.day = civDay() - 5;
    civJusticeDaily(); ok(k.status==='dismissed', `status ${k.status}`);
  });
  test('CJ10', 'A repeat offender is treated more harshly', ()=>{
    money(500); const {mag} = officials(); const [o, v, w1] = adults(c=>!c.office).slice(0,3);
    const mk = () => { const k = civCaseFile('criminal', 'vandalism', {k:'person', id:v.id}, {k:'person', id:o.id}, 'broken fence '+Math.random(), 5); k.actual = o.id; k.sev = 3; k.statements = []; k.proof = []; civStatement(k, w1, o.id, 0.95, 'saw', 't'); civProof(k, {kind:'tools', who:o.id, str:0.8, text:'axe marks'}); return k; };
    const undo = fix(0.5); let k1, k2; try { k1 = mk(); civJudge(k1, mag, 0); o.civ.legal.push({day:civDay(), type:'theft', sev:5, v:'guilty'}); k2 = mk(); civJudge(k2, mag, 0); } finally { undo(); }
    ok(k1.judgment.found && k2.judgment.found, 'not convicted'); ok(/warning/.test(k1.judgment.sentence), `first offence: ${k1.judgment.sentence}`); ok(!/warning/.test(k2.judgment.sentence) && k2.judgment.sentence.length, `repeat offence: ${k2.judgment.sentence}`);
  });
  test('CJ11', 'Jail keeps people from work, wages and the vote', ()=>{
    const c = adults()[3]; c.jail = civDay() + 5; const p = civPlanDay(c, civDay());
    ok(p.blocks.some(b=>/jail/.test(b.note)) && !p.blocks.some(b=>b.act==='Work'), 'a prisoner still goes to work');
    money(0); const o = civNewOrg('sole', 'Test Works', [adults()[4]]); o.cash = 500; const j = civPostJob(o, 'hand', 50); C().jobs = [j]; S.citizens.forEach(x=>{ if (x!==c) x.civ.job = 'x'; }); civLaborDaily(); ok(!c.civ.job || c.civ.job==='x', 'a prisoner was hired');
  });
  test('CJ12', 'A conflict of interest makes an honest magistrate step aside', ()=>{
    const {mag} = officials(); const [o, v] = adults(c=>!c.office).slice(0,2); getRel(mag, o.id).tags.push('Family'); getRel(o, mag.id).tags.push('Family');
    const k = theftCase(o, v, []); k.defendant = {k:'person', id:o.id};
    const pick = civJudgeFor(k); ok(pick && pick.judge!==mag, 'the magistrate judged their own relative'); ok(k.recused===mag.id, 'no recusal recorded');
  });
  test('CJ13', 'Corruption can bend justice, and can come out later', ()=>{
    money(0); const {mag} = officials(); mag.traits = ['Greedy']; mag.personality.conscientiousness = 0.2; const [o, v] = adults(c=>!c.office).slice(0,2); o.traits = ['Cunning']; o.wallet = 5000;
    const k = theftCase(o, v, []); k.defendant = {k:'person', id:o.id};
    let tilt; const undo = fix(0.01); try { tilt = civTryBribe(k, mag); } finally { undo(); }
    ok(tilt > 0 && k.bribe && k.bribe.to===mag.id, 'no bribe taken'); ok(mag.wallet > 0, 'no money changed hands');
    const u2 = fix(0); try { civBriberyDiscovery(); } finally { u2(); }
    ok(C().justice.cases.some(b=>b.type==='bribery' && b.actual===mag.id), 'the bribe never came out'); ok(C().gov.offices.magistrate!==mag.id, 'the corrupt magistrate kept their office');
  });

  // ======================= MEMORY, BELIEFS AND OPINIONS =======================
  test('CC1', 'A witness sees a crime and remembers it first-hand', ()=>{
    cleanSlate(); const [o, v, w] = adults().slice(0,3); put(w, 41, 20); w.civ.cog.attention = 0.95; const k = theftCase(o, v, []);
    const undo = fix(0.05); try { civCrimeScene(k, o, [40,20], 4); } finally { undo(); }
    const m = cogOf(w).mems.find(x=>x.ev==='crime_'+k.id); ok(m && m.src==='saw', 'no first-hand memory'); ok(cogOf(w).kn[k.id], 'no belief about who did it');
  });
  test('CC2', 'An important event is remembered', ()=>{ const c = adults()[0]; experience(c, {type:'wronged', text:'My brother was convicted of something he did not do.', imp:9, src:'self', topics:{courts:-1}}); for (let i=0;i<30;i++) cognitionDaily(); ok(cogOf(c).mems.some(x=>x.type==='wronged'), 'forgotten within a month'); });
  test('CC3', 'People learn news from friends', ()=>{
    const [a, b] = adults().slice(0,2); experience(a, {ev:'e1', type:'news', text:'I saw the granary burn.', pub:'The granary burned down.', imp:7, src:'saw'});
    ok(shareNews(a, b), 'nothing was passed on'); const m = cogOf(b).mems.find(x=>x.ev==='e1'); ok(m && m.src==='told' && m.from===a.id, 'the friend did not learn it second-hand');
  });
  test('CC4', 'People learn from a newspaper they can read', ()=>{
    const r = adults()[0]; r.civ.know.literacy = 40; S.citizens.forEach(c=>{ if (c!==r) c.civ.know.literacy = 0; });
    C().orgs.org_np = {id:'org_np', type:'firm', biz:'newspaper', status:'active', name:'The Settler', staff:[], owners:{}}; C().wire = [{day:civDay(), text:'The council met about the bridge.', who:[], topics:{council:0.4}, ev:'w1'}];
    const undo = fix(0.1); try { civNewspapersWeekly(); } finally { undo(); }
    ok(cogOf(r).mems.some(x=>x.src==='paper' && x.from==='org_np'), 'nothing learned from the paper'); ok(!cogOf(adults()[1]).mems.some(x=>x.src==='paper'), 'someone who cannot read learned from it');
  });
  test('CC5', 'A rumour can pass on a false accusation', ()=>{
    const [a, b, truth, scape] = adults(c=>!c.traits.includes('Honest')).slice(0,4); getRel(a, scape.id).affinity = -80;
    experience(a, {ev:'e2', type:'crime', text:`I saw ${truth.name} steal.`, pub:`${truth.name} stole grain.`, who:[truth.id], imp:7, src:'saw', fact:{id:'f2', who:truth.id, conf:0.9, kind:'theft'}});
    const undo = fix(0.01); try { shareNews(a, b); } finally { undo(); }
    ok(cogOf(b).kn.f2 && cogOf(b).kn.f2.who===scape.id, 'the story was not garbled'); ok(cogOf(a).kn.f2.who===truth.id, 'the teller changed their own mind');
  });
  test('CC6', 'Contradictory information does not simply overwrite a belief', ()=>{
    const c = adults()[0], [x, y] = adults().slice(1,3); c.traits = c.traits.filter(t=>t!=='Stubborn');
    learnFact(c, 'f3', x.id, 0.8, 'saw'); learnFact(c, 'f3', y.id, 0.3, 'rumor');
    ok(cogOf(c).kn.f3.who===x.id && cogOf(c).kn.f3.conf < 0.8, 'a weak rumour flipped a first-hand belief (or did not dent it)');
    learnFact(c, 'f3', y.id, 0.9, 'court'); learnFact(c, 'f3', y.id, 0.9, 'court'); ok(cogOf(c).kn.f3.who===y.id, 'strong evidence never changed their mind');
  });
  test('CC7', 'Beliefs form gradually from repeated experience', ()=>{
    const c = adults()[0]; const M = cogOf(c); M.op.landlords = 0; M.bel = [];
    experience(c, {type:'rent', text:'Rent went up.', topics:{landlords:-1}, imp:6, src:'self'}); consolidate(c); ok(!M.bel.some(b=>b.topic==='landlords'), 'one bad week made a belief');
    for (let i=0;i<6;i++){ S.minute += 8*DAY; experience(c, {type:'rent', text:'Rent went up again.', topics:{landlords:-1}, imp:6, src:'self'}); experience(c, {ev:'r'+i, type:'rent2', text:'A friend was evicted.', topics:{landlords:-1}, imp:5, src:'told'}); consolidate(c); }
    ok(M.bel.some(b=>b.topic==='landlords' && b.pos<0), 'no belief after many experiences');
  });
  test('CC8', 'What a voter remembers about a candidate changes the vote', ()=>{
    const [v, a] = adults().slice(0,2); const before = civVoteScore(v, a);
    learnFact(v, 'f4', a.id, 0.9, 'court', null, {kind:'bribery', sev:6}); ok(civVoteScore(v, a) < before - 20, 'a known scandal did not cost votes');
  });
  test('CC9', 'A policy that hits someone\'s own purse changes their opinion of it', ()=>{ const c = adults()[0]; const M = cogOf(c); const before = M.op.taxes||0; M.week = {tax:12}; civCognitionWeekly(); ok((M.op.taxes||0) < before, 'paying heavy tax did not sour them on taxes'); });
  test('CC10', 'Minor memories fade', ()=>{ const c = adults()[0]; experience(c, {type:'small', text:'Saw a nice sunset.', imp:4, src:'saw'}); for (let i=0;i<70;i++) cognitionDaily(); ok(!cogOf(c).mems.some(x=>x.type==='small'), 'a trivial memory lasted'); });
  test('CC11', 'Major memories persist', ()=>{ const c = adults()[0]; experience(c, {type:'big', text:'My child was born.', imp:9, src:'self'}); for (let i=0;i<70;i++) cognitionDaily(); ok(cogOf(c).mems.some(x=>x.type==='big'), 'a life event was forgotten'); });
  test('CC12', 'Nobody automatically knows about distant events', ()=>{
    cleanSlate(); const [o, v, near, far] = adults().slice(0,4); put(near, 41, 20); put(far, 90, 45); near.civ.cog.attention = 0.95; const k = theftCase(o, v, []);
    const undo = fix(0.05); try { civCrimeScene(k, o, [40,20], 4); } finally { undo(); }
    ok(cogOf(near).kn[k.id], 'the witness did not see it'); ok(!cogOf(far).kn[k.id] && !cogOf(far).mems.some(x=>x.ev==='crime_'+k.id), 'someone far away knew anyway');
  });

  // ======================= THE FRONTIER =======================
  const stock = () => { C().commons.grain = 2000; C().commons.tools = 40; };
  const discover = (dir) => { const t = frontierCells(dir)[0]; return civDiscoverRegion(t.cx, t.cy, adults().slice(0,2), 'test'); };
  test('CE1', 'Exploring needs food, tools and people to spare', ()=>{
    C().commons = {}; Object.values(C().hh).forEach(h=>h.store = {}); const chk = civExpCheck('N', {k:'player'});
    ok(!chk.ok && chk.miss.some(m=>/food/.test(m)), 'an expedition could leave with no food'); ok(civLaunchExpedition('N', {k:'player'}).err, 'it launched anyway');
  });
  ['N','S','E','W'].forEach((dir, i)=>test('CE'+(2+i), `The player can explore ${DIRS[dir].label.toLowerCase()}`, ()=>{
    stock(); const r = civLaunchExpedition(dir, {k:'player'}); ok(r.e && r.e.dir===dir, r.err || 'no expedition'); ok(r.e.members.every(id=>cById(id).away && cById(id).away.dir===dir), 'the crew did not leave');
    ok(C().commons.grain < 2000, 'no food was taken');
  }));
  test('CE6', 'Unexplored land is fog, and its resources are hidden', ()=>{
    const t = frontierCells('W')[0], [x0,y0,x1,y1] = cellRect(t.cx, t.cy);
    ok(!cellOf(cellKey(t.cx, t.cy)), 'already known'); ok(tileAt(Math.round((x0+x1)/2), Math.round((y0+y1)/2))===T.FOG, 'not hidden by fog');
    ok(!C().deposits.some(d=>d.region===cellKey(t.cx,t.cy)) && !(C().eco.ext||{})[Math.floor(x0/ECO_CELL)+','+Math.floor(y0/ECO_CELL)], 'resources known before exploring');
  });
  test('CE7', 'Exploration takes time', ()=>{
    stock(); const r = civLaunchExpedition('S', {k:'player'}); const e = r.e; ok(e.back - e.start >= 3, 'too quick');
    civFrontierDaily(); ok(!cellOf(cellKey(e.cx, e.cy)) && e.status==='out', 'mapped before they got there');
    S.minute = e.back*DAY + 60; civFrontierDaily(); ok(e.status!=='out', 'never came back'); ok(e.status==='failed' || cellOf(cellKey(e.cx, e.cy)), 'returned but mapped nothing');
  });
  test('CE8', 'Regions differ in what they offer', ()=>{
    const cells = ['N','S','E','W'].map(discover); const f = k => cells.map(c=>c.attrs[k]);
    ok(new Set(cells.map(c=>c.biome)).size >= 2 || new Set(f('fert')).size >= 3, 'all regions are alike'); ok(Math.max(...f('timber')) - Math.min(...f('timber')) > 0.1 || Math.max(...f('fert')) - Math.min(...f('fert')) > 0.1, 'no real differences');
    ok(cells.every(c=>c.sites >= 0 && c.name), 'regions have no names or land figures');
  });
  test('CE9', 'Discovery is not annexation', ()=>{ const c = discover('E'), [x0,y0,x1,y1] = cellRect(c.cx, c.cy); ok(!CIV_CLAIMED.includes(c.state), `state ${c.state}`); ok(!civClaimedTile(x0+3, y0+3), 'the land is already ours'); });
  const annexSetup = (op) => { const c = discover('W'); ok(c.state==='annexable', 'region should border home land'); C().gov.stage = 5; S.citizens.filter(isAdult).forEach(v=>{ cogOf(v).op.expansion = op; cogOf(v).op.nature = op<0 ? 80 : 0; }); civProposeAnnex(c, adults()[0], 'test'); S.world.proposal.day = civDay()-3; civAnnexVote(); return c; };
  test('CE10', 'Annexation can pass', ()=>{ const c = annexSetup(100); ok(CIV_CLAIMED.includes(c.state), `vote failed: ${JSON.stringify(S.world.votes)}`); ok(S.world.votes[0].yes > S.world.votes[0].no, 'no majority'); });
  test('CE11', 'Annexation can fail', ()=>{ const c = annexSetup(-100); ok(c.state==='annexable', `state ${c.state}`); ok(S.world.votes[0] && !S.world.votes[0].passed, 'no failed vote recorded'); });
  test('CE12', 'Annexed land gives room to build', ()=>{
    const c = annexSetup(100), [x0,y0,x1,y1] = cellRect(c.cx, c.cy), mx = Math.round((x0+x1)/2), my = Math.round((y0+y1)/2);
    const site = civFindSite('crude_hut', [mx, my], {maxR:14, anySide:true}); ok(site, 'no site found'); ok(civRegionAt(site.x, site.y)===c, 'the site is not in the new land');
  });
  test('CE13', 'New land brings new resources into the economy', ()=>{
    const c = annexSetup(100), [x0,y0,x1,y1] = cellRect(c.cx, c.cy); const e = ecoCellAt(x0+5, y0+5);
    ok(e && e.region===c.key && (e.fcap + e.gcap + e.fishcap) > 0, 'no forage, game or fish out there');
    const p = adults()[0]; p.rt.x = x0+5; p.rt.y = y0+5; const t = civTarget(p, 'forage'); ok(t.xy && civClaimedTile(t.xy[0], t.xy[1]), 'people cannot work the new land');
  });
  test('CE14', 'Annexed land costs upkeep, more the farther out it is', ()=>{
    money(0); C().gov.treasury = 1000; const c = annexSetup(100); const before = C().gov.treasury; civFrontierDaily();
    ok(C().gov.treasury < before && c.upkeep > 0, 'no upkeep paid'); const far = Object.assign({}, c, {cx:c.cx-2}); ok(civAnnexUpkeep(far) > civAnnexUpkeep(c), 'distance costs nothing');
  });
  test('CE15', 'People form opinions about expansion', ()=>{
    stock(); cleanSlate(); const [cx, cy] = C().center, w = adults().find(c=>!c.office); put(w, cx, cy); const before = cogOf(w).op.expansion||0;
    const r = civLaunchExpedition('N', {k:'player'}); const e = r.e; S.minute = e.back*DAY + 60; put(w, cx, cy); civFrontierDaily();
    const M = cogOf(w); ok(e.status==='failed' || M.op['region:'+cellOf(cellKey(e.cx,e.cy)).id]!==undefined || (M.op.expansion||0)!==before, 'hearing about the frontier changed nothing');
    const c2 = annexSetup(60); ok(S.citizens.filter(isAdult).some(v=>cogOf(v).mems.some(x=>x.type==='vote')), 'nobody remembers the annexation vote');
  });
  test('CE16', 'The frontier moves outward after annexation', ()=>{
    const c = annexSetup(100); ok(CIV_CLAIMED.includes(c.state), 'not annexed');
    const next = frontierCells('W'); ok(next.some(t=>ringOf(t.cx, t.cy) > ringOf(c.cx, c.cy)), 'nothing further out to explore');
    const t = next.find(t=>ringOf(t.cx,t.cy) > ringOf(c.cx,c.cy) && Math.abs(t.cx-c.cx)+Math.abs(t.cy-c.cy)===1); if (t){ const far = civDiscoverRegion(t.cx, t.cy, [], 'test'); ok(far.state==='annexable', 'land beyond the new district cannot be claimed'); }
  });
  test('CS1', 'Older civilization saves load with the new systems added', ()=>{
    days(2); const sv = {state: JSON.parse(JSON.stringify(S))}, m0 = S.minute; delete sv.state.world; sv.state.citizens.forEach(c=>{ delete c.mind; delete c.civ.legal; }); sv.state.civ.justice.cases.forEach(k=>{ delete k.statements; delete k.proof; });
    const names = sv.state.citizens.map(c=>c.name).join(); S = sv.state; civBootLoad(); days(3);
    ok(S.world && S.world.cells, 'no frontier after loading'); ok(S.citizens.map(c=>c.name).join().startsWith(names.slice(0, 40)), 'citizens changed'); ok(!(S.civ.errors||[]).length, 'errors: '+JSON.stringify((S.civ.errors||[])[0]));
    const bad = S.citizens.map(c=>c.mind && c.mind.mems && c.mind.mems.find(m=>m.t < m0 - 5)).filter(Boolean)[0]; ok(!bad, 'memories were invented for the past: '+JSON.stringify(bad));
  });
  test('UI1', 'The side menu groups the tabs and the view can be maximised', ()=>{
    document.querySelector('#groups [data-g=civic]').click(); ok(ui.group==='civic' && ['laws','justice'].includes(ui.tab), 'group did not open a civic tab');
    ok(document.querySelector('#tabs [data-p=justice]').classList.contains('ing') && !document.querySelector('#tabs [data-p=people]').classList.contains('ing'), 'wrong tabs shown');
    document.querySelector('#tabs [data-p=justice]').click(); ok($('p-justice').classList.contains('on') && $('phead').textContent.length > 10, 'no justice panel or help line');
    $('zMax').click(); ok(document.body.classList.contains('maxed'), 'not maximised'); $('zPanel').click(); ok(document.body.classList.contains('drawer'), 'panel drawer did not open'); $('zMax').click(); ok(!document.body.classList.contains('maxed') && !document.body.classList.contains('drawer'), 'did not restore');
  });

  // ======================= CONSTRUCTION AND HOUSING =======================
  const homeProject = (h, done) => { const site = civFindSite('crude_hut', C().center, {margin:1}); const p = civStartProject('crude_hut', site, {k:'hh', id:h.id}, {purpose:'home', forHH:h.id}); if (done!==false) for (const g in p.need) p.have[g] = p.need[g]; return p; };
  const homeless = h => { const s = h.home && C().structs[h.home]; if (s) s.occ = null; h.home = null; hhMembers(h).forEach(m=>m.home = 'loc_town_square'); };
  test('CH1', 'Construction companies take on stalled projects and are paid for the work', ()=>{
    money(500); const [boss, hand, owner] = adults().slice(0,3); const o = civNewOrg('sole', 'Test Builders', [boss], {biz:'builder_co'}); o.cash = 50; civHire(o, civPostJob(o, 'builder', 5), hand);
    const h = hhOf(owner), p = homeProject(h); p.lastProg = civDay() - 10; p.started = civDay() - 10; owner.wallet = 400;
    civBuildContractsDaily(); ok(p.contractor===o.id, 'no contractor took the job');
    const cash = o.cash, done = p.done; CIV_WORK.build(hand, {proj:p.id, acc:120}, 2); ok(p.done > done, 'no work done'); ok(o.cash > cash, 'the company was not paid');
    ok(civJobTask(hand, civJobOf(hand))==='build', 'the builder was not sent to the site');
  });
  test('CH2', 'People build their own home in the evening after work', ()=>{
    const c = adults(x=>x.age<50)[0], h = hhOf(c); h.store.grain = 2000; const p = homeProject(h);
    const plan = civPlanDay(c, civDay()); ok(plan.blocks.some(b=>b.task==='build' && b.proj===p.id && b.s >= 17*60), 'no evening building');
  });
  test('CH3', 'Neighbours hold a building bee for a family with no roof', ()=>{
    const [needy] = Object.values(C().hh).filter(h=>hhAdults(h).length); homeless(needy); const p = homeProject(needy);
    const helper = adults(x=>hhOf(x)!==needy)[0]; helper.personality.agreeableness = 0.9; hhOf(helper).store.grain = 3000; C().commons.grain = 5000; S.minute = Math.floor(S.minute/DAY)*DAY + 60*DAY; // spring, plenty of food
    Object.values(C().projects).forEach(q=>{ if (q!==p && civProjectsFor(helper).includes(q)) delete C().projects[q.id]; });
    ok(civWillHelp(helper, p) > 5, 'the neighbour is not willing'); ok(civBuildChoice(helper)===p, 'the neighbour did not choose to help');
  });
  test('CH4', 'Builders make do when a material cannot be had', ()=>{
    const h = Object.values(C().hh)[0], p = homeProject(h); p.need.metal = 6; p.wait = {metal: civDay() - 20};
    civMaterialsDaily(); ok(!p.need.metal, 'still waiting for metal nobody makes'); ok(p.need.wood > STRUCTURES.crude_hut.mat.wood, 'no substitute taken');
  });
  test('CH5', 'A household with money buys the materials it lacks', ()=>{
    money(0); const c = adults()[0], h = hhOf(c); h.store.grain = 3000; c.wallet = 500; const p = homeProject(h, false); p.wait = {thatch: civDay() - 5, wood: civDay() - 5};
    const seller = adults()[5]; C().econ.listings.push({id:'l1', g:'thatch', q:20, price:1, seller:{k:'person', id:seller.id}, day:civDay()});
    civMaterialsDaily(); ok((p.have.thatch||0) > 0, 'nothing bought');
  });
  test('CH6', 'A stalled home for a family with no roof is taken over by the settlement', ()=>{
    const h = Object.values(C().hh)[0]; homeless(h); const p = homeProject(h); p.started = civDay() - 90; p.lastProg = civDay() - 60;
    civStalledMonthly(); ok(C().projects[p.id] && ['community','gov'].includes(p.owner.k), 'not taken over');
    const up = homeProject(Object.values(C().hh)[1]); up.upgradeOf = 'x'; up.started = civDay()-90; up.lastProg = civDay()-60; civStalledMonthly(); ok(!C().projects[up.id], 'a stalled upgrade was not given up');
  });
  test('CH7', 'Property whose owner is gone returns to the settlement', ()=>{
    const h = Object.values(C().hh).find(x=>x.home && C().structs[x.home]), s = C().structs[h.home];
    hhMembers(h).slice().forEach(m=>civRemovePerson(m, 'left', 'moved away'));
    civReclaimDaily(); ok(['community','gov'].includes(s.owner.k), `owner ${JSON.stringify(s.owner)}`);
  });
  test('CH8', 'A home left empty and unsold returns to the settlement', ()=>{
    money(0); const h = Object.values(C().hh).find(x=>x.home && C().structs[x.home]), s = C().structs[h.home]; s.owner = {k:'person', id:hhAdults(h)[0].id};
    const other = Object.values(C().hh).find(x=>x!==h); hhMembers(h).forEach(m=>civJoinHH(m, other)); s.occ = null; s.forSale = true; s.emptySince = civDay() - 25;
    civReclaimDaily(); ok(['community','gov'].includes(s.owner.k) && !s.forSale, 'still for sale');
  });
  test('CH9', 'Town-owned homes shelter families with no roof, children first, rent-free', ()=>{
    const hs = Object.values(C().hh).filter(x=>x.home && C().structs[x.home] && x.members.length >= 3); const [a, b] = hs; const s = C().structs[a.home];
    homeless(a); homeless(b); s.owner = {k:'community'}; s.occ = null; const kids = h => hhMembers(h).filter(m=>!isAdult(m)).length;
    civShelterNeedy(); const housed = [a, b].filter(h=>h.home===s.id);
    ok(housed.length >= 1, 'nobody was housed'); ok(housed.includes(kids(a) >= kids(b) ? a : b), 'the family with more children was not first'); ok(s.shelter && !s.rentK, 'they pay rent');
  });
  test('CH10', 'A single person with no roof is taken in by friends with room', ()=>{
    const host = Object.values(C().hh).find(h=>h.home && C().structs[h.home] && STRUCTURES[C().structs[h.home].def].home.cap - S.citizens.filter(c=>c.home===h.home).length >= 1);
    ok(host, 'no household with room'); const lone = adults(x=>hhOf(x)!==host)[0]; const nh = civNewHH('Lone', null); civJoinHH(lone, nh); nh.homelessSince = civDay() - 3;
    hhAdults(host).forEach(m=>{ getRel(m, lone.id).affinity = 60; });
    civShelterNeedy(); ok(hhOf(lone)!==nh && lone.home && C().structs[lone.home], 'nobody took them in'); // family first, else the friends
  });
  test('CH11', 'Food comes first: no hiring away from food when stores are low, and less building on an empty stomach', ()=>{
    money(0); const [a] = adults(); const o = civNewOrg('sole', 'Test Tailor', [a], {biz:'tailor'}); o.cash = 5000; o.profitAvg = 20;
    Object.values(C().hh).forEach(h=>{ for (const g of CIV_FOODS) delete h.store[g]; }); C().commons = {};
    const before = C().jobs.length; civEconWeekly(); ok(!C().jobs.some(j=>j.org===o.id && j.open), 'a tailor hired while people went hungry');
    const c = adults(x=>x!==a)[0], h = hhOf(c); const p = homeProject(h); const low = CIV_TASK_VALUE.build(c, h, 4); h.store.grain = 4000; const high = CIV_TASK_VALUE.build(c, h, 4); ok(low < high, 'building did not give way to hunger');
  });

  // ============================ LIGHTING AND TRANSPORT ============================
  const fed = () => Object.values(C().hh).forEach(h=>{ h.store.grain = 2000; });
  const lightAt = (def) => { const site = civFindSite(def, C().center, {margin:0}); return civAddStruct(def, site.x, site.y, {k:'community'}); };
  test('CT1', 'Night is dim and blue, never pitch black', ()=>{
    const deep = darknessAt(0), storm = deep + 0.26;
    ok(nightShade(deep) <= 0.5 && nightShade(storm) <= 0.5, `the night overlay hides ${Math.round(nightShade(storm)*100)}% of the scene`);
    ok(nightShade(deep) > 0.3, 'night is not dark at all'); ok(nightShade(darknessAt(12*60)) === 0, 'midday is shaded');
  });
  test('CT2', 'The settlement lights its paths with torches', ()=>{
    fed(); ok(civBestLight()==='torch_post', `first light is ${civBestLight()}`);
    civLightingDaily(); const p = civProjects().find(x=>STRUCTURES[x.def].light); ok(p && p.def==='torch_post', 'no torch post started');
    ok([[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>[T.PATH,T.PLAZA].includes(tileAt(p.x+a,p.y+b)) || BUILDINGS.some(B=>B.door[0]===p.x+a && B.door[1]===p.y+b)), 'the light is not beside a path or door');
    const s = finish(p); ok(STRUCTURES[s.def].light && civLitAt(s.x, s.y) && civLitAt(s.x+2, s.y), 'the torch lights nothing');
    ok(!civLitAt(s.x+20, s.y+20) || civLamps().length > 1, 'the torch lights the whole map');
  });
  test('CT3', 'Better lights need both the technique and a bigger town', ()=>{
    const c = adults()[0]; know(c, ['pottery']); C().stageLabel = 'Camp'; ok(civBestLight()==='torch_post', 'oil lanterns in a camp');
    C().stageLabel = 'Hamlet'; ok(civBestLight()==='oil_lantern', 'no oil lanterns in a hamlet that knows pottery');
    know(c, ['gas_lighting']); ok(civBestLight()==='oil_lantern', 'gas lamps in a hamlet'); C().stageLabel = 'Village'; ok(civBestLight()==='gas_lamp', 'no gas lamps in a village with gas lighting');
    know(c, ['electricity']); C().stageLabel = 'Town'; ok(civBestLight()==='gas_lamp', 'electric lights without a power station');
    lightAt('power_plant'); ok(civBestLight()==='electric_lamp', 'no electric lights with a power station');
  });
  test('CT4', 'Old lights are replaced by better ones where they stand', ()=>{
    fed(); const old = lightAt('torch_post'); know(adults()[0], ['pottery']); C().stageLabel = 'Hamlet';
    civLightingDaily(); const p = civProjects().find(x=>x.upgradeOf===old.id); ok(p && p.def==='oil_lantern', 'the torch was not replaced');
    const s = finish(p); ok(!C().structs[old.id] && s.def==='oil_lantern' && s.x===old.x && s.y===old.y, 'the lantern is not where the torch was');
  });
  test('CT5', 'Lights are kept in repair, and lit streets help witnesses at night', ()=>{
    const s = lightAt('torch_post'); S.minute = civDay()*DAY + 23*60;
    ok(!civDarkAt(s.x, s.y), 'a lit street counts as dark'); ok(civDarkAt(s.x+25, s.y+25) || civLitAt(s.x+25, s.y+25), 'an unlit street counts as lit');
    s.cond = 20; s.status = 'abandoned'; for (let i=0;i<40;i++){ S.minute += DAY; civLightingDaily(); }
    ok(s.status==='active' && s.cond > 20, `the light was left to rot (${s.status}, ${Math.round(s.cond)}%)`);
  });
  test('CT6', 'New techniques put new vehicles about town', ()=>{
    ok(!civVehicleOK('horse') && !civVehicleOK('plane'), 'vehicles before their techniques');
    const c = adults()[0]; know(c, ['riding','wheel','boatbuilding']); C().stageLabel = 'Town'; civSyncVehicles();
    ['horse','cart','boat'].forEach(k=>ok(VEHICLES.some(v=>v.kind===k), 'no '+k));
    know(c, ['aviation']); ok(!civVehicleOK('plane'), 'planes without an airfield'); lightAt('airfield'); civSyncVehicles(); ok(VEHICLES.some(v=>v.kind==='plane'), 'no aeroplane');
    know(c, ['railways']); const st = lightAt('station'); st.meta.track = civTrack(st); if (st.meta.track){ civSyncVehicles(); ok(VEHICLES.some(v=>v.kind==='train'), 'no train at the station'); }
    const h = VEHICLES.find(v=>v.kind==='horse'), x0 = h.x, y0 = h.y; h.wait = 0; S.minute = civDay()*DAY + 12*60; for (let i=0;i<60;i++) civUpdateVehicles(0.1, 1); ok(h.x!==x0 || h.y!==y0, 'the rider does not move');
    ok(tileAt(Math.floor(h.x/TILE), Math.floor(h.y/TILE))!==T.WATER, 'the rider rode into the water');
  });
  test('CT7', 'Stables, boathouses and stations are built once the technique is known', ()=>{
    fed(); know(adults()[0], ['boatbuilding']); C().stageLabel = 'Hamlet'; civTransportWeekly();
    const p = civProjects().find(x=>x.def==='boathouse'); ok(p, 'no boathouse started'); ok(civNearWater(p.x, p.y, p.w, p.h, 2), 'the boathouse is not by the water');
  });
  test('CT8', 'Better transport speeds up journeys and fills caravans', ()=>{
    const s0 = civTravelSpeed(), h0 = civHaulBonus(); know(adults()[0], ['wheel','riding','wagons']);
    ok(civTravelSpeed() > s0 && civHaulBonus() > h0, 'horses and wagons change nothing');
  });
  test('CT9', 'Street lights and vehicles have 3D models', async ()=>{
    await three(); ['torch','lantern','gas','electric'].forEach(k=>{ const m = civLightMesh(k); ok(m.isMesh && m.children.length, k+' has no lamp head'); });
    ['cart','horse','wagon','boat','ship','steamship','car','truck','train','plane'].forEach(k=>{ const g = r3VehMesh({kind:k, variant:1}); ok(g.isGroup && g.children.length, k+' has no model'); });
  });

  // ============================ SAVING, AWAY TIME AND HD GRAPHICS ============================
  test('SV1', 'The autosave goes to IndexedDB, and a saved city can be listed, read back and resumed', async ()=>{
    days(1); saveGame(true); await new Promise(r=>setTimeout(r, 1500));
    const rec = await SaveDB.get('autosave'); ok(rec && rec.data, 'no autosave in IndexedDB'); const sv = await SaveDB.read(rec); ok(sv && sv.state && sv.state.minute===S.minute, 'the autosave does not hold this town');
    const json = savePayload(); await SaveDB.put('city:t1', Object.assign(await SaveDB.record(json, cityMeta(Date.now())), {id:'city:t1', name:'Test'}));
    const list = await SaveDB.list('city:'); ok(list.some(c=>c.name==='Test' && c.pop===S.citizens.length), 'the saved city is not listed');
    const back = await SaveDB.read(await SaveDB.get('city:t1')); ok(back.state.citizens.length===S.citizens.length && back.state.civ.seed===S.civ.seed, 'the saved city did not read back');
    const loaded = await loadGame(); ok(loaded && loaded.state.minute===S.minute, 'the newest save was not picked at start');
  });
  test('SV2', 'Away time is not capped: every missed day is simulated', async ()=>{
    const m0 = S.minute; await new Promise(res=>catchUp(9*DAY, 'test', res)); overlay('');
    ok(S.minute - m0 >= 9*DAY, `only ${((S.minute-m0)/DAY).toFixed(1)} of 9 days were simulated`);
  });
  test('SV3', 'Daily plans are spread over the first minutes after midnight, not made all at once', ()=>{
    days(1 - (S.minute % DAY)/DAY); const d = dayOf(S.minute); simTick(); ok(S.citizens.filter(c=>c.planFor===d).length < S.citizens.length, 'everyone planned at midnight');
    for (let i=0;i<20;i++) simTick(); ok(S.citizens.every(c=>c.planFor===d || !c.plan), 'someone was left without a plan for the day');
  });
  test('HD1', 'The HD world builds: blended terrain, water, trees, rocks, buildings, grass and crops', async ()=>{
    await three(); R3.renderer = null; HD.q = 1;
    hdTerrainData(); ok(HD.td && HD.td.image.width===MW, 'no terrain data'); const terr = hdTerrain(); ok(terr.isMesh && terr.geometry.attributes.position.count > MW*MH, 'no terrain mesh');
    ok(hdWater().isMesh, 'no water'); const trees = hdTrees(); ok(trees.children.some(o=>o.isInstancedMesh && o.material.alphaTest > 0), 'no leaf-card trees');
    const b = BUILDINGS[0]; const g = hdBuilding(b); ok(g.children.length >= 5 && g.userData.frontMat, 'the building has no detail');
    ok(g.children.some(o=>o.material && o.material.normalMap), 'no normal-mapped materials on the building');
    HD_WIND.uCam.value = new THREE.Vector3(); const ch = hdBuildChunk(Math.floor(S.civ.center[0]/HD_CH), Math.floor(S.civ.center[1]/HD_CH)); ok(ch.children.length, 'no grass around the settlement');
    ok(hdGroundWorks().isGroup, 'no crops, fences or bridges');
  });

  async function run(which){
    const out = [];
    for (const t of TESTS){ if (which && !(Array.isArray(which) ? which.includes(t.id) : t.id===which)) continue;
      const t0 = performance.now();
      try { await t.fn(); out.push({id:t.id, name:t.name, pass:true, ms:Math.round(performance.now()-t0)}); }
      catch(e){ out.push({id:t.id, name:t.name, pass:false, error:e.message, stack:(e.stack||'').split('\n').slice(0,3).join(' | ')}); } }
    return out;
  }
  window.CivTests = {list:()=>TESTS.map(t=>({id:t.id, name:t.name, seed:t.seed})), run};
})();
