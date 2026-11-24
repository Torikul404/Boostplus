/* S5 — টেস্ট কিউ (Studio-v116)
   অনেক সার্ভিস বেছে ন্যূনতম পরিমাণে একটা একটা করে টেস্ট অর্ডার · লিংক-চেক · বাজেট সীমা · পাস/ফেইল রিপোর্ট · স্কোর · খরচ হিসাব।
   শুধু আগে থেকে থাকা অ্যাকশন ব্যবহার করে (svc_platforms, svc_best, svc_order, svc_spd, svc_tested) — ব্যাকএন্ড বদলায়নি, Apps Script ডেপ্লয় লাগে না।
   app.js থেকে route() এ window.StudioTQ.mount(ctx) ডাকা হয়। */
(function () {
  'use strict';
  var KQ = 'pb_tq_v1', KL = 'pb_tq_links_v1', KM = 'pb_tq_meta_v1', KS = 'pb_tq_set_v1', KG = 'pb_tq_stage_v1', KN = 'pb_tq_slnk_v1', KC = 'pb_tq_scm_v1';
  var C = null, box = null, tok = 0, runId = 0, stopFlag = false, stopMsg = '', armed = false;
  function ld(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function sv(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  var Q = ld(KQ, { items: [] }), LK = ld(KL, {}), MT = ld(KM, {}), ST = ld(KS, { budget: 100, cap: 30 }), SG = ld(KG, []), SN = ld(KN, {}), SC = ld(KC, {});
  if (!Array.isArray(SG)) SG = [];
  if (!Q || !Array.isArray(Q.items)) Q = { items: [] };
  Q.run = false;
  Q.items.forEach(function (x) { if (x.state === 'run') { x.state = 'unknown'; x.msg = 'পেজ বন্ধ হওয়ায় নিশ্চিত নয় — ল্যাব পাতায় দেখুন'; } });
  var S = { tab: 'q', label: '', type: '', q: '', un: true, rows: [], fx: 131, types: [], plats: [], picks: {}, known: {}, pool: [], full: false, cache: {}, qty: {}, lnk: SN, cm: SC, load: 0, rep: null, repBusy: false };
  var r2 = function (v) { return Math.round(v * 100) / 100; };
  var saveG = function () { sv(KG, SG.slice(-100)); }, saveN = function () { sv(KN, S.lnk); }, saveC = function () { sv(KC, S.cm); };
  var saveQ = function () { sv(KQ, { items: Q.items.slice(-200) }); }, saveS = function () { sv(KS, ST); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var esc = function (s) { return C.esc(s); }, bn = function (n) { return C.bn(n); };
  var money = function (n) { return '৳' + bn(r2(+n || 0)); };

  /* ---------- লিংক-চেক (ফরম্যাট) — ব্রাউজার থেকে লিংক সত্যিই চালু কি না দেখা যায় না (CORS); প্রভাইডারের ফেরত বার্তায় ধরা হয় ---------- */
  var HOSTS = [['instagram', /(^|\.)instagram\.com$/], ['tiktok', /(^|\.)tiktok\.com$/], ['facebook', /(^|\.)(facebook\.com|fb\.com|fb\.watch)$/], ['youtube', /(^|\.)(youtube\.com|youtu\.be)$/],
    ['telegram', /(^|\.)(t\.me|telegram\.me|telegram\.org)$/], ['twitter', /(^|\.)(twitter\.com|x\.com)$/], ['spotify', /(^|\.)spotify\.com$/], ['soundcloud', /(^|\.)soundcloud\.com$/],
    ['linkedin', /(^|\.)linkedin\.com$/], ['pinterest', /(^|\.)pinterest\.[a-z.]+$/], ['snapchat', /(^|\.)snapchat\.com$/], ['threads', /(^|\.)threads\.(net|com)$/], ['whatsapp', /(^|\.)(whatsapp\.com|wa\.me)$/]];
  function plat(label) {
    var s = String(label || '').toLowerCase();
    if (/twitter|tweet|(^|[^a-z])x([^a-z]|$)/.test(s)) return 'twitter';
    for (var i = 0; i < HOSTS.length; i++) if (s.indexOf(HOSTS[i][0]) >= 0) return HOSTS[i][0];
    return '';
  }
  function parse(u) {
    var m = String(u).trim().match(/^(https?):\/\/([^\/?#\s]+)([^?#\s]*)(\?[^#\s]*)?/i);
    return m ? { host: m[2].toLowerCase().replace(/:\d+$/, '').replace(/^[^@]*@/, ''), path: m[3] || '', q: m[4] || '' } : null;
  }
  var FAKE = /(^|\.)(example\.(com|org|net)|test\.com|localhost|yourlink\.[a-z]+|yoursite\.[a-z]+|domain\.com|abc\.com)$|^\d+\.\d+\.\d+\.\d+$/i;
  function kindOf(name) {
    var s = String(name || '').toLowerCase();
    if (/(follower|subscriber|member|\bfans?\b|page like|channel|friends?|connections?)/.test(s)) return 'profile';
    if (/(\blikes?\b|\bviews?\b|comments?|shares?|\bsaves?\b|impressions?|\breach\b|watch|retweets?|reposts?|\bplays?\b|reactions?|votes?|\bstory\b|reels?)/.test(s)) return 'post';
    return '';
  }
  function postShape(p, x) {
    var segs = x.path.split('/').filter(Boolean);
    if (p === 'instagram') { if (/\/(p|reel|reels|tv)\/[^\/]+/.test(x.path)) return true; return segs.length === 1 ? false : null; }
    if (p === 'tiktok') { if (/^(vm|vt)\./.test(x.host) || /\/video\/\d+/.test(x.path)) return true; return /^\/@[^\/]+$/.test(x.path.replace(/\/+$/, '')) ? false : null; }
    if (p === 'youtube') {
      if (/youtu\.be$/.test(x.host)) return true;
      if (x.path === '/watch' && /[?&]v=/.test(x.q)) return true;
      if (/^\/shorts\//.test(x.path)) return true;
      if (/^\/(@|channel\/|c\/|user\/)/.test(x.path)) return false; return null;
    }
    if (p === 'twitter') { if (/\/status\/\d+/.test(x.path)) return true; return segs.length === 1 ? false : null; }
    if (p === 'telegram') { if (/^\/\+/.test(x.path) || /^\/joinchat\//.test(x.path)) return false; if (segs.length === 1) return false; return segs.length === 2 && /^\d+$/.test(segs[1]) ? true : null; }
    if (p === 'facebook') { if (/\/(posts|videos|photos?|reel|permalink)\b|story\.php|\/share\//.test(x.path + x.q)) return true; return null; }
    return null;
  }
  function linkCheck(label, kind, u) {
    u = String(u || '').trim();
    if (!u) return { lv: 'e', msg: 'লিংক দেওয়া নেই' };
    if (/\s/.test(u)) return { lv: 'e', msg: 'লিংকে ফাঁকা আছে' };
    if (u.length > 500) return { lv: 'e', msg: 'লিংক খুব বড়' };
    var p = plat(label), x = parse(u);
    if (!x) {
      if (p && kind !== 'post' && /^@?[A-Za-z0-9._]{2,40}$/.test(u)) return { lv: 'w', msg: 'শুধু ইউজারনেম — প্রভাইডার পুরো লিংক চাইলে ফেইল হবে' };
      return { lv: 'e', msg: 'পুরো লিংক দিন (https:// দিয়ে শুরু)' };
    }
    if (FAKE.test(x.host)) return { lv: 'e', msg: 'এটা নমুনা/ভুয়া ঠিকানা' };
    if (x.host.indexOf('.') < 0) return { lv: 'e', msg: 'ঠিকানা ঠিক নয়' };
    if (p) { var h = HOSTS.filter(function (z) { return z[0] === p; })[0]; if (h && !h[1].test(x.host)) return { lv: 'e', msg: 'এটা ' + (label || p) + '-এর লিংক নয় (' + x.host + ')' }; }
    if (!x.path.replace(/\/+$/, '') && !x.q) return { lv: 'e', msg: 'শুধু হোম-পেজ — নির্দিষ্ট প্রোফাইল/পোস্ট লিংক দিন' };
    var ps = postShape(p, x);
    if (kind === 'post' && ps === false) return { lv: 'e', msg: 'এই সার্ভিসে পোস্ট/ভিডিওর লিংক লাগে — প্রোফাইল লিংক চলবে না' };
    if (kind === 'profile' && ps === true) return { lv: 'e', msg: 'এই সার্ভিসে প্রোফাইল/চ্যানেলের লিংক লাগে — পোস্টের লিংক চলবে না' };
    return { lv: 'g', msg: 'লিংকের ফরম্যাট ঠিক' };
  }
  var linkFor = function (label, kind) { var L = LK[label] || {}; return kind === 'profile' ? L.profile : kind === 'post' ? L.post : (L.profile || L.post); };

  /* ---------- কিউ আইটেম ---------- */
  var fxOf = function (r) { return +r._fx > 0 ? +r._fx : S.fx; };
  function lblOf(r) {
    if (!r._stage) return S.label;
    var p = plat(r.name), m = p ? S.plats.filter(function (z) { return plat(z.label) === p; })[0] : null;
    return m ? m.label : (r.platform_label || r.name || S.label);
  }
  function qtyDef(r) { var mn = +r.min > 0 ? +r.min : 10, mx = +r.max > 0 ? +r.max : 0; return mx && mn > mx ? mx : mn; }
  function onSite(r) { try { if (C && C.onSite && C.onSite({ service_id: r.service_id })) return true; } catch (e) {} return r.state === 'on'; }
  var ONT = ' <span class="tag" style="color:#34d399;border-color:#34d399">✔ সাইটে চালু</span>';
  function isCm(r) { return (/custom/i.test(r.type || '') && /comment/i.test(r.type || '')) || (/custom/i.test(r.name || '') && /comment/i.test(r.name || '')); }
  function cmLines(t) { return String(t || '').replace(/\r/g, '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
  function qtyOf(r) { var k = r.provider + '|' + r.service_id; if (isCm(r)) return cmLines(S.cm[k]).length; var v = Math.floor(+S.qty[k]); return v > 0 ? v : qtyDef(r); }
  function mkItem(r) {
    var kind = kindOf(r.name), lb = lblOf(r), k0 = r.provider + '|' + r.service_id, link = (Object.prototype.hasOwnProperty.call(S.lnk, k0) ? S.lnk[k0] : linkFor(lb, kind)) || '', mn = +r.min > 0 ? +r.min : 10, mx = +r.max > 0 ? +r.max : 0;
    var qty = qtyOf(r), cost = r2((+r.rate || 0) * fxOf(r) * qty / 1000);
    var it = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), provider: r.provider, sid: String(r.service_id), name: String(r.name || ''), label: lb, type: r._stage ? (r._type || '') : S.type,
      refill: +r.refill ? 1 : 0, kind: kind, link: link, qty: qty, cost: cost, state: 'wait', msg: '', po: '', req: 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) };
    if (isCm(r)) { it.comments = cmLines(S.cm[k0]).join('\n'); }
    if (isCm(r) && !qty) { it.state = 'skip'; it.msg = 'কমেন্ট লেখা হয়নি (প্রতি লাইনে একটা)'; }
    else if (!(qty >= mn)) { it.state = 'skip'; it.msg = (isCm(r) ? 'কমেন্ট ন্যূনতম ' : 'পরিমাণ ন্যূনতম ') + bn(mn) + ' হতে হবে'; }
    else if (mx && qty > mx) { it.state = 'skip'; it.msg = 'পরিমাণ সর্বোচ্চ ' + bn(mx) + ' হতে পারে'; }
    else if (!link) { it.state = 'skip'; it.msg = 'এই ধরনের (' + (kind === 'post' ? 'পোস্ট' : kind === 'profile' ? 'প্রোফাইল' : 'যেকোনো') + ') লিংক দেওয়া নেই'; }
    else { var c = linkCheck(lb, kind, link); if (c.lv === 'e') { it.state = 'skip'; it.msg = c.msg; } }
    if (it.state === 'wait' && !(cost >= 0)) { it.state = 'skip'; it.msg = 'দাম জানা নেই'; }
    if (it.state === 'wait' && cost > ST.cap) { it.state = 'skip'; it.msg = 'একটার খরচ ' + money(cost) + ' — সীমা ' + money(ST.cap) + ' ছাড়িয়ে যায়'; }
    return it;
  }
  var live = function (x) { return x.state === 'wait' || x.state === 'run' || x.state === 'unknown'; };
  function inQueue(r) { return Q.items.some(function (x) { return x.provider === r.provider && x.sid === String(r.service_id) && live(x); }); }
  var sentCost = function () { return Q.items.reduce(function (a, x) { return a + (x.state === 'sent' ? +x.cost || 0 : 0); }, 0); };
  var waitCost = function () { return Q.items.reduce(function (a, x) { return a + (x.state === 'wait' ? +x.cost || 0 : 0); }, 0); };

  /* ---------- ⚠ দ্বিতীয় অর্ডারের সতর্কতা: কিউ শুরুর আগে দেখে — একই লিংকে একই সার্ভিসের টেস্ট এখনও চলছে কিনা ---------- */
  function nzLink(u) { return String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^(www|m|vm|mobile)\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/^@/, ''); }
  function sameLink(a, b) { a = nzLink(a); b = nzLink(b); if (!a || !b) return false; if (a === b) return true; var s = a.length < b.length ? a : b, l = a.length < b.length ? b : a; return s.length >= 5 && l.indexOf(s) >= 0; }
  function rowFin(r) { return r.completed_at > 0 || /completed|partial|cancel|refund|fail|error/.test(String(r.status || '').toLowerCase()); }
  async function dupWarn() {
    var rows = []; try { var d = await C.api('svc_spd', { limit: 300 }); rows = (d && d.rows) || []; } catch (e) { return ''; }
    var busy = rows.filter(function (r) { return !rowFin(r) && r.link; }), n = 0, names = [];
    Q.items.forEach(function (it) {
      if (it.state !== 'wait') return;
      var hit = busy.some(function (r) { return r.provider === it.provider && String(r.service_id) === String(it.sid) && sameLink(r.link, it.link); });
      if (hit) { n++; it.dup = 1; it.msg = '⚠ এই লিংকে এই সার্ভিসের টেস্ট এখনও চলছে'; if (names.length < 3) names.push(it.provider + ' #' + it.sid); }
      else if (it.dup) { it.dup = 0; if (/^⚠ এই লিংকে/.test(it.msg || '')) it.msg = ''; }
    });
    saveQ();
    return n ? '⚠ ' + bn(n) + 'টি আইটেমে একই লিংকে একই সার্ভিসের টেস্ট এখনও চলছে (' + names.join(', ') + (n > names.length ? '…' : '') + ') — চালালে দ্বিতীয় অর্ডার যাবে। তবুও চালাতে আবার ট্যাপ করুন; না চাইলে ওগুলো ✕ দিয়ে সরান।' : '';
  }

  /* ---------- রান লুপ: একটা একটা করে, বাজেটে থামে, লিংক বারবার ভুল হলে থামে ---------- */
  async function run() {
    if (Q.run) return;
    Q.run = true; stopFlag = false; stopMsg = ''; armed = false; var my = ++runId, lf = {};
    saveQ(); paintQ();
    try {
      for (; ;) {
        if (stopFlag || my !== runId) break;
        var it = null; for (var i = 0; i < Q.items.length; i++) if (Q.items[i].state === 'wait') { it = Q.items[i]; break; }
        if (!it) break;
        if (sentCost() + it.cost > ST.budget) { stopMsg = 'বাজেট ' + money(ST.budget) + ' শেষ — বাকিগুলো অপেক্ষায় আছে'; break; }
        var lc = linkCheck(it.label, it.kind, it.link);
        if (lc.lv === 'e') { it.state = 'skip'; it.msg = lc.msg; saveQ(); paintQ(); continue; }
        it.state = 'run'; it.msg = ''; saveQ(); paintQ();
        try {
          var o = await C.api('svc_order', { provider: it.provider, service: it.sid, link: it.link, quantity: it.qty, comments: it.comments || undefined, confirm: true, req_id: it.req });
          it.state = 'sent'; it.po = String(o.provider_order || ''); it.cost = +o.cost_bdt || it.cost; it.at = Date.now(); it.msg = ''; lf[it.label] = 0;
          MT[it.provider + '|' + it.sid] = { label: it.label, type: it.type, refill: it.refill, kind: it.kind, at: it.at }; sv(KM, MT);
        } catch (e) {
          if (C.authFail(e)) { it.state = 'wait'; stopFlag = true; break; }
          var code = e && e.code, m = (e && e.message) || 'ব্যর্থ';
          if (code === 'net' || code === 'not_json' || code === 'unknown_result' || code === 'in_flight') { it.state = 'unknown'; it.msg = m; stopFlag = true; stopMsg = 'নেটওয়ার্ক/প্রভাইডারের সমস্যা — অর্ডার গিয়েছে কিনা স্পিড পাতায় দেখে তারপর চালান'; }
          else if (code === 'day_limit') { it.state = 'wait'; stopFlag = true; stopMsg = m; }
          else {
            it.state = 'fail'; it.msg = m;
            if (code === 'bad_link' || /link|url|username|incorrect|invalid|not found/i.test(m)) lf[it.label] = (lf[it.label] || 0) + 1; else lf[it.label] = 0;
            if (lf[it.label] >= 2) { stopFlag = true; stopMsg = 'পর পর ২টি অর্ডার লিংকের কারণে ফেইল — লিংক ঠিক করে আবার চালান (আর টাকা নষ্ট করা হয়নি)'; }
          }
        }
        saveQ(); paintQ();
        if (!stopFlag) await sleep(2000);
      }
    } finally {
      Q.run = false; Q.items.forEach(function (x) { if (x.state === 'run') x.state = 'unknown'; });
      saveQ(); paintQ();
      var left = Q.items.filter(function (x) { return x.state === 'wait'; }).length;
      if (!stopMsg && !left) stopMsg = 'কিউ শেষ — রিপোর্টে ফলাফল দেখুন';
      var n = box && box.querySelector('#tqNote'); if (n) n.textContent = stopMsg;
      if (stopMsg && C.toast) C.toast(stopMsg.length > 60 ? stopMsg.slice(0, 58) + '…' : stopMsg);
    }
  }

  /* ---------- পেজ কাঠামো ---------- */
  function mount(ctx) {
    C = ctx; tok++;
    var t = document.getElementById('title'), b = document.getElementById('back'); if (t) t.textContent = 'টেস্ট কিউ'; if (b) b.hidden = true;
    box = document.getElementById('main'); if (!box) return;
    box.innerHTML = '<div class="tq"><p class="sub">অনেক সার্ভিস একসাথে বেছে ন্যূনতম পরিমাণে একটা একটা করে টেস্ট অর্ডার দিন। খরচের সীমা পেরোলে ও লিংক বারবার ভুল হলে কিউ নিজেই থামে।</p>' +
      '<div class="chips" id="tqTabs" role="tablist"></div><div id="tqBody"></div></div>';
    tabs(); body();
  }
  function tabs() {
    var el = box.querySelector('#tqTabs'); if (!el) return;
    el.innerHTML = [['q', '🧪 কিউ'], ['r', '📋 রিপোর্ট'], ['c', '💰 খরচ']].map(function (x) { return '<button type="button" class="chip" role="tab" data-t="' + x[0] + '" aria-pressed="' + (S.tab === x[0]) + '">' + x[1] + '</button>'; }).join('');
    el.onclick = function (e) { var k = e.target.closest('[data-t]'); if (!k) return; S.tab = k.dataset.t; tabs(); body(); };
  }
  function body() { if (S.tab === 'q') qTab(); else repTab(S.tab); }

  /* ---------- ট্যাব ১: কিউ বানান ---------- */
  async function qTab() {
    var el = box.querySelector('#tqBody'), my = tok; if (!el) return;
    el.innerHTML = '<div class="sk"></div>';
    try {
      if (!S.plats.length) { var d = await C.api('svc_platforms'); S.plats = (d.platforms || []).filter(function (p) { return (p.total || p.n || 0) > 0; }); S.plats.sort(function (a, b) { return (b.total || b.n || 0) - (a.total || a.n || 0); }); }
    } catch (e) { if (!C.authFail(e) && my === tok) el.innerHTML = '<div class="card"><p class="err">' + esc(e.message) + '</p></div>'; return; }
    if (my !== tok) return;
    if (!S.plats.some(function (p) { return p.label === S.label; })) { S.label = (S.plats[0] || {}).label || ''; S.type = ''; }
    el.innerHTML = '<div class="card tqc"><h3>১. লিংক (পরীক্ষার জন্য)</h3>' +
      '<label for="tqPl">প্ল্যাটফর্ম</label><select id="tqPl" class="plmore">' + S.plats.map(function (p) { return '<option value="' + esc(p.label) + '"' + (p.label === S.label ? ' selected' : '') + '>' + esc(p.label) + ' (' + bn(p.total || p.n || 0) + 'টি)</option>'; }).join('') + '</select>' +
      '<label for="tqLp">প্রোফাইল / চ্যানেল লিংক <small>(ফলোয়ার, সাবস্ক্রাইবার, মেম্বার…)</small></label><input id="tqLp" autocomplete="off" inputmode="url" placeholder="https://…">' +
      '<div class="chk" id="tqCp" aria-live="polite"></div>' +
      '<label for="tqLo">পোস্ট / ভিডিও লিংক <small>(লাইক, ভিউ, কমেন্ট, শেয়ার…)</small></label><input id="tqLo" autocomplete="off" inputmode="url" placeholder="https://…">' +
      '<div class="chk" id="tqCo" aria-live="polite"></div>' +
      '<p class="sub">নিজের বা পরীক্ষার জন্য রাখা একটা অ্যাকাউন্ট/পোস্ট দিন। লিংকের ফরম্যাট ও ধরন মিলিয়ে দেখা হয়; লিংক সত্যিই চালু কি না ব্রাউজার থেকে দেখা যায় না — প্রভাইডার ভুল বললে কিউ থামে।</p></div>' +
      '<div class="card tqc"><h3>২. সার্ভিস বাছুন</h3><div class="chips" id="tqTy"></div>' +
      '<div class="bar"><input id="tqQ" type="search" placeholder="নাম বা আইডি" aria-label="খুঁজুন" value="' + esc(S.q) + '"></div>' +
      '<div class="chips"><button type="button" class="chip" id="tqUn" aria-pressed="' + S.un + '">🔎 শুধু অপরীক্ষিত</button><button type="button" class="chip" id="tqTop">সস্তা ১০টি বাছুন</button><button type="button" class="chip" id="tqNone">বাছাই মুছুন</button></div>' +
      '<div id="tqLs"></div></div>' +
      '<div class="card tqc"><h3>৩. খরচের সীমা</h3><div class="tqg"><div><label for="tqBg">মোট বাজেট (৳)</label><input id="tqBg" type="number" inputmode="decimal" min="1" value="' + esc(ST.budget) + '"></div><div><label for="tqCap">একটার সর্বোচ্চ (৳)</label><input id="tqCap" type="number" inputmode="decimal" min="1" value="' + esc(ST.cap) + '"></div></div>' +
      '<p class="sub">সার্ভারেও আলাদা সীমা আছে: একটা অর্ডারে সর্বোচ্চ ৳৩০০, দিনে ৳১০০০ (ডিফল্ট)। এখানে ছোট সীমা দিলে সেটাই মানা হবে।</p><h4 class="tqh">প্রতিটা সার্ভিসের পরিমাণ</h4><div id="tqSel"></div><p class="tqm" id="tqSum"></p>' +
      '<div class="acts"><button type="button" class="btn" id="tqAdd">কিউতে যোগ করুন</button></div><p class="err" id="tqAddE" role="alert"></p></div>' +
      '<div class="card tqc"><h3>৪. কিউ</h3><div id="tqQl"></div></div>';
    var L = LK[S.label] || {}; el.querySelector('#tqLp').value = L.profile || ''; el.querySelector('#tqLo').value = L.post || '';
    linkPaint();
    el.querySelector('#tqPl').onchange = function (e) { S.label = e.target.value; S.type = ''; S.picks = {}; S.pool = []; S.rows = []; var L2 = LK[S.label] || {}; el.querySelector('#tqLp').value = L2.profile || ''; el.querySelector('#tqLo').value = L2.post || ''; linkPaint(); loadRows(); };
    ['tqLp', 'tqLo'].forEach(function (id) { el.querySelector('#' + id).oninput = function () { var L3 = LK[S.label] || (LK[S.label] = {}); L3[id === 'tqLp' ? 'profile' : 'post'] = this.value.trim(); sv(KL, LK); linkPaint(); sumPaint(); }; });
    var qt = null; el.querySelector('#tqQ').oninput = function (e) { S.q = e.target.value.trim(); localShow(); clearTimeout(qt); if (S.q && !S.full) qt = setTimeout(function () { loadRows(true); }, 220); };
    el.querySelector('#tqUn').onclick = function (e) { S.un = !S.un; S.pool = []; e.currentTarget.setAttribute('aria-pressed', S.un); loadRows(); };
    el.querySelector('#tqTop').onclick = function () { var n = 0; S.rows.slice().sort(function (a, b) { return (+a.rate || 0) - (+b.rate || 0); }).forEach(function (r) { if (n < 10 && !inQueue(r) && +r.rate > 0) { S.picks[r.provider + '|' + r.service_id] = 1; n++; } }); rowsPaint(); };
    el.querySelector('#tqNone').onclick = function () { S.picks = {}; rowsPaint(); };
    el.querySelector('#tqBg').oninput = function () { var v = +this.value; if (v > 0) { ST.budget = v; saveS(); } sumPaint(); };
    el.querySelector('#tqCap').oninput = function () { var v = +this.value; if (v > 0) { ST.cap = v; saveS(); } selPaint(); sumPaint(); };
    el.querySelector('#tqAdd').onclick = addPicks;
    qPaint(); selPaint(); sumPaint(); loadRows();
  }
  function linkPaint() {
    var L = LK[S.label] || {};
    [['tqCp', L.profile, 'profile'], ['tqCo', L.post, 'post']].forEach(function (z) {
      var e = box.querySelector('#' + z[0]); if (!e) return;
      if (!z[1]) { e.innerHTML = ''; return; }
      var c = linkCheck(S.label, z[2], z[1]); e.innerHTML = '<div class="ck ' + (c.lv === 'g' ? 'g' : c.lv) + '">' + (c.lv === 'g' ? '✔ ' : c.lv === 'w' ? '⚠ ' : '✖ ') + esc(c.msg) + '</div>';
    });
  }
  /* খোঁজা: একবার ~৩০০টি সার্ভিস এনে ফোনেই ছেঁকে নেওয়া হয় — অক্ষর লিখলেই সাথে সাথে ফল (সার্ভার ডাকা লাগে না) */
  function localShow() {
    var tk = S.q.toLowerCase().split(/\s+/).filter(Boolean), out = [];
    for (var i = 0; i < S.pool.length && out.length < 60; i++) {
      var r = S.pool[i], h = (r.name + ' ' + r.service_id + ' ' + r.provider + ' ' + (r.category || '')).toLowerCase(), ok = true;
      for (var j = 0; j < tk.length; j++) if (h.indexOf(tk[j]) < 0) { ok = false; break; }
      if (ok) out.push(r);
    }
    S.rows = out; rowsPaint();
  }
  function remember(rows) { rows.forEach(function (r) { S.known[r.provider + '|' + r.service_id] = r; }); }
  async function loadRows(srv) {
    var el = box.querySelector('#tqLs'), my = ++S.load; if (!el) return;
    var ck = S.label + '|' + S.type + '|' + S.un, c = !srv && S.cache[ck];
    if (c && Date.now() - c.at < 60000) { applyPool(c.d); return; }
    if (!srv && !S.pool.length) el.innerHTML = '<div class="sk"></div>';
    var q0 = S.q;
    try {
      var d = await C.api('svc_best', { label: S.label, type: S.type, q: srv ? q0 : '', refill: false, untested: S.un, limit: srv ? 30 : 300 });
      if (my !== S.load || !box.querySelector('#tqLs')) return;
      if (srv) { if (q0 !== S.q) return; S.fx = d.fx || S.fx; S.rows = d.rows || []; remember(S.rows); rowsPaint(); return; }
      S.cache[ck] = { at: Date.now(), d: d }; if (d.type) S.cache[S.label + '|' + d.type + '|' + S.un] = S.cache[ck];
      applyPool(d);
      if (S.q && !S.full) loadRows(true);
    } catch (e) { if (my === S.load && !C.authFail(e)) el.innerHTML = '<p class="err">' + esc(e.message) + '</p>'; }
  }
  function applyPool(d) {
    S.type = d.type; S.fx = d.fx || 131; S.pool = d.rows || []; S.types = d.types || []; S.full = S.pool.length >= (d.shown_n != null ? d.shown_n : S.pool.length);
    remember(S.pool);
    var ty = box.querySelector('#tqTy'); if (ty) ty.innerHTML = S.types.map(function (t) { return '<button type="button" class="chip" data-t="' + esc(t[0]) + '" aria-pressed="' + (t[0] === d.type) + '"> ' + esc(t[0]) + '<small>' + bn(t[1]) + '</small></button>'; }).join('');
    if (ty) ty.onclick = function (e) { var k = e.target.closest('[data-t]'); if (!k) return; S.type = k.dataset.t; S.picks = {}; loadRows(); };
    localShow();
  }
  function rowsPaint() {
    var el = box.querySelector('#tqLs'); if (!el) return;
    if (!S.rows.length) { el.innerHTML = '<div class="empty">' + (S.un ? 'এই ধরনের সব সার্ভিসই টেস্ট করা, বা কিছু পাওয়া যায়নি। "শুধু অপরীক্ষিত" বন্ধ করে দেখুন।' : 'কোনো সার্ভিস পাওয়া যায়নি।') + '</div>'; selPaint(); sumPaint(); return; }
    el.innerHTML = S.rows.map(function (r, i) {
      var k = r.provider + '|' + r.service_id, mn = +r.min > 0 ? +r.min : 10, cost = r2((+r.rate || 0) * S.fx * mn / 1000), dis = inQueue(r) || !(+r.rate > 0);
      return '<label class="tqr' + (dis ? ' off' : '') + '"><input type="checkbox" class="tqk" data-i="' + i + '"' + (S.picks[k] && !dis ? ' checked' : '') + (dis ? ' disabled' : '') + '>' +
        '<span class="tqb"><b class="bnm">' + esc(r.name) + '</b><span class="sub">' + esc(r.provider) + ' · আইডি ' + esc(r.service_id) + ' · ন্যূনতম ' + bn(mn) + '</span>' +
        '<span class="tqm"><span class="tag">' + money(cost) + ' একটায়</span> <span class="tag">স্কোর ' + bn(r.score) + '</span>' + (r.tested ? ' <span class="tag">টেস্টেড ✓</span>' : r.try_it ? ' <span class="tag tst mid">টেস্ট করার মতো</span>' : '') + (+r.refill ? ' <span class="tag">♻ রিফিল</span>' : '') + (onSite(r) ? ONT : '') + (inQueue(r) ? ' <span class="tag">কিউতে আছে</span>' : '') + '</span></span></label>';
    }).join('');
    el.onchange = function (e) { var c = e.target.closest('.tqk'); if (!c) return; var r = S.rows[+c.dataset.i]; if (!r) return; var k = r.provider + '|' + r.service_id; if (c.checked) S.picks[k] = 1; else delete S.picks[k]; selPaint(); sumPaint(); };
    selPaint(); sumPaint();
  }
  /* বাছা প্রতিটা সার্ভিসের পরিমাণ (ধাপ ৩) — কিবোর্ডে লিখলে বক্স নতুন করে আঁকা হয় না, শুধু খরচ বদলায় */
  function selCost(r) { return r2((+r.rate || 0) * fxOf(r) * qtyOf(r) / 1000); }
  function selErr(r) { var q = qtyOf(r), mn = +r.min > 0 ? +r.min : 10, mx = +r.max > 0 ? +r.max : 0; return isCm(r) && !q ? 'কমেন্ট লিখুন — প্রতি লাইনে একটা' : q < mn ? 'ন্যূনতম ' + bn(mn) + (isCm(r) ? 'টি কমেন্ট' : '') : (mx && q > mx ? 'সর্বোচ্চ ' + bn(mx) : (selCost(r) > ST.cap ? 'খরচ সীমা ' + money(ST.cap) + ' ছাড়িয়ে যায়' : '')); }
  function lnkOf(r) { var k = r.provider + '|' + r.service_id, kind = kindOf(r.name); return Object.prototype.hasOwnProperty.call(S.lnk, k) ? S.lnk[k] : (linkFor(lblOf(r), kind) || ''); }
  function lnkChk(r) {
    var kind = kindOf(r.name), u = lnkOf(r); if (!u) return '<div class="ck e">✖ লিংক দেওয়া নেই</div>';
    var c = linkCheck(lblOf(r), kind, u); return '<div class="ck ' + c.lv + '">' + (c.lv === 'g' ? '✔ ' : c.lv === 'w' ? '⚠ ' : '✖ ') + esc(c.msg) + '</div>';
  }
  /* ধাপ ৩ — বাছা প্রতিটা সার্ভিসের পরিমাণ ও নিজস্ব লিংক; কিবোর্ডে লিখলে বক্স নতুন করে আঁকা হয় না */
  function selPaint() {
    var el = box.querySelector('#tqSel'); if (!el) return;
    var P = picked();
    if (!P.length) { el.innerHTML = '<p class="sub">২ নম্বর থেকে (বা প্রভাইডার পাতায় টিক দিয়ে "🧪 টেস্ট কিউতে") সার্ভিস বাছলে এখানে প্রতিটার জন্য আলাদা লিংক ও পরিমাণ বসাতে পারবেন।</p>'; return; }
    el.innerHTML = P.map(function (r) {
      var k = r.provider + '|' + r.service_id, mn = +r.min > 0 ? +r.min : 10, mx = +r.max > 0 ? +r.max : 0, v = S.qty[k] > 0 ? S.qty[k] : qtyDef(r), er = selErr(r), kind = kindOf(r.name);
      return '<div class="tqs3" data-k="' + esc(k) + '"><div class="tqs3h"><b class="bnm">' + esc(r.name) + '</b>' + (r._stage ? '<button type="button" class="ib" data-x="' + esc(k) + '" aria-label="বাদ দিন">✕</button>' : '') + '</div><span class="sub">' + esc(r.provider) + ' · আইডি ' + esc(r.service_id) + ' · ন্যূনতম ' + bn(mn) + (mx ? ' · সর্বোচ্চ ' + bn(mx) : '') + '</span>' + (onSite(r) ? '<span class="sub">' + ONT + ' — আবার টেস্ট করলেও সাইটে আগের সার্ভিসই থাকবে</span>' : '') +
        '<label>' + (kind === 'post' ? 'পোস্ট / ভিডিও লিংক' : kind === 'profile' ? 'প্রোফাইল / চ্যানেল লিংক' : 'লিংক') + '<input type="text" inputmode="url" autocomplete="off" placeholder="https://…" value="' + esc(lnkOf(r)) + '" data-l="' + esc(k) + '" aria-label="লিংক"></label><div data-lc>' + lnkChk(r) + '</div>' +
        (isCm(r) ? '<label>কমেন্ট লিখুন — প্রতি লাইনে একটা<textarea rows="5" data-cm="' + esc(k) + '" placeholder="Nice post!&#10;Great work 👏" style="min-height:120px;resize:vertical;overflow:auto" aria-label="কমেন্ট">' + esc(S.cm[k] || '') + '</textarea></label><div class="tqq"><span class="sub" data-cn>কমেন্ট সংখ্যা: ' + bn(qtyOf(r)) + '</span><span class="tag" data-c>' + money(selCost(r)) + '</span></div>' : '<div class="tqq"><label>পরিমাণ<input type="number" inputmode="numeric" min="' + mn + '"' + (mx ? ' max="' + mx + '"' : '') + ' step="1" value="' + esc(v) + '" data-q="' + esc(k) + '" aria-label="পরিমাণ"></label><span class="tag" data-c>' + money(selCost(r)) + '</span></div>') + '<span class="er" data-e>' + esc(er) + '</span></div>';
    }).join('');
    el.oninput = function (e) {
      var inp = e.target.closest('[data-q],[data-l],[data-cm]'); if (!inp) return; var k = inp.dataset.q || inp.dataset.l || inp.dataset.cm, r = picked().filter(function (z) { return z.provider + '|' + z.service_id === k; })[0]; if (!r) return;
      var w = inp.closest('.tqs3');
      if (inp.dataset.l) { S.lnk[k] = inp.value.trim(); saveN(); var lc = w && w.querySelector('[data-lc]'); if (lc) lc.innerHTML = lnkChk(r); }
      else if (inp.dataset.cm) { S.cm[k] = inp.value; saveC(); var cn = w && w.querySelector('[data-cn]'), c2 = w && w.querySelector('[data-c]'), x2 = w && w.querySelector('[data-e]'); if (cn) cn.textContent = 'কমেন্ট সংখ্যা: ' + bn(qtyOf(r)); if (c2) c2.textContent = money(selCost(r)); if (x2) x2.textContent = selErr(r); }
      else { var v = Math.floor(+inp.value); if (v > 0) S.qty[k] = v; else delete S.qty[k]; var c = w && w.querySelector('[data-c]'), x = w && w.querySelector('[data-e]'); if (c) c.textContent = money(selCost(r)); if (x) x.textContent = selErr(r); }
      sumPaint();
    };
    el.onclick = function (e) { var b = e.target.closest('[data-x]'); if (!b) return; SG = SG.filter(function (z) { return z.provider + '|' + z.service_id !== b.dataset.x; }); saveG(); selPaint(); sumPaint(); };
  }
  function picked() {
    var seen = {}, out = [];
    Object.keys(S.picks).forEach(function (k) { var r = S.known[k]; if (r && !inQueue(r) && +r.rate > 0 && !seen[k]) { seen[k] = 1; out.push(r); } });
    SG.forEach(function (r) { var k = r.provider + '|' + r.service_id; if (!seen[k] && !inQueue(r) && +r.rate > 0) { seen[k] = 1; out.push(r); } });
    return out;
  }
  function sumPaint() {
    var e = box.querySelector('#tqSum'); if (!e) return;
    var P = picked(), items = P.map(mkItem), ok = items.filter(function (x) { return x.state === 'wait'; }), bad = items.length - ok.length, tot = ok.reduce(function (a, x) { return a + x.cost; }, 0);
    var over = sentCost() + waitCost() + tot > ST.budget;
    e.innerHTML = P.length ? ('বাছা ' + bn(P.length) + 'টি · টেস্ট করা যাবে ' + bn(ok.length) + 'টি · আনুমানিক খরচ <b>' + money(tot) + '</b>' + (bad ? ' · <span class="er">লিংক/খরচের কারণে বাদ ' + bn(bad) + 'টি</span>' : '') + (over ? ' · <span class="er">বাজেটের বেশি — শেষের দিকগুলো থামবে</span>' : '')) : 'কিছু বাছা হয়নি';
  }
  function addPicks() {
    var E = box.querySelector('#tqAddE'), P = picked(); E.textContent = '';
    if (!P.length) { E.textContent = 'আগে কমপক্ষে একটা সার্ভিস বাছুন'; return; }
    var items = P.map(mkItem), ok = items.filter(function (x) { return x.state === 'wait'; });
    items.forEach(function (x) { Q.items.push(x); });
    P.forEach(function (r) { var k = r.provider + '|' + r.service_id; delete S.qty[k]; delete S.lnk[k]; delete S.cm[k]; });
    SG = SG.filter(function (z) { return !P.some(function (r) { return r.provider === z.provider && String(r.service_id) === String(z.service_id); }); }); saveG(); saveN(); saveC();
    S.picks = {}; S.cache = {}; saveQ(); rowsPaint(); qPaint();
    if (!ok.length) E.textContent = 'কোনোটাই টেস্টের উপযোগী নয় — কারণ কিউ-তে লেখা আছে (লিংক দিন বা সীমা বাড়ান)';
    else if (C.toast) C.toast(bn(ok.length) + 'টি কিউতে যোগ হয়েছে ✔');
  }
  var ICON = { wait: '⏳', run: '🔄', sent: '✅', skip: '⏭', fail: '✖', unknown: '❓' };
  var TXT = { wait: 'অপেক্ষায়', run: 'পাঠানো হচ্ছে', sent: 'গেছে', skip: 'বাদ', fail: 'ব্যর্থ', unknown: 'নিশ্চিত নয়' };
  function paintQ() { qPaint(); }
  function qPaint() {
    var el = box && box.querySelector('#tqQl'); if (!el) return;
    var n = {}; Q.items.forEach(function (x) { n[x.state] = (n[x.state] || 0) + 1; });
    var left = n.wait || 0, tot = Q.items.length;
    if (!tot) { el.innerHTML = '<div class="empty">কিউ খালি। ওপর থেকে সার্ভিস বেছে "কিউতে যোগ করুন" চাপুন।</div>'; return; }
    el.innerHTML = '<p class="tqm">মোট ' + bn(tot) + 'টি · অপেক্ষায় ' + bn(left) + ' · গেছে ' + bn(n.sent || 0) + ' · ব্যর্থ/বাদ ' + bn((n.fail || 0) + (n.skip || 0)) + (n.unknown ? ' · নিশ্চিত নয় ' + bn(n.unknown) : '') + '<br>খরচ হয়েছে ' + money(sentCost()) + ' · বাকিতে ≈ ' + money(waitCost()) + ' · বাজেট ' + money(ST.budget) + '</p>' +
      '<div class="tqp" role="progressbar" aria-valuemin="0" aria-valuemax="' + tot + '" aria-valuenow="' + (tot - left) + '"><i style="width:' + Math.round((tot - left) / tot * 100) + '%"></i></div>' +
      '<p class="sub" id="tqNote" role="status">' + esc(stopMsg) + '</p>' +
      '<div class="acts"><button type="button" class="btn" id="tqGo"' + (left && !Q.run ? '' : ' disabled') + '>' + (Q.run ? 'চলছে…' : armed ? 'নিশ্চিত — ' + bn(left) + 'টি অর্ডার, ≈' + money(Math.min(waitCost(), Math.max(0, ST.budget - sentCost()))) + ' কাটবে। আবার ট্যাপ করুন' : '▶ শুরু / চালিয়ে যান') + '</button>' + (Q.run ? '<button type="button" class="sm" id="tqStop">⏸ থামান</button>' : '<button type="button" class="sm" id="tqClr">শেষগুলো মুছুন</button>') + '</div>' +
      '<div class="tqi">' + Q.items.slice().reverse().map(function (x) {
        return '<div class="tql s-' + x.state + '"><span class="tqs" aria-hidden="true">' + ICON[x.state] + '</span><div class="tqt"><b class="bnm">' + esc(x.name) + '</b><span class="sub">' + esc(x.provider) + ' · #' + esc(x.sid) + ' · পরিমাণ ' + bn(x.qty) + ' · ' + money(x.cost) + (x.po ? ' · অর্ডার #' + esc(x.po) : '') + '</span><span class="sub">' + TXT[x.state] + (x.msg ? ' — ' + esc(x.msg) : '') + '</span></div>' +
          (x.state === 'unknown' && !Q.run ? '<button type="button" class="sm" data-rt="' + esc(x.id) + '">আবার চেষ্টা</button>' : '') + (x.state === 'wait' && !Q.run || x.state === 'skip' || x.state === 'fail' ? '<button type="button" class="ib" data-rm="' + esc(x.id) + '" aria-label="কিউ থেকে সরান">✕</button>' : '') + '</div>';
      }).join('') + '</div>';
    var go = el.querySelector('#tqGo'), sp = el.querySelector('#tqStop'), cl = el.querySelector('#tqClr');
    if (go) go.onclick = async function () { if (!armed) { var t0 = tok; go.disabled = true; var w = ''; try { w = await dupWarn(); } catch (e) { } if (t0 !== tok) return; stopMsg = w; armed = true; qPaint(); return; } run(); };
    if (sp) sp.onclick = function () { stopFlag = true; stopMsg = 'থামানো হয়েছে — চলমান অর্ডার শেষ হলে কিউ থামবে'; var nn = el.querySelector('#tqNote'); if (nn) nn.textContent = stopMsg; };
    if (cl) cl.onclick = function () { Q.items = Q.items.filter(function (x) { return live(x); }); armed = false; saveQ(); qPaint(); rowsPaint(); };
    el.onclick = function (e) {
      var rt = e.target.closest('[data-rt]'), rm = e.target.closest('[data-rm]');
      if (rt) { Q.items.forEach(function (x) { if (x.id === rt.dataset.rt && x.state === 'unknown') { x.state = 'wait'; x.msg = ''; } }); armed = false; saveQ(); qPaint(); }
      if (rm) { Q.items = Q.items.filter(function (x) { return !(x.id === rm.dataset.rm && !(x.state === 'run')); }); armed = false; saveQ(); qPaint(); rowsPaint(); }
    };
  }

  /* ---------- ট্যাব ২ ও ৩: রিপোর্ট / খরচ (svc_spd + svc_tested থেকে) ---------- */
  function verdict(r) {
    var s = String(r.status || '').toLowerCase(), q = +r.quantity || 0, dl = r.delivered;
    if (/cancel|refund|fail|error/.test(s)) return { k: 'f', t: '✖ ফেইল', why: 'অর্ডার ' + (r.status || 'ব্যর্থ') };
    if (/partial/.test(s)) return { k: 'w', t: '⚠ আংশিক', why: dl != null && q ? bn(dl) + '/' + bn(q) + ' এসেছে' : 'পুরোটা আসেনি' };
    if (r.completed_at > 0 || s === 'completed') {
      var full = dl == null || !q || dl >= q * 0.98;
      return full ? { k: 'g', t: '✔ পাস', why: 'পুরো ডেলিভারি' } : { k: 'w', t: '⚠ কম ডেলিভারি', why: bn(dl) + '/' + bn(q) + ' এসেছে' };
    }
    return { k: 'o', t: '⏳ চলছে', why: r.started_at > 0 ? 'শুরু হয়েছে' : 'এখনো শুরু হয়নি' };
  }
  async function repData(force) {
    if (S.rep && !force && Date.now() - S.rep.at < 20000) return S.rep;
    var d = await C.api('svc_spd', { limit: 300 }), tt = {};
    try { tt = (await C.api('svc_tested')).tested || {}; } catch (e) { if (C.authFail(e)) throw e; }
    var rows = (d.rows || []).filter(function (r) { return r.src === 'studio'; }), by = {}, order = [];
    rows.forEach(function (r) { var k = r.provider + '|' + r.service_id; if (!by[k]) { by[k] = { k: k, latest: r, n: 0 }; order.push(k); } by[k].n++; });
    S.rep = { at: Date.now(), rows: rows, by: by, order: order, tested: tt, total: d.total || rows.length, scores: S.rep && S.rep.scores || {} };
    return S.rep;
  }
  async function repTab(kind) {
    var el = box.querySelector('#tqBody'), my = tok; if (!el) return;
    el.innerHTML = '<div class="sk"></div>';
    var R; try { R = await repData(true); } catch (e) { if (!C.authFail(e) && my === tok) el.innerHTML = '<div class="card"><p class="err">' + esc(e.message) + '</p></div>'; return; }
    if (my !== tok || S.tab !== kind) return;
    if (kind === 'r') { repPaint(R); scoreLoad(R, my); } else costPaint(R);
  }
  function repPaint(R) {
    var el = box.querySelector('#tqBody'); if (!el) return;
    var cnt = { g: 0, w: 0, f: 0, o: 0 }; R.order.forEach(function (k) { cnt[verdict(R.by[k].latest).k]++; });
    if (!R.order.length) { el.innerHTML = '<div class="card empty">স্টুডিও থেকে দেওয়া কোনো টেস্ট অর্ডার এখনো নেই। "কিউ" ট্যাবে শুরু করুন।</div>'; return; }
    el.innerHTML = '<p class="tqm">' + bn(R.order.length) + 'টি সার্ভিসের সর্বশেষ টেস্ট: <span class="ok">✔ ' + bn(cnt.g) + '</span> · <span class="wa">⚠ ' + bn(cnt.w) + '</span> · <span class="er">✖ ' + bn(cnt.f) + '</span> · ⏳ ' + bn(cnt.o) + '</p>' +
      '<div class="chips" id="tqFl">' + [['all', 'সব'], ['g', '✔ পাস'], ['w', '⚠ আংশিক'], ['f', '✖ ফেইল'], ['o', '⏳ চলছে']].map(function (x) { return '<button type="button" class="chip" data-f="' + x[0] + '" aria-pressed="' + ((S.fl || 'all') === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div><div id="tqRl"></div>' +
      '<p class="sub">পাস = অর্ডার সম্পন্ন + পুরো ডেলিভারি। ড্রপ আলাদা: স্পিড পাতায় কিছুদিন পর সংখ্যা গুনে দিলে এখানে আসে। স্কোর = দাম ৩৫% + স্পিড ৩৫% + ড্রপ/ব্যর্থ ২০% + রিফিল ১০%।</p>';
    el.querySelector('#tqFl').onclick = function (e) { var b = e.target.closest('[data-f]'); if (!b) return; S.fl = b.dataset.f; repPaint(R); };
    repList(R);
  }
  function repList(R) {
    var el = box.querySelector('#tqRl'); if (!el) return; var fl = S.fl || 'all';
    var ks = R.order.filter(function (k) { return fl === 'all' || verdict(R.by[k].latest).k === fl; });
    if (!ks.length) { el.innerHTML = '<div class="card empty">এই ফিল্টারে কিছু নেই।</div>'; return; }
    el.innerHTML = ks.map(function (k, i) {
      var r = R.by[k].latest, v = verdict(r), m = MT[k] || {}, tt = R.tested[k], dr = tt && tt.tests && tt.tests[0] && tt.tests[0].dr, sc = R.scores[k];
      var start = r.start_secs > 0 ? C.mnT(r.start_secs) : (r.started_at > 0 ? '—' : (r.waiting_secs > 0 ? 'এখনো না (' + C.mnT(r.waiting_secs) + ' ধরে)' : '—'));
      var end = r.completed_at > 0 ? C.dT(r.completed_at) + (r.total_secs > 0 ? ' · মোট ' + C.mnT(r.total_secs) : '') : '—';
      var drop = dr ? bn(dr.pct) + '% (' + bn(dr.days) + ' দিন পর)' : (v.k === 'g' || v.k === 'w' ? 'যাচাই বাকি' : '—');
      var rf = m.refill === 1 ? '♻ আছে' : m.refill === 0 ? 'নেই' : 'অজানা';
      return '<div class="card tqrp v-' + v.k + '"><div class="bsh"><span class="tag tv">' + v.t + '</span>' + (sc ? '<span class="tag">স্কোর ' + bn(sc.score) + '</span>' : '') + (R.by[k].n > 1 ? '<span class="tag">' + bn(R.by[k].n) + 'বার টেস্ট</span>' : '') + '</div>' +
        '<b class="bnm">' + esc(r.name || ('#' + r.service_id)) + '</b><div class="sub">' + esc(r.provider) + ' · আইডি ' + esc(r.service_id) + ' · ' + esc(v.why) + '</div>' +
        '<dl class="tqd"><div><dt>শুরু হতে</dt><dd>' + start + '</dd></div><div><dt>শেষ</dt><dd>' + end + '</dd></div><div><dt>ডেলিভারি</dt><dd>' + (r.delivered != null ? bn(r.delivered) + '/' + bn(r.quantity) : '—') + '</dd></div><div><dt>ড্রপ</dt><dd>' + drop + '</dd></div><div><dt>রিফিল</dt><dd>' + rf + '</dd></div><div><dt>খরচ</dt><dd>' + (r.cost_bdt != null ? money(r.cost_bdt) : '—') + '</dd></div></dl>' +
        '<div class="acts"><a class="sm" href="#spd">ল্যাব পাতা</a>' + (v.k === 'g' && sc && sc.row && sc.row.state !== 'on' ? '<button type="button" class="sm" data-add="' + esc(k) + '">সাইটে চালু করুন</button>' : '') + '</div></div>';
    }).join('');
    el.onclick = function (e) { var b = e.target.closest('[data-add]'); if (!b) return; var s = R.scores[b.dataset.add]; if (s && s.row && C.addList) C.addList([s.row]); };
  }
  async function scoreLoad(R, my) {
    var gs = {}; R.order.forEach(function (k) { var m = MT[k]; if (m && m.label && !R.scores[k]) gs[m.label + '|' + m.type] = [m.label, m.type]; });
    var keys = Object.keys(gs).slice(0, 4); if (!keys.length) return;
    for (var i = 0; i < keys.length; i++) {
      if (my !== tok || S.tab !== 'r') return;
      try {
        var d = await C.api('svc_best', { label: gs[keys[i]][0], type: gs[keys[i]][1], limit: 30 });
        (d.rows || []).forEach(function (r) { var k = r.provider + '|' + r.service_id; if (R.by[k]) R.scores[k] = { score: r.score, row: r }; });
      } catch (e) { if (C.authFail(e)) return; }
    }
    if (my === tok && S.tab === 'r' && box.querySelector('#tqRl')) repList(R);
  }
  function costPaint(R) {
    var el = box.querySelector('#tqBody'); if (!el) return;
    var dayOf = function (ms) { return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }); }, today = dayOf(Date.now());
    var tot = 0, td = 0, pr = {}, dd = {}, n = 0;
    R.rows.forEach(function (r) {
      var c = +r.cost_bdt || 0; if (r.cost_bdt == null) return; n++; tot += c;
      var d = r.ordered_at ? dayOf(r.ordered_at) : ''; if (d === today) td += c; if (d) dd[d] = (dd[d] || 0) + c;
      var p = pr[r.provider] || (pr[r.provider] = { n: 0, c: 0, g: 0, f: 0, w: 0 }); p.n++; p.c += c; var vk = verdict(r).k; if (vk === 'g' || vk === 'w' || vk === 'f') p[vk]++;
    });
    if (!n) { el.innerHTML = '<div class="card empty">খরচের হিসাব করার মতো টেস্ট অর্ডার এখনো নেই।</div>'; return; }
    var days = Object.keys(dd).sort().slice(-7), mx = Math.max.apply(null, days.map(function (d) { return dd[d]; }).concat([1]));
    el.innerHTML = '<div class="card tqc"><div class="tqg"><div><span class="sub">মোট টেস্ট খরচ</span><div class="tqbig">' + money(tot) + '</div></div><div><span class="sub">আজকের খরচ</span><div class="tqbig">' + money(td) + '</div></div></div>' +
      '<p class="sub">' + bn(n) + 'টি অর্ডার · গড় ' + money(tot / n) + ' · আজ সার্ভারের দৈনিক সীমা ৳১০০০ (ডিফল্ট) থেকে ≈ ' + money(Math.max(0, 1000 - td)) + ' বাকি' + (R.total > R.rows.length + 0 && R.total > 300 ? ' · শুধু শেষ ৩০০টি অর্ডার ধরা হয়েছে' : '') + '</p></div>' +
      '<div class="card tqc"><h3>প্রভাইডার অনুযায়ী</h3>' + Object.keys(pr).sort(function (a, b) { return pr[b].c - pr[a].c; }).map(function (p) { var x = pr[p]; return '<div class="tqpr"><b>' + esc(p) + '</b><span>' + money(x.c) + '</span><span class="sub">' + bn(x.n) + 'টি অর্ডার · পাস ' + bn(x.g) + ' · আংশিক ' + bn(x.w) + ' · ফেইল ' + bn(x.f) + (x.c > 0 && x.g ? ' · প্রতি পাসে ≈ ' + money(x.c / x.g) : '') + '</span></div>'; }).join('') + '</div>' +
      '<div class="card tqc"><h3>শেষ ৭ দিন</h3>' + days.map(function (d) { return '<div class="tqbar"><span class="sub">' + d.slice(5) + '</span><i style="width:' + Math.max(3, Math.round(dd[d] / mx * 100)) + '%"></i><b>' + money(dd[d]) + '</b></div>'; }).join('') + '</div>';
  }
  /* প্রভাইডার পাতা থেকে বাছা সার্ভিস কিউ-পাতায় পাঠানো */
  function stage(list) {
    var n = 0;
    (list || []).forEach(function (r) {
      if (!r || !r.provider || r.service_id == null || !(+r.rate > 0)) return;
      var k = r.provider + '|' + r.service_id;
      if (SG.some(function (z) { return z.provider + '|' + z.service_id === k; })) return;
      SG.push({ provider: String(r.provider), service_id: String(r.service_id), name: String(r.name || ''), rate: +r.rate, min: +r.min || 0, max: +r.max || 0, refill: +r.refill ? 1 : 0, _fx: +r._fx || 0, _stage: 1 }); n++;
    });
    saveG(); return n;
  }
  window.StudioTQ = { stage: stage, mount: mount, _t: { linkCheck: linkCheck, kindOf: kindOf, verdict: verdict } };
})();
