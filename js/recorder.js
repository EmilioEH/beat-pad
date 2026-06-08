class Recorder {
  constructor(sequencer) {
    this.seq = sequencer;
    this.active = false;
    this._hits = [];
    this._start = 0;
  }

  start() {
    this.active = true;
    this._hits = [];
    this._start = performance.now();
  }

  hit(pad) {
    if (!this.active) return;
    this._hits.push({ pad, time: performance.now() - this._start });
  }

  stop(quantize) {
    this.active = false;
    if (this._hits.length === 0) return;

    let result;
    if (quantize) {
      result = this._quantize();
    } else {
      result = this._hits.map(h => ({ pad: h.pad, step: 0 }));
    }

    for (const h of result) {
      this.seq.setStep(h.pad, h.step % this.seq.numSteps, true);
    }
    this._hits = [];
  }

  _quantize() {
    const interval = this.seq._stepInterval();
    const seen = new Set();
    const out = [];
    for (const h of this._hits) {
      const step = Math.round(h.time / interval) % this.seq.numSteps;
      const key = h.pad + '-' + step;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ pad: h.pad, step });
    }
    return out;
  }
}
