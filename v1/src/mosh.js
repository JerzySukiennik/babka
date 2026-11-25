// Datamosh pipeline: real motion vectors, error transport, brush smear, echo stacks.
import * as THREE from 'three';

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const COMMON = `
varying vec2 vUv;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
vec3 toYUV(vec3 c){ return vec3(dot(c, vec3(0.299, 0.587, 0.114)), dot(c, vec3(-0.14713, -0.28886, 0.436)), dot(c, vec3(0.615, -0.51499, -0.10001))); }
vec3 toRGB(vec3 y){ return vec3(y.x + 1.13983 * y.z, y.x - 0.39465 * y.y - 0.58060 * y.z, y.x + 2.03211 * y.y); }
`;

const ENCODE = `
uniform sampler2D tScene; uniform float exposure;
varying vec2 vUv;
vec3 fitRRT(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 c){
  const mat3 IM = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 OM = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  c *= exposure / 0.6; c = IM * c; c = fitRRT(c); c = OM * c; return clamp(c, 0.0, 1.0);
}
vec3 srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main(){ gl_FragColor = vec4(srgb(aces(texture2D(tScene, vUv).rgb)), 1.0); }
`;

const BRUSH = `
uniform sampler2D tB; uniform vec2 p0, p1; uniform float radius, strength, decay, aspect;
varying vec2 vUv;
void main(){
  vec4 b = texture2D(tB, vUv);
  b.xyz *= decay;
  vec2 k = vec2(aspect, 1.0);
  vec2 pa = (vUv - p0) * k, ba = (p1 - p0) * k;
  float hh = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-7), 0.0, 1.0);
  float d = length(pa - ba * hh);
  float w = exp(-d * d / (radius * radius)) * strength;
  b.xy = mix(b.xy, (p1 - p0) * 1.35, clamp(w, 0.0, 1.0));
  b.z = max(b.z, w);
  gl_FragColor = b;
}
`;

const MOSH = COMMON + `
uniform sampler2D tD, tCur, tPrevC, tVel, tBrush;
uniform vec2 res; uniform float block, gain, residual, keep, glitch, creep, hue, frame, intra, quant, drift;
vec3 blockAvg(sampler2D t, vec2 bc){
  vec2 q = block * 0.25 / res;
  return 0.25 * (texture2D(t, bc + vec2(-q.x, -q.y)).rgb + texture2D(t, bc + vec2(q.x, -q.y)).rgb + texture2D(t, bc + vec2(-q.x, q.y)).rgb + texture2D(t, bc + vec2(q.x, q.y)).rgb);
}
void main(){
  vec2 px = vUv * res;
  vec2 bid = floor(px / block);
  vec2 bc = (bid + 0.5) * block / res;
  vec2 v = texture2D(tVel, bc).xy;
  vec3 br = texture2D(tBrush, vUv).xyz;
  float fr = floor(frame);
  float hb = h21(bid + fract(fr * 0.0173) * 91.0);
  vec2 junk = vec2(0.0);
  if (hb < glitch * 0.06) junk = (vec2(h21(bid + 3.1 + fr), h21(bid + 7.7 - fr)) - 0.5) * vec2(0.3, 0.12);
  vec2 fp = bc * vec2(res.x / res.y, 1.0) * 2.3;
  float tt = fr * 0.004;
  vec2 dr = (vec2(vn(fp + vec2(tt, 3.1)) + 0.5 * vn(fp * 2.7 - tt), vn(fp + vec2(8.3, -tt)) + 0.5 * vn(fp * 2.9 + 5.0 + tt)) - 0.75) * 2.6 * drift / res;
  vec2 m0 = v;
  vec2 m = v * gain + br.xy + junk + dr;
  vec3 cur = texture2D(tCur, vUv).rgb;
  if (h21(bid * 1.13 + fract(fr * 0.031) * 37.0) < quant) cur = mix(cur, blockAvg(tCur, bc), 0.85);
  vec3 pred = texture2D(tD, vUv - m).rgb;
  vec3 ref = texture2D(tPrevC, vUv - m0).rgb;
  vec3 err = pred + residual * (cur - ref) - cur;
  float e = clamp(length(err) * 3.0, 0.0, 1.0);
  if (hue > 0.001 || creep > 0.001) {
    vec3 y = toYUV(err);
    float a = hue * e;
    y.yz = mat2(cos(a), sin(a), -sin(a), cos(a)) * y.yz * (1.0 + creep * 2.5 * e);
    err = toRGB(y);
  }
  float k = max(keep, br.z * 0.985);
  if (h21(bid * 1.71 + fract(fr * 0.0131) * 53.0) < intra) k = 0.0;
  gl_FragColor = vec4(clamp(cur + err * k, 0.0, 1.0), 1.0);
}
`;

const SHOW = COMMON + `
uniform sampler2D tD; uniform vec2 res; uniform float tear, split, frame, flash;
void main(){
  vec2 uv = vUv;
  float row = floor(uv.y * res.y / 6.0);
  float r = h21(vec2(row, floor(frame * 0.5)));
  if (r < tear * 0.12) uv.x += (h21(vec2(row, frame)) - 0.5) * 0.18 * tear;
  vec3 c;
  if (split > 0.001) {
    vec2 o = vec2(split * 0.012, 0.0);
    c = vec3(texture2D(tD, uv + o).r, texture2D(tD, uv).g, texture2D(tD, uv - o).b);
  } else c = texture2D(tD, uv).rgb;
  c = mix(c, vec3(1.0) - c, flash);
  gl_FragColor = vec4(c, 1.0);
}
`;

const VEL_V = `
uniform mat4 prevModel; uniform mat4 prevViewProj;
varying vec4 vCur; varying vec4 vPrev;
void main(){
  vec4 p = vec4(position, 1.0);
  #ifdef USE_INSTANCING
  p = instanceMatrix * p;
  #endif
  vCur = projectionMatrix * viewMatrix * modelMatrix * p;
  vPrev = prevViewProj * prevModel * p;
  gl_Position = vCur;
}
`;
const VEL_F = `
varying vec4 vCur; varying vec4 vPrev;
void main(){ vec2 a = vCur.xy / vCur.w; vec2 b = vPrev.xy / max(vPrev.w, 1e-4); gl_FragColor = vec4(clamp((a - b) * 0.5, -0.5, 0.5), 0.0, 1.0); }
`;

function rt(w, h, opt = {}) {
  return new THREE.WebGLRenderTarget(w, h, {
    type: opt.type ?? THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: !!opt.depth,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, samples: opt.samples ?? 0,
    wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
  });
}

export class Mosh {
  constructor(renderer) {
    this.r = renderer;
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    const mk = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.encode = mk(ENCODE, { tScene: { value: null }, exposure: { value: 1 } });
    this.brushMat = mk(BRUSH, { tB: { value: null }, p0: { value: new THREE.Vector2() }, p1: { value: new THREE.Vector2() }, radius: { value: 0.06 }, strength: { value: 0 }, decay: { value: 0.9 }, aspect: { value: 1 } });
    this.moshMat = mk(MOSH, {
      tD: { value: null }, tCur: { value: null }, tPrevC: { value: null }, tVel: { value: null }, tBrush: { value: null },
      res: { value: new THREE.Vector2() }, block: { value: 16 }, gain: { value: 1 }, residual: { value: 1 }, keep: { value: 0.9 },
      glitch: { value: 0 }, creep: { value: 0 }, hue: { value: 0 }, frame: { value: 0 }, intra: { value: 0 }, quant: { value: 0 }, drift: { value: 0 },
    });
    this.showMat = mk(SHOW, { tD: { value: null }, res: { value: new THREE.Vector2() }, tear: { value: 0 }, split: { value: 0 }, frame: { value: 0 }, flash: { value: 0 } });
    this.velMat = new THREE.ShaderMaterial({
      vertexShader: VEL_V, fragmentShader: VEL_F, side: THREE.DoubleSide,
      uniforms: { prevModel: { value: new THREE.Matrix4() }, prevViewProj: { value: new THREE.Matrix4() } },
    });
    this.velMat.onBeforeRender = (r, s, c, g, obj) => {
      this.velMat.uniforms.prevModel.value.copy(obj.userData.pw || obj.matrixWorld);
      this.velMat.uniformsNeedUpdate = true;
    };
    this.prevVP = new THREE.Matrix4();
    this.vp = new THREE.Matrix4();
    this.frame = 0;
    this.snapAll = true;
    this.p = { gain: 1, residual: 1, keep: 0.9, glitch: 0, creep: 0, hue: 0, intra: 0, quant: 0, drift: 0, tear: 0, split: 0, flash: 0 };
    this.pointer = { p0: new THREE.Vector2(-9, -9), p1: new THREE.Vector2(-9, -9), strength: 0 };
    this.clearCol = new THREE.Color(0, 0, 0);
  }

  setSize(w, h, samples) {
    this.w = w; this.h = h;
    for (const k of ['sceneRT', 'velRT', 'curA', 'curB', 'dA', 'dB', 'bA', 'bB']) this[k]?.dispose();
    this.sceneRT = rt(w, h, { depth: true, samples });
    this.velRT = rt(w, h, { depth: true });
    this.curA = rt(w, h, { type: THREE.UnsignedByteType });
    this.curB = rt(w, h, { type: THREE.UnsignedByteType });
    this.dA = rt(w, h); this.dB = rt(w, h);
    const bw = Math.max(32, w >> 2), bh = Math.max(32, h >> 2);
    this.bA = rt(bw, bh); this.bB = rt(bw, bh);
    for (const t of [this.bA, this.bB]) { this.r.setRenderTarget(t); this.r.setClearColor(0x000000, 0); this.r.clear(); }
    this.moshMat.uniforms.res.value.set(w, h);
    this.showMat.uniforms.res.value.set(w, h);
    this.moshMat.uniforms.block.value = h > 560 ? 16 : 8;
    this.brushMat.uniforms.aspect.value = w / h;
    this.primed = false;
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.scene, this.cam);
  }

  snap(obj) { obj.updateMatrixWorld(true); obj.traverse(o => { if (o.isMesh) (o.userData.pw ||= new THREE.Matrix4()).copy(o.matrixWorld); }); }

  render(scene, camera) {
    const r = this.r, p = this.p;
    camera.updateMatrixWorld();
    scene.updateMatrixWorld();
    this.vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (this.snapAll) { this.prevVP.copy(this.vp); this.snap(scene); this.snapAll = false; }

    r.shadowMap.needsUpdate = true;
    r.setClearColor(scene.userData.clear ?? 0x000000, 1);
    r.setRenderTarget(this.sceneRT);
    r.clear();
    camera.layers.enable(1);
    r.render(scene, camera);

    camera.layers.set(0);
    scene.overrideMaterial = this.velMat;
    this.velMat.uniforms.prevViewProj.value.copy(this.prevVP);
    const bg = scene.background; scene.background = null;
    r.setClearColor(0x000000, 0);
    r.setRenderTarget(this.velRT);
    r.clear();
    r.render(scene, camera);
    scene.background = bg;
    scene.overrideMaterial = null;
    camera.layers.enable(1);

    const cur = this.frame & 1 ? this.curA : this.curB;
    const prevC = this.frame & 1 ? this.curB : this.curA;
    this.encode.uniforms.tScene.value = this.sceneRT.texture;
    this.pass(this.encode, cur);

    const bm = this.brushMat.uniforms, pt = this.pointer;
    bm.tB.value = this.bA.texture; bm.p0.value.copy(pt.p0); bm.p1.value.copy(pt.p1); bm.strength.value = pt.strength;
    this.pass(this.brushMat, this.bB);
    [this.bA, this.bB] = [this.bB, this.bA];
    pt.p0.copy(pt.p1); pt.strength *= 0.5;

    const mu = this.moshMat.uniforms;
    if (!this.primed) {
      this.copyMat ||= this.makeCopy();
      this.copyMat.uniforms.t.value = cur.texture;
      this.pass(this.copyMat, this.dA);
      this.pass(this.copyMat, prevC);
      this.primed = true;
    }
    mu.tD.value = this.dA.texture; mu.tCur.value = cur.texture; mu.tPrevC.value = prevC.texture; mu.tVel.value = this.velRT.texture; mu.tBrush.value = this.bA.texture;
    for (const k of ['gain', 'residual', 'keep', 'glitch', 'creep', 'hue', 'intra', 'quant', 'drift']) mu[k].value = p[k];
    mu.frame.value = this.frame;
    this.pass(this.moshMat, this.dB);
    [this.dA, this.dB] = [this.dB, this.dA];

    const su = this.showMat.uniforms;
    su.tD.value = this.dA.texture; su.tear.value = p.tear; su.split.value = p.split; su.frame.value = this.frame; su.flash.value = p.flash;
    this.pass(this.showMat, null);

    this.prevVP.copy(this.vp);
    scene.traverse(o => { if (o.isMesh) (o.userData.pw ||= new THREE.Matrix4()).copy(o.matrixWorld); });
    this.frame++;
  }

  makeCopy() {
    return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: `uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }`, uniforms: { t: { value: null } }, depthTest: false, depthWrite: false });
  }
}

export class Echo {
  constructor(root, scene, count = 30) {
    this.root = root; this.n = count; this.ring = []; this.len = 0; this.parts = [];
    for (let i = 0; i < count; i++) this.ring.push(new THREE.Matrix4());
    this.head = 0;
    root.updateMatrixWorld(true);
    const inv = root.matrixWorld.clone().invert();
    root.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.noEcho || o.geometry.morphAttributes.position) return;
      const im = new THREE.InstancedMesh(o.geometry, o.material, count);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
      im.layers.set(1);
      im.userData.local = inv.clone().multiply(o.matrixWorld);
      im.userData.src = o;
      scene.add(im);
      this.parts.push(im);
    });
    this.tmp = new THREE.Matrix4();
    this.every = 1; this.tick = 0;
  }
  update(record) {
    if (record) {
      if (++this.tick >= this.every) {
        this.tick = 0;
        this.head = (this.head + 1) % this.n;
        this.ring[this.head].copy(this.root.matrixWorld);
        this.len = Math.min(this.n, this.len + 1);
      }
    } else if (this.len > 0) this.len = Math.max(0, this.len - 1);
    const vis = this.root.visible;
    for (const im of this.parts) {
      im.visible = vis && this.len > 0 && im.userData.src.visible;
      im.count = this.len;
      for (let i = 0; i < this.len; i++) {
        const idx = (this.head - (this.len - 1 - i) + this.n * 2) % this.n;
        this.tmp.multiplyMatrices(this.ring[idx], im.userData.local);
        im.setMatrixAt(i, this.tmp);
      }
      im.instanceMatrix.needsUpdate = true;
    }
  }
  clear() { this.len = 0; this.update(false); }
}
