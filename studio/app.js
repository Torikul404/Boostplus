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
    const d=await pageRows('svc_list',{provider:p,q:st.q,state:st.state,category:st.cat,platform:st.plat||''},st.off,50,st.cat?'':(st.type||''));
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

/* ---------- প্ল্যাটফর্ম হাব ---------- */
let ps={q:'',type:'',state:'all',off:0};
async function plat(){
  cur=null;$('#title').textContent='প্ল্যাটফর্ম';$('#back').hidden=true;const el=$('#main');el.innerHTML=nav('plat')+'<div class="sk"></div>';
  try{const d=await api('svc_platforms');
    el.innerHTML=nav('plat')+'<p class="sub">লোগোতে ট্যাপ করুন — ১০ প্রভাইডারের ওই প্ল্যাটফর্মের সব সার্ভিস আসবে।</p><div class="pg">'+popSort(d.platforms.map(p=>Object.assign({n:p.total},p))).map(p=>`<a class="pt" href="#pl=${encodeURIComponent(p.label)}">${logo(p.label,52)}<b>${esc(p.label)}</b><span class="sub">${bn(p.total)}টি · সাইটে ${bn(p.site)}</span></a>`).join('')+'</div>'+(()=>{const rest=d.platforms.filter(p=>!isPop(p.label));return rest.length?`<select class="plmore" id="plr" aria-label="আরও প্ল্যাটফর্ম"><option value="">আরও প্ল্যাটফর্ম (${bn(rest.length)}টি) ▾</option>${rest.map(p=>`<option value="${esc(p.label)}">${esc(p.label)} (${bn(p.total)}টি · সাইটে ${bn(p.site)})</option>`).join('')}</select>`:''})();
    const pr=$('#plr');if(pr)pr.onchange=()=>{if(pr.value)location.hash='pl='+encodeURIComponent(pr.value)};
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
function editSheet(r){
  let dlg=$('#esh');if(!dlg){dlg=document.createElement('dialog');dlg.id='esh';document.body.appendChild(dlg)}
  const pls=[...new Set([r.platform,...PLAT.map(p=>p[0])].filter(Boolean))];
  dlg.innerHTML=`<form method="dialog"><h3 style="margin:0 0 8px">সম্পাদনা · ID ${esc(r.code)}</h3><label for="enm">সার্ভিসের নাম</label><input id="enm" maxlength="120" value="${esc(r.name)}"><label for="epl">প্ল্যাটফর্ম</label><select id="epl">${pls.map(p=>`<option${p===r.platform?' selected':''}>${esc(p)}</option>`).join('')}</select><label for="ect">ক্যাটেগরি</label><input id="ect" list="ects" value="${esc(r.category)}"><datalist id="ects">${(window._mc||[]).map(c=>`<option value="${esc(c)}">`).join('')}</datalist><p id="eer" class="err" role="alert"></p><div class="acts"><button class="sm" value="cancel" formnovalidate>বাতিল</button><button class="sm" id="etd" type="button">অটো সাজান</button><button class="btn" value="ok">সংরক্ষণ</button></div></form>`;
  $('#etd').onclick=()=>{const t=r.tidy||{};if(t.name)$('#enm').value=t.name;if(t.cat)$('#ect').value=t.cat};
  dlg.querySelector('form').onsubmit=e=>{if(e.submitter&&e.submitter.value==='ok'&&!$('#enm').value.trim()){e.preventDefault();$('#eer').textContent='নাম দিন'}};
  dlg.onclose=async()=>{if(dlg.returnValue!=='ok')return;
    try{await api('svc_site_edit',{code:r.code,name:$('#enm').value,platform:$('#epl').value,category:$('#ect').value});toast('সংরক্ষিত ✔');mload()}catch(e){if(!authFail(e))toast(e.message)}};
  dlg.showModal()}
async function catCodes(cat,state){const out=[];let off=0,tot=1;
  while(off<tot){const d=await api('svc_site_list',{q:'',platform:'',category:cat,state,offset:off,limit:100});tot=d.total;if(!d.rows.length)break;d.rows.forEach(r=>out.push(r.code));off+=d.rows.length}
  return out}
const chunks=(a,n)=>{const o=[];for(let i=0;i<a.length;i+=n)o.push(a.slice(i,i+n));return o};
async function catRename(cat){
  if(busy)return;const nn=(prompt('ক্যাটেগরির নতুন নাম',cat)||'').trim();if(!nn||nn===cat)return;
  if(nn.length>80){toast('নাম ৮০ অক্ষরের বেশি হবে না');return}
  busy=true;toast('দেখা হচ্ছে…');
  try{const codes=await catCodes(cat,'all');
    if(!codes.length){toast('এই ক্যাটেগরিতে কিছু নেই');busy=false;return}
    if(!confirm('"'+cat+'" ক্যাটেগরির '+bn(codes.length)+'টি সার্ভিসের ক্যাটেগরি বদলে "'+nn+'" হবে।'+(d_has(nn)?'\n(এই নামে আগে থেকেই ক্যাটেগরি আছে — দুটো মিশে যাবে)':'')+'\nচালিয়ে যাবেন?')){busy=false;return}
    let done=0;for(const c of chunks(codes,200)){const r=await api('svc_site_bulk',{codes:c,category:nn});done+=r.done}
    toast(bn(done)+'টির ক্যাটেগরি বদলেছে ✔');ms.cat=nn;ms.type=typeOf(nn);busy=false;mload()}
  catch(e){busy=false;if(!authFail(e))toast(e.message)}}
const d_has=n=>(window._mc||[]).indexOf(n)>=0;
async function catDelete(cat){
  if(busy)return;busy=true;toast('দেখা হচ্ছে…');
  try{const codes=await catCodes(cat,'on');
    if(!codes.length){toast('এই ক্যাটেগরিতে চালু সার্ভিস নেই');busy=false;return}
    if(!confirm('"'+cat+'" ক্যাটেগরির চালু '+bn(codes.length)+'টি সার্ভিস সাইট থেকে মুছে/লুকানো হবে।\n(পুরনোগুলো "লুকানো" ফিল্টার থেকে আবার ফেরানো যাবে)\nনিশ্চিত?')){busy=false;return}
    let done=0;for(const c of chunks(codes,200)){const r=await api('svc_site_hide',{codes:c,on:false,del:true});done+=r.done}
    toast(bn(done)+'টি সার্ভিস সরানো হয়েছে');ms.cat='';busy=false;mload()}
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
