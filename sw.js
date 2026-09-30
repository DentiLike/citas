// Service Worker — la página abre siempre, incluso sin datos ni Wi-Fi
const CACHE_NAME = "citas-v32";
const SHELL = "./index.html";
const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
const OPCIONALES = [
  SDK + "firebase-app-compat.js",
  SDK + "firebase-firestore-compat.js",
  SDK + "firebase-auth-compat.js",
  SDK + "firebase-functions-compat.js"
];

// Pantalla de respaldo: si no hay nada guardado y no hay red, el paciente ve esto (no el error del navegador)
const OFFLINE_HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Dentilike — Sin conexión</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#f2f7fb;color:#12345a;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}
.c{max-width:420px;width:100%;background:#fff;border-radius:24px;padding:28px 22px;box-shadow:0 8px 30px rgba(18,52,90,.12);text-align:center}
h1{font-size:1.35rem;margin:0 0 10px}p{line-height:1.5;margin:0 0 16px;color:#4a5b6e}
a{display:block;padding:14px;border-radius:14px;font-weight:800;text-decoration:none;margin-top:10px;border:2px solid #d7e3ee;color:#12345a}
a.wa{background:#25D366;border-color:#25D366;color:#fff}</style></head><body><div class="c">
<h1>Sin conexión por ahora</h1>
<p>No pudimos cargar la agenda en línea. Puedes pedir tu cita por WhatsApp o llamarnos y con gusto te atendemos.</p>
<a class="wa" href="https://wa.me/524446036659?text=Hola%2C%20quiero%20agendar%20una%20cita%20en%20Dentilike.">Escríbenos por WhatsApp</a>
<a href="tel:+524446036659">Llamar al 444 603 6659</a>
<a href="./" onclick="location.reload();return false">Reintentar</a>
</div></body></html>`;

const conTiempo = (p, ms) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil((async () => {
    const c = await caches.open(CACHE_NAME);
    // La página es obligatoria: si no se pudo guardar, el service worker no se activa
    // y vuelve a intentarlo en la siguiente visita (antes se activaba con la caché vacía).
    const r = await fetch(SHELL, { cache: "reload" });
    if (!r.ok) throw new Error("shell");
    await c.put(SHELL, r);
    await Promise.all(OPCIONALES.map((u) => c.add(u).catch(() => {})));
  })());
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
  if (!propio && !externoOk) return; // Firestore, login y funciones van directo a la red

  // La página: sale al instante desde el teléfono; se actualiza en segundo plano
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cached = await caches.match(SHELL);
      const actualizar = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copia = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(SHELL, copia));
        }
        return res;
      });
      if (cached) {
        e.waitUntil(actualizar.catch(() => {}));
        return cached;
      }
      try {
        return await conTiempo(actualizar, 8000);
      } catch (_) {
        return new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
    })());
    return;
  }

  // Lo demás (fuentes, Firebase SDK, imágenes): primero el teléfono, la red de respaldo
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
