/* ═══════════════════════════════════════════════════════════════
   SAMPLER — record your own sounds into the pads.

   Clap, bang a saucepan, say "boots and cats" into the microphone,
   and play a beat with it. This is the most direct music-production
   idea in the app: sampling is where hip hop came from, and a child
   discovering that their own voice can be an instrument is the whole
   lesson in one tap.

   Recorded pads become the "My Sounds" pack, which extends Hip Hop —
   so a pad you haven't sampled yet still plays the 808 sound rather
   than going silently dead.

   Audio is stored as trimmed mono PCM in IndexedDB. That is bigger on
   disk than keeping the encoded blob, but it survives everything: no
   codec left to renegotiate at load time, no browser that can't decode
   what a different browser recorded.
   ═══════════════════════════════════════════════════════════════ */

const SAMPLE_DB = 'beat-pad-samples';
const SAMPLE_STORE = 'pads';
const SAMPLE_PACK = 'my';

const RECORD_MS = 1200;      // how long the microphone stays open
const MAX_SECONDS = 1.5;     // hard cap on what we keep
const TRIM_THRESHOLD = 0.02; // silence below this gets cut from the front
const FADE_SECONDS = 0.012;  // tail fade, so a chopped sample doesn't click

class Sampler {
  constructor(engine) {
    this.engine = engine;
    this.db = null;
    this.recording = false;
    this._voices = new Set();
    this.onChange = null;   // (voice, hasSample)
  }

  /** Microphone capture needs both of these, and a secure context. */
  get supported() {
    return !!(navigator.mediaDevices &&
              navigator.mediaDevices.getUserMedia &&
              typeof MediaRecorder !== 'undefined');
  }

  has(voice) {
    return this._voices.has(voice);
  }

  get count() {
    return this._voices.size;
  }

  /** Open the store and hand every saved pad back to the audio engine. */
  async init() {
    try {
      this.db = await this._open();
    } catch (_) {
      return;   // private mode, or IndexedDB blocked — recording still works, just not saved
    }

    let rows = [];
    try {
      rows = await this._all();
    } catch (_) {
      return;
    }

    const banks = {};
    for (const row of rows) {
      const buf = this._toBuffer(row.pcm, row.sampleRate);
      if (!buf) continue;
      banks[row.voice] = { hard: [buf] };
      this._voices.add(row.voice);
      this._installVoice(row.voice);
    }
    if (Object.keys(banks).length) this.engine.setSampleBank(SAMPLE_PACK, banks);
  }

  /**
   * Record one pad from the microphone.
   * Resolves when the sample is trimmed, stored and playable.
   */
  async record(voice) {
    if (this.recording) throw new Error('busy');
    if (!this.supported) throw new Error('unsupported');

    this.recording = true;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });
    } catch (_) {
      this.recording = false;
      throw new Error('denied');
    }

    try {
      const blob = await this._capture(stream);
      const raw = await this.engine.ctx.decodeAudioData(await blob.arrayBuffer());
      const buf = this._trim(raw);

      this.engine.setSampleBank(SAMPLE_PACK, { [voice]: { hard: [buf] } });
      this._voices.add(voice);
      this._installVoice(voice);
      await this._put(voice, buf);
      this.onChange?.(voice, true);
      return buf;
    } finally {
      stream.getTracks().forEach(t => t.stop());
      this.recording = false;
    }
  }

  async clear(voice) {
    this.engine.clearSample(SAMPLE_PACK, voice);
    this._voices.delete(voice);
    if (PACKS[SAMPLE_PACK]) delete PACKS[SAMPLE_PACK].voices[voice];
    try {
      await this._delete(voice);
    } catch (_) {
      // Nothing saved to remove; the live sound is already gone.
    }
    this.onChange?.(voice, false);
  }

  async clearAll() {
    for (const voice of Array.from(this._voices)) await this.clear(voice);
  }

  /* ═══════════════ capture and shaping ═══════════════ */

  _capture(stream) {
    return new Promise((resolve, reject) => {
      let mr;
      try {
        mr = new MediaRecorder(stream);
      } catch (_) {
        reject(new Error('unsupported'));
        return;
      }

      const chunks = [];
      mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      mr.onerror = () => reject(new Error('failed'));
      mr.onstop = () => {
        if (!chunks.length) reject(new Error('empty'));
        else resolve(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }));
      };

      mr.start();
      setTimeout(() => { if (mr.state !== 'inactive') mr.stop(); }, RECORD_MS);
    });
  }

  /**
   * Drop the silence before the sound starts, cap the length, fade the tail.
   * Without the leading trim every pad fires late by however long it took
   * the child to actually make a noise.
   */
  _trim(raw) {
    const ctx = this.engine.ctx;
    const src = raw.getChannelData(0);

    let start = 0;
    while (start < src.length && Math.abs(src[start]) < TRIM_THRESHOLD) start++;
    if (start >= src.length) start = 0;               // all quiet: keep it as-is
    start = Math.max(0, start - Math.floor(raw.sampleRate * 0.005));   // tiny pre-roll

    let end = src.length;
    const cap = start + Math.floor(raw.sampleRate * MAX_SECONDS);
    if (end > cap) end = cap;

    const len = Math.max(1, end - start);
    const out = ctx.createBuffer(1, len, raw.sampleRate);
    const dst = out.getChannelData(0);

    let peak = 0;
    for (let i = 0; i < len; i++) {
      dst[i] = src[start + i];
      const a = Math.abs(dst[i]);
      if (a > peak) peak = a;
    }

    // Normalise so a shy voice and a shouted one land at the same level.
    if (peak > 0.001) {
      const gain = Math.min(8, 0.92 / peak);
      for (let i = 0; i < len; i++) dst[i] *= gain;
    }

    const fade = Math.min(len, Math.floor(raw.sampleRate * FADE_SECONDS));
    for (let i = 0; i < fade; i++) {
      dst[len - 1 - i] *= i / fade;
    }
    return out;
  }

  /** Point the pack's voice at the sample source. */
  _installVoice(voice) {
    if (!PACKS[SAMPLE_PACK]) return;
    PACKS[SAMPLE_PACK].voices[voice] = {
      layers: [{ src: 'sample', pack: SAMPLE_PACK, voice, gain: 1, velTone: false }],
      jitter: { pitch: 0.01, gain: 0.05 },
    };
  }

  _toBuffer(pcm, sampleRate) {
    if (!pcm || !pcm.length) return null;
    const data = pcm instanceof Float32Array ? pcm : new Float32Array(pcm);
    const buf = this.engine.ctx.createBuffer(1, data.length, sampleRate || this.engine.ctx.sampleRate);
    buf.getChannelData(0).set(data);
    return buf;
  }

  /* ═══════════════ IndexedDB ═══════════════ */

  _open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(SAMPLE_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(SAMPLE_STORE)) {
          db.createObjectStore(SAMPLE_STORE, { keyPath: 'voice' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  _tx(mode) {
    return this.db.transaction(SAMPLE_STORE, mode).objectStore(SAMPLE_STORE);
  }

  _put(voice, buf) {
    if (!this.db) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const req = this._tx('readwrite').put({
        voice,
        pcm: buf.getChannelData(0).slice(),
        sampleRate: buf.sampleRate,
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  _delete(voice) {
    if (!this.db) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const req = this._tx('readwrite').delete(voice);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  _all() {
    if (!this.db) return Promise.resolve([]);
    return new Promise((resolve, reject) => {
      const req = this._tx('readonly').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Sampler, SAMPLE_PACK };
}
