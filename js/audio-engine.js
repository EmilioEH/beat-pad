/* ═══════════════════════════════════════════════════════════════
   KIT DEFINITIONS — data, not code.
   Adding a kit is an edit to this table; no new synthesis code.
   Voice types: 'osc' | 'noise' | 'noise+osc' | 'clap'
   ═══════════════════════════════════════════════════════════════ */
const KITS = {
  boom: {
    label: 'Boom',
    voices: {
      kick:  { type: 'osc', wave: 'sine', freq: 150, freqEnd: 40, gain: 1.0, dur: 0.35 },
      snare: { type: 'noise+osc',
               noise: { gain: 0.45, dur: 0.25, filter: { type: 'highpass', freq: 500 } },
               osc:   { wave: 'sine', freq: 200, gain: 0.6, dur: 0.12 } },
      chh:   { type: 'noise', gain: 0.30, dur: 0.06, filter: { type: 'highpass', freq: 9000 } },
      ohh:   { type: 'noise', gain: 0.24, dur: 0.50, filter: { type: 'highpass', freq: 7000 } },
      clap:  { type: 'clap', bursts: 3, spread: 0.015, gain: 0.35, dur: 0.08,
               filter: { type: 'lowpass', freq: 2000 } },
      tomL:  { type: 'osc', wave: 'sine', freq: 90, freqEnd: 55, gain: 0.7, dur: 0.28 },
      tomH:  { type: 'osc', wave: 'sine', freq: 160, freqEnd: 100, gain: 0.65, dur: 0.25 },
      rim:   { type: 'noise+osc',
               noise: { gain: 0.35, dur: 0.04, filter: { type: 'bandpass', freq: 3000, Q: 5 } },
               osc:   { wave: 'sine', freq: 350, gain: 0.4, dur: 0.06 } },
      crash: { type: 'noise', gain: 0.30, dur: 1.6, filter: { type: 'lowpass', freq: 6000 } },
    },
  },

  band: {
    label: 'Band',
    voices: {
      kick:  { type: 'osc', wave: 'sine', freq: 100, freqEnd: 30, gain: 0.95, dur: 0.40 },
      snare: { type: 'noise+osc',
               noise: { gain: 0.55, dur: 0.22, filter: { type: 'highpass', freq: 300 } },
               osc:   { wave: 'sine', freq: 180, gain: 0.45, dur: 0.10 } },
      chh:   { type: 'noise', gain: 0.26, dur: 0.05, filter: { type: 'highpass', freq: 10000 } },
      ohh:   { type: 'noise', gain: 0.20, dur: 0.45, filter: { type: 'highpass', freq: 8000 } },
      clap:  { type: 'clap', bursts: 4, spread: 0.012, gain: 0.30, dur: 0.06,
               filter: { type: 'lowpass', freq: 3000 } },
      tomL:  { type: 'osc', wave: 'triangle', freq: 75, freqEnd: 50, gain: 0.6, dur: 0.30 },
      tomH:  { type: 'osc', wave: 'triangle', freq: 140, freqEnd: 95, gain: 0.55, dur: 0.27 },
      rim:   { type: 'noise+osc',
               noise: { gain: 0.40, dur: 0.03, filter: { type: 'bandpass', freq: 4000, Q: 8 } },
               osc:   { wave: 'sine', freq: 400, gain: 0.35, dur: 0.05 } },
      crash: { type: 'noise', gain: 0.26, dur: 1.8, filter: { type: 'lowpass', freq: 8000 } },
    },
  },

  toy: {
    label: 'Toy',
    voices: {
      kick:  { type: 'osc', wave: 'triangle', freq: 320, freqEnd: 90, gain: 0.8, dur: 0.22 },
      snare: { type: 'noise+osc',
               noise: { gain: 0.30, dur: 0.14, filter: { type: 'bandpass', freq: 1800, Q: 2 } },
               osc:   { wave: 'square', freq: 520, freqEnd: 300, gain: 0.22, dur: 0.10 } },
      chh:   { type: 'noise', gain: 0.22, dur: 0.05, filter: { type: 'bandpass', freq: 7000, Q: 3 } },
      ohh:   { type: 'noise', gain: 0.18, dur: 0.35, filter: { type: 'bandpass', freq: 5000, Q: 2 } },
      clap:  { type: 'clap', bursts: 3, spread: 0.02, gain: 0.28, dur: 0.07,
               filter: { type: 'bandpass', freq: 2500, Q: 1.5 } },
      tomL:  { type: 'osc', wave: 'square', freq: 260, freqEnd: 150, gain: 0.30, dur: 0.20 },
      tomH:  { type: 'osc', wave: 'square', freq: 440, freqEnd: 280, gain: 0.28, dur: 0.18 },
      rim:   { type: 'osc', wave: 'square', freq: 900, freqEnd: 700, gain: 0.20, dur: 0.05 },
      crash: { type: 'noise', gain: 0.24, dur: 1.2, filter: { type: 'bandpass', freq: 4500, Q: 1 } },
    },
  },
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.kit = 'boom';
    this.master = null;
    this._noiseBuf = null;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Master chain: everything routes through here so simultaneous pads
    // can't sum past full scale. Small ears, cheap speakers, no clipping.
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;

    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;

    this.master.connect(limiter).connect(this.ctx.destination);
  }

  /** Browsers start the context suspended until a user gesture. */
  unlock() {
    if (!this.ctx || this.ctx.state === 'running') return Promise.resolve();
    return this.ctx.resume();
  }

  get running() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  setVolume(v) {
    if (this.master) this.master.gain.value = Math.max(0, Math.min(1, v));
  }

  setKit(name) {
    if (KITS[name]) this.kit = name;
  }

  /**
   * Fire a voice by name at an explicit audio-clock time.
   * `when` omitted means "now" (a live pad tap).
   */
  play(voice, when) {
    if (!this.ctx) return;
    const spec = KITS[this.kit].voices[voice];
    if (!spec) return;
    const t = when === undefined ? this.ctx.currentTime : when;
    for (const node of this._render(spec, t)) node.connect(this.master);
  }

  /** Reward sound: a short rising sparkle, not part of any kit. */
  sparkle(when) {
    if (!this.ctx) return;
    const t = when === undefined ? this.ctx.currentTime : when;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const g = this._oscVoice(
        { wave: 'triangle', freq: f, gain: 0.22, dur: 0.28 },
        t + i * 0.07
      );
      g.connect(this.master);
    });
  }

  /* ─── voice renderers ─── */

  _render(spec, when) {
    switch (spec.type) {
      case 'osc':
        return [this._oscVoice(spec, when)];
      case 'noise':
        return [this._noiseVoice(spec, when)];
      case 'noise+osc':
        return [this._noiseVoice(spec.noise, when), this._oscVoice(spec.osc, when)];
      case 'clap':
        return this._clapVoice(spec, when);
      default:
        return [];
    }
  }

  _oscVoice(spec, when) {
    const o = this.ctx.createOscillator();
    o.type = spec.wave;
    o.frequency.setValueAtTime(spec.freq, when);
    if (spec.freqEnd !== undefined) {
      o.frequency.exponentialRampToValueAtTime(spec.freqEnd, when + spec.dur);
    }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(spec.gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + spec.dur);
    o.connect(g);
    o.start(when);
    o.stop(when + spec.dur + 0.02);
    return g;
  }

  _noiseVoice(spec, when) {
    const buf = this._noiseBuffer();
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(spec.gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + spec.dur);

    // One place where the filter is wired, so it can't be bypassed.
    if (spec.filter) src.connect(this._filter(spec.filter)).connect(g);
    else src.connect(g);

    const maxOffset = Math.max(0, buf.duration - spec.dur - 0.01);
    src.start(when, Math.random() * maxOffset, spec.dur);
    return g;
  }

  _clapVoice(spec, when) {
    const out = [];
    for (let i = 0; i < spec.bursts; i++) {
      out.push(
        this._noiseVoice(
          { gain: spec.gain, dur: spec.dur, filter: spec.filter },
          when + i * spec.spread
        )
      );
    }
    return out;
  }

  _filter(f) {
    const node = this.ctx.createBiquadFilter();
    node.type = f.type;
    node.frequency.value = f.freq;
    if (f.Q !== undefined) node.Q.value = f.Q;
    return node;
  }

  /** One shared noise buffer, generated once, read from a random offset. */
  _noiseBuffer() {
    if (!this._noiseBuf) {
      const sr = this.ctx.sampleRate;
      const len = Math.floor(sr * 3);
      const buf = this.ctx.createBuffer(1, len, sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this._noiseBuf = buf;
    }
    return this._noiseBuf;
  }
}
