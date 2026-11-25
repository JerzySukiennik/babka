// Chapters 5-8: loaf tin pour, oven timelapse, knife and tear, the bababa finale.
import * as THREE from 'three';
import { ease, V, bez, clamp, state, setFill, flyIn, flyOut, tiltToward, lipPoint, aimStream, grab, dragUpdate } from './ch-util.js';
import { OVEN, topH } from './cake.js';
import { PAN } from './kitchen.js';

const forma = {
  hint: 'przenieś miskę nad formę', brush: 1, slop: 0.8,
  enter(W) {
    const { pan, cake, batter } = W.o, u = batter.material.userData.u;
    this.g = null; this.ready = false; this.fill = 0; this.out = false; this.start = state.fill;
    W.rig.focus.set(2.7, 0, 0.25); W.rig.span = 10.6; W.rig.k = 2.2;
    W.snd.segment(7, { rate: 1 }); W.snd.deckLevel(-5);
    this.loop = W.snd.loop('pour_thick', { gain: -60 });
    cake.group.visible = true; cake.setRise(0); cake.setBaked(0); cake.group.scale.y = 0.001;
    pan.position.set(12, 0, 0.2);
    flyIn(W, pan, pan.position.clone(), V(9, 2.5, 3), V(5.4, 0, 0.2), 0.9, 'pan', () => {
      this.ready = true; W.snd.play('pan_set', { gain: -2 }); W.fx.kick({ glitch: 0.8, gain: 1.6, keep: 0.97 }, 0.45); W.rig.shake = 0.08;
    }, 0.5);
    const t0 = u.uTwist.value;
    W.anim(2.4, p => { u.uMix.value = ease.inOut(p); u.uTwist.value = t0 + p * 4.5; });
  },
  down(W) { if (this.ready && !this.out) this.g = grab(W, W.o.bowl, 1.9, 0); },
  up() { this.g = null; },
  update(W, dt) {
    const { bowl, pan, cake, streamB } = W.o;
    if (this.g) dragUpdate(W, bowl, this.g, 1.9, dt, 10);
    else if (!this.out) bowl.position.y += (0 - bowl.position.y) * (1 - Math.exp(-dt * 8));
    const dx = bowl.position.x - pan.position.x, dz = bowl.position.z - pan.position.z;
    const over = Math.abs(dx) < 2.1 && Math.abs(dz) < 1.6;
    const pouring = this.g && over && this.fill < 1 && bowl.position.y > 1.2;
    W.echo.bowl.on = !!this.g && (this.g.speed > 0.5 || pouring);
    if (this.g || pouring) {
      const dir = tiltToward(bowl, pan.position, pouring ? 1.25 : 0.1, 1 - Math.exp(-dt * 5));
      if (pouring) {
        const lip = lipPoint(bowl, dir, bowl.userData.R + 0.06, bowl.userData.H);
        const topY = pan.position.y + 0.035 + Math.max(0.02, this.fill * 0.46);
        const land = lip.clone().addScaledVector(dir, 0.3);
        land.x = clamp(land.x, pan.position.x - PAN.Lb / 2 + 0.2, pan.position.x + PAN.Lb / 2 - 0.2);
        land.z = clamp(land.z, pan.position.z - PAN.Wb / 2 + 0.15, pan.position.z + PAN.Wb / 2 - 0.15);
        land.y = topY;
        aimStream(streamB, lip, dir, land, W.t);
        this.fill = Math.min(1, this.fill + dt * 0.24);
        setFill(W, Math.max(0.0, this.start * (1 - this.fill)));
        cake.group.scale.y = Math.max(0.001, this.fill);
        W.fx.base.gain = 1.2; W.fx.base.keep = 0.96; W.fx.base.creep = 0.01;
        W.snd.deckTone(400 + this.fill * 8000);
      } else streamB.visible = false;
    } else {
      streamB.visible = false;
      bowl.quaternion.slerp(new THREE.Quaternion(), 1 - Math.exp(-dt * 6));
    }
    if (!pouring) { W.fx.base.gain = 1; W.fx.base.keep = 0.94; W.fx.base.creep = 0; W.fx.base.drift = 0; W.snd.deckTone(20000); }
    this.loop.set(pouring ? -3 : -60, 0.08);
    this.progress = this.fill;
    W.hud.ringP(this.g ? this.fill : 0);
    if (this.fill >= 1 && !this.out) {
      this.out = true; this.g = null; streamB.visible = false; this.loop.stop(); W.snd.deckTone(20000);
      W.o.batter.visible = false;
      flyOut(W, bowl, V(-9, 5, -6), 0.85, 'bowl', () => {
        W.snd.play('sprinkles', { gain: -2 });
        W.snd.play('applause', { gain: -12, psy: 0.6 });
        W.anim(1.7, p => cake.setSprinkles(p), () => { W.fx.kick({ glitch: 1, split: 1.2, hue: 0.8 }, 0.5); setTimeout(() => W.next(), 500); });
      });
    }
  },
};

function lights(W, oven) {
  const { sun, hemi, oven: ov } = W.o;
  const from = { s: sun.intensity, h: hemi.intensity, e: W.scene.environmentIntensity, t: ov.top.intensity, f: ov.fill.intensity };
  const to = oven ? { s: 0, h: 0.03, e: 0.1, t: 26, f: 6 } : { s: 2.7, h: 0.85, e: 0.75, t: 0, f: 0 };
  W.scene.userData.clear = oven ? 0x040404 : 0xd6d4cf;
  W.anim(0.35, p => {
    sun.intensity = THREE.MathUtils.lerp(from.s, to.s, p); hemi.intensity = THREE.MathUtils.lerp(from.h, to.h, p);
    W.scene.environmentIntensity = THREE.MathUtils.lerp(from.e, to.e, p);
    ov.top.intensity = THREE.MathUtils.lerp(from.t, to.t, p); ov.fill.intensity = THREE.MathUtils.lerp(from.f, to.f, p);
  });
}

const piekarnik = {
  hint: 'przytrzymaj, żeby upiec', brush: 0.7, slop: 0.6,
  enter(W) {
    const { pan, cake, oven } = W.o;
    this.rise = 0; this.warned = false; this.out = false;
    W.snd.play('oven_open', { gain: -2 });
    W.snd.play('glitch', { gain: -4, psy: 0.6 });
    W.fx.kick({ residual: 0, keep: 0.998, gain: 1.4, drift: 1.5 }, 1.6, 0.8);
    pan.position.copy(OVEN); pan.rotation.set(0, 0, 0);
    W.echo.pan.clear(); W.echo.bowl.clear();
    W.rig.free = { pos: OVEN.clone().add(V(0, 3.9, 8.6)), look: OVEN.clone().add(V(0, 0.8, 0)) };
    W.snapRig(); W._look.copy(W.rig.free.look);
    W.rig.free.pos = OVEN.clone().add(V(0, 3.05, 4.5)); W.rig.free.look = OVEN.clone().add(V(0, 0.62, 0)); W.rig.k = 0.9;
    W.mosh.snapAll = true;
    lights(W, true);
    cake.setSprinkles(1);
    W.snd.segment(8, { rate: 0.4 }); W.snd.deckLevel(-3);
    this.hum = W.snd.loop('oven_hum', { gain: -12 });
    setTimeout(() => W.snd.play('oven_close', { gain: -4 }), 500);
  },
  update(W, dt) {
    const { cake, oven } = W.o;
    const hold = W.ptr.down && !this.out;
    this.rise = Math.min(1, this.rise + dt * (hold ? 0.24 : 0.015));
    const bounce = hold ? 0.055 * Math.sin(W.t * 17) * (1 - this.rise * 0.4) : 0;
    cake.setRise(clamp(this.rise + bounce, 0, 1));
    cake.setBaked(Math.pow(this.rise, 1.3));
    cake.setSprinkles(1);
    oven.elMat.emissiveIntensity = (hold ? 4.5 : 2.4) * (0.82 + 0.18 * Math.sin(W.t * (hold ? 23 : 3)));
    oven.top.intensity = (hold ? 30 : 24) * (0.9 + 0.1 * Math.sin(W.t * (hold ? 19 : 2.3)));
    W.snd.rate(hold ? 1.9 : 0.42, 0.0015);
    this.hum.rate(hold ? 1.5 : 1);
    W.fx.base.drift = hold ? 0.35 : 0; W.fx.base.creep = hold ? 0.012 : 0; W.fx.base.hue = 0;
    W.fx.base.gain = hold ? 1.12 : 1; W.fx.base.keep = hold ? 0.965 : 0.94;
    W.rig.shake = hold ? Math.max(W.rig.shake, 0.012) : W.rig.shake;
    if (this.rise > 0.5 && !this.warned) { this.warned = true; W.err.spawn(4); }
    this.progress = this.rise;
    W.hud.ringP(hold ? this.rise : 0);
    if (this.rise >= 1 && !this.out) {
      this.out = true;
      W.snd.play('oven_click', { gain: -2 }); W.snd.play('alarm8', { gain: -8, psy: 0.5 });
      W.snd.play('cheer', { gain: -8, psy: 0.7 });
      W.fx.kick({ glitch: 1.2, split: 2, hue: 1.4, flash: 1 }, 0.7, 0.06);
      setTimeout(() => W.next(), 900);
    }
  },
  exit(W) { this.hum?.stop(); W.snd.rate(1, 0.01, true); },
};

const noz = {
  hint: 'piłuj nożem: przeciągaj w przód i w tył', brush: 1, slop: 0.8,
  enter(W) {
    const { pan, cake, sheet, knife, bowl, red, whisk } = W.o;
    this.phase = 'saw'; this.path = 0; this.lastDir = 0; this.gap = 0; this.tore = false; this.broke = false; this.out = false;
    W.fx.kick({ residual: 0, keep: 0.997, gain: 1.3, drift: 1 }, 1.4, 0.6);
    lights(W, false);
    W.scene.attach(cake.group);
    cake.group.position.set(0, 0.03, 0); cake.group.rotation.set(0, 0, 0); cake.group.scale.set(1, 1, 1);
    cake.setRise(1); cake.setBaked(1); cake.setSprinkles(1);
    pan.visible = false;
    for (const o of [bowl, red, whisk, ...state.shells]) o.visible = false;
    sheet.visible = true; sheet.position.set(0, 0, 0); sheet.rotation.y = 0.04;
    W.rig.free = null; W.rig.focus.set(0, 0, 0.15); W.rig.dist = 7.6; W.rig.span = 5.6; W.rig.k = 2.4;
    W.snapRig(); W._look.copy(W.rig.focus);
    W.rig.dist = 7;
    W.mosh.snapAll = true;
    knife.visible = true;
    knife.rotation.set(0, Math.PI / 2, 0);
    knife.position.set(0, 1.9, 0.5);
    this.kz = 0.5;
    W.snd.segment(9, { rate: 0 }); W.snd.deckLevel(-3); W.snd.rate(0, 0.02, true);
    W.snd.play('pan_set', { gain: -6, rate: 0.7 });
  },
  down(W) { this.last = W.ground(0.8).clone(); this.x0 = this.last.x; },
  up(W) { if (this.phase === 'tear' && this.gap < 1.05) this.gapHold = this.gap; },
  update(W, dt) {
    const { knife, cake } = W.o;
    if (this.phase === 'saw') {
      if (W.ptr.down && this.last) {
        const p = W.ground(0.8);
        const dz = p.z - this.last.z, dx = p.x - this.last.x;
        this.last.copy(p);
        const m = Math.abs(dz) + Math.abs(dx) * 0.6;
        this.path += m;
        this.kz = clamp(this.kz + dz * 0.9 + (Math.abs(dx) > Math.abs(dz) ? Math.sign(dx) * dx * 0.5 * Math.sign(Math.sin(W.t * 9)) : 0), -0.75, 0.75);
        const dir = Math.sign(dz);
        if (dir && dir !== this.lastDir && m > 0.02) { W.snd.play('knife_saw', { gain: -4, psy: 0.35 }); if (Math.random() < 0.5) W.fx.kick({ glitch: 0.25, gain: 1.3, keep: 0.96 }, 0.25); this.lastDir = dir; }
        W.snd.rate(clamp(dz / Math.max(dt, 1e-3) * 0.55, -3, 3), 0.02);
        W.echo.knife.on = m > 0.03;
      } else { W.snd.rate(0, 0.01); W.echo.knife.on = false; }
      const pr = clamp(this.path / 7, 0, 1);
      knife.position.x += (0 - knife.position.x) * 0.3;
      knife.position.z += (this.kz - knife.position.z) * (1 - Math.exp(-dt * 20));
      knife.position.y += (THREE.MathUtils.lerp(1.9, 0.42, ease.out(pr)) - knife.position.y) * (1 - Math.exp(-dt * 10));
      this.progress = pr * 0.6;
      W.hud.ringP(pr);
      if (pr >= 1) {
        this.phase = 'tear';
        W.snd.play('knife_through', { gain: 0 }); W.snd.play('boom', { boost: true, gain: -4 });
        W.fx.kick({ glitch: 1.6, split: 2.4, residual: 0.25, keep: 0.985, gain: 2, hue: 1 }, 0.9, 0.1);
        W.rig.shake = 0.2; W.snd.rate(1, 0.004);
        flyOut(W, knife, V(5, 5, -4), 0.7, 'knife');
        W.hud.hint('rozerwij babkę: przeciągnij w bok');
        this.gapHold = 0;
      }
    } else if (this.phase === 'tear') {
      if (W.ptr.down && this.last) {
        const p = W.ground(0.8);
        this.gap = Math.max(this.gap, clamp(this.gapHold + Math.abs(p.x - this.x0) * 0.55, 0, 1.15));
        if (!this.tore && this.gap > 0.04) { this.tore = true; W.snd.play('tear', { gain: 0, psy: 0.2 }); W.snd.segment(3, { rate: 1 }); W.snd.deckLevel(-2); }
      }
      cake.setGap(this.gap);
      if (this.gap > 0.5 && !this.sq) { this.sq = true; W.snd.play('squelch', { gain: -2, psy: 0.4 }); }
      if (this.gap > 0.95 && !this.broke) {
        this.broke = true;
        W.snd.play('squelch', { gain: 0, rate: 0.8 }); W.snd.play('gasp', { gain: -6, psy: 0.5 });
        cake.drops.forEach((d, i) => { d.visible = true; const x = (i ? 1 : -1) * 0.42; W.anim(0.5, p => { d.position.set(x * (1 + p * 0.2), 0.5 - p * p * 0.45, 0); d.scale.set(1, 1 - p * 0.55, 1); }); });
      }
      this.progress = 0.6 + 0.4 * clamp(this.gap / 1.05, 0, 1);
      W.hud.ringP(this.gap / 1.05);
      if (this.gap >= 1.05 && !this.out) {
        this.out = true;
        const h = cake.halves[1], from = h.position.clone(), r0 = h.rotation.clone();
        W.snd.play('boom', { boost: true, gain: -3 }); W.snd.play('cheer', { gain: -6, psy: 0.6 });
        W.fx.kick({ glitch: 1.4, hue: 1.6, split: 2, creep: 0.08, keep: 0.985, residual: 0.3 }, 1.2, 0.1);
        W.rig.focus.set(1.2, 0.8, 0.3); W.rig.dist = 5.2; W.rig.span = 3.8; W.rig.k = 1.6;
        W.anim(1.2, p => {
          const e = ease.back(p);
          h.position.set(from.x + 0.75 * e, from.y + 1.55 * e, from.z);
          h.rotation.set(r0.x, r0.y + 0.25 * e, r0.z - Math.PI / 2 * e);
        }, () => setTimeout(() => W.next(), 1800));
      }
    }
  },
};

function drawFinale(W, n, boom, end) {
  const { cv, g, tex, mesh } = W.screen, w = cv.width, h = cv.height;
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  const fs = Math.min(h * 0.12, w * 0.095);
  g.font = `700 ${fs}px system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`;
  g.textBaseline = 'alphabetic'; g.textAlign = 'center';
  const per = 6, lines = [];
  let left = n;
  for (let i = 0; i < 4 && left > 0; i++) { const k = Math.min(per, left); lines.push('ba'.repeat(k)); left -= k; }
  if (left > 0) lines.push('b');
  g.fillStyle = boom ? 'rgba(255,255,255,0.28)' : '#fff';
  const y0 = h / 2 - (Math.max(1, lines.length) - 1) * fs * 0.5;
  lines.forEach((l, i) => g.fillText(l, w / 2, y0 + i * fs * 1.02));
  if (boom) {
    const bf = Math.min(h * 0.34, w * 0.26);
    g.font = `800 ${bf}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
    g.fillStyle = '#fff';
    g.fillText('babka', w / 2, h / 2 + bf * 0.32);
  }
  if (end) {
    g.font = `600 ${fs * 0.2}px ui-monospace, "SF Mono", Menlo, monospace`;
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillText('babka.mp4 · koniec pliku · klatka kluczowa nie została odnaleziona', w / 2, h * 0.76);
  }
  g.textAlign = 'left';
  tex.needsUpdate = true; mesh.visible = true;
}

const babka = {
  hint: '', brush: 1.2, slop: 0,
  enter(W) {
    this.n = 0; this.boom = false; this.end = false; this.t = 0;
    W.fx.kick({ residual: 0.05, keep: 0.995, gain: 1.4, drift: 2 }, 1.2, 0.3);
    W.fx.setBase({ keep: 0.95 });
    drawFinale(W, 0, false, false);
    W.snd.segment(11, { a: 73.56, b: 78.6, loop: false, rate: 1 }); W.snd.rate(1, 0.5, true); W.snd.deckLevel(0); W.snd.deckTone(20000);
    W.loops?.crackle?.off(0.5);
  },
  redraw(W) { drawFinale(W, this.n, this.boom, this.end); },
  down(W) { if (this.end) location.reload(); },
  update(W, dt) {
    this.t += dt;
    const dp = W.snd.deck ? W.snd.deckPos : 73.56 + this.t;
    const n = dp < 74.45 ? 0 : Math.min(25, Math.floor((dp - 74.45) / 2.25 * 25));
    if (n !== this.n && !this.boom) {
      this.n = n; drawFinale(W, n, false, false);
      W.fx.kick({ glitch: 0.35, quant: 0.2, keep: 0.97 }, 0.15);
      if (n % 2 === 0) W.snd.play('ba', { gain: -16, psy: 0.2 });
    }
    if (!this.boom && (dp >= 77.06 || this.t > 6)) {
      this.boom = true;
      drawFinale(W, 25, true, false);
      W.snd.play('logo', { gain: 0, boost: true }); W.snd.play('cheer', { gain: -6, psy: 0.4 }); W.snd.play('applause', { gain: -8 });
      for (let i = 0; i < 3; i++) W.snd.play('horn', { at: 0.35 + i * 0.17, gain: -6, psy: 0.3, boost: i === 2 });
      W.fx.kick({ residual: 0, keep: 0.999, hue: 1.6, creep: 0.08, glitch: 1.5, split: 2.5, flash: 1, drift: 2 }, 2.4, 0.08);
      W.rig.shake = 0.1;
      setTimeout(() => { this.end = true; drawFinale(W, 25, true, true); W.hud.hint('dotknij, żeby obejrzeć jeszcze raz'); W.fx.kick({ glitch: 0.8, residual: 0.2 }, 0.6); }, 3200);
    }
    this.progress = this.boom ? 1 : n / 25;
  },
};

export const CH_B = [forma, piekarnik, noz, babka];
