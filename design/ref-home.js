/* design/ref-home.js — R11 part 1: New order page glue (no app logic is changed).
   1) hero buttons (Browse services / Track orders) -> PB_nav
   2) 4th stat tile "Active orders": real value from the orders feed (#ohStActive); hidden until it is known (D7)
   3) Step 2 card receives the Description panel and Link/Quantity (the elements keep their ids)
   4) "Total amount" mirrors the quantity field
   Depends on: app-sidebar.js (PB_nav), app-orders.js (PB_ORDERS), app-picker.js (#rfStep2Slot), app-catalog.js (updateAbCharge). All optional: fails silently. */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function logged() { try { return !!(localStorage.getItem("pb_wallet_token") && localStorage.getItem("pb_wallet_mobile")); } catch (e) { return false; } }

  /* ---- 1) hero buttons ---- */
  function wireHero() {
    var b = $("rfHeroBrowse"), t = $("rfHeroTrack");
    if (b) b.addEventListener("click", function () { if (window.PB_nav) PB_nav.go("services"); });
    if (t) t.addEventListener("click", function () { if (window.PB_nav) PB_nav.go("orders"); });
  }

  /* ---- 2) Active orders tile ---- */
  var activeTried = 0;
  function syncActive() {
    var tile = $("rfTileActive"), src = $("ohStActive"), out = $("rfActiveVal");
    if (!tile || !src || !out) return;
    var v = (src.textContent || "").trim();
    if (/^\d+$/.test(v) && logged()) { out.textContent = v; tile.hidden = false; }
    else tile.hidden = true;
    var tiles = $("rfTiles"); if (tiles) tiles.classList.toggle("rf-tiles--3", tile.hidden);
  }
  function loadActive() {
    if (!logged() || !window.PB_ORDERS || !PB_ORDERS.ensure) return;
    activeTried++;
    try { var p = PB_ORDERS.ensure(); if (p && p.then) p.then(syncActive, syncActive); } catch (e) {}
  }

  /* ---- 3) Step 2 card: move Description + Link/Quantity into it ---- */
  var moved = false;
  function placeStep2() {
    var slot = $("rfStep2Slot"), desc = $("abDescBox"), lq = $("abLinkQty");
    if (!slot || !desc || !lq) return false;
    if (desc.parentNode !== slot) slot.appendChild(desc);
    if (lq.parentNode !== slot) slot.appendChild(lq);
    moved = true;
    syncLinkQty();
    return true;
  }
  function syncLinkQty() {
    var f = $("abOrderFields"), lq = $("abLinkQty");
    if (!f || !lq) return;
    lq.hidden = f.style.display === "none" || !f.style.display;
  }

  /* ---- 4) Total amount mirrors quantity ---- */
  function syncTotal() {
    var q = $("abQty"), o = $("rfTotalAmt"); if (!q || !o) return;
    var n = parseInt(q.value || "0", 10) || 0;
    o.textContent = n.toLocaleString("en-US");
  }

  function init() {
    wireHero(); syncActive(); loadActive();
    var src = $("ohStActive");
    if (src) new MutationObserver(syncActive).observe(src, { childList: true, characterData: true, subtree: true });
    var f = $("abOrderFields");
    if (f) new MutationObserver(syncLinkQty).observe(f, { attributes: true, attributeFilter: ["style"] });
    var q = $("abQty");
    if (q) { q.addEventListener("input", syncTotal); q.addEventListener("change", syncTotal); }
    // updateAbCharge also rewrites the quantity for Custom Comments services, so keep the mirror in step with it
    if (typeof window.updateAbCharge === "function") {
      var orig = window.updateAbCharge;
      window.updateAbCharge = function () { var r = orig.apply(this, arguments); try { syncTotal(); } catch (e) {} return r; };
    }
    var tries = 0, iv = setInterval(function () { if (placeStep2() || ++tries > 60) clearInterval(iv); }, 100);
    // login happens in another tab / after load: try the Active orders tile again once
    window.addEventListener("storage", function () { if (activeTried < 2) loadActive(); });
    setInterval(function () { if (logged()) syncActive(); }, 4000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
