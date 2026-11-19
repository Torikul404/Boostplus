/* S6-৪ — অটো-বন্ধ পাতা (Studio-v120)
   পর পর অর্ডার ফেইল হলে সার্ভিস সাময়িক লুকানো, মেয়াদ শেষে নিজে ফেরে · চালু/বন্ধ · সীমা · এখন চেক · "ফিরিয়ে আনুন"।
   ব্যাকএন্ড: PtGuard.gs (svc_guard_get / _set / _check / _release) — Apps Script-এ নতুন ভার্সন ডেপ্লয় লাগে। app.js থেকে window.StudioGUARD.mount(ctx)। */
(function () {
  'use strict';
  var C = null, box = null, tok = 0, D = null, busy = false;
  var esc = function (s) { return C.esc(s); }, bn = function (n) { return C.bn(n); };
  function ago(ms) { var h = Math.max(0, (Date.now() - ms) / 36e5); return h < 1 ? 'এইমাত্র' : h < 48 ? bn(Math.round(h)) + ' ঘণ্টা আগে' : bn(Math.round(h / 24)) + ' দিন আগে'; }
  function left(ms) { var h = (ms - Date.now()) / 36e5; return h <= 0 ? 'এখনই ফিরবে' : h < 1 ? 'এক ঘণ্টার মধ্যে ফিরবে' : bn(Math.round(h)) + ' ঘণ্টা পরে ফিরবে'; }
  function fail(e) { if (C.authFail && C.authFail(e)) return ''; var m = (e && e.message) || 'কাজ হয়নি'; if (e && e.code === 'unknown_action') m = 'সার্ভারে নতুন ব্যাকএন্ড নেই — Apps Script-এ PtGuard.gs যোগ করে নতুন ভার্সন ডেপ্লয় করুন'; C.toast(m.length > 160 ? m.slice(0, 158) + '…' : m); return m; }
  function mount(ctx) {
    C = ctx; tok++; D = null;
    var t = document.getElementById('title'), b = document.getElementById('back'); if (t) t.textContent = 'অটো-বন্ধ'; if (b) b.hidden = true;
    box = document.getElementById('main'); if (!box) return;
    box.innerHTML = '<div class="tq rt"><p class="sub">কোনো সার্ভিসের অর্ডার পর পর কয়েকবার ফেইল (partial/canceled/refunded) হলে সার্ভিসটা সাইট থেকে সাময়িক লুকানো হয়, মেয়াদ শেষে নিজে ফেরে — গ্রাহক খারাপ সার্ভিসে অর্ডার দেওয়ার আগেই। এই চেকে কোনো খরচ নেই।</p><div id="gdBody"><div class="sk"></div></div></div>';
    load();
  }
  async function load() {
    var my = tok, el = box && box.querySelector('#gdBody'); if (!el) return;
    try { var d = await C.api('svc_guard_get'); if (my !== tok) return; D = d; draw(); }
    catch (e) { if (my !== tok) return; var m = fail(e); if (m === '') return; el.innerHTML = '<div class="card empty"><p class="err">' + esc(m) + '</p><button type="button" class="btn" id="gdRetry">আবার চেষ্টা</button></div>'; var r = el.querySelector('#gdRetry'); if (r) r.onclick = load; }
  }
  function draw() {
    var el = box && box.querySelector('#gdBody'); if (!el || !D) return; var c = D.cfg, h = [], L = D.last;
    var trig = D.trigger === true ? '<span class="ok">ট্রিগার চালু ✔</span>' : D.trigger === false ? (c.on ? '<span class="er">ট্রিগার নেই</span>' : '<span class="sub">ট্রিগার বন্ধ</span>') : '<span class="sub">ট্রিগার অজানা</span>';
    h.push('<div class="card tqc"><div class="rtrow"><div><h3>অটো-বন্ধ</h3><div class="sub">' + (c.on ? 'চালু · প্রতি ২ ঘণ্টায় চেক' : 'বন্ধ — কিছু লুকাবে না, শুধু দেখাবে কোনগুলো বন্ধ হতো') + '</div></div>' +
      '<button type="button" class="sw" id="gdOn" role="switch" aria-checked="' + c.on + '" aria-label="অটো-বন্ধ চালু/বন্ধ"></button></div><div class="rtst"><span>' + trig + '</span></div></div>');
    h.push('<div class="card tqc"><h3>সীমা</h3><div class="tqg"><label>পর পর কত ফেইলে বন্ধ<input id="gdN" type="number" inputmode="numeric" min="2" max="20" value="' + esc(c.fail_n) + '"></label>' +
      '<label>কত ঘণ্টা বন্ধ থাকবে<input id="gdH" type="number" inputmode="numeric" min="1" max="168" value="' + esc(c.hold_hrs) + '"></label>' +
      '<label>কত দিনের অর্ডার দেখবে<input id="gdD" type="number" inputmode="numeric" min="1" max="60" value="' + esc(c.lookback_days) + '"></label>' +
      '<label>একবারে সর্বোচ্চ কয়টি<input id="gdM" type="number" inputmode="numeric" min="1" max="50" value="' + esc(c.max_per_run) + '"></label></div>' +
      '<p class="sub">একটা সফল (completed) অর্ডারেই ধারা ভেঙে যায়। চলমান অর্ডার গোনা হয় না।</p><div class="acts"><button type="button" class="btn" id="gdSave">সেভ</button></div></div>');
    var hl = D.held || [];
    h.push('<div class="card tqc"><h3>এখন সাময়িক বন্ধ (' + bn(hl.length) + ')</h3>' + (hl.length ? hl.map(function (x) {
      return '<div class="rtau"><div class="tqb"><span class="bnm">' + esc(x.code) + ' · ' + esc(x.provider) + '</span><small>' + esc(x.name) + '</small><small>পর পর ' + bn(x.streak) + 'টি ফেইল · ' + left(x.until) + '</small></div><div class="rtss"><button type="button" class="sm" data-rel="' + esc(x.code) + '">ফিরিয়ে আনুন</button></div></div>';
    }).join('') : '<p class="sub">কোনো সার্ভিস এখন অটো-বন্ধ নেই।</p>') + '</div>');
    var tgm = L && L.tg === 'sent' ? ' · টেলিগ্রামে গেছে' : L && L.tg === 'not_configured' ? ' · টেলিগ্রাম কনফিগ নেই' : '';
    var fl = (L && L.flagged) || [];
    h.push('<div class="card tqc"><h3>' + (c.on ? 'শেষ চেক' : 'বন্ধ হতো (পরীক্ষা)') + (L ? ' <small>(' + ago(L.at) + ')</small>' : '') + '</h3>' +
      (L ? '<p class="sub">' + bn(L.checked) + 'টি সার্ভিস দেখা হয়েছে' + (c.on ? ' · ' + bn(L.held_now) + 'টি বন্ধ, ' + bn(L.released) + 'টি ফিরেছে' : '') + tgm + '</p>' : '') +
      (L ? (fl.length ? fl.map(function (x) { return '<div class="rtau"><div class="tqb"><span class="bnm">' + esc(x.code) + ' · ' + esc(x.provider) + '</span><small>' + esc(x.name) + '</small></div><div class="rtss"><span class="er">পর পর ' + bn(x.streak) + 'টি ফেইল</span></div></div>'; }).join('') +
        (L.flagged_n > fl.length ? '<p class="sub">আরও ' + bn(L.flagged_n - fl.length) + 'টি আছে।</p>' : '') : '<p class="ok">সব ঠিক আছে ✔ — কোনো সার্ভিসে পর পর ফেইল নেই।</p>') : '<p class="sub">এখনো চেক হয়নি — নিচের বাটনে চাপুন।</p>') +
      '<div class="acts"><button type="button" class="sm" id="gdRun">🔄 এখন চেক করুন</button></div></div>');
    el.innerHTML = h.join(''); bind(el);
  }
  function v(id) { var e = box.querySelector('#' + id); return e ? e.value : ''; }
  async function act(btn, fn) {
    if (busy) return; busy = true; var my = tok, old = btn && btn.textContent; if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try { await fn(); } catch (e) { fail(e); }
    busy = false; if (btn && my === tok) { btn.disabled = false; btn.textContent = old; }
  }
  function bind(el) {
    var on = el.querySelector('#gdOn');
    on.onclick = function () {
      var want = !D.cfg.on;
      if (want && !confirm('অটো-বন্ধ চালু হলে পর পর ' + bn(D.cfg.fail_n) + 'টি ফেইল হওয়া সার্ভিস নিজে থেকেই সাইট থেকে লুকাবে (' + bn(D.cfg.hold_hrs) + ' ঘণ্টা)। চালু করবেন?')) return;
      act(on, async function () { D = await C.api('svc_guard_set', { on: want }); C.toast(want ? 'চালু হয়েছে ✔' : 'বন্ধ হয়েছে'); draw(); });
    };
    el.querySelector('#gdSave').onclick = function (e) { act(e.currentTarget, async function () { D = await C.api('svc_guard_set', { fail_n: v('gdN'), hold_hrs: v('gdH'), lookback_days: v('gdD'), max_per_run: v('gdM') }); C.toast('সেভ হয়েছে ✔'); draw(); }); };
    el.querySelector('#gdRun').onclick = function (e) { act(e.currentTarget, async function () { D = await C.api('svc_guard_check'); var n = (D.last && D.last.flagged_n) || 0; C.toast(n ? (D.cfg.on ? bn(D.last.held_now) + 'টি বন্ধ হয়েছে' : bn(n) + 'টি সার্ভিস বন্ধ হতো (সুইচ বন্ধ)') : 'সব ঠিক আছে ✔'); draw(); }); };
    el.querySelectorAll('button[data-rel]').forEach(function (b) {
      b.onclick = function () { var code = b.dataset.rel; if (!confirm('সার্ভিস ' + code + ' এখনই সাইটে ফিরিয়ে আনবেন?')) return; act(b, async function () { D = await C.api('svc_guard_release', { code: code }); C.toast('ফিরেছে ✔'); draw(); }); };
    });
  }
  window.StudioGUARD = { mount: mount };
})();
