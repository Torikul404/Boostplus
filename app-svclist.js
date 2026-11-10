/* ==========================================================
   app-svclist.js — সার্ভিস লিস্ট পাতা (নিচের বারের "সার্ভিস" ট্যাব / সাইডবারের "Services") · কার্ড-ডিজাইন
   • সাইটের সব সার্ভিস, ক্যাটাগরি ধরে ভাগ — নাম ও ক্যাটাগরি boostplus-এর নিজস্ব
     (প্রোভাইডারের আসল নাম নয়: pbDropdownName + সার্ভিসের নিজের ক্যাটাগরি; প্রোভাইডারের কোনো তথ্য এই পাতায় আসেই না)
   • ফিল্টার: Category মেনু · Advanced Filters (দাম-সীমা, প্ল্যাটফর্ম, পছন্দের) · সার্চ
   • কার্ড: প্ল্যাটফর্ম আইকন · ♡ পছন্দ (ফোনে সেভ) · ID (ট্যাপে কপি) · দাম · Min/Max · গড় সময় · Statistics / Details / Buy Now
   • ডেটা: app-catalog.js-এর allPackages (স্টুডিও/অ্যাডমিন থেকে যোগ-বন্ধ service_meta-সহ) — নতুন কোনো রিকোয়েস্ট নেই
   • হালকা: একসাথে ২৪টি কার্ড আঁকে (নিচে নামলে নিজে আরও), আইকন = একটি SVG স্প্রাইট (বারের SVG থেকে), ছবি নেই, ইভেন্ট ডেলিগেশন
   • Average time/Statistics শুধু আসল ডেলিভারি রেকর্ড থাকলে (ভুয়া সময় কখনো নয়)
   ========================================================== */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var view = $("svclist-view");
  if (!view) return;

  var PAGE = 24;                         // একবারে কত কার্ড আঁকা হবে (DOM হালকা রাখতে)
  var FAVK = "pb_fav_svc";
  var state = { plats: {}, cat: "", q: "", min: null, max: null, favOnly: false, shown: PAGE, open: {} };
  var waitTimer = null, built = false, favs = {}, labels = {}, iconSet = {}, io = null;

  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pkgs() { try { return (typeof allPackages !== "undefined" && Array.isArray(allPackages)) ? allPackages : []; } catch (e) { return []; } }
  function loadState() { try { return typeof catalogLoadState !== "undefined" ? catalogLoadState : "full"; } catch (e) { return "full"; } }
  function nameOf(p) { try { return pbDropdownName(p); } catch (e) { return String(p.name || p.code); } }
  function priceOf(p) { try { return getFinalPrice(p); } catch (e) { return NaN; } }
  function baseOf(p) { try { return getBaseSellingPrice(p); } catch (e) { return NaN; } }
  function fmt(n) { try { return window.pbFmtPrice ? window.pbFmtPrice(n) : "৳" + Number(n).toFixed(2); } catch (e) { return "—"; } }
  function num(n) { n = Number(n); return isFinite(n) && n > 0 ? n.toLocaleString("en-US") : "—"; }
  function catOrder(names) { try { return sortCategories(names); } catch (e) { return names.slice().sort(); } }
  function platLabel(k) { return labels[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1) : "Other"); }

  /* ---------- পছন্দের (♡) — শুধু এই ফোনে, ছোট ---------- */
  function loadFavs() { try { var a = JSON.parse(localStorage.getItem(FAVK) || "[]"); favs = {}; (Array.isArray(a) ? a : []).forEach(function (c) { favs[String(c)] = 1; }); } catch (e) { favs = {}; } }
  function saveFavs() { try { localStorage.setItem(FAVK, JSON.stringify(Object.keys(favs).slice(-200))); } catch (e) {} }

  /* ---------- আইকন স্প্রাইট: নতুন-অর্ডার পাতার প্ল্যাটফর্ম-বারের SVG একবার কপি (প্রতি কার্ডে আলাদা SVG নয়) ---------- */
  function buildSprite() {
    var src = document.querySelector("#services-view .platform-bar");
    var sp = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    sp.setAttribute("width", "0"); sp.setAttribute("height", "0"); sp.setAttribute("aria-hidden", "true"); sp.style.position = "absolute";
    var inner = "";
    if (src) {
      var defs = src.querySelector("svg[width='0']");
      if (defs) inner += defs.innerHTML.replace(/pfIgGrad/g, "pfIgGradSl");
      Array.prototype.forEach.call(src.querySelectorAll(".platform-btn"), function (b) {
        var k = b.getAttribute("data-platform"), s = b.querySelector("svg");
        if (!k || k === "all" || !s) return;
        labels[k] = b.getAttribute("aria-label") || b.getAttribute("title") || k;
        iconSet[k] = 1;
        inner += '<symbol id="slpf-' + esc(k) + '" viewBox="' + esc(s.getAttribute("viewBox") || "0 0 24 24") + '">' + s.innerHTML.replace(/pfIgGrad/g, "pfIgGradSl") + "</symbol>";
      });
    }
    sp.innerHTML = inner;
    view.insertBefore(sp, view.firstChild);
  }
  function icon(k) {
    return iconSet[k] ? '<svg class="sl-pf" aria-hidden="true" focusable="false"><use href="#slpf-' + esc(k) + '"/></svg>'
      : '<span class="sl-pfx" aria-hidden="true">' + esc(platLabel(k).charAt(0)) + "</span>";
  }

  /* ---------- ফিল্টার ---------- */
  function platsOn() { return Object.keys(state.plats).filter(function (k) { return state.plats[k]; }); }
  function filtered(opts) {
    opts = opts || {};
    var q = state.q.trim().toLowerCase(), words = q ? q.split(/\s+/) : null, po = platsOn();
    var hasMin = state.min != null && isFinite(state.min), hasMax = state.max != null && isFinite(state.max);
    return pkgs().filter(function (p) {
      if (po.length && !state.plats[p.platform]) return false;
      if (!opts.ignoreCat && state.cat && (p.category || "Other") !== state.cat) return false;
      if (state.favOnly && !favs[String(p.code)]) return false;
      if (hasMin || hasMax) { var pr = priceOf(p); if (!isFinite(pr)) return false; if (hasMin && pr < state.min) return false; if (hasMax && pr > state.max) return false; }
      if (words) {
        var hay = (String(p.code) + " " + nameOf(p) + " " + (p.category || "") + " " + (p.platform || "")).toLowerCase();
        return words.every(function (w) { return hay.indexOf(w) !== -1; });
      }
      return true;
    });
  }

  /* ---------- কাঠামো (একবার) ---------- */
  function build() {
    if (built) return; built = true;
    loadFavs(); buildSprite();
    $("slCatBtn").addEventListener("click", function (e) { e.stopPropagation(); toggleMenu(); });
    $("slCatMenu").addEventListener("click", function (e) {
      var it = e.target.closest("[data-sl-cat]"); if (!it) return;
      state.cat = it.getAttribute("data-sl-cat"); state.shown = PAGE; closeMenu(); render();
    });
    document.addEventListener("click", function (e) { if (!e.target.closest || !e.target.closest(".sl-catwrap")) closeMenu(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeMenu(); closeModal(); } });
    $("slAdvBtn").addEventListener("click", openModal);
    $("slModalX").addEventListener("click", closeModal);
    $("slModal").addEventListener("click", function (e) { if (e.target === this) closeModal(); });
    $("slApply").addEventListener("click", applyModal);
    $("slReset").addEventListener("click", function () { state.plats = {}; state.min = null; state.max = null; state.favOnly = false; state.cat = ""; state.shown = PAGE; closeModal(); render(); });
    $("slPlats").addEventListener("click", function (e) { var b = e.target.closest("[data-sl-plat]"); if (b) b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true"); });
    var t = null;
    $("slSearch").addEventListener("input", function () { var v = this.value; clearTimeout(t); t = setTimeout(function () { state.q = v; state.shown = PAGE; render(); }, 160); });
    $("slList").addEventListener("click", onListClick);
  }

  function onListClick(e) {
    var more = e.target.closest("[data-sl-more]");
    if (more) { state.shown += PAGE; render(true); return; }
    var f = e.target.closest("[data-sl-fav]");
    if (f) {
      var c = f.getAttribute("data-sl-fav"), on = !favs[c];
      if (on) favs[c] = 1; else delete favs[c];
      saveFavs(); f.setAttribute("aria-pressed", on ? "true" : "false"); f.textContent = on ? "♥" : "♡"; return;
    }
    var cp = e.target.closest("[data-sl-copy]");
    if (cp) { copyId(cp.getAttribute("data-sl-copy"), cp); return; }
    var v = e.target.closest("[data-sl-view]");
    if (v) { togglePanel(v.getAttribute("data-sl-view"), "view"); return; }
    var s = e.target.closest("[data-sl-stat]");
    if (s) { togglePanel(s.getAttribute("data-sl-stat"), "stat"); return; }
    var b = e.target.closest("[data-sl-buy]");
    if (b) { buy(b.getAttribute("data-sl-buy")); return; }
    var r = e.target.closest("[data-sl-retry]");
    if (r) { try { pbLoadCatalog(); } catch (_) {} wait(); }
  }

  function copyId(code, btn) {
    var done = function () { var s = btn.querySelector("span"); if (s) { var o = s.textContent; s.textContent = "✓"; setTimeout(function () { s.textContent = o; }, 900); } };
    try { navigator.clipboard.writeText(String(code)).then(done, function () {}); } catch (e) { /* কপি না হলে চুপচাপ — ID কার্ডেই দেখা যায় */ }
  }

  /* Details / Statistics — কার্ডের নিচে খোলে */
  function panelHTML(code, kind) {
    var p = pkgs().find(function (x) { return String(x.code) === String(code); });
    if (!p) return "";
    if (kind === "stat") {
      var d = p.delivery;
      return d && d.label ? "⏱ সর্বশেষ <b>" + esc(d.n) + "</b>টি সম্পন্ন অর্ডারের মিডিয়ান সময়: <b>" + esc(String(d.label)) + "</b>" : "এখনো যথেষ্ট ডেলিভারি রেকর্ড নেই।";
    }
    var html = ""; try { html = pbKnowBeforeHTML(p); } catch (e) {}
    return html || "<p>" + esc(nameOf(p)) + "</p>";
  }
  function togglePanel(code, kind) {
    var card = view.querySelector('.sl-card[data-code="' + (window.CSS && CSS.escape ? CSS.escape(code) : code) + '"]');
    if (!card) return;
    var panel = card.querySelector(".sl-panel");
    if (state.open[code] === kind) { delete state.open[code]; panel.hidden = true; return; }
    state.open[code] = kind; panel.innerHTML = panelHTML(code, kind); panel.hidden = false;
  }

  /* ---------- Buy Now: নতুন-অর্ডার পাতায় এই সার্ভিস সিলেক্ট ---------- */
  function buy(code) {
    if (window.PB_nav && PB_nav.go) PB_nav.go("new-order");
    setTimeout(function () { try { pickSearchResult(code); } catch (e) { console.warn("svclist buy:", e); } }, 160);
  }

  /* ---------- Category মেনু ---------- */
  function toggleMenu() { var m = $("slCatMenu"); if (m.hidden) openMenu(); else closeMenu(); }
  function closeMenu() { var m = $("slCatMenu"); if (m && !m.hidden) { m.hidden = true; $("slCatBtn").setAttribute("aria-expanded", "false"); } }
  function openMenu() {
    var counts = {}, first = {}, base = filtered({ ignoreCat: true });
    base.forEach(function (p) { var c = p.category || "Other"; counts[c] = (counts[c] || 0) + 1; if (!first[c]) first[c] = p.platform; });
    var names = catOrder(Object.keys(counts));
    $("slCatMenu").innerHTML = '<button type="button" class="sl-mi" role="option" data-sl-cat="" aria-selected="' + (!state.cat) + '">All <small>' + base.length + "</small></button>" +
      names.map(function (n) {
        return '<button type="button" class="sl-mi" role="option" data-sl-cat="' + esc(n) + '" aria-selected="' + (n === state.cat) + '">' + icon(first[n]) + "<span>" + esc(n) + "</span><small>" + counts[n] + "</small></button>";
      }).join("");
    $("slCatMenu").hidden = false; $("slCatBtn").setAttribute("aria-expanded", "true");
  }

  /* ---------- Advanced Filters মোডাল ---------- */
  function openModal() {
    var cnt = {}; pkgs().forEach(function (p) { if (p.platform) cnt[p.platform] = (cnt[p.platform] || 0) + 1; });
    $("slPlats").innerHTML = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).map(function (k) {
      return '<button type="button" class="sl-plat" data-sl-plat="' + esc(k) + '" aria-pressed="' + (!!state.plats[k]) + '">' + esc(platLabel(k)) + "</button>";
    }).join("");
    $("slMin").value = state.min != null ? state.min : ""; $("slMax").value = state.max != null ? state.max : "";
    $("slFavOnly").checked = state.favOnly;
    closeMenu(); $("slModal").hidden = false; $("slMin").focus();
  }
  function closeModal() { var m = $("slModal"); if (m) m.hidden = true; }
  function applyModal() {
    var pl = {}; Array.prototype.forEach.call($("slPlats").querySelectorAll("[data-sl-plat]"), function (b) { if (b.getAttribute("aria-pressed") === "true") pl[b.getAttribute("data-sl-plat")] = true; });
    var mn = parseFloat($("slMin").value), mx = parseFloat($("slMax").value);
    state.plats = pl; state.min = isFinite(mn) ? mn : null; state.max = isFinite(mx) ? mx : null; state.favOnly = $("slFavOnly").checked;
    // নতুন ফিল্টারে আগের ক্যাটাগরিতে কিছু না থাকলে ক্যাটাগরি ছেড়ে দিই (নইলে ০টি দেখাত)
    if (state.cat && !filtered({ ignoreCat: true }).some(function (p) { return (p.category || "Other") === state.cat; })) state.cat = "";
    state.shown = PAGE; closeModal(); render();
  }
  function advCount() { return platsOn().length + (state.min != null ? 1 : 0) + (state.max != null ? 1 : 0) + (state.favOnly ? 1 : 0); }

  /* ---------- আঁকা ---------- */
  function cardHTML(p) {
    var code = esc(p.code), price = priceOf(p), base = baseOf(p), fav = !!favs[String(p.code)];
    var priceHTML = (isFinite(price) && isFinite(base) && price < base - 1e-9)
      ? "<s>" + esc(fmt(base)) + "</s>" + esc(fmt(price)) : esc(fmt(price));
    var d = p.delivery && p.delivery.label ? p.delivery : null;
    return '<article class="sl-card" data-code="' + code + '">' +
      '<div class="sl-r1">' + icon(p.platform) +
      '<button type="button" class="sl-heart" data-sl-fav="' + code + '" aria-pressed="' + fav + '" aria-label="Favorite">' + (fav ? "♥" : "♡") + "</button>" +
      '<button type="button" class="sl-idc" data-sl-copy="' + code + '" aria-label="Copy ID ' + code + '"><span>' + code + '</span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>' +
      '<span class="sl-price">' + priceHTML + "</span></div>" +
      '<h3 class="sl-nm">' + esc(nameOf(p)) + "</h3>" +
      '<div class="sl-r2"><span class="sl-min">⌄ Min: ' + num(p.min) + '</span><span class="sl-max">⌃ Max: ' + num(p.max) + "</span></div>" +
      (d ? '<div class="sl-avg">⏱ ' + esc(String(d.label)) + "</div>" : "") +
      '<div class="sl-acts">' + (d ? '<button type="button" class="sl-btn" data-sl-stat="' + code + '">Statistics</button>' : "") +
      '<button type="button" class="sl-btn" data-sl-view="' + code + '">Details</button>' +
      '<button type="button" class="sl-btn sl-buy" data-sl-buy="' + code + '">Buy Now</button></div>' +
      '<div class="sl-panel" hidden></div></article>';
  }

  function render(keepScroll) {
    var list = $("slList"), ls = loadState();
    if (ls === "loading" && !pkgs().length) { list.innerHTML = '<div class="sl-msg" role="status">সার্ভিস লোড হচ্ছে…</div>'; $("slCount").textContent = ""; return; }
    if (ls === "error" && !pkgs().length) { list.innerHTML = '<div class="sl-msg" role="alert">সার্ভিস লোড করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।<br><button type="button" class="sl-btn sl-buy" data-sl-retry="1">আবার চেষ্টা করুন</button></div>'; $("slCount").textContent = ""; return; }
    $("slCatLabel").textContent = state.cat || "Category";
    var n = advCount(), dot = $("slAdvN"); dot.hidden = !n; dot.textContent = n;
    var items = filtered(), total = items.length;
    $("slCount").textContent = total ? total + " টি সার্ভিস" : "";
    if (!total) {
      list.innerHTML = '<div class="sl-msg">' + (pkgs().length ? "এই ফিল্টারে কোনো সার্ভিস নেই।" : "এখনো কোনো সার্ভিস যোগ করা হয়নি।") + "</div>";
      return;
    }
    // ক্যাটাগরি ধরে ভাগ — ক্যাটাগরির ক্রম সাইটের নিজস্ব ক্রমে
    var groups = {}; items.forEach(function (p) { var c = p.category || "Other"; (groups[c] = groups[c] || []).push(p); });
    var out = [], used = 0, cut = false;
    catOrder(Object.keys(groups)).forEach(function (c) {
      if (cut) return;
      var arr = groups[c], take = Math.min(arr.length, state.shown - used);
      if (take <= 0) { cut = true; return; }
      out.push('<h2 class="sl-gh">' + icon(arr[0].platform) + "<span>" + esc(c) + ' <small>(' + arr.length + ")</small></span></h2>");
      for (var i = 0; i < take; i++) out.push(cardHTML(arr[i]));
      used += take; if (take < arr.length) cut = true;
    });
    if (used < total) out.push('<div class="sl-more"><button type="button" class="sl-btn sl-buy" data-sl-more="1">আরও দেখান (' + (total - used) + ")</button></div>");
    var y = window.pageYOffset;
    list.innerHTML = out.join("");
    if (keepScroll) window.scrollTo(0, y);
    // আগে খোলা Details/Statistics ফেরত
    Object.keys(state.open).forEach(function (c) {
      var card = list.querySelector('.sl-card[data-code="' + (window.CSS && CSS.escape ? CSS.escape(c) : c) + '"]');
      if (card) { var pn = card.querySelector(".sl-panel"); pn.innerHTML = panelHTML(c, state.open[c]); pn.hidden = false; }
    });
    observeMore();
  }

  /* নিচে নামলে নিজে আরও কার্ড (বাটনও থাকে) */
  function observeMore() {
    if (io) { io.disconnect(); io = null; }
    var m = view.querySelector("[data-sl-more]");
    if (!m || !("IntersectionObserver" in window)) return;
    io = new IntersectionObserver(function (es) { if (es[0].isIntersecting && view.style.display !== "none") { io.disconnect(); io = null; state.shown += PAGE; render(true); } }, { rootMargin: "400px" });
    io.observe(m);
  }

  /* ক্যাটালগ লোড না হওয়া পর্যন্ত অপেক্ষা (সর্বোচ্চ ~২০ সেকেন্ড) */
  function wait() {
    clearTimeout(waitTimer); var tries = 0;
    (function tick() {
      render();
      if (loadState() === "loading" && ++tries < 50) waitTimer = setTimeout(tick, 400);
    })();
  }

  function open() { build(); wait(); }
  document.addEventListener("pb:svclist-open", open);
  document.addEventListener("pb:currency", function () { if (view.style.display !== "none" && built) render(true); });
  if (view.style.display !== "none") open();   // সরাসরি #services লিংকে
})();
