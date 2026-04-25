const CACHE_NAME = "mobile-apps-suite-v9";
const ASSETS = [
  "./",
  "./index.html",
  "./home.css",
  "./dojo-timer/",
  "./dojo-timer/index.html",
  "./dojo-timer/styles.css",
  "./dojo-timer/app.js",
  "./dojo-timer/manifest.webmanifest",
  "./dojo-timer/icon.svg",
  "./dojo-timer/assets/boxing-bell.wav",
  "./dojo-timer/assets/shudan-logo.jpg",
  "./dojo-timer/assets/icon-192.png",
  "./dojo-timer/assets/icon-512.png",
  "./poids-ideal/",
  "./poids-ideal/index.html",
  "./poids-ideal/styles.css",
  "./poids-ideal/app.js",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
