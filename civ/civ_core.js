/* =====================================================================
   Pixel Town — civilization mode: core
   The mode flag, the wild world, people and households, structures and land,
   the time tiers (minute / hour / day / week / month) and moving agents.
   A new game starts here: 100 people, crude huts, a small food cache, nothing else.
   ===================================================================== */
let CIV = false, CIV_SEED = 20260926;
const CIVQ = (()=>{ try { return new URLSearchParams(location.search); } catch(e){ return new URLSearchParams(''); } })();
function civClassicRequested(){ return /classic/i.test(CIVQ.get('mode')||''); }
function civSeedRequested(){ const s = parseInt(CIVQ.get('seed')||'', 10); return Number.isFinite(s) ? s : null; }
const C_ = () => S.civ;
const civOf = c => c.civ;
const tkey = (x,y) => y*4096 + x;
const civDay = () => dayOf(S.minute);
function crand(tag){ return mapRand(hash(tag + ':' + (S ? S.civ.seed : CIV_SEED))); }
function ev(name, n){ const st = S.civ.stats; st[name] = (st[name]||0) + (n==null?1:n); }

// ---------- the wild world ----------
// buildMap() lays down river, lake, hills and forest; in civ mode it stops there and this adds seeded variety:
// denser or thinner woods, meadows, outcrops, a pond, and one shallow ford across the river.
let FORDS = new Set(), CIV_CENTER = [26,20];
function civWildTerrain(set, get){
  const r = mapRand(CIV_SEED ^ 0x5eed5), s = CIV_SEED & 0xffff;
  const dens = 0.16 + r()*0.24, ox = Math.floor(r()*200), oy = Math.floor(r()*200);
  for (let y=0;y<OH;y++) for (let x=0;x<OLD_W;x++){
    if (get(x,y)!==T.GRASS) continue;
    const n = hashf((x+ox)>>2,(y+oy)>>2,s)*0.65 + hashf(x,y,s+3)*0.35;
    if (n > 1-dens) set(x,y,T.TREE); else if (n < 0.07) set(x,y,T.FLOWER);
  }
  // outcrops on the west bank: stone for the first builders
  const outN = 1 + Math.floor(r()*3);
  for (let k=0;k<outN;k++){ const cx = 3+Math.floor(r()*38), cy = 2+Math.floor(r()*44), rad = 1.6+r()*2.2;
    for (let y=cy-4;y<=cy+4;y++) for (let x=cx-4;x<=cx+4;x++){ if (get(x,y)===T.GRASS||get(x,y)===T.TREE||get(x,y)===T.FLOWER){ if (Math.hypot(x-cx,(y-cy)*1.3) + hashf(x,y,s+9)*1.2 < rad) set(x,y,T.ROCK); } } }
  // a pond somewhere on the west bank for some seeds
  if (r()<0.6){ const px = 6+Math.floor(r()*30), py = 4+Math.floor(r()*26);
    for (let y=py-3;y<=py+3;y++) for (let x=px-4;x<=px+4;x++){ const d=((x-px)/3.4)**2+((y-py)/2.2)**2; if (d<=1) set(x,y,T.WATER); else if (d<=1.5 && get(x,y)!==T.WATER) set(x,y,T.SAND); } }
  // the settlement meadow: people camped by the river, where the grass is open
  const cx = 18 + Math.floor(r()*18), cy = 10 + Math.floor(r()*20); CIV_CENTER = [cx, cy];
  for (let y=cy-9;y<=cy+9;y++) for (let x=cx-11;x<=cx+11;x++){ const t = get(x,y); if (t!==T.TREE && t!==T.ROCK) continue; const d = Math.hypot((x-cx)/11,(y-cy)/9); if (d < 0.78 || (d<1 && hashf(x,y,s+11)<0.6)) set(x,y, hashf(x,y,s+12)<0.08 ? T.FLOWER : T.GRASS); }
  // one ford where the river runs shallow; impassable in spring floods and storms
  FORDS = new Set(); const fy = 5 + Math.floor(r()*28), fx = riverX(fy);
  for (let x=fx-2;x<=fx+2;x++) if (get(x,fy)===T.WATER) FORDS.add(tkey(x,fy));
  BRIDGE_TILES = []; DOCK_TILES = []; RAIL_TILES = []; LAMPS = []; PLOTS = [];
  WATER_TILES=[]; for (let y=0;y<OH;y++) for (let x=0;x<OW;x++) if (MAP[y][x]===T.WATER) WATER_TILES.push([x,y]);
  PUDDLES=[]; GRAVE_SLOTS=[];
}
function civFordOk(x,y){ if (!FORDS.has(tkey(x,y))) return false; const d = civDay(); const flood = seasonOf(d)===0 && d%28<12; return !flood && S.weather!=='Storm'; }
function civSetTile(x,y,t){ if (tileAt(x,y)===-1) return; MAP[y][x] = t; S.civ.edits[tkey(x,y)] = t; S.civ.dirtyGround = true; }
function civGroundDirty(){ if (S.civ.dirtyGround){ S.civ.dirtyGround = false; bumpWorld(); } }

// ---------- locations: the commons, the food cache, and every structure ----------
function civResetLocations(){
  BUILDINGS.length = 0; for (const k in LOC) delete LOC[k]; for (const k in SPOTS) delete SPOTS[k]; for (const k in ART.bld) delete ART.bld[k];
  const [cx, cy] = CIV_CENTER;
  LOC.loc_town_square = {id:'loc_town_square', name:'the commons', indoor:false, rects:[[cx-3,cy-2,cx+3,cy+2]]};
  LOC.civ_cache = {id:'civ_cache', name:'the supply cache', indoor:false, rects:[[cx+4,cy-1,cx+5,cy+1]]};
  LOC.civ_edge = {id:'civ_edge', name:'the western trail', indoor:false, rects:[[0,cy-1,1,cy+1]]};
  STALLS.length = 0; WELL[0] = FOUNTAIN[0] = -99; WELL[1] = FOUNTAIN[1] = -99;
}

// ---------- people ----------
function civCogProfile(r){
  // every mind has strengths and blind spots: attributes are drawn separately, then no one is allowed to be good at everything
  const g = {}; COG.forEach(k=>{ g[k] = clamp(0.2 + r()*0.6 + (r()-0.5)*0.25, 0.05, 0.97); });
  const mean = COG.reduce((a,k)=>a+g[k],0)/COG.length;
  if (mean > 0.6){ const ks = COG.slice().sort(()=>r()-0.5).slice(0,4); ks.forEach(k=>g[k] = clamp(g[k]-0.3-r()*0.2, 0.05, 0.97)); }
  COG.forEach(k=>g[k] = +g[k].toFixed(2)); return g;
}
const EYES = ['#3a2a1a','#5a3a1a','#4a2a1a','#4a6a8a','#6a8aa8','#5a7a4a','#3a5a3a','#7a6a3a','#8a7a5a','#a0782a','#6a6a7a','#2a2a2a'];
function civGenes(r, p1, p2){
  // procedural genetics: each child mixes both parents with a little mutation
  const pick2 = (a,b) => r()<0.5 ? a : b, blend = (a,b,sd) => clamp((a+b)/2 + (r()-0.5)*sd, 0, 1);
  if (p1 && p2) return {skin: r()<0.15 ? SKINS[clamp(Math.round((SKINS.indexOf(p1.skin)+SKINS.indexOf(p2.skin))/2),0,SKINS.length-1)] : pick2(p1.skin,p2.skin),
    hair: pick2(p1.hair,p2.hair), eye: pick2(p1.eye,p2.eye), height: blend(p1.height,p2.height,0.3), build: blend(p1.build,p2.build,0.3),
    jaw: blend(p1.jaw,p2.jaw,0.4), nose: blend(p1.nose,p2.nose,0.4), brow: blend(p1.brow,p2.brow,0.4), style: pick2(p1.style,p2.style)};
  const skin = SKINS[Math.floor(r()*SKINS.length)];
  return {skin, hair: HAIRS[Math.floor(r()*HAIR_NATURAL)], eye: EYES[Math.floor(r()*EYES.length)], height: +r().toFixed(2), build: +r().toFixed(2),
    jaw: +r().toFixed(2), nose: +r().toFixed(2), brow: +r().toFixed(2), style: STYLES[Math.floor(r()*STYLES.length)]};
}
// crude clothing for a pre-industrial camp; it improves with weaving and wealth
// the clothing palette: raw hides, undyed linen, then a wide range of plant, mineral and insect dyes
const CLOTH = {
  hides:['#8a6a48','#7a5a3a','#9a7a52','#6a4a30','#a88a60','#5a4028'],
  linen:['#c8b890','#b8a878','#a89868','#d8c8a0','#e0d4b4','#c0b49a','#b0a488','#d0bc94'],
  dyed:['#4e8a3a','#6a8a3a','#3a6a8a','#2a4a7a','#8a3a3a','#a8482a','#8a6a2a','#c8962a','#5a4a7a','#7a3a6a','#3a7a6a','#2a6a5a','#b8784a','#6a7a8a','#9a4a5a','#4a5a2a','#d8b84a','#3a3a5a'],
  hidePants:['#5a4030','#4a3424','#6a4a34'], linenPants:['#6a5a44','#5a4a3a','#7a6a50','#4a4034'],
  pants:['#3a3a4a','#3a2a24','#4a3a2a','#2a3a4a','#4a4a3a','#5a3a2a','#2e2e36','#4a2e2a'],
  hideBoots:['#5a3a24','#4a3020','#6a4428'], boots:['#4a3024','#7a5030','#5a3a24','#3a2a20','#8a6040','#2a2220'],
  under:['#d8ceb0','#e8e0cc','#c8bc9c','#e0d4b8','#d0c8b8'], coats:['#3a3440','#4a2a2a','#2a3a4a','#3a4a3a','#5a4a3a','#2a2a30']};
function civLook(c){
  const G = c.civ.genes, age = c.age, female = genderOf(c)==='F', r = mapRand(hash(c.id+'lk'));
  const tier = civClothTier(c);
  const shirt = (tier===0 ? CLOTH.hides : tier===1 ? CLOTH.linen : CLOTH.dyed)[Math.floor(r()*(tier===0 ? CLOTH.hides.length : tier===1 ? CLOTH.linen.length : CLOTH.dyed.length))];
  const pantsSet = tier===0 ? CLOTH.hidePants : tier===1 ? CLOTH.linenPants : CLOTH.pants, bootSet = tier===0 ? CLOTH.hideBoots : CLOTH.boots;
  const pants = pantsSet[Math.floor(r()*pantsSet.length)], boots = bootSet[Math.floor(r()*bootSet.length)], under = CLOTH.under[Math.floor(r()*CLOTH.under.length)];
  const grey = age>=56 ? clamp((age-56)/14,0,1) : 0;
  const hair = grey>0.5 ? '#c8c8cc' : grey>0 ? mix(G.hair,'#c8c8cc',grey) : G.hair;
  const style = G.style==='bald' && (female || age<30) ? 'short' : G.style;
  const beard = !female && age>=18 && hash(c.id+'bd')%100 < 38;
  const occ = c.civ.occ && OCC[c.civ.occ];
  const hat = occ && ['woodcutter','miner','fisher','farmer'].includes(occ.id) && tier>=1 ? {woodcutter:'beanie',miner:'helmet',fisher:'bucket',farmer:'straw'}[occ.id] : null;
  const L = {skin:G.skin, hair, style, beard, shirt, pants, hat, hatCol:null,
    apron: occ && ['cook','toolmaker','healer'].includes(occ.id) && tier>=1 ? '#d8ceb0' : null, bib:false, stains:false, coat: tier>=3 && c.wallet>400 ? CLOTH.coats[Math.floor(r()*CLOTH.coats.length)] : null,
    trim: tier>=2 && r()<0.4, boots, under: tier===0 ? shade(shirt,1.25) : under, eye:G.eye};
  if (!isAdult(c)) Object.assign(L, {beard:false, hat:null, apron:null, coat:null});
  return L;
}
function civClothTier(c){ if (!S || !S.civ) return 1; const h = S.civ.hh[c.civ.hh], st = h ? h.store : {}; const w = c.civ.wealth||0; return (st.clothes>0 || w>600) ? (w>2500 ? 3 : 2) : (civTechKnown('weaving') || st.cloth>0) ? 1 : 0; }
function civRefreshLook(c){ const L = civLook(c); const k = JSON.stringify(L); if (c.civ.lookKey===k) return; c.civ.lookKey = k; c.look = L; delete ART.people[c.id]; if (typeof THUMBS!=='undefined') delete THUMBS[c.id]; }

// background knowledge: everyone knows something, nobody knows everything, and none of it is a job title
const BACKGROUNDS = [
  {k:{agriculture:30, foodcraft:15}, s:{farming:30, foraging:20}, t:['cultivation']},
  {k:{husbandry:28, wilderness:15}, s:{herding:30, hunting:15}, t:['domestication']},
  {k:{wilderness:32}, s:{hunting:32, foraging:22}, t:['fire_hardening']},
  {k:{wilderness:25, crafts:12}, s:{fishing:34, foraging:10}, t:['nets']},
  {k:{construction:28, crafts:12}, s:{construction:30, woodcutting:25}, t:['carpentry']},
  {k:{crafts:30, chemistry:6}, s:{crafting:32}, t:['pottery']},
  {k:{crafts:24}, s:{weaving:32}, t:['weaving']},
  {k:{foodcraft:30}, s:{cooking:34}, t:['smoking']},
  {k:{medicine:24, biology:12}, s:{medicine:26, foraging:18}, t:['herbal_remedies']},
  {k:{trade:30, geography:20, mathematics:10}, s:{trading:30, negotiation:22}, t:['counting']},
  {k:{literacy:26, history:22, teaching:18}, s:{teaching:24}, t:['counting']},
  {k:{geology:24, construction:10}, s:{stonework:28, geology:16}, t:[]},
  {k:{politics:22, law:14, history:10}, s:{leadership:26, negotiation:16}, t:[]},
  {k:{mathematics:22, astronomy:14, physics:8}, s:{mathematics:22, research:10}, t:['counting']},
  {k:{finance:18, trade:16}, s:{accounting:18, trading:18}, t:['counting']},
  {k:{wilderness:16, foodcraft:10}, s:{foraging:28, woodcutting:18}, t:[]}
];
function civStartMind(c, r, adult){
  const X = c.civ; X.cog = civCogProfile(r);
  const P = c.personality; X.cog.risk = +clamp(X.cog.risk*0.6 + (1-P.neuroticism)*0.4, 0.05, 0.97).toFixed(2);
  X.know = {}; X.skill = {}; X.techs = [];
  if (!adult){ if (c.age>=6){ X.know.wilderness = Math.floor(r()*8); X.skill.foraging = Math.floor(r()*10+c.age); } return; }
  const n = 1 + (r()<0.6?1:0) + (r()<0.25?1:0), pool = S && S.civ && S.civ.originBg;
  for (let i=0;i<n;i++){ const B = (pool && pool.length && r() < (i===0 ? 0.6 : 0.3)) ? BACKGROUNDS[pool[Math.floor(r()*pool.length)]] : BACKGROUNDS[Math.floor(r()*BACKGROUNDS.length)], depth = 0.5 + r()*0.9 + Math.min(0.5, (c.age-20)/80);
    for (const k in B.k) X.know[k] = Math.max(X.know[k]||0, Math.round(B.k[k]*depth));
    for (const k in B.s) X.skill[k] = Math.max(X.skill[k]||0, Math.round(B.s[k]*depth));
    B.t.forEach(t=>{ if ((r()<0.55+depth*0.2) && !X.techs.includes(t)) X.techs.push(t); }); }
  // everyday know-how everyone picked up somewhere
  ['foraging','woodcutting','fishing','construction','cooking'].forEach(s=>{ X.skill[s] = Math.max(X.skill[s]||0, Math.floor(r()*14)+4); });
  X.know.wilderness = Math.max(X.know.wilderness||0, 6+Math.floor(r()*10)); X.know.construction = Math.max(X.know.construction||0, Math.floor(r()*10));
  if (r()<0.3) X.know.literacy = Math.max(X.know.literacy||0, 5+Math.floor(r()*20));
}
function civPersonExt(c, r, genes){
  const P = c.personality;
  c.civ = {hh:null, cog:null, know:{}, skill:{}, techs:[], genes, body:{strength: +clamp(0.3+r()*0.5 + (genes.build-0.5)*0.3,0.05,1).toFixed(2), endurance:+(0.3+r()*0.6).toFixed(2), dexterity:+(0.3+r()*0.6).toFixed(2)},
    health:100, hurt:0, occ:null, tier:0, occSince:null, occHist:[], log:{}, logWk:[], buyers:{}, exp:{}, dec:[], goals:[], beliefs:{}, credit:{score:50, repaid:0, late:0, defaulted:0},
    style:null, mentor:null, prot:[], employer:null, job:null, wealth:0, respect: 0, lastTalk:0, lookKey:''};
  c.civ.style = P.neuroticism>0.6 ? 'conservative' : P.openness>0.65 && c.civ.body ? (r()<0.5?'growth':'speculator') : r()<0.5 ? 'value' : 'conservative';
  return c.civ;
}
function civMakePerson(o, r){
  const genes = o.genes || civGenes(r, o.pg1, o.pg2);
  const first = o.first, name = `${first} ${o.sur}`;
  const traits = randomTraits(r, 2+(r()<0.4?1:0));
  const values = [], ov = S && S.civ && S.civ.originValues; if (ov && ov.length && r()<0.55) values.push(ov[Math.floor(r()*ov.length)]);
  while (values.length<2){ const v = VALUES[Math.floor(r()*VALUES.length)]; if (!values.includes(v)) values.push(v); }
  const d = {id: uniqueId('cit_'+name.toLowerCase().replace(/[^a-z]+/g,'_')), name, age:o.age, prof: o.age<16 ? 'Child' : 'Settler', home:o.home||'loc_town_square', traits, values,
    p:[r(),r(),r(),r(),r()].map(v=>+(0.12+v*0.76).toFixed(2)), pol:[+(r()*2-1).toFixed(2), +(r()*2-1).toFixed(2), +(0.1+r()*0.8).toFixed(2)],
    wallet:0, bio:o.bio||'', parents:o.parents||[], look:null};
  const c = makeCitizen(d); c.work = null; c.tool = 0; c.gender = o.gender; c.orient = o.orient || null; CBY[c.id] = c;
  civPersonExt(c, r, genes); civStartMind(c, r, o.age>=16);
  c.look = civLook(c); c.civ.lookKey = JSON.stringify(c.look);
  return c;
}

// ---------- households: who shares a roof, a larder and a fire ----------
function civNewHH(name, home){ const C = S.civ, id = 'hh_'+(++C.hhSeq); C.hh[id] = {id, name, members:[], home: home||null, store:{}, founded:civDay()}; return C.hh[id]; }
function civJoinHH(c, h){ const old = c.civ.hh && S.civ.hh[c.civ.hh]; if (old){ old.members = old.members.filter(x=>x!==c.id); if (!old.members.length) civDissolveHH(old, h); } c.civ.hh = h.id; if (!h.members.includes(c.id)) h.members.push(c.id); c.home = h.home || 'loc_town_square'; }
function civDissolveHH(old, into){ if (into) for (const g in old.store) storeAdd(into.store, g, old.store[g]); const s = old.home && S.civ.structs[old.home]; if (s && s.occ===old.id) s.occ = null; delete S.civ.hh[old.id]; }
function hhMembers(h){ return h.members.map(cById).filter(x=>x && !x.dead); }
function hhOf(c){ return c && c.civ && S.civ.hh[c.civ.hh]; }
function hhAdults(h){ return hhMembers(h).filter(isAdult); }
function storeAdd(st, g, q){ if (!q) return; st[g] = +((st[g]||0) + q).toFixed(2); if (st[g] <= 0.001) delete st[g]; }
function storeTake(st, g, q){ const have = st[g]||0, t = Math.min(have, q); if (t>0){ st[g] = +(have - t).toFixed(2); if (st[g] <= 0.001) delete st[g]; } return t; }
function storeFood(st){ let n=0; for (const g of CIV_FOODS) n += (st[g]||0)*CG[g].food; return n; }
function storeUnits(st){ let n=0; for (const g in st) if (g!=='water') n += st[g]; return n; }
function hhFoodDays(h){ const need = hhMembers(h).reduce((a,c)=>a + (isAdult(c)?90:62), 0) || 1; return storeFood(h.store)/need; }
function hhCap(h){ const s = h.home && S.civ.structs[h.home]; const d = s && STRUCTURES[s.def]; return (d && d.home ? d.home.store : 20) * (s ? 0.5+s.cond/200 : 1); }

// ---------- structures ----------
function civStructAt(x,y){ for (const s of Object.values(S.civ.structs)) if (x>=s.x && y>=s.y && x<s.x+s.w && y<s.y+s.h) return s; return null; }
function civApplyStruct(s){
  const D = STRUCTURES[s.def]; if (!D) return;
  if (D.tile){
    const T0 = T[D.tile];
    for (let y=s.y;y<s.y+s.h;y++) for (let x=s.x;x<s.x+s.w;x++){
      if (tileAt(x,y)===-1) continue;
      if (D.tile==='BRIDGE' || D.tile==='DOCK'){ if (MAP[y][x]===T.WATER || MAP[y][x]===T.BRIDGE || MAP[y][x]===T.DOCK) MAP[y][x] = T0; else if (MAP[y][x]!==T.BUILD) MAP[y][x] = T.PATH; continue; }
      if (D.tile==='PASTURE'){ const edge = y===s.y||y===s.y+s.h-1||x===s.x||x===s.x+s.w-1; MAP[y][x] = edge && !(y===s.y+s.h-1 && x===s.x+Math.floor(s.w/2)) ? T.FENCE : T.PASTURE; continue; }
      if (D.tile==='PATH' || D.tile==='GRASS' || D.tile==='PLAZA' || D.tile==='FIELD') MAP[y][x] = T0;
    }
    if (D.tile==='BRIDGE') s.tiles.forEach(([x,y])=>{ if (!BRIDGE_TILES.some(t=>t[0]===x&&t[1]===y)) BRIDGE_TILES.push([x,y]); });
    LOC[s.id] = {id:s.id, name:s.name, indoor:false, rects:[[s.x,s.y,s.x+s.w-1,s.y+s.h-1]]};
    if (D.tile==='BRIDGE' || D.tile==='DOCK') LOC[s.id].tiles = s.tiles.slice();
    return;
  }
  if (D.prop){ for (let y=s.y;y<s.y+s.h;y++) for (let x=s.x;x<s.x+s.w;x++) if (tileAt(x,y)!==-1) MAP[y][x] = T.OBJ;
    LOC[s.id] = {id:s.id, name:s.name, indoor:false, rects:[[s.x-1,s.y+s.h,s.x+s.w,s.y+s.h]]}; return; }
  const b = {id:s.id, name:s.name, x:s.x, y:s.y, w:s.w, h:s.h, style:D.style, crude: CRUDE_DEFS.has(s.def), roof:s.roof || D.roof || HOUSE_ROOFS[hash(s.id)%HOUSE_ROOFS.length], house: D.cat==='home', cap: D.home ? D.home.cap : 0, type:s.def, biz: D.cat!=='home' ? s.def : null, sign: s.sign || D.sign || null, civ:true, cond:s.cond};
  b.door = [b.x+Math.floor(b.w/2), b.y+b.h];
  BUILDINGS.push(b); LOC[b.id] = {id:b.id, name:b.name, indoor:true, door:b.door, b};
  for (let y=b.y;y<b.y+b.h;y++) for (let x=b.x;x<b.x+b.w;x++) if (tileAt(x,y)!==-1) MAP[y][x] = T.BUILD;
  const [dx,dy] = b.door; if (tileAt(dx,dy)!==-1 && !WALK.has(MAP[dy][dx])) MAP[dy][dx] = T.GRASS;
}
const CRUDE_DEFS = new Set(['lean_to','crude_hut','longhouse','wattle_hut','healer_hut','council_house','school_hut','latrine','drying_rack']);
function civUnapplyStruct(s){
  const D = STRUCTURES[s.def];
  const bi = BUILDINGS.findIndex(b=>b.id===s.id); if (bi>=0) BUILDINGS.splice(bi,1);
  delete LOC[s.id]; delete SPOTS[s.id]; delete ART.bld[s.id];
  if (D.tile==='BRIDGE' || D.tile==='DOCK'){ (s.tiles||[]).forEach(([x,y])=>{ MAP[y][x] = T.WATER; delete S.civ.edits[tkey(x,y)]; }); BRIDGE_TILES = BRIDGE_TILES.filter(([x,y])=>!(s.tiles||[]).some(t=>t[0]===x&&t[1]===y)); return; }
  for (let y=s.y;y<s.y+s.h;y++) for (let x=s.x;x<s.x+s.w;x++) if (tileAt(x,y)!==-1){ const t = MAP[y][x]; if (t===T.BUILD||t===T.FIELD||t===T.PASTURE||t===T.FENCE||t===T.PLAZA||t===T.OBJ) MAP[y][x] = T.GRASS; }
}
function civStructName(def, owner){
  const D = STRUCTURES[def], sur = owner ? (owner.name ? surnameOf(owner) : owner.label || null) : null;
  if (D.cat==='home') return sur ? `${sur} ${D.label.toLowerCase().replace('crude ','').replace('shared ','')}` : D.label;
  if (D.cat==='bridge') return `${sur ? sur+' ' : ''}${D.label}`;
  return sur ? `${sur} ${D.label.toLowerCase()}` : D.label;
}
// place a finished structure (projects call this when their work is done)
function civAddStruct(def, x, y, owner, opts){
  opts = opts || {}; const C = S.civ, D = STRUCTURES[def];
  const id = 'cs_'+(++C.sSeq);
  const s = {id, def, x, y, w: opts.w||D.w, h: opts.h||D.h, owner: owner||{k:'community'}, name: opts.name || civStructName(def, civOwnerObj(owner)), built: civDay(), cond: opts.cond ?? 100,
    status:'active', value:0, forSale:false, occ:null, roof: opts.roof||null, meta: opts.meta||{}, tiles: opts.tiles||null, org: opts.org||null, age0: opts.age0||0};
  C.structs[id] = s; civApplyStruct(s); civParcelFor(s); civValue(s);
  S.civ.dirtyGround = true; bumpWorld();
  return s;
}
function civRemoveStruct(s, how, salvage){
  if (!s || !S.civ.structs[s.id]) return;
  const D = STRUCTURES[s.def]; civUnapplyStruct(s);
  delete S.civ.structs[s.id];
  // people living there lose their home; workers lose their workplace
  Object.values(S.civ.hh).forEach(h=>{ if (h.home===s.id){ h.home = null; hhMembers(h).forEach(m=>m.home = 'loc_town_square'); } });
  Object.values(S.civ.orgs).forEach(o=>{ o.sites = (o.sites||[]).filter(x=>x!==s.id); });
  (S.civ.animals||[]).forEach(a=>{ if (a.pen===s.id) a.pen = null; });
  if (salvage && D.mat){ const to = civOwnerStore(s.owner); if (to) for (const g in D.mat) storeAdd(to, g, Math.floor(D.mat[g]*0.35*s.cond/100)); }
  if (S.civ.parcels[s.id]) delete S.civ.parcels[s.id];
  S.civ.dirtyGround = true; bumpWorld(); indexCitizens();
  const verb = how==='collapse' ? 'collapsed' : how==='abandon' ? 'was abandoned and fell to ruin' : 'was demolished';
  chronicle(`${s.name} ${verb}.`, D.cat==='bridge' || D.cat==='civic' ? 7 : 5, how==='collapse'?'💥':'🧱', 'land');
  ev('demolished');
  S.civ.history.push({t:S.minute, kind:'removed', def:s.def, name:s.name, how});
}
function civOwnerObj(o){ if (!o) return null; if (o.k==='person') return cById(o.id); if (o.k==='hh') return S.civ.hh[o.id] ? {label:S.civ.hh[o.id].name} : null; if (o.k==='org') return S.civ.orgs[o.id] ? {label:S.civ.orgs[o.id].name} : null; return null; }
function civOwnerLabel(o){ if (!o || o.k==='community') return 'the community'; if (o.k==='gov') return 'the government'; const x = civOwnerObj(o); return x ? (x.name || x.label) : 'nobody'; }
function civOwnerStore(o){ if (!o) return S.civ.commons; if (o.k==='hh') return S.civ.hh[o.id] ? S.civ.hh[o.id].store : null; if (o.k==='person'){ const h = hhOf(cById(o.id)); return h ? h.store : null; } if (o.k==='org') return S.civ.orgs[o.id] ? S.civ.orgs[o.id].stock : null; return S.civ.commons; }
function civStructsOf(pred){ return Object.values(S.civ.structs).filter(pred); }
function civHas(defs){ const L = [].concat(defs); return civStructsOf(s=>L.includes(s.def) && s.status==='active'); }
function civStructD(s){ return STRUCTURES[s.def]; }

// land parcels: every structure sits on a parcel; ownership and value follow the parcel
function civParcelFor(s){ const C = S.civ; if (C.parcels[s.id]) return C.parcels[s.id]; return C.parcels[s.id] = {id:s.id, x:s.x-1, y:s.y-1, w:s.w+2, h:s.h+2, owner: s.owner, registered: !!(C.gov && C.gov.laws && C.gov.laws.land_registry), value:0}; }

// find open ground for a new structure near a point
function civSiteClear(x,y,w,h, allowTrees, margin){
  margin = margin ?? 1;
  for (let j=-margin;j<h+margin;j++) for (let i=-margin;i<w+margin;i++){
    const t = tileAt(x+i,y+j); if (t===-1) return false;
    const inner = i>=0 && j>=0 && i<w && j<h;
    if (inner){ if (!(t===T.GRASS||t===T.FLOWER||t===T.SAND||(allowTrees && t===T.TREE))) return false; }
    else if (t===T.BUILD||t===T.FIELD||t===T.PASTURE||t===T.FENCE||t===T.OBJ||t===T.PLAZA||t===T.BRIDGE||t===T.DOCK) return false;
    if (S.civ.reserved[tkey(x+i,y+j)]) return false;
  }
  // doors must open onto walkable ground
  const dt = tileAt(x+Math.floor(w/2), y+h); if (dt===-1 || dt===T.WATER || dt===T.ROCK) return false;
  return true;
}
function civFindSite(def, near, opts){
  opts = opts || {}; const D = STRUCTURES[def], w = opts.w||D.w, h = opts.h||D.h, [nx,ny] = near || CIV_CENTER;
  const west = opts.anySide ? null : (nx < riverX(clamp(ny,0,40)));
  const tries = [];
  for (let rad=1; rad<=(opts.maxR||34); rad++){
    for (let k=0;k<rad*8;k++){ const a = k/(rad*8)*Math.PI*2 + hash(def+rad)%7, x = Math.round(nx + Math.cos(a)*rad*1.3 - w/2), y = Math.round(ny + Math.sin(a)*rad - h/2);
      if (!civSiteInLand(x,y,w,h)) continue;
      if (west!==null && (x+w/2 < riverX(clamp(y,0,40))) !== west) continue;
      if (opts.test && !opts.test(x,y,w,h)) continue;
      if (civSiteClear(x,y,w,h, opts.trees!==false, opts.margin)) return {x,y,w,h}; }
  }
  // the home valley is full: look in annexed districts, nearest first
  if (!opts.maxR && !opts.noFrontier && typeof civAnnexed==='function') for (const cell of civAnnexed().sort((a,b)=>ringOf(a.cx,a.cy)-ringOf(b.cx,b.cy))){
    const [x0,y0,x1,y1] = cellRect(cell.cx, cell.cy), mx = Math.round((x0+x1)/2), my = Math.round((y0+y1)/2);
    for (let rad=1; rad<=14; rad++) for (let k=0;k<rad*8;k++){ const a = k/(rad*8)*Math.PI*2, x = Math.round(mx + Math.cos(a)*rad*1.3 - w/2), y = Math.round(my + Math.sin(a)*rad - h/2);
      if (!civSiteInLand(x,y,w,h) || (opts.test && !opts.test(x,y,w,h))) continue; if (civSiteClear(x,y,w,h, opts.trees!==false, opts.margin)) return {x,y,w,h}; }
  }
  return null;
}
// a building site must lie wholly on settled (home or annexed) land
function civSiteInLand(x,y,w,h){ if (x>=1 && y>=1 && x+w<OW-1 && y+h<OH-1) return true; if (typeof civClaimedTile!=='function') return false; for (const [a,b] of [[x-1,y-1],[x+w,y-1],[x-1,y+h],[x+w,y+h]]) if (tileAt(a,b)===-1 || tileAt(a,b)===T.FOG || !civClaimedTile(a,b)) return false; return true; }

// ---------- tiles: trees, stone, trails ----------
function civTreeHp(x,y){ const k = tkey(x,y); return S.civ.tree[k] ?? (S.civ.tree[k] = 18 + Math.floor(hashf(x,y,71)*14)); }
function civFell(x,y, amt){ const k = tkey(x,y); const hp = civTreeHp(x,y) - amt; S.civ.tree[k] = hp; if (hp<=0){ delete S.civ.tree[k]; civSetTile(x,y,T.GRASS); S.civ.stumps[k] = civDay(); ev('trees_felled'); } }
function civWearRock(x,y, amt){ const k = tkey(x,y); const hp = (S.civ.rock[k] ?? (40 + Math.floor(hashf(x,y,72)*30))) - amt; S.civ.rock[k] = hp; if (hp<=0){ delete S.civ.rock[k]; civSetTile(x,y,T.SAND); } }
// walking wears grass into trails; unused trails grow back
function civTread(x,y){ const k = tkey(x,y); S.civ.traffic[k] = (S.civ.traffic[k]||0) + 1; }
function civTrailsDaily(){
  const C = S.civ, road = C.roads || {};
  for (const k in C.traffic){
    const v = C.traffic[k], [x, y] = tdec(k), t = tileAt(x,y);
    if (v >= 55 && (t===T.GRASS || t===T.FLOWER)){ civSetTile(x,y,T.PATH); C.trail[k] = 1; ev('trail_tiles'); }
    C.traffic[k] = Math.floor(v*0.86); if (C.traffic[k] < 1) delete C.traffic[k];
  }
  for (const k in C.trail){ const [x, y] = tdec(k); if (road[k]) continue; if ((C.traffic[k]||0) < 2 && tileAt(x,y)===T.PATH && hashf(x,y,civDay())<0.08){ civSetTile(x,y,T.GRASS); delete C.trail[k]; } }
  // regrowth: stumps near forest slowly become saplings again
  for (const k in C.stumps){ const [x, y] = tdec(k); if (civDay()-C.stumps[k] > 90 && tileAt(x,y)===T.GRASS && !C.traffic[k] && hashf(x,y,civDay())<0.02){ let near=0; for (let j=-1;j<=1;j++) for (let i=-1;i<=1;i++) if (tileAt(x+i,y+j)===T.TREE) near++; if (near>=2){ civSetTile(x,y,T.TREE); delete C.stumps[k]; } } }
}

// ---------- ecology: forage, game and fish live in 10x10 cells ----------
const ECO_CELL = 10;
function civEcoInit(){
  const cells = [], nx = Math.ceil(OW/ECO_CELL), ny = Math.ceil(OH/ECO_CELL), r = crand('eco');
  for (let cy=0;cy<ny;cy++) for (let cx=0;cx<nx;cx++){
    let grass=0, tree=0, water=0, rock=0, flower=0;
    for (let y=cy*ECO_CELL;y<Math.min(OH,(cy+1)*ECO_CELL);y++) for (let x=cx*ECO_CELL;x<Math.min(OW,(cx+1)*ECO_CELL);x++){ const t = MAP[y][x]; if (t===T.GRASS) grass++; else if (t===T.TREE) tree++; else if (t===T.WATER) water++; else if (t===T.ROCK) rock++; else if (t===T.FLOWER) flower++; }
    const fcap = Math.round(grass*1.8 + tree*2.3 + flower*3.5), gcap = Math.round(tree/6 + grass/30), fishcap = Math.round(water*7);
    const W = S.civ.land || {fish:1, game:1, forage:1}; const fcapW = Math.round(fcap*W.forage), gcapW = Math.round(gcap*W.game), fishW = Math.round(fishcap*W.fish);
    cells.push({cx, cy, fcap:fcapW, f: fcapW, gcap:gcapW, g: Math.round(gcapW*(0.6+r()*0.5)), kind: tree>grass ? (r()<0.4?'boar':'deer') : 'deer', small: Math.round((grass+tree)/12), fishcap:fishW, fish: fishW});
  }
  S.civ.eco = {nx, ny, cells};
}
function ecoCellAt(x,y){ const E = S.civ.eco; if ((x<0 || y<0 || x>=OW || y>=OH) && E.ext){ const e = E.ext[Math.floor(x/ECO_CELL)+','+Math.floor(y/ECO_CELL)]; if (e) return e; } const cx = clamp(Math.floor(x/ECO_CELL),0,E.nx-1), cy = clamp(Math.floor(y/ECO_CELL),0,E.ny-1); return E.cells[cy*E.nx+cx]; }
function civEcoDaily(){
  const season = seasonOf(civDay()), grow = [0.045,0.05,0.035,0.004][season];
  const E = S.civ.eco;
  E.cells.forEach((e,i)=>{ e.f = Math.min(e.fcap, e.f + (e.fcap-e.f)*grow + e.fcap*0.002); e.fish = Math.min(e.fishcap, e.fish + (e.fishcap-e.fish)*0.05 + 0.5);
    if (civDay()%7===0 && e.gcap){ const g = e.g; e.g = Math.min(e.gcap*1.2, g + Math.max(g>=2?1:0, Math.round(g*0.16*(1-g/(e.gcap+1)))) );
      // animals wander back into emptied woods from neighbouring cells
      if (e.g < e.gcap*0.3){ const nb = [i-1,i+1,i-E.nx,i+E.nx].map(j=>E.cells[j]).filter(x=>x && x.g > x.gcap*0.5); if (nb.length){ nb[0].g--; e.g++; } } } });
}

// ---------- the time tiers ----------
// minute: movement, needs, visible actions · hour: commerce, prices, pay · day: learning, jobs, property, business, prospecting
// week: strategy, companies, research, investment, institutions · month: large projects, migration, demographics, industry
function civTick(){
  S.minute++;
  const mod = modOf(S.minute), d = dayOf(S.minute);
  if (mod===0) civDaily(d);
  const lod = civLodMask();
  for (const c of S.citizens){ try { civAgentTick(c, mod, lod); } catch(e){ civSafe('agent', ()=>{ throw e; }); c.plan = null; } }
  if (mod%60===0) civSafe('hourly', ()=>civHourly(mod/60));
  if (mod===20*60) civEveningGatherings();
}
// agents far from the camera and not travelling are simulated every few minutes instead of every minute
function civLodMask(){ if (catchingUp || !S.civ.lod) return null; const {vx,vy,vw,vh} = viewRect(); return {x0:vx/TILE-6, y0:vy/TILE-6, x1:(vx+vw)/TILE+6, y1:(vy+vh)/TILE+6}; }
function civFar(c, lod){ return lod && (c.rt.x<lod.x0 || c.rt.y<lod.y0 || c.rt.x>lod.x1 || c.rt.y>lod.y1); }

function civHourly(h){
  civSafe('crime-hour', ()=>civCrimeHour(h));
  civMarketHour(h);
  civOrgsHour(h);
  S.citizens.forEach(c=>{ emotionsHour(c); updateMood(c); if (c.memory.since >= 50) civReflect(c); });
  if (h===12) civGroundDirty();
}
// one failing subsystem must not freeze the whole settlement: errors are recorded (tests fail on any) and the day goes on
function civSafe(name, fn){ try { fn(); } catch(e){ const E = S.civ.errors = S.civ.errors || []; E.push({day:civDay(), name, msg:String(e && e.message || e), stack:String(e && e.stack || '').split('\n').slice(0,3).join(' | ')}); if (E.length>30) E.shift(); console.error('[civ]', name, e); } }
function civDaily(d){
  const C = S.civ, season = seasonOf(d); pathCache.clear();
  if (d%7===0 && d>0) civCloseWeek();
  if (!S.week) civOpenWeek();
  S.lastWeather = S.weather; S.weather = rollWeather(season); S.week.weather[S.weather] = (S.week.weather[S.weather]||0)+1;
  if (S.weather==='Storm') chronicle('A storm lashes the settlement. Nobody works outdoors today.', 4, '⛈️', 'weather');
  if (d>0 && d%112===0) S.citizens.slice().forEach(c=>{ c.age++; if (c.profession==='Child' && c.age>=16) civComeOfAge(c); });
  else if (d%28===0) S.citizens.forEach(c=>civRefreshLook(c));
  S.citizens.forEach(c=>{ c.days.push(newDayBucket()); if (c.days.length>7) c.days.shift(); c.svcUsed = 0; });
  civSafe('ecology', civEcoDaily);
  civSafe('frontier', civFrontierDaily);   // expeditions, annexation votes, upkeep, districts
  civSafe('spoilage', civSpoilage);
  civSafe('distribution', civDistributeFood);
  civSafe('structures', civStructsDaily);
  civSafe('health', civHealthDaily);
  civSafe('life', civLifeDaily);
  civSafe('minds', civMindsDaily);
  civSafe('cognition', ()=>{ cognitionDaily(); civMindTidy(); }); // memories fade, beliefs anchor opinions, weekly reflection          // learning, mentorship, discovery, occupations
  civSafe('economy', civEconDaily);         // barter, money, businesses, jobs, contracts, loans, property
  civSafe('society', civSocietyDaily);      // gatherings, government, justice, education, sport, imports
  civSafe('science', civScienceDaily);      // prospecting, mines, research
  civSafe('trails', civTrailsDaily);
  if (d%7===0) civSafe('weekly', ()=>civWeekly(d));
  if (d%28===0) civSafe('monthly', ()=>civMonthly(d));
  if (S.civ.animKey !== civAnimKey()) civSafe('animals', civSyncAnimals);
  S.citizens.forEach(c=>{ civSafe('plan', ()=>{ c.plan = civPlanDay(c, d); c.rt.blockIdx = -1; }); });
  civGroundDirty();
  civStage();
}
function civWeekly(d){ civSafe('resources-w', civResSnapshot); civSafe('frontier-w', civFrontierWeekly); civSafe('cognition-w', civCognitionWeekly); civSafe('minds-w', civMindsWeekly); civSafe('econ-w', civEconWeekly); civSafe('society-w', civSocietyWeekly); civSafe('science-w', civScienceWeekly); civSafe('neighbours-w', civNeighborsWeekly); }
function civMonthly(d){ civSafe('projects-m', civProjectsMonthly); civSafe('migration-m', civMigrationMonthly); civSafe('econ-m', civEconMonthly); civSafe('society-m', civSocietyMonthly); }

// ---------- the settlement's stage (a label, earned by what exists, never a trigger) ----------
function civStage(){
  const C = S.civ, n = S.citizens.length, inst = Object.keys(C.orgs).length, str = Object.keys(C.structs).length;
  const score = n + inst*6 + str*2 + (C.econ.stage>=4?40:0) + (C.gov.stage>=3?30:0) + Object.keys(C.tech).length*3;
  let lab = SETTLEMENT_STAGES[0][1]; SETTLEMENT_STAGES.forEach(([k,l])=>{ if (score>=k) lab = l; });
  if (lab!==C.stageLabel){ if (C.stageLabel) chronicle(`The settlement has become a ${lab.toLowerCase()}.`, 8, '🏘️', 'founding'); C.stageLabel = lab; }
}

// ---------- the minute: movement, needs, work, eating ----------
const CIV_STATE = {Sleep:'Sleeping', Eat:'Consuming', Work:'Working', Socialize:'Socializing', Leisure:'Idle', Chore:'Idle', Learn:'Working', Idle:'Idle'};
function civAgentTick(c, mod, lod){
  const n = c.needs, awake = c.rt.state!=='Sleeping', kid = !isAdult(c);
  const far = civFar(c, lod) && !c.rt.path, k = far ? (mod%4===0 ? 4 : 0) : 1;
  if (!k) return;
  n.hunger = clamp(n.hunger - (kid ? 0.045 : 0.062)*k*(c.civ.hurt?1.1:1), 0, 100);
  n.energy = clamp(n.energy + (awake ? -0.058 : 0.21)*k, 0, 100);
  n.social = clamp(n.social - 0.03*(0.6+c.personality.extraversion)*k, 0, 100);
  n.fun    = clamp(n.fun - 0.025*k, 0, 100);
  n.comfort= clamp(n.comfort + (awake ? -0.02 : civHomeComfort(c)*0.0006)*k, 0, 100);
  c.rt.seg = null;
  if (!c.plan || !c.plan.blocks) c.plan = civPlanDay(c, dayOf(S.minute));
  const idx = currentBlockIdx(c, mod);
  if (idx !== c.rt.blockIdx){ const prev = c.plan.blocks[c.rt.blockIdx]; if (prev) civFinishBlock(c, prev); c.rt.blockIdx = idx; civStartBlock(c, c.plan.blocks[idx]); }
  const b = c.plan.blocks[idx];
  if (c.rt.path){ civStep(c); if (!c.rt.path) civArrive(c, b); return; }
  civActivity(c, b, mod, k);
  if (n.hunger < 18 && awake && S.minute-(c.lastTry.hunger||-999) > 90){ c.lastTry.hunger = S.minute; civEat(c, true); }
}
function civHomeComfort(c){ const s = c.home && S.civ.structs[c.home]; const D = s && STRUCTURES[s.def]; if (!D || !D.home) return 8; const winter = seasonOf(civDay())===3; return D.home.comfort*(0.5+s.cond/200) - (winter ? (100-D.home.insul)*0.4 : 0); }
function civStartBlock(c, b){
  c.rt.did = false; b.acc = 0; b.t0 = S.minute;
  let tx, ty;
  if (b.xy){ [tx,ty] = b.xy; }
  else { const L = LOC[b.loc] || LOC.loc_town_square; [tx,ty] = L.indoor ? L.door : spotFor(c, LOC[b.loc] ? b.loc : 'loc_town_square'); }
  c.rt.dest = b.loc;
  if (c.rt.x===tx && c.rt.y===ty){ c.rt.path = null; civArrive(c, b); return; }
  const p = findPath(c.rt.x, c.rt.y, tx, ty);
  if (!p){ c.rt.path = null; c.rt.state = 'Idle'; b.stuck = true; civNoteCrossing(c, tx, ty); return; }
  p.shift(); c.rt.path = p.length ? p : null; c.rt.state = 'Traveling'; c.rt.loc = null;
  if (!c.rt.path) civArrive(c, b);
}
function civStep(c){
  c.rt.ox = c.rt.x; c.rt.oy = c.rt.y; const seg = [[c.rt.x,c.rt.y]];
  const road = S.civ.roads[tkey(c.rt.x,c.rt.y)] ? 3 : 2;
  for (let i=0;i<road && c.rt.path && c.rt.path.length;i++){
    const [nx,ny] = c.rt.path.shift();
    if (!walkable(nx,ny)){ c.rt.path = null; break; }
    if (MAP[ny][nx]===T.BRIDGE) civCrossBridge(c, nx, ny);
    else if (MAP[ny][nx]===T.WATER && S.minute - (c.civ.waded||-999) > 60){ c.civ.waded = S.minute; const cr = S.civ.crossing = S.civ.crossing || {}; cr[ny] = (cr[ny]||0) + 0.6; } // wading the ford: people wish for a bridge
    c.rt.x = nx; c.rt.y = ny; seg.push([nx,ny]); civTread(nx,ny);
  }
  c.rt.seg = seg;
  if (c.rt.path && !c.rt.path.length) c.rt.path = null;
}
function civArrive(c, b){
  c.rt.ox = c.rt.x; c.rt.oy = c.rt.y;
  c.rt.loc = b.loc && LOC[b.loc] ? b.loc : 'wild'; c.rt.state = CIV_STATE[b.act] || 'Idle'; c.rt.since = S.minute;
  if (b.act==='Eat' && !c.rt.did){ c.rt.did = true; civEat(c, false); }
  if (b.act==='Chore' && !c.rt.did){ c.rt.did = true; c.needs.comfort = clamp(c.needs.comfort+6,0,100); }
}
function civActivity(c, b, mod, k){
  const n = c.needs;
  switch (b.act){
    case 'Sleep': if (c.rt.state!=='Sleeping') c.rt.state = 'Sleeping'; break;
    case 'Work': case 'Learn':
      if (c.rt.state!=='Working') c.rt.state = 'Working';
      b.acc += k * civEfficiency(c, b);
      if ((mod + hash(c.id))%45===0) civWorkTick(c, b);
      break;
    case 'Socialize': n.social = clamp(n.social+0.32*k,0,100); n.fun = clamp(n.fun+0.14*k,0,100); if ((mod+hash(c.id))%20===0) civSocialize(c); break;
    case 'Leisure': n.fun = clamp(n.fun+0.16*k,0,100); if ((mod+hash(c.id))%30===0) civSocialize(c); break;
    case 'Chore': if ((mod+hash(c.id))%25===0) civSocialize(c); break;
  }
}
// how much a minute of this person's work is worth: skill, tools, health, energy, weather, and the right kind of mind
function civEfficiency(c, b){
  const A = ACTIVITIES[b.task]; if (!A) return 0.5;
  const sk = A.skill ? (c.civ.skill[A.skill]||0) : 30;
  let e = 0.35 + sk/100*1.15;
  e *= 0.55 + c.civ.cog.practical*0.45 + (b.task==='research' ? c.civ.cog.reasoning*0.4 : 0);
  if (A.tool && A.tool.some(g=>(hhOf(c)||{store:{}}).store[g]>0)) e *= A.toolBoost||1.4;
  e *= 0.45 + c.needs.energy/180 + (c.civ.hurt ? -0.25 : 0) + (c.sick ? -0.3 : 0);
  if (!isAdult(c)) e *= c.age<10 ? 0.25 : 0.55;
  if (A.place!=='home' && A.place!=='school' && A.place!=='job' && A.place!=='lab'){ if (S.weather==='Storm') e *= 0.25; else if (S.weather==='Snow') e *= 0.6; else if (S.weather==='Rain') e *= 0.85; }
  return Math.max(0.05, e);
}
function civFinishBlock(c, b){
  if (b.act!=='Work' && b.act!=='Learn') return;
  if (b.done) return; b.done = true;
  if (b.stuck && !b.acc){ civRecordOutcome(c, b, 0, 'could not get there'); return; }
  const hrs = (b.acc||0)/60;
  const res = civDoWork(c, b, hrs);         // yields, depletion, construction progress, learning (civ_mind / civ_econ)
  civLearnFromWork(c, b, hrs, res);
  civRecordOutcome(c, b, res ? res.value : 0, res ? res.why : null);
}

// ---------- eating and drinking ----------
function civEat(c, urgent){
  if (c.away){ c.needs.hunger = Math.max(c.needs.hunger, 55); return true; } // explorers live on what they carried
  const h = hhOf(c), n = c.needs; let ate = false;
  const want = urgent ? 60 : 78;
  const eatFrom = st => { const order = CIV_FOODS.filter(g=>st[g]>0).sort((a,b)=>(CG[a].perish||999)-(CG[b].perish||999));
    for (const g of order){ while (st[g]>0 && n.hunger<want){ storeTake(st, g, 1); n.hunger = clamp(n.hunger + CG[g].food, 0, 100); ate = true; c.civ.ateToday = (c.civ.ateToday||0)+1; } if (n.hunger>=want) break; } };
  if (h) eatFrom(h.store);
  if (n.hunger < 40){ const inv = c.inventory; if (inv && Object.keys(inv).length) eatFrom(inv); }
  // an empty larder: the shared cache while it lasts, then kin and friends, then the market
  if (n.hunger < 35 && storeFood(S.civ.commons) > 0 && S.civ.rationToday < S.civ.rationCap){ const before = n.hunger; eatFrom(S.civ.commons); if (n.hunger>before){ S.civ.rationToday++; ev('rations'); } }
  if (n.hunger < 30) ate = civAskForFood(c) || ate;
  if (n.hunger < 30 && civMoneyOn()) ate = civBuyFood(c) || ate;
  if (!ate && n.hunger < 20){ if (c.civ.hungryDay !== dayOf(S.minute)){ c.civ.hungryDay = dayOf(S.minute); if (isAdult(c)) civHungerMemory(c); c.civ.hungryDays = (c.civ.hungryDays||0)+1; } if (!S.week.hungry.includes(c.name)){ S.week.hungry.push(c.name); remember(c, 'There was nothing to eat today.', 7); setEmotion(c, 'Anxious', 240); civProblem('food', 1, c); } }
  // water: from the household jar, else a walk to the river
  // water: one jar a day from the household, or a drink at the river when working by it
  if (c.civ.drank !== dayOf(S.minute)){ const nearW = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>tileAt(c.rt.x+dx,c.rt.y+dy)===T.WATER);
    if (nearW || (h && (h.store.water||0) >= 1)){ if (!nearW) storeTake(h.store, 'water', 1); c.civ.drank = dayOf(S.minute); c.civ.thirst = 0; } }
  return ate;
}
function civAskForFood(c){
  const h = hhOf(c); const kin = S.citizens.filter(o=>o!==c && hhOf(o) && hhOf(o)!==h && (peekRel(o,c.id).tags.includes('Family') || peekRel(o,c.id).affinity>35) && hhFoodDays(hhOf(o))>2.5);
  const giver = kin.sort((a,b)=>peekRel(b,c.id).affinity-peekRel(a,c.id).affinity)[0];
  if (!giver) return false;
  const gh = hhOf(giver), P = giver.personality, share = P.agreeableness>0.35 || giver.traits.includes('Generous') || peekRel(giver,c.id).tags.includes('Family');
  if (!share) return false;
  const g = CIV_FOODS.filter(x=>gh.store[x]>=1).sort((a,b)=>(CG[a].perish||999)-(CG[b].perish||999))[0]; if (!g) return false;
  const q = Math.min(3, gh.store[g]); storeTake(gh.store, g, q); c.needs.hunger = clamp(c.needs.hunger + CG[g].food*q*0.7, 0, 100);
  adjustRel(c, giver, 6); civFavor(c, giver, CG[g].v*q); ev('gifts');
  if (hash(c.id+S.minute)%5===0) remember(c, `${giver.name} shared food with us when we had none.`, 6, [giver.id]);
  return true;
}
// ---------- sharing food out: kin and friends first, then the common store, before anything rots ----------
// Each morning households short of food are topped up by relatives and friends with plenty to spare; if that is not
// enough the common store hands out rations (families with children first); and households with more perishable food
// than they can eat before it spoils give the excess to the common store or a hungry neighbour.
function civDistributeFood(){
  const C = S.civ, st = {shared:0, rations:0, donated:0, helped:0};
  const need = h => hhMembers(h).reduce((a,c)=>a + (isAdult(c)?90:62), 0);
  const hhs = Object.values(C.hh).filter(h=>h.members && h.members.length);
  const days = new Map(hhs.map(h=>[h, hhFoodDays(h)]));
  const kids = h => hhMembers(h).filter(c=>!isAdult(c)).length;
  const move = (from, to, pts) => { let got = 0; const order = CIV_FOODS.filter(g=>from[g]>=0.5).sort((a,b)=>(CG[a].perish||999)-(CG[b].perish||999));
    for (const g of order){ if (got >= pts) break; const q = Math.min(from[g], Math.ceil((pts-got)/CG[g].food)); storeTake(from, g, q); storeAdd(to, g, q); got += q*CG[g].food; } return got; };
  const tie = (a, b) => hhMembers(a).some(x=>hhMembers(b).some(y=>{ const R = peekRel(x, y.id); return R.tags.includes('Family') || R.affinity > 30; }));
  const giving = h => hhMembers(h).filter(isAdult).some(x=>x.personality.agreeableness>0.3 || x.traits.includes('Generous') || (x.values||[]).includes('Community'));
  const needy = hhs.filter(h=>days.get(h) < 1.5).sort((a,b)=>days.get(a)-days.get(b) || kids(b)-kids(a));
  const donors = hhs.filter(h=>days.get(h) >= 5 && giving(h));
  needy.forEach(h=>{
    const want = need(h)*2 - storeFood(h.store); if (want <= 0) return; let got = 0;
    donors.filter(d=>d!==h && tie(d, h)).sort((a,b)=>days.get(b)-days.get(a)).forEach(d=>{
      if (got >= want) return; const spare = storeFood(d.store) - need(d)*4; if (spare <= 0) return;
      const g = move(d.store, h.store, Math.min(spare, want-got)); if (g <= 0) return; got += g; st.shared += g;
      const giver = hhMembers(d).find(isAdult), taker = hhMembers(h).find(isAdult);
      if (giver && taker){ civFavor(taker, giver, g/30); adjustRel(taker, giver, 3); civFedMemory(taker, giver, 'kin'); if (hash(taker.id+civDay())%6===0) remember(taker, `${giver.name}'s household shared food with us.`, 5, [giver.id]); }
      days.set(d, hhFoodDays(d)); });
    // then the common store: rations, children first, as long as the daily ration allowance lasts
    if (storeFood(h.store) < need(h)*1.2 && storeFood(C.commons) > 0 && C.rationToday < C.rationCap){
      const room = (C.rationCap - C.rationToday)*30, g = move(C.commons, h.store, Math.min(room, need(h)*1.5 - storeFood(h.store) + (kids(h) ? 60 : 0)));
      if (g > 0){ C.rationToday += Math.ceil(g/30); st.rations += g; got += g; ev('rations', Math.ceil(g/30)); hhMembers(h).filter(isAdult).forEach(a=>civFedMemory(a, null, 'ration')); } }
    if (got > 0){ st.helped++; days.set(h, hhFoodDays(h)); } });
  // perishable surplus goes where it will be eaten instead of rotting
  hhs.filter(h=>days.get(h) > 8 && giving(h)).forEach(h=>{
    const n = need(h); CIV_FOODS.filter(g=>CG[g].perish && CG[g].perish <= 4 && h.store[g] > 0).forEach(g=>{
      const eatable = n*CG[g].perish/CG[g].food, extra = h.store[g] - eatable; if (extra < 2) return;
      const to = needy.find(x=>storeFood(x.store) < need(x)*3) ; const q = +(extra*0.6).toFixed(2); storeTake(h.store, g, q); storeAdd(to ? to.store : C.commons, g, q); st.donated += q*CG[g].food; }); });
  if (st.shared) ev('food_shared', Math.round(st.shared/30)); if (st.donated) ev('food_donated', Math.round(st.donated/30));
  C.dist = {day:civDay(), shared:Math.round(st.shared/30), rations:Math.round(st.rations/30), donated:Math.round(st.donated/30), helped:st.helped, needy:needy.length};
  C.distTot = C.distTot || {shared:0, rations:0, donated:0}; C.distTot.shared += C.dist.shared; C.distTot.rations += C.dist.rations; C.distTot.donated += C.dist.donated;
}
// favours owed: the first economy is a web of gifts people remember
function civFavor(receiver, giver, v){ const m = receiver.civ.owe = receiver.civ.owe || {}; m[giver.id] = +((m[giver.id]||0) + v).toFixed(1); }
// how long each food keeps for these people: every storage technique they know stretches it, and knowing food well helps too
function civStoreMult(techs, fc){
  const m = {}; for (const g of CIV_FOODS) m[g] = 1 + Math.min(0.3, (fc||0)/250);
  techs.forEach(t=>{ const T0 = TECHS[t], st = T0 && T0.store; if (!st) return; for (const g of CIV_FOODS){ const f = st[g] || st.all; if (f) m[g] *= f; } });
  return m;
}
function civHHStoreMult(h){
  const mem = hhMembers(h).filter(isAdult), techs = new Set(); let fc = 0;
  mem.forEach(m=>{ (m.civ.techs||[]).forEach(t=>{ if (TECHS[t] && TECHS[t].store) techs.add(t); }); fc = Math.max(fc, kn(m,'foodcraft')); });
  return civStoreMult([...techs], fc);
}
function civCommonsStoreMult(){
  const techs = Object.keys(TECHS).filter(t=>TECHS[t].store && civTechKnown(t));
  const fc = S.citizens.filter(isAdult).reduce((a,c)=>Math.max(a, kn(c,'foodcraft')), 0);
  return civStoreMult(techs, fc);
}
function civSpoilage(){
  const d = civDay(), preserveOf = s => { const D = STRUCTURES[s.def]; return D.preserve ?? 1; };
  const rot = (st, keep, mult) => { let lost = 0; for (const g of Object.keys(st)){ const P = CG[g] && CG[g].perish; if (!P) continue; const q = st[g]*(1/(P*(mult ? mult[g]||1 : 1)))*keep; lost += storeTake(st, g, q); } return lost; };
  let lost = 0, saved = 0;
  Object.values(S.civ.hh).forEach(h=>{ const s = h.home && S.civ.structs[h.home]; const keep = s ? 0.8 : 1; const mult = civHHStoreMult(h);
    const before = CIV_FOODS.reduce((a,g)=>a+(h.store[g]||0),0), l = rot(h.store, keep, mult); lost += l;
    saved += CIV_FOODS.reduce((a,g)=>{ const P = CG[g].perish; return a + (P && h.store[g] ? h.store[g]*keep*(1/P - 1/(P*mult[g])) : 0); }, 0) * (before>0 ? 1 : 0);
    const cap = hhCap(h), units = storeUnits(h.store); if (units > cap*1.5){ for (const g of CIV_FOODS){ if (h.store[g]) lost += storeTake(h.store, g, h.store[g]*0.08); } } });
  const gran = civHas(['granary','warehouse','cold_store']); let keepC = gran.length ? Math.min(...gran.map(preserveOf)) : 0.6;
  if (gran.length && civTechKnown('raised_granary')) keepC *= TECHS.raised_granary.commons;
  lost += rot(S.civ.commons, keepC, civCommonsStoreMult());
  Object.values(S.civ.orgs).forEach(o=>{ if (o.stock) lost += rot(o.stock, 0.7, civCommonsStoreMult()); });
  if (lost>=40) chronicle(`About ${Math.round(lost)} units of food spoiled in store${lost>120?' — the settlement needs better ways to keep food':''}.`, lost>120?5:3, '🥀', 'food');
  S.civ.spoiled = (S.civ.spoiled||0)*0.8 + lost; S.civ.spoiledDay = +lost.toFixed(1); S.civ.storeSaved = +((S.civ.storeSaved||0) + saved).toFixed(1);
  ev('pd_spoiled', lost*28/90); if (lost>150) civProblem('storage', 1);
  S.civ.rationToday = 0;
}

// ---------- structures age, wear and can fall down ----------
function civStructsDaily(){
  const d = civDay();
  Object.values(S.civ.structs).forEach(s=>{
    const D = STRUCTURES[s.def]; if (!D) return;
    const dur = D.home ? D.home.dur : D.bridge ? D.bridge.dur : 70;
    const storm = S.weather==='Storm' ? 3 : 1, age = d - s.built;
    s.cond = Math.max(0, s.cond - (0.12 + (100-dur)/260)*storm*(age>200?1.4:1));
    if (s.def in {pen:1, ranch:1} && s.cond<30 && hashf(s.x,s.y,d)<0.1) civProblem('neglect', 1);
    // occupied homes and working businesses get patched up by the people who use them
    if (s.status==='active' && s.cond<70){ const users = civUsers(s); if (users.length && hashf(s.x,s.y,d+1) < 0.25){ const st = civOwnerStore(s.owner) || (hhOf(users[0])||{}).store; const mat = D.mat && Object.keys(D.mat)[0]; if (!mat || (st && storeTake(st, mat, 2)>=1)) s.cond = Math.min(100, s.cond + 6); } }
    if (D.bridge && s.cond<=0){ civRemoveStruct(s, 'collapse'); civProblem('infrastructure', 3); return; }
    if (s.cond<=0 && D.cat!=='farm' && D.cat!=='ranch'){ civRemoveStruct(s, 'collapse'); civProblem('housing', 1); return; }
    if (s.status==='active' && !civUsers(s).length && !D.bridge && !D.tile && age>30 && s.cond<35 && hashf(s.x,s.y,d+2)<0.03){ s.status = 'abandoned'; chronicle(`${s.name} stands empty and is falling apart.`, 3, '🏚️', 'land'); }
    if (s.status==='abandoned' && s.cond<8){ civRemoveStruct(s, 'abandon'); }
    const b = LOC[s.id] && LOC[s.id].b; if (b && Math.abs((b.cond||100) - s.cond) > 12){ b.cond = s.cond; delete ART.bld[s.id]; groundKey=''; }
  });
}
function civUsers(s){ const D = STRUCTURES[s.def]; if (D.home) return S.citizens.filter(c=>c.home===s.id); const org = s.org && S.civ.orgs[s.org]; if (org) return (org.staff||[]).map(alive).filter(Boolean); if (D.farm || D.ranch) return s.owner && s.owner.k==='hh' && S.civ.hh[s.owner.id] ? hhMembers(S.civ.hh[s.owner.id]) : []; return S.citizens.filter(c=>c.rt.loc===s.id); }

// ---------- health, birth, death ----------
function civHealthDaily(){
  const season = seasonOf(civDay()), crowd = civCrowding(), sanit = civSanitation();
  S.citizens.slice().forEach(c=>{
    const X = c.civ, hungry = c.needs.hunger < 15; if (X.drank !== civDay()-1) X.thirst = (X.thirst||0) + 1; const thirsty = (X.thirst||0) >= 2;
    const cold = season===3 ? Math.max(0, 55 - civHomeComfortRaw(c))/55 : 0;
    X.health = clamp(X.health + (hungry ? -6 : c.needs.hunger>50 ? 2 : 0) + (thirsty ? -8 : 0) - cold*4 - (c.sick ? 2 : 0) + (X.hurt ? -1 : 0.5), 0, 100);
    X.ateToday = 0; if (c.needs.hunger > 45) X.hungryDays = Math.max(0, (X.hungryDays||0)-1);
    if (X.hurt && hashf(hash(c.id)&1023, civDay(), 5) < 0.12){ X.hurt = 0; }
    if (c.sick){ c.sick++; if (c.sick>6 || (c.sick>2 && hashf(hash(c.id)&1023,civDay(),6) < 0.25 + (X.treated?0.3:0))){ c.sick = 0; X.treated = 0; } }
    const p = (season===3?0.018:0.008) * (1 + crowd*1.5) * (1 - sanit*0.6) * (X.health<50?2:1) * civTheoryMult('sick');
    if (!c.sick && rnd() < p){ c.sick = 1; ev('illness'); civProblem('health', 1, c); if (hash(c.id+civDay())%3===0) chronicle(`${c.name} has fallen ill.`, 3, '🤒', 'health'); }
    if (X.health<=0){ die(c, hungry ? 'starvation' : thirsty ? 'thirst' : cold>0.4 ? 'the cold' : 'illness'); ev('deaths_privation'); return; }
    const old = c.age>=58 ? (c.age-56)*0.0004 : 0, frail = c.sick>=3 ? (X.treated ? 0.004 : 0.012)*(c.age>50||c.age<5?2:1) : 0;
    if (rnd() < old + frail) die(c, frail>old ? 'illness' : 'old age');
  });
}
function civHomeComfortRaw(c){ const s = c.home && S.civ.structs[c.home]; const D = s && STRUCTURES[s.def]; return D && D.home ? D.home.insul*(0.5+s.cond/200) : 5; }
function civCrowding(){ let over = 0, n = 0; Object.values(S.civ.hh).forEach(h=>{ const s = h.home && S.civ.structs[h.home]; const cap = s && STRUCTURES[s.def].home ? STRUCTURES[s.def].home.cap : 0; const m = h.members.length; n += m; over += Math.max(0, m-cap); }); const homeless = S.citizens.filter(c=>!S.civ.structs[c.home]).length; return clamp((over + homeless*0.7)/Math.max(1,n), 0, 1); }
function civSanitation(){ let s = 0; if (civHas('latrine').length) s += Math.min(0.3, civHas('latrine').length*6/Math.max(1,S.citizens.length)*0.3*5); if (civHas('well').length) s += 0.15; if (civHas('sewage').length) s += 0.4; if (civHas('waterworks').length) s += 0.2; if (civTechKnown('germ_theory')) s += 0.1; return clamp(s * (civTheoryAccepted('th_miasma') ? 1.1 : 1), 0, 0.9); }

function civLifeDaily(){
  const d = civDay();
  // babies come when a couple is settled and fed; there is no population cap, only food, shelter and health
  S.citizens.slice().forEach(a=>{
    const b = a.partner && alive(a.partner); if (!b || a.id>b.id || hhOf(a)!==hhOf(b) || !canConceive(a,b)) return;
    const h = hhOf(a), fed = hhFoodDays(h), kids = S.citizens.filter(k=>k.parents.includes(a.id) && k.age<6).length;
    const home = S.civ.structs[a.home], room = home && STRUCTURES[home.def].home ? STRUCTURES[home.def].home.cap - h.members.length : -1;
    const want = (a.values.includes('Family')||b.values.includes('Family') ? 1.8 : 1) * (civHasGoal(a,'family')||civHasGoal(b,'family') ? 1.6 : 1);
    const chance = 0.012 * want * (fed>3 ? 1 : fed>1 ? 0.5 : 0.1) * (room>0 ? 1 : 0.35) * (kids>=2 ? 0.3 : 1) * (a.civ.health>60 && b.civ.health>60 ? 1 : 0.3);
    if (rnd() < chance) civBirth(a, b);
  });
  civRomanceDaily();
  // orphans are taken in by kin, else by a caring household
  S.citizens.filter(k=>!isAdult(k) && !k.parents.some(id=>alive(id)) && (!hhOf(k) || !hhAdults(hhOf(k)).length)).forEach(k=>{
    const kin = S.citizens.filter(o=>isAdult(o) && hhOf(o) && peekRel(o,k.id).affinity>20).sort((a,b)=>peekRel(b,k.id).affinity-peekRel(a,k.id).affinity)[0]
      || S.citizens.filter(o=>isAdult(o) && hhOf(o) && o.personality.agreeableness>0.6).sort((a,b)=>hhFoodDays(hhOf(b))-hhFoodDays(hhOf(a)))[0];
    if (kin){ civJoinHH(k, hhOf(kin)); k.parents = k.parents.concat([kin.id]).slice(-2); chronicle(`${kin.name} took in ${k.name}, who had no one left.`, 5, '🤲', 'family'); if (S.relStats) S.relStats.adoptions++; indexCitizens(); }
  });
}
function civBirth(a, b){
  const d = civDay(), r = mapRand(hash(a.id+b.id+d)), h = hhOf(a);
  const mother = genderOf(a)==='F' ? a : b, father = mother===a ? b : a;
  const gender = r()<0.5 ? 'F' : 'M', first = firstNameFor(gender, r), sur = surnameOf(father);
  const genes = civGenes(r, a.civ.genes, b.civ.genes);
  const baby = civMakePerson({first, sur, age:0, gender, home:a.home, parents:[a.id,b.id], genes, bio:`Born in the settlement on ${fmtDate(d)} to ${a.name} and ${b.name}.`}, r);
  COG.forEach(k=>{ baby.civ.cog[k] = +clamp((a.civ.cog[k]+b.civ.cog[k])/2 + (r()-0.5)*0.5, 0.05, 0.97).toFixed(2); });
  baby.values = [...new Set([a.values[0], b.values[0], VALUES[Math.floor(r()*VALUES.length)]])].slice(0,2);
  baby.rt.x = baby.rt.ox = a.rt.x; baby.rt.y = baby.rt.oy = a.rt.y;
  S.citizens.push(baby); civJoinHH(baby, h); indexCitizens();
  [a,b].forEach(p=>{ const R = getRel(p, baby.id); R.affinity = 90; R.trust = .9; R.tags = ['Family']; const R2 = getRel(baby, p.id); R2.affinity = 90; R2.tags = ['Family']; p.kids.push(baby.id); remember(p, `Our child ${first} was born today.`, 10, [baby.id]); setEmotion(p, 'Joyful', DAY); });
  baby.plan = civPlanDay(baby, d);
  chronicle(`A baby! ${a.name} and ${b.name} welcomed ${baby.name}.`, 7, '👶', 'family'); S.week.births.push(baby.name); ev('births');
}
function civComeOfAge(c){
  c.profession = 'Settler'; civRefreshLook(c);
  chronicle(`${c.name} came of age. What they do now is up to them.`, 4, '🎓', 'family'); remember(c, 'I am grown now. I will have to find my own way.', 8);
  // young adults with a partner or a crowded home start their own household
  const h = hhOf(c); if (h && h.members.length>5 && rnd()<0.5){ const nh = civNewHH(surnameOf(c), null); civJoinHH(c, nh); indexCitizens(); }
}
function civRomanceDaily(){
  S.citizens.forEach(a=>{
    if (!isAdult(a) || a.partner || a.age<18) return;
    if (a.courting){ const b = alive(a.courting); if (!b || b.partner){ a.courting = null; return; }
      if (b.courting===a.id && a.id<b.id && peekRel(a,b.id).affinity>=70 && peekRel(b,a.id).affinity>=60 && S.minute-a.courtingSince > 14*DAY) civMarry(a, b); return; }
    const pool = Object.keys(a.rel).map(alive).filter(b=>b && isAdult(b) && !b.partner && b.age>=18 && Math.abs(b.age-a.age)<16 && mutual(a,b) && peekRel(a,b.id).affinity>45 && !peekRel(a,b.id).tags.includes('Family'));
    if (!pool.length) return;
    const b = pool.sort((x,y)=>peekRel(a,y.id).affinity-peekRel(a,x.id).affinity)[0];
    if (!b.courting || b.courting===a.id){ a.courting = b.id; a.courtingSince = S.minute; if (!b.courting){ b.courting = a.id; b.courtingSince = S.minute; } }
  });
  // strained marriages can end
  S.citizens.forEach(a=>{ const b = a.partner && alive(a.partner); if (!b || a.id>b.id) return; if (peekRel(a,b.id).affinity < -20 && peekRel(b,a.id).affinity < 0 && rnd()<0.02) civDivorce(a,b); });
}
function civMarry(a, b){
  a.partner = b.id; b.partner = a.id; a.courting = b.courting = null;
  [a,b].forEach(x=>{ const o = x===a?b:a; const r = getRel(x,o.id); r.tags = r.tags.filter(t=>t!=='Crush'); if (!r.tags.includes('Spouse')) r.tags.push('Spouse','Family'); r.affinity = Math.max(r.affinity, 80); });
  if (S.relStats){ S.relStats.marriages++; }
  const ha = hhOf(a), hb = hhOf(b); const [stay, go] = (ha && ha.home && (!hb || !hb.home || ha.members.length<=hb.members.length)) ? [a,b] : [b,a];
  const hs = hhOf(stay), hg = hhOf(go);
  if (hs && hg && hs!==hg){ if (hg.members.length===1 || hg.members.every(id=>{ const m = cById(id); return !m || m===go || (!isAdult(m) && m.parents.includes(go.id)); })) hhMembers(hg).forEach(m=>civJoinHH(m, hs)); else civJoinHH(go, hs); }
  indexCitizens();
  const was = {}; [a,b].forEach(x=>{ const old = marriedName(x, x===a?b:a); if (old){ was[x.id] = old; x.civ.lookKey = null; } });
  chronicle(`${was[a.id]||a.name} and ${was[b.id]||b.name} were married before the whole settlement.${[a,b].filter(x=>was[x.id]).map(x=>` She is now ${x.name}.`).join('')}`, 8, '💍', 'romance'); S.week.rels.push(`${a.name} & ${b.name} married`);
}
function civDivorce(a, b){
  a.partner = b.partner = null; [a,b].forEach(x=>{ const r = getRel(x,(x===a?b:a).id); r.tags = r.tags.filter(t=>t!=='Spouse'); }); [a,b].forEach(restoreBirthName);
  const nh = civNewHH(surnameOf(b), null); civJoinHH(b, nh); indexCitizens(); if (S.relStats) S.relStats.divorces++;
  chronicle(`${a.name} and ${b.name} have separated.`, 6, '💔', 'romance'); civProblem('dispute', 1);
}

// ---------- the evening fire: talk, barter, teaching and news ----------
function civSocialize(c){
  const here = S.citizens.filter(o=>o!==c && !o.rt.path && o.rt.loc===c.rt.loc && o.rt.state!=='Sleeping' && Math.abs(o.rt.x-c.rt.x)<=4 && Math.abs(o.rt.y-c.rt.y)<=4);
  if (!here.length) return;
  const o = here[hash(c.id+S.minute)%here.length];
  const R = peekRel(c, o.id), warm = (c.personality.agreeableness + o.personality.agreeableness)/2;
  adjustRel(c, o, (warm-0.4)*6 + 1 + (R.tags.includes('Family')?1:0)); adjustRel(o, c, (warm-0.4)*5 + 1);
  c.needs.social = clamp(c.needs.social+6,0,100); o.needs.social = clamp(o.needs.social+6,0,100);
  civShareKnowledge(c, o); civGossip(c, o);
  if (isAdult(c) && isAdult(o)) civBarter(c, o);
  if (c.id < o.id && rnd() < 0.04 && peekRel(c,o.id).affinity < 10 && (c.traits.includes('Stubborn') || o.traits.includes('Greedy'))) civQuarrel(c, o);
}
function civEveningGatherings(){ S.civ.gatherToday = 0; }

// ---------- reflection (replaces the town-centric legacy reflection) ----------
function civReflect(c){
  const h = hhOf(c), opts = [];
  if (h && hhFoodDays(h) < 1.5) opts.push('Our larder is nearly empty. We have to find more food.');
  const best = c.civ.dec.slice(-8).filter(d=>d.val!=null).sort((a,b)=>(b.val-b.exp)-(a.val-a.exp))[0]; if (best) opts.push(`${ACTIVITIES[best.act]?ACTIVITIES[best.act].label:'That work'} paid off better than I expected.`);
  const worst = c.civ.dec.slice(-8).filter(d=>d.val!=null && d.why).sort((a,b)=>(a.val-a.exp)-(b.val-b.exp))[0]; if (worst) opts.push(`${ACTIVITIES[worst.act]?ACTIVITIES[worst.act].label:'My work'} went badly: ${worst.why}.`);
  const g = c.civ.goals.find(x=>x.status==='active'); if (g) opts.push(`I keep thinking about my plan to ${GOAL_DEFS[g.kind] ? GOAL_DEFS[g.kind].label.toLowerCase() : g.kind}.`);
  if (!opts.length) opts.push('Another day of getting by.');
  remember(c, opts[Math.floor(rnd()*opts.length)], 5, [], 'Reflection'); c.memory.since = 0; c.memory.lastReflection = S.minute;
}

// ---------- problems the community notices (they drive gatherings, not scripts) ----------
function civProblem(kind, n, who){ const P = S.civ.problems; P[kind] = (P[kind]||0) + (n||1); if (who && who.civ) who.civ.worry = kind; }

// ---------- a new civilization ----------
function civNewState(seed){
  CIV_SEED = seed; RNG.s = seed;
  const st = {
    v:3, mode:'civ', minute:6*60, founded:Date.now(), memCounter:0, treasury:0, bridge:{health:100, closed:false},
    weather:'Clear', festival:false, herd:{cow:0, sheep:0, pig:0, chicken:0}, goods:{}, listings:[], citizens:[],
    gov:{proposals:[], nextId:1, cooldown:{}, leader:null, council:[], elections:[], campaign:null, platforms:{}},
    chronicle:[], weeks:[], week:null, terr:{}, props:{}, land:{sales:[]}, built:[], deceased:[], departed:[], biz:{}, extraPlots:[], demolished:[],
    teams:[], schemes:[], secrets:[], crimes:[], news:[], papers:{}, league:{}, matches:[], institutions:[], teamSeq:0, schemeSeq:0, secretSeq:0,
    wire:[], memSeq:0, evSeq:0, shortMem:{}, justice:{cases:[], seq:0, summary:0, disputes:0},
    relStats:{marriages:0, divorces:0, affairs:0, cheaters:[], married:[], adoptions:0}
  };
  TERRITORIES.forEach(t=>st.terr[t.id] = true);
  GOOD_DEFS.forEach(g => st.goods[g.id] = {price:g.base, dem:new Array(24).fill(0), sup:new Array(24).fill(0), unmet:new Array(24).fill(0), hist:[g.base]});
  st.civ = civBlankState(seed);
  return st;
}
function civBlankState(seed){
  return {v:1, seed, center:CIV_CENTER.slice(), hh:{}, hhSeq:0, structs:{}, sSeq:0, projects:{}, pSeq:0, parcels:{}, reserved:{}, edits:{}, tree:{}, rock:{}, stumps:{},
    traffic:{}, trail:{}, roads:{}, eco:null, commons:{}, rationToday:0, rationCap:220, problems:{}, stats:{}, history:[], animals:[], aSeq:0,
    deposits:[], dSeq:0, tech:{}, theories:{}, research:[], rSeq:0,
    econ:{stage:1, money:null, barter:0, barterFail:0, spots:{}, spot:null, prices:{}, listings:[], lSeq:0, vol:0, wkVol:0, wkTrades:0, district:false, stageHist:[]},
    orgs:{}, oSeq:0, jobs:[], jSeq:0, contracts:{}, kSeq:0, exchange:null, bonds:[],
    gov:{stage:0, form:null, meetings:[], council:[], leader:null, offices:{}, laws:{}, taxes:{}, depts:[], treasury:0, elections:[], stageHist:[]},
    justice:{stage:0, cases:[], seq:0, stageHist:[], jailed:[]},
    edu:{stage:1, schools:[], stageHist:[]}, sports:{teams:[], league:null, matches:[], seasons:[]},
    neighbors:[], shipments:[], shSeq:0, imports:{spent:0, n:0}, migration:{in:0, out:0},
    fin:{stage:0, stageHist:[]}, stageLabel:null, lod:true, dirtyGround:false, gatherToday:0};
}
// 100 people: 80 adults and 20 children in households, each with a crude shelter and some possessions
function civFoundSettlement(){
  const C = S.civ, r = crand('found');
  // who these people were, and how rich this valley is: the two things that make every seed different
  const o1 = ORIGINS[Math.floor(r()*ORIGINS.length)], o2 = r()<0.45 ? ORIGINS[Math.floor(r()*ORIGINS.length)] : null;
  C.origins = [o1.id].concat(o2 && o2!==o1 ? [o2.id] : []); C.originBg = o1.bg.concat(o2 && o2!==o1 ? o2.bg : []); C.originValues = o1.values.concat(o2 && o2!==o1 ? o2.values : []);
  C.land = {fish:+(0.6+r()*0.9).toFixed(2), game:+(0.5+r()*1.1).toFixed(2), forage:+(0.7+r()*0.6).toFixed(2), soil:+(0.7+r()*0.7).toFixed(2), ore:+(0.5+r()*1.2).toFixed(2)};
  const used = new Set(), surs = SURNAMES.concat(['Ashgrove','Bellweather','Corrin','Dray','Esker','Fallow','Grist','Harrow','Ingle','Jessop','Kell','Larch','Marlow','Norrey','Orrin','Pell','Rook','Sable','Tamsin','Vane','Wicker','Alder','Brisk','Crane','Dunn','Ember','Frost','Glen','Heath','Juniper','Kestrel','Lumen','Moss','Nimb','Oriel','Penn','Quint','Reed','Sorrel','Thorne'].filter(s=>!SURNAMES.includes(s)));
  const sur = () => { let s; do { s = surs[Math.floor(r()*surs.length)]; } while (used.has(s) && used.size < surs.length-1); used.add(s); return s; };
  const people = [];
  const add = o => { const c = civMakePerson(o, r); people.push(c); S.citizens.push(c); CBY[c.id] = c; return c; };
  const couple = (s, ageA) => { const ga = r()<0.5?'F':'M', same = r()<0.08, gb = same ? ga : (ga==='F'?'M':'F');
    const a = add({first:firstNameFor(ga,r), sur:s, age:ageA, gender:ga, orient: same ? 'gay' : 'straight'});
    const b = add({first:firstNameFor(gb,r), sur:s, age:clamp(ageA+Math.floor(r()*9)-4, 18, 75), gender:gb, orient: same ? 'gay' : 'straight'});
    a.partner = b.id; b.partner = a.id; [[a,b],[b,a]].forEach(([x,y])=>{ const R = getRel(x,y.id); R.affinity = 70+Math.floor(r()*25); R.trust = .85; R.familiarity = .95; R.tags = ['Spouse','Family']; });
    if (S.relStats){ S.relStats.marriages++; S.relStats.married.push(a.id, b.id); }
    return [a,b]; };
  const HH = [];
  // families: 20 children spread over 13 couples
  const kidsPer = [2,2,2,2,2,2,1,1,1,1,1,2,1]; let kidsLeft = 20;
  kidsPer.forEach(k=>{ const s = sur(), [a,b] = couple(s, 24+Math.floor(r()*18)); const mem = [a,b]; const mother = genderOf(a)==='F' ? a : genderOf(b)==='F' ? b : a;
    for (let i=0;i<k && kidsLeft>0;i++,kidsLeft--){ const ag = Math.min(15, Math.floor(r()*Math.min(16, mother.age-16))); const g = r()<0.5?'F':'M';
      const kid = add({first:firstNameFor(g,r), sur:s, age:ag, gender:g, parents:[a.id,b.id], genes: civGenes(r, a.civ.genes, b.civ.genes)}); mem.push(kid);
      [a,b].forEach(p=>{ p.kids.push(kid.id); const R = getRel(p,kid.id); R.affinity = 90; R.trust = .9; R.tags = ['Family']; const R2 = getRel(kid,p.id); R2.affinity = 85; R2.tags = ['Family']; }); }
    mem.filter(x=>!isAdult(x)).forEach(x=>mem.filter(y=>y!==x && !isAdult(y)).forEach(y=>{ const R = getRel(x,y.id); R.affinity = 55; R.tags = ['Family']; }));
    HH.push({name:s, mem, def: 'crude_hut'}); });
  // couples without children at home, and a few elder couples
  for (let i=0;i<9;i++){ const s = sur(), [a,b] = couple(s, i<3 ? 56+Math.floor(r()*14) : 19+Math.floor(r()*30)); HH.push({name:s, mem:[a,b], def: i<5 ? 'crude_hut' : 'lean_to'}); }
  // everyone else: single adults sharing shelters as siblings, friends or strangers thrown together
  let adults = people.filter(isAdult).length;
  const singles = []; while (adults < 80){ const g = r()<0.5?'F':'M'; singles.push({g, age:17+Math.floor(r()*38)}); adults++; }
  for (let i=0;i<singles.length;){
    const n = Math.min(singles.length-i, r()<0.4 ? 4 : r()<0.6 ? 3 : 2), s = sur(), sib = r()<0.4, mem = [];
    for (let k=0;k<n;k++,i++){ const o = singles[i]; mem.push(add({first:firstNameFor(o.g,r), sur: sib ? s : sur(), age:o.age, gender:o.g})); }
    mem.forEach(x=>mem.forEach(y=>{ if (x!==y){ const R = getRel(x,y.id); R.affinity = sib ? 50 : 20+Math.floor(r()*20); R.familiarity = .7; R.tags = sib ? ['Family'] : ['Housemate']; } }));
    HH.push({name: sib ? s : `${surnameOf(mem[0])} & co.`, mem, def: n>=4 ? 'longhouse' : 'crude_hut'});
  }
  // shelters in a loose ring around the commons
  const [cx, cy] = CIV_CENTER;
  HH.forEach((H,i)=>{
    const h = civNewHH(H.name, null);
    const site = civFindSite(H.def, [cx + Math.round(Math.cos(i*2.4)*(6+i*0.35)), cy + Math.round(Math.sin(i*2.4)*(4+i*0.25))], {margin:2, maxR:30}) || civFindSite(H.def, [cx, cy], {margin:1, maxR:34});
    if (site){ const s = civAddStruct(H.def, site.x, site.y, {k:'hh', id:h.id}, {cond: 55+Math.floor(r()*25), name:`${H.name} ${STRUCTURES[H.def].label.toLowerCase().replace('crude ','').replace('shared ','')}`}); s.occ = h.id; h.home = s.id; }
    H.mem.forEach(m=>civJoinHH(m, h));
    // possessions differ: a few households came with more
    const rich = r(), st = h.store;
    storeAdd(st, 'preserved', Math.round(H.mem.length*(2+rich*5))); storeAdd(st, 'roots', Math.round(H.mem.length*r()*3));
    storeAdd(st, 'water', H.mem.length*2); if (r()<0.55) storeAdd(st, 'tools', 1+Math.floor(rich*3)); if (r()<0.35) storeAdd(st, 'rope', 1+Math.floor(r()*3));
    if (r()<0.4) storeAdd(st, 'hide', 1+Math.floor(r()*4)); if (r()<0.3) storeAdd(st, 'cloth', 1+Math.floor(rich*4)); if (r()<0.25) storeAdd(st, 'pottery', 1+Math.floor(r()*3));
    storeAdd(st, 'beads', Math.floor(rich*rich*60)); if (rich>0.85) storeAdd(st, 'grain', 20+Math.floor(r()*30));
  });
  // the emergency cache they brought: enough for about a week, not a season
  storeAdd(C.commons, 'preserved', 1150); storeAdd(C.commons, 'grain', 700);
  people.forEach(c=>{ const h = hhOf(c); c.rt.x = c.rt.ox = LOC[c.home] && LOC[c.home].door ? LOC[c.home].door[0] : cx; c.rt.y = c.rt.oy = LOC[c.home] && LOC[c.home].door ? LOC[c.home].door[1] : cy; });
  // strangers mostly: a handful of friendships and grudges carried from the old place
  for (let i=0;i<40;i++){ const a = people[Math.floor(r()*people.length)], b = people[Math.floor(r()*people.length)]; if (a===b || peekRel(a,b.id).tags.includes('Family')) continue; const bad = r()<0.25; [[a,b],[b,a]].forEach(([p,q])=>{ const R = getRel(p,q.id); R.affinity = bad ? -35 : 45; R.trust = bad ? .2 : .6; R.familiarity = .6; R.tags = [bad?'Rival':'Friend']; }); }
  civEcoInit(); civDepositsInit(); civNeighborsInit(); civTechRecount();
  const ad = S.citizens.filter(isAdult), share = v => ad.filter(c=>c.values.includes(v)).length/Math.max(1,ad.length);
  C.culture = {freedom:+share('Freedom').toFixed(2), order:+share('Order').toFixed(2), community:+share('Community').toFixed(2), tradition:+share('Tradition').toFixed(2), prosperity:+share('Prosperity').toFixed(2)};
  indexCitizens();
}

// ---------- boot, save and load ----------
function civBootNew(seed){
  S = civNewState(seed); S.bubbles = [];
  civResetLocations(); civFrontierInit(); civFoundSettlement(); genderInit(false);
  civOpenWeek(); S.weather = 'Clear';
  S.citizens.forEach(c=>{ c.plan = civPlanDay(c, 0); });
  const ol = S.civ.origins.map(id=>ORIGINS.find(o=>o.id===id).label).join(' and ');
  chronicle(`A hundred people make camp by the river: eighty adults and twenty children, with crude shelters and a week of food. Most of them were ${ol}.`, 9, '🔥', 'founding');
  chronicle('There is no market, no council, no farm and no bridge. Whatever comes next, they will have to build it themselves.', 7, '🌲', 'founding');
  bumpWorld();
}
function civBootLoad(){
  CIV_SEED = S.civ.seed; civUpgradeSave(S);
  S.citizens.forEach(c=>{ c.rt.path = null; c.rt.seg = null; c.rt.blockIdx = -1; if (!c.plan || !c.plan.blocks) c.plan = null; });
  civResetLocations(); civFrontierInit();
  for (const k in S.civ.edits){ const [x, y] = tdec(k); if (tileAt(x,y)!==-1) MAP[y][x] = S.civ.edits[k]; }
  Object.values(S.civ.structs).forEach(civApplyStruct);
  Object.values(S.civ.projects).forEach(p=>civReserve(p, true));
  civIndexWater();
  indexCitizens(); civTechRecount(); bumpWorld();
}
// schema defaults for civ saves from earlier builds of this mode
function civUpgradeSave(st){
  const B = civBlankState(st.civ.seed);
  for (const k in B) if (st.civ[k]===undefined) st.civ[k] = B[k];
  ['econ','gov','justice','edu','sports','fin'].forEach(k=>{ for (const f in B[k]) if (st.civ[k][f]===undefined) st.civ[k][f] = B[k][f]; });
  if (st.civ.center) CIV_CENTER = st.civ.center.slice();
  st.citizens.forEach(c=>{ if (!c.civ) civPersonExt(c, mapRand(hash(c.id)), civGenes(mapRand(hash(c.id+'g')))); });
}
function civReserve(p, on){ for (let y=p.y-1;y<p.y+p.h+1;y++) for (let x=p.x-1;x<p.x+p.w+1;x++){ if (on) S.civ.reserved[tkey(x,y)] = p.id; else if (S.civ.reserved[tkey(x,y)]===p.id) delete S.civ.reserved[tkey(x,y)]; } }

// ---------- weekly log ----------
function civOpenWeek(){
  const d = dayOf(S.minute);
  S.week = {n:weekNo(d), startDay:d - d%7, civ:true, trades:0, volume:0, taxes:0, quarrels:0, events:[], hungry:[], rels:[], income:{}, spent:{}, weather:{},
    births:[], deaths:[], arrivals:[], departures:[], sales:[], builds:[], society:[], treasuryStart:S.civ.gov.treasury, popStart:S.citizens.length,
    foodStart: Math.round(storeFood(S.civ.commons)/90), stats0: Object.assign({}, S.civ.stats), prices:{}, herdStart:Object.assign({},S.herd), election:null, townHall:null, song:null};
}
function civWeekEntry(w, live){
  const byImp = w.events.slice().sort((a,b)=>b.imp-a.imp || b.t-a.t), C = S.civ;
  const avgMood = S.citizens.reduce((a,c)=>a+c.mood.valence,0)/Math.max(1,S.citizens.length);
  const delta = k => (C.stats[k]||0) - (w.stats0[k]||0);
  const occs = {}; S.citizens.forEach(c=>{ if (c.civ.occ) { const t = civOccTitle(c); occs[t] = (occs[t]||0)+1; } });
  return {civ:true, n:w.n, startDay:w.startDay, endDay:w.startDay+6, headline: byImp[0] ? byImp[0].text : (live ? 'The week is just getting started.' : 'A quiet week by the river.'),
    stats:{population:S.citizens.length, popStart:w.popStart, avgMood:+avgMood.toFixed(2), foodDays:+civFoodDaysAll().toFixed(1), barter:delta('barter'), trades:delta('trades'), built:delta('built'), research:delta('experiments'), hungry:w.hungry.length},
    stage:C.stageLabel, market:MARKET_STAGES[C.econ.stage], gov:GOV_STAGES[C.gov.stage], justice:JUSTICE_STAGES[C.justice.stage], edu:EDU_STAGES[C.edu.stage], fin:FIN_STAGES[C.fin.stage],
    occupations:occs, techs:Object.keys(C.tech).length, orgs:Object.keys(C.orgs).length,
    weather:w.weather, hungry:w.hungry.slice(), rels:w.rels.slice(), births:w.births.slice(), deaths:w.deaths.slice(), arrivals:w.arrivals.slice(), departures:w.departures.slice(), works:w.builds.slice(), society:w.society.slice(),
    highlights: byImp.slice(0,10).sort((a,b)=>a.t-b.t), song:w.song||null, prices:[], laws:Object.keys(C.gov.laws), ...civWeekExtras(w, delta)};
}
// justice, territory and opinion sections for the weekly report (left out when nothing happened)
function civWeekExtras(w, delta){
  const C = S.civ, jc = C.justice.cases.filter(k=>k.kind==='criminal'), inWk = k => k.judgment && k.judgment.day >= w.startDay;
  const J = {open: jc.filter(k=>k.status==='open').length, reported: jc.filter(k=>k.day >= w.startDay).length, arrests: delta('arrests'), trials: jc.filter(inWk).length, convictions: jc.filter(k=>inWk(k) && k.judgment.found).length, acquittals: jc.filter(k=>inWk(k) && !k.judgment.found).length, dismissed: delta('dismissed'), unsolved: delta('unsolved'), jail: S.citizens.filter(c=>c.jail).length};
  const T = {events:(w.territory||[]).slice(), out: S.world ? S.world.exp.filter(e=>e.status==='out').length : 0, regions: S.world ? Object.keys(S.world.cells).length : 0, annexed: typeof civAnnexed==='function' ? civAnnexed().length : 0, sites: typeof civAnnexed==='function' ? civAnnexed().reduce((a,c)=>a+Math.max(0,(c.sites||0)-(c.homes||0)),0) : 0};
  const ops = Object.entries(w.opShift||{}).filter(([k,v])=>Math.abs(v) >= 60 && !k.startsWith('p:')).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,4).map(([k,v])=>`${typeof topicLabel==='function' ? topicLabel(k) : k} ${v>0?'↑':'↓'}`);
  return {justiceWk: (J.reported||J.arrests||J.trials||J.unsolved||J.jail) ? J : null, territoryWk: (T.events.length||T.out) ? T : null, opinionWk: ops.length ? ops : null, protestsWk: (C.protests||[]).filter(p=>p.day >= w.startDay).map(p=>`${CIV_PROTEST[p.topic]||p.topic} (${p.n})`)};
}
function civWeekExtrasLines(w){
  const L = [], J = w.justiceWk, T = w.territoryWk;
  if (J) L.push(`⚖️ Justice: ${J.reported} crimes reported · ${J.arrests} arrests · ${J.trials} verdicts (${J.convictions} convicted, ${J.acquittals} acquitted)${J.dismissed?` · ${J.dismissed} dismissed`:''}${J.unsolved?` · ${J.unsolved} gone unsolved`:''} · ${J.open} open cases${J.jail?` · ${J.jail} in jail`:''}`);
  if (T) L.push(`🧭 Territory: ${T.events.join('; ')||'—'}${T.out?` · ${T.out} expedition${T.out>1?'s':''} out`:''} · ${T.regions} regions mapped, ${T.annexed} annexed${T.sites?` · room for ~${T.sites} more homes in the districts`:''}`);
  if (w.protestsWk && w.protestsWk.length) L.push(`✊ Protests: ${w.protestsWk.join('; ')}`);
  if (w.opinionWk) L.push(`💭 Opinion shifted on: ${w.opinionWk.join(', ')}`);
  return L;
}
function civCloseWeek(){ if (!S.week) return; const e = civWeekEntry(S.week, false); S.weeks.push(e); if (S.weeks.length>150) S.weeks.shift(); chronicle(`Week ${e.n} is in the books. ${e.headline}`, 5, '📖', 'week'); S.week = null; civOpenWeek(); }
function civWeekToMarkdown(w, live){
  const L = [], s = w.stats;
  L.push(`## Week ${w.n}${live?' (in progress)':''}: ${fmtDateShort(w.startDay)} – ${fmtDateShort(w.endDay)}`);
  L.push(`**Headline:** ${w.headline}`);
  L.push(`- ${w.stage||'Camp'} · population ${s.popStart} → ${s.population} · avg mood ${s.avgMood} · food in store ≈ ${s.foodDays} days`);
  L.push(`- Exchange: ${s.barter} barters, ${s.trades} sales · market: ${w.market} · finance: ${w.fin}`);
  L.push(`- Government: ${w.gov} · justice: ${w.justice} · education: ${w.edu} · ${w.techs} techniques known · ${w.orgs} organisations`);
  const oc = Object.entries(w.occupations||{}).sort((a,b)=>b[1]-a[1]); if (oc.length) L.push(`- Occupations: ${oc.map(([k,v])=>`${k} ×${v}`).join(', ')}`);
  L.push(`- Weather: ${Object.entries(w.weather).map(([k,v])=>`${k} ×${v}`).join(', ')||'n/a'}`);
  if (w.hungry.length) L.push(`- Went hungry: ${w.hungry.join(', ')}`);
  if (w.rels.length) L.push(`- Relationships: ${w.rels.join('; ')}`);
  if (w.births.length) L.push(`- Births: ${w.births.join('; ')}`); if (w.deaths.length) L.push(`- Deaths: ${w.deaths.join('; ')}`);
  if (w.arrivals.length) L.push(`- Arrivals: ${w.arrivals.join('; ')}`); if (w.departures.length) L.push(`- Departures: ${w.departures.join('; ')}`);
  if (w.works.length) L.push(`- Building: ${w.works.join('; ')}`); if (w.society.length) L.push(`- Society: ${w.society.join('; ')}`);
  civWeekExtrasLines(w).forEach(x=>L.push('- '+x));
  L.push('', '**Happenings**'); w.highlights.forEach(h=>L.push(`- ${fmtStamp(h.t)} ${h.icon} ${h.text}`));
  if (w.song) L.push('', `Theme song: https://suno.com/song/${w.song}`);
  return L.join('\n');
}
function civWeekHtml(w, live, idx){
  const s = w.stats, oc = Object.entries(w.occupations||{}).sort((a,b)=>b[1]-a[1]);
  return `<div class="week"><div class="wh"><b>Week ${w.n}${live?' (in progress)':''}</b> <span class="muted">${esc(fmtDateShort(w.startDay))} – ${esc(fmtDateShort(w.endDay))}</span></div><div class="wb">
    <p><b>${esc(w.headline)}</b></p>
    <p class="muted" style="font-size:13px">${esc(w.stage||'Camp')} · pop ${s.popStart}→${s.population} · mood ${s.avgMood} · food ≈ ${s.foodDays} days · ${s.barter} barters, ${s.trades} sales</p>
    <p style="font-size:13px">Market: <b>${esc(w.market)}</b> · Gov: <b>${esc(w.gov)}</b> · Justice: <b>${esc(w.justice)}</b> · Education: <b>${esc(w.edu)}</b> · Finance: <b>${esc(w.fin)}</b></p>
    ${oc.length?`<p style="font-size:13px">${oc.map(([k,v])=>`<span class="chip">${esc(k)} ×${v}</span>`).join('')}</p>`:''}
    ${civWeekExtrasLines(w).map(x=>`<p style="font-size:13px">${esc(x)}</p>`).join('')}
    ${w.hungry.length?`<p style="font-size:13px">🍞 Went hungry: ${esc(w.hungry.slice(0,12).join(', '))}${w.hungry.length>12?` +${w.hungry.length-12}`:''}</p>`:''}
    ${w.highlights.map(e=>`<div class="ev ${e.imp>=7?'major':''}"><time>${esc(fmtStamp(e.t))}</time><span>${esc(e.icon)}</span><span>${esc(e.text)}</span></div>`).join('')}
    <div class="row" style="margin-top:6px"><button class="btn" data-ballad="${live?'live':idx}" style="font-size:12px">Copy ballad prompt</button></div></div></div>`;
}
function civFoodDaysAll(){ const need = S.citizens.reduce((a,c)=>a+(isAdult(c)?90:62),0)||1; return (Object.values(S.civ.hh).reduce((a,h)=>a+storeFood(h.store),0) + storeFood(S.civ.commons) + civGranaryFood())/need; }
function civGranaryFood(){ return civHas(['granary','warehouse','cold_store']).reduce((a,s)=>a+storeFood(s.meta.store||{}),0); }
