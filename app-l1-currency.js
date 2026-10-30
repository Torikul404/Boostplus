/* ধাপ ২১ — কারেন্সি ড্রপডাউন (lazy, BDT ডিফল্ট)
   • শুরুতে DOM-এ শুধু একটি বাটন ("BDT ▾"); তালিকা (currencies.json) প্রথমবার খুললে তবেই আনা ও আঁকা হয়।
   • রেট বানানো হয় না: currencies.json-এর per_bdt (১ BDT = কত একক)। USD = 1/131 (pricing.js-এর USD_TO_BDT_RATE)।
   • শুধু দাম দেখানোর রূপান্তর; অর্ডার/পেমেন্ট/ওয়ালেট সবসময় BDT-তে। ব্যবহার: pbFmtPrice(bdtAmount).
   • পছন্দ এই ডিভাইসে (localStorage pb_currency)। */
(function () {
  "use strict";
  var KEY = "pb_currency", DEF = { code: "BDT", symbol: "৳", name: "Bangladeshi Taka", per_bdt: 1, decimals: 2 };
  var list = null, loading = null, cur = DEF, btn = null, panel = null;

  function saved() { try { return localStorage.getItem(KEY) || "BDT"; } catch (e) { return "BDT"; } }
  function save(c) { try { localStorage.setItem(KEY, c); } catch (e) {} }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function trim(n, d) { return Number(n).toFixed(d).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, ""); }
  /** BDT-এর অঙ্ক → বেছে নেওয়া কারেন্সিতে লেখা। তালিকা না আসা পর্যন্ত বা BDT হলে "৳x" */
  window.pbFmtPrice = function (bdt) {
    var n = Number(bdt); if (!isFinite(n)) return "—";
    if (cur.code === "BDT") return "৳" + trim(n, n < 10 ? 4 : 2);
    var v = n * Number(cur.per_bdt || 0);
    return (cur.symbol || cur.code + " ") + trim(v, v < 1 ? (cur.decimals || 4) : 2);
  };
  window.pbCurrency = { get: function () { return cur.code; } };

  function load() {
    if (list) return Promise.resolve(list);
    if (loading) return loading;
    loading = fetch("currencies.json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (a) { list = Array.isArray(a) && a.length ? a : [DEF]; return list; })
      .catch(function () { loading = null; list = null; return [DEF]; });
    return loading;
  }
  function apply(code) {
    var c = (list || [DEF]).filter(function (x) { return x.code === code; })[0] || DEF;
    cur = c; save(c.code);
    if (btn) { btn.firstChild.textContent = c.code + " "; btn.setAttribute("aria-label", "মুদ্রা: " + c.code + " — বদলান"); }
    try { document.dispatchEvent(new CustomEvent("pb:currency", { detail: { code: c.code } })); } catch (e) {}
    try { if (typeof renderDropdownPicker === "function") renderDropdownPicker(); } catch (e) {}
  }
  function close() { if (!panel) return; panel.hidden = true; btn.setAttribute("aria-expanded", "false"); }
  function open() {
    btn.setAttribute("aria-expanded", "true");
    if (!panel) { panel = document.createElement("div"); panel.className = "pb-cur-panel"; panel.setAttribute("role", "listbox"); panel.setAttribute("aria-label", "মুদ্রা বেছে নিন"); btn.parentNode.appendChild(panel); }
    panel.hidden = false; panel.innerHTML = '<div class="pb-cur-load">লোড হচ্ছে…</div>';
    load().then(function (a) {
      if (panel.hidden) return;
      panel.innerHTML = a.map(function (c) {
        return '<button type="button" role="option" class="pb-cur-opt' + (c.code === cur.code ? " on" : "") + '" aria-selected="' + (c.code === cur.code) + '" data-c="' + esc(c.code) + '"><b>' + esc(c.code) + "</b> <span>" + esc(c.name || "") + "</span></button>";
      }).join("") + '<div class="pb-cur-note">শুধু দাম দেখানোর জন্য। পেমেন্ট ও ওয়ালেট BDT-তে।</div>';
      var on = panel.querySelector(".on"); if (on) on.focus();
    });
  }
  function mount() {
    var tabs = document.querySelector(".site-nav-tabs"); if (!tabs || document.getElementById("pbCurBtn")) return;
    var wrap = document.createElement("div"); wrap.className = "pb-cur";
    wrap.innerHTML = '<button type="button" class="pb-cur-btn" id="pbCurBtn" aria-haspopup="listbox" aria-expanded="false" aria-label="মুদ্রা: BDT — বদলান">BDT <span aria-hidden="true">▾</span></button>';
    tabs.insertBefore(wrap, tabs.firstChild); btn = wrap.firstChild;
    btn.addEventListener("click", function () { if (panel && !panel.hidden) close(); else open(); });
    wrap.addEventListener("click", function (e) { var o = e.target.closest(".pb-cur-opt"); if (!o) return; apply(o.getAttribute("data-c")); close(); btn.focus(); });
    document.addEventListener("click", function (e) { if (panel && !panel.hidden && !wrap.contains(e.target)) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel && !panel.hidden) { close(); btn.focus(); } });
    // সেভ করা পছন্দ ≠ BDT হলে শুধু তখনই তালিকা আনা হয়; BDT হলে নেটওয়ার্ক-কল নেই
    var s = saved(); if (s !== "BDT") load().then(function () { apply(s); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
