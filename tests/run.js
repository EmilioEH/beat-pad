/* Headless Chromium test runner.
 *
 *   node tests/run.js
 *
 * Serves the app, loads it in Chromium with autoplay unblocked, runs the
 * audio measurements in tests/audio-checks.js, then drives the real UI for
 * a boot smoke test and a v2→v3 save-migration check.
 */

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8137;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.md': 'text/markdown',
};

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let file = decodeURIComponent(req.url.split('?')[0]);
      if (file === '/') file = '/index.html';
      const full = path.join(ROOT, file);
      if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
        res.writeHead(404); res.end('nope'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
      fs.createReadStream(full).pipe(res);
    });
    server.listen(PORT, () => resolve(server));
  });
}

const green = s => `\x1b[32m${s}\x1b[0m`;
const red = s => `\x1b[31m${s}\x1b[0m`;
const dim = s => `\x1b[2m${s}\x1b[0m`;

(async () => {
  const server = await serve();
  const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  });

  const results = [];
  const errors = [];

  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  /* ── audio measurements ─────────────────────────────────────── */
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForFunction(() => typeof AudioEngine !== "undefined" && typeof seq !== "undefined" && !!seq);
  await page.addScriptTag({ path: path.join(__dirname, 'audio-checks.js') });
  const audio = await page.evaluate(() => runChecks());
  results.push(...audio);

  /* ── boot smoke ─────────────────────────────────────────────── */
  {
    const padCount = await page.locator('#padGrid .pad').count();
    results.push({
      name: 'boots with six pads in Simple mode',
      pass: padCount === 6,
      detail: `${padCount} pads`,
    });

    const chips = await page.locator('#packStrip .chip').count();
    results.push({
      name: 'pack strip is on the chassis',
      pass: chips >= 7,
      detail: `${chips} packs reachable in one tap`,
    });

    const leds = await page.locator('#steps i').count();
    results.push({ name: 'sixteen step lights', pass: leds === 16, detail: `${leds} lights` });

    // Tapping a pad must sound and must not throw.
    await page.locator('#padGrid .pad').first().click();
    await page.locator('#diceBtn').click();
    await page.waitForTimeout(400);
    const armed = await page.locator('#padGrid .pad.armed').count();
    results.push({
      name: 'dice fills the grid and lights the pads that hold it',
      pass: armed > 0,
      detail: `${armed} pads lit`,
    });

    const playing = await page.evaluate(() => seq.isPlaying);
    results.push({ name: 'dice starts the loop', pass: playing, detail: String(playing) });

    // Mute is a performance move: pattern must survive it.
    const muteOk = await page.evaluate(() => {
      const before = JSON.stringify(seq.snapshot());
      seq.toggleMute('kick');
      const after = JSON.stringify(seq.snapshot());
      const muted = seq.isMuted('kick');
      seq.toggleMute('kick');
      return muted && before === after;
    });
    results.push({
      name: 'muting silences a part without touching the pattern',
      pass: muteOk, detail: 'pattern unchanged while muted',
    });

    // Note repeat locks to the grid rather than free-running.
    const rollOk = await page.evaluate(async () => {
      const fired = [];
      const prev = seq.onNote;
      // A voice that is actually on screen — the sequencer refuses to roll a
      // pad the current layout doesn't show, which is the correct behaviour.
      seq.onNote = (v, t) => { if (v === 'chh') fired.push(t); };
      seq.startRepeat('chh', 2, 0.8);
      await new Promise(r => setTimeout(r, 900));
      seq.stopRepeat('chh');
      seq.onNote = prev;
      if (fired.length < 3) return { ok: false, n: fired.length };
      const gaps = fired.slice(1).map((t, i) => t - fired[i]);
      const want = seq.stepDuration() * 2;
      const worst = Math.max(...gaps.map(g => Math.abs(g - want)));
      return { ok: worst < 1e-6, n: fired.length, worst };
    });
    results.push({
      name: 'held pad rolls exactly on the grid',
      pass: rollOk.ok,
      detail: `${rollOk.n} hits, worst gap error ${((rollOk.worst || 0) * 1000).toFixed(6)} ms`,
    });

    // Song cards must not switch mid-bar.
    const bankOk = await page.evaluate(() => {
      seq.play();
      seq.queueBank(2);
      const queuedWhilePlaying = seq.bank === 0 && seq.queuedBank === 2;
      seq.stop();
      seq.queueBank(2);
      const immediateWhenStopped = seq.bank === 2;
      seq.queueBank(0);
      return queuedWhilePlaying && immediateWhenStopped;
    });
    results.push({
      name: 'song cards wait for the top of the loop',
      pass: bankOk, detail: 'queued while playing, instant when stopped',
    });

    // Studio mode opens the deeper machine without disturbing the pattern.
    const studioOk = await page.evaluate(() => {
      const before = JSON.stringify(seq.snapshot());
      applyMode('studio', false);
      const pads = document.querySelectorAll('#padGrid .pad').length;
      const strip = !document.getElementById('studioStrip').hidden;
      const label = document.querySelector('#padGrid .pad .cap').textContent;
      applyMode('simple', false);
      const simpleLabel = document.querySelector('#padGrid .pad .cap').textContent;
      return {
        ok: pads === 9 && strip && before === JSON.stringify(seq.snapshot()),
        label, simpleLabel,
      };
    });
    results.push({
      name: 'Studio mode adds pads, grid and cards; Simple keeps the kid names',
      pass: studioOk.ok && studioOk.label !== studioOk.simpleLabel,
      detail: `"${studioOk.simpleLabel}" in Simple, "${studioOk.label}" in Studio`,
    });
  }

  /* ── the real CC0 sample pack ───────────────────────────────── */
  {
    await page.waitForFunction(
      () => !!(typeof PACKS !== 'undefined' && PACKS.realkit && PACKS.realkit.loaded),
      null, { timeout: 20000 }
    ).catch(() => {});

    const pack = await page.evaluate(async () => {
      const SR = 44100;
      const V = ['kick', 'snare', 'chh', 'ohh', 'clap', 'tomL', 'tomH', 'rim', 'crash'];

      const engine = new AudioEngine();
      const oc = new OfflineAudioContext(2, SR * 3, SR);
      engine.init(oc);
      await loadSamplePack(engine, 'realkit');
      engine.setPack('realkit');
      engine.setVolume(1);

      const bank = v => engine._samples.get('realkit:' + v);
      const withSoft = V.filter(v => bank(v) && bank(v).soft && bank(v).soft.length);
      const rr = V.filter(v => bank(v) && bank(v).hard.length > 1);

      // Two snaps in a row must not be the same waveform twice.
      engine.play('clap', 0.0, 1);
      engine.play('clap', 1.0, 1);
      // A soft snare must be the softer *take*, not the hard one turned down.
      engine.play('snare', 2.0, 0.3);
      const buf = await oc.startRendering();
      const d = buf.getChannelData(0);

      const stat = (from, to) => {
        let s = 0, pk = 0, n = 0;
        for (let i = Math.floor(from * SR); i < Math.floor(to * SR); i++) {
          s += d[i] * d[i]; pk = Math.max(pk, Math.abs(d[i])); n++;
        }
        return { rms: Math.sqrt(s / n), peak: pk };
      };
      const a = stat(0.0, 0.9), b = stat(1.0, 1.9), soft = stat(2.0, 2.9);

      // Rendered separately so the hard take isn't scaled by the soft velocity.
      const oc2 = new OfflineAudioContext(2, SR, SR);
      const e2 = new AudioEngine();
      e2.init(oc2);
      await loadSamplePack(e2, 'realkit');
      e2.setPack('realkit');
      e2.setVolume(1);
      e2.play('snare', 0, 1);
      const b2 = await oc2.startRendering();
      const dh = b2.getChannelData(0);
      let sh = 0, ph = 0;
      for (let i = 0; i < dh.length; i++) { sh += dh[i] * dh[i]; ph = Math.max(ph, Math.abs(dh[i])); }
      const hard = { rms: Math.sqrt(sh / dh.length), peak: ph };

      return {
        voices: V.filter(v => !!bank(v)).length,
        withSoft: withSoft.length,
        rr,
        rrDiff: Math.abs(a.rms - b.rms) / Math.max(a.rms, b.rms),
        // crest factor: identical to the hard take if it were merely scaled
        hardCrest: hard.peak / hard.rms,
        softCrest: soft.peak / soft.rms,
        label: PACKS.realkit && PACKS.realkit.label,
      };
    });

    results.push({
      name: 'the CC0 Real Kit pack downloads, decodes and covers all nine pads',
      pass: pack.voices === 9 && pack.label === 'Real Kit',
      detail: `${pack.voices}/9 voices decoded from packs/realkit/pack.json`,
    });
    results.push({
      name: 'velocity layers: soft hits play a different take, not a quieter one',
      pass: pack.withSoft === 6 && Math.abs(pack.softCrest - pack.hardCrest) / pack.hardCrest > 0.1,
      detail: `${pack.withSoft} voices carry a soft take; snare crest factor ` +
              `${pack.hardCrest.toFixed(1)} hard vs ${pack.softCrest.toFixed(1)} soft ` +
              `(a scaled copy would be identical)`,
    });
    results.push({
      name: 'round-robin: a repeated snap alternates takes',
      pass: pack.rr.length >= 1 && pack.rrDiff > 0.05,
      detail: `${pack.rr.join(',')} has multiple variants; consecutive hits differ by ` +
              `${(pack.rrDiff * 100).toFixed(0)}%`,
    });

    const chipsNow = await page.locator('#packStrip .chip').count();
    results.push({
      name: 'the downloaded pack joins the strip alongside the built-ins',
      pass: chipsNow >= 8,
      detail: `${chipsNow} packs in the strip`,
    });
  }

  /* ── offline: the pack survives losing the network ──────────── */
  {
    const p3 = await browser.newPage();
    p3.on('pageerror', e => errors.push('offline: ' + e));
    await p3.goto(`http://localhost:${PORT}/index.html`);
    await p3.waitForFunction(() => typeof seq !== "undefined" && !!seq);
    // First visit warms the service worker's pack cache.
    await p3.waitForFunction(
      () => !!(typeof PACKS !== 'undefined' && PACKS.realkit && PACKS.realkit.loaded),
      null, { timeout: 20000 }
    ).catch(() => {});
    await p3.waitForTimeout(600);

    const cached = await p3.evaluate(async () => {
      const names = await caches.keys();
      const packCache = names.find(n => n.startsWith('beat-pad-packs'));
      if (!packCache) return { names, entries: 0 };
      const c = await caches.open(packCache);
      return { names, entries: (await c.keys()).length };
    });

    await p3.context().setOffline(true);
    await p3.reload();
    const offline = await p3.waitForFunction(
      () => typeof seq !== "undefined" && !!seq, null, { timeout: 15000 }
    ).then(() => true).catch(() => false);
    const offlinePads = offline ? await p3.locator('#padGrid .pad').count() : 0;
    const offlinePack = offline ? await p3.evaluate(async () => {
      await new Promise(r => setTimeout(r, 1500));
      return !!(PACKS.realkit && PACKS.realkit.loaded);
    }) : false;
    await p3.context().setOffline(false);

    results.push({
      name: 'the service worker caches pack audio in its own cache',
      pass: cached.entries >= 17,
      detail: `${cached.entries} entries in ${cached.names.filter(n => n.includes('packs')).join(',') || 'no pack cache'}`,
    });
    results.push({
      name: 'app boots and the sample pack still loads with the network cut',
      pass: offline && offlinePads === 6 && offlinePack,
      detail: offline ? `${offlinePads} pads, realkit ${offlinePack ? 'loaded' : 'MISSING'} offline`
                      : 'app failed to boot offline',
    });
  }

  /* ── v2 → v3 migration, in a fresh page ─────────────────────── */
  {
    const p2 = await browser.newPage();
    p2.on('pageerror', e => errors.push('migration: ' + e));
    await p2.goto(`http://localhost:${PORT}/index.html`);
    await p2.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('beat-pad.v2', JSON.stringify({
        pattern: {
          kick:  [true, false, false, false, true, false, false, false],
          snare: [false, false, true, false, false, false, true, false],
        },
        speed: 2, kit: 'band', padCount: 9, showMaker: true, volume: 0.5,
      }));
    });
    await p2.reload();
    await p2.waitForFunction(() => typeof seq !== "undefined" && !!seq);
    await p2.waitForTimeout(500);   // saves are debounced by 300ms

    const migrated = await p2.evaluate(() => ({
      kick: seq.pattern.kick,
      snare: seq.pattern.snare,
      pack: state.packId,
      mode: state.mode,
      speed: state.speed,
      volume: state.volume,
      legacyGone: localStorage.getItem('beat-pad.v2') === null,
      v3: !!localStorage.getItem('beat-pad.v3'),
    }));

    const kickOk = migrated.kick[0] === 1 && migrated.kick[8] === 1 &&
                   migrated.kick.filter(v => v > 0).length === 2;
    const snareOk = migrated.snare[4] === 1 && migrated.snare[12] === 1 &&
                    migrated.snare.filter(v => v > 0).length === 2;

    results.push({
      name: 'a v2 beat replays identically on the sixteenth grid',
      pass: kickOk && snareOk,
      detail: `kick on steps ${migrated.kick.map((v,i)=>v?i:null).filter(v=>v!==null)}, ` +
              `snare on ${migrated.snare.map((v,i)=>v?i:null).filter(v=>v!==null)}`,
    });
    results.push({
      name: 'v2 settings carry over and the old key is retired',
      pass: migrated.pack === 'band' && migrated.mode === 'studio' &&
            migrated.speed === 2 && migrated.volume === 0.5 &&
            migrated.legacyGone && migrated.v3,
      detail: `pack=${migrated.pack} mode=${migrated.mode} speed=${migrated.speed} vol=${migrated.volume}`,
    });
  }

  results.push({
    name: 'no console or page errors anywhere',
    pass: errors.length === 0,
    detail: errors.length ? errors.slice(0, 3).join(' | ') : 'clean',
  });

  await browser.close();
  server.close();

  /* ── report ─────────────────────────────────────────────────── */
  let failed = 0;
  console.log('');
  for (const r of results) {
    if (!r.pass) failed++;
    console.log(`${r.pass ? green('  PASS') : red('  FAIL')}  ${r.name}`);
    if (r.detail) console.log(`        ${dim(r.detail)}`);
  }
  console.log('');
  console.log(failed ? red(`${failed} of ${results.length} checks failed`)
                     : green(`all ${results.length} checks passed`));
  process.exit(failed ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
