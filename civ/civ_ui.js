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
    return `<div class="cit ${ui.sel===c.id?'sel':''}" data-id="${c.id}"><div class="row" style="justify-content:space-between"><b>${esc(c.name)}</b><span class="muted" style="font-size:12px">${c.age} · ${esc(c.profession)}</span></div><div class="muted" style="font-size:12px">${c.jail?'🔒 ':''}${c.away?'🧭 ':''}${esc(doingText(c))} · ${esc(top)}${h?` · ${esc(h.name)} household`:''}${civDistrictOf(c)?` · 🏘️ ${esc(civDistrictOf(c))}`:''}</div></div>`; }).join('');
  $('pList').querySelectorAll('.rawMind').forEach(x=>x.onchange=()=>{ ui.rawMind = x.checked; civRenderPeople(); });
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
    ${civMindHtml(c)}
    <details><summary>Thinking style</summary>${cogs}</details>
    <details open><summary>Knowledge</summary>${knows}</details><details><summary>Skills</summary>${skills}</details>
    <details><summary>Techniques (${X.techs.length})</summary><div style="font-size:12px">${X.techs.map(t=>TECHS[t]?TECHS[t].label:t).join(', ')||'none'}</div></details>
    <details open><summary>Goals</summary>${goals}</details>
    <details><summary>Decisions: situation → objective → action → expected / actual → reason</summary><table style="font-size:11px"><tr><th>Day</th><th>Situation</th><th>Objective</th><th>Action</th><th>Exp.</th><th>Actual</th><th>Why</th></tr>${decs}</table></details>
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
  const idle = p => civDay() - (p.lastProg ?? p.started);
  const projs = Object.values(C.projects).sort((a,b)=>(b.purpose==='home')-(a.purpose==='home') || idle(a)-idle(b)).map(p=>`<div style="font-size:12px">🏗️ <b><a ${locAttr(p.x,p.y,p.w,p.h,STRUCTURES[p.def].label)}>${esc(STRUCTURES[p.def].label)}</a></b> for ${esc(civOwnerLabel(p.owner))}${p.contractor && C.orgs[p.contractor] ? ` · built by ${esc(C.orgs[p.contractor].name)}` : ''}${idle(p) >= 7 ? ` · <span class="No">no progress for ${idle(p)} days</span>` : ''} · materials ${civBar(civProjectMatFrac(p)*100)} · work ${civBar(p.done/p.labor*100,100,'#f2c14e')} ${Object.entries(p.need).map(([g,q])=>`${CG[g]?CG[g].name.toLowerCase():g} ${Math.floor(p.have[g]||0)}/${q}`).join(', ')}</div>`).join('') || '<span class="muted">Nothing under construction</span>';
  const deps = C.deposits.filter(d=>d.known || d.suspected).map(d=>`<div style="font-size:12px">${d.known?'⛏️':'❓'} <a ${locAttr(d.x,d.y,1,1,MIN[d.min].label)}>${esc(MIN[d.min].label)}</a>${d.known?` · ${Math.round(d.left)} units · depth ${d.depth} · purity ${Math.round(d.purity*100)}%`:' (a seep; nobody knows its use)'} · ${d.claim?`claimed by ${esc(civOwnerLabel(d.claim.who))}${d.claim.registered?' (registered)':''}`:'unclaimed'}${d.mine?' · mined':''}</div>`).join('') || '<span class="muted">Nothing found yet. The ground keeps its secrets.</span>';
  const an = {}; C.animals.forEach(a=>{ an[a.kind] = (an[a.kind]||0)+1; });
  $('p-land').innerHTML = `${civFrontierHtml()}<h2>Land & building</h2>
    <p class="muted" style="font-size:12px;margin:2px 0 6px">Click any building, site or find to show it on the map.</p>
    ${civHousingHtml()}
    ${civTransportHtml()}
    <div class="card"><b>Under construction</b>${projs}</div>
    ${Object.entries(cats).map(([cat, list])=>`<div class="card"><b>${esc(cat[0].toUpperCase()+cat.slice(1))} (${list.length})</b>${list.slice(0,60).map(s=>`<div style="font-size:12px"><a ${locAttr(s.x,s.y,s.w,s.h,s.name)}>${esc(s.name)}</a> <span class="muted">· ${esc(STRUCTURES[s.def].label)} · ${esc(civOwnerLabel(s.owner))} · ${civBar(s.cond)}${civMoneyOn()?` · ${s.value}¢`:''}${s.forSale?' · for sale':''}${s.status!=='active'?' · '+s.status:''}${STRUCTURES[s.def].farm&&s.meta?` · ${s.meta.stage}${s.meta.crop?' '+s.meta.crop:''}`:''}</span></div>`).join('')}</div>`).join('')}
    <div class="card"><b>Resources found</b>${deps}</div>
    <div class="card"><b>Animals kept</b> ${Object.entries(an).map(([k,v])=>`<span class="chip">${esc(ANIMAL_KINDS[k]?ANIMAL_KINDS[k].label:k)} ×${v}</span>`).join('')||'<span class="muted">none</span>'}<br><span class="muted" style="font-size:12px">Wild game left: ${C.eco.cells.reduce((a,e)=>a+e.g,0)} · trees felled: ${C.stats.trees_felled||0} · trail tiles worn: ${Object.keys(C.trail).length} · road tiles: ${Object.keys(C.roads).length}</span></div>`;
  wireLocate($('p-land'));
  $('p-land').querySelectorAll('[data-explore]').forEach(b=>b.onclick=()=>{ const r = civLaunchExpedition(b.dataset.explore, {k:'player'}); if (r.err) alert(r.err); civRenderLand(); });
  $('p-land').querySelectorAll('[data-annex]').forEach(b=>b.onclick=()=>{ const cell = cellOf(b.dataset.annex); const G = S.civ.gov, lead = G.leader && alive(G.leader); civProposeAnnex(cell, null, civAnnexWhy(cell)); civRenderLand(); });
}
// ---------- resources: everything the settlement has, where it is kept, and how it is changing ----------
function civResourceTotals(){
  const C = S.civ, where = {hh:{}, commons:{}, biz:{}}, tot = {};
  const add = (bucket, st) => { for (const g in st){ if (!CG[g]) continue; bucket[g] = (bucket[g]||0) + st[g]; tot[g] = (tot[g]||0) + st[g]; } };
  Object.values(C.hh).forEach(h=>add(where.hh, h.store)); add(where.commons, C.commons); Object.values(C.orgs).forEach(o=>{ if (o.stock) add(where.biz, o.stock); });
  const need = S.citizens.reduce((a,c)=>a + (isAdult(c)?90:62), 0) || 1;
  const foodPts = CIV_FOODS.reduce((a,g)=>a + (tot[g]||0)*CG[g].food, 0);
  const cap = Object.values(C.hh).reduce((a,h)=>a + hhCap(h), 0) + civStructsOf(x=>STRUCTURES[x.def].store && x.status==='active').reduce((a,x)=>a + STRUCTURES[x.def].store, 0);
  const used = Object.values(C.hh).reduce((a,h)=>a + storeUnits(h.store), 0) + storeUnits(C.commons);
  const dom = {}; C.animals.forEach(a=>{ dom[a.kind] = (dom[a.kind]||0)+1; });
  const eco = C.eco ? C.eco.cells.reduce((a,e)=>({game:a.game+e.g, gcap:a.gcap+e.gcap, fish:a.fish+e.fish, fishcap:a.fishcap+e.fishcap, forage:a.forage+e.f, fcap:a.fcap+e.fcap, small:a.small+(e.small||0)}), {game:0,gcap:0,fish:0,fishcap:0,forage:0,fcap:0,small:0}) : null;
  let trees = 0; for (let y=Y0; y<Y0+MH; y++) for (let x=X0; x<X0+MW; x++) if (tileAt(x,y)===T.TREE) trees++;
  const deps = C.deposits.filter(d=>d.known);
  return {where, tot, need, foodPts, foodDays: foodPts/need, cap, used, dom, eco, trees, deps, mined: deps.reduce((a,d)=>a + Math.max(0, (d.size||0) - (d.left||0)), 0)};
}
function civResSnapshot(){
  const R = civResourceTotals(), t = R.tot, C = S.civ;
  C.resHist = (C.resHist || []).concat({d:civDay(), food:+R.foodDays.toFixed(1), wood:Math.round(t.wood||0), stone:Math.round(t.stone||0), animals:C.animals.length, game:R.eco ? R.eco.game : 0, trees:R.trees, spoiled:Math.round(C.spoiledDay||0)}).slice(-52);
}
function civRenderResources(){
  const C = S.civ, R = civResourceTotals(), t = R.tot, n = v => v>=100 ? Math.round(v).toLocaleString() : (+v.toFixed(1)).toString();
  const H = C.resHist || [], sp = k => H.length>1 ? sparkline(H.map(x=>x[k])) : '';
  const row = (g, extra) => `<tr><td>${esc(CG[g].name)}</td><td class="num">${n(t[g]||0)}</td><td class="num muted">${n(R.where.hh[g]||0)}</td><td class="num muted">${n(R.where.commons[g]||0)}</td><td class="num muted">${n(R.where.biz[g]||0)}</td>${extra!=null?`<td class="num">${extra}</td>`:''}</tr>`;
  const table = (goods, head, extra) => goods.length ? `<table class="tbl" style="width:100%;font-size:12px"><tr><th>${head}</th><th class="num">total</th><th class="num">homes</th><th class="num">common</th><th class="num">firms</th>${extra?`<th class="num">${extra[0]}</th>`:''}</tr>${goods.map(g=>row(g, extra ? extra[1](g) : null)).join('')}</table>` : '<span class="muted">none</span>';
  const foods = CIV_FOODS.filter(g=>t[g]>0.05).sort((a,b)=>(t[b]*CG[b].food)-(t[a]*CG[a].food));
  const byCat = cat => CIV_GOODS.filter(g=>g.cat===cat && t[g.id]>0.05).map(g=>g.id).sort((a,b)=>t[b]-t[a]);
  const storeTechs = Object.keys(TECHS).filter(k=>TECHS[k].store);
  const days = R.foodDays, dcol = days<3 ? 'No' : days<10 ? '' : 'Yes';
  const D = C.dist || {}, DT = C.distTot || {};
  const anim = Object.entries(R.dom).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span class="chip">${esc(ANIMAL_KINDS[k]?ANIMAL_KINDS[k].label:k)} ×${v}</span>`).join('') || '<span class="muted">none kept yet</span>';
  const E = R.eco, pct = (a,b) => b ? Math.round(a/b*100) : 0;
  $('p-res').innerHTML = `<h2>Resources</h2>
    <div class="card"><b>Food</b> <span class="${dcol}">${n(days)} days</span> for ${S.citizens.length} people ${sp('food')}
      <div style="font-size:12px;margin:4px 0">Storage ${civBar(R.used, R.cap||1, R.used>R.cap?'#e06c5a':'#7fd1ae')} ${n(R.used)} / ${n(R.cap)} units · spoiled yesterday: <b>${n(C.spoiledDay||0)}</b> units · saved by storage know-how so far: ${n(C.storeSaved||0)}</div>
      ${table(foods, 'Food', ['person-days', g=>n((t[g]||0)*CG[g].food/85)])}</div>
    <div class="card"><b>Keeping food</b><div style="font-size:12px">${storeTechs.map(k=>{ const T0 = TECHS[k], st = C.tech[k], kn0 = st ? st.knowers : 0; const what = Object.entries(T0.store).map(([g,f])=>`${g==='all'?'all food':(CG[g]?CG[g].name.toLowerCase():g)} ×${f}`).join(', ');
        return `<div>${kn0 ? '✅' : '🔒'} <b>${esc(T0.label)}</b> <span class="muted">· ${kn0 ? `${kn0} know it` : 'not yet worked out'} · keeps ${esc(what)} longer</span></div>`; }).join('')}
      <div class="muted" style="margin-top:4px">A household keeps food longer for every technique one of its adults knows; the common store uses whatever anyone in the settlement knows. People discover these by cooking, gathering, farming and herding, especially when food is rotting, or by research, and pass them on by talking and teaching.</div></div></div>
    <div class="card"><b>Sharing food</b><div style="font-size:12px">Yesterday: ${D.needy||0} households were short · ${D.helped||0} were helped · ${D.shared||0} meals shared by kin and friends · ${D.rations||0} rations from the common store · ${D.donated||0} meals of spare perishables given away before they spoiled<br><span class="muted">Since the start: ${DT.shared||0} meals shared · ${DT.rations||0} rations · ${DT.donated||0} donated. Daily ration allowance ${C.rationCap}.</span></div></div>
    <div class="card"><b>Animals</b> <span class="muted" style="font-size:12px">${C.animals.length} kept ${sp('animals')}</span><div>${anim}</div>
      ${E?`<div style="font-size:12px;margin-top:4px">Wild game ${civBar(E.game, E.gcap||1, '#c8a060')} ${E.game} of ~${E.gcap} ${sp('game')} · small game ~${E.small}<br>Fish ${civBar(E.fish, E.fishcap||1, '#5a9ad8')} ${pct(E.fish,E.fishcap)}% of the river's stock · Wild plants ${civBar(E.forage, E.fcap||1, '#6ab04a')} ${pct(E.forage,E.fcap)}%</div>`:''}</div>
    <div class="card"><b>Land</b><div style="font-size:12px">Trees standing: <b>${R.trees.toLocaleString()}</b> ${sp('trees')} · felled so far: ${C.stats.trees_felled||0}</div></div>
    <div class="card"><b>Building materials</b> ${sp('wood')}${table(byCat('material'), 'Material')}</div>
    <div class="card"><b>Ores & minerals</b>${table(byCat('ore'), 'Ore')}
      <div style="font-size:12px;margin-top:4px">${R.deps.length ? R.deps.map(d=>`<div>⛏️ <a ${locAttr(d.x,d.y,1,1,MIN[d.min].label)}>${esc(MIN[d.min].label)}</a> <span class="muted">· ${Math.round(d.left)} units left${d.size?` of ${Math.round(d.size)}`:''}${d.mine?' · being mined':''}</span></div>`).join('') : '<span class="muted">No deposits found yet.</span>'}
      ${R.mined ? `<div class="muted">Dug out so far: ${n(R.mined)} units</div>` : ''}</div></div>
    <div class="card"><b>Energy</b>${table(byCat('energy'), 'Fuel')}</div>
    <div class="card"><b>Made goods</b>${table(byCat('crafted').concat(byCat('token')), 'Goods')}</div>
    <div class="card"><b>Water</b> <span style="font-size:12px">${n(t.water||0)} jars stored in homes</span></div>`;
  wireLocate($('p-res'));
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
    <div class="card"><b>Migration</b> · arrived ${C.migration.in} · left ${C.migration.out}${A?`<br><span class="muted" style="font-size:12px">How it looks from outside: food ${A.food.toFixed(2)}, homeless ${Math.round(A.homeless*100)}%, open jobs ${A.jobs}, wages ${A.wage.toFixed(1)}, crime ${A.crime.toFixed(2)}, schools ${A.school}, healers ${A.health}, taxes ${A.tax}, opportunity ${A.opp.toFixed(1)}${A.famine?`, famine ${A.famine.toFixed(1)}`:''} → ${A.score.toFixed(2)}</span>`:''}</div>
    <div class="card"><b>Relationships</b> · ${S.relStats.marriages} marriages · ${S.relStats.divorces} separations · ${S.relStats.adoptions} children taken in</div>`;
}
// ---------- justice ----------
function civRenderJustice(){
  const J = S.civ.justice, G = S.civ.gov, d = civDay(), nm = id => { const c = cById(id); return c ? esc(c.name) : '?'; };
  const off = Object.entries(G.offices).filter(([k,id])=>/constable|watch|investigator|magistrate|prosecutor/.test(k) && alive(id)).map(([k,id])=>`<span class="chip">${esc(k.replace(/_r_.*/,'').replace(/_\d+$/,'').replace('_',' ').replace(/\b\w/g,m=>m.toUpperCase()))}${k.includes('_r_')?` (${esc((Object.values(S.world?S.world.cells:{}).find(c=>'constable_'+c.id===k)||{}).name||'district')})`:''}: ${nm(id)}</span>`).join('');
  const lawyers = J.stage>=8 ? S.citizens.filter(c=>kn(c,'law')>=40 && !c.office).slice(0,6).map(c=>`<span class="chip">Advocate: ${esc(c.name)}</span>`).join('') : '';
  const jailed = S.citizens.filter(c=>c.jail).map(c=>`<div style="font-size:12px">🔒 ${esc(c.name)} <span class="muted">· released day ${c.jail+1}</span></div>`).join('');
  const hasJail = civHas(['jail','prison']).length;
  const truth = !!ui.truth;
  const stTxt = s => ({saw:'saw', near:'saw them nearby', alibi:'alibi', self:'victim', hall:'heard'}[s]||s);
  const caseCard = k => {
    const crim = k.kind==='criminal', named = k.defendant && k.defendant.k==='person' ? k.defendant.id : k.named;
    const sts = (k.statements||[]).slice(0,10).map(s=>`<div style="font-size:12px">${s.clears?'🛡️':'👁'} ${s.by?nm(s.by):'?'} — ${s.clears?`says ${nm(s.acc)} was elsewhere`:s.src==='near'?`saw ${nm(s.acc)} nearby`:`${stTxt(s.src)} ${nm(s.acc)}`} <span class="muted">(${Math.round(s.conf*100)}% sure${s.broken?' · fell apart':''}${truth && s.lie?' · a lie':''}${truth && !s.clears && k.actual && s.acc!==k.actual?' · wrong':''})</span></div>`).join('');
    const ev = (k.proof||[]).map(p=>`<div style="font-size:12px">🧾 ${esc(p.text)}</div>`).join('') || (k.evidence||[]).filter(e=>typeof e==='string').map(e=>`<div style="font-size:12px">🧾 ${esc(e)}</div>`).join('');
    const sc = crim && k.actual ? Object.entries(civCaseScores(k)).filter(([id,v])=>v>=0.15).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([id,v])=>`<span class="chip">${nm(id)} ${Math.round(v*100)}%</span>`).join('') : '';
    const J2 = k.judgment, phase = k.status==='open' ? (k.phase || 'open') : k.status;
    return `<div class="card" style="font-size:12px"><div class="row" style="justify-content:space-between"><b>${crim?'Criminal':'Civil'}: ${esc(k.type)}</b><span class="chip">${esc(phase)}</span></div>
      <div>${esc(k.claim)} · ${crim ? `victim ${esc(civCaseParty(k.plaintiff))}` : `${esc(civCaseParty(k.plaintiff))} v. ${esc(civCaseParty(k.defendant))}`} · day ${k.day+1}${k.damages?` · ${k.damages} sought`:''}</div>
      ${crim && named ? `<div>Accused: <b>${nm(named)}</b>${k.inv?` · investigated by ${nm(k.inv)}`:''}</div>` : k.inv ? `<div>Investigated by ${nm(k.inv)}</div>` : ''}
      ${sc?`<div>Suspects: ${sc}</div>`:''}${sts}${ev}
      ${k.recused?`<div class="muted">⚖️ ${nm(k.recused)} stepped aside</div>`:''}${k.biasNoted?`<div class="No">⚠️ judged despite a conflict of interest</div>`:''}
      ${k.lawyers&&(k.lawyers.p||k.lawyers.d)?`<div class="muted">Advocates: ${k.lawyers.p?nm(k.lawyers.p):'—'} for ${crim?'the settlement':'the claim'}, ${k.lawyers.d?nm(k.lawyers.d):'none'} for the defence</div>`:''}
      ${k.settlement?`<div>🤝 Settled${k.settlement.by?` by ${nm(k.settlement.by)}`:''}${k.settlement.amount?`: ${k.settlement.amount} paid`:''}</div>`:''}
      ${J2?`<div><b class="${J2.found?'No':'Yes'}">${J2.rough?'Punished by '+nm(J2.by)+' without a hearing':J2.found?(crim?'Convicted':'Claim upheld'):(crim?'Acquitted':'Claim dismissed')}</b>${J2.by&&!J2.rough?` · ${nm(J2.by)}`:''}${J2.sentence?` · ${esc(J2.sentence)}`:''}${J2.strength!=null?` · case strength ${Math.round(J2.strength*100)}%`:''}</div>`:''}
      ${truth && k.actual?`<div class="muted">👁‍🗨 Truth: ${nm(k.actual)} did it${k.wrong?' — <b class="No">the verdict was wrong</b>':''}${k.bribe?` · bribe from ${nm(k.bribe.from)} to ${nm(k.bribe.to)}${k.bribe.hidden?' (still secret)':''}`:''}</div>`:''}</div>`; };
  const open = J.cases.filter(k=>k.status==='open').slice().reverse(), closed = J.cases.filter(k=>k.status!=='open').slice(-25).reverse();
  const f = ui.jfilter || 'open';
  $('p-justice').innerHTML = `<h2>Justice</h2>
    <div class="card"><b>${esc(JUSTICE_STAGES[J.stage])}</b><div style="margin-top:4px">${civStageLine(JUSTICE_STAGES, J.stageHist)}</div>
      <div style="margin-top:6px">${off || '<span class="muted">No one keeps order yet: quarrels are settled by family or a respected neighbour.</span>'}${lawyers}</div></div>
    <div class="card"><b>Jail</b> ${hasJail ? (jailed || '<span class="muted">empty</span>') : `<span class="muted">${J.stage>=5?'Not built yet: the settlement builds one when the same people keep offending.':'None: there is no one to sentence anybody yet.'}</span>`}</div>
    <div class="row" style="margin:6px 0"><button class="btn ${f==='open'?'on':''}" data-jf="open">Open cases (${open.length})</button><button class="btn ${f==='closed'?'on':''}" data-jf="closed">Closed</button>
      <label class="muted" style="font-size:12px;margin-left:auto" title="Show what really happened — nobody in the settlement can see this"><input type="checkbox" id="jTruth" ${truth?'checked':''}> reveal the truth</label></div>
    ${(f==='open' ? open : closed).slice(0,25).map(caseCard).join('') || '<p class="muted">Nothing here.</p>'}`;
  $('p-justice').querySelectorAll('[data-jf]').forEach(b=>b.onclick=()=>{ ui.jfilter = b.dataset.jf; civRenderJustice(); });
  const t = $('jTruth'); if (t) t.onchange = ()=>{ ui.truth = t.checked; civRenderJustice(); };
}
// ---------- a person's mind: memories, beliefs, opinions, trust, reputation, legal history ----------
function civOpinionLine(t, v){ const w = Math.abs(v) >= 60 ? 'Strongly' : Math.abs(v) >= 30 ? 'Generally' : 'Somewhat', lbl = topicLabel(t);
  const inst = ['constables','courts','council','justice'].includes(t) || t.startsWith('press:');
  return `${w} ${v>0 ? (inst ? 'trusts' : 'supports') : (inst ? 'distrusts' : 'opposes')} ${lbl}.`; }
function civMindHtml(c){
  if (!isAdult(c) && c.age < 12) return '';
  const m = cogOf(c), dist = civDistrictOf(c), raw = !!ui.rawMind;
  const mems = m.mems.slice().sort((a,b)=>b.imp*b.str-a.imp*a.str).slice(0,7).map(x=>`<div class="vote"><span class="muted">${SRC_ICON[x.src]||''} ${esc(fmtStamp(x.t))}${x.imp>=8?' · ★':''}${x.str<0.5?' · fading':''}${(x.src==='told'||x.src==='rumor')&&x.from?` · from ${esc((cById(x.from)||{name:'someone'}).name)}`:x.src==='paper'&&x.from?` · ${esc(S.papers[x.from]||'a paper')}`:''}</span><br>${esc(x.text)}</div>`).join('') || '<p class="muted">Nothing that stands out yet.</p>';
  const bel = m.bel.slice().sort((a,b)=>b.str-a.str).map(b=>`<div class="vote">💡 ${esc(beliefText(b.topic, b.pos))} <span class="muted">(${b.str>0.7?'firmly':b.str>0.4?'fairly sure':'starting to think so'})</span></div>`).join('');
  const ops = Object.entries(m.op).filter(([k,v])=>Math.abs(v)>=15 && !k.startsWith('p:') && topicLabel(k)).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,6)
    .map(([k,v])=>`<div style="font-size:12px">${esc(civOpinionLine(k, v))}${raw?` <span class="muted">(${v>0?'+':''}${v})</span>`:''}</div>`).join('');
  const trustN = {council:'the leaders', constables:'the constables', courts:'the courts', rumor:'gossip'};
  const tr = Object.entries(m.tr).map(([k,v])=>`<span class="chip" title="${Math.round(v*100)}%">${esc(k.startsWith('press:') ? (S.papers[k.slice(6)]||'a newspaper') : trustN[k]||k)} ${v<0.35?'✗':v<0.6?'~':'✓'}${raw?` ${Math.round(v*100)}%`:''}</span>`).join('');
  const kn0 = Object.entries(m.kn).filter(([id,k])=>k.who && alive(k.who) && k.conf>=0.35).sort((a,b)=>b[1].conf-a[1].conf).slice(0,4).map(([id,k])=>`<div class="vote">🔎 Thinks <b>${esc(cById(k.who).name)}</b> was behind the ${esc(k.kind||'crime')} <span class="muted">(${Math.round(k.conf*100)}% sure · ${SRC_ICON[k.src]||''} ${esc(k.src)})</span></div>`).join('');
  const believers = S.citizens.filter(o=>o!==c && Object.values(cogOf(o).kn).some(k=>k.who===c.id && k.conf>=0.4)).length;
  const rep = m.rep||0, repTxt = rep>30 ? 'well respected' : rep>10 ? 'liked' : rep<-30 ? 'distrusted' : rep<-10 ? 'talked about' : 'unremarkable';
  const legal = (c.civ.legal||[]).slice().reverse().map(e=>`<div class="vote">${['guilty','fined','rough'].includes(e.v)?'⚖️':'✔️'} Day ${e.day+1}: ${esc(e.type)} — <b class="${['guilty','fined','rough'].includes(e.v)?'No':'Yes'}">${esc({guilty:'convicted',fined:'fined on the spot',rough:'punished without a hearing',acquitted:'acquitted',cleared:'cleared',dismissed:'case dismissed',noted:'noted'}[e.v]||e.v)}</b>${e.s?` · ${esc(e.s)}`:''}</div>`).join('');
  const pl = civPlatform(c).map(([t,dir])=>`${dir>0?'':'against '}${topicLabel(t)}`).join(' and ');
  return `<details open><summary>Mind: memories, beliefs, opinions, trust</summary>
    ${dist?`<p style="font-size:13px;margin:2px 0">🏘️ Lives in <b>${esc(dist)}</b></p>`:''}${c.away?`<p style="font-size:13px;margin:2px 0">🧭 On an expedition to the ${esc(DIRS[c.away.dir].label.toLowerCase())}, due back day ${c.away.until+1}.</p>`:''}
    <b style="display:block;margin-top:6px">Important memories</b>${mems}
    ${bel?`<b style="display:block;margin-top:6px">Beliefs</b>${bel}`:''}
    ${ops?`<b style="display:block;margin-top:6px">Opinions</b>${ops}`:''}${pl?`<p style="font-size:12px;margin:4px 0">📣 Would stand for ${esc(pl)}.</p>`:''}
    <b style="display:block;margin-top:6px">Trust</b><div>${tr}</div>
    ${kn0?`<b style="display:block;margin-top:6px">Suspicions</b>${kn0}`:''}
    <b style="display:block;margin-top:6px">Reputation</b><p style="margin:2px 0;font-size:13px">${repTxt}${raw?` (${rep>0?'+':''}${Math.round(rep)})`:''}${believers?` · ${believers} ${believers>1?'people believe':'person believes'} they broke the law`:''}${c.jail?` · <b class="No">in jail until day ${c.jail+1}</b>`:''}${c.civ.service>civDay()?` · doing community service`:''}</p>
    ${legal?`<b style="display:block;margin-top:6px">Legal history</b>${legal}<p class="muted" style="font-size:12px;margin:2px 0">Record weight ${civLegalScore(c).toFixed(2)} (serious and recent offences weigh most)</p>`:''}
    <label class="muted" style="font-size:11px"><input type="checkbox" class="rawMind" ${raw?'checked':''}> show the numbers</label></details>`;
}
// ---------- housing: who has no roof, and what the settlement holds for them ----------
function civHousingHtml(){
  const C = S.civ, hl = civHomelessHH(), d = civDay();
  const town = Object.values(C.structs).filter(s=>STRUCTURES[s.def].home && (s.owner.k==='community' || s.owner.k==='gov'));
  const living = s => S.citizens.filter(c=>c.home===s.id).length;
  return `<div class="card"><b>Housing</b> <span class="muted" style="font-size:12px">${Object.keys(C.hh).length} households · ${hl.length} without a roof · ${C.stats.taken_in||0} taken in by others · ${C.stats.sheltered||0} sheltered by the settlement · ${C.stats.reclaimed||0} properties returned to the settlement</span>
    ${hl.length ? `<div style="font-size:12px;margin-top:4px">${hl.slice(0,12).map(h=>`<div>🏕️ ${esc(h.name)} household (${h.members.length}${hhMembers(h).some(m=>!isAdult(m))?', with children':''}) · ${h.homelessSince!=null?`${d-h.homelessSince} days`:'just now'}${civProjects().some(p=>p.forHH===h.id)?' · building':''}</div>`).join('')}</div>` : '<div class="muted" style="font-size:12px">Everyone has a roof.</div>'}
    ${town.length ? `<div style="font-size:12px;margin-top:4px"><b>Town-owned homes</b>${town.map(s=>`<div>🏠 <a ${locAttr(s.x,s.y,s.w,s.h,s.name)}>${esc(s.name)}</a> <span class="muted">· ${living(s)}/${STRUCTURES[s.def].home.cap} living there${s.shelter?' rent-free':''}${s.reclaimed!=null?` · returned day ${s.reclaimed+1}`:''}</span></div>`).join('')}</div>` : ''}
    ${C.landShort!=null && d - C.landShort < 28 ? '<div class="No" style="font-size:12px;margin-top:4px">There is no land left to build on here: the settlement needs to annex more.</div>' : ''}</div>`;
}
// ---------- the frontier: explore, map, annex ----------
function civFrontierHtml(){
  const W = S.world; if (!W) return '';
  const exps = W.exp.filter(e=>e.status==='out').map(e=>`<div style="font-size:12px">🧭 ${esc(DIRS[e.dir].label)}: ${e.members.map(id=>esc((cById(id)||{name:'?'}).name)).join(', ')} · back around day ${e.back+1}</div>`).join('');
  const dirBtn = dir => { const chk = civExpCheck(dir, {k:'player'}); if (chk.err) return `<div class="card" style="font-size:12px;margin:0"><b>${DIRS[dir].label}</b><br><span class="muted">${esc(chk.err)}</span></div>`;
    const P = chk.plan; return `<div class="card" style="font-size:12px;margin:0"><b>${DIRS[dir].label}</b> <span class="muted">· ring ${P.ring}</span><br>${P.days} days · ${P.food} food (${chk.sup.food} spare) · ${P.tools} tools (${chk.sup.tools})${P.coin?` · ${P.coin} coin`:''}<br>risk ${Math.round(P.risk*100)}% · crew ${chk.crew.map(c=>esc(c.name.split(' ')[0])).join(', ')||'none'}
      <div style="margin-top:4px"><button class="btn ${chk.ok?'primary':''}" data-explore="${dir}" ${chk.ok?'':'disabled'} title="${esc(chk.miss.join('; ')||'Send the expedition')}">Explore ${DIRS[dir].label.toLowerCase()}</button></div>${chk.ok?'':`<div class="No" style="margin-top:3px">Needs ${esc(chk.miss.join(', '))}</div>`}</div>`; };
  const bar = (v, col) => civBar(v*100, 100, col);
  const regs = Object.values(W.cells).sort((a,b)=>a.n-b.n).map(c=>{ const A = c.attrs, [x0,y0,x1,y1] = cellRect(c.cx, c.cy), votes = W.votes.filter(v=>v.cell===c.key);
    return `<div class="card" style="font-size:12px"><div class="row" style="justify-content:space-between"><b><a ${locAttr(x0,y0,x1-x0+1,y1-y0+1,c.name)}>${esc(c.name)}</a></b><span class="chip">${esc(c.state)}</span></div>
      <div class="muted">${esc(BIOMES[c.biome].label)} to the ${esc((DIRS[c.dir]||{label:'?'}).label.toLowerCase())} · found day ${c.found+1} · room for ~${c.sites} homes${CIV_CLAIMED.includes(c.state)?` · ${c.homes||0} built, ${c.people||0} living there · upkeep ${c.upkeep||civAnnexUpkeep(c)}/day${c.neglect?' · <b class="No">neglected</b>':''}`:''}</div>
      <div style="display:grid;grid-template-columns:52px 76px 52px 76px;gap:2px 6px;margin-top:4px;align-items:center">${[['Fertile',A.fert,'#6ab04a'],['Timber',A.timber,'#8a6a3a'],['Fish',A.fish,'#5a9ad8'],['Ore',A.ore,'#9a9aa8'],['Danger',A.danger,'#e06c5a'],['Beauty',A.beauty,'#d8a8e8']].map(([l,v,c])=>`<span>${l}</span><span>${bar(v,c)}</span>`).join('')}</div>
      ${votes.length?`<div class="muted" style="margin-top:3px">Votes: ${votes.map(v=>`day ${v.day+1} ${v.passed?'✅':'❌'} ${v.yes}–${v.no}`).join(' · ')}</div>`:''}
      ${c.state==='annexable' ? (W.proposal && W.proposal.cell===c.key ? `<div style="margin-top:4px">📜 Proposed: "${esc(W.proposal.why)}" — to be voted on at the next gathering${S.civ.gov.stage<1?' (once the settlement starts meeting)':''}.</div>` : `<div style="margin-top:4px"><button class="btn" data-annex="${c.key}" ${W.proposal?'disabled':''}>Propose annexation${civAnnexCost(c)?` (${civAnnexCost(c)} from the treasury)`:''}</button></div>`) : c.state==='discovered' ? '<div class="muted" style="margin-top:3px">Too far out to claim until the land between is annexed.</div>' : ''}</div>`; }).join('');
  const N = S.civ.frontierNeed;
  return `<h2>Frontier</h2>
    <p class="muted" style="font-size:12px;margin:2px 0 6px">Beyond the valley is unmapped. An expedition takes food, tools and people away for days; what it finds is not ours until the settlement votes to annex it.${N?` Pressure: ${N.homeless} households without a home · forage ${Math.round(N.forage*100)}% · game ${Math.round(N.game*100)}% · fish ${Math.round(N.fish*100)}%.`:''}</p>
    ${exps?`<div class="card"><b>Expeditions out</b>${exps}</div>`:''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">${['N','S','E','W'].map(dirBtn).join('')}</div>
    ${regs || '<p class="muted">No regions mapped yet.</p>'}`;
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
  if (t==='res' && (force || !$('p-res').matches(':hover'))) civRenderResources();
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
