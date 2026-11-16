// Everything you hear is synthesised here. No samples, no downloads.
export class Audio {
  constructor() { this.ctx = null; this.muted = false; this.musicMood = 'calm'; }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5;
    this.master.connect(comp).connect(ctx.destination);
    // reverb
    const len = ctx.sampleRate * 2.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.rev = ctx.createConvolver(); this.rev.buffer = ir;
    const rg = ctx.createGain(); rg.gain.value = 0.35; this.rev.connect(rg).connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(this.master); this.sfx.connect(this.rev);
    this.music = ctx.createGain(); this.music.gain.value = 0.0; this.music.connect(this.master); this.music.connect(this.rev);
    // noise buffer
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    this._startMusic();
  }

  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05); }

  // --- music: slow generative pad + sparse plucks, mood changes the chord set ---
  _startMusic() {
    const ctx = this.ctx;
    this.music.gain.setTargetAtTime(0.32, ctx.currentTime, 2);
    const moods = {
      calm: { chords: [[220, 277.2, 329.6, 415.3], [174.6, 220, 261.6, 329.6], [196, 246.9, 293.7, 370], [164.8, 207.7, 246.9, 311.1]], bar: 6, pluck: 0.5 },
      tense: { chords: [[110, 130.8, 164.8, 196], [103.8, 130.8, 155.6, 196], [116.5, 138.6, 164.8, 207.7], [98, 123.5, 146.8, 185]], bar: 3, pluck: 0.9 },
      glitch: { chords: [[146.8, 174.6, 220, 277.2], [138.6, 174.6, 207.7, 261.6], [155.6, 185, 233.1, 277.2], [130.8, 164.8, 196, 246.9]], bar: 2.4, pluck: 1 },
      reveal: { chords: [[261.6, 329.6, 392, 493.9], [220, 261.6, 329.6, 392], [174.6, 220, 261.6, 349.2], [196, 246.9, 293.7, 392]], bar: 5, pluck: 0.7 },
    };
    let i = 0, next = ctx.currentTime + 0.2;
    const tick = () => {
      if (!this.ctx) return;
      while (next < ctx.currentTime + 0.5) {
        const m = moods[this.musicMood] || moods.calm, ch = m.chords[i++ % m.chords.length];
        for (const f of ch) this._pad(f, next, m.bar * 1.25);
        this._pad(ch[0] / 2, next, m.bar * 1.25, 0.09);
        const n = Math.round(m.bar * 2 * m.pluck);
        for (let k = 0; k < n; k++) if (Math.random() < 0.7) this._pluck(ch[(Math.random() * 4) | 0] * (Math.random() < 0.4 ? 4 : 2), next + (k / n) * m.bar + (this.musicMood === 'glitch' ? Math.random() * 0.08 : 0));
        if (this.musicMood === 'tense' || this.musicMood === 'glitch') for (let k = 0; k < m.bar * 2; k++) this._kick(next + k * 0.5, k % 2 ? 0.25 : 0.5);
        next += m.bar;
      }
      setTimeout(tick, 200);
    };
    tick();
  }
  _pad(f, t, dur, vol = 0.05) {
    const ctx = this.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.5;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
    for (const det of [-6, 5]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 0.1); }
    lp.connect(g).connect(this.music);
  }
  _pluck(f, t) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(g).connect(this.music); o.start(t); o.stop(t + 1.5);
  }
  _kick(t, vol) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.16);
    g.gain.setValueAtTime(vol * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(this.music); o.start(t); o.stop(t + 0.3);
  }
  mood(m) { this.musicMood = m; }

  // --- sfx ---
  _noise(dur, { f = 800, q = 0.7, type = 'lowpass', vol = 0.5, f2 = null, t0 = 0 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + t0, s = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.noiseBuf; s.loop = true; flt.type = type; flt.frequency.setValueAtTime(f, t); flt.Q.value = q;
    if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(flt).connect(g).connect(this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  _tone(f, dur, { type = 'sine', vol = 0.2, f2 = null, t0 = 0, attack = 0.005 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + t0, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  blip(speaker) {
    const base = { narrador: 190, robot: 620, pelusa: 1250, villano: 85, creador: 330, sistema: 440 }[speaker] || 400;
    const type = { narrador: 'triangle', robot: 'square', pelusa: 'sine', villano: 'sawtooth', creador: 'sine', sistema: 'square' }[speaker] || 'sine';
    this._tone(base * (0.9 + Math.random() * 0.25), 0.05, { type, vol: speaker === 'robot' ? 0.035 : 0.06 });
  }
  thud(power = 1) {
    const p = Math.min(power, 1.5);
    this._tone(90, 0.25, { vol: 0.5 * p, f2: 35 }); this._noise(0.2, { f: 600, vol: 0.35 * p, f2: 120 });
  }
  clank(power = 1) { const p = Math.min(power, 1.2); for (const f of [520, 831, 1370]) this._tone(f * (0.9 + Math.random() * 0.2), 0.3, { type: 'square', vol: 0.05 * p }); this._noise(0.08, { f: 3000, type: 'highpass', vol: 0.2 * p }); }
  pianoCrash() {
    for (let i = 0; i < 16; i++) { const f = 55 * Math.pow(2, Math.random() * 5); this._tone(f, 2.6, { type: i % 2 ? 'triangle' : 'sawtooth', vol: 0.09, t0: Math.random() * 0.07 }); }
    this.thud(1.5); this._noise(1.2, { f: 2400, vol: 0.4, f2: 200 });
  }
  dash() { this._noise(0.28, { f: 500, f2: 3200, type: 'bandpass', q: 2, vol: 0.35 }); this._tone(180, 0.2, { type: 'sawtooth', vol: 0.08, f2: 520 }); }
  whoosh() { this._noise(0.9, { f: 300, f2: 2400, type: 'bandpass', q: 1.2, vol: 0.3 }); }
  explode() { this._noise(1.4, { f: 1800, f2: 60, vol: 0.9 }); this._tone(70, 0.9, { vol: 0.7, f2: 22 }); }
  clean() { for (let i = 0; i < 3; i++) this._tone(660 * Math.pow(1.26, i), 0.25, { vol: 0.12, t0: i * 0.07 }); }
  choice() { this._tone(392, 0.5, { type: 'triangle', vol: 0.18 }); this._tone(587.3, 0.7, { type: 'triangle', vol: 0.14, t0: 0.09 }); }
  ui() { this._tone(880, 0.06, { vol: 0.07 }); }
  alarm() { for (let i = 0; i < 3; i++) this._tone(300, 0.22, { type: 'sawtooth', vol: 0.12, f2: 620, t0: i * 0.28 }); }
  revUp() { this._tone(60, 1.1, { type: 'sawtooth', vol: 0.22, f2: 240 }); this._noise(1.1, { f: 200, f2: 1800, type: 'bandpass', vol: 0.2 }); }
  glitch() { for (let i = 0; i < 7; i++) this._tone(100 + Math.random() * 2400, 0.05, { type: 'square', vol: 0.08, t0: i * 0.045 }); }
  rumble(d = 2) { this._noise(d, { f: 90, vol: 0.9, q: 1 }); }
  powerdown() { this._tone(520, 1.6, { type: 'sawtooth', vol: 0.2, f2: 30 }); }
  chime() { [523.3, 659.3, 784, 1046.5].forEach((f, i) => this._tone(f, 1.8, { type: 'triangle', vol: 0.12, t0: i * 0.16 })); }
  beep(up = true) { this._tone(up ? 900 : 700, 0.09, { vol: 0.1 }); this._tone(up ? 1350 : 500, 0.12, { vol: 0.1, t0: 0.09 }); }
}
