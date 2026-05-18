// YAPP Service Worker — Modo Offline Completo
const CACHE = 'yapp-v1';
const ASSETS = [
  './',
  './index.html',
  './casa-do-geres-yapp.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&family=Playfair+Display:ital,wght@0,600;1,400&family=Nunito:wght@300;400;500&display=swap'
];

// Install — cache all assets
self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(ASSETS.map(function(u) {
        return new Request(u, { mode: 'no-cors' });
      }));
    })
  );
});

// Activate — clean old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

// Fetch — cache first for assets, network first for API
self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  // API calls — network first, no cache
  if (url.includes('script.google.com') || url.includes('open-meteo')) {
    e.respondWith(
      fetch(e.request).catch(function() {
        return new Response(JSON.stringify({ status: 'offline' }), { headers: { 'Content-Type': 'application/json' } });
      })
    );
    return;
  }
  // Everything else — cache first
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(response) {
        if (!response || response.status !== 200) return response;
        var clone = response.clone();
        caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
        return response;
      }).catch(function() { return cached; });
    })
  );
});

// Push notifications
self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data.json(); } catch(err) { data = { title: 'YAPP', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(
    self.registration.showNotification(data.title || 'YAPP', {
      body: data.body || '',
      icon: data.icon || './favicon.svg',
      badge: './favicon.svg',
      data: data.url ? { url: data.url } : {},
      actions: data.action ? [{ action: 'open', title: data.action }] : []
    })
  );
});

// Notification click — open app
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) ? e.notification.data.url : './';
  e.waitUntil(clients.openWindow(url));
});
