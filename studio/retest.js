/* S6-১ — অটো রি-টেস্ট পাতা (Studio-v117)
   সাপ্তাহিক রি-টেস্ট চালু/বন্ধ · সীমা · প্ল্যাটফর্মের টেস্ট লিংক · শেষ রান · অটো-লুকানো সার্ভিস ফিরিয়ে আনা।
   ব্যাকএন্ড: PtRetest.gs (svc_retest_get / _set / _run / _restore) — Apps Script-এ নতুন ভার্সন ডেপ্লয় লাগে।
   app.js থেকে route() এ window.StudioRT.mount(ctx) ডাকা হয়। */
(function () {
  'use strict';
  var C = null, box = null, tok = 0, D = null, busy = false;
  var esc = function (s) { return C.esc(s); }, bn = function (n) { return C.bn(n); };
  var money = function (n) { return '৳' + bn(Math.round((+n || 0) * 100) / 100); };
  function when(ms) {
    if (!ms) return '—';
    var d = new Date(ms), p = function (x) { return (x < 10 ? '0' : '') + x; };
    return bn(p(d.getDate()) + '/' + p(d.getMonth() + 1) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()));
  }
  function ago(ms) { var h = Math.max(0, (Date.now() - ms) / 36e5); return h < 1 ? 'এইমাত্র' : h < 48 ? bn(Math.round(h)) + ' ঘণ্টা আগে' : bn(Math.round(h / 24)) + ' দিন আগে'; }
  function fail(e) { if (C.authFail && C.authFail(e)) return; var m = (e && e.message) || 'কাজ হয়নি'; if (e && e.code === 'unknown_action') m = 'সার্ভারে নতুন ব্যাকএন্ড নেই — Apps Script-এ PtRetest.gs যোগ করে নতুন ভার্সন ডেপ্লয় করুন'; return C.toast(m.length > 160 ? m.slice(0, 158) + '…' : m), m; }

  function mount(ctx) {
    C = ctx; tok++; D = null;
    var t = document.getElementById('title'), b = document.getElementById('back'); if (t) t.textContent = 'অটো রি-টেস্ট'; if (b) b.hidden = true;
    box = document.getElementById('main'); if (!box) return;
    box.innerHTML = '<div class="tq rt"><p class="sub">সাইটে চালু সার্ভিসগুলো সপ্তাহে একবার ন্যূনতম পরিমাণে নিজে থেকে টেস্ট হয়। পর পর ফেইল করলে সার্ভিস সাইট থেকে অটো লুকিয়ে যায়, টেলিগ্রামে জানায়।</p><div id="rtBody"><div class="sk"></div></div></div>';
    load();
  }
  async function load() {
    var my = tok, el = box && box.querySelector('#rtBody'); if (!el) return;
    try { var d = await C.api('svc_retest_get'); if (my !== tok) return; D = d; draw(); }
    catch (e) { if (my !== tok) return; var m = fail(e) || 'লোড হয়নি'; el.innerHTML = '<div class="card empty"><p class="err">' + esc(m) + '</p><button type="button" class="btn" id="rtRetry">আবার চেষ্টা</button></div>'; var r = el.querySelector('#rtRetry'); if (r) r.onclick = load; }
  }
  function draw() {
    var el = box && box.querySelector('#rtBody'); if (!el || !D) return; var c = D.cfg, h = [];
    var trig = D.trigger === true ? '<span class="ok">ট্রিগার চালু ✔</span>' : D.trigger === false ? (c.on ? '<span class="er">ট্রিগার নেই</span>' : '<span class="sub">ট্রিগার বন্ধ</span>') : '<span class="sub">ট্রিগার অজানা</span>';
    h.push('<div class="card tqc"><div class="rtrow"><div><h3>সাপ্তাহিক অটো রি-টেস্ট</h3><div class="sub">' + (c.on ? 'চালু · পরের টেস্ট ' + when(D.next_at) : 'বন্ধ — কোনো অর্ডার যাবে না') + '</div></div>' +
      '<button type="button" class="sw" id="rtOn" role="switch" aria-checked="' + c.on + '" aria-label="অটো রি-টেস্ট চালু/বন্ধ"></button></div>' +
      '<div class="rtst"><span>' + trig + '</span><span>চালু সার্ভিস: <b>' + bn(D.eligible) + '</b></span><span>ফলের অপেক্ষায়: <b>' + bn(D.pending) + '</b></span></div></div>');
    h.push('<div class="card tqc"><h3>সীমা</h3><div class="tqg">' +
      fld('rtPer', 'প্রতি রানে সর্বোচ্চ সার্ভিস', c.per_run, 1, 20) + fld('rtBud', 'প্রতি রানে বাজেট (৳)', c.budget_bdt, 10, 2000) +
      fld('rtDay', 'কত দিন পরপর', c.every_days, 3, 30) + fld('rtFl', 'পর পর কত ফেইলে লুকাবে', c.fail_limit, 1, 3) + '</div>' +
      fld('rtStk', 'এত ঘণ্টায় শেষ না হলে ফেইল', c.stuck_hrs, 24, 168) +
      '<p class="sub">ন্যূনতম পরিমাণেই অর্ডার যায়। খরচ আরও সীমিত থাকে স্টুডিওর অর্ডার-সীমায় (প্রতি অর্ডার ও দৈনিক)। ১ম ফেইলে সাথে সাথে একবার দ্বিতীয় সুযোগ দেওয়া হয়।</p>' +
      '<div class="acts"><button type="button" class="btn" id="rtSave">সীমা সেভ</button></div></div>');
    var pl = (D.plats || []).map(function (p) {
      return '<div class="rtpl" data-k="' + esc(p.key) + '"><b>' + esc(p.label) + '</b> <small>(' + bn(p.n) + 'টি সার্ভিস)</small>' +
        '<label>প্রোফাইল লিংক <small>(ফলোয়ার/সাবস্ক্রাইবার)</small><input type="url" inputmode="url" autocomplete="off" data-f="profile" value="' + esc(p.profile) + '" placeholder="https://"></label>' +
        '<label>পোস্ট লিংক <small>(লাইক/ভিউ/কমেন্ট)</small><input type="url" inputmode="url" autocomplete="off" data-f="post" value="' + esc(p.post) + '" placeholder="https://"></label></div>';
    }).join('');
    h.push('<div class="card tqc"><h3>টেস্ট লিংক</h3><p class="sub">যে প্ল্যাটফর্মের লিংক নেই, সেটার সার্ভিস টেস্ট হবে না। এমন একটা পাবলিক প্রোফাইল/পোস্ট দিন যেটায় ফলোয়ার-লাইক পাঠানো নিরাপদ।</p>' + (pl || '<p class="sub">সাইটে এখনো প্রভাইডার-সার্ভিস চালু নেই।</p>') +
      (pl ? '<div class="acts"><button type="button" class="btn" id="rtLk">লিংক সেভ</button></div>' : '') + '</div>');
    h.push('<div class="card tqc"><h3>এখনই চালান</h3><p class="sub">সাপ্তাহিক সময়ের অপেক্ষা না করে এখনই বিচার + নতুন টেস্ট চালায়। ১–২ মিনিট লাগতে পারে, টাকা খরচ হয় (বাজেটের মধ্যে)।</p><div class="acts"><button type="button" class="sm" id="rtRun">▶ এখন চালান</button></div></div>');
    var L = D.last;
    if (L) {
      h.push('<div class="card tqc"><h3>শেষ রান <small>(' + ago(L.at) + (L.manual ? ' · হাতে' : '') + ')</small></h3><div class="rtst"><span>নতুন অর্ডার <b>' + bn(L.placed) + '</b> (' + money(L.spent) + ')</span><span>পাস <b>' + bn(L.pass) + '</b></span><span>ফেইল <b>' + bn(L.fail) + '</b></span><span>অপেক্ষা <b>' + bn(L.wait) + '</b></span></div>' +
        ((L.skip || []).length ? '<details><summary>বাদ গেছে (' + bn(L.skip.length) + ')</summary><ul class="rtsk">' + L.skip.slice(0, 40).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></details>' : '') + '</div>');
    }
    h.push('<div class="card tqc"><h3>অটো-লুকানো সার্ভিস</h3>' + ((D.auto || []).length ? D.auto.map(function (a) {
      return '<div class="rtau"><div class="tqb"><span class="bnm">' + esc(a.name) + '</span><small>#' + esc(a.code) + ' · ' + esc(a.provider) + ' · ' + ago(a.at) + ' · ' + esc(a.why) + '</small></div><button type="button" class="sm" data-rs="' + esc(a.code) + '">ফিরিয়ে আনুন</button></div>';
    }).join('') : '<p class="sub">কোনো সার্ভিস অটো-লুকানো হয়নি।</p>') + '</div>');
    el.innerHTML = h.join('');
    bind(el);
  }
  function fld(id, label, v, lo, hi) { return '<label>' + label + '<input id="' + id + '" type="number" inputmode="numeric" min="' + lo + '" max="' + hi + '" value="' + esc(v) + '"></label>'; }
  function num(id) { var e = box.querySelector('#' + id); return e ? e.value : ''; }
  async function act(btn, fn) {
    if (busy) return; busy = true; var my = tok, old = btn && btn.textContent; if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try { await fn(); } catch (e) { fail(e); }
    busy = false; if (btn && my === tok) { btn.disabled = false; btn.textContent = old; }
  }
  function bind(el) {
    var on = el.querySelector('#rtOn');
    on.onclick = function () {
      var want = !D.cfg.on;
      if (want && !confirm('চালু করলে সাইটের সার্ভিসগুলোতে নিজে থেকে টেস্ট অর্ডার (টাকা খরচ) যাবে — সীমা: প্রতি রানে ' + D.cfg.per_run + 'টি, ৳' + D.cfg.budget_bdt + '। চালু করবেন?')) return;
      act(on, async function () { D = await C.api('svc_retest_set', { on: want }); C.toast(want ? 'চালু হয়েছে ✔' : 'বন্ধ হয়েছে'); draw(); });
    };
    el.querySelector('#rtSave').onclick = function (e) {
      act(e.currentTarget, async function () { D = await C.api('svc_retest_set', { per_run: num('rtPer'), budget_bdt: num('rtBud'), every_days: num('rtDay'), fail_limit: num('rtFl'), stuck_hrs: num('rtStk') }); C.toast('সেভ হয়েছে ✔'); draw(); });
    };
    var lk = el.querySelector('#rtLk');
    if (lk) lk.onclick = function (e) {
      var links = {}; el.querySelectorAll('.rtpl').forEach(function (p) { var o = {}; p.querySelectorAll('input[data-f]').forEach(function (i) { o[i.dataset.f] = i.value.trim(); }); links[p.dataset.k] = o; });
      act(e.currentTarget, async function () { D = await C.api('svc_retest_set', { links: links }); C.toast('লিংক সেভ হয়েছে ✔'); draw(); });
    };
    el.querySelector('#rtRun').onclick = function (e) {
      if (!confirm('এখনই টেস্ট অর্ডার দেবেন? (সর্বোচ্চ ' + D.cfg.per_run + 'টি, ৳' + D.cfg.budget_bdt + ' বাজেট)')) return;
      act(e.currentTarget, async function () { D = await C.api('svc_retest_run'); var r = D.report || {}; C.toast('অর্ডার ' + bn(r.placed || 0) + ' · ফেইল ' + bn(r.fail || 0) + ' · লুকানো ' + bn((r.hid || []).length)); draw(); });
    };
    el.querySelectorAll('[data-rs]').forEach(function (b) {
      b.onclick = function () { act(b, async function () { await C.api('svc_retest_restore', { code: b.dataset.rs }); C.toast('ফিরিয়ে আনা হয়েছে — ফোনের তালিকায় সিঙ্ক হলে দেখাবে'); D = await C.api('svc_retest_get'); draw(); }); };
    });
  }
  window.StudioRT = { mount: mount };
})();
