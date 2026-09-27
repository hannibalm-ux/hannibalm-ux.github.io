/* =====================================================================
   Pixel Town — 3D models
   Stylised low-poly people (jointed limbs, faces, body variation, aging, genetics, tools in hand),
   animated low-poly animals, 3D props, crops, fences and carts, buildings that show their upkeep,
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

// ---------- people ----------
// proportions are in metres-ish world units; the whole figure is scaled by genes and age
function lpLook(c){
  const L = c.look || {}, G = (c.civ && c.civ.genes) || {height:(hash(c.id+'h')%100)/100, build:(hash(c.id+'b')%100)/100, jaw:(hash(c.id+'j')%100)/100, nose:(hash(c.id+'n')%100)/100, brow:0.5, eye:'#3a2a1a'};
  const female = genderOf(c)==='F', kid = !isAdult(c), age = c.age||30;
  return {L, G, female, kid, age, skin:L.skin||'#e0b090', hair:L.hair||'#5a3a20', shirt:L.shirt||'#6a8a3a', pants:L.pants||'#3a3440', boots:L.boots||'#6a4028', eye:L.eye||G.eye||'#3a2a1a'};
}
function lpKey(c){ const L = c.look||{}, G = (c.civ&&c.civ.genes)||{}; return [L.skin,L.hair,L.style,L.beard,L.shirt,L.pants,L.hat,L.apron,L.coat,L.boots,G.height,G.build,G.jaw,G.nose, genderOf(c), isAdult(c), Math.floor((c.age||0)/4)].join('|'); }
function lpBuild(c){
  const g = lpG(), K = lpLook(c), {L, G, female, kid} = K, age = K.age;
  const wide = (female ? 0.9 : 1) * (0.86 + G.build*0.36), hipW = female ? 1.12 : 1;
  const body = [], armUL = [], armLL = [], armUR = [], armLR = [], legU = [], legL = [];
  const skin = K.skin, cloth = L.coat || K.shirt, trouser = K.pants;
  // torso: tapered, flattened front to back; the belt and hem
  body.push(lpPart(g.cylT, K.shirt, [0,1.09,0], [0,0,0], [0.19*wide, 0.46, 0.13*wide]));
  body.push(lpPart(g.cylT, lpShade(K.shirt,0.85), [0,1.34,0], [Math.PI,0,0], [0.2*wide, 0.08, 0.135*wide]));   // shoulders
  body.push(lpPart(g.cyl, trouser, [0,0.84,0], [0,0,0], [0.155*wide*hipW, 0.12, 0.11*wide]));                   // pelvis
  body.push(lpPart(g.cyl, '#4a3222', [0,0.9,0], [0,0,0], [0.162*wide*hipW, 0.035, 0.117*wide]));                // belt
  if (L.coat) body.push(lpPart(g.cylT, L.coat, [0,0.95,0], [0,0,0], [0.2*wide, 0.62, 0.14*wide]));
  if (L.apron) body.push(lpPart(g.box, L.apron, [0,0.92,0.105*wide], [0,0,0], [0.24*wide, 0.42, 0.02]));
  if (female && !kid) body.push(lpPart(g.ico, K.shirt, [0,1.19,0.07*wide], [0,0,0], [0.16*wide, 0.07, 0.07]));
  // neck and head: a rounded skull, a jaw shaped by genes, nose, eyes, brows and ears
  body.push(lpPart(g.cyl, lpShade(skin,0.92), [0,1.41,0], [0,0,0], [0.05, 0.1, 0.05]));
  const hy = 1.56, jaw = 0.85 + G.jaw*0.3, nose = 0.7 + G.nose*0.7;
  body.push(lpPart(g.ico, skin, [0,hy,0], [0,0,0], [0.112, 0.13, 0.118]));
  body.push(lpPart(g.box, skin, [0,hy-0.075,0.02], [0,0,0], [0.15*jaw, 0.07, 0.15]));
  body.push(lpPart(g.cone, lpShade(skin,0.93), [0,hy-0.01,0.118], [Math.PI/2,0,0], [0.018*nose, 0.05*nose, 0.02*nose]));
  [-1,1].forEach(s=>{ body.push(lpPart(g.sph, '#f4f0ea', [0.042*s, hy+0.02, 0.1], [0,0,0], [0.02,0.017,0.012])); body.push(lpPart(g.sph, K.eye, [0.042*s, hy+0.02, 0.109], [0,0,0], [0.011,0.011,0.006]));
    body.push(lpPart(g.box, lpShade(K.hair,0.8), [0.045*s, hy+0.055+(G.brow||0.5)*0.01, 0.105], [0,0,-0.15*s], [0.045, 0.011, 0.012]));
    body.push(lpPart(g.sph, lpShade(skin,0.9), [0.113*s, hy, 0], [0,0,0], [0.02,0.035,0.025])); });
  body.push(lpPart(g.box, female ? '#b8504a' : lpShade(skin,0.72), [0, hy-0.06, 0.112], [0,0,0], [0.045, 0.008, 0.01]));
  if (age>45) body.push(lpPart(g.box, lpShade(skin,0.8), [0, hy+0.075, 0.108], [0,0,0], [0.08, 0.004, 0.006]));             // wrinkles
  if (age>60) [-1,1].forEach(s=>body.push(lpPart(g.box, lpShade(skin,0.8), [0.075*s, hy+0.01, 0.1], [0,0,0.6*s], [0.02, 0.004, 0.006])));
  if (L.beard && !female && !kid){ body.push(lpPart(g.ico, K.hair, [0, hy-0.1, 0.055], [0,0,0], [0.1*jaw, 0.07, 0.08])); body.push(lpPart(g.box, K.hair, [0, hy-0.04, 0.115], [0,0,0], [0.07, 0.015, 0.012])); }
  // hair and hats
  const style = L.style || 'short', top = hy+0.09;
  if (style!=='bald' && !(L.hat && ['helmet','beanie','bandana'].includes(L.hat))){
    body.push(lpPart(g.half, K.hair, [0, hy+0.02, -0.01], [0,0,0], [0.123, 0.135, 0.128]));
    if (style==='long'){ body.push(lpPart(g.box, K.hair, [0, hy-0.1, -0.08], [0.15,0,0], [0.22, 0.3, 0.06])); }
    if (style==='bun') body.push(lpPart(g.sph, K.hair, [0, top+0.02, -0.1], [0,0,0], [0.06,0.06,0.06]));
    if (style==='pony') body.push(lpPart(g.cyl, K.hair, [0, hy-0.06, -0.14], [0.4,0,0], [0.035, 0.2, 0.035]));
    if (style==='curly') for (let k=0;k<9;k++){ const a = k/9*Math.PI*2; body.push(lpPart(g.ico0, K.hair, [Math.cos(a)*0.1, top-0.02+(k%2)*0.02, Math.sin(a)*0.09-0.01], [0,0,0], [0.045,0.045,0.045])); }
    if (style==='spiky') for (let k=0;k<6;k++) body.push(lpPart(g.cone, K.hair, [-0.07+k*0.028, top+0.03, -0.02+(k%2)*0.03], [0,0,(k-2.5)*0.15], [0.025, 0.07, 0.025]));
  } else if (style==='bald' && !L.hat) body.push(lpPart(g.half, K.hair, [0, hy-0.01, -0.03], [0.5,0,0], [0.12, 0.08, 0.1]));
  const hc = L.hatCol || {straw:'#d8b860', cowboy:'#8a5a30', cap:'#5a4a3a', bucket:'#6a7040', toque:'#f4f2ee', beanie:'#b83a2a', helmet:'#5a5a64', bandana:'#8a2a2a', tricorn:'#2a2230'}[L.hat] || '#5a4a3a';
  if (L.hat==='straw' || L.hat==='cowboy'){ body.push(lpPart(g.cyl, hc, [0, top+0.01, 0], [0,0,0], [0.22, 0.012, 0.22])); body.push(lpPart(g.cylT, hc, [0, top+0.06, 0], [0,0,0], [0.1, 0.09, 0.1])); }
  else if (L.hat==='helmet'){ body.push(lpPart(g.half, hc, [0, hy+0.04, 0], [0,0,0], [0.14, 0.13, 0.14])); body.push(lpPart(g.cyl, hc, [0, hy+0.04, 0.02], [0,0,0], [0.16, 0.01, 0.16])); }
  else if (L.hat==='beanie' || L.hat==='bandana'){ body.push(lpPart(g.half, hc, [0, hy+0.03, 0], [0,0,0], [0.128, 0.14, 0.13])); }
  else if (L.hat==='cap' || L.hat==='bucket'){ body.push(lpPart(g.half, hc, [0, hy+0.04, 0], [0,0,0], [0.126, 0.12, 0.128])); body.push(lpPart(g.box, lpShade(hc,0.8), [0, top-0.03, 0.12], [0,0,0], [0.14, 0.01, 0.08])); }
  else if (L.hat==='toque'){ body.push(lpPart(g.cyl, hc, [0, top+0.08, 0], [0,0,0], [0.11, 0.16, 0.11])); }
  else if (L.hat==='tricorn'){ body.push(lpPart(g.cone, hc, [0, top+0.04, 0], [0,0,0], [0.2, 0.08, 0.2])); }
  // arms: upper arm from the shoulder, forearm from the elbow, a hand
  const ua = cloth, fa = L.coat ? L.coat : skin;
  [armUL, armUR].forEach(a=>a.push(lpPart(g.cap, ua, [0,-0.13,0], [0,0,0], [0.043*Math.sqrt(wide), 0.17, 0.043*Math.sqrt(wide)])));
  [armLL, armLR].forEach(a=>{ a.push(lpPart(g.cap, fa, [0,-0.11,0], [0,0,0], [0.036*Math.sqrt(wide), 0.15, 0.036*Math.sqrt(wide)])); a.push(lpPart(g.ico, lpShade(skin,0.95), [0,-0.25,0.01], [0,0,0], [0.04,0.05,0.035])); });
  // legs: thigh from the hip, shin from the knee, a shaped foot
  legU.push(lpPart(g.cap, trouser, [0,-0.18,0], [0,0,0], [0.062*Math.sqrt(wide), 0.22, 0.062*Math.sqrt(wide)]));
  if (L.coat) legU.push(lpPart(g.cyl, L.coat, [0,-0.05,0], [0,0,0], [0.07, 0.12, 0.07]));
  legL.push(lpPart(g.cap, trouser, [0,-0.18,0], [0,0,0], [0.05, 0.2, 0.05]));
  legL.push(lpPart(g.cyl, K.boots, [0,-0.33,0], [0,0,0], [0.056, 0.1, 0.056]));
  legL.push(lpPart(g.ico, K.boots, [0,-0.4,0.05], [0,0,0], [0.06, 0.04, 0.12]));
  const mat = lpMat(), grp = new THREE.Group(), fig = new THREE.Group(); grp.add(fig);
  const mesh = (parts) => { const m = new THREE.Mesh(lpMerge(parts), mat); m.castShadow = true; m.receiveShadow = true; return m; };
  const torso = mesh(body); fig.add(torso);
  const limb = (up, low, x, y, lowY) => { const pivot = new THREE.Group(); pivot.position.set(x, y, 0); pivot.add(mesh(up)); const joint = new THREE.Group(); joint.position.set(0, lowY, 0); joint.add(mesh(low)); pivot.add(joint); fig.add(pivot); return {pivot, joint}; };
  const sx = 0.215*wide, hx = 0.085*wide*hipW;
  const aL = limb(armUL, armLL, -sx, 1.33, -0.27), aR = limb(armUR, armLR, sx, 1.33, -0.27);
  const lL = limb(legU, legL, -hx, 0.82, -0.4), lR = limb(legU, legL, hx, 0.82, -0.4);
  // tool socket in the right hand
  const hand = new THREE.Group(); hand.position.set(0, -0.26, 0.02); aR.joint.add(hand);
  // size: genes set the adult height; children grow gradually; the old shrink a little and stoop
  const adultH = 0.92 + G.height*0.18 + (female ? -0.04 : 0.02);
  const growth = kid ? clamp(0.42 + (age/17)*0.58, 0.42, 1) : 1, shrink = age>65 ? 1 - (age-65)*0.003 : 1;
  const s = adultH*growth*shrink*1.0; grp.scale.set(s*(kid ? 1 : 0.94+G.build*0.12), s, s);
  if (kid) torso.scale.set(1, 1, 1);
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

// ---------- animals ----------
const AN3 = {
  cow:    {body:'#f0f0f4', spot:'#1e1e26', len:0.62, h:0.46, w:0.3, leg:0.3, head:0.14, horns:true, tail:true},
  sheep:  {body:'#ece8dc', spot:'#2a2428', len:0.42, h:0.3, w:0.26, leg:0.18, head:0.1, woolly:true},
  pig:    {body:'#e8a4b0', spot:'#c87888', len:0.44, h:0.28, w:0.24, leg:0.12, head:0.11, snout:true, tail:true},
  chicken:{body:'#f4f0e6', spot:'#d83a2a', len:0.16, h:0.14, w:0.12, leg:0.08, head:0.06, bird:true},
  goat:   {body:'#d8ccb4', spot:'#8a7a60', len:0.38, h:0.3, w:0.18, leg:0.22, head:0.09, horns:true, beard:true, tail:true},
  horse:  {body:'#8a5a34', spot:'#3a2214', len:0.7, h:0.52, w:0.26, leg:0.45, head:0.15, mane:true, long:true, tail:true},
  dog:    {body:'#a8763e', spot:'#5a3a1e', len:0.34, h:0.22, w:0.14, leg:0.17, head:0.09, ears:true, tail:true},
  cat:    {body:'#7a7a82', spot:'#3a3a42', len:0.26, h:0.14, w:0.1, leg:0.11, head:0.07, ears:true, tail:true},
  deer:   {body:'#9a6a3a', spot:'#f0e8d8', len:0.5, h:0.36, w:0.2, leg:0.4, head:0.1, antlers:true, long:true},
  boar:   {body:'#4a3a30', spot:'#2a1e18', len:0.48, h:0.34, w:0.26, leg:0.16, head:0.13, tusks:true, snout:true},
  rabbit: {body:'#a8987e', spot:'#f0e8d8', len:0.18, h:0.14, w:0.12, leg:0.05, head:0.07, longears:true},
  wolf:   {body:'#7a7a80', spot:'#3a3a40', len:0.46, h:0.28, w:0.16, leg:0.26, head:0.1, ears:true, tail:true},
  bird:   {body:'#5a4a3a', spot:'#e0a030', len:0.12, h:0.08, w:0.08, leg:0.03, head:0.05, flyer:true},
  fish:   {body:'#8aa0b8', spot:'#c8d8e8', len:0.28, h:0.08, w:0.06, leg:0, head:0, fish:true}
};
function an3Build(kind, variant){
  const A = AN3[kind] || AN3.dog, g = lpG(), body = [], legs = [], body2 = variant ? lpShade(A.body, 0.78) : A.body;
  const H = A.leg + A.h/2;
  if (A.fish){ body.push(lpPart(g.ico, body2, [0,0,0], [0,0,0], [A.w, A.h, A.len/2])); body.push(lpPart(g.cone, A.spot, [0,0,-A.len*0.55], [-Math.PI/2,0,0], [A.h*0.9, A.len*0.25, 0.02])); }
  else {
    body.push(lpPart(A.woolly ? g.ico0 : g.ico, body2, [0,H,0], [0,0,0], [A.w, A.h/2, A.len/2]));
    if (kind==='cow' && !variant) body.push(lpPart(g.ico0, A.spot, [A.w*0.6, H+0.04, 0.05], [0,0,0], [A.w*0.45, A.h*0.3, A.len*0.2]));
    const hz = A.len/2 + A.head*0.6, hy = H + A.h*(A.long ? 0.55 : 0.2);
    if (A.long) body.push(lpPart(g.cyl, body2, [0, H+A.h*0.35, A.len/2], [0.7,0,0], [A.w*0.35, A.h*0.7, A.w*0.35]));
    body.push(lpPart(g.ico, body2, [0, hy, hz], [0,0,0], [A.head*0.8, A.head*0.85, A.head*1.1]));
    body.push(lpPart(g.sph, '#101010', [A.head*0.45, hy+A.head*0.3, hz+A.head*0.6], [0,0,0], [0.012,0.012,0.012])); body.push(lpPart(g.sph, '#101010', [-A.head*0.45, hy+A.head*0.3, hz+A.head*0.6], [0,0,0], [0.012,0.012,0.012]));
    if (A.snout) body.push(lpPart(g.cyl, lpShade(body2,0.85), [0, hy-A.head*0.2, hz+A.head*1.0], [Math.PI/2,0,0], [A.head*0.4, A.head*0.3, A.head*0.35]));
    if (A.horns) [-1,1].forEach(s=>body.push(lpPart(g.cone, '#e8e0c8', [s*A.head*0.5, hy+A.head*0.8, hz-A.head*0.2], [0,0,s*0.5], [0.02, A.head*0.7, 0.02])));
    if (A.antlers) [-1,1].forEach(s=>{ body.push(lpPart(g.cyl, '#c8b090', [s*A.head*0.5, hy+A.head*1.3, hz-A.head*0.2], [0,0,s*0.4], [0.012, A.head*1.6, 0.012])); body.push(lpPart(g.cyl, '#c8b090', [s*A.head*0.95, hy+A.head*1.7, hz], [0.5,0,s*1.1], [0.01, A.head*0.9, 0.01])); });
    if (A.ears) [-1,1].forEach(s=>body.push(lpPart(g.cone, lpShade(body2,0.8), [s*A.head*0.5, hy+A.head*0.85, hz-A.head*0.2], [0,0,s*0.2], [A.head*0.25, A.head*0.5, A.head*0.12])));
    if (A.longears) [-1,1].forEach(s=>body.push(lpPart(g.cap, body2, [s*A.head*0.35, hy+A.head*1.4, hz-A.head*0.3], [-0.2,0,s*0.15], [A.head*0.18, A.head*0.9, A.head*0.1])));
    if (A.tusks) [-1,1].forEach(s=>body.push(lpPart(g.cone, '#f0e8d8', [s*A.head*0.3, hy-A.head*0.3, hz+A.head*1.1], [-0.6,0,0], [0.012, 0.05, 0.012])));
    if (A.beard) body.push(lpPart(g.cone, A.spot, [0, hy-A.head*0.9, hz+A.head*0.3], [Math.PI,0,0], [A.head*0.2, A.head*0.6, A.head*0.2]));
    if (A.mane) body.push(lpPart(g.box, A.spot, [0, H+A.h*0.75, A.len*0.45], [0.7,0,0], [0.04, A.h*0.7, A.len*0.25]));
    if (A.tail) body.push(lpPart(g.cyl, A.spot, [0, H+A.h*0.1, -A.len/2-0.05], [-0.6,0,0], [0.02, A.h*0.6, 0.02]));
    if (A.bird){ body.push(lpPart(g.cone, '#f0a020', [0, hy-0.01, hz+A.head*1.1], [Math.PI/2,0,0], [0.02,0.05,0.02])); body.push(lpPart(g.box, A.spot, [0, hy+A.head*0.9, hz], [0,0,0], [0.015,0.04,0.05])); }
    if (!A.flyer) [[-1,1],[1,1],[-1,-1],[1,-1]].forEach(([sx,sz])=>legs.push([sx*A.w*0.55, A.leg, sz*A.len*0.32]));
  }
  const mat = lpMat(), grp = new THREE.Group(), core = new THREE.Mesh(lpMerge(body), mat); core.castShadow = true; grp.add(core);
  const legGeo = lpMerge([lpPart(g.cyl, lpShade(A.bird ? '#e0a030' : body2, A.bird ? 1 : 0.7), [0,-A.leg/2,0], [0,0,0], [A.bird?0.008:Math.max(0.018, A.w*0.14), A.leg, A.bird?0.008:Math.max(0.018, A.w*0.14)])]);
  const legM = legs.map(([x,y,z])=>{ const p = new THREE.Group(); p.position.set(x, y, z); const m = new THREE.Mesh(legGeo, mat); m.castShadow = true; p.add(m); grp.add(p); return p; });
  let wings = null; if (A.flyer){ const wg = lpMerge([lpPart(g.box, lpShade(body2,0.8), [0.1,0,0], [0,0,0], [0.2,0.01,0.08])]); wings = [-1,1].map(s=>{ const p = new THREE.Group(); p.position.set(0, A.h/2+0.02, 0); const m = new THREE.Mesh(wg, mat); if (s<0) m.scale.x = -1; p.add(m); grp.add(p); return p; }); }
  grp.userData = {core, legs:legM, wings, kind, h:H, phase:Math.random()*10};
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
    U.core.rotation.x = graze ? 0.25 : 0; U.core.position.y = moving ? Math.abs(Math.sin(ph))*0.02*speed : 0;
    if (night && !U.wings && a.kind!=='chicken'){ g.scale.y = 0.72; U.legs.forEach(l=>l.visible = false); } else { g.scale.y = 1; U.legs.forEach(l=>l.visible = true); }
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
