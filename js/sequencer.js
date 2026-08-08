const LOOKAHEAD = 0.1;   // seconds of audio scheduled in advance
const TICK_MS = 25;      // how often the scheduler wakes up
const NUM_BANKS = 4;
const SWING_MAX = 0.62;  // at swing 1.0 an offbeat sits 62% of the way to the next step

/**
 * Sixteenth-note sequencer driven by the AudioContext clock.
 *
 * Audio events are scheduled ahead at explicit times, so tempo never drifts
 * and a busy main thread can't smear the groove. Visual updates are replayed
 * from a queue on requestAnimationFrame at the moment each step is actually
 * heard, so lights and sound stay together.
 *
 * Four things sit on top of that clock:
 *
 *   velocity — a step holds 0..1, not a boolean, so beats can breathe
 *   swing    — offbeats are delayed, while the grid itself stays rigid
 *   banks    — four patterns, switched at the loop boundary
 *   repeat   — a held pad retriggers locked to the same grid
 */
class Sequencer {
  constructor(ctx, voices, numSteps = 16) {
    this.ctx = ctx;
    this.voices = voices.slice();
    this.numSteps = numSteps;
    this.bpm = 96;
    this.swing = 0;
    this.isPlaying = false;
    this.currentStep = 0;

    this.banks = [];
    for (let b = 0; b < NUM_BANKS; b++) this.banks.push(this._blankBank());
    this.bank = 0;
    this.queuedBank = -1;

    this.enabled = new Set(this.voices);   // in the current layout
    this.muted = new Set();                // silenced by the player, pattern intact

    this._anchor = 0;         // audio time of step 0 of the current loop (straight grid)
    this._nextStepTime = 0;
    this._timer = null;
    this._raf = null;
    this._queue = [];
    this._firstLoop = true;

    this._repeats = new Map();   // voice -> { div, vel, next }
    this._repeatAnchor = 0;

    this.onNote = null;    // (voice, time, vel)      — schedule audio
    this.onStep = null;    // (step, [{voice,vel}])   — visual, fires when heard
    this.onLoop = null;    // ()                      — pattern wrapped to step 0
    this.onPlay = null;    // (isPlaying)
    this.onBank = null;    // (bank)                  — active bank changed
  }

  _blankBank() {
    const p = {};
    for (const v of this.voices) p[v] = new Array(this.numSteps).fill(0);
    return p;
  }

  /** The pattern currently being played and edited. */
  get pattern() {
    return this.banks[this.bank];
  }

  /** Seconds per step (sixteenth notes). */
  stepDuration() {
    return 60 / this.bpm / 4;
  }

  /** How late an offbeat sixteenth sits. Even steps are never moved. */
  swingOffset(step) {
    return step % 2 === 1 ? this.swing * this.stepDuration() * SWING_MAX : 0;
  }

  setBpm(bpm) {
    this.bpm = Math.max(40, Math.min(200, bpm));
  }

  setSwing(amount) {
    this.swing = Math.max(0, Math.min(1, amount));
  }

  setEnabled(voices) {
    this.enabled = new Set(voices);
  }

  /* ═══════════════ mute ═══════════════ */

  toggleMute(voice) {
    if (this.muted.has(voice)) this.muted.delete(voice);
    else this.muted.add(voice);
    return this.muted.has(voice);
  }

  isMuted(voice) {
    return this.muted.has(voice);
  }

  unmuteAll() {
    this.muted.clear();
  }

  /* ═══════════════ steps ═══════════════ */

  /** Off → normal → accent → off. One button, three states. */
  cycleStep(voice, step, normal = 0.72, accent = 1) {
    const cur = this.pattern[voice][step];
    let next;
    if (cur === 0) next = normal;
    else if (cur < accent) next = accent;
    else next = 0;
    this.pattern[voice][step] = next;
    return next;
  }

  setStep(voice, step, vel) {
    if (this.pattern[voice]) {
      this.pattern[voice][step] = Math.max(0, Math.min(1, vel));
    }
  }

  getStep(voice, step) {
    return this.pattern[voice] ? this.pattern[voice][step] : 0;
  }

  clear(voice) {
    if (voice !== undefined) this.pattern[voice] = new Array(this.numSteps).fill(0);
    else this.banks[this.bank] = this._blankBank();
  }

  isEmpty() {
    return this.voices.every(v => this.pattern[v].every(s => !s));
  }

  isBankEmpty(i) {
    const p = this.banks[i];
    return !p || this.voices.every(v => p[v].every(s => !s));
  }

  /* ═══════════════ banks ═══════════════ */

  /**
   * Switching mid-bar would sound like a mistake, so a bank change waits
   * for the top of the loop. Stopped, there is nothing to wait for.
   */
  queueBank(i) {
    if (i < 0 || i >= NUM_BANKS) return;
    if (!this.isPlaying || i === this.bank) {
      this.bank = i;
      this.queuedBank = -1;
      this.onBank?.(i);
      return;
    }
    this.queuedBank = i;
  }

  copyBankTo(i) {
    if (i < 0 || i >= NUM_BANKS || i === this.bank) return;
    const src = this.pattern;
    const dst = this._blankBank();
    for (const v of this.voices) dst[v] = src[v].slice();
    this.banks[i] = dst;
  }

  /* ═══════════════ snapshots ═══════════════ */

  snapshot() {
    const copy = {};
    for (const v of this.voices) copy[v] = this.pattern[v].slice();
    return copy;
  }

  restore(snap) {
    if (!snap) return;
    for (const v of this.voices) {
      if (Array.isArray(snap[v]) && snap[v].length === this.numSteps) {
        this.pattern[v] = snap[v].map(x => Math.max(0, Math.min(1, Number(x) || 0)));
      }
    }
  }

  snapshotAll() {
    return this.banks.map(p => {
      const copy = {};
      for (const v of this.voices) copy[v] = p[v].slice();
      return copy;
    });
  }

  restoreAll(list) {
    if (!Array.isArray(list)) return;
    for (let b = 0; b < Math.min(NUM_BANKS, list.length); b++) {
      const snap = list[b];
      if (!snap) continue;
      const target = this._blankBank();
      for (const v of this.voices) {
        if (Array.isArray(snap[v]) && snap[v].length === this.numSteps) {
          target[v] = snap[v].map(x => Math.max(0, Math.min(1, Number(x) || 0)));
        }
      }
      this.banks[b] = target;
    }
  }

  /**
   * Which step a real-world audio timestamp belongs to, swing included —
   * a hit played late against a swung hat must land on the swung step,
   * not the one before it.
   */
  stepForTime(t) {
    const sd = this.stepDuration();
    const loop = sd * this.numSteps;
    let rel = (t - this._anchor) % loop;
    if (rel < 0) rel += loop;

    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.numSteps; i++) {
      const at = i * sd + this.swingOffset(i);
      let d = Math.abs(rel - at);
      d = Math.min(d, loop - d);   // wrap: step 0 is also just after the last step
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  /* ═══════════════ transport ═══════════════ */

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentStep = 0;
    this._queue = [];
    this._firstLoop = true;
    this._nextStepTime = this.ctx.currentTime + 0.06;
    this._anchor = this._nextStepTime;

    this._schedule();
    this._ensureTimer();
    this.onPlay?.(true);
  }

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.currentStep = 0;
    this.queuedBank = -1;
    this._queue = [];

    // A pad still held when the transport stops hands its roll over to the
    // free-running clock. Without re-anchoring, `next` is still 0 and the
    // free-run loop would try to schedule every hit since the epoch.
    const base = this.ctx.currentTime;
    for (const r of this._repeats.values()) {
      r.next = base + this.stepDuration() * r.div;
    }

    this.onStep?.(-1, []);
    this.onPlay?.(false);
    this._ensureTimer();
  }

  toggle() {
    if (this.isPlaying) this.stop();
    else this.play();
  }

  /* ═══════════════ note repeat ═══════════════ */

  /**
   * Hold a pad and it retriggers in time. On a real machine this is the
   * single most fun button, and it is also the clearest way to *feel*
   * what a subdivision is.
   *
   * @param {number} div steps between hits — 1 = sixteenths, 2 = eighths
   */
  startRepeat(voice, div = 2, vel = 0.85) {
    if (this._repeats.has(voice)) return;
    if (!this.isPlaying && this._repeats.size === 0) {
      this._repeatAnchor = this.ctx.currentTime;
    }
    this._repeats.set(voice, {
      div: Math.max(1, div),
      vel,
      next: this.isPlaying ? 0 : this._repeatAnchor + this.stepDuration() * div,
    });
    this._ensureTimer();
  }

  stopRepeat(voice) {
    this._repeats.delete(voice);
    this._ensureTimer();
  }

  stopAllRepeats() {
    this._repeats.clear();
    this._ensureTimer();
  }

  isRepeating(voice) {
    return this._repeats.has(voice);
  }

  /* ═══════════════ scheduling ═══════════════ */

  /** The clock runs while playing, and also while a pad is being held. */
  _ensureTimer() {
    const wanted = this.isPlaying || this._repeats.size > 0;
    if (wanted && !this._timer) {
      this._timer = setInterval(() => this._schedule(), TICK_MS);
      this._raf = requestAnimationFrame(() => this._draw());
    } else if (!wanted && this._timer) {
      clearInterval(this._timer);
      cancelAnimationFrame(this._raf);
      this._timer = null;
      this._raf = null;
    }
  }

  _schedule() {
    const horizon = this.ctx.currentTime + LOOKAHEAD;

    if (this.isPlaying) {
      while (this._nextStepTime < horizon) {
        const step = this.currentStep;
        const straight = this._nextStepTime;

        if (step === 0) {
          this._anchor = straight;
          if (this.queuedBank >= 0) {
            this.bank = this.queuedBank;
            this.queuedBank = -1;
            this.onBank?.(this.bank);
          }
        }

        const time = straight + this.swingOffset(step);
        const fired = [];

        for (const v of this.voices) {
          const vel = this.pattern[v][step];
          if (!vel || !this.enabled.has(v) || this.muted.has(v)) continue;
          // A held pad owns its voice — don't double-trigger it from the grid.
          if (this._repeats.has(v)) continue;
          this.onNote?.(v, time, vel);
          fired.push({ voice: v, vel });
        }

        // Repeats ride the same grid, so a roll locks to the beat for free.
        for (const [voice, r] of this._repeats) {
          if (step % r.div !== 0) continue;
          if (!this.enabled.has(voice) || this.muted.has(voice)) continue;
          this.onNote?.(voice, time, r.vel);
          fired.push({ voice, vel: r.vel, repeat: true });
        }

        this._queue.push({ step, active: fired, time });

        this._nextStepTime += this.stepDuration();
        this.currentStep = (this.currentStep + 1) % this.numSteps;
      }
      return;
    }

    // Stopped, but a pad is held: free-running rolls from the press time.
    for (const [voice, r] of this._repeats) {
      const period = this.stepDuration() * r.div;
      // Backstop: a tab suspended mid-roll can leave `next` far in the past,
      // and catching up hit by hit would fire hundreds at once.
      if (r.next < this.ctx.currentTime - period) r.next = this.ctx.currentTime;
      while (r.next < horizon) {
        if (this.enabled.has(voice) && !this.muted.has(voice)) {
          this.onNote?.(voice, r.next, r.vel);
          this._queue.push({
            step: -1,
            active: [{ voice, vel: r.vel, repeat: true }],
            time: r.next,
          });
        }
        r.next += period;
      }
    }
  }

  _draw() {
    if (!this._timer) return;
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Sequencer, NUM_BANKS, SWING_MAX };
}
