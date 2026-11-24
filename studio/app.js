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
let token=ls.get('pb_studio_token')||'',busy=false,st={q:'',state:'all',cat:'',off:0,sort:'',tst:''},cur=null,lastList=null,qt=null,SC=null,fabMoved=false;
const ERR={packages_unavailable:'সাইটের প্যাকেজ তালিকা এখন আনা যায়নি — আগের তালিকা রাখা হয়েছে',unauthorized:'টোকেন ঠিক নয়',locked_out:'অনেকবার ভুল হয়েছে — কিছুক্ষণ পরে চেষ্টা করুন',no_config:'এই প্রভাইডারের API সেট করা নেই',bad_json:'প্রভাইডার সঠিক উত্তর দেয়নি',provider_error:'প্রভাইডার ত্রুটি দিয়েছে',not_collected:'আগে "সংগ্রহ করুন" চাপুন',code_conflict:'এই আইডি সাইটে অন্য প্রভাইডারের সার্ভিস হিসেবে আছে',previously_removed:'এই সার্ভিস আগে সাইট থেকে বাদ দেওয়া হয়েছিল',category_required:'ক্যাটেগরি দিন',not_in_csv:'এই সার্ভিস প্রভাইডারের সংগ্রহ-করা তালিকায় নেই — আগে প্রভাইডার পাতায় "সংগ্রহ করুন" চাপুন',provider_off:'এই প্রভাইডারের সুইচ বন্ধ আছে — আগে প্রভাইডারের সুইচ চালু করুন',code_required:'সার্ভিস আইডি বা প্রভাইডার পাওয়া যায়নি',name_required:'নাম দিন',price_required:'দাম দিন',svc_failed:'সার্ভারে সমস্যা হয়েছে',unknown_action:'সার্ভারে নতুন কোড চালু হয়নি — Apps Script-এ PtServices.gs ও PtOrder.gs বসিয়ে Deploy → Manage deployments → Edit → New version দিন'};
const mem={};let rid=0;
function wipe(){for(const k in mem)delete mem[k];try{Object.keys(localStorage).filter(k=>k.indexOf('pbc_')===0).forEach(k=>localStorage.removeItem(k))}catch(e){}}
async function apiNet(action,x){
  let r,txt,d;if(!navigator.onLine){const e=new Error('ইন্টারনেট নেই');e.code='net';throw e}
  if(/^svc_(toggle|bulk|collect|site_edit|site_bulk|tidy_apply|auto|rate_sync|guard_release|guard_check|bk_restore)$/.test(action))wipe();
  const TO=/^svc_(csv|by_platform|platforms|snapshot|retest_run|bal_check|bk_make|bk_restore)$/.test(action)?90000:/^svc_(providers|compare|changes|list|site_list)$/.test(action)?20000:60000,ac=new AbortController(),tm=setTimeout(()=>ac.abort(),TO);
  try{r=await fetch(API,{method:'POST',mode:'cors',signal:ac.signal,headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({action,token},x||{}))});txt=await r.text();clearTimeout(tm)}
  catch(ex){clearTimeout(tm);const e=new Error(ex&&ex.name==='AbortError'?'সার্ভার সাড়া দিচ্ছে না ('+bn(TO/1000)+' সেকেন্ড) — আবার চেষ্টা করুন':'নেটওয়ার্ক/CORS ত্রুটি: '+(ex&&ex.message||ex));e.code='net';throw e}
  try{d=JSON.parse(txt)}
  catch(ex){const e=new Error('সার্ভার JSON দেয়নি (HTTP '+r.status+'): '+String(txt).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,140));e.code='not_json';throw e}
  if(!d||!d.ok){const e=new Error((d&&(d.message||ERR[d.error]||d.error))||'failed');e.code=d&&d.error;e.data=d;throw e}return d;
}

/* ---------- ফোন-ক্যাটালগ: সাইটের সব সার্ভিস ফোনে (IndexedDB) থাকে; তালিকা/খোঁজা/ফিল্টার তাৎক্ষণিক ---------- */
const cutS=(s,n)=>{s=String(s==null?'':s);if(s.length<=n)return s;let x=s.substring(0,n);const c=x.charCodeAt(n-1);return c>=0xD800&&c<=0xDBFF?x.substring(0,n-1):x};
const CATK='site_v2',QK='queue_v1',EXK='exc_v1';let CAT=null,catSync=null,catTm=null,Q=[],qBusy=false,EXC={items:[]};
const idb={open(){return new Promise((res,rej)=>{const r=indexedDB.open('pb_studio',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})},
  async get(k){try{const db=await this.open();return await new Promise(res=>{const q=db.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null)})}catch(e){return null}},
  async set(k,v){try{const db=await this.open();await new Promise(res=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=()=>res();t.onerror=()=>res()})}catch(e){}}};
async function catLoad(){CAT=await idb.get(CATK);if(CAT&&CAT.rows)CAT.rows.forEach(r=>{if(!r.category)r.category='Uncategorized'});Q=(await idb.get(QK))||[];(await idb.get('rc_keys')||[]).forEach(k=>RK.add(k));EXC=(await idb.get(EXK))||{items:[]};qFlush();if(token&&(!CAT||Date.now()-CAT.at>30*60000))catSyncNow().catch(()=>{})}
function catSyncNow(prog){if(catSync)return catSync;
  catSync=(async()=>{const rows=[];let off=0,tot=1;
    let one=0;try{const d=await apiNet('svc_site_list',{q:'',platform:'',category:'',state:'all',offset:0,limit:5000,all:1});if(d.rows&&d.rows.length>=d.total&&d.total>0){rows.push.apply(rows,d.rows);one=1;if(prog)prog(d.total,d.total)}}catch(_){}
    while(!one&&off<tot){const d=await apiNet('svc_site_list',{q:'',platform:'',category:'',state:'all',offset:off,limit:100});tot=d.total;if(!d.rows.length)break;rows.push.apply(rows,d.rows);off+=d.rows.length;if(prog)prog(off,tot)}
    {const old=CAT&&CAT.rows?CAT.rows.length:0;if((old>0&&!rows.length)||(old>=20&&rows.length<old*0.5)){const e=new Error('সাইটের তালিকা অসম্পূর্ণ এসেছে — আগের তালিকা রাখা হয়েছে');e.code='partial';throw e}}
    excDiff(CAT&&CAT.rows,rows);CAT={rows,at:Date.now()};await idb.set(CATK,CAT)})().finally(()=>{catSync=null});return catSync}
/* ---------- ব্যতিক্রম: আগের ক্যাটালগের সাথে মিলিয়ে নতুন / হারানো / দাম-বদল ---------- */
function excDiff(o,n){if(!o||!o.length)return;const om={},nm={},now=Date.now(),it=[];o.forEach(r=>{om[r.code]=r});n.forEach(r=>{nm[r.code]=r});
  n.forEach(r=>{const a=om[r.code];if(!a)it.push({t:'new',code:r.code,name:r.name,pl:r.platform_label,at:now});
    else if(a.cost>0&&r.cost>0&&Math.abs(r.cost-a.cost)/a.cost>=0.05)it.push({t:'price',code:r.code,name:r.name,pl:r.platform_label,a:a.cost,b:r.cost,sell:r.sell,at:now})});
  o.forEach(r=>{if(!nm[r.code]&&r.state==='on')it.push({t:'gone',code:r.code,name:r.name,pl:r.platform_label,at:now})});
  if(!it.length)return;const k={};EXC.items=it.concat(EXC.items).filter(x=>{const id=x.t+x.code;if(k[id])return false;k[id]=1;return true}).slice(0,300);idb.set(EXK,EXC)}
/* ---------- কোনো লেইট নয়: লেখার কাজ (চালু/বন্ধ, নাম/ক্যাটেগরি বদল, ব্যাচ) আগে ফোনে সাথে সাথে হয়, সার্ভারে যায় পেছনে — অনলাইন/অফলাইন একই ---------- */
function qAdd(a,x){const lb={};CAT.rows.forEach(r=>{lb[r.platform]=r.platform_label});
  if(a==='svc_toggle'){const c=String(x.code);if(x.on){let r=CAT.rows.find(y=>y.code===c);if(r)r.state='on';else{const pl=String(x.platform||'').toLowerCase().trim();CAT.rows.unshift({code:c,name:cutS(String(x.name||''),120),category:cutS(String(x.category||''),120),platform:pl,platform_label:lb[pl]||pl,state:'on',src:'custom',ov:0});catSoon()}}else catPatch('svc_site_hide',{codes:[c],on:false})}
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
let mutTs=0,RCm={},RK=new Set();const RD=/^svc_(providers|by_platform|compare|changes)$/;
async function readCached(a,x){const k='rc_'+a+JSON.stringify(x||{});let c=RCm[k]||(RCm[k]=await idb.get(k));
  if(c&&(!navigator.onLine||(c.at>mutTs&&Date.now()-c.at<300000)))return c.d;
  try{const d=await apiNet(a,x);c={d,at:Date.now()};RCm[k]=c;idb.set(k,c);if(!RK.has(k)){RK.add(k);idb.set('rc_keys',Array.from(RK))}return d}
  catch(e){if(c&&(e.code==='net'||e.code==='not_json')){toast('ইন্টারনেট/সার্ভার পাওয়া যায়নি, ফোনের আগের কপি দেখানো হচ্ছে');return c.d}throw e}}
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
/* দাম অনুযায়ী সাজানো: asc = কম→বেশি, desc = বেশি→কম; দাম নেই/০ হলে সবসময় শেষে */
function rateCmp(dir){const k=dir==='desc'?-1:1,v=r=>{const x=Number(r.rate);return x>0?x:null};return (a,b)=>{const x=v(a),y=v(b);if(x===null&&y===null)return 0;if(x===null)return 1;if(y===null)return -1;return k*(x-y)}}
function provList(c,d,cp){const q=String(d.q||'').toLowerCase().trim(),cat=String(d.category||''),fl=String(d.state||'all'),pf=String(d.platform||'').toLowerCase(),cm={};
  if(CAT)CAT.rows.forEach(r=>{cm[r.code]=r.state});
  let all=c.rows.map(r=>{const o=Object.assign({},r);o.state=CAT?(cm[r.service_id]||'off'):(r.state||'off');return o});
  const cs={};all.forEach(r=>{cs[r.category]=(cs[r.category]||0)+1});
  if(cp&&pf)all=all.filter(r=>{const P=pick(NP,r.category)||pick(NP,r.name);return P&&(P[0].toLowerCase()===pf||pf.indexOf(P[0].toLowerCase())>=0)});
  const out=all.filter(r=>(!cat||r.category===cat)&&(fl==='all'||r.state===fl)&&(!q||qOK(q,String(r.name)+' '+r.service_id+' '+r.category)));
  if(d.sort==='asc'||d.sort==='desc')out.sort(rateCmp(d.sort));
  {const pv=d.provider||cur;if(d.tst)for(let i=out.length-1;i>=0;i--){const x=TST&&TST[pv+'|'+out[i].service_id],t=!!x;if(d.tst==='run'?!(x&&x.open>0):d.tst==='yes'?!t:t)out.splice(i,1)}
  if(d.sort==='fast'){const sc=r=>{const x=TST&&TST[pv+'|'+r.service_id];return x&&x.ok>0&&x.total_med>0?x.total_med:Infinity};out.sort((a,b)=>{const A=sc(a),B=sc(b);return A===B?0:A<B?-1:1})}}
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
  else if(a==='svc_site_edit'){const r=by[String(x.code)];if(r){r.name=cutS(String(x.name||'').trim(),120);if(x.category)r.category=cutS(String(x.category).trim(),120);setPl(r,x.platform);r.ov=1;catSoon()}}
  else if(a==='svc_site_bulk'){codes.forEach(c=>{const r=by[c];if(!r)return;let nm=r.name,ct=r.category;if(x.tidy&&r.tidy){nm=r.tidy.name;ct=r.tidy.cat}if(x.category)ct=String(x.category).trim();r.name=cutS(String(nm),120);r.category=cutS(String(ct),120);setPl(r,x.platform);r.ov=1});if(x.tidy)catSoon()}}
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
function lpByPlat(d){const label=String(d.label||''),q=String(d.q||'').toLowerCase().trim(),type=String(d.type||''),fl=String(d.state||'all'),provs=Array.isArray(d.provs)?d.provs:[],pv={},cm={},types={},all=[];let tn=0;
  CAT.rows.forEach(r=>{cm[r.code]=r.state});
  lpRows().forEach(r=>{if(lpLabel(r)!==label)return;if(q&&!qOK(q,String(r.name)+' '+r.service_id+' '+r.category))return;
    pv[r.provider]=(pv[r.provider]||0)+1;if(provs.length&&provs.indexOf(r.provider)<0)return;
    const tl=lpType(r);types[tl]=(types[tl]||0)+1;if(type&&tl!==type)return;
    const st=cm[r.service_id]||'off';if(fl!=='all'&&st!==fl)return;const tx=TST&&TST[r.provider+'|'+r.service_id];if(tx)tn++;if(d.tst&&(d.tst==='run'?!(tx&&tx.open>0):d.tst==='yes'?!tx:!!tx))return;const o=Object.assign({},r);o.state=st;all.push(o)});
  if(d.sort==='fast'){const sc=r=>{const x=TST&&TST[r.provider+'|'+r.service_id];return x&&x.ok>0&&x.total_med>0?x.total_med:Infinity};all.sort((a,b)=>{const A=sc(a),B=sc(b);return A===B?0:A<B?-1:1})}else all.sort(rateCmp(d.sort==='desc'?'desc':'asc'));
  const off=Math.max(0,+d.offset||0),lim=Math.min(80,+d.limit||40),sc={};CAT.rows.forEach(r=>{if(r.category)sc[r.category]=1});
  let fx;for(const p of SNAP_P){if(PC[p]&&PC[p].ex&&PC[p].ex.fx){fx=PC[p].ex.fx;break}}
  return{ok:true,tn,total:all.length,provs:Object.keys(pv).map(k=>[k,pv[k]]).sort((a,b)=>b[1]-a[1]),rows:all.slice(off,off+lim),types:Object.keys(types).map(k=>[k,types[k]]).sort((a,b)=>b[1]-a[1]),fx,site_categories:Object.keys(sc).sort()}}
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
  let d;try{d=await api(act,x)}catch(e){if(c&&!authFail(e)){toast('সার্ভার থেকে নতুন তথ্য আনা যায়নি, ফোনের আগের কপি দেখানো হচ্ছে'+(e.message?' ('+e.message+')':''));return}throw e}
  const j=JSON.stringify(d);mem[key]=d;ls.set(key,j);if(my===rid&&j!==sh)draw(d)}
const sel=new Set();let cq={q:'',refill:false},cn=0;
const fmtT=s=>s<90?bn(Math.round(s))+' সে.':s<5400?bn(Math.round(s/60))+' মি.':bn(Math.round(s/360)/10)+' ঘণ্টা';
const spdTag=r=>r.spd?`<div class="sub ${r.spd.m<=1800?'ok':r.spd.m>=21600?'hi':''}">⚡ গড় ${fmtT(r.spd.m)} · ${bn(r.spd.n)}টি অর্ডার${r.spd.f?' · ব্যর্থ '+bn(r.spd.f):''}</div>`:'';
const nav=a=>`<div class="chips" role="navigation">${[['exc','ব্যতিক্রম'],['','প্রভাইডার'],['plat','প্ল্যাটফর্ম'],['best','🏆 সেরা'],['spd','🧪 ল্যাব'],['mng','ম্যানেজ'],['cats','ক্যাটেগরি'],['cmp','তুলনা'],['chg','পরিবর্তন'],['tidy','সাজান'],['poster','🎨 পোস্টার']].map(x=>`<a class="chip" href="#${x[0]}" aria-current="${a===x[0]}">${x[0]==='exc'&&EXC.items.length?x[1]+' '+bn(EXC.items.length):x[1]}</a>`).join('')}</div>`;
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
    const d=await pageRows('svc_list',{provider:p,q:st.q,state:st.state,category:st.cat,platform:st.plat||'',sort:st.sort||'',tst:st.tst||''},st.off,50,(st.cat||st.q)?'':(st.type||''));
    if(my!==provTok)return;
    if(!more){lastList=d;
      el.innerHTML=tiles(d.platforms||[],st.plat||'')+`<div class="bar"><input id="q" type="search" placeholder="নাম, আইডি বা ক্যাটেগরি খুঁজুন" value="${esc(st.q)}" aria-label="খুঁজুন"></div><div id="cats">${catUI(catsFor(d.categories,st.plat),st)}</div>
      <div class="chips" role="group" aria-label="অবস্থা">${[['all','সব'],['on','চালু'],['off','বন্ধ'],['conflict','জট']].map(s=>`<button class="chip" data-s="${s[0]}" aria-pressed="${st.state===s[0]}">${s[1]}</button>`).join('')}<button class="chip" id="sa">সব বাছুন</button><button class="chip" id="csv">⤓ CSV</button></div><div class="chips" role="group" aria-label="দাম সাজান"><button class="chip" data-so="asc" aria-pressed="${st.sort==='asc'}">দাম: কম → বেশি</button><button class="chip" data-so="desc" aria-pressed="${st.sort==='desc'}">দাম: বেশি → কম</button><button class="chip" data-so="fast" aria-pressed="${st.sort==='fast'}">⚡ দ্রুততম আগে</button><span class="cdv" aria-hidden="true"></span>${[['','সব'],['run','⏳ টেস্টিং'],['yes','🧪 টেস্টেড'],['no','অপরীক্ষিত']].map(s=>`<button class="chip" data-tt="${s[0]}" aria-pressed="${(st.tst||'')===s[0]}">${s[1]}</button>`).join('')}</div>
      <p class="sub"><span id="cnt"></span><span id="tcn"></span></p><div class="list" id="rows"></div><div id="moreWrap"></div>`;
      $('#q').oninput=e=>{clearTimeout(qt);qt=setTimeout(()=>{st.q=e.target.value;if(st.q.trim()){st.type='';st.cat=''}provider(p)},200)};
      if(hq){const qi=$('#q');qi.focus();try{qi.setSelectionRange(qi.value.length,qi.value.length)}catch(_){}}
      bindCat($('#cats'),st,()=>provider(p));
      el.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{st.state=b.dataset.s;provider(p)});el.querySelectorAll('[data-tt]').forEach(b=>b.onclick=()=>{st.tst=b.dataset.tt;provider(p)});el.querySelectorAll('[data-so]').forEach(b=>b.onclick=()=>{st.sort=st.sort===b.dataset.so?'':b.dataset.so;provider(p)});
      $('#csv').onclick=()=>dl(p);bindTiles(el,l=>{st.plat=l;st.cat='';provider(p)});$('#sa').onclick=()=>el.querySelectorAll('.sel').forEach(x=>{if(!x.checked){x.checked=true;x.onchange({target:x})}});
    }else lastList.rows=lastList.rows.concat(d.rows);
    $('#cnt').textContent=`মোট ${bn(d.total)}টি${d.fx?'':' · USD→৳ রেট সেট নেই (দাম USD-তে দিন)'}`;
    const box=$('#rows');if(!more)box.innerHTML='';
    if(!d.rows.length&&!more)box.innerHTML='<div class="card empty">কিছু পাওয়া যায়নি</div>';
    d.rows.forEach(r=>box.appendChild(row(r,d)));
    st.off=d.next;if(st.type&&!st.cat&&!st.q)$('#cnt').textContent=TLBL[st.type]+' ধরন · '+bn(box.children.length)+'টি দেখানো হচ্ছে'+(d.fx?'':' · USD→৳ রেট সেট নেই (দাম USD-তে দিন)');$('#moreWrap').innerHTML=st.off<d.total?'<button class="sm" id="more" style="width:100%;margin-top:8px">আরও দেখান</button>':'';
    const m=$('#more');if(m)m.onclick=()=>provider(p,true);
    window._fx=d.fx;window._sc=d.site_categories;tstCnt();if(!more)tstRefresh();
  }catch(e){if(!authFail(e)){el.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p><div class="ordb"><button class="btn" id="rt" style="max-width:260px">আবার চেষ্টা করুন</button></div><div class="ordb"><button class="btn" id="rc" style="max-width:260px">⬇ এখনই সংগ্রহ করুন</button></div><div class="ordb"><button class="sm" id="rd">🔧 কারণ খুঁজুন</button></div><div id="dg" role="status"></div></div>`;$('#rt').onclick=()=>provider(p);$('#rc').onclick=()=>provCollect(p);$('#rd').onclick=()=>provDiag(p)}}
}
/* বাছাই মনে রাখা: ফিল্টার/'আরও দেখান'-এ কার্ড নতুন করে আঁকা হলেও টিক থাকে (প্রভাইডার+আইডি দিয়ে চেনে) */
/* রেট টাকায় সাথে সাথে: প্রভাইডারের USD রেট × সেট করা ডলার-রেট (১ USDT = ৳?); রেট কোথাও সেট না থাকলে ১৩১ ধরে */
const fxNow=()=>+window._fx>0?+window._fx:(+ls.get('pb_fx')>0?+ls.get('pb_fx'):131);
const rateTk=(u,plain)=>{const x=+u,f=fxNow();if(!(x>=0)||!f)return esc(u)+' $';const t=x*f;return '৳'+bn(+t.toFixed(t<10?3:2))+(plain?'':' <span class="mut">($'+esc(u)+')</span>')};
const RW=new WeakMap(),selKey=r=>(r.provider||cur||'')+'|'+r.service_id;
/* v106: আগে টেস্ট-করা সার্ভিস — নামের পাশে ব্যাজ, নিচে বিস্তারিত লাইন (গতি/ব্যর্থতা/কবে), ট্যাপে প্রতিটি টেস্টের তালিকা; রঙ = গতি */
let TST=null,TSTp=null;try{TST=JSON.parse(ls.get('tst_v1')||'null')}catch(_){TST=null}
const doneT=s=>!(s>0)?'':s<60?'১ মিনিটের কম সময়ে':s<5400?bn(Math.round(s/60))+' মিনিটে':s<172800?bn(Math.round(s/360)/10)+' ঘণ্টায়':bn(Math.round(s/8640)/10)+' দিনে';
const agoT=ms=>{if(!(ms>0))return'';const d=(Date.now()-ms)/1000;return d<3600?'কিছুক্ষণ আগে':d<86400?bn(Math.floor(d/3600))+' ঘণ্টা আগে':bn(Math.floor(d/86400))+' দিন আগে'};
const tstSt=s=>{s=String(s||'').toLowerCase();return s==='completed'?['সম্পন্ন','ok']:s==='partial'?['আংশিক','mid']:/cancel|refund/.test(s)?['ক্যান্সেল','slow']:['চলছে','wait']};
/* রঙ: সবুজ = ২ ঘণ্টা বা কম, হলুদ = ১২ ঘণ্টা পর্যন্ত, লাল = তার বেশি বা ৩০%+ ব্যর্থ; হলুদ-ধূসর = চলছে */
const tstFin=s=>{s=String(s||'').trim().toLowerCase();return s==='completed'||s==='partial'||s==='canceled'||s==='cancelled'||s==='refunded'};
const tstNow=()=>{try{return spNow()}catch(_){return Date.now()}};
const tstFmt=(s,t0)=>String(s||'').replace('{T}',t0>0?lvT((tstNow()-t0)/1000):'');
function tstLabel(x){if(!x)return null;const old=x.last_at>0&&Date.now()-x.last_at>30*864e5;
  if(x.open>0){const op=(x.tests||[]).filter(t=>!tstFin(t.st)),m0=op.length?Math.min.apply(null,op.map(t=>t.at>0?t.at:Infinity)):0,t0=isFinite(m0)&&m0>0?m0:(x.last_at>0?x.last_at:0),started=op.some(t=>t.ss>0),el=t0?(tstNow()-t0)/1000:0;
    const lim=started?(x.ok>=2&&x.total_med>0?Math.max(1800,x.total_med*3):0):(x.start_med>0?Math.max(600,x.start_med*3):900),late=!!(lim&&el>lim);
    return{t:'🧪 টেস্টিং চলছে'+(x.open>1?' ('+bn(x.open)+'টি)':'')+(late?' · ⚠ দেরি':''),d:'⏳ '+(t0?'{T} ধরে ':'')+(started?'চলছে':'শুরুর অপেক্ষায়')+(x.ok>0&&x.total_med>0?' · আগের টেস্ট '+doneT(x.total_med)+' সম্পন্ন':'')+' — বিস্তারিত ›',c:late?'slow':'wait',old:false,live:1,t0}}
  if(x.ok>0&&x.total_med>0){const c=(x.bad>=30||x.drop_med>=30)?'slow':x.total_med<=7200?'ok':x.total_med<=43200?'mid':'slow';
    const dp=['টেস্ট '+bn(x.n)+'টি'];if(x.start_med>0)dp.unshift('শুরু ~'+mnT(x.start_med));if(x.per_hr>0)dp.splice(1,0,'~'+bn(x.per_hr)+'/ঘণ্টা');dp.splice(dp.length,0,'ব্যর্থ '+bn(x.bad)+'%');if(x.drop_n>0)dp.push('📉 ড্রপ ~'+bn(x.drop_med)+'% ('+bn(x.drop_n)+'টি যাচাই)');if(x.last_at>0)dp.push('শেষ '+agoT(x.last_at)+(old?' (পুরনো)':''));
    return{t:'টেস্টেড ✓ · '+doneT(x.total_med)+' সম্পন্ন',d:'📊 '+dp.join(' · ')+' — বিস্তারিত ›',c,old}}
  if(x.open>0)return{t:'টেস্টেড · চলছে',d:'📊 টেস্ট চলছে'+(x.last_at>0?' · শুরু '+agoT(x.last_at):'')+' — বিস্তারিত ›',c:'wait',old};
  return{t:'টেস্টেড · সম্পন্ন হয়নি',d:'📊 টেস্ট '+bn(x.n)+'টি, কোনোটাই সম্পন্ন হয়নি'+(x.last_at>0?' · শেষ '+agoT(x.last_at):'')+' — বিস্তারিত ›',c:'slow',old}}
function tstFill(el){if(!el)return;const l=tstLabel(TST&&TST[el.dataset.tk]),bx=el.closest&&el.closest('.tstbox');if(!l){el.hidden=true;el.textContent='';delete el.dataset.tstt0;delete el.dataset.tpl;if(bx&&!bx.querySelector('[data-tk]:not([hidden])'))bx.hidden=true;return}el.hidden=false;if(bx){bx.hidden=false;bx.className='tstbox '+l.c+(l.live?' run':'')}
  const two=el.classList.contains('tst2');el.className=(two?'sub tst2 ':'tag tst ')+l.c+(l.old?' old':'')+(l.live?' run':'');
  if(two&&l.live&&l.t0>0){el.dataset.tstt0=l.t0;el.dataset.tpl=l.d}else{delete el.dataset.tstt0;delete el.dataset.tpl}
  el.textContent=tstFmt(two?l.d:l.t,l.t0)}
function tstPaint(root){(root||document).querySelectorAll('.tst[data-tk],.tst2[data-tk]').forEach(tstFill);tstCnt();if(document.querySelector('.tst2[data-tstt0]'))tstLiveStart()}
/* চলমান টেস্ট থাকলে: প্রতি সেকেন্ডে সময় চলে; প্রতি ৪৫ সেকেন্ডে প্রভাইডারে মিলিয়ে ব্যাজ নিজে 'সম্পন্ন' হয় */
let tstTm=0,tstBusy=false;
function tstTick(){document.querySelectorAll('.tst2[data-tstt0]').forEach(x=>{x.textContent=tstFmt(x.dataset.tpl,+x.dataset.tstt0)})}
async function tstPoll(){if(tstBusy||document.hidden||!document.querySelector('.tst2[data-tstt0]'))return;tstBusy=true;try{await api('svc_spd',{refresh:true,limit:10});await tstRefresh()}catch(_){}finally{tstBusy=false}}
function tstLiveStart(){if(tstTm)return;tstTm=setInterval(tstTick,1000);setInterval(tstPoll,45000)}
function tstCnt(){const e=$('#tcn');if(!e)return;const pc=cur&&PC[cur];if(!pc||!TST){e.textContent='';return}let n=0;pc.rows.forEach(r=>{if(TST[cur+'|'+r.service_id])n++});e.textContent=' · 🧪 টেস্টেড '+bn(n)+'/'+bn(pc.rows.length)}
function tstRefresh(){return TSTp||(TSTp=api('svc_tested').then(d=>{const prev=ls.get('tst_v1'),j=JSON.stringify(d.tested||{});TST=d.tested||{};ls.set('tst_v1',j);tstPaint();
  if(j!==prev&&cur&&(st.tst||st.sort==='fast'))provider(cur)}).catch(e=>{if(authFail(e))return}).finally(()=>{TSTp=null}))}
/* v107: ড্রপ যাচাই — সম্পন্ন টেস্টের পর ১–৭ দিন পরে লিংকের এখনকার সংখ্যা দিলে ড্রপ % হিসাব হয় */
const dropC=p=>p>=30?'slow':p>=10?'mid':'ok';
function tstDrop(t,k,i){const s=String(t.st||'').toLowerCase();if(s!=='completed'&&s!=='partial')return'';
  const d=t.dr,done=d?`<div class="sub ${dropC(d.pct)}">📉 ড্রপ ${bn(Math.max(0,d.pct))}% · ${bn(d.days)} দিন পরে (এখন ${bn(d.cur)})</div>`:'';
  const ageH=t.at?(Date.now()-t.at)/36e5:0,hint=d?'':(ageH>0&&ageH<24?'<div class="sub">📉 ২৪ ঘণ্টা পরে ড্রপ যাচাই করা ভালো</div>':'<div class="sub mid">📉 ড্রপ যাচাই বাকি</div>');
  return done+hint+`<div class="dchk"><button type="button" class="sm" data-dc="${i}">${d?'আবার যাচাই':'📉 ড্রপ যাচাই'}</button><div class="dfm" data-df="${i}" hidden><input type="number" inputmode="numeric" min="0" placeholder="এখন লিংকে কত? (ফলোয়ার/লাইক)" data-dcur="${i}" aria-label="এখনকার সংখ্যা">${!(t.sc>0)?`<input type="number" inputmode="numeric" min="0" placeholder="অর্ডারের আগে কত ছিল?" data-dbase="${i}" aria-label="আগের সংখ্যা">`:''}<button type="button" class="btn" data-dgo="${i}">হিসাব করুন</button><p class="err" data-derr="${i}" role="alert"></p></div></div>`}
function tstDropBind(d,k){const x=TST&&TST[k];if(!x)return;const prov=k.split('|')[0];
  d.querySelectorAll('[data-dc]').forEach(b=>b.onclick=()=>{const f=d.querySelector(`[data-df="${b.dataset.dc}"]`);f.hidden=!f.hidden;if(!f.hidden){const i=d.querySelector(`[data-dcur="${b.dataset.dc}"]`);if(i)i.focus()}});
  d.querySelectorAll('[data-dgo]').forEach(b=>b.onclick=async()=>{const i=+b.dataset.dgo,t=x.tests[i],E=d.querySelector(`[data-derr="${i}"]`),cu=d.querySelector(`[data-dcur="${i}"]`),ba=d.querySelector(`[data-dbase="${i}"]`);
    E.textContent='';if(!cu.value.trim()){E.textContent='এখনকার সংখ্যা দিন';return}
    if(ba&&!ba.value.trim()){E.textContent='অর্ডারের আগের সংখ্যা দিন';return}
    b.disabled=true;b.textContent='হিসাব হচ্ছে…';
    try{const r=await api('svc_drop',{provider:prov,order:t.po,count:+cu.value,base:ba?+ba.value:undefined});
      t.dr={pct:r.pct,days:r.days,cur:r.cur,at:Date.now()};toast('ড্রপ '+bn(Math.max(0,r.pct))+'%');tstDlg(k,d.dataset.nm||'');tstRefresh()}
    catch(e){if(authFail(e)){d.close();return}b.disabled=false;b.textContent='হিসাব করুন';E.textContent=e.message||'ব্যর্থ'}})}
/* v143: টেস্ট ফলাফলে অর্ডারের লিংক (সম্পন্ন/চলমান সব টেস্টেই) */
function tstLk(t){const u=String(t.lk||'').trim();if(!u)return'<div class="sub dflk">🔗 '+(t.lk===undefined?'লিংক খোঁজা হচ্ছে…':'লিংক পাওয়া যায়নি')+'</div>';
  return'<div class="sub dflk">🔗 '+(/^https?:\/\//i.test(u)?'<a class="dfk" href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(u.length>46?u.slice(0,44)+'…':u)+'</a>':esc(u.slice(0,46)))+'</div>'}
/* v143b: সার্ভার নতুন না হলেও লিংক আসে — স্পিড পাতার ডেটা (svc_spd) থেকে মিলিয়ে নেয় */
const LKK='tst_lk_v1';
function tstLkMap(){try{return JSON.parse(ls.get(LKK))||{}}catch(_){return{}}}
function tstSaveLk(prov,po,link){if(!prov||!po||!link)return;const m=tstLkMap();m[prov+'|'+po]=String(link).slice(0,300);const ks=Object.keys(m);if(ks.length>600)ks.slice(0,ks.length-600).forEach(x=>delete m[x]);ls.set(LKK,JSON.stringify(m))}
let TSTLK=null;
async function tstFillLk(k,name){const x=TST&&TST[k];if(!x)return;const miss=(x.tests||[]).filter(t=>t.lk===undefined);if(!miss.length)return;
  const prov=k.split('|')[0],lm=tstLkMap();let any=false;miss.forEach(t=>{const v=lm[prov+'|'+t.po];if(v){t.lk=v;any=true}});
  if(any&&!miss.some(t=>t.lk===undefined)){const d1=$('#tstD');if(d1&&d1.open&&TST&&TST[k]===x)tstDlg(k,name);return}
  const rest=miss.filter(t=>t.lk===undefined);
  try{if(!TSTLK||Date.now()-TSTLK.at>6e4){const d=await api('svc_spd',{all:true}),m={};((d&&d.rows)||[]).forEach(r=>{if(r.link)m[r.provider+'|'+r.provider_order]=r.link});TSTLK={at:Date.now(),m}}}catch(_){rest.forEach(t=>{t.lk=''});const d0=$('#tstD');if(d0&&d0.open&&TST&&TST[k]===x)tstDlg(k,name);return}
  rest.forEach(t=>{t.lk=TSTLK.m[prov+'|'+t.po]||''});
  const d=$('#tstD');if(d&&d.open&&TST&&TST[k]===x&&true)tstDlg(k,name)}
function tstDlg(k,name){const x=TST&&TST[k];if(!x)return;
  let d=$('#tstD');if(!d){d=document.createElement('dialog');d.id='tstD';d.setAttribute('aria-labelledby','tstT');document.body.appendChild(d)}
  const l=tstLabel(x),lmap=tstLkMap(),tests=(x.tests||[]).map((t,i)=>{if(t.lk===undefined&&lmap[k.split('|')[0]+'|'+t.po])t.lk=lmap[k.split('|')[0]+'|'+t.po];const s=tstSt(t.st);return`<div class="tstr"><div class="tsth"><b>${dT(t.at)}</b> <span class="tag tst ${s[1]}">${s[0]}</span></div><div class="sub">পরিমাণ ${bn(t.q)} · শুরু ${t.ss>0?mnT(t.ss):'—'} · মোট ${t.ts>0?mnT(t.ts):'—'}${t.dl!=null?' · ডেলিভারি '+bn(t.dl)+'/'+bn(t.q):''}${t.c!=null?' · ৳'+bn(Math.round(t.c*100)/100):''}</div>${tstLk(t)}${tstDrop(t,k,i)}</div>`}).join('');
  d.innerHTML=`<h3 id="tstT" style="margin:0 0 8px">🧪 টেস্ট ফলাফল</h3><p class="sub" id="tstN"></p>${l?`<p><span class="tag tst ${l.c}">${esc(l.t)}</span></p><p class="sub">${esc(l.d.replace(' — বিস্তারিত ›',''))}</p>`:''}<div class="tstl">${tests||'<p class="sub">বিস্তারিত নেই</p>'}</div>${(x.n>5)?`<p class="sub">সর্বশেষ ${bn(5)}টি দেখানো হলো (মোট ${bn(x.n)}টি)</p>`:''}<div class="acts"><button type="button" class="sm" id="tstX">বন্ধ</button><button type="button" class="btn" id="tstS">⏱ স্পিড পাতা</button></div>`;
  d.dataset.nm=name||'';$('#tstN').textContent=k.replace('|',' · #')+(name?' · '+name:'');tstDropBind(d,k);$('#tstX').onclick=()=>d.close();$('#tstS').onclick=()=>{d.close();location.hash='spd'};if(!d.open)d.showModal();tstFillLk(k,name)}
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('.tst[data-tk],.tst2[data-tk]');if(t&&TST&&TST[t.dataset.tk]){e.preventDefault();tstDlg(t.dataset.tk,t.dataset.nm||'')}});
function row(r,d){
  const c=document.createElement('div');c.className='card svc';
  const sg='';
  const rf=r.refill==='1'?'<span class="pl ok">♻ রিফিল</span>':r.refill==='0'?'<span class="pl">রিফিল নেই</span>':'',cn=r.cancel==='1'?'<span class="pl">ক্যান্সেল ✓</span>':'';
  c.innerHTML=`<div class="sv"><div class="sv-top">${r.state==='conflict'?'':'<input type="checkbox" class="sel" aria-label="নির্বাচন">'}<h4>${esc(r.name)}</h4></div>
  <div class="sv-meta">${d&&d.cmp?'<span class="pl pv2">'+esc(r.provider)+'</span>':''}<span class="pl rt">${rateTk(r.rate)}</span><span class="pl">ID <b>${esc(r.service_id)}</b></span><span class="pl">${bn(r.min)}–${bn(r.max)}</span>${rf}${cn}${sg}</div>
  <div class="sub sv-cat">${esc(r.category)}</div>
  <div class="tstbox" hidden><button type="button" class="tag tst" data-tk="${esc((r.provider||cur)+'|'+r.service_id)}" data-nm="${esc(r.name)}" hidden></button><div class="sub tst2" role="button" data-tk="${esc((r.provider||cur)+'|'+r.service_id)}" data-nm="${esc(r.name)}" hidden></div></div>${spdTag(r)}
  ${r.tidy&&r.state!=='on'?`<div class="sub ok">সাইটে: ${esc(nice(r)||r.tidy.name)} · ${esc(r.tidy.cat)}</div>`:''}${r.state==='conflict'?`<div class="sub hi">জট: ${esc(r.conflict_with)}-এর সার্ভিস হিসেবে আছে</div>`:''}
  <div class="ordb"><button type="button" class="sm" data-ord>🧪 টেস্ট অর্ডার</button></div></div>
  <button class="sw" role="switch" aria-checked="${r.state==='on'}" aria-label="${esc(r.name)} সাইটে চালু/বন্ধ" ${r.state==='conflict'?'disabled':''}></button>`;
  c.querySelectorAll('.tst,.tst2').forEach(tstFill);
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
/* ---------- S4: \"চেক করে এড\" — সাইটে তোলার আগে সাইট-রেডি যাচাই (নাম, ক্যাটেগরি, প্ল্যাটফর্ম, দাম>0, min/max, আইডি কনফ্লিক্ট) ---------- */
const BN_RE=/[\u0980-\u09FF]/,LINK_RE=/https?:\/\/|www\.|\.(?:com|net|org|io|xyz|co|info|shop|top|site|online)\b|@\w/i,PKEYS=PLAT.map(p=>p[0]);
function readyCheck(r,v,others){
  const E=[],W=[],name=String(v.name==null?'':v.name).trim(),cat=String(v.cat==null?'':v.cat).trim(),plat=String(v.plat==null?'':v.plat).trim().toLowerCase();
  const rate=Number(r.rate),mn=Number(r.min),mx=Number(r.max),code=String(r.service_id==null?'':r.service_id),k=x=>String(x||'').trim().toLowerCase();
  const e=(f,m)=>E.push({f,m}),w=(f,m)=>W.push({f,m});
  if(!code)e('misc','সার্ভিস আইডি নেই');
  if(!name)e('name','নাম দিন');
  else{
    if(name.length>120)e('name','নাম ১২০ অক্ষরের বেশি — ছোট করুন');
    if(BN_RE.test(name))e('name','সাইটের নাম ইংরেজিতে দিন (বাংলা অক্ষর আছে)');
    const pb=String(r.provider||'').toLowerCase().replace(/\.[a-z]+$/,'');
    if(LINK_RE.test(name)||(pb.length>=4&&name.toLowerCase().indexOf(pb)>=0))e('name','নামে প্রভাইডারের নাম বা লিংক থাকবে না');
    if(name.length<8)w('name','নামটা খুব ছোট — ক্রেতা বুঝবে তো?');
    const dup=((CAT&&CAT.rows)||[]).find(x=>x&&k(x.name)===k(name)&&String(x.code)!==code);
    if(dup)e('name','এই নামে সাইটে আগেই একটি সার্ভিস আছে (#'+dup.code+') — নাম আলাদা করুন');
    if((others||[]).some(o=>k(o)===k(name)))e('name','এই তালিকার আরেকটি সার্ভিসেও একই নাম — আলাদা করুন (↻ নাম)');
  }
  if(!cat)e('cat','ক্যাটেগরি দিন');
  else{if(cat.length>120)e('cat','ক্যাটেগরি ১২০ অক্ষরের বেশি');if(BN_RE.test(cat))e('cat','সাইটের ক্যাটেগরি ইংরেজিতে দিন (বাংলা অক্ষর আছে)')}
  if(PKEYS.indexOf(plat)<0)e('plat','প্ল্যাটফর্ম বাছুন');
  else{
    if(plat==='other')w('plat','প্ল্যাটফর্ম \"other\" — সম্ভব হলে ঠিক প্ল্যাটফর্ম বাছুন');
    else{const g=guess((name||'')+' '+(cat||''));if(g!=='other'&&g!==plat)w('plat','নাম/ক্যাটেগরি দেখে মনে হচ্ছে '+g+', কিন্তু প্ল্যাটফর্ম '+plat+' বাছা')}
  }
  if(!(rate>0))e('rate','প্রভাইডারের রেট ০ বা ফাঁকা — এই সার্ভিস চালু করা যাবে না');
  if(!(mn>0)||!(mx>0))w('mm','min/max পাওয়া যায়নি — সাইটে ডিফল্ট ১০–১০,০০০ বসবে');
  else if(mx<mn)e('mm','max ('+mx+'), min ('+mn+')-এর চেয়ে ছোট — প্রভাইডারের তথ্য ভুল');
  const ex=((CAT&&CAT.rows)||[]).find(x=>x&&String(x.code)===code);
  if(ex){if(ex.src==='static')e('misc','এই আইডি ('+code+') সাইটের মূল তালিকায় অন্য সার্ভিসের'+(ex.name?' ("'+String(ex.name).slice(0,45)+'")':'')+' — বসালে ওটা নষ্ট হবে, তাই এটা বাদ রাখা হয়েছে');else if(ex.state==='on')w('misc','এই আইডি সাইটে আগে থেকেই চালু আছে — আবার বসালে তথ্য বদলে যাবে')}
  if(!navigator.onLine)e('misc','ইন্টারনেট নেই — চালু করতে নেট লাগবে');
  return{E,W,ok:!E.length}}
const chkHtml=c=>c.E.map(x=>'<div class=\"ck e\">✖ '+esc(x.m)+'</div>').join('')+c.W.map(x=>'<div class=\"ck w\">⚠ '+esc(x.m)+'</div>').join('')+(c.ok&&!c.W.length?'<div class=\"ck g\">✔ সাইটে তোলার জন্য প্রস্তুত</div>':c.ok?'<div class=\"ck g\">✔ চালু করা যাবে (সতর্কতা দেখে নিন)</div>':'');
let shRun=null,shWired=false;
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
  shRun=()=>{const c=readyCheck(r,{name:$('#shName').value,plat:$('#shPlat').value,cat:$('#shCat').value});$('#shChk').innerHTML=chkHtml(c);return c};
  if(!shWired){shWired=true;['#shName','#shCat'].forEach(i=>$(i).addEventListener('input',()=>shRun&&shRun()));['#shPlat','#shCs'].forEach(i=>$(i).addEventListener('change',()=>shRun&&shRun()))}
  setTimeout(()=>shRun&&shRun(),0);
  sh.onclose=async()=>{const rv=sh.returnValue;
    if(rv!=='ok'){if(q){if(rv==='cancel')q.next();else q.done()}return}
    busy=true;btn.disabled=true;
    try{await api('svc_toggle',{provider:r.provider||cur,code:r.service_id,on:true,name:$('#shName').value,platform:$('#shPlat').value,category:$('#shCat').value.trim(),force:true});cmSet(r.category,$('#shCat').value.trim());
      r.state='on';btn.setAttribute('aria-checked','true');toast('সাইটে চালু হয়েছে ✔')}
    catch(e){if(authFail(e)){}else toast('চালু হয়নি — '+e.message)}
    busy=false;btn.disabled=false;if(q)q.next();
  };
  $('#shForm').onsubmit=e=>{if(e.submitter&&e.submitter.value==='ok'){const c=shRun?shRun():readyCheck(r,{name:$('#shName').value,plat:$('#shPlat').value,cat:$('#shCat').value});if(!c.ok){e.preventDefault();$('#shErr').textContent=c.E.length>1?bn(c.E.length)+'টি সমস্যা ঠিক না করলে চালু হবে না (লাল ✖ গুলো দেখুন)':c.E[0].m}}};
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
  b.hidden=!sel.size;b.innerHTML=`<b>${bn(sel.size)}টি বাছাই</b><button class="sm" data-b="on">চালু</button><button class="sm" data-b="off">বন্ধ</button><button class="sm" data-b="tq">🧪 টেস্ট কিউতে</button><button class="sm" data-b="x" aria-label="বাতিল">✕</button>`;
  b.querySelectorAll('[data-b]').forEach(x=>x.onclick=()=>bulk(x.dataset.b))}
/* সাইটে থাকা ক্যাটেগরি: শুধু লাইভ (state=on) সার্ভিস আছে এমন ক্যাটেগরি, প্ল্যাটফর্ম ধরে; বন্ধ/খালি ক্যাটেগরি দেখায় না */
const autoH=e=>{if(!e)return;e.style.height='auto';e.style.height=(e.scrollHeight+2)+'px'};
const catLbl=c=>String(c||'').replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D\u20E3]/gu,'').replace(/\s+/g,' ').trim()||String(c||'');
function siteCatsFor(pv){const lab=PLB[pv];if(!lab)return[];const m=new Map();
  ((CAT&&CAT.rows)||[]).forEach(r=>{if(r.state!=='on'||!r.category||String(r.platform_label||'').toLowerCase()!==lab.toLowerCase())return;const k=stripEmo(r.category).toLowerCase(),o=m.get(k);if(o)o.n++;else m.set(k,{c:r.category,n:1})});
  const ti=c=>{const i=TORD.indexOf(typeOf(c));return i<0?99:i};
  return [...m.values()].sort((a,b)=>ti(a.c)-ti(b.c)||catLbl(a.c).localeCompare(catLbl(b.c)))}
const catOpt=x=>`<option value="${esc(x.c)}">${esc(catLbl(x.c))}${x.n?' ('+bn(x.n)+')':''}</option>`,
  catGroups=L=>{const g={};L.forEach(x=>{const k=typeOf(x.c);(g[k]=g[k]||[]).push(x)});return TORD.filter(k=>g[k]).map(k=>`<optgroup label="${esc(TLBL[k])}">${g[k].map(catOpt).join('')}</optgroup>`).join('')};
/* S3: সাইটের ক্যাটেগরি ফোনের ক্যাটালগ (CAT) থেকেই আসে; আগের svc_cat_suggest কলের handler সার্ভারে ছিল না (unknown_action) আর উত্তরও কোথাও পড়া হতো না — তাই সার্ভার কল বাদ */
function loadSiteCats(pv){return Promise.resolve()}
function fillCatSel(sel,pv,val){const L=siteCatsFor(pv),k=stripEmo(val||'').toLowerCase();
  sel.innerHTML='<option value="">'+(L.length?'সাইটে থাকা ক্যাটেগরি থেকে বাছুন ▾':'এই প্ল্যাটফর্মে সাইটে ক্যাটেগরি নেই — নিজে লিখুন')+'</option>'+catGroups(L);
  const f=L.find(x=>stripEmo(x.c).toLowerCase()===k);sel.value=f?f.c:''}
const planName=(b,k)=>b.substring(0,112)+' · Plan '+String.fromCharCode(65+k);
function allIdeas(r,plat){const a=nameIdeas(r,plat),out=[],seen=new Set(),add=x=>{x=x.substring(0,120);const k=x.toLowerCase();if(x&&!seen.has(k)){seen.add(k);out.push(x)}};
  a.forEach(add);
  const V=[x=>x.replace(/ \| /g,' ✦ '),x=>x.replace(/ · /g,' • '),x=>x.replace(/ \| /g,' ✦ ').replace(/ · /g,' • '),x=>x.replace(/ — /g,' ⭐ '),x=>x.replace(/ \| /g,' ❘ ').replace(/ · /g,' ‧ ')];
  V.forEach(f=>a.forEach(x=>add(f(x))));return out}
let addNoRf=false;
function addList(list){
  const d=$('#bsheet'),box=$('#bsl'),E=$('#bsE'),PO=PLAT.map(p=>`<option>${p[0]}</option>`).join('');let any=false;
  $('#bsT').textContent=`সাইটে চালু করুন — ${bn(list.length)}টি (নিচে একটার পর একটা)`;box.innerHTML='';E.textContent='';$('#bsAll').value='';
  const items=list.map(r=>{const t=r.tidy||{};const ex0=((CAT&&CAT.rows)||[]).find(x=>x&&String(x.code)===String(r.service_id)&&x.src==='static');return{r,on:!ex0,conf:!!ex0,k:0,name:nice(r)||t.name||r.name,plat:t.plat||guess(r.category+' '+r.name),cat:cmGet(r.category)||matchCat(t.cat||r.category)}});
  /* একই কোয়ালিটির দুটো সার্ভিসের হুবহু একই নাম হবে না: ৫টা ছাঁচ + আলাদা চিহ্নের (✦ • ❘) রূপ থেকে যেটা ফাঁকা সেটা নেয় */
  const nk2=s=>String(s||'').trim().toLowerCase(),taken=new Set(((CAT&&CAT.rows)||[]).map(r=>nk2(r&&r.name)).filter(Boolean));
  items.forEach(it=>{const a=allIdeas(it.r,PLB[it.plat]||''),C=nameCtx(it.r),nb=nameIdeas(it.r,PLB[it.plat]||'').length||1,st=C&&a.length?hsh(C.key)%nb%a.length:0;let nm=null;
    for(let i=0;i<a.length&&!nm;i++){const c=a[(st+i)%a.length];if(!taken.has(nk2(c)))nm=c}
      if(!nm&&a.length){for(let k=1;k<26&&!nm;k++){const c=planName(a[st],k);if(!taken.has(nk2(c)))nm=c}}
    it.name=nm||(a.length?a[st]:it.name);taken.add(nk2(it.name))});
  const cnt=()=>{const k=items.filter(x=>x.on).length;$('#bsOk').textContent=`সবগুলো চালু করুন (${bn(k)}টি)`;$('#bsOk').disabled=!k};
  items.forEach(it=>{const c=document.createElement('div');c.className='card bsi';
    c.innerHTML=`<div class="bsh"><label class="bsk"><input type="checkbox" checked aria-label="চালু করুন"><b>#${esc(it.r.service_id)}</b></label><span class="sub">রেট ${rateTk(it.r.rate)}</span><button type="button" class="sm bsn" aria-label="অন্য নাম প্রস্তাব">↻ নাম</button><button type="button" class="sm bsx" aria-label="রিমুভ">✕ রিমুভ</button></div><div class="sub bso"></div><textarea class="bn" rows="2" maxlength="120" aria-label="সাইটে নাম"></textarea><select class="bp" aria-label="প্ল্যাটফর্ম">${PO}</select><select class="bcs" aria-label="সাইটে থাকা ক্যাটেগরি থেকে বাছুন"></select><textarea class="bc" rows="1" autocomplete="off" aria-label="ক্যাটেগরি" placeholder="ক্যাটেগরি (বাছুন বা নিজে লিখুন)"></textarea><div class="chk bchk" aria-live="polite"></div>`;
    c.querySelector('.bso').textContent=(it.r.provider?it.r.provider+' · ':'')+'মূল: '+it.r.name;
    const ck=c.querySelector('input[type=checkbox]'),n=c.querySelector('.bn'),p=c.querySelector('.bp'),cc=c.querySelector('.bc');
    if(it.conf){ck.checked=false;c.classList.add('off')}
    const cs=c.querySelector('.bcs');Object.assign(it,{c,ck,n,p,cc,cs});p.value=it.plat;n.value=it.name;cc.value=it.cat;
    it.chk=(mark)=>{const o=items.filter(x=>x!==it&&!x.removed).map(x=>x.name),res=readyCheck(it.r,{name:it.name,plat:p.value,cat:it.cat},o);c.querySelector('.bchk').innerHTML=chkHtml(res);if(mark){n.classList.toggle('bad',res.E.some(x=>x.f==='name'));cc.classList.toggle('bad',res.E.some(x=>x.f==='cat'));c.classList.toggle('fail',!res.ok)}return res};
    it.fill=()=>fillCatSel(cs,p.value,it.cat);it.fill();
    cs.onchange=()=>{if(!cs.value)return;it.cat=cs.value;cc.value=cs.value;cc.classList.remove('bad');autoH(cc);it.chk()};
    n.onkeydown=cc.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.target.blur()}};
    ck.onchange=()=>{it.on=ck.checked;c.classList.toggle('off',!it.on);cnt()};n.oninput=()=>{it.name=n.value;n.classList.remove('bad');autoH(n);it.chk()};p.onchange=()=>{it.plat=p.value;it.fill();loadSiteCats(p.value).then(it.fill);it.chk()};cc.oninput=()=>{it.cat=cc.value;cc.classList.remove('bad');autoH(cc);it.fill();it.chk()};
    c.querySelector('.bsn').onclick=()=>{const a=allIdeas(it.r,PLB[p.value]||'');if(!a.length)return;
      const u=new Set(items.filter(x=>x!==it).map(x=>nk2(x.name)));let ok2=false;for(let t=0;t<a.length;t++){it.k=(it.k+1)%a.length;if(!u.has(nk2(a[it.k]))&&!taken.has(nk2(a[it.k]))){ok2=true;break}}
      let nn=a[it.k];if(!ok2){for(let k=1;k<26;k++){const c=planName(a[it.k],k);if(!u.has(nk2(c))&&!taken.has(nk2(c))){nn=c;break}}}
      n.value=it.name=nn;n.classList.remove('bad');autoH(n);it.chk()};
    c.querySelector('.bsx').onclick=async()=>{if(busy)return;
      const rm=()=>{it.removed=true;const i=items.indexOf(it);if(i>=0)items.splice(i,1);c.remove();$('#bsT').textContent=`সাইটে চালু করুন — ${bn(items.length)}টি (নিচে একটার পর একটা)`;cnt();if(!items.length)d.close()};
      if(!it.done){rm();return}   /* এখনো চালু হয়নি: শুধু তালিকা থেকে বাদ */
      if(!confirm('#'+it.r.service_id+' সাইট থেকে রিমুভ করবেন?'))return;   /* চালু হয়ে গেছে: সাইট থেকেও লুকিয়ে ফেলে */
      busy=true;try{await api('svc_toggle',{provider:it.r.provider||cur,code:it.r.service_id,on:false});it.r.state='off';
        {const w=RW.get(it.r);if(w){w.cb&&(w.cb.checked=false);w.sw&&w.sw.setAttribute('aria-checked','false')}}any=true;rm();toast('সাইট থেকে রিমুভ হয়েছে')}
      catch(e){if(!authFail(e))toast(e.message)}busy=false};
    box.appendChild(c)});
  const applyAll=v=>{v=(v||'').trim();if(!v)return;items.forEach(x=>{if(x.on&&!x.done){x.cat=v;x.cc.value=v;x.cc.classList.remove('bad');autoH(x.cc);x.fill()}})};
  $('#bsAllB').onclick=()=>applyAll($('#bsAll').value);
  const as=$('#bsAllS'),plats=[...new Set(items.map(x=>x.plat))],drawAll=()=>{as.innerHTML='<option value="">সাইটে থাকা ক্যাটেগরি থেকে বাছুন ▾</option>'+plats.map(pv=>{const L=siteCatsFor(pv);return L.length?`<optgroup label="${esc(PLB[pv]||pv)}">${L.map(catOpt).join('')}</optgroup>`:''}).join('')};
  drawAll();Promise.all(plats.map(loadSiteCats)).then(drawAll);
  as.onchange=()=>{if(!as.value)return;$('#bsAll').value=as.value;applyAll(as.value);as.value=''};
  items.forEach(x=>loadSiteCats(x.p.value).then(x.fill));
  {const nc=items.filter(x=>x.conf).length;if(nc)E.textContent=`${bn(nc)}টি সার্ভিসের আইডি সাইটের মূল তালিকার অন্য সার্ভিসের সাথে মিলে যায় — ওগুলো আপনাআপনি বাদ রাখা হয়েছে, বাকিগুলো চালু করা যাবে`;items.forEach(x=>{if(x.conf)x.chk(true)});cnt()}
  $('#bsX').onclick=()=>{if(!busy)d.close()};
  d.onclose=()=>{const nr=addNoRf;addNoRf=false;bulkBar();if(any&&cur&&!nr)provider(cur)};   /* স্পিড পাতা থেকে খুলে থাকলে প্রভাইডার পাতা জোর করে খোলে না */
  $('#bsOk').onclick=async()=>{if(busy)return;const L=items.filter(x=>x.on&&!x.done);if(!L.length)return;
    {const res=L.map(x=>[x,x.chk(true)]),bad=res.filter(z=>!z[1].ok);
      if(bad.length){E.textContent=`${bn(bad.length)}টি সার্ভিস সাইটে তোলার মতো তৈরি নয় — লাল কার্ডের নিচের ✖ লেখা ঠিক করুন (বাকি ${bn(L.length-bad.length)}টি ঠিক আছে)`;bad[0][0].c.scrollIntoView({block:'center'});return}
      const nw=res.reduce((a,z)=>a+z[1].W.length,0);E.textContent=nw?`সব ঠিক আছে (${bn(nw)}টি সতর্কতা সহ) — চালু হচ্ছে…`:''}
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
  cnt();d.showModal();box.scrollTop=0;items.forEach(x=>{autoH(x.n);autoH(x.cc);x.chk()})}
function addQueue(list){addList(list)}
async function bulk(k){
  if(k==='tq'){const L=[...sel].filter(x=>+x.rate>0).map(x=>({provider:x.provider||cur,service_id:x.service_id,name:x.name,rate:x.rate,min:x.min,max:x.max,refill:x.refill,_fx:fxNow()}));
    if(!L.length){toast('টেস্টের মতো (দামসহ) সার্ভিস বাছা হয়নি');return}
    if(!window.StudioTQ||!window.StudioTQ.stage){toast('টেস্ট কিউ লোড হয়নি');return}
    const n=window.StudioTQ.stage(L);toast(bn(n)+'টি টেস্ট কিউতে নেওয়া হয়েছে — প্রতিটার লিংক ও পরিমাণ ৩ নম্বরে দিন');sel.clear();location.hash='tq';return}
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
  (list.length||S.type||S.cat?`<div class="cchips" role="group" aria-label="ক্যাটেগরি"><button class="chip cc" data-cc="" aria-pressed="${!S.cat}">সব ${esc(TLBL[S.type]||'ক্যাটেগরি')} <small>${bn(list.length)}</small></button>${list.map(x=>`<button class="chip cc" data-cc="${esc(x.c)}" aria-pressed="${S.cat===x.c}">${esc(x.c)}${x.n?` <small>${bn(x.n)}</small>`:''}</button>`).join('')}</div>`:'<p class="sub">উপরে একটা ধরন বাছুন — ওই ধরনের সব ক্যাটেগরি পাশাপাশি আসবে।</p>')}
function bindCat(root,S,fn){
  root.querySelectorAll('[data-ty]').forEach(b=>b.onclick=()=>{S.type=b.dataset.ty;S.cat='';fn()});
  root.querySelectorAll('[data-cc]').forEach(b=>b.onclick=()=>{S.cat=b.dataset.cc;if(S.cat)S.type=typeOf(S.cat);fn()})}
const catsFor=(o,pl)=>Object.keys(o||{}).filter(c=>!pl||platMatch(pl,c)).map(c=>({c,n:o[c]}));
/* ধরন বাছা থাকলে সার্ভার থেকে পাতা পাতা করে এনে ক্লায়েন্টে ছেঁকে নেয় */
async function pageRows(act,base,off,lim,type){let rows=[],raw=off,d;const L=type?200:lim;
  for(let i=0;i<60;i++){d=await api(act,Object.assign({},base,{offset:raw,limit:L}));raw+=d.rows.length;rows=rows.concat(type?d.rows.filter(r=>typeOf(r.category)===type):d.rows);if(!type||rows.length>=lim||raw>=d.total||!d.rows.length)break}
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
let ps={q:'',type:'',state:'all',off:0,sort:'asc'};
async function plat(){
  cur=null;$('#title').textContent='প্ল্যাটফর্ম';$('#back').hidden=true;const el=$('#main');el.innerHTML=nav('plat')+'<div class="sk"></div>';
  try{await swr('svc_platforms',{},d=>{
    el.innerHTML=nav('plat')+'<p class="sub">লোগোতে ট্যাপ করুন — ১০ প্রভাইডারের ওই প্ল্যাটফর্মের সব সার্ভিস আসবে।</p><div class="pg">'+popSort(d.platforms.map(p=>Object.assign({n:p.total},p))).map(p=>`<a class="pt" href="#pl=${encodeURIComponent(p.label)}">${logo(p.label,52)}<b>${esc(p.label)}</b><span class="sub">${bn(p.total)}টি · সাইটে ${bn(p.site)}</span></a>`).join('')+'</div>'+(()=>{const rest=d.platforms.filter(p=>!isPop(p.label));return rest.length?`<select class="plmore" id="plr" aria-label="আরও প্ল্যাটফর্ম"><option value="">আরও প্ল্যাটফর্ম (${bn(rest.length)}টি) ▾</option>${rest.map(p=>`<option value="${esc(p.label)}">${esc(p.label)} (${bn(p.total)}টি · সাইটে ${bn(p.site)})</option>`).join('')}</select>`:''})();
    const pr=$('#plr');if(pr)pr.onchange=()=>{if(pr.value)location.hash='pl='+encodeURIComponent(pr.value)};
  });}catch(e){if(!authFail(e))el.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p></div>`}}
function platPage(label){
  cur=null;$('#title').textContent=label;$('#back').hidden=false;const el=$('#main');ps={q:'',type:'',state:'all',off:0,prov:[],sort:'asc',tst:''};
  el.innerHTML=`<div class="phd">${logo(label,48)}<div><b>${esc(label)}</b><div class="sub" id="pcnt"></div></div></div><div class="bar"><input id="pq" type="search" placeholder="নাম বা আইডি খুঁজুন" aria-label="খুঁজুন"></div><div class="chips" id="ppv"></div><div class="chips" id="pty"></div><div class="chips">${[['all','সব'],['on','চালু'],['off','বন্ধ']].map(s=>`<button class="chip" data-s="${s[0]}" aria-pressed="${s[0]==='all'}">${s[1]}</button>`).join('')}<button class="chip" id="psa">সব বাছুন</button></div><div class="chips" id="pso" role="group" aria-label="দাম সাজান"><button class="chip" data-so="asc" aria-pressed="true">দাম: কম → বেশি</button><button class="chip" data-so="desc" aria-pressed="false">দাম: বেশি → কম</button><button class="chip" data-so="fast" aria-pressed="false">⚡ দ্রুততম আগে</button></div><div class="chips" id="ptt" role="group" aria-label="টেস্ট"></div><div class="list" id="pl"></div><div id="pmore"></div>`;
  $('#pso').querySelectorAll('[data-so]').forEach(b=>b.onclick=()=>{ps.sort=b.dataset.so;$('#pso').querySelectorAll('[data-so]').forEach(x=>x.setAttribute('aria-pressed',x===b));pload(label)});
  $('#psa').onclick=()=>el.querySelectorAll('#pl .sel').forEach(x=>{if(!x.checked){x.checked=true;x.onchange({target:x})}});
  $('#pq').oninput=e=>{clearTimeout(qt);qt=setTimeout(()=>{ps.q=e.target.value;pload(label)},350)};
  el.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{ps.state=b.dataset.s;el.querySelectorAll('[data-s]').forEach(x=>x.setAttribute('aria-pressed',x===b));pload(label)});
  if(TST)pload(label);else tstRefresh().finally(()=>pload(label))}
async function pload(label,more){
  if(!more)ps.off=0;const box=$('#pl');if(!more)box.innerHTML='<div class="sk"></div>';
  try{const d=await api('svc_by_platform',{label,q:ps.q,type:ps.type,state:ps.state,provs:ps.prov,sort:ps.sort,tst:ps.tst,offset:ps.off,limit:ps.tst?80:40});d.cmp=1;window._fx=d.fx;window._sc=d.site_categories;
    $('#pcnt').textContent=`মোট ${bn(d.total)}টি · ${ps.sort==='desc'?'দামি আগে':'সস্তা আগে'}`;
    $('#ptt').innerHTML=[['','সব'],['yes','🧪 টেস্টেড সার্ভিস'+(d.tn!=null?' '+bn(d.tn):'')],['run','⏳ টেস্টিং'],['no','অপরীক্ষিত']].map(s=>`<button class="chip" data-tt="${s[0]}" aria-pressed="${(ps.tst||'')===s[0]}">${s[1]}</button>`).join('');
    $('#ptt').querySelectorAll('[data-tt]').forEach(b=>b.onclick=()=>{ps.tst=b.dataset.tt;pload(label)});
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
  cur=null;ms.state='on';$('#title').textContent='সাইটের সার্ভিস';$('#back').hidden=true;const el=$('#main');
  el.innerHTML=nav('mng')+`<div class="card" id="psy"><b>💲 অটো দাম-সিঙ্ক</b><p class="sub">প্রভাইডারের রেট বাড়লে সাইটে চালু সার্ভিসের দাম নিজে থেকে বাড়ে (সাইটের মার্কআপ নিয়ম এরপর আপনাআপনি বসে)। রোজ ভোরে প্রভাইডারের তালিকা নতুন করে এনে মেলানো হয়।</p><div class="acts" style="align-items:center"><span id="psyS" class="sub">লোড হচ্ছে…</span><button class="sw" role="switch" id="psyT" aria-checked="false" aria-label="অটো দাম-সিঙ্ক চালু/বন্ধ" disabled></button></div><label class="sub" for="psyC">একবারে সর্বোচ্চ কত % বাড়/কমতে দেবে (এর বেশি হলে নিজে না বদলে আপনাকে জানাবে)</label><input id="psyC" type="number" inputmode="numeric" min="1" max="500" value="50"><label class="sub"><input type="checkbox" id="psyD"> রেট কমলে দামও কমুক</label><div class="acts"><button class="sm" id="psyChk">🔍 এখন যাচাই করুন</button><button class="sm dng" id="psyGo" hidden>✔ এখনই প্রয়োগ করুন</button></div><div id="psyOut" class="sub"></div></div><div class="card" id="fxd"><b>⚙ অটো: যোগ হওয়া মার্কআপ সরান</b><p class="sub">সব সার্ভিসের দাম প্রভাইডারের আসল রেটের সাথে মিলিয়ে দেখে — যেগুলোতে রেটের চেয়ে বেশি দাম বসে আছে (মার্কআপ যোগ হয়ে গেছে), সেগুলো একসাথে প্রভাইডারের আসল রেটে ফেরায়। এরপর সাইট একবারই মার্কআপ দেবে। নিজে খুঁজতে হবে না।</p><div class="acts"><button class="sm" id="fxdChk">🔍 সব যাচাই করুন</button><button class="sm dng" id="fxdGo" hidden>✔ সবগুলো ঠিক করুন</button></div><div id="fxdOut" class="sub"></div></div><div id="mps"></div><div class="bar"><input id="mq" type="search" placeholder="নাম, আইডি বা ক্যাটেগরি" value="${esc(ms.q)}" aria-label="খুঁজুন"></div><div id="mcats"></div><div id="mcm"></div><div class="chips"><button class="chip" id="msa">সব বাছুন</button><button class="chip" id="msy">⟳ সিঙ্ক</button></div><p class="sub" id="mcnt"></p><div class="list" id="ml"></div><div id="mmore"></div>`;
  $('#mq').oninput=e=>{clearTimeout(qt);qt=setTimeout(()=>{ms.q=e.target.value;mload()},350)};
  $('#msa').onclick=()=>el.querySelectorAll('.msel').forEach(x=>{if(!x.checked){x.checked=true;x.onchange({target:x})}});
  $('#fxdChk').onclick=async()=>{const o=$('#fxdOut');o.textContent='খোঁজা হচ্ছে…';try{const d=await api('svc_fix_double',{apply:false});$('#fxdGo').hidden=!d.count;o.innerHTML=d.count?`<b>${bn(d.count)}টি</b> সার্ভিসে দাম বেশি বসে আছে:<br>`+d.items.map(i=>`#${esc(i.code)} ${esc(i.name)} — এখন $${esc(i.stored)} → হবে $${esc(i.rate)}`).join('<br>')+(d.count>d.items.length?`<br>… আরও ${bn(d.count-d.items.length)}টি`:''):'কোনো যোগ-হওয়া মার্কআপ পাওয়া যায়নি ✔ ('+bn(d.checked||0)+'টি যাচাই হয়েছে)'+(d.no_provider?` (${bn(d.no_provider)}টি সার্ভিসে প্রভাইডারের নাম নেই, সেগুলো মেলানো যায়নি)`:'')}catch(e){o.textContent='';if(!authFail(e))toast(e.message)}};
  $('#fxdGo').onclick=async()=>{const b=$('#fxdGo'),o=$('#fxdOut');if(!confirm('এই সার্ভিসগুলোর দাম প্রভাইডারের রেটে ফেরানো হবে। চালিয়ে যাবেন?'))return;b.disabled=true;try{const d=await api('svc_fix_double',{apply:true});o.textContent='ঠিক হয়েছে — '+bn(d.count)+'টি সার্ভিস';b.hidden=true;try{await catSyncNow()}catch(_){}}catch(e){if(!authFail(e))toast(e.message)}b.disabled=false};
  (async()=>{const T=$('#psyT'),S=$('#psyS'),C=$('#psyC'),D=$('#psyD'),O=$('#psyOut');
    const paint=c=>{T.setAttribute('aria-checked',String(!!c.on));T.disabled=false;C.value=c.cap;D.checked=!!c.down;S.textContent=(c.on?'চালু ✔':'বন্ধ')+(c.last?' · শেষ চালু '+c.last+' ('+bn(c.last_n)+'টি বদলেছে'+(c.last_held?', '+bn(c.last_held)+'টি অপেক্ষায়':'')+')':'')};
    try{const d=await api('svc_psync_info',{});paint(d.cfg)}catch(e){S.textContent='';if(!authFail(e))toast(e.message);return}
    const save=async(x)=>{try{const d=await api('svc_psync_set',x);paint(d.cfg);toast(d.note||'সেভ হয়েছে ✔')}catch(e){if(!authFail(e))toast(e.message)}};
    T.onclick=()=>{T.disabled=true;save({on:T.getAttribute('aria-checked')!=='true',cap:+C.value,down:D.checked})};
    C.onchange=()=>save({cap:+C.value});D.onchange=()=>save({down:D.checked});
    const run=async(apply)=>{O.textContent=apply?'প্রয়োগ হচ্ছে…':'মেলানো হচ্ছে…';try{const d=await api('svc_psync_run',{apply,cap:+C.value,down:D.checked});
      const row=i=>`#${esc(i.code)} ${esc(i.name)} — $${esc(i.from)} → $${esc(i.to)} (${i.pct>0?'+':''}${bn(i.pct)}%)`;
      let h=d.count?`<b>${bn(d.count)}টি</b> সার্ভিসের দাম ${apply?'বদলেছে':'বদলাবে'} (বাড়বে ${bn(d.up)}, কমবে ${bn(d.down)}):<br>`+d.items.map(row).join('<br>')+(d.count>d.items.length?`<br>… আরও ${bn(d.count-d.items.length)}টি`:''):'বদলানোর মতো কিছু নেই ✔ ('+bn(d.checked)+'টি মেলানো হয়েছে)';
      if(d.held)h+=`<br><br>⚠ <b>${bn(d.held)}টি</b> সীমার (${bn(+C.value)}%) বেশি লাফ — এগুলো নিজে বদলায়নি, দেখে ঠিক করুন:<br>`+d.held_items.map(row).join('<br>');
      if(d.no_provider)h+=`<br>(${bn(d.no_provider)}টি সার্ভিসে প্রভাইডারের নাম নেই, মেলানো যায়নি)`;
      O.innerHTML=h;$('#psyGo').hidden=apply||!d.count;if(apply){try{await catSyncNow()}catch(_){}const i2=await api('svc_psync_info',{}).catch(()=>null);if(i2)paint(i2.cfg)}}catch(e){O.textContent='';if(!authFail(e))toast(e.message)}};
    $('#psyChk').onclick=()=>run(false);$('#psyGo').onclick=()=>{if(confirm('উপরের সার্ভিসগুলোর দাম এখনই বদলাবে। চালিয়ে যাবেন?'))run(true)};
  })();
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
    window._mt=d.total;$('#mcnt').textContent=ms.type&&!ms.cat?`${TLBL[ms.type]} ধরন · লোড হয়েছে ${bn(d.next)}/${bn(d.total)}টি থেকে`:`সাইটে চালু ${bn(d.total)}টি সার্ভিস`;
    if(!more)box.innerHTML='';if(!d.rows.length&&!more)box.innerHTML='<div class="card empty">সাইটে এমন কোনো চালু সার্ভিস পাওয়া যায়নি</div>';
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
    try{await api('svc_site_hide',{codes:[r.code],on});r.state=on?'on':'off';
      if(!on){ssel.forEach(x=>{if(x.code===r.code)ssel.delete(x)});c.remove();msBar();const n=$('#mcnt');if(n&&/^সাইটে চালু/.test(n.textContent)){window._mt=Math.max(0,(window._mt||1)-1);n.textContent='সাইটে চালু '+bn(window._mt)+'টি সার্ভিস'}
        if(!$('#ml').children.length)$('#ml').innerHTML='<div class="card empty">সাইটে এমন কোনো চালু সার্ভিস পাওয়া যায়নি</div>';
        toastU('সাইট থেকে সরানো হয়েছে',()=>api('svc_site_hide',{codes:[r.code],on:true}))}
      else toast('চালু হয়েছে')}catch(e){if(!authFail(e))toast(e.message)}b.disabled=false;busy=false};
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
  dlg.innerHTML=`<form method="dialog"><h3 style="margin:0 0 8px">সম্পাদনা · ID ${esc(r.code)}</h3><label for="enm">সার্ভিসের নাম</label><input id="enm" maxlength="120" value="${esc(r.name)}"><label for="epl">প্ল্যাটফর্ম</label><select id="epl">${pls.map(p=>`<option${p===r.platform?' selected':''}>${esc(p)}</option>`).join('')}</select><label for="ect">ক্যাটেগরি</label><input id="ect" autocomplete="off" value="${esc(r.category)}"><div id="esg" class="csg"></div><p id="eer" class="err" role="alert"></p><div class="acts"><button class="sm" value="cancel" formnovalidate>বাতিল</button><button class="sm" id="etd" type="button">অটো সাজান</button><button class="sm" id="epn" type="button">↩ প্রভাইডারের নাম</button><button class="btn" value="ok">সংরক্ষণ</button></div></form>`;
  catSuggest($('#ect'),$('#epl'),$('#esg'),()=>[r.category,(r.tidy||{}).cat]);
  $('#etd').onclick=()=>{const t=r.tidy||{},nn=nice(r)||t.name;if(nn)$('#enm').value=nn;if(t.cat)$('#ect').value=t.cat};
  $('#epn').onclick=async()=>{const v=await provNameGet(r);if(!v){toast('প্রভাইডারের নাম পাওয়া যায়নি — আগে সিঙ্ক করুন');return}$('#enm').value=v.n};
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
    if(!confirm('"'+cat+'" ক্যাটেগরির চালু '+bn(codes.length)+'টি সার্ভিস সাইট থেকে মুছে/লুকানো হবে।\n(পরে প্রভাইডার/প্ল্যাটফর্ম পাতা থেকে আবার যোগ করা যাবে, অথবা AI সহকারীকে ক্যাটেগরি ফেরাতে বললে ফিরবে)\nনিশ্চিত?')){busy=false;return}
    let done=0;for(const c of chunks(codes,200)){const r=await api('svc_site_hide',{codes:c,on:false,del:true});done+=r.done}
    SC=null;toast(bn(done)+'টি সার্ভিস সরানো হয়েছে');busy=false;if(after)after();else{ms.cat='';mload()}}
  catch(e){busy=false;if(!authFail(e))toast(e.message)}}
function msBar(){let b=$('#bulk');if(!b){b=document.createElement('div');b.id='bulk';b.className='bulk';document.body.appendChild(b)}
  b.hidden=!ssel.size;b.innerHTML=`<b>${bn(ssel.size)}টি</b><button class="sm" data-a="hide">বন্ধ</button><button class="sm" data-a="del">মুছুন</button><button class="sm" data-a="cat">ক্যাটেগরি</button><button class="sm" data-a="tidy">সাজান</button><button class="sm" data-a="price">💲 দাম</button><button class="sm" data-a="x" aria-label="বাতিল">✕</button>`;
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
let CPS='';
async function siteRows(force){if(SC&&!force)return SC;SC=await scanSite({state:'all'});return SC}
const matchCat=c=>{const k=stripEmo(c).toLowerCase(),f=(window._sc||[]).find(x=>stripEmo(x).toLowerCase()===k);return f||c};
function askText(title,val,emo){return new Promise(res=>{let d=$('#ask');if(!d){d=document.createElement('dialog');d.id='ask';document.body.appendChild(d)}
  d.innerHTML=`<form method="dialog"><h3 style="margin:0 0 8px">${esc(title)}</h3><div class="knm"><input id="askv" maxlength="80" value="${esc(val)}" aria-label="${esc(title)}">${emo?'<button type="button" class="ib" id="aske" aria-label="ইমুজি যোগ করুন" title="ইমুজি যোগ করুন">✨</button>':''}</div><div class="acts"><button class="btn" value="ok" style="order:2">ঠিক আছে</button><button class="sm" value="cancel" formnovalidate style="order:1">বাতিল</button></div></form>`;
  const inp=d.querySelector('#askv'),eb=d.querySelector('#aske');if(eb)eb.onclick=()=>{inp.value=catNice(inp.value);inp.focus()};
  d.addEventListener('close',()=>res(d.returnValue==='ok'?inp.value:null),{once:true});d.returnValue='';d.showModal();inp.focus();inp.select()})}

async function catsPage(){
  cur=null;$('#title').textContent='ক্যাটেগরি';$('#back').hidden=true;const el=$('#main');
  el.innerHTML=nav('cats')+'<div class="sk"></div><div class="sk" style="margin-top:12px"></div>';
  try{const rows=(await siteRows(true)).filter(r=>r.state!=='off'),G={},all=new Set();
    rows.forEach(r=>{if(!r.category)return;all.add(r.category);const p=r.platform_label||'other',g=G[p]||(G[p]={}),c=g[r.category]||(g[r.category]={n:0,on:0});c.n++;c.on++});
    const PRI=['facebook','instagram','tiktok','youtube','twitter','x','telegram','whatsapp','spotify','google','linkedin','snapchat','threads'],pri=p=>{const i=PRI.indexOf(String(p).toLowerCase());return i<0?99:i},pls=Object.keys(G).sort((a,b)=>pri(a)-pri(b)||Object.keys(G[b]).length-Object.keys(G[a]).length);if(CPS&&!G[CPS])CPS='';
    const pchips=()=>'<button class="chip" data-p="" aria-pressed="'+(!CPS)+'">সব '+bn(all.size)+'</button>'+pls.map(p=>'<button class="chip" data-p="'+esc(p)+'" aria-pressed="'+(CPS===p)+'">'+logo(p,16)+' '+esc(p)+' '+bn(Object.keys(G[p]).length)+'</button>').join('');
    el.innerHTML=nav('cats')+'<div class="chips pchips" id="cpl" role="group" aria-label="প্ল্যাটফর্ম" style="margin-top:10px">'+pchips()+'</div>'+`<div class="bar"><button class="btn" id="cnew">➕ নতুন ক্যাটেগরি</button></div><div class="bar"><button class="sm" id="cemo" style="flex:1">✨ সব ক্যাটেগরিতে ইমুজি দিন</button><button class="chip" id="cemt" aria-pressed="${emoOn()}" title="ইমুজি দিয়ে সাজানো চালু/বন্ধ">🙂 ইমুজি ${emoOn()?'চালু':'বন্ধ'}</button></div><div class="bar"><input id="cqs" type="search" placeholder="ক্যাটেগরি খুঁজুন" aria-label="ক্যাটেগরি খুঁজুন"></div><p class="sub" id="ccn">সাইটে চালু ${bn(all.size)}টি ক্যাটেগরি · ${bn(rows.length)}টি সার্ভিস</p><p class="sub" id="cprog" role="status"></p><div id="cgl"></div>`;
    const draw=q=>{q=q.trim().toLowerCase();let h='';
      (CPS?pls.filter(x=>x===CPS):pls).forEach(p=>{const cs=Object.keys(G[p]).filter(c=>!q||c.toLowerCase().indexOf(q)>=0).sort((a,b)=>a.localeCompare(b));if(!cs.length)return;
        h+=`<h3 class="sec pc">${logo(p,24)} ${esc(p)} <span class="sub">· ${bn(cs.length)}টি</span></h3><div class="list">`+cs.map(c=>`<div class="card cat"><a class="cl" href="${esc(catUrl(c))}"><b>${esc(c)}</b><span class="sub" style="display:block">${bn(G[p][c].n)}টি সার্ভিস</span></a><span class="ca"><button class="sm" type="button" data-ren="${esc(c)}" aria-label="নাম বদলান" title="নাম বদলান">✎</button><button class="sm dng" type="button" data-del="${esc(c)}" aria-label="ক্যাটেগরি সরান" title="সাইট থেকে সরান">🗑</button></span></div>`).join('')+'</div>'});
      $('#cgl').innerHTML=h||'<div class="card empty">সাইটে চালু কোনো ক্যাটেগরি পাওয়া যায়নি</div>';{const ps=CPS?[CPS]:pls,nc=ps.reduce((a,p)=>a+Object.keys(G[p]).length,0),ns=ps.reduce((a,p)=>a+Object.keys(G[p]).reduce((b,c)=>b+G[p][c].n,0),0);$('#ccn').textContent='সাইটে চালু '+bn(nc)+'টি ক্যাটেগরি · '+bn(ns)+'টি সার্ভিস'+(CPS?' ('+CPS+')':'')}};
    draw('');$('#cqs').oninput=e=>draw(e.target.value);
    $('#cpl').onclick=e=>{const b=e.target.closest('[data-p]');if(!b)return;CPS=b.dataset.p;$('#cpl').querySelectorAll('[data-p]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.p===CPS)));draw($('#cqs').value)};
    $('#cgl').onclick=e=>{const r=e.target.closest('[data-ren]'),d=e.target.closest('[data-del]');if(r){e.preventDefault();catRename(r.dataset.ren,()=>catsPage())}else if(d){e.preventDefault();catDelete(d.dataset.del,()=>catsPage())}};
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
  try{const rows=await scanSite({category:name,state:'on'}),pl=(rows.find(r=>r.platform_label)||{}).platform_label||'';window._sc=window._sc||[];
    el.innerHTML=`<div class="card catbar"><div><b style="font-size:18px;word-break:break-word">${esc(name)}</b><div class="sub" id="kcn">সাইটে চালু ${bn(rows.length)}টি সার্ভিস</div>${pl?`<button class="chip" id="kpl" type="button" style="margin-top:8px" aria-label="${esc(pl)} প্ল্যাটফর্মের সব ক্যাটেগরি">${logo(pl,16)} ${esc(pl)} · সব ক্যাটেগরি ›</button>`:''}</div><div class="acts"><button class="sm" id="kr">✎ নাম বদলান</button><button class="sm" id="ke">✨ ইমুজি</button><button class="sm" id="ka">➕ সার্ভিস যোগ</button><button class="sm" id="kt">🧹 সার্ভিসের নাম সাজান</button><button class="sm dng" id="kd">🗑 মুছুন</button></div></div><div class="bar"><input id="kq" type="search" placeholder="এই ক্যাটেগরির সার্ভিস খুঁজুন (নাম বা আইডি)" aria-label="খুঁজুন"></div><p class="sub">নামের ঘরে সরাসরি লিখুন → 💾 চাপুন। ✨ চাপলে অটো নাম (ইমুজিসহ) বসবে।</p><div class="list" id="kl"></div><div id="kmore"></div>`;
    let q='',shown=0;const reload=()=>route();
    const list=()=>rows.filter(r=>!q||qOK(q,r.name+' '+r.code));
    const more=()=>{const L=list();L.slice(shown,shown+60).forEach(r=>$('#kl').appendChild(krow(r,reload)));shown=Math.min(L.length,shown+60);
      $('#kmore').innerHTML=shown<L.length?`<button class="sm" id="kmb" style="width:100%;margin-top:8px">আরও দেখান (${bn(L.length-shown)}টি বাকি)</button>`:'';const m=$('#kmb');if(m)m.onclick=more};
    const fresh=()=>{$('#kl').innerHTML='';shown=0;more();if(!list().length)$('#kl').innerHTML='<div class="card empty">কিছু পাওয়া যায়নি</div>'};
    if(!rows.length)$('#kl').innerHTML='<div class="card empty">এই ক্যাটেগরিতে সাইটে চালু কোনো সার্ভিস নেই</div>';else fresh();$('#kq').oninput=e=>{clearTimeout(qt);qt=setTimeout(()=>{q=e.target.value.trim().toLowerCase();fresh()},250)};
    $('#kr').onclick=()=>catRename(name,nn=>{location.hash=catUrl(nn)});
    const kp=$('#kpl');if(kp)kp.onclick=()=>{CPS=pl;location.hash='cats'};
    $('#ke').onclick=async()=>{if(busy)return;const nn=catNice(name);if(!nn||nn===name){toast('আগে থেকেই এই নামে সাজানো আছে');return}
      if(!confirm('ক্যাটেগরির নাম বদলাবে:\n'+name+'\n→ '+nn+'\n\n'+bn(rows.length)+'টি সার্ভিসের ক্যাটেগরি বদলাবে। চালিয়ে যাবেন?'))return;
      busy=true;try{await catsEmojiDo([[name,nn]]);toast('ক্যাটেগরির নাম সাজানো হয়েছে ✔');busy=false;location.hash=catUrl(nn)}catch(e){busy=false;if(!authFail(e))toast(e.message)}};
    $('#ka').onclick=()=>catSheet({mode:'add',name,after:reload});
    $('#kt').onclick=async()=>{if(busy)return;busy=true;const b=$('#kt');b.disabled=true;
      try{const t=await tidyItems({category:name,state:'on'});
        if(!t.it.length){toast('সব সার্ভিস আগেই সাজানো ✔');busy=false;b.disabled=false;return}
        if(!confirm(bn(t.it.length)+'টি সার্ভিসের নাম বদলাবে। যেমন:\n'+t.it.slice(0,3).map(x=>x.cn+'\n→ '+x.nn).join('\n\n')+'\n\nচালিয়ে যাবেন?')){busy=false;b.disabled=false;return}
        const n=await tidyDo(t.it);SC=null;toast(bn(n)+'টির নাম সাজানো হয়েছে ✔');busy=false;reload()}
      catch(e){busy=false;b.disabled=false;if(!authFail(e))toast(e.message)}};
    $('#kd').onclick=()=>catDelete(name,()=>{location.hash='cats'})
  }catch(e){if(!authFail(e))el.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p><button class="btn" id="rt" style="max-width:220px">আবার চেষ্টা করুন</button></div>`,$('#rt').onclick=()=>catPage(name)}}
/* ক্যাটেগরির ভেতরের একটা সার্ভিস: নাম সরাসরি এডিট */
/* প্রভাইডারের ডিফল্ট নাম: সাইটের কোড = প্রভাইডারের service_id; ১০ প্রভাইডারের ক্যাশ থেকে নেয় */
function provNameFor(r){const L=lpRows().filter(x=>String(x.service_id)===String(r.code));if(!L.length)return null;const m=L.find(x=>r.provider&&x.provider===r.provider)||L[0];return m&&m.name?{p:m.provider,n:String(m.name)}:null}
async function provNameGet(r){let v=provNameFor(r);if(!v){try{await allReady()}catch(_){}v=provNameFor(r)}return v}
function krow(r,reload){
  const c=document.createElement('div');c.className='card krow'+(r.state==='off'?' dim':'');
  c.innerHTML=`<div class="khd"><span class="sub">${logo(r.platform_label,18)} ID <b>${esc(r.code)}</b> · খরচ <b>$${esc(r.cost)}</b> · ${bn(r.min)}–${bn(r.max)}${r.state==='off'?' · লুকানো':''}</span><div class="acts2"><button class="sw" role="switch" aria-checked="${r.state!=='off'}" aria-label="সাইটে চালু/বন্ধ" data-h></button></div></div><div class="knm"><input class="nm" maxlength="120" value="${esc(r.name)}" aria-label="সার্ভিসের নাম (ID ${esc(r.code)})"><button class="ib" type="button" data-a title="অটো সাজান (ইমুজিসহ)" aria-label="অটো সাজান">✨</button><button class="ib sv" type="button" data-s hidden title="সংরক্ষণ" aria-label="সংরক্ষণ">💾</button></div><div class="sub pvn" hidden></div><div class="row2"><button class="sm" type="button" data-pn>↩ প্রভাইডারের নাম</button><button class="sm" type="button" data-e>✎ বিস্তারিত এডিট (ক্যাটেগরি/প্ল্যাটফর্ম)</button></div>`;
  const inp=c.querySelector('.nm'),sv=c.querySelector('[data-s]'),chk=()=>{sv.hidden=!(inp.value.trim()&&inp.value.trim()!==r.name)};
  inp.oninput=chk;
  const save=async()=>{const nm=inp.value.trim();if(!nm||nm===r.name||busy)return;busy=true;sv.disabled=true;
    try{await api('svc_site_edit',{code:r.code,name:nm,platform:r.platform,category:r.category});r.name=nm;SC=null;chk();toast('সংরক্ষিত ✔')}catch(e){if(!authFail(e))toast(e.message)}
    busy=false;sv.disabled=false};
  sv.onclick=save;inp.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();save()}};
  c.querySelector('[data-a]').onclick=()=>{const nn=nice(r)||(r.tidy&&r.tidy.name);if(!nn){toast('অটো নাম বানানোর মতো তথ্য নেই');return}inp.value=nn;chk();inp.focus()};
  c.querySelector('[data-e]').onclick=()=>editSheet(r,reload);
  {const pv=c.querySelector('.pvn'),v0=provNameFor(r);if(v0){pv.hidden=false;pv.textContent='প্রভাইডার ('+v0.p+'): '+v0.n}}
  c.querySelector('[data-pn]').onclick=async()=>{const v=await provNameGet(r);if(!v){toast('প্রভাইডারের নাম পাওয়া যায়নি — আগে সিঙ্ক করুন');return}inp.value=v.n;chk();const pv=c.querySelector('.pvn');pv.hidden=false;pv.textContent='প্রভাইডার ('+v.p+'): '+v.n;inp.focus()};
  c.querySelector('[data-h]').onclick=async ev=>{if(busy)return;const on=r.state==='off',b=ev.currentTarget;busy=true;b.disabled=true;
    try{await api('svc_site_hide',{codes:[r.code],on});r.state=on?'on':'off';
      if(!on){c.remove();const n=document.getElementById('kcn'),k=document.querySelectorAll('#kl .krow').length;if(n)n.textContent='সাইটে চালু '+bn(k)+'টি সার্ভিস';
        if(!k&&!document.getElementById('kmb'))document.getElementById('kl').innerHTML='<div class="card empty">এই ক্যাটেগরিতে সাইটে চালু কোনো সার্ভিস নেই</div>';
        toastU('সাইট থেকে সরানো হয়েছে',async()=>{await api('svc_site_hide',{codes:[r.code],on:true});reload()})}
      else toast('চালু হয়েছে')}catch(e){if(!authFail(e))toast(e.message)}b.disabled=false;busy=false};
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
const gmodel=()=>{const m=(ls.get(GM)||'').trim(),a=(ls.get('pb_gem_auto')||'').trim();if(a&&(!m||m===GDEF))return a;return m&&!/^gemini-(1|2)\./.test(m)?m:GDEF};let gh=[],gbusy=false;
const SYS=`তুমি "boostplus সার্ভিস স্টুডিও"-র AI সহকারী। সবসময় বাংলায়, ছোট ও পরিষ্কার উত্তর দাও।
টুল দিয়ে তুমি সাইটের সার্ভিস ও ১০ প্রভাইডারের সার্ভিস খুঁজতে, নাম সাজাতে, চালু-বন্ধ করতে, আর ক্যাটেগরি তালিকা (সংখ্যাসহ) দেখতে, নাম বদলাতে, দুই বা বেশি ক্যাটেগরি এক করতে, সার্ভিস এক ক্যাটেগরি থেকে অন্যটায় সরাতে, ক্যাটেগরি সরাতে (লুকাতে) ও ফিরিয়ে আনতে, ইমুজি বসাতে/তুলতে পারো।
নিয়ম:
১) কোয়ালিটি/ট্যাগ শুধু প্রভাইডারের নিজের নামে যা আছে তা-ই; নিজে কিছু বানাবে না। কিছু না পেলে স্পষ্ট বলো।
২) যেকোনো পরিবর্তনের টুল ব্যবহারকারীর কাছে নিশ্চিতকরণ চায়। তবু টুল ডাকার আগে এক লাইনে বলো কী করছ।
৩) নাম সাজাতে tidy_preview/tidy_apply ব্যবহার করো। ব্যবহারকারী নির্দিষ্ট নাম না বললে set_service দিয়ে নিজে নাম বানিয়ো না।
৪) সাইটের নামের ছাঁচ: "ধরন – কোয়ালিটি · দেশ · ড্রপ · ♻রিফিল · স্পিড · ⚡স্টার্ট · Max", ইমুজিসহ (যেমন 👥 Followers – 💎 HQ Real · 🛡️ NoDrop · ♻30D · 🚀 50K/D · 📈 Max1M)। ক্যাটেগরির নামের আগে প্ল্যাটফর্মের ইমুজি বসে (📸 Instagram Followers)। নতুন ক্যাটেগরি বানাতে create_category, ইমুজি বসাতে emoji_categories, তুলতে strip_emoji_categories ব্যবহার করো।
৫ক) ক্যাটেগরির কাজে ব্যবহারকারীর দেওয়া নাম অস্পষ্ট হলে আগে list_categories দিয়ে হুবহু নাম দেখে নাও। নাম ইমুজি ছাড়াও মিলবে; না মিললে কাছাকাছি নামগুলো দেখিয়ে জিজ্ঞেস করো, অনুমান করে কিছু বদলাবে না। ক্যাটেগরি 'মুছে ফেলা' মানে সাইট থেকে লুকানো (ফেরানো যায়) — তাই ব্যবহারকারীকে সেটা বলো।
৬) দাম ৳ প্রতি ১০০০; প্রভাইডারের রেট USD। ফল তালিকা ছোট রাখো (সর্বোচ্চ ১০টা), বাকিটা কতগুলো আছে বলো।`;
const TOOLS=[{functionDeclarations:[
 {name:'search_site',description:'সাইটে থাকা সার্ভিস খোঁজে। মোট সংখ্যা ও কিছু সার্ভিস ফেরত দেয়।',parameters:{type:'OBJECT',properties:{q:{type:'STRING',description:'নাম/আইডি/ক্যাটেগরির অংশ'},platform:{type:'STRING',description:'যেমন Instagram, Facebook, TikTok'},category:{type:'STRING',description:'হুবহু ক্যাটেগরির নাম'},state:{type:'STRING',description:'on, off বা all (ডিফল্ট on)'},limit:{type:'INTEGER'}}}},
 {name:'search_providers',description:'১০ প্রভাইডারের সব সার্ভিসে খোঁজে, সস্তা আগে (দাম তুলনা)। q কমপক্ষে ২ অক্ষর, যেমন "instagram followers"।',parameters:{type:'OBJECT',properties:{q:{type:'STRING'},refill:{type:'BOOLEAN',description:'শুধু রিফিল আছে এমন'},limit:{type:'INTEGER'}},required:['q']}},
 {name:'list_categories',description:'সাইটের ক্যাটেগরির তালিকা — প্রতিটার মোট সার্ভিস, চালু ও বন্ধ সংখ্যাসহ। platform দিলে শুধু ওটার; q দিলে নামে খোঁজে; only_empty=true দিলে যেগুলোতে কোনো চালু সার্ভিস নেই শুধু সেগুলো।',parameters:{type:'OBJECT',properties:{platform:{type:'STRING'},q:{type:'STRING'},only_empty:{type:'BOOLEAN'}}}},
 {name:'tidy_preview',description:'নাম সাজালে কতগুলো বদলাবে ও নমুনা দেখায় (কিছু বদলায় না)। category/q দিয়ে সীমিত করা যায়।',parameters:{type:'OBJECT',properties:{category:{type:'STRING'},q:{type:'STRING'},platform:{type:'STRING'}}}},
 {name:'tidy_apply',description:'সাইটের চালু সার্ভিসের নাম সাইটের ছাঁচে সাজায় (নিশ্চিতকরণ চায়)। category/q/platform দিয়ে সীমিত করা যায়।',parameters:{type:'OBJECT',properties:{category:{type:'STRING'},q:{type:'STRING'},platform:{type:'STRING'}}}},
 {name:'set_service',description:'একটা সার্ভিসের নাম বা ক্যাটেগরি বদলায় (নিশ্চিতকরণ চায়)।',parameters:{type:'OBJECT',properties:{code:{type:'STRING'},name:{type:'STRING'},category:{type:'STRING'}},required:['code']}},
 {name:'set_visibility',description:'সার্ভিস সাইটে চালু (on=true) বা বন্ধ/লুকানো (on=false) করে (নিশ্চিতকরণ চায়)।',parameters:{type:'OBJECT',properties:{codes:{type:'ARRAY',items:{type:'STRING'}},on:{type:'BOOLEAN'}},required:['codes','on']}},
 {name:'rename_category',description:'একটা ক্যাটেগরির সব সার্ভিসের ক্যাটেগরির নাম বদলায় (নিশ্চিতকরণ চায়)।',parameters:{type:'OBJECT',properties:{old:{type:'STRING'},new:{type:'STRING'}},required:['old','new']}},
 {name:'create_category',description:'নতুন ক্যাটেগরি বানায়: আইডি দিয়ে দেওয়া সার্ভিসগুলো ওই নামের ক্যাটেগরিতে নেয় (নিশ্চিতকরণ চায়)। সার্ভিস ছাড়া ক্যাটেগরি হয় না।',parameters:{type:'OBJECT',properties:{name:{type:'STRING',description:'নতুন ক্যাটেগরির নাম'},codes:{type:'ARRAY',items:{type:'STRING'},description:'সার্ভিসের আইডি'},platform:{type:'STRING',description:'ঐচ্ছিক: instagram, facebook, tiktok, youtube, telegram, twitter, whatsapp'}},required:['name','codes']}},
 {name:'emoji_categories',description:'ক্যাটেগরির নামের আগে প্ল্যাটফর্মের ইমুজি বসায় — category দিলে শুধু ওটা, না দিলে সব (নিশ্চিতকরণ চায়)।',parameters:{type:'OBJECT',properties:{category:{type:'STRING'}}}},
 {name:'delete_category',description:'একটা ক্যাটেগরির সব চালু সার্ভিস সাইট থেকে সরায়/লুকায় (নিশ্চিতকরণ চায়, restore_category দিয়ে ফেরানো যায়)।',parameters:{type:'OBJECT',properties:{category:{type:'STRING'}},required:['category']}},
 {name:'restore_category',description:'লুকানো/সরানো ক্যাটেগরির সব সার্ভিস আবার সাইটে চালু করে (নিশ্চিতকরণ চায়)।',parameters:{type:'OBJECT',properties:{category:{type:'STRING'}},required:['category']}},
 {name:'merge_categories',description:'এক বা একাধিক ক্যাটেগরির (from) সব সার্ভিস অন্য একটা ক্যাটেগরিতে (into) নিয়ে এক করে (নিশ্চিতকরণ চায়)। into নতুন নামও হতে পারে।',parameters:{type:'OBJECT',properties:{from:{type:'ARRAY',items:{type:'STRING'},description:'যেসব ক্যাটেগরি মিশবে'},into:{type:'STRING',description:'গন্তব্য ক্যাটেগরি'}},required:['from','into']}},
 {name:'move_services',description:'নির্দিষ্ট সার্ভিস আইডিগুলো একটা ক্যাটেগরিতে সরায়, নাম অপরিবর্তিত (নিশ্চিতকরণ চায়)। category নতুন নামও হতে পারে।',parameters:{type:'OBJECT',properties:{codes:{type:'ARRAY',items:{type:'STRING'}},category:{type:'STRING'}},required:['codes','category']}},
 {name:'strip_emoji_categories',description:'ক্যাটেগরির নামের আগের ইমুজি তুলে ফেলে — category দিলে শুধু ওটা, না দিলে সব (নিশ্চিতকরণ চায়)।',parameters:{type:'OBJECT',properties:{category:{type:'STRING'}}}}
]}];
const LBL={search_site:'🔎 সাইটে খুঁজছি…',search_providers:'🔎 ১০ প্রভাইডারে খুঁজছি…',list_categories:'🗂 ক্যাটেগরি দেখছি…',tidy_preview:'🧹 নাম পরীক্ষা করছি…',tidy_apply:'🧹 নাম সাজাচ্ছি…',set_service:'✎ সার্ভিস বদলাচ্ছি…',set_visibility:'👁 চালু/বন্ধ করছি…',rename_category:'✎ ক্যাটেগরির নাম বদলাচ্ছি…',delete_category:'🗑 ক্যাটেগরি সরাচ্ছি…',create_category:'➕ ক্যাটেগরি বানাচ্ছি…',emoji_categories:'✨ ইমুজি বসাচ্ছি…',restore_category:'↩ ক্যাটেগরি ফেরাচ্ছি…',merge_categories:'🔗 ক্যাটেগরি এক করছি…',move_services:'➡ সার্ভিস সরাচ্ছি…',strip_emoji_categories:'🧽 ইমুজি তুলছি…'};
const glim=n=>Math.max(1,Math.min(+n||12,30)),gref=()=>{SC=null;const h=location.hash;if(h==='#mng')mload();else if(h==='#cats'||h.indexOf('#cat=')===0)route()};
const gslim=r=>({code:r.code,name:r.name,category:r.category,platform:r.platform_label,cost_usd:r.cost,min:r.min,max:r.max,state:r.state});
async function scanSite(f){const R=[];let off=0,tot=1;while(off<tot){const d=await api('svc_site_list',{q:f.q||'',platform:f.platform||'',category:f.category||'',state:f.state||'on',offset:off,limit:100});tot=d.total;if(!d.rows.length)break;R.push(...d.rows);off+=d.rows.length}return R}
async function tidyItems(f){const rows=await scanSite(f||{}),it=[];rows.forEach(r=>{const nm=nice(r);if(nm&&nm!==r.name)it.push({code:r.code,cn:r.name,nn:nm,category:r.category,src:r.src,ov:r.ov})});return{n:rows.length,it}}
async function tidyDo(it){const need=it.filter(r=>r.src==='static'&&!r.ov).map(r=>r.code);for(const c of chunks(need,200))await api('svc_site_bulk',{codes:c});
  let done=0;for(const c of chunks(it.map(r=>({code:r.code,name:r.nn,cat:r.category})),300)){const x=await api('svc_tidy_apply',{items:c});done+=x.done}return done}
/* ক্যাটেগরির নাম মেলানো: হুবহু → ইমুজি/বড়-ছোট হাত ছাড়া → একমাত্র অংশ-মিল; না মিললে কাছাকাছি নাম দেখায় */
async function resolveCat(name,soft){const nm=String(name||'').trim();if(!nm)return{error:'ক্যাটেগরির নাম দিন'};
  const rows=await siteRows(),names=[...new Set(rows.map(r=>r.category).filter(Boolean))];
  if(names.indexOf(nm)>=0)return{name:nm,exists:true};
  const k=stripEmo(nm).toLowerCase(),eq=names.filter(c=>stripEmo(c).toLowerCase()===k);
  if(eq.length===1)return{name:eq[0],exists:true};
  if(eq.length>1)return{error:'একই নামের একাধিক ক্যাটেগরি আছে (ইমুজি আলাদা): '+eq.slice(0,6).join(' | ')+' — হুবহু কোনটা বলুন'};
  if(soft)return{name:nm,exists:false};
  const part=k?names.filter(c=>stripEmo(c).toLowerCase().indexOf(k)>=0):[];
  if(part.length===1)return{name:part[0],exists:true};
  return{error:'"'+nm+'" নামে ক্যাটেগরি পাওয়া যায়নি'+(part.length?' — কাছাকাছি: '+part.slice(0,6).join(' | '):'')}}
async function catSummary(a){const rows=await siteRows(),pl=String(a.platform||'').trim().toLowerCase(),q=String(a.q||'').trim().toLowerCase(),G={};
  rows.forEach(r=>{if(!r.category)return;if(pl&&String(r.platform_label||'').toLowerCase()!==pl)return;const g=G[r.category]||(G[r.category]={name:r.category,platform:r.platform_label||'',services:0,on:0,off:0});g.services++;if(r.state==='off')g.off++;else g.on++});
  let L=Object.values(G).filter(c=>!q||c.name.toLowerCase().indexOf(q)>=0);if(a.only_empty)L=L.filter(c=>c.on===0);
  L.sort((x,y)=>x.name.localeCompare(y.name));return{total:L.length,list:L}}
async function catRenameCore(cat,nn){nn=String(nn||'').trim();if(!cat||!nn||nn===cat)return{error:'নাম ঠিক নয়'};if(nn.length>80)return{error:'নাম ৮০ অক্ষরের বেশি'};
  const codes=await catCodes(cat,'all');if(!codes.length)return{error:'এই ক্যাটেগরিতে কিছু নেই'};
  const ex=(await siteRows()).some(r=>r.category===nn);
  if(!confirm('"'+cat+'" ক্যাটেগরির '+bn(codes.length)+'টি সার্ভিসের ক্যাটেগরি বদলে "'+nn+'" হবে।'+(ex?'\n(এই নামে আগে থেকেই ক্যাটেগরি আছে — দুটো মিশে এক হয়ে যাবে)':'')+'\n\nচালিয়ে যাবেন?'))return{cancelled:true};
  let done=0;for(const c of chunks(codes,200)){const r=await api('svc_site_bulk',{codes:c,category:nn});done+=r.done}gref();return{done}}
async function catDeleteCore(cat){const codes=await catCodes(cat,'on');if(!codes.length)return{error:'এই নামে চালু সার্ভিস নেই'};
  if(!confirm('"'+cat+'" ক্যাটেগরির চালু '+bn(codes.length)+'টি সার্ভিস সাইট থেকে সরানো হবে (পরে প্রভাইডার/প্ল্যাটফর্ম পাতা থেকে আবার যোগ করা যাবে, অথবা AI-কে ক্যাটেগরি ফেরাতে বলুন)। নিশ্চিত?'))return{cancelled:true};
  let done=0;for(const c of chunks(codes,200)){const r=await api('svc_site_hide',{codes:c,on:false,del:true});done+=r.done}gref();return{done}}
const TOOLFN={
 async search_site(a){const d=await api('svc_site_list',{q:a.q||'',platform:a.platform||'',category:a.category||'',state:a.state||'on',offset:0,limit:glim(a.limit)});return{total:d.total,rows:d.rows.map(gslim),categories_in_result:d.categories.slice(0,40)}},
 async search_providers(a){const d=await api('svc_compare',{q:a.q||'',refill:!!a.refill});return{total:d.total,rows:d.rows.slice(0,glim(a.limit)).map(r=>({provider:r.provider,id:r.service_id,name:r.name,category:r.category,rate_usd_per_1k:r.rate,min:r.min,max:r.max,refill:r.refill==='1',on_site:r.state==='on',avg_time_sec:r.spd?Math.round(r.spd.m):null}))}},
 async list_categories(a){const s=await catSummary(a),d=await api('svc_site_list',{q:'',platform:'',category:'',state:'on',offset:0,limit:1});return{categories_total:s.total,showing:Math.min(s.total,100),categories:s.list.slice(0,100),platforms:d.platforms}},
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
 async rename_category(a){const r=await resolveCat(a.old);if(r.error)return r;return catRenameCore(r.name,a.new)},
 async create_category(a){const name=String(a.name||'').trim(),codes=(a.codes||[]).map(String).slice(0,400);if(!name||name.length>80)return{error:'ক্যাটেগরির নাম ঠিক নয় (১–৮০ অক্ষর)'};if(!codes.length)return{error:'কোনো সার্ভিস আইডি নেই'};
  const pl=PLAT.slice(0,7).some(p=>p[0]===String(a.platform||'').toLowerCase())?String(a.platform).toLowerCase():'';
  if(!confirm('নতুন ক্যাটেগরি: "'+name+'"\n'+bn(codes.length)+'টি সার্ভিস এতে আসবে। আইডি: '+codes.slice(0,8).join(', ')+(codes.length>8?'…':'')+'\nচালিয়ে যাবেন?'))return{cancelled:true};
  let done=0;for(const c of chunks(codes,200)){const r=await api('svc_site_bulk',Object.assign({codes:c,category:name},pl?{platform:pl}:{}));done+=r.done}gref();return{done,category:name}},
 async emoji_categories(a){const rows=await siteRows(true),names=a.category?[String(a.category)]:rows.map(r=>r.category),pairs=emojiPairs(names);if(!pairs.length)return{message:'বদলানোর কিছু নেই — আগেই ইমুজি আছে বা ক্যাটেগরি পাওয়া যায়নি'};
  if(!confirm(bn(pairs.length)+'টি ক্যাটেগরির নাম বদলাবে। যেমন:\n'+pairs.slice(0,4).map(p=>p[0]+'\n→ '+p[1]).join('\n\n')+'\n\nচালিয়ে যাবেন?'))return{cancelled:true};
  const done=await catsEmojiDo(pairs);gref();return{renamed:pairs.length,services:done}},
 async delete_category(a){const r=await resolveCat(a.category);if(r.error)return r;return catDeleteCore(r.name)},
 async restore_category(a){const r=await resolveCat(a.category);if(r.error)return r;const codes=await catCodes(r.name,'off');if(!codes.length)return{error:'এই ক্যাটেগরিতে বন্ধ/লুকানো সার্ভিস নেই'};
  if(!confirm('"'+r.name+'" ক্যাটেগরির '+bn(codes.length)+'টি বন্ধ সার্ভিস আবার সাইটে চালু হবে। চালিয়ে যাবেন?'))return{cancelled:true};
  let done=0,blocked=0;for(const c of chunks(codes,200)){const x=await api('svc_site_hide',{codes:c,on:true});done+=x.done;blocked+=x.blocked||0}gref();return{done,blocked_provider_off:blocked}},
 async merge_categories(a){const into=await resolveCat(a.into,true);if(into.error)return into;const src=[];
  for(const f of (a.from||[]).slice(0,12)){const r=await resolveCat(f);if(r.error)return r;if(r.name!==into.name&&src.indexOf(r.name)<0)src.push(r.name)}
  if(!src.length)return{error:'এক করার মতো আলাদা ক্যাটেগরি নেই'};const plan=[];let tot=0;
  for(const s of src){const codes=await catCodes(s,'all');plan.push([s,codes]);tot+=codes.length}
  if(!tot)return{error:'ওই ক্যাটেগরিগুলোতে কোনো সার্ভিস নেই'};
  if(!confirm(bn(tot)+'টি সার্ভিস নিয়ে এক হবে → "'+into.name+'"'+(into.exists?'':' (নতুন ক্যাটেগরি)')+'\n\n'+plan.map(p=>'• '+p[0]+' ('+bn(p[1].length)+')').join('\n')+'\n\nচালিয়ে যাবেন?'))return{cancelled:true};
  let done=0;for(const p of plan)for(const c of chunks(p[1],200)){const x=await api('svc_site_bulk',{codes:c,category:into.name});done+=x.done}gref();return{moved:done,into:into.name,merged_from:src}},
 async move_services(a){const codes=(a.codes||[]).map(String).slice(0,400);if(!codes.length)return{error:'কোনো সার্ভিস আইডি নেই'};const r=await resolveCat(a.category,true);if(r.error)return r;
  if(!confirm(bn(codes.length)+'টি সার্ভিস "'+r.name+'" ক্যাটেগরিতে যাবে'+(r.exists?'':' (নতুন ক্যাটেগরি)')+'। আইডি: '+codes.slice(0,8).join(', ')+(codes.length>8?'…':'')+'\nচালিয়ে যাবেন?'))return{cancelled:true};
  let done=0;for(const c of chunks(codes,200)){const x=await api('svc_site_bulk',{codes:c,category:r.name});done+=x.done}gref();return{done,category:r.name}},
 async strip_emoji_categories(a){let names;if(a.category){const r=await resolveCat(a.category);if(r.error)return r;names=[r.name]}else names=(await siteRows()).map(x=>x.category);
  const pairs=[...new Set(names)].filter(Boolean).map(c=>[c,stripEmo(c)]).filter(p=>p[1]&&p[1]!==p[0]);
  if(!pairs.length)return{message:'তোলার মতো ইমুজি নেই'};
  if(!confirm(bn(pairs.length)+'টি ক্যাটেগরির নাম থেকে ইমুজি উঠবে। যেমন:\n'+pairs.slice(0,4).map(p=>p[0]+'\n→ '+p[1]).join('\n\n')+'\n\nচালিয়ে যাবেন?'))return{cancelled:true};
  const done=await catsEmojiDo(pairs);gref();return{renamed:pairs.length,services:done}}};
const gmd=t=>esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>');
function addMsg(k,t){const b=$('#aiMsgs');if(!b)return null;const d=document.createElement('div');d.className='am '+k;if(k==='ai')d.innerHTML=gmd(t);else d.textContent=t;b.appendChild(d);b.scrollTop=b.scrollHeight;return d}
const GURL='https://generativelanguage.googleapis.com/v1beta/';
async function gdirect(key,model,body){const r=await fetch(GURL+'models/'+encodeURIComponent(model)+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));return{r,d}}
/* মডেল না পেলে: key-র জন্য চালু থাকা সবচেয়ে নতুন flash মডেল খুঁজে বের করে */
async function gfindModel(key){try{const r=await fetch(GURL+'models?pageSize=200',{headers:{'x-goog-api-key':key}});if(!r.ok)return null;const d=await r.json(),L=(d.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>String(m.name||'').replace(/^models\//,''));
  const ver=n=>{const m=n.match(/^gemini-(\d+(?:\.\d+)?)/);return m?parseFloat(m[1]):0};
  let c=L.filter(n=>/^gemini-\d+(\.\d+)?-flash$/.test(n));if(!c.length)c=L.filter(n=>/^gemini-\d/.test(n)&&/flash/.test(n)&&!/image|tts|live|audio|embed|lite|thinking|robotics|computer/.test(n));
  c.sort((a,b)=>ver(b)-ver(a));return c[0]||null}catch(_){return null}}
async function gcall(){const key=ls.get(GK),model=gmodel(),body={systemInstruction:{parts:[{text:SYS}]},contents:gh,tools:TOOLS,generationConfig:{temperature:.3}};let derr=null;
  /* ১) নিজের AIza… key থাকলে সরাসরি Google-এ (মডেল না থাকলে নিজে খুঁজে নেয়); ব্যর্থ হলে ২) Apps Script প্রক্সি — প্রক্সি না থাকলে Google-এর আসল এরর দেখায় */
  if(key){
    try{let x=await gdirect(key,model,body);
      if(x.r.status===404){const alt=await gfindModel(key);if(alt&&alt!==model){const y=await gdirect(key,alt,body);if(y.r.ok){ls.set('pb_gem_auto',alt);return y.d}x=y}}
      if(x.r.ok)return x.d;
      const e=new Error((x.d.error&&x.d.error.message)||('HTTP '+x.r.status));e.status=x.r.status;
      if([400,401,403,404].indexOf(x.r.status)<0)throw e;derr=e}
    catch(e){if(e&&e.status)throw e;derr=e}}
  try{const p=await api('svc_ai',Object.assign({model,body},key&&/^AQ\./.test(key)?{key}:{}));
    if(p.status!==200){const e=new Error((p.data&&p.data.error&&p.data.error.message)||('HTTP '+p.status));e.status=p.status;throw e}return p.data}
  catch(se){if(se&&se.code==='unknown_action'){if(derr&&derr.status)throw derr;if(derr)se.direct=String(derr.message||derr)}throw se}}
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
const gerr=e=>e.code==='unknown_action'?'Apps Script-এ নতুন PtServices.gs বসিয়ে আবার Deploy → New version দিন (svc_ai অ্যাকশন নেই)'+(e.direct?' [সরাসরি Google-এও যায়নি: '+e.direct.slice(0,90)+']':'')
  :e.code==='no_key'?'কোনো Gemini key নেই — ⚙ থেকে নিজের key দিন, অথবা Apps Script → Project Settings → Script properties-এ GEMINI_API_KEY বসান'
  :e.code==='bad_model'?'মডেলের নাম ঠিক নয় — ⚙ থেকে দেখুন'
  :e.code==='svc_failed'?'সার্ভার থেকে Google-এ যেতে সমস্যা: '+String(e.message||'').slice(0,120):e.status===429?'ফ্রি কোটা শেষ বা অনেক দ্রুত পাঠানো হয়েছে — একটু পরে চেষ্টা করুন':e.status===400&&/key/i.test(e.message)||e.status===403||e.status===401?'API key ঠিক নয় বা অনুমতি নেই — ⚙ থেকে দেখুন ('+String(e.message||'').slice(0,160)+')':e.status===404?'মডেল পাওয়া যায়নি ও নিজে থেকে খুঁজেও মেলেনি — ⚙ থেকে মডেলের নাম বদলে দেখুন ('+String(e.message||'').slice(0,140)+')':e.name==='TypeError'?'ইন্টারনেট/নেটওয়ার্ক সমস্যা':e.message;
function aiStatus(){const k=ls.get(GK);$('#aiSt').textContent=k?(ls.get(GOK)?'● সংযুক্ত':'● key আছে'):(ls.get(GOK)?'● সার্ভার key':'○ সার্ভার key');$('#aiSt').className='sub'+(k&&ls.get(GOK)?' ok':'')}
function aiInit(){if($('#aiFab'))return;
  document.body.insertAdjacentHTML('beforeend',`<button id="aiFab" class="aifab" popover="manual" aria-label="AI সহকারী — টেনে সরানো যায়" title="AI সহকারী (টেনে সরান)" hidden>${ROBOT}</button><section id="ai" class="aipanel" popover="manual" role="dialog" aria-label="AI সহকারী" hidden><header><b class="aiti">${ROBOT.replace('width="30" height="30"','width="22" height="22"')} AI সহকারী</b><span id="aiSt" class="sub"></span><span class="aihs"><button class="ib" id="aiSet" aria-label="সেটিং">⚙</button><button class="ib" id="aiNew" aria-label="নতুন চ্যাট" title="নতুন চ্যাট">↺</button><button class="ib" id="aiX" aria-label="বন্ধ">✕</button></span></header>
<div id="aiKey" class="aikey" hidden><label for="aiK">Gemini API key</label><input id="aiK" type="password" autocomplete="off" placeholder="AIza…"><label for="aiM">মডেল</label><input id="aiM" autocomplete="off"><p class="sub">key শুধু এই ফোনের ব্রাউজারে থাকে। Google AI Studio-তে key-তে সীমা (restriction) বেঁধে রাখুন। (অ্যাপ সংস্করণ v97)</p><p class="err" id="aiKe" role="alert"></p><div class="acts"><button class="sm" id="aiDel" type="button">key মুছুন</button><button class="btn" id="aiSave" type="button">সংরক্ষণ ও পরীক্ষা</button></div></div>
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
  const hello=()=>{addMsg('ai','আমি সাইটের সার্ভিস খুঁজতে, নাম সাজাতে, চালু-বন্ধ করতে পারি। ক্যাটেগরির নাম বদলানো, এক করা, সার্ভিস সরানো, সরানো/ফেরানো — সবই এখান থেকে বললেই হবে। কী করাতে চান?');
    $('#aiChips').innerHTML=['ফেসবুকের ক্যাটেগরিগুলো সংখ্যাসহ দেখাও','যেসব ক্যাটেগরিতে কোনো চালু সার্ভিস নেই সেগুলো দেখাও','একটা ক্যাটেগরির নাম বদলাব','দুটো ক্যাটেগরি এক করব','একটা ক্যাটেগরি সরাব বা ফেরাব','TikTok Followers-এর সবচেয়ে সস্তা ৫টা (সব প্রভাইডার)','কতগুলো সার্ভিসের নাম সাজানো বাকি?','Instagram Followers-এর নাম সাজাও'].map(x=>`<button class="chip" type="button">${esc(x)}</button>`).join('');
    $('#aiChips').querySelectorAll('.chip').forEach(b=>b.onclick=()=>send(b.textContent))};
  hello();aiStatus();window._aiClose=close}
/* AI সহকারী: লগইনের পর সব পাতার ওপরে ভাসমান বাটন; লগআউটে লুকায় */
function aiShow(a){
  if(!a){['#aiFab','#ai'].forEach(q=>{const e=$(q);if(e)e.hidden=true});return}
  try{aiInit()}catch(e){console.error(e);return}
  const F=$('#aiFab'),P=$('#ai');if(!F||!P)return;
  F.hidden=!P.hidden;try{topLayer(F)}catch(e){}}

/* ---------- রাউটার, লগইন, ইনস্টল ---------- */
function exc(){cur=null;$('#title').textContent='ব্যতিক্রম';$('#back').hidden=true;const el=$('#main'),I=EXC.items,G=[['new','🆕 নতুন সার্ভিস'],['gone','⚠ প্রভাইডার থেকে চলে গেছে (সাইটে চালু ছিল)'],['price','💲 দাম বদলেছে (৫%+)']];
  el.innerHTML=nav('exc')+`<div class="bar"><button class="btn" id="xs" style="max-width:220px">⟳ এখনই সিঙ্ক</button>${I.length?'<button class="chip" id="xd">সব দেখেছি</button>':''}</div><p class="sub">সিঙ্কের সময় আগের ক্যাটালগের সাথে মিলিয়ে দেখানো হয়। বাকি সব আপনার না দেখলেও চলে।${CAT?'':' (প্রথম সিঙ্ক এখনো হয়নি)'}</p>`+(I.length?G.map(g=>{const l=I.filter(x=>x.t===g[0]);return l.length?`<h3>${g[1]} · ${bn(l.length)}</h3><div class="list">`+l.slice(0,60).map(x=>`<a class="card" href="#mng" data-c="${esc(x.code)}" style="display:block;text-decoration:none;color:inherit"><b>${esc(x.name)}</b><div class="sub">${esc(x.pl)} · #${esc(x.code)}${x.t==='price'?` · ${bn(x.a)} → ${bn(x.b)} `:''}</div></a>`).join('')+'</div>':''}).join(''):'<p class="mut">এখন কোনো ব্যতিক্রম নেই ✔</p>');
  el.querySelectorAll('[data-c]').forEach(a=>a.onclick=()=>{ms.q=a.dataset.c;ms.state='on';ms.plat='';ms.cat=''});
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
const pName=it=>{if(!it._n){let n=it.on&&PSITE[it.code]&&PSITE[it.code].name;if(!n){it._n=String(it.r.name||'').replace(/\s+/g,' ').trim();return it._n}n=stripEmo(n||it.r.name).replace(/\s*[✪◆◇✦✧★☆➤➢▶►❖✱✯✰|—–]+\s*/g,' · ').replace(/(\s·)+\s*$/,'');const em=pEmo(it);if(em&&!n.includes(em.slice(0,2))){const m=n.match(/react\w*/i);n=m?n.slice(0,m.index+m[0].length)+' '+em+n.slice(m.index+m[0].length):n+' '+em}it._n=n}return it._n};
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
    c.textAlign='left';const tx=cx+rad+22,tw=CW-(tx-X)-250,fs0=ch>=110?33:30;c.fillStyle=dk?'#fff':'#111827';let fs=fs0,ln;for(;;){c.font='600 '+fs+'px '+F;ln=pWrap(c,r.name,tw,99);if(ln.length*fs*1.2<=ch-14||fs<=18)break;fs-=2}if(ln.length*fs*1.2>ch-14)ln=pWrap(c,r.name,tw,Math.max(1,Math.floor((ch-14)/(fs*1.2))));const sub=ch>=96&&ln.length<2,lh=fs*1.2,top=cy-((ln.length+(sub?.75:0))*lh)/2+fs*.88;
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
  <div class="card"><b>🎨 ডিজাইন</b><div class="chips" style="margin:10px 0 6px">${PTH.map((t,i)=>`<button class="chip pth" data-th="${i}" aria-pressed="${PS.th===i}" style="--g:linear-gradient(135deg,${t[1]},${t[2]},${t[3]})">${t[0]}</button>`).join('')}</div><div class="chips">${PSZ.map((z,i)=>`<button class="chip" data-sz="${i}" aria-pressed="${PS.sz===i}">${z[0]}</button>`).join('')}</div>
  <label for="pB">ব্র্যান্ড</label><input id="pB" maxlength="30" value="${esc(PS.brand)}"><label for="pH">শিরোনাম</label><input id="pH" maxlength="40" value="${esc(PS.head)}"><label for="pT">ট্যাগলাইন</label><input id="pT" maxlength="60" value="${esc(PS.tag)}"><label for="pC">বোতামের লেখা</label><input id="pC" maxlength="30" value="${esc(PS.cta)}"><label for="pN">যোগাযোগ (WhatsApp / টেলিগ্রাম / সাইট)</label><input id="pN" maxlength="60" value="${esc(PS.con)}" placeholder="যেমন: WhatsApp 01XXXXXXXXX"></div>
  <div class="card"><b>📋 সার্ভিস বাছুন</b> <span class="sub" id="pCnt"></span><p class="sub">${prv?'সব প্রভাইডারের সব সার্ভিস থেকে বাছা যায়।':'প্রভাইডার ডেটা লোড হয়নি — এখন শুধু সাইটের চালু সার্ভিস দেখাচ্ছে।'} দাম সাইটের হিসাবে বসে (খরচ ×৳131 + স্ল্যাব মার্কআপ), কাস্টম দাম থাকলে সেটাই। পোস্টারে সবসময় দাম কম→বেশি সাজানো থাকে।</p>
  <div class="bar" style="margin-top:6px"><select id="pP" aria-label="প্ল্যাটফর্ম"><option value="">সব প্ল্যাটফর্ম (${bn(all.length)})</option>${pls.map(l=>`<option value="${esc(l)}" ${l===PS.plat?'selected':''}>${esc(l)} (${bn(pc[l])})</option>`).join('')}</select><input id="pQ" type="search" placeholder="নাম / ID খুঁজুন" value="${esc(PS.q)}" aria-label="খুঁজুন"></div>
  ${prv?'<div class="sub" style="margin-top:10px">প্রভাইডার (একাধিক বাছা যায়)</div><div class="chips" id="pPv"></div>':''}<div class="sub" style="margin-top:6px">সার্ভিসের ধরন (একাধিক বাছা যায়)</div><div class="chips" id="pTy"></div>${prv?'<div class="chips" id="pSt"></div>':''}
  <div class="sub" style="margin-top:8px">দাম দিয়ে খুঁজুন (প্রতি ১০০০, ৳)</div><div class="bar"><input id="pLo" type="text" inputmode="decimal" placeholder="সর্বনিম্ন" value="${esc(PS.lo)}" aria-label="সর্বনিম্ন দাম"><input id="pHi" type="text" inputmode="decimal" placeholder="সর্বোচ্চ" value="${esc(PS.hi)}" aria-label="সর্বোচ্চ দাম"></div>
  <div class="chips" style="margin-top:8px"><button class="chip" id="pSo" aria-pressed="false"></button></div>
  <div class="sub" style="margin-top:10px">💾 সেভ করা সেট (এক ট্যাপে আবার বাছা)</div><div class="chips" id="pPr"></div><div class="acts"><button class="sm" id="pSv">💾 বর্তমান বাছাই সেভ করুন</button></div><div class="acts"><button class="sm" id="pTop"></button><button class="sm" id="pAu">✦ অটো বাছাই</button><button class="sm" id="pCl">সব মুছুন</button></div><p class="sub" id="pTot"></p><div id="pL"></div></div>`;
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
  /* ৪.১ সেভ করা সেট (প্রিসেট): বাছা সার্ভিস + ডিজাইন + সাইজ */
  const PRK='pb_poster_presets',prl=()=>{try{const a=JSON.parse(ls.get(PRK)||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}},prs=a=>ls.set(PRK,JSON.stringify(a.slice(0,12)));
  const prd=()=>{const a=prl();$('#pPr').innerHTML=a.length?a.map((x,i)=>`<span class="prp"><button type="button" class="chip" data-pl="${i}">${esc(x.n)} · ${bn(x.k.length)}</button><button type="button" class="chip" data-pd="${i}" aria-label="${esc(x.n)} মুছুন">✕</button></span>`).join(''):'<span class="sub">এখনো কোনো সেট নেই। সার্ভিস বেছে "সেভ করুন" চাপুন।</span>'};prd();
  $('#pSv').onclick=()=>{if(!PSEL.size){toast('আগে কিছু সার্ভিস বাছুন');return}const n=(prompt('সেটের নাম দিন (যেমন: Facebook সেরা)','')||'').trim().slice(0,24);if(!n)return;const a=prl().filter(x=>x.n!==n);a.unshift({n,k:[...PSEL],th:PS.th,sz:PS.sz});prs(a);prd();toast('সেট সেভ হয়েছে ✔')};
  $('#pPr').onclick=e=>{const l=e.target.closest('[data-pl]'),d=e.target.closest('[data-pd]'),a=prl();if(d){const x=a[+d.dataset.pd];if(x&&confirm('"'+x.n+'" সেটটি মুছবেন?')){a.splice(+d.dataset.pd,1);prs(a);prd()}return}
    if(l){const x=a[+l.dataset.pl];if(!x)return;const have=new Set(pItems().map(it=>it.key)),ok=x.k.filter(k=>have.has(k));if(!ok.length){toast('এই সেটের সার্ভিসগুলো এখন নেই');return}PSEL.clear();ok.forEach(k=>PSEL.add(k));PS.th=x.th|0;let z=x.sz|0;while(z<PSZ.length-1&&PSZ[z][3]<ok.length)z++;PS.sz=z;sv();poster();toast('সেট লোড হয়েছে'+(ok.length<x.k.length?' ('+bn(x.k.length-ok.length)+'টি এখন নেই)':'')+' ✔')}};
  const blob=async()=>{await pDraw();return new Promise(r=>$('#pcv').toBlob(r,'image/png'))},dl=b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='poster-'+Date.now()+'.png';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)};
  $('#pDl').onclick=async()=>{dl(await blob());toast('ছবি ডাউনলোড হয়েছে ✔')};
  $('#pCp').onclick=async()=>{try{await navigator.clipboard.writeText(pCap());toast('ক্যাপশন কপি হয়েছে ✔')}catch(e){toast('কপি করা যায়নি')}};
  $('#pSh').onclick=async()=>{const b=await blob(),f=new File([b],'poster.png',{type:'image/png'});if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],text:pCap(),title:PS.brand});return}catch(e){if(e&&e.name==='AbortError')return}}dl(b);toast('সরাসরি শেয়ার নেই — ছবি ডাউনলোড হয়েছে, গ্যালারি থেকে শেয়ার করুন')};
  chips();list();pDraw()}
/* ---------- v75: সেরা সার্ভিস · সরাসরি টেস্ট অর্ডার · স্পিড বিস্তারিত ---------- */
const mnT=s=>!(s>0)?'—':s<60?'১ মিনিটের কম':s<5400?bn(Math.round(s/60))+' মিনিট':s<172800?bn(Math.round(s/360)/10)+' ঘণ্টা':bn(Math.round(s/8640)/10)+' দিন';
const dT=ms=>ms?new Date(ms).toLocaleString('bn-BD',{timeZone:'Asia/Dhaka',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):'—';
const kTk=r=>'৳'+bn(Math.round((+r.cost_bdt_k||0)*100)/100)+' / ১০০০';
let BS={label:'',type:'',q:'',refill:false,untested:false,fx:131},bcn=0,SP={st:'all',prov:'',cat:'',rcat:'',late:false,tb:0,so:'new',q:''},spTm=null,spTk=null;
/* স্পিড পাতার ট্যাব/প্রভাইডার/ক্যাটাগরি/সময়/সাজানো ফোনে মনে রাখা (সার্চ বাদে) */
const SPK_V='pb_sp_view_v1';
(function(){try{const v=JSON.parse(ls.get(SPK_V)||'null');if(v&&typeof v==='object'){if(['all','run','done','can','note'].includes(v.st))SP.st=v.st;if(typeof v.prov==='string')SP.prov=v.prov;if(typeof v.cat==='string')SP.cat=v.cat;if(DF_TB_OK(v.tb))SP.tb=v.tb;if(['fast','slow','new'].includes(v.so))SP.so=v.so}}catch(_){}})();
function DF_TB_OK(t){return [0,600,1800,3600,21600,86400,-1].includes(t)}
const spSaveView=()=>ls.set(SPK_V,JSON.stringify({st:SP.st,prov:SP.prov,cat:SP.cat,tb:SP.tb,so:SP.so}));
const bcard=(r,i)=>{const s=r.stats,
  sp=s?`<div class="bm g">⏱ শুরু ~${mnT(s.start_med)} · মোট ~${mnT(s.total_med)} · ড্রপ ${bn(s.bad)}% · টেস্ট ${bn(s.n)}টি${s.open?' ('+bn(s.open)+'টি চলছে)':''}</div>`:'<div class="bm sub">অপরীক্ষিত — 🧪 টেস্ট অর্ডার দিয়ে স্পিড মাপুন</div>',
  stt=r.state==='on'?'<span class="tag">সাইটে চালু</span>':r.state==='conflict'?'<span class="tag">সাইটে অন্য প্রভাইডারে</span>':'';
  return `<div class="card bcd"><div class="bsh"><b>#${bn(i+1)}</b><span class="tag">স্কোর ${bn(r.score)}</span>${r.tested?'<span class="tag">টেস্টেড ✓</span>':r.try_it?'<span class="tag tst mid">🧪 টেস্ট করার মতো</span>':''}${+r.refill?'<span class="tag">♻ রিফিল</span>':''}${stt}</div><b class="bnm">${esc(r.name)}</b><div class="sub">${esc(r.provider)} · আইডি ${esc(r.service_id)} · ${bn(r.min)}–${bn(r.max)}</div><div class="bm">${kTk(r)} <span class="sub">(গ্রুপের ${bn(r.price_pct)}% এর চেয়ে সস্তা)</span></div>${sp}<div class="acts"><button type="button" class="sm" data-a="o" data-i="${i}">🧪 অর্ডার দিন</button>${r.state==='on'?'':`<button type="button" class="sm" data-a="a" data-i="${i}">সাইটে চালু করুন</button>`}</div></div>`};
async function best(){
  cur=null;$('#title').textContent='সেরা সার্ভিস';$('#back').hidden=true;const el=$('#main'),my=rid;
  el.innerHTML=nav('best')+'<div class="sk"></div>';
  let P=[];
  try{const d=await api('svc_platforms');P=(d.platforms||[]).filter(p=>p.total>0)}
  catch(e){if(!authFail(e))el.innerHTML=nav('best')+`<div class="card"><p class="err">${esc(e.message)}</p></div>`;return}
  if(my!==rid)return;
  if(!P.some(p=>p.label===BS.label)){BS.label=(popSort(P)[0]||P[0]||{}).label||'';BS.type=''}
  el.innerHTML=nav('best')+`<p class="sub">১০ প্রভাইডারের একই ধরনের সার্ভিস দাম + স্পিড-টেস্ট + ড্রপ মিলিয়ে সাজানো। টেস্ট-করা সার্ভিস আগে আসে।</p><select id="bpl" class="plmore" aria-label="প্ল্যাটফর্ম">${P.map(p=>`<option value="${esc(p.label)}"${p.label===BS.label?' selected':''}>${esc(p.label)} (${bn(p.total)}টি)</option>`).join('')}</select><div class="chips" id="bty" style="margin-top:10px"></div><div class="bar"><input id="bq" type="search" placeholder="নাম বা আইডি" aria-label="খুঁজুন" value="${esc(BS.q)}"></div><div class="chips"><button type="button" class="chip" id="brf" aria-pressed="${BS.refill}">♻ শুধু রিফিল</button><button type="button" class="chip" id="bun" aria-pressed="${BS.untested}">🔎 অপরীক্ষিত (টেস্টের পরামর্শ)</button></div><div id="bl"></div>`;
  let rows=[];
  const load=async()=>{const box=$('#bl'),k=++bcn;if(!box)return;box.innerHTML='<div class="sk"></div>';
    try{const d=await api('svc_best',{label:BS.label,type:BS.type,q:BS.q,refill:BS.refill,untested:BS.untested,limit:BS.untested?30:15});if(k!==bcn||!$('#bl'))return;
      BS.type=d.type;BS.fx=d.fx||131;rows=d.rows||[];
      $('#bty').innerHTML=(d.types||[]).map(t=>`<button type="button" class="chip" data-t="${esc(t[0])}" aria-pressed="${t[0]===d.type}">${esc(t[0])}<small>${bn(t[1])}</small></button>`).join('');
      $('#bty').querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{BS.type=b.dataset.t;load()});
      box.innerHTML=`<p class="sub">${bn(d.total)}টি সার্ভিস থেকে ${BS.untested?'অপরীক্ষিত ':'সেরা '}${bn(rows.length)}টি · টেস্ট-করা ${bn(d.tested_n)}টি · অপরীক্ষিত ${bn(d.untested_n||0)}টি${d.try_n?' (এর মধ্যে '+bn(d.try_n)+'টি দাম কম, টেস্ট করার মতো)':''}</p>`+(BS.untested?'<p class="sub">দাম কম অথচ এখনো টেস্ট হয়নি — 🧪 অর্ডার দিয়ে মেপে দেখুন, ভালো হলে এরপর থেকে এটাও সেরার তালিকায় উঠবে।</p>':'')+(rows.length?rows.map(bcard).join(''):'<div class="card empty">'+(BS.untested?'সব সার্ভিসই টেস্ট করা হয়েছে 🎉':'কিছু পাওয়া যায়নি')+'</div>')}
    catch(e){if(k!==bcn)return;if(!authFail(e))box.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p></div>`}};
  $('#bl').onclick=e=>{const b=e.target.closest('button[data-a]');if(!b)return;const r=rows[+b.dataset.i];if(!r)return;if(b.dataset.a==='o')ordDlg(r);else addList([r])};
  $('#bpl').onchange=e=>{BS.label=e.target.value;BS.type='';load()};
  let qt2=null;$('#bq').oninput=e=>{clearTimeout(qt2);qt2=setTimeout(()=>{BS.q=e.target.value.trim();load()},350)};
  $('#brf').onclick=e=>{BS.refill=!BS.refill;e.currentTarget.setAttribute('aria-pressed',BS.refill);load()};
  $('#bun').onclick=e=>{BS.untested=!BS.untested;e.currentTarget.setAttribute('aria-pressed',BS.untested);load()};
  load()}
/* সরাসরি টেস্ট অর্ডার: দুইবার ট্যাপ (নিশ্চিত করা) + একই req_id তাই নেট কাটলেও ডবল অর্ডার হয় না */
const isCmt=r=>(/custom/i.test(r.type||'')&&/comment/i.test(r.type||''))||(/custom/i.test(r.name||'')&&/comment/i.test(r.name||''));
/* ---------- ⚠ দ্বিতীয় অর্ডারের সতর্কতা: একই লিংকে এখন/আগে অর্ডার আছে কিনা (টেস্ট অর্ডার দেওয়ার আগে) ---------- */
function spDupN(u){return spLinkN(u).replace(/^@/,'')}
function spDupSame(a,b){a=spDupN(a);b=spDupN(b);if(!a||!b)return false;if(a===b)return true;const sh=a.length<b.length?a:b,lg=a.length<b.length?b:a;return sh.length>=5&&lg.indexOf(sh)>=0}
async function spDupFind(link,provider,service){
  let rows=[];try{const d=await api('svc_spd',{limit:300});rows=(d&&d.rows||[]).slice()}catch(e){return null}
  const seen=new Set(rows.map(spKey));(spLoad(SPK_L)||[]).forEach(l=>{if(!seen.has(spKey(l)))rows.push(l)});
  const now=spNow(),run=[],rec=[],same=r=>r.provider===provider&&String(r.service_id)===String(service);
  rows.forEach(r=>{if(!r.link||!spDupSame(r.link,link))return;if(!spFin(r))run.push(r);else if(same(r)&&r.ordered_at>0&&now-r.ordered_at<864e5)rec.push(r)});
  const f=(a,b)=>(b.ordered_at||0)-(a.ordered_at||0);run.sort(f);rec.sort(f);
  return{run,rec,same:run.filter(same),other:run.filter(r=>!same(r))}}
function spDupHtml(x){
  if(x===null)return '<div class="sub">⚠ এই লিংকে আগের চলমান অর্ডার যাচাই করা যায়নি — ল্যাব পাতায় একবার দেখে নিতে পারেন।</div>';
  const li=r=>'<li>'+esc(r.provider)+' · সার্ভিস '+esc(r.service_id)+' · #'+esc(r.provider_order||'—')+' · '+lvT((spNow()-(r.ordered_at||spNow()))/1000)+' ধরে '+(r.started_at>0?'চলছে':'শুরুর অপেক্ষায়')+'</li>';
  let h='';
  if(x.same.length)h+='<b>⛔ এই লিংকে এই সার্ভিসেই এখনও '+bn(x.same.length)+'টি অর্ডার চলছে</b><ul>'+x.same.slice(0,4).map(li).join('')+'</ul><div class="sub">দ্বিতীয় অর্ডার দিলে প্রভাইডার ডুপ্লিকেট বলে ফেরত দিতে পারে, বা ডেলিভারি ও সময়ের হিসাব গুলিয়ে যাবে।</div>';
  if(x.other.length)h+='<b>⚠ এই লিংকে অন্য সার্ভিসের '+bn(x.other.length)+'টি অর্ডার চলছে</b><ul>'+x.other.slice(0,4).map(li).join('')+'</ul><div class="sub">একই লিংকে একসাথে দুই অর্ডার গেলে ডেলিভারি আলাদা করা যায় না — গতির তুলনা ভুল হবে।</div>';
  if(x.rec.length&&!x.same.length)h+='<b>ℹ ২৪ ঘণ্টার মধ্যে এই সার্ভিসে এই লিংকে আগে '+bn(x.rec.length)+'টি অর্ডার হয়েছে</b><div class="sub">শেষটা '+agoT(x.rec[0].ordered_at)+'। প্রভাইডার কখনো একই লিংকে বারবার অর্ডার নেয় না।</div>';
  return h}
function ordDlg(r){
  let d=$('#ordD');if(!d){d=document.createElement('dialog');d.id='ordD';d.setAttribute('aria-labelledby','ordT');document.body.appendChild(d)}
  const mn=Math.max(1,+r.min||1),mx=+r.max||0,rate=+r.rate||0,fx=+r._fx>0?+r._fx:(BS.fx||131),req='o'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);let armed=false,done=false;const cm=isCmt(r);
  d.innerHTML=`<form method="dialog" id="ordF"><h3 id="ordT" style="margin:0 0 8px">🧪 টেস্ট অর্ডার</h3><p class="sub" id="ordN"></p><label for="ordL">লিংক / ইউজারনেম</label><input id="ordL" autocomplete="off" inputmode="url" placeholder="https://…">${cm?`<label for="ordCm">কমেন্ট লিখুন — প্রতি লাইনে একটা (${bn(mn)}–${mx?bn(mx):'∞'}টি)</label><textarea id="ordCm" rows="6" placeholder="Nice post!&#10;Great work 👏&#10;Love this" style="min-height:150px;resize:vertical;overflow:auto"></textarea><p class="sub" id="ordCn"></p><input id="ordQ" type="hidden" value="0">`:`<label for="ordQ">পরিমাণ (${bn(mn)}–${mx?bn(mx):'∞'})</label><input id="ordQ" type="number" inputmode="numeric" min="${mn}"${mx?` max="${mx}"`:''} value="${mn}">`}<p class="bm" id="ordC"></p><p class="sub">খরচ প্রভাইডারের ব্যালেন্স থেকে কাটবে (আনুমানিক)। অর্ডারটি স্পিড-টেস্টে নিজে থেকে ধরা পড়বে।</p><div id="ordW" class="ordw" hidden></div><p id="ordE" class="err" role="alert"></p><div class="acts"><button type="button" class="sm" id="ordX">বন্ধ</button><button type="button" class="btn" id="ordGo">অর্ডার দিন</button></div></form>`;
  $('#ordN').textContent=r.provider+' · #'+r.service_id+' · '+r.name;
  const go=$('#ordGo'),E=$('#ordE'),cost=()=>Math.round(rate*fx*(Math.floor(+$('#ordQ').value)||0)/1000*100)/100,
    upd=()=>{$('#ordC').textContent='আনুমানিক খরচ: ৳'+bn(cost());armed=false;go.textContent='অর্ডার দিন';const w=$('#ordW');if(w){w.hidden=true;w.innerHTML=''}};
  $('#ordQ').oninput=upd;
  if(cm){const cl=()=>$('#ordCm').value.replace(/\r/g,'').split('\n').map(x=>x.trim()).filter(Boolean);$('#ordCm').oninput=()=>{const n=cl().length;$('#ordQ').value=n;$('#ordCn').textContent='কমেন্ট সংখ্যা: '+bn(n)+' (এটাই পরিমাণ)';upd()};$('#ordCm').oninput()}
  $('#ordL').oninput=()=>{armed=false;go.textContent='অর্ডার দিন';const w=$('#ordW');if(w){w.hidden=true;w.innerHTML=''}};upd();
  $('#ordX').onclick=()=>d.close();$('#ordF').onsubmit=e=>{e.preventDefault();go.click()};
  go.onclick=async()=>{
    if(done){d.close();location.hash='spd';return}
    E.textContent='';const link=$('#ordL').value.trim(),q=Math.floor(+$('#ordQ').value)||0;
    if(link.length<3||/\s/.test(link)){E.textContent='লিংক/ইউজারনেম দিন (ফাঁকা ছাড়া)';return}
    if(q<mn||(mx&&q>mx)){E.textContent=cm?'কমেন্ট '+bn(mn)+(mx?'–'+bn(mx):'+')+'টির মধ্যে দিন (প্রতি লাইনে একটা)':'পরিমাণ '+bn(mn)+(mx?'–'+bn(mx):'+')+' এর মধ্যে দিন';return}
    if(cm&&$('#ordCm').value.length>8000){E.textContent='কমেন্ট মোট ৮০০০ অক্ষরের বেশি — কমান';return}
    if(!armed){go.disabled=true;go.textContent='লিংক যাচাই হচ্ছে…';const x=await spDupFind(link,r.provider,r.service_id);go.disabled=false;
      if(!d.open)return;if($('#ordL').value.trim()!==link){go.textContent='অর্ডার দিন';return}
      const h=spDupHtml(x),W=$('#ordW');W.innerHTML=h;W.hidden=!h;armed=true;go.textContent=(h?'তবুও অর্ডার দিন':'নিশ্চিত')+' — ৳'+bn(cost())+' কাটবে, আবার ট্যাপ করুন';return}
    go.disabled=true;go.textContent='পাঠানো হচ্ছে…';
    try{const o=await api('svc_order',{provider:r.provider,service:r.service_id,link,quantity:q,comments:cm?$('#ordCm').value:undefined,confirm:true,req_id:req});
      done=true;tstSaveLk(r.provider,o.provider_order,link);$('#ordC').textContent='';$('#ordT').textContent='✅ অর্ডার গেছে';try{const L=spLoad(SPK_L)||[];L.unshift({src:'studio',provider:r.provider,service_id:r.service_id,provider_order:o.provider_order,name:r.name,quantity:o.quantity,cost_bdt:o.cost_bdt,link,status:'Pending',ordered_at:Date.now(),last_checked:Date.now()});spSave(SPK_L,L.slice(0,30))}catch(_){}
      $('#ordN').textContent='প্রভাইডার অর্ডার #'+o.provider_order+' · পরিমাণ '+bn(o.quantity)+' · খরচ ≈ ৳'+bn(o.cost_bdt);
      go.textContent='স্পিড দেখুন';go.disabled=false;toast('টেস্ট অর্ডার গেছে ✔');try{TST=TST||{};const kk=r.provider+'|'+r.service_id;if(!TST[kk])TST[kk]={n:1,ok:0,open:1,bad:0,total_med:0,start_med:0,last_at:Date.now(),per_hr:0,tests:[]};tstPaint();setTimeout(tstRefresh,4000)}catch(_){}}
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
const spCan=r=>/cancel|refund|fail|error/.test(String(r.status||'').toLowerCase());
/* ---------- 📝 দ্রুত সম্পন্ন সার্ভিসের নোট: সার্ভিস কোড, নাম, প্রভাইডার, গড় সময় (ফোনে জমা থাকে) ---------- */
const SPK_F='pb_sp_fast_v1',SPK_FT='pb_sp_fast_th';
const spTot=r=>r.total_secs>0?r.total_secs:(r.completed_at>0&&r.ordered_at>0?(r.completed_at-r.ordered_at)/1000:0);
function spFastLearn(rows){const f=spLoad(SPK_F)||{seen:{},s:{}};let ch=false;
  rows.forEach(r=>{if(r._local||!spFin(r)||spBad(r))return;const t=spTot(r);if(!(t>0))return;const o=spKey(r);if(f.seen[o])return;f.seen[o]=1;ch=true;
    const k=r.provider+'|'+r.service_id,e=f.s[k]||(f.s[k]={code:String(r.service_id),name:'',prov:r.provider,sum:0,n:0,min:t,max:t,last:0});
    if(r.name||r.label)e.name=r.name||r.label;e.sum+=t;e.n++;e.min=Math.min(e.min,t);e.max=Math.max(e.max,t);e.last=Math.max(e.last,r.completed_at||0)});
  const ks=Object.keys(f.seen);if(ks.length>3000){ks.slice(0,ks.length-3000).forEach(k=>delete f.seen[k]);ch=true}
  if(ch)spSave(SPK_F,f);return f}
const spFastTh=()=>{const v=+ls.get(SPK_FT);return v>0?v:Infinity};
const spCatAuto=e=>{const kd=spKind(e.name);return kd&&kd.label?kd.label:'অন্যান্য'};
function spFastList(f,prov){const th=spFastTh();return Object.keys(f.s).map(k=>{const e=Object.assign({k,avg:f.s[k].sum/f.s[k].n},f.s[k]);e.cat=e.cat||spCatAuto(e);return e}).filter(e=>e.avg<=th&&(!prov||e.prov===prov)).sort((a,b)=>a.avg-b.avg)}
function spFastText(L,th){const o=['📝 সম্পন্ন সার্ভিসের নোট','────────────────',isFinite(th)?'শর্ত: গড় মোট সময় '+mnT(th)+' বা কম':'সব সম্পন্ন সার্ভিস','সার্ভিস: '+bn(L.length)+'টি',''],g={};
  L.forEach(e=>{(g[e.cat]||(g[e.cat]=[])).push(e)});
  Object.keys(g).forEach(c=>{o.push('📁 '+c+' ('+bn(g[c].length)+'টি)');g[c].forEach((e,i)=>{o.push(bn(i+1)+'. সার্ভিস কোড: '+e.code);o.push('   সার্ভিস নাম: '+(e.name||'—'));o.push('   প্রভাইডার: '+e.prov);o.push('   গড় সময়: ~'+mnT(e.avg)+' ('+bn(e.n)+'টি অর্ডার)')});o.push('')});return o.join('\n')}
/* ---------- টেলিগ্রাম: অর্ডার শেষ/ক্যান্সেল হলে লিংকসহ মেসেজ (টোকেন শুধু এই ব্রাউজারে) ---------- */
const SPK_T='sp_tg_sent_v1';
const tgCfg=()=>({t:(ls.get('pb_tg_token')||'').trim(),c:(ls.get('pb_tg_chat')||'').trim()});
const tgOn=()=>{const g=tgCfg();return !!(g.t&&g.c&&ls.get('pb_tg_on')!=='0')};
async function tgSendMsg(text,g){g=g||tgCfg();const r=await fetch('https://api.telegram.org/bot'+g.t+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:g.c,text:String(text).slice(0,3900)})});let j=null;try{j=await r.json()}catch(_){}if(!j||!j.ok)throw new Error((j&&j.description)||('Telegram '+r.status));return j}
function spTgText(r){const can=spCan(r),par=/partial/.test(String(r.status||'').toLowerCase()),q=+r.quantity||0,dl=r.delivered!=null?+r.delivered:null,
  el=r.completed_at>0&&r.ordered_at>0?(r.completed_at-r.ordered_at)/1000:(r.total_secs||0),st=r.started_at>0?(r.start_secs>0?r.start_secs:(r.started_at-r.ordered_at)/1000):0;
  const L=[can?'🚫 অর্ডার ক্যান্সেল':par?'⚠️ অর্ডার আংশিক':'✅ অর্ডার সম্পন্ন','────────────────','প্রভাইডার: '+r.provider,'সার্ভিস: #'+r.service_id+(r.name?' · '+r.name:''),'প্রভাইডার অর্ডার: #'+r.provider_order,'স্ট্যাটাস: '+(r.status||'—')];
  if(q)L.push('পরিমাণ: '+bn(q)+(dl!=null?' · ডেলিভারি '+bn(dl):''));
  if(st>0)L.push('শুরু হতে: '+mnT(st));
  if(el>0)L.push('মোট সময়: '+mnT(el));
  if(r.cost_bdt!=null)L.push('খরচ ≈ ৳'+bn(r.cost_bdt));
  L.push('🔗 লিংক: '+(r.link||'—'));return L.join('\n')}
let spTgBusy=false;
async function spTgRun(rows){if(spTgBusy||!tgOn())return;let sent=spLoad(SPK_T);const first=!sent;sent=sent||{};const todo=[];
  rows.filter(r=>!r._local&&spFin(r)).forEach(r=>{const k=spKey(r);if(sent[k])return;if(first)sent[k]=1;else todo.push(r)});
  if(first){spSave(SPK_T,sent);return}
  if(!todo.length)return;spTgBusy=true;
  try{for(const r of todo.slice(0,15)){try{await tgSendMsg(spTgText(r))}catch(e){break}sent[spKey(r)]=1;spSave(SPK_T,sent);await new Promise(z=>setTimeout(z,1100))}}finally{spTgBusy=false}}
async function spTgManual(r){if(!tgOn()){toast('আগে টেলিগ্রাম সেটআপ করুন');spTgDlg();return}
  try{await tgSendMsg(spTgText(r));toast('টেলিগ্রামে পাঠানো হয়েছে ✔')}catch(e){toast('টেলিগ্রাম: '+e.message)}}
function spTgDlg(){let d=$('#tgD');if(!d){d=document.createElement('dialog');d.id='tgD';d.setAttribute('aria-labelledby','tgT');document.body.appendChild(d)}
  const g=tgCfg();
  d.innerHTML=`<form method="dialog"><h3 id="tgT" style="margin:0 0 8px">✈ টেলিগ্রাম মেসেজ</h3><p class="sub">অর্ডার শেষ বা ক্যান্সেল হলে লিংকসহ মেসেজ যাবে; স্বাভাবিকের চেয়ে বেশি দেরি হলেও একবার জানাবে। টেস্ট ল্যাব পাতা খোলা থাকলে চলে।</p><label for="tgTk">বট টোকেন</label><input id="tgTk" type="password" autocomplete="off" placeholder="123456:ABC…" value="${esc(g.t)}"><label for="tgCh">চ্যাট / গ্রুপ আইডি</label><input id="tgCh" autocomplete="off" placeholder="-100… বা @চ্যানেল" value="${esc(g.c)}"><label class="bsk"><input type="checkbox" id="tgOn" ${ls.get('pb_tg_on')!=='0'?'checked':''}> চালু</label><p class="sub">টোকেন শুধু এই ফোনের ব্রাউজারে থাকে।</p><p class="err" id="tgEr" role="alert"></p><div class="acts"><button class="sm" value="cancel" formnovalidate>বন্ধ</button><button class="sm" id="tgDel" type="button">মুছুন</button><button class="btn" id="tgSv" type="button">সংরক্ষণ ও টেস্ট</button></div></form>`;
  const er=$('#tgEr'),chip=()=>{const c=$('#tgSet');if(c)c.textContent='✈ টেলিগ্রাম '+(tgOn()?'●':'○')};
  $('#tgDel').onclick=()=>{ls.del('pb_tg_token');ls.del('pb_tg_chat');ls.del('pb_tg_on');try{localStorage.removeItem(SPK_T)}catch(_){}chip();d.close();toast('টেলিগ্রাম মুছে ফেলা হয়েছে')};
  $('#tgSv').onclick=async()=>{const t=$('#tgTk').value.trim(),c=$('#tgCh').value.trim(),b=$('#tgSv');
    if(!/^\d+:[\w-]{20,}$/.test(t)){er.textContent='বট টোকেন ঠিক নয় (যেমন 123456:ABC…)';return}
    if(!/^-?\d+$|^@\w+$/.test(c)){er.textContent='চ্যাট আইডি ঠিক নয় (যেমন -1001234567890)';return}
    b.disabled=true;er.textContent='পরীক্ষা হচ্ছে…';
    try{await tgSendMsg('✅ boostplus স্টুডিও — টেলিগ্রাম সংযোগ ঠিক আছে',{t,c});ls.set('pb_tg_token',t);ls.set('pb_tg_chat',c);ls.set('pb_tg_on',$('#tgOn').checked?'1':'0');try{localStorage.removeItem(SPK_T)}catch(_){}er.textContent='';chip();d.close();toast('টেলিগ্রাম সংযুক্ত ✔ — এখন থেকে নতুন শেষ হওয়া অর্ডারের মেসেজ যাবে')}
    catch(e){er.textContent='পাঠানো যায়নি: '+e.message}b.disabled=false};
  d.showModal()}
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
/* ৩.১ সেরা প্রভাইডার: নাম থেকে 'প্ল্যাটফর্ম + ধরন' (যেমন Facebook Views) ধরে একই ধরনের সার্ভিস তুলনা করা হয়।
   স্কোর (কম = ভালো) = শুরুর সময় + ০.৩ × মোট সময় + ১% ড্রপ ≈ ১৮ সেকেন্ড; যাদের শুরুর তথ্য নেই তারা বাদ। */
const spKind=n=>{n=String(n||'');const pl=(n.match(/facebook|instagram|youtube|tiktok|telegram|twitter|whatsapp|linkedin|spotify|threads|snapchat/i)||[''])[0],me=(n.match(/followers?|subscribers?|likes?|reactions?|views?|watch ?time|comments?|shares?|members?|saves?|impressions?|reach|votes?/i)||[''])[0];if(!pl||!me)return null;const m=me.toLowerCase().replace(/\s+/g,'').replace(/s$/,'');return{key:pl.toLowerCase()+'|'+m,label:pl[0].toUpperCase()+pl.slice(1).toLowerCase()+' '+me[0].toUpperCase()+me.slice(1).toLowerCase()}};
const spScore=s=>s.start_med+0.3*(s.total_med||0)+s.bad*18;
function spBest(SA,nm){const g={};SA.forEach(s=>{if(!(s.start_n>0))return;const kd=spKind(nm[s.k]);if(!kd)return;(g[kd.key]||(g[kd.key]={label:kd.label,l:[]})).l.push(s)});const by={},groups=[];Object.keys(g).forEach(k=>{const l=g[k].l;if(l.length<2)return;l.sort((a,b)=>spScore(a)-spScore(b));by[l[0].k]=1;groups.push({label:g[k].label,l})});groups.sort((a,b)=>b.l.length-a.l.length);return{by,groups}}
/* ৩.৩ গতির ধারা: প্রভাইডারভিত্তিক দৈনিক মিডিয়ান শুরুর সময় (শেষ ১৪ দিন) + ছোট লাইন চার্ট */
const spDay=ms=>new Date(ms+216e5).toISOString().slice(0,10);
function spTrend(rows){const g={};rows.forEach(r=>{if(!(r.started_at>0&&r.start_secs>0&&r.ordered_at>0))return;const d=spDay(r.ordered_at);((g[r.provider]||(g[r.provider]={}))[d]||(g[r.provider][d]=[])).push(r.start_secs)});return Object.keys(g).map(p=>{const ds=Object.keys(g[p]).sort().slice(-14);return{p,pts:ds.map(d=>medOf(g[p][d]))}}).filter(x=>x.pts.length>=2).sort((a,b)=>a.pts[a.pts.length-1]-b.pts[b.pts.length-1])}
function spSpark(v,w,h){const mx=Math.max(...v),mn=Math.min(...v),sp=mx-mn||1,st=w/(v.length-1),pt=v.map((x,i)=>[+(i*st).toFixed(1),+(h-3-((x-mn)/sp)*(h-6)).toFixed(1)]);return `<svg class="spk" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${pt.map(q=>q.join(',')).join(' ')}"/><circle cx="${pt[pt.length-1][0]}" cy="${pt[pt.length-1][1]}" r="3" fill="currentColor"/></svg>`}
function spStats(rows){const g={};rows.forEach(r=>{const k=r.provider+'|'+r.service_id,s=g[k]||(g[k]={k,n:0,st:[],tt:[],bad:0,fin:0});s.n++;if(r.started_at>0&&r.start_secs>0)s.st.push(r.start_secs);if(spFin(r)){s.fin++;if(spBad(r))s.bad++;else if(r.total_secs>0)s.tt.push(r.total_secs)}});
  return Object.keys(g).map(k=>{const s=g[k];return{k,n:s.n,start_n:s.st.length,start_med:medOf(s.st),ok:s.tt.length,total_med:medOf(s.tt),bad:s.fin?Math.round(s.bad/s.fin*100):0}})}
/* রিপোর্ট (লেখা) — কপি/ডাউনলোড/শেয়ার করা যায় */
function spReport(r){const L=[],q=+r.quantity||0,dl=r.delivered!=null?+r.delivered:null,el=r.completed_at>0&&r.ordered_at>0?(r.completed_at-r.ordered_at)/1000:(r.total_secs||0),
  st=r.started_at>0?(r.start_secs>0?r.start_secs:(r.started_at-r.ordered_at)/1000):0,dur=r.started_at>0&&r.completed_at>0?(r.completed_at-r.started_at)/1000:0,pct=q&&dl!=null?Math.min(100,Math.round(dl/q*100)):null;
  L.push('📄 টেস্ট ল্যাব রিপোর্ট');L.push('────────────────');
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
function spReportAll(rows){const f=rows.filter(spFin);const L=['📊 টেস্ট ল্যাব — সারসংক্ষেপ','────────────────','শেষ হওয়া অর্ডার: '+bn(f.length)+' / মোট '+bn(rows.length),''];
  spStats(rows).filter(s=>s.n).sort((a,b)=>((b.start_n>0)-(a.start_n>0))||((a.start_med||1e12)-(b.start_med||1e12))).forEach(s=>{const p=s.k.split('|');L.push(p[0]+' #'+p[1]+' — শুরু '+(s.start_n?'~'+mnT(s.start_med):'হয়নি')+' · মোট '+(s.ok?'~'+mnT(s.total_med):'—')+' · ড্রপ '+bn(s.bad)+'% · টেস্ট '+bn(s.n)+'টি')});
  L.push('');L.push('রিপোর্ট তৈরি: '+dT(Date.now()));return L.join('\n')}
/* স্পিড টেস্ট কার্ড থেকে সার্ভিসটা সাইটে যোগ: প্রভাইডারের তালিকা থেকে সারি খুঁজে "সাইটে চালু করুন" শিট খোলে */
async function spAddSite(r){
  try{
    await provEnsure(r.provider);
    const P=PC[r.provider],row=P&&P.rows&&P.rows.find(y=>String(y.service_id)===String(r.service_id));
    if(!row){toast('প্রভাইডারের তালিকায় সার্ভিসটা পাওয়া যায়নি — আগে প্রভাইডার সংগ্রহ করুন');return}
    if(row.state==='on'){toast('এই সার্ভিস আগে থেকেই সাইটে চালু আছে');return}
    if(!row.provider)row.provider=r.provider;
    addNoRf=true;addList([row]);
  }catch(e){addNoRf=false;if(!authFail(e))toast(e.message||'সার্ভিস লোড হয়নি')}
}
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
    const m=(spCan(r)?'🚫 অর্ডার ক্যান্সেল — #':'✅ অর্ডার শেষ — #')+r.provider_order+' ('+r.provider+')';   /* অ্যাপের ভেতরের পপআপ বন্ধ; শুধু নোটিফিকেশন (অনুমতি থাকলে) */
    try{if('Notification' in window&&Notification.permission==='granted')navigator.serviceWorker.ready.then(g=>g.showNotification('টেস্ট ল্যাব — অর্ডার শেষ',{body:m,icon:'icons/admin-192.png',tag:'sp-'+k,data:{h:'spd'}}))}catch(_){}});
  if(ch)spSave(SPK_N,nt)}
function spStBanner(r){if(!spFin(r))return '<div class="lab-st run"><i class="dot"></i><span>🧪 টেস্টিং চলছে</span><b data-lvc data-t0="'+(r.ordered_at||0)+'">'+lvT((spNow()-(r.ordered_at||spNow()))/1000)+'</b></div>';
  if(spBad(r))return '';const t=r.total_secs>0?r.total_secs:(r.completed_at>0&&r.ordered_at>0?(r.completed_at-r.ordered_at)/1000:0);return t>0?'<div class="lab-st ok">✅ <b>'+mnT(t)+'</b> এ সম্পন্ন</div>':''}
const spc=r=>{const fin=spFin(r),bad=spBad(r),cls=fin?(bad?'b':'g'):'',started=r.started_at>0,done=r.completed_at>0,
  pct=r.quantity&&r.delivered!=null?Math.min(100,Math.round(r.delivered/r.quantity*100)):null,
  lk=/^https?:\/\//i.test(r.link)?`<a href="${esc(r.link)}" target="_blank" rel="noopener noreferrer">${esc(r.link.length>48?r.link.slice(0,46)+'…':r.link)}</a>`:esc(r.link||''),
  live=!fin?`<span class="tag lv"><i class="dot"></i>লাইভ</span>`:'',
  startCell=started?`<b>${dT(r.started_at)}</b><small class="g">${mnT(r.start_secs>0?r.start_secs:(r.started_at-r.ordered_at)/1000)} পরে শুরু</small>`:`<b>অপেক্ষায়</b><small class="w" data-lv="wait" data-t0="${r.ordered_at||0}">${lvT((spNow()-(r.ordered_at||spNow()))/1000)} ধরে অপেক্ষা</small>`,
  endCell=done?`<b>${dT(r.completed_at)}</b><small>মোট ${mnT(r.total_secs>0?r.total_secs:(r.completed_at-r.ordered_at)/1000)}</small>`:fin?`<b>${esc(r.status||'—')}</b>`:`<b>চলছে</b><small class="w" data-lv="run" data-t0="${r.ordered_at||0}">${lvT((spNow()-(r.ordered_at||spNow()))/1000)} হলো</small>`,
  rate=!fin&&started&&r.delivered>0&&r.started_at>0?Math.round(r.delivered/Math.max(1,(spNow()-r.started_at)/60000)):0,
  eta=rate>0&&r.remains>0?` · বাকি ~${mnT(r.remains/rate*60)}`:'';
  return `<div class="card spc ${cls}"><div class="bsh"><span class="tag">🧪 টেস্ট</span><span class="tag">${esc(r._local?'পাঠানো হয়েছে':(r.status||'—'))}</span>${live}${spLateTag(r)}${r.provider&&r.service_id&&dfOn(r)?'<span class="tag" style="color:#34d399;border-color:#34d399">✔ সাইটে চালু</span>':''}</div>${spStBanner(r)}<b class="bnm">${esc(r.name||r.label||('অর্ডার '+r.provider_order))}</b><div class="sub">${esc(r.provider)} · সার্ভিস ${esc(r.service_id)} · প্রভাইডার অর্ডার #${esc(r.provider_order)}${r.platform?' · '+esc(r.platform):''}</div>
<div class="tl"><div><span class="sub">অর্ডার</span><b>${dT(r.ordered_at)}</b></div><div><span class="sub">শুরু</span>${startCell}</div><div><span class="sub">শেষ</span>${endCell}</div></div>
${pct!=null?`<div class="pbar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div><div class="sub">ডেলিভারি ${bn(r.delivered)} / ${bn(r.quantity)} (${bn(pct)}%) · শুরুর কাউন্ট ${r.start_count!=null?bn(r.start_count):'—'} · বাকি ${bn(r.remains)}${rate?` · গতি ~${bn(rate)}/মিনিট${eta}`:''}</div>`:`<div class="sub">পরিমাণ ${r.quantity?bn(r.quantity):'—'}${r.start_count!=null?' · শুরুর কাউন্ট '+bn(r.start_count):''}${r._local?' · সার্ভারে মেলানো হচ্ছে…':''}</div>`}
${r.link?`<div class="sub">লিংক: ${lk}</div>`:''}<div class="sub">${r.cost_bdt!=null?'খরচ ≈ ৳'+bn(r.cost_bdt)+' · ':''}শেষ মেলানো ${dT(r.last_checked)}</div><div class="acts">${fin?`<button type="button" class="sm" data-rep="${esc(spKey(r))}">📄 রিপোর্ট</button><button type="button" class="sm" data-tg="${esc(spKey(r))}">✈ টেলিগ্রাম</button>`:''}${r.provider&&r.service_id?(dfOn(r)?'<span class="sub ok">✔ সাইটে চালু আছে</span>':`<button type="button" class="sm" data-add="${esc(spKey(r))}">➕ সাইটে যোগ</button>`):''}</div></div>`};
/* ✅ শেষ ট্যাবের ফাইন্ডার: ক্যাটাগরি আলাদা + "কত সময়ের মধ্যে শেষ" + সর্ট + সার্চ */
const DF_TB=[[0,'সব সময়'],[600,'≤ ১০ মিনিট'],[1800,'≤ ৩০ মিনিট'],[3600,'≤ ১ ঘণ্টা'],[21600,'≤ ৬ ঘণ্টা'],[86400,'≤ ২৪ ঘণ্টা'],[-1,'২৪ ঘণ্টার বেশি']];
const dfIn=(t,b)=>b===0?true:b===-1?t>86400:(t>0&&t<=b);
function spCatOf(r,f){const e=f&&f.s&&f.s[r.provider+'|'+r.service_id];if(e&&e.cat)return e.cat;const kd=spKind(r.name||r.label);if(kd&&kd.label)return kd.label;const p=String(r.platform||'').trim(),t=String(r.type||'').trim();return(p||t)?(p+' '+t).trim():'অন্যান্য'}
const dfShell=()=>`<div class="card sps dff"><div class="bar"><input id="dfq" type="search" placeholder="🔎 লিংক, নাম, আইডি বা প্রভাইডার দিয়ে খুঁজুন" value="${esc(SP.q)}" aria-label="খুঁজুন"></div><div class="sub">কত সময়ের মধ্যে শেষ হয়েছে</div><div class="chips" id="dfT"></div><div class="sub">ক্যাটাগরি</div><div class="chips" id="dfC"></div><div class="acts"><select id="dfS" class="plmore" aria-label="সাজান"><option value="fast"${SP.so==='fast'?' selected':''}>⚡ দ্রুত আগে</option><option value="slow"${SP.so==='slow'?' selected':''}>🐢 ধীর আগে</option><option value="new"${SP.so==='new'?' selected':''}>🕒 নতুন শেষ আগে</option></select><button type="button" class="sm" id="dfCp">📄 তালিকা কপি</button></div></div><div class="card dfb" id="dfB" hidden></div><div id="dfR"></div>`;
function dfCalc(rows){const f=spFastLearn([]),q=String(SP.q||'').toLowerCase().trim();
  const base=rows.map(r=>({r,t:spTot(r),c:spCatOf(r,f)})).filter(x=>!q||spQMatch(SP.q,x.r,x.c));
  const byT=base.filter(x=>dfIn(x.t,SP.tb)),cats={};byT.forEach(x=>{cats[x.c]=(cats[x.c]||0)+1});
  const byC=base.filter(x=>!SP.cat||x.c===SP.cat),tbN={};DF_TB.forEach(b=>{tbN[b[0]]=byC.filter(x=>dfIn(x.t,b[0])).length});
  const list=byT.filter(x=>!SP.cat||x.c===SP.cat),g={};list.forEach(x=>{(g[x.c]||(g[x.c]=[])).push(x)});
  const so=SP.so,tv=x=>x.t>0?x.t:(so==='slow'?-1:1e12),cmp=so==='new'?(a,b)=>(b.r.completed_at||b.r.ordered_at||0)-(a.r.completed_at||a.r.ordered_at||0):so==='slow'?(a,b)=>tv(b)-tv(a):(a,b)=>tv(a)-tv(b);
  if(so==='new'&&list.length){const fl=list.slice().sort(cmp);Object.keys(g).forEach(k=>delete g[k]);g['🕒 সাম্প্রতিক সম্পন্ন']=fl}
  const groups=Object.keys(g).map(c=>{const l=g[c].sort(cmp),ts=l.map(x=>x.t).filter(t=>t>0);return{c,l,min:ts.length?Math.min(...ts):1e12,max:ts.length?Math.max(...ts):0,med:medOf(ts),last:Math.max(...l.map(x=>x.r.completed_at||x.r.ordered_at||0))}});
  groups.sort(so==='new'?(a,b)=>b.last-a.last:so==='slow'?(a,b)=>b.max-a.max:(a,b)=>a.min-b.min);
  return{cats,tbN,list,groups,total:base.length}}
const DFSEL=new Set(),dfSk=r=>r.provider+'|'+r.service_id,dfOn=r=>!!(CAT&&CAT.rows&&CAT.rows.some(c=>String(c.code)===String(r.service_id)&&c.state==='on'));
async function spAddMany(rs){
  const by={};rs.forEach(r=>{if(r.provider&&r.service_id)by[dfSk(r)]=r});const ks=Object.keys(by);if(!ks.length)return;
  try{const out=[];let skip=0,miss=0;
    for(const k of ks){const r=by[k];await provEnsure(r.provider);const P=PC[r.provider],row=P&&P.rows&&P.rows.find(y=>String(y.service_id)===String(r.service_id));
      if(!row){miss++;continue}if(row.state==='on'||dfOn(r)){skip++;continue}if(!row.provider)row.provider=r.provider;out.push(row)}
    if(!out.length){toast(miss?'প্রভাইডারের তালিকায় সার্ভিস পাওয়া যায়নি — আগে প্রভাইডার সংগ্রহ করুন':'এগুলো আগে থেকেই সাইটে চালু আছে');return}
    if(skip||miss)toast(bn(out.length)+'টি যোগ হবে'+(skip?' · '+bn(skip)+'টি আগে থেকেই সাইটে':'')+(miss?' · '+bn(miss)+'টি পাওয়া যায়নি':''));
    addNoRf=true;addList(out);
  }catch(e){addNoRf=false;if(!authFail(e))toast(e.message||'সার্ভিস লোড হয়নি')}}
const dfRow=x=>{const r=x.r,t=x.t,on=dfOn(r),sk=dfSk(r),cl=t>0&&t<=1800?'g':t>=21600?'hi':'';return `<div class="spr dfr" data-df="${esc(spKey(r))}" role="button" tabindex="0" aria-label="বিস্তারিত দেখুন"><div><label class="dfl"><input type="checkbox" class="dfck" data-sk="${esc(sk)}" aria-label="নির্বাচন"${DFSEL.has(sk)?' checked':''}${on?' disabled':''}></label><b>${esc((r.name||r.label||('অর্ডার '+r.provider_order)).slice(0,70))}</b>${spBad(r)?' <span class="tag">'+esc(r.status||'Partial')+'</span>':''}<div class="sub">${esc(r.provider)} · সার্ভিস ${esc(r.service_id)} · অর্ডার #${esc(r.provider_order)}</div>${spLinkSub(r)}<div class="sub">${dT(r.ordered_at)} → ${dT(r.completed_at)}</div><div class="ordb">${on?'<span class="sub ok">✔ সাইটে আছে</span>':`<button type="button" class="sm" data-ad="${esc(spKey(r))}">➕ সাইটে যোগ</button>`}</div></div><div class="spv"><b class="${cl}">${t>0?mnT(t):'—'}</b><div class="sub">${r.started_at>0&&r.ordered_at>0?'শুরু '+mnT(r.start_secs>0?r.start_secs:(r.started_at-r.ordered_at)/1000):''}</div></div></div>`};
function dfText(d){const L=['✅ সম্পন্ন টেস্ট — '+(SP.tb?DF_TB.find(b=>b[0]===SP.tb)[1]:'সব সময়')+(SP.cat?' · '+SP.cat:''),'────────────────'];
  d.groups.forEach(g=>{L.push('','■ '+g.c+' ('+bn(g.l.length)+'টি) — সবচেয়ে দ্রুত '+mnT(g.min<1e12?g.min:0)+' · মিডিয়ান '+mnT(g.med));g.l.forEach(x=>L.push('• '+mnT(x.t)+' — '+(x.r.name||x.r.label||'')+' | '+x.r.provider+' #'+x.r.service_id+' (অর্ডার #'+x.r.provider_order+')'+(x.r.link?'\n   🔗 '+x.r.link:'')))});
  L.push('','তৈরি: '+dT(Date.now()));return L.join('\n')}
/* ---------- 🔎 লিংক/নাম/আইডি দিয়ে খোঁজা + চলমান ট্যাবে ক্যাটাগরি-ভাগ ---------- */
const SPCL=new Set();
function spLinkN(u){return String(u||'').trim().toLowerCase().replace(/^https?:\/\//,'').replace(/^(www|m|vm|mobile)\./,'').replace(/[?#].*$/,'').replace(/\/+$/,'')}
function spLinkQ(q){q=String(q||'').trim();return !!q&&!/\s/.test(q)&&(/^https?:\/\//i.test(q)||/\//.test(q)||/^@/.test(q)||/\.[a-z]{2,}(\/|$)/i.test(q))}
function spQMatch(q,r,extra){q=String(q||'').trim();if(!q)return true;
  if(spLinkQ(q)){const a=spLinkN(q),b=spLinkN(r.link);return !!a&&!!b&&(b.indexOf(a)>=0||a.indexOf(b)>=0)}
  return qOK(q,[r.name,r.label,r.provider,r.service_id,r.provider_order,r.link,r.platform,extra].join(' '))}
function spLinkSub(r){if(!r.link)return '';const u=String(r.link);
  return '<div class="sub dflk">🔗 '+(/^https?:\/\//i.test(u)?'<a class="dfk" href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(u.length>46?u.slice(0,44)+'…':u)+'</a>':esc(u.slice(0,46)))+'</div>'}
const SPK_RV='pb_sp_runview',SPK_LT='sp_tg_late_v1';let SPSTM={};
const spRunMode=()=>ls.get(SPK_RV)==='f'?'f':'c';
/* ⚠ দেরি: শুরুর অপেক্ষা = সার্ভিসের স্বাভাবিক শুরুর সময়ের ৩ গুণ (কমপক্ষে ১০ মি.; তথ্য না থাকলে ১৫ মি.); শুরু হওয়ার পর = স্বাভাবিক মোট সময়ের ৩ গুণ (কমপক্ষে ৩০ মি.) */
function spLate(r){if(!r||r._local||spFin(r)||!(r.ordered_at>0))return null;const s=SPSTM[r.provider+'|'+r.service_id]||{},el=(spNow()-r.ordered_at)/1000;
  if(!(r.started_at>0)){const lim=s.start_n>=2&&s.start_med>0?Math.max(600,s.start_med*3):900;return el>lim?{k:'wait',el:el,lim:lim}:null}
  const lim=s.ok>=2&&s.total_med>0?Math.max(1800,s.total_med*3):0;return lim&&el>lim?{k:'run',el:el,lim:lim}:null}
const spLateTag=r=>{const l=spLate(r);return l?'<span class="tag lt">⚠ দেরি'+(l.k==='wait'?' (শুরুতে)':'')+'</span>':''};
function spStm(rows){SPSTM={};spStats(rows).forEach(x=>{SPSTM[x.k]=x})}
function spRunRow(r){const l=spLate(r),st=r.started_at>0,pct=r.quantity&&r.delivered!=null?Math.min(100,Math.round(r.delivered/r.quantity*100)):null;
  return '<div class="spr rcr'+(l?' late':'')+'" data-ro="'+esc(spKey(r))+'" role="button" tabindex="0" aria-label="বিস্তারিত দেখুন"><div><b>'+esc((r.name||r.label||('অর্ডার '+r.provider_order)).slice(0,64))+'</b>'+(l?' '+spLateTag(r):'')+'<div class="sub">'+esc(r.provider)+' · সার্ভিস '+esc(r.service_id)+' · #'+esc(r.provider_order)+'</div>'+spLinkSub(r)+'</div><div class="spv"><b class="'+(l?'hi':'w')+'" data-lvc data-t0="'+(r.ordered_at||0)+'">'+lvT((spNow()-(r.ordered_at||spNow()))/1000)+'</b><div class="sub">'+(st?'▶ চলছে'+(pct!=null?' · '+bn(pct)+'%':''):'⏳ শুরুর অপেক্ষায়')+'</div></div></div>'}
function spRunHtml(list){const f=spFastLearn([]),mode=spRunMode(),late=list.filter(r=>spLate(r));
  if(SP.late&&!late.length)SP.late=false;
  const base=SP.late?late:list,g={};base.forEach(r=>{const c=spCatOf(r,f);(g[c]||(g[c]=[])).push(r)});
  if(SP.rcat&&!g[SP.rcat])SP.rcat='';
  const lt=l=>l.filter(r=>spLate(r)).length,mx=c=>Math.max(...g[c].map(r=>r.ordered_at||0)),cs=Object.keys(g).sort((a,b)=>((lt(g[b])>0)-(lt(g[a])>0))||(mx(b)-mx(a)));
  const top='<div class="chips" style="margin:2px 0 8px"><button type="button" class="chip" data-rv="c" aria-pressed="'+(mode==='c')+'">▤ কম্প্যাক্ট</button><button type="button" class="chip" data-rv="f" aria-pressed="'+(mode==='f')+'">▭ বিস্তারিত</button>'+(late.length?'<button type="button" class="chip lt" data-late aria-pressed="'+SP.late+'">⚠ দেরি <small>'+bn(late.length)+'</small></button>':'')+'</div>';
  const chips=cs.length>1?'<div class="chips" style="margin:2px 0 10px"><button type="button" class="chip" data-rcat="" aria-pressed="'+(!SP.rcat)+'">সব ক্যাটাগরি <small>'+bn(base.length)+'</small></button>'+cs.map(c=>'<button type="button" class="chip" data-rcat="'+esc(c)+'" aria-pressed="'+(SP.rcat===c)+'">'+esc(c)+' <small>'+bn(g[c].length)+'</small></button>').join('')+'</div>':'';
  return top+chips+cs.filter(c=>!SP.rcat||c===SP.rcat).map(c=>{const l=g[c].slice().sort((a,b)=>((spLate(b)?1:0)-(spLate(a)?1:0))||((b.ordered_at||0)-(a.ordered_at||0))),w=l.filter(r=>!(r.started_at>0)).length,n2=lt(l),col=SPCL.has(c);
    return '<div class="rcg"><button type="button" class="dfh rch" data-rc="'+esc(c)+'" aria-expanded="'+(!col)+'"><b>📁 '+esc(c)+'</b><span class="sub">'+bn(l.length)+'টি'+(w?' · ⏳ শুরুর অপেক্ষায় '+bn(w):'')+(l.length-w?' · ▶ চলছে '+bn(l.length-w):'')+(n2?' · <span class="hi">⚠ দেরি '+bn(n2)+'</span>':'')+'</span><span class="rcc">'+(col?'▸':'▾')+'</span></button>'+(col?'':(mode==='c'?l.map(spRunRow).join(''):l.map(spc).join('')))+'</div>'}).join('')}
/* টেলিগ্রামে দেরির সতর্কতা (প্রতি অর্ডারের জন্য একবার; প্রথমবার চালুর সময় আগের দেরিগুলো চুপচাপ ধরে রাখে) */
function spTgLateText(r){const l=spLate(r)||{};return ['⚠️ অর্ডার স্বাভাবিকের চেয়ে দেরিতে','────────────────','প্রভাইডার: '+r.provider,'সার্ভিস: #'+r.service_id+(r.name?' · '+r.name:''),'প্রভাইডার অর্ডার: #'+r.provider_order,'স্ট্যাটাস: '+(r.status||'—'),(l.k==='wait'?'শুরুর অপেক্ষায়: ':'চলছে: ')+lvT(l.el||0)+' (স্বাভাবিক সীমা ~'+mnT(l.lim||0)+')','🔗 লিংক: '+(r.link||'—')].join('\n')}
async function spTgLate(rows){spStm(rows);if(spTgBusy||!tgOn())return;
  let sent=spLoad(SPK_LT);const first=!sent;sent=sent||{};const alive=new Set(rows.filter(r=>!spFin(r)).map(spKey));
  Object.keys(sent).forEach(k=>{if(!alive.has(k))delete sent[k]});
  const todo=[];rows.filter(r=>spLate(r)).forEach(r=>{const k=spKey(r);if(sent[k])return;if(first)sent[k]=1;else todo.push(r)});
  spSave(SPK_LT,sent);if(first||!todo.length)return;spTgBusy=true;
  try{for(const r of todo.slice(0,5)){try{await tgSendMsg(spTgLateText(r))}catch(e){break}sent[spKey(r)]=1;spSave(SPK_LT,sent);await new Promise(z=>setTimeout(z,1100))}}finally{spTgBusy=false}}
/* ---------- 💾 নোট ও সেটিং ব্যাকআপ / ফেরানো (ফাইল, টোকেন ছাড়া) ---------- */
function spNoteBackup(){const f=spFastLearn([]),g=tgCfg(),data={app:'studio-speed',v:1,at:Date.now(),fast:f,th:ls.get(SPK_FT)||'',view:spLoad(SPK_V)||null,tg:{c:g.c,on:ls.get('pb_tg_on')}};
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));a.download='studio-speed-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
  toast('ব্যাকআপ নামানো হয়েছে ('+bn(Object.keys(f.s||{}).length)+'টি সার্ভিস নোট)')}
function spNoteRestore(file,done){const rd=new FileReader();
  rd.onerror=()=>toast('ফাইল পড়া যায়নি');
  rd.onload=()=>{let d=null;try{d=JSON.parse(String(rd.result||''))}catch(_){}
    if(!d||d.app!=='studio-speed'||d.v!==1||!d.fast||typeof d.fast.s!=='object'||typeof d.fast.seen!=='object'){toast('এটা টেস্ট ল্যাবের ব্যাকআপ ফাইল নয়');return}
    const cur=spFastLearn([]);let add=0,upd=0;
    Object.keys(d.fast.s).forEach(k=>{const e=d.fast.s[k];if(!e||!(e.n>0)||!(e.sum>=0))return;const c=cur.s[k];if(!c){cur.s[k]=e;add++}else if(e.n>c.n){cur.s[k]=Object.assign({},e,{cat:c.cat||e.cat});upd++}});
    Object.keys(d.fast.seen).forEach(o=>{cur.seen[o]=1});
    if(!confirm(bn(add)+'টি নতুন সার্ভিস নোট যোগ হবে, '+bn(upd)+'টি হালনাগাদ হবে। এখনকার কিছু মুছবে না। ফেরাবেন?'))return;
    spSave(SPK_F,cur);
    if(d.th!==undefined&&d.th!=='')ls.set(SPK_FT,String(d.th));
    if(d.tg&&d.tg.c&&!ls.get('pb_tg_chat'))ls.set('pb_tg_chat',String(d.tg.c));
    toast('ব্যাকআপ ফেরানো হয়েছে ✔');if(done)done()};
  rd.readAsText(file)}
async function spd(){
  cur=null;$('#title').textContent='টেস্ট ল্যাব';$('#back').hidden=true;const el=$('#main'),my=rid;
  el.innerHTML='<div class="lab">'+nav('spd')+'<div class="lab-hd"><div class="lab-ti"><span class="lab-ic" aria-hidden="true">🧪</span><div><b>প্রভাইডারের আসল গতি</b><span class="sub" id="spn" role="status">লাইভ যাচাই · নিজে নিজে মেলে</span></div></div><button type="button" class="btn lab-rf" id="sprf">↻ মেলান</button></div><div id="spb"><div class="sk"></div></div></div>';
  let D=null,rowsAll=[],SPALL=false;
  const tick=()=>{if(my!==rid){clearInterval(spTk);return}const n=spNow();document.querySelectorAll('[data-lv]').forEach(x=>{const t0=+x.dataset.t0;if(t0)x.textContent=lvT((n-t0)/1000)+(x.dataset.lv==='wait'?' ধরে অপেক্ষা':' হলো')});document.querySelectorAll('[data-lvc]').forEach(x=>{const t0=+x.dataset.t0;if(t0)x.textContent=lvT((n-t0)/1000)});const c=$('#spclk');if(c)c.textContent=new Date(n).toLocaleTimeString('bn-BD',{timeZone:'Asia/Dhaka',hour:'numeric',minute:'2-digit',second:'2-digit'})};
  clearInterval(spTk);spTk=setInterval(tick,1000);
  const draw=()=>{const b=$('#spb');if(!D||!b)return;if(SP.prov&&!rowsAll.some(r=>r.provider===SP.prov))SP.prov='';spSaveView();const ae=document.activeElement,hq=!!ae&&(ae.id==='dfq'||ae.id==='spq'),hid=hq?ae.id:'',cp=hq?ae.selectionStart:0;
    const rows=rowsAll,provs=[...new Set(rows.map(r=>r.provider))].sort(),
      cnt={run:rows.filter(r=>!spFin(r)).length,wait:rows.filter(r=>!spFin(r)&&!(r.started_at>0)).length,ok:rows.filter(r=>spFin(r)&&!spCan(r)).length,bad:rows.filter(spCan).length},
      stOk=r=>SP.st==='all'||SP.st==='note'||(SP.st==='run'?!spFin(r):SP.st==='can'?spCan(r):spFin(r)&&!spCan(r)),isAll=SP.st==='all',isNote=SP.st==='note',FN=spFastList(spFastLearn([]),SP.prov),NG=FN.reduce((g,e)=>((g[e.cat]||(g[e.cat]=[])).push(e),g),{}),show=(isAll||isNote)?[]:rows.filter(r=>(!SP.prov||r.provider===SP.prov)&&stOk(r)),
      S=spStats(rows.filter(r=>(!SP.prov||r.provider===SP.prov)&&stOk(r))).filter(s=>s.n).sort((a,b2)=>((b2.start_n>0)-(a.start_n>0))||((a.start_med||1e12)-(b2.start_med||1e12))).slice(0,10),nm={};
    rows.forEach(r=>{const k=r.provider+'|'+r.service_id;if(r.name&&!nm[k])nm[k]=r.name});const BS=spBest(spStats(rows),nm),TR=spTrend(rows);
    spStm(rows);
    const qs=()=>String(SP.q||'').trim(),FF=spFastLearn([]),mt=r=>spQMatch(SP.q,r,spCatOf(r,FF));
    const listHtml=()=>{
      if(isAll){if(!qs())return '<div class="card empty">অর্ডার দেখতে ⏳ চলমান ('+bn(cnt.run)+'), ✅ শেষ ('+bn(cnt.ok)+') বা 🚫 ক্যান্সেল ('+bn(cnt.bad)+') ট্যাব চাপুন — অথবা উপরের বক্সে লিংক/নাম লিখে সব অর্ডারে খুঁজুন।</div>';
        const L=rows.filter(r=>(!SP.prov||r.provider===SP.prov)&&mt(r));
        return L.length?'<div class="sub" style="margin:4px 2px 8px">'+bn(L.length)+'টি অর্ডার পাওয়া গেছে'+(L.length>60?' · প্রথম ৬০টি দেখানো হলো':'')+'</div>'+L.slice(0,60).map(spc).join(''):'<div class="card empty">“'+esc(qs())+'” দিয়ে কোনো অর্ডার পাওয়া যায়নি।</div>'}
      const L=show.filter(mt);
      if(!L.length)return '<div class="card empty">'+(qs()?'“'+esc(qs())+'” দিয়ে কোনো অর্ডার পাওয়া যায়নি।':rows.length?(SP.st==='run'?'এখন কোনো চলমান অর্ডার নেই।':SP.st==='can'?'কোনো ক্যান্সেল অর্ডার নেই।':'এখনো কোনো শেষ হওয়া অর্ডার নেই।'):'স্টুডিও থেকে দেওয়া কোনো অর্ডার নেই। \'সেরা\' পাতা থেকে টেস্ট অর্ডার দিন।')+'</div>';
      return (qs()?'<div class="sub" style="margin:4px 2px 8px">'+bn(L.length)+'টি অর্ডার পাওয়া গেছে</div>':'')+(SP.st==='run'?spRunHtml(L):L.map(spc).join(''))};
    const rcOpen=k=>{const r=rows.find(y=>spKey(y)===k);if(!r)return;let d=$('#dfD');if(!d){d=document.createElement('dialog');d.id='dfD';d.className='svd';document.body.appendChild(d)}
      d.innerHTML='<div class="svl">'+spc(r)+'</div><div class="acts"><button type="button" class="btn" id="dfX">বন্ধ</button></div>';
      d.querySelectorAll('[data-rep]').forEach(x=>x.onclick=()=>spRepDlg(spReport(r),'📄 অর্ডার #'+r.provider_order));d.querySelectorAll('[data-tg]').forEach(x=>x.onclick=()=>spTgManual(r));d.querySelectorAll('[data-add]').forEach(x=>x.onclick=()=>spAddSite(r));
      $('#dfX').onclick=()=>d.close();d.showModal();tick()};
    const wireCards=root=>{root.querySelectorAll('[data-rep]').forEach(x=>x.onclick=()=>{const r=rows.find(y=>spKey(y)===x.dataset.rep);if(r)spRepDlg(spReport(r),'📄 অর্ডার #'+r.provider_order)});root.querySelectorAll('[data-tg]').forEach(x=>x.onclick=()=>{const r=rows.find(y=>spKey(y)===x.dataset.tg);if(r)spTgManual(r)});root.querySelectorAll('[data-add]').forEach(x=>x.onclick=()=>{const r=rows.find(y=>spKey(y)===x.dataset.add);if(r)spAddSite(r)});
      root.querySelectorAll('[data-rc]').forEach(x=>x.onclick=()=>{const c=x.dataset.rc;SPCL.has(c)?SPCL.delete(c):SPCL.add(c);draw()});root.querySelectorAll('[data-rcat]').forEach(x=>x.onclick=()=>{SP.rcat=x.dataset.rcat;draw()});
      root.querySelectorAll('[data-rv]').forEach(x=>x.onclick=()=>{ls.set(SPK_RV,x.dataset.rv);draw()});root.querySelectorAll('[data-late]').forEach(x=>x.onclick=()=>{SP.late=!SP.late;draw()});
      root.querySelectorAll('.rcr .dfk').forEach(x=>x.addEventListener('click',e=>e.stopPropagation()));
      root.querySelectorAll('[data-ro]').forEach(x=>{x.onclick=()=>rcOpen(x.dataset.ro);x.onkeydown=e=>{if(e.target!==x)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();rcOpen(x.dataset.ro)}}})};
    b.innerHTML=`<div class="card lvb lab-hero"><div class="lvh"><span class="tag lv"><i class="dot"></i>লাইভ</span><b id="spclk"></b></div><div class="lvg"><div class="kp"><i>📦</i><b>${bn(rows.length)}</b><span class="sub">মোট</span></div><div class="kp kp-run"><i>⏳</i><b class="w">${bn(cnt.run)}</b><span class="sub">চলমান</span></div><div class="kp kp-wait"><i>🕓</i><b class="w">${bn(cnt.wait)}</b><span class="sub">অপেক্ষায়</span></div><div class="kp kp-ok"><i>✅</i><b class="g">${bn(cnt.ok)}</b><span class="sub">সম্পন্ন</span></div><div class="kp kp-bad"><i>🚫</i><b class="hi">${bn(cnt.bad)}</b><span class="sub">ক্যান্সেল</span></div></div>${(cnt.ok+cnt.bad)?`<div class="lab-rate"><span class="sub">সফলতার হার</span><b>${bn(Math.round(cnt.ok/(cnt.ok+cnt.bad)*100))}%</b><div class="pbar" aria-hidden="true"><i style="width:${Math.round(cnt.ok/(cnt.ok+cnt.bad)*100)}%"></i></div></div>`:''}${(()=>{const n=rows.filter(r=>spLate(r)).length;return n?'<button type="button" class="lab-late" data-golate>⚠ '+bn(n)+'টি অর্ডার স্বাভাবিকের চেয়ে দেরিতে — দেখুন ›</button>':''})()}</div>
<div class="labtabs" role="group" aria-label="অর্ডারের ধরন">${[['all','সব'],['run','⏳ চলমান'],['done','✅ শেষ'],['can','🚫 ক্যান্সেল'],['note','📝 নোট']].map(x=>`<button type="button" class="chip" data-s="${x[0]}" aria-pressed="${SP.st===x[0]}">${x[1]}${x[0]==='run'?'<i class="cn">'+bn(cnt.run)+'</i>':x[0]==='done'?'<i class="cn">'+bn(cnt.ok)+'</i>':x[0]==='can'?'<i class="cn">'+bn(cnt.bad)+'</i>':x[0]==='note'?'<i class="cn">'+bn(FN.length)+'</i>':''}</button>`).join('')}</div><div class="labtools">${rows.some(spFin)?'<button type="button" class="chip" id="repAll">📊 সব রিপোর্ট</button>':''}<button type="button" class="chip" id="tgSet">✈ টেলিগ্রাম ${tgOn()?'●':'○'}</button></div><div class="labctl"><select id="spp" class="plmore" aria-label="প্রভাইডার"><option value="">সব প্রভাইডার</option>${provs.map(p=>`<option${p===SP.prov?' selected':''}>${esc(p)}</option>`).join('')}</select>${(SP.st==='done'||isNote)?'':`<div class="bar lab-q"><input id="spq" type="search" placeholder="🔎 লিংক, নাম বা অর্ডার আইডি" value="${esc(SP.q)}" aria-label="খুঁজুন"></div>`}</div>`
    +(isAll?`<div id="spA"${String(SP.q||'').trim()?' hidden':''}>`:'')
    +(isAll&&BS.groups.length?`<div class="card sps"><b>🏆 সেরা প্রভাইডার</b><div class="sub">একই ধরনের সার্ভিস তুলনা করে (শুরু + মোট সময় + ড্রপ)</div>${BS.groups.slice(0,8).map(g=>{const a=g.l[0],pa=a.k.split('|'),b2=g.l[1],pb=b2.k.split('|');return `<div class="spr" data-sv="${esc(a.k)}" role="button" tabindex="0" aria-label="বিস্তারিত দেখুন"><div><b>${esc(g.label)}</b><div class="sub">🏆 ${esc(pa[0])} · #${esc(pa[1])}${a.n<3?' · কম টেস্ট':''}</div><div class="sub">২য়: ${esc(pb[0])} · #${esc(pb[1])} (~${mnT(b2.start_med)})</div></div><div class="spv"><b class="g">~${mnT(a.start_med)}</b><div class="sub">মোট ${a.ok?'~'+mnT(a.total_med):'—'} · ড্রপ ${bn(a.bad)}%</div></div></div>`}).join('')}</div>`:'')
    +(isAll&&TR.length?`<div class="card sps"><b>📈 শুরুর সময়ের ধারা</b><div class="sub">প্রভাইডারভিত্তিক দৈনিক মিডিয়ান (শেষ ১৪ দিন)</div>${TR.map(t=>{const a=t.pts[0],z=t.pts[t.pts.length-1],up=z>a*1.15,dn=z<a*.85;return `<div class="spr"><div><b>${esc(t.p)}</b><div class="sub">${bn(t.pts.length)} দিনের তথ্য</div></div><div class="spv"><span class="spkw ${up?'hi':dn?'g':''}">${spSpark(t.pts,110,28)}</span><div class="sub">~${mnT(a)} → ~${mnT(z)}${up?' 🔺 ধীর':dn?' 🔻 দ্রুত':''}</div></div></div>`}).join('')}</div>`:'')
    +(isAll&&S.length?`<div class="card sps"><b>শুরুর গতি — দ্রুত আগে</b>${S.map(s=>{const p=s.k.split('|');return `<div class="spr" data-sv="${esc(s.k)}" role="button" tabindex="0" aria-label="বিস্তারিত দেখুন"><div><b>${esc(p[0])}</b> · #${esc(p[1])}${BS.by[s.k]?' <span class="bst">🏆 সেরা</span>':''}<div class="sub">${esc((nm[s.k]||'').slice(0,60))}</div></div><div class="spv"><b class="${s.start_n?'g':''}">${s.start_n?'~'+mnT(s.start_med):'শুরু হয়নি'}</b><div class="sub">মোট ${s.ok?'~'+mnT(s.total_med):'—'} · ড্রপ ${bn(s.bad)}% · টেস্ট ${bn(s.n)}টি</div></div></div>`}).join('')}</div>`:'')
    +(isAll?'</div>':'')
    +(isNote?`<div class="card sps"><b>📝 দ্রুত সম্পন্ন সার্ভিসের নোট</b><div class="sub">${isFinite(spFastTh())?'গড় মোট সময় '+mnT(spFastTh())+' বা কম':'সব সম্পন্ন সার্ভিস'} · ক্যাটাগরি অনুযায়ী, দ্রুত আগে · সম্পন্ন হওয়া অর্ডার থেকে নিজে জমা হয়</div><div class="chips" style="margin:8px 0"><button type="button" class="chip" data-th="all" aria-pressed="${!isFinite(spFastTh())}">সব সম্পন্ন</button>${[600,1800,3600].map(v=>`<button type="button" class="chip" data-th="${v}" aria-pressed="${spFastTh()===v}">≤ ${mnT(v)}</button>`).join('')}</div>${FN.length?Object.keys(NG).map(c=>`<div class="acts" style="justify-content:space-between;align-items:center;margin-top:14px"><b>📁 ${esc(c)} <span class="sub">· ${bn(NG[c].length)}টি</span></b><span><button type="button" class="sm" data-ce="${esc(c)}">✎ এডিট</button> <button type="button" class="sm dng" data-cd="${esc(c)}">🗑 ডিলেট</button></span></div>${NG[c].map(e=>`<div><div class="spr" data-sv="${esc(e.k)}" role="button" tabindex="0" aria-label="বিস্তারিত দেখুন"><div><b>#${esc(e.code)}</b> · ${esc((e.name||'—').slice(0,70))}<div class="sub">প্রভাইডার: ${esc(e.prov)}</div></div><div class="spv"><b class="g">~${mnT(e.avg)}</b><div class="sub">${bn(e.n)}টি অর্ডার · সবচেয়ে দ্রুত ${mnT(e.min)}</div></div></div><div class="acts"><button type="button" class="sm" data-mv="${esc(e.k)}">↦ ক্যাটাগরি বদলান</button></div></div>`).join('')}`).join(''):'<div class="sub">এখনো কোনো দ্রুত সার্ভিস নেই — টেস্ট ল্যাবের অর্ডার সম্পন্ন হলে এখানে জমা হবে।</div>'}${FN.length?'<div class="acts"><button type="button" class="sm" id="fnCp">📋 নোট কপি / শেয়ার</button><button type="button" class="sm" id="fnDel">🗑 নোট মুছুন</button></div>':''}<div class="acts"><button type="button" class="sm" id="fnBk">💾 ব্যাকআপ নামান</button><button type="button" class="sm" id="fnRs">📥 ব্যাকআপ ফেরান</button><input type="file" id="fnFile" accept=".json,application/json" hidden></div><div class="sub">ব্যাকআপে নোট ও এই পাতার সেটিং থাকে। টেলিগ্রাম বট-টোকেন থাকে না। ফেরানোর সময় এখনকার নোট মোছে না — দুটো মিলিয়ে নেয়।</div></div>`:'')
    +(isNote?'':SP.st==='done'?dfShell():'<div id="spR">'+listHtml()+'</div>')
    +(D.total>(D.rows||[]).length?'<div class="card sps"><div class="sub">'+bn((D.rows||[]).length)+'টি অর্ডার লোড হয়েছে — সার্ভারে মোট '+bn(D.total)+'টি।'+(SPALL?' (সর্বোচ্চ সীমায় পৌঁছেছে)':'')+'</div>'+(SPALL?'':'<div class="acts"><button type="button" class="btn" id="spMore" style="max-width:260px">📥 সব পুরোনো অর্ডারও লোড করুন</button></div>')+'</div>':'')
    +'<p class="sub">শুধু স্টুডিও থেকে দেওয়া অর্ডার এখানে আসে। সময় প্রতি সেকেন্ডে চলে; চলমান অর্ডার থাকলে প্রতি ২০ সেকেন্ডে প্রভাইডার থেকে স্ট্যাটাস মেলে (শুরুর সময় ±২০ সেকেন্ড হতে পারে)।</p>';
    b.querySelectorAll('[data-s]').forEach(x=>x.onclick=()=>{SP.st=x.dataset.s;draw()});const gl=b.querySelector('[data-golate]');if(gl)gl.onclick=()=>{SP.st='run';SP.late=true;SP.q='';SP.rcat='';draw()};$('#spp').onchange=e=>{SP.prov=e.target.value;draw()};
    const ra=$('#repAll');if(ra)ra.onclick=()=>spRepDlg(spReportAll(rows),'📊 সব রিপোর্ট');$('#tgSet').onclick=spTgDlg;
    b.querySelectorAll('[data-th]').forEach(x=>x.onclick=()=>{ls.set(SPK_FT,x.dataset.th);draw()});
    const fc=$('#fnCp');if(fc)fc.onclick=()=>spRepDlg(spFastText(FN,spFastTh()),'📝 দ্রুত সার্ভিস নোট');
    const ml=$('#spMore');if(ml)ml.onclick=()=>{ml.disabled=true;ml.textContent='লোড হচ্ছে…';load(false,false,true)};
    const fbk=$('#fnBk');if(fbk)fbk.onclick=spNoteBackup;const frs=$('#fnRs'),ffl=$('#fnFile');if(frs&&ffl){frs.onclick=()=>ffl.click();ffl.onchange=()=>{const f=ffl.files&&ffl.files[0];if(f)spNoteRestore(f,draw);ffl.value=''}}
    const fd=$('#fnDel');if(fd)fd.onclick=()=>{if(confirm('সব নোট মুছে ফেলবেন?')){const f=spFastLearn([]);spSave(SPK_F,{seen:f.seen,s:{}});draw()}};
    b.querySelectorAll('[data-ce]').forEach(x=>x.onclick=()=>{const c=x.dataset.ce,n=(prompt('ক্যাটাগরির নতুন নাম',c)||'').trim();if(!n||n===c)return;const f=spFastLearn([]);Object.keys(f.s).forEach(k=>{const e=f.s[k];if((e.cat||spCatAuto(e))===c)e.cat=n});spSave(SPK_F,f);draw()});
    b.querySelectorAll('[data-cd]').forEach(x=>x.onclick=()=>{const c=x.dataset.cd,f=spFastLearn([]),ks=Object.keys(f.s).filter(k=>(f.s[k].cat||spCatAuto(f.s[k]))===c);if(!confirm('"'+c+'" ক্যাটাগরি ও এর '+bn(ks.length)+'টি নোট মুছে ফেলবেন?'))return;ks.forEach(k=>delete f.s[k]);spSave(SPK_F,f);draw()});
    b.querySelectorAll('[data-mv]').forEach(x=>x.onclick=()=>{const f=spFastLearn([]),e=f.s[x.dataset.mv];if(!e)return;const cu=e.cat||spCatAuto(e),n=(prompt('এই সার্ভিসের ক্যাটাগরি (নতুন নামও দিতে পারেন)',cu)||'').trim();if(!n||n===cu)return;e.cat=n;spSave(SPK_F,f);draw()});
    const svD=k=>{const L=rows.filter(r=>r.provider+'|'+r.service_id===k&&(!SP.prov||r.provider===SP.prov)&&stOk(r));if(!L.length)return;let d=$('#svD');if(!d){d=document.createElement('dialog');d.id='svD';d.className='svd';d.setAttribute('aria-labelledby','svT');document.body.appendChild(d)}
      const p=k.split('|'),st=spStats(L)[0];
      d.innerHTML='<h3 id="svT" style="margin:0 0 4px"></h3><div class="sub" id="svS"></div><div id="svC"></div><div class="svl"></div><div class="acts"><button type="button" class="btn" id="svX">বন্ধ</button></div>';
      $('#svT').textContent=p[0]+' · #'+p[1];$('#svS').textContent=(nm[k]||'')+' — '+bn(L.length)+'টি অর্ডার'+(st&&st.start_n?' · শুরু ~'+mnT(st.start_med):'');
      const cp=L.filter(r=>r.started_at>0&&r.start_secs>0&&r.ordered_at>0).sort((x,y)=>x.ordered_at-y.ordered_at).map(r=>r.start_secs);$('#svC').innerHTML=cp.length>=2?'<div class="sub" style="margin-top:6px">শুরুর সময় — পুরোনো → নতুন</div><div class="spkw g">'+spSpark(cp,260,40)+'</div><div class="sub">~'+mnT(cp[0])+' → ~'+mnT(cp[cp.length-1])+'</div>':'';d.querySelector('.svl').innerHTML=L.map(spc).join('');
      d.querySelectorAll('[data-rep]').forEach(x=>x.onclick=()=>{const r=rows.find(y=>spKey(y)===x.dataset.rep);if(r)spRepDlg(spReport(r),'📄 অর্ডার #'+r.provider_order)});d.querySelectorAll('[data-tg]').forEach(x=>x.onclick=()=>{const r=rows.find(y=>spKey(y)===x.dataset.tg);if(r)spTgManual(r)});d.querySelectorAll('[data-add]').forEach(x=>x.onclick=()=>{const r=rows.find(y=>spKey(y)===x.dataset.add);if(r)spAddSite(r)});
      $('#svX').onclick=()=>d.close();d.showModal();tick()};
    b.querySelectorAll('[data-sv]').forEach(x=>{x.onclick=()=>svD(x.dataset.sv);x.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();svD(x.dataset.sv)}}});
    b.querySelectorAll('[data-rep]').forEach(x=>x.onclick=()=>{const r=rows.find(y=>spKey(y)===x.dataset.rep);if(r)spRepDlg(spReport(r),'📄 অর্ডার #'+r.provider_order)});b.querySelectorAll('[data-tg]').forEach(x=>x.onclick=()=>{const r=rows.find(y=>spKey(y)===x.dataset.tg);if(r)spTgManual(r)});b.querySelectorAll('[data-add]').forEach(x=>x.onclick=()=>{const r=rows.find(y=>spKey(y)===x.dataset.add);if(r)spAddSite(r)});
    const sq=$('#spq');if(sq){sq.oninput=e=>{SP.q=e.target.value;const sa=$('#spA');if(sa)sa.hidden=!!qs();const rr2=$('#spR');if(rr2){rr2.innerHTML=listHtml();wireCards(rr2);tick()}};if(hq&&hid==='spq'){sq.focus();try{sq.setSelectionRange(cp,cp)}catch(_){}}}
    wireCards(b);
    if(SP.st==='done'){
      const dfOpen=k=>{const r=rows.find(y=>spKey(y)===k);if(!r)return;let d=$('#dfD');if(!d){d=document.createElement('dialog');d.id='dfD';d.className='svd';document.body.appendChild(d)}
        d.innerHTML='<div class="svl">'+spc(r)+'</div><div class="acts"><button type="button" class="btn" id="dfX">বন্ধ</button></div>';
        d.querySelectorAll('[data-rep]').forEach(x=>x.onclick=()=>spRepDlg(spReport(r),'📄 অর্ডার #'+r.provider_order));d.querySelectorAll('[data-tg]').forEach(x=>x.onclick=()=>spTgManual(r));d.querySelectorAll('[data-add]').forEach(x=>x.onclick=()=>spAddSite(r));
        $('#dfX').onclick=()=>d.close();d.showModal();tick()};
      const dfDraw=()=>{spSaveView();const D2=dfCalc(show),tb=$('#dfT'),cc=$('#dfC'),rr=$('#dfR');if(!tb||!cc||!rr)return;
        tb.innerHTML=DF_TB.map(x=>`<button type="button" class="chip" data-tb="${x[0]}" aria-pressed="${SP.tb===x[0]}">${x[1]} <small>${bn(D2.tbN[x[0]]||0)}</small></button>`).join('');
        const ck=Object.keys(D2.cats);if(SP.cat&&!D2.cats[SP.cat])ck.push(SP.cat);ck.sort((a,b2)=>(D2.cats[b2]||0)-(D2.cats[a]||0)||a.localeCompare(b2));
        cc.innerHTML='<button type="button" class="chip" data-dc="" aria-pressed="'+(!SP.cat)+'">সব ক্যাটাগরি <small>'+bn(Object.keys(D2.cats).reduce((n,k)=>n+D2.cats[k],0))+'</small></button>'+ck.map(c=>`<button type="button" class="chip" data-dc="${esc(c)}" aria-pressed="${SP.cat===c}">${esc(c)} <small>${bn(D2.cats[c]||0)}</small></button>`).join('');
        rr.innerHTML=D2.list.length?`<div class="sub" style="margin:4px 2px 8px">${bn(D2.list.length)}টি অর্ডার পাওয়া গেছে${SP.tb?' · '+DF_TB.find(x=>x[0]===SP.tb)[1]+' এর মধ্যে':''}</div>`+D2.groups.map(g=>`<div class="card sps dfg"><div class="dfh"><b>${esc(g.c)}</b><span class="sub">${bn(g.l.length)}টি${g.min<1e12?' · সবচেয়ে দ্রুত <b class="g">'+mnT(g.min)+'</b>':''}${g.med>0?' · মিডিয়ান '+mnT(g.med):''}</span><button type="button" class="sm" data-ga="${esc(g.c)}">➕ সব যোগ</button></div>${g.l.map(dfRow).join('')}</div>`).join(''):'<div class="card empty">'+(show.length?'এই ফিল্টারে কোনো অর্ডার নেই — সময় বা ক্যাটাগরি বদলে দেখুন।':'এখনো কোনো শেষ হওয়া অর্ডার নেই।')+'</div>';
        tb.querySelectorAll('[data-tb]').forEach(x=>x.onclick=()=>{SP.tb=+x.dataset.tb;dfDraw()});cc.querySelectorAll('[data-dc]').forEach(x=>x.onclick=()=>{SP.cat=x.dataset.dc;dfDraw()});
        const bar=()=>{const bx=$('#dfB');if(!bx)return;const n=[...DFSEL].length;bx.hidden=!n;bx.innerHTML=n?`<b>${bn(n)}টি নির্বাচিত</b> <button type="button" class="btn" id="dfAdd" style="max-width:220px">➕ সাইটে যোগ করুন</button> <button type="button" class="sm" id="dfClr">বাতিল</button>`:'';
          const a=$('#dfAdd');if(a)a.onclick=()=>spAddMany(D2.list.map(x=>x.r).filter(r=>DFSEL.has(dfSk(r))));const c=$('#dfClr');if(c)c.onclick=()=>{DFSEL.clear();dfDraw()}};bar();
        rr.querySelectorAll('.dfl,.dfck,.dfk,[data-ad]').forEach(x=>x.addEventListener('click',e=>e.stopPropagation()));
        rr.querySelectorAll('.dfck').forEach(x=>x.onchange=()=>{x.checked?DFSEL.add(x.dataset.sk):DFSEL.delete(x.dataset.sk);bar()});
        rr.querySelectorAll('[data-ad]').forEach(x=>x.onclick=e=>{e.stopPropagation();const r=rows.find(y=>spKey(y)===x.dataset.ad);if(r)spAddMany([r])});
        rr.querySelectorAll('[data-ga]').forEach(x=>x.onclick=()=>{const g=D2.groups.find(y=>y.c===x.dataset.ga);if(g)spAddMany(g.l.map(y=>y.r))});
        rr.querySelectorAll('[data-df]').forEach(x=>{x.onclick=()=>dfOpen(x.dataset.df);x.onkeydown=e=>{if(e.target!==x)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();dfOpen(x.dataset.df)}}});
        const cb=$('#dfCp');if(cb)cb.onclick=()=>spRepDlg(dfText(D2),'📄 সম্পন্ন টেস্টের তালিকা')};
      $('#dfq').oninput=e=>{SP.q=e.target.value;dfDraw()};$('#dfS').onchange=e=>{SP.so=e.target.value;dfDraw()};dfDraw();
      if(hq){const i=$('#dfq');if(i){i.focus();try{i.setSelectionRange(cp,cp)}catch(_){}}}
    }
    tick()};
  const load=async(refresh,quiet,full)=>{const b=$('#sprf'),n=$('#spn');if(!b)return;if(!quiet){b.disabled=true;n.textContent=refresh?'প্রভাইডার থেকে স্ট্যাটাস মেলানো হচ্ছে…':'লোড হচ্ছে…'}
    try{let d=await api('svc_spd',full?{refresh:!!refresh,all:true}:{refresh:!!refresh,limit:300});if(my!==rid)return;
    if(full)SPALL=true;else if(SPALL&&D&&D.rows){const mp=new Map(D.rows.map(r=>[spKey(r),r]));(d.rows||[]).forEach(r=>mp.set(spKey(r),r));d=Object.assign({},d,{rows:[...mp.values()]})}
    D=d;if(d.now)SPoff=d.now-Date.now();rowsAll=spRows(d);spNotify(rowsAll,false);spFastLearn(rowsAll);spTgRun(rowsAll);spTgLate(rowsAll);draw();const n2=$('#spn');if(n2)n2.textContent=(refresh?'মেলানো হয়েছে · ':'')+'হালনাগাদ '+dT(spNow())}
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
function route(){rid++;const h=decodeURIComponent(location.hash.replace('#',''));const bb=$('#bulk');if(bb)bb.hidden=true;sel.clear();ssel.clear();if(h==='exc')exc();else if(h==='cmp')cmp();else if(h==='chg')chg();else if(h==='tidy')tidy();else if(h==='plat')plat();else if(h==='mng')mng();else if(h==='poster')poster();else if(h==='best')best();else if(h==='spd')spd();else if(h==='dash'&&window.StudioDASH){cur=null;window.StudioDASH.mount({api,esc,bn,toast,authFail})}else if(h==='bk'&&window.StudioBK){cur=null;window.StudioBK.mount({api,esc,bn,toast,authFail})}else if(h==='guard'&&window.StudioGUARD){cur=null;window.StudioGUARD.mount({api,esc,bn,toast,authFail})}else if(h==='rate'&&window.StudioRATE){cur=null;window.StudioRATE.mount({api,esc,bn,toast,authFail})}else if(h==='bal'&&window.StudioBAL){cur=null;window.StudioBAL.mount({api,esc,bn,toast,authFail})}else if(h==='rt'&&window.StudioRT){cur=null;window.StudioRT.mount({api,esc,bn,toast,authFail})}else if(h==='tq'&&window.StudioTQ){cur=null;window.StudioTQ.mount({api,esc,bn,toast,authFail,mnT,dT,addList,onSite:dfOn})}else if(h==='cats')catsPage();else if(h.indexOf('cat=')===0)catPage(h.slice(4));else if(h.indexOf('pl=')===0)platPage(h.slice(3));else if(h.indexOf('p=')===0){st={q:'',state:'all',cat:'',off:0};provider(h.slice(2))}else home();$('#main').focus({preventScroll:true})}
function show(a){$('#login').hidden=a;$('#app').hidden=!a;aiShow(a)}
function logout(m){token='';Object.keys(PC).forEach(k=>{idb.set('prov_'+k,null);idb.set('csv_'+k,null);idb.set('ex_'+k,null)});RK.forEach(k=>idb.set(k,null));RK=new Set();RCm={};Q=[];idb.set(QK,null);idb.set('rc_keys',null);PC={};CAT=null;idb.set(CATK,null);wipe();ls.del('pb_studio_token');show(false);$('#loginErr').textContent=m||'';$('#tok').value=''}
$('#loginForm').onsubmit=async e=>{e.preventDefault();token=$('#tok').value.trim();const b=e.target.querySelector('button');b.disabled=true;$('#loginErr').textContent='';
  try{await api('svc_providers');ls.set('pb_studio_token',token);show(true);route();setTimeout(()=>bgSync(true),2500)}catch(x){$('#loginErr').textContent=ERR[x.code]||('সংযোগ করা যায়নি — '+x.message)}b.disabled=false};
$('#logout').onclick=()=>logout();$('#back').onclick=()=>{const h=location.hash;location.hash=h.indexOf('#pl=')===0?'plat':h.indexOf('#cat=')===0?'cats':''};
addEventListener('unhandledrejection',ev=>{const e=ev.reason;ev.preventDefault();try{if(authFail(e))return;toast((e&&e.message)||'কিছু একটা ভুল হয়েছে — আবার চেষ্টা করুন')}catch(_){}});
addEventListener('error',ev=>{try{if(ev&&ev.message&&!/ResizeObserver/.test(ev.message))toast('ছোট একটা সমস্যা হয়েছে — পেজ আবার খুলুন')}catch(_){}});
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
