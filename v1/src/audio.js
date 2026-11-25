// Audio: scratchable deck of the source meme track, sampler with psychedelic FX, master glitch.
const WORKLETS = `
class Deck extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ch = null; this.n = 0; this.pos = 0; this.rate = 0; this.target = 0; this.smooth = 0.0025;
    this.a = 0; this.b = 0; this.loop = true; this.st = 0; this.stLen = 0; this.stPos = 0; this.tick = 0;
    this.port.onmessage = e => {
      const m = e.data;
      if (m.type === 'load') { this.ch = m.ch; this.n = m.ch[0].length; this.b = this.n; }
      else if (m.type === 'seg') { this.a = m.a * sampleRate; this.b = m.b * sampleRate; if (m.jump !== false) this.pos = this.a + (m.off || 0) * sampleRate; this.loop = m.loop !== false; }
      else if (m.type === 'rate') { this.target = m.v; if (m.smooth != null) this.smooth = m.smooth; if (m.now) this.rate = m.v; }
      else if (m.type === 'jump') { this.pos = m.t * sampleRate; }
      else if (m.type === 'stutter') { if (m.len > 0) { this.stLen = Math.max(64, m.len * sampleRate); this.st = this.pos; this.stPos = 0; } else this.stLen = 0; }
    };
  }
  read(c, p) {
    const d = this.ch[c] || this.ch[0];
    const i = Math.floor(p), f = p - i;
    const x0 = d[(i % this.n + this.n) % this.n], x1 = d[((i + 1) % this.n + this.n) % this.n];
    return x0 + (x1 - x0) * f;
  }
  process(_, outputs) {
    const out = outputs[0];
    const L = out[0], R = out[1] || out[0];
    if (!this.ch) { L.fill(0); if (R !== L) R.fill(0); return true; }
    for (let i = 0; i < L.length; i++) {
      this.rate += (this.target - this.rate) * this.smooth;
      let p = this.pos;
      if (this.stLen > 0) {
        p = this.st + this.stPos;
        this.stPos += this.rate >= 0 ? Math.max(0.25, Math.abs(this.rate)) : -Math.max(0.25, Math.abs(this.rate));
        if (this.stPos >= this.stLen) this.stPos -= this.stLen;
        if (this.stPos < 0) this.stPos += this.stLen;
      }
      let env = 1;
      if (this.stLen > 0) { const ph = this.stPos / this.stLen; env = Math.min(1, ph * 40, (1 - ph) * 40); }
      L[i] = this.read(0, p) * env; if (R !== L) R[i] = this.read(1, p) * env;
      this.pos += this.rate;
      if (this.loop && this.b > this.a) {
        const len = this.b - this.a;
        if (this.pos >= this.b) this.pos -= len;
        if (this.pos < this.a) this.pos += len;
      }
    }
    if (++this.tick % 8 === 0) this.port.postMessage(this.pos / sampleRate);
    return true;
  }
}
registerProcessor('deck', Deck);

class Glitch extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = sampleRate * 2; this.buf = [new Float32Array(this.size), new Float32Array(this.size)];
    this.w = 0; this.on = false; this.len = 0; this.p = 0; this.from = 0; this.bits = 0; this.down = 1; this.hold = [0, 0]; this.hc = 0;
    this.port.onmessage = e => {
      const m = e.data;
      if (m.type === 'stutter') {
        if (m.len > 0) { this.len = Math.max(128, Math.floor(m.len * sampleRate)); this.from = (this.w - this.len + this.size) % this.size; this.p = 0; this.on = true; }
        else this.on = false;
      } else if (m.type === 'crush') { this.bits = m.bits || 0; this.down = Math.max(1, m.down || 1); }
    };
  }
  process(inputs, outputs) {
    const inp = inputs[0], out = outputs[0];
    const n = out[0].length;
    for (let c = 0; c < out.length; c++) {
      const src = inp[c] || inp[0];
      const o = out[c];
      for (let i = 0; i < n; i++) {
        const x = src ? src[i] : 0;
        let y;
        if (this.on) {
          const pp = (this.p + i) % this.len;
          const ph = pp / this.len;
          const env = Math.min(1, ph * 30, (1 - ph) * 30);
          y = this.buf[c & 1][(this.from + pp) % this.size] * env;
        } else {
          y = x;
          this.buf[c & 1][(this.w + i) % this.size] = x;
        }
        if (this.down > 1) { if ((this.hc + i) % this.down === 0) this.hold[c & 1] = y; y = this.hold[c & 1]; }
        if (this.bits > 0) { const q = Math.pow(2, this.bits - 1); y = Math.round(y * q) / q; }
        o[i] = y;
      }
    }
    if (this.on) this.p = (this.p + n) % this.len; else this.w = (this.w + n) % this.size;
    this.hc += n;
    return true;
  }
}
registerProcessor('glitch', Glitch);
`;

export const SEG = [
  [0.21, 3.25], [3.75, 11.09], [12.07, 20.0], [21.59, 26.55], [28.04, 36.2], [36.25, 40.4], [40.5, 43.67],
  [45.72, 49.88], [51.36, 61.8], [62.87, 71.79], [72.68, 72.97], [73.56, 76.72], [77.1, 78.45],
];

const pick = a => a[Math.floor(Math.random() * a.length)];
const db = v => Math.pow(10, v / 20);

export class Sound {
  constructor() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ latencyHint: 'interactive' });
    this.rev = new Map(); this.takes = {};
    this.muted = false; this.level = 0; this.deckPos = 0;
    const c = this.ctx;
    this.out = c.createGain(); this.out.gain.value = 0.9;
    this.lim = c.createDynamicsCompressor();
    this.lim.threshold.value = -9; this.lim.knee.value = 4; this.lim.ratio.value = 14; this.lim.attack.value = 0.002; this.lim.release.value = 0.18;
    this.pre = c.createGain();
    this.analyser = c.createAnalyser(); this.analyser.fftSize = 512; this.an = new Float32Array(512);
    this.sfx = c.createGain();
    this.verb = c.createConvolver(); this.verb.buffer = this.impulse(3.8, 2.6);
    this.verbIn = c.createGain(); this.verbIn.gain.value = 0.35;
    this.delay = c.createDelay(2); this.delay.delayTime.value = 0.23;
    this.fb = c.createGain(); this.fb.gain.value = 0.48;
    this.dIn = c.createGain(); this.dIn.gain.value = 0.0;
    this.dFilt = c.createBiquadFilter(); this.dFilt.type = 'bandpass'; this.dFilt.frequency.value = 1400; this.dFilt.Q.value = 0.8;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.31; const lg = c.createGain(); lg.gain.value = 0.012; lfo.connect(lg).connect(this.delay.delayTime); lfo.start();
    this.dIn.connect(this.delay); this.delay.connect(this.dFilt).connect(this.fb).connect(this.delay); this.dFilt.connect(this.pre);
    this.boost = c.createBiquadFilter(); this.boost.type = 'lowshelf'; this.boost.frequency.value = 140; this.boost.gain.value = 16;
    this.shaper = c.createWaveShaper(); this.shaper.curve = this.curve(9); this.shaper.oversample = '2x';
    this.boostOut = c.createGain(); this.boostOut.gain.value = 0.55;
    this.boost.connect(this.shaper).connect(this.boostOut).connect(this.pre);
    this.sfx.connect(this.pre); this.sfx.connect(this.verbIn); this.verbIn.connect(this.verb).connect(this.pre);
    this.deckGain = c.createGain(); this.deckGain.gain.value = 0;
    this.deckFilt = c.createBiquadFilter(); this.deckFilt.type = 'lowpass'; this.deckFilt.frequency.value = 20000; this.deckFilt.Q.value = 0.9;
    this.deckFilt.connect(this.deckGain); this.deckGain.connect(this.pre);
    this.deckSend = c.createGain(); this.deckSend.gain.value = 0.12; this.deckGain.connect(this.deckSend).connect(this.verbIn);
    this.pre.connect(this.analyser);
  }

  impulse(sec, decay) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) * (i < 90 ? i / 90 : 1); }
    return b;
  }
  curve(k) { const n = 2048, a = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; a[i] = Math.tanh(k * x) / Math.tanh(k); } return a; }

  async init(manifest, onProgress) {
    const c = this.ctx;
    try {
      const url = URL.createObjectURL(new Blob([WORKLETS], { type: 'text/javascript' }));
      await c.audioWorklet.addModule(url);
      this.deck = new AudioWorkletNode(c, 'deck', { numberOfInputs: 0, outputChannelCount: [2] });
      this.deck.connect(this.deckFilt);
      this.deck.port.onmessage = e => { this.deckPos = e.data; };
      this.glitchNode = new AudioWorkletNode(c, 'glitch', { outputChannelCount: [2] });
      this.pre.connect(this.glitchNode).connect(this.out);
    } catch (e) { this.pre.connect(this.out); }
    this.out.connect(this.lim).connect(c.destination);
    const names = Object.keys(manifest);
    let done = 0;
    const total = names.reduce((s, k) => s + manifest[k], 0) + 1;
    const load = async file => {
      const r = await fetch('audio/' + file);
      if (!r.ok) throw new Error(file);
      const ab = await r.arrayBuffer();
      const b = await new Promise((ok, no) => c.decodeAudioData(ab, ok, no));
      onProgress?.(++done / total);
      return b;
    };
    const jobs = [];
    for (const k of names) {
      const n = manifest[k];
      this.takes[k] = [];
      for (let i = 1; i <= n; i++) {
        const file = n > 1 ? `${k}_${i}.mp3` : `${k}.${k === 'crackle' ? 'flac' : 'mp3'}`;
        jobs.push(load(file).then(b => { this.takes[k].push(b); }).catch(() => {}));
      }
    }
    jobs.push(load('source.mp3').then(b => {
      this.source = b;
      if (this.deck) {
        const ch = [b.getChannelData(0).slice(0), (b.numberOfChannels > 1 ? b.getChannelData(1) : b.getChannelData(0)).slice(0)];
        this.deck.port.postMessage({ type: 'load', ch }, ch.map(a => a.buffer));
      }
    }).catch(() => {}));
    await Promise.all(jobs);
  }

  resume() { if (this.ctx.state !== 'running') this.ctx.resume(); }
  setMuted(m) { this.muted = m; this.out.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05); }

  reversed(b) {
    if (this.rev.has(b)) return this.rev.get(b);
    const r = this.ctx.createBuffer(b.numberOfChannels, b.length, b.sampleRate);
    for (let ch = 0; ch < b.numberOfChannels; ch++) { const s = b.getChannelData(ch), d = r.getChannelData(ch); for (let i = 0, n = s.length; i < n; i++) d[i] = s[n - 1 - i]; }
    this.rev.set(b, r);
    return r;
  }

  play(name, o = {}) {
    const list = this.takes[name];
    if (!list || !list.length || this.muted) return null;
    const c = this.ctx, t = c.currentTime + (o.at || 0);
    let b = pick(list);
    const psy = o.psy ?? 0;
    const rev = o.reverse ?? (Math.random() < psy * 0.35);
    if (rev) b = this.reversed(b);
    const s = c.createBufferSource(); s.buffer = b;
    let rate = o.rate ?? 1;
    if (Math.random() < psy * 0.7) rate *= pick([0.5, 0.62, 0.75, 1.33, 1.5, 2]);
    s.playbackRate.value = rate;
    if (o.detune) s.detune.value = o.detune;
    if (Math.random() < psy * 0.5) {
      const w = c.createOscillator(); w.frequency.value = 3 + Math.random() * 9; const wg = c.createGain(); wg.gain.value = 60 + Math.random() * 300;
      w.connect(wg).connect(s.detune); w.start(t); w.stop(t + b.duration / rate + 0.1);
    }
    const g = c.createGain(); g.gain.value = db(o.gain ?? 0);
    s.connect(g);
    if (o.boost) g.connect(this.boost); else g.connect(this.sfx);
    if (o.echo || Math.random() < psy * 0.4) { const e = c.createGain(); e.gain.value = o.echo ?? 0.6; g.connect(e).connect(this.dIn); this.dIn.gain.value = 1; }
    if (o.verb) { const v = c.createGain(); v.gain.value = o.verb; g.connect(v).connect(this.verbIn); }
    s.start(t, o.offset || 0);
    if (o.dur) s.stop(t + o.dur);
    return s;
  }

  loop(name, o = {}) {
    const list = this.takes[name];
    if (!list || !list.length) return { set() {}, stop() {}, rate() {} };
    const c = this.ctx, s = c.createBufferSource();
    s.buffer = list[0]; s.loop = true;
    const g = c.createGain(); g.gain.value = 0;
    s.connect(g).connect(o.boost ? this.boost : this.sfx);
    s.start();
    const h = {
      set: (v, tc = 0.15) => g.gain.setTargetAtTime(db(v), c.currentTime, tc),
      off: (tc = 0.2) => g.gain.setTargetAtTime(0, c.currentTime, tc),
      rate: (r, tc = 0.05) => s.playbackRate.setTargetAtTime(r, c.currentTime, tc),
      stop: () => { g.gain.setTargetAtTime(0, c.currentTime, 0.2); setTimeout(() => s.stop(), 1500); },
    };
    if (o.gain != null) h.set(o.gain, o.tc ?? 0.4);
    return h;
  }

  segment(i, o = {}) {
    if (!this.deck) return;
    const [a, b] = SEG[i];
    this.deck.port.postMessage({ type: 'seg', a: o.a ?? a, b: o.b ?? b, off: o.off || 0, jump: o.jump, loop: o.loop });
    if (o.rate != null) this.rate(o.rate, o.smooth, true);
  }
  rate(v, smooth, now) { this.deck?.port.postMessage({ type: 'rate', v, smooth, now }); }
  deckLevel(v, tc = 0.15) { this.deckGain.gain.setTargetAtTime(v <= -60 ? 0 : db(v), this.ctx.currentTime, tc); }
  deckTone(hz, tc = 0.1) { this.deckFilt.frequency.setTargetAtTime(hz, this.ctx.currentTime, tc); }
  deckStutter(len) { this.deck?.port.postMessage({ type: 'stutter', len }); }

  stutter(len, dur) {
    if (!this.glitchNode) return;
    this.glitchNode.port.postMessage({ type: 'stutter', len });
    clearTimeout(this._st);
    if (dur) this._st = setTimeout(() => this.glitchNode.port.postMessage({ type: 'stutter', len: 0 }), dur * 1000);
  }
  crush(bits, down) { this.glitchNode?.port.postMessage({ type: 'crush', bits, down }); }
  psyEcho(v) { this.fb.gain.setTargetAtTime(Math.min(0.82, v), this.ctx.currentTime, 0.2); }

  meter() {
    this.analyser.getFloatTimeDomainData(this.an);
    let s = 0; for (let i = 0; i < this.an.length; i++) s += this.an[i] * this.an[i];
    const rms = Math.sqrt(s / this.an.length);
    this.level += (rms - this.level) * 0.3;
    return rms;
  }
}
