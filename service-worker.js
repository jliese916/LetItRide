"use strict";
const CACHE = "casa-let-it-ride-v7";
const ASSETS = [
  "./", "./index.html", "./styles.css", "./strategy-engine.js", "./app.js",
  "./manifest.webmanifest", "./jefe-crest.svg", "./favicon-64.png",
  "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png"
];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match("./index.html"))));
});
