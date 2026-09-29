/* =====================================================================
   Pixel Town — civilization mode: street lighting and transport
   The town lights its streets once it can: torches first, then oil lanterns, gas lamps and
   electric street lights, each needing both the technique and a big enough town.
   What people know decides what moves about: riders, carts and wagons on the tracks, boats and
   ships on the water, trains on the railway, motor cars on the roads and aeroplanes in the sky.
   ===================================================================== */

// ---------- the town's level: 0 camp, 1 hamlet, 2 village, 3 town, 4 city, 5 major city ----------
function civStageIdx(){ const L = S.civ.stageLabel; const i = SETTLEMENT_STAGES.findIndex(([,l])=>l===L); return Math.max(0, i); }
function civStageName(i){ return (SETTLEMENT_STAGES[i]||SETTLEMENT_STAGES[0])[1]; }

// ---------- street lighting ----------
const CIV_LIGHT_KINDS = ['torch_post','oil_lantern','gas_lamp','electric_lamp'];
const CIV_LIGHT_COL = {torch:'rgba(255,120,40,0.36)', lantern:'rgba(255,170,80,0.34)', gas:'rgba(255,222,160,0.32)', electric:'rgba(214,232,255,0.34)'};
const CIV_LIGHT_HEX = {torch:0xff8a30, lantern:0xffb060, gas:0xffe0a0, electric:0xe0ecff};
function civLightNeeds(def){ const D = STRUCTURES[def], out = []; if (D.tech && !civTechKnown(D.tech)) out.push(TECHS[D.tech].label); if (civStageIdx() < D.light.stage) out.push(`a ${civStageName(D.light.stage).toLowerCase()}`); if (D.light.power && !civHas('power_plant').length) out.push('a power station'); return out; }
function civLightOK(def){ return !civLightNeeds(def).length; }
function civBestLight(){ let best = null; CIV_LIGHT_KINDS.forEach(k=>{ if (civLightOK(k)) best = k; }); return best; }
function civLamps(){ return civStructsOf(s=>STRUCTURES[s.def] && STRUCTURES[s.def].light); }
function civLitAt(x, y){ return civLamps().some(s=>Math.hypot(s.x+0.5-x, s.y+0.5-y) <= STRUCTURES[s.def].light.r/TILE); }
// a crime at night is harder to see, unless the street is lit
function civDarkAt(x, y){ return civNight() && !civLitAt(x, y); }
// where people are: the fire, doors of homes and public buildings; the darkest of them gets the next light
function civLightAnchors(){
  const C = S.civ, out = [C.center.slice()];
  civStructsOf(s=>{ const D = STRUCTURES[s.def]; return !D.tile && !D.prop && !D.light && s.status==='active'; }).forEach(s=>out.push([s.x+Math.floor(s.w/2), s.y+s.h]));
  return out;
}
function civLightSite(){
  const C = S.civ, lamps = civLamps().map(s=>[s.x, s.y]).concat(civProjects().filter(p=>STRUCTURES[p.def].light).map(p=>[p.x, p.y]));
  const doors = new Set(BUILDINGS.map(b=>b.door && tkey(b.door[0], b.door[1])));
  const gap = xy => lamps.length ? Math.min(...lamps.map(([a,b])=>Math.hypot(a-xy[0], b-xy[1]))) : 99;
  const anchors = civLightAnchors().map(a=>[a, gap(a)]).filter(([,g])=>g >= 4).sort((a,b)=>b[1]-a[1] || hash(a[0]+'')-hash(b[0]+''));
  for (const [[ax, ay]] of anchors.slice(0, 12)){
    for (let r=1; r<=3; r++) for (let j=-r; j<=r; j++) for (let i=-r; i<=r; i++){
      if (Math.max(Math.abs(i), Math.abs(j))!==r) continue;
      const x = ax+i, y = ay+j, t = tileAt(x, y);
      if (!(t===T.GRASS || t===T.FLOWER || t===T.SAND) || S.civ.reserved[tkey(x,y)] || doors.has(tkey(x,y))) continue;
      if (!civSiteInLand(x, y, 1, 1) || gap([x,y]) < 3.5) continue;
      // beside a way people walk, never boxing in a door
      const nb = [[1,0],[-1,0],[0,1],[0,-1]].map(([a,b])=>[x+a, y+b]);
      if (!nb.some(([a,b])=>tileAt(a,b)===T.PATH || tileAt(a,b)===T.PLAZA || doors.has(tkey(a,b)))) continue;
      if (nb.some(([a,b])=>doors.has(tkey(a,b)) && nb.filter(([c,d])=>WALK.has(tileAt(c,d))).length < 2)) continue;
      return {x, y, w:1, h:1};
    }
  }
  return null;
}
function civLightingDaily(){
  const C = S.civ, n = S.citizens.length, d = civDay();
  // the town keeps its lights in repair: nobody lives in a lamp post, but it is still in use
  civLamps().forEach(s=>{ if (s.status==='abandoned') s.status = 'active'; if (s.cond < 60 && hashf(s.x, s.y, d) < 0.15) s.cond = Math.min(100, s.cond + 30); });
  if (n < 5) return;
  const best = civBestLight(); if (!best) return;
  const lamps = civLamps(), busy = civProjects().filter(p=>STRUCTURES[p.def].light).length;
  // lights are a comfort, not a need: only with food to spare, one at a time
  if (busy >= 1 || civHomelessHH().length >= 3 || !civBuildSeasonOK() || civFoodDaysAll() < 5) return;
  const owner = civTownOwner(), rank = k => CIV_LIGHT_KINDS.indexOf(k);
  // better lights replace old ones, starting in the middle of town
  const old = lamps.filter(s=>rank(s.def) < rank(best) && !civProjects().some(p=>p.upgradeOf===s.id)).sort((a,b)=>Math.hypot(a.x-C.center[0], a.y-C.center[1]) - Math.hypot(b.x-C.center[0], b.y-C.center[1]));
  if (old.length){ civStartProject(best, {x:old[0].x, y:old[0].y, w:1, h:1}, old[0].owner, {upgradeOf:old[0].id, purpose:'lighting', quiet:true}); return; }
  const want = Math.min(60, Math.ceil(n/8) + civStageIdx()*2);
  if (lamps.length + busy >= want) return;
  const site = civLightSite(); if (site) civStartProject(best, site, owner, {purpose:'lighting', quiet:true});
}

// ---------- transport: what the town can build to move people and goods ----------
// kind → the technique, the vehicles it adds, the place it needs, the town level
const CIV_VEHICLES = {
  cart:      {label:'Handcarts',          icon:'🛒', tech:'wheel'},
  horse:     {label:'Riders on horseback',icon:'🐎', tech:'riding'},
  wagon:     {label:'Horse-drawn wagons', icon:'🐴', tech:'wagons'},
  boat:      {label:'Rowing boats',       icon:'🛶', tech:'boatbuilding'},
  ship:      {label:'Sailing ships',      icon:'⛵', tech:'sailing', needs:'shipyard'},
  steamship: {label:'Steamships',         icon:'🚢', tech:'steamships', needs:'shipyard'},
  train:     {label:'Steam trains',       icon:'🚂', tech:'railways', needs:'station'},
  car:       {label:'Motor cars',         icon:'🚗', tech:'automobiles'},
  truck:     {label:'Lorries',            icon:'🚚', tech:'automobiles', stage:3},
  plane:     {label:'Aeroplanes',         icon:'✈️', tech:'aviation', needs:'airfield'}
};
const CIV_TRANSPORT_BUILD = [ ['stable', 1], ['boathouse', 1], ['shipyard', 2], ['power_plant', 3], ['station', 3], ['airfield', 3] ];
function civVehicleNeeds(k){ const V = CIV_VEHICLES[k], out = []; if (!civTechKnown(V.tech)) out.push(TECHS[V.tech].label); if (V.stage && civStageIdx() < V.stage) out.push(`a ${civStageName(V.stage).toLowerCase()}`); if (V.needs && !civHas(V.needs).length) out.push(`a ${STRUCTURES[V.needs].label.toLowerCase()}`); return out; }
function civVehicleOK(k){ return !civVehicleNeeds(k).length; }
// how much faster people and goods get about
function civTravelSpeed(){ if (!S.civ) return 1; let v = 1; if (civTechKnown('wheel')) v += 0.05; if (civTechKnown('riding')) v += 0.15; if (civTechKnown('wagons')) v += 0.1; if (civVehicleOK('train')) v += 0.3; if (civTechKnown('automobiles')) v += 0.3; if (civVehicleOK('plane')) v += 0.3; return v; }
function civHaulBonus(){ if (!S.civ) return 0; return (civTechKnown('wheel')?1:0) + (civTechKnown('wagons')?1:0) + (civVehicleOK('ship')||civVehicleOK('steamship')?1:0) + (civVehicleOK('train')?2:0) + (civVehicleOK('truck')?1:0); }
// shore points on settled land, nearest the middle of town first, spread out so each try looks somewhere new
function civShores(near){ const out = [];
  for (let y=Y0;y<Y0+MH;y++) for (let x=X0;x<X0+MW;x++){ if (MAP[y][x]!==T.WATER || !civClaimedTile(x,y)) continue; if (![[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>WALK.has(tileAt(x+a,y+b)))) continue; out.push([x, y, Math.hypot(x-near[0], y-near[1])]); }
  out.sort((a,b)=>a[2]-b[2]); const picked = []; out.forEach(p=>{ if (picked.length < 8 && picked.every(q=>Math.hypot(p[0]-q[0], p[1]-q[1]) > 8)) picked.push(p); }); return picked; }
function civTransportWeekly(){
  const C = S.civ, lvl = civStageIdx(), adults = S.citizens.filter(isAdult);
  if (civProjects().some(p=>STRUCTURES[p.def].transport || p.def==='power_plant') || civHomelessHH().length >= 3 || !civBuildSeasonOK()) return;
  for (const [def, need] of CIV_TRANSPORT_BUILD){
    if (lvl < need || civHas(def).length || !civCanBuild(def, adults)) continue;
    if (def==='power_plant' && !civTechKnown('electricity')) continue;
    let site = null;
    if (def==='boathouse' || def==='shipyard'){ for (const w of civShores(C.center)){ site = civFindSite(def, w, {margin:1, maxR:8, anySide:true, test:(x,y,W,H)=>civNearWater(x,y,W,H,2)}); if (site) break; } }
    else if (def==='station') site = civFindSite(def, C.center, {margin:1, test:(x,y,w,h)=>!!civTrack({x, y, w, h})}); // somewhere the line can run
    else site = civFindSite(def, C.center, {margin:1});
    if (!site) continue;
    const why = {stable:'to keep horses for riders and wagons', boathouse:'to build and keep boats', shipyard:'to build ships and a harbour for them', power_plant:'to bring electric light to the streets', station:'to bring the railway to town', airfield:'so aeroplanes can land'}[def];
    civStartProject(def, site, civTownOwner(), {purpose:'transport', why});
    return;
  }
}
// the railway runs along the station's front, as far as open ground allows
function civTrack(s){
  const y = s.y + s.h + 1, mine = 'rail:'+s.id, ok = x => { const t = tileAt(x, y), r = S.civ.reserved[tkey(x, y)]; return t!==-1 && t!==T.WATER && t!==T.ROCK && t!==T.BUILD && t!==T.FOG && t!==T.OBJ && civClaimedTile(x, y) && (!r || r===mine); };
  let x0 = s.x, x1 = s.x + s.w - 1; if (!ok(x0) || !ok(x1)) return null;
  while (x0 > s.x - 40 && ok(x0-1)) x0--; while (x1 < s.x + s.w + 40 && ok(x1+1)) x1++;
  return x1 - x0 >= 8 ? {y, x0, x1} : null;
}
// the line is kept clear: nobody may build on it
function civSetTrack(s, t){ const R = S.civ.reserved, mine = 'rail:'+s.id; for (const k in R) if (R[k]===mine) delete R[k]; s.meta.track = t; if (t) for (let x=t.x0; x<=t.x1; x++) if (!R[tkey(x, t.y)]) R[tkey(x, t.y)] = mine; S.civ.dirtyGround = true; }
function civTracksWeekly(){ const R = S.civ.reserved; for (const k in R) if (typeof R[k]==='string' && R[k].startsWith('rail:') && !S.civ.structs[R[k].slice(5)]) delete R[k];
  civHas('station').forEach(s=>{ const t = civTrack(s); if (JSON.stringify(t)!==JSON.stringify(s.meta.track||null)) civSetTrack(s, t); }); }
function civOnStructBuiltTransport(s, p){
  const D = STRUCTURES[s.def], C = S.civ; C.firsts = C.firsts || {};
  if (D.light && !C.firsts[s.def]){ C.firsts[s.def] = civDay(); chronicle(`The first ${D.label.toLowerCase()} was lit${s.def==='torch_post'?' beside the path':''}. The streets are ${s.def==='electric_lamp'?'as bright as day':'safer after dark'}.`, 6, s.def==='electric_lamp'?'💡':'🔥', 'infrastructure'); ev('lights_first'); }
  if (D.light) ev('lights_built');
  if (s.def==='station'){ civSetTrack(s, civTrack(s)); if (s.meta.track) chronicle('The railway has reached the town. The first train steamed into the new station.', 9, '🚂', 'infrastructure'); }
  if (s.def==='airfield') chronicle('The first aeroplane landed on the new airfield.', 9, '✈️', 'infrastructure');
  if (s.def==='shipyard') chronicle('The shipyard launched its first ship.', 8, '⛵', 'infrastructure');
}
function civOnTechTransport(t){
  const lines = {riding:'People have started riding horses.', wheel:'The first handcarts are rolling along the paths.', wagons:'Horses now pull wagons of goods through town.', boatbuilding:'Boats are out on the water.', automobiles:'Motor cars have appeared on the roads.', aviation:'People are learning to fly.', gas_lighting:'Gas can light the streets now.', electricity:'Electric light is possible, once there is a power station.'};
  if (lines[t]) chronicle(lines[t], 7, CIV_VEHICLES[Object.keys(CIV_VEHICLES).find(k=>CIV_VEHICLES[k].tech===t)]?.icon || '💡', 'science');
}
function civTransportDaily(d){ civLightingDaily(); if (d%7===3){ civTransportWeekly(); civTracksWeekly(); } }

// =====================================================================
// vehicles on screen: a light, local simulation of traffic (it never touches the game's dice)
// =====================================================================
const VEHICLES = [];
let VEH_KEY = '';
function civVehKey(){ const C = S.civ; return Object.keys(CIV_VEHICLES).filter(civVehicleOK).join(',') + '|' + Math.floor(S.citizens.length/10) + '|' + civHas(['station','airfield','shipyard','boathouse']).length + '|' + (S.worldVer||0); }
function civVehTiles(){
  const land = [], road = [], water = [], open = [];
  for (let y=Y0;y<Y0+MH;y++) for (let x=X0;x<X0+MW;x++){ const t = MAP[y][x];
    if (t===T.WATER){ water.push([x,y]); if ([[1,0],[-1,0],[0,1],[0,-1]].every(([a,b])=>tileAt(x+a,y+b)===T.WATER)) open.push([x,y]); }
    else if (t===T.PATH || t===T.BRIDGE){ road.push([x,y]); land.push([x,y]); }
    else if (t===T.GRASS || t===T.PLAZA || t===T.SAND) land.push([x,y]); }
  return {land, road, water, open};
}
const VEH_SPEC = {
  cart:{on:'land', v:10, day:true}, horse:{on:'land', v:26, day:true}, wagon:{on:'land', v:15, day:true}, boat:{on:'water', v:9, day:true},
  ship:{on:'open', v:8}, steamship:{on:'open', v:13}, car:{on:'road', v:38}, truck:{on:'road', v:30}, train:{on:'rail', v:70}, plane:{on:'air', v:95}
};
function civSyncVehicles(){
  VEH_KEY = civVehKey();
  const n = S.citizens.length, TL = civVehTiles(), C = S.civ, want = [];
  const add = (kind, k) => { for (let i=0;i<k;i++) want.push(kind+i); };
  const later = k => civVehicleOK(k);
  if (later('cart')) add('cart', Math.min(3, Math.ceil(n/35)) - (later('wagon') ? 1 : 0));
  if (later('horse')) add('horse', Math.min(4, Math.ceil(n/30)) - (later('car') ? 2 : 0));
  if (later('wagon')) add('wagon', Math.min(3, Math.ceil(n/45)) - (later('truck') ? 1 : 0));
  if (later('boat') && TL.water.length > 12) add('boat', Math.min(3, 1 + Math.floor(n/60)));
  if (TL.open.length > 20){ if (later('steamship')) add('steamship', 1); else if (later('ship')) add('ship', Math.min(2, 1 + Math.floor(n/150))); }
  if (later('car') && TL.road.length > 20) add('car', Math.min(10, Math.ceil(n/18)));
  if (later('truck') && TL.road.length > 20) add('truck', Math.min(3, Math.ceil(n/80)));
  if (later('train') && civHas('station').some(s=>s.meta.track)) add('train', 1);
  if (later('plane')) add('plane', 1 + (n > 250 ? 1 : 0));
  const keep = new Map(VEHICLES.map(v=>[v.id, v])); VEHICLES.length = 0;
  want.forEach((id,i)=>{ const kind = id.replace(/\d+$/,''); let v = keep.get(id); if (!v){ v = civSpawnVehicle(id, kind, TL, i); if (!v) return; } VEHICLES.push(v); });
  civVehTL = TL;
}
let civVehTL = null;
function civSpawnVehicle(id, kind, TL, i){
  const sp = VEH_SPEC[kind], r = mapRand(hash(id + S.civ.seed));
  const v = {id, kind, variant: hash(id)%5, x:0, y:0, px:0, py:0, tx:null, ty:null, cur:null, prev:null, face:1, dx:1, dy:0, wait:r()*4, phase:r()*10};
  if (sp.on==='air'){ civPlaneRoute(v, r); return v; }
  if (sp.on==='rail'){ const st = civHas('station').find(s=>s.meta.track); if (!st) return null; const T0 = st.meta.track; v.track = T0; v.x = (st.x + st.w/2)*TILE; v.y = (T0.y + 0.5)*TILE; v.dir = 1; v.wait = 6; return v; }
  const pool = TL[sp.on==='open' ? 'open' : sp.on]; if (!pool.length) return null;
  const [cx, cy] = S.civ.center, near = sp.on==='land' || sp.on==='road' ? pool.filter(([x,y])=>Math.abs(x-cx)<30 && Math.abs(y-cy)<22) : pool;
  const [x, y] = (near.length ? near : pool)[Math.floor(r()*(near.length || pool.length))];
  v.cur = [x, y]; v.x = (x+0.5)*TILE; v.y = (y+0.5)*TILE; return v;
}
function civPlaneRoute(v, r){ r = r || Math.random; const H = MH*TILE, west = r() < 0.5; v.x = (west ? X0*TILE - 80 : (X0+MW)*TILE + 80); v.y = Y0*TILE + H*(0.15 + r()*0.7); v.vy = (r()-0.5)*14; v.face = west ? 1 : -1; v.dx = v.face; v.dy = 0; v.wait = 3 + r()*20; v.flying = false; }
// a vehicle is on screen unless it is stabled for the night or an aeroplane waiting to come over
function civVehShown(v){ return !v.hidden && !(v.kind==='plane' && !v.flying); }
// the parts of a train on the track (engine first), each only while it is between the track's ends
function civTrainParts(v){ const T0 = v.track; if (!T0) return []; const a = T0.x0*TILE + 6, b = (T0.x1+1)*TILE - 6, dir = v.dir||1;
  return [{x:v.x, loco:true}].concat([1,2,3].map(k=>({x:v.x - dir*(4 + k*33), car:k}))).filter(p=>p.x >= a && p.x <= b); }
function civVehAllowed(kind, x, y){ const t = tileAt(x, y), on = VEH_SPEC[kind].on;
  if (on==='water') return t===T.WATER; if (on==='open') return t===T.WATER && [[1,0],[-1,0],[0,1],[0,-1]].every(([a,b])=>tileAt(x+a,y+b)===T.WATER);
  if (on==='road') return t===T.PATH || t===T.BRIDGE; return t===T.PATH || t===T.BRIDGE || t===T.GRASS || t===T.PLAZA || t===T.SAND; }
function civVehNext(v){
  const [x, y] = v.cur, dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  let opts = dirs.map(([a,b])=>[x+a, y+b]).filter(([a,b])=>civVehAllowed(v.kind, a, b) && (civClaimedTile(a,b)));
  // land vehicles keep to the paths when there are any
  if (VEH_SPEC[v.kind].on==='land'){ const paths = opts.filter(([a,b])=>tileAt(a,b)===T.PATH || tileAt(a,b)===T.BRIDGE); if (paths.length) opts = paths; }
  const fwd = opts.filter(([a,b])=>!(v.prev && a===v.prev[0] && b===v.prev[1]));
  if (fwd.length) opts = fwd;
  if (!opts.length) return null;
  // mostly keep going straight
  const straight = opts.find(([a,b])=>a-x===v.dx && b-y===v.dy);
  return straight && Math.random() < 0.7 ? straight : opts[Math.floor(Math.random()*opts.length)];
}
function civVehNight(){ const m = modOf(S.minute); return m < 330 || m > 1290; }
function civUpdateVehicles(dt, sp){
  if (!S.civ) return;
  const now = performance.now(); if (!VEHICLES.t || now - VEHICLES.t > 1000 || !sp){ VEHICLES.t = now; if (VEH_KEY !== civVehKey()) civSyncVehicles(); }
  const night = civVehNight();
  VEHICLES.forEach(v=>{
    const spec = VEH_SPEC[v.kind]; v.px = v.x; v.py = v.y;
    v.hidden = !!(spec.day && night);
    if (v.hidden || !sp) return;
    // aeroplanes wait out of sight, then cross the whole sky
    if (spec.on==='air'){ if (v.wait > 0){ v.wait -= dt*sp; v.flying = false; return; } v.flying = true; v.x += v.face*spec.v*sp*dt; v.y += v.vy*sp*dt*0.2; if ((v.face > 0 && v.x > (X0+MW)*TILE + 120) || (v.face < 0 && v.x < X0*TILE - 120)) civPlaneRoute(v); return; }
    // the train runs the length of the track, stops at the station, and leaves town at each end before coming back
    if (spec.on==='rail'){ const st = civHas('station').find(s=>s.meta.track); if (!st){ v.hidden = true; return; } const T0 = v.track = st.meta.track; v.y = (T0.y + 0.5)*TILE;
      if (v.wait > 0){ v.wait -= dt*sp; return; }
      v.x += v.dir*spec.v*sp*dt; v.face = v.dx = v.dir; v.dy = 0;
      const mid = (st.x + st.w/2)*TILE; if (!v.stopped && Math.abs(v.x - mid) < spec.v*sp*dt + 1){ v.x = mid; v.wait = 8; v.stopped = true; return; } if (Math.abs(v.x - mid) > 40) v.stopped = false;
      const a = T0.x0*TILE, b = (T0.x1+1)*TILE; if (v.dir > 0 && v.x > b + 160){ v.dir = -1; v.wait = 10; } else if (v.dir < 0 && v.x < a - 160){ v.dir = 1; v.wait = 10; }
      return; }
    if (v.wait > 0){ v.wait -= dt*sp; return; }
    if (v.tx===null){ const n = civVehNext(v); if (!n){ v.wait = 2; v.prev = null; return; } v.prev = v.cur; v.dx = n[0]-v.cur[0]; v.dy = n[1]-v.cur[1]; v.cur = n; v.tx = (n[0]+0.5)*TILE; v.ty = (n[1]+0.5)*TILE; if (v.dx) v.face = v.dx; }
    const dx = v.tx - v.x, dy = v.ty - v.y, d = Math.hypot(dx, dy), step = spec.v*sp*dt;
    if (d <= step){ v.x = v.tx; v.y = v.ty; v.tx = null; if (Math.random() < 0.03) v.wait = 1 + Math.random()*4; }
    else { v.x += dx/d*step; v.y += dy/d*step; }
  });
}

// ---------- 2D art ----------
function civTransportArt(){
  const A = ART.civ; if (!A || A.veh) return;
  const V = A.veh = {};
  const CAR = ['#c83a3a','#3a6ac8','#3a8a4a','#2a2a30','#e8d8a8'];
  // riders and horses: the horse from the animal art, with a rider on top
  V.horse = [0,1].map(f=>{ const h = ART.animals.horse[0][f], p = mk(h.width, h.height+10), g = p.getContext('2d'); g.drawImage(h, 0, 10); const x = Math.round(h.width*0.42);
    g.fillStyle='#3a5a8a'; g.fillRect(x-1, 6, 5, 7); g.fillStyle='#f0c8a0'; g.fillRect(x, 1, 4, 5); g.fillStyle='#5a3a22'; g.fillRect(x-1, 0, 6, 2); g.fillStyle='#2a2a30'; g.fillRect(x+1, 13, 2, 5); g.fillStyle='#1b1320'; g.fillRect(x+3,3,1,1); return p; });
  V.cart = (()=>{ const p = new Pix(18,14); p.rect(2,5,12,5,WOOD_R[3]); p.rect(2,5,12,1,WOOD_R[5]); p.line(14,6,17,3,WOOD_R[2]); blob(p,[{x:6,y:4,r:2.6},{x:10,y:4,r:2.4}],['#8a7050','#a08860','#c0a878','#d8c090','#e8d8a8'],{}); p.ellipse(8,11,2.5,2.5,'#3a2a1e'); p.set(8,11,'#8a6038'); return p.outline().done(); })();
  V.wagon = [0,1].map(f=>{ const h = ART.animals.horse[1] ? ART.animals.horse[1][f] : ART.animals.horse[0][f], p = mk(h.width+26, h.height+6), g = p.getContext('2d');
    const w = new Pix(28, h.height+6); for (let y=4;y<14;y++){ const k = Math.sin((y-4)/10*Math.PI); for (let x=2;x<26;x++) w.set(x, y+(k>0?0:0), y<6||x<3||x>24 ? '#c8c0a8' : '#ece6d4'); } w.rect(1,13,26,5,WOOD_R[2]); w.rect(1,13,26,1,WOOD_R[4]); w.ellipse(6,h.height+2,3,3,'#2a2018'); w.ellipse(21,h.height+2,3,3,'#2a2018'); w.set(6,h.height+2,'#8a6038'); w.set(21,h.height+2,'#8a6038'); g.drawImage(w.outline().done(), 0, 0);
    g.drawImage(h, 24, 6); g.fillStyle = WOOD_R[3]; g.fillRect(24, h.height-2, 8, 1); return p; });
  V.boat = (()=>{ const b = ART.boat, p = mk(b.width, b.height+6), g = p.getContext('2d'); g.drawImage(b, 0, 6); g.fillStyle='#8a3a2a'; g.fillRect(11,3,5,6); g.fillStyle='#f0c8a0'; g.fillRect(12,0,3,3); g.fillStyle=WOOD_R[3]; g.fillRect(4,9,18,1); return p; })();
  const hull = (p, w, h, top, col) => { for (let y=top;y<top+h;y++){ const k = (y-top)/h, inset = Math.round(k*k*6); for (let x=inset;x<w-inset-Math.round(k*4);x++) p.set(x, y, y===top ? '#e8e0d0' : col); } };
  V.ship = [0,1].map(f=>{ const p = new Pix(44,40); hull(p, 44, 9, 30, '#6a4428'); p.rect(0,33,44,1,'#e8c84a'); p.rect(20,4,2,27,'#5a3a22'); p.rect(9,8,24,1,'#5a3a22');
    for (let y=9;y<27;y++){ const bw = 11 - Math.abs(y-17)*0.25 + (f?1:0); for (let x=Math.round(21-bw);x<=Math.round(21+bw);x++) p.set(x, y, (x+y)%9===0 ? '#d8d0c0' : '#f4f0e6'); }
    p.line(21,3,40,29,'#8a7a60'); p.rect(20,1,6,3,'#c83a3a'); return p.outline().done(); });
  V.steamship = (()=>{ const p = new Pix(48,30); hull(p, 48, 10, 19, '#2a2a34'); p.rect(0,23,48,2,'#a83030'); p.rect(10,12,24,7,'#e8e4dc'); for (let x=12;x<32;x+=4) p.rect(x,14,2,2,'#3a5a8a'); p.rect(22,2,5,10,'#1e1e24'); p.rect(22,4,5,2,'#c83a3a'); return p.outline().done(); })();
  V.car = CAR.map(col=>{ const p = new Pix(24,13); p.rect(1,5,22,5,col); p.rect(6,1,11,5,col); p.rect(7,2,4,3,'#a8d0f0'); p.rect(12,2,4,3,'#a8d0f0'); p.rect(22,6,1,2,'#fff0a0'); p.rect(1,6,1,2,'#c83a3a'); p.rect(1,9,22,1,'#1e1e24');
    [5,18].forEach(x=>{ p.ellipse(x,10.5,2.4,2.4,'#1e1e24'); p.set(x,10,'#9a9aa8'); }); return p.outline().done(); });
  V.truck = (()=>{ const p = new Pix(32,17); p.rect(1,1,20,11,'#6a7a4a'); p.rect(1,1,20,1,'#8a9a6a'); p.rect(22,4,9,8,'#c8a030'); p.rect(25,5,5,3,'#a8d0f0'); p.rect(30,9,1,2,'#fff0a0'); p.rect(1,12,30,1,'#1e1e24'); [5,11,26].forEach(x=>{ p.ellipse(x,13.5,2.4,2.4,'#1e1e24'); p.set(x,13,'#9a9aa8'); }); return p.outline().done(); })();
  V.loco = (()=>{ const p = new Pix(36,22); p.rect(4,7,24,10,'#2a2a34'); p.rect(4,7,24,1,'#4a4a58'); p.rect(20,2,10,15,'#8a2a2a'); p.rect(22,4,6,4,'#f0d880'); p.rect(6,0,4,7,'#1e1e24'); p.rect(0,15,4,3,'#6a6a78'); p.rect(2,17,32,1,'#1e1e24');
    [8,15,24,30].forEach(x=>{ p.ellipse(x,18.5,2.8,2.8,'#1e1e24'); p.set(x,18,'#c83a3a'); }); p.rect(1,10,2,2,'#fff4c0'); return p.outline().done(); })();
  V.carriage = ['#3a5a3a','#6a3a2a'].map(col=>{ const p = new Pix(32,20); p.rect(1,4,30,11,col); p.rect(1,3,30,2,'#3a3a44'); for (let x=4;x<28;x+=6) p.rect(x,7,4,4,'#f0e0a0'); p.rect(1,15,30,1,'#1e1e24'); [6,26].forEach(x=>{ p.ellipse(x,16.5,2.6,2.6,'#1e1e24'); p.set(x,16,'#8a8a94'); }); return p.outline().done(); });
  V.plane = (()=>{ const p = new Pix(40,18); p.rect(4,7,32,5,'#dcdce4'); p.rect(4,7,32,1,'#f4f4f8'); p.ellipse(36,9.5,3,2.5,'#dcdce4'); p.rect(0,2,6,6,'#c83a3a'); p.rect(0,9,8,2,'#b8b8c4'); p.rect(14,9,14,3,'#a8a8b4'); p.rect(14,4,12,3,'#c8c8d4');
    for (let x=12;x<32;x+=4) p.rect(x,8,2,2,'#3a5a8a'); p.rect(38,8,2,3,'#3a3a44'); return p.outline().done(); })();
  // street lights
  const L = A.light = {};
  L.torch = (()=>{ const p = new Pix(8,22); p.ellipse(4,20.5,3,1,'#000000',60); p.rect(3,6,2,15,WOOD_R[2]); p.set(3,8,WOOD_R[4]); p.rect(2,4,4,3,'#4a3a2a'); p.rect(3,0,2,4,'#f8a030'); p.set(3,0,'#f8e070'); p.set(4,1,'#f8e070'); return p.outline().done(); })();
  L.lantern = (()=>{ const p = new Pix(10,24); p.ellipse(5,22.5,3.5,1.2,'#000000',60); p.rect(4,5,2,17,WOOD_R[2]); p.rect(4,4,5,1,WOOD_R[3]); p.rect(6,5,3,4,'#3a2a1e'); p.rect(7,6,1,2,'#f8c060'); return p.outline().done(); })();
  L.gas = (()=>{ const p = new Pix(10,28); p.ellipse(5,26.5,3.5,1.2,'#000000',60); p.rect(4,7,2,19,'#1e2a24'); p.rect(3,24,4,2,'#1e2a24'); p.rect(2,1,6,6,'#1e2a24'); p.rect(3,2,4,4,'#f4e4b0'); p.rect(3,0,4,1,'#1e2a24'); p.set(4,3,'#fff8e0'); return p.outline().done(); })();
  L.electric = (()=>{ const p = new Pix(16,36); p.ellipse(4,34.5,3.5,1.2,'#000000',60); p.rect(3,3,2,31,'#7a7a88'); p.set(3,4,'#9a9aa8'); p.rect(3,2,9,2,'#7a7a88'); p.rect(10,3,5,2,'#5a5a66'); p.rect(11,5,3,1,'#f0f4ff'); return p.outline().done(); })();
}
const CIV_LIGHT_ART = {torch_post:'torch', oil_lantern:'lantern', gas_lamp:'gas', electric_lamp:'electric'};
function civLightHead(s){ const k = CIV_LIGHT_ART[s.def], X = s.x*TILE, Y = s.y*TILE; return k==='torch' ? [X+7, Y-6, 2, 3] : k==='lantern' ? [X+9, Y-4, 1, 2] : k==='gas' ? [X+6, Y-10, 4, 4] : [X+11, Y-17, 3, 1]; }
// light posts stand on their tile like a prop
function civLightEnts(push){ civTransportArt(); civLamps().forEach(s=>{ const k = CIV_LIGHT_ART[s.def], img = ART.civ.light[k]; const x = s.x*TILE + 8 - img.width/2, y = s.y*TILE + 14 - img.height; push(img, x, y, s.y*TILE+14, 'light:'+k); }); }
function civLightPoints(){ return civLamps().map(s=>{ const D = STRUCTURES[s.def], [hx, hy, hw, hh] = civLightHead(s); return {x:hx+hw/2, y:hy+hh/2, r:D.light.r, kind:D.light.kind, s}; }); }
// bright lamp heads, drawn over the darkness
function civLampHeads(g){ civLamps().forEach(s=>{ const [x,y,w,h] = civLightHead(s), k = CIV_LIGHT_ART[s.def]; g.fillStyle = k==='torch' ? (Math.floor(performance.now()/150+s.x)%2 ? '#ffd060' : '#ff9a30') : k==='electric' ? '#ffffff' : '#fff0c0'; g.fillRect(x, y, w, h); }); }
// vehicles in the 2D scene, depth-sorted with everything else
function civVehicleEnts(ents, inView){
  civTransportArt();
  VEHICLES.forEach(v=>{ if (!civVehShown(v)) return;
    if (v.kind==='train'){ if (civTrainParts(v).length && inView(v.x-140, v.y-30, 280, 40)) ents.push({veh:v, key:v.y+6}); return; }
    if (v.kind==='plane'){ ents.push({veh:v, key:1e9}); return; }
    if (inView(v.x-30, v.y-40, 60, 50)) ents.push({veh:v, key:v.y+6}); });
}
function civDrawVehicle(g, v, ts){
  const V = ART.civ.veh, X = Math.round(v.x), Y = Math.round(v.y), bob = Math.sin(ts/500 + v.phase);
  const draw = (img, dx, dy, flip) => { g.save(); g.translate(X, Y); if (flip) g.scale(-1, 1); g.drawImage(img, dx, dy); g.restore(); };
  const shadow = (w) => { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(X - w/2, Y + 3, w, 2); };
  const left = v.face < 0, frame = Math.floor(ts/160 + v.phase)%2;
  switch (v.kind){
    case 'horse': shadow(20); draw(V.horse[frame], -Math.round(V.horse[0].width/2), -V.horse[0].height+4, left); break;
    case 'cart': shadow(14); draw(V.cart, -9, -10, left); break;
    case 'wagon': shadow(40); draw(V.wagon[frame], -Math.round(V.wagon[0].width/2), -V.wagon[0].height+5, left); break;
    case 'boat': draw(V.boat, -13, -14 + Math.round(bob), left); break;
    case 'ship': draw(V.ship[frame], -22, -36 + Math.round(bob), left); break;
    case 'steamship': draw(V.steamship, -24, -26 + Math.round(bob*0.6), left); if (Math.random() < 0.3) particles.push({x:X, y:Y-24, vx:left?4:-4, vy:-7, life:2.2, max:2.2, col:'#9a9aa8', a:0.5, w:2}); break;
    case 'car': shadow(20); draw(V.car[v.variant], -12, -10, left); break;
    case 'truck': shadow(28); draw(V.truck, -16, -14, left); break;
    case 'train': { const dir = v.dir||1, parts = civTrainParts(v); // the engine's art faces left, so it is flipped to run right
      parts.slice().reverse().forEach(p=>{ g.save(); g.translate(Math.round(p.x), Y); if (p.loco && dir > 0) g.scale(-1, 1); if (p.loco) g.drawImage(V.loco, -18, -19); else g.drawImage(V.carriage[p.car%2], -16, -17); g.restore(); });
      if (!v.wait && parts.some(p=>p.loco) && Math.random() < 0.4) particles.push({x:X + dir*10, y:Y-22, vx:-dir*6, vy:-10, life:2.5, max:2.5, col:'#c8c8d0', a:0.55, w:3}); break; }
    case 'plane': { const alt = 70; g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(X-14, Y+4, 28, 3); draw(V.plane, -20, -alt-9, left); break; }
  }
}
// rails drawn into the ground layer
function civRailGround(g){
  civHas('station').forEach(s=>{ const T0 = s.meta.track; if (!T0) return; const Y = T0.y*TILE;
    for (let x=T0.x0; x<=T0.x1; x++){ const X = x*TILE; g.fillStyle = WOOD_R[1]; for (let k=1;k<16;k+=4) g.fillRect(X+k, Y+2, 2, 12); g.fillStyle = '#8a8a98'; g.fillRect(X, Y+4, 16, 2); g.fillRect(X, Y+10, 16, 2); g.fillStyle = '#b8b8c8'; g.fillRect(X, Y+4, 16, 1); g.fillRect(X, Y+10, 16, 1); } });
}
// headlights and lamps for the lighting pass
function civTransportLights(L, inV){
  civLightPoints().forEach(p=>{ if (inV(p.x, p.y, p.r)) L.push([p.x, p.y, p.r, 1, CIV_LIGHT_COL[p.kind]]); });
  VEHICLES.forEach(v=>{ if (!civVehShown(v)) return;
    if (v.kind==='car' || v.kind==='truck'){ const x = v.x + (v.dx||v.face)*14, y = v.y + (v.dy||0)*10 - 4; if (inV(x, y, 30)) L.push([x, y, 26, 0.8, 'rgba(255,240,190,0.3)']); }
    if (v.kind==='train'){ const x = v.x + (v.dir||1)*20, y = v.y - 8; if (civTrainParts(v).some(p=>p.loco) && inV(x, y, 40)) L.push([x, y, 38, 0.9, 'rgba(255,240,190,0.32)']); }
    if (v.kind==='steamship' || v.kind==='ship'){ if (inV(v.x, v.y-10, 30)) L.push([v.x, v.y-10, 24, 0.7, 'rgba(255,200,120,0.28)']); } });
}

// ---------- 3D ----------
const CIV_LIGHT_H = {torch:1.25, lantern:1.45, gas:1.85, electric:2.5};
function civLightMesh(kind){
  const g = lpG(), P = [];
  R3.lightMats = R3.lightMats || {};
  if (kind==='torch') P.push(lpPart(g.cyl, '#6e4a2c', [0,0.55,0], [0,0,0], [0.05,1.1,0.05]), lpPart(g.cyl, '#3a2a1e', [0,1.12,0], [0,0,0], [0.08,0.12,0.08]));
  else if (kind==='lantern') P.push(lpPart(g.box, '#6e4a2c', [0,0.7,0], [0,0,0], [0.08,1.4,0.08]), lpPart(g.box, '#6e4a2c', [0.14,1.38,0], [0,0,0], [0.34,0.05,0.05]), lpPart(g.box, '#3a2a1e', [0.26,1.26,0], [0,0,0], [0.14,0.03,0.14]));
  else if (kind==='gas') P.push(lpPart(g.cyl, '#1e2a24', [0,0.85,0], [0,0,0], [0.05,1.7,0.05]), lpPart(g.cyl, '#1e2a24', [0,0.08,0], [0,0,0], [0.1,0.16,0.1]), lpPart(g.cone, '#1e2a24', [0,1.98,0], [0,Math.PI/4,0], [0.18,0.14,0.18]));
  else P.push(lpPart(g.cyl, '#7a7a88', [0,1.25,0], [0,0,0], [0.05,2.5,0.05]), lpPart(g.box, '#7a7a88', [0.3,2.48,0], [0,0,0], [0.62,0.05,0.06]), lpPart(g.box, '#5a5a66', [0.56,2.44,0], [0,0,0], [0.22,0.06,0.12]));
  let geo = LP.cache.get('light:'+kind); if (!geo){ geo = lpMerge(P); LP.cache.set('light:'+kind, geo); }
  const m = new THREE.Mesh(geo, lpMat()); m.userData.shared = true; m.castShadow = true;
  const mat = R3.lightMats[kind] || (R3.lightMats[kind] = new THREE.MeshBasicMaterial({color:CIV_LIGHT_HEX[kind]}));
  const head = kind==='torch' ? new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 6), mat) : new THREE.Mesh(new THREE.BoxGeometry(kind==='electric'?0.16:0.12, kind==='electric'?0.03:0.16, kind==='electric'?0.08:0.12), mat);
  head.position.set(kind==='lantern' ? 0.26 : kind==='electric' ? 0.56 : 0, kind==='torch' ? 1.3 : kind==='lantern' ? 1.15 : kind==='gas' ? 1.85 : 2.4, 0); m.add(head);
  if (kind==='torch') m.userData.flame = [head];
  return m;
}
// where the lamps are in world space, for the glow sprites and the real point lights
function r3CivLamps(){ return civLamps().map(s=>{ const k = STRUCTURES[s.def].light.kind; return {x:s.x+0.5 + (k==='lantern'?0.26:k==='electric'?0.56:0), z:s.y+0.575, h:CIV_LIGHT_H[k], kind:k}; }); }
function r3LightDaylight(dark){ const on = dark > 0.08; for (const k in (R3.lightMats||{})) R3.lightMats[k].color.set(on ? CIV_LIGHT_HEX[k] : k==='torch' ? 0xff8a30 : 0x8a8a80); }
function r3VehMesh(v){
  const g = lpG(), P = [], grp = new THREE.Group(), CAR = ['#c83a3a','#3a6ac8','#3a8a4a','#2a2a30','#e8d8a8'];
  const add = (parts, key) => { let geo = key && LP.cache.get('veh:'+key); if (!geo){ geo = lpMerge(parts); if (key) LP.cache.set('veh:'+key, geo); } const m = new THREE.Mesh(geo, lpMat()); m.castShadow = true; m.receiveShadow = true; if (key) m.userData.shared = true; grp.add(m); return m; };
  const wheel = (x, z, r) => lpPart(g.cyl, '#1e1e24', [x, r, z], [Math.PI/2,0,0], [r, 0.1, r]);
  const lamp = (x, y, z, col) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.1), new THREE.MeshBasicMaterial({color:col||0xfff0b0})); m.position.set(x, y, z); grp.add(m); return m; };
  const horse = (x) => { const h = an3Build('horse', 0); h.rotation.y = Math.PI/2; h.position.x = x; grp.add(h); grp.userData.horse = h; };
  switch (v.kind){
    case 'horse': horse(0); add([lpPart(g.box, '#3a5a8a', [-0.05,1.05,0], [0,0,0], [0.22,0.36,0.24]), lpPart(g.sph, '#e0b890', [-0.05,1.34,0], [0,0,0], [0.1,0.11,0.1]), lpPart(g.cyl, '#5a3a22', [-0.05,1.43,0], [0,0,0], [0.12,0.05,0.12]), lpPart(g.box, '#2a2a30', [-0.05,0.86,0.12], [0,0,0], [0.08,0.26,0.07]), lpPart(g.box, '#2a2a30', [-0.05,0.86,-0.12], [0,0,0], [0.08,0.26,0.07])], 'rider'); break;
    case 'cart': add([lpPart(g.box, '#8a6038', [0,0.4,0], [0,0,0], [0.8,0.08,0.55]), lpPart(g.box, '#6e4a2c', [0,0.52,0.26], [0,0,0], [0.8,0.2,0.04]), lpPart(g.box, '#6e4a2c', [0,0.52,-0.26], [0,0,0], [0.8,0.2,0.04]), lpPart(g.tor, '#4a3222', [0,0.25,0.32], [0,0,0], [0.24,0.24,0.24]), lpPart(g.tor, '#4a3222', [0,0.25,-0.32], [0,0,0], [0.24,0.24,0.24]), lpPart(g.cyl, '#6e4a2c', [0.6,0.45,0.18], [0,0,Math.PI/2+0.2], [0.03,0.5,0.03]), lpPart(g.cyl, '#6e4a2c', [0.6,0.45,-0.18], [0,0,Math.PI/2+0.2], [0.03,0.5,0.03]), lpPart(g.ico, '#c8b080', [-0.1,0.58,0], [0,0,0], [0.2,0.16,0.18])], 'cart'); break;
    case 'wagon': horse(0.95); add([lpPart(g.box, '#6e4a2c', [-0.35,0.55,0], [0,0,0], [1.5,0.12,0.8]), lpPart(g.cyl, '#ece6d4', [-0.35,0.72,0], [0,0,Math.PI/2], [0.42,1.4,0.42]), lpPart(g.box, '#6e4a2c', [-0.35,0.7,0], [0,0,0], [1.45,0.3,0.84]), wheel(0.2,0.44,0.3), wheel(0.2,-0.44,0.3), wheel(-0.9,0.44,0.3), wheel(-0.9,-0.44,0.3), lpPart(g.box, '#5a3a22', [0.5,0.5,0], [0,0,0], [0.5,0.05,0.05])], 'wagon'); break;
    case 'boat': add([lpPart(g.box, '#8a5a34', [0,0.05,0], [0,0,0], [1.2,0.22,0.5]), lpPart(g.cone, '#8a5a34', [0.72,0.05,0], [0,0,-Math.PI/2], [0.25,0.3,0.25]), lpPart(g.box, '#8a3a2a', [0,0.3,0], [0,0,0], [0.18,0.3,0.2]), lpPart(g.sph, '#e0b890', [0,0.52,0], [0,0,0], [0.09,0.1,0.09]), lpPart(g.cyl, '#6e4a2c', [0,0.2,0], [0.5,0,0], [0.02,1.3,0.02])], 'boat'); break;
    case 'ship': add([lpPart(g.box, '#6a4428', [0,0.2,0], [0,0,0], [2.6,0.5,0.9]), lpPart(g.cone, '#6a4428', [1.55,0.2,0], [0,0,-Math.PI/2], [0.45,0.6,0.45]), lpPart(g.box, '#e8c84a', [0,0.44,0], [0,0,0], [2.62,0.05,0.92]), lpPart(g.cyl, '#5a3a22', [0.2,1.7,0], [0,0,0], [0.06,2.8,0.06]), lpPart(g.box, '#f4f0e6', [0.2,1.8,0], [0,0,0], [0.05,1.6,1.6]), lpPart(g.box, '#f4f0e6', [-0.8,1.3,0], [0,0,0], [0.05,1.1,1.1]), lpPart(g.cyl, '#5a3a22', [-0.8,1.2,0], [0,0,0], [0.05,1.8,0.05]), lpPart(g.box, '#c83a3a', [0.2,3.15,0.12], [0,0,0], [0.02,0.18,0.3])], 'ship'); break;
    case 'steamship': add([lpPart(g.box, '#2a2a34', [0,0.25,0], [0,0,0], [3.2,0.6,1.0]), lpPart(g.cone, '#2a2a34', [1.9,0.25,0], [0,0,-Math.PI/2], [0.5,0.6,0.5]), lpPart(g.box, '#a83030', [0,0.02,0], [0,0,0], [3.22,0.12,1.02]), lpPart(g.box, '#e8e4dc', [-0.2,0.8,0], [0,0,0], [1.8,0.5,0.8]), lpPart(g.cyl, '#1e1e24', [0.1,1.45,0], [0,0,0], [0.18,0.9,0.18]), lpPart(g.cyl, '#c83a3a', [0.1,1.6,0], [0,0,0], [0.19,0.18,0.19])], 'steam'); break;
    case 'car': add([lpPart(g.box, CAR[v.variant], [0,0.3,0], [0,0,0], [1.1,0.28,0.55]), lpPart(g.box, CAR[v.variant], [-0.08,0.55,0], [0,0,0], [0.6,0.24,0.5]), lpPart(g.box, '#a8d0f0', [0.24,0.55,0], [0,0,0.4], [0.02,0.2,0.46]), wheel(0.34,0.28,0.14), wheel(0.34,-0.28,0.14), wheel(-0.34,0.28,0.14), wheel(-0.34,-0.28,0.14)], 'car'+v.variant); grp.userData.lamps = [lamp(0.56,0.32,0.18), lamp(0.56,0.32,-0.18)]; break;
    case 'truck': add([lpPart(g.box, '#6a7a4a', [-0.3,0.55,0], [0,0,0], [1.3,0.7,0.7]), lpPart(g.box, '#c8a030', [0.6,0.5,0], [0,0,0], [0.5,0.6,0.64]), lpPart(g.box, '#a8d0f0', [0.86,0.62,0], [0,0,0], [0.02,0.2,0.5]), wheel(0.6,0.34,0.16), wheel(0.6,-0.34,0.16), wheel(-0.6,0.34,0.16), wheel(-0.6,-0.34,0.16)], 'truck'); grp.userData.lamps = [lamp(0.86,0.35,0.22), lamp(0.86,0.35,-0.22)]; break;
    case 'train': {
      add([lpPart(g.cyl, '#2a2a34', [0,0.62,0], [0,0,Math.PI/2], [0.34,1.3,0.34]), lpPart(g.box, '#8a2a2a', [-0.55,0.75,0], [0,0,0], [0.55,0.8,0.7]), lpPart(g.box, '#1e1e24', [-0.55,1.18,0], [0,0,0], [0.62,0.06,0.76]), lpPart(g.cyl, '#1e1e24', [0.4,1.1,0], [0,0,0], [0.1,0.4,0.1]), lpPart(g.box, '#3a3a44', [0,0.22,0], [0,0,0], [1.5,0.12,0.6]), wheel(0.45,0.3,0.2), wheel(0.45,-0.3,0.2), wheel(-0.1,0.3,0.2), wheel(-0.1,-0.3,0.2), wheel(-0.55,0.3,0.2), wheel(-0.55,-0.3,0.2)], 'loco');
      grp.userData.lamps = [lamp(0.72,0.7,0)];
      const car = (col, key) => { const cg = new THREE.Group(); const m = new THREE.Mesh(LP.cache.get('veh:'+key) || (()=>{ const geo = lpMerge([lpPart(g.box, col, [0,0.62,0], [0,0,0], [1.8,0.7,0.72]), lpPart(g.box, '#3a3a44', [0,1.0,0], [0,0,0], [1.85,0.06,0.78]), lpPart(g.box, '#f0e0a0', [0,0.72,0.37], [0,0,0], [1.5,0.2,0.01]), lpPart(g.box, '#f0e0a0', [0,0.72,-0.37], [0,0,0], [1.5,0.2,0.01]), wheel(0.6,0.3,0.16), wheel(0.6,-0.3,0.16), wheel(-0.6,0.3,0.16), wheel(-0.6,-0.3,0.16)]); LP.cache.set('veh:'+key, geo); return geo; })(), lpMat()); m.userData.shared = true; m.castShadow = true; cg.add(m); return cg; };
      grp.userData.cars = [car('#3a5a3a','carA'), car('#6a3a2a','carB'), car('#3a5a3a','carA')]; if (R3.scene) grp.userData.cars.forEach(c=>R3.scene.add(c));
      break; }
    case 'plane': add([lpPart(g.cyl, '#dcdce4', [0,0,0], [0,0,Math.PI/2], [0.28,2.4,0.28]), lpPart(g.cone, '#dcdce4', [1.35,0,0], [0,0,-Math.PI/2], [0.28,0.3,0.28]), lpPart(g.cone, '#dcdce4', [-1.4,0.05,0], [0,0,Math.PI/2], [0.28,0.5,0.28]), lpPart(g.box, '#c8c8d4', [0.1,-0.05,0], [0,0,0], [0.55,0.05,3.0]), lpPart(g.box, '#c83a3a', [-1.4,0.4,0], [0,0,0], [0.35,0.6,0.04]), lpPart(g.box, '#c8c8d4', [-1.45,0.1,0], [0,0,0], [0.3,0.04,1.0]), lpPart(g.cyl, '#3a3a44', [1.52,0,0], [0,0,Math.PI/2], [0.05,0.06,0.05])], 'plane');
      grp.userData.blink = [lamp(0.1,-0.05,1.5,0xff3030), lamp(0.1,-0.05,-1.5,0x30ff60)]; break;
  }
  grp.userData.kind = v.kind; return grp;
}
function r3Vehicles(ts, dark){
  R3.veh = R3.veh || new Map(); const seen = new Set(), tx = cam.x/TILE, tz = cam.y/TILE;
  VEHICLES.forEach(v=>{
    let g = R3.veh.get(v.id);
    const X = v.x/16, Z = v.y/16;
    if (!civVehShown(v) || Math.abs(X-tx) > 80 || Math.abs(Z-tz) > 80){ if (g){ g.visible = false; (g.userData.cars||[]).forEach(c=>c.visible = false); } seen.add(v.id); return; }
    if (!g || g.userData.kind!==v.kind){ if (g) r3VehDispose(g); g = r3VehMesh(v); R3.scene.add(g); R3.veh.set(v.id, g); }
    seen.add(v.id); g.visible = true;
    const water = v.kind==='boat' || v.kind==='ship' || v.kind==='steamship', bob = water ? Math.sin(ts/600 + v.phase)*0.04 - 0.12 : 0;
    const want = -Math.atan2(v.dy||0, v.dx||v.face||1); let d = want - g.rotation.y; while (d > Math.PI) d -= Math.PI*2; while (d < -Math.PI) d += Math.PI*2; g.rotation.y += d*0.2;
    if (v.kind==='plane'){ g.position.set(X, 9 + Math.sin(ts/2000 + v.phase)*0.3, Z); g.rotation.y = v.face < 0 ? Math.PI : 0; g.rotation.x = Math.sin(ts/1500)*0.05; (g.userData.blink||[]).forEach(b=>b.visible = Math.floor(ts/500)%2===0); }
    else if (v.kind==='train'){ const dir = v.dir||1, parts = civTrainParts(v); g.rotation.y = dir < 0 ? Math.PI : 0; g.position.set(X, 0, Z); g.visible = parts.some(p=>p.loco);
      (g.userData.cars||[]).forEach((c,i)=>{ const p = parts.find(q=>q.car===i+1); c.visible = !!p; if (p){ c.position.set(p.x/16, 0, Z); c.rotation.y = g.rotation.y; } }); }
    else g.position.set(X, bob, Z);
    if (g.userData.horse){ const U = g.userData.horse.userData, moving = !v.wait && v.tx!==null, ph = ts/140 + U.phase; U.legs.forEach((l,i)=>{ l.rotation.x = moving ? Math.sin(ph + (i%2?Math.PI:0) + (i>1?Math.PI/2:0))*0.5 : 0; }); }
    (g.userData.lamps||[]).forEach(l=>{ l.material.color.set(dark > 0.08 ? 0xfff4c0 : 0x8a8a80); });
  });
  for (const [id, g] of R3.veh) if (!seen.has(id)){ r3VehDispose(g); R3.veh.delete(id); }
}
function r3VehDispose(g){ (g.userData.cars||[]).forEach(c=>R3.scene.remove(c)); if (g.userData.horse) lpDispose(g.userData.horse); lpDispose(g); }

// ---------- panel ----------
function civTransportHtml(){
  const C = S.civ, lamps = civLamps(), by = {}; lamps.forEach(s=>{ by[s.def] = (by[s.def]||0) + 1; });
  const best = civBestLight(), next = CIV_LIGHT_KINDS.find(k=>!civLightOK(k) && (!best || CIV_LIGHT_KINDS.indexOf(k) > CIV_LIGHT_KINDS.indexOf(best)));
  const lightLine = CIV_LIGHT_KINDS.filter(k=>by[k]).map(k=>`<span class="chip">${esc(STRUCTURES[k].label)} ×${by[k]}</span>`).join('') || '<span class="muted">no street lights yet</span>';
  const vrows = Object.entries(CIV_VEHICLES).map(([k,V])=>{ const need = civVehicleNeeds(k), n = VEHICLES.filter(v=>v.kind===k).length; return `<div style="font-size:12px">${V.icon} ${need.length ? `<span class="muted">${esc(V.label)}: needs ${esc(need.join(', '))}</span>` : `<b>${esc(V.label)}</b>${n?` <span class="muted">· ${n} about town</span>`:''}`}</div>`; }).join('');
  const infra = ['stable','boathouse','shipyard','station','power_plant','airfield'].map(d=>{ const h = civHas(d), p = civProjects().find(x=>x.def===d); return h.length ? `<span class="chip">✅ <a ${locAttr(h[0].x,h[0].y,h[0].w,h[0].h,h[0].name)}>${esc(STRUCTURES[d].label)}</a></span>` : p ? `<span class="chip">🏗️ ${esc(STRUCTURES[d].label)} ${Math.round(p.done/p.labor*100)}%</span>` : ''; }).join('');
  return `<div class="card"><b>Street lighting</b> <span class="muted" style="font-size:12px">· ${esc(C.stageLabel||'Camp')}</span><div style="margin-top:4px">${lightLine}</div>
    <div class="muted" style="font-size:12px;margin-top:4px">${best ? `New lights are ${esc(STRUCTURES[best].label.toLowerCase())}s.` : 'Too few people to light the streets yet.'}${next ? ` Next: ${esc(STRUCTURES[next].label.toLowerCase())}s need ${esc(civLightNeeds(next).join(', '))}.` : ''} Lit streets help witnesses see crimes at night.</div></div>
    <div class="card"><b>Transport</b>${infra ? `<div style="margin:4px 0">${infra}</div>` : ''}${vrows}<div class="muted" style="font-size:12px;margin-top:4px">Journeys go ${Math.round((civTravelSpeed()-1)*100)}% faster; caravans carry ${civHaulBonus()} more kinds of goods.</div></div>`;
}
