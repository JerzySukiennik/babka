// Chapters 0-4: title, bowl, eggs, whisk, chocolate.
import * as THREE from 'three';
import { ease, V, bez, clamp, wrapA, state, setFill, flyIn, flyOut, tiltToward, lipPoint, aimStream, paintChoc, grab, dragUpdate } from './ch-util.js';

function drawTitle(W) {
  const { cv, g, tex, mesh } = W.screen, w = cv.width, h = cv.height;
  g.clearRect(0, 0, w, h);
  const big = Math.min(h * 0.24, w * 0.17);
  g.fillStyle = '#111';
  g.font = `800 ${big}px system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`;
  g.textBaseline = 'alphabetic';
  if ('letterSpacing' in g) g.letterSpacing = `${-big * 0.045}px`;
  g.fillText('babka.mp4', w * 0.06, h * 0.6);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  g.font = `600 ${big * 0.16}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
  g.fillText('przepis, który się nie wyrenderował', w * 0.065, h * 0.6 + big * 0.36);
  g.font = `500 ${big * 0.095}px ui-monospace, "SF Mono", Menlo, monospace`;
  g.globalAlpha = 0.7;
  g.fillText('kodek: brak klatki kluczowej · spacja (albo dwa palce) psuje obraz', w * 0.066, h * 0.6 + big * 0.58);
  g.globalAlpha = 1;
  tex.needsUpdate = true; mesh.visible = true;
}

const title = {
  hint: 'kliknij, żeby odtworzyć', brush: 1, slop: 0,
  enter(W) { W.fx.setBase({ keep: 0.94 }); drawTitle(W); W.rig.focus.set(0, 0, 0.2); W.rig.dist = 12; W.rig.span = 6.4; },
  redraw: drawTitle,
  down(W) {
    if (!W.ready) return;
    W.snd.resume(); W.start();
    W.screen.mesh.visible = false;
    W.fx.kick({ residual: 0, keep: 0.998, gain: 1.25, drift: 1.2 }, 1.8, 1.25);
    W.snd.play('glitch', { gain: -2 }); W.snd.play('rise', { gain: -6, psy: 0.3 });
    W.loops = { crackle: W.snd.loop('crackle', { gain: -16 }) };
    W.next();
  },
};

const miska = {
  hint: '', brush: 1, slop: 0.5,
  enter(W) {
    const { bowl } = W.o;
    this.phase = 'fly'; this.g = null;
    W.fx.setBase({ keep: 0.94 });
    W.snd.segment(0, { rate: 1 }); W.snd.deckLevel(-5);
    bowl.position.set(-8, 3.6, -5.5);
    flyIn(W, bowl, bowl.position.clone(), V(-5, 5, 3), V(0, 0, 0), 1.15, 'bowl', () => {
      W.snd.play('bowl_land', { gain: -1 }); W.snd.play('boom', { boost: true, gain: -6 });
      W.fx.kick({ glitch: 1, split: 1.2, gain: 1.6, keep: 0.97, quant: 0.3 }, 0.6, 0.05);
      W.rig.shake = 0.12;
      this.phase = 'idle';
      W.hud.hint('przeciągnij miskę');
    }, 1.4);
  },
  down(W) { if (this.phase === 'idle') { this.g = grab(W, W.o.bowl, 1.9, 0); if (this.g) { W.snd.play('tick', { gain: -10 }); } } },
  move() {},
  up(W) {
    if (!this.g) return;
    this.g = null;
    W.snd.rate(1, 0.004);
    if (this.progress >= 1) this.finish(W);
  },
  finish(W) {
    if (this.phase === 'out') return;
    this.phase = 'out';
    const { bowl } = W.o, from = bowl.position.clone();
    W.echo.bowl.on = true;
    W.anim(0.55, p => { bez(from, from.clone().lerp(V(), 0.5).add(V(0, 1.5, 0)), V(0, 0, 0), ease.inOut(p), bowl.position); bowl.rotation.set(0, 0, 0); }, () => {
      W.echo.bowl.on = false;
      W.snd.play('bowl_land', { gain: -2, psy: 0.4 });
      W.fx.kick({ glitch: 0.8, gain: 1.8, keep: 0.98 }, 0.5);
      W.next();
    });
  },
  update(W, dt) {
    const { bowl } = W.o;
    if (this.g) {
      const s = dragUpdate(W, bowl, this.g, 0, dt, 12);
      bowl.rotation.z = clamp(-this.g.vel.x * 0.035, -0.5, 0.5);
      bowl.rotation.x = clamp(this.g.vel.z * 0.035, -0.5, 0.5);
      W.echo.bowl.on = s > 0.8;
      this.progress = Math.min(1, this.progress + s * dt / 16);
      W.snd.rate(s > 0.3 ? clamp(this.g.vel.x * 0.4, -2.6, 2.6) : 0, 0.01);
      W.fx.base.gain = 1 + Math.min(0.3, s * 0.03);
      if (this.progress >= 1) { this.g = null; W.snd.rate(1, 0.004); this.finish(W); }
    } else if (this.phase === 'idle') {
      bowl.rotation.x *= 0.85; bowl.rotation.z *= 0.85;
      W.echo.bowl.on = false;
    }
    W.hud.ringP(this.g ? this.progress : 0);
  },
};

function makeEgg(W) {
  const E = W.o.egg;
  const g = new THREE.Group();
  const whole = new THREE.Mesh(E.whole, E.shellMat);
  const bottom = new THREE.Mesh(E.bottom, E.shellMat), topPiv = new THREE.Group(), top = new THREE.Mesh(E.top, E.shellMat);
  topPiv.position.set(E.W / 2, E.H * 0.53, 0); top.position.set(-E.W / 2, -E.H * 0.53, 0); topPiv.add(top);
  for (const m of [whole, bottom, top]) { m.castShadow = true; m.receiveShadow = true; }
  bottom.visible = top.visible = false;
  g.add(whole, bottom, topPiv);
  g.position.y = -E.H / 2;
  const holder = new THREE.Group(); holder.add(g);
  W.scene.add(holder);
  return { holder, g, whole, bottom, top, topPiv };
}

const jajka = {
  hint: 'stukaj, żeby wbić jajka (przytrzymaj = więcej)', brush: 0.8, slop: 0.7,
  enter(W) {
    this.cracked = 0; this.spawned = 0; this.inFlight = 0; this.holdT = 0; this.ending = false;
    W.fx.setBase({ keep: 0.95 });
    W.snd.segment(1, { rate: 1 }); W.snd.deckLevel(-6);
    setFill(W, 0);
  },
  down(W) { this.spawn(W); this.holdT = -0.3; },
  spawn(W) {
    if (this.spawned >= 13 || this.ending) return;
    this.spawned++; this.inFlight++;
    const { bowl } = W.o, E = W.o.egg, R = bowl.userData.R, Hb = bowl.userData.H;
    const e = makeEgg(W);
    const a = Math.random() * Math.PI * 2;
    const from = V(Math.cos(a) * 8, 2.6, Math.sin(a) * 5.5).add(bowl.position);
    const rim = V(Math.cos(a) * (R - 0.05), Hb + 0.32, Math.sin(a) * (R - 0.05)).add(bowl.position);
    const ctrl = from.clone().lerp(rim, 0.5).add(V(0, 2.2, 0));
    e.holder.position.copy(from);
    e.holder.lookAt(bowl.position.clone().setY(rim.y));
    W.snd.play('swish', { gain: -8, psy: 0.4 });
    W.anim(0.4 + Math.random() * 0.12, p => {
      bez(from, ctrl, rim, ease.inOut(p), e.holder.position);
      e.g.rotation.x = (1 - p) * 6 + Math.PI / 2;
    }, () => this.crack(W, e, a, rim));
  },
  crack(W, e, a, rim) {
    const { bowl } = W.o, E = W.o.egg;
    e.whole.visible = false; e.bottom.visible = e.top.visible = true;
    W.snd.play('egg_crack', { gain: 0, psy: 0.45 });
    if (Math.random() < 0.3) W.slop(0.6);
    W.snd.deckStutter(0.05 + Math.random() * 0.06); setTimeout(() => W.snd.deckStutter(0), 160 + Math.random() * 140);
    W.fx.kick({ glitch: 0.8, gain: 1.7, keep: 0.975, creep: 0.05, quant: 0.2 }, 0.45, 0.05);
    this.cracked++;
    if (this.cracked === 4) W.err.spawn(0);
    W.anim(0.3, p => { e.topPiv.rotation.z = -ease.out(p) * 2.2; e.bottom.rotation.z = ease.out(p) * 0.5; });
    const yolk = new THREE.Mesh(E.yolk, E.yolkMat), white = new THREE.Mesh(E.white, E.whiteMat);
    yolk.castShadow = true; white.scale.set(1, 0.22, 1); yolk.scale.set(1, 0.7, 1);
    W.scene.add(yolk);
    const rr = Math.random() * 0.55 * (bowl.userData.R - 0.2), aa = Math.random() * 6.283;
    const local = V(Math.cos(aa) * rr, 0, Math.sin(aa) * rr);
    const start = rim.clone().add(V(0, -0.1, 0));
    W.anim(0.36, p => {
      const tgt = bowl.position.clone().add(local).setY(bowl.position.y + state.fill + 0.06);
      yolk.position.lerpVectors(start, tgt, p).y = THREE.MathUtils.lerp(start.y, tgt.y, p * p);
    }, () => {
      W.scene.remove(yolk);
      bowl.add(yolk); yolk.position.copy(local).setY(state.fill + 0.06);
      bowl.add(white); white.position.copy(local).setY(state.fill + 0.02);
      state.yolks.push(yolk, white);
      W.snd.play('plop', { gain: -6, psy: 0.3 });
      setFill(W, Math.min(0.5, state.fill + 0.065));
      for (const y of state.yolks) y.position.y = state.fill + (y.geometry === E.yolk ? 0.06 : 0.02);
      this.inFlight--;
    });
    const out = V(Math.cos(a), 0, Math.sin(a)).multiplyScalar(2.1 + Math.random() * 1.3).add(bowl.position);
    const from = e.holder.position.clone(), r0 = e.holder.quaternion.clone();
    const rotT = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    setTimeout(() => {
      W.anim(0.5, p => {
        bez(from, from.clone().lerp(out, 0.5).add(V(0, 0.8, 0)), out.clone().setY(0.16), p, e.holder.position);
        e.holder.quaternion.slerpQuaternions(r0, rotT, p);
      }, () => W.snd.play('shell', { gain: -10, psy: 0.3 }));
      state.shells.push(e.holder);
    }, 280);
  },
  update(W, dt) {
    if (W.ptr.down) { this.holdT += dt; if (this.holdT > 0.11) { this.holdT = 0; this.spawn(W); } }
    this.progress = Math.min(1, this.cracked / 7);
    W.hud.ringP(this.progress);
    if (this.cracked >= 7 && this.inFlight <= 0 && !this.ending) { this.ending = true; setTimeout(() => W.next(), 650); }
  },
};

const trzepaczka = {
  hint: 'kręć kółka trzepaczką w misce', brush: 1, slop: 0.8,
  enter(W) {
    const { whisk, bowl } = W.o;
    this.acc = 0; this.prevA = null; this.omega = 0; this.ready = false; this.warned = false; this.base = state.fill;
    this.pos = bowl.position.clone().add(V(0.5, 0, 0.2));
    W.snd.segment(4, { rate: 0 }); W.snd.deckLevel(-3);
    W.snd.rate(0, 0.02, true);
    this.loop = W.snd.loop('whisk', { gain: -60 });
    whisk.position.set(8, 3, -1.5); whisk.rotation.set(0, 0, 0.8);
    flyIn(W, whisk, whisk.position.clone(), V(5, 5, 2), this.pos.clone().add(V(0, state.fill + 0.9, 0.85)), 0.8, 'whisk', () => { this.ready = true; W.snd.play('bowl_land', { gain: -10, rate: 1.6 }); }, 0.6);
  },
  update(W, dt) {
    const { whisk, bowl, batter } = W.o, u = batter.material.userData.u;
    u.uTime.value += dt;
    if (this.ready) {
      const inner = bowl.userData.innerAt(state.fill) * 0.72;
      if (W.ptr.down) {
        const p = W.ground(state.fill).sub(bowl.position).setY(0);
        if (p.length() > inner) p.setLength(inner);
        this.pos.copy(bowl.position).add(p);
        const r = p.length();
        const a = Math.atan2(p.z, p.x);
        if (this.prevA !== null && r > 0.12) {
          const da = wrapA(a - this.prevA);
          this.acc += Math.abs(da);
          this.omega += (da / Math.max(dt, 1e-3) - this.omega) * 0.25;
          u.uTwist.value += da * 0.8;
        }
        this.prevA = a;
      } else { this.prevA = null; this.omega *= Math.exp(-dt * 5); }
      const th = 0.78;
      const tgt = this.pos.clone().setY(bowl.position.y + state.fill - 0.02).add(V(0, 1.25 * Math.cos(th), 1.25 * Math.sin(th)));
      whisk.position.lerp(tgt, 1 - Math.exp(-dt * 18));
      const off = this.pos.clone().sub(bowl.position).setY(0);
      whisk.rotation.set(th - off.z * 0.12, whisk.rotation.y + this.omega * dt * 1.5, off.x * 0.18);
      const w = Math.abs(this.omega);
      W.echo.whisk.on = w > 2;
      W.snd.rate(clamp(this.omega / 5.2, -3, 3), 0.02);
      this.loop.set(w > 0.4 ? -24 + Math.min(20, w * 2.4) : -60, 0.05);
      this.loop.rate(0.8 + Math.min(0.8, w * 0.06));
      W.fx.base.gain = 1 + Math.min(0.9, w * 0.06);
      W.fx.base.hue = Math.min(0.5, w * 0.03);
      W.fx.base.creep = Math.min(0.02, w * 0.0016);
      W.fx.base.keep = 0.94 + Math.min(0.05, w * 0.006);
      if (w > 14 && !this.warned) { this.warned = true; W.err.spawn(2); }
      const f = Math.min(1, this.acc / (Math.PI * 2 * 4.5));
      u.uFoam.value = f;
      setFill(W, this.base + 0.14 * f);
      for (const y of state.yolks) { const s = Math.max(0.001, 1 - f * 1.6); y.scale.x = y.scale.z = s; y.position.y = state.fill + 0.04; }
      this.progress = f;
      W.hud.ringP(f);
      if (f >= 1 && !this.out) {
        this.out = true;
        this.loop.stop(); W.snd.rate(1, 0.003);
        for (const y of state.yolks) y.visible = false;
        W.fx.setBase({ keep: 0.94 });
        flyOut(W, whisk, V(9, 4, -3), 0.7, 'whisk', () => W.next());
      }
    }
  },
};

const czekolada = {
  hint: 'przenieś czerwoną miskę nad metalową', brush: 1, slop: 0.8,
  enter(W) {
    const { red } = W.o;
    this.g = null; this.ready = false; this.amount = 1; this.pourT = 0; this.out = false;
    W.snd.segment(2, { rate: 1 }); W.snd.deckLevel(-5);
    this.loop = W.snd.loop('pour_thick', { gain: -60 });
    W.o.batter.material.userData.u.uTwist.value = 0;
    red.position.set(-8, 3, -5);
    flyIn(W, red, red.position.clone(), V(-6, 4.5, 2), V(-2.7, 0, -1.5), 0.95, 'red', () => {
      this.ready = true; W.snd.play('ceramic_set', { gain: -3 }); W.fx.kick({ glitch: 0.6, gain: 1.5, keep: 0.97 }, 0.4);
    }, 1.2);
  },
  down(W) { if (this.ready && !this.out) this.g = grab(W, W.o.red, 1.5, 0); },
  up(W) { this.g = null; },
  update(W, dt) {
    const { red, bowl, stream } = W.o, choc = red.userData.choc;
    const u = W.o.batter.material.userData.u;
    if (this.g) dragUpdate(W, red, this.g, 1.35, dt, 11);
    else if (this.ready && !this.out) red.position.y += (0 - red.position.y) * (1 - Math.exp(-dt * 8));
    const d = Math.hypot(red.position.x - bowl.position.x, red.position.z - bowl.position.z);
    const pouring = this.g && d < 1.35 && this.amount > 0 && red.position.y > 0.9;
    if (this.g) W.echo.red.on = this.g.speed > 0.6 || pouring;
    else W.echo.red.on = false;
    if (pouring || this.g) {
      const dir = tiltToward(red, bowl.position, pouring ? 1.3 : 0.12, 1 - Math.exp(-dt * 6));
      if (pouring) {
        const lip = lipPoint(red, dir, red.userData.R + 0.02, red.userData.H + 0.03);
        const land = lip.clone().addScaledVector(dir, 0.35).setY(bowl.position.y + state.fill + 0.01);
        const off = land.clone().sub(bowl.position).setY(0), lim = W.o.batter.scale.x * 0.9;
        if (off.length() > lim) { off.setLength(lim); land.set(bowl.position.x + off.x, land.y, bowl.position.z + off.z); }
        aimStream(stream, lip, dir, land, W.t);
        paintChoc(W, land, 0.5);
        u.uTwist.value += dt * 0.9;
        this.amount = Math.max(0, this.amount - dt * 0.21);
        W.fx.base.creep = 0.012; W.fx.base.gain = 1.2; W.fx.base.keep = 0.96;
        W.snd.deckTone(500 + (1 - this.amount) * 6000);
      } else stream.visible = false;
    } else {
      stream.visible = false;
      red.quaternion.slerp(new THREE.Quaternion(), 1 - Math.exp(-dt * 6));
    }
    if (!pouring) { W.fx.base.creep = 0; W.fx.base.gain = 1; W.fx.base.keep = 0.94; W.snd.deckTone(20000); }
    this.loop.set(pouring ? -4 : -60, 0.08);
    choc.position.y = 0.1 + 0.32 * this.amount; choc.scale.setScalar(0.55 + 0.31 * this.amount); choc.visible = this.amount > 0.01;
    this.progress = 1 - this.amount;
    W.hud.ringP(this.g ? this.progress : 0);
    if (this.amount <= 0 && !this.out) {
      this.out = true; this.g = null; stream.visible = false; this.loop.stop(); W.snd.deckTone(20000);
      W.fx.kick({ glitch: 1, hue: 1.2, split: 1.5 }, 0.6);
      W.snd.play('cheer', { gain: -10, psy: 0.8 });
      flyOut(W, red, V(-9, 4, 5), 0.8, 'red', () => W.next());
    }
  },
};

export const CH_A = [title, miska, jajka, trzepaczka, czekolada];
