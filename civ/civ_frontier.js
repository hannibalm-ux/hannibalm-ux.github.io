/* =====================================================================
   Pixel Town — civilization mode: the frontier
   The settlers know the valley they camped in. Beyond it, in every
   direction, is mist. An expedition (sent by the player, agreed at a
   gathering, or paid for by a restless settler) takes food, tools and
   people away for days and may map a region. A mapped region is not the
   settlement's: it has to border settled land and be agreed to at a
   gathering (by everyone once there are elections), and people argue for
   and against it from what they need and what they value. Annexed land
   opens up building sites, forage, game, fish, timber and hidden ore,
   and costs upkeep; districts that fill up need their own services.
   Uses the town's region grid (cellRect, rollRegion, paintRegion, fog).
   ===================================================================== */
// tile keys are y*4096+x; this decodes them for negative coordinates too (identical to the old decoding for x >= 0)
function tdec(k){ k = +k; const y = Math.floor((k+2048)/4096); return [k - y*4096, y]; }
const CIV_CLAIMED = ['annexed','developing','established'];
function civCellAt(x, y){
  const cx = x < 0 ? Math.floor(x/RG.cw) : x < OW ? HOME_COLS.findIndex((v,i)=>x>=v && x<HOME_COLS[i+1]) : 4 + Math.floor((x-OW)/RG.cw);
  const cy = y < 0 ? Math.floor(y/RG.rh) : y < OH ? HOME_ROWS.findIndex((v,i)=>y>=v && y<HOME_ROWS[i+1]) : 2 + Math.floor((y-OH)/RG.rh);
  return [cx, cy];
}
function civCellClaimed(cx, cy){ if (isHomeCell(cx, cy)) return true; const c = S.world && cellOf(cellKey(cx, cy)); return !!c && CIV_CLAIMED.includes(c.state); }
function civClaimedTile(x, y){ if (x>=0 && y>=0 && x<OW && y<OH) return true; if (!S.world) return false; const [cx, cy] = civCellAt(x, y); return civCellClaimed(cx, cy); }
function civRegionAt(x, y){ if (x>=0 && y>=0 && x<OW && y<OH) return null; if (!S.world) return null; const [cx, cy] = civCellAt(x, y); return cellOf(cellKey(cx, cy)) || null; }
function civAnnexed(){ return S.world ? Object.values(S.world.cells).filter(c=>CIV_CLAIMED.includes(c.state)) : []; }
function civDistrictOf(c){ const s = c && c.home && S.civ.structs[c.home]; const r = s && civRegionAt(s.x, s.y); return r ? r.name : null; }

// ---------- the known world, rebuilt the same way on every load ----------
function civFrontierInit(){
  Object.assign(RG, {cx0:-6, cx1:9, cy0:-6, cy1:7}); // room for many generations of growth
  S.world = S.world || {v:1, civ:true, seed:(hash(String(S.civ.seed)+'frontier')%1e9), cells:{}, exp:[], seq:0, log:[], proposal:null, votes:[]};
  growWorld();
  Object.values(S.world.cells).sort((a,b)=>a.n-b.n).forEach(c=>{ paintRegion(c); if (CIV_CLAIMED.includes(c.state)) civRegionTrail(c, false); });
  civIndexWater();
}
function civIndexWater(){ WATER_TILES = []; for (let y=Y0;y<Y0+MH;y++) for (let x=X0;x<X0+MW;x++) if (MAP[y] && MAP[y][x]===T.WATER) WATER_TILES.push([x,y]); }
// a worn track from the settlement into newly annexed land, so people can walk there
function civRegionTrail(cell, fresh){
  if (!fresh){ (cell.trail||[]).forEach(([x,y])=>{ if (MAP[y] && (MAP[y][x]===T.GRASS || MAP[y][x]===T.FLOWER || MAP[y][x]===T.TREE)) MAP[y][x] = T.PATH; }); return; }
  const [x0,y0,x1,y1] = cellRect(cell.cx, cell.cy), cx = Math.round((x0+x1)/2), cy = Math.round((y0+y1)/2), [hx, hy] = S.civ.center;
  const out = [], steps = Math.max(Math.abs(cx-hx), Math.abs(cy-hy));
  for (let i=0;i<=steps;i++){ const x = Math.round(hx + (cx-hx)*i/steps), y = Math.round(hy + (cy-hy)*i/steps); if (civRegionAt(x,y)!==cell && civRegionAt(x,y)) continue; if (x>=0 && x<OW && y>=0 && y<OH) continue; const t = tileAt(x,y); if (t===T.GRASS || t===T.FLOWER || t===T.TREE){ MAP[y][x] = T.PATH; out.push([x,y]); } }
  cell.trail = out;
}

// ---------- ecology and minerals for new land ----------
function civEcoRegion(cell){
  const [x0,y0,x1,y1] = cellRect(cell.cx, cell.cy), E = S.civ.eco; E.ext = E.ext || {};
  const r = mapRand(hash(cell.id+'eco'));
  for (let by=Math.floor(y0/ECO_CELL); by<=Math.floor(y1/ECO_CELL); by++) for (let bx=Math.floor(x0/ECO_CELL); bx<=Math.floor(x1/ECO_CELL); bx++){
    const key = bx+','+by; if (E.ext[key]) continue;
    let grass=0, tree=0, water=0, flower=0;
    for (let y=by*ECO_CELL; y<(by+1)*ECO_CELL; y++) for (let x=bx*ECO_CELL; x<(bx+1)*ECO_CELL; x++){ if (x>=0 && x<OW && y>=0 && y<OH) continue; const t = tileAt(x,y); if (t===T.GRASS) grass++; else if (t===T.TREE) tree++; else if (t===T.WATER) water++; else if (t===T.FLOWER) flower++; }
    const A = cell.attrs, fcap = Math.round((grass*1.8 + tree*2.3 + flower*3.5)*(0.6+A.fert*0.6)), gcap = Math.round((tree/6 + grass/30)*(0.7+A.danger*0.8)), fishcap = Math.round(water*7*(0.5+A.fish));
    E.ext[key] = {cx:bx, cy:by, fcap, f:fcap, gcap, g:Math.round(gcap*(0.8+r()*0.3)), kind: tree>grass ? (r()<0.4?'boar':'deer') : 'deer', small:Math.round((grass+tree)/12), fishcap, fish:fishcap, region:cell.key};
  }
}
function civDepositsRegion(cell){
  const [x0,y0,x1,y1] = cellRect(cell.cx, cell.cy), r = mapRand(hash(cell.id+'ore')), A = cell.attrs, C = S.civ;
  const kinds = Object.keys(MIN).filter(k=>!MIN[k].fluid), n = Math.round(A.ore*4 + r()*1.5);
  for (let i=0;i<n;i++){ const min = A.ore>0.6 && r()<0.5 ? ['iron','copper','coal','tin'][Math.floor(r()*4)] : kinds[Math.floor(r()*kinds.length)]; if (!MIN[min]) continue;
    const x = Math.round(x0+2+r()*(x1-x0-4)), y = Math.round(y0+2+r()*(y1-y0-4)), size = Math.round((300 + r()*2500)*(0.6+A.ore));
    C.deposits.push({id:'dep_'+(++C.dSeq), min, x, y, size, left:size, purity:+(0.3+r()*0.6).toFixed(2), depth:1+Math.floor(r()*4), known:false, region:cell.key}); }
}
// forage, game and fish in new land live in their own cells
function civEcoExtDaily(){
  const E = S.civ.eco; if (!E || !E.ext) return; const season = seasonOf(civDay()), grow = [0.045,0.05,0.035,0.004][season];
  Object.values(E.ext).forEach(e=>{ e.f = Math.min(e.fcap, e.f + (e.fcap-e.f)*grow + e.fcap*0.002); e.fish = Math.min(e.fishcap, e.fish + (e.fishcap-e.fish)*0.05 + 0.5);
    if (civDay()%7===0 && e.gcap){ e.g = Math.min(e.gcap*1.2, e.g + Math.max(e.g>=2?1:0, Math.round(e.g*0.16*(1-e.g/(e.gcap+1))))); } });
}

// ---------- expeditions ----------
function civExplorerScore(c){ const o = typeof cogOf==='function' ? (cogOf(c).op.expansion||0) : 0; return (c.traits.includes('Reckless')?0.5:0) + (c.traits.includes('Ambitious')?0.3:0) + (c.traits.includes('Cautious')?-0.4:0) + (c.values.includes('Freedom')?0.3:0) + (c.values.includes('Nature')?0.2:0) + kn(c,'wilderness')/60 + sk(c,'hunting')/100 + kn(c,'geography')/60 + o/150 + (hash(c.id+civDay())%100)/400; }
function civCanExplore(c){ return isAdult(c) && c.age>=18 && c.age<=55 && !c.away && !c.jail && !c.office && !c.civ.hurt && (c.civ.health||100) > 60; }
function civExpPlan(dir){
  const cells = frontierCells(dir); if (!cells.length) return null;
  const t = cells[0], n = 3, winter = seasonOf(civDay())===3;
  const days = 3 + t.ring*2 + (hash(S.world.seed+t.cx+','+t.cy)%3) + (winter?2:0) + (S.weather==='Storm'?1:0);
  const risk = clamp(0.08 + t.ring*0.06 + (winter?0.12:0), 0, 0.9);
  return {dir, cx:t.cx, cy:t.cy, ring:t.ring, n, days, food:n*days*3, tools:Math.ceil(n/2), coin: civMoneyOn() ? Math.round((15 + t.ring*12)*(S.civ.econ.level||1)) : 0, risk};
}
// what the settlement can spare: the common store first, then the sponsor's larder
// the common store, the sponsor's larder, and whatever well-stocked households can spare beyond five days
function civExpSupplies(sponsorHH){ const C = S.civ, need = h => hhMembers(h).reduce((a,c)=>a+(isAdult(c)?90:62),0) || 1;
  const pools = [{st:C.commons, cap:Infinity}].concat(sponsorHH ? [{st:sponsorHH.store, cap:Infinity}] : []);
  Object.values(C.hh).forEach(h=>{ if (h===sponsorHH) return; const spare = (storeFood(h.store) - need(h)*5)/30; if (spare >= 3) pools.push({st:h.store, cap:Math.floor(spare), hh:h}); });
  const units = st => CIV_FOODS.reduce((b,g)=>b + (st[g]||0), 0);
  const food = pools.reduce((a,p)=>a + Math.min(p.cap, units(p.st)), 0), tools = pools.reduce((a,p)=>a + (p.st.tools||0) + (p.st.mtools||0), 0);
  return {food:Math.floor(food), tools:Math.floor(tools), pools}; }
function civExpCheck(dir, sponsor){
  if (!S.world) return {err:'The land beyond has not been mapped yet.'};
  if (S.world.exp.some(e=>e.status==='out' && e.dir===dir)) return {err:`An expedition is already out to the ${DIRS[dir].label.toLowerCase()}.`};
  const plan = civExpPlan(dir); if (!plan) return {err:`There is nothing left to find to the ${DIRS[dir].label.toLowerCase()}.`};
  const payerHH = sponsor && (sponsor.k==='person' || sponsor.k==='volunteer') ? hhOf(alive(sponsor.id)) : null, sup = civExpSupplies(payerHH);
  const lead = sponsor && sponsor.k==='volunteer' ? alive(sponsor.id) : null;
  const crew = (lead ? [lead] : []).concat(S.citizens.filter(c=>civCanExplore(c) && c!==lead).sort((a,b)=>civExplorerScore(b)-civExplorerScore(a))).slice(0, plan.n);
  const purse = sponsor && sponsor.k==='person' ? (alive(sponsor.id)||{}).wallet||0 : S.civ.gov.treasury||0;
  const miss = [];
  if (sup.food < plan.food) miss.push(`${plan.food} days of food (only ${sup.food} to spare)`);
  else if (sponsor && sponsor.k==='gathering' && civFoodDaysAll() < 5) miss.push('food to spare: the settlement has less than five days of food');
  if (crew.length < 2) miss.push('at least two fit people who can be spared');
  if (sponsor && sponsor.k==='volunteer') plan.coin = 0; // they pay in food and their own time
  if (plan.coin && purse < plan.coin) miss.push(`${plan.coin} in ${sponsor && sponsor.k==='person' ? 'their purse' : 'the treasury'}`);
  return {plan, crew, sup, miss, ok:!miss.length};
}
function civLaunchExpedition(dir, sponsor, why){
  sponsor = sponsor || {k:'player'};
  const chk = civExpCheck(dir, sponsor); if (chk.err) return chk; if (!chk.ok) return {err:`Not enough for the journey: it needs ${chk.miss.join(', ')}.`};
  const {plan, crew, sup} = chk, d = civDay();
  // take the food (longest-keeping first) and whatever tools there are
  let food = 0; const gave = []; for (const p of sup.pools){ let took = 0; for (const g of CIV_FOODS.slice().sort((a,b)=>(CG[b].perish||999)-(CG[a].perish||999))){ if (food >= plan.food || took >= p.cap) break; const q = storeTake(p.st, g, Math.min(plan.food - food, p.cap - took)); food += q; took += q; } if (p.hh && took >= 1) gave.push(p.hh); }
  gave.forEach(h=>hhAdults(h).forEach(a=>civHear(a, {type:'gave', text:'We gave food for the expedition.', topics:{expansion:0.1}, imp:3, src:'self'})));
  let tools = 0; for (const p of sup.pools) for (const g of ['mtools','tools']){ if (tools >= plan.tools) break; tools += storeTake(p.st, g, plan.tools - tools); }
  if (plan.coin){ if (sponsor.k==='person') alive(sponsor.id).wallet -= plan.coin; else S.civ.gov.treasury -= plan.coin; }
  const e = {id:'exp_'+(++S.world.seq), dir, cx:plan.cx, cy:plan.cy, members:crew.map(c=>c.id), lead:crew[0].id, sponsor, start:d, back:d+plan.days, food:Math.round(food), foodNeed:plan.food, tools:Math.round(tools), toolsNeed:plan.tools, coin:plan.coin, status:'out', why:why||null};
  S.world.exp.push(e); ev('expeditions');
  crew.forEach(c=>{ c.away = {exp:e.id, until:e.back, dir}; c.plan = civPlanDay(c, d); c.rt.blockIdx = -1;
    civHear(c, {type:'expedition', text:`I set out on an expedition to the ${DIRS[dir].label.toLowerCase()}.`, topics:{expansion:0.2}, imp:7, src:'self'}); });
  const who = sponsor.k==='player' ? 'The settlement' : sponsor.k==='person' ? alive(sponsor.id).name : sponsor.k==='volunteer' ? `Tired of waiting for the settlement, ${alive(sponsor.id).name}` : 'On the gathering\'s word, the settlement';
  chronicle(`${sponsor.k==='volunteer' ? `${who} set out with ${crew.slice(1).map(c=>c.name).join(', ')||'nobody else'}` : `${who} sent ${crew.map(c=>c.name).join(', ')}`} into the unknown ${DIRS[dir].label.toLowerCase()} with ${e.food} days of food${e.tools?` and ${e.tools} tools`:' and no tools'}${plan.coin?` (${plan.coin} from ${sponsor.k==='person'?'their own purse':'the treasury'})`:''}. They expect to be back in ${plan.days} days.`, 7, '🧭', 'land');
  S.week.territory = (S.week.territory||[]).concat(`Expedition sent ${DIRS[dir].label.toLowerCase()}: ${crew.map(c=>c.name).join(', ')}`);
  civWitnesses(S.civ.center[0], S.civ.center[1], 10, e.members).forEach(o=>civHear(o, {ev:'expgo_'+e.id, type:'expedition_seen', text:`An expedition set out to the ${DIRS[dir].label.toLowerCase()}, led by ${crew[0].name}.`, pub:`An expedition set out to the ${DIRS[dir].label.toLowerCase()}, led by ${crew[0].name}.`, topics:{expansion:0.1}, imp:4, src:'saw'}));
  return {e};
}
// where explorers are while away: a camp at the edge of settled land in their direction
function civCampXY(dir){ const D = DIRS[dir], [hx, hy] = S.civ.center; let best = [hx, hy]; for (let k=1;k<300;k++){ const x = hx + D.dx*k, y = hy + D.dy*k; const t = tileAt(x,y); if (t===-1 || t===T.FOG) break; if (walkable(x,y)) best = [x,y]; } return best; }
function civReturnExpedition(e){
  const crew = e.members.map(alive).filter(Boolean), d = civDay(), rr = mapRand(hash(e.id+S.world.seed));
  const target = rollRegion(e.cx, e.cy), danger = target.attrs.danger, winter = seasonOf(d)===3;
  const short = (e.food < e.foodNeed*0.7 ? 0.15 : 0) + (e.tools < e.toolsNeed ? 0.1 : 0) + (winter ? 0.08 : 0);
  const hurt = [], lost = [];
  crew.forEach(c=>{ const x = rr(); if (x < danger*0.02 + short*0.03) lost.push(c); else if (x < danger*0.22 + short) hurt.push(c); });
  const fail = rr() < 0.08 + danger*0.12 + short*0.8;
  crew.forEach(c=>{ c.away = null; c.plan = civPlanDay(c, d); c.rt.blockIdx = -1; c.needs.hunger = Math.min(c.needs.hunger, e.food>=e.foodNeed ? 70 : 35); });
  e.status = fail ? 'failed' : 'returned'; e.home = d;
  lost.forEach(c=>{ chronicle(`${c.name} was lost on the expedition to the ${DIRS[e.dir].label.toLowerCase()}.`, 8, '🕯️', 'land'); civRemovePerson(c, 'death', `lost in the wilds on the ${DIRS[e.dir].label.toLowerCase()}ern expedition`); });
  hurt.forEach(c=>{ c.civ.hurt = 1; civHear(c, {type:'injury', text:`I was hurt on the expedition ${danger>0.45?'by wolves in the wilds':'crossing rough country'}.`, topics:{expansion:-0.3}, imp:7, src:'self'}); });
  const home = crew.filter(c=>!lost.includes(c));
  if (fail || !home.length){
    chronicle(`The expedition to the ${DIRS[e.dir].label.toLowerCase()} came home ${home.length?'empty-handed':'without anyone'}: ${short>0.1?'short of food and tools, ':''}they turned back before they could map anything.`, 7, '🧭', 'land');
    home.forEach(c=>civHear(c, {type:'expedition-failed', text:`Our expedition to the ${DIRS[e.dir].label.toLowerCase()} failed.`, topics:{expansion:-0.25}, imp:6, src:'self'}));
    S.week.territory = (S.week.territory||[]).concat(`The ${DIRS[e.dir].label.toLowerCase()}ern expedition failed${lost.length?` and ${lost.map(c=>c.name).join(', ')} was lost`:''}`);
    return;
  }
  const cell = civDiscoverRegion(e.cx, e.cy, home, e.sponsor); e.found = cell.key;
  const A = cell.attrs, notes = [];
  if (A.fert>0.65) notes.push('fertile soil'); if (A.timber>0.65) notes.push('dense forest'); if (A.ore>0.6) notes.push('signs of ore'); if (A.fish>0.6) notes.push('water full of fish'); if (A.danger>0.5) notes.push('wolf tracks everywhere'); if (A.beauty>0.75) notes.push('beautiful country');
  const andList = a => a.length<2 ? a.join('') : a.slice(0,-1).join(', ')+' and '+a[a.length-1];
  const text = `The expedition discovered ${cell.name}: ${BIOMES[cell.biome].label}${notes.length?` with ${andList(notes)}`:''}, and room for about ${cell.sites} homes.`;
  chronicle(`${text}${cell.state==='annexable'?' It borders settled land and could be annexed.':' It is too far out to claim until the land between is ours.'}`, 8, '🗺️', 'land');
  S.week.territory = (S.week.territory||[]).concat(`Discovered ${cell.name} (${BIOMES[cell.biome].label})${hurt.length?`; ${hurt.map(c=>c.name).join(', ')} hurt`:''}${lost.length?`; ${lost.map(c=>c.name).join(', ')} lost`:''}`);
  home.forEach(c=>civHear(c, {type:'discovery', text:`I helped map ${cell.name}: ${andList(notes)||'quiet country'}.`, topics:{expansion:0.5, ['region:'+cell.id]:0.6, nature:A.beauty>0.7?0.2:0}, imp:8, src:'self'}));
  const tp = {expansion: A.danger>0.5 ? 0.05 : 0.3, ['region:'+cell.id]: (A.fert+A.timber+A.fish+A.ore)/2 - A.danger - 0.4};
  civWitnesses(S.civ.center[0], S.civ.center[1], 12, e.members).forEach(o=>civHear(o, {ev:'disc_'+cell.key, type:'discovery_heard', text, pub:text, who:home.map(c=>c.id), topics:tp, imp:6, src:'saw'}));
  S.world.log.unshift({day:d, text}); S.world.log = S.world.log.slice(0, 30);
}
function civDiscoverRegion(cx, cy, finders, how){
  const key = cellKey(cx, cy); if (cellOf(key)) return cellOf(key);
  const roll = rollRegion(cx, cy), d = civDay();
  const cell = {key, cx, cy, id:'r_'+key.replace(',','_').replace(/-/g,'m'), n:++S.world.seq, name:roll.name, biome:roll.biome, attrs:roll.attrs, state:'discovered', found:d, finders:(finders||[]).map(c=>c.id), how:how && how.k || how || null, dir:cellDirs(cx,cy)[0]};
  S.world.cells[key] = cell;
  growWorld(); paintRegion(cell); civIndexWater(); civEcoRegion(cell); civDepositsRegion(cell);
  cell.sites = civRegionSites(cell);
  if ([[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>civCellClaimed(cx+a, cy+b))){ cell.state = 'annexable'; cell.annexableDay = d; }
  bumpWorld(); groundKey = ''; ev('regions_found');
  return cell;
}
// room for homes: how many 3x2 clear patches the region could take
function civRegionSites(cell){ const [x0,y0,x1,y1] = cellRect(cell.cx, cell.cy); let n = 0; const used = new Set();
  for (let y=y0+1; y<y1-3; y+=3) for (let x=x0+1; x<x1-4; x+=4){ let ok = true; for (let j=0;j<3 && ok;j++) for (let i=0;i<4 && ok;i++){ const t = tileAt(x+i,y+j); if (!(t===T.GRASS||t===T.FLOWER||t===T.SAND)) ok = false; } if (ok) n++; }
  return n; }

// ---------- annexation: proposed, argued over, voted on ----------
function civProposeAnnex(cell, by, why){
  const W = S.world; if (!cell || cell.state!=='annexable' || W.proposal) return null;
  if (W.votes.some(v=>v.cell===cell.key && civDay()-v.day < 28 && !v.passed)) return null;
  W.proposal = {cell:cell.key, by: by ? by.id : 'player', why: why || civAnnexWhy(cell), day:civDay()};
  chronicle(`${by ? by.name : 'A petition'} proposed annexing ${cell.name}: "${W.proposal.why}"`, 6, '📜', 'land');
  return W.proposal;
}
function civAnnexWhy(cell){ const A = cell.attrs, C = S.civ, needs = [];
  if (Object.values(C.hh).some(h=>!h.home) || (C.problems.housing||0) > 2 || (C.problems.land||0) > 2) needs.push('room to build');
  if (A.fert > 0.6) needs.push('farmland'); if (A.timber > 0.6) needs.push('timber'); if (A.fish > 0.6) needs.push('fish'); if (A.ore > 0.55) needs.push('ore');
  return needs.length ? `The settlement needs ${needs.slice(0,2).join(' and ')}.` : `${cell.name} is good land and it borders ours.`; }
function civAnnexCost(cell){ return civMoneyOn() ? Math.round((10 + ringOf(cell.cx, cell.cy)*10)*(S.civ.econ.level||1)) : 0; }
function civAnnexUpkeep(cell){ const lvl = S.civ.econ.level||1; return +((1 + ringOf(cell.cx,cell.cy)*1.2 + cell.attrs.danger*2 + cell.attrs.travel*1.5)*lvl).toFixed(1); }
// each voter weighs their own situation: a roof, land, their trade, the woods, the cost, and who is asking
function civAnnexScore(v, cell, by){
  const A = cell.attrs, h = hhOf(v), M = typeof cogOf==='function' ? cogOf(v) : {op:{}};
  let s = (M.op.expansion||0)/2 + (M.op['region:'+cell.id]||0)/3;
  if (h && !h.home) s += 25;
  if (S.civ.landShort != null && civDay() - S.civ.landShort < 28) s += 14; // everyone can see there is no land left if (h && h.home && S.civ.structs[h.home] && STRUCTURES[S.civ.structs[h.home].def].home && h.members.length > STRUCTURES[S.civ.structs[h.home].def].home.cap) s += 12; // crowded
  if ((M.op.nature||0) > 30) s -= 10 + A.beauty*15 + A.timber*10;
  if (v.values.includes('Prosperity')) s += 10; if (v.values.includes('Tradition')) s -= 6;
  const occ = v.civ.occ; if (occ==='farmer' && A.fert>0.6) s += 15; if (occ==='woodcutter' && A.timber>0.6) s += 15; if (occ==='fisher' && A.fish>0.6) s += 15; if ((occ==='miner'||occ==='prospector') && A.ore>0.5) s += 15; if (occ==='hunter') s += A.danger*10;
  s -= A.danger*15; if (civMoneyOn()) s -= Math.max(0, -(M.op.taxes||0))/6 + civAnnexUpkeep(cell)/(S.civ.econ.level||1);
  s += (A.fert + A.timber + A.fish + A.ore - 1.6)*12; // good land sells itself
  if (by && by.id) s += peekRel(v, by.id).affinity/5;
  return s + (hash(v.id+cell.key)%20 - 10);
}
function civAnnexVote(){
  const W = S.world, P = W.proposal; if (!P) return;
  const cell = cellOf(P.cell); if (!cell || cell.state!=='annexable'){ W.proposal = null; return; }
  const G = S.civ.gov; if (G.stage < 1 || civDay() - P.day < 2) return;
  const by = alive(P.by), cost = civAnnexCost(cell);
  // everyone votes once there are elections; before that, whoever comes to the gathering
  const voters = G.stage >= 5 ? S.citizens.filter(c=>isAdult(c) && !c.jail && !c.away) : S.citizens.filter(c=>isAdult(c) && !c.jail && !c.away && (c.politics.civicEngagement + c.personality.extraversion*0.3 + (cogOf(c).op.expansion||0)/200 > 0.45));
  if (voters.length < 5) return;
  const yes = [], no = []; voters.forEach(v=>(civAnnexScore(v, cell, by) > 0 ? yes : no).push(v));
  const fund = civMoneyOn() && (G.treasury||0) < cost/2; // a passed vote goes ahead if the treasury can pay at least half
  const passed = yes.length > no.length && !fund;
  W.votes.push({cell:cell.key, day:civDay(), yes:yes.length, no:no.length, passed, by:P.by, why:P.why}); W.proposal = null;
  const arg = no.length ? (no.filter(v=>(cogOf(v).op.nature||0)>30).length > no.length/3 ? 'too much wilderness would be lost' : cell.attrs.danger>0.5 ? 'it is too dangerous' : 'it would cost too much to keep up') : '';
  if (passed){ civAnnexRegion(cell, cost); chronicle(`Annex ${cell.name} PASSED (${yes.length}–${no.length}).`, 8, '✅', 'land'); }
  else chronicle(`Annex ${cell.name} FAILED (${yes.length}–${no.length})${fund?': the treasury cannot pay for it':arg?`: people said ${arg}`:''}.`, 7, '❌', 'land');
  yes.concat(no).forEach(v=>civHear(v, {ev:'annexvote_'+cell.key+civDay(), type:'vote', text:`We voted on annexing ${cell.name}; I voted ${yes.includes(v)?'for':'against'} it. It ${passed?'passed':'failed'}.`, topics:{expansion: yes.includes(v) ? 0.2 : -0.2}, imp:5, src:'hall'}));
  ev(passed ? 'annexations' : 'annex_failed');
}
function civAnnexRegion(cell, cost){
  if (cost && civMoneyOn()) S.civ.gov.treasury = Math.max(0, (S.civ.gov.treasury||0) - cost);
  cell.state = 'annexed'; cell.annexDay = civDay(); civRegionTrail(cell, true); bumpWorld(); groundKey = '';
  // the next ring out becomes reachable, and any mapped land that now borders ours can be claimed
  Object.values(S.world.cells).forEach(c=>{ if (c.state==='discovered' && [[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>civCellClaimed(c.cx+a, c.cy+b))){ c.state = 'annexable'; c.annexableDay = civDay(); chronicle(`${c.name} now borders settled land. It could be annexed.`, 5, '🗺️', 'land'); } });
  chronicle(`${cell.name} is now part of Pixel Town.`, 8, '🏘️', 'land'); S.week.territory = (S.week.territory||[]).concat(`${cell.name} annexed`);
}

// ---------- the daily round: expeditions home, upkeep, districts, pressure ----------
function civFrontierDaily(){
  if (!S.world) return;
  const W = S.world, d = civDay(), C = S.civ;
  W.exp.filter(e=>e.status==='out' && d >= e.back).forEach(civReturnExpedition);
  W.exp = W.exp.filter(e=>e.status==='out' || d-(e.home||e.start) < 120).slice(-30);
  civEcoExtDaily();
  civAnnexVote();
  // upkeep: a track to keep open and a long walk for anyone who has to go out there
  let total = 0;
  civAnnexed().forEach(c=>{
    const u = civAnnexUpkeep(c); c.upkeep = u;
    if (civMoneyOn()){ if ((C.gov.treasury||0) >= u){ C.gov.treasury -= u; total += u; if (c.neglect){ c.neglect = 0; chronicle(`The track to ${c.name} has been repaired.`, 4, '🛤️', 'infrastructure'); } }
      else if (!c.neglect){ c.neglect = d; civProblem('infrastructure', 2); chronicle(`There is no money to keep up the track to ${c.name}. It is going to ruin.`, 6, '🛤️', 'infrastructure'); } }
    // districts that fill up need their own services
    const homes = Object.values(C.structs).filter(s=>STRUCTURES[s.def].home && civRegionAt(s.x, s.y)===c), people = homes.reduce((a,s)=>a + ((C.hh[s.occ]||{}).members||[]).length, 0);
    c.people = people; c.homes = homes.length;
    if (c.state==='annexed' && Object.values(C.structs).some(s=>civRegionAt(s.x, s.y)===c)) c.state = 'developing';
    if (c.state==='developing' && (homes.length >= 4 || people >= 20)){ c.state = 'established'; chronicle(`${c.name} is no longer the frontier: it is an established district of Pixel Town.`, 7, '🏘️', 'land'); S.week.territory = (S.week.territory||[]).concat(`${c.name} became an established district`); }
    if (people >= 15 && d%14===0){ const [x0,y0,x1,y1] = cellRect(c.cx, c.cy), near = s => s.x >= x0-10 && s.x <= x1+10 && s.y >= y0-10 && s.y <= y1+10;
      if (!Object.values(C.structs).some(s=>['healer_hut','clinic','hospital'].includes(s.def) && near(s))){ civProblem('health', 1); if (!c.askedHealer){ c.askedHealer = d; chronicle(`People in ${c.name} have to walk a long way to see a healer.`, 4, '🩺', 'land'); } }
      const crimes = C.justice.cases.filter(k=>k.kind==='criminal' && k.at && civRegionAt(k.at[0], k.at[1])===c && d-k.day<28).length;
      if (crimes >= 2){ civProblem('crime', 2); if (!c.askedWatch || d - c.askedWatch > 56){ c.askedWatch = d; chronicle(`People in ${c.name} say their district is unsafe and needs its own constable.`, 5, '🚨', 'land'); S.citizens.filter(p=>civDistrictOf(p)===c.name && isAdult(p)).forEach(p=>civHear(p, {type:'district', text:`${c.name} needs a constable of its own.`, topics:{safety:-0.4, constables:0.2}, imp:4, src:'self'})); }
        const n = Object.keys(C.gov.offices).filter(k=>k.startsWith('constable')).length; if (C.justice.stage>=3 && !C.gov.offices['constable_'+c.id]){ const w = S.citizens.find(p=>civDistrictOf(p)===c.name && p.civ.watch && !p.office) || civWatch().find(p=>!p.office); if (w){ C.gov.offices['constable_'+c.id] = w.id; w.office = 'Constable'; chronicle(`${w.name} became constable for ${c.name}.`, 6, '🚨', 'justice'); } } } }
  });
  if (S.week) S.week.upkeep = (S.week.upkeep||0) + total;
  civFrontierPressure();
}
// how the settlement notices it is running out of room: homeless families, dear land, emptied woods and waters
function civFrontierPressure(){
  const C = S.civ, d = civDay(); if (d%7!==3) return;
  const E = C.eco.cells, ratio = k => { const cap = E.reduce((a,e)=>a+(k==='f'?e.fcap:k==='g'?e.gcap:e.fishcap),0); return cap ? E.reduce((a,e)=>a+e[k],0)/cap : 1; };
  const homeless = Object.values(C.hh).filter(h=>!h.home || !C.structs[h.home]).length, price = typeof civLandPrice==='function' ? civLandPrice(C.center[0], C.center[1]) : 0;
  let trees = 0; for (let y=0;y<OH;y+=2) for (let x=0;x<OW;x+=2) if (tileAt(x,y)===T.TREE) trees++;
  C.frontierNeed = {homeless, price, forage:+ratio('f').toFixed(2), game:+ratio('g').toFixed(2), fish:+ratio('fish').toFixed(2), trees};
  const short = C.landShort != null && d - C.landShort < 28;
  const need = (short ? 2 + homeless : 0) + (price > 14 ? 2 : 0) + (ratio('f') < 0.4 ? 2 : 0) + (ratio('g') < 0.3 ? 1 : 0) + (trees < 400 ? 2 : 0) + (S.citizens.length > 140 ? 1 : 0);
  if (need >= 2) civProblem('land', Math.round(need));
  // when the pressure is real, a restless household with food to spare may mount an expedition of its own
  if (need >= 3 && !S.world.exp.some(e=>e.status==='out') && d - (S.world.lastVolunteer||-99) >= 28){
    const v = S.citizens.filter(x=>isAdult(x) && civCanExplore(x) && hhOf(x) && hhFoodDays(hhOf(x)) >= 8 && ((cogOf(x).op.expansion||0) > 15 || x.values.includes('Freedom') || x.traits.includes('Ambitious') || x.traits.includes('Reckless'))).sort((a,b)=>civExplorerScore(b)-civExplorerScore(a))[0];
    const dir = v && civExpDirection();
    if (v && dir){ S.world.lastVolunteer = d; const r = civLaunchExpedition(dir, {k:'volunteer', id:v.id}, 'there is no room left here'); if (r.e) civHear(v, {type:'sponsor', text:`I led our own expedition to the ${DIRS[dir].label.toLowerCase()}.`, topics:{expansion:0.3}, imp:7, src:'self'}); } }
  // a restless settler with means may go on their own
  if (civMoneyOn() && rnd() < 0.05 && !S.world.exp.some(e=>e.status==='out')){ const c = S.citizens.filter(x=>isAdult(x) && !x.office && x.wallet > 60*(C.econ.level||1) && (cogOf(x).op.expansion||0) > 30 && (x.traits.includes('Ambitious') || x.traits.includes('Reckless'))).sort((a,b)=>b.wallet-a.wallet)[0];
    const dir = c && civExpDirection(); if (c && dir){ const r = civLaunchExpedition(dir, {k:'person', id:c.id}); if (r.e) civHear(c, {type:'sponsor', text:`I paid for an expedition to the ${DIRS[dir].label.toLowerCase()}.`, topics:{expansion:0.3}, imp:7, src:'self'}); } }
}
// which way to look: toward what the settlement is short of
function civExpDirection(){ const N = S.civ.frontierNeed || {}, pref = (N.fish||1) < 0.4 ? ['S','E','W','N'] : (N.trees||999) < 400 ? ['N','E','W','S'] : (N.forage||1) < 0.4 ? ['W','S','E','N'] : ['W','S','N','E'];
  // mapped-but-unclaimed land in a direction (especially land already voted down) makes people look elsewhere first
  const waiting = x => Object.values(S.world.cells).filter(c=>c.dir===x && !CIV_CLAIMED.includes(c.state)).length*2 + S.world.votes.filter(v=>!v.passed && (cellOf(v.cell)||{}).dir===x).length;
  return pref.map((x,i)=>({x, s:i + waiting(x)*3})).sort((a,b)=>a.s-b.s).map(o=>o.x).find(x=>frontierCells(x).length && !S.world.exp.some(e=>e.status==='out' && e.dir===x)) || null; }
// the gathering's answer to "we are running out of land"
function civDecideLand(convener){
  const W = S.world; if (!W) return null;
  const rejected = c => W.votes.some(v=>v.cell===c.key && !v.passed && civDay()-v.day < 56);
  const open = Object.values(W.cells).filter(c=>c.state==='annexable' && !rejected(c)).sort((a,b)=>(b.attrs.fert+b.attrs.timber+b.sites/10)-(a.attrs.fert+a.attrs.timber+a.sites/10))[0];
  if (open && !W.proposal){ const p = civProposeAnnex(open, convener); if (p) return `put annexing ${open.name} to a vote`; }
  if (W.exp.some(e=>e.status==='out')) return null;
  const dir = civExpDirection(); if (!dir) return null;
  const r = civLaunchExpedition(dir, {k:'gathering'}, 'we are running out of land');
  if (r.e){ chronicle(`${convener.name}: "We are running out of land. We should see what lies beyond the ${{N:'northern ridge',S:'southern marshes',E:'eastern hills',W:'western plains'}[dir]}."`, 5, '🗣️', 'land'); return `send an expedition ${DIRS[dir].label.toLowerCase()}`; }
  return null;
}
// settlers who moved out to new land remember what it gave them
function civFrontierWeekly(){
  if (!S.world) return;
  S.citizens.filter(isAdult).forEach(c=>{ const r = civDistrictOf(c); if (!r) return; const M = cogOf(c); if (M.movedTo===r) return; M.movedTo = r; const cell = Object.values(S.world.cells).find(x=>x.name===r);
    civHear(c, {type:'settled', text:`Moving out to ${r} gave us land of our own.`, topics:{expansion:0.8, ...(cell ? {['region:'+cell.id]:0.6} : {})}, imp:7, src:'self', emo:0.3}); });
}
