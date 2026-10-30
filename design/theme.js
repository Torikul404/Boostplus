/* design/theme.js — থিম লোডার (ধাপ ২)
   ১) localStorage থেকে সঙ্গে সঙ্গে থিম বসায় (ফ্ল্যাশ ছাড়া)
   ২) অ্যাডমিন সেট করা মোড (premium | light | toggle) API থেকে আনে
   ৩) toggle মোডে ডার্ক/লাইট সুইচ দেখায় */
(function () {
  var D = document.documentElement, KEY_MODE = "pb_theme_mode", KEY_PICK = "pb_theme_pick";
  
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function apply(mode) {
    if (mode !== "premium" && mode !== "light" && mode !== "toggle") mode = "premium";
    var theme = mode === "toggle" ? (ls(KEY_PICK) === "light" ? "light" : "premium") : mode;
    D.setAttribute("data-theme", theme); D.setAttribute("data-theme-mode", mode);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", theme === "light" ? "#f4f6fb" : "#0b1020");
    syncToggle();
  }
  function syncToggle() {
    var b = document.getElementById("pbThemeToggle"); if (!b) return;
    var mode = D.getAttribute("data-theme-mode"); b.hidden = mode !== "toggle";
    b.setAttribute("aria-label", D.getAttribute("data-theme") === "light" ? "ডার্ক মোড" : "লাইট মোড");
  }
  function mountToggle() {
    if (document.getElementById("pbThemeToggle")) return;
    var tabs = document.querySelector(".site-nav-tabs"); if (!tabs) return;
    var b = document.createElement("button");
    b.type = "button"; b.id = "pbThemeToggle"; b.className = "pb-theme-toggle"; b.hidden = true;
    b.innerHTML = '<svg class="ic-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' +
      '<svg class="ic-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
    b.addEventListener("click", function () {
      ls(KEY_PICK, D.getAttribute("data-theme") === "light" ? "premium" : "light"); apply("toggle");
    });
    tabs.appendChild(b); syncToggle();
  }
  apply(ls(KEY_MODE) || "premium");                      // সঙ্গে সঙ্গে (ক্যাশ থেকে)
  function fetchMode() {
    var API = window.BOOSTPLUS_SHEET_API || ""; if (!API) return;
    fetch(API + "?action=theme_get&_=" + Date.now()).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.ok && j.mode) { ls(KEY_MODE, j.mode); apply(j.mode); }
    }).catch(function () {});
  }
  window.PBTheme = { apply: apply, refresh: fetchMode };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { mountToggle(); fetchMode(); });
  else { mountToggle(); fetchMode(); }
})();
