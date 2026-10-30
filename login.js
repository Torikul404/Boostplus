/* login.js — আলাদা লগইন পেজ (ধাপ ৬)
   ব্যাকএন্ড অপরিবর্তিত: app-wallet.js এর মতোই wallet_auth (login / register / forgot_pin_*) ব্যবহার করে,
   একই localStorage কী (pb_wallet_token, pb_wallet_mobile) সেট করে, তারপর হোমে ফেরত পাঠায়।
   ?svc=<code> থাকলে হোমে ফিরে ওই সার্ভিসটাই সিলেক্ট থাকে। */
(function () {
  "use strict";
  var API = "https://script.google.com/macros/s/AKfycbxacUqhDDc_2kRsedBF_x8zTrqUhNloQryVEkKuJzDC7SAyh_po6BbxX2F0ZLrrPmhV/exec"; // app-core.js এর BOOSTPLUS_SHEET_API এর সাথে এক
  var LS_TOKEN = "pb_wallet_token", LS_MOBILE = "pb_wallet_mobile";
  function $(id) { return document.getElementById(id); }

  var qs = new URLSearchParams(location.search);
  var svc = qs.get("svc") || ""; if (!/^[\w.\-]{1,40}$/.test(svc)) svc = "";
  function dest() { return "index.html" + (svc ? "?svc=" + encodeURIComponent(svc) : ""); }

  try { if (localStorage.getItem(LS_TOKEN) && localStorage.getItem(LS_MOBILE)) { location.replace(dest()); return; } } catch (e) {}

  if (svc) { var sb = $("lgSvc"); if (sb) { sb.hidden = false; sb.textContent = "লগইনের পর আপনি সার্ভিস #" + svc + " এ ফিরে যাবেন।"; } }

  async function post(body) {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 30000);
    try {
      var res = await fetch(API, { method: "POST", mode: "cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined });
      return await res.json();
    } finally { clearTimeout(t); }
  }
  function netErr(e) { return (e && e.name === "AbortError") ? "সার্ভার সাড়া দিচ্ছে না। একটু পর আবার চেষ্টা করুন।" : "নেটওয়ার্ক সমস্যা। ইন্টারনেট চেক করে আবার চেষ্টা করুন।"; }
  function msg(kind, text) { var m = $("lgMsg"); m.setAttribute("data-kind", kind || ""); m.textContent = text || ""; }
  function val(id) { return (($(id) || {}).value || "").trim(); }
  function mobileOk(m) { return /^[0-9]{11}$/.test(m); }
  function nameOk(n) { return n.replace(/\s+/g, " ").length >= 2; }
  function pinOk(p) { return /^[0-9]{4,6}$/.test(p); }
  async function busy(btn, label, fn) {
    var old = btn.textContent; btn.disabled = true; btn.textContent = label;
    try { await fn(); } finally { btn.disabled = false; btn.textContent = old; }
  }
  function done(d, mobile, text) {
    try { localStorage.setItem(LS_TOKEN, d.token); localStorage.setItem(LS_MOBILE, d.mobile || mobile); if (d.name) localStorage.setItem("pb_wallet_name", d.name); } catch (e) { msg("error", "ব্রাউজারে সেশন সেভ করা যায়নি (প্রাইভেট মোড বন্ধ করে দেখুন)।"); return; }
    msg("success", text);
    setTimeout(function () { location.replace(dest()); }, 500);
  }

  // ---- ট্যাব / প্যানেল ----
  var PANELS = ["login", "register", "forgot"];
  function show(name) {
    PANELS.forEach(function (p) { var el = $("lgPanel-" + p); if (el) el.hidden = p !== name; });
    var tabs = $("lgTabs"); tabs.hidden = name === "forgot";
    $("lgTabLogin").setAttribute("aria-selected", String(name === "login"));
    $("lgTabRegister").setAttribute("aria-selected", String(name === "register"));
    $("lgTitle").textContent = name === "register" ? "নতুন অ্যাকাউন্ট খুলুন" : (name === "forgot" ? "পিন রিসেট" : "অ্যাকাউন্টে লগইন");
    var sub = $("lgSub");
    if (sub) sub.textContent = name === "register" ? "মোবাইল নম্বর আর ৪–৬ ডিজিটের একটি পিন দিয়ে অ্যাকাউন্ট খুলুন। এই পিনই আপনার লগইন পাসওয়ার্ড।" : (name === "forgot" ? "মোবাইল নম্বর দিন; অ্যাডমিনের দেওয়া কোড ও নতুন পিন দিয়ে পিন বদলান।" : "মোবাইল নম্বর ও পিন দিয়ে আপনার অ্যাকাউন্টে প্রবেশ করুন।");
    msg("", "");
  }
  $("lgTabLogin").addEventListener("click", function () { show("login"); });
  $("lgTabRegister").addEventListener("click", function () { show("register"); });
  $("lgForgotLink").addEventListener("click", function () { show("forgot"); var m = val("lgLoginMobile"); if (m) $("lgForgotMobile").value = m; });
  $("lgBackLogin").addEventListener("click", function () { show("login"); });
  [["lgLoginPin", "lgEyeLogin"], ["lgRegPin", "lgEyeReg"], ["lgNewPin", "lgEyeNew"]].forEach(function (x) {
    var b = $(x[1]); if (!b) return;
    b.addEventListener("click", function () { var i = $(x[0]); i.type = i.type === "password" ? "tel" : "password"; });
  });

  // ---- লগইন ----
  $("lgBtnLogin").addEventListener("click", async function () {
    var name = val("lgLoginName"), mobile = val("lgLoginMobile"), pin = val("lgLoginPin");
    if (!name || !mobile || !pin) return msg("info", "নাম, মোবাইল নম্বর ও পিন দিন");
    if (!nameOk(name)) return msg("info", "নাম কমপক্ষে ২ অক্ষরের হতে হবে");
    if (!mobileOk(mobile)) return msg("info", "মোবাইল নম্বর ১১ ডিজিটের হতে হবে (01XXXXXXXXX)");
    await busy($("lgBtnLogin"), "লগইন হচ্ছে…", async function () {
      try {
        var d = await post({ action: "wallet_auth", sub: "login", name: name, mobile: mobile, pin: pin });
        if (!d || !d.ok) return msg("error", (d && d.message) || (d && d.error) || "লগইন ব্যর্থ");
        done(d, mobile, "লগইন সফল");
      } catch (e) { msg("error", netErr(e)); }
    });
  });

  // ---- রেজিস্টার ----
  $("lgBtnRegister").addEventListener("click", async function () {
    var name = val("lgRegName"), mobile = val("lgRegMobile"), pin = val("lgRegPin");
    if (!name || !mobile || !pin) return msg("info", "নাম, মোবাইল নম্বর ও পিন দিন");
    if (!nameOk(name)) return msg("info", "নাম কমপক্ষে ২ অক্ষরের হতে হবে");
    if (!mobileOk(mobile)) return msg("info", "মোবাইল নম্বর ১১ ডিজিটের হতে হবে (01XXXXXXXXX)");
    if (!pinOk(pin)) return msg("info", "পিন ৪–৬ ডিজিটের সংখ্যা হতে হবে");
    await busy($("lgBtnRegister"), "অপেক্ষা করুন…", async function () {
      try {
        var d = await post({ action: "wallet_auth", sub: "register", name: name, mobile: mobile, pin: pin });
        if (!d || !d.ok) {
          if (d && (d.error === "exists" || (d.message && d.message.indexOf("আগেই") !== -1))) return msg("error", "এই নম্বর দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে। লগইন ট্যাব ব্যবহার করুন।");
          return msg("error", (d && d.message) || (d && d.error) || "রেজিস্টার ব্যর্থ");
        }
        done(d, mobile, "অ্যাকাউন্ট তৈরি হয়েছে");
      } catch (e) { msg("error", netErr(e)); }
    });
  });

  // ---- পিন ভুলে গেলে ----
  $("lgBtnSendCode").addEventListener("click", async function () {
    var mobile = val("lgForgotMobile");
    if (!mobileOk(mobile)) return msg("info", "মোবাইল নম্বর ১১ ডিজিটের হতে হবে");
    await busy($("lgBtnSendCode"), "পাঠানো হচ্ছে…", async function () {
      try {
        var d = await post({ action: "wallet_auth", sub: "forgot_pin_request", mobile: mobile });
        if (!d || !d.ok) return msg("error", (d && d.message) || (d && d.error) || "কোড পাঠানো যায়নি");
        $("lgResetBox").hidden = false;
        msg("success", d.message || "কোড পাঠানো হয়েছে। নিচে কোড ও নতুন পিন দিন।");
      } catch (e) { msg("error", netErr(e)); }
    });
  });
  $("lgBtnReset").addEventListener("click", async function () {
    var mobile = val("lgForgotMobile"), code = val("lgCode"), np = val("lgNewPin");
    if (!code || !np) return msg("info", "কোড ও নতুন পিন দিন");
    if (!pinOk(np)) return msg("info", "পিন ৪–৬ ডিজিটের সংখ্যা হতে হবে");
    await busy($("lgBtnReset"), "অপেক্ষা করুন…", async function () {
      try {
        var d = await post({ action: "wallet_auth", sub: "forgot_pin_reset", mobile: mobile, code: code, new_pin: np });
        if (!d || !d.ok) return msg("error", (d && d.message) || (d && d.error) || "রিসেট ব্যর্থ");
        $("lgLoginMobile").value = mobile; $("lgLoginPin").value = ""; show("login");
        msg("success", "পিন বদলানো হয়েছে। নতুন পিন দিয়ে লগইন করুন।");
      } catch (e) { msg("error", netErr(e)); }
    });
  });

  // Enter চাপলে সংশ্লিষ্ট বাটন
  [["lgLoginName", "lgBtnLogin"], ["lgRegName", "lgBtnRegister"], ["lgLoginMobile", "lgBtnLogin"], ["lgLoginPin", "lgBtnLogin"], ["lgRegMobile", "lgBtnRegister"], ["lgRegPin", "lgBtnRegister"], ["lgForgotMobile", "lgBtnSendCode"], ["lgCode", "lgBtnReset"], ["lgNewPin", "lgBtnReset"]].forEach(function (x) {
    var i = $(x[0]); if (i) i.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); $(x[1]).click(); } });
  });

  show(qs.get("tab") === "register" ? "register" : "login");
})();
