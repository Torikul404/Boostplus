/* S6-৫ — ব্যাকআপ/রিস্টোর পাতা (Studio-v121)
   সাইটের সার্ভিস তালিকার ব্যাকআপ (অটো দৈনিক + হাতে) · পার্থক্য দেখে এক ট্যাপে রিস্টোর (পুরোটা / শুধু হারানো সার্ভিস) · ডাউনলোড · মুছুন।
   ব্যাকএন্ড: PtBackup.gs (svc_bk_get / _set / _make / _diff / _restore / _del / _dl) — Apps Script-এ নতুন ভার্সন ডেপ্লয় লাগে। app.js থেকে window.StudioBK.mount(ctx)। */
(function () {
  'use strict';
  var C = null, box = null, tok = 0, D = null, busy = false, OPEN = null, DF = null;
  var esc = function (s) { return C.esc(s); }, bn = function (n) { return C.bn(n); };
  var KIND = { auto: 'অটো', manual: 'হাতে', pre: 'রিস্টোরের আগে' };
  function dig(s) { return String(s).replace(/\d/g, function (d) { return '০১২৩৪৫৬৭৮৯'.charAt(+d); }); }
  function when(ms) {
    try { return dig(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms)).replace(',', '')); }
    catch (e) { return dig(new Date(ms).toISOString().slice(0, 16).replace('T', ' ')); }
  }
  function ago(ms) { var h = Math.max(0, (Date.now() - ms) / 36e5); return h < 1 ? 'এইমাত্র' : h < 48 ? bn(Math.round(h)) + ' ঘণ্টা আগে' : bn(Math.round(h / 24)) + ' দিন আগে'; }
  function fail(e) { if (C.authFail && C.authFail(e)) return ''; var m = (e && e.message) || 'কাজ হয়নি'; if (e && e.code === 'unknown_action') m = 'সার্ভারে নতুন ব্যাকএন্ড নেই — Apps Script-এ PtBackup.gs যোগ করে নতুন ভার্সন ডেপ্লয় করুন'; C.toast(m.length > 160 ? m.slice(0, 158) + '…' : m); return m; }
  function kb(n) { n = +n || 0; return n < 1024 ? bn(n) + ' B' : n < 1048576 ? bn(Math.round(n / 1024)) + ' KB' : dig((n / 1048576).toFixed(1)) + ' MB'; }
  function mount(ctx) {
    C = ctx; tok++; D = null; OPEN = null; DF = null;
    var t = document.getElementById('title'), b = document.getElementById('back'); if (t) t.textContent = 'ব্যাকআপ'; if (b) b.hidden = true;
    box = document.getElementById('main'); if (!box) return;
    box.innerHTML = '<div class="tq rt"><p class="sub">সাইটের সার্ভিস তালিকার (কাস্টম সার্ভিস, লুকানো, দাম/ছাড়, ক্যাটেগরি সেটিং, প্রভাইডার-সুইচ) ব্যাকআপ Google Drive-এ জমা থাকে। ভুলে মুছে গেলে বা এলোমেলো হলে এখান থেকে ফেরানো যায়। এতে প্রভাইডারে কোনো খরচ নেই।</p><div id="bkBody"><div class="sk"></div></div></div>';
    load();
  }
  async function load() {
    var my = tok, el = box && box.querySelector('#bkBody'); if (!el) return;
    try { var d = await C.api('svc_bk_get'); if (my !== tok) return; D = d; draw(); }
    catch (e) { if (my !== tok) return; var m = fail(e); if (m === '') return; el.innerHTML = '<div class="card empty"><p class="err">' + esc(m) + '</p><button type="button" class="btn" id="bkRetry">আবার চেষ্টা</button></div>'; var r = el.querySelector('#bkRetry'); if (r) r.onclick = load; }
  }
  function diffHtml(x) {
    var f = x.diff, L = [];
    if (f.same) return '<p class="ok">এখনকার অবস্থা এই ব্যাকআপের সাথে হুবহু মেলে ✔ — রিস্টোরের দরকার নেই।</p>';
    function row(n, txt, cls) { if (n) L.push('<li' + (cls ? ' class="' + cls + '"' : '') + '>' + txt.replace('{n}', bn(n)) + '</li>'); }
    row(f.back, 'ব্যাকআপে আছে, এখন সাইটে নেই: <b>{n}টি</b> সার্ভিস (ফিরবে)', 'ok');
    row(f.lost, 'এখন সাইটে আছে, ব্যাকআপে নেই: <b>{n}টি</b> সার্ভিস (পুরোটা রিস্টোরে বাদ যাবে)', 'er');
    row(f.changed, 'দুই জায়গায় আছে কিন্তু তথ্য আলাদা: <b>{n}টি</b> সার্ভিস');
    row(f.hide, 'ব্যাকআপে লুকানো, এখন চালু: <b>{n}টি</b> (রিস্টোরে লুকাবে)');
    row(f.show, 'ব্যাকআপে চালু, এখন লুকানো: <b>{n}টি</b> (রিস্টোরে চালু হবে)');
    row(f.prices, 'দামের তফাত: <b>{n}টি</b>'); row(f.discounts, 'ছাড়ের তফাত: <b>{n}টি</b>');
    row(f.cats, 'ক্যাটেগরি সেটিং-এর তফাত: <b>{n}টি</b>'); row(f.other, 'অন্যান্য সেটিং-এর তফাত: <b>{n}টি</b>'); row(f.po, 'প্রভাইডার-সুইচের তফাত: <b>{n}টি</b>');
    var h = '<ul class="bkdf">' + L.join('') + '</ul>';
    function lst(t, a, n) { return a && a.length ? '<div class="sub">' + t + '</div><ul class="rtsk">' + a.map(function (s) { return '<li>' + esc(s.code) + ' · ' + esc(s.provider) + ' — ' + esc(s.name) + '</li>'; }).join('') + (n > a.length ? '<li>… আরও ' + bn(n - a.length) + 'টি</li>' : '') + '</ul>' : ''; }
    return h + lst('ফিরবে (নমুনা):', f.back_list, f.back) + lst('বাদ যাবে (নমুনা):', f.lost_list, f.lost);
  }
  function draw() {
    var el = box && box.querySelector('#bkBody'); if (!el || !D) return; var c = D.cfg, h = [], L = D.last;
    var trig = D.trigger === true ? '<span class="ok">ট্রিগার চালু ✔</span>' : D.trigger === false ? (c.on ? '<span class="er">ট্রিগার নেই</span>' : '<span class="sub">ট্রিগার বন্ধ</span>') : '<span class="sub">ট্রিগার অজানা</span>';
    var lastTxt = L ? (L.result === 'saved' ? 'শেষ ব্যাকআপ: ' + ago(L.at) : 'শেষ চেক: ' + ago(L.at) + ' — কিছু বদলায়নি, নতুন ব্যাকআপ লাগেনি') : '';
    h.push('<div class="card tqc"><div class="rtrow"><div><h3>অটো ব্যাকআপ</h3><div class="sub">' + (c.on ? 'চালু · রোজ ভোর ২টায়, শুধু কিছু বদলালে' : 'বন্ধ — হাতে ব্যাকআপ নেওয়া যায়') + '</div></div>' +
      '<button type="button" class="sw" id="bkOn" role="switch" aria-checked="' + c.on + '" aria-label="অটো ব্যাকআপ চালু/বন্ধ"></button></div><div class="rtst"><span>' + trig + '</span>' + (lastTxt ? '<span class="sub">' + esc(lastTxt) + '</span>' : '') + '</div>' +
      '<div class="tqg bkk"><label>কতটি অটো-ব্যাকআপ রাখবে<input id="bkKeep" type="number" inputmode="numeric" min="3" max="60" value="' + esc(c.keep) + '"></label></div>' +
      '<div class="acts"><button type="button" class="btn" id="bkSave">সেভ</button></div></div>');
    h.push('<div class="card tqc"><h3>এখনই ব্যাকআপ নিন</h3><label>নোট (ঐচ্ছিক)<input id="bkNote" type="text" maxlength="80" placeholder="যেমন: বড় বদলের আগে"></label><div class="acts"><button type="button" class="btn" id="bkMake">💾 ব্যাকআপ নিন</button></div></div>');
    var ls = D.list || [];
    var lr = D.last_restore ? '<p class="sub">শেষ রিস্টোর: ' + when(D.last_restore.at) + ' (' + ago(D.last_restore.at) + ') — ' + (D.last_restore.mode === 'full' ? 'পুরোটা' : 'শুধু হারানো সার্ভিস') + '। রিস্টোরের আগের অবস্থার কপি "রিস্টোরের আগে" নামে নিচে আছে।</p>' : '';
    h.push('<div class="card tqc"><h3>ব্যাকআপ তালিকা (' + bn(ls.length) + ')</h3>' + lr + (ls.length ? ls.map(function (x) {
      var o = OPEN === x.id;
      return '<div class="rtau bkr"><div class="tqb"><span class="bnm">' + when(x.at) + ' · ' + esc(KIND[x.kind] || x.kind) + '</span><small>' + (x.note ? esc(x.note) + ' · ' : '') + bn(x.n_custom) + 'টি সার্ভিস · ' + bn(x.n_hidden) + 'টি লুকানো · ' + kb(x.bytes) + '</small></div>' +
        '<div class="rtss"><button type="button" class="sm" data-open="' + esc(x.id) + '" aria-expanded="' + o + '">' + (o ? 'বন্ধ করুন' : 'রিস্টোর…') + '</button></div></div>' + (o ? '<div class="bkpn" data-pn="' + esc(x.id) + '">' + (DF && DF.id === x.id ? diffHtml(DF) +
        '<div class="acts"><button type="button" class="btn" data-full="' + esc(x.id) + '"' + (DF.diff.same ? ' disabled' : '') + '>↩ পুরোটা রিস্টোর</button>' + (DF.diff.back ? '<button type="button" class="sm" data-miss="' + esc(x.id) + '">শুধু হারানো সার্ভিস ফেরান</button>' : '') + '</div>' +
        '<div class="acts"><button type="button" class="sm" data-dl="' + esc(x.id) + '">⬇ ডাউনলোড</button><button type="button" class="sm" data-del="' + esc(x.id) + '">🗑 মুছুন</button></div>' : '<div class="sk"></div>') + '</div>' : '');
    }).join('') : '<p class="sub">এখনো কোনো ব্যাকআপ নেই — উপরের বাটনে চেপে প্রথমটা নিন।</p>') + '</div>');
    el.innerHTML = h.join(''); bind(el);
  }
  function v(id) { var e = box.querySelector('#' + id); return e ? e.value : ''; }
  async function act(btn, fn) {
    if (busy) return; busy = true; var my = tok, old = btn && btn.textContent; if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try { await fn(); } catch (e) { fail(e); }
    busy = false; if (btn && my === tok) { btn.disabled = false; btn.textContent = old; }
  }
  function find(id) { return (D.list || []).filter(function (x) { return x.id === id; })[0]; }
  function bind(el) {
    var on = el.querySelector('#bkOn');
    on.onclick = function () { var want = !D.cfg.on; act(on, async function () { D = await C.api('svc_bk_set', { on: want }); C.toast(want ? 'অটো ব্যাকআপ চালু ✔' : 'বন্ধ হয়েছে'); draw(); }); };
    el.querySelector('#bkSave').onclick = function (e) { act(e.currentTarget, async function () { D = await C.api('svc_bk_set', { keep: v('bkKeep') }); C.toast('সেভ হয়েছে ✔'); draw(); }); };
    el.querySelector('#bkMake').onclick = function (e) { act(e.currentTarget, async function () { D = await C.api('svc_bk_make', { note: v('bkNote') }); C.toast('ব্যাকআপ নেওয়া হয়েছে ✔'); draw(); }); };
    el.querySelectorAll('button[data-open]').forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.open; if (OPEN === id) { OPEN = null; DF = null; draw(); return; }
        OPEN = id; DF = null; draw(); var my = tok;
        C.api('svc_bk_diff', { id: id }).then(function (d) { if (my !== tok || OPEN !== id) return; DF = d; draw(); })
          .catch(function (e) { if (my !== tok) return; OPEN = null; DF = null; fail(e); draw(); });
      };
    });
    function doRestore(btn, id, mode) {
      var x = find(id), f = DF && DF.diff; if (!x || !f) return;
      var msg = mode === 'full'
        ? 'ব্যাকআপ (' + when(x.at) + ') থেকে পুরো সার্ভিস তালিকা রিস্টোর করবেন?\n\n• ফিরবে: ' + bn(f.back) + 'টি সার্ভিস\n• বাদ যাবে (ব্যাকআপে নেই): ' + bn(f.lost) + 'টি সার্ভিস\n• লুকানো/দাম/সেটিং ব্যাকআপের মতো হবে\n\nরিস্টোরের আগের অবস্থার একটা কপি নিজে থেকে রাখা হবে।'
        : 'ব্যাকআপ (' + when(x.at) + ') থেকে শুধু হারানো ' + bn(f.back) + 'টি সার্ভিস ফিরিয়ে আনবেন?\n\nঅন্য সব যেমন আছে তেমনই থাকবে। রিস্টোরের আগের অবস্থার কপি নিজে থেকে রাখা হবে।';
      if (!confirm(msg)) return;
      act(btn, async function () {
        D = await C.api('svc_bk_restore', { id: id, mode: mode, confirm: '1' }); OPEN = null; DF = null;
        var dn = D.done || {}; C.toast('রিস্টোর হয়েছে ✔ — ' + bn(dn.back || 0) + 'টি সার্ভিস ফিরেছে' + (dn.lost ? ', ' + bn(dn.lost) + 'টি বাদ গেছে' : '')); draw();
      });
    }
    el.querySelectorAll('button[data-full]').forEach(function (b) { b.onclick = function () { doRestore(b, b.dataset.full, 'full'); }; });
    el.querySelectorAll('button[data-miss]').forEach(function (b) { b.onclick = function () { doRestore(b, b.dataset.miss, 'missing'); }; });
    el.querySelectorAll('button[data-dl]').forEach(function (b) {
      b.onclick = function () {
        act(b, async function () {
          var d = await C.api('svc_bk_dl', { id: b.dataset.dl });
          var u = URL.createObjectURL(new Blob([d.json], { type: 'application/json' })), a = document.createElement('a');
          a.href = u; a.download = d.name || 'svc_backup.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
          C.toast('ডাউনলোড শুরু হয়েছে ✔');
        });
      };
    });
    el.querySelectorAll('button[data-del]').forEach(function (b) {
      b.onclick = function () {
        var x = find(b.dataset.del); if (!x || !confirm('এই ব্যাকআপ (' + when(x.at) + ') মুছবেন? Drive ট্র্যাশে ৩০ দিন থাকবে।')) return;
        act(b, async function () { D = await C.api('svc_bk_del', { id: b.dataset.del }); OPEN = null; DF = null; C.toast('মুছে গেছে'); draw(); });
      };
    });
  }
  window.StudioBK = { mount: mount };
})();
