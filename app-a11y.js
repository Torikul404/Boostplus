/* ==========================================================
   app-a11y.js — ধাপ ১৬: ড্রয়ারে inert + ফোকাস-ট্র্যাপ, skip-link, aria-busy, আবার চেষ্টা বাটন
   সবার শেষে লোড হয়। বাকি স্ক্রিপ্টের সাথে বাঁধা নেই; না থাকলে নিজে থেকে চুপ থাকে।
   Exposes: window.PB_A11Y = { busy(el, bool), syncCatalog() }
   ========================================================== */
(function () {
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- aria-busy ---------- */
  function busy(el, on) { if (!el) return; if (on) el.setAttribute('aria-busy', 'true'); else el.removeAttribute('aria-busy'); }

  function syncCatalog() {
    var st = (typeof catalogLoadState !== 'undefined') ? catalogLoadState : 'full';
    var loading = st === 'loading';
    busy($('app'), loading);
    busy($('abOrderFields') && $('abOrderFields').parentNode, loading);
  }

  /* ---------- skip-link: ফোকাস main-এ যায় ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.skip-link');
    if (!a) return;
    var t = document.getElementById((a.getAttribute('href') || '').slice(1));
    if (t) { e.preventDefault(); t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: false }); }
  });

  /* ---------- সাইডবার ড্রয়ার: বন্ধ থাকলে inert (Tab পৌঁছায় না), খোলা থাকলে ফোকাস ভেতরে আটকে থাকে ---------- */
  var sb = $('pbSidebar');
  if (sb) {
    var sync = function () { var hid = sb.getAttribute('aria-hidden') === 'true'; if (hid) sb.setAttribute('inert', ''); else sb.removeAttribute('inert'); };
    sync();
    new MutationObserver(sync).observe(sb, { attributes: true, attributeFilter: ['aria-hidden'] });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || sb.getAttribute('aria-hidden') === 'true' || !sb.classList.contains('open')) return;   // ধাপ ২৯: ডেস্কটপের স্থায়ী সাইডবারে ফোকাস আটকায় না
      var f = sb.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])');
      f = Array.prototype.filter.call(f, function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ---------- "আবার চেষ্টা" বাটন (ত্রুটির ব্লকে data-pb-retry) ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-pb-retry]');
    if (!b) return;
    var kind = b.getAttribute('data-pb-retry');
    if (kind === 'catalog' && typeof window.pbReloadCatalog === 'function') window.pbReloadCatalog();
    else if (kind === 'orders' && $('ohRefresh')) $('ohRefresh').click();
    else if (kind === 'lookup' && $('tkOrderId')) $('tkOrderId').dispatchEvent(new Event('blur'));
  });

  window.PB_A11Y = { busy: busy, syncCatalog: syncCatalog };
  syncCatalog();
})();
