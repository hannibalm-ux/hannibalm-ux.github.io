/* =====================================================================
   Pixel Town — 3D models
   Voxel people with realistic proportions (jointed limbs, sculpted faces, clothing, body variation, aging,
   genetics, tools in hand), voxel animals with species anatomy, 3D props, crops, fences and carts, buildings that show their upkeep,
   and simple interiors that are only built when the camera is close enough to see them.
   Used by both the classic town and the civilization mode.
   ===================================================================== */
// ---------- geometry helpers: many coloured parts merged into one mesh ----------
const LP = {mat:null, cache:new Map()};
function lpMat(){ return LP.mat || (LP.mat = new THREE.MeshLambertMaterial({vertexColors:true, flatShading:true})); }
function lpPart(geo, color, pos, rot, scl){ const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot||[0,0,0]))); m.compose(new THREE.Vector3(...(pos||[0,0,0])), q, new THREE.Vector3(...(scl||[1,1,1]))); return {geo, color, m}; }
function lpMerge(parts){
  let n = 0; const gs = parts.map(p=>{ const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo.clone()); g.applyMatrix4(p.m); n += g.attributes.position.count; return [g, p.color]; });
  const pos = new Float32Array(n*3), nor = new Float32Array(n*3), col = new Float32Array(n*3); const C = new THREE.Color(); let o = 0;
  gs.forEach(([g, c])=>{ C.set(c); const P = g.attributes.position.array, N = g.attributes.normal ? g.attributes.normal.array : null, cnt = g.attributes.position.count;
    pos.set(P, o*3); if (N) nor.set(N, o*3); for (let i=0;i<cnt;i++){ col[(o+i)*3] = C.r; col[(o+i)*3+1] = C.g; col[(o+i)*3+2] = C.b; } o += cnt; g.dispose(); });
  const G = new THREE.BufferGeometry(); G.setAttribute('position', new THREE.BufferAttribute(pos,3)); G.setAttribute('normal', new THREE.BufferAttribute(nor,3)); G.setAttribute('color', new THREE.BufferAttribute(col,3)); G.computeVertexNormals(); G.computeBoundingSphere(); return G;
}
const LPG = {}; // shared primitive geometries
function lpG(){ if (LPG.ico) return LPG;
  Object.assign(LPG, {ico:new THREE.IcosahedronGeometry(1,1), ico0:new THREE.IcosahedronGeometry(1,0), cyl:new THREE.CylinderGeometry(1,1,1,7), cylT:new THREE.CylinderGeometry(0.78,1,1,8), cap:new THREE.CapsuleGeometry(1,1,2,6), box:new THREE.BoxGeometry(1,1,1),
    cone:new THREE.ConeGeometry(1,1,6), sph:new THREE.SphereGeometry(1,8,6), half:new THREE.SphereGeometry(1,8,5,0,Math.PI*2,0,Math.PI*0.55), dod:new THREE.DodecahedronGeometry(1,0), tor:new THREE.TorusGeometry(1,0.18,4,10)});
  return LPG; }
const lpShade = (hex, f) => shade(hex, f);

// ---------- people: detailed voxel figures with realistic proportions ----------
// Built from boxes in "voxels" (VOX world units each), like a hand-made voxel character sheet: an adult is about
// 37 voxels tall (six and a half heads), with a proper chest and shoulders, sleeves, belt, tunic, trousers and boots,
// a sculpted face and clumped voxel hair. Limbs are split at elbows and knees so they bend.
const VOX = 0.043;
function lpLook(c){
  const L = c.look || {}, G = (c.civ && c.civ.genes) || {height:(hash(c.id+'h')%100)/100, build:(hash(c.id+'b')%100)/100, jaw:(hash(c.id+'j')%100)/100, nose:(hash(c.id+'n')%100)/100, brow:0.5, eye:'#3a2a1a'};
  const female = genderOf(c)==='F', kid = !isAdult(c), age = c.age||30;
  return {L, G, female, kid, age, skin:L.skin||'#e0b090', hair:L.hair||'#5a3a20', shirt:L.shirt||'#4e8a3a', pants:L.pants||'#3a2a24', boots:L.boots||'#7a5030', eye:L.eye||G.eye||'#3a2a1a', under:L.under||(L.apron&&!L.bib?L.apron:'#d8ceb0')};
}
function lpKey(c){ const L = c.look||{}, G = (c.civ&&c.civ.genes)||{}; return [L.skin,L.hair,L.style,L.beard,L.shirt,L.pants,L.hat,L.apron,L.coat,L.boots,L.under,L.eye,G.height,G.build,G.jaw,G.nose, genderOf(c), isAdult(c), Math.floor((c.age||0)/4), c.away?1:0].join('|'); }
let VOX_NOISE = null, VOX_MAT = null;
function voxNoiseTex(){
  if (VOX_NOISE) return VOX_NOISE;
  const c = mk(32,32), g = c.getContext('2d'), img = g.createImageData(32,32);
  for (let y=0;y<32;y++) for (let x=0;x<32;x++){ const n = hashf(x,y,901), v = Math.round(214 + n*41 - (hashf(x,y,902)<0.06 ? 26 : 0)); const i=(y*32+x)*4; img.data[i]=img.data[i+1]=img.data[i+2]=v; img.data[i+3]=255; }
  g.putImageData(img,0,0);
  VOX_NOISE = new THREE.CanvasTexture(c); VOX_NOISE.wrapS = VOX_NOISE.wrapT = THREE.RepeatWrapping; VOX_NOISE.magFilter = VOX_NOISE.minFilter = THREE.NearestFilter; VOX_NOISE.generateMipmaps = false;
  return VOX_NOISE;
}
function voxMat(){ return VOX_MAT || (VOX_MAT = new THREE.MeshLambertMaterial({vertexColors:true, map:voxNoiseTex()})); }
const VOX_FACES = [
  [[1,0,0], [[1,0,1],[1,0,0],[1,1,0],[1,1,1]]], [[-1,0,0],[[0,0,0],[0,0,1],[0,1,1],[0,1,0]]],
  [[0,1,0], [[0,1,1],[1,1,1],[1,1,0],[0,1,0]]], [[0,-1,0],[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]],
  [[0,0,1], [[0,0,1],[1,0,1],[1,1,1],[0,1,1]]], [[0,0,-1],[[1,0,0],[0,0,0],[0,1,0],[1,1,0]]]];
// boxes: [x0,y0,z0,x1,y1,z1,hex] in voxels -> one merged, vertex-coloured geometry with one noise texel per voxel
function voxGeo(boxes){
  const n = boxes.length, pos = new Float32Array(n*72), nor = new Float32Array(n*72), col = new Float32Array(n*72), uv = new Float32Array(n*48), idx = new Uint32Array(n*36);
  const C = new THREE.Color(); let v = 0;
  boxes.forEach((b, bi)=>{
    const [x0,y0,z0,x1,y1,z1,hex] = b, sz = [x1-x0, y1-y0, z1-z0], o = [x0,y0,z0], off = (hash(String(bi)+hex)%29)/32;
    C.set(hex);
    VOX_FACES.forEach(([nm, cs], fi)=>{
      const base = v, shade = nm[1]>0 ? 1.06 : nm[1]<0 ? 0.78 : 1;
      const ax = k => cs[k].map((q,i)=>q); // corner in 0/1
      const d1 = [0,1,2].find(i=>cs[1][i]!==cs[0][i]), d2 = [0,1,2].find(i=>cs[3][i]!==cs[0][i]);
      cs.forEach((q,ci)=>{
        for (let i=0;i<3;i++){ pos[v*3+i] = (o[i] + q[i]*sz[i]) * VOX; nor[v*3+i] = nm[i]; }
        col[v*3] = C.r*shade; col[v*3+1] = C.g*shade; col[v*3+2] = C.b*shade;
        const a = Math.abs(q[d1]-cs[0][d1]), bb = Math.abs(q[d2]-cs[0][d2]);
        uv[v*2] = a*sz[d1]/32 + off + o[d1]/32; uv[v*2+1] = bb*sz[d2]/32 + off*0.7 + o[d2]/32;
        v++; });
      const t = (bi*6+fi)*6; idx[t]=base; idx[t+1]=base+1; idx[t+2]=base+2; idx[t+3]=base; idx[t+4]=base+2; idx[t+5]=base+3;
    });
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos,3)); g.setAttribute('normal', new THREE.BufferAttribute(nor,3));
  g.setAttribute('color', new THREE.BufferAttribute(col,3)); g.setAttribute('uv', new THREE.BufferAttribute(uv,2)); g.setIndex(new THREE.BufferAttribute(idx,1));
  g.computeBoundingSphere(); return g;
}
function lpBuild(c){
  const K = lpLook(c), {L, G, female, kid} = K, age = K.age, hr = mapRand(hash(c.id+'vox'));
  const sh = (h,f) => shade(h,f);
  const skin = K.skin, skinD = sh(skin,0.88), skinL = sh(skin,1.05), hair = K.hair, hairD = sh(hair,0.7), hairL = sh(hair,1.18);
  const shirt = L.coat || K.shirt, shirtD = sh(shirt,0.78), shirtL = sh(shirt,1.14), under = K.under, underD = sh(under,0.84);
  const pants = K.pants, pantsD = sh(pants,0.8), boots = K.boots, bootsL = sh(boots,1.2), bootsD = sh(boots,0.72);
  const w = (female ? 0.88 : 1) * (0.84 + (G.build||0.5)*0.2), hipW = female ? 1.08 : 1;
  const body = [], armUL = [], armLL = [], armUR = [], armLR = [], legU = [], legL = [];
  const B = (a,x0,y0,z0,x1,y1,z1,hex) => a.push([x0,y0,z0,x1,y1,z1,hex]);
  // legs: hip pivot at y=17, knee at 8.2 below it; boots with a turned-down cuff and a real foot
  const lw = 1.95*w, ld = 1.95;
  B(legU, -lw,-8.4,-ld, lw,0.4,ld, pants); B(legU, -lw-0.05,-8.4,ld-0.4, -lw+0.6,0.2,ld+0.05, pantsD); B(legU, -lw,-1.2,-ld-0.05, lw,0.4,ld+0.05, pantsD);
  B(legL, -lw*0.96,-3.2,-ld*0.96, lw*0.96,0.2,ld*0.96, pants);
  B(legL, -lw-0.25,-8.2,-ld-0.25, lw+0.25,-3,ld+0.25, boots);
  B(legL, -lw-0.5,-4.2,-ld-0.5, lw+0.5,-2.8,ld+0.5, bootsL); B(legL, -lw-0.5,-4.2,ld+0.4, lw+0.5,-3.6,ld+0.55, sh(boots,1.05));
  B(legL, -lw-0.25,-8.8,-ld-0.25, lw+0.25,-7,ld+1.9, bootsD); B(legL, -lw-0.3,-8.8,-ld-0.3, lw+0.3,-8.3,ld+2, '#2a1c14'); B(legL, -lw+0.3,-7.6,ld+1.5, lw-0.3,-7,ld+1.95, sh(boots,1.1));
  // hips, tunic hem, belt
  B(body, -4.4*w*hipW,14.6,-2.3, 4.4*w*hipW,18,2.3, pants);
  B(body, -4.95*w*hipW,13.4,-2.8, 4.95*w*hipW,17.6,2.8, under); B(body, -5*w*hipW,13.4,-2.85, 5*w*hipW,14.1,2.85, underD);
  B(body, -4.85*w,17.6,-2.65, 4.85*w,18.7,2.65, '#4e3222'); B(body, -0.7,17.5,2.65, 0.7,18.8,2.85, '#c8a860');
  // torso: an open shirt over an undershirt, broad at the shoulders
  B(body, -4.65*w,18.7,-2.45, 4.65*w,26.2,2.45, shirt);
  B(body, -5.3*w,25.4,-2.6, 5.3*w,27.4,2.6, shirt); B(body, -5.3*w,27.1,-2.6, 5.3*w,27.5,2.6, shirtL);
  B(body, -4.65*w,18.7,-2.5, 4.65*w,19.3,-2.45, shirtD); B(body, -0.3,19,-2.55, 0.3,26.8,-2.45, shirtD);
  if (female && !kid){ B(body, -3.5*w,21.4,2.4, -1.25,24.8,3.05, shirt); B(body, 1.25,21.4,2.4, 3.5*w,24.8,3.05, shirt); B(body, -3.4*w,21.2,2.4, 3.4*w,21.6,2.85, shirtD); if (!L.coat){ B(body, -1.3,21.4,2.4, 1.3,24.8,2.9, under); B(body, -2.1,21.4,2.9, -1.2,24.9,3.25, shirtD); B(body, 1.2,21.4,2.9, 2.1,24.9,3.25, shirtD); } }
  if (!L.coat){ B(body, -1.55,18.7,2.45, 1.55,26.9,2.62, under); B(body, -1,24.9,2.5, 1,27.3,2.7, skin);
    B(body, -2.25,18.9,2.45, -1.45,27.2,2.85, shirtD); B(body, 1.45,18.9,2.45, 2.25,27.2,2.85, shirtD); B(body, -2.3,25.8,2.6, -1.3,27.3,3, shirtL); B(body, 1.3,25.8,2.6, 2.3,27.3,3, shirtL); }
  else { B(body, -5*w,12.2,-2.8, 5*w,18.7,2.8, L.coat); B(body, -0.2,12.2,2.8, 0.2,26,2.95, sh(L.coat,0.7)); B(body, -1.2,25,2.45, 1.2,27.3,2.7, under); }
  if (L.apron){ const top = L.bib ? 24 : 17.8; B(body, -3.3,11,2.8, 3.3,top,3.2, L.apron); if (L.bib){ B(body, -3.3,23.4,-2.5, -2.6,27.3,2.5, L.apron); B(body, 2.6,23.4,-2.5, 3.3,27.3,2.5, L.apron); } if (L.stains){ B(body,-1.5,14,3.2,0,15.2,3.3,'#9a2a2a'); B(body,1,18.5,3.2,2,19.5,3.3,'#9a2a2a'); } }
  // a satchel on a cross-body strap, as on the reference sheet
  if (hash(c.id+'bag')%3!==1 || c.away){ for (let k=0;k<9;k++){ const t = k/8, x = -4.4+t*8.8, y = 27-t*9.2; B(body, x-0.55,y-0.6,2.45, x+0.55,y+0.6,2.85, '#6a4e32'); B(body, -x-0.55,y-0.6,-2.85, -x+0.55,y+0.6,-2.45, '#6a4e32'); }
    B(body, 4.4*w,12.4,-1.4, 6.9*w,17.6,2.5, '#7a6a4c'); B(body, 4.35*w,16,-1.45, 6.95*w,17.8,2.6, '#665838'); B(body, 6.9*w,14.6,0.4, 7.05*w,15.4,1.4, '#c8a860'); }
  // neck and head: a sculpted face with a jaw, nose, eyes, brows, ears, cheeks and mouth shaped by genes
  B(body, -1.35,27.3,-1.25, 1.35,28.8,1.35, skinD);
  const H0 = 28.6, jw = 2.2 + (G.jaw||0.5)*0.9;
  B(body, -3.25,H0+1.2,-2.9, 3.25,H0+7.4,3.2, skin);
  B(body, -jw,H0-0.2,-2.2, jw,H0+1.4,2.95, skin); B(body, -jw+0.4,H0-0.2,2.6, jw-0.4,H0+0.5,3.05, skinD);
  B(body, -3.25,H0+1.2,3.1, -2.6,H0+3,3.25, skinD); B(body, 2.6,H0+1.2,3.1, 3.25,H0+3,3.25, skinD);
  const ey = H0+3.4;
  [[-2.35,-0.75],[0.75,2.35]].forEach(([a,b],i)=>{ B(body, a,ey,3.2, b,ey+1.05,3.27, '#f6f2ec'); const px = i===0 ? b-0.8 : a; B(body, px,ey,3.22, px+0.8,ey+1.05,3.32, K.eye); B(body, px+(i===0?0.25:0.2),ey+0.25,3.3, px+(i===0?0.6:0.55),ey+0.75,3.36, '#141014');
    B(body, a-0.1,ey+1.45,3.2, b+0.1,ey+1.9+(G.brow||0.5)*0.2,3.33, hairD); if (female) B(body, (i===0?a-0.3:b), ey+0.7, 3.2, (i===0?a:b+0.3), ey+1.15, 3.3, '#2a1a14');
    if (female || kid) B(body, i===0?-2.6:1.6, H0+2,3.2, i===0?-1.6:2.6, H0+2.6,3.26, mix(skin,'#d86a6a',0.28)); });
  const nw = 0.42 + (G.nose||0.5)*0.28, nl = 0.55 + (G.nose||0.5)*0.75;
  B(body, -nw,H0+2.2,3.2, nw,H0+3.8,3.2+nl, sh(skin,0.95)); B(body, -nw-0.1,H0+2.2,3.2, nw+0.1,H0+2.6,3.2+nl*0.8, skinD);
  B(body, -1.05,H0+1.2,3.2, 1.05,H0+1.62,3.28, female ? '#b8504a' : sh(skin,0.72)); B(body, -1.35,H0+1.5,3.2, -1.05,H0+1.8,3.26, sh(skin,0.8)); B(body, 1.05,H0+1.5,3.2, 1.35,H0+1.8,3.26, sh(skin,0.8));
  B(body, -3.55,H0+2.2,-0.7, -3.2,H0+4.4,0.8, skinD); B(body, 3.2,H0+2.2,-0.7, 3.55,H0+4.4,0.8, skinD);
  if (age>45) B(body, -2,ey+2.1,3.2, 2,ey+2.3,3.26, skinD);
  if (age>60){ B(body, -3,ey-0.2,3.2, -2.5,ey+0.9,3.26, skinD); B(body, 2.5,ey-0.2,3.2, 3,ey+0.9,3.26, skinD); B(body, -1.8,H0+0.8,3.2, -1.4,H0+2,3.26, skinD); B(body, 1.4,H0+0.8,3.2, 1.8,H0+2,3.26, skinD); }
  if (L.beard && !female && !kid){ B(body, -jw-0.2,H0-0.8,0.8, jw+0.2,H0+1.9,3.4, hair); B(body, -1.5,H0+1.8,3.2, 1.5,H0+2.3,3.45, hair); B(body, -3.3,H0+1.2,0.2, -2.4,H0+3.6,3.2, hair); B(body, 2.4,H0+1.2,0.2, 3.3,H0+3.6,3.2, hair); }
  // hair: clumped voxels with light and dark strands
  const style = L.style || 'short', hatted = !!L.hat, top = H0+7.4, cl = k => [hair, hairD, hairL, hair][Math.floor(hr()*4)];
  if (style!=='bald'){
    if (!hatted){ B(body, -3.55,top-1.4,-3.3, 3.55,top+0.7,3.55, hair);
      for (let k=0;k<16;k++){ const x = -3.4 + hr()*6, z = -3 + hr()*6, h = 0.4 + hr()*1.1; B(body, x,top+0.4,z, x+1.1+hr()*0.6,top+0.7+h,z+1.1+hr()*0.6, cl(k)); }
      for (let k=0;k<7;k++){ const x = -3.3 + k*0.95, len = 0.4 + hr()*1.1; B(body, x,top-0.6-len,3.15, x+1.05,top+0.4,3.75, cl(k)); } }
    const backLow = style==='long' ? H0-3 : style==='short' || style==='spiky' ? H0+2.6 : H0+1.4;
    B(body, -3.55,backLow,-3.55, 3.55,top-0.2,-2.7, hair); for (let k=0;k<6;k++){ const x = -3.5 + k*1.2; B(body, x,backLow-hr()*1.2,-3.7, x+1.2,backLow+1.5,-3.3, cl(k)); }
    [-1,1].forEach(s=>{ B(body, s<0?-3.6:3.25,H0+2.8-(style==='long'?4:0),-3.3, s<0?-3.25:3.6,top-0.2,1.8, hair); for (let k=0;k<4;k++){ const z = -3 + k*1.3, y = H0+2.6+hr()*1.2; B(body, s<0?-3.8:3.35,y,z, s<0?-3.35:3.8,y+1.6,z+1.2, cl(k)); } });
    if (style==='long'){ for (let k=0;k<7;k++){ const x = -3.4 + k*0.98; B(body, x,H0-3.6-hr()*1.4,-3.8, x+1,H0+1,-2.9, cl(k)); } }
    if (style==='pony'){ B(body, -0.8,top-2.6,-3.95, 0.8,top-1.3,-3.4, '#3a2a1e');
      const seg = [[0,top-1.2,-4.6,2.6],[0,top-0.2,-6,2.4],[0,top-1.8,-7.1,2.3],[0,top-4,-7.4,2.1],[0,top-6.3,-7.1,1.9],[0,top-8.3,-6.6,1.5]];
      seg.forEach(([x,y,z,s2],i)=>{ B(body, x-s2/2,y-1.3,z-s2/2, x+s2/2,y+1.1,z+s2/2, cl(i)); for (let k=0;k<3;k++){ const ox = (hr()-0.5)*s2, oz = (hr()-0.5)*s2; B(body, x+ox-0.55,y-1.8+hr(),z+oz-0.55, x+ox+0.55,y+0.2,z+oz+0.55, cl(k+i)); } }); }
    if (style==='bun'){ B(body, -1.7,top-1.3,-5.6, 1.7,top+1.7,-3.2, hair); B(body, -1.2,top-0.8,-5.95, 1.2,top+1.2,-5.4, hairD); B(body, -1.4,top+1.4,-5, 1.4,top+2,-3.6, hairL); }
    if (style==='curly'){ for (let k=0;k<22;k++){ const a = hr()*Math.PI*2, rr = 3.4, x = Math.cos(a)*rr, z = Math.sin(a)*rr*0.95, y = H0+2.5+hr()*6; B(body, x-0.9,y-0.9,z-0.9, x+0.9,y+0.9,z+0.9, cl(k)); } }
    if (style==='spiky' && !hatted){ for (let k=0;k<9;k++){ const x = -3+k*0.75, z = -2.4+(k%3)*1.8; B(body, x-0.45,top+0.6,z-0.45, x+0.45,top+2.2+hr()*1.2,z+0.45, cl(k)); } }
  } else if (!hatted){ B(body, -3.55,H0+2.6,-3.4, 3.55,H0+4.6,-2.6, hair); B(body, -3.6,H0+2.6,-2.6, -3.25,H0+4.4,0.6, hair); B(body, 3.25,H0+2.6,-2.6, 3.6,H0+4.4,0.6, hair); }
  const hc = L.hatCol || {straw:'#d8b860', cowboy:'#8a5a30', cap:'#5a4a3a', bucket:'#6a7040', toque:'#f4f2ee', beanie:'#b83a2a', helmet:'#5a5a64', bandana:'#8a2a2a', tricorn:'#2a2230'}[L.hat] || '#5a4a3a', band = sh(hc,0.7);
  switch (L.hat){
    case 'straw': B(body, -6,top-0.6,-5.6, 6,top,6.2, hc); B(body, -3.6,top,-3.6, 3.6,top+2.4,3.9, hc); B(body, -3.65,top,-3.65, 3.65,top+0.7,3.95, '#8a3a2a'); break;
    case 'cowboy': B(body, -6.4,top-0.5,-5.2, 6.4,top,5.8, hc); B(body, -6.4,top,-5.2, -5,top+1.2,5.8, hc); B(body, 5,top,-5.2, 6.4,top+1.2,5.8, hc); B(body, -3.4,top,-3.3, 3.4,top+3,3.6, hc); B(body, -3.45,top,-3.35, 3.45,top+0.7,3.65, band); break;
    case 'cap': B(body, -3.8,top-1.3,-3.8, 3.8,top+1.3,4, hc); B(body, -3.4,top-1.3,3.9, 3.4,top-0.7,6.6, band); break;
    case 'bucket': B(body, -3.9,top-1.4,-3.9, 3.9,top+2,4.2, hc); B(body, -5,top-1.6,-5, 5,top-1,5.3, band); break;
    case 'toque': B(body, -3.7,top-1.2,-3.7, 3.7,top+0.3,3.9, hc); B(body, -4.2,top+0.3,-4.2, 4.2,top+4.6,4.4, hc); break;
    case 'beanie': B(body, -3.9,top-2,-3.9, 3.9,top+1.6,4.1, hc); B(body, -4,top-2.4,-4, 4,top-1.2,4.2, sh(hc,1.2)); B(body, -0.8,top+1.6,-0.6, 0.8,top+2.6,1, sh(hc,1.2)); break;
    case 'helmet': B(body, -4,top-1.8,-4, 4,top+2.2,4.3, hc); B(body, -4.7,top-2.1,-4.7, 4.7,top-1.5,5, band); B(body, -0.6,top+2.2,-0.6, 0.6,top+3,1, '#c8a860'); break;
    case 'bandana': B(body, -3.85,top-2,-3.85, 3.85,top+0.8,4.1, hc); B(body, -0.8,top-2.6,-5.1, 0.8,top-0.8,-3.8, hc); break;
    case 'tricorn': B(body, -5.5,top-0.4,-4.8, 5.5,top+0.4,5.2, hc); B(body, -3.4,top+0.4,-3.2, 3.4,top+2.4,3.6, hc); B(body, -5.8,top+0.4,-5, -4.4,top+1.6,-3.6, hc); B(body, 4.4,top+0.4,-5, 5.8,top+1.6,-3.6, hc); B(body, -1,top+0.4,4.8, 1,top+1.6,5.8, hc); break;
  }
  // arms: short rolled sleeves, bare forearms, hands with a thumb; coats cover the arm
  const aw = 1.55*Math.sqrt(w);
  [[armUL,armLL,-1],[armUR,armLR,1]].forEach(([u,l,s])=>{
    B(u, -aw,-4.8,-aw, aw,0.9,aw, shirt); B(u, -aw-0.15,-5.5,-aw-0.15, aw+0.15,-4.5,aw+0.15, L.coat ? shirt : shirtL);
    B(u, -aw+0.2,-7.4,-aw+0.2, aw-0.2,-5.5,aw-0.2, L.coat ? shirt : skin);
    B(l, -aw+0.25,-5.4,-aw+0.25, aw-0.25,0.2,aw-0.25, L.coat ? shirt : skin); B(l, -aw+0.3,-5.6,-aw+0.3, aw-0.3,-4.9,aw-0.3, L.coat ? sh(shirt,1.2) : skinD);
    B(l, -aw+0.2,-7.9,-1.1, aw-0.2,-5.4,1.35, skin); B(l, s<0?aw-0.6:-aw-0.2, -6.6,0.2, s<0?aw+0.2:-aw+0.6, -5.4,1.2, skinD); B(l, -aw+0.25,-8.3,-0.9, aw-0.25,-7.8,1.1, skinD); });
  // assemble: joints at the shoulders, elbows, hips and knees
  const mat = voxMat(), grp = new THREE.Group(), fig = new THREE.Group(); grp.add(fig);
  const mesh = boxes => { const m = new THREE.Mesh(voxGeo(boxes), mat); m.castShadow = true; m.receiveShadow = true; return m; };
  const torso = mesh(body); fig.add(torso);
  const limb = (up, low, x, y, lowY) => { const pivot = new THREE.Group(); pivot.position.set(x*VOX, y*VOX, 0); pivot.add(mesh(up)); const joint = new THREE.Group(); joint.position.set(0, lowY*VOX, 0); joint.add(mesh(low)); pivot.add(joint); fig.add(pivot); return {pivot, joint}; };
  const sx = 6.0*w, hx = 2.3*w*hipW;
  const aL = limb(armUL, armLL, -sx, 26.9, -7.4), aR = limb(armUR, armLR, sx, 26.9, -7.4);
  const lL = limb(legU, legL, -hx, 17, -8.4), lR = limb(legU, legL, hx, 17, -8.4);
  const hand = new THREE.Group(); hand.position.set(0, -6.8*VOX, 0.3*VOX); aR.joint.add(hand);
  // size from genes; children grow gradually; the old shrink a little and stoop
  const adultH = 0.94 + (G.height||0.5)*0.16 + (female ? -0.05 : 0.02);
  const growth = kid ? clamp(0.42 + (age/17)*0.58, 0.42, 1) : 1, shrink = age>65 ? 1 - (age-65)*0.003 : 1;
  const s = adultH*growth*shrink; grp.scale.set(s, s, s);
  const stoop = age>58 ? clamp((age-58)/30, 0, 0.35) : 0;
  grp.userData = {fig, torso, aL, aR, lL, lR, hand, tool:null, toolKind:null, key:lpKey(c), yaw:0, phase:hash(c.id)%100, stoop, slow: age>62 ? 0.7 : kid ? 1.25 : 1};
  return grp;
}
// what people hold while they work
const LP_TOOL_FOR = {chop:'axe', quarry:'pick', mine:'pick', prospect:'pick', build:'hammer', fish:'rod', hunt:'spear', forage:'basket', gather:'basket', water:'bucket', research:'flask', teach:'book', learn:'book', heal:'bag', trade:'crate', farm:'hoe', herd:'staff', craft:'hammer', cook:'pot', patrol:'staff'};
const LP_TOOL_PROF = {Woodcutter:'axe', Unemployed:'axe', Miner:'pick', Farmer:'hoe', Rancher:'staff', Fisher:'rod', Carpenter:'hammer', Blacksmith:'hammer', Doctor:'bag', Teacher:'book', Merchant:'crate', Baker:'pot', Journalist:'book'};
function lpToolFor(c){
  if (c.rt.state!=='Working' || c.rt.path) return c.rt.path && c.away ? 'sack' : null;
  const b = c.plan && c.plan.blocks && c.plan.blocks[c.rt.blockIdx];
  if (b && b.task) return LP_TOOL_FOR[b.task] || (b.task==='job' ? lpJobTool(c) : null);
  return LP_TOOL_PROF[c.profession] || null;
}
function lpJobTool(c){ const j = typeof civJobOf==='function' && civJobOf(c); const o = j && S.civ.orgs[j.org]; const ind = o && BUSINESS_TYPES[o.biz] ? BUSINESS_TYPES[o.biz].industry : ''; return {metal:'hammer', crafts:'hammer', construction:'hammer', food:'pot', health:'bag', professional:'book', retail:'crate', media:'book', chemicals:'flask', energy:'pick', mining:'pick', textiles:'basket'}[ind] || 'crate'; }
function lpTool(kind){
  if (LP.cache.has('tool:'+kind)) return LP.cache.get('tool:'+kind).clone();
  const g = lpG(), W = '#8a6038', M = '#a8a8b4', P = [];
  switch (kind){
    case 'axe': P.push(lpPart(g.cyl, W, [0,0.1,0.12], [Math.PI/2,0,0], [0.014,0.5,0.014]), lpPart(g.box, M, [0,0.1,0.36], [0,0,0], [0.012,0.09,0.07])); break;
    case 'pick': P.push(lpPart(g.cyl, W, [0,0.05,0.12], [Math.PI/2,0,0], [0.014,0.5,0.014]), lpPart(g.box, M, [0,0.05,0.36], [0,0,0], [0.02,0.03,0.26])); break;
    case 'hammer': P.push(lpPart(g.cyl, W, [0,0.02,0.08], [Math.PI/2,0,0], [0.012,0.28,0.012]), lpPart(g.box, '#5a5a64', [0,0.02,0.22], [0,0,0], [0.07,0.035,0.035])); break;
    case 'rod': P.push(lpPart(g.cyl, W, [0,0.35,0.3], [0.9,0,0], [0.008,0.95,0.008]), lpPart(g.cyl, '#e8e8f0', [0,0.4,0.72], [0,0,0], [0.002,0.8,0.002])); break;
    case 'spear': P.push(lpPart(g.cyl, W, [0,0.25,0.1], [0.2,0,0], [0.012,1.2,0.012]), lpPart(g.cone, '#8a8278', [0,0.86,0.22], [0.2,0,0], [0.025,0.1,0.025])); break;
    case 'basket': P.push(lpPart(g.cylT, '#b89058', [0,-0.08,0.02], [Math.PI,0,0], [0.1,0.11,0.1]), lpPart(g.tor, '#8a6a3a', [0,0.02,0.02], [Math.PI/2,0,0], [0.08,0.08,0.08])); break;
    case 'bucket': P.push(lpPart(g.cylT, '#7a5a3a', [0,-0.1,0], [Math.PI,0,0], [0.08,0.12,0.08])); break;
    case 'flask': P.push(lpPart(g.sph, '#a8e0d8', [0,-0.02,0.04], [0,0,0], [0.045,0.05,0.045]), lpPart(g.cyl, '#c8f0e8', [0,0.05,0.04], [0,0,0], [0.015,0.06,0.015])); break;
    case 'book': P.push(lpPart(g.box, '#6a2a2a', [0,-0.02,0.04], [0.3,0,0], [0.12,0.16,0.035]), lpPart(g.box, '#f0e8d0', [0.004,-0.02,0.04], [0.3,0,0], [0.11,0.15,0.03])); break;
    case 'bag': P.push(lpPart(g.box, '#3a2a22', [0,-0.1,0.02], [0,0,0], [0.16,0.1,0.07]), lpPart(g.box, '#e8e8e8', [0,-0.08,0.058], [0,0,0], [0.04,0.04,0.004])); break;
    case 'crate': P.push(lpPart(g.box, '#a87a48', [0,-0.05,0.14], [0,0,0], [0.24,0.18,0.18])); break;
    case 'hoe': P.push(lpPart(g.cyl, W, [0,0.2,0.1], [0.15,0,0], [0.012,1.1,0.012]), lpPart(g.box, M, [0,-0.33,0.14], [0,0,0], [0.1,0.03,0.06])); break;
    case 'staff': P.push(lpPart(g.cyl, W, [0,0.25,0.05], [0.1,0,0], [0.014,1.3,0.014])); break;
    case 'pot': P.push(lpPart(g.sph, '#5a4a44', [0,-0.06,0.06], [0,0,0], [0.1,0.08,0.1])); break;
    case 'sack': P.push(lpPart(g.ico, '#c8b080', [0,-0.05,-0.12], [0,0,0], [0.12,0.15,0.1])); break;
    default: return null;
  }
  const m = new THREE.Mesh(lpMerge(P), lpMat()); m.castShadow = true; LP.cache.set('tool:'+kind, m); return m.clone();
}
function lpDispose(g){ g.traverse(o=>{ if (o.isMesh && o.geometry && !o.userData.shared) o.geometry.dispose(); }); R3.scene.remove(g); }
// animate: walking bends knees and elbows; work swings the tool; the old walk slowly and stoop
function lpAnimate(c, g, p, ts, dtv){
  const U = g.userData, moving = p.moving && (p.dx||p.dy);
  if (moving) U.target = Math.atan2(p.dx, p.dy);
  if (U.target!=null){ const dy = Math.atan2(Math.sin(U.target-U.yaw), Math.cos(U.target-U.yaw)); U.yaw += dy*Math.min(1, dtv*10); }
  g.rotation.y = U.yaw;
  const ph = ts/160*U.slow + U.phase, sw = moving ? Math.sin(ph) : 0;
  const tool = lpToolFor(c); if (tool!==U.toolKind){ if (U.tool){ U.hand.remove(U.tool); } U.tool = tool ? lpTool(tool) : null; if (U.tool) U.hand.add(U.tool); U.toolKind = tool; }
  const working = c.rt.state==='Working' && !c.rt.path, sleep = c.rt.state==='Sleeping';
  U.lL.pivot.rotation.x = sw*0.55; U.lR.pivot.rotation.x = -sw*0.55;
  U.lL.joint.rotation.x = moving ? Math.max(0, Math.sin(ph+1.2))*0.7 : 0; U.lR.joint.rotation.x = moving ? Math.max(0, Math.sin(ph+1.2+Math.PI))*0.7 : 0;
  U.aL.pivot.rotation.x = -sw*0.5; U.aL.joint.rotation.x = -0.25 - (moving ? Math.max(0,-sw)*0.4 : 0);
  if (working && tool && ['axe','pick','hammer','hoe'].includes(tool)){ const k = ts/220 + U.phase; U.aR.pivot.rotation.x = -1.6 + Math.sin(k)*0.9; U.aR.joint.rotation.x = -0.4 + Math.cos(k)*0.3; }
  else if (working && tool==='rod'){ U.aR.pivot.rotation.x = -0.7 + Math.sin(ts/900)*0.05; U.aR.joint.rotation.x = -0.4; }
  else if (working && (tool==='book'||tool==='flask'||tool==='bag')){ U.aR.pivot.rotation.x = -0.9; U.aR.joint.rotation.x = -1.1; }
  else { U.aR.pivot.rotation.x = sw*0.5 + (tool==='crate'||tool==='basket' ? -0.5 : 0); U.aR.joint.rotation.x = -0.25 - (moving ? Math.max(0,sw)*0.4 : 0) - (tool==='crate' ? 0.9 : 0); }
  U.aL.pivot.rotation.z = -0.07; U.aR.pivot.rotation.z = 0.07;
  U.fig.rotation.x = U.stoop + (working && tool==='hoe' ? 0.25 : 0);
  U.torso.position.y = moving ? 0 : Math.sin(ts/900 + U.phase)*0.004;
  return {moving, sleep};
}

// ---------- animals: voxel anatomy (legs, belly, neck and head, muzzle, ears, horns, tails, markings) ----------
// Sizes are in animal voxels (AVOX world units). Each animal has a body, a head on a neck that bends to graze,
// four legs that swing (two for birds), and its species' markings.
const AVOX = 0.036;
const AN3 = {
  cow:    {L:30, H:13, W:12, leg:13, lw:3.4, neck:5, nk:0.3, hl:10, hh:7.5, hw:7, snout:3.5, body:'#f2efe8', belly:'#e8e2d6', dark:'#1e1e24', hoof:'#2a2420', nose:'#e8a0a8', spots:true, horns:'#e8e0c8', ears:'side', tail:'tuft', udder:true, alt:'#8a5a3a'},
  horse:  {L:30, H:12, W:10, leg:19, lw:2.8, neck:10, nk:0.5, hl:12, hh:6, hw:5.5, snout:4, body:'#8a5a34', belly:'#7a4e2c', dark:'#2a1a10', hoof:'#1e1814', nose:'#3a2a20', mane:true, ears:'up', tail:'long', alt:'#e8e0d0'},
  pig:    {L:22, H:10, W:11, leg:6, lw:3, neck:1, nk:0, hl:7, hh:8, hw:8, snout:3, body:'#eaa6b2', belly:'#f2bcc6', dark:'#c87888', hoof:'#8a4a50', nose:'#d88a96', disc:true, ears:'flop', tail:'curl', alt:'#6a4a3a'},
  sheep:  {L:20, H:11, W:11, leg:8, lw:2.1, neck:2, nk:0.3, hl:7, hh:6, hw:5, snout:2, body:'#ece8dc', belly:'#ded8c8', dark:'#2a2428', hoof:'#1a1618', nose:'#2a2428', wool:true, darkface:true, ears:'side', tail:'stub', alt:'#3a3436'},
  goat:   {L:18, H:9, W:7, leg:11, lw:1.9, neck:5, nk:0.6, hl:8, hh:5, hw:4.5, snout:2.5, body:'#d8ccb4', belly:'#e8dcc6', dark:'#8a7a60', hoof:'#3a3028', nose:'#4a3e30', horns:'#c8bca4', back:true, beard:true, ears:'side', tail:'up', alt:'#4a3a2a'},
  deer:   {L:22, H:9, W:7, leg:16, lw:1.8, neck:8, nk:0.6, hl:9, hh:5, hw:4.5, snout:3, body:'#9a6a3a', belly:'#e8dcc8', dark:'#5a3a1e', hoof:'#2a2018', nose:'#2a2018', antlers:true, ears:'up', tail:'white', alt:'#b88a52'},
  boar:   {L:22, H:11, W:9, leg:7, lw:2.6, neck:1, nk:0, hl:9, hh:7, hw:6.5, snout:3.5, body:'#4a3a30', belly:'#3a2e26', dark:'#2a1e18', hoof:'#1a1410', nose:'#5a4a40', disc:true, tusks:true, ridge:true, ears:'up', tail:'thin', alt:'#6a5040'},
  dog:    {L:16, H:7, W:6, leg:8, lw:2, neck:4, nk:0.7, hl:7, hh:5, hw:4.5, snout:3, body:'#a8763e', belly:'#e0c8a0', dark:'#5a3a1e', hoof:'#3a2a1a', nose:'#1a1410', ears:'flop', tail:'up', alt:'#2a2420'},
  wolf:   {L:20, H:8, W:7, leg:10, lw:2.2, neck:4, nk:0.5, hl:8, hh:5.5, hw:5, snout:3.5, body:'#7a7a80', belly:'#c8c8cc', dark:'#3a3a40', hoof:'#2a2a2e', nose:'#141418', ears:'up', tail:'bushy', alt:'#5a524a'},
  cat:    {L:11, H:5, W:4.5, leg:5, lw:1.4, neck:2, nk:0.7, hl:4, hh:4, hw:4.2, snout:1, body:'#7a7a82', belly:'#c8c8cc', dark:'#3a3a42', hoof:'#3a3a42', nose:'#e8a0a8', stripes:true, ears:'point', tail:'cat', alt:'#d8883a'},
  rabbit: {L:8, H:6, W:5, leg:2, lw:1.5, neck:1, nk:0.5, hl:4, hh:4, hw:3.6, snout:1, body:'#a8987e', belly:'#e8e0d0', dark:'#6a5a44', hoof:'#6a5a44', nose:'#e8a0a8', ears:'long', tail:'puff', alt:'#e8e4dc'},
  chicken:{L:7, H:6, W:5, leg:4, lw:0.7, neck:2, nk:0.9, hl:3, hh:3, hw:2.6, snout:1.2, body:'#f4f0e6', belly:'#e8e2d4', dark:'#d83a2a', hoof:'#e8a030', nose:'#f0a020', biped:true, comb:true, tail:'feathers', alt:'#c87a3a'},
  bird:   {L:5, H:3, W:3, leg:1, lw:0.4, neck:1, nk:0.5, hl:2.4, hh:2.2, hw:2, snout:1, body:'#5a4a3a', belly:'#b8a890', dark:'#2a2018', hoof:'#e0a030', nose:'#e0a030', flyer:true, tail:'feathers', alt:'#3a5a8a'},
  fish:   {L:11, H:3.6, W:1.8, fish:true, body:'#8aa0b8', belly:'#e0e8f0', dark:'#4a6078', alt:'#b88a5a'}
};
function an3Build(kind, variant){
  const A = AN3[kind] || AN3.dog, r = mapRand(hash(kind+(variant||0)+'an'));
  const B = (a,x0,y0,z0,x1,y1,z1,hex) => a.push([x0,y0,z0,x1,y1,z1,hex]);
  const bodyC = variant && A.alt ? A.alt : A.body, bodyD = shade(bodyC,0.82), bodyL = shade(bodyC,1.1);
  const core = [], head = [], legBoxes = [], L = A.L, H = A.H, W = A.W, y0 = A.leg||0;
  const grp = new THREE.Group(), mat = voxMat();
  const mk = (boxes) => { const g = voxGeo(boxes); g.scale(AVOX/VOX, AVOX/VOX, AVOX/VOX); const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m; };
  if (A.fish){ B(core, -W/2,-H/2,-L/2, W/2,H/2,L/2, bodyC); B(core, -W/2-0.05,-H/2,-L/2+1, W/2+0.05,-H/6,L/2-1, A.belly); B(core, -0.2,-H*0.9,-L/2-3, 0.2,H*0.9,-L/2, A.dark); B(core, -0.2,H/2,-2, 0.2,H/2+1.6,2, A.dark); B(core, -W/2-0.05,0.3,L/2-2, -W/2,1,L/2-1.2, '#141418'); B(core, W/2,0.3,L/2-2, W/2+0.05,1,L/2-1.2, '#141418');
    const m = mk(core); grp.add(m); grp.userData = {core:m, head:null, legs:[], wings:null, kind, phase:Math.random()*10}; return grp; }
  // body with a rounded chest and rump, a lighter belly and a back line
  B(core, -W/2,y0+1,-L/2+1, W/2,y0+H-1,L/2-1, bodyC);
  B(core, -W/2+1,y0,-L/2+2, W/2-1,y0+H,L/2-2, bodyC);
  B(core, -W/2+0.8,y0-0.05,-L/2+3, W/2-0.8,y0+1.2,L/2-3, A.belly);
  B(core, -W/2+1.2,y0+H-0.3,-L/2+2, W/2-1.2,y0+H+0.3,L/2-3, bodyL);
  if (A.wool){ for (let k=0;k<40;k++){ const x = (r()-0.5)*W, y = y0+1+r()*(H-1), z = (r()-0.5)*(L-3), s = 1.4+r()*1.2; const sx = Math.abs(x) > W/2-1.5 ? Math.sign(x)*(W/2-0.5) : x; B(core, sx-s/2,y-s/2,z-s/2, sx+s/2,y+s/2,z+s/2, [bodyC, shade(bodyC,0.92), shade(bodyC,1.05)][k%3]); } }
  if (A.spots && !variant){ for (let k=0;k<6;k++){ const side = k%2 ? 1 : -1, z = -L/2+3+r()*(L-8), y = y0+2+r()*(H-5), s = 3+r()*4; B(core, side>0?W/2-0.2:-W/2-0.1, y, z, side>0?W/2+0.1:-W/2+0.2, y+s*0.7, z+s, A.dark); } B(core, -2,y0+H-0.2,-3, 3,y0+H+0.35,2, A.dark); }
  if (A.stripes){ for (let k=0;k<5;k++){ const z = -L/2+2+k*2; B(core, -W/2-0.05,y0+H-2.5,z, W/2+0.05,y0+H+0.1,z+0.8, A.dark); } }
  if (A.ridge){ B(core, -0.8,y0+H,-L/2+3, 0.8,y0+H+1.4,L/2-4, A.dark); for (let k=0;k<6;k++) B(core, -0.5,y0+H+1,-L/2+4+k*2.5, 0.5,y0+H+2+r(),-L/2+5+k*2.5, A.dark); }
  if (A.udder && !variant) B(core, -2.2,y0-1.6,-L/2+5, 2.2,y0+0.2,-L/2+10, A.nose);
  // tail
  const tz = -L/2+0.5, ty = y0+H-2;
  if (A.tail==='tuft'){ B(core, -0.5,ty-8,tz-1, 0.5,ty,tz, bodyD); B(core, -0.9,ty-10,tz-1.4, 0.9,ty-7.5,tz+0.4, A.dark); }
  if (A.tail==='long'){ for (let k=0;k<5;k++) B(core, -1.1,ty-2-k*2.2,tz-1.5-Math.min(k,2)*0.8, 1.1,ty+0.4-k*2.2,tz, A.dark); }
  if (A.tail==='curl'){ B(core, -0.4,ty,tz-1.5, 0.4,ty+0.8,tz, bodyD); B(core, -0.4,ty+0.8,tz-2.2, 0.4,ty+1.8,tz-1.2, bodyD); }
  if (A.tail==='up'){ B(core, -0.6,ty,tz-1.2, 0.6,ty+1.2,tz, bodyD); B(core, -0.6,ty+1,tz-2.2, 0.6,ty+3.4,tz-1, bodyD); }
  if (A.tail==='bushy'){ B(core, -1.2,ty-4,tz-3, 1.2,ty+0.5,tz, bodyC); B(core, -1,ty-5.5,tz-3.6, 1,ty-3.5,tz-1.8, A.belly); }
  if (A.tail==='cat'){ for (let k=0;k<5;k++) B(core, -0.5,ty+k*1.2,tz-1-k*0.5, 0.5,ty+1.3+k*1.2,tz-k*0.5, k>3?A.dark:bodyC); }
  if (A.tail==='white'){ B(core, -1,ty-1,tz-1.2, 1,ty+1.4,tz, '#f4f0ea'); }
  if (A.tail==='puff'){ B(core, -1.2,ty-1,tz-1.8, 1.2,ty+1.4,tz, '#f4f0ea'); }
  if (A.tail==='thin'){ B(core, -0.3,ty-4,tz-0.6, 0.3,ty,tz, A.dark); }
  if (A.tail==='stub'){ B(core, -1,ty-2,tz-1.2, 1,ty+0.6,tz, bodyC); }
  if (A.tail==='feathers'){ for (let k=0;k<3;k++) B(core, -1+k*0.7,ty-0.5,tz-2-k*0.3, -0.4+k*0.7,ty+3+k*0.4,tz, k===1?A.dark:bodyD); }
  if (A.comb){ /* on head below */ }
  // head on a neck: the head group pivots where the neck meets the shoulders
  const hl = A.hl, hh = A.hh, hw = A.hw, nk = A.neck, ang = A.nk;
  const ny = nk*Math.sin(ang*1.2+0.3), nz = nk*Math.cos(ang*1.2+0.3);
  for (let k=0;k<Math.max(1,Math.round(nk/2));k++){ const t = k/Math.max(1,Math.round(nk/2)); B(head, -hw*0.42,t*ny-1,t*nz-1.5, hw*0.42,t*ny+hh*0.55,t*nz+1.5, bodyC); }
  const hy = ny - hh*0.35, hz = nz;
  B(head, -hw/2,hy,hz-hl*0.35, hw/2,hy+hh,hz+hl*0.55, A.darkface ? A.dark : bodyC);
  B(head, -hw/2+0.5,hy-0.2,hz+hl*0.55-0.5, hw/2-0.5,hy+hh*0.62,hz+hl*0.55+A.snout, A.darkface ? A.dark : (A.nose && A.disc ? bodyC : shade(bodyC,0.95)));
  B(head, -hw/2+0.7,hy-0.3,hz+hl*0.55+A.snout-0.4, hw/2-0.7,hy+hh*0.45,hz+hl*0.55+A.snout+0.25, A.nose);
  if (A.disc) B(head, -1.2,hy+0.6,hz+hl*0.55+A.snout+0.2, 1.2,hy+2,hz+hl*0.55+A.snout+0.5, shade(A.nose,0.7));
  [-1,1].forEach(s=>{ B(head, s*hw/2-(s>0?0.1:-0.1)-0.6*s, hy+hh*0.6, hz+hl*0.2, s*hw/2+(s>0?0.05:-0.05), hy+hh*0.6+1, hz+hl*0.2+1, '#f4f0ea'); B(head, s*hw/2+(s>0?0:-0.1), hy+hh*0.62, hz+hl*0.2+0.3, s*hw/2+(s>0?0.12:0.02), hy+hh*0.62+0.7, hz+hl*0.2+0.8, '#141014'); });
  const ey = hy+hh, ez = hz-hl*0.1;
  if (A.ears==='side') [-1,1].forEach(s=>B(head, s>0?hw/2:-hw/2-2.2, ey-1.6, ez-0.6, s>0?hw/2+2.2:-hw/2, ey-0.6, ez+0.8, bodyD));
  if (A.ears==='up') [-1,1].forEach(s=>B(head, s*hw*0.3-0.8, ey, ez-0.6, s*hw*0.3+0.8, ey+2.4, ez+0.4, bodyD));
  if (A.ears==='point') [-1,1].forEach(s=>{ B(head, s*hw*0.3-0.9, ey, ez-0.3, s*hw*0.3+0.9, ey+1.2, ez+0.5, bodyD); B(head, s*hw*0.3-0.4, ey+1.2, ez-0.2, s*hw*0.3+0.4, ey+2, ez+0.3, bodyD); });
  if (A.ears==='flop') [-1,1].forEach(s=>B(head, s>0?hw/2-0.2:-hw/2-1, ey-3.4, ez-0.4, s>0?hw/2+1:-hw/2+0.2, ey+0.2, ez+1.4, bodyD));
  if (A.ears==='long') [-1,1].forEach(s=>{ B(head, s*hw*0.25-0.6, ey, ez-0.8, s*hw*0.25+0.6, ey+5, ez+0.2, bodyC); B(head, s*hw*0.25-0.3, ey+0.5, ez+0.2, s*hw*0.25+0.3, ey+4.5, ez+0.3, '#e8b0b8'); });
  if (A.horns && (kind!=='cow' || true)) [-1,1].forEach(s=>{ B(head, s*hw*0.3-0.5, ey, ez-0.5, s*hw*0.3+0.5, ey+1.6, ez+0.5, A.horns); B(head, s*hw*0.3+(A.back?-0.5:s*0.4)-0.4, ey+1.4, ez-(A.back?1.8:0)-0.4, s*hw*0.3+(A.back?0.5:s*1.6)+0.4, ey+2.2, ez-(A.back?0.6:0)+0.4, A.horns); });
  if (A.antlers && !variant) [-1,1].forEach(s=>{ const bx = s*hw*0.3; B(head, bx-0.4, ey, ez-0.4, bx+0.4, ey+5, ez+0.4, '#c8b090'); B(head, bx+s*0.4-0.3, ey+2.5, ez-0.3, bx+s*2.6+0.3, ey+3.1, ez+0.3, '#c8b090'); B(head, bx-0.3, ey+4.6, ez-1.8, bx+0.3, ey+5.2, ez+0.3, '#c8b090'); B(head, bx+s*2.4-0.3, ey+3, ez-0.3, bx+s*2.4+0.3, ey+4.4, ez+0.3, '#c8b090'); });
  if (A.tusks) [-1,1].forEach(s=>B(head, s*hw*0.35-0.3, hy+0.5, hz+hl*0.55+A.snout-1, s*hw*0.35+0.3, hy+2.2, hz+hl*0.55+A.snout-0.4, '#f0e8d8'));
  if (A.beard) B(head, -0.8, hy-2.2, hz+hl*0.4, 0.8, hy+0.2, hz+hl*0.55+0.5, A.dark);
  if (A.mane){ B(core, -0.9,y0+H-1,L/2-6, 0.9,y0+H+1.2,L/2-1, A.dark); for (let k=0;k<Math.round(nk/2);k++){ const t = k/Math.round(nk/2); B(head, -0.9, t*ny+hh*0.5-0.5, t*nz-2.2, 0.9, t*ny+hh*0.5+1.4, t*nz-0.4, A.dark); } B(head, -1, ey-0.4, ez-1.4, 1, ey+1.2, ez+1.6, A.dark); }
  if (A.comb){ B(head, -0.35, ey, ez-0.6, 0.35, ey+1.4, ez+1.4, A.dark); B(head, -0.3, hy-1.6, hz+hl*0.4, 0.3, hy, hz+hl*0.55+0.4, A.dark); }
  // legs (two for birds): each hangs from its pivot, with a darker hoof, paw or foot
  const legPos = A.biped ? [[-W*0.22, 0],[W*0.22, 0]] : [[-W/2+A.lw*0.6, L/2-A.lw-1.5],[W/2-A.lw*0.6, L/2-A.lw-1.5],[-W/2+A.lw*0.6, -L/2+A.lw+1.5],[W/2-A.lw*0.6, -L/2+A.lw+1.5]];
  const legBx = []; const lw = A.lw, lh = A.leg;
  if (!A.flyer){ B(legBx, -lw/2,-lh*0.55,-lw/2, lw/2,0.8,lw/2, A.biped ? A.hoof : bodyC); B(legBx, -lw*0.42,-lh+1,-lw*0.42, lw*0.42,-lh*0.5,lw*0.42, A.biped ? A.hoof : bodyD); B(legBx, -lw/2-0.05,-lh,-lw/2-0.05, lw/2+0.05,-lh+1.2,lw/2+(A.biped?1.5:0.3), A.hoof); }
  const legGeo = legBx.length ? (()=>{ const g = voxGeo(legBx); g.scale(AVOX/VOX, AVOX/VOX, AVOX/VOX); return g; })() : null;
  const coreM = mk(core); grp.add(coreM);
  const headG = new THREE.Group(); headG.position.set(0, (y0+H-2)*AVOX, (L/2-2)*AVOX); const headM = mk(head); headG.add(headM); grp.add(headG);
  const legs = legGeo ? legPos.map(([x,z])=>{ const p = new THREE.Group(); p.position.set(x*AVOX, y0*AVOX+0.01, z*AVOX); const m = new THREE.Mesh(legGeo, mat); m.castShadow = true; p.add(m); grp.add(p); return p; }) : [];
  let wings = null; if (A.flyer){ const wb = [[0,-0.2,-1.6, 5,0.3,1.6, bodyD]]; const wg = voxGeo(wb); wg.scale(AVOX/VOX, AVOX/VOX, AVOX/VOX); wings = [-1,1].map(s=>{ const p = new THREE.Group(); p.position.set(s*W/2*AVOX, (y0+H*0.8)*AVOX, 0); const m = new THREE.Mesh(wg, mat); if (s<0) m.scale.x = -1; p.add(m); grp.add(p); return p; }); }
  grp.userData = {core:coreM, head:headG, legs, wings, kind, h:y0+H, leg:y0, phase:Math.random()*10};
  return grp;
}
function r3Animals(ts, dark){
  R3.an3 = R3.an3 || new Map();
  const seen = new Set(), tx = cam.x/TILE, tz = cam.y/TILE, m4 = new THREE.Matrix4();
  const night = (()=>{ const mod = modOf(S.minute); return mod<330 || mod>1230; })();
  ANIMALS.forEach(a=>{
    const X = a.x/16, Z = a.y/16; if (Math.abs(X-tx) > 70 || Math.abs(Z-tz) > 70) return;
    const key = a.key || (a.__k = a.__k || 'a'+Math.random().toString(36).slice(2)); seen.add(key);
    let g = R3.an3.get(key); if (!g || g.userData.kind!==a.kind){ if (g) lpDispose(g); g = an3Build(a.kind, a.variant); R3.scene.add(g); R3.an3.set(key, g); }
    const U = g.userData, moving = a.walk>0 && (a.wait<=0), run = a.flee>0, speed = run ? 3 : 1;
    const ph = ts/(run?90:170) + U.phase;
    g.position.set(X, 0, Z);
    const yaw = a.face<0 ? -Math.PI/2 : Math.PI/2; g.rotation.y += (yaw - g.rotation.y)*0.2;
    // walk and run swing the legs; grazing lowers the head; sleeping lies down; birds fly
    U.legs.forEach((l,i)=>{ l.rotation.x = moving ? Math.sin(ph + (i%2?Math.PI:0) + (i>1?Math.PI/2:0))*0.6*speed*0.6 : 0; });
    if (U.wings){ const flap = Math.sin(ts/60 + U.phase)*0.9; U.wings[0].rotation.z = flap; U.wings[1].rotation.z = -flap; g.position.y = 2.2 + Math.sin(ts/700 + U.phase)*0.4; }
    const graze = !moving && !night && !U.wings && ['cow','sheep','goat','horse','deer','rabbit'].includes(a.kind) && Math.sin(ts/1500+U.phase)>0;
    if (U.head) U.head.rotation.x += ((graze ? 0.75 : 0) - U.head.rotation.x)*0.1; U.core.position.y = moving ? Math.abs(Math.sin(ph))*0.02*speed : 0;
    if (night && !U.wings && a.kind!=='chicken'){ g.position.y = -(U.leg||0)*AVOX*0.9; U.legs.forEach(l=>l.visible = false); if (U.head) U.head.rotation.x = 0.35; } else U.legs.forEach(l=>l.visible = true);
    g.visible = true;
  });
  for (const [k,g] of R3.an3) if (!seen.has(k)){ lpDispose(g); R3.an3.delete(k); }
  // fish jump now and then in open water near the camera
  R3.fish = R3.fish || [];
  if (R3.fish.length < 3 && WATER_TILES.length && Math.random() < 0.01){ const near = WATER_TILES.filter(([x,y])=>Math.abs(x-tx)<25 && Math.abs(y-tz)<20 && tileAt(x+1,y)===T.WATER && tileAt(x-1,y)===T.WATER); if (near.length){ const [x,y] = near[Math.floor(Math.random()*near.length)]; const f = an3Build('fish', 0); f.position.set(x+0.5, -0.2, y+0.5); f.userData.t0 = ts; R3.scene.add(f); R3.fish.push(f); } }
  R3.fish = R3.fish.filter(f=>{ const k = (ts - f.userData.t0)/900; if (k>1){ lpDispose(f); return false; } f.position.y = -0.2 + Math.sin(k*Math.PI)*0.7; f.rotation.x = -Math.cos(k*Math.PI)*1.2; f.position.x += 0.01; return true; });
}

// ---------- props: every map object as a real 3D model ----------
function r3PropMesh(e){
  if (e.tag && e.tag.startsWith('light:') && typeof civLightMesh==='function') return civLightMesh(e.tag.slice(6));
  const g = lpG(), P = []; let key = null;
  const img = e.img;
  if (img===ART.well){ key = 'well'; P.push(lpPart(g.cyl, '#8a8478', [0,0.25,0], [0,0,0], [0.42,0.5,0.42]), lpPart(g.cyl, '#1a2a4a', [0,0.49,0], [0,0,0], [0.34,0.02,0.34]), lpPart(g.box, '#6e4a2c', [-0.38,0.8,0], [0,0,0], [0.06,0.9,0.06]), lpPart(g.box, '#6e4a2c', [0.38,0.8,0], [0,0,0], [0.06,0.9,0.06]), lpPart(g.cone, '#8a3a2a', [0,1.35,0], [0,Math.PI/4,0], [0.62,0.35,0.62]), lpPart(g.cyl, '#5a3a22', [0,1.05,0], [0,0,Math.PI/2], [0.04,0.8,0.04])); }
  else if (ART.stalls && ART.stalls.includes(img)){ const i = ART.stalls.indexOf(img); key = 'stall'+i; const cloth = ['#c83a3a','#3a7ac8','#e8b83a'][i];
    P.push(lpPart(g.box, '#8a6038', [0,0.45,0], [0,0,0], [1.3,0.08,0.7]), lpPart(g.box, '#6e4a2c', [0,0.22,0], [0,0,0], [1.2,0.4,0.6]));
    [[-0.6,-0.32],[0.6,-0.32],[-0.6,0.32],[0.6,0.32]].forEach(([x,z])=>P.push(lpPart(g.box, '#5a3a22', [x,0.75,z], [0,0,0], [0.05,1.5,0.05])));
    P.push(lpPart(g.box, cloth, [0,1.5,0], [0.12,0,0], [1.45,0.04,0.9])); [-0.4,0,0.4].forEach((x,k)=>P.push(lpPart(g.ico0, ['#e84a4a','#f2c14e','#6ab04a'][k], [x,0.56,0], [0,0,0], [0.12,0.08,0.12]))); }
  else if (img===ART.lamp){ key = 'lamp'; P.push(lpPart(g.cyl, '#2a2a30', [0,0.8,0], [0,0,0], [0.04,1.6,0.04]), lpPart(g.box, '#fff0b0', [0,1.62,0], [0,0,0], [0.14,0.18,0.14]), lpPart(g.cone, '#2a2a30', [0,1.78,0], [0,Math.PI/4,0], [0.14,0.12,0.14])); }
  else if (img===ART.scarecrow){ key = 'scare'; P.push(lpPart(g.cyl, '#6e4a2c', [0,0.7,0], [0,0,0], [0.04,1.4,0.04]), lpPart(g.cyl, '#6e4a2c', [0,1.1,0], [0,0,Math.PI/2], [0.03,0.9,0.03]), lpPart(g.box, '#8a3a2a', [0,1.0,0], [0,0,0], [0.35,0.4,0.15]), lpPart(g.sph, '#d8c090', [0,1.45,0], [0,0,0], [0.13,0.13,0.13]), lpPart(g.cyl, '#d8b860', [0,1.56,0], [0,0,0], [0.24,0.02,0.24])); }
  else if (img===ART.hay){ key = 'hay'; P.push(lpPart(g.cyl, '#d8b860', [0,0.28,0], [0,0,Math.PI/2], [0.28,0.5,0.28])); }
  else if (img===ART.barrel){ key = 'barrel'; P.push(lpPart(g.cyl, '#8a5a34', [0,0.3,0], [0,0,0], [0.22,0.6,0.22]), lpPart(g.cyl, '#3a3a40', [0,0.12,0], [0,0,0], [0.23,0.03,0.23]), lpPart(g.cyl, '#3a3a40', [0,0.48,0], [0,0,0], [0.23,0.03,0.23])); }
  else if (img===ART.crate){ key = 'crate'; P.push(lpPart(g.box, '#a87a48', [0,0.22,0], [0,0.2,0], [0.45,0.45,0.45]), lpPart(g.box, '#7a5230', [0,0.22,0], [0,0.2,0], [0.47,0.06,0.47])); }
  else if (img===ART.cart){ key = 'cart'; P.push(lpPart(g.box, '#8a6038', [0,0.55,0], [0,0,0], [1.2,0.12,0.7]), lpPart(g.box, '#6e4a2c', [0,0.72,0.34], [0,0,0], [1.2,0.25,0.04]), lpPart(g.box, '#6e4a2c', [0,0.72,-0.34], [0,0,0], [1.2,0.25,0.04]), lpPart(g.tor, '#4a3222', [0.3,0.3,0.4], [0,0,0], [0.28,0.28,0.28]), lpPart(g.tor, '#4a3222', [0.3,0.3,-0.4], [0,0,0], [0.28,0.28,0.28]), lpPart(g.cyl, '#6e4a2c', [-0.95,0.45,0.2], [0,0,Math.PI/2-0.2], [0.03,0.8,0.03]), lpPart(g.cyl, '#6e4a2c', [-0.95,0.45,-0.2], [0,0,Math.PI/2-0.2], [0.03,0.8,0.03])); }
  else if (img===ART.boat){ key = 'boat'; P.push(lpPart(g.box, '#8a5a34', [0,0.05,0], [0,0,0], [1.4,0.22,0.55]), lpPart(g.cone, '#8a5a34', [0.85,0.05,0], [0,0,-Math.PI/2], [0.27,0.35,0.27]), lpPart(g.box, '#6e4a2c', [0,0.17,0], [0,0,0], [0.12,0.04,0.5])); }
  else if (ART.graves && ART.graves.includes(img)){ key = 'grave'; P.push(lpPart(g.box, '#8a8478', [0,0.25,0], [0,0,0], [0.35,0.5,0.1]), lpPart(g.cyl, '#8a8478', [0,0.5,0], [Math.PI/2,0,0], [0.175,0.1,0.175]), lpPart(g.box, '#4a6a3a', [0,0.02,0.3], [0,0,0], [0.35,0.04,0.5])); }
  else if (img===ART.stake){ key = 'stake'; P.push(lpPart(g.box, '#8a6038', [0,0.25,0], [0,0,0], [0.05,0.5,0.05]), lpPart(g.box, '#e84a3a', [0,0.48,0], [0,0,0], [0.07,0.05,0.07])); }
  else if (img===ART.sign){ key = 'sign'; P.push(lpPart(g.box, '#6e4a2c', [0,0.4,0], [0,0,0], [0.06,0.8,0.06]), lpPart(g.box, '#e8d8a8', [0,0.75,0.04], [0,0,0], [0.5,0.3,0.04])); }
  else if (ART.scaffold && (ART.scaffold.includes(img) || (ART.scaffoldTall||[]).includes(img))){ key = 'scaf'+(img.height); const w = img.width/16*0.9, h = img.height/16*0.8;
    for (let i=0;i<=3;i++){ const x = -w/2 + i*w/3; P.push(lpPart(g.box, '#b08850', [x, h/2, -0.3], [0,0,0], [0.05,h,0.05]), lpPart(g.box, '#b08850', [x, h/2, 0.3], [0,0,0], [0.05,h,0.05])); }
    for (let j=1;j<=3;j++) P.push(lpPart(g.box, '#8a6038', [0, j*h/3, 0], [0,0,0], [w, 0.05, 0.7])); }
  else if (img===ART.rubble){ key = 'rubble'; for (let k=0;k<7;k++) P.push(lpPart(g.dod, ['#8a8478','#6a6660','#9a6a4a'][k%3], [(k%4-1.5)*0.35, 0.12, (Math.floor(k/4)-0.5)*0.4], [k,k*2,0], [0.2,0.15,0.2])); }
  else if (ART.civ && ART.civ.fire && ART.civ.fire.includes(img) || e.tag==='fire'){ key = 'fire';
    for (let k=0;k<8;k++){ const a = k/8*Math.PI*2; P.push(lpPart(g.dod, '#7c7880', [Math.cos(a)*0.38, 0.06, Math.sin(a)*0.38], [k,k,0], [0.1,0.08,0.1])); }
    P.push(lpPart(g.cyl, '#5a3a22', [0,0.08,0], [0,0.5,Math.PI/2], [0.05,0.6,0.05]), lpPart(g.cyl, '#5a3a22', [0,0.1,0], [0,-0.6,Math.PI/2], [0.05,0.6,0.05])); }
  else if (ART.civ && img===ART.civ.sacks){ key = 'sacks'; [[-0.3,0],[0.1,0.05],[0.4,-0.1],[-0.05,-0.3]].forEach(([x,z],k)=>P.push(lpPart(g.ico, ['#c8b080','#b8a070','#d0bc8c','#a89060'][k], [x,0.2,z], [0,k,0], [0.2,0.24,0.18]))); }
  else if (ART.civ && img===ART.civ.woodpile){ key = 'wood'; for (let r=0;r<3;r++) for (let k=0;k<4-r;k++) P.push(lpPart(g.cyl, '#8a6038', [(k-1.5+r*0.5)*0.2, 0.09+r*0.16, 0], [Math.PI/2,0,0], [0.08,0.6,0.08])); }
  else if (ART.civ && img===ART.civ.stonepile){ key = 'stone'; [[0,0],[0.25,0.05],[0.12,-0.2],[-0.2,-0.1]].forEach(([x,z],k)=>P.push(lpPart(g.dod, '#7c7880', [x,0.12+(k===2?0.1:0),z], [k,k,0], [0.16,0.12,0.16]))); }
  else if (ART.civ && img===ART.civ.derrick){ key = 'derrick'; const h = 2.6; [[-0.4,-0.4],[0.4,-0.4],[-0.4,0.4],[0.4,0.4]].forEach(([x,z])=>P.push(lpPart(g.box, '#3a3a44', [x*0.6, h/2, z*0.6], [z*0.15,0,-x*0.15], [0.05,h,0.05]))); for (let j=1;j<5;j++) P.push(lpPart(g.box, '#4a4a54', [0, j*h/5, 0], [0,0,0], [0.8-j*0.12,0.03,0.8-j*0.12])); P.push(lpPart(g.box, '#2a2a30', [0,0.15,0], [0,0,0], [0.9,0.3,0.9])); }
  else if (ART.civ && img===ART.civ.weeds){ key = 'weeds'; for (let k=0;k<5;k++) P.push(lpPart(g.cone, ['#4a7a2a','#6a9a3a','#5a8a30'][k%3], [(k-2)*0.12, 0.1, (k%2)*0.08], [0,0,(k-2)*0.2], [0.04,0.22,0.04])); }
  else if (ART.civ && img===ART.civ.goals){ key = 'goals'; P.push(lpPart(g.box, '#f0f0f0', [0,0.5,-0.5], [0,0,0], [0.05,1,0.05]), lpPart(g.box, '#f0f0f0', [0,0.5,0.5], [0,0,0], [0.05,1,0.05]), lpPart(g.box, '#f0f0f0', [0,1,0], [0,0,0], [0.05,0.05,1.05])); }
  if (!key) return null;
  let geo = LP.cache.get('prop:'+key); if (!geo){ geo = lpMerge(P); LP.cache.set('prop:'+key, geo); }
  const m = new THREE.Mesh(geo, lpMat()); m.userData.shared = true; m.castShadow = true; m.receiveShadow = true;
  if (key==='fire'){ const fl = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 6), new THREE.MeshBasicMaterial({color:0xffa030})); fl.position.y = 0.35; m.add(fl); const fl2 = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 6), new THREE.MeshBasicMaterial({color:0xffe070})); fl2.position.y = 0.3; m.add(fl2); m.userData.flame = [fl, fl2]; }
  return m;
}
// crops standing on field tiles, and posts along fences
function r3Crops(){
  const g = lpG(), grp = new THREE.Group(), season = ART.season, items = [], posts = [];
  const growthAt = (x,y) => { if (typeof CIV!=='undefined' && CIV){ const s = civStructAt(x,y); if (!s || !s.meta || !STRUCTURES[s.def].farm) return 0; return s.meta.stage==='growing' ? (s.meta.growth||0) : s.meta.stage==='ripe' ? 1 : 0; } return [0.35,0.8,1,0][season]; };
  for (let y=Y0;y<Y0+MH;y++) for (let x=X0;x<X0+MW;x++){ const t = MAP[y][x]; if (t===T.FIELD){ const gr = growthAt(x,y); if (gr>0.05) for (let k=0;k<4;k++) items.push([x+0.2+(k%2)*0.5+hashf(x,y,k)*0.1, y+0.25+Math.floor(k/2)*0.5, gr]); } else if (t===T.FENCE) posts.push([x,y]); }
  if (items.length){ const im = new THREE.InstancedMesh(new THREE.ConeGeometry(0.09, 0.5, 5), new THREE.MeshLambertMaterial({color:0xffffff, flatShading:true}), items.length); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), C = new THREE.Color();
    items.forEach(([x,z,gr],i)=>{ m4.compose(new THREE.Vector3(x, 0.25*gr, z), q, new THREE.Vector3(1, gr, 1)); im.setMatrixAt(i, m4); im.setColorAt(i, C.set(gr>=1 ? '#d8b850' : gr>0.6 ? '#8ab040' : '#5a9a3a')); }); im.castShadow = true; im.receiveShadow = true; grp.add(im); }
  if (posts.length){ const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.55, 0.08), new THREE.MeshLambertMaterial({color:0x8a6038}), posts.length*2); const m4 = new THREE.Matrix4(); posts.forEach(([x,y],i)=>{ m4.makeTranslation(x+0.5, 0.27, y+0.5); im.setMatrixAt(i*2, m4); m4.makeTranslation(x+0.5, 0.3, y+0.5); m4.multiply(new THREE.Matrix4().makeScale(tileAt(x-1,y)===T.FENCE||tileAt(x+1,y)===T.FENCE ? 12 : 1, 0.15, tileAt(x,y-1)===T.FENCE||tileAt(x,y+1)===T.FENCE ? 12 : 1)); im.setMatrixAt(i*2+1, m4); }); im.castShadow = true; grp.add(im); }
  return grp;
}
// ---------- buildings that show prosperity, neglect, upgrades and age ----------
function r3Decorate(b, grp){
  if (!b.civ || typeof S==='undefined' || !S.civ) return;
  const s = S.civ.structs[b.id]; if (!s) return;
  const g = lpG(), cond = s.cond, age = civDay() - s.built;
  if (cond < 55){ const f = 0.55 + cond/120; grp.traverse(o=>{ if (o.isMesh && o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{ if (m.color) m.color.multiplyScalar(f); }); } });
    const P = []; for (let k=0;k<Math.ceil((55-cond)/6);k++){ const x = b.x + hashf(b.x,k,1)*b.w, z = b.y + b.h + 0.1 + hashf(b.y,k,2)*0.3; P.push(lpPart(g.cone, ['#4a7a2a','#6a9a3a','#5a8a30'][k%3], [x,0.12,z], [0,0,(k%3-1)*0.3], [0.05,0.25,0.05])); }
    if (cond < 35) P.push(lpPart(g.box, '#6e4a2c', [b.x-0.3, 0.3, b.y+b.h*0.5], [0.1,0.4,0.9], [0.06,0.6,0.06]), lpPart(g.box, '#6e4a2c', [b.x-0.3, 0.2, b.y+b.h*0.5+0.4], [0,0,1.2], [0.05,0.8,0.05]));
    if (P.length){ const m = new THREE.Mesh(lpMerge(P), lpMat()); m.castShadow = true; grp.add(m); } }
  const D = STRUCTURES[s.def], base = D.labor*2 + 50;
  if (s.value > base*2.2 && cond > 70 && !D.tile){ // prosperity: an extension and flower boxes
    const P = [lpPart(g.box, b.roof ? lpShade(b.roof,1.1) : '#b8a080', [b.x+b.w+0.35, 0.5, b.y+b.h*0.6], [0,0,0], [0.7, 1.0, Math.min(1.6,b.h*0.6)])];
    for (let k=0;k<Math.min(3,b.w-1);k++) P.push(lpPart(g.box, ['#e84a4a','#f2c14e','#e87aa8'][k%3], [b.x+0.8+k*1.1, 0.95, b.y+b.h+0.08], [0,0,0], [0.45,0.1,0.12]));
    const m = new THREE.Mesh(lpMerge(P), lpMat()); m.castShadow = true; grp.add(m); }
  if (age > 250){ grp.traverse(o=>{ if (o.isMesh && o.material && o.material.map && o.material.side===THREE.DoubleSide && o.material.color){ o.material.color.lerp(new THREE.Color('#6a8a5a'), Math.min(0.35, (age-250)/1200)); } }); }
  const org = s.org && S.civ.orgs[s.org]; if (org && org.profitAvg > 5 && !D.tile){ const m = new THREE.Mesh(lpMerge([lpPart(g.box, '#2a3a5a', [b.x+b.w/2, 1.1, b.y+b.h+0.05], [0,0,0], [Math.min(2.4,b.w*0.7), 0.3, 0.05]), lpPart(g.box, '#f2c14e', [b.x+b.w/2, 1.1, b.y+b.h+0.08], [0,0,0], [Math.min(2.2,b.w*0.6), 0.04, 0.02])]), lpMat()); grp.add(m); }
}
// ---------- interiors: built only for buildings near the camera when zoomed in ----------
const INTERIOR = {home:['bed','bed','table','shelf','hearth'], shop:['counter','shelf','shelf','crates'], school:['desk','desk','desk','desk','board'], medical:['cot','cot','table','shelf'], lab:['bench','bench','shelf','flask'], jail:['cell','cell','table'], industry:['bench','machine','crates'], hall:['table','bench','bench'], hospitality:['table','table','counter','hearth']};
function r3InteriorKind(b){ const D = typeof STRUCTURES!=='undefined' && STRUCTURES[b.type]; const cat = D ? D.cat : null; if (b.house || cat==='home') return 'home'; if (cat==='education') return 'school'; if (cat==='medical') return 'medical'; if (cat==='science') return 'lab'; if (b.type==='jail'||b.type==='prison'||b.sign==='bars') return 'jail'; if (cat==='industry') return 'industry'; if (b.style==='hall'||cat==='civic') return 'hall'; if (cat==='hospitality'||b.style==='tavern') return 'hospitality'; return 'shop'; }
function r3Interior(b){
  const g = lpG(), P = [], kind = r3InteriorKind(b), items = INTERIOR[kind];
  P.push(lpPart(g.box, '#8a6a48', [b.x+b.w/2, 0.02, b.y+b.h/2], [0,0,0], [b.w-0.2, 0.04, b.h-0.2]));
  items.forEach((it,i)=>{ const x = b.x + 0.6 + (i%Math.max(1,b.w-1))*((b.w-1.2)/Math.max(1,b.w-1.5)), z = b.y + 0.7 + Math.floor(i/Math.max(1,b.w-1))*0.9;
    switch (it){
      case 'bed': P.push(lpPart(g.box, '#6e4a2c', [x,0.15,z], [0,0,0], [0.5,0.2,0.9]), lpPart(g.box, '#d8d0c0', [x,0.27,z+0.1], [0,0,0], [0.46,0.06,0.7]), lpPart(g.box, '#a83a3a', [x,0.3,z-0.3], [0,0,0], [0.44,0.06,0.2])); break;
      case 'cot': P.push(lpPart(g.box, '#e8e8f0', [x,0.3,z], [0,0,0], [0.45,0.08,0.85]), lpPart(g.box, '#8a8a94', [x,0.15,z], [0,0,0], [0.45,0.25,0.05])); break;
      case 'table': P.push(lpPart(g.box, '#8a6038', [x,0.4,z], [0,0,0], [0.7,0.05,0.5]), lpPart(g.box, '#6e4a2c', [x,0.2,z], [0,0,0], [0.08,0.4,0.08])); break;
      case 'desk': P.push(lpPart(g.box, '#8a6038', [x,0.35,z], [0,0,0], [0.5,0.04,0.35]), lpPart(g.box, '#6e4a2c', [x,0.2,z+0.3], [0,0,0], [0.3,0.05,0.25])); break;
      case 'bench': P.push(lpPart(g.box, '#7a5a3a', [x,0.4,z], [0,0,0], [0.8,0.06,0.35]), lpPart(g.box, '#5a3a22', [x,0.2,z], [0,0,0], [0.7,0.35,0.3])); break;
      case 'shelf': P.push(lpPart(g.box, '#6e4a2c', [x,0.5,z], [0,0,0], [0.6,1,0.2]), lpPart(g.box, '#c8a060', [x,0.7,z+0.05], [0,0,0], [0.5,0.1,0.12])); break;
      case 'counter': P.push(lpPart(g.box, '#8a6038', [x,0.4,z], [0,0,0], [1.0,0.8,0.35])); break;
      case 'crates': P.push(lpPart(g.box, '#a87a48', [x,0.2,z], [0,0.3,0], [0.4,0.4,0.4]), lpPart(g.box, '#a87a48', [x+0.2,0.55,z], [0,-0.2,0], [0.3,0.3,0.3])); break;
      case 'hearth': P.push(lpPart(g.box, '#7c7880', [x,0.3,z], [0,0,0], [0.6,0.6,0.3]), lpPart(g.box, '#f08030', [x,0.2,z+0.12], [0,0,0], [0.3,0.2,0.05])); break;
      case 'board': P.push(lpPart(g.box, '#2a3a2a', [x,0.8,z], [0,0,0], [0.9,0.5,0.04])); break;
      case 'flask': P.push(lpPart(g.sph, '#a8e0d8', [x,0.5,z], [0,0,0], [0.08,0.1,0.08])); break;
      case 'cell': P.push(lpPart(g.box, '#5a5a64', [x,0.5,z], [0,0,0], [0.8,1.0,0.05])); for (let k=0;k<5;k++) P.push(lpPart(g.box, '#3a3a44', [x-0.35+k*0.18,0.5,z+0.4], [0,0,0], [0.03,1.0,0.03])); break;
      case 'machine': P.push(lpPart(g.box, '#4a4a54', [x,0.4,z], [0,0,0], [0.6,0.8,0.6]), lpPart(g.cyl, '#8a8a94', [x+0.35,0.6,z], [0,0,Math.PI/2], [0.15,0.1,0.15])); break;
    } });
  const m = new THREE.Mesh(lpMerge(P), lpMat()); m.receiveShadow = true; return m;
}
function r3Interiors(tx, tz){
  const near = R3.dist < 12;
  (R3.bldGroups||[]).forEach(grp=>{ const b = grp.userData.b; if (!b || b.style==='mine') return; const d = Math.hypot(b.x+b.w/2-tx, b.y+b.h/2-tz);
    const want = near && d < 4.5;
    if (want && !grp.userData.interior){ grp.userData.interior = r3Interior(b); grp.add(grp.userData.interior); }
    if (grp.userData.interior) grp.userData.interior.visible = want;
    grp.children.forEach(o=>{ if (o.userData.roofPart) o.visible = !want; });
    const box = grp.userData.box; if (box){ const mats = box.material; if (Array.isArray(mats)){ mats[2].visible = !want; [0,1,4,5].forEach(i=>{ mats[i].side = want ? THREE.DoubleSide : THREE.FrontSide; }); } }
  });
}
