/* boostplus — টপ-আপ: প্রতিটি ধাপ আলাদা পাতা (topup-amount, topup-bkash/nagad/rocket/npsb, topup-pay, topup-result)।
   ডেটা পাঠায় সাইটের আসল ব্যাকএন্ডে (wallet_topup); ধাপগুলোর মাঝের তথ্য sessionStorage-এ থাকে।
   পেমেন্ট নম্বর/ভার্চুয়াল নম্বর বদলাতে নিচের CFG দেখুন। */
(function () {
  "use strict";
  var API = "https://script.google.com/macros/s/AKfycbxacUqhDDc_2kRsedBF_x8zTrqUhNloQryVEkKuJzDC7SAyh_po6BbxX2F0ZLrrPmhV/exec"; // app-core.js-এর BOOSTPLUS_SHEET_API-র সাথে এক রাখুন
  var CFG = { pay: "01921018882", nagadVirtual: "9856 000883905438", min: 20, minutes: 15 }; // nagadVirtual ফাঁকা রাখলে সারিটি লুকায়
  var FEE = { bkash: 18.5, nagad: 15, rocket: 17, npsb: 10 }; // প্রতি ১০০০ টাকায় ফি (৳); ব্যাকএন্ড Code.gs-এর TOPUP_FEE_PER_1000-এর সাথে এক রাখুন
  var IMG = "topup/img/", KEY = "pb_topup", TOK = "pb_wallet_token";
  var M = { bkash: { n: "bKash", c: "#d10f63" }, nagad: { n: "Nagad", c: "#e8532a" }, rocket: { n: "Rocket", c: "#8c2b8f" }, npsb: { n: "NPSB", c: "#4f46e5" } };
  var S = (function () { try { return Object.assign({ lang: "bn", amt: 0, m: "", w: "bkash", sender: "", id: "", order: "", res: "", end: 0, bal: null }, JSON.parse(sessionStorage.getItem(KEY) || "{}")); } catch (e) { return { lang: "bn", amt: 0, m: "", w: "bkash", sender: "", id: "", order: "", res: "", end: 0, bal: null }; } })();
  var T = null, PAGE = "", FILE = "", app = null;
  function feeOf(a, m) { var r = FEE[m] || 0; return Math.round((Number(a) || 0) * r / 1000 * 100) / 100; }
  function tot() { return Number(((Number(S.amt) || 0) + feeOf(S.amt, S.m)).toFixed(2)); }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function bn(x) { return String(x).replace(/\d/g, function (d) { return "০১২৩৪৫৬৭৮৯"[d]; }); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(n) { return "৳" + bn(Number(n).toFixed(2)); }
  function bg(v) { document.documentElement.style.background = v || ""; document.body.style.background = v || ""; }
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
  function head(i) {
    var n = ["অ্যামাউন্ট", "পেমেন্ট", "প্রসেসিং"], s = n.map(function (t, k) {
      var c = k < i ? "done" : k === i ? "cur" : "";
      return '<div class="st ' + c + '"><i>' + (k < i ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : bn(k + 1)) + "</i><span>" + t + "</span></div>";
    }).join("");
    return '<div class="top"><a class="logo" href="index.html" style="text-decoration:none;color:inherit"><img src="' + IMG + 'logo.svg" alt="" width="40" height="40">boostplus</a><span class="bal">ব্যালেন্স <b>' + (S.bal == null ? "—" : fmt(S.bal)) + '</b></span></div><div class="steps" role="list" aria-label="ধাপ">' + s + "</div>";
  }
  function loginCard() {
    bg("");
    return '<div class="w"><div class="top"><a class="logo" href="index.html" style="text-decoration:none;color:inherit"><img src="' + IMG + 'logo.svg" alt="" width="40" height="40">boostplus</a></div><div><h1>আগে লগইন করুন</h1><div class="mu">ব্যালেন্স যোগ করতে আপনার অ্যাকাউন্টে লগইন থাকতে হবে।</div></div><a class="btn" href="login.html" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-top:auto">লগইন / রেজিস্টার</a></div>';
  }
  function logoSm(k) { return '<img src="' + IMG + k + '-s.png" alt="" width="40" height="40" style="flex:none;object-fit:contain;border-radius:8px;background:#fff;padding:3px">'; }
  var R = {
    amount: function () {
      bg("");
      var q = [50, 100, 200, 500, 1000, 2000].map(function (a) { return '<button class="chip" data-q="' + a + '">৳' + bn(a) + "</button>"; }).join("");
      var ms = Object.keys(M).map(function (k) {
        var im = k === "npsb" ? '<img src="' + IMG + 'npsb.svg" alt="" width="56" height="40" style="flex:none;object-fit:contain;border-radius:8px;background:#fff;padding:4px 3px">' : logoSm(k);
        return '<button class="m" data-m="' + k + '" aria-pressed="' + (S.m === k) + '">' + im + M[k].n + "</button>";
      }).join("");
      return '<div class="w">' + head(0) + '<div><h1>ব্যালেন্স যোগ করুন</h1><div class="mu">অ্যামাউন্ট লিখুন, তারপর পেমেন্ট মেথড বাছুন</div></div><div><label class="lb" for="amt">অ্যামাউন্ট (BDT)</label><div class="card in"><b>৳</b><input id="amt" type="number" inputmode="numeric" placeholder="0" value="' + (S.amt || "") + '"></div><div class="mu" id="hint">ন্যূনতম ৳' + bn(CFG.min) + '</div></div><div class="grid3">' + q + '</div><div class="lb">পেমেন্ট মেথড</div><div class="grid2">' + ms + '</div><div class="card" style="padding:14px;display:grid;gap:8px;font-size:14px"><div class="row" style="padding:0"><span class="mu">অ্যামাউন্ট</span><b id="s1">' + fmt(S.amt) + '</b></div><div class="row" style="padding:0"><span class="mu" id="fl">ফি</span><b id="s3">' + fmt(feeOf(S.amt, S.m)) + '</b></div><div class="row" style="padding:0"><span class="mu">যোগের পর ব্যালেন্স</span><b id="s2">' + (S.bal == null ? "—" : fmt(S.bal + S.amt)) + '</b></div><div class="row" style="padding:0"><span class="mu">মোট পাঠাতে হবে</span><b id="s4">' + fmt(tot()) + '</b></div></div><button class="btn" id="go" style="margin-top:auto" disabled>এগিয়ে যান</button></div>';
    },
    npsb: function () {
      bg("");
      var ws = ["bkash", "nagad", "rocket"].map(function (k) { return '<button class="m" data-w="' + k + '" aria-pressed="' + (S.w === k) + '" style="flex-direction:column;gap:8px;height:92px;justify-content:center"><img src="' + IMG + k + '-s.png" alt="" width="36" height="36" style="flex:none;object-fit:contain;border-radius:8px;background:#fff;padding:3px">' + M[k].n + "</button>"; }).join("");
      return '<div class="w">' + head(0) + '<div><h1>NPSB ট্রান্সফার</h1><div class="mu">টাকা কোন ওয়ালেটে যাবে বাছুন</div></div><div class="grid3">' + ws + '</div><div class="grid2" style="margin-top:auto"><a class="btn ghost" href="topup-amount.html" style="display:flex;align-items:center;justify-content:center;text-decoration:none">ফিরে যান</a><button class="btn" id="ok">এগিয়ে যান</button></div></div>';
    },
    nagad: function () {
      bg("#fff");
      var en = S.lang === "en", dg = (S.sender || "").split("");
      var cells = Array.apply(null, Array(11)).map(function (_, i) { return (i == 3 || i == 7 ? "<b>-</b>" : "") + '<input aria-label="' + (en ? "Digit " : "অঙ্ক ") + bn(i + 1) + '" maxlength="1" inputmode="numeric" data-i="' + i + '" value="' + (dg[i] || "") + '">'; }).join("");
      var N = en ? { tot: "Total Amount:", am: "BDT " + tot().toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), chg: "Charge:", z: "BDT " + feeOf(S.amt, S.m).toFixed(2), lb: "Your Nagad Account Number", tc: 'By clicking/tapping "Proceed" you are agreeing to boostplus <a href="terms.html" style="color:inherit"><b>Terms and Conditions</b></a>', pr: "Proceed", cl: "Close" }
        : { tot: "মোট অ্যামাউন্ট:", am: fmt(tot()), chg: "চার্জ:", z: fmt(feeOf(S.amt, S.m)), lb: "আপনার Nagad অ্যাকাউন্ট নম্বর", tc: '"এগিয়ে যান" ক্লিক/ট্যাপ করার মাধ্যমে আপনি boostplus-এর <a href="terms.html" style="color:inherit"><b>শর্তাবলীতে</b></a> সম্মতি দিচ্ছেন।', pr: "Proceed", cl: "Close" };
      return '<div class="nd"><div class="ndc"><div class="lang" role="group" aria-label="Language"><button data-lang="bn" aria-pressed="' + !en + '">বাং</button><button data-lang="en" aria-pressed="' + en + '">Eng</button></div><div class="nbr"><img src="' + IMG + 'logo.svg" alt="" width="60" height="60"><div class="nnm">boostplus</div></div><div class="nl"><div><b>' + N.tot + "</b> " + N.am + "</div><div><b>" + N.chg + "</b> " + N.z + '</div></div><div class="nlb">' + N.lb + '</div><div class="cells" id="cells">' + cells + '</div><div class="err" id="er" hidden></div><div class="ntc">' + N.tc + '</div><div class="nbt"><button class="sm" id="ok">' + N.pr + '</button><a class="sm" href="topup-amount.html" style="display:flex;align-items:center;justify-content:center;text-decoration:none">' + N.cl + '</a></div><div class="ngl"><img src="' + IMG + 'ngd.svg" alt="নগদ Nagad"></div></div></div>';
    },
    wallet: function (m) {
      var c = { bkash: "#e2136e", rocket: "#8c2b8f" }[m], en = S.lang === "en", okv = /^01\d{9}$/.test(S.sender);
      bg("#9b9b9b");
      var T2 = en ? { lb: "Your " + M[m].n + " Account Number", ph: "e.g 01XXXXXXXXX", tc: "Confirm and proceed, ", tl: "terms & conditions", cn: "Cancel", cf: "Confirm", am: "৳" + tot().toFixed(2) }
        : { lb: "আপনার " + M[m].n + " অ্যাকাউন্ট নম্বর", ph: "যেমন 01XXXXXXXXX", tc: "নিশ্চিত করে এগিয়ে যান, ", tl: "শর্তাবলি", cn: "বাতিল", cf: "নিশ্চিত করুন", am: fmt(tot()) };
      var cart = '<span class="cart" style="background:none;width:34px;height:34px"><img src="' + IMG + 'logo.svg" alt="" width="34" height="34" style="border-radius:50%;display:block"></span>';
      var mark = m === "bkash" ? (en ? '<img src="' + IMG + 'bken.svg" alt="bKash" style="height:42px">' : '<span class="bkw" role="img" aria-label="বিকাশ"><i>বি</i>কাশ</span><img src="' + IMG + 'bkash-l.png" alt="" style="height:42px">') : '<img src="' + IMG + 'rocket-l.png" alt="' + M[m].n + '">';
      var lg = '<div class="lg" role="group" aria-label="Language"><button data-lang="bn" aria-pressed="' + !en + '">বাং</button><button data-lang="en" aria-pressed="' + en + '">EN</button></div>';
      return '<div class="bk"><div class="bkc" style="--bc:' + c + '">' + lg + '<div class="bkh">' + mark + '</div><div class="bki">' + cart + '<div><div class="nm">boostplus</div><div class="inv">' + (en ? "Balance top-up" : "ব্যালেন্স টপ-আপ") + '</div></div><b class="am">' + T2.am + '</b></div><div class="bkp" style="background:' + c + '"><label class="bl" for="sn">' + T2.lb + '</label><input class="t" id="sn" type="tel" inputmode="numeric" maxlength="11" placeholder="' + T2.ph + '" value="' + esc(S.sender) + '"><div class="bkt">' + T2.tc + '<a href="terms.html" style="color:inherit"><u>' + T2.tl + '</u></a></div><div class="err" id="er" hidden></div></div><div class="bkb"><a class="gb" href="topup-amount.html" style="display:flex;align-items:center;justify-content:center;text-decoration:none">' + T2.cn + '</a><button class="gb cf" id="ok"' + (okv ? "" : " disabled") + '>' + T2.cf + '</button></div><div class="bkf"><span>© boostplus · সুরক্ষিত টপ-আপ</span></div></div></div>';
    },
    pay: function () {
      bg("");
      var m = S.m, k = m === "npsb" ? S.w : m;
      var rows = function (l, v, id) { return '<div class="card row"><div><div class="mu">' + l + '</div><b style="font-size:18px">' + v + '</b></div><button class="cp" data-c="' + id + '">কপি</button></div>'; };
      var qk = k === "rocket" ? "qr_r.png" : "qr_b.png";
      var sc = m === "npsb" ? "ব্যাংক অ্যাপে NPSB দিয়ে নিচের " + M[k].n + " নম্বরে পাঠান" : "QR স্ক্যান করুন, অথবা নিচের নম্বরে Send Money করুন";
      var qb = (m === "nagad" || m === "npsb") ? '<div class="card" style="padding:16px;text-align:center;font-weight:600;line-height:1.5">' + (m === "npsb" ? sc : "Nagad অ্যাপ খুলে নিচের নম্বরে <u>Send Money</u> করুন, ঠিক এই অ্যামাউন্ট") + "</div>" : '<div class="qr"><img src="' + IMG + qk + '" alt="' + (k === "rocket" ? "Rocket QR" : "bKash Bangla QR") + '" width="' + (k === "rocket" ? "220" : "280") + '" style="max-width:100%;height:auto;display:block;border-radius:12px"><span>' + sc + "</span></div>";
      var extra = (k === "nagad" && CFG.nagadVirtual) ? rows("Nagad ভার্চুয়াল নম্বর", CFG.nagadVirtual, "v") : "";
      if (!S.end) { S.end = Date.now() + CFG.minutes * 60000; save(); }
      return '<div class="w pay">' + head(1) + '<div class="top" style="align-items:flex-end"><div><div class="mu">boostplus · ব্যালেন্স যোগ</div><h1>' + M[m].n + ' দিয়ে Send Money</h1></div><b style="font-size:30px">' + fmt(tot()) + "</b></div>" + qb + rows(M[k].n + " পারসোনাল নম্বর (Send Money)", CFG.pay, "n") + extra + rows("ঠিক এই পরিমাণ পাঠান", "৳" + bn(tot()), "a") + '<div style="text-align:center;color:var(--warn);font-weight:600" id="cd" aria-live="off">' + bn(CFG.minutes) + ':০০ মিনিটের মধ্যে পেমেন্ট করুন</div><div><label class="lb" for="tx">Transaction ID</label><div class="card in" style="height:52px"><input id="tx" style="font-size:16px;font-weight:400" placeholder="যেমন 8N7002M4RB" value="' + esc(S.id) + '" autocomplete="off" autocapitalize="characters"></div></div><div class="e2" id="er" role="alert"></div><div class="pbt"><button class="btn" id="vf">পেমেন্ট যাচাই করুন</button><a class="btn ghost" href="topup-amount.html" style="display:flex;align-items:center;justify-content:center;text-decoration:none">অন্য মেথড বাছুন</a></div></div>';
    },
    result: function () {
      bg(""); stop();
      var r = S.res || "pending", o = {
        success: ["#12372b", "var(--ok)", "M22 37l10 10 18-20", "টপ-আপ সম্পন্ন", "আপনার ওয়ালেটে ব্যালেন্স যোগ হয়েছে"],
        pending: ["#3a2a08", "var(--warn)", "M36 20v18l10 6", "পেন্ডিং, যাচাই চলছে", "আপনার টপ-আপ রিকোয়েস্ট জমা হয়েছে। পেমেন্ট যাচাই হলে ব্যালেন্স নিজে থেকে যোগ হবে। এই পাতা খোলা রাখলে এখানেই জানাবে"],
        failed: ["#3a1212", "var(--bad)", "M24 24l24 24M48 24L24 48", "যাচাই ব্যর্থ", "Transaction ID বা অ্যামাউন্ট মেলেনি। আবার চেষ্টা করুন বা সাপোর্টে জানান"],
        expired: ["#3a1212", "var(--bad)", "M24 24l24 24M48 24L24 48", "সময় শেষ", bn(CFG.minutes) + " মিনিট পার হয়েছে। নতুন করে শুরু করুন"]
      }[r] || [];
      var mn = S.m && M[S.m] ? M[S.m].n : "";
      var det = (r === "success" || r === "pending") ? '<div class="card" style="padding:14px;display:grid;gap:10px;font-size:14px"><div class="row" style="padding:0"><span class="mu">' + (r === "success" ? "যোগ হয়েছে" : "যোগ হবে") + "</span><b>" + fmt(S.amt) + "</b></div>" + (r === "success" ? '<div class="row" style="padding:0"><span class="mu">নতুন ব্যালেন্স</span><b>' + (S.bal == null ? "—" : fmt(S.bal)) + "</b></div>" : '<div class="row" style="padding:0"><span class="mu">অবস্থা</span><b style="color:var(--warn)">অপেক্ষমাণ</b></div>') + '<div class="row" style="padding:0"><span class="mu">মেথড</span><b>' + esc(mn) + '</b></div><div class="row" style="padding:0"><span class="mu">ট্রানজেকশন ID</span><b>' + esc(S.id) + "</b></div>" + (S.order ? '<div class="row" style="padding:0"><span class="mu">টপ-আপ ID</span><b>' + esc(S.order) + "</b></div>" : "") + "</div>" : "";
      var b2 = r === "success" ? '<button class="btn" data-new="1">নতুন টপ-আপ</button><a class="btn ghost" href="index.html" style="display:flex;align-items:center;justify-content:center;text-decoration:none">ওয়ালেটে ফিরুন</a>'
        : r === "pending" ? '<a class="btn ghost" href="index.html" style="display:flex;align-items:center;justify-content:center;text-decoration:none">ওয়ালেটে ফিরুন</a>'
        : r === "failed" ? '<button class="btn" data-retry="1">আবার চেষ্টা করুন</button><a class="btn ghost" href="index.html" style="display:flex;align-items:center;justify-content:center;text-decoration:none">ওয়ালেটে ফিরুন</a>'
        : '<button class="btn" data-new="1">আবার চেষ্টা করুন</button><a class="btn ghost" href="index.html" style="display:flex;align-items:center;justify-content:center;text-decoration:none">ওয়ালেটে ফিরুন</a>';
      return '<div class="w">' + head(2) + '<div class="res"><svg width="72" height="72" viewBox="0 0 72 72" role="img" aria-label="' + o[3] + '"><circle cx="36" cy="36" r="34" fill="' + o[0] + '" stroke="' + o[1] + '" stroke-width="2"/><path d="' + o[2] + '" fill="none" stroke="' + o[1] + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><h1>' + o[3] + '</h1><div class="mu">' + o[4] + "</div></div>" + det + '<div style="display:grid;gap:10px;margin-top:auto">' + b2 + "</div></div>";
    }
  };
  function view() { return PAGE === "wallet" ? R.wallet(S.m) : R[PAGE](); }
  function guard() {
    if (PAGE === "amount") return "";
    var okAmt = S.amt >= CFG.min && S.m;
    if (PAGE === "result") return S.res ? "" : "topup-amount";
    if (!okAmt) return "topup-amount";
    if (PAGE === "pay") return (S.m !== "npsb" && !/^01\d{9}$/.test(S.sender)) ? "topup-" + S.m : "";
    return FILE === S.m ? "" : "topup-" + S.m;   // নম্বর-পাতা শুধু বাছাই করা মেথডেরটাই
  }
  function render() {
    if (!token()) { app.innerHTML = loginCard(); return; }
    app.innerHTML = view(); window.scrollTo(0, 0); after();
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
        document.getElementById("fl").textContent = FEE[S.m] ? "ফি (প্রতি হাজারে ৳" + bn(FEE[S.m]) + ")" : "ফি";
        document.getElementById("hint").style.color = S.amt && S.amt < CFG.min ? "var(--bad)" : "";
        g.disabled = !(S.amt >= CFG.min && S.m);
      };
      a.addEventListener("input", sync); sync();
    }
    if (PAGE === "pay") {
      var cd = document.getElementById("cd");
      var tick = function () {
        var l = Math.max(0, S.end - Date.now()), s = Math.floor(l / 1000);
        cd.textContent = bn(("0" + Math.floor(s / 60)).slice(-2) + ":" + ("0" + s % 60).slice(-2)) + " মিনিটের মধ্যে পেমেন্ট করুন";
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
    if (t.dataset.lang) { readSender(); S.lang = t.dataset.lang; save(); render(); }
    else if (t.dataset.q) { S.amt = Number(t.dataset.q); save(); render(); }
    else if (t.dataset.m) { S.m = t.dataset.m; S.sender = ""; var a = document.getElementById("amt"); if (a) S.amt = Number(a.value) || 0; save(); render(); }
    else if (t.dataset.w) { S.w = t.dataset.w; save(); render(); }
    else if (t.dataset.new) { reset(); go("topup-amount"); }
    else if (t.dataset.retry) { S.res = ""; S.id = ""; S.end = 0; go("topup-pay"); }
    else if (t.id === "go") { go("topup-" + S.m); }
    else if (t.id === "ok") {
      if (S.m === "npsb") { S.end = 0; go("topup-pay"); return; }
      readSender();
      if (!/^01\d{9}$/.test(S.sender)) { err("০১ দিয়ে শুরু ১১ অঙ্কের নম্বর দিন"); return; }
      S.end = 0; go("topup-pay");
    }
    else if (t.dataset.c) {
      var v = { n: CFG.pay, a: String(tot()), v: CFG.nagadVirtual }[t.dataset.c];
      try { navigator.clipboard.writeText(v); } catch (x) {}
      t.textContent = "কপি হয়েছে"; setTimeout(function () { t.textContent = "কপি"; }, 1500);
    }
    else if (t.id === "vf") verify(t);
  }
  function verify(btn) {
    var id = document.getElementById("tx").value.trim(), e2 = document.getElementById("er");
    e2.textContent = "";
    if (id.length < 6) { e2.textContent = "সঠিক Transaction ID দিন (কমপক্ষে ৬ অক্ষর)"; return; }
    btn.disabled = true; btn.textContent = "জমা হচ্ছে…";
    post({ action: "wallet_topup", token: token(), amount: S.amt, paid_from: M[S.m].n, txn_id: id, sender: S.sender || "", comments: (S.m === "npsb" ? "NPSB→" + M[S.w].n : "") })
      .then(function (d) {
        if (!d || !d.ok) { e2.textContent = (d && (d.message || d.error)) || "টপ-আপ ব্যর্থ"; btn.disabled = false; btn.textContent = "পেমেন্ট যাচাই করুন"; return; }
        stop(); S.id = id; S.order = d.order_id || ""; S.end = 0;
        if (d.status === "Completed") { S.res = "success"; if (d.balance != null) S.bal = Number(d.balance) || 0; } else S.res = "pending";
        go("topup-result");
      })
      .catch(function (x) { e2.textContent = x && x.name === "AbortError" ? "সার্ভার সাড়া দিচ্ছে না। একটু পর আবার চেষ্টা করুন।" : "নেটওয়ার্ক সমস্যা। ইন্টারনেট চেক করে আবার চেষ্টা করুন।"; btn.disabled = false; btn.textContent = "পেমেন্ট যাচাই করুন"; });
  }
  function onInput(e) {
    var t = e.target;
    if (t.id === "sn") { t.value = t.value.replace(/\D/g, ""); var o = document.getElementById("ok"); if (o) o.disabled = !/^01\d{9}$/.test(t.value); var e1 = document.getElementById("er"); if (e1) e1.hidden = true; }
    if (t.dataset && t.dataset.i !== undefined) { t.value = t.value.replace(/\D/g, ""); var i = +t.dataset.i; var l = t.parentNode.querySelectorAll("input"); if (t.value && i < 10) l[i + 1].focus(); }
  }
  function onKey(e) { var t = e.target; if (t.dataset && t.dataset.i !== undefined && e.key === "Backspace" && !t.value && +t.dataset.i > 0) t.parentNode.querySelectorAll("input")[+t.dataset.i - 1].focus(); }
  window.PBT = {
    page: function (name) {
      FILE = name; PAGE = (name === "bkash" || name === "rocket") ? "wallet" : name; app = document.getElementById("app");
      if (PAGE === "amount") {
        var q = /[?&]amt=(\d+)/.exec(location.search); S.res = ""; S.id = ""; S.order = ""; S.end = 0;
        if (q && Number(q[1]) >= CFG.min) S.amt = Number(q[1]);
      }
      var to = token() ? guard() : ""; if (to) { back(to); return; }
      app.addEventListener("click", onClick); app.addEventListener("input", onInput); app.addEventListener("keydown", onKey);
      save(); render(); balance();
    }
  };
})();
