/* থিম: ডিফল্ট লাইট (সাইটের মতো); হেডারের বাটনে ডার্ক/লাইট বদল, localStorage-এ মনে থাকে। app.js-এ হাত দেওয়া হয়নি। */
(function(){'use strict';
var K='pb_studio_theme',d=document.documentElement;
function get(){try{var v=localStorage.getItem(K);return v==='dark'?'dark':'light'}catch(e){return'light'}}
function paint(t){d.setAttribute('data-theme',t);
  var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',t==='dark'?'#0B1626':'#0279B8');
  var b=document.getElementById('theme');if(b){b.textContent=t==='dark'?'☀':'☾';var l=t==='dark'?'লাইট থিমে যান':'ডার্ক থিমে যান';b.title=l;b.setAttribute('aria-label',l)}}
d.setAttribute('data-theme',get());
document.addEventListener('DOMContentLoaded',function(){paint(get());var b=document.getElementById('theme');
  if(b)b.addEventListener('click',function(){var n=d.getAttribute('data-theme')==='dark'?'light':'dark';try{localStorage.setItem(K,n)}catch(e){}paint(n)})});
})();
