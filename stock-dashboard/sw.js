import { isPwaCacheableNavigationResponse, isPwaStaticAsset, shouldBypassPwaCache } from "./pwa-cache-policy.mjs";
import { APP_SHELL } from "./pwa-app-shell.mjs";

// A new cache adds every app dependency, including new static ESM modules.
const CACHE_NAME = "nasdaq-intelligence-shell-v3";

async function cacheShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL);
}

self.addEventListener("install", function (event) {
  event.waitUntil(cacheShell().then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key !== CACHE_NAME; }).map(function (key) {
      return caches.delete(key);
    }));
  }).then(function () {
    return self.clients.claim();
  }));
});

self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || shouldBypassPwaCache(url.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(function (response) {
      if (isPwaCacheableNavigationResponse(response)) {
        const copy = response.clone();
        void caches.open(CACHE_NAME).then(function (cache) { return cache.put("./index.html", copy); });
      }
      return response;
    }).catch(function () {
      return caches.match("./index.html");
    }));
    return;
  }

  if (!isPwaStaticAsset({ destination: request.destination, pathname: url.pathname })) return;
  event.respondWith(caches.match(request).then(function (cached) {
    if (cached) return cached;
    return fetch(request).then(function (response) {
      if (!response || !response.ok) return response;
      const copy = response.clone();
      void caches.open(CACHE_NAME).then(function (cache) { return cache.put(request, copy); });
      return response;
    });
  }));
});
