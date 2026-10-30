/* ==========================================================
   app-order.js — hand-off from the order form (Category/Service/Link/Qty
   on the main page) to the payment gateway (Step 1).
   ========================================================== */

/** ধাপ ৭: সরাসরি পেমেন্ট গেটওয়ে (bKash/Nagad/Rocket/Binance দিয়ে অর্ডার) বন্ধ।
 *  অর্ডার শুধু ওয়ালেট ব্যালেন্স থেকে হয়; এই ফাংশন কোথাও থেকে ডাকা হলেও আর পেমেন্ট পেজ খোলে না —
 *  লগইন থাকলে টপ-আপ পেজে, না থাকলে লগইন পেজে পাঠায়। পুরনো পূর্ণ কোড: backups/step7/app-order.js */
function goToPaymentGateway() {
  let tok = "";
  try { tok = localStorage.getItem("pb_wallet_token") || ""; } catch (e) {}
  if (tok && typeof window.goTopup === "function") window.goTopup();
  else location.href = "login.html";
}
