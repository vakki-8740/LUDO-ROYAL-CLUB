const CACHE = 'ludo-royal-club-v2'; // logo update — naya cache naam purane clients ko refresh karega
const URLS = ['index.html', 'app.js', 'pages-content.js', 'style.css', 'firebase-config.js', 'manifest.json', 'PROJECT-KOGO/ludo-royal-club-logo.png', 'icons/icon.svg', 'icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // FIX: network-first strategy. The old cache-first approach kept serving OLD cached
  // JS/HTML even after an update, so new changes (KYC popup, demo bets) never appeared.
  // Now it always tries the network first and only falls back to cache when offline.
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
