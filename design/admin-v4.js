/* design/admin-v4.js — নেভিগেশন ড্রয়ার, নিচের বার, স্ট্যাটাস বার ও হিসাব ট্যাব। অ্যাডমিন লজিক ছোঁয় না। */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var IC = { orders: '<path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1zM7 6H5v14h14V6h-2M9 12h6M9 16h4"/>', inbox: '<path d="M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5l1 2h4l1-2h5"/>', services: '<path d="M4 6h16M4 12h16M4 18h10"/>', wallet: '<path d="M4 7h14v-1a2 2 0 0 0-2-2H5a1 1 0 0 0-1 1zM4 7v12h16V9H5M16 14h2"/>' };
  var MAP = { orders: "tabOrders", inbox: "tabInbox", services: "tabServices", wallet: "tabWallet" };
  var bd = function (s) { return parseInt(String(s || "").replace(/[০-৯]/g, function (d) { return "০১২৩৪৫৬৭৮৯".indexOf(d); }).replace(/\D/g, ""), 10) || 0; };
  function qbar() {
    var el = $("#qbar"); if (!el) return;
    el.innerHTML = [["stPending", "pq-pend"], ["stProcessing", "pq-proc"], ["stCompleted", "pq-done"], ["stRejected", "pq-rej"], ["stPartial", "pq-part"]].map(function (p) {
      var n = bd(($("#" + p[0]) || {}).textContent); return n ? '<i class="' + p[1] + '" style="flex:' + n + '"></i>' : "";
    }).join("");
  }
  function mark() {
    var v = ($("#statusFilter") || {}).value;
    $$("#dashStats .d").forEach(function (d) { var o = d.getAttribute("onclick") || ""; d.classList.toggle("on", !!v && o.indexOf("'" + v + "'") > -1); });
  }
  function init() {
    var tabs = $("#panelView > .tabs"), brand = $(".admin-brand"); if (!tabs || !brand) return;
    var close = function () { document.body.classList.remove("nav-open"); };
    var mb = document.createElement("button"); mb.type = "button"; mb.className = "nav-menu"; mb.setAttribute("aria-label", "মেনু"); mb.textContent = "☰";
    mb.onclick = function () { document.body.classList.toggle("nav-open"); }; brand.insertBefore(mb, brand.firstChild);
    var sc = document.createElement("div"); sc.className = "nav-scrim"; sc.onclick = close; document.body.appendChild(sc);
    var bn = document.createElement("nav"); bn.id = "bnav"; bn.setAttribute("aria-label", "প্রধান মেনু");
    bn.innerHTML = [["orders", "অর্ডার"], ["inbox", "ইনবক্স"], ["services", "সার্ভিস"], ["wallet", "ওয়ালেট"]].map(function (i) {
      return '<button type="button" data-k="' + i[0] + '"><svg viewBox="0 0 24 24">' + IC[i[0]] + "</svg>" + i[1] + "</button>";
    }).join("");
    bn.onclick = function (e) { var b = e.target.closest("button"); if (b) window.showTab(b.dataset.k); };
    document.body.appendChild(bn);
    var orig = window.showTab;
    window.showTab = function (n) {
      var r = orig.apply(this, arguments); close();
      $$("#bnav button").forEach(function (b) { b.classList.toggle("on", b.dataset.k === n); });
      window.scrollTo(0, 0); return r;
    };
    $$("#bnav button")[0].classList.add("on");
    /* হিসাব: আজ / শুরু থেকে / টপ-আপ */
    var gs = $$("#ordersPane .mg");
    if (gs.length) {
      var seg = document.createElement("div"); seg.className = "mseg";
      gs.forEach(function (g, i) {
        var b = document.createElement("button"); b.type = "button"; b.textContent = g.dataset.t; b.className = i ? "" : "on";
        b.onclick = function () { gs.forEach(function (x, j) { x.style.display = j === i ? "" : "none"; }); $$("button", seg).forEach(function (y, j) { y.classList.toggle("on", j === i); }); };
        seg.appendChild(b); g.style.display = i ? "none" : "";
      });
      gs[0].parentNode.insertBefore(seg, gs[0]);
    }
    var ds = $("#dashStats");
    if (ds) {
      new MutationObserver(qbar).observe(ds, { subtree: true, childList: true, characterData: true });
      ds.addEventListener("click", function () { setTimeout(mark, 0); });
    }
    var sf = $("#statusFilter"); if (sf) sf.addEventListener("change", mark);
    qbar(); mark();
    if (matchMedia("(max-width:1100px)").matches) { var bp = $("#balancePanel"); if (bp) bp.classList.add("compact"); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

/* ===== P২: পাতা অনুযায়ী ছোট স্ক্রিপ্ট ===== */
/* P২-১ সার্ভিস: বাল্ক ও টুলস বাটন এক মেনুতে (সব onclick ও id অক্ষত) */
(function(){function go(){var pane=document.getElementById("servicesPane");if(!pane||pane.querySelector(".svc-tools"))return;
var rows=pane.querySelectorAll(".svc-filters");var f=rows[1];if(!f)return;
var mv=[].slice.call(f.querySelectorAll("button")).filter(function(b){var o=b.getAttribute("onclick")||"";return /svcBulkPrice|svcBulkDiscount|svcAuditOpen|svcSpeedConfig|svcUndoBulk/.test(o)});
if(!mv.length)return;var d=document.createElement("details");d.className="svc-tools";d.innerHTML='<summary>⚙ বাল্ক ও টুলস</summary><div class="svc-tools-body"></div>';
var body=d.querySelector(".svc-tools-body");mv.forEach(function(b){body.appendChild(b)});
var cnt=document.getElementById("svcListCount");cnt.parentNode.insertBefore(d,cnt);}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go();})();

/* P২-২ ওয়ালেট: Init sheets এক মেনুতে, লেজারে জমা/খরচের দাগ, ইউজার লিস্ট নিজে লোড (সব id ও onclick অক্ষত) */
(function(){function go(){var pane=document.getElementById("walletPane");if(!pane||pane.querySelector(".svc-tools"))return;
var init=pane.querySelector('button[onclick^="walInitSheets"]');
if(init){var d=document.createElement("details");d.className="svc-tools";d.innerHTML='<summary>⚙ সেটআপ টুলস</summary><div class="svc-tools-body"></div>';d.querySelector(".svc-tools-body").appendChild(init);var sr=pane.querySelector(".search-row");sr.parentNode.insertBefore(d,sr.nextSibling);}
var led=document.getElementById("walLedger");
if(led){var mark=function(){[].forEach.call(led.querySelectorAll(".svc-row"),function(r){var b=r.querySelector("b");if(!b)return;var neg=/^-|−/.test(b.textContent.trim());r.classList.toggle("wl-out",neg);r.classList.toggle("wl-in",!neg)})};
new MutationObserver(mark).observe(led,{childList:true});}
var ob=document.getElementById("tabWallet");if(ob)ob.addEventListener("click",function(){var u=document.getElementById("walUsers");if(u&&u.textContent.trim()==="—"&&typeof walListUsers==="function")walListUsers()});}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go();})();

/* P২-৩ ইনবক্স: রিপ্লাইয়ের দ্রুত বাক্য (সব id ও onclick অক্ষত) */
(function(){var Q=["দেখছি, একটু অপেক্ষা করুন।","রিফিল দেওয়া হয়েছে।","সমস্যাটি সমাধান হয়েছে।"];
function add(){var t=document.getElementById("inbReply");if(!t||document.querySelector("#inbDetail .inb-qr"))return;
var d=document.createElement("div");d.className="inb-qr";d.setAttribute("aria-label","দ্রুত রিপ্লাই");
Q.forEach(function(q){var b=document.createElement("button");b.type="button";b.className="inb-chip";b.textContent=q;b.onclick=function(){t.value=t.value.trim()?t.value.trim()+" "+q:q;t.focus()};d.appendChild(b)});
t.parentNode.insertBefore(d,t)}
function go(){var el=document.getElementById("inbDetail");if(el)new MutationObserver(add).observe(el,{childList:true})}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go()})();

/* P২-৪ টিকিট: স্ট্যাটাস চিপ, কার্ডে স্ট্যাটাসের দাগ, দ্রুত রিপ্লাই (সব id ও onclick অক্ষত) */
(function(){var ST=["Open","In Progress","Resolved","Closed","All"],Q=["দেখছি, একটু অপেক্ষা করুন।","রিফিল দেওয়া হয়েছে।","সমস্যাটি সমাধান হয়েছে।"];
function sync(){var sel=document.getElementById("ticketFilter");[].forEach.call(document.querySelectorAll("#ticketsPane .tk-chips button"),function(b){b.setAttribute("aria-pressed",b.dataset.v===sel.value)})}
function decorate(){[].forEach.call(document.querySelectorAll("#ticketsList .card[data-tid]"),function(c){var s=c.querySelector(".tk-status");if(s)c.dataset.st=s.value;var t=c.querySelector(".tk-reply");if(t&&!c.querySelector(".tk-qr")){var d=document.createElement("div");d.className="tk-qr";Q.forEach(function(q){var b=document.createElement("button");b.type="button";b.textContent=q;b.onclick=function(){t.value=t.value.trim()?t.value.trim()+" "+q:q;t.focus()};d.appendChild(b)});t.parentNode.insertBefore(d,t)}})}
function go(){var pane=document.getElementById("ticketsPane"),sel=document.getElementById("ticketFilter"),list=document.getElementById("ticketsList");if(!pane||!sel||!list||pane.querySelector(".tk-chips"))return;
var w=document.createElement("div");w.className="tk-chips";w.setAttribute("role","group");w.setAttribute("aria-label","স্ট্যাটাস");
ST.forEach(function(v){var b=document.createElement("button");b.type="button";b.dataset.v=v;b.textContent=v==="All"?"সব":v;b.onclick=function(){sel.value=v;sync();if(typeof loadTickets==="function")loadTickets()};w.appendChild(b)});
list.parentNode.insertBefore(w,list);sync();
new MutationObserver(decorate).observe(list,{childList:true});
list.addEventListener("change",function(e){if(e.target.classList.contains("tk-status")){var c=e.target.closest(".card");if(c)c.dataset.st=e.target.value}})}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go()})();

/* P২-৫ রিফান্ড হিস্ট্রি: অর্ডার সারিতে স্ট্যাটাসের দাগ, রিফান্ড বাকি হলে লাল আভা (সব id ও onclick অক্ষত) */
(function(){function mark(){[].forEach.call(document.querySelectorAll("#rhOrders .svc-row"),function(r){var t=r.textContent,k=/Completed/i.test(t)?"done":/Rejected|Cancel/i.test(t)?"bad":/Processing|Progress/i.test(t)?"run":"wait";r.dataset.st=k;if(t.indexOf("রিফান্ড বাকি")>-1)r.setAttribute("data-pend","1");else r.removeAttribute("data-pend")})}
function go(){var o=document.getElementById("rhOrders");if(o)new MutationObserver(mark).observe(o,{childList:true})}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go()})();

/* P২-৬ স্পিড টেস্টার: ট্যাব অনুযায়ী গ্রিড, অর্ডার সারিতে স্ট্যাটাসের দাগ (সব id ও onclick অক্ষত) */
(function(){function mk(){var v=document.getElementById("spV");if(!v)return;try{v.dataset.tab=SP.tab}catch(e){}
[].forEach.call(v.querySelectorAll(".o"),function(o){var t=o.textContent;o.dataset.st=t.indexOf("সম্পন্ন")>-1?"done":t.indexOf("⚠")>-1?"bad":"run"})}
function go(){var v=document.getElementById("spV");if(v){new MutationObserver(mk).observe(v,{childList:true});mk()}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go()})();

/* P২-৭ Provider টিকেট: কার্ডে রঙের দাগ ও তালিকার সংখ্যা (সব id ও onclick অক্ষত) */
(function(){function cnt(id,h){var l=document.getElementById(id),el=l&&l.previousElementSibling;while(el&&el.tagName!=="H1")el=el.previousElementSibling;if(el)el.setAttribute("data-count",l.querySelectorAll(".card").length)}
function mk(){[].forEach.call(document.querySelectorAll("#ptReplies .card"),function(c){c.dataset.k=/Human/.test(c.textContent)?"human":"ai"});
[].forEach.call(document.querySelectorAll("#ptReqs .card"),function(c){c.dataset.ok=/needs_manual|failed|error/i.test(c.textContent)?"0":"1"});
var h=document.querySelectorAll("#ptPane>h1");if(h[1])h[1].setAttribute("data-count",document.querySelectorAll("#ptReplies .card").length);if(h[2])h[2].setAttribute("data-count",document.querySelectorAll("#ptReqs .card").length)}
function go(){["ptReplies","ptReqs"].forEach(function(i){var e=document.getElementById(i);if(e)new MutationObserver(mk).observe(e,{childList:true})});mk()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go()})();

/* ===== ভাঁজ করা প্যানেল: সার্ভিস পাতার ওপরের চার বাক্স ও অর্ডারের "আজকের অবস্থা" (মোবাইলে ডিফল্ট বন্ধ; পছন্দ মনে রাখে) ===== */
(function () {
  var KEY = "pb_fold_";
  var mob = function () { return matchMedia("(max-width:860px)").matches; };
  var get = function (k) { try { return localStorage.getItem(KEY + k); } catch (e) { return null; } };
  var put = function (k, v) { try { localStorage.setItem(KEY + k, v); } catch (e) {} };
  function init() {
    [["stuckBox", ".st-head"], ["healthBox", ".st-head"], ["mrBox", "b"], ["bkBox", "b"]].forEach(function (b) {
      var box = document.getElementById(b[0]); if (!box) return;
      var h = box.querySelector(":scope > " + b[1]); if (!h) return;
      var s = get(b[0]), closed = s === null ? mob() : s === "1";
      box.classList.add("foldable"); box.classList.toggle("fold", closed);
      h.classList.add("fold-h"); h.setAttribute("role", "button"); h.tabIndex = 0; h.setAttribute("aria-expanded", String(!closed));
      var t = function (e) {
        if (e.target.closest && e.target.closest("button,a,input,select,textarea")) return;
        var c = box.classList.toggle("fold"); h.setAttribute("aria-expanded", String(!c)); put(b[0], c ? "1" : "0");
      };
      h.addEventListener("click", t);
      h.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); t(e); } });
    });
    var d = document.getElementById("dashBox");
    if (d) {
      var s2 = get("dashBox");
      if (s2 === null) { if (mob()) d.open = false; } else d.open = s2 === "0";
      setTimeout(function () { d.addEventListener("toggle", function () { put("dashBox", d.open ? "0" : "1"); }); }, 80);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

/* ===== P২-৮ OrderActions লগ: ধরন/ফলাফলের চিপ, হিসাবের টাইল, কার্ডে ফলাফলের দাগ (সব id ও onclick অক্ষত; আসল select লুকানো থাকে, চিপ সেটাকেই চালায়) ===== */
(function () {
  function chips(sel, cls, labels) {
    var s = document.getElementById(sel); if (!s) return null;
    var w = document.createElement("div"); w.className = "oa-chips"; w.setAttribute("role", "group"); w.setAttribute("aria-label", s.id === "oaType" ? "ধরন" : "ফলাফল");
    [].forEach.call(s.options, function (o) {
      var b = document.createElement("button"); b.type = "button"; b.className = "oa-chip " + (o.value === "ok" ? "ok" : o.value === "fail" ? "fail" : "");
      b.textContent = labels[o.value] || o.textContent; b.dataset.v = o.value;
      b.onclick = function () { s.value = o.value; s.dispatchEvent(new Event("change")); sync(); };
      w.appendChild(b);
    });
    s.parentNode.insertBefore(w, s.nextSibling);
    return w;
  }
  function sync() {
    [["oaType"], ["oaResult"]].forEach(function (p) {
      var s = document.getElementById(p[0]); if (!s) return;
      var w = s.nextElementSibling; if (!w || !w.classList.contains("oa-chips")) return;
      [].forEach.call(w.children, function (b) { b.classList.toggle("on", b.dataset.v === s.value); });
    });
  }
  function tiles() {
    var el = document.getElementById("oaSummary"), tl = document.getElementById("oaTiles"); if (!el || !tl) return;
    var t = el.textContent, m = /সর্বশেষ\s+(\d+).*Refill ok (\d+) \/ fail (\d+) · Cancel (\d+) · Cancel অনুরোধ (\d+)/.exec(t);
    if (!m) { tl.innerHTML = ""; document.getElementById("oaCap").textContent = t; return; }
    var f = +m[3];
    tl.innerHTML = '<div class="g"><b>' + m[2] + '</b><span>Refill ok</span></div><div class="r' + (f ? "" : " z") + '"><b>' + f + '</b><span>Refill fail</span></div><div><b>' + m[4] + '</b><span>Cancel</span></div><div><b>' + m[5] + '</b><span>Cancel অনুরোধ</span></div>';
    document.getElementById("oaCap").textContent = "সর্বশেষ " + m[1] + "টি লগ থেকে";
  }
  function marks() {
    [].forEach.call(document.querySelectorAll("#oaList .card"), function (c) {
      var r = c.querySelector(".row span[style]"), t = r ? r.textContent.trim().toLowerCase() : "";
      c.dataset.r = t === "fail" ? "fail" : t === "ok" ? "ok" : "";
    });
  }
  function init() {
    var p = document.getElementById("actionsPane"), sum = document.getElementById("oaSummary"), list = document.getElementById("oaList");
    if (!p || !sum || !list) return;
    chips("oaType", "", { All: "সব", refill: "🔄 Refill", cancel: "❌ Cancel", cancel_request: "📨 অনুরোধ" });
    chips("oaResult", "", { All: "সব ফলাফল", ok: "✔ ok", fail: "✖ fail" });
    var tl = document.createElement("div"); tl.id = "oaTiles"; var cap = document.createElement("div"); cap.id = "oaCap";
    sum.parentNode.insertBefore(tl, sum); sum.parentNode.insertBefore(cap, sum);
    p.classList.add("oa-ready"); sync();
    new MutationObserver(tiles).observe(sum, { childList: true, characterData: true, subtree: true });
    new MutationObserver(marks).observe(list, { childList: true });
    tiles(); marks();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

/* ===== P২-৯ সাইট থিম: প্রতিটি কার্ডে ছোট প্রিভিউ (সব id, name, onclick অক্ষত; পুরোনো রঙের বাক্স CSS-এ লুকানো) ===== */
(function () {
  var cls = { premium: "th-prem", light: "th-lite", toggle: "th-tog" };
  function init() {
    var box = document.getElementById("themeOpts"); if (!box) return;
    [].forEach.call(box.querySelectorAll(".thOpt"), function (l) {
      if (l.querySelector(".th-prev")) return;
      var p = document.createElement("span");
      p.className = "th-prev " + (cls[l.getAttribute("data-mode")] || "");
      p.setAttribute("aria-hidden", "true");
      p.innerHTML = '<i class="n"></i><i class="c1"></i><i class="c2"></i><i class="b"></i>';
      var inp = l.querySelector("input"); l.insertBefore(p, inp ? inp.nextSibling : l.firstChild);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

/* ===== P২-১০ অ্যাক্টিভিটি লগ: অ্যাকশন চিপ, হিসাবের টাইল, ব্যর্থ এন্ট্রিতে লাল দাগ (সব id ও onclick অক্ষত; loadAdminLog-এর রেন্ডারে হাত দেওয়া হয়নি) ===== */
(function () {
  var seen = [];
  function chips() {
    var w = document.getElementById("logChips"), a = document.getElementById("logAct"); if (!w || !a) return;
    var cur = a.value.trim();
    var items = [""].concat(seen.slice(0, 12));
    if (cur && seen.indexOf(cur) < 0) items.splice(1, 0, cur);
    w.innerHTML = "";
    items.forEach(function (v) {
      var b = document.createElement("button"); b.type = "button"; b.className = "lg-chip" + (v === cur ? " on" : "");
      b.textContent = v || "সব অ্যাকশন"; b.onclick = function () { a.value = v; if (typeof loadAdminLog === "function") loadAdminLog(); };
      w.appendChild(b);
    });
  }
  function update() {
    var cards = [].slice.call(document.querySelectorAll("#logList .card")), fail = 0, users = {};
    cards.forEach(function (c) {
      var o = c.querySelector(".oid"), n = c.querySelector(".row.muted"), u = c.querySelector(".row b");
      var bad = n && /^\s*FAIL/.test(n.textContent); c.dataset.r = bad ? "fail" : "";
      if (bad) fail++;
      if (u) users[u.textContent.replace(/^\s*👤\s*/, "").trim()] = 1;
      var v = o && o.textContent.trim(); if (v && seen.indexOf(v) < 0) seen.push(v);
    });
    var tl = document.getElementById("logTiles"), cap = document.getElementById("logCap"), cnt = document.getElementById("logCount");
    if (tl) tl.innerHTML = cards.length ? '<div><b>' + cards.length + '</b><span>এন্ট্রি</span></div><div class="r' + (fail ? "" : " z") + '"><b>' + fail + '</b><span>ব্যর্থ</span></div><div><b>' + Object.keys(users).length + '</b><span>ব্যবহারকারী</span></div>' : "";
    if (cap) cap.textContent = cards.length && cnt ? cnt.textContent : "";
    chips();
  }
  function init() {
    var p = document.getElementById("logPane"), list = document.getElementById("logList"), tb = p && p.querySelector(".toolbar"); if (!p || !list || !tb) return;
    var ch = document.createElement("div"); ch.id = "logChips"; ch.className = "lg-chips"; ch.setAttribute("role", "group"); ch.setAttribute("aria-label", "অ্যাকশন");
    var tl = document.createElement("div"); tl.id = "logTiles"; var cap = document.createElement("div"); cap.id = "logCap";
    list.parentNode.insertBefore(ch, list); list.parentNode.insertBefore(tl, list); list.parentNode.insertBefore(cap, list);
    new MutationObserver(update).observe(list, { childList: true });
    var a = document.getElementById("logAct"); if (a) a.addEventListener("input", chips);
    chips();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

/* ===== P৪ নোটিশ ব্যানার: অ্যাডমিন পাতা (অ্যাকশন admin_notice_get / admin_notice_save; কাস্টমার সাইট ?action=notice_get পড়ে) ===== */
(function () {
  var LV = [["info", "ℹ️ তথ্য"], ["warn", "⚠️ সতর্কতা"], ["bad", "🚫 সমস্যা"]];
  var ICON = { info: "ℹ️", warn: "⚠️", bad: "🚫" };
  var QUICK = ["সার্ভিসে ড্রপ সমস্যা চলছে, সমাধানের কাজ চলছে।", "ডেলিভারি আজ একটু ধীর, ধৈর্য ধরুন।", "রক্ষণাবেক্ষণ চলছে, কিছুক্ষণ পর আবার চেষ্টা করুন।", "কিছু সার্ভিস সাময়িক বন্ধ আছে।"];
  var cur = null;
  function $(i) { return document.getElementById(i); }
  function msg(t, c) { var m = $("noticeMsg"); if (!m) return; m.style.color = c || ""; m.textContent = t || ""; }
  function level() { return $("noticeLevel").value || "info"; }
  function setLevel(v) { $("noticeLevel").value = v; draw(); }
  function draw() {
    var t = $("noticeText"), n = $("noticeCount"), pv = $("noticePrev"); if (!t) return;
    var len = t.value.length, mx = +t.maxLength || 200;
    n.textContent = len + "/" + mx; n.parentNode.classList.toggle("full", len >= mx);
    var v = t.value.trim();
    pv.className = "ntc-banner " + (v ? level() : "empty");
    pv.textContent = v ? (ICON[level()] + " " + v) : "লিখলে এখানে ব্যানারের চেহারা দেখাবে।";
    [].forEach.call($("noticeLevels").children, function (b) { b.classList.toggle("on", b.dataset.v === level()); });
  }
  function state() {
    var s = $("noticeState"); if (!s) return;
    var on = cur && cur.on;
    s.className = "ntc-state" + (on ? " on" : "");
    s.textContent = on ? "কাস্টমার সাইটে এখন চালু আছে" + (cur.updated ? " · " + cur.updated : "") : "এখন বন্ধ, কাস্টমার কোনো নোটিশ দেখছে না";
  }
  function fill(n) {
    cur = n || { on: false, text: "", level: "info" };
    $("noticeOn").checked = !!cur.on; $("noticeText").value = cur.text || ""; $("noticeLevel").value = cur.level || "info";
    state(); draw();
  }
  window.noticeLoad = async function () {
    if (typeof adminApi !== "function") return;
    msg("লোড হচ্ছে…", "var(--muted)");
    try {
      var d = await adminApi({ action: "admin_notice_get" });
      if (!d || !d.ok) throw new Error((d && d.error) || "লোড হয়নি");
      fill(d.notice); msg("");
    } catch (e) { msg((e && e.message) || "লোড করতে সমস্যা হয়েছে।", "var(--danger)"); }
  };
  window.noticeSave = async function (off) {
    var btn = $("noticeSaveBtn"), b2 = $("noticeOffBtn"), text = $("noticeText").value.trim(), on = off === true ? false : $("noticeOn").checked;
    if (on && !text) { msg("আগে নোটিশের লেখা দিন।", "var(--danger)"); return; }
    btn.disabled = b2.disabled = true; msg("সেভ হচ্ছে…", "var(--muted)");
    try {
      var d = await adminApi({ action: "admin_notice_save", on: on, text: text, level: level() });
      if (d && d.ok) { fill(d.notice); msg(d.notice.on ? "✅ সেভ হয়েছে। কাস্টমার সাইটে এখন থেকে দেখাবে।" : (off === true ? "✅ ব্যানার বন্ধ হয়েছে।" : "সেভ হয়েছে, কিন্তু ব্যানার এখনও বন্ধ। দেখাতে \"ব্যানার চালু\" সুইচ দিয়ে আবার সেভ করুন।"), d.notice.on || off === true ? "var(--success)" : "var(--warning,#f59e0b)"); }
      else msg("সেভ হয়নি: " + ((d && d.error) || "অজানা সমস্যা"), "var(--danger)");
    } catch (e) { msg((e && e.message) || "সেভ করতে সমস্যা হয়েছে।", "var(--danger)"); }
    btn.disabled = b2.disabled = false;
  };
  function init() {
    var lw = $("noticeLevels"), qw = $("noticeQuick"), t = $("noticeText"); if (!lw || !qw || !t) return;
    LV.forEach(function (x) { var b = document.createElement("button"); b.type = "button"; b.className = "ntc-chip"; b.dataset.v = x[0]; b.textContent = x[1]; b.onclick = function () { setLevel(x[0]); }; lw.appendChild(b); });
    QUICK.forEach(function (q) { var b = document.createElement("button"); b.type = "button"; b.className = "ntc-chip q"; b.textContent = q; b.onclick = function () { t.value = q; draw(); t.focus(); }; qw.appendChild(b); });
    t.addEventListener("input", draw); fill(null);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

/* ---- P৫: প্রোভাইডার-কেন্দ্রিক হোম (অর্ডার পাতার ওপরে)। আগের কোড ছোঁয় না; admin_balances ও admin_speedtest ব্যবহার করে ---- */
(function () {
  var S = { per: "7d", busy: false, bal: null, sp: null }, PER = { "24h": 864e5, "7d": 6048e5, "30d": 2592e6 };
  var $ = function (i) { return document.getElementById(i); };
  var E = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var med = function (a) { if (!a.length) return 0; var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  function dur(m) { m = Math.round(m); if (!m || m < 0) return "—"; var d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), x = m % 60; return d ? d + "দিন " + h + "ঘ" : h ? h + "ঘ " + x + "মি" : x + "মি"; }
  function stats() {
    var P = {}, sp = S.sp || {}, now = sp.now || Date.now(), since = now - PER[S.per];
    (sp.rows || []).forEach(function (r) {
      if (!r.provider || !r.provider_order || r.ordered_at < since) return;
      var p = P[r.provider] || (P[r.provider] = { n: 0, ok: 0, bad: 0, k1: [], st: [] }), s = String(r.status || "").toLowerCase(), q = Number(r.quantity) || 0;
      p.n++;
      if (s === "completed" && r.total_secs > 0) { p.ok++; if (q > 0) p.k1.push(r.total_secs / 60 / (q / 1000)); }
      else if (s === "partial" || s === "canceled" || s === "cancelled" || s === "refunded") p.bad++;
      if (r.start_secs > 0) p.st.push(r.start_secs / 60);
    });
    return P;
  }
  function draw() {
    var box = $("phGrid"); if (!box) return;
    var P = stats(), B = {}, names = {};
    ((S.bal && S.bal.balances) || []).forEach(function (b) { B[b.provider] = b; names[b.provider] = 1; });
    Object.keys(P).forEach(function (n) { names[n] = 1; });
    var list = Object.keys(names).sort();
    if (!list.length) { box.innerHTML = '<div class="ph-note">প্রোভাইডারের তথ্য নেই। রিফ্রেশ চাপুন।</div>'; return; }
    box.innerHTML = list.map(function (n) {
      var p = P[n] || { n: 0, ok: 0, bad: 0, k1: [], st: [] }, b = B[n], fin = p.ok + p.bad, rate = fin ? Math.round(p.ok / fin * 100) : null;
      var cls = rate == null ? "" : rate >= 90 ? "g" : rate >= 70 ? "y" : "r";
      var bal = !b ? '<span class="ph-bal bad">ব্যালেন্স নেই</span>' : b.ok ? '<span class="ph-bal">' + E(Math.round(Number(b.balance) * 100) / 100) + " <small>" + E(b.currency || "") + "</small></span>" : '<span class="ph-bal bad">❌ ' + E(b.error || "ব্যর্থ") + "</span>";
      return '<div class="ph-card ' + cls + '"><div class="ph-top"><b>' + E(n) + "</b>" + bal + "</div>" +
        '<div class="ph-bar" title="সাফল্যের হার"><i style="width:' + (rate == null ? 0 : rate) + '%"></i></div>' +
        '<div class="ph-m"><div><b>' + (rate == null ? "—" : rate + "%") + "</b><span>সাফল্য</span></div><div><b>" + dur(med(p.k1)) + "</b><span>প্রতি ১কে</span></div><div><b>" + dur(med(p.st)) + "</b><span>শুরু হতে</span></div></div>" +
        '<div class="ph-note">' + p.n + "টি অর্ডার · চলছে " + (p.n - fin) + "</div></div>";
    }).join("");
  }
  async function load() {
    if (S.busy || typeof adminApi !== "function") return; S.busy = true;
    var up = $("phUpd"); if (up) up.textContent = "লোড হচ্ছে…";
    var r = await Promise.all([adminApi({ action: "admin_balances", auto_retry: false }).catch(function () { return null; }), adminApi({ action: "admin_speedtest" }).catch(function () { return null; })]);
    if (r[0] && r[0].ok) S.bal = r[0]; if (r[1] && r[1].ok) S.sp = r[1];
    draw(); S.busy = false;
    if (up) up.textContent = (r[0] && r[0].ok) || (r[1] && r[1].ok) ? "আপডেট: " + new Date().toLocaleTimeString("bn-BD", { hour: "numeric", minute: "2-digit" }) : "⚠️ লোড হয়নি। আবার চেষ্টা করুন।";
  }
  window.provHomeLoad = load;
  window.provHomePer = function (k) { S.per = k; [].forEach.call(document.querySelectorAll("#provHome .ph-chip"), function (c) { c.classList.toggle("on", c.dataset.k === k); }); draw(); };
  function init() {
    var d = $("dashBox"); if (!d || $("provHome")) return;
    var s = document.createElement("section"); s.id = "provHome"; s.setAttribute("aria-label", "প্রোভাইডার");
    s.innerHTML = '<div class="ph-head"><h2>🏭 প্রোভাইডার</h2><span class="ph-note" id="phUpd"></span><button type="button" class="ph-ref" onclick="provHomeLoad()">রিফ্রেশ</button></div>' +
      '<div class="ph-chips">' + [["24h", "২৪ ঘণ্টা"], ["7d", "৭ দিন"], ["30d", "৩০ দিন"]].map(function (x) { return '<button type="button" class="ph-chip' + (x[0] === S.per ? " on" : "") + '" data-k="' + x[0] + '" onclick="provHomePer(\'' + x[0] + '\')">' + x[1] + "</button>"; }).join("") + "</div>" +
      '<div class="ph-grid" id="phGrid" style="margin-top:8px"><div class="ph-note">লোড হচ্ছে…</div></div>';
    d.parentNode.insertBefore(s, d);
    setTimeout(load, 2500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

/* ---- P৬: লাভের রিপোর্ট (admin_profit)। লাভ = কাস্টমারের বিল − প্রোভাইডারের খরচ ---- */
(function () {
  var S = { per: "7d", by: "services", d: null, busy: false }, $ = function (i) { return document.getElementById(i); };
  var E = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var M = function (n) { n = Math.round(Number(n) || 0); return (n < 0 ? "−" : "") + "৳" + Math.abs(n).toLocaleString("bn-BD"); };
  var PER = [["today", "আজ"], ["7d", "৭ দিন"], ["30d", "৩০ দিন"], ["all", "সব"]], BY = [["services", "সার্ভিস"], ["providers", "প্রোভাইডার"], ["customers", "কাস্টমার"]];
  function day(off) { return new Date(Date.now() - off * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }); }
  function range() { return S.per === "today" ? { from: day(0), to: day(0) } : S.per === "7d" ? { from: day(6), to: day(0) } : S.per === "30d" ? { from: day(29), to: day(0) } : {}; }
  function chips(arr, cur, fn) { return '<div class="pf-chips">' + arr.map(function (x) { return '<button type="button" class="pf-chip' + (x[0] === cur ? " on" : "") + '" onclick="' + fn + "('" + x[0] + "')\">" + x[1] + "</button>"; }).join("") + "</div>"; }
  function draw() {
    var p = $("profitPane"); if (!p) return; var d = S.d, h = '<h1>📈 লাভের রিপোর্ট</h1>' + chips(PER, S.per, "profitPer");
    if (!d) { p.innerHTML = h + '<div class="pf-note">' + (S.busy ? "লোড হচ্ছে…" : "তথ্য নেই।") + "</div>"; return; }
    var t = d.total, mg = t.customer ? Math.round(t.profit / t.customer * 100) : 0, list = d[S.by] || [], mx = Math.max.apply(null, list.map(function (x) { return Math.abs(x.profit); }).concat([1]));
    h += '<div class="pf-tiles"><div><b>' + M(t.customer) + "</b><span>বিক্রি</span></div><div><b>" + M(t.cost) + '</b><span>খরচ</span></div><div class="pf-p' + (t.profit < 0 ? " neg" : "") + '"><b>' + M(t.profit) + "</b><span>লাভ</span></div><div><b>" + mg + "%</b><span>মার্জিন</span></div></div>";
    h += '<div class="pf-note">শুধু Processing / Partial / Approved / Completed অর্ডার · ' + t.orders + "টি" + (t.cost_missing ? " · ⚠️ " + t.cost_missing + "টির দাম পাওয়া যায়নি (লাভে ধরা হয়নি)" : "") + "</div>";
    h += chips(BY, S.by, "profitBy") + '<div class="pf-list">' + (list.length ? list.map(function (x) {
      var neg = x.profit < 0, m = x.customer ? Math.round(x.profit / x.customer * 100) : 0;
      return '<div class="pf-row' + (neg ? " neg" : "") + '"><div class="pf-top"><b>' + E(x.name) + (S.by === "services" ? ' <small class="muted">' + E(x.key) + "</small>" : "") + "</b><strong>" + M(x.profit) + '</strong></div><div class="pf-bar"><i style="width:' + Math.round(Math.abs(x.profit) / mx * 100) + '%"></i></div><div class="pf-sub"><span>' + x.orders + "টি অর্ডার</span><span>বিক্রি " + M(x.customer) + "</span><span>খরচ " + M(x.cost) + "</span><span>মার্জিন " + m + "%</span></div></div>";
    }).join("") : '<div class="pf-note">এই সময়ে কোনো অর্ডার নেই।</div>') + "</div>";
    p.innerHTML = h;
  }
  window.profitPer = function (k) { S.per = k; window.profitLoad(true); };
  window.profitBy = function (k) { S.by = k; draw(); };
  window.profitLoad = async function (force) {
    if (S.busy || (S.d && !force && S.loadedAt && Date.now() - S.loadedAt < 30000)) { draw(); return; }
    S.busy = true; draw();
    try { var r = await adminApi(Object.assign({ action: "admin_profit" }, range())); if (r && r.ok) { S.d = r; S.loadedAt = Date.now(); } else { S.d = null; var p = $("profitPane"); if (p) { draw(); p.insertAdjacentHTML("beforeend", '<div class="pf-note">⚠️ ' + E((r && r.error) || "ত্রুটি") + "<br>Code.gs নতুন Deploy (New version) করেছেন কি?</div>"); } S.busy = false; return; } }
    catch (e) { S.d = null; draw(); var q = $("profitPane"); if (q) q.insertAdjacentHTML("beforeend", '<div class="pf-note">⚠️ ' + E(e.message) + "</div>"); S.busy = false; return; }
    S.busy = false; draw();
  };
})();

/* ---- P৭: মোবাইলে দ্রুত অ্যাকশন। কার্ডের আসল বাটনেই .click() করে, তাই updateOrder-এর confirm, রিফান্ড ও অটো-পাবলিশ আগের মতোই চলে ---- */
(function () {
  var TH = 90, mq = window.matchMedia("(max-width:860px)");
  function btn(card, cls) { return card.querySelector(".actions ." + cls); }
  function enhance(card) {
    if (card.classList.contains("qa") || !/\bst-(pending|processing|partial)\b/.test(card.className)) return;
    var ok = btn(card, "btn-approve"), no = btn(card, "btn-reject"), top = card.querySelector(".card-top"); if (!ok || !no || !top) return;
    card.classList.add("qa");
    var pend = /\bst-pending\b/.test(card.className), okTxt = pend ? "Approve" : "Completed";
    var box = document.createElement("div"); box.className = "qa-btns";
    box.innerHTML = '<button type="button" class="qa-ok" aria-label="' + okTxt + '">' + (pend ? "✅" : "🏁") + '</button><button type="button" class="qa-no" aria-label="Reject">❌</button>';
    box.firstChild.onclick = function () { ok.click(); }; box.lastChild.onclick = function () { no.click(); };
    var pill = top.querySelector(".status-pill"); top.insertBefore(box, pill);
    var hint = document.createElement("div"); hint.className = "qa-hint"; card.insertBefore(hint, card.firstChild);
    var x0, y0, dx, mode, pid;
    function reset() { card.style.transform = ""; hint.style.opacity = 0; card.classList.remove("qa-drag"); }
    card.addEventListener("pointerdown", function (e) {
      if (!mq.matches || e.target.closest("a,button,pre,input,select,textarea") || (e.pointerType === "mouse" && e.button !== 0)) return;
      x0 = e.clientX; y0 = e.clientY; dx = 0; mode = 0; pid = e.pointerId;
    });
    card.addEventListener("pointermove", function (e) {
      if (e.pointerId !== pid || x0 == null) return;
      var mx = e.clientX - x0, my = e.clientY - y0;
      if (!mode) { if (Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.5) { mode = 1; card.classList.add("qa-drag"); try { card.setPointerCapture(pid); } catch (er) {} } else if (Math.abs(my) > 12) { x0 = null; return; } else return; }
      dx = Math.max(-140, Math.min(140, mx)); card.style.transform = "translateX(" + dx + "px)";
      hint.className = "qa-hint " + (dx > 0 ? "ok" : "no"); hint.textContent = dx > 0 ? (pend ? "✅ ছাড়লে Approve" : "🏁 ছাড়লে Completed") : "ছাড়লে Reject ❌"; hint.style.opacity = Math.min(1, Math.abs(dx) / TH);
    });
    function end(e) {
      if (e.pointerId !== pid || x0 == null) return; var d = dx, m = mode; x0 = null; reset();
      if (m && Math.abs(d) >= TH) { if (navigator.vibrate) navigator.vibrate(10); (d > 0 ? ok : no).click(); }
    }
    card.addEventListener("pointerup", end); card.addEventListener("pointercancel", function (e) { if (e.pointerId === pid) { x0 = null; reset(); } });
  }
  function scan() { var l = document.getElementById("ordersList"); if (l) [].forEach.call(l.querySelectorAll(".card"), enhance); }
  function init() { var l = document.getElementById("ordersList"); if (!l) return; new MutationObserver(scan).observe(l, { childList: true }); scan(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

/* ---- P৮: ইউজারনেম + পাসওয়ার্ড লগইন (admin_login / admin_cred)। সেশন টোকেন আগের ADMIN_TOKEN-এর জায়গাতেই বসে, তাই বাকি সব অ্যাডমিন কল অপরিবর্তিত ---- */
(function () {
  var $ = function (i) { return document.getElementById(i); };
  var E = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function lerr(t) { var e = $("loginErr"); if (e) e.textContent = t || ""; }
  window.doUserLogin = async function () {
    var u = ($("loginUser").value || "").trim(), p = $("loginPass").value || "", b = $("loginBtn");
    if (!u || !p) { lerr("ইউজারনেম ও পাসওয়ার্ড দুটোই দিন।"); return; }
    b.disabled = true; lerr("");
    try {
      var res = await fetch(API, { method: "POST", mode: "cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "admin_login", username: u, password: p }) });
      var d = await res.json();
      if (d && d.ok && d.token) { ADMIN_TOKEN = d.token; tkSave(d.token); $("loginPass").value = ""; enterPanel(); }
      else if (d && d.error === "locked_out") lerr("বারবার ভুল হওয়ায় সাময়িক লক। ১৫ মিনিট পরে চেষ্টা করুন।");
      else lerr((d && (d.message || d.error)) || "লগইন হয়নি।");
    } catch (e) { lerr("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।"); }
    b.disabled = false;
  };
  var C = { d: null };
  function msg(t, bad) { var m = $("crMsg"); if (m) { m.textContent = t || ""; m.style.color = bad ? "var(--danger)" : "var(--success)"; } }
  function draw() {
    var p = $("credPane"); if (!p) return; var d = C.d;
    var st = !d ? "লোড হচ্ছে…" : d.has_account ? "✅ চালু আছে: <b>" + E(d.user) + "</b> · চালু সেশন " + d.sessions + "টি" : "⚠️ এখনো তৈরি হয়নি। নিচে ইউজারনেম ও পাসওয়ার্ড দিন।";
    p.innerHTML = '<h1>🔑 অ্যাডমিন লগইন</h1><div class="cr-card"><div class="cr-st">' + st + '</div>' +
      '<label>ইউজারনেম<input id="crUser" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="30" value="' + E(d && d.user || "") + '" placeholder="যেমন boss.admin"></label>' +
      '<label>নতুন পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)<input id="crPass" type="password" autocomplete="new-password" maxlength="100"></label>' +
      '<label>পাসওয়ার্ড আবার<input id="crPass2" type="password" autocomplete="new-password" maxlength="100"></label>' +
      '<button type="button" class="cr-btn" id="crSave" onclick="credSave()">' + (d && d.has_account ? "পাসওয়ার্ড/নাম বদলান" : "তৈরি করুন") + '</button><div class="cr-msg" id="crMsg"></div>' +
      '<div class="cr-note">পাসওয়ার্ড বদলালে অন্য সব ডিভাইসের লগইন বন্ধ হয়। Admin token আগের মতোই কাজ করে (জরুরি ঢোকার জন্য, ইমেইল/টেলিগ্রাম লিংকেও)।</div></div>' +
      '<div class="cr-card"><button type="button" class="cr-btn alt" onclick="credLogout(false)">এই ডিভাইস থেকে লগআউট</button><button type="button" class="cr-btn alt" onclick="credLogout(true)">সব ডিভাইস থেকে লগআউট</button></div>';
  }
  window.credLoad = async function () {
    draw();
    try { var d = await adminApi({ action: "admin_cred", sub: "get" }); if (d && d.ok) { C.d = d; draw(); } else msg((d && (d.message || d.error)) || "লোড হয়নি", true); }
    catch (e) { msg(e.message, true); }
  };
  window.credSave = async function () {
    var u = ($("crUser").value || "").trim(), p = $("crPass").value || "", p2 = $("crPass2").value || "", b = $("crSave");
    if (!u || !p) { msg("ইউজারনেম ও পাসওয়ার্ড দিন।", true); return; }
    if (p !== p2) { msg("দুটো পাসওয়ার্ড মেলেনি।", true); return; }
    b.disabled = true; msg("সেভ হচ্ছে…");
    try {
      var d = await adminApi({ action: "admin_cred", sub: "set", username: u, password: p });
      if (d && d.ok) { await window.credLoad(); msg("✅ সেভ হয়েছে। এখন থেকে ইউজারনেম ও পাসওয়ার্ড দিয়ে ঢুকতে পারবেন।"); }
      else { msg((d && (d.message || d.error)) || "সেভ হয়নি", true); b.disabled = false; }
    } catch (e) { msg(e.message, true); b.disabled = false; }
  };
  window.credLogout = async function (all) {
    if (!confirm(all ? "সব ডিভাইস থেকে লগআউট করবেন?" : "এই ডিভাইস থেকে লগআউট করবেন?")) return;
    try { await adminApi({ action: "admin_cred", sub: all ? "logout_all" : "logout" }); } catch (e) {}
    try { localStorage.removeItem("pb_admin_token"); tkIdb("set", ""); } catch (e) {}
    location.reload();
  };
})();
