/* design/ref-rail.js — R11 part 2: right-rail glue for the New order page (no app logic is changed).
   1) "Popular services" = the Top Services the owner picked in the Telegram bot (window.PB_TOP, real data, D7).
      At most 5 rows, one per platform first. Hidden while there are none. Click -> pickSearchResult(code).
   2) "View All" -> Services page.  3) "Open a ticket" link in Important Notes -> Tickets.
   Depends (all optional, fails silently): app-catalog.js (allPackages, PB_TOP, packageSellPrice, pickSearchResult),
   app-l1-currency.js (pbFmtPrice), app-sidebar.js (PB_nav). */
(function () {
  "use strict";
  var MAX = 5;
  function $(id) { return document.getElementById(id); }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pkgs() { try { return (typeof allPackages !== "undefined" && allPackages) ? allPackages : []; } catch (e) { return []; } }
  function top() { try { return (window.PB_TOP && typeof window.PB_TOP === "object") ? window.PB_TOP : {}; } catch (e) { return {}; } }

  function platIcon(key) {
    var btn = key ? document.querySelector('#services-view .platform-bar .platform-btn[data-platform="' + key + '"]') : null;
    var sv = btn && btn.querySelector("svg");
    if (!sv) return "";
    var h = sv.outerHTML;
    // Instagram's gradient is defined once in the platform bar (outside the icon), so refs stay as they are;
    // only an icon that defines its own ids gets them renamed (no duplicate ids)
    if (/\sid="/.test(h)) h = h.replace(/\sid="/g, ' id="rp-').replace(/url\(#/g, "url(#rp-").replace(/href="#/g, 'href="#rp-');
    return h;
  }
  function name(p) { var n = p.name || ""; try { if (typeof pbDropdownName === "function") n = pbDropdownName(p) || n; } catch (e) {} return n; }
  function price(p) {
    try { var v = packageSellPrice(p); if (isFinite(Number(v)) && Number(v) > 0) return (window.pbFmtPrice ? window.pbFmtPrice(v) : "৳" + Number(v).toFixed(2)) + " per 1,000"; } catch (e) {}
    return "";
  }

  // pick up to MAX codes: round-robin over platforms so one platform does not take the whole card
  function pick() {
    var list = pkgs(), byCode = {}, T = top(), out = [];
    list.forEach(function (p) { byCode[String(p.code)] = p; });
    var cols = Object.keys(T).map(function (pl) { return (T[pl] || []).map(String).filter(function (c) { return byCode[c]; }); }).filter(function (a) { return a.length; });
    for (var i = 0; out.length < MAX; i++) {
      var any = false;
      for (var j = 0; j < cols.length && out.length < MAX; j++) { if (cols[j][i] != null) { out.push(byCode[cols[j][i]]); any = true; } }
      if (!any) break;
    }
    return out;
  }

  var lastSig = null;
  function render() {
    var card = $("rfPopular"), box = $("rfPopList"); if (!card || !box) return;
    var items = pick(), sig = items.map(function (p) { return p.code; }).join(",");
    if (sig === lastSig) return;
    lastSig = sig;
    if (!items.length) { card.hidden = true; box.innerHTML = ""; return; }
    box.innerHTML = items.map(function (p) {
      var pr = price(p);
      return '<button type="button" class="rf-popitem" data-code="' + esc(p.code) + '">' +
        '<span class="rf-poppf" aria-hidden="true">' + platIcon(String(p.platform || "").toLowerCase()) + "</span>" +
        '<span class="rf-poptxt"><span class="rf-popname">' + esc(name(p)) + "</span>" +
        (pr ? '<span class="rf-popsub">' + esc(pr) + "</span>" : "") + "</span>" +
        '<svg class="rf-popcaret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>';
    }).join("");
    card.hidden = false;
  }

  function init() {
    var all = $("rfPopularAll");
    if (all) all.addEventListener("click", function () { if (window.PB_nav) PB_nav.go("services"); });
    var rail = $("rfRail");
    if (rail) rail.addEventListener("click", function (e) {
      var t = e.target.closest ? e.target.closest(".rf-inlink[data-go]") : null;
      if (t) { if (window.PB_nav) PB_nav.go(t.getAttribute("data-go")); return; }
      var b = e.target.closest ? e.target.closest(".rf-popitem") : null;
      if (!b) return;
      try {
        pickSearchResult(b.getAttribute("data-code"));
        setTimeout(function () { var f = $("rfStep1") || $("dropdownPicker"); if (f && f.scrollIntoView) f.scrollIntoView({ behavior: "smooth", block: "start" }); }, 220);
      } catch (err) { console.warn("popular pick:", err); }
    });
    // the live catalog (service_meta) arrives after load: check until it is there, then keep a slow check (catalog reloads)
    var n = 0, iv = setInterval(function () { render(); if (++n > 40 && !lastSig) clearInterval(iv); }, 1500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
