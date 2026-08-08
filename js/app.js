/* ═══════════════════════════════════════════════════════════════
   BEAT PAD

   Two ideas run through this file.

   1. A beat pad is for performing, not editing. Everything that
      matters — muting a part, rolling a pad, flipping to another
      pattern, changing the whole kit — happens while the loop is
      playing, with one tap, on the front of the device. The step
      grid exists, but it is not where the app lives.

   2. It grows with the child. Simple mode is six big pads and no
      vocabulary; Studio mode is nine pads, a grid, song cards,
      swing, velocity and a microphone. Same app, same sounds, and
      one select in the grown-up panel between them.
   ═══════════════════════════════════════════════════════════════ */

const ALL_VOICES = ['kick', 'snare', 'chh', 'ohh', 'clap', 'tomL', 'tomH', 'rim', 'crash'];
const LAYOUT_6 = ['kick', 'snare', 'chh', 'clap', 'tomH', 'crash'];
const LAYOUT_9 = ['kick', 'snare', 'chh', 'ohh', 'clap', 'tomL', 'tomH', 'rim', 'crash'];

/** Speed stays three pictures. They are now relative to the pack's own tempo. */
const SPEEDS = [
  { icon: '🐢', mult: 0.78, label: 'Slow' },
  { icon: '🐇', mult: 1.00, label: 'Medium' },
  { icon: '🚀', mult: 1.32, label: 'Fast' },
];

const BANK_NAMES = ['A', 'B', 'C', 'D'];

const STORE_KEY = 'beat-pad.v3';
const LEGACY_KEY = 'beat-pad.v2';

const HOLD_CLEAR_MS = 1500;
const HOLD_GEAR_MS = 3000;
const HOLD_BANK_MS = 700;    // hold a song card to copy the current beat into it
const HOLD_ROLL_MS = 260;    // hold a pad and it starts rolling
const ROLL_DIV = 2;          // rolls land on eighth notes

/* ═══════════════════ STATE ═══════════════════ */

const state = {
  mode: 'simple',        // simple | studio
  packId: 'boom',
  speed: 1,
  swing: null,           // null means "whatever the pack suggests"
  layout: LAYOUT_6.slice(),
  inMaker: false,
  muteMode: false,
  sampleMode: false,
  volume: 0.7,
  lastGroove: -1,
  undoSnapshot: null,
  hinted: false,
};

const audio = new AudioEngine();
let seq = null;
let rec = null;
let sampler = null;

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* ═══════════════════ BOOT ═══════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  audio.init();
  seq = new Sequencer(audio.ctx, ALL_VOICES, STEPS);
  rec = new Recorder(seq);
  sampler = new Sampler(audio);

  loadSaved();

  buildSpeeds();
  buildStepLights();
  buildBanks();
  bindTransport();
  bindParentPanel();
  wireSequencer();

  applyPack(state.packId, false);
  applyMode(state.mode, false);
  audio.setVolume(state.volume);

  if (state.hinted) $('#hint').classList.add('gone');

  // Any first touch anywhere unlocks audio.
  document.addEventListener('pointerdown', () => audio.unlock(), { once: true });

  // Recorded pads and downloadable packs both arrive late and just add
  // themselves to the strip. Neither blocks the app from being playable.
  sampler.init().then(() => {
    if (sampler.count) {
      buildPackStrip();
      // Saved recordings arrive after the first paint; if they belong to the
      // pack already on screen, the pads need to pick them up.
      if (state.packId === 'my') buildPads();
    }
    $('#clearSamples').hidden = sampler.count === 0;
  });
  discoverSamplePacks();
});

/** Publish any sample packs that happen to be hosted alongside the app. */
async function discoverSamplePacks() {
  const index = await fetchPackIndex();
  if (!index.length) return;
  for (const entry of index) {
    if (!entry || !entry.id) continue;
    const id = await loadSamplePack(audio, entry.id);
    if (id) buildPackStrip();
  }
}

/* ═══════════════════ PACKS ═══════════════════ */

function pack() {
  return resolvePack(state.packId) || resolvePack('boom');
}

function padArt(voice) {
  const p = pack().pads[voice];
  return p || { emoji: '⬜', name: voice, real: voice, color: '#888' };
}

/** The child-facing name in Simple mode, the real drum name in Studio. */
function padLabel(voice) {
  const art = padArt(voice);
  return state.mode === 'studio' ? (art.real || art.name) : art.name;
}

function applyPack(id, persist) {
  if (!audio.setPack(id)) return;
  state.packId = id;
  const p = pack();

  seq.setSwing(state.swing === null ? (p.swing || 0) : state.swing);
  applySpeed(state.speed, false);

  document.documentElement.style.setProperty('--chassis', p.chassis || '#6D5BD0');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', p.chassis || '#241F33');

  buildPads();
  buildMaker();
  buildPackStrip();
  refreshSwing();
  $('#packNote').textContent = p.blurb || '';
  if (persist) save();
  say(p.label);
}

/** Built-ins first, then anything downloaded, then your own recordings. */
function packList() {
  const ids = PACK_ORDER.slice();
  for (const id of Object.keys(PACKS)) {
    if (!ids.includes(id) && PACKS[id].loaded) ids.push(id);
  }
  if (sampler && sampler.count > 0 && !ids.includes('my')) ids.push('my');
  return ids;
}

function buildPackStrip() {
  const strip = $('#packStrip');
  strip.innerHTML = '';
  for (const id of packList()) {
    const p = PACKS[id];
    if (!p) continue;
    const b = document.createElement('button');
    b.className = 'chip' + (id === state.packId ? ' on' : '');
    b.dataset.pack = id;
    b.setAttribute('aria-label', p.label);
    b.setAttribute('aria-pressed', String(id === state.packId));
    b.innerHTML = `<span class="chipEmoji">${p.emoji}</span><span class="chipName">${p.label}</span>`;
    // Switching packs mid-loop is a performance move, so it must not stop anything.
    b.addEventListener('click', () => {
      dismissHint();
      audio.unlock().then(() => applyPack(id, true));
    });
    strip.appendChild(b);
  }
}

/* ═══════════════════ PADS ═══════════════════ */

function buildPads() {
  const grid = $('#padGrid');
  grid.innerHTML = '';
  grid.classList.toggle('nine', state.layout.length === 9);

  state.layout.forEach(voice => {
    const art = padArt(voice);
    const btn = document.createElement('button');
    btn.className = 'pad';
    btn.dataset.voice = voice;
    btn.style.setProperty('--c', art.color);
    btn.setAttribute('aria-label', padLabel(voice));
    btn.innerHTML =
      `<span class="face">${art.emoji}</span>` +
      `<span class="cap">${padLabel(voice)}</span>` +
      `<span class="badge" aria-hidden="true"></span>`;

    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      padDown(voice, btn, e);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev =>
      btn.addEventListener(ev, () => padUp(voice, btn))
    );

    // Buttons must stay usable from a keyboard or a switch device.
    btn.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
        e.preventDefault();
        padDown(voice, btn, null);
      }
    });
    btn.addEventListener('keyup', () => padUp(voice, btn));

    grid.appendChild(btn);
  });

  seq.setEnabled(state.layout);
  refreshPadLights();
}

/**
 * How hard the pad was hit. Real gear reads velocity from a sensor; a
 * touchscreen mostly can't, so where you land on the pad stands in for
 * it — the bottom of the pad is the loud end.
 */
function velocityFor(event, el) {
  if (!event) return 0.85;
  if (event.pointerType === 'touch' && event.pressure > 0 && event.pressure !== 0.5) {
    return 0.45 + event.pressure * 0.55;
  }
  const box = el.getBoundingClientRect();
  if (!box.height || event.clientY === undefined) return 0.85;
  const y = (event.clientY - box.top) / box.height;
  return Math.max(0.5, Math.min(1, 0.58 + y * 0.42));
}

const rollTimers = new Map();

function padDown(voice, btn, event) {
  dismissHint();

  if (state.sampleMode) {
    sampleInto(voice);
    return;
  }

  if (state.muteMode) {
    const muted = seq.toggleMute(voice);
    buzz(10);
    refreshPadLights();
    say(`${padLabel(voice)} ${muted ? 'off' : 'on'}`);
    save();
    return;
  }

  const vel = velocityFor(event, btn);
  hitPad(voice, btn, event, vel);

  // Keep holding and it turns into a roll, locked to the grid.
  clearTimeout(rollTimers.get(voice));
  rollTimers.set(voice, setTimeout(() => {
    rollTimers.delete(voice);
    seq.startRepeat(voice, ROLL_DIV, vel);
    btn.classList.add('rolling');
    buzz(8);
  }, HOLD_ROLL_MS));
}

function padUp(voice, btn) {
  clearTimeout(rollTimers.get(voice));
  rollTimers.delete(voice);
  if (seq.isRepeating(voice)) {
    seq.stopRepeat(voice);
    btn.classList.remove('rolling');
  }
}

function hitPad(voice, el, event, vel = 0.85) {
  if (seq.isMuted(voice)) return;
  if (audio.running) audio.play(voice, undefined, vel);
  else audio.unlock().then(() => audio.play(voice, undefined, vel));

  rec.hit(voice, vel);
  bumpPad(el, vel);
  ripple(el, event);
  buzz(vel > 0.85 ? 16 : 11);
}

function bumpPad(el, vel = 1) {
  if (!el) return;
  el.style.setProperty('--vel', vel.toFixed(2));
  el.classList.remove('hit');
  void el.offsetWidth;   // restart the animation
  el.classList.add('hit');
}

/**
 * The three-state pad light every real machine speaks:
 * dark (nothing here) · lit (this pad is in the pattern) · flash (firing).
 */
function refreshPadLights() {
  const p = seq.pattern;
  for (const el of $$('#padGrid .pad')) {
    const voice = el.dataset.voice;
    const armed = p[voice] && p[voice].some(v => v > 0);
    const muted = seq.isMuted(voice);
    el.classList.toggle('armed', !!armed && !muted);
    el.classList.toggle('muted', muted);
    el.classList.toggle('sampled', !!(sampler && state.packId === 'my' && sampler.has(voice)));
    el.querySelector('.badge').textContent =
      state.sampleMode ? '🎙️' : (muted ? '😴' : '');
  }
  $$('#beatMaker .mrow').forEach(row => {
    row.classList.toggle('muted', seq.isMuted(row.dataset.voice));
  });
}

function ripple(el, event) {
  if (!el) return;
  const r = document.createElement('span');
  r.className = 'ripple';
  const box = el.getBoundingClientRect();
  const x = event && event.clientX !== undefined ? event.clientX - box.left : box.width / 2;
  const y = event && event.clientY !== undefined ? event.clientY - box.top : box.height / 2;
  r.style.left = x + 'px';
  r.style.top = y + 'px';
  el.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

function padEl(voice) {
  return $(`#padGrid .pad[data-voice="${voice}"]`);
}

function buzz(ms) {
  if (navigator.vibrate) {
    try { navigator.vibrate(ms); } catch (_) { /* not supported */ }
  }
}

/* ═══════════════════ SPEED & SWING ═══════════════════ */

function buildSpeeds() {
  const wrap = $('#speeds');
  wrap.innerHTML = '';
  SPEEDS.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'ctl speed';
    b.dataset.i = i;
    b.setAttribute('aria-label', s.label);
    b.innerHTML = `<span class="glyph">${s.icon}</span>`;
    b.addEventListener('click', () => applySpeed(i, true));
    wrap.appendChild(b);
  });
}

function applySpeed(i, persist) {
  state.speed = i;
  seq.setBpm(Math.round((pack().tempo || 96) * SPEEDS[i].mult));
  $$('#speeds .speed').forEach(b => {
    const on = Number(b.dataset.i) === state.speed;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  if (persist) save();
}

function refreshSwing() {
  $('#swingSlider').value = String(Math.round(seq.swing * 100));
}

/* ═══════════════════ STEP LIGHTS ═══════════════════ */

function buildStepLights() {
  const wrap = $('#steps');
  wrap.innerHTML = '';
  for (let i = 0; i < STEPS; i++) {
    const dot = document.createElement('i');
    // The four big beats, and the little ones in between.
    if (i % 4 === 0) dot.className = 'beat';
    wrap.appendChild(dot);
  }
}

function lightStep(step) {
  const dots = $$('#steps i');
  dots.forEach((d, i) => d.classList.toggle('on', i === step));
}

/* ═══════════════════ BANKS (SONG CARDS) ═══════════════════ */

function buildBanks() {
  const wrap = $('#banks');
  wrap.innerHTML = '';
  BANK_NAMES.forEach((name, i) => {
    const b = document.createElement('button');
    b.className = 'ctl card';
    b.dataset.i = i;
    b.setAttribute('aria-label', `Song card ${name}`);
    b.innerHTML = `<span class="glyph">${name}</span><span class="hold-fill"></span>`;

    // Tap switches at the top of the loop; hold copies this beat into the card.
    holdToActivate(b, HOLD_BANK_MS, () => {
      seq.copyBankTo(i);
      refreshBanks();
      buzz([10, 40, 10]);
      say(`Copied to ${name}`);
      save();
    }, () => {
      dismissHint();
      audio.unlock().then(() => {
        seq.queueBank(i);
        refreshBanks();
        save();
      });
    });

    wrap.appendChild(b);
  });
  refreshBanks();
}

function refreshBanks() {
  $$('#banks .card').forEach(b => {
    const i = Number(b.dataset.i);
    b.classList.toggle('on', i === seq.bank);
    b.classList.toggle('queued', i === seq.queuedBank);
    b.classList.toggle('filled', !seq.isBankEmpty(i));
    b.setAttribute('aria-pressed', String(i === seq.bank));
  });
}

/* ═══════════════════ BEAT MAKER ═══════════════════ */

function buildMaker() {
  const wrap = $('#beatMaker');
  wrap.innerHTML = '';

  for (const voice of state.layout) {
    const art = padArt(voice);
    const row = document.createElement('div');
    row.className = 'mrow';
    row.dataset.voice = voice;
    row.style.setProperty('--c', art.color);

    // In the grid the row head is the natural place to mute a part —
    // pull the kick out, hear what the kick was doing.
    const head = document.createElement('button');
    head.className = 'mhead';
    head.setAttribute('aria-label', `Turn ${padLabel(voice)} on or off`);
    head.textContent = art.emoji;
    head.addEventListener('click', () => {
      seq.toggleMute(voice);
      refreshPadLights();
      buzz(10);
      save();
    });
    row.appendChild(head);

    for (let i = 0; i < seq.numSteps; i++) {
      const cell = document.createElement('button');
      cell.className = 'mcell' + (i % 4 === 0 ? ' beat' : '');
      cell.dataset.voice = voice;
      cell.dataset.i = String(i);
      cell.setAttribute('aria-label', `${padLabel(voice)} step ${i + 1}`);
      cell.addEventListener('click', () => {
        const vel = seq.cycleStep(voice, i);
        paintCell(cell, vel);
        if (vel) {
          if (audio.running) audio.play(voice, undefined, vel);
          buzz(10);
        }
        refreshPadLights();
        refreshBanks();
        save();
      });
      row.appendChild(cell);
    }
    wrap.appendChild(row);
  }
  refreshSteps();
}

function paintCell(cell, vel) {
  cell.classList.toggle('on', vel > 0);
  cell.classList.toggle('accent', vel >= 1);
  cell.style.setProperty('--v', vel.toFixed(2));
  cell.setAttribute('aria-pressed', String(vel > 0));
}

function refreshSteps() {
  $$('#beatMaker .mcell').forEach(cell => {
    paintCell(cell, seq.getStep(cell.dataset.voice, Number(cell.dataset.i)));
  });
}

function showMaker(on) {
  state.inMaker = on;
  $('#beatMaker').hidden = !on;
  $('#padGrid').hidden = on;
  $('#makerBtn').classList.toggle('on', on);
  if (on) refreshSteps();
}

/* ═══════════════════ MODE ═══════════════════ */

function applyMode(mode, persist) {
  state.mode = mode === 'studio' ? 'studio' : 'simple';
  const studio = state.mode === 'studio';

  state.layout = studio ? LAYOUT_9.slice() : LAYOUT_6.slice();
  $('#studioStrip').hidden = !studio;
  $('#makerBtn').hidden = !studio;

  if (!studio) {
    if (state.inMaker) showMaker(false);
    if (state.sampleMode) setSampleMode(false);
    // Simple mode keeps one pattern, so a child can never land on a silent card.
    seq.queueBank(0);
    refreshBanks();
  }

  document.body.classList.toggle('studio', studio);
  buildPads();
  buildMaker();
  if (persist) save();
}

/* ═══════════════════ SAMPLING ═══════════════════ */

function setSampleMode(on) {
  state.sampleMode = on && !!sampler;
  $('#sampleBtn').classList.toggle('on', state.sampleMode);
  document.body.classList.toggle('sampling', state.sampleMode);
  if (state.sampleMode && state.inMaker) showMaker(false);
  refreshPadLights();
  if (state.sampleMode) {
    toast(sampler.supported ? 'Tap a pad, then make a sound!' : 'No microphone here');
  }
}

async function sampleInto(voice) {
  if (!sampler.supported) {
    toast('No microphone here');
    return;
  }
  if (sampler.recording) return;

  // The microphone would otherwise record the app's own drums.
  if (seq.isPlaying) seq.stop();

  const el = padEl(voice);
  if (el) el.classList.add('listening');
  toast('Listening…');
  buzz(20);

  try {
    await audio.unlock();
    await sampler.record(voice);
    if (state.packId !== 'my') applyPack('my', true);
    else buildPads();
    buildPackStrip();
    $('#clearSamples').hidden = false;
    toast('Got it!');
    celebrate('🎉');
    audio.play(voice);
    save();
  } catch (err) {
    const why = err && err.message;
    toast(why === 'denied' ? 'Microphone not allowed'
        : why === 'unsupported' ? 'No microphone here'
        : "That didn't work — try again");
  } finally {
    if (el) el.classList.remove('listening');
    refreshPadLights();
  }
}

/* ═══════════════════ TRANSPORT ═══════════════════ */

function bindTransport() {
  $('#playBtn').addEventListener('click', () => {
    dismissHint();
    audio.unlock().then(() => seq.toggle());
  });

  $('#recBtn').addEventListener('click', () => {
    dismissHint();
    if (rec.active) {
      rec.cancel();
      return;
    }
    audio.unlock().then(() => {
      const fresh = !seq.isPlaying;
      if (fresh) seq.play();
      rec.arm(fresh);
    });
  });

  $('#diceBtn').addEventListener('click', () => {
    dismissHint();
    audio.unlock().then(() => {
      loadGroove();
      if (!seq.isPlaying) seq.play();
    });
  });

  $('#muteBtn').addEventListener('click', () => {
    state.muteMode = !state.muteMode;
    $('#muteBtn').classList.toggle('on', state.muteMode);
    document.body.classList.toggle('muting', state.muteMode);
    refreshPadLights();
    say(state.muteMode ? 'Tap a pad to turn it off' : 'Back to playing');
    if (state.muteMode) toast('Tap a pad to turn it off');
  });

  $('#makerBtn').addEventListener('click', () => showMaker(!state.inMaker));

  $('#sampleBtn').addEventListener('click', () => setSampleMode(!state.sampleMode));

  $('#swingSlider').addEventListener('input', e => {
    state.swing = Number(e.target.value) / 100;
    seq.setSwing(state.swing);
    save();
  });

  $('#undoBtn').addEventListener('click', () => {
    if (!state.undoSnapshot) return;
    seq.restore(state.undoSnapshot);
    state.undoSnapshot = null;
    $('#undoBtn').hidden = true;
    refreshSteps();
    refreshPadLights();
    refreshBanks();
    save();
    say('Beat is back');
  });

  // Destructive, so it takes a deliberate press-and-hold.
  holdToActivate($('#clearBtn'), HOLD_CLEAR_MS, () => {
    state.undoSnapshot = seq.snapshot();
    seq.clear();
    seq.unmuteAll();
    refreshSteps();
    refreshPadLights();
    refreshBanks();
    save();
    buzz([12, 60, 12]);
    offerUndo();
    say('Beat cleared');
  });

  holdToActivate($('#gearBtn'), HOLD_GEAR_MS, openParent);
}

let undoTimer = null;

/** Show the undo button for a while after anything destructive. */
function offerUndo() {
  $('#undoBtn').hidden = false;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => {
    $('#undoBtn').hidden = true;
    state.undoSnapshot = null;
  }, 12000);
}

/** The dice pulls from the active pack, so a groove always suits its kit. */
function loadGroove() {
  const grooves = pack().grooves || [];
  if (!grooves.length) return;

  let i = Math.floor(Math.random() * grooves.length);
  if (grooves.length > 1 && i === state.lastGroove) i = (i + 1) % grooves.length;
  state.lastGroove = i;

  state.undoSnapshot = seq.snapshot();
  seq.clear();
  for (const [voice, notation] of Object.entries(grooves[i])) {
    if (!state.layout.includes(voice)) continue;
    parseGroove(notation).forEach((vel, step) => {
      if (vel) seq.setStep(voice, step, vel);
    });
  }
  refreshSteps();
  refreshPadLights();
  refreshBanks();
  save();
  offerUndo();
  celebrate('🎵');
}

function wireSequencer() {
  seq.onNote = (voice, time, vel) => audio.play(voice, time, vel);

  seq.onPlay = playing => {
    const b = $('#playBtn');
    b.classList.toggle('on', playing);
    b.querySelector('.glyph').textContent = playing ? '⏸' : '▶';
    b.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    if (!playing) {
      lightStep(-1);
      $$('#beatMaker .mcell').forEach(c => c.classList.remove('current'));
      if (rec.active) rec.cancel();
    }
  };

  seq.onStep = (step, active) => {
    if (step >= 0) {
      lightStep(step);
      $$('#beatMaker .mcell').forEach(c => {
        c.classList.toggle('current', Number(c.dataset.i) === step);
      });
    }
    for (const hit of active) bumpPad(padEl(hit.voice), hit.vel);
    if (rec.state === 'countin' && step >= 0) lightCountIn(step);
  };

  seq.onLoop = () => rec.loopBoundary();

  seq.onBank = () => {
    refreshSteps();
    refreshPadLights();
    refreshBanks();
  };

  rec.onState = (s, added) => {
    const btn = $('#recBtn');
    btn.classList.toggle('waiting', s === 'waiting' || s === 'countin');
    btn.classList.toggle('on', s === 'recording');

    $('#countIn').hidden = s !== 'countin' && s !== 'recording';
    $('#countLabel').textContent = s === 'recording' ? '🔴' : '🎤';
    if (s !== 'countin') resetCountIn();

    if (s === 'waiting') say('Get ready');
    if (s === 'countin') say('Counting in');
    if (s === 'recording') say('Recording, play your beat');
    if (s === 'done') {
      refreshSteps();
      refreshPadLights();
      refreshBanks();
      save();
      if (added && added.length) {
        celebrate('🎉');
        audio.sparkle();
        buzz([10, 40, 10]);
        say('Nice beat');
      }
    }
  };
}

/* ═══════════════════ COUNT-IN ═══════════════════ */

function lightCountIn(step) {
  const dots = $$('#countDots i');
  const beat = Math.floor(step / 4);
  dots.forEach((d, i) => d.classList.toggle('on', i <= beat));
}

function resetCountIn() {
  $$('#countDots i').forEach(d => d.classList.remove('on'));
}

/* ═══════════════════ FEEDBACK ═══════════════════ */

function celebrate(emoji) {
  const fx = $('#fx');
  for (let i = 0; i < 14; i++) {
    const bit = document.createElement('span');
    bit.className = 'bit';
    bit.textContent = emoji;
    const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
    const dist = 90 + Math.random() * 120;
    bit.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    bit.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
    bit.style.animationDelay = (Math.random() * 0.1) + 's';
    fx.appendChild(bit);
    bit.addEventListener('animationend', () => bit.remove());
  }
}

let toastTimer = null;

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  say(msg);
}

function dismissHint() {
  if (state.hinted) return;
  state.hinted = true;
  $('#hint').classList.add('gone');
}

function say(msg) {
  $('#srStatus').textContent = msg;
}

/**
 * Press-and-hold with a filling overlay — easy for an adult, not for a
 * toddler. An optional tap handler fires when the hold is released early,
 * which is how the song cards get both "switch" and "copy" on one button.
 */
function holdToActivate(el, ms, done, onTap) {
  let timer = null;
  let fired = false;
  el.style.setProperty('--hold', ms + 'ms');

  const start = e => {
    if (e) e.preventDefault();
    if (timer) return;
    fired = false;
    el.classList.add('holding');
    timer = setTimeout(() => {
      timer = null;
      fired = true;
      el.classList.remove('holding');
      done();
    }, ms);
  };
  const abort = () => {
    const wasHolding = !!timer;
    if (timer) clearTimeout(timer);
    timer = null;
    el.classList.remove('holding');
    if (wasHolding && !fired && onTap) onTap();
  };

  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', abort);
  el.addEventListener('pointerleave', abort);
  el.addEventListener('pointercancel', abort);
  // Keyboard equivalent: hold Enter/Space, same duration.
  el.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) start(e);
  });
  el.addEventListener('keyup', abort);
  el.addEventListener('blur', abort);
}

/* ═══════════════════ PARENT PANEL ═══════════════════ */

function openParent() {
  $('#modeSelect').value = state.mode;
  $('#volSlider').value = String(Math.round(state.volume * 100));
  $('#packNote').textContent = pack().blurb || '';
  $('#clearSamples').hidden = !sampler || sampler.count === 0;
  $('#parentPanel').hidden = false;
  $('#closeParent').focus();
}

function bindParentPanel() {
  $('#closeParent').addEventListener('click', () => {
    $('#parentPanel').hidden = true;
  });

  $('#modeSelect').addEventListener('change', e => applyMode(e.target.value, true));

  $('#volSlider').addEventListener('input', e => {
    state.volume = Number(e.target.value) / 100;
    audio.setVolume(state.volume);
    save();
  });

  $('#sampleFromPanel').addEventListener('click', () => {
    $('#parentPanel').hidden = true;
    if (state.mode !== 'studio') applyMode('studio', true);
    setSampleMode(true);
  });

  $('#clearSamples').addEventListener('click', async () => {
    await sampler.clearAll();
    if (state.packId === 'my') applyPack('boom', true);
    buildPackStrip();
    $('#clearSamples').hidden = true;
    toast('Recorded sounds deleted');
  });
}

/* ═══════════════════ PERSISTENCE ═══════════════════ */

let saveTimer = null;

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        v: 3,
        banks: seq.snapshotAll(),
        bank: seq.bank,
        muted: Array.from(seq.muted),
        packId: state.packId,
        speed: state.speed,
        swing: state.swing,
        mode: state.mode,
        volume: state.volume,
      }));
    } catch (_) {
      // Private mode or a full quota — the app still works, just forgetfully.
    }
  }, 300);
}

function loadSaved() {
  let data = null;
  try {
    data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
  } catch (_) {
    data = null;
  }

  if (!data) {
    migrateLegacy();
    return;
  }

  if (Array.isArray(data.banks)) seq.restoreAll(data.banks);
  if (Number.isInteger(data.bank)) seq.queueBank(data.bank);
  if (Array.isArray(data.muted)) for (const v of data.muted) seq.muted.add(v);

  if (data.packId && PACKS[data.packId]) state.packId = data.packId;
  if (Number.isInteger(data.speed) && SPEEDS[data.speed]) state.speed = data.speed;
  if (data.swing === null || typeof data.swing === 'number') state.swing = data.swing;
  if (data.mode === 'simple' || data.mode === 'studio') state.mode = data.mode;
  if (typeof data.volume === 'number') state.volume = data.volume;

  state.layout = state.mode === 'studio' ? LAYOUT_9.slice() : LAYOUT_6.slice();
  if (!seq.isEmpty()) state.hinted = true;
}

/**
 * v2 saved eight eighth-notes of booleans and a kit name. Spread those
 * across the sixteenth grid — every old step lands on an even step, so a
 * beat made last week plays back exactly as it did.
 */
function migrateLegacy() {
  let old = null;
  try {
    old = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
  } catch (_) {
    return;
  }
  if (!old) return;

  if (old.pattern) {
    const expanded = {};
    for (const [voice, steps] of Object.entries(old.pattern)) {
      if (!Array.isArray(steps)) continue;
      const row = new Array(STEPS).fill(0);
      steps.forEach((on, i) => {
        const target = i * 2;
        if (on && target < STEPS) row[target] = 1;
      });
      expanded[voice] = row;
    }
    seq.restore(expanded);
  }

  if (old.kit && PACKS[old.kit]) state.packId = old.kit;
  if (Number.isInteger(old.speed) && SPEEDS[old.speed]) state.speed = old.speed;
  if (typeof old.volume === 'number') state.volume = old.volume;
  if (old.padCount === 9 || old.showMaker) state.mode = 'studio';
  state.layout = state.mode === 'studio' ? LAYOUT_9.slice() : LAYOUT_6.slice();
  if (!seq.isEmpty()) state.hinted = true;

  save();
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch (_) {
    // Leaving it behind is harmless; v3 takes precedence from now on.
  }
}
