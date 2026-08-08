# Beat Pad

A first drum machine for little hands — and a real one underneath.

No dependencies, no build step, no network calls, no data collection. Open
`index.html` and it works; installed as a PWA it works offline from the first run.

## Playing it

Tap a pad. That is the whole entry price.

Everything past that is a **performance move** — something you do while the loop is
running, in one tap, on the front of the device:

| | |
|---|---|
| 🎲 | A ready-made groove from the current pack |
| 🎤 | Count in, play a bar, it lands quantized on the grid |
| 🔇 | Mute a part and hear what it was doing |
| **hold a pad** | It rolls in time, locked to the beat |
| **pack strip** | Change the entire kit mid-loop |
| **A B C D** | Four song cards — tap them in order and you have an arrangement |
| 🎙️ | Record your own sounds into the pads |

## Two modes

**Simple** (the default) is six big pads with animal names and no vocabulary.
**Studio** adds nine pads, a sixteenth-note grid, song cards, swing, velocity and
the microphone sampler. Switch in the grown-up panel — press and hold ⚙ for three
seconds.

## Sound packs

Seven built in — Hip Hop (808), Rock Band, Toy Box, Kitchen, Robot, Jungle and a
pentatonic Melody pack where no combination of notes sounds wrong. A pack carries
its sounds, its pad art, its tempo, its swing and its own grooves, because that is
what a genre actually is.

An eighth, **Real Kit**, is a recorded acoustic kit built from public-domain CC0
samples. It downloads on demand (648 KB), then works offline forever — hit a pad
softly and you get a genuinely softer *take*, not the same hit turned down.

Packs are data: adding a synth pack is an edit to [`js/packs.js`](js/packs.js), and
a sampled one is a manifest plus audio in [`packs/`](packs/README.md).

## Tests

```
node tests/run.js
```

Drives the app in headless Chromium and measures the actual rendered audio, not
just the UI. See [`docs/design.md`](docs/design.md) for how it works and why.
