/**
 * One-button loop recorder.
 *
 *   tap 🎤  →  waiting  →  count-in bar  →  record one bar  →  done
 *
 * Always quantized, always exactly one loop long, stops itself. There is
 * nothing for a child to get wrong and no second button to find.
 *
 * Hits are stamped with the audio clock and mapped to steps through the
 * sequencer's loop anchor, so what you hear is what lands on the grid.
 */
class Recorder {
  constructor(sequencer) {
    this.seq = sequencer;
    this.state = 'idle';   // idle | waiting | countin | recording
    this._hits = [];
    this.onState = null;   // (state, added) — added only on the final commit
  }

  get active() {
    return this.state !== 'idle';
  }

  /**
   * @param {boolean} freshStart true when playback was just started for this
   *        recording, which makes the first bar the count-in.
   */
  arm(freshStart) {
    if (this.active) return;
    this._hits = [];
    this._setState(freshStart ? 'countin' : 'waiting');
  }

  cancel() {
    if (!this.active) return;
    this._hits = [];
    this._setState('idle');
  }

  hit(voice) {
    if (this.state !== 'countin' && this.state !== 'recording') return;
    this._hits.push({ voice, time: this.seq.ctx.currentTime });
  }

  /** Called by the sequencer every time the pattern wraps to step 0. */
  loopBoundary() {
    if (this.state === 'waiting') {
      this._setState('countin');
      return;
    }
    if (this.state === 'countin') {
      // Keep hits landing just before the downbeat — they belong to step 0.
      const cutoff = this.seq.ctx.currentTime - this.seq.stepDuration() / 2;
      this._hits = this._hits.filter(h => h.time >= cutoff);
      this._setState('recording');
      return;
    }
    if (this.state === 'recording') {
      const added = this._commit();
      this.state = 'idle';
      this.onState?.('done', added);
      this.onState?.('idle', []);
    }
  }

  _commit() {
    const seen = new Set();
    const added = [];
    for (const h of this._hits) {
      const step = this.seq.stepForTime(h.time);
      const key = h.voice + ':' + step;
      if (seen.has(key)) continue;
      seen.add(key);
      this.seq.setStep(h.voice, step, true);
      added.push({ voice: h.voice, step });
    }
    this._hits = [];
    return added;
  }

  _setState(s) {
    this.state = s;
    this.onState?.(s, []);
  }
}
