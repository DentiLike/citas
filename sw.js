// Service Worker — ARRANQUE INSTANTÁNEO (para datos móviles lentos)
// App: citas
const CACHE_NAME = "citas-v27";
const ASSETS = ["./", "./index.html"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) =>
      Promise.all(ASSETS.map((u) => c.add(u).catch(() => {})))
    )
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (e.request.url.includes("firestore") ||
      e.request.url.includes("firebase") ||
      e.request.url.includes("googleapis") ||
      e.request.url.includes("gstatic")) {
    return;
  }
  if (e.request.mode === "navigate") {
    e.respondWith(
      caches.match("./index.html").then((cached) => {
        const red = fetch(e.request).then((res) => {
          if (res && res.status === 200) {
            const copia = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put("./index.html", copia));
          }
          return res;
        }).catch(() => cached);
        return cached || red;
      })
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const red = fetch(e.request).then((res) => {
        if (res && res.status === 200) {
          const copia = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, copia));
        }
        return res;
      }).catch(() => cached);
      return cached || red;
    })
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
