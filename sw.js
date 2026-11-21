// Service worker for the Workout app (GitHub Pages).
// - App page: network first, so new versions show up as soon as you're online;
//   falls back to the cached copy when offline.
// - Google Fonts: cache first (they never change for a given URL).
// - Everything else (e.g. Firebase sign-in and Firestore sync later) is NOT
//   touched, so cloud calls always go straight to the network.
//
// When you change sw.js itself, bump CACHE_VERSION.

const CACHE_VERSION = 'workout-v1';
const APP_SHELL = ['./', './index.html'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: cache first
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
        }
        return res;
      }))
    );
    return;
  }

  // Same-origin only from here on; leave Firebase and other hosts alone
  if (url.origin !== self.location.origin) return;

  // Network first, cache fallback
  event.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() =>
      caches.match(req, { ignoreSearch: true }).then(hit =>
        hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)
      ).then(hit => hit || new Response('Offline', { status: 503, statusText: 'Offline' }))
    )
  );
});
