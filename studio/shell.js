/* S2 — নতুন কাঠামো: মোবাইলে নিচের বার (৪ + "আরও"), ডেস্কটপে গ্রুপ করা সাইডবার। app.js-এ হাত দেওয়া হয়নি:
   রাউটিং হ্যাশ দিয়েই চলে (#plat, #mng …); পুরনো পেজ-ভিতরের চিপ বার CSS-এ লুকানো, ব্যতিক্রমের সংখ্যা সেখান থেকে পড়া হয়। */
(function(){'use strict';
var I={
exc:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
prov:'<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/>',
plat:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
dash:'<path d="M3 13h8V3H3zM13 21h8V11h-8zM13 3v6h8V3zM3 21h8v-6H3z"/>',
mng:'<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
cats:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',
tidy:'<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/>',
best:'<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
spd:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
guard:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4"/>',
bk:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
rate:'<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
bal:'<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 12h.01M3 9h18"/>',
rt:'<path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5M12 7v5l3 2"/>',
tq:'<path d="M9 3h6M10 3v6L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9V3M7.5 15h9"/>',
cmp:'<path d="M6 20V10M12 20V4M18 20v-6"/>',
chg:'<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
poster:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
more:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'};
/* [হ্যাশ, নাম, আইকন] */
var G=[['কাজ',[['dash','ড্যাশবোর্ড','dash'],['exc','ব্যতিক্রম','exc'],['','প্রভাইডার','prov'],['plat','প্ল্যাটফর্ম','plat']]],
['ম্যানেজ',[['mng','ম্যানেজ','mng'],['cats','ক্যাটেগরি','cats'],['tidy','সাজান','tidy'],['bk','ব্যাকআপ','bk']]],
['বিশ্লেষণ',[['best','সেরা','best'],['tq','টেস্ট কিউ','tq'],['rt','অটো রি-টেস্ট','rt'],['bal','ব্যালেন্স','bal'],['rate','রেট সতর্কতা','rate'],['guard','অটো-বন্ধ','guard'],['spd','স্পিড','spd'],['cmp','তুলনা','cmp'],['chg','পরিবর্তন','chg']]],
['টুলস',[['poster','পোস্টার','poster']]]];
var BOT=['exc','','plat','mng'];
function ic(k){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+I[k]+'</svg>'}
function key(){var h='';try{h=decodeURIComponent(location.hash.replace('#',''))}catch(e){}
  if(h.indexOf('p=')===0||h==='')return '';if(h.indexOf('pl=')===0)return 'plat';if(h.indexOf('cat=')===0)return 'cats';return h}
var side=document.getElementById('side'),bot=document.getElementById('bottom'),dlg=null,exN='';
if(!side||!bot)return;
function link(x,cls){return '<a class="nv'+(cls?' '+cls:'')+'" href="#'+x[0]+'" data-k="'+x[0]+'">'+ic(x[2])+'<span>'+x[1]+'</span>'+(x[0]==='exc'?'<i class="bdg" hidden></i>':'')+'</a>'}
var all=[];G.forEach(function(g){g[1].forEach(function(x){all.push(x)})});
side.innerHTML='<div class="brand"><span class="bm">B</span><span><b>Boost Plus</b><small>সার্ভিস স্টুডিও</small></span></div>'+
 G.map(function(g){return '<p class="gh">'+g[0]+'</p>'+g[1].map(function(x){return link(x)}).join('')}).join('');
bot.innerHTML=BOT.map(function(k){return link(all.filter(function(x){return x[0]===k})[0])}).join('')+
 '<button type="button" class="nv" id="moreB" aria-haspopup="dialog" data-k="@more">'+ic('more')+'<span>আরও</span></button>';
function mkDlg(){dlg=document.createElement('dialog');dlg.id='moreD';dlg.setAttribute('aria-label','আরও মেনু');
  dlg.innerHTML='<h3 style="margin:0 0 6px">আরও</h3>'+G.map(function(g){var L=g[1].filter(function(x){return BOT.indexOf(x[0])<0});
    return L.length?'<p class="gh">'+g[0]+'</p><div class="mg">'+L.map(function(x){return '<a class="mi" href="#'+x[0]+'">'+ic(x[2])+'<span>'+x[1]+'</span></a>'}).join('')+'</div>':''}).join('')+
    '<div class="acts"><button type="button" class="sm" id="moreX">বন্ধ</button></div>';
  document.body.appendChild(dlg);dlg.addEventListener('click',function(e){if(e.target===dlg||e.target.closest('a')||e.target.id==='moreX')dlg.close()})}
document.getElementById('moreB').addEventListener('click',function(){if(!dlg)mkDlg();dlg.showModal()});
function paint(){var k=key(),inBot=BOT.indexOf(k)>=0;
  document.querySelectorAll('#side .nv,#bottom .nv').forEach(function(a){var d=a.getAttribute('data-k'),on=d==='@more'?!inBot:d===k;if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  document.querySelectorAll('.bdg').forEach(function(b){b.hidden=!exN;b.textContent=exN})}
function count(){var a=document.querySelector('.chips[role=navigation] a[href="#exc"]'),m=a&&a.textContent.match(/[0-9\u09E6-\u09EF]+/);var n=m?m[0]:'';if(n!==exN){exN=n;paint()}}
addEventListener('hashchange',paint);
var mn=document.getElementById('main');if(mn)new MutationObserver(count).observe(mn,{childList:true,subtree:true});
paint();count();
})();
