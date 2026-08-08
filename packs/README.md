# Sample packs

The seven built-in packs in `js/packs.js` are synthesised — no audio files, no
download, instant on first launch, works offline from the very first run. That
property is worth keeping, so sample packs live here instead: fetched on demand,
cached permanently by the service worker, and never required for the app to work.

One pack ships: **`realkit/`**, a recorded acoustic kit built from public-domain
(CC0) samples — see [`realkit/CREDITS.md`](realkit/CREDITS.md) for sources and
processing. It is the worked example for everything below, and it exercises both
of the features that separate a sampled kit from a sample player: velocity layers
on six voices and round-robin on the snap.

Adding another pack is a data change, not a code change.

## Layout

```
packs/
  index.json            ← list of published packs (optional)
  realkit/
    pack.json           ← the manifest
    CREDITS.md
    drum_bass_hard.wav
    drum_bass_soft.wav
    ...
```

`index.json` is a plain array, used to show the "more sounds" list:

```json
[
  { "id": "realkit", "label": "Real Kit", "emoji": "🎧", "bytes": 648322 }
]
```

## Manifest

```json
{
  "label": "Vinyl",
  "emoji": "💿",
  "blurb": "Dusty drums off an old record.",

  "tempo": 88,
  "swing": 0.26,
  "space": 0.14,
  "trim": 1.0,
  "chassis": "#7A5C3E",

  "extends": "boom",

  "pads": {
    "kick": { "emoji": "📀", "name": "Thump", "real": "Kick", "color": "#8B5E34" }
  },

  "voices": {
    "kick":  { "variants": ["kick-1.mp3", "kick-2.mp3"], "soft": ["kick-soft.mp3"] },
    "snare": { "variants": ["snare-1.mp3"], "gain": 0.9 }
  },

  "grooves": [
    { "kick": "X-----x---X-----", "snare": "----X-------X---", "chh": "x-o-x-o-x-o-x-o-" }
  ]
}
```

### Fields

| Field | Meaning |
|---|---|
| `tempo` | Suggested BPM. The three speed pictures are relative to this. |
| `swing` | 0–1. How far offbeat sixteenths are pushed late. |
| `space` | 0–1. Reverb send for the whole pack. |
| `trim` | Output gain, so packs don't jump in level when switched. |
| `chassis` | Hex colour of the device shell while this pack is active. |
| `extends` | Pack id to inherit undefined voices and pad art from. Defaults to `boom`, so a partial manifest still gives nine playable pads. |
| `pads` | Per-voice `emoji` / `name` (child-facing) / `real` (drum name shown in Studio mode) / `color`. |
| `voices` | Per-voice sample files. See below. |
| `grooves` | Patterns for the 🎲 button, in the notation below. |

### Voice entries

| Key | Meaning |
|---|---|
| `variants` | Files cycled round-robin on repeated hits. **Two or three is the difference between a kit and a machine gun** — identical repeated waveforms are the main reason sampled drums sound fake. |
| `soft` | Optional quieter takes, used below velocity 0.55. A soft hit on a real drum is *darker*, not just quieter, which a gain multiplier cannot fake. |
| `gain` | Level trim for this voice. |
| `rate` | Playback rate, i.e. tuning. `0.5` is an octave down. |
| `pan` | −1 to 1. |
| `jitter` | Per-hit random variation, e.g. `{ "pitch": 0.008, "gain": 0.05 }`. |

Voice ids are the nine the app knows: `kick`, `snare`, `chh`, `ohh`, `clap`,
`tomL`, `tomH`, `rim`, `crash`.

### Groove notation

Sixteen characters, one per sixteenth note:

```
X  accent (velocity 1.0)
x  normal (velocity 0.72)
o  ghost  (velocity 0.45)
-  silent
```

So `X---x---X---x---` is four-on-the-floor accented on beats 1 and 3.

## Audio format

Mono WAV is the safe default. `decodeAudioData` handles FLAC unevenly across
Safari versions and this app is meant to run on an iPad, so lossless-but-risky is
a bad trade; MP3 and AAC are fine too if you have an encoder. `realkit` is 32 kHz
mono 16-bit WAV — everything up to 16 kHz, which is all the cymbal air that
matters, at about a quarter less size than 44.1.

Trim the silence off the front, since the loader plays from sample zero, and set
per-voice `gain` to restore the balance that peak-normalising destroys: a hi-hat
and a kick normalised to the same peak are not a drum kit. `realkit` is 648 KB for
sixteen files across nine voices, cached by the service worker on first use and
served offline from then on.

## Caching

`sw.js` cache-first serves anything under `packs/` and writes it into the runtime
cache on first fetch. A pack downloaded once is available offline from then on,
and bumping `CACHE` in `sw.js` does not evict it.
