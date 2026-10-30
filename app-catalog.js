
/** Merge admin hide / speed / custom services from Apps Script */
async function applyServiceMeta(list) {
  try {
    const api = (typeof sheetApi === 'function' ? sheetApi() : (window.BOOSTPLUS_SHEET_API || '')).trim();
    if (!api || !list) return list;   // list খালি হলেও custom সার্ভিস মার্জ হবে (legacy সব লুকানো থাকলে)
    const res = await fetch(api + (api.indexOf('?') >= 0 ? '&' : '?') + 'action=service_meta', { method: 'GET' });
    const data = await res.json();
    if (!data || !data.ok) return list;
    const hidden = new Set((data.hidden || []).map(String));
    const speed = data.speed || {};
    window.PB_DISCOUNTS = (data.discounts && typeof data.discounts === 'object') ? data.discounts : {};
    window.PB_PRICES = (data.prices && typeof data.prices === 'object' && !Array.isArray(data.prices)) ? data.prices : {};
    window.PB_TOPUP_BONUS = (data.topup_bonus && data.topup_bonus.active && Array.isArray(data.topup_bonus.tiers)) ? data.topup_bonus : null;
    if (typeof window.pbRenderBonusUI === 'function') window.pbRenderBonusUI();
    let out = list.filter(p => !hidden.has(String(p.code)));
    out = out.map(p => {
      const sp = speed[String(p.code)];
      if (!sp) return p;
      const tags = Array.isArray(p.tags) ? p.tags.slice() : [];
      if (sp === 'instant' && !tags.includes('Instant')) tags.unshift('Instant');
      if (sp === 'slow' && !tags.includes('Slow')) tags.unshift('Slow');
      return Object.assign({}, p, { tags: tags, speed: sp });
    });
    // ডেলিভারি রেকর্ড: "পূর্বে এত সময়ে সম্পন্ন হয়েছে" ট্যাগের ডেটা (শুধু provider order + live tracking হওয়া অর্ডার থেকে)
    const dstats = data.speed_stats || {};
    const attachDelivery = p => {
      const d = dstats[String(p.code)];
      return d && d.label ? Object.assign({}, p, { delivery: d }) : p;
    };
    out = out.map(attachDelivery);
    const customs = Array.isArray(data.custom) ? data.custom : [];
    // একই প্ল্যাটফর্মে একই ক্যাটাগরি থাকলে কাস্টম সার্ভিস সেই ক্যাটাগরিতেই ঢুকবে; না থাকলে নতুন ক্যাটাগরি
    const catKey = c => String(c || '').toLowerCase().replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\uFE0F]/gu, ' ').replace(/\bnew\b|\bupdated\b|\bhot\b/g, ' ').replace(/[^a-z0-9\u0980-\u09FF]+/g, ' ').trim();
    const canon = new Map();
    const customCodes = new Set(customs.map(c => c && String(c.code)));
    out.forEach(p => { if (!p.category || customCodes.has(String(p.code))) return; const k = String(p.platform || '').toLowerCase() + '|' + catKey(p.category); if (!canon.has(k)) canon.set(k, p.category); });
    customs.forEach(c => {
      if (!c || !c.code) return;
      if (c.category) { const k = String(c.platform || '').toLowerCase() + '|' + catKey(c.category); if (!canon.has(k)) canon.set(k, c.category); else c = Object.assign({}, c, { category: canon.get(k) }); }
      if (hidden.has(String(c.code))) return;
      const exists = out.findIndex(p => String(p.code) === String(c.code));
      const sp = speed[String(c.code)] || c.speed;
      const tags = Array.isArray(c.tags) ? c.tags.slice() : [];
      if (sp === 'instant' && !tags.includes('Instant')) tags.unshift('Instant');
      if (sp === 'slow' && !tags.includes('Slow')) tags.unshift('Slow');
      const entry = attachDelivery(Object.assign({}, c, { tags: tags, speed: sp || c.speed }));
      if (exists >= 0) out[exists] = Object.assign({}, out[exists], entry);
      else out.push(entry);
    });
    return applyCategoryConfig(out, data);
  } catch (e) {
    console.log('service_meta skip', e);
    return list;
  }
}


/* ==========================================================
   Category customization (set from the Telegram admin bot)
   data.catcfg  : { "platform|Category": { name, icon, hide } }
   data.catmove : { "<code>": "platform|Category" }
   data.catorder: { platform: ["platform|Category", ...] }
   ========================================================== */
/* ---- Top Services: প্রতিটি প্ল্যাটফর্মের সেরা সার্ভিস (শুধু Telegram বট /top দিয়ে ম্যানুয়ালি যোগ করা সার্ভিস; না থাকলে খালি) ---- */
const PB_TOP_CAT = 'Top Services';
window.PB_TOP = {};          // { platform: [code, ...] } from admin
let _pbTopMemo = { ref: null, rank: new Map() };
function pbTopScore(p) {
  const tags = (Array.isArray(p.tags) ? p.tags : []).map(t => String(t).toLowerCase()), nm = String(p.name || '').toLowerCase();
  let sc = 0;
  if (tags.includes('non drop') || /non.?drop/.test(nm)) sc += 3;
  if (tags.some(t => t.includes('refill')) || /refill/.test(nm)) sc += 2;
  if (tags.includes('fast') || tags.includes('instant')) sc += 1;
  return sc;
}
function pbAutoTop(pkgs) {
  const num = p => parseFloat(String(p.pricePerK || '').replace(/[^0-9.]/g, '')) || 0;
  return pkgs.filter(p => p.popular && !/^(Other|Spam)/i.test(String(p.category || '')))
    .sort((a, b) => pbTopScore(b) - pbTopScore(a) || num(a) - num(b))
    .slice(0, 10).map(p => String(p.code));
}
function pbTopRank() {
  if (_pbTopMemo.ref === allPackages) return _pbTopMemo.rank;
  const rank = new Map();
  const by = {};
  allPackages.forEach(p => { (by[String(p.platform || '').toLowerCase()] = by[String(p.platform || '').toLowerCase()] || []).push(p); });
  Object.keys(by).forEach(pl => {
    const have = new Set(by[pl].map(p => String(p.code)));
    let codes = ((window.PB_TOP || {})[pl] || []).map(String).filter(c => have.has(c));
    // অটো ফলব্যাক বন্ধ — Top Services শুধু ম্যানুয়ালি (Telegram বট /top) যোগ করা সার্ভিস দেখাবে
    codes.forEach((c, i) => rank.set(c, i));
  });
  _pbTopMemo = { ref: allPackages, rank };
  return rank;
}
const pbIsTop = p => pbTopRank().has(String(p.code));

window.PB_CAT_ICON = {};   // "platform|DisplayName" -> emoji override
window.PB_CAT_RANK = {};   // "DisplayName" -> position (from admin ordering)

/** Auto emoji by category meaning, so the type is clear at a glance. */
function pbCatAutoIcon(name) {
  const t = String(name || '').toLowerCase();
  let e = '⭐';
  if (/live/.test(t)) e = '🔴';
  else if (/monetiz/.test(t)) e = '💰';
  else if (/spam|report/.test(t)) e = '🚩';
  else if (/fiverr|upwork/.test(t)) e = '💼';
  else if (/story/.test(t)) e = '📖';
  else if (/traffic/.test(t)) e = '🌐';
  else if (/pk battle/.test(t)) e = '⚔️';
  else if (/bot start/.test(t)) e = '🤖';
  else if (/poll|vote/.test(t)) e = '🗳️';
  else if (/stars|boost/.test(t)) e = '⭐';
  else if (/save/.test(t)) e = '🔖';
  else if (/impression|reach|stats/.test(t)) e = '📊';
  else if (/download/.test(t)) e = '⬇️';
  else if (/event/.test(t)) e = '📅';
  else if (/friend/.test(t)) e = '🤝';
  else if (/review/.test(t)) e = '⭐';
  else if (/package/.test(t)) e = '📦';
  else if (/share|retweet/.test(t)) e = '🔁';
  else if (/comment like/.test(t)) e = '👍';
  else if (/comment/.test(t)) e = '💬';
  else if (/react/.test(t)) e = '😍';
  else if (/page like/.test(t)) e = '👍';
  else if (/member|group/.test(t)) e = '👥';
  else if (/subscri/.test(t)) e = '🔔';
  else if (/follower/.test(t)) e = '👥';
  else if (/view|reel|video/.test(t)) e = '👁️';
  else if (/like/.test(t)) e = '❤️';
  else if (/engage/.test(t)) e = '📈';
  if (/bangladesh|\bbd\b|bd\+/.test(t)) e += '🇧🇩';
  else if (/\busa\b/.test(t)) e += '🇺🇸';
  return e;
}
function pbCatEmoji(name, platform) {
  if (name === PB_TOP_CAT) return '🏆';
  return window.PB_CAT_ICON[String(platform || '').toLowerCase() + '|' + name] || pbCatAutoIcon(name);
}

function applyCategoryConfig(list, data) {
  const cfg = (data && data.catcfg) || {};
  const move = (data && data.catmove) || {};
  const order = (data && data.catorder) || {};
  const added = Array.isArray(data && data.catadd) ? data.catadd : [];
  window.PB_TOP = (data && data.top && typeof data.top === 'object') ? data.top : {};
  const icons = {};
  window.PB_CAT_ICON = icons;
  window.PB_CAT_RANK = {};
  added.forEach(a => { if (a && a.icon) icons[String(a.platform).toLowerCase() + '|' + a.name] = a.icon; });
  const displayOf = (key) => { const c = cfg[key] || {}; return c.name || key.slice(key.indexOf('|') + 1); };
  const out = [];
  list.forEach(p => {
    const plat = String(p.platform || '').toLowerCase();
    const key = move[String(p.code)] || (plat + '|' + (p.category || 'Other'));
    const c = cfg[key] || {};
    if (c.hide) return;                                  // category removed/hidden from the app
    const display = displayOf(key);
    if (c.icon) icons[key.split('|')[0] + '|' + display] = c.icon;
    out.push(display === p.category ? p : Object.assign({}, p, { category: display }));
  });
  Object.keys(order).forEach(plat => {
    (order[plat] || []).forEach((key, i) => { const d = displayOf(key); if (!(d in window.PB_CAT_RANK)) window.PB_CAT_RANK[d] = i; });
  });
  return out;
}

/* ==========================================================
   app-catalog.js — Service browsing: platform/category tabs, search,
   filters, and the main renderPackages() list renderer.
   ========================================================== */

document.querySelectorAll('.main-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.main-tab').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');

    // Sidebar pages (Contact us / Tickets) live outside the tab system — hide them too.
    document.querySelectorAll('.pb-extra-view').forEach(v => { v.style.display = 'none'; });
    document.getElementById('services-view').style.display = 'none';
    document.getElementById('place-order-view').style.display = 'none';
    document.getElementById('track-order-view').style.display = 'none';
    document.getElementById('pending-view').style.display = 'none';
    const wv = document.getElementById('waiting-view');
    if (wv) wv.style.display = 'none';
    const stv = document.getElementById('submit-trx-view');
    if (stv) stv.style.display = 'none';
    const sv = document.getElementById('success-view');
    if (sv) sv.style.display = 'none';
    clearInterval(checkoutExpiryInterval);
    clearInterval(pendingPollInterval);
    clearTimeout(step3PromptTimeout);
    const pl = document.getElementById('provider-lookup-view');
    if (pl) pl.style.display = 'none';

    // Leaving the payment/order flow — bring the WhatsApp buttons back.
    const waStack = document.querySelector('.wa-stack');
    if (waStack) waStack.style.display = '';

    if (btn.dataset.view === 'services') {
      document.getElementById('services-view').style.display = 'block';
    }
    if (btn.dataset.view === 'track-order') {
      document.getElementById('track-order-view').style.display = 'block';
    }
    if (btn.dataset.view === 'provider-lookup') {
      if (pl) pl.style.display = 'block';
    }
  });
});

if (document.getElementById('gatewayCloseBtn')) {
  document.getElementById('gatewayCloseBtn').addEventListener('click', () => {
    // Closing the payment sheet returns to New Order (services) without
    // losing the person's place — they just pick a different service.
    document.querySelector('.main-tab[data-view="services"]').click();
  });
}

document.querySelectorAll('.platform-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activePlatform = btn.dataset.platform;
    document.querySelectorAll('.platform-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    currentLimit = 30;
    selectedCategory = '';
    selectedSubTag = ''; // platform changed → re-show category cards (in "all" mode)
    renderPackages();
  });
});

/* ================================================================
   Search → DROPDOWN (cards নয়)
   সার্চ বারে লিখলে সার্ভিসগুলো সার্চ বারের ঠিক নিচে ড্রপডাউন লিস্ট আকারে
   আসে। কোনো সার্ভিসে ট্যাপ করলে সরাসরি Order Form খোলে।
   (সার্চ আর main service-list কার্ড রেন্ডার করে না — searchQuery খালি থাকে;
   শুধু Filter (tag / price) আগের মতো কার্ড লিস্ট দেখায়।)
   ================================================================ */
const SEARCH_DD_MAX = 60;
let searchDdItems = [];
let searchDdActive = -1;
let searchDdTimer = null;

function searchDdEls() {
  return {
    input: document.getElementById('searchInput'),
    box: document.getElementById('searchDropdown')
  };
}

function closeSearchDropdown() {
  const { input, box } = searchDdEls();
  if (box) { box.style.display = 'none'; box.innerHTML = ''; }
  if (input) input.setAttribute('aria-expanded', 'false');
  searchDdItems = [];
  searchDdActive = -1;
}

function setSearchDdActive(i) {
  const { box } = searchDdEls();
  if (!box) return;
  const rows = box.querySelectorAll('.sd-item');
  if (!rows.length) return;
  searchDdActive = (i + rows.length) % rows.length;
  rows.forEach((r, idx) => r.classList.toggle('active', idx === searchDdActive));
  rows[searchDdActive].scrollIntoView({ block: 'nearest' });
}

function pickSearchResult(code) {
  const { input } = searchDdEls();
  if (input) { input.value = ''; input.blur(); }
  closeSearchDropdown();
  // প্যানেলগুলোর মতো: আলাদা Order Form-এ না গিয়ে সার্ভিসটি একই পেজের
  // Category → Service → Description → Link/Qty ফর্মে সিলেক্ট হয়ে যাবে।
  const pkg = allPackages.find(p => String(p.code) === String(code));
  if (!pkg) return;
  // Platform / tag ফিল্টার মিলিয়ে নিই, নইলে সার্ভিসটি ড্রপডাউন তালিকায় থাকবে না
  if (activePlatform !== 'all' && pkg.platform && pkg.platform !== activePlatform) {
    const pb = document.querySelector('.platform-btn[data-platform="' + pkg.platform + '"]') ||
               document.querySelector('.platform-btn[data-platform="all"]');
    if (pb) pb.click();
  }
  if (activePlatform !== 'all' && pkg.platform && pkg.platform !== activePlatform) activePlatform = 'all';
  if (activeTag && !matchesTag(pkg, activeTag)) { activeTag = ''; if (typeof syncFilterUI === 'function') syncFilterUI(); }
  selectedCategoryValue = pkg.category || 'Other';
  selectedServiceCode = String(pkg.code);
  const picker = document.getElementById('dropdownPicker');
  if (picker) picker.style.display = '';
  renderDropdownPicker();
  ['abLink', 'abQty', 'abComments'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  if (typeof updateAbCharge === 'function') updateAbCharge();
  const target = document.getElementById('abLink') || picker;
  try { if (picker) picker.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
  setTimeout(() => { try { if (target) target.focus({ preventScroll: true }); } catch (e) {} }, 350);
}

// প্রোভাইডারের নামে আসা "&amp;" / "&#39;" ইত্যাদি এন্টিটি আসল অক্ষরে ফেরত আনে
function decodeEntities(str) {
  const s = String(str === null || str === undefined ? '' : str);
  if (s.indexOf('&') < 0) return s;
  const ta = document.createElement('textarea');
  ta.innerHTML = s;
  return ta.value;
}

function renderSearchDropdown(q) {
  const { input, box } = searchDdEls();
  if (!box) return;
  if (!q) { closeSearchDropdown(); return; }

  let pool = allPackages.slice();
  if (activePlatform !== 'all') pool = pool.filter(p => p.platform === activePlatform);
  if (activeTag) pool = pool.filter(p => matchesTag(p, activeTag));
  const matches = pool.filter(p => matchesSearch(p, q));
  if (priceSort === 'low-high') matches.sort((a, b) => packageSellPrice(a) - packageSellPrice(b));
  else if (priceSort === 'high-low') matches.sort((a, b) => packageSellPrice(b) - packageSellPrice(a));
  else matches.sort((a, b) => searchRank(b, q) - searchRank(a, q));
  searchDdItems = matches.slice(0, SEARCH_DD_MAX);
  searchDdActive = -1;

  const loading = catalogLoadState !== 'full' && catalogLoadState !== 'error';
  let html = '';
  if (!searchDdItems.length) {
    html = '<div class="sd-empty">' + (loading ? 'সার্ভিস লোড হচ্ছে…' : 'কিছু পাওয়া যায়নি') + '</div>';
  } else {
    html = '<div class="sd-count">' + matches.length + ' টি সার্ভিস পাওয়া গেছে'
         + (matches.length > SEARCH_DD_MAX ? ' (প্রথম ' + SEARCH_DD_MAX + ' টি)' : '')
         + (loading ? ' · আরও লোড হচ্ছে…' : '') + '</div>'
         + searchDdItems.map(p => {
      const price = packageSellPrice(p);
      return '<div class="sd-item" role="option" data-code="' + escapeHtml(String(p.code)) + '">'
        + '<span class="sd-code">' + escapeHtml(String(p.code)) + '</span>'
        + '<span class="sd-body">'
        +   '<span class="sd-name">' + escapeHtml(decodeEntities(p.name)) + '</span>'
        +   '<span class="sd-meta">' + priceWithDiscountHtml(p) + ' · Min ' + p.min + ' - Max ' + p.max + '</span>'
        + '</span></div>';
    }).join('');
  }
  box.innerHTML = html;
  box.style.display = 'flex';
  if (input) input.setAttribute('aria-expanded', 'true');
}

(function initSearchDropdown() {
  const { input, box } = searchDdEls();
  if (!input || !box) return;

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    // main কার্ড লিস্ট সার্চে ব্যবহার হবে না
    searchQuery = '';
    clearTimeout(searchDdTimer);
    searchDdTimer = setTimeout(() => {
      if (q && catalogLoadState !== 'full') {
        ensureFullCatalog().then(() => {
          if (input.value.toLowerCase().trim() === q) renderSearchDropdown(q);
        });
      }
      renderSearchDropdown(q);
    }, 120);
  });

  input.addEventListener('focus', () => {
    const q = input.value.toLowerCase().trim();
    if (q) renderSearchDropdown(q);
  });

  input.addEventListener('keydown', (e) => {
    if (box.style.display === 'none') return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSearchDdActive(searchDdActive + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSearchDdActive(searchDdActive - 1); }
    else if (e.key === 'Enter') {
      const it = searchDdItems[searchDdActive >= 0 ? searchDdActive : 0];
      if (it) { e.preventDefault(); pickSearchResult(it.code); }
    } else if (e.key === 'Escape') { closeSearchDropdown(); }
  });

  box.addEventListener('click', (e) => {
    const row = e.target.closest('.sd-item');
    if (row) pickSearchResult(row.dataset.code);
  });

  // বাইরে ট্যাপ করলে বন্ধ
  document.addEventListener('click', (e) => {
    const wrap = document.getElementById('searchWrap');
    if (wrap && !wrap.contains(e.target)) closeSearchDropdown();
  });
})();

/** Category counts for the currently selected platform (or all platforms). */
function getCategoryCounts() {
  const base = activePlatform === 'all'
    ? allPackages
    : allPackages.filter(p => p.platform === activePlatform);
  const counts = {};
  base.forEach(p => {
    const cat = p.category || 'Other';
    counts[cat] = (counts[cat] || 0) + 1;
  });
  // Fixed, sensible order (see CATEGORY_ORDER in app-core.js) rather than
  // however categories happen to appear — includes YouTube "Subscribers".
  return sortCategories(Object.keys(counts)).map(name => ({ name, count: counts[name] }));
}

/** Selling price used for sort & display */
function packageSellPrice(pkg) {
  return getFinalPrice(pkg);   // includes admin discount (if any)
}

/** Multi-field search: code, name, category, platform */
function matchesSearch(pkg, q) {
  if (!q) return true;
  const code = String(pkg.code || "").toLowerCase();
  const name = String(pkg.name || "").toLowerCase();
  const cat = String(pkg.category || "").toLowerCase();
  const plat = String(pkg.platform || "").toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  return words.every(w =>
    code.includes(w) || name.includes(w) || cat.includes(w) || plat.includes(w)
  );
}

/** Rank: exact code > code startsWith > code includes > name startsWith > other */
function searchRank(pkg, q) {
  if (!q) return 0;
  const code = String(pkg.code || "").toLowerCase();
  const name = String(pkg.name || "").toLowerCase();
  if (code === q) return 1000;
  if (code.startsWith(q)) return 800;
  if (code.includes(q)) return 600;
  if (name === q) return 500;
  if (name.startsWith(q)) return 400;
  if (name.includes(q)) return 300;
  return 100;
}

/** Tag matchers — based on real service name/features only */
function matchesTag(pkg, tag) {
  if (!tag) return true;
  const name = String(pkg.name || "").toLowerCase();
  const cat = String(pkg.category || "").toLowerCase();
  const price = toBdtPrice(pkg.pricePerK);
  const text = name + " " + cat;

  const isBD = /\b(bd|bangladesh|bangladeshi)\b/.test(text);
  const isFollow = /follow|follower/.test(text);
  const isLike = /\blike\b/.test(text);
  const isReact = /reaction|react|love|care|haha|wow|sad|angry/.test(text);
  const isView = /view|play|impression|reach/.test(text);
  const isShare = /share|retweet|repost/.test(text);
  const isComment = /comment/.test(text);
  const isCustom = /custom/.test(text);
  const isMember = /member|group|subscriber|channel/.test(text);
  const isReal = /\b(real|organic|hq|high quality|premium|non.?drop|no.?drop)\b/.test(text);
  const isRefill = /refill|lifetime|guarantee/.test(text);
  const isFast = /instant|fast|super.?fast|express/.test(text);
  const isBot = isFollow && price <= 20 && !isReal;

  switch (tag) {
    case "bd-followers":
      return isFollow && isBD;
    case "bot-followers":
      return isBot;
    case "global-followers":
      return isFollow && !isBD;
    case "bd-likes":
      return (isLike || isReact) && isBD;
    case "global-likes":
      return isLike && !isBD;
    case "reactions":
      return isReact;
    case "views":
      return isView;
    case "shares":
      return isShare;
    case "custom-comments":
      return isComment && isCustom;
    case "comments":
      return isComment;
    case "members":
      return isMember;
    case "bd-targeted":
      return isBD;
    case "premium":
      return isReal || /premium|hq|high quality/.test(text);
    case "real":
      return /\breal\b|organic/.test(text);
    case "non-drop":
      return /non.?drop|no.?drop|0% drop|almost no drop/.test(text);
    case "refill":
      return isRefill;
    case "fast":
      return isFast;
    default:
      return true;
  }
}

const TAG_LABELS = {
  "bd-followers": "BD Followers",
  "bot-followers": "Bot Followers",
  "global-followers": "Global Followers",
  "bd-likes": "BD Likes",
  "global-likes": "Global Likes",
  "reactions": "Reactions",
  "views": "Views",
  "shares": "Shares / Retweets",
  "custom-comments": "Custom Comments",
  "comments": "Comments",
  "members": "Members / Group",
  "bd-targeted": "BD Targeted",
  "premium": "Premium / HQ",
  "real": "Real / Organic",
  "non-drop": "Non Drop",
  "refill": "Refill / Guarantee",
  "fast": "Fast / Instant"
};

function updateActiveFilterPills() {
  const box = document.getElementById("activeFilters");
  if (!box) return;
  const pills = [];
  if (priceSort === "low-high") pills.push({ key: "sort", label: "Price: Low → High" });
  if (priceSort === "high-low") pills.push({ key: "sort", label: "Price: High → Low" });
  if (activeTag && TAG_LABELS[activeTag]) pills.push({ key: "tag", label: TAG_LABELS[activeTag] });

  box.innerHTML = pills.map(p =>
    `<span class="active-filter-pill">${p.label}<button type="button" data-clear="${p.key}" aria-label="Remove">×</button></span>`
  ).join("");

  box.querySelectorAll("button[data-clear]").forEach(btn => {
    btn.addEventListener("click", () => {
      const k = btn.getAttribute("data-clear");
      if (k === "sort") priceSort = "default";
      if (k === "tag") activeTag = "";
      syncFilterUI();
      currentLimit = 30;
      renderPackages();
    });
  });

  const openBtn = document.getElementById("openFilterBtn");
  if (openBtn) {
    if (priceSort !== "default" || activeTag) openBtn.classList.add("has-active");
    else openBtn.classList.remove("has-active");
  }
}

function syncFilterUI() {
  document.querySelectorAll("#priceSortChips .filter-chip").forEach(chip => {
    const isActive = chip.dataset.sort === priceSort;
    chip.classList.toggle("active", isActive);
    chip.setAttribute("aria-pressed", String(isActive));
  });
  document.querySelectorAll("#tagChips .filter-chip").forEach(chip => {
    const isActive = chip.dataset.tag === activeTag;
    chip.classList.toggle("active", isActive);
    chip.setAttribute("aria-pressed", String(isActive));
  });
  updateActiveFilterPills();
}

function openFilterModal() {
  const m = document.getElementById("filterModal");
  if (m) m.style.display = "flex";
  syncFilterUI();
}
function closeFilterModal() {
  const m = document.getElementById("filterModal");
  if (m) m.style.display = "none";
}

function setupFilterUI() {
  const openBtn = document.getElementById("openFilterBtn");
  const closeBtn = document.getElementById("closeFilterBtn");
  const backdrop = document.getElementById("filterBackdrop");
  const resetBtn = document.getElementById("resetFilterBtn");
  const applyBtn = document.getElementById("applyFilterBtn");

  if (openBtn) openBtn.addEventListener("click", openFilterModal);
  if (closeBtn) closeBtn.addEventListener("click", closeFilterModal);
  if (backdrop) backdrop.addEventListener("click", closeFilterModal);

  document.querySelectorAll("#priceSortChips .filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      priceSort = chip.dataset.sort || "default";
      syncFilterUI();
    });
  });
  document.querySelectorAll("#tagChips .filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const t = chip.dataset.tag || "";
      activeTag = (activeTag === t) ? "" : t; // toggle
      syncFilterUI();
    });
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      priceSort = "default";
      activeTag = "";
      syncFilterUI();
    });
  }
  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      currentLimit = 30;
      renderPackages();
      closeFilterModal();
    });
  }
}

/** "পূর্বে গড়ে/সাধারণত X সময়ে সম্পন্ন হয়েছে" ট্যাগ — রেকর্ড না থাকলে কিছুই দেখায় না। */
function deliveryBadgeHTML(pkg) {
  const d = pkg && pkg.delivery;
  if (!d || !d.label) return "";
  return `<div class="delivery-badge" title="সর্বশেষ ${d.n} টি সম্পন্ন অর্ডারের মিডিয়ান সময়">⏱ পূর্বে ${escapeHtml(String(d.label))} এর মধ্যে সম্পন্ন হয়েছে <span class="delivery-n">(${d.n} অর্ডার)</span></div>`;
}

/* ------------------------------------------------------------------
   Category → Service dropdown drill-down for "Popular" mode.
   Instead of dumping every popular service for a platform as one long
   scrollable list, the visitor narrows down step by step — same idea
   most SMM panels use (pick a category, then a specific numbered
   service, then see just that one service's details before ordering).

   Uses a CUSTOM dropdown (button + overlay panel) instead of a native
   <select> — native <select> options render as a single line on
   Android/iOS and get cut off with "…" for long category/service
   names, which can't be fixed with CSS since the OS renders that
   popup, not us. The custom panel below wraps long names onto
   multiple lines instead, and adds a search box for long lists.
   ------------------------------------------------------------------ */
let selectedCategoryValue = "";
let selectedServiceCode = "";

/** সার্ভিসটি Refill-যুক্ত কি না। প্যানেলের refill ফ্ল্যাগ / Refill ট্যাগ / নামে Refill-Lifetime-Guarantee লেখা
 *  (বোল্ড ইউনিকোড যেমন 𝗥𝗘𝗙𝗜𝗟𝗟 ও ধরা হয়); "No Refill" / "Non Refill" লেখা থাকলে Non-Refill। */

/** প্রোভাইডারের নামে থাকা বানান ভুল শুধু দেখানোর সময় ঠিক করা হয় (মূল p.name বদলায় না) */
const PB_TYPO = [
  [/\brefile\b/gi, "Refill"], [/\brefil\b/gi, "Refill"], [/\brefll\b/gi, "Refill"],
  [/\b(?:garantee|gurantee|garentee)(d?)\b/gi, "Guarantee$1"], [/\bguranteed\b/gi, "Guaranteed"], [/\bgaranteed\b/gi, "Guaranteed"],
  [/\bcostum\b/gi, "Custom"], [/\benabel\b/gi, "Enable"], [/\bowerflow\b/gi, "Overflow"], [/\binstnat\b/gi, "Instant"],
  [/\baisian\b/gi, "Asian"], [/\breall\b/gi, "Real"], [/\bthialand\b/gi, "Thailand"], [/\breactoins\b/gi, "Reactions"],
  [/\bcomemnt(s?)\b/gi, "Comment$1"], [/\bdelivary\b/gi, "Delivery"], [/\bengagment(s?)\b/gi, "Engagement$1"],
  [/\bmonetaizable\b/gi, "Monetizable"], [/\bnone[\s-]*drop\b/gi, "Non Drop"]
];
function pbFixTypos(s) {
  let t = String(s == null ? "" : s);
  PB_TYPO.forEach(([re, to]) => {
    t = t.replace(re, (m, g1) => {
      let r = to.replace("$1", g1 || "");
      if (m === m.toUpperCase() && m.length > 2) return r.toUpperCase();
      if (m === m.toLowerCase()) return r.toLowerCase();
      return r;
    });
  });
  return t;
}

/** দেশের পতাকা — প্রোভাইডারের নামে যে পতাকা/দেশের নাম আছে সেটাই (না থাকলে খালি) */
const PB_COUNTRY_FLAG = [
  [/bangladesh|bangladeshi|bengali|\bbd\b|bd\+/, "🇧🇩"], [/\bindia\b|\bindian\b/, "🇮🇳"], [/\busa\b|united states|\bamerica(?:n)?\b/, "🇺🇸"],
  [/canada|canadian/, "🇨🇦"], [/\buk\b|britain|united kingdom/, "🇬🇧"], [/germany|german\b/, "🇩🇪"], [/france|french/, "🇫🇷"],
  [/italy|italian/, "🇮🇹"], [/spain|spanish/, "🇪🇸"], [/brazil|brazilian/, "🇧🇷"], [/turkey|turkiye|turkish/, "🇹🇷"],
  [/egypt|egyptian/, "🇪🇬"], [/saudi/, "🇸🇦"], [/\buae\b/, "🇦🇪"], [/pakistan/, "🇵🇰"], [/russia|russian/, "🇷🇺"],
  [/ukrain/, "🇺🇦"], [/korea/, "🇰🇷"], [/japan/, "🇯🇵"], [/thailand|\bthai\b/, "🇹🇭"], [/vietnam/, "🇻🇳"],
  [/indonesia/, "🇮🇩"], [/philippine|filipino/, "🇵🇭"], [/nigeria/, "🇳🇬"], [/mexico/, "🇲🇽"], [/colombia/, "🇨🇴"],
  [/argentin/, "🇦🇷"], [/\biran\b|iranian/, "🇮🇷"], [/morocco/, "🇲🇦"], [/algeria/, "🇩🇿"], [/poland/, "🇵🇱"],
  [/portugal/, "🇵🇹"], [/israel/, "🇮🇱"], [/sweden/, "🇸🇪"], [/malaysia/, "🇲🇾"], [/kazakhstan/, "🇰🇿"],
  [/australia/, "🇦🇺"], [/china/, "🇨🇳"], [/nepal/, "🇳🇵"], [/greece/, "🇬🇷"], [/moldova/, "🇲🇩"], [/taiwan/, "🇹🇼"]
];
function pbFlags(p) {
  try {
    const raw = String(decodeEntities(p.name) || "").normalize("NFKC");
    const out = [];
    (raw.match(/[\u{1F1E6}-\u{1F1FF}]{2}/gu) || []).forEach(f => { if (!out.includes(f)) out.push(f); });
    if (!out.length) {
      const lc = raw.toLowerCase();
      PB_COUNTRY_FLAG.forEach(([re, f]) => { if (re.test(lc) && !out.includes(f)) out.push(f); });
    }
    return out.slice(0, 3).join("");
  } catch (e) { return ""; }
}

function pbIsRefill(p) {
  if (!p) return false;
  const nm = pbFixTypos(String(p.name || "").normalize("NFKC")).toLowerCase();
  if (/\b(no|non|without|not)[\s_-]*refill|refill[\s:_-]*(no|na|n\/a|not)\b|no[\s_-]*guarantee/.test(nm)) return false;
  if (String(p.refill || "").toLowerCase() === "yes") return true;
  if ((p.tags || []).some(t => String(t).toLowerCase() === "refill")) return true;
  if (/refill|lifetime|guarantee|warranty/.test(nm)) return true;
  return /(?:^|[\s|\[\]()~,\-])r[\s-]?\d{2,3}(?=$|[\s|\[\]()~,.])/.test(nm);   // R30 / R15 = ৩০/১৫ দিনের Refill
}

function popularPoolForPlatform(ignoreMode) {
  // সব সার্ভিস (platform অনুযায়ী) + Filter-এর tag প্রযোজ্য হলে সেটা + Refill / Non-Refill বাটন
  let pool = allPackages.slice();
  if (activePlatform !== "all") pool = pool.filter(p => p.platform === activePlatform);
  if (activeTag) pool = pool.filter(p => matchesTag(p, activeTag));
  return pool;
}

/** সার্ভিসের নাম থেকে Start / Speed / Refill / Quality বের করে (প্যানেলগুলোর মতো তালিকার জন্য)।
 *  নামে তথ্য না থাকলে ওই সারিটা বাদ — কিছু আন্দাজ করে বসানো হয় না (শুধু Refill সবসময় থাকে)। */
function pbServiceFacts(p) {
  const nm = pbFixTypos(String(p.name || "").normalize("NFKC")).toLowerCase().replace(/\s+/g, " ");
  const tags = (p.tags || []).map(t => String(t).toLowerCase());
  const fmt = (v) => v.replace(/\s+/g, "").replace(/[-–]/g, "–").replace(/([kmb])/g, (m) => m.toUpperCase());
  const unitH = (u) => /^(m|min)/.test(u) ? "Minutes" : /^d/.test(u) ? "Days" : "Hours";
  const rows = [];

  // --- Start
  let start = "";
  let m = nm.match(/start[\s:]*(\d+\s*[-–]\s*\d+|\d+)\s*(hours?|hrs?|h|minutes?|mins?|days?)\b/);
  if (!m) m = nm.match(/(?:^|[^\d.])(0\s*[-–]\s*\d+)\s*\/?\s*(hours?|hrs?|h|minutes?|mins?)\b/);
  if (m) start = "⏰ " + m[1].replace(/\s+/g, "").replace("-", "–") + " " + unitH(m[2]);
  else if (/instant|immediate/.test(nm) || tags.includes("instant")) start = "⚡ Instant";
  if (start) rows.push({ k: "start", label: "Start", val: start });

  // --- Speed
  // রেঞ্জ ("20k-30k", "1k–3k", "100-300") পুরোটাই ধরা হয়; শুধু উপরের সংখ্যা নয়।
  const num = "\\d[\\d.,]*\\s*[kmb]?";
  const rng = "(" + num + "(?:\\s*[-–]\\s*" + num + ")?)\\+?";
  const rngK = "(\\d[\\d.,]*\\s*[kmb]?\\s*[-–]\\s*\\d[\\d.,]*\\s*[kmb]|\\d[\\d.,]*\\s*[kmb])\\+?";   // শেষ সংখ্যায় K/M/B বাধ্যতামূলক
  let speed = "";
  let sm;
  const tryRe = (re, unit) => { if (speed) return; sm = nm.match(re); if (sm) speed = fmt(sm[1]) + unit; };
  tryRe(new RegExp("(?:^|[^\\d.-])" + rng + "\\s*(?:\\/|per\\s*)\\s*(?:days?|d)\\b"), "/Day");
  tryRe(new RegExp("(?:^|[^\\d.-])" + rngK + "\\s*days?\\b(?!\\s*(?:refill|guarantee|warranty))"), "/Day");
  tryRe(/\bday\s*(\d[\d.,]*\s*[kmb])\b/, "/Day");
  tryRe(new RegExp("\\b(?:daily|per day)[\\s:]*" + rng), "/Day");
  tryRe(new RegExp("\\bspeed[\\s:]*" + rngK + "(?!\\s*(?:\\/|per)?\\s*(?:h|hr|hrs|hour|hours|min|minutes)\\b)"), "/Day");   // "Speed 2k-5k" = দৈনিক গতি
  if (!speed) {
    sm = nm.match(new RegExp("(?:^|[^\\d.-])" + rng + "\\s*(?:\\/|per\\s*)\\s*(hours?|hrs?|h)\\b", "g"));
    if (sm) { for (const t of sm) { const mm = t.match(new RegExp(rng + "\\s*(?:\\/|per)")); if (mm && !/^0\s*[-–]/.test(mm[1].trim())) { speed = fmt(mm[1]) + "/Hour"; break; } } }
  }
  // সংখ্যা না থাকলে নামে যে গতির শব্দ আছে সেটাই দেখাই (Instant / Super Fast ইত্যাদি); কিছু বানানো হয় না
  if (!speed) {
    const parts = [];
    if (/\binstant(?:ly)?\b|\bimmediate(?:ly)?\b/.test(nm)) parts.push("Instant");
    const adj = nm.match(/\b(super|extremely|extreme|ultra|very|lightning|hyper)[\s-]*(fast|speed)\b/);
    if (adj) parts.push((adj[1] === "extreme" ? "Extremely" : adj[1][0].toUpperCase() + adj[1].slice(1)) + " Fast");
    else if (/\bslow\b/.test(nm)) parts.push("Slow");
    else if (/\b(?:high|good|fast|medium)[\s-]*speed\b|\bfast\b/.test(nm)) {
      const m2 = nm.match(/\b(high|good|medium)[\s-]*speed\b/);
      parts.push(m2 ? m2[1][0].toUpperCase() + m2[1].slice(1) + " Speed" : "Fast");
    }
    if (parts.length) speed = parts.join(" · ");
  }
  if (speed) rows.push({ k: "speed", label: "Speed", val: "🚀 " + speed });

  // --- Refill
  let refill;
  if (pbIsRefill(p)) {
    let rm = nm.match(/(\d+)\s*(?:days?|d)\s*(?:refill|guarantee|warranty)|(?:refill|guarantee|warranty)[\s:~-]*(\d+)\s*(?:days?|d)\b|(?:^|[\s|\[\]()~,\-])r[\s-]?(\d{2,3})(?=$|[\s|\[\]()~,.])/);
    const days = rm ? (rm[1] || rm[2] || rm[3]) : "";
    refill = days ? "♻️ Refill · " + days + " Days" : (/lifetime/.test(nm) ? "♻️ Refill · Lifetime" : "♻️ Refill");
  } else refill = "♻️ No Refill";
  rows.push({ k: "refill", label: "Refill", val: refill });

  // --- Quality (+ Drop)
  // নিয়ম: সার্ভিসের নামই আসল দাবি, ট্যাগ শুধু নামে তথ্য না থাকলে কাজে লাগে।
  // নাম ও ট্যাগ না মিললে নামকে বিশ্বাস করা হয়; নামে একাধিক দাবি থাকলে কমটা দেখানো হয়।
  const nmq = nm.replace(/\b(?:no|non|without|zero)[\s-]*bots?\b/g, " ");
  let q = "";
  if (/\blq\b|low quality|\bbots?\b/.test(nmq)) q = "Low";
  else if (/\bmq\b|medium|mixed?\b/.test(nmq)) q = "Medium";
  else if (/\bhq\b|high[\s-]?quality|premium|\breal\b|best quality|nice quality/.test(nmq)) q = "HQ";
  else if (tags.includes("hq")) q = "HQ";
  let drop = "";
  const dropNameLow = /low[\s-]?drop/.test(nm);
  const dropNameNon = /non[\s-]?drop|no[\s-]?drop|\b0%\s*drop|drop\s*[:%]?\s*0\s*%?|almost no drop/.test(nm);
  if (dropNameLow) drop = "Low Drop";
  else if (dropNameNon) drop = "Non Drop";
  else if (tags.includes("non drop")) drop = "Non Drop";
  const qv = [q, drop].filter(Boolean).join(" · ");
  if (qv) rows.push({ k: "quality", label: "Quality", val: "⭐ " + qv });
  return rows;
}
/** ড্রপডাউন/লিস্টে দেখানোর ছোট নাম। মূল নাম (pkg.name) কখনো বদলায় না।
 *  যে অংশ নিচের Speed / Refill / Quality সারিতে আগে থেকেই আছে সেটা বাদ যায়,
 *  আর প্ল্যাটফর্মের নাম (Facebook ইত্যাদি) বাদ যায়। কিছু না বাঁচলে পুরো নামে ফিরে যায়। */
function pbShortName(p) {
  const full = pbFixTypos(String(decodeEntities(p.name) || "").normalize("NFKC"));
  try {
    let t = full;
    t = t.replace(/^[\s+\-_*=~•.:]+/, "").replace(/^\d{3,6}\s*[-:.]?\s+/, "").replace(/^[\s+\-_*=~•.:]+/, "");   // শুরুর কোড/সাজানো চিহ্ন
    // ইমোজি / পতাকা / সাজানো চিহ্ন বাদ — তবে React সার্ভিসে রিঅ্যাকশন ইমোজি (😡 😢 😮 😆 ❤️ 👍 🥰 🤗) থাকবে
    const isReact = /react/i.test(t);
    const REACT_EM = /[\u{1F600}-\u{1F64F}\u{1F90D}-\u{1F9FF}\u{1F44D}\u{1F44E}\u{2764}\u{1F493}-\u{1F49F}]/u;
    t = t.replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu,
      (ch) => (isReact && !/[\u{1F1E6}-\u{1F1FF}\u26A1\u267B\u2705\u274C\u26D4\u26A0\u{1F680}\u{1F4BC}\u{1F469}\u2B50\uFE0F\u200D\u20E3]/u.test(ch)) ? (ch === "\u2764" ? "\u2764\uFE0F" : ch) : " ");
    if (isReact) t = t.replace(/([A-Za-z])([\u{1F300}-\u{1FAFF}\u2764])/gu, "$1 $2");
    // বন্ধনীকে বিভাজক বানাই, তারপর বিভাজকে ভাগ
    t = t.replace(/[\[\]()（）【】]/g, "|");
    const segs = t.split(/\s*[|।]+\s*|\s+I\s+|\s+[~—–]+\s+|\s+-\s+|\s*~\s*/).map(x => x.trim()).filter(Boolean);

    const facts = pbServiceFacts(p);
    const has = (k) => facts.some(r => r.k === k);
    const qRow = (facts.find(r => r.k === "quality") || {}).val || "";
    const hasDrop = /drop/i.test(qRow);
    const hasQ = /HQ|Medium|Low(?! Drop)/.test(qRow);
    const only = (seg, junk, must) => {
      if (!must.test(seg)) return false;
      return seg.replace(junk, " ").replace(/[\s\W_]+/g, "") === "";
    };
    const redundant = (seg) => {
      const s = seg.toLowerCase();
      if (has("speed") && only(s, /instant|super|extremely|extreme|ultra|very|complete|speed|fast|good|slow|high|medium|per|days?|hours?|hrs?|\d[\d.,]*|[kmb]\b|\bd\b|\bh\b|[\/\-–+~]/g, /\d|speed|fast|instant|slow/)) return true;
      if (only(s, /refill|no\b|non\b|lifetime|guarantee|warranty|available|auto|days?|\bd\b|\d+d\b|\d+/g, /refill|guarantee|warranty/)) return true;
      if (pbIsRefill(p) && /^(?:r\s?\d{1,3}|lifetime(?:\s+(?:refill|guarantee))?)$/.test(s.trim())) return true;
      if (hasDrop && only(s, /non|no\b|low|zero|almost|drop|%|\b0\b/g, /drop/)) return true;
      if (hasQ && only(s, /hq|real|quality|high|premium|best|nice|good|follow(?:er|ers)?|likes?|accounts?|profiles?/g, /hq|real|quality|premium/)) return true;
      if (has("start") && only(s, /start|instant|immediate|\d+h?|hours?|hrs?|\bh\b|minutes?|mins?|[\/\-–:]/g, /start|instant|immediate|\d/)) return true;
      // মিশ্র অংশ (যেমন "No Refill 100K/Days", "100% Non Drop"): সব শব্দই নিচের সারির তথ্য হলে বাদ
      if (/refill|garantee|guarantee|drop|speed|\bday/.test(s)
          && (!/drop/.test(s) || hasDrop)
          && (!/speed|\bdays?\b|\/\s*d/.test(s) || has("speed"))
          && only(s, /speed|fast|super|very|good|slow|high|per|days?|hours?|hrs?|\d[\d.,]*|[kmb]\b|\bd\b|\d+d\b|refill|garantee|guarantee|warranty|lifetime|no\b|non\b|low|zero|almost|drop|%|\br\s?\d+|[\/\-–+~]/g, /refill|garantee|guarantee|drop|speed|day/)) return true;
      return false;
    };
    // Quality সারিতে যা আছে সেই শব্দ (Real / Mixed / HQ / No Bot) বাক্যের ভেতর থেকেও বাদ
    const stripQ = (seg) => !hasQ ? seg : seg
      .replace(/\b(?:no|non|without)[\s-]*bots?\b|\bbots?[\s-]*free\b/gi, " ")
      .replace(/\b(?:real|mixed?|hq|high[\s-]?quality)\b/gi, " ")
      .replace(/(^|\s)[+&\/]+|[+&\/]+(?=\s|$)/g, "$1 ")
      .replace(/\s{2,}/g, " ").trim();
    const kept = segs.map(seg0 => {
      let seg = stripQ(seg0).replace(/^[\s\-–—+:,.]+|[\s\-–—+:,.]+$/g, "");
      if (!seg || /^max[\s:]*(?:\d[\d.,]*\s*[kmb]?|unlimited)$/i.test(seg)) return "";
      if (redundant(seg)) return "";
      if (seg.indexOf(",") < 0) return seg;
      return seg.split(/\s*,\s*/).filter(x => x && !redundant(x)).join(", ");   // কমা-ভাগেও একই নিয়ম
    }).filter(Boolean);

    // শুরুর প্ল্যাটফর্মের নাম বাদ (ইউজার আগেই প্ল্যাটফর্ম বেছে নিয়েছে)
    if (kept.length) kept[0] = kept[0].replace(/^(?:facebook|fb|instagram|ig|twitter|x|tiktok|tik tok|youtube|yt|telegram|whatsapp|wa)\b[\s:]*/i, "").trim();
    let out = kept.filter(Boolean).join(" · ").replace(/\s{2,}/g, " ").trim();
    if (isReact && !REACT_EM.test(out)) {
      const EM = { angry: "😡", sad: "😢", wow: "😮", haha: "😆", love: "❤️", care: "🥰", like: "👍", likes: "👍" };
      const w = out.toLowerCase().match(/\b(angry|sad|wow|haha|love|care|likes?)\b/);
      if (w) out += " " + EM[w[1]];
    }
    if (out.length >= 3 && out.length <= full.length) return out;
  } catch (e) {}
  return full.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "").replace(/\s{2,}/g, " ").trim() || String(p.name || "");
}


/** ড্রপডাউনে নামের পাশে দেখানো কোয়ালিটি/ড্রপ/রিফিল — শুধু প্রোভাইডারের মূল নামে (p.name) যা লেখা আছে তা-ই;
 *  ট্যাগ বা অনুমান থেকে কিছু বানানো হয় না। নামে না থাকলে খালি। */
function pbQualityLabel(p, shown) {
  try {
    const nm = pbFixTypos(String(decodeEntities(p.name) || "").normalize("NFKC")).toLowerCase();
    const nb = nm.replace(/\b(?:no|non|without|zero)[\s-]*bots?\b|\bbots?[\s-]*free\b/g, " ");
    const out = [];
    // ড্রপ
    if (/very[\s-]*low[\s-]*drop/.test(nm)) out.push("Very Low Drop");
    else if (/(?:almost|mostly|nearly)[\s-]*(?:non|no)[\s-]*drop/.test(nm)) out.push("Almost Non Drop");
    else if (/low[\s-]*drop|less[\s-]*drop/.test(nm)) out.push("Low Drop");
    else if (/non[\s-]*drop|no[\s-]*drop|\b0%\s*drop|drop\s*[:%]?\s*0\s*%?(?!\d)/.test(nm)) out.push("Non Drop");
    // কোয়ালিটি
    if (/\blq\b|low[\s-]*quality/.test(nb)) out.push("Low Quality");
    if (/\bbots?\b/.test(nb)) out.push("Bot");
    if (/\bmq\b|medium[\s-]*quality|\bmedium\b/.test(nb)) out.push("Medium Quality");
    if (/\bhq\b|high[\s-]*quality/.test(nb)) out.push("HQ");
    if (/\breal\b/.test(nb)) out.push("Real");
    if (/premium(?![\s-]*(?:member|reaction|bot|view|boost|star|gift|emoji|animated|channel|subscri))/.test(nb.replace(/telegram[\s-]+premium/g, " "))) out.push("Premium");
    if (/\bmixed?\b/.test(nb)) out.push("Mixed");
    // রিফিল
    const rm = nm.match(/(\d+)\s*(?:days?|d)\s*(?:auto\s*)?(?:refill|guarantee|warranty|garantee)|(?:refill|guarantee|warranty)[\s:~-]*(\d+)\s*(?:days?|d)\b|(?:^|[\s|\[\]()~,\-])r[\s-]?(\d{1,3})(?=$|[\s|\[\]()~,.])/);
    if (rm) out.push("♻️ " + (rm[1] || rm[2] || rm[3]) + "D");
    else if (/lifetime/.test(nm) && /refill|guarant|warranty/.test(nm)) out.push("♻️ Lifetime");
    else if (/no[\s-]*refill|refill[\s:]*no\b|\bnr\b/.test(nm)) out.push("No Refill");
    const low = String(shown || "").toLowerCase();
    const res = out.filter(x => !low.includes(x.toLowerCase()));
    return res.length ? "[" + res.join(" · ") + "]" : "";
  } catch (e) { return ""; }
}
function pbDropdownName(p) {
  const sn = pbShortName(p), q = pbQualityLabel(p, sn), fl = pbFlags(p);
  return (fl ? fl + " " : "") + (q ? sn + " " + q : sn);
}

function pbFactsHTML(p) {
  const ico = { start: "🕐", speed: "⏱️", refill: "🔄", quality: "☆" };
  return `<div class="svc-facts">` + pbServiceFacts(p).map(r =>
    `<div class="svc-fact svc-${r.k}"><span class="svc-fact-ico">${ico[r.k]}</span><span class="svc-fact-lbl">${r.label}</span><span class="svc-fact-val">${escapeHtml(r.val)}</span></div>`
  ).join("") + `</div>`;
}

/* Refill / Non-Refill বাটন সরানো হয়েছে — প্রতিটি সার্ভিসের Refill তথ্য নিচের "Refill" সারিতে দেখায় */
function syncRefillButtons() {}

function pbCatPlatform(name) {
  const p = popularPoolForPlatform().find(x => name === PB_TOP_CAT ? pbIsTop(x) : (x.category || "Other") === name);
  return p ? String(p.platform || "").toLowerCase() : "";
}

function populateCategoryDropdown() {
  const _pool = popularPoolForPlatform();
  const cats = sortCategories([...new Set(_pool.map(p => p.category || "Other"))]);
  if (_pool.some(pbIsTop)) cats.unshift(PB_TOP_CAT);   // সবার আগে Top Services
  if (!cats.includes(selectedCategoryValue)) {
    selectedCategoryValue = cats[0] || "";
  }
  const trigger = document.getElementById("categoryTriggerText");
  if (trigger) trigger.textContent = selectedCategoryValue ? (pbCatEmoji(selectedCategoryValue, pbCatPlatform(selectedCategoryValue)) + " " + selectedCategoryValue) : "বেছে নিন";
  return cats;
}

function populateServiceDropdown() {
  const isTopCat = selectedCategoryValue === PB_TOP_CAT;
  let pool = popularPoolForPlatform().filter(p => isTopCat ? pbIsTop(p) : (p.category || "Other") === selectedCategoryValue);
  pool = pool.slice().sort(isTopCat
    ? (a, b) => pbTopRank().get(String(a.code)) - pbTopRank().get(String(b.code))   // admin-এর সাজানো ক্রম
    : (a, b) => priceSort === "high-low"
      ? packageSellPrice(b) - packageSellPrice(a)
      : packageSellPrice(a) - packageSellPrice(b));
  if (!pool.some(p => String(p.code) === String(selectedServiceCode))) {
    selectedServiceCode = pool[0] ? String(pool[0].code) : "";
  }
  const selectedPkg = pool.find(p => String(p.code) === String(selectedServiceCode));
  const trigger = document.getElementById("serviceTriggerText");
  if (trigger) {
    if (!selectedPkg) trigger.textContent = "বেছে নিন";
    else {
      const price = packageSellPrice(selectedPkg);
      const sn = pbDropdownName(selectedPkg);
      const short = sn.length > 70 ? sn.slice(0, 68) + "…" : sn;
      trigger.textContent = `${selectedPkg.code} - ${short}`;
    }
  }
  return pool;
}

/** ধাপ ৯: Refill ফ্ল্যাগ ও সার্ভিসের নাম পরস্পর বিরোধী কি না (যেমন ফ্ল্যাগ "No", নামে "30 Days Refill")।
 *  বিরোধ থাকলে "অর্ডারের আগে জানুন" বক্সে Refill সারি দেখানো হয় না — ভুল প্রতিশ্রুতি দেওয়ার চেয়ে চুপ থাকা ভালো। */
function pbRefillConflict(p) {
  const flag = String((p && p.refill) || "").toLowerCase();
  if (flag !== "yes" && flag !== "no") return false;
  const nm = pbFixTypos(String(p.name || "").normalize("NFKC")).toLowerCase();
  const nameNo = /\b(no|non|without|not)[\s_-]*refill|refill[\s:_-]*(no|na|n\/a|not)\b|no[\s_-]*guarantee/.test(nm);
  const nameYes = pbIsRefill({ name: p.name, tags: [], refill: "" });   // শুধু নাম থেকে
  return (flag === "no" && nameYes) || (flag === "yes" && nameNo);
}

/** "অর্ডারের আগে জানুন" বক্সের ভেতরের HTML। যে তথ্য ডেটায় নেই সেই সারি বাদ — কিছু আন্দাজ করে বসানো হয় না। */
function pbKnowBeforeHTML(p) {
  const rows = [];
  const clean = v => String(v == null ? "" : v).replace(/^[^A-Za-z0-9]+/, "").trim();
  const num = n => Number(n).toLocaleString("en-US");
  const mn = Number(p.min), mx = Number(p.max);
  if (mn > 0 && mx >= mn) rows.push({ k: "qty", ico: "📦", lbl: "পরিমাণ", val: "সর্বনিম্ন " + num(mn) + " — সর্বোচ্চ " + num(mx) });
  let f = [];
  try { f = pbServiceFacts(p); } catch (e) {}
  const g = k => f.find(r => r.k === k);
  if (g("start")) rows.push({ k: "start", ico: "🕐", lbl: "শুরু হতে", val: clean(g("start").val) });
  if (g("speed")) rows.push({ k: "speed", ico: "🚀", lbl: "গতি", val: clean(g("speed").val) });
  if (g("refill") && !pbRefillConflict(p)) {
    const v = clean(g("refill").val);
    rows.push({ k: "refill", ico: "♻️", lbl: "Refill", val: v, yes: !/^no\b/i.test(v) });
  }
  if (g("quality")) rows.push({ k: "quality", ico: "⭐", lbl: "মান", val: clean(g("quality").val) });
  // কথায় প্রকাশ: সারি নয়, বাক্যে বিবরণ
  const r = k => rows.find(x => x.k === k);
  const sent = [];
  if (r("qty")) sent.push("এই সার্ভিসে একবারে সর্বনিম্ন " + num(mn) + " থেকে সর্বোচ্চ " + num(mx) + " পর্যন্ত অর্ডার করা যায়।");
  if (r("start")) sent.push("অর্ডারের পর শুরু হতে সময় লাগে: " + r("start").val + "।");
  if (r("speed")) sent.push("ডেলিভারির গতি: " + r("speed").val + "।");
  if (r("refill")) sent.push(r("refill").yes ? "Refill সুবিধা আছে (" + r("refill").val + ")।" : "এই সার্ভিসে Refill নেই।");
  if (r("quality")) sent.push("সার্ভিসের মান: " + r("quality").val + "।");
  let html = sent.length ? `<div class="ab-desc-line ab-desc-main">${escapeHtml(sent.join(" "))}</div>` : "";
  const notes = [];
  if (g("start") || g("speed")) notes.push("• শুরু ও গতির তথ্য সার্ভিসের বিবরণ অনুযায়ী; লোড/সময়ভেদে কম-বেশি হতে পারে।");
  notes.push("• একই লিংকে আগের অর্ডার শেষ হওয়ার আগে নতুন অর্ডার দিবেন না।");
  notes.push("• সঠিক পাবলিক লিংক দিন — প্রাইভেট/ইনভ্যালিড লিংকে ডেলিভারি নাও হতে পারে।");
  return html + notes.map(l => `<div class="ab-desc-line">${escapeHtml(l)}</div>`).join("");
}

function renderSelectedServiceCard() {
  const wrap = document.getElementById("dropdownServiceCard");
  const descBox = document.getElementById("abDescBox");
  const descBody = document.getElementById("abDescBody");
  const orderFields = document.getElementById("abOrderFields");
  if (!wrap) return;

  const pkg = allPackages.find(p => String(p.code) === String(selectedServiceCode));
  if (!pkg) {
    wrap.innerHTML = catalogLoadState === 'loading'
      ? '<div role="status" style="text-align:center;color:var(--muted,#94a3b8);padding:20px 12px;">সার্ভিস লোড হচ্ছে…</div>'
      : catalogLoadState === 'error'
        ? '<div class="pb-error" role="alert"><p>সার্ভিস লোড করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।</p><button type="button" class="pb-retry" data-pb-retry="catalog">আবার চেষ্টা করুন</button></div>'
        : (catalogLoadState === 'loading' ? "" : `<div style="text-align:center;color:#94a3b8;padding:20px 12px;">এই ক্যাটাগরিতে কোনো সার্ভিস নেই। অন্য ক্যাটাগরি বেছে নিন।</div>`);
    if (descBox) descBox.style.display = "none";
    if (orderFields) orderFields.style.display = "none";
    return;
  }

  const price = packageSellPrice(pkg);
  wrap.innerHTML = "";   // ধাপ ১৫: Start/Speed/Refill সারি সরানো — একই তথ্য নিচের "অর্ডারের আগে জানুন" বক্সে আছে

  // ধাপ ৯: "অর্ডারের আগে জানুন" বক্স — পরিমাণ, শুরু, গতি, Refill, মান + সাধারণ নোট
  if (descBox && descBody) {
    descBody.innerHTML = pbKnowBeforeHTML(pkg);
    descBox.style.display = "block";
  }

  if (orderFields) {
    orderFields.style.display = "block";
    const mm = document.getElementById("abMinMax");
    if (mm) mm.textContent = `Min: ${pkg.min} — Max: ${pkg.max}`;
    const qtyEl = document.getElementById("abQty");
    if (qtyEl && !qtyEl.value) qtyEl.placeholder = String(pkg.min || 100);
    updateAbCharge();
  }
}

/** If the site's own address got glued in front of the pasted link
 *  (e.g. https://prime-digital-shop.pages.dev/https://real-link), keep only the real link. */
function cleanOrderLink(v) {
  let x = String(v || "").trim();
  if (!x) return x;
  try {
    const own = "https://" + location.host + "/";
    const own2 = "http://" + location.host + "/";
    const lower = x.toLowerCase();
    if ((lower.indexOf(own.toLowerCase()) === 0 || lower.indexOf(own2.toLowerCase()) === 0)) {
      const rest = x.slice(lower.indexOf("//") + 2 + location.host.length + 1);
      if (/^https?:\/\//i.test(rest)) x = rest;
    }
  } catch (e) {}
  if (!/^https?:\/\//i.test(x) && /^[\w-]+(\.[\w-]+)+(\/|$)/.test(x)) x = "https://" + x;
  return x;
}

function updateAbCharge() {
  const pkg = allPackages.find(p => String(p.code) === String(selectedServiceCode));
  const chargeEl = document.getElementById("abCharge");
  const btn = document.getElementById("abSubmitBtn");
  const link = (document.getElementById("abLink")?.value || "").trim();
  const qtyEl = document.getElementById("abQty");
  const ccWrap = document.getElementById("abCommentsWrap");
  const ccEl = document.getElementById("abComments");
  const ccCount = document.getElementById("abCommentsCount");
  if (!pkg) {
    if (chargeEl) chargeEl.textContent = "৳0.00";
    if (btn) btn.disabled = true;
    if (ccWrap) ccWrap.style.display = "none";
    return;
  }

  // Custom Comments: কমেন্ট বক্স দেখাও, Quantity = লাইন সংখ্যা (অটো, এডিট করা যাবে না)
  const isCC = isCustomCommentPkg(pkg);
  if (ccWrap) ccWrap.style.display = isCC ? "block" : "none";
  if (qtyEl) {
    if (isCC) {
      qtyEl.readOnly = true;
      qtyEl.dataset.auto = "1";
      qtyEl.placeholder = "কমেন্ট সংখ্যা অনুযায়ী অটো";
      const n = commentLines(ccEl?.value).length;
      qtyEl.value = n ? String(n) : "";
      if (ccCount) ccCount.textContent = `${n} comment${n === 1 ? "" : "s"} · Min ${pkg.min} – Max ${pkg.max}`;
    } else {
      if (qtyEl.dataset.auto === "1") { qtyEl.value = ""; delete qtyEl.dataset.auto; }
      qtyEl.readOnly = false;
    }
  }

  const qty = parseInt(qtyEl?.value || "0", 10) || 0;
  const price = packageSellPrice(pkg);
  const total = qty > 0 ? (price * qty) / 1000 : 0;
  if (chargeEl) chargeEl.textContent = `৳${total.toFixed(2)}`;
  const min = Number(pkg.min) || 1;
  const max = Number(pkg.max) || 999999999;
  const ok = link.length > 5 && qty >= min && qty <= max;
  if (btn) btn.disabled = !ok;
  // ব্যালেন্স কম হলে ফর্মে টপ-আপ বাটন (ধাপ ৭)
  if (typeof window.pbLowBalCheck === "function") { try { window.pbLowBalCheck(ok ? total : 0); } catch (e) {} }
}

(function initAbOrderFields() {
  const link = document.getElementById("abLink");
  const qty = document.getElementById("abQty");
  const btn = document.getElementById("abSubmitBtn");
  const cc = document.getElementById("abComments");
  if (cc) cc.addEventListener("input", updateAbCharge);
  if (link) link.addEventListener("input", updateAbCharge);
  if (link) link.addEventListener("blur", function () { const c = cleanOrderLink(link.value); if (c !== link.value) { link.value = c; updateAbCharge(); } });
  if (qty) qty.addEventListener("input", updateAbCharge);
  if (btn) {
    btn.addEventListener("click", async () => {
      const pkg = allPackages.find(p => String(p.code) === String(selectedServiceCode));
      if (!pkg) return;
      const linkVal = cleanOrderLink(document.getElementById("abLink")?.value || "");
      const linkInput = document.getElementById("abLink");
      if (linkInput && linkInput.value !== linkVal) linkInput.value = linkVal;
      const isCC = isCustomCommentPkg(pkg);
      const ccLines = isCC ? commentLines(document.getElementById("abComments")?.value) : [];
      const qtyVal = isCC ? ccLines.length : (parseInt(document.getElementById("abQty")?.value || "0", 10) || 0);
      const min = Number(pkg.min) || 1;
      const max = Number(pkg.max) || 999999999;
      if (!linkVal || qtyVal < min || qtyVal > max) return;
      // ধাপ ৭: অর্ডার শুধু ওয়ালেট ব্যালেন্স থেকে। সরাসরি bKash/Nagad/Rocket/Binance পেমেন্ট পপআপ আর খোলে না।
      // ব্যালেন্স কম হলে walletInstantOrder ফর্মে "ব্যালেন্স কম, টপ-আপ করুন" বক্স দেখায়;
      // সফল হলে উপরে "Your order received" বক্স। লগইন না থাকলে লগইন পেজে পাঠায়।
      const oldTxt = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Processing…";
      try {
        if (typeof window.walletInstantOrder === "function") {
          await window.walletInstantOrder(pkg, linkVal, qtyVal, ccLines.join("\n"));
        } else {
          alert("পেজ পুরোপুরি লোড হয়নি। রিফ্রেশ করে আবার চেষ্টা করুন।");
        }
      } catch (eI) {
        alert("অর্ডার করা যায়নি। আবার চেষ্টা করুন।");
      }
      btn.textContent = oldTxt;
      updateAbCharge();
    });
  }
})();

function renderDropdownPicker() {
  syncRefillButtons();
  populateCategoryDropdown();
  populateServiceDropdown();
  renderSelectedServiceCard();
}

/* ---- Generic inline dropdown panel (shared by Category & Service) ----
   Trigger-এর ঠিক নিচে নেমে আসে (উপর থেকে নিচে স্লাইড), max-height সীমিত + স্ক্রল,
   বাইরে ট্যাপ / Esc / সিলেক্ট করলে বন্ধ হয়। পেজের নিচে বাড়তি জায়গা নেয় না। */
let ddAllOptions = [];
let ddSelectedValue = "";
let ddOnSelect = null;
let ddOpenTrigger = null;

const DD_ICONS = {
  facebook: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#1877F2"/><path fill="#fff" d="M16.67 15.47l.53-3.47h-3.33V9.75c0-.95.47-1.88 1.96-1.88h1.51V4.92s-1.37-.23-2.69-.23c-2.74 0-4.53 1.66-4.53 4.67V12H7.08v3.47h3.05v8.39a12.1 12.1 0 0 0 3.75 0v-8.39z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24"><defs><linearGradient id="ddIg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FEDA75"/><stop offset=".3" stop-color="#FA7E1E"/><stop offset=".55" stop-color="#D62976"/><stop offset=".8" stop-color="#962FBF"/><stop offset="1" stop-color="#4F5BD5"/></linearGradient></defs><rect x=".5" y=".5" width="23" height="23" rx="6.5" fill="url(#ddIg)"/><circle cx="12" cy="12" r="5" fill="none" stroke="#fff" stroke-width="2"/><circle cx="18" cy="6" r="1.35" fill="#fff"/></svg>',
  twitter: '<svg viewBox="0 0 24 24"><rect x="0.5" y="0.5" width="23" height="23" rx="6.5" fill="#000"/><path fill="#fff" d="M17.5 6.2h2.2l-4.8 5.5 5.6 7.4h-4.4l-3.4-4.5-3.9 4.5H6.6l5.1-5.9L6.3 6.2h4.5l3.1 4.1 3.6-4.1zm-.77 11.6h1.2L9.34 7.53H8.05l8.68 10.27z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#111"/><path fill="#fff" d="M16.6 7.4a3.6 3.6 0 0 1-2.8-3.1h-2.5v10.1a2 2 0 1 1-1.4-1.9V9.9a4.5 4.5 0 1 0 3.9 4.5V9.6a6 6 0 0 0 3.5 1.1V8.2a3.6 3.6 0 0 1-.7-.8z" transform="translate(-.4 .6) scale(.98)"/></svg>',
  telegram: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#26A5E4"/><path fill="#fff" d="M5.4 11.9l11.3-4.4c.5-.2 1 .1.8.9l-1.9 9c-.1.6-.5.8-1 .5l-2.9-2.1-1.4 1.4c-.2.2-.3.3-.6.3l.2-3 5.5-5c.2-.2-.1-.3-.4-.1l-6.8 4.3-2.9-.9c-.6-.2-.6-.6.1-.9z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24"><rect x="0" y="3.5" width="24" height="17" rx="5" fill="#FF0000"/><path fill="#fff" d="M9.8 8.6v6.8l5.9-3.4z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#25D366"/><path fill="#fff" transform="translate(4.8 4.8) scale(.6)" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
  other: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#334155"/><path fill="#6ee7b7" d="M12 5.5l1.9 4 4.4.5-3.3 3 .9 4.4-3.9-2.2-3.9 2.2.9-4.4-3.3-3 4.4-.5z"/></svg>'
};
function ddIconFor(text) {
  const t = String(text || "").toLowerCase();
  if (/facebook|\bfb\b/.test(t)) return DD_ICONS.facebook;
  if (/instagram|\big\b/.test(t)) return DD_ICONS.instagram;
  if (/twitter|\bx\b/.test(t)) return DD_ICONS.twitter;
  if (/tiktok|tik tok/.test(t)) return DD_ICONS.tiktok;
  if (/telegram/.test(t)) return DD_ICONS.telegram;
  if (/youtube/.test(t)) return DD_ICONS.youtube;
  if (/whatsapp/.test(t)) return DD_ICONS.whatsapp;
  return DD_ICONS.other;
}

function openDropdown(options, selectedValue, onSelect, triggerEl) {
  ddAllOptions = options; // [{ value, label, badge?, icon? }]
  ddSelectedValue = String(selectedValue);
  ddOnSelect = onSelect;
  const panel = document.getElementById("ddPanel");
  const field = triggerEl && triggerEl.parentElement;
  if (!panel || !field) return;

  // দ্বিতীয়বার একই ট্রিগারে ট্যাপ = বন্ধ (toggle)
  if (ddOpenTrigger === triggerEl && panel.classList.contains("open")) { closeDropdown(); return; }
  closeDropdown(true);

  const search = document.getElementById("ddSearch");
  if (search) search.value = "";
  const header = document.getElementById("ddHeader");
  if (header) header.style.display = options.length > 8 ? "" : "none";
  renderDropdownOptions(ddAllOptions);

  field.appendChild(panel);
  panel.style.display = "flex";
  ddOpenTrigger = triggerEl;
  triggerEl.setAttribute("aria-expanded", "true");
  triggerEl.classList.add("open");
  // পরের ফ্রেমে class বসালে CSS transition কাজ করে (উপর থেকে নিচে নামে)
  requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add("open")));

  const selEl = panel.querySelector(".dd-option.selected");
  const opts = document.getElementById("ddOptions");
  if (selEl && opts) opts.scrollTop = Math.max(0, selEl.offsetTop - 60);
  setTimeout(() => {
    const r = panel.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 8) window.scrollBy({ top: r.bottom - window.innerHeight + 16, behavior: "smooth" });
  }, 120);
  // Do NOT autofocus search on mobile — it opens the keyboard and hides the list.
}

function closeDropdown(immediate) {
  const panel = document.getElementById("ddPanel");
  if (ddOpenTrigger) {
    ddOpenTrigger.setAttribute("aria-expanded", "false");
    ddOpenTrigger.classList.remove("open");
    ddOpenTrigger = null;
  }
  if (!panel) return;
  panel.classList.remove("open");
  if (immediate) { panel.style.display = "none"; return; }
  setTimeout(() => { if (!panel.classList.contains("open")) panel.style.display = "none"; }, 220);
}

function renderDropdownOptions(options) {
  const wrap = document.getElementById("ddOptions");
  if (!wrap) return;
  if (!options.length) {
    wrap.innerHTML = '<div class="dd-empty">কিছু পাওয়া যায়নি</div>';
    return;
  }
  wrap.innerHTML = options.map(o => {
    const isSel = String(o.value) === ddSelectedValue;
    const safeVal = escapeHtml(String(o.value));
    return `
      <div class="dd-option${isSel ? " selected" : ""}" data-value="${safeVal}" role="option" aria-selected="${isSel}">
        ${o.icon ? `<span class="dd-option-icon">${o.icon}</span>` : ""}
        ${o.emoji ? `<span class="dd-option-emoji">${escapeHtml(o.emoji)}</span>` : ""}
        ${o.badge ? `<span class="dd-option-badge">${escapeHtml(o.badge)}</span>` : ""}
        <span class="dd-option-label">${escapeHtml(decodeEntities(o.label))}</span>
      </div>
    `;
  }).join("");
  wrap.querySelectorAll(".dd-option").forEach(el => {
    el.addEventListener("click", () => {
      const val = el.dataset.value;
      closeDropdown();
      if (ddOnSelect) ddOnSelect(val);
    });
  });
}

document.getElementById("categoryTrigger")?.addEventListener("click", (e) => {
  const cats = populateCategoryDropdown();
  const options = cats.map(c => { const pl = pbCatPlatform(c); return { value: c, label: c, icon: ddIconFor(pl || c), emoji: pbCatEmoji(c, pl) }; });
  openDropdown(options, selectedCategoryValue, (val) => {
    selectedCategoryValue = val;
    populateCategoryDropdown();
    populateServiceDropdown();
    renderSelectedServiceCard();
  }, e.currentTarget);
});

document.getElementById("serviceTrigger")?.addEventListener("click", (e) => {
  const pool = populateServiceDropdown();
  const options = pool.map(p => {
    const price = packageSellPrice(p);
    return {
      value: p.code,
      badge: p.code,
      label: `${pbDropdownName(p)} — ≈ ৳${price.toFixed(2)} per 1000${getDiscountInfo(p) ? ' 🔥 ' + getDiscountInfo(p).badge : ''}`
    };
  });
  openDropdown(options, selectedServiceCode, (val) => {
    selectedServiceCode = val;
    populateServiceDropdown();
    renderSelectedServiceCard();
  }, e.currentTarget);
});

document.addEventListener("click", (e) => {
  if (!ddOpenTrigger) return;
  const panel = document.getElementById("ddPanel");
  if (panel && panel.contains(e.target)) return;
  if (e.target.closest && e.target.closest(".dd-trigger")) return;
  closeDropdown();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDropdown();
});

let ddSearchDebounce = null;
document.getElementById("ddSearch")?.addEventListener("input", (e) => {
  clearTimeout(ddSearchDebounce);
  const q = e.target.value.trim().toLowerCase();
  ddSearchDebounce = setTimeout(() => {
    const filtered = q ? ddAllOptions.filter(o => o.label.toLowerCase().includes(q)) : ddAllOptions;
    renderDropdownOptions(filtered);
  }, 150);
});

/* ------------------------------------------------------------------
   এখন শুধু ড্রপডাউন সিস্টেম — কোনো সার্ভিস কার্ড লিস্ট নেই।
   Category ▾ → Service ▾ → Description → Link/Qty → Order।
   Filter (tag / price) ড্রপডাউনের তালিকাতেই কাজ করে।
   ------------------------------------------------------------------ */
function renderPackages() {
  const dropdownWrap = document.getElementById("dropdownPicker");
  if (dropdownWrap) dropdownWrap.style.display = "";
  updateActiveFilterPills();
  // পুরো ক্যাটালগ লোড না হলে ব্যাকগ্রাউন্ডে লোড করে ড্রপডাউন আবার সাজায়
  if (catalogLoadState !== 'full' && catalogLoadState !== 'error') {
    ensureFullCatalog().then(() => renderDropdownPicker());
  }
  renderDropdownPicker();
}

setupFilterUI();

/* ------------------------------------------------------------------
   Progressive catalog loading:
   1) Fetch the small "popular" list first so the default view (Popular
      dropdown picker) renders almost instantly.
   2) Fetch the full catalog right after and swap it in — re-rendering so
      search / "All Services" / provider lookup see every service.
   ensureFullCatalog() is safe to call many times (search box and the
   "All Services" button call it): it only ever fires one request.
   ------------------------------------------------------------------ */
/** হিরোর "Services" বক্স: ক্যাটালগে সত্যি যতগুলো সার্ভিস আছে তার গোল (নিচের) সংখ্যা, যেমন ৯৮৯ → 900+ */
function pbUpdateServiceCount() {
  const el = document.getElementById("statServices");
  const item = document.getElementById("statServicesItem");
  const n = Array.isArray(allPackages) ? allPackages.length : 0;
  if (!el || !item || n < 10) return;
  el.textContent = n >= 100 ? (Math.floor(n / 100) * 100) + "+" : String(n);
  item.hidden = false;
}

/* ------------------------------------------------------------------
   ধাপ ২০ — ক্যাটালগ ডেটা ক্যাটেগরি ধরে ভাগ (tools/split_catalog.py বানায়)
   app-l1-catalog/index.json  : ছোট তালিকা (প্ল্যাটফর্ম, ক্যাটেগরি, সংখ্যা, ফাইল)
   app-l1-catalog/<platform>/<slug>.json : এক ক্যাটেগরির সার্ভিস
   প্রতিটি ফাইল একবারই নামে (promise ক্যাশ) — আগে একই ৫৮০ KB-ফাইল দুইবার নামত।
   index না পেলে পুরনো packages-full.json-এ ফিরে যায় (Deploy-এর ক্রম ভুল হলেও সাইট চলে)।
   ------------------------------------------------------------------ */
const PB_CATALOG = (function () {
  const BASE = 'app-l1-catalog/';
  let idxP = null, allP = null;
  const shardP = {};
  function getJSON(url) {
    return fetch(url).then(res => {
      if (!res.ok) throw new Error('catalog fetch failed: ' + url + ' ' + res.status);
      return res.json();
    });
  }
  function index() {
    if (!idxP) idxP = getJSON(BASE + 'index.json').catch(err => { idxP = null; throw err; });
    return idxP;
  }
  function shard(file) {
    if (!shardP[file]) shardP[file] = getJSON(BASE + file).catch(err => { delete shardP[file]; throw err; });
    return shardP[file];
  }
  /** এক ক্যাটেগরির সার্ভিস — ক্যাটেগরি খোলার সময় শুধু এটুকু নামাতে এটা ডাকুন */
  function loadCategory(platform, name) {
    return index().then(ix => {
      const c = (ix.categories || []).find(x => x.platform === platform && x.name === name);
      return c ? shard(c.file) : [];
    });
  }
  /** সব ক্যাটেগরি (সার্চ / "সব" ভিউ) — ফাইলগুলো একসাথে সমান্তরালে */
  function loadAll() {
    if (!allP) {
      allP = index()
        .then(ix => Promise.all((ix.categories || []).map(c => shard(c.file))))
        .then(parts => [].concat.apply([], parts))
        .catch(err => {
          console.warn('ক্যাটেগরি-ভাগ ডেটা পাওয়া যায়নি, packages-full.json থেকে নামছে:', err);
          return getJSON('packages-full.json').then(f => f.filter(p => !p.legacy));
        })
        .then(list => list, err => { allP = null; throw err; });
    }
    return allP;
  }
  return { index: index, loadCategory: loadCategory, loadAll: loadAll };
})();

let fullCatalogPromise = null;

function ensureFullCatalog() {
  if (catalogLoadState === 'full') return Promise.resolve();
  if (fullCatalogPromise) return fullCatalogPromise;
  fullCatalogPromise = PB_CATALOG.loadAll()
    .then(full => applyServiceMeta(full.filter(p => !p.legacy)))
    .then(full => {
      allPackages = full;
      catalogLoadState = 'full';
      pbUpdateServiceCount();
      renderPackages();
    })
    .catch(err => {
      console.error('Failed to load full catalog:', err);
      fullCatalogPromise = null;
    });
  return fullCatalogPromise;
}

function pbLoadCatalog() {
  // ধাপ ২০: ডেটা app-l1-catalog/ থেকে (ক্যাটেগরি ধরে ভাগ করা ফাইল)
  PB_CATALOG.loadAll()
    .then(full => applyServiceMeta(full.filter(p => !p.legacy)))
    .then(full => {
      allPackages = full;
      catalogLoadState = 'full';
      if (window.PB_A11Y) PB_A11Y.syncCatalog();
      pbUpdateServiceCount();
      renderPackages();
    })
    .catch(err => {
      console.error('Failed to load catalog:', err);
      catalogLoadState = 'error';
      if (window.PB_A11Y) PB_A11Y.syncCatalog();
      renderPackages();
    });
}
/** ধাপ ১৬: "আবার চেষ্টা করুন" বাটন এটা ডাকে */
window.pbReloadCatalog = function () {
  catalogLoadState = 'loading';
  if (window.PB_A11Y) PB_A11Y.syncCatalog();
  renderPackages();
  pbLoadCatalog();
};
pbLoadCatalog();


/** নামে লেখা তথ্য থেকে অতিরিক্ত ব্যাজ (Non Drop / Low Drop / Drip-fed / Cancel)। নামে না থাকলে কিছুই বসে না — আন্দাজ করা হয় না। */
function pbExtraBadges(p) {
  const nm = pbFixTypos(String(p && p.name || "").normalize("NFKC")).toLowerCase();
  const out = [];
  if (/\bnon[\s_-]*drop\b|\bnd\b|no[\s_-]*drop/.test(nm)) out.push({ k: "nodrop", val: "🛡 Non Drop", good: true });
  else if (/\blow[\s_-]*drop\b|\blow[\s_-]*drops\b/.test(nm)) out.push({ k: "lowdrop", val: "📉 Low Drop", good: true });
  if (/drip[\s_-]*fe(?:d|ed)|\bnatural(?:ly)?\b|gradual/.test(nm)) out.push({ k: "drip", val: "💧 Drip-fed", good: false });
  if (/\bcancel(?:l)?(?:ation|able)?\b/.test(nm) && !/no[\s_-]*cancel/.test(nm)) out.push({ k: "cancel", val: "✖ Cancel", good: false });
  if (/\b(real|active)\b/.test(nm) && !/not[\s_-]*real/.test(nm)) out.push({ k: "real", val: "👤 Real", good: true });
  return out;
}
