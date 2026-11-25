// Win98 error popups drawn on 2D canvases; dragging leaves the classic frozen-window trail.
const MSGS = [
  ['jajko.exe', 'Jajko.exe przestało działać.\nNie wysiedziano klatki kluczowej.'],
  ['babka.mp4', 'Brak klatki kluczowej (0x0000BABA).\nObraz zostanie zgadnięty.'],
  ['trzepaczka.sys', 'Przegrzanie trzepaczki.\nKręć wolniej albo szybciej.'],
  ['czekolada.dll', 'Za mało pamięci na czekoladę.\nZamknij kilka misek.'],
  ['piekarnik.exe', 'Piekarnik.exe nie odpowiada.\nCiasto rośnie bez nadzoru.'],
  ['nóż.bat', 'Nie można podzielić przez babkę.'],
  ['kodek H.264', 'Wektory ruchu nie pasują do niczego.\nKontynuować mimo to?'],
  ['ba.wav', 'babababababababababa'],
  ['System', 'Wykryto zbyt dużo babki.\nUsunąć System32?'],
  ['mikser.exe', 'Wystąpił błąd: sukces.'],
];

export class Errors {
  constructor(trail, pop, sound) {
    this.tc = trail; this.pc = pop; this.snd = sound;
    this.t = trail.getContext('2d'); this.p = pop.getContext('2d');
    this.list = []; this.drag = null; this.spawned = 0; this.closed = 0; this.trailAlpha = 0;
    this.resize();
  }
  resize() {
    this.dpr = Math.min(2, devicePixelRatio || 1);
    for (const c of [this.tc, this.pc]) { c.width = innerWidth * this.dpr; c.height = innerHeight * this.dpr; }
    this.t.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); this.p.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.dirty = true;
  }
  spawn(i, x, y) {
    if (this.list.length > 14) return;
    const [title, msg] = MSGS[i ?? Math.floor(Math.random() * MSGS.length)];
    const w = Math.min(360, innerWidth - 24), h = 150;
    if (x == null) {
      const side = Math.random() < 0.5;
      x = side ? 14 + Math.random() * Math.max(4, innerWidth * 0.18) : Math.max(14, innerWidth - w - 14 - Math.random() * innerWidth * 0.18);
      y = 64 + Math.random() * Math.max(10, innerHeight * 0.42 - 40);
    }
    const e = { title, msg, x, y, w, h, vx: 0, vy: 0, born: performance.now(), fly: false };
    this.list.push(e);
    this.spawned++;
    this.snd?.play(Math.random() < 0.5 ? 'err_buzz' : 'err_deny', { gain: -3, psy: 0.4 });
    this.dirty = true;
    return e;
  }
  cascade(n, i) { for (let k = 0; k < n; k++) setTimeout(() => this.spawn(i), k * 90); }
  hit(x, y) {
    for (let k = this.list.length - 1; k >= 0; k--) { const e = this.list[k]; if (x >= e.x && x <= e.x + e.w && y >= e.y && y <= e.y + e.h) return e; }
    return null;
  }
  down(x, y) {
    const e = this.hit(x, y);
    if (!e) return false;
    this.list.splice(this.list.indexOf(e), 1); this.list.push(e);
    const bx = e.x + e.w / 2 - 38, by = e.y + e.h - 38;
    const close = (x > e.x + e.w - 26 && y < e.y + 24) || (x > bx && x < bx + 76 && y > by && y < by + 26);
    if (close) {
      this.list.splice(this.list.indexOf(e), 1);
      this.closed++;
      this.snd?.play('tick', { gain: -4 });
      if (this.closed < 9 && Math.random() < 0.55) this.cascade(2);
      this.dirty = true;
    } else this.drag = { e, ox: x - e.x, oy: y - e.y, lx: x, ly: y };
    return true;
  }
  move(x, y) {
    if (!this.drag) return false;
    const d = this.drag;
    d.e.vx = x - d.lx; d.e.vy = y - d.ly; d.lx = x; d.ly = y;
    d.e.x = x - d.ox; d.e.y = y - d.oy;
    this.stamp(d.e);
    this.dirty = true;
    return true;
  }
  up() { if (!this.drag) return false; const e = this.drag.e; e.fly = Math.hypot(e.vx, e.vy) > 6; this.drag = null; return true; }
  clearAll() { this.list.length = 0; this.drag = null; this.trailAlpha = 1; this.dirty = true; }
  stamp(e) { this.trailAlpha = 1; this.drawWin(this.t, e); }

  update(dt) {
    const now = performance.now();
    for (let k = this.list.length - 1; k >= 0; k--) {
      const e = this.list[k];
      if (!e.fly && !e.leaving && this.drag?.e !== e && now - e.born > 6500) { e.leaving = true; e.fly = true; const a = Math.random() * 6.283; e.vx = Math.cos(a) * 14; e.vy = Math.sin(a) * 14 - 4; }
      if (e.leaving && (e.x > innerWidth + 40 || e.x + e.w < -40 || e.y > innerHeight + 40 || e.y + e.h < -40)) { this.list.splice(k, 1); this.dirty = true; }
    }
    for (const e of this.list) if (e.fly) {
      e.x += e.vx; e.y += e.vy;
      if (e.leaving) { e.vy += 0.5; this.stamp(e); this.dirty = true; continue; }
      if (e.x < 0 || e.x + e.w > innerWidth) { e.vx *= -1; e.x = Math.max(0, Math.min(innerWidth - e.w, e.x)); this.snd?.play('boing', { gain: -10, psy: 0.3 }); }
      if (e.y < 0 || e.y + e.h > innerHeight) { e.vy *= -1; e.y = Math.max(0, Math.min(innerHeight - e.h, e.y)); }
      e.vx *= 0.995; e.vy *= 0.995;
      if (Math.hypot(e.vx, e.vy) < 1) e.fly = false;
      this.stamp(e); this.dirty = true;
    }
    if (!this.list.length && this.trailAlpha > 0) {
      this.trailAlpha -= dt * 1.6;
      this.tc.style.opacity = Math.max(0, this.trailAlpha);
      if (this.trailAlpha <= 0) { this.t.clearRect(0, 0, innerWidth, innerHeight); this.tc.style.opacity = 1; }
    }
    if (!this.dirty) return;
    this.dirty = false;
    this.p.clearRect(0, 0, innerWidth, innerHeight);
    for (const e of this.list) this.drawWin(this.p, e);
  }

  drawWin(g, e) {
    const { x, y, w, h } = e;
    const bevel = (x, y, w, h, inset) => {
      g.fillStyle = inset ? '#808080' : '#ffffff'; g.fillRect(x, y, w, 1); g.fillRect(x, y, 1, h);
      g.fillStyle = inset ? '#ffffff' : '#000000'; g.fillRect(x, y + h - 1, w, 1); g.fillRect(x + w - 1, y, 1, h);
      g.fillStyle = inset ? '#000000' : '#808080'; g.fillRect(x + 1, y + h - 2, w - 2, 1); g.fillRect(x + w - 2, y + 1, 1, h - 2);
    };
    g.fillStyle = '#c0c0c0'; g.fillRect(x, y, w, h); bevel(x, y, w, h);
    const grd = g.createLinearGradient(x, 0, x + w, 0); grd.addColorStop(0, '#000080'); grd.addColorStop(1, '#1084d0');
    g.fillStyle = grd; g.fillRect(x + 3, y + 3, w - 6, 18);
    g.fillStyle = '#fff'; g.font = 'bold 12px Tahoma, "MS Sans Serif", Geneva, sans-serif'; g.textBaseline = 'middle';
    g.fillText(e.title, x + 8, y + 12.5);
    g.fillStyle = '#c0c0c0'; g.fillRect(x + w - 21, y + 5, 16, 14); bevel(x + w - 21, y + 5, 16, 14);
    g.fillStyle = '#000'; g.font = 'bold 11px Tahoma, sans-serif'; g.fillText('×', x + w - 17, y + 12);
    const cx = x + 30, cy = y + 52;
    g.fillStyle = '#e00000'; g.beginPath(); g.arc(cx, cy, 15, 0, 6.283); g.fill();
    g.strokeStyle = '#800000'; g.lineWidth = 1; g.stroke();
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 6, cy - 6); g.lineTo(cx + 6, cy + 6); g.moveTo(cx + 6, cy - 6); g.lineTo(cx - 6, cy + 6); g.stroke();
    g.fillStyle = '#000'; g.font = '12px Tahoma, "MS Sans Serif", Geneva, sans-serif'; g.textBaseline = 'alphabetic';
    e.msg.split('\n').forEach((l, i) => g.fillText(l, x + 58, y + 48 + i * 17, w - 70));
    const bx = x + w / 2 - 38, by = y + h - 38;
    g.fillStyle = '#c0c0c0'; g.fillRect(bx, by, 76, 26); bevel(bx, by, 76, 26);
    g.strokeStyle = '#000'; g.lineWidth = 1; g.setLineDash([1, 1]); g.strokeRect(bx + 4.5, by + 4.5, 67, 17); g.setLineDash([]);
    g.fillStyle = '#000'; g.textAlign = 'center'; g.fillText('OK', bx + 38, by + 17); g.textAlign = 'left';
  }
}
