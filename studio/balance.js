/* S6-২ — ব্যালেন্স সতর্কতা পাতা (Studio-v118)
   চালু/বন্ধ · সীমা (সব প্রভাইডার + আলাদা) · এখন চেক · প্রভাইডারের ব্যালেন্স তালিকা।
   ব্যাকএন্ড: PtBalance.gs (svc_bal_get / _set / _check) — Apps Script-এ নতুন ভার্সন ডেপ্লয় লাগে। app.js থেকে window.StudioBAL.mount(ctx)। */
(function () {
  'use strict';
  var C = null, box = null, tok = 0, D = null, busy = false;
  var esc = function (s) { return C.esc(s); }, bn = function (n) { return C.bn(n); };
  function usd(n) { return bn(Math.round((+n || 0) * 100) / 100); }
  function ago(ms) { var h = Math.max(0, (Date.now() - ms) / 36e5); return h < 1 ? 'এইমাত্র' : h < 48 ? bn(Math.round(h)) + ' ঘণ্টা আগে' : bn(Math.round(h / 24)) + ' দিন আগে'; }
  function fail(e) { if (C.authFail && C.authFail(e)) return ''; var m = (e && e.message) || 'কাজ হয়নি'; if (e && e.code === 'unknown_action') m = 'সার্ভারে নতুন ব্যাকএন্ড নেই — Apps Script-এ PtBalance.gs যোগ করে নতুন ভার্সন ডেপ্লয় করুন'; C.toast(m.length > 160 ? m.slice(0, 158) + '…' : m); return m; }
  function mount(ctx) {
    C = ctx; tok++; D = null;
    var t = document.getElementById('title'), b = document.getElementById('back'); if (t) t.textContent = 'ব্যালেন্স সতর্কতা'; if (b) b.hidden = true;
    box = document.getElementById('main'); if (!box) return;
    box.innerHTML = '<div class="tq rt"><p class="sub">প্রভাইডারের ব্যালেন্স সীমার নিচে নামলে টেলিগ্রামে সতর্কতা আসে, যাতে অর্ডার আটকানোর আগেই টপ-আপ করা যায়। এই চেকে কোনো খরচ নেই।</p><div id="balBody"><div class="sk"></div></div></div>';
    load();
  }
  async function load() {
    var my = tok, el = box && box.querySelector('#balBody'); if (!el) return;
    try { var d = await C.api('svc_bal_get'); if (my !== tok) return; D = d; draw(); }
    catch (e) { if (my !== tok) return; var m = fail(e); if (m === '') return; el.innerHTML = '<div class="card empty"><p class="err">' + esc(m) + '</p><button type="button" class="btn" id="balRetry">আবার চেষ্টা</button></div>'; var r = el.querySelector('#balRetry'); if (r) r.onclick = load; }
  }
  function draw() {
    var el = box && box.querySelector('#balBody'); if (!el || !D) return; var c = D.cfg, h = [];
    var trig = D.trigger === true ? '<span class="ok">ট্রিগার চালু ✔</span>' : D.trigger === false ? (c.on ? '<span class="er">ট্রিগার নেই</span>' : '<span class="sub">ট্রিগার বন্ধ</span>') : '<span class="sub">ট্রিগার অজানা</span>';
    h.push('<div class="card tqc"><div class="rtrow"><div><h3>ব্যালেন্স সতর্কতা</h3><div class="sub">' + (c.on ? 'চালু · প্রতি ৬ ঘণ্টায় চেক' : 'বন্ধ — কোনো বার্তা যাবে না') + '</div></div>' +
      '<button type="button" class="sw" id="balOn" role="switch" aria-checked="' + c.on + '" aria-label="ব্যালেন্স সতর্কতা চালু/বন্ধ"></button></div><div class="rtst"><span>' + trig + '</span></div></div>');
    var per = (D.providers || []).map(function (p) { var v = c.per && c.per[p] != null ? c.per[p] : ''; return '<label>' + esc(p) + ' <small>(ফাঁকা = সাধারণ সীমা)</small><input type="number" inputmode="decimal" min="0" step="0.5" data-p="' + esc(p) + '" value="' + esc(v) + '"></label>'; }).join('');
    h.push('<div class="card tqc"><h3>সীমা (USD)</h3><div class="tqg"><label>সাধারণ সীমা ($)<input id="balMin" type="number" inputmode="decimal" min="0" step="0.5" value="' + esc(c.min_usd) + '"></label>' +
      '<label>আবার জানাবে (ঘণ্টা)<input id="balRep" type="number" inputmode="numeric" min="1" max="168" value="' + esc(c.repeat_hrs) + '"></label></div>' +
      '<details><summary>প্রভাইডার-ভিত্তিক আলাদা সীমা</summary>' + (per || '<p class="sub">কোনো প্রভাইডার কনফিগ নেই।</p>') + '</details>' +
      '<div class="acts"><button type="button" class="btn" id="balSave">সেভ</button></div></div>');
    var L = D.last;
    h.push('<div class="card tqc"><h3>প্রভাইডারের ব্যালেন্স' + (L ? ' <small>(' + ago(L.at) + ')</small>' : '') + '</h3>' +
      (L && (L.rows || []).length ? L.rows.map(function (r) {
        var st = !r.ok ? '<span class="er">' + esc(String(r.error || 'জানা যায়নি').slice(0, 40)) + '</span>' : (r.low ? '<span class="er">⚠ কম</span>' : '<span class="ok">ঠিক ✔</span>');
        return '<div class="rtau"><div class="tqb"><span class="bnm">' + esc(r.provider) + '</span><small>' + (r.ok ? '<b>' + usd(r.balance) + ' ' + esc(r.currency) + '</b> · সীমা ' + usd(r.min) : 'ব্যালেন্স আনা যায়নি') + '</small></div><div class="rtss">' + st + '</div></div>';
      }).join('') : '<p class="sub">এখনো চেক হয়নি — নিচের বাটনে চাপুন।</p>') +
      '<div class="acts"><button type="button" class="sm" id="balRun">🔄 এখন চেক করুন</button></div></div>');
    el.innerHTML = h.join(''); bind(el);
  }
  function v(id) { var e = box.querySelector('#' + id); return e ? e.value : ''; }
  async function act(btn, fn) {
    if (busy) return; busy = true; var my = tok, old = btn && btn.textContent; if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try { await fn(); } catch (e) { fail(e); }
    busy = false; if (btn && my === tok) { btn.disabled = false; btn.textContent = old; }
  }
  function bind(el) {
    var on = el.querySelector('#balOn');
    on.onclick = function () { var want = !D.cfg.on; act(on, async function () { D = await C.api('svc_bal_set', { on: want }); C.toast(want ? 'চালু হয়েছে ✔' : 'বন্ধ হয়েছে'); draw(); }); };
    el.querySelector('#balSave').onclick = function (e) {
      var per = {}; el.querySelectorAll('input[data-p]').forEach(function (i) { per[i.dataset.p] = i.value.trim(); });
      act(e.currentTarget, async function () { D = await C.api('svc_bal_set', { min_usd: v('balMin'), repeat_hrs: v('balRep'), per: per }); C.toast('সেভ হয়েছে ✔'); draw(); });
    };
    el.querySelector('#balRun').onclick = function (e) { act(e.currentTarget, async function () { D = await C.api('svc_bal_check'); var n = (D.last && D.last.alerted) || 0; C.toast(n ? bn(n) + 'টি প্রভাইডারে কম — টেলিগ্রামে গেছে' : 'চেক হয়েছে'); draw(); }); };
  }
  window.StudioBAL = { mount: mount };
})();
