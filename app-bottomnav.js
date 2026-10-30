/* app-bottomnav.js — মোবাইলের নিচের নেভিগেশন বার (ধাপ ১১)
   নতুন অর্ডার · সার্ভিস · অর্ডার · ওয়ালেট · সহায়তা (ধাপ ২৮)
   নির্ভর করে: app-sidebar.js (window.PB_nav), #navWalletBtn (app-wallet.js/app-gate.js)।
   ডেস্কটপে (≥768px) CSS দিয়ে লুকানো — ওপরের নেভিগেশনই থাকে।
   ফিরে যেতে হলে index.html থেকে এই স্ক্রিপ্ট ও design/bottomnav.css এর লিংক সরান। */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  var ICON = {
    order: '<path d="M3 4h2.2l2 11h10.3l2-8H6.2"/><circle cx="9" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
    services: '<path d="M14.7 6.3a4 4 0 0 0-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-2.4 2.4-2.3-.7-.7-2.3z"/>',
    funds: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.2"/>',
    orders: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    more: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    support: '<path d="M4 12a8 8 0 0 1 16 0v4.5a2 2 0 0 1-2 2h-1.5v-6H20M4 12.5h3.5v6H6a2 2 0 0 1-2-2z"/><path d="M15 20.5h-2.5"/>'
  };
  var ITEMS = [
    ["order", "নতুন অর্ডার", "new"], ["services", "সার্ভিস", "services"], ["orders", "অর্ডার", "orders"],
    ["funds", "ওয়ালেট", "funds"], ["support", "সহায়তা", "support"]
  ];
  var bar = null;

  function build() {
    if ($("pbBottomNav")) return;
    bar = document.createElement("nav");
    bar.id = "pbBottomNav"; bar.className = "pb-bnav"; bar.setAttribute("aria-label", "নিচের মেনু");
    bar.innerHTML = ITEMS.map(function (it) {
      return '<button type="button" class="pb-bnav-btn" data-bn="' + it[2] + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[it[0]] + '</svg><span>' + it[1] + '</span></button>';
    }).join("");
    document.body.appendChild(bar);
    document.body.classList.add("pb-has-bnav");
    bar.addEventListener("click", function (e) {
      var b = e.target.closest(".pb-bnav-btn"); if (!b) return;
      act(b.getAttribute("data-bn"));
      setTimeout(sync, 150);
    });
  }

  function go(name) { if (window.PB_nav && PB_nav.go) PB_nav.go(name); }

  function act(k) {
    if (k === "new") { go("new-order"); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (_) {} }
    else if (k === "services") {
      go("new-order");
      setTimeout(function () {
        var s = $("searchInput");
        if (s) { try { s.scrollIntoView({ behavior: "smooth", block: "center" }); s.focus({ preventScroll: true }); } catch (_) {} }
      }, 120);
    }
    else if (k === "funds") { var w = $("navWalletBtn"); if (w) w.click(); }   // গেস্ট হলে app-gate.js লগইন পেজে পাঠায়
    else if (k === "orders") go("orders");
    else if (k === "support") go("tickets");
  }

  function shown(id) { var el = $(id); return !!el && el.style.display !== "none" && !el.hidden; }

  function sync() {
    if (!bar) return;
    var cur = "new";
    if (shown("orders-view")) cur = "orders";
    else if (shown("wallet-view")) cur = "funds";
    else if (shown("tickets-view")) cur = "support";
    else if (shown("contact-view") || shown("rules-view")) cur = "";
    else if (document.activeElement && document.activeElement.id === "searchInput") cur = "services";
    bar.querySelectorAll(".pb-bnav-btn").forEach(function (b) {
      var on = b.getAttribute("data-bn") === cur;
      b.classList.toggle("on", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
  }

  // কীবোর্ড খোলা থাকলে বার লুকাও (ইনপুট ঢাকা পড়া ঠেকাতে)
  document.addEventListener("focusin", function (e) {
    var t = e.target; if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) document.body.classList.add("pb-kb");
  });
  document.addEventListener("focusout", function () { setTimeout(function () {
    var a = document.activeElement; if (!a || !/^(INPUT|TEXTAREA)$/.test(a.tagName)) document.body.classList.remove("pb-kb");
  }, 60); });

  build(); sync();
  setInterval(sync, 700);
  window.addEventListener("hashchange", function () { setTimeout(sync, 80); });
})();
