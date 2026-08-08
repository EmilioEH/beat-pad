# Beat Pad — how it works and why

This describes the app after the music-production pass. The earlier document,
[`kids-3-6-analysis.md`](kids-3-6-analysis.md), is the reasoning behind the
version this one replaces and is kept as history.

---

## The one idea

**A DAW is about editing. A beat pad is about performing.**

Every feature that makes real gear feel real is something you do *while the loop
is playing* — mute a part, hold a pad to roll it, flip to another pattern, change
the whole kit. Every feature that makes something feel like a DAW is something you
do while it is stopped.

So the rule is: **add performance moves, not editing surfaces.** That rule also
keeps it fun, because performing is fun and editing is homework. And it is what
makes it teach: a child learns what a hi-hat *does* by muting it and hearing the
beat fall apart, not by reading the word "hi-hat".

The step grid exists. It is deliberately not where the app lives.

## The second idea

**It grows with the child.** Simple mode is six big pads, animal names and no
vocabulary — essentially the app that came before. Studio mode is nine pads, a
sixteenth grid, song cards, swing, velocity and a microphone. Same app, same
sounds, one select in the grown-up panel between them.

Simple is the default, so nothing regresses for a three-year-old.

| | Simple | Studio |
|---|---|---|
| Pads | 6 | 9 |
| Pad names | Boom, Frog, Hiss | Kick, Snare, Hi-hat |
| Play, speed, dice, record, clear | ✅ | ✅ |
| Packs, mute, note repeat | ✅ | ✅ |
| Step grid, song cards, swing, velocity, sampler | — | ✅ |

---

## What each thing is meant to teach

| Feature | The lesson |
|---|---|
| Mute a part | What that instrument was actually doing. The single best listening tool in music production. |
| Hold a pad to roll | Subdivision, physically. Hold the snake, feel the beat split. |
| Song cards A–D | Song structure — verse, chorus — without a timeline. |
| Swing | Why hip hop feels different from techno. One control. |
| Velocity | Dynamics: the difference between a machine and a person playing. |
| Sixteen steps, four marked | "Four big beats and the little ones in between." |
| Packs | A genre is a whole package — sound *and* tempo *and* groove — not just a tone. |
| Kitchen pack | Anything can be a drum. This is literally where sampling came from. |
| Melody pack | Pentatonic: five notes with no wrong combinations. |
| Record your own | Your voice is an instrument. The most direct production idea in the app. |

---

## Audio engine

`js/audio-engine.js`. A voice is a **list of layers**; each layer is one of four
sources with its own envelope, filter, pan, drive and time offset.

```js
kick: {
  layers: [
    { src:'osc', wave:'sine', freq:155, freqEnd:48, pitchDur:0.045,
      gain:1.0, dur:0.52, drive:0.38 },
    { src:'noise', gain:0.42, dur:0.006, filter:{type:'highpass',freq:1800} },
  ],
  jitter: { pitch:0.012, gain:0.05 },
}
```

| Source | What it is |
|---|---|
| `osc` | An oscillator with an optional pitch envelope. |
| `noise` | The shared noise buffer, read from a random offset. |
| `metal` | Detuned square waves through a highpass — the 808 hat/cymbal/cowbell. |
| `sample` | A recorded buffer, with round-robin variants and velocity layers. |

The old schema was a type enum (`osc | noise | noise+osc | clap`), which meant
every new kit could only be a recolouring of four fixed shapes. Layers removed
that ceiling *and* deleted code: `clap` is now three noise layers with time
offsets rather than its own renderer.

### The four things the first version got wrong

These are the difference between "synthesised" and "a drum machine", and all four
are measured in `tests/audio-checks.js`:

1. **Every hit was identical.** Mathematically the same waveform each time, which
   ears read instantly as a machine gun. Every voice can now jitter its pitch, gain
   and filter per hit.

2. **The pitch envelope was welded to the amplitude envelope.** The old kick slid
   150 → 40 Hz across its *entire* 350 ms decay. Real kicks drop pitch in about
   40 ms and then ring. `pitchDur` separates the two — measured at 100 ms into the
   hit, the kick now sits at 43 Hz where the welded version is still sliding
   through 118 Hz. That is the whole difference between "boom" and "boop".

3. **No transient, and nothing above 200 Hz.** An 808 kick puts nearly all its
   energy below 100 Hz — and **a phone or tablet speaker cannot reproduce that at
   all**, which is the target device. A few milliseconds of filtered noise plus
   harmonic drive imply the pitch through upper harmonics. Measured: **206× the
   energy in the 200–2000 Hz band** a small speaker can actually move.

4. **Hats were white noise.** A real hi-hat is detuned squares through a highpass;
   that is where the metallic shimmer lives. Spectral flatness dropped from 0.51
   (flat noise) to 0.25 (distinct partials).

### Master bus

```
voices → voiceBus → saturator ─┬──────────────→ mix → limiter → master → out
                               └→ send → verb ─┘
```

Saturation sits before the split so the reverb hears the same glue the dry path
does. The reverb send is highpassed at 320 Hz — otherwise the kick turns the tail
to mud — and its impulse response is generated at runtime, so the app still ships
no audio assets. Each pack sets its own `space` and `trim`, so switching mid-loop
never jumps in level.

Nine voices firing at once peak at 0.90, below full scale, with the limiter as the
backstop for a cheap speaker.

---

## Packs

`js/packs.js`. A pack is not a list of sounds — it is a whole idea of a beat:
sounds, pad art, suggested tempo, swing, and grooves that belong to it. Tapping
**Hip Hop** gives you an 808 kit at 92 BPM with a swung groove already on the grid,
because that is what a genre actually is.

Seven built in: Hip Hop (808), Rock Band, Toy Box, Kitchen, Robot, Jungle, Melody.
Adding one is an edit to this file. `extends` lets a pack override three voices
without restating nine.

The three speed pictures 🐢 🐇 🚀 are now **relative** to the pack's own tempo
(×0.78, ×1, ×1.32), so they stay three pictures and never become a number.

### Groove notation

Sixteen characters, one per sixteenth:

```
X  accent (1.0)    x  normal (0.72)    o  ghost (0.45)    -  silent

{ kick: 'X-----x---X-----', snare: '----X-------X---', chh: 'x-o-x-o-x-o-x-o-' }
```

---

## Sequencer

`js/sequencer.js`. Still an AudioContext-clock scheduler with a 100 ms lookahead
and a visual queue replayed on `requestAnimationFrame`, so tempo cannot drift and
a busy main thread cannot smear the groove. Four things sit on top:

- **Velocity** — a step holds 0–1, not a boolean.
- **Swing** — offbeat sixteenths are delayed while the grid itself stays rigid.
  `stepForTime` inverts the swing, so a hit played late against a swung hat
  quantizes to the step you *heard*, not the one before it.
- **Banks** — four patterns, switched at the loop boundary. Switching mid-bar
  sounds like a mistake, so a tap queues and waits.
- **Note repeat** — a held pad retriggers on the same grid. Rolls ride the step
  loop when playing and a free-running clock when stopped.

One bar is 16 sixteenths (was 8 eighths). Beats 1, 5, 9 and 13 are marked in both
the step lights and the grid.

---

## Sampling

`js/sampler.js` records about a second per pad through the microphone, trims the
leading silence, normalises, fades the tail, and stores trimmed mono PCM in
IndexedDB. Recorded pads become the **My Sounds** pack, which `extends` Hip Hop so
a pad you have not sampled yet still plays the 808 sound rather than going dead.

`js/pack-loader.js` fetches downloadable sample packs from `packs/`. Both go
through the same `sample` layer source, so round-robin variants and soft/hard
velocity layers work identically for a recorded pad and a published pack.

**No third-party audio is committed.** The loader, manifest format, round-robin,
velocity layers and service-worker caching are all implemented and tested; adding
a real pack is a data drop. See [`packs/README.md`](../packs/README.md).

`sw.js` keeps packs in a second cache that release bumps do not evict, and serves
`packs/index.json` network-first so a pack published after a user's first visit is
still discovered.

---

## Storage

`beat-pad.v3` holds four banks of sixteen velocities, the active bank, mutes,
pack, speed, swing, mode and volume.

A `beat-pad.v2` save is migrated on first load: eight booleans expand to sixteen
velocities with every old step landing on an even step, so **a beat made on the
old version plays back exactly as it did**. Old kit names map to pack ids, and
`padCount: 9` or the beat-maker toggle promotes the user to Studio mode.

---

## Tests

```
node tests/run.js
```

Serves the app, drives it in headless Chromium, and asserts against the **actual
rendered signal** through `OfflineAudioContext` rather than against the code's
intentions — spectral measurements for the kick, hat, velocity and jitter claims
above; sample-clock timing and swing quantisation; round-robin and velocity-layer
selection; the v2 → v3 migration; and a boot smoke pass over the real UI.

24 checks. `tests/audio-checks.js` carries a small FFT so the spectral assertions
are real measurements.
