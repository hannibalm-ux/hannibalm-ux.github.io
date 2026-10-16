// The Belt: 3D strategic view. Reads the simulation state and draws it; never changes it.
// Camera: drag to orbit, wheel or pinch to zoom, tap to select, double-tap to focus. Shift-drag or right-drag pans.
import * as THREE from '../vendor/three.module.min.js';
import * as S from './sim.js';

const SC = 100;                                   // world units per AU
const TAU = Math.PI * 2;
const v3 = (p, out = new THREE.Vector3()) => out.set(p[0] * SC, p[2] * SC, -p[1] * SC);
const CLS_COL = { C: '#6f8196', S: '#d2a86a', M: '#8fd4ff', '?': '#a89f92' };
const BODY = {
  sun: { r: 4, col: '#ffd98a' }, earth: { r: 1.5, col: '#3f7fd8', tex: 'earth' }, moon: { r: 0.5, col: '#b9bcc2', tex: 'moon' },
  mars: { r: 1.1, col: '#c8663a', tex: 'mars' }, ceres: { r: 0.9, col: '#a7a49c', tex: 'ceres' },
};

function blobTexture(kind, seedN) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  let s = seedN; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const base = { earth: '#2a5fb0', moon: '#8f9299', mars: '#b4562f', ceres: '#8a877f' }[kind];
  g.fillStyle = base; g.fillRect(0, 0, 256, 128);
  const blobs = kind === 'earth' ? ['#3f8a4d', '#4b9a5a', '#d8e6f0'] : kind === 'mars' ? ['#d9824f', '#8d3f22', '#c26d40'] : ['#666870', '#a9aab0', '#7b7d85'];
  for (let i = 0; i < 90; i++) { g.fillStyle = blobs[i % 3]; g.globalAlpha = 0.35 + r() * 0.4; g.beginPath(); g.ellipse(r() * 256, r() * 128, 4 + r() * 22, 3 + r() * 12, r() * 3, 0, TAU); g.fill(); }
  g.globalAlpha = 1; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glowTexture(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.25, outer); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
function ringTexture(col) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.arc(32, 32, 26, 0, TAU); g.stroke();
  g.lineWidth = 2; for (let i = 0; i < 4; i++) { const a = i * TAU / 4; g.beginPath(); g.moveTo(32 + Math.cos(a) * 26, 32 + Math.sin(a) * 26); g.lineTo(32 + Math.cos(a) * 31, 32 + Math.sin(a) * 31); g.stroke(); }
  return new THREE.CanvasTexture(c);
}

const VERT = `attribute float size; attribute vec3 color; attribute float ring; varying vec3 vColor; varying float vRing; uniform float uScale; uniform float uMin; uniform float uMax;
void main(){ vColor=color; vRing=ring; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=clamp(size*uScale/(-mv.z),uMin,uMax); gl_Position=projectionMatrix*mv; }`;
const FRAG = `varying vec3 vColor; varying float vRing;
void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c); if(d>0.5) discard; float a=vRing>0.5?smoothstep(0.5,0.44,d)*smoothstep(0.26,0.36,d):smoothstep(0.5,0.32,d); gl_FragColor=vec4(vColor,a); }`;

export function createView(canvas, labelLayer) {
  const R = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  R.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); R.setClearColor(0x05080d, 1);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, 1, 0.05, 8000);
  const V = { g: null, sel: null, follow: null, onPick: null, onDbl: null, stats: {}, labels: true };
  const C = { target: new THREE.Vector3(0, 0, 0), yaw: 0.6, pitch: 0.75, dist: 420, tTarget: new THREE.Vector3(0, 0, 0), tDist: 420, tYaw: 0.6, tPitch: 0.75 };
  const tmp = new THREE.Vector3(), tmpP = [0, 0, 0];

  // lighting and backdrop
  scene.add(new THREE.AmbientLight(0x8898b0, 0.55));
  const sunLight = new THREE.PointLight(0xfff0d0, 2.6, 0, 0); scene.add(sunLight);
  const stars = (() => { const n = 1800, p = new Float32Array(n * 3); let s = 99; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < n; i++) { const a = r() * TAU, b = Math.acos(2 * r() - 1), d = 5000; p[i * 3] = Math.sin(b) * Math.cos(a) * d; p[i * 3 + 1] = Math.cos(b) * d; p[i * 3 + 2] = Math.sin(b) * Math.sin(a) * d; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xbcd0ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.7, depthWrite: false })); })();
  scene.add(stars);

  // bodies
  const bodies = {};
  for (const [id, d] of Object.entries(BODY)) {
    const mat = id === 'sun' ? new THREE.MeshBasicMaterial({ color: d.col }) : new THREE.MeshLambertMaterial({ map: blobTexture(d.tex, id.length * 977 + id.charCodeAt(0)), color: 0xffffff });
    const m = new THREE.Mesh(new THREE.SphereGeometry(d.r, 32, 20), mat); scene.add(m); bodies[id] = m;
  }
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,240,200,1)', 'rgba(255,170,60,0.35)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sunGlow.scale.set(34, 34, 1); scene.add(sunGlow);
  const orbitLine = (a, inc) => { const pts = []; for (let i = 0; i <= 160; i++) { const t = i / 160 * TAU, x = Math.cos(t) * a, y = Math.sin(t) * a; pts.push(new THREE.Vector3(x * SC, y * Math.sin(inc) * SC, -y * Math.cos(inc) * SC)); }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x2a4058, transparent: true, opacity: 0.55 })); };
  scene.add(orbitLine(1, 0), orbitLine(1.524, 0.03), orbitLine(2.767, 0.18));
  // station markers
  const stationRing = {}; const ringTex = ringTexture('#4fd1e8');
  for (const id of S.STATION_IDS) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, sizeAttenuation: false, depthTest: false, transparent: true, opacity: 0.9 })); sp.scale.set(0.022, 0.022, 1); scene.add(sp); stationRing[id] = sp; }

  // asteroids, claim rings, selection
  let astPts = null, claimPts = null, astN = 0, colDirty = 0;
  const ptsMat = (min) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, uniforms: { uScale: { value: 500 }, uMin: { value: min }, uMax: { value: 26 } } });
  function buildAsteroids(g) {
    astN = g.ast.length; const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(astN * 3), 3)); geo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(astN), 1));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(astN * 3), 3)); geo.setAttribute('ring', new THREE.BufferAttribute(new Float32Array(astN), 1));
    g.ast.forEach((a, i) => geo.attributes.size.setX(i, 0.28 + Math.cbrt(a.res0 / 1e6) * 0.5));
    if (astPts) scene.remove(astPts); astPts = new THREE.Points(geo, ptsMat(2.6)); astPts.frustumCulled = false; scene.add(astPts);
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(astN * 3), 3)); cg.setAttribute('size', new THREE.BufferAttribute(new Float32Array(astN), 1));
    cg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(astN * 3), 3)); cg.setAttribute('ring', new THREE.BufferAttribute(new Float32Array(astN).fill(1), 1));
    if (claimPts) scene.remove(claimPts); claimPts = new THREE.Points(cg, ptsMat(9.5)); claimPts.frustumCulled = false; scene.add(claimPts);
    colDirty = 0;
  }
  const rock = (() => { const geo = new THREE.IcosahedronGeometry(1, 3), p = geo.attributes.position; let sd = 5; const r = () => (sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296;
    const bump = []; for (let i = 0; i < 40; i++) bump.push([r() * 2 - 1, r() * 2 - 1, r() * 2 - 1, 0.1 + r() * 0.16]);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); let k = 1; for (const b of bump) { const d = Math.hypot(x - b[0], y - b[1], z - b[2]); if (d < 0.9) k -= b[3] * 0.35 * (0.9 - d); } k += (Math.sin(x * 5) * Math.cos(y * 4) * Math.sin(z * 6)) * 0.06; p.setXYZ(i, x * k * 1.15, y * k * 0.85, z * k); }
    geo.computeVertexNormals(); const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xb09a80, flatShading: true })); m.visible = false; scene.add(m); return m; })();
  let rockIdx = -1;
  const selSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture('#ffb03a'), sizeAttenuation: false, depthTest: false, transparent: true })); selSprite.scale.set(0.05, 0.05, 1); selSprite.visible = false; scene.add(selSprite);
  const routeLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0x4fd1e8, dashSize: 1.5, gapSize: 1.2, transparent: true, opacity: 0.8, depthTest: false })); routeLine.visible = false; routeLine.frustumCulled = false; scene.add(routeLine);

  // ships
  const shipGeo = new THREE.ConeGeometry(0.5, 2, 6); shipGeo.rotateX(0); const shipMesh = {}; const trailLine = {};
  function shipObj(s) {
    let m = shipMesh[s.id];
    if (!m) { const co = V.g.companies[s.co]; m = new THREE.Mesh(shipGeo, new THREE.MeshBasicMaterial({ color: co.color })); scene.add(m); shipMesh[s.id] = m; m.userData.prev = new THREE.Vector3(); m.userData.dir = new THREE.Vector3(1, 0, 0);
      const tl = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: co.color, transparent: true, opacity: 0.35 })); tl.frustumCulled = false; scene.add(tl); trailLine[s.id] = tl; }
    return m;
  }

  // camera helpers
  function objPos(id, out = new THREE.Vector3()) {
    const g = V.g; if (!g || !id) return out.set(0, 0, 0);
    if (id === 'sun') return out.set(0, 0, 0);
    if (id[0] === 's' && /^s\d+$/.test(id)) { const s = g.ships[id]; if (s) return v3(s.pos, out); }
    if (id[0] === 'f') { const f = g.fac[id]; if (f) return objPos(f.st, out); }
    return v3(S.posOf(g, id, g.t, tmpP), out);
  }
  V.objPos = objPos;
  function place() {
    const cp = Math.cos(C.pitch), sp = Math.sin(C.pitch);
    cam.position.set(C.target.x + Math.sin(C.yaw) * cp * C.dist, C.target.y + sp * C.dist, C.target.z + Math.cos(C.yaw) * cp * C.dist);
    cam.up.set(0, 1, 0); cam.lookAt(C.target); cam.near = Math.max(0.02, C.dist * 0.01); cam.far = 9000; cam.updateProjectionMatrix();
  }
  V.scaleLevel = () => (C.dist < 8 ? 'Operational' : C.dist < 70 ? 'Regional' : 'System');
  V.focus = (id, dist, keepFollow = true) => {
    if (!id) return; const d = id === 'earth' ? 9 : id === 'mars' ? 7 : id === 'ceres' ? 6 : id === 'moon' ? 3 : id[0] === 's' ? 5 : id[0] === 'a' ? 3.2 : 30;
    C.tDist = dist ?? d; V.follow = keepFollow ? id : null; if (!keepFollow) C.tTarget.copy(objPos(id));
  };
  V.home = (kind) => { V.follow = null;
    if (kind === 'system') { C.tTarget.set(0, 0, 0); C.tDist = 520; C.tPitch = 0.85; }
    else if (kind === 'belt') { C.tTarget.copy(objPos('ceres')); C.tDist = 70; C.tPitch = 0.6; C.tYaw = 0.5; }
    else V.focus(kind);
  };
  V.zoom = f => { C.tDist = Math.max(0.5, Math.min(1400, C.tDist * f)); };
  V.select = id => { V.sel = id; selSprite.visible = !!id; };

  // pointer input
  const ptrs = new Map(); let last = null, moved = 0, downT = 0, lastTap = { t: 0, x: 0, y: 0 }, pinch0 = 0, panMode = false;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; downT = performance.now(); panMode = e.shiftKey || e.button === 2 || e.button === 1; if (ptrs.size === 2) pinch0 = pdist(); });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  const pdist = () => { const a = [...ptrs.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1; };
  canvas.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    if (ptrs.size === 2) { const d = pdist(); C.tDist = Math.max(0.5, Math.min(1400, C.tDist * pinch0 / d)); pinch0 = d; return; }
    if (moved < 5) return;
    if (panMode) { const k = C.dist * 0.0016; const right = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1); C.tTarget.addScaledVector(right, -dx * k).addScaledVector(up, dy * k); V.follow = null; }
    else { C.tYaw -= dx * 0.006; C.tPitch = Math.max(0.05, Math.min(1.5, C.tPitch + dy * 0.005)); }
  });
  const up = e => {
    const had = ptrs.delete(e.pointerId);
    if (!had) return;
    if (moved < 8 && performance.now() - downT < 500 && ptrs.size === 0) {
      const now = performance.now(), id = pickAt(e.clientX, e.clientY, e.pointerType === 'touch' ? 30 : 16);
      const dbl = now - lastTap.t < 380 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30;
      lastTap = { t: now, x: e.clientX, y: e.clientY };
      if (dbl && id) { V.onDbl && V.onDbl(id); } else V.onPick && V.onPick(id);
    }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', e => ptrs.delete(e.pointerId));
  canvas.addEventListener('wheel', e => { e.preventDefault(); V.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });

  // projection, labels, picking
  const rect = () => canvas.getBoundingClientRect();
  function project(v) { tmp.copy(v).project(cam); const r = rect(); return { x: (tmp.x * 0.5 + 0.5) * r.width, y: (-tmp.y * 0.5 + 0.5) * r.height, z: tmp.z, ok: tmp.z < 1 && tmp.z > -1 }; }
  function pickAt(px, py, radius) {
    const g = V.g; if (!g) return null; const r = rect(), x = px - r.left, y = py - r.top; let best = null, bd = radius; const w = new THREE.Vector3();
    const test = (id, weight, extra = 0) => { objPos(id, w); const p = project(w); if (!p.ok) return; const d = Math.hypot(p.x - x, p.y - y) * weight - extra; if (d < bd) { bd = d; best = id; } };
    for (const id of S.STATION_IDS) test(id, 0.7, 6);
    for (const s of Object.values(g.ships)) test(s.id, 0.8, 4);
    for (const a of g.ast) test(a.id, a.claim !== null ? 0.9 : 1);
    return best;
  }
  const pool = []; let poolN = 0;
  function label(text, x, y, cls) {
    let el = pool[poolN]; if (!el) { el = document.createElement('div'); labelLayer.appendChild(el); pool.push(el); }
    poolN++; el.className = 'tag ' + (cls || ''); if (el.textContent !== text) el.textContent = text; el.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`; el.style.display = 'block';
  }

  const w1 = new THREE.Vector3(), w2 = new THREE.Vector3();
  V.setGame = g => { V.g = g; for (const id in shipMesh) { scene.remove(shipMesh[id]); scene.remove(trailLine[id]); delete shipMesh[id]; delete trailLine[id]; } buildAsteroids(g); };
  V.resize = () => { const r = rect(); R.setSize(r.width, r.height, false); cam.aspect = r.width / r.height; };
  V.frame = () => {
    const g = V.g; if (!g) return;
    // smooth camera
    if (V.follow) C.tTarget.copy(objPos(V.follow, w1));
    const k = 0.16; C.target.lerp(C.tTarget, k); C.dist += (C.tDist - C.dist) * k; C.yaw += (C.tYaw - C.yaw) * k; C.pitch += (C.tPitch - C.pitch) * k; place();
    // bodies
    for (const id of Object.keys(BODY)) { objPos(id, bodies[id].position); if (id !== 'sun') bodies[id].rotation.y += 0.002; }
    sunGlow.position.set(0, 0, 0);
    for (const id of S.STATION_IDS) { objPos(id, stationRing[id].position); stationRing[id].position.y += BODY[id].r * 1.9; }
    // asteroids
    const uS = R.domElement.height / (2 * Math.tan(cam.fov * Math.PI / 360)); astPts.material.uniforms.uScale.value = uS; claimPts.material.uniforms.uScale.value = uS;
    const P = astPts.geometry.attributes.position.array, CP = claimPts.geometry.attributes.position.array, CC = claimPts.geometry.attributes.color.array, CS = claimPts.geometry.attributes.size.array;
    let nc = 0; const view = g.view;
    for (let i = 0; i < astN; i++) {
      const a = g.ast[i], ang = a.ph + TAU * g.t / (24 * a.P), x = Math.cos(ang) * a.a, y = Math.sin(ang) * a.a, ci = Math.cos(a.inc), si = Math.sin(a.inc);
      const px = x * SC, py = y * si * SC, pz = -y * ci * SC; P[i * 3] = px; P[i * 3 + 1] = py; P[i * 3 + 2] = pz;
      const known = C.dist < 110 && a.claim === null && (g.intel[view]?.[a.id]?.lvl || 0) >= 1;
      if (known) { CP[nc * 3] = px; CP[nc * 3 + 1] = py; CP[nc * 3 + 2] = pz; CC[nc * 3] = 0.28; CC[nc * 3 + 1] = 0.4; CC[nc * 3 + 2] = 0.52; CS[nc] = 0.55; nc++; }
      if (a.claim !== null) { CP[nc * 3] = px; CP[nc * 3 + 1] = py; CP[nc * 3 + 2] = pz; const col = new THREE.Color(g.companies[a.claim].color); CC[nc * 3] = col.r; CC[nc * 3 + 1] = col.g; CC[nc * 3 + 2] = col.b; CS[nc] = a.claim === view ? 1.2 : 0.8; nc++; }
    }
    astPts.geometry.attributes.position.needsUpdate = true; claimPts.geometry.setDrawRange(0, nc); ['position', 'color', 'size'].forEach(n => claimPts.geometry.attributes[n].needsUpdate = true);
    if (colDirty-- <= 0) { colDirty = 20; const col = astPts.geometry.attributes.color.array; const tc = new THREE.Color();
      for (let i = 0; i < astN; i++) { const it = g.intel[view]?.[g.ast[i].id]; tc.set(it && it.lvl >= 1 ? CLS_COL[g.ast[i].cls] : CLS_COL['?']); col[i * 3] = tc.r; col[i * 3 + 1] = tc.g; col[i * 3 + 2] = tc.b; }
      astPts.geometry.attributes.color.needsUpdate = true; }
    // the selected asteroid becomes a real rock when you are close
    const selA = V.sel && /^a\d+$/.test(V.sel) ? +V.sel.slice(1) : -1, sizes = astPts.geometry.attributes.size;
    if (rockIdx >= 0 && rockIdx !== selA) { const a0 = g.ast[rockIdx]; sizes.setX(rockIdx, 0.28 + Math.cbrt(a0.res0 / 1e6) * 0.5); sizes.needsUpdate = true; rockIdx = -1; }
    if (selA >= 0 && C.dist < 24) { const a = g.ast[selA]; objPos(V.sel, rock.position); const rad = (0.28 + Math.cbrt(a.res0 / 1e6) * 0.5) * 0.6; rock.scale.setScalar(rad); rock.rotation.y += 0.004; rock.material.color.set(CLS_COL[(g.intel[g.view]?.[a.id]?.lvl || 0) >= 1 ? a.cls : '?']); rock.visible = true; if (rockIdx !== selA) { sizes.setX(selA, 0.0001); sizes.needsUpdate = true; rockIdx = selA; } }
    else { rock.visible = false; if (rockIdx >= 0) { const a0 = g.ast[rockIdx]; sizes.setX(rockIdx, 0.28 + Math.cbrt(a0.res0 / 1e6) * 0.5); sizes.needsUpdate = true; rockIdx = -1; } }
    // ships
    const sk = Math.max(0.06, Math.min(1.6, C.dist * 0.0035));
    for (const s of Object.values(g.ships)) {
      const m = shipObj(s); v3(s.pos, m.position); const d = m.userData.dir, pv = m.userData.prev;
      if (m.position.distanceToSquared(pv) > 1e-10) { d.copy(m.position).sub(pv).normalize(); pv.copy(m.position); }
      m.quaternion.setFromUnitVectors(tmp.set(0, 1, 0), d); m.scale.setScalar(sk * (s.co === g.view ? 1.35 : 0.95) * (s.id === V.sel ? 1.4 : 1));
      m.material.color.set(g.companies[s.co]?.color || '#fff'); const tl = trailLine[s.id];
      if (s.state === 'travel' && s.trail.length > 6) { const arr = new Float32Array(s.trail.length); for (let i = 0; i < s.trail.length; i += 3) { arr[i] = s.trail[i] * SC; arr[i + 1] = s.trail[i + 2] * SC; arr[i + 2] = -s.trail[i + 1] * SC; } tl.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3)); tl.visible = true; } else tl.visible = false;
    }
    for (const id in shipMesh) if (!g.ships[id]) { scene.remove(shipMesh[id]); scene.remove(trailLine[id]); delete shipMesh[id]; delete trailLine[id]; }
    // selection ring and route
    if (V.sel && (V.sel[0] !== 'w' && V.sel[0] !== 'c' && V.sel[0] !== 'r')) { objPos(V.sel, selSprite.position); selSprite.visible = true; } else selSprite.visible = false;
    routeLine.visible = false;
    const s = V.sel && g.ships[V.sel];
    if (s) { const pts = [v3(s.pos)]; if (s.dest) pts.push(objPos(s.dest, new THREE.Vector3()));
      const steps = s.prog ? s.prog.steps : []; for (let k2 = 0; k2 < steps.length && pts.length < 7; k2++) { const st = steps[(s.prog.i + k2) % steps.length]; const loc = st.to || st.ast || st.loc; if (loc) { const p = objPos(loc, new THREE.Vector3()); if (p.distanceTo(pts[pts.length - 1]) > 0.05) pts.push(p); } }
      if (pts.length > 1) { routeLine.geometry.setFromPoints(pts); routeLine.computeLineDistances(); routeLine.visible = true; } }
    R.render(scene, cam);
    // labels
    poolN = 0; const r = rect();
    const put = (id, text, cls, dx = 8, dy = -18) => { const p = project(objPos(id, w2)); if (p.ok && p.x > -40 && p.x < r.width + 40 && p.y > -20 && p.y < r.height + 20) label(text, p.x + dx, p.y + dy, cls); };
    if (C.dist > 4) for (const id of ['earth', 'mars', 'ceres', 'moon']) if (id !== 'moon' || C.dist < 140) put(id, S.STATIONS[id].short, 'body', 10, -22);
    if (V.labels) {
      for (const sh of Object.values(g.ships)) if (sh.co === g.view || sh.id === V.sel) if (C.dist < 260 || sh.id === V.sel) put(sh.id, sh.name, sh.id === V.sel ? 'sel' : 'ship', 10, -6);
      if (C.dist < 90) { let n = 0; for (const a of g.ast) { if (n > 18) break; if (a.claim === g.view || a.id === V.sel) { put(a.id, a.name, a.id === V.sel ? 'sel' : 'claim', 10, -6); n++; } } }
      else if (V.sel && V.sel[0] === 'a') put(V.sel, g.ast[+V.sel.slice(1)].name, 'sel', 10, -6);
    }
    for (let i = poolN; i < pool.length; i++) pool[i].style.display = 'none';
  };
  V.camera = C;
  V.dispose = () => R.dispose();
  return V;
}
