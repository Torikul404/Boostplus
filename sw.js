/* boostplus — root service worker (v20261119)  — R24: নতুন ভিজিটরের পেজ আর দ্বিতীয়বার রিলোড হয় না (রিলোড শুধু পুরনো ক্যাশ মোছার সময়)
   আগের sw.js কাস্টমার পেজ (index.html) ক্যাশ করে আটকে রাখত, তাই পুরনো লে-আউট দেখাত।
   এই ভার্সন কিছুই ক্যাশ করে না: সব সময় নেটওয়ার্ক থেকে নতুন ফাইল আনে,
   এবং আগের সব ক্যাশ মুছে খোলা ট্যাবগুলো একবার রিলোড করে দেয়। */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { var had = keys.length > 0; return Promise.all(keys.map(function (k) { return caches.delete(k); })).then(function () { return had; }); })
      .then(function (had) { return self.clients.claim().then(function () { return had; }); })
      .then(function (had) { return had ? self.clients.matchAll({ type: "window" }) : []; })
      .then(function (list) { list.forEach(function (c) { try { c.navigate(c.url); } catch (err) {} }); })
  );
});
/* fetch হ্যান্ডলার নেই → সব রিকোয়েস্ট সরাসরি নেটওয়ার্কে যায় */
