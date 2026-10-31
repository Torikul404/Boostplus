/* boostplus সার্ভিস স্টুডিও — প্রভাইডারের লাইভ সার্ভিস → CSV → প্রতি সার্ভিসে অন/অফ সুইচ */
(function(){
'use strict';
const API='const API='https://script.google.com/macros/s/AKfycbx47uFKaYzBg0sFfOOY-382zadF8mSfQLYTDZPFqSSTHhOT5h4H-wnDzhJFZ16W3Ajy/exec';c';
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bn=n=>(+n||0).toLocaleString('bn-BD');
const ls={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}},del:k=>{try{localStorage.removeItem(k)}catch(e){}}};
let token=ls.get('pb_studio_token')||'',busy=false,st={q:'',state:'all',cat:'',off:0},cur=null,lastList=null,qt=null;
const ERR={unauthorized:'টোকেন ঠিক নয়',locked_out:'অনেকবার ভুল হয়েছে — কিছুক্ষণ পরে চেষ্টা করুন',no_config:'এই প্রভাইডারের API সেট করা নেই',bad_json:'প্রভাইডার সঠিক উত্তর দেয়নি',provider_error:'প্রভাইডার ত্রুটি দিয়েছে',not_collected:'আগে "সংগ্রহ করুন" চাপুন',code_conflict:'এই আইডি সাইটে অন্য প্রভাইডারের সার্ভিস হিসেবে আছে',previously_removed:'এই সার্ভিস আগে সাইট থেকে বাদ দেওয়া হয়েছিল',category_required:'ক্যাটেগরি দিন',price_required:'দাম দিন',svc_failed:'সার্ভারে সমস্যা হয়েছে'};
async function api(action,x){
  let r,txt,d;
  try{r=await fetch(API,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({action,token},x||{}))});txt=await r.text()}
  catch(ex){const e=new Error('নেটওয়ার্ক/CORS ত্রুটি: '+(ex&&ex.message||ex));e.code='net';throw e}
  try{d=JSON.parse(txt)}
  catch(ex){const e=new Error('সার্ভার JSON দেয়নি (HTTP '+r.status+'): '+String(txt).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,140));e.code='not_json';throw e}
  if(!d||!d.ok){const e=new Error((d&&(d.message||ERR[d.error]||d.error))||'failed');e.code=d&&d.error;e.data=d;throw e}return d;
}
function toast(m){const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),3200)}
const authFail=e=>{if(e&&(e.code==='unauthorized'||e.code==='locked_out')){logout(ERR[e.code]);return true}return false};

/* ---------- হোম: প্রভাইডার তালিকা ---------- */
async function home(){
  $('#title').textContent='সার্ভিস স্টুডিও';$('#back').hidden=true;cur=null;
  const el=$('#main');el.innerHTML='<div class="sk"></div><div class="sk" style="margin-top:12px"></div>';
  try{
    const d=await api('svc_providers'),P=d.providers||[];
    el.innerHTML='<div class="bar"><button class="btn" id="all" style="max-width:260px">সব প্রভাইডার সংগ্রহ করুন</button><span id="prog" class="mut" role="status"></span></div><div class="list">'+
    (P.length?P.map(p=>`<div class="card pv"><div class="top"><div><b>${esc(p.provider)}</b><div class="sub">${p.collected_at?'সংগ্রহ: '+esc(p.collected_at)+' · '+bn(p.count)+'টি':'এখনো সংগ্রহ হয়নি'}</div></div>${p.has_api?'':'<span class="tag hi">API নেই</span>'}</div><div class="acts"><button class="sm" data-c="${esc(p.provider)}" ${p.has_api?'':'disabled'}>সংগ্রহ</button><button class="sm" data-o="${esc(p.provider)}" ${p.count?'':'disabled'}>সার্ভিস দেখুন</button></div></div>`).join(''):'<div class="card empty">কোনো প্রভাইডার কনফিগার করা নেই</div>')+'</div>';
    el.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>collect(b.dataset.c,b));
    el.querySelectorAll('[data-o]').forEach(b=>b.onclick=()=>{location.hash='p='+encodeURIComponent(b.dataset.o)});
    const all=$('#all');if(all)all.onclick=async()=>{all.disabled=true;let ok=0,bad=0;const L=P.filter(p=>p.has_api);for(let i=0;i<L.length;i++){$('#prog').textContent=`${bn(i+1)}/${bn(L.length)} — ${L[i].provider}`;try{await api('svc_collect',{provider:L[i].provider});ok++}catch(e){if(authFail(e))return;bad++}}toast(`সংগ্রহ শেষ: ${bn(ok)} সফল, ${bn(bad)} ব্যর্থ`);home()};
  }catch(e){if(!authFail(e))el.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p><button class="btn" id="rt" style="max-width:220px">আবার চেষ্টা করুন</button></div>`,$('#rt').onclick=home}
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
  if(!more){st.off=0;el.innerHTML='<div class="sk"></div>'}
  try{
    const d=await api('svc_list',{provider:p,q:st.q,state:st.state,category:st.cat,offset:st.off,limit:50});
    if(!more){lastList=d;
      el.innerHTML=`<div class="bar"><input id="q" type="search" placeholder="নাম, আইডি বা ক্যাটেগরি খুঁজুন" value="${esc(st.q)}" aria-label="খুঁজুন"><select id="cs" aria-label="ক্যাটেগরি"><option value="">সব ক্যাটেগরি</option>${Object.keys(d.categories).sort().map(c=>`<option value="${esc(c)}"${c===st.cat?' selected':''}>${esc(c)} (${bn(d.categories[c])})</option>`).join('')}</select></div>
      <div class="chips" role="group" aria-label="অবস্থা">${[['all','সব'],['on','চালু'],['off','বন্ধ'],['conflict','জট']].map(s=>`<button class="chip" data-s="${s[0]}" aria-pressed="${st.state===s[0]}">${s[1]}</button>`).join('')}<button class="chip" id="csv">⤓ CSV</button></div>
      <p class="sub" id="cnt"></p><div class="list" id="rows"></div><div id="moreWrap"></div>`;
      $('#q').oninput=e=>{clearTimeout(qt);qt=setTimeout(()=>{st.q=e.target.value;provider(p)},350)};
      $('#cs').onchange=e=>{st.cat=e.target.value;provider(p)};
      el.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{st.state=b.dataset.s;provider(p)});
      $('#csv').onclick=()=>dl(p);
    }else lastList.rows=lastList.rows.concat(d.rows);
    $('#cnt').textContent=`মোট ${bn(d.total)}টি${d.fx?'':' · USD→৳ রেট সেট নেই (দাম USD-তে দিন)'}`;
    const box=$('#rows');if(!more)box.innerHTML='';
    if(!d.rows.length&&!more)box.innerHTML='<div class="card empty">কিছু পাওয়া যায়নি</div>';
    d.rows.forEach(r=>box.appendChild(row(r,d)));
    st.off+=d.rows.length;$('#moreWrap').innerHTML=st.off<d.total?'<button class="sm" id="more" style="width:100%;margin-top:8px">আরও দেখান</button>':'';
    const m=$('#more');if(m)m.onclick=()=>provider(p,true);
    window._fx=d.fx;window._sc=d.site_categories;
  }catch(e){if(!authFail(e))el.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p><button class="btn" id="rt" style="max-width:220px">আবার চেষ্টা করুন</button></div>`,$('#rt').onclick=()=>provider(p)}
}
function row(r,d){
  const c=document.createElement('div');c.className='card svc';
  const sg=r.suggest?` · প্রস্তাব <b>৳${bn(r.suggest.bdt)}</b>${r.suggest.auto?'':' (হাতে)'}`:'';
  c.innerHTML=`<div><h4>${esc(r.name)}</h4><div class="sub">ID <b>${esc(r.service_id)}</b> · ${esc(r.category)}</div><div class="sub">রেট <b>${esc(r.rate)}</b> · ${bn(r.min)}–${bn(r.max)}${r.refill==='1'?' · Refill':''}${r.cancel==='1'?' · Cancel':''}${sg}</div>${r.state==='conflict'?`<div class="sub hi">জট: ${esc(r.conflict_with)}-এর সার্ভিস হিসেবে আছে</div>`:''}</div>
  <button class="sw" role="switch" aria-checked="${r.state==='on'}" aria-label="${esc(r.name)} সাইটে চালু/বন্ধ" ${r.state==='conflict'?'disabled':''}></button>`;
  c.querySelector('.sw').onclick=ev=>toggle(r,ev.currentTarget);
  return c;
}
async function toggle(r,btn){
  if(busy)return;
  if(r.state==='on'){
    if(!confirm('এটা সাইট থেকে লুকানো হবে। চালিয়ে যাবেন?'))return;
    busy=true;btn.disabled=true;
    try{await api('svc_toggle',{provider:cur,code:r.service_id,on:false});r.state='off';btn.setAttribute('aria-checked','false');toast('সাইট থেকে লুকানো হয়েছে')}catch(e){if(!authFail(e))toast(e.message)}
    busy=false;btn.disabled=false;return;
  }
  openSheet(r,btn);
}
function openSheet(r,btn,force){
  const sh=$('#sheet');$('#shN').textContent=`ID ${r.service_id} · রেট ${r.rate} · ${r.category}`;
  $('#shName').value=r.name;$('#shCat').value=r.category;
  $('#shPlat').innerHTML=PLAT.map(p=>`<option>${p[0]}</option>`).join('');$('#shPlat').value=guess(r.category+' '+r.name);
  $('#shCats').innerHTML=(window._sc||[]).map(c=>`<option value="${esc(c)}">`).join('');
  const fx=window._fx||0;$('#shPriceBdt').hidden=!fx;
  $('#shBdt').value=r.suggest?r.suggest.bdt:'';$('#shUsd').value=r.suggest?r.suggest.usd:'';$('#shUsd').readOnly=!!fx;
  $('#shInfo').textContent=fx?'৳ দাম বদলালে USD নিজে হিসাব হবে (১ USD = ৳'+fx+')':'দাম USD-তে লিখুন';$('#shErr').textContent='';
  $('#shBdt').oninput=()=>{$('#shUsd').value=fx?Math.round($('#shBdt').value/fx*10000)/10000:''};
  sh.onclose=async()=>{
    if(sh.returnValue!=='ok')return;
    busy=true;btn.disabled=true;
    try{await api('svc_toggle',{provider:cur,code:r.service_id,on:true,name:$('#shName').value,platform:$('#shPlat').value,category:$('#shCat').value.trim(),price_usd:+$('#shUsd').value,force:!!force});
      r.state='on';btn.setAttribute('aria-checked','true');toast('সাইটে চালু হয়েছে ✔')}
    catch(e){if(authFail(e)){}else if(e.code==='previously_removed'&&confirm(e.message+'\nতবুও চালু করবেন?'))openSheet(r,btn,true);else toast(e.message)}
    busy=false;btn.disabled=false;
  };
  $('#shForm').onsubmit=e=>{const u=+$('#shUsd').value,c=$('#shCat').value.trim();if(e.submitter&&e.submitter.value==='ok'&&(!c||!(u>0))){e.preventDefault();$('#shErr').textContent=!c?'ক্যাটেগরি দিন':'দাম দিন'}};
  sh.showModal();
}
async function dl(p){
  try{const d=await api('svc_csv',{provider:p});const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([d.csv],{type:'text/csv;charset=utf-8'}));a.download=d.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
  catch(e){if(!authFail(e))toast(e.message)}
}

/* ---------- রাউটার, লগইন, ইনস্টল ---------- */
function route(){const h=decodeURIComponent(location.hash.replace('#',''));if(h.indexOf('p=')===0){st={q:'',state:'all',cat:'',off:0};provider(h.slice(2))}else home();$('#main').focus({preventScroll:true})}
function show(a){$('#login').hidden=a;$('#app').hidden=!a}
function logout(m){token='';ls.del('pb_studio_token');show(false);$('#loginErr').textContent=m||'';$('#tok').value=''}
$('#loginForm').onsubmit=async e=>{e.preventDefault();token=$('#tok').value.trim();const b=e.target.querySelector('button');b.disabled=true;$('#loginErr').textContent='';
  try{await api('svc_providers');ls.set('pb_studio_token',token);show(true);route()}catch(x){$('#loginErr').textContent=ERR[x.code]||('সংযোগ করা যায়নি — '+x.message)}b.disabled=false};
$('#logout').onclick=()=>logout();$('#back').onclick=()=>{location.hash=''};
addEventListener('hashchange',()=>token&&route());
let dip=null;addEventListener('beforeinstallprompt',e=>{e.preventDefault();dip=e;$('#install').hidden=false});
$('#install').onclick=async()=>{if(!dip)return;dip.prompt();await dip.userChoice;dip=null;$('#install').hidden=true};
const net=()=>{$('#net').hidden=navigator.onLine};addEventListener('online',net);addEventListener('offline',net);net();
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
token?(show(true),route()):show(false);
})();
