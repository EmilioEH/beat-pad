/* ─── CONFIG ─── */
const PADS = [
  { id: 0, label: 'Kick',  color: '#e63946' },
  { id: 1, label: 'Snare', color: '#00b4d8' },
  { id: 2, label: 'CHH',   color: '#adb5bd' },
  { id: 3, label: 'OHH',   color: '#ced4da' },
  { id: 4, label: 'Clap',  color: '#7b2cbf' },
  { id: 5, label: 'TomL',  color: '#2d6a4f' },
  { id: 6, label: 'TomH',  color: '#52b788' },
  { id: 7, label: 'Rim',   color: '#ffb703' },
  { id: 8, label: 'Crash', color: '#fb8500' },
];

/* ─── STATE ─── */
const state = {
  selectedPad: 0,
  recording: false,
  quantize: true,
};

/* ─── MODULES ─── */
const audio = new AudioEngine();
const seq = new Sequencer(120);
const rec = new Recorder(seq);

/* ─── DOM CACHE ─── */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

/* ─── INIT ─── */
document.addEventListener('DOMContentLoaded', () => {
  audio.init();
  buildGrid();
  buildSteps();
  bindTransport();
  bindKit();
  stepDisplay();
});

/* ─── BUILD PAD GRID ─── */
function buildGrid() {
  const grid = $('#padGrid');
  for (const p of PADS) {
    const btn = document.createElement('button');
    btn.className = 'pad';
    btn.dataset.id = p.id;
    btn.style.background = p.color;
    btn.style.setProperty('--pad-color', p.color);
    btn.innerHTML = `<span class="label">${p.label}</span><span class="led"></span>`;
    btn.addEventListener('pointerdown', () => onPadDown(p.id));
    btn.addEventListener('pointerup', () => onPadUp(p.id));
    btn.addEventListener('pointerleave', () => onPadUp(p.id));
    grid.appendChild(btn);
  }
}

function getPadEl(id) {
  return $(`.pad[data-id="${id}"]`);
}

/* ─── PAD INTERACTION ─── */
function onPadDown(id) {
  const el = getPadEl(id);
  el.classList.add('down');
  el.querySelector('.led').classList.add('on');

  audio.play(id);

  if (state.recording) rec.hit(id);

  selectPad(id);
}

function onPadUp(id) {
  const el = getPadEl(id);
  el.classList.remove('down');
  setTimeout(() => el.querySelector('.led').classList.remove('on'), 80);
}

function selectPad(id) {
  state.selectedPad = id;
  $$('.pad').forEach(e => e.classList.remove('selected'));
  getPadEl(id).classList.add('selected');
  $('#padLabel').textContent = PADS[id].label;
  stepDisplay();
}

/* ─── BUILD STEP ROW ─── */
function buildSteps() {
  const row = $('#stepRow');
  for (let i = 0; i < seq.numSteps; i++) {
    const el = document.createElement('div');
    el.className = 'step';
    el.dataset.i = i;
    el.addEventListener('click', () => {
      const pad = state.selectedPad;
      const on = seq.toggleStep(pad, i);
      el.classList.toggle('on', on);
      el.style.setProperty('--pad-color', PADS[pad].color);
      if (on) el.classList.add('active-pad');
      else el.classList.remove('active-pad');
    });
    row.appendChild(el);
  }
}

function stepDisplay() {
  const pad = state.selectedPad;
  const steps = $$('#stepRow .step');
  for (let i = 0; i < steps.length; i++) {
    const on = seq.pattern[pad][i];
    steps[i].classList.toggle('on', on);
    steps[i].style.setProperty('--pad-color', PADS[pad].color);
    steps[i].classList.toggle('active-pad', on);
  }
}

/* ─── TRANSPORT ─── */
function bindTransport() {
  $('#playBtn').addEventListener('click', () => {
    audio.ensure();
    if (seq.isPlaying) seq.stop();
    else seq.play();
  });

  seq.onPlay = (playing) => {
    $('#playBtn').classList.toggle('active', playing);
  };

  seq.onStep = (step, active) => {
    // Update step highlights
    const steps = $$('#stepRow .step');
    steps.forEach((el, i) => el.classList.toggle('current', i === step));

    // Temporarily light up pads that fire on this step
    $$('.pad .led').forEach(l => l.classList.remove('on'));
    for (const p of active) {
      getPadEl(p).querySelector('.led').classList.add('on');
    }

    // Play sounds for active pads
    for (const p of active) {
      audio.play(p);
    }
  };

  $('#recBtn').addEventListener('click', () => {
    state.recording = !state.recording;
    $('#recBtn').classList.toggle('active', state.recording);
    if (state.recording) {
      audio.ensure();
      rec.start();
      if (!seq.isPlaying) seq.play();
    } else {
      rec.stop(state.quantize);
      stepDisplay();
    }
  });

  $('#clrBtn').addEventListener('click', () => {
    seq.clear();
    stepDisplay();
  });

  // BPM
  $('#bpmSlider').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    seq.setBpm(val);
    $('#bpmDisplay').textContent = val;
  });

  // Pad nav
  $('#prevPad').addEventListener('click', () => {
    const next = (state.selectedPad - 1 + PADS.length) % PADS.length;
    selectPad(next);
  });
  $('#nextPad').addEventListener('click', () => {
    const next = (state.selectedPad + 1) % PADS.length;
    selectPad(next);
  });

  // Quantize toggle
  $('#quantToggle').addEventListener('change', (e) => {
    state.quantize = e.target.checked;
  });
}

/* ─── KIT SELECTOR ─── */
function bindKit() {
  $('#kitSelect').addEventListener('change', (e) => {
    audio.kit = e.target.value;
  });
}
