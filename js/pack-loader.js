/* ═══════════════════════════════════════════════════════════════
   DOWNLOADABLE SAMPLE PACKS

   The synth packs in js/packs.js are always present: no download, no
   network, instant on first launch. Sample packs are the other half —
   sounds that cannot be synthesised convincingly (a real snare's
   rattle, a vinyl kick) fetched on demand and cached forever by the
   service worker.

   Nothing here is required for the app to work. Offline, or with no
   packs published, every call fails quietly and the app carries on
   with the built-in kits.

   A pack lives at packs/<id>/pack.json — see packs/README.md for the
   manifest format. Two details are what separate "sample playback"
   from a real kit, and both are in the manifest rather than in code:

     variants — two or three takes per voice, cycled round-robin, so
                repeats aren't literally identical waveforms
     soft     — a separate quieter take, used below velocity 0.55,
                because a soft hit is darker and not merely quieter
   ═══════════════════════════════════════════════════════════════ */

const PACK_ROOT = 'packs/';

/** Manifest for every published pack, or [] when there are none. */
async function fetchPackIndex() {
  try {
    const res = await fetch(PACK_ROOT + 'index.json', { cache: 'no-cache' });
    if (!res.ok) return [];
    const list = await res.json();
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];   // offline, or nothing published yet
  }
}

/**
 * Fetch, decode and register one sample pack.
 * @returns {Promise<string|null>} the pack id, or null if it could not load
 */
async function loadSamplePack(engine, id) {
  if (!engine || !engine.ctx) return null;
  if (PACKS[id] && PACKS[id].loaded) return id;

  let manifest;
  try {
    const res = await fetch(`${PACK_ROOT}${id}/pack.json`);
    if (!res.ok) return null;
    manifest = await res.json();
  } catch (_) {
    return null;
  }

  if (!manifest || !manifest.voices) return null;

  const base = `${PACK_ROOT}${id}/`;
  const banks = {};
  const voices = {};

  const jobs = Object.entries(manifest.voices).map(async ([voice, spec]) => {
    const hard = await decodeAll(engine.ctx, base, spec.variants || spec.files || []);
    if (!hard.length) return;

    const soft = await decodeAll(engine.ctx, base, spec.soft || []);
    banks[voice] = soft.length ? { hard, soft } : { hard };

    voices[voice] = {
      layers: [{
        src: 'sample',
        pack: id,
        voice,
        gain: spec.gain === undefined ? 1 : spec.gain,
        rate: spec.rate === undefined ? 1 : spec.rate,
        pan: spec.pan || 0,
        velTone: spec.velTone !== false,
      }],
      jitter: spec.jitter || { pitch: 0.008, gain: 0.05 },
    };
  });

  await Promise.all(jobs);
  if (!Object.keys(voices).length) return null;

  engine.setSampleBank(id, banks);

  PACKS[id] = {
    label: manifest.label || id,
    emoji: manifest.emoji || '📦',
    blurb: manifest.blurb || '',
    tempo: manifest.tempo || 96,
    swing: manifest.swing === undefined ? 0 : manifest.swing,
    trim: manifest.trim === undefined ? 1 : manifest.trim,
    space: manifest.space === undefined ? 0.12 : manifest.space,
    chassis: manifest.chassis || '#6D5BD0',
    // Falling back to a synth pack means a manifest that only defines a
    // kick and a snare still gives you a playable nine pads.
    extends: manifest.extends || 'boom',
    pads: manifest.pads || {},
    voices,
    grooves: manifest.grooves || [],
    sampled: true,
    loaded: true,
  };

  return id;
}

/** Fetch and decode a list of files, dropping any that fail. */
async function decodeAll(ctx, base, files) {
  const out = await Promise.all(files.map(async name => {
    try {
      const res = await fetch(base + name);
      if (!res.ok) return null;
      return await ctx.decodeAudioData(await res.arrayBuffer());
    } catch (_) {
      return null;
    }
  }));
  return out.filter(Boolean);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { fetchPackIndex, loadSamplePack, PACK_ROOT };
}
