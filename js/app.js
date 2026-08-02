/* ═══════════════════ CONFIG ═══════════════════ */

/** Every pad is a character first and a drum voice second. */
const PADS = {
  kick:  { emoji: '🐘', name: 'Boom',   color: '#7C5CFF' },
  snare: { emoji: '🐸', name: 'Frog',   color: '#22C55E' },
  chh:   { emoji: '🐍', name: 'Hiss',   color: '#F59E0B' },
  clap:  { emoji: '👏', name: 'Clap',   color: '#EC4899' },
  tomH:  { emoji: '🥁', name: 'Drum',   color: '#06B6D4' },
  crash: { emoji: '⭐', name: 'Star',   color: '#EF4444' },
  ohh:   { emoji: '🌊', name: 'Splash', color: '#3B82F6' },
  tomL:  { emoji: '🦁', name: 'Roar',   color: '#14B8A6' },
  rim:   { emoji: '🐦', name: 'Bird',   color: '#F97316' },
};

const ALL_VOICES = Object.keys(PADS);
const LAYOUT_6 = ['kick', 'snare', 'chh', 'clap', 'tomH', 'crash'];
const LAYOUT_9 = ['kick', 'snare', 'chh', 'ohh', 'clap', 'tomL', 'tomH', 'rim', 'crash'];

/** Speed as three pictures, never a number and never a slider. */
const SPEEDS = [
  { icon: '🐢', bpm: 76,  label: 'Slow' },
  { icon: '🐇', bpm: 104, label: 'Medium' },
  { icon: '🚀', bpm: 140, label: 'Fast' },
];

/** Ready-made beats behind the 🎲 button, all built from the 6-pad set. */
const PRESETS = [
  { kick: [0, 4], snare: [2, 6], chh: [0, 1, 2, 3, 4, 5, 6, 7] },
  { kick: [0, 3, 4], clap: [2, 6], chh: [0, 2, 4, 6] },
  { kick: [0, 2, 4, 6], snare: [4], crash: [0] },
  { kick: [0, 4], clap: [6], chh: [1, 3, 5, 7], tomH: [2] },
  { kick: [0, 4, 6], tomH: [1, 3], chh: [2, 6], crash: [0] },
];

const STORE_KEY = 'beat-pad.v2';
const HOLD_CLEAR_MS = 1500;
const HOLD_GEAR_MS = 3000;

/* ═══════════════════ STATE ═══════════════════ */

const state = {
  layout: LAYOUT_6.slice(),
  padCount: 6,
  speed: 1,
  showMaker: false,
  inMaker: false,
  volume: 0.7,
  kit: 'boom',
  lastPreset: -1,
  undoSnapshot: null,
  hinted: false,
};

const audio = new AudioEngine();
let seq = null;
let rec = null;

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* ═══════════════════ BOOT ═══════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  audio.init();
  seq = new Sequencer(audio.ctx, ALL_VOICES, 8);
  rec = new Recorder(seq);

  loadSaved();

  buildSpeeds();
  buildPads();
  buildMaker();
  bindTransport();
  bindParentPanel();
  wireSequencer();

  applySpeed(state.speed, false);
  audio.setKit(state.kit);
  audio.setVolume(state.volume);
  refreshSteps();
  refreshSpeedButtons();
  $('#makerBtn').hidden = !state.showMaker;
  if (state.hinted) $('#hint').classList.add('gone');

  // Any first touch anywhere unlocks audio.
  document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
});

/* ═══════════════════ PADS ═══════════════════ */

function buildPads() {
  const grid = $('#padGrid');
  grid.innerHTML = '';
  grid.classList.toggle('nine', state.padCount === 9);

  state.layout.forEach((voice, i) => {
    const p = PADS[voice];
    const btn = document.createElement('button');
    btn.className = 'pad';
    btn.dataset.voice = voice;
    btn.style.setProperty('--c', p.color);
    btn.style.setProperty('--delay', (i * 0.35) + 's');
    btn.setAttribute('aria-label', p.name);
    btn.innerHTML =
      `<span class="face">${p.emoji}</span><span class="cap">${p.name}</span>`;

    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      hitPad(voice, btn, e);
    });
    // Buttons must stay usable from a keyboard or a switch device.
    btn.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!e.repeat) hitPad(voice, btn, null);
      }
    });

    grid.appendChild(btn);
  });

  seq.setEnabled(state.layout);
}

function hitPad(voice, el, event) {
  dismissHint();

  if (audio.running) audio.play(voice);
  else audio.unlock().then(() => audio.play(voice));

  rec.hit(voice);
  bumpPad(el);
  ripple(el, event);
  buzz(12);
}

function bumpPad(el) {
  if (!el) return;
  el.classList.remove('hit');
  void el.offsetWidth;   // restart the animation
  el.classList.add('hit');
}

function ripple(el, event) {
  if (!el) return;
  const r = document.createElement('span');
  r.className = 'ripple';
  const box = el.getBoundingClientRect();
  const x = event ? event.clientX - box.left : box.width / 2;
  const y = event ? event.clientY - box.top : box.height / 2;
  r.style.left = x + 'px';
  r.style.top = y + 'px';
  el.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

function padEl(voice) {
  return $(`.pad[data-voice="${voice}"]`);
}

function buzz(ms) {
  if (navigator.vibrate) {
    try { navigator.vibrate(ms); } catch (_) { /* not supported */ }
  }
}

/* ═══════════════════ SPEED ═══════════════════ */

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
  seq.setBpm(SPEEDS[i].bpm);
  refreshSpeedButtons();
  if (persist) save();
}

function refreshSpeedButtons() {
  $$('#speeds .speed').forEach(b => {
    const on = Number(b.dataset.i) === state.speed;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

/* ═══════════════════ BEAT MAKER ═══════════════════ */

function buildMaker() {
  const wrap = $('#beatMaker');
  wrap.innerHTML = '';

  for (const voice of state.layout) {
    const p = PADS[voice];
    const row = document.createElement('div');
    row.className = 'mrow';
    row.style.setProperty('--c', p.color);

    const head = document.createElement('button');
    head.className = 'mhead';
    head.setAttribute('aria-label', `Play ${p.name}`);
    head.textContent = p.emoji;
    head.addEventListener('pointerdown', () => hitPad(voice, null, null));
    row.appendChild(head);

    for (let i = 0; i < seq.numSteps; i++) {
      const cell = document.createElement('button');
      cell.className = 'mcell';
      cell.dataset.voice = voice;
      cell.dataset.i = String(i);
      cell.setAttribute('aria-label', `${p.name} beat ${i + 1}`);
      cell.addEventListener('click', () => {
        const on = seq.toggleStep(voice, i);
        cell.classList.toggle('on', on);
        cell.setAttribute('aria-pressed', String(on));
        if (on) {
          if (audio.running) audio.play(voice);
          buzz(10);
        }
        save();
      });
      row.appendChild(cell);
    }
    wrap.appendChild(row);
  }
  refreshSteps();
}

function refreshSteps() {
  $$('#beatMaker .mcell').forEach(cell => {
    const on = !!seq.pattern[cell.dataset.voice][Number(cell.dataset.i)];
    cell.classList.toggle('on', on);
    cell.setAttribute('aria-pressed', String(on));
  });
}

function showMaker(on) {
  state.inMaker = on;
  $('#beatMaker').hidden = !on;
  $('#padGrid').hidden = on;
  $('#makerBtn').classList.toggle('on', on);
  if (on) refreshSteps();
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
      loadPreset();
      if (!seq.isPlaying) seq.play();
    });
  });

  $('#makerBtn').addEventListener('click', () => showMaker(!state.inMaker));

  $('#undoBtn').addEventListener('click', () => {
    if (!state.undoSnapshot) return;
    seq.restore(state.undoSnapshot);
    state.undoSnapshot = null;
    $('#undoBtn').hidden = true;
    refreshSteps();
    save();
    say('Beat is back');
  });

  // Destructive, so it takes a deliberate press-and-hold.
  holdToActivate($('#clearBtn'), HOLD_CLEAR_MS, () => {
    state.undoSnapshot = seq.snapshot();
    seq.clear();
    refreshSteps();
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

function loadPreset() {
  let i = Math.floor(Math.random() * PRESETS.length);
  if (PRESETS.length > 1 && i === state.lastPreset) i = (i + 1) % PRESETS.length;
  state.lastPreset = i;

  state.undoSnapshot = seq.snapshot();
  seq.clear();
  for (const [voice, steps] of Object.entries(PRESETS[i])) {
    if (!state.layout.includes(voice)) continue;
    for (const s of steps) seq.setStep(voice, s, true);
  }
  refreshSteps();
  save();
  offerUndo();
  celebrate('🎵');
}

function wireSequencer() {
  seq.onNote = (voice, time) => audio.play(voice, time);

  seq.onPlay = playing => {
    const b = $('#playBtn');
    b.classList.toggle('on', playing);
    b.querySelector('.glyph').textContent = playing ? '⏸' : '▶';
    b.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    if (!playing && rec.active) rec.cancel();
  };

  seq.onStep = (step, active) => {
    $$('#beatMaker .mcell').forEach(c => {
      c.classList.toggle('current', Number(c.dataset.i) === step);
    });
    for (const v of active) bumpPad(padEl(v));
    if (rec.state === 'countin') lightCountIn(step);
  };

  seq.onLoop = () => rec.loopBoundary();

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
  const beat = Math.floor(step / 2);
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

function dismissHint() {
  if (state.hinted) return;
  state.hinted = true;
  $('#hint').classList.add('gone');
}

function say(msg) {
  $('#srStatus').textContent = msg;
}

/** Press-and-hold with a filling overlay — easy for an adult, not for a toddler. */
function holdToActivate(el, ms, done) {
  let timer = null;
  el.style.setProperty('--hold', ms + 'ms');

  const start = e => {
    if (e) e.preventDefault();
    if (timer) return;
    el.classList.add('holding');
    timer = setTimeout(() => {
      timer = null;
      el.classList.remove('holding');
      done();
    }, ms);
  };
  const abort = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    el.classList.remove('holding');
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
  $('#kitSelect').value = state.kit;
  $('#padCount').value = String(state.padCount);
  $('#makerToggle').checked = state.showMaker;
  $('#volSlider').value = String(Math.round(state.volume * 100));
  $('#parentPanel').hidden = false;
  $('#closeParent').focus();
}

function bindParentPanel() {
  $('#closeParent').addEventListener('click', () => {
    $('#parentPanel').hidden = true;
  });

  $('#kitSelect').addEventListener('change', e => {
    state.kit = e.target.value;
    audio.setKit(state.kit);
    save();
  });

  $('#padCount').addEventListener('change', e => {
    state.padCount = Number(e.target.value);
    state.layout = state.padCount === 9 ? LAYOUT_9.slice() : LAYOUT_6.slice();
    buildPads();
    buildMaker();
    save();
  });

  $('#makerToggle').addEventListener('change', e => {
    state.showMaker = e.target.checked;
    $('#makerBtn').hidden = !state.showMaker;
    if (!state.showMaker && state.inMaker) showMaker(false);
    save();
  });

  $('#volSlider').addEventListener('input', e => {
    state.volume = Number(e.target.value) / 100;
    audio.setVolume(state.volume);
    save();
  });
}

/* ═══════════════════ PERSISTENCE ═══════════════════ */

let saveTimer = null;

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        pattern: seq.snapshot(),
        speed: state.speed,
        kit: state.kit,
        padCount: state.padCount,
        showMaker: state.showMaker,
        volume: state.volume,
      }));
    } catch (_) {
      // Private mode or a full quota — the app still works, just forgetfully.
    }
  }, 300);
}

function loadSaved() {
  let data;
  try {
    data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
  } catch (_) {
    return;
  }
  if (!data) return;

  if (data.pattern) seq.restore(data.pattern);
  if (Number.isInteger(data.speed) && SPEEDS[data.speed]) state.speed = data.speed;
  if (data.kit && KITS[data.kit]) state.kit = data.kit;
  if (data.padCount === 6 || data.padCount === 9) {
    state.padCount = data.padCount;
    state.layout = data.padCount === 9 ? LAYOUT_9.slice() : LAYOUT_6.slice();
  }
  state.showMaker = !!data.showMaker;
  if (typeof data.volume === 'number') state.volume = data.volume;
  if (!seq.isEmpty()) state.hinted = true;
}
