# Real Kit — sources and licence

Every sample in this pack is dedicated to the **public domain** under
[CC0 1.0 Universal](http://creativecommons.org/publicdomain/zero/1.0/). CC0 imposes
no attribution requirement; this file exists because the people who recorded these
deserve the credit anyway.

They came via [Sonic Pi](https://github.com/sonic-pi-net/sonic-pi)'s CC0 sample
library (`etc/samples`), which sourced them from [freesound.org](https://freesound.org)
uploads released under CC0.

Fourteen of the sixteen files are one drum kit recorded by one person, **menegass**,
which is why the soft and hard takes of each drum actually match — they are the same
drum hit two different ways, not two different drums.

| File | Original |
|---|---|
| `drum_bass_hard.wav` | https://freesound.org/people/menegass/sounds/100051/ |
| `drum_bass_soft.wav` | https://freesound.org/people/menegass/sounds/100052/ |
| `drum_snare_hard.wav` | https://freesound.org/people/menegass/sounds/100058/ |
| `drum_snare_soft.wav` | https://freesound.org/people/menegass/sounds/100059/ |
| `drum_cymbal_closed.wav` | https://freesound.org/people/menegass/sounds/100053/ |
| `drum_cymbal_pedal.wav` | https://freesound.org/people/menegass/sounds/100054/ |
| `drum_cymbal_soft.wav` | https://freesound.org/people/menegass/sounds/100057/ |
| `drum_tom_lo_hard.wav` | https://freesound.org/people/menegass/sounds/100064/ |
| `drum_tom_lo_soft.wav` | https://freesound.org/people/menegass/sounds/100065/ |
| `drum_tom_mid_hard.wav` | https://freesound.org/people/menegass/sounds/100066/ |
| `drum_tom_mid_soft.wav` | https://freesound.org/people/menegass/sounds/100067/ |
| `drum_tom_hi_hard.wav` | https://freesound.org/people/menegass/sounds/100062/ |
| `drum_tom_hi_soft.wav` | https://freesound.org/people/menegass/sounds/100063/ |
| `drum_splash_soft.wav` | https://freesound.org/people/menegass/sounds/100061/ |
| `perc_snap.wav` | https://freesound.org/people/SoundCollectah/sounds/109400/ |
| `perc_snap2.wav` | https://freesound.org/people/Peram/sounds/158615/ |

## Processing

The originals are 16-bit mono FLAC at 44.1 kHz (two are stereo). For this pack each
was decoded, downmixed to mono, resampled to **32 kHz**, trimmed of leading and
trailing silence, peak-normalised and given an 8 ms tail fade, then written as
**16-bit WAV**.

WAV rather than FLAC deliberately: `decodeAudioData` handles FLAC unevenly across
Safari versions, and this app is meant to run on an iPad. WAV decodes everywhere.
32 kHz keeps everything up to 16 kHz — all the cymbal air that matters — for about a
quarter less size than 44.1.

Per-voice `gain` in `pack.json` restores the relative balance that peak-normalising
destroys: a hi-hat and a kick normalised to the same peak are not a drum kit.

## How this pack uses the format

- **Velocity layers** (`soft`) on kick, snare, hi-hat and all three toms. Below
  velocity 0.55 the genuinely softer take plays. Those voices set `"velTone": false`
  because the recording already carries the tone change — the synthetic darkening
  would be doubling up.
- **Round-robin** (two `variants`) on the snap, so a repeated snap alternates takes
  instead of retriggering one identical waveform.
