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
    ['cow','pig','sheep','chicken','horse','dog','cat','goat','deer','boar','rabbit','wolf','bird','fish'].forEach(k=>{ const g = an3Build(k, 0); ok(g.isGroup && g.userData.core && g.userData.core.isMesh, k+' is not a 3D model'); if (!['bird','fish'].includes(k)) ok(g.userData.legs.length===4, k+' has no legs'); if (k==='bird') ok(g.userData.wings, 'birds have no wings'); });
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
    saveGame(true); const sv = JSON.parse(localStorage.getItem('pixeltown.save.v2')); const k0 = sv.state.citizens.find(x=>x.id===kids[0].id);
    ok(JSON.stringify(k0.civ.genes)===JSON.stringify(kids[0].civ.genes) && k0.look.hair, 'appearance was not saved');
    // grown bodies and old age show in the 3D figure
    const kid = kids[0]; kid.age = 3; const g1 = lpBuild(kid); kid.age = 30; kid.profession = 'Settler'; const g2 = lpBuild(kid); kid.age = 75; const g3 = lpBuild(kid);
    ok(g1.scale.y < g2.scale.y*0.8, 'children are not smaller'); ok(g3.userData.stoop > 0.2, 'the old do not stoop');
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
