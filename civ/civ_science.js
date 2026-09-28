/* =====================================================================
   Pixel Town — civilization mode: science and resources
   Minerals, oil and gas lie hidden; prospectors find them with knowledge, clues and luck.
   A find is not a mine: someone must claim it, fund it, equip it, staff it and build it.
   Research follows the scientific method, and a careless experiment can make a wrong idea popular.
   ===================================================================== */

// ---------- hidden deposits ----------
function civDepositsInit(){
  const C = S.civ, r = crand('deposits'); C.deposits = [];
  const tiles = pred => { const out = []; for (let y=1;y<OH-1;y++) for (let x=1;x<OW-1;x++) if (pred(x,y)) out.push([x,y]); return out; };
  const nearT = (x,y,t,rad) => { for (let j=-rad;j<=rad;j++) for (let i=-rad;i<=rad;i++) if (tileAt(x+i,y+j)===t) return true; return false; };
  const pools = {
    rock: tiles((x,y)=>MAP[y][x]===T.ROCK || (MAP[y][x]!==T.WATER && nearT(x,y,T.ROCK,1))),
    hill: tiles((x,y)=>MAP[y][x]!==T.WATER && (y<22 || x>60) && nearT(x,y,T.ROCK,4)),
    stream: tiles((x,y)=>MAP[y][x]!==T.WATER && nearT(x,y,T.WATER,1)),
    flat: tiles((x,y)=>MAP[y][x]===T.GRASS && !nearT(x,y,T.WATER,3)),
    seep: tiles((x,y)=>(MAP[y][x]===T.GRASS||MAP[y][x]===T.TREE) && (x>54 || y>28))
  };
  MINERALS.forEach(M=>{
    const n = Math.max(M.freq>=3?1:0, Math.round(M.freq*(0.4 + r()*1.2)));
    for (let i=0;i<n;i++){ const pool = pools[M.clue]; if (!pool.length) continue; const [x,y] = pool[Math.floor(r()*pool.length)];
      const depth = M.depth[0] + Math.floor(r()*(M.depth[1]-M.depth[0]+1));
      const size = Math.round((M.precious ? 60+r()*340 : M.fluid ? 3000+r()*18000 : 400+r()*2600) * (r()<0.08 ? 4 : 1) * ((C.land||{}).ore||1));
      C.deposits.push({id:'dp_'+(++C.dSeq), min:M.id, x, y, size, left:size, depth, purity:+(0.3+r()*0.7).toFixed(2), access:+(M.clue==='rock'?0.3+r()*0.5:0.5+r()*0.5).toFixed(2),
        known:false, suspected:false, found:null, by:null, claim:null, mine:null, seep: M.clue==='seep' && r()<0.5}); }
  });
}
function civDepositAt(x, y, rad){ return S.civ.deposits.filter(d=>Math.hypot(d.x-x, d.y-y) <= (rad||0)); }
// the depth a prospector's methods can reach
function civReach(c){ let r = 2; if (civTechKnown('quarrying')) r = 3; if (civTechKnown('mining')) r = 4; if (civTechKnown('explosives')) r = 5; if (civTechKnown('steam_power') || civTechKnown('drilling')) r = 6; return r; }
CIV_TARGETS.prospect = c => {
  const r = mapRand(hash(c.id+'pr'+civDay()));
  // a geologist reads the land: outcrops, hills and streams; a novice wanders
  const g = kn(c,'geology'), belief = (c.civ.beliefs.th_ore_veins||0) > 0.5, dowse = (c.civ.beliefs.th_dowsing||0) > 0.5;
  let best = null, bs = -1;
  for (let k=0;k<40;k++){ const x = clamp(Math.round(c.rt.x + (r()-0.5)*60), X0+1, X0+MW-2), y = clamp(Math.round(c.rt.y + (r()-0.5)*40), Y0+1, Y0+MH-2); if (!civClaimedTile(x,y)) continue; if (!walkable(x,y)) continue;
    let s = r()*(dowse ? 1 : 0.4); let rock = 0, water = 0; for (let j=-3;j<=3;j++) for (let i=-3;i<=3;i++){ const t = tileAt(x+i,y+j); if (t===T.ROCK) rock++; if (t===T.WATER) water++; }
    s += (rock*0.06 + water*0.03) * (g/30 + (belief?0.5:0)); if (S.civ.prospected && S.civ.prospected[Math.floor(x/5)+','+Math.floor(y/5)]) s -= 0.6;
    if (s>bs){ bs = s; best = [x,y]; } }
  return best ? {loc:'wild', xy:best, note:'Prospecting for minerals', extra:{}} : null;
};
CIV_TASK_VALUE.prospect = (c) => (c.personality.openness*3 + cog(c,'risk')*3 + kn(c,'geology')/10 + (civHasGoal(c,'wealth')?2:0) + (S.civ.boom && civDay()-S.civ.boom.day<90 ? 6 : 0)) * (civMoneyOn() ? 1.2 : 0.7);
CIV_WORK.prospect = (c, b, hrs) => {
  if (!b.xy) return {value:0};
  const C = S.civ, [x, y] = b.xy, reach = civReach(c);
  C.prospected = C.prospected || {}; C.prospected[Math.floor(x/5)+','+Math.floor(y/5)] = civDay();
  let found = null;
  civDepositAt(x, y, 5).forEach(d=>{
    if (d.known) return;
    const M = MIN[d.min]; if (d.depth > reach && !(M.fluid && d.seep)) return;
    const clue = (M.clue==='rock' && tileAt(d.x,d.y)===T.ROCK) || d.seep ? 1.4 : 1;
    const theory = (c.civ.beliefs.th_ore_veins||0) > 0.5 ? 1.25 : 1, dowse = (c.civ.beliefs.th_dowsing||0) > 0.5 ? 0.8 : 1;
    const p = (0.05 + kn(c,'geology')/140 + sk(c,'geology')/220) * clue * theory * dowse * (1 - (d.depth-1)*0.12) * Math.min(1.5, hrs/3) * (0.7 + rnd()*0.6);
    if (rnd() < p && !found) found = d;
  });
  c.civ.skill.geology = Math.min(100, sk(c,'geology') + hrs*0.4);
  if (!found){ return {value:0.5, why:'found nothing'}; }
  civDiscover(found, c);
  return {value: MIN[found.min].precious ? 60 : 15, why:null};
};
function civDiscover(d, c, how){
  const C = S.civ, M = MIN[d.min];
  if (M.fluid && !civTechKnown('drilling')){ if (!d.suspected){ d.suspected = true; d.found = civDay(); d.by = c.id; chronicle(`${c.name} found black ooze seeping from the ground. Nobody knows what it is good for.`, 5, '🛢️', 'resources'); ev('seeps_found'); } return; }
  d.known = true; d.found = civDay(); d.by = c ? c.id : null;
  const size = d.size > 6000 ? 'a huge' : d.size > 1500 ? 'a large' : d.size > 300 ? 'a' : 'a small';
  chronicle(`${c ? c.name : 'Drillers'} ${how||'found'} ${size} deposit of ${M.label.toLowerCase()}${M.fluid?'':` (${Math.round(d.purity*100)}% pure, ${['','near the surface','shallow','fairly deep','deep','very deep','far underground'][d.depth]})`}!`, M.precious||M.fluid ? 9 : 6, M.precious ? '💎' : M.fluid ? '🛢️' : '⛏️', 'resources');
  ev('deposits_found'); ev('found_'+d.min); if (M.precious) ev('precious_found'); if (M.fluid) ev(d.min+'_found');
  if (c){ c.civ.respect += M.precious ? 6 : 2; remember(c, `I found ${M.label.toLowerCase()}!`, 9); if (!c.civ.goals.some(g=>g.kind==='wealth')) civAddGoal(c, 'wealth'); }
  // a strike: land near it is suddenly worth a fortune, and word spreads
  if (M.precious || M.fluid){ C.boom = {x:d.x, y:d.y, day:civDay(), min:d.min}; S.week.society.push(`${M.label} strike`); civProblem('growth', 3); }
  civClaim(d, c ? {k:'person', id:c.id} : null);
}
// a claim is only as good as the settlement's rules: a register if there is one, a marked stake if not
function civClaim(d, who){
  if (!who || d.claim) return;
  const reg = !!S.civ.gov.laws.land_registry;
  if (reg && civMoneyOn()){ const fee = 5*(S.civ.econ.level||1); if (!civMoveMoney(civOwnerPurse(who), {k:'gov'}, fee, 'claim fee')) return; }
  d.claim = {who, day:civDay(), registered:reg};
  const c = who.k==='person' && alive(who.id); if (c) remember(c, `I staked a claim on the ${MIN[d.min].label.toLowerCase()}.`, 7);
  // rivals may dispute an unregistered claim on something valuable
  if (!reg && MIN[d.min].precious && rnd()<0.3){ const rival = S.citizens.find(o=>o!==c && isAdult(o) && o.traits.includes('Greedy')); if (rival && c){ civCaseFile('civil', 'property', {k:'person', id:rival.id}, {k:'person', id:c.id}, `who owns the ${MIN[d.min].label.toLowerCase()} claim`, 20); ev('property_disputes'); } }
}
// ---------- mines: a small pit by hand, or a company operation ----------
function civMinesDaily(){
  const C = S.civ;
  C.deposits.filter(d=>d.known && d.claim && !d.mine && !civProjects().some(p=>p.meta && p.meta.deposit===d.id)).forEach(d=>{
    const M = MIN[d.min], who = d.claim.who, c = who.k==='person' ? alive(who.id) : null;
    if (M.fluid){ const o = who.k==='org' ? C.orgs[who.id] : null; if (o && o.cash > 100 && civTechKnown('drilling')){ const site = civFindSite('oil_well', [d.x, d.y], {margin:0, maxR:4}); if (site) civStartProject(d.min==='gas'?'gas_well':'oil_well', site, {k:'org', id:o.id}, {org:o.id, meta:{deposit:d.id}, why:`to tap the ${M.label.toLowerCase()}`}); } else if (c && !civHasGoal(c,'start_business') && civMoneyOn()) civAddGoal(c, 'start_business', {biz:'oil_co', task:'mine', deposit:d.id}, BIZ_STEPS); return; }
    // a shallow find and someone who knows how to dig: they do it themselves
    if (c && d.depth<=1 && (sk(c,'mining')>=8 || kn(c,'geology')>=12 || sk(c,'stonework')>=20)){ const site = civFindSite('pit', [d.x, d.y], {margin:0, maxR:3, anySide:true}); if (site){ civStartProject('pit', site, {k:'hh', id:c.civ.hh}, {meta:{deposit:d.id}, why:`${c.name} is digging for ${M.label.toLowerCase()}`}); ev('private_mines'); } return; }
    // otherwise it takes a company: capital, equipment, workers, and the right technique
    if (c && civMoneyOn() && !civHasGoal(c,'start_business') && civTechKnown('mining')) { civAddGoal(c, 'start_business', {biz:'mining_co', task:'mine', deposit:d.id}, BIZ_STEPS); return; }
    const o = who.k==='org' ? C.orgs[who.id] : null;
    if (o && o.status==='active'){ const def = d.depth<=2 && civTechKnown('explosives') ? 'open_pit' : d.depth<=3 && civTechKnown('mining') ? 'mine' : d.depth<=5 && civTechKnown('steam_power') ? 'deep_mine' : d.depth<=1 ? 'pit' : null; if (!def) return; const site = civFindSite(def, [d.x, d.y], {margin:0, maxR:5, anySide:true}); if (site) civStartProject(def, site, {k:'org', id:o.id}, {org:o.id, meta:{deposit:d.id}, why:`to mine ${M.label.toLowerCase()}`}); }
  });
  // companies take over the claims of their founders
  civOrgs(o=>o.biz==='mining_co'||o.biz==='oil_co').forEach(o=>{ C.deposits.filter(d=>d.known && d.claim && d.claim.who.k==='person' && o.founders.includes(d.claim.who.id) && !d.mine).forEach(d=>{ d.claim = {who:{k:'org', id:o.id}, day:civDay(), registered:d.claim.registered}; }); });
  // wildcatters drill test wells where geology suggests oil
  civOrgs(o=>o.biz==='oil_co' && o.cash > 80).forEach(o=>{ if (civProjects().some(p=>p.def==='test_well' && p.owner.id===o.id) || civDay()%7!==hash(o.id)%7) return;
    const geo = Math.max(0, ...o.staff.map(alive).filter(Boolean).map(x=>kn(x,'geology'))), theory = civTheoryAccepted('th_oil_origin');
    const sus = C.deposits.filter(d=>MIN[d.min].fluid && d.suspected && !d.known)[0];
    const [tx, ty] = sus && rnd() < 0.5 + (theory?0.3:0) ? [sus.x + Math.round((rnd()-0.5)*(8 - geo/10)), sus.y + Math.round((rnd()-0.5)*(6 - geo/12))] : [60+Math.floor(rnd()*45), 22+Math.floor(rnd()*26)];
    const site = civFindSite('test_well', [clamp(tx,2,OW-3), clamp(ty,2,OH-3)], {margin:0, maxR:4, anySide:true}); if (site){ o.cash -= 20; civStartProject('test_well', site, {k:'org', id:o.id}, {org:o.id, meta:{test:true}, why:'an exploratory well'}); ev('test_wells'); } });
}
function civOnStructBuiltScience(s, p){
  const D = STRUCTURES[s.def];
  if (D.drill){ const hit = civDepositAt(s.x, s.y, 3).find(d=>MIN[d.min].fluid);
    if (hit){ civDiscover(hit, alive((S.civ.orgs[s.org]||{}).mgr) || null, 'struck'); hit.claim = {who:s.owner, day:civDay(), registered:!!S.civ.gov.laws.land_registry}; ev('wells_struck'); }
    else { chronicle(`${s.name} came up dry.`, 6, '🕳️', 'resources'); ev('dry_wells'); const o = S.civ.orgs[s.org]; if (o) o.memory.investments.push({day:civDay(), kind:'dry well', at:[s.x,s.y]}); }
    civRemoveStruct(s, 'demolish'); return; }
  if (D.mine && p.meta && p.meta.deposit){ const d = S.civ.deposits.find(x=>x.id===p.meta.deposit); if (d){ d.mine = s.id; s.meta.deposit = d.id; ev('mines_built'); if (p.owner.k!=='org') ev('private_mines_built'); } }
}
CIV_TARGETS.mine = c => { const m = civMineFor(c); if (!m) return null; const L = LOC[m.id]; return {loc:m.id, xy: L && L.door ? L.door : [m.x, m.y+m.h], note:`Mining at ${m.name}`, extra:{mine:m.id}}; };
function civMineFor(c){ return civStructsOf(s=>STRUCTURES[s.def].mine && s.meta.deposit && s.status==='active' && (civOwnedBy(s.owner, c) || (s.org && c.civ.employer===s.org)))[0] || null; }
CIV_TASK_VALUE.mine = (c) => { const m = civMineFor(c); if (!m) return 0; const d = S.civ.deposits.find(x=>x.id===m.meta.deposit); return d ? 4*CG[MIN[d.min].good].v*d.purity : 0; };
CIV_WORK.mine = (c, b, hrs) => {
  const m = S.civ.structs[b.mine] || civMineFor(c); if (!m) return {value:0, why:'no mine'};
  const d = S.civ.deposits.find(x=>x.id===m.meta.deposit); if (!d || d.left<=0) return {value:0, why:'the seam is worked out'};
  const D = STRUCTURES[m.def], M = MIN[d.min], tools = (hhOf(c)||{store:{}}).store.mtools ? 1.5 : (hhOf(c)||{store:{}}).store.tools ? 1.15 : 1;
  const q = Math.min(d.left, hrs*D.mine.rate*(0.4+sk(c,'mining')/100)*d.purity*d.access*tools*(M.precious ? 0.12 : 1)*(0.8+rnd()*0.4));
  d.left -= q;
  const org = m.org && S.civ.orgs[m.org], dest = org ? org.stock : civOwnerStore(m.owner) || (hhOf(c)||{}).store;
  storeAdd(dest, M.good, +q.toFixed(2)); ev('mined', q); ev('mined_'+M.good, q);
  if (rnd() < 0.002*hrs*(M.fluid?0.3:1)){ c.civ.hurt = 1; chronicle(`${c.name} was hurt in an accident at ${m.name}.`, 5, '⛏️', 'health'); civProblem('injury', 2); }
  if (d.left <= 0){ chronicle(`${m.name} is worked out: the ${M.label.toLowerCase()} is gone.`, 6, '⛏️', 'resources'); m.status = 'abandoned'; }
  return {value: q*CG[M.good].v*(org?0.1:1), why:null};
};
// gold and silver become coin once there is a mint; until then they are traded away
function civPreciousDaily(){
  if (S.civ.econ.money!=='coins' || S.civ.gov.stage<3) return;
  Object.values(S.civ.hh).forEach(h=>{ ['gold','silver'].forEach(g=>{ const q = Math.floor(h.store[g]||0); if (q<1) return; storeTake(h.store, g, q); const coins = civMint(g, q); const p = civOwnerPurse({k:'hh', id:h.id}); civAdjPurse(p, coins); ev('minted', coins); }); });
}

// ---------- research and the scientific method ----------
// observe → ask → hypothesise → experiment → record → replicate → communicate → revise
const RESEARCH_STAGES = ['observe','question','hypothesis','experiment','record','replicate','communicate'];
function civResearchers(){ return S.citizens.filter(c=>isAdult(c) && civTaskAvailable(c, 'research')); }
CIV_TARGETS.research = c => { const lab = civStructsOf(s=>STRUCTURES[s.def].lab || STRUCTURES[s.def].edu>=4)[0]; if (lab) return {loc:lab.id, note:`Research at ${lab.name}`, extra:{}}; return {loc: c.home && LOC[c.home] ? c.home : 'loc_town_square', note:'Tinkering and taking notes', extra:{}}; };
CIV_TASK_VALUE.research = (c) => { const food = hhOf(c) ? hhFoodDays(hhOf(c)) : 0; if (food < 3) return 0; return (c.personality.openness*4 + cog(c,'creativity')*4 + (civHasGoal(c,'discover')?5:0) + (civStructsOf(s=>STRUCTURES[s.def].lab).length?3:0) + (c.civ.employer && S.civ.orgs[c.civ.employer] && S.civ.orgs[c.civ.employer].type==='institute' ? 8 : 0)); };
function civRigor(c){ const labs = civStructsOf(s=>STRUCTURES[s.def].lab).map(s=>STRUCTURES[s.def].lab); return clamp(cog(c,'reasoning')*0.35 + kn(c,'mathematics')/250 + (civTechKnown('writing')?0.1:0) + (civTechKnown('counting')?0.05:0) + (labs.length ? Math.max(...labs)*0.08 : 0) + sk(c,'research')/400, 0.05, 0.95); }
function civPickQuestion(c){
  const C = S.civ;
  // an open theory the researcher is equipped to test, or a practical problem a technique might solve
  const theories = Object.values(THEORIES).filter(T0=>Object.entries(T0.need).every(([k,v])=>kn(c,k)>=v) && !(C.theories[T0.id] && (C.theories[T0.id].accept>0.92 || C.theories[T0.id].accept<0.05)));
  const techs = Object.values(TECHS).filter(T0=>T0.disc && !civTechKnown(T0.id) && Object.entries(T0.need||{}).every(([k,v])=>kn(c,k) >= v*0.85));
  const pickT = theories.length && (rnd()<0.55 || !techs.length);
  if (pickT){ const T0 = theories.sort((a,b)=>(C.theories[a.id]?1:0)-(C.theories[b.id]?1:0) || kn(c,b.disc)-kn(c,a.disc))[0]; return {theory:T0.id, disc:T0.disc, q:`Is it true that ${T0.label.toLowerCase()}?`}; }
  if (techs.length){ const need = (S.civ.spoiled||0) > 40 ? 1 : 0; const T0 = techs.sort((a,b)=>need*((b.store?1:0)-(a.store?1:0)) || kn(c,b.disc)-kn(c,a.disc))[0]; return {tech:T0.id, disc:T0.disc, q:`Could we manage ${T0.label.toLowerCase()}?`}; }
  return null;
}
CIV_WORK.research = (c, b, hrs) => {
  const C = S.civ;
  let R = C.research.find(r=>r.by===c.id && r.status==='active');
  if (!R){ const q = civPickQuestion(c); if (!q) return {value:0, why:'no question worth asking'}; R = {id:'rp_'+(++C.rSeq), by:c.id, org:c.civ.employer||null, disc:q.disc, q:q.q, theory:q.theory||null, tech:q.tech||null, stage:0, prog:0, results:[], started:civDay(), status:'active', rigor:civRigor(c)}; C.research.push(R); if (C.research.length>200) C.research.splice(0, C.research.length-200); ev('research_started'); }
  const speed = hrs*(0.3 + cog(c,'reasoning')*0.4 + cog(c,'creativity')*0.3)*(1 + (civStructsOf(s=>STRUCTURES[s.def].lab).length ? 0.6 : 0));
  R.prog += speed; c.civ.know[R.disc] = +Math.min(100, kn(c,R.disc) + hrs*0.25*(0.5+cog(c,'learning'))).toFixed(2); c.civ.skill.research = Math.min(100, sk(c,'research') + hrs*0.3);
  if (R.prog < 4) return {value:1.5, why:null};
  R.prog = 0; R.stage++;
  const st = RESEARCH_STAGES[Math.min(R.stage, RESEARCH_STAGES.length-1)];
  if (st==='hypothesis' && R.theory){ c.civ.beliefs[R.theory] = c.civ.beliefs[R.theory] ?? (0.45 + (rnd()-0.5)*0.3); }
  if (st==='experiment' || st==='record'){ civExperiment(R, c); }
  if (st==='replicate'){ const peer = civResearchers().find(o=>o!==c && kn(o,R.disc) >= kn(c,R.disc)*0.6); if (peer){ civExperiment(R, peer); R.replicated = peer.id; } }
  if (R.stage >= RESEARCH_STAGES.length-1){ civPublish(R, c); R.status = 'done'; R.ended = civDay(); ev('research_done'); }
  return {value: 5, why:null};
};
function civExperiment(R, c){
  const rig = civRigor(c); R.rigor = rig; ev('experiments');
  if (R.theory){ const T0 = THEORIES[R.theory];
    // careful work mostly finds the truth; sloppy work often "confirms" whatever was expected
    const support = T0.truth ? rnd() < 0.55 + rig*0.4 : rnd() < 0.5 - rig*0.4;
    R.results.push({by:c.id, support, rig:+rig.toFixed(2), day:civDay(), written: civTechKnown('writing')});
    const b = c.civ.beliefs[R.theory] ?? 0.5; c.civ.beliefs[R.theory] = +clamp(b + (support?0.15:-0.15)*(1-stubborn(c)*0.5), 0, 1).toFixed(2);
  } else if (R.tech){ const T0 = TECHS[R.tech];
    const ok = civTechPrereqs(c, R.tech); const p = ok ? 0.35 + rig*0.4 : 0.02;
    R.results.push({by:c.id, support: rnd()<p, rig:+rig.toFixed(2), day:civDay()});
  }
}
// sharing results moves the whole community's view, weighted by how careful and how replicated the work was
function civPublish(R, c){
  const C = S.civ;
  if (R.theory){ const T0 = THEORIES[R.theory], Tt = C.theories[R.theory] = C.theories[R.theory] || {accept:0.2, evidence:0, trials:0, by:[]};
    R.results.forEach(x=>{ const w = 0.3 + x.rig*0.7 + (x.written?0.2:0) + (R.replicated?0.3:0); Tt.evidence += (x.support?1:-1)*w; Tt.trials++; });
    Tt.by = [...new Set(Tt.by.concat(R.results.map(x=>x.by)))];
    const was = Tt.accept; Tt.accept = +(1/(1+Math.exp(-Tt.evidence*0.9 + 0.8))).toFixed(3);
    const printing = civTechKnown('printing') ? 2 : 1;
    S.citizens.filter(o=>isAdult(o) && kn(o, R.disc) >= 5).slice(0, 10*printing).forEach(o=>{ const bo = o.civ.beliefs[R.theory] ?? 0.4; o.civ.beliefs[R.theory] = +clamp(bo + (Tt.accept-bo)*(0.3+cog(o,'reasoning')*0.3)*(1-stubborn(o)*0.5), 0, 1).toFixed(2); });
    if (was < 0.6 && Tt.accept >= 0.6){ chronicle(`${c.name}'s work convinced most people that ${T0.label.toLowerCase()}.${T0.truth?'':' (They are wrong, but the experiments said otherwise.)'}`, 8, '🔬', 'science'); ev('theories_accepted'); if (!T0.truth) ev('false_accepted'); }
    else if (was >= 0.6 && Tt.accept < 0.6){ chronicle(`New experiments overturned the idea that ${T0.label.toLowerCase()}.`, 8, '🔬', 'science'); ev('theories_overturned'); }
    else chronicle(`${c.name} reported on the question "${R.q}" (${R.results.filter(x=>x.support).length} of ${R.results.length} trials in favour).`, 5, '🧪', 'science');
    c.civ.respect += 2;
  } else if (R.tech){
    const wins = R.results.filter(x=>x.support).length;
    if (wins && civTechPrereqs(c, R.tech)){ civLearnTech(c, R.tech, null); if (R.replicated){ const p = alive(R.replicated); if (p) civLearnTech(p, R.tech, c); } ev('techs_by_research'); }
    else chronicle(`${c.name}'s experiments with ${TECHS[R.tech].label.toLowerCase()} did not work out yet.`, 4, '🧪', 'science');
  }
}
function civScienceDaily(){ civMinesDaily(); civPreciousDaily(); }
function civScienceWeekly(){
  const C = S.civ;
  // beliefs spread in conversation too; the stubborn hold on
  Object.keys(C.theories).forEach(id=>{ const Tt = C.theories[id]; Tt.accept = +(Tt.accept*0.995 + (S.citizens.filter(c=>(c.civ.beliefs[id]||0)>0.6).length/Math.max(1,S.citizens.length))*0.005).toFixed(3); });
  // a research institute forms when several people keep doing research and someone can pay for a lab
  const rs = S.citizens.filter(c=>((c.civ.exp.research||{}).n||0) >= 3);
  if (rs.length>=3 && !civOrgs(o=>o.type==='institute').length && civTechKnown('glassmaking')){ const head = rs.sort((a,b)=>sk(b,'research')-sk(a,'research'))[0]; const o = civNewOrg('institute', `${surnameOf(head)} Institute`, [head]); o.staff = rs.slice(0,4).map(x=>x.id); rs.slice(0,4).forEach(x=>x.civ.employer = o.id);
    const site = civFindSite('laboratory', C.center, {margin:1}); if (site) civStartProject('laboratory', site, C.gov.stage>=4 ? {k:'gov'} : {k:'org', id:o.id}, {org:o.id, purpose:'science', why:'for the researchers'}); chronicle(`${head.name} and fellow researchers founded ${o.name}.`, 7, '🔭', 'science'); ev('institutes'); }
}
