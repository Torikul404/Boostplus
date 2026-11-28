/* boostplus স্টুডিও — S7 ফোন UX। app.js-এ হাত দেওয়া হয়নি; শুধু DOM ও ইভেন্টের ওপর বসে।
   ১) দ্রুত সার্চ: হেডারের ⌕ বাটন ও "/" কী, সাম্প্রতিক সার্চ, বাংলা সংখ্যা → ইংরেজি, Enter-এ কীবোর্ড বন্ধ
   ২) এক-হাতে এড ফর্ম: কীবোর্ড-সচেতন নিচের শীট, ফিল্ডে ফোকাসে স্ক্রল, Enter = পরের ঘর, ব্যাকড্রপে ট্যাপ = বন্ধ
   ৩) নাম/ক্যাটেগরি অটো-সাজান: সাইটের ইংরেজি ধাঁচে (ফোকাস সরলে; "↶ আগেরটা" দিয়ে ফেরানো যায়)
   লজিক (tidy*) খাঁটি ফাংশন — window.StudioPhone দিয়ে Node/Playwright-এ পরীক্ষা হয়। */
(function(root){'use strict';

/* ================= ৩) সাজানোর লজিক (খাঁটি ফাংশন) ================= */
var PROV=['smmxpanel','getmyfollow','smmsun','smmstarpro','smmgen','socialpanel','smmrx','bdsmmpanel','amarboost','growfollows'];
var PROV_RE=new RegExp('\\b('+PROV.join('|')+')(?:\\.[a-z]{2,})?\\b','gi');
var URL_RE=/https?:\/\/\S+|www\.\S+/gi,DOM_RE=/\b[\w-]+\.(?:com|net|org|io|xyz|co|info|shop|top|site|online|pro|in)\b/gi,AT_RE=/(^|\s)@\w+/g;
var ACR={hq:'HQ',uhq:'UHQ',vip:'VIP',usa:'USA',uk:'UK',uae:'UAE',ksa:'KSA',smm:'SMM',api:'API',ai:'AI',ig:'IG',fb:'FB',yt:'YT',tg:'TG',nr:'NR',lq:'LQ',bd:'BD',eu:'EU',ott:'OTT',ugc:'UGC',asap:'ASAP'};
var BRAND={tiktok:'TikTok',youtube:'YouTube',whatsapp:'WhatsApp',linkedin:'LinkedIn',soundcloud:'SoundCloud',onlyfans:'OnlyFans',snapchat:'Snapchat',spotify:'Spotify',pinterest:'Pinterest',telegram:'Telegram',instagram:'Instagram',facebook:'Facebook',twitter:'Twitter',discord:'Discord',twitch:'Twitch'};
var SMALL={a:1,an:1,and:1,or:1,of:1,to:1,in:1,on:1,for:1,with:1,per:1,the:1,by:1,at:1};
var SEP='|·•—–';

function cut(s,n){var a=Array.from(s);if(a.length<=n)return s;return a.slice(0,n).join('').replace(new RegExp('[\\s'+SEP+'\\-:;,]+$'),'')}

/* একটা শব্দ (বিরামচিহ্ন বাদে মূল অংশ) ঠিক করে; first = বাক্যাংশের প্রথম শব্দ; mode = 'title' হলে বড়-ছোট হাতের অক্ষর নতুন করে বসায় */
function fixWord(core,first,mode){
  if(!/[A-Za-z]/.test(core)||/[^\x00-\x7F]/.test(core))return core;       /* বাংলা/ইমোজি/অন্য লিপি — ছোঁয়া হয় না */
  var low=core.toLowerCase();
  if(BRAND[low])return BRAND[low];
  if(ACR[low])return ACR[low];
  if(/^\d+[a-z]$/i.test(core))return core.toUpperCase();                    /* 30d → 30D, 10k → 10K */
  if(/^r\d+$/i.test(core))return core.toUpperCase();                        /* r30 → R30 */
  if(mode!=='title')return core;
  if(core.indexOf('-')>0&&core.indexOf('-')<core.length-1)
    return core.split('-').map(function(p,i){return p?fixWord(p,first&&i===0,mode):p}).join('-');
  if(/\d/.test(core))return core;
  if(!first&&SMALL[low])return low;
  return low.charAt(0).toUpperCase()+low.slice(1)}

function tidyText(input,o){
  o=o||{};var notes=[],s0=String(input==null?'':input),s=s0;
  try{s=s.normalize('NFKC')}catch(e){}
  s=s.replace(/[​-‍⁠﻿]/g,'');
  var before=s;
  s=s.replace(URL_RE,' ').replace(PROV_RE,' ').replace(DOM_RE,' ').replace(AT_RE,'$1 ');
  if(s!==before)notes.push('লিংক/প্রভাইডারের নাম সরানো হয়েছে');
  /* ফাঁক ও বিভাজক */
  before=s;
  s=s.replace(/\s+/g,' ')
    .replace(/\s*\|\s*/g,' | ').replace(/\s*([·•])\s*/g,' $1 ')
    .replace(/\(\s+/g,'(').replace(/\s+\)/g,')').replace(/\[\s+/g,'[').replace(/\s+\]/g,']')
    .replace(/\(\s*\)|\[\s*\]/g,' ').replace(/\s+,/g,',').replace(/\s+/g,' ');
  /* পরপর বিভাজক → প্রথমটাই */
  var rep=new RegExp('([\\'+SEP.split('').join('\\')+'])(?:\\s*[\\'+SEP.split('').join('\\')+'])+','g');
  s=s.replace(rep,'$1');
  s=s.replace(new RegExp('^[\\s'+SEP+'\\-:;,]+|[\\s'+SEP+'\\-:;,]+$','g'),'').replace(/\s+/g,' ');
  if(s!==before&&s.replace(/\s+/g,'')!==before.replace(/\s+/g,''))notes.push('ফাঁকা/বিভাজক ঠিক করা হয়েছে');
  else if(s!==before)notes.push('বাড়তি ফাঁকা সরানো হয়েছে');
  /* একই শব্দ পরপর দুবার */
  before=s;
  s=s.replace(/\b([A-Za-z]{2,})(\s+\1)+\b/gi,'$1');
  if(s!==before)notes.push('দুবার লেখা শব্দ একটা করা হয়েছে');
  /* বড়-ছোট হাতের অক্ষর */
  var letters=s.replace(/[^A-Za-z]/g,''),mode=(letters.length>=3&&(letters===letters.toLowerCase()||letters===letters.toUpperCase()))?'title':'keep';
  before=s;
  var segFirst=true;
  s=s.split(/(\s+)/).map(function(t){
    if(/^\s+$/.test(t))return t;
    var m=t.match(/^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$/),core=m[2];
    var out=m[1]+fixWord(core,segFirst,mode)+m[3];
    segFirst=(SEP.indexOf(t)>=0&&t.length===1)||/^[|·•—–]$/.test(t);       /* বিভাজকের পরের শব্দ বড় হাতে */
    return out}).join('');
  if(s!==before)notes.push(mode==='title'?'ইংরেজি ধাঁচে (Title Case) সাজানো হয়েছে':'ব্র্যান্ড/সংক্ষেপ ঠিক করা হয়েছে (TikTok, HQ …)');
  var max=o.max||120;
  if(Array.from(s).length>max){s=cut(s,max);notes.push(max+' অক্ষরে ছোট করা হয়েছে')}
  return{text:s,changed:s!==s0.trim()&&s!==s0,notes:notes}}

/* ক্যাটেগরির চাবি: ইমোজি/চিহ্ন বাদ, ছোট হাত — সাইটের ক্যাটেগরির সাথে মেলাতে */
function catKey(c){return String(c==null?'':c).normalize('NFKC').replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}️‍⃣]/gu,'').toLowerCase().replace(/[^a-z0-9ঀ-৿]+/g,' ').trim()}
function tokKey(c){return catKey(c).split(' ').filter(Boolean).sort().join(' ')}

/* opts = [{value,label}] — সাইটে থাকা ক্যাটেগরি; মিললে সাইটের হুবহু বানান নেয় (ডুপ্লিকেট ক্যাটেগরি আটকায়) */
function tidyCat(input,opts){
  var r=tidyText(input),k=catKey(r.text),tk=tokKey(r.text),hit=null;
  if(k&&opts&&opts.length){
    for(var i=0;i<opts.length&&!hit;i++)if(opts[i].value&&catKey(opts[i].value)===k)hit=opts[i];
    for(var j=0;j<opts.length&&!hit;j++)if(opts[j].value&&tokKey(opts[j].value)===tk)hit=opts[j]}
  if(hit&&hit.value!==r.text){r.text=hit.value;r.changed=String(input).trim()!==hit.value;r.notes.push('সাইটের ক্যাটেগরির হুবহু বানান বসানো হয়েছে')}
  else if(hit)r.changed=String(input)!==hit.value;
  return r}

/* ================= DOM অংশ (ব্রাউজারে) ================= */
root.StudioPhone={tidyText:tidyText,tidyName:function(s){return tidyText(s,{max:120})},tidyCat:tidyCat,catKey:catKey};
if(typeof document==='undefined')return;
var d=document,$=function(s,r){return(r||d).querySelector(s)},ls={get:function(k){try{return localStorage.getItem(k)}catch(e){return null}},set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
var coarse=false;try{coarse=matchMedia('(pointer:coarse)').matches}catch(e){}
function vis(el){return !!(el&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden')}
function fire(el,t){el.dispatchEvent(new Event(t,{bubbles:true}))}

/* ---------- ১) দ্রুত সার্চ ---------- */
var RK='pb_recent_q',REC=[];
try{var a=JSON.parse(ls.get(RK)||'[]');if(Array.isArray(a))REC=a.filter(function(x){return typeof x==='string'}).slice(0,8)}catch(e){}
function remember(v){v=String(v||'').trim();if(v.length<2||v.length>60)return;
  REC=REC.filter(function(x){return x.toLowerCase()!==v.toLowerCase()});REC.unshift(v);REC=REC.slice(0,8);ls.set(RK,JSON.stringify(REC))}
var SQ='input[type=search]',panel=null,pIn=null,hideT=0;
function enhance(i){if(i.dataset.phs)return;i.dataset.phs='1';
  i.setAttribute('enterkeyhint','search');i.setAttribute('autocomplete','off');i.setAttribute('autocapitalize','none');i.setAttribute('autocorrect','off');i.setAttribute('spellcheck','false')}
function scan(r){(r||d).querySelectorAll(SQ).forEach(enhance)}
function hidePanel(){if(panel){panel.hidden=true}pIn=null}
function showPanel(i){
  var v=i.value.trim().toLowerCase(),L=REC.filter(function(x){var l=x.toLowerCase();return l!==v&&(!v||l.indexOf(v)===0)}).slice(0,6);
  if(!L.length){hidePanel();return}
  if(!panel){panel=d.createElement('div');panel.id='phRec';panel.setAttribute('role','listbox');panel.setAttribute('aria-label','সাম্প্রতিক সার্চ');
    panel.addEventListener('pointerdown',function(e){e.preventDefault()});     /* ইনপুটের ফোকাস না হারাতে */
    panel.addEventListener('click',function(e){var b=e.target.closest('button');if(!b||!pIn)return;
      if(b.dataset.clr){REC=[];ls.set(RK,'[]');hidePanel();return}
      var i2=pIn;i2.value=b.dataset.q;fire(i2,'input');remember(b.dataset.q);hidePanel();i2.blur()})}
  var host=i.closest('dialog')||d.body;if(panel.parentNode!==host)host.appendChild(panel);
  panel.innerHTML='<span class="phh">সাম্প্রতিক</span>'+L.map(function(x){return '<button type="button" class="chip" role="option" data-q="'+x.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')+'"></button>'}).join('')+'<button type="button" class="phx" data-clr="1" aria-label="সাম্প্রতিক সার্চ মুছুন">মুছুন</button>';
  panel.querySelectorAll('.chip').forEach(function(b){b.textContent=b.dataset.q});
  var r=i.getBoundingClientRect();panel.style.left=Math.max(8,r.left)+'px';panel.style.top=(r.bottom+4)+'px';panel.style.width=Math.min(r.width,innerWidth-16)+'px';
  panel.hidden=false;pIn=i}
d.addEventListener('focusin',function(e){var t=e.target;if(t.matches&&t.matches(SQ)){enhance(t);clearTimeout(hideT);showPanel(t)}},true);
d.addEventListener('focusout',function(e){var t=e.target;if(t.matches&&t.matches(SQ)){remember(t.value);hideT=setTimeout(hidePanel,150)}},true);
d.addEventListener('scroll',function(){if(pIn)hidePanel()},true);
/* বাংলা সংখ্যা → ইংরেজি (আইডি/দাম খুঁজতে) — app.js-এর হ্যান্ডলারের আগে চলে (capture) */
d.addEventListener('input',function(e){var t=e.target;if(!(t.matches&&t.matches(SQ)))return;
  var v=t.value;if(/[০-৯]/.test(v)){var p=t.selectionStart;t.value=v.replace(/[০-৯]/g,function(c){return String(c.charCodeAt(0)-0x09E6)});try{t.setSelectionRange(p,p)}catch(x){}}
  if(panel&&!panel.hidden||d.activeElement===t)showPanel(t)},true);
d.addEventListener('keydown',function(e){var t=e.target;
  if(t.matches&&t.matches(SQ)){if(e.key==='Enter'){e.preventDefault();remember(t.value);hidePanel();t.blur()}else if(e.key==='Escape'&&t.value){t.value='';fire(t,'input');e.stopPropagation()}return}
  if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!/^(INPUT|TEXTAREA|SELECT)$/.test((t.tagName||''))&&!t.isContentEditable&&!d.querySelector('dialog[open]')){e.preventDefault();quick()}});
function quick(){var i=[].slice.call(d.querySelectorAll('#main '+SQ)).filter(vis)[0];
  if(i){i.scrollIntoView({block:'center'});i.focus();try{i.select()}catch(e){}return}
  location.hash='#cmp';var n=0,t=setInterval(function(){var c=$('#cq');if(c&&vis(c)){clearInterval(t);c.focus()}else if(++n>20)clearInterval(t)},100)}
(function(){var tools=$('.tools');if(!tools||$('#qs'))return;var b=d.createElement('button');b.id='qs';b.type='button';b.className='ib';b.title='খুঁজুন ( / )';b.setAttribute('aria-label','খুঁজুন');
  b.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
  b.addEventListener('click',quick);tools.insertBefore(b,tools.firstChild)})();
/* ফোনে: "আরও" মেনুর প্রথম টাইল = খুঁজুন (shell.js-এর ডায়ালগ প্রথম ট্যাপে তৈরি হয়; এই লিসেনার তার পরে চলে) */
(function(){var mb=$('#moreB');if(!mb)return;
  mb.addEventListener('click',function(){var dl=$('#moreD');if(!dl||dl.querySelector('#phQs'))return;
    var w=d.createElement('div');w.className='mg';
    w.innerHTML='<button type="button" class="mi" id="phQs"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><span>খুঁজুন</span></button>';
    var h=dl.querySelector('h3');if(h)h.insertAdjacentElement('afterend',w);else dl.insertBefore(w,dl.firstChild);
    w.firstChild.addEventListener('click',function(){dl.close();setTimeout(quick,60)})})})();

/* ---------- ২) এক-হাতে এড ফর্ম ---------- */
function vv(){var v=root.visualViewport,h=v?v.height:innerHeight,off=v?Math.max(0,innerHeight-v.height-v.offsetTop):0,s=d.documentElement.style;
  s.setProperty('--phvh',Math.round(h)+'px');s.setProperty('--phoff',Math.round(off)+'px')}
vv();if(root.visualViewport){root.visualViewport.addEventListener('resize',vv);root.visualViewport.addEventListener('scroll',vv)}addEventListener('resize',vv);
var SH='#sheet,#bsheet';
d.addEventListener('focusin',function(e){var t=e.target;if(!t.closest||!t.closest(SH)||!/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))return;
  setTimeout(function(){try{t.scrollIntoView({block:'center',behavior:'smooth'})}catch(x){}},260)});
/* ব্যাকড্রপে ট্যাপ = বাতিল (শুধু একটা-একটা এডে; কিউ চললে ভুল ট্যাপে বাদ না পড়তে বন্ধ) */
var dn=null;d.addEventListener('pointerdown',function(e){dn=e.target},true);
d.addEventListener('click',function(e){var t=e.target;if(t.id!=='sheet'||dn!==t||!t.open)return;var st=$('#shStop');if(st&&!st.hidden)return;t.close('cancel')});
/* ফোনে শীট খুললে কীবোর্ড নিজে থেকে উঠে ফর্ম ঢাকে না — ফোকাস সরিয়ে নেওয়া (ডেস্কটপে অপরিবর্তিত) */
function sheetNav(){
  var n=$('#shName'),c=$('#shCat');
  if(n){n.setAttribute('enterkeyhint','next');n.setAttribute('autocomplete','off');n.setAttribute('autocapitalize','words')}
  if(c){c.setAttribute('enterkeyhint','done');c.setAttribute('autocapitalize','words')}}
sheetNav();
d.addEventListener('keydown',function(e){var t=e.target;if(e.key!=='Enter'||!t.id)return;
  if(t.id==='shName'){e.preventDefault();tidyField(t);var c=$('#shCat');if(c)c.focus()}
  else if(t.id==='shCat'){e.preventDefault();tidyField(t);t.blur()}},true);

/* ---------- ৩) অটো-সাজান (DOM) ---------- */
/* v143: সার্ভিসের নাম (#shName, .bn) প্রভাইডারের হুবহু থাকে — অটো-সাজান শুধু ক্যাটেগরিতে */
var TF='#shCat,#bsl .bc,#tres .tn,#tres .tc';
var notes=new WeakMap(),down=false,pend=[];
function flush(){down=false;pend.splice(0).forEach(function(n){if(n.el.isConnected&&n.el.closest('dialog[open]'))n.el.hidden=false})}
d.addEventListener('pointerdown',function(){down=true},true);d.addEventListener('pointerup',function(){setTimeout(flush,0)},true);d.addEventListener('pointercancel',flush,true);
function optsFor(f){var s=null;
  if(f.id==='shCat')s=$('#shCs');else if(f.classList.contains('bc')){var c=f.closest('.bsi');s=c&&c.querySelector('.bcs')}
  if(!s)return null;return[].slice.call(s.options).map(function(o){return{value:o.value,label:o.textContent}})}
function isCat(f){return f.id==='shCat'||f.classList.contains('bc')||f.classList.contains('tc')}
function noteFor(f){var n=notes.get(f);if(n&&n.el.isConnected)return n;
  var el=d.createElement('div');el.className='phn';el.hidden=true;el.setAttribute('aria-live','polite');
  el.innerHTML='<span class="phm"></span> <button type="button" class="phu">↶ আগেরটা</button>';
  f.insertAdjacentElement('afterend',el);n={el:el,prev:''};notes.set(f,n);
  el.querySelector('.phu').addEventListener('click',function(){f.value=n.prev;fire(f,'input');f.dataset.phSkip=n.prev;el.hidden=true;f.focus()});
  return n}
function tidyField(f){
  if(!f||f.dataset.phBusy)return;var cur=f.value;if(!cur.trim()){var n0=notes.get(f);if(n0)n0.el.hidden=true;return}
  if(f.dataset.phSkip===cur)return;
  var r=isCat(f)?tidyCat(cur,optsFor(f)):tidyText(cur,{max:120});
  if(!r.changed||r.text===cur||!r.text)return;
  var n=noteFor(f);n.prev=cur;f.dataset.phBusy='1';f.value=r.text;fire(f,'input');delete f.dataset.phBusy;
  n.el.querySelector('.phm').textContent='✨ সাজানো হয়েছে'+(r.notes.length?' — '+r.notes[0]:'');
  /* আঙুল/মাউস চেপে থাকলে (যেমন "চালু করুন" চাপতে গিয়ে ফোকাস সরলো) নোট পরে দেখানো — নইলে ফর্ম নড়ে গিয়ে ট্যাপ/ক্লিক হারায় */
  if(down){pend.push(n)}else n.el.hidden=false}
d.addEventListener('focusout',function(e){var t=e.target;if(t.matches&&t.matches(TF))tidyField(t)},true);
/* ব্যবহারকারী আবার লিখলে "আগেরটা" দেখানো ও স্কিপ-চিহ্ন বাতিল */
d.addEventListener('input',function(e){var t=e.target;if(!(t.matches&&t.matches(TF))||t.dataset.phBusy)return;
  delete t.dataset.phSkip;var n=notes.get(t);if(n)n.el.hidden=true},true);

/* শীট খুললে: ফোনে কীবোর্ড সরানো + আগে থেকে ভরা নাম/ক্যাটেগরি একবার সাজানো */
function onOpen(dlg){
  if(coarse){var a=d.activeElement;if(a&&a!==d.body&&dlg.contains(a)&&a.blur)a.blur()}
  setTimeout(function(){dlg.querySelectorAll(TF).forEach(function(f){if(vis(f))tidyField(f)})},60)}
['#sheet','#bsheet'].forEach(function(sel){var dlg=$(sel);if(!dlg)return;
  new MutationObserver(function(){if(dlg.open)onOpen(dlg);else{dlg.querySelectorAll('.phn').forEach(function(n){n.hidden=true})}}).observe(dlg,{attributes:true,attributeFilter:['open']})});

scan();new MutationObserver(function(m){for(var i=0;i<m.length;i++)for(var j=0;j<m[i].addedNodes.length;j++){var n=m[i].addedNodes[j];if(n.nodeType===1){if(n.matches&&n.matches(SQ))enhance(n);else if(n.querySelectorAll)scan(n)}}}).observe(d.body,{childList:true,subtree:true});
})(typeof window!=='undefined'?window:globalThis);
