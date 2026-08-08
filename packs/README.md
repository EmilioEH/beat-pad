# Sample packs

The seven built-in packs in `js/packs.js` are synthesised — no audio files, no
download, instant on first launch, works offline from the very first run. That
property is worth keeping, so sample packs live here instead: fetched on demand,
cached permanently by the service worker, and never required for the app to work.

**No audio is committed to this directory.** The loader, the manifest format, the
round-robin and velocity-layer playback, and the service-worker caching are all
implemented and live — the mic sampler (`js/sampler.js`) exercises exactly the
same playback path. Dropping a real pack in here is a data change, not a code
change.

## Layout

```
packs/
  index.json            ← list of published packs (optional)
  vinyl/
    pack.json           ← the manifest
    kick-1.mp3
    kick-2.mp3
    kick-soft.mp3
    snare-1.mp3
    ...
```

`index.json` is a plain array, used to show the "more sounds" list:

```json
[
  { "id": "vinyl", "label": "Vinyl", "emoji": "💿", "bytes": 240000 }
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

Mono, 22–44.1 kHz, MP3 (universally decodable including Safari). Keep each hit
short — trim the silence off the front, since the loader plays from sample zero.
A nine-voice kit with two variants each lands around 200–300 KB, which the
service worker caches on first use and then serves offline forever.

## Caching

`sw.js` cache-first serves anything under `packs/` and writes it into the runtime
cache on first fetch. A pack downloaded once is available offline from then on,
and bumping `CACHE` in `sw.js` does not evict it.
