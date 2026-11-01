/* app-picker.js — ড্রপডাউন অর্ডার ফর্ম (ধাপ ১১)
   Category ▾ / Service ▾ — সব SMM প্যানেলের মতো নেটিভ ড্রপডাউন (মোবাইলে সিস্টেমের পিকার খোলে)।
   আগের চিপ+কার্ড UI (ধাপ ৩) বদলে এটা এসেছে; পুরনো কার্ড ব্যাকআপ: backups/step11/app-picker.js।
   app-catalog.js এর স্টেট (selectedCategoryValue / selectedServiceCode) ও ফাংশন অপরিবর্তিত — শুধু UI লেয়ার।
   পুরনো কাস্টম-ড্রপডাউন HTML থেকে যায় (লুকানো), তাই কিছু ভাঙে না।
   ধাপ ১৫: নেটিভ পপআপের ফন্ট/ফাঁক বদলানো যায় না, তাই দেখানো হয় নিজস্ব বটম-শিট তালিকা (সাজানো লেখা)।
   <select> দুটো লুকানো অবস্থায় থেকে যায় — আসল স্টেট ও change হ্যান্ডলার আগের মতোই; ফিরে যেতে backups/step15/ দেখুন। */
(function () {
  "use strict";
  var root = null;

  function esc(v) { return (typeof escapeHtml === "function") ? escapeHtml(String(v == null ? "" : v)) : String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function $(id) { return document.getElementById(id); }

  function mount() {
    var host = $("dropdownPicker");
    if (!host || $("pkRoot")) return !!$("pkRoot");
    root = document.createElement("div");
    root.id = "pkRoot"; root.className = "pk";
    root.innerHTML =
      '<div class="dd-label pk-lbl" id="pkCatLbl">Category</div>' +
      '<div class="pk-sel"><button type="button" class="pk-trig" id="pkCatBtn" aria-haspopup="dialog" aria-labelledby="pkCatLbl pkCatTxt"><span class="pk-trig-txt" id="pkCatTxt"></span></button>' +
      '<select id="pkCat" class="pk-select pk-native" aria-hidden="true" tabindex="-1"></select></div>' +
      '<div class="dd-label pk-lbl" id="pkSvcLbl">Service <span class="pk-count" id="pkCount"></span></div>' +
      '<div class="pk-sel"><button type="button" class="pk-trig" id="pkSvcBtn" aria-haspopup="dialog" aria-labelledby="pkSvcLbl pkSvcTxt"><span class="pk-trig-txt" id="pkSvcTxt"></span></button>' +
      '<select id="pkSvc" class="pk-select pk-native" aria-hidden="true" tabindex="-1"></select></div>' +
      '<div class="pk-facts" id="pkFacts"></div>';
    host.insertBefore(root, host.firstChild);
    host.classList.add("pk-on");

    $("pkCat").addEventListener("change", function (e) {
      selectedCategoryValue = e.target.value;
      refreshOriginal(); render();
    });
    $("pkSvc").addEventListener("change", function (e) {
      selectedServiceCode = e.target.value;
      refreshOriginal(); render();
      try { document.dispatchEvent(new CustomEvent("pb:service-picked")); } catch (_) {}
    });
    $("pkCatBtn").addEventListener("click", function () { openSheet("cat"); });
    $("pkSvcBtn").addEventListener("click", function () { openSheet("svc"); });
    return true;
  }

  // ---------- বটম-শিট তালিকা (ধাপ ১৫) ----------
  var catItems = [], svcItems = [], sheetKind = "";

  function splitTitle(name) {            // "Followers · Premium (Non Drop / HQ)" -> ["Followers", "Premium (Non Drop / HQ)"]
    var i = String(name).indexOf(" · ");
    return i > 0 ? [name.slice(0, i), name.slice(i + 3)] : [name, ""];
  }
  function splitTags(name) {             // "Post Reaction · Angry [No Refill]" -> { name, tags:["No Refill"] }
    var tags = [], n = String(name).replace(/\s*\[([^\]]+)\]\s*/g, function (_, t) { tags.push(t.trim()); return " "; }).replace(/\s{2,}/g, " ").trim();
    return { name: n, tags: tags };
  }

  /* ধাপ ১৯: নাম সর্বোচ্চ ৪০ অক্ষর (ইমোজি না ভেঙে); পুরো নাম title/বিবরণে */
  var NAME_MAX = 40;
  function trn(p, s) { return p && p.sname ? String(s || "") : trunc(s, NAME_MAX); }   // স্টুডিওর নাম (sname) ছাঁটা হয় না
  function trunc(s, n) { var a = Array.from(String(s || "")); return a.length <= n ? a.join("") : a.slice(0, n - 1).join("").replace(/[\s·,\-–|]+$/, "") + "…"; }

  /* ফেভারিট সার্ভিস (শুধু এই ডিভাইসে, localStorage; না চললে চুপচাপ বাদ) */
  var FAV_KEY = "pb_fav_svc";
  function favGet() { try { var a = JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); return Array.isArray(a) ? a.map(String) : []; } catch (e) { return []; } }
  function favSet(a) { try { localStorage.setItem(FAV_KEY, JSON.stringify(a.slice(0, 100))); } catch (e) {} }
  function favToggle(code) { var a = favGet(), i = a.indexOf(String(code)); if (i >= 0) a.splice(i, 1); else a.unshift(String(code)); favSet(a); return i < 0; }

  function ensureSheet() {
    if ($("pkSheet")) return $("pkSheet");
    var el = document.createElement("div");
    el.id = "pkSheet"; el.className = "pk-sheet"; el.hidden = true;
    el.innerHTML =
      '<div class="pk-sheet-bd" data-pkclose="1"></div>' +
      '<div class="pk-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="pkSheetTitle">' +
        '<div class="pk-sheet-grip" aria-hidden="true"></div>' +
        '<div class="pk-sheet-head"><div class="pk-sheet-title" id="pkSheetTitle"></div><button type="button" class="pk-sheet-x" data-pkclose="1" aria-label="বন্ধ করুন">&times;</button></div>' +
        '<div class="pk-sheet-search"><input type="search" id="pkSheetQ" class="pk-sheet-q" placeholder="খুঁজুন…" autocomplete="off" enterkeyhint="search" aria-label="তালিকায় খুঁজুন"></div>' +
         '<div class="pk-sheet-list" id="pkSheetList" role="listbox"></div>' +
      '</div>';
    document.body.appendChild(el);
    el.addEventListener("click", function (e) {
      if (e.target.closest("[data-pkclose]")) { closeSheet(); return; }
      var star = e.target.closest(".pk-fav");
      if (star) { e.stopPropagation(); var on = favToggle(star.getAttribute("data-fav")); star.setAttribute("aria-pressed", on ? "true" : "false"); star.textContent = on ? "★" : "☆"; star.setAttribute("aria-label", on ? "ফেভারিট থেকে সরান" : "ফেভারিটে রাখুন"); if (!$("pkSheetQ").value) paintList(true); return; }
      var b = e.target.closest(".pk-opt"); if (!b) return;
      var sel = $(sheetKind === "cat" ? "pkCat" : "pkSvc");
      var v = b.getAttribute("data-v");
      closeSheet();
      if (sel && !Array.prototype.some.call(sel.options, function (o) { return o.value === v; })) {   // ধাপ ২০: নেটিভ select-এ শুধু বাছাই করা অপশন থাকে
        var o = document.createElement("option"); o.value = v; o.textContent = v; sel.appendChild(o);
      }
      if (sel && sel.value !== v) { sel.value = v; sel.dispatchEvent(new Event("change", { bubbles: true })); }
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !el.hidden) closeSheet(); });
    var lst = el.querySelector("#pkSheetList");
    lst.addEventListener("scroll", function () { if (shown < listAll.length && lst.scrollTop + lst.clientHeight > lst.scrollHeight - 160) moreItems($(sheetKind === "cat" ? "pkCat" : "pkSvc").value); });
    lst.addEventListener("click", function (e) { if (e.target.closest("[data-more]")) { e.stopPropagation(); moreItems($(sheetKind === "cat" ? "pkCat" : "pkSvc").value); } });
    var qt = null; el.querySelector("#pkSheetQ").addEventListener("input", function () { clearTimeout(qt); qt = setTimeout(function () { paintList(false); }, 120); });
    return el;
  }

  function optHTML(kind, it, cur) {
    var on = String(it.v) === String(cur);
    var inner;
    if (kind === "cat") {
      var t = splitTitle(it.name);
      inner = '<span class="pk-opt-em" aria-hidden="true">' + esc(it.em || "•") + '</span>' +
        '<span class="pk-opt-main"><span class="pk-opt-t">' + esc(t[0]) + '</span>' + (t[1] ? '<span class="pk-opt-s">' + esc(t[1]) + '</span>' : '') + '</span>' +
        '<span class="pk-opt-cnt">' + esc(it.n) + '</span>';
    } else {
      var fv = favGet().indexOf(String(it.v)) >= 0;
      inner = '<span class="pk-opt-top"><span class="pk-code">' + esc(it.v) + '</span><span class="pk-opt-price">' + esc(it.price) + '</span></span>' +
        '<span class="pk-opt-sname" title="' + esc(it.full) + '">' + esc(it.name) + '</span>' +
        (it.tags.length ? '<span class="pk-opt-tags">' + it.tags.map(function (g) {
          var yes = /refill|guarantee/i.test(g) && !/\b(no|non|none)\b/i.test(g);
          return '<span class="pk-tag' + (yes ? " pk-tag-yes" : "") + '">' + esc(g) + '</span>';
        }).join("") + '</span>' : '');
    }
    var btn = '<button type="button" role="option" class="pk-opt pk-opt-' + kind + (on ? " on" : "") + '" aria-selected="' + (on ? "true" : "false") + '" data-v="' + esc(it.v) + '"' + (kind === "svc" ? ' title="' + esc(it.full) + '"' : '') + '>' + inner + '</button>';
    if (kind !== "svc") return btn;
    var f = favGet().indexOf(String(it.v)) >= 0;
    return '<div class="pk-row">' + btn + '<button type="button" class="pk-fav" data-fav="' + esc(it.v) + '" aria-pressed="' + (f ? "true" : "false") + '" aria-label="' + (f ? "ফেভারিট থেকে সরান" : "ফেভারিটে রাখুন") + '">' + (f ? "★" : "☆") + '</button></div>';
  }

  /* ধাপ ২০: তালিকা খোলার সময়ই আঁকা হয়, ৩০টা করে (স্ক্রলে আরও) — শুরুতে DOM-এ সার্ভিসের সারি থাকে না */
  var CHUNK = 30, shown = 0, listAll = [];
  function norm(s) { return String(s || "").toLowerCase(); }
  function filtered() {
    var q = norm($("pkSheetQ") && $("pkSheetQ").value).trim(), items = sheetKind === "cat" ? catItems : svcItems;
    if (q) return items.filter(function (it) { return norm(it.v + " " + it.full + " " + (it.tags || []).join(" ")).indexOf(q) >= 0; });
    if (sheetKind === "svc") {                         // ফেভারিট আগে
      var fav = favGet();
      if (fav.length) return items.filter(function (it) { return fav.indexOf(it.v) >= 0; }).concat(items.filter(function (it) { return fav.indexOf(it.v) < 0; }));
    }
    return items;
  }
  function paintList(keep) {
    var list = $("pkSheetList"), sel = $(sheetKind === "cat" ? "pkCat" : "pkSvc"), top = keep ? list.scrollTop : 0;
    listAll = filtered(); shown = 0; list.innerHTML = "";
    if (!listAll.length) { list.innerHTML = '<div class="pk-empty">কিছু পাওয়া যায়নি</div>'; return; }
    moreItems(sel.value, Math.max(CHUNK, keep ? Math.ceil((top + list.clientHeight) / 56) + 5 : 0));
    if (keep) list.scrollTop = top;
  }
  function moreItems(cur, n) {
    var list = $("pkSheetList"), end = Math.min(listAll.length, shown + (n || CHUNK));
    var html = listAll.slice(shown, end).map(function (it) { return optHTML(sheetKind, it, cur); }).join("");
    var old = list.querySelector(".pk-more"); if (old) old.remove();
    list.insertAdjacentHTML("beforeend", html); shown = end;
    if (shown < listAll.length) list.insertAdjacentHTML("beforeend", '<button type="button" class="pk-more" data-more="1">আরও দেখান (' + (listAll.length - shown) + ')</button>');
  }

  function openSheet(kind) {
    var sel = $(kind === "cat" ? "pkCat" : "pkSvc");
    var items = kind === "cat" ? catItems : svcItems;
    if (!sel || sel.disabled || !items.length) return;
    sheetKind = kind;
    var el = ensureSheet();
    $("pkSheetTitle").textContent = kind === "cat" ? "ক্যাটাগরি বেছে নিন" : "সার্ভিস বেছে নিন";
    $("pkSheetQ").value = "";
    var cur = sel.value;
    paintList(false);
    var idx = listAll.findIndex(function (it) { return String(it.v) === String(cur); });
    if (idx >= shown) moreItems(cur, idx - shown + 5);   // নির্বাচিত আইটেম দেখাতে প্রয়োজনমতো আরও আঁকা
    el.hidden = false;
    document.documentElement.classList.add("pk-lock");
    requestAnimationFrame(function () {
      el.classList.add("open");
      var on = el.querySelector(".pk-opt.on");
      if (on) { try { on.scrollIntoView({ block: "center" }); } catch (_) {} }
    });
  }
  function closeSheet() {
    var el = $("pkSheet"); if (!el) return;
    el.classList.remove("open");
    document.documentElement.classList.remove("pk-lock");
    setTimeout(function () { if (!el.classList.contains("open")) el.hidden = true; }, 200);
  }

  // বাটনের লেখা: নির্বাচিত আইটেম (বা প্লেসহোল্ডার)
  function syncTriggers() {
    var cs = $("pkCat"), ss = $("pkSvc"), ct = $("pkCatTxt"), st = $("pkSvcTxt");
    if (!cs || !ss || !ct || !st) return;
    var ci = catItems.filter(function (x) { return String(x.v) === String(cs.value); })[0];
    if (cs.disabled || !ci) ct.textContent = cs.options[cs.selectedIndex] ? cs.options[cs.selectedIndex].text : "";
    else ct.textContent = (ci.em ? ci.em + " " : "") + ci.name + " (" + ci.n + ")";
    var si = svcItems.filter(function (x) { return String(x.v) === String(ss.value); })[0];
    if (ss.disabled || !si) st.textContent = ss.options[ss.selectedIndex] ? ss.options[ss.selectedIndex].text : "";
    else { st.textContent = si.v + " · " + si.name; st.title = si.full; }
    $("pkCatBtn").disabled = cs.disabled; $("pkSvcBtn").disabled = ss.disabled;
  }

  // app-catalog.js এর ভেতরের স্টেট/সামারি ঠিক রাখা (দাম, মিন-ম্যাক্স, চার্জ ইত্যাদি এর ওপর নির্ভর করে)
  function refreshOriginal() {
    try { populateCategoryDropdown(); populateServiceDropdown(); renderSelectedServiceCard(); } catch (e) { console.error("picker sync:", e); }
  }

  function poolFor(cat) {
    var isTop = cat === PB_TOP_CAT;
    var pool = popularPoolForPlatform().filter(function (p) { return isTop ? pbIsTop(p) : (p.category || "Other") === cat; });
    if (isTop) { var rk = pbTopRank(); pool.sort(function (a, b) { return rk.get(String(a.code)) - rk.get(String(b.code)); }); }
    else pool.sort(function (a, b) { return packageSellPrice(a) - packageSellPrice(b); });
    return pool;
  }

  function pills(p) {
    var out = "";
    try {
      pbServiceFacts(p).forEach(function (r) {
        if (r.k === "quality" || r.k === "speed") return;   // ধাপ ১৬: গতি (50K/Day) পিল সরানো — "অর্ডারের আগে জানুন" বক্সে আছে
        var yes = r.k === "refill" && !/\b(no|non|none)\b|✗|❌/i.test(String(r.val));
        out += '<span class="pk-pill pk-' + esc(r.k) + (yes ? " pk-yes" : "") + '">' + esc(r.val) + '</span>';
      });
    } catch (e) {}
    try {
      pbExtraBadges(p).forEach(function (b) {
        out += '<span class="pk-pill pk-' + esc(b.k) + (b.good ? " pk-yes" : "") + '">' + esc(b.val) + '</span>';
      });
    } catch (e) {}
    return out;
  }

  function money(n) { n = Number(n); return isFinite(n) ? n.toFixed(n < 10 ? 4 : 2).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") : "—"; }

  // "Average time" — শুধু আসল ডেলিভারি রেকর্ড থাকলে দেখায় (ভুয়া সময় কখনো নয়)
  function syncAvg(p) {
    var box = $("pkAvgWrap"), val = $("pkAvg");
    if (!box || !val) return;
    var label = p && p.delivery && p.delivery.label ? String(p.delivery.label) : "";
    box.hidden = !label; val.textContent = label;
  }

  function render() {
    if (!mount()) return;
    var cats = [];
    try { cats = populateCategoryDropdown(); } catch (e) { return; }
    var base = popularPoolForPlatform();
    var counts = {}; base.forEach(function (p) { var c = p.category || "Other"; counts[c] = (counts[c] || 0) + 1; });
    var topN = base.filter(pbIsTop).length;
    var loading = (typeof catalogLoadState !== "undefined" && catalogLoadState === "loading");

    // ---- Category ----
    var cs = $("pkCat");
    if (loading) cs.innerHTML = '<option value="">লোড হচ্ছে…</option>';
    else if (!cats.length) cs.innerHTML = '<option value="">কোনো ক্যাটাগরি নেই</option>';
    else cs.innerHTML = cats.filter(function (c) { return c === selectedCategoryValue; }).map(function (c) {   // ধাপ ২০: শুধু নির্বাচিতটা DOM-এ
      var pl = ""; try { pl = pbCatPlatform(c); } catch (e) {}
      var em = ""; try { em = pbCatEmoji(c, pl); } catch (e) {}
      var n = c === PB_TOP_CAT ? topN : (counts[c] || 0);
      return '<option value="' + esc(c) + '" selected>' + (em ? esc(em) + " " : "") + esc(c) + ' (' + n + ')</option>';
    }).join("");
    cs.disabled = loading || !cats.length;
    catItems = (loading || !cats.length) ? [] : cats.map(function (c) {
      var pl = ""; try { pl = pbCatPlatform(c); } catch (e) {}
      var em = ""; try { em = pbCatEmoji(c, pl); } catch (e) {}
      return { v: c, name: c, em: em, n: c === PB_TOP_CAT ? topN : (counts[c] || 0) };
    });

    // ---- Service ----
    var pool = loading ? [] : poolFor(selectedCategoryValue);
    var ss = $("pkSvc");
    $("pkCount").textContent = pool.length ? "(" + pool.length + ")" : "";
    if (!pool.length) {
      ss.innerHTML = '<option value="">' + (loading ? "সার্ভিস লোড হচ্ছে…" : "এই ক্যাটাগরিতে কোনো সার্ভিস নেই") + '</option>';
      ss.disabled = true; $("pkFacts").innerHTML = ""; syncAvg(null);
      svcItems = []; syncTriggers();
      return;
    }
    ss.disabled = false;
    ss.innerHTML = pool.filter(function (p) { return String(p.code) === String(selectedServiceCode); }).map(function (p) {   // ধাপ ২০: শুধু নির্বাচিতটা DOM-এ
      var price = ""; try { price = " - ৳" + money(packageSellPrice(p)) + " per 1K"; } catch (e) {}
      return '<option value="' + esc(p.code) + '" selected>' + esc(p.code) + ' - ' + esc(trn(p, pbDropdownName(p))) + price + '</option>';
    }).join("");

    svcItems = pool.map(function (p) {
      var price = ""; try { price = (typeof pbFmtPrice === "function" ? pbFmtPrice(packageSellPrice(p)) : "৳" + money(packageSellPrice(p))) + " / 1K"; } catch (e) {}
      var nm = ""; try { nm = pbDropdownName(p); } catch (e) { nm = String(p.name || ""); }
      var t = splitTags(nm), tg = [];
      t.tags.forEach(function (x) { String(x).split(/\s*·\s*/).forEach(function (y) { y = y.trim(); if (y && !tg.some(function (z) { return z.toLowerCase() === y.toLowerCase(); })) tg.push(y); }); });
      try { (Array.isArray(p.tags) ? p.tags : []).forEach(function (x) { x = String(x || "").trim(); if (x && !tg.some(function (y) { return y.toLowerCase() === x.toLowerCase(); })) tg.push(x); }); } catch (e) {}
      var more = tg.length > 3 ? tg.length - 3 : 0; tg = tg.slice(0, 3); if (more) tg.push("+" + more);
      return { v: String(p.code), name: trn(p, t.name), full: (function () { try { return decodeEntities(String(p.name || "")).normalize("NFKC").replace(/\s{2,}/g, " ").trim(); } catch (e) { return String(p.name || ""); } })() || t.name, tags: tg, price: price };
    });
    syncTriggers();

    // ---- নির্বাচিত সার্ভিসের ছোট তথ্য (পিল + ডেলিভারি রেকর্ড) ----
    var cur = pool.find(function (p) { return String(p.code) === String(selectedServiceCode); }) || null;
    var curItem = cur ? svcItems.filter(function (x) { return x.v === String(cur.code); })[0] : null;
    $("pkFacts").innerHTML = cur ? (curItem && curItem.full && curItem.full !== curItem.name ? '<div class="pk-full"><span class="pk-full-l">পুরো নাম</span> ' + esc(curItem.full) + '</div>' : '') + '<div class="pk-pills">' + pills(cur) + '</div>' + (function () { try { return deliveryBadgeHTML(cur) || ""; } catch (e) { return ""; } })() : "";
    syncAvg(cur);
  }

  // renderDropdownPicker (app-catalog.js) চললেই ফর্ম UI আপডেট — সার্চ থেকে সার্ভিস বাছলেও কাজ করে
  var tries = 0;
  (function hook() {
    if (typeof renderDropdownPicker !== "function" || typeof popularPoolForPlatform !== "function") { if (tries++ < 50) return setTimeout(hook, 100); return; }
    var orig = renderDropdownPicker;
    renderDropdownPicker = function () { orig.apply(this, arguments); try { render(); } catch (e) { console.error("picker render:", e); } };
    try { render(); } catch (e) {}
  })();
})();
