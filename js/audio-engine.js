class AudioEngine {
  constructor() {
    this.ctx = null;
    this.kit = '808';
  }

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  ensure() {
    if (this.ctx.state === 'suspended') return this.ctx.resume();
    return Promise.resolve();
  }

  play(pad) {
    this.ensure();
    if (this.kit === '808') this['_808_' + pad]();
    else this['_ac_' + pad]();
  }

  /* ─── NOISE HELPER ─── */
  _noise(dur, gainVal) {
    const sr = this.ctx.sampleRate;
    const len = sr * dur;
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    src.connect(g);
    return { src, g };
  }

  _osc(type, freq, gainVal, dur, freqEnd) {
    const o = this.ctx.createOscillator();
    o.type = type;
    const t = this.ctx.currentTime;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd !== undefined) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainVal, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    return { src: o, g, dur };
  }

  _connect(...nodes) {
    const dest = this.ctx.destination;
    for (const n of nodes) {
      n.g.connect(dest);
      n.src.start();
      const dur = n.src.buffer ? n.src.buffer.duration : (n.dur || 0.5);
      n.src.stop(this.ctx.currentTime + dur);
    }
  }

  /* ═══════════════════════ 808 KIT ═══════════════════════ */

  _808_0() { // Kick
    const { src, g } = this._osc('sine', 150, 1.2, 0.35, 40);
    g.connect(this.ctx.destination);
    src.start();
    src.stop(this.ctx.currentTime + 0.35);
  }

  _808_1() { // Snare
    const t = this.ctx.currentTime;
    const n = this._noise(0.25, 0.45);
    const o = this._osc('sine', 200, 0.7, 0.12);
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 500;
    n.src.connect(f);
    f.connect(n.g);
    this._connect(n, o);
  }

  _808_2() { // Closed HH
    const n = this._noise(0.06, 0.25);
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 9000;
    n.src.connect(f).connect(n.g);
    n.g.connect(this.ctx.destination);
    n.src.start();
    n.src.stop(this.ctx.currentTime + 0.06);
  }

  _808_3() { // Open HH
    const n = this._noise(0.5, 0.2);
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    n.src.connect(f).connect(n.g);
    n.g.connect(this.ctx.destination);
    n.src.start();
    n.src.stop(this.ctx.currentTime + 0.5);
  }

  _808_4() { // Clap
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const n = this._noise(0.08, 0.18);
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 2000;
      n.src.connect(f).connect(n.g);
      const g2 = this.ctx.createGain();
      g2.gain.setValueAtTime(0.8, t + i * 0.015);
      g2.gain.exponentialRampToValueAtTime(0.001, t + i * 0.015 + 0.08);
      n.g.connect(g2).connect(this.ctx.destination);
      n.src.start(t + i * 0.015);
      n.src.stop(t + i * 0.015 + 0.08);
    }
  }

  _808_5() { // Tom Low
    const { src, g } = this._osc('sine', 90, 0.7, 0.28, 55);
    g.connect(this.ctx.destination);
    src.start();
    src.stop(this.ctx.currentTime + 0.28);
  }

  _808_6() { // Tom High
    const { src, g } = this._osc('sine', 160, 0.65, 0.25, 100);
    g.connect(this.ctx.destination);
    src.start();
    src.stop(this.ctx.currentTime + 0.25);
  }

  _808_7() { // Rimshot
    const t = this.ctx.currentTime;
    const n = this._noise(0.04, 0.25);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 3000;
    f.Q.value = 5;
    n.src.connect(f).connect(n.g);
    const o = this._osc('sine', 350, 0.4, 0.06);
    this._connect(n, o);
  }

  _808_8() { // Crash
    const n = this._noise(1.8, 0.3);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 6000;
    n.src.connect(f).connect(n.g);
    n.g.connect(this.ctx.destination);
    n.src.start();
    n.src.stop(this.ctx.currentTime + 1.8);
  }

  /* ═══════════════════ ACOUSTIC KIT ═══════════════════ */

  _ac_0() { // Kick
    const { src, g } = this._osc('sine', 100, 1.0, 0.4, 30);
    g.connect(this.ctx.destination);
    src.start();
    src.stop(this.ctx.currentTime + 0.4);
  }

  _ac_1() { // Snare
    const n = this._noise(0.22, 0.55);
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 300;
    n.src.connect(f).connect(n.g);
    const o = this._osc('sine', 180, 0.5, 0.1);
    this._connect(n, o);
  }

  _ac_2() { // Closed HH
    const n = this._noise(0.05, 0.2);
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 10000;
    n.src.connect(f).connect(n.g);
    n.g.connect(this.ctx.destination);
    n.src.start();
    n.src.stop(this.ctx.currentTime + 0.05);
  }

  _ac_3() { // Open HH
    const n = this._noise(0.45, 0.15);
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 8000;
    n.src.connect(f).connect(n.g);
    n.g.connect(this.ctx.destination);
    n.src.start();
    n.src.stop(this.ctx.currentTime + 0.45);
  }

  _ac_4() { // Clap
    const t = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const n = this._noise(0.06, 0.15);
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 3000;
      n.src.connect(f).connect(n.g);
      const g2 = this.ctx.createGain();
      g2.gain.setValueAtTime(0.7, t + i * 0.012);
      g2.gain.exponentialRampToValueAtTime(0.001, t + i * 0.012 + 0.06);
      n.g.connect(g2).connect(this.ctx.destination);
      n.src.start(t + i * 0.012);
      n.src.stop(t + i * 0.012 + 0.06);
    }
  }

  _ac_5() { // Tom Low
    const { src, g } = this._osc('triangle', 75, 0.6, 0.3, 50);
    g.connect(this.ctx.destination);
    src.start();
    src.stop(this.ctx.currentTime + 0.3);
  }

  _ac_6() { // Tom High
    const { src, g } = this._osc('triangle', 140, 0.55, 0.27, 95);
    g.connect(this.ctx.destination);
    src.start();
    src.stop(this.ctx.currentTime + 0.27);
  }

  _ac_7() { // Rimshot
    const n = this._noise(0.03, 0.3);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 4000;
    f.Q.value = 8;
    n.src.connect(f).connect(n.g);
    const o = this._osc('sine', 400, 0.35, 0.05);
    this._connect(n, o);
  }

  _ac_8() { // Crash
    const n = this._noise(2.0, 0.25);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 8000;
    n.src.connect(f).connect(n.g);
    n.g.connect(this.ctx.destination);
    n.src.start();
    n.src.stop(this.ctx.currentTime + 2.0);
  }
}
