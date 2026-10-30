/* ==========================================================
   app-misc.js — Provider (service code) lookup, FAQ accordion, live
   order counter, recent-orders toast and the payment-proof gallery.
   ========================================================== */

// ========== Provider Lookup ==========
let lookupPlatform = "all";

function runProviderLookup() {
  const input = document.getElementById("lookupInput");
  const out = document.getElementById("lookupResult");
  if (!input || !out) return;

  const q = (input.value || "").trim().toLowerCase();
  if (!q) {
    out.innerHTML = '<div class="lookup-empty">সার্ভিস কোড বা নাম লিখুন।</div>';
    return;
  }

  let list = allPackages.slice();
  if (lookupPlatform !== "all") {
    list = list.filter(p => p.platform === lookupPlatform);
  }

  // Score matches — exact code is king
  const scored = [];
  for (const pkg of list) {
    const code = String(pkg.code || "").toLowerCase();
    const name = String(pkg.name || "").toLowerCase();
    const cat = String(pkg.category || "").toLowerCase();
    let score = 0;
    let exact = false;
    if (code === q) { score = 1000; exact = true; }
    else if (code.startsWith(q)) score = 800;
    else if (code.includes(q)) score = 600;
    else if (name === q) score = 500;
    else if (name.startsWith(q)) score = 400;
    else if (name.includes(q) || cat.includes(q)) score = 200;
    else continue;

    scored.push({ pkg, score, exact });
  }

  scored.sort((a, b) => b.score - a.score);

  if (!scored.length) {
    out.innerHTML = '<div class="lookup-empty">কোনো মিল পাওয়া যায়নি। অন্য কোড চেষ্টা করুন বা প্ল্যাটফর্ম All করুন।</div>';
    return;
  }

  // Prefer showing exact matches first (already sorted); cap list
  const top = scored.slice(0, 30);
  out.innerHTML = top.map(({ pkg, exact }) => {
    const price = getFinalPrice(pkg).toFixed(2);
    const badge = exact ? '<span class="lookup-badge">EXACT CODE</span>' : '';
    const platformBadge = getPlatformBadge(pkg.platform);
    return `
      <div class="lookup-card${exact ? ' exact' : ''}">
        <div class="lookup-card-top">
          <div class="lookup-code">${escapeHtml(pkg.code)}${badge}</div>
          <div class="lookup-price">৳${price} / 1K</div>
        </div>
        <div class="lookup-name service-name">${platformBadge}<span class="service-name-text">${escapeHtml(pkg.name)}</span></div>
        <div class="lookup-meta">Platform: ${escapeHtml(pkg.platform)} · ${escapeHtml(pkg.category || '—')}</div>
        <div class="lookup-meta">Min ${pkg.min} – Max ${pkg.max}</div>
      </div>`;
  }).join("");
}

function setupProviderLookup() {
  document.querySelectorAll("#lookupPlatforms .lookup-plat").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#lookupPlatforms .lookup-plat").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      lookupPlatform = btn.dataset.platform || "all";
      runProviderLookup();
    });
  });
  const input = document.getElementById("lookupInput");
  const btn = document.getElementById("lookupBtn");
  if (btn) btn.addEventListener("click", runProviderLookup);
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        runProviderLookup();
      }
    });
  }
}

setupProviderLookup();


/* FAQ accordion */
document.querySelectorAll(".faq-question").forEach((btn) => {
  btn.addEventListener("click", () => {
    const item = btn.closest(".faq-item");
    const wasOpen = item.classList.contains("open");
    document.querySelectorAll(".faq-item.open").forEach((el) => el.classList.remove("open"));
    if (!wasOpen) item.classList.add("open");
  });
});

/* Live order count — fetched from the Orders sheet via Apps Script.
   Falls back silently to whatever number is already in the HTML
   (the last known count) if the request fails, e.g. offline. */
(function loadLiveOrderStats() {
  const api = sheetApi();
  const statEl = document.getElementById("statOrders");
  const itemEl = document.getElementById("statOrdersItem");
  if (!api || !statEl || !itemEl) return;

  // অর্ডার সংখ্যা ছোট থাকলে ভরসা কমায় — তাই ১০০ বা তার বেশি হলেই দেখাই (সত্যি সংখ্যা, কোনো ফেক নয়)।
  // ১০০-র নিচে বা রিকোয়েস্ট ফেল করলে আইটেমটা লুকানোই থাকে।
  const MIN_SHOW = 100;
  fetch(`${api}?stats=1`)
    .then((res) => res.json())
    .then((data) => {
      if (data && data.ok && typeof data.total_orders === "number" && data.total_orders >= MIN_SHOW) {
        statEl.textContent = data.total_orders;
        itemEl.hidden = false;
      }
    })
    .catch(() => {});
})();

// ---------- Recent-completed-orders social-proof toast ----------
// Cycles through a handful of recently Completed orders (fetched from the
// public, non-sensitive "recent_completed" feed — no TrxID, no full mobile
// number) as small toasts in the corner. Purely trust-building; if the
// fetch fails or there's nothing to show yet, it just stays hidden.
(function () {
  // বন্ধ রাখা হয়েছে (পপআপ বিরক্তিকর)। অর্ডার অনেক বাড়লে true করলেই চালু হবে।
  const SHOW_RECENT_ORDER_TOAST = false;
  if (!SHOW_RECENT_ORDER_TOAST) return;
  const toastEl = document.getElementById("recentOrderToast");
  if (!toastEl) return;
  const api = sheetApi();
  if (!api) return;

  fetch(api + "?action=recent_completed")
    .then(r => r.json())
    .then(data => {
      const orders = (data && data.orders) || [];
      if (!orders.length) return;

      let idx = 0;
      let shownCount = 0;
      const MAX_SHOWS = 2; // দুইবারের বেশি টোস্ট দেখানো হবে না
      function showNext() {
        if (shownCount >= MAX_SHOWS) {
          clearInterval(intervalId);
          return;
        }
        const o = orders[idx % orders.length];
        idx++;
        shownCount++;
        const service = (o.service_name || "").length > 42
          ? o.service_name.slice(0, 42) + "…"
          : (o.service_name || "");
        toastEl.innerHTML =
          '<span class="rt-icon">🎉</span>' +
          '<span class="rt-body"><b>' + escapeHtml(o.mobile_masked || "একজন কাস্টমার") + '</b> সবেমাত্র ' +
          '<b>' + escapeHtml(o.quantity || "") + '</b> ' + escapeHtml(service) + ' অর্ডার সম্পন্ন করেছেন' +
          '<span class="rt-time">✅ Completed' + (o.took ? ' · ⏱ ' + escapeHtml(o.took) + ' এ' : '') + '</span></span>';
        toastEl.classList.add("show");
        setTimeout(() => toastEl.classList.remove("show"), 4500);
        if (shownCount >= MAX_SHOWS) clearInterval(intervalId);
      }

      showNext();
      const intervalId = setInterval(showNext, 7500);
    })
    .catch(() => {
      // Silent — this widget is a nice-to-have, never worth an error to the user.
    });
})();

/* Home-only hero/features/FAQ/footer: body.is-home follows the visible view */
(function () {
  function sync() {
    var sv = document.getElementById("services-view");
    var home = !!sv && sv.style.display !== "none";
    document.body.classList.toggle("is-home", home);
  }
  function init() {
    sync();
    var mo = new MutationObserver(sync);
    document.querySelectorAll(".view-section").forEach(function (el) {
      mo.observe(el, { attributes: true, attributeFilter: ["style"] });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
