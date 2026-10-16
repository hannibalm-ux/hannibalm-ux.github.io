/* =====================================================================
   Pixel Town — HD 3D remaster, part 2: the living world
   Grass, flowers, reeds and pebbles in chunks around the camera; trees made of leaf cards; natural rocks;
   crops by growth stage; fences, bridges, docks and rails; buildings assembled from boards, stone, shingles
   and thatch with real windows and doors; context clutter; smoke, sparks, fireflies, pollen and leaves.
   ===================================================================== */

// ---------- wind: every swaying thing shares these uniforms ----------
const HD_WIND = {uTime:{value:0}, uWind:{value:0.6}, uCam:{value:null}, uR:{value:30}}; // uCam is made when Three.js has loaded
function hdWindify(m, opt){
  opt = opt || {}; const prev = m.onBeforeCompile;
  m.onBeforeCompile = sh => { if (prev) prev(sh); Object.assign(sh.uniforms, HD_WIND);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime, uWind, uR; uniform vec3 uCam;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 hdIw = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
        #else
          vec4 hdIw = modelMatrix * vec4(0.0,0.0,0.0,1.0);
        #endif
        float hdY = max(position.y, 0.0) * ${opt.k || '1.0'};
        float hdS = sin(uTime*1.7 + hdIw.x*0.61 + hdIw.z*0.43) * 0.6 + sin(uTime*2.9 + hdIw.x*1.7) * 0.25 + 0.3;
        transformed.x += hdS * hdY * hdY * uWind * ${opt.amp || '0.12'};
        transformed.z += cos(uTime*1.3 + hdIw.z*0.77) * hdY * hdY * uWind * ${opt.amp || '0.12'} * 0.5;
        ${opt.fade ? 'float hdD = distance(hdIw.xz, uCam.xz); transformed *= 1.0 - smoothstep(uR*0.72, uR, hdD);' : ''}`); };
  m.customProgramCacheKey = () => 'wind' + (opt.fade?1:0) + (opt.k||'') + (opt.amp||'') + (opt.key||'');
  return m;
}
// geometry with vertex colours from parts (reuses lpMerge from civ_3d.js)
function hdGeo(parts){ return lpMerge(parts); }

// =====================================================================
// grass, flowers, reeds, pebbles: chunks of instances around the camera
// =====================================================================
const HD_CH = 8;
function hdBladeClump(n, hMin, hMax, seed){
  const pos = [], col = [], nor = [], r = mapRand(seed);
  for (let b=0;b<n;b++){ const a = r()*Math.PI*2, d = r()*0.13, x = Math.cos(a)*d, z = Math.sin(a)*d, h = hMin + r()*(hMax-hMin), w = 0.022 + r()*0.016, rot = r()*Math.PI, lean = (r()-0.5)*0.5;
    const cx = Math.cos(rot)*w, cz = Math.sin(rot)*w, lx = Math.cos(a)*lean*h, lz = Math.sin(a)*lean*h;
    const P = [[x-cx, 0, z-cz], [x+cx, 0, z+cz], [x-cx*0.7+lx*0.35, h*0.5, z-cz*0.7+lz*0.35], [x+cx*0.7+lx*0.35, h*0.5, z+cz*0.7+lz*0.35], [x+lx, h, z+lz]];
    const C = [0.42, 0.42, 0.75, 0.75, 1.08].map(k=>k*(0.9 + r()*0.2));
    [[0,1,3],[0,3,2],[2,3,4]].forEach(t=>t.forEach(i=>{ pos.push(...P[i]); col.push(C[i], C[i], C[i]); nor.push(0,1,0); })); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col,3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor,3)); return g;
}
function hdVegAssets(){
  if (HD.veg) return HD.veg; const g = lpG(), V = HD.veg = {};
  V.grass = hdBladeClump([4, 6, 8][HD.q], 0.14, 0.34, 11);
  V.tall = hdBladeClump([4, 6, 8][HD.q], 0.3, 0.6, 12);
  V.flower = (()=>{ const P = [lpPart(g.cyl, '#4a7a2a', [0,0.1,0], [0,0,0], [0.008,0.2,0.008])]; for (let k=0;k<5;k++){ const a = k/5*Math.PI*2; P.push(lpPart(g.sph, '#ffffff', [Math.cos(a)*0.028, 0.205, Math.sin(a)*0.028], [0,0,0], [0.024,0.008,0.024])); } P.push(lpPart(g.sph, '#f0c040', [0,0.21,0], [0,0,0], [0.014,0.01,0.014])); return hdGeo(P); })();
  V.reed = (()=>{ const P = []; for (let k=0;k<4;k++){ const x = (k%2-0.5)*0.08, z = (k>1?-0.04:0.04), h = 0.55 + k*0.08; P.push(lpPart(g.cyl, '#5a7a3a', [x,h/2,z], [(k-1.5)*0.05,0,(k%2-0.5)*0.08], [0.012,h,0.012])); if (k%2) P.push(lpPart(g.cyl, '#6a4a2a', [x,h+0.02,z], [0,0,0], [0.02,0.1,0.02])); } return hdGeo(P); })();
  V.pebble = (()=>{ const P = []; for (let k=0;k<3;k++) P.push(lpPart(g.dod, ['#6a6660','#7a746c','#5a5650'][k], [(k-1)*0.07, 0.015, (k%2)*0.05], [k,k*2,0], [0.035+k*0.01,0.025,0.03+k*0.008])); return hdGeo(P); })();
  // a fern: nine tapering fronds that arch up and droop at the tips, dark at the heart and bright at the ends
  V.fern = (()=>{ const pos = [], col = [], nor = [], N = 9, SEG = 4, dark = new THREE.Color('#2e5420'), lite = new THREE.Color('#7aa83e'), r = mapRand(77);
    for (let f=0; f<N; f++){ const a = f/N*Math.PI*2 + r()*0.4, L = 0.32 + r()*0.12, ca = Math.cos(a), sa = Math.sin(a); let prev = null;
      for (let k=0; k<=SEG; k++){ const t = k/SEG, d = t*L, y = 0.02 + Math.sin(t*Math.PI*0.85)*0.2*L/0.32 - t*t*0.06, w = 0.055*(1 - t*0.85), px = ca*d, pz = sa*d, wx = -sa*w, wz = ca*w, c = dark.clone().lerp(lite, t);
        const cur = [[px - wx, y, pz - wz], [px + wx, y, pz + wz]];
        if (prev){ const q = [prev[0], prev[1], cur[1], prev[0], cur[1], cur[0]]; q.forEach(p=>{ pos.push(...p); col.push(c.r, c.g, c.b); nor.push(0, 1, 0); }); }
        prev = cur; } }
    const G = new THREE.BufferGeometry(); G.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); G.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); G.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); G.computeBoundingSphere(); return G; })();
  // a leafy shrub of overlapping clumps, for the foot of walls and fences
  V.shrub = (()=>{ const P = [], r = mapRand(78), cols = ['#3e6a26','#4e7a2e','#5a8a34','#466e28']; for (let k=0;k<6;k++){ const a = k/6*Math.PI*2 + r(), d = 0.08 + r()*0.12, s = 0.13 + r()*0.08; P.push(lpPart(g.ico, cols[k%4], [Math.cos(a)*d, s*0.8 + r()*0.08, Math.sin(a)*d], [r(), r()*3, r()], [s, s*0.85, s])); } P.push(lpPart(g.ico, '#5a8a34', [0, 0.3, 0], [0,0,0], [0.15,0.13,0.15])); return hdGeo(P); })();
  // a flat stepping stone set into a path
  V.paver = (()=>{ const P = [lpPart(g.ico0, '#8e877a', [0, 0.01, 0], [0, 0.3, 0], [0.2, 0.04, 0.16])]; return hdGeo(P); })();
  V.mush = (()=>hdGeo([lpPart(g.cyl, '#e8e0d0', [0,0.035,0], [0,0,0], [0.012,0.07,0.012]), lpPart(g.half, '#b83a2a', [0,0.065,0], [0,0,0], [0.04,0.035,0.04]), lpPart(g.cyl, '#e8e0d0', [0.06,0.025,0.03], [0,0,0], [0.01,0.05,0.01]), lpPart(g.half, '#c8a070', [0.06,0.05,0.03], [0,0,0], [0.03,0.025,0.03])]))();
  const std = o => new THREE.MeshStandardMaterial(Object.assign({vertexColors:true, roughness:0.85, metalness:0}, o));
  V.mGrass = hdWindify(std({side:THREE.DoubleSide}), {fade:true, amp:'0.9', key:'g'});
  V.mFlower = hdWindify(std({}), {fade:true, amp:'0.5', key:'f'});
  V.mReed = hdWindify(std({}), {fade:true, amp:'0.25', key:'r'});
  V.mStatic = std({roughness:0.9}); V.mStatic.onBeforeCompile = sh => { Object.assign(sh.uniforms, HD_WIND); sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uR; uniform vec3 uCam;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 hdIw = instanceMatrix * vec4(0.,0.,0.,1.); transformed *= 1.0 - smoothstep(uR*0.72, uR, distance(hdIw.xz, uCam.xz));'); }; V.mStatic.customProgramCacheKey = () => 'hdStatic';
  return V;
}
function hdSeasonGreen(r, season, wear){
  const sets = [['#5a9a36','#6aaa3e','#4a8a30','#7ab046'], ['#4a8230','#3e7428','#5a8e36','#628a34'], ['#8a9a3e','#9a8a3a','#7a8a36','#a89a4a'], ['#8a9a7a','#9aa088','#7a8a6a','#aab0a0']][season];
  const c = new THREE.Color(sets[Math.floor(r*4)]); if (wear) c.lerp(new THREE.Color('#8a7a52'), wear*0.5); return c;
}
function hdBuildChunk(cx, cz){
  const V = hdVegAssets(), grp = new THREE.Group(), season = ART.season, q = HD.q, dens = [3, 6, 11][q];
  const lists = {grass:[], tall:[], flower:[], reed:[], pebble:[], fern:[], mush:[], paver:[], shrub:[]};
  const x0 = cx*HD_CH, z0 = cz*HD_CH, r = mapRand(hash('ch'+cx+','+cz+':'+season));
  for (let z=z0; z<z0+HD_CH; z++) for (let x=x0; x<x0+HD_CH; x++){
    const t = tileAt(x, z); if (t===-1 || t===T.FOG) continue; const i = (z-Y0)*MW + (x-X0), toW = HD.toWater ? HD.toWater[i] : 9;
    const k = hdSurfaceOf(t), wear = HD.tdData ? HD.tdData[i*4+1]/255 : 0;
    let n = 0, tall = 0, fl = 0, reed = 0, peb = 0, fern = 0, mush = 0, shrub = 0;
    if (k===0 || k===9){ n = dens*(1 - wear*0.8); fl = k===9 ? 5 : (hdNoise(x*0.15, z*0.15, 1e6, 3) > 0.68 ? 2 : 0); if (toW < 2) { tall = 2; reed = toW===1 ? 2 : 0; } }
    else if (k===6){ n = dens*0.55; }
    else if (k===7){ n = dens*0.25; fern = 2; mush = hdHash(x,z,4) < 0.15 ? 1 : 0; }
    else if (k===2){ n = dens*0.12; tall = hdHash(x,z,6) < 0.3 ? 1 : 0; }
    else if (k===1){ peb = hdHash(x,z,8) < 0.2 ? 1 : 0; n = wear < 0.5 ? dens*0.15 : 0; }
    else if (k===3){ tall = 1; peb = 1; }
    else if (k===8){ const d = HD.depth ? HD.depth[i] : 1; if (d < 0.3) { peb = 2; reed = d < 0.2 && hdHash(x,z,7) < 0.3 ? 1 : 0; } }
    // ferns where the grass meets the forest and at the foot of walls
    if (k===0 || k===9){ const nb = [[1,0],[-1,0],[0,1],[0,-1]].map(([a,b])=>tileAt(x+a, z+b)); if (nb.includes(T.TREE) && hdHash(x,z,12) < 0.7) fern += 1; if ((nb.includes(T.BUILD) || nb.includes(T.OBJ)) && hdHash(x,z,13) < 0.45) fern += 1; if ((nb.includes(T.BUILD) || nb.includes(T.FENCE)) && hdHash(x,z,16) < 0.3) shrub = 1; }
    const pave = k===1 ? (hdHash(x,z,14) < 0.6 ? 1 : 0) + (hdHash(x,z,15) < 0.35 ? 1 : 0) : 0;
    if (season===3){ n *= 0.4; fl = 0; fern = 0; mush = 0; }
    if (season===2){ fl = Math.floor(fl*0.3); }
    // grass grows thicker along fences and around rocks and buildings
    const near = [[1,0],[-1,0],[0,1],[0,-1]].map(([a,b])=>tileAt(x+a, z+b)); if (near.some(u=>u===T.FENCE||u===T.ROCK||u===T.BUILD||u===T.OBJ) && (k===0||k===9)) tall += 2;
    const put = (list, cnt, sMin, sMax) => { for (let c=0;c<cnt;c++){ if (cnt < 1 && r() > cnt) break; const px = x + r(), pz = z + r(); list.push([px, hdHeightAt(px, pz), pz, sMin + r()*(sMax-sMin), r()*6.283, r()]); } };
    put(lists.paver, pave, 0.75, 1.3); if (season!==3) put(lists.shrub, shrub, 0.8, 1.35);
    put(lists.grass, Math.round(n), 0.75, 1.25); put(lists.tall, tall, 0.8, 1.3); put(lists.flower, fl, 0.8, 1.3); put(lists.reed, reed, 0.8, 1.4); put(lists.pebble, peb, 0.6, 1.6); put(lists.fern, fern, 0.7, 1.4); put(lists.mush, mush, 0.8, 1.3);
  }
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), up = new THREE.Vector3(0,1,0), C = new THREE.Color();
  const FL = ['#f2d04a','#e87aa8','#ffffff','#9a7ae8','#e84a4a','#f0a040'];
  const add = (list, geo, mat, colFn, shadow) => { if (!list.length) return; const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach(([x,y,z,s,rot,v],i)=>{ q4.setFromAxisAngle(up, rot); m4.compose(new THREE.Vector3(x,y,z), q4, new THREE.Vector3(s,s*(0.85+v*0.3),s)); im.setMatrixAt(i, m4); if (colFn) im.setColorAt(i, colFn(v, x, z)); });
    im.receiveShadow = true; im.castShadow = !!shadow; im.frustumCulled = true; im.computeBoundingSphere(); grp.add(im); };
  add(lists.grass, V.grass, V.mGrass, (v, x, z)=>hdSeasonGreen(v, season, HD.tdData ? HD.tdData[((Math.floor(z)-Y0)*MW + Math.floor(x)-X0)*4+1]/255 : 0));
  add(lists.tall, V.tall, V.mGrass, v=>hdSeasonGreen(v, season, 0).multiplyScalar(0.9));
  add(lists.flower, V.flower, V.mFlower, v=>C.set(FL[Math.floor(v*FL.length)]));
  add(lists.reed, V.reed, V.mReed, v=>C.setScalar(0.85 + v*0.3));
  add(lists.pebble, V.pebble, V.mStatic, v=>C.setScalar(0.8 + v*0.4), false);
  add(lists.fern, V.fern, V.mFern || (V.mFern = hdWindify(new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.8, metalness:0, side:THREE.DoubleSide}), {fade:true, amp:'0.35', key:'fern'})), v=>C.set(season===2 ? '#c8a050' : '#ffffff').multiplyScalar(0.85+v*0.3));
  add(lists.paver, V.paver, V.mStatic, v=>C.setScalar(0.75 + v*0.4), false);
  add(lists.shrub, V.shrub, V.mReed, v=>C.set(season===2 ? '#d8a050' : '#ffffff').multiplyScalar(0.85 + v*0.3), true);
  add(lists.mush, V.mush, V.mStatic, v=>C.setScalar(0.9+v*0.2));
  grp.userData.key = HD.vegKey;
  return grp;
}
// what a chunk's plants depend on: its tiles and their neighbours, the season and the quality tier
function hdChunkSig(cx, cz){ let h = 2166136261; for (let z=cz*HD_CH-1; z<=cz*HD_CH+HD_CH; z++) for (let x=cx*HD_CH-1; x<=cx*HD_CH+HD_CH; x++) h = Math.imul(h ^ (tileAt(x,z)+2), 16777619); return h + '|' + ART.season + '|' + HD.q; }
// chunks near the camera are built first, a few milliseconds' worth per frame; a ring beyond the view is built ahead of time,
// and chunks are kept, so panning back and forth never rebuilds them; a chunk is only rebuilt when its own tiles change
function hdVegUpdate(){
  const R = HD.q===0 ? 12 : HD.q===1 ? 20 : 30; HD_WIND.uR.value = R;
  const tx = cam.x/TILE, tz = cam.y/TILE; HD_WIND.uCam.value.set(tx, 0, tz);
  const pre = R + HD_CH*2.5, wv = S.worldVer||0;
  const c0x = Math.floor((tx-pre)/HD_CH), c1x = Math.floor((tx+pre)/HD_CH), c0z = Math.floor((tz-pre)/HD_CH), c1z = Math.floor((tz+pre)/HD_CH);
  const cands = []; for (let cz=c0z; cz<=c1z; cz++) for (let cx=c0x; cx<=c1x; cx++){ const d = Math.hypot((cx+0.5)*HD_CH - tx, (cz+0.5)*HD_CH - tz); if (d > pre) continue; cands.push([d, cx, cz]); }
  cands.sort((a,b)=>a[0]-b[0]);
  const t0 = performance.now(), budget = HD.moving ? 1.5 : 3; let built = 0; // a small slice of each 60 fps frame
  for (const [d, cx, cz] of cands){ const k = cx+','+cz; let ch = HD.chunks.get(k); const inView = d <= R + HD_CH;
    if (ch && ch.userData.wv !== wv){ ch.userData.wv = wv; const sig = hdChunkSig(cx, cz); if (sig !== ch.userData.sig) ch.userData.stale = true; }
    const need = !ch || ch.userData.stale;
    if (need && (built === 0 && inView && !ch || performance.now() - t0 < budget)){
      built++; const nch = hdBuildChunk(cx, cz); nch.userData.sig = hdChunkSig(cx, cz); nch.userData.wv = wv; R3.scene.add(nch); if (ch){ R3.scene.remove(ch); hdDisposeChunk(ch); } HD.chunks.set(k, nch); ch = nch; }
    if (ch){ ch.visible = inView; ch.userData.seen = t0; } }
  // forget the chunks furthest from here when too many are kept
  if (HD.chunks.size > 260){ const list = [...HD.chunks.entries()].sort((a,b)=>a[1].userData.seen - b[1].userData.seen); for (const [k, ch] of list.slice(0, HD.chunks.size - 220)){ R3.scene.remove(ch); hdDisposeChunk(ch); HD.chunks.delete(k); } }
  for (const ch of HD.chunks.values()) if (ch.userData.seen !== t0) ch.visible = false;
}
function hdDisposeChunk(ch){ ch.children.forEach(o=>{ if (o.dispose) o.dispose(); }); }
function hdClearChunks(){ for (const [k, ch] of HD.chunks){ R3.scene.remove(ch); hdDisposeChunk(ch); } HD.chunks.clear(); HD.veg = null; }

// =====================================================================
// trees: trunks and branches with leaf-card crowns that sway
// =====================================================================
function hdLeafTex(kind){
  const key = 'leaf_'+kind; if (HD.tex[key]) return HD.tex[key];
  const N = 256, c = mk(N, N), g = c.getContext('2d'), r = mapRand(hash(key));
  if (kind==='pine'){ for (let k=0;k<22;k++){ const x = N*0.5 + (r()-0.5)*N*0.5, y = N*(0.15+r()*0.7), len = N*(0.18+r()*0.2), a = -Math.PI/2 + (r()-0.5)*1.2; g.strokeStyle = `rgb(${80+r()*40|0},${125+r()*50|0},${70+r()*30|0})`; g.lineWidth = 3;
      for (let s=0;s<16;s++){ const t = s/16, px = x + Math.cos(a)*len*t, py = y + Math.sin(a)*len*t; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a+1.1)*N*0.06, py + Math.sin(a+1.1)*N*0.06); g.moveTo(px, py); g.lineTo(px + Math.cos(a-1.1)*N*0.06, py + Math.sin(a-1.1)*N*0.06); g.stroke(); } } }
  else { for (let k=0;k<90;k++){ const x = N*0.5 + (r()-0.5)*N*0.85*Math.sqrt(r()), y = N*0.5 + (r()-0.5)*N*0.85*Math.sqrt(r()), s = N*(0.04+r()*0.05), a = r()*Math.PI*2;
      if (Math.hypot(x-N/2, y-N/2) > N*0.46) continue; const l = 90 + r()*90; g.save(); g.translate(x, y); g.rotate(a); const gr = g.createLinearGradient(-s, 0, s, 0); gr.addColorStop(0, `rgb(${l*0.55|0},${l|0},${l*0.4|0})`); gr.addColorStop(1, `rgb(${l*0.75|0},${Math.min(255,l*1.25)|0},${l*0.55|0})`); g.fillStyle = gr;
      g.beginPath(); g.ellipse(0, 0, s, s*0.45, 0, 0, Math.PI*2); g.fill(); g.strokeStyle = 'rgba(40,60,20,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-s,0); g.lineTo(s,0); g.stroke(); g.restore(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.shared = true; return HD.tex[key] = t;
}
// one tree variant: trunk geometry (bark colours) and crown geometry (leaf cards with normals pointing out of the crown)
// lod 1: the same tree seen from afar, with about a third of the leaf cards, each a little larger
function hdTreeVariant(kind, seed, lod){
  const g = lpG(), r = mapRand(seed), trunk = [], cards = [], f = lod ? 0.3 : 1, cs = lod ? 1.55 : 1;
  const bark = kind==='birch' ? '#e8e4d8' : '#5a4030';
  const addCard = (cx, cy, cz, ccx, ccy, ccz, s) => { // a quad at (cx,cy,cz), facing outward-ish, normals from the crown centre (ccx,ccy,ccz)
    const nx = cx-ccx, ny = cy-ccy, nz = cz-ccz, nl = Math.hypot(nx,ny,nz)||1; const a = r()*Math.PI*2, b = (r()-0.5)*1.4;
    const ux = Math.cos(a), uz = Math.sin(a), vx = -Math.sin(a)*Math.sin(b), vy = Math.cos(b), vz = Math.cos(a)*Math.sin(b);
    const P = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>[cx + (ux*i + vx*j)*s, cy + vy*j*s, cz + (uz*i + vz*j)*s]);
    const shade = 0.72 + (ny/nl)*0.25 + r()*0.12;
    cards.push({P, n:[nx/nl, ny/nl, nz/nl], shade}); };
  if (kind==='pine'){ const h = 2.6 + r()*0.6; trunk.push(lpPart(g.cylT, '#4a3424', [0,h*0.35,0], [0,0,0], [0.1,h*0.7,0.1]));
    const tiers = 6; for (let t=0;t<tiers;t++){ const y = 0.7 + t*(h-0.6)/tiers, rad = 1.0*(1 - t/tiers) + 0.15, n = Math.max(3, Math.round((6 + rad*9)*f)); for (let k=0;k<n;k++){ const a = k/n*Math.PI*2 + r()*0.3, d = rad*(0.55+r()*0.45); addCard(Math.cos(a)*d, y - d*0.25, Math.sin(a)*d, 0, y+0.3, 0, (0.42 + rad*0.12)*cs); } }
    addCard(0, h+0.1, 0, 0, h-0.3, 0, 0.3); }
  else if (kind==='bush'){ const cl = [[0,0.32,0,0.42],[0.25,0.28,0.12,0.3],[-0.22,0.26,-0.1,0.3]]; cl.forEach(([x,y,z,rad])=>{ for (let k=0;k<Math.max(3, Math.round(rad*40*f));k++){ const u = r()*2-1, a = r()*Math.PI*2, s = Math.sqrt(1-u*u); addCard(x+Math.cos(a)*s*rad*0.85, y+Math.abs(u)*rad*0.85*0.9, z+Math.sin(a)*s*rad*0.85, x, y-0.1, z, 0.22*cs); } });
    trunk.push(lpPart(g.cyl, '#4a3424', [0,0.1,0], [0,0,0], [0.03,0.2,0.03])); }
  else { const h = (kind==='birch' ? 1.9 : 1.45) + r()*0.35, lean = (r()-0.5)*0.12;
    trunk.push(lpPart(g.cylT, bark, [lean*0.5, h/2, 0], [0,0,lean], [0.09,h,0.09]));
    const nb = 3 + Math.floor(r()*2), crown = [];
    for (let b=0;b<nb;b++){ const a = b/nb*Math.PI*2 + r(), len = 0.5 + r()*0.35, y = h*(0.6 + r()*0.3), tilt = 0.7 + r()*0.4;
      const ex = Math.cos(a)*Math.sin(tilt)*len, ey = Math.cos(tilt)*len, ez = Math.sin(a)*Math.sin(tilt)*len;
      const br = new THREE.Matrix4(), dir = new THREE.Vector3(ex, ey, ez).normalize(), qb = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
      br.compose(new THREE.Vector3(ex/2, y+ey/2, ez/2), qb, new THREE.Vector3(0.045, len, 0.045)); trunk.push({geo:g.cylT, color:bark, m:br});
      crown.push([ex*1.1, y+ey*1.05+0.15, ez*1.1, (kind==='birch'?0.38:0.5) + r()*0.2]); }
    crown.push([0, h+0.25, 0, kind==='birch' ? 0.45 : 0.62]);
    const cc = crown.reduce((a,c)=>[a[0]+c[0]/crown.length, a[1]+c[1]/crown.length, a[2]+c[2]/crown.length], [0,0,0]);
    crown.forEach(([x,y,z,rad])=>{ const n = Math.max(4, Math.round(rad*rad*[32, 48, 62][HD.q]*f)); for (let k=0;k<n;k++){ const u = r()*2-1, a = r()*Math.PI*2, s = Math.sqrt(1-u*u), d = rad*(0.55+0.45*Math.sqrt(r())); addCard(x+Math.cos(a)*s*d, y+u*d*0.85, z+Math.sin(a)*s*d, cc[0], cc[1]-0.2, cc[2], (kind==='birch' ? 0.2 : 0.27)*cs); } }); }
  // crown geometry
  const pos = [], nor = [], uv = [], col = [];
  cards.forEach(c=>{ const [a,b,cc,d] = c.P; [[a,[0,0]],[b,[1,0]],[cc,[1,1]],[a,[0,0]],[cc,[1,1]],[d,[0,1]]].forEach(([p,t])=>{ pos.push(...p); nor.push(...c.n); uv.push(...t); col.push(c.shade, c.shade, c.shade); }); });
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); cg.setAttribute('normal', new THREE.Float32BufferAttribute(nor,3)); cg.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2)); cg.setAttribute('color', new THREE.Float32BufferAttribute(col,3)); cg.computeBoundingSphere();
  return {trunk: lpMerge(trunk), crown: cg, kind};
}
function hdTrees(){
  const season = ART.season, list = [];
  for (let y=Y0;y<Y0+MH;y++) for (let x=X0;x<X0+MW;x++) if (MAP[y][x]===T.TREE){ const v = Math.floor(TVAR[y][x]*1000), east = x>riverX(Math.min(y,40))+2; list.push({x, y, v, bush: !east && v%5===0, pine: east ? v%3!==0 : v%4===0, birch: !east && v%7===3}); }
  for (let y=Y0-6;y<Y0+MH+6;y++) for (let x=X0-6;x<X0+MW+6;x++){ if (x>=X0 && y>=Y0 && x<X0+MW && y<Y0+MH) continue; const ex = clamp(x,X0,X0+MW-1), ey = clamp(y,Y0,Y0+MH-1), edge = MAP[ey][ex]; if (edge===T.WATER || edge===T.BRIDGE || edge===T.DOCK || edge===T.PATH) continue; if (hashf(x,y,41) < 0.3) continue; const v = Math.floor(hashf(x,y,42)*1000); list.push({x, y, v, bush:false, pine: v%3!==0, out:true}); }
  const grp = new THREE.Group();
  const mkV = lod => ({oak:[0,1,2].map(i=>hdTreeVariant('oak', 100+i, lod)), birch:[0,1].map(i=>hdTreeVariant('birch', 200+i, lod)), pine:[0,1,2].map(i=>hdTreeVariant('pine', 300+i, lod)), bush:[0,1].map(i=>hdTreeVariant('bush', 400+i, lod))});
  const V = HD.treeV || (HD.treeV = mkV(0)), VF = HD.treeVF || (HD.treeVF = mkV(1));
  const barkM = HD.mats.bark || (HD.mats.bark = new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.95, metalness:0}));
  const leafM = kind => { const k = 'leaf_'+kind; if (HD.mats[k]) return HD.mats[k]; const m = new THREE.MeshStandardMaterial({map:hdLeafTex(kind==='pine'?'pine':'broad'), alphaTest:0.42, side:THREE.DoubleSide, vertexColors:true, roughness:0.8, metalness:0}); return HD.mats[k] = hdWindify(m, {amp:'0.018', k:'1.0', key:k}); };
  const tint = (it, kind) => { if (kind==='pine') return season===3 ? ['#d8e4dc','#c8d8d0'][it.v%2] : ['#a8d898','#98cc90','#b8e0a4'][it.v%3];
    return season===0 ? ['#a8e070','#98d060','#b8e888'][it.v%3] : season===1 ? ['#78b050','#6aa048','#82b85a'][it.v%3] : season===2 ? ['#f0a040','#e8c050','#d86a30','#e89a38'][it.v%4] : ['#b8a888','#a89878'][it.v%2]; };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0,1,0), C = new THREE.Color();
  const groups = new Map();
  // grouped by kind and by 16x16-tile block, so trees outside the view (and outside the shadow's reach) are skipped; each block
  // uses one shape per kind (turned, scaled and tinted per tree), which keeps it to a few draw calls; a lighter shape takes over far away
  list.forEach(it=>{ if (season===3 && !it.pine && !it.bush && it.v%3) it.bare = true; const kind = it.bush ? 'bush' : it.pine ? 'pine' : it.birch ? 'birch' : 'oak'; const bx = Math.floor(it.x/16), by = Math.floor(it.y/16), vi = hash(kind+bx+','+by) % V[kind].length; const k = kind+'@'+bx+','+by; if (!groups.has(k)) groups.set(k, {kind, bx, by, vf:VF[kind][vi], v:V[kind][vi], items:[]}); groups.get(k).items.push(it); });
  HD.treeBlocks = [];
  for (const {kind, v, vf, bx, by, items} of groups.values()){
    const trunkIM = new THREE.InstancedMesh(v.trunk, barkM, items.length), crownIM = new THREE.InstancedMesh(v.crown, leafM(kind), items.length), farIM = new THREE.InstancedMesh(vf.crown, leafM(kind), items.length);
    let nc = 0;
    items.forEach((it,i)=>{ const s = (it.out ? 1.0 : 0.85) + (it.v%7)/16, px = it.x+0.5+((it.v%5)-2)*0.08, pz = it.y+0.55+((it.v>>3)%5-2)*0.06, y = it.out ? 0 : hdHeightAt(px, pz);
      q.setFromAxisAngle(up, it.v*0.7); m4.compose(new THREE.Vector3(px, y-0.02, pz), q, new THREE.Vector3(s, s*(0.9+(it.v%3)*0.08), s)); trunkIM.setMatrixAt(i, m4);
      if (!it.bare){ crownIM.setMatrixAt(nc, m4); crownIM.setColorAt(nc, C.set(tint(it, kind))); farIM.setMatrixAt(nc, m4); farIM.setColorAt(nc, C); nc++; } });
    crownIM.count = farIM.count = nc; [trunkIM, crownIM, farIM].forEach(im=>{ im.castShadow = im!==trunkIM || kind==='pine' || season===3; im.receiveShadow = true; im.computeBoundingSphere(); grp.add(im); }); // thin trunks leave the shade to the crowns
    farIM.visible = false; HD.treeBlocks.push({x:(bx+0.5)*16, z:(by+0.5)*16, near:crownIM, far:farIM, lod:0});
  }
  // rocks: irregular, cracked, mossy boulders with pebbles at their feet
  const rocks = []; for (let y=Y0;y<Y0+MH;y++) for (let x=X0;x<X0+MW;x++) if (MAP[y][x]===T.ROCK && hashf(x,y,77)<0.3) rocks.push({x,y,v:Math.floor(hashf(x,y,78)*1000)});
  if (rocks.length){ const RV = HD.rockV || (HD.rockV = [0,1,2,3].map(i=>hdRockGeo(500+i))); const rm = HD.mats.rock || (HD.mats.rock = new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.85, metalness:0, flatShading: HD.q===0}));
    RV.forEach((geo, gi)=>{ const its = rocks.filter(r=>r.v%RV.length===gi); if (!its.length) return; const im = new THREE.InstancedMesh(geo, rm, its.length);
      its.forEach((it,i)=>{ const s = 0.5 + (it.v%10)/10, px = it.x+0.5, pz = it.y+0.5; q.setFromAxisAngle(up, it.v); m4.compose(new THREE.Vector3(px, hdHeightAt(px,pz)-0.05, pz), q, new THREE.Vector3(s, s*(0.6+(it.v%5)*0.1), s)); im.setMatrixAt(i, m4); if (season===3 && it.v%2) im.setColorAt(i, C.set('#e8eef4')); });
      im.castShadow = im.receiveShadow = true; im.computeBoundingSphere(); grp.add(im); }); }
  // forest floor: fallen logs and old stumps among the trees
  const logs = list.filter(it=>!it.out && !it.bush && it.v%23===5);
  if (logs.length){ const lg = lpMerge([lpPart(lpG().cyl, '#5a4030', [0,0.1,0], [0,0,Math.PI/2], [0.1,1.3,0.1]), lpPart(lpG().cyl, '#8a6a4a', [0.66,0.1,0], [0,0,Math.PI/2], [0.1,0.02,0.1]), lpPart(lpG().box, '#4a6a2a', [0.1,0.18,0], [0,0,0], [0.5,0.03,0.12])]);
    const im = new THREE.InstancedMesh(lg, barkM, logs.length); logs.forEach((it,i)=>{ q.setFromAxisAngle(up, it.v); m4.compose(new THREE.Vector3(it.x+0.2, hdHeightAt(it.x+0.2, it.y+0.9), it.y+0.9), q, new THREE.Vector3(1,1,1)); im.setMatrixAt(i, m4); }); im.castShadow = im.receiveShadow = true; grp.add(im); }
  return grp;
}
function hdRockGeo(seed){
  const r = mapRand(seed), g = new THREE.IcosahedronGeometry(0.5, HD.q===0 ? 1 : 2), p = g.attributes.position, col = [];
  const off = [r()*10, r()*10, r()*10];
  for (let i=0;i<p.count;i++){ const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = hdNoise(x*2.2+off[0], z*2.2+y*1.3+off[1], 1e6, seed)*0.5 + hdNoise(x*5+off[2], y*5+z*3, 1e6, seed+1)*0.22;
    const k = 0.72 + n*0.6; p.setXYZ(i, x*k*(1+r()*0.04), Math.max(-0.2, y*k*0.8), z*k*(1+r()*0.04)); }
  g.computeVertexNormals(); const nr = g.attributes.normal;
  for (let i=0;i<p.count;i++){ const up = nr.getY(i), shade = 0.45 + hdNoise(p.getX(i)*6, p.getZ(i)*6+p.getY(i)*4, 1e6, seed+2)*0.3, moss = up > 0.55 && hdNoise(p.getX(i)*3, p.getZ(i)*3, 1e6, seed+3) > 0.45;
    const c = moss ? [0.28, 0.38, 0.16] : [shade, shade*0.97, shade*0.92]; col.push(...c); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
}

// =====================================================================
// crops, fences, bridges, docks, rails, stumps and ford stones
// =====================================================================
// crops, fences, bridges and rails change with the map and the fields' growth: rebuilt when the map changes or a day passes
function hdGroundWorksCached(){ const key = (R3.mapSig||'') + '|' + dayOf(S.minute) + '|' + ART.season + '|' + HD.q;
  if (HD.gw && HD.gwKey === key) return HD.gw; if (HD.gw) r3Dispose(HD.gw); HD.gwKey = key; return HD.gw = hdGroundWorks(); }
function hdGroundWorks(){
  const grp = new THREE.Group(), g = lpG(), season = ART.season, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0,1,0), C = new THREE.Color();
  const std = HD.mats.parts || (HD.mats.parts = new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.85, metalness:0}));
  const wood = HD.mats.woodDeck || (HD.mats.woodDeck = hdMat('planks', {color:'#b8a088'}));
  // crops: grain grows into golden ears, vegetables into leafy heads, orchards into fruiting bushes
  const growthAt = (x,y) => { if (typeof CIV!=='undefined' && CIV){ const s = civStructAt(x,y); if (!s || !s.meta || !STRUCTURES[s.def].farm) return [0, 'veg']; return [s.meta.stage==='growing' ? (s.meta.growth||0) : s.meta.stage==='ripe' ? 1 : 0, s.meta.crop || 'grain']; } return [[0.35,0.8,1,0][season], (x+y)%3 ? 'grain' : 'veg']; };
  const crops = {grain:[], veg:[], berries:[]}, posts = [], rails = [];
  for (let y=Y0;y<Y0+MH;y++) for (let x=X0;x<X0+MW;x++){ const t = MAP[y][x];
    if (t===T.FIELD){ const [gr, crop] = growthAt(x,y); if (gr > 0.04){ const L = crops[crop] || crops.veg, n = crop==='grain' ? 9 : crop==='berries' ? 1 : 4; for (let k=0;k<n;k++){ const px = x + 0.15 + (k%3)*0.33 + hashf(x,y,k)*0.06, pz = y + 0.2 + Math.floor(k/3)*0.3 + hashf(y,x,k)*0.06; L.push([crop==='veg' ? x+0.25+(k%2)*0.5 : crop==='berries' ? x+0.5 : px, crop==='veg' ? y+0.25+Math.floor(k/2)*0.5 : crop==='berries' ? y+0.5 : pz, gr, hashf(x,y,k+9)]); } } }
    else if (t===T.FENCE){ posts.push([x,y]); if (tileAt(x+1,y)===T.FENCE) rails.push([x+1, y+0.5, 0]); if (tileAt(x,y+1)===T.FENCE) rails.push([x+0.5, y+1, 1]); }
  }
  const cropGeo = { grain: lpMerge([lpPart(g.cyl, '#8aa040', [0,0.25,0], [0,0,0], [0.01,0.5,0.01]), lpPart(g.cyl, '#8aa040', [0.03,0.22,0.01], [0,0,0.2], [0.008,0.44,0.008]), lpPart(g.cap, '#c8b050', [0,0.52,0], [0,0,0], [0.018,0.05,0.018]), lpPart(g.cap, '#c8b050', [0.07,0.46,0.01], [0,0,0.2], [0.016,0.045,0.016])]),
    veg: lpMerge([lpPart(g.half, '#5a9a3a', [0,0,0], [0,0,0], [0.16,0.14,0.16]), lpPart(g.sph, '#9ac870', [0,0.07,0], [0,0,0], [0.09,0.08,0.09]), lpPart(g.box, '#4a8a30', [0.12,0.05,0], [0,0,0.6], [0.14,0.01,0.07]), lpPart(g.box, '#4a8a30', [-0.12,0.05,0], [0,0,-0.6], [0.14,0.01,0.07])]),
    berries: lpMerge([lpPart(g.cyl, '#5a4030', [0,0.2,0], [0,0,0], [0.04,0.4,0.04]), lpPart(g.ico, '#3a7a30', [0,0.6,0], [0,0,0], [0.38,0.32,0.38]), lpPart(g.ico, '#4a8a36', [0.2,0.5,0.1], [0,0,0], [0.22,0.2,0.22]), ...[0,1,2,3,4,5].map(k=>lpPart(g.sph, '#c83a4a', [Math.cos(k)*0.3, 0.55+(k%2)*0.12, Math.sin(k)*0.3], [0,0,0], [0.04,0.04,0.04]))]) };
  const cropM = HD.mats.crop || (HD.mats.crop = hdWindify(new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.8, metalness:0}), {amp:'0.35', key:'crop'}));
  for (const k in crops){ const L = crops[k]; if (!L.length) continue; const im = new THREE.InstancedMesh(cropGeo[k], cropM, L.length);
    L.forEach(([x,z,gr,v],i)=>{ q.setFromAxisAngle(up, v*6.28); const s = 0.25 + gr*0.85*(0.85+v*0.3); m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(k==='berries'?Math.max(0.5,s):s, s, k==='berries'?Math.max(0.5,s):s)); im.setMatrixAt(i, m4);
      im.setColorAt(i, k==='grain' ? C.set(gr >= 0.95 ? '#f0d070' : gr > 0.6 ? '#c8d060' : '#80b050') : k==='veg' ? C.setScalar(0.8 + gr*0.3) : C.set(gr >= 0.95 ? '#ffffff' : '#90c080')); });
    im.castShadow = false; im.receiveShadow = true; grp.add(im); }
  // fences: split-rail posts and rails
  if (posts.length){ const pg = lpMerge([lpPart(g.box, '#7a5a3a', [0,0.3,0], [0,0,0], [0.09,0.62,0.09]), lpPart(g.box, '#5a4028', [0,0.62,0], [0,0,0], [0.1,0.03,0.1])]); const im = new THREE.InstancedMesh(pg, std, posts.length); posts.forEach(([x,y],i)=>{ m4.makeTranslation(x+0.5, 0, y+0.5); im.setMatrixAt(i, m4); }); im.castShadow = im.receiveShadow = true; grp.add(im); }
  if (rails.length){ const rg = lpMerge([lpPart(g.box, '#8a6a44', [0,0.45,0], [0,0,0.02], [1.0,0.05,0.04]), lpPart(g.box, '#8a6a44', [0,0.22,0], [0,0,-0.02], [1.0,0.05,0.04])]); const im = new THREE.InstancedMesh(rg, std, rails.length); rails.forEach(([x,y,vert],i)=>{ q.setFromAxisAngle(up, vert ? Math.PI/2 : 0); m4.compose(new THREE.Vector3(x - (vert?0:0.5), 0, y - (vert?0.5:0)), q, new THREE.Vector3(1,1,1)); im.setMatrixAt(i, m4); }); im.castShadow = true; grp.add(im); }
  // bridges and docks: plank decks on posts; bridges get railings along the water side
  const decks = [], railB = [], pilings = [];
  for (let y=Y0;y<Y0+MH;y++) for (let x=X0;x<X0+MW;x++){ const t = MAP[y][x]; if (t!==T.BRIDGE && t!==T.DOCK) continue; decks.push([x,y,t]);
    if (hashf(x,y,3) < 0.5 || t===T.DOCK) pilings.push([x+0.1, y+0.1], [x+0.9, y+0.9]);
    if (t===T.BRIDGE){ [[0,-1],[0,1],[-1,0],[1,0]].forEach(([a,b])=>{ const n = tileAt(x+a, y+b); if (n===T.WATER) railB.push([x+0.5+a*0.45, y+0.5+b*0.45, a!==0]); }); } }
  if (decks.length){ const dg = hdWorldUV(new THREE.BoxGeometry(1, 0.1, 1), 2); const im = new THREE.InstancedMesh(dg, wood, decks.length); decks.forEach(([x,y],i)=>{ m4.makeTranslation(x+0.5, -0.02, y+0.5); im.setMatrixAt(i, m4); }); im.castShadow = im.receiveShadow = true; grp.add(im);
    const pg = lpMerge([lpPart(g.cyl, '#5a4030', [0,-0.35,0], [0,0,0], [0.06,0.8,0.06])]); const pm = new THREE.InstancedMesh(pg, std, pilings.length); pilings.forEach(([x,z],i)=>{ m4.makeTranslation(x, 0, z); pm.setMatrixAt(i, m4); }); pm.castShadow = true; grp.add(pm);
    if (railB.length){ const rg = lpMerge([lpPart(g.box, '#7a5a3a', [0,0.42,0], [0,0,0], [1.0,0.05,0.05]), lpPart(g.box, '#6a4a2a', [-0.45,0.22,0], [0,0,0], [0.06,0.45,0.06]), lpPart(g.box, '#6a4a2a', [0.45,0.22,0], [0,0,0], [0.06,0.45,0.06])]); const rm = new THREE.InstancedMesh(rg, std, railB.length); railB.forEach(([x,z,vert],i)=>{ q.setFromAxisAngle(up, vert ? Math.PI/2 : 0); m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1,1,1)); rm.setMatrixAt(i, m4); }); rm.castShadow = true; grp.add(rm); } }
  // rails: sleepers and steel on the classic town's line and the civilization's railway
  const track = []; (typeof RAIL_TILES!=='undefined' ? RAIL_TILES : []).forEach(([x,y])=>track.push([x+0.5, y+0.5, 1]));
  if (typeof CIV!=='undefined' && CIV && typeof civHas==='function') civHas('station').forEach(s=>{ const T0 = s.meta.track; if (T0) for (let x=T0.x0; x<=T0.x1; x++) track.push([x+0.5, T0.y+0.5, 0]); });
  if (track.length){ const tg = lpMerge([lpPart(g.box, '#5a4030', [0,0.03,0], [0,0,0], [0.18,0.06,0.9]), lpPart(g.box, '#5a4030', [0.5,0.03,0], [0,0,0], [0.18,0.06,0.9]), lpPart(g.box, '#9a9aa8', [0,0.09,0.28], [0,0,0], [1.0,0.05,0.05]), lpPart(g.box, '#9a9aa8', [0,0.09,-0.28], [0,0,0], [1.0,0.05,0.05])]);
    const im = new THREE.InstancedMesh(tg, HD.mats.metalParts || (HD.mats.metalParts = new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.5, metalness:0.35})), track.length); track.forEach(([x,z,h],i)=>{ q.setFromAxisAngle(up, h ? Math.PI/2 : 0); m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1,1,1)); im.setMatrixAt(i, m4); }); im.receiveShadow = im.castShadow = true; grp.add(im); }
  // civilization extras: tree stumps and ford stepping stones
  if (typeof CIV!=='undefined' && CIV && S.civ){ const st = Object.keys(S.civ.stumps||{}).map(tdec).filter(([x,y])=>tileAt(x,y)===T.GRASS);
    if (st.length){ const sg = lpMerge([lpPart(g.cylT, '#6a4a30', [0,0.08,0], [0,0,0], [0.14,0.16,0.14]), lpPart(g.cyl, '#c8a070', [0,0.165,0], [0,0,0], [0.13,0.01,0.13])]); const im = new THREE.InstancedMesh(sg, std, st.length); st.forEach(([x,y],i)=>{ m4.makeTranslation(x+0.5, hdHeightAt(x+0.5,y+0.5), y+0.5); im.setMatrixAt(i, m4); }); im.castShadow = true; grp.add(im); }
    const fords = typeof FORDS!=='undefined' ? [...FORDS].map(tdec) : []; if (fords.length){ const fg = lpMerge([0,1,2].map(k=>lpPart(g.dod, '#8a8680', [(k-1)*0.3, 0, (k%2)*0.15-0.05], [k,k,0], [0.14,0.08,0.12]))); const im = new THREE.InstancedMesh(fg, std, fords.length); fords.forEach(([x,y],i)=>{ m4.makeTranslation(x+0.5, -0.12, y+0.5); im.setMatrixAt(i, m4); }); im.castShadow = im.receiveShadow = true; grp.add(im); } }
  return grp;
}

// =====================================================================
// buildings: foundations, walls of boards/logs/stone/brick/plaster, shingled or thatched roofs,
// framed windows that glow at night, doors, chimneys with smoke, and clutter that says what goes on inside
// =====================================================================
const HD_WALLH = {hut:1.15, house:1.4, stone:1.5, hall:2.3, barn:1.8, tavern:1.6, tall:3.4, palace:2.6, hotel:3.0, theater:2.4, bath:1.3, arena:0.8};
function hdWallKind(b){ const s = b.style, t = b.type || '', h = hash(b.id)%3;
  if (s==='hut') return /wattle|healer|school|council/.test(t) ? 'plaster' : 'logs';
  if (s==='house') return h===0 ? 'plaster' : h===1 ? 'logs' : 'planks';
  if (s==='stone' || s==='hall' || s==='bath') return 'stone';
  if (s==='barn' || s==='arena') return 'boards';
  if (s==='tavern' || s==='palace') return 'plaster';
  if (s==='tall' || s==='hotel' || s==='theater') return 'brick';
  return 'planks'; }
const HD_WALL_TINT = {planks:['#c8a88a','#b89a80','#d8b898','#a88a70'], boards:['#a85a42','#8a6a50','#9a4a3a','#7a6a5a'], logs:['#9a6a42','#8a5a36','#a87448'], plaster:['#f4ecd8','#e8dcc0','#f0e4cc','#e0d8c8'], stone:['#e0d8cc','#d0ccc4','#e8e0d0'], brick:['#d89a88','#c88a78','#e0a890']};
// one material per surface kind, shared by every building; each building's own colour and wear is in its vertex colours,
// so whole streets batch into a few draw calls
function hdSharedMat(kind, opt){ const key = 'S_'+kind; if (HD.mats[key]) return HD.mats[key];
  const roof = kind==='thatch' || kind==='shingles', m = hdMat(kind, {ns:(opt&&opt.ns) || (roof ? 1.6 : 1.3), m:Object.assign({vertexColors:true}, roof ? {side:THREE.DoubleSide} : {})});
  m.userData.shared = true; if (roof) HD.mats.roofs = (HD.mats.roofs||[]).concat(m); return HD.mats[key] = m; }
function hdTint(g, col, k){ const n = g.attributes.position.count, c = new Float32Array(n*3), C = new THREE.Color(col); for (let i=0;i<n;i++){ const f = k ? k(i) : 1; c[i*3] = C.r*f; c[i*3+1] = C.g*f; c[i*3+2] = C.b*f; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; }
function hdBldCond(b){ const s = b.civ && S.civ && S.civ.structs[b.id]; return {cond: s ? s.cond : 100, age: s ? civDay() - s.built : 100}; }
function hdWallTint(kind, b){ const tints = HD_WALL_TINT[kind] || ['#ffffff'], c = new THREE.Color(tints[hash(b.id)%tints.length]), {cond} = hdBldCond(b); if (cond < 70) c.lerp(new THREE.Color('#6a6250'), (70-cond)/140); return c; }
function hdRoofTint(b, thatch){ const {cond, age} = hdBldCond(b);
  const c = thatch ? new THREE.Color(['#d8b060','#cfa656','#e0ba6a','#c89c50'][hash(b.id)%4]).lerp(new THREE.Color(b.roof || '#b89a58'), 0.15) : new THREE.Color(b.roof || '#8a5a3a').lerp(new THREE.Color('#ffffff'), 0.25);
  if (!thatch && (age > 200 || cond < 60)) c.lerp(new THREE.Color('#6a7a4a'), Math.min(0.35, (age-200)/1500 + (cond < 60 ? (60-cond)/150 : 0)));
  if (thatch && cond < 60) c.lerp(new THREE.Color('#7a6a48'), (60-cond)/120);
  if (ART.season===3) c.lerp(new THREE.Color('#e8eef4'), 0.75); return c; }
function hdGlassMat(){ return new THREE.MeshStandardMaterial({color:0x2a3848, roughness:0.08, metalness:0.2, emissive:new THREE.Color(0xffb866), emissiveIntensity:0, envMapIntensity:1.4}); }
// parts with uv (for textured shared materials) merged into one geometry, each part with its own vertex colour;
// the flat ends of logs get a lighter, sawn colour
function hdMergeUV(parts, endCol){
  const gs = parts.map(p=>{ const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo.clone()); g.applyMatrix4(p.m); return [g, p.color, p.axis]; });
  let n = 0; gs.forEach(([g])=>{ n += g.attributes.position.count; });
  const pos = new Float32Array(n*3), nor = new Float32Array(n*3), uv = new Float32Array(n*2), col = new Float32Array(n*3), C = new THREE.Color(), E = new THREE.Color(endCol || '#c8a070'); let o = 0;
  gs.forEach(([g, c, axis])=>{ C.set(c); const P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv ? g.attributes.uv.array : null, cnt = g.attributes.position.count;
    pos.set(P, o*3); nor.set(N, o*3); if (U) uv.set(U, o*2);
    for (let i=0;i<cnt;i++){ const end = axis && Math.abs(N[i*3]*axis[0] + N[i*3+1]*axis[1] + N[i*3+2]*axis[2]) > 0.9, K = end ? E : C, j = (o+i)*3; col[j] = K.r; col[j+1] = K.g; col[j+2] = K.b; } o += cnt; g.dispose(); });
  const G = new THREE.BufferGeometry(); G.setAttribute('position', new THREE.BufferAttribute(pos,3)); G.setAttribute('normal', new THREE.BufferAttribute(nor,3)); G.setAttribute('uv', new THREE.BufferAttribute(uv,2)); G.setAttribute('color', new THREE.BufferAttribute(col,3)); G.computeBoundingSphere(); return G;
}
// a thick, layered thatch: three stepped tiers, each with an overhanging lip and a visible edge of bundled straw,
// rising to a rolled ridge; built relative to the top of the walls
function hdThatchGeo(w, d, hh, over, tint, rnd){
  const W = w/2 + over, D = d/2 + over, m = Math.min(W, D), F = [0, 0.4, 0.72, 1], LIP = [0.28, 0.2, 0.13], TH = [0.26, 0.21, 0.16];
  const rect = (f, grow, y) => { const a = W - m*f + grow, b = D - m*f + grow; return [[-a, y, b], [a, y, b], [a, y, -b], [-a, y, -b]]; };
  const pos = [], uv = [], col = [], C = new THREE.Color(tint);
  const quad = (a, b, c, dd, shade) => { // a-b along the bottom edge, c-d along the top (d above a)
    const ex = b[0]-a[0], ez = b[2]-a[2], el = Math.hypot(ex, ez) || 1, ux = ex/el, uz = ez/el;
    const U = p => { const px = p[0]-a[0], pz = p[2]-a[2], u = px*ux + pz*uz, ax = px - u*ux, az = pz - u*uz; return [u/1.1, Math.hypot(ax, az, p[1]-a[1])/0.9]; };
    const k = shade * (0.92 + rnd()*0.16);
    [[a,b,c],[a,c,dd]].forEach(t=>t.forEach(p=>{ pos.push(...p); uv.push(...U(p)); col.push(C.r*k, C.g*k, C.b*k); })); };
  for (let t=0; t<3; t++){
    const yb = F[t]*hh - (t ? 0.04 : 0), bot = rect(F[t], LIP[t], yb), top = rect(F[t+1], t<2 ? 0 : 0, F[t+1]*hh), low = rect(F[t], LIP[t], yb - TH[t]);
    for (let s=0; s<4; s++){ const s2 = (s+1)%4; quad(bot[s], bot[s2], top[s2], top[s], 1); quad(low[s], low[s2], bot[s2], bot[s], 0.78); }
    // the underside of the lip, so the thickness reads from below too
    const inn = rect(F[t], -0.02, yb - TH[t]*0.6); for (let s=0; s<4; s++){ const s2 = (s+1)%4; quad(inn[s], inn[s2], low[s2], low[s], 0.45); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col,3)); g.computeVertexNormals(); g.computeBoundingSphere();
  return {geo:g, slope:(f, side, along)=>{ const r0 = rect(f, 0, f*hh), a = r0[side], b = r0[(side+1)%4]; return [a[0]+(b[0]-a[0])*along, f*hh, a[2]+(b[2]-a[2])*along]; }, long: W >= D, ridge: Math.abs(W - D)};
}
function hdBuilding(b){
  const grp = new THREE.Group(); grp.userData.b = b;
  const g = lpG(), P = [], cx = b.x + b.w/2, cz = b.y + b.h/2, style = b.style, thatch = style==='hut' || b.crude, wallH = HD_WALLH[style] || 1.4, home = b.house || style==='hut' || style==='house';
  const wk = hdWallKind(b), logs = wk==='logs', base = home ? 0.34 : 0.18, rnd = mapRand(hash(b.id+'hd')), {cond, age} = hdBldCond(b);
  const wallM = hdSharedMat(logs ? 'log' : wk), found = hdSharedMat('stone', {ns:1.6}), wallTint = hdWallTint(wk, b);
  const wood = style==='barn' || wk==='planks' || logs || wk==='boards' || wk==='plaster';
  const trim = wk==='plaster' ? '#5a3a24' : wk==='stone' || wk==='brick' ? '#8a8478' : '#5a3a24';
  const parts = HD.mats.parts || (HD.mats.parts = new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.85, metalness:0})); parts.userData.shared = true;
  // a stone footing: rough courses under every home, a neat plinth under the rest
  const fg = hdWorldUV(new THREE.BoxGeometry(b.w+0.2, base, b.h+0.2), 1.4); hdTint(fg, home ? '#c8c0b4' : '#b8b0a4'); fg.translate(cx, base/2-0.03, cz); const fm = new THREE.Mesh(fg, found); fm.castShadow = fm.receiveShadow = true; grp.add(fm);
  // walls: stacked logs that cross at the corners, or a textured box
  const out = logs ? 0.1 : 0; // windows and doors of log houses sit proud of the logs
  if (logs){ const n = Math.max(4, Math.round(wallH/0.19)), r = wallH/n/2*1.12, L = [], cyl = HD.logGeo || (HD.logGeo = new THREE.CylinderGeometry(1, 1, 1, 7, 1));
    const core = new THREE.BoxGeometry(b.w-0.06, wallH, b.h-0.06); core.translate(cx, base+wallH/2, cz); hdTint(core, '#4a3a2c'); const cm = new THREE.Mesh(core, parts); cm.castShadow = cm.receiveShadow = true; grp.add(cm);
    for (let i=0;i<n;i++){ const y = base + r + i*wallH/n, longFirst = i%2===0, ext = 0.22, tint = wallTint.clone().multiplyScalar(0.85 + rnd()*0.3).getHex();
      [b.y + 0.02, b.y + b.h - 0.02].forEach(z=>{ const len = b.w + (longFirst ? ext*2 : 0.04); const mtx = new THREE.Matrix4().compose(new THREE.Vector3(cx, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI/2)), new THREE.Vector3(r, len, r)); L.push({geo:cyl, color:tint, m:mtx, axis:[1,0,0]}); });
      [b.x + 0.02, b.x + b.w - 0.02].forEach(x=>{ const len = b.h + (!longFirst ? ext*2 : 0.04); const mtx = new THREE.Matrix4().compose(new THREE.Vector3(x, y + r*0.5, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2, 0, 0)), new THREE.Vector3(r, len, r)); L.push({geo:cyl, color:tint, m:mtx, axis:[0,0,1]}); }); }
    const lm = new THREE.Mesh(hdMergeUV(L, '#d8b080'), wallM); lm.castShadow = lm.receiveShadow = true; grp.add(lm); grp.userData.box = cm; }
  else { const wg = new THREE.BoxGeometry(b.w, wallH, b.h); wg.translate(cx, base + wallH/2, cz); hdWorldUV(wg, 2); hdTint(wg, wallTint); const wm = new THREE.Mesh(wg, wallM); wm.castShadow = wm.receiveShadow = true; grp.add(wm); grp.userData.box = wm;
    if (wood) [[0,0],[b.w,0],[0,b.h],[b.w,b.h]].forEach(([x,z])=>P.push(lpPart(g.box, trim, [b.x+x, base+wallH/2, b.y+z], [0,0,0], [0.13, wallH+0.02, 0.13])));
    if (wk==='plaster'){ const fz = b.y+b.h+0.012, bz = b.y-0.012; [fz, bz].forEach(z=>{ P.push(lpPart(g.box, trim, [cx, base+wallH*0.5, z], [0,0,0], [b.w, 0.08, 0.03]), lpPart(g.box, trim, [cx, base+wallH-0.04, z], [0,0,0], [b.w, 0.08, 0.03])); for (let x=b.x+0.1; x<b.x+b.w; x+=1.2){ P.push(lpPart(g.box, trim, [x, base+wallH/2, z], [0,0,0], [0.08, wallH, 0.03])); P.push(lpPart(g.box, trim, [x+0.35, base+wallH*0.25, z], [0,0,Math.PI/4], [0.06, wallH*0.6, 0.03])); } });
      [b.x-0.012, b.x+b.w+0.012].forEach(x=>{ P.push(lpPart(g.box, trim, [x, base+wallH*0.5, cz], [0,0,0], [0.03, 0.08, b.h])); P.push(lpPart(g.box, trim, [x, base+wallH-0.04, cz], [0,0,0], [0.03, 0.08, b.h])); }); } }
  // windows: deep wooden frames, sills, shutters; the glass glows warm when someone is in
  const glass = [], doorX = b.door ? b.door[0] + 0.5 : cx, rows = wallH > 2.6 ? Math.floor((wallH-0.3)/1.05) : 1;
  const winAt = (x, y, z, face) => { const w = 0.36, h = 0.44, sgn = face===0 || face===1 ? 1 : -1, along = face===0||face===2, dz = along ? sgn*(0.03+out) : 0, dx = along ? 0 : sgn*(0.03+out);
    const gp = new THREE.PlaneGeometry(w, h); if (face===1) gp.rotateY(Math.PI/2); if (face===3) gp.rotateY(-Math.PI/2); if (face===2) gp.rotateY(Math.PI); gp.translate(x+dx*0.6, y, z+dz*0.6); glass.push(gp);
    const fw = wk==='plaster' || wk==='brick' || wk==='stone' ? '#e8e0d0' : '#4a3020';
    const box = (ox, oy, sx, sy, dep) => P.push(lpPart(g.box, fw, [x + (along?ox:0) + dx, y+oy, z + (along?0:ox) + dz], [0,0,0], along ? [sx, sy, dep||0.07] : [dep||0.07, sy, sx]));
    box(0, h/2+0.04, w+0.14, 0.08); box(0, -h/2-0.04, w+0.16, 0.08); box(-w/2-0.04, 0, 0.08, h+0.04); box(w/2+0.04, 0, 0.08, h+0.04); box(0, 0, 0.035, h, 0.04); box(0, 0, w, 0.035, 0.04);
    P.push(lpPart(g.box, '#7a6a58', [x + dx*1.6, y-h/2-0.09, z + dz*1.6], [0,0,0], along ? [w+0.24, 0.05, 0.16] : [0.16, 0.05, w+0.24]));
    if (home && hash(b.id+'sh')%2===0){ const sc = ['#3a5a7a','#6a3a2a','#3a5a3a','#5a4a3a'][hash(b.id)%4]; [-1,1].forEach(s=>P.push(lpPart(g.box, sc, [x + (along ? s*(w/2+0.16) : 0) + dx*1.4, y, z + (along ? 0 : s*(w/2+0.16)) + dz*1.4], [0,0,0], along ? [0.2, h+0.08, 0.035] : [0.035, h+0.08, 0.2]))); }
    if (home && hash(b.id+'fb'+x)%3===0 && face===0){ const fb = [x + dx*2.2, y - h/2 - 0.16, z + dz*2.2]; P.push(lpPart(g.box, '#6a4428', fb, [0,0,0], along ? [w+0.1, 0.12, 0.14] : [0.14, 0.12, w+0.1])); for (let k=0;k<4;k++) P.push(lpPart(g.ico0, ['#e85a7a','#f2c14e','#f4f0f0','#a86ad8'][(k+hash(b.id))%4], [fb[0] + (along ? (k-1.5)*0.1 : 0), fb[1]+0.09, fb[2] + (along ? 0 : (k-1.5)*0.1)], [k, k, 0], [0.05, 0.04, 0.05])); } };
  for (let rr=0; rr<rows; rr++){ const y = base + (rows===1 ? wallH*0.56 : 0.6 + rr*1.05); const nw = Math.max(1, Math.floor(b.w/1.4));
    for (let k=0;k<nw;k++){ const x = b.x + (k+0.5)*b.w/nw; if (rr===0 && Math.abs(x - doorX) < 0.55) continue; winAt(x, y, b.y+b.h, 0); if (b.h >= 2) winAt(x, y, b.y, 2); }
    if (b.h >= 2.5){ const ns = Math.max(1, Math.floor(b.h/1.8)); for (let k=0;k<ns;k++){ const z = b.y + (k+0.5)*b.h/ns; winAt(b.x+b.w, y, z, 1); winAt(b.x, y, z, 3); } } }
  const gm = hdGlassMat(); if (glass.length){ const gg = hdMergePlanes(glass); grp.add(new THREE.Mesh(gg, gm)); }
  grp.userData.frontMat = gm;
  // the door: planks under a lintel, a step of flat stones
  const doorM = HD.mats.door || (HD.mats.door = hdMat('door')); doorM.userData.shared = true;
  const dz0 = b.y + b.h + 0.02 + out, dh = Math.min(0.98, wallH*0.72), dgeo = new THREE.BoxGeometry(0.52, dh, 0.06); dgeo.translate(doorX, base + dh/2, dz0); const dmesh = new THREE.Mesh(dgeo, doorM); dmesh.castShadow = true; grp.add(dmesh);
  P.push(lpPart(g.box, trim, [doorX-0.31, base+dh/2, dz0+0.01], [0,0,0], [0.09, dh+0.06, 0.09]), lpPart(g.box, trim, [doorX+0.31, base+dh/2, dz0+0.01], [0,0,0], [0.09, dh+0.06, 0.09]), lpPart(g.box, trim, [doorX, base+dh+0.06, dz0+0.01], [0,0,0], [0.78, 0.1, 0.12]),
    lpPart(g.box, '#9a948a', [doorX, base*0.5, dz0+0.24], [0,0,0], [0.74, base, 0.34]), lpPart(g.box, '#8a847a', [doorX+0.05, 0.05, dz0+0.5], [0,0.2,0], [0.6, 0.08, 0.3]), lpPart(g.sph, '#c8a040', [doorX+0.17, base+dh*0.5, dz0+0.04], [0,0,0], [0.025,0.025,0.025]));
  const lant = [doorX+0.52, base+dh*0.95, dz0+0.1]; P.push(lpPart(g.box, '#2a2a2e', [lant[0], lant[1]+0.12, lant[2]-0.05], [0,0,0], [0.03,0.03,0.12]), lpPart(g.cone, '#2a2a2e', [lant[0], lant[1]+0.1, lant[2]], [0,Math.PI/4,0], [0.07,0.06,0.07]));
  const lg = new THREE.Mesh(HD.lantGeo || (HD.lantGeo = new THREE.BoxGeometry(0.08, 0.12, 0.08)), HD.mats.lantern || (HD.mats.lantern = new THREE.MeshStandardMaterial({color:0x3a3020, emissive:new THREE.Color(0xffa850), emissiveIntensity:0, roughness:0.3})));
  HD.mats.lantern.userData.shared = true; lg.position.set(...lant); grp.add(lg); HD.lanterns = HD.lanterns || []; HD.lanterns.push([lant[0], lant[1], lant[2]]);
  // ivy climbing a corner or two of older homes and around the door
  const green = ['#4a6a24','#5a7a2a','#3e5e20','#6a8a34'];
  if (home && (age > 40 || hash(b.id+'ivy')%2===0)){ const corners = [[b.x-0.06, b.y+b.h+0.06],[b.x+b.w+0.06, b.y+b.h+0.06],[b.x-0.06, b.y-0.06],[b.x+b.w+0.06, b.y-0.06]].filter((c,i)=>hash(b.id+'iv'+i)%3!==0).slice(0, 2);
    corners.forEach(([x,z])=>{ const top = base + wallH*(0.55 + rnd()*0.45); for (let y = base*0.6; y < top; y += 0.11){ const s = 0.09 + rnd()*0.06; P.push(lpPart(g.ico0, green[Math.floor(rnd()*4)], [x + (rnd()-0.5)*0.16, y, z + (rnd()-0.5)*0.16], [rnd()*3, rnd()*3, 0], [s, s*0.9, s])); } });
    if (hash(b.id+'dv')%2===0) for (let k=0;k<7;k++){ const a = k/6*Math.PI; P.push(lpPart(g.ico0, green[k%4], [doorX + Math.cos(a)*0.38, base + dh*0.55 + Math.sin(a)*(dh*0.55), dz0+0.06], [k, k, 0], [0.08, 0.07, 0.06])); } }
  // roof
  const flat = ['tall','arena','bath'].includes(style);
  if (!flat){ const hh = Math.min(b.w,b.h)*(thatch?0.5:style==='hall'?0.42:0.45) + (['palace','hotel','theater'].includes(style)?0.4:0), over = thatch ? 0.3 : 0.25, top = base + wallH, rc = hdRoofTint(b, thatch);
    let roofGeo, T = null;
    if (thatch){ T = hdThatchGeo(b.w, b.h, hh, over, rc, rnd); roofGeo = T.geo; } else { roofGeo = hipRoof(b.w, b.h, hh, over); hdTint(roofGeo, rc); }
    roofGeo.translate(cx, top, cz);
    const rm = new THREE.Mesh(roofGeo, hdSharedMat(thatch ? 'thatch' : 'shingles')); rm.castShadow = rm.receiveShadow = true; rm.userData.roofPart = true; grp.add(rm);
    const long = b.w >= b.h, rl = Math.max(0.05, Math.abs(b.w - b.h)) + 0.1, RP = [];
    if (thatch){ RP.push(lpPart(g.cyl, rc.clone().multiplyScalar(0.72).getHex(), [cx, top+hh+0.02, cz], long ? [0,0,Math.PI/2] : [Math.PI/2,0,0], [0.13, rl+0.12, 0.13]));
      // moss and ivy patches on the straw, more on older roofs
      const nm = 3 + Math.min(9, Math.floor(age/60)) + (cond < 60 ? 4 : 0);
      for (let k=0;k<nm;k++){ const f = 0.1 + rnd()*0.75, side = Math.floor(rnd()*4), al = 0.12 + rnd()*0.76, n = 3 + Math.floor(rnd()*4);
        for (let j=0;j<n;j++){ const p = T.slope(Math.min(0.92, f + (rnd()-0.5)*0.12), side, Math.min(0.95, Math.max(0.05, al + (rnd()-0.5)*0.12))), s = 0.05 + rnd()*0.06;
          RP.push(lpPart(g.ico0, ['#6a8a34','#7a9a3a','#5a7a2a','#8aa848'][Math.floor(rnd()*4)], [cx + p[0], top + p[1] + 0.06, cz + p[2]], [rnd(), rnd()*3, rnd()], [s, s*0.45, s])); } } }
    else RP.push(lpPart(g.box, '#4a3a2e', [cx, top+hh+0.02, cz], [0,0,0], long ? [rl, 0.07, 0.12] : [0.12, 0.07, rl]), lpPart(g.box, '#3a2a20', [cx, top-0.02, b.y+b.h+over-0.02], [0,0,0], [b.w+over*2, 0.06, 0.04]), lpPart(g.box, '#3a2a20', [cx, top-0.02, b.y-over+0.02], [0,0,0], [b.w+over*2, 0.06, 0.04]));
    const rpm = new THREE.Mesh(lpMerge(RP), parts); rpm.castShadow = true; rpm.userData.roofPart = true; grp.add(rpm);
    // a stone chimney with a cap; its smoke rises from the top
    if (!['barn','hall','palace','hotel','theater'].includes(style)){ const chx = b.x+b.w*0.72, chz = cz-b.h*0.12, chh = hh*0.85 + 0.75, chy = top + chh/2 - 0.1;
      const cg = hdWorldUV(new THREE.BoxGeometry(0.42, chh, 0.42), 1); hdTint(cg, '#a8a49c'); cg.translate(chx, chy, chz); const chm = new THREE.Mesh(cg, found); chm.castShadow = true; chm.userData.roofPart = true; grp.add(chm);
      RP.length = 0; const capm = new THREE.Mesh(lpMerge([lpPart(g.box, '#5a5550', [chx, chy+chh/2+0.04, chz], [0,0,0], [0.52, 0.08, 0.52]), lpPart(g.box, '#2a2826', [chx, chy+chh/2+0.09, chz], [0,0,0], [0.26, 0.04, 0.26])]), parts); capm.castShadow = true; capm.userData.roofPart = true; grp.add(capm);
      grp.userData.chimney = new THREE.Vector3(chx, chy+chh/2+0.12, chz); HD.smokers.push({b, x:chx, y:chy+chh/2+0.12, z:chz}); }
    if (style==='hall'){ const tw = new THREE.Mesh(lpMerge([lpPart(g.box, '#c8c0b0', [cx, top+hh+0.4, cz+0.4], [0,0,0], [1.1,1.6,1.1]), lpPart(g.cone, b.roof||'#4a5a8a', [cx, top+hh+1.75, cz+0.4], [0,Math.PI/4,0], [0.85,1.1,0.85]), lpPart(g.cyl, '#f0f0e8', [cx, top+hh+0.6, cz+0.96], [Math.PI/2,0,0], [0.25,0.02,0.25])]), parts); tw.castShadow = true; tw.userData.roofPart = true; grp.add(tw); }
  } else { const tg = hdWorldUV(new THREE.BoxGeometry(b.w+0.1, 0.12, b.h+0.1), 2); hdTint(tg, style==='bath' ? '#b8b0a4' : '#6a6664'); tg.translate(cx, base+wallH+0.06, cz); const top = new THREE.Mesh(tg, found); top.castShadow = true; top.userData.roofPart = true; grp.add(top);
    if (style==='tall'){ P.push(lpPart(g.cyl, '#8a6038', [b.x+b.w-1, base+wallH+0.6, cz], [0,0,0], [0.5,0.9,0.5]), lpPart(g.box, '#2a2a30', [b.x+b.w-1, base+wallH+0.12, cz], [0,0,0], [0.8,0.2,0.8])); }
    if (style==='bath'){ const r0 = Math.min(b.w,b.h)*0.3; P.push(lpPart(g.half, '#5a9a8a', [cx, base+wallH, cz], [0,0,0], [r0, r0, r0])); } }
  if (style==='palace') [b.x+0.45, b.x+b.w-0.45].forEach(tx=>{ const th = wallH+1.6; P.push(lpPart(g.cyl, '#eae0c8', [tx, th/2, b.y+b.h-0.45], [0,0,0], [0.5, th, 0.5]), lpPart(g.cone, b.roof||'#4a5a8a', [tx, th+0.6, b.y+b.h-0.45], [0,0,0], [0.65,1.2,0.65]), lpPart(g.box, '#c83a4a', [tx+0.25, th+1.45, b.y+b.h-0.45], [0,0,0], [0.5,0.3,0.02])); });
  hdClutter(b, P, g, base);
  if (P.length){ const pm = new THREE.Mesh(lpMerge(P), parts); pm.castShadow = true; pm.receiveShadow = true; grp.add(pm); }
  if (typeof r3Decorate==='function') r3Decorate(b, grp);
  return grp;
}
function hdMergePlanes(list){ let n = 0; list.forEach(g=>{ n += g.index ? g.index.count : g.attributes.position.count; });
  const pos = new Float32Array(n*3), nor = new Float32Array(n*3); let o = 0; list.forEach(g0=>{ const g = g0.index ? g0.toNonIndexed() : g0; pos.set(g.attributes.position.array, o*3); nor.set(g.attributes.normal.array, o*3); o += g.attributes.position.count; });
  const G = new THREE.BufferGeometry(); G.setAttribute('position', new THREE.BufferAttribute(pos,3)); G.setAttribute('normal', new THREE.BufferAttribute(nor,3)); return G; }
// context-aware clutter: firewood and barrels at homes, sacks and crates at shops and granaries, hay at barns, anvils at smithies
function hdClutter(b, P, g, base){
  const t = (b.type || b.biz || '') + ' ' + (b.id||''), r = mapRand(hash(b.id+'clutter')), side = b.x + b.w + 0.3, back = b.y + 0.4;
  const barrel = (x, z) => P.push(lpPart(g.cyl, '#8a5a34', [x, 0.26, z], [0,0,0], [0.18,0.5,0.18]), lpPart(g.cyl, '#3a3a40', [x, 0.1, z], [0,0,0], [0.185,0.03,0.185]), lpPart(g.cyl, '#3a3a40', [x, 0.42, z], [0,0,0], [0.185,0.03,0.185]));
  const crate = (x, z, s) => P.push(lpPart(g.box, '#a87a48', [x, 0.2*s, z], [0, r(), 0], [0.4*s,0.4*s,0.4*s]), lpPart(g.box, '#7a5230', [x, 0.2*s, z], [0, r(), 0], [0.42*s,0.05,0.42*s]));
  const sack = (x, z) => P.push(lpPart(g.ico, '#c8b080', [x, 0.16, z], [0, r()*3, 0], [0.16,0.18,0.14]));
  const wood = (x, z) => { for (let k=0;k<5;k++) P.push(lpPart(g.cyl, '#8a6038', [x, 0.07+Math.floor(k/3)*0.13, z-0.2+(k%3)*0.14+Math.floor(k/3)*0.07], [0,0,Math.PI/2], [0.065,0.55,0.065])); };
  const hay = (x, z) => P.push(lpPart(g.cyl, '#d8b860', [x, 0.25, z], [0,0,Math.PI/2], [0.25,0.45,0.25]));
  const plant = (x, z) => P.push(lpPart(g.cylT, '#9a5a3a', [x, 0.12, z], [0,0,0], [0.1,0.24,0.1]), lpPart(g.ico, ['#e84a6a','#f2c14e','#6ab04a'][Math.floor(r()*3)], [x, 0.3, z], [0,0,0], [0.12,0.1,0.12]));
  if (b.house || /home|hut|cottage|cabin|house|lean/.test(t)){ wood(side, b.y + b.h - 0.4); if (r() < 0.6) barrel(b.x - 0.3, b.y + b.h - 0.3); if (r() < 0.5) plant(b.door ? b.door[0]+0.1 : b.x+0.3, b.y + b.h + 0.25); }
  else if (/granary|warehouse|market|shop|store|trad|bakery|brew|mill/.test(t)){ crate(side, b.y + b.h - 0.4, 1); crate(side, b.y + b.h - 0.9, 0.8); sack(side + 0.05, b.y + b.h - 1.4); barrel(b.x - 0.3, b.y + b.h - 0.4); }
  else if (/barn|ranch|pen|dairy|stable/.test(t) || b.style==='barn'){ hay(side, b.y + b.h - 0.5); hay(side, b.y + b.h - 1.1); P.push(lpPart(g.box, '#6a4a30', [b.x - 0.35, 0.18, b.y + b.h - 0.6], [0,0,0], [0.3, 0.2, 0.8])); }
  else if (/smith|forge|foundry|work|carp|saw|lumber/.test(t)){ P.push(lpPart(g.box, '#2a2a30', [side, 0.3, b.y+b.h-0.5], [0,0,0], [0.35,0.12,0.18]), lpPart(g.box, '#3a3a40', [side, 0.15, b.y+b.h-0.5], [0,0,0], [0.15,0.3,0.15])); wood(side, b.y+b.h-1.2); barrel(b.x-0.3, b.y+b.h-0.4); }
  else if (/tavern|inn|hotel/.test(t) || b.style==='tavern'){ barrel(side, b.y+b.h-0.4); barrel(side, b.y+b.h-0.85); P.push(lpPart(g.box, '#7a5a3a', [b.x-0.5, 0.22, b.y+b.h+0.5], [0,0,0], [0.8,0.06,0.4]), lpPart(g.box, '#6a4a30', [b.x-0.5, 0.11, b.y+b.h+0.5], [0,0,0], [0.08,0.22,0.08])); }
  else if (/mine|quarry|pit/.test(t)){ for (let k=0;k<5;k++) P.push(lpPart(g.dod, '#7a7670', [side + r()*0.4, 0.08, b.y + b.h - r()*1.2], [k,k,0], [0.14,0.1,0.14])); }
}

// =====================================================================
// particles: chimney smoke, fire sparks, fireflies, pollen, falling leaves, rain splashes
// =====================================================================
function hdParticlesInit(){
  const mkSys = (N, additive) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N*3), 3)); g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(N), 1)); g.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(N*4), 4));
    const m = new THREE.ShaderMaterial({ transparent:true, depthWrite:false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms:{uScale:{value:600}},
      vertexShader:`attribute float aSize; attribute vec4 aCol; varying vec4 vC; uniform float uScale; void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader:`varying vec4 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d)*2.0; if (r > 1.0) discard; float a = exp(-r*r*3.5); gl_FragColor = vec4(vC.rgb, vC.a * a); }` });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; R3.scene.add(pts); return {pts, N, list:[]}; };
  HD.pSmoke = mkSys([300, 600, 1000][HD.q], false); HD.pGlow = mkSys([200, 400, 700][HD.q], true); HD.pSmoke.pts.renderOrder = 5; HD.pGlow.pts.renderOrder = 6;
}
function hdEmit(sys, p){ if (sys.list.length >= sys.N) return; sys.list.push(p); }
function hdParticlesUpdate(dt, ts, dark){
  if (!HD.pSmoke) return;
  const tx = cam.x/TILE, tz = cam.y/TILE, wind = HD_WIND.uWind.value, season = ART.season, mod = modOf(S.minute), h = mod/60, rain = S.weather==='Rain' || S.weather==='Storm';
  HD.emitAcc = (HD.emitAcc||0) + dt;
  const step = HD.emitAcc > 0.1; if (step) HD.emitAcc = 0;
  if (step){
    // chimneys smoke when people are home, at mealtimes, and all day in the cold
    const lum = 0.25 + 0.55*(1 - Math.min(1, dark*1.4)), smokeC = [lum, lum, lum*1.03];
    const meal = (h>6&&h<8.5) || (h>11.5&&h<13) || (h>17&&h<20.5), cold = season===3 || season===2;
    HD.smokers.forEach(s=>{ if (Math.abs(s.x-tx) > 40 || Math.abs(s.z-tz) > 40) return; const lit = litBuilding(s.b); if (!(lit || meal || cold)) return; if (Math.random() < (lit ? 0.6 : 0.35)) hdEmit(HD.pSmoke, {x:s.x+(Math.random()-0.5)*0.1, y:s.y, z:s.z, vx:wind*0.35+(Math.random()-0.5)*0.05, vy:0.3+Math.random()*0.15, vz:wind*0.12, life:0, max:4+Math.random()*2, s0:0.18, s1:1.1, c:smokeC, a:0.2}); });
    // embers above fires and torches
    (R3.flames||[]).forEach(f=>{ const p = f.position; if (Math.abs(p.x-tx) > 30 || Math.abs(p.z-tz) > 30) return; if (Math.random() < 0.5) hdEmit(HD.pGlow, {x:p.x, y:p.y+0.4, z:p.z, vx:(Math.random()-0.5)*0.3+wind*0.2, vy:0.8+Math.random()*0.6, vz:(Math.random()-0.5)*0.3, life:0, max:0.8+Math.random()*0.8, s0:0.05, s1:0.02, c:[1,0.55,0.15], a:1});
      if (Math.random() < 0.25) hdEmit(HD.pSmoke, {x:p.x, y:p.y+0.7, z:p.z, vx:wind*0.3, vy:0.4, vz:0, life:0, max:3, s0:0.2, s1:0.9, c:smokeC, a:0.16}); });
    // fireflies on warm nights; pollen and dust drifting in the sun; leaves falling in autumn
    if (dark > 0.3 && (season===0 || season===1) && !rain) for (let k=0;k<3;k++) hdEmit(HD.pGlow, {x:tx+(Math.random()-0.5)*40, y:0.3+Math.random()*1.2, z:tz+(Math.random()-0.5)*30, vx:(Math.random()-0.5)*0.3, vy:(Math.random()-0.5)*0.1, vz:(Math.random()-0.5)*0.3, life:0, max:4+Math.random()*4, s0:0.06, s1:0.06, c:[0.75,1,0.35], a:1, blink:Math.random()*6});
    if (dark < 0.1 && !rain && season!==3 && HD.q>0) for (let k=0;k<2;k++) hdEmit(HD.pGlow, {x:tx+(Math.random()-0.5)*36, y:0.4+Math.random()*2.5, z:tz+(Math.random()-0.5)*28, vx:wind*0.25+(Math.random()-0.5)*0.1, vy:(Math.random()-0.5)*0.05, vz:(Math.random()-0.5)*0.1, life:0, max:6, s0:0.035, s1:0.035, c:[1,0.95,0.75], a:0.35});
    if (season===2 && !rain) for (let k=0;k<3;k++) hdEmit(HD.pSmoke, {x:tx+(Math.random()-0.5)*36, y:2+Math.random()*2, z:tz+(Math.random()-0.5)*28, vx:wind*0.5, vy:-0.35, vz:(Math.random()-0.5)*0.2, life:0, max:5, s0:0.07, s1:0.07, c:[[0.85,0.45,0.12],[0.9,0.7,0.2],[0.7,0.3,0.1]][Math.floor(Math.random()*3)], a:0.95, leaf:1});
    if (rain) for (let k=0;k<6;k++){ const x = tx+(Math.random()-0.5)*30, z = tz+(Math.random()-0.5)*24, t = tileAt(Math.floor(x), Math.floor(z)); if (t===T.WATER){ if (Math.random() < 0.5) hdRipple(x, z, 1.2); } else hdEmit(HD.pGlow, {x, y:hdHeightAt(x,z)+0.02, z, vx:0, vy:0.6, vz:0, life:0, max:0.25, s0:0.05, s1:0.01, c:[0.7,0.8,0.9], a:0.6}); }
  }
  [HD.pSmoke, HD.pGlow].forEach(sys=>{
    sys.list = sys.list.filter(p=>(p.life += dt) < p.max);
    const pos = sys.pts.geometry.attributes.position, sz = sys.pts.geometry.attributes.aSize, col = sys.pts.geometry.attributes.aCol;
    sys.list.forEach((p,i)=>{ const k = p.life/p.max; p.x += p.vx*dt; p.y += p.vy*dt; p.z += p.vz*dt; if (p.leaf){ p.x += Math.sin(ts/300 + i)*0.01; if (p.y < 0.02) { p.vy = 0; p.vx = 0; } }
      pos.setXYZ(i, p.x, p.y, p.z); sz.setX(i, p.s0 + (p.s1-p.s0)*k); const fade = Math.min(1, k*6) * (1-k); const bl = p.blink!=null ? 0.5+0.5*Math.sin(ts/400 + p.blink*3) : 1;
      col.setXYZW(i, p.c[0], p.c[1], p.c[2], p.a*fade*bl); });
    sys.pts.geometry.setDrawRange(0, sys.list.length); pos.needsUpdate = sz.needsUpdate = col.needsUpdate = true; });
  HD.pSmoke.pts.material.uniforms.uScale.value = HD.pGlow.pts.material.uniforms.uScale.value = (R3.h||600) * R3.renderer.getPixelRatio() * 0.9;
}

// =====================================================================
// the frame: wind, wetness, water, grass, particles, ripples, lanterns, adaptive quality
// =====================================================================
function hdFrame(dt, ts, dark){
  const t = ts/1000; HD_WIND.uTime.value = t;
  // is the camera moving (dragging, turning, zooming)? then the frame takes the cheaper path
  const cp = R3.camera.position, ck = cp.x*1e4 + cp.y*1e2 + cp.z + R3.yaw*7 + R3.pitch*13; if (ck !== HD.camKey){ HD.camKey = ck; HD.moveT = ts; } HD.moving = ts - (HD.moveT||-1e9) < 300;
  const wx = S.weather, targetWind = wx==='Storm' ? 1.6 : wx==='Rain' ? 1.0 : wx==='Cloudy' ? 0.75 : 0.5; HD_WIND.uWind.value += (targetWind - HD_WIND.uWind.value)*Math.min(1, dt*0.5);
  // ground gets wet in rain and dries slowly afterwards; snow settles in winter storms
  const gameDt = (clock.paused ? 0 : clock.speed) * dt / 2.5; // game minutes this frame
  const raining = wx==='Rain' || wx==='Storm'; HD.wet = clamp(HD.wet + (raining ? gameDt/40 : -gameDt/240), 0, 1);
  HD.snow = clamp(HD.snow + (wx==='Snow' ? gameDt/120 : ART.season===3 ? -gameDt/2000 : -gameDt/200), 0, ART.season===3 ? 1 : 0.4);
  if (HD.terrU){ HD.terrU.uTime.value = t; HD.terrU.uWet.value = HD.wet; HD.terrU.uSnow.value = HD.snow; HD.terrU.uSeason.value = ART.season; HD.terrU.uSun.value = 1 - dark*1.3; }
  (HD.mats.roofs||[]).forEach(m=>{ m.roughness = 1 - HD.wet*0.45; });
  if (HD.waterU){ const U = HD.waterU; U.uTime.value = t; U.uRain.value = raining ? (wx==='Storm' ? 1 : 0.6) : 0; U.uDay.value = 1 - dark/0.68; U.uSunDir.value.copy(R3.sun.position).sub(R3.sun.target.position).normalize(); U.uSunCol.value.copy(R3.sun.color).multiplyScalar(R3.sun.intensity/3.4);
    U.uSky.value.copy(HD.sky.material.uniforms.hor.value); U.uSkyTop.value.copy(HD.sky.material.uniforms.top.value); U.fogColor.value.copy(R3.scene.fog.color); U.fogNear.value = R3.scene.fog.near; U.fogFar.value = R3.scene.fog.far; }
  // ripples where people fish and boats move
  HD.ripT = (HD.ripT||0) + dt;
  if (HD.ripT > 0.7){ HD.ripT = 0;
    S.citizens.forEach(c=>{ if (c.rt.path || c.rt.state!=='Working') return; const b = c.plan && c.plan.blocks && c.plan.blocks[c.rt.blockIdx]; const fishing = b && b.task==='fish' || c.profession==='Fisher'; if (!fishing || Math.random() > 0.35) return;
      for (const [a,bb] of [[0,1],[1,0],[0,-1],[-1,0],[0,2],[2,0]]){ if (tileAt(c.rt.x+a, c.rt.y+bb)===T.WATER){ hdRipple(c.rt.x+a*1.4+0.5, c.rt.y+bb*1.4+0.5, 2.4); break; } } });
    if (typeof VEHICLES!=='undefined') VEHICLES.forEach(v=>{ if ((v.kind==='boat'||v.kind==='ship'||v.kind==='steamship') && typeof civVehShown==='function' && civVehShown(v)) hdRipple(v.x/16, v.y/16, 2.6); });
    (R3.fish||[]).forEach(f=>{ if (!f.userData.rip){ f.userData.rip = 1; hdRipple(f.position.x, f.position.z, 2); } }); }
  hdRipplesUpdate(dt);
  hdTreeLOD();
  hdVegUpdate();
  hdParticlesUpdate(dt, ts, dark);
  if (HD.mats.lantern) HD.mats.lantern.emissiveIntensity = dark > 0.1 ? 2.2 * Math.min(1, dark*1.8) : 0;
  hdAdapt(dt);
}
// near the camera trees get their full crowns; further out a lighter crown with a third of the leaf cards
function hdTreeLOD(){ const B = HD.treeBlocks; if (!B) return; const tx = cam.x/TILE, tz = cam.y/TILE, R = 14 + R3.dist*0.75 + HD.q*4;
  for (const b of B){ const far = Math.hypot(b.x - tx, b.z - tz) > R + 11; if (far !== !!b.lod){ b.lod = far ? 1 : 0; b.near.visible = !far; b.far.visible = far; } } }
// ---------- adaptive quality: hold 60 frames a second ----------
// GPU time is measured with timer queries where the browser has them (desktop Chrome, Firefox); elsewhere frame times
// and how busy the script is tell whether the graphics card is the bottleneck. When frames run slower than ~55 fps the
// render scale steps down (never below 55%); with headroom it climbs back; on Auto, only at the lowest scale is the tier lowered.
function hdAdaptInit(){ HD.ft = 16.7; HD.slow = 0; HD.fast = 0; HD.rs = 1; HD.rsLock = 0; HD.lastUp = -1e9; }
function hdGpuBegin(){ const gl = R3.renderer.getContext(); if (HD.gpuExt === undefined) HD.gpuExt = gl.getExtension('EXT_disjoint_timer_query_webgl2') || null; const E = HD.gpuExt; if (!E || HD.gpuQ) return;
  HD.gpuQ = gl.createQuery(); gl.beginQuery(E.TIME_ELAPSED_EXT, HD.gpuQ); }
function hdGpuEnd(){ const E = HD.gpuExt, gl = R3.renderer.getContext(); if (!E || !HD.gpuQ || HD.gpuQ.ended) return; gl.endQuery(E.TIME_ELAPSED_EXT); HD.gpuQ.ended = true; }
function hdGpuPoll(){ const E = HD.gpuExt, q = HD.gpuQ; if (!E || !q || !q.ended) return; const gl = R3.renderer.getContext();
  if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) return; const bad = gl.getParameter(E.GPU_DISJOINT_EXT);
  if (!bad){ const ms = gl.getQueryParameter(q, gl.QUERY_RESULT)/1e6; HD.gpu = HD.gpu == null ? ms : HD.gpu*0.85 + ms*0.15; } gl.deleteQuery(q); HD.gpuQ = null; }
function hdAdapt(dt){
  hdGpuPoll(); const now = performance.now();
  HD.ft = HD.ft*0.9 + Math.min(dt, 0.1)*1000*0.1;
  const script = typeof frameStats!=='undefined' ? frameStats.draw : 4, gpuBound = HD.gpu != null ? HD.gpu > 13 : script < 11;
  HD.slow = HD.ft > 18.2 ? HD.slow + dt : Math.max(0, HD.slow - dt*0.5);
  if (HD.slow > 0.8){ HD.slow = 0;
    if (gpuBound && HD.rs > 0.57){ HD.rs = Math.max(0.55, +(HD.rs - 0.08).toFixed(2)); if (now - HD.lastUp < 4000) HD.rsLock = now + 30000; }
    else if (gpuBound && hdPref()==='auto' && HD.q > 0 && HD.ft > 30){ hdSetTier(HD.q - 1); HD.rs = 0.85; } }
  // headroom: measured GPU time well inside the budget, or (without timers) a steady 60 for a while
  const room = HD.gpu != null ? HD.gpu < 9.5 : HD.ft < 17.4;
  HD.fast = room ? HD.fast + dt : 0;
  if (HD.rs < 1 && HD.fast > (HD.gpu != null ? 2 : 5) && now > HD.rsLock){ HD.fast = 0; HD.rs = Math.min(1, +(HD.rs + 0.05).toFixed(2)); HD.lastUp = now; }
  // on Auto, a graphics card with plenty to spare (measured, at full resolution) moves up a tier
  if (hdPref()==='auto' && HD.q < 2 && HD.rs >= 1 && HD.gpu != null && HD.gpu < 6 && HD.ft < 17.4){ HD.promo = (HD.promo||0) + dt; if (HD.promo > 10){ HD.promo = 0; hdSetTier(HD.q + 1); } } else HD.promo = 0;
  // the HD button shows the frame rate, once a second
  if (now - (HD.fpsT||0) > 1000){ HD.fpsT = now; hdUpdateButton(); }
}
function hdSetTier(q){
  HD.q = q; R3.hdQ = q;
  for (const k in HD.tex){ const t = HD.tex[k]; if (t.map){ t.map.dispose(); t.normalMap.dispose(); t.roughnessMap.dispose(); } else if (t.dispose) t.dispose(); } HD.tex = {};
  for (const k in HD.mats){ const m = HD.mats[k]; if (m && m.dispose) m.dispose(); } HD.mats = {}; HD.treeV = null; HD.treeVF = null; HD.rockV = null;
  hdClearChunks(); HD.smokers = []; HD.lanterns = []; if (HD.gw){ r3Dispose(HD.gw); HD.gw = null; }
  const sm = [1024, 2048, 4096][q]; R3.sun.shadow.mapSize.set(sm, sm); if (R3.sun.shadow.map){ R3.sun.shadow.map.dispose(); R3.sun.shadow.map = null; }
  if (R3.volMat) R3.volMat.uniforms.uQ.value = q;
  R3.lastWorld = ''; R3.lastProps = ''; R3.pr = -1; hdUpdateButton();
}
function hdCyclePref(){ const order = ['auto','low','medium','high'], cur = hdPref(), next = order[(order.indexOf(cur)+1) % order.length]; try { localStorage.setItem('pixeltown.hd', next); } catch(e){} hdSetTier(hdTier()); }
function hdUpdateButton(){ const b = document.getElementById('zHD'); if (!b) return; const p = hdPref(); b.textContent = 'HD ' + (p==='auto' ? 'Auto' : HD_QNAMES[HD.q]) + (HD.ft ? ' · ' + Math.min(60, Math.round(1000/HD.ft)) + ' fps' : ''); b.title = `Graphics quality: ${p==='auto' ? `automatic (${HD_QNAMES[HD.q]} on this device)` : HD_QNAMES[HD.q]}. Click to change.`; }

// =====================================================================
// static batching: every building's meshes are merged, by material, into a few meshes per 32x32-tile area, so a
// whole street of houses costs a handful of draw calls; each vertex remembers its building, so the roof of the
// one building the camera is peering into can still be lifted off (by a shader uniform, not a rebuild)
// =====================================================================
const HD_HIDE = {uHide0:{value:-9}, uHide1:{value:-9}};
function hdHidePatch(m){ if (m.userData.hdHide) return; m.userData.hdHide = true; const prev = m.onBeforeCompile, pk = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => { if (prev) prev.call(m, sh, r); sh.uniforms.uHide0 = HD_HIDE.uHide0; sh.uniforms.uHide1 = HD_HIDE.uHide1;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aBid; uniform float uHide0, uHide1;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  if (aBid > 0.5 && (abs(aBid - uHide0) < 0.5 || abs(aBid - uHide1) < 0.5)) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);'); };
  m.customProgramCacheKey = () => (pk ? pk.call(m) : '') + '|hide'; m.needsUpdate = true; }
// merge meshes (each with its world matrix) into one geometry; attributes missing from some parts are filled in
function hdMergeForBatch(list){
  const geos = list.map(([o, bid])=>{ let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld); return [g, bid]; });
  const names = new Set(); geos.forEach(([g])=>Object.keys(g.attributes).forEach(n=>names.add(n))); names.delete('aBid');
  let n = 0; geos.forEach(([g])=>{ n += g.attributes.position.count; });
  const out = new THREE.BufferGeometry(), bidA = new Float32Array(n);
  for (const name of names){ const size = (geos.find(([g])=>g.attributes[name])[0]).attributes[name].itemSize, arr = new Float32Array(n*size); let o = 0;
    geos.forEach(([g])=>{ const a = g.attributes[name], cnt = g.attributes.position.count; if (a) arr.set(a.array.length === cnt*size ? a.array : Array.from({length:cnt*size}, (_, i)=>a.getComponent(Math.floor(i/size), i%size)), o*size); else if (name==='color') arr.fill(1, o*size, (o+cnt)*size); o += cnt; });
    out.setAttribute(name, new THREE.BufferAttribute(arr, size)); }
  let o = 0; geos.forEach(([g, bid])=>{ const cnt = g.attributes.position.count; bidA.fill(bid, o, o+cnt); o += cnt; g.dispose(); });
  out.setAttribute('aBid', new THREE.BufferAttribute(bidA, 1)); out.computeBoundingSphere(); return out;
}
function hdBatchBuildings(groups){
  const batches = new Map(), out = new THREE.Group(); out.name = 'bldBatch';
  groups.forEach((g, gi)=>{ const b = g.userData.b; if (!b) return; g.userData.bid = gi+1; g.updateMatrixWorld(true);
    const ck = Math.floor((b.x+b.w/2)/32)+','+Math.floor((b.y+b.h/2)/32);
    g.children.forEach(o=>{ if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || o===g.userData.interior || o.material===g.userData.frontMat || o.userData.noBatch) return;
      const key = ck+'|'+o.material.uuid+'|'+(o.castShadow?1:0); let e = batches.get(key); if (!e){ e = {mat:o.material, shadow:o.castShadow, list:[]}; batches.set(key, e); }
      e.list.push([o, o.userData.roofPart ? gi+1 : 0]); o.visible = false; o.userData.batched = true; }); });
  for (const e of batches.values()){ hdHidePatch(e.mat); e.mat.userData.shared = true; const m = new THREE.Mesh(hdMergeForBatch(e.list), e.mat); m.castShadow = e.shadow; m.receiveShadow = true; out.add(m); }
  HD.bldBatch = out; HD.winSig = null; hdWindowsBatch(groups, true);
  return out;
}
// windows: two merged meshes, lit and dark, rebuilt only when the set of lit houses changes
function hdWindowsBatch(groups, force, dark){
  const sig = groups.map(g=>g.userData.frontMat && litBuilding(g.userData.b) ? 1 : 0).join('');
  if (!force && sig === HD.winSig) return; HD.winSig = sig;
  if (HD.winMeshes) HD.winMeshes.forEach(m=>{ if (m.parent) m.parent.remove(m); m.geometry.dispose(); });
  const lit = [], unlit = []; groups.forEach((g, i)=>{ const fm = g.userData.frontMat; if (!fm) return; g.children.forEach(o=>{ if (o.isMesh && o.material===fm){ o.visible = false; o.userData.batched = true; (sig[i]==='1' ? lit : unlit).push([o, 0]); } }); });
  const mk = (list, m) => { if (!list.length) return null; const mesh = new THREE.Mesh(hdMergeForBatch(list), m); mesh.receiveShadow = true; HD.bldBatch.add(mesh); return mesh; };
  const gl = HD.mats.glassLit || (HD.mats.glassLit = hdGlassMat()), gd = HD.mats.glassDark || (HD.mats.glassDark = hdGlassMat()); gl.userData.shared = gd.userData.shared = true;
  HD.winMeshes = [mk(lit, gl), mk(unlit, gd)].filter(Boolean);
}
function hdWindowsUpdate(dark){ if (!HD.bldBatch || !R3.bldGroups) return; hdWindowsBatch(R3.bldGroups, false); if (HD.mats.glassLit) HD.mats.glassLit.emissiveIntensity = dark > 0.12 ? 0.9*dark/0.68 + 0.25 : 0.55; } // a warm glow from inside wherever someone is home, day or night

// props that share a cached shape (barrels, crates, fences, signs, graves, lamp posts...) are drawn as one instanced mesh per shape
function hdInstanceProps(grp){
  const by = new Map();
  grp.children.slice().forEach(o=>{ if (!o.isMesh || o.isInstancedMesh || o.children.length || o.userData.flame || Array.isArray(o.material)) return;
    const k = o.geometry.uuid + '|' + o.material.uuid; let e = by.get(k); if (!e){ e = {geo:o.geometry, mat:o.material, list:[], shadow:o.castShadow}; by.set(k, e); } e.list.push(o); });
  for (const e of by.values()){ if (e.list.length < 2) continue; const im = new THREE.InstancedMesh(e.geo, e.mat, e.list.length);
    e.list.forEach((o, i)=>{ o.updateMatrix(); im.setMatrixAt(i, o.matrix); grp.remove(o); }); im.castShadow = e.shadow; im.receiveShadow = true; im.computeBoundingSphere(); im.userData.shared = true; grp.add(im); }
}
