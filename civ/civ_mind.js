/* =====================================================================
   Pixel Town — civilization mode: minds
   Observe → Remember → Interpret → Predict → Plan → Act → Evaluate → Learn.
   Knowledge is separate from intelligence: a sharp mind still guesses badly in a field it knows nothing about.
   Occupations are recognised from what people keep doing, never assigned.
   ===================================================================== */
const cog = (c, k) => (c.civ && c.civ.cog ? c.civ.cog[k] : 0.5);
const kn = (c, k) => (c.civ && c.civ.know[k]) || 0;
const sk = (c, k) => (c.civ && c.civ.skill[k]) || 0;
// the old single "wit" becomes a view onto the modular profile, for systems that still ask for it
function civWit(c){ const g = c.civ && c.civ.cog; if (!g) return null; return +((g.reasoning*0.35 + g.memory*0.15 + g.learning*0.2 + g.planning*0.15 + g.attention*0.15)).toFixed(2); }
function knowsTech(c, t){ return !!(c.civ && c.civ.techs.includes(t)); }
function civTechKnown(t){ return !!(S && S.civ && S.civ.tech[t] && S.civ.tech[t].knowers>0); }
function civTechRecount(){
  const C = S.civ, n = {};
  S.citizens.forEach(c=>(c.civ.techs||[]).forEach(t=>n[t]=(n[t]||0)+1));
  (C.library||[]).forEach(t=>n[t]=Math.max(n[t]||0, 0.5));
  for (const t in n){ if (!C.tech[t]) C.tech[t] = {day:civDay(), by:null, knowers:0}; C.tech[t].knowers = n[t]; }
  for (const t in C.tech) if (!n[t]){ C.tech[t].knowers = 0; }
}
function civTheoryAccepted(id){ const T = S.civ.theories[id]; return !!(T && T.accept>=0.6); }
function civTheoryMult(kind){ let m = 1; for (const id in S.civ.theories){ const T = S.civ.theories[id], D = THEORIES[id]; if (!D || T.accept<0.6) continue; if (kind==='sick' && id==='th_germs') m *= 0.8; if (D.harm && D.harm[kind]) m *= D.harm[kind]; } return m; }

// ---------- goals: immediate, short, medium and long term; none are careers handed out at birth ----------
const GOAL_DEFS = {
  secure_food:   {label:'Secure enough food',   lvl:'immediate'},
  new_home:      {label:'Build a home',         lvl:'short'},
  repair_home:   {label:'Repair our home',      lvl:'short'},
  acquire_tools: {label:'Get proper tools',     lvl:'short'},
  repay_debt:    {label:'Repay a debt',         lvl:'short'},
  winter_stores: {label:'Lay in winter stores', lvl:'short'},
  improve_home:  {label:'Improve our home',     lvl:'medium'},
  learn_skill:   {label:'Learn a skill',        lvl:'medium'},
  start_field:   {label:'Start a field',        lvl:'medium'},
  start_herd:    {label:'Raise animals',        lvl:'medium'},
  start_business:{label:'Start a business',     lvl:'medium'},
  buy_land:      {label:'Buy land',             lvl:'medium'},
  improve_income:{label:'Improve our income',   lvl:'medium'},
  wealth:        {label:'Become wealthy',       lvl:'long'},
  family:        {label:'Build a family',       lvl:'long'},
  respect:       {label:'Become respected',     lvl:'long'},
  discover:      {label:'Discover something',   lvl:'long'},
  community:     {label:'Improve the community',lvl:'long'},
  organization:  {label:'Create an organisation',lvl:'long'}
};
function civHasGoal(c, kind){ return c.civ && c.civ.goals.some(g=>g.kind===kind && g.status==='active'); }
function civGoal(c, kind){ return c.civ.goals.find(g=>g.kind===kind && g.status==='active'); }
function civAddGoal(c, kind, data, steps){
  if (civHasGoal(c, kind)) return civGoal(c, kind);
  const g = {id:'g'+(++S.evSeq), kind, lvl:GOAL_DEFS[kind].lvl, made:civDay(), status:'active', data:data||{}, steps:(steps||[]).map(k=>({k, done:false}))};
  c.civ.goals.push(g); if (c.civ.goals.length>12) c.civ.goals.splice(0, c.civ.goals.findIndex(x=>x.status!=='active')+1 || 1);
  return g;
}
function civEndGoal(c, g, status, note){ g.status = status; g.ended = civDay(); if (note) remember(c, note, status==='done'?7:5); }
// long-term drives come from values and personality; they tilt choices for years
function civLongGoals(c){
  const P = c.personality, V = c.values, X = c.civ;
  const want = [];
  if (V.includes('Prosperity') || c.traits.includes('Ambitious') || c.traits.includes('Greedy')) want.push('wealth');
  if (V.includes('Family') || (c.partner && c.age<40)) want.push('family');
  if (c.traits.includes('Charismatic') || P.extraversion>0.7) want.push('respect');
  if (X.cog.creativity>0.62 && P.openness>0.55) want.push('discover');
  if (V.includes('Community') || P.agreeableness>0.72) want.push('community');
  if (X.cog.planning>0.6 && P.conscientiousness>0.6 && (P.extraversion>0.45 || c.traits.includes('Ambitious'))) want.push('organization');
  want.slice(0,2).forEach(k=>civAddGoal(c, k));
}

// ---------- predict: what one block of a task is likely to yield, as this person sees it ----------
function civTaskKnowledge(c, task){ const A = ACTIVITIES[task]; if (!A || !A.skill) return 40; const S2 = SK[A.skill]; return Math.max(sk(c, A.skill)*0.7, ...(S2 ? S2.know.map(k=>kn(c,k)) : [0])); }
function civMargValue(c, g, h){
  const D = CG[g]; if (!D) return 0;
  const days = h ? hhFoodDays(h) : 3, season = seasonOf(civDay()), plan = cog(c,'planning');
  if (D.cat==='food'){
    // planners look ahead to winter; others react to what is in the larder now
    const ahead = (season===2 ? 1 : season===1 ? 0.5 : 0)*plan, want = 4 + ahead*10 + (civHasGoal(c,'winter_stores')?6:0);
    const perishPenalty = D.perish && D.perish<6 && days>3 ? 0.6 : 1;
    return D.v * (days<want ? 1 + (want-days)*0.35 : 0.35) * perishPenalty * (civMoneyOn() ? 1 : 1);
  }
  if (g==='water') return h && (h.store.water||0) < h.members.length*1.5 ? 0.6 : 0.02;
  const needFor = civMaterialNeed(c, g);
  if (needFor>0) return D.v * (1.2 + Math.min(1.5, needFor/40));
  if (g==='wood' && season>=2 && h && (h.store.wood||0) < 20) return D.v*1.1;
  return D.v * (civMoneyOn() || S.civ.econ.stage>=2 ? 0.45 : 0.15);
}
function civMaterialNeed(c, g){ let n = 0; civProjectsFor(c).forEach(p=>{ n += Math.max(0, (p.need[g]||0) - (p.have[g]||0)); });
  if (civCivic(c)) civCommunityProjects().forEach(p=>{ n += Math.max(0, (p.need[g]||0) - (p.have[g]||0))*0.5; });
  return n; }
function civCivic(c){ return c.personality.agreeableness>0.58 || c.values.includes('Community') || civHasGoal(c,'community') || !!c.office; }
// households split the work: some provide food, the others build and fetch materials
function civHHRole(c, h){
  if (!h || !isAdult(c)) return 'provider';
  const ad = hhAdults(h).filter(a=>!a.civ.job).sort((a,b)=>Math.max(sk(b,'fishing'),sk(b,'hunting'),sk(b,'foraging'),sk(b,'farming')) - Math.max(sk(a,'fishing'),sk(a,'hunting'),sk(a,'foraging'),sk(a,'farming')));
  const providers = Math.max(1, Math.ceil(ad.length * (hhFoodDays(h) < 1.5 ? 0.8 : 0.5)));
  const i = ad.indexOf(c); return i >= 0 && i < providers ? 'provider' : 'builder';
}
function civMissingMaterial(c){ const tally = {}; civProjectsFor(c).concat(civCivic(c) ? civCommunityProjects() : []).forEach(p=>{ for (const g in p.need){ const miss = p.need[g] - (p.have[g]||0) - ((hhOf(c)||{store:{}}).store[g]||0); if (miss>0) tally[g] = (tally[g]||0) + miss; } }); return Object.entries(tally).sort((a,b)=>b[1]-a[1])[0]; }
function civEcoAround(c, task){
  const A = ACTIVITIES[task]; if (!A.eco) return 1;
  const e = ecoCellAt(c.rt.x, c.rt.y); if (!e) return 1;
  if (A.eco==='forage') return e.fcap ? 0.35 + 0.65*(e.f/e.fcap) : 0.4;
  if (A.eco==='fish') return 0.7;
  if (A.eco==='game') return e.gcap ? 0.3 + 0.7*Math.min(1, e.g/Math.max(1,e.gcap)) : 0.35;
  return 1;
}
function civPredict(c, task, h){
  const A = ACTIVITIES[task]; if (!A) return {v:0, sd:0};
  const hrs = 4.5, season = seasonOf(civDay());
  let units = 0, v = 0;
  const eff = 0.35 + sk(c, A.skill||'x')/100*1.15;
  const toolB = A.tool && h && A.tool.some(g=>h.store[g]>0) ? (A.toolBoost||1.4) : 1;
  const techB = civTaskTechBoost(c, task);
  for (const g in A.out){ const u = A.out[g]*hrs*eff*toolB*techB*(A.season ? A.season[season] : 1)*civEcoAround(c, task); units += u; v += u*civMargValue(c, g, h); }
  const handler = CIV_TASK_VALUE[task]; if (handler) v += handler(c, h, hrs);
  // knowledge shapes how well you can judge: a novice's estimate is noisy whatever their reasoning
  const K = civTaskKnowledge(c, task), noise = (1 - Math.min(1, K/60))*0.7*(1 - cog(c,'reasoning')*0.4) + 0.08;
  const bias = (hashf(hash(c.id)&1023, civDay(), hash(task)&255) - 0.5)*2*noise;
  let est = v*(1+bias);
  // remembered outcomes (weighted by memory), and what friends said worked (weighted by social intelligence)
  const E = c.civ.exp[task]; if (E && E.n){ const w = Math.min(0.88, E.n/(E.n+2)) * (0.6+cog(c,'memory')*0.4); est = est*(1-w) + E.v*w; }
  const H = c.civ.heard && c.civ.heard[task]; if (H!=null){ const w = 0.15 + cog(c,'social')*0.2; est = est*(1-w) + H*w; }
  return {v:est, sd: (A.var||0.25)*est, raw:v};
}
// value of tasks that do not simply produce goods; each module registers its own
const CIV_TASK_VALUE = {};
function civTaskTechBoost(c, task){
  let m = 1;
  if (task==='fish' && (knowsTech(c,'nets') || civTechKnown('nets'))) m *= 1.5;
  if (task==='hunt' && knowsTech(c,'fire_hardening')) m *= 1.25;
  if (task==='chop' && civTechKnown('saws')) m *= 1.3;
  if (task==='quarry' && civTechKnown('quarrying')) m *= 1.4;
  return m;
}
function civTaskAvailable(c, task){
  const A = ACTIVITIES[task]; if (!A) return false;
  if (A.tech && !knowsTech(c, A.tech) && !(civTechKnown(A.tech) && cog(c,'social')>0.4)) return false;
  const avail = CIV_TASK_OK[task]; return avail ? avail(c) : true;
}
const CIV_TASK_OK = {
  heal: c => sk(c,'medicine')>=12 && S.citizens.some(o=>o.sick || o.civ.hurt),
  teach: c => (sk(c,'teaching')>=15 || kn(c,'teaching')>=15) && S.citizens.some(k=>!isAdult(k) && k.age>=6),
  research: c => cog(c,'creativity')+c.personality.openness > 0.95 && Math.max(...SCIENCES.map(s=>kn(c,s))) >= 12,
  prospect: c => kn(c,'geology')>=6 || sk(c,'geology')>=8 || c.personality.openness>0.72,
  cook: c => knowsTech(c,'smoking'),
  craft: c => sk(c,'crafting')>=10 || sk(c,'weaving')>=15 || sk(c,'smithing')>=10,
  play: c => false, learn: c => false, rest: c => false, patrol: c => !!c.civ.watch, job: c => !!c.civ.job,
  mine: c => civMineFor(c)!=null, trade: c => S.civ.econ.stage>=3, build: c => civProjectsFor(c).length>0 || civCommunityProjects().length>0,
  farm: c => civFieldFor(c)!=null, herd: c => civPenFor(c)!=null
};

// ---------- plan the day ----------
function civPlanDay(c, day){
  const B = [], home = c.home && LOC[c.home] ? c.home : 'loc_town_square';
  const add = (end, act, loc, note, extra) => { const s = B.length ? B[B.length-1].s + B[B.length-1].d : 0; if (end<=s) return; B.push(Object.assign({s, d:end-s, act, loc, note}, extra||{})); };
  const kid = !isAdult(c), elder = c.age>=66, mod0 = 0;
  const wake = 6*60 + (hash(c.id+day)%40) - (c.civ.cog.planning>0.6?15:0);
  add(wake, 'Sleep', home, 'Sleeping');
  add(wake+30, 'Eat', home, 'Breakfast');
  if (kid){
    if (c.age<6){ add(12*60, 'Leisure', home, 'Playing near home'); add(12*60+40, 'Eat', home, 'Lunch'); add(18*60+30, 'Leisure', 'loc_town_square', 'Playing with the other children'); }
    else {
      const t = civKidTask(c, day);
      add(12*60, t.act, t.loc, t.note, t.extra); add(12*60+40, 'Eat', 'here', 'A bite to eat');
      const t2 = c.age>=12 ? civKidTask(c, day+0.5) : {act:'Leisure', loc:'loc_town_square', note:'Playing games on the commons', extra:{task:'play'}};
      add(17*60+30, t2.act, t2.loc, t2.note, t2.extra); add(18*60+30, 'Eat', home, 'Supper');
    }
    add(20*60+30, 'Socialize', 'loc_town_square', 'At the fire with the family'); add(DAY, 'Sleep', home, 'Sleeping');
    civFixHere(c, B); return {day, by:'civ', blocks:B};
  }
  const h = hhOf(c), rest = day%7===6 && !civHasGoal(c,'secure_food') && (!h || hhFoodDays(h)>3);
  const choice = rest ? null : civChooseWork(c, day, h);
  if (choice){
    add(12*60, 'Work', choice[0].loc, choice[0].note, choice[0].extra);
    add(12*60+40, 'Eat', 'here', 'A meal on the spot');
    if (!elder) add(17*60+15, 'Work', choice[1].loc, choice[1].note, choice[1].extra);
    else add(15*60, 'Leisure', home, 'Resting at home');
  } else { add(12*60, 'Leisure', 'loc_town_square', 'A day of rest'); add(12*60+40, 'Eat', home, 'Lunch'); add(17*60, 'Socialize', 'loc_town_square', 'Visiting neighbours'); }
  // one adult per household fetches the water
  if (h && civWaterCarrier(h)===c.id && (h.store.water||0) < h.members.length*2){ const w = civTarget(c, 'water'); add(18*60+10, 'Work', w.loc, 'Fetching water', {task:'water', xy:w.xy}); }
  else add(18*60, 'Chore', home, 'Chores at home');
  add(18*60+40, 'Eat', home, 'Supper');
  const social = c.personality.extraversion > 0.35 || c.needs.social < 45;
  add(21*60 + (c.traits.includes('Reckless')?45:0), social ? 'Socialize' : 'Leisure', social ? 'loc_town_square' : home, social ? 'Around the evening fire' : 'Quiet evening at home');
  add(DAY, 'Sleep', home, 'Sleeping');
  civFixHere(c, B);
  return {day, by:'civ', blocks:B};
}
function civFixHere(c, B){ B.forEach((b,i)=>{ if (b.loc==='here'){ const prev = B[i-1]; if (prev && prev.xy){ b.xy = prev.xy; b.loc = prev.loc; } else b.loc = prev ? prev.loc : c.home; } }); }
function civWaterCarrier(h){ const ad = hhAdults(h); if (!ad.length) return null; return ad.slice().sort((a,b)=>(a.age>60)-(b.age>60) || a.civ.cog.planning-b.civ.cog.planning)[civDay()%Math.max(1,ad.length)].id; }
function civKidTask(c, day){
  const school = civSchoolFor(c);
  if (school) return {act:'Learn', loc:school.loc, note:`Lessons at ${school.name}`, extra:{task:'learn', xy:school.xy, school:school.id}};
  const par = c.parents.map(alive).filter(p=>p && isAdult(p) && p.plan && p.plan.blocks)[hash(c.id+day)%2] || null;
  const pb = par && par.plan.blocks.find(b=>b.act==='Work' && b.task && !['hunt','mine','research','job'].includes(b.task));
  if (c.age>=8 && pb && hash(c.id+day)%3!==0) return {act:'Work', loc:pb.loc, note:`Helping ${par.name.split(' ')[0]}: ${ACTIVITIES[pb.task].label.toLowerCase()}`, extra:{task:pb.task, xy:pb.xy, proj:pb.proj, field:pb.field, pen:pb.pen, withParent:par.id}};
  if (c.age>=11){ const t = hash(c.id+day)%2 ? 'forage' : 'gather', tg = civTarget(c, t); return {act:'Work', loc:tg.loc, note:ACTIVITIES[t].label, extra:{task:t, xy:tg.xy}}; }
  return {act:'Leisure', loc:'loc_town_square', note:'Playing on the commons', extra:{task:'play'}};
}
// the core decision: observe, remember, interpret, predict, choose, and write it down
function civChooseWork(c, day, h){
  const X = c.civ;
  if (X.job){ const j = civJobOf(c); if (j){
    // employees do the company's work: its mine, field, pen, building site, woods or workshop
    const t = civJobTask(c, j); let blk;
    if (t==='job'){ const w = civWorkplaceXY(c, j); blk = {loc:w.loc, note:`Working as ${j.role} for ${j.orgName}`, extra:{task:'job', xy:w.xy, job:j.id}}; }
    else { blk = civTaskBlock(c, t); blk.extra.job = j.id; blk.note = `${ACTIVITIES[t].label} for ${j.orgName}`; }
    civDecision(c, 'job', {exp:j.wage*1.0, alt:null, obj:'earn wages', sit:`employed by ${j.orgName}`}); return [blk, blk]; } }
  const obs = civObserve(c, h);
  const tasks = Object.keys(ACTIVITIES).filter(t=>!['water','learn','play','rest','job'].includes(t) && civTaskAvailable(c, t));
  const scored = tasks.map(t=>{ const p = civPredict(c, t, h); let v = p.v;
    v += civGoalBonus(c, t, obs);
    v += civHabitBonus(c, t);
    v -= p.sd*(1-cog(c,'risk'))*0.5;                                   // cautious people discount risky work
    if (ACTIVITIES[t].risk) v -= ACTIVITIES[t].risk*400*(1-cog(c,'risk'));
    if (c.traits.includes('Lazy') && ['build','quarry','chop','mine'].includes(t)) v *= 0.8;
    return {t, v, exp:p.v}; }).sort((a,b)=>b.v-a.v);
  if (!scored.length) return null;
  // people do not always pick the single best: attention and planning decide how carefully they compare
  const care = 0.4 + cog(c,'attention')*0.3 + cog(c,'planning')*0.3;
  const pickIdx = scored.length>1 && hashf(hash(c.id)&1023, day, 7) > care ? 1 : 0;
  const first = scored[pickIdx], second = civSecondTask(c, scored, first, day);
  const obj = obs.foodDays<2.5 ? 'feed the household' : civTopGoal(c) ? GOAL_DEFS[civTopGoal(c).kind].label.toLowerCase() : 'get by';
  civDecision(c, first.t, {exp:first.exp, alt: scored[pickIdx?0:1] ? scored[pickIdx?0:1].t : null, obj, sit: obs.text});
  return [civTaskBlock(c, first.t), civTaskBlock(c, second.t)];
}
function civSecondTask(c, scored, first, day){
  // mixing it up: after a morning of one thing, a second need may matter more (and focused people stick with it)
  if (cog(c,'attention')>0.55 || scored.length<2) return first;
  const alt = scored.find(s=>s.t!==first.t); return alt && alt.v > first.v*0.85 ? alt : first;
}
function civObserve(c, h){
  const foodDays = h ? hhFoodDays(h) : 0, season = seasonOf(civDay()), home = S.civ.structs[c.home];
  const parts = [`${foodDays.toFixed(1)} days of food at home`, SEASONS[season].toLowerCase()];
  if (!home) parts.push('no roof'); else if (home.cond<45) parts.push('home falling apart');
  if (c.sick) parts.push('feeling ill'); if (S.civ.problems.food>6) parts.push('others going hungry');
  return {foodDays, season, homeless:!home, text: parts.join(', ')};
}
function civTopGoal(c){ const order = {immediate:0, short:1, medium:2, long:3}; return c.civ.goals.filter(g=>g.status==='active').sort((a,b)=>order[a.lvl]-order[b.lvl])[0]; }
function civGoalBonus(c, t, obs){
  let v = 0; const food = ['forage','fish','hunt','farm','herd','cook'];
  c.civ.goals.forEach(g=>{ if (g.status!=='active') return;
    if ((g.kind==='secure_food' || g.kind==='winter_stores') && food.includes(t)) v += 6;
    if ((g.kind==='new_home'||g.kind==='improve_home'||g.kind==='repair_home'||g.kind==='start_field'||g.kind==='start_herd') && t==='build') v += 9;
    if (g.kind==='start_field' && t==='chop') v += 1.5;
    if (g.kind==='acquire_tools' && t==='craft') v += 5;
    if (g.kind==='learn_skill' && g.data.skill && ACTIVITIES[t].skill===g.data.skill) v += 4;
    if (g.kind==='discover' && (t==='research' || t==='prospect')) v += 3;
    if (g.kind==='community' && (t==='build' || t==='heal' || t==='teach')) v += 3;
    if (g.kind==='wealth' && (t==='trade' || t==='prospect' || t==='mine')) v += 2;
    if ((g.kind==='start_business' || g.kind==='improve_income') && g.data.task===t) v += 5;
  });
  if (obs.foodDays < 1.5 && !food.includes(t)) v -= 8;
  // the household's builder fetches what its projects lack, or builds when the materials are there
  const h = hhOf(c);
  if (civHHRole(c, h)==='builder' && obs.foodDays >= 1.2){
    const miss = civMissingMaterial(c), matTask = miss ? GOOD_TASK[miss[0]] : null;
    const ready = civProjectsFor(c).concat(civCivic(c) ? civCommunityProjects() : []).some(p=>civProjectMatFrac(p)>0.4 && p.done < p.labor);
    if (t==='build' && ready) v += 14; else if (matTask && t===matTask) v += 14;
    if (food.includes(t)) v -= 4;
  }
  return v;
}
function civHabitBonus(c, t){ const occ = c.civ.occ && OCC[c.civ.occ]; return occ && occ.act===t ? 2 + c.personality.conscientiousness*2 : 0; }
function civDecision(c, act, o){
  const d = {t:S.minute, day:civDay(), act, exp:+(o.exp||0).toFixed(1), alt:o.alt||null, obj:o.obj||'', sit:o.sit||'', val:null, why:null, n:0};
  c.civ.dec.push(d); if (c.civ.dec.length>16) c.civ.dec.shift();
  // big life decisions are kept apart from the daily round so they are not forgotten
  if (o.major){ const M = c.civ.major = c.civ.major || []; M.push(d); if (M.length>12) M.shift(); }
  c.civ.lastDec = d;
}
// where each kind of task happens
function civTaskBlock(c, t){
  const tg = civTarget(c, t);
  return {loc:tg.loc, note:tg.note || ACTIVITIES[t].label, extra:Object.assign({task:t, xy:tg.xy}, tg.extra||{})};
}
function civTarget(c, task){
  const A = ACTIVITIES[task], home = c.home && LOC[c.home] ? c.home : 'loc_town_square', [hx,hy] = [c.rt.x, c.rt.y];
  const r = mapRand(hash(c.id+task+civDay()));
  const near = (test, rad) => { let best=null, bs=1e9; for (let k=0;k<70;k++){ const x = clamp(Math.round(hx + (r()-0.5)*2*rad), 1, OW-2), y = clamp(Math.round(hy + (r()-0.5)*2*rad), 1, OH-2); if (!walkable(x,y)) continue; const s = test(x,y); if (s==null) continue; const sc = Math.hypot(x-hx,y-hy)*0.08 - s; if (sc<bs){ bs=sc; best=[x,y]; } } return best; };
  const adj = (x,y,t) => { for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) if (tileAt(x+dx,y+dy)===t) return [x+dx,y+dy]; return null; };
  const W = (xy, note, extra) => ({loc:'wild', xy, note, extra});
  switch (A && A.place){
    case 'wild': { const xy = near((x,y)=>{ const e = ecoCellAt(x,y); return e.fcap ? e.f/e.fcap*2 : 0; }, 16); return W(xy||[hx,hy], 'Foraging for berries and roots'); }
    case 'forest': { const xy = near((x,y)=>{ const e = ecoCellAt(x,y); let t=0; for (let j=-2;j<=2;j++) for (let i=-2;i<=2;i++) if (tileAt(x+i,y+j)===T.TREE) t++; return t>=6 ? (e.g||0)/3 + t/10 : null; }, 22); return W(xy||[hx,hy], 'Hunting in the woods'); }
    case 'tree': { const xy = near((x,y)=>adj(x,y,T.TREE) ? 1 : null, 12); return W(xy||[hx,hy], 'Cutting wood', {tree: xy ? adj(xy[0],xy[1],T.TREE) : null}); }
    case 'rock': { const xy = near((x,y)=>adj(x,y,T.ROCK) ? 1 : null, 26); return W(xy||[hx,hy], 'Gathering stone', {rock: xy ? adj(xy[0],xy[1],T.ROCK) : null}); }
    case 'shore': case 'water': { const xy = near((x,y)=>{ const w = adj(x,y,T.WATER); return w && !FORDS.has(tkey(w[0],w[1])) ? (task==='fish' ? (ecoCellAt(w[0],w[1]).fish/Math.max(1,ecoCellAt(w[0],w[1]).fishcap))*2 : 1) : null; }, 24); return W(xy||[hx,hy], task==='fish'?'Fishing':task==='water'?'Fetching water':'Gathering reeds and clay'); }
    case 'home': return {loc:home, note: task==='cook' ? 'Smoking and drying food' : task==='craft' ? 'Making tools at home' : 'At home'};
    default: { const f = CIV_TARGETS[task]; if (f){ const t = f(c); if (t) return t; } return {loc:'loc_town_square', note:A ? A.label : 'Working'}; }
  }
}
const CIV_TARGETS = {};

// ---------- act: the work itself ----------
// handlers return {value, why, out}; production tasks share one generic handler
const CIV_WORK = {};
function civDoWork(c, b, hrs){
  const f = CIV_WORK[b.task] || civWorkProduce;
  return f(c, b, hrs) || {value:0, why:null};
}
function civWorkTick(c, b){ const f = CIV_WORK_TICK[b.task]; if (f) f(c, b); }
const CIV_WORK_TICK = {
  chop: (c,b)=>{ if (b.tree && tileAt(b.tree[0],b.tree[1])===T.TREE) civFell(b.tree[0], b.tree[1], 2); },
  quarry: (c,b)=>{ if (b.rock) civWearRock(b.rock[0], b.rock[1], 1); }
};
function civWorkProduce(c, b, hrs){
  const A = ACTIVITIES[b.task]; if (!A || !hrs) return {value:0, why: hrs ? null : 'no time to work'};
  const h = hhOf(c), season = seasonOf(civDay()), e = b.xy ? ecoCellAt(b.xy[0], b.xy[1]) : null;
  let why = null, value = 0; const out = {};
  const techB = civTaskTechBoost(c, b.task);
  let abund = 1;
  if (A.eco==='forage' && e){ abund = e.fcap ? 0.25 + 0.75*Math.pow(e.f/e.fcap, 0.7) : 0.3; if (abund<0.5) why = 'the area was picked over'; }
  if (A.eco==='fish' && e){ abund = e.fishcap ? 0.3 + 0.7*(e.fish/e.fishcap) : 0.3; if (abund<0.5) why = 'the fish were scarce'; }
  let units = 0;
  if (b.task==='hunt'){
    // a hunt succeeds or fails; the chance depends on skill, game about, tools and company
    const game = e ? e.g : 0, party = S.citizens.filter(o=>o!==c && o.plan && o.plan.blocks[o.rt.blockIdx] && o.plan.blocks[o.rt.blockIdx].task==='hunt' && Math.hypot(o.rt.x-c.rt.x,o.rt.y-c.rt.y)<6).length;
    const pk = clamp(0.12 + sk(c,'hunting')/160 + Math.min(0.25, game/40) + party*0.06 + (knowsTech(c,'fire_hardening')?0.08:0), 0.02, 0.85) * [0.9,1,1.15,0.7][season] * Math.min(1, hrs/3);
    const kills = rnd() < pk ? 1 + (rnd() < pk*0.25 ? 1 : 0) : 0;
    if (kills && e && e.g>0){ e.g = Math.max(0, e.g - kills); units = kills*(e.kind==='boar'?26:32)*(0.8+rnd()*0.4); out.game = units; out.hide = kills*(e.kind==='boar'?1:2);
      if (civTechKnown('domestication') && rnd()<0.15*kills){ civCaptureAnimal(c, e.kind==='boar'?'pig':'goat'); } }
    else why = game<3 ? 'there was hardly any game left' : 'the animals got away';
    if (A.risk && rnd() < A.risk*hrs*(1-sk(c,'hunting')/150)){ c.civ.hurt = 1; civProblem('injury',1,c); chronicle(`${c.name} was hurt on a hunt.`, 4, '🩹', 'health'); why = 'I was injured'; }
  } else {
    for (const g in A.out){ const u = A.out[g]*hrs*(b.acc/(hrs*60)||1)*techB*(A.season?A.season[season]:1)*abund*(0.85+rnd()*0.3); out[g] = u; units += u; }
    if (A.risk && rnd() < A.risk*hrs){ c.civ.hurt = 1; civProblem('injury',1,c); why = 'I was injured'; }
  }
  if (A.eco==='forage' && e) e.f = Math.max(0, e.f - units*0.55);
  if (A.eco==='fish' && e) e.fish = Math.max(0, e.fish - units*0.5);
  if (A.season && A.season[season] < 0.5 && !why) why = `little to be had in ${SEASONS[season].toLowerCase()}`;
  if (S.weather==='Storm' && !why) why = 'the storm';
  const org = b.job && civJobOf(c) && S.civ.orgs[civJobOf(c).org], dest = org ? org.stock : h ? h.store : S.civ.commons;
  for (const g in out){ let q = +out[g].toFixed(1); if (q<=0) continue; value += q*civMargValue(c, g, h); if (CG[g].food) ev('pd_'+b.task, q*CG[g].food/90);
    if (!org && CG[g].cat==='material' && civCivic(c)){ const p = civCommunityProjects().find(p=>(p.need[g]||0) > (p.have[g]||0)); if (p && (!h || civMaterialNeed(c,g) - (h.store[g]||0) <= 0 || civProjectsFor(c).length===0)){ const give = Math.min(q, p.need[g]-(p.have[g]||0)); p.have[g] = (p.have[g]||0)+give; q -= give; c.civ.respect += give*0.03; } }
    if (q>0) storeAdd(dest, g, q); }
  return {value, why, out};
}
CIV_WORK.water = (c, b, hrs) => { const h = hhOf(c); if (!hrs && b.stuck) return {value:0, why:'could not reach the water'}; const q = Math.max(6, Math.round(24*hrs)); if (h) storeAdd(h.store, 'water', q); return {value: q*0.05, why:null, out:{water:q}}; };
CIV_WORK.cook = (c, b, hrs) => {
  // smoking and drying turns perishable food into stores that last the winter
  const h = hhOf(c); if (!h) return {value:0, why:'no household'};
  let cap = hrs*(3 + sk(c,'cooking')/20), made = 0; const rack = civHas('drying_rack').length ? 1.3 : 1;
  for (const g of ['fish','game','meat','berries','veg']){ if (cap<=0) break; const q = Math.min(cap, h.store[g]||0); if (q<=0) continue; storeTake(h.store, g, q); const food = q*CG[g].food*0.9*rack; storeAdd(h.store, 'preserved', +(food/CG.preserved.food).toFixed(1)); made += food/CG.preserved.food; cap -= q; }
  if (!made) return {value:0, why:'nothing to preserve'};
  return {value: made*1.6, why:null, out:{preserved:made}};
};
CIV_WORK.craft = (c, b, hrs) => {
  const h = hhOf(c); if (!h) return {value:0};
  const st = h.store, out = {}; let value = 0;
  const make = (g, need, rate) => { let n = Math.floor(hrs*rate*(0.5+sk(c,CIV_CRAFT_SKILL[g]||'crafting')/100)); for (const m in need) n = Math.min(n, Math.floor((st[m]||0)/need[m])); if (n<=0) return false; for (const m in need) storeTake(st, m, need[m]*n); storeAdd(st, g, n); out[g] = n; value += n*CG[g].v*0.8; return true; };
  const tools = (st.tools||0) + (st.mtools||0);
  if (tools < 2 && make('tools', {stone:2, wood:1}, 0.8)) {}
  else if (knowsTech(c,'weaving') && (st.fiber||0) >= 4 && make((st.rope||0) < 3 ? 'rope' : 'cloth', {fiber:3}, 0.6)) {}
  else if (knowsTech(c,'pottery') && (st.clay||0) >= 3 && make('pottery', {clay:2, wood:1}, 0.6)) {}
  else if ((st.cloth||0) >= 2 && knowsTech(c,'weaving') && make('clothes', {cloth:2}, 0.3)) {}
  else if (civTechKnown('ironworking') && (st.metal||0) >= 1 && make('mtools', {metal:1, wood:1}, 0.3)) {}
  else make('tools', {stone:2, wood:1}, 0.8);
  return {value, why: value ? null : 'no materials to work with', out};
};
const CIV_CRAFT_SKILL = {rope:'weaving', cloth:'weaving', clothes:'weaving', pottery:'crafting', mtools:'smithing', tools:'crafting'};
CIV_TASK_VALUE.cook = (c, h) => { if (!h) return 0; const perish = ['fish','game','meat','berries','veg'].reduce((a,g)=>a+(h.store[g]||0),0); return Math.min(perish, 20)*0.7*(seasonOf(civDay())>=2 ? 1.6 : 1) * cog(c,'planning')*1.5; };
CIV_TASK_VALUE.craft = (c, h) => { if (!h) return 0; const st = h.store, tools = (st.tools||0)+(st.mtools||0); return (tools<2 && (st.stone||0)>=2 ? 12 : 0) + ((st.fiber||0)>=6 && knowsTech(c,'weaving') ? 5 : 0) + ((st.clay||0)>=4 && knowsTech(c,'pottery') ? 4 : 0); };

// ---------- evaluate and learn ----------
function civRecordOutcome(c, b, value, why){
  const X = c.civ, t = b.task; if (!t) return;
  const E = X.exp[t] || (X.exp[t] = {n:0, v:0});
  E.v = E.n ? E.v*0.7 + value*0.3 : value; E.n = Math.min(20, E.n+1);
  X.log[t] = (X.log[t]||0) + (b.acc||0)/60;
  const d = X.lastDec; if (d && d.act===t && d.day===civDay()){
    d.n++; d.val = +(((d.val||0)*(d.n-1) + value)/d.n).toFixed(1);
    if (!why) why = value > d.exp*1.25 ? civGoodReason(c, t) : value < d.exp*0.6 ? civBadReason(c, t) : null;
    if (why) d.why = why;
    // a surprising result is remembered, and it changes what this person expects next time
    if (d.n===2 && Math.abs(d.val-d.exp) > Math.max(3, d.exp*0.5)){ remember(c, `${ACTIVITIES[t].label} ${d.val>d.exp?'went better':'went worse'} than I expected${d.why?` (${d.why})`:''}.`, 4, [], 'Decision'); }
  }
}
function civGoodReason(c, t){ const A = ACTIVITIES[t]; if (A.skill && sk(c,A.skill)>55) return 'I have got good at it'; if (A.season && A.season[seasonOf(civDay())]>1.1) return 'a good season for it'; return 'luck was with me'; }
function civBadReason(c, t){ const A = ACTIVITIES[t]; if (A.skill && sk(c,A.skill)<20) return 'I don\'t really know how'; if (A.tool && !A.tool.some(g=>(hhOf(c)||{store:{}}).store[g]>0)) return 'no proper tools'; if (c.needs.energy<30) return 'I was exhausted'; return 'bad luck'; }
function civLearnFromWork(c, b, hrs, res){
  const A = ACTIVITIES[b.task]; if (!A || !hrs) return;
  const X = c.civ, rate = (0.4 + cog(c,'learning')*0.9) * (isAdult(c) ? 1 : 1.4);
  let mult = 1;
  // mentors and parents working beside you teach faster than trial and error
  const m = X.mentor && alive(X.mentor); if (m && m.plan && m.plan.blocks[m.rt.blockIdx] && m.plan.blocks[m.rt.blockIdx].task===b.task){ mult *= 1.9; civMentorTransfer(m, c, A); }
  if (b.withParent){ const p = alive(b.withParent); if (p) { mult *= 1.5; civMentorTransfer(p, c, A); } }
  if (A.skill){ const s = X.skill[A.skill]||0; X.skill[A.skill] = +Math.min(100, s + A.xp*hrs*rate*mult*0.28*(1-s/112)).toFixed(2);
    (SK[A.skill].know||[]).forEach(k=>{ const v = X.know[k]||0; X.know[k] = +Math.min(100, v + A.xp*hrs*rate*mult*0.07*(1-v/115)).toFixed(2); }); }
  X.practiced = X.practiced || {}; X.practiced[b.task] = civDay();
}
function civMentorTransfer(m, c, A){
  if (!A.skill) return; const ms = sk(m, A.skill), cs = sk(c, A.skill); if (ms <= cs) return;
  const gain = (ms-cs)*0.02*(0.5+kn(m,'teaching')/100+cog(m,'social')*0.4)*(0.5+cog(c,'learning'));
  c.civ.skill[A.skill] = +Math.min(ms, cs+gain).toFixed(2);
  const task = Object.keys(ACTIVITIES).find(k=>ACTIVITIES[k]===A);
  (m.civ.techs||[]).forEach(t=>{ const T0 = TECHS[t]; if (T0 && [].concat(T0.prac||[]).includes(task) && !knowsTech(c,t) && civCanGrasp(c,t) && rnd()<0.08) civLearnTech(c, t, m); });
  m.civ.teachAcc = (m.civ.teachAcc||0) + 0.2; m.civ.buyers.teach = m.civ.buyers.teach || {}; m.civ.buyers.teach[c.id] = (m.civ.buyers.teach[c.id]||0)+1;
}
// talk passes on knowledge, techniques and what worked
function civShareKnowledge(a, b){
  const [t, l] = kn(a,'teaching')+cog(a,'social') >= kn(b,'teaching')+cog(b,'social') ? [a,b] : [b,a];
  const doms = Object.keys(t.civ.know).filter(k=>(t.civ.know[k]||0) > (l.civ.know[k]||0)+10);
  if (doms.length){ const k = doms[hash(t.id+l.id+S.minute)%doms.length]; const gap = t.civ.know[k] - (l.civ.know[k]||0); l.civ.know[k] = +((l.civ.know[k]||0) + gap*0.012*(0.4+cog(l,'learning'))*(0.4+cog(t,'social'))).toFixed(2); }
  const techs = t.civ.techs.filter(x=>!l.civ.techs.includes(x) && civCanGrasp(l, x));
  if (techs.length && rnd() < 0.05 + cog(l,'learning')*0.05) civLearnTech(l, techs[0], t);
  // news of what paid off
  const best = Object.entries(t.civ.exp).filter(([k,E])=>E.n>=2).sort((x,y)=>y[1].v-x[1].v)[0];
  if (best){ l.civ.heard = l.civ.heard || {}; l.civ.heard[best[0]] = +best[1].v.toFixed(1); }
}
function civCanGrasp(c, t){ const T0 = TECHS[t]; if (!T0) return false; return Object.entries(T0.need||{}).every(([k,v])=>kn(c,k) >= v*0.6); }
function civLearnTech(c, t, from){
  if (knowsTech(c, t)) return; c.civ.techs.push(t);
  const C = S.civ, first = !C.tech[t] || !C.tech[t].knowers;
  if (!C.tech[t]) C.tech[t] = {day:civDay(), by:c.id, knowers:0};
  C.tech[t].knowers++;
  if (first){ C.tech[t].by = c.id; C.tech[t].day = civDay(); ev('techs');
    chronicle(from ? `${c.name} learned ${TECHS[t].label.toLowerCase()} from ${from.name}, bringing it back into use.` : `${c.name} worked out ${TECHS[t].label.toLowerCase()}. Nobody here knew how before.`, 8, '💡', 'science');
    remember(c, `I figured out ${TECHS[t].label.toLowerCase()}.`, 9); c.civ.respect += 5; }
  else if (from && hash(c.id+t)%4===0) remember(c, `${from.name} showed me ${TECHS[t].label.toLowerCase()}.`, 5, [from.id]);
}

// ---------- the daily and weekly mind ----------
function civMindsDaily(){
  const d = civDay();
  S.citizens.forEach(c=>{
    const X = c.civ;
    // discovery by practice: someone who keeps doing a thing, and understands enough, may see a better way
    for (const t in (X.practiced||{})){ if (X.practiced[t]!==d-0 && X.practiced[t]!==d-1) continue;
      for (const id in TECHS){ const T0 = TECHS[id]; const prac = [].concat(T0.prac||[]); if (!prac.includes(t) && !(id==='smoking' && (t==='fish'||t==='hunt'))) continue; if (knowsTech(c,id)) continue;
        if (!civTechPrereqs(c, id)) continue;
        const surplus = Object.entries(T0.need||{}).reduce((a,[k,v])=>a + Math.max(0, kn(c,k)-v), 0);
        const p = 0.0035 * (0.3+cog(c,'creativity')) * (0.5+c.personality.openness) * (1 + surplus/40) * (S.civ.tech[id] && S.civ.tech[id].knowers ? 2.5 : 1);
        if (rnd() < p) civLearnTech(c, id, null); } }
    // skills fade a little without use
    if (d%7===0) for (const s in X.skill){ const A = Object.keys(ACTIVITIES).find(k=>ACTIVITIES[k].skill===s); if (A && X.practiced && X.practiced[A] > d-21) continue; X.skill[s] = +Math.max(0, X.skill[s]-0.15).toFixed(2); }
    civGoalsDaily(c);
  });
  civMentorshipDaily();
  civTechRecount();
}
function civTechPrereqs(c, id){
  const T0 = TECHS[id]; if (!T0) return false;
  if (!Object.entries(T0.need||{}).every(([k,v])=>kn(c,k) >= v)) return false;
  if (!T0.any) return true;
  return T0.any.some(group=>group.every(x=> x.startsWith('th_') ? civTheoryAccepted(x) || (c.civ.beliefs[x]||0) > 0.6 : (knowsTech(c,x) || civTechKnown(x))));
}
function civGoalsDaily(c){
  if (!isAdult(c) || S.civ.overlay) return;
  const h = hhOf(c), home = S.civ.structs[c.home], days = h ? hhFoodDays(h) : 0;
  if (days < 2 && !civHasGoal(c,'secure_food')) civAddGoal(c, 'secure_food');
  const sf = civGoal(c, 'secure_food'); if (sf && days > 5) civEndGoal(c, sf, 'done');
  const season = seasonOf(civDay());
  if (season===2 && cog(c,'planning') > 0.45 && days < 12 && !civHasGoal(c,'winter_stores')) civAddGoal(c, 'winter_stores');
  const ws = civGoal(c,'winter_stores'); if (ws && (season===3 || days>=14)) civEndGoal(c, ws, days>=14?'done':'dropped');
  const tools = h ? (h.store.tools||0)+(h.store.mtools||0) : 0; if (tools===0 && c.personality.conscientiousness>0.4 && !civHasGoal(c,'acquire_tools')) civAddGoal(c, 'acquire_tools');
  const at = civGoal(c,'acquire_tools'); if (at && tools>0) civEndGoal(c, at, 'done');
  if (home && home.cond < 40 && !civHasGoal(c,'repair_home')) civAddGoal(c, 'repair_home', {s:home.id});
  const rh = civGoal(c,'repair_home'); if (rh && (!home || home.cond>70)) civEndGoal(c, rh, home?'done':'dropped');
  civHousingGoals(c, h, home);
  civLandUseGoals(c, h);
}
function civMindsWeekly(){
  const wk = weekNo(civDay());
  S.citizens.forEach(c=>{
    const X = c.civ;
    X.logWk.push(X.log); X.log = {}; if (X.logWk.length>5) X.logWk.shift();
    if (isAdult(c)){ civLongGoals(c); civSkillGoal(c); civOccupationWeekly(c); }
    // the goal list is revised when circumstances change: impossible goals are dropped
    X.goals.forEach(g=>{ if (g.status==='active' && civDay()-g.made > 120 && GOAL_DEFS[g.kind].lvl!=='long'){ civEndGoal(c, g, 'dropped', `I gave up on my plan to ${GOAL_DEFS[g.kind].label.toLowerCase()}.`); } });
    X.goals = X.goals.filter(g=>g.status==='active' || civDay()-(g.ended||0) < 60);
    civRefreshLook(c);
    civPrunePerson(c);
  });
}
// keep saves small as the settlement grows: the closest ties, recent memories and customers are what matter
function civPrunePerson(c){
  const keep = Object.entries(c.rel).filter(([id])=>alive(id)).sort((a,b)=>(b[1].tags.length>1||b[1].tags[0]!=='Neighbor'?1000:0)+Math.abs(b[1].affinity)+b[1].familiarity*30 - ((a[1].tags.length>1||a[1].tags[0]!=='Neighbor'?1000:0)+Math.abs(a[1].affinity)+a[1].familiarity*30)).slice(0, 36);
  c.rel = Object.fromEntries(keep);
  if (c.memory.records.length > 18) c.memory.records = c.memory.records.slice(-18);
  for (const t in c.civ.buyers){ const m = c.civ.buyers[t], ks = Object.keys(m); if (ks.length > 24) c.civ.buyers[t] = Object.fromEntries(ks.slice(-24).map(k=>[k, m[k]])); }
  if (c.mind && c.mind.mems && c.mind.mems.length > 10) c.mind.mems = c.mind.mems.slice(-10);
  for (const k in c.civ.know) if (c.civ.know[k] < 0.5) delete c.civ.know[k];
}
function civSkillGoal(c){
  if (civHasGoal(c,'learn_skill') || c.personality.openness + cog(c,'learning') < 0.9) return;
  // choose the skill whose work is most in demand and that this person is not yet good at
  const dem = S.civ.demand || {};
  const opts = Object.keys(dem).filter(t=>ACTIVITIES[t] && ACTIVITIES[t].skill && sk(c, ACTIVITIES[t].skill) < 40).sort((a,b)=>dem[b]-dem[a]);
  if (opts.length){ const t = opts[0]; civAddGoal(c, 'learn_skill', {skill:ACTIVITIES[t].skill, task:t}); }
}
// mentorship: a keen learner and someone skilled who likes them
function civMentorshipDaily(){
  if (civDay()%3) return;
  S.citizens.forEach(c=>{
    if (c.civ.mentor && !alive(c.civ.mentor)) c.civ.mentor = null;
    if (c.civ.mentor || c.age<12 || c.age>40) return;
    const g = civGoal(c,'learn_skill'), skill = g ? g.data.skill : (c.age<20 ? Object.keys(c.civ.skill).sort((a,b)=>sk(c,b)-sk(c,a))[0] : null); if (!skill) return;
    const m = S.citizens.filter(o=>o!==c && isAdult(o) && sk(o,skill) >= Math.max(45, sk(c,skill)+20) && peekRel(o,c.id).affinity > 5 && (o.civ.prot||[]).length < 3).sort((a,b)=>sk(b,skill)+peekRel(b,c.id).affinity/5 - sk(a,skill)-peekRel(a,c.id).affinity/5)[0];
    if (!m) return;
    c.civ.mentor = m.id; m.civ.prot = (m.civ.prot||[]).concat(c.id);
    const kind = c.age<18 ? 'master and apprentice' : 'mentor and protégé';
    [[c,m],[m,c]].forEach(([x,y])=>{ const R = getRel(x,y.id); if (!R.tags.includes('Mentor')) R.tags.push(x===c?'Mentor':'Protégé'); });
    // professional connections come with the mentor
    Object.entries(m.rel).filter(([id,R])=>R.affinity>40 && id!==c.id).slice(0,3).forEach(([id])=>{ const R = getRel(c,id); R.familiarity = Math.min(1, R.familiarity+0.2); });
    chronicle(`${m.name} took ${c.name} on as ${c.age<18?'an apprentice':'a protégé'} in ${SK[skill].label.toLowerCase()}.`, 4, '🧑‍🏫', 'learning'); ev('mentorships');
  });
}

// ---------- occupations emerge from what people keep doing, and who relies on it ----------
function civOccupationWeekly(c){
  const X = c.civ;
  if (X.job){ const j = civJobOf(c); if (j){ c.profession = j.role; return; } }
  const tot = {}; let all = 0;
  X.logWk.forEach(w=>{ for (const t in w){ tot[t] = (tot[t]||0) + w[t]; all += w[t]; } });
  const [top, hrs] = Object.entries(tot).sort((a,b)=>b[1]-a[1])[0] || [null, 0];
  const occ = OCCUPATIONS.find(o=>o.act===top);
  const share = all ? hrs/all : 0;
  const reliedOn = occ ? Object.keys((X.buyers[top]||{})).filter(id=>{ const o = alive(id); return o && hhOf(o)!==hhOf(c); }).length : 0;
  if (occ && share >= 0.42 && hrs >= 24 && (reliedOn >= 2 || X.logWk.length>=4 && share>0.6)){
    const tier = civOccTier(c, occ);
    if (X.occ!==occ.id || X.tier!==tier){
      const was = X.occ ? civOccTitle(c) : null;
      X.occ = occ.id; X.tier = tier; X.occSince = X.occSince && X.occ===occ.id ? X.occSince : civDay(); X.occHist.push({occ:occ.id, tier, day:civDay()});
      const title = civOccTitle(c); c.profession = title;
      chronicle(was ? `${c.name} is now known as the settlement's ${title.toLowerCase()} (formerly ${was.toLowerCase()}).` : `People have started calling ${c.name} a ${title.toLowerCase()}: ${reliedOn} other households rely on their work.`, was ? 5 : 6, '🏷️', 'work');
      remember(c, `Folk call me a ${title.toLowerCase()} now.`, 7); ev('occupations'); c.civ.respect += 2;
    }
  } else if (X.occ && share < 0.18 && X.logWk.length>=4){ const t = civOccTitle(c); X.occ = null; X.tier = 0; c.profession = 'Settler'; if (hash(c.id)%2) chronicle(`${c.name} has given up working as a ${t.toLowerCase()}.`, 3, '🏷️', 'work'); }
}
function civOccTier(c, occ){
  let tier = 0;
  occ.tiers.forEach((t,i)=>{ if (i===0) return;
    const A = ACTIVITIES[occ.act], okSkill = !t.skill || sk(c, A.skill) >= t.skill, okKnow = !t.know || Object.entries(t.know).every(([k,v])=>kn(c,k)>=v);
    const okTech = !t.tech || civTechKnown(t.tech), okInst = !t.inst || civHasInstitution(t.inst), okStruct = !t.struct || civOwnsStructOfKind(c, t.struct), okOrg = !t.org || civRunsOrg(c, t.org);
    if (okSkill && okKnow && okTech && okInst && okStruct && okOrg && tier===i-1) tier = i; });
  return tier;
}
function civOccTitle(c){ const o = c.civ.occ && OCC[c.civ.occ]; return o ? o.tiers[Math.min(c.civ.tier||0, o.tiers.length-1)].t : (c.civ.job ? (civJobOf(c)||{}).role || 'Worker' : 'Settler'); }
function civOwnsStructOfKind(c, kind){ return Object.values(S.civ.structs).some(s=>(s.def===kind || (kind==='shop' && STRUCTURES[s.def].biz)) && civOwnedBy(s.owner, c)); }
function civOwnedBy(o, c){ if (!o) return false; if (o.k==='person') return o.id===c.id; if (o.k==='hh') return o.id===c.civ.hh; if (o.k==='org'){ const g = S.civ.orgs[o.id]; return !!(g && (g.owners[c.id] || g.founders.includes(c.id))); } return false; }
function civRunsOrg(c, type){ return Object.values(S.civ.orgs).some(o=>o.status==='active' && (o.mgr===c.id || o.founders.includes(c.id)) && (type===true || o.type===type || o.biz===type)); }
function civHasInstitution(kind){
  if (kind==='medical') return civHas(['clinic','hospital']).length>0 || Object.values(S.civ.orgs).some(o=>o.edu && o.edu.medical);
  if (kind==='university') return civHas(['university']).length>0;
  if (kind==='lab') return civHas(['laboratory','institute','university']).length>0;
  return false;
}
