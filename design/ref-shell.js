/* design/ref-shell.js — R10 shell glue (no app logic is changed).
   1) page title in the header follows the visible view
   2) header chips: Add funds, WhatsApp support (D8), avatar mirror
   3) sidebar accordion group "Account & Help"
   Depends on: app-sidebar.js (PB_nav), app-orders.js (#pbAcct*), app-core.js (PB_SUPPORT). All optional: fails silently. */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }

  /* ---- 1) page title ---- */
  var TITLES = [
    ["orders-view", "Orders"], ["tickets-view", "Tickets"], ["svclist-view", "Services"], ["done-view", "Statistics"], ["refunds-view", "Refunds"],
    ["account-view", "Account"], ["rules-view", "Rules"], ["contact-view", "Contact"], ["pin-view", "Change PIN"],
    ["track-order-view", "Track order"], ["topup-view", "Add funds"], ["wallet-view", "Add funds"]
  ];
  function shown(id) { var el = $(id); return !!el && el.style.display !== "none" && !el.hidden; }
  function refTitle() {
    for (var i = 0; i < TITLES.length; i++) if (shown(TITLES[i][0])) return TITLES[i][1];
    return "New order";
  }
  var last = "";
  function syncTitle() {
    var t = $("rfTitle"); if (!t) return;
    var n = refTitle();
    if (n !== last) { last = n; t.textContent = n; }
    syncActive(n);
  }
  /* sidebar highlight for the two entries app-sidebar.js does not set by itself (home and wallet/top-up) */
  function syncActive(n) {
    var side = $("pbSidebar"); if (!side) return;
    var home = side.querySelector('.pb-side-item[data-go="new-order"]'), fund = $("pbSideAddFund");
    var on = side.querySelector(".pb-side-item.active");
    if (n === "New order") {
      if (home && (!on || on === fund)) { if (fund) fund.classList.remove("active"); home.classList.add("active"); }
    } else if (n === "Add funds") {
      side.querySelectorAll(".pb-side-item.active").forEach(function (el) { if (el !== fund) el.classList.remove("active"); });
      if (fund) fund.classList.add("active");
    } else if (fund) { fund.classList.remove("active"); if (home && n !== "New order" && !side.querySelector(".pb-side-item.active:not([data-go=\"new-order\"])")) home.classList.remove("active"); }
  }
  var raf = 0;
  function queue() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; syncTitle(); }); }
  window.refTitle = refTitle;

  /* ---- 2) header chips ---- */
  function wireChips() {
    var add = $("rfHdrAdd");
    if (add) add.addEventListener("click", function () { var b = $("pbSideAddFund"); if (b) b.click(); });
    var wa = $("rfHdrWa"), cfg = window.PB_SUPPORT || {};
    if (wa && cfg.whatsappChat) wa.href = cfg.whatsappChat;          // D8: reuse the existing support link
    var av = $("rfHdrAvatar");
    if (av) av.addEventListener("click", function () {
      var login = $("pbAcctLogin");
      if (login && !login.hidden) { login.click(); return; }          // guest -> same login flow as the drawer
      if (window.PB_nav && PB_nav.go) PB_nav.go("account");
    });
  }
  function paintAvatar() {
    var init = $("rfHdrInit"), img = $("rfHdrImg"), dot = $("rfHdrDot"), si = $("pbAcctInit"), sm = $("pbAcctImg"), login = $("pbAcctLogin");
    if (!init || !img) return;
    var guest = !login || !login.hidden;
    if (dot) dot.hidden = guest;
    var pic = !guest && sm && !sm.hidden && sm.getAttribute("src");
    if (pic) { img.src = sm.getAttribute("src"); img.hidden = false; init.hidden = true; }
    else { img.hidden = true; img.removeAttribute("src"); init.hidden = false; init.textContent = guest ? "?" : ((si && si.textContent.trim()) || "?"); }
    var av = $("rfHdrAvatar"); if (av) av.setAttribute("aria-label", guest ? "Log in" : "Account");
  }

  /* ---- 3) accordions (Order Tools, Account & Help) ---- */
  function setGroup(btn, body, open) {
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    body.hidden = !open;
  }
  function wireGroup(btnId, bodyId) {
    var btn = $(btnId), body = $(bodyId); if (!btn || !body) return;
    btn.addEventListener("click", function () { setGroup(btn, body, btn.getAttribute("aria-expanded") !== "true"); });
    var mq = window.matchMedia ? window.matchMedia("(min-width: 1024px)") : null;
    setGroup(btn, body, !!(mq && mq.matches));                        // open on desktop, closed in the phone drawer
    function openIfActive() { if (body.querySelector(".pb-side-item.active")) setGroup(btn, body, true); }
    openIfActive();                                                   // deep link (#refunds, #account) already marked its item
    var mo = new MutationObserver(openIfActive);
    body.querySelectorAll(".pb-side-item").forEach(function (el) { mo.observe(el, { attributes: true, attributeFilter: ["class"] }); });
    document.addEventListener("pb:sidebar-open", openIfActive);
  }

  /* ---- 4) currency switcher: header on >=768px, drawer on phones (keeps the header title readable) ---- */
  function placeCurrency() {
    var wrap = document.querySelector(".pb-cur"), tabs = document.querySelector(".site-nav-tabs"), acct = $("pbAcct");
    if (!wrap || !tabs || !acct) return;
    var slot = $("rfCurSlot");
    if (!slot) { slot = document.createElement("div"); slot.id = "rfCurSlot"; slot.className = "rf-cur-slot"; acct.parentNode.insertBefore(slot, acct.nextSibling); }
    var phone = window.matchMedia && window.matchMedia("(max-width: 767px)").matches;
    if (phone && wrap.parentNode !== slot) { slot.appendChild(wrap); slot.classList.add("on"); }
    else if (!phone && wrap.parentNode !== tabs) { tabs.insertBefore(wrap, tabs.firstChild); slot.classList.remove("on"); }
  }

  function init() {
    wireChips(); wireGroup("rfGrpToolsBtn", "rfGrpToolsBody"); wireGroup("rfGrpAcctBtn", "rfGrpAcctBody"); syncTitle(); paintAvatar();
    placeCurrency(); setTimeout(placeCurrency, 400); setTimeout(placeCurrency, 1500);
    window.addEventListener("resize", placeCurrency);
    var mo = new MutationObserver(queue);
    TITLES.concat([["services-view"], ["place-order-view"]]).forEach(function (t) {
      var el = $(t[0]); if (el) mo.observe(el, { attributes: true, attributeFilter: ["style", "hidden"] });
    });
    var acct = $("pbAcct"); if (acct) new MutationObserver(paintAvatar).observe(acct, { childList: true, subtree: true, attributes: true, characterData: true });
    window.addEventListener("hashchange", queue);
    document.addEventListener("click", function () { setTimeout(queue, 120); }, true);
    setInterval(syncTitle, 1000);                                     // safety net, cheap (string compare)
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
