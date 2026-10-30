
const CACHE_VERSION = "admin-v4";
const CACHE = "boostplus-admin-" + CACHE_VERSION;
const ASSETS = ["./index.html", "./manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting())
  );
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.hostname.indexOf("script.google.com") >= 0) return;
  if (url.pathname.indexOf("/admin") >= 0 && (url.pathname.endsWith(".html") || url.pathname.endsWith("/admin/") || url.pathname.endsWith("/admin"))) {
    e.respondWith(
      fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match("./index.html"))
    );
    return;
  }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
