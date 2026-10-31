/* boostplus সার্ভিস স্টুডিও — প্রভাইডারের লাইভ সার্ভিস → CSV → প্রতি সার্ভিসে অন/অফ সুইচ */
(function(){
'use strict';
const API='https://script.google.com/macros/s/AKfycbx47uFKaYzBg0sFfOOY-382zadF8mSfQLYTDZPFqSSTHhOT5h4H-wnDzhJFZ16W3Ajy/exec';
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

const sel=new Set();let cq={q:'',refill:false},cn=0;
const fmtT=s=>s<90?bn(Math.round(s))+' সে.':s<5400?bn(Math.round(s/60))+' মি.':bn(Math.round(s/360)/10)+' ঘণ্টা';
const spdTag=r=>r.spd?`<div class="sub ${r.spd.m<=1800?'ok':r.spd.m>=21600?'hi':''}">⚡ গড় ${fmtT(r.spd.m)} · ${bn(r.spd.n)}টি অর্ডার${r.spd.f?' · ব্যর্থ '+bn(r.spd.f):''}</div>`:'';
const nav=a=>`<div class="chips" role="navigation">${[['','প্রভাইডার'],['plat','প্ল্যাটফর্ম'],['mng','ম্যানেজ'],['cmp','তুলনা'],['chg','পরিবর্তন'],['tidy','সাজান']].map(x=>`<a class="chip" href="#${x[0]}" aria-current="${a===x[0]}">${x[1]}</a>`).join('')}</div>`;
/* ---------- হোম: প্রভাইডার তালিকা ---------- */
async function home(){
  $('#title').textContent='সার্ভিস স্টুডিও';$('#back').hidden=true;cur=null;
  const el=$('#main');el.innerHTML='<div class="sk"></div><div class="sk" style="margin-top:12px"></div>';
  try{
    const d=await api('svc_providers'),P=d.providers||[];
    el.innerHTML=nav('')+'<div class="bar"><button class="btn" id="all" style="max-width:260px">সব প্রভাইডার সংগ্রহ করুন</button><span id="prog" class="mut" role="status"></span></div><div class="list">'+
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
  if(!more){st.off=0;sel.clear();bulkBar();el.innerHTML='<div class="sk"></div>'}
  try{
    const d=await api('svc_list',{provider:p,q:st.q,state:st.state,category:st.cat,offset:st.off,limit:50});
    if(!more){lastList=d;
      el.innerHTML=`<div class="bar"><input id="q" type="search" placeholder="নাম, আইডি বা ক্যাটেগরি খুঁজুন" value="${esc(st.q)}" aria-label="খুঁজুন"><select id="cs" aria-label="ক্যাটেগরি"><option value="">সব ক্যাটেগরি</option>${Object.keys(d.categories).sort().map(c=>`<option value="${esc(c)}"${c===st.cat?' selected':''}>${esc(c)} (${bn(d.categories[c])})</option>`).join('')}</select></div>
      <div class="chips" role="group" aria-label="অবস্থা">${[['all','সব'],['on','চালু'],['off','বন্ধ'],['conflict','জট']].map(s=>`<button class="chip" data-s="${s[0]}" aria-pressed="${st.state===s[0]}">${s[1]}</button>`).join('')}<button class="chip" id="sa">সব বাছুন</button><button class="chip" id="csv">⤓ CSV</button></div>
      <p class="sub" id="cnt"></p><div class="list" id="rows"></div><div id="moreWrap"></div>`;
      $('#q').oninput=e=>{clearTimeout(qt);qt=setTimeout(()=>{st.q=e.target.value;provider(p)},350)};
      $('#cs').onchange=e=>{st.cat=e.target.value;provider(p)};
      el.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{st.state=b.dataset.s;provider(p)});
      $('#csv').onclick=()=>dl(p);$('#sa').onclick=()=>el.querySelectorAll('.sel').forEach(x=>{if(!x.checked){x.checked=true;x.onchange()}});
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
  const sg=r.suggest?` · সাইটে ≈ <b>৳${bn(r.suggest.bdt)}</b>`:'';
  c.innerHTML=`<div><h4>${d&&d.cmp?'':'<input type="checkbox" class="sel" aria-label="নির্বাচন">'}${esc(r.name)}</h4><div class="sub">${d&&d.cmp?'<b>'+esc(r.provider)+'</b> · ':''}ID <b>${esc(r.service_id)}</b> · ${esc(r.category)}</div><div class="sub">রেট <b>${esc(r.rate)}</b> · ${bn(r.min)}–${bn(r.max)}${r.refill==='1'?' · Refill':''}${r.cancel==='1'?' · Cancel':''}${sg}</div>${spdTag(r)}${r.tidy&&r.state!=='on'?`<div class="sub ok">সাইটে: ${esc(r.tidy.name)} · ${esc(r.tidy.cat)}</div>`:''}${r.state==='conflict'?`<div class="sub hi">জট: ${esc(r.conflict_with)}-এর সার্ভিস হিসেবে আছে</div>`:''}</div>
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
  const t=r.tidy||{};$('#shName').value=t.name||r.name;$('#shCat').value=t.cat||r.category;
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
  sh.showModal();
}
async function dl(p){
  try{const d=await api('svc_csv',{provider:p});const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([d.csv],{type:'text/csv;charset=utf-8'}));a.download=d.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
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
  busy=true;try{const r=await api('svc_bulk',{provider:cur,codes,on,category:(cat||'').trim(),markup:mk});toast(`${bn(r.done)}টি হয়েছে, ${bn(r.skipped)}টি বাদ`);sel.clear();bulkBar();provider(cur)}catch(e){if(!authFail(e))toast(e.message)}busy=false}

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

/* ---------- নাম সাজান ---------- */
async function tidy(){
  cur=null;$('#title').textContent='নাম সাজান';$('#back').hidden=true;const el=$('#main');el.innerHTML=nav('tidy')+'<div class="sk"></div>';
  try{const d=await api('svc_tidy_list'),R=d.rows;
    el.innerHTML=nav('tidy')+'<p class="sub">সাইটে চালু সার্ভিসের নাম ও ক্যাটেগরি একই ছাঁচে সাজানো হবে। ⚠ ক্যাটেগরির নাম বদলালে সাইটে সেই ক্যাটেগরির ক্রম/সেটিং নতুন নামে আবার ঠিক করা লাগতে পারে।</p>'+
    (R.length?`<div class="bar"><button class="btn" id="ta">নির্বাচিতগুলো প্রয়োগ করুন (${bn(R.length)}টি)</button></div><div class="list">`+R.map((r,i)=>`<label class="card tdy"><input type="checkbox" class="sel" data-i="${i}" checked><div><div class="sub">${esc(r.provider)} · ID ${esc(r.code)}</div><div class="sub">${esc(r.cn)} · ${esc(r.cc)}</div><h4>→ ${esc(r.nn)}</h4><div class="sub ok">${esc(r.nc)}</div></div></label>`).join('')+'</div>':'<div class="card empty">সব সার্ভিস আগেই সাজানো ✔</div>');
    const ta=$('#ta');if(ta)ta.onclick=async()=>{const items=[...el.querySelectorAll('.sel:checked')].map(x=>R[+x.dataset.i]).map(r=>({code:r.code,name:r.nn,cat:r.nc}));
      if(!items.length||!confirm(bn(items.length)+'টি সার্ভিসের নাম বদলানো হবে?'))return;ta.disabled=true;
      try{const x=await api('svc_tidy_apply',{items});toast(bn(x.done)+'টি সাজানো হয়েছে');tidy()}catch(e){if(!authFail(e))toast(e.message);ta.disabled=false}};
  }catch(e){if(!authFail(e))el.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p></div>`}}

/* ---------- লোগো ---------- */
const BR={instagram:'#C13584',facebook:'#1877F2',tiktok:'#111',youtube:'#F00',telegram:'#229ED9',twitter:'#000',whatsapp:'#25D366',spotify:'#1DB954',linkedin:'#0A66C2',snapchat:'#E6B800',pinterest:'#E60023',discord:'#5865F2',twitch:'#9146FF',threads:'#000',shopee:'#EE4D2D',reddit:'#FF4500',soundcloud:'#F50',website:'#4F46E5',other:'#6B7280'};
const GL={instagram:'<rect x="7" y="7" width="18" height="18" rx="5.5" fill="none" stroke="#fff" stroke-width="2.2"/><circle cx="16" cy="16" r="4" fill="none" stroke="#fff" stroke-width="2.2"/><circle cx="21.2" cy="10.8" r="1.3" fill="#fff"/>',
youtube:'<rect x="5" y="9" width="22" height="14" rx="4.5" fill="#fff"/><path d="M13.5 12.5v7l6-3.5z" fill="#F00"/>',
telegram:'<path d="M6.5 15.5l18-7-3 15-5.5-4-3 3-.8-5z" fill="#fff"/>',
twitter:'<path d="M9 9l14 14M23 9L9 23" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/>',
facebook:'<path d="M17.5 26v-9h3l.5-3.5h-3.5v-2c0-1 .4-1.7 1.8-1.7H21V6.7C20.6 6.6 19.6 6.5 18.5 6.5c-2.6 0-4.3 1.6-4.3 4.4v2.6h-3V17h3v9z" fill="#fff"/>',
tiktok:'<path d="M17.5 7v12.3a3.6 3.6 0 11-3.6-3.6M17.5 7c.3 2.6 2 4.2 4.6 4.4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>',
whatsapp:'<path d="M16 6.5a9.5 9.5 0 00-8.1 14.4L6.5 25.5l4.7-1.2A9.5 9.5 0 1016 6.5z" fill="none" stroke="#fff" stroke-width="2.2"/><path d="M12.5 12.5c.5 3 2.7 5.2 5.8 6l1.2-1.6-2.2-1.1-.9.9a5 5 0 01-2.1-2.1l.9-.9-1.1-2.2z" fill="#fff"/>'};
function logo(label,sz){const k=String(label||'').toLowerCase().replace(/[^a-z]/g,''),key=/twitter|^x$/.test(k)?'twitter':k;
  const bg=BR[key]||('hsl('+(([...k].reduce((a,c)=>a+c.charCodeAt(0),0)*47)%360)+',55%,42%)');
  const g=GL[key]||`<text x="16" y="21.5" text-anchor="middle" font-size="15" font-weight="700" fill="#fff" font-family="Inter,sans-serif">${esc(String(label||'?').trim().charAt(0).toUpperCase())}</text>`;
  return `<svg class="lg" width="${sz||44}" height="${sz||44}" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="${bg}"/>${g}</svg>`}

/* ---------- প্ল্যাটফর্ম হাব ---------- */
let ps={q:'',type:'',state:'all',off:0};
async function plat(){
  cur=null;$('#title').textContent='প্ল্যাটফর্ম';$('#back').hidden=true;const el=$('#main');el.innerHTML=nav('plat')+'<div class="sk"></div>';
  try{const d=await api('svc_platforms');
    el.innerHTML=nav('plat')+'<p class="sub">লোগোতে ট্যাপ করুন — ১০ প্রভাইডারের ওই প্ল্যাটফর্মের সব সার্ভিস আসবে।</p><div class="pg">'+d.platforms.map(p=>`<a class="pt" href="#pl=${encodeURIComponent(p.label)}">${logo(p.label,52)}<b>${esc(p.label)}</b><span class="sub">${bn(p.total)}টি · সাইটে ${bn(p.site)}</span></a>`).join('')+'</div>';
  }catch(e){if(!authFail(e))el.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p></div>`}}
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
let ms={q:'',plat:'',cat:'',state:'on',off:0};const ssel=new Set();
function mng(){
  cur=null;$('#title').textContent='সাইটের সার্ভিস';$('#back').hidden=true;const el=$('#main');
  el.innerHTML=nav('mng')+`<div class="chips pstrip" id="mps"></div><div class="bar"><input id="mq" type="search" placeholder="নাম, আইডি বা ক্যাটেগরি" value="${esc(ms.q)}" aria-label="খুঁজুন"><select id="mc" aria-label="ক্যাটেগরি"></select></div><div class="chips">${[['on','চালু'],['off','লুকানো'],['all','সব']].map(s=>`<button class="chip" data-s="${s[0]}" aria-pressed="${ms.state===s[0]}">${s[1]}</button>`).join('')}<button class="chip" id="msa">সব বাছুন</button></div><p class="sub" id="mcnt"></p><div class="list" id="ml"></div><div id="mmore"></div>`;
  $('#mq').oninput=e=>{clearTimeout(qt);qt=setTimeout(()=>{ms.q=e.target.value;mload()},350)};
  $('#mc').onchange=e=>{ms.cat=e.target.value;mload()};
  el.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{ms.state=b.dataset.s;el.querySelectorAll('[data-s]').forEach(x=>x.setAttribute('aria-pressed',x===b));mload()});
  $('#msa').onclick=()=>el.querySelectorAll('.msel').forEach(x=>{if(!x.checked){x.checked=true;x.onchange()}});
  mload()}
async function mload(more){
  if(!more){ms.off=0;ssel.clear();msBar()}
  const box=$('#ml');if(!more)box.innerHTML='<div class="sk"></div>';
  try{const d=await api('svc_site_list',{q:ms.q,platform:ms.plat,category:ms.cat,state:ms.state,offset:ms.off,limit:40});window._mc=d.categories;
    $('#mps').innerHTML=`<button class="chip pc" data-p="" aria-pressed="${!ms.plat}">সব</button>`+d.platforms.map(p=>`<button class="chip pc" data-p="${esc(p.label)}" aria-pressed="${ms.plat===p.label}">${logo(p.label,22)} ${esc(p.label)} ${bn(p.n)}</button>`).join('');
    $('#mps').querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{ms.plat=b.dataset.p;ms.cat='';mload()});
    $('#mc').innerHTML='<option value="">সব ক্যাটেগরি</option>'+d.categories.map(c=>`<option value="${esc(c)}"${c===ms.cat?' selected':''}>${esc(c)}</option>`).join('');
    $('#mcnt').textContent=`মোট ${bn(d.total)}টি`;
    if(!more)box.innerHTML='';if(!d.rows.length&&!more)box.innerHTML='<div class="card empty">কিছু পাওয়া যায়নি</div>';
    d.rows.forEach(r=>box.appendChild(mrow(r)));ms.off+=d.rows.length;
    $('#mmore').innerHTML=ms.off<d.total?'<button class="sm" id="mm" style="width:100%;margin-top:8px">আরও দেখান</button>':'';const m=$('#mm');if(m)m.onclick=()=>mload(true);
  }catch(e){if(!authFail(e))box.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p></div>`}}
function mrow(r){
  const c=document.createElement('div');c.className='card svc'+(r.state==='off'?' dim':'');
  c.innerHTML=`<div><h4><input type="checkbox" class="sel msel" aria-label="নির্বাচন">${esc(r.name)}</h4><div class="sub">${logo(r.platform_label,18)} ${esc(r.platform_label)} · ID <b>${esc(r.code)}</b> · ${esc(r.category)}</div><div class="sub">খরচ <b>$${esc(r.cost)}</b> · সাইটে ≈ <b>৳${bn(r.sell)}</b> · ${bn(r.min)}–${bn(r.max)}${r.ov?' · নাম বদলানো':''}${r.state==='off'?' · লুকানো':''}</div></div><div class="acts2"><button class="sm" data-e>সম্পাদনা</button><button class="sm" data-h>${r.state==='off'?'ফেরান':'লুকান'}</button></div>`;
  c.querySelector('.msel').onchange=e=>{e.target.checked?ssel.add(r):ssel.delete(r);msBar()};
  c.querySelector('[data-e]').onclick=()=>editSheet(r);
  c.querySelector('[data-h]').onclick=async ev=>{if(busy)return;if(r.state!=='off'&&!confirm('এটা সাইট থেকে লুকানো হবে। চালিয়ে যাবেন?'))return;busy=true;ev.target.disabled=true;
    try{await api('svc_site_hide',{codes:[r.code],on:r.state==='off'});toast(r.state==='off'?'ফিরিয়ে আনা হয়েছে':'লুকানো হয়েছে');mload()}catch(e){if(!authFail(e))toast(e.message);ev.target.disabled=false}busy=false};
  return c}
function editSheet(r){
  let dlg=$('#esh');if(!dlg){dlg=document.createElement('dialog');dlg.id='esh';document.body.appendChild(dlg)}
  const pls=[...new Set([r.platform,...PLAT.map(p=>p[0])].filter(Boolean))];
  dlg.innerHTML=`<form method="dialog"><h3 style="margin:0 0 8px">সম্পাদনা · ID ${esc(r.code)}</h3><label for="enm">সার্ভিসের নাম</label><input id="enm" maxlength="120" value="${esc(r.name)}"><label for="epl">প্ল্যাটফর্ম</label><select id="epl">${pls.map(p=>`<option${p===r.platform?' selected':''}>${esc(p)}</option>`).join('')}</select><label for="ect">ক্যাটেগরি</label><input id="ect" list="ects" value="${esc(r.category)}"><datalist id="ects">${(window._mc||[]).map(c=>`<option value="${esc(c)}">`).join('')}</datalist><p id="eer" class="err" role="alert"></p><div class="acts"><button class="sm" value="cancel" formnovalidate>বাতিল</button><button class="sm" id="etd" type="button">অটো সাজান</button><button class="btn" value="ok">সংরক্ষণ</button></div></form>`;
  $('#etd').onclick=()=>{const t=r.tidy||{};if(t.name)$('#enm').value=t.name;if(t.cat)$('#ect').value=t.cat};
  dlg.querySelector('form').onsubmit=e=>{if(e.submitter&&e.submitter.value==='ok'&&!$('#enm').value.trim()){e.preventDefault();$('#eer').textContent='নাম দিন'}};
  dlg.onclose=async()=>{if(dlg.returnValue!=='ok')return;
    try{await api('svc_site_edit',{code:r.code,name:$('#enm').value,platform:$('#epl').value,category:$('#ect').value});toast('সংরক্ষিত ✔');mload()}catch(e){if(!authFail(e))toast(e.message)}};
  dlg.showModal()}
function msBar(){let b=$('#bulk');if(!b){b=document.createElement('div');b.id='bulk';b.className='bulk';document.body.appendChild(b)}
  b.hidden=!ssel.size;b.innerHTML=`<b>${bn(ssel.size)}টি</b><button class="sm" data-a="hide">লুকান</button><button class="sm" data-a="show">ফেরান</button><button class="sm" data-a="cat">ক্যাটেগরি</button><button class="sm" data-a="tidy">সাজান</button><button class="sm" data-a="x" aria-label="বাতিল">✕</button>`;
  b.querySelectorAll('[data-a]').forEach(x=>x.onclick=()=>mact(x.dataset.a))}
async function mact(k){
  if(k==='x'){ssel.clear();document.querySelectorAll('.msel').forEach(x=>x.checked=false);return msBar()}
  if(busy)return;const codes=[...ssel].map(r=>r.code);if(!codes.length)return;let act='svc_site_hide',a={codes};
  if(k==='hide'||k==='show'){a.on=k==='show';if(k==='hide'&&!confirm(bn(codes.length)+'টি সার্ভিস সাইট থেকে লুকানো হবে?'))return}
  else{act='svc_site_bulk';if(k==='tidy'){if(!confirm(bn(codes.length)+'টির নাম ও ক্যাটেগরি অটো সাজানো হবে?'))return;a.tidy=true}else{const c=prompt('নতুন ক্যাটেগরি (সবগুলোর জন্য)','');if(!c)return;a.category=c}}
  busy=true;try{const r=await api(act,a);toast(bn(r.done)+'টি হয়েছে');mload()}catch(e){if(!authFail(e))toast(e.message)}busy=false}

/* ---------- রাউটার, লগইন, ইনস্টল ---------- */
function route(){const h=decodeURIComponent(location.hash.replace('#',''));const bb=$('#bulk');if(bb)bb.hidden=true;sel.clear();ssel.clear();if(h==='cmp')cmp();else if(h==='chg')chg();else if(h==='tidy')tidy();else if(h==='plat')plat();else if(h==='mng')mng();else if(h.indexOf('pl=')===0)platPage(h.slice(3));else if(h.indexOf('p=')===0){st={q:'',state:'all',cat:'',off:0};provider(h.slice(2))}else home();$('#main').focus({preventScroll:true})}
function show(a){$('#login').hidden=a;$('#app').hidden=!a}
function logout(m){token='';ls.del('pb_studio_token');show(false);$('#loginErr').textContent=m||'';$('#tok').value=''}
$('#loginForm').onsubmit=async e=>{e.preventDefault();token=$('#tok').value.trim();const b=e.target.querySelector('button');b.disabled=true;$('#loginErr').textContent='';
  try{await api('svc_providers');ls.set('pb_studio_token',token);show(true);route()}catch(x){$('#loginErr').textContent=ERR[x.code]||('সংযোগ করা যায়নি — '+x.message)}b.disabled=false};
$('#logout').onclick=()=>logout();$('#back').onclick=()=>{location.hash=location.hash.indexOf('#pl=')===0?'plat':''};
addEventListener('hashchange',()=>token&&route());
let dip=null;addEventListener('beforeinstallprompt',e=>{e.preventDefault();dip=e;$('#install').hidden=false});
$('#install').onclick=async()=>{if(!dip)return;dip.prompt();await dip.userChoice;dip=null;$('#install').hidden=true};
const net=()=>{$('#net').hidden=navigator.onLine};addEventListener('online',net);addEventListener('offline',net);net();
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
token?(show(true),route()):show(false);
})();
