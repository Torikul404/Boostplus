/* design/landing.js — R3: ল্যান্ডিং-এর "সম্প্রতি সম্পন্ন অর্ডার" স্ট্রিপ (শুধু গেস্টের জন্য)
   ডেটা: পাবলিক GET <api>?action=done_list (সম্পন্ন-অর্ডার ট্যাবের মতোই; কোড, সার্ভিসের নাম, পরিমাণ, সময় — কোনো ব্যক্তিগত তথ্য নেই)।
   ব্যর্থ হলে বা খালি হলে পুরো স্ট্রিপ লুকানো থাকে। Apps Script বদলাতে হয় না। */
(function () {
  var wrap = document.getElementById('lpDoneWrap'), box = document.getElementById('lpDone');
  if (!wrap || !box) return;
  var MAX = 4;
  // R8: server sends the duration as a (possibly Bangla) string; show it in English without a server change
  function tookEn(s) {
    var bn = '\u09E6\u09E7\u09E8\u09E9\u09EA\u09EB\u09EC\u09ED\u09EE\u09EF';
    return String(s == null ? '' : s)
      .replace(/[\u09E6-\u09EF]/g, function (c) { return String(bn.indexOf(c)); })
      .replace(/\u09B8\u09C7\u0995\u09C7\u09A8\u09CD\u09A1/g, 'sec')
      .replace(/\u09AE\u09BF\u09A8\u09BF\u099F/g, 'min')
      .replace(/\u0998\u09A3\u09CD\u099F\u09BE|\u0998\u09A8\u09CD\u099F\u09BE/g, 'h')
      .replace(/\u09A6\u09BF\u09A8/g, 'd')
      .trim();
  }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api() {
    try { return (typeof sheetApi === 'function' ? sheetApi() : '') || window.BOOSTPLUS_SHEET_API || ''; } catch (e) { return ''; }
  }
  function nameOf(x) {
    var nm = x.name || '';
    try {
      var p = (typeof allPackages !== 'undefined' ? allPackages : []).find(function (q) { return String(q.code) === String(x.code); });
      if (p && typeof pbDropdownName === 'function') nm = pbDropdownName(p) || nm;
    } catch (e) {}
    return nm || '—';
  }
  function render(d) {
    var items = ((d && d.items) || []).filter(function (x) { return x && x.took; }).slice(0, MAX);
    if (!items.length) return;
    box.innerHTML = items.map(function (x) {
      return '<article class="lp-done-card"><div class="lp-done-top"><span class="lp-done-code">#' + esc(x.code) + '</span><span class="lp-done-badge">✔ Completed</span></div>' +
        '<h4 class="lp-done-name">' + esc(nameOf(x)) + '</h4>' +
        '<div class="lp-done-meta"><span>Quantity <b>' + esc(Number(x.qty).toLocaleString('en-US')) + '</b></span><span>Took <b>' + esc(tookEn(x.took)) + '</b></span></div></article>';
    }).join('');
    wrap.hidden = false;
  }
  function load() {
    var a = api();
    if (!a) return;
    fetch(a + (a.indexOf('?') >= 0 ? '&' : '?') + 'action=done_list', { method: 'GET', cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.ok) render(d); })
      .catch(function () {});
  }
  var all = document.getElementById('lpDoneAll');
  if (all) all.addEventListener('click', function (e) {
    if (window.PB_nav && PB_nav.go) { e.preventDefault(); PB_nav.go('done'); }
  });
  // app-gate.js পরে body.pb-guest বসায়; একটু অপেক্ষা করে গেস্ট হলে তবেই লোড
  var tries = 0, t = setInterval(function () {
    tries++;
    if (document.body.classList.contains('pb-guest')) { clearInterval(t); load(); }
    else if (tries > 15) clearInterval(t);
  }, 300);
})();
