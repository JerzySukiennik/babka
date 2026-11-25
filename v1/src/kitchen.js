// Procedural kitchen props: counter, bowls, eggs, whisk, knife, loaf tin, parchment.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const rand = (() => { let s = 1337; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();

function vnoise(x, y, seed = 0) {
  const h = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(h(xi, yi), h(xi + 1, yi), u), THREE.MathUtils.lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}
export function fbm(x, y, seed = 0, oct = 4) { let a = 0, f = 1, w = 0.5; for (let i = 0; i < oct; i++) { a += w * vnoise(x * f, y * f, seed + i * 13); f *= 2.03; w *= 0.5; } return a; }

export function environment(renderer, scene) {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.75;
  pm.dispose();
}

export function counter(renderer) {
  const S = 2048, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#d6d4cf'; g.fillRect(0, 0, S, S);
  const img = g.getImageData(0, 0, S, S), d = img.data;
  for (let y = 0; y < S; y += 4) for (let x = 0; x < S; x += 4) {
    const n = (fbm(x / 340, y / 340, 3, 3) - 0.5) * 16;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const k = ((y + j) * S + x + i) * 4; d[k] += n; d[k + 1] += n; d[k + 2] += n * 0.9; }
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 52000; i++) {
    const x = rand() * S, y = rand() * S, r = rand() < 0.93 ? 0.6 + rand() * 1.1 : 1.6 + rand() * 1.8;
    const t = rand();
    g.fillStyle = t < 0.55 ? `rgba(${110 + rand() * 40 | 0},${106 + rand() * 40 | 0},${100 + rand() * 40 | 0},${0.35 + rand() * 0.5})` : t < 0.85 ? `rgba(245,244,240,${0.5 + rand() * 0.5})` : `rgba(60,58,56,${0.4 + rand() * 0.4})`;
    g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 4);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0 }));
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true;
  return m;
}

function lathe(pts, seg = 96) { return new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg); }

export function steelBowl() {
  const R = 1.45, H = 0.92, B = 0.55, T = 0.022, pts = [[0, 0.004]];
  const prof = a => [B + (R - B) * Math.sin(a), H * (1 - Math.cos(a))];
  for (let i = 0; i <= 28; i++) pts.push(prof((i / 28) * Math.PI / 2));
  pts.push([R + 0.05, H + 0.012], [R + 0.075, H - 0.012], [R + 0.05, H - 0.03]);
  for (let i = 28; i >= 0; i--) { const [r, y] = prof((i / 28) * Math.PI / 2); pts.push([r - T, y + T * 0.8]); }
  pts.push([0, T]);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xaeb2b7, metalness: 1, roughness: 0.26, anisotropy: 0.85, anisotropyRotation: Math.PI / 2, envMapIntensity: 1.05 });
  const bowl = new THREE.Mesh(lathe(pts, 112), mat);
  bowl.castShadow = bowl.receiveShadow = true;
  const g = new THREE.Group(); g.add(bowl);
  g.userData = { R, H, B, T, innerAt: y => { const a = Math.acos(THREE.MathUtils.clamp(1 - y / H, -1, 1)); return B + (R - B) * Math.sin(a) - T; } };
  return g;
}

export function redBowl() {
  const R = 1.0, H = 0.62, B = 0.4, T = 0.05, pts = [[0, 0.003], [B - 0.04, 0.003], [B - 0.03, 0.05]];
  const prof = a => [B + (R - B) * Math.sin(a), 0.05 + (H - 0.05) * (1 - Math.cos(a))];
  for (let i = 0; i <= 22; i++) pts.push(prof((i / 22) * Math.PI / 2));
  pts.push([R + 0.02, H + 0.02], [R - T * 0.5, H + 0.03]);
  for (let i = 22; i >= 0; i--) { const [r, y] = prof((i / 22) * Math.PI / 2); pts.push([r - T, y + T]); }
  pts.push([0, 0.05 + T]);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xa30e1c, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });
  mat.onBeforeCompile = s => {
    s.fragmentShader = s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 dq = vec2(vDotUv.x * 26.0, vDotUv.y * 9.0);
      vec2 cell = floor(dq); vec2 f = fract(dq + vec2(mod(cell.y, 2.0) * 0.5, 0.0)) - 0.5;
      float dot_ = 1.0 - smoothstep(0.17, 0.2, length(f * vec2(1.0, 1.15)));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97, 0.95, 0.92), dot_ * step(0.06, vDotUv.y));`).replace('void main() {', 'varying vec2 vDotUv;\nvoid main() {');
    s.vertexShader = s.vertexShader.replace('void main() {', 'varying vec2 vDotUv;\nvoid main() {\n vDotUv = uv;');
  };
  mat.customProgramCacheKey = () => 'polka';
  const bowl = new THREE.Mesh(lathe(pts, 96), mat);
  bowl.castShadow = bowl.receiveShadow = true;
  const choc = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshPhysicalMaterial({ color: 0x1e0d07, roughness: 0.3, clearcoat: 0.25, envMapIntensity: 0.35 }));
  choc.rotation.x = -Math.PI / 2; choc.position.y = 0.42; choc.scale.setScalar(0.86); choc.userData.noEcho = false;
  const g = new THREE.Group(); g.add(bowl, choc);
  g.userData = { R, H, choc };
  return g;
}

export function batterMaterial() {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(cv);
  const u = { uFoam: { value: 0 }, uChoc: { value: tex }, uTwist: { value: 0 }, uMix: { value: 0 }, uTime: { value: 0 }, uRaw: { value: 1 } };
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, envMapIntensity: 0.28 });
  mat.onBeforeCompile = s => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader.replace('void main() {', 'varying vec2 vQ;\nvoid main() {\n vQ = position.xy;');
    s.fragmentShader = s.fragmentShader.replace('void main() {', `varying vec2 vQ; uniform float uFoam, uTwist, uMix, uTime, uRaw; uniform sampler2D uChoc;
      vec3 L(vec3 c){ return pow(c, vec3(2.2)); }
      float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hh(i), hh(i+vec2(1,0)), f.x), mix(hh(i+vec2(0,1)), hh(i+vec2(1,1)), f.x), f.y); }
      void main() {`).replace('#include <color_fragment>', `#include <color_fragment>
      float r = length(vQ);
      float a = uTwist * (1.0 - r) * 0.35;
      vec2 qt = mat2(cos(a), -sin(a), sin(a), cos(a)) * vQ;
      float ch = texture2D(uChoc, qt * 0.5 + 0.5).r;
      ch = mix(ch, 1.0, uMix);
      float n = vn(vQ * 9.0 + uTime * 0.05) * 0.6 + vn(vQ * 31.0) * 0.4;
      vec3 raw = mix(L(vec3(0.86, 0.84, 0.76)), L(vec3(0.98, 0.62, 0.12)), smoothstep(0.35, 0.75, vn(vQ * 3.0 + 4.0)));
      vec3 foam = mix(L(vec3(0.99, 0.93, 0.76)), L(vec3(0.93, 0.83, 0.58)), n * 0.6);
      vec3 base = mix(raw, foam, uFoam);
      vec3 dark = mix(L(vec3(0.13, 0.06, 0.03)), L(vec3(0.22, 0.12, 0.07)), n);
      vec3 mixed = mix(L(vec3(0.36, 0.22, 0.14)), L(vec3(0.3, 0.18, 0.11)), n);
      vec3 cc = mix(dark, mixed, uMix);
      diffuseColor.rgb = mix(base, cc, smoothstep(0.0, 0.55, ch));
      float rough = mix(mix(0.12, 0.72, uFoam), 0.38, ch);`).replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = rough;');
  };
  mat.customProgramCacheKey = () => 'batter';
  mat.userData = { u, canvas: cv, ctx, tex };
  return mat;
}

export function eggParts() {
  const H = 0.56, W = 0.43;
  const rad = t => (W / 2) * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) * (1 - 0.16 * (t - 0.5));
  const whole = [];
  for (let i = 0; i <= 32; i++) { const t = i / 32; whole.push([rad(t), t * H]); }
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xcf9168, roughness: 0.55, side: THREE.DoubleSide });
  shellMat.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n if (!gl_FrontFacing) diffuseColor.rgb = vec3(0.96, 0.93, 0.87);'); };
  shellMat.customProgramCacheKey = () => 'shell';
  const cut = th => 0.5 + 0.07 * Math.abs(((th / (Math.PI * 2)) * 9) % 1 - 0.5) * 2;
  const half = (top) => {
    const S = 48, M = 10, pos = [], idx = [];
    for (let j = 0; j <= M; j++) for (let i = 0; i <= S; i++) {
      const th = (i / S) * Math.PI * 2, c = cut(th);
      const t = top ? THREE.MathUtils.lerp(c, 1, j / M) : THREE.MathUtils.lerp(0, c, j / M);
      const r = rad(t);
      pos.push(Math.cos(th) * r, t * H, Math.sin(th) * r);
    }
    for (let j = 0; j < M; j++) for (let i = 0; i < S; i++) { const a = j * (S + 1) + i, b = a + S + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  };
  return {
    H, W, shellMat,
    whole: lathe(whole, 40), bottom: half(false), top: half(true),
    yolk: new THREE.SphereGeometry(0.14, 32, 20),
    yolkMat: new THREE.MeshPhysicalMaterial({ color: 0xff8a0c, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }),
    white: new THREE.SphereGeometry(0.27, 28, 14),
    whiteMat: new THREE.MeshPhysicalMaterial({ color: 0xfbf6e8, roughness: 0.05, transparent: true, opacity: 0.38, depthWrite: false }),
  };
}

export function whisk() {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 1.3, 24), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.5 }));
  handle.position.y = 0.65; handle.castShadow = true; g.add(handle);
  const steel = new THREE.MeshStandardMaterial({ color: 0xd8dadd, metalness: 1, roughness: 0.25 });
  const geos = [];
  for (let k = 0; k < 8; k++) {
    const pts = [];
    for (let i = 0; i <= 40; i++) { const u = (i / 40) * Math.PI * 2; pts.push(new THREE.Vector3(0.48 * Math.sin(u) * (1 - Math.cos(u)) / 2 * 1.6, -1.25 * (1 - Math.cos(u)) / 2, 0)); }
    const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.009, 5, false);
    tg.rotateY((k / 8) * Math.PI);
    geos.push(tg);
  }
  const wires = new THREE.Mesh(mergeGeometries(geos), steel); wires.castShadow = true;
  g.add(wires);
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.18, 20), steel); ferrule.position.y = -0.02; g.add(ferrule);
  return g;
}

export function knife() {
  const g = new THREE.Group();
  const sh = new THREE.Shape();
  sh.moveTo(0, 0); sh.lineTo(1.85, 0); sh.quadraticCurveTo(2.12, -0.06, 2.2, -0.34); sh.quadraticCurveTo(1.9, -0.4, 1.5, -0.4); sh.lineTo(0, -0.4); sh.closePath();
  const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.006, bevelSegments: 1 });
  bg.translate(0, 0, -0.006);
  const blade = new THREE.Mesh(bg, new THREE.MeshPhysicalMaterial({ color: 0xe8eaec, metalness: 1, roughness: 0.16, anisotropy: 0.6 }));
  blade.castShadow = true;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.26, 0.08), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.45 }));
  handle.position.set(-0.5, -0.17, 0); handle.castShadow = true;
  g.add(blade, handle);
  for (const x of [-0.2, -0.5, -0.8]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 12), new THREE.MeshStandardMaterial({ color: 0xcfd2d6, metalness: 1, roughness: 0.3 })); r.rotation.x = Math.PI / 2; r.position.set(x, -0.17, 0); g.add(r); }
  return g;
}

export const PAN = { Lt: 2.72, Wt: 1.22, Lb: 2.46, Wb: 0.98, H: 0.82 };

function quadGrid(p00, p10, p01, p11, su, sv, amp, seed) {
  const pos = [], idx = [], A = new THREE.Vector3(), B = new THREE.Vector3(), P = new THREE.Vector3(), N = new THREE.Vector3();
  N.subVectors(p10, p00).cross(new THREE.Vector3().subVectors(p01, p00)).normalize();
  for (let j = 0; j <= sv; j++) for (let i = 0; i <= su; i++) {
    const u = i / su, v = j / sv;
    A.lerpVectors(p00, p10, u); B.lerpVectors(p01, p11, u); P.lerpVectors(A, B, v);
    const edge = Math.min(u, 1 - u, v, 1 - v) < 0.001 ? 0.4 : 1;
    const n = (Math.abs(fbm(u * 6 + seed, v * 4, seed, 3) - 0.5) * 2 - 0.3) * amp * edge;
    pos.push(P.x + N.x * n, P.y + N.y * n, P.z + N.z * n);
  }
  for (let j = 0; j < sv; j++) for (let i = 0; i < su; i++) { const a = j * (su + 1) + i, b = a + su + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function loafPan() {
  const { Lt, Wt, Lb, Wb, H } = PAN, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const b = [V(-Lb / 2, 0.02, -Wb / 2), V(Lb / 2, 0.02, -Wb / 2), V(Lb / 2, 0.02, Wb / 2), V(-Lb / 2, 0.02, Wb / 2)];
  const t = [V(-Lt / 2, H, -Wt / 2), V(Lt / 2, H, -Wt / 2), V(Lt / 2, H, Wt / 2), V(-Lt / 2, H, Wt / 2)];
  const geos = [quadGrid(b[0], b[1], b[3], b[2], 1, 1, 0, 0)];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; geos.push(quadGrid(b[i], b[j], t[i], t[j], 1, 1, 0, 0)); }
  const R = 0.07;
  const o = [V(-Lt / 2 - R, H, -Wt / 2 - R), V(Lt / 2 + R, H, -Wt / 2 - R), V(Lt / 2 + R, H, Wt / 2 + R), V(-Lt / 2 - R, H, Wt / 2 + R)];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; geos.push(quadGrid(t[i], t[j], o[i], o[j], 1, 1, 0, 0)); }
  const geo = mergeGeometries(geos.map(g => g.toNonIndexed())); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x5a5c60, metalness: 0.85, roughness: 0.33, side: THREE.DoubleSide }));
  mesh.castShadow = mesh.receiveShadow = true;
  const liner = linerMesh();
  const g = new THREE.Group(); g.add(mesh, liner);
  g.userData = { mesh, liner };
  return g;
}

export function parchmentMaterial(stained = false) {
  const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x = cv.getContext('2d');
  x.fillStyle = '#dcc6a4'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${150 + rand() * 60 | 0},${110 + rand() * 40 | 0},${70 + rand() * 30 | 0},${0.04 + rand() * 0.06})`; x.beginPath(); x.arc(rand() * S, rand() * S, 6 + rand() * 50, 0, 6.283); x.fill(); }
  if (stained) {
    const N = 512, sc = document.createElement('canvas'); sc.width = sc.height = N;
    const sx = sc.getContext('2d'), id = sx.createImageData(N, N), d = id.data;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const u = i / N - 0.5, v = j / N - 0.5;
      const box = Math.max(Math.abs(u) / 0.36, Math.abs(v) / 0.27);
      const n = fbm(i / 60, j / 60, 11, 4), n2 = fbm(i / 14, j / 14, 3, 2);
      const st = Math.max(0, Math.min(1, (1.25 - box + (n - 0.5) * 1.1) * 1.6)) * (0.55 + n2 * 0.6);
      const k = (j * N + i) * 4;
      d[k] = 74 + n2 * 30; d[k + 1] = 44 + n2 * 18; d[k + 2] = 26 + n2 * 10; d[k + 3] = Math.min(255, st * st * 150);
    }
    sx.putImageData(id, 0, 0);
    x.drawImage(sc, 0, 0, S, S);
    for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(25,14,8,${0.35 + rand() * 0.5})`; const a = rand() * 6.283, rr = Math.pow(rand(), 0.5) * S * 0.46; x.fillRect(S / 2 + Math.cos(a) * rr * 1.3, S / 2 + Math.sin(a) * rr * 0.8, 1 + rand() * 4, 1 + rand() * 3); }
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.86, side: THREE.DoubleSide });
}

function linerMesh() {
  const { Lt, Wt, Lb, Wb, H } = PAN, V = (x, y, z) => new THREE.Vector3(x, y, z), e = 0.015;
  const b = [V(-Lb / 2 + e, 0.035, -Wb / 2 + e), V(Lb / 2 - e, 0.035, -Wb / 2 + e), V(Lb / 2 - e, 0.035, Wb / 2 - e), V(-Lb / 2 + e, 0.035, Wb / 2 - e)];
  const t = [V(-Lt / 2 + e, H + 0.12, -Wt / 2 + e), V(Lt / 2 - e, H + 0.12, -Wt / 2 + e), V(Lt / 2 - e, H + 0.12, Wt / 2 - e), V(-Lt / 2 + e, H + 0.12, Wt / 2 - e)];
  const geos = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, long = i % 2 === 0;
    geos.push(quadGrid(b[i], b[j], t[i], t[j], long ? 28 : 12, 10, 0.02, i * 3.7));
    const c = (k) => { const p = t[k].clone(); const d = p.clone().setY(0); d.x = Math.sign(d.x) * 0.24; d.z = Math.sign(d.z) * 0.26; return p.add(d).add(new THREE.Vector3(0, 0.08 + rand() * 0.06, 0)); };
    geos.push(quadGrid(t[i], t[j], c(i), c(j), long ? 28 : 12, 5, 0.035, i * 5.1 + 2));
  }
  const geo = mergeGeometries(geos.map(g => g.toNonIndexed())); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, parchmentMaterial(false));
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function crumpledSheet() {
  const W = 4.6, D = 3.0, su = 90, sv = 60, pos = [], idx = [], uv = [];
  for (let j = 0; j <= sv; j++) for (let i = 0; i <= su; i++) {
    const u = i / su, v = j / sv, x = (u - 0.5) * W, z = (v - 0.5) * D;
    const ridge = Math.abs(fbm(u * 5, v * 4, 9, 4) - 0.5) * 2;
    const edge = Math.min(u, 1 - u, v, 1 - v);
    const lift = Math.max(0, 0.12 - edge) * 0.9;
    const y = 0.006 + (1 - ridge) * 0.035 + lift * (0.5 + fbm(u * 9, v * 9, 4, 2)) + fbm(u * 30, v * 22, 2, 2) * 0.008;
    const pull = (0.04 + 0.06 * fbm(u * 3, v * 3, 7, 2)) * Math.max(0, 0.15 - edge) * 6;
    pos.push(x * (1 - pull * 0.1), y, z * (1 - pull * 0.1)); uv.push(u, v);
  }
  for (let j = 0; j < sv; j++) for (let i = 0; i < su; i++) { const a = j * (su + 1) + i, b = a + su + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, parchmentMaterial(true)); m.receiveShadow = true; m.castShadow = true;
  return m;
}

export function streamMesh(color) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 14, 40, true);
  const u = { p0: { value: new THREE.Vector3() }, p1: { value: new THREE.Vector3() }, p2: { value: new THREE.Vector3() }, r0: { value: 0.09 }, r1: { value: 0.05 }, uTime: { value: 0 }, amt: { value: 1 } };
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.2, envMapIntensity: 0.35 });
  mat.onBeforeCompile = s => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader.replace('void main() {', `uniform vec3 p0, p1, p2; uniform float r0, r1, uTime, amt;
      vec3 bz(float t){ return mix(mix(p0, p1, t), mix(p1, p2, t), t); }
      void main() {`).replace('#include <beginnormal_vertex>', `
      float t = clamp(0.5 - position.y, 0.0, 1.0);
      float tt = t * amt;
      vec3 c = bz(tt);
      vec3 tg = normalize(bz(min(tt + 0.01, 1.0)) - bz(max(tt - 0.01, 0.0)) + vec3(0.0, -1e-4, 0.0));
      vec3 sd = normalize(cross(tg, vec3(0.0, 0.0, 1.0)) + vec3(1e-4, 0.0, 0.0));
      vec3 up = normalize(cross(sd, tg));
      float wob = 1.0 + 0.18 * sin(t * 40.0 - uTime * 14.0);
      float rr = mix(r0, r1, sqrt(t)) * wob;
      vec3 objectNormal = normalize(sd * position.x + up * position.z);`).replace('#include <begin_vertex>', 'vec3 transformed = c + (sd * position.x + up * position.z) * rr;');
  };
  mat.customProgramCacheKey = () => 'stream';
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.castShadow = true; m.visible = false;
  m.layers.set(1);
  m.userData.u = u;
  return m;
}
