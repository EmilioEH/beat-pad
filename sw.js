// Bump CACHE on every release, or installed users keep the old shell forever.
const CACHE = 'beat-pad-v3';

// Downloaded sample packs live in their own cache that release bumps do NOT
// evict. Re-downloading a pack the user already has would be rude, and on a
// phone in a car it would just fail.
const PACK_CACHE = 'beat-pad-packs-v1';

// Relative so the app also works from a sub-path (e.g. GitHub Pages projects).
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/packs.js',
  './js/audio-engine.js',
  './js/sequencer.js',
  './js/recorder.js',
  './js/sampler.js',
  './js/pack-loader.js',
  './js/app.js',
  './manifest.json',
  './icons/icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE && k !== PACK_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/** Store a successful pack response and pass it through untouched. */
function cachePack(request, res) {
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(PACK_CACHE).then(c => c.put(request, copy)).catch(() => {});
  }
  return res;
}

/** Offline with nothing cached: "no packs published" rather than an error. */
function emptyIndex() {
  return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // Sample packs: cache-first, but write through on the first fetch so a pack
  // downloaded once is playable offline from then on. The precache list can't
  // do this job — pack contents aren't known at install time.
  if (e.request.url.includes('/packs/')) {
    // The index is the one thing that must not go stale, or a pack published
    // after the first visit would never be discovered. Network first, cache
    // as the offline fallback.
    const isIndex = e.request.url.endsWith('/packs/index.json');
    e.respondWith(
      isIndex
        ? fetch(e.request)
            .then(res => cachePack(e.request, res))
            .catch(() => caches.match(e.request).then(hit => hit || emptyIndex()))
        : caches.match(e.request).then(hit =>
            hit || fetch(e.request).then(res => cachePack(e.request, res))
          )
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request))
  );
});
