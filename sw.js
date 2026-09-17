const CACHE_NAME = "hotel-radar-v2";
const ASSETS = [
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/data.js",
  "./js/member.js",
  "./js/calendar.js",
  "./js/notifier.js",
  "./js/animations.js",
  "./js/libs/gsap.min.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
