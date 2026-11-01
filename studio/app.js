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
const ERR={unauthorized:'টোকেন ঠিক নয়',locked_out:'অনেকবার ভুল হয়েছে — কিছুক্ষণ পরে চেষ্টা করুন',no_config:'এই প্রভাইডারের API সেট করা নেই',bad_json:'প্রভাইডার সঠিক উত্তর দেয়নি',provider_error:'প্রভাইডার ত্রুটি দিয়েছে',not_collected:'আগে "সংগ্রহ করুন" চাপুন',code_conflict:'এই আইডি সাইটে অন্য প্রভাইডারের সার্ভিস হিসেবে আছে',previously_removed:'এই সার্ভিস আগে সাইট থেকে বাদ দেওয়া হয়েছিল',category_required:'ক্যাটেগরি দিন',price_required:'দাম দিন',svc_failed:'সার্ভারে সমস্যা হয়েছে'};
const mem={};let rid=0;
function wipe(){for(const k in mem)delete mem[k];for(const k in LSX)delete LSX[k];try{Object.keys(localStorage).filter(k=>k.indexOf('pbc_')===0).forEach(k=>localStorage.removeItem(k))}catch(e){}}
async function api(action,x){
  let r,txt,d;if(/^svc_(toggle|bulk|collect|site_edit|site_hide|site_bulk|tidy_apply|auto)$/.test(action))wipe();
  const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),60000);
  try{r=await fetch(API,{method:'POST',mode:'cors',signal:ac.signal,headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({action,token},x||{}))});txt=await r.text();clearTimeout(tm)}
  catch(ex){clearTimeout(tm);const e=new Error(ex&&ex.name==='AbortError'?'সার্ভার সাড়া দিচ্ছে না (৬০ সেকেন্ড) — আবার চেষ্টা করুন':'নেটওয়ার্ক/CORS ত্রুটি: '+(ex&&ex.message||ex));e.code='net';throw e}
  try{d=JSON.parse(txt)}
  catch(ex){const e=new Error('সার্ভার JSON দেয়নি (HTTP '+r.status+'): '+String(txt).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,140));e.code='not_json';throw e}
  if(!d||!d.ok){const e=new Error((d&&(d.message||ERR[d.error]||d.error))||'failed');e.code=d&&d.error;e.data=d;throw e}return d;
}
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
const nav=a=>`<div class="chips" role="navigation">${[['','প্রভাইডার'],['plat','প্ল্যাটফর্ম'],['mng','ম্যানেজ'],['cats','ক্যাটেগরি'],['cmp','তুলনা'],['chg','পরিবর্তন'],['tidy','সাজান']].map(x=>`<a class="chip" href="#${x[0]}" aria-current="${a===x[0]}">${x[1]}</a>`).join('')}</div>`;
/* ---------- ফোনে CSV (IndexedDB): প্রভাইডারের সব সার্ভিস ফাইল নেমে গেলে তালিকা/খোঁজা/ফিল্টার সেখান থেকেই চলে ---------- */
const svPLAT = [
  ["Instagram", "instagram", /insta|\big\b/i], ["Facebook", "facebook", /facebook|\bfb\b/i], ["TikTok", "tiktok", /tik.?tok/i],
  ["YouTube", "youtube", /youtube|\byt\b/i], ["Telegram", "telegram", /telegram|\btg\b/i], ["Twitter / X", "twitter", /twitter|\bx\b|tweet/i],
  ["WhatsApp", "whatsapp", /whatsapp/i], ["Threads", "other", /threads/i], ["Spotify", "other", /spotify/i], ["LinkedIn", "other", /linkedin/i],
  ["Snapchat", "other", /snap/i], ["Pinterest", "other", /pinterest/i], ["Discord", "other", /discord/i], ["Twitch", "other", /twitch/i],
  ["Website Traffic", "other", /traffic|website|web ?visit/i]
];
const svTYPE = [
  ["Story Views", /story|stories/i], ["Live Views", /\blive\b/i], ["Watch Time", /watch.?(time|hour)/i], ["Subscribers", /subscri/i],
  ["Members", /member|joiner/i], ["Comments", /comment/i], ["Shares", /share|repost|retweet/i], ["Saves", /\bsave|bookmark/i],
  ["Reactions", /reaction|\blove\b|haha|\bwow\b/i], ["Likes", /like|heart/i], ["Views", /view|impression|\breach\b|\bplays?\b|stream|listen/i],
  ["Followers", /follow/i], ["Traffic", /traffic|visit/i]
];
const svSTOP = /^(cheap|cheapest|best|premium|new|special|bulk|hq|vip|server|services?|offer|promo|speed|fast|instant|real|non|usa|global|top|mix|other|others|smm|panel|packages?|all|any|old|updated|hot|sale|quality|high|low|slow|stable|exclusive|limited|test|custom|auto|manual|\d+)$/i;
function svClean(t, keep) {
  var s = String(t || "").replace(/[\u{1F000}-\u{1FFFF}\u{2190}-\u{2BFF}\uFE0F\u200D\u20E3]/gu, " ");
  s = s.replace(/[\[\(\{]([^\]\)\}]*)[\]\)\}]/g, function (m, i) {
    return keep && /\d/.test(i) && /min|hour|hr|day|%|\d\s?[kKmMdDhH]\b/i.test(i) && !/refill|drop/i.test(i) ? " (" + i.trim() + ") " : " ";
  });
  return s.replace(/[|•~*_=#>]+/g, " ").replace(/\s+/g, " ").replace(/^[\s\-–—:.]+|[\s\-–—:.]+$/g, "");
}
function svPick(list, text) {
  for (var i = 0; i < list.length; i++) { var re = list[i][list[i].length - 1]; if (re.test(text)) return list[i]; }
  return null;
}
function svPlatOf(r) {
  var c = String(r.category || ""), n = String(r.name || ""), P = svPick(svPLAT, c) || svPick(svPLAT, n);
  if (P) return P[0];
  var seg = svClean(c).split(/\s[-–—|:\/>»]+\s|[|:»]/)[0].trim(), w = seg.split(/\s+/);
  if (seg.length >= 2 && seg.length <= 24 && w.length <= 2 && !svSTOP.test(w[0]) && !svPick(svTYPE, seg)) return seg.replace(/\b\w/g, function (x) { return x.toUpperCase(); });
  return "Other";
}
function csvParse(t){if(t.charCodeAt(0)===65279)t=t.slice(1);const out=[],n=t.length;let i=0,row=[];
  while(i<n){let f;
    if(t.charCodeAt(i)===34){let j=i+1,s='';for(;;){const k=t.indexOf('"',j);if(k<0){s+=t.slice(j);j=n;break}s+=t.slice(j,k);if(t.charCodeAt(k+1)===34){s+='"';j=k+2}else{j=k+1;break}}f=s;i=j}
    else{let j=i;while(j<n){const x=t.charCodeAt(j);if(x===44||x===10||x===13)break;j++}f=t.slice(i,j);i=j}
    row.push(f);const x=t.charCodeAt(i);
    if(x===44){i++;if(i>=n){row.push('');out.push(row);row=[]}}
    else{if(x===13&&t.charCodeAt(i+1)===10)i++;i++;out.push(row);row=[]}}
  if(row.length)out.push(row);return out}
const IDB={p:null,open(){if(!this.p)this.p=new Promise((ok,no)=>{try{const q=indexedDB.open('pb_studio_csv',1);q.onupgradeneeded=()=>q.result.createObjectStore('csv');q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)}catch(e){no(e)}});return this.p},
  async get(k){try{const db=await this.open();return await new Promise((ok,no)=>{const r=db.transaction('csv').objectStore('csv').get(k);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}catch(e){return null}},
  async set(k,v){try{const db=await this.open();return await new Promise((ok,no)=>{const t=db.transaction('csv','readwrite');t.objectStore('csv').put(v,k);t.oncomplete=()=>ok(true);t.onerror=()=>no(t.error);t.onabort=()=>no(t.error)})}catch(e){return false}}};
const LC={},LSX={};let syncing=false,syncP=null,noEnrich=false;
async function lcMeta(){return(await IDB.get('meta'))||{}}
function lcBuild(p,csv,at){const T=csvParse(csv),h=T.shift()||[],rows=[],cats={},pc={};
  for(const r of T){if(r.length<3)continue;const o={};for(let i=0;i<h.length;i++)o[h[i]]=r[i];if(o.service_id==null||o.service_id==='')continue;
    o._pl=svPlatOf(o);o._s=(o.name+' '+o.service_id+' '+o.category).toLowerCase();rows.push(o);cats[o.category]=(cats[o.category]||0)+1;pc[o._pl]=(pc[o._pl]||0)+1}
  return{provider:p,at,count:rows.length,rows,cats,plats:Object.keys(pc).map(k=>({label:k,n:pc[k]})).sort((a,b)=>b.n-a.n)}}
async function lcLoad(p){if(LC[p])return LC[p];const m=(await lcMeta())[p],v=m&&await IDB.get(p);if(v&&v.csv){LC[p]=lcBuild(p,v.csv,m.at);return LC[p]}return null}
async function lcFetch(p,at){if(at==null){const ps=await api('svc_providers'),q=(ps.providers||[]).find(x=>x.provider===p);at=q?q.collected_at:''}
  const d=await api('svc_csv',{provider:p}),x=lcBuild(p,d.csv,at);LC[p]=x;
  x.saved=await IDB.set(p,{csv:d.csv});if(x.saved){const m=await lcMeta();m[p]={at,count:x.count};await IDB.set('meta',m)}return x}
async function lcEnsure(p){const L=await lcLoad(p);if(L)return L;
  const mn=$('#main');if(mn)mn.innerHTML='<div class="card"><div class="sub" role="status">📥 CSV ফাইল ফোনে নামছে… (প্রথমবার শুধু)</div></div>';
  try{return await lcFetch(p)}catch(e){if(authFail(e))throw e;toast('CSV নামেনি — '+e.message);return null}}
function lcTag(name,text,cls){document.querySelectorAll('[data-lc]').forEach(el=>{if(el.dataset.lc===name){el.textContent=text;el.className='sub'+(cls?' '+cls:'')}})}
const tried={};
async function lcSync(P){syncP=P;if(syncing)return;syncing=true;let refresh=false;
  try{try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
    let snap,got=0,bad=0;do{snap=syncP;const meta=await lcMeta(),L=snap.filter(p=>p.count>0||p.has_api);
      L.forEach(p=>{const m=meta[p.provider];if(p.count>0&&m&&m.at===p.collected_at)lcTag(p.provider,'📥 ফোনে আছে · '+bn(m.count)+'টি','ok')});
      for(let i=0;i<L.length;i++){const p=L[i],m=meta[p.provider];let at=p.collected_at;
        if(p.count>0&&m&&m.at===at)continue;
        const pg=$('#prog');if(pg)pg.textContent=`📥 ${bn(i+1)}/${bn(L.length)} — ${p.provider}`;
        try{
          if(!(p.count>0)){if(tried[p.provider])continue;tried[p.provider]=1;lcTag(p.provider,'⏳ প্রথমবার সংগ্রহ হচ্ছে…');const r=await api('svc_collect',{provider:p.provider});at=r.collected_at;refresh=true}
          lcTag(p.provider,'⏳ CSV নামছে…');
          const x=await lcFetch(p.provider,at);got++;
          if(x.saved===false)lcTag(p.provider,'⚠ ফোনে সেভ হয়নি — এখন চলবে, অ্যাপ বন্ধ করলে আবার নামবে','hi');
          else lcTag(p.provider,'📥 ফোনে আছে · '+bn(x.count)+'টি','ok')}
        catch(e){if(authFail(e))return;bad++;lcTag(p.provider,'⚠ '+e.message+' — "সংগ্রহ" চেপে আবার চেষ্টা করুন','hi')}}
    }while(snap!==syncP);
    const pg=$('#prog');if(pg)pg.textContent=bad?`⚠ ${bn(bad)}টি নামেনি`:'';
    if(got&&!bad)toast(`${bn(got)}টি CSV ফোনে সেভ হয়েছে ✔`)}
  finally{syncing=false}
  if(refresh&&cur===null)home()}
async function lcState(p){const k=LSX[p];if(k&&Date.now()-k.t<120000)return k;
  const d=await api('svc_light',{provider:p}),o={t:Date.now(),on:{},cf:d.cf||{},fx:d.fx,sc:d.site_categories||[]};(d.on||[]).forEach(id=>{o.on[id]=1});LSX[p]=o;return o}
async function lcEnrich(p,rows){if(noEnrich)return;const need=rows.filter(r=>!r._en);if(!need.length)return;
  try{const d=await api('svc_enrich',{provider:p,rows:need.map(r=>({service_id:r.service_id,name:r.name,category:r.category,rate:r.rate,refill:r.refill}))});
    need.forEach(r=>{const x=d.items&&d.items[r.service_id];if(x){r.suggest=x.suggest;r.spd=x.spd;r.tidy=x.tidy}r._en=1})}
  catch(e){if(authFail(e))throw e;if(e.code==='unknown_action')noEnrich=true}}
async function localList(L,p){const S=await lcState(p);
  for(const r of L.rows){const id=r.service_id;if(S.on[id]){r.state='on'}else if(S.cf[id]){r.state='conflict';r.conflict_with=S.cf[id]}else r.state='off'}
  const q=(st.q||'').toLowerCase().trim(),cat=st.cat||'',pf=st.plat||'',fl=st.state||'all',ty=cat?'':(st.type||'');
  const out=L.rows.filter(r=>(!cat||r.category===cat)&&(!pf||r._pl===pf)&&(fl==='all'||r.state===fl)&&(!q||r._s.indexOf(q)>=0)&&(!ty||(r._t||(r._t=typeOf(r.category)))===ty));
  const off=st.off||0,page=out.slice(off,off+50);await lcEnrich(p,page);
  return{ok:true,total:out.length,rows:page,categories:L.cats,site_categories:S.sc,fx:S.fx,platforms:L.plats,next:off+page.length}}
async function getList(p){const L=await lcEnsure(p);
  if(L){try{return await localList(L,p)}catch(e){if(e.code!=='unknown_action')throw e;toast('Apps Script আপডেট করুন (PtServices.gs) — আপাতত সার্ভার থেকে চলছে')}}
  return pageRows('svc_list',{provider:p,q:st.q,state:st.state,category:st.cat,platform:st.plat||''},st.off,50,st.cat?'':(st.type||''))}

/* ---------- হোম: প্রভাইডার তালিকা ---------- */
async function home(){
  $('#title').textContent='সার্ভিস স্টুডিও';$('#back').hidden=true;cur=null;
  const el=$('#main');el.innerHTML='<div class="sk"></div><div class="sk" style="margin-top:12px"></div>';
  try{
    await swr('svc_providers',{},d=>{const P=d.providers||[];
    el.innerHTML=nav('')+'<div class="bar"><button class="btn" id="all" style="max-width:260px">সব প্রভাইডার সংগ্রহ করুন</button><span id="prog" class="mut" role="status"></span></div><div class="list">'+
    (P.length?P.map(p=>`<div class="card pv"><div class="top"><div><b>${esc(p.provider)}</b><div class="sub">${p.collected_at?'সংগ্রহ: '+esc(p.collected_at)+' · '+bn(p.count)+'টি':'এখনো সংগ্রহ হয়নি'}</div><div class="sub" data-lc="${esc(p.provider)}"></div></div>${p.has_api?'':'<span class="tag hi">API নেই</span>'}</div><div class="acts"><button class="sm" data-c="${esc(p.provider)}" ${p.has_api?'':'disabled'}>সংগ্রহ</button><button class="sm" data-o="${esc(p.provider)}" ${p.count?'':'disabled'}>সার্ভিস দেখুন</button></div></div>`).join(''):'<div class="card empty">কোনো প্রভাইডার কনফিগার করা নেই</div>')+'</div>';
    el.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>collect(b.dataset.c,b));
    el.querySelectorAll('[data-o]').forEach(b=>b.onclick=()=>{location.hash='p='+encodeURIComponent(b.dataset.o)});lcSync(P);
    const all=$('#all');if(all)all.onclick=async()=>{all.disabled=true;let ok=0,bad=0;const L=P.filter(p=>p.has_api);for(let i=0;i<L.length;i++){$('#prog').textContent=`${bn(i+1)}/${bn(L.length)} — ${L[i].provider}`;try{await api('svc_collect',{provider:L[i].provider});ok++}catch(e){if(authFail(e))return;bad++}}toast(`সংগ্রহ শেষ: ${bn(ok)} সফল, ${bn(bad)} ব্যর্থ`);home()};
    });}catch(e){if(!authFail(e))el.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p><button class="btn" id="rt" style="max-width:220px">আবার চেষ্টা করুন</button></div>`,$('#rt').onclick=home}
}
async function collect(p,btn){
  btn.disabled=true;btn.textContent='সংগ্রহ চলছে…';
  try{const r=await api('svc_collect',{provider:p});toast(`${p}: ${bn(r.count)}টি সার্ভিস সংগ্রহ হয়েছে`);home()}
  catch(e){if(authFail(e))return;toast(p+': '+e.message);btn.disabled=false;btn.textContent='সংগ্রহ'}
}

/* ---------- প্রভাইডারের সার্ভিস + সুইচ ---------- */
const PLAT=[['instagram',/insta|\big\b/i],['facebook',/facebook|\bfb\b/i],['tiktok',/tik.?tok/i],['youtube',/youtube|\byt\b/i],['telegram',/telegram|\btg\b/i],['twitter',/twitter|\bx\b/i],['whatsapp',/whatsapp/i],['other',/./]];
const guess=s=>(PLAT.find(p=>p[1].test(s))||PLAT[7])[0];
async function provider(p,more){
  cur=p;$('#title').textContent=p;$('#back').hidden=false;const el=$('#main');
  if(!more){st.off=0;sel.clear();bulkBar();el.innerHTML='<div class="sk"></div>'}
  try{
    const d=await getList(p);
    if(!more){lastList=d;
      el.innerHTML=tiles(d.platforms||[],st.plat||'')+`<div class="bar"><input id="q" type="search" placeholder="নাম, আইডি বা ক্যাটেগরি খুঁজুন" value="${esc(st.q)}" aria-label="খুঁজুন"></div><div id="cats">${catUI(catsFor(d.categories,st.plat),st)}</div>
      <div class="chips" role="group" aria-label="অবস্থা">${[['all','সব'],['on','চালু'],['off','বন্ধ'],['conflict','জট']].map(s=>`<button class="chip" data-s="${s[0]}" aria-pressed="${st.state===s[0]}">${s[1]}</button>`).join('')}<button class="chip" id="sa">সব বাছুন</button><button class="chip" id="csv">⤓ CSV</button></div>
      <p class="sub" id="cnt"></p><div class="list" id="rows"></div><div id="moreWrap"></div>`;
      $('#q').oninput=e=>{clearTimeout(qt);qt=setTimeout(()=>{st.q=e.target.value;provider(p)},350)};
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
  }catch(e){if(!authFail(e))el.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p><button class="btn" id="rt" style="max-width:220px">আবার চেষ্টা করুন</button></div>`,$('#rt').onclick=()=>provider(p)}
}
function row(r,d){
  const c=document.createElement('div');c.className='card svc';
  const sg=r.suggest?` · সাইটে ≈ <b>৳${bn(r.suggest.bdt)}</b>`:'';
  c.innerHTML=`<div><h4>${d&&d.cmp?'':'<input type="checkbox" class="sel" aria-label="নির্বাচন">'}${esc(r.name)}</h4><div class="sub">${d&&d.cmp?'<b>'+esc(r.provider)+'</b> · ':''}ID <b>${esc(r.service_id)}</b> · ${esc(r.category)}</div><div class="sub">রেট <b>${esc(r.rate)}</b> · ${bn(r.min)}–${bn(r.max)}${r.refill==='1'?' · Refill':''}${r.cancel==='1'?' · Cancel':''}${sg}</div>${spdTag(r)}${r.tidy&&r.state!=='on'?`<div class="sub ok">সাইটে: ${esc(nice(r)||r.tidy.name)} · ${esc(r.tidy.cat)}</div>`:''}${r.state==='conflict'?`<div class="sub hi">জট: ${esc(r.conflict_with)}-এর সার্ভিস হিসেবে আছে</div>`:''}</div>
  <button class="sw" role="switch" aria-checked="${r.state==='on'}" aria-label="${esc(r.name)} সাইটে চালু/বন্ধ" ${r.state==='conflict'?'disabled':''}></button>`;
  c.querySelector('.sw').onclick=ev=>toggle(r,ev.currentTarget);
  const cb=c.querySelector('.sel');if(cb)cb.onchange=()=>{cb.checked?sel.add(r):sel.delete(r);bulkBar()};
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
function openSheet(r,btn,force){
  const sh=$('#sheet');$('#shN').textContent=`ID ${r.service_id} · রেট ${r.rate} · মূল: ${r.name} | ${r.category}`;
  const t=r.tidy||{};$('#shName').value=nice(r)||t.name||r.name;$('#shCat').value=matchCat(t.cat||r.category);{const sc=$('#shCat');sc.placeholder='ক্যাটেগরি বাছুন বা লিখুন';sc.onfocus=()=>{sc.dataset.prev=sc.value;sc.placeholder=sc.value||sc.placeholder;sc.value=''};sc.onblur=()=>{if(!sc.value.trim())sc.value=sc.dataset.prev||''}}
  $('#shPlat').innerHTML=PLAT.map(p=>`<option>${p[0]}</option>`).join('');$('#shPlat').value=t.plat||guess(r.category+' '+r.name);
  $('#shCats').innerHTML=(window._sc||[]).map(c=>`<option value="${esc(c)}">`).join('');
  $('#shPriceBdt').hidden=true;$('#shPriceUsd').hidden=true;$('#shUsd').value=r.rate;
  $('#shInfo').textContent=`দাম অটো: প্রভাইডার $${r.rate}/1K → সাইটে ≈ ৳${r.suggest?bn(r.suggest.bdt):'?'}/1K (সাইটের মার্কআপ নিয়মে)`;$('#shErr').textContent='';
  sh.onclose=async()=>{
    if(sh.returnValue!=='ok')return;
    busy=true;btn.disabled=true;
    try{await api('svc_toggle',{provider:r.provider||cur,code:r.service_id,on:true,name:$('#shName').value,platform:$('#shPlat').value,category:$('#shCat').value.trim(),price_usd:+$('#shUsd').value,force:!!force});
      r.state='on';btn.setAttribute('aria-checked','true');toast('সাইটে চালু হয়েছে ✔')}
    catch(e){if(authFail(e)){}else if(e.code==='previously_removed'&&confirm(e.message+'\nতবুও চালু করবেন?'))openSheet(r,btn,true);else toast(e.message)}
    busy=false;btn.disabled=false;
  };
  $('#shForm').onsubmit=e=>{const u=+$('#shUsd').value,c=$('#shCat').value.trim();if(e.submitter&&e.submitter.value==='ok'&&!c){e.preventDefault();$('#shErr').textContent='ক্যাটেগরি দিন'}};
  sh.returnValue='';sh.showModal();
}
async function dl(p){
  try{let csv,name='svc_'+p.replace(/[^a-z0-9.-]/gi,'_')+'.csv';const v=await IDB.get(p);if(v&&v.csv)csv=v.csv;else{const d=await api('svc_csv',{provider:p});csv=d.csv;name=d.name}const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
  catch(e){if(!authFail(e))toast(e.message)}
}

/* ---------- বাল্ক ---------- */
function bulkBar(){let b=$('#bulk');if(!b){b=document.createElement('div');b.id='bulk';b.className='bulk';document.body.appendChild(b)}
  b.hidden=!sel.size;b.innerHTML=`<b>${bn(sel.size)}টি বাছাই</b><button class="sm" data-b="on">চালু</button><button class="sm" data-b="off">বন্ধ</button><button class="sm" data-b="x" aria-label="বাতিল">✕</button>`;
  b.querySelectorAll('[data-b]').forEach(x=>x.onclick=()=>bulk(x.dataset.b))}
async function bulk(k){
  if(k==='x'){sel.clear();document.querySelectorAll('.sel').forEach(x=>x.checked=false);return bulkBar()}
  if(busy)return;const codes=[...sel].map(r=>r.service_id),on=k==='on';let cat='',mk='';
  if(on){cat=prompt('ক্যাটেগরি লিখুন, অথবা ফাঁকা রাখুন (ফাঁকা = প্রতিটার নাম ও ক্যাটেগরি অটো সাজানো হবে)','');if(cat===null)return;}
  else if(!confirm(bn(codes.length)+'টি সার্ভিস সাইট থেকে লুকানো হবে?'))return;
  busy=true;try{const r=await api('svc_bulk',{provider:cur,codes,on,category:(cat||'').trim(),markup:mk});
    if(on){const its=[...sel].filter(x=>x.state==='off').map(x=>({code:x.service_id,name:nice(x)||(x.tidy&&x.tidy.name)||x.name,cat:(cat||'').trim()||(x.tidy&&x.tidy.cat)||x.category}));for(const ch of chunks(its,300)){try{await api('svc_tidy_apply',{items:ch})}catch(e){}}}
    toast(`${bn(r.done)}টি হয়েছে, ${bn(r.skipped)}টি বাদ`);sel.clear();bulkBar();provider(cur)}catch(e){if(!authFail(e))toast(e.message)}busy=false}

/* ---------- দাম তুলনা ---------- */
async function cmp(){
  cur=null;$('#title').textContent='দাম তুলনা';$('#back').hidden=true;const el=$('#main');
  el.innerHTML=nav('cmp')+`<div class="bar"><input id="cq" type="search" placeholder="যেমন: instagram followers" value="${esc(cq.q)}" aria-label="খুঁজুন"><button class="chip" id="cr" aria-pressed="${cq.refill}">Refill</button></div><p class="sub" id="cc">কমপক্ষে ২ অক্ষর লিখুন — ১০ প্রভাইডারে খোঁজা হবে, সস্তা আগে</p><div class="list" id="cl"></div>`;
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
    el.innerHTML=nav('chg')+`<div class="card"><b>সাপ্তাহিক অটো-সংগ্রহ</b><div class="sub">${a.on===null?'অবস্থা জানা যায়নি':a.on?'চালু':'বন্ধ'}${a.last?' · শেষ: '+esc(a.last):''}</div><button class="sm" id="au" style="margin-top:8px">${a.on?'বন্ধ করুন':'চালু করুন'}</button></div>`+
    (d.providers.length?d.providers.map(p=>`<div class="card"><b>${esc(p.provider)}</b> <span class="sub">${esc(p.at)}</span><div class="sub">বাদ ${bn(p.c.rm)} · দাম↑ ${bn(p.c.up)} · দাম↓ ${bn(p.c.down)} · নতুন ${bn(p.c.nw)}</div>${p.live_rm||p.live_up?`<div class="sub hi">⚠ চালু সার্ভিসে: বাদ ${bn(p.live_rm)}, দাম↑ ${bn(p.live_up)}</div>`:''}<details><summary>বিস্তারিত</summary>${p.items.map(i=>`<div class="sub ${i.live?'hi':''}">${i.live?'● ':''}<b>${T[i.t]}</b> ${esc(i.id)} · ${esc(i.nm)}${i.t==='up'||i.t==='down'?` · ${i.o} → ${i.n}`:i.t==='new'?` · ${i.n}`:''}</div>`).join('')}</details></div>`).join(''):'<div class="card empty">তুলনার ডেটা নেই — একই প্রভাইডার দুইবার সংগ্রহ করলে পরিবর্তন দেখা যাবে</div>');
    $('#au').onclick=async e=>{e.target.disabled=true;try{await api('svc_auto',{on:!a.on});toast('হয়েছে');chg()}catch(x){if(!authFail(x))toast(x.message);e.target.disabled=false}}
  }catch(e){if(!authFail(e))el.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p></div>`}}

/* ---------- নাম সাজান (সাইটের নিজস্ব ছাঁচে) ---------- */
async function tidy(){
  cur=null;$('#title').textContent='নাম সাজান';$('#back').hidden=true;const el=$('#main');
  el.innerHTML=nav('tidy')+`<div class="card"><b>নামের ছাঁচ</b><div class="sub">ধরন – কোয়ালিটি · দেশ · ড্রপ · রিফিল · স্পিড · স্টার্ট · Max</div><div class="sub ok">যেমন: 👥 Followers – 💎 HQ Real · 🛡️ NoDrop · ♻30D · 🚀 50K/D · ⚡Instant · 📈 Max1M</div><div class="sub">ইমুজি চালু/বন্ধ করা যায় — ক্যাটেগরি পাতায় (🙂 বোতাম)।</div><div class="sub">♻ = রিফিল (দিন) · /D = প্রতিদিন · ⚡ = শুরুর সময়</div><div class="sub">ট্যাগ শুধু প্রভাইডারের নিজের নাম/ক্যাটেগরি থেকে নেওয়া হয় — নিজে থেকে কিছু যোগ হয় না। ক্যাটেগরি বদলায় না।</div><button class="btn" id="tscan" style="margin-top:10px">সাইটের চালু সার্ভিস স্ক্যান করুন</button><p class="sub" id="tprog" role="status"></p></div><div id="tres"></div>`;
  $('#tscan').onclick=async()=>{const b=$('#tscan');b.disabled=true;const R=[];let off=0,tot=1,n=0;
    try{while(off<tot){const d=await api('svc_site_list',{q:'',platform:'',category:'',state:'on',offset:off,limit:100});tot=d.total;if(!d.rows.length)break;
        d.rows.forEach(r=>{n++;const nm=nice(r);if(nm&&nm!==r.name)R.push({code:r.code,cn:r.name,nn:nm,category:r.category,src:r.src,ov:r.ov,on:true})});
        off+=d.rows.length;$('#tprog').textContent=`স্ক্যান: ${bn(off)}/${bn(tot)}`}
      $('#tprog').textContent=`${bn(n)}টি দেখা হয়েছে — ${bn(R.length)}টির নাম বদলাবে`;tidyShow(R)}
    catch(e){if(!authFail(e))$('#tprog').textContent=e.message}b.disabled=false}}
function tidyShow(R){const box=$('#tres');let shown=0;
  if(!R.length){box.innerHTML='<div class="card empty">সব সার্ভিস আগেই এই ছাঁচে সাজানো ✔</div>';return}
  box.innerHTML=`<div class="bar"><button class="btn" id="ta"></button></div><div class="chips"><button class="chip" id="tall">সব বাছুন</button><button class="chip" id="tnone">সব বাদ</button></div><div class="list" id="tl"></div><div id="tm"></div>`;
  const cnt=()=>{const k=R.filter(r=>r.on).length;$('#ta').textContent=`নির্বাচিতগুলো প্রয়োগ করুন (${bn(k)}টি)`;$('#ta').disabled=!k};
  const more=()=>{R.slice(shown,shown+100).forEach(r=>{const l=document.createElement('label');l.className='card tdy';
      l.innerHTML=`<input type="checkbox" class="sel" ${r.on?'checked':''}><div><div class="sub">ID ${esc(r.code)} · ${esc(r.category)}</div><div class="sub">${esc(r.cn)}</div><h4>→ ${esc(r.nn)}</h4></div>`;
      l.querySelector('input').onchange=e=>{r.on=e.target.checked;cnt()};$('#tl').appendChild(l)});
    shown=Math.min(R.length,shown+100);$('#tm').innerHTML=shown<R.length?`<button class="sm" id="tmb" style="width:100%;margin-top:8px">আরও দেখান (${bn(R.length-shown)}টি বাকি)</button>`:'';const m=$('#tmb');if(m)m.onclick=more};
  more();cnt();
  $('#tall').onclick=()=>{R.forEach(r=>r.on=true);$('#tl').innerHTML='';shown=0;more();cnt()};
  $('#tnone').onclick=()=>{R.forEach(r=>r.on=false);$('#tl').innerHTML='';shown=0;more();cnt()};
  $('#ta').onclick=async()=>{const it=R.filter(r=>r.on);if(!it.length||busy||!confirm(bn(it.length)+'টি সার্ভিসের নাম বদলানো হবে?'))return;busy=true;$('#ta').disabled=true;
    try{const need=it.filter(r=>r.src==='static'&&!r.ov).map(r=>r.code);let i=0;
      for(const c of chunks(need,200)){$('#tprog').textContent='প্রস্তুত হচ্ছে… '+bn(Math.min(need.length,(++i)*200))+'/'+bn(need.length);await api('svc_site_bulk',{codes:c})}
      let done=0,k=0;for(const c of chunks(it.map(r=>({code:r.code,name:r.nn,cat:r.category})),300)){$('#tprog').textContent='নাম বসানো হচ্ছে… '+bn(Math.min(it.length,(++k)*300))+'/'+bn(it.length);const x=await api('svc_tidy_apply',{items:c});done+=x.done}
      toast(bn(done)+'টির নাম সাজানো হয়েছে ✔');busy=false;tidy()}
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
const NP=[['Instagram',/insta|\big\b/i],['Facebook',/facebook|\bfb\b/i],['TikTok',/tik.?tok/i],['YouTube',/youtube|\byt\b/i],['Telegram',/telegram|\btg\b/i],['Twitter / X',/twitter|\bx\b|tweet/i],['WhatsApp',/whatsapp/i],['Threads',/threads/i],['Spotify',/spotify/i],['LinkedIn',/linkedin/i],['Snapchat',/snap/i],['Pinterest',/pinterest/i],['Discord',/discord/i],['Twitch',/twitch/i],['Website Traffic',/traffic|website|web ?visit/i]];
const NT=[['Story Views',/story|stories/i],['Live Views',/\blive\b/i],['Watch Time',/watch.?(time|hour)/i],['Subscribers',/subscri/i],['Members',/member|joiner/i],['Comments',/comment/i],['Shares',/share|repost|retweet/i],['Saves',/\bsave|bookmark/i],['Reactions',/reaction|\blove\b|haha|\bwow\b/i],['Likes',/like|heart/i],['Views',/view|impression|\breach\b|\bplays?\b|stream|listen/i],['Followers',/follow/i],['Traffic',/traffic|visit/i]];
const pick=(L,t)=>L.find(x=>x[1].test(t));
const CTRY={usa:'USA',uk:'UK',india:'India',indian:'India',bangladesh:'BD',bd:'BD',turkey:'Turkey',turkish:'Turkey',brazil:'Brazil',brazilian:'Brazil',arab:'Arab',arabic:'Arab',indonesia:'Indonesia',pakistan:'Pakistan',russia:'Russia',germany:'Germany',france:'France',spain:'Spain',italy:'Italy',global:'Worldwide',worldwide:'Worldwide'};
const kfmt=n=>n>=1e6?(+(n/1e6).toFixed(2))+'M':n>=1e3?(+(n/1e3).toFixed(1))+'K':String(n);

/* ---------- ইমুজি দিয়ে সাজানো (চালু/বন্ধ: pb_emo) ---------- */
const emoOn=()=>ls.get('pb_emo')!=='0';
const PE={'Instagram':'📸','Facebook':'📘','TikTok':'🎵','YouTube':'▶️','Telegram':'✈️','Twitter / X':'🐦','WhatsApp':'💬','Threads':'🧵','Spotify':'🎧','LinkedIn':'💼','Snapchat':'👻','Pinterest':'📌','Discord':'🎮','Twitch':'🟣','Website Traffic':'🌐'};
const TE={'Followers':'👥','Likes':'❤️','Views':'👁️','Story Views':'📖','Live Views':'🔴','Watch Time':'⏱️','Subscribers':'🔔','Members':'🙋','Comments':'💬','Shares':'🔁','Saves':'🔖','Reactions':'😍','Traffic':'🚦'};
const FLAG={USA:'🇺🇸',UK:'🇬🇧',India:'🇮🇳',BD:'🇧🇩',Turkey:'🇹🇷',Brazil:'🇧🇷',Arab:'🇸🇦',Indonesia:'🇮🇩',Pakistan:'🇵🇰',Russia:'🇷🇺',Germany:'🇩🇪',France:'🇫🇷',Spain:'🇪🇸',Italy:'🇮🇹',Worldwide:'🌍'};
const TAGE=[[/^HQ Real$/,'💎'],[/^HQ$/,'💎'],[/^Premium$/,'👑'],[/^Real$/,'✅'],[/^Mix$/,'🎲'],[/^LowQ$/,'🔻'],[/^(NoDrop|LowDrop|\d+%Drop)$/,'🛡️'],[/^NoRefill$/,'🚫'],[/^Refill$/,'♻'],[/^[\d.]+[KM]?(-[\d.]+[KM]?)?\/(D|Hr)$/,'🚀'],[/^Max/,'📈'],[/^Fast$/,'⏩']];
const emTag=t=>{if(FLAG[t])return FLAG[t]+' '+t;const x=TAGE.find(a=>a[0].test(t));return x?x[1]+' '+t:t};
const stripEmo=s=>String(s==null?'':s).replace(/^[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D\u20E3\s]+/u,'').trim();
/* ক্যাটেগরির নাম: প্ল্যাটফর্মের ইমুজি + নাম (আগের ইমুজি সরিয়ে একবারই বসে — বারবার চালালে একই থাকে) */
function catNice(cat){const c=stripEmo(cat);if(!c||!emoOn())return c;const P=pick(NP,c),T=pick(NT,c),e=P?PE[P[0]]:(T?TE[T[0]]:'📦');return (e+' '+c).substring(0,80)}
function niceTags(t,flag,max){const o=[];let m;
  const hq=/\bhq\b|high.?quality/i.test(t),pr=/premium/i.test(t),real=/\breal\b|organic|authentic/i.test(t);
  if((hq||pr)&&real)o.push('HQ Real');else if(hq)o.push('HQ');else if(pr)o.push('Premium');else if(real)o.push('Real');else if(/\bmix(ed)?\b/i.test(t))o.push('Mix');else if(/\bbots?\b|low.?quality|\blq\b|lowq/i.test(t))o.push('LowQ');
  m=t.match(/\b(usa|uk|india|indian|bangladesh|bd|turkey|turkish|brazil|brazilian|arab|arabic|indonesia|pakistan|russia|germany|france|spain|italy|global|worldwide)\b/i);if(m)o.push(CTRY[m[1].toLowerCase()]);
  if(/non.?drop|no.?drop|\bnd\b|\b0\s*%\s*drop|zero.?drop/i.test(t))o.push('NoDrop');else if(/low.?drop|less.?drop/i.test(t))o.push('LowDrop');else if(m=t.match(/(\d{1,2})\s*%\s*drop/i))o.push(m[1]+'%Drop');
  if(/\b(no|non|without)[\s\-]?refill\b/i.test(t))o.push('NoRefill');
  else if(/refill|♻|lifetime|\blt\b|\br\d{2,3}\b/i.test(t)||flag===true){m=t.match(/♻\s*(\d{2,3})\s*d\b/i)||t.match(/refill\D{0,12}(\d{2,3})\s*(?:d|days?)\b/i)||t.match(/(\d{2,3})\s*(?:d|days?)\W{0,3}refill/i)||t.match(/\br(\d{2,3})\b/i);
    o.push(m?'♻'+m[1]+'D':/lifetime|\blt\b|♻\s*life/i.test(t)?'♻Life':'Refill')}
  else if(flag===false)o.push('NoRefill');
  m=t.match(/(\d+(?:\.\d+)?\s*[kKmM]?(?:\s*[-–]\s*\d+(?:\.\d+)?\s*[kKmM]?)?)\s*(?:\/|per\s*)\s*(day|d|hour|hr|h)\b/i);
  if(m)o.push(m[1].replace(/\s+/g,'').toUpperCase()+(/^d/i.test(m[2])?'/D':'/Hr'));
  if(/instant/i.test(t))o.push('⚡Instant');
  else if(m=t.match(/(?:start(?:s|ing)?(?:\s*time)?|begins?)\W{0,4}(\d+(?:\s?[-–]\s?\d+)?)\s*(min|hour|hr)/i)||t.match(/⚡\s*(\d+(?:\s?[-–]\s?\d+)?)\s*(min|hour|hr)/i))o.push('⚡'+m[1].replace(/\s+/g,'')+(/^m/i.test(m[2])?'Min':'Hr'));
  else if(/\bfast\b/i.test(t))o.push('Fast');
  max=+max||0;if(max>0)o.push('Max'+kfmt(max));
  return o}
function nice(r){
  if(!r)return null;const c0=String(r.category||''),n0=String(r.name||''),all=c0+' '+n0;
  const P=pick(NP,c0)||pick(NP,n0),T=pick(NT,c0)||pick(NT,n0);if(!T)return null;
  const base=P&&P[0]==='Website Traffic'?'Traffic':T[0];
  const flag=r.refill===undefined||r.refill===null||r.refill===''?null:String(r.refill)==='1'||r.refill===true;
  let tg=niceTags(all,flag,r.max),nm;const em=emoOn();if(em)tg=tg.map(emTag);
  const pre=em&&TE[base]?TE[base]+' ':'';
  do{nm=pre+base+(tg.length?' – '+tg.join(' · '):'');if(nm.length<=(em?100:64))break;tg.pop()}while(tg.length);
  return nm.substring(0,120)}

/* ---------- প্ল্যাটফর্ম হাব ---------- */
let ps={q:'',type:'',state:'all',off:0};
async function plat(){
  cur=null;$('#title').textContent='প্ল্যাটফর্ম';$('#back').hidden=true;const el=$('#main');el.innerHTML=nav('plat')+'<div class="sk"></div>';
  try{await swr('svc_platforms',{},d=>{
    el.innerHTML=nav('plat')+'<p class="sub">লোগোতে ট্যাপ করুন — ১০ প্রভাইডারের ওই প্ল্যাটফর্মের সব সার্ভিস আসবে।</p><div class="pg">'+popSort(d.platforms.map(p=>Object.assign({n:p.total},p))).map(p=>`<a class="pt" href="#pl=${encodeURIComponent(p.label)}">${logo(p.label,52)}<b>${esc(p.label)}</b><span class="sub">${bn(p.total)}টি · সাইটে ${bn(p.site)}</span></a>`).join('')+'</div>'+(()=>{const rest=d.platforms.filter(p=>!isPop(p.label));return rest.length?`<select class="plmore" id="plr" aria-label="আরও প্ল্যাটফর্ম"><option value="">আরও প্ল্যাটফর্ম (${bn(rest.length)}টি) ▾</option>${rest.map(p=>`<option value="${esc(p.label)}">${esc(p.label)} (${bn(p.total)}টি · সাইটে ${bn(p.site)})</option>`).join('')}</select>`:''})();
    const pr=$('#plr');if(pr)pr.onchange=()=>{if(pr.value)location.hash='pl='+encodeURIComponent(pr.value)};
  });}catch(e){if(!authFail(e))el.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p></div>`}}
function platPage(label){
  cur=null;$('#title').textContent=label;$('#back').hidden=false;const el=$('#main');ps={q:'',type:'',state:'all',off:0};
  el.innerHTML=`<div class="phd">${logo(label,48)}<div><b>${esc(label)}</b><div class="sub" id="pcnt"></div></div></div><div class="bar"><input id="pq" type="search" placeholder="নাম বা আইডি খুঁজুন" aria-label="খুঁজুন"></div><div class="chips" id="pty"></div><div class="chips">${[['all','সব'],['on','চালু'],['off','বন্ধ']].map(s=>`<button class="chip" data-s="${s[0]}" aria-pressed="${s[0]==='all'}">${s[1]}</button>`).join('')}</div><div class="list" id="pl"></div><div id="pmore"></div>`;
  $('#pq').oninput=e=>{clearTimeout(qt);qt=setTimeout(()=>{ps.q=e.target.value;pload(label)},350)};
  el.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{ps.state=b.dataset.s;el.querySelectorAll('[data-s]').forEach(x=>x.setAttribute('aria-pressed',x===b));pload(label)});
  pload(label)}
async function pload(label,more){
  if(!more)ps.off=0;const box=$('#pl');if(!more)box.innerHTML='<div class="sk"></div>';
  try{const d=await api('svc_by_platform',{label,q:ps.q,type:ps.type,state:ps.state,offset:ps.off,limit:40});d.cmp=1;window._fx=d.fx;window._sc=d.site_categories;
    $('#pcnt').textContent=`মোট ${bn(d.total)}টি · সস্তা আগে`;
    $('#pty').innerHTML=`<button class="chip" data-t="" aria-pressed="${!ps.type}">সব ধরন</button>`+d.types.map(t=>`<button class="chip" data-t="${esc(t[0])}" aria-pressed="${ps.type===t[0]}">${esc(t[0])} ${bn(t[1])}</button>`).join('');
    $('#pty').querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{ps.type=b.dataset.t;pload(label)});
    if(!more)box.innerHTML='';if(!d.rows.length&&!more)box.innerHTML='<div class="card empty">কিছু পাওয়া যায়নি</div>';
    d.rows.forEach(r=>box.appendChild(row(r,d)));ps.off+=d.rows.length;
    $('#pmore').innerHTML=ps.off<d.total?'<button class="sm" id="pm" style="width:100%;margin-top:8px">আরও দেখান</button>':'';const m=$('#pm');if(m)m.onclick=()=>pload(label,true);
  }catch(e){if(!authFail(e))box.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p></div>`}}

/* ---------- সাইটের সার্ভিস ম্যানেজ: নাম বদল / লুকান / ফেরান ---------- */
let ms={q:'',plat:'',cat:'',type:'',state:'on',off:0};const ssel=new Set();
function mng(){
  cur=null;$('#title').textContent='সাইটের সার্ভিস';$('#back').hidden=true;const el=$('#main');
  el.innerHTML=nav('mng')+`<div id="mps"></div><div class="bar"><input id="mq" type="search" placeholder="নাম, আইডি বা ক্যাটেগরি" value="${esc(ms.q)}" aria-label="খুঁজুন"></div><div id="mcats"></div><div id="mcm"></div><div class="chips">${[['on','চালু'],['off','লুকানো'],['all','সব']].map(s=>`<button class="chip" data-s="${s[0]}" aria-pressed="${ms.state===s[0]}">${s[1]}</button>`).join('')}<button class="chip" id="msa">সব বাছুন</button></div><p class="sub" id="mcnt"></p><div class="list" id="ml"></div><div id="mmore"></div>`;
  $('#mq').oninput=e=>{clearTimeout(qt);qt=setTimeout(()=>{ms.q=e.target.value;mload()},350)};
  el.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{ms.state=b.dataset.s;el.querySelectorAll('[data-s]').forEach(x=>x.setAttribute('aria-pressed',x===b));mload()});
  $('#msa').onclick=()=>el.querySelectorAll('.msel').forEach(x=>{if(!x.checked){x.checked=true;x.onchange()}});
  mload()}
async function mload(more){
  if(!more){ms.off=0;ssel.clear();msBar()}
  const box=$('#ml');if(!more)box.innerHTML='<div class="sk"></div>';
  try{const d=await pageRows('svc_site_list',{q:ms.q,platform:ms.plat,category:ms.cat,state:ms.state},ms.off,40,ms.cat?'':ms.type);window._mc=d.categories;
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
  c.innerHTML=`<div><h4><input type="checkbox" class="sel msel" aria-label="নির্বাচন">${esc(r.name)}</h4><div class="sub">${logo(r.platform_label,18)} ${esc(r.platform_label)} · ID <b>${esc(r.code)}</b> · ${esc(r.category)}</div><div class="sub">খরচ <b>$${esc(r.cost)}</b> · সাইটে ≈ <b>৳${bn(r.sell)}</b> · ${bn(r.min)}–${bn(r.max)}${r.ov?' · নাম বদলানো':''}${r.state==='off'?' · লুকানো':''}</div></div><div class="acts2"><button class="sw" role="switch" aria-checked="${r.state!=='off'}" aria-label="সাইটে চালু/বন্ধ" data-h></button><button class="sm" data-e aria-label="সম্পাদনা">✎ এডিট</button></div>`;
  c.querySelector('.msel').onchange=e=>{e.target.checked?ssel.add(r):ssel.delete(r);msBar()};
  c.querySelector('[data-e]').onclick=()=>editSheet(r);
  c.querySelector('[data-h]').onclick=async ev=>{if(busy)return;const on=r.state==='off',b=ev.currentTarget;busy=true;b.disabled=true;
    try{await api('svc_site_hide',{codes:[r.code],on});r.state=on?'on':'off';b.setAttribute('aria-checked',on);c.classList.toggle('dim',!on);toast(on?'চালু হয়েছে':'বন্ধ হয়েছে')}catch(e){if(!authFail(e))toast(e.message)}b.disabled=false;busy=false};
  return c}
function editSheet(r,after){
  let dlg=$('#esh');if(!dlg){dlg=document.createElement('dialog');dlg.id='esh';document.body.appendChild(dlg)}
  const pls=[...new Set([r.platform,...PLAT.map(p=>p[0])].filter(Boolean))];
  dlg.innerHTML=`<form method="dialog"><h3 style="margin:0 0 8px">সম্পাদনা · ID ${esc(r.code)}</h3><label for="enm">সার্ভিসের নাম</label><input id="enm" maxlength="120" value="${esc(r.name)}"><label for="epl">প্ল্যাটফর্ম</label><select id="epl">${pls.map(p=>`<option${p===r.platform?' selected':''}>${esc(p)}</option>`).join('')}</select><label for="ect">ক্যাটেগরি</label><input id="ect" list="ects" value="${esc(r.category)}"><datalist id="ects">${(window._mc||[]).map(c=>`<option value="${esc(c)}">`).join('')}</datalist><p id="eer" class="err" role="alert"></p><div class="acts"><button class="sm" value="cancel" formnovalidate>বাতিল</button><button class="sm" id="etd" type="button">অটো সাজান</button><button class="btn" value="ok">সংরক্ষণ</button></div></form>`;
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
  b.hidden=!ssel.size;b.innerHTML=`<b>${bn(ssel.size)}টি</b><button class="sm" data-a="show">চালু</button><button class="sm" data-a="hide">বন্ধ</button><button class="sm" data-a="del">মুছুন</button><button class="sm" data-a="cat">ক্যাটেগরি</button><button class="sm" data-a="tidy">সাজান</button><button class="sm" data-a="x" aria-label="বাতিল">✕</button>`;
  b.querySelectorAll('[data-a]').forEach(x=>x.onclick=()=>mact(x.dataset.a))}
async function mact(k){
  if(k==='x'){ssel.clear();document.querySelectorAll('.msel').forEach(x=>x.checked=false);return msBar()}
  if(busy)return;const codes=[...ssel].map(r=>r.code);if(!codes.length)return;let act='svc_site_hide',a={codes};
  if(k==='show')a.on=true;
  else if(k==='hide'){a.on=false}
  else if(k==='del'){if(!confirm(bn(codes.length)+'টি সার্ভিস সাইট থেকে মুছে ফেলা হবে?\n(স্টুডিও/বটে যোগ করাগুলো তালিকা থেকেও যাবে; পুরনোগুলো লুকানো থাকবে — "লুকানো" ফিল্টার থেকে ফেরানো যাবে)'))return;a.on=false;a.del=true}
  else{act='svc_site_bulk';if(k==='tidy'){if(!confirm(bn(codes.length)+'টির নাম ও ক্যাটেগরি অটো সাজানো হবে?'))return;a.tidy=true}else{const c=prompt('নতুন ক্যাটেগরি (সবগুলোর জন্য)','');if(!c)return;a.category=c}}
  busy=true;try{const r=await api(act,a);toast(bn(r.done)+'টি হয়েছে');mload()}catch(e){if(!authFail(e))toast(e.message)}busy=false}

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
    const list=()=>rows.filter(r=>!q||(r.name+' '+r.code).toLowerCase().indexOf(q)>=0);
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
  c.innerHTML=`<div class="khd"><span class="sub">${logo(r.platform_label,18)} ID <b>${esc(r.code)}</b> · খরচ <b>$${esc(r.cost)}</b> · সাইটে ≈ <b>৳${bn(r.sell)}</b> · ${bn(r.min)}–${bn(r.max)}${r.state==='off'?' · লুকানো':''}</span><div class="acts2"><button class="sw" role="switch" aria-checked="${r.state!=='off'}" aria-label="সাইটে চালু/বন্ধ" data-h></button></div></div><div class="knm"><input class="nm" maxlength="120" value="${esc(r.name)}" aria-label="সার্ভিসের নাম (ID ${esc(r.code)})"><button class="ib" type="button" data-a title="অটো সাজান (ইমুজিসহ)" aria-label="অটো সাজান">✨</button><button class="ib sv" type="button" data-s hidden title="সংরক্ষণ" aria-label="সংরক্ষণ">💾</button></div><div class="row2"><button class="sm" type="button" data-e>✎ বিস্তারিত এডিট (ক্যাটেগরি/প্ল্যাটফর্ম)</button></div>`;
  const inp=c.querySelector('.nm'),sv=c.querySelector('[data-s]'),chk=()=>{sv.hidden=!(inp.value.trim()&&inp.value.trim()!==r.name)};
  inp.oninput=chk;
  const save=async()=>{const nm=inp.value.trim();if(!nm||nm===r.name||busy)return;busy=true;sv.disabled=true;
    try{await api('svc_site_edit',{code:r.code,name:nm,platform:r.platform,category:r.category});r.name=nm;SC=null;chk();toast('সংরক্ষিত ✔')}catch(e){if(!authFail(e))toast(e.message)}
    busy=false;sv.disabled=false};
  sv.onclick=save;inp.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();save()}};
  c.querySelector('[data-a]').onclick=()=>{const nn=nice(r)||(r.tidy&&r.tidy.name);if(!nn){toast('অটো নাম বানানোর মতো তথ্য নেই');return}inp.value=nn;chk();inp.focus()};
  c.querySelector('[data-e]').onclick=()=>editSheet(r,reload);
  c.querySelector('[data-h]').onclick=async ev=>{if(busy)return;const on=r.state==='off',b=ev.currentTarget;busy=true;b.disabled=true;
    try{await api('svc_site_hide',{codes:[r.code],on});r.state=on?'on':'off';b.setAttribute('aria-checked',on);c.classList.toggle('dim',!on);toast(on?'চালু হয়েছে':'বন্ধ হয়েছে')}catch(e){if(!authFail(e))toast(e.message)}b.disabled=false;busy=false};
  return c}
/* নতুন ক্যাটেগরি (সার্ভিস বেছে) / বিদ্যমান ক্যাটেগরিতে সার্ভিস যোগ */
function catSheet(o){
  let dlg=$('#ncs');if(!dlg){dlg=document.createElement('dialog');dlg.id='ncs';document.body.appendChild(dlg)}
  const add=o.mode==='add',chosen=new Map();let qt2=null;
  dlg.innerHTML=`<form method="dialog" id="ncf"><h3 style="margin:0 0 8px">${add?'➕ সার্ভিস যোগ — '+esc(o.name):'➕ নতুন ক্যাটেগরি'}</h3>${add?'':`<label for="ncn">ক্যাটেগরির নাম</label><div class="knm"><input id="ncn" maxlength="80" placeholder="যেমন: Instagram Followers" autocomplete="off"><button type="button" class="ib" id="ncemo" title="ইমুজি যোগ করুন" aria-label="ইমুজি যোগ করুন">✨</button></div><label for="ncp">প্ল্যাটফর্ম (ঐচ্ছিক)</label><select id="ncp"><option value="">সার্ভিসের যেমন আছে তেমনই</option>${PLAT.slice(0,7).map(p=>`<option>${p[0]}</option>`).join('')}</select>`}<label for="ncq">সার্ভিস বাছুন — নাম বা আইডি লিখে খুঁজুন</label><input id="ncq" type="search" autocomplete="off" placeholder="যেমন: followers"><p class="sub" id="ncc"></p><div class="ncl" id="ncl"></div><p id="ncerr" class="err" role="alert"></p><div class="acts"><button class="btn" value="ok" id="ncok" style="order:2">${add?'যোগ করুন':'তৈরি করুন'}</button><button class="sm" value="cancel" formnovalidate style="order:1">বাতিল</button></div></form>`;
  const ok=$('#ncok'),cnt=()=>{ok.textContent=(add?'যোগ করুন':'তৈরি করুন')+(chosen.size?` (${bn(chosen.size)}টি)`:'')};
  const load=async()=>{const box=$('#ncl'),q=$('#ncq').value.trim();box.innerHTML='<div class="sk"></div>';
    try{const d=await api('svc_site_list',{q,platform:'',category:'',state:'all',offset:0,limit:100});let rows=d.rows;if(add)rows=rows.filter(r=>r.category!==o.name);
      $('#ncc').textContent=`মোট ${bn(d.total)}টি${d.total>d.rows.length?' · প্রথম '+bn(d.rows.length)+'টি দেখানো হচ্ছে — খুঁজে সীমিত করুন':''}`;box.innerHTML='';
      if(!rows.length)box.innerHTML='<div class="empty">কিছু পাওয়া যায়নি</div>';
      rows.forEach(r=>{const l=document.createElement('label');l.className='card tdy';l.innerHTML=`<input type="checkbox" class="sel" ${chosen.has(r.code)?'checked':''}><div><h4>${esc(r.name)}</h4><div class="sub">ID ${esc(r.code)} · ${esc(r.platform_label)} · ${esc(r.category||'—')}${r.state==='off'?' · লুকানো':''}</div></div>`;
        l.querySelector('input').onchange=e=>{e.target.checked?chosen.set(r.code,r):chosen.delete(r.code);cnt()};box.appendChild(l)})}
    catch(e){if(!authFail(e))box.innerHTML=`<div class="err">${esc(e.message)}</div>`}};
  $('#ncq').oninput=()=>{clearTimeout(qt2);qt2=setTimeout(load,350)};
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
const GK='pb_gem_key',GM='pb_gem_model',GOK='pb_gem_ok';let gh=[],gbusy=false;
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
const gslim=r=>({code:r.code,name:r.name,category:r.category,platform:r.platform_label,cost_usd:r.cost,sell_bdt:r.sell,min:r.min,max:r.max,state:r.state});
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
let gViaSrv=false,gSrvKey=false;
function aiPing(){return api('ai_gemini',{ping:1}).then(r=>{if(r&&r.has_key){gSrvKey=true;aiStatus()}}).catch(()=>{})}
async function gcall(){const key=ls.get(GK),model=ls.get(GM)||'gemini-2.5-flash';
  const body={systemInstruction:{parts:[{text:SYS}]},contents:gh,tools:TOOLS,generationConfig:{temperature:.3}};let d,status;
  if(!key){if(!gSrvKey)throw new Error('key দেওয়া নেই');gViaSrv=true}
  if(!gViaSrv){try{const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body)});d=await r.json().catch(()=>({}));status=r.status}
    catch(e){if(e.name!=='TypeError'||navigator.onLine===false)throw e;gViaSrv=true}}
  if(gViaSrv){try{const x=await api('ai_gemini',{key,model,body});d=x.data||{};status=x.status}
    catch(e){if(e.code==='unknown_action'){gViaSrv=false;const m=new Error('ফোন থেকে সরাসরি Google-এ যাওয়া যাচ্ছে না। Apps Script-এ PtServices.gs আপডেট করলে সার্ভারের মাধ্যমে চলবে।');m.name='TypeError';throw m}throw e}}
  if(status<200||status>=300){const e=new Error((d.error&&d.error.message)||('HTTP '+status));e.status=status;throw e}return d}
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
const gerr=e=>{const m=String(e&&e.message||'');
  if(e.status===429)return'ফ্রি কোটা শেষ বা অনেক দ্রুত পাঠানো হয়েছে — একটু পরে চেষ্টা করুন';
  if(e.status===404)return'মডেলের নাম পাওয়া যায়নি — ⚙ থেকে মডেল বদলান ('+m+')';
  if(e.status===400&&/key/i.test(m)||e.status===403)return'API key ঠিক নয় বা অনুমতি নেই ['+e.status+'] — Google বলছে: '+m;
  if(e.name==='TypeError'){
    if(navigator.onLine===false)return'ফোনে ইন্টারনেট বন্ধ আছে';
    if(/header|ISO-8859|Invalid value|non ISO/i.test(m))return'key-তে অবৈধ অক্ষর আছে (বাংলা/লুকানো অক্ষর) — AI Studio থেকে আবার কপি করে বসান';
    return'Google সার্ভারে পৌঁছানো যায়নি (VPN, Private DNS, অ্যাড-ব্লকার, ডেটা সেভার বা ফায়ারওয়াল আটকাতে পারে) — ব্রাউজারের ত্রুটি: '+m}
  return(e.status?'['+e.status+'] ':'')+m};
function aiStatus(){const k=ls.get(GK);if(!k&&gSrvKey){$('#aiSt').textContent='● সংযুক্ত (সার্ভারের key)';$('#aiSt').className='sub ok';return}$('#aiSt').textContent=k?(ls.get(GOK)?'● সংযুক্ত':'● key আছে'):'○ সংযুক্ত নয়';$('#aiSt').className='sub'+(k&&ls.get(GOK)?' ok':'')}
function aiInit(){if($('#aiFab'))return;
  document.body.insertAdjacentHTML('beforeend',`<button id="aiFab" class="aifab" popover="manual" aria-label="AI সহকারী — টেনে সরানো যায়" title="AI সহকারী (টেনে সরান)" hidden>${ROBOT}</button><section id="ai" class="aipanel" popover="manual" role="dialog" aria-label="AI সহকারী" hidden><header><b class="aiti">${ROBOT.replace('width="30" height="30"','width="22" height="22"')} AI সহকারী</b><span id="aiSt" class="sub"></span><span class="aihs"><button class="ib" id="aiSet" aria-label="সেটিং">⚙</button><button class="ib" id="aiNew" aria-label="নতুন চ্যাট" title="নতুন চ্যাট">↺</button><button class="ib" id="aiX" aria-label="বন্ধ">✕</button></span></header>
<div id="aiKey" class="aikey" hidden><label for="aiK">Gemini API key</label><input id="aiK" type="password" autocomplete="off" placeholder="AIza…"><label for="aiM">মডেল</label><input id="aiM" autocomplete="off"><p class="sub">key শুধু এই ফোনের ব্রাউজারে থাকে। Google AI Studio-তে key-তে সীমা (restriction) বেঁধে রাখুন।</p><p class="err" id="aiKe" role="alert"></p><div class="acts"><button class="sm" id="aiDel" type="button">key মুছুন</button><button class="btn" id="aiSave" type="button">সংরক্ষণ ও পরীক্ষা</button></div></div>
<div id="aiMsgs" class="aimsgs" aria-live="polite"></div><div id="aiChips" class="chips"></div><form id="aiForm"><input id="aiIn" placeholder="যা করাতে চান লিখুন…" autocomplete="off" aria-label="বার্তা"><button class="btn" id="aiGo">পাঠান</button></form></section>`);
  const P=$('#ai'),F=$('#aiFab');aiFabInit(F);topLayer(P);topLayer(F);
  const open=()=>{P.hidden=false;F.hidden=true;topLayer(P);aiStatus();aiPing().then(()=>{if(gSrvKey&&!$('#aiKey').hidden&&!ls.get(GK))keyBox(false)});if(!ls.get(GK)&&!gSrvKey)keyBox(true);else $('#aiIn').focus()};
  const close=()=>{P.hidden=true;F.hidden=!token;topLayer(F)};
  const keyBox=v=>{$('#aiKey').hidden=!v;if(v){$('#aiK').value=ls.get(GK)||'';$('#aiM').value=ls.get(GM)||'gemini-2.5-flash';$('#aiKe').textContent=''}};
  F.onclick=()=>{if(fabMoved){fabMoved=false;return}open()};$('#aiX').onclick=close;$('#aiSet').onclick=()=>keyBox($('#aiKey').hidden);
  $('#aiNew').onclick=()=>{gh=[];$('#aiMsgs').innerHTML='';hello()};
  $('#aiDel').onclick=()=>{ls.del(GK);ls.del(GOK);gh=[];$('#aiK').value='';aiStatus();$('#aiKe').textContent='key মোছা হয়েছে'};
  $('#aiSave').onclick=async()=>{const k=$('#aiK').value.trim(),m=$('#aiM').value.trim()||'gemini-2.5-flash',b=$('#aiSave');if(!k){$('#aiKe').textContent='key দিন';return}
    if(!/^[\x21-\x7E]+$/.test(k)){$('#aiKe').textContent='key-তে অবৈধ অক্ষর আছে (বাংলা/স্পেস/লুকানো অক্ষর) — আবার কপি করে বসান';return}
    b.disabled=true;$('#aiKe').textContent='পরীক্ষা হচ্ছে…';const ok=[ls.get(GK),ls.get(GM)],old=gh;ls.set(GK,k);ls.set(GM,m);gh=[{role:'user',parts:[{text:'শুধু "ok" লিখুন'}]}];
    try{await gcall();ls.set(GOK,'1');gh=old;$('#aiKe').textContent='';keyBox(false);aiStatus();if(!$('#aiMsgs').children.length)hello();$('#aiIn').focus()}
    catch(e){gh=old;ls.del(GOK);if(ok[0]==null)ls.del(GK);else ls.set(GK,ok[0]);if(ok[1]==null)ls.del(GM);else ls.set(GM,ok[1]);$('#aiKe').textContent=gerr(e)}
    b.disabled=false;aiStatus()};
  const send=async t=>{t=(t||'').trim();if(!t||gbusy)return;if(!ls.get(GK)&&!gSrvKey){keyBox(true);return}
    gbusy=true;$('#aiGo').disabled=true;$('#aiIn').value='';addMsg('me',t);const w=addMsg('tool','⏳ ভাবছি…');
    try{await agent(t);ls.set(GOK,'1')}catch(e){addMsg('err',gerr(e))}
    if(w)w.remove();gbusy=false;$('#aiGo').disabled=false;aiStatus();$('#aiIn').focus()};
  $('#aiForm').onsubmit=e=>{e.preventDefault();send($('#aiIn').value)};
  const hello=()=>{addMsg('ai','আমি সাইটের সার্ভিস খুঁজতে, ক্যাটেগরি/নাম সাজাতে, চালু-বন্ধ করতে পারি। কী করাতে চান?');
    $('#aiChips').innerHTML=['TikTok Followers-এর সবচেয়ে সস্তা ৫টা (সব প্রভাইডার)','ফেসবুকের ক্যাটেগরিগুলো দেখাও','কতগুলো সার্ভিসের নাম সাজানো বাকি?','Instagram Followers-এর নাম সাজাও'].map(x=>`<button class="chip" type="button">${esc(x)}</button>`).join('');
    $('#aiChips').querySelectorAll('.chip').forEach(b=>b.onclick=()=>send(b.textContent))};
  hello();aiStatus();aiPing();window._aiClose=close}
function aiShow(a){aiInit();const F=$('#aiFab'),P=$('#ai');if(!a){P.hidden=true;F.hidden=true}else{F.hidden=!P.hidden?true:false;topLayer(F);fabFit()}}

/* ---------- রাউটার, লগইন, ইনস্টল ---------- */
function route(){rid++;const h=decodeURIComponent(location.hash.replace('#',''));const bb=$('#bulk');if(bb)bb.hidden=true;sel.clear();ssel.clear();if(h==='cmp')cmp();else if(h==='chg')chg();else if(h==='tidy')tidy();else if(h==='plat')plat();else if(h==='mng')mng();else if(h==='cats')catsPage();else if(h.indexOf('cat=')===0)catPage(h.slice(4));else if(h.indexOf('pl=')===0)platPage(h.slice(3));else if(h.indexOf('p=')===0){st={q:'',state:'all',cat:'',off:0};provider(h.slice(2))}else home();$('#main').focus({preventScroll:true})}
function show(a){$('#login').hidden=a;$('#app').hidden=!a;aiShow(a)}
function logout(m){token='';wipe();ls.del('pb_studio_token');show(false);$('#loginErr').textContent=m||'';$('#tok').value=''}
$('#loginForm').onsubmit=async e=>{e.preventDefault();token=$('#tok').value.trim();const b=e.target.querySelector('button');b.disabled=true;$('#loginErr').textContent='';
  try{await api('svc_providers');ls.set('pb_studio_token',token);show(true);route()}catch(x){$('#loginErr').textContent=ERR[x.code]||('সংযোগ করা যায়নি — '+x.message)}b.disabled=false};
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
token?(show(true),route()):show(false);
})();
