/**
 * Customer wallet: login (mobile+PIN), balance, top-up.
 * Session in localStorage: pb_wallet_token, pb_wallet_mobile
 */
(function () {
  const LS_TOKEN = "pb_wallet_token";
  const LS_MOBILE = "pb_wallet_mobile";
  const MIN_TOPUP = 20;

  function api() {
    return (typeof sheetApi === "function" ? sheetApi() : "") || (window.BOOSTPLUS_SHEET_API || "");
  }

  const REQUEST_TIMEOUT_MS = 30000; // server gets 30s, then we stop waiting

  async function walletPost(body) {
    const url = api();
    if (!url) throw new Error("API নেই");
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined
      });
      return await res.json();
    } catch (e) {
      if (e && e.name === "AbortError") {
        const te = new Error("timeout");
        te.isTimeout = true;
        throw te;
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Friendly message for a failed request (timeout vs. network). */
  function netErrMsg(e) {
    return (e && e.isTimeout)
      ? "সার্ভার সাড়া দিচ্ছে না (৩০ সেকেন্ড পেরিয়ে গেছে)। একটু পর আবার চেষ্টা করুন।"
      : "নেটওয়ার্ক সমস্যা। ইন্টারনেট চেক করে আবার চেষ্টা করুন।";
  }

  // ---------- Toast / banner (success = green, error = red, info = yellow) ----------
  function toast(type, text, ms) {
    const host = document.getElementById("pbToastHost");
    const kind = type === "success" || type === "error" ? type : "info";
    // keep the old inline message line in sync (it is also visible on the page)
    const msgEl = document.getElementById("walletMsg");
    if (msgEl) {
      msgEl.style.color = kind === "success" ? "#6ee7b7" : (kind === "error" ? "#f87171" : "#fbbf24");
      msgEl.textContent = text;
    }
    if (!host) return;
    const icons = { success: "✅", error: "❌", info: "⚠️" };
    const t = document.createElement("div");
    t.className = "pb-toast " + kind;
    t.setAttribute("role", kind === "error" ? "alert" : "status");
    const ic = document.createElement("span"); ic.className = "pb-t-ic"; ic.textContent = icons[kind];
    const m = document.createElement("span"); m.className = "pb-t-msg"; m.textContent = text;
    const x = document.createElement("button"); x.type = "button"; x.className = "pb-t-x"; x.setAttribute("aria-label", "বন্ধ"); x.textContent = "×";
    t.appendChild(ic); t.appendChild(m); t.appendChild(x);
    host.appendChild(t);
    while (host.children.length > 3) host.removeChild(host.firstChild);
    requestAnimationFrame(function () { t.classList.add("show"); });
    let gone = false;
    function close() {
      if (gone) return;
      gone = true;
      t.classList.remove("show");
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 260);
    }
    x.addEventListener("click", close);
    setTimeout(close, ms || (kind === "error" ? 6000 : 4000));
  }
  window.pbToast = toast;

  /** Runs fn() with the button disabled + spinner; blocks double-clicks. */
  async function withLoading(btn, loadingText, fn) {
    if (btn && btn.dataset.busy === "1") return;
    let orig = "";
    if (btn) {
      btn.dataset.busy = "1";
      orig = btn.textContent;
      btn.disabled = true;
      btn.classList.add("is-loading");
      if (loadingText) btn.textContent = loadingText;
    }
    try {
      return await fn();
    } finally {
      if (btn) {
        btn.textContent = orig;
        btn.disabled = false;
        btn.classList.remove("is-loading");
        btn.dataset.busy = "0";
      }
    }
  }

  function val(id) { return ((document.getElementById(id) || {}).value || "").trim(); }
  function clearVals(ids) { ids.forEach(function (id) { const el = document.getElementById(id); if (el) el.value = ""; }); }
  function pinOk(p) { return /^[0-9]{4,6}$/.test(p); }

  function getToken() { return localStorage.getItem(LS_TOKEN) || ""; }
  function getMobile() { return localStorage.getItem(LS_MOBILE) || ""; }

  function setNavBalance(bal) {
    const el = document.getElementById("navWalletBal");
    if (!el) return;
    if (bal == null || isNaN(bal)) {
      el.style.display = "none";
      el.textContent = "";
      return;
    }
    el.style.display = "inline";
    el.textContent = "৳" + (Number(bal) || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 }); // ড্যাশবোর্ডের মতোই ফরম্যাট
  }

  async function loadWalletHistory() {
    const token = getToken();
    const hist = document.getElementById("walletFundHistory");
    if (!hist) return;
    if (!token) { hist.textContent = "লগইন করুন"; return; }
    try {
      const d = await walletPost({ action: "wallet_auth", sub: "history", token: token, limit: 30 });
      if (!d || !d.ok) { hist.textContent = (d && d.message) || "লোড ব্যর্থ"; return; }
      // শুধু ডিপোজিট (টপ-আপ) — পজিটিভ অ্যামাউন্টের এন্ট্রি
      const rows = (d.ledger || []).filter(function (r) { return (Number(r.amount) || 0) > 0; });
      if (!rows.length) { hist.innerHTML = "<span class='muted'>এখনো কোনো ফান্ড অ্যাড করা হয়নি</span>"; return; }
      hist.innerHTML = rows.map(function (r) {
        const n = Number(r.amount) || 0;
        const when = String(r.created_at || r.date || "").slice(0, 19).replace("T", " ");
        return "<div class='af-hrow'>" +
          "<div><div class='af-hname'>" + esc(r.reason || r.type || "Deposit") + "</div>" +
          (when ? "<div class='af-hdate'>" + esc(when) + "</div>" : "") + "</div>" +
          "<div class='af-hamt'>+" + n.toFixed(2) + "</div></div>";
      }).join("");
    } catch (e) {
      hist.textContent = netErrMsg(e);
    }
  }

  function setSession(token, mobile) {
    if (token) localStorage.setItem(LS_TOKEN, token);
    if (mobile) localStorage.setItem(LS_MOBILE, mobile);
  }
  function clearSession() {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_MOBILE);
    try { localStorage.removeItem("pb_wallet_name"); } catch (e) {}
    const box = document.getElementById("userDash");
    if (box) box.style.display = "none";
    const g = document.getElementById("userDashGuest");
    if (g) g.style.display = "block";
    setNavBalance(null);
  }

  function updateUserDash(d) {
    const box = document.getElementById("userDash");
    const guest = document.getElementById("userDashGuest");
    if (!d || !d.ok) {
      if (box) box.style.display = "none";
      if (guest) guest.style.display = "block";
      return;
    }
    if (guest) guest.style.display = "none";
    if (box) box.style.display = "block";
    const name = document.getElementById("userDashName");
    let savedName = "";
    try { if (d.name) localStorage.setItem("pb_wallet_name", d.name); savedName = localStorage.getItem("pb_wallet_name") || ""; } catch (e) {}
    if (name) name.textContent = d.name || savedName || d.mobile || getMobile() || "User";
    const b = document.getElementById("udBalance");
    if (b) b.textContent = "৳" + (Number(d.balance) || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 });
    const s = document.getElementById("udSpend");
    if (s) s.textContent = "৳" + (Number(d.total_spend) || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 });
    // Total Spend ব্যাগ: খরচ অনুযায়ী ভরে, ৳5000 হলে পুরো ভরা
    (function () {
      const TARGET = 5000, TOP = 34, BOT = 66, H = BOT - TOP;
      const spend = Number(d.total_spend) || 0;
      let pct = Math.min(1, Math.max(0, spend / TARGET));
      if (spend > 0 && pct < 0.04) pct = 0.04;
      const fill = document.getElementById("udBagFill");
      const top = document.getElementById("udBagFillTop");
      const hh = H * pct;
      if (fill) { fill.setAttribute("y", String(BOT + 1 - hh)); fill.setAttribute("height", String(hh ? hh + 1 : 0)); }
      if (top) { top.setAttribute("y", String(BOT + 1 - hh)); top.setAttribute("height", hh ? "2.5" : "0"); }
    })();
    const o = document.getElementById("udOrders");
    if (o) o.textContent = String(Number(d.total_orders) || 0);
    // Honorary badge for the top customers by number of orders
    (function () {
      const bd = document.getElementById("udBadge");
      if (!bd) return;
      const b = d.badge;
      if (b && b.rank) {
        bd.className = "ud-badge ud-badge-" + b.rank;
        bd.textContent = (b.icon || "🏅") + " " + (b.label_en || "Top Customer") + " · " + (Number(b.orders) || 0) + " orders";
        bd.style.display = "inline-flex";
      } else {
        bd.style.display = "none";
        bd.textContent = "";
      }
    })();
    setNavBalance(d.balance);
  }

  async function refreshUserDash() {
    const token = getToken();
    const box = document.getElementById("userDash");
    const guest = document.getElementById("userDashGuest");
    if (!token) {
      if (box) box.style.display = "none";
      if (guest) guest.style.display = "block";
      setNavBalance(null);
      return;
    }
    try {
      const d = await walletPost({ action: "wallet_auth", sub: "me", token: token });
      if (d && d.ok) updateUserDash(d);
      else {
        if (box) box.style.display = "none";
        if (guest) guest.style.display = "block";
      }
    } catch (e) {
      if (box) box.style.display = "none";
      if (guest) guest.style.display = "block";
    }
  }

  window.refreshUserDash = refreshUserDash;


  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showWalletView() {
    document.querySelectorAll(".view-section").forEach(function (el) {
      el.style.display = "none";
    });
    const v = document.getElementById("wallet-view");
    if (v) v.style.display = "block";
    document.querySelectorAll(".main-tab").forEach(function (btn) {
      const on = btn.getAttribute("data-view") === "wallet";
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    refreshWalletUI();
  }

  window.goWallet = showWalletView;

  async function refreshWalletUI() {
    const guest = document.getElementById("walletGuest");
    const home = document.getElementById("walletHome");
    const token = getToken();
    if (!token) {
      if (guest) guest.style.display = "block";
      if (home) home.style.display = "none";
      return;
    }
    if (guest) guest.style.display = "none";
    if (home) home.style.display = "block";
    loadWalletHistory();
    try {
      const d = await walletPost({ action: "wallet_auth", sub: "me", token: token });
      if (!d || !d.ok || d.error === "auth") {
        clearSession();
        if (guest) guest.style.display = "block";
        if (home) home.style.display = "none";
        return;
      }
      const balEl = document.getElementById("walletBal");
      const mobEl = document.getElementById("walletMob");
      if (balEl) {
        const target = Number(d.balance) || 0;
        const from = Number(balEl.getAttribute("data-v")) || 0;
        balEl.setAttribute("data-v", String(target));
        if (from === target) balEl.textContent = "৳" + target.toFixed(2);
        else {
          const t0 = performance.now(), dur = 700;
          (function step(now) {
            const k = Math.min(1, (now - t0) / dur);
            balEl.textContent = "৳" + (from + (target - from) * (1 - Math.pow(1 - k, 3))).toFixed(2);
            if (k < 1) requestAnimationFrame(step);
          })(t0);
        }
      }
      if (mobEl) mobEl.textContent = d.mobile || getMobile();
      updateUserDash(d);
      setNavBalance(d.balance);
    } catch (e) {
      const msg = document.getElementById("walletMsg");
      if (msg) msg.textContent = netErrMsg(e);
    }
  }

  async function doRegister() {
    location.href = "login.html?tab=register"; return; // name + number + PIN form lives on login.html
    const mobile = val("walRegMobile");
    const pin = (document.getElementById("walRegPin") || {}).value || "";
    if (!mobile || !pin) return toast("info", "মোবাইল নম্বর ও পিন দিন");
    await withLoading(document.getElementById("walBtnRegister"), "অপেক্ষা করুন…", async function () {
      try {
        const d = await walletPost({ action: "wallet_auth", sub: "register", mobile: mobile, pin: pin });
        if (!d || !d.ok) {
          if (d && (d.error === "exists" || (d.message && d.message.indexOf("আগেই") !== -1))) {
            toast("error", "এই নম্বর দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে। লগইন ট্যাব ব্যবহার করুন।");
          } else {
            toast("error", (d && d.message) || (d && d.error) || "রেজিস্টার ব্যর্থ");
          }
          return;
        }
        setSession(d.token, d.mobile);
        toast("success", "আপনার অ্যাকাউন্ট তৈরি হয়েছে");
        refreshWalletUI();
        refreshUserDash();
      } catch (e) {
        toast("error", netErrMsg(e));
      }
    });
  }

  async function doLogin() {
    location.href = "login.html"; return; // name + number + PIN form lives on login.html
    const mobile = val("walLoginMobile");
    const pin = (document.getElementById("walLoginPin") || {}).value || "";
    if (!mobile || !pin) return toast("info", "মোবাইল নম্বর ও পিন দিন");
    await withLoading(document.getElementById("walBtnLogin"), "লগইন হচ্ছে…", async function () {
      try {
        const d = await walletPost({ action: "wallet_auth", sub: "login", mobile: mobile, pin: pin });
        if (!d || !d.ok) {
          toast("error", (d && d.message) || (d && d.error) || "লগইন ব্যর্থ");
          return;
        }
        setSession(d.token, d.mobile);
        toast("success", "লগইন সফল");
        refreshWalletUI();
        refreshUserDash();
      } catch (e) {
        toast("error", netErrMsg(e));
      }
    });
  }

  async function doSetPin() {
    const mobile = val("walLoginMobile");
    const pin = (document.getElementById("walLoginPin") || {}).value || "";
    if (!mobile || !pin) return toast("info", "মোবাইল নম্বর ও নতুন পিন দিন");
    await withLoading(document.getElementById("walBtnSetPin"), "অপেক্ষা করুন…", async function () {
      try {
        const d = await walletPost({ action: "wallet_auth", sub: "set_pin", mobile: mobile, pin: pin });
        if (!d || !d.ok) {
          toast("error", (d && d.message) || "পিন সেট ব্যর্থ");
          return;
        }
        setSession(d.token, d.mobile);
        toast("success", d.message || "পিন সেট হয়েছে");
        refreshWalletUI();
      } catch (e) {
        toast("error", netErrMsg(e));
      }
    });
  }

  // ---------- Change PIN (logged in: old PIN -> new PIN) ----------
  async function doChangePin() {
    const oldPin = val("walOldPin");
    const newPin = val("walNewPin");
    const confirm = val("walConfirmPin");
    if (!pinOk(oldPin)) return toast("info", "পুরনো পিন ৪–৬ ডিজিটের সংখ্যা দিন");
    if (!pinOk(newPin)) return toast("info", "নতুন পিন ৪–৬ ডিজিটের সংখ্যা হতে হবে");
    if (newPin !== confirm) return toast("error", "নতুন পিন ও কনফার্ম পিন মিলছে না");
    if (newPin === oldPin) return toast("info", "নতুন পিন পুরনো পিনের মতো হতে পারবে না");
    await withLoading(document.getElementById("walBtnChangePin"), "পরিবর্তন হচ্ছে…", async function () {
      try {
        const d = await walletPost({ action: "wallet_auth", sub: "change_pin", token: getToken(), old_pin: oldPin, new_pin: newPin });
        if (!d || !d.ok) {
          if (d && d.error === "auth") {
            clearSession();
            refreshWalletUI();
          }
          toast("error", (d && d.message) || "পিন পরিবর্তন ব্যর্থ");
          return;
        }
        clearVals(["walOldPin", "walNewPin", "walConfirmPin"]);
        showWalletView();
        toast("success", d.message || "পিন সফলভাবে পরিবর্তন হয়েছে");
      } catch (e) {
        toast("error", netErrMsg(e));
      }
    });
  }

  // ---------- Forgot PIN (mobile -> request to ADMIN -> admin gives code -> code + new PIN + confirm) ----------
  let forgotCooldownIv = null;

  function startForgotCooldown(sec) {
    const btn = document.getElementById("walBtnForgotSend");
    if (!btn) return;
    if (forgotCooldownIv) clearInterval(forgotCooldownIv);
    let left = sec;
    btn.disabled = true;
    const tick = function () {
      if (left <= 0) {
        clearInterval(forgotCooldownIv);
        forgotCooldownIv = null;
        btn.disabled = false;
        btn.textContent = "আবার অনুরোধ করুন";
        return;
      }
      btn.textContent = "আবার অনুরোধ (" + left + "s)";
      left--;
    };
    tick();
    forgotCooldownIv = setInterval(tick, 1000);
  }

  async function doForgotSend() {
    const mobile = val("walForgotMobile");
    if (!/^01[0-9]{9}$/.test(mobile)) return toast("info", "সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)");
    const btn = document.getElementById("walBtnForgotSend");
    let sent = false;
    await withLoading(btn, "অনুরোধ পাঠানো হচ্ছে…", async function () {
      try {
        const d = await walletPost({ action: "wallet_auth", sub: "forgot_pin_request", mobile: mobile });
        if (!d || !d.ok) {
          toast("error", (d && d.message) || "অনুরোধ পাঠানো ব্যর্থ");
          return;
        }
        sent = true;
        const s2 = document.getElementById("walForgotStep2");
        if (s2) s2.style.display = "grid";
        toast("success", d.message || "অনুরোধ এডমিনের কাছে পাঠানো হয়েছে");
        const c = document.getElementById("walForgotCode");
        if (c) c.focus();
      } catch (e) {
        toast("error", netErrMsg(e));
      }
    });
    if (sent) startForgotCooldown(60);
  }

  async function doForgotReset() {
    const mobile = val("walForgotMobile");
    const code = val("walForgotCode");
    const newPin = val("walForgotNewPin");
    const confirm = val("walForgotConfirmPin");
    if (!/^[0-9]{6}$/.test(code)) return toast("info", "এডমিনের দেওয়া ৬ ডিজিটের কোড দিন");
    if (!pinOk(newPin)) return toast("info", "নতুন পিন ৪–৬ ডিজিটের সংখ্যা হতে হবে");
    if (newPin !== confirm) return toast("error", "নতুন পিন ও কনফার্ম পিন মিলছে না");
    await withLoading(document.getElementById("walBtnForgotReset"), "সেট হচ্ছে…", async function () {
      try {
        const d = await walletPost({ action: "wallet_auth", sub: "forgot_pin_reset", mobile: mobile, code: code, new_pin: newPin });
        if (!d || !d.ok) {
          toast("error", (d && d.message) || "পিন রিসেট ব্যর্থ");
          return;
        }
        clearVals(["walForgotCode", "walForgotNewPin", "walForgotConfirmPin"]);
        const s2 = document.getElementById("walForgotStep2");
        if (s2) s2.style.display = "none";
        setSession(d.token, d.mobile);
        toast("success", "নতুন পিন সেট হয়েছে। আপনি লগইন অবস্থায় আছেন।");
        refreshWalletUI();
        refreshUserDash();
      } catch (e) {
        toast("error", netErrMsg(e));
      }
    });
  }

  function doLogout() {
    clearSession();
    const msg = document.getElementById("walletMsg");
    if (msg) msg.textContent = "লগআউট হয়েছে";
    refreshWalletUI();
  }


  const TF_PAY_NUMBERS = {
    bKash: "01921018882",
    Nagad: "01921018882",
    Rocket: "01921018882"
  };

  let tfState = { method: "", amount: 0, sender: "", orderId: "", endsAt: 0 };
  let tfCountdownIv = null;
  let tfPollIv = null;

  function showTopupView() {
    document.querySelectorAll(".view-section").forEach(function (el) { el.style.display = "none"; });
    const v = document.getElementById("topup-view");
    if (v) v.style.display = "block";
    window.scrollTo(0, 0);
    tfShow("tfStepA");
    loadWalletHistory();
  }
  window.goTopup = showTopupView;

  function tfShow(step) {
    ["tfStepA", "tfStepB", "tfStepC", "tfStepD"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.style.display = id === step ? "block" : "none";
    });
  }

  function tfStopTimers() {
    if (tfCountdownIv) { clearInterval(tfCountdownIv); tfCountdownIv = null; }
    if (tfPollIv) { clearInterval(tfPollIv); tfPollIv = null; }
  }

  function tfStartCountdown() {
    tfStopTimers();
    tfState.endsAt = Date.now() + 15 * 60 * 1000;
    const tick = function () {
      const left = Math.max(0, tfState.endsAt - Date.now());
      const sec = Math.floor(left / 1000);
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      const el = document.getElementById("tfCountdown");
      if (el) el.textContent = m + "m " + (s < 10 ? "0" : "") + s + "s বাকি";
      if (left <= 0 && tfCountdownIv) {
        clearInterval(tfCountdownIv);
        tfCountdownIv = null;
      }
    };
    tick();
    tfCountdownIv = setInterval(tick, 1000);
    // Poll order status every 8s
    let startBal = null;
    tfPollIv = setInterval(async function () {
      try {
        const token = getToken();
        if (!token) return;
        const d = await walletPost({ action: "wallet_auth", sub: "me", token: token });
        if (!d || !d.ok) return;
        const bal = Number(d.balance) || 0;
        if (startBal === null) startBal = bal;
        if (tfState.orderId) {
          const url = api();
          if (url) {
            const res = await fetch(url + "?order_id=" + encodeURIComponent(tfState.orderId));
            const data = await res.json();
            if (data && String(data.status || "").toLowerCase() === "completed") {
              tfStopTimers();
              const msg = document.getElementById("walletTopMsg");
              if (msg) msg.innerHTML = "✅ টপ-আপ সফল!";
              refreshWalletUI();
              refreshUserDash();
              tfShow("tfStepA");
              showWalletView();
              alert("টপ-আপ ভেরিফাই হয়েছে। ব্যালেন্স আপডেট হয়েছে।");
              return;
            }
          }
        }
        // Balance increased while waiting
        if (startBal !== null && bal > startBal + 0.01) {
          tfStopTimers();
          refreshWalletUI();
          refreshUserDash();
          tfShow("tfStepA");
          showWalletView();
          alert("টপ-আপ সফল! নতুন ব্যালেন্স: ৳" + bal.toFixed(2));
        }
      } catch (e) {}
    }, 8000);
  }

  function tfSelectMethod(method) {
    tfState.method = method;
    document.querySelectorAll(".tf-method").forEach(function (b) {
      const on = b.getAttribute("data-method") === method;
      b.classList.toggle("selected", on);
      b.setAttribute("aria-checked", on ? "true" : "false");
    });
    const go = document.getElementById("tfGoPayer");
    if (go) go.disabled = !(Number(document.getElementById("walTopAmount").value) >= MIN_TOPUP && method);
  }

  function tfGoToPayer() {
    const amount = Number((document.getElementById("walTopAmount") || {}).value);
    if (!amount || amount < MIN_TOPUP) {
      alert("সর্বনিম্ন " + MIN_TOPUP + " টাকা");
      return;
    }
    if (!tfState.method) {
      alert("মেথড বেছে নিন");
      return;
    }
    tfState.amount = amount;
    const n = document.getElementById("tfPayerMethodName");
    if (n) n.textContent = tfState.method;
    tfShow("tfStepB");
  }

  async function tfCreatePendingAndWait() {
    const sender = ((document.getElementById("walTopSender") || {}).value || "").trim();
    const msg = document.getElementById("walletTopMsg");
    const token = getToken();
    if (!token) {
      if (msg) msg.textContent = "আগে লগইন করুন";
      return;
    }
    const digits = sender.replace(/\D/g, "");
    if (digits.length < 10) {
      alert("যে নম্বর থেকে পাঠাবেন সেটি লিখুন");
      return;
    }
    tfState.sender = digits.slice(0, 11);
    tfState.orderId = "";
    // Show Paymently-style wait screen (order created when TrxID submitted or SMS matched after submit)
    const num = TF_PAY_NUMBERS[tfState.method] || "01921018882";
    ["tfWaitMethod", "tfWaitMethod2"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.textContent = tfState.method;
    });
    ["tfWaitAmount", "tfWaitAmount2"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.textContent = String(tfState.amount);
    });
    const pn = document.getElementById("tfPayNumber");
    if (pn) pn.textContent = num;
    const pn2 = document.getElementById("tfPayNumber2");
    if (pn2) pn2.textContent = num;
    const pa = document.getElementById("tfPayAmtCopy");
    if (pa) pa.textContent = tfState.amount + " BDT";
    const pa2 = document.getElementById("tfPayAmt2");
    if (pa2) pa2.textContent = tfState.amount + " BDT";
    const pid = document.getElementById("tfPendingId");
    if (pid) pid.textContent = "পেমেন্ট পাঠানোর পর নিচে থেকে TrxID সাবমিট করুন, অথবা SMS অটো-ভেরিফাইয়ের জন্য অপেক্ষা করুন।";
    if (msg) msg.textContent = "";
    tfShow("tfStepC");
    tfStartCountdown();
  }

  async function doTopup() {
    // Manual TrxID submit (step D) — update existing pending or create with real trx
    const amount = tfState.amount || Number((document.getElementById("walTopAmount") || {}).value);
    const method = tfState.method || "bKash";
    const txn = ((document.getElementById("walTopTxn") || {}).value || "").trim();
    const msg = document.getElementById("walletTopMsg");
    const token = getToken();
    if (!token) {
      if (msg) msg.textContent = "আগে লগইন করুন";
      return;
    }
    if (!amount || amount < MIN_TOPUP) {
      if (msg) msg.textContent = "সর্বনিম্ন " + MIN_TOPUP + " টাকা";
      return;
    }
    if (!txn || txn.length < 6) {
      if (msg) msg.textContent = "সঠিক TrxID দিন";
      return;
    }
    if (msg) msg.textContent = "জমা হচ্ছে…";
    try {
      const d = await walletPost({
        action: "wallet_topup",
        token: token,
        amount: amount,
        paid_from: method,
        txn_id: txn,
        sender: tfState.sender || "",
        comments: tfState.sender ? ("sender:" + tfState.sender) : "",
        replace_order_id: tfState.orderId || ""
      });
      if (!d || !d.ok) {
        if (msg) msg.textContent = (d && d.message) || (d && d.error) || "টপ-আপ ব্যর্থ";
        return;
      }
      tfStopTimers();
      if (msg) {
        msg.innerHTML = "টপ-আপ ID: <b>" + esc(d.order_id) + "</b><br>" +
          esc(d.message || "") +
          (d.status === "Completed" ? "<br>নতুন ব্যালেন্স: ৳" + (Number(d.balance) || 0) : "<br>ভেরিফাই হলে ব্যালেন্স যোগ হবে।");
      }
      if (d.status === "Completed") {
        if (d.balance != null) window._walletBalance = Number(d.balance);
        refreshWalletUI();
        refreshUserDash();
        tfShow("tfStepA");
      } else {
        tfState.orderId = d.order_id || tfState.orderId;
        tfShow("tfStepC");
        tfStartCountdown();
      }
      // টপ-আপ অর্ডার নয়: lastOrderId (Track Order) এ সেভ করা হয় না
    } catch (e) {
      if (msg) msg.textContent = netErrMsg(e);
    }
  }

  function wireTopupFlow() {
    document.querySelectorAll(".tf-method").forEach(function (b) {
      b.addEventListener("click", function () {
        tfSelectMethod(b.getAttribute("data-method"));
      });
      b.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          tfSelectMethod(b.getAttribute("data-method"));
        }
      });
    });
    const amt = document.getElementById("walTopAmount");
    if (amt) amt.addEventListener("input", function () {
      const go = document.getElementById("tfGoPayer");
      if (go) go.disabled = !(Number(amt.value) >= MIN_TOPUP && tfState.method);
    });
    const goP = document.getElementById("tfGoPayer");
    if (goP) goP.addEventListener("click", tfGoToPayer);
    ["tfBackA", "tfBackA2"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", function () { tfStopTimers(); tfShow("tfStepA"); });
    });
    const goW = document.getElementById("tfGoWait");
    if (goW) goW.addEventListener("click", tfCreatePendingAndWait);
    const backB = document.getElementById("tfBackB");
    if (backB) backB.addEventListener("click", function () { tfStopTimers(); tfShow("tfStepB"); });
    const backC = document.getElementById("tfBackC");
    if (backC) backC.addEventListener("click", function () { tfShow("tfStepC"); tfStartCountdown(); });
    const fb = document.getElementById("tfFallbackLink");
    if (fb) fb.addEventListener("click", function (e) {
      e.preventDefault();
      tfShow("tfStepD");
    });
    function copyText(t) {
      try {
        navigator.clipboard.writeText(t);
        alert("কপি হয়েছে");
      } catch (e) {
        const ta = document.createElement("textarea");
        ta.value = t;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        alert("কপি হয়েছে");
      }
    }
    const cn = document.getElementById("tfCopyNum");
    if (cn) cn.addEventListener("click", function () {
      copyText((document.getElementById("tfPayNumber") || {}).textContent || "");
    });
    const ca = document.getElementById("tfCopyAmt");
    if (ca) ca.addEventListener("click", function () {
      copyText(String(tfState.amount || ""));
    });
  }



  async function placeWalletOrder() {
    const msg = document.getElementById("walletPayMsg");
    const token = getToken();
    if (!token) {
      if (msg) msg.textContent = "আগে Wallet ট্যাব থেকে লগইন করুন";
      return;
    }
    if (typeof selectedPackage === "undefined" || !selectedPackage) {
      if (msg) msg.textContent = "সার্ভিস সিলেক্ট নেই";
      return;
    }
    const link = (document.getElementById("orderLink") || {}).value || "";
    const qty = Number((document.getElementById("orderQuantity") || {}).value || 0);
    const total = Number((document.getElementById("payAmountDisplay") || {}).innerText || 0);
    if (!link || !qty) {
      if (msg) msg.textContent = "লিংক/পরিমাণ ঠিক করুন";
      return;
    }
    if (!confirm("Wallet থেকে ৳" + total.toFixed(2) + " কেটে অর্ডার হবে। OK?")) return;
    if (msg) msg.textContent = "প্রসেস হচ্ছে…";
    const btn = document.getElementById("walletPayBtn");
    if (btn) btn.disabled = true;
    try {
      const d = await walletPost({
        action: "wallet_order",
        token: token,
        service_code: selectedPackage.code,
        service_name: selectedPackage.name,
        platform: selectedPackage.platform || "",
        link: link,
        quantity: qty,
        comments: (typeof orderComments !== "undefined" ? orderComments : "") || "",
        amount: total
      });
      if (!d || !d.ok) {
        if (msg) msg.textContent = (d && d.message) || (d && d.error) || "অর্ডার ব্যর্থ";
        if (btn) btn.disabled = false;
        return;
      }
      if (msg) msg.textContent = "সফল! Order: " + d.order_id + " · ব্যালেন্স ৳" + (Number(d.balance) || 0).toFixed(2);
      try { localStorage.setItem("lastOrderId", d.order_id); } catch (e) {}
      // Show success-ish pending with processing
      if (typeof showSuccessStatus === "function") {
        showSuccessStatus({
          order_id: d.order_id,
          service_code: selectedPackage.code,
          service_name: selectedPackage.name,
          platform: selectedPackage.platform || "",
          link: link,
          quantity: qty,
          amount: d.amount,
          txn_id: "WALLET",
          paid_from: "Wallet",
          whatsapp: getMobile(),
          status: "Processing",
          created_at: new Date().toISOString()
        });
      } else if (typeof showPendingStatus === "function") {
        showPendingStatus({
          order_id: d.order_id,
          service_name: selectedPackage.name,
          amount: d.amount,
          status: "Processing",
          paid_from: "Wallet",
          txn_id: "WALLET"
        });
      } else {
        alert("অর্ডার সফল: " + d.order_id + "\nProcessing এ আছে। Track Order থেকে দেখুন।");
      }
      // hide gateway grids
      const go = document.getElementById("gateway-overlay");
      if (go) {
        // leave success views to handlers
      }
    } catch (e) {
      if (msg) msg.textContent = netErrMsg(e);
    }
    if (btn) btn.disabled = false;
  }

  async function refreshWalletPayBox() {
    const box = document.getElementById("walletPayBox");
    if (!box) return;
    const token = getToken();
    if (!token) {
      box.style.display = "none";
      return;
    }
    box.style.display = "block";
    try {
      const d = await walletPost({ action: "wallet_auth", sub: "me", token: token });
      const label = document.getElementById("walletPayBalLabel");
      const need = Number((document.getElementById("payAmountDisplay") || {}).innerText || 0);
      if (d && d.ok) {
        const bal = Number(d.balance) || 0;
        if (label) label.textContent = "ব্যালেন্স ৳" + bal.toFixed(2) + (need ? (" · দরকার ৳" + need.toFixed(2)) : "");
        const btn = document.getElementById("walletPayBtn");
        if (btn) {
          btn.disabled = bal < need;
          btn.textContent = bal < need ? "ব্যালেন্স কম — টপ-আপ করুন" : "Wallet দিয়ে পে";
        }
      } else {
        box.style.display = "none";
      }
    } catch (e) {
      box.style.display = "none";
    }
  }

  window.refreshWalletPayBox = refreshWalletPayBox;
  window.placeWalletOrder = placeWalletOrder;

  // ---------- Instant wallet order (no payment popup) + "Your order received" box at the top ----------
  function abEsc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function abShowResult(ok, html) {
    const box = document.getElementById("abOrderResult");
    if (!box) return;
    box.style.display = "block";
    box.style.background = ok ? "#0d2b20" : "#2b1010";
    box.style.border = ok ? "1px solid #14532d" : "1px solid #7f1d1d";
    box.style.color = ok ? "#6ee7b7" : "#fca5a5";
    box.innerHTML = '<button type="button" aria-label="close" id="abOrderResultX" style="position:absolute;top:8px;right:10px;background:none;border:none;color:inherit;font-size:18px;cursor:pointer;">✕</button>' + html;
    const x = document.getElementById("abOrderResultX");
    if (x) x.addEventListener("click", function () { box.style.display = "none"; });
    try { box.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {}
  }

  // ---------- ব্যালেন্স কম: ফর্মে "টপ-আপ করুন" বাটন (ধাপ ৭) ----------
  // অর্ডার শুধু ওয়ালেট ব্যালেন্স থেকে হয়। ব্যালেন্স কম হলে সরাসরি bKash/Nagad/Rocket পেমেন্ট আর খোলে না;
  // বদলে ফর্মে #abLowBal বক্স আসে, বাটন চাপলে টপ-আপ পেজ খোলে (দরকারি অ্যামাউন্ট আগে থেকে বসানো)।
  function lowBalSet(total, bal) {
    const box = document.getElementById("abLowBal");
    if (!box) return;
    if (!(total > 0) || isNaN(bal) || bal >= total) { box.hidden = true; return; }
    const need = Math.max(MIN_TOPUP, Math.ceil(total - bal));
    const txt = document.getElementById("abLowBalTxt");
    if (txt) txt.textContent = "ব্যালেন্স ৳" + bal.toFixed(2) + " · দরকার ৳" + total.toFixed(2);
    const btn = document.getElementById("abLowBalBtn");
    if (btn) btn.setAttribute("data-amt", String(need));
    box.hidden = false;
  }
  function lowBalOpenTopup() {
    const btn = document.getElementById("abLowBalBtn");
    const amt = Number(btn && btn.getAttribute("data-amt")) || 0;
    showTopupView();
    const inp = document.getElementById("walTopAmount");
    if (inp && amt >= MIN_TOPUP) {
      inp.value = String(amt);
      try { inp.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
    }
  }
  let _lowBalFetching = false;
  // ফর্মে কোয়ান্টিটি/লিংক বদলালেই চার্জ অনুযায়ী ব্যালেন্স যাচাই (ব্যালেন্স না জানা থাকলে একবার এনে ক্যাশ)
  async function pbLowBalCheck(total) {
    const box = document.getElementById("abLowBal");
    if (!box) return;
    const token = getToken();
    if (!token || !(total > 0)) { box.hidden = true; return; }
    let bal = Number(window._walletBalance);
    if (isNaN(bal)) {
      if (_lowBalFetching) return;
      _lowBalFetching = true;
      try {
        const me = await walletPost({ action: "wallet_auth", sub: "me", token: token });
        if (me && me.ok) { bal = Number(me.balance) || 0; window._walletBalance = bal; }
      } catch (e) {}
      _lowBalFetching = false;
      if (isNaN(bal)) return;
    }
    lowBalSet(total, bal);
  }
  window.pbLowBalCheck = pbLowBalCheck;

  /** অর্ডার সবসময় এখানেই শেষ হয় (সফল বা দেখানো এরর) — সরাসরি পেমেন্ট পপআপ আর নেই।
   *  সবসময় ফ্রেশ ব্যালেন্স আনা হয়, যাতে টপ-আপের পর পুরনো ক্যাশ ব্যালেন্সে আটকে না যায়। */
  async function walletInstantOrder(pkg, link, qty, comments) {
    const token = getToken();
    if (!token) { location.href = "login.html"; return true; }
    if (!pkg) return true;
    const price = (typeof packageSellPrice === "function") ? packageSellPrice(pkg) : 0;
    const total = Number(((price * Number(qty)) / 1000).toFixed(2));
    if (!total || total <= 0) {
      abShowResult(false, "<b>অর্ডার হয়নি</b><br>দাম যাচাই করা যায়নি। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
      return true;
    }
    let bal;
    try {
      const me = await walletPost({ action: "wallet_auth", sub: "me", token: token });
      if (!me || !me.ok) {
        abShowResult(false, "<b>লগইন সেশন শেষ</b><br>আবার <a href=\"login.html\" style=\"color:inherit;text-decoration:underline;\">লগইন করুন</a>।");
        return true;
      }
      bal = Number(me.balance) || 0;
      window._walletBalance = bal;
    } catch (e) {
      abShowResult(false, "<b>অর্ডার হয়নি</b><br>" + abEsc(netErrMsg(e)));
      return true;
    }
    lowBalSet(total, bal);   // ফ্রেশ ব্যালেন্সে যথেষ্ট হলে আগের (পুরনো) সতর্কবার্তা লুকায়
    if (bal < total) {
      const lb = document.getElementById("abLowBal");
      if (lb) { try { lb.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {} }
      return true;
    }
    try {
      const d = await walletPost({
        action: "wallet_order",
        token: token,
        service_code: pkg.code,
        service_name: pkg.name,
        platform: pkg.platform || "",
        link: link,
        quantity: Number(qty),
        comments: comments || "",
        amount: total
      });
      if (!d || !d.ok) {
        if (d && d.error === "auth") {
          abShowResult(false, "<b>লগইন সেশন শেষ</b><br>আবার <a href=\"login.html\" style=\"color:inherit;text-decoration:underline;\">লগইন করুন</a>।");
          return true;
        }
        if (d && d.balance != null) window._walletBalance = Number(d.balance);
        if (d && d.error === "insufficient_balance") {
          lowBalSet(total, Number(d.balance) || 0);
          return true;
        }
        abShowResult(false, "<b>অর্ডার হয়নি</b><br>" + abEsc((d && (d.message || d.error)) || "অর্ডার ব্যর্থ। আবার চেষ্টা করুন।"));
        return true;
      }
      if (d.balance != null) window._walletBalance = Number(d.balance);
      try { localStorage.setItem("lastOrderId", d.order_id); } catch (e) {}
      const charged = (d.amount != null ? Number(d.amount) : total);
      abShowResult(true,
        '<div style="font-size:22px;font-weight:700;margin-bottom:6px;">Your order received</div>' +
        "ID: " + abEsc(d.order_id) + "<br>" +
        "Service: " + abEsc(pkg.name) + "<br>" +
        "Link: " + abEsc(link) + "<br>" +
        "Quantity: " + abEsc(qty) + "<br>" +
        "Charge: ৳" + charged.toFixed(2) + "<br>" +
        "Balance: ৳" + (Number(d.balance) || 0).toFixed(2));
      ["abLink", "abQty", "abComments"].forEach(function (id) { const el = document.getElementById(id); if (el) el.value = ""; });
      lowBalSet(0, 0);
      try { refreshWalletUI(); } catch (e) {}
      try { refreshUserDash(); } catch (e) {}
      return true;
    } catch (e) {
      abShowResult(false, "<b>অর্ডার হয়নি</b><br>" + abEsc(netErrMsg(e)) + "<br><small>টাকা কাটা হয়েছে কি না নিশ্চিত হতে Wallet ব্যালেন্স দেখুন বা Track Order চেক করুন।</small>");
      return true;
    }
  }
  window.walletInstantOrder = walletInstantOrder;




  document.addEventListener("DOMContentLoaded", function () {
    const btnReg = document.getElementById("walBtnRegister");
    const btnLogin = document.getElementById("walBtnLogin");
    const btnSetPin = document.getElementById("walBtnSetPin");
    const btnLogout = document.getElementById("walBtnLogout");
    const btnTop = document.getElementById("walBtnTopup");
    if (btnReg) btnReg.addEventListener("click", doRegister);
    if (btnLogin) btnLogin.addEventListener("click", doLogin);
    if (btnSetPin) btnSetPin.addEventListener("click", doSetPin);
    if (btnLogout) btnLogout.addEventListener("click", doLogout);
    const on = function (id, fn) { const el = document.getElementById(id); if (el) el.addEventListener("click", fn); };
    on("walBtnChangePin", doChangePin);
    on("walBtnForgotSend", doForgotSend);
    on("walBtnForgotReset", doForgotReset);
    on("pbSideChangePin", function () {
      const sc = document.getElementById("pbSidebarClose");
      if (sc) sc.click();
      if (!getToken()) { showWalletView(); return; }
      document.querySelectorAll(".view-section").forEach(function (el) { el.style.display = "none"; });
      const v = document.getElementById("pin-view");
      if (v) v.style.display = "block";
      window.scrollTo(0, 0);
    });
    on("pinBackWallet", showWalletView);
    on("walBtnForgot", function () {
      const m = document.getElementById("walForgotMobile");
      if (m && !m.value) m.value = val("walLoginMobile");
      walShowAuthTab("forgot");
    });
    on("walBtnForgotBack", function () { walShowAuthTab("login"); });
    if (btnTop) btnTop.addEventListener("click", doTopup);

    const tabLogin = document.getElementById("walTabBtnLogin");
    const tabReg = document.getElementById("walTabBtnRegister");
    const panelLogin = document.getElementById("walPanelLogin");
    const panelReg = document.getElementById("walPanelRegister");
    const panelForgot = document.getElementById("walPanelForgot");
    function walShowAuthTab(which) {
      const onLogin = which === "login";
      const onForgot = which === "forgot";
      if (panelLogin) panelLogin.style.display = onLogin ? "grid" : "none";
      if (panelReg) panelReg.style.display = which === "register" ? "grid" : "none";
      if (panelForgot) panelForgot.style.display = onForgot ? "grid" : "none";
      if (tabLogin) {
        tabLogin.style.background = onLogin ? "#6ee7b7" : "transparent";
        tabLogin.style.color = onLogin ? "#0b0f14" : "#94a3b8";
      }
      if (tabReg) {
        const r = which === "register";
        tabReg.style.background = r ? "#6ee7b7" : "transparent";
        tabReg.style.color = r ? "#0b0f14" : "#94a3b8";
      }
    }
    // walShowAuthTab is defined above; handlers for the buttons registered earlier call it lazily
    if (tabLogin) tabLogin.addEventListener("click", function () { walShowAuthTab("login"); });
    if (tabReg) tabReg.addEventListener("click", function () { walShowAuthTab("register"); });

    function wirePinToggle(btnId, inputId) {
      const btn = document.getElementById(btnId);
      const input = document.getElementById(inputId);
      if (!btn || !input) return;
      btn.addEventListener("click", function () {
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.textContent = show ? "🙈" : "👁";
      });
    }
    wirePinToggle("walToggleLoginPin", "walLoginPin");
    wirePinToggle("walToggleRegPin", "walRegPin");
    wirePinToggle("walToggleOldPin", "walOldPin");
    wirePinToggle("walToggleNewPin", "walNewPin");
    wirePinToggle("walToggleConfirmPin", "walConfirmPin");
    wirePinToggle("walToggleForgotNew", "walForgotNewPin");
    wirePinToggle("walToggleForgotConfirm", "walForgotConfirmPin");

    wireTopupFlow();
    const tpBtn = document.getElementById("walBtnTopupPage");
    if (tpBtn) tpBtn.addEventListener("click", showTopupView);
    const tpBack = document.getElementById("tfBackWallet");
    if (tpBack) tpBack.addEventListener("click", function () { tfStopTimers(); showWalletView(); });
    // Add Funds card: live summary + Pay button label + quick-amount highlight
    (function afWire() {
      const amtEl = document.getElementById("walTopAmount");
      const goBtn = document.getElementById("tfGoPayer");
      if (!amtEl) return;
      function money(n) { return "৳" + (Number(n) || 0).toFixed(2); }
      function refresh() {
        const v = Number(amtEl.value) || 0;
        const a = document.getElementById("afSumAmount");
        const f = document.getElementById("afSumFee");
        const t = document.getElementById("afSumTotal");
        if (a) a.textContent = money(v);
        if (f) f.textContent = money(0);
        if (t) t.textContent = money(v);
        if (goBtn) goBtn.textContent = v >= MIN_TOPUP ? "Pay ৳" + v.toFixed(2) : "Pay";
        document.querySelectorAll(".tf-qamt").forEach(function (b) {
          b.classList.toggle("active", Number(b.getAttribute("data-amt")) === v);
        });
      }
      amtEl.addEventListener("input", refresh);
      document.querySelectorAll(".tf-qamt").forEach(function (b) {
        b.addEventListener("click", function () { setTimeout(refresh, 0); });
      });
      refresh();
    })();
    const histBtn = document.getElementById("walBtnHistory");
    if (histBtn) histBtn.addEventListener("click", loadWalletHistory);
    document.querySelectorAll(".tf-qamt").forEach(function (b) {
      b.addEventListener("click", function () {
        const inp = document.getElementById("walTopAmount");
        if (inp) inp.value = b.getAttribute("data-amt");
        const go = document.getElementById("tfGoPayer");
        if (go) go.disabled = !(Number(inp && inp.value) >= MIN_TOPUP && tfState.method);
      });
    });

    const nav = document.getElementById("navWalletBtn");
    if (nav) nav.addEventListener("click", function (e) {
      e.preventDefault();
      showWalletView();
    });

    const tab = document.querySelector('.main-tab[data-view="wallet"]');
    if (tab) tab.addEventListener("click", function () { showWalletView(); });

    const loginBtn = document.getElementById("udLoginBtn");
    if (loginBtn) {
      loginBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        showWalletView();
      });
    }

    const addFund = document.getElementById("udAddFundBtn");
    if (addFund) {
      addFund.addEventListener("click", function (e) {
        e.preventDefault();
        if (getToken()) { showTopupView(); } else { showWalletView(); }
      });
    }

    const lowBtn = document.getElementById("abLowBalBtn");
    if (lowBtn) lowBtn.addEventListener("click", lowBalOpenTopup);

    const wPay = document.getElementById("walletPayBtn");
    if (wPay) wPay.addEventListener("click", placeWalletOrder);

    refreshUserDash();
  });
})();
