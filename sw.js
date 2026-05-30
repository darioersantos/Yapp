// YAPP Service Worker v3 — Offline completo
var CACHE = 'yapp-v3';

// Ficheiros a colocar em cache na instalação
var PRECACHE = [
  './',
  './index.html',
  './manifest.json'
];

// ── INSTALL: pré-cache dos assets principais ──────────────
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(PRECACHE);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE: limpar caches antigos ──────────────────────
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── FETCH: estratégia por tipo de recurso ────────────────
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // API calls (Google Apps Script) — nunca fazer cache, sempre rede
  if (url.indexOf('script.google.com') !== -1 ||
      url.indexOf('open-meteo.com') !== -1 ||
      url.indexOf('googleapis.com') !== -1) {
    e.respondWith(
      fetch(e.request).catch(function() {
        // offline — retorna resposta vazia em JSON para não bloquear
        return new Response('{"status":"offline"}', {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Imagens externas (lh3, unsplash, etc) — cache first, fallback rede
  if (url.indexOf('lh3.googleusercontent') !== -1 ||
      url.indexOf('unsplash.com') !== -1 ||
      url.indexOf('imgur.com') !== -1) {
    e.respondWith(
      caches.open(CACHE + '-imgs').then(function(cache) {
        return cache.match(e.request).then(function(cached) {
          if (cached) return cached;
          return fetch(e.request).then(function(resp) {
            if (resp && resp.status === 200) {
              cache.put(e.request, resp.clone());
            }
            return resp;
          }).catch(function() {
            // offline sem cache — retorna imagem transparente
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          });
        });
      })
    );
    return;
  }

  // App principal (HTML, CSS, JS, fonts) — cache first, atualiza em background
  e.respondWith(
    caches.open(CACHE).then(function(cache) {
      return cache.match(e.request).then(function(cached) {
        var fetchPromise = fetch(e.request).then(function(resp) {
          if (resp && resp.status === 200 && e.request.method === 'GET') {
            cache.put(e.request, resp.clone());
          }
          return resp;
        }).catch(function() { return null; });

        // Retorna cache imediatamente se existir; senão espera pela rede
        return cached || fetchPromise.then(function(resp) {
          return resp || new Response('App em modo offline. Requer ligação para primeira abertura.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        });
      });
    })
  );
});

// ── SKIP WAITING (update imediato) ────────────────────────
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
