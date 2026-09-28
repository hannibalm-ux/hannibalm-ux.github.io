/* =====================================================================
   Pixel Town — civilization mode: memory, beliefs, opinions and trust
   Uses the town's cognition engine (experience / learnFact / shareNews /
   consolidate / trust) and feeds it with what civ settlers actually live
   through: hunger, rations, gifts, theft, fights, verdicts, gatherings,
   newspapers and word of mouth. What they come to believe changes how
   they vote, whether they protest, whether they stay, and who gets hired.
   Everything is event-driven: only witnesses, the people directly
   affected, and those who later hear or read about something learn it.
   ===================================================================== */
const CIV_PLATFORM_TOPICS = ['safety','constables','courts','relief','taxes','expansion','nature','council'];
Object.assign(TOPIC_LABEL, {food:'feeding the settlement'});
Object.assign(BELIEF_TEXT, {food:['The leaders let people go hungry.','The settlement looks after its own.']});

function civCog(c){ return cogOf(c); }
// keep minds light as the settlement grows: at most 14 memories (the most important, plus the last three days), and
// the retelling details go once news is stale
function civMindTidy(){
  const now = S.minute;
  S.citizens.forEach(c=>{ const M = c.mind; if (!M || !M.mems) return;
    if (M.mems.length > 14){ const recent = M.mems.filter(x=>now - x.t < 3*DAY), rest = M.mems.filter(x=>now - x.t >= 3*DAY).sort((a,b)=>b.imp*b.str-a.imp*a.str).slice(0, Math.max(6, 14 - recent.length)); M.mems = rest.concat(recent).sort((a,b)=>a.t-b.t); }
    M.mems.forEach(x=>{ if (now - x.t > 5*DAY){ if (x.pub) delete x.pub; if (x.fact) delete x.fact; } });
    if (M.thoughts && M.thoughts.length > 6) M.thoughts = M.thoughts.slice(-6); });
}
function civMemTypes(c, types){ return cogOf(c).mems.filter(x=>types.includes(x.type)).length; }

// ---------- lived experience ----------
function civHungerMemory(c){
  const M = cogOf(c); if (M.lastHungerMem && civDay() - M.lastHungerMem < 4) return; M.lastHungerMem = civDay();
  const season = SEASONS[seasonOf(civDay())].toLowerCase(), lead = S.civ.gov.leader && alive(S.civ.gov.leader);
  experience(c, {type:'hunger', text:`I went hungry during the ${season} food shortage.`, pub:`${c.name}'s family is going hungry.`, topics:{relief:0.8, poor:0.5, food:-0.8, council:-0.3, ...(lead ? {['p:'+lead.id]:-0.2} : {})}, imp:7, src:'self', emo:-0.5});
}
function civFedMemory(taker, giver, kind){
  if (!taker) return;
  if (kind==='kin' && giver) experience(taker, {type:'helped', text:`${giver.name}'s household shared food with us when we had none.`, who:[giver.id], topics:{['p:'+giver.id]:1, poor:0.4}, imp:6, src:'self', emo:0.3});
  if (kind==='ration') experience(taker, {type:'ration', text:'The common store fed my family when our larder was empty.', pub:`The common store is feeding the ${(hhOf(taker)||{name:'hungry'}).name} household.`, topics:{relief:1, food:0.8, council:0.4}, imp:6, src:'self', emo:0.3});
}
// once a week: what the week felt like to each adult
function civCognitionWeekly(){
  const C = S.civ, G = C.gov, price = typeof civLandPrice==='function' ? civLandPrice(C.center[0], C.center[1]) : 0;
  S.citizens.filter(isAdult).forEach(c=>{
    const h = hhOf(c), M = cogOf(c), w = M.week || (M.week = {});
    if (w.tax >= 2) experience(c, {type:'tax', text:`Paid ${Math.round(w.tax)} in taxes this week.`, topics:{taxes: w.tax > 6 ? -0.8 : -0.3}, imp: w.tax > 6 ? 5 : 3, src:'self'});
    if (h && !h.home) experience(c, {type:'crowded', text:'Still no roof of our own. There is no good land left near camp.', topics:{expansion:0.6}, imp:5, src:'self', emo:-0.2});
    else if (price > 14 && hash(c.id+civDay())%3===0 && (c.wallet||0) < price*6) experience(c, {type:'land', text:'Land near the settlement has become too dear for people like us.', topics:{expansion:0.5, rich:-0.3}, imp:4, src:'self'});
    if (c.values.includes('Nature') && (C.stats.trees_felled||0) > 400 && hash(c.id+civDay())%4===0) experience(c, {type:'nature', text:'The woods around us are being cut down.', topics:{nature:0.6, expansion:-0.5}, imp:4, src:'saw'});
    // a quiet month at home: nothing stolen, nobody hurt, the feeling of danger eases
    if (!M.mems.some(x=>['victim','crime'].includes(x.type) && S.minute - x.t < 28*DAY)) shiftOpinion(c, 'safety', 5);
    M.week = {};
  });
  civNewspapersWeekly();
  civProtestsWeekly();
}
// gatherings: whoever came hears what was said
function civGatheringHeard(att, topics, decisions, convener){
  const text = `At the gathering, ${convener.name} spoke about ${topics.map(civProblemLabel).join(' and ')}${decisions.length ? '; we agreed to '+decisions.join(', ') : ''}.`;
  const tp = {}; topics.forEach(t=>{ if (t==='crime') tp.safety = -0.2; if (t==='food') tp.food = -0.3; }); if (decisions.length) tp.council = 0.4; else tp.council = -0.3; tp['p:'+convener.id] = decisions.length ? 0.3 : -0.1;
  att.forEach(c=>experience(c, {ev:'gather_'+civDay(), type:'gathering', text, pub:text, who:[convener.id], topics:tp, imp:4, src:'hall'}));
}
// ---------- word of mouth ----------
function civGossip(c, o){ if (!isAdult(c) || !isAdult(o) || c.jail || o.jail) return; if (rnd() < 0.35 + (c.traits.includes('Gossip')?0.25:0)) shareNews(c, o); }
// ---------- newspapers: read by those who can read and can get a copy; sometimes wrong ----------
function civNewspapersWeekly(){
  const papers = civOrgs(o=>o.biz==='newspaper' && o.status==='active'); if (!papers.length) return;
  const C = S.civ, since = civDay()-7, items = (C.wire||[]).filter(x=>x.day>=since).slice(-6);
  const big = S.chronicle.filter(e=>e.t >= since*DAY && e.imp >= 7 && !['romance'].includes(e.kind)).slice(-4).map(e=>({text:e.text, who:[], topics:{}, ev:'chr_'+e.t}));
  papers.forEach(o=>{
    S.papers[o.id] = o.name;
    const staff = (o.staff||[]).map(alive).filter(Boolean), skill = staff.length ? Math.max(...staff.map(s=>sk(s,'journalism')||kn(s,'literacy'))) : 20;
    const stories = items.concat(big).slice(0, 6); if (!stories.length) return;
    const readers = S.citizens.filter(c=>isAdult(c) && !c.jail && kn(c,'literacy') >= 8);
    stories.forEach(st=>{
      // a careless paper gets names wrong now and then
      let who = st.who || [], text = st.text, wrong = false;
      if (who.length && rnd() < 0.18 - skill/600){ const other = S.citizens.filter(isAdult)[Math.floor(rnd()*S.citizens.filter(isAdult).length)]; if (other && other.id!==who[0]){ const was = cById(who[0]); if (was){ text = text.split(was.name).join(other.name); who = [other.id]; wrong = true; } } }
      readers.forEach(r=>{ if (rnd() > 0.55) return; experience(r, {ev:(st.ev||'np')+'_'+o.id, type:'news', text:`${o.name}: ${text}`, pub:text, who, topics:st.topics||{}, imp:5, src:'paper', from:o.id, fact: st.case && who.length ? {id:st.case, who:who[0], conf:0.6, kind:(C.justice.cases.find(k=>k.id===st.case)||{}).type} : null}); });
      if (wrong) o.misprints = (o.misprints||0) + 1;
    });
    ev('papers_read', readers.length);
  });
}
// when a verdict comes out, people whose paper or gossip pointed elsewhere trust that source a little less
function civVerdictTrust(k){
  if (!k.defendant || k.defendant.k!=='person' || !k.judgment) return;
  const convicted = k.judgment.found ? k.defendant.id : null;
  S.citizens.forEach(c=>{ const f = cogOf(c).kn[k.id]; if (!f) return;
    if (convicted){ if (f.who===convicted) { if (f.src==='paper' && f.from) nudgeTrust(c, 'press:'+f.from, 0.03); nudgeTrust(c, 'courts', 0.02); }
      else { if (f.src==='paper' && f.from) nudgeTrust(c, 'press:'+f.from, -0.06); if (f.src==='rumor') nudgeTrust(c, 'rumor', -0.05); if (f.conf > 0.6) { nudgeTrust(c, 'courts', -0.05); shiftOpinion(c, 'courts', -6); } } } });
}
// ---------- votes: platform, record, lived experience, family ----------
function civPlatform(c){ const op = cogOf(c).op; return CIV_PLATFORM_TOPICS.map(t=>[t, op[t]||0]).filter(([t,v])=>Math.abs(v)>=25).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,2).map(([t,v])=>[t, Math.sign(v)]); }
function civVoteScore(v, c){
  let s = peekRel(v,c.id).affinity + civInfluence(c)*0.4 + (c.values.some(x=>v.values.includes(x))?15:0) + (v.id===c.id?100:0);
  const m = cogOf(v);
  civPlatform(c).forEach(([t, dir])=>{ s += clamp((m.op[t]||0)*dir/3, -22, 22); });
  for (const k of Object.values(m.kn)) if (k.who===c.id && k.conf >= 0.35) s -= 28*k.conf*(k.sev||3)/4; // what the voter believes the candidate has done
  if (S.civ.gov.leader===c.id){ s -= m.mems.filter(x=>x.src==='self' && ['hunger','victim','wronged','rough'].includes(x.type)).length*6; s += m.mems.filter(x=>['ration','helped'].includes(x.type)).length*3; }
  return s;
}
function civVote(voters, cands){
  const first = {}; voters.forEach(v=>{ first[v.id] = cands.map(c=>[c, civVoteScore(v, c)]).sort((a,b)=>b[1]-a[1])[0][0].id; });
  const tally = {}; voters.forEach(v=>{
    // family and close friends talk each other round
    const talk = {}; Object.entries(v.rel||{}).forEach(([id,r])=>{ if (first[id] && (r.tags.includes('Family') || r.affinity > 60)) talk[first[id]] = (talk[first[id]]||0) + 8*(1-stubborn(v)); });
    const best = cands.map(c=>[c, civVoteScore(v, c) + (talk[c.id]||0)]).sort((a,b)=>b[1]-a[1])[0][0]; tally[best.id] = (tally[best.id]||0)+1; });
  return tally;
}
// ---------- protests: grievances people have lived, spread through friends ----------
const CIV_PROTEST = {constables:'the constables', courts:'the courts', taxes:'taxes', council:'the leaders', food:'hunger in the settlement', expansion:'expanding the settlement', nature:'cutting down the woods'};
function civProtestsWeekly(){
  const C = S.civ, G = C.gov, d = civDay(); if (G.stage < 2) return;
  C.protests = C.protests || []; const adults = S.citizens.filter(c=>isAdult(c) && !c.jail && !c.away);
  const topics = Object.keys(CIV_PROTEST).filter(t=>!C.protests.some(p=>p.topic===t && d-p.day < 42));
  for (const t of topics){
    const dir = t==='nature' ? 1 : -1; // nature protests are *for* protection
    const angry = adults.filter(c=>(cogOf(c).op[t]||0)*dir >= 40);
    if (angry.length < 8) continue;
    const joins = new Set();
    angry.forEach(c=>{ const M = cogOf(c), lived = M.mems.filter(x=>x.src==='self' && (x.topics||{})[t] && Math.sign(x.topics[t])===dir).length, bel = M.bel.some(b=>b.topic===t && b.pos===dir);
      if ((lived || bel) && rnd() < 0.1 + c.politics.civicEngagement*0.3 + lived*0.1 + (bel?0.15:0)) joins.add(c); }); // people march over what they have lived or firmly believe
    // friends of those marching come along
    [...joins].forEach(c=>Object.entries(c.rel||{}).forEach(([id,r])=>{ const f = alive(id); if (f && isAdult(f) && !f.jail && r.affinity > 50 && (cogOf(f).op[t]||0)*dir >= 15 && rnd() < 0.3) joins.add(f); }));
    const n = joins.size; if (n < Math.max(8, adults.length*0.07)) continue;
    const P = {topic:t, day:d, n, ids:[...joins].map(c=>c.id).slice(0, 40)}; C.protests.push(P); if (C.protests.length > 40) C.protests.shift(); ev('protests');
    const lead = [...joins].sort((a,b)=>civInfluence(b)-civInfluence(a))[0];
    chronicle(`${n} people marched ${dir>0?'for':'against'} ${CIV_PROTEST[t]}${lead?`, led by ${lead.name}`:''}.`, 7, '✊', 'gov');
    S.week.society.push(`Protest: ${CIV_PROTEST[t]} (${n})`);
    const ids = [...joins].map(c=>c.id);
    joins.forEach(c=>{ experience(c, {ev:'protest_'+t+d, type:'protest', text:`I marched ${dir>0?'for':'against'} ${CIV_PROTEST[t]}.`, topics:{[t]:dir*0.6}, imp:6, src:'self'}); ids.slice(0,6).forEach(id=>{ if (id!==c.id) adjustRel(c, cById(id), 2); }); });
    civWitnesses(C.center[0], C.center[1], 12, ids).forEach(o=>experience(o, {ev:'protest_'+t+d, type:'protest_seen', text:`${n} people marched ${dir>0?'for':'against'} ${CIV_PROTEST[t]}.`, pub:`${n} people marched ${dir>0?'for':'against'} ${CIV_PROTEST[t]}.`, topics:{[t]:dir*0.2}, imp:4, src:'saw'}));
    civProtestAnswered(t, n, lead);
  }
}
// what the leaders do about it depends on the grievance
function civProtestAnswered(t, n, lead){
  const C = S.civ, G = C.gov; civProblem(t==='food' ? 'food' : t==='constables'||t==='courts' ? 'crime' : 'dispute', 2);
  if (t==='constables'){ const cop = alive(G.offices.constable); const rough = C.justice.cases.filter(k=>k.judgment && k.judgment.rough && k.contested && k.judgment.by===(cop&&cop.id)).length;
    if (cop && rough >= 2){ delete G.offices.constable; cop.office = null; const nw = civWatch().find(x=>x!==cop && !x.office && civLegalScore(x) < 0.3); if (nw){ G.offices.constable = nw.id; nw.office = 'Constable'; } chronicle(`After the protest, ${cop.name} was replaced as constable${nw?` by ${nw.name}`:''}.`, 7, '🏛️', 'gov'); } }
  if (t==='taxes' && G.taxes && G.taxes.rate){ G.taxes.rate = +(G.taxes.rate*0.8).toFixed(3); chronicle('The leaders lowered taxes after the protest.', 6, '🏛️', 'gov'); }
  if (t==='council' && G.stage>=5 && G.elections.length && civDay() - G.elections[G.elections.length-1].day > 21) civElection('protesters demanded a new vote');
  if (t==='courts'){ const m = alive(G.offices.magistrate); if (m && S.citizens.filter(c=>Object.values(cogOf(c).kn).some(k=>k.who===m.id && k.conf>0.5)).length >= n/2){ delete G.offices.magistrate; m.office = null; chronicle(`${m.name} stepped down as magistrate after the protest.`, 7, '🏛️', 'gov'); } }
}
// ---------- leaving: poverty is not the only reason ----------
function civDiscontent(c){ const M = cogOf(c); let d = 0; if ((M.op.safety||0) < -50) d += 0.25; if ((M.op.council||0) < -50) d += 0.2; if ((M.op.courts||0) < -60) d += 0.15; d += Math.min(0.4, M.mems.filter(x=>['wronged','victim','hunger'].includes(x.type) && x.src==='self').length*0.1); return d; }
