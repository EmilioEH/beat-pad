/* ═══════════════════════════════════════════════════════════════
   INSTRUMENT PACKS

   A pack is not a list of sounds. It is a whole idea of a beat:
   the sounds, what the pads look like, how fast it wants to go,
   how much it swings, and a few grooves that belong to it. Tapping
   "Hip hop" should give you a boom-bap kit at 92 with a swung beat
   already on the grid — because that is what a genre actually is.

   Everything here is data. Adding a pack is an edit to this file.

   ── Groove notation ──────────────────────────────────────────────
   Sixteen characters, one per sixteenth note:
       X  accent      x  normal      o  ghost      -  silent
   So 'X---x---X---x---' is four-on-the-floor with accents on 1 and 3.
   ═══════════════════════════════════════════════════════════════ */

const VEL_CHARS = { X: 1, x: 0.72, o: 0.45 };
const STEPS = 16;

/** 'X---x---' → [1,0,0,0,0.72,0,0,0]. Short strings pad with silence. */
function parseGroove(str) {
  const out = new Array(STEPS).fill(0);
  for (let i = 0; i < Math.min(STEPS, str.length); i++) {
    out[i] = VEL_CHARS[str[i]] || 0;
  }
  return out;
}

/* ═══════════════ shared layer fragments ═══════════════ */

/** A few ms of filtered noise. This is what makes a drum audible on a phone. */
const click = (gain, freq, dur) => ({
  src: 'noise', gain, dur: dur || 0.006, attack: 0.0005,
  filter: { type: 'highpass', freq }, velTone: false,
});

/* ═══════════════ the packs ═══════════════ */

const PACKS = {

  /* ─────────────────────────────────────────────────────────────
     BOOM — the 808. Long tuned kick, snappy claps, metal hats.
     ───────────────────────────────────────────────────────────── */
  boom: {
    label: 'Hip Hop',
    emoji: '🔊',
    blurb: 'The 808 — the drum machine behind hip hop.',
    tempo: 92,
    swing: 0.18,
    trim: 1,
    space: 0.08,
    chassis: '#6D5BD0',

    pads: {
      kick:  { emoji: '🐘', name: 'Boom',   real: 'Kick',      color: '#7C5CFF' },
      snare: { emoji: '🐸', name: 'Frog',   real: 'Snare',     color: '#22C55E' },
      chh:   { emoji: '🐍', name: 'Hiss',   real: 'Hi-hat',    color: '#F59E0B' },
      ohh:   { emoji: '🌊', name: 'Splash', real: 'Open hat',  color: '#3B82F6' },
      clap:  { emoji: '👏', name: 'Clap',   real: 'Clap',      color: '#EC4899' },
      tomL:  { emoji: '🦁', name: 'Roar',   real: 'Low tom',   color: '#14B8A6' },
      tomH:  { emoji: '🥁', name: 'Drum',   real: 'High tom',  color: '#06B6D4' },
      rim:   { emoji: '🐦', name: 'Bird',   real: 'Rimshot',   color: '#F97316' },
      crash: { emoji: '⭐', name: 'Star',   real: 'Crash',     color: '#EF4444' },
    },

    voices: {
      // Pitch falls in 45 ms; the body rings for half a second. Drive puts
      // harmonics above 100 Hz so it survives a speaker that stops at 200.
      kick: {
        layers: [
          { src: 'osc', wave: 'sine', freq: 155, freqEnd: 48, pitchDur: 0.045,
            gain: 1.0, dur: 0.52, drive: 0.38, attack: 0.001 },
          click(0.42, 1800),
        ],
        jitter: { pitch: 0.012, gain: 0.05 },
      },

      snare: {
        layers: [
          { src: 'osc', wave: 'sine', freq: 186, gain: 0.5, dur: 0.11 },
          { src: 'osc', wave: 'sine', freq: 332, gain: 0.26, dur: 0.08 },
          { src: 'noise', gain: 0.52, dur: 0.20, drive: 0.15,
            filter: { type: 'highpass', freq: 1300 } },
          click(0.3, 3000),
        ],
        jitter: { pitch: 0.02, gain: 0.08, filter: 0.06 },
      },

      chh: {
        layers: [
          { src: 'metal', base: 40, gain: 0.34, dur: 0.055, hp: 8600,
            filter: { type: 'bandpass', freq: 11000, Q: 1.3 } },
        ],
        jitter: { pitch: 0.02, gain: 0.1, filter: 0.07 },
      },

      ohh: {
        layers: [
          { src: 'metal', base: 40, gain: 0.27, dur: 0.44, hp: 8000,
            filter: { type: 'bandpass', freq: 10000, Q: 1.1 } },
        ],
        jitter: { pitch: 0.02, gain: 0.08, filter: 0.06 },
      },

      // Three fast bursts and a short tail — the shape of a room full of hands.
      clap: {
        layers: [
          { src: 'noise', gain: 0.34, dur: 0.02, offset: 0,
            filter: { type: 'bandpass', freq: 1800, Q: 1.2 } },
          { src: 'noise', gain: 0.34, dur: 0.02, offset: 0.011,
            filter: { type: 'bandpass', freq: 1900, Q: 1.2 } },
          { src: 'noise', gain: 0.34, dur: 0.02, offset: 0.021,
            filter: { type: 'bandpass', freq: 1750, Q: 1.2 } },
          { src: 'noise', gain: 0.24, dur: 0.19, offset: 0.03,
            filter: { type: 'bandpass', freq: 2100, Q: 0.9 } },
        ],
        jitter: { pitch: 0, gain: 0.09, filter: 0.05 },
      },

      tomL: {
        layers: [
          { src: 'osc', wave: 'sine', freq: 108, freqEnd: 68, pitchDur: 0.1,
            gain: 0.72, dur: 0.44, pan: -0.28, drive: 0.12 },
          click(0.2, 1400),
        ],
      },

      tomH: {
        layers: [
          { src: 'osc', wave: 'sine', freq: 178, freqEnd: 116, pitchDur: 0.09,
            gain: 0.66, dur: 0.36, pan: 0.28, drive: 0.12 },
          click(0.2, 1600),
        ],
      },

      rim: {
        layers: [
          { src: 'osc', wave: 'triangle', freq: 440, gain: 0.34, dur: 0.05 },
          { src: 'noise', gain: 0.38, dur: 0.035,
            filter: { type: 'bandpass', freq: 3200, Q: 6 } },
        ],
        jitter: { pitch: 0.025, gain: 0.1 },
      },

      crash: {
        layers: [
          { src: 'metal', base: 40, gain: 0.24, dur: 1.7, hp: 5200,
            ratios: [2, 3, 4.16, 5.43, 6.79, 8.21, 9.7] },
          { src: 'noise', gain: 0.16, dur: 1.4,
            filter: { type: 'highpass', freq: 6000 } },
        ],
      },
    },

    grooves: [
      { kick: 'X-----x---X-----', snare: '----X-------X---', chh: 'x-o-x-o-x-o-x-o-' },
      { kick: 'X---------X-x---', snare: '----X-------X---', chh: 'x--xx--xx--xx--x', ohh: '------------o---' },
      { kick: 'X-----X---X-----', clap: '----X-------X---', chh: 'x-o-x-o-x-o-x-oo', rim: '--o-------o-----' },
      { kick: 'X--x--X---X--x--', snare: '----X-------X-o-', chh: 'x-x-x-x-x-x-x-x-', crash: 'X---------------' },
    ],
  },

  /* ─────────────────────────────────────────────────────────────
     BAND — an acoustic kit in a small room. Noisier, warmer, wetter.
     ───────────────────────────────────────────────────────────── */
  band: {
    label: 'Rock Band',
    emoji: '🥁',
    blurb: 'A real drum kit, played in a small room.',
    tempo: 112,
    swing: 0.05,
    trim: 1,
    space: 0.24,
    chassis: '#C2603C',

    pads: {
      kick:  { emoji: '🦶', name: 'Stomp',  real: 'Kick',     color: '#B45309' },
      snare: { emoji: '🥁', name: 'Snap',   real: 'Snare',    color: '#DC2626' },
      chh:   { emoji: '🤫', name: 'Tss',    real: 'Hi-hat',   color: '#CA8A04' },
      ohh:   { emoji: '🌬️', name: 'Whoosh', real: 'Open hat', color: '#0891B2' },
      clap:  { emoji: '👏', name: 'Clap',   real: 'Clap',     color: '#DB2777' },
      tomL:  { emoji: '🪘', name: 'Low',    real: 'Low tom',  color: '#0F766E' },
      tomH:  { emoji: '🪘', name: 'High',   real: 'High tom', color: '#0284C7' },
      rim:   { emoji: '🪵', name: 'Tick',   real: 'Rimshot',  color: '#EA580C' },
      crash: { emoji: '💥', name: 'Crash',  real: 'Crash',    color: '#E11D48' },
    },

    voices: {
      kick: {
        layers: [
          { src: 'osc', wave: 'sine', freq: 98, freqEnd: 44, pitchDur: 0.032,
            gain: 0.95, dur: 0.4, drive: 0.22 },
          { src: 'noise', gain: 0.34, dur: 0.03, attack: 0.0005,
            filter: { type: 'bandpass', freq: 2600, Q: 1.4 } },
        ],
        jitter: { pitch: 0.015, gain: 0.07 },
      },

      snare: {
        layers: [
          { src: 'osc', wave: 'triangle', freq: 178, gain: 0.42, dur: 0.1 },
          { src: 'noise', gain: 0.58, dur: 0.23, drive: 0.1,
            filter: { type: 'highpass', freq: 850 } },
          // The wires under the drum. This is the part people hear as "real".
          { src: 'noise', gain: 0.3, dur: 0.11, offset: 0.004,
            filter: { type: 'bandpass', freq: 5200, Q: 1.1 } },
        ],
        jitter: { pitch: 0.025, gain: 0.1, filter: 0.08 },
      },

      chh: {
        layers: [
          { src: 'metal', base: 62, gain: 0.2, dur: 0.05, hp: 9000 },
          { src: 'noise', gain: 0.18, dur: 0.045,
            filter: { type: 'highpass', freq: 9500 } },
        ],
        jitter: { pitch: 0.03, gain: 0.14, filter: 0.08 },
      },

      ohh: {
        layers: [
          { src: 'metal', base: 62, gain: 0.16, dur: 0.42, hp: 8200 },
          { src: 'noise', gain: 0.14, dur: 0.4,
            filter: { type: 'highpass', freq: 8500 } },
        ],
        jitter: { pitch: 0.03, gain: 0.1 },
      },

      clap: {
        layers: [
          { src: 'noise', gain: 0.3, dur: 0.018, offset: 0,
            filter: { type: 'bandpass', freq: 2400, Q: 1 } },
          { src: 'noise', gain: 0.3, dur: 0.018, offset: 0.009,
            filter: { type: 'bandpass', freq: 2500, Q: 1 } },
          { src: 'noise', gain: 0.3, dur: 0.018, offset: 0.018,
            filter: { type: 'bandpass', freq: 2300, Q: 1 } },
          { src: 'noise', gain: 0.22, dur: 0.16, offset: 0.026,
            filter: { type: 'bandpass', freq: 2600, Q: 0.8 } },
        ],
        jitter: { gain: 0.1, filter: 0.06 },
      },

      tomL: {
        layers: [
          { src: 'osc', wave: 'triangle', freq: 96, freqEnd: 62, pitchDur: 0.12,
            gain: 0.62, dur: 0.46, pan: -0.3 },
          { src: 'noise', gain: 0.16, dur: 0.02,
            filter: { type: 'bandpass', freq: 1800, Q: 1 } },
        ],
        jitter: { pitch: 0.02, gain: 0.08 },
      },

      tomH: {
        layers: [
          { src: 'osc', wave: 'triangle', freq: 158, freqEnd: 104, pitchDur: 0.1,
            gain: 0.58, dur: 0.38, pan: 0.3 },
          { src: 'noise', gain: 0.16, dur: 0.02,
            filter: { type: 'bandpass', freq: 2200, Q: 1 } },
        ],
        jitter: { pitch: 0.02, gain: 0.08 },
      },

      rim: {
        layers: [
          { src: 'osc', wave: 'triangle', freq: 512, gain: 0.28, dur: 0.04 },
          { src: 'noise', gain: 0.36, dur: 0.028,
            filter: { type: 'bandpass', freq: 4200, Q: 7 } },
        ],
        jitter: { pitch: 0.03, gain: 0.12 },
      },

      crash: {
        layers: [
          { src: 'metal', base: 55, gain: 0.2, dur: 1.9, hp: 4600,
            ratios: [2, 3, 4.16, 5.43, 6.79, 8.21, 9.7, 11.3] },
          { src: 'noise', gain: 0.18, dur: 1.7,
            filter: { type: 'highpass', freq: 5000 } },
        ],
      },
    },

    grooves: [
      { kick: 'X-------X-------', snare: '----X-------X---', chh: 'x-x-x-x-x-x-x-x-' },
      { kick: 'X-------X---X---', snare: '----X-------X---', chh: 'X-x-X-x-X-x-X-x-', crash: 'X---------------' },
      { kick: 'X---X---X---X---', snare: '----X-------X---', ohh: '--o---o---o---o-' },
      { kick: 'X-----X-X-------', snare: '----X-------X-x-', chh: 'x-x-x-x-x-x-xxxx', tomH: '------------o-o-' },
    ],
  },

  /* ─────────────────────────────────────────────────────────────
     TOY — plastic, square waves, cheerful and small.
     ───────────────────────────────────────────────────────────── */
  toy: {
    label: 'Toy Box',
    emoji: '🧸',
    blurb: 'Little plastic drums from a toy shop.',
    tempo: 124,
    swing: 0,
    trim: 1.05,
    space: 0.1,
    chassis: '#E8A33D',

    pads: {
      kick:  { emoji: '🪀', name: 'Bop',   real: 'Kick',     color: '#F43F5E' },
      snare: { emoji: '🎈', name: 'Pop',   real: 'Snare',    color: '#8B5CF6' },
      chh:   { emoji: '✨', name: 'Tick',  real: 'Hi-hat',   color: '#FACC15' },
      ohh:   { emoji: '🫧', name: 'Fizz',  real: 'Open hat', color: '#38BDF8' },
      clap:  { emoji: '👏', name: 'Clap',  real: 'Clap',     color: '#F472B6' },
      tomL:  { emoji: '🔵', name: 'Low',   real: 'Low tom',  color: '#2DD4BF' },
      tomH:  { emoji: '🟡', name: 'High',  real: 'High tom', color: '#4ADE80' },
      rim:   { emoji: '🔔', name: 'Ding',  real: 'Rimshot',  color: '#FB923C' },
      crash: { emoji: '🎉', name: 'Party', real: 'Crash',    color: '#F87171' },
    },

    voices: {
      kick: {
        layers: [
          { src: 'osc', wave: 'triangle', freq: 330, freqEnd: 92, pitchDur: 0.028,
            gain: 0.82, dur: 0.24, drive: 0.3 },
          click(0.3, 2200),
        ],
        jitter: { pitch: 0.02, gain: 0.06 },
      },
      snare: {
        layers: [
          { src: 'osc', wave: 'square', freq: 530, freqEnd: 310, pitchDur: 0.04,
            gain: 0.2, dur: 0.1 },
          { src: 'noise', gain: 0.32, dur: 0.13,
            filter: { type: 'bandpass', freq: 1900, Q: 1.8 } },
        ],
        jitter: { pitch: 0.03, gain: 0.1 },
      },
      chh: {
        layers: [
          { src: 'metal', base: 88, gain: 0.2, dur: 0.045, hp: 7500 },
        ],
        jitter: { pitch: 0.04, gain: 0.12 },
      },
      ohh: {
        layers: [
          { src: 'metal', base: 88, gain: 0.16, dur: 0.3, hp: 6800 },
        ],
        jitter: { pitch: 0.04, gain: 0.1 },
      },
      clap: {
        layers: [
          { src: 'noise', gain: 0.28, dur: 0.02, offset: 0,
            filter: { type: 'bandpass', freq: 2500, Q: 1.5 } },
          { src: 'noise', gain: 0.28, dur: 0.02, offset: 0.014,
            filter: { type: 'bandpass', freq: 2600, Q: 1.5 } },
          { src: 'noise', gain: 0.2, dur: 0.11, offset: 0.026,
            filter: { type: 'bandpass', freq: 2800, Q: 1 } },
        ],
        jitter: { gain: 0.1 },
      },
      tomL: {
        layers: [
          { src: 'osc', wave: 'square', freq: 268, freqEnd: 152, pitchDur: 0.05,
            gain: 0.26, dur: 0.22, pan: -0.25 },
        ],
        jitter: { pitch: 0.025 },
      },
      tomH: {
        layers: [
          { src: 'osc', wave: 'square', freq: 452, freqEnd: 286, pitchDur: 0.045,
            gain: 0.24, dur: 0.19, pan: 0.25 },
        ],
        jitter: { pitch: 0.025 },
      },
      rim: {
        layers: [
          { src: 'osc', wave: 'sine', freq: 1720, gain: 0.2, dur: 0.22 },
          { src: 'osc', wave: 'sine', freq: 2580, gain: 0.1, dur: 0.16 },
        ],
        jitter: { pitch: 0.015 },
      },
      crash: {
        layers: [
          { src: 'metal', base: 74, gain: 0.2, dur: 1.1, hp: 4200 },
        ],
      },
    },

    grooves: [
      { kick: 'X---x---X---x---', snare: '----X-------X---', chh: 'x-x-x-x-x-x-x-x-' },
      { kick: 'X-------X-------', rim: '--o---o---o---o-', chh: 'x---x---x---x---', crash: 'X---------------' },
      { kick: 'X---X---X---X---', clap: '----X-------X---', ohh: '------o-------o-' },
    ],
  },

  /* ─────────────────────────────────────────────────────────────
     KITCHEN — pots, tins, a glass and a cardboard box.
     The point of this pack is the lesson: anything can be a drum.
     That is not a gimmick, it is where sampling came from.
     ───────────────────────────────────────────────────────────── */
  kitchen: {
    label: 'Kitchen',
    emoji: '🍳',
    blurb: 'Pots, tins and a glass. Anything can be a drum.',
    tempo: 96,
    swing: 0.28,
    trim: 1.05,
    space: 0.2,
    chassis: '#3F9D6D',

    pads: {
      kick:  { emoji: '📦', name: 'Box',    real: 'Kick',     color: '#A16207' },
      snare: { emoji: '🥫', name: 'Tin',    real: 'Snare',    color: '#65A30D' },
      chh:   { emoji: '🥄', name: 'Spoon',  real: 'Hi-hat',   color: '#0D9488' },
      ohh:   { emoji: '🚿', name: 'Tap',    real: 'Open hat', color: '#0EA5E9' },
      clap:  { emoji: '👏', name: 'Clap',   real: 'Clap',     color: '#DB2777' },
      tomL:  { emoji: '🍲', name: 'Big pot', real: 'Low tom', color: '#7C3AED' },
      tomH:  { emoji: '🫕', name: 'Pot',    real: 'High tom', color: '#2563EB' },
      rim:   { emoji: '🥂', name: 'Glass',  real: 'Rimshot',  color: '#E879F9' },
      crash: { emoji: '🍳', name: 'Pan',    real: 'Crash',    color: '#DC2626' },
    },

    voices: {
      // A cardboard box: a short woody thump with almost no tail.
      kick: {
        layers: [
          { src: 'osc', wave: 'triangle', freq: 126, freqEnd: 72, pitchDur: 0.03,
            gain: 0.85, dur: 0.19, drive: 0.3 },
          { src: 'noise', gain: 0.4, dur: 0.045,
            filter: { type: 'lowpass', freq: 950 } },
        ],
        jitter: { pitch: 0.03, gain: 0.09 },
      },
      // A biscuit tin: metal ring plus a slap.
      snare: {
        layers: [
          { src: 'metal', base: 92, gain: 0.16, dur: 0.17, hp: 2600 },
          { src: 'noise', gain: 0.44, dur: 0.13,
            filter: { type: 'bandpass', freq: 2200, Q: 1.1 } },
        ],
        jitter: { pitch: 0.035, gain: 0.12, filter: 0.08 },
      },
      chh: {
        layers: [
          { src: 'noise', gain: 0.26, dur: 0.03,
            filter: { type: 'bandpass', freq: 6800, Q: 5 } },
        ],
        jitter: { gain: 0.16, filter: 0.12 },
      },
      ohh: {
        layers: [
          { src: 'noise', gain: 0.16, dur: 0.4, attack: 0.02,
            filter: { type: 'bandpass', freq: 5200, Q: 1.6 } },
        ],
        jitter: { gain: 0.1, filter: 0.08 },
      },
      clap: {
        layers: [
          { src: 'noise', gain: 0.32, dur: 0.02, offset: 0,
            filter: { type: 'bandpass', freq: 1700, Q: 1.1 } },
          { src: 'noise', gain: 0.32, dur: 0.02, offset: 0.013,
            filter: { type: 'bandpass', freq: 1850, Q: 1.1 } },
          { src: 'noise', gain: 0.22, dur: 0.15, offset: 0.024,
            filter: { type: 'bandpass', freq: 2000, Q: 0.9 } },
        ],
        jitter: { gain: 0.1 },
      },
      tomL: {
        layers: [
          { src: 'metal', base: 46, gain: 0.2, dur: 0.42, hp: 700,
            ratios: [1, 1.62, 2.31, 3.08], pan: -0.3 },
          { src: 'noise', gain: 0.2, dur: 0.02,
            filter: { type: 'lowpass', freq: 1400 } },
        ],
        jitter: { pitch: 0.03, gain: 0.1 },
      },
      tomH: {
        layers: [
          { src: 'metal', base: 78, gain: 0.18, dur: 0.32, hp: 1200,
            ratios: [1, 1.58, 2.24, 3.14], pan: 0.3 },
          { src: 'noise', gain: 0.18, dur: 0.02,
            filter: { type: 'lowpass', freq: 1900 } },
        ],
        jitter: { pitch: 0.03, gain: 0.1 },
      },
      // A wine glass: two clean partials, long and ringing.
      rim: {
        layers: [
          { src: 'osc', wave: 'sine', freq: 1480, gain: 0.2, dur: 0.5 },
          { src: 'osc', wave: 'sine', freq: 2210, gain: 0.09, dur: 0.34 },
          click(0.14, 5000, 0.004),
        ],
        jitter: { pitch: 0.008, gain: 0.08 },
      },
      crash: {
        layers: [
          { src: 'metal', base: 68, gain: 0.22, dur: 1.3, hp: 3400,
            ratios: [1, 1.71, 2.43, 3.19, 4.51, 5.88] },
        ],
        jitter: { pitch: 0.02, gain: 0.08 },
      },
    },

    grooves: [
      { kick: 'X-----x---X-----', snare: '----X-------X---', chh: 'x-o-x-o-x-o-x-o-' },
      { kick: 'X---------X-----', rim: '----X-------X---', chh: 'x--xx--xx--xx--x' },
      { kick: 'X--x--X---X-----', snare: '----X-------X-o-', tomH: '----------o-----', ohh: '--------------o-' },
    ],
  },

  /* ─────────────────────────────────────────────────────────────
     ROBOT — hard digital edges, heavy drive, no apologies.
     ───────────────────────────────────────────────────────────── */
  robot: {
    label: 'Robot',
    emoji: '🤖',
    blurb: 'Hard, bright and electronic.',
    tempo: 128,
    swing: 0,
    trim: 0.92,
    space: 0.14,
    chassis: '#3B7DD8',

    pads: {
      kick:  { emoji: '⚡', name: 'Zap',   real: 'Kick',     color: '#4F46E5' },
      snare: { emoji: '📻', name: 'Crackle', real: 'Snare',  color: '#0EA5E9' },
      chh:   { emoji: '💠', name: 'Blip',  real: 'Hi-hat',   color: '#22D3EE' },
      ohh:   { emoji: '📡', name: 'Buzz',  real: 'Open hat', color: '#818CF8' },
      clap:  { emoji: '👏', name: 'Clap',  real: 'Clap',     color: '#E879F9' },
      tomL:  { emoji: '🔻', name: 'Low',   real: 'Low tom',  color: '#14B8A6' },
      tomH:  { emoji: '🔺', name: 'High',  real: 'High tom', color: '#34D399' },
      rim:   { emoji: '🔩', name: 'Click', real: 'Rimshot',  color: '#F59E0B' },
      crash: { emoji: '🛸', name: 'Beam',  real: 'Crash',    color: '#F43F5E' },
    },

    voices: {
      kick: {
        layers: [
          { src: 'osc', wave: 'square', freq: 190, freqEnd: 44, pitchDur: 0.022,
            gain: 0.72, dur: 0.3, drive: 0.85 },
          click(0.4, 2600),
        ],
        jitter: { pitch: 0.008, gain: 0.03 },
      },
      snare: {
        layers: [
          { src: 'osc', wave: 'square', freq: 240, gain: 0.24, dur: 0.09, drive: 0.5 },
          { src: 'noise', gain: 0.5, dur: 0.16, drive: 0.4,
            filter: { type: 'highpass', freq: 1800 } },
        ],
        jitter: { pitch: 0.012, gain: 0.05, filter: 0.05 },
      },
      chh: {
        layers: [
          { src: 'metal', base: 120, gain: 0.24, dur: 0.035, hp: 9500,
            ratios: [1, 1.41, 2.13, 3.07, 4.21] },
        ],
        jitter: { pitch: 0.015, gain: 0.07 },
      },
      ohh: {
        layers: [
          { src: 'metal', base: 120, gain: 0.18, dur: 0.34, hp: 8800,
            ratios: [1, 1.41, 2.13, 3.07, 4.21], drive: 0.3 },
        ],
        jitter: { pitch: 0.015, gain: 0.06 },
      },
      clap: {
        layers: [
          { src: 'noise', gain: 0.32, dur: 0.014, offset: 0, drive: 0.3,
            filter: { type: 'bandpass', freq: 2200, Q: 2 } },
          { src: 'noise', gain: 0.32, dur: 0.014, offset: 0.008, drive: 0.3,
            filter: { type: 'bandpass', freq: 2300, Q: 2 } },
          { src: 'noise', gain: 0.24, dur: 0.12, offset: 0.017,
            filter: { type: 'bandpass', freq: 2600, Q: 1.2 } },
        ],
        jitter: { gain: 0.06 },
      },
      tomL: {
        layers: [
          { src: 'osc', wave: 'square', freq: 150, freqEnd: 78, pitchDur: 0.05,
            gain: 0.34, dur: 0.28, drive: 0.5, pan: -0.32 },
        ],
        jitter: { pitch: 0.012 },
      },
      tomH: {
        layers: [
          { src: 'osc', wave: 'square', freq: 260, freqEnd: 140, pitchDur: 0.045,
            gain: 0.3, dur: 0.24, drive: 0.5, pan: 0.32 },
        ],
        jitter: { pitch: 0.012 },
      },
      rim: {
        layers: [
          { src: 'osc', wave: 'square', freq: 1250, gain: 0.16, dur: 0.035, drive: 0.4 },
          { src: 'noise', gain: 0.28, dur: 0.02,
            filter: { type: 'bandpass', freq: 5200, Q: 8 } },
        ],
        jitter: { pitch: 0.02, gain: 0.08 },
      },
      crash: {
        layers: [
          { src: 'metal', base: 96, gain: 0.2, dur: 1.5, hp: 5000, drive: 0.35,
            ratios: [1, 1.41, 2.13, 3.07, 4.21, 5.93, 7.11] },
        ],
      },
    },

    grooves: [
      { kick: 'X---X---X---X---', chh: 'x-x-x-x-x-x-x-x-', clap: '----X-------X---' },
      { kick: 'X---X---X---X---', ohh: '--o---o---o---o-', snare: '--------X-------', rim: 'o-o-o-o-o-o-o-o-' },
      { kick: 'X--X--X---X--X--', chh: 'xxxxxxxxxxxxxxxx', crash: 'X---------------' },
    ],
  },

  /* ─────────────────────────────────────────────────────────────
     JUNGLE — hand percussion. Congas, bongos, shaker, woodblock,
     and an 808 cowbell because every kit deserves one.
     ───────────────────────────────────────────────────────────── */
  jungle: {
    label: 'Jungle',
    emoji: '🌴',
    blurb: 'Hands, wood and skin — drums you hit with your fingers.',
    tempo: 104,
    swing: 0.22,
    trim: 1.05,
    space: 0.22,
    chassis: '#2F8F5B',

    pads: {
      kick:  { emoji: '🦏', name: 'Deep',   real: 'Surdo',     color: '#92400E' },
      snare: { emoji: '🐒', name: 'Bongo',  real: 'Bongo',     color: '#D97706' },
      chh:   { emoji: '🍃', name: 'Shake',  real: 'Shaker',    color: '#65A30D' },
      ohh:   { emoji: '🌾', name: 'Long',   real: 'Cabasa',    color: '#16A34A' },
      clap:  { emoji: '👏', name: 'Clap',   real: 'Clap',      color: '#DB2777' },
      tomL:  { emoji: '🪘', name: 'Conga',  real: 'Low conga', color: '#B45309' },
      tomH:  { emoji: '🐆', name: 'Tap',    real: 'High conga', color: '#EA580C' },
      rim:   { emoji: '🪵', name: 'Wood',   real: 'Woodblock', color: '#78350F' },
      crash: { emoji: '🔔', name: 'Bell',   real: 'Cowbell',   color: '#CA8A04' },
    },

    voices: {
      kick: {
        layers: [
          { src: 'osc', wave: 'sine', freq: 92, freqEnd: 70, pitchDur: 0.11,
            gain: 0.9, dur: 0.5, drive: 0.2 },
          { src: 'noise', gain: 0.3, dur: 0.02,
            filter: { type: 'lowpass', freq: 1600 } },
        ],
        jitter: { pitch: 0.02, gain: 0.08 },
      },
      snare: {
        layers: [
          { src: 'osc', wave: 'sine', freq: 348, freqEnd: 300, pitchDur: 0.05,
            gain: 0.5, dur: 0.2 },
          { src: 'noise', gain: 0.26, dur: 0.035,
            filter: { type: 'bandpass', freq: 2400, Q: 1.4 } },
        ],
        jitter: { pitch: 0.03, gain: 0.1 },
      },
      // A shaker has a soft attack. That is the whole difference between
      // "shhk" and "tick", and it is one number: attack.
      chh: {
        layers: [
          { src: 'noise', gain: 0.24, dur: 0.06, attack: 0.008,
            filter: { type: 'highpass', freq: 6200 } },
        ],
        jitter: { gain: 0.16, filter: 0.1 },
      },
      ohh: {
        layers: [
          { src: 'noise', gain: 0.18, dur: 0.26, attack: 0.02,
            filter: { type: 'highpass', freq: 5400 } },
        ],
        jitter: { gain: 0.12, filter: 0.08 },
      },
      clap: {
        layers: [
          { src: 'noise', gain: 0.3, dur: 0.02, offset: 0,
            filter: { type: 'bandpass', freq: 1600, Q: 1.1 } },
          { src: 'noise', gain: 0.3, dur: 0.02, offset: 0.012,
            filter: { type: 'bandpass', freq: 1750, Q: 1.1 } },
          { src: 'noise', gain: 0.22, dur: 0.14, offset: 0.023,
            filter: { type: 'bandpass', freq: 1900, Q: 0.9 } },
        ],
        jitter: { gain: 0.1 },
      },
      tomL: {
        layers: [
          { src: 'osc', wave: 'sine', freq: 196, freqEnd: 172, pitchDur: 0.07,
            gain: 0.6, dur: 0.34, pan: -0.3 },
          { src: 'noise', gain: 0.22, dur: 0.022,
            filter: { type: 'bandpass', freq: 2000, Q: 1.2 } },
        ],
        jitter: { pitch: 0.025, gain: 0.1 },
      },
      tomH: {
        layers: [
          { src: 'osc', wave: 'sine', freq: 420, freqEnd: 380, pitchDur: 0.04,
            gain: 0.44, dur: 0.18, pan: 0.3 },
          { src: 'noise', gain: 0.24, dur: 0.018,
            filter: { type: 'bandpass', freq: 3200, Q: 1.4 } },
        ],
        jitter: { pitch: 0.03, gain: 0.12 },
      },
      rim: {
        layers: [
          { src: 'osc', wave: 'square', freq: 1180, gain: 0.14, dur: 0.045 },
          { src: 'osc', wave: 'sine', freq: 2360, gain: 0.08, dur: 0.03 },
          { src: 'noise', gain: 0.2, dur: 0.014,
            filter: { type: 'bandpass', freq: 4000, Q: 5 } },
        ],
        jitter: { pitch: 0.02, gain: 0.1 },
      },
      // The 808 cowbell: two squares a fifth-ish apart through a bandpass.
      crash: {
        layers: [
          { src: 'metal', base: 270, gain: 0.2, dur: 0.42, hp: 1800,
            ratios: [1, 1.48],
            filter: { type: 'bandpass', freq: 2700, Q: 1.6 } },
        ],
        jitter: { pitch: 0.012, gain: 0.08 },
      },
    },

    grooves: [
      { kick: 'X-------X-------', tomH: '--o-x---o-x---x-', chh: 'x-x-x-x-x-x-x-x-', rim: '----X-------X---' },
      { kick: 'X-----X---X-----', tomL: '------x-----x---', tomH: '--o---------o-o-', chh: 'x-o-x-o-x-o-x-o-' },
      { kick: 'X---X---X---X---', crash: '--o---o---o---o-', chh: 'x-x-x-x-x-x-x-x-', clap: '----X-------X---' },
    ],
  },

  /* ─────────────────────────────────────────────────────────────
     MELODY — not drums. Pads are notes from the C major pentatonic
     scale, which is the oldest trick in music teaching: there is no
     combination of these five notes that sounds wrong. A child can
     improvise over any of the grooves above and land it every time.
     ───────────────────────────────────────────────────────────── */
  melody: {
    label: 'Melody',
    emoji: '🎵',
    blurb: 'Five notes that always sound good together.',
    tempo: 96,
    swing: 0.18,
    trim: 1,
    space: 0.3,
    chassis: '#B25FC4',
    melodic: true,

    pads: {
      kick:  { emoji: '🟣', name: 'Do',  real: 'C', color: '#8B5CF6' },
      snare: { emoji: '🔵', name: 'Re',  real: 'D', color: '#3B82F6' },
      chh:   { emoji: '🟢', name: 'Mi',  real: 'E', color: '#22C55E' },
      ohh:   { emoji: '🟡', name: 'So',  real: 'G', color: '#EAB308' },
      clap:  { emoji: '🟠', name: 'La',  real: 'A', color: '#F97316' },
      tomL:  { emoji: '🔴', name: 'Do↑', real: 'C', color: '#EF4444' },
      tomH:  { emoji: '🩷', name: 'Re↑', real: 'D', color: '#EC4899' },
      rim:   { emoji: '🤍', name: 'Mi↑', real: 'E', color: '#94A3B8' },
      crash: { emoji: '💛', name: 'So↑', real: 'G', color: '#F59E0B' },
    },

    voices: buildMelodyVoices(),

    grooves: [
      { kick: 'x-------x-------', chh: '----x-------x---', clap: '--------x-------' },
      { kick: 'x---x---x---x---', ohh: '------x-------x-', tomL: '------------x---' },
      { chh: 'x-x---x-x---x-x-', kick: 'x-------x-------', crash: '--------------x-' },
    ],
  },

  /* ─────────────────────────────────────────────────────────────
     MY SOUNDS — whatever you recorded through the microphone.

     It extends Hip Hop rather than starting blank, so a pad you have
     not sampled yet still makes a sound instead of being a dead
     button. js/sampler.js writes voices into here as they're recorded.
     ───────────────────────────────────────────────────────────── */
  my: {
    label: 'My Sounds',
    emoji: '🎤',
    blurb: 'Sounds you recorded yourself.',
    extends: 'boom',
    tempo: 96,
    swing: 0.12,
    space: 0.1,
    chassis: '#C2557F',
    userPack: true,
    voices: {},
    pads: {},
  },
};

/**
 * A marimba-ish tuned voice: fundamental, a strong fourth harmonic
 * (which is what makes wooden bars sound wooden), and a mallet click.
 */
function toneVoice(freq, pan) {
  return {
    layers: [
      { src: 'osc', wave: 'sine', freq, gain: 0.5, dur: 1.1, attack: 0.004 },
      { src: 'osc', wave: 'sine', freq: freq * 4, gain: 0.12, dur: 0.32, attack: 0.003 },
      { src: 'osc', wave: 'triangle', freq: freq * 2, gain: 0.1, dur: 0.5, attack: 0.004, pan },
      { src: 'noise', gain: 0.1, dur: 0.008, attack: 0.0005,
        filter: { type: 'bandpass', freq: freq * 6, Q: 2 } },
    ],
    jitter: { pitch: 0.004, gain: 0.07 },
  };
}

/** C major pentatonic across nine pads: C D E G A C D E G. */
function buildMelodyVoices() {
  const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99];
  const order = ['kick', 'snare', 'chh', 'ohh', 'clap', 'tomL', 'tomH', 'rim', 'crash'];
  const voices = {};
  order.forEach((v, i) => {
    voices[v] = toneVoice(notes[i], (i / (order.length - 1)) * 0.7 - 0.35);
  });
  return voices;
}

/**
 * Resolve a pack id to a complete pack, applying `extends` so a pack can
 * override three voices without restating nine. Voices and pad art merge
 * per key; everything else is a plain override.
 */
function resolvePack(id) {
  const pack = PACKS[id];
  if (!pack) return null;
  if (!pack.extends) return pack;

  const base = resolvePack(pack.extends);
  if (!base) return pack;

  return {
    ...base,
    ...pack,
    pads:   { ...base.pads,   ...(pack.pads   || {}) },
    voices: { ...base.voices, ...(pack.voices || {}) },
  };
}

/** Pack ids in the order they appear on the chassis. */
const PACK_ORDER = ['boom', 'band', 'toy', 'kitchen', 'robot', 'jungle', 'melody'];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PACKS, PACK_ORDER, resolvePack, parseGroove, STEPS };
}
