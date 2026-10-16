// OTTpaper service worker: offline app shell. Same-origin static files only.
// It NEVER touches cross-origin requests, so TMDB API calls (and the API key) never pass through or get cached here.
const CACHE = 'ottpaper-v1';   // bump to force old caches to be dropped
const SHELL = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/tmdb.js', 'js/store.js', 'js/i18n.js', 'js/icons.js', 'js/advisor.js',
  'manifest.webmanifest', 'icons/icon.svg',
  'fonts/playfair-display-latin-700-normal.woff2', 'fonts/playfair-display-latin-900-normal.woff2', 'fonts/playfair-display-latin-400-italic.woff2',
  'fonts/source-serif-4-latin-400-normal.woff2', 'fonts/source-serif-4-latin-700-normal.woff2', 'fonts/source-serif-4-latin-400-italic.woff2'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first (always fresh when online), cache as offline fallback.
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
});
