/* অ্যাডমিন অ্যাপের শেল ক্যাশ (API কখনো ক্যাশ হয় না)। সংস্করণ বদলালে পুরনো ক্যাশ মুছে যায়। */
const V='studio-v1',SHELL=['./','index.html','app.css','app.js','manifest.webmanifest','icons/admin-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
 e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));return res}).catch(()=>caches.match(r).then(m=>m||caches.match('index.html'))))});
