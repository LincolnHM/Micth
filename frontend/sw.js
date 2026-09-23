// ─── MICHT Decants · Service Worker ────────────────────────────────────────
// Objetivo: permitir "Agregar a pantalla de inicio" en el celular y dar una
// experiencia mínima offline. Estrategia: red primero, caché como respaldo.
// Así el catálogo/precios siempre se ven actualizados cuando hay conexión
// (igual que hoy con los headers no-cache del sitio) y solo se usa lo
// guardado en caché si el usuario se queda sin señal.

const CACHE_NAME = 'micht-cache-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // no tocar Supabase, fuentes, WhatsApp, etc.
  if (url.pathname.startsWith('/admin')) return;      // el panel admin siempre va directo a la red

  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
