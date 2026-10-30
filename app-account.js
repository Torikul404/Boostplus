/* ==========================================================
   app-account.js — ধাপ ২২: অ্যাকাউন্ট পাতা (প্রোফাইল · ইমেইল · পাসওয়ার্ড · টাইমজোন)
   নির্ভর করে: app-sidebar.js (পাতা খোলা: pb:account-open), app-wallet.js (window.pbToast, সেশন localStorage),
   ব্যাকএন্ড: wallet_auth sub account_get / account_save (Code.gs)। 2FA ও API key এই ধাপে নেই (পরে)।
   মোবাইলে (<768 px) সেকশন অ্যাকর্ডিয়ন; এই পাতায় মডাল নেই (০ ≤ ৩)।
   ========================================================== */
(function () {
  const $ = (id) => document.getElementById(id);
  const view = $('account-view');
  if (!view) return;
  const LS_TOKEN = 'pb_wallet_token', LS_MOBILE = 'pb_wallet_mobile', LS_NAME = 'pb_wallet_name', LS_TZ = 'pb_tz';
  const DEFAULT_TZ = 'Asia/Dhaka';
  const ls = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const token = () => ls(LS_TOKEN);
  const toast = (type, text) => { if (typeof window.pbToast === 'function') window.pbToast(type, text); };
  const api = () => (typeof sheetApi === 'function' ? sheetApi() : '') || window.BOOSTPLUS_SHEET_API || '';

  async function post(body) {
    const url = api();
    if (!url) throw new Error('no_api');
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = setTimeout(() => { if (ctrl) ctrl.abort(); }, 30000);
    try {
      const res = await fetch(url, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined });
      return await res.json();
    } finally { clearTimeout(t); }
  }
  const netMsg = 'ইন্টারনেট সংযোগে সমস্যা হয়েছে। আবার চেষ্টা করুন।';

  // ---------- অ্যাকর্ডিয়ন (<768 px) ----------
  const mq = window.matchMedia ? window.matchMedia('(min-width: 768px)') : null;
  const heads = Array.from(view.querySelectorAll('.pb-acc-head'));
  function setOpen(btn, open) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    const body = $(btn.getAttribute('aria-controls'));
    if (body) body.hidden = !open;
  }
  function layout() {
    if (mq && mq.matches) heads.forEach((b) => setOpen(b, true));          // বড় পর্দা: সব খোলা
    else heads.forEach((b, i) => setOpen(b, i === 0));                    // মোবাইল: প্রথমটি খোলা
  }
  heads.forEach((b) => b.addEventListener('click', () => {
    if (mq && mq.matches) return;
    setOpen(b, b.getAttribute('aria-expanded') !== 'true');
  }));
  if (mq) { if (mq.addEventListener) mq.addEventListener('change', layout); else if (mq.addListener) mq.addListener(layout); }
  layout();

  // ---------- অবস্থা ----------
  function paintGuest(guest) {
    $('accGuest').hidden = !guest;
    $('accSections').hidden = guest;
  }
  function paintProfile(name, mobile) {
    $('accName').textContent = name || '—';
    $('accMobile').textContent = mobile || '—';
  }
  async function load() {
    if (!token()) { paintGuest(true); return; }
    paintGuest(false);
    paintProfile(ls(LS_NAME), ls(LS_MOBILE));        // আগে লোকাল মান, তারপর সার্ভারের
    const em = $('accEmail');
    em.disabled = true;
    try {
      const d = await post({ action: 'wallet_auth', sub: 'account_get', token: token() });
      if (d && d.ok) { paintProfile(d.name || ls(LS_NAME), d.mobile || ls(LS_MOBILE)); em.value = d.email || ''; }
      else if (d && d.error === 'auth') { paintGuest(true); toast('error', d.message || 'আবার লগইন করুন'); }
      else toast('error', (d && d.message) || 'তথ্য আনা যায়নি');
    } catch (e) { toast('error', netMsg); }
    em.disabled = false;
  }

  // ---------- ইমেইল ----------
  const saveBtn = $('accEmailSave');
  saveBtn.addEventListener('click', async () => {
    const email = ($('accEmail').value || '').trim();
    if (email && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(email)) { toast('error', 'ইমেইল ঠিক নয়'); return; }
    saveBtn.disabled = true;
    try {
      const d = await post({ action: 'wallet_auth', sub: 'account_save', token: token(), email: email });
      if (d && d.ok) { $('accEmail').value = d.email || ''; toast('success', d.message || 'সেভ হয়েছে'); }
      else toast('error', (d && d.message) || 'সেভ করা যায়নি');
    } catch (e) { toast('error', netMsg); }
    saveBtn.disabled = false;
  });

  // ---------- পাসওয়ার্ড (PIN): বিদ্যমান PIN-বদল পাতা খোলে ----------
  $('accPinBtn').addEventListener('click', () => { const b = $('pbSideChangePin'); if (b) b.click(); });
  $('accLoginBtn').addEventListener('click', () => { const b = $('navWalletBtn'); if (b) b.click(); });

  // ---------- টাইমজোন (শুধু এই ডিভাইসে) ----------
  const FALLBACK_TZ = ['Asia/Dhaka', 'Asia/Kolkata', 'Asia/Karachi', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Singapore', 'Asia/Kuala_Lumpur', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Australia/Sydney', 'UTC'];
  const sel = $('accTz');
  let zones = FALLBACK_TZ;
  try { if (Intl.supportedValuesOf) zones = Intl.supportedValuesOf('timeZone'); } catch (e) {}
  if (zones.indexOf(DEFAULT_TZ) < 0) zones = [DEFAULT_TZ].concat(zones);
  if (zones.indexOf('UTC') < 0) zones = zones.concat(['UTC']);
  sel.innerHTML = zones.map((z) => '<option value="' + z + '">' + z.replace(/_/g, ' ') + '</option>').join('');
  let cur = ls(LS_TZ);
  if (zones.indexOf(cur) < 0) cur = DEFAULT_TZ;
  sel.value = cur;
  function clock() {
    try { return new Date().toLocaleString('bn-BD', { timeZone: sel.value, hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' }); } catch (e) { return ''; }
  }
  function note() { $('accTzNote').textContent = 'এখন ওই জোনে: ' + clock() + ' · শুধু এই ডিভাইসে সেভ হয় (অর্ডারের সময় দেখানোয় প্রয়োগ পরে)।'; }
  sel.addEventListener('change', () => { try { localStorage.setItem(LS_TZ, sel.value); } catch (e) {} note(); toast('success', 'টাইমজোন সেভ হয়েছে'); });
  note();

  document.addEventListener('pb:account-open', () => { layout(); note(); load(); });
  // #account ডিপ-লিংক: app-sidebar.js ইভেন্টটি এই স্ক্রিপ্ট লোডের আগেই ছুঁড়ে দেয়, তাই পাতা আগে থেকে খোলা থাকলে এখনই লোড
  if (view.style.display === 'block') load();
})();
