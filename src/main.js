// babka.mp4: boot, render loop, input, HUD, mosh effect mixer, meme slop scheduler.
import * as THREE from 'three';
import { Mosh, Echo } from './mosh.js';
import { Sound } from './audio.js';
import * as K from './kitchen.js';
import { makeCake, ovenSet } from './cake.js';
import { Errors } from './errors.js';
import { CHAPTERS } from './chapters.js';

const $ = id => document.getElementById(id);
const coarse = matchMedia('(pointer: coarse)').matches;
const TEST = new URLSearchParams(location.search);

const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
scene.userData.clear = 0xd6d4cf;
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 200);
scene.add(camera);
K.environment(renderer, scene);

const hemi = new THREE.HemisphereLight(0xffffff, 0x8f8a84, 0.85);
const sun = new THREE.DirectionalLight(0xfff4e6, 2.7);
sun.castShadow = true;
sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
sun.shadow.camera.layers.enable(1);
scene.add(hemi, sun, sun.target);

const counter = K.counter(renderer);
scene.add(counter);

const bowl = K.steelBowl();
const batter = new THREE.Mesh(new THREE.CircleGeometry(1, 72), K.batterMaterial());
batter.rotation.x = -Math.PI / 2; batter.visible = false; batter.receiveShadow = true; batter.userData.noEcho = true;
bowl.add(batter);
bowl.position.set(-9, 3, -6); bowl.visible = false;
const red = K.redBowl(); red.position.set(-9, 0, -6); red.visible = false;
const whisk = K.whisk(); whisk.position.set(8, 2, 0); whisk.visible = false;
const knife = K.knife(); knife.visible = false;
const pan = K.loafPan(); pan.position.set(5.4, 0, 0.2); pan.visible = false;
const cake = makeCake(); pan.add(cake.group); cake.group.position.y = 0.035; cake.group.visible = false;
const sheet = K.crumpledSheet(); sheet.visible = false;
const oven = ovenSet();
const stream = K.streamMesh(0x2a160c);
const streamB = K.streamMesh(0x3a2416);
scene.add(bowl, red, whisk, knife, pan, sheet, oven.group, stream, streamB);
const egg = K.eggParts();

const echo = {
  bowl: new Echo(bowl, scene, 34), red: new Echo(red, scene, 30), whisk: new Echo(whisk, scene, 22),
  knife: new Echo(knife, scene, 18), pan: new Echo(pan, scene, 24),
};
for (const e of Object.values(echo)) e.on = false;

const screenCv = document.createElement('canvas');
const screenCtx = screenCv.getContext('2d');
const screenTex = new THREE.CanvasTexture(screenCv); screenTex.colorSpace = THREE.SRGBColorSpace;
const screen = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: screenTex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
screen.material.color.setScalar(1.7);
screen.renderOrder = 999; screen.position.z = -0.5; screen.frustumCulled = false; screen.visible = false;
camera.add(screen);

const mosh = new Mosh(renderer);
mosh.encode.uniforms.exposure.value = 0.8;
const snd = new Sound();
const err = new Errors($('trail'), $('pop'), snd);

const BASE = { gain: 1, residual: 1, keep: 0.9, glitch: 0, creep: 0, hue: 0, intra: 0, quant: 0, drift: 0, tear: 0, split: 0, flash: 0 };
const MINS = new Set(['residual']);
const fx = {
  base: { ...BASE }, list: [], cur: { ...BASE },
  kick(p, dur = 0.6, hold = 0) { const e = { p, t: 0, dur, hold }; this.list.push(e); return e; },
  setBase(p) { this.base = { ...BASE, ...p }; },
  update(dt) {
    const tgt = { ...this.base };
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.t += dt;
      if (!e.sticky && e.t > e.hold + e.dur) { this.list.splice(i, 1); continue; }
      const env = e.sticky || e.t < e.hold ? 1 : Math.pow(1 - (e.t - e.hold) / e.dur, 1.6);
      for (const k in e.p) {
        const v = THREE.MathUtils.lerp(this.base[k], e.p[k], env);
        tgt[k] = MINS.has(k) ? Math.min(tgt[k], v) : Math.max(tgt[k], v);
      }
    }
    const a = 1 - Math.exp(-dt * 22);
    for (const k in tgt) this.cur[k] += (tgt[k] - this.cur[k]) * (k === 'flash' ? 1 : a);
    Object.assign(mosh.p, this.cur);
  },
};

const hud = {
  hintEl: $('hint'), barEl: $('bar'), tc: $('tc'), fr: $('fr'), ch: $('ch'), cur: $('cur'), ring: document.querySelector('#cur .ring'),
  last: '',
  init(n) { this.barEl.innerHTML = '<i></i>'.repeat(n); this.segs = [...this.barEl.children]; },
  hint(t) {
    if (t === this.last) return;
    this.last = t;
    this.hintEl.classList.add('out');
    clearTimeout(this._h);
    this._h = setTimeout(() => { this.hintEl.textContent = t; this.hintEl.classList.toggle('out', !t); }, 260);
  },
  progress(i, p) { this.segs?.forEach((s, k) => s.style.setProperty('--p', k < i ? 1 : k === i ? THREE.MathUtils.clamp(p, 0, 1) : 0)); this.ch.textContent = `${String(i).padStart(2, '0')} / ${String(this.segs.length).padStart(2, '0')}`; },
  ringP(p) { this.ring.style.strokeDashoffset = 113.1 * (1 - THREE.MathUtils.clamp(p, 0, 1)); },
  time(t) { const f = Math.floor(t * 30) % 30, s = Math.floor(t) % 60, m = Math.floor(t / 60); this.tc.textContent = `00:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`; },
};

const rig = { focus: new THREE.Vector3(0, 0, 0.2), dist: 12, span: 6.2, tilt: 0.13, free: null, pos: new THREE.Vector3(), look: new THREE.Vector3(), shake: 0, k: 3.2 };
function rigTarget(out, look) {
  if (rig.free) { out.copy(rig.free.pos); look.copy(rig.free.look); return; }
  const aspect = Math.max(0.3, innerWidth / Math.max(1, innerHeight)), tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const d = Math.max(rig.dist, rig.span / (2 * tan * aspect));
  out.set(rig.focus.x, rig.focus.y + d * Math.cos(rig.tilt), rig.focus.z + d * Math.sin(rig.tilt));
  look.copy(rig.focus);
}
function snapRig() { rigTarget(rig.pos, rig.look); camera.position.copy(rig.pos); camera.lookAt(rig.look); }

const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitV = new THREE.Vector3();
const ptr = { x: innerWidth / 2, y: innerHeight / 2, ndc: new THREE.Vector2(), down: false, downAt: 0, touches: 0, id: null };
function ground(h = 0, out = new THREE.Vector3()) {
  ray.setFromCamera(ptr.ndc, camera);
  plane.constant = -h;
  return ray.ray.intersectPlane(plane, out) || out.set(0, h, 0);
}

let W, chapterIdx = -1, chapter = null, started = false, holdFx = null, clock = 0, videoT = 0, slopT = 9;
const anims = [];
function anim(dur, fn, done) { const a = { t: 0, dur, fn, done }; anims.push(a); fn(0); return a; }

const SLOP = ['quack', 'goat', 'moo', 'rooster', 'parrot', 'pipe', 'horn', 'laugh', 'laugh1', 'burp', 'sneeze', 'boing', 'whistle', 'siren', 'scratch', 'boo', 'gasp', 'alarm8', 'err_fall'];
function slop(intensity = 1) {
  const s = SLOP[Math.floor(Math.random() * SLOP.length)];
  if (s === 'horn') { for (let i = 0; i < 3; i++) snd.play('horn', { at: i * 0.16, gain: -4, psy: 0.3, boost: i === 2 }); }
  else snd.play(s, { gain: s === 'pipe' ? -2 : -5, psy: 0.9 * intensity, verb: Math.random() < 0.5 ? 0.6 : 0, boost: s === 'pipe' && Math.random() < 0.5 });
  fx.kick({ glitch: 1.2 * intensity, split: 1.4, tear: 0.8, hue: 0.9, quant: 0.35, intra: 0.06, creep: 0.06 }, 0.7, 0.12);
  if (Math.random() < 0.35) { snd.stutter(0.06 + Math.random() * 0.1, 0.35); }
  if (Math.random() < 0.18 * intensity) err.spawn();
}

function goto(i) {
  chapter?.exit?.(W);
  if (ptr.down) { ptr.down = false; ptr.id = null; }
  chapterIdx = i;
  chapter = CHAPTERS[i];
  chapter.progress = 0; chapter.done = false;
  hud.hint(chapter.hint || '');
  chapter.enter?.(W);
}

W = {
  THREE, scene, camera, renderer, mosh, snd, err, hud, fx, rig, echo, anim, ground, ptr, slop, snapRig,
  o: { bowl, batter, red, whisk, knife, pan, cake, sheet, oven, stream, streamB, egg, counter, hemi, sun, screen },
  screen: { cv: screenCv, g: screenCtx, tex: screenTex, mesh: screen },
  next() { if (chapterIdx < CHAPTERS.length - 1) goto(chapterIdx + 1); },
  goto, get t() { return clock; }, get chapterIdx() { return chapterIdx; }, test: TEST,
};

function resize() {
  const w = innerWidth, h = innerHeight;
  const budget = coarse ? 0.6e6 : 1.15e6;
  const s = Math.min(devicePixelRatio || 1, Math.sqrt(budget / (w * h)));
  const iw = Math.round(w * s), ih = Math.round(h * s);
  renderer.setSize(iw, ih, false);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  mosh.setSize(iw, ih, coarse ? 2 : 4);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const sh = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.5;
  screen.scale.set(sh * camera.aspect, sh, 1);
  screenCv.width = Math.min(1800, iw); screenCv.height = Math.round(screenCv.width / camera.aspect);
  err.resize();
  chapter?.redraw?.(W);
}
addEventListener('resize', resize);

function setPtr(e) {
  ptr.x = e.clientX; ptr.y = e.clientY;
  ptr.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  hud.cur.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  mosh.pointer.p1.set(e.clientX / innerWidth, 1 - e.clientY / innerHeight);
}
const activeTouches = new Set();
addEventListener('pointerdown', e => {
  if (e.target.closest?.('#snd')) return;
  activeTouches.add(e.pointerId);
  if (activeTouches.size >= 2) { breakStart(); return; }
  setPtr(e); mosh.pointer.p0.copy(mosh.pointer.p1);
  snd.resume();
  if (err.down(e.clientX, e.clientY)) return;
  ptr.down = true; ptr.downAt = clock; ptr.id = e.pointerId;
  chapter?.down?.(W, e);
});
addEventListener('pointermove', e => {
  if (ptr.id !== null && e.pointerId !== ptr.id && ptr.down) return;
  setPtr(e);
  if (err.move(e.clientX, e.clientY)) return;
  mosh.pointer.strength = Math.max(mosh.pointer.strength, ptr.down ? (chapter?.brush ?? 1) : 0.3 * (chapter?.brush ?? 1));
  chapter?.move?.(W, e);
});
const upH = e => {
  activeTouches.delete(e.pointerId);
  if (activeTouches.size < 2) breakEnd();
  if (err.up()) return;
  if (!ptr.down || (ptr.id !== null && e.pointerId !== ptr.id)) return;
  ptr.down = false; ptr.id = null;
  chapter?.up?.(W, e);
};
addEventListener('pointerup', upH);
addEventListener('pointercancel', upH);
addEventListener('contextmenu', e => e.preventDefault());

function breakStart() {
  if (holdFx || !started) return;
  holdFx = fx.kick({ residual: 0.02, keep: 0.997, gain: 1.7, glitch: 0.8, creep: 0.04, hue: 0.25, drift: 2.5, intra: 0.004 }, 0.6);
  holdFx.sticky = true;
  snd.stutter(0.11, 0); snd.crush(6, 3);
  snd.play('glitch', { gain: -3, psy: 0.6 });
}
function breakEnd() {
  if (!holdFx) return;
  holdFx.sticky = false; holdFx.t = 0; holdFx.hold = 0; holdFx.dur = 1.4; holdFx = null;
  snd.stutter(0); snd.crush(0, 1);
}
addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) breakStart(); } });
addEventListener('keyup', e => { if (e.code === 'Space') breakEnd(); });

$('snd').addEventListener('click', () => { snd.resume(); snd.setMuted(!snd.muted); $('snd').classList.toggle('off', snd.muted); });

const MANIFEST = {
  bowl_land: 3, bowl_swoop: 2, swish: 4, egg_crack: 8, plop: 4, shell: 1, whisk: 2, ceramic_set: 2, pour_thick: 1, pan_set: 1,
  sprinkles: 1, oven_open: 1, oven_close: 1, oven_hum: 1, oven_click: 1, knife_saw: 4, knife_through: 1, tear: 1, squelch: 3,
  glitch: 4, ba: 6, logo: 1, tick: 2, rise: 1, pipe: 2, boom: 1, err_buzz: 2, err_deny: 2, err_fall: 1, alarm8: 1, scratch: 3,
  horn: 1, laugh: 2, laugh1: 1, gasp: 2, cheer: 1, applause: 1, boo: 1, scream: 1, burp: 1, sneeze: 1, quack: 1, goat: 1,
  rooster: 1, moo: 1, parrot: 1, boing: 2, tapestop: 1, downlift: 1, whistle: 1, siren: 1, crackle: 1,
};

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  clock += dt;
  if (started) videoT += dt;
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i]; a.t += dt;
    const p = Math.min(1, a.t / a.dur);
    a.fn(p);
    if (p >= 1) { anims.splice(i, 1); a.done?.(); }
  }
  chapter?.update?.(W, dt);
  if (chapter) hud.progress(Math.max(0, chapterIdx - 1 + (chapterIdx === 0 ? 1 : 0)), chapter.progress);
  for (const e of Object.values(echo)) e.update(e.on);

  if (started && chapter?.slop) {
    slopT -= dt;
    if (slopT <= 0) { slop(chapter.slop); slopT = 7 + Math.random() * 9 / chapter.slop; }
  }
  const lvl = snd.meter();
  W._avg = (W._avg ?? lvl) + (lvl - (W._avg ?? lvl)) * 0.02;
  W._cool = Math.max(0, (W._cool || 0) - dt);
  if (started && lvl > 0.22 && lvl > W._avg * 2.4 && !W._cool) { W._cool = 0.5; fx.kick({ glitch: 0.45, quant: 0.18, split: 0.3 }, 0.25); }

  rigTarget(rig.pos, rig.look);
  if (!Number.isFinite(camera.position.y) || !Number.isFinite(camera.position.z)) { camera.position.copy(rig.pos); W._look.copy(rig.look); }
  const k = 1 - Math.exp(-dt * rig.k);
  camera.position.lerp(rig.pos, k);
  W._look ||= rig.look.clone();
  W._look.lerp(rig.look, k);
  if (rig.shake > 0) { camera.position.x += (Math.random() - 0.5) * rig.shake; camera.position.z += (Math.random() - 0.5) * rig.shake; rig.shake *= Math.exp(-dt * 6); }
  camera.lookAt(W._look);
  if (!rig.free) {
    sun.target.position.set(W._look.x, 0, W._look.z);
    sun.position.set(W._look.x - 5, 13, W._look.z - 3.5);
  }

  fx.update(dt);
  hud.time(videoT);
  hud.fr.textContent = mosh.p.residual < 0.5 ? 'P-frame · brak klatki kluczowej' : mosh.p.glitch > 0.3 ? 'B-frame · błąd' : 'I-frame';
  err.update(dt);
  mosh.render(scene, camera);
}

async function boot() {
  resize();
  hud.init(CHAPTERS.length - 1);
  snapRig();
  W._look = rig.look.clone();
  goto(0);
  const vis = [];
  scene.traverse(o => { if (!o.visible) { vis.push(o); o.visible = true; } });
  try { await renderer.compileAsync(scene, camera); } catch (e) { renderer.compile(scene, camera); }
  vis.forEach(o => { o.visible = false; });
  requestAnimationFrame(frame);
  await snd.init(MANIFEST, p => { if (!started) hud.hintEl.textContent = `ładowanie ${Math.round(p * 100)}%`; });
  W.ready = true;
  hud.last = '';
  hud.hint(chapter.hint);
  window.__babka = W;
}
W.start = () => { started = true; videoT = 0; };

boot().catch(e => { $('fatal').style.display = 'grid'; $('fatal').textContent = 'babka.mp4 nie da się odtworzyć: ' + e.message; console.error(e); });
