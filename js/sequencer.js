const LOOKAHEAD = 0.1;   // seconds of audio scheduled in advance
const TICK_MS = 25;      // how often the scheduler wakes up

/**
 * Eighth-note sequencer driven by the AudioContext clock.
 *
 * Audio events are scheduled ahead at explicit times, so tempo never drifts
 * and a busy main thread can't smear the groove. Visual updates are replayed
 * from a queue on requestAnimationFrame at the moment each step is actually
 * heard, so lights and sound stay together.
 */
class Sequencer {
  constructor(ctx, voices, numSteps = 8) {
    this.ctx = ctx;
    this.voices = voices.slice();
    this.numSteps = numSteps;
    this.bpm = 104;
    this.isPlaying = false;
    this.currentStep = 0;

    this.pattern = {};
    for (const v of this.voices) this.pattern[v] = new Array(numSteps).fill(false);
    this.enabled = new Set(this.voices);

    this._anchor = 0;         // audio time of step 0 of the current loop
    this._nextStepTime = 0;
    this._timer = null;
    this._raf = null;
    this._queue = [];
    this._firstLoop = true;

    this.onNote = null;   // (voice, time)   — schedule audio
    this.onStep = null;   // (step, voices)  — visual, fires when heard
    this.onLoop = null;   // ()              — pattern wrapped to step 0
    this.onPlay = null;   // (isPlaying)
  }

  /** Seconds per step (eighth notes). */
  stepDuration() {
    return 60 / this.bpm / 2;
  }

  setBpm(bpm) {
    this.bpm = Math.max(50, Math.min(180, bpm));
  }

  setEnabled(voices) {
    this.enabled = new Set(voices);
  }

  toggleStep(voice, step) {
    this.pattern[voice][step] = !this.pattern[voice][step];
    return this.pattern[voice][step];
  }

  setStep(voice, step, on) {
    if (this.pattern[voice]) this.pattern[voice][step] = on;
  }

  clear(voice) {
    const blank = () => new Array(this.numSteps).fill(false);
    if (voice !== undefined) this.pattern[voice] = blank();
    else for (const v of this.voices) this.pattern[v] = blank();
  }

  isEmpty() {
    return this.voices.every(v => this.pattern[v].every(s => !s));
  }

  snapshot() {
    const copy = {};
    for (const v of this.voices) copy[v] = this.pattern[v].slice();
    return copy;
  }

  restore(snap) {
    if (!snap) return;
    for (const v of this.voices) {
      if (Array.isArray(snap[v]) && snap[v].length === this.numSteps) {
        this.pattern[v] = snap[v].map(Boolean);
      }
    }
  }

  /** Which step a real-world audio timestamp belongs to. */
  stepForTime(t) {
    const n = Math.round((t - this._anchor) / this.stepDuration());
    return ((n % this.numSteps) + this.numSteps) % this.numSteps;
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentStep = 0;
    this._queue = [];
    this._firstLoop = true;
    this._nextStepTime = this.ctx.currentTime + 0.06;
    this._anchor = this._nextStepTime;

    this._schedule();
    this._timer = setInterval(() => this._schedule(), TICK_MS);
    this._raf = requestAnimationFrame(() => this._draw());
    this.onPlay?.(true);
  }

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    clearInterval(this._timer);
    cancelAnimationFrame(this._raf);
    this._timer = null;
    this._raf = null;
    this._queue = [];
    this.currentStep = 0;
    this.onStep?.(-1, []);
    this.onPlay?.(false);
  }

  toggle() {
    if (this.isPlaying) this.stop();
    else this.play();
  }

  _schedule() {
    if (!this.isPlaying) return;
    while (this._nextStepTime < this.ctx.currentTime + LOOKAHEAD) {
      const step = this.currentStep;
      const time = this._nextStepTime;
      if (step === 0) this._anchor = time;

      const active = this.voices.filter(v => this.enabled.has(v) && this.pattern[v][step]);
      for (const v of active) this.onNote?.(v, time);
      this._queue.push({ step, active, time });

      this._nextStepTime += this.stepDuration();
      this.currentStep = (this.currentStep + 1) % this.numSteps;
    }
  }

  _draw() {
    if (!this.isPlaying) return;
    const now = this.ctx.currentTime;
    while (this._queue.length && this._queue[0].time <= now) {
      const e = this._queue.shift();
      this.onStep?.(e.step, e.active);
      if (e.step === 0) {
        if (!this._firstLoop) this.onLoop?.();
        this._firstLoop = false;
      }
    }
    this._raf = requestAnimationFrame(() => this._draw());
  }
}
