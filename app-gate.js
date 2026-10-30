/* app-gate.js — গেস্ট ভিউ (ধাপ ৬)
   লগইন ছাড়া ভিজিটর সার্ভিস ও দাম দেখতে পারে; অর্ডার ফর্ম (লিংক/পরিমাণ/সাবমিট) লুকানো থাকে এবং
   তার জায়গায় "অর্ডার করতে লগইন করুন" কার্ড আসে। লগইন/ওয়ালেট বাটন আলাদা login.html এ নিয়ে যায়।
   ব্যাকএন্ড বা app-catalog.js এর লজিক বদলায়নি। ফিরে যেতে হলে index.html থেকে এই স্ক্রিপ্টের লিংক সরান। */
(function () {
  "use strict";
  var LS_TOKEN = "pb_wallet_token", LS_MOBILE = "pb_wallet_mobile";
  function $(id) { return document.getElementById(id); }
  function logged() { try { return !!(localStorage.getItem(LS_TOKEN) && localStorage.getItem(LS_MOBILE)); } catch (e) { return false; } }
  function codeOk(c) { return /^[\w.\-]{1,40}$/.test(c); }

  function selCode() { try { return (typeof selectedServiceCode !== "undefined") ? String(selectedServiceCode || "") : ""; } catch (e) { return ""; } }
  function selPkg() {
    try {
      var c = selCode(); if (!c || typeof allPackages === "undefined") return null;
      return allPackages.find(function (p) { return String(p.code) === c; }) || null;
    } catch (e) { return null; }
  }
  function loginUrl(tab) {
    var q = [], c = selCode();
    if (codeOk(c)) q.push("svc=" + encodeURIComponent(c));
    if (tab) q.push("tab=" + tab);
    return "login.html" + (q.length ? "?" + q.join("&") : "");
  }

  function ensureGate() {
    var g = $("pbGate"); if (g) return g;
    var f = $("abOrderFields"); if (!f || !f.parentNode) return null;
    g = document.createElement("div"); g.id = "pbGate"; g.className = "pb-gate"; g.hidden = true;
    g.innerHTML = '<div class="pb-gate-ico" aria-hidden="true">🔒</div>' +
      '<h3 class="pb-gate-t">অর্ডার করতে একাউন্ট লগইন করুন</h3>' +
      '<p class="pb-gate-s">মোবাইল নাম্বার এবং পিন (পাসওয়ার্ড) দিয়ে একাউন্ট খুলুন।</p>' +
      '<div class="pb-gate-row"><a class="pb-gate-btn" id="pbGateReg" href="login.html?tab=register">একাউন্ট খুলুন</a></div>' +
      '<p class="pb-gate-alt">আগে থেকেই একাউন্ট আছে? <a id="pbGateLogin" href="login.html">লগইন করুন</a></p>';
    f.parentNode.insertBefore(g, f);
    return g;
  }

  function sync() {
    var guest = !logged();
    document.body.classList.toggle("pb-guest", guest);
    var g = ensureGate(); if (!g) return;
    var pkg = guest ? selPkg() : null;
    g.hidden = !pkg;
    if (!pkg) return;
    $("pbGateLogin").setAttribute("href", loginUrl());
    $("pbGateReg").setAttribute("href", loginUrl("register"));
  }

  // লগইন ছাড়া এই বাটনগুলো আর ওয়ালেট-ট্যাবে নয়, আলাদা লগইন পেজে নিয়ে যায়
  document.addEventListener("click", function (e) {
    if (logged()) return;
    var t = e.target && e.target.closest ? e.target.closest("#navWalletBtn,#udLoginBtn,#pbAcctLogin,#ohLoginBtn,#udAddFundBtn") : null;
    if (!t) return;
    e.preventDefault(); e.stopImmediatePropagation();
    location.href = "login.html";
  }, true);

  // গেস্ট কার্ডে ট্যাপ করলে অর্ডার ফর্মের বদলে লগইন কার্ডে স্ক্রল
  // (picker লিস্ট নতুন করে আঁকে, তাই ক্লিক হওয়া কার্ড তখন DOM থেকে খুলে যায় — #pkList দিয়ে খোঁজা যাবে না)
  document.addEventListener("pb:service-picked", function () {   // app-picker.js: ড্রপডাউনে সার্ভিস বদলালে (ধাপ ১১)
    if (logged()) return;
    setTimeout(sync, 60);
  });

  // লগইনের পর হোমে ফিরলে (?svc=CODE) ওই সার্ভিস সিলেক্ট করা
  function cleanUrl() { try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {} }
  function restore() {
    var m = /[?&]svc=([^&#]+)/.exec(location.search); if (!m) return;
    var code; try { code = decodeURIComponent(m[1]); } catch (e) { return cleanUrl(); }
    if (!codeOk(code)) return cleanUrl();
    var tries = 0;
    function apply() {
      var pkg = allPackages.find(function (p) { return String(p.code) === code; });
      if (!pkg) return false;
      try { selectedCategoryValue = pkg.category || selectedCategoryValue; selectedServiceCode = String(pkg.code); renderDropdownPicker(); } catch (e) { return false; }
      return true;
    }
    (function go() {
      var ready = typeof allPackages !== "undefined" && typeof catalogLoadState !== "undefined" && catalogLoadState !== "loading" && allPackages.length;
      if (!ready) { if (tries++ < 80) return setTimeout(go, 150); return cleanUrl(); }
      if (!apply()) return cleanUrl();
      setTimeout(function () { if (selCode() !== code) apply(); sync(); var f = logged() ? $("abOrderFields") : $("pbGate"); if (f && !f.hidden) { try { f.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (_) {} } }, 400);
      cleanUrl();
    })();
  }

  sync();
  setInterval(sync, 1200);
  window.addEventListener("storage", sync);
  restore();
})();
