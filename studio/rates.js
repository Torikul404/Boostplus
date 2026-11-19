/* S6-৩ — রেট সতর্কতা পাতা (Studio-v119)
   প্রভাইডার রেট বাড়লে সাইটের দাম/লাভ ঠিক আছে কি না দেখায় · চালু/বন্ধ · সীমা · এখন চেক · "দাম হালনাগাদ" (এক ট্যাপে)।
   ব্যাকএন্ড: PtRates.gs (svc_rate_get / _set / _check / _sync) — Apps Script-এ নতুন ভার্সন ডেপ্লয় লাগে। app.js থেকে window.StudioRATE.mount(ctx)। */
(function () {
  'use strict';
  var C = null, box = null, tok = 0, D = null, busy = false;
  var esc = function (s) { return C.esc(s); }, bn = function (n) { return C.bn(n); };
  function num(n) { return bn(Math.round((+n || 0) * 100) / 100); }
  function ago(ms) { var h = Math.max(0, (Date.now() - ms) / 36e5); return h < 1 ? 'এইমাত্র' : h < 48 ? bn(Math.round(h)) + ' ঘণ্টা আগে' : bn(Math.round(h / 24)) + ' দিন আগে'; }
  function fail(e) { if (C.authFail && C.authFail(e)) return ''; var m = (e && e.message) || 'কাজ হয়নি'; if (e && e.code === 'unknown_action') m = 'সার্ভারে নতুন ব্যাকএন্ড নেই — Apps Script-এ PtRates.gs যোগ করে নতুন ভার্সন ডেপ্লয় করুন'; C.toast(m.length > 160 ? m.slice(0, 158) + '…' : m); return m; }
  var BADGE = { loss: '<span class="er">🔴 লোকসান</span>', thin: '<span class="er">🟠 লাভ কম</span>', rise: '<span class="sub">🟡 রেট বেড়েছে</span>' };
  function mount(ctx) {
    C = ctx; tok++; D = null;
    var t = document.getElementById('title'), b = document.getElementById('back'); if (t) t.textContent = 'রেট সতর্কতা'; if (b) b.hidden = true;
    box = document.getElementById('main'); if (!box) return;
    box.innerHTML = '<div class="tq rt"><p class="sub">প্রভাইডার রেট বাড়ালে সাইট পুরনো দামেই বেচে, লাভ কমে যায়। এখানে সেই সার্ভিসগুলো ধরা পড়ে। এই চেকে কোনো খরচ নেই — সংগ্রহ-করা তালিকা থেকে মেলানো হয়।</p><div id="ratBody"><div class="sk"></div></div></div>';
    load();
  }
  async function load() {
    var my = tok, el = box && box.querySelector('#ratBody'); if (!el) return;
    try { var d = await C.api('svc_rate_get'); if (my !== tok) return; D = d; draw(); }
    catch (e) { if (my !== tok) return; var m = fail(e); if (m === '') return; el.innerHTML = '<div class="card empty"><p class="err">' + esc(m) + '</p><button type="button" class="btn" id="ratRetry">আবার চেষ্টা</button></div>'; var r = el.querySelector('#ratRetry'); if (r) r.onclick = load; }
  }
  function row(x) {
    return '<div class="rtau"><div class="tqb"><span class="bnm">' + esc(x.code) + ' · ' + esc(x.provider) + '</span><small>' + esc(x.name) + '</small>' +
      '<small>$' + num(x.old) + ' → <b>$' + num(x.now) + '</b> (+' + num(x.rise) + '%)</small>' +
      '<small>বিক্রি ৳' + num(x.sell) + ' · খরচ ৳' + num(x.cost) + ' · লাভ <b>৳' + num(x.profit) + '</b> /১০০০</small></div>' +
      '<div class="rtss">' + (BADGE[x.st] || '') + '<button type="button" class="sm" data-sync="' + esc(x.code) + '">দাম হালনাগাদ</button></div></div>';
  }
  function draw() {
    var el = box && box.querySelector('#ratBody'); if (!el || !D) return; var c = D.cfg, h = [], L = D.last;
    var trig = D.trigger === true ? '<span class="ok">ট্রিগার চালু ✔</span>' : D.trigger === false ? (c.on ? '<span class="er">ট্রিগার নেই</span>' : '<span class="sub">ট্রিগার বন্ধ</span>') : '<span class="sub">ট্রিগার অজানা</span>';
    h.push('<div class="card tqc"><div class="rtrow"><div><h3>রেট সতর্কতা</h3><div class="sub">' + (c.on ? 'চালু · রোজ ভোর ৫টায় চেক' : 'বন্ধ — টেলিগ্রামে বার্তা যাবে না') + '</div></div>' +
      '<button type="button" class="sw" id="ratOn" role="switch" aria-checked="' + c.on + '" aria-label="রেট সতর্কতা চালু/বন্ধ"></button></div><div class="rtst"><span>' + trig + '</span></div></div>');
    h.push('<div class="card tqc"><h3>সীমা</h3><div class="tqg"><label>রেট কত % বাড়লে জানাবে<input id="ratRise" type="number" inputmode="decimal" min="1" max="500" step="1" value="' + esc(c.rise_pct) + '"></label>' +
      '<label>ন্যূনতম লাভ (৳ প্রতি ১০০০)<input id="ratMin" type="number" inputmode="decimal" min="0" max="1000" step="0.5" value="' + esc(c.min_profit) + '"></label>' +
      '<label>আবার জানাবে (ঘণ্টা)<input id="ratRep" type="number" inputmode="numeric" min="1" max="168" value="' + esc(c.repeat_hrs) + '"></label></div>' +
      '<p class="sub">লাভ সীমার নিচে নামলে বা লোকসান হলে রেট কম বাড়লেও জানাবে।</p><div class="acts"><button type="button" class="btn" id="ratSave">সেভ</button></div></div>');
    var tgm = L && L.tg === 'sent' ? ' · টেলিগ্রামে গেছে' : L && L.tg === 'not_configured' ? ' · টেলিগ্রাম কনফিগ নেই' : '';
    h.push('<div class="card tqc"><h3>সতর্ক সার্ভিস' + (L ? ' <small>(' + ago(L.at) + ')</small>' : '') + '</h3>' +
      (L ? '<p class="sub">' + bn(L.checked) + 'টি সার্ভিস মেলানো হয়েছে' + (L.skipped ? ' (' + bn(L.skipped) + 'টি বাদ — তালিকা সংগ্রহ হয়নি)' : '') + tgm + '</p>' : '') +
      (L && (L.items || []).length ? L.items.map(row).join('') + (L.total > L.items.length ? '<p class="sub">আরও ' + bn(L.total - L.items.length) + 'টি আছে — আগে এগুলো ঠিক করুন।</p>' : '') :
        L ? '<p class="ok">সব ঠিক আছে ✔ — কোনো সার্ভিসের রেট বেড়ে লাভ কমেনি।</p>' : '<p class="sub">এখনো চেক হয়নি — নিচের বাটনে চাপুন।</p>') +
      '<div class="acts"><button type="button" class="sm" id="ratRun">🔄 এখন চেক করুন</button>' + (L && (L.items || []).length ? '<button type="button" class="sm" id="ratAll">সব হালনাগাদ</button>' : '') + '</div></div>');
    el.innerHTML = h.join(''); bind(el);
  }
  function v(id) { var e = box.querySelector('#' + id); return e ? e.value : ''; }
  async function act(btn, fn) {
    if (busy) return; busy = true; var my = tok, old = btn && btn.textContent; if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try { await fn(); } catch (e) { fail(e); }
    busy = false; if (btn && my === tok) { btn.disabled = false; btn.textContent = old; }
  }
  function bind(el) {
    var on = el.querySelector('#ratOn');
    on.onclick = function () { var want = !D.cfg.on; act(on, async function () { D = await C.api('svc_rate_set', { on: want }); C.toast(want ? 'চালু হয়েছে ✔' : 'বন্ধ হয়েছে'); draw(); }); };
    el.querySelector('#ratSave').onclick = function (e) { act(e.currentTarget, async function () { D = await C.api('svc_rate_set', { rise_pct: v('ratRise'), min_profit: v('ratMin'), repeat_hrs: v('ratRep') }); C.toast('সেভ হয়েছে ✔'); draw(); }); };
    el.querySelector('#ratRun').onclick = function (e) { act(e.currentTarget, async function () { D = await C.api('svc_rate_check'); var n = (D.last && D.last.total) || 0; C.toast(n ? bn(n) + 'টি সার্ভিসে রেট বেড়েছে' : 'সব ঠিক আছে ✔'); draw(); }); };
    var all = el.querySelector('#ratAll');
    if (all) all.onclick = function (e) {
      var n = (D.last && D.last.total) || 0;
      if (!confirm('সব ' + bn(n) + 'টি সার্ভিসের সাইট-দাম এখনকার প্রভাইডার রেটে হালনাগাদ হবে (গ্রাহকের দাম বাড়বে)। চালিয়ে যাবেন?')) return;
      act(e.currentTarget, async function () { D = await C.api('svc_rate_sync', { all: true }); C.toast(bn(D.synced || 0) + 'টির দাম হালনাগাদ হয়েছে ✔'); draw(); });
    };
    el.querySelectorAll('button[data-sync]').forEach(function (b) {
      b.onclick = function () {
        var code = b.dataset.sync;
        if (!confirm('সার্ভিস ' + code + '-এর সাইট-দাম এখনকার প্রভাইডার রেটে হালনাগাদ হবে (গ্রাহকের দাম বাড়বে)। চালিয়ে যাবেন?')) return;
        act(b, async function () { D = await C.api('svc_rate_sync', { codes: [code] }); C.toast(D.synced ? 'দাম হালনাগাদ হয়েছে ✔' : 'এই সার্ভিসে এখন আর বদল নেই'); draw(); });
      };
    });
  }
  window.StudioRATE = { mount: mount };
})();
