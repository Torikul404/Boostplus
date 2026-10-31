/* boostplus admin — পুরোনো service worker অবসর (v5)
   এই ফাইল শুধু আগে ইনস্টল হওয়া অ্যাডমিন অ্যাপের ক্যাশ মুছে নিজেকে সরিয়ে ফেলে।
   অ্যাডমিন এখন /admin.html এ; কিছুই ক্যাশ হয় না। */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll({ type: "window" }); })
      .then(function (list) { list.forEach(function (c) { try { c.navigate("/admin.html"); } catch (err) {} }); })
  );
});
