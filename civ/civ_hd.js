/* =====================================================================
   Pixel Town — HD 3D remaster
   A graphics layer over the existing 3D view. The world, the simulation and the camera are unchanged;
   this only draws them better:
   - lighting: filmic tone mapping, a sky dome (sun, moon, stars) that also lights the scene, ambient occlusion,
     controlled bloom and colour grading (in the post pass in pixel_town.html);
   - terrain: one shader blends grass, worn paths, sand, rock, tilled fields, cobbles, forest floor and riverbed
     without tile edges, with bump detail, wet banks, snow, rain-darkened ground and puddles, and caustics;
   - water: transparent, coloured by depth, with waves, river flow, reflections, sun glints, shore foam and ripples;
   - vegetation, buildings, props, particles and softer people and animals (later in this file).
   Everything scales with a quality tier (low, medium, high), chosen automatically per device and changeable.
   ===================================================================== */
const HD = {on:true, q:2, t:0, wet:0, snow:0, wind:0.6, chunks:new Map(), tex:{}, mats:{}, ripples:[], smokers:[], sparks:[], parts:null};
const HD_QNAMES = ['Low','Medium','High'];
function hdPref(){ try { return localStorage.getItem('pixeltown.hd') || 'auto'; } catch(e){ return 'auto'; } }
function hdAutoTier(){
  const touch = (navigator.maxTouchPoints||0) > 1, small = Math.min(screen.width, screen.height) < 700, ipad = /iPad|Macintosh/.test(navigator.userAgent) && touch;
  const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 4;
  if (small || mem <= 2) return 0; if (ipad || touch || mem <= 4 || cores <= 4) return 1; return 2;
}
function hdTier(){ const p = hdPref(); return p==='low' ? 0 : p==='medium' ? 1 : p==='high' ? 2 : hdAutoTier(); }

// ---------- small noise helpers (tileable, for textures made in JavaScript) ----------
function hdHash(x, y, s){ let h = Math.imul(x|0, 374761393) ^ Math.imul(y|0, 668265263) ^ Math.imul(s|0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function hdNoise(x, y, per, s){ const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf*xf*(3-2*xf), v = yf*yf*(3-2*yf);
  const w = (a,b)=>hdHash(((a%per)+per)%per, ((b%per)+per)%per, s);
  return (w(xi,yi)*(1-u) + w(xi+1,yi)*u)*(1-v) + (w(xi,yi+1)*(1-u) + w(xi+1,yi+1)*u)*v; }
function hdFbm(x, y, per, s, oct){ let a = 0.5, t = 0, f = 1; for (let i=0;i<(oct||4);i++){ t += a*hdNoise(x*f, y*f, per*f, s+i*17); f *= 2; a *= 0.5; } return t/(1-Math.pow(0.5, oct||4)); }

// ---------- procedural PBR textures: colour, normal (from height) and roughness, all seamless ----------
// gen(u, v, out) fills out.r,g,b (0..1 sRGB), out.h (height 0..1) and out.o (roughness 0..1) for u,v in 0..1
function hdMakeTex(key, gen, opt){
  if (HD.tex[key]) return HD.tex[key];
  opt = opt || {}; const N = opt.size || [128, 256, 512][HD.q], col = new Uint8ClampedArray(N*N*4), hgt = new Float32Array(N*N), rou = new Uint8ClampedArray(N*N*4), o = {};
  for (let y=0;y<N;y++) for (let x=0;x<N;x++){ o.r = o.g = o.b = 0.5; o.h = 0.5; o.o = 0.8; o.a = 1; gen(x/N, y/N, o); const i = y*N+x;
    col[i*4] = o.r*255; col[i*4+1] = o.g*255; col[i*4+2] = o.b*255; col[i*4+3] = o.a*255; hgt[i] = o.h; rou[i*4] = rou[i*4+1] = rou[i*4+2] = o.o*255; rou[i*4+3] = 255; }
  const nor = new Uint8ClampedArray(N*N*4), k = (opt.bump || 2.5) * N/256;
  for (let y=0;y<N;y++) for (let x=0;x<N;x++){ const H = (a,b)=>hgt[((b+N)%N)*N + ((a+N)%N)];
    const dx = (H(x+1,y-1) + 2*H(x+1,y) + H(x+1,y+1) - H(x-1,y-1) - 2*H(x-1,y) - H(x-1,y+1)) * k, dy = (H(x-1,y+1) + 2*H(x,y+1) + H(x+1,y+1) - H(x-1,y-1) - 2*H(x,y-1) - H(x+1,y-1)) * k;
    const l = Math.hypot(dx, dy, 1), i = (y*N+x)*4; nor[i] = (-dx/l*0.5+0.5)*255; nor[i+1] = (dy/l*0.5+0.5)*255; nor[i+2] = (1/l*0.5+0.5)*255; nor[i+3] = 255; }
  const mkT = (data, srgb) => { const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = R3.renderer ? Math.min(8, R3.renderer.capabilities.getMaxAnisotropy()) : 1; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; t.shared = true; return t; };
  return HD.tex[key] = {map: mkT(col, true), normalMap: mkT(nor), roughnessMap: mkT(rou)};
}
const hdMix = (a, b, t) => a + (b-a)*t, hdSat = x => x < 0 ? 0 : x > 1 ? 1 : x;
function hdSetRGB(o, hex, f){ const n = parseInt(hex.slice(1), 16); f = f==null ? 1 : f; o.r = hdSat(((n>>16)&255)/255*f); o.g = hdSat(((n>>8)&255)/255*f); o.b = hdSat((n&255)/255*f); }
function hdLerpRGB(o, hex, t){ const n = parseInt(hex.slice(1), 16); o.r = hdMix(o.r, ((n>>16)&255)/255, t); o.g = hdMix(o.g, ((n>>8)&255)/255, t); o.b = hdMix(o.b, (n&255)/255, t); }
// textures cover 2 world units (one tile is one unit)
const HD_TEX = {
  // horizontal clapboard planks with grain, knots, nails, gaps, weathering and moss low down
  planks: (u, v, o) => { const rows = 10, r = Math.floor(v*rows), fv = v*rows - r, off = hdHash(r, 0, 3), len = 0.5 + hdHash(r,1,4)*0.5, uu = (u + off) % 1, b = Math.floor(uu/len*2), fu = (uu/len*2) % 1;
    const tint = 0.82 + hdHash(r, b, 5)*0.3, grain = hdNoise(u*6, v*rows*18 + hdHash(r,b,6)*50, 6, 7)*0.35 + hdNoise(u*40, v*rows*2, 40, 8)*0.15, knot = hdNoise(u*9+r, v*20, 9, 9) > 0.86 ? 0.35 : 0;
    const gap = fv < 0.09 || fu < 0.012 ? 1 : 0, nail = (fu < 0.04 || fu > 0.96) && Math.abs(fv - 0.5) < 0.08 ? 1 : 0, wear = hdFbm(u*4, v*4, 4, 10, 3);
    hdSetRGB(o, '#9a6c42', tint*(0.8 + grain*0.5 - knot)); hdLerpRGB(o, '#6c6a60', hdSat((wear - 0.55)*1.6)*0.5);
    if (nail){ hdSetRGB(o, '#3a3634'); } if (gap){ o.r *= 0.35; o.g *= 0.35; o.b *= 0.35; }
    if (v > 0.8) hdLerpRGB(o, '#4a5a2a', hdSat((hdNoise(u*14, v*14, 14, 11) - 0.5)*2)*((v-0.8)*4));
    o.h = gap ? 0.1 : 0.55 + fv*0.2 + grain*0.15 - knot*0.2 + (nail ? 0.3 : 0); o.o = gap ? 1 : nail ? 0.45 : 0.72 + wear*0.2; },
  // vertical barn boards with battens
  boards: (u, v, o) => { const HD_ = HD_TEX.planks; HD_(v, u, o); o.h = o.h*0.9; },
  // log walls: rounded logs with chinking between them
  logs: (u, v, o) => { const rows = 6, r = Math.floor(v*rows), fv = v*rows - r, prof = Math.sin(fv*Math.PI), grain = hdNoise(u*5, v*rows*30 + r*7, 5, 21);
    const tint = 0.8 + hdHash(r, 0, 22)*0.25; hdSetRGB(o, '#7a5232', tint*(0.55 + prof*0.55 + grain*0.2)); if (prof < 0.25) hdSetRGB(o, '#a09884', 0.8 + hdNoise(u*30, v*30, 30, 23)*0.3);
    o.h = prof < 0.25 ? 0.1 : 0.3 + prof*0.7 + grain*0.05; o.o = 0.85; },
  // irregular stone blocks in courses, with mortar, chipped edges, lichen and moss
  stone: (u, v, o) => { const rows = 5, r = Math.floor(v*rows), fv = v*rows - r, off = hdHash(r, 0, 31), uu = (u*2.5 + off) % 1 * 3, b = Math.floor(uu), fu = uu - b;
    const edge = Math.min(fv, 1-fv, fu*0.6, (1-fu)*0.6), mortar = edge < 0.06, tint = 0.75 + hdHash(r, b, 32)*0.35, n = hdFbm(u*8, v*8, 8, 33, 4);
    hdSetRGB(o, ['#8a847a','#948a7a','#7a7a78','#9a9282'][Math.floor(hdHash(r,b,34)*4)], tint*(0.8 + n*0.45)); if (mortar) hdSetRGB(o, '#b8b0a0', 0.75 + n*0.2);
    hdLerpRGB(o, '#5a6a32', hdSat((hdFbm(u*5, v*5, 5, 35, 3) - 0.62)*3)*0.8);
    o.h = mortar ? 0.1 : 0.45 + Math.min(edge*4, 0.35) + n*0.2; o.o = mortar ? 0.95 : 0.8 + n*0.15; },
  brick: (u, v, o) => { const rows = 14, r = Math.floor(v*rows), fv = v*rows - r, uu = (u*5 + (r%2)*0.5) % 1 * 1, b = Math.floor((u*5 + (r%2)*0.5)), fu = uu, mortar = fv < 0.14 || fu < 0.05;
    hdSetRGB(o, '#9a4a32', 0.75 + hdHash(r, b, 41)*0.35 + hdNoise(u*40, v*40, 40, 42)*0.15); if (mortar) hdSetRGB(o, '#c8bca8', 0.8); o.h = mortar ? 0.15 : 0.65 + hdNoise(u*30,v*30,30,43)*0.1; o.o = mortar ? 0.95 : 0.85; },
  plaster: (u, v, o) => { const n = hdFbm(u*6, v*6, 6, 51, 4), s = hdFbm(u*3, v*2, 3, 52, 3); hdSetRGB(o, '#e2d6bc', 0.86 + n*0.18); hdLerpRGB(o, '#9a8a6a', hdSat((s - 0.6)*2)*0.5); if (v > 0.85) hdLerpRGB(o, '#6a5a44', (v-0.85)*4); o.h = 0.5 + n*0.25; o.o = 0.9; },
  // roof shingles: staggered rows, each shingle casts a lip, with moss patches, dirt streaks and the odd dark replacement
  shingles: (u, v, o) => { const rows = 12, r = Math.floor(v*rows), fv = v*rows - r, off = (r%2)*0.5 + hdHash(r,0,61)*0.2, cols = 8, uu = u*cols + off, b = Math.floor(uu), fu = uu - b;
    const old = hdHash(r, b, 62), tint = 0.7 + old*0.4 - (old > 0.93 ? 0.25 : 0), grain = hdNoise(u*cols*6, v*rows*2, cols*6, 63);
    o.r = o.g = o.b = tint*(0.75 + grain*0.3)*(0.72 + fv*0.35); if (fu < 0.05) { o.r *= 0.4; o.g *= 0.4; o.b *= 0.4; }
    const moss = hdSat((hdFbm(u*4, v*4, 4, 64, 4) - 0.58)*3); o.mo = moss;
    o.h = fu < 0.05 ? 0.05 : 0.2 + fv*0.8; o.o = 0.78 + grain*0.15 - moss*0.1; },
  thatch: (u, v, o) => { const s = hdNoise(u*90, v*3, 90, 71), s2 = hdNoise(u*40 + 3, v*6, 40, 72), rows = 5, fv = (v*rows) % 1;
    hdSetRGB(o, '#b89a58', 0.65 + s*0.4 + s2*0.15 - (fv > 0.85 ? 0.25 : 0)); hdLerpRGB(o, '#6a6a3a', hdSat((hdFbm(u*3, v*3, 3, 73, 3)-0.6)*2)*0.6); o.h = 0.3 + s*0.5 + fv*0.2; o.o = 0.95; },
  door: (u, v, o) => { const b = Math.floor(u*4), fu = u*4 - b, grain = hdNoise(u*8, v*40 + b*9, 8, 81); hdSetRGB(o, '#6a4424', 0.8 + grain*0.35 + hdHash(b,0,82)*0.15); if (fu < 0.05) { o.r *= 0.4; o.g *= 0.4; o.b *= 0.4; } const band = Math.abs(v-0.2) < 0.03 || Math.abs(v-0.8) < 0.03; if (band) hdSetRGB(o, '#2a2624'); o.h = fu < 0.05 ? 0.1 : band ? 0.9 : 0.5 + grain*0.2; o.o = band ? 0.4 : 0.75; },
  bark: (u, v, o) => { const n = hdNoise(u*10, v*2, 10, 91), n2 = hdNoise(u*24, v*6, 24, 92); hdSetRGB(o, '#5a4230', 0.6 + n*0.5 + n2*0.2); o.h = n*0.7 + n2*0.3; o.o = 0.95; },
  metal: (u, v, o) => { const n = hdFbm(u*8, v*8, 8, 101, 4); hdSetRGB(o, '#6a6a70', 0.8 + n*0.3); hdLerpRGB(o, '#7a4a2a', hdSat((hdFbm(u*4,v*4,4,102,3)-0.6)*2.5)); o.h = 0.5 + n*0.2; o.o = 0.45 + n*0.3; }
};
// a standard material using one of the texture sets; tint multiplies the colour
function hdMat(kind, opt){
  opt = opt || {}; const T0 = hdMakeTex(kind, HD_TEX[kind], {bump: opt.bump});
  const m = new THREE.MeshStandardMaterial(Object.assign({map:T0.map, normalMap:T0.normalMap, roughnessMap:T0.roughnessMap, roughness:1, metalness:0, normalScale:new THREE.Vector2(opt.ns||1, opt.ns||1)}, opt.m||{}));
  if (opt.color) m.color.set(opt.color); return m;
}
// planar world-scale UVs for any geometry (texture covers `size` world units), so shared textures never stretch
function hdWorldUV(g, size){
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count*2), s = 1/(size||2);
  for (let i=0;i<p.count;i++){ const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)); let u, v;
    if (ay >= ax && ay >= az){ u = p.getX(i); v = p.getZ(i); } else if (ax >= az){ u = p.getZ(i); v = -p.getY(i); } else { u = p.getX(i); v = -p.getY(i); }
    uv[i*2] = u*s; uv[i*2+1] = v*s; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}

// =====================================================================
// renderer, sky and light
// =====================================================================
function hdInit(){
  HD.q = hdTier(); R3.hdQ = HD.q; HD_WIND.uCam.value = new THREE.Vector3();
  const R = R3.renderer;
  R.toneMapping = THREE.NoToneMapping; // the post pass tone-maps; without it (fallback) the renderer does
  if (!R3.vol) R.toneMapping = THREE.ACESFilmicToneMapping;
  R.toneMappingExposure = 1.0;
  R3.sun.shadow.mapSize.set([1024, 2048, 4096][HD.q], [1024, 2048, 4096][HD.q]); R3.sun.shadow.radius = 3; R3.sun.shadow.blurSamples = 12;
  R3.sun.shadow.bias = -0.0004; R3.sun.shadow.normalBias = 0.03;
  // the sky dome: gradient, sun and its glow, moon, stars; it is also rendered into the scene's environment light
  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), new THREE.ShaderMaterial({ side:THREE.BackSide, depthWrite:false, fog:false,
    uniforms:{ top:{value:new THREE.Color()}, hor:{value:new THREE.Color()}, gnd:{value:new THREE.Color()}, sunDir:{value:new THREE.Vector3(0,1,0)}, sunCol:{value:new THREE.Color()}, night:{value:0}, moonDir:{value:new THREE.Vector3(0,1,0)}, cloud:{value:0}, time:{value:0} },
    vertexShader:`varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader:`varying vec3 vD; uniform vec3 top, hor, gnd, sunDir, sunCol, moonDir; uniform float night, cloud, time;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
      void main(){ vec3 d = normalize(vD); float y = d.y;
        vec3 c = y > 0.0 ? mix(hor, top, pow(clamp(y,0.0,1.0), 0.55)) : mix(hor, gnd, clamp(-y*4.0,0.0,1.0));
        float sd = max(dot(d, sunDir), 0.0); c += sunCol * (pow(sd, 900.0)*6.0 + pow(sd, 12.0)*0.35 + pow(sd, 3.0)*0.12) * (1.0-cloud*0.7);
        float md = max(dot(d, moonDir), 0.0); c += vec3(0.8,0.85,1.0) * (smoothstep(0.9993, 0.9996, md)*1.4 + pow(md, 60.0)*0.08) * night;
        if (night > 0.01 && y > 0.0){ vec3 q = floor(d*260.0); float s = h(q); float tw = 0.6 + 0.4*sin(time*2.0 + s*50.0); c += vec3(0.9,0.93,1.0) * step(0.9975, s) * night * tw * smoothstep(0.0, 0.25, y) * (1.0-cloud); }
        gl_FragColor = vec4(c, 1.0); }` }));
  sky.frustumCulled = false; sky.renderOrder = -10; R3.scene.add(sky); HD.sky = sky;
  HD.envScene = new THREE.Scene(); HD.envSky = new THREE.Mesh(sky.geometry, sky.material); HD.envScene.add(HD.envSky);
  HD.pmrem = new THREE.PMREMGenerator(R); HD.envT = -1e9;
  R3.scene.environmentIntensity = 0.6;
  hdParticlesInit(); hdRipplesInit();
  hdAdaptInit();
}
// sky colours for the time of day and weather; called from r3Sky every frame
function hdSky(p){
  const U = HD.sky.material.uniforms, C = h => new THREE.Color(h), day = p.day, over = p.overcast;
  const topDay = C('#3f7fd0'), horDay = C('#b8d8f0'), topDusk = C('#4a5a9a'), horDusk = C('#f0a060'), topNight = C('#060a18'), horNight = C('#1a2440');
  const top = topNight.clone().lerp(topDay, day).lerp(topDusk, p.dusk*0.6), hor = horNight.clone().lerp(horDay, day).lerp(horDusk, p.dusk*0.8);
  const grey = C(p.snow ? '#c8d0dc' : '#8e98a6').multiplyScalar(0.25 + 0.75*day); top.lerp(grey, over*0.85); hor.lerp(grey, over*0.8);
  U.top.value.copy(top); U.hor.value.copy(hor); U.gnd.value.copy(hor).multiplyScalar(0.55);
  U.sunDir.value.copy(p.sunDir); U.sunCol.value.copy(p.sunCol); U.night.value = 1-day; U.moonDir.value.set(-p.sunDir.x, Math.abs(p.sunDir.y)+0.25, -p.sunDir.z).normalize(); U.cloud.value = over; U.time.value = performance.now()/1000;
  HD.sky.position.copy(R3.camera.position);
  // the environment light follows the sky, refreshed every ~20 game minutes or when the weather changes
  const key = Math.floor(S.minute/20) + '|' + S.weather;
  if (key !== HD.envKey){ HD.envKey = key; HD.envSky.position.set(0,0,0); const rt = HD.pmrem.fromScene(HD.envScene, 0, 0.1, 1000); if (HD.envRT) HD.envRT.dispose(); HD.envRT = rt; R3.scene.environment = rt.texture; }
  R3.scene.environmentIntensity = 0.25 + day*0.55;
  R3.scene.fog.color.copy(hor);
  return hor;
}

// =====================================================================
// terrain: a per-tile data texture drives a blended procedural surface
// =====================================================================
// R: surface kind; G: wear; B: water depth (in water) or wetness of the bank (on land); A: variation / field rows
const HD_SURF = {grass:0, path:1, sand:2, rock:3, field:4, plaza:5, pasture:6, forest:7, bed:8, flowers:9, fog:10, base:11};
function hdSurfaceOf(t){ switch (t){ case T.PATH: return 1; case T.SAND: return 2; case T.ROCK: return 3; case T.FIELD: return 4; case T.PLAZA: return 5; case T.PASTURE: case T.FENCE: return 6; case T.TREE: return 7;
  case T.WATER: case T.BRIDGE: case T.DOCK: return 8; case T.FLOWER: return 9; case T.FOG: return 10; case T.BUILD: return 11; default: return 0; } }
function hdWaterish(t){ return t===T.WATER || t===T.BRIDGE || t===T.DOCK; }
// distance (in tiles, up to `max`) from each tile to the nearest tile matching `pred`
function hdDistField(pred, max){
  const W = MW, H = MH, d = new Float32Array(W*H).fill(max), q = [];
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) if (pred(MAP[Y0+y][X0+x])){ d[y*W+x] = 0; q.push(y*W+x); }
  for (let qi=0; qi<q.length; qi++){ const i = q[qi], x = i%W, y = (i/W)|0, v = d[i]+1; if (v >= max) continue;
    for (const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){ const X = x+a, Y = y+b; if (X<0||Y<0||X>=W||Y>=H) continue; const j = Y*W+X; if (d[j] > v){ d[j] = v; q.push(j); } } }
  return d;
}
function hdTerrainData(){
  const W = MW, H = MH, data = new Uint8Array(W*H*4), flow = new Uint8Array(W*H*4);
  const toWater = hdDistField(hdWaterish, 6), toLand = hdDistField(t=>!hdWaterish(t) && t!==T.FOG, 8);
  const traffic = (typeof CIV!=='undefined' && CIV && S.civ) ? S.civ.traffic || {} : {}, roads = CIV && S.civ ? S.civ.roads || {} : {};
  let maxT = 1; for (const k in traffic) if (traffic[k] > maxT) maxT = traffic[k];
  HD.depth = new Float32Array(W*H); HD.tdData = data;
  for (let y=0;y<H;y++) for (let x=0;x<W;x++){
    const t = MAP[Y0+y][X0+x], i = (y*W+x), s = hdSurfaceOf(t); let wear = 0, b = 0, a = Math.floor(hdHash(x+X0, y+Y0, 5)*120);
    if (t===T.PATH){ const k = tkey(x+X0, y+Y0); wear = roads[k] ? 1 : CIV ? 0.35 + Math.min(0.65, Math.sqrt((traffic[k]||0)/maxT)) : 0.7; }
    else if (t===T.GRASS || t===T.FLOWER){ const k = tkey(x+X0, y+Y0); wear = CIV ? Math.min(0.8, Math.sqrt((traffic[k]||0)/maxT)*1.4) : 0; }
    else if (t===T.PASTURE || t===T.FENCE) wear = 0.45 + hdHash(x,y,6)*0.3;
    if (hdWaterish(t)){ b = Math.min(1, (toLand[i]-1)/5 + 0.15); HD.depth[i] = b; }
    else b = toWater[i] < 3 ? 1 - toWater[i]/3 : 0;
    if (t===T.FIELD && CIV){ const st = civStructAt(x+X0, y+Y0); if (st) a = (st.w >= st.h ? 0 : 128) + Math.round(((st.meta && st.meta.stage==='growing') ? (st.meta.growth||0) : st.meta && st.meta.stage==='ripe' ? 1 : 0)*100); }
    data[i*4] = s; data[i*4+1] = wear*255; data[i*4+2] = b*255; data[i*4+3] = a;
    // river flow: narrow water runs downstream (south), wide water (the lake) barely moves
    if (hdWaterish(t)){ let wdt = 0; for (let k=-8;k<=8;k++){ const tt = tileAt(x+X0+k, y+Y0); if (hdWaterish(tt)) wdt++; } const river = wdt < 12 ? 1 : 0.15;
      const dxr = typeof riverX==='function' ? (riverX(Math.min(y+Y0+1, 40)) - riverX(Math.min(y+Y0, 40))) : 0; flow[i*4] = 128 + dxr*60*river; flow[i*4+1] = 128 + 110*river; flow[i*4+2] = 0; flow[i*4+3] = 255; }
    else { flow[i*4] = flow[i*4+1] = 128; }
  }
  const mk = d => { const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.NearestFilter; t.needsUpdate = true; return t; };
  if (HD.td){ HD.td.dispose(); HD.tf.dispose(); }
  HD.td = mk(data); HD.tf = mk(flow); HD.tdKey = `${X0},${Y0},${MW},${MH}`;
  HD.toWater = toWater; HD.toLand = toLand;
  return HD.td;
}
// the ground's height: water beds slope down from the shore, rocks rise, meadows undulate gently
function hdTileH(x, y){ const t = tileAt(x, y); if (t===-1) return 0; const i = (y-Y0)*MW + (x-X0);
  if (hdWaterish(t)) return -0.16 - Math.min(5, (HD.toLand[i]||1)-1)*0.16;
  if (t===T.ROCK) return 0.35 + hashf(x,y,5)*0.55;
  if (t===T.GRASS || t===T.FLOWER || t===T.TREE) return (hdNoise(x*0.35, y*0.35, 1e6, 7)-0.5)*0.06;
  return 0; }
function hdHeightAt(x, z){ const fx = x-0.5, fz = z-0.5, i = Math.floor(fx), j = Math.floor(fz), u = fx-i, v = fz-j;
  return (hdTileH(i,j)*(1-u) + hdTileH(i+1,j)*u)*(1-v) + (hdTileH(i,j+1)*(1-u) + hdTileH(i+1,j+1)*u)*v; }

const HD_GLSL_NOISE = `
  float hdH(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float hdN(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f); return mix(mix(hdH(i), hdH(i+vec2(1,0)), u.x), mix(hdH(i+vec2(0,1)), hdH(i+vec2(1,1)), u.x), u.y); }
  float hdF(vec2 p){ float a = 0.5, s = 0.0; for (int i=0;i<4;i++){ s += a*hdN(p); p = p*2.03 + 17.1; a *= 0.5; } return s; }
  float hdF2(vec2 p){ return 0.66*hdN(p) + 0.34*hdN(p*2.1+5.2); }
  // cells: distance to the nearest jittered point and that point's random id
  vec2 hdCell(vec2 p){ vec2 i = floor(p), f = fract(p); float d = 8.0, id = 0.0; for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++){ vec2 g = vec2(x,y), o = vec2(hdH(i+g), hdH(i+g+13.7)); vec2 r = g + o - f; float dd = dot(r,r); if (dd < d){ d = dd; id = hdH(i+g+7.1); } } return vec2(sqrt(d), id); }
  vec3 hdLin(vec3 c){ return pow(c, vec3(2.2)); }`;
function hdTerrainMat(){
  const m = new THREE.MeshStandardMaterial({color:0xffffff, roughness:1, metalness:0});
  const U = HD.terrU = { uTD:{value:HD.td}, uOrigin:{value:new THREE.Vector2(X0, Y0)}, uSize:{value:new THREE.Vector2(MW, MH)}, uTime:{value:0}, uSeason:{value:ART.season}, uSnow:{value:0}, uWet:{value:0}, uSun:{value:1}, uQ:{value:HD.q} };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHdW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvHdW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vHdW; uniform sampler2D uTD; uniform vec2 uOrigin, uSize; uniform float uTime, uSeason, uSnow, uWet, uSun; uniform int uQ;
      ${HD_GLSL_NOISE}
      // one surface kind at point p (world x,z): colour (linear), roughness, height (for bump)
      void hdSurf(int k, vec2 p, vec4 tv, out vec3 col, out float rough, out float h){
        float n = hdF(p*0.35), n2 = hdN(p*3.1), n3 = hdN(p*11.0), wear = tv.g, wet = tv.b;
        vec3 g0 = uSeason < 0.5 ? vec3(0.34,0.56,0.2) : uSeason < 1.5 ? vec3(0.28,0.46,0.17) : uSeason < 2.5 ? vec3(0.5,0.48,0.22) : vec3(0.36,0.4,0.26);
        vec3 g1 = uSeason < 0.5 ? vec3(0.48,0.66,0.24) : uSeason < 1.5 ? vec3(0.4,0.56,0.2) : uSeason < 2.5 ? vec3(0.62,0.5,0.24) : vec3(0.46,0.46,0.3);
        vec3 dirt = mix(vec3(0.5,0.37,0.24), vec3(0.62,0.48,0.32), n2);
        if (k == 0 || k == 9 || k == 6 || k == 7){ // grass, flowery grass, pasture, forest floor
          col = mix(g0, g1, smoothstep(0.25, 0.75, n)) * (0.85 + n3*0.3);
          col = mix(col, vec3(0.62,0.58,0.3), smoothstep(0.62, 0.8, hdF(p*0.9+9.0))*0.45); // dry patches
          col = mix(col, col*0.7, smoothstep(0.55, 0.7, hdN(p*6.0+3.0))*0.5); // clover and tufts
          h = n3*0.5 + n2*0.3; rough = 0.92;
          if (k == 9){ vec2 c = hdCell(p*5.0); if (c.x < 0.18) { col = mix(vec3(0.95,0.85,0.3), vec3(0.9,0.5,0.7), step(0.5, c.y)); col = mix(col, vec3(0.95), step(0.8, c.y)); h += 0.4; } }
          if (k == 6){ col = mix(col, dirt*0.85, 0.25 + wear*0.45*smoothstep(0.3, 0.7, n2)); }
          if (k == 7){ col = mix(vec3(0.22,0.17,0.11), vec3(0.3,0.24,0.14), n2); vec2 c = hdCell(p*6.0); col = mix(col, mix(vec3(0.55,0.32,0.12), vec3(0.62,0.5,0.2), c.y), step(c.x, 0.3)*0.7); col = mix(col, vec3(0.2,0.34,0.12), smoothstep(0.6, 0.75, n)*0.7); h = n3*0.4 + (c.x < 0.3 ? 0.3 : 0.0); }
          col = mix(col, dirt*0.9, wear*0.55*smoothstep(0.2, 0.8, n2 + wear*0.4)); // worn where people walk
          col = mix(col, col*vec3(0.62,0.62,0.55), wet*0.6); // damp near water
        } else if (k == 1){ // dirt path: compacted centre, pebbles, grass creeping in, deeper colour when worn
          col = dirt * (0.8 + n3*0.25) * (1.0 - wear*0.15); vec2 c = hdCell(p*7.0); float peb = step(c.x, 0.1 + c.y*0.06) * step(0.45, c.y);
          col = mix(col, mix(vec3(0.42,0.4,0.37), vec3(0.56,0.52,0.46), c.y), peb*0.7); h = n3*0.25 + peb*(0.6 - c.x*2.0);
          col = mix(col, g0*0.9, (1.0-wear)*smoothstep(0.55, 0.8, hdF(p*1.3+4.0))*0.6); rough = 0.9 - peb*0.2;
        } else if (k == 2){ col = vec3(0.78,0.7,0.52) * (0.88 + n3*0.2); h = sin(p.x*5.0 + n*6.0)*0.3 + n3*0.2; rough = 0.95; }
        else if (k == 3){ float cr = abs(hdN(p*2.5) - 0.5); col = mix(vec3(0.42,0.41,0.39), vec3(0.58,0.56,0.52), n) * (0.75 + n3*0.35); col *= 0.65 + smoothstep(0.0, 0.06, cr)*0.35; col = mix(col, vec3(0.3,0.38,0.16), smoothstep(0.6, 0.72, hdF(p*1.6))*0.7); h = n*0.8 + smoothstep(0.0, 0.06, cr)*0.3; rough = 0.82; }
        else if (k == 4){ // tilled field: furrows along the field's length
          float along = tv.a > 0.5 ? p.x : p.y, row = sin(along*6.2832*2.5 + n*0.6)*0.5+0.5; col = mix(vec3(0.24,0.16,0.1), vec3(0.4,0.28,0.18), row) * (0.85 + n3*0.2); h = row*0.8 + n3*0.2; rough = 0.95;
          col = mix(col, col*0.75, wet*0.4); }
        else if (k == 5){ vec2 c = hdCell(p*3.2); float mortar = smoothstep(0.34, 0.46, c.x); col = mix(vec3(0.52,0.5,0.47), vec3(0.68,0.64,0.57), c.y) * (0.85 + n3*0.2); col = mix(col, vec3(0.3,0.28,0.24), mortar); h = (1.0 - mortar)*(0.6 - c.x*0.5); rough = 0.75 + mortar*0.2; }
        else if (k == 8){ // river and lake bed: sand and pebbles in the shallows, dark silt in the deep
          vec2 c = hdCell(p*4.0); float peb = step(c.x, 0.3); col = mix(vec3(0.5,0.45,0.34), vec3(0.36,0.35,0.32), peb*c.y) * mix(0.8, 0.45, wet); col = mix(col, vec3(0.12,0.16,0.14), smoothstep(0.1, 0.9, wet)); col = mix(col, vec3(0.2,0.3,0.12), smoothstep(0.62, 0.72, n)*0.5*(1.0-wet)); h = peb*0.5 + n3*0.2; rough = 0.6; }
        else if (k == 10){ col = vec3(0.1,0.12,0.16) * (0.8 + n*0.4); h = 0.0; rough = 1.0; }
        else { col = mix(vec3(0.42,0.36,0.28), vec3(0.5,0.45,0.38), n2); h = n3*0.3; rough = 0.9; }
      }
      vec3 hdBump(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection){ vec3 vSigmaX = normalize(dFdx(surf_pos)); vec3 vSigmaY = normalize(dFdy(surf_pos)); vec3 R1 = cross(vSigmaY, surf_norm); vec3 R2 = cross(surf_norm, vSigmaX); float fDet = dot(vSigmaX, R1) * faceDirection; vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2); return normalize(abs(fDet) * surf_norm - vGrad); }
      float hdTerrH = 0.0; float hdTerrRough = 0.9;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
      { vec2 p = vHdW.xz; vec2 tp = p - uOrigin - 0.5 + (vec2(hdN(p*1.7), hdN(p*1.7+31.0)) - 0.5)*0.55; // warped, so edges between surfaces are organic
        ivec2 i0 = ivec2(floor(tp)); vec2 f = fract(tp); vec3 acc = vec3(0.0); float ra = 0.0, ha = 0.0, wa = 0.0; vec4 tvC = vec4(0.0);
        int reach = uQ == 0 ? 1 : 2; if (uQ == 0){ i0 = ivec2(floor(p - uOrigin)); f = vec2(0.0); } // Low: one surface per tile, no blending
        for (int j=0;j<2;j++) for (int i=0;i<2;i++){ if (i >= reach || j >= reach) continue;
          ivec2 ti = clamp(i0 + ivec2(i,j), ivec2(0), ivec2(uSize) - 1); vec4 tv = texelFetch(uTD, ti, 0); int k = int(tv.r*255.0 + 0.5);
          float w = (i==0 ? 1.0-f.x : f.x) * (j==0 ? 1.0-f.y : f.y);
          vec3 c; float r, h; hdSurf(k, p, tv, c, r, h); w = pow(w, 1.6) * (0.4 + h); // height-weighted blending: stones and tufts poke through
          acc += c*w; ra += r*w; ha += h*w; wa += w; if (i==1 && j==1) tvC = tv; }
        vec3 col = acc/wa; float rough = ra/wa; float hh = ha/wa;
        vec4 tvN = texelFetch(uTD, clamp(ivec2(floor(p - uOrigin)), ivec2(0), ivec2(uSize)-1), 0); int kn = int(tvN.r*255.0+0.5);
        // shallow beds catch dancing caustics
        if (kn == 8){ float d = tvN.b; vec2 q = p*1.6; float cs = 0.0; for (int o=0;o<2;o++){ vec2 c = hdCell(q + vec2(uTime*0.35, uTime*0.22)*float(o*2-1)); cs += smoothstep(0.55, 0.0, 1.0 - c.x) ; }
          col += vec3(0.85,0.95,1.0) * pow(cs*0.5, 3.0) * (1.0 - d) * 0.9 * uSun; }
        // snow settles everywhere but the water; rain darkens and slicks the ground and fills hollows with puddles
        float snowCov = uSnow * smoothstep(0.25, 0.55, hdF(p*0.6) + uSnow*0.4) * (kn == 8 ? 0.0 : 1.0);
        col = mix(col, vec3(0.9,0.92,0.95), snowCov); rough = mix(rough, 0.7, snowCov);
        float puddle = (kn == 1 || kn == 6 || kn == 11) ? smoothstep(0.62, 0.66, hdF(p*0.8+2.0) + uWet*0.25) * uWet : 0.0;
        col *= 1.0 - uWet*0.35*(1.0 - snowCov); rough = mix(rough, rough*0.55, uWet); col = mix(col, vec3(0.12,0.14,0.16), puddle*0.6); rough = mix(rough, 0.05, puddle); hh = mix(hh, 0.0, puddle);
        diffuseColor.rgb *= hdLin(col); hdTerrH = hh; hdTerrRough = rough; }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = hdTerrRough;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      if (uQ > 0){ vec2 dH = vec2(dFdx(hdTerrH), dFdy(hdTerrH)) * (uQ > 1 ? 0.045 : 0.03); normal = hdBump(-vViewPosition, normal, dH, faceDirection); }`);
  };
  m.customProgramCacheKey = () => 'hdTerrain';
  return m;
}
// fields ripen and paths wear in: refresh the tile data without rebuilding the ground
function hdRefreshTerrainData(){ hdTerrainData(); hdBindTD(); }
function hdBindTD(){ if (HD.terrU){ HD.terrU.uTD.value = HD.td; HD.terrU.uOrigin.value.set(X0, Y0); HD.terrU.uSize.value.set(MW, MH); }
  if (HD.waterU){ HD.waterU.uTD.value = HD.td; HD.waterU.uTF.value = HD.tf; HD.waterU.uOrigin.value.set(X0, Y0); HD.waterU.uSize.value.set(MW, MH); } }
function hdTerrain(){
  hdTerrainData(); hdBindTD();
  const res = [1, 2, 3][HD.q], g = new THREE.PlaneGeometry(MW, MH, MW*res, MH*res); g.rotateX(-Math.PI/2); g.translate(X0+MW/2, 0, Y0+MH/2);
  const pos = g.attributes.position;
  // banks wander: near the waterline the ground is nudged up and down so the shore is never a straight tile edge
  for (let i=0;i<pos.count;i++){ const x = pos.getX(i), z = pos.getZ(i); let h = hdHeightAt(x, z); if (h > -0.34 && h < 0.02) h += (hdNoise(x*1.9, z*1.9, 1e6, 91) - 0.5)*0.16 + (hdNoise(x*5.3, z*5.3, 1e6, 92) - 0.5)*0.05; pos.setY(i, h); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, hdTerrainMat()); m.receiveShadow = true; m.userData.hd = true;
  return m;
}

// =====================================================================
// water: depth-coloured, transparent, moving
// =====================================================================
function hdWater(){
  const g = new THREE.PlaneGeometry(MW, MH, 1, 1); g.rotateX(-Math.PI/2); g.translate(X0+MW/2, -0.1, Y0+MH/2);
  const U = HD.waterU = { uTD:{value:HD.td}, uTF:{value:HD.tf}, uOrigin:{value:new THREE.Vector2(X0,Y0)}, uSize:{value:new THREE.Vector2(MW,MH)}, uTime:{value:0}, uSunDir:{value:new THREE.Vector3(0,1,0)}, uSunCol:{value:new THREE.Color()}, uSky:{value:new THREE.Color()}, uSkyTop:{value:new THREE.Color()}, uDay:{value:1}, uRain:{value:0},
    uRip:{value:Array.from({length:24}, ()=>new THREE.Vector4(0,0,-1,0))}, fogColor:{value:new THREE.Color()}, fogNear:{value:1}, fogFar:{value:1000}, uQ:{value:HD.q} };
  const mat = new THREE.ShaderMaterial({ uniforms:U, transparent:true, depthWrite:false, fog:true,
    vertexShader:`varying vec3 vW; varying float vFogDepth; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vFogDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader:`varying vec3 vW; varying float vFogDepth; uniform sampler2D uTD, uTF; uniform vec2 uOrigin, uSize; uniform float uTime, uDay, uRain; uniform int uQ; uniform vec3 uSunDir, uSunCol, uSky, uSkyTop, fogColor; uniform float fogNear, fogFar; uniform vec4 uRip[24];
      ${HD_GLSL_NOISE}
      vec2 gradN(vec2 p){ float e = 0.08; return vec2(hdF2(p+vec2(e,0.0)) - hdF2(p-vec2(e,0.0)), hdF2(p+vec2(0.0,e)) - hdF2(p-vec2(0.0,e))) / (2.0*e); }
      void main(){
        vec2 p = vW.xz; vec2 tp = p - uOrigin; ivec2 ti = clamp(ivec2(floor(tp)), ivec2(0), ivec2(uSize)-1);
        // smooth depth: bilinear over the tile grid (0 at the shore, 1 in the deep)
        vec2 bt = tp - 0.5; ivec2 b0 = ivec2(floor(bt)); vec2 bf = fract(bt); float dep = 0.0, wsum = 0.0;
        for (int j=0;j<2;j++) for (int i=0;i<2;i++){ vec4 tv = texelFetch(uTD, clamp(b0+ivec2(i,j), ivec2(0), ivec2(uSize)-1), 0); int k = int(tv.r*255.0+0.5); float w = (i==0?1.0-bf.x:bf.x)*(j==0?1.0-bf.y:bf.y); dep += (k == 8 ? tv.b : -0.3)*w; wsum += w; }
        dep = clamp(dep/wsum, 0.0, 1.0);
        vec2 fl = (texelFetch(uTF, ti, 0).rg - 0.5) * 2.0; // current direction and speed
        float t = uTime;
        // waves: two scrolling layers, carried along by the current, plus fine ripples
        vec2 g = gradN(p*0.9 - fl*t*0.55 + vec2(t*0.05, t*0.03)) * 0.55 + gradN(p*2.3 + fl*0.0 - fl*t*0.9 + vec2(-t*0.08, t*0.06)) * 0.3;
        if (uQ > 0) g += gradN(p*6.0 - fl*t*1.6 + t*0.2) * 0.12;
        g += gradN(p*9.0 + t*vec2(0.7, -0.5)) * uRain * 0.35; // rain stipples the surface
        // expanding rings: fishing lines, boats, animals, rain
        for (int i=0;i<24;i++){ vec4 r = uRip[i]; if (r.z < 0.0) continue; vec2 d = p - r.xy; float dist = length(d); float rad = r.z*0.9; float ring = exp(-pow((dist - rad)*9.0, 2.0)) * (1.0 - r.z/r.w) * 0.9; g += normalize(d + 1e-4) * ring * sin((dist-rad)*40.0) ; }
        vec3 N = normalize(vec3(-g.x*0.35, 1.0, -g.y*0.35));
        vec3 V = normalize(cameraPosition - vW);
        float fres = 0.03 + 0.97*pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 shallow = vec3(0.07,0.36,0.38), deep = vec3(0.015,0.08,0.17);
        vec3 body = mix(shallow, deep, smoothstep(0.0, 0.85, dep)) * (0.35 + 0.65*uDay);
        vec3 R = reflect(-V, N); vec3 refl = mix(uSky, uSkyTop, clamp(R.y*1.5, 0.0, 1.0));
        vec3 col = mix(body, mix(refl, uSkyTop, 0.35)*0.8, fres*0.6);
        vec3 H = normalize(uSunDir + V); float spec = pow(max(dot(N, H), 0.0), 350.0) * 6.0 + pow(max(dot(N, H), 0.0), 40.0) * 0.12;
        col += uSunCol * spec;
        // foam where water meets the bank and around the shallows' stones
        float shore = 1.0 - smoothstep(0.0, 0.1, dep); float foam = shore * smoothstep(0.55, 0.85, hdF2(p*3.0 + vec2(t*0.3, -t*0.2) - fl*t*0.6)) * 0.6;
        foam += smoothstep(0.9, 1.0, hdF2(p*5.0 - fl*t*1.2)) * 0.25 * length(fl);
        col = mix(col, vec3(0.92,0.96,1.0)*(0.4+0.6*uDay), clamp(foam, 0.0, 0.85));
        float alpha = mix(0.22, 0.88, smoothstep(0.05, 0.85, dep)); alpha = max(alpha, fres*0.8); alpha = max(alpha, foam);
        alpha *= smoothstep(-0.25, 0.02, dep); // fade out where the ground rises above the waterline
        float fogF = smoothstep(fogNear, fogFar, vFogDepth); col = mix(col, fogColor, fogF);
        gl_FragColor = vec4(col, alpha);
        #include <colorspace_fragment>
      }` });
  const m = new THREE.Mesh(g, mat); m.renderOrder = 2; m.userData.hd = true;
  return m;
}
// ripples: rings that spread and fade; the water shader draws them
function hdRipplesInit(){ HD.ripples = []; }
function hdRipple(x, z, life){ if (HD.ripples.length >= 24) HD.ripples.shift(); HD.ripples.push({x, z, age:0, life: life || 2.2}); }
function hdRipplesUpdate(dt){
  const U = HD.waterU; if (!U) return;
  HD.ripples.forEach(r=>{ r.age += dt; }); HD.ripples = HD.ripples.filter(r=>r.age < r.life);
  for (let i=0;i<24;i++){ const r = HD.ripples[i]; if (r) U.uRip.value[i].set(r.x, r.z, r.age, r.life); else U.uRip.value[i].set(0,0,-1,0); }
}
