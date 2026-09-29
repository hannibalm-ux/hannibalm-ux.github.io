/* =====================================================================
   Pixel Town — civilization mode: building and land
   Every structure is built by someone who wanted it: households raise homes and clear fields,
   the community raises granaries, wells and bridges, companies raise mines and mills.
   Anything can be upgraded, converted, sold, abandoned, demolished and rebuilt.
   ===================================================================== */

// ---------- projects ----------
function civProjects(){ return Object.values(S.civ.projects); }
function civProjectsFor(c){ const h = hhOf(c); return civProjects().filter(p=>(p.owner.k==='hh' && h && p.owner.id===h.id) || (p.owner.k==='person' && p.owner.id===c.id) || (p.owner.k==='org' && c.civ.employer===p.owner.id)); }
function civCommunityProjects(){ return civProjects().filter(p=>p.owner.k==='community' || p.owner.k==='gov'); }
// can these builders manage it? knowledge and technique matter; money cannot buy what nobody knows
function civCanBuild(def, builders){
  const D = STRUCTURES[def]; if (!D) return false;
  if (D.tech && !civTechKnown(D.tech)) return false;
  if (D.know) return Object.entries(D.know).every(([k,v])=>builders.some(b=>kn(b,k)>=v) || S.citizens.some(o=>kn(o,k)>=v+10 && o.civ.occ==='builder'));
  return true;
}
function civStartProject(def, site, owner, opts){
  opts = opts || {}; const C = S.civ, D = STRUCTURES[def];
  const id = 'pj_'+(++C.pSeq);
  const need = Object.assign({}, D.mat); let labor = D.labor;
  // clearing trees on the site is part of the job
  if (!D.tile || D.tile==='FIELD' || D.tile==='PASTURE'){ let trees = 0; for (let y=site.y;y<site.y+site.h;y++) for (let x=site.x;x<site.x+site.w;x++) if (tileAt(x,y)===T.TREE) trees++; labor += trees*1.5; opts.trees = trees; }
  const p = {id, def, x:site.x, y:site.y, w:site.w, h:site.h, tiles:site.tiles||null, owner, purpose:opts.purpose||D.cat, upgradeOf:opts.upgradeOf||null, need, have:{}, labor:Math.round(labor), done:0,
    started:civDay(), workers:{}, pay:opts.pay||0, fund:opts.fund||0, name: opts.name || `${D.label} for ${civOwnerLabel(owner)}`, forHH: opts.forHH||null, meta: opts.meta||{}, org:opts.org||null};
  C.projects[id] = p; civReserve(p, true);
  if (!opts.quiet) chronicle(`${civOwnerLabel(owner)[0].toUpperCase()+civOwnerLabel(owner).slice(1)} began work on ${an(D.label.toLowerCase())}${opts.why?` (${opts.why})`:''}.`, D.cat==='bridge'||D.cat==='civic'||D.cat==='education'||D.cat==='storage' ? 6 : 4, '🏗️', 'land');
  if (!opts.quiet) S.week.builds.push(`${D.label} started (${civOwnerLabel(owner)})`); ev('projects');
  return p;
}
function civProjectMatFrac(p){ let need=0, have=0; for (const g in p.need){ need += p.need[g]; have += Math.min(p.need[g], p.have[g]||0); } return need ? have/need : 1; }
function civDeliver(p, st){ let moved = 0; for (const g in p.need){ const miss = p.need[g] - (p.have[g]||0); if (miss<=0) continue; const t = storeTake(st, g, miss); if (t>0){ p.have[g] = (p.have[g]||0) + t; moved += t; } } return moved; }
CIV_TARGETS.build = c => {
  const p = civBuildChoice(c); if (!p) return null;
  const D = STRUCTURES[p.def], xy = civSiteSpot(p);
  return {loc:'wild', xy, note:`Building: ${p.name}`, extra:{proj:p.id}};
};
function civSiteSpot(p){ const cands = []; for (let x=p.x-1;x<=p.x+p.w;x++){ cands.push([x,p.y+p.h],[x,p.y-1]); } for (let y=p.y;y<p.y+p.h;y++){ cands.push([p.x-1,y],[p.x+p.w,y]); } if (p.tiles) p.tiles.forEach(([x,y])=>cands.push([x-1,y],[x+1,y],[x,y-1],[x,y+1])); const ok = cands.filter(([x,y])=>walkable(x,y)); return ok.length ? ok[hash(p.id+civDay())%ok.length] : [p.x, p.y+p.h]; }
function civBuildChoice(c){
  const ct = civContractorProject(c); if (ct) return ct;
  const own = civProjectsFor(c).filter(p=>!p.contractor || p.contractor===c.civ.employer); if (own.length) return own.sort((a,b)=>civProjectMatFrac(b)-civProjectMatFrac(a))[0];
  const bee = civNeedyHomeProjects().filter(p=>civWillHelp(c, p) > 5).sort((a,b)=>civWillHelp(c,b)-civWillHelp(c,a))[0]; if (bee) return bee;
  const com = civCommunityProjects().filter(p=>civProjectMatFrac(p)>0.05 || p.labor-p.done < 20); return com.sort((a,b)=>civProjectMatFrac(b)-civProjectMatFrac(a))[0] || civCommunityProjects()[0] || null;
}
CIV_TASK_VALUE.build = (c, h, hrs) => {
  const own = civProjectsFor(c); const com = civCommunityProjects();
  let v = 0;
  if (own.length){ const p = own[0], mf = civProjectMatFrac(p); v = 7 + (p.purpose==='home' && !S.civ.structs[c.home] ? 16 : 0) + (mf>0.3 ? 5 : -4) + (mf>=0.99 ? 6 : 0) + (p.pay ? p.pay*hrs*civMoneyVal(c) : 0); } // with everything to hand, finish it
  else if (civNeedyHomeProjects().some(p=>civWillHelp(c, p) > 5)){ const p = civNeedyHomeProjects().sort((a,b)=>civWillHelp(c,b)-civWillHelp(c,a))[0]; v = civWillHelp(c, p) + 4; } // a building bee for a family with no roof
  else if (com.length){ const p = com[0], civic = c.personality.agreeableness*6 + (c.values.includes('Community')?5:0) + (civHasGoal(c,'community')?4:0) + (civHasGoal(c,'respect')?2:0); v = civic*(civProjectMatFrac(p)>0.2 ? 1 : 0.4) + (p.pay ? p.pay*hrs*civMoneyVal(c) : 0); }
  // food first: a household running low feeds itself before it builds (and never goes to help others)
  if (!civBuildSeasonOK() && !(own.length && own[0].purpose==='home' && !S.civ.structs[c.home])) v *= 0.5;
  const fd = h ? hhFoodDays(h) : 3; if (fd < 2 && !(own.length && own[0].purpose==='home' && !S.civ.structs[c.home] && fd >= 1)) v *= fd < 1 ? 0.15 : 0.45;
  return v * (0.6 + sk(c,'construction')/150);
};
CIV_WORK.build = (c, b, hrs) => {
  const p = S.civ.projects[b.proj] || civBuildChoice(c); if (!p) return {value:0, why:'no building work'};
  // materials come from the owner's stores, and from the builder's own household if it is their project
  const st = civOwnerStore(p.owner); if (st) civDeliver(p, st);
  if (p.owner.k==='community'){ const h = hhOf(c); if (h && c.personality.agreeableness>0.55) { const moved = civDeliver(p, h.store); if (moved>0) civFavorCommunity(c, moved); } }
  const mf = civProjectMatFrac(p), cap = p.labor * Math.max(0.05, mf) + 2;
  const eff = (b.acc||0)/60 * (0.6 + sk(c,'construction')/100);
  const before = p.done; p.done = Math.min(cap, p.done + eff);
  // clearing trees on the plot as the work goes on
  if (p.done > before){ for (let y=p.y;y<p.y+p.h && y<p.y+p.h;y++) for (let x=p.x;x<p.x+p.w;x++){ if (tileAt(x,y)===T.TREE && rnd()<0.3){ civSetTile(x,y,T.GRASS); if (st) storeAdd(st, 'wood', 4); } } }
  p.workers[c.id] = (p.workers[c.id]||0) + eff; if (p.done > before + 0.01) civProjProgress(p);
  if (p.pay && civMoneyOn()) civPayProjectWage(p, c, hrs);
  if (p.contractor) civContractWork(p, c, hrs);
  if (p.forHH && S.civ.hh[p.forHH] && hhOf(c)!==S.civ.hh[p.forHH] && p.done > before && hash(c.id+p.id)%4===0 && !p.helped){ p.helped = 1; const H = S.civ.hh[p.forHH]; hhAdults(H).forEach(m=>{ adjustRel(m, c, 6); civHear(m, {type:'helped', text:`${c.name} helped build our home.`, who:[c.id], topics:{['p:'+c.id]:0.8}, imp:6, src:'self', emo:0.3}); }); }
  c.civ.buyers.build = c.civ.buyers.build || {}; const payerH = p.owner.k==='hh' ? p.owner.id : p.owner.k; if (payerH!==c.civ.hh) c.civ.buyers.build[(p.owner.id||p.owner.k)+''] = 1;
  if (p.done >= p.labor - 0.01 && mf >= 0.999) civFinishProject(p);
  const why = mf < 0.5 ? 'waiting for materials' : null;
  return {value: (p.done-before)*1.4, why};
};
function civFavorCommunity(c, n){ c.civ.respect += n*0.02; }
function civFinishProject(p){
  const C = S.civ, D = STRUCTURES[p.def];
  delete C.projects[p.id]; civReserve(p, false);
  let s;
  if (p.upgradeOf && C.structs[p.upgradeOf]){ const old = C.structs[p.upgradeOf]; civUnapplyStruct(old); delete C.structs[old.id]; delete C.parcels[old.id];
    s = civAddStruct(p.def, p.x, p.y, p.owner, {w:p.w, h:p.h, name:civStructName(p.def, civOwnerObj(p.owner))});
    Object.values(C.hh).forEach(h=>{ if (h.home===old.id){ h.home = s.id; hhMembers(h).forEach(m=>m.home = s.id); s.occ = h.id; } });
    Object.values(C.orgs).forEach(o=>{ o.sites = (o.sites||[]).map(x=>x===old.id?s.id:x); if (o.hq===old.id) o.hq = s.id; });
    (C.animals||[]).forEach(a=>{ if (a.pen===old.id) a.pen = s.id; });
    if (old.meta) s.meta = Object.assign({}, old.meta, s.meta);
  } else s = civAddStruct(p.def, p.x, p.y, p.owner, {w:p.w, h:p.h, tiles:p.tiles, name: p.meta.name || civStructName(p.def, civOwnerObj(p.owner)), meta: Object.assign({}, p.meta), org:p.org});
  if (p.org && C.orgs[p.org]){ const o = C.orgs[p.org]; o.sites = (o.sites||[]).concat(s.id); if (!o.hq && !D.tile) o.hq = s.id; s.org = o.id; }
  if (D.home && p.forHH && C.hh[p.forHH]){ const h = C.hh[p.forHH]; const was = h.home && C.structs[h.home]; h.home = s.id; s.occ = h.id; hhMembers(h).forEach(m=>m.home = s.id); if (was && was.id!==s.id) civVacated(was, h); }
  if (D.farm) s.meta = Object.assign({crop:D.farm.crop[0], stage:'fallow', growth:0, soil:1, yields:[]}, s.meta);
  if (D.bridge) s.meta.toll = 0;
  indexCitizens(); bumpWorld(); ev('built'); if (D.cat==='bridge') ev('bridges_built'); if (D.farm) ev('fields_built'); if (D.ranch) ev('pens_built');
  const top = Object.entries(p.workers).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([id])=>alive(id)).filter(Boolean);
  if (!D.light) chronicle(`${s.name} is finished${top.length?`, built by ${top.map(x=>x.name.split(' ')[0]).join(', ')}`:''}.`, D.cat==='bridge'||D.cat==='civic'||D.cat==='education'||D.cat==='storage'||D.cat==='medical' ? 8 : 5, D.cat==='bridge'?'🌉':D.farm?'🌾':D.ranch?'🐐':'🏠', 'land');
  if (!D.light) S.week.builds.push(`${s.name} finished`);
  top.forEach(w=>{ remember(w, `We finished ${s.name}.`, 6); w.civ.respect += 1; });
  S.civ.history.push({t:S.minute, kind:'built', def:p.def, name:s.name, owner:civOwnerLabel(p.owner)});
  if (typeof civOnStructBuilt==='function') civOnStructBuilt(s, p);
  return s;
}
function civPayProjectWage(p, c, hrs){ const pay = Math.round(p.pay*hrs); if (pay<=0) return; const payer = civOwnerPurse(p.owner); if (!payer || civPurse(payer) < pay) return; civMoveMoney(payer, {k:'person', id:c.id}, pay, 'wages'); }
// a vacated home is kept to rent or sell, given to kin, or left to fall down
function civVacated(s, h){
  s.occ = null;
  if (s.shelter){ const other = S.citizens.find(c=>c.home===s.id); if (other){ s.occ = other.civ.hh; return; } } // a shared shelter stays the town's
  const need = Object.values(S.civ.hh).find(x=>!x.home || !S.civ.structs[x.home]);
  if (need && (!civMoneyOn() || peekRelHH(h, need) > 20)){ need.home = s.id; s.occ = need.id; hhMembers(need).forEach(m=>m.home = s.id); chronicle(`${need.name} moved into ${s.name}, left behind by the ${h.name} household.`, 4, '📦', 'land'); indexCitizens(); return; }
  if (civMoneyOn()){ s.forSale = true; s.price = Math.round(s.value*1.05); civLandlordOffer(s); }
}
function peekRelHH(a, b){ let best = -100; hhMembers(a).forEach(x=>hhMembers(b).forEach(y=>{ best = Math.max(best, peekRel(x,y.id).affinity); })); return best; }

// ---------- housing: homes improve only with knowledge, materials and means ----------
function civBestHomeDef(builders, wealth, crowd){
  const opts = HOME_ORDER.filter(d=>{ const D = STRUCTURES[d]; if (!D.home || !civCanBuild(d, builders)) return false; if (d==='longhouse' && crowd<6) return false; if ((d==='mansion'||d==='estate') && wealth < 3000) return false; if ((d==='apartments'||d==='tower'||d==='row_houses'||d==='dormitory'||d==='boarding') ) return false; return true; });
  return opts.length ? opts[opts.length-1] : 'lean_to';
}
function civMatAffordable(def, st, wallet){ const D = STRUCTURES[def]; let short = 0; for (const g in D.mat){ short += Math.max(0, D.mat[g] - (st[g]||0)) * CG[g].v; } return {short, ok: short <= (wallet||0)/Math.max(1, civPrice('wood')/CG.wood.v) + 30}; }
function civHousingGoals(c, h, home){
  if (!h || hhAdults(h)[0]!==c) return; // the household's eldest adult carries these plans
  if (civProjects().some(p=>p.forHH===h.id)) return;
  const builders = hhAdults(h), members = h.members.length, D = home && STRUCTURES[home.def];
  const cap = D && D.home ? D.home.cap : 0, wealth = civHHWealth(h);
  // no roof, or bursting at the seams: build (or, where there is a market for homes, rent or buy)
  if (!home || members > cap+1){
    if (!home && civMoneyOn() && civTryRentOrBuy(h)) return;
    let def = civBestHomeDef(builders, wealth, members);
    if (!civMatAffordable(def, h.store, civHHMoney(h)).ok) def = members > 5 && civCanBuild('longhouse', builders) ? 'longhouse' : 'crude_hut';
    if (!home && civHomelessHH().length >= 4 && !civMatAffordable(def, h.store, civHHMoney(h)).ok) def = 'lean_to'; // in a housing crunch, any roof first
    if (home && civProjects().filter(p=>p.purpose==='home').length > 6) return; // a family with no roof may always start one
    const site = civFindSite(def, home ? [home.x, home.y] : S.civ.center, {margin:1});
    if (site){ civStartProject(def, site, {k:'hh', id:h.id}, {purpose:'home', forHH:h.id, why: !home ? 'they have no roof' : 'too many under one roof'}); civAddGoal(c, 'new_home'); }
    else if (!home){ S.civ.landShort = civDay(); civProblem('land', 2); } // nowhere left to build
    return;
  }
  // upgrade when the household can: needs knowledge, technique, materials or money, and the wish to
  const aspire = (c.values.includes('Prosperity')?0.3:0) + (c.traits.includes('Ambitious')?0.2:0) + (1-civHomeComfort(c)/80)*0.6 + c.personality.conscientiousness*0.2;
  if (aspire < 0.55 || civDay() - home.built < 40) return;
  const ups = (D.up||[]).filter(u=>civCanBuild(u, builders)); if (!ups.length) return;
  const up = ups.sort((a,b)=>HOME_ORDER.indexOf(b)-HOME_ORDER.indexOf(a))[0];
  const aff = civMatAffordable(up, h.store, civHHMoney(h));
  if (civHomelessHH().length && aff.short > 10) return; // while families sleep outside, only upgrades already in hand go ahead
  if (!aff.ok && aff.short > 40) { if (!civHasGoal(c,'improve_home')) civAddGoal(c, 'improve_home', {def:up}); return; }
  const U = STRUCTURES[up];
  const inPlace = civSiteClearExcept(home.x, home.y, U.w, U.h, home);
  const site = inPlace ? {x:home.x, y:home.y, w:U.w, h:U.h} : civFindSite(up, [home.x, home.y], {margin:1});
  if (!site) return;
  civStartProject(up, site, {k:'hh', id:h.id}, {purpose:'home', upgradeOf: inPlace ? home.id : null, forHH:h.id, why:`upgrading from ${D.label.toLowerCase()}`});
  const g = civGoal(c,'improve_home') || civAddGoal(c, 'improve_home', {def:up}); g.data.started = true;
}
function civSiteClearExcept(x,y,w,h, old){
  for (let j=0;j<h+1;j++) for (let i=-1;i<w+1;i++){ const X = x+i, Y = y+j, t = tileAt(X,Y); if (t===-1) return false;
    const inOld = X>=old.x && Y>=old.y && X<old.x+old.w && Y<old.y+old.h; if (inOld) continue;
    const inner = i>=0 && i<w && j<h; if (inner && !(t===T.GRASS||t===T.FLOWER||t===T.SAND||t===T.TREE)) return false; if (!inner && (t===T.BUILD||t===T.FIELD||t===T.PASTURE||t===T.FENCE||t===T.OBJ)) return false; if (S.civ.reserved[tkey(X,Y)]) return false; }
  return true;
}
function civHHWealth(h){ let v = 0; for (const g in h.store) v += (h.store[g]||0)*(CG[g] ? CG[g].v : 0); return v + civHHMoney(h); }
function civHHMoney(h){ return hhMembers(h).reduce((a,m)=>a+Math.max(0,m.wallet),0); }

// ---------- fields and pens ----------
function civLandUseGoals(c, h){
  if (!h || (hhAdults(h)[0]!==c && !(c.civ.occ==='farmer' || c.civ.occ==='herder') && sk(c,'farming')<20 && kn(c,'agriculture')<20)) return;
  const season = seasonOf(civDay());
  const fields = civStructsOf(s=>STRUCTURES[s.def].farm && civOwnedBy(s.owner, c));
  const knowsC = knowsTech(c,'cultivation') || (civTechKnown('cultivation') && kn(c,'agriculture')>=10);
  const pending = civProjects().some(p=>p.owner.k==='hh' && p.owner.id===h.id && STRUCTURES[p.def].farm);
  const maxF = 1 + (h.members.length>2 ? 1 : 0) + (sk(c,'farming')>35 ? 1 : 0) + (h.members.length>4 ? 1 : 0) + ((c.civ.exp.farm||{v:0}).v > 30 ? 1 : 0) + (c.civ.occ==='farmer' ? 1 : 0);
  if (knowsC && !pending && (season<=1 || (season===2 && civDay()%28<8)) && fields.length < maxF){
    const worry = hhFoodDays(h) < 6 || civHasGoal(c,'winter_stores') || sk(c,'farming') > 25 || S.civ.problems.food > 10;
    const seed = (h.store.grain||0) + (storeFood(S.civ.commons) > 0 ? (S.civ.commons.grain||0) : 0);
    // a vegetable plot grows from saved seed and cuttings; a grain field needs seed grain to sow
    const def = (!fields.length && h.members.length<3) || !civCanBuild('field', [c]) || seed < 8 ? 'garden' : 'field';
    if (worry){
      const from = S.civ.structs[c.home] ? [S.civ.structs[c.home].x, S.civ.structs[c.home].y] : S.civ.center, dry = (x,y,w,hh)=>!civNearWater(x,y,w,hh,0);
      const site = civFindSite(def, from, {margin:0, maxR:22, test:dry}) || civFindSite(def, from, {margin:0, maxR:40, test:dry});
      if (site){ civStartProject(def, site, {k:'hh', id:h.id}, {purpose:'farm', why:'to grow food instead of searching for it'}); civAddGoal(c, 'start_field'); }
    }
  }
  const sf = civGoal(c,'start_field'); if (sf && fields.length) civEndGoal(c, sf, 'done', 'Our field is ready for sowing.');
  // animals caught on the hunt need a pen, or they wander off
  const loose = (S.civ.animals||[]).filter(a=>a.owner.k==='hh' && a.owner.id===h.id && !a.pen);
  const pens = civStructsOf(s=>STRUCTURES[s.def].ranch && civOwnedBy(s.owner, c));
  if ((loose.length>=2 || (loose.length && kn(c,'husbandry')>=20)) && !pens.length && !civProjects().some(p=>p.owner.id===h.id && STRUCTURES[p.def].ranch) && civCanBuild('pen', [c])){
    const site = civFindSite('pen', S.civ.structs[c.home] ? [S.civ.structs[c.home].x, S.civ.structs[c.home].y] : S.civ.center, {margin:0, maxR:22});
    if (site){ civStartProject('pen', site, {k:'hh', id:h.id}, {purpose:'ranch', why:`to keep ${loose.length} animal${loose.length>1?'s':''}`}); civAddGoal(c, 'start_herd'); }
  }
  if (pens.length && loose.length) loose.forEach(a=>a.pen = pens[0].id);
}
function civNearWater(x,y,w,h,m){ for (let j=-m;j<h+m;j++) for (let i=-m;i<w+m;i++) if (tileAt(x+i,y+j)===T.WATER) return true; return false; }
function civFieldFor(c){ const f = civStructsOf(s=>STRUCTURES[s.def].farm && s.status==='active' && (civOwnedBy(s.owner, c) || (s.org && c.civ.employer===s.org))); if (f.length) return f.sort((a,b)=>civFieldUrgency(b)-civFieldUrgency(a))[0];
  // the common fields are worked by anyone without a field of their own; the harvest goes to the shared store
  if (!isAdult(c) || c.civ.job) return null; const com = civStructsOf(s=>STRUCTURES[s.def].farm && s.status==='active' && s.owner && (s.owner.k==='community' || s.owner.k==='gov'));
  return com.length ? com.sort((a,b)=>civFieldUrgency(b)-civFieldUrgency(a) || hash(c.id+a.id)%7-hash(c.id+b.id)%7)[0] : null; }
function civFieldUrgency(s){ const m = s.meta; return m.stage==='ripe' ? 3 : m.stage==='fallow' ? 2 : 1; }
CIV_TARGETS.farm = c => { const f = civFieldFor(c); if (!f) return null; const xy = [f.x + hash(c.id)%f.w, f.y + hash(c.id+'y')%f.h]; return {loc:f.id, xy, note:`${f.meta.stage==='ripe'?'Harvesting':f.meta.stage==='fallow'?'Sowing':'Tending'} ${f.name}`, extra:{field:f.id}}; };
CIV_TASK_VALUE.farm = (c, h) => { const f = civFieldFor(c); if (!f) return 0; const m = f.meta, season = seasonOf(civDay());
  if (m.stage==='ripe') return 40; if (m.stage==='fallow') return season<=1 ? 18 : 0; if (m.stage==='growing') return 6 + (m.tend<1?4:0); return 0; };
CIV_WORK.farm = (c, b, hrs) => {
  const f = S.civ.structs[b.field] || civFieldFor(c); if (!f) return {value:0, why:'no field'};
  const m = f.meta, D = STRUCTURES[f.def], season = seasonOf(civDay()), area = f.w*f.h, st = civOwnerStore(f.owner) || (hhOf(c)||{}).store;
  const eff = hrs*(0.5+sk(c,'farming')/100); m.worked = civDay();
  if (m.stage==='fallow'){
    if (season>1 && !D.farm.perennial) return {value:0, why:'too late in the year to sow'};
    m.sowAcc = (m.sowAcc||0) + eff; if (m.sowAcc < area*0.12) return {value:eff*2, why:null};
    const seed = Math.ceil(area*0.5), crop = D.farm.crop.includes('grain') && ((st && st.grain>=seed) || (S.civ.commons.grain||0)>=seed) ? (m.last==='grain' && D.farm.crop.includes('veg') && civTechKnown('crop_rotation') ? 'veg' : 'grain') : D.farm.crop.includes('veg') ? 'veg' : D.farm.crop[0];
    if (crop==='grain'){ const got = st ? storeTake(st, 'grain', seed) : 0; if (got<seed) storeTake(S.civ.commons, 'grain', seed-got); }
    Object.assign(m, {stage:'growing', crop, sown:civDay(), growth:0, tend:0, sowAcc:0}); ev('sowings');
    return {value:eff*3, why:null};
  }
  if (m.stage==='growing'){ m.tend = Math.min(1.5, (m.tend||0) + eff/(area*0.25)); return {value:eff*1.5, why:null}; }
  if (m.stage==='ripe'){
    m.harvAcc = (m.harvAcc||0) + eff; if (m.harvAcc < area*0.1) return {value:eff*2, why:null};
    const tech = (civTechKnown('plough')?1.3:1) * (civTechKnown('irrigation')?1.2:1) * civTheoryMult('farm') * ((S.civ.land||{}).soil||1);
    const units = Math.round(area * (m.crop==='grain' ? 26 : 21) * D.farm.yield * (0.55 + Math.min(1, m.tend||0)*0.45) * (m.soil||1) * tech * (0.8+rnd()*0.4));
    if (st) storeAdd(st, m.crop, units); else storeAdd(S.civ.commons, m.crop, units); ev('pd_farm', units*CG[m.crop].food/90);
    m.soil = civTechKnown('crop_rotation') ? Math.min(1, (m.soil||1) + 0.05) : Math.max(0.55, (m.soil||1) - (m.last===m.crop ? 0.08 : 0.03));
    m.last = m.crop; m.yields = (m.yields||[]).concat(units).slice(-6); Object.assign(m, {stage: D.farm.perennial ? 'growing' : 'fallow', growth:0, tend:0, harvAcc:0, sown:D.farm.perennial?civDay():null});
    chronicle(`${f.name} was harvested: ${units} units of ${CG[m.crop].name.toLowerCase()}.`, units>200?6:4, '🌾', 'farm'); ev('harvests'); ev('harvest_units', units);
    c.civ.buyers.farm = c.civ.buyers.farm || {};
    return {value: units*0.6, why:null, out:{[m.crop]:units}};
  }
  return {value:0};
};
function civFieldsDaily(){
  const season = seasonOf(civDay());
  civStructsOf(s=>STRUCTURES[s.def].farm).forEach(f=>{
    const m = f.meta; if (m.stage!=='growing') return;
    const rate = [0.028, 0.034, 0.02, 0][season] * (S.weather==='Rain' ? 1.2 : S.weather==='Clear' && season===1 ? 0.9 : 1) * (civTechKnown('irrigation') ? 1.15 : 1);
    m.growth = Math.min(1, (m.growth||0) + rate);
    m.tend = Math.max(0, (m.tend||0) - 0.012);
    if (m.growth>=1) m.stage = 'ripe';
    if (season===3 && !STRUCTURES[f.def].farm.perennial){ m.stage = 'fallow'; m.growth = 0; chronicle(`Frost killed the unharvested crop in ${f.name}.`, 4, '❄️', 'farm'); }
  });
  // fields nobody works go wild
  civStructsOf(s=>STRUCTURES[s.def].farm && s.status==='active').forEach(f=>{ const users = civUsers(f).filter(isAdult); if (!users.length && civDay()-f.built > 30 && !(f.meta.worked!=null && civDay()-f.meta.worked < 40)){ f.idle = (f.idle||0)+1; if (f.idle>45){ f.status = 'abandoned'; chronicle(`${f.name} was abandoned and is going back to grass.`, 4, '🌾', 'farm'); } } else f.idle = 0; });
  civStructsOf(s=>(STRUCTURES[s.def].farm||STRUCTURES[s.def].ranch) && s.status==='abandoned').forEach(f=>{ f.cond -= 2; if (f.cond<=0) civRemoveStruct(f, 'abandon'); });
}

// ---------- animals: persistent, with age, sex, health, owner, productivity and offspring ----------
const ANIMAL_KINDS = {
  goat:   {label:'Goat',    prod:{milk:0.8}, meat:14, adult:120, life:3000, pen:true},
  sheep:  {label:'Sheep',   prod:{fiber:0.4, milk:0.3}, meat:16, adult:150, life:3500, pen:true},
  pig:    {label:'Pig',     prod:{}, meat:26, adult:150, life:3000, pen:true, litter:3},
  cow:    {label:'Cow',     prod:{milk:2}, meat:60, adult:300, life:6000, pen:true},
  chicken:{label:'Chicken', prod:{eggs:0.7}, meat:3, adult:40, life:1500, pen:true, litter:4},
  horse:  {label:'Horse',   prod:{}, meat:0, adult:400, life:8000, pen:true, work:true},
  dog:    {label:'Dog',     prod:{}, meat:0, adult:200, life:4000, pet:true},
  cat:    {label:'Cat',     prod:{}, meat:0, adult:150, life:4500, pet:true}
};
function civNewAnimal(kind, owner, opts){ opts = opts||{}; const C = S.civ; const a = {id:'an_'+(++C.aSeq), kind, sex: opts.sex || (rnd()<0.5?'F':'M'), age: opts.age ?? Math.floor(ANIMAL_KINDS[kind].adult*(0.5+rnd())), health: 90+Math.floor(rnd()*10), owner, pen: opts.pen||null, prod:+(0.7+rnd()*0.6).toFixed(2), born: civDay()-(opts.age||0), mother: opts.mother||null, kids:0, name: opts.name||null};
  C.animals.push(a); ev('animals'); return a; }
function civCaptureAnimal(c, kind){ const h = hhOf(c); if (!h) return; const a = civNewAnimal(kind, {k:'hh', id:h.id}); chronicle(`${c.name} brought a live ${ANIMAL_KINDS[kind].label.toLowerCase()} back from the hunt.`, 5, '🐐', 'farm'); remember(c, `I caught a ${ANIMAL_KINDS[kind].label.toLowerCase()} alive.`, 6); return a; }
function civPenFor(c){ return civStructsOf(s=>STRUCTURES[s.def].ranch && s.status==='active' && (civOwnedBy(s.owner, c) || (s.org && c.civ.employer===s.org)))[0] || null; }
CIV_TARGETS.herd = c => { const p = civPenFor(c); if (!p) return null; return {loc:p.id, xy:[p.x+1+hash(c.id)%(p.w-2), p.y+1+hash(c.id+'y')%(p.h-2)], note:`Tending animals at ${p.name}`, extra:{pen:p.id}}; };
CIV_TASK_VALUE.herd = (c) => { const p = civPenFor(c); if (!p) return 0; const n = S.civ.animals.filter(a=>a.pen===p.id).length; return n*2.2; };
CIV_WORK.herd = (c, b, hrs) => {
  const p = S.civ.structs[b.pen] || civPenFor(c); if (!p) return {value:0, why:'no animals'};
  const herd = S.civ.animals.filter(a=>a.pen===p.id), st = civOwnerStore(p.owner) || (hhOf(c)||{}).store; if (!herd.length) return {value:0, why:'the pen is empty'};
  let value = 0; const out = {}, care = hrs*(0.5+sk(c,'herding')/100);
  herd.forEach(a=>{ a.health = Math.min(100, a.health + care*2); a.fed = civDay(); const K = ANIMAL_KINDS[a.kind]; if (a.age < K.adult) return;
    for (const g in K.prod){ if (g==='milk' && a.sex!=='F') continue; const q = K.prod[g]*a.prod*Math.min(1, care/2); out[g] = (out[g]||0)+q; } });
  for (const g in out){ storeAdd(st, g, +out[g].toFixed(1)); value += out[g]*civMargValue(c, g, hhOf(c)); }
  return {value: value + herd.length*0.5, why:null, out};
};
function civAnimalsDaily(){
  const C = S.civ, d = civDay();
  C.animals.slice().forEach(a=>{
    const K = ANIMAL_KINDS[a.kind]; a.age++;
    if (!K.pet && (!a.fed || d-a.fed > 3)) a.health -= a.pen ? 2 : 4;
    if (!a.pen && !K.pet && rnd() < 0.02){ C.animals.splice(C.animals.indexOf(a),1); return; } // wandered off
    if (a.health<=0 || a.age > K.life*(0.8+rnd()*0.4)){ C.animals.splice(C.animals.indexOf(a),1); const st = civOwnerStore(a.owner); if (st && K.meat) storeAdd(st, 'meat', Math.round(K.meat*0.6)); return; }
    // breeding: a fed female, a male in the same pen, and room
    if (a.sex==='F' && a.pen && a.age>=K.adult && d%14===hash(a.id)%14){ const pen = C.structs[a.pen], cap = pen && STRUCTURES[pen.def].ranch ? STRUCTURES[pen.def].ranch.cap : 0, n = C.animals.filter(x=>x.pen===a.pen).length;
      if (n<cap && C.animals.some(x=>x.pen===a.pen && x.kind===a.kind && x.sex==='M' && x.age>=K.adult) && rnd()<0.25*(a.health/100)){
        const litter = 1 + Math.floor(rnd()*(K.litter||1)); for (let i=0;i<litter;i++) civNewAnimal(a.kind, a.owner, {age:0, pen:a.pen, mother:a.id}); a.kids += litter; ev('animal_births', litter); } }
  });
  // crowded pens: the owners slaughter the surplus for meat
  civStructsOf(s=>STRUCTURES[s.def].ranch).forEach(p=>{ const cap = STRUCTURES[p.def].ranch.cap, herd = C.animals.filter(x=>x.pen===p.id); if (herd.length > cap){ const st = civOwnerStore(p.owner); herd.filter(x=>x.sex==='M').slice(0, herd.length-cap).forEach(x=>{ C.animals.splice(C.animals.indexOf(x),1); if (st) storeAdd(st, 'meat', ANIMAL_KINDS[x.kind].meat); }); } });
  // dogs and cats come to live with people once animals are kept
  if (civTechKnown('domestication') && d%30===0){ const hs = Object.values(C.hh).filter(h=>h.home && !C.animals.some(a=>a.owner.id===h.id && ANIMAL_KINDS[a.kind].pet)); const h = hs[Math.floor(rnd()*hs.length)]; if (h && rnd()<0.4) civNewAnimal(rnd()<0.6?'dog':'cat', {k:'hh', id:h.id}, {age:60}); }
}

// ---------- bridges: placed where people keep wanting to cross ----------
function civNoteCrossing(c, tx, ty){ const west = c.rt.x < riverX(clamp(c.rt.y,0,40)), twest = tx < riverX(clamp(ty,0,40)); if (west===twest) return; const y = clamp(Math.round((c.rt.y+ty)/2), 1, 39); S.civ.crossing = S.civ.crossing || {}; S.civ.crossing[y] = (S.civ.crossing[y]||0) + 1; civProblem('infrastructure', 0.3); }
function civCrossBridge(c, x, y){
  const s = civStructAt(x,y); if (!s) return;
  const toll = s.meta && s.meta.toll; if (!toll || !civMoneyOn()) return;
  if (s.owner.k==='person' && s.owner.id===c.id) return;
  if (civOwnedBy(s.owner, c)) return;
  if (c.wallet >= toll && S.minute - (c.civ.tollPaid||0) > 180){ c.civ.tollPaid = S.minute; civMoveMoney({k:'person', id:c.id}, civOwnerPurse(s.owner), toll, 'toll'); s.meta.tollTake = (s.meta.tollTake||0) + toll; ev('tolls', toll); }
}
function civBridgeSite(yWant, def){
  const D = STRUCTURES[def], width = D.bridge.width;
  let best = null, bl = 99;
  for (let dy=0; dy<=8; dy++) for (const sgn of [1,-1]){ const y = yWant + dy*sgn; if (y<1 || y+width>40) continue;
    const rows = []; let okAll = true;
    for (let k=0;k<width;k++){ const yy = y+k, xs = []; for (let x=riverX(yy)-4;x<=riverX(yy)+4;x++) if (tileAt(x,yy)===T.WATER) xs.push(x); if (!xs.length){ okAll=false; break; } const x0 = Math.min(...xs)-1, x1 = Math.max(...xs)+1; if (!walkable(x0,yy) && tileAt(x0,yy)!==T.PATH || !(walkable(x1,yy) || tileAt(x1,yy)===T.TREE)) { if (tileAt(x0,yy)===T.ROCK || tileAt(x1,yy)===T.ROCK){ okAll=false; break; } } if (xs.some(x=>FORDS.has(tkey(x,yy)) || tileAt(x,yy)===T.BRIDGE)) { okAll=false; break; } rows.push([x0,x1,yy]); }
    if (!okAll) continue; const len = rows.reduce((a,r)=>a+r[1]-r[0],0);
    if (len < bl){ bl = len; best = rows; } }
  if (!best) return null;
  const tiles = []; best.forEach(([x0,x1,yy])=>{ for (let x=x0+1;x<x1;x++) tiles.push([x,yy]); });
  const xs = best.map(r=>r[0]), ys = best.map(r=>r[2]);
  return {x:Math.min(...xs)+1, y:Math.min(...ys), w:Math.max(...best.map(r=>r[1]))-Math.min(...xs)-1, h:width, tiles};
}
function civBridgesWeekly(){
  const C = S.civ, cr = C.crossing || {};
  const total = Object.values(cr).reduce((a,b)=>a+b,0);
  const bridges = civStructsOf(s=>STRUCTURES[s.def].bridge);
  // maintenance: the owner repairs, or it decays; an obsolete bridge is replaced and torn down
  bridges.forEach(b=>{ if (b.cond<55){ const st = civOwnerStore(b.owner); const mat = Object.keys(STRUCTURES[b.def].mat)[0]; const got = st ? storeTake(st, mat, 6) : 0; if (got>=6){ b.cond = Math.min(100, b.cond+20); if (hash(b.id+civDay())%3===0) chronicle(`${b.name} was repaired.`, 3, '🔨', 'infrastructure'); } else if (b.cond<25 && !b.warned){ b.warned = 1; chronicle(`${b.name} is rotting and nobody is keeping it up.`, 6, '🌉', 'infrastructure'); civProblem('infrastructure', 2); } } });
  if (civProjects().some(p=>STRUCTURES[p.def].bridge)) { C.crossing = {}; return; }
  const want = total >= 14 && (bridges.length===0 || total > 30*bridges.length);
  const better = bridges.find(b=>b.def==='footbridge' && civCanBuild('timber_bridge', S.citizens.filter(isAdult)) && b.cond<50) || bridges.find(b=>b.def==='timber_bridge' && civCanBuild('stone_bridge', S.citizens.filter(isAdult)) && b.cond<45);
  if (!want && !better){ for (const y in cr) cr[y] = Math.floor(cr[y]*0.6); return; }
  const y = better ? better.y : +Object.entries(cr).sort((a,b)=>b[1]-a[1])[0][0];
  const def = civCanBuild('stone_bridge', S.citizens.filter(isAdult)) ? 'stone_bridge' : civCanBuild('timber_bridge', S.citizens.filter(isAdult)) ? 'timber_bridge' : civCanBuild('footbridge', S.citizens.filter(isAdult)) ? 'footbridge' : null;
  if (!def) return;
  // who builds it: the community if it gathers, an owner who hopes to charge tolls, or a company
  const investor = civMoneyOn() && S.citizens.filter(c=>isAdult(c) && c.wallet > 250 && (c.values.includes('Prosperity') || c.traits.includes('Greedy'))).sort((a,b)=>b.wallet-a.wallet)[0];
  const tollsOk = !C.gov.laws.no_tolls;
  const owner = investor && tollsOk && rnd()<0.5 ? {k:'person', id:investor.id} : C.gov.stage>=4 ? {k:'gov'} : {k:'community'};
  const site = civBridgeSite(clamp(y, 2, 36), def); if (!site) return;
  const p = civStartProject(def, site, owner, {purpose:'bridge', why: better ? `to replace the failing ${better.name}` : `${total} trips this week were blocked by the river`, meta:{replaces: better ? better.id : null}});
  if (owner.k==='person'){ p.meta.toll = 1; alive(owner.id) && remember(alive(owner.id), 'I am paying for a bridge. People will pay to cross it.', 7); }
  C.crossing = {};
}
function civOnStructBuilt(s, p){
  const D = STRUCTURES[s.def];
  if (D.bridge){ if (p.meta.toll) s.meta.toll = p.meta.toll; const old = p.meta.replaces && S.civ.structs[p.meta.replaces]; if (old){ chronicle(`The old ${old.name} was torn down now that ${s.name} stands.`, 6, '🌉', 'infrastructure'); civRemoveStruct(old, 'demolish', true); } }
  if (D.road){ civStructsOf(x=>x.id===s.id); }
  if (typeof civOnStructBuiltEcon==='function') civOnStructBuiltEcon(s, p);
  if (typeof civOnStructBuiltScience==='function') civOnStructBuiltScience(s, p);
  if (typeof civOnStructBuiltTransport==='function') civOnStructBuiltTransport(s, p);
}

// ---------- roads: worn trails become roads when someone pays to improve them ----------
function civRoadsMonthly(){
  const C = S.civ; if (!civTechKnown('road_building')) return;
  const busiest = Object.keys(C.trail).filter(k=>!C.roads[k] && (C.traffic[k]||0) > 25).slice(0, 40);
  if (busiest.length < 10) return;
  const payer = C.gov.stage>=4 && C.gov.treasury > busiest.length*4 ? 'gov' : null;
  if (!payer && C.gov.stage<2) return;
  const lvl = civTechKnown('paving') ? 2 : 1, stone = busiest.length*(lvl+1);
  const got = storeTake(C.commons, 'stone', stone); if (got < stone*0.5) { civProblem('infrastructure', 1); return; }
  busiest.forEach(k=>{ C.roads[k] = lvl; const [x, y] = tdec(k); civSetTile(x,y,T.PATH); });
  if (payer) C.gov.treasury -= busiest.length*2;
  chronicle(`${busiest.length} stretches of the busiest trails were ${lvl===2?'paved':'made into proper roads'}.`, 6, '🛣️', 'infrastructure'); ev('road_tiles', busiest.length);
}

// ---------- property: valuation, sales, rent, subdivision, conversion, demolition ----------
function civLandPrice(x, y){
  const C = S.civ, [cx, cy] = civMarketCenter();
  let p = 2 + Math.max(0, 22 - Math.hypot(x-cx, y-cy))*0.35;
  let water = 99; for (let j=-4;j<=4;j++) for (let i=-4;i<=4;i++) if (tileAt(x+i,y+j)===T.WATER) water = Math.min(water, Math.hypot(i,j)); if (water<5) p += 2;
  let road = 0; for (let j=-2;j<=2;j++) for (let i=-2;i<=2;i++) if (tileAt(x+i,y+j)===T.PATH) road++; p += Math.min(3, road*0.3) + (C.roads[tkey(x,y+1)] ? 1 : 0);
  let jobs = 0, inds = 0, schools = 0, trees = 0;
  Object.values(C.structs).forEach(s=>{ const d = Math.hypot(s.x-x, s.y-y), D = STRUCTURES[s.def]; if (d<12 && s.org) jobs++; if (d<8 && D.cat==='industry') inds++; if (d<14 && D.edu) schools++; });
  for (let j=-5;j<=5;j++) for (let i=-5;i<=5;i++) if (tileAt(x+i,y+j)===T.TREE) trees++;
  const crime = (C.justice.cases||[]).filter(k=>k.kind==='criminal' && k.at && Math.hypot(k.at[0]-x,k.at[1]-y)<10 && civDay()-k.day<90).length;
  const bridge = civStructsOf(s=>STRUCTURES[s.def].bridge).some(s=>Math.hypot(s.x-x,s.y-y)<15) ? 1.5 : 0;
  const demand = Object.values(C.hh).filter(h=>!h.home || !C.structs[h.home]).length*0.25 + (C.migration.pressure||0)*0.5;
  p += jobs*0.8 - inds*1.5 + schools*1.2 + Math.min(2, trees*0.05) - crime*0.8 + bridge + demand;
  if (C.boom && Math.hypot(C.boom.x-x, C.boom.y-y) < 20 && civDay()-C.boom.day < 120) p *= 2.2; // land speculation near a strike
  return Math.max(0.5, p);
}
function civMarketCenter(){ const m = civHas(['market','trading_spot'])[0]; return m ? [m.x+m.w/2, m.y+m.h/2] : S.civ.center; }
function civValue(s){
  const D = STRUCTURES[s.def]; let mat = 0; for (const g in D.mat) mat += D.mat[g]*(CG[g] ? CG[g].v : 1);
  const land = s.w*s.h*civLandPrice(s.x, s.y), build = (mat + D.labor*0.8)*(0.3 + 0.7*s.cond/100);
  let extra = 0; if (D.farm && s.meta && s.meta.yields && s.meta.yields.length) extra = s.meta.yields.reduce((a,b)=>a+b,0)/s.meta.yields.length*0.5;
  if (s.org && S.civ.orgs[s.org]) extra += Math.max(0, S.civ.orgs[s.org].profitAvg||0)*4;
  s.value = Math.round((land + build + extra) * civPriceLevel());
  const pc = S.civ.parcels[s.id]; if (pc) pc.value = s.value;
  return s.value;
}
function civPriceLevel(){ return civMoneyOn() ? (S.civ.econ.level||1) : 1; }
function civPropertyWeekly(){
  const C = S.civ;
  Object.values(C.structs).forEach(civValue);
  if (!civMoneyOn()) return;
  // sales: listed homes and land go to households who need them and can pay; agents take a cut
  const listed = civStructsOf(s=>s.forSale && s.status==='active');
  listed.forEach(s=>{
    const D = STRUCTURES[s.def];
    const buyers = D.home ? Object.values(C.hh).filter(h=>(!h.home || !C.structs[h.home] || civCrowded(h)) && civHHMoney(h) >= s.price) : [];
    const devs = Object.values(C.orgs).filter(o=>o.status==='active' && (o.biz==='builder_co' || o.biz==='realty') && o.cash > s.price*1.2 && civLandPrice(s.x,s.y) > 5);
    const h = buyers.sort((a,b)=>civHHMoney(b)-civHHMoney(a))[0];
    if (h){ const payer = hhAdults(h).sort((a,b)=>b.wallet-a.wallet)[0]; civSellStruct(s, {k:'hh', id:h.id}, payer ? {k:'person', id:payer.id} : null); const was = h.home && C.structs[h.home]; h.home = s.id; s.occ = h.id; hhMembers(h).forEach(m=>m.home = s.id); if (was && was.id!==s.id) civVacated(was, h); indexCitizens(); return; }
    if (devs.length && rnd()<0.3){ civSellStruct(s, {k:'org', id:devs[0].id}, {k:'org', id:devs[0].id}); return; }
    if (civDay() - (s.listed||civDay()) > 28){ s.price = Math.round(s.price*0.9); }
    s.listed = s.listed || civDay();
  });
  // landlords rent spare homes to families without one
  civStructsOf(s=>STRUCTURES[s.def].home && !s.occ && s.status==='active' && !s.forSale).forEach(civLandlordOffer);
}
function civCrowded(h){ const s = h.home && S.civ.structs[h.home]; const D = s && STRUCTURES[s.def]; return !D || !D.home || h.members.length > D.home.cap + 1; }
function civSellStruct(s, to, payer){
  const price = s.price || s.value, from = s.owner, agent = Object.values(S.civ.orgs).find(o=>o.biz==='realty' && o.status==='active');
  if (payer){ const fee = agent ? Math.round(price*0.03) : 0; civMoveMoney(payer, civOwnerPurse(from), price - fee, 'property'); if (agent) civMoveMoney(payer, {k:'org', id:agent.id}, fee, 'fees'); }
  civContract('sale', [from, to], {struct:s.id, price}, 0);
  s.owner = to; s.forSale = false; s.listed = null; const pc = S.civ.parcels[s.id]; if (pc) pc.owner = to;
  chronicle(`${s.name} was sold to ${civOwnerLabel(to)} for ${price}¢${agent?` through ${agent.name}`:''}.`, 5, '🔑', 'land'); S.week.sales.push(`${s.name} → ${civOwnerLabel(to)} (${price}¢)`); ev('property_sales');
}
function civLandlordOffer(s){
  const D = STRUCTURES[s.def]; if (!D.home || s.occ || s.shelter || !civMoneyOn() || S.citizens.some(c=>c.home===s.id)) return;
  const h = Object.values(S.civ.hh).find(x=>(!x.home || !S.civ.structs[x.home]) && civHHMoney(x) >= 10); if (!h) return;
  const rent = Math.max(2, Math.round(s.value*0.006)), k = civContract('rent', [s.owner, {k:'hh', id:h.id}], {struct:s.id, amount:rent, every:7}, 7);
  h.home = s.id; s.occ = h.id; s.rentK = k.id; hhMembers(h).forEach(m=>m.home = s.id); indexCitizens();
  chronicle(`The ${h.name} household rents ${s.name} from ${civOwnerLabel(s.owner)} for ${rent}¢ a week.`, 4, '🏠', 'land'); ev('rentals');
}
// on inheritance a large farm may be split between heirs
function civSubdivide(s, heirs){
  const D = STRUCTURES[s.def]; if (!D.farm || s.w < 6 || heirs.length < 2) return false;
  const w1 = Math.floor(s.w/2), meta = s.meta; civRemoveStruct(s, 'subdivide');
  const a = civAddStruct('field', s.x, s.y, heirs[0], {w:w1, h:s.h, meta:Object.assign({}, meta)}), b = civAddStruct('field', s.x+w1, s.y, heirs[1], {w:s.w-w1, h:s.h, meta:Object.assign({}, meta)});
  chronicle(`${s.name} was divided between heirs into ${a.name} and ${b.name}.`, 5, '🌾', 'land'); ev('subdivisions');
  return true;
}
// a field can become a pen, a pen a field, a home a shop: same land, new use
function civConvert(s, def){
  const D = STRUCTURES[def], old = STRUCTURES[s.def]; if (!D || (!!D.tile)!==(!!old.tile)) return false;
  civUnapplyStruct(s); s.def = def; s.name = civStructName(def, civOwnerObj(s.owner)); if (D.farm) s.meta = {crop:D.farm.crop[0], stage:'fallow', growth:0, soil:1, yields:[]}; civApplyStruct(s); bumpWorld();
  chronicle(`${civOwnerLabel(s.owner)} turned their ${old.label.toLowerCase()} into ${an(D.label.toLowerCase())}.`, 5, '🔁', 'land'); ev('conversions');
  return true;
}
function civProjectsMonthly(){
  civRoadsMonthly();
  // stalled projects with no materials for months are given up
  civStalledMonthly();
  civProjects().forEach(p=>{ if (civDay()-p.started > 90 && civProjectMatFrac(p) < 0.25 && p.done < p.labor*0.2 && !civNeedyHomeProjects().includes(p) && !(p.forHH && civHomelessHH().some(h=>h.id===p.forHH))){ delete S.civ.projects[p.id]; civReserve(p, false); chronicle(`Work on the ${STRUCTURES[p.def].label.toLowerCase()} for ${civOwnerLabel(p.owner)} was abandoned.`, 4, '🚧', 'land'); const st = civOwnerStore(p.owner); if (st) for (const g in p.have) storeAdd(st, g, p.have[g]); } });
}
