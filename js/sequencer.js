class Sequencer {
  constructor(bpm = 120) {
    this.bpm = bpm;
    this.isPlaying = false;
    this.currentStep = 0;
    this.numSteps = 16;
    this.numPads = 9;
    this.pattern = [];
    for (let i = 0; i < this.numPads; i++) {
      this.pattern.push(new Array(this.numSteps).fill(false));
    }
    this._timer = null;
    this._lastTime = 0;
    this._nextTime = 0;
    this.onStep = null;
    this.onPlay = null;
  }

  setBpm(bpm) {
    this.bpm = Math.max(60, Math.min(200, bpm));
  }

  toggleStep(pad, step) {
    this.pattern[pad][step] = !this.pattern[pad][step];
    return this.pattern[pad][step];
  }

  setStep(pad, step, val) {
    this.pattern[pad][step] = val;
  }

  clear(pad) {
    if (pad !== undefined) {
      this.pattern[pad] = new Array(this.numSteps).fill(false);
    } else {
      for (let i = 0; i < this.numPads; i++) {
        this.pattern[i] = new Array(this.numSteps).fill(false);
      }
    }
  }

  stepInterval() {
    return (60000 / this.bpm) / 4;
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentStep = 0;
    this._schedule();
    this.onPlay?.(true);
  }

  stop() {
    this.isPlaying = false;
    clearTimeout(this._timer);
    this._timer = null;
    this.currentStep = 0;
    this.onPlay?.(false);
  }

  _schedule() {
    if (!this.isPlaying) return;
    const step = this.currentStep;
    const active = [];
    for (let p = 0; p < this.numPads; p++) {
      if (this.pattern[p][step]) active.push(p);
    }
    this.onStep?.(step, active);
    this.currentStep = (this.currentStep + 1) % this.numSteps;
    this._timer = setTimeout(() => this._schedule(), this.stepInterval());
  }
}
