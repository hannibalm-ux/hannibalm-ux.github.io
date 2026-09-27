/* =====================================================================
   Pixel Town — civilization mode: panels
   The player watches; nobody here takes orders. The panels show what the settlers built,
   learned and decided, and why.
   ===================================================================== */
const civBar = (v, max, col) => `<span style="display:inline-block;width:70px;height:7px;background:#2a2c3e;border-radius:3px;vertical-align:middle"><span style="display:block;width:${Math.round(clamp(v/(max||100),0,1)*70)}px;height:7px;border-radius:3px;background:${col||'#7fd1ae'}"></span></span>`;
const civMoney = v => civMoneyOn() ? `${Math.round(v)}${S.civ.econ.money==='coins'?'¢':' beads'}` : '—';
function civStageLine(list, hist){ return hist.length ? hist.map(h=>`<span class="chip">${esc(list[h.stage])} · day ${h.day+1}</span>`).join('') : '<span class="muted">nothing yet</span>'; }
function civRenderHeader(){
  const C = S.civ, kids = S.citizens.filter(c=>!isAdult(c)).length, lead = C.gov.leader && alive(C.gov.leader);
  const stats = [
    ['Settlement', `${C.stageLabel || 'Camp'}${C.origins ? ' · '+C.origins.join('/') : ''}`], ['Population', `${S.citizens.length} (${S.citizens.length-kids} adults, ${kids} children)`],
    ['Food in store', `${civFoodDaysAll().toFixed(1)} days`], ['Cache', `${Math.round(storeFood(C.commons)/90)} person-days`],
    ['Market', MARKET_STAGES[C.econ.stage]], ['Money', C.econ.money ? civMoneyName() : 'none (barter)'],
    ['Government', C.gov.stage ? `${GOV_STAGES[C.gov.stage]}${lead?` · ${lead.name}`:''}` : 'none'], ['Justice', JUSTICE_STAGES[C.justice.stage]],
    ['Education', EDU_STAGES[C.edu.stage]], ['Techniques', Object.values(C.tech).filter(t=>t.knowers>0).length+' known'],
    ['Organisations', civOrgs().length || 'none'], ['Building', Object.keys(C.projects).length ? Object.keys(C.projects).length+' site'+(Object.keys(C.projects).length>1?'s':'') : 'none']
  ];
  $('stats').innerHTML = stats.map(([k,v])=>`<div class="stat"><small>${k}</small><strong>${esc(String(v))}</strong></div>`).join('');
  const last = S.chronicle[S.chronicle.length-1];
  $('ticker').innerHTML = last ? `<span>${esc(fmtStamp(last.t))}</span> ${esc(last.icon)} ${esc(last.text)}` : '';
}
// ---------- people ----------
function civRenderPeople(){
  const q = (ui.q||'').toLowerCase();
  const list = S.citizens.filter(c=>!q || c.name.toLowerCase().includes(q) || (c.profession||'').toLowerCase().includes(q)).sort((a,b)=>(b.civ.occ?1:0)-(a.civ.occ?1:0) || a.name.localeCompare(b.name));
  const sel = ui.sel && cById(ui.sel);
  $('pAdd').innerHTML = `<div class="row" style="margin-bottom:8px"><input id="pq" placeholder="Search name or occupation" value="${esc(ui.q||'')}" style="flex:1"></div>`;
  $('pq').oninput = e=>{ ui.q = e.target.value; civRenderPeople(); $('pq').focus(); };
  $('pList').innerHTML = (sel ? civPersonCard(sel) : '') + list.slice(0,160).map(c=>{ const h = hhOf(c); const top = Object.entries(c.civ.skill).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,v])=>`${SK[k]?SK[k].label:k} ${Math.round(v)}`).join(', ');
    return `<div class="cit ${ui.sel===c.id?'sel':''}" data-id="${c.id}"><div class="row" style="justify-content:space-between"><b>${esc(c.name)}</b><span class="muted" style="font-size:12px">${c.age} · ${esc(c.profession)}</span></div><div class="muted" style="font-size:12px">${esc(doingText(c))} · ${esc(top)}${h?` · ${esc(h.name)} household`:''}</div></div>`; }).join('');
  $('pList').querySelectorAll('.cit').forEach(el=>el.onclick=()=>{ ui.sel = el.dataset.id; cam.follow = true; $('zFollow').classList.add('on'); civRenderPeople(); });
}
function civPersonCard(c){
  const X = c.civ, h = hhOf(c), home = S.civ.structs[c.home], G = X.genes || {};
  const cogs = COG.map(k=>`<div style="font-size:12px">${COG_LABEL[k]} ${civBar(X.cog[k]*100, 100, '#8fb8ff')}</div>`).join('');
  const knows = Object.entries(X.know).filter(([k,v])=>v>=3).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>`<div style="font-size:12px">${KN[k]?KN[k].label:k} ${civBar(v)} ${Math.round(v)}</div>`).join('') || '<span class="muted">Knows little yet</span>';
  const skills = Object.entries(X.skill).filter(([k,v])=>v>=3).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>`<div style="font-size:12px">${SK[k]?SK[k].label:k} ${civBar(v,100,'#f2c14e')} ${Math.round(v)}</div>`).join('');
  const goals = X.goals.filter(g=>g.status==='active').map(g=>`<div style="font-size:12px"><span class="chip">${g.lvl}</span> ${esc(GOAL_DEFS[g.kind]?GOAL_DEFS[g.kind].label:g.kind)}${g.steps.length?` — ${g.steps.map(s=>s.done?`<s>${s.k}</s>`:s.k).join(' → ')}`:''}</div>`).join('') || '<span class="muted">No particular plans</span>';
  const decs = (X.major||[]).slice(-3).concat(X.dec.slice(-8)).reverse().map(d=>`<tr><td>${esc(fmtDateShort(d.day))}</td><td>${esc(d.sit||'')}</td><td>${esc(d.obj||'')}</td><td><b>${esc(ACTIVITIES[d.act]?ACTIVITIES[d.act].label:d.act)}</b></td><td class="num">${d.exp}</td><td class="num">${d.val==null?'…':d.val}</td><td>${esc(d.why||'')}</td></tr>`).join('');
  const job = civJobOf(c), mentor = X.mentor && cById(X.mentor);
  const bel = Object.entries(X.beliefs||{}).filter(([k,v])=>THEORIES[k]).map(([k,v])=>`<div style="font-size:12px">${esc(THEORIES[k].label)}: ${Math.round(v*100)}% sure</div>`).join('');
  const mems = c.memory.records.slice(-5).reverse().map(m=>`<div style="font-size:12px">• ${esc(m.text)}</div>`).join('');
  return `<div class="card"><div class="row" style="justify-content:space-between"><h3 style="margin:0">${esc(c.name)}</h3><span class="muted">${c.age} · ${genderOf(c)==='F'?'woman':'man'}</span></div>
    <p style="font-size:13px;margin:4px 0"><b>${esc(c.profession)}</b>${X.occ?` (recognised since day ${(X.occSince||0)+1})`:''}${job?` · employed by ${esc(job.orgName)} at ${job.wage}¢/day`:''} · ${esc(doingText(c))}</p>
    <p class="muted" style="font-size:12px;margin:2px 0">Home: ${home?esc(home.name):'none'}${h?` · ${esc(h.name)} household of ${h.members.length} · food ${hhFoodDays(h).toFixed(1)} days`:''} · health ${Math.round(X.health)} · ${civMoneyOn()?`purse ${Math.round(c.wallet)} · `:''}credit ${Math.round(X.credit.score)} · respect ${Math.round(X.respect)}</p>
    <p class="muted" style="font-size:12px;margin:2px 0">Traits: ${esc(c.traits.join(', '))} · values ${esc(c.values.join(', '))} · investor: ${esc(X.style||'')}${mentor?` · learning from ${esc(mentor.name)}`:''}${(X.prot||[]).length?` · teaching ${X.prot.map(id=>cById(id)).filter(Boolean).map(p=>esc(p.name.split(' ')[0])).join(', ')}`:''}</p>
    <p class="muted" style="font-size:12px;margin:2px 0">Appearance genes: height ${Math.round((G.height||0)*100)}, build ${Math.round((G.build||0)*100)}, jaw ${Math.round((G.jaw||0)*100)}, nose ${Math.round((G.nose||0)*100)} · <span style="display:inline-block;width:10px;height:10px;background:${G.skin}"></span> <span style="display:inline-block;width:10px;height:10px;background:${G.hair}"></span> <span style="display:inline-block;width:10px;height:10px;background:${G.eye}"></span></p>
    <details><summary>Mind: how they think</summary>${cogs}</details>
    <details open><summary>Knowledge</summary>${knows}</details><details><summary>Skills</summary>${skills}</details>
    <details><summary>Techniques (${X.techs.length})</summary><div style="font-size:12px">${X.techs.map(t=>TECHS[t]?TECHS[t].label:t).join(', ')||'none'}</div></details>
    <details open><summary>Goals</summary>${goals}</details>
    <details open><summary>Decisions: situation → objective → action → expected / actual → reason</summary><table style="font-size:11px"><tr><th>Day</th><th>Situation</th><th>Objective</th><th>Action</th><th>Exp.</th><th>Actual</th><th>Why</th></tr>${decs}</table></details>
    ${bel?`<details><summary>Beliefs</summary>${bel}</details>`:''}
    <details><summary>Recent memories</summary>${mems}</details></div>`;
}
// ---------- economy ----------
function civRenderEconomy(){
  const C = S.civ, E = C.econ, orgs = Object.values(C.orgs).sort((a,b)=>(a.status==='active'?0:1)-(b.status==='active'?0:1) || (b.cash||0)-(a.cash||0));
  const prices = civMoneyOn() ? Object.entries(E.prices).filter(([g])=>CG[g] && (CG[g].cat==='food'||CG[g].cat==='material'||CG[g].cat==='crafted')).slice(0,20).map(([g,p])=>`<tr><td>${esc(CG[g].name)}</td><td class="num">${p}</td></tr>`).join('') : '';
  const jobs = C.jobs.filter(j=>j.open).map(j=>`<div style="font-size:12px">📌 ${esc(j.role)} at ${esc((C.orgs[j.org]||{}).name||'?')} — ${j.wage}¢/day, open ${civDay()-j.since} days</div>`).join('') || '<span class="muted">No openings</span>';
  const loans = Object.values(C.contracts).filter(k=>k.kind==='loan' && k.status==='active').slice(-12).map(k=>`<div style="font-size:12px">${esc(civOwnerLabel(k.parties[0]))} → ${esc(civOwnerLabel(k.parties[1]))}: ${k.terms.principal}¢ at ${Math.round(k.terms.rate*100)}% · ${Math.round(k.terms.left)} left${k.late?` · ${k.late} late`:''}</div>`).join('') || '<span class="muted">None</span>';
  const kinds = {}; Object.values(C.contracts).forEach(k=>{ kinds[k.kind] = (kinds[k.kind]||0)+1; });
  const listed = orgs.filter(o=>o.listed && o.status==='active');
  $('p-market').innerHTML = `<h2>Economy</h2>
    <div class="card"><b>Market:</b> ${esc(MARKET_STAGES[E.stage])} · <b>Money:</b> ${E.money ? esc(civMoneyName())+` since day ${(E.moneyDay||0)+1}` : 'none yet — people barter and give gifts'} · price level ${E.level||1}<br>
      <span class="muted" style="font-size:12px">${E.barter} barters · ${E.barterFail} failed swaps · ${C.stats.gifts||0} gifts · ${C.stats.trades||0} sales · ${C.stats.caravans||0} caravans</span><div style="margin-top:4px">${civStageLine(MARKET_STAGES, E.stageHist)}</div></div>
    <div class="card"><b>Finance:</b> ${esc(FIN_STAGES[C.fin.stage])} <div style="margin-top:4px">${civStageLine(FIN_STAGES, C.fin.stageHist)}</div><div style="margin-top:6px">${loans}</div></div>
    ${civMoneyOn()?`<div class="card"><b>Prices</b><table>${prices}</table></div>`:''}
    <div class="card"><b>Organisations (${civOrgs().length} active)</b>${orgs.slice(0,40).map(o=>`<div style="font-size:12px;margin:4px 0;${o.status!=='active'?'opacity:.55':''}"><b>${esc(o.name)}</b> · ${esc(ORG_TYPES[o.type]?ORG_TYPES[o.type].label:o.type)}${o.biz&&BUSINESS_TYPES[o.biz]?` · ${esc(BUSINESS_TYPES[o.biz].industry)}`:''} · ${o.status}${o.status==='active'?` · cash ${Math.round(o.cash)} · profit/wk ${o.profitAvg} · staff ${o.staff.length}`:''}${o.sharePrice?` · share ${o.sharePrice}`:''}<br><span class="muted">founded day ${o.founded+1} by ${o.founders.map(id=>cById(id)?cById(id).name:'?').map(esc).join(', ')}${Object.keys(o.owners).length?` · owners: ${Object.entries(o.owners).slice(0,4).map(([id,v])=>`${esc(cById(id)?cById(id).name.split(' ')[0]:'?')} ${o.type==='corporation'||o.type==='public_corp'?v+' sh':Math.round(v*100)+'%'}`).join(', ')}`:''}${o.memory&&o.memory.lessons.length?` · learned: ${esc(o.memory.lessons.slice(-2).join(', '))}`:''}</span></div>`).join('') || '<p class="muted">No businesses, clubs or institutions yet.</p>'}</div>
    ${listed.length?`<div class="card"><b>Stock exchange</b>${listed.map(o=>`<div style="font-size:12px">${esc(o.name)}: ${o.sharePrice} per share · dividend ${o.divs||0}</div>`).join('')}</div>`:''}
    <div class="card"><b>Jobs</b>${jobs}</div>
    <div class="card"><b>Contracts</b> ${Object.entries(kinds).map(([k,v])=>`<span class="chip">${esc(k)} ×${v}</span>`).join('')||'<span class="muted">none</span>'}</div>`;
}
// ---------- land ----------
function civRenderLand(){
  const C = S.civ, cats = {};
  Object.values(C.structs).forEach(s=>{ const D = STRUCTURES[s.def]; (cats[D.cat] = cats[D.cat] || []).push(s); });
  const projs = Object.values(C.projects).map(p=>`<div style="font-size:12px">🏗️ <b>${esc(STRUCTURES[p.def].label)}</b> for ${esc(civOwnerLabel(p.owner))} · materials ${civBar(civProjectMatFrac(p)*100)} · work ${civBar(p.done/p.labor*100,100,'#f2c14e')} ${Object.entries(p.need).map(([g,q])=>`${CG[g]?CG[g].name.toLowerCase():g} ${Math.floor(p.have[g]||0)}/${q}`).join(', ')}</div>`).join('') || '<span class="muted">Nothing under construction</span>';
  const deps = C.deposits.filter(d=>d.known || d.suspected).map(d=>`<div style="font-size:12px">${d.known?'⛏️':'❓'} ${esc(MIN[d.min].label)}${d.known?` · ${Math.round(d.left)} units · depth ${d.depth} · purity ${Math.round(d.purity*100)}%`:' (a seep; nobody knows its use)'} · ${d.claim?`claimed by ${esc(civOwnerLabel(d.claim.who))}${d.claim.registered?' (registered)':''}`:'unclaimed'}${d.mine?' · mined':''}</div>`).join('') || '<span class="muted">Nothing found yet. The ground keeps its secrets.</span>';
  const an = {}; C.animals.forEach(a=>{ an[a.kind] = (an[a.kind]||0)+1; });
  $('p-land').innerHTML = `<h2>Land & building</h2>
    <div class="card"><b>Under construction</b>${projs}</div>
    ${Object.entries(cats).map(([cat, list])=>`<div class="card"><b>${esc(cat[0].toUpperCase()+cat.slice(1))} (${list.length})</b>${list.slice(0,30).map(s=>`<div style="font-size:12px">${esc(s.name)} <span class="muted">· ${esc(STRUCTURES[s.def].label)} · ${esc(civOwnerLabel(s.owner))} · ${civBar(s.cond)}${civMoneyOn()?` · ${s.value}¢`:''}${s.forSale?' · for sale':''}${s.status!=='active'?' · '+s.status:''}${STRUCTURES[s.def].farm&&s.meta?` · ${s.meta.stage}${s.meta.crop?' '+s.meta.crop:''}`:''}</span></div>`).join('')}</div>`).join('')}
    <div class="card"><b>Resources found</b>${deps}</div>
    <div class="card"><b>Animals kept</b> ${Object.entries(an).map(([k,v])=>`<span class="chip">${esc(ANIMAL_KINDS[k]?ANIMAL_KINDS[k].label:k)} ×${v}</span>`).join('')||'<span class="muted">none</span>'}<br><span class="muted" style="font-size:12px">Wild game left: ${C.eco.cells.reduce((a,e)=>a+e.g,0)} · trees felled: ${C.stats.trees_felled||0} · trail tiles worn: ${Object.keys(C.trail).length} · road tiles: ${Object.keys(C.roads).length}</span></div>`;
}
// ---------- government ----------
function civRenderGov(){
  const C = S.civ, G = C.gov, lead = G.leader && cById(G.leader);
  const meets = G.meetings.slice(-10).reverse().map(m=>`<div style="font-size:12px">${esc(fmtDateShort(m.day))} · ${esc(m.by)} called by ${esc(cById(m.convener)?cById(m.convener).name:'?')} (${m.n} came) on ${esc(m.topics.map(civProblemLabel).join(', '))}${m.decisions.length?` → ${esc(m.decisions.join('; '))}`:''}</div>`).join('') || '<span class="muted">No one has called a gathering yet.</span>';
  const probs = Object.entries(C.problems).filter(([k,v])=>v>=0.5).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span class="chip">${esc(civProblemLabel(k))} ${v.toFixed(1)}</span>`).join('') || '<span class="muted">none pressing</span>';
  $('p-laws').innerHTML = `<h2>Government</h2>
    <div class="card"><b>${esc(GOV_STAGES[G.stage])}</b>${G.form?` · ${esc(G.form)}`:''}${lead?` · ${esc(G.title||'leader')}: ${esc(lead.name)}`:''}<div style="margin-top:4px">${civStageLine(GOV_STAGES, G.stageHist)}</div></div>
    <div class="card"><b>What people are worried about</b><br>${probs}</div>
    ${G.council.length?`<div class="card"><b>Council</b><br>${G.council.map(id=>cById(id)).filter(Boolean).map(c=>esc(c.name)).join(', ')}</div>`:''}
    ${Object.keys(G.offices).length?`<div class="card"><b>Offices</b>${Object.entries(G.offices).map(([k,id])=>`<div style="font-size:12px">${esc(k.replace('_',' '))}: ${esc(cById(id)?cById(id).name:'vacant')}</div>`).join('')}</div>`:''}
    <div class="card"><b>Laws</b>${Object.values(G.laws).map(l=>`<div class="law">${esc(l.label)} <span class="muted">(day ${l.day+1})</span></div>`).join('')||'<p class="muted">No laws. Customs and respect keep order, for now.</p>'}</div>
    ${G.taxes.rate?`<div class="card"><b>Taxes:</b> ${esc(G.taxes.form)} tax (${G.taxes.form==='hearth'?G.taxes.rate+'¢ per household per week':Math.round(G.taxes.rate*100)+'%'}) · treasury ${Math.round(G.treasury)}¢</div>`:''}
    ${G.elections.length?`<div class="card"><b>Elections</b>${G.elections.slice(-5).reverse().map(e=>`<div style="font-size:12px">${esc(fmtDateShort(e.day))}: ${esc(cById(e.winner)?cById(e.winner).name:'?')} won (${e.votes}/${e.turnout})</div>`).join('')}</div>`:''}
    <div class="card"><b>Gatherings</b>${meets}</div>`;
}
// ---------- society ----------
function civRenderSociety(){
  const C = S.civ, SP = C.sports, lg = SP.league && C.orgs[SP.league];
  const hh = Object.values(C.hh).sort((a,b)=>hhFoodDays(a)-hhFoodDays(b)).slice(0,14).map(h=>`<div style="font-size:12px">${esc(h.name)} (${h.members.length}) · food ${civBar(hhFoodDays(h)*10, 100, hhFoodDays(h)<2?'#e84a4a':'#7fd1ae')} ${hhFoodDays(h).toFixed(1)}d · ${h.home&&C.structs[h.home]?esc(STRUCTURES[C.structs[h.home].def].label):'<b>no home</b>'}</div>`).join('');
  const table = lg && SP.season ? Object.entries(SP.season.table).sort((a,b)=>b[1].pts-a[1].pts).map(([id,r])=>`<tr><td>${esc((C.orgs[id]||{}).name||'?')}</td><td class="num">${r.p}</td><td class="num">${r.w}-${r.d}-${r.l}</td><td class="num">${r.gf}:${r.ga}</td><td class="num"><b>${r.pts}</b></td></tr>`).join('') : '';
  const nb = C.neighbors.map(n=>`<div style="font-size:12px"><b>${esc(n.name)}</b> (${n.dir}, ${n.dist} days) · pop ${n.pop} · food ${Math.round(civNbFoodDays(n))} days${n.shortage?' · <b>shortage</b>':''} · ${esc(n.ind.join(', '))} · ${esc(n.gov)} · relations ${Math.round(n.rel)} · grain ${n.prices.grain}</div>`).join('');
  const ships = C.shipments.slice(-6).reverse().map(s=>`<div style="font-size:12px">🛒 ${s.q} units from ${esc(s.fromName)} · ${s.status}${s.status==='en route'?`, due day ${s.arrive+1}`:''} · cost ${s.cost}</div>`).join('');
  const A = C.attract;
  $('p-soc').innerHTML = `<h2>Society</h2>
    <div class="card"><b>Households</b> (${Object.keys(C.hh).length}, hungriest first)${hh}</div>
    <div class="card"><b>Education:</b> ${esc(EDU_STAGES[C.edu.stage])}<div style="margin-top:4px">${civStageLine(EDU_STAGES, C.edu.stageHist)}</div>${civOrgs(o=>o.type==='school').map(o=>`<div style="font-size:12px">${esc(o.name)} · level ${o.edu.level} · ${o.staff.length} teacher${o.staff.length===1?'':'s'}</div>`).join('')}<span class="muted" style="font-size:12px">${C.stats.mentorships||0} apprenticeships · ${C.stats.lessons||0} lessons · ${(C.books||[]).length} books</span></div>
    <div class="card"><b>Sport</b> · ${SP.teams.length} teams · ${C.stats.pickup_games||0} pickup games${lg?` · <b>${esc(lg.name)}</b>, season ${SP.season.n}<table style="font-size:12px"><tr><th>Team</th><th>P</th><th>W-D-L</th><th>Goals</th><th>Pts</th></tr>${table}</table>${SP.seasons.length?`<span class="muted" style="font-size:12px">Champions: ${SP.seasons.slice(-4).map(s=>esc(s.name)+' (S'+s.n+')').join(', ')}</span>`:''}`:''}</div>
    <div class="card"><b>Neighbours</b>${nb}${ships?`<div style="margin-top:6px">${ships}</div>`:''}${C.lastQuotes?`<div class="muted" style="font-size:12px;margin-top:4px">Last food quotes: ${C.lastQuotes.map(q=>`${esc(q.n)} ${q.q?q.q+' @ '+q.price:'none'}`).join(' · ')}</div>`:''}</div>
    <div class="card"><b>Migration</b> · arrived ${C.migration.in} · left ${C.migration.out}${A?`<br><span class="muted" style="font-size:12px">How it looks from outside: food ${A.food.toFixed(2)}, homeless ${Math.round(A.homeless*100)}%, open jobs ${A.jobs}, wages ${A.wage.toFixed(1)}, crime ${A.crime.toFixed(2)}, schools ${A.school}, healers ${A.health}, taxes ${A.tax}, opportunity ${A.opp.toFixed(1)} → ${A.score.toFixed(2)}</span>`:''}</div>
    <div class="card"><b>Relationships</b> · ${S.relStats.marriages} marriages · ${S.relStats.divorces} separations · ${S.relStats.adoptions} children taken in</div>`;
}
// ---------- justice ----------
function civRenderJustice(){
  const J = S.civ.justice;
  const cases = J.cases.slice(-40).reverse().map(k=>`<div class="card" style="font-size:12px"><b>${esc(k.kind==='civil'?'Civil':'Criminal')}: ${esc(k.type)}</b> · ${esc(civCaseParty(k.plaintiff))} v. ${esc(civCaseParty(k.defendant))} · <span class="chip">${esc(k.status)}</span><br>Claim: ${esc(k.claim)}${k.damages?` · damages sought ${k.damages}`:''}${k.evidence.length?`<br>Evidence: ${esc(k.evidence.join(', '))}`:''}${k.witnesses.length?` · witnesses: ${k.witnesses.map(id=>cById(id)?cById(id).name:'?').map(esc).join(', ')}`:''}${k.settlement?`<br>Settled${k.settlement.by&&cById(k.settlement.by)?` by ${esc(cById(k.settlement.by).name)}`:''}${k.settlement.amount?`: ${k.settlement.amount} paid`:''}`:''}${k.judgment?`<br>Judgment by ${esc(cById(k.judgment.by)?cById(k.judgment.by).name:'?')}: ${k.judgment.result?esc(k.judgment.result):k.judgment.found?'for the plaintiff':'for the defendant'}${k.judgment.amount?`, ${k.judgment.amount} awarded`:''}${k.judgment.jail?`, ${k.judgment.jail} days jail`:''}${k.judgment.fine?`, fine ${k.judgment.fine}`:''}`:''}${k.lawyers&&(k.lawyers.p||k.lawyers.d)?`<br>Advocates: ${esc(cById(k.lawyers.p)?cById(k.lawyers.p).name:'—')} / ${esc(cById(k.lawyers.d)?cById(k.lawyers.d).name:'—')}`:''}</div>`).join('');
  $('p-justice').innerHTML = `<h2>Justice</h2><div class="card"><b>${esc(JUSTICE_STAGES[J.stage])}</b><div style="margin-top:4px">${civStageLine(JUSTICE_STAGES, J.stageHist)}</div></div>${cases || '<p class="muted">No disputes have come to anything yet.</p>'}`;
}
// ---------- science ----------
function civRenderScience(){
  const C = S.civ, techs = Object.entries(C.tech).filter(([k,t])=>t.knowers>0 && TECHS[k]).sort((a,b)=>a[1].day-b[1].day);
  const th = Object.entries(C.theories).map(([k,t])=>`<div style="font-size:12px">${esc(THEORIES[k].label)} · accepted ${civBar(t.accept*100,100,t.accept>=0.6?'#7fd1ae':'#c8a0a0')} ${Math.round(t.accept*100)}% · ${t.trials} trials</div>`).join('') || '<span class="muted">No theories tested yet.</span>';
  const rs = C.research.slice(-12).reverse().map(r=>`<div style="font-size:12px">${r.status==='active'?'🔬':'📄'} ${esc(cById(r.by)?cById(r.by).name:'?')} — ${esc(r.q)} · ${esc(RESEARCH_STAGES[Math.min(r.stage, RESEARCH_STAGES.length-1)])} · ${r.results.filter(x=>x.support).length}/${r.results.length} trials supported · rigour ${Math.round((r.rigor||0)*100)}%</div>`).join('') || '<span class="muted">Nobody is doing research yet.</span>';
  $('p-science').innerHTML = `<h2>Knowledge & science</h2>
    <div class="card"><b>Techniques known (${techs.length})</b>${techs.map(([k,t])=>`<div style="font-size:12px">💡 ${esc(TECHS[k].label)} <span class="muted">· ${t.knowers>=1?Math.round(t.knowers):'only in books'} know it${t.by&&cById(t.by)?` · first: ${esc(cById(t.by).name)}, day ${t.day+1}`:''}</span></div>`).join('')}</div>
    <div class="card"><b>Theories</b>${th}</div><div class="card"><b>Research</b>${rs}</div>
    <div class="card"><b>What the settlement knows</b>${KNOWLEDGE.map(k=>{ const best = Math.max(0, ...S.citizens.map(c=>kn(c,k.id))); return `<div style="font-size:12px">${esc(k.label)} ${civBar(best)} ${Math.round(best)}</div>`; }).join('')}</div>`;
}
function civRenderTab(t, force){
  if (t==='people' && (force || (!$('pList').matches(':hover') && document.activeElement.id!=='pq'))) civRenderPeople();
  if (t==='market' && (force || !$('p-market').matches(':hover'))) civRenderEconomy();
  if (t==='land' && (force || !$('p-land').matches(':hover'))) civRenderLand();
  if (t==='laws' && (force || !$('p-laws').matches(':hover'))) civRenderGov();
  if (t==='soc' && (force || !$('p-soc').matches(':hover'))) civRenderSociety();
  if (t==='justice' && (force || !$('p-justice').matches(':hover'))) civRenderJustice();
  if (t==='science' && (force || !$('p-science').matches(':hover'))) civRenderScience();
}
function civWelcome(){
  overlay(`<h3>A hundred people by a river</h3>
    <p>Pixel Town has not been built yet. Eighty adults and twenty children have made camp with crude shelters and about a week of food. There is no market, no farm, no council, no school and no bridge.</p>
    <ul style="padding-left:18px;font-size:14px"><li>Nobody has a job. People forage, fish, hunt, cut wood and gather stone, and the settlement starts calling them by what they keep doing.</li>
    <li>They swap and share at first. If swaps keep failing, money appears. A regular meeting place can turn into a market, then shops.</li>
    <li>When problems pile up, someone respected calls a gathering. Councils, leaders, laws, courts and schools only appear if the settlement needs them.</li>
    <li>Minerals, oil and gas are hidden in the ground. Prospectors may find them; mines and wells have to be built.</li>
    <li>You watch rather than command: tap anyone to see what they know, what they are planning, and why they chose what they did. The <b>Science</b> tab tracks what they discover.</li>
    <li>The settlement can fail. Different seeds grow very different places.</li></ul>
    <p class="muted" style="font-size:12px">The original town is still there: add <code>?mode=classic</code> to the address to start one.</p>
    <div class="row" style="margin-top:10px"><button class="btn primary" id="ovGo">Begin</button><button class="btn" id="ovMusic">Begin with music ♪</button></div>`);
  $('ovGo').onclick = ()=>overlay(''); $('ovMusic').onclick = ()=>{ overlay(''); if (!music.cfg.on) music.toggle(); };
}
