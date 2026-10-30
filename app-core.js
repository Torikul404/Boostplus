/* ==========================================================
   app-core.js — Shared foundation. Loaded FIRST.
   Global state, constants (payment methods, platform logos, category
   order), pricing helpers, validators and the Google Sheet API config.
   Every other app-*.js file depends on what is defined here.
   ========================================================== */

// ========== CONFIG ==========
// Google Apps Script Web App URL (orders, tracking, stats, proof gallery)
window.BOOSTPLUS_SHEET_API = "https://script.google.com/macros/s/AKfycbxacUqhDDc_2kRsedBF_x8zTrqUhNloQryVEkKuJzDC7SAyh_po6BbxX2F0ZLrrPmhV/exec";

// Support / contact links used by the sidebar, Contact Us and Tickets pages.
// Leave `telegram` empty ("") to hide the Telegram Support card on the Tickets page.
window.PB_SUPPORT = {
  phone: "01921018882",
  whatsappChat: "https://wa.me/8801921018882?text=Assalamu%20Alaikum%2C%20boostplus%20order%20help%20lagbe",
  whatsappGroup: "https://chat.whatsapp.com/HPnt32R6qFp3IO2IBNIlyp",
  telegram: ""   // e.g. "https://t.me/yourusername"
};

/** Escape untrusted text before putting it into innerHTML. Order/tracking
 *  data comes back from the Google Sheet and contains customer-typed values
 *  (link, service name, etc.), so it must never be injected raw. */
function escapeHtml(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only allow http(s) links to be rendered as clickable hrefs. */
function safeHttpUrl(url) {
  const u = String(url || "").trim();
  return /^https?:\/\//i.test(u) ? u : "";
}

let allPackages = [];
let catalogLoadState = 'loading'; // 'loading' | 'popular' | 'full' | 'error'
let activePlatform = 'all';
let searchQuery = '';
let currentLimit = 30;
let priceSort = 'default'; // default | low-high | high-low
let activeTag = ''; // tag key or empty
let refillMode = 'all'; // Refill / Non-Refill বাটন সরানো হয়েছে — সব সার্ভিস একসাথে দেখায় (ফিল্টার নেই)
let viewMode = 'popular'; // popular | all — controls default browsing experience
let selectedCategory = ''; // when viewMode === 'all': '' shows category cards, else shows that category's list
let selectedSubTag = ''; // '' shows sub-layer cards; '__all__' or a group key shows the final list

// Sub-layer (Layer 3) groups — built from tags that actually exist in the data,
// not invented buckets, so every group here is something a service is really tagged with.
//
// ORDER = PRIORITY. A service can carry several tags at once (e.g. HQ + Refill +
// Fast), so instead of letting it appear on every matching card, each service is
// assigned to exactly ONE card: the first group in this list that it matches.
// Most specific / highest-signal groups go first; "Fast" (which ~60% of all
// services carry) is deliberately near the bottom so it doesn't swallow everything.
const SUBLAYER_GROUPS = [
  { key: 'bd', label: '🇧🇩 বাংলাদেশি (BD)', test: p => /🇧🇩/.test(p.name) || (p.tags || []).some(t => t.includes('🇧🇩')) },
  { key: 'othercountry', label: '🌍 অন্যান্য দেশ', test: p => /[\u{1F1E6}-\u{1F1FF}]{2}/u.test(p.name) && !/🇧🇩/.test(p.name) },
  { key: 'nondrop', label: '✅ Non-Drop', test: p => (p.tags || []).some(t => t === 'Non-Drop' || t === 'Non Drop') },
  { key: 'hq', label: '⭐ HQ / Premium', test: p => (p.tags || []).some(t => ['HQ', 'NR', 'Real'].includes(t)) },
  { key: 'refill', label: '🔄 Refill Guarantee', test: p => (p.tags || []).includes('Refill') },
  { key: 'fast', label: '🚀 Fast / Instant', test: p => (p.tags || []).includes('Fast') },
  { key: 'general', label: '📦 সাধারণ', test: p => !p.tags || p.tags.length === 0 }
];

/** Each service belongs to exactly one sub-layer card: the first group in
 *  SUBLAYER_GROUPS (in priority order) whose test() matches. Returns '' if
 *  none match (shouldn't normally happen, but keeps this safe). */
function getExclusiveSubGroupKey(p) {
  const g = SUBLAYER_GROUPS.find(g => g.test(p));
  return g ? g.key : '';
}

const CATEGORY_ICONS = {
  'Followers': '👥',
  'Likes / Reactions': '❤️',
  'Views': '👁️',
  'Comments': '💬',
  'Shares / Retweets': '🔁',
  'Group Members': '👪',
  'Subscribers': '🔔',
  'Other': '⭐'
};

/** Small platform logo SVGs for service name badges */
const PLATFORM_LOGOS = {
  facebook: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
  instagram: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#E1306C"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>`,
  tiktok: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#ffffff"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>`,
  telegram: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#26A5E4"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>`,
  youtube: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#FF0000"><path d="M23.498 6.186a2.966 2.966 0 0 0-2.088-2.088C19.64 3.5 12 3.5 12 3.5s-7.64 0-9.41.598A2.966 2.966 0 0 0 .502 6.186 30.65 30.65 0 0 0 0 12a30.65 30.65 0 0 0 .502 5.814 2.966 2.966 0 0 0 2.088 2.088C4.36 20.5 12 20.5 12 20.5s7.64 0 9.41-.598a2.966 2.966 0 0 0 2.088-2.088A30.65 30.65 0 0 0 24 12a30.65 30.65 0 0 0-.502-5.814zM9.75 15.568V8.432L15.818 12z"/></svg>`,
  whatsapp: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`
};

function getPlatformBadge(platform) {
  const p = String(platform || "").toLowerCase();
  const svg = PLATFORM_LOGOS[p];
  if (!svg) return "";
  return `<span class="platform-badge platform-${p}" title="${p}">${svg}</span>`;
}

const paymentConfig = {
  nagad: { name: 'Nagad', type: 'mobile', number: '01921018882' },
  rocket: { name: 'Rocket', type: 'mobile', number: '01921018882' },
  bkash: { name: 'bKash', type: 'mobile', number: '01921018882' },
  binance: { name: 'Binance', type: 'crypto', uid: '796265206' }
};

let selectedPackage = null;
let selectedMethod = null;

// Step 1 TRX session id + expiry countdown (shared between Step 1 header and
// the Step 3 "waiting for payment" screen).
let checkoutTrxId = null;
let checkoutExpiryInterval = null;
let checkoutExpirySeconds = 15 * 60; // 15 minutes
let step3PromptTimeout = null;
let pendingPollInterval = null;
let binanceUidValue = '';

function generateTrxSessionId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 10; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

/** Counts DOWN from 15:00 and writes into whichever of the two display
 *  elements (Step 1 header / Step 3 big countdown) currently exist. */
function startCheckoutExpiry() {
  clearInterval(checkoutExpiryInterval);
  checkoutExpirySeconds = 15 * 60;
  const render = () => {
    const mm = String(Math.floor(checkoutExpirySeconds / 60)).padStart(2, '0');
    const ss = String(checkoutExpirySeconds % 60).padStart(2, '0');
    const s1 = document.getElementById('checkoutExpiry');
    const s1b = document.getElementById('checkoutExpiry2');
    const s3 = document.getElementById('step3Countdown');
    if (s1) s1.innerText = `${mm}:${ss}`;
    if (s1b) s1b.innerText = `${mm}:${ss}`;
    if (s3) s3.innerText = `${mm}:${ss} left`;
  };
  render();
  checkoutExpiryInterval = setInterval(() => {
    checkoutExpirySeconds = Math.max(0, checkoutExpirySeconds - 1);
    render();
    if (checkoutExpirySeconds <= 0) clearInterval(checkoutExpiryInterval);
  }, 1000);
}

// Prevent double / multi click order creation for the same form session
let orderSubmissionInProgress = false;
// Custom Comments সার্ভিসে কাস্টমারের লেখা কমেন্ট (প্রতি লাইনে ১টা) — পেমেন্ট/অর্ডার payload-এ যায়
let orderComments = "";

/** Custom Comment ধরনের সার্ভিস কি না (নাম/ক্যাটাগরিতে custom/costum + comment) */
function isCustomCommentPkg(pkg) {
  if (!pkg) return false;
  const t = String(pkg.name || "") + " " + String(pkg.category || "");
  return /(custom|costum)/i.test(t) && /comment/i.test(t);
}
/** টেক্সট থেকে খালি-নয় এমন লাইনগুলোর অ্যারে */
function commentLines(text) {
  return String(text || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}
let lastSuccessfulOrderId = null;
let lastSuccessfulPayload = null;

// দাম হিসাব (USD_TO_BDT_RATE, toBdtPrice, getSellingPrice, PB_PRICES, PB_DISCOUNTS,
// getBaseSellingPrice, getDiscountInfo, getFinalPrice) এখন pricing.js-এ — index.html-এ app-core.js-এর আগে লোড হয়।

/** HTML for a price with strike-through original + badge (used in cards/summary). */
function priceWithDiscountHtml(pkg) {
  const d = getDiscountInfo(pkg);
  const fin = getFinalPrice(pkg).toFixed(2);
  if (!d) return "৳" + fin + " / 1K";
  return '<s style="opacity:.55;font-weight:400;margin-right:4px;">৳' + d.original.toFixed(2) + '</s>৳' + fin + ' / 1K' +
    ' <span class="pb-disc-badge" style="background:#16a34a;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;margin-left:4px;">🔥 ' + d.badge + '</span>';
}

// Display order for service categories (catalog cards + dropdown picker).
// Anything not listed here is appended at the end, alphabetically.
const CATEGORY_ORDER = ["Followers · Bangladesh 🇧🇩", "Followers · Premium (Non Drop / HQ)", "Followers · Refill Guarantee ♻️", "Followers · Fast (Instant) ⚡", "Followers · Targeted Country 🌍", "Followers · Cheapest 💸", "Members · Premium (Non Drop / HQ)", "Members · Refill Guarantee ♻️", "Members · Fast (Instant) ⚡", "Members · Targeted Country 🌍", "Members · Cheapest 💸", "Premium Members", "Page Likes · Bangladesh 🇧🇩", "Page Likes · Premium (Non Drop / HQ)", "Page Likes · Refill Guarantee ♻️", "Page Likes · Targeted Country 🌍", "Group Members · Premium (Non Drop / HQ)", "Group Members · Fast (Instant) ⚡", "Group Members · Targeted Country 🌍", "Post Likes · Worldwide", "Post Likes · Targeted Country 🌍", "Post Reactions · Bangladesh 🇧🇩", "Post Reactions · Premium (Non Drop / HQ)", "Post Reactions · Fast (Instant) ⚡", "Post Reactions · Targeted Country 🌍", "Likes · Premium (Non Drop / HQ)", "Likes · Refill Guarantee ♻️", "Likes · Fast (Instant) ⚡", "Likes · Targeted Country 🌍", "Likes · Cheapest 💸", "Reactions · Premium (Non Drop / HQ)", "Reactions · Fast (Instant) ⚡", "Comment Likes / Reactions · Worldwide", "Comment Likes / Reactions · Targeted Country 🌍", "Comments · Bangladesh 🇧🇩", "Comments · Premium (Non Drop / HQ)", "Comments · Fast (Instant) ⚡", "Comments · Worldwide", "Comments · Targeted Country 🌍", "Views · Fast (Instant) ⚡", "Views · Targeted Country 🌍", "Views · Cheapest 💸", "Post Views · Premium (Non Drop / HQ)", "Post Views · Fast (Instant) ⚡", "Post Views · Targeted Country 🌍", "Post Views · Cheapest 💸", "Video / Reel Views · Premium (Non Drop / HQ)", "Video / Reel Views · Refill Guarantee ♻️", "Video / Reel Views · Fast (Instant) ⚡", "Video Views · Premium (Non Drop / HQ)", "Video Views · Fast (Instant) ⚡", "Video Views · Targeted Country 🌍", "Video Views · Cheapest 💸", "Views / Reels · Premium (Non Drop / HQ)", "Views / Reels · Fast (Instant) ⚡", "Views / Reels · Targeted Country 🌍", "Shares · Premium (Non Drop / HQ)", "Shares · Refill Guarantee ♻️", "Shares · Fast (Instant) ⚡", "Shares / Reposts", "Post Shares", "Retweets · Premium (Non Drop / HQ)", "Retweets · Refill Guarantee ♻️", "Retweets · Fast (Instant) ⚡", "Saves", "Story", "Story · Fast (Instant) ⚡", "Live Stream", "Live Stream · Premium (Non Drop / HQ)", "Live Stream · Fast (Instant) ⚡", "Live Stream / PK Battle · Premium (Non Drop / HQ)", "Live Stream / PK Battle · Fast (Instant) ⚡", "Live Stream / PK Battle · Cheapest 💸", "Reach / Impressions", "Impressions / Stats · Worldwide", "Impressions / Stats · Targeted Country 🌍", "Channel Members", "Monetization / Watch Time", "Bot Starts", "Poll Votes", "Stars / Boost", "Downloads", "Event Responses", "Friend Requests", "Page Reviews", "Mixed Packages", "Website Traffic", "Report / Spam", "Other Services"];

/** ক্যাটাগরির টাইপ অনুযায়ী ক্রম: Followers/Members → Likes/Reactions → Comments → Shares → Views → বাকি সব।
 *  CATEGORY_ORDER-এ নেই এমন ক্যাটাগরিও (পুরনো/কাস্টম) নামের শব্দ দেখে সঠিক জায়গায় বসে। */
function pbCatTypeRank(name) {
  const t = String(name || "").toLowerCase();
  if (/traffic/.test(t)) return 14;
  if (/report|spam/.test(t)) return 15;
  if (/monetiz|watch ?time/.test(t)) return 11;
  if (/live|pk battle/.test(t)) return 8;
  if (/story|stories/.test(t)) return 7;
  if (/\bsaves?\b/.test(t)) return 9;
  if (/comment/.test(t)) return 3;
  if (/share|repost|retweet/.test(t)) return 4;
  if (/package|engagement/.test(t)) return 13;
  if (/bot start|poll|vote|stars|boost|download|event|friend|review/.test(t)) return 12;
  if (/reach|impression|stats/.test(t)) return 10;
  if (/follower|subscriber/.test(t)) return 0;
  if (/member/.test(t)) return 1;
  if (/like|react/.test(t)) return 2;
  if (/view|play|reel|video/.test(t)) return 5;
  if (/other/.test(t)) return 16;
  return 17;
}

function sortCategories(names) {
  const rank = window.PB_CAT_RANK || {};
  return names.slice().sort((a, b) => {
    // Admin-defined order (Telegram bot) wins over the default order
    const ra = rank[a], rb = rank[b];
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    const ta = pbCatTypeRank(a), tb = pbCatTypeRank(b);
    if (ta !== tb) return ta - tb;
    const ia = CATEGORY_ORDER.indexOf(a), ib = CATEGORY_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return String(a).localeCompare(String(b));
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// ---------- Order helpers & validators ----------
function sheetApi() {
  return (window.BOOSTPLUS_SHEET_API || "").trim();
}

function generateOrderId() {
  // Numeric 5-digit ID (10000-99999). The server checks it and assigns a fresh one if it is already taken.
  let n = 0;
  try { const a = new Uint32Array(1); crypto.getRandomValues(a); n = a[0]; } catch (e) { n = Math.floor(Math.random() * 4294967296); }
  return String(10000 + (n % 90000));
}

/** Exactly 11 digits, starts with 01 */
function isValidMobile(mobile) {
  const m = String(mobile || "").replace(/\D/g, "");
  return /^01\d{9}$/.test(m);
}

/** Structural TrxID validation by method (does not invent real IDs) */
function isValidTrxId(trx, method) {
  const t = String(trx || "").trim();
  if (!t || t.length < 6 || t.length > 20) return false;
  if (/\s/.test(t)) return false;
  if (/^(test|null|undefined|n\/a|none|0+)$/i.test(t)) return false;

  const m = String(method || "").toLowerCase();
  if (m === "rocket") return /^\d{8,12}$/.test(t);
  if (m === "nagad") return /^[A-Za-z0-9]{6,12}$/.test(t);
  if (m === "bkash") return /^[A-Za-z0-9]{8,14}$/.test(t);
  // Binance or unknown
  return /^[A-Za-z0-9]{6,20}$/.test(t);
}


/* ==========================================================
   Wallet top-up bonus (অ্যাডমিন টেলিগ্রাম বটের /bonus দিয়ে সেট; সার্ভার একই হিসাবে ক্রেডিট দেয়)
   window.PB_TOPUP_BONUS = { active, tiers:[{min, percent}] } | null  (service_meta থেকে আসে)
   ========================================================== */
function pbBonusFor(amount) {
  const cfg = window.PB_TOPUP_BONUS, a = Number(amount) || 0;
  const out = { bonus: 0, percent: 0, next: null };
  if (!cfg || !cfg.tiers || !cfg.tiers.length) return out;
  const tiers = cfg.tiers.slice().sort((x, y) => x.min - y.min);
  let best = null;
  tiers.forEach(t => { if (a >= t.min) best = t; });
  if (best) { out.percent = best.percent; out.bonus = Math.floor(a * best.percent / 100); }
  out.next = tiers.find(t => t.min > a) || null;
  return out;
}
function pbBonusTiersText() {
  const cfg = window.PB_TOPUP_BONUS;
  if (!cfg || !cfg.tiers) return "";
  return cfg.tiers.slice().sort((x, y) => x.min - y.min).map(t => "৳" + t.min + "+ → " + t.percent + "%").join("  ·  ");
}
window.pbRenderBonusUI = function () {
  const on = !!(window.PB_TOPUP_BONUS && window.PB_TOPUP_BONUS.tiers && window.PB_TOPUP_BONUS.tiers.length);
  const promo = document.getElementById("topupPromo");
  if (promo) {
    promo.hidden = !on;
    if (on) promo.innerHTML = "🎁 <b>টপ-আপে বোনাস!</b> <span>" + pbBonusTiersText() + "</span>";
  }
  const banner = document.getElementById("tfBonusBanner");
  const cell = document.getElementById("afSumBonusCell");
  const grid = document.querySelector(".af-summary");
  const amtEl = document.getElementById("walTopAmount");
  const v = Number(amtEl && amtEl.value) || 0;
  if (!on) {
    if (banner) banner.hidden = true;
    if (cell) cell.hidden = true;
    if (grid) grid.classList.remove("has-bonus");
    return;
  }
  const r = pbBonusFor(v);
  if (banner) {
    let line = "🎁 <b>টপ-আপ বোনাস:</b> " + pbBonusTiersText();
    if (v > 0 && r.bonus > 0) line += "<div class=\"tf-bonus-now\">এই টপ-আপে পাচ্ছেন <b>+৳" + r.bonus + "</b> বোনাস (" + r.percent + "%)</div>";
    else if (r.next) line += "<div class=\"tf-bonus-now\">৳" + r.next.min + " বা তার বেশি টপ-আপ করলে " + r.next.percent + "% বোনাস পাবেন" + (v > 0 ? " (আরও ৳" + (r.next.min - v) + ")" : "") + "</div>";
    banner.innerHTML = line;
    banner.hidden = false;
  }
  if (cell && grid) {
    const show = v > 0 && r.bonus > 0;
    cell.hidden = !show;
    grid.classList.toggle("has-bonus", show);
    if (show) {
      const b = document.getElementById("afSumBonus"); if (b) b.textContent = "+৳" + r.bonus;
      const t = document.getElementById("afSumTotal"); if (t) t.textContent = "৳" + (v + r.bonus).toFixed(2);
    }
  }
};
document.addEventListener("input", function (e) { if (e.target && e.target.id === "walTopAmount") setTimeout(window.pbRenderBonusUI, 0); });
document.addEventListener("click", function (e) {
  if (e.target && e.target.closest && e.target.closest(".tf-qamt")) setTimeout(window.pbRenderBonusUI, 20);
  const pr = e.target && e.target.closest && e.target.closest("#topupPromo");
  if (pr) {   // লগইন থাকলে টপ-আপ পেজ, না থাকলে লগইন
    const guest = document.getElementById("userDashGuest");
    const btn = (guest && guest.style.display !== "none") ? document.getElementById("udLoginBtn") : document.getElementById("udAddFundBtn");
    if (btn) btn.click();
  }
});
