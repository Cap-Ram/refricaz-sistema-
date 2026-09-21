const CACHE_NAME = "refricaz-static-v21";
const STATIC_ASSETS = [
    "index.html",
    "admin.html",
    "style.css?v=16",
    "script.js?v=12",
    "firebase-client.js?v=5",
    "manifest.json",
    "img/favicon.png",
    "img/logo-azul.png",
    "img/logo-blanco.png",
    "img/hero-bg.jpg",
    "img/tecnico.jpg",
    "img/ingenieros.jpg",
    "img/lavadora.jpg",
    "img/lavadora.png",
    "img/refrigerador.png",
    "img/secadora.png",
    "img/microondas.png",
    "img/centro-lavado.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).catch(() => {
                if (event.request.mode === "navigate") {
                    return caches.match("index.html");
                }
                throw new Error("Network unavailable");
            });
        })
    );
});
