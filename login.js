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
  // User name: ইংরেজি অক্ষর/সংখ্যা/_/- বা বাংলা, ৩–৩০ অক্ষর। শুধু সংখ্যা হলে সেটি মোবাইল নম্বর (01XXXXXXXXX) হতে হবে।
  function userOk(u) {
    if (/^\+?[0-9]+$/.test(u)) { var d = u.replace(/\D/g, ""); return /^01[0-9]{9}$/.test(d) || /^8801[0-9]{9}$/.test(d) || /^1[0-9]{9}$/.test(d); }
    return /^[A-Za-z0-9_\-\u0980-\u09FF]{3,30}$/.test(u);
  }
  function pwOk(p) { return p.length >= 6 && p.length <= 32; }
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
    $("lgTitle").textContent = name === "register" ? "নতুন অ্যাকাউন্ট খুলুন" : (name === "forgot" ? "পাসওয়ার্ড রিসেট" : "অ্যাকাউন্টে লগইন");
    var sub = $("lgSub");
    if (sub) sub.textContent = name === "register" ? "User name (নাম বা মোবাইল নম্বর) আর পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) দিয়ে অ্যাকাউন্ট খুলুন।" : (name === "forgot" ? "পুরনো ইউজার মোবাইল নম্বর, নতুন ইউজার User name দিন; অ্যাডমিনের দেওয়া কোড ও নতুন পাসওয়ার্ড দিয়ে পাসওয়ার্ড বদলান।" : "User name ও পাসওয়ার্ড দিয়ে আপনার অ্যাকাউন্টে প্রবেশ করুন।");
    msg("", "");
  }
  $("lgTabLogin").addEventListener("click", function () { show("login"); });
  $("lgTabRegister").addEventListener("click", function () { show("register"); });
  $("lgForgotLink").addEventListener("click", function () { show("forgot"); var m = val("lgLoginMobile"); if (m) $("lgForgotMobile").value = m; });
  $("lgBackLogin").addEventListener("click", function () { show("login"); });
  [["lgLoginPin", "lgEyeLogin"], ["lgRegPin", "lgEyeReg"], ["lgNewPin", "lgEyeNew"]].forEach(function (x) {
    var b = $(x[1]); if (!b) return;
    b.addEventListener("click", function () { var i = $(x[0]); i.type = i.type === "password" ? "text" : "password"; });
  });

  // ---- লগইন ----
  $("lgBtnLogin").addEventListener("click", async function () {
    var mobile = val("lgLoginMobile"), pin = $("lgLoginPin").value;
    if (!mobile || !pin) return msg("info", "User name ও পাসওয়ার্ড দিন");
    await busy($("lgBtnLogin"), "লগইন হচ্ছে…", async function () {
      try {
        var d = await post({ action: "wallet_auth", sub: "login", username: mobile, pin: pin });
        if (!d || !d.ok) return msg("error", (d && d.message) || (d && d.error) || "লগইন ব্যর্থ");
        done(d, mobile, "লগইন সফল");
      } catch (e) { msg("error", netErr(e)); }
    });
  });

  // ---- রেজিস্টার ----
  $("lgBtnRegister").addEventListener("click", async function () {
    var name = val("lgRegName"), pin = $("lgRegPin").value;
    if (!name || !pin) return msg("info", "User name ও পাসওয়ার্ড দিন");
    if (!userOk(name)) return msg("info", "User name ৩–৩০ অক্ষরের হতে হবে (ইংরেজি অক্ষর, সংখ্যা, _ বা -; স্পেস বা . চলবে না)। শুধু সংখ্যা দিলে সেটি মোবাইল নম্বর (01XXXXXXXXX) হতে হবে।");
    if (!pwOk(pin)) return msg("info", "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
    await busy($("lgBtnRegister"), "অপেক্ষা করুন…", async function () {
      try {
        var d = await post({ action: "wallet_auth", sub: "register", username: name, pin: pin });
        if (!d || !d.ok) {
          if (d && (d.error === "exists" || (d.message && d.message.indexOf("আগেই") !== -1))) return msg("error", "এই User name আগেই নেওয়া হয়েছে। অন্য User name দিন, অথবা আপনার হলে লগইন করুন।");
          return msg("error", (d && d.message) || (d && d.error) || "রেজিস্টার ব্যর্থ");
        }
        done(d, name, "অ্যাকাউন্ট তৈরি হয়েছে");
      } catch (e) { msg("error", netErr(e)); }
    });
  });

  // ---- পিন ভুলে গেলে ----
  $("lgBtnSendCode").addEventListener("click", async function () {
    var mobile = val("lgForgotMobile");
    if (!mobile) return msg("info", "মোবাইল নম্বর বা User name দিন");
    await busy($("lgBtnSendCode"), "পাঠানো হচ্ছে…", async function () {
      try {
        var d = await post({ action: "wallet_auth", sub: "forgot_pin_request", username: mobile });
        if (!d || !d.ok) return msg("error", (d && d.message) || (d && d.error) || "কোড পাঠানো যায়নি");
        $("lgResetBox").hidden = false;
        msg("success", d.message || "কোড পাঠানো হয়েছে। নিচে কোড ও নতুন পাসওয়ার্ড দিন।");
      } catch (e) { msg("error", netErr(e)); }
    });
  });
  $("lgBtnReset").addEventListener("click", async function () {
    var mobile = val("lgForgotMobile"), code = val("lgCode"), np = val("lgNewPin");
    np = $("lgNewPin").value;
    if (!code || !np) return msg("info", "কোড ও নতুন পাসওয়ার্ড দিন");
    if (!pwOk(np)) return msg("info", "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
    await busy($("lgBtnReset"), "অপেক্ষা করুন…", async function () {
      try {
        var d = await post({ action: "wallet_auth", sub: "forgot_pin_reset", username: mobile, code: code, new_pin: np });
        if (!d || !d.ok) return msg("error", (d && d.message) || (d && d.error) || "রিসেট ব্যর্থ");
        $("lgLoginMobile").value = mobile; $("lgLoginPin").value = ""; show("login");
        msg("success", "পাসওয়ার্ড বদলানো হয়েছে। নতুন পাসওয়ার্ড দিয়ে লগইন করুন।");
      } catch (e) { msg("error", netErr(e)); }
    });
  });

  // Enter চাপলে সংশ্লিষ্ট বাটন
  [["lgRegName", "lgBtnRegister"], ["lgLoginMobile", "lgBtnLogin"], ["lgLoginPin", "lgBtnLogin"], ["lgRegPin", "lgBtnRegister"], ["lgForgotMobile", "lgBtnSendCode"], ["lgCode", "lgBtnReset"], ["lgNewPin", "lgBtnReset"]].forEach(function (x) {
    var i = $(x[0]); if (i) i.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); $(x[1]).click(); } });
  });

  show(qs.get("tab") === "register" ? "register" : "login");
})();
