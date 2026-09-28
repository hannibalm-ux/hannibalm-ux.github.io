/* =====================================================================
   Pixel Town — civilization mode: society
   Problems pile up → someone respected calls a gathering → a council → a leader → offices → elections → laws → taxes → departments.
   Quarrels and thefts → family and retaliation → mediation → a watch → constables → investigators → magistrates → courts → jail → lawyers.
   Parents teach children → teachers → schools → academies → universities. Neighbours trade, send migrants, and sell food at a price.
   ===================================================================== */

// ---------- influence: who people listen to ----------
function civInfluence(c){ return (c.civ.respect||0)*0.5 + (c.age>50 ? (c.age-50)*0.3 : 0) + cog(c,'social')*10 + sk(c,'leadership')*0.15 + (c.traits.includes('Charismatic')?6:0) + Math.min(10, (c.civ.wealth||0)/200) + (hhOf(c) ? hhOf(c).members.length : 0) + (c.office ? 8 : 0); }
function civRespected(n, pred){ return S.citizens.filter(c=>isAdult(c) && (!pred || pred(c))).sort((a,b)=>civInfluence(b)-civInfluence(a)).slice(0, n); }
function civProblemTotal(){ return Object.values(S.civ.problems).reduce((a,b)=>a+b,0); }

// ---------- gatherings and government ----------
function civGovStage(n, text){ const G = S.civ.gov; if (G.stage >= n) return; G.stage = n; G.stageHist.push({stage:n, day:civDay()}); chronicle(text, 8, '🏛️', 'gov'); S.week.society.push(`Government: ${GOV_STAGES[n]}`); ev('gov_stage'); }
function civGathering(reason){
  const C = S.civ, G = C.gov, P = C.problems;
  const convener = G.leader && alive(G.leader) ? alive(G.leader) : civRespected(1)[0]; if (!convener) return;
  const topics = Object.entries(P).filter(([k,v])=>v>=2).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k])=>k);
  if (!topics.length) return;
  const att = S.citizens.filter(c=>isAdult(c) && !c.jail && (c.politics.civicEngagement + c.personality.extraversion*0.3 + (topics.includes(c.civ.worry)?0.5:0)) > 0.55);
  const decisions = [];
  topics.forEach(t=>{ const d = civDecide(t, att, convener); if (d) decisions.push(d); P[t] = Math.floor(P[t]*0.35); });
  const m = {day:civDay(), convener:convener.id, by: G.stage>=2 ? 'council' : 'gathering', n:att.length, topics, decisions}; G.meetings.push(m); if (G.meetings.length>60) G.meetings.shift();
  convener.civ.respect += 1;
  const who = G.stage>=2 ? 'The council' : `${convener.name} called the settlement together`;
  chronicle(`${who}${G.stage>=2?' met':''} about ${topics.map(civProblemLabel).join(', ')} (${att.length} came). ${decisions.length ? 'Agreed: '+decisions.join('; ')+'.' : 'Nothing was agreed.'}`, decisions.length?7:5, '🔥', 'gov');
  ev('gatherings'); S.civ.gatherToday = 1; civGatheringHeard(att, topics, decisions, convener);
  if (G.stage<1) civGovStage(1, `${convener.name} called the first gathering around the fire. The settlement has started to decide things together.`);
  att.forEach(c=>{ c.needs.social = clamp(c.needs.social+10,0,100); });
}
function civProblemLabel(k){ return {food:'food', dispute:'quarrels', crime:'theft', infrastructure:'getting across the river', health:'sickness', housing:'shelter', storage:'spoiling food', injury:'injuries', finance:'money troubles', neglect:'neglected land', growth:'newcomers', education:'the children\'s schooling', water:'water', land:'running out of land', justice:'how guilt is decided'}[k] || k; }
// a decision is a proposal the room supports; what gets proposed depends on what people know how to do
function civDecide(topic, att, convener){
  const C = S.civ, G = C.gov, support = pred => att.filter(pred).length / Math.max(1, att.length);
  const builders = S.citizens.filter(isAdult);
  const perPop = {granary:120, well:45, latrine:35, drying_rack:40, healer_hut:80, clinic:200, school_hut:150, market:300, trading_spot:400, field:60};
  const proj = (def, why, owner) => { if (civProjects().some(p=>p.def===def) || !civCanBuild(def, builders)) return null; if (civHas(def).length >= Math.max(1, Math.floor(S.citizens.length/(perPop[def]||100)))) return null; const site = civFindSite(def, C.center, {margin:1}); if (!site) return null; civStartProject(def, site, owner || (G.stage>=4 ? {k:'gov'} : {k:'community'}), {purpose:'civic', why}); return `build ${an(STRUCTURES[def].label.toLowerCase())}`; };
  switch (topic){
    case 'food': {
      const out = [];
      if (storeFood(C.commons) > 0 && C.rationCap > 120){ C.rationCap = Math.max(100, Math.round(C.rationCap*0.7)); out.push('ration the cache'); }
      if (civFoodDaysAll() < 3 && !C.shipments.some(s=>s.status==='en route')){ const r = civOrderImport('emergency'); if (r) out.push(r); }
      if (!civHas(['granary','warehouse']).length && support(c=>c.civ.cog.planning>0.5) > 0.3){ const r = proj('granary', 'to keep food through the winter'); if (r) out.push(r); }
      if (civTechKnown('cultivation') && !civStructsOf(s=>STRUCTURES[s.def].farm && s.owner.k==='community').length && support(c=>c.values.includes('Community')) > 0.2){ const r = proj('field', 'a common field for everyone'); if (r) out.push('clear a common field'); }
      return out.join(', ') || null; }
    case 'storage': return proj('granary', 'food keeps spoiling') || (civCanBuild('drying_rack', builders) ? proj('drying_rack', 'to dry fish and meat') : null);
    case 'infrastructure': { const cr = Object.values(C.crossing||{}).reduce((a,b)=>a+b,0); if (cr>5){ C.crossing = C.crossing || {}; const y = Object.entries(C.crossing).sort((a,b)=>b[1]-a[1])[0]; if (y) C.crossing[y[0]] += 20; return 'find a way across the river'; } return null; }
    case 'water': return proj('well', 'the walk to the river is too long');
    case 'health': { const out = []; if (!civHas('latrine').length && builders.length>30){ const r = proj('latrine', 'sickness is spreading'); if (r) out.push('dig latrines'); } const h = S.citizens.filter(c=>c.civ.occ==='healer')[0]; if (h && !civHas(['healer_hut','clinic']).length){ const site = civFindSite('healer_hut', C.center, {margin:1}); if (site){ civStartProject('healer_hut', site, {k:'person', id:h.id}, {why:`for ${h.name} to tend the sick`}); out.push(`give ${h.name.split(' ')[0]} a healer's hut`); } } if (civHas('healer_hut').length && civTechKnown('masonry') && !civHas('clinic').length && S.citizens.some(c=>kn(c,'medicine')>=35)){ const r = proj('clinic', 'the healer\'s hut is overflowing'); if (r) out.push(r); } return out.join(', ') || null; }
    case 'housing': { const homeless = Object.values(C.hh).filter(h=>!h.home || !C.structs[h.home]); if (!homeless.length) return null; const h = homeless[0]; if (civProjects().some(p=>p.forHH===h.id)) return null; const site = civFindSite('crude_hut', C.center, {margin:1}); if (!site){ civProblem('land', 3); C.landShort = civDay(); return null; } civStartProject('crude_hut', site, {k:'hh', id:h.id}, {purpose:'home', forHH:h.id, why:'neighbours are helping'}); return `help the ${h.name} household build a hut`; }
    case 'dispute': case 'crime': { const open = C.justice.cases.filter(k=>k.status==='open'); open.slice(0,3).forEach(k=>civMediate(k, convener)); if (topic==='crime' && C.justice.stage<2 && support(c=>c.values.includes('Order')||c.personality.conscientiousness>0.6) > 0.25) { civJusticeStage(2, 'The settlement agreed to keep a night watch.'); civRaiseWatch(); return 'keep a night watch'; } if (G.stage>=2 && !G.laws.theft && topic==='crime'){ civPassLaw('theft', 'Theft must be repaid twice over', convener); return 'a rule against theft'; } return open.length ? `settle ${Math.min(3,open.length)} quarrel${open.length>1?'s':''}` : null; }
    case 'education': return civSchoolDecision(convener);
    case 'growth': return null;
    case 'land': return civDecideLand(convener);
  }
  return null;
}
function civGovDaily(){
  const C = S.civ, G = C.gov, P = C.problems, d = civDay();
  const last = G.meetings[G.meetings.length-1], since = last ? d - last.day : 99;
  const K = C.culture || {freedom:0.25, order:0.25, community:0.25};
  const need = 9 * (1 + K.freedom*0.8 - K.community*0.6 - K.order*0.4);
  if (civProblemTotal() >= need && since >= (G.stage>=2 ? 2 : 3)) civGathering('problems');
  else if (G.stage>=2 && d%7===2 && since>=5 && civProblemTotal()>=3) civGathering('council');
  // council: repeated gatherings with the same respected faces
  const recent = G.meetings.filter(m=>d-m.day<=28).length;
  const since1 = G.stageHist.length ? d - G.stageHist[G.stageHist.length-1].day : 0;
  if (G.stage===1 && recent >= 4 && since1 >= 21){
    const values = S.citizens.filter(isAdult).reduce((a,c)=>{ c.values.forEach(v=>a[v]=(a[v]||0)+1); return a; }, {});
    const top = Object.entries(values).sort((a,b)=>b[1]-a[1])[0][0];
    G.form = top==='Tradition' ? 'council of elders' : top==='Prosperity' ? 'merchant council' : top==='Order' ? 'chieftaincy' : top==='Freedom' ? 'assembly' : top==='Community' ? 'assembly' : GOV_FORMS[hash(String(C.seed))%GOV_FORMS.length];
    const pool = G.form==='council of elders' ? civRespected(5, c=>c.age>=45) : G.form==='merchant council' ? S.citizens.filter(isAdult).sort((a,b)=>(b.civ.wealth||0)-(a.civ.wealth||0)).slice(0,5) : civRespected(5);
    G.council = pool.map(c=>c.id); pool.forEach(c=>{ c.office = 'Council'; c.civ.respect += 3; });
    civGovStage(2, `A ${G.form} has formed: ${pool.map(c=>c.name).join(', ')} will meet regularly to settle the settlement's business.`);
  }
  // leadership: when the council cannot keep up with a crisis
  if (G.stage===2 && since1 >= 21 && (P.food>12 || P.crime>6 || P.dispute>8 || P.growth>6 || recent>=6)){
    const lead = (G.form==='assembly' ? civRespected(1) : civRespected(1, c=>G.council.includes(c.id)))[0] || civRespected(1)[0];
    if (lead){ G.leader = lead.id; lead.office = 'Leader'; const title = G.form==='chieftaincy' ? 'chief' : G.form==='council of elders' ? 'eldest speaker' : G.form==='merchant council' ? 'first merchant' : G.form==='theocratic circle' ? 'high speaker' : 'headman';
      G.title = title; civGovStage(3, `${lead.name} has been recognised as the settlement's ${title}.`); remember(lead, `They made me ${title}.`, 9); }
  }
  if (G.leader && !alive(G.leader)){ G.leader = null; civProblem('dispute', 4); if (G.stage>=3) civSuccession(); }
  G.council = G.council.filter(id=>alive(id));
  // offices appear when a job needs doing
  if (G.stage>=3 && (G.stage>3 || since1 >= 14)){
    // offices are paid where the culture expects it; freedom-minded settlements rely on volunteers
    G.paidOffices = (C.culture ? C.culture.order + C.culture.community >= C.culture.freedom : true);
    if (!G.offices.treasurer && (civMoneyOn() && (C.fund||0) + G.treasury > 30)){ const t = civRespected(1, c=>kn(c,'finance')+kn(c,'mathematics')>15 && !c.office)[0]; if (t) civAppoint('treasurer', t, 'to look after the common purse'); }
    if (!G.offices.watch_captain && C.justice.stage>=2){ const w = S.citizens.filter(c=>c.civ.watch && !c.office).sort((a,b)=>civInfluence(b)-civInfluence(a))[0]; if (w) civAppoint('watch_captain', w, 'to lead the night watch'); }
    if (!G.offices.magistrate && C.justice.stage>=4 && C.justice.cases.filter(k=>d-k.day<56).length>=6){ const m = civRespected(1, c=>kn(c,'law')>=15 && !c.office)[0] || civRespected(1, c=>c.civ.cog.emotional>0.6 && !c.office)[0]; if (m){ civAppoint('magistrate', m, 'to judge disputes'); civJusticeStage(5, `${m.name} now sits as magistrate.`); } }
    if (Object.keys(G.offices).length && G.stage<4) civGovStage(4, `The settlement now has formal offices: ${Object.keys(G.offices).map(k=>k.replace('_',' ')).join(', ')}.`);
  }
  civTaxDaily();
}
function civAppoint(office, c, why){ const G = S.civ.gov; G.offices[office] = c.id; c.office = office.replace('_',' ').replace(/\b\w/g,m=>m.toUpperCase()); chronicle(`${c.name} was appointed ${office.replace('_',' ')} ${why}.`, 6, '🎖️', 'gov'); c.civ.respect += 3; }
function civSuccession(){
  const G = S.civ.gov;
  if (G.stage>=5) return civElection('the leader died');
  const heir = G.form==='chieftaincy' ? S.citizens.filter(c=>isAdult(c) && G.lastLeaderKin && G.lastLeaderKin.includes(c.id))[0] : null;
  const lead = heir || civRespected(1, c=>G.council.includes(c.id))[0] || civRespected(1)[0]; if (!lead) return;
  G.leader = lead.id; lead.office = 'Leader'; chronicle(`${lead.name} succeeded as ${G.title||'leader'}.`, 7, '🏛️', 'gov');
}
// elections come from a crisis of legitimacy, in places that value having a say
function civElectionsWeekly(){
  const C = S.civ, G = C.gov, d = civDay(); if (G.stage<3) return;
  const lead = G.leader && alive(G.leader);
  const avgOp = lead ? S.citizens.filter(isAdult).reduce((a,c)=>a+peekRel(c,lead.id).affinity,0)/Math.max(1,S.citizens.filter(isAdult).length) : -50;
  const voice = S.citizens.filter(c=>isAdult(c) && (c.values.includes('Freedom') || c.values.includes('Community'))).length / Math.max(1, S.citizens.filter(isAdult).length);
  const noVotes = ['chieftaincy','theocratic circle','oligarchy'].includes(G.form) && voice < 0.55;
  if (G.stage<5 && !noVotes && (avgOp < 0 || !lead) && voice > 0.3 && civTechKnown('counting')){ civElection('people wanted a say in who leads'); civGovStage(5, 'The settlement held its first election.'); return; }
  if (G.stage>=5 && G.elections.length && d - G.elections[G.elections.length-1].day >= 56) civElection('the term was up');
}
function civElection(why){
  const G = S.civ.gov, voters = S.citizens.filter(c=>isAdult(c) && c.age>=18 && !c.jail && !c.away);
  const cands = voters.filter(c=>c.politics.civicEngagement + (c.traits.includes('Ambitious')?0.3:0) + (c.office?0.3:0) + civInfluence(c)/60 > 0.9).sort((a,b)=>civInfluence(b)-civInfluence(a)).slice(0,4);
  if (cands.length<1) return;
  // candidates stand for what they care about most; voters weigh that, the candidate's record as they know it, their own lives, and family talk
  cands.forEach(c=>{ const pl = civPlatform(c); if (pl.length && rnd()<0.7) chronicle(`${c.name} is standing on ${pl.map(([t,d])=>(d>0?'':'no ')+topicLabel(t)).join(' and ')}.`, 4, '📣', 'gov'); });
  const tally = civVote(voters, cands);
  const win = cands.sort((a,b)=>(tally[b.id]||0)-(tally[a.id]||0))[0];
  const was = G.leader && alive(G.leader); if (was && was!==win) was.office = null;
  G.leader = win.id; win.office = 'Leader';
  G.elections.push({day:civDay(), winner:win.id, votes:tally[win.id]||0, turnout:voters.length, cands:cands.map(c=>({id:c.id, v:tally[c.id]||0, pl:civPlatform(c)})), why});
  chronicle(`Election: ${win.name} won with ${tally[win.id]||0} of ${voters.length} votes (${why}).`, 8, '🗳️', 'gov'); S.week.election = {leader:{name:win.name, votes:tally[win.id]||0}, turnout:voters.length}; ev('elections');
}
// laws answer problems the settlement has actually had
const CIV_LAWS = {
  theft:         {label:'Theft must be repaid twice over', when: C=>C.stats.thefts>=3},
  contracts:     {label:'Agreements before witnesses are binding', when: C=>C.stats.k_loan>=3 || C.stats.k_employment>=3},
  land_registry: {label:'Land claims are written in a register', when: C=>C.stats.property_disputes>=1 || C.stats.property_sales>=3, tech:'writing'},
  building_code: {label:'Buildings must be soundly made', when: C=>C.stats.demolished>=3},
  insider_trading:{label:'Trading shares on inside knowledge is a crime', when: C=>C.stats.insider_trades>=3 && C.exchange},
  no_tolls:      {label:'No private tolls on bridges', when: C=>C.stats.tolls>=40 && S.citizens.filter(c=>c.values.includes('Freedom')||c.values.includes('Community')).length > S.citizens.length*0.45},
  schooling:     {label:'Children must attend school', when: C=>C.edu.stage>=3},
  sanitation:    {label:'Waste must be kept away from water', when: C=>C.stats.illness>=25},
  food_reserve:  {label:'A share of every harvest goes to the granary', when: C=>C.stats.harvests>=4 && civHas(['granary','warehouse']).length && C.problems.food>4},
  bankruptcy:    {label:'Insolvent debtors may be discharged by the court', when: C=>C.stats.bankruptcies>=1 && C.justice.stage>=6}
};
function civPassLaw(key, label, by){ const G = S.civ.gov; if (G.laws[key]) return; G.laws[key] = {label: label || CIV_LAWS[key].label, day:civDay(), by: by ? by.id : null}; chronicle(`New law: ${G.laws[key].label}.`, 8, '📜', 'law'); S.week.society.push(`Law: ${G.laws[key].label}`); ev('laws'); if (G.stage<6) civGovStage(6, 'The settlement now has written or spoken laws, not just customs.'); }
function civLawsWeekly(){ const C = S.civ, G = C.gov; if (G.stage<2) return; for (const k in CIV_LAWS){ const L = CIV_LAWS[k]; if (G.laws[k] || (L.tech && !civTechKnown(L.tech))) continue; if (L.when(C)){ const by = G.leader && alive(G.leader) || civRespected(1, c=>G.council.includes(c.id))[0]; civPassLaw(k, null, by); break; } } }
// taxes appear only when the government has bills to pay
function civTaxDaily(){
  const C = S.civ, G = C.gov, d = civDay(); if (!civMoneyOn() || G.stage<3) return;
  const bills = (G.paidOffices===false ? 0 : Object.keys(G.offices).length*1.5) + civProjects().filter(p=>p.owner.k==='gov' && p.pay).length*3 + (civProjects().filter(p=>p.owner.k==='gov').length ? 2 : 0);
  const lastStage = G.stageHist.length ? G.stageHist[G.stageHist.length-1].day : 0;
  const K = C.culture || {freedom:0.25, order:0.25, community:0.25}, taxMood = 0.4 + K.order + K.community - K.freedom*1.2;
  if (!G.taxes.rate && G.stage>=4 && bills > 0 && G.treasury < bills*7 && d - lastStage >= 21 && hashf(d, 3, C.seed&1023) < clamp(taxMood, 0.05, 1)*0.2){
    const form = G.form==='merchant council' ? 'trade' : G.form==='assembly' ? 'income' : 'hearth';
    G.taxes = {rate: form==='hearth' ? 1 : 0.04, form, since:civDay()}; chronicle(`To pay for its offices, the settlement introduced a ${form} tax.`, 8, '💰', 'gov'); if (G.stage<7) civGovStage(7, 'The government now raises taxes.'); ev('taxes');
  }
  if (G.taxes.rate && civDay()%7===0){
    let got = 0;
    if (G.taxes.form==='hearth') Object.values(C.hh).forEach(h=>{ const p = civOwnerPurse({k:'hh', id:h.id}); if (civMoveMoney(p, {k:'gov'}, G.taxes.rate*(C.econ.level||1), 'tax')){ got += G.taxes.rate; hhAdults(h).forEach(a=>{ const w = cogOf(a).week = cogOf(a).week || {}; w.tax = (w.tax||0) + G.taxes.rate*(C.econ.level||1)/Math.max(1, hhAdults(h).length); }); } });
    else S.citizens.filter(c=>isAdult(c) && c.wallet > 20).forEach(c=>{ const w = weekSum(c,'inc'), t = Math.round(w*G.taxes.rate*100)/100; if (t>0 && civMoveMoney({k:'person',id:c.id}, {k:'gov'}, t, 'tax')){ got += t; const w = cogOf(c).week = cogOf(c).week || {}; w.tax = (w.tax||0) + t; } });
    civOrgs(o=>o.biz && o.profitAvg>0).forEach(o=>{ const t = +(o.profitAvg*0.05).toFixed(2); if (civMoveMoney(civOrgPurse(o), {k:'gov'}, t, 'tax')) got += t; });
    G.taxWk = Math.round(got); if (S.week) S.week.taxes += Math.round(got);
    // pay the office holders
    if (G.paidOffices!==false) Object.values(G.offices).forEach(id=>{ const c = alive(id); if (c) civMoveMoney({k:'gov'}, {k:'person', id}, 3*(C.econ.level||1), 'salary'); });
  }
  // departments: once the government is running several kinds of service
  if (G.stage===7){ const kinds = new Set(); if (civProjects().some(p=>p.owner.k==='gov') || civStructsOf(s=>s.owner.k==='gov').length) kinds.add('public works'); if (C.justice.stage>=3) kinds.add('justice'); if (C.edu.stage>=3) kinds.add('education'); if (civHas(['clinic','hospital']).length) kinds.add('health'); if (G.offices.treasurer) kinds.add('treasury');
    if (kinds.size>=4 && G.treasury > 150){ G.depts = [...kinds]; civGovStage(8, `The government has organised itself into departments: ${G.depts.join(', ')}.`); } }
}

// ---------- justice ----------
function civJusticeStage(n, text){ const J = S.civ.justice; if (J.stage >= n) return; J.stage = n; J.stageHist.push({stage:n, day:civDay()}); chronicle(text, 7, '⚖️', 'justice'); S.week.society.push(`Justice: ${JUSTICE_STAGES[n]}`); ev('justice_stage'); }
function civCaseFile(kind, type, plaintiff, defendant, claim, damages, contract){
  const J = S.civ.justice;
  if (defendant && J.cases.some(k=>k.status==='open' && k.type===type && k.defendant && k.defendant.id===defendant.id && k.plaintiff && plaintiff && k.plaintiff.id===plaintiff.id)) return null;
  const at = plaintiff && plaintiff.k==='person' && alive(plaintiff.id) ? [alive(plaintiff.id).rt.x, alive(plaintiff.id).rt.y] : null;
  const k = {id:'case_'+(++J.seq), kind, type, plaintiff, defendant, claim, damages:Math.round(damages||0), day:civDay(), at, status:'open', evidence:[], witnesses:[], log:[], contract: contract ? contract.id : null, settlement:null, judgment:null};
  if (contract){ k.evidence.push(contract.written ? 'written contract' : 'spoken agreement'); if (!contract.written) k.weak = true; }
  J.cases.push(k); if (J.cases.length>300) J.cases.splice(0, J.cases.length-300);
  ev(kind==='civil' ? 'civil_cases' : 'criminal_cases'); ev('case_'+type.replace(/\s/g,'_'));
  civProblem(kind==='civil' ? 'dispute' : 'crime', 2);
  if (kind==='civil') chronicle(`${civCaseParty(plaintiff)} brought a claim against ${civCaseParty(defendant)} over ${claim}${damages?` (${Math.round(damages)}¢)`:''}.`, 5, '📄', 'justice');
  return k;
}
function civTrueCase(k){ if (k) k.truth = true; return k; }
function civCaseParty(p){ if (!p) return 'nobody'; if (p.k==='estate') return `the estate of ${p.name}`; return civOwnerLabel(p); }
// resolving cases with whatever the settlement has: family, a mediator, a magistrate, a court, lawyers
function civWatch(){ return S.citizens.filter(c=>c.civ.watch && isAdult(c)).sort((a,b)=>civInfluence(b)-civInfluence(a)); }
function civRaiseWatch(){ civRespected(6, c=>c.age<55 && (c.values.includes('Order') || c.personality.conscientiousness>0.55)).forEach(c=>{ c.civ.watch = 1; }); }
function civMediator(k){ const involved = k ? [k.plaintiff, k.defendant].filter(p=>p && p.k==='person').map(p=>p.id) : []; return S.citizens.filter(c=>isAdult(c) && !involved.includes(c.id) && c.civ.cog.emotional > 0.5 && civInfluence(c) > 12).sort((a,b)=>civInfluence(b)+b.civ.cog.emotional*10 - civInfluence(a)-a.civ.cog.emotional*10)[0] || null; }
function civMediate(k, m){
  if (!k || k.status!=='open' || !m || !k.defendant) return; // nobody to reconcile with until someone is accused
  if (k.kind==='criminal' && S.civ.justice.stage>=5) return; // with a magistrate, crimes go to a hearing, not a friendly word
  const skill = m.civ.cog.emotional*0.5 + m.civ.cog.social*0.3 + kn(m,'law')/200;
  if (rnd() < 0.35 + skill*0.5){
    const pay = Math.round((k.damages||0)*(0.4 + civEvidence(k)*0.5));
    if (pay>0 && k.defendant && k.plaintiff) civMoveMoney(civOwnerPurse(k.defendant), civOwnerPurse(k.plaintiff), Math.min(pay, civPurse(civOwnerPurse(k.defendant))), 'settlement');
    k.status = 'settled'; k.settlement = {by:m.id, amount:pay, day:civDay()}; m.civ.respect += 1; m.civ.log.mediate = (m.civ.log.mediate||0)+2;
    if (k.defendant && k.defendant.k==='person'){ const dfd = alive(k.defendant.id); if (dfd){ const p = k.plaintiff && k.plaintiff.k==='person' && alive(k.plaintiff.id); if (p) adjustRel(p, dfd, 5); } }
    chronicle(`${m.name} settled ${civCaseParty(k.plaintiff)}'s complaint against ${civCaseParty(k.defendant)}${pay?`: ${pay}¢ in compensation`:''}.`, 4, '🤝', 'justice'); ev('mediations');
  } else k.log.push({day:civDay(), note:`${m.name} could not settle it`});
}
function civInformal(k){
  const p = k.plaintiff && k.plaintiff.k==='person' && alive(k.plaintiff.id), d = k.defendant && k.defendant.k==='person' && alive(k.defendant.id);
  if (!p || !d){ k.status = 'dropped'; return; }
  const kin = S.citizens.find(x=>x!==p && x!==d && peekRel(x,p.id).tags.includes('Family') && peekRel(x,d.id).affinity>10);
  if (kin && rnd()<0.5){ k.status = 'settled'; k.settlement = {by:kin.id, family:true}; chronicle(`${kin.name} smoothed things over between ${p.name} and ${d.name}.`, 3, '👪', 'justice'); return; }
  if (p.personality.agreeableness < 0.35 && rnd()<0.4){ adjustRel(p, d, -20); adjustRel(d, p, -20); d.civ.hurt = rnd()<0.3 ? 1 : 0; k.status = 'retaliation'; chronicle(`${p.name} took matters into their own hands against ${d.name}.`, 5, '👊', 'justice'); civProblem('crime', 1); ev('retaliations'); return; }
  if (k.damages && rnd()<0.3){ const pay = Math.round(k.damages*0.5); const st = hhOf(d) && hhOf(p); if (civMoneyOn()) civMoveMoney({k:'person', id:d.id}, {k:'person', id:p.id}, Math.min(pay, d.wallet), 'compensation'); k.status = 'settled'; k.settlement = {amount:pay, informal:true}; }
}
// civil disputes that grow out of the economy
function civCivilWeekly(){
  civOrgs(o=>o.type==='partnership' && o.profitAvg < -1 && Object.keys(o.owners).length>=2).forEach(o=>{ const [a,b] = Object.keys(o.owners).map(alive).filter(Boolean); if (a && b && peekRel(a,b.id).affinity < 20 && rnd()<0.25) civCaseFile('civil', 'partnership', {k:'person', id:a.id}, {k:'person', id:b.id}, `how ${o.name} is run`, Math.round(Math.abs(o.profitAvg)*10)); });
  civOrgs(o=>(o.type==='corporation'||o.type==='public_corp') && o.profitAvg < 0 && !o.divs).forEach(o=>{ const minor = Object.entries(o.owners).filter(([id,n])=>n < o.shares*0.2).map(([id])=>alive(id)).filter(Boolean)[0]; if (minor && rnd()<0.15) civCaseFile('civil', 'shareholder', {k:'person', id:minor.id}, {k:'org', id:o.id}, `mismanagement of ${o.name}`, Math.round(o.sharePrice*(o.owners[minor.id]||0)*0.3)); });
  // fraud: a cunning trader short-changes someone
  S.citizens.filter(c=>c.civ.occ==='trader' && c.traits.includes('Cunning') && rnd()<0.08).forEach(c=>{ const v = S.citizens.find(o=>o!==c && isAdult(o) && hhOf(o)!==hhOf(c)); if (v) { const k = civCaseFile('civil', 'fraud', {k:'person', id:v.id}, {k:'person', id:c.id}, 'being cheated in a trade', 6*(S.civ.econ.level||1)); if (k) k.truth = true; } });
  // animals trampling a neighbour's crop; a roof falling on someone
  civStructsOf(s=>STRUCTURES[s.def].ranch).forEach(p=>{ const f = civStructsOf(s=>STRUCTURES[s.def].farm && s.owner.id!==p.owner.id && Math.hypot(s.x-p.x,s.y-p.y)<8)[0]; if (f && p.cond<50 && rnd()<0.2){ const a = civOwnerPurse(f.owner), b = civOwnerPurse(p.owner); if (a.k==='person' && b.k==='person') civTrueCase(civCaseFile('civil', 'damaged property', a, b, `animals trampling ${f.name}`, 8)); } });
  civStructsOf(s=>STRUCTURES[s.def].home && s.cond < 15 && s.occ).forEach(s=>{ if (rnd()<0.1){ const h = S.civ.hh[s.occ]; const vic = h && hhMembers(h)[0]; if (vic){ vic.civ.hurt = 1; if (s.owner.k!=='hh' || s.owner.id!==h.id){ const own = civOwnerPurse(s.owner); civTrueCase(civCaseFile('civil', 'negligence', {k:'person', id:vic.id}, own, `a collapsing roof at ${s.name}`, 15)); civTrueCase(civCaseFile('civil', 'personal injury', {k:'person', id:vic.id}, own, 'injuries from the collapse', 10)); } } } });
  // disputed land: two households claim the same patch when land runs short
  if (civLandPrice(S.civ.center[0], S.civ.center[1]) > 12 && rnd()<0.15){ const hs = Object.values(S.civ.hh).filter(h=>h.home); const a = hs[Math.floor(rnd()*hs.length)], b = hs[Math.floor(rnd()*hs.length)]; if (a && b && a!==b){ const pa = hhAdults(a)[0], pb = hhAdults(b)[0]; if (pa && pb){ civCaseFile('civil', 'property', {k:'person', id:pa.id}, {k:'person', id:pb.id}, 'where one plot ends and the other begins', 12); ev('property_disputes'); } } }
}

// ---------- education ----------
function civEduStage(n, text){ const E = S.civ.edu; if (E.stage >= n) return; E.stage = n; E.stageHist.push({stage:n, day:civDay()}); chronicle(text, 7, '📚', 'learning'); S.week.society.push(`Education: ${EDU_STAGES[n]}`); ev('edu_stage'); }
function civSchoolFor(c){
  if (isAdult(c)) return null;
  const sch = civOrgs(o=>o.type==='school' && o.hq && S.civ.structs[o.hq] && o.staff.length).sort((a,b)=>(b.edu.level||1)-(a.edu.level||1))[0];
  if (sch){ const s = S.civ.structs[sch.hq]; const L = LOC[s.id]; return {id:sch.id, name:sch.name, loc:s.id, xy: L && L.door ? L.door : [s.x, s.y+s.h]}; }
  // informal lessons: a teacher on the commons
  const t = S.citizens.find(x=>x.civ.occ==='teacher' && x.plan && x.plan.blocks.some(b=>b.task==='teach'));
  if (t && c.age>=6){ const b = t.plan.blocks.find(b=>b.task==='teach'); return {id:null, name:`${t.name.split(' ')[0]}'s lessons`, loc:b.loc, xy:b.xy}; }
  return null;
}
CIV_TARGETS.teach = c => { const sch = civOrgs(o=>o.type==='school' && o.staff.includes(c.id))[0]; if (sch && sch.hq && S.civ.structs[sch.hq]){ const s = S.civ.structs[sch.hq]; return {loc:s.id, note:`Teaching at ${sch.name}`, extra:{}}; } const [cx,cy] = S.civ.center; return {loc:'loc_town_square', xy:[cx-2, cy+1], note:'Teaching the children on the commons'}; };
CIV_TASK_VALUE.teach = (c) => { const kids = S.citizens.filter(k=>!isAdult(k) && k.age>=6).length; const paid = civOrgs(o=>o.type==='school' && o.staff.includes(c.id)).length; return Math.min(kids, 14)*0.6*(c.values.includes('Tradition')||c.values.includes('Community')?1.3:1) + (paid ? 8 : 0) + (civHasGoal(c,'respect')?3:0); };
CIV_WORK.teach = (c, b, hrs) => {
  const pupils = S.citizens.filter(k=>!isAdult(k) && k.plan && k.plan.blocks[k.rt.blockIdx] && k.plan.blocks[k.rt.blockIdx].act==='Learn' && Math.hypot(k.rt.x-c.rt.x, k.rt.y-c.rt.y)<6);
  pupils.forEach(k=>{ civTeachOne(c, k, hrs); c.civ.buyers.teach = c.civ.buyers.teach || {}; c.civ.buyers.teach[k.parents[0]||k.id] = 1; });
  c.civ.skill.teaching = Math.min(100, sk(c,'teaching') + hrs*0.3*(pupils.length?1:0.3));
  return {value: pupils.length*1.2 + 1, why: pupils.length ? null : 'no pupils came'};
};
function civTeachOne(t, k, hrs){
  const sch = civOrgs(o=>o.type==='school' && o.staff.includes(t.id))[0], lvl = sch ? sch.edu.level : 1;
  const curric = lvl>=5 ? ['mathematics','physics','chemistry','biology','medicine','law','finance','engineering','history'] : lvl>=4 ? ['mathematics','physics','chemistry','biology','history','geography','literacy'] : lvl>=3 ? ['literacy','mathematics','history','geography','biology'] : ['literacy','mathematics','history','wilderness','foodcraft'];
  const rate = hrs*(0.25 + sk(t,'teaching')/200 + kn(t,'teaching')/300)*(0.4 + cog(k,'learning'));
  curric.forEach(d=>{ const tv = kn(t,d); if (tv <= kn(k,d)) return; k.civ.know[d] = +Math.min(tv, kn(k,d) + rate*(tv-kn(k,d))/40).toFixed(2); });
  if (sch && sch.edu.trade){ const sks = Object.keys(t.civ.skill).filter(s=>sk(t,s)>40); sks.slice(0,2).forEach(s=>{ k.civ.skill[s] = +Math.min(sk(t,s), sk(k,s)+rate*0.8).toFixed(2); }); }
  ev('lessons');
}
CIV_WORK.learn = (c, b, hrs) => {
  // study at a school, a library or a university; pupils also pick up a little on their own
  const lib = civHas('library').length && kn(c,'literacy') >= 25;
  if (lib){ (S.civ.books||[]).forEach(bk=>{ if (kn(c,bk.dom) < bk.lvl) c.civ.know[bk.dom] = +(kn(c,bk.dom) + hrs*0.4*(0.5+cog(c,'learning'))).toFixed(2); }); ev('reading'); }
  c.civ.know.literacy = +Math.min(100, kn(c,'literacy') + hrs*0.05).toFixed(2);
  return {value:1, why:null};
};
// parents and relatives teach what they know, a little every day
function civEducationDaily(){
  S.citizens.filter(k=>!isAdult(k) && k.age>=3).forEach(k=>{
    k.parents.map(alive).filter(Boolean).forEach(p=>{ const doms = Object.keys(p.civ.know).filter(d=>kn(p,d) > kn(k,d)+5); if (!doms.length) return; const d = doms[hash(k.id+civDay())%doms.length]; k.civ.know[d] = +(kn(k,d) + (kn(p,d)-kn(k,d))*0.004*(0.5+cog(k,'learning'))*(0.6+kn(p,'teaching')/80)).toFixed(2); });
    // children absorb their parents' techniques as they grow
    if (k.age>=10) k.parents.map(alive).filter(Boolean).forEach(p=>p.civ.techs.forEach(t=>{ if (!knowsTech(k,t) && civCanGrasp(k,t) && rnd()<0.01) civLearnTech(k, t, p); }));
  });
  const E = S.civ.edu;
  if (E.stage<1 && S.citizens.some(c=>c.civ.occ==='teacher')) E.stage = 1;
  // writing lets the learned leave books behind
  if (civTechKnown('writing') && civDay()%14===0){ const auth = S.citizens.filter(c=>kn(c,'literacy')>=35).sort((a,b)=>Math.max(...Object.values(b.civ.know))-Math.max(...Object.values(a.civ.know)))[0]; if (auth){ const [dom, lvl] = Object.entries(auth.civ.know).filter(([d])=>d!=='literacy').sort((a,b)=>b[1]-a[1])[0] || []; if (dom){ S.civ.books = (S.civ.books||[]).concat({dom, lvl:Math.round(lvl*0.8), by:auth.id, day:civDay()}).slice(-40); S.civ.library = [...new Set((S.civ.library||[]).concat(auth.civ.techs))]; ev('books'); if ((S.civ.books.length)%5===1) chronicle(`${auth.name} wrote down what they know of ${KN[dom].label.toLowerCase()}.`, 4, '📖', 'learning'); } } }
}
function civSchoolDecision(convener){
  const C = S.civ, kids = S.citizens.filter(k=>!isAdult(k) && k.age>=6);
  const teacher = S.citizens.filter(c=>isAdult(c) && (c.civ.occ==='teacher' || sk(c,'teaching')>=25 || kn(c,'teaching')>=25)).sort((a,b)=>sk(b,'teaching')-sk(a,'teaching'))[0];
  if (kids.length < 6 || !teacher) return null;
  if (civOrgs(o=>o.type==='school').length) return null;
  const o = civNewOrg('school', `${S.civ.stageLabel||'Settlement'} School`, [teacher], {edu:{level:1}}); o.staff.push(teacher.id); o.mgr = teacher.id; teacher.civ.employer = o.id;
  const site = civFindSite('school_hut', C.center, {margin:1}); if (site) civStartProject('school_hut', site, {k:'org', id:o.id}, {org:o.id, purpose:'education', why:`for ${teacher.name.split(' ')[0]}'s pupils`});
  civEduStage(2, `The settlement started a small community school, with ${teacher.name} teaching.`); ev('schools');
  return 'start a school';
}
function civEducationWeekly(){
  const C = S.civ, E = C.edu;
  if (E.stage===1 && C.problems.education===undefined){ const kids = S.citizens.filter(k=>!isAdult(k) && k.age>=6).length; if (kids>=8) civProblem('education', 1); }
  if (E.stage>=1 && E.stage<2 && S.citizens.filter(k=>!isAdult(k) && k.age>=6).length>=6 && S.citizens.some(c=>c.values.includes('Tradition')||c.values.includes('Craftsmanship'))) civProblem('education', 2);
  civOrgs(o=>o.type==='school').forEach(o=>{
    o.staff = o.staff.filter(id=>alive(id));
    const lit = o.staff.map(alive).filter(Boolean);
    // levels rise with qualified teachers and proper buildings
    const s = o.hq && C.structs[o.hq], lvl = o.edu.level;
    if (lvl===1 && civTechKnown('writing') && lit.some(t=>kn(t,'literacy')>=30)){ o.edu.level = 2; civEduStage(3, `${o.name} now teaches reading, writing and sums: a proper primary school.`); }
    if (lvl===2 && lit.length>=2 && s && s.def!=='school_hut'){ o.edu.level = 3; civEduStage(4, `${o.name} has grown into a secondary school.`); }
    if (lvl===2 && s && s.def==='school_hut' && civCanBuild('school', lit) && !civProjects().some(p=>p.upgradeOf===s.id)){ civStartProject('school', {x:s.x, y:s.y, w:5, h:3}, s.owner, {upgradeOf:s.id, purpose:'education', why:'the schoolhouse is too small'}); }
    if (!o.staff.length){ o.idle = (o.idle||0)+1; if (o.idle>4){ civOrgDissolve(o, 'closed'); if (s){ s.forSale = civMoneyOn(); s.price = s.value; } } } else o.idle = 0;
    // hire another teacher if there are many pupils
    const pupils = S.citizens.filter(k=>!isAdult(k) && k.age>=6).length; if (pupils > o.staff.length*14){ const t = S.citizens.find(c=>isAdult(c) && !c.civ.job && kn(c,'teaching')+sk(c,'teaching') > 35); if (t){ o.staff.push(t.id); t.civ.employer = o.id; chronicle(`${t.name} joined ${o.name} as a teacher.`, 4, '🧑‍🏫', 'learning'); } }
    // school fees or public funds pay teachers
    if (civMoneyOn()) o.staff.forEach(id=>{ const pay = 2*(C.econ.level||1); if (!civMoveMoney({k:'gov'}, {k:'person', id}, pay, 'salary')) civMoveMoney({k:'community'}, {k:'person', id}, pay, 'salary'); });
  });
  // trade school, academy, college, university, research university
  const mentors = S.citizens.filter(c=>c.civ.mentor).length;
  const scholars = S.citizens.filter(c=>Math.max(0, ...SCIENCES.map(s=>kn(c,s))) >= 45);
  const inst = (def, lvl, stage, text, trade) => { if (civHas(def).length || civProjects().some(p=>p.def===def) || !civCanBuild(def, S.citizens)) return; const site = civFindSite(def, C.center, {margin:1}); if (!site) return; const head = scholars[0] || S.citizens.filter(c=>c.civ.occ==='teacher')[0]; if (!head) return; const o = civNewOrg('school', `${STRUCTURES[def].label} of ${S.civ.stageLabel||'the settlement'}`, [head], {edu:{level:lvl, trade:!!trade}}); o.staff.push(head.id); civStartProject(def, site, {k:'org', id:o.id}, {org:o.id, purpose:'education', why:text}); };
  if (E.stage>=4 && mentors>=6) inst('trade_school', 3, 5, 'so apprentices can learn trades properly', true);
  if (civHas('trade_school').length) civEduStage(5, 'A trade school now teaches crafts and building.');
  if (E.stage>=4 && scholars.length>=3 && (C.gov.treasury>200 || S.citizens.some(c=>c.wallet>800))) inst('academy', 4, 6, 'for the settlement\'s scholars');
  if (civHas('academy').length) civEduStage(6, 'An academy has opened for advanced study.');
  if (E.stage>=6 && scholars.length>=4 && civHas('library').length) inst('college', 5, 7, 'the academy has outgrown itself');
  if (civHas('college').length) civEduStage(7, 'A college now awards degrees.');
  if (E.stage>=7 && scholars.length>=6 && civHas(['laboratory','institute']).length) inst('university', 6, 8, 'a university for the region');
  if (civHas('university').length){ civEduStage(8, 'The settlement has a university.'); if (C.research.filter(r=>r.status==='active').length>=3) civEduStage(9, 'The university has become a research university.'); }
  if (!civHas('library').length && (S.civ.books||[]).length>=10 && !civProjects().some(p=>p.def==='library') && civCanBuild('library', S.citizens)){ const site = civFindSite('library', C.center, {margin:1}); if (site) civStartProject('library', site, C.gov.stage>=4 ? {k:'gov'} : {k:'community'}, {purpose:'education', why:'there are books enough to keep'}); }
}

// ---------- health care ----------
CIV_TARGETS.heal = c => { const p = S.citizens.filter(o=>(o.sick||o.civ.hurt) && o!==c).sort((a,b)=>Math.hypot(a.rt.x-c.rt.x,a.rt.y-c.rt.y)-Math.hypot(b.rt.x-c.rt.x,b.rt.y-c.rt.y))[0]; const hut = civStructsOf(s=>['healer_hut','clinic','hospital'].includes(s.def) && (civOwnedBy(s.owner,c) || s.org===c.civ.employer))[0];
  if (hut){ return {loc:hut.id, note:`Tending the sick at ${hut.name}`, extra:{}}; } if (!p) return null; return {loc: LOC[p.home] ? p.home : 'loc_town_square', note:`Tending ${p.name}`, extra:{patient:p.id}}; };
CIV_TASK_VALUE.heal = (c) => { const n = S.citizens.filter(o=>o.sick||o.civ.hurt).length; return Math.min(n, 8)*2.2*(0.5 + c.personality.agreeableness) + (c.civ.occ==='healer' ? 4 : 0); };
CIV_WORK.heal = (c, b, hrs) => {
  const pts = S.citizens.filter(o=>(o.sick||o.civ.hurt) && o!==c).slice(0, Math.max(1, Math.round(hrs*1.5)));
  const care = (0.3 + sk(c,'medicine')/100 + (knowsTech(c,'herbal_remedies')?0.15:0) + (knowsTech(c,'surgery')?0.1:0)) * civTheoryMult('care');
  let helped = 0; pts.forEach(p=>{ if (rnd() < care){ p.civ.treated = 1; if (p.civ.hurt && rnd()<care) p.civ.hurt = 0; helped++; civCredit(c, 'heal', p); adjustRel(p, c, 4); if (civMoneyOn() && p.wallet > 3) civMoveMoney({k:'person', id:p.id}, {k:'person', id:c.id}, 2*(S.civ.econ.level||1), 'care'); } });
  if (helped) ev('treatments', helped);
  return {value: helped*4, why: pts.length ? (helped ? null : 'the remedies did not work') : 'nobody needed me'};
};

// ---------- sport: games → teams → clubs → a league ----------
function civSportWeekly(){
  const C = S.civ, SP = C.sports, d = civDay();
  // a rest-day game on the commons among the young and restless
  const players = S.citizens.filter(c=>isAdult(c) && c.age<36 && (c.personality.extraversion>0.5 || sk(c,'athletics')>15)).sort(()=>rnd()-0.5).slice(0,12);
  if (players.length>=8){ SP.pickup = (SP.pickup||0)+1; players.forEach(p=>{ p.civ.skill.athletics = Math.min(100, sk(p,'athletics')+1.5); p.needs.fun = clamp(p.needs.fun+15,0,100); SP.regulars = SP.regulars || {}; SP.regulars[p.id] = (SP.regulars[p.id]||0)+1; }); ev('pickup_games'); }
  // regulars form a team around an organiser
  const regs = Object.entries(SP.regulars||{}).filter(([id,n])=>n>=3 && alive(id) && !SP.teams.some(t=>C.orgs[t] && C.orgs[t].members.includes(id))).map(([id])=>alive(id));
  if (regs.length>=6){ const org = regs.sort((a,b)=>civInfluence(b)-civInfluence(a))[0]; const name = `${['Riverside','Hillside','Stonebridge','Meadow','Ember','Northfield','Oakhollow','Lakeshore'][SP.teams.length%8]} ${['Otters','Hawks','Stags','Foxes','Badgers','Herons','Wolves','Rams'][hash(org.id)%8]}`;
    const t = civNewOrg('team', name, [org]); t.members = regs.slice(0,8).map(p=>p.id); t.meta = {coach:org.id, stats:{}, w:0, l:0, dr:0}; SP.teams.push(t.id);
    t.members.forEach(id=>{ const p = alive(id); if (p && p!==org){ const R = getRel(p, org.id); if (!R.tags.includes('Coach')) R.tags.push('Coach'); } });
    chronicle(`${org.name} organised the regular players into a team: the ${name}.`, 6, '⚽', 'sport'); ev('teams'); }
  SP.teams = SP.teams.filter(id=>C.orgs[id] && C.orgs[id].status==='active');
  // coaches improve their players
  SP.teams.forEach(id=>{ const t = C.orgs[id], coach = alive(t.meta.coach); t.members = t.members.filter(x=>alive(x)); if (coach) t.members.forEach(x=>{ const p = alive(x); if (p) p.civ.skill.athletics = Math.min(100, sk(p,'athletics') + (sk(coach,'athletics')-sk(p,'athletics')>0 ? 0.8 : 0.2)); }); if (t.members.length<5){ civOrgDissolve(t, 'closed'); } });
  // a league once several teams exist and someone takes on the organising
  if (!SP.league && SP.teams.length>=4){ const org = civRespected(1, c=>c.traits.includes('Charismatic') || civHasGoal(c,'organization'))[0] || civRespected(1)[0]; if (org){ const L = civNewOrg('league', `${S.civ.stageLabel||'Settlement'} League`, [org]); L.members = SP.teams.slice(); SP.league = L.id; SP.season = {n:1, start:d, table:{}, week:0}; chronicle(`${org.name} founded the ${L.name} with ${SP.teams.length} teams. There will be a season, a table and a champion.`, 8, '🏆', 'sport'); ev('leagues');
      if (!civHas(['sports_field','arena']).length){ const site = civFindSite('sports_field', C.center, {margin:1}); if (site) civStartProject('sports_field', site, {k:'org', id:L.id}, {org:L.id, why:'a proper pitch for the league'}); } } }
  if (SP.league && C.orgs[SP.league]) civLeagueRound();
}
function civLeagueRound(){
  const C = S.civ, SP = C.sports, L = C.orgs[SP.league], teams = SP.teams.map(id=>C.orgs[id]).filter(Boolean); if (teams.length<2) return;
  const season = SP.season; season.week++;
  const order = teams.slice(); const shift = season.week % (order.length-1 || 1);
  const pairs = []; for (let i=0;i<Math.floor(order.length/2);i++){ const a = order[(i+shift)%order.length], b = order[(order.length-1-i+shift)%order.length]; if (a!==b) pairs.push([a,b]); }
  const strength = t => t.members.reduce((a,id)=>a + sk(alive(id)||{civ:{skill:{}}},'athletics'), 0)/Math.max(1,t.members.length) + (t.meta.quality||0);
  const field = civHas(['arena','sports_field']).length;
  pairs.forEach(([a,b])=>{
    const ga = Math.max(0, Math.round((strength(a)/25 + rnd()*2.2) - 0.6)), gb = Math.max(0, Math.round((strength(b)/25 + rnd()*2.2) - 0.6));
    [[a,ga,gb],[b,gb,ga]].forEach(([t,f,g])=>{ const r = season.table[t.id] = season.table[t.id] || {p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0}; r.p++; r.gf+=f; r.ga+=g; if (f>g){ r.w++; r.pts+=3; } else if (f===g){ r.d++; r.pts++; } else r.l++;
      const scorer = t.members.map(alive).filter(Boolean).sort((x,y)=>sk(y,'athletics')-sk(x,'athletics'))[0]; if (scorer && f){ t.meta.stats[scorer.id] = (t.meta.stats[scorer.id]||0) + f; } });
    // tickets and sponsorship once money exists
    if (civMoneyOn() && field){ const crowd = Math.round(S.citizens.length*0.25), tix = crowd*0.5*(C.econ.level||1); civAdjPurse(civOrgPurse(a), tix*0.45); civAdjPurse(civOrgPurse(b), tix*0.45); civAdjPurse(civOrgPurse(L), tix*0.1); ev('ticket_income', tix); }
    SP.matches.push({day:civDay(), a:a.id, b:b.id, ga, gb}); if (SP.matches.length>80) SP.matches.shift(); ev('league_matches');
  });
  if (civMoneyOn()) teams.forEach(t=>{
    const sponsor = civOrgs(o=>o.biz && o.cash>200 && o.reputation<0.8 && !Object.values(C.contracts).some(k=>k.kind==='sponsorship' && k.parties[0].id===o.id && k.status==='active'))[0];
    if (sponsor && !Object.values(C.contracts).some(k=>k.kind==='sponsorship' && k.parties[1].id===t.id && k.status==='active') && rnd()<0.3){ civContract('sponsorship', [civOrgPurse(sponsor), civOrgPurse(t)], {amount:5*(C.econ.level||1), until:civDay()+56}, 7); sponsor.reputation = Math.min(1, sponsor.reputation+0.05); chronicle(`${sponsor.name} is sponsoring the ${t.name}.`, 4, '🎽', 'sport'); ev('sponsorships'); }
    // players are paid when the club can afford it; the best may transfer for more
    if (t.cash > t.members.length*4){ t.members.forEach(id=>{ const has = Object.values(C.contracts).some(k=>k.kind==='sports' && k.parties[1].id===id && k.status==='active'); if (!has) civContract('sports', [civOrgPurse(t), {k:'person', id}], {amount:2*(C.econ.level||1), until:civDay()+56}, 7); }); }
    const rich = teams.filter(x=>x!==t && x.cash > t.cash*2 && x.cash>40)[0], star = t.members.map(alive).filter(Boolean).sort((a,b)=>sk(b,'athletics')-sk(a,'athletics'))[0];
    if (rich && star && rnd()<0.15 && sk(star,'athletics')>40){ t.members = t.members.filter(x=>x!==star.id); rich.members.push(star.id); civMoveMoney(civOrgPurse(rich), civOrgPurse(t), 15*(C.econ.level||1), 'transfer'); chronicle(`${star.name} transferred from the ${t.name} to the ${rich.name}.`, 5, '🔁', 'sport'); ev('transfers'); }
  });
  if (season.week >= Math.max(6, (teams.length-1)*2)){
    const champ = Object.entries(season.table).sort((a,b)=>b[1].pts-a[1].pts || (b[1].gf-b[1].ga)-(a[1].gf-a[1].ga))[0]; const T0 = champ && C.orgs[champ[0]];
    if (T0){ chronicle(`The ${T0.name} won the ${L.name} championship (season ${season.n}).`, 8, '🏆', 'sport'); SP.seasons.push({n:season.n, champion:T0.id, name:T0.name, table:season.table}); ev('championships'); T0.members.forEach(id=>{ const p = alive(id); if (p){ p.civ.respect += 2; remember(p, `We won the championship!`, 9); } }); }
    SP.season = {n:season.n+1, start:civDay(), table:{}, week:0};
  }
}

// ---------- neighbouring settlements ----------
function civNeighborsInit(){
  const r = crand('nbrs'), n = 3 + Math.floor(r()*2);
  S.civ.neighbors = NEIGHBOR_DEFS.slice().sort(()=>r()-0.5).slice(0, n).map(D=>{ const pop = D.pop[0] + Math.floor(r()*(D.pop[1]-D.pop[0]));
    const prices = {}; CIV_GOODS.forEach(g=>{ prices[g.id] = +(g.v*(D.res.includes(g.id) ? 0.7 : 1.2)*(0.85+r()*0.3)).toFixed(2); });
    return {id:D.id, name:D.name, dir:D.dir, dist:D.dist, pop, food:Math.round(pop*(18+r()*30)), prodMult:D.food*(0.9+r()*0.2), res:D.res.slice(), ind:D.ind.slice(), prices, wealth:Math.round(pop*(2+r()*4)), rel:Math.round(r()*30), gov:GOV_FORMS[Math.floor(r()*GOV_FORMS.length)], techs:civNbTechs(D), shortage:false, hist:[]}; });
}
function civNbTechs(D){ const t = ['cultivation','smoking','pottery','weaving','counting','carpentry']; if (D.ind.includes('mining')) t.push('quarrying','smelting','mining'); if (D.ind.includes('smithing')) t.push('smelting','ironworking'); if (D.ind.includes('farming')) t.push('plough','milling','domestication'); if (D.ind.includes('fishing')) t.push('nets'); if (D.ind.includes('trade')) t.push('writing','currency','bookkeeping'); if (D.ind.includes('weaving')) t.push('weaving'); return [...new Set(t)]; }
function civNbFoodDays(n){ return n.food / Math.max(1, n.pop); }
function civNeighborsWeekly(){
  const season = seasonOf(civDay());
  S.civ.neighbors.forEach(n=>{
    const prod = n.pop*7*[0.9,1.2,1.5,0.4][season]*n.prodMult, cons = n.pop*7;
    let shock = 1; if (season===2 && rnd()<0.06){ shock = 0.3; chronicle(`News from ${n.name}: their harvest failed.`, 5, '📯', 'world'); }
    n.food = Math.max(0, Math.round(n.food + prod*shock - cons));
    n.shortage = civNbFoodDays(n) < 12;
    CIV_FOODS.forEach(g=>{ const base = CG[g].v*(n.res.includes(g)?0.7:1.2); n.prices[g] = +(base*(n.shortage ? 2.2 : civNbFoodDays(n)>40 ? 0.85 : 1)).toFixed(2); });
    n.pop = Math.max(40, Math.round(n.pop*(n.shortage ? 0.997 : 1.002)));
    n.wealth = Math.round(n.wealth*1.003);
    n.rel = clamp(n.rel*0.98 + (n.lastTrade && civDay()-n.lastTrade<14 ? 2 : 0), -100, 100);
    n.hist.push({day:civDay(), pop:n.pop, food:Math.round(civNbFoodDays(n))}); if (n.hist.length>52) n.hist.shift();
  });
  civCaravansWeekly();
}
// trade caravans carry goods both ways, and ideas with them
function civCaravansWeekly(){
  const C = S.civ, traders = S.citizens.filter(c=>isAdult(c) && (c.civ.occ==='trader' || sk(c,'trading')>=35));
  if (!traders.length || civDay()%14) return;
  const t = traders[hash(String(civDay()))%traders.length], n = C.neighbors.slice().sort((a,b)=>a.dist-b.dist + (b.rel-a.rel)/50)[0]; if (!n) return;
  const h = hhOf(t); if (!h) return;
  const sp = civSurplus(h, t).filter(([g])=>!n.res.includes(g)); let value = 0;
  sp.slice(0,3).forEach(([g,q])=>{ const sell = Math.floor(q*0.7); storeTake(h.store, g, sell); value += sell*n.prices[g]*0.9; });
  if (value < 5) return;
  const buy = n.res.find(g=>CG[g] && CG[g].cat!=='food') || n.res[0]; const q = Math.floor(value/Math.max(0.5, n.prices[buy]));
  storeAdd(h.store, buy, q); n.lastTrade = civDay(); n.rel = clamp(n.rel+3, -100, 100); t.civ.log.trade = (t.civ.log.trade||0) + 8; ev('caravans');
  chronicle(`${t.name} came back from ${n.name} with ${q} ${CG[buy].name.toLowerCase()}.`, 4, '🐪', 'world');
  // knowledge travels with traders
  n.techs.forEach(x=>{ if (!knowsTech(t,x) && civCanGrasp(t,x) && rnd()<0.25){ civLearnTech(t, x, null); chronicle(`${t.name} learned ${TECHS[x].label.toLowerCase()} from the people of ${n.name}.`, 6, '🧭', 'science'); ev('knowledge_imports'); } });
  if (!knowsTech(t,'writing') && n.techs.includes('writing') && rnd()<0.1) civLearnTech(t, 'writing', null);
}

// ---------- emergency food imports: costly, slow, and not guaranteed ----------
function civImportQuote(n, units, urgency){
  const surplusDays = civNbFoodDays(n) - 14, avail = Math.max(0, Math.floor(surplusDays*n.pop*0.25));
  const scarcity = n.shortage ? 1.5 : 0.1, price = +(1.1*(1+scarcity)*(1+urgency*0.4) + 0.12*n.dist).toFixed(2);
  const q = Math.min(units, avail);
  return {n, q, price, cost: Math.round(q*price), days: n.dist + (seasonOf(civDay())===3 ? 3 : 0) + (S.weather==='Storm'?1:0), avail};
}
function civOrderImport(why){
  const C = S.civ, need = Math.round(S.citizens.length*2.8*10), urgency = civFoodDaysAll() < 1 ? 1 : 0.5;
  const quotes = C.neighbors.map(n=>civImportQuote(n, need, urgency)).filter(q=>q.q>=20).sort((a,b)=>a.price-b.price);
  C.lastQuotes = C.neighbors.map(n=>{ const q = civImportQuote(n, need, urgency); return {n:n.name, q:q.q, price:q.price, days:q.days}; });
  if (!quotes.length){ chronicle(`The settlement asked its neighbours for food, but none had any to spare.`, 7, '📯', 'food'); ev('imports_unavailable'); return 'ask the neighbours for food (none to spare)'; }
  const Q = quotes[0];
  // paid from public money, the community fund, or pooled goods before there was money
  const purse = C.gov.treasury >= 20 ? {k:'gov'} : (C.fund||0) >= 20 ? {k:'community'} : null;
  let q = Q.q, paid = 0;
  if (purse && civMoneyOn()){ q = Math.min(Q.q, Math.floor(civPurse(purse)/Q.price)); paid = Math.round(q*Q.price); if (q<20) return null; civAdjPurse(purse, -paid); }
  else { // pool goods: beads, hides, tools, cloth, ore from willing households
    let pool = 0; const want = Q.q*Q.price; Object.values(C.hh).forEach(h=>{ if (pool >= want) return; const giver = hhAdults(h)[0]; if (!giver || (giver.personality.agreeableness < 0.35 && !giver.values.includes('Community'))) return;
      ['beads','hide','cloth','tools','copper','silver','gold','gems','pottery','rope'].forEach(g=>{ const have = h.store[g]||0; if (have<1 || pool>=want) return; const give = Math.min(have, Math.ceil((want-pool)/Q.n.prices[g])); storeTake(h.store, g, give); pool += give*Q.n.prices[g]*0.9; }); });
    q = Math.floor(pool/Q.price); paid = Math.round(pool); if (q < 20){ chronicle(`The settlement could not scrape together enough to buy food from ${Q.n.name}.`, 6, '📯', 'food'); return null; } }
  const sh = {id:'sh_'+(++C.shSeq), from:Q.n.id, fromName:Q.n.name, goods:{grain:Math.round(q*0.6), preserved:Math.round(q*0.4)}, q, cost:paid, price:Q.price, ordered:civDay(), arrive:civDay()+Q.days, status:'en route', why};
  C.shipments.push(sh); Q.n.food = Math.max(0, Q.n.food - q); Q.n.rel = clamp(Q.n.rel+4, -100, 100);
  C.imports.spent += paid; C.imports.n++; ev('imports'); ev('import_units', q);
  chronicle(`Food ordered from ${Q.n.name}: ${q} units at ${Q.price} each (${paid} in value), due in ${Q.days} days.`, 8, '🛒', 'food');
  return `buy ${q} units of food from ${Q.n.name}`;
}
function civShipmentsDaily(){
  const C = S.civ, d = civDay();
  C.shipments.filter(s=>s.status==='en route' && d >= s.arrive).forEach(s=>{
    if (rnd() < 0.04){ s.status = 'lost'; chronicle(`The food shipment from ${s.fromName} never arrived: lost on the road.`, 8, '🛒', 'food'); ev('shipments_lost'); return; }
    s.status = 'arrived'; s.day = d; for (const g in s.goods) storeAdd(C.commons, g, s.goods[g]); C.rationCap = Math.max(C.rationCap, 200);
    chronicle(`The food shipment from ${s.fromName} arrived: ${s.q} units are in the common store.`, 8, '📦', 'food'); ev('shipments_arrived');
  });
  // in good years, the granary buys up surplus to hold against the next bad one
  if (civHas(['granary','warehouse','cold_store']).length && seasonOf(d)===2 && d%7===3){
    Object.values(C.hh).forEach(h=>{ if (hhFoodDays(h) > 20 && (h.store.grain||0) > 30){ const q = Math.floor(h.store.grain*(C.gov.laws.food_reserve ? 0.2 : 0.1)); storeTake(h.store, 'grain', q); storeAdd(C.commons, 'grain', q); if (civMoneyOn()) civMoveMoney(C.gov.treasury>q ? {k:'gov'} : {k:'community'}, civOwnerPurse({k:'hh', id:h.id}), Math.round(q*civPrice('grain')*0.8), 'reserve'); ev('reserve_bought', q); } });
  }
}

// ---------- migration: people weigh their prospects here against elsewhere ----------
function civAttractiveness(){
  const C = S.civ, n = Math.max(1, S.citizens.length), ad = S.citizens.filter(isAdult);
  const food = clamp(civFoodDaysAll()/10, 0, 1.5), homeless = Object.values(C.hh).filter(h=>!h.home || !C.structs[h.home]).length/Math.max(1,Object.keys(C.hh).length);
  const jobs = C.jobs.filter(j=>j.open).length, employed = ad.filter(c=>c.civ.job || c.civ.occ).length/Math.max(1,ad.length);
  const wage = civMoneyOn() ? civAvgWage()/(C.econ.level||1) : 0, crime = C.justice.cases.filter(k=>k.kind==='criminal' && civDay()-k.day<56).length/n*10;
  const school = C.edu.stage>=2 ? 0.3 : 0, health = civHas(['healer_hut','clinic','hospital']).length ? 0.3 : 0, tax = C.gov.taxes.rate ? (C.gov.taxes.form==='hearth' ? 0.05 : C.gov.taxes.rate*2) : 0;
  const opp = C.deposits.filter(d=>d.known && (MIN[d.min].precious || MIN[d.min].fluid) && civDay()-d.found<180).length*0.6 + civOrgs(o=>o.biz).length*0.03;
  return {food, homeless, jobs, employed, wage, crime, school, health, tax, opp, score: food*1.2 - homeless*1.2 + Math.min(1, jobs*0.15) + employed*0.5 + wage*0.08 - crime*0.5 + school + health - tax + opp};
}
function civMigrationMonthly(){
  const C = S.civ, A = civAttractiveness(); C.attract = A;
  C.migration.pressure = Math.max(0, A.score);
  // emigration: households who are doing badly and have somewhere better to go; moving far is costly and uncertain
  let left = 0;
  Object.values(C.hh).slice().sort(()=>rnd()-0.5).forEach(h=>{
    if (left >= 2) return;
    const ad = hhAdults(h); if (!ad.length) return; const head = ad[0];
    const hard = hhFoodDays(h) < 1 || !h.home || !C.structs[h.home] || head.mood.valence < -0.35 || ad.some(a=>a.civ.hungryDays>3) || civDiscontent(head) > 0.5;
    if (!hard || head.office) return;
    const kin = S.citizens.filter(o=>hhOf(o)!==h && ad.some(a=>peekRel(a,o.id).tags.includes('Family'))).length;
    const mine = -civDiscontent(head) + hhFoodDays(h)/6 + (h.home && C.structs[h.home] ? 0.4 : -0.4) + (ad.some(a=>a.civ.job||a.civ.occ) ? 0.4 : 0) + kin*0.2 + head.mood.valence*0.8 + A.score*0.3 + (civDay()<56 ? 0.5 : 0);
    const best = C.neighbors.map(n=>({n, s:(n.shortage?-0.5:0.6) + n.wealth/n.pop/10 - n.dist*0.08 + (n.rel/200) - 0.6})).sort((a,b)=>b.s-a.s)[0];
    if (!best || mine > best.s || rnd() > 0.3) return;
    const size = h.members.length, names = hhMembers(h);
    chronicle(`The ${h.name} household left for ${best.n.name}: ${hhFoodDays(h)<1 ? 'they could not feed themselves here' : !h.home ? 'they never found a home' : 'they hope for better there'}.`, 7, '🚶', 'family');
    names.forEach(m=>{ S.week.departures.push(m.name); civRemovePerson(m, 'left', `moved to ${best.n.name}`); });
    best.n.pop += size; C.migration.out += size; ev('emigrants', size); left++;
  });
  // immigration: neighbours hear how things are going here
  C.neighbors.forEach(n=>{
    const pull = A.score - ((n.shortage?-0.5:0.6) + n.wealth/n.pop/10) + n.rel/150 - n.dist*0.03;
    if (pull <= 0) return;
    const groups = Math.min(4, Math.floor(pull*2 + rnd()*1.5));
    for (let i=0;i<groups;i++) civImmigrate(n);
  });
}
function civImmigrate(n){
  const C = S.civ, r = crand('arr'+S.minute+S.citizens.length+n.id);
  const sur = SURNAMES.concat(['Ashgrove','Bellweather','Corrin','Dray','Esker','Fallow','Grist','Harrow','Ingle','Jessop'])[Math.floor(r()*SURNAMES.length+10*r())%(SURNAMES.length+10)];
  const size = r()<0.45 ? 1 : r()<0.6 ? 2 : 3 + Math.floor(r()*2);
  const h = civNewHH(sur, null), mem = [];
  const bg = n.ind[Math.floor(r()*n.ind.length)];
  for (let i=0;i<size;i++){
    const kid = i>=2, g = r()<0.5?'F':'M';
    const c = civMakePerson({first:firstNameFor(g, r), sur, age: kid ? Math.floor(r()*14) : 19+Math.floor(r()*30), gender:g, parents: kid ? mem.slice(0,2).map(x=>x.id) : []}, r);
    // they bring what their home town knew
    if (!kid){ const B = {farming:{agriculture:30, s:'farming'}, milling:{agriculture:25, s:'farming'}, fishing:{wilderness:30, s:'fishing'}, 'salt works':{geology:20, s:'stonework'}, mining:{geology:35, s:'mining'}, smithing:{crafts:35, s:'smithing'}, weaving:{crafts:30, s:'weaving'}, trade:{trade:35, s:'trading'}, hunting:{wilderness:35, s:'hunting'}, tanning:{crafts:25, s:'crafting'}}[bg];
      if (B){ for (const k in B) if (k!=='s') c.civ.know[k] = Math.max(kn(c,k), B[k]*(0.6+r()*0.6)); c.civ.skill[B.s] = Math.max(sk(c,B.s), 30+r()*30); }
      n.techs.forEach(t=>{ if (r()<0.3 && civCanGrasp(c,t)) c.civ.techs.push(t); });
      if (civMoneyOn()) c.wallet = Math.round((20 + r()*120)*(C.econ.level||1)); else storeAdd(h.store, 'beads', Math.floor(r()*20)); }
    c.rt.x = c.rt.ox = 1; c.rt.y = c.rt.oy = clamp(C.center[1],2,OH-3);
    S.citizens.push(c); CBY[c.id] = c; civJoinHH(c, h); mem.push(c);
    c.plan = civPlanDay(c, civDay());
    S.week.arrivals.push(`${c.name}${kid?'':` (from ${n.name})`}`);
  }
  if (mem.length>=2 && isAdult(mem[0]) && isAdult(mem[1]) && mutual(mem[0], mem[1])){ mem[0].partner = mem[1].id; mem[1].partner = mem[0].id; [[mem[0],mem[1]],[mem[1],mem[0]]].forEach(([a,b])=>{ const R = getRel(a,b.id); R.affinity = 80; R.tags = ['Spouse','Family']; }); }
  mem.slice(2).forEach(k=>mem.slice(0,2).forEach(p=>{ const R = getRel(p,k.id); R.affinity = 85; R.tags = ['Family']; getRel(k,p.id).tags = ['Family']; }));
  storeAdd(h.store, 'preserved', size*4); storeAdd(h.store, 'water', size*2); storeAdd(h.store, 'tools', 1);
  n.pop = Math.max(40, n.pop - size); C.migration.in += size; ev('immigrants', size);
  indexCitizens();
  chronicle(`${mem.map(x=>x.name.split(' ')[0]).join(', ')} ${sur} arrived from ${n.name}, ${bg ? `people who know ${bg}` : 'looking for a new start'}.`, 6, '🧳', 'arrival');
  civProblem('growth', 1); civProblem('housing', 0.5);
}
function civRemovePerson(c, kind, cause){
  civOrgsOnDeath(c);
  S.civ.econ.listings = S.civ.econ.listings.filter(l=>!(l.seller.k==='person' && l.seller.id===c.id));
  if (c.civ.job) civQuit(c);
  const h = hhOf(c); if (h){ h.members = h.members.filter(x=>x!==c.id); if (!h.members.length) civDissolveHH(h, null); }
  (c.civ.prot||[]).forEach(id=>{ const p = alive(id); if (p) p.civ.mentor = null; });
  S.civ.animals.forEach(a=>{ if (a.owner.k==='person' && a.owner.id===c.id) a.owner = h ? {k:'hh', id:h.id} : {k:'community'}; });
  if (c.office){ const G = S.civ.gov; for (const k in G.offices) if (G.offices[k]===c.id) delete G.offices[k]; G.council = G.council.filter(x=>x!==c.id); if (G.leader===c.id){ G.lastLeaderKin = S.citizens.filter(k=>k.parents.includes(c.id)).map(k=>k.id); } }
  removeCitizen(c, kind, cause);
}

// ---------- the daily, weekly and monthly society ----------
function civSocietyDaily(){
  civGovDaily();
  civCrimeDaily();
  civJusticeDaily();
  civEducationDaily();
  civShipmentsDaily();
  // a food emergency that nobody has met yet
  if (civFoodDaysAll() < 1.2 && S.citizens.length>20 && !S.civ.shipments.some(s=>s.status==='en route') && civDay() - (S.civ.lastImportTry||-99) > 5){ S.civ.lastImportTry = civDay(); civProblem('food', 6); if (S.civ.gov.stage>=3 || civProblemTotal()>=9) civGathering('food'); else if (S.civ.gov.stage<1) civGathering('food'); }
  if (civFoodDaysAll() < 2) ev('shortage_days');
  // famine relief: a friendly neighbour with food to spare may send some for nothing
  if (civFoodDaysAll() < 0.6 && civDay()%5===0){ const n = S.civ.neighbors.filter(n=>n.rel >= 5 && civNbFoodDays(n) > 25).sort((a,b)=>b.rel-a.rel)[0];
    if (n && rnd() < 0.35 + n.rel/200){ const q = Math.round(Math.min(n.food*0.03, S.citizens.length*6)); if (q>20){ n.food -= q; n.rel -= 3; S.civ.shipments.push({id:'sh_'+(++S.civ.shSeq), from:n.id, fromName:n.name, goods:{grain:q}, q, cost:0, price:0, ordered:civDay(), arrive:civDay()+n.dist, status:'en route', why:'relief'}); chronicle(`${n.name} heard of the hunger and is sending ${q} units of grain as relief.`, 8, '🤲', 'food'); ev('relief'); } } }
}
function civSocietyWeekly(){ civLawsWeekly(); civElectionsWeekly(); civCivilWeekly(); civEducationWeekly(); civSportWeekly(); for (const k in S.civ.problems) S.civ.problems[k] = +(S.civ.problems[k]*0.7).toFixed(1); }
function civSocietyMonthly(){ S.civ.monthlyPop = (S.civ.monthlyPop||[]).concat({day:civDay(), pop:S.citizens.length}).slice(-60); }
