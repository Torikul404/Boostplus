/* S8-১ + S8-২ + S8-৩ — ড্যাশবোর্ড পাতা (Studio-v125)
   সাইটের সার্ভিসের সারাংশ: মোট / চালু / লুকানো / ক্যাটেগরি + প্ল্যাটফর্ম অনুযায়ী ভাগ।
   ডেটা আসে app.js-এর api('svc_site_list') থেকে — ফোনের ক্যাটালগ কপি থাকলে সেখান থেকে (অফলাইনেও চলে), নইলে সার্ভার থেকে।
   S8-২: প্রভাইডার অবস্থা (svc_providers) + ব্যালেন্স/অটো-গার্ড/অটো-রি-টেস্ট সারাংশ কার্ড (svc_bal_get/svc_guard_get/svc_retest_get)।
   S8-৩: পরিবর্তন সারাংশ (svc_changes): নতুন / বাদ / দাম↑ / দাম↓ মোট + চালু সার্ভিসে প্রভাব + প্রভাইডার অনুযায়ী।
   প্রতিটি অংশ আলাদা লোড হয়; সার্ভার নতুন না হলে (unknown_action) শুধু ওই কার্ডে "ডেপ্লয়ের পর দেখাবে" বার্তা। নতুন ব্যাকএন্ড (.gs) লাগে না। app.js থেকে window.StudioDASH.mount(ctx)। */
(function () {
  'use strict';
  var C = null, box = null, tok = 0, busy = false, TOP = 8, ALL = false;
  var esc = function (s) { return C.esc(s); }, bn = function (n) { return C.bn(n); };
  function dig(s) { return String(s).replace(/\d/g, function (d) { return '০১২৩৪৫৬৭৮৯'.charAt(+d); }); }
  function hhmm(ms) {
    try { return dig(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms))); }
    catch (e) { return dig(new Date(ms).toISOString().slice(11, 16)); }
  }
  /* on/off = svc_site_list-এর উত্তর (state=on / state=off, limit=1) — শুধু total, platforms, categories লাগে */
  function sum(on, off) {
    var a = (on && on.total) | 0, b = (off && off.total) | 0, m = {}, L = [];
    ((on && on.platforms) || []).forEach(function (p) { m[p.label] = m[p.label] || { label: p.label, on: 0, off: 0 }; m[p.label].on += +p.n || 0; });
    ((off && off.platforms) || []).forEach(function (p) { m[p.label] = m[p.label] || { label: p.label, on: 0, off: 0 }; m[p.label].off += +p.n || 0; });
    Object.keys(m).forEach(function (k) { L.push(m[k]); });
    L.sort(function (x, y) { return (y.on + y.off) - (x.on + x.off) || (x.label < y.label ? -1 : 1); });
    return { total: a + b, on: a, off: b, pct: a + b ? Math.round(a * 100 / (a + b)) : 0, cats: ((on && on.categories) || []).length, plats: L };
  }
  function fail(e) {
    if (C.authFail && C.authFail(e)) return '';
    var m = (e && e.message) || 'কাজ হয়নি';
    if (e && e.code === 'packages_unavailable') m = 'সাইটের প্যাকেজ তালিকা এখন আনা যায়নি — একটু পরে আবার চেষ্টা করুন';
    return m.length > 160 ? m.slice(0, 158) + '…' : m;
  }
  function mount(ctx) {
    C = ctx; tok++; busy = false; ALL = false;
    var t = document.getElementById('title'), b = document.getElementById('back'); if (t) t.textContent = 'ড্যাশবোর্ড'; if (b) b.hidden = true;
    box = document.getElementById('main'); if (!box) return;
    box.innerHTML = '<div class="dsh"><div id="dshBody"><div class="sk"></div></div></div>';
    load();
  }
  function ago(ms) {
    var t = +ms; if (!t) return ''; var d = Date.now() - t, f = d < 0, s = Math.abs(d) / 1000;
    var u = s < 90 ? 'এইমাত্র' : s < 5400 ? bn(Math.round(s / 60)) + ' মিনিট' : s < 129600 ? bn(Math.round(s / 3600)) + ' ঘণ্টা' : bn(Math.round(s / 86400)) + ' দিন';
    return u === 'এইমাত্র' ? u : (f ? u + ' পরে' : u + ' আগে');
  }
  function stamp(v) { if (!v) return 0; if (typeof v === 'number') return v; var t = Date.parse(v); return isNaN(t) ? 0 : t; }
  /* একটি অ্যাকশন নিরাপদে ডাকে: {d} বা {na:true} (সার্ভার নতুন নয়) বা {err:msg} */
  async function safe(action, args) {
    try {
      var r = await C.api(action, args || {});
      if (!r || r.ok === false) { var c = r && r.error; return c === 'unknown_action' ? { na: true } : { err: (r && r.message) || c || 'পাওয়া যায়নি' }; }
      return { d: r };
    } catch (e) {
      if (C.authFail && C.authFail(e)) return { auth: true };
      return e && e.code === 'unknown_action' ? { na: true } : { err: (e && e.message) || 'পাওয়া যায়নি' };
    }
  }
  async function load() {
    var my = tok, el = box && box.querySelector('#dshBody'); if (!el) return;
    busy = true;
    var r = await Promise.all([safe('svc_site_list', { state: 'on', limit: 1 }), safe('svc_site_list', { state: 'off', limit: 1 }), safe('svc_providers'), safe('svc_bal_get'), safe('svc_guard_get'), safe('svc_retest_get'), safe('svc_changes')]);
    if (my !== tok) return; busy = false;
    if (r.some(function (x) { return x.auth; })) return;
    var D = { site: null, siteErr: '', prov: r[2], bal: r[3], guard: r[4], rt: r[5], chg: r[6] };
    if (r[0].d && r[1].d) D.site = sum(r[0].d, r[1].d);
    else { var x = r[0].d ? r[1] : r[0]; D.siteErr = x.na ? 'সাইটের তালিকা আনা যায়নি' : (x.err === 'packages_unavailable' ? 'সাইটের প্যাকেজ তালিকা এখন আনা যায়নি — একটু পরে আবার চেষ্টা করুন' : String(x.err || 'সাইটের তালিকা আনা যায়নি').slice(0, 160)); }
    draw(D, Date.now());
  }
  function badge(on, txt, cls) { return '<span class="dshs ' + (cls || (on ? 'on' : 'off')) + '">' + esc(txt) + '</span>'; }
  function naCard(name, href, msg) {
    return '<a class="card dsha na" href="' + href + '"><b>' + name + '</b><span class="sub">' + esc(msg) + '</span></a>';
  }
  function autoCard(name, href, X, f) {
    if (X.na) return naCard(name, href, 'সার্ভার এখনও নতুন নয় — ডেপ্লয়ের পর দেখাবে');
    if (X.err || !X.d) return naCard(name, href, X.err ? String(X.err).slice(0, 90) : 'তথ্য নেই');
    return f(X.d);
  }
  function autoState(d) { var on = !!(d.cfg && d.cfg.on); return on ? (d.trigger === false ? badge(0, 'ট্রিগার বন্ধ', 'warn') : badge(1, 'চালু')) : badge(0, 'বন্ধ'); }
  function drawProv(P) {
    if (P.na) return '<div class="card dshp"><div class="dshh"><h3>প্রভাইডার</h3></div><p class="sub">সার্ভার এখনও নতুন নয় — ডেপ্লয়ের পর দেখাবে</p></div>';
    if (P.err || !P.d) return '<div class="card dshp"><div class="dshh"><h3>প্রভাইডার</h3></div><p class="sub">' + esc(P.err ? String(P.err).slice(0, 120) : 'তথ্য নেই') + '</p></div>';
    var L = P.d.providers || [], off = L.filter(function (p) { return p.off; }).length;
    return '<div class="card dshp"><div class="dshh"><h3>প্রভাইডার</h3><span class="sub">' + bn(L.length - off) + '/' + bn(L.length) + ' চালু</span></div>' +
      (L.length ? L.map(function (p) {
        var at = stamp(p.collected_at), sub = bn(p.count || 0) + 'টি সার্ভিস' + (p.off && p.hidden_n ? ' · লুকানো ' + bn(p.hidden_n) : '') + (at ? ' · সংগ্রহ ' + ago(at) : '') + (p.has_api === false ? ' · API নেই' : '');
        return '<a class="dshr" href="#p=' + encodeURIComponent(p.provider) + '"><span class="dshl"><b>' + esc(p.provider) + '</b><small>' + esc(sub) + '</small></span>' + (p.off ? badge(0, 'বন্ধ') : p.has_api === false ? badge(0, 'API নেই', 'warn') : badge(1, 'চালু')) + '</a>';
      }).join('') : '<p class="sub">কোনো প্রভাইডার সেট করা নেই</p>') + '</div>';
  }
  function drawChg(X) {
    var H = '<a class="card dshch" href="#chg"><span class="dshh"><h3>পরিবর্তন</h3>';
    if (X.na) return H + '</span><span class="sub">সার্ভার এখনও নতুন নয় — ডেপ্লয়ের পর দেখাবে</span></a>';
    if (X.err || !X.d) return H + '</span><span class="sub">' + esc(X.err ? String(X.err).slice(0, 120) : 'তথ্য নেই') + '</span></a>';
    var P = X.d.providers || [], A = X.d.auto || {}, t = { rm: 0, up: 0, down: 0, nw: 0 }, lr = 0, lu = 0, rows = [];
    P.forEach(function (p) {
      var c = p.c || {}, n = { rm: +c.rm || 0, up: +c.up || 0, down: +c.down || 0, nw: +c.nw || 0 };
      Object.keys(t).forEach(function (k) { t[k] += n[k]; });
      lr += +p.live_rm || 0; lu += +p.live_up || 0;
      if (n.rm + n.up + n.down + n.nw) rows.push({ p: p.provider, n: n, lr: +p.live_rm || 0, lu: +p.live_up || 0 });
    });
    var auto = A.on === null || A.on === undefined ? '' : A.on ? 'অটো-সংগ্রহ চালু' : 'অটো-সংগ্রহ বন্ধ';
    var s = H + (auto ? badge(A.on === true, auto) : '') + '</span>';
    if (!P.length) return s + '<span class="sub">তুলনার ডেটা নেই — একই প্রভাইডার দুইবার সংগ্রহ করলে পরিবর্তন দেখা যাবে</span></a>';
    s += '<span class="dshk"><span><b>' + bn(t.nw) + '</b><small>নতুন</small></span><span><b>' + bn(t.rm) + '</b><small>বাদ</small></span><span><b>' + bn(t.up) + '</b><small>দাম ↑</small></span><span><b>' + bn(t.down) + '</b><small>দাম ↓</small></span></span>';
    if (lr || lu) s += '<span class="dshw">⚠ চালু সার্ভিসে: বাদ ' + bn(lr) + ', দাম↑ ' + bn(lu) + ' — দেখে নিন</span>';
    else s += '<span class="sub">চালু সার্ভিসে কোনো বাদ/দাম-বাড়া নেই</span>';
    s += rows.map(function (r) {
      return '<span class="dshpr"><b>' + esc(r.p) + '</b><small>নতুন ' + bn(r.n.nw) + ' · বাদ ' + bn(r.n.rm) + ' · দাম↑ ' + bn(r.n.up) + ' · দাম↓ ' + bn(r.n.down) + (r.lr || r.lu ? ' · ⚠ চালুতে ' + bn(r.lr + r.lu) : '') + '</small></span>';
    }).join('');
    if (A.last) s += '<span class="sub">শেষ অটো-সংগ্রহ: ' + esc(String(A.last).slice(0, 40)) + '</span>';
    return s + '</a>';
  }
  function draw(D, at) {
    var el = box && box.querySelector('#dshBody'); if (!el) return;
    var h = [], S = D.site;
    if (!S) h.push('<div class="card empty"><p class="err">' + esc(D.siteErr) + '</p><button type="button" class="btn" id="dshRetry">আবার চেষ্টা</button></div>');
    else if (!S.total) h.push('<div class="card empty"><p><b>সাইটে এখনও কোনো সার্ভিস নেই</b></p><p class="sub">প্রভাইডার পাতা থেকে সার্ভিস বেছে এড করুন — তারপর এখানে সারাংশ দেখাবে।</p><a class="btn" href="#">প্রভাইডার পাতায় যান</a></div>');
    else h.push('<div class="dshg">' +
      '<a class="card dshc" href="#mng"><span class="sub">মোট সার্ভিস</span><b class="dshn">' + bn(S.total) + '</b></a>' +
      '<a class="card dshc dshon" href="#mng"><span class="sub">চালু</span><b class="dshn ok">' + bn(S.on) + '</b><small>' + bn(S.pct) + '%</small></a>' +
      '<a class="card dshc dshoff" href="#mng"><span class="sub">লুকানো</span><b class="dshn">' + bn(S.off) + '</b><small>' + bn(100 - S.pct) + '%</small></a>' +
      '<a class="card dshc" href="#cats"><span class="sub">ক্যাটেগরি (চালু)</span><b class="dshn">' + bn(S.cats) + '</b></a></div>');
    h.push(drawProv(D.prov));
    h.push('<div class="dsha3">' +
      autoCard('ব্যালেন্স সতর্কতা', '#bal', D.bal, function (d) {
        var l = d.last || null, lo = l && l.alerted ? ' · কম ' + bn(l.alerted) + 'টি' : '';
        return '<a class="card dsha" href="#bal"><span class="dshh"><b>ব্যালেন্স সতর্কতা</b>' + autoState(d) + '</span><span class="sub">সীমা $' + bn((d.cfg && d.cfg.min_usd) || 0) + (l && l.at ? ' · শেষ চেক ' + ago(l.at) : ' · এখনও চেক হয়নি') + lo + '</span></a>';
      }) +
      autoCard('অটো-গার্ড', '#guard', D.guard, function (d) {
        var n = (d.held || []).length, l = d.last || null;
        return '<a class="card dsha" href="#guard"><span class="dshh"><b>অটো-গার্ড</b>' + autoState(d) + '</span><span class="sub">' + (n ? 'আটকানো ' + bn(n) + 'টি' : 'কিছু আটকানো নেই') + (l && l.at ? ' · শেষ চেক ' + ago(l.at) : '') + '</span></a>';
      }) +
      autoCard('অটো রি-টেস্ট', '#rt', D.rt, function (d) {
        return '<a class="card dsha" href="#rt"><span class="dshh"><b>অটো রি-টেস্ট</b>' + autoState(d) + '</span><span class="sub">অপেক্ষায় ' + bn(d.pending || 0) + ' · রি-ট্রাই ' + bn(d.retry || 0) + (d.next_at ? ' · পরেরটা ' + ago(d.next_at) : '') + '</span></a>';
      }) + '</div>');
    h.push(drawChg(D.chg));
    if (S && S.total) {
      var shown = ALL ? S.plats : S.plats.slice(0, TOP);
      h.push('<div class="card dshp dshpl"><div class="dshh"><h3>প্ল্যাটফর্ম অনুযায়ী</h3><span class="sub">' + bn(S.plats.length) + 'টি</span></div>' +
        (shown.length ? shown.map(function (p) {
          var t = p.on + p.off, w = t ? Math.round(p.on * 100 / t) : 0;
          return '<a class="dshr" href="#pl=' + encodeURIComponent(p.label) + '"><span class="dshl"><b>' + esc(p.label) + '</b><small>চালু ' + bn(p.on) + ' · লুকানো ' + bn(p.off) + '</small></span>' +
            '<span class="dshb" role="img" aria-label="চালু ' + bn(w) + '%"><i style="width:' + w + '%"></i></span></a>';
        }).join('') : '<p class="sub">প্ল্যাটফর্মের তথ্য নেই</p>') +
        (S.plats.length > TOP ? '<div class="acts"><button type="button" class="sm" id="dshMore">' + (ALL ? 'কম দেখান' : 'সব দেখুন (' + bn(S.plats.length) + ')') + '</button></div>' : '') + '</div>');
    }
    h.push('<div class="dshf"><button type="button" class="sm" id="dshRef">↻ রিফ্রেশ</button><span class="sub">হালনাগাদ ' + hhmm(at) + '</span></div>');
    el.innerHTML = h.join('');
    var mb = el.querySelector('#dshMore'); if (mb) mb.onclick = function () { ALL = !ALL; draw(D, at); };
    var rf = el.querySelector('#dshRef'); if (rf) rf.onclick = function () { if (busy) return; el.innerHTML = '<div class="sk"></div>'; load(); };
    var rb = el.querySelector('#dshRetry'); if (rb) rb.onclick = function () { if (busy) return; el.innerHTML = '<div class="sk"></div>'; load(); };
  }
  window.StudioDASH = { mount: mount, _sum: sum };
})();
