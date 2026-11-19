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

  if (svc) { var sb = $("lgSvc"); if (sb) { sb.hidden = false; sb.textContent = "After logging in you will return to service #" + svc + "."; } }

  async function post(body) {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 30000);
    try {
      var res = await fetch(API, { method: "POST", mode: "cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined });
      var d = await res.json();
      // পুরনো সার্ভার ভার্সনের এরর চিনে পরিষ্কার জানানো (নতুন সার্ভার এই এরর কখনও দেয় না)
      if (d && d.ok === false && (d.error === "name_required" || (body && body.sub === "register" && (d.error === "invalid_mobile" || d.error === "invalid_name")))) {
        d.message = "The server is still running an old version. (Admin: paste Code.gs into Apps Script, then Deploy → Manage deployments → Edit → New version.)";
      }
      return d;
    } finally { clearTimeout(t); }
  }
  function netErr(e) { return (e && e.name === "AbortError") ? "The server is not responding. Please try again in a moment." : "Network problem. Check your internet and try again."; }
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
    try { localStorage.setItem(LS_TOKEN, d.token); localStorage.setItem(LS_MOBILE, d.mobile || mobile); if (d.name) localStorage.setItem("pb_wallet_name", d.name); localStorage.setItem("pb_wallet_gender", d.gender === "m" || d.gender === "f" ? d.gender : ""); } catch (e) { msg("error", "Could not save the session in the browser (try turning off private mode)."); return; }
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
    $("lgTitle").textContent = name === "register" ? "Create a new account" : (name === "forgot" ? "Reset password" : "Log in to your account");
    var sub = $("lgSub");
    if (sub) sub.textContent = name === "register" ? "Create an account with a user name (name or mobile number) and a password (at least 6 characters)." : (name === "forgot" ? "Existing users enter their mobile number, new users their user name; then change your password with the code from the admin and a new password." : "Log in to your account with your user name and password.");
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

  // ---- জেন্ডার বাছাই (ঐচ্ছিক; আবার চাপলে বাতিল) ----
  var regGender = "";
  Array.prototype.forEach.call(document.querySelectorAll("#lgGender .lg-gbtn"), function (b) {
    b.addEventListener("click", function () {
      var g = b.getAttribute("data-g");
      regGender = regGender === g ? "" : g;
      Array.prototype.forEach.call(document.querySelectorAll("#lgGender .lg-gbtn"), function (x) {
        x.setAttribute("aria-checked", x.getAttribute("data-g") === regGender ? "true" : "false");
      });
    });
  });

  // ---- লগইন ----
  $("lgBtnLogin").addEventListener("click", async function () {
    var mobile = val("lgLoginMobile"), pin = $("lgLoginPin").value;
    if (!mobile || !pin) return msg("info", "Enter your user name and password");
    await busy($("lgBtnLogin"), "Logging in…", async function () {
      try {
        var d = await post({ action: "wallet_auth", sub: "login", username: mobile, pin: pin });
        if (!d || !d.ok) return msg("error", (d && d.message) || (d && d.error) || "Login failed");
        done(d, mobile, "Logged in");
      } catch (e) { msg("error", netErr(e)); }
    });
  });

  // ---- রেজিস্টার ----
  $("lgBtnRegister").addEventListener("click", async function () {
    var name = val("lgRegName"), pin = $("lgRegPin").value;
    if (!name || !pin) return msg("info", "Enter your user name and password");
    if (!userOk(name)) return msg("info", "User name must be 3–30 characters (English letters, numbers, _ or -; no spaces or .). If it is only digits, it must be a mobile number (01XXXXXXXXX).");
    if (!pwOk(pin)) return msg("info", "Password must be at least 6 characters");
    await busy($("lgBtnRegister"), "Please wait…", async function () {
      try {
        var d = await post({ action: "wallet_auth", sub: "register", username: name, pin: pin, gender: regGender });
        if (!d || !d.ok) {
          if (d && (d.error === "exists" || (d.message && (d.message.indexOf("আগেই") !== -1 || /already/i.test(d.message))))) return msg("error", "This user name is already taken. Choose another user name, or log in if it is yours.");
          return msg("error", (d && d.message) || (d && d.error) || "Registration failed");
        }
        done(d, name, "Account created");
      } catch (e) { msg("error", netErr(e)); }
    });
  });

  // ---- পিন ভুলে গেলে ----
  $("lgBtnSendCode").addEventListener("click", async function () {
    var mobile = val("lgForgotMobile");
    if (!mobile) return msg("info", "Enter your mobile number or user name");
    await busy($("lgBtnSendCode"), "Sending…", async function () {
      try {
        var d = await post({ action: "wallet_auth", sub: "forgot_pin_request", username: mobile });
        if (!d || !d.ok) return msg("error", (d && d.message) || (d && d.error) || "Could not send the code");
        $("lgResetBox").hidden = false;
        msg("success", d.message || "Code sent. Enter the code and a new password below.");
      } catch (e) { msg("error", netErr(e)); }
    });
  });
  $("lgBtnReset").addEventListener("click", async function () {
    var mobile = val("lgForgotMobile"), code = val("lgCode"), np = val("lgNewPin");
    np = $("lgNewPin").value;
    if (!code || !np) return msg("info", "Enter the code and a new password");
    if (!pwOk(np)) return msg("info", "Password must be at least 6 characters");
    await busy($("lgBtnReset"), "Please wait…", async function () {
      try {
        var d = await post({ action: "wallet_auth", sub: "forgot_pin_reset", username: mobile, code: code, new_pin: np });
        if (!d || !d.ok) return msg("error", (d && d.message) || (d && d.error) || "Reset failed");
        $("lgLoginMobile").value = mobile; $("lgLoginPin").value = ""; show("login");
        msg("success", "Password changed. Log in with your new password.");
      } catch (e) { msg("error", netErr(e)); }
    });
  });

  // Enter চাপলে সংশ্লিষ্ট বাটন
  [["lgRegName", "lgBtnRegister"], ["lgLoginMobile", "lgBtnLogin"], ["lgLoginPin", "lgBtnLogin"], ["lgRegPin", "lgBtnRegister"], ["lgForgotMobile", "lgBtnSendCode"], ["lgCode", "lgBtnReset"], ["lgNewPin", "lgBtnReset"]].forEach(function (x) {
    var i = $(x[0]); if (i) i.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); $(x[1]).click(); } });
  });

  show(qs.get("tab") === "register" ? "register" : "login");
})();
