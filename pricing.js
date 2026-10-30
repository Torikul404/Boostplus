/**
 * pricing.js — boostplus দাম হিসাবের একমাত্র নিয়ম (কাস্টমার সাইট + অ্যাডমিন প্যানেল দুটোই এটা লোড করে)
 *
 * ডলার রেট, মার্কআপ, কাস্টম দাম ও ডিসকাউন্টের হিসাব শুধু এই ফাইলে বদলান — আর কোথাও নয়।
 * লোড ক্রম: pricing.js আগে, তারপর app-core.js (index.html) / অ্যাডমিন স্ক্রিপ্ট (admin.html)।
 * app-core.js থেকে হুবহু সরানো কোড (লজিক অপরিবর্তিত)।
 */

// Currency conversion: packages-full.json stores base price in USD (e.g. "$0.34")
// 1 USD = 131 BDT — every selling price / total is calculated from this rate.
const USD_TO_BDT_RATE = 131;

/** Parses a base price from the package data (accepts "$0.34", "0.34", 0.34, etc.)
 *  and returns the equivalent price in BDT. */
function toBdtPrice(rawPrice) {
  if (rawPrice === null || rawPrice === undefined) return 0;
  const usd = parseFloat(String(rawPrice).replace(/[^0-9.]/g, "")) || 0;
  return usd * USD_TO_BDT_RATE;
}

// Selling price markup (per 1K)
// 0-20 → +7 | 21-40 → +12 | 41-70 → +16 | 71-100 → +21 | 101-200 → +25 | 201+ → +30
function getSellingPrice(basePrice) {
  const p = toBdtPrice(basePrice);
  let markup = 7;
  if (p > 200) markup = 30;
  else if (p > 100) markup = 25;
  else if (p > 70) markup = 21;
  else if (p > 40) markup = 16;
  else if (p > 20) markup = 12;
  return p + markup;
}

// ---------- Per-service discounts (set from admin panel → Services tab) ----------
// window.PB_DISCOUNTS = { "<code>": { type: "percent"|"fixed", value: 10, until: "2026-10-20T23:59:00+06:00" | "", label: "Eid Offer" } }
// percent → % off the selling price | fixed → ৳ off per 1K. Expired discounts are ignored automatically.
window.PB_DISCOUNTS = window.PB_DISCOUNTS || {};

// ---------- Per-service custom price (set from admin panel → Services tab) ----------
// window.PB_PRICES = { "<code>": 45.5 }  → প্রতি 1K-র সেলিং প্রাইস (৳)। থাকলে ডিফল্ট markup-এর বদলে এটি ব্যবহার হয়।
window.PB_PRICES = window.PB_PRICES || {};

/** Selling price per 1K before discount: admin custom price if set, otherwise default markup. */
function getBaseSellingPrice(pkg) {
  const c = Number((window.PB_PRICES || {})[String(pkg && pkg.code)]);
  return c > 0 ? c : getSellingPrice(pkg.pricePerK);
}

/** Active discount for a package (or null). Always re-checks expiry. */
function getDiscountInfo(pkg) {
  if (!pkg) return null;
  const d = (window.PB_DISCOUNTS || {})[String(pkg.code)];
  if (!d) return null;
  const val = Number(d.value) || 0;
  if (val <= 0) return null;
  if (d.until) {
    const t = Date.parse(d.until);
    if (!isNaN(t) && Date.now() > t) return null;
  }
  const base = getBaseSellingPrice(pkg);
  let off = d.type === "fixed" ? val : base * Math.min(val, 90) / 100;
  off = Math.max(0, Math.min(off, base * 0.9));   // never below 10% of price
  if (off <= 0) return null;
  return {
    type: d.type === "fixed" ? "fixed" : "percent",
    value: val,
    label: d.label || "",
    original: base,
    price: base - off,
    badge: d.type === "fixed" ? ("৳" + val + " ছাড়") : (val + "% ছাড়")
  };
}

/** Final per-1K selling price after any active discount. */
function getFinalPrice(pkg) {
  const d = getDiscountInfo(pkg);
  return d ? d.price : getBaseSellingPrice(pkg);
}
