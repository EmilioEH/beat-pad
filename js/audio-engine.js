/* ═══════════════════════════════════════════════════════════════
   AUDIO ENGINE

   A voice is a list of layers. Each layer is one of four sources —
   osc, noise, metal, sample — with its own envelope, filter, pan,
   drive and time offset. Everything a kit can say is said in the
   layer table (js/packs.js); this file only knows how to render it.

   Four things here that the first version got wrong, because they
   are the difference between "synthesized" and "a drum machine":

   1. Hits vary. Every voice can jitter its pitch, gain and filter a
      little per hit. Identical repeats are the machine-gun tell.
   2. Pitch and amplitude have separate envelopes. A kick drops pitch
      in ~40 ms and then rings for 400. Sliding the pitch across the
      whole decay is what makes a synth kick sound like a "boop".
   3. Transients exist. A few ms of filtered noise on top of the body,
      plus harmonic drive, is what makes a kick audible at all on a
      phone speaker that cannot reproduce 40 Hz.
   4. Metal is metal. A hi-hat is detuned squares through a highpass,
      not white noise. That is where the shimmer comes from.
   ═══════════════════════════════════════════════════════════════ */

/** Applied when a voice does not name its own. Small on purpose. */
const DEFAULT_JITTER = { pitch: 0.015, gain: 0.06, filter: 0.05 };

/** Quiet hits are darker as well as quieter — that is what makes velocity read. */
const VEL_FLOOR = 0.28;    // a velocity-0 hit still sounds, at this share of gain
const VEL_TONE_LO = 700;   // lowpass corner at the softest hit
const VEL_TONE_HI = 19000; // ...and at the hardest

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.packId = null;
    this.pack = null;

    this.master = null;
    this.voiceBus = null;
    this.reverbSend = null;

    this._noiseBuf = null;
    this._samples = new Map();  // 'packId:voice' -> { hard: [AudioBuffer], soft: [AudioBuffer] }
    this._rr = new Map();       // round-robin cursor per sample key
    this._trim = 1;
  }

  /** @param {BaseAudioContext} [ctx] supply one to render offline, e.g. in tests */
  init(ctx) {
    if (this.ctx) return;
    this.ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    ctx = this.ctx;

    // ── Master chain ──────────────────────────────────────────────
    //
    //   voices → voiceBus → saturator ─┬─────────────→ mix → limiter → master → out
    //                                  └→ send → verb ─┘
    //
    // Saturation before the split so the reverb hears the same glue the
    // dry path does. The limiter still backstops everything, because a
    // child holding six pads at once must not clip a cheap speaker.

    this.voiceBus = ctx.createGain();
    this.voiceBus.gain.value = 1;

    const sat = ctx.createWaveShaper();
    sat.curve = this._saturationCurve(1.7);
    sat.oversample = '2x';

    const mix = ctx.createGain();
    mix.gain.value = 1;

    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0;   // packs dial this in

    // Keep the low end out of the reverb or the kick turns to mud, and
    // roll off the very top so the tail sits behind the kit.
    const sendHP = ctx.createBiquadFilter();
    sendHP.type = 'highpass';
    sendHP.frequency.value = 320;
    const sendLP = ctx.createBiquadFilter();
    sendLP.type = 'lowpass';
    sendLP.frequency.value = 7200;

    const verb = ctx.createConvolver();
    verb.buffer = this._impulse(1.15, 2.8);

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;

    this.master = ctx.createGain();
    this.master.gain.value = 0.7;

    this.voiceBus.connect(sat);
    sat.connect(mix);
    sat.connect(this.reverbSend);
    this.reverbSend.connect(sendHP).connect(sendLP).connect(verb).connect(mix);
    mix.connect(limiter).connect(this.master).connect(ctx.destination);
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

  /**
   * Swap the active pack. Packs carry their own output trim and reverb
   * amount so switching mid-loop doesn't jump in level or space.
   */
  setPack(id) {
    const pack = resolvePack(id);
    if (!pack) return false;
    this.packId = id;
    this.pack = pack;
    this._trim = pack.trim === undefined ? 1 : pack.trim;
    if (this.reverbSend) {
      this.reverbSend.gain.value = pack.space === undefined ? 0.12 : pack.space;
    }
    return true;
  }

  /** True when the pack defines this voice — pads for undefined voices stay dark. */
  has(voice) {
    return !!(this.pack && this.pack.voices[voice]);
  }

  /**
   * Fire a voice at an explicit audio-clock time.
   * `when` omitted means "now" (a live pad tap). `vel` is 0..1.
   */
  play(voice, when, vel = 1) {
    if (!this.ctx || !this.pack) return;
    const spec = this.pack.voices[voice];
    if (!spec) return;

    const t = when === undefined ? this.ctx.currentTime : when;
    const v = Math.max(0, Math.min(1, vel));
    const jitter = spec.jitter === undefined ? DEFAULT_JITTER : spec.jitter;

    for (const layer of spec.layers) {
      const node = this._layer(layer, t, v, jitter, voice);
      if (node) node.connect(this.voiceBus);
    }
  }

  /** Reward sound: a short rising sparkle, not part of any pack. */
  sparkle(when) {
    if (!this.ctx) return;
    const t = when === undefined ? this.ctx.currentTime : when;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const g = this._osc(
        { wave: 'triangle', freq: f, gain: 0.22, dur: 0.28, attack: 0.004 },
        t + i * 0.07, 1, null
      );
      g.connect(this.voiceBus);
    });
  }

  /* ═══════════════ sample banks ═══════════════ */

  /**
   * Register decoded buffers for a pack.
   * @param {string} packId
   * @param {Object} banks  voice -> { hard: AudioBuffer[], soft?: AudioBuffer[] }
   */
  setSampleBank(packId, banks) {
    for (const [voice, entry] of Object.entries(banks)) {
      const hard = entry.hard || entry.variants || [];
      if (!hard.length) {
        this._samples.delete(packId + ':' + voice);
        continue;
      }
      this._samples.set(packId + ':' + voice, { hard, soft: entry.soft || null });
    }
  }

  clearSample(packId, voice) {
    this._samples.delete(packId + ':' + voice);
  }

  hasSample(packId, voice) {
    return this._samples.has(packId + ':' + voice);
  }

  /* ═══════════════ layer rendering ═══════════════ */

  _layer(l, when, vel, jitter, voice) {
    const t = when + (l.offset || 0);
    switch (l.src) {
      case 'osc':    return this._osc(l, t, vel, jitter);
      case 'noise':  return this._noise(l, t, vel, jitter);
      case 'metal':  return this._metal(l, t, vel, jitter);
      case 'sample': return this._sample(l, t, vel, jitter, voice);
      default:       return null;
    }
  }

  /**
   * Shared tail for every layer: velocity shaping, per-hit filter jitter,
   * optional drive, panning. Returns the node to connect to the bus.
   */
  _tail(l, source, when, vel, jitter) {
    const ctx = this.ctx;
    let node = source;

    if (l.filter) {
      const f = ctx.createBiquadFilter();
      f.type = l.filter.type;
      f.frequency.value = Math.max(20, l.filter.freq * this._jit(jitter, 'filter'));
      if (l.filter.Q !== undefined) f.Q.value = l.filter.Q;
      node = node.connect(f);
    }

    // Softer hits are duller. Skipping this is why velocity usually reads
    // as nothing more than a volume change.
    if (l.velTone !== false) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = VEL_TONE_LO + (VEL_TONE_HI - VEL_TONE_LO) * Math.pow(vel, 0.55);
      node = node.connect(lp);
    }

    if (l.drive) {
      const ws = ctx.createWaveShaper();
      ws.curve = this._saturationCurve(1 + l.drive * 6);
      ws.oversample = '2x';
      node = node.connect(ws);
    }

    if (l.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, l.pan));
      node = node.connect(p);
    }

    return node;
  }

  _envelope(when, gain, l, vel, jitter) {
    const g = this.ctx.createGain();
    // A transient layer can be shorter than the default attack; letting the
    // ramps cross would put the decay target before the peak.
    const attack = Math.min(l.attack === undefined ? 0.002 : l.attack, l.dur * 0.5);
    const peak = Math.max(
      0.0002,
      gain * this._velGain(vel, l.velCurve) * this._jit(jitter, 'gain') * this._trim
    );

    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + attack);
    if (l.curve === 'lin') {
      g.gain.linearRampToValueAtTime(0.0001, when + l.dur);
    } else {
      g.gain.exponentialRampToValueAtTime(0.0001, when + l.dur);
    }
    return g;
  }

  _osc(l, when, vel, jitter) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = l.wave || 'sine';

    const p = this._jit(jitter, 'pitch');
    const f0 = l.freq * p;
    o.frequency.setValueAtTime(f0, when);

    if (l.freqEnd !== undefined) {
      // The whole point: pitch falls over pitchDur, not over the full decay.
      const pd = l.pitchDur === undefined ? l.dur : l.pitchDur;
      o.frequency.exponentialRampToValueAtTime(Math.max(1, l.freqEnd * p), when + pd);
    }

    const g = this._envelope(when, l.gain, l, vel, jitter);
    this._tail(l, o, when, vel, jitter).connect(g);

    o.start(when);
    o.stop(when + l.dur + 0.02);
    return g;
  }

  _noise(l, when, vel, jitter) {
    const buf = this._noiseBuffer();
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const g = this._envelope(when, l.gain, l, vel, jitter);
    this._tail(l, src, when, vel, jitter).connect(g);

    // Reading from a random offset is free variation on every noise hit.
    const maxOffset = Math.max(0, buf.duration - l.dur - 0.01);
    src.start(when, Math.random() * maxOffset, l.dur + 0.02);
    return g;
  }

  /**
   * The 808 hi-hat/cymbal trick: a handful of square waves at inharmonic
   * ratios, filtered hard so only the clangorous top survives.
   */
  _metal(l, when, vel, jitter) {
    const ctx = this.ctx;
    const ratios = l.ratios || [2, 3, 4.16, 5.43, 6.79, 8.21];
    const base = (l.base || 40) * this._jit(jitter, 'pitch');

    const sum = ctx.createGain();
    sum.gain.value = 1 / Math.sqrt(ratios.length);

    for (const r of ratios) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = base * r;
      o.connect(sum);
      o.start(when);
      o.stop(when + l.dur + 0.02);
    }

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = l.hp === undefined ? 7000 : l.hp;

    const g = this._envelope(when, l.gain, l, vel, jitter);
    this._tail(l, sum.connect(hp), when, vel, jitter).connect(g);
    return g;
  }

  /**
   * Sample playback with round-robin variants and soft/hard velocity
   * layers. Recorded pads and downloadable packs both land here.
   */
  _sample(l, when, vel, jitter, voice) {
    const key = (l.pack || this.packId) + ':' + (l.voice || voice);
    const bank = this._samples.get(key);
    if (!bank) return null;

    const list = (bank.soft && vel < 0.55) ? bank.soft : bank.hard;
    if (!list.length) return null;

    const cursor = (this._rr.get(key) || 0) % list.length;
    this._rr.set(key, cursor + 1);
    const buf = list[cursor];

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = (l.rate || 1) * this._jit(jitter, 'pitch');

    // A sample layer plays its whole buffer unless the pack shortens it.
    const dur = l.dur === undefined
      ? buf.duration / src.playbackRate.value
      : l.dur;

    const g = this._envelope(when, l.gain === undefined ? 1 : l.gain,
                             { ...l, dur }, vel, jitter);
    this._tail(l, src, when, vel, jitter).connect(g);

    src.start(when);
    src.stop(when + dur + 0.02);
    return g;
  }

  /* ═══════════════ helpers ═══════════════ */

  /** Velocity never goes fully silent — a soft tap must still be heard. */
  _velGain(vel, curve) {
    const v = Math.pow(vel, curve === undefined ? 1.4 : curve);
    return VEL_FLOOR + (1 - VEL_FLOOR) * v;
  }

  /** A multiplier around 1 for the named jitter dimension. */
  _jit(jitter, key) {
    if (!jitter) return 1;
    const amount = jitter[key];
    if (!amount) return 1;
    return 1 + (Math.random() * 2 - 1) * amount;
  }

  /** Soft-clip curve. k near 1 is almost linear; larger is more glue. */
  _saturationCurve(k) {
    const n = 1024;
    const curve = new Float32Array(n);
    const norm = Math.tanh(k);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(k * x) / norm;
    }
    return curve;
  }

  /** Decaying noise burst — a small room, generated so we ship no assets. */
  _impulse(seconds, decay) {
    const sr = this.ctx.sampleRate;
    const len = Math.max(1, Math.floor(sr * seconds));
    const buf = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AudioEngine, DEFAULT_JITTER };
}
