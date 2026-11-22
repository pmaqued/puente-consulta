// Service worker de Puente Consulta: guarda los archivos de la página para que funcione sin conexión
// (la traducción ya funciona sin conexión una vez descargados los idiomas).
// Estrategia "primero la red": con conexión siempre se carga la versión nueva (se pregunta al servidor
// saltándose la caché del navegador, que si no podía servir archivos viejos); sin conexión, la guardada.
// No guarda nada de la conversación: solo los archivos de la propia página.

const CACHE = "puente-consulta-v3";
const ARCHIVOS = [
  "./", "./index.html", "./estilos.css", "./app.js", "./idiomas.js", "./traductor.js", "./voz.js",
  "./detector.js", "./voces-puente.js", "./icono.png", "./icono-512.png", "./manifest.webmanifest",
  "./vendor/piper/piper-tts-web.js", "./vendor/piper/piper-o91UDS6e.js", "./vendor/piper/voices_static-D_OtJDHM.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Motor de las «Voces de Puente» (versiones fijas en jsDelivr): no cambian, así que primero la copia guardada.
// Las voces en sí las guarda la propia librería en el navegador (OPFS).
const CDN = ["https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/", "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/"];

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (CDN.some((base) => e.request.url.startsWith(base))) {
    e.respondWith(
      caches.match(e.request).then((guardada) => guardada || fetch(e.request).then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return respuesta;
      })),
    );
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request.url, { cache: "no-cache", credentials: "same-origin" })
      .then((respuesta) => {
        const copia = respuesta.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
        return respuesta;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
