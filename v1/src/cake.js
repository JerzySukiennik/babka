// Babka: two morphing halves (batter to risen loaf), crumb with a molten core, sprinkles, oven interior.
import * as THREE from 'three';
import { PAN, fbm, rand } from './kitchen.js';

const { Lt, Wt, Lb, Wb, H } = PAN;
const H0 = 0.46;
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const sx = y => Lb / Lt + (1 - Lb / Lt) * clamp(y / H, 0, 1.06);
const sz = y => Wb / Wt + (1 - Wb / Wt) * clamp(y / H, 0, 1.07);

export function topH(x, z, rise) {
  const nx = clamp(x / (Lt / 2), -1, 1), nz = clamp(z / (Wt / 2), -1, 1);
  const dome = Math.pow(Math.max(0, 1 - nx ** 6), 0.5) * Math.pow(Math.max(0, 1 - nz * nz), 0.42);
  const crack = 0.085 * Math.exp(-((nz - 0.07 * Math.sin(nx * 6.3)) ** 2) / 0.01) * Math.pow(Math.max(0, 1 - nx ** 4), 1.4);
  const risen = H * 0.97 + 0.4 * dome - crack + 0.02 * (fbm(nx * 3 + 4, nz * 3, 5, 2) - 0.5);
  return lerp(H0, risen, rise);
}

function surface(out, fn, nu, nv, expect) {
  const base = out.pos0.length / 3;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const a = fn(i / nu, j / nv, 0), b = fn(i / nu, j / nv, 1);
    out.pos0.push(a[0], a[1], a[2]); out.pos1.push(b[0], b[1], b[2]);
  }
  const P = k => new THREE.Vector3(out.pos1[(base + k) * 3], out.pos1[(base + k) * 3 + 1], out.pos1[(base + k) * 3 + 2]);
  const mi = Math.floor(nu / 2), mj = Math.floor(nv / 2), a = mj * (nu + 1) + mi;
  const n = new THREE.Vector3().subVectors(P(a + nu + 1), P(a)).cross(new THREE.Vector3().subVectors(P(a + 1), P(a)));
  const flip = n.dot(expect) < 0;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const p = base + j * (nu + 1) + i, q = p + nu + 1;
    if (flip) out.idx.push(p, p + 1, q, q, p + 1, q + 1); else out.idx.push(p, q, p + 1, q, q + 1, p + 1);
  }
}

function halfGeometry(sg) {
  const crust = { pos0: [], pos1: [], idx: [] };
  const NX = 40, NZ = 22, NY = 10, L2 = Lt / 2, W2 = Wt / 2;
  const P = (x, y, z) => [x * sx(y), y, z * sz(y)];
  surface(crust, (u, v, r) => { const x = sg * u * L2, z = (v - 0.5) * Wt; return P(x, topH(x, z, r), z); }, NX, NZ, new THREE.Vector3(0, 1, 0));
  for (const s of [-1, 1]) surface(crust, (u, v, r) => { const x = sg * u * L2, z = s * W2; return P(x, topH(x, z, r) * v, z); }, NX, NY, new THREE.Vector3(0, 0, s));
  surface(crust, (u, v, r) => { const x = sg * L2, z = (u - 0.5) * Wt; return P(x, topH(x, z, r) * v, z); }, NZ, NY, new THREE.Vector3(sg, 0, 0));
  surface(crust, (u, v) => P(sg * u * L2, 0.002, (v - 0.5) * Wt), 6, 4, new THREE.Vector3(0, -1, 0));
  const crustCount = crust.idx.length;
  surface(crust, (u, v, r) => { const z = (u - 0.5) * Wt; return P(0, topH(0, z, r) * v, z); }, NZ, 18, new THREE.Vector3(-sg, 0, 0));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(crust.pos0, 3));
  g.setIndex(crust.idx);
  g.computeVertexNormals();
  const t = new THREE.BufferGeometry();
  t.setAttribute('position', new THREE.Float32BufferAttribute(crust.pos1, 3));
  t.setIndex(crust.idx);
  t.computeVertexNormals();
  g.morphAttributes.position = [t.getAttribute('position')];
  g.morphAttributes.normal = [t.getAttribute('normal')];
  g.addGroup(0, crustCount, 0);
  g.addGroup(crustCount, crust.idx.length - crustCount, 1);
  return g;
}

const NOISE = `
vec3 L(vec3 c){ return pow(c, vec3(2.2)); }
float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hh(i), hh(i+vec2(1,0)), f.x), mix(hh(i+vec2(0,1)), hh(i+vec2(1,1)), f.x), f.y); }
`;

function withLocal(mat, key, uniforms, frag) {
  mat.onBeforeCompile = s => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader.replace('void main() {', 'varying vec3 vLocal;\nvoid main() {').replace('#include <morphtarget_vertex>', '#include <morphtarget_vertex>\n vLocal = transformed;');
    s.fragmentShader = s.fragmentShader.replace('void main() {', 'varying vec3 vLocal;\n' + Object.keys(uniforms).map(k => `uniform float ${k};`).join('\n') + NOISE + '\nvoid main() {').replace('#include <color_fragment>', '#include <color_fragment>\n' + frag).replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = rough;');
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

export function makeCake() {
  const u = { uBaked: { value: 0 } };
  const crustMat = withLocal(new THREE.MeshStandardMaterial({ color: 0xffffff, envMapIntensity: 0.45 }), 'crust', u, `
    float n = vn(vLocal.xz * 11.0) * 0.6 + vn(vLocal.xz * 37.0 + vLocal.y * 9.0) * 0.4;
    vec3 batter = mix(L(vec3(0.16, 0.085, 0.05)), L(vec3(0.22, 0.12, 0.07)), n);
    vec3 crust = mix(L(vec3(0.43, 0.28, 0.18)), L(vec3(0.29, 0.17, 0.1)), n);
    crust = mix(crust, L(vec3(0.52, 0.37, 0.25)), smoothstep(0.75, 0.2, vLocal.y) * 0.5);
    diffuseColor.rgb = mix(batter, crust, uBaked);
    float rough = mix(0.16, 0.88 - n * 0.1, uBaked);`);
  const crumbMat = withLocal(new THREE.MeshStandardMaterial({ color: 0xffffff, envMapIntensity: 0.5 }), 'crumb', {}, `
    vec2 q = vLocal.zy;
    float p1 = vn(q * 38.0), p2 = vn(q * 95.0 + 3.0);
    float pore = smoothstep(0.6, 0.72, p1 * 0.62 + p2 * 0.38);
    vec3 crumb = mix(L(vec3(0.36, 0.29, 0.26)), L(vec3(0.27, 0.21, 0.18)), vn(q * 9.0));
    crumb *= 1.0 - pore * 0.55;
    float e = length((q - vec2(0.0, 0.5)) / vec2(0.25, 0.18)) + (vn(q * 13.0) - 0.5) * 0.35;
    float molten = 1.0 - smoothstep(0.82, 1.0, e);
    vec3 lava = mix(L(vec3(0.06, 0.025, 0.012)), L(vec3(0.14, 0.06, 0.03)), vn(q * 22.0));
    diffuseColor.rgb = mix(crumb, lava, molten);
    float rough = mix(0.92, 0.1, molten);`);
  const spGeo = new THREE.BoxGeometry(0.052, 0.014, 0.017);
  const spMat = new THREE.MeshStandardMaterial({ color: 0x1a0d07, roughness: 0.5, envMapIntensity: 0.3 });
  const group = new THREE.Group();
  const halves = [];
  for (const sg of [-1, 1]) {
    const hg = new THREE.Group();
    const mesh = new THREE.Mesh(halfGeometry(sg), [crustMat, crumbMat]);
    mesh.morphTargetInfluences = [0];
    mesh.castShadow = mesh.receiveShadow = true;
    const N = 430, sp = new THREE.InstancedMesh(spGeo, spMat, N);
    sp.castShadow = true; sp.frustumCulled = false; sp.visible = false;
    const seeds = [];
    for (let i = 0; i < N; i++) seeds.push({ x: sg * (0.02 + rand() * 0.95) * Lt / 2 * 0.95, z: (rand() - 0.5) * Wt * 0.86, yaw: rand() * 6.28, tilt: (rand() - 0.5) * 0.6, s: 0.5 + rand() * 0.9, d: rand() });
    hg.add(mesh, sp);
    hg.userData = { mesh, sp, seeds, sg };
    group.add(hg);
    halves.push(hg);
  }
  const bridgePts = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24; bridgePts.push(new THREE.Vector2(1 - 0.78 * Math.pow(Math.sin(Math.PI * t), 0.7), t - 0.5)); }
  const bridge = new THREE.Mesh(new THREE.LatheGeometry(bridgePts, 24), new THREE.MeshPhysicalMaterial({ color: 0x120804, roughness: 0.08, clearcoat: 1 }));
  bridge.rotation.z = -Math.PI / 2; bridge.visible = false; bridge.position.y = 0.5;
  group.add(bridge);
  const drops = [];
  for (let i = 0; i < 2; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), bridge.material); d.visible = false; group.add(d); drops.push(d); }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const api = {
    group, halves, bridge, drops, crustMat, uniforms: u, rise: 0,
    setRise(r) { api.rise = r; for (const h of halves) h.userData.mesh.morphTargetInfluences[0] = r; },
    setBaked(b) { u.uBaked.value = b; },
    setSprinkles(p, bounceT = 0) {
      for (const h of halves) {
        const { sp, seeds } = h.userData;
        sp.visible = p > 0;
        seeds.forEach((sd, i) => {
          const t = clamp((p * 1.7 - sd.d * 0.7) / 0.5, 0, 1);
          const y0 = topH(sd.x, sd.z, api.rise);
          const fall = (1 - t) * (1 - t) * 3.2;
          const bounce = t >= 1 ? 0 : Math.abs(Math.sin(t * 9)) * (1 - t) * 0.05;
          v.set(sd.x * sx(y0), y0 + 0.01 + fall + bounce, sd.z * sz(y0));
          e.set(sd.tilt + fall * 2, sd.yaw + fall * 3, sd.tilt * 0.5); q.setFromEuler(e);
          s.setScalar(t > 0 || p >= 1 ? sd.s : 0.0001);
          m4.compose(v, q, s); sp.setMatrixAt(i, m4);
        });
        sp.instanceMatrix.needsUpdate = true;
      }
    },
    setGap(d) {
      halves[0].position.x = -d / 2; halves[1].position.x = d / 2;
      const show = d > 0.01 && d < 0.95;
      bridge.visible = show;
      if (show) { const k = 1 - d / 0.95; bridge.scale.set(Math.max(0.05, 0.16 * Math.pow(k, 0.6)), d + 0.02, Math.max(0.05, 0.16 * Math.pow(k, 0.6))); }
    },
  };
  return api;
}

function enamel() {
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x = cv.getContext('2d'); x.fillStyle = '#15161a'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${150 + rand() * 60 | 0},${150 + rand() * 60 | 0},${165 + rand() * 60 | 0},${0.08 + rand() * 0.25})`; x.fillRect(rand() * S, rand() * S, 1 + rand(), 1 + rand()); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.42, metalness: 0.1 });
}

export const OVEN = new THREE.Vector3(60, 0, 0);

export function ovenSet() {
  const g = new THREE.Group(); g.position.copy(OVEN);
  const en = enamel();
  const wall = (w, h, pos, rot) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), en); m.position.copy(pos); m.rotation.set(...rot); m.receiveShadow = true; g.add(m); return m; };
  wall(8, 5, new THREE.Vector3(0, 1.4, -1.9), [0, 0, 0]);
  wall(6, 5, new THREE.Vector3(-3.1, 1.4, 0.6), [0, Math.PI / 2, 0]);
  wall(6, 5, new THREE.Vector3(3.1, 1.4, 0.6), [0, -Math.PI / 2, 0]);
  wall(8, 6, new THREE.Vector3(0, 3.2, 0.6), [Math.PI / 2, 0, 0]);
  wall(8, 6, new THREE.Vector3(0, -0.7, 0.6), [-Math.PI / 2, 0, 0]);
  const metal = new THREE.MeshStandardMaterial({ color: 0xc9b79c, metalness: 0.7, roughness: 0.32 });
  const tray = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.05, 3.1), metal); tray.position.set(0, -0.03, 0.15); tray.receiveShadow = true; g.add(tray);
  for (const s of [-1, 1]) for (const y of [0.4, 1.3, 2.2]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 3.6), en); r.position.set(s * 3.05, y, 0.3); g.add(r); }
  const rods = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.018, 5.9, 8), new THREE.MeshStandardMaterial({ color: 0xd8d4cc, metalness: 1, roughness: 0.3 }), 13);
  for (let i = 0; i < 13; i++) { const m = new THREE.Matrix4().makeRotationZ(Math.PI / 2); m.setPosition(0, -0.08, -1.3 + i * 0.24); rods.setMatrixAt(i, m); }
  g.add(rods);
  const pts = [];
  for (let i = 0; i <= 14; i++) pts.push(new THREE.Vector3(-2.6 + (i / 14) * 5.2, 2.85, i % 2 ? -1.2 : 1.4));
  const elMat = new THREE.MeshStandardMaterial({ color: 0x220a04, emissive: 0xff4a12, emissiveIntensity: 0, roughness: 0.6 });
  const el = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 260, 0.035, 8, false), elMat);
  g.add(el);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.3, metalness: 0.5 });
  for (const [w, h, x, y] of [[9, 0.5, 0, 2.95], [9, 0.6, 0, -0.62], [0.5, 4, -2.9, 1.2], [0.5, 4, 2.9, 1.2]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), frameMat); f.position.set(x, y, 2.75); g.add(f); }
  const top = new THREE.PointLight(0xffa25a, 0, 0, 2); top.position.set(0, 2.5, 0.5); g.add(top);
  const fill = new THREE.PointLight(0xff7a35, 0, 0, 2); fill.position.set(0.6, 0.6, 2.3); g.add(fill);
  return { group: g, top, fill, elMat };
}
