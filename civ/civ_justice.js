/* =====================================================================
   Pixel Town — civilization mode: crime, investigation, trials and jail
   The world knows who really did it (k.actual). Nobody in the settlement
   does: witnesses see what they see (and sometimes the wrong face), the
   investigator builds a suspect list from statements, alibis and things
   found, and judges weigh only what is put in front of them. A quarrel at
   the fire is still settled on the spot; only serious or uncertain crimes
   become cases. Institutions appear when the caseload demands them.
   ===================================================================== */
const CRIME_SEV = {theft:4, vandalism:3, assault:5, bribery:6, fraud:3, 'insider trading':6, 'attempted bribery':4};
const CRIME_VERB = {theft:'steal', vandalism:'damage the property', assault:'attack someone', bribery:'take a bribe', fraud:'cheat someone'};
const CASE_PHASES = ['reported','investigating','suspect named','arrested','charged','awaiting trial','in trial'];
function civNight(){ const m = modOf(S.minute); return m < 6*60 || m > 21*60; }
function civCaseOpen(k){ return k.status==='open'; }
// everyone awake and close enough to see something at (x, y)
function civWitnesses(x, y, r, skip){ return S.citizens.filter(o=>!(skip||[]).includes(o.id) && isAdult(o) && o.rt.state!=='Sleeping' && !o.jail && !o.away && Math.abs(o.rt.x-x)<=r && Math.abs(o.rt.y-y)<=r); }
function civStructXY(s){ return s ? [s.x + Math.floor(s.w/2), s.y + s.h] : S.civ.center.slice(); }

// ---------- legal history: severity and recency both matter ----------
function civLegal(c, e){ const X = c.civ; X.legal = X.legal || []; X.legal.push(Object.assign({day:civDay()}, e)); if (X.legal.length > 14) X.legal.shift(); if (e.v==='guilty') X.convictions = (X.convictions||0)+1; }
function civLegalScore(c){ const d = civDay(); return (c.civ.legal||[]).reduce((a,e)=>a + (['guilty','fined','rough'].includes(e.v) ? (e.sev||1)/4 * Math.exp(-(d-e.day)/180) : 0), 0); }

// ---------- statements and evidence ----------
// a statement accuses (or clears) someone; weight = confidence x how believable the speaker is
function civStatement(k, by, acc, conf, src, text, clears){
  if (!acc) return null;
  const st = {by:by ? by.id : null, acc, conf:+clamp(conf,0.05,0.97).toFixed(2), src, day:civDay(), text, clears:!!clears};
  k.statements = k.statements || []; if (k.statements.some(x=>x.by===st.by && x.acc===acc && x.clears===st.clears)) return null;
  k.statements.push(st); if (by && !k.witnesses.includes(by.id) && !clears) k.witnesses.push(by.id);
  return st;
}
function civProof(k, item){ k.proof = k.proof || []; k.proof.push(Object.assign({day:civDay()}, item)); k.evidence.push(item.text); return item; }
function civCred(c){ if (!c || !c.civ) return 0.5; return clamp(0.35 + c.civ.cog.attention*0.35 + (c.traits.includes('Honest')?0.15:0) - Math.min(0.3, civLegalScore(c)*0.15) + (c.office?0.05:0), 0.1, 0.95); }
// how strongly the known facts point at each person (no access to the truth)
function civCaseScores(k){
  const sc = {};
  (k.statements||[]).forEach(s=>{ const w = s.conf * civCred(s.by && alive(s.by)); sc[s.acc] = (sc[s.acc]||0) + (s.clears ? -w*1.1 : w); });
  (k.proof||[]).forEach(p=>{ if (p.who) sc[p.who] = (sc[p.who]||0) + p.str; });
  for (const id in sc) sc[id] = 1 - Math.exp(-Math.max(0, sc[id])*1.3);
  return sc;
}
function civLeadSuspect(k){ const sc = civCaseScores(k); const top = Object.entries(sc).filter(([id])=>alive(id)).sort((a,b)=>b[1]-a[1]); return top.length ? {id:top[0][0], s:top[0][1], second: top[1] ? top[1][1] : 0} : null; }
// the case against one person, as a court would see it: accusations, things found, minus alibis and contradictions
function civCaseStrength(k, id, defence){
  let forW = 0, against = 0; const others = new Set();
  (k.statements||[]).forEach(s=>{ let w = s.conf * civCred(s.by && alive(s.by)); if (defence && !s.clears && s.conf < 0.55) w *= 1 - defence; // a good advocate picks apart a shaky witness
    if (s.acc===id){ if (s.clears) against += w; else forW += w; } else if (!s.clears) others.add(s.acc); });
  (k.proof||[]).forEach(p=>{ if (p.who===id) forW += p.str * (p.kind==='motive' ? (defence ? 1-defence*0.6 : 1) : 1); if (p.clears===id) against += p.str; });
  const contra = others.size ? 0.15*others.size : 0; // witnesses who name different people weaken each other
  return clamp(1 - Math.exp(-Math.max(0, forW - against*1.2 - contra)*1.25), 0, 0.99);
}
function civEvidence(k){
  if (k.kind==='criminal' && k.defendant && k.defendant.k==='person' && (k.statements||k.proof)) return civCaseStrength(k, k.defendant.id, k.defence||0);
  let e = k.evidence.length*0.25 + k.witnesses.length*0.2 + (k.weak ? -0.2 : 0); if (k.contract){ const K = S.civ.contracts[k.contract]; if (K && K.written) e += 0.4; } return clamp(0.2 + e, 0, 1);
}
function civEvText(e){ return typeof e==='string' ? e : (e && e.text) || ''; }

// ---------- a crime happens: the scene, who saw what, and what they think they saw ----------
function civCrimeScene(k, offender, xy, sev){
  k.actual = offender.id; k.truth = true; k.sev = sev; k.phase = 'reported'; k.at = xy; k.statements = k.statements || []; k.proof = k.proof || []; k.pending = [];
  const near = civWitnesses(xy[0], xy[1], 7, [offender.id]).sort((a,b)=>Math.hypot(a.rt.x-xy[0],a.rt.y-xy[1])-Math.hypot(b.rt.x-xy[0],b.rt.y-xy[1])).slice(0, 14);
  near.forEach(o=>{
    const dist = Math.max(Math.abs(o.rt.x-xy[0]), Math.abs(o.rt.y-xy[1]));
    const pSee = (civNight() ? 0.3 : 0.75) * (0.45 + o.civ.cog.attention*0.6) * (1 - dist/9);
    if (rnd() > pSee){ if (rnd() < 0.35) k.pending.push({by:o.id, acc:offender.id, conf:0.2, around:true}); return; } // saw someone about, no more
    const fam = Math.max(0, peekRel(o, offender.id).familiarity||0);
    let who = offender;
    if (rnd() > 0.45 + o.civ.cog.attention*0.3 + fam*0.25){ // the wrong face: someone else who was about, or someone they already dislike
      const pool = S.citizens.filter(x=>x!==o && x!==offender && isAdult(x) && !x.jail && !x.away && Math.abs(x.rt.x-xy[0])<16 && Math.abs(x.rt.y-xy[1])<16);
      const dis = pool.filter(x=>peekRel(o,x.id).affinity < -20);
      const from = dis.length && rnd()<0.5 ? dis : pool; if (from.length) who = from[Math.floor(rnd()*from.length)]; }
    const conf = clamp((who===offender ? 0.45 + o.civ.cog.attention*0.4 : 0.25 + rnd()*0.35) * (civNight() ? 0.75 : 1), 0.1, 0.95);
    // loyalty: people are slow to name a friend or family member
    const close = peekRel(o, who.id).tags.includes('Family') || peekRel(o, who.id).affinity > 55;
    k.pending.push({by:o.id, acc:who.id, conf, withhold:close});
    civHear(o, {ev:'crime_'+k.id, type:'crime', text:`I saw ${who.name} ${CRIME_VERB[k.type]||'break the law'}.`, who:[who.id], topics:{safety:-0.5, ['p:'+who.id]:-0.7}, imp:Math.min(9, 3+sev), src:'saw', conf, fact:{id:k.id, who:who.id, conf, kind:k.type, sev}});
    // some come forward at once
    if (!close && rnd() < 0.35 + o.personality.conscientiousness*0.4){ const p = k.pending.pop(); civStatement(k, o, p.acc, p.conf, 'saw', `${o.name} says they saw ${who.name}.`); }
  });
  offender.civ.crimes = (offender.civ.crimes||0) + 1;
  civHear(offender, {ev:'crime_'+k.id, type:'mycrime', text:`I ${CRIME_VERB[k.type]||'broke the law'} and nobody must know.`, imp:6, src:'self', emo:-0.2});
  const V = k.plaintiff && k.plaintiff.k==='person' && alive(k.plaintiff.id); if (V) civHear(V, {ev:'crime_'+k.id, type:'victim', text:`We were the victims of ${an(k.type)}.`, topics:{safety:-1}, imp:Math.min(9, 3+sev), src:'self', emo:-0.4});
  return k;
}
// cognition may not be loaded in some tests: fall back quietly
function civHear(c, e){ if (typeof experience==='function') return experience(c, e); }

// ---------- daily crime: need, temptation, grudges, and who might be watching ----------
function civCrimeDaily(){
  const C = S.civ, d = civDay(), watch = civWatch().length;
  S.citizens.forEach(c=>{
    if (!isAdult(c) || c.jail || c.away) return;
    const h = hhOf(c), desperate = h && hhFoodDays(h) < 0.4 && c.needs.hunger < 25, greedy = c.traits.includes('Greedy') || c.traits.includes('Cunning');
    const honest = c.traits.includes('Honest') ? 0.2 : 1, deter = 1/(1 + watch*0.25 + (C.justice.stage>=3?0.6:0) + (C.gov.laws.theft?0.4:0));
    // what they have learned: getting away with it tempts; being caught and punished deters
    const M = typeof cogOf==='function' ? cogOf(c) : {}, learned = clamp(1 + (M.crimeWins||0)*0.3 - (M.crimeAversion||0)*0.35 - civLegalScore(c)*0.1, 0.25, 2.2);
    const p = (desperate ? 0.05 : greedy ? 0.004 : 0.0008) * (1.3 - c.personality.agreeableness) * honest * deter * learned;
    // the deed itself happens later in the day, when there are people about (or, for a vandal, after dark)
    if (rnd() < p) civCrimeLater(c, 'theft', null, 10 + Math.floor(rnd()*7));
    // a grudge can turn into smashed property
    else if (c.personality.agreeableness < 0.4 && rnd() < 0.004*learned*deter){ const foe = Object.entries(c.rel||{}).filter(([id,r])=>r.affinity <= -45).map(([id])=>alive(id)).filter(Boolean)[0]; if (foe) civCrimeLater(c, 'vandalism', foe.id, rnd()<0.6 ? 21 + Math.floor(rnd()*2) : 12 + Math.floor(rnd()*6)); }
  });
  civBriberyDiscovery();
}
function civCrimeLater(c, kind, target, hour){ const Q = S.civ.crimeQueue = S.civ.crimeQueue || []; if (!Q.some(q=>q.who===c.id)) Q.push({who:c.id, kind, target, hour}); }
function civCrimeHour(h){
  const Q = S.civ.crimeQueue; if (!Q || !Q.length) return;
  S.civ.crimeQueue = Q.filter(q=>{ if (q.hour!==h) return true; const c = alive(q.who); if (!c || c.jail || c.away) return false;
    if (q.kind==='theft') civTheft(c, hhOf(c)); else if (q.kind==='vandalism'){ const foe = alive(q.target); if (foe) civVandalism(c, foe); }
    return false; });
}
function civTheft(c, h){
  const C = S.civ;
  const victims = Object.values(C.hh).filter(x=>x!==h && storeFood(x.store) > 150); if (!victims.length) return;
  const v = victims[Math.floor(rnd()*victims.length)], g = CIV_FOODS.filter(x=>v.store[x]>=3).sort((a,b)=>v.store[b]-v.store[a])[0]; if (!g) return;
  const q = Math.min(8, Math.floor(v.store[g]*0.3)); storeTake(v.store, g, q); if (h) storeAdd(h.store, g, q);
  const owner = hhAdults(v)[0]; if (!owner) return;
  ev('thefts');
  const k = civCaseFile('criminal', 'theft', {k:'person', id:owner.id}, null, `${q} ${CG[g].name.toLowerCase()} stolen`, q*CG[g].v); if (!k) return;
  k.goods = {g, q, hh: h ? h.id : null};
  civCrimeScene(k, c, civStructXY(v.home && C.structs[v.home]), CRIME_SEV.theft);
  chronicle(`Food was stolen from the ${v.name} household.`, 5, '🕵️', 'crime');
}
function civVandalism(c, foe){
  const C = S.civ, s = Object.values(C.structs).find(s=>(s.owner.k==='person' && s.owner.id===foe.id) || (s.owner.k==='hh' && hhOf(foe) && s.owner.id===hhOf(foe).id)); if (!s) return;
  s.cond = Math.max(5, s.cond - 18 - rnd()*14); ev('vandalism');
  const k = civCaseFile('criminal', 'vandalism', {k:'person', id:foe.id}, null, `damage to ${s.name}`, 6*(S.civ.econ.level||1)); if (!k) return;
  civCrimeScene(k, c, civStructXY(s), CRIME_SEV.vandalism);
  chronicle(`Someone damaged ${s.name} in the night.`, 5, '🪓', 'crime'); civProblem('crime', 1);
}
// ---------- a quarrel at the fire: settled on the spot unless somebody gets hurt ----------
function civQuarrel(a, b){
  S.week.quarrels++; adjustRel(a, b, -15); adjustRel(b, a, -15); civProblem('dispute', 1);
  if (rnd() >= 0.2) return;
  const agg = a.personality.agreeableness <= b.personality.agreeableness ? a : b, vic = agg===a ? b : a, xy = [a.rt.x, a.rt.y];
  const seen = civWitnesses(xy[0], xy[1], 7, [a.id, b.id]), hurt = rnd() < 0.25; ev('fights');
  const G = S.civ.gov, cop = [G.offices.constable, G.offices.watch_captain].map(alive).find(o=>o && seen.includes(o)) || civWatch().find(o=>seen.includes(o));
  seen.slice(0, 12).forEach(o=>civHear(o, {ev:'fight_'+a.id+b.id+civDay(), type:'fight', text:`${agg.name} and ${vic.name} came to blows by the fire.`, pub:`${agg.name} started a fight with ${vic.name}.`, who:[agg.id], topics: cop && !hurt ? {['p:'+agg.id]:-0.3, constables:0.2} : {['p:'+agg.id]:-0.4, safety:-0.1}, imp: hurt ? 5 : 3, src:'saw', conf:0.9}));
  if (!hurt){
    if (cop){ const fine = civMoneyOn() ? Math.min(Math.floor(agg.wallet), Math.round(2*(S.civ.econ.level||1))) : 0;
      if (fine>0) civMoveMoney({k:'person', id:agg.id}, {k:'gov'}, fine, 'fine');
      civLegal(agg, {type:'brawling', sev:1, v:'fined', by:cop.id}); ev('fights_broken_up');
      chronicle(`${cop.office ? cop.office+' ' : ''}${cop.name} broke up a fight between ${agg.name} and ${vic.name}${fine?` and fined ${agg.name} ${fine}¢`:` and made ${agg.name} apologise`}.`, 3, '🚨', 'crime');
      civHear(agg, {type:'fined', text:`${cop.name} ${fine?'fined':'scolded'} me for a fight.`, who:[cop.id], topics:{constables:-0.3}, imp:4, src:'self'}); }
    else chronicle(`A quarrel between ${a.name} and ${b.name} came to blows.`, 4, '👊', 'social');
    return;
  }
  vic.civ.hurt = 1;
  const k = civCaseFile('criminal', 'assault', {k:'person', id:vic.id}, null, 'a beating at the fire', 0); if (!k) return;
  civCrimeScene(k, agg, xy, CRIME_SEV.assault);
  civStatement(k, vic, agg.id, 0.9, 'self', `${vic.name} says ${agg.name} attacked them.`); // the victim knows who hit them
  chronicle(`${vic.name} was hurt in a fight at the fire.`, 5, '👊', 'crime');
}

// ---------- investigation: who is working the case, and what they turn up ----------
function civInvestigatorFor(k){
  const G = S.civ.gov, J = S.civ.justice;
  const list = [G.offices.investigator, G.offices.constable, G.offices.watch_captain].map(alive).filter(o=>o && !o.jail);
  for (const o of list){ if (!civConflict(o, k) || !civRecuses(o)) return o; }
  return list[0] || null;
}
function civInvSkill(inv){ return inv ? clamp((sk(inv,'investigation') + inv.civ.cog.reasoning*45 + inv.civ.cog.attention*25)/150, 0.05, 0.95) : 0.12; }
function civInvestigate(k){
  const J = S.civ.justice, inv = civInvestigatorFor(k), skill = civInvSkill(inv), who = inv ? inv.name : 'The victim';
  if (inv && !k.inv){ k.inv = inv.id; k.phase = 'investigating'; if (inv.office==='Investigator') chronicle(`Investigator ${inv.name} opened an inquiry into the ${k.type} (${k.claim}).`, 4, '🔎', 'crime'); }
  if (inv){ inv.civ.skill.investigation = Math.min(100, sk(inv,'investigation') + 0.6); inv.civ.log.investigate = (inv.civ.log.investigate||0) + 2; }
  const log = t => { k.log.push({day:civDay(), note:t}); if (k.log.length>30) k.log.shift(); };
  // 1. interview: people who saw something tell what they saw (friends of the accused may keep quiet)
  (k.pending||[]).slice().forEach(p=>{ if (rnd() > 0.25 + skill*0.6) return; const o = alive(p.by); k.pending.splice(k.pending.indexOf(p),1); if (!o) return;
    if (p.withhold && rnd() < 0.6){ log(`${o.name} would not say what they saw`); return; }
    const acc = alive(p.acc); if (!acc) return;
    const st = civStatement(k, o, p.acc, p.conf, p.around ? 'near' : 'saw', p.around ? `${o.name} says ${acc.name} was near the place.` : `${o.name} told ${inv?'investigators':'the victim'} they saw ${acc.name}.`);
    if (st && k.sev>=4 && p.conf>0.5 && hash(k.id+o.id)%3===0) chronicle(`${o.name} told ${inv && inv.office==='Investigator'?'investigators':inv?inv.name:'people'} they saw ${acc.name} ${k.type==='theft'?'near the store':'at the scene'}.`, 3, '👁', 'crime'); });
  const lead = civLeadSuspect(k); if (!lead) { if (civDay()-k.day > 40) civUnsolved(k); return; }
  const sus = alive(lead.id), guilty = lead.id===k.actual;
  // 2. alibis: an innocent suspect was usually somewhere else, and someone saw them; the guilty may get a friend to lie
  if (lead.s > 0.3 && !(k.checked||[]).includes(lead.id) && rnd() < 0.3 + skill*0.5){
    k.checked = (k.checked||[]).concat(lead.id);
    // an innocent suspect was somewhere else, and usually more than one person saw them there
    if (!guilty){ const pool = hhAdults(hhOf(sus)||{members:[]}).filter(o=>o!==sus).concat(S.citizens.filter(o=>o!==sus && isAdult(o) && (peekRel(o, sus.id).familiarity||0) > 0.2)); const alibis = [...new Set(pool)].slice(0, 2);
      if (alibis.length && rnd() < 0.75){ alibis.forEach(a=>civStatement(k, a, sus.id, 0.85, 'alibi', `${a.name} says ${sus.name} was with them at the time.`, true)); log(`${sus.name} has an alibi`); } }
    else if (sus.traits.includes('Cunning') || rnd()<0.2){ const liar = S.citizens.find(o=>o!==sus && isAdult(o) && peekRel(o, sus.id).affinity > 50 && !o.traits.includes('Honest'));
      if (liar){ const st = civStatement(k, liar, sus.id, 0.6, 'alibi', `${liar.name} says ${sus.name} was with them at the time.`, true); if (st) st.lie = true; } } }
  // a lie can come apart under a careful look
  (k.statements||[]).filter(s=>s.lie && !s.broken).forEach(s=>{ if (rnd() < skill*0.25){ s.broken = true; s.conf = 0.05; const liar = alive(s.by); civProof(k, {kind:'contradiction', who:s.acc, str:0.55, by:inv?inv.id:null, text:`${liar?liar.name:'A witness'}'s alibi for ${sus?sus.name:'the suspect'} fell apart`}); log('an alibi fell apart'); if (liar) civLegal(liar, {type:'lying to investigators', sev:2, v:'noted', case:k.id}); } });
  // 3. search: stolen goods turn up with the thief (sometimes an innocent pantry just happens to hold the same food)
  if (k.type==='theft' && k.goods && lead.s > 0.35 && !(k.searched||[]).includes(lead.id) && inv){
    k.searched = (k.searched||[]).concat(lead.id); const sh = hhOf(sus);
    if (guilty && rnd() < 0.35 + skill*0.4) civProof(k, {kind:'goods', who:sus.id, str:0.7, by:inv.id, text:`${CG[k.goods.g].name} like the stolen food found in ${sus.name}'s store`});
    else if (!guilty && sh && (sh.store[k.goods.g]||0) > 5 && rnd() < 0.12) civProof(k, {kind:'goods', who:sus.id, str:0.35, by:inv.id, text:`${CG[k.goods.g].name} found in ${sus.name}'s store (it could be their own)`}); }
  // 4. motive: hunger or bad blood with the victim are there for anyone to see
  if (!(k.motive||[]).includes(lead.id)){ k.motive = (k.motive||[]).concat(lead.id); const V = k.plaintiff && k.plaintiff.k==='person' && alive(k.plaintiff.id); const sh = hhOf(sus);
    if (sh && hhFoodDays(sh) < 1 && k.type==='theft') civProof(k, {kind:'motive', who:sus.id, str:0.15, text:`${sus.name}'s household was going hungry`});
    if (V && peekRel(sus, V.id).affinity < -30) civProof(k, {kind:'motive', who:sus.id, str:0.15, text:`bad blood between ${sus.name} and ${V.name}`}); }
  // 5. the usual suspects: a careless investigator leans on people with a record
  const again = civLeadSuspect(k); if (!again) return;
  const named = alive(again.id); if (!named) return;
  if (k.named && (civCaseScores(k)[k.named]||0) < 0.2){ /* the named suspect no longer fits: an alibi, or someone else fits better */ const was = alive(k.named); if (was){ civLegal(was, {type:k.type, sev:0, v:'cleared', case:k.id}); chronicle(`${was.name} was cleared of the ${k.type}${(k.statements||[]).some(s=>s.clears && s.acc===was.id)?' — they had an alibi':''}.`, 4, '✅', 'crime'); civHear(was, {type:'cleared', text:`I was cleared of the ${k.type}. I never did it.`, topics:{justice:0.4}, imp:6, src:'self'}); } k.named = null; k.phase = 'investigating'; }
  if (again.s >= 0.45 && again.s - again.second > 0.1 && k.named!==again.id){ k.named = again.id; k.phase = 'suspect named'; civHear(named, {type:'suspected', text:`They think I did the ${k.type}.`, topics:{justice: named.id===k.actual ? 0 : -0.6}, imp:6, src:'self', emo:-0.3});
    chronicle(`${inv ? (inv.office ? inv.office+' ' : '')+inv.name : 'The victim'} named ${named.name} as a suspect in the ${k.type}.`, 5, '🔎', 'crime'); }
  // arrest and charges
  if (k.named && again.s >= 0.55 && S.civ.justice.stage>=3 && k.phase!=='arrested' && !k.defendant){
    const cop = alive(S.civ.gov.offices.constable) || inv; k.defendant = {k:'person', id:k.named}; k.phase = 'arrested'; ev('arrests');
    chronicle(`${cop ? (cop.office ? cop.office+' ' : '')+cop.name : 'The watch'} arrested ${named.name} on suspicion of ${k.type}.`, 6, '🚨', 'crime');
    civPublic(k, `${named.name} was arrested for ${k.type}.`, [named.id], {safety:0.3, constables:0.2}); }
}
function civUnsolved(k){ k.status = 'unsolved'; k.phase = null; civProblem('crime', 1); ev('unsolved'); if (k.actual){ const o = alive(k.actual); if (o && typeof cogOf==='function') cogOf(o).crimeWins = (cogOf(o).crimeWins||0) + 1; }
  if (k.sev>=4) chronicle(`The ${k.type} (${k.claim}) went unsolved.`, 3, '❓', 'crime'); }
// news of a case spreads from whoever was there; the rest learn it later by word of mouth or the paper
function civPublic(k, text, who, topics){ const xy = k.at || S.civ.center; civWitnesses(xy[0], xy[1], 10, who).slice(0, 12).forEach(o=>civHear(o, {ev:'pub_'+k.id+'_'+(k.phase||k.status), type:'case', text, pub:text, who, topics, imp:5, src:'saw', conf:0.9})); S.civ.wire = (S.civ.wire||[]).concat({day:civDay(), text, who, topics, ev:'pub_'+k.id+'_'+(k.phase||k.status), case:k.id}).slice(-40); }

// ---------- conflicts of interest, recusal and bribes ----------
function civConflict(o, k){
  if (!o || !k) return null;
  const parties = [k.plaintiff, k.defendant].filter(p=>p && p.k==='person').map(p=>p.id).concat(k.named ? [k.named] : []);
  for (const id of parties){ if (id===o.id) return 'is a party to the case'; const r = peekRel(o, id), p = alive(id);
    if (o.partner===id || r.tags.includes('Spouse')) return `is married to ${p?p.name:'a party'}`;
    if (r.tags.includes('Family')) return `is family of ${p?p.name:'a party'}`;
    if (r.affinity > 60) return `is a close friend of ${p?p.name:'a party'}`;
    if (r.affinity < -50) return `has bad blood with ${p?p.name:'a party'}`;
    if (p && civOrgs(g=>g.owners && g.owners[o.id] && g.owners[id]).length) return `is in business with ${p.name}`; }
  return null;
}
function civRecuses(o){ return (o.traits.includes('Honest') || o.personality.conscientiousness > 0.6) && !o.traits.includes('Greedy') && !o.traits.includes('Ambitious'); }
function civBent(o){ return !o.traits.includes('Honest') && (o.traits.includes('Greedy') || o.traits.includes('Cunning') || o.personality.conscientiousness < 0.35); }
// the accused may try to buy their way out; an honest official reports it
function civTryBribe(k, official){
  if (!civMoneyOn() || !official || k.bribe || !k.defendant || k.defendant.k!=='person') return 0;
  const dfd = alive(k.defendant.id); if (!dfd) return 0;
  const amt = Math.round(12*(S.civ.econ.level||1)*(1+(k.sev||CRIME_SEV[k.type]||3)/4)); if (!(amt>0)) return 0; if (dfd.wallet < amt*1.5) return 0;
  const will = (dfd.traits.includes('Cunning')||dfd.traits.includes('Greedy') ? 0.45 : 0.08) * (1 - dfd.personality.agreeableness*0.5);
  if (rnd() > will) return 0;
  if (civBent(official) && rnd() < 0.65){ civMoveMoney({k:'person', id:dfd.id}, {k:'person', id:official.id}, amt, 'gift'); k.bribe = {from:dfd.id, to:official.id, amt, day:civDay(), hidden:true}; ev('bribes'); return 0.35; }
  if (!civBent(official)){ ev('bribes_refused'); const b = civCaseFile('criminal', 'attempted bribery', {k:'gov'}, {k:'person', id:dfd.id}, `offering ${official.name} ${amt}¢`, 0);
    if (b){ b.actual = dfd.id; b.truth = true; b.sev = CRIME_SEV['attempted bribery']; b.phase = 'charged'; civStatement(b, official, dfd.id, 0.95, 'saw', `${official.name} says ${dfd.name} offered them ${amt}¢.`); chronicle(`${official.name} reported that ${dfd.name} tried to bribe them.`, 6, '💰', 'crime'); } }
  return 0;
}
// hidden bribes come out sooner or later: investigators, papers and loose talk
function civBriberyDiscovery(){
  const J = S.civ.justice, eyes = [S.civ.gov.offices.investigator].map(alive).filter(Boolean).length + civOrgs(o=>o.biz==='newspaper').length;
  J.cases.filter(k=>k.bribe && k.bribe.hidden).forEach(k=>{
    if (rnd() > 0.006 + eyes*0.01) return;
    k.bribe.hidden = false; const f = alive(k.bribe.from), t = alive(k.bribe.to); if (!t) return;
    const b = civCaseFile('criminal', 'bribery', {k:'gov'}, {k:'person', id:t.id}, `taking ${k.bribe.amt}¢ from ${f?f.name:'a defendant'} in the ${k.type} case`, k.bribe.amt);
    if (!b) return; b.actual = t.id; b.truth = true; b.sev = CRIME_SEV.bribery; b.phase = 'charged';
    civProof(b, {kind:'payment', who:t.id, str:0.8, text:`a payment of ${k.bribe.amt}¢ from ${f?f.name:'the defendant'} to ${t.name}`}); if (f) civProof(b, {kind:'payment', who:f.id, str:0.3, text:`${f.name} paid ${t.name}`});
    const paper = civOrgs(o=>o.biz==='newspaper')[0];
    chronicle(`${paper ? `${paper.name} revealed` : 'Word got out'} that ${t.name} took money from ${f?f.name:'a defendant'} while the ${k.type} case was before them.`, 8, '📰', 'crime');
    civPublic(b, `${t.name} took a bribe from ${f?f.name:'a defendant'}.`, [t.id], {courts:-0.8, council:-0.5, ['p:'+t.id]:-1});
    if (paper) S.citizens.filter(isAdult).forEach(o=>{ if (hash(o.id+b.id)%3===0) civHear(o, {ev:'pub_'+b.id+'_paper', type:'scandal', text:`${paper.name}: ${t.name} took a bribe.`, pub:`${t.name} took a bribe.`, who:[t.id], topics:{courts:-0.6, ['p:'+t.id]:-0.8}, imp:6, src:'paper', from:paper.id}); });
    for (const off in S.civ.gov.offices) if (S.civ.gov.offices[off]===t.id){ delete S.civ.gov.offices[off]; t.office = null; chronicle(`${t.name} was removed as ${off.replace('_',' ')}.`, 7, '🏛️', 'gov'); }
    civProblem('crime', 3); ev('corruption');
  });
}

// ---------- judging: evidence, advocates, conflicts, sentencing ----------
function civJudgeFor(k){
  const G = S.civ.gov, first = alive(G.offices.magistrate) || civRespected(1, c=>kn(c,'law')>=20)[0];
  if (!first) return null;
  const why = civConflict(first, k);
  if (!why) return {judge:first};
  if (civRecuses(first)){
    const alt = civRespected(6, c=>c!==first && !civConflict(c, k) && (kn(c,'law')>=15 || c.civ.cog.emotional>0.6) && !c.jail)[0];
    k.log.push({day:civDay(), note:`${first.name} stepped aside (${why})`}); ev('recusals');
    if (!k.recused){ k.recused = first.id; chronicle(`${first.name} stepped aside from the ${k.type} case because they ${why}.${alt?` ${alt.name} will hear it instead.`:''}`, 5, '⚖️', 'justice'); }
    if (alt) return {judge:alt};
  }
  // they sit anyway: a thumb on the scale, and people may notice
  const friend = /friend|married|family|business/.test(why), def = k.defendant && k.defendant.k==='person' ? k.defendant.id : null;
  const onDef = def && (civConflict(first, {plaintiff:null, defendant:k.defendant}) !== null);
  const bias = (friend ? -0.2 : 0.2) * (onDef ? 1 : -1);
  if (!k.biasNoted && rnd() < 0.5){ k.biasNoted = true; chronicle(`People are asking why ${first.name}, who ${why}, is judging the ${k.type} case.`, 5, '⚠️', 'justice'); civPublic(k, `${first.name} judged a case though they ${why}.`, [first.id], {courts:-0.6, ['p:'+first.id]:-0.5}); ev('conflicts_ignored'); }
  return {judge:first, bias};
}
function civMagistrate(k){ civHearCase(k, false); }
function civTrial(k){ civHearCase(k, true); }
function civHearCase(k, court){
  if (!civCaseOpen(k)) return;
  const pick = civJudgeFor(k); if (!pick) return;
  const judge = pick.judge; let tilt = pick.bias || 0;
  // witnesses who came forward
  S.citizens.filter(c=>c.civ.saw && c.civ.saw.case===k.id).forEach(c=>{ if (!k.witnesses.includes(c.id)) k.witnesses.push(c.id); });
  // advocates: a good lawyer tips the balance; the richer side can afford a better one
  if (court && S.civ.justice.stage>=8){ const lawyers = S.citizens.filter(c=>kn(c,'law')>=40 && c!==judge && !c.jail).sort((a,b)=>sk(b,'law')-sk(a,'law'));
    const pros = k.kind==='criminal' ? alive(S.civ.gov.offices.prosecutor) : null;
    const pl = pros || lawyers.find(l=>!civConflict(l, k)), dl = lawyers.find(l=>l!==pl && !civConflict(l, k)); const fee = 8*(S.civ.econ.level||1);
    const hire = (party, L) => { if (!L || !party) return 0; if (L===pros) return sk(L,'law')/220; const pp = civOwnerPurse(party); if (civPurse(pp) < fee) return 0; civMoveMoney(pp, {k:'person', id:L.id}, fee, 'legal'); L.civ.log.lawyer = (L.civ.log.lawyer||0)+2; ev('lawyer_fees'); return sk(L,'law')/200; };
    const pa = hire(k.plaintiff && k.plaintiff.k!=='gov' ? k.plaintiff : null, pl) + (pros ? sk(pros,'law')/220 : 0), da = hire(k.defendant, dl);
    k.defence = da; tilt += pa*0.6; k.lawyers = {p: pl ? pl.id : null, d: dl ? dl.id : null}; }
  if (k.kind==='criminal' && court){ k.phase = 'in trial'; chronicle(`The trial of ${civCaseParty(k.defendant)} for ${k.type} has begun${judge?` before ${judge.name}`:''}.`, 6, '⚖️', 'justice'); }
  tilt -= civTryBribe(k, judge);
  civJudge(k, judge, tilt);
}
function civJudge(k, judge, tilt){
  if (k.type==='bankruptcy'){ const r = civBankrupt(k.plaintiff, 'court'); k.status = 'judged'; k.judgment = {by:judge.id, result:r}; chronicle(`${judge.name} ruled on the insolvency of ${civCaseParty(k.plaintiff)}: ${r}.`, 7, '⚖️', 'justice'); return; }
  // the judge sees only the evidence; a skilled judge weighs it steadily, an unskilled one is swayed by chance
  const skill = clamp(kn(judge,'law')/100*0.5 + judge.civ.cog.reasoning*0.4, 0.05, 0.95);
  const E = civEvidence(k), noise = (rnd()-0.5) * 0.7 * (1-skill);
  const found = E + (tilt||0) + noise > 0.5;
  k.status = 'judged'; k.phase = null; k.judgment = {by:judge.id, found, day:civDay(), strength:+E.toFixed(2)};
  const dfd = k.defendant && k.defendant.k==='person' && alive(k.defendant.id);
  if (found){
    if (k.kind==='civil'){ const pay = Math.min(k.damages||0, civPurse(civOwnerPurse(k.defendant))); if (pay>0) civMoveMoney(civOwnerPurse(k.defendant), civOwnerPurse(k.plaintiff), pay, 'judgment'); k.judgment.amount = pay; if (pay < (k.damages||0)*0.5 && k.defendant.k!=='estate') civCheckInsolvent(k.defendant); }
    else if (dfd) civSentence(k, dfd, judge);
  } else if (dfd && k.kind==='criminal'){ civLegal(dfd, {type:k.type, sev:0, v:'acquitted', case:k.id}); }
  const wrong = k.kind==='criminal' && dfd && k.actual && found !== (dfd.id===k.actual);
  if (wrong){ k.wrong = true; ev(found ? 'wrongful_convictions' : 'guilty_walked'); }
  if (dfd && found && dfd.id!==k.actual && k.actual){ civHear(dfd, {type:'wronged', text:'I was found guilty of something I did not do.', topics:{justice:-1, courts:-1, ['p:'+judge.id]:-1}, imp:9, src:'self', emo:-0.6}); hhMembers(hhOf(dfd)||{members:[]}).forEach(m=>{ if (m!==dfd) civHear(m, {type:'wronged', text:`${dfd.name} was convicted of something they did not do.`, who:[judge.id], topics:{courts:-0.8, justice:-0.6}, imp:8, src:'self'}); }); }
  const S1 = k.judgment.sentence ? ` — ${k.judgment.sentence}` : '';
  if (k.kind==='criminal') chronicle(found ? `${civCaseParty(k.defendant)} was convicted of ${k.type}${S1}.` : `${civCaseParty(k.defendant)} was acquitted of ${k.type}${E < 0.45 && (k.statements||[]).length>1 ? ' after contradictory testimony weakened the case' : ''}.`, 7, found?'✅':'❌', 'justice');
  else chronicle(`${judge.name} ${S.civ.justice.stage>=6?'heard the case':'ruled'}: ${civCaseParty(k.plaintiff)} v. ${civCaseParty(k.defendant)} (${k.type}) — ${found ? `claim upheld${k.judgment.amount?`, ${k.judgment.amount}¢ awarded`:''}` : 'claim dismissed'}.`, 6, '⚖️', 'justice');
  if (k.kind==='criminal') civPublic(k, found ? `${civCaseParty(k.defendant)} was convicted of ${k.type}.` : `${civCaseParty(k.defendant)} was acquitted of ${k.type}.`, dfd ? [dfd.id] : [], {courts: 0.2, safety: found ? 0.3 : -0.2});
  ev(found ? 'judgments_for' : 'judgments_against');
  if (k.kind==='criminal' && typeof civVerdictTrust==='function') civVerdictTrust(k);
}
function civSentence(k, dfd, judge){
  const sev = k.sev || CRIME_SEV[k.type] || 3, hist = civLegalScore(dfd), level = sev + hist*1.5, jail = civHas(['jail','prison']).length > 0, out = [];
  const pay = (amt, to, why) => { if (!civMoneyOn() || amt<=0) return 0; const a = Math.min(Math.round(amt), Math.floor(dfd.wallet)); if (a>0) civMoveMoney({k:'person', id:dfd.id}, to, a, why); return a; };
  if (level < 3.5 && !hist){ out.push('a warning'); }
  else {
    if (k.goods && (k.type==='theft')){ const V = alive(k.plaintiff.id), mult = S.civ.gov.laws.theft ? 2 : 1, dh = hhOf(dfd), vh = V && hhOf(V); if (dh && vh){ const q = storeTake(dh.store, k.goods.g, k.goods.q*mult); storeAdd(vh.store, k.goods.g, q); if (q >= 0.5) out.push(`return ${Math.round(q)} ${CG[k.goods.g].name.toLowerCase()}`); } }
    const fine = pay(3*sev*(S.civ.econ.level||1)*(1+hist*0.5), {k:'gov'}, 'fine'); if (fine) out.push(`a ${fine}¢ fine`);
    if (k.type==='bribery' || k.type==='attempted bribery'){ for (const off in S.civ.gov.offices) if (S.civ.gov.offices[off]===dfd.id){ delete S.civ.gov.offices[off]; out.push(`removal as ${off.replace('_',' ')}`); } if (dfd.office && !Object.values(S.civ.gov.offices).includes(dfd.id)) dfd.office = null; }
    if (jail && (level >= 6 || (sev>=5 && hist>0.5))){ const days = Math.min(40, Math.round(3*sev*(1+hist*0.6))); dfd.jail = civDay() + days; k.judgment.jail = days; out.push(`${days} days in jail`); ev('jailed');
      chronicle(`${dfd.name} was sentenced to ${days} days in jail.`, 6, '🔒', 'justice'); }
    else if (!civMoneyOn() || !fine){ dfd.civ.service = civDay() + Math.min(14, sev*2); out.push(`${Math.min(14, sev*2)} days of work for the settlement`); }
  }
  k.judgment.sentence = out.join(', ');
  civLegal(dfd, {type:k.type, sev, v:'guilty', case:k.id, s:k.judgment.sentence});
  // punishment teaches — if they think it was fair; the wrongly convicted only learn resentment
  if (typeof cogOf==='function'){ const M = cogOf(dfd); if (dfd.id===k.actual) M.crimeAversion = (M.crimeAversion||0) + (dfd.jail ? 1.2 : 0.6); }
  civHear(dfd, {type:'sentenced', text:`I was sentenced to ${k.judgment.sentence} for ${k.type}.`, who:[judge.id], topics:{justice: dfd.id===k.actual ? -0.2 : -1, constables:-0.3}, imp:8, src:'self', emo:-0.5});
}
// rough justice: before there is a magistrate, whoever keeps order decides guilt themselves
function civRoughJustice(k){
  const cop = alive(S.civ.gov.offices.constable) || alive(S.civ.gov.offices.watch_captain); if (!cop || !k.named) return;
  const sus = alive(k.named); if (!sus) return;
  const fine = civMoneyOn() ? Math.min(Math.floor(sus.wallet), Math.round(3*(k.sev||3)*(S.civ.econ.level||1))) : 0;
  if (fine) civMoveMoney({k:'person', id:sus.id}, {k:'gov'}, fine, 'fine');
  if (!fine) sus.civ.service = civDay() + (k.sev||3);
  k.status = 'judged'; k.phase = null; k.judgment = {by:cop.id, found:true, rough:true, day:civDay(), sentence: fine ? `a ${fine}¢ fine` : `${k.sev||3} days of work`};
  civLegal(sus, {type:k.type, sev:k.sev||3, v:'rough', case:k.id, s:k.judgment.sentence});
  chronicle(`${cop.office ? cop.office+' ' : ''}${cop.name} decided ${sus.name} was guilty of the ${k.type} and punished them with ${k.judgment.sentence}.`, 5, '🚨', 'crime');
  // the accused protests; friends and family take their side, and people start to ask who should decide guilt
  const innocent = sus.id!==k.actual, denies = innocent || rnd() < 0.5;
  if (denies){ const backers = S.citizens.filter(o=>o!==sus && (peekRel(o, sus.id).tags.includes('Family') || peekRel(o, sus.id).affinity > 40)).slice(0, 8);
    backers.concat(sus).forEach(o=>civHear(o, {ev:'rough_'+k.id, type:'rough', text:`${cop.name} punished ${o===sus?'me':sus.name} without any hearing.`, who:[cop.id], topics:{constables:-0.8, justice:-0.6, ['p:'+cop.id]:-0.6}, imp:7, src:o===sus?'self':'told', from:sus.id}));
    if (backers.length >= 2){ S.civ.justice.contested = (S.civ.justice.contested||0) + 1; civProblem('justice', 3); ev('contested_verdicts'); k.contested = true;
      if (S.civ.justice.contested===3) chronicle(`People are saying the constables should not decide guilt themselves: ${sus.name}'s family and friends want a fair hearing.`, 6, '🗣️', 'justice'); } }
}

// ---------- the daily round ----------
function civJusticeDaily(){
  const J = S.civ.justice, d = civDay(), G = S.civ.gov;
  J.cases.filter(civCaseOpen).forEach(k=>{
    const age = d - k.day;
    if (k.kind==='criminal' && k.actual){
      // an unidentified offender: find them first
      if (!k.defendant){ civInvestigate(k); if (!civCaseOpen(k)) return;
        // before there are constables the victim simply accuses whoever they are fairly sure of, and it goes to family or a mediator
        const L = k.named && civLeadSuspect(k);
        if (!k.defendant && J.stage<3 && L && L.id===k.named && L.s >= 0.5){ k.defendant = {k:'person', id:k.named}; k.phase = 'accused'; }
        if (!k.defendant){ if (J.stage>=3 && J.stage<5 && L && L.s >= 0.55) civRoughJustice(k); if (age>40 && civCaseOpen(k)) civUnsolved(k); return; } }
      if (J.stage>=5){
        if (!k.charged){ const E = civEvidence(k); if (E < 0.3 && age >= 4){ k.status = 'dismissed'; k.phase = null; const dfd = alive(k.defendant.id); if (dfd) civLegal(dfd, {type:k.type, sev:0, v:'dismissed', case:k.id}); chronicle(`The ${k.type} case against ${civCaseParty(k.defendant)} was dismissed for lack of evidence.`, 5, '📂', 'justice'); ev('dismissed'); return; }
          if (E >= 0.3){ k.charged = d; k.phase = 'charged'; chronicle(`${civCaseParty(k.defendant)} was formally charged with ${k.type}.`, 5, '⚖️', 'justice'); return; } civInvestigate(k); return; }
        if (d - k.charged < 2){ k.phase = 'awaiting trial'; civInvestigate(k); return; }
        return J.stage>=6 ? civTrial(k) : civMagistrate(k);
      }
      if (J.stage>=3 && J.stage<5){ if (k.named) civRoughJustice(k); if (age > 30 && civCaseOpen(k)) civUnsolved(k); return; }
    }
    if (J.stage>=6 && age>=3) return civTrial(k);
    if (J.stage>=5 && age>=2) return civMagistrate(k);
    if (J.stage>=1 && age>=1 && rnd()<0.4){ const m = civMediator(k); if (m) return civMediate(k, m); }
    if (age>=2 && J.stage<1) civInformal(k);
    if (age>40 && civCaseOpen(k)){ k.status = k.kind==='criminal' ? 'unsolved' : 'dropped'; civProblem(k.kind==='criminal'?'crime':'dispute', 1); }
  });
  // institutions grow from the caseload, not the calendar
  const recent = J.cases.filter(k=>d-k.day<=28), crimes = recent.filter(k=>k.kind==='criminal').length, unsolved = J.cases.filter(k=>k.status==='unsolved' && d-k.day<=56).length;
  if (J.stage<1 && recent.length>=3 && civMediator(null)) civJusticeStage(1, `${civMediator(null).name} has become the person everyone asks to settle quarrels.`);
  if (J.stage>=2 && J.stage<3 && crimes>=4 && G.stage>=3){ const c = civWatch()[0]; if (c){ civJusticeStage(3, `${c.name} was made the settlement's constable.`); c.office = 'Constable'; G.offices.constable = c.id; } }
  // more constables when crime outruns them
  if (J.stage>=3 && crimes >= 8 + 6*Object.keys(G.offices).filter(k=>k.startsWith('constable')).length && S.citizens.length > 60){ const n = Object.keys(G.offices).filter(k=>k.startsWith('constable')).length; const c = civWatch().find(x=>!x.office); if (c && n < Math.ceil(S.citizens.length/60)){ G.offices['constable_'+(n+1)] = c.id; c.office = 'Constable'; chronicle(`Crime is outrunning the watch: ${c.name} became another constable.`, 5, '🚨', 'justice'); } }
  const serious = J.cases.filter(k=>k.kind==='criminal' && (k.sev||0)>=4 && ['unsolved'].includes(k.status) && d-k.day<=84).length;
  if (J.stage>=3 && !alive(G.offices.investigator) && (unsolved>=4 || serious>=3)){ const inv = S.citizens.filter(c=>isAdult(c) && c.civ.cog.reasoning>0.55 && c.civ.cog.attention>0.5 && !c.office && !c.jail && civLegalScore(c) < 0.3).sort((a,b)=>(sk(b,'investigation')+b.civ.cog.reasoning*30+b.personality.conscientiousness*20)-(sk(a,'investigation')+a.civ.cog.reasoning*30+a.personality.conscientiousness*20))[0];
    if (inv){ inv.office = 'Investigator'; G.offices.investigator = inv.id; const msg = `The constables can keep order, but serious crimes need investigation: ${inv.name} became the settlement's ${J.stage>=4?'new':'first'} investigator.`; if (J.stage<4) civJusticeStage(4, msg); else chronicle(msg, 7, '🔎', 'justice'); } }
  // people who were punished without a hearing make the case for a neutral judge
  if (J.stage>=3 && J.stage<5 && (J.contested||0) >= 3 && !G.offices.magistrate){ const m = civRespected(1, c=>kn(c,'law')>=10 && !c.office && !c.jail)[0] || civRespected(1, c=>c.civ.cog.emotional>0.6 && !c.office && !c.jail)[0]; if (m){ civAppoint('magistrate', m, 'so that constables no longer decide guilt themselves'); civJusticeStage(5, `🏛️ ${m.name} became the settlement's first magistrate. Constables will no longer decide guilt themselves.`); } }
  if (J.stage===5 && J.cases.filter(civCaseOpen).length>=5 && !civProjects().some(p=>p.def==='courthouse') && !civHas('courthouse').length && civCanBuild('courthouse', S.citizens)){ const site = civFindSite('courthouse', S.civ.center, {margin:1}); if (site) civStartProject('courthouse', site, {k:'gov'}, {purpose:'civic', why:'too many cases for one magistrate'}); }
  if (J.stage===5 && civHas('courthouse').length) civJusticeStage(6, 'The courthouse is open: trials now have witnesses, evidence and verdicts.');
  const repeat = S.citizens.filter(c=>civLegalScore(c) >= 1.5 || (c.civ.convictions||0)>=2).length;
  if (J.stage>=5 && repeat>=1 && !civHas(['jail','prison']).length && !civProjects().some(p=>p.def==='jail')){ const site = civFindSite('jail', S.civ.center, {margin:1}); if (site) civStartProject('jail', site, {k:'gov'}, {purpose:'civic', why:'the same people keep breaking the law and fines do not stop them'}); }
  if (J.stage===6 && civHas(['jail','prison']).length) civJusticeStage(7, 'A jail stands. Convicts can now be locked up.');
  if (J.stage===7 && (civOrgs(o=>o.biz==='law_office').length || S.citizens.some(c=>kn(c,'law')>=45 && sk(c,'law')>=35 && !c.office))) civJusticeStage(8, 'Professional advocates now argue cases in court.');
  // a town prosecutor once trials are common
  if (J.stage>=8 && !G.offices.prosecutor && J.cases.filter(k=>k.kind==='criminal' && k.status==='judged' && d-(k.judgment.day||0)<=56).length>=3){ const p = S.citizens.filter(c=>kn(c,'law')>=35 && !c.office && !c.jail).sort((a,b)=>sk(b,'law')-sk(a,'law'))[0]; if (p) civAppoint('prosecutor', p, 'to bring criminal cases for the settlement'); }
  // old closed cases keep their outcome, not every detail
  if (d%7===5) J.cases.forEach(k=>{ if (k.status==='open' || d - k.day < 60) return; delete k.pending; delete k.checked; delete k.searched; delete k.motive; if (k.statements && k.statements.length > 6) k.statements = k.statements.slice(0, 6); if (k.log && k.log.length > 4) k.log = k.log.slice(-4); if (k.witnesses && k.witnesses.length > 6) k.witnesses = k.witnesses.slice(0, 6); });
  // jail terms end
  S.citizens.forEach(c=>{ if (c.jail && d >= c.jail){ c.jail = 0; civHear(c, {type:'released', text:'I have served my time.', imp:6, src:'self'}); ev('released'); } });
}
