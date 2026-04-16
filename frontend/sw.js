// FuelGO Service Worker — v2.5
// Strategies: HTML → network-first | CSS/JS/assets → cache-first | API/external → network-only
const CACHE_VERSION = 'fuelgo-v7';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Only cache static assets — never HTML (HTML changes break CSP headers + content)
const STATIC_ASSETS = [
  '/css/global.css',
  '/css/components.css',
  '/css/layout.css',
  '/css/skeleton.css',
  '/js/api.js',
  '/js/auth.js',
  '/js/loader.js',
  '/js/notifications.js',
  '/js/modal.js',
  '/assets/logo.svg',
  '/manifest.json',
  '/offline.html',
];

// ── Install: pre-cache static assets ───────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(c => c.addAll(STATIC_ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .catch(() => {})
  );
  self.skipWaiting();
});

// ── Activate: wipe ALL old caches, then reload every open tab ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => Promise.all(
        clients.map(client => client.navigate(client.url))
      ))
  );
});

// ── Fetch: routing strategy ─────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // 1. API calls: network-only
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. External resources (CDNs, Google, etc.): network-only
  if (url.hostname !== location.hostname) {
    return;
  }

  // 3. HTML pages: network-first, offline fallback only (never serve stale HTML)
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    e.respondWith(
      fetch(e.request).catch(() =>
        caches.match('/offline.html')
      )
    );
    return;
  }

  // 4. Static assets (CSS, JS, fonts, images): cache-first, background refresh
  if (
    url.pathname.endsWith('.css')  ||
    url.pathname.endsWith('.js')   ||
    url.pathname.endsWith('.svg')  ||
    url.pathname.endsWith('.png')  ||
    url.pathname.endsWith('.jpg')  ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.ico')  ||
    url.pathname.includes('/assets/')
  ) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        // Background refresh
        const networkFetch = fetch(e.request).then(res => {
          if (res && res.ok) {
            const clone = res.clone(); // clone BEFORE any async op
            caches.open(STATIC_CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => null);

        return cached || networkFetch;
      })
    );
    return;
  }

  // 5. Everything else: stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(DYNAMIC_CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});

// ── Message handler ─────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
