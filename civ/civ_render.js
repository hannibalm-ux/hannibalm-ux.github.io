/* =====================================================================
   Pixel Town — civilization mode: 2D drawing
   Fires, the food cache, ford stones, oil seeps, woodpiles, building sites, wildlife and pens,
   and hover text for everything the settlers build.
   ===================================================================== */
// ---------- sprites: more animals, drawn like the originals ----------
const CIV_ANIMAL_LOOK = {
  goat:  {w:16,h:13, body:'#d8ccb4', dark:'#8a7a60', legs:'#6a5a44', horns:true, beard:true},
  horse: {w:26,h:20, body:'#8a5a34', dark:'#4a2a18', legs:'#5a3a22', mane:true, tall:true},
  dog:   {w:14,h:11, body:'#a8763e', dark:'#5a3a1e', legs:'#7a5228', ears:true, tail:true},
  cat:   {w:12,h:9,  body:'#7a7a82', dark:'#3a3a42', legs:'#5a5a62', ears:true, tail:true},
  deer:  {w:20,h:18, body:'#9a6a3a', dark:'#5a3a1e', legs:'#6a4424', antlers:true, tall:true},
  boar:  {w:18,h:12, body:'#4a3a30', dark:'#2a1e18', legs:'#2a2018', tusks:true},
  rabbit:{w:9, h:8,  body:'#a8987e', dark:'#6a5a44', legs:'#8a7a60', ears:true, small:true},
  wolf:  {w:18,h:13, body:'#7a7a80', dark:'#3a3a40', legs:'#5a5a60', ears:true, tail:true},
  bird:  {w:8, h:6,  body:'#5a4a3a', dark:'#2a2018', legs:'#e0a030', bird:true}
};
function civMakeAnimal(kind, variant, frame){
  const L = CIV_ANIMAL_LOOK[kind], p = new Pix(L.w, L.h), R = ramp(variant ? shade(L.body,0.8) : L.body, 5);
  if (L.bird){ blob(p,[{x:4,y:3.5,r:2.2},{x:5.8,y:2.4,r:1.4}],R,{}); p.set(7,2,'#e0a030'); p.set(6,2,'#101010'); const wy = frame ? 1 : 3; p.line(2,wy,4,3,L.dark); return p.outline().done(); }
  const legY = Math.round(L.h*0.62), legLen = L.h - legY - 1, cx = L.w*0.45, cy = L.h*0.45;
  [[0.28,0],[0.4,1],[0.62,0],[0.74,1]].forEach(([fx,i])=>{ const x = Math.round(L.w*fx), off = frame && i ? 1 : 0; for (let k=0;k<legLen-off;k++) p.set(x, legY+k, L.legs); p.set(x, legY+legLen-off, shade(L.legs,0.6)); });
  blob(p,[{x:cx-L.w*0.12,y:cy+0.5,r:L.h*0.26},{x:cx+L.w*0.1,y:cy,r:L.h*0.27}],R,{seed:hash(kind)%9});
  const hx = Math.round(L.w*0.82), hy = Math.round(L.h*(L.tall?0.22:0.34));
  blob(p,[{x:hx,y:hy,r:Math.max(1.6,L.h*0.17)}],R,{});
  p.set(hx+1, hy-1, '#101010');
  if (L.tall){ p.line(Math.round(L.w*0.66), Math.round(L.h*0.35), hx-1, hy+1, R[2]); }
  if (L.ears){ p.set(hx-1, hy-Math.round(L.h*0.2), L.dark); p.set(hx, hy-Math.round(L.h*0.22), L.dark); if (L.small){ p.line(hx-1, hy-1, hx-2, hy-4, R[3]); p.line(hx, hy-1, hx, hy-4, R[3]); } }
  if (L.horns){ p.line(hx-1, hy-2, hx-3, hy-4, '#d8d0c0'); }
  if (L.antlers){ p.line(hx-1, hy-2, hx-2, hy-6, '#c8b090'); p.line(hx-2, hy-4, hx-4, hy-5, '#c8b090'); p.line(hx, hy-2, hx+1, hy-6, '#c8b090'); }
  if (L.tusks){ p.set(hx+2, hy+1, '#f0e8d8'); }
  if (L.beard){ p.set(hx, hy+2, L.dark); p.set(hx, hy+3, L.dark); }
  if (L.mane){ for (let k=0;k<5;k++) p.set(Math.round(L.w*0.62)+k, Math.round(L.h*0.3)-Math.floor(k*0.6), L.dark); }
  if (L.tail){ p.line(Math.round(L.w*0.12), Math.round(L.h*0.4), 1, Math.round(L.h*0.2)+(frame?1:0), L.dark); }
  if (variant && kind==='horse'){ p.rect(hx-1, hy, 1, 1, '#f0f0f0'); }
  return p.outline().done();
}
function civArt(){
  for (const k in CIV_ANIMAL_LOOK) if (!ART.animals[k]) ART.animals[k] = [0,1].map(v=>[0,1].map(f=>civMakeAnimal(k,v,f)));
  if (ART.civ && ART.civ.season===ART.season) return;
  const A = ART.civ = {season:ART.season};
  A.fire = [0,1,2].map(f=>{ const p = new Pix(18,16); for (let k=0;k<8;k++){ const a = k/8*Math.PI*2; p.ellipse(9+Math.cos(a)*6, 12+Math.sin(a)*2.5, 1.6, 1.2, STONE_R[2+k%3]); } p.rect(5,11,8,2,WOOD_R[1]); p.line(5,12,13,10,WOOD_R[2]);
    const fl = ['#f8e070','#f8a030','#e05020']; for (let k=0;k<3;k++){ const h = 6+((f+k)%3)*2; for (let y=0;y<h;y++){ const w = Math.max(0, 2-Math.floor(y/3)); for (let x=-w;x<=w;x++) p.set(7+k*2+x, 11-y, fl[Math.min(2,Math.floor(y/2.5))]); } } return p.outline().done(); });
  A.sacks = (()=>{ const p = new Pix(22,14); [[5,9,4.5],[12,9,4.5],[18,10,3.6],[9,5,4]].forEach(([x,y,r],i)=>blob(p,[{x,y,r}],ramp(['#c8b080','#b8a070','#d0bc8c','#a89060'][i],5),{noise:0.2,seed:i})); p.line(4,4,5,6,WOOD_R[1]); return p.outline().done(); })();
  A.woodpile = (()=>{ const p = new Pix(16,9); for (let r=0;r<3;r++) for (let k=0;k<4-r;k++){ const x = 2+k*3.4+r*1.7, y = 7-r*2.4; p.ellipse(x, y, 1.7, 1.3, WOOD_R[3]); p.set(Math.round(x), Math.round(y), '#d8b070'); } return p.outline().done(); })();
  A.stonepile = (()=>{ const p = new Pix(14,9); [[4,6,2.6],[9,6,2.6],[6.5,3.5,2.4],[11,4.5,1.8]].forEach(([x,y,r],i)=>blob(p,[{x,y,r}],ROCK_R,{seed:i})); return p.outline().done(); })();
  A.derrick = (()=>{ const p = new Pix(18,34); p.line(3,33,9,1,'#3a3a44'); p.line(15,33,9,1,'#3a3a44'); for (let y=6;y<33;y+=6){ const w = y/33*6; p.line(Math.round(9-w),y,Math.round(9+w),y,'#4a4a54'); p.line(Math.round(9-w),y,Math.round(9+w*0.8),y+5,'#4a4a54'); } p.rect(6,30,7,3,'#2a2a30'); return p.outline().done(); })();
  // a known deposit: a heap of broken rock flecked with the ore's colour, and a flag once someone has claimed it
  A.ore = {}; for (const id in ORE_COL){ const p = new Pix(16,11); [[4,8,3],[10,8,3.2],[7,5,3],[12.5,5.5,2]].forEach(([x,y,r],i)=>blob(p,[{x,y,r}],ROCK_R,{seed:i+3})); const c = ORE_COL[id]; [[4,7],[9,8],[7,4],[11,6],[6,9],[12,4]].forEach(([x,y],i)=>{ p.set(x,y,c); if (i%2) p.set(x+1,y,shade(c,1.25)); }); A.ore[id] = p.outline().done(); }
  A.claim = (()=>{ const p = new Pix(8,14); p.rect(1,1,1,13,WOOD_R[2]); p.rect(2,1,5,4,'#e84a3a'); p.rect(2,4,5,1,'#b83020'); return p.done(); })();
  A.weeds = (()=>{ const p = new Pix(10,6); for (let k=0;k<6;k++){ const x = 1+k*1.5; p.line(Math.round(x),5,Math.round(x+(k%2?1:-1)),1+(k%3),['#4a7a2a','#6a9a3a','#5a8a30'][k%3]); } return p.done(); })();
  A.goals = (()=>{ const p = new Pix(10,14); p.rect(1,2,1,12,'#f0f0f0'); p.rect(8,2,1,12,'#f0f0f0'); p.rect(1,2,8,1,'#f0f0f0'); for (let y=3;y<13;y+=2) for (let x=2;x<8;x+=2) p.set(x,y,'#c8c8c8'); return p.done(); })();
  A.pit = (()=>{ const p = new Pix(30,18); p.ellipse(15,11,13,6,'#3a2a1e'); p.ellipse(15,11,9,4,'#140c08'); p.line(4,4,6,12,WOOD_R[2]); p.line(26,4,24,12,WOOD_R[2]); p.line(4,4,26,4,WOOD_R[3]); return p.outline().done(); })();
}
// ---------- ground overlay: ford stones, oil seeps, stumps ----------
function civGroundOverlay(g){
  g.setTransform(1,0,0,1,-WX0,-WY0);
  FORDS.forEach(k=>{ const [x, y] = tdec(k), X = x*TILE, Y = y*TILE; for (let i=0;i<3;i++){ const sx = X+3+i*5+(hashf(x,i,3)*2|0), sy = Y+5+(hashf(y,i,4)*6|0); g.fillStyle = STONE_R[3]; g.fillRect(sx,sy,4,3); g.fillStyle = STONE_R[5]; g.fillRect(sx,sy,3,1); g.fillStyle = 'rgba(210,235,255,0.6)'; g.fillRect(sx-1,sy+3,6,1); } });
  (S.civ.deposits||[]).forEach(d=>{ if (!d.seep) return; const X = d.x*TILE, Y = d.y*TILE; g.fillStyle = 'rgba(16,12,20,0.75)'; g.beginPath(); g.ellipse(X+8, Y+9, 7, 4, 0, 0, Math.PI*2); g.fill(); g.fillStyle = 'rgba(120,100,160,0.35)'; g.fillRect(X+5, Y+7, 4, 1); });
  civRailGround(g);
  for (const k in S.civ.stumps){ const [x, y] = tdec(k); if (tileAt(x,y)!==T.GRASS) continue; const X = x*TILE, Y = y*TILE; g.fillStyle = WOOD_R[2]; g.fillRect(X+6,Y+8,5,4); g.fillStyle = '#c8a070'; g.fillRect(X+6,Y+8,5,1); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(X+5,Y+12,7,1); }
}
// ---------- static things on the map ----------
function civStaticEnts(push){
  civArt(); const A = ART.civ;
  const [cx, cy] = S.civ.center;
  push(ART.civ.fire[0], cx*TILE-1, cy*TILE-4, cy*TILE+12, 'fire');
  civLightEnts(push);
  if (storeFood(S.civ.commons) > 0) push(ART.civ.sacks, (cx+4)*TILE, cy*TILE-2, cy*TILE+12);
  // the drover's cart and a few of the animals for sale, by the fire while the dealer is in town
  const DL = S.civ.dealer; if (DL && DL.status==='here'){ const bx = (cx-7)*TILE, by = (cy+3)*TILE; if (ART.cart) push(ART.cart, bx, by-8, by+8);
    Object.entries(DL.stock).filter(([k,q])=>q>0 && ART.animals[k]).flatMap(([k,q])=>Array(Math.min(q,2)).fill(k)).slice(0,5).forEach((k,i)=>{ const im = ART.animals[k][i%2][0]; push(im, bx+22+i*14, by-im.height+10+(i%2)*6, by+10+(i%2)*6); }); }
  Object.values(S.civ.structs).forEach(s=>{
    const D = STRUCTURES[s.def];
    if (D.prop==='well') push(ART.well, s.x*TILE-9, s.y*TILE-14, (s.y+1)*TILE);
    else if (D.prop==='stalls'){ for (let i=0;i<Math.min(3, Math.floor(s.w/2));i++) push(ART.stalls[i%3], (s.x+i*2)*TILE, (s.y+1)*TILE-6, (s.y+2)*TILE); }
    else if (D.prop==='firepit') push(ART.civ.fire[1], (s.x+1)*TILE-1, (s.y+1)*TILE-4, (s.y+1)*TILE+12, 'fire');
    else if (D.prop==='derrick') push(ART.civ.derrick, s.x*TILE-1, (s.y+1)*TILE-34, (s.y+1)*TILE);
    else if (D.prop==='goals'){ push(ART.civ.goals, s.x*TILE, (s.y+s.h/2)*TILE-12, (s.y+s.h/2)*TILE); push(ART.civ.goals, (s.x+s.w-1)*TILE+6, (s.y+s.h/2)*TILE-12, (s.y+s.h/2)*TILE); }
    if (D.home && s.occ && S.civ.hh[s.occ]){ const st = S.civ.hh[s.occ].store; if ((st.wood||0) > 8) push(ART.civ.woodpile, (s.x+s.w)*TILE+1, (s.y+s.h)*TILE-9, (s.y+s.h)*TILE); if ((st.stone||0) > 8) push(ART.civ.stonepile, (s.x-1)*TILE+2, (s.y+s.h)*TILE-9, (s.y+s.h)*TILE); }
    if (!D.tile && !D.prop && s.cond < 45){ for (let i=0;i<Math.min(3, s.w);i++) push(ART.civ.weeds, (s.x+i)*TILE+3, (s.y+s.h)*TILE-5, (s.y+s.h)*TILE+1); }
  });
  Object.values(S.civ.projects).forEach(p=>{ const D = STRUCTURES[p.def]; const X = p.x*TILE, Y = p.y*TILE, PW = p.w*TILE, PH = p.h*TILE;
    if (!D.tile && !D.prop && p.done > p.labor*0.1){ const im = ART.scaffold[p.done > p.labor*0.6 ? 1 : 0]; push(im, X+PW/2-im.width/2, Y+PH-im.height, Y+PH); }
    else [[0,0],[PW-4,0],[0,PH-6],[PW-4,PH-6]].forEach(([a,b])=>push(ART.stake, X+a, Y+b, Y+b+10)); });
  (S.civ.deposits||[]).filter(d=>d.mine && !S.civ.structs[d.mine]).forEach(d=>{ d.mine = null; });
  // known deposits nobody is mining yet stay marked on the map, so finds are easy to see
  (S.civ.deposits||[]).forEach(d=>{ if (!d.known || d.mine || d.left <= 0 || MIN[d.min].fluid || !A.ore[d.min]) return; const X = d.x*TILE, Y = d.y*TILE;
    push(A.ore[d.min], X, Y+4, Y+15, 'ore:'+d.min); if (d.claim) push(A.claim, X+11, Y-4, Y+15); });
}
const ORE_COL = {copper:'#d07a3a', tin:'#c8ccd4', iron:'#a0462e', coal:'#1a1a1e', lead:'#6a7080', zinc:'#9aa6b0', nickel:'#b8b89a', silver:'#e8eef4', gold:'#f2c64a', platinum:'#dfe6ea', gems:'#5ad0c8', salt:'#f4f0e6', rare:'#a870d8', clay:'#b86a44'};
function civSetGraves(){ const [cx, cy] = S.civ.center; GRAVE_SLOTS = []; for (let y=cy-8;y<=cy-6;y++) for (let x=cx-12;x<=cx-8;x++){ if (tileAt(x,y)===T.GRASS||tileAt(x,y)===T.FLOWER) GRAVE_SLOTS.push([x*TILE+2,y*TILE+2],[x*TILE+9,y*TILE+8]); } }
// ---------- animals: pens and wild herds ----------
function civSyncAnimals(){
  const C = S.civ, want = [];
  C.animals.forEach(a=>{ const pen = a.pen && C.structs[a.pen]; let bounds;
    if (pen) bounds = [(pen.x+1)*TILE, (pen.y+1)*TILE+6, (pen.x+pen.w-1)*TILE, (pen.y+pen.h-1)*TILE];
    else { const h = C.hh[a.owner.id], s = h && h.home && C.structs[h.home]; if (!s) return; bounds = [(s.x-1)*TILE, (s.y+s.h)*TILE, (s.x+s.w+1)*TILE, (s.y+s.h+2)*TILE]; }
    want.push({key:a.id, kind: a.kind==='goat' ? 'goat' : a.kind, variant: hash(a.id)%2, bounds, pers:a}); });
  // wildlife: a few visible animals for each cell that still has game
  C.eco.cells.forEach(e=>{ if (!e.g) return; const n = Math.min(3, Math.ceil(e.g/5)); for (let i=0;i<n;i++){ const x0 = e.cx*ECO_CELL*TILE, y0 = e.cy*ECO_CELL*TILE; want.push({key:`w${e.cx},${e.cy},${i}`, kind: i===2 && e.small>3 ? 'rabbit' : e.kind, variant:i%2, bounds:[x0+8, y0+8, x0+ECO_CELL*TILE-8, y0+ECO_CELL*TILE-8], wild:true}); } });
  const birds = Math.min(8, Math.round(C.eco.cells.reduce((a,e)=>a+e.fcap,0)/1200)); for (let i=0;i<birds;i++){ const x = (10+i*12)%OW; want.push({key:'b'+i, kind:'bird', variant:0, bounds:[x*TILE, 2*TILE, (x+10)*TILE, (OH-4)*TILE], wild:true, bird:true}); }
  const keep = new Map(ANIMALS.map(a=>[a.key, a]));
  ANIMALS.length = 0;
  want.forEach(w=>{ let a = keep.get(w.key); if (!a || a.kind!==w.kind){ const r = Math.random; a = {key:w.key, kind:w.kind, variant:w.variant, x:w.bounds[0]+r()*(w.bounds[2]-w.bounds[0]), y:w.bounds[1]+r()*(w.bounds[3]-w.bounds[1]), tx:0, ty:0, wait:r()*3, face:r()<0.5?1:-1, walk:0}; } Object.assign(a, {bounds:w.bounds, wild:!!w.wild, bird:!!w.bird, pers:w.pers||null}); ANIMALS.push(a); });
  S.civ.animKey = civAnimKey();
}
function civAnimKey(){ return S.civ.animals.length + ':' + S.civ.eco.cells.reduce((a,e)=>a+(e.g?Math.ceil(e.g/5):0),0) + ':' + Object.keys(S.civ.structs).length; }
// wild animals keep their distance from people
function civAnimalFlee(a){
  if (!a.wild || a.bird) return false;
  for (const c of S.citizens){ const dx = a.x - (c.rt.x*TILE+10), dy = a.y - (c.rt.y*TILE+14); if (dx*dx+dy*dy < 44*44){ a.tx = clamp(a.x + Math.sign(dx||1)*70, a.bounds[0], a.bounds[2]); a.ty = clamp(a.y + Math.sign(dy||1)*40, a.bounds[1], a.bounds[3]); a.wait = 0; a.flee = 1.5; return true; } }
  return false;
}
function civLights(L, inV){
  const [cx, cy] = S.civ.center, X = cx*TILE+8, Y = cy*TILE+6;
  if (inV(X,Y,90)) L.push([X, Y, 86, 1, 'rgba(255,140,50,0.35)']);
  civStructsOf(s=>STRUCTURES[s.def].prop==='firepit').forEach(s=>{ const x = (s.x+1.5)*TILE, y = (s.y+1.5)*TILE; if (inV(x,y,70)) L.push([x,y,64,0.9,'rgba(255,140,50,0.3)']); });
  civTransportLights(L, inV);
}
// ---------- hover text ----------
function civHover(x, y){
  const tx = Math.floor(x/TILE), ty = Math.floor(y/TILE), C = S.civ;
  const s = civStructAt(tx, ty) || civStructsOf(z=>z.tiles && z.tiles.some(([a,b])=>a===tx&&b===ty))[0];
  if (s){ const D = STRUCTURES[s.def]; let extra = '';
    if (D.farm) extra = `<br>${s.meta.stage==='growing' ? `${CG[s.meta.crop].name} growing (${Math.round((s.meta.growth||0)*100)}%)` : s.meta.stage==='ripe' ? `${CG[s.meta.crop].name} ready to harvest` : 'fallow'}`;
    if (D.ranch) extra = `<br>${C.animals.filter(a=>a.pen===s.id).length} animals`;
    if (D.home){ const h = C.hh[s.occ]; extra = h ? `<br>${h.members.length} living here · food ${hhFoodDays(h).toFixed(1)} days` : '<br><span class="muted">empty</span>'; }
    if (D.bridge) extra = `<br>${Math.round(s.cond)}% sound${s.meta.toll && civMoneyOn()?` · toll ${s.meta.toll}¢`:''}`;
    if (D.mine && s.meta.deposit){ const d = C.deposits.find(x=>x.id===s.meta.deposit); if (d) extra = `<br>${MIN[d.min].label}: ${Math.round(d.left)} of ${d.size} left`; }
    return `<b>${esc(s.name)}</b><br><span class="muted">${esc(D.label)} · ${esc(civOwnerLabel(s.owner))} · condition ${Math.round(s.cond)}%${civMoneyOn()?` · worth ${s.value}¢`:''}${s.forSale?' · for sale':''}</span>${extra}`; }
  const p = Object.values(C.projects).find(p=>tx>=p.x-1 && ty>=p.y-1 && tx<=p.x+p.w && ty<=p.y+p.h);
  if (p){ const mf = civProjectMatFrac(p); return `<b>Building: ${esc(STRUCTURES[p.def].label)}</b><br>${esc(civOwnerLabel(p.owner))}<br><span class="muted">materials ${Math.round(mf*100)}% · work ${Math.round(p.done/p.labor*100)}%</span>`; }
  const [cx, cy] = C.center; if (Math.abs(tx-cx)<=1 && Math.abs(ty-cy)<=1) return `<b>The fire</b><br><span class="muted">Where the settlement gathers in the evening</span>`;
  if (Math.abs(tx-cx-4.5)<=1 && Math.abs(ty-cy)<=1) return `<b>The supply cache</b><br><span class="muted">${Math.round(storeFood(C.commons)/90)} person-days of food left</span>`;
  if (FORDS.has(tkey(tx,ty))) return `<b>The ford</b><br><span class="muted">${civFordOk(tx,ty)?'Shallow enough to wade':'Too high to cross today'}</span>`;
  const d = C.deposits.find(d=>(d.known||d.seep) && Math.abs(d.x-tx)<=1 && Math.abs(d.y-ty)<=1);
  if (d) return d.known ? `<b>${MIN[d.min].label} deposit</b><br><span class="muted">${d.claim?`claimed by ${esc(civOwnerLabel(d.claim.who))}`:'unclaimed'}</span>` : `<b>Black ooze</b><br><span class="muted">Something seeps out of the ground here</span>`;
  const t = tileAt(tx,ty); if (t===T.TREE) return `<b>Woodland</b>`; if (t===T.WATER) return ty>36 ? '<b>The lake</b>' : '<b>The river</b>'; if (t===T.ROCK) return '<b>Rocky ground</b>';
  if (t===T.PATH) return C.roads[tkey(tx,ty)] ? '<b>Road</b>' : '<b>A trail worn by feet</b>';
  return '';
}
