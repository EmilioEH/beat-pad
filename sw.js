// Bump CACHE on every release, or installed users keep the old shell forever.
const CACHE = 'beat-pad-v2';

// Relative so the app also works from a sub-path (e.g. GitHub Pages projects).
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/audio-engine.js',
  './js/sequencer.js',
  './js/recorder.js',
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
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request))
  );
});
