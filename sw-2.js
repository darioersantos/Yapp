// YAPP Service Worker — Modo Offline
const CACHE = 'yapp-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './apple-touch-icon.png',
  './favicon.svg',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&family=Playfair+Display:ital,wght@0,600;1,400&family=Nunito:wght@300;400;500&display=swap'
];

// Install — cache assets
self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return Promise.allSettled(
        ASSETS.map(function(u) {
          return cache.add(new Request(u, { mode: 'no-cors' })).catch(function(){});
        })
      );
    })
  );
});

// Activate — remove old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// Fetch strategy
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // API & external services — network only, fallback to offline response
  if (url.includes('script.google.com') ||
      url.includes('open-meteo') ||
      url.includes('api.mymemory') ||
      url.includes('api.qrserver.com') ||
      url.includes('translate.googleapis.com')) {
    e.respondWith(
      fetch(e.request).catch(function() {
        return new Response(
          JSON.stringify({ status: 'offline' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // App shell & assets — cache first, update in background
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      var networkFetch = fetch(e.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
        }
        return response;
      }).catch(function() { return cached; });

      // Return cache immediately if available, update in background
      return cached || networkFetch;
    })
  );
});

// Push notifications
self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data.json(); } catch(err) {
    data = { title: 'YAPP', body: e.data ? e.data.text() : '' };
  }
  e.waitUntil(
    self.registration.showNotification(data.title || 'YAPP', {
      body: data.body || '',
      icon: './apple-touch-icon.png',
      badge: './apple-touch-icon.png',
      data: data.url ? { url: data.url } : {}
    })
  );
});

// Notification click
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) ? e.notification.data.url : './';
  e.waitUntil(clients.openWindow(url));
});
