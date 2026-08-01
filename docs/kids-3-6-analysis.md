# Beat Pad — Analysis for Ages 3–6

Two separate questions, answered separately:

1. **Is this game right for 3–6 year olds?** Not yet. It's a well-made *adult* drum machine. The
   core loop (tap a pad, hear a sound) is perfect for the age group; almost everything wrapped
   around it is not.
2. **Is the code good?** It's clean, readable, dependency-free, and well-organized for its size —
   but it has four real bugs (one audible, one timing, one silently-broken feature, one deploy
   hazard) and one large duplication problem.

---

## Part 1 — Fitting the game to ages 3–6

### What's already right

- Instant cause-and-effect: tap → sound + visual flash. This is exactly the right core loop for
  a 3-year-old and it's the reason the app works at all for this audience.
- No failure state, no score, no timer, no losing. Open-ended play is age-appropriate.
- Offline PWA, no ads, no network calls, no data collection, no external links. Genuinely safe
  to hand to a child, which is rarer than it should be.
- Big colored targets in a grid, distinct color per sound.
- `user-scalable=no` + `touch-action: manipulation` + `display: standalone` prevent the accidental
  pinch-zoom and double-tap-zoom that wreck most kids' web games.

### The core mismatch

A 3–6 year old is pre-literate (or barely reading) and, developmentally, pre-operational — they
don't yet map abstract symbols onto time. The app currently asks them to:

- Read `CHH`, `OHH`, `TomL`, `Rim`, `BPM`, `Quantize`, `808`, `Acoustic`.
- Understand that a horizontal row of 16 gray squares represents *the future*.
- Understand that the row shows only **one** instrument at a time, and that `‹` `›` swaps which
  invisible layer they're editing.
- Understand that `●` means "capture what I do next" rather than "a red circle."

None of those concepts land before roughly age 7–8. Everything below the pad grid is, for this
audience, a row of buttons that make the beat mysteriously change.

### Recommendations, highest impact first

#### 1. Replace all text labels with pictures

`CHH` / `OHH` / `TomL` / `Rim` mean nothing pre-literacy. Give each pad a character or object —
animals are the standard choice and they double as the sound identity:

| Pad | Now | Suggested |
|---|---|---|
| 0 | Kick | 🐘 Elephant (boom) |
| 1 | Snare | 🐸 Frog (croak/snap) |
| 2 | CHH | 🐍 Snake (tss) |
| 3 | OHH | 🌊 Splash |
| 4 | Clap | 👏 Hands |
| 5 | TomL | 🥁 Big drum |
| 6 | TomH | 🥁 Little drum |
| 7 | Rim | 🐦 Bird (tick) |
| 8 | Crash | ⭐ Star (crash) |

Keep the text label too, but small and underneath — it supports the 5–6 year olds who are
starting to read without blocking the 3 year olds.

#### 2. Cut the pad count and grow the pads

Nine pads at `aspect-ratio: 1` in a 3-column grid on a phone lands around 100–110 px per pad. That
is fine for a 6 year old and marginal for a 3 year old, whose fine motor control and finger-to-target
accuracy are much worse — and who will also plant a whole palm on the screen.

Ship **6 pads in a 2×3 grid** as the default (kick, snare, hat, clap, tom, crash). It's a ~50 %
bigger target and removes the two most confusable pairs (CHH/OHH, TomL/TomH), which sound nearly
identical to an untrained ear anyway. Put the full 9 behind an age/parent setting.

#### 3. Make every tap more rewarding

Right now a tap gets a 93 % scale-down and an 8 px white LED dot. That's a professional
instrument's restraint; kids need spectacle. Cheap, high-payoff additions:

- The pad's character animates — bounce, wiggle, mouth opens, eyes light up.
- A color burst / ripple / particle puff radiating from the touch point.
- Haptics: `navigator.vibrate(15)` on tap where supported.
- Pads that "breathe" gently when idle so the screen invites touching.

Also, `.pad .led` at 8 px in the corner is far too small to read as feedback at this age — let
the whole pad be the feedback surface.

#### 4. Replace the BPM slider with two or three speed buttons

A 4 px-tall range slider with a 20 px thumb is one of the hardest controls for small hands, and
"120" is a meaningless number. Replace with big icon buttons: 🐢 slow (80) / 🐇 medium (110) /
🚀 fast (150). Three taps beats one drag, and the icons teach the concept.

#### 5. Rethink the sequencer instead of exposing it

The 16-step row is the single biggest source of confusion. Two options:

- **Simpler (recommended for 3–5):** remove the step editor from the main screen entirely. Keep
  loop playback and recording. The child taps a beat while it loops; it plays back. That's the
  whole feature, and it's a genuinely delightful one — no abstraction required.
- **If you keep an editor (5–6):** show **all** instruments at once as a picture grid (6 rows ×
  8 steps, one bar of eighth notes) so the child sees the whole song. Drop from 16 steps to 8 —
  16 sixteenths is too fine to hear the relationship between the square you tapped and the sound
  you heard. Delete the `‹` `›` pad pager; one-instrument-at-a-time is the confusing part.

#### 6. Make recording one button with no options

Delete the `Quantize` checkbox — it's jargon, and it should always be on for kids. Recording
should be: tap 🎤 → a visual 4-beat count-in (four big pulsing dots) → one loop is captured →
it starts looping immediately with an obvious celebration. No stop button needed; auto-stop
after one bar.

#### 7. Protect the clear button

`⌂` currently wipes all nine tracks instantly, no confirmation, and sits directly next to the
buttons the child *does* want. Three fixes, all worth doing:

- Use a recognizable icon (🗑️ or a broom), not a house glyph.
- Require **press-and-hold ~1.5 s** with a filling ring — trivially easy for an adult,
  effectively impossible to trigger by accident.
- Keep one level of undo.

Losing a beat they just made is the fastest way to end a session in tears.

#### 8. Save the pattern

There is no persistence — a reload, a phone lock, or a service-worker update loses everything.
Ten lines of `localStorage` on every pattern change, restored on boot. For a child, "my song is
still here tomorrow" is a large part of the appeal.

#### 9. Cap the volume — this is a safety issue, not a polish issue

Every voice connects straight to `ctx.destination` with no master gain and no limiter, and the
kick alone is at gain `1.2` (already over full scale). A child mashing all nine pads at once —
which is precisely what a 3 year old does first — produces hard digital clipping. On headphones
that is unpleasant and, at volume, genuinely bad for young ears.

```js
// in init()
this.master = this.ctx.createGain();
this.master.gain.value = 0.7;
this.limiter = this.ctx.createDynamicsCompressor();
this.limiter.threshold.value = -6;
this.limiter.ratio.value = 20;
this.limiter.attack.value = 0.003;
this.master.connect(this.limiter).connect(this.ctx.destination);
// then every voice connects to this.master, never to ctx.destination
```

#### 10. Warm up the visual design

`#0f0f1a` near-black with `#555` help text is a producer's dark studio aesthetic. Kids' apps read
better bright: light warm background, saturated pads, thick rounded outlines. The help bar at
11 px `#555` on `#0f0f1a` also fails WCAG contrast badly and is unreadable text aimed at
non-readers — replace it with a one-time animated hand-tap hint.

#### 11. Add a parent gate

Kit selection, 9-pad mode, and pattern-clearing belong behind a simple hold-3-seconds or
"tap the shapes in order" gate. Keeps the child's screen to just: pads, play, speed, record.

#### 12. Consider a play-along mode

A "dance" mode with 4–5 preloaded beats the child just triggers, with characters bopping in time,
gives 3 year olds something rewarding before they can build anything themselves — and models what
the sequencer does.

---

## Part 2 — Code quality assessment

**Overall: good bones, four real bugs.** Clear module boundaries (`AudioEngine` / `Sequencer` /
`Recorder` / `app.js` as the view layer), consistent naming, no dependencies, no build step, an
appropriate amount of code for what it does. Nothing is over-engineered. The problems are
concentrated in the audio and timing layers.

### Bug 1 — Every noise voice bypasses its own filter (audible)

`AudioEngine._noise()` already wires the source to the gain node:

```js
// audio-engine.js:34
src.connect(g);
```

Then every caller *adds a second path* through the filter:

```js
// audio-engine.js:87 (and :77, :98, :111, :142, :152, and all _ac_* equivalents)
n.src.connect(f).connect(n.g);
```

Web Audio sums inputs, so `g` receives the dry full-band noise **and** the filtered noise at equal
level. The highpass on the hats, the lowpass on the crash and clap, the bandpass on the rim — all
of them are effectively defeated. That's why the noise-based sounds are muddier and more similar
to each other than they should be; the closed hat is mostly raw white noise, not a hat.

**Fix:** make `_noise()` return an unconnected source, or accept an optional filter and wire the
chain in one place:

```js
_noise(dur, gainVal, filter) {
  /* ...create buf, src, g... */
  if (filter) src.connect(filter).connect(g);
  else src.connect(g);
  return { src, g };
}
```

This is the highest-value single fix in the codebase — it changes how the whole kit sounds.

### Bug 2 — `setTimeout` sequencer scheduling (audible timing drift)

```js
// sequencer.js:71
this._timer = setTimeout(() => this._schedule(), this.stepInterval());
```

Each step fires a `setTimeout`, and the sound is scheduled at whatever `ctx.currentTime` happens
to be when the callback runs. Three consequences:

- `setTimeout` has several milliseconds of jitter under any main-thread load (and the callback
  also does DOM work in `onStep` — `querySelectorAll` on every step — before playing the sounds).
- Errors **accumulate**: the next timeout is set from callback-time, not from an absolute
  timeline, so tempo drifts.
- Background tabs throttle timers to ≥1 s, so the loop falls apart when the app isn't focused.

The standard fix is lookahead scheduling: a ~25 ms `setInterval` that schedules any audio events
falling in the next ~100 ms at explicit `AudioContext` times.

```js
// sketch
_tick() {
  while (this._nextTime < this.ctx.currentTime + 0.1) {
    this._fire(this.currentStep, this._nextTime);   // pass the time down to audio.play()
    this._nextTime += this.stepInterval() / 1000;   // absolute, no accumulated error
    this.currentStep = (this.currentStep + 1) % this.numSteps;
  }
}
```

This requires threading a `when` parameter through `AudioEngine.play()` and every voice (they all
currently hardcode `this.ctx.currentTime`), which is a genuine refactor — but timing is the whole
point of a drum machine, and the current version is audibly loose.

Note that `_lastTime` and `_nextTime` are declared in the constructor (`sequencer.js:13–14`) and
never used — the scaffolding for this is already there, just unfinished.

### Bug 3 — Recording lands one step late

In `_schedule()`, `currentStep` is incremented *immediately after* firing the step:

```js
this.onStep?.(step, active);
this.currentStep = (this.currentStep + 1) % this.numSteps;
```

So while step *N* is audibly playing, `seq.currentStep` already reads *N+1*. `Recorder.start()`
then computes its origin from that value:

```js
// recorder.js:13
const offset = this.seq.isPlaying ? this.seq.currentStep * interval : 0;
```

A hit the child plays *on* step *N* is timestamped as step *N+1* and quantizes one step late.
The last commit was titled "Fix recording alignment," so this was noticed but not fully resolved —
subtract one step (mod `numSteps`), or better, record against absolute audio-clock time once
Bug 2 is fixed.

### Bug 4 — Non-quantized recording is silently broken

```js
// recorder.js:30
result = this._hits.map(h => ({ pad: h.pad, step: 0 }));
```

Unchecking `Quantize` doesn't record "freely" — it dumps every hit onto step 0. The feature is
unimplemented, and it fails quietly rather than visibly. Since the recommendation for the kids
version is to delete the quantize toggle entirely, deleting this branch resolves it.

### Bug 5 — Service worker will break on any non-root deploy

`sw.js` caches absolute paths (`'/'`, `'/index.html'`, …) and `manifest.json` sets
`"start_url": "/"` / `"scope": "/"`. On a GitHub Pages *project* site (`user.github.io/beat-pad/`)
or any subpath host, `addAll` rejects, the install fails, and the app never goes offline.

Also, the cache name is hardcoded `beat-pad-v1` with a cache-first fetch handler and no network
fallback for the shell — once a user has installed it, **no future deploy ever reaches them**
until that string changes by hand. Use relative paths (`'./'`, `'./index.html'`) and bump the
cache version as part of the release step, or generate it.

### Design issues (not bugs, but the things that will slow future work)

**Duplication.** `_808_*` and `_ac_*` are 190 of the file's 251 lines and are the same five
synthesis recipes with different constants. Every future kit — and a kids app wants animal,
robot, and jungle kits — means another 90 lines copy-pasted. This should be data:

```js
const KITS = {
  '808': {
    kick:  { type: 'osc',   wave: 'sine', freq: 150, end: 40, gain: 1.2, dur: 0.35 },
    chh:   { type: 'noise', filter: { type: 'highpass', freq: 9000 }, gain: 0.25, dur: 0.06 },
    /* ... */
  },
  acoustic: { /* same shape, different numbers */ },
};
```

Five generic voice renderers (`osc`, `noise`, `noise+osc`, `multi-noise`) driven by that table
replaces ~190 lines with ~60, and adding a kit becomes a data edit. It would also have made
Bug 1 impossible — the filter wiring would exist in exactly one place instead of fourteen.

**String-built method dispatch.** `this['_808_' + pad]()` (`audio-engine.js:18`) has no
validation; an unknown kit or pad id throws `is not a function` with no useful message. The kit
table above removes this entirely.

**Un-awaited `ensure()`.** `AudioEngine.play()` calls `this.ensure()` (which returns a promise
when the context is suspended) and immediately schedules sound without awaiting it. Combined
with `audio.init()` running at `DOMContentLoaded` — before any user gesture, so the context
starts suspended on every modern browser — the first tap is unreliable. Resume on first gesture
and await it.

**Inconsistent voice helper contracts.** `_noise()` returns `{src, g}`; `_osc()` returns
`{src, g, dur}`; `_connect()` then guesses with `n.src.buffer ? n.src.buffer.duration : (n.dur || 0.5)`.
Some voices use `_connect()`, others wire `destination` and call `start()`/`stop()` by hand. One
contract, one path.

**Accessibility.** Pads listen only for `pointerdown`, so keyboard activation (which fires
`click`) does nothing despite the pads being real `<button>` elements. Step cells are `<div>`s —
not focusable, no `role`, no `aria-pressed`. `#playBtn` keeps `aria-label="Play/Stop"` regardless
of state. Low cost to fix, and it matters for a kids' app, where switch access and screen readers
are disproportionately relevant.

**Housekeeping.** Unused `t` in `_808_1` and `_ac_*` variants; unused `_lastTime`/`_nextTime`;
`state.quantize` duplicates the checkbox's own state; no README, no license, no tests, no linter.
For a project this size the missing tooling is defensible, but the timing and quantization logic
in `Sequencer`/`Recorder` is pure, dependency-free, and exactly the kind of code that repays a
handful of unit tests — Bug 3 would have been caught by one.

---

## Suggested order of work

1. Fix the noise-filter bypass (Bug 1) — one-line-per-voice change, transforms the sound.
2. Add master gain + limiter — safety, and it's ~6 lines.
3. Convert kits to a data table — unblocks kid-friendly kits and prevents Bug 1's return.
4. Pictures instead of text labels; 6 big pads; richer tap feedback.
5. Speed buttons instead of the BPM slider; hold-to-clear; `localStorage` persistence.
6. Rebuild scheduling on the audio clock (Bug 2), then fix recording against it (Bug 3).
7. Simplify or remove the step editor; one-button recording; parent gate.
8. Relative paths in `sw.js` / `manifest.json` (Bug 5) before any public deploy.
