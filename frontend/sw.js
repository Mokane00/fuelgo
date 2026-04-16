// FuelGO Service Worker — v2.3
// Strategies: static → cache-first | dynamic → stale-while-revalidate | API → network-only
const CACHE_VERSION = 'fuelgo-v5';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

const STATIC_ASSETS = [
  '/index.html',
  '/dashboard.html',
  '/stations.html',
  '/history.html',
  '/loyalty.html',
  '/pump.html',
  '/vehicles.html',
  '/profile.html',
  '/analytics.html',
  '/register.html',
  '/receipt.html',
  '/admin-dashboard.html',
  '/employee-dashboard.html',
  '/offline.html',
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
];

// ── Install: pre-cache static assets ───────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(c => c.addAll(STATIC_ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .catch(() => {}) // Non-fatal: some resources may not exist yet
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ──────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('fuelgo-') && k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: routing strategy ─────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // 1. API calls (backend): network-only, no caching
  if (url.pathname.startsWith('/api/')) {
    return; // Let browser handle — no respondWith
  }

  // 2. External resources (Google Maps, CDNs, Cloudinary): network-only
  if (url.hostname !== location.hostname) {
    return;
  }

  // 3. Navigate requests (HTML pages): network-first with offline fallback
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() =>
        caches.match(e.request).then(cached => cached || caches.match('/offline.html'))
      )
    );
    return;
  }

  // 4. Static assets (CSS, JS, fonts, images): cache-first, then network
  if (
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js')  ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.webp')||
    url.pathname.endsWith('.ico') ||
    url.pathname.includes('/assets/')
  ) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) {
          // Serve cached, refresh in background
          fetch(e.request).then(res => {
            if (res && res.ok) caches.open(STATIC_CACHE).then(c => c.put(e.request, res));
          }).catch(() => {});
          return cached;
        }
        return fetch(e.request).then(res => {
          if (res && res.ok) caches.open(STATIC_CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // 5. Everything else: stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(res => {
        if (res && res.ok) caches.open(DYNAMIC_CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});

// ── Message handler (for cache busting from app) ───
self.addEventListener('message', e => {
  if (e.data?.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
