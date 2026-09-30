// Service Worker — la página abre al instante, incluso con poca señal o sin red
const CACHE_NAME = "citas-v31";
const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
const ASSETS = [
  "./", "./index.html",
  SDK + "firebase-app-compat.js",
  SDK + "firebase-firestore-compat.js",
  SDK + "firebase-auth-compat.js",
  SDK + "firebase-functions-compat.js"
];

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
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const propio = url.origin === self.location.origin;
  const externoOk =
    (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) ||
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com";
  // Firestore, login y funciones van siempre directo a la red
  if (!propio && !externoOk) return;

  // La página: sale al instante desde el celular y se actualiza en segundo plano
  if (req.mode === "navigate") {
    e.respondWith(
      caches.match("./index.html").then((cached) => {
        const red = fetch(req).then((res) => {
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

  // Lo demás (fuentes, Firebase SDK, imágenes): primero el celular, la red de respaldo
  e.respondWith(
    caches.match(req).then((cached) => {
      const red = fetch(req).then((res) => {
        if (res && (res.ok || res.type === "opaque")) {
          const copia = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copia));
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
