/* প্রভাইডারের নামে 𝗕𝗼𝗹𝗱 / ｆｕｌｌｗｉｄｔｈ ইউনিকোড অক্ষর থাকে — সাধারণ অক্ষরে এনে (NFKC) তারপর চেনা হয়, নইলে 'REFILL' চেনা যেত না */
const nk=s=>{s=String(s==null?'':s);try{return s.normalize('NFKC')}catch(e){return s}};
/* boostplus সার্ভিস স্টুডিও — প্রভাইডারের লাইভ সার্ভিস → CSV → প্রতি সার্ভিসে অন/অফ সুইচ */
(function(){
'use strict';
/* /studio (শেষে স্ল্যাশ ছাড়া) খুললে manifest/sw ভুল জায়গা থেকে আসে — স্ল্যাশসহ ঠিক ঠিকানায় নিয়ে যায় */
if(!/\/$/.test(location.pathname)&&!/\.[a-z0-9]+$/i.test(location.pathname)){location.replace(location.pathname+'/'+location.search+location.hash);return}
const API='https://script.google.com/macros/s/AKfycbx47uFKaYzBg0sFfOOY-382zadF8mSfQLYTDZPFqSSTHhOT5h4H-wnDzhJFZ16W3Ajy/exec';
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bn=n=>(+n||0).toLocaleString('bn-BD');
const ls={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}},del:k=>{try{localStorage.removeItem(k)}catch(e){}}};
let token=ls.get('pb_studio_token')||'',busy=false,st={q:'',state:'all',cat:'',off:0},cur=null,lastList=null,qt=null,SC=null,fabMoved=false;
const ERR={unauthorized:'টোকেন ঠিক নয়',locked_out:'অনেকবার ভুল হয়েছে — কিছুক্ষণ পরে চেষ্টা করুন',no_config:'এই প্রভাইডারের API সেট করা নেই',bad_json:'প্রভাইডার সঠিক উত্তর দেয়নি',provider_error:'প্রভাইডার ত্রুটি দিয়েছে',not_collected:'আগে "সংগ্রহ করুন" চাপুন',code_conflict:'এই আইডি সাইটে অন্য প্রভাইডারের সার্ভিস হিসেবে আছে',previously_removed:'এই সার্ভিস আগে সাইট থেকে বাদ দেওয়া হয়েছিল',category_required:'ক্যাটেগরি দিন',price_required:'দাম দিন',svc_failed:'সার্ভারে সমস্যা হয়েছে',unknown_action:'সার্ভারে নতুন কোড চালু হয়নি — Apps Script-এ PtServices.gs ও PtOrder.gs বসিয়ে Deploy → Manage deployments → Edit → New version দিন'};
const mem={};let rid=0;
function wipe(){for(const k in mem)delete mem[k];try{Object.keys(localStorage).filter(k=>k.indexOf('pbc_')===0).forEach(k=>localStorage.removeItem(k))}catch(e){}}
async function apiNet(action,x){
  let r,txt,d;if(!navigator.onLine){const e=new Error('ইন্টারনেট নেই');e.code='net';throw e}
  if(/^svc_(toggle|bulk|collect|site_edit|site_bulk|tidy_apply|auto)$/.test(action))wipe();
  const TO=/^svc_(csv|by_platform|platforms|snapshot)$/.test(action)?90000:/^svc_(providers|compare|changes|cat_suggest|list|site_list)$/.test(action)?20000:60000,ac=new AbortController(),tm=setTimeout(()=>ac.abort(),TO);
  try{r=await fetch(API,{method:'POST',mode:'cors',signal:ac.signal,headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({action,token},x||{}))});txt=await r.text();clearTimeout(tm)}
  catch(ex){clearTimeout(tm);const e=new Error(ex&&ex.name==='AbortError'?'সার্ভার সাড়া দিচ্ছে না ('+bn(TO/1000)+' সেকেন্ড) — আবার চেষ্টা করুন':'নেটওয়ার্ক/CORS ত্রুটি: '+(ex&&ex.message||ex));e.code='net';throw e}
  try{d=JSON.parse(txt)}
  catch(ex){const e=new Error('সার্ভার JSON দেয়নি (HTTP '+r.status+'): '+String(txt).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,140));e.code='not_json';throw e}
  if(!d||!d.ok){const e=new Error((d&&(d.message||ERR[d.error]||d.error))||'failed');e.code=d&&d.error;e.data=d;throw e}return d;
}

/* ---------- ফোন-ক্যাটালগ: সাইটের সব সার্ভিস ফোনে (IndexedDB) থাকে; তালিকা/খোঁজা/ফিল্টার তাৎক্ষণিক ---------- */
const CATK='site_v1',QK='queue_v1',EXK='exc_v1';let CAT=null,catSync=null,catTm=null,Q=[],qBusy=false,EXC={items:[]};
const idb={open(){return new Promise((res,rej)=>{const r=indexedDB.open('pb_studio',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})},
  async get(k){try{const db=await this.open();return await new Promise(res=>{const q=db.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null)})}catch(e){return null}},
  async set(k,v){try{const db=await this.open();await new Promise(res=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=()=>res();t.onerror=()=>res()})}catch(e){}}};
async function catLoad(){CAT=await idb.get(CATK);Q=(await idb.get(QK))||[];(await idb.get('rc_keys')||[]).forEach(k=>RK.add(k));EXC=(await idb.get(EXK))||{items:[]};qFlush();if(token&&(!CAT||Date.now()-CAT.at>30*60000))catSyncNow().catch(()=>{})}
function catSyncNow(prog){if(catSync)return catSync;
  catSync=(async()=>{const rows=[];let off=0,tot=1;
    let one=0;try{const d=await apiNet('svc_site_list',{q:'',platform:'',category:'',state:'all',offset:0,limit:5000,all:1});if(d.rows&&d.rows.length>=d.total&&d.total>0){rows.push.apply(rows,d.rows);one=1;if(prog)prog(d.total,d.total)}}catch(_){}
    while(!one&&off<tot){const d=await apiNet('svc_site_list',{q:'',platform:'',category:'',state:'all',offset:off,limit:100});tot=d.total;if(!d.rows.length)break;rows.push.apply(rows,d.rows);off+=d.rows.length;if(prog)prog(off,tot)}
    excDiff(CAT&&CAT.rows,rows);CAT={rows,at:Date.now()};await idb.set(CATK,CAT)})().finally(()=>{catSync=null});return catSync}
/* ---------- ব্যতিক্রম: আগের ক্যাটালগের সাথে মিলিয়ে নতুন / হারানো / দাম-বদল ---------- */
function excDiff(o,n){if(!o||!o.length)return;const om={},nm={},now=Date.now(),it=[];o.forEach(r=>{om[r.code]=r});n.forEach(r=>{nm[r.code]=r});
  n.forEach(r=>{const a=om[r.code];if(!a)it.push({t:'new',code:r.code,name:r.name,pl:r.platform_label,at:now});
    else if(a.cost>0&&r.cost>0&&Math.abs(r.cost-a.cost)/a.cost>=0.05)it.push({t:'price',code:r.code,name:r.name,pl:r.platform_label,a:a.cost,b:r.cost,sell:r.sell,at:now})});
  o.forEach(r=>{if(!nm[r.code]&&r.state==='on')it.push({t:'gone',code:r.code,name:r.name,pl:r.platform_label,at:now})});
  if(!it.length)return;const k={};EXC.items=it.concat(EXC.items).filter(x=>{const id=x.t+x.code;if(k[id])return false;k[id]=1;return true}).slice(0,300);idb.set(EXK,EXC)}
/* ---------- কোনো লেইট নয়: লেখার কাজ (চালু/বন্ধ, নাম/ক্যাটেগরি বদল, ব্যাচ) আগে ফোনে সাথে সাথে হয়, সার্ভারে যায় পেছনে — অনলাইন/অফলাইন একই ---------- */
function qAdd(a,x){const lb={};CAT.rows.forEach(r=>{lb[r.platform]=r.platform_label});
  if(a==='svc_toggle'){const c=String(x.code);if(x.on){let r=CAT.rows.find(y=>y.code===c);if(r)r.state='on';else{const pl=String(x.platform||'').toLowerCase().trim();CAT.rows.unshift({code:c,name:String(x.name||'').substring(0,120),category:String(x.category||'').substring(0,80),platform:pl,platform_label:lb[pl]||pl,state:'on',src:'custom',ov:0});catSoon()}}else catPatch('svc_site_hide',{codes:[c],on:false})}
  else catPatch(a,x);
  idb.set(CATK,CAT);Q.push({a,x});idb.set(QK,Q);mutTs=Date.now();
  if(navigator.onLine)setTimeout(qFlush,0);else toast('অফলাইন — ফোনে হয়েছে, নেট এলে সার্ভারে যাবে ('+bn(Q.length)+')');
  return{ok:true,done:(x.codes||[1]).length,queued:true}}
async function qFlush(){if(qBusy||!Q.length||!token||!navigator.onLine)return;qBusy=true;let did=false;
  try{while(Q.length){const it=Q[0];
    try{await apiNet(it.a,it.x)}catch(e){if(e.code==='net'||e.code==='not_json')break;if(authFail(e))break;toast('সার্ভার নেয়নি: '+e.message);catSoon()}
    Q.shift();did=true;await idb.set(QK,Q)}}
  finally{qBusy=false}
  if(did&&!Q.length)toast('সার্ভারে সেভ হয়েছে ✔')}
addEventListener('online',()=>qFlush());setInterval(qFlush,15000);
const SNAP_P=['smmxpanel.com','getmyfollow.com','smmsun.com','smmstarpro.com','smmgen.com','socialpanel.pro','smmrx.com','bdsmmpanel.com','amarboost.com','growfollows.com'];let snapBusy=0;
/* ডেটা আগে সাইটের স্ট্যাটিক ফাইল (data/ — GitHub Pages) থেকে; না পেলে ১টা API কলে (svc_snapshot) */
async function snapStatic(){const r=await fetch('data/index.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw 0;const ix=await r.json();if(!ix.providers)throw 0;
  await Promise.all(SNAP_P.map(async p=>{const m=ix.providers[p];if(!m)return;const c=await idb.get('csv_'+p);if(c&&c.sat===m.at)return;
    const f=await fetch('data/'+m.file+'?v='+encodeURIComponent(m.at),{cache:'no-store'});if(!f.ok)return;const csv=await f.text();
    await idb.set('csv_'+p,{csv,name:m.file,at:Date.now(),sat:m.at});delete PC[p]}))}
async function snapSync(force){if(snapBusy||!navigator.onLine)return;
  const last=await idb.get('snap_at');if(!force&&last&&Date.now()-last<600000)return;snapBusy=1;
  try{await snapStatic();await idb.set('snap_at',Date.now())}catch(_){
    if(ls.get('pb_studio_token'))try{const known={};for(const p of SNAP_P){const c=await idb.get('csv_'+p);if(c&&c.sat)known[p]=c.sat}
      const d=await apiNet('svc_snapshot',{known});
      for(const x of d.providers||[]){if(x.same||!x.csv)continue;await idb.set('csv_'+x.provider,{csv:x.csv,name:x.name,at:Date.now(),sat:x.at});delete PC[x.provider]}
      await idb.set('snap_at',Date.now())}catch(e){}}
  snapBusy=0}
addEventListener('online',()=>snapSync(true));setTimeout(snapSync,1200);setInterval(snapSync,600000);
/* পড়ার কাজ (তুলনা/প্ল্যাটফর্ম/পরিবর্তন/প্রভাইডার তালিকা): ৫ মিনিটের মধ্যে ও বদল না হলে ফোনের কপি তাৎক্ষণিক; অফলাইনে/সার্ভার না পেলে শেষ কপি */
let mutTs=0,RCm={},RK=new Set();const RD=/^svc_(providers|by_platform|compare|changes|cat_suggest)$/;
async function readCached(a,x){const k='rc_'+a+JSON.stringify(x||{});let c=RCm[k]||(RCm[k]=await idb.get(k));
  if(c&&(!navigator.onLine||(c.at>mutTs&&Date.now()-c.at<300000)))return c.d;
  try{const d=await apiNet(a,x);c={d,at:Date.now()};RCm[k]=c;idb.set(k,c);if(!RK.has(k)){RK.add(k);idb.set('rc_keys',Array.from(RK))}return d}
  catch(e){if(c&&(e.code==='net'||e.code==='not_json')){toast('পুরনো তথ্য দেখানো হচ্ছে');return c.d}throw e}}
/* ---------- প্রভাইডার ডেটা = ডাউনলোড করা CSV: ফোনে রাখা CSV থেকেই প্রভাইডার পাতা চলে (অনলাইনে-অফলাইনে একই, তাৎক্ষণিক); সাইটে চালু/বন্ধ আসে ফোনের সাইট-ক্যাটালগ থেকে ---------- */
let PC={},PB={};const PFRESH=30*60000;
function csvParse(t){const o=[];let r=[],f='',q=false;t=String(t||'').replace(/^\ufeff/,'');
  for(let i=0;i<t.length;i++){const c=t[i];
    if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
    else if(c==='"')q=true;else if(c===',' ){r.push(f);f=''}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;r.push(f);f='';if(r.length>1||r[0]!=='')o.push(r);r=[]}else f+=c}
  if(f!==''||r.length){r.push(f);o.push(r)}return o}
function csvToRows(t){const a=csvParse(t),h=a.shift()||[];return a.filter(r=>r.length>=3).map(r=>{const o={};h.forEach((k,i)=>{o[k]=r[i]});return o})}
async function provEnsure(p){if(p in PC)return;
  const c=await idb.get('csv_'+p),old=await idb.get('prov_'+p),ex=(old&&old.ex)||(await idb.get('ex_'+p))||{};
  if(c&&c.csv){const rows=csvToRows(c.csv);if(old&&old.rows){const m={};old.rows.forEach(r=>{m[r.service_id]=r});rows.forEach(r=>{const o=m[r.service_id];if(o){r.suggest=o.suggest;r.spd=o.spd;r.tidy=o.tidy}})}PC[p]={rows,at:c.at,ex}}
  else PC[p]=old||null}
let SVAT={};
/* প্রভাইডারের সব সার্ভিস (CSV) ফোনে নামায়; আগের কপির সাথে মিলিয়ে চালু সার্ভিসের বদল (বাদ/দাম↑) হিসাব করে */
function provSync(p,sv){if(PB[p])return PB[p];
  PB[p]=(async()=>{const d=await apiNet('svc_csv',{provider:p});const old=PC[p]&&PC[p].rows;
    await idb.set('csv_'+p,{csv:d.csv,name:d.name,at:Date.now(),sv:sv||SVAT[p]||''});
    let ex=(PC[p]&&PC[p].ex)||{};const rows=csvToRows(d.csv);rows.forEach(r=>{if(!r.provider)r.provider=p});PC[p]={rows,at:Date.now(),ex};
    const exP=apiNet('svc_list',{provider:p,q:'',state:'all',category:'',platform:'',offset:0,limit:1}).then(e=>{const x={categories:e.categories,site_categories:e.site_categories,fx:e.fx,tiers:e.tiers,platforms:e.platforms};idb.set('ex_'+p,x);if(PC[p])PC[p].ex=x}).catch(()=>{});
    await Promise.race([exP,new Promise(r=>setTimeout(r,4000))]);
    return diffProv(p,old,rows)})().finally(()=>{delete PB[p]});return PB[p]}
function diffProv(p,old,nw){if(!old||!old.length)return{p,first:1,rm:0,up:0,dn:0};
  const on={};if(CAT)CAT.rows.forEach(r=>{if(r.state==='on')on[r.code]=1});const m={};nw.forEach(r=>{m[r.service_id]=r});let rm=0,up=0,dn=0;
  old.forEach(o=>{if(!on[o.service_id])return;const n=m[o.service_id];if(!n)rm++;else{const a=+o.rate,b=+n.rate;if(b>a+1e-9)up++;else if(b<a-1e-9)dn++}});return{p,first:0,rm,up,dn}}
/* ---------- পেছনে অটো-সিঙ্ক: প্রভাইডারের সংগ্রহের সময় বদলালেই নতুন ডেটা ফোনে নামে + নোটিফিকেশন ---------- */
let bgBusy=0,bgAt=0;
async function bgSync(force){if(bgBusy||!token||!navigator.onLine)return;if(!force&&Date.now()-bgAt<600000)return;bgBusy=1;
  try{const d=await apiNet('svc_providers');bgAt=Date.now();const ch=[];
    for(const q of (d.providers||[])){if(!q.has_api||!q.count)continue;const p=q.provider;SVAT[p]=q.collected_at||'';
      const c=await idb.get('csv_'+p);if(c&&c.csv&&(c.sv===SVAT[p]||(c.sat&&!c.sv)))continue;
      await provEnsure(p);
      try{const r=await provSync(p,SVAT[p]);if(r&&!r.first)ch.push(r)}catch(e){if(authFail(e))return}}
    if(ch.length)chgNotify(ch)}
  catch(e){authFail(e)}
  finally{bgBusy=0}}
function chgNotify(L){const rm=L.reduce((a,x)=>a+x.rm,0),up=L.reduce((a,x)=>a+x.up,0),nm=L.map(x=>x.p).join(', ');
  const msg='প্রভাইডার আপডেট ('+nm+') — নতুন ডেটা ফোনে নামানো হয়েছে'+(rm||up?'। ⚠ চালু সার্ভিসে: '+(rm?bn(rm)+'টি বাদ':'')+(rm&&up?', ':'')+(up?bn(up)+'টির দাম বেড়েছে':''):'');
  const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.append(msg+' ');
  const b=document.createElement('button');b.className='sm';b.textContent='দেখুন';b.onclick=()=>{t.remove();location.hash='chg'};t.appendChild(b);document.body.appendChild(t);setTimeout(()=>t.remove(),12000);
  try{if('Notification' in window&&Notification.permission==='granted')navigator.serviceWorker.ready.then(r=>r.showNotification('সার্ভিস স্টুডিও',{body:msg,icon:'icons/admin-192.png',tag:'prov-chg',data:{h:'chg'}}))}catch(_){}}
/* নোটিফিকেশনের অনুমতি — লগইনের পর প্রথম ট্যাপে একবারই চায় */
addEventListener('click',()=>{if(!token||!('Notification' in window)||Notification.permission!=='default'||ls.get('pb_notif_asked'))return;ls.set('pb_notif_asked','1');toast('প্রভাইডারে পরিবর্তন হলে জানাতে নোটিফিকেশনের অনুমতি দিন');setTimeout(()=>{try{Notification.requestPermission()}catch(_){}},900)},{passive:true});
function provList(c,d,cp){const q=String(d.q||'').toLowerCase().trim(),cat=String(d.category||''),fl=String(d.state||'all'),pf=String(d.platform||'').toLowerCase(),cm={};
  if(CAT)CAT.rows.forEach(r=>{cm[r.code]=r.state});
  let all=c.rows.map(r=>{const o=Object.assign({},r);o.state=CAT?(cm[r.service_id]||'off'):(r.state||'off');return o});
  const cs={};all.forEach(r=>{cs[r.category]=(cs[r.category]||0)+1});
  if(cp&&pf)all=all.filter(r=>{const P=pick(NP,r.category)||pick(NP,r.name);return P&&(P[0].toLowerCase()===pf||pf.indexOf(P[0].toLowerCase())>=0)});
  const out=all.filter(r=>(!cat||r.category===cat)&&(fl==='all'||r.state===fl)&&(!q||qOK(q,String(r.name)+' '+r.service_id+' '+r.category)));
  const off=Math.max(0,+d.offset||0),lim=Math.min(200,+d.limit||100);
  if(!c._pl||c._plN!==c.rows.length){const m={};['Facebook','Instagram','TikTok','Twitter / X','Telegram','WhatsApp','YouTube'].forEach(k=>{m[k]=0});c.rows.forEach(r=>{const P=pick(NP,r.category)||pick(NP,r.name);if(P)m[P[0]]=(m[P[0]]||0)+1});c._pl=Object.keys(m).map(k=>({label:k,n:m[k]})).sort((a,b)=>b.n-a.n);c._plN=c.rows.length}
  const pls=c._pl;
  return Object.assign({ok:true,total:out.length,rows:out.slice(off,off+lim)},c.ex,{categories:cs,platforms:pls})}
function provPatch(a,x){if(a==='svc_collect'||a==='svc_auto')setTimeout(()=>Object.keys(PC).forEach(k=>provSync(k).catch(()=>{})),3000)}
function catSoon(){clearTimeout(catTm);catTm=setTimeout(()=>{if(token)catSyncNow().catch(()=>{})},20000)}
function catList(d){const q=String(d.q||'').toLowerCase().trim(),pl=String(d.platform||''),cat=String(d.category||''),st=String(d.state||'all'),plc={},cats={};
  const base=CAT.rows.filter(r=>(st==='all'||r.state===st)&&(!q||qOK(q,r.name+' '+r.code+' '+r.category)));
  base.forEach(r=>{plc[r.platform_label]=(plc[r.platform_label]||0)+1});
  let f=base.filter(r=>!pl||r.platform_label===pl);f.forEach(r=>{if(r.category)cats[r.category]=1});if(cat)f=f.filter(r=>r.category===cat);
  const off=Math.max(0,+d.offset||0),lim=Math.min(100,+d.limit||40);
  return{ok:true,total:f.length,rows:f.slice(off,off+lim).map(r=>Object.assign({},r)),categories:Object.keys(cats).sort(),platforms:Object.keys(plc).map(k=>({label:k,n:plc[k]})).sort((a,b)=>b.n-a.n)}}
/* সার্ভারে সফল হওয়ার পর ফোনের কপিও একই ভাবে বদলায় */
function catPatch(a,x){const by={};CAT.rows.forEach(r=>{by[r.code]=r});const lb={};CAT.rows.forEach(r=>{lb[r.platform]=r.platform_label});
  const setPl=(r,pl)=>{pl=String(pl||'').toLowerCase().trim();if(!pl)return;r.platform=pl;if(lb[pl])r.platform_label=lb[pl];else{r.platform_label=pl;catSoon()}};
  const codes=(x.codes||[]).map(String);
  if(a==='svc_site_hide'){const gone={};codes.forEach(c=>{const r=by[c];if(!r)return;if(x.on)r.state='on';else{r.state='off';if(x.del&&r.src==='custom')gone[c]=1}});if(Object.keys(gone).length)CAT.rows=CAT.rows.filter(r=>!gone[r.code])}
  else if(a==='svc_site_edit'){const r=by[String(x.code)];if(r){r.name=String(x.name||'').trim().substring(0,120);if(x.category)r.category=String(x.category).trim().substring(0,80);setPl(r,x.platform);r.ov=1;catSoon()}}
  else if(a==='svc_site_bulk'){codes.forEach(c=>{const r=by[c];if(!r)return;let nm=r.name,ct=r.category;if(x.tidy&&r.tidy){nm=r.tidy.name;ct=r.tidy.cat}if(x.category)ct=String(x.category).trim();r.name=String(nm).substring(0,120);r.category=String(ct).substring(0,80);setPl(r,x.platform);r.ov=1});if(x.tidy)catSoon()}}
/* ---------- প্ল্যাটফর্ম পাতা: সার্ভার ছাড়া — ফোনে রাখা সব প্রভাইডারের CSV থেকে (সার্ভারের গোনার একই নিয়ম) ---------- */
const LP_PLAT = [
  ["Instagram", "instagram", /insta(?!nt)|\big\b/i], ["Facebook", "facebook", /facebook|\bfb\b/i], ["TikTok", "tiktok", /tik.?tok/i],
  ["YouTube", "youtube", /youtube|\byt\b/i], ["Telegram", "telegram", /telegram|\btg\b/i], ["Twitter / X", "twitter", /twitter|\bx\b|tweet/i],
  ["WhatsApp", "whatsapp", /whatsapp/i], ["Threads", "other", /threads/i], ["Spotify", "other", /spotify/i], ["LinkedIn", "other", /linkedin/i],
  ["Snapchat", "other", /snap/i], ["Pinterest", "other", /pinterest/i], ["Discord", "other", /discord/i], ["Twitch", "other", /twitch/i],
  ["Website Traffic", "other", /traffic|website|web ?visit/i]
];
const LP_TYPE = [['Story Reactions',/stor(y|ies).{0,14}(react|like|heart|emoji)/i],['Story Comments',/stor(y|ies).{0,14}comment/i],['Story Views',/stor(y|ies)/i],['Live Likes',/live.{0,14}(like|heart)/i],['Live Comments',/live.{0,14}(comment|chat)/i],['Live Views',/live.?stream|\blive\b|\bpk\b/i],['Watch Time',/watch.?(time|hour)|\d+\s*k\s*min/i],['Subscribers',/subscri/i],['Poll Votes',/\bpolls?\b|\bvotes?\b/i],['Bot Starts',/\bbot\b.{0,6}\bstarts?\b|\bstarts?\b.{0,6}\bbot\b/i],['Event Responses',/\bevent\b.{0,12}(join|going|respon|rsvp|interest)|\b(going|rsvp)\b/i],['Friend Requests',/friend.?requests?/i],['Reports',/\breports?\b/i],['Engagement Package',/\bpackage\b|\b(views?|likes?|comments?|shares?|saves?)\s*\+\s*(views?|likes?|comments?|shares?|saves?)\b|(\d+\+?\s*(likes?|retweets?|shares?|comments?|views?)\b.{0,25}){2,}/i],['Emoji Comments',/emoji.{0,12}comment|comment.{0,6}emoji/i],['Downloads',/downloads?\b/i],['Clicks',/\bclicks?\b/i],['Tweet Stats',/statistic|detail.?expand/i],['Stars',/\bstars?\b/i],['Page Reviews',/\breviews?\b|\bratings?\b|recommendations?\b/i],['Comment Reactions',/comment.{0,8}react/i],['Comment Likes',/comment.{0,8}(like|heart)|(like|heart).{0,8}comment/i],['Page Likes & Followers',/page.{0,10}likes?.{0,12}follow/i],['Page Likes',/page.{0,10}likes?\b|likes?.{0,10}\bpage\b/i],['Members',/member|joiner|\bjoins?\b/i],['Comments',/comment/i],['Shares',/share|repost|retweet|\bquotes?\b/i],['Saves',/\bsaves?\b|bookmark/i],['Reactions',/react|emoji|emotion|\blove\b|\bhaha\b|\bwow\b|\bangry\b|\bsad\b/i],['Likes',/\blikes?\b|\bhearts?\b/i],['Profile Visits',/profile.{0,4}visit/i],['Views',/views?\b|impression|\breach\b|\bplays?\b|stream|listen/i],['Followers',/follow(?!ing)|\bfans?\b/i],['Traffic',/traffic|\bvisit/i]];
function lpPick(list, text) {
  for (var i = 0; i < list.length; i++) { var re = list[i][list[i].length - 1]; if (re.test(text)) return list[i]; }
  return null;
}
function lpClean(t, keep) {
  var s = String(t || "").replace(/[\u{1F000}-\u{1FFFF}\u{2190}-\u{2BFF}\uFE0F\u200D\u20E3]/gu, " ");
  s = s.replace(/[\[\(\{]([^\]\)\}]*)[\]\)\}]/g, function (m, i) {
    return keep && /\d/.test(i) && /min|hour|hr|day|%|\d\s?[kKmMdDhH]\b/i.test(i) && !/refill|drop/i.test(i) ? " (" + i.trim() + ") " : " ";
  });
  return s.replace(/[|•~*_=#>]+/g, " ").replace(/\s+/g, " ").replace(/^[\s\-–—:.]+|[\s\-–—:.]+$/g, "");
}
const LP_STOP = /^(cheap|cheapest|best|premium|new|special|bulk|hq|vip|server|services?|offer|promo|speed|fast|instant|real|non|usa|global|top|mix|other|others|smm|panel|packages?|all|any|old|updated|hot|sale|quality|high|low|slow|stable|exclusive|limited|test|custom|auto|manual|\d+)$/i;
function lpPlatOf(r) {
  var c = nk(r.category), n = nk(r.name), P = lpPick(LP_PLAT, c) || lpPick(LP_PLAT, n);
  if (P) return P[0];
  var seg = lpClean(c).split(/\s[-–—|:\/>»]+\s|[|:»]/)[0].trim(), w = seg.split(/\s+/);
  if (seg.length >= 2 && seg.length <= 24 && w.length <= 2 && !LP_STOP.test(w[0]) && !lpPick(LP_TYPE, seg)) return seg.replace(/\b\w/g, function (x) { return x.toUpperCase(); });
  return "Other";
}
async function allReady(){for(const p of SNAP_P){await provEnsure(p);if(!(PC[p]&&PC[p].rows&&PC[p].rows.length))return false}return true}
const lpLabel=r=>r._pl||(r._pl=lpPlatOf(r));
const lpType=r=>{if(!r._ty){const T=lpPick(LP_TYPE,nk(r.category))||lpPick(LP_TYPE,nk(r.name));r._ty=T?T[0]:'Other'}return r._ty};
function lpRows(){const o=[];SNAP_P.forEach(p=>{const c=PC[p];if(c&&c.rows)c.rows.forEach(r=>{if(!r.provider)r.provider=p;o.push(r)})});return o}
function lpPlatforms(){const tot={},site={},ks={};lpRows().forEach(r=>{const l=lpLabel(r);tot[l]=(tot[l]||0)+1});CAT.rows.forEach(r=>{if(r.state==='on')site[r.platform_label]=(site[r.platform_label]||0)+1});
  Object.keys(tot).concat(Object.keys(site)).forEach(k=>{ks[k]=1});
  return{ok:true,platforms:Object.keys(ks).map(k=>({label:k,total:tot[k]||0,site:site[k]||0})).sort((a,b)=>(b.total+b.site*3)-(a.total+a.site*3))}}
function lpByPlat(d){const label=String(d.label||''),q=String(d.q||'').toLowerCase().trim(),type=String(d.type||''),fl=String(d.state||'all'),provs=Array.isArray(d.provs)?d.provs:[],pv={},cm={},types={},all=[];
  CAT.rows.forEach(r=>{cm[r.code]=r.state});
  lpRows().forEach(r=>{if(lpLabel(r)!==label)return;if(q&&!qOK(q,String(r.name)+' '+r.service_id+' '+r.category))return;
    pv[r.provider]=(pv[r.provider]||0)+1;if(provs.length&&provs.indexOf(r.provider)<0)return;
    const tl=lpType(r);types[tl]=(types[tl]||0)+1;if(type&&tl!==type)return;
    const st=cm[r.service_id]||'off';if(fl!=='all'&&st!==fl)return;const o=Object.assign({},r);o.state=st;all.push(o)});
  all.sort((a,b)=>Number(a.rate)-Number(b.rate));
  const off=Math.max(0,+d.offset||0),lim=Math.min(80,+d.limit||40),sc={};CAT.rows.forEach(r=>{if(r.category)sc[r.category]=1});
  let fx;for(const p of SNAP_P){if(PC[p]&&PC[p].ex&&PC[p].ex.fx){fx=PC[p].ex.fx;break}}
  return{ok:true,total:all.length,provs:Object.keys(pv).map(k=>[k,pv[k]]).sort((a,b)=>b[1]-a[1]),rows:all.slice(off,off+lim),types:Object.keys(types).map(k=>[k,types[k]]).sort((a,b)=>b[1]-a[1]),fx,site_categories:Object.keys(sc).sort()}}
async function api(action,x){
  if(action==='svc_site_list'&&CAT)return catList(x||{});
  if((action==='svc_platforms'||action==='svc_by_platform')&&CAT){try{if(await allReady())return action==='svc_platforms'?lpPlatforms():lpByPlat(x||{})}catch(_){}bgSync(true)}
  if(action==='svc_list'&&x&&x.provider){const p=x.provider;await provEnsure(p);const c=PC[p],off=!navigator.onLine;
    if(c){if(!off)bgSync(false);return provList(c,x,!!x.platform)}
    /* প্রথমবার (ফোনে কপি নেই): সার্ভারের তালিকা না ডেকে সরাসরি পুরো CSV একবার নামাই — এরপর থেকে সব ফোনের কপি থেকে */
    if(!off){try{await (PB[p]||provSync(p));const c2=PC[p];if(c2&&c2.rows)return provList(c2,x,!!x.platform)}catch(e){if(authFail(e))throw e}}
    try{const d0=await apiNet(action,x);
      const L=(d0.platforms||[]).slice();['Facebook','Instagram','TikTok','Twitter / X','Telegram','WhatsApp','YouTube'].forEach(k=>{if(!L.some(z=>platKey(z.label)===platKey(k)))L.push({label:k,n:0})});d0.platforms=L;return d0}catch(e){if(c)return provList(c,x,true);throw e}}
  const xx=x||{};
  if(CAT&&((/^svc_site_(hide|edit|bulk)$/.test(action)&&!xx.del)||(action==='svc_toggle'&&(!xx.on||!navigator.onLine))))return qAdd(action,xx);
  if(RD.test(action))return readCached(action,x);
  if(Q.length&&/^svc_(toggle|bulk|auto|collect|tidy_apply|site_hide|site_edit|site_bulk|prov_switch)$/.test(action))await qFlush();
  if(/^svc_(toggle|bulk|auto|collect|tidy_apply|site_hide|site_edit|site_bulk|prov_switch)$/.test(action))mutTs=Date.now();
  const d=await apiNet(action,x);
  if(/^svc_(toggle|bulk|collect|tidy_apply|auto|site_hide)$/.test(action))provPatch(action,x||{});
  if(/^svc_site_(hide|edit|bulk)$/.test(action)&&CAT){catPatch(action,x||{});idb.set(CATK,CAT)}
  else if(/^svc_(toggle|bulk|collect|tidy_apply|auto)$/.test(action))catSoon();
  else if(action==='svc_site_list'&&!CAT&&!catSync)catSyncNow().catch(()=>{});
  return d}
function toastU(m,fn){const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.append(m+' ');const b=document.createElement('button');b.className='sm';b.textContent='↶ ফেরান';
  b.onclick=async()=>{t.remove();try{await fn();toast('ফেরানো হয়েছে');if($('#ml'))mload()}catch(e){if(!authFail(e))toast(e.message)}};t.appendChild(b);document.body.appendChild(t);setTimeout(()=>t.remove(),8000)}
function toast(m){const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),3200)}
const authFail=e=>{if(e&&(e.code==='unauthorized'||e.code==='locked_out')){logout(ERR[e.code]);return true}return false};

/* আগের ডেটা সাথে সাথে দেখায়, পেছনে নতুনটা এনে বদলালে আবার আঁকে */
async function swr(act,x,draw){const my=rid,key='pbc_'+act+JSON.stringify(x||{});let c=mem[key],sh=null;
  if(!c){try{c=JSON.parse(ls.get(key))}catch(e){c=null}}
  if(c){sh=JSON.stringify(c);draw(c)}
  let d;try{d=await api(act,x)}catch(e){if(c&&!authFail(e)){toast('পুরনো তথ্য দেখানো হচ্ছে — '+e.message);return}throw e}
  const j=JSON.stringify(d);mem[key]=d;ls.set(key,j);if(my===rid&&j!==sh)draw(d)}
const sel=new Set();let cq={q:'',refill:false},cn=0;
const fmtT=s=>s<90?bn(Math.round(s))+' সে.':s<5400?bn(Math.round(s/60))+' মি.':bn(Math.round(s/360)/10)+' ঘণ্টা';
const spdTag=r=>r.spd?`<div class="sub ${r.spd.m<=1800?'ok':r.spd.m>=21600?'hi':''}">⚡ গড় ${fmtT(r.spd.m)} · ${bn(r.spd.n)}টি অর্ডার${r.spd.f?' · ব্যর্থ '+bn(r.spd.f):''}</div>`:'';
const nav=a=>`<div class="chips" role="navigation">${[['exc','ব্যতিক্রম'],['','প্রভাইডার'],['plat','প্ল্যাটফর্ম'],['best','🏆 সেরা'],['spd','⏱ স্পিড'],['mng','ম্যানেজ'],['cats','ক্যাটেগরি'],['cmp','তুলনা'],['chg','পরিবর্তন'],['tidy','সাজান'],['poster','🎨 পোস্টার']].map(x=>`<a class="chip" href="#${x[0]}" aria-current="${a===x[0]}">${x[0]==='exc'&&EXC.items.length?x[1]+' '+bn(EXC.items.length):x[1]}</a>`).join('')}</div>`;
/* ---------- হোম: প্রভাইডার তালিকা ---------- */
async function home(){
  $('#title').textContent='সার্ভিস স্টুডিও';$('#back').hidden=true;cur=null;
  const el=$('#main');el.innerHTML='<div class="sk"></div><div class="sk" style="margin-top:12px"></div>';
  try{
    await swr('svc_providers',{},d=>{const P=d.providers||[];
    el.innerHTML=nav('')+'<div class="bar"><button class="btn" id="all" style="max-width:260px">সব প্রভাইডার সংগ্রহ করুন</button><span id="prog" class="mut" role="status"></span></div><div class="list">'+
    (P.length?P.map(p=>`<div class="card pv" data-pc="${esc(p.provider)}"><div class="top"><div class="pvi${p.off?' dim':''}"><b>${esc(p.provider)}</b><div class="sub">${p.collected_at?'সংগ্রহ: '+esc(p.collected_at)+' · '+bn(p.count)+'টি':'এখনো সংগ্রহ হয়নি'}</div><div class="sub hi" data-ws ${p.off?'':'hidden'}>${provOffTxt(p)}</div></div><div style="display:flex;align-items:center;gap:8px">${p.has_api?'':'<span class="tag hi">API নেই</span>'}<button class="sw" role="switch" aria-checked="${!p.off}" aria-label="${esc(p.provider)} — সাইটে চালু/বন্ধ" data-w="${esc(p.provider)}"></button></div></div><div class="acts${p.off?' dim':''}"><button class="sm" data-c="${esc(p.provider)}" ${p.has_api?'':'disabled'}>সংগ্রহ</button><button class="sm" data-o="${esc(p.provider)}" ${p.count?'':'disabled'}>সার্ভিস দেখুন</button></div></div>`).join(''):'<div class="card empty">কোনো প্রভাইডার কনফিগার করা নেই</div>')+'</div>';
    el.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>collect(b.dataset.c,b));
    el.querySelectorAll('[data-o]').forEach(b=>b.onclick=()=>{location.hash='p='+encodeURIComponent(b.dataset.o)});
    el.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>provSwitch(P.find(q=>q.provider===b.dataset.w),b));
    const all=$('#all');if(all)all.onclick=async()=>{all.disabled=true;let ok=0,bad=0;const L=P.filter(p=>p.has_api);for(let i=0;i<L.length;i++){$('#prog').textContent=`${bn(i+1)}/${bn(L.length)} — ${L[i].provider}`;try{await api('svc_collect',{provider:L[i].provider});ok++}catch(e){if(authFail(e))return;bad++}}toast(`সংগ্রহ শেষ: ${bn(ok)} সফল, ${bn(bad)} ব্যর্থ`);home()};
    });}catch(e){if(!authFail(e))el.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p><button class="btn" id="rt" style="max-width:220px">আবার চেষ্টা করুন</button></div>`,$('#rt').onclick=home}
}
/* প্রভাইডার সুইচ: বন্ধ করলে ওই প্রভাইডারের সব সার্ভিস সাইট থেকে লুকায়; চালু করলে শুধু সুইচে লুকানোগুলো ফেরে */
const provOffTxt=p=>'সুইচ বন্ধ — সাইটে এর সব সার্ভিস লুকানো'+(p.hidden_n?' ('+bn(p.hidden_n)+'টি)':'');
function provDraw(p,card){const on=!p.off;card.querySelector('[data-w]').setAttribute('aria-checked',on);
  card.querySelector('.pvi').classList.toggle('dim',!on);card.querySelector('.acts').classList.toggle('dim',!on);
  const w=card.querySelector('[data-ws]');w.hidden=on;w.textContent=on?'':provOffTxt(p)}
async function provSwitch(p,b){
  if(busy||!p)return;const on=!!p.off,card=b.closest('.card');
  if(!on&&!confirm(p.provider+' বন্ধ করলে এর সব সার্ভিস সাইট থেকে লুকানো হবে। চালিয়ে যাবেন?'))return;
  if(!navigator.onLine){toast('অফলাইনে প্রভাইডার সুইচ বদলানো যায় না');return}
  busy=true;b.disabled=true;
  try{const r=await api('svc_prov_switch',{provider:p.provider,on});p.off=!on;p.hidden_n=on?0:r.done;provDraw(p,card);
    toast(on?p.provider+' চালু — '+bn(r.done)+'টি সার্ভিস ফিরেছে':p.provider+' বন্ধ — '+bn(r.done)+'টি সার্ভিস লুকানো হয়েছে');
    catSyncNow().catch(()=>{})}
  catch(e){if(!authFail(e))toast(e.message)}
  busy=false;b.disabled=false}
async function collect(p,btn){
  btn.disabled=true;btn.textContent='সংগ্রহ চলছে…';
  try{const r=await api('svc_collect',{provider:p});toast(`${p}: ${bn(r.count)}টি সার্ভিস সংগ্রহ হয়েছে`);home()}
  catch(e){if(authFail(e))return;toast(p+': '+e.message);btn.disabled=false;btn.textContent='সংগ্রহ'}
}

/* ---------- প্রভাইডারের সার্ভিস + সুইচ ---------- */
const PLAT=[['instagram',/insta(?!nt)|\big\b/i],['facebook',/facebook|\bfb\b/i],['tiktok',/tik.?tok/i],['youtube',/youtube|\byt\b/i],['telegram',/telegram|\btg\b/i],['twitter',/twitter|\bx\b/i],['whatsapp',/whatsapp/i],['other',/./]];
const guess=s=>{s=nk(s);return (PLAT.find(p=>p[1].test(s))||PLAT[7])[0]};
let provTok=0,selProv=null;
async function provider(p,more){
  cur=p;$('#title').textContent=p;$('#back').hidden=false;const el=$('#main');
  const hq=!more&&document.activeElement&&document.activeElement.id==='q',my=more?provTok:++provTok;
  if(!more){st.off=0;if(selProv!==p){sel.clear();selProv=p}bulkBar();if(!hq)el.innerHTML='<div class="sk"></div>'}
  try{
    const d=await pageRows('svc_list',{provider:p,q:st.q,state:st.state,category:st.cat,platform:st.plat||''},st.off,50,st.cat?'':(st.type||''));
    if(my!==provTok)return;
    if(!more){lastList=d;
      el.innerHTML=tiles(d.platforms||[],st.plat||'')+`<div class="bar"><input id="q" type="search" placeholder="নাম, আইডি বা ক্যাটেগরি খুঁজুন" value="${esc(st.q)}" aria-label="খুঁজুন"></div><div id="cats">${catUI(catsFor(d.categories,st.plat),st)}</div>
      <div class="chips" role="group" aria-label="অবস্থা">${[['all','সব'],['on','চালু'],['off','বন্ধ'],['conflict','জট']].map(s=>`<button class="chip" data-s="${s[0]}" aria-pressed="${st.state===s[0]}">${s[1]}</button>`).join('')}<button class="chip" id="sa">সব বাছুন</button><button class="chip" id="csv">⤓ CSV</button></div>
      <p class="sub" id="cnt"></p><div class="list" id="rows"></div><div id="moreWrap"></div>`;
      $('#q').oninput=e=>{clearTimeout(qt);qt=setTimeout(()=>{st.q=e.target.value;provider(p)},350)};
      if(hq){const qi=$('#q');qi.focus();try{qi.setSelectionRange(qi.value.length,qi.value.length)}catch(_){}}
      bindCat($('#cats'),st,()=>provider(p));
      el.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{st.state=b.dataset.s;provider(p)});
      $('#csv').onclick=()=>dl(p);bindTiles(el,l=>{st.plat=l;st.cat='';provider(p)});$('#sa').onclick=()=>el.querySelectorAll('.sel').forEach(x=>{if(!x.checked){x.checked=true;x.onchange()}});
    }else lastList.rows=lastList.rows.concat(d.rows);
    $('#cnt').textContent=`মোট ${bn(d.total)}টি${d.fx?'':' · USD→৳ রেট সেট নেই (দাম USD-তে দিন)'}`;
    const box=$('#rows');if(!more)box.innerHTML='';
    if(!d.rows.length&&!more)box.innerHTML='<div class="card empty">কিছু পাওয়া যায়নি</div>';
    d.rows.forEach(r=>box.appendChild(row(r,d)));
    st.off=d.next;if(st.type&&!st.cat)$('#cnt').textContent=TLBL[st.type]+' ধরন · '+bn(box.children.length)+'টি দেখানো হচ্ছে'+(d.fx?'':' · USD→৳ রেট সেট নেই (দাম USD-তে দিন)');$('#moreWrap').innerHTML=st.off<d.total?'<button class="sm" id="more" style="width:100%;margin-top:8px">আরও দেখান</button>':'';
    const m=$('#more');if(m)m.onclick=()=>provider(p,true);
    window._fx=d.fx;window._sc=d.site_categories;
  }catch(e){if(!authFail(e)){el.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p><div class="ordb"><button class="btn" id="rt" style="max-width:260px">আবার চেষ্টা করুন</button></div><div class="ordb"><button class="btn" id="rc" style="max-width:260px">⬇ এখনই সংগ্রহ করুন</button></div><div class="ordb"><button class="sm" id="rd">🔧 কারণ খুঁজুন</button></div><div id="dg" role="status"></div></div>`;$('#rt').onclick=()=>provider(p);$('#rc').onclick=()=>provCollect(p);$('#rd').onclick=()=>provDiag(p)}}
}
/* বাছাই মনে রাখা: ফিল্টার/'আরও দেখান'-এ কার্ড নতুন করে আঁকা হলেও টিক থাকে (প্রভাইডার+আইডি দিয়ে চেনে) */
/* রেট টাকায় সাথে সাথে: প্রভাইডারের USD রেট × সেট করা ডলার-রেট (১ USDT = ৳?); রেট কোথাও সেট না থাকলে ১৩১ ধরে */
const fxNow=()=>+window._fx>0?+window._fx:(+ls.get('pb_fx')>0?+ls.get('pb_fx'):131);
const rateTk=(u,plain)=>{const x=+u,f=fxNow();if(!(x>=0)||!f)return esc(u)+' $';const t=x*f;return '৳'+bn(+t.toFixed(t<10?3:2))+(plain?'':' <span class="mut">($'+esc(u)+')</span>')};
const RW=new WeakMap(),selKey=r=>(r.provider||cur||'')+'|'+r.service_id;
function row(r,d){
  const c=document.createElement('div');c.className='card svc';
  const sg='';
  c.innerHTML=`<div><h4>${r.state==='conflict'?'':'<input type="checkbox" class="sel" aria-label="নির্বাচন">'}${esc(r.name)}</h4><div class="sub">${d&&d.cmp?'<b>'+esc(r.provider)+'</b> · ':''}ID <b>${esc(r.service_id)}</b> · ${esc(r.category)}</div><div class="sub">রেট <b>${rateTk(r.rate)}</b> · ${bn(r.min)}–${bn(r.max)}${r.refill==='1'?' · Refill':r.refill==='0'?' · No Refill':''}${r.cancel==='1'?' · Cancel':''}${sg}</div>${spdTag(r)}<div class="ordb"><button type="button" class="sm" data-ord>🧪 অর্ডার</button></div>${r.tidy&&r.state!=='on'?`<div class="sub ok">সাইটে: ${esc(nice(r)||r.tidy.name)} · ${esc(r.tidy.cat)}</div>`:''}${r.state==='conflict'?`<div class="sub hi">জট: ${esc(r.conflict_with)}-এর সার্ভিস হিসেবে আছে</div>`:''}</div>
  <button class="sw" role="switch" aria-checked="${r.state==='on'}" aria-label="${esc(r.name)} সাইটে চালু/বন্ধ" ${r.state==='conflict'?'disabled':''}></button>`;
  c.querySelector('.sw').onclick=ev=>toggle(r,ev.currentTarget);c.querySelector('[data-ord]').onclick=()=>ordDlg(Object.assign({},r,{provider:r.provider||cur,_fx:fxNow()}));
  const cb=c.querySelector('.sel');RW.set(r,{cb,sw:c.querySelector('.sw')});
  if(cb){const k=selKey(r);let old=null;sel.forEach(x=>{if(selKey(x)===k)old=x});if(old){sel.delete(old);sel.add(r);cb.checked=true}
    cb.onchange=()=>{cb.checked?sel.add(r):sel.delete(r);bulkBar()}}
  return c;
}
async function toggle(r,btn){
  if(busy)return;
  if(r.state==='on'){
    if(!confirm('এটা সাইট থেকে লুকানো হবে। চালিয়ে যাবেন?'))return;
    busy=true;btn.disabled=true;
    try{await api('svc_toggle',{provider:r.provider||cur,code:r.service_id,on:false});r.state='off';btn.setAttribute('aria-checked','false');toast('সাইট থেকে লুকানো হয়েছে')}catch(e){if(!authFail(e))toast(e.message)}
    busy=false;btn.disabled=false;return;
  }
  openSheet(r,btn);
}
/* ক্যাটেগরি মনে রাখা: প্রভাইডারের ক্যাটেগরি → আপনার বাছা ক্যাটেগরি (ফোনে থাকে, পরের প্যানেলের একই ধরনের সার্ভিসে নিজে বসে) */
const cmKey=c=>stripEmo(c).toLowerCase().replace(/[^a-z0-9\u0980-\u09ff]+/g,' ').trim();
const cmAll=()=>{try{return JSON.parse(ls.get('pb_catmap')||'{}')}catch(e){return{}}};
const cmGet=c=>{const k=cmKey(c);return k?cmAll()[k]||'':''};
const cmSet=(c,my)=>{const k=cmKey(c);if(!k||!my)return;const m=cmAll();m[k]=my;ls.set('pb_catmap',JSON.stringify(m))};
function openSheet(r,btn,force,q){NGR=r;setTimeout(ngDraw,0);
  const sh=$('#sheet');$('#shT').textContent=q?`সাইটে চালু করুন (${bn(q.i+1)}/${bn(q.n)})`:'সাইটে চালু করুন';$('#shSkip').textContent=q?'বাদ দিন':'বাতিল';$('#shStop').hidden=!q;$('#shOk').textContent='চালু করুন';$('#shN').textContent=`ID ${r.service_id} · রেট ${rateTk(r.rate,1)} · মূল: ${r.name} | ${r.category}`;
  const t=r.tidy||{};$('#shName').value=nice(r)||t.name||r.name;$('#shCat').value=cmGet(r.category)||matchCat(t.cat||r.category);
  $('#shPlat').innerHTML=PLAT.map(p=>`<option>${p[0]}</option>`).join('');$('#shPlat').value=t.plat||guess(r.category+' '+r.name);
  
  catSuggest($('#shCat'),$('#shPlat'),$('#shSg'),()=>[t.cat,r.category]);
  {const cs=$('#shCs'),pl=$('#shPlat'),ci=$('#shCat'),fill=()=>fillCatSel(cs,pl.value,ci.value);fill();loadSiteCats(pl.value).then(fill);
    cs.onchange=()=>{if(cs.value){ci.value=cs.value;ci.dispatchEvent(new Event('input'))}};
    pl.addEventListener('change',()=>{fill();loadSiteCats(pl.value).then(fill)});ci.addEventListener('input',fill)}
  $('#shPriceBdt').hidden=true;$('#shPriceUsd').hidden=true;$('#shUsd').value=r.rate;
  $('#shInfo').textContent=`প্রভাইডারের রেট $${r.rate}/1K — এই দামই সাইটে যাবে, মার্কআপ শুধু সাইটে একবার বসবে`;$('#shErr').textContent='';
  sh.onclose=async()=>{const rv=sh.returnValue;
    if(rv!=='ok'){if(q){if(rv==='cancel')q.next();else q.done()}return}
    busy=true;btn.disabled=true;
    try{await api('svc_toggle',{provider:r.provider||cur,code:r.service_id,on:true,name:$('#shName').value,platform:$('#shPlat').value,category:$('#shCat').value.trim(),force:true});cmSet(r.category,$('#shCat').value.trim());
      r.state='on';btn.setAttribute('aria-checked','true');toast('সাইটে চালু হয়েছে ✔')}
    catch(e){if(authFail(e)){}else toast(e.message)}
    busy=false;btn.disabled=false;if(q)q.next();
  };
  $('#shForm').onsubmit=e=>{const u=+$('#shUsd').value,c=$('#shCat').value.trim();if(e.submitter&&e.submitter.value==='ok'&&!c){e.preventDefault();$('#shErr').textContent='ক্যাটেগরি দিন'}};
  sh.returnValue='';sh.showModal();
}
/* CSV: অনলাইনে সার্ভার থেকে নতুনটা আনে ও ফোনে রাখে; অফলাইনে/সার্ভার না পেলে ফোনের রাখা কপি, সেটাও না থাকলে ফোনের ক্যাটালগ থেকে বানায় */
const csvQ=v=>{v=v==null?'':String(v);return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
function rowsCsv(rows){const sk={state:1,suggest:1,spd:1,tidy:1,conflict_with:1},ks=[];rows.forEach(r=>Object.keys(r).forEach(k=>{if(!sk[k]&&ks.indexOf(k)<0)ks.push(k)}));
  return '\ufeff'+ks.join(',')+'\n'+rows.map(r=>ks.map(k=>csvQ(r[k])).join(',')).join('\n')}
async function csvGet(p){
  if(navigator.onLine){try{const d=await apiNet('svc_csv',{provider:p});idb.set('csv_'+p,{csv:d.csv,name:d.name,at:Date.now()});PC[p]={rows:csvToRows(d.csv),at:Date.now(),ex:(PC[p]&&PC[p].ex)||{}};return d}catch(e){if(e.code&&e.code!=='net'&&e.code!=='not_json')throw e}}
  const c=await idb.get('csv_'+p);if(c){toast('অফলাইন — ফোনে রাখা কপি ('+new Date(c.at).toLocaleString('bn-BD')+')');return c}
  const P=PC[p]||await idb.get('prov_'+p);if(P&&P.rows&&P.rows.length){toast('অফলাইন — ফোনের ক্যাটালগ থেকে বানানো হলো');return{csv:rowsCsv(P.rows),name:p+'-services.csv'}}
  const e=new Error('অফলাইন, আর ফোনে এই প্রভাইডারের কপি নেই — একবার অনলাইনে ডাউনলোড করুন');e.code='net';throw e}
async function dl(p){
  try{const d=await csvGet(p);const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([d.csv],{type:'text/csv;charset=utf-8'}));a.download=d.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
  catch(e){if(!authFail(e))toast(e.message)}
}

/* ---------- বাল্ক ---------- */
function bulkBar(){let b=$('#bulk');if(!b){b=document.createElement('div');b.id='bulk';b.className='bulk';document.body.appendChild(b)}
  b.hidden=!sel.size;b.innerHTML=`<b>${bn(sel.size)}টি বাছাই</b><button class="sm" data-b="on">চালু</button><button class="sm" data-b="off">বন্ধ</button><button class="sm" data-b="x" aria-label="বাতিল">✕</button>`;
  b.querySelectorAll('[data-b]').forEach(x=>x.onclick=()=>bulk(x.dataset.b))}
/* সাইটে থাকা ক্যাটেগরি: সার্ভারের প্রস্তাব + ফোনের কপি + সাইটের তালিকা মিলিয়ে, প্ল্যাটফর্ম ধরে */
const autoH=e=>{if(!e)return;e.style.height='auto';e.style.height=(e.scrollHeight+2)+'px'};
const catLbl=c=>String(c||'').replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D\u20E3]/gu,'').replace(/\s+/g,' ').trim()||String(c||'');
function siteCatsFor(pv){const lab=PLB[pv];if(!lab)return[];const m=new Map();
  ((CAT&&CAT.rows)||[]).forEach(r=>{if(!r.category||String(r.platform_label||'').toLowerCase()!==lab.toLowerCase())return;const k=stripEmo(r.category).toLowerCase(),o=m.get(k);if(o)o.n++;else m.set(k,{c:r.category,n:1})});
  const ti=c=>{const i=TORD.indexOf(typeOf(c));return i<0?99:i};
  return [...m.values()].sort((a,b)=>ti(a.c)-ti(b.c)||catLbl(a.c).localeCompare(catLbl(b.c)))}
const catOpt=x=>`<option value="${esc(x.c)}">${esc(catLbl(x.c))}${x.n?' ('+bn(x.n)+')':''}</option>`,
  catGroups=L=>{const g={};L.forEach(x=>{const k=typeOf(x.c);(g[k]=g[k]||[]).push(x)});return TORD.filter(k=>g[k]).map(k=>`<optgroup label="${esc(TLBL[k])}">${g[k].map(catOpt).join('')}</optgroup>`).join('')};
async function loadSiteCats(pv){const lab=PLB[pv];if(!lab||CSG[lab])return;try{const d=await api('svc_cat_suggest',{label:lab});CSG[lab]={site:d.site||[],providers:d.providers||[]}}catch(e){}}
function fillCatSel(sel,pv,val){const L=siteCatsFor(pv),k=stripEmo(val||'').toLowerCase();
  sel.innerHTML='<option value="">'+(L.length?'সাইটে থাকা ক্যাটেগরি থেকে বাছুন ▾':'এই প্ল্যাটফর্মে সাইটে ক্যাটেগরি নেই — নিজে লিখুন')+'</option>'+catGroups(L);
  const f=L.find(x=>stripEmo(x.c).toLowerCase()===k);sel.value=f?f.c:''}
const planName=(b,k)=>b.substring(0,112)+' · Plan '+String.fromCharCode(65+k);
function allIdeas(r,plat){const a=nameIdeas(r,plat),out=[],seen=new Set(),add=x=>{x=x.substring(0,120);const k=x.toLowerCase();if(x&&!seen.has(k)){seen.add(k);out.push(x)}};
  a.forEach(add);
  const V=[x=>x.replace(/ \| /g,' ✦ '),x=>x.replace(/ · /g,' • '),x=>x.replace(/ \| /g,' ✦ ').replace(/ · /g,' • '),x=>x.replace(/ — /g,' ⭐ '),x=>x.replace(/ \| /g,' ❘ ').replace(/ · /g,' ‧ ')];
  V.forEach(f=>a.forEach(x=>add(f(x))));return out}
function addList(list){
  const d=$('#bsheet'),box=$('#bsl'),E=$('#bsE'),PO=PLAT.map(p=>`<option>${p[0]}</option>`).join('');let any=false;
  $('#bsT').textContent=`সাইটে চালু করুন — ${bn(list.length)}টি (নিচে একটার পর একটা)`;box.innerHTML='';E.textContent='';$('#bsAll').value='';
  const items=list.map(r=>{const t=r.tidy||{};return{r,on:true,k:0,name:nice(r)||t.name||r.name,plat:t.plat||guess(r.category+' '+r.name),cat:cmGet(r.category)||matchCat(t.cat||r.category)}});
  /* একই কোয়ালিটির দুটো সার্ভিসের হুবহু একই নাম হবে না: ৫টা ছাঁচ + আলাদা চিহ্নের (✦ • ❘) রূপ থেকে যেটা ফাঁকা সেটা নেয় */
  const nk2=s=>String(s||'').trim().toLowerCase(),taken=new Set(((CAT&&CAT.rows)||[]).map(r=>nk2(r&&r.name)).filter(Boolean));
  items.forEach(it=>{const a=allIdeas(it.r,PLB[it.plat]||''),C=nameCtx(it.r),nb=nameIdeas(it.r,PLB[it.plat]||'').length||1,st=C&&a.length?hsh(C.key)%nb%a.length:0;let nm=null;
    for(let i=0;i<a.length&&!nm;i++){const c=a[(st+i)%a.length];if(!taken.has(nk2(c)))nm=c}
      if(!nm&&a.length){for(let k=1;k<26&&!nm;k++){const c=planName(a[st],k);if(!taken.has(nk2(c)))nm=c}}
    it.name=nm||(a.length?a[st]:it.name);taken.add(nk2(it.name))});
  const cnt=()=>{const k=items.filter(x=>x.on).length;$('#bsOk').textContent=`সবগুলো চালু করুন (${bn(k)}টি)`;$('#bsOk').disabled=!k};
  items.forEach(it=>{const c=document.createElement('div');c.className='card bsi';
    c.innerHTML=`<div class="bsh"><label class="bsk"><input type="checkbox" checked aria-label="চালু করুন"><b>#${esc(it.r.service_id)}</b></label><span class="sub">রেট ${rateTk(it.r.rate)}</span><button type="button" class="sm bsn" aria-label="অন্য নাম প্রস্তাব">↻ নাম</button></div><div class="sub bso"></div><textarea class="bn" rows="2" maxlength="120" aria-label="সাইটে নাম"></textarea><select class="bp" aria-label="প্ল্যাটফর্ম">${PO}</select><select class="bcs" aria-label="সাইটে থাকা ক্যাটেগরি থেকে বাছুন"></select><textarea class="bc" rows="1" autocomplete="off" aria-label="ক্যাটেগরি" placeholder="ক্যাটেগরি (বাছুন বা নিজে লিখুন)"></textarea>`;
    c.querySelector('.bso').textContent=(it.r.provider?it.r.provider+' · ':'')+'মূল: '+it.r.name;
    const ck=c.querySelector('input[type=checkbox]'),n=c.querySelector('.bn'),p=c.querySelector('.bp'),cc=c.querySelector('.bc');
    const cs=c.querySelector('.bcs');Object.assign(it,{c,ck,n,p,cc,cs});p.value=it.plat;n.value=it.name;cc.value=it.cat;
    it.fill=()=>fillCatSel(cs,p.value,it.cat);it.fill();
    cs.onchange=()=>{if(!cs.value)return;it.cat=cs.value;cc.value=cs.value;cc.classList.remove('bad');autoH(cc)};
    n.onkeydown=cc.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.target.blur()}};
    ck.onchange=()=>{it.on=ck.checked;c.classList.toggle('off',!it.on);cnt()};n.oninput=()=>{it.name=n.value;n.classList.remove('bad');autoH(n)};p.onchange=()=>{it.plat=p.value;it.fill();loadSiteCats(p.value).then(it.fill)};cc.oninput=()=>{it.cat=cc.value;cc.classList.remove('bad');autoH(cc);it.fill()};
    c.querySelector('.bsn').onclick=()=>{const a=allIdeas(it.r,PLB[p.value]||'');if(!a.length)return;
      const u=new Set(items.filter(x=>x!==it).map(x=>nk2(x.name)));let ok2=false;for(let t=0;t<a.length;t++){it.k=(it.k+1)%a.length;if(!u.has(nk2(a[it.k]))&&!taken.has(nk2(a[it.k]))){ok2=true;break}}
      let nn=a[it.k];if(!ok2){for(let k=1;k<26;k++){const c=planName(a[it.k],k);if(!u.has(nk2(c))&&!taken.has(nk2(c))){nn=c;break}}}
      n.value=it.name=nn;n.classList.remove('bad');autoH(n)};
    box.appendChild(c)});
  const applyAll=v=>{v=(v||'').trim();if(!v)return;items.forEach(x=>{if(x.on&&!x.done){x.cat=v;x.cc.value=v;x.cc.classList.remove('bad');autoH(x.cc);x.fill()}})};
  $('#bsAllB').onclick=()=>applyAll($('#bsAll').value);
  const as=$('#bsAllS'),plats=[...new Set(items.map(x=>x.plat))],drawAll=()=>{as.innerHTML='<option value="">সাইটে থাকা ক্যাটেগরি থেকে বাছুন ▾</option>'+plats.map(pv=>{const L=siteCatsFor(pv);return L.length?`<optgroup label="${esc(PLB[pv]||pv)}">${L.map(catOpt).join('')}</optgroup>`:''}).join('')};
  drawAll();Promise.all(plats.map(loadSiteCats)).then(drawAll);
  as.onchange=()=>{if(!as.value)return;$('#bsAll').value=as.value;applyAll(as.value);as.value=''};
  items.forEach(x=>loadSiteCats(x.p.value).then(x.fill));
  $('#bsX').onclick=()=>{if(!busy)d.close()};
  d.onclose=()=>{bulkBar();if(any&&cur)provider(cur)};
  $('#bsOk').onclick=async()=>{if(busy)return;const L=items.filter(x=>x.on&&!x.done);if(!L.length)return;
    const bad=L.filter(x=>!x.cat.trim());if(bad.length){bad.forEach(x=>x.cc.classList.add('bad'));E.textContent='ক্যাটেগরি লাগবে — লাল ঘরগুলো পূরণ করুন';bad[0].cc.scrollIntoView({block:'center'});return}
    {const seen=new Set(items.filter(x=>x.done).map(x=>nk2(x.name))),dup=[];L.forEach(x=>{const k=nk2(x.name);if(seen.has(k))dup.push(x);seen.add(k)});
      if(dup.length){dup.forEach(x=>x.n.classList.add('bad'));E.textContent='একই নাম একাধিক সার্ভিসে — লাল ঘরের নাম আলাদা করুন (↻ নাম চাপুন)';dup[0].n.scrollIntoView({block:'center'});return}}
    busy=true;$('#bsOk').disabled=true;let ok=0;const er=[];
    const mark=x=>{cmSet(x.r.category,x.cat.trim());x.r.state='on';sel.delete(x.r);{const w=RW.get(x.r);if(w){w.cb&&(w.cb.checked=false);w.sw&&w.sw.setAttribute('aria-checked','true')}}x.done=true;x.on=false;x.ck.checked=false;x.ck.disabled=true;x.c.classList.add('done');ok++;any=true};
    const bad1=(x,m)=>{er.push('#'+x.r.service_id+' '+m);x.c.classList.add('fail')};
    /* একসাথে: ৪০টা করে ভাগে ১টা সার্ভার-কলে (আগে প্রতিটার জন্য আলাদা কল) */
    let fb=!navigator.onLine;
    if(!fb)for(const ch of chunks(L,40)){E.textContent=`চালু হচ্ছে… ${bn(ok)}/${bn(L.length)}`;
      try{const q=await api('svc_toggle',{on:true,force:true,many:ch.map(x=>({provider:x.r.provider||cur,code:x.r.service_id,name:x.name.trim()||x.r.name,platform:x.p.value,category:x.cat.trim()}))});
        const R=q.results||[];ch.forEach((x,i)=>{const r=R[i]||{};if(r.ok)mark(x);else bad1(x,r.message||ERR[r.error]||r.error||'failed')})}
      catch(e){if(authFail(e)){busy=false;return}if(e.code==='code_required'&&!ok&&!er.length){fb=true;break}ch.forEach(x=>bad1(x,e.message))}}
    if(fb){const L2=L.filter(x=>!x.done);er.length=0;L2.forEach(x=>x.c.classList.remove('fail'));
      for(let i=0;i<L2.length;i++){const x=L2[i];E.textContent=`চালু হচ্ছে… ${bn(i+1)}/${bn(L2.length)} (ধীর পদ্ধতি — PtServices.gs নতুনটা বসান)`;
        try{await api('svc_toggle',{provider:x.r.provider||cur,code:x.r.service_id,on:true,name:x.name.trim()||x.r.name,platform:x.p.value,category:x.cat.trim(),force:true});mark(x)}
        catch(e){if(authFail(e)){busy=false;return}bad1(x,e.message)}}}
    busy=false;cnt();
    if(!er.length){d.close();toast(bn(ok)+'টি সার্ভিস সাইটে চালু হয়েছে ✔')}
    else E.textContent=`${bn(ok)}টি হয়েছে, ${bn(er.length)}টি হয়নি — ${er.slice(0,3).join(' · ')}। লাল কার্ডগুলো ঠিক করে আবার চাপুন।`};
  cnt();d.showModal();box.scrollTop=0;items.forEach(x=>{autoH(x.n);autoH(x.cc)})}
function addQueue(list){addList(list)}
async function bulk(k){
  if(k==='x'){sel.clear();document.querySelectorAll('.sel').forEach(x=>x.checked=false);return bulkBar()}
  if(busy)return;const on=k==='on';
  /* চালু: অটো সাজানো নেই — বাছাই করা সব সার্ভিস একটা পাতায় একটার নিচে একটা আসে; নাম/প্ল্যাটফর্ম/ক্যাটেগরি নিজে ঠিক করে একসাথে চালু */
  if(on){const its=[...sel].filter(x=>x.state!=='on'&&x.state!=='conflict');if(!its.length)return toast('বাছাই করা সবই আগে থেকে সাইটে চালু আছে');return addQueue(its)}
  const all=[...sel],by={};all.forEach(r=>{const pv=r.provider||cur;(by[pv]=by[pv]||[]).push(r.service_id)});
  if(!confirm(bn(all.length)+'টি সার্ভিস সাইট থেকে লুকানো হবে?'))return;
  busy=true;try{const t={done:0,skipped:0};for(const pv of Object.keys(by))for(const c of chunks(by[pv],100)){const q=await api('svc_bulk',{provider:pv,codes:c,on:false,category:'',markup:'',force:true});t.done+=q.done||0;t.skipped+=q.skipped||0}
    toast(`${bn(t.done)}টি হয়েছে, ${bn(t.skipped)}টি বাদ`);sel.clear();bulkBar();if(cur)provider(cur);else{all.forEach(r=>{r.state='off';const w=RW.get(r);if(w){w.cb&&(w.cb.checked=false);w.sw&&w.sw.setAttribute('aria-checked','false')}})}}catch(e){if(!authFail(e))toast(e.message)}busy=false}

/* ---------- দাম তুলনা ---------- */
async function cmp(){
  cur=null;$('#title').textContent='দাম তুলনা';$('#back').hidden=true;const el=$('#main');
  el.innerHTML=nav('cmp')+`<div class="bar"><input id="cq" type="search" placeholder="যেমন: instagram followers" value="${esc(cq.q)}" aria-label="খুঁজুন"><button class="chip" id="cr" aria-pressed="${cq.refill}" aria-label="শুধু রিফিল আছে এমন">Refill</button></div><p class="sub" id="cc">কমপক্ষে ২ অক্ষর লিখুন — ১০ প্রভাইডারে খোঁজা হবে, সস্তা আগে</p><div class="list" id="cl"></div>`;
  const go=async()=>{const box=$('#cl'),cc=$('#cc'),my=++cn;if(cq.q.trim().length<2){box.innerHTML='';return}
    cc.textContent='খোঁজা হচ্ছে…';
    try{const d=await api('svc_compare',{q:cq.q,refill:cq.refill});if(my!==cn)return;d.cmp=1;window._fx=d.fx;window._sc=d.site_categories;
      cc.textContent=`মোট ${bn(d.total)}টি${d.total>d.rows.length?' · সবচেয়ে সস্তা '+bn(d.rows.length)+'টি':''}`;box.innerHTML='';d.rows.forEach(r=>box.appendChild(row(r,d)))}
    catch(e){if(!authFail(e))cc.textContent=e.message}};
  $('#cq').oninput=e=>{cq.q=e.target.value;clearTimeout(qt);qt=setTimeout(go,500)};
  $('#cr').onclick=e=>{cq.refill=!cq.refill;e.currentTarget.setAttribute('aria-pressed',cq.refill);go()};
  go()}

/* ---------- পরিবর্তন ধরা + সাপ্তাহিক অটো ---------- */
async function chg(){
  cur=null;$('#title').textContent='পরিবর্তন';$('#back').hidden=true;const el=$('#main');el.innerHTML=nav('chg')+'<div class="sk"></div>';
  try{const d=await api('svc_changes'),a=d.auto||{},T={rm:'বাদ',up:'দাম ↑',down:'দাম ↓','new':'নতুন'};
    el.innerHTML=nav('chg')+`<div class="card"><b>অটো-সংগ্রহ: সপ্তাহে ২ বার</b><div class="sub">${a.on===null?'অবস্থা জানা যায়নি':a.on?'চালু':'বন্ধ'}${a.last?' · শেষ: '+esc(a.last):''}</div><div class="sub">প্রতি ৩.৫ দিনে নতুন করে ডাউনলোড; বাকি সময় সবকিছু ডাউনলোড করা সার্ভিস থেকেই আসে, প্রভাইডারের API কল হয় না।</div><button class="sm" id="au" style="margin-top:8px">${a.on?'বন্ধ করুন':'চালু করুন'}</button></div>`+
    (d.providers.length?d.providers.map(p=>`<div class="card"><b>${esc(p.provider)}</b> <span class="sub">${esc(p.at)}</span><div class="sub">বাদ ${bn(p.c.rm)} · দাম↑ ${bn(p.c.up)} · দাম↓ ${bn(p.c.down)} · নতুন ${bn(p.c.nw)}</div>${p.live_rm||p.live_up?`<div class="sub hi">⚠ চালু সার্ভিসে: বাদ ${bn(p.live_rm)}, দাম↑ ${bn(p.live_up)}</div>`:''}<details><summary>বিস্তারিত</summary>${p.items.map(i=>`<div class="sub ${i.live?'hi':''}">${i.live?'● ':''}<b>${T[i.t]}</b> ${esc(i.id)} · ${esc(i.nm)}${i.t==='up'||i.t==='down'?` · ${i.o} → ${i.n}`:i.t==='new'?` · ${i.n}`:''}</div>`).join('')}</details></div>`).join(''):'<div class="card empty">তুলনার ডেটা নেই — একই প্রভাইডার দুইবার সংগ্রহ করলে পরিবর্তন দেখা যাবে</div>');
    $('#au').onclick=async e=>{e.target.disabled=true;try{await api('svc_auto',{on:!a.on});toast('হয়েছে');chg()}catch(x){if(!authFail(x))toast(x.message);e.target.disabled=false}}
  }catch(e){if(!authFail(e))el.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p></div>`}}

/* ---------- নাম সাজান (সাইটের নিজস্ব ছাঁচে) ---------- */
async function tidy(){
  cur=null;$('#title').textContent='নাম সাজান';$('#back').hidden=true;const el=$('#main');
  el.innerHTML=nav('tidy')+`<div class="card"><b>নামের ছাঁচ</b><div class="sub">ধরন – কোয়ালিটি · দেশ · ড্রপ · রিফিল · স্পিড · স্টার্ট · Max</div><div class="sub ok">যেমন: 👥 Followers – 💎 HQ Real · 🛡️ NoDrop · 30 Days Refill · 🚀 50K/D · ⚡Instant · 📈 Max1M</div><div class="sub">ইমুজি চালু/বন্ধ করা যায় — ক্যাটেগরি পাতায় (🙂 বোতাম)।</div><div class="sub">Refill = রিফিল (দিন) · /D = প্রতিদিন · ⚡ = শুরুর সময়</div><div class="sub">ট্যাগ শুধু প্রভাইডারের নিজের নাম/ক্যাটেগরি থেকে নেওয়া হয় — নিজে থেকে কিছু যোগ হয় না। প্রতিটা সার্ভিসের নাম ও ক্যাটেগরি আলাদা ঘরে নিজে এডিট করা যায়।</div><button class="btn" id="tscan" style="margin-top:10px">সাইটের চালু সার্ভিস স্ক্যান করুন</button><p class="sub" id="tprog" role="status"></p></div><div id="tres"></div>`;
  $('#tscan').onclick=async()=>{const b=$('#tscan');b.disabled=true;const R=[];let off=0,tot=1,n=0;
    try{while(off<tot){const d=await api('svc_site_list',{q:'',platform:'',category:'',state:'on',offset:off,limit:100});tot=d.total;if(!d.rows.length)break;
        d.rows.forEach(r=>{n++;const nm=nice(r),ch=!!(nm&&nm!==r.name);R.push({code:r.code,cn:r.name,nn:ch?nm:r.name,category:r.category,oc:r.category,src:r.src,ov:r.ov,on:ch,chg:ch})});
        off+=d.rows.length;$('#tprog').textContent=`স্ক্যান: ${bn(off)}/${bn(tot)}`}
      $('#tprog').textContent=`${bn(n)}টি দেখা হয়েছে — ${bn(R.length)}টির নাম বদলাবে (সব দেখতে 'সব' চাপুন)`;tidyShow(R)}
    catch(e){if(!authFail(e))$('#tprog').textContent=e.message}b.disabled=false}}
function tidyShow(R){const box=$('#tres');let shown=0,view='chg',q='',V=[];
  if(!R.length){box.innerHTML='<div class="card empty">কোনো সার্ভিস পাওয়া যায়নি</div>';return}
  box.innerHTML=`<div class="bar"><button class="btn" id="ta"></button></div><input id="tq" type="search" placeholder="খুঁজুন — নাম, ID, ক্যাটেগরি" aria-label="খুঁজুন"><div class="chips"><button class="chip" id="vchg"></button><button class="chip" id="vall"></button><button class="chip" id="tall">সব বাছুন</button><button class="chip" id="tnone">সব বাদ</button></div><div class="list" id="tl"></div><div id="tm"></div>`;
  const isCh=r=>r.nn!==r.cn||r.category!==r.oc;
  const vis=()=>R.filter(r=>(view==='all'||r.chg||r.dirty)&&(!q||qOK(q,r.code+' '+r.cn+' '+r.nn+' '+r.category)));
  const cnt=()=>{const k=R.filter(r=>r.on&&isCh(r)).length;$('#ta').textContent=`নির্বাচিতগুলো প্রয়োগ করুন (${bn(k)}টি)`;$('#ta').disabled=!k;
    $('#vchg').textContent='বদলাবে '+bn(R.filter(r=>r.chg||r.dirty).length);$('#vall').textContent='সব '+bn(R.length);$('#vchg').setAttribute('aria-pressed',view==='chg');$('#vall').setAttribute('aria-pressed',view==='all')};
  const more=()=>{V.slice(shown,shown+100).forEach(r=>{const l=document.createElement('div');l.className='card tdy';
      l.innerHTML=`<input type="checkbox" class="sel" aria-label="প্রয়োগ করুন" ${r.on?'checked':''}><div><div class="sub">ID ${esc(r.code)}${r.cn!==r.nn?' · আগের: '+esc(r.cn):''}</div><input class="tn" value="${esc(r.nn)}" maxlength="120" aria-label="নাম"><input class="tc" value="${esc(r.category)}" maxlength="80" aria-label="ক্যাটেগরি"></div>`;
      const ck=l.querySelector('.sel'),ed=()=>{r.dirty=true;r.on=true;ck.checked=true;cnt()};
      ck.onchange=()=>{r.on=ck.checked;cnt()};l.querySelector('.tn').oninput=e=>{r.nn=e.target.value;ed()};l.querySelector('.tc').oninput=e=>{r.category=e.target.value;ed()};$('#tl').appendChild(l)});
    shown=Math.min(V.length,shown+100);$('#tm').innerHTML=shown<V.length?`<button class="sm" id="tmb" style="width:100%;margin-top:8px">আরও দেখান (${bn(V.length-shown)}টি বাকি)</button>`:'';const m=$('#tmb');if(m)m.onclick=more};
  const draw=()=>{V=vis();$('#tl').innerHTML='';shown=0;more();cnt()};
  $('#tq').oninput=e=>{q=e.target.value.trim().toLowerCase();draw()};
  $('#vchg').onclick=()=>{view='chg';draw()};$('#vall').onclick=()=>{view='all';draw()};
  $('#tall').onclick=()=>{V.forEach(r=>r.on=true);draw()};$('#tnone').onclick=()=>{V.forEach(r=>r.on=false);draw()};
  draw();
  $('#ta').onclick=async()=>{const it=R.filter(r=>r.on&&isCh(r));if(!it.length||busy||!confirm(bn(it.length)+'টি সার্ভিসের নাম/ক্যাটেগরি বদলানো হবে?'))return;busy=true;$('#ta').disabled=true;
    try{const need=it.filter(r=>r.src==='static'&&!r.ov).map(r=>r.code);let i=0;
      for(const c of chunks(need,200)){$('#tprog').textContent='প্রস্তুত হচ্ছে… '+bn(Math.min(need.length,(++i)*200))+'/'+bn(need.length);await api('svc_site_bulk',{codes:c})}
      let done=0,k=0;for(const c of chunks(it.map(r=>({code:r.code,name:(r.nn||'').trim()||r.cn,cat:(r.category||'').trim()||r.oc})),300)){$('#tprog').textContent='বসানো হচ্ছে… '+bn(Math.min(it.length,(++k)*300))+'/'+bn(it.length);const x=await api('svc_tidy_apply',{items:c});done+=x.done}
      toast(bn(done)+'টি সার্ভিস আপডেট হয়েছে ✔');busy=false;tidy()}
    catch(e){busy=false;if(!authFail(e))toast(e.message);$('#ta').disabled=false}}}

/* ---------- লোগো (সাইটের নিজস্ব SVG) ---------- */
const SL={"facebook": "<circle cx=\"12\" cy=\"12\" r=\"12\" fill=\"#1877F2\"/><path fill=\"#fff\" d=\"M16.67 15.47l.53-3.47h-3.33V9.75c0-.95.47-1.88 1.96-1.88h1.51V4.92s-1.37-.23-2.69-.23c-2.74 0-4.53 1.66-4.53 4.67V12H7.08v3.47h3.05v8.39a12.1 12.1 0 0 0 3.75 0v-8.39z\"/>", "twitter": "<rect x=\"0.5\" y=\"0.5\" width=\"23\" height=\"23\" rx=\"6.5\" fill=\"#000\"/><path fill=\"#fff\" d=\"M17.5 6.2h2.2l-4.8 5.5 5.6 7.4h-4.4l-3.4-4.5-3.9 4.5H6.6l5.1-5.9L6.3 6.2h4.5l3.1 4.1 3.6-4.1zm-.77 11.6h1.2L9.34 7.53H8.05l8.68 10.27z\"/>", "tiktok": "<path fill=\"currentColor\" d=\"M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z\"/>", "telegram": "<circle cx=\"12\" cy=\"12\" r=\"12\" fill=\"#26A5E4\"/><path fill=\"#fff\" d=\"M16.906 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z\"/>", "instagram": "<rect x=\"0.5\" y=\"0.5\" width=\"23\" height=\"23\" rx=\"6.5\" fill=\"url(#pfIgGrad)\"/><circle cx=\"12\" cy=\"12\" r=\"5\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2\"/><circle cx=\"18\" cy=\"6\" r=\"1.35\" fill=\"#fff\"/>", "youtube": "<rect x=\"0\" y=\"3.5\" width=\"24\" height=\"17\" rx=\"5\" fill=\"#FF0000\"/><path fill=\"#fff\" d=\"M9.8 8.6v6.8l5.9-3.4z\"/>", "whatsapp": "<circle cx=\"12\" cy=\"12\" r=\"12\" fill=\"#25D366\"/><path fill=\"#fff\" transform=\"translate(4.8 4.8) scale(.6)\" d=\"M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z\"/>"};
const BR={spotify:'#1DB954',linkedin:'#0A66C2',snapchat:'#E6B800',pinterest:'#E60023',discord:'#5865F2',twitch:'#9146FF',threads:'#000',shopee:'#EE4D2D',reddit:'#FF4500',soundcloud:'#F50',website:'#4F46E5',other:'#6B7280'};
document.body.insertAdjacentHTML('beforeend','<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="pfIgGrad" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FEDA75"/><stop offset=".3" stop-color="#FA7E1E"/><stop offset=".55" stop-color="#D62976"/><stop offset=".8" stop-color="#962FBF"/><stop offset="1" stop-color="#4F5BD5"/></linearGradient></defs></svg>');
function logo(label,sz){const k=String(label||'').toLowerCase().replace(/[^a-z]/g,''),key=/twitter|^x$/.test(k)?'twitter':k,s=sz||44;
  if(SL[key])return `<svg class="lg" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${SL[key]}</svg>`;
  const bg=BR[key]||('hsl('+(([...k].reduce((a,c)=>a+c.charCodeAt(0),0)*47)%360)+',55%,42%)');
  return `<svg class="lg" width="${s}" height="${s}" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="${bg}"/><text x="16" y="21.5" text-anchor="middle" font-size="15" font-weight="700" fill="#fff" font-family="Inter,sans-serif">${esc(String(label||'?').trim().charAt(0).toUpperCase())}</text></svg>`}
const ALLSVG='<svg class="lg" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M4 6.5h16M4 12h16M4 17.5h16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
/* জনপ্রিয় প্ল্যাটফর্ম হাইলাইটে, বাকিগুলো ড্রপডাউনে */
const POP=['facebook','instagram','tiktok','twitter','telegram','whatsapp','youtube'];
const platKey=l=>{const k=String(l||'').toLowerCase().replace(/[^a-z]/g,'');return /^(x|twitter|twitterx|xtwitter)$/.test(k)?'twitter':/^insta/.test(k)?'instagram':k==='fb'?'facebook':k==='tg'?'telegram':k==='yt'?'youtube':k};
const isPop=l=>POP.indexOf(platKey(l))>=0;
const popSort=list=>list.filter(p=>isPop(p.label)).sort((a,b)=>POP.indexOf(platKey(a.label))-POP.indexOf(platKey(b.label)));
function platMatch(label,c){const k=platKey(label),e=PLAT.find(p=>p[0]===k);
  if(k==='other')return !PLAT.slice(0,7).some(p=>p[1].test(c));
  return e?e[1].test(c):String(c).toLowerCase().indexOf(String(label).toLowerCase())>=0}
function tiles(list,act){const pop=popSort(list),rest=list.filter(p=>!isPop(p.label)),tot=list.reduce((a,p)=>a+p.n,0),ra=rest.some(p=>p.label===act);
  return `<div class="ptiles" role="group" aria-label="প্ল্যাটফর্ম"><button class="ptile" data-pl="" aria-pressed="${!act}" aria-label="সব" title="সব">${ALLSVG}<i>${bn(tot)}</i></button>`+pop.map(p=>`<button class="ptile" data-pl="${esc(p.label)}" aria-pressed="${act===p.label}" aria-label="${esc(p.label)}" title="${esc(p.label)}">${logo(p.label,32)}<i>${bn(p.n)}</i></button>`).join('')+'</div>'+
  (rest.length?`<select class="plmore${ra?' act':''}" data-plsel aria-label="আরও প্ল্যাটফর্ম"><option value="">আরও প্ল্যাটফর্ম (${bn(rest.length)}টি) ▾</option>${rest.map(p=>`<option value="${esc(p.label)}"${act===p.label?' selected':''}>${esc(p.label)} (${bn(p.n)})</option>`).join('')}</select>`:'')}
function bindTiles(root,fn){root.querySelectorAll('[data-pl]').forEach(b=>b.onclick=()=>fn(b.dataset.pl));const x=root.querySelector('[data-plsel]');if(x)x.onchange=()=>{if(x.value)fn(x.value)}}

/* ক্যাটেগরির ধরন (লাইক, ফলোয়ার, ভিউ…) পাশাপাশি + ধরন অনুযায়ী ক্যাটেগরি-চিপ */
const TYPES=[['watch','ওয়াচ টাইম',/watch ?time|watchtime|retention|\bhours\b/i],['subs','সাবস্ক্রাইবার',/subscriber|\bsubs\b/i],['mem','মেম্বার',/member|\bjoin/i],['com','কমেন্ট',/comment|repl(y|ies)/i],['shr','শেয়ার',/share|repost|retweet|forward/i],['sav','সেভ',/\bsaves?\b|bookmark/i],['live','লাইভ',/\blive\b/i],['vote','ভোট',/\bvotes?\b|\bpolls?\b/i],['like','লাইক',/like|react|heart|\blove\b/i],['view','ভিউ',/view|\bplays?\b|stream|impression|reach|listen|visit/i],['fol','ফলোয়ার',/follow|friend|connection|fans?\b/i]];
const TORD=['fol','like','view','com','shr','subs','mem','watch','sav','live','vote','oth'];
const TLBL={oth:'অন্যান্য'};TYPES.forEach(t=>TLBL[t[0]]=t[1]);
const typeOf=c=>{c=String(c||'');const t=TYPES.find(x=>x[2].test(c));return t?t[0]:'oth'};
function catUI(cats,S){
  const tc={};cats.forEach(x=>{const k=typeOf(x.c);tc[k]=(tc[k]||0)+(x.n||1)});
  const list=cats.filter(x=>!S.type||typeOf(x.c)===S.type).sort((a,b)=>a.c.localeCompare(b.c));
  return `<div class="tchips" role="group" aria-label="ধরন"><button class="chip" data-ty="" aria-pressed="${!S.type}">সব ধরন</button>${TORD.filter(k=>tc[k]).map(k=>`<button class="chip" data-ty="${k}" aria-pressed="${S.type===k}">${TLBL[k]} <small>${bn(tc[k])}</small></button>`).join('')}</div>`+
  (S.type||S.cat?`<div class="cchips" role="group" aria-label="ক্যাটেগরি"><button class="chip cc" data-cc="" aria-pressed="${!S.cat}">সব ${esc(TLBL[S.type]||'')}</button>${list.map(x=>`<button class="chip cc" data-cc="${esc(x.c)}" aria-pressed="${S.cat===x.c}">${esc(x.c)}${x.n?` <small>${bn(x.n)}</small>`:''}</button>`).join('')}</div>`:'<p class="sub">উপরে একটা ধরন বাছুন — ওই ধরনের সব ক্যাটেগরি পাশাপাশি আসবে।</p>')}
function bindCat(root,S,fn){
  root.querySelectorAll('[data-ty]').forEach(b=>b.onclick=()=>{S.type=b.dataset.ty;S.cat='';fn()});
  root.querySelectorAll('[data-cc]').forEach(b=>b.onclick=()=>{S.cat=b.dataset.cc;if(S.cat)S.type=typeOf(S.cat);fn()})}
const catsFor=(o,pl)=>Object.keys(o||{}).filter(c=>!pl||platMatch(pl,c)).map(c=>({c,n:o[c]}));
/* ধরন বাছা থাকলে সার্ভার থেকে পাতা পাতা করে এনে ক্লায়েন্টে ছেঁকে নেয় */
async function pageRows(act,base,off,lim,type){let rows=[],raw=off,d;const L=type?100:lim;
  for(let i=0;i<8;i++){d=await api(act,Object.assign({},base,{offset:raw,limit:L}));raw+=d.rows.length;rows=rows.concat(type?d.rows.filter(r=>typeOf(r.category)===type):d.rows);if(!type||rows.length>=lim||raw>=d.total||!d.rows.length)break}
  d.rows=rows;d.next=raw;return d}

/* ---------- সাইটের নিজস্ব নামের ছাঁচ ----------
   নাম = "ধরন – কোয়ালিটি · দেশ · ড্রপ · রিফিল · স্পিড · স্টার্ট · Max" (প্ল্যাটফর্ম ক্যাটেগরিতেই থাকে, তাই নামে নেই)
   সব ট্যাগ শুধু প্রভাইডারের নিজের নাম/ক্যাটেগরি/ফিল্ড থেকে নেওয়া — নিজে থেকে কিছু বানানো হয় না। */
const NP=[['Instagram',/insta(?!nt)|\big\b/i],['Facebook',/facebook|\bfb\b/i],['TikTok',/tik.?tok/i],['YouTube',/youtube|\byt\b/i],['Telegram',/telegram|\btg\b/i],['Twitter / X',/twitter|\bx\b|tweet/i],['WhatsApp',/whatsapp/i],['Threads',/threads/i],['Spotify',/spotify/i],['LinkedIn',/linkedin/i],['Snapchat',/snap/i],['Pinterest',/pinterest/i],['Discord',/discord/i],['Twitch',/twitch/i],['Website Traffic',/traffic|website|web ?visit/i]];
const NT=[['Story Reactions',/stor(y|ies).{0,14}(react|like|heart|emoji)/i],['Story Comments',/stor(y|ies).{0,14}comment/i],['Story Views',/stor(y|ies)/i],['Live Likes',/live.{0,14}(like|heart)/i],['Live Comments',/live.{0,14}(comment|chat)/i],['Live Views',/live.?stream|\blive\b|\bpk\b/i],['Watch Time',/watch.?(time|hour)|\d+\s*k\s*min/i],['Subscribers',/subscri/i],['Poll Votes',/\bpolls?\b|\bvotes?\b/i],['Bot Starts',/\bbot\b.{0,6}\bstarts?\b|\bstarts?\b.{0,6}\bbot\b/i],['Event Responses',/\bevent\b.{0,12}(join|going|respon|rsvp|interest)|\b(going|rsvp)\b/i],['Friend Requests',/friend.?requests?/i],['Reports',/\breports?\b/i],['Engagement Package',/\bpackage\b|\b(views?|likes?|comments?|shares?|saves?)\s*\+\s*(views?|likes?|comments?|shares?|saves?)\b|(\d+\+?\s*(likes?|retweets?|shares?|comments?|views?)\b.{0,25}){2,}/i],['Emoji Comments',/emoji.{0,12}comment|comment.{0,6}emoji/i],['Downloads',/downloads?\b/i],['Clicks',/\bclicks?\b/i],['Tweet Stats',/statistic|detail.?expand/i],['Stars',/\bstars?\b/i],['Page Reviews',/\breviews?\b|\bratings?\b|recommendations?\b/i],['Comment Reactions',/comment.{0,8}react/i],['Comment Likes',/comment.{0,8}(like|heart)|(like|heart).{0,8}comment/i],['Page Likes & Followers',/page.{0,10}likes?.{0,12}follow/i],['Page Likes',/page.{0,10}likes?\b|likes?.{0,10}\bpage\b/i],['Members',/member|joiner|\bjoins?\b/i],['Comments',/comment/i],['Shares',/share|repost|retweet|\bquotes?\b/i],['Saves',/\bsaves?\b|bookmark/i],['Reactions',/react|emoji|emotion|\blove\b|\bhaha\b|\bwow\b|\bangry\b|\bsad\b/i],['Likes',/\blikes?\b|\bhearts?\b/i],['Profile Visits',/profile.{0,4}visit/i],['Views',/views?\b|impression|\breach\b|\bplays?\b|stream|listen/i],['Followers',/follow(?!ing)|\bfans?\b/i],['Traffic',/traffic|\bvisit/i]];
/* সার্ভিসের ধরন: নামে যে ধরনের শব্দ আগে আসে সেটাই (সমান জায়গায় হলে তালিকার ক্রম) — 'Followers [with Stories]' Story Views হয় না */
const NT_FB=[['Followers',/profile.?\/?.?page|page.?\/?.?profile|professional mode/i]];
const pickEarliest=(L,t)=>{t=nk(t);let best=null,bi=1e9;for(const x of L){const m=x[1].exec(t);if(m&&m.index<bi){best=x;bi=m.index}}return best};
const pick=(L,t)=>{t=nk(t);return L.find(x=>x[1].test(t))};
const CTRY={usa:'USA',uk:'UK',india:'India',indian:'India',bangladesh:'BD',bd:'BD',turkey:'Turkey',turkish:'Turkey',brazil:'Brazil',brazilian:'Brazil',arab:'Arab',arabic:'Arab',indonesia:'Indonesia',pakistan:'Pakistan',russia:'Russia',germany:'Germany',france:'France',spain:'Spain',italy:'Italy',global:'Worldwide',worldwide:'Worldwide'};
const kfmt=n=>n>=1e6?(+(n/1e6).toFixed(2))+'M':n>=1e3?(+(n/1e3).toFixed(1))+'K':String(n);

/* ---------- ইমুজি দিয়ে সাজানো (চালু/বন্ধ: pb_emo) ---------- */
const emoOn=()=>ls.get('pb_emo')!=='0';
const PE={'Instagram':'📸','Facebook':'📘','TikTok':'🎵','YouTube':'▶️','Telegram':'✈️','Twitter / X':'🐦','WhatsApp':'💬','Threads':'🧵','Spotify':'🎧','LinkedIn':'💼','Snapchat':'👻','Pinterest':'📌','Discord':'🎮','Twitch':'🟣','Website Traffic':'🌐'};
const TE={'Followers':'👥','Likes':'❤️','Views':'👁️','Story Views':'📖','Live Views':'🔴','Watch Time':'⏱️','Subscribers':'🔔','Members':'🙋','Comments':'💬','Shares':'🔁','Saves':'🔖','Reactions':'😍','Emoji Comments':'🙂','Downloads':'⬇️','Clicks':'👆','Tweet Stats':'📊','Stars':'⭐','Friend Requests':'🤝','Reports':'🚩','Engagement Package':'📦','Page Likes & Followers':'👍','Live Likes':'🔴','Live Comments':'🔴','Story Reactions':'📖','Story Comments':'📖','Traffic':'🚦','Poll Votes':'🗳️','Bot Starts':'🤖','Event Responses':'🎟️','Page Reviews':'⭐','Comment Likes':'👍','Comment Reactions':'😍','Page Likes':'👍','Profile Visits':'🚶','Custom Comments':'✍️','Random Comments':'🎲'};
const FLAG={USA:'🇺🇸',UK:'🇬🇧',India:'🇮🇳',BD:'🇧🇩',Turkey:'🇹🇷',Brazil:'🇧🇷',Arab:'🇸🇦',Indonesia:'🇮🇩',Pakistan:'🇵🇰',Russia:'🇷🇺',Germany:'🇩🇪',France:'🇫🇷',Spain:'🇪🇸',Italy:'🇮🇹',Worldwide:'🌍'};
const TAGE=[[/^HQ Real$/,'💎'],[/^HQ$/,'💎'],[/^Premium$/,'👑'],[/^Real$/,'✅'],[/^Mix$/,'🎲'],[/^LowQ$/,'🔻'],[/^(NoDrop|LowDrop|\d+%Drop)$/,'🛡️'],[/^[\d.]+[KM]?(-[\d.]+[KM]?)?\/(D|Hr)$/,'🚀'],[/^Max/,'📈'],[/^Fast$/,'⏩'],[/^Slow$/,'🐢']];
const emTag=t=>{if(t==='Refill')return 'Refill';if(t==='NoRefill')return 'No Refill';if(FLAG[t])return FLAG[t]+' '+t;const x=TAGE.find(a=>a[0].test(t));return x?x[1]+' '+t:t};
const stripEmo=s=>String(s==null?'':s).replace(/^[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D\u20E3\s]+/u,'').trim();
/* ক্যাটেগরির নাম: প্ল্যাটফর্মের ইমুজি + নাম (আগের ইমুজি সরিয়ে একবারই বসে — বারবার চালালে একই থাকে) */
function catNice(cat){const c=stripEmo(cat);if(!c||!emoOn())return c;const P=pick(NP,c),T=pick(NT,c),e=P?PE[P[0]]:(T?TE[T[0]]:'📦');return (e+' '+c).substring(0,80)}
const RF_NEG=/\b(no|non|without)[\s\-]?refill\b/i,RF_NEGG=/\b(no|non|without)[\s\-]?refill\b/ig,RF_POS=/refill|♻|lifetime|\blt\b|\br\d{2,3}\b/i;
function refState(n,c,flag){for(const t of [n,c]){const s=nk(t);if(RF_NEG.test(s))return 'no';if(RF_POS.test(s.replace(RF_NEGG,' ')))return 'yes'}return flag===true?'yes':flag===false?'no':null}
/* দেশ চেনা: শব্দ + পতাকা-ইমুজি; একটা হলে পতাকাসহ, ২–৩টা হলে 'USA/Canada', বেশি হলে Worldwide */
const CW={usa:'USA','united states':'USA',american:'USA',america:'USA',uk:'UK','united kingdom':'UK',british:'UK',england:'UK',canada:'Canada',canadian:'Canada',australia:'Australia',australian:'Australia',india:'India',indian:'India',bangladesh:'BD',bangladeshi:'BD',bd:'BD',pakistan:'Pakistan',pakistani:'Pakistan',nepal:'Nepal',srilanka:'Sri Lanka','sri lanka':'Sri Lanka',turkey:'Turkey',turkish:'Turkey',brazil:'Brazil',brazilian:'Brazil',mexico:'Mexico',mexican:'Mexico',argentina:'Argentina',colombia:'Colombia',spain:'Spain',spanish:'Spain',france:'France',french:'France',germany:'Germany',german:'Germany',italy:'Italy',italian:'Italy',netherlands:'Netherlands',dutch:'Netherlands',poland:'Poland',polish:'Poland',russia:'Russia',russian:'Russia',ukraine:'Ukraine',egypt:'Egypt',egyptian:'Egypt',uae:'UAE',bae:'UAE',emirates:'UAE',saudi:'Saudi',israel:'Israel',israeli:'Israel',iran:'Iran',iranian:'Iran',iraq:'Iraq',indonesia:'Indonesia',indonesian:'Indonesia',malaysia:'Malaysia',thailand:'Thailand',thai:'Thailand',vietnam:'Vietnam',vietnamese:'Vietnam',philippines:'Philippines',filipino:'Philippines',japan:'Japan',japanese:'Japan',korea:'Korea',korean:'Korea',china:'China',chinese:'China',nigeria:'Nigeria',nigerian:'Nigeria','south africa':'South Africa',europe:'Europe',european:'Europe',asia:'Asia',asian:'Asia',arab:'Arab',arabic:'Arab',africa:'Africa',african:'Africa'};
const ISO={US:'USA',GB:'UK',CA:'Canada',AU:'Australia',IN:'India',BD:'BD',PK:'Pakistan',NP:'Nepal',LK:'Sri Lanka',TR:'Turkey',BR:'Brazil',MX:'Mexico',AR:'Argentina',CO:'Colombia',ES:'Spain',FR:'France',DE:'Germany',IT:'Italy',NL:'Netherlands',PL:'Poland',RU:'Russia',UA:'Ukraine',EG:'Egypt',AE:'UAE',SA:'Saudi',IL:'Israel',IR:'Iran',IQ:'Iraq',ID:'Indonesia',MY:'Malaysia',TH:'Thailand',VN:'Vietnam',PH:'Philippines',JP:'Japan',KR:'Korea',CN:'China',NG:'Nigeria',ZA:'South Africa'};
Object.assign(FLAG,{Canada:'🇨🇦',Australia:'🇦🇺',Nepal:'🇳🇵','Sri Lanka':'🇱🇰',Mexico:'🇲🇽',Argentina:'🇦🇷',Colombia:'🇨🇴',Netherlands:'🇳🇱',Poland:'🇵🇱',Ukraine:'🇺🇦',Egypt:'🇪🇬',UAE:'🇦🇪',Saudi:'🇸🇦',Israel:'🇮🇱',Iran:'🇮🇷',Iraq:'🇮🇶',Malaysia:'🇲🇾',Thailand:'🇹🇭',Vietnam:'🇻🇳',Philippines:'🇵🇭',Japan:'🇯🇵',Korea:'🇰🇷',China:'🇨🇳',Nigeria:'🇳🇬','South Africa':'🇿🇦',Europe:'🇪🇺',Asia:'🌏',Africa:'🌍'});
/* আরও দেশ: নাম + ISO কোড; পতাকা কোড থেকেই বানানো হয় */
const flagOf=c=>String.fromCodePoint(...[...c].map(x=>0x1F1E6+x.charCodeAt(0)-65));
[['Sweden','SE'],['Norway','NO'],['Denmark','DK'],['Finland','FI'],['Ireland','IE'],['Portugal','PT'],['Greece','GR'],['Romania','RO'],['Czech','CZ'],['Hungary','HU'],['Switzerland','CH'],['Austria','AT'],['Belgium','BE'],['Kazakhstan','KZ'],['Uzbekistan','UZ'],['Azerbaijan','AZ'],['Morocco','MA'],['Algeria','DZ'],['Tunisia','TN'],['Kuwait','KW'],['Qatar','QA'],['Jordan','JO'],['Lebanon','LB'],['Oman','OM'],['Kenya','KE'],['Ghana','GH'],['Singapore','SG'],['Taiwan','TW'],['Peru','PE'],['Chile','CL'],['Venezuela','VE'],['Afghanistan','AF'],['Myanmar','MM'],['Cambodia','KH'],['New Zealand','NZ'],['Hong Kong','HK'],['Serbia','RS'],['Bulgaria','BG']].forEach(([n,c])=>{CW[n.toLowerCase()]=n;ISO[c]=n;FLAG[n]=flagOf(c)});
const CWRE=new RegExp('\\b('+Object.keys(CW).sort((a,b)=>b.length-a.length).join('|')+')\\b','gi');
function ctryTags(t){const f=[],add=x=>{if(x&&!f.includes(x))f.push(x)};
  (String(t).match(/[\u{1F1E6}-\u{1F1FF}]{2}/gu)||[]).forEach(e=>add(ISO[String.fromCharCode(...[...e].map(c=>c.codePointAt(0)-0x1F1E6+65))]));
  (String(t).match(CWRE)||[]).forEach(w=>add(CW[w.toLowerCase()]));
  const wide=/\bworld.?wide\b|\bglobal\b|all countries|\bmix(ed)? countr/i.test(t);
  if(f.length>1&&f.includes('Arab'))f.splice(f.indexOf('Arab'),1);
  if(!f.length)return wide?['Worldwide']:[];
  if(f.length===1)return f;if(f.length>3||wide)return['Worldwide'];
  const m=f.join('/');FLAG[m]='🌍';return[m]}
/* স্মার্ট সার্চ: বোল্ড/ফুলউইডথ অক্ষর সাধারণ করে খোঁজে; 🇧🇩 = Bangladesh = BD = Bangladeshi সব এক;
   real/organic, hq/high quality, non-drop/nodrop/no drop ইত্যাদি সমার্থকও মেলে। একাধিক শব্দ দিলে সবগুলো থাকতে হবে। */
const SYNW=[['real','organic','authentic','genuine'],['hq','high quality','highquality'],['nodrop','non drop','no drop','nondrop','zero drop'],['norefill','no refill','non refill','norefill'],['instant','instantly'],['cheap','cheapest'],['views','view'],['likes','like'],['followers','follower','follow'],['comments','comment'],['subscribers','subscriber','subs'],['members','member'],['reactions','reaction','react'],['shares','share']];
const ALIAS={},FLAGRE=/[\u{1F1E6}-\u{1F1FF}]{2}/gu;
(function(){const put=g=>{const a=[...new Set(g.map(x=>x.toLowerCase()))];a.forEach(x=>{ALIAS[x]=(ALIAS[x]||[]).concat(a)})};
  SYNW.forEach(put);
  const by={};Object.keys(CW).forEach(k=>{(by[CW[k]]=by[CW[k]]||[]).push(k)});
  Object.keys(ISO).forEach(c=>{const d=ISO[c];(by[d]=by[d]||[]).push(c.toLowerCase(),flagOf(c))});
  Object.keys(by).forEach(d=>put(by[d].concat([d.toLowerCase()])));
  /* বিশেষ: BD / Bangla */
  put(['bd','bangladesh','bangladeshi','bangla','bengali','🇧🇩']);

  /* আরও দেশের নাম ↔ পতাকা (শুধু সার্চের জন্য) + চালু নামের বিকল্প বানান */
  [['Albania','AL'],['Armenia','AM'],['Bahrain','BH'],['Belarus','BY'],['Bolivia','BO'],['Bosnia','BA'],['Botswana','BW'],['Brunei','BN'],['Costa Rica','CR'],['Croatia','HR'],['Cuba','CU'],['Cyprus','CY'],['Dominican','DO'],['Ecuador','EC'],['El Salvador','SV'],['Estonia','EE'],['Ethiopia','ET'],['Georgia','GE'],['Guatemala','GT'],['Honduras','HN'],['Iceland','IS'],['Jamaica','JM'],['Kyrgyzstan','KG'],['Laos','LA'],['Latvia','LV'],['Libya','LY'],['Lithuania','LT'],['Luxembourg','LU'],['Macedonia','MK'],['Maldives','MV'],['Malta','MT'],['Mongolia','MN'],['Mozambique','MZ'],['Namibia','NA'],['Nicaragua','NI'],['Palestine','PS'],['Panama','PA'],['Paraguay','PY'],['Senegal','SN'],['Slovakia','SK'],['Slovenia','SI'],['Somalia','SO'],['Sudan','SD'],['Syria','SY'],['Tajikistan','TJ'],['Tanzania','TZ'],['Uganda','UG'],['Uruguay','UY'],['Yemen','YE'],['Zambia','ZM'],['Zimbabwe','ZW'],['Bhutan','BT'],['Cameroon','CM'],['Ivory Coast','CI'],['Haiti','HT'],['Bahamas','BS'],['Trinidad','TT'],['Turkmenistan','TM'],['Moldova','MD'],['Montenegro','ME'],['Rwanda','RW'],['Angola','AO'],['Madagascar','MG'],['Mauritius','MU'],['Gambia','GM'],['Mali','ML'],['Chad','TD'],['Congo','CD'],['Gabon','GA'],['Liberia','LR'],['Sierra Leone','SL'],['Togo','TG'],['Benin','BJ'],['Burkina Faso','BF'],['Malawi','MW'],['Fiji','FJ'],['Papua New Guinea','PG']].forEach(([n,c])=>put([n.toLowerCase(),flagOf(c)]));
  put(['arab','arabic','arabian','🇸🇦','🇦🇪','🇪🇬','🇮🇶','🇰🇼','🇶🇦','🇧🇭','🇴🇲','🇯🇴','🇱🇧','🇾🇪','🇸🇾','🇲🇦','🇩🇿','🇹🇳','🇱🇾','🇸🇩','🇵🇸']);
  [['great britain','UK'],['united kingdom','UK'],['south korea','Korea'],['brasil','Brazil'],['turkiye','Turkey'],['indo','Indonesia'],['ksa','Saudi'],['saudi arabia','Saudi'],['united arab emirates','UAE'],['czech republic','Czech'],['czechia','Czech'],['holland','Netherlands'],['philipines','Philippines']].forEach(([k,d])=>{const g=ALIAS[d.toLowerCase()];if(g)put(g.concat([k]))});
  Object.keys(ALIAS).forEach(k=>{ALIAS[k]=[...new Set(ALIAS[k])]})})();
/* সার্চের জন্য সাজানো লেখা: 𝐈𝐧𝐝𝐨𝐧𝐞𝐬𝐢𝐚 / ɪɴᴅᴏɴᴇsɪᴀ / 🅸🅽🅳🅾 / Indönesia / I.N.D.O — সবই সাধারণ indonesia হয়ে যায় */
const SCP={'ᴀ':'a','ʙ':'b','ᴄ':'c','ᴅ':'d','ᴇ':'e','ꜰ':'f','ɢ':'g','ʜ':'h','ɪ':'i','ᴊ':'j','ᴋ':'k','ʟ':'l','ᴍ':'m','ɴ':'n','ᴏ':'o','ᴘ':'p','ǫ':'q','ʀ':'r','ꜱ':'s','ᴛ':'t','ᴜ':'u','ᴠ':'v','ᴡ':'w','ʏ':'y','ᴢ':'z'},SCRE=new RegExp('['+Object.keys(SCP).join('')+']','g');
const fold=t=>{let x=nk(t);const bx=b=>c=>String.fromCharCode(97+c.codePointAt(0)-b);
  x=x.replace(/[\u{1F130}-\u{1F149}]/gu,bx(0x1F130)).replace(/[\u{1F150}-\u{1F169}]/gu,bx(0x1F150)).replace(/[\u{1F170}-\u{1F189}]/gu,bx(0x1F170)).replace(SCRE,c=>SCP[c]);
  try{x=x.normalize('NFD').replace(/[\u0300-\u036f]/g,'')}catch(e){}return x.replace(/[\u00AD\u200B-\u200F\u2060\uFEFF]/g,'')};
let _ph=null;const _qc={};
function qComp(q){q=fold(q).toLowerCase();if(_qc[q])return _qc[q];
  q=q.replace(/\bnon?[\s\-]?drop\b/g,'nodrop').replace(/\bnon?[\s\-]?refill\b/g,'norefill').replace(/\bhigh[\s\-]?quality\b/g,'hq');
  let w=q;const g0=[];(_ph=_ph||Object.keys(ALIAS).filter(k=>/^[a-z0-9]+( [a-z0-9]+)+$/.test(k)).sort((a,b)=>b.length-a.length)).forEach(k=>{const re=new RegExp('(^|[^a-z0-9])'+k.replace(/ /g,'[^a-z0-9]+')+'(?![a-z0-9])');if(re.test(w)){w=w.replace(re,' ');g0.push({t:k,g:ALIAS[k]})}});
  const toks=[],fl=w.match(FLAGRE)||[];
  w.replace(FLAGRE,' ').replace(/[^a-z0-9\s♻]+/g,' ').split(/\s+/).filter(Boolean).forEach(t=>toks.push(t));
  const gs=toks.map(t=>({t,g:ALIAS[t]||null})).concat(g0);
  if(fl.length)gs.push({t:fl[0],g:[...new Set(fl.flatMap(f=>ALIAS[f]||[f]))]}); /* একাধিক পতাকা = যেকোনো একটা */
  const f=text=>{const h=' '+fold(text).toLowerCase().replace(/[^a-z0-9♻\u{1F1E6}-\u{1F1FF}]+/gu,' ')+' ',hs=h.replace(/ /g,'');
    return gs.every(x=>x.g?x.g.some(a=>{const aa=a.replace(/[^a-z0-9♻\u{1F1E6}-\u{1F1FF}]+/gu,' ');return aa.length<=3?h.indexOf(' '+aa+' ')>=0||h.indexOf(aa)>=0&&aa.length>2:h.indexOf(aa)>=0||(aa.length>=5&&hs.indexOf(aa.replace(/ /g,''))>=0)}):h.indexOf(x.t)>=0||(x.t.length>=5&&hs.indexOf(x.t)>=0))};
  return _qc[q]=f}
const qOK=(q,text)=>!String(q||'').trim()||qComp(String(q).trim())(text);
function niceTags(t,flag,max,rf){t=nk(t);const o=[];let m;if(rf===undefined)rf=refState(t,'',flag);
  const hq=/\bhq\b|high.?quality/i.test(t),pr=/premium/i.test(t),real=/\breal\b|organic|authentic/i.test(t);
  if((hq||pr)&&real)o.push('HQ Real');else if(hq)o.push('HQ');else if(pr)o.push('Premium');else if(real)o.push('Real');else if(/\bmix(ed)?\b/i.test(t))o.push('Mix');else if(/low.?quality|\blq\b|lowq|\bbots?\b(?!\s*(start|chat|user))/i.test(t))o.push('LowQ');
  ctryTags(t).forEach(x=>o.push(x));
  if(/non.?drop|no.?drop|\bnd\b|\b0\s*%\s*drop|zero.?drop|drop\W{0,4}0\s*%(?![\d-])/i.test(t))o.push('NoDrop');else if(/low.?drop|less.?drop/i.test(t))o.push('LowDrop');else if(m=t.match(/(\d{1,2})\s*%\s*drop/i)||t.match(/drop\W{0,4}[±~<≤]?\s*(?:\d{1,2}\s*-\s*)?(\d{1,2})\s*%/i))o.push(m[1]+'%Drop');
  if(rf==='no')o.push('NoRefill');
  else if(rf==='yes'){m=t.match(/♻\uFE0F?\s*(\d{2,3})\s*(?:d|days?)\b/i)||t.match(/refill\D{0,12}(\d{2,3})\s*(?:d|days?)\b/i)||t.match(/(\d{2,3})\s*(?:d|days?)\W{0,4}(?:refill|♻|guarant|warrant)/i)||t.match(/(?:refill|♻|guarant|warrant)\w*\W{0,4}(\d{2,3})\b(?!\s*[kKmM%])/i)||t.match(/\br(\d{2,3})\b/i);
    o.push(m?'♻'+m[1]+'D':/lifetime|\blt\b|♻\s*life/i.test(t)?'♻Life':'Refill')}
  m=t.match(/(\d+(?:\.\d+)?\s*[kKmM]?(?:\s*[-–]\s*\d+(?:\.\d+)?\s*[kKmM]?)?)\s*(?:\/|per\s*)\s*(day|d|hour|hr|h)\b/i);
  if(m)o.push(m[1].replace(/\s+/g,'').toUpperCase()+(/^d/i.test(m[2])?'/D':'/Hr'));
  if(/instant/i.test(t))o.push('⚡Instant');
  else if(m=t.match(/(?:start(?:s|ing)?(?:\s*time)?|begins?)\W{0,4}(\d+(?:\s?[-–]\s?\d+)?)\s*(min|hour|hr)/i)||t.match(/⚡\s*(\d+(?:\s?[-–]\s?\d+)?)\s*(min|hour|hr)/i))o.push('⚡'+m[1].replace(/\s+/g,'')+(/^m/i.test(m[2])?'Min':'Hr'));
  else if(m=t.match(/(?:^|[\[(|,;:\s])(\d+(?:\.\d+)?\s?[-–]\s?\d+(?:\.\d+)?)\s*(min(?:ute)?s?|hours?|hrs?)\b(?!\s*(?:\/|per))/i)||t.match(/[\[(]\s*(\d+(?:\.\d+)?)\s*(min(?:ute)?s?|hours?|hrs?)\s*[\])]/i))o.push('⚡'+m[1].replace(/\s+/g,'')+(/^m/i.test(m[2])?'Min':'Hr'));
  else if(/\bfast\b/i.test(t))o.push('Fast');
  if(/\bslow(?:er)?\b/i.test(t)&&!/not\s+slow/i.test(t))o.push('Slow');
  return o}
/* রিয়্যাক্ট সার্ভিস: নামে যেটা আছে (Angry/Love/Like…) সেটাই বসবে; ক্যাটেগরিতে 👍😍😡 একসাথে থাকলে সেটা ধরা হয় না */
const RX=[['Like',/\blikes?\b|👍/i],['Love',/\blove\b|❤|😍|♥/i],['Care',/\bcare\b|🥰|🤗/i],['Haha',/\bha-?ha\b|😆|😂/i],['Wow',/\bwow\b|😮|😲/i],['Sad',/\bsad\b|😢|😭/i],['Angry',/\bangry\b|\banger\b|😡|😠/i]];
const RXE={Like:'👍',Love:'😍',Care:'🥰',Haha:'😆',Wow:'😮',Sad:'😢',Angry:'😡'};Object.keys(RXE).forEach(k=>{TE[k+' Reactions']=RXE[k];TE[k+' Comment Reactions']=RXE[k]});
function rxKind(n,c){const f=s=>RX.filter(x=>x[1].test(s)).map(x=>x[0]);let a=f(n);if(a.length===1)return a[0];if(a.length>1)return null;a=f(c);return a.length===1?a[0]:null}
/* ফেসবুকে নামে Profile / Page থাকলে সেটাও নামে ওঠে (যেমন 'Profile/Page', 'Page') */
function tgtTag(n,P,T){if(!P||P[0]!=='Facebook'||/page|profile/i.test(T[0]))return[];const pr=/\bprofiles?\b/i.test(n),pg=/\bpages?\b/i.test(n);return pr&&pg?['Profile/Page']:pr?['Profile']:pg?['Page']:[]}
/* মিশ্র রিয়্যাক্ট (👍❤️…): নামের আসল ইমোজিগুলোই নামের শুরুতে বসে, জেনারেল 😍 নয় */
const REM=/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*/gu;
const rxEmo=r=>{const g=t=>[...new Set(String(t||'').replace(/[0-9#*]\uFE0F?\u20E3/gu,'').match(REM)||[])];let a=g(r.name);if(!a.length)a=g(r.category);return a.slice(0,6).join('')};
function nameCtx(r){if(!r)return null;const c0=nk(r.category),n0=nk(r.name),all=c0+' '+n0;
  const T0=pickEarliest(NT,n0)||pickEarliest(NT,c0)||pickEarliest(NT_FB,n0)||pickEarliest(NT_FB,c0);if(!T0)return null;const P=T0[0]==='Traffic'?NP.find(x=>x[0]==='Website Traffic'):(pick(NP,c0)||pick(NP,n0));let T=T0;{const k=T0[0];if(k==='Reactions'||k==='Comment Reactions'){const rk=rxKind(n0,c0);if(rk)T=[rk+' '+k]}else if(k==='Comments'){if(/custom|costum/i.test(n0))T=['Custom Comments'];else if(/random|emoji/i.test(n0))T=['Random Comments']}}
  const isRx=T0[0]==='Reactions'||T0[0]==='Comment Reactions',E=isRx?rxEmo(r):'';if(E&&[...E.matchAll(REM)].length>=2)T=T0;
  const flag=r.refill===undefined||r.refill===null||r.refill===''?null:/^(1|true|yes|y)$/i.test(String(r.refill));
  return{base:P&&P[0]==='Website Traffic'?'Traffic':T[0],emo:(T===T0&&isRx)?E:'',plat:P?(P[0]==='Website Traffic'?'Website':P[0]):'',raw:niceTags(all,flag,r.max,refState(n0,c0,flag)).concat(tgtTag(n0,P,T)),key:r.code||r.service_id||n0}}
/* সুন্দর নাম: কাঁচা ট্যাগ (HQ, NoDrop, ♻30D) নয় — পড়ার মতো শব্দ ('Real & High Quality', 'Non-Drop', '30 Days Refill') + প্ল্যাটফর্ম + ৫টা ভিন্ন সাজ */
const TW={'HQ Real':'Real HQ','HQ':'HQ','Premium':'Premium','Real':'Real','Mix':'Mixed','LowQ':'Budget','NoDrop':'Non-Drop','LowDrop':'Low Drop','Worldwide':'Global','NoRefill':'No Refill','Refill':'Refill','Fast':'Fast','Slow':'Slow','⚡Instant':'Instant'};
function tagWord(t){if(TW[t])return TW[t];let m;if(m=t.match(/^(\d+)%Drop$/))return m[1]+'% Drop';if(m=t.match(/^♻(\d+)D$/))return m[1]+'D Refill';if(t==='♻Life')return 'Lifetime Refill';if(m=t.match(/^⚡(.+)Min$/))return m[1]+' Min Start';if(m=t.match(/^⚡(.+)Hr$/))return m[1]+' Hr Start';if(m=t.match(/^(.+)\/D$/))return m[1]+'/Day';if(m=t.match(/^(.+)\/Hr$/))return m[1]+'/Hour';if(m=t.match(/^Max\s*(.+)$/))return 'Max '+m[1];return t}
function nameIdeas(r,plat,em){const C=nameCtx(r);if(!C)return[];if(em===undefined)em=emoOn();
  const W=t=>{const x=TAGE.find(a=>a[0].test(t)),f=FLAG[t];return (em&&f?f+' ':'')+tagWord(t)};
  const isQ=t=>/^(HQ|Premium|Real|Mix|LowQ|Profile|Page$)/.test(t),isD=t=>/Drop$/.test(t),pl=plat||C.plat;
  const isR=t=>/^(♻|Refill|NoRefill)/.test(t);let qa=C.raw.filter(isQ).map(W),ca=C.raw.filter(t=>FLAG[t]).map(W),dr=C.raw.filter(isD).map(W),xr=C.raw.filter(t=>isR(t)&&!isQ(t)&&!FLAG[t]&&!isD(t)).map(W),xl=C.raw.filter(t=>!isR(t)&&!isQ(t)&&!FLAG[t]&&!isD(t)).map(W);
  const he=C.emo||TE[C.base],head=(em&&he?he+' ':'')+(pl?(pl.toLowerCase().indexOf(C.base.toLowerCase())>=0?pl:pl+' '+C.base):C.base),lim=em?72:64;
  const S=[
   (q,c,d,x)=>head+(q.length?' — '+q.join(' · '):'')+([].concat(c,d,x).length?' | '+[].concat(c,d,x).join(' · '):''),
   (q,c,d,x)=>head+(q.length?(' ['+q.join(' · ')+']'):'')+([].concat(c,d,x).length?' '+(em?'✦':'|')+' '+[].concat(c,d,x).join(' '+(em?'✦':'|')+' '):''),
   (q,c,d,x)=>(c.length?c[0]+' ':'')+head+(q.length?(em?' ⭐ ':' – ')+q.join(' · '):'')+([].concat(d,x).length?' | '+[].concat(d,x).join(' · '):''),
   (q,c,d,x)=>head+' • '+[].concat(q,c,d,x).join(' • '),
   (q,c,d,x)=>(d.length?d[0]+' ':'')+head+([].concat(q,c,x).length?' | '+[].concat(q,c,x).join(' | '):'')+(d.length>1?' | '+d.slice(1).join(' | '):'')];
  /* আরও ১০টা ছাঁচ — সব মিলিয়ে ১৫টা, যাতে নাম ঘুরেফিরে এক না হয় */
  const A=(q,c,d,x)=>[].concat(q,c,d,x),J=(a,s)=>a.join(s),P=(pre,a,s)=>a.length?pre+J(a,s):'',sy=(a,b)=>em?a:b;
  S.push(
   (q,c,d,x)=>head+(A(q,c,d,x).length?' ['+J(A(q,c,d,x),' · ')+']':''),
   (q,c,d,x)=>(q.length?q[0]+' ':'')+head+P(' — ',[].concat(c,d,q.slice(1),x),' · '),
   (q,c,d,x)=>head+P(' '+sy('✪','~')+' ',A(q,c,d,x),' '+sy('✪','~')+' '),
   (q,c,d,x)=>(c.length?J(c,' ')+' | ':'')+head+(q.length?' ('+J(q,' · ')+')':'')+P(' | ',[].concat(d,x),' · '),
   (q,c,d,x)=>head+P(' '+sy('➤','>')+' ',q,' · ')+P(' '+sy('➤','>')+' ',[].concat(c,d,x),' · '),
   (q,c,d,x)=>(q.length?'['+J(q,' · ')+'] ':'')+head+P(' | ',[].concat(c,d,x),' · '),
   (q,c,d,x)=>head+P(' '+sy('◆','/')+' ',A(q,c,d,x),' '+sy('◆','/')+' '),
   (q,c,d,x)=>(d.length?d[0]+' ':'')+(c.length?c[0]+' ':'')+head+P(' – ',q,' · ')+P(' | ',[].concat(d.slice(1),c.slice(1),x),' · '),
   (q,c,d,x)=>head+P(' (',[].concat(q,c),' · ')+(q.length||c.length?')':'')+P(' — ',[].concat(d,x),' · '),
   (q,c,d,x)=>head+P(' | ',x,' · ')+P(' | ',[].concat(q,c,d),' · '));
  const seen={},out=[];
  S.forEach(f=>{let q=qa.slice(),c=ca.slice(),d=dr.slice(),a=xr.slice(),l=xl.slice(),n=f(q,c,d,a.concat(l));
    /* লম্বা হলে আগে স্পিড/Instant/Max, তারপর দেশ, তারপর কোয়ালিটি — রিফিল ও ড্রপ সবার শেষে বাদ যায় */
    while(n.length>lim&&(l.length||c.length||q.length||d.length||a.length)){if(l.length)l.pop();else if(c.length)c.pop();else if(q.length)q.pop();else if(d.length)d.pop();else a.pop();n=f(q,c,d,a.concat(l))}
    n=n.substring(0,120);if(!seen[n]){seen[n]=1;out.push(n)}});
  return out}
function nice(r){const C=nameCtx(r);if(!C)return null;const a=nameIdeas(r);return a.length?a[hsh(C.key)%a.length]:null}
let NGR=null;
function ngDraw(){const box=$('#shNg');if(!box||!NGR)return;const a=nameIdeas(NGR,PLB[$('#shPlat').value]||'');
  box.innerHTML=a.length?'<div class="sub">নাম প্রস্তাব (ট্যাপ করুন)</div><div class="csgc">'+a.map(x=>`<button type="button" class="chip cs" data-n="${esc(x)}">${esc(x)}</button>`).join('')+'</div>':'';
  box.querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>{$('#shName').value=b.dataset.n})}
/* নামের ৫টা ভিন্ন ছাঁচ — সার্ভিস-আইডির হ্যাশ থেকে বাছা হয়, তাই একই সার্ভিসে বারবার একই নাম আসে কিন্তু তালিকা একঘেয়ে হয় না */
const hsh=x=>{x=String(x);let h=0;for(let i=0;i<x.length;i++)h=(h*31+x.charCodeAt(i))>>>0;return h};
function layout(v,pre,base,raw,em){const t=raw.map(x=>em?emTag(x):x),q=raw.findIndex(x=>/^(HQ|Premium|Real|Mix|LowQ)/.test(x)),c=raw.findIndex(x=>FLAG[x]),ex=i=>t.filter((_,k)=>k!==i),J=a=>a.join(' · ');
  if(!t.length)return pre+base;
  if(v===1){const h=[q,c].filter(i=>i>=0).map(i=>t[i]).join(' '),rs=t.filter((_,k)=>k!==q&&k!==c);return pre+(h?h+' ':'')+base+(rs.length?' | '+J(rs):'')}
  if(v===2){const rs=q>=0?ex(q):t;return pre+base+(q>=0?' ['+t[q]+']':'')+(rs.length?' — '+J(rs):'')}
  if(v===3)return pre+base+' • '+t.join(' | ');
  if(v===4){const rs=c>=0?ex(c):t;return (c>=0?t[c]+' ':'')+pre+base+(rs.length?' ✦ '+J(rs):'')}
  return pre+base+' – '+J(t)}

/* ---------- প্ল্যাটফর্ম হাব ---------- */
let ps={q:'',type:'',state:'all',off:0};
async function plat(){
  cur=null;$('#title').textContent='প্ল্যাটফর্ম';$('#back').hidden=true;const el=$('#main');el.innerHTML=nav('plat')+'<div class="sk"></div>';
  try{await swr('svc_platforms',{},d=>{
    el.innerHTML=nav('plat')+'<p class="sub">লোগোতে ট্যাপ করুন — ১০ প্রভাইডারের ওই প্ল্যাটফর্মের সব সার্ভিস আসবে।</p><div class="pg">'+popSort(d.platforms.map(p=>Object.assign({n:p.total},p))).map(p=>`<a class="pt" href="#pl=${encodeURIComponent(p.label)}">${logo(p.label,52)}<b>${esc(p.label)}</b><span class="sub">${bn(p.total)}টি · সাইটে ${bn(p.site)}</span></a>`).join('')+'</div>'+(()=>{const rest=d.platforms.filter(p=>!isPop(p.label));return rest.length?`<select class="plmore" id="plr" aria-label="আরও প্ল্যাটফর্ম"><option value="">আরও প্ল্যাটফর্ম (${bn(rest.length)}টি) ▾</option>${rest.map(p=>`<option value="${esc(p.label)}">${esc(p.label)} (${bn(p.total)}টি · সাইটে ${bn(p.site)})</option>`).join('')}</select>`:''})();
    const pr=$('#plr');if(pr)pr.onchange=()=>{if(pr.value)location.hash='pl='+encodeURIComponent(pr.value)};
  });}catch(e){if(!authFail(e))el.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p></div>`}}
function platPage(label){
  cur=null;$('#title').textContent=label;$('#back').hidden=false;const el=$('#main');ps={q:'',type:'',state:'all',off:0,prov:[]};
  el.innerHTML=`<div class="phd">${logo(label,48)}<div><b>${esc(label)}</b><div class="sub" id="pcnt"></div></div></div><div class="bar"><input id="pq" type="search" placeholder="নাম বা আইডি খুঁজুন" aria-label="খুঁজুন"></div><div class="chips" id="ppv"></div><div class="chips" id="pty"></div><div class="chips">${[['all','সব'],['on','চালু'],['off','বন্ধ']].map(s=>`<button class="chip" data-s="${s[0]}" aria-pressed="${s[0]==='all'}">${s[1]}</button>`).join('')}<button class="chip" id="psa">সব বাছুন</button></div><div class="list" id="pl"></div><div id="pmore"></div>`;
  $('#psa').onclick=()=>el.querySelectorAll('#pl .sel').forEach(x=>{if(!x.checked){x.checked=true;x.onchange()}});
  $('#pq').oninput=e=>{clearTimeout(qt);qt=setTimeout(()=>{ps.q=e.target.value;pload(label)},350)};
  el.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{ps.state=b.dataset.s;el.querySelectorAll('[data-s]').forEach(x=>x.setAttribute('aria-pressed',x===b));pload(label)});
  pload(label)}
async function pload(label,more){
  if(!more)ps.off=0;const box=$('#pl');if(!more)box.innerHTML='<div class="sk"></div>';
  try{const d=await api('svc_by_platform',{label,q:ps.q,type:ps.type,state:ps.state,provs:ps.prov,offset:ps.off,limit:40});d.cmp=1;window._fx=d.fx;window._sc=d.site_categories;
    $('#pcnt').textContent=`মোট ${bn(d.total)}টি · সস্তা আগে`;
    $('#ppv').innerHTML=d.provs&&d.provs.length>1?`<button class="chip" data-pv="" aria-pressed="${!ps.prov.length}">সব প্রভাইডার</button>`+d.provs.map(v=>`<button class="chip" data-pv="${esc(v[0])}" aria-pressed="${ps.prov.includes(v[0])}">${esc(v[0])} ${bn(v[1])}</button>`).join(''):'';
    $('#ppv').querySelectorAll('[data-pv]').forEach(b=>b.onclick=()=>{const v=b.dataset.pv;ps.prov=!v?[]:ps.prov.includes(v)?ps.prov.filter(x=>x!==v):ps.prov.concat(v);ps.type='';pload(label)});
    $('#pty').innerHTML=`<button class="chip" data-t=" aria-pressed="${!ps.type}">সব ধরন</button>`+d.types.map(t=>`<button class="chip" data-t="${esc(t[0])}" aria-pressed="${ps.type===t[0]}">${esc(t[0])} ${bn(t[1])}</button>`).join('');
    $('#pty').querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{ps.type=b.dataset.t;pload(label)});
    if(!more)box.innerHTML='';if(!d.rows.length&&!more)box.innerHTML='<div class="card empty">কিছু পাওয়া যায়নি</div>';
    d.rows.forEach(r=>box.appendChild(row(r,d)));ps.off+=d.rows.length;
    $('#pmore').innerHTML=ps.off<d.total?'<button class="sm" id="pm" style="width:100%;margin-top:8px">আরও দেখান</button>':'';const m=$('#pm');if(m)m.onclick=()=>pload(label,true);
  }catch(e){if(!authFail(e))box.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p></div>`}}

/* ---------- সাইটের সার্ভিস ম্যানেজ: নাম বদল / লুকান / ফেরান ---------- */
let ms={q:'',plat:'',cat:'',type:'',state:'on',off:0};const ssel=new Set();
function mng(){
  cur=null;$('#title').textContent='সাইটের সার্ভিস';$('#back').hidden=true;const el=$('#main');
  el.innerHTML=nav('mng')+`<div class="card" id="fxd"><b>⚙ অটো: যোগ হওয়া মার্কআপ সরান</b><p class="sub">সব সার্ভিসের দাম প্রভাইডারের আসল রেটের সাথে মিলিয়ে দেখে — যেগুলোতে রেটের চেয়ে বেশি দাম বসে আছে (মার্কআপ যোগ হয়ে গেছে), সেগুলো একসাথে প্রভাইডারের আসল রেটে ফেরায়। এরপর সাইট একবারই মার্কআপ দেবে। নিজে খুঁজতে হবে না।</p><div class="acts"><button class="sm" id="fxdChk">🔍 সব যাচাই করুন</button><button class="sm dng" id="fxdGo" hidden>✔ সবগুলো ঠিক করুন</button></div><div id="fxdOut" class="sub"></div></div><div id="mps"></div><div class="bar"><input id="mq" type="search" placeholder="নাম, আইডি বা ক্যাটেগরি" value="${esc(ms.q)}" aria-label="খুঁজুন"></div><div id="mcats"></div><div id="mcm"></div><div class="chips">${[['on','চালু'],['off','লুকানো'],['all','সব']].map(s=>`<button class="chip" data-s="${s[0]}" aria-pressed="${ms.state===s[0]}">${s[1]}</button>`).join('')}<button class="chip" id="msa">সব বাছুন</button><button class="chip" id="msy">⟳ সিঙ্ক</button></div><p class="sub" id="mcnt"></p><div class="list" id="ml"></div><div id="mmore"></div>`;
  $('#mq').oninput=e=>{clearTimeout(qt);qt=setTimeout(()=>{ms.q=e.target.value;mload()},350)};
  el.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{ms.state=b.dataset.s;el.querySelectorAll('[data-s]').forEach(x=>x.setAttribute('aria-pressed',x===b));mload()});
  $('#msa').onclick=()=>el.querySelectorAll('.msel').forEach(x=>{if(!x.checked){x.checked=true;x.onchange()}});
  $('#fxdChk').onclick=async()=>{const o=$('#fxdOut');o.textContent='খোঁজা হচ্ছে…';try{const d=await api('svc_fix_double',{apply:false});$('#fxdGo').hidden=!d.count;o.innerHTML=d.count?`<b>${bn(d.count)}টি</b> সার্ভিসে দাম বেশি বসে আছে:<br>`+d.items.map(i=>`#${esc(i.code)} ${esc(i.name)} — এখন $${esc(i.stored)} → হবে $${esc(i.rate)}`).join('<br>')+(d.count>d.items.length?`<br>… আরও ${bn(d.count-d.items.length)}টি`:''):'কোনো যোগ-হওয়া মার্কআপ পাওয়া যায়নি ✔ ('+bn(d.checked||0)+'টি যাচাই হয়েছে)'+(d.no_provider?` (${bn(d.no_provider)}টি সার্ভিসে প্রভাইডারের নাম নেই, সেগুলো মেলানো যায়নি)`:'')}catch(e){o.textContent='';if(!authFail(e))toast(e.message)}};
  $('#fxdGo').onclick=async()=>{const b=$('#fxdGo'),o=$('#fxdOut');if(!confirm('এই সার্ভিসগুলোর দাম প্রভাইডারের রেটে ফেরানো হবে। চালিয়ে যাবেন?'))return;b.disabled=true;try{const d=await api('svc_fix_double',{apply:true});o.textContent='ঠিক হয়েছে — '+bn(d.count)+'টি সার্ভিস';b.hidden=true;try{await catSyncNow()}catch(_){}}catch(e){if(!authFail(e))toast(e.message)}b.disabled=false};
  $('#msy').onclick=async e=>{const b=e.currentTarget;if(b.disabled)return;b.disabled=true;try{await catSyncNow((a,t)=>{b.textContent='⟳ '+bn(a)+'/'+bn(t)});toast('সিঙ্ক হয়েছে — '+bn(CAT.rows.length)+'টি সার্ভিস ফোনে');mload()}catch(x){if(!authFail(x))toast(x.message)}b.textContent='⟳ সিঙ্ক';b.disabled=false};
  mload()}
async function mload(more){
  if(!more){ms.off=0;msBar()}
  const box=$('#ml');if(!more)box.innerHTML='<div class="sk"></div>';
  try{await priceMeta().catch(()=>{});const d=await pageRows('svc_site_list',{q:ms.q,platform:ms.plat,category:ms.cat,state:ms.state},ms.off,40,ms.cat?'':ms.type);window._mc=d.categories;
    $('#mps').innerHTML=tiles(d.platforms,ms.plat);bindTiles($('#mps'),l=>{ms.plat=l;ms.cat='';mload()});
    $('#mcats').innerHTML=catUI(d.categories.map(c=>({c,n:0})),ms);bindCat($('#mcats'),ms,()=>mload());
    $('#mcm').innerHTML=ms.cat?`<div class="card catbar"><b>${esc(ms.cat)}</b><div class="acts"><button class="sm" id="cren">✎ নাম বদলান</button><button class="sm dng" id="cdel">🗑 ক্যাটেগরি মুছুন</button></div></div>`:'';
    if(ms.cat){$('#cren').onclick=()=>catRename(ms.cat);$('#cdel').onclick=()=>catDelete(ms.cat)}
    $('#mcnt').textContent=ms.type&&!ms.cat?`${TLBL[ms.type]} ধরন · লোড হয়েছে ${bn(d.next)}/${bn(d.total)}টি থেকে`:`মোট ${bn(d.total)}টি`;
    if(!more)box.innerHTML='';if(!d.rows.length&&!more)box.innerHTML='<div class="card empty">কিছু পাওয়া যায়নি</div>';
    d.rows.forEach(r=>box.appendChild(mrow(r)));ms.off=d.next;
    $('#mmore').innerHTML=ms.off<d.total?'<button class="sm" id="mm" style="width:100%;margin-top:8px">আরও দেখান</button>':'';const m=$('#mm');if(m)m.onclick=()=>mload(true);
  }catch(e){if(!authFail(e))box.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p></div>`}}
function mrow(r){
  const c=document.createElement('div');c.className='card svc'+(r.state==='off'?' dim':'');
  c.innerHTML=`<div><h4><input type="checkbox" class="sel msel" aria-label="নির্বাচন">${esc(r.name)}</h4><div class="sub">${logo(r.platform_label,18)} ${esc(r.platform_label)} · ID <b>${esc(r.code)}</b> · ${esc(r.category)}</div><div class="sub">খরচ <b>$${esc(r.cost)}</b> · ${bn(r.min)}–${bn(r.max)}${r.ov?' · নাম বদলানো':''}${r.state==='off'?' · লুকানো':''}${PM&&PM[r.code]>0?' · 💲 কাস্টম ৳'+bn(PM[r.code]):''}</div></div><div class="acts2"><button class="sw" role="switch" aria-checked="${r.state!=='off'}" aria-label="সাইটে চালু/বন্ধ" data-h></button><button class="sm" data-p aria-label="দাম">💲 দাম</button><button class="sm" data-e aria-label="সম্পাদনা">✎ এডিট</button></div>`;
  c.querySelector('[data-p]').onclick=()=>priceSheet([r]);
  {const mc=c.querySelector('.msel');let old=null;ssel.forEach(x=>{if(x.code===r.code)old=x});if(old){ssel.delete(old);ssel.add(r);mc.checked=true}
  mc.onchange=e=>{e.target.checked?ssel.add(r):ssel.delete(r);msBar()}}
  c.querySelector('[data-e]').onclick=()=>editSheet(r);
  c.querySelector('[data-h]').onclick=async ev=>{if(busy)return;const on=r.state==='off',b=ev.currentTarget;busy=true;b.disabled=true;
    try{await api('svc_site_hide',{codes:[r.code],on});r.state=on?'on':'off';b.setAttribute('aria-checked',on);c.classList.toggle('dim',!on);toastU(on?'চালু হয়েছে':'বন্ধ হয়েছে',()=>api('svc_site_hide',{codes:[r.code],on:!on}))}catch(e){if(!authFail(e))toast(e.message)}b.disabled=false;busy=false};
  return c}

/* ---------- সার্ভিসের দাম কাস্টমাইজ (সাইটের কাস্টম দাম = প্রতি ১০০০-এ ৳; ডিফল্টে সাইটের মার্কআপ নিয়ম) ---------- */
let PM=null;
async function priceMeta(force){if(PM&&!force)return PM;const m=await apiNet('admin_service_meta',{sub:'list'});PM=(m&&m.prices&&typeof m.prices==='object')?m.prices:{};return PM}
const pr2=n=>Math.round(n*100)/100,en=s=>String(s).replace(/[০-৯]/g,d=>'০১২৩৪৫৬৭৮৯'.indexOf(d)).replace(/[,\s৳]/g,'');
const costBdt=r=>pr2((+r.cost||0)*fxNow());
function priceFor(r,mode,v){const c=costBdt(r);return mode==='fix'?pr2(v):mode==='add'?pr2(c+v):pr2(c*(1+v/100))}
async function runPool(items,fn){let i=0,ok=0,bad=0;await Promise.all(Array.from({length:Math.min(5,items.length)},async()=>{while(i<items.length){const it=items[i++];try{await fn(it);ok++}catch(e){bad++}}}));return{ok,bad}}
function priceSheet(rows){
  if(!rows.length)return;
  let dlg=$('#psh');if(!dlg){dlg=document.createElement('dialog');dlg.id='psh';document.body.appendChild(dlg)}
  const one=rows.length===1,r0=rows[0],cs=rows.map(costBdt).filter(x=>x>0),pm=PM||{};
  const info=one?`<p class="sub">খরচ <b>$${esc(r0.cost)}</b> ≈ ৳${bn(costBdt(r0))} · ডিফল্ট দাম ৳${bn(r0.sell)} · ${pm[r0.code]>0?'এখন কাস্টম ৳'+bn(pm[r0.code]):'কাস্টম দাম নেই'}</p>`:`<p class="sub">${cs.length?'খরচের রেঞ্জ ৳'+bn(Math.min(...cs))+' – ৳'+bn(Math.max(...cs))+' (প্রতি ১০০০)':''}</p>`;
  dlg.innerHTML=`<form method="dialog"><h3 style="margin:0 0 8px">💲 দাম ${one?'· ID '+esc(r0.code):'· '+bn(rows.length)+'টি সার্ভিস'}</h3>${info}<label for="pmd">কীভাবে দাম হবে</label><select id="pmd"><option value="fix">একই দাম (৳ প্রতি ১০০০)</option><option value="add">খরচ + লাভ (৳)</option><option value="pct">খরচ + লাভ (%)</option><option value="reset">কাস্টম দাম সরান (ডিফল্টে ফেরান)</option></select><label for="pmv" id="pml">দাম (৳ প্রতি ১০০০)</label><input id="pmv" inputmode="decimal" autocomplete="off"><div id="pmp" class="sub"></div><p id="pme" class="err" role="alert"></p><div class="acts"><button class="sm" value="cancel" formnovalidate>বাতিল</button><button class="btn" value="ok">প্রয়োগ</button></div></form>`;
  const md=$('#pmd'),vi=$('#pmv'),pv=$('#pmp'),lb=$('#pml');
  const cur=()=>{const v=parseFloat(en(vi.value));return v>=0?v:NaN};
  const draw=()=>{const m=md.value;vi.hidden=lb.hidden=m==='reset';lb.textContent=m==='fix'?'দাম (৳ প্রতি ১০০০)':m==='add'?'লাভ (৳ প্রতি ১০০০)':'লাভ (%)';
    if(m==='reset'){pv.textContent='কাস্টম দাম সরে গিয়ে সাইটের ডিফল্ট দাম ফিরবে।';return}
    const v=cur();if(isNaN(v)){pv.textContent='';return}
    const L=rows.slice(0,3).map(r=>`#${esc(r.code)}: খরচ ৳${bn(costBdt(r))} → <b>৳${bn(priceFor(r,m,v))}</b>`);
    const loss=rows.filter(r=>priceFor(r,m,v)<costBdt(r)).length;
    pv.innerHTML=L.join('<br>')+(rows.length>3?'<br>…':'')+(loss?`<br><b style="color:#f87171">⛔ ${bn(loss)}টিতে দাম প্রভাইডারের খরচের চেয়ে কম — এভাবে সাবমিট হবে না</b>`:'')};
  md.onchange=()=>{vi.value='';draw()};vi.oninput=draw;draw();
  dlg.querySelector('form').onsubmit=e=>{if(!(e.submitter&&e.submitter.value==='ok'))return;const m=md.value,v=cur();
    if(m!=='reset'){if(isNaN(v)||(m==='fix'&&!(v>0))){e.preventDefault();$('#pme').textContent='সঠিক সংখ্যা দিন';return}
      if(rows.some(r=>!(priceFor(r,m,v)>0))){e.preventDefault();$('#pme').textContent='দাম ০-এর বেশি হতে হবে';return}
      const lo=rows.filter(r=>priceFor(r,m,v)<costBdt(r));
      if(lo.length){e.preventDefault();$('#pme').textContent=bn(lo.length)+'টি সার্ভিসের দাম প্রভাইডারের খরচের চেয়ে কম হচ্ছে (যেমন #'+lo[0].code+': খরচ ৳'+bn(costBdt(lo[0]))+')। দাম বাড়িয়ে আবার দিন।';return}}};
  dlg.onclose=async()=>{if(dlg.returnValue!=='ok'||busy)return;const m=md.value,v=cur();if(m!=='reset'&&rows.some(r=>priceFor(r,m,v)<costBdt(r))){toast('দাম খরচের চেয়ে কম — প্রয়োগ হয়নি');return}busy=true;toast('প্রয়োগ হচ্ছে…');
    try{const old=Object.assign({},await priceMeta(true));let res;
      if(m==='reset')res=await runPool(rows,r=>apiNet('admin_service_meta',{sub:'remove_price',code:String(r.code)}));
      else if(m==='fix'){res={ok:0,bad:0};for(const c of chunks(rows.map(r=>String(r.code)),200)){try{await apiNet('admin_service_meta',{sub:'set_price_bulk',codes:c,price:pr2(v)});res.ok+=c.length}catch(e){res.bad+=c.length}}}
      else res=await runPool(rows,r=>apiNet('admin_service_meta',{sub:'set_price',code:String(r.code),price:priceFor(r,m,v)}));
      await priceMeta(true);
      const undo=async()=>{const k=rows.map(r=>String(r.code));await runPool(k,c=>old[c]>0?apiNet('admin_service_meta',{sub:'set_price',code:c,price:+old[c]}):apiNet('admin_service_meta',{sub:'remove_price',code:c}));await priceMeta(true);mload()};
      toastU(bn(res.ok)+'টির দাম ঠিক হয়েছে'+(res.bad?' · '+bn(res.bad)+'টি হয়নি':''),undo);
      ssel.clear();msBar();mload()}
    catch(e){if(!authFail(e))toast(e.message)}busy=false};
  dlg.returnValue='';dlg.showModal()}
function editSheet(r,after){
  let dlg=$('#esh');if(!dlg){dlg=document.createElement('dialog');dlg.id='esh';document.body.appendChild(dlg)}
  const pls=[...new Set([r.platform,...PLAT.map(p=>p[0])].filter(Boolean))];
  dlg.innerHTML=`<form method="dialog"><h3 style="margin:0 0 8px">সম্পাদনা · ID ${esc(r.code)}</h3><label for="enm">সার্ভিসের নাম</label><input id="enm" maxlength="120" value="${esc(r.name)}"><label for="epl">প্ল্যাটফর্ম</label><select id="epl">${pls.map(p=>`<option${p===r.platform?' selected':''}>${esc(p)}</option>`).join('')}</select><label for="ect">ক্যাটেগরি</label><input id="ect" autocomplete="off" value="${esc(r.category)}"><div id="esg" class="csg"></div><p id="eer" class="err" role="alert"></p><div class="acts"><button class="sm" value="cancel" formnovalidate>বাতিল</button><button class="sm" id="etd" type="button">অটো সাজান</button><button class="btn" value="ok">সংরক্ষণ</button></div></form>`;
  catSuggest($('#ect'),$('#epl'),$('#esg'),()=>[r.category,(r.tidy||{}).cat]);
  $('#etd').onclick=()=>{const t=r.tidy||{},nn=nice(r)||t.name;if(nn)$('#enm').value=nn;if(t.cat)$('#ect').value=t.cat};
  dlg.querySelector('form').onsubmit=e=>{if(e.submitter&&e.submitter.value==='ok'&&!$('#enm').value.trim()){e.preventDefault();$('#eer').textContent='নাম দিন'}};
  dlg.onclose=async()=>{if(dlg.returnValue!=='ok')return;
    try{await api('svc_site_edit',{code:r.code,name:$('#enm').value,platform:$('#epl').value,category:$('#ect').value});toast('সংরক্ষিত ✔');SC=null;(after||mload)()}catch(e){if(!authFail(e))toast(e.message)}};
  dlg.returnValue='';dlg.showModal()}
async function catCodes(cat,state){const out=[];let off=0,tot=1;
  while(off<tot){const d=await api('svc_site_list',{q:'',platform:'',category:cat,state,offset:off,limit:100});tot=d.total;if(!d.rows.length)break;d.rows.forEach(r=>out.push(r.code));off+=d.rows.length}
  return out}
const chunks=(a,n)=>{const o=[];for(let i=0;i<a.length;i+=n)o.push(a.slice(i,i+n));return o};
async function catRename(cat,after){
  if(busy)return;const nn=((await askText('ক্যাটেগরির নতুন নাম',cat,true))||'').trim();if(!nn||nn===cat)return;
  if(nn.length>80){toast('নাম ৮০ অক্ষরের বেশি হবে না');return}
  busy=true;toast('দেখা হচ্ছে…');
  try{const codes=await catCodes(cat,'all');
    if(!codes.length){toast('এই ক্যাটেগরিতে কিছু নেই');busy=false;return}
    if(!confirm('"'+cat+'" ক্যাটেগরির '+bn(codes.length)+'টি সার্ভিসের ক্যাটেগরি বদলে "'+nn+'" হবে।'+(d_has(nn)?'\n(এই নামে আগে থেকেই ক্যাটেগরি আছে — দুটো মিশে যাবে)':'')+'\nচালিয়ে যাবেন?')){busy=false;return}
    let done=0;for(const c of chunks(codes,200)){const r=await api('svc_site_bulk',{codes:c,category:nn});done+=r.done}
    SC=null;toast(bn(done)+'টির ক্যাটেগরি বদলেছে ✔');busy=false;if(after)after(nn);else{ms.cat=nn;ms.type=typeOf(nn);mload()}}
  catch(e){busy=false;if(!authFail(e))toast(e.message)}}
const d_has=n=>(window._mc||[]).indexOf(n)>=0;
async function catDelete(cat,after){
  if(busy)return;busy=true;toast('দেখা হচ্ছে…');
  try{const codes=await catCodes(cat,'on');
    if(!codes.length){toast('এই ক্যাটেগরিতে চালু সার্ভিস নেই');busy=false;return}
    if(!confirm('"'+cat+'" ক্যাটেগরির চালু '+bn(codes.length)+'টি সার্ভিস সাইট থেকে মুছে/লুকানো হবে।\n(পুরনোগুলো "লুকানো" ফিল্টার থেকে আবার ফেরানো যাবে)\nনিশ্চিত?')){busy=false;return}
    let done=0;for(const c of chunks(codes,200)){const r=await api('svc_site_hide',{codes:c,on:false,del:true});done+=r.done}
    SC=null;toast(bn(done)+'টি সার্ভিস সরানো হয়েছে');busy=false;if(after)after();else{ms.cat='';mload()}}
  catch(e){busy=false;if(!authFail(e))toast(e.message)}}
function msBar(){let b=$('#bulk');if(!b){b=document.createElement('div');b.id='bulk';b.className='bulk';document.body.appendChild(b)}
  b.hidden=!ssel.size;b.innerHTML=`<b>${bn(ssel.size)}টি</b><button class="sm" data-a="show">চালু</button><button class="sm" data-a="hide">বন্ধ</button><button class="sm" data-a="del">মুছুন</button><button class="sm" data-a="cat">ক্যাটেগরি</button><button class="sm" data-a="tidy">সাজান</button><button class="sm" data-a="price">💲 দাম</button><button class="sm" data-a="x" aria-label="বাতিল">✕</button>`;
  b.querySelectorAll('[data-a]').forEach(x=>x.onclick=()=>mact(x.dataset.a))}
async function mact(k){
  if(k==='x'){ssel.clear();document.querySelectorAll('.msel').forEach(x=>x.checked=false);return msBar()}
  if(k==='price'){if(ssel.size)priceSheet([...ssel]);return}
  if(busy)return;const codes=[...ssel].map(r=>r.code);if(!codes.length)return;let act='svc_site_hide',a={codes};
  if(k==='show')a.on=true;
  else if(k==='hide'){a.on=false}
  else if(k==='del'){if(!confirm(bn(codes.length)+'টি সার্ভিস সাইট থেকে মুছে ফেলা হবে?\n(স্টুডিও/বটে যোগ করাগুলো তালিকা থেকেও যাবে; পুরনোগুলো লুকানো থাকবে — "লুকানো" ফিল্টার থেকে ফেরানো যাবে)'))return;a.on=false;a.del=true}
  else{act='svc_site_bulk';if(k==='tidy'){if(!confirm(bn(codes.length)+'টির নাম ও ক্যাটেগরি অটো সাজানো হবে?'))return;a.tidy=true}else{const c=prompt('নতুন ক্যাটেগরি (সবগুলোর জন্য)','');if(!c)return;a.category=c}}
  busy=true;try{const r=await api(act,a);if(act==='svc_site_hide'&&!a.del){const bk=a.on;toastU(bn(r.done)+'টি হয়েছে',async()=>{for(const c of chunks(codes,200))await api('svc_site_hide',{codes:c,on:!bk})})}else toast(bn(r.done)+'টি হয়েছে');mload()}catch(e){if(!authFail(e))toast(e.message)}busy=false}

/* ---------- ক্যাটেগরি-প্রস্তাব: প্ল্যাটফর্ম অনুযায়ী ১০ প্যানেল + সাইটের ক্যাটেগরি থেকে ট্যাপ করে বাছা ---------- */
const PLB={instagram:'Instagram',facebook:'Facebook',tiktok:'TikTok',youtube:'YouTube',telegram:'Telegram',twitter:'Twitter / X',whatsapp:'WhatsApp'},CSG={};
function catSuggest(inp,sel,box,seed){let L=null,tok=0,typed=false;
  const draw=()=>{const lab=PLB[sel.value],q=typed?stripEmo(inp.value).toLowerCase():'';
    if(!lab){box.innerHTML='<p class="sub">প্ল্যাটফর্ম বাছলে ওই প্ল্যাটফর্মের ক্যাটেগরি প্রস্তাব আসবে।</p>';return}
    if(!L){box.innerHTML='<p class="sub">ক্যাটেগরি প্রস্তাব আনা হচ্ছে…</p>';return}
    const f=a=>a.filter(x=>!q||catLbl(x.c).toLowerCase().indexOf(q)>=0).slice(0,14),
      sec=(t,a)=>a.length?`<div class="sub">${t}</div><div class="csgc">${a.map(x=>`<button type="button" class="chip cs" data-c="${esc(x.c)}">${esc(catLbl(x.c))}${x.n?` <small>${bn(x.n)}</small>`:''}</button>`).join('')}</div>`:'';
    box.innerHTML=sec('সাইটে আছে',f(siteCatsFor(sel.value)))||'<p class="sub">এই প্ল্যাটফর্মে সাইটে মেলার মতো ক্যাটেগরি নেই — নিজে লিখুন</p>';
    box.querySelectorAll('.cs').forEach(b=>b.onclick=()=>{inp.value=b.dataset.c;typed=false;draw()})};
  const load=()=>{L={};draw()};
  sel.onchange=load;inp.oninput=()=>{typed=true;draw()};load()}

/* ---------- ক্যাটেগরি: তালিকা · নতুন তৈরি · ভেতরে সার্ভিসের নাম এডিট ---------- */
const catUrl=c=>'#cat='+encodeURIComponent(c);
async function siteRows(force){if(SC&&!force)return SC;SC=await scanSite({state:'all'});return SC}
const matchCat=c=>{const k=stripEmo(c).toLowerCase(),f=(window._sc||[]).find(x=>stripEmo(x).toLowerCase()===k);return f||c};
function askText(title,val,emo){return new Promise(res=>{let d=$('#ask');if(!d){d=document.createElement('dialog');d.id='ask';document.body.appendChild(d)}
  d.innerHTML=`<form method="dialog"><h3 style="margin:0 0 8px">${esc(title)}</h3><div class="knm"><input id="askv" maxlength="80" value="${esc(val)}" aria-label="${esc(title)}">${emo?'<button type="button" class="ib" id="aske" aria-label="ইমুজি যোগ করুন" title="ইমুজি যোগ করুন">✨</button>':''}</div><div class="acts"><button class="btn" value="ok" style="order:2">ঠিক আছে</button><button class="sm" value="cancel" formnovalidate style="order:1">বাতিল</button></div></form>`;
  const inp=d.querySelector('#askv'),eb=d.querySelector('#aske');if(eb)eb.onclick=()=>{inp.value=catNice(inp.value);inp.focus()};
  d.addEventListener('close',()=>res(d.returnValue==='ok'?inp.value:null),{once:true});d.returnValue='';d.showModal();inp.focus();inp.select()})}

async function catsPage(){
  cur=null;$('#title').textContent='ক্যাটেগরি';$('#back').hidden=true;const el=$('#main');
  el.innerHTML=nav('cats')+'<div class="sk"></div><div class="sk" style="margin-top:12px"></div>';
  try{const rows=await siteRows(true),G={},all=new Set();
    rows.forEach(r=>{if(!r.category)return;all.add(r.category);const p=r.platform_label||'other',g=G[p]||(G[p]={}),c=g[r.category]||(g[r.category]={n:0,on:0});c.n++;if(r.state!=='off')c.on++});
    const pls=Object.keys(G).sort((a,b)=>Object.keys(G[b]).length-Object.keys(G[a]).length);
    el.innerHTML=nav('cats')+`<div class="bar"><button class="btn" id="cnew">➕ নতুন ক্যাটেগরি</button></div><div class="bar"><button class="sm" id="cemo" style="flex:1">✨ সব ক্যাটেগরিতে ইমুজি দিন</button><button class="chip" id="cemt" aria-pressed="${emoOn()}" title="ইমুজি দিয়ে সাজানো চালু/বন্ধ">🙂 ইমুজি ${emoOn()?'চালু':'বন্ধ'}</button></div><div class="bar"><input id="cqs" type="search" placeholder="ক্যাটেগরি খুঁজুন" aria-label="ক্যাটেগরি খুঁজুন"></div><p class="sub" id="ccn">মোট ${bn(all.size)}টি ক্যাটেগরি · ${bn(rows.length)}টি সার্ভিস</p><p class="sub" id="cprog" role="status"></p><div id="cgl"></div>`;
    const draw=q=>{q=q.trim().toLowerCase();let h='';
      pls.forEach(p=>{const cs=Object.keys(G[p]).filter(c=>!q||c.toLowerCase().indexOf(q)>=0).sort((a,b)=>a.localeCompare(b));if(!cs.length)return;
        h+=`<h3 class="sec pc">${logo(p,24)} ${esc(p)} <span class="sub">· ${bn(cs.length)}টি</span></h3><div class="list">`+cs.map(c=>`<a class="card cat" href="${esc(catUrl(c))}"><span><b>${esc(c)}</b><span class="sub" style="display:block">${bn(G[p][c].n)}টি সার্ভিস · চালু ${bn(G[p][c].on)}</span></span><span aria-hidden="true">›</span></a>`).join('')+'</div>'});
      $('#cgl').innerHTML=h||'<div class="card empty">কিছু পাওয়া যায়নি</div>'};
    draw('');$('#cqs').oninput=e=>draw(e.target.value);
    $('#cnew').onclick=()=>catSheet({mode:'new'});
    $('#cemt').onclick=()=>{ls.set('pb_emo',emoOn()?'0':'1');catsPage()};
    $('#cemo').onclick=()=>catsEmoji(rows)}
  catch(e){if(!authFail(e))el.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p><button class="btn" id="rt" style="max-width:220px">আবার চেষ্টা করুন</button></div>`,$('#rt').onclick=catsPage}}
/* পুরনো নাম → নতুন নাম: প্রতিটা ক্যাটেগরির সব সার্ভিসের ক্যাটেগরি বদলায় (একাধিক মিশে গেলে একসাথে হয়ে যায়) */
async function catsEmojiDo(pairs,prog){let done=0,i=0;
  for(const pr of pairs){i++;if(prog)prog(`${bn(i)}/${bn(pairs.length)} — ${pr[0]}`);const codes=await catCodes(pr[0],'all');
    for(const c of chunks(codes,200)){const r=await api('svc_site_bulk',{codes:c,category:pr[1]});done+=r.done}}
  SC=null;return done}
function emojiPairs(names){const out=[];[...new Set(names)].filter(Boolean).forEach(c=>{const n=catNice(c);if(n&&n!==c)out.push([c,n])});return out}
async function catsEmoji(rows){
  if(busy)return;const names=rows.map(r=>r.category),pairs=emojiPairs(names);
  if(!pairs.length){toast(emoOn()?'সব ক্যাটেগরিতে আগে থেকেই ইমুজি আছে ✔':'বদলানোর কিছু নেই');return}
  const tgt=new Set(names);const merge=pairs.filter(p=>tgt.has(p[1])).length;
  if(!confirm(bn(pairs.length)+'টি ক্যাটেগরির নাম বদলাবে। যেমন:\n'+pairs.slice(0,4).map(p=>p[0]+'\n→ '+p[1]).join('\n\n')+(merge?'\n\n('+bn(merge)+'টি আগে থেকে থাকা নামের সাথে মিশে যাবে)':'')+'\n\nচালিয়ে যাবেন?'))return;
  busy=true;const pg=$('#cprog');
  try{const d=await catsEmojiDo(pairs,t=>{if(pg)pg.textContent=t});toast(bn(d)+'টি সার্ভিসের ক্যাটেগরি সাজানো হয়েছে ✔');busy=false;catsPage()}
  catch(e){busy=false;if(!authFail(e))toast(e.message)}}

async function catPage(name){
  cur=null;$('#title').textContent=name;$('#back').hidden=false;const el=$('#main');
  el.innerHTML='<div class="sk"></div><div class="sk" style="margin-top:12px"></div>';
  try{const rows=await scanSite({category:name,state:'all'}),on=rows.filter(r=>r.state!=='off').length;window._sc=window._sc||[];
    el.innerHTML=`<div class="card catbar"><div><b style="font-size:18px;word-break:break-word">${esc(name)}</b><div class="sub">${bn(rows.length)}টি সার্ভিস · চালু ${bn(on)}</div></div><div class="acts"><button class="sm" id="kr">✎ নাম বদলান</button><button class="sm" id="ke">✨ ইমুজি</button><button class="sm" id="ka">➕ সার্ভিস যোগ</button><button class="sm" id="kt">🧹 সার্ভিসের নাম সাজান</button><button class="sm dng" id="kd">🗑 মুছুন</button></div></div><div class="bar"><input id="kq" type="search" placeholder="এই ক্যাটেগরির সার্ভিস খুঁজুন (নাম বা আইডি)" aria-label="খুঁজুন"></div><p class="sub">নামের ঘরে সরাসরি লিখুন → 💾 চাপুন। ✨ চাপলে অটো নাম (ইমুজিসহ) বসবে।</p><div class="list" id="kl"></div><div id="kmore"></div>`;
    let q='',shown=0;const reload=()=>route();
    const list=()=>rows.filter(r=>!q||qOK(q,r.name+' '+r.code));
    const more=()=>{const L=list();L.slice(shown,shown+60).forEach(r=>$('#kl').appendChild(krow(r,reload)));shown=Math.min(L.length,shown+60);
      $('#kmore').innerHTML=shown<L.length?`<button class="sm" id="kmb" style="width:100%;margin-top:8px">আরও দেখান (${bn(L.length-shown)}টি বাকি)</button>`:'';const m=$('#kmb');if(m)m.onclick=more};
    const fresh=()=>{$('#kl').innerHTML='';shown=0;more();if(!list().length)$('#kl').innerHTML='<div class="card empty">কিছু পাওয়া যায়নি</div>'};
    fresh();$('#kq').oninput=e=>{clearTimeout(qt);qt=setTimeout(()=>{q=e.target.value.trim().toLowerCase();fresh()},250)};
    $('#kr').onclick=()=>catRename(name,nn=>{location.hash=catUrl(nn)});
    $('#ke').onclick=async()=>{if(busy)return;const nn=catNice(name);if(!nn||nn===name){toast('আগে থেকেই এই নামে সাজানো আছে');return}
      if(!confirm('ক্যাটেগরির নাম বদলাবে:\n'+name+'\n→ '+nn+'\n\n'+bn(rows.length)+'টি সার্ভিসের ক্যাটেগরি বদলাবে। চালিয়ে যাবেন?'))return;
      busy=true;try{await catsEmojiDo([[name,nn]]);toast('ক্যাটেগরির নাম সাজানো হয়েছে ✔');busy=false;location.hash=catUrl(nn)}catch(e){busy=false;if(!authFail(e))toast(e.message)}};
    $('#ka').onclick=()=>catSheet({mode:'add',name,after:reload});
    $('#kt').onclick=async()=>{if(busy)return;busy=true;const b=$('#kt');b.disabled=true;
      try{const t=await tidyItems({category:name,state:'all'});
        if(!t.it.length){toast('সব সার্ভিস আগেই সাজানো ✔');busy=false;b.disabled=false;return}
        if(!confirm(bn(t.it.length)+'টি সার্ভিসের নাম বদলাবে। যেমন:\n'+t.it.slice(0,3).map(x=>x.cn+'\n→ '+x.nn).join('\n\n')+'\n\nচালিয়ে যাবেন?')){busy=false;b.disabled=false;return}
        const n=await tidyDo(t.it);SC=null;toast(bn(n)+'টির নাম সাজানো হয়েছে ✔');busy=false;reload()}
      catch(e){busy=false;b.disabled=false;if(!authFail(e))toast(e.message)}};
    $('#kd').onclick=()=>catDelete(name,()=>{location.hash='cats'})
  }catch(e){if(!authFail(e))el.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p><button class="btn" id="rt" style="max-width:220px">আবার চেষ্টা করুন</button></div>`,$('#rt').onclick=()=>catPage(name)}}
/* ক্যাটেগরির ভেতরের একটা সার্ভিস: নাম সরাসরি এডিট */
function krow(r,reload){
  const c=document.createElement('div');c.className='card krow'+(r.state==='off'?' dim':'');
  c.innerHTML=`<div class="khd"><span class="sub">${logo(r.platform_label,18)} ID <b>${esc(r.code)}</b> · খরচ <b>$${esc(r.cost)}</b> · ${bn(r.min)}–${bn(r.max)}${r.state==='off'?' · লুকানো':''}</span><div class="acts2"><button class="sw" role="switch" aria-checked="${r.state!=='off'}" aria-label="সাইটে চালু/বন্ধ" data-h></button></div></div><div class="knm"><input class="nm" maxlength="120" value="${esc(r.name)}" aria-label="সার্ভিসের নাম (ID ${esc(r.code)})"><button class="ib" type="button" data-a title="অটো সাজান (ইমুজিসহ)" aria-label="অটো সাজান">✨</button><button class="ib sv" type="button" data-s hidden title="সংরক্ষণ" aria-label="সংরক্ষণ">💾</button></div><div class="row2"><button class="sm" type="button" data-e>✎ বিস্তারিত এডিট (ক্যাটেগরি/প্ল্যাটফর্ম)</button></div>`;
  const inp=c.querySelector('.nm'),sv=c.querySelector('[data-s]'),chk=()=>{sv.hidden=!(inp.value.trim()&&inp.value.trim()!==r.name)};
  inp.oninput=chk;
  const save=async()=>{const nm=inp.value.trim();if(!nm||nm===r.name||busy)return;busy=true;sv.disabled=true;
    try{await api('svc_site_edit',{code:r.code,name:nm,platform:r.platform,category:r.category});r.name=nm;SC=null;chk();toast('সংরক্ষিত ✔')}catch(e){if(!authFail(e))toast(e.message)}
    busy=false;sv.disabled=false};
  sv.onclick=save;inp.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();save()}};
  c.querySelector('[data-a]').onclick=()=>{const nn=nice(r)||(r.tidy&&r.tidy.name);if(!nn){toast('অটো নাম বানানোর মতো তথ্য নেই');return}inp.value=nn;chk();inp.focus()};
  c.querySelector('[data-e]').onclick=()=>editSheet(r,reload);
  c.querySelector('[data-h]').onclick=async ev=>{if(busy)return;const on=r.state==='off',b=ev.currentTarget;busy=true;b.disabled=true;
    try{await api('svc_site_hide',{codes:[r.code],on});r.state=on?'on':'off';b.setAttribute('aria-checked',on);c.classList.toggle('dim',!on);toastU(on?'চালু হয়েছে':'বন্ধ হয়েছে',()=>api('svc_site_hide',{codes:[r.code],on:!on}))}catch(e){if(!authFail(e))toast(e.message)}b.disabled=false;busy=false};
  return c}
/* নতুন ক্যাটেগরি (সার্ভিস বেছে) / বিদ্যমান ক্যাটেগরিতে সার্ভিস যোগ */
function catSheet(o){
  let dlg=$('#ncs');if(!dlg){dlg=document.createElement('dialog');dlg.id='ncs';document.body.appendChild(dlg)}
  const add=o.mode==='add',chosen=new Map();let qt2=null;
  dlg.innerHTML=`<form method="dialog" id="ncf"><h3 style="margin:0 0 8px">${add?'➕ সার্ভিস যোগ — '+esc(o.name):'➕ নতুন ক্যাটেগরি'}</h3>${add?'':`<label for="ncn">ক্যাটেগরির নাম</label><div class="knm"><input id="ncn" maxlength="80" placeholder="যেমন: Instagram Followers" autocomplete="off"><button type="button" class="ib" id="ncemo" title="ইমুজি যোগ করুন" aria-label="ইমুজি যোগ করুন">✨</button></div><label for="ncp">প্ল্যাটফর্ম (ঐচ্ছিক)</label><select id="ncp"><option value="">সার্ভিসের যেমন আছে তেমনই</option>${PLAT.slice(0,7).map(p=>`<option>${p[0]}</option>`).join('')}</select><div id="ncsg" class="csg"></div>`}<label for="ncq">সার্ভিস বাছুন — নাম বা আইডি লিখে খুঁজুন</label><input id="ncq" type="search" autocomplete="off" placeholder="যেমন: followers"><p class="sub" id="ncc"></p><div class="ncl" id="ncl"></div><p id="ncerr" class="err" role="alert"></p><div class="acts"><button class="btn" value="ok" id="ncok" style="order:2">${add?'যোগ করুন':'তৈরি করুন'}</button><button class="sm" value="cancel" formnovalidate style="order:1">বাতিল</button></div></form>`;
  const ok=$('#ncok'),cnt=()=>{ok.textContent=(add?'যোগ করুন':'তৈরি করুন')+(chosen.size?` (${bn(chosen.size)}টি)`:'')};
  const load=async()=>{const box=$('#ncl'),q=$('#ncq').value.trim();box.innerHTML='<div class="sk"></div>';
    try{const d=await api('svc_site_list',{q,platform:'',category:'',state:'all',offset:0,limit:100});let rows=d.rows;if(add)rows=rows.filter(r=>r.category!==o.name);
      $('#ncc').textContent=`মোট ${bn(d.total)}টি${d.total>d.rows.length?' · প্রথম '+bn(d.rows.length)+'টি দেখানো হচ্ছে — খুঁজে সীমিত করুন':''}`;box.innerHTML='';
      if(!rows.length)box.innerHTML='<div class="empty">কিছু পাওয়া যায়নি</div>';
      rows.forEach(r=>{const l=document.createElement('label');l.className='card tdy';l.innerHTML=`<input type="checkbox" class="sel" ${chosen.has(r.code)?'checked':''}><div><h4>${esc(r.name)}</h4><div class="sub">ID ${esc(r.code)} · ${esc(r.platform_label)} · ${esc(r.category||'—')}${r.state==='off'?' · লুকানো':''}</div></div>`;
        l.querySelector('input').onchange=e=>{e.target.checked?chosen.set(r.code,r):chosen.delete(r.code);cnt()};box.appendChild(l)})}
    catch(e){if(!authFail(e))box.innerHTML=`<div class="err">${esc(e.message)}</div>`}};
  $('#ncq').oninput=()=>{clearTimeout(qt2);qt2=setTimeout(load,350)};
  if(!add)catSuggest($('#ncn'),$('#ncp'),$('#ncsg'),()=>[]);
  const eb=$('#ncemo');if(eb)eb.onclick=()=>{const n=$('#ncn');n.value=catNice(n.value);n.focus()};
  $('#ncf').onsubmit=async e=>{if(!(e.submitter&&e.submitter.value==='ok'))return;e.preventDefault();if(busy)return;
    const er=$('#ncerr'),name=(add?o.name:$('#ncn').value).trim();er.textContent='';
    if(!name){er.textContent='ক্যাটেগরির নাম দিন';return}if(name.length>80){er.textContent='নাম ৮০ অক্ষরের বেশি হবে না';return}
    if(!chosen.size){er.textContent='অন্তত একটা সার্ভিস বাছুন';return}
    busy=true;ok.disabled=true;
    try{if(!add){const ex=await api('svc_site_list',{q:'',platform:'',category:name,state:'all',offset:0,limit:1});
        if(ex.total&&!confirm('"'+name+'" নামে ক্যাটেগরি আগে থেকেই আছে ('+bn(ex.total)+'টি সার্ভিস)। বাছাই করা সার্ভিসগুলো তাতেই যোগ হবে। চালিয়ে যাবেন?')){busy=false;ok.disabled=false;return}}
      const codes=[...chosen.keys()],pl=add?'':$('#ncp').value;let done=0,k=0;
      for(const c of chunks(codes,200)){er.textContent=`সরানো হচ্ছে… ${bn(Math.min(codes.length,(++k)*200))}/${bn(codes.length)}`;const x=await api('svc_site_bulk',Object.assign({codes:c,category:name},pl?{platform:pl}:{}));done+=x.done}
      SC=null;busy=false;dlg.close('ok');toast(add?bn(done)+'টি সার্ভিস যোগ হয়েছে ✔':'ক্যাটেগরি তৈরি হয়েছে ✔ ('+bn(done)+'টি সার্ভিস)');
      if(o.after)o.after(name);else location.hash=catUrl(name)}
    catch(x){busy=false;ok.disabled=false;if(!authFail(x))er.textContent=x.message}};
  cnt();load();dlg.returnValue='';dlg.showModal();setTimeout(()=>{const n=$('#ncn');if(n)n.focus()},50)}

/* ---------- AI বাটন: রোবট আইকন, টেনে সরানো যায়, সবসময় সব স্তরের উপরে (top layer) ---------- */
const ROBOT='<svg class="robot" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" focusable="false"><path d="M16 8V4.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="16" cy="3.4" r="1.9" fill="currentColor"/><rect x="5" y="8" width="22" height="17" rx="6" fill="currentColor"/><rect x="1.6" y="13" width="3" height="7" rx="1.5" fill="currentColor"/><rect x="27.4" y="13" width="3" height="7" rx="1.5" fill="currentColor"/><circle class="rb-e" cx="11.5" cy="15.5" r="2.6"/><circle class="rb-e" cx="20.5" cy="15.5" r="2.6"/><rect class="rb-m" x="11" y="20.3" width="10" height="2" rx="1"/></svg>';
function topLayer(el){if(!el||!el.showPopover)return;try{if(el.matches(':popover-open'))el.hidePopover();el.showPopover()}catch(e){}}
/* কোনো মডাল ডায়ালগ খুললে বাটন/প্যানেল সেটার ভেতরে ঢুকে যায় (নইলে ডায়ালগের বাইরের সবকিছু ক্লিক-অযোগ্য হয়ে যায়); বন্ধ হলে ফিরে আসে */
function aiDock(host){const F=$('#aiFab'),P=$('#ai');if(!F||!P)return;try{host.appendChild(P);host.appendChild(F);topLayer(P);topLayer(F)}catch(e){}}
(function(){const sm=HTMLDialogElement.prototype.showModal;HTMLDialogElement.prototype.showModal=function(){sm.call(this);try{aiDock(this);this.addEventListener('close',()=>aiDock(document.body),{once:true})}catch(e){}}})();
const FS=58,FM=8,FK='pb_fab';
function fabPos(){try{const v=JSON.parse(ls.get(FK));if(v&&isFinite(v.fx)&&isFinite(v.fy))return v}catch(e){}return{fx:1,fy:.82}}
function fabPut(F,x,y){const W=innerWidth,H=innerHeight,tp=FM;x=Math.min(Math.max(FM,x),Math.max(FM,W-FS-FM));y=Math.min(Math.max(tp,y),Math.max(tp,H-FS-FM));F.style.left=x+'px';F.style.top=y+'px';return{x,y}}
function fabFit(){const F=$('#aiFab');if(!F)return;const v=fabPos();fabPut(F,v.fx*(innerWidth-FS),v.fy*(innerHeight-FS))}
function fabSave(F){const r=F.getBoundingClientRect(),W=Math.max(1,innerWidth-FS),H=Math.max(1,innerHeight-FS);ls.set(FK,JSON.stringify({fx:Math.min(1,Math.max(0,r.left/W)),fy:Math.min(1,Math.max(0,r.top/H))}))}
let fabDown=false;document.addEventListener('dragstart',e=>{if(fabDown)e.preventDefault()},true);
function aiFabInit(F){let dr=null;
  fabFit();addEventListener('resize',fabFit);addEventListener('orientationchange',()=>setTimeout(fabFit,200));
  F.addEventListener('pointerdown',e=>{if(e.button>0)return;const r=F.getBoundingClientRect();dr={id:e.pointerId,sx:e.clientX,sy:e.clientY,ox:r.left,oy:r.top,m:false};fabDown=true;try{F.setPointerCapture(e.pointerId)}catch(x){}});
  F.addEventListener('pointermove',e=>{if(!dr||e.pointerId!==dr.id)return;const dx=e.clientX-dr.sx,dy=e.clientY-dr.sy;
    if(!dr.m&&Math.hypot(dx,dy)>6){dr.m=true;F.classList.add('drag');F.style.transition='none'}
    if(dr.m){fabPut(F,dr.ox+dx,dr.oy+dy);e.preventDefault()}});
  const end=e=>{if(!dr||e.pointerId!==dr.id)return;const was=dr.m;dr=null;fabDown=false;F.classList.remove('drag');try{F.releasePointerCapture(e.pointerId)}catch(x){}
    if(was){fabMoved=true;setTimeout(()=>{fabMoved=false},80);const r=F.getBoundingClientRect(),left=r.left+FS/2<innerWidth/2;F.style.transition='left .18s ease';fabPut(F,left?FM:innerWidth-FS-FM,r.top);setTimeout(()=>{F.style.transition='';fabSave(F)},200)}};
  F.addEventListener('pointerup',end);F.addEventListener('pointercancel',end);
  ['dragstart','contextmenu','selectstart'].forEach(t=>F.addEventListener(t,e=>e.preventDefault()));
  F.addEventListener('keydown',e=>{const k={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]}[e.key];if(!k)return;e.preventDefault();const r=F.getBoundingClientRect();fabPut(F,r.left+k[0],r.top+k[1]);fabSave(F)})}

/* ---------- AI সহকারী (Gemini) — key শুধু এই ডিভাইসের ব্রাউজারে থাকে ---------- */
const GK='pb_gem_key',GM='pb_gem_model',GOK='pb_gem_ok',GDEF='gemini-3.6-flash';
const gmodel=()=>{const m=(ls.get(GM)||'').trim();return m&&!/^gemini-(1|2)\./.test(m)?m:GDEF};let gh=[],gbusy=false;
const SYS=`তুমি "boostplus সার্ভিস স্টুডিও"-র AI সহকারী। সবসময় বাংলায়, ছোট ও পরিষ্কার উত্তর দাও।
টুল দিয়ে তুমি সাইটের সার্ভিস ও ১০ প্রভাইডারের সার্ভিস খুঁজতে, ক্যাটেগরি/নাম সাজাতে, চালু-বন্ধ করতে, ক্যাটেগরির নাম বদলাতে/মুছতে পারো।
নিয়ম:
১) কোয়ালিটি/ট্যাগ শুধু প্রভাইডারের নিজের নামে যা আছে তা-ই; নিজে কিছু বানাবে না। কিছু না পেলে স্পষ্ট বলো।
২) যেকোনো পরিবর্তনের টুল ব্যবহারকারীর কাছে নিশ্চিতকরণ চায়। তবু টুল ডাকার আগে এক লাইনে বলো কী করছ।
৩) নাম সাজাতে tidy_preview/tidy_apply ব্যবহার করো। ব্যবহারকারী নির্দিষ্ট নাম না বললে set_service দিয়ে নিজে নাম বানিয়ো না।
৪) সাইটের নামের ছাঁচ: "ধরন – কোয়ালিটি · দেশ · ড্রপ · ♻রিফিল · স্পিড · ⚡স্টার্ট · Max", ইমুজিসহ (যেমন 👥 Followers – 💎 HQ Real · 🛡️ NoDrop · ♻30D · 🚀 50K/D · 📈 Max1M)। ক্যাটেগরির নামের আগে প্ল্যাটফর্মের ইমুজি বসে (📸 Instagram Followers)। নতুন ক্যাটেগরি বানাতে create_category, ইমুজি বসাতে emoji_categories ব্যবহার করো।
৫) দাম ৳ প্রতি ১০০০; প্রভাইডারের রেট USD। ফল তালিকা ছোট রাখো (সর্বোচ্চ ১০টা), বাকিটা কতগুলো আছে বলো।`;
const TOOLS=[{functionDeclarations:[
 {name:'search_site',description:'সাইটে থাকা সার্ভিস খোঁজে। মোট সংখ্যা ও কিছু সার্ভিস ফেরত দেয়।',parameters:{type:'OBJECT',properties:{q:{type:'STRING',description:'নাম/আইডি/ক্যাটেগরির অংশ'},platform:{type:'STRING',description:'যেমন Instagram, Facebook, TikTok'},category:{type:'STRING',description:'হুবহু ক্যাটেগরির নাম'},state:{type:'STRING',description:'on, off বা all (ডিফল্ট on)'},limit:{type:'INTEGER'}}}},
 {name:'search_providers',description:'১০ প্রভাইডারের সব সার্ভিসে খোঁজে, সস্তা আগে (দাম তুলনা)। q কমপক্ষে ২ অক্ষর, যেমন "instagram followers"।',parameters:{type:'OBJECT',properties:{q:{type:'STRING'},refill:{type:'BOOLEAN',description:'শুধু রিফিল আছে এমন'},limit:{type:'INTEGER'}},required:['q']}},
 {name:'list_categories',description:'সাইটের প্ল্যাটফর্ম ও ক্যাটেগরির তালিকা (platform দিলে শুধু ওটার)।',parameters:{type:'OBJECT',properties:{platform:{type:'STRING'}}}},
 {name:'tidy_preview',description:'নাম সাজালে কতগুলো বদলাবে ও নমুনা দেখায় (কিছু বদলায় না)। category/q দিয়ে সীমিত করা যায়।',parameters:{type:'OBJECT',properties:{category:{type:'STRING'},q:{type:'STRING'},platform:{type:'STRING'}}}},
 {name:'tidy_apply',description:'সাইটের চালু সার্ভিসের নাম সাইটের ছাঁচে সাজায় (নিশ্চিতকরণ চায়)। category/q/platform দিয়ে সীমিত করা যায়।',parameters:{type:'OBJECT',properties:{category:{type:'STRING'},q:{type:'STRING'},platform:{type:'STRING'}}}},
 {name:'set_service',description:'একটা সার্ভিসের নাম বা ক্যাটেগরি বদলায় (নিশ্চিতকরণ চায়)।',parameters:{type:'OBJECT',properties:{code:{type:'STRING'},name:{type:'STRING'},category:{type:'STRING'}},required:['code']}},
 {name:'set_visibility',description:'সার্ভিস সাইটে চালু (on=true) বা বন্ধ/লুকানো (on=false) করে (নিশ্চিতকরণ চায়)।',parameters:{type:'OBJECT',properties:{codes:{type:'ARRAY',items:{type:'STRING'}},on:{type:'BOOLEAN'}},required:['codes','on']}},
 {name:'rename_category',description:'একটা ক্যাটেগরির সব সার্ভিসের ক্যাটেগরির নাম বদলায় (নিশ্চিতকরণ চায়)।',parameters:{type:'OBJECT',properties:{old:{type:'STRING'},new:{type:'STRING'}},required:['old','new']}},
 {name:'create_category',description:'নতুন ক্যাটেগরি বানায়: আইডি দিয়ে দেওয়া সার্ভিসগুলো ওই নামের ক্যাটেগরিতে নেয় (নিশ্চিতকরণ চায়)। সার্ভিস ছাড়া ক্যাটেগরি হয় না।',parameters:{type:'OBJECT',properties:{name:{type:'STRING',description:'নতুন ক্যাটেগরির নাম'},codes:{type:'ARRAY',items:{type:'STRING'},description:'সার্ভিসের আইডি'},platform:{type:'STRING',description:'ঐচ্ছিক: instagram, facebook, tiktok, youtube, telegram, twitter, whatsapp'}},required:['name','codes']}},
 {name:'emoji_categories',description:'ক্যাটেগরির নামের আগে প্ল্যাটফর্মের ইমুজি বসায় — category দিলে শুধু ওটা, না দিলে সব (নিশ্চিতকরণ চায়)।',parameters:{type:'OBJECT',properties:{category:{type:'STRING'}}}},
 {name:'delete_category',description:'একটা ক্যাটেগরির সব চালু সার্ভিস সাইট থেকে সরায় (নিশ্চিতকরণ চায়, পরে ফেরানো যায়)।',parameters:{type:'OBJECT',properties:{category:{type:'STRING'}},required:['category']}}
]}];
const LBL={search_site:'🔎 সাইটে খুঁজছি…',search_providers:'🔎 ১০ প্রভাইডারে খুঁজছি…',list_categories:'🗂 ক্যাটেগরি দেখছি…',tidy_preview:'🧹 নাম পরীক্ষা করছি…',tidy_apply:'🧹 নাম সাজাচ্ছি…',set_service:'✎ সার্ভিস বদলাচ্ছি…',set_visibility:'👁 চালু/বন্ধ করছি…',rename_category:'✎ ক্যাটেগরির নাম বদলাচ্ছি…',delete_category:'🗑 ক্যাটেগরি সরাচ্ছি…',create_category:'➕ ক্যাটেগরি বানাচ্ছি…',emoji_categories:'✨ ইমুজি বসাচ্ছি…'};
const glim=n=>Math.max(1,Math.min(+n||12,30)),gref=()=>{SC=null;const h=location.hash;if(h==='#mng')mload();else if(h==='#cats'||h.indexOf('#cat=')===0)route()};
const gslim=r=>({code:r.code,name:r.name,category:r.category,platform:r.platform_label,cost_usd:r.cost,min:r.min,max:r.max,state:r.state});
async function scanSite(f){const R=[];let off=0,tot=1;while(off<tot){const d=await api('svc_site_list',{q:f.q||'',platform:f.platform||'',category:f.category||'',state:f.state||'on',offset:off,limit:100});tot=d.total;if(!d.rows.length)break;R.push(...d.rows);off+=d.rows.length}return R}
async function tidyItems(f){const rows=await scanSite(f||{}),it=[];rows.forEach(r=>{const nm=nice(r);if(nm&&nm!==r.name)it.push({code:r.code,cn:r.name,nn:nm,category:r.category,src:r.src,ov:r.ov})});return{n:rows.length,it}}
async function tidyDo(it){const need=it.filter(r=>r.src==='static'&&!r.ov).map(r=>r.code);for(const c of chunks(need,200))await api('svc_site_bulk',{codes:c});
  let done=0;for(const c of chunks(it.map(r=>({code:r.code,name:r.nn,cat:r.category})),300)){const x=await api('svc_tidy_apply',{items:c});done+=x.done}return done}
async function catRenameCore(cat,nn){nn=String(nn||'').trim();if(!cat||!nn||nn===cat)return{error:'নাম ঠিক নয়'};if(nn.length>80)return{error:'নাম ৮০ অক্ষরের বেশি'};
  const codes=await catCodes(cat,'all');if(!codes.length)return{error:'এই ক্যাটেগরিতে কিছু নেই'};
  if(!confirm('"'+cat+'" ক্যাটেগরির '+bn(codes.length)+'টি সার্ভিসের ক্যাটেগরি বদলে "'+nn+'" হবে। চালিয়ে যাবেন?'))return{cancelled:true};
  let done=0;for(const c of chunks(codes,200)){const r=await api('svc_site_bulk',{codes:c,category:nn});done+=r.done}gref();return{done}}
async function catDeleteCore(cat){const codes=await catCodes(cat,'on');if(!codes.length)return{error:'এই নামে চালু সার্ভিস নেই'};
  if(!confirm('"'+cat+'" ক্যাটেগরির চালু '+bn(codes.length)+'টি সার্ভিস সাইট থেকে সরানো হবে (পরে "লুকানো" থেকে ফেরানো যাবে)। নিশ্চিত?'))return{cancelled:true};
  let done=0;for(const c of chunks(codes,200)){const r=await api('svc_site_hide',{codes:c,on:false,del:true});done+=r.done}gref();return{done}}
const TOOLFN={
 async search_site(a){const d=await api('svc_site_list',{q:a.q||'',platform:a.platform||'',category:a.category||'',state:a.state||'on',offset:0,limit:glim(a.limit)});return{total:d.total,rows:d.rows.map(gslim),categories_in_result:d.categories.slice(0,40)}},
 async search_providers(a){const d=await api('svc_compare',{q:a.q||'',refill:!!a.refill});return{total:d.total,rows:d.rows.slice(0,glim(a.limit)).map(r=>({provider:r.provider,id:r.service_id,name:r.name,category:r.category,rate_usd_per_1k:r.rate,min:r.min,max:r.max,refill:r.refill==='1',on_site:r.state==='on',avg_time_sec:r.spd?Math.round(r.spd.m):null}))}},
 async list_categories(a){const d=await api('svc_site_list',{q:'',platform:a.platform||'',category:'',state:'on',offset:0,limit:1});return{total_services:d.total,platforms:d.platforms,categories:d.categories}},
 async tidy_preview(a){const t=await tidyItems(a);return{scanned:t.n,would_change:t.it.length,samples:t.it.slice(0,12).map(x=>({code:x.code,from:x.cn,to:x.nn}))}},
 async tidy_apply(a){const t=await tidyItems(a);if(!t.it.length)return{message:'সব সার্ভিস আগেই সাজানো',scanned:t.n};
  if(!confirm(bn(t.it.length)+'টি সার্ভিসের নাম সাইটের ছাঁচে বদলানো হবে। যেমন:\n'+t.it.slice(0,3).map(x=>x.cn+'\n→ '+x.nn).join('\n\n')+'\n\nচালিয়ে যাবেন?'))return{cancelled:true};
  const done=await tidyDo(t.it);gref();return{done}},
 async set_service(a){const code=String(a.code||'').trim();if(!code)return{error:'আইডি দিন'};const rs=await scanSite({q:code,state:'all'}),r=rs.find(x=>String(x.code)===code);if(!r)return{error:'এই আইডি সাইটে নেই'};
  const name=String(a.name||r.name).trim(),cat=String(a.category||r.category).trim();
  if(!confirm('ID '+code+'\nনাম: '+name+'\nক্যাটেগরি: '+cat+'\n\nসংরক্ষণ করবেন?'))return{cancelled:true};
  await api('svc_site_edit',{code,name,platform:r.platform,category:cat});gref();return{ok:true,name,category:cat}},
 async set_visibility(a){const codes=(a.codes||[]).map(String).slice(0,400);if(!codes.length)return{error:'কোনো আইডি নেই'};
  if(!confirm(bn(codes.length)+'টি সার্ভিস সাইটে '+(a.on?'চালু':'বন্ধ')+' করা হবে। আইডি: '+codes.slice(0,8).join(', ')+(codes.length>8?'…':'')))return{cancelled:true};
  let done=0;for(const c of chunks(codes,200)){const r=await api('svc_site_hide',{codes:c,on:!!a.on});done+=r.done}gref();return{done}},
 rename_category(a){return catRenameCore(a.old,a.new)},
 async create_category(a){const name=String(a.name||'').trim(),codes=(a.codes||[]).map(String).slice(0,400);if(!name||name.length>80)return{error:'ক্যাটেগরির নাম ঠিক নয় (১–৮০ অক্ষর)'};if(!codes.length)return{error:'কোনো সার্ভিস আইডি নেই'};
  const pl=PLAT.slice(0,7).some(p=>p[0]===String(a.platform||'').toLowerCase())?String(a.platform).toLowerCase():'';
  if(!confirm('নতুন ক্যাটেগরি: "'+name+'"\n'+bn(codes.length)+'টি সার্ভিস এতে আসবে। আইডি: '+codes.slice(0,8).join(', ')+(codes.length>8?'…':'')+'\nচালিয়ে যাবেন?'))return{cancelled:true};
  let done=0;for(const c of chunks(codes,200)){const r=await api('svc_site_bulk',Object.assign({codes:c,category:name},pl?{platform:pl}:{}));done+=r.done}gref();return{done,category:name}},
 async emoji_categories(a){const rows=await siteRows(true),names=a.category?[String(a.category)]:rows.map(r=>r.category),pairs=emojiPairs(names);if(!pairs.length)return{message:'বদলানোর কিছু নেই — আগেই ইমুজি আছে বা ক্যাটেগরি পাওয়া যায়নি'};
  if(!confirm(bn(pairs.length)+'টি ক্যাটেগরির নাম বদলাবে। যেমন:\n'+pairs.slice(0,4).map(p=>p[0]+'\n→ '+p[1]).join('\n\n')+'\n\nচালিয়ে যাবেন?'))return{cancelled:true};
  const done=await catsEmojiDo(pairs);gref();return{renamed:pairs.length,services:done}},
 delete_category(a){return catDeleteCore(a.category)}};
const gmd=t=>esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>');
function addMsg(k,t){const b=$('#aiMsgs');if(!b)return null;const d=document.createElement('div');d.className='am '+k;if(k==='ai')d.innerHTML=gmd(t);else d.textContent=t;b.appendChild(d);b.scrollTop=b.scrollHeight;return d}
async function gcall(){const key=ls.get(GK),model=gmodel(),body={systemInstruction:{parts:[{text:SYS}]},contents:gh,tools:TOOLS,generationConfig:{temperature:.3}};
  /* ১) নিজের AIza… key থাকলে সরাসরি Google-এ; ব্যর্থ/নেটওয়ার্ক সমস্যা/মডেল নেই হলে ২) Apps Script প্রক্সি (সার্ভারের key + মডেল-ফলব্যাক) */
  if(key&&!/^AQ\./.test(key)){
    try{const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body)});
      const d=await r.json().catch(()=>({}));if(r.ok)return d;if(r.status!==404&&r.status!==400&&r.status!==403&&r.status!==401){const e=new Error((d.error&&d.error.message)||('HTTP '+r.status));e.status=r.status;throw e}}
    catch(x){if(x&&x.status)throw x}}
  const p=await api('ai_gemini',Object.assign({model,body},key&&/^AQ\./.test(key)?{key}:{}));
  if(p.status!==200){const e=new Error((p.data&&p.data.error&&p.data.error.message)||('HTTP '+p.status));e.status=p.status;throw e}return p.data}
function gtrim(){if(gh.length<=40)return;let i=gh.length-14;while(i<gh.length&&!(gh[i].role==='user'&&gh[i].parts&&gh[i].parts[0]&&gh[i].parts[0].text!==undefined))i++;gh=i<gh.length?gh.slice(i):gh.slice(-2)}
async function agent(text){gtrim();gh.push({role:'user',parts:[{text}]});
  for(let i=0;i<8;i++){const d=await gcall(),c=d.candidates&&d.candidates[0];
    if(!c||!c.content){addMsg('err','উত্তর আসেনি'+(d.promptFeedback&&d.promptFeedback.blockReason?' (ব্লক: '+d.promptFeedback.blockReason+')':''));return}
    gh.push(c.content);const parts=c.content.parts||[],calls=parts.filter(p=>p.functionCall),tx=parts.filter(p=>p.text&&!p.thought).map(p=>p.text).join('');
    if(tx)addMsg('ai',tx);if(!calls.length)return;
    const resp=[];for(const p of calls){const fc=p.functionCall;addMsg('tool',LBL[fc.name]||fc.name);let out;
      try{if(!TOOLFN[fc.name])throw new Error('অজানা টুল');out=await TOOLFN[fc.name](fc.args||{})}catch(e){if(authFail(e))return;out={error:e.message}}
      resp.push({functionResponse:{name:fc.name,response:{result:out}}})}
    gh.push({role:'user',parts:resp})}
  addMsg('ai','অনেক ধাপ হয়ে গেছে — আবার বলুন, কোথায় থেমেছি সেখান থেকে চালাব।')}
const gerr=e=>e.code==='unknown_action'?'Apps Script-এ নতুন PtServices.gs বসিয়ে আবার Deploy করুন (ai_gemini অ্যাকশন নেই)':e.status===429?'ফ্রি কোটা শেষ বা অনেক দ্রুত পাঠানো হয়েছে — একটু পরে চেষ্টা করুন':e.status===400&&/key/i.test(e.message)||e.status===403?'API key ঠিক নয় বা অনুমতি নেই — ⚙ থেকে দেখুন':e.status===404?'মডেল পাওয়া যায়নি — ⚙ থেকে মডেলের ঘর ফাঁকা করে সংরক্ষণ করুন (ডিফল্ট '+GDEF+')':e.name==='TypeError'?'ইন্টারনেট/নেটওয়ার্ক সমস্যা':e.message;
function aiStatus(){const k=ls.get(GK);$('#aiSt').textContent=k?(ls.get(GOK)?'● সংযুক্ত':'● key আছে'):(ls.get(GOK)?'● সার্ভার key':'○ সার্ভার key');$('#aiSt').className='sub'+(k&&ls.get(GOK)?' ok':'')}
function aiInit(){if($('#aiFab'))return;
  document.body.insertAdjacentHTML('beforeend',`<button id="aiFab" class="aifab" popover="manual" aria-label="AI সহকারী — টেনে সরানো যায়" title="AI সহকারী (টেনে সরান)" hidden>${ROBOT}</button><section id="ai" class="aipanel" popover="manual" role="dialog" aria-label="AI সহকারী" hidden><header><b class="aiti">${ROBOT.replace('width="30" height="30"','width="22" height="22"')} AI সহকারী</b><span id="aiSt" class="sub"></span><span class="aihs"><button class="ib" id="aiSet" aria-label="সেটিং">⚙</button><button class="ib" id="aiNew" aria-label="নতুন চ্যাট" title="নতুন চ্যাট">↺</button><button class="ib" id="aiX" aria-label="বন্ধ">✕</button></span></header>
<div id="aiKey" class="aikey" hidden><label for="aiK">Gemini API key</label><input id="aiK" type="password" autocomplete="off" placeholder="AIza…"><label for="aiM">মডেল</label><input id="aiM" autocomplete="off"><p class="sub">key শুধু এই ফোনের ব্রাউজারে থাকে। Google AI Studio-তে key-তে সীমা (restriction) বেঁধে রাখুন।</p><p class="err" id="aiKe" role="alert"></p><div class="acts"><button class="sm" id="aiDel" type="button">key মুছুন</button><button class="btn" id="aiSave" type="button">সংরক্ষণ ও পরীক্ষা</button></div></div>
<div id="aiMsgs" class="aimsgs" aria-live="polite"></div><div id="aiChips" class="chips"></div><form id="aiForm"><input id="aiIn" placeholder="যা করাতে চান লিখুন…" autocomplete="off" aria-label="বার্তা"><button class="btn" id="aiGo">পাঠান</button></form></section>`);
  const P=$('#ai'),F=$('#aiFab');aiFabInit(F);topLayer(P);topLayer(F);
  const open=()=>{P.hidden=false;F.hidden=true;topLayer(P);aiStatus();$('#aiIn').focus()};
  const close=()=>{P.hidden=true;F.hidden=!token;topLayer(F)};
  const keyBox=v=>{$('#aiKey').hidden=!v;if(v){$('#aiK').value=ls.get(GK)||'';$('#aiM').value=gmodel();$('#aiKe').textContent=''}};
  F.onclick=()=>{if(fabMoved){fabMoved=false;return}open()};$('#aiX').onclick=close;$('#aiSet').onclick=()=>keyBox($('#aiKey').hidden);
  $('#aiNew').onclick=()=>{gh=[];$('#aiMsgs').innerHTML='';hello()};
  $('#aiDel').onclick=()=>{ls.del(GK);ls.del(GOK);gh=[];$('#aiK').value='';aiStatus();$('#aiKe').textContent='key মোছা হয়েছে'};
  $('#aiSave').onclick=async()=>{const k=$('#aiK').value.trim(),m=$('#aiM').value.trim()||GDEF,b=$('#aiSave');if(!k&&!confirm('key ছাড়া সংরক্ষণ — অ্যাপ সার্ভারের (Apps Script-এর) key ব্যবহার করবে। চালিয়ে যাবেন?'))return;
    b.disabled=true;$('#aiKe').textContent='পরীক্ষা হচ্ছে…';const ok=[ls.get(GK),ls.get(GM)],old=gh;if(k)ls.set(GK,k);else ls.del(GK);ls.set(GM,m);gh=[{role:'user',parts:[{text:'শুধু "ok" লিখুন'}]}];
    try{await gcall();ls.set(GOK,'1');gh=old;$('#aiKe').textContent='';keyBox(false);aiStatus();if(!$('#aiMsgs').children.length)hello();$('#aiIn').focus()}
    catch(e){gh=old;ls.del(GOK);if(ok[0]==null)ls.del(GK);else ls.set(GK,ok[0]);if(ok[1]==null)ls.del(GM);else ls.set(GM,ok[1]);$('#aiKe').textContent=gerr(e)}
    b.disabled=false;aiStatus()};
  const send=async t=>{t=(t||'').trim();if(!t||gbusy)return;
    gbusy=true;$('#aiGo').disabled=true;$('#aiIn').value='';addMsg('me',t);const w=addMsg('tool','⏳ ভাবছি…');
    try{await agent(t);ls.set(GOK,'1')}catch(e){addMsg('err',gerr(e))}
    if(w)w.remove();gbusy=false;$('#aiGo').disabled=false;aiStatus();$('#aiIn').focus()};
  $('#aiForm').onsubmit=e=>{e.preventDefault();send($('#aiIn').value)};
  const hello=()=>{addMsg('ai','আমি সাইটের সার্ভিস খুঁজতে, ক্যাটেগরি/নাম সাজাতে, চালু-বন্ধ করতে পারি। কী করাতে চান?');
    $('#aiChips').innerHTML=['TikTok Followers-এর সবচেয়ে সস্তা ৫টা (সব প্রভাইডার)','ফেসবুকের ক্যাটেগরিগুলো দেখাও','কতগুলো সার্ভিসের নাম সাজানো বাকি?','Instagram Followers-এর নাম সাজাও'].map(x=>`<button class="chip" type="button">${esc(x)}</button>`).join('');
    $('#aiChips').querySelectorAll('.chip').forEach(b=>b.onclick=()=>send(b.textContent))};
  hello();aiStatus();window._aiClose=close}
function aiShow(){/* AI রোবট বাদ — বাটন/প্যানেল আর তৈরি হয় না */['#aiFab','#ai'].forEach(q=>{const e=$(q);if(e)e.remove()})}

/* ---------- রাউটার, লগইন, ইনস্টল ---------- */
function exc(){cur=null;$('#title').textContent='ব্যতিক্রম';$('#back').hidden=true;const el=$('#main'),I=EXC.items,G=[['new','🆕 নতুন সার্ভিস'],['gone','⚠ প্রভাইডার থেকে চলে গেছে (সাইটে চালু ছিল)'],['price','💲 দাম বদলেছে (৫%+)']];
  el.innerHTML=nav('exc')+`<div class="bar"><button class="btn" id="xs" style="max-width:220px">⟳ এখনই সিঙ্ক</button>${I.length?'<button class="chip" id="xd">সব দেখেছি</button>':''}</div><p class="sub">সিঙ্কের সময় আগের ক্যাটালগের সাথে মিলিয়ে দেখানো হয়। বাকি সব আপনার না দেখলেও চলে।${CAT?'':' (প্রথম সিঙ্ক এখনো হয়নি)'}</p>`+(I.length?G.map(g=>{const l=I.filter(x=>x.t===g[0]);return l.length?`<h3>${g[1]} · ${bn(l.length)}</h3><div class="list">`+l.slice(0,60).map(x=>`<a class="card" href="#mng" data-c="${esc(x.code)}" style="display:block;text-decoration:none;color:inherit"><b>${esc(x.name)}</b><div class="sub">${esc(x.pl)} · #${esc(x.code)}${x.t==='price'?` · ${bn(x.a)} → ${bn(x.b)} `:''}</div></a>`).join('')+'</div>':''}).join(''):'<p class="mut">এখন কোনো ব্যতিক্রম নেই ✔</p>');
  el.querySelectorAll('[data-c]').forEach(a=>a.onclick=()=>{ms.q=a.dataset.c;ms.state='all';ms.plat='';ms.cat=''});
  const xd=$('#xd');if(xd)xd.onclick=()=>{EXC={items:[]};idb.set(EXK,EXC);exc()};
  $('#xs').onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{await catSyncNow((a,t)=>{b.textContent='⟳ '+bn(a)+'/'+bn(t)});exc()}catch(x){if(!authFail(x))toast(x.message);b.disabled=false}}}
/* ---------- পোস্টার: সার্ভিস বেছে সুন্দর ছবি বানিয়ে সব জায়গায় শেয়ার ---------- */
const PTH=[['নীল-বেগুনি','#4F46E5','#9333EA','#EC4899',0],['সবুজ','#047857','#10B981','#A3E635',0],['কমলা','#C2410C','#F59E0B','#FDE047',0],['সাগর','#0E7490','#2563EB','#7C3AED',0],['গোলাপি','#9F1239','#E11D48','#FB923C',0],['নিয়ন রাত','#070B24','#3B1D8F','#0EA5E9',1],['গোল্ড ব্ল্যাক','#0A0A0A','#2B2111','#92400E',1],['গাঢ় সবুজ','#022C22','#065F46','#0D9488',1]],
PSZ=[['স্কয়ার ১০৮০²',1080,1080,4],['পোর্ট্রেট ৪:৫',1080,1350,5],['স্টোরি ৯:১৬',1080,1920,9]],PLG={};let pTk=0;
const pSel=()=>{const L=pItems().filter(it=>PSEL.has(it.key));L.forEach(it=>{it.name=pName(it);it.p=pVal(it)});return L.sort((a,b)=>PS.so?b.p-a.p:a.p-b.p)};
function pLogo(l){const k=platKey(l);if(!SL[k])return Promise.resolve(null);return PLG[k]||(PLG[k]=new Promise(res=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>res(null);im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="240" height="240" color="#111"><defs><linearGradient id="pfIgGrad" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FEDA75"/><stop offset=".35" stop-color="#FA7E1E"/><stop offset=".6" stop-color="#D62976"/><stop offset="1" stop-color="#4F5BD5"/></linearGradient></defs>'+SL[k]+'</svg>')}))}
let PS=Object.assign({brand:'boostplus',head:'আমাদের সার্ভিস সমূহ',tag:'সেরা দামে • দ্রুত ডেলিভারি',cta:'এখনই অর্ডার করুন',con:'',th:0,sz:1,plat:'',q:'',ty:[],pv:[],lo:'',hi:'',so:0,on:0},(()=>{try{return JSON.parse(ls.get('pb_poster'))||{}}catch(e){return{}}})()),PSEL=new Set(),pT=null;
/* সাইটের pricing.js-এর হুবহু নিয়ম: খরচ(USD)×রেট + স্ল্যাব মার্কআপ (0-20→+7, 21-40→+12, 41-70→+16, 71-100→+21, 101-200→+25, 201+→+30); কাস্টম দাম থাকলে সেটাই */
const PB_RATE=131,pbSell=usd=>{const p=(parseFloat(String(usd).replace(/[^0-9.]/g,''))||0)*PB_RATE;return p+(p>200?30:p>100?25:p>70?21:p>40?16:p>20?12:7)},
pVal=r=>{const cu=r.on&&PM&&+PM[r.code]>0?+PM[r.code]:0;return cu||pr2(pbSell(r.usd))},pPr=r=>{const v=pVal(r);return v>0?'৳'+(+v.toFixed(2)):'—'},pNum=v=>{const x=parseFloat(en(v));return x>=0?x:0};
let PAI=null,PSITE={};
const pMatch=(st,r)=>{if(!st||st.state!=='on'||String(st.platform_label)!==String(lpLabel(r)))return false;const a=+st.cost,b=+r.rate;return lpType({category:st.category,name:st.name})===lpType(r)&&(!(a>0&&b>0)||Math.abs(a-b)<=Math.max(a,b)*.35)};
function pItems(){if(PAI)return PAI;PSITE={};CAT.rows.forEach(r=>{PSITE[r.code]=r});const raw=lpRows();
  PAI=raw.length?raw.map(r=>{const st=PSITE[r.service_id];return{key:r.provider+'|'+r.service_id,code:String(r.service_id),prov:r.provider,r,platform_label:lpLabel(r),usd:+r.rate||0,min:r.min,max:r.max,on:pMatch(st,r),ty:lpType(r),cat:r.category}}):CAT.rows.filter(r=>r.state==='on').map(r=>({key:'site|'+r.code,code:String(r.code),prov:'সাইট',r,platform_label:r.platform_label,usd:+r.cost||0,min:r.min,max:r.max,on:true,ty:lpType({category:r.category,name:r.name}),cat:r.category}));return PAI}
const PEM=/(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2})(?:\uFE0F|\u200D\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*/gu;
/* রিয়্যাক্ট-ধরনের সার্ভিসে মূল নামের ইমোজিগুলো বাদ যায় না — নামের 'Reactions' শব্দের পরেই বসে */
function pEmo(it){const t=String(it.r.name||''),L=[...new Set(t.replace(/[0-9#*]\uFE0F?\u20E3/gu,'').match(PEM)||[])];return L.length>=3||(L.length&&/react/i.test(t+' '+it.cat))?L.slice(0,14).join(''):''}
const pName=it=>{if(!it._n){let n=it.on&&PSITE[it.code]&&PSITE[it.code].name;if(!n){try{n=nice(it.r)}catch(e){}}n=stripEmo(n||it.r.name).replace(/\s*[✪◆◇✦✧★☆➤➢▶►❖✱✯✰|—–]+\s*/g,' · ').replace(/(\s·)+\s*$/,'');const em=pEmo(it);if(em&&!n.includes(em.slice(0,2))){const m=n.match(/react\w*/i);n=m?n.slice(0,m.index+m[0].length)+' '+em+n.slice(m.index+m[0].length):n+' '+em}it._n=n}return it._n};
const pFil=()=>{const q=PS.q,lo=PS.lo===''?-1:+PS.lo,hi=PS.hi===''?1e12:+PS.hi;return pItems().filter(it=>(!PS.plat||it.platform_label===PS.plat)&&(!PS.ty.length||PS.ty.includes(it.ty))&&(!PS.pv.length||PS.pv.includes(it.prov))&&(!PS.on||(PS.on==='on')===it.on)&&(!q||qOK(q,String(it.r.name)+' '+it.code+' '+it.cat+' '+it.prov))).map(it=>(it.p=pVal(it),it)).filter(it=>it.p>=lo&&it.p<=hi).sort((a,b)=>PS.so?b.p-a.p:a.p-b.p)};
function pAuto(){const m=new Map();pFil().sort((a,b)=>a.p-b.p).forEach(it=>{const k=it.platform_label+'|'+it.ty;if(!m.has(k))m.set(k,it)});PSEL.clear();[...m.values()].slice(0,PSZ[PS.sz][3]).forEach(it=>PSEL.add(it.key))}
function pWrap(c,t,w,n){const o=[];let l='';String(t).split(/\s+/).forEach(x=>{const z=l?l+' '+x:x;if(c.measureText(z).width>w&&l){o.push(l);l=x}else l=z});o.push(l);if(o.length>n){o.length=n;let s=o[n-1];while(s&&c.measureText(s+'…').width>w)s=s.slice(0,-1);o[n-1]=s+'…'}return o}
async function pDraw(){const cv=$('#pcv');if(!cv)return;const tk=++pTk,W=PSZ[PS.sz][1],H=PSZ[PS.sz][2],T=PTH[PS.th],dk=T[4],c=cv.getContext('2d'),F='"Hind Siliguri",Inter,system-ui,sans-serif',L=pSel(),X=60,CW=W-120;
  try{await Promise.all(['400 30px "Hind Siliguri"','600 40px "Hind Siliguri"','700 40px "Hind Siliguri"','700 40px Inter'].map(f=>document.fonts.load(f,'আ A1')))}catch(e){}
  const LG=await Promise.all(L.map(r=>pLogo(r.platform_label)));if(tk!==pTk)return;
  cv.width=W;cv.height=H;
  const rr=(x,y,w,h,r)=>{c.beginPath();c.roundRect?c.roundRect(x,y,w,h,r):c.rect(x,y,w,h)},glass=(x,y,w,h)=>{c.fillStyle='rgba(255,255,255,.16)';rr(x,y,w,h,h/2);c.fill();c.strokeStyle='rgba(255,255,255,.38)';c.lineWidth=2;c.stroke()},
  gl=(x,y,r,col)=>{const q=c.createRadialGradient(x,y,0,x,y,r);q.addColorStop(0,col);q.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=q;c.fillRect(0,0,W,H)},
  star=(x,y,r)=>{c.beginPath();c.moveTo(x,y-r);c.quadraticCurveTo(x,y,x+r,y);c.quadraticCurveTo(x,y,x,y+r);c.quadraticCurveTo(x,y,x-r,y);c.quadraticCurveTo(x,y,x,y-r);c.fill()},
  fit=(t,w,fs,wt)=>{c.font=wt+' '+fs+'px '+F;while(fs>20&&c.measureText(t).width>w){fs-=2;c.font=wt+' '+fs+'px '+F}return fs};
  const g=c.createLinearGradient(0,0,W,H);g.addColorStop(0,T[1]);g.addColorStop(.55,T[2]);g.addColorStop(1,T[3]);c.fillStyle=g;c.fillRect(0,0,W,H);
  gl(W*.9,H*.04,650,'rgba(255,255,255,'+(dk?.16:.34)+')');gl(W*.02,H*.55,520,dk?'rgba(56,189,248,.22)':'rgba(255,255,255,.18)');gl(W*.88,H*.96,620,dk?'rgba(236,72,153,.26)':'rgba(255,255,255,.22)');
  c.fillStyle='rgba(255,255,255,.07)';for(let x=30;x<W;x+=40)for(let y=30;y<H;y+=40){c.beginPath();c.arc(x,y,2,0,7);c.fill()}
  c.fillStyle='rgba(255,255,255,.85)';star(W*.8,205,26);star(W*.92,330,15);star(72,H*.94,19);c.strokeStyle='rgba(255,255,255,.28)';c.lineWidth=2;rr(24,24,W-48,H-48,46);c.stroke();
  const lm=c.createLinearGradient(X,58,X+84,142);lm.addColorStop(0,T[1]);lm.addColorStop(1,T[3]);c.fillStyle='#fff';rr(X,58,84,84,24);c.fill();c.fillStyle=lm;c.textAlign='center';c.font='700 54px Inter,'+F;c.fillText(String(PS.brand||'B').trim().charAt(0).toUpperCase(),X+42,116);
  c.textAlign='left';c.fillStyle='#fff';c.font='700 50px Inter,'+F;c.fillText(PS.brand||'',X+106,115);
  c.font='600 28px '+F;const bw=c.measureText('⚡ ২৪/৭ সাপোর্ট').width+52;glass(W-X-bw,72,bw,56);c.fillStyle='#fff';c.fillText('⚡ ২৪/৭ সাপোর্ট',W-X-bw+26,110);
  c.save();c.shadowColor='rgba(0,0,0,.28)';c.shadowBlur=22;c.shadowOffsetY=6;c.fillStyle='#fff';c.font='700 '+fit(PS.head||'',CW,88,700)+'px '+F;c.fillText(PS.head||'',X,262);c.restore();
  if(PS.tag){c.font='600 30px '+F;const tw=Math.min(CW,c.measureText(PS.tag).width+56);glass(X,290,tw,58);c.fillStyle='#fff';c.fillText(PS.tag,X+28,330,tw-40)}
  const tall=H>=1350,pillY=H-124,ctaY=PS.con?pillY-112:H-152,fy=ctaY-84,bot=(tall?fy:ctaY)-30,y0=385,n=L.length,ch=n?Math.min(140,(bot-y0-(n-1)*14)/n):0,mn=n?Math.min(...L.map(r=>pVal(r)||1e9)):0;
  if(!n){c.textAlign='center';c.fillStyle='#fff';c.font='600 38px '+F;c.fillText('নিচ থেকে সার্ভিস বাছুন',W/2,H/2)}
  L.forEach((r,i)=>{const y=y0+i*(ch+14),k=platKey(r.platform_label),bc=(typeof BR!=='undefined'&&BR[k])||T[1],rad=ch*.33;
    c.save();if(dk){c.fillStyle='rgba(255,255,255,.11)';rr(X,y,CW,ch,30);c.fill();c.strokeStyle='rgba(255,255,255,.3)';c.lineWidth=2;c.stroke()}else{c.shadowColor='rgba(0,0,0,.2)';c.shadowBlur=24;c.shadowOffsetY=9;c.fillStyle='rgba(255,255,255,.96)';rr(X,y,CW,ch,30);c.fill()}c.restore();
    c.save();rr(X,y,CW,ch,30);c.clip();c.fillStyle=bc;c.fillRect(X,y,11,ch);c.restore();const cx=X+26+rad+6,cy=y+ch/2;c.save();c.shadowColor='rgba(0,0,0,.22)';c.shadowBlur=10;c.shadowOffsetY=3;c.fillStyle=LG[i]?'#fff':bc;c.beginPath();c.arc(cx,cy,rad,0,7);c.fill();c.restore();
    if(LG[i]){const s2=rad*1.5;c.drawImage(LG[i],cx-s2/2,cy-s2/2,s2,s2)}else{c.fillStyle='#fff';c.textAlign='center';c.font='700 '+Math.round(rad*1.05)+'px Inter,'+F;c.fillText(String(r.platform_label||'?').charAt(0).toUpperCase(),cx,cy+rad*.36)}
    c.textAlign='left';const tx=cx+rad+22,tw=CW-(tx-X)-250,fs=ch>=110?33:30;c.fillStyle=dk?'#fff':'#111827';c.font='600 '+fs+'px '+F;const ln=pWrap(c,r.name,tw,ch>=100?2:1),sub=ch>=96&&ln.length<2,lh=fs*1.2,top=cy-((ln.length+(sub?.75:0))*lh)/2+fs*.88;
    ln.forEach((t,j)=>c.fillText(t,tx,top+j*lh));if(sub){c.fillStyle=dk?'rgba(255,255,255,.72)':'#6B7280';c.font='400 24px '+F;c.fillText(r.platform_label+' • Min '+r.min+' – Max '+r.max,tx,top+lh*.95,tw)}
    const pw=224,ph=Math.min(92,ch-22),px=X+CW-pw-20,py=y+(ch-ph)/2,pg=c.createLinearGradient(px,py,px+pw,py+ph);if(dk){pg.addColorStop(0,'#FDE047');pg.addColorStop(1,'#F59E0B')}else{pg.addColorStop(0,T[1]);pg.addColorStop(1,T[2])}
    c.save();c.shadowColor=dk?'rgba(245,158,11,.5)':'rgba(0,0,0,.25)';c.shadowBlur=16;c.shadowOffsetY=5;c.fillStyle=pg;rr(px,py,pw,ph,ph/2);c.fill();c.restore();
    c.fillStyle=dk?'#451A03':'#fff';c.textAlign='center';c.font='700 '+Math.round(ph*.42)+'px Inter,'+F;c.fillText(pPr(r),px+pw/2,py+ph*.54);c.font='400 '+Math.round(ph*.22)+'px '+F;c.fillText('প্রতি ১০০০',px+pw/2,py+ph*.82);
    {const code='কোড '+r.code;c.font='700 24px '+F;const cw2=Math.min(CW-300,c.measureText(code).width+38),cx2=X+34,cy2=y-18;c.save();c.shadowColor='rgba(0,0,0,.28)';c.shadowBlur=10;c.shadowOffsetY=3;c.fillStyle=dk?'#FDE047':T[1];rr(cx2,cy2,cw2,38,19);c.fill();c.restore();c.fillStyle=dk?'#451A03':'#fff';c.textAlign='center';c.fillText(code,cx2+cw2/2,cy2+28,cw2-20)}
    if(n>1&&pVal(r)===mn&&ch>=84){c.fillStyle='#FDE047';rr(X+CW-190,y-13,160,32,16);c.fill();c.fillStyle='#78350F';c.font='700 20px '+F;c.fillText('★ সেরা দাম',X+CW-110,y+10)}});
  if(tall){c.font='600 27px '+F;['⚡ দ্রুত ডেলিভারি','🔒 নিরাপদ পেমেন্ট','💬 ২৪/৭ সাপোর্ট'].forEach((t,i)=>{const x=X+i*330;glass(x,fy,300,58);c.fillStyle='#fff';c.textAlign='center';c.fillText(t,x+150,fy+39,270)})}
  const cw=720,cx0=(W-cw)/2,cg=c.createLinearGradient(cx0,0,cx0+cw,0);if(dk){cg.addColorStop(0,'#FDE047');cg.addColorStop(1,'#F59E0B')}else{cg.addColorStop(0,'#fff');cg.addColorStop(1,'#F3F4F6')}
  c.save();c.shadowColor='rgba(0,0,0,.32)';c.shadowBlur=32;c.shadowOffsetY=12;c.fillStyle=cg;rr(cx0,ctaY,cw,92,46);c.fill();c.restore();
  c.textAlign='left';c.fillStyle=dk?'#451A03':T[1];c.font='700 '+fit(PS.cta||'',cw-170,42,700)+'px '+F;c.fillText(PS.cta||'',cx0+50,ctaY+60);
  c.fillStyle=dk?'#451A03':T[1];c.beginPath();c.arc(cx0+cw-52,ctaY+46,32,0,7);c.fill();c.fillStyle=dk?'#FDE047':'#fff';c.textAlign='center';c.font='700 40px Inter,'+F;c.fillText('→',cx0+cw-52,ctaY+59);
  if(PS.con){c.font='600 34px '+F;const w=c.measureText(PS.con).width+72;glass(W/2-w/2,pillY,w,64);c.fillStyle='#fff';c.textAlign='center';c.fillText(PS.con,W/2,pillY+44)}}
const pCap=()=>(PS.head+'\n\n'+pSel().map(r=>'✅ '+r.name+' | কোড: '+r.code+' — '+pPr(r)+' / ১০০০').join('\n')+'\n\n'+PS.cta+(PS.con?'\n'+PS.con:'')).trim();
async function poster(){cur=null;$('#title').textContent='পোস্টার';$('#back').hidden=true;const el=$('#main');el.innerHTML=nav('poster')+'<div class="sk"></div>';
  try{if(!CAT)await catSyncNow();await priceMeta().catch(()=>{});try{await allReady()}catch(e){}}catch(e){if(!authFail(e))el.innerHTML=nav('poster')+`<div class="card"><p class="err">${esc(e.message)}</p></div>`;return}
  PAI=null;const all=pItems(),pc={};all.forEach(it=>{pc[it.platform_label]=(pc[it.platform_label]||0)+1});const pls=Object.keys(pc).sort((a,b)=>pc[b]-pc[a]),prv=lpRows().length>0;if(PS.plat&&!pc[PS.plat])PS.plat='';if(!pItems().some(it=>PSEL.has(it.key)))PSEL.clear();if(!PSEL.size)pAuto();let lim=60;
  el.innerHTML=nav('poster')+`<div class="card pst"><canvas id="pcv" role="img" aria-label="পোস্টার প্রিভিউ"></canvas><div class="acts"><button class="btn" id="pSh">↗ শেয়ার করুন</button><button class="sm" id="pDl">⤓ ছবি</button><button class="sm" id="pCp">⧉ ক্যাপশন</button></div></div>
  <div class="card"><b>🎨 ডিজাইন</b><div class="chips" style="margin:10px 0 6px">${PTH.map((t,i)=>`<button class="chip pth" data-th="${i}" aria-pressed="${PS.th===i}" style="background:linear-gradient(135deg,${t[1]},${t[2]},${t[3]});color:#fff;border:0">${t[0]}</button>`).join('')}</div><div class="chips">${PSZ.map((z,i)=>`<button class="chip" data-sz="${i}" aria-pressed="${PS.sz===i}">${z[0]}</button>`).join('')}</div>
  <label for="pB">ব্র্যান্ড</label><input id="pB" maxlength="30" value="${esc(PS.brand)}"><label for="pH">শিরোনাম</label><input id="pH" maxlength="40" value="${esc(PS.head)}"><label for="pT">ট্যাগলাইন</label><input id="pT" maxlength="60" value="${esc(PS.tag)}"><label for="pC">বোতামের লেখা</label><input id="pC" maxlength="30" value="${esc(PS.cta)}"><label for="pN">যোগাযোগ (WhatsApp / টেলিগ্রাম / সাইট)</label><input id="pN" maxlength="60" value="${esc(PS.con)}" placeholder="যেমন: WhatsApp 01XXXXXXXXX"></div>
  <div class="card"><b>📋 সার্ভিস বাছুন</b> <span class="sub" id="pCnt"></span><p class="sub">${prv?'সব প্রভাইডারের সব সার্ভিস থেকে বাছা যায়।':'প্রভাইডার ডেটা লোড হয়নি — এখন শুধু সাইটের চালু সার্ভিস দেখাচ্ছে।'} দাম সাইটের হিসাবে বসে (খরচ ×৳131 + স্ল্যাব মার্কআপ), কাস্টম দাম থাকলে সেটাই। পোস্টারে সবসময় দাম কম→বেশি সাজানো থাকে।</p>
  <div class="bar" style="margin-top:6px"><select id="pP" aria-label="প্ল্যাটফর্ম"><option value="">সব প্ল্যাটফর্ম (${bn(all.length)})</option>${pls.map(l=>`<option value="${esc(l)}" ${l===PS.plat?'selected':''}>${esc(l)} (${bn(pc[l])})</option>`).join('')}</select><input id="pQ" type="search" placeholder="নাম / ID খুঁজুন" value="${esc(PS.q)}" aria-label="খুঁজুন"></div>
  ${prv?'<div class="sub" style="margin-top:10px">প্রভাইডার (একাধিক বাছা যায়)</div><div class="chips" id="pPv"></div>':''}<div class="sub" style="margin-top:6px">সার্ভিসের ধরন (একাধিক বাছা যায়)</div><div class="chips" id="pTy"></div>${prv?'<div class="chips" id="pSt"></div>':''}
  <div class="sub" style="margin-top:8px">দাম দিয়ে খুঁজুন (প্রতি ১০০০, ৳)</div><div class="bar"><input id="pLo" type="text" inputmode="decimal" placeholder="সর্বনিম্ন" value="${esc(PS.lo)}" aria-label="সর্বনিম্ন দাম"><input id="pHi" type="text" inputmode="decimal" placeholder="সর্বোচ্চ" value="${esc(PS.hi)}" aria-label="সর্বোচ্চ দাম"></div>
  <div class="chips" style="margin-top:8px"><button class="chip" id="pSo" aria-pressed="false"></button></div>
  <div class="acts"><button class="sm" id="pTop"></button><button class="sm" id="pAu">✦ অটো বাছাই</button><button class="sm" id="pCl">সব মুছুন</button></div><p class="sub" id="pTot"></p><div id="pL"></div></div>`;
  const cap=()=>PSZ[PS.sz][3],sv=()=>ls.set('pb_poster',JSON.stringify({brand:PS.brand,head:PS.head,tag:PS.tag,cta:PS.cta,con:PS.con,th:PS.th,sz:PS.sz})),dr=()=>{clearTimeout(pT);pT=setTimeout(pDraw,120)},cnt=()=>{$('#pCnt').textContent=bn(PSEL.size)+'/'+bn(cap())+' বাছা';$('#pTop').textContent='↧ ফিল্টারের প্রথম '+bn(cap())+'টি বাছুন';$('#pSo').textContent=PS.so?'↓ দাম বেশি→কম':'↑ দাম কম→বেশি'};
  const chips=()=>{const q=PS.q,vc={},tc={},sc={'':0,on:0,off:0};all.forEach(it=>{if(PS.plat&&it.platform_label!==PS.plat)return;if(q&&!qOK(q,String(it.r.name)+' '+it.code+' '+it.cat+' '+it.prov))return;vc[it.prov]=(vc[it.prov]||0)+1;if(PS.pv.length&&!PS.pv.includes(it.prov))return;tc[it.ty]=(tc[it.ty]||0)+1;if(PS.ty.length&&!PS.ty.includes(it.ty))return;sc['']++;sc[it.on?'on':'off']++});
    $('#pTy').innerHTML=`<button class="chip" data-ty="" aria-pressed="${!PS.ty.length}">সব ধরন</button>`+[...new Set(Object.keys(tc).concat(PS.ty))].sort((a,b)=>(tc[b]||0)-(tc[a]||0)).map(k=>`<button class="chip" data-ty="${esc(k)}" aria-pressed="${PS.ty.includes(k)}">${esc(k)} <small>${bn(tc[k]||0)}</small></button>`).join('');
    if(prv){$('#pPv').innerHTML=`<button class="chip" data-pv="" aria-pressed="${!PS.pv.length}">সব প্রভাইডার</button>`+Object.keys(vc).sort((a,b)=>vc[b]-vc[a]).map(v=>`<button class="chip" data-pv="${esc(v)}" aria-pressed="${PS.pv.includes(v)}">${esc(v)} <small>${bn(vc[v])}</small></button>`).join('');
      $('#pSt').innerHTML=[['','সব'],['on','সাইটে চালু'],['off','সাইটে নেই']].map(a=>`<button class="chip" data-st="${a[0]}" aria-pressed="${(PS.on||'')===a[0]}">${a[1]} <small>${bn(sc[a[0]])}</small></button>`).join('')}};
  const list=()=>{const R=pFil(),sh=R.slice(0,lim);$('#pL').innerHTML=sh.map(it=>`<label class="prow"><input type="checkbox" data-c="${esc(it.key)}" ${PSEL.has(it.key)?'checked':''}><span>${esc(pName(it))}<br><small class="sub">${esc(it.platform_label)} · ${esc(it.ty)}${prv?' · '+esc(it.prov):''} · ID ${esc(it.code)}${it.on?' · ✓ সাইটে':''} · <b>${esc(pPr(it))}</b></small></span></label>`).join('')+(R.length>lim?`<button class="sm" id="pMore">আরও ${bn(R.length-lim)}টি দেখান</button>`:'')||'<p class="sub">কিছু পাওয়া যায়নি</p>';$('#pTot').textContent=bn(R.length)+'টি মিলেছে · '+(PS.so?'দাম বেশি→কম':'দাম কম→বেশি');cnt()};
  const chg=()=>{sv();dr()},inp=(id,k)=>{$(id).oninput=e=>{PS[k]=e.target.value;chg()}};inp('#pB','brand');inp('#pH','head');inp('#pT','tag');inp('#pC','cta');inp('#pN','con');
  $('#pQ').oninput=e=>{PS.q=e.target.value;lim=60;chips();list()};$('#pP').onchange=e=>{PS.plat=e.target.value;lim=60;chips();list()};
  const pr=(id,k)=>{$(id).oninput=e=>{const v=e.target.value.trim();PS[k]=v===''?'':pNum(v);lim=60;list()}};pr('#pLo','lo');pr('#pHi','hi');
  $('#pTy').onclick=e=>{const b=e.target.closest('[data-ty]');if(!b)return;const k=b.dataset.ty;PS.ty=!k?[]:PS.ty.includes(k)?PS.ty.filter(x=>x!==k):PS.ty.concat(k);lim=60;chips();list()};
  if(prv)$('#pPv').onclick=e=>{const b=e.target.closest('[data-pv]');if(!b)return;const k=b.dataset.pv;PS.pv=!k?[]:PS.pv.includes(k)?PS.pv.filter(x=>x!==k):PS.pv.concat(k);lim=60;chips();list()};
  $('#pSo').onclick=()=>{PS.so=PS.so?0:1;list();dr()};if(prv)$('#pSt').onclick=e=>{const b=e.target.closest('[data-st]');if(!b)return;PS.on=b.dataset.st;lim=60;chips();list()};
  el.querySelectorAll('[data-th]').forEach(b=>b.onclick=()=>{PS.th=+b.dataset.th;el.querySelectorAll('[data-th]').forEach(x=>x.setAttribute('aria-pressed',x===b));chg()});
  el.querySelectorAll('[data-sz]').forEach(b=>b.onclick=()=>{PS.sz=+b.dataset.sz;el.querySelectorAll('[data-sz]').forEach(x=>x.setAttribute('aria-pressed',x===b));[...PSEL].slice(cap()).forEach(c=>PSEL.delete(c));cnt();chg()});
  $('#pL').onchange=e=>{const c=e.target.dataset.c;if(!c)return;if(e.target.checked){if(PSEL.size>=cap()){e.target.checked=false;toast('এই সাইজে সর্বোচ্চ '+bn(cap())+'টি — বড় সাইজ বাছুন');return}PSEL.add(c)}else PSEL.delete(c);cnt();dr()};
  $('#pL').onclick=e=>{if(e.target.id==='pMore'){lim+=60;list()}};
  $('#pTop').onclick=()=>{PSEL.clear();pFil().slice(0,cap()).forEach(it=>PSEL.add(it.key));list();dr()};$('#pAu').onclick=()=>{pAuto();list();dr()};$('#pCl').onclick=()=>{PSEL.clear();list();dr()};
  const blob=async()=>{await pDraw();return new Promise(r=>$('#pcv').toBlob(r,'image/png'))},dl=b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='poster-'+Date.now()+'.png';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)};
  $('#pDl').onclick=async()=>{dl(await blob());toast('ছবি ডাউনলোড হয়েছে ✔')};
  $('#pCp').onclick=async()=>{try{await navigator.clipboard.writeText(pCap());toast('ক্যাপশন কপি হয়েছে ✔')}catch(e){toast('কপি করা যায়নি')}};
  $('#pSh').onclick=async()=>{const b=await blob(),f=new File([b],'poster.png',{type:'image/png'});if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],text:pCap(),title:PS.brand});return}catch(e){if(e&&e.name==='AbortError')return}}dl(b);toast('সরাসরি শেয়ার নেই — ছবি ডাউনলোড হয়েছে, গ্যালারি থেকে শেয়ার করুন')};
  chips();list();pDraw()}
/* ---------- v75: সেরা সার্ভিস · সরাসরি টেস্ট অর্ডার · স্পিড বিস্তারিত ---------- */
const mnT=s=>!(s>0)?'—':s<60?'১ মিনিটের কম':s<5400?bn(Math.round(s/60))+' মিনিট':s<172800?bn(Math.round(s/360)/10)+' ঘণ্টা':bn(Math.round(s/8640)/10)+' দিন';
const dT=ms=>ms?new Date(ms).toLocaleString('bn-BD',{timeZone:'Asia/Dhaka',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):'—';
const kTk=r=>'৳'+bn(Math.round((+r.cost_bdt_k||0)*100)/100)+' / ১০০০';
let BS={label:'',type:'',q:'',refill:false,fx:131},bcn=0,SP={st:'all',prov:''},spTm=null,spTk=null;
const bcard=(r,i)=>{const s=r.stats,
  sp=s?`<div class="bm g">⏱ শুরু ~${mnT(s.start_med)} · মোট ~${mnT(s.total_med)} · ড্রপ ${bn(s.bad)}% · টেস্ট ${bn(s.n)}টি${s.open?' ('+bn(s.open)+'টি চলছে)':''}</div>`:'<div class="bm sub">অপরীক্ষিত — 🧪 টেস্ট অর্ডার দিয়ে স্পিড মাপুন</div>',
  stt=r.state==='on'?'<span class="tag">সাইটে চালু</span>':r.state==='conflict'?'<span class="tag">সাইটে অন্য প্রভাইডারে</span>':'';
  return `<div class="card bcd"><div class="bsh"><b>#${bn(i+1)}</b><span class="tag">স্কোর ${bn(r.score)}</span>${r.tested?'<span class="tag">টেস্টেড ✓</span>':''}${+r.refill?'<span class="tag">♻ রিফিল</span>':''}${stt}</div><b class="bnm">${esc(r.name)}</b><div class="sub">${esc(r.provider)} · আইডি ${esc(r.service_id)} · ${bn(r.min)}–${bn(r.max)}</div><div class="bm">${kTk(r)} <span class="sub">(গ্রুপের ${bn(r.price_pct)}% এর চেয়ে সস্তা)</span></div>${sp}<div class="acts"><button type="button" class="sm" data-a="o" data-i="${i}">🧪 অর্ডার দিন</button>${r.state==='on'?'':`<button type="button" class="sm" data-a="a" data-i="${i}">সাইটে চালু করুন</button>`}</div></div>`};
async function best(){
  cur=null;$('#title').textContent='সেরা সার্ভিস';$('#back').hidden=true;const el=$('#main'),my=rid;
  el.innerHTML=nav('best')+'<div class="sk"></div>';
  let P=[];
  try{const d=await api('svc_platforms');P=(d.platforms||[]).filter(p=>p.total>0)}
  catch(e){if(!authFail(e))el.innerHTML=nav('best')+`<div class="card"><p class="err">${esc(e.message)}</p></div>`;return}
  if(my!==rid)return;
  if(!P.some(p=>p.label===BS.label)){BS.label=(popSort(P)[0]||P[0]||{}).label||'';BS.type=''}
  el.innerHTML=nav('best')+`<p class="sub">১০ প্রভাইডারের একই ধরনের সার্ভিস দাম + স্পিড-টেস্ট + ড্রপ মিলিয়ে সাজানো। টেস্ট-করা সার্ভিস আগে আসে।</p><select id="bpl" class="plmore" aria-label="প্ল্যাটফর্ম">${P.map(p=>`<option value="${esc(p.label)}"${p.label===BS.label?' selected':''}>${esc(p.label)} (${bn(p.total)}টি)</option>`).join('')}</select><div class="chips" id="bty" style="margin-top:10px"></div><div class="bar"><input id="bq" type="search" placeholder="নাম বা আইডি" aria-label="খুঁজুন" value="${esc(BS.q)}"></div><div class="chips"><button type="button" class="chip" id="brf" aria-pressed="${BS.refill}">♻ শুধু রিফিল</button></div><div id="bl"></div>`;
  let rows=[];
  const load=async()=>{const box=$('#bl'),k=++bcn;if(!box)return;box.innerHTML='<div class="sk"></div>';
    try{const d=await api('svc_best',{label:BS.label,type:BS.type,q:BS.q,refill:BS.refill,limit:15});if(k!==bcn||!$('#bl'))return;
      BS.type=d.type;BS.fx=d.fx||131;rows=d.rows||[];
      $('#bty').innerHTML=(d.types||[]).map(t=>`<button type="button" class="chip" data-t="${esc(t[0])}" aria-pressed="${t[0]===d.type}">${esc(t[0])}<small>${bn(t[1])}</small></button>`).join('');
      $('#bty').querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{BS.type=b.dataset.t;load()});
      box.innerHTML=`<p class="sub">${bn(d.total)}টি সার্ভিস থেকে সেরা ${bn(rows.length)}টি · টেস্ট-করা ${bn(d.tested_n)}টি</p>`+(rows.length?rows.map(bcard).join(''):'<div class="card empty">কিছু পাওয়া যায়নি</div>')}
    catch(e){if(k!==bcn)return;if(!authFail(e))box.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p></div>`}};
  $('#bl').onclick=e=>{const b=e.target.closest('button[data-a]');if(!b)return;const r=rows[+b.dataset.i];if(!r)return;if(b.dataset.a==='o')ordDlg(r);else addList([r])};
  $('#bpl').onchange=e=>{BS.label=e.target.value;BS.type='';load()};
  let qt2=null;$('#bq').oninput=e=>{clearTimeout(qt2);qt2=setTimeout(()=>{BS.q=e.target.value.trim();load()},350)};
  $('#brf').onclick=e=>{BS.refill=!BS.refill;e.currentTarget.setAttribute('aria-pressed',BS.refill);load()};
  load()}
/* সরাসরি টেস্ট অর্ডার: দুইবার ট্যাপ (নিশ্চিত করা) + একই req_id তাই নেট কাটলেও ডবল অর্ডার হয় না */
function ordDlg(r){
  let d=$('#ordD');if(!d){d=document.createElement('dialog');d.id='ordD';d.setAttribute('aria-labelledby','ordT');document.body.appendChild(d)}
  const mn=Math.max(1,+r.min||1),mx=+r.max||0,rate=+r.rate||0,fx=+r._fx>0?+r._fx:(BS.fx||131),req='o'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);let armed=false,done=false;
  d.innerHTML=`<form method="dialog" id="ordF"><h3 id="ordT" style="margin:0 0 8px">🧪 টেস্ট অর্ডার</h3><p class="sub" id="ordN"></p><label for="ordL">লিংক / ইউজারনেম</label><input id="ordL" autocomplete="off" inputmode="url" placeholder="https://…"><label for="ordQ">পরিমাণ (${bn(mn)}–${mx?bn(mx):'∞'})</label><input id="ordQ" type="number" inputmode="numeric" min="${mn}"${mx?` max="${mx}"`:''} value="${mn}"><p class="bm" id="ordC"></p><p class="sub">খরচ প্রভাইডারের ব্যালেন্স থেকে কাটবে (আনুমানিক)। অর্ডারটি স্পিড-টেস্টে নিজে থেকে ধরা পড়বে।</p><p id="ordE" class="err" role="alert"></p><div class="acts"><button type="button" class="sm" id="ordX">বন্ধ</button><button type="button" class="btn" id="ordGo">অর্ডার দিন</button></div></form>`;
  $('#ordN').textContent=r.provider+' · #'+r.service_id+' · '+r.name;
  const go=$('#ordGo'),E=$('#ordE'),cost=()=>Math.round(rate*fx*(Math.floor(+$('#ordQ').value)||0)/1000*100)/100,
    upd=()=>{$('#ordC').textContent='আনুমানিক খরচ: ৳'+bn(cost());armed=false;go.textContent='অর্ডার দিন'};
  $('#ordQ').oninput=upd;$('#ordL').oninput=()=>{armed=false;go.textContent='অর্ডার দিন'};upd();
  $('#ordX').onclick=()=>d.close();$('#ordF').onsubmit=e=>{e.preventDefault();go.click()};
  go.onclick=async()=>{
    if(done){d.close();location.hash='spd';return}
    E.textContent='';const link=$('#ordL').value.trim(),q=Math.floor(+$('#ordQ').value)||0;
    if(link.length<3||/\s/.test(link)){E.textContent='লিংক/ইউজারনেম দিন (ফাঁকা ছাড়া)';return}
    if(q<mn||(mx&&q>mx)){E.textContent='পরিমাণ '+bn(mn)+(mx?'–'+bn(mx):'+')+' এর মধ্যে দিন';return}
    if(!armed){armed=true;go.textContent='নিশ্চিত — ৳'+bn(cost())+' কাটবে, আবার ট্যাপ করুন';return}
    go.disabled=true;go.textContent='পাঠানো হচ্ছে…';
    try{const o=await api('svc_order',{provider:r.provider,service:r.service_id,link,quantity:q,confirm:true,req_id:req});
      done=true;$('#ordC').textContent='';$('#ordT').textContent='✅ অর্ডার গেছে';try{const L=spLoad(SPK_L)||[];L.unshift({src:'studio',provider:r.provider,service_id:r.service_id,provider_order:o.provider_order,name:r.name,quantity:o.quantity,cost_bdt:o.cost_bdt,link,status:'Pending',ordered_at:Date.now(),last_checked:Date.now()});spSave(SPK_L,L.slice(0,30))}catch(_){}
      $('#ordN').textContent='প্রভাইডার অর্ডার #'+o.provider_order+' · পরিমাণ '+bn(o.quantity)+' · খরচ ≈ ৳'+bn(o.cost_bdt);
      go.textContent='স্পিড দেখুন';go.disabled=false;toast('টেস্ট অর্ডার গেছে ✔')}
    catch(e){if(authFail(e)){d.close();return}
      go.disabled=false;armed=false;go.textContent='অর্ডার দিন';
      if(e.code==='net'){E.textContent=e.message+' — অর্ডার গিয়েছে কিনা স্পিড পাতায় দেখুন। আবার চাপলে একই অনুরোধ যাবে, ডবল হবে না।';return}
      E.textContent=e.message||'ব্যর্থ';
      if(e.code==='unknown_result'||e.code==='in_flight'){go.disabled=true;go.textContent='আগে স্পিড পাতা দেখুন'}}};
  d.showModal()}
/* স্পিড পাতা (v77): শুধু স্টুডিও থেকে দেওয়া অর্ডার · লাইভ ঘড়ি (প্রতি সেকেন্ডে) · চলমান থাকলে ২০ সেকেন্ডে প্রভাইডার থেকে মেলানো · অর্ডার শেষ হলে রিপোর্ট */
const SPK_L='pb_sp_local',SPK_N='pb_sp_notified';
const spLoad=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch(_){return null}},spSave=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
const spKey=r=>r.provider+'|'+r.provider_order;
const spFin=r=>r.completed_at>0||/completed|partial|cancel|refund|fail|error/.test(String(r.status||'').toLowerCase());
const spBad=r=>/partial|cancel|refund|fail|error/.test(String(r.status||'').toLowerCase());
let SPoff=0;
const spNow=()=>Date.now()+SPoff;
const lvT=s=>{s=Math.max(0,Math.floor(s));if(s<60)return bn(s)+' সে.';if(s<3600)return bn(Math.floor(s/60))+' মি. '+bn(s%60)+' সে.';const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return bn(h)+' ঘ. '+bn(m)+' মি. '+bn(s%60)+' সে.'};
const medOf=a=>{if(!a.length)return 0;a=a.slice().sort((x,y)=>x-y);const m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2};
/* সার্ভারের সারি + স্থানীয়ভাবে সদ্য-দেওয়া অর্ডার (সার্ভারে ধরা না পড়া পর্যন্ত) — শুধু স্টুডিও */
function spRows(d){
  const srv=(d&&d.rows||[]).filter(r=>r.src==='studio'),seen=new Set(srv.map(spKey)),now=Date.now();
  const loc=(spLoad(SPK_L)||[]).filter(l=>!seen.has(spKey(l))&&now-l.ordered_at<7200000);spSave(SPK_L,loc);
  return loc.map(l=>Object.assign({},l,{_local:1})).concat(srv).sort((a,b)=>(b.ordered_at||0)-(a.ordered_at||0))}
/* প্রতি সার্ভিসের গড়/মিডিয়ান — শুধু স্টুডিও অর্ডার থেকে */
function spStats(rows){const g={};rows.forEach(r=>{const k=r.provider+'|'+r.service_id,s=g[k]||(g[k]={k,n:0,st:[],tt:[],bad:0,fin:0});s.n++;if(r.started_at>0&&r.start_secs>0)s.st.push(r.start_secs);if(spFin(r)){s.fin++;if(spBad(r))s.bad++;else if(r.total_secs>0)s.tt.push(r.total_secs)}});
  return Object.keys(g).map(k=>{const s=g[k];return{k,n:s.n,start_n:s.st.length,start_med:medOf(s.st),ok:s.tt.length,total_med:medOf(s.tt),bad:s.fin?Math.round(s.bad/s.fin*100):0}})}
/* রিপোর্ট (লেখা) — কপি/ডাউনলোড/শেয়ার করা যায় */
function spReport(r){const L=[],q=+r.quantity||0,dl=r.delivered!=null?+r.delivered:null,el=r.completed_at>0&&r.ordered_at>0?(r.completed_at-r.ordered_at)/1000:(r.total_secs||0),
  st=r.started_at>0?(r.start_secs>0?r.start_secs:(r.started_at-r.ordered_at)/1000):0,dur=r.started_at>0&&r.completed_at>0?(r.completed_at-r.started_at)/1000:0,pct=q&&dl!=null?Math.min(100,Math.round(dl/q*100)):null;
  L.push('📄 স্পিড টেস্ট রিপোর্ট');L.push('────────────────');
  L.push('প্রভাইডার: '+r.provider);L.push('সার্ভিস: #'+r.service_id+(r.name?' · '+r.name:''));L.push('প্রভাইডার অর্ডার: #'+r.provider_order+(r.platform?' · '+r.platform:''));
  if(r.link)L.push('লিংক: '+r.link);L.push('স্ট্যাটাস: '+(r.status||'—'));L.push('');
  L.push('⏱ সময়');L.push('• অর্ডার: '+dT(r.ordered_at));L.push('• শুরু: '+(r.started_at>0?dT(r.started_at)+' ('+mnT(st)+' পরে)':'শুরু হয়নি'));
  L.push('• শেষ: '+(r.completed_at>0?dT(r.completed_at):'—'));if(el>0)L.push('• মোট সময়: '+mnT(el));if(dur>0)L.push('• শুরু থেকে শেষ: '+mnT(dur));L.push('');
  L.push('📦 ডেলিভারি');L.push('• পরিমাণ: '+(q?bn(q):'—'));if(dl!=null)L.push('• ডেলিভারি: '+bn(dl)+(pct!=null?' ('+bn(pct)+'%)':''));
  if(r.start_count!=null)L.push('• শুরুর কাউন্ট: '+bn(r.start_count));if(q&&dl!=null&&q>dl)L.push('• ঘাটতি: '+bn(q-dl));
  if(dur>0&&dl>0)L.push('• গড় গতি: ~'+bn(Math.round(dl/(dur/60)))+' / মিনিট');if(r.cost_bdt!=null)L.push('• খরচ ≈ ৳'+bn(r.cost_bdt));L.push('');
  const v=[];if(r.started_at>0)v.push(st<=900?'শুরু খুব দ্রুত (১৫ মিনিটের মধ্যে)':st<=3600?'শুরু ভালো (১ ঘণ্টার মধ্যে)':'শুরু ধীর');
  if(pct!=null)v.push(pct>=100?'পুরো ডেলিভারি হয়েছে':pct>=90?'প্রায় পুরো ডেলিভারি ('+bn(pct)+'%)':'ঘাটতি আছে ('+bn(pct)+'% ডেলিভারি)');
  if(v.length){L.push('✅ মূল্যায়ন: '+v.join(' · '))}
  L.push('রিপোর্ট তৈরি: '+dT(Date.now()));return L.join('\n')}
function spReportAll(rows){const f=rows.filter(spFin);const L=['📊 স্পিড টেস্ট — সারসংক্ষেপ','────────────────','শেষ হওয়া অর্ডার: '+bn(f.length)+' / মোট '+bn(rows.length),''];
  spStats(rows).filter(s=>s.n).sort((a,b)=>((b.start_n>0)-(a.start_n>0))||((a.start_med||1e12)-(b.start_med||1e12))).forEach(s=>{const p=s.k.split('|');L.push(p[0]+' #'+p[1]+' — শুরু '+(s.start_n?'~'+mnT(s.start_med):'হয়নি')+' · মোট '+(s.ok?'~'+mnT(s.total_med):'—')+' · ড্রপ '+bn(s.bad)+'% · টেস্ট '+bn(s.n)+'টি')});
  L.push('');L.push('রিপোর্ট তৈরি: '+dT(Date.now()));return L.join('\n')}
function spRepDlg(txt,title){let d=$('#repD');if(!d){d=document.createElement('dialog');d.id='repD';d.setAttribute('aria-labelledby','repT');document.body.appendChild(d)}
  d.innerHTML='<h3 id="repT" style="margin:0 0 8px"></h3><pre class="rep" id="repP"></pre><div class="acts"><button type="button" class="sm" id="repX">বন্ধ</button><button type="button" class="sm" id="repS">শেয়ার</button><button type="button" class="sm" id="repD2">⬇ ডাউনলোড</button><button type="button" class="btn" id="repC">কপি</button></div>';
  $('#repT').textContent=title||'📄 রিপোর্ট';$('#repP').textContent=txt;$('#repX').onclick=()=>d.close();
  $('#repC').onclick=async()=>{try{await navigator.clipboard.writeText(txt);toast('কপি হয়েছে ✔')}catch(_){const rg=document.createRange();rg.selectNodeContents($('#repP'));const s=getSelection();s.removeAllRanges();s.addRange(rg);toast('লেখা বাছা হয়েছে — কপি করুন')}};
  $('#repD2').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain;charset=utf-8'}));a.download='speed-report-'+Date.now()+'.txt';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)};
  const sh=$('#repS');if(navigator.share)sh.onclick=()=>navigator.share({text:txt}).catch(()=>{});else sh.hidden=true;
  d.showModal()}
/* অর্ডার একটু আগে শেষ হলে: টোস্ট + নোটিফিকেশন + রিপোর্টের বোতাম (প্রতিটা অর্ডারে একবারই) */
function spNotify(rows,silent){let nt=spLoad(SPK_N);const first=!nt;nt=nt||{};let ch=false;
  rows.filter(r=>!r._local&&spFin(r)).forEach(r=>{const k=spKey(r);if(nt[k])return;nt[k]=1;ch=true;if(silent||first)return;
    const m='✅ অর্ডার শেষ — #'+r.provider_order+' ('+r.provider+') · রিপোর্ট তৈরি হয়েছে';
    const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.append(m+' ');const b=document.createElement('button');b.className='sm';b.textContent='রিপোর্ট';b.onclick=()=>{t.remove();spRepDlg(spReport(r),'📄 অর্ডার #'+r.provider_order)};t.appendChild(b);document.body.appendChild(t);setTimeout(()=>t.remove(),15000);
    try{if('Notification' in window&&Notification.permission==='granted')navigator.serviceWorker.ready.then(g=>g.showNotification('স্পিড টেস্ট শেষ',{body:m,icon:'icons/admin-192.png',tag:'sp-'+k,data:{h:'spd'}}))}catch(_){}});
  if(ch)spSave(SPK_N,nt)}
const spc=r=>{const fin=spFin(r),bad=spBad(r),cls=fin?(bad?'b':'g'):'',started=r.started_at>0,done=r.completed_at>0,
  pct=r.quantity&&r.delivered!=null?Math.min(100,Math.round(r.delivered/r.quantity*100)):null,
  lk=/^https?:\/\//i.test(r.link)?`<a href="${esc(r.link)}" target="_blank" rel="noopener noreferrer">${esc(r.link.length>48?r.link.slice(0,46)+'…':r.link)}</a>`:esc(r.link||''),
  live=!fin?`<span class="tag lv"><i class="dot"></i>লাইভ</span>`:'',
  startCell=started?`<b>${dT(r.started_at)}</b><small class="g">${mnT(r.start_secs>0?r.start_secs:(r.started_at-r.ordered_at)/1000)} পরে শুরু</small>`:`<b>অপেক্ষায়</b><small class="w" data-lv="wait" data-t0="${r.ordered_at||0}">${lvT((spNow()-(r.ordered_at||spNow()))/1000)} ধরে অপেক্ষা</small>`,
  endCell=done?`<b>${dT(r.completed_at)}</b><small>মোট ${mnT(r.total_secs>0?r.total_secs:(r.completed_at-r.ordered_at)/1000)}</small>`:fin?`<b>${esc(r.status||'—')}</b>`:`<b>চলছে</b><small class="w" data-lv="run" data-t0="${r.ordered_at||0}">${lvT((spNow()-(r.ordered_at||spNow()))/1000)} হলো</small>`,
  rate=!fin&&started&&r.delivered>0&&r.started_at>0?Math.round(r.delivered/Math.max(1,(spNow()-r.started_at)/60000)):0,
  eta=rate>0&&r.remains>0?` · বাকি ~${mnT(r.remains/rate*60)}`:'';
  return `<div class="card spc ${cls}"><div class="bsh"><span class="tag">🧪 টেস্ট</span><span class="tag">${esc(r._local?'পাঠানো হয়েছে':(r.status||'—'))}</span>${live}</div><b class="bnm">${esc(r.name||r.label||('অর্ডার '+r.provider_order))}</b><div class="sub">${esc(r.provider)} · সার্ভিস ${esc(r.service_id)} · প্রভাইডার অর্ডার #${esc(r.provider_order)}${r.platform?' · '+esc(r.platform):''}</div>
<div class="tl"><div><span class="sub">অর্ডার</span><b>${dT(r.ordered_at)}</b></div><div><span class="sub">শুরু</span>${startCell}</div><div><span class="sub">শেষ</span>${endCell}</div></div>
${pct!=null?`<div class="pbar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div><div class="sub">ডেলিভারি ${bn(r.delivered)} / ${bn(r.quantity)} (${bn(pct)}%) · শুরুর কাউন্ট ${r.start_count!=null?bn(r.start_count):'—'} · বাকি ${bn(r.remains)}${rate?` · গতি ~${bn(rate)}/মিনিট${eta}`:''}</div>`:`<div class="sub">পরিমাণ ${r.quantity?bn(r.quantity):'—'}${r.start_count!=null?' · শুরুর কাউন্ট '+bn(r.start_count):''}${r._local?' · সার্ভারে মেলানো হচ্ছে…':''}</div>`}
${r.link?`<div class="sub">লিংক: ${lk}</div>`:''}<div class="sub">${r.cost_bdt!=null?'খরচ ≈ ৳'+bn(r.cost_bdt)+' · ':''}শেষ মেলানো ${dT(r.last_checked)}</div>${fin?`<div class="acts"><button type="button" class="sm" data-rep="${esc(spKey(r))}">📄 রিপোর্ট</button></div>`:''}</div>`};
async function spd(){
  cur=null;$('#title').textContent='স্পিড টেস্ট';$('#back').hidden=true;const el=$('#main'),my=rid;
  el.innerHTML=nav('spd')+'<div class="bar"><button type="button" class="btn" id="sprf" style="max-width:240px">↻ এখনই মেলান</button><span class="sub" id="spn" role="status"></span></div><div id="spb"><div class="sk"></div></div>';
  let D=null,rowsAll=[];
  const tick=()=>{if(my!==rid){clearInterval(spTk);return}const n=spNow();document.querySelectorAll('[data-lv]').forEach(x=>{const t0=+x.dataset.t0;if(t0)x.textContent=lvT((n-t0)/1000)+(x.dataset.lv==='wait'?' ধরে অপেক্ষা':' হলো')});const c=$('#spclk');if(c)c.textContent=new Date(n).toLocaleTimeString('bn-BD',{timeZone:'Asia/Dhaka',hour:'numeric',minute:'2-digit',second:'2-digit'})};
  clearInterval(spTk);spTk=setInterval(tick,1000);
  const draw=()=>{const b=$('#spb');if(!D||!b)return;
    const rows=rowsAll,provs=[...new Set(rows.map(r=>r.provider))].sort(),
      cnt={run:rows.filter(r=>!spFin(r)).length,wait:rows.filter(r=>!spFin(r)&&!(r.started_at>0)).length,ok:rows.filter(r=>spFin(r)&&!spBad(r)).length,bad:rows.filter(spBad).length},
      show=rows.filter(r=>(!SP.prov||r.provider===SP.prov)&&(SP.st==='all'||(SP.st==='run'?!spFin(r):spFin(r)))),
      S=spStats(rows.filter(r=>!SP.prov||r.provider===SP.prov)).filter(s=>s.n).sort((a,b2)=>((b2.start_n>0)-(a.start_n>0))||((a.start_med||1e12)-(b2.start_med||1e12))).slice(0,10),nm={};
    rows.forEach(r=>{const k=r.provider+'|'+r.service_id;if(r.name&&!nm[k])nm[k]=r.name});
    b.innerHTML=`<div class="card lvb"><div class="lvh"><span class="tag lv"><i class="dot"></i>লাইভ</span><b id="spclk"></b></div><div class="lvg"><div><b>${bn(rows.length)}</b><span class="sub">মোট অর্ডার</span></div><div><b class="w">${bn(cnt.run)}</b><span class="sub">চলমান</span></div><div><b class="w">${bn(cnt.wait)}</b><span class="sub">শুরুর অপেক্ষায়</span></div><div><b class="g">${bn(cnt.ok)}</b><span class="sub">সম্পন্ন</span></div><div><b class="hi">${bn(cnt.bad)}</b><span class="sub">ব্যর্থ/আংশিক</span></div></div></div>
<div class="chips">${[['all','সব'],['run','⏳ চলমান'],['done','✅ শেষ']].map(x=>`<button type="button" class="chip" data-s="${x[0]}" aria-pressed="${SP.st===x[0]}">${x[1]}</button>`).join('')}${rows.some(spFin)?'<button type="button" class="chip" id="repAll">📊 সব রিপোর্ট</button>':''}</div><select id="spp" class="plmore" aria-label="প্রভাইডার"><option value="">সব প্রভাইডার</option>${provs.map(p=>`<option${p===SP.prov?' selected':''}>${esc(p)}</option>`).join('')}</select>`
    +(S.length?`<div class="card sps"><b>শুরুর গতি — দ্রুত আগে</b>${S.map(s=>{const p=s.k.split('|');return `<div class="spr"><div><b>${esc(p[0])}</b> · #${esc(p[1])}<div class="sub">${esc((nm[s.k]||'').slice(0,60))}</div></div><div class="spv"><b class="${s.start_n?'g':''}">${s.start_n?'~'+mnT(s.start_med):'শুরু হয়নি'}</b><div class="sub">মোট ${s.ok?'~'+mnT(s.total_med):'—'} · ড্রপ ${bn(s.bad)}% · টেস্ট ${bn(s.n)}টি</div></div></div>`}).join('')}</div>`:'')
    +(show.length?show.map(spc).join(''):'<div class="card empty">'+(rows.length?'এই ফিল্টারে কোনো অর্ডার নেই।':'স্টুডিও থেকে দেওয়া কোনো অর্ডার নেই। \'সেরা\' পাতা থেকে টেস্ট অর্ডার দিন।')+'</div>')
    +'<p class="sub">শুধু স্টুডিও থেকে দেওয়া অর্ডার এখানে আসে। সময় প্রতি সেকেন্ডে চলে; চলমান অর্ডার থাকলে প্রতি ২০ সেকেন্ডে প্রভাইডার থেকে স্ট্যাটাস মেলে (শুরুর সময় ±২০ সেকেন্ড হতে পারে)।</p>';
    b.querySelectorAll('[data-s]').forEach(x=>x.onclick=()=>{SP.st=x.dataset.s;draw()});$('#spp').onchange=e=>{SP.prov=e.target.value;draw()};
    const ra=$('#repAll');if(ra)ra.onclick=()=>spRepDlg(spReportAll(rows),'📊 সব রিপোর্ট');
    b.querySelectorAll('[data-rep]').forEach(x=>x.onclick=()=>{const r=rows.find(y=>spKey(y)===x.dataset.rep);if(r)spRepDlg(spReport(r),'📄 অর্ডার #'+r.provider_order)});tick()};
  const load=async(refresh,quiet)=>{const b=$('#sprf'),n=$('#spn');if(!b)return;if(!quiet){b.disabled=true;n.textContent=refresh?'প্রভাইডার থেকে স্ট্যাটাস মেলানো হচ্ছে…':'লোড হচ্ছে…'}
    try{const d=await api('svc_spd',{refresh:!!refresh,limit:150});if(my!==rid)return;D=d;if(d.now)SPoff=d.now-Date.now();rowsAll=spRows(d);spNotify(rowsAll,false);draw();const n2=$('#spn');if(n2)n2.textContent=(refresh?'মেলানো হয়েছে · ':'')+'হালনাগাদ '+dT(spNow())}
    catch(e){if(!authFail(e)&&!quiet&&$('#spb')){if(!D)$('#spb').innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p></div>`;else{const n2=$('#spn');if(n2)n2.textContent='মেলানো যায়নি: '+e.message}}}
    const b2=$('#sprf');if(b2)b2.disabled=false};
  $('#sprf').onclick=()=>load(true);
  /* চলমান অর্ডার থাকলে প্রতি ২০ সেকেন্ডে প্রভাইডারে খোঁজ (refresh), না থাকলে প্রতি ৬০ সেকেন্ডে হালকা লোড */
  clearInterval(spTm);let last=Date.now();spTm=setInterval(()=>{if(my!==rid){clearInterval(spTm);return}if(document.hidden)return;const act=rowsAll.some(r=>!spFin(r)),gap=act?20000:60000;if(Date.now()-last>=gap-500){last=Date.now();load(act,true)}},5000);
  document.addEventListener('visibilitychange',()=>{if(my===rid&&!document.hidden){last=Date.now();load(rowsAll.some(r=>!spFin(r)),true)}},{once:true});
  const first=await (async()=>{await load(false);if(my===rid&&rowsAll.some(r=>!spFin(r))){last=Date.now();load(true,true)}})();void first}

/* সংগ্রহ/ডায়াগনস্টিক: প্রভাইডার পাতায় 'আগে সংগ্রহ করুন' এলে সেখান থেকেই সংগ্রহ বা কারণ দেখা যায় */
async function provCollect(p){const b=$('#rc'),g=$('#dg');if(!b)return;b.disabled=true;b.textContent='সংগ্রহ চলছে…';g.textContent='';
  try{const r=await api('svc_collect',{provider:p});toast(p+': '+bn(r.count)+'টি সার্ভিস সংগ্রহ হয়েছে');provider(p)}
  catch(e){if(authFail(e))return;const b2=$('#rc');if(b2){b2.disabled=false;b2.textContent='⬇ এখনই সংগ্রহ করুন'}const g2=$('#dg');if(g2)g2.innerHTML='<p class="err">সংগ্রহ ব্যর্থ: '+esc(e.message)+'</p>'}}
async function provDiag(p){const b=$('#rd'),g=$('#dg');if(!b)return;b.disabled=true;g.textContent='পরীক্ষা চলছে (প্রভাইডারে সংযোগসহ)…';
  try{const r=await api('svc_diag',{provider:p,probe:true});const g2=$('#dg');if(g2)g2.innerHTML=(r.verdict?'<p><b>'+esc(r.verdict)+'</b></p>':'')+r.steps.map(s=>`<div class="sub ${s.bad?'hi':'ok'}">${s.bad?'✖':'✔'} <b>${esc(s.k)}:</b> ${esc(s.v)}</div>`).join('')}
  catch(e){if(!authFail(e)){const g2=$('#dg');if(g2)g2.innerHTML='<p class="err">'+esc(e.message)+'</p>'}}
  const b2=$('#rd');if(b2)b2.disabled=false}
function route(){rid++;const h=decodeURIComponent(location.hash.replace('#',''));const bb=$('#bulk');if(bb)bb.hidden=true;sel.clear();ssel.clear();if(h==='exc')exc();else if(h==='cmp')cmp();else if(h==='chg')chg();else if(h==='tidy')tidy();else if(h==='plat')plat();else if(h==='mng')mng();else if(h==='poster')poster();else if(h==='best')best();else if(h==='spd')spd();else if(h==='cats')catsPage();else if(h.indexOf('cat=')===0)catPage(h.slice(4));else if(h.indexOf('pl=')===0)platPage(h.slice(3));else if(h.indexOf('p=')===0){st={q:'',state:'all',cat:'',off:0};provider(h.slice(2))}else home();$('#main').focus({preventScroll:true})}
function show(a){$('#login').hidden=a;$('#app').hidden=!a;aiShow(a)}
function logout(m){token='';Object.keys(PC).forEach(k=>{idb.set('prov_'+k,null);idb.set('csv_'+k,null);idb.set('ex_'+k,null)});RK.forEach(k=>idb.set(k,null));RK=new Set();RCm={};Q=[];idb.set(QK,null);idb.set('rc_keys',null);PC={};CAT=null;idb.set(CATK,null);wipe();ls.del('pb_studio_token');show(false);$('#loginErr').textContent=m||'';$('#tok').value=''}
$('#loginForm').onsubmit=async e=>{e.preventDefault();token=$('#tok').value.trim();const b=e.target.querySelector('button');b.disabled=true;$('#loginErr').textContent='';
  try{await api('svc_providers');ls.set('pb_studio_token',token);show(true);route();setTimeout(()=>bgSync(true),2500)}catch(x){$('#loginErr').textContent=ERR[x.code]||('সংযোগ করা যায়নি — '+x.message)}b.disabled=false};
$('#logout').onclick=()=>logout();$('#back').onclick=()=>{const h=location.hash;location.hash=h.indexOf('#pl=')===0?'plat':h.indexOf('#cat=')===0?'cats':''};
addEventListener('hashchange',()=>token&&route());
/* ---------- PWA ইনস্টল + সমস্যা পরীক্ষা ---------- */
let dip=null;const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();dip=e;$('#install').hidden=standalone()});
addEventListener('appinstalled',()=>{dip=null;$('#install').hidden=true;toast('অ্যাপ ইনস্টল হয়েছে ✔')});
$('#install').hidden=standalone();
$('#install').onclick=async()=>{if(dip){dip.prompt();try{await dip.userChoice}catch(e){}dip=null;return}pwaCheck()};
async function pwaCheck(){
  let d=$('#pwd');if(!d){d=document.createElement('dialog');d.id='pwd';document.body.appendChild(d)}
  d.innerHTML='<form method="dialog"><h3 style="margin:0 0 8px">📲 ইনস্টল পরীক্ষা</h3><div id="pwr" class="pwr"><div class="sk"></div></div><div class="acts"><button class="btn" value="ok">ঠিক আছে</button></div></form>';d.returnValue='';d.showModal();
  const out=[],add=(g,t,x)=>out.push(`<div class="pwl ${g?'ok':'bad'}"><b>${g?'✔':'✖'}</b> <span>${esc(t)}${x?`<small>${esc(x)}</small>`:''}</span></div>`);
  add(isSecureContext||location.hostname==='localhost','HTTPS',location.protocol+'//'+location.host);
  add(/\/$/.test(location.pathname)||/\.[a-z0-9]+$/i.test(location.pathname),'ঠিকানার শেষে স্ল্যাশ (/)',location.pathname);
  const lk=document.querySelector('link[rel=manifest]');let m=null;
  if(!lk)add(false,'<link rel="manifest"> নেই');
  else{try{const r=await fetch(lk.href,{cache:'reload'});const ct=r.headers.get('content-type')||'';add(r.ok,'manifest ফাইল পাওয়া যায়','HTTP '+r.status+' · '+ct+' · '+lk.href);
      try{m=await r.json();add(true,'manifest JSON ঠিক',(m.name||'')+' · id: '+(m.id||'—'))}catch(e){add(false,'manifest JSON পড়া যায়নি — সম্ভবত অন্য পাতা (HTML) আসছে',e.message)}}
    catch(e){add(false,'manifest আনা যায়নি',e.message)}}
  if(m){const base=new URL(lk.href),st=new URL(m.start_url||'./',base),sc=new URL(m.scope||'./',base);
    add(st.origin===location.origin&&st.pathname.indexOf(sc.pathname)===0,'start_url scope-এর ভেতরে',st.pathname+' ⊂ '+sc.pathname);
    add(['standalone','fullscreen','minimal-ui'].indexOf(m.display)>=0,'display: '+(m.display||'—'));
    const ic=m.icons||[];
    for(const i of ic){try{const u=new URL(i.src,base);const img=new Image();const ok=await new Promise(res=>{img.onload=()=>res(true);img.onerror=()=>res(false);img.src=u.href});
        const want=String(i.sizes||'').split('x')[0];add(ok&&(!want||+want===img.naturalWidth),'আইকন '+(i.sizes||'')+(i.purpose?' ('+i.purpose+')':''),ok?('লোড হয়েছে '+img.naturalWidth+'×'+img.naturalHeight):'লোড হয়নি: '+u.pathname)}catch(e){add(false,'আইকন ঠিক নয়',String(i.src))}}
    add(ic.some(i=>/192/.test(i.sizes))&&ic.some(i=>/512/.test(i.sizes)),'১৯২ ও ৫১২ আইকন আছে')}
  try{const reg=await navigator.serviceWorker.getRegistration('./');add(!!(reg&&reg.active),'service worker সক্রিয়',reg?reg.scope:'নিবন্ধিত হয়নি');add(!!navigator.serviceWorker.controller,'পাতা service worker-এর নিয়ন্ত্রণে','না হলে একবার রিলোড করুন')}
  catch(e){add(false,'service worker পাওয়া যায়নি',e.message)}
  add(!standalone(),'অ্যাপ হিসেবে খোলা নয় (ব্রাউজারে আছে)');
  const r=$('#pwr');if(r)r.innerHTML=out.join('')+'<p class="sub" style="margin-top:10px">সব ✔ হলেও ইনস্টল না দেখালে: Chrome মেনু (⋮) → <b>Install app</b> / <b>Add to Home screen</b>। আগে ইনস্টল ও আনইনস্টল করা থাকলে: ঠিকানার পাশের 🔒 → Site settings → Clear data করে আবার খুলুন।</p>'}

const net=()=>{$('#net').hidden=navigator.onLine};addEventListener('online',net);addEventListener('offline',net);net();
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'}).then(r=>{try{r.update()}catch(e){}}).catch(()=>{}));
$('#shPlat').addEventListener('change',ngDraw);
addEventListener('visibilitychange',()=>{if(!document.hidden&&token&&CAT&&Date.now()-CAT.at>30*60000)catSyncNow().catch(()=>{})});
addEventListener('online',()=>bgSync(true));setInterval(()=>bgSync(false),600000);
addEventListener('visibilitychange',()=>{if(!document.hidden)bgSync(false)});
token?(show(true),catLoad().then(route,route),setTimeout(()=>bgSync(true),2500)):show(false);
window.__pbx={ls,$,api,toast};
})();

/* BDT ⇄ USDT কনভার্টার — ডিফল্ট রেট ১৩১; রেট সার্ভারে সেভ হয় */
(function(){const {ls,$,api,toast}=window.__pbx||{};let rate=+ls.get('pb_fx')||131,last='u';const R=$('#fxR'),U=$('#fxU'),B=$('#fxB'),D=$('#fxd'),E=$('#fxE');
/* বাংলা/আরবি অঙ্ক, কমা, ৳/$ চিহ্ন, দাঁড়ি — সব সাধারণ সংখ্যা হয়ে পড়ে (type=number বাংলা কিবোর্ডে ফাঁকা হয়ে যেত) */
const num=v=>{v=String(v==null?'':v).replace(/[০-৯]/g,c=>'০১২৩৪৫৬৭৮৯'.indexOf(c)).replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[,،\s৳$]/g,'').replace(/[٫।]/g,'.');const n=parseFloat(v);return isFinite(n)?n:NaN};
const upd=f=>{if(f==='r')f=last;const r=num(R.value);if(!(r>0))return;
  if(f==='u'){const u=num(U.value);last='u';if(isFinite(u))B.value=(u*r).toFixed(2)}
  else{const b=num(B.value);last='b';if(isFinite(b))U.value=String(+(b/r).toFixed(4))}};
const fill=()=>{R.value=String(rate);U.value='1';B.value=(+rate).toFixed(2);last='u';E.textContent=''};
$('#fx').onclick=async()=>{fill();D.showModal();try{const d=await api('svc_fx');if(d&&d.rate>0){rate=d.rate;ls.set('pb_fx',rate);fill()}}catch(_){}};
U.oninput=()=>upd('u');B.oninput=()=>upd('b');R.oninput=()=>upd('r');
const save=async()=>{const v=num(R.value);if(!(v>=1&&v<10000)){E.textContent='রেট ১ থেকে ৯৯৯৯-এর মধ্যে দিন';return}
  try{const d=await api('svc_fx',{rate:v});if(!(d&&d.rate>0))throw 0;rate=d.rate;window._fx=rate;ls.set('pb_fx',rate);toast('রেট সেভ: ১ USDT = ৳'+rate);D.close()}catch(x){E.textContent='সেভ হয়নি — অনলাইনে আবার চেষ্টা করুন'}};
$('#fxS').onclick=e=>{e.preventDefault();save()};D.querySelector('form').onsubmit=e=>{e.preventDefault();save()};})();
