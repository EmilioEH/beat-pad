/* Assertions that run inside the page, against the real engine and sequencer.
   Everything audio-related is rendered through OfflineAudioContext, so these
   are measurements of the actual signal rather than of the code's intentions. */

/* ═══════════════ signal helpers ═══════════════ */

function rms(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / data.length);
}

function peak(data) {
  let p = 0;
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i]);
    if (a > p) p = a;
  }
  return p;
}

/** In-place iterative radix-2 FFT. */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/** Power spectrum of an explicit window, Hann-windowed. */
function spectrumAt(data, sampleRate, start, N) {
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const s = data[start + i] || 0;
    re[i] = s * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
  }
  fft(re, im);
  const bins = N / 2;
  const power = new Float64Array(bins);
  for (let i = 0; i < bins; i++) power[i] = re[i] * re[i] + im[i] * im[i];
  return { power, binHz: sampleRate / N };
}

/** Frequency carrying the most energy below `limit` Hz. */
function peakFreqBelow(power, binHz, limit) {
  let best = 0, bestP = -1;
  for (let i = 1; i < Math.min(power.length, limit / binHz); i++) {
    if (power[i] > bestP) { bestP = power[i]; best = i * binHz; }
  }
  return best;
}

/** Power spectrum of the loudest 8192-sample window, Hann-windowed. */
function spectrum(data, sampleRate) {
  const N = 8192;
  let start = 0;
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > 0.01) { start = i; break; }
  }
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const s = data[start + i] || 0;
    re[i] = s * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
  }
  fft(re, im);
  const bins = N / 2;
  const power = new Float64Array(bins);
  for (let i = 0; i < bins; i++) power[i] = re[i] * re[i] + im[i] * im[i];
  return { power, binHz: sampleRate / N };
}

function bandEnergy(power, binHz, lo, hi) {
  let sum = 0;
  for (let i = Math.ceil(lo / binHz); i < Math.min(power.length, hi / binHz); i++) {
    sum += power[i];
  }
  return sum;
}

/**
 * Spectral flatness over a band: geometric mean / arithmetic mean.
 * White noise sits near 1; something with distinct partials sits far below.
 */
function flatness(power, binHz, lo, hi) {
  const a = Math.ceil(lo / binHz);
  const b = Math.min(power.length, Math.floor(hi / binHz));
  let logSum = 0, sum = 0, n = 0;
  for (let i = a; i < b; i++) {
    const p = power[i] + 1e-20;
    logSum += Math.log(p);
    sum += p;
    n++;
  }
  if (!n) return 1;
  return Math.exp(logSum / n) / (sum / n);
}

function centroid(power, binHz) {
  let num = 0, den = 0;
  for (let i = 1; i < power.length; i++) {
    num += i * binHz * power[i];
    den += power[i];
  }
  return den ? num / den : 0;
}

/* ═══════════════ rendering ═══════════════ */

const SR = 44100;

/** Render one voice through the whole master chain, exactly as it is heard. */
async function renderVoice(packId, voice, seconds = 2, vel = 1, times = [0]) {
  const oc = new OfflineAudioContext(2, Math.ceil(SR * seconds), SR);
  const e = new AudioEngine();
  e.init(oc);
  e.setPack(packId);
  e.setVolume(1);
  for (const t of times) e.play(voice, t, vel);
  const buf = await oc.startRendering();
  return buf;
}

/** Render an arbitrary voice spec, for before/after comparisons. */
async function renderSpec(spec, seconds = 2, vel = 1) {
  const oc = new OfflineAudioContext(2, Math.ceil(SR * seconds), SR);
  const e = new AudioEngine();
  e.init(oc);
  e.setPack('boom');
  e.setVolume(1);
  e.pack = { ...e.pack, voices: { ...e.pack.voices, __test: spec } };
  e.play('__test', 0, vel);
  const buf = await oc.startRendering();
  return buf;
}

function mono(buf) {
  const l = buf.getChannelData(0);
  const r = buf.numberOfChannels > 1 ? buf.getChannelData(1) : l;
  const out = new Float32Array(l.length);
  for (let i = 0; i < l.length; i++) out[i] = (l[i] + r[i]) / 2;
  return out;
}

/* ═══════════════ the checks ═══════════════ */

const results = [];

function check(name, pass, detail) {
  results.push({ name, pass: !!pass, detail });
}

async function runChecks() {
  /* ── 1. The kick must survive a phone speaker ──────────────────
     The old kick was a sine sliding 150→40 Hz across its whole decay,
     with no transient and no drive. A phone speaker rolls off hard
     below ~200 Hz, so we measure only the part it can reproduce. */
  {
    const oldKick = {
      layers: [{ src: 'osc', wave: 'sine', freq: 150, freqEnd: 40, gain: 1.0, dur: 0.35 }],
      jitter: null,
    };
    const before = mono(await renderSpec(oldKick));
    const after = mono(await renderVoice('boom', 'kick'));

    const sb = spectrum(before, SR);
    const sa = spectrum(after, SR);
    const eBefore = bandEnergy(sb.power, sb.binHz, 200, 2000);
    const eAfter = bandEnergy(sa.power, sa.binHz, 200, 2000);
    const ratio = eAfter / Math.max(eBefore, 1e-12);

    check('kick is audible on a small speaker (200–2000 Hz energy up)',
      ratio > 8, `${ratio.toFixed(1)}× the old kick's energy in that band`);
  }

  /* ── 2. Pitch envelope is separate from the amplitude envelope ──
     Ours drops to its final pitch in 45 ms and then rings there. A kick
     whose pitch is welded to its decay is still sliding 100 ms in, which
     is exactly what makes it read as a "boop" rather than a "boom".
     Measure the fundamental in a window well after the attack. */
  {
    const welded = {
      layers: [{ src: 'osc', wave: 'sine', freq: 155, freqEnd: 48, gain: 1.0, dur: 0.52 }],
      jitter: null,
    };
    const ours = mono(await renderVoice('boom', 'kick'));
    const slid = mono(await renderSpec(welded));

    const at = Math.floor(SR * 0.1);
    const sOurs = spectrumAt(ours, SR, at, 4096);
    const sSlid = spectrumAt(slid, SR, at, 4096);
    const fOurs = peakFreqBelow(sOurs.power, sOurs.binHz, 400);
    const fSlid = peakFreqBelow(sSlid.power, sSlid.binHz, 400);

    check('kick pitch settles fast, then the body rings at one pitch',
      fOurs < fSlid * 0.75 && fOurs < 70,
      `100 ms in: ours ${fOurs.toFixed(0)} Hz (target 48), welded envelope ${fSlid.toFixed(0)} Hz`);
  }

  /* ── 3. Hats are metal, not white noise ─────────────────────── */
  {
    const hat = mono(await renderVoice('boom', 'chh', 0.5));
    const s = spectrum(hat, SR);
    const f = flatness(s.power, s.binHz, 6000, 16000);

    const noiseRef = {
      layers: [{ src: 'noise', gain: 0.3, dur: 0.06, velTone: false,
                 filter: { type: 'highpass', freq: 9000 } }],
      jitter: null,
    };
    const ref = mono(await renderSpec(noiseRef, 0.5));
    const sr2 = spectrum(ref, SR);
    const fRef = flatness(sr2.power, sr2.binHz, 6000, 16000);

    check('hi-hat has metallic partials, not flat noise',
      f < fRef * 0.6, `flatness ${f.toFixed(4)} vs white-noise hat ${fRef.toFixed(4)}`);
  }

  /* ── 4. Repeated hits are not identical ─────────────────────── */
  {
    const takes = [];
    for (let i = 0; i < 6; i++) takes.push(rms(mono(await renderVoice('boom', 'kick', 1))));
    const mean = takes.reduce((a, b) => a + b, 0) / takes.length;
    const sd = Math.sqrt(takes.reduce((a, b) => a + (b - mean) ** 2, 0) / takes.length);
    const spread = sd / mean;
    check('repeated hits vary (jitter is live)',
      spread > 0.002 && spread < 0.2,
      `relative spread ${(spread * 100).toFixed(2)}% across 6 renders`);
  }

  /* ── 5. Velocity changes tone, not only level ───────────────── */
  {
    const soft = mono(await renderVoice('boom', 'snare', 1, 0.25));
    const hard = mono(await renderVoice('boom', 'snare', 1, 1));
    const cs = centroid(spectrum(soft, SR).power, spectrum(soft, SR).binHz);
    const ch = centroid(spectrum(hard, SR).power, spectrum(hard, SR).binHz);
    check('a soft hit is quieter AND darker',
      rms(soft) < rms(hard) && cs < ch,
      `rms ${rms(soft).toFixed(4)} < ${rms(hard).toFixed(4)}, centroid ${cs.toFixed(0)} < ${ch.toFixed(0)} Hz`);
  }

  /* ── 6. The bus never clips, even with everything at once ───── */
  {
    const oc = new OfflineAudioContext(2, SR * 3, SR);
    const e = new AudioEngine();
    e.init(oc);
    e.setPack('boom');
    e.setVolume(1);
    for (let bar = 0; bar < 6; bar++) {
      for (const v of ['kick', 'snare', 'chh', 'ohh', 'clap', 'tomL', 'tomH', 'rim', 'crash']) {
        e.play(v, bar * 0.12, 1);
      }
    }
    const buf = await oc.startRendering();
    const p = Math.max(peak(buf.getChannelData(0)), peak(buf.getChannelData(1)));
    check('nine voices at once do not clip', p <= 1.0, `peak ${p.toFixed(3)}`);
  }

  /* ── 7. Every pack renders every voice with real output ─────── */
  {
    const bad = [];
    for (const id of PACK_ORDER) {
      for (const v of ['kick', 'snare', 'chh', 'ohh', 'clap', 'tomL', 'tomH', 'rim', 'crash']) {
        const buf = mono(await renderVoice(id, v, 1));
        if (rms(buf) < 1e-5) bad.push(`${id}/${v}`);
      }
    }
    check('all 7 packs × 9 voices make a sound', bad.length === 0,
      bad.length ? `silent: ${bad.join(', ')}` : '63 voices checked');
  }

  /* ── 8. Timing maths ────────────────────────────────────────── */
  {
    const s = new Sequencer({ currentTime: 0 }, ALL_VOICES, 16);
    s.setBpm(120);
    const bar = s.stepDuration() * 16;
    check('16 sixteenths make one bar', Math.abs(bar - 2.0) < 1e-9,
      `${bar.toFixed(6)}s at 120 bpm (expected 2.000000s)`);

    s.setSwing(0.5);
    const off = s.swingOffset(1);
    const expect = 0.5 * s.stepDuration() * 0.62;
    check('swing delays offbeats by the stated fraction',
      Math.abs(off - expect) < 1e-12 && s.swingOffset(2) === 0,
      `offbeat +${(off * 1000).toFixed(2)}ms, downbeat +0ms`);
  }

  /* ── 9. Recorded hits land on the step you heard, swing included ── */
  {
    const s = new Sequencer({ currentTime: 0 }, ALL_VOICES, 16);
    s.setBpm(96);
    s.setSwing(0.6);
    s._anchor = 0;
    let wrong = [];
    for (let i = 0; i < 16; i++) {
      const at = i * s.stepDuration() + s.swingOffset(i);
      if (s.stepForTime(at) !== i) wrong.push(i);
      // ...and a hit a little late still belongs to its own step
      if (s.stepForTime(at + s.stepDuration() * 0.2) !== i) wrong.push(i + 0.2);
    }
    check('swung hits quantize to the step that was heard',
      wrong.length === 0, wrong.length ? `wrong: ${wrong.join(',')}` : '32 timestamps checked');
  }

  /* ── 10. Sample playback: round-robin and velocity layers ──────
     The path a downloadable pack and a microphone recording share.
     Three tone bursts stand in for three takes, so which buffer fired
     is readable straight off the spectrum. */
  {
    const oc = new OfflineAudioContext(1, SR * 2, SR);
    const e = new AudioEngine();
    e.init(oc);

    const tone = freq => {
      const b = oc.createBuffer(1, Math.floor(SR * 0.2), SR);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        d[i] = 0.6 * Math.sin(2 * Math.PI * freq * i / SR) * (1 - i / d.length);
      }
      return b;
    };

    e.setSampleBank('my', { kick: { hard: [tone(300), tone(900)], soft: [tone(2500)] } });
    PACKS.my.voices.kick = {
      layers: [{ src: 'sample', pack: 'my', voice: 'kick', gain: 1, velTone: false }],
      jitter: null,
    };
    e.setPack('my');
    e.setVolume(1);

    e.play('kick', 0.0, 1);     // → hard take 1
    e.play('kick', 0.5, 1);     // → hard take 2 (round-robin)
    e.play('kick', 1.0, 0.3);   // → soft take

    const buf = await oc.startRendering();
    const d = buf.getChannelData(0);
    const at = t => {
      const s = spectrumAt(d, SR, Math.floor(SR * t) + 200, 4096);
      return peakFreqBelow(s.power, s.binHz, 5000);
    };
    const f1 = at(0.0), f2 = at(0.5), f3 = at(1.0);
    const near = (a, b) => Math.abs(a - b) < 40;

    check('sample voices cycle round-robin and switch on velocity',
      near(f1, 300) && near(f2, 900) && near(f3, 2500),
      `hits fired ${f1.toFixed(0)}, ${f2.toFixed(0)}, ${f3.toFixed(0)} Hz ` +
      `(expected take 1, take 2, soft take)`);

    delete PACKS.my.voices.kick;
  }

  /* ── 11. Groove notation ────────────────────────────────────── */
  {
    const g = parseGroove('X---x---o-------');
    check('groove notation parses to velocities',
      g.length === 16 && g[0] === 1 && g[4] === 0.72 && g[8] === 0.45 && g[1] === 0,
      JSON.stringify(g.slice(0, 9)));
  }

  return results;
}
