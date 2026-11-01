/* boostplus স্টুডিও — অ্যাপ-শেল ক্যাশ (API কখনো ক্যাশ হয় না)। সংস্করণ বদলালে পুরনো ক্যাশ মুছে যায়। */
const V='studio-v19',SHELL=['./','index.html','app.css','app.js','manifest.webmanifest','icons/admin-192.png','icons/admin-512.png','fonts/InterVariable.woff2','fonts/hind-siliguri-v14-bengali_latin-regular.woff2','fonts/hind-siliguri-v14-bengali_latin-600.woff2'];
/* রিডাইরেক্ট-করা রেসপন্স নেভিগেশনে দেখানো যায় না (Cloudflare index.html → ./ রিডাইরেক্ট করে) — তাই পরিষ্কার কপি রাখা হয় */
async function clean(res){if(!res.redirected)return res;const b=await res.blob();return new Response(b,{status:res.status,statusText:res.statusText,headers:res.headers})}
self.addEventListener('install',e=>{e.waitUntil((async()=>{const c=await caches.open(V);
  await Promise.all(SHELL.map(async u=>{try{const r=await fetch(new Request(u,{cache:'reload'}));if(r.ok)await c.put(u,await clean(r))}catch(x){}}));
  await self.skipWaiting()})())});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin)return;
  if(r.mode==='navigate'){
    e.respondWith(fetch(r).then(async res=>{if(res.ok){try{const cp=await clean(res.clone());caches.open(V).then(c=>c.put('./',cp))}catch(x){}}return res})
      .catch(async()=>(await caches.match('./',{ignoreSearch:true}))||(await caches.match('index.html',{ignoreSearch:true}))||new Response('ইন্টারনেট নেই',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}})));return}
  e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp))}return res}).catch(async()=>(await caches.match(r,{ignoreSearch:true}))||Response.error()))});
