/* boostplus — টপ-আপ (R14: রেফারেন্স-স্টাইল কার্ড ডিজাইন; লজিক অপরিবর্তিত): প্রতিটি ধাপ আলাদা পাতা (topup-amount, topup-bkash/nagad/rocket/npsb, topup-pay, topup-result)।
   ডেটা পাঠায় সাইটের আসল ব্যাকএন্ডে (wallet_topup); ধাপগুলোর মাঝের তথ্য sessionStorage-এ থাকে।
   পেমেন্ট নম্বর/ভার্চুয়াল নম্বর বদলাতে নিচের CFG দেখুন। */
(function () {
  "use strict";
  var API = "https://script.google.com/macros/s/AKfycbxacUqhDDc_2kRsedBF_x8zTrqUhNloQryVEkKuJzDC7SAyh_po6BbxX2F0ZLrrPmhV/exec"; // app-core.js-এর BOOSTPLUS_SHEET_API-র সাথে এক রাখুন
  var CFG = { pay: "01921018882", nagadVirtual: "9856 000883905438", min: 20, minutes: 15 }; // nagadVirtual ফাঁকা রাখলে সারিটি লুকায়
  var FEE = { bkash: 18.5, nagad: 15, rocket: 17, npsb: 10 }; // প্রতি ১০০০ টাকায় ফি (৳); ব্যাকএন্ড Code.gs-এর TOPUP_FEE_PER_1000-এর সাথে এক রাখুন
  var IMG = "topup/img/", KEY = "pb_topup", TOK = "pb_wallet_token";
  var M = { bkash: { n: "bKash", c: "#d10f63" }, nagad: { n: "Nagad", c: "#e8532a" }, rocket: { n: "Rocket", c: "#8c2b8f" }, npsb: { n: "NPSB", c: "#4f46e5" } };
  var S = (function () { try { return Object.assign({ lang: "en", amt: 0, m: "", w: "bkash", sender: "", id: "", order: "", res: "", end: 0, bal: null }, JSON.parse(sessionStorage.getItem(KEY) || "{}")); } catch (e) { return { lang: "en", amt: 0, m: "", w: "bkash", sender: "", id: "", order: "", res: "", end: 0, bal: null }; } })();
  var T = null, PAGE = "", FILE = "", app = null;
  function feeOf(a, m) { var r = FEE[m] || 0; return Math.round((Number(a) || 0) * r / 1000 * 100) / 100; }
  function tot() { return Number(((Number(S.amt) || 0) + feeOf(S.amt, S.m)).toFixed(2)); }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function bn(x) { return String(x); }   // R8: Western digits
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(n) { return "৳" + bn(Number(n).toFixed(2)); }
  function token() { try { return localStorage.getItem(TOK) || ""; } catch (e) { return ""; } }
  function stop() { if (T) { clearInterval(T); T = null; } }
  function go(p) { save(); location.href = p + ".html"; }
  function back(p) { save(); location.replace(p + ".html"); }
  function reset() { S.amt = 0; S.m = ""; S.sender = ""; S.id = ""; S.order = ""; S.res = ""; S.end = 0; save(); }
  function post(body) {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null, tm = setTimeout(function () { if (ctrl) ctrl.abort(); }, 30000);
    return fetch(API, { method: "POST", mode: "cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json(); }).finally(function () { clearTimeout(tm); });
  }
  function balance() {
    if (!token()) return Promise.resolve();
    return post({ action: "wallet_auth", sub: "me", token: token() }).then(function (d) {
      if (d && d.ok && d.balance != null) { S.bal = Number(d.balance) || 0; save(); var b = document.querySelector(".bal b"); if (b) b.textContent = fmt(S.bal); var s2 = document.getElementById("s2"); if (s2) s2.textContent = fmt(S.bal + S.amt); }
    }).catch(function () {});
  }
  /* ===== R14: reference-style templates (logic below is unchanged) ===== */
  var PRESETS = [50, 100, 200, 500, 1000, 2000];
  var BONUS = null, BONUS_DONE = false;          // real bonus config (service_meta.topup_bonus); null = no bonus
  var HIST = { s: "idle", rows: [], all: false };  // payment history (wallet_auth history, ledger)
  var SVG = {
    back: '<path d="M15 18l-6-6 6-6"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.2"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    help: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M5.6 5.6l3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    hist: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4h4"/><path d="M12 8v4l3 2"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18h2"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>'
  };
  function ic(n, s) { return '<svg viewBox="0 0 24 24" width="' + (s || 18) + '" height="' + (s || 18) + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + SVG[n] + "</svg>"; }
  function bar(href) {
    return '<div class="rt-bar"><div class="rt-bar__in"><a class="rt-back" href="' + href + '" aria-label="Back">' + ic("back", 20) + '</a><div class="rt-title">Add funds</div><span class="bal">' + ic("wallet", 16) + '<span class="sr">Balance</span><b>' + (S.bal == null ? "—" : fmt(S.bal)) + "</b></span></div></div>";
  }
  function steps(i) {
    var n = ["Amount", "Payment", "Processing"];
    return '<div class="steps" role="list" aria-label="Steps">' + n.map(function (t, k) {
      var c = k < i ? "done" : k === i ? "cur" : "";
      return '<div class="st ' + c + '" role="listitem"' + (k === i ? ' aria-current="step"' : "") + "><i>" + (k < i ? ic("check", 14) : bn(k + 1)) + "</i><span>" + t + "</span></div>";
    }).join("") + "</div>";
  }
  function page(href, i, body) { return bar(href) + '<div class="rt-main">' + steps(i) + body + "</div>"; }
  function loginCard() {
    return bar("index.html") + '<div class="rt-main"><section class="rf-card rf-card--form rt-login"><span class="rf-iconsq rf-iconsq--lg">' + ic("lock", 20) + '</span><h1>Log in first</h1><p class="mu">You need to be logged in to add funds.</p><a class="rf-button rf-button--primary rf-button--lg rf-button--block" href="login.html">Log in / Register</a></section></div>';
  }
  function logoSm(k) { return '<img class="rt-ml" src="' + IMG + k + '-s.png" alt="" width="40" height="40">'; }
  function mlogo(k) { return k === "npsb" ? '<img class="rt-ml rt-ml--wide" src="' + IMG + 'npsb.svg" alt="" width="56" height="40">' : logoSm(k); }
  function stepHead(no, title, sub) { return '<div class="rf-step"><span class="rf-step__no" aria-hidden="true">' + no + '</span><div><div class="rf-step__title">' + title + '</div><div class="rf-step__sub">' + sub + "</div></div></div>"; }
  function instrText() {
    var m = S.m;
    if (!m || !M[m]) return "Select a method to see its fee and how the payment works.";
    var f = FEE[m] ? "Fee ৳" + bn(FEE[m]) + " per ৳1,000. " : "";
    var nx = m === "npsb" ? "Next, choose the wallet that receives the money, then transfer from your bank app via NPSB and add the Transaction ID." : "Next, enter your " + M[m].n + " number, send the exact total to our " + M[m].n + " number and add the Transaction ID.";
    return "Minimum top-up ৳" + bn(CFG.min) + ". " + f + nx;
  }
  function sumPanel() {
    var r = function (l, v, b) { return '<div class="rt-ro' + (b ? " rt-ro--b" : "") + '"><span>' + l + "</span><b>" + v + "</b></div>"; };
    return '<div class="rf-panel rt-sumbox">' + r("Amount", fmt(S.amt)) + r("Fee", fmt(feeOf(S.amt, S.m))) + r("Total to send", fmt(tot()), 1) + "</div>";
  }
  function bonusFor(a) {
    var out = { bonus: 0, percent: 0 };
    if (!BONUS || !BONUS.tiers || !BONUS.tiers.length) return out;
    var best = null; BONUS.tiers.slice().sort(function (x, y) { return x.min - y.min; }).forEach(function (t) { if (a >= t.min) best = t; });
    if (best) { out.percent = best.percent; out.bonus = Math.floor(a * best.percent / 100); }   // same rule as the backend (topupBonusFor_)
    return out;
  }
  function bonusUI() {
    var on = !!(BONUS && BONUS.tiers && BONUS.tiers.length), sc = document.getElementById("sumc"); if (!sc) return;
    sc.classList.toggle("has-bonus", on);
    var bc = document.getElementById("bcell"); if (bc) bc.hidden = !on;
    Array.prototype.forEach.call(document.querySelectorAll(".rt-bn"), function (el) {
      var b = on ? bonusFor(Number(el.getAttribute("data-b"))) : null;
      if (b && b.bonus > 0) { el.textContent = "+৳" + bn(b.bonus) + " bonus"; el.hidden = false; } else { el.textContent = ""; el.hidden = true; }
    });
    var cur = bonusFor(Number(S.amt) || 0), sb = document.getElementById("sb"), sg = document.getElementById("sg");
    if (sb) sb.textContent = on && S.amt > 0 && cur.bonus > 0 ? "+৳" + bn(cur.bonus) : "—";
    if (sg) sg.textContent = fmt((Number(S.amt) || 0) + (on ? cur.bonus : 0));
  }
  function loadBonus() {
    if (BONUS_DONE) { bonusUI(); return; }
    BONUS_DONE = true;
    try { var c = JSON.parse(sessionStorage.getItem("pb_topup_bonus") || "null"); if (c && Date.now() - c.t < 600000) { BONUS = c.v; bonusUI(); return; } } catch (e) {}
    fetch(API + "?action=service_meta").then(function (r) { return r.json(); }).then(function (d) {
      BONUS = (d && d.ok && d.topup_bonus && d.topup_bonus.active && Array.isArray(d.topup_bonus.tiers) && d.topup_bonus.tiers.length) ? d.topup_bonus : null;
      try { sessionStorage.setItem("pb_topup_bonus", JSON.stringify({ t: Date.now(), v: BONUS })); } catch (e) {}
      bonusUI();
    }).catch(function () { bonusUI(); });
  }
  function isFund(r) { var a = Number(r.amount) || 0, t = String(r.type || "").toLowerCase(); return a > 0 && (t === "topup" || t === "adjust"); }
  function histTitle(r) { var t = String(r.type || "").toLowerCase(), ref = String(r.ref || ""); return t === "topup" ? "Top-up" : /-BONUS$/.test(ref) ? "Top-up bonus" : "Balance added"; }
  function histUI() {
    var el = document.getElementById("hist"); if (!el) return;
    if (HIST.s === "idle" || HIST.s === "loading") { el.innerHTML = '<div class="mu rt-pad">Loading…</div>'; return; }
    if (HIST.s === "err") { el.innerHTML = '<div class="mu rt-pad">Could not load your history.</div><button type="button" class="rf-button rf-button--soft rf-button--sm" data-hretry="1">Try again</button>'; return; }
    if (!HIST.rows.length) { el.innerHTML = '<div class="mu rt-pad">No top-ups yet. Your first payment will show up here.</div>'; return; }
    var rows = HIST.all ? HIST.rows : HIST.rows.slice(0, 5);
    el.innerHTML = rows.map(function (r) {
      var when = String(r.created_at || "").slice(0, 19).replace("T", " "), id = String(r.ref || r.id || "").replace(/-BONUS$/, "");
      return '<div class="rt-h"><div class="rt-h__top"><span class="rf-iconsq">' + ic("wallet", 16) + '</span><div class="rt-h__t">' + esc(histTitle(r)) + '</div><span class="rt-pill">+৳' + bn((Number(r.amount) || 0).toFixed(2)) + '</span></div><div class="rt-h__chips">' + (id ? '<span class="rf-chip rf-chip--id">' + esc(id) + "</span>" : "") + (when ? '<span class="rf-chip rf-chip--date">' + esc(when) + "</span>" : "") + "</div></div>";
    }).join("") + (HIST.rows.length > 5 ? '<button type="button" class="rf-button rf-button--soft rf-button--sm rt-more" data-hall="1">' + (HIST.all ? "Show less" : "Show all (" + bn(HIST.rows.length) + ")") + "</button>" : "");
  }
  function loadHistory() {
    if (HIST.s === "loading" || HIST.s === "ok") { histUI(); return; }
    if (!token()) return;
    HIST.s = "loading"; histUI();
    post({ action: "wallet_auth", sub: "history", token: token(), limit: 1, ledger_limit: 100 }).then(function (d) {
      if (!d || !d.ok) { HIST.s = "err"; histUI(); return; }
      HIST.rows = (d.ledger || []).filter(isFund); HIST.s = "ok"; histUI();
    }).catch(function () { HIST.s = "err"; histUI(); });
  }
  var R = {
    amount: function () {
      var q = PRESETS.map(function (a) { return '<button type="button" class="chip" data-q="' + a + '" aria-pressed="' + (S.amt === a) + '"><b>৳' + bn(a) + '</b><span class="rt-bn" data-b="' + a + '" hidden></span></button>'; }).join("");
      var ms = Object.keys(M).map(function (k) { return '<button type="button" class="m" data-m="' + k + '" aria-pressed="' + (S.m === k) + '">' + mlogo(k) + '<span class="rt-mn">' + M[k].n + "</span></button>"; }).join("");
      var gk = function (ico, tone, t, s) { return '<div class="rf-row"><span class="rf-iconsq rf-iconsq--' + tone + '">' + ic(ico, 16) + '</span><div class="rf-row__body"><div class="rf-row__title">' + t + '</div><div class="rf-row__sub">' + s + "</div></div></div>"; };
      return page("index.html", 0,
        '<section class="rf-card rf-card--form" aria-label="Method">' + stepHead(1, "Method", "Choose how you want to pay") + '<div class="rt-methods" role="group" aria-label="Payment method">' + ms + '</div><div class="rf-micro rt-mt">Instruction</div><div class="rf-panel rt-instr" id="instr">' + instrText() + "</div></section>" +
        '<section class="rf-card rf-card--form" aria-label="Amount">' + stepHead(2, "Amount", "Enter the amount you want to add") +
          '<label class="rf-label" for="amt">Amount (BDT)</label><div class="rf-field rf-field--lg rt-amt"><b aria-hidden="true">৳</b><input id="amt" type="number" inputmode="numeric" placeholder="0" value="' + (S.amt || "") + '"></div><div class="rf-hint" id="hint">Minimum ৳' + bn(CFG.min) + "</div>" +
          '<div class="rt-ro rt-mt"><span id="fl">Fee</span><b id="s3">' + fmt(feeOf(S.amt, S.m)) + '</b></div><div class="rt-ro"><span>Total to send</span><b id="s4">' + fmt(tot()) + '</b></div><div class="rt-ro"><span>Balance after top-up</span><b id="s2">' + (S.bal == null ? "—" : fmt(S.bal + S.amt)) + "</b></div>" +
          '<div class="rt-quick rt-mt"><div class="rf-micro">Quick amount</div><div class="grid3">' + q + '</div><div class="rt-sum" id="sumc"><div><span>Amount</span><b id="s1">' + fmt(S.amt) + '</b></div><div id="bcell" hidden><span>Bonus</span><b class="rt-g" id="sb">—</b></div><div><span>You get</span><b class="rt-p" id="sg">' + fmt(S.amt) + "</b></div></div></div>" +
          '<button type="button" class="rf-button rf-button--primary rf-button--lg rf-button--block rt-mt" id="go" disabled>' + ic("lock", 16) + " Pay</button></section>" +
        '<section class="rf-card rf-card--form" aria-label="Good to know"><div class="rf-step"><span class="rf-iconsq rf-iconsq--lg">' + ic("info", 20) + '</span><div><div class="rf-step__title">Good to know</div></div></div>' +
          gk("clock", "green", "Added after verification", "Your balance is added as soon as the payment is verified.") + gk("receipt", "purple", "Keep your Transaction ID", "Do not delete it until the balance is added.") + gk("help", "amber", "Payment problem?", '<a href="index.html#tickets">Open a ticket</a> and we will check it.') + "</section>" +
        '<section class="rf-card rf-card--form" aria-label="Payment history"><div class="rf-step"><span class="rf-iconsq rf-iconsq--lg">' + ic("hist", 20) + '</span><div><div class="rf-step__title">Payment history</div><div class="rf-step__sub">Your recent top-ups and bonuses</div></div></div><div id="hist" aria-live="polite"></div></section>');
    },
    npsb: function () {
      var ws = ["bkash", "nagad", "rocket"].map(function (k) { return '<button type="button" class="m rt-w" data-w="' + k + '" aria-pressed="' + (S.w === k) + '">' + logoSm(k) + '<span class="rt-mn">' + M[k].n + "</span></button>"; }).join("");
      return page("topup-amount.html", 0, '<section class="rf-card rf-card--form">' + stepHead(3, "NPSB transfer", "Choose which wallet the money goes to") + '<div class="grid3">' + ws + "</div>" + sumPanel() + '<div class="grid2 rt-mt"><a class="rf-button rf-button--outline rf-button--lg" href="topup-amount.html">Back</a><button type="button" class="rf-button rf-button--primary rf-button--lg" id="ok">Continue</button></div></section>');
    },
    wallet: function () {
      var m = S.m, n = M[m] ? M[m].n : "", okv = /^01\d{9}$/.test(S.sender);
      return page("topup-amount.html", 0, '<section class="rf-card rf-card--form"><div class="rf-step"><span class="rt-mlw">' + logoSm(m) + '</span><div><div class="rf-step__title">Your ' + n + ' number</div><div class="rf-step__sub">The number you will send money from</div></div></div>' +
        '<label class="rf-label" for="sn">' + n + ' account number</label><input class="rf-field rf-field--lg" id="sn" type="tel" inputmode="numeric" maxlength="11" autocomplete="tel" placeholder="01XXXXXXXXX" value="' + esc(S.sender) + '"><div class="rt-err" id="er" role="alert" hidden></div>' + sumPanel() +
        '<p class="rf-hint rt-terms">By continuing you agree to our <a href="terms.html">Terms and Conditions</a>.</p><div class="grid2 rt-mt"><a class="rf-button rf-button--outline rf-button--lg" href="topup-amount.html">Back</a><button type="button" class="rf-button rf-button--primary rf-button--lg" id="ok"' + (okv ? "" : " disabled") + ">Continue</button></div></section>");
    },
    pay: function () {
      var m = S.m, k = m === "npsb" ? S.w : m;
      var rows = function (l, v, id) { return '<div class="rt-copy"><div><div class="rt-lb">' + l + '</div><b>' + v + '</b></div><button type="button" class="cp" data-c="' + id + '">Copy</button></div>'; };
      var qk = k === "rocket" ? "qr_r.png" : "qr_b.png";
      var sc = m === "npsb" ? "Send via NPSB from your bank app to the " + M[k].n + " number below" : "Scan the QR code, or Send Money to the number below";
      var qb = (m === "nagad" || m === "npsb") ? '<div class="rf-panel rt-how">' + (m === "npsb" ? sc : "Open the Nagad app and <u>Send Money</u> to the number below, exactly this amount") + "</div>" : '<div class="qr"><img src="' + IMG + qk + '" alt="' + (k === "rocket" ? "Rocket QR" : "bKash QR") + '" width="' + (k === "rocket" ? "220" : "280") + '"><span>' + sc + "</span></div>";
      var extra = (k === "nagad" && CFG.nagadVirtual) ? rows("Nagad virtual number", CFG.nagadVirtual, "v") : "";
      if (!S.end) { S.end = Date.now() + CFG.minutes * 60000; save(); }
      return page("topup-amount.html", 1, '<section class="rf-card rf-card--form"><div class="rt-paytop"><div><div class="rf-step__sub">Boost Plus · Add funds</div><h1>Send Money via ' + M[m].n + '</h1></div><b class="rt-big">' + fmt(tot()) + "</b></div>" + qb +
        rows(M[k].n + " personal number (Send Money)", CFG.pay, "n") + extra + rows("Send exactly this amount", "৳" + bn(tot()), "a") +
        '<div class="rt-cd" id="cd" aria-live="off">' + bn(CFG.minutes) + ':00 — pay within this time</div><label class="rf-label" for="tx">Transaction ID</label><input class="rf-field rf-field--lg" id="tx" placeholder="e.g. 8N7002M4RB" value="' + esc(S.id) + '" autocomplete="off" autocapitalize="characters"><div class="e2" id="er" role="alert"></div>' +
        '<div class="rt-btns"><button type="button" class="rf-button rf-button--primary rf-button--lg rf-button--block" id="vf">Verify payment</button><a class="rf-button rf-button--outline rf-button--lg rf-button--block" href="topup-amount.html">Choose another method</a></div></section>');
    },
    result: function () {
      stop();
      var r = S.res || "pending", o = {
        success: ["ok", "M22 37l10 10 18-20", "Top-up complete", "Balance has been added to your wallet"],
        pending: ["warn", "M36 20v18l10 6", "Pending, verification in progress", "Your top-up request has been submitted. Balance is added automatically once the payment is verified. Keep this page open to see the update here."],
        failed: ["bad", "M24 24l24 24M48 24L24 48", "Verification failed", "The Transaction ID or amount did not match. Try again or contact support."],
        expired: ["bad", "M24 24l24 24M48 24L24 48", "Time expired", bn(CFG.minutes) + " minutes have passed. Please start again."]
      }[r] || ["warn", "", "", ""];
      var mn = S.m && M[S.m] ? M[S.m].n : "";
      var dr = function (l, v) { return '<div class="rt-ro"><span>' + l + "</span><b>" + v + "</b></div>"; };
      var det = (r === "success" || r === "pending") ? '<div class="rf-panel rt-sumbox">' + dr(r === "success" ? "Added" : "Will be added", fmt(S.amt)) + (r === "success" ? dr("New balance", S.bal == null ? "—" : fmt(S.bal)) : dr("Status", '<span class="rt-w">Pending</span>')) + dr("Method", esc(mn)) + dr("Transaction ID", esc(S.id)) + (S.order ? dr("Top-up ID", esc(S.order)) : "") + "</div>" : "";
      var hb = '<a class="rf-button rf-button--outline rf-button--lg rf-button--block" href="index.html">Back to wallet</a>';
      var b2 = r === "success" ? '<button type="button" class="rf-button rf-button--primary rf-button--lg rf-button--block" data-new="1">New top-up</button>' + hb
        : r === "pending" ? hb
        : r === "failed" ? '<button type="button" class="rf-button rf-button--primary rf-button--lg rf-button--block" data-retry="1">Try again</button>' + hb
        : '<button type="button" class="rf-button rf-button--primary rf-button--lg rf-button--block" data-new="1">Try again</button>' + hb;
      return page("index.html", 2, '<section class="rf-card rf-card--form"><div class="res rt-res--' + o[0] + '"><svg width="72" height="72" viewBox="0 0 72 72" role="img" aria-label="' + o[2] + '"><circle cx="36" cy="36" r="34" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-width="2"/><path d="' + o[1] + '" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><h1>' + o[2] + '</h1><div class="mu">' + o[3] + "</div></div>" + det + '<div class="rt-btns">' + b2 + "</div></section>");
    }
  };
  function view() { return R[PAGE](); }
  function guard() {
    if (PAGE === "amount") return "";
    var okAmt = S.amt >= CFG.min && S.m;
    if (PAGE === "result") return S.res ? "" : "topup-amount";
    if (!okAmt) return "topup-amount";
    if (PAGE === "pay") return (S.m !== "npsb" && !/^01\d{9}$/.test(S.sender)) ? "topup-" + S.m : "";
    return FILE === S.m ? "" : "topup-" + S.m;   // নম্বর-পাতা শুধু বাছাই করা মেথডেরটাই
  }
  function render(keep) {
    if (!token()) { app.innerHTML = loginCard(); return; }
    app.innerHTML = view(); if (!keep) window.scrollTo(0, 0); after();
  }
  function after() {
    var g = document.getElementById("go");
    if (PAGE === "amount") {
      var a = document.getElementById("amt"), sync = function () {
        S.amt = Number(a.value) || 0; save();
        document.getElementById("s1").textContent = fmt(S.amt);
        document.getElementById("s2").textContent = S.bal == null ? "—" : fmt(S.bal + S.amt);
        document.getElementById("s3").textContent = fmt(feeOf(S.amt, S.m));
        document.getElementById("s4").textContent = fmt(tot());
        document.getElementById("fl").textContent = FEE[S.m] ? "Fee (৳" + bn(FEE[S.m]) + " per 1,000)" : "Fee";
        document.getElementById("hint").style.color = S.amt && S.amt < CFG.min ? "var(--bad)" : "";
        g.disabled = !(S.amt >= CFG.min && S.m);
        Array.prototype.forEach.call(document.querySelectorAll(".chip[data-q]"), function (c) { c.setAttribute("aria-pressed", String(Number(c.getAttribute("data-q")) === S.amt)); });
        bonusUI();
      };
      a.addEventListener("input", sync); sync(); loadBonus(); loadHistory();
    }
    if (PAGE === "pay") {
      var cd = document.getElementById("cd");
      var tick = function () {
        var l = Math.max(0, S.end - Date.now()), s = Math.floor(l / 1000);
        cd.textContent = bn(("0" + Math.floor(s / 60)).slice(-2) + ":" + ("0" + s % 60).slice(-2)) + " left to pay";
        if (!l) { stop(); S.res = "expired"; S.end = 0; go("topup-result"); }
      };
      tick(); T = setInterval(tick, 1000);
    }
    if (PAGE === "result" && S.res === "pending" && S.order) {
      var tries = 0;
      T = setInterval(function () {
        tries++; if (tries > 225) { stop(); return; }
        fetch(API + "?order_id=" + encodeURIComponent(S.order)).then(function (r) { return r.json(); }).then(function (d) {
          var st = String((d && d.status) || "").toLowerCase();
          if (st === "completed") { stop(); S.res = "success"; save(); balance().then(function () { render(); }); }
          else if (st === "rejected" || st === "canceled" || st === "cancelled") { stop(); S.res = "failed"; save(); render(); }
        }).catch(function () {});
      }, 8000);
    }
  }
  function err(m) { var e = document.getElementById("er"); if (e) { e.textContent = m; e.hidden = false; } }
  function readSender() {
    var sn = document.getElementById("sn"); if (sn) S.sender = sn.value.replace(/\D/g, "");
    var cl = document.querySelectorAll("#cells input"); if (cl.length) S.sender = Array.prototype.map.call(cl, function (i) { return i.value; }).join("");
  }
  function onClick(e) {
    var t = e.target.closest("button"); if (!t) return;
    if (t.dataset.lang) { readSender(); S.lang = t.dataset.lang; save(); render(true); }
    else if (t.dataset.q) { S.amt = Number(t.dataset.q); save(); render(true); }
    else if (t.dataset.m) { S.m = t.dataset.m; S.sender = ""; var a = document.getElementById("amt"); if (a) S.amt = Number(a.value) || 0; save(); render(true); }
    else if (t.dataset.w) { S.w = t.dataset.w; save(); render(true); }
    else if (t.dataset.hall) { HIST.all = !HIST.all; histUI(); }
    else if (t.dataset.hretry) { HIST.s = "idle"; loadHistory(); }
    else if (t.dataset.new) { reset(); go("topup-amount"); }
    else if (t.dataset.retry) { S.res = ""; S.id = ""; S.end = 0; go("topup-pay"); }
    else if (t.id === "go") { go("topup-" + S.m); }
    else if (t.id === "ok") {
      if (S.m === "npsb") { S.end = 0; go("topup-pay"); return; }
      readSender();
      if (!/^01\d{9}$/.test(S.sender)) { err("Enter an 11-digit number starting with 01"); return; }
      S.end = 0; go("topup-pay");
    }
    else if (t.dataset.c) {
      var v = { n: CFG.pay, a: String(tot()), v: CFG.nagadVirtual }[t.dataset.c];
      try { navigator.clipboard.writeText(v); } catch (x) {}
      t.textContent = "Copied"; setTimeout(function () { t.textContent = "Copy"; }, 1500);
    }
    else if (t.id === "vf") verify(t);
  }
  function verify(btn) {
    var id = document.getElementById("tx").value.trim(), e2 = document.getElementById("er");
    e2.textContent = "";
    if (id.length < 6) { e2.textContent = "Enter a valid Transaction ID (at least 6 characters)"; return; }
    btn.disabled = true; btn.textContent = "Submitting…";
    post({ action: "wallet_topup", token: token(), amount: S.amt, paid_from: M[S.m].n, txn_id: id, sender: S.sender || "", comments: (S.m === "npsb" ? "NPSB→" + M[S.w].n : "") })
      .then(function (d) {
        if (!d || !d.ok) { e2.textContent = (d && (d.message || d.error)) || "Top-up failed"; btn.disabled = false; btn.textContent = "Verify payment"; return; }
        stop(); S.id = id; S.order = d.order_id || ""; S.end = 0;
        if (d.status === "Completed") { S.res = "success"; if (d.balance != null) S.bal = Number(d.balance) || 0; } else S.res = "pending";
        go("topup-result");
      })
      .catch(function (x) { e2.textContent = x && x.name === "AbortError" ? "The server is not responding. Please try again in a moment." : "Network problem. Check your internet and try again."; btn.disabled = false; btn.textContent = "Verify payment"; });
  }
  function onInput(e) {
    var t = e.target;
    if (t.id === "sn") { t.value = t.value.replace(/\D/g, ""); var o = document.getElementById("ok"); if (o) o.disabled = !/^01\d{9}$/.test(t.value); var e1 = document.getElementById("er"); if (e1) e1.hidden = true; }
    if (t.dataset && t.dataset.i !== undefined) { t.value = t.value.replace(/\D/g, ""); var i = +t.dataset.i; var l = t.parentNode.querySelectorAll("input"); if (t.value && i < 10) l[i + 1].focus(); }
  }
  function onKey(e) { var t = e.target; if (t.dataset && t.dataset.i !== undefined && e.key === "Backspace" && !t.value && +t.dataset.i > 0) t.parentNode.querySelectorAll("input")[+t.dataset.i - 1].focus(); }
  window.PBT = {
    page: function (name) {
      FILE = name; PAGE = (name === "bkash" || name === "rocket" || name === "nagad") ? "wallet" : name; app = document.getElementById("app");
      if (PAGE === "amount") {
        var q = /[?&]amt=(\d+)/.exec(location.search); S.res = ""; S.id = ""; S.order = ""; S.end = 0;
        if (q && Number(q[1]) >= CFG.min) S.amt = Number(q[1]);
        var mm = /[?&]m=(bkash|nagad|rocket|npsb)\b/.exec(location.search); if (mm) { S.m = mm[1]; S.sender = ""; }
      }
      var to = token() ? guard() : ""; if (to) { back(to); return; }
      app.addEventListener("click", onClick); app.addEventListener("input", onInput); app.addEventListener("keydown", onKey);
      save(); render(); balance();
    }
  };
})();
