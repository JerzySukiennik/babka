// Shared helpers for chapters: easing, bezier, batter state, pouring, grabbing.
import * as THREE from 'three';

export const ease = { out: t => 1 - Math.pow(1 - t, 3), inOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, back: t => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2) };
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const bez = (a, b, c, t, out = V()) => out.set(0, 0, 0).addScaledVector(a, (1 - t) * (1 - t)).addScaledVector(b, 2 * (1 - t) * t).addScaledVector(c, t * t);
export const clamp = THREE.MathUtils.clamp;
export const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));

export const state = { fill: 0, yolks: [], shells: [], choc: 1 };

export function setFill(W, h) {
  const { bowl, batter } = W.o;
  state.fill = h;
  batter.visible = h > 0.015;
  batter.position.y = Math.max(0.03, h);
  const r = bowl.userData.innerAt(Math.max(0.03, h)) - 0.005;
  batter.scale.set(r, r, 1);
}

export function flyIn(W, obj, from, ctrl, to, dur, echoKey, done, spin = 1) {
  obj.visible = true;
  const r0 = obj.rotation.clone();
  if (echoKey) W.echo[echoKey].on = true;
  W.snd.play(Math.random() < 0.5 ? 'bowl_swoop' : 'swish', { gain: -4, psy: 0.5 });
  return W.anim(dur, p => {
    const e = ease.inOut(p);
    bez(from, ctrl, to, e, obj.position);
    obj.rotation.set(r0.x * (1 - e) + (1 - e) * 1.1 * spin, r0.y, r0.z * (1 - e) - (1 - e) * 0.8 * spin);
  }, () => { obj.rotation.set(0, 0, 0); if (echoKey) W.echo[echoKey].on = false; done?.(); });
}

export function flyOut(W, obj, to, dur, echoKey, done) {
  const from = obj.position.clone(), ctrl = from.clone().lerp(to, 0.5).add(V(0, 3, 0)), q0 = obj.quaternion.clone();
  if (echoKey) W.echo[echoKey].on = true;
  W.snd.play('swish', { gain: -3, psy: 0.6 });
  return W.anim(dur, p => {
    const e = ease.inOut(p);
    bez(from, ctrl, to, e, obj.position);
    obj.quaternion.copy(q0); obj.rotateZ(e * 2.2); obj.rotateX(e * 0.8);
  }, () => { obj.visible = false; if (echoKey) W.echo[echoKey].on = false; done?.(); });
}

const _d = V(), _ax = V(), _q = new THREE.Quaternion(), _lip = V();
export function tiltToward(obj, target, angle, k) {
  _d.subVectors(target, obj.position).setY(0);
  if (_d.lengthSq() < 1e-6) _d.set(1, 0, 0);
  _d.normalize();
  _ax.set(_d.z, 0, -_d.x);
  _q.setFromAxisAngle(_ax, -angle);
  obj.quaternion.slerp(_q, k);
  return _d;
}

export function lipPoint(obj, dir, R, H, out = _lip) {
  obj.updateMatrixWorld();
  const inv = new THREE.Quaternion().copy(obj.quaternion).invert();
  const ld = dir.clone().applyQuaternion(inv).setY(0).normalize();
  return out.set(ld.x * R, H, ld.z * R).applyMatrix4(obj.matrixWorld);
}

export function aimStream(stream, lip, dir, land, t) {
  const u = stream.userData.u;
  u.p0.value.copy(lip);
  u.p1.value.copy(lip).addScaledVector(dir, 0.22).add(V(0, -0.05, 0));
  u.p2.value.copy(land);
  u.uTime.value = t;
  stream.visible = true;
}

export function paintChoc(W, world, amount) {
  const { bowl, batter } = W.o;
  const m = batter.material.userData;
  const r = batter.scale.x;
  const qx = (world.x - bowl.position.x) / r, qy = -(world.z - bowl.position.z) / r;
  const rr = Math.min(1, Math.hypot(qx, qy));
  const a = m.u.uTwist.value * (1 - rr) * 0.35;
  const tx = Math.cos(a) * qx + Math.sin(a) * qy, ty = -Math.sin(a) * qx + Math.cos(a) * qy;
  const S = m.canvas.width, px = (tx * 0.5 + 0.5) * S, py = (1 - (ty * 0.5 + 0.5)) * S;
  const g = m.ctx, rad = S * 0.07;
  const grd = g.createRadialGradient(px, py, 0, px, py, rad);
  grd.addColorStop(0, `rgba(255,255,255,${amount})`); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(px, py, rad, 0, 6.283); g.fill();
  m.tex.needsUpdate = true;
}

export function grab(W, obj, radius, liftY) {
  const p = W.ground(liftY);
  const d = Math.hypot(p.x - obj.position.x, p.z - obj.position.z);
  if (d > radius) return null;
  return { off: V(obj.position.x - p.x, 0, obj.position.z - p.z), last: obj.position.clone(), speed: 0, vel: V() };
}

export function dragUpdate(W, obj, g, liftY, dt, k = 14) {
  const p = W.ground(liftY).add(g.off);
  p.y = liftY;
  const prev = obj.position.clone();
  obj.position.lerp(p, 1 - Math.exp(-dt * k));
  g.vel.subVectors(obj.position, prev).divideScalar(Math.max(dt, 1e-3));
  g.speed = g.vel.length();
  return g.speed;
}
